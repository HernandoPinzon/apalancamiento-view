import type { ReactNode } from 'react'
import { CircleAlert, Crosshair, Gauge, PieChart } from 'lucide-react'
import type { PortfolioAnalysis, Tone } from '@/types/risk'
import { formatCompact, formatCurrency, formatPct, formatX } from '@/lib/risk'
import { buildExecutiveSummary } from '@/lib/summary'
import { RadarPanel, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

const toneText: Record<Tone, string> = {
  safe: 'text-radar-safe',
  warn: 'text-radar-warn',
  danger: 'text-radar-danger',
  neutral: 'text-radar-cyan',
}

const toneLabel: Record<Tone, string> = {
  safe: 'riesgo controlado',
  warn: 'vigilar',
  danger: 'riesgo alto',
  neutral: 'sin datos',
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: ReactNode
  label: string
  value: string
  detail?: string
  tone?: Tone
}) {
  return (
    <div className="border border-radar-border/70 bg-radar-bg p-3">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">
        {icon}
        {label}
      </p>
      <p className={cn('mt-2 break-words font-mono text-lg font-semibold tabular-nums', toneText[tone])}>{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-radar-muted">{detail}</p> : null}
    </div>
  )
}

export default function ExecutiveSummary({ analysis }: { analysis: PortfolioAnalysis }) {
  const summary = buildExecutiveSummary(analysis)
  const { global, input } = analysis

  const headlineParts: string[] = []
  headlineParts.push(summary.priority ? `Prioridad: ${summary.priority.platformName} (${summary.priority.reason}).` : 'Sin plataformas cargadas.')
  if (summary.liquidationBufferPct != null && summary.liquidationPlatform) {
    headlineParts.push(`Una caída del ${formatPct(summary.liquidationBufferPct)} llevaría ${summary.liquidationPlatform} a liquidación.`)
  }

  return (
    <RadarPanel
      title="Resumen ejecutivo"
      eyebrow="lectura rápida"
      actions={<TonePill tone={summary.tone}>{toneLabel[summary.tone]}</TonePill>}
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-radar-text">{headlineParts.join(' ')}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Gauge className="size-3.5" aria-hidden="true" />}
            label="Apalancamiento"
            value={formatX(global.leverage)}
            detail={`Objetivo ${formatX(input.config.leverageTarget)} · exposición ${formatCompact(global.exposure)}`}
            tone={summary.tone}
          />
          <SummaryCard
            icon={<CircleAlert className="size-3.5" aria-hidden="true" />}
            label="Caída hasta liquidación"
            value={summary.liquidationBufferPct == null ? 'N/A' : formatPct(summary.liquidationBufferPct)}
            detail={summary.liquidationPlatform ? `Plataforma más frágil: ${summary.liquidationPlatform}` : 'Ninguna plataforma con margen informado'}
            tone={summary.liquidationBufferPct == null ? 'neutral' : summary.liquidationBufferPct < 10 ? 'danger' : summary.liquidationBufferPct < 25 ? 'warn' : 'safe'}
          />
          <SummaryCard
            icon={<Crosshair className="size-3.5" aria-hidden="true" />}
            label="Concentración"
            value={summary.concentration ? formatPct(summary.concentration.topShare * 100) : 'N/A'}
            detail={summary.concentration ? `${summary.concentration.topAsset} · top3 ${formatPct(summary.concentration.top3Share * 100)}` : 'Sin posiciones'}
            tone={summary.concentration && summary.concentration.topShare > 0.5 ? 'warn' : 'neutral'}
          />
          <SummaryCard
            icon={<PieChart className="size-3.5" aria-hidden="true" />}
            label="Mayor aportación"
            value={summary.biggestAddToTarget ? summary.biggestAddToTarget.platformName : 'N/A'}
            detail={summary.biggestAddToTarget ? `Añadir ${formatCurrency(summary.biggestAddToTarget.amount, 0)} para el objetivo` : 'Ninguna aportación necesaria'}
            tone={summary.biggestAddToTarget ? 'warn' : 'safe'}
          />
        </div>
      </div>
    </RadarPanel>
  )
}
