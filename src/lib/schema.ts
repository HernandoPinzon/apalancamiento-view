import { z } from 'zod'
import type { RiskInput } from '@/types/risk'
import {
  DEFAULT_LEVERAGE_TARGET,
  DEFAULT_MAINTENANCE_PCT,
  DEFAULT_MARGIN_LEVELS,
  DEFAULT_MARGIN_TARGET_PCT,
  DEFAULT_SCENARIOS,
} from '@/lib/risk'

const platformSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['sin_apalancamiento', 'margen', 'cripto']).catch('sin_apalancamiento'),
  equity: z.number(),
  marginUsed: z.number().min(0),
  maintenanceMarginPct: z.number().positive().optional(),
  note: z.string().optional(),
})

const positionSchema = z.object({
  id: z.string().min(1),
  platform: z.string().min(1),
  asset: z.string().min(1),
  direction: z.enum(['Compra', 'Venta']).catch('Compra'),
  quantity: z.number(),
  currentPrice: z.number(),
  entryPrice: z.number().optional().transform((value) => (value === 0 ? undefined : value)),
  note: z.string().optional(),
})

const configSchema = z.object({
  keyAsset: z.string(),
  marginTargetPct: z.number().positive().default(DEFAULT_MARGIN_TARGET_PCT),
  leverageTarget: z.number().positive().default(DEFAULT_LEVERAGE_TARGET),
  maintenanceMarginPct: z.number().positive().default(DEFAULT_MAINTENANCE_PCT).catch(DEFAULT_MAINTENANCE_PCT),
  marginLevels: z.array(z.number().positive()).min(1).default([...DEFAULT_MARGIN_LEVELS]),
  scenarios: z.array(z.number()).min(1).default([...DEFAULT_SCENARIOS]),
})

export const riskInputSchema = z.object({
  platforms: z.array(platformSchema).min(1),
  positions: z.array(positionSchema),
  config: configSchema,
})

export function parseStoredInput(value: unknown): RiskInput | null {
  const result = riskInputSchema.safeParse(value)
  return result.success ? result.data : null
}
