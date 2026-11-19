import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCcw, Upload } from 'lucide-react'
import { RadarButton, RadarGhostButton, RadarPanel, StatusDot } from '@/components/radar'
import type { RiskInput } from '@/types/risk'
import { parseRiskWorkbook } from '@/lib/excel'

interface UploadPanelProps {
  sourceName: string
  localLoaded: boolean
  resetToken: number
  onData: (input: RiskInput, source: string) => void
  onReset: () => void
}

export default function UploadPanel({ sourceName, localLoaded, resetToken, onData, onReset }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: 'safe' | 'warn' | 'danger'; text: string } | null>(null)

  useEffect(() => {
    setMessage(null)
  }, [resetToken])

  async function handleFile(file: File | null | undefined) {
    if (!file) return
    setIsLoading(true)
    setMessage(null)
    try {
      const parsed = await parseRiskWorkbook(file)
      onData(parsed, file.name)
      setMessage({ tone: 'safe', text: `Excel cargado: ${file.name}` })
    } catch (error) {
      setMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'No se pudo leer el archivo Excel.',
      })
    } finally {
      setIsLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <RadarPanel
      title="Fuente de datos"
      eyebrow="excel local"
      actions={<StatusDot tone="safe" label="proceso local" />}
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          aria-label="Subir archivo Excel"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <div className="border border-dashed border-radar-border bg-radar-bg p-4">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-1 size-5 shrink-0 text-radar-cyan" aria-hidden="true" />
            <div className="min-w-0">
              <p className="break-words font-mono text-sm font-semibold text-radar-text">{sourceName}</p>
              <p className="mt-1 text-xs leading-5 text-radar-muted">
                {localLoaded
                  ? 'Se recuperó una copia guardada en este navegador.'
                  : 'Sube el Excel para reemplazar los datos actuales.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <RadarButton onClick={() => inputRef.current?.click()} disabled={isLoading}>
            <Upload className="size-4" aria-hidden="true" />
            {isLoading ? 'Leyendo Excel' : 'Subir Excel'}
          </RadarButton>
          <a
            href="./plantilla-radar-riesgo.xlsx"
            download="Plantilla_Radar_Riesgo.xlsx"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-radar-border px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-radar-text transition-colors duration-150 hover:border-radar-cyan/60 hover:text-radar-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-radar-bg"
          >
            <Download className="size-4" aria-hidden="true" />
            Descargar plantilla
          </a>
          <RadarGhostButton onClick={onReset}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Restaurar ejemplo
          </RadarGhostButton>
        </div>

        {message ? (
          <p className={`border px-3 py-2 text-xs leading-5 ${message.tone === 'danger' ? 'border-radar-danger/50 bg-radar-danger/10 text-radar-danger' : 'border-radar-safe/50 bg-radar-safe/10 text-radar-safe'}`} role="status">
            {message.text}
          </p>
        ) : null}

        <div className="border-t border-radar-border pt-3 text-xs leading-5 text-radar-muted">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-radar-muted">hojas esperadas</p>
          <p className="mt-1">Plataformas · Posiciones · Config</p>
          <p className="mt-2">Las posiciones largas usan cantidad positiva y Direccion “Compra”; cortos usan “Venta”.</p>
        </div>
      </div>
    </RadarPanel>
  )
}
