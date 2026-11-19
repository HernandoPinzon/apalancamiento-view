import * as XLSX from 'xlsx'
import type { Direction, PlatformInput, PlatformType, PositionInput, RiskConfig, RiskInput } from '@/types/risk'
import {
  DEFAULT_LEVERAGE_TARGET,
  DEFAULT_MAINTENANCE_PCT,
  DEFAULT_MARGIN_LEVELS,
  DEFAULT_MARGIN_TARGET_PCT,
  DEFAULT_SCENARIOS,
  normalizeKey,
  parseNumber,
  parseNumberList,
  parseOptionalNumber,
} from '@/lib/risk'

const fallbackConfig: RiskConfig = {
  keyAsset: 'NVDA',
  marginTargetPct: DEFAULT_MARGIN_TARGET_PCT,
  leverageTarget: DEFAULT_LEVERAGE_TARGET,
  maintenanceMarginPct: DEFAULT_MAINTENANCE_PCT,
  marginLevels: [...DEFAULT_MARGIN_LEVELS],
  scenarios: [...DEFAULT_SCENARIOS],
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function asText(value: unknown): string {
  return String(value ?? '').trim()
}

function findSheet(workbook: XLSX.WorkBook, preferred: string): XLSX.WorkSheet | null {
  const exact = workbook.Sheets[preferred]
  if (exact) return exact
  const key = workbook.SheetNames.find((name) => normalize(name) === normalize(preferred))
  return key ? workbook.Sheets[key] : null
}

function sheetRows(sheet: XLSX.WorkSheet): { rows: unknown[][]; firstRow: number } {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  return {
    rows: XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
    }),
    firstRow: range.s.r,
  }
}

function findHeaderRow(rows: unknown[][], required: string[]): { rowIndex: number; headers: string[] } | null {
  const normalizedRequired = required.map(normalize)
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const headers = (rows[index] ?? []).map(normalize)
    if (normalizedRequired.every((header) => headers.includes(header))) {
      return { rowIndex: index, headers }
    }
  }
  return null
}

function columnIndex(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalize)
  return headers.findIndex((header) => normalizedAliases.includes(header))
}

function valueAt(row: unknown[] | undefined, index: number): unknown {
  return index >= 0 && row ? row[index] : ''
}

function makeId(prefix: string, index: number): string {
  return `${prefix}-${index}-${Date.now().toString(36)}`
}

function parsePlatformType(value: unknown): PlatformType {
  const text = normalize(value)
  if (text.includes('cripto') || text.includes('crypto')) return 'cripto'
  if (text.includes('margen') || text.includes('margin') || text.includes('leverage')) return 'margen'
  return 'sin_apalancamiento'
}

function parseDirection(value: unknown, quantity: number): Direction {
  const text = normalize(value)
  if (text.includes('venta') || text.includes('sell') || text.includes('short') || text.includes('corto')) return 'Venta'
  if (text.includes('compra') || text.includes('buy') || text.includes('long') || text.includes('largo')) return 'Compra'
  return quantity < 0 ? 'Venta' : 'Compra'
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

function closestMatch(value: string, candidates: string[]): string | null {
  const target = normalizeKey(value)
  let best: { name: string; distance: number } | null = null
  for (const candidate of candidates) {
    const distance = levenshtein(target, normalizeKey(candidate))
    if (!best || distance < best.distance) best = { name: candidate, distance }
  }
  if (!best) return null
  const threshold = Math.max(2, Math.floor(Math.max(target.length, normalizeKey(best.name).length) * 0.35))
  return best.distance <= threshold ? best.name : null
}

function parsePlatforms(rows: unknown[][], firstRow: number): PlatformInput[] {
  const found = findHeaderRow(rows, ['plataforma', 'tipo', 'patrimonio actual', 'margen usado'])
  if (!found) throw new Error('No encuentro las columnas Plataforma, Tipo, Patrimonio actual y Margen usado en la hoja Plataformas.')
  const { rowIndex, headers } = found
  const idxName = columnIndex(headers, ['plataforma', 'cuenta', 'platform'])
  const idxType = columnIndex(headers, ['tipo', 'type'])
  const idxEquity = columnIndex(headers, ['patrimonio actual', 'patrimonio', 'equity'])
  const idxMargin = columnIndex(headers, ['margen usado', 'margen', 'margin used'])
  const idxMaintenance = columnIndex(headers, [
    'margen mantenimiento (%)',
    'margen mantenimiento',
    'mantenimiento (%)',
    'mantenimiento',
    'maintenance margin (%)',
    'maintenance margin',
    'stop out (%)',
    'stop out',
  ])
  const idxNote = columnIndex(headers, ['notas', 'nota', 'notes'])

  const platforms: PlatformInput[] = []
  const seen = new Map<string, number>()
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    const name = asText(valueAt(row, idxName))
    if (!name) continue
    const key = normalizeKey(name)
    const previous = seen.get(key)
    if (previous != null) {
      throw new Error(`La hoja Plataformas tiene el nombre «${name}» repetido (filas ${previous} y ${firstRow + index + 1}). Los nombres deben ser únicos para asignar las posiciones.`)
    }
    seen.set(key, firstRow + index + 1)

    const maintenance = parseOptionalNumber(valueAt(row, idxMaintenance))
    platforms.push({
      id: makeId('platform', index),
      name,
      type: parsePlatformType(valueAt(row, idxType)),
      equity: parseNumber(valueAt(row, idxEquity)),
      marginUsed: Math.max(0, parseNumber(valueAt(row, idxMargin))),
      maintenanceMarginPct: maintenance != null && maintenance > 0 ? maintenance : undefined,
      note: asText(valueAt(row, idxNote)),
    })
  }
  return platforms
}

