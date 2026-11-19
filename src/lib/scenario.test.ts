import { describe, expect, it } from 'vitest'
import { demoData } from '@/data/demoData'
import { analyzePortfolio } from '@/lib/risk'
import { applyScenario, EMPTY_SCENARIO, isScenarioActive, type ScenarioState } from '@/lib/scenario'
import type { RiskInput } from '@/types/risk'

function makeInput(): RiskInput {
  return {
    platforms: [{ id: 'p1', name: 'Cuenta', type: 'margen', equity: 1000, marginUsed: 500 }],
    positions: [
      { id: 'x1', platform: 'Cuenta', asset: 'AAA', direction: 'Compra', quantity: 10, currentPrice: 100 },
    ],
    config: {
      keyAsset: 'AAA',
      marginTargetPct: 200,
      leverageTarget: 2,
      maintenanceMarginPct: 50,
      marginLevels: [200, 150, 100, 50],
      scenarios: [0, -10],
    },
  }
}

describe('isScenarioActive', () => {
  it('detecta el escenario vacío', () => {
    expect(isScenarioActive(EMPTY_SCENARIO)).toBe(false)
    expect(isScenarioActive({ ...EMPTY_SCENARIO, marketMovePct: -5 })).toBe(true)
    expect(isScenarioActive({ ...EMPTY_SCENARIO, assetMoves: { AAA: 0 } })).toBe(false)
    expect(isScenarioActive({ ...EMPTY_SCENARIO, fundsAdded: { Cuenta: 100 } })).toBe(true)
  })
})

describe('applyScenario', () => {
  it('devuelve la misma referencia con el escenario vacío', () => {
    const input = makeInput()
    expect(applyScenario(input, EMPTY_SCENARIO)).toBe(input)
  })

  it('el movimiento de mercado mueve precio, exposición y patrimonio como el estrés', () => {
    const input = makeInput()
    const scenario: ScenarioState = { ...EMPTY_SCENARIO, marketMovePct: -10 }
    const stressed = analyzePortfolio(applyScenario(input, scenario)).global

    expect(stressed.exposure).toBeCloseTo(900, 6)
    expect(stressed.equity).toBeCloseTo(900, 6)

    const stressRow = analyzePortfolio(input).stress.find((row) => row.scenarioPct === -10)
    expect(stressed.exposure).toBeCloseTo(stressRow?.exposure ?? NaN, 6)
    expect(stressed.equity).toBeCloseTo(stressRow?.equity ?? NaN, 6)
  })

  it('el override por activo gana al movimiento general', () => {
    const input = makeInput()
    const scenario: ScenarioState = { ...EMPTY_SCENARIO, marketMovePct: -10, assetMoves: { AAA: 20 } }
    const result = applyScenario(input, scenario)
    expect(result.positions[0].currentPrice).toBeCloseTo(120, 6)
    expect(result.platforms[0].equity).toBeCloseTo(1200, 6)
  })

  it('los fondos añadidos suben el patrimonio y bajan el apalancamiento', () => {
    const input = makeInput()
    const before = analyzePortfolio(input).global.leverage
    const after = analyzePortfolio(applyScenario(input, { ...EMPTY_SCENARIO, fundsAdded: { Cuenta: 1000 } })).global.leverage
    expect(after).toBeLessThan(before)
    expect(after).toBeCloseTo(0.5, 6)
  })

  it('las posiciones hipotéticas añaden exposición', () => {
    const input = makeInput()
    const result = applyScenario(input, {
      ...EMPTY_SCENARIO,
      extraPositions: [{ id: 'h1', platform: 'Cuenta', asset: 'BBB', direction: 'Compra', quantity: 2, currentPrice: 50 }],
    })
    expect(result.positions).toHaveLength(2)
    expect(analyzePortfolio(result).global.exposure).toBeCloseTo(1100, 6)
  })
})

describe('applyScenario con datos de ejemplo', () => {
  it('mantiene la coherencia de exposición y plataformas', () => {
    const result = applyScenario(demoData, { ...EMPTY_SCENARIO, marketMovePct: -5 })
    const analysis = analyzePortfolio(result)
    const platformExposure = analysis.platforms.reduce((sum, platform) => sum + platform.exposure, 0)
    expect(analysis.global.exposure).toBeCloseTo(platformExposure, 6)
  })
})
