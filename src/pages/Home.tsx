import { useEffect, useMemo, useState } from 'react'
import { Database, Radar, TriangleAlert } from 'lucide-react'
import AddFundsPanel from '@/components/AddFundsPanel'
import GlobalCommand from '@/components/GlobalCommand'
import KeyAssetPanel from '@/components/KeyAssetPanel'
import PlatformTable from '@/components/PlatformTable'
import StressPanel from '@/components/StressPanel'
import UploadPanel from '@/components/UploadPanel'
import { StatusDot } from '@/components/radar'
import { demoData } from '@/data/demoData'
import { analyzePortfolio, uniqueAssets } from '@/lib/risk'
import type { RiskInput } from '@/types/risk'

const storageKey = 'radar-riesgo-input-v1'

function loadLocalData(): { data: RiskInput; source: string } | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RiskInput
    if (!parsed?.platforms?.length || !parsed?.positions?.length || !parsed?.config) return null
    return { data: parsed, source: 'Copia local del navegador' }
  } catch {
    return null
  }
}

export default function Home() {
  const [initialLocal] = useState(() => loadLocalData())
  const [data, setData] = useState<RiskInput>(() => initialLocal?.data ?? demoData)
  const [sourceName, setSourceName] = useState(() => initialLocal?.source ?? 'Ejemplo precargado')
  const [localLoaded, setLocalLoaded] = useState(() => Boolean(initialLocal))
  const [resetToken, setResetToken] = useState(0)
  const [selectedAsset, setSelectedAsset] = useState(() => (initialLocal?.data ?? demoData).config.keyAsset)
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    const initial = initialLocal?.data ?? demoData
    return initial.positions.find((position) => position.asset.toUpperCase() === initial.config.keyAsset.toUpperCase())?.platform ?? ''
  })

  const analysis = useMemo(() => analyzePortfolio(data), [data])
  const leverageTone = analysis.global.leverage > analysis.input.config.leverageTarget * 1.8
    ? 'danger'
    : analysis.global.leverage > analysis.input.config.leverageTarget
      ? 'warn'
      : 'safe'

  useEffect(() => {
    if (!localLoaded) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data))
    } catch {
      // El almacenamiento local puede estar lleno o bloqueado; la app sigue funcionando con datos en memoria.
    }
  }, [data, localLoaded])

  function handleUploaded(input: RiskInput, source: string) {
    setData(input)
    setSourceName(source)
    setLocalLoaded(true)
    setSelectedAsset(input.config.keyAsset)
    setSelectedPlatform(input.positions.find((position) => position.asset.toUpperCase() === input.config.keyAsset.toUpperCase())?.platform ?? '')
  }

  function handleReset() {
    window.localStorage.removeItem(storageKey)
    setResetToken((token) => token + 1)
    setData(demoData)
    setSourceName('Ejemplo precargado')
    setLocalLoaded(false)
    setSelectedAsset(demoData.config.keyAsset)
    setSelectedPlatform(demoData.positions.find((position) => position.asset.toUpperCase() === demoData.config.keyAsset.toUpperCase())?.platform ?? '')
  }

  function handleAssetChange(asset: string) {
    const normalizedAsset = asset.toUpperCase()
    setSelectedAsset(normalizedAsset)
    setData((current) => ({ ...current, config: { ...current.config, keyAsset: normalizedAsset } }))
    const firstPlatform = data.positions.find((position) => position.asset.toUpperCase() === normalizedAsset)?.platform ?? ''
    setSelectedPlatform(firstPlatform)
  }

  const assets = uniqueAssets(data)

  useEffect(() => {
    if (!assets.includes(selectedAsset) && assets.length) {
      const next = assets[0]
      setSelectedAsset(next)
      setData((current) => ({ ...current, config: { ...current.config, keyAsset: next } }))
    }
  }, [assets, selectedAsset])

  return (
    <div className="min-h-screen bg-radar-bg text-radar-text">
      <header className="sticky top-0 z-20 border-b border-radar-border bg-radar-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Radar className="size-6 shrink-0 text-radar-cyan" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold uppercase tracking-[0.22em] text-radar-text">Radar de Riesgo</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">apalancamiento · margen · niveles</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusDot tone={leverageTone} label={leverageTone === 'danger' ? 'riesgo alto' : leverageTone === 'warn' ? 'sobre objetivo' : 'objetivo controlado'} />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-radar-muted md:inline">{sourceName}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:py-6">
        {analysis.warnings.length ? (
          <div className="mb-5 flex items-start gap-3 border border-radar-warn/40 bg-radar-warn/10 p-3 text-xs leading-5 text-radar-warn" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              {analysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <UploadPanel
              sourceName={sourceName}
              localLoaded={localLoaded}
              resetToken={resetToken}
              onData={handleUploaded}
              onReset={handleReset}
            />
            <GlobalCommand analysis={analysis} />
          </aside>

          <section className="min-w-0 space-y-5">
            <KeyAssetPanel
              analysis={analysis}
              selectedAsset={selectedAsset}
              selectedPlatform={selectedPlatform}
              onAssetChange={handleAssetChange}
              onPlatformChange={setSelectedPlatform}
            />
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
              <StressPanel analysis={analysis} />
              <div className="space-y-5">
                <PlatformTable analysis={analysis} />
                <AddFundsPanel analysis={analysis} />
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-radar-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-radar-muted">
          <span className="inline-flex items-center gap-2"><Database className="size-3.5" aria-hidden="true" /> Datos procesados en el navegador</span>
          <span>La copia local solo persiste en este dispositivo</span>
        </div>
      </footer>
    </div>
  )
}