function parsePositions(rows: unknown[][], platforms: PlatformInput[], firstRow: number): PositionInput[] {
  const found = findHeaderRow(rows, ['plataforma', 'activo', 'direccion', 'cantidad', 'precio actual'])
  if (!found) throw new Error('No encuentro las columnas Plataforma, Activo, Direccion, Cantidad y Precio actual en la hoja Posiciones.')
  const { rowIndex, headers } = found
  const idxPlatform = columnIndex(headers, ['plataforma', 'cuenta', 'platform'])
  const idxAsset = columnIndex(headers, ['activo', 'ticker', 'asset'])
  const idxDirection = columnIndex(headers, ['direccion', 'lado', 'side', 'direction'])
  const idxQuantity = columnIndex(headers, ['cantidad', 'qty', 'quantity'])
  const idxPrice = columnIndex(headers, ['precio actual', 'precio', 'current price'])
  const idxEntry = columnIndex(headers, ['precio entrada', 'entrada', 'entry price'])
  const idxNote = columnIndex(headers, ['notas', 'nota', 'notes'])

  const platformByKey = new Map(platforms.map((platform) => [normalizeKey(platform.name), platform.name]))
  const platformNames = platforms.map((platform) => platform.name)

  const positions: PositionInput[] = []
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    const platform = asText(valueAt(row, idxPlatform))
    const asset = asText(valueAt(row, idxAsset)).toUpperCase()
    const quantity = parseNumber(valueAt(row, idxQuantity))
    if (!platform || !asset || Math.abs(quantity) <= 0) continue

    const canonicalPlatform = platformByKey.get(normalizeKey(platform))
    if (!canonicalPlatform) {
      const suggestion = closestMatch(platform, platformNames)
      throw new Error(`Fila ${firstRow + index + 1} de Posiciones: la plataforma «${platform}» no existe en la hoja Plataformas.${suggestion ? ` ¿Querías decir «${suggestion}»?` : ''}`)
    }

    positions.push({
      id: makeId('position', index),
      platform: canonicalPlatform,
      asset,
      direction: parseDirection(valueAt(row, idxDirection), quantity),
      quantity,
      currentPrice: parseNumber(valueAt(row, idxPrice)),
      entryPrice: parseOptionalNumber(valueAt(row, idxEntry)) ?? undefined,
      note: asText(valueAt(row, idxNote)),
    })
  }
  return positions
}

function parseConfig(rows: unknown[][]): RiskConfig {
  const found = findHeaderRow(rows, ['clave', 'valor'])
  if (!found) return { ...fallbackConfig }
  const { rowIndex, headers } = found
  const idxKey = columnIndex(headers, ['clave', 'key'])
  const idxValue = columnIndex(headers, ['valor', 'value'])
  const config: RiskConfig = { ...fallbackConfig, marginLevels: [...fallbackConfig.marginLevels], scenarios: [...fallbackConfig.scenarios] }

  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    const key = normalize(valueAt(row, idxKey))
    const value = valueAt(row, idxValue)
    if (!key) continue
    if (key.includes('activo clave') || key.includes('asset')) config.keyAsset = asText(value).toUpperCase() || fallbackConfig.keyAsset
    if (key.includes('mantenimiento') || key.includes('maintenance') || key.includes('stop out')) {
      config.maintenanceMarginPct = parseNumber(value) || fallbackConfig.maintenanceMarginPct
    }
    if (key.includes('nivel margen objetivo')) config.marginTargetPct = parseNumber(value) || fallbackConfig.marginTargetPct
    if (key.includes('apalancamiento objetivo') || key.includes('leverage target')) config.leverageTarget = parseNumber(value) || fallbackConfig.leverageTarget
    if (key.includes('niveles margen')) config.marginLevels = parseNumberList(value, fallbackConfig.marginLevels)
    if (key.includes('escenarios portafolio')) config.scenarios = parseNumberList(value, fallbackConfig.scenarios)
  }

  const marginLevels = config.marginLevels.filter((level) => level > 0)
  const scenarios = config.scenarios.filter((scenario) => Number.isFinite(scenario))

  return {
    ...config,
    marginTargetPct: Math.max(1, config.marginTargetPct),
    leverageTarget: Math.max(0.1, config.leverageTarget),
    maintenanceMarginPct: Math.min(1000, Math.max(1, config.maintenanceMarginPct)),
    marginLevels: marginLevels.length ? marginLevels : [...DEFAULT_MARGIN_LEVELS],
    scenarios: scenarios.length ? scenarios : [...DEFAULT_SCENARIOS],
  }
}

export async function parseRiskWorkbook(file: File): Promise<RiskInput> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  const platformSheet = findSheet(workbook, 'Plataformas')
  const positionSheet = findSheet(workbook, 'Posiciones')
  const configSheet = findSheet(workbook, 'Config')

  if (!platformSheet || !positionSheet || !configSheet) {
    throw new Error('El Excel debe contener las hojas Plataformas, Posiciones y Config. Usa el botón de plantilla si necesitas el formato exacto.')
  }

  const configRows = sheetRows(configSheet)
  const platformRows = sheetRows(platformSheet)
  const positionRows = sheetRows(positionSheet)

  const config = parseConfig(configRows.rows)
  const platforms = parsePlatforms(platformRows.rows, platformRows.firstRow)
  if (!platforms.length) throw new Error('La hoja Plataformas no contiene filas con datos.')

  const positions = parsePositions(positionRows.rows, platforms, positionRows.firstRow)
  if (!positions.length) throw new Error('La hoja Posiciones no contiene posiciones con cantidad distinta de cero.')

  return { platforms, positions, config }
}
