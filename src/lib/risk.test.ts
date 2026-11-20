import { describe, expect, it } from 'vitest'
import { demoData } from '@/data/demoData'
import {
  analyzePortfolio,
  leverageTone,
  marginTone,
  parseNumber,
  parseNumberList,
  parseOptionalNumber,
} from '@/lib/risk'
import type { PlatformInput, RiskConfig, RiskInput } from '@/types/risk'

const baseConfig: RiskConfig = {
  keyAsset: 'AAA',
  marginTargetPct: 200,
  leverageTarget: 2,
  maintenanceMarginPct: 50,
  marginLevels: [200, 150, 100, 50],
  scenarios: [0, -4.5, -5.5],
}

function makeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    platforms: [{ id: 'p1', name: 'Cuenta', type: 'margen', equity: 100, marginUsed: 100 }],
    positions: [
      { id: 'x1', platform: 'Cuenta', asset: 'AAA', direction: 'Compra', quantity: 10, currentPrice: 10 },
    ],
    config: baseConfig,
    ...overrides,
  }
}

describe('parseOptionalNumber', () => {
  it('interpreta números en formato español e inglés', () => {
    expect(parseNumber('1.234,56')).toBeCloseTo(1234.56, 6)
    expect(parseNumber('1,234.56')).toBeCloseTo(1234.56, 6)
    expect(parseNumber('1.234')).toBe(1234)
    expect(parseNumber('1,234')).toBeCloseTo(1.234, 6)
    expect(parseNumber('0.001')).toBeCloseTo(0.001, 6)
    expect(parseNumber('1 234,56')).toBeCloseTo(1234.56, 6)
    expect(parseNumber('(1.234,56)')).toBeCloseTo(-1234.56, 6)
    expect(parseNumber('1.234,56 €')).toBeCloseTo(1234.56, 6)
    expect(parseNumber('200 %')).toBe(200)
    expect(parseNumber(42)).toBe(42)
  })

  it('distingue un valor ausente de un cero', () => {
    expect(parseOptionalNumber('')).toBeNull()
    expect(parseOptionalNumber('   ')).toBeNull()
    expect(parseOptionalNumber('abc')).toBeNull()
    expect(parseOptionalNumber(Number.POSITIVE_INFINITY)).toBeNull()
    expect(parseOptionalNumber('0')).toBe(0)
  })
})

describe('parseNumberList', () => {
  it('acepta listas separadas por comas', () => {
    expect(parseNumberList('200,150,100,50', [])).toEqual([200, 150, 100, 50])
  })

  it('respeta la coma decimal cuando se usa punto y coma', () => {
    expect(parseNumberList('0;-2,5;-5', [])).toEqual([0, -2.5, -5])
  })

  it('descarta entradas inválidas en lugar de convertirlas en cero', () => {
    expect(parseNumberList('200;150;abc', [])).toEqual([200, 150])
    expect(parseNumberList('', [7])).toEqual([7])
  })
})

