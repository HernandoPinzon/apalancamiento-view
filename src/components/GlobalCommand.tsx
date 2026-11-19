import { Crosshair, Gauge, ShieldAlert, Wallet } from 'lucide-react'
import type { PortfolioAnalysis } from '@/types/risk'
import { formatCompact, formatCurrency, formatPct, formatX, leverageTone, marginTone } from '@/lib/risk'
import { MetricBlock, RadarPanel, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

export default function GlobalCommand({ analysis }: { analysis: PortfolioAnalysis }) {
  const { global, input } = analysis
  const leverageT = leverageTone(global.leverage, input.config.leverageTarget)
  const marginT = marginTone(global.marginLevel, input.config.marginTargetPct, input.config.maintenanceMarginPct)
  const progress = Number.isFinite(global.leverage) ? Math.min(global.leverage / (input.config.leverageTarget * 3), 1) : 1
  const targetProgress = Math.min(input.config.leverageTarget / (input.config.leverageTarget * 3), 1)

  return (
    <RadarPanel
      title="Consola general"
      eyebrow="apalancamiento agregado"
      actions={<TonePill tone={leverageT}>{leverageT === 'danger' ? 'alto' : leverageT === 'warn' ? 'sobre x2' : 'controlado'}</TonePill>}
    >
      <div className="space-y-5">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-radar-muted">apalancamiento actual</p>
              <p className={cn('mt-1 font-mono text-6xl font-semibold tabular-nums tracking-tight', leverageT === 'danger' ? 'text-radar-danger' : leverageT === 'warn' ? 'text-radar-warn' : 'text-radar-safe')}>
                {formatX(global.leverage)}
              </p>
            </div>
            <div className="hidden text-right font-mono text-xs text-radar-muted sm:block">
              <p>OBJETIVO</p>
              <p className="text-xl font-semibold text-radar-cyan">{formatX(input.config.leverageTarget)}</p>
            </div>
          </div>
          <div className="mt-4 h-2 border border-radar-border bg-radar-bg" aria-label="Progreso de apalancamiento">
            <div
              className={cn('h-full transition-[width] duration-300', leverageT === 'danger' ? 'bg-radar-danger' : leverageT === 'warn' ? 'bg-radar-warn' : 'bg-radar-safe')}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="relative mt-1 h-3 font-mono text-[10px] text-radar-muted">
            <span style={{ left: `${targetProgress * 100}%` }} className="absolute -translate-x-1/2 text-radar-cyan">x{input.config.leverageTarget}</span>
            <span className="absolute right-0">x{input.config.leverageTarget * 3}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricBlock label="Exposición bruta" value={formatCompact(global.exposure)} detail="Suma del valor absoluto de posiciones" />
          <MetricBlock label="Patrimonio neto" value={formatCompact(global.equity)} detail="Suma de patrimonios introducidos" />
          <MetricBlock
            label="Margen global"
            value={global.marginLevel == null ? 'N/A' : formatPct(global.marginLevel)}
            detail={`Informativo; liquidación por debajo del ${formatPct(input.config.maintenanceMarginPct, 0)}`}
            tone={marginT}
          />
          <MetricBlock
            label="Añadir para x2"
            value={formatCurrency(global.addToTargetLeverage)}
            detail="Depósito necesario si no reduces exposición"
            tone={global.addToTargetLeverage > 0 ? 'warn' : 'safe'}
          />
        </div>

        <div className="grid gap-2 border border-radar-border bg-radar-bg p-3 text-xs leading-5 text-radar-muted">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-cyan"><Gauge className="size-3.5" aria-hidden="true" /> lectura rápida</p>
          <p><span className="text-radar-text">{formatX(global.leverage)}</span> equivale a {formatCurrency(global.exposure)} de exposición por cada {formatCurrency(global.equity)} de patrimonio neto.</p>
          <p className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-radar-warn" aria-hidden="true" />El objetivo x2 exige {formatCurrency(Math.max(global.exposure / input.config.leverageTarget, 0))} de patrimonio.</p>
          <p className="flex items-start gap-2"><Wallet className="mt-0.5 size-3.5 shrink-0 text-radar-cyan" aria-hidden="true" />Añadir fondos no reduce la exposición; reduce únicamente el apalancamiento contable.</p>
          <p className="flex items-start gap-2"><Crosshair className="mt-0.5 size-3.5 shrink-0 text-radar-safe" aria-hidden="true" />Las cifras se calculan localmente desde el Excel; no hay envío de datos a un servidor.</p>
        </div>
      </div>
    </RadarPanel>
  )
}
