import type {
  Direction,
  KeyAssetMetrics,
  PlatformInput,
  PlatformMetrics,
  PositionInput,
  PortfolioAnalysis,
  RiskConfig,
  RiskInput,
  StressRow,
  Tone,
} from '@/types/risk'

const EPS = 1e-9

export const directionSign = (direction: Direction) => (direction === 'Compra' ? 1 : -1)

export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseNumberList(value: unknown, fallback: number[]): number[] {
  if (Array.isArray(value)) {
    const parsed = value.map(parseNumber).filter(Number.isFinite)
    return parsed.length ? parsed : fallback
  }
  if (typeof value !== 'string') return fallback
  const parsed = value
    .split(/[;,]+/)
    .map((item) => parseNumber(item))
    .filter(Number.isFinite)
  return parsed.length ? parsed : fallback
}

export function formatCurrency(value: number, digits = 2): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 100000 ? 1 : 2,
  }).format(value)
}

export function formatX(value: number): string {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)}x`
}

export function formatPct(value: number, digits = 2): string {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(value)}%`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function leverageTone(leverage: number, target: number): Tone {
  if (!Number.isFinite(leverage)) return 'neutral'
  if (leverage > target * 1.8) return 'danger'
  if (leverage > target) return 'warn'
  return 'safe'
}

export function marginTone(level: number | null, target: number): Tone {
  if (level == null || !Number.isFinite(level)) return 'neutral'
  if (level < 100) return 'danger'
  if (level < target) return 'warn'
  return 'safe'
}

const positionSignedNotional = (position: PositionInput) =>
  directionSign(position.direction) * Math.abs(position.quantity) * position.currentPrice

const positionExposure = (position: PositionInput) =>
  Math.abs(position.quantity) * position.currentPrice

function summarizePlatform(platform: PlatformInput, positions: PositionInput[], config: RiskConfig): PlatformMetrics {
  const ownPositions = positions.filter((position) => position.platform.trim().toLowerCase() === platform.name.trim().toLowerCase())
  const exposure = ownPositions.reduce((sum, position) => sum + positionExposure(position), 0)
  const signedNotional = ownPositions.reduce((sum, position) => sum + positionSignedNotional(position), 0)
  const leverage = platform.equity > EPS ? exposure / platform.equity : 0
  const marginLevel = platform.marginUsed > EPS ? (platform.equity / platform.marginUsed) * 100 : null
  const addToTargetLeverage = Math.max(0, exposure / Math.max(config.leverageTarget, EPS) - platform.equity)
  const addToTargetMargin = Math.max(0, (platform.marginUsed * config.marginTargetPct) / 100 - platform.equity)
  const targetEquity = (platform.marginUsed * config.marginTargetPct) / 100
  const broadMoveToMarginTargetPct = marginLevel != null && Math.abs(signedNotional) > EPS
    ? ((targetEquity - platform.equity) / signedNotional) * 100
    : null

  return {
    platform,
    exposure,
    signedNotional,
    leverage,
    marginLevel,
    addToTargetLeverage,
    addToTargetMargin,
    broadMoveToMarginTargetPct,
  }
}

function buildKeyAssets(input: RiskInput): KeyAssetMetrics[] {
  const key = input.config.keyAsset.trim().toUpperCase()
  if (!key) return []

  return input.platforms.flatMap((platform) => {
    const positions = input.positions.filter(
      (position) =>
        position.platform.trim().toLowerCase() === platform.name.trim().toLowerCase() &&
        position.asset.trim().toUpperCase() === key,
    )
    if (!positions.length) return []

    const quantityAbs = positions.reduce((sum, position) => sum + Math.abs(position.quantity), 0)
    const exposure = positions.reduce((sum, position) => sum + positionExposure(position), 0)
    const signedNotional = positions.reduce((sum, position) => sum + positionSignedNotional(position), 0)
    const derivativePerUnit = positions.reduce(
      (sum, position) => sum + directionSign(position.direction) * Math.abs(position.quantity),
      0,
    )
    const currentPrice = exposure > EPS
      ? positions.reduce((sum, position) => sum + positionExposure(position) * position.currentPrice, 0) / exposure
      : 0
    const entryCost = positions.reduce((sum, position) => sum + Math.abs(position.quantity) * (position.entryPrice ?? position.currentPrice), 0)
    const entryPrice = quantityAbs > EPS ? entryCost / quantityAbs : null
    const platformExposure = input.positions
      .filter((position) => position.platform.trim().toLowerCase() === platform.name.trim().toLowerCase())
      .reduce((sum, position) => sum + positionExposure(position), 0)
    const otherGross = platformExposure - exposure
    const baseEquity = platform.equity
    const marginUsed = platform.marginUsed
    const marginLevels = input.config.marginLevels.map((levelPct) => {
      const targetEquity = (marginUsed * levelPct) / 100
      let price: number | null = null
      if (Math.abs(derivativePerUnit) > EPS) {
        price = currentPrice + (targetEquity - baseEquity) / derivativePerUnit
      }
      const equityAtPrice = price == null ? baseEquity : baseEquity + derivativePerUnit * (price - currentPrice)
      return {
        levelPct,
        price,
        addToMarginTarget: Math.max(0, (marginUsed * input.config.marginTargetPct) / 100 - equityAtPrice),
      }
    })

    const targetLeverage = Math.max(input.config.leverageTarget, EPS)
    const constantEquity = baseEquity - derivativePerUnit * currentPrice
    const denominator = derivativePerUnit - quantityAbs / targetLeverage
    const solvedPrice = Math.abs(denominator) > EPS
      ? (otherGross / targetLeverage - constantEquity) / denominator
      : null
    const priceToTargetLeverage = solvedPrice != null && Number.isFinite(solvedPrice) && solvedPrice > 0
      ? solvedPrice
      : null

    const currentMarginLevel = marginUsed > EPS ? (baseEquity / marginUsed) * 100 : null
    const currentLeverage = platform.equity > EPS ? platformExposure / platform.equity : 0

    return [{
      platformName: platform.name,
      asset: key,
      direction: (signedNotional >= 0 ? 'Compra' : 'Venta') as Direction,
      quantityAbs,
      currentPrice,
      entryPrice,
      exposure,
      derivativePerUnit,
      platformEquity: platform.equity,
      platformMarginUsed: marginUsed,
      platformExposure,
      marginLevels,
      priceToTargetLeverage,
      addToTargetLeverage: Math.max(0, platformExposure / targetLeverage - platform.equity),
      currentMarginLevel,
      currentLeverage,
    }]
  }).filter(Boolean)
}