describe('analyzePortfolio', () => {
  it('mantiene alineadas la exposición global, las plataformas y el estrés', () => {
    const analysis = analyzePortfolio(demoData)
    const platformExposure = analysis.platforms.reduce((sum, platform) => sum + platform.exposure, 0)
    expect(analysis.global.exposure).toBeCloseTo(platformExposure, 6)
    expect(analysis.stress[0].exposure).toBeCloseTo(analysis.global.exposure, 6)
  })

  it('excluye de todo el análisis las posiciones con plataforma inexistente', () => {
    const input = makeInput()
    input.positions.push({
      id: 'x2',
      platform: 'Fantasma',
      asset: 'BBB',
      direction: 'Compra',
      quantity: 1,
      currentPrice: 5,
    })
    const analysis = analyzePortfolio(input)
    expect(analysis.global.exposure).toBeCloseTo(100, 6)
    expect(analysis.stress[0].exposure).toBeCloseTo(100, 6)
    expect(analysis.warnings.some((warning) => warning.includes('no existe'))).toBe(true)
  })

  it('trata un patrimonio nulo como riesgo infinito, no como cero', () => {
    const platform: PlatformInput = { id: 'p1', name: 'Cuenta', type: 'margen', equity: 0, marginUsed: 0 }
    const analysis = analyzePortfolio(makeInput({ platforms: [platform] }))
    expect(analysis.global.leverage).toBe(Infinity)
    expect(leverageTone(analysis.global.leverage, 2)).toBe('danger')
  })

  it('marca liquidación al cruzar el margen de mantenimiento de cada plataforma', () => {
    const input = makeInput({
      positions: [
        { id: 'x1', platform: 'Cuenta', asset: 'AAA', direction: 'Compra', quantity: 100, currentPrice: 10 },
      ],
    })
    const analysis = analyzePortfolio(input)
    const mild = analysis.stress.find((row) => row.scenarioPct === -4.5)
    const severe = analysis.stress.find((row) => row.scenarioPct === -5.5)

    expect(mild?.marginLevel).toBeCloseTo(55, 6)
    expect(mild?.liquidated).toBe(false)
    expect(severe?.marginLevel).toBeCloseTo(45, 6)
    expect(severe?.liquidated).toBe(true)
    expect(severe?.liquidatedPlatforms).toEqual(['Cuenta'])
  })

  it('usa el mantenimiento configurado si la plataforma no define uno propio', () => {
    const input = makeInput({
      positions: [
        { id: 'x1', platform: 'Cuenta', asset: 'AAA', direction: 'Compra', quantity: 100, currentPrice: 10 },
      ],
      config: { ...baseConfig, maintenanceMarginPct: 60 },
    })
    const analysis = analyzePortfolio(input)
    const mild = analysis.stress.find((row) => row.scenarioPct === -4.5)
    expect(mild?.marginLevel).toBeCloseTo(55, 6)
    expect(mild?.liquidated).toBe(true)
  })

  it('deja el precio de entrada en N/A cuando ninguna posición lo informa', () => {
    const analysis = analyzePortfolio(makeInput())
    expect(analysis.keyAssets[0]?.entryPrice).toBeNull()
  })

  it('separa cantidad bruta y neta cuando hay posiciones cubiertas', () => {
    const analysis = analyzePortfolio(
      makeInput({
        positions: [
          { id: 'x1', platform: 'Cuenta', asset: 'AAA', direction: 'Compra', quantity: 2, currentPrice: 10 },
          { id: 'x2', platform: 'Cuenta', asset: 'AAA', direction: 'Venta', quantity: 1, currentPrice: 10 },
        ],
      }),
    )
    const keyAsset = analysis.keyAssets[0]
    expect(keyAsset?.quantityAbs).toBe(3)
    expect(keyAsset?.quantityNet).toBe(1)
    expect(analysis.warnings.some((warning) => warning.includes('largas y cortas'))).toBe(true)
  })

  it('calcula los niveles de margen y la fila de ruina', () => {
    const analysis = analyzePortfolio(makeInput())
    const levels = analysis.keyAssets[0]?.levels ?? []
    const margins = levels.filter((level) => level.kind === 'margin')
    expect(margins.map((level) => level.marginLevelPct)).toEqual([200, 150, 100, 50])
    expect(margins.map((level) => level.price)).toEqual([20, 15, 10, 5])
    const ruin = levels.find((level) => level.kind === 'ruin')
    expect(ruin?.price).toBeCloseTo(0, 6)
    expect(ruin?.dropPct).toBeCloseTo(-100, 6)
  })

  it('usa niveles de caída cuando la plataforma no informa margen', () => {
    const platform: PlatformInput = { id: 'p1', name: 'Cuenta', type: 'cripto', equity: 100, marginUsed: 0 }
    const analysis = analyzePortfolio(makeInput({ platforms: [platform] }))
    const levels = analysis.keyAssets[0]?.levels ?? []
    const drops = levels.filter((level) => level.kind === 'drop')
    expect(drops.map((level) => level.dropPct)).toEqual([-10, -20, -30, -40, -50])
    expect(levels.some((level) => level.kind === 'ruin')).toBe(true)
  })
})

describe('tonos de margen', () => {
  it('distingue liquidación, margin call, aviso y zona segura', () => {
    expect(marginTone(45, 200, 50)).toBe('danger')
    expect(marginTone(80, 200, 50)).toBe('danger')
    expect(marginTone(150, 200, 50)).toBe('warn')
    expect(marginTone(250, 200, 50)).toBe('safe')
    expect(marginTone(null, 200, 50)).toBe('neutral')
  })
})
