import { useState } from 'react'
import { ClipboardCopy, Download, Printer } from 'lucide-react'
import type { PortfolioAnalysis } from '@/types/risk'
import { analysisToCsv, analysisToSummaryText } from '@/lib/report'
import { RadarButton, RadarGhostButton, RadarPanel, TonePill } from '@/components/radar'

export default function ExportPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  const [message, setMessage] = useState<{ tone: 'safe' | 'danger'; text: string } | null>(null)

  async function handleCopy() {
    const text = analysisToSummaryText(analysis)
    try {
      await navigator.clipboard.writeText(text)
      setMessage({ tone: 'safe', text: 'Resumen copiado al portapapeles.' })
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      setMessage(ok ? { tone: 'safe', text: 'Resumen copiado al portapapeles.' } : { tone: 'danger', text: 'No se pudo copiar; usa Imprimir / PDF.' })
    }
  }

  function handleCsv() {
    const blob = new Blob([analysisToCsv(analysis)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'radar-de-riesgo.csv'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setMessage({ tone: 'safe', text: 'CSV descargado.' })
  }

  return (
    <RadarPanel
      title="Exportar"
      eyebrow="informe local"
      actions={<TonePill tone="neutral">sin servidor</TonePill>}
    >
      <div className="space-y-3">
        <div className="grid gap-2">
          <RadarButton onClick={() => void handleCopy()}>
            <ClipboardCopy className="size-4" aria-hidden="true" /> Copiar resumen
          </RadarButton>
          <RadarGhostButton onClick={handleCsv}>
            <Download className="size-4" aria-hidden="true" /> Descargar CSV
          </RadarGhostButton>
          <RadarGhostButton onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Imprimir / PDF
          </RadarGhostButton>
        </div>

        {message ? (
          <p className={`border px-3 py-2 text-xs leading-5 ${message.tone === 'danger' ? 'border-radar-danger/50 bg-radar-danger/10 text-radar-danger' : 'border-radar-safe/50 bg-radar-safe/10 text-radar-safe'}`} role="status">
            {message.text}
          </p>
        ) : null}

        <p className="border-t border-radar-border pt-3 text-[11px] leading-4 text-radar-muted">
          El CSV usa separador «;» y coma decimal, listo para Excel en español. «Imprimir / PDF» abre el diálogo del navegador.
        </p>
      </div>
    </RadarPanel>
  )
}
