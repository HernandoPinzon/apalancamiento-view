import * as XLSX from 'xlsx'
import type { Direction, PlatformInput, PlatformType, PositionInput, RiskConfig, RiskInput } from '@/types/risk'
import { parseNumber, parseNumberList } from '@/lib/risk'

const fallbackConfig: RiskConfig = {
  keyAsset: 'NVDA',
  marginTargetPct: 200,
  leverageTarget: 2,
  marginLevels: [200, 150, 100, 50],
  scenarios: [0, -2.5, -5, -7.5, -10, -15, -20],
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

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })
}

function findHeaderRow(rows: unknown[][], required: string[]): { rowIndex: number; headers: string[] } | null {
  const normalizedRequired = required.map(normalize)
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const headers = rows[index].map(normalize)
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

function valueAt(row: unknown[], index: number): unknown {
  return index >= 0 ? row[index] : ''
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

function parsePlatforms(rows: unknown[][]): PlatformInput[] {
  const found = findHeaderRow(rows, ['plataforma', 'tipo', 'patrimonio actual', 'margen usado'])
  if (!found) throw new Error('No encuentro las columnas Plataforma, Tipo, Patrimonio actual y Margen usado en la hoja Plataformas.')
  const { rowIndex, headers } = found
  const idxName = columnIndex(headers, ['plataforma', 'cuenta', 'platform'])
  const idxType = columnIndex(headers, ['tipo', 'type'])
  const idxEquity = columnIndex(headers, ['patrimonio actual', 'patrimonio', 'equity'])
  const idxMargin = columnIndex(headers, ['margen usado', 'margen', 'margin used'])
  const idxNote = columnIndex(headers, ['notas', 'nota', 'notes'])

  const platforms: PlatformInput[] = []
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    const name = asText(valueAt(row, idxName))
    if (!name) continue
    platforms.push({
      id: makeId('platform', index),
      name,
      type: parsePlatformType(valueAt(row, idxType)),
      equity: parseNumber(valueAt(row, idxEquity)),
      marginUsed: Math.max(0, parseNumber(valueAt(row, idxMargin))),
      note: asText(valueAt(row, idxNote)),
    })
  }
  return platforms
}

function parsePositions(rows: unknown[][], platformNames: string[]): PositionInput[] {
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

  const positions: PositionInput[] = []
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    const platform = asText(valueAt(row, idxPlatform))
    const asset = asText(valueAt(row, idxAsset)).toUpperCase()
    const quantity = parseNumber(valueAt(row, idxQuantity))
    if (!platform || !asset || Math.abs(quantity) <= 0) continue
    const fallbackPlatform = platformNames.find((name) => normalize(name) === normalize(platform)) ?? platform
    positions.push({
      id: makeId('position', index),
      platform: fallbackPlatform,
      asset,
      direction: parseDirection(valueAt(row, idxDirection), quantity),
      quantity,
      currentPrice: parseNumber(valueAt(row, idxPrice)),
      entryPrice: parseNumber(valueAt(row, idxEntry)),
      note: asText(valueAt(row, idxNote)),
    })
  }
  return positions
}

function parseConfig(rows: unknown[][]): RiskConfig {
  const found = findHeaderRow(rows, ['clave', 'valor'])
  if (!found) return fallbackConfig
  const { rowIndex, headers } = found
  const idxKey = columnIndex(headers, ['clave', 'key'])
  const idxValue = columnIndex(headers, ['valor', 'value'])
  const config = { ...fallbackConfig }

  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    const key = normalize(valueAt(row, idxKey))
    const value = valueAt(row, idxValue)
    if (!key) continue
    if (key.includes('activo clave') || key.includes('asset')) config.keyAsset = asText(value).toUpperCase() || fallbackConfig.keyAsset
    if (key.includes('nivel margen objetivo')) config.marginTargetPct = parseNumber(value) || fallbackConfig.marginTargetPct
    if (key.includes('apalancamiento objetivo') || key.includes('leverage target')) config.leverageTarget = parseNumber(value) || fallbackConfig.leverageTarget
    if (key.includes('niveles margen')) config.marginLevels = parseNumberList(value, fallbackConfig.marginLevels)
    if (key.includes('escenarios portafolio')) config.scenarios = parseNumberList(value, fallbackConfig.scenarios)
  }

  return {
    ...config,
    marginTargetPct: Math.max(1, config.marginTargetPct),
    leverageTarget: Math.max(0.1, config.leverageTarget),
    marginLevels: config.marginLevels.filter((level) => level > 0),
    scenarios: config.scenarios.length ? config.scenarios : fallbackConfig.scenarios,
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

  const platforms = parsePlatforms(sheetRows(platformSheet))
  const platformNames = platforms.map((platform) => platform.name)
  const positions = parsePositions(sheetRows(positionSheet), platformNames)
  const config = parseConfig(sheetRows(configSheet))

  if (!platforms.length) throw new Error('La hoja Plataformas no contiene filas con datos.')
  if (!positions.length) throw new Error('La hoja Posiciones no contiene posiciones con cantidad distinta de cero.')

  return { platforms, positions, config }
}
