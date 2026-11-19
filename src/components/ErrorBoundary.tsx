import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { RadarButton, RadarGhostButton } from '@/components/radar'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en Radar de Riesgo', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleReset = () => {
    try {
      window.localStorage.removeItem('radar-riesgo-input-v2')
      window.localStorage.removeItem('radar-riesgo-input-v1')
    } catch {
      // El almacenamiento local puede estar bloqueado.
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-radar-bg p-6 text-radar-text">
        <div className="w-full max-w-xl border border-radar-danger/50 bg-radar-panel p-6">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-radar-danger">
            <TriangleAlert className="size-4" aria-hidden="true" /> error inesperado
          </p>
          <h1 className="mt-3 font-mono text-lg font-semibold text-radar-text">La aplicación se ha detenido</h1>
          <p className="mt-2 text-sm leading-6 text-radar-muted">
            No se han enviado datos a ningún servidor. Puedes reintentar o borrar la copia local guardada en este navegador para volver al ejemplo precargado.
          </p>
          <p className="mt-3 break-words border border-radar-border bg-radar-bg p-3 font-mono text-xs text-radar-muted">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <RadarButton onClick={this.handleRetry}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reintentar
            </RadarButton>
            <RadarGhostButton onClick={this.handleReset}>Borrar datos locales y recargar</RadarGhostButton>
          </div>
        </div>
      </div>
    )
  }
}
