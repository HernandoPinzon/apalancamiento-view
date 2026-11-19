import { describe, expect, it } from 'vitest'
import { demoData } from '@/data/demoData'
import { analyzePortfolio } from '@/lib/risk'
import { buildExecutiveSummary } from '@/lib/summary'
import type { RiskInput } from '@/types/risk'

function leveragedInput(): RiskInput {
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

function overLeveragedInput(): RiskInput {
  return {
    platforms: [{ id: 'p1', name: 'Cuenta', type: 'margen', equity: 300, marginUsed: 150 }],
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

describe('buildExecutiveSummary', () => {
  it('calcula la caída hasta liquidación', () => {
    const summary = buildExecutiveSummary(analyzePortfolio(leveragedInput()))
    // mantenimiento 50% de 500 = 250; caída = (1000 - 250) / 1000 = 75%
    expect(summary.liquidationPlatform).toBe('Cuenta')
    expect(summary.liquidationBufferPct).toBeCloseTo(75, 6)
  })

  it('identifica la plataforma con menor margen como prioridad', () => {
    const summary = buildExecutiveSummary(analyzePortfolio(demoData))
    expect(summary.priority).not.toBeNull()
    expect(summary.tone).toBeDefined()
  })

  it('resume la concentración por activo', () => {
    const summary = buildExecutiveSummary(analyzePortfolio(demoData))
    expect(summary.concentration).not.toBeNull()
    expect(summary.concentration?.topShare).toBeGreaterThan(0)
    expect(summary.concentration?.topShare).toBeLessThanOrEqual(1)
    expect(summary.concentration?.top3Share).toBeGreaterThanOrEqual(summary.concentration?.topShare ?? 1)
  })

  it('marca la mayor aportación necesaria', () => {
    const summary = buildExecutiveSummary(analyzePortfolio(overLeveragedInput()))
    expect(summary.biggestAddToTarget?.platformName).toBe('Cuenta')
    expect(summary.biggestAddToTarget?.amount).toBeCloseTo(200, 6)
  })
})
