import { Landmark } from 'lucide-react'
import type { PortfolioAnalysis } from '@/types/risk'
import { formatCompact, formatCurrency, formatPct, formatX, leverageTone, maintenancePct, marginTone } from '@/lib/risk'
import { RadarPanel, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

const typeLabels: Record<string, string> = {
  sin_apalancamiento: 'sin apalancamiento',
  margen: 'margen',
  cripto: 'cripto',
}

export default function PlatformTable({ analysis }: { analysis: PortfolioAnalysis }) {
  const worst = analysis.platforms.reduce(
    (current, item) => (item.leverage > (current?.leverage ?? -Infinity) ? item : current),
    analysis.platforms[0] ?? null,
  )

  return (
    <RadarPanel
      title="Plataformas"
      eyebrow="riesgo por cuenta"
      actions={worst ? <TonePill tone={leverageTone(worst.leverage, analysis.input.config.leverageTarget)}>mayor: {worst.platform.name}</TonePill> : undefined}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-radar-border text-left text-[10px] uppercase tracking-[0.16em] text-radar-muted">
              <th className="py-2 pr-3 font-medium">plataforma</th>
              <th className="py-2 pr-3 text-right font-medium">exposición</th>
              <th className="py-2 pr-3 text-right font-medium">apalanc.</th>
              <th className="py-2 pr-3 text-right font-medium">margen</th>
              <th className="py-2 pr-3 text-right font-medium">añadir x2</th>
              <th className="py-2 text-right font-medium">mov. general al objetivo</th>
            </tr>
          </thead>
          <tbody>
            {analysis.platforms.map((item) => {
              const tone = leverageTone(item.leverage, analysis.input.config.leverageTarget)
              const maintenance = maintenancePct(item.platform, analysis.input.config)
              const margin = marginTone(item.marginLevel, analysis.input.config.marginTargetPct, maintenance)
              const liquidated = item.marginLevel != null && item.marginLevel < maintenance
              return (
                <tr key={item.platform.id} className="border-b border-radar-border/70 align-top last:border-0 hover:bg-radar-panel2/70">
                  <td className="py-3 pr-3">
                    <div className="flex items-start gap-2">
                      <Landmark className={cn('mt-0.5 size-4 shrink-0', tone === 'danger' ? 'text-radar-danger' : tone === 'warn' ? 'text-radar-warn' : 'text-radar-safe')} aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-radar-text">{item.platform.name}</p>
                        <p className="mt-0.5 text-[11px] text-radar-muted">{typeLabels[item.platform.type]}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-radar-text">{formatCompact(item.exposure)}</td>
                  <td className={cn('py-3 pr-3 text-right tabular-nums font-semibold', tone === 'danger' ? 'text-radar-danger' : tone === 'warn' ? 'text-radar-warn' : 'text-radar-safe')}>
                    {formatX(item.leverage)}
                  </td>
                  <td className={cn('py-3 pr-3 text-right tabular-nums', margin === 'neutral' ? 'text-radar-muted' : margin === 'danger' ? 'text-radar-danger' : margin === 'warn' ? 'text-radar-warn' : 'text-radar-safe')}>
                    {item.marginLevel == null ? 'N/A' : formatPct(item.marginLevel)}
                    {liquidated ? <span className="block text-[10px] uppercase tracking-[0.12em] text-radar-danger">liquidación</span> : null}
                  </td>
                  <td className={cn('py-3 pr-3 text-right tabular-nums', item.addToTargetLeverage > 0 ? 'text-radar-warn' : 'text-radar-safe')}>
                    {formatCurrency(item.addToTargetLeverage)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-radar-text">
                    {item.broadMoveToMarginTargetPct == null
                      ? 'N/A'
                      : formatPct(item.broadMoveToMarginTargetPct)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 border-t border-radar-border pt-3 text-xs leading-5 text-radar-muted">
        <p>“Mov. general al objetivo” supone que todas las posiciones de esa plataforma caen o suben al mismo porcentaje. El nivel de margen solo existe cuando la plataforma informa margen usado.</p>
        <p className="mt-1">La liquidación se marca cuando el nivel de margen cae por debajo del margen de mantenimiento de la plataforma (50 % por defecto).</p>
      </div>
    </RadarPanel>
  )
}
