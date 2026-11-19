import { describe, expect, it } from 'vitest'
import { demoData } from '@/data/demoData'
import { parseStoredInput } from '@/lib/schema'

describe('parseStoredInput', () => {
  it('migra una copia antigua sin margen de mantenimiento', () => {
    const legacyConfig: Record<string, unknown> = { ...demoData.config }
    delete legacyConfig.maintenanceMarginPct

    const parsed = parseStoredInput({ ...demoData, config: legacyConfig })

    expect(parsed?.config.maintenanceMarginPct).toBe(50)
    expect(parsed?.platforms).toHaveLength(demoData.platforms.length)
  })

  it('rechaza copias corruptas o incompatibles', () => {
    expect(parseStoredInput(null)).toBeNull()
    expect(parseStoredInput({ platforms: [], positions: [], config: {} })).toBeNull()
    expect(parseStoredInput({ platforms: [{ name: '' }], positions: [], config: demoData.config })).toBeNull()
  })
})
