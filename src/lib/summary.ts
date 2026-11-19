import type { PortfolioAnalysis, Tone } from '@/types/risk'
import { exposureByAsset, formatPct, formatX, leverageTone, maintenancePct, marginTone } from '@/lib/risk'

const EPS = 1e-9

export interface ExecutiveSummary {
  tone: Tone
  priority: { platformName: string; reason: string } | null
  liquidationPlatform: string | null
  liquidationBufferPct: number | null
  biggestAddToTarget: { platformName: string; amount: number } | null
  concentration: { topAsset: string; topShare: number; top3Share: number; hhi: number } | null
}

const severity: Record<Tone, number> = { safe: 0, neutral: 0, warn: 1, danger: 2 }

function worstTone(tones: Tone[]): Tone {
  return tones.reduce<Tone>((worst, tone) => (severity[tone] > severity[worst] ? tone : worst), 'safe')
}

export function buildExecutiveSummary(analysis: PortfolioAnalysis): ExecutiveSummary {
  const config = analysis.input.config

  const platformTones: Tone[] = analysis.platforms.map((platform) =>
    marginTone(platform.marginLevel, config.marginTargetPct, maintenancePct(platform.platform, config)),
  )
  const tone = worstTone([...platformTones, leverageTone(analysis.global.leverage, config.leverageTarget)])

  const leveraged = analysis.platforms.filter((platform) => platform.marginLevel != null)
  const prioritySource = leveraged.length
    ? leveraged.reduce((worst, platform) =>
        (platform.marginLevel as number) < (worst.marginLevel as number) ? platform : worst,
      )
    : analysis.platforms.reduce(
        (worst, platform) => (platform.leverage > worst.leverage ? platform : worst),
        analysis.platforms[0] ?? null,
      )
  const priority = prioritySource
    ? {
        platformName: prioritySource.platform.name,
        reason:
          prioritySource.marginLevel != null
            ? `margen ${formatPct(prioritySource.marginLevel)} · apalancamiento ${formatX(prioritySource.leverage)}`
            : `apalancamiento ${formatX(prioritySource.leverage)}`,
      }
    : null

  const liquidationCandidates = analysis.platforms
    .filter((platform) => platform.platform.marginUsed > EPS && Math.abs(platform.signedNotional) > EPS)
    .map((platform) => {
      const maintenanceEquity = (platform.platform.marginUsed * maintenancePct(platform.platform, config)) / 100
      const move = ((maintenanceEquity - platform.platform.equity) / platform.signedNotional) * 100
      return { platformName: platform.platform.name, move }
    })
  const firstLiquidation = liquidationCandidates.length
    ? liquidationCandidates.reduce((closest, candidate) => (candidate.move > closest.move ? candidate : closest))
    : null

  const biggestAddToTarget = analysis.platforms.reduce<{ platformName: string; amount: number } | null>(
    (worst, platform) =>
      !worst || platform.addToTargetLeverage > worst.amount
        ? { platformName: platform.platform.name, amount: platform.addToTargetLeverage }
        : worst,
    null,
  )

  const exposures = exposureByAsset(analysis.input)
  const concentration = exposures.length
    ? {
        topAsset: exposures[0].asset,
        topShare: exposures[0].share,
        top3Share: exposures.slice(0, 3).reduce((sum, item) => sum + item.share, 0),
        hhi: exposures.reduce((sum, item) => sum + item.share * item.share, 0),
      }
    : null

  return {
    tone,
    priority,
    liquidationPlatform: firstLiquidation ? firstLiquidation.platformName : null,
    liquidationBufferPct: firstLiquidation ? Math.max(0, -firstLiquidation.move) : null,
    biggestAddToTarget: biggestAddToTarget && biggestAddToTarget.amount > 0 ? biggestAddToTarget : null,
    concentration,
  }
}
