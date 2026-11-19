import { LineChart } from 'lucide-react'
import type { PortfolioAnalysis } from '@/types/risk'
import { formatCompact, formatCurrency, formatPct, formatX } from '@/lib/risk'
import { RadarPanel, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

export default function StressPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  const { global, input } = analysis
  const targetLeverage = input.config.leverageTarget

  function moveToMarginLevel(levelPct: number) {
    if (global.marginUsed <= 0 || Math.abs(global.signedNotional) < 1e-9) return null
    return ((global.marginUsed * levelPct) / 100 - global.equity) / global.signedNotional * 100
  }

  return (
    <RadarPanel
      title="Estrés del portafolio"
      eyebrow="movimiento simultáneo"
      actions={<TonePill tone={global.addToTargetLeverage > 0 ? 'warn' : 'safe'}>objetivo x{targetLeverage}</TonePill>}
    >
      <div className="space-y-5">
        <div className="border border-radar-border bg-radar-bg p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted"><LineChart className="size-3.5" aria-hidden="true" /> niveles generales de margen</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {input.config.marginLevels.map((level) => {
              const move = moveToMarginLevel(level)
              const tone = level >= input.config.marginTargetPct ? 'safe' : level >= 100 ? 'warn' : 'danger'
              return (
                <div key={level} className="border border-radar-border/70 bg-radar-panel p-3">
                  <p className={cn('font-mono text-lg font-semibold tabular-nums', tone === 'danger' ? 'text-radar-danger' : tone === 'warn' ? 'text-radar-warn' : 'text-radar-safe')}>
                    {move == null ? 'N/A' : formatPct(move)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-radar-muted">margen {formatPct(level, 0)}</p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-radar-muted">Es el movimiento uniforme de toda la cartera que llevaría el margen agregado a cada nivel. Es orientativo porque cada plataforma ejecuta sus propias reglas.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-radar-border text-left text-[10px] uppercase tracking-[0.16em] text-radar-muted">
                <th className="py-2 pr-3 font-medium">movimiento</th>
                <th className="py-2 pr-3 text-right font-medium">exposición</th>
                <th className="py-2 pr-3 text-right font-medium">patrimonio</th>
                <th className="py-2 pr-3 text-right font-medium">apalanc.</th>
                <th className="py-2 pr-3 text-right font-medium">margen</th>
                <th className="py-2 text-right font-medium">añadir x{targetLeverage}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.stress.map((row) => (
                <tr key={row.scenarioPct} className={cn('border-b border-radar-border/70 last:border-0', row.scenarioPct === 0 && 'bg-radar-cyan/5')}>
                  <td className={cn('py-3 pr-3 tabular-nums', row.scenarioPct < 0 ? 'text-radar-warn' : 'text-radar-text')}>{formatPct(row.scenarioPct)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-radar-text">{formatCompact(row.exposure)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-radar-text">{formatCompact(row.equity)}</td>
                  <td className={cn('py-3 pr-3 text-right tabular-nums font-semibold', row.leverage > targetLeverage * 1.8 ? 'text-radar-danger' : row.leverage > targetLeverage ? 'text-radar-warn' : 'text-radar-safe')}>
                    {formatX(row.leverage)}
                  </td>
                  <td className={cn('py-3 pr-3 text-right tabular-nums', row.marginLevel == null ? 'text-radar-muted' : row.marginLevel < 100 ? 'text-radar-danger' : row.marginLevel < input.config.marginTargetPct ? 'text-radar-warn' : 'text-radar-safe')}>
                    {row.marginLevel == null ? 'N/A' : formatPct(row.marginLevel)}
                  </td>
                  <td className={cn('py-3 text-right tabular-nums', row.addToTargetLeverage > 0 ? 'text-radar-warn' : 'text-radar-safe')}>
                    {formatCurrency(row.addToTargetLeverage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RadarPanel>
  )
}
