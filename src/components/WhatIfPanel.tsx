import { Plus, RotateCcw, Sliders, Trash2 } from 'lucide-react'
import type { Direction, PositionInput } from '@/types/risk'
import { isScenarioActive, type ScenarioState } from '@/lib/scenario'
import { Slider } from '@/components/ui/slider'
import { NumberInput, TextInput, fieldClass } from '@/components/fields'
import { RadarButton, RadarGhostButton, RadarPanel, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

interface WhatIfPanelProps {
  scenario: ScenarioState
  onChange: (patch: Partial<ScenarioState>) => void
  onReset: () => void
  selectedAsset: string
  platforms: string[]
}

let counter = 0
function newId(): string {
  counter += 1
  return `hyp-${Date.now().toString(36)}-${counter}`
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '%',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">{label}</span>
        <span className={cn('font-mono text-sm font-semibold tabular-nums', value === 0 ? 'text-radar-muted' : value < 0 ? 'text-radar-danger' : 'text-radar-safe')}>
          {value > 0 ? '+' : ''}{value}{suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(values) => onChange(values[0] ?? 0)} />
    </div>
  )
}

export default function WhatIfPanel({ scenario, onChange, onReset, selectedAsset, platforms }: WhatIfPanelProps) {
  const active = isScenarioActive(scenario)
  const assetMove = scenario.assetMoves[selectedAsset] ?? 0

  function updateExtra(id: string, patch: Partial<PositionInput>) {
    onChange({
      extraPositions: scenario.extraPositions.map((position) =>
        position.id === id ? { ...position, ...patch } : position,
      ),
    })
  }

  function addExtra() {
    onChange({
      extraPositions: [
        ...scenario.extraPositions,
        { id: newId(), platform: platforms[0] ?? '', asset: selectedAsset, direction: 'Compra', quantity: 0, currentPrice: 0 },
      ],
    })
  }

  function removeExtra(id: string) {
    onChange({ extraPositions: scenario.extraPositions.filter((position) => position.id !== id) })
  }

  return (
    <RadarPanel
      title="Simulador what-if"
      eyebrow="escenario efímero"
      actions={<TonePill tone={active ? 'warn' : 'neutral'}>{active ? 'activo' : 'sin cambios'}</TonePill>}
    >
      <div className="space-y-5">
        <SliderRow
          label="Movimiento de mercado"
          value={scenario.marketMovePct}
          min={-40}
          max={40}
          onChange={(value) => onChange({ marketMovePct: value })}
        />

        {selectedAsset ? (
          <SliderRow
            label={`Movimiento de ${selectedAsset}`}
            value={assetMove}
            min={-60}
            max={60}
            onChange={(value) =>
              onChange({ assetMoves: { ...scenario.assetMoves, [selectedAsset]: value } })
            }
          />
        ) : null}

        <div className="space-y-2 border-t border-radar-border pt-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">
            <Sliders className="size-3.5" aria-hidden="true" /> fondos a añadir
          </p>
          {platforms.map((name) => (
            <label key={name} className="flex items-center justify-between gap-3">
              <span className="truncate text-xs text-radar-text">{name}</span>
              <NumberInput
                ariaLabel={`Fondos a añadir en ${name}`}
                className="max-w-28"
                value={scenario.fundsAdded[name] ?? null}
                onChange={(value) => onChange({ fundsAdded: { ...scenario.fundsAdded, [name]: value ?? 0 } })}
              />
            </label>
          ))}
        </div>

        <div className="space-y-2 border-t border-radar-border pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">posiciones hipotéticas</p>
          {scenario.extraPositions.map((position) => (
            <div key={position.id} className="space-y-2 border border-radar-border/70 bg-radar-bg p-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Plataforma de la posición hipotética"
                  className={cn(fieldClass, 'cursor-pointer')}
                  value={position.platform}
                  onChange={(event) => updateExtra(position.id, { platform: event.target.value })}
                >
                  {!platforms.includes(position.platform) ? <option value={position.platform}>{position.platform || '—'}</option> : null}
                  {platforms.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <TextInput ariaLabel="Activo hipotético" value={position.asset} placeholder="Ticker" onChange={(value) => updateExtra(position.id, { asset: value.toUpperCase() })} />
                <select
                  aria-label="Dirección hipotética"
                  className={cn(fieldClass, 'cursor-pointer')}
                  value={position.direction}
                  onChange={(event) => updateExtra(position.id, { direction: event.target.value as Direction })}
                >
                  <option value="Compra">Compra</option>
                  <option value="Venta">Venta</option>
                </select>
                <NumberInput ariaLabel="Cantidad hipotética" value={position.quantity} onChange={(value) => updateExtra(position.id, { quantity: value ?? 0 })} />
                <NumberInput ariaLabel="Precio hipotético" value={position.currentPrice} onChange={(value) => updateExtra(position.id, { currentPrice: value ?? 0 })} />
                <button
                  type="button"
                  aria-label="Eliminar posición hipotética"
                  className="cursor-pointer border border-radar-border px-2 text-radar-muted transition-colors hover:border-radar-danger/60 hover:text-radar-danger"
                  onClick={() => removeExtra(position.id)}
                >
                  <Trash2 className="mx-auto size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
          <RadarButton onClick={addExtra}>
            <Plus className="size-4" aria-hidden="true" /> Añadir hipotética
          </RadarButton>
        </div>

        <RadarGhostButton onClick={onReset} disabled={!active} className="w-full">
          <RotateCcw className="size-4" aria-hidden="true" /> Limpiar escenario
        </RadarGhostButton>
      </div>
    </RadarPanel>
  )
}
