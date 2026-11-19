import type { PortfolioAnalysis } from '@/types/risk'
import { formatCurrency, formatPct, formatX } from '@/lib/risk'
import { buildExecutiveSummary } from '@/lib/summary'

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toLocaleString('es-ES', { useGrouping: false, maximumFractionDigits: digits })
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(';')
}

export function analysisToCsv(analysis: PortfolioAnalysis): string {
  const { global, input } = analysis
  const lines: string[] = []
  const push = (line: string) => lines.push(line)

  push(row(['Radar de Riesgo', 'exportado', new Date().toISOString()]))
  push('')

  push(row(['Global']))
  push(row(['métrica', 'valor']))
  push(row(['apalancamiento', csvNumber(global.leverage)]))
  push(row(['exposición bruta', csvNumber(global.exposure)]))
  push(row(['patrimonio neto', csvNumber(global.equity)]))
  push(row(['margen usado', csvNumber(global.marginUsed)]))
  push(row(['margen global (%)', csvNumber(global.marginLevel)]))
  push(row(['añadir para objetivo', csvNumber(global.addToTargetLeverage)]))
  push('')

  push(row(['Plataformas']))
  push(row(['plataforma', 'tipo', 'exposición', 'apalancamiento', 'margen (%)', 'añadir objetivo', 'mov. general al objetivo (%)']))
  for (const platform of analysis.platforms) {
    push(
      row([
        platform.platform.name,
        platform.platform.type,
        csvNumber(platform.exposure),
        csvNumber(platform.leverage),
        csvNumber(platform.marginLevel),
        csvNumber(platform.addToTargetLeverage),
        csvNumber(platform.broadMoveToMarginTargetPct),
      ]),
    )
  }
  push('')

  push(row(['Estrés']))
  push(row(['movimiento (%)', 'exposición', 'patrimonio', 'apalancamiento', 'margen (%)', 'liquidación']))
  for (const scenario of analysis.stress) {
    push(
      row([
        csvNumber(scenario.scenarioPct),
        csvNumber(scenario.exposure),
        csvNumber(scenario.equity),
        csvNumber(scenario.leverage),
        csvNumber(scenario.marginLevel),
        scenario.liquidated ? scenario.liquidatedPlatforms.join(' | ') || 'patrimonio agotado' : '',
      ]),
    )
  }
  push('')

  push(row(['Activo clave']))
  push(row(['plataforma', 'activo', 'precio actual', 'entrada media', 'cantidad neta', 'exposición', 'precio para objetivo']))
  for (const asset of analysis.keyAssets) {
    push(
      row([
        asset.platformName,
        asset.asset,
        csvNumber(asset.currentPrice, 6),
        csvNumber(asset.entryPrice, 6),
        csvNumber(asset.quantityNet, 6),
        csvNumber(asset.exposure),
        csvNumber(asset.priceToTargetLeverage, 6),
      ]),
    )
  }
  push('')

  push(row(['Configuración']))
  push(row(['clave', 'valor']))
  push(row(['activo clave', input.config.keyAsset]))
  push(row(['margen objetivo (%)', csvNumber(input.config.marginTargetPct)]))
  push(row(['apalancamiento objetivo', csvNumber(input.config.leverageTarget)]))
  push(row(['margen mantenimiento (%)', csvNumber(input.config.maintenanceMarginPct)]))
  push(row(['niveles margen', input.config.marginLevels.join(' | ')]))
  push(row(['escenarios', input.config.scenarios.join(' | ')]))

  // BOM para que Excel interprete UTF-8 y la coma decimal en locale español.
  return `\uFEFF${lines.join('\r\n')}`
}

export function analysisToSummaryText(analysis: PortfolioAnalysis): string {
  const { global, input } = analysis
  const summary = buildExecutiveSummary(analysis)
  const lines: string[] = []

  lines.push('Radar de Riesgo — resumen')
  lines.push(`Apalancamiento global: ${formatX(global.leverage)} (objetivo ${formatX(input.config.leverageTarget)})`)
  lines.push(`Exposición bruta: ${formatCurrency(global.exposure)} · Patrimonio neto: ${formatCurrency(global.equity)}`)
  lines.push(`Margen global: ${global.marginLevel == null ? 'N/A' : formatPct(global.marginLevel)}`)

  if (summary.priority) lines.push(`Prioridad: ${summary.priority.platformName} (${summary.priority.reason})`)
  if (summary.liquidationBufferPct != null && summary.liquidationPlatform) {
    lines.push(`Caída hasta liquidación en ${summary.liquidationPlatform}: ${formatPct(summary.liquidationBufferPct)}`)
  }
  if (summary.biggestAddToTarget) {
    lines.push(`Mayor aportación para el objetivo: ${summary.biggestAddToTarget.platformName} ${formatCurrency(summary.biggestAddToTarget.amount)}`)
  }
  if (summary.concentration) {
    lines.push(
      `Concentración: ${summary.concentration.topAsset} ${formatPct(summary.concentration.topShare * 100)} · top3 ${formatPct(summary.concentration.top3Share * 100)}`,
    )
  }

  return lines.join('\n')
}
