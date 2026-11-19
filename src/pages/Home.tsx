import { useMemo, useState } from 'react'
import { Database, Radar, Sliders, TriangleAlert } from 'lucide-react'
import AddFundsPanel from '@/components/AddFundsPanel'
import DataEditorPanel from '@/components/DataEditorPanel'
import ExecutiveSummary from '@/components/ExecutiveSummary'
import ExportPanel from '@/components/ExportPanel'
import GlobalCommand from '@/components/GlobalCommand'
import KeyAssetPanel from '@/components/KeyAssetPanel'
import PlatformTable from '@/components/PlatformTable'
import RiskCharts from '@/components/RiskCharts'
import StressPanel from '@/components/StressPanel'
import UploadPanel from '@/components/UploadPanel'
import WhatIfPanel from '@/components/WhatIfPanel'
import { StatusDot } from '@/components/radar'
import { demoData } from '@/data/demoData'
import { useRiskData } from '@/hooks/useRiskData'
import { analyzePortfolio } from '@/lib/risk'
import { applyScenario, EMPTY_SCENARIO, isScenarioActive, type ScenarioState } from '@/lib/scenario'
import type { RiskInput } from '@/types/risk'

export default function Home() {
  const { state, dispatch, clearStoredData } = useRiskData()
  const [scenario, setScenario] = useState<ScenarioState>(EMPTY_SCENARIO)
  const [resetToken, setResetToken] = useState(0)

  const effectiveInput = useMemo(() => applyScenario(state.data, scenario), [state.data, scenario])
  const analysis = useMemo(() => analyzePortfolio(effectiveInput), [effectiveInput])
  const scenarioActive = isScenarioActive(scenario)

  const leverageTone = analysis.global.leverage > analysis.input.config.leverageTarget * 1.8
    ? 'danger'
    : analysis.global.leverage > analysis.input.config.leverageTarget
      ? 'warn'
      : 'safe'

  function handleUploaded(input: RiskInput, source: string) {
    dispatch({ type: 'replace', data: input, source })
    setScenario(EMPTY_SCENARIO)
  }

  function handleReset() {
    clearStoredData()
    setResetToken((token) => token + 1)
    dispatch({ type: 'reset', data: demoData })
    setScenario(EMPTY_SCENARIO)
  }

  function updateScenario(patch: Partial<ScenarioState>) {
    setScenario((current) => ({ ...current, ...patch }))
  }

  return (
    <div className="min-h-screen bg-radar-bg text-radar-text">
      <header className="sticky top-0 z-20 border-b border-radar-border bg-radar-bg/95 backdrop-blur print:hidden">
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
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-radar-muted md:inline">{state.source}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:py-6">
        {state.discarded ? (
          <div className="mb-5 border border-radar-danger/40 bg-radar-danger/10 p-3 text-xs leading-5 text-radar-danger" role="status">
            Se descartó una copia local inválida o incompatible. Se ha restaurado el ejemplo precargado.
          </div>
        ) : null}

        {scenarioActive ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-radar-cyan/40 bg-radar-cyan/10 p-3 text-xs leading-5 text-radar-cyan" role="status">
            <span className="flex items-center gap-2">
              <Sliders className="size-4 shrink-0" aria-hidden="true" />
              Escenario what-if activo: las cifras muestran una simulación, no tus datos guardados.
            </span>
            <button
              type="button"
              className="cursor-pointer border border-radar-cyan/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-radar-cyan/20"
              onClick={() => setScenario(EMPTY_SCENARIO)}
            >
              Quitar escenario
            </button>
          </div>
        ) : null}

        {analysis.warnings.length ? (
          <div className="mb-5 flex items-start gap-3 border border-radar-warn/40 bg-radar-warn/10 p-3 text-xs leading-5 text-radar-warn" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              {analysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
        ) : null}

        <div className="space-y-5">
          <ExecutiveSummary analysis={analysis} />

          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-5 print:hidden">
              <UploadPanel
                sourceName={state.source}
                localLoaded={state.localLoaded}
                resetToken={resetToken}
                onData={handleUploaded}
                onReset={handleReset}
              />
              <GlobalCommand analysis={analysis} />
              <WhatIfPanel
                scenario={scenario}
                onChange={updateScenario}
                onReset={() => setScenario(EMPTY_SCENARIO)}
                selectedAsset={state.selectedAsset}
                platforms={state.data.platforms.map((platform) => platform.name)}
              />
              <ExportPanel analysis={analysis} />
            </aside>

            <section className="min-w-0 space-y-5">
              <KeyAssetPanel
                analysis={analysis}
                selectedAsset={state.selectedAsset}
                selectedPlatform={state.selectedPlatform}
                onAssetChange={(asset) => dispatch({ type: 'selectAsset', asset })}
                onPlatformChange={(platform) => dispatch({ type: 'selectPlatform', platform })}
              />
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
                <StressPanel analysis={analysis} />
                <div className="space-y-5">
                  <PlatformTable analysis={analysis} />
                  <AddFundsPanel analysis={analysis} />
                </div>
              </div>
              <RiskCharts analysis={analysis} />
              <DataEditorPanel input={state.data} dispatch={dispatch} />
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-radar-border px-4 py-4 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-radar-muted">
          <span className="inline-flex items-center gap-2"><Database className="size-3.5" aria-hidden="true" /> Datos procesados en el navegador</span>
          <span>La copia local solo persiste en este dispositivo</span>
        </div>
      </footer>
    </div>
  )
}
