import { describe, expect, it } from 'vitest'
import { demoData } from '@/data/demoData'
import { analyzePortfolio } from '@/lib/risk'
import { analysisToCsv, analysisToSummaryText } from '@/lib/report'

const analysis = analyzePortfolio(demoData)

describe('analysisToCsv', () => {
  it('empieza con BOM y usa el separador de punto y coma', () => {
    const csv = analysisToCsv(analysis)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain(';')
    expect(csv).toContain('Plataformas')
    expect(csv).toContain('Estrés')
  })

  it('incluye una fila por plataforma', () => {
    const csv = analysisToCsv(analysis)
    for (const platform of demoData.platforms) {
      expect(csv).toContain(platform.name)
    }
  })
})

describe('analysisToSummaryText', () => {
  it('genera un resumen no vacío', () => {
    const text = analysisToSummaryText(analysis)
    expect(text).toContain('Radar de Riesgo')
    expect(text.length).toBeGreaterThan(40)
  })
})
