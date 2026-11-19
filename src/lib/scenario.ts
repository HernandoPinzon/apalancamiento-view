import type { PositionInput, RiskInput } from '@/types/risk'
import { directionSign, normalizeKey } from '@/lib/risk'

export interface ScenarioState {
  marketMovePct: number
  assetMoves: Record<string, number>
  fundsAdded: Record<string, number>
  extraPositions: PositionInput[]
}

export const EMPTY_SCENARIO: ScenarioState = {
  marketMovePct: 0,
  assetMoves: {},
  fundsAdded: {},
  extraPositions: [],
}

export function isScenarioActive(scenario: ScenarioState): boolean {
  return (
    scenario.marketMovePct !== 0 ||
    Object.values(scenario.assetMoves).some((move) => move !== 0) ||
    Object.values(scenario.fundsAdded).some((amount) => amount !== 0) ||
    scenario.extraPositions.length > 0
  )
}

function moveFor(asset: string, scenario: ScenarioState): number {
  const key = asset.trim().toUpperCase()
  const override = scenario.assetMoves[key]
  return override != null && override !== 0 ? override : scenario.marketMovePct
}

// Devuelve una copia del portafolio con el escenario aplicado: los precios se mueven y el
// patrimonio recoge el P&L, igual que en el panel de estrés. Si el escenario está vacío
// devuelve la misma referencia para no recalcular sin necesidad.
export function applyScenario(input: RiskInput, scenario: ScenarioState): RiskInput {
  if (!isScenarioActive(scenario)) return input

  const allPositions = scenario.extraPositions.length
    ? [...input.positions, ...scenario.extraPositions]
    : input.positions

  const positions = allPositions.map((position) => {
    const move = moveFor(position.asset, scenario)
    return move === 0 ? position : { ...position, currentPrice: position.currentPrice * (1 + move / 100) }
  })

  const pnlByPlatform = new Map<string, number>()
  for (const position of allPositions) {
    const move = moveFor(position.asset, scenario)
    if (move === 0) continue
    const signedNotional = directionSign(position.direction) * Math.abs(position.quantity) * position.currentPrice
    const key = normalizeKey(position.platform)
    pnlByPlatform.set(key, (pnlByPlatform.get(key) ?? 0) + signedNotional * (move / 100))
  }

  const platforms = input.platforms.map((platform) => {
    const added = scenario.fundsAdded[platform.name] ?? 0
    const pnl = pnlByPlatform.get(normalizeKey(platform.name)) ?? 0
    return added === 0 && pnl === 0 ? platform : { ...platform, equity: platform.equity + added + pnl }
  })

  return { platforms, positions, config: input.config }
}
