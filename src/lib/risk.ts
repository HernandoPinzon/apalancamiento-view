import type {
  AssetLevel,
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

export const DEFAULT_MAINTENANCE_PCT = 50
export const DEFAULT_MARGIN_TARGET_PCT = 200
export const DEFAULT_LEVERAGE_TARGET = 2
export const DEFAULT_MARGIN_LEVELS = [200, 150, 100, 50]
export const DEFAULT_SCENARIOS = [0, -2.5, -5, -7.5, -10, -15, -20]
// Niveles de caída del activo (%) para plataformas que no informan margen usado.
export const DEFAULT_DRAWDOWN_LEVELS = [10, 20, 30, 40, 50]

export const directionSign = (direction: Direction) => (direction === 'Compra' ? 1 : -1)

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let text = value.trim()
  if (!text) return null

  let sign = 1
  if (/^\(.*\)$/.test(text)) {
    const inner = text.slice(1, -1).trim()
    if (!/^[-+]/.test(inner)) sign = -1
    text = inner
  }
  text = text.replace(/([+-])\s+/g, '$1')

  const match = text.match(/[-+]?\d[\d.,\u00A0\u202F'\s]*(?:[eE][-+]?\d+)?/)
  if (!match) return null

  let numeric = match[0].replace(/[\u00A0\u202F'\s]/g, '')
  const lastComma = numeric.lastIndexOf(',')
  const lastDot = numeric.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandSeparator = decimalSeparator === ',' ? '.' : ','
    numeric = numeric.split(thousandSeparator).join('')
    if (decimalSeparator === ',') numeric = numeric.replace(',', '.')
  } else if (lastComma >= 0) {
    // En español la coma es decimal salvo que haya varios grupos de miles.
    if (/^\d{1,3}(?:,\d{3}){2,}$/.test(numeric)) numeric = numeric.split(',').join('')
    else numeric = numeric.replace(/,/g, '.')
  } else if (lastDot >= 0) {
    // 1.234 se interpreta como miles en español; 0.001 y 156.11 como decimales.
    const integerPart = numeric.split('.')[0].replace(/^0+/, '')
    if (integerPart !== '' && /^\d{1,3}(?:\.\d{3})+$/.test(numeric)) numeric = numeric.split('.').join('')
  }

  const parsed = Number(numeric) * sign
  return Number.isFinite(parsed) ? parsed : null
}

export function parseNumber(value: unknown): number {
  return parseOptionalNumber(value) ?? 0
}

export function parseNumberList(value: unknown, fallback: number[]): number[] {
  let items: unknown[]
  if (Array.isArray(value)) {
    items = value
  } else if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return fallback
    // Con punto y coma la coma puede ser decimal ("0;-2,5;-5").
    items = text.split(/[;\n]+/.test(text) ? /[;\n]+/ : /,/)
  } else {
    return fallback
  }

  const parsed = items
    .map((item) => parseOptionalNumber(item))
    .filter((item): item is number => item != null && Number.isFinite(item))
  return parsed.length ? parsed : fallback
}

export function formatCurrency(value: number, digits = 2): string {
  if (Number.isNaN(value)) return 'N/A'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatCompact(value: number): string {
  if (Number.isNaN(value)) return 'N/A'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 100000 ? 1 : 2,
  }).format(value)
}

export function formatX(value: number): string {
  if (Number.isNaN(value)) return 'N/A'
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)}x`
}

export function formatPct(value: number, digits = 2): string {
  if (Number.isNaN(value)) return 'N/A'
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(value)}%`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function leverageTone(leverage: number, target: number): Tone {
  if (Number.isNaN(leverage)) return 'neutral'
  if (leverage === Infinity || leverage > target * 1.8) return 'danger'
  if (leverage > target) return 'warn'
  return 'safe'
}

export function marginTone(level: number | null, target: number, maintenance = DEFAULT_MAINTENANCE_PCT): Tone {
  if (level == null || !Number.isFinite(level)) return 'neutral'
  if (level < 100 || level < maintenance) return 'danger'
  if (level < target) return 'warn'
  return 'safe'
}

export function maintenancePct(platform: PlatformInput, config: RiskConfig): number {
  const value = platform.maintenanceMarginPct ?? config.maintenanceMarginPct
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAINTENANCE_PCT
}