function buildStress(input: RiskInput): StressRow[] {
  const equity = input.platforms.reduce((sum, platform) => sum + platform.equity, 0)
  const marginUsed = input.platforms.reduce((sum, platform) => sum + platform.marginUsed, 0)
  const exposure = input.positions.reduce((sum, position) => sum + positionExposure(position), 0)
  const signedNotional = input.positions.reduce((sum, position) => sum + positionSignedNotional(position), 0)

  return input.config.scenarios.map((scenarioPct) => {
    const factor = 1 + scenarioPct / 100
    const newExposure = exposure * factor
    const newEquity = equity + signedNotional * (scenarioPct / 100)
    const leverage = newEquity > EPS ? newExposure / newEquity : Infinity
    const marginLevel = marginUsed > EPS ? (newEquity / marginUsed) * 100 : null
    const addToTargetLeverage = Math.max(0, newExposure / Math.max(input.config.leverageTarget, EPS) - newEquity)
    const addToTargetMargin = Math.max(0, (marginUsed * input.config.marginTargetPct) / 100 - newEquity)

    let tone: Tone = 'safe'
    if (marginLevel != null && marginLevel < 100) tone = 'danger'
    else if (marginLevel != null && marginLevel < input.config.marginTargetPct) tone = 'warn'
    else if (leverage > input.config.leverageTarget) tone = 'warn'

    return {
      scenarioPct,
      exposure: newExposure,
      equity: newEquity,
      leverage,
      marginLevel,
      addToTargetLeverage,
      addToTargetMargin,
      tone,
    }
  })
}

export function analyzePortfolio(input: RiskInput): PortfolioAnalysis {
  const warnings: string[] = []
  const platforms = input.platforms.map((platform) => summarizePlatform(platform, input.positions, input.config))
  const globalExposure = platforms.reduce((sum, platform) => sum + platform.exposure, 0)
  const globalSignedNotional = platforms.reduce((sum, platform) => sum + platform.signedNotional, 0)
  const globalEquity = input.platforms.reduce((sum, platform) => sum + platform.equity, 0)
  const globalMarginUsed = input.platforms.reduce((sum, platform) => sum + platform.marginUsed, 0)
  const globalMarginLevel = globalMarginUsed > EPS ? (globalEquity / globalMarginUsed) * 100 : null
  const targetEquity = (globalMarginUsed * input.config.marginTargetPct) / 100
  const broadMoveToMarginTargetPct = globalMarginLevel != null && Math.abs(globalSignedNotional) > EPS
    ? ((targetEquity - globalEquity) / globalSignedNotional) * 100
    : null

  if (!input.positions.length) warnings.push('No hay posiciones cargadas; las cifras de exposición serán cero.')
  if (!input.config.keyAsset.trim()) warnings.push('No se ha definido un activo clave en la configuración.')
  if (input.platforms.some((platform) => platform.equity <= 0)) warnings.push('Hay plataformas con patrimonio menor o igual a cero; revisa el Excel.')
  if (globalMarginLevel != null) warnings.push('El margen global es informativo: las llamadas de margen se aplican cuenta por cuenta.')

  return {
    input,
    global: {
      exposure: globalExposure,
      signedNotional: globalSignedNotional,
      equity: globalEquity,
      marginUsed: globalMarginUsed,
      leverage: globalEquity > EPS ? globalExposure / globalEquity : 0,
      marginLevel: globalMarginLevel,
      addToTargetLeverage: Math.max(0, globalExposure / Math.max(input.config.leverageTarget, EPS) - globalEquity),
      addToTargetMargin: Math.max(0, targetEquity - globalEquity),
      broadMoveToMarginTargetPct,
    },
    platforms,
    keyAssets: buildKeyAssets(input),
    stress: buildStress(input),
    warnings,
  }
}

export function uniqueAssets(input: RiskInput): string[] {
  return Array.from(new Set(input.positions.map((position) => position.asset.trim().toUpperCase()).filter(Boolean))).sort()
}
