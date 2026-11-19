import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import Home from '@/pages/Home'

// Prueba de humo: la página completa debe renderizar sin errores en tiempo de ejecución.
describe('Home render', () => {
  it('renderiza sin errores y muestra el título', () => {
    const html = renderToString(createElement(Home))
    expect(html).toContain('Radar de Riesgo')
    expect(html).toContain('Resumen ejecutivo')
  })
})
