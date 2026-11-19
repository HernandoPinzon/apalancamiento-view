import type { PlatformMetrics, PortfolioAnalysis, RiskInput, Tone } from '@/types/risk'
import { directionSign, maintenancePct, marginTone } from '@/lib/risk'

const EPS = 1e-9

export interface CurvePoint {
  movePct: number
  exposure: number
  equity: number
  leverage: number
}

// Curva de apalancamiento ante un movimiento uniforme del mercado.
export function leverageCurve(input: RiskInput, from: number, to: number, steps: number): CurvePoint[] {
  const exposure = input.positions.reduce(
    (sum, position) => sum + Math.abs(position.quantity) * position.currentPrice,
    0,
  )
  const signedNotional = input.positions.reduce(
    (sum, position) => sum + directionSign(position.direction) * Math.abs(position.quantity) * position.currentPrice,
    0,
  )
  const equity = input.platforms.reduce((sum, platform) => sum + platform.equity, 0)

  const count = Math.max(2, Math.floor(steps))
  const points: CurvePoint[] = []
  for (let index = 0; index < count; index += 1) {
    const movePct = from + ((to - from) * index) / (count - 1)
    const factor = 1 + movePct / 100
    const newExposure = exposure * factor
    const newEquity = equity + signedNotional * (movePct / 100)
    const leverage = newEquity > EPS ? newExposure / newEquity : Infinity
    points.push({ movePct, exposure: newExposure, equity: newEquity, leverage })
  }
  return points
}

export interface MarginBar {
  name: string
  marginLevel: number | null
  maintenance: number
  tone: Tone
}

export function marginByPlatform(analysis: PortfolioAnalysis): MarginBar[] {
  return analysis.platforms.map((platform: PlatformMetrics) => {
    const maintenance = maintenancePct(platform.platform, analysis.input.config)
    return {
      name: platform.platform.name,
      marginLevel: platform.marginLevel,
      maintenance,
      tone: marginTone(platform.marginLevel, analysis.input.config.marginTargetPct, maintenance),
    }
  })
}
