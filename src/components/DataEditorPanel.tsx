import { useState, type Dispatch } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Direction, PlatformType, RiskInput } from '@/types/risk'
import type { RiskDataAction } from '@/lib/riskStore'
import { ListInput, NumberInput, TextInput, fieldClass } from '@/components/fields'
import { RadarButton, RadarPanel, SegmentedTabs, TonePill } from '@/components/radar'
import { cn } from '@/lib/utils'

interface DataEditorPanelProps {
  input: RiskInput
  dispatch: Dispatch<RiskDataAction>
}

const typeOptions: { value: PlatformType; label: string }[] = [
  { value: 'sin_apalancamiento', label: 'sin apalancamiento' },
  { value: 'margen', label: 'margen' },
  { value: 'cripto', label: 'cripto' },
]

let counter = 0
function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export default function DataEditorPanel({ input, dispatch }: DataEditorPanelProps) {
  const [tab, setTab] = useState('posiciones')
  const platformNames = input.platforms.map((platform) => platform.name)

  function addPosition() {
    dispatch({
      type: 'addPosition',
      position: {
        id: newId('position'),
        platform: platformNames[0] ?? '',
        asset: '',
        direction: 'Compra',
        quantity: 0,
        currentPrice: 0,
      },
    })
  }

  function addPlatform() {
    dispatch({
      type: 'addPlatform',
      platform: { id: newId('platform'), name: `Plataforma ${input.platforms.length + 1}`, type: 'margen', equity: 0, marginUsed: 0 },
    })
  }

  return (
    <RadarPanel
      title="Editor de datos"
      eyebrow="ajustes en la app"
      actions={<TonePill tone="neutral">{input.positions.length} pos · {input.platforms.length} plat</TonePill>}
    >
      <div className="space-y-4">
        <SegmentedTabs
          ariaLabel="Secciones del editor"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'posiciones', label: 'Posiciones' },
            { value: 'plataformas', label: 'Plataformas' },
            { value: 'config', label: 'Config' },
          ]}
        />

        {tab === 'posiciones' ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-radar-border text-left text-[10px] uppercase tracking-[0.16em] text-radar-muted">
                    <th className="py-2 pr-2 font-medium">plataforma</th>
                    <th className="py-2 pr-2 font-medium">activo</th>
                    <th className="py-2 pr-2 font-medium">dir.</th>
                    <th className="py-2 pr-2 text-right font-medium">cantidad</th>
                    <th className="py-2 pr-2 text-right font-medium">precio actual</th>
                    <th className="py-2 pr-2 text-right font-medium">precio entrada</th>
                    <th className="py-2 pr-2 font-medium">notas</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {input.positions.map((position) => (
                    <tr key={position.id} className="border-b border-radar-border/70 last:border-0">
                      <td className="py-2 pr-2">
                        <select
                          aria-label={`Plataforma de ${position.asset || 'la posición'}`}
                          className={cn(fieldClass, 'cursor-pointer')}
                          value={position.platform}
                          onChange={(event) => dispatch({ type: 'updatePosition', id: position.id, patch: { platform: event.target.value } })}
                        >
                          {!platformNames.includes(position.platform) ? <option value={position.platform}>{position.platform || '—'}</option> : null}
                          {platformNames.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <TextInput
                          ariaLabel="Activo"
                          value={position.asset}
                          placeholder="Ticker"
                          onChange={(value) => dispatch({ type: 'updatePosition', id: position.id, patch: { asset: value.toUpperCase() } })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          aria-label="Dirección"
                          className={cn(fieldClass, 'cursor-pointer')}
                          value={position.direction}
                          onChange={(event) => dispatch({ type: 'updatePosition', id: position.id, patch: { direction: event.target.value as Direction } })}
                        >
                          <option value="Compra">Compra</option>
                          <option value="Venta">Venta</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <NumberInput ariaLabel="Cantidad" value={position.quantity} onChange={(value) => dispatch({ type: 'updatePosition', id: position.id, patch: { quantity: value ?? 0 } })} />
                      </td>
                      <td className="py-2 pr-2">
                        <NumberInput ariaLabel="Precio actual" value={position.currentPrice} onChange={(value) => dispatch({ type: 'updatePosition', id: position.id, patch: { currentPrice: value ?? 0 } })} />
                      </td>
                      <td className="py-2 pr-2">
                        <NumberInput ariaLabel="Precio entrada" value={position.entryPrice ?? null} onChange={(value) => dispatch({ type: 'updatePosition', id: position.id, patch: { entryPrice: value ?? undefined } })} />
                      </td>
                      <td className="py-2 pr-2">
                        <TextInput ariaLabel="Notas" value={position.note ?? ''} onChange={(value) => dispatch({ type: 'updatePosition', id: position.id, patch: { note: value } })} />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label="Eliminar posición"
                          className="cursor-pointer border border-radar-border p-2 text-radar-muted transition-colors hover:border-radar-danger/60 hover:text-radar-danger"
                          onClick={() => dispatch({ type: 'removePosition', id: position.id })}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <RadarButton onClick={addPosition}>
              <Plus className="size-4" aria-hidden="true" /> Añadir posición
            </RadarButton>
          </div>
        ) : null}

        {tab === 'plataformas' ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-radar-border text-left text-[10px] uppercase tracking-[0.16em] text-radar-muted">
                    <th className="py-2 pr-2 font-medium">nombre</th>
                    <th className="py-2 pr-2 font-medium">tipo</th>
                    <th className="py-2 pr-2 text-right font-medium">patrimonio</th>
                    <th className="py-2 pr-2 text-right font-medium">margen usado</th>
                    <th className="py-2 pr-2 text-right font-medium">mant. (%)</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {input.platforms.map((platform) => (
                    <tr key={platform.id} className="border-b border-radar-border/70 last:border-0">
                      <td className="py-2 pr-2">
                        <TextInput ariaLabel="Nombre de la plataforma" value={platform.name} onChange={(value) => dispatch({ type: 'updatePlatform', id: platform.id, patch: { name: value } })} />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          aria-label="Tipo de plataforma"
                          className={cn(fieldClass, 'cursor-pointer')}
                          value={platform.type}
                          onChange={(event) => dispatch({ type: 'updatePlatform', id: platform.id, patch: { type: event.target.value as PlatformType } })}
                        >
                          {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <NumberInput ariaLabel="Patrimonio" value={platform.equity} onChange={(value) => dispatch({ type: 'updatePlatform', id: platform.id, patch: { equity: value ?? 0 } })} />
                      </td>
                      <td className="py-2 pr-2">
                        <NumberInput ariaLabel="Margen usado" value={platform.marginUsed} onChange={(value) => dispatch({ type: 'updatePlatform', id: platform.id, patch: { marginUsed: value ?? 0 } })} />
                      </td>
                      <td className="py-2 pr-2">
                        <NumberInput
                          ariaLabel="Margen de mantenimiento"
                          value={platform.maintenanceMarginPct ?? null}
                          onChange={(value) => dispatch({ type: 'updatePlatform', id: platform.id, patch: { maintenanceMarginPct: value ?? undefined } })}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label="Eliminar plataforma"
                          className="cursor-pointer border border-radar-border p-2 text-radar-muted transition-colors hover:border-radar-danger/60 hover:text-radar-danger"
                          onClick={() => dispatch({ type: 'removePlatform', id: platform.id })}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <RadarButton onClick={addPlatform}>
                <Plus className="size-4" aria-hidden="true" /> Añadir plataforma
              </RadarButton>
              <p className="text-[11px] leading-4 text-radar-muted">Eliminar una plataforma borra también sus posiciones.</p>
            </div>
          </div>
        ) : null}

        {tab === 'config' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">Margen objetivo (%)</span>
              <NumberInput ariaLabel="Margen objetivo" value={input.config.marginTargetPct} onChange={(value) => dispatch({ type: 'updateConfig', patch: { marginTargetPct: Math.max(1, value ?? 0) } })} />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">Apalancamiento objetivo</span>
              <NumberInput ariaLabel="Apalancamiento objetivo" value={input.config.leverageTarget} onChange={(value) => dispatch({ type: 'updateConfig', patch: { leverageTarget: Math.max(0.1, value ?? 0) } })} />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">Margen mantenimiento (%)</span>
              <NumberInput ariaLabel="Margen de mantenimiento" value={input.config.maintenanceMarginPct} onChange={(value) => dispatch({ type: 'updateConfig', patch: { maintenanceMarginPct: Math.min(1000, Math.max(1, value ?? 0)) } })} />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">Niveles de margen</span>
              <ListInput ariaLabel="Niveles de margen" value={input.config.marginLevels} onCommit={(value) => dispatch({ type: 'updateConfig', patch: { marginLevels: value.filter((level) => level > 0) } })} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-radar-muted">Escenarios de estrés (%)</span>
              <ListInput ariaLabel="Escenarios de estrés" value={input.config.scenarios} onCommit={(value) => dispatch({ type: 'updateConfig', patch: { scenarios: value } })} />
            </label>
            <p className="text-[11px] leading-4 text-radar-muted sm:col-span-2">Separa los valores con comas o punto y coma. Los cambios se guardan en este navegador.</p>
          </div>
        ) : null}
      </div>
    </RadarPanel>
  )
}
