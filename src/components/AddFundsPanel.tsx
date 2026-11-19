import { PiggyBank } from 'lucide-react'
import type { PortfolioAnalysis } from '@/types/risk'
import { formatCurrency, formatX } from '@/lib/risk'
import { MetricBlock, RadarPanel, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

export default function AddFundsPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  const { global, input } = analysis
  const target = input.config.leverageTarget
  const totalNeeded = global.addToTargetLeverage

  return (
    <RadarPanel
      title="Plan de aportación x2"
      eyebrow="cuánto añadir"
      actions={<TonePill tone={totalNeeded > 0 ? 'warn' : 'safe'}>{totalNeeded > 0 ? 'requiere fondos' : 'objetivo cumplido'}</TonePill>}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricBlock
            label="Total a añadir ahora"
            value={formatCurrency(totalNeeded)}
            detail={`Para que toda la exposición quede en ${formatX(target)}`}
            tone={totalNeeded > 0 ? 'warn' : 'safe'}
          />
          <MetricBlock
            label="Exposición permitida"
            value={formatCurrency(global.equity * target)}
            detail={`Con el patrimonio actual y objetivo ${formatX(target)}`}
            tone="neutral"
          />
        </div>

        <div className="border border-radar-border bg-radar-bg p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted"><PiggyBank className="size-3.5 text-radar-cyan" aria-hidden="true" /> reparto por plataforma</p>
          <div className="mt-3 space-y-2">
            {analysis.platforms.map((item) => {
              const percent = totalNeeded > 0 ? item.addToTargetLeverage / totalNeeded : 0
              return (
                <div key={item.platform.id} className="border border-radar-border/70 bg-radar-panel p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs font-semibold text-radar-text">{item.platform.name}</p>
                    <p className={cn('font-mono text-sm font-semibold tabular-nums', item.addToTargetLeverage > 0 ? 'text-radar-warn' : 'text-radar-safe')}>
                      {formatCurrency(item.addToTargetLeverage)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 border border-radar-border bg-radar-bg" aria-label={`Aportación de ${item.platform.name}`}>
                    <div className={cn('h-full', item.addToTargetLeverage > 0 ? 'bg-radar-warn' : 'bg-radar-safe')} style={{ width: `${Math.min(percent * 100, 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-radar-muted">
                    {item.addToTargetLeverage > 0
                      ? `${formatX(item.leverage)} actual · ${formatX(item.exposure / Math.max(item.platform.equity + item.addToTargetLeverage, 0.01))} después de añadir.`
                      : `Ya está por debajo del objetivo ${formatX(target)}.`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-radar-border pt-3 text-xs leading-5 text-radar-muted">
          <p className="text-radar-text">Las aportaciones no son transferibles entre plataformas.</p>
          <p className="mt-1">Si añades menos del total, primero conviene proteger la plataforma con mayor apalancamiento o menor margen.</p>
        </div>
      </div>
    </RadarPanel>
  )
}
