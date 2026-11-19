import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PortfolioAnalysis, Tone } from '@/types/risk'
import { exposureByAsset, formatCompact, formatPct, formatX } from '@/lib/risk'
import { leverageCurve, marginByPlatform } from '@/lib/charts'
import { RadarPanel, TonePill } from '@/components/radar'

const COLORS = {
  cyan: '#22d3ee',
  safe: '#34d399',
  warn: '#fbbf24',
  danger: '#f87171',
  grid: '#1a2540',
  muted: '#8ea0bd',
  text: '#d7e0f2',
  panel: '#0c1220',
}

const toneColor: Record<Tone, string> = {
  safe: COLORS.safe,
  warn: COLORS.warn,
  danger: COLORS.danger,
  neutral: COLORS.muted,
}

const tooltipStyle = {
  backgroundColor: COLORS.panel,
  border: `1px solid ${COLORS.grid}`,
  borderRadius: 0,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 11,
  color: COLORS.text,
}

function ChartTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">{title}</p>
      <p className="text-[11px] text-radar-muted">{hint}</p>
    </div>
  )
}

export default function RiskCharts({ analysis }: { analysis: PortfolioAnalysis }) {
  const { input, global } = analysis
  const target = input.config.leverageTarget
  const cap = target * 6

  const curve = leverageCurve(input, -40, 40, 41).map((point) => ({
    move: point.movePct,
    leverage: Number.isFinite(point.leverage) ? Math.min(point.leverage, cap) : cap,
  }))

  const margins = marginByPlatform(analysis)
    .filter((bar) => bar.marginLevel != null)
    .map((bar) => ({ name: bar.name, marginLevel: bar.marginLevel as number, tone: bar.tone }))

  const exposures = exposureByAsset(input).slice(0, 12).map((item) => ({ name: item.asset, exposure: item.exposure }))

  return (
    <RadarPanel
      title="Gráficos"
      eyebrow="apalancamiento · margen · exposición"
      actions={<TonePill tone={Number.isFinite(global.leverage) && global.leverage > target ? 'warn' : 'safe'}>objetivo x{target}</TonePill>}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <ChartTitle title="Apalancamiento vs movimiento" hint={`Curva ante un movimiento uniforme del mercado; línea de objetivo x${target}.`} />
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="move" stroke={COLORS.muted} fontSize={10} tickFormatter={(value) => `${value}%`} />
                <YAxis stroke={COLORS.muted} fontSize={10} tickFormatter={(value) => `${value}x`} domain={[0, cap]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatX(value), 'apalancamiento']}
                  labelFormatter={(value) => `movimiento ${value}%`}
                />
                <ReferenceLine y={target} stroke={COLORS.cyan} strokeDasharray="4 4" label={{ value: `x${target}`, fill: COLORS.cyan, fontSize: 10 }} />
                <Line type="monotone" dataKey="leverage" stroke={COLORS.cyan} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <ChartTitle title="Margen por plataforma" hint="Nivel de margen actual; por debajo del mantenimiento hay liquidación." />
          {margins.length ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={margins} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={COLORS.muted} fontSize={10} />
                  <YAxis stroke={COLORS.muted} fontSize={10} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatPct(value), 'margen']} />
                  <ReferenceLine y={input.config.maintenanceMarginPct} stroke={COLORS.danger} strokeDasharray="4 4" />
                  <Bar dataKey="marginLevel">
                    {margins.map((bar) => <Cell key={bar.name} fill={toneColor[bar.tone]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center border border-dashed border-radar-border text-xs text-radar-muted">
              Ninguna plataforma informa margen usado.
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          <ChartTitle title="Exposición por activo" hint="Valor absoluto de cada posición; las 12 mayores." />
          {exposures.length ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposures} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={COLORS.muted} fontSize={10} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis stroke={COLORS.muted} fontSize={10} tickFormatter={(value) => formatCompact(value)} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCompact(value), 'exposición']} />
                  <Bar dataKey="exposure" fill={COLORS.cyan} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center border border-dashed border-radar-border text-xs text-radar-muted">
              No hay posiciones cargadas.
            </div>
          )}
        </div>
      </div>
    </RadarPanel>
  )
}