const positionSignedNotional = (position: PositionInput) =>
  directionSign(position.direction) * Math.abs(position.quantity) * position.currentPrice

const positionExposure = (position: PositionInput) =>
  Math.abs(position.quantity) * position.currentPrice

function summarizePlatform(platform: PlatformInput, positions: PositionInput[], config: RiskConfig): PlatformMetrics {
  const platformKey = normalizeKey(platform.name)
  const ownPositions = positions.filter((position) => normalizeKey(position.platform) === platformKey)
  const exposure = ownPositions.reduce((sum, position) => sum + positionExposure(position), 0)
  const signedNotional = ownPositions.reduce((sum, position) => sum + positionSignedNotional(position), 0)
  const leverage = platform.equity > EPS
    ? exposure / platform.equity
    : exposure > EPS
      ? Infinity
      : 0
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
    const platformKey = normalizeKey(platform.name)
    const positions = input.positions.filter(
      (position) =>
        normalizeKey(position.platform) === platformKey &&
        position.asset.trim().toUpperCase() === key,
    )
    if (!positions.length) return []

    const quantityAbs = positions.reduce((sum, position) => sum + Math.abs(position.quantity), 0)
    const quantityNet = positions.reduce(
      (sum, position) => sum + directionSign(position.direction) * Math.abs(position.quantity),
      0,
    )
    const exposure = positions.reduce((sum, position) => sum + positionExposure(position), 0)
    const signedNotional = positions.reduce((sum, position) => sum + positionSignedNotional(position), 0)
    const derivativePerUnit = positions.reduce(
      (sum, position) => sum + directionSign(position.direction) * Math.abs(position.quantity),
      0,
    )
    const currentPrice = exposure > EPS
      ? positions.reduce((sum, position) => sum + positionExposure(position) * position.currentPrice, 0) / exposure
      : 0
    const positionsWithEntry = positions.filter((position) => position.entryPrice != null)
    const entryQuantity = positionsWithEntry.reduce((sum, position) => sum + Math.abs(position.quantity), 0)
    const entryCost = positionsWithEntry.reduce(
      (sum, position) => sum + Math.abs(position.quantity) * (position.entryPrice as number),
      0,
    )
    const entryPrice = entryQuantity > EPS ? entryCost / entryQuantity : null
    const platformExposure = input.positions
      .filter((position) => normalizeKey(position.platform) === platformKey)
      .reduce((sum, position) => sum + positionExposure(position), 0)
    const otherGross = platformExposure - exposure
    const baseEquity = platform.equity
    const marginUsed = platform.marginUsed
    const targetLeverage = Math.max(input.config.leverageTarget, EPS)
    const addToX2AtPrice = (price: number) => {
      const equityAtPrice = baseEquity + derivativePerUnit * (price - currentPrice)
      const grossAtPrice = otherGross + quantityAbs * price
      return Math.max(0, grossAtPrice / targetLeverage - equityAtPrice)
    }

    // Precio al que el patrimonio de la plataforma llega a cero ("pierdo todo").
    const ruinPrice = Math.abs(derivativePerUnit) > EPS
      ? currentPrice - baseEquity / derivativePerUnit
      : null
    const ruinAtZero = ruinPrice == null || ruinPrice <= 0
    const ruinDropPct = ruinPrice != null && ruinPrice > 0 ? (ruinPrice / currentPrice - 1) * 100 : -100

    const levels: AssetLevel[] = []
    if (marginUsed > EPS) {
      for (const levelPct of input.config.marginLevels) {
        const targetEquity = (marginUsed * levelPct) / 100
        const price = Math.abs(derivativePerUnit) > EPS
          ? currentPrice + (targetEquity - baseEquity) / derivativePerUnit
          : null
        if (price == null || !Number.isFinite(price) || price <= 0) continue
        levels.push({
          kind: 'margin',
          marginLevelPct: levelPct,
          dropPct: (price / currentPrice - 1) * 100,
          price,
          addToTargetLeverage: addToX2AtPrice(price),
        })
      }
    } else {
      for (const drop of DEFAULT_DRAWDOWN_LEVELS) {
        if (ruinDropPct > -drop) continue // no mostrar niveles más allá de la ruina
        const price = currentPrice * (1 - drop / 100)
        levels.push({
          kind: 'drop',
          marginLevelPct: null,
          dropPct: -drop,
          price,
          addToTargetLeverage: addToX2AtPrice(price),
        })
      }
    }

    if (Math.abs(derivativePerUnit) > EPS) {
      const price = ruinAtZero ? 0 : (ruinPrice as number)
      levels.push({
        kind: 'ruin',
        marginLevelPct: null,
        dropPct: ruinAtZero ? -100 : ruinDropPct,
        price,
        addToTargetLeverage: addToX2AtPrice(price),
      })
    }

    const constantEquity = baseEquity - derivativePerUnit * currentPrice
    const denominator = derivativePerUnit - quantityAbs / targetLeverage
    const solvedPrice = Math.abs(denominator) > EPS
      ? (otherGross / targetLeverage - constantEquity) / denominator
      : null
    const priceToTargetLeverage = solvedPrice != null && Number.isFinite(solvedPrice) && solvedPrice > 0
      ? solvedPrice
      : null

    const currentMarginLevel = marginUsed > EPS ? (baseEquity / marginUsed) * 100 : null
    const currentLeverage = platform.equity > EPS
      ? platformExposure / platform.equity
      : platformExposure > EPS
        ? Infinity
        : 0

    return [{
      platformName: platform.name,
      asset: key,
      direction: (signedNotional >= 0 ? 'Compra' : 'Venta') as Direction,
      quantityAbs,
      quantityNet,
      currentPrice,
      entryPrice,
      exposure,
      derivativePerUnit,
      platformEquity: platform.equity,
      platformMarginUsed: marginUsed,
      platformExposure,
      levels,
      priceToTargetLeverage,
      addToTargetLeverage: Math.max(0, platformExposure / targetLeverage - platform.equity),
      currentMarginLevel,
      currentLeverage,
    }]
  }).filter(Boolean)
}

