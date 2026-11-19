import { describe, expect, it } from 'vitest'
import { analyzePortfolio } from '@/lib/risk'
import { leverageCurve, marginByPlatform } from '@/lib/charts'
import type { RiskInput } from '@/types/risk'

function makeInput(): RiskInput {
  return {
    platforms: [
      { id: 'p1', name: 'Cuenta A', type: 'margen', equity: 300, marginUsed: 150 },
      { id: 'p2', name: 'Cuenta B', type: 'cripto', equity: 500, marginUsed: 0 },
    ],
    positions: [
      { id: 'x1', platform: 'Cuenta A', asset: 'AAA', direction: 'Compra', quantity: 10, currentPrice: 100 },
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

describe('leverageCurve', () => {
  it('genera los puntos pedidos y coincide con el apalancamiento actual en 0%', () => {
    const curve = leverageCurve(makeInput(), -10, 10, 3)
    expect(curve).toHaveLength(3)
    expect(curve.map((point) => point.movePct)).toEqual([-10, 0, 10])
    // exposición 1000 / patrimonio 800 = 1,25
    expect(curve[1].leverage).toBeCloseTo(1.25, 6)
  })

  it('el apalancamiento sube al caer el mercado en un portafolio largo apalancado', () => {
    const curve = leverageCurve(makeInput(), -20, 0, 3)
    expect(curve[0].leverage).toBeGreaterThan(curve[2].leverage)
  })
})

describe('marginByPlatform', () => {
  it('devuelve una barra por plataforma con su tono', () => {
    const bars = marginByPlatform(analyzePortfolio(makeInput()))
    expect(bars).toHaveLength(2)
    expect(bars[0]).toMatchObject({ name: 'Cuenta A', maintenance: 50 })
    expect(bars[1].marginLevel).toBeNull()
  })
})
