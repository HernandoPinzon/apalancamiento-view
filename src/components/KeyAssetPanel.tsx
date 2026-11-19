import { Activity, CircleAlert, Crosshair, Target } from 'lucide-react'
import type { KeyAssetMetrics, PortfolioAnalysis } from '@/types/risk'
import { formatCurrency, formatPct, formatX, maintenancePct, marginTone, uniqueAssets } from '@/lib/risk'
import { MetricBlock, RadarPanel, SegmentedTabs, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

interface KeyAssetPanelProps {
  analysis: PortfolioAnalysis
  selectedAsset: string
  selectedPlatform: string
  onAssetChange: (asset: string) => void
  onPlatformChange: (platform: string) => void
}

function equityAt(metrics: KeyAssetMetrics, price: number): number {
  return metrics.platformEquity + metrics.derivativePerUnit * (price - metrics.currentPrice)
}

function grossAt(metrics: KeyAssetMetrics, price: number): number {
  const otherGross = metrics.platformExposure - metrics.exposure
  return otherGross + metrics.quantityAbs * price
}

function addToX2At(metrics: KeyAssetMetrics, price: number, target: number): number {
  return Math.max(0, grossAt(metrics, price) / target - equityAt(metrics, price))
}

function priceTone(metrics: KeyAssetMetrics, price: number, marginTarget: number, maintenance: number): 'safe' | 'warn' | 'danger' | 'neutral' {
  if (metrics.platformMarginUsed <= 0) return 'neutral'
  const projected = (equityAt(metrics, price) / metrics.platformMarginUsed) * 100
  return marginTone(projected, marginTarget, maintenance)
}

export default function KeyAssetPanel({
  analysis,
  selectedAsset,
  selectedPlatform,
  onAssetChange,
  onPlatformChange,
}: KeyAssetPanelProps) {
  const assets = uniqueAssets(analysis.input)
  const candidates = analysis.keyAssets.filter((item) => item.asset === selectedAsset)
  const metrics = candidates.find((item) => item.platformName === selectedPlatform) ?? candidates[0] ?? null
  const targetLeverage = analysis.input.config.leverageTarget
  const platformConfig = metrics
    ? analysis.input.platforms.find((platform) => platform.name === metrics.platformName)
    : undefined
  const maintenance = platformConfig
    ? maintenancePct(platformConfig, analysis.input.config)
    : analysis.input.config.maintenanceMarginPct
  const covered = metrics != null && Math.abs(metrics.derivativePerUnit) < 1e-9 && metrics.quantityAbs > 0

  return (
    <RadarPanel
      title="Niveles del activo clave"
      eyebrow="precio y margen"
      actions={metrics ? <TonePill tone={marginTone(metrics.currentMarginLevel, analysis.input.config.marginTargetPct, maintenance)}>{metrics.asset} · {metrics.platformName}</TonePill> : undefined}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-radar-muted">activo</p>
            <div className="mt-2">
              <SegmentedTabs
                ariaLabel="Activo clave"
                value={selectedAsset}
                onChange={(value) => onAssetChange(value.toUpperCase())}
                items={assets.map((asset) => ({ value: asset, label: asset }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="platform-select" className="font-mono text-[10px] uppercase tracking-[0.2em] text-radar-muted">plataforma</label>
            <select
              id="platform-select"
              value={metrics?.platformName ?? ''}
              onChange={(event) => onPlatformChange(event.target.value)}
              className="mt-2 min-h-11 w-full cursor-pointer border border-radar-border bg-radar-bg px-3 font-mono text-sm text-radar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-cyan"
            >
              {candidates.map((item) => <option key={`${item.asset}-${item.platformName}`} value={item.platformName}>{item.platformName}</option>)}
            </select>
          </div>

          {metrics ? (
            <div className="space-y-4 border border-radar-border bg-radar-bg p-3">
              <MetricBlock label="Precio actual" value={formatCurrency(metrics.currentPrice)} detail={`Entrada media: ${metrics.entryPrice == null ? 'N/A' : formatCurrency(metrics.entryPrice)}`} />
              <MetricBlock
                label="Cantidad neta"
                value={metrics.quantityNet.toLocaleString('es-ES', { maximumFractionDigits: 6 })}
                detail={`Bruta: ${metrics.quantityAbs.toLocaleString('es-ES', { maximumFractionDigits: 6 })} · Exposición: ${formatCurrency(metrics.exposure)}`}
              />
              <MetricBlock
                label={`Añadir para x${targetLeverage}`}
                value={formatCurrency(metrics.addToTargetLeverage)}
                detail="En esta plataforma, manteniendo toda la exposición"
                tone={metrics.addToTargetLeverage > 0 ? 'warn' : 'safe'}
              />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {metrics ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border border-radar-border bg-radar-bg p-3">
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted"><Crosshair className="size-3.5" aria-hidden="true" /> precio para x{targetLeverage}</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-radar-cyan">
                    {metrics.priceToTargetLeverage == null ? 'Requiere fondos' : formatCurrency(metrics.priceToTargetLeverage)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-radar-muted">
                    {metrics.priceToTargetLeverage == null
                      ? 'No existe un precio único que lleve la cuenta al objetivo con esta fórmula.'
                      : `${metrics.priceToTargetLeverage >= metrics.currentPrice ? 'Subida' : 'Caída'} necesaria del ${formatPct(Math.abs((metrics.priceToTargetLeverage / metrics.currentPrice - 1) * 100))}.`}
                  </p>
                </div>
                <div className="border border-radar-border bg-radar-bg p-3">
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted"><Activity className="size-3.5" aria-hidden="true" /> estado actual</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-radar-text">{formatX(metrics.currentLeverage)}</p>
                  <p className="mt-1 text-xs leading-5 text-radar-muted">
                    Apalancamiento de la plataforma. Margen: {metrics.currentMarginLevel == null ? 'N/A' : formatPct(metrics.currentMarginLevel)}.
                  </p>
                </div>
              </div>

              {metrics.platformMarginUsed <= 0 ? (
                <div className="flex items-start gap-2 border border-radar-warn/40 bg-radar-warn/10 p-3 text-xs leading-5 text-radar-warn">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Esta plataforma no informa margen usado. Se muestran los niveles mecánicos, pero no equivalen a una llamada de margen.
                </div>
              ) : null}

              {covered ? (
                <div className="flex items-start gap-2 border border-radar-warn/40 bg-radar-warn/10 p-3 text-xs leading-5 text-radar-warn">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Hay posiciones largas y cortas del mismo activo: los niveles de precio usan la exposición neta, que es cero o casi cero.
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-radar-border text-left text-[10px] uppercase tracking-[0.16em] text-radar-muted">
                      <th className="py-2 pr-3 font-medium">nivel</th>
                      <th className="py-2 pr-3 text-right font-medium">precio</th>
                      <th className="py-2 pr-3 text-right font-medium">añadir margen objetivo</th>
                      <th className="py-2 text-right font-medium">añadir x{targetLeverage}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.marginLevels.map((level) => {
                      const tone = priceTone(metrics, level.price ?? metrics.currentPrice, analysis.input.config.marginTargetPct, maintenance)
                      return (
                        <tr key={level.levelPct} className={cn('border-b border-radar-border/70 last:border-0', level.levelPct === analysis.input.config.marginTargetPct && 'bg-radar-cyan/5')}>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <Target className={cn('size-3.5', level.levelPct === analysis.input.config.marginTargetPct ? 'text-radar-cyan' : 'text-radar-muted')} aria-hidden="true" />
                              <span className={level.levelPct === analysis.input.config.marginTargetPct ? 'font-semibold text-radar-cyan' : 'text-radar-text'}>{formatPct(level.levelPct, 0)}</span>
                            </div>
                          </td>
                          <td className={cn('py-3 pr-3 text-right tabular-nums', tone === 'danger' ? 'text-radar-danger' : tone === 'warn' ? 'text-radar-warn' : 'text-radar-text')}>
                            {level.price == null || !Number.isFinite(level.price) ? 'N/A' : formatCurrency(level.price)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-radar-text">
                            {level.price == null || !Number.isFinite(level.price) ? 'N/A' : formatCurrency(level.addToMarginTarget)}
                          </td>
                          <td className={cn('py-3 text-right tabular-nums', level.price != null && addToX2At(metrics, level.price, targetLeverage) > 0 ? 'text-radar-warn' : 'text-radar-safe')}>
                            {level.price == null || !Number.isFinite(level.price) ? 'N/A' : formatCurrency(addToX2At(metrics, level.price, targetLeverage))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex min-h-48 items-center justify-center border border-dashed border-radar-border p-6 text-center text-sm text-radar-muted">
              No hay posiciones cargadas para este activo.
            </div>
          )}
        </div>
      </div>
    </RadarPanel>
  )
}