function buildStress(platforms: PlatformMetrics[], config: RiskConfig): StressRow[] {
  const exposure = platforms.reduce((sum, platform) => sum + platform.exposure, 0)
  const signedNotional = platforms.reduce((sum, platform) => sum + platform.signedNotional, 0)
  const equity = platforms.reduce((sum, platform) => sum + platform.platform.equity, 0)
  const marginUsed = platforms.reduce((sum, platform) => sum + platform.platform.marginUsed, 0)

  return config.scenarios.map((scenarioPct) => {
    const factor = 1 + scenarioPct / 100
    const newExposure = exposure * factor
    const newEquity = equity + signedNotional * (scenarioPct / 100)
    const leverage = newEquity > EPS
      ? newExposure / newEquity
      : newExposure > EPS
        ? Infinity
        : 0
    const marginLevel = marginUsed > EPS ? (newEquity / marginUsed) * 100 : null
    const addToTargetLeverage = Math.max(0, newExposure / Math.max(config.leverageTarget, EPS) - newEquity)
    const addToTargetMargin = Math.max(0, (marginUsed * config.marginTargetPct) / 100 - newEquity)

    const liquidatedPlatforms = platforms
      .filter((platform) => {
        if (platform.platform.marginUsed <= EPS) return false
        const stressedEquity = platform.platform.equity + platform.signedNotional * (scenarioPct / 100)
        return stressedEquity <= (platform.platform.marginUsed * maintenancePct(platform.platform, config)) / 100
      })
      .map((platform) => platform.platform.name)
    const liquidated = (newEquity <= 0 && (newExposure > EPS || marginUsed > EPS)) || liquidatedPlatforms.length > 0

    let tone: Tone = 'safe'
    if (liquidated || (marginLevel != null && marginLevel < 100)) tone = 'danger'
    else if (marginLevel != null && marginLevel < config.marginTargetPct) tone = 'warn'
    else if (!Number.isFinite(leverage) || leverage > config.leverageTarget) tone = 'warn'

    return {
      scenarioPct,
      exposure: newExposure,
      equity: newEquity,
      leverage,
      marginLevel,
      addToTargetLeverage,
      addToTargetMargin,
      liquidated,
      liquidatedPlatforms,
      tone,
    }
  })
}

