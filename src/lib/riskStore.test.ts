import { describe, expect, it } from 'vitest'
import { createInitialState, riskDataReducer, type RiskDataState } from '@/lib/riskStore'
import type { RiskInput } from '@/types/risk'

function makeInput(): RiskInput {
  return {
    platforms: [
      { id: 'p1', name: 'Cuenta A', type: 'margen', equity: 1000, marginUsed: 500 },
      { id: 'p2', name: 'Cuenta B', type: 'cripto', equity: 500, marginUsed: 0 },
    ],
    positions: [
      { id: 'x1', platform: 'Cuenta A', asset: 'AAA', direction: 'Compra', quantity: 10, currentPrice: 100 },
      { id: 'x2', platform: 'Cuenta B', asset: 'BBB', direction: 'Compra', quantity: 1, currentPrice: 50 },
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

function initial(): RiskDataState {
  return createInitialState(makeInput(), 'test', true, false)
}

describe('createInitialState', () => {
  it('selecciona el activo clave y su primera plataforma', () => {
    const state = initial()
    expect(state.selectedAsset).toBe('AAA')
    expect(state.selectedPlatform).toBe('Cuenta A')
    expect(state.persist).toBe(true)
  })
})

describe('riskDataReducer', () => {
  it('añade y elimina posiciones', () => {
    const added = riskDataReducer(initial(), {
      type: 'addPosition',
      position: { id: 'x3', platform: 'Cuenta A', asset: 'CCC', direction: 'Venta', quantity: 1, currentPrice: 10 },
    })
    expect(added.data.positions).toHaveLength(3)

    const removed = riskDataReducer(added, { type: 'removePosition', id: 'x3' })
    expect(removed.data.positions).toHaveLength(2)
  })

  it('actualiza una posición', () => {
    const next = riskDataReducer(initial(), { type: 'updatePosition', id: 'x1', patch: { quantity: 42 } })
    expect(next.data.positions.find((position) => position.id === 'x1')?.quantity).toBe(42)
  })

  it('al renombrar una plataforma actualiza sus posiciones', () => {
    const next = riskDataReducer(initial(), { type: 'updatePlatform', id: 'p1', patch: { name: 'Cuenta Z' } })
    expect(next.data.platforms.find((platform) => platform.id === 'p1')?.name).toBe('Cuenta Z')
    expect(next.data.positions.find((position) => position.id === 'x1')?.platform).toBe('Cuenta Z')
  })

  it('al eliminar una plataforma borra sus posiciones', () => {
    const next = riskDataReducer(initial(), { type: 'removePlatform', id: 'p1' })
    expect(next.data.platforms).toHaveLength(1)
    expect(next.data.positions).toHaveLength(1)
    expect(next.data.positions[0].platform).toBe('Cuenta B')
  })

  it('reajusta la selección cuando desaparece el activo elegido', () => {
    const next = riskDataReducer(initial(), { type: 'removePosition', id: 'x1' })
    expect(next.selectedAsset).toBe('BBB')
    expect(next.selectedPlatform).toBe('Cuenta B')
  })

  it('seleccionar un activo actualiza el activo clave de la config', () => {
    const next = riskDataReducer(initial(), { type: 'selectAsset', asset: 'bbb' })
    expect(next.selectedAsset).toBe('BBB')
    expect(next.data.config.keyAsset).toBe('BBB')
    expect(next.selectedPlatform).toBe('Cuenta B')
  })

  it('updateConfig con keyAsset ajusta la selección', () => {
    const next = riskDataReducer(initial(), { type: 'updateConfig', patch: { keyAsset: 'BBB' } })
    expect(next.selectedAsset).toBe('BBB')
  })

  it('reset desactiva la persistencia', () => {
    const next = riskDataReducer(initial(), { type: 'reset', data: makeInput() })
    expect(next.persist).toBe(false)
    expect(next.source).toBe('Ejemplo precargado')
  })
})
