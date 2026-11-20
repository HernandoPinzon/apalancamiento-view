export type Direction = 'Compra' | 'Venta'
export type PlatformType = 'sin_apalancamiento' | 'margen' | 'cripto'
export type Tone = 'safe' | 'warn' | 'danger' | 'neutral'

export interface PlatformInput {
  id: string
  name: string
  type: PlatformType
  equity: number
  marginUsed: number
  maintenanceMarginPct?: number
  note?: string
}

export interface PositionInput {
  id: string
  platform: string
  asset: string
  direction: Direction
  quantity: number
  currentPrice: number
  entryPrice?: number
  note?: string
}

export interface RiskConfig {
  keyAsset: string
  marginTargetPct: number
  leverageTarget: number
  maintenanceMarginPct: number
  marginLevels: number[]
  scenarios: number[]
}

export interface RiskInput {
  platforms: PlatformInput[]
  positions: PositionInput[]
  config: RiskConfig
}

export interface PlatformMetrics {
  platform: PlatformInput
  exposure: number
  signedNotional: number
  leverage: number
  marginLevel: number | null
  addToTargetLeverage: number
  addToTargetMargin: number
  broadMoveToMarginTargetPct: number | null
}

export interface GlobalMetrics {
  exposure: number
  signedNotional: number
  equity: number
  marginUsed: number
  leverage: number
  marginLevel: number | null
  addToTargetLeverage: number
  addToTargetMargin: number
  broadMoveToMarginTargetPct: number | null
}

export interface AssetLevel {
  kind: 'margin' | 'drop' | 'ruin'
  marginLevelPct: number | null
  dropPct: number
  price: number
  addToTargetLeverage: number
}

export interface KeyAssetMetrics {
  platformName: string
  asset: string
  direction: Direction
  quantityAbs: number
  quantityNet: number
  currentPrice: number
  entryPrice: number | null
  exposure: number
  derivativePerUnit: number
  platformEquity: number
  platformMarginUsed: number
  platformExposure: number
  levels: AssetLevel[]
  priceToTargetLeverage: number | null
  addToTargetLeverage: number
  currentMarginLevel: number | null
  currentLeverage: number
}

export interface StressRow {
  scenarioPct: number
  exposure: number
  equity: number
  leverage: number
  marginLevel: number | null
  addToTargetLeverage: number
  addToTargetMargin: number
  liquidated: boolean
  liquidatedPlatforms: string[]
  tone: Tone
}

export interface PortfolioAnalysis {
  input: RiskInput
  global: GlobalMetrics
  platforms: PlatformMetrics[]
  keyAssets: KeyAssetMetrics[]
  stress: StressRow[]
  warnings: string[]
}