function summarizeNames(names: string[], max = 3): string {
  const unique = Array.from(new Set(names))
  const shown = unique.slice(0, max).join(', ')
  return unique.length > max ? `${shown} y ${unique.length - max} más` : shown
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

  const platformKeys = new Set(input.platforms.map((platform) => normalizeKey(platform.name)))
  const unmatched = input.positions.filter((position) => !platformKeys.has(normalizeKey(position.platform)))
  if (unmatched.length) {
    warnings.push(`Hay ${unmatched.length} posiciones con una plataforma que no existe (${summarizeNames(unmatched.map((position) => position.platform))}); no se incluyen en el análisis.`)
  }

  if (platformKeys.size !== input.platforms.length) {
    warnings.push('Hay plataformas con nombres duplicados; revisa la hoja Plataformas para evitar contar la exposición dos veces.')
  }

  const invalidPrices = input.positions.filter((position) => !(position.currentPrice > 0))
  if (invalidPrices.length) {
    warnings.push(`Hay ${invalidPrices.length} posiciones con precio actual cero o inválido (${summarizeNames(invalidPrices.map((position) => position.asset))}); su exposición se calcula como cero.`)
  }

  if (input.platforms.some((platform) => platform.equity <= 0)) {
    warnings.push('Hay plataformas con patrimonio menor o igual a cero; revisa el Excel.')
  }

  const withoutMargin = input.platforms.filter(
    (platform) => platform.type !== 'sin_apalancamiento' && !(platform.marginUsed > 0),
  )
  if (withoutMargin.length) {
    warnings.push(`${summarizeNames(withoutMargin.map((platform) => platform.name))} no informa margen usado; no se puede evaluar una liquidación.`)
  }

  const directionsByPosition = new Map<string, Set<Direction>>()
  for (const position of input.positions) {
    const key = `${normalizeKey(position.platform)}|${position.asset.trim().toUpperCase()}`
    const directions = directionsByPosition.get(key) ?? new Set<Direction>()
    directions.add(position.direction)
    directionsByPosition.set(key, directions)
  }
  const mixed = Array.from(directionsByPosition.entries())
    .filter(([, directions]) => directions.size > 1)
    .map(([key]) => {
      const [platform, asset] = key.split('|')
      return `${asset} en ${platform}`
    })
  if (mixed.length) {
    warnings.push(`Hay posiciones largas y cortas del mismo activo en la misma plataforma (${summarizeNames(mixed)}); los niveles usan la exposición neta.`)
  }

  if (globalMarginLevel != null) warnings.push('El margen global es informativo: las llamadas de margen se aplican cuenta por cuenta.')

  return {
    input,
    global: {
      exposure: globalExposure,
      signedNotional: globalSignedNotional,
      equity: globalEquity,
      marginUsed: globalMarginUsed,
      leverage: globalEquity > EPS
        ? globalExposure / globalEquity
        : globalExposure > EPS
          ? Infinity
          : 0,
      marginLevel: globalMarginLevel,
      addToTargetLeverage: Math.max(0, globalExposure / Math.max(input.config.leverageTarget, EPS) - globalEquity),
      addToTargetMargin: Math.max(0, targetEquity - globalEquity),
      broadMoveToMarginTargetPct,
    },
    platforms,
    keyAssets: buildKeyAssets(input),
    stress: buildStress(platforms, input.config),
    warnings,
  }
}

export function uniqueAssets(input: RiskInput): string[] {
  return Array.from(new Set(input.positions.map((position) => position.asset.trim().toUpperCase()).filter(Boolean))).sort()
}

export interface AssetExposure {
  asset: string
  exposure: number
  share: number
}

export function exposureByAsset(input: RiskInput): AssetExposure[] {
  const totals = new Map<string, number>()
  for (const position of input.positions) {
    const asset = position.asset.trim().toUpperCase()
    if (!asset) continue
    totals.set(asset, (totals.get(asset) ?? 0) + positionExposure(position))
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)
  return Array.from(totals.entries())
    .map(([asset, exposure]) => ({ asset, exposure, share: total > EPS ? exposure / total : 0 }))
    .sort((a, b) => b.exposure - a.exposure)
}
