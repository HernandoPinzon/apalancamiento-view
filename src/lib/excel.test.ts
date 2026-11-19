import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseRiskWorkbook } from '@/lib/excel'

const platformHeader = ['Plataforma', 'Tipo', 'Patrimonio actual', 'Margen usado']
const positionHeader = ['Plataforma', 'Activo', 'Direccion', 'Cantidad', 'Precio actual', 'Precio entrada']

function makeFile(
  platforms: unknown[][],
  positions: unknown[][],
  config: unknown[][] = [['Clave', 'Valor'], ['Activo clave', 'AAA']],
): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(platforms), 'Plataformas')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(positions), 'Posiciones')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(config), 'Config')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buffer], 'test.xlsx')
}

describe('parseRiskWorkbook', () => {
  it('lee números con separadores españoles en celdas de texto', async () => {
    const file = makeFile(
      [platformHeader, ['Cuenta', 'margen', '1.234,56', '1.000,00']],
      [positionHeader, ['Cuenta', 'AAA', 'Compra', '1.000,00', '10,5', '9,25']],
      [['Clave', 'Valor'], ['Activo clave', 'AAA'], ['Margen mantenimiento (%)', 25]],
    )
    const input = await parseRiskWorkbook(file)

    expect(input.platforms[0]?.equity).toBeCloseTo(1234.56, 6)
    expect(input.platforms[0]?.marginUsed).toBeCloseTo(1000, 6)
    expect(input.positions[0]?.quantity).toBeCloseTo(1000, 6)
    expect(input.positions[0]?.currentPrice).toBeCloseTo(10.5, 6)
    expect(input.positions[0]?.entryPrice).toBeCloseTo(9.25, 6)
    expect(input.config.maintenanceMarginPct).toBe(25)
  })

  it('deja el precio de entrada sin definir cuando la celda está vacía', async () => {
    const file = makeFile(
      [platformHeader, ['Cuenta', 'margen', 100, 0]],
      [positionHeader, ['Cuenta', 'AAA', 'Compra', 2, 10, '']],
    )
    const input = await parseRiskWorkbook(file)
    expect(input.positions[0]?.entryPrice).toBeUndefined()
  })

  it('lee el margen de mantenimiento por plataforma', async () => {
    const file = makeFile(
      [[...platformHeader, 'Margen mantenimiento (%)'], ['Cuenta', 'margen', 100, 100, 35]],
      [positionHeader, ['Cuenta', 'AAA', 'Compra', 1, 10, 9]],
      [['Clave', 'Valor'], ['Activo clave', 'AAA'], ['Margen mantenimiento (%)', 50]],
    )
    const input = await parseRiskWorkbook(file)
    expect(input.platforms[0]?.maintenanceMarginPct).toBe(35)
  })

  it('rechaza plataformas duplicadas', async () => {
    const file = makeFile(
      [platformHeader, ['Cuenta', 'margen', 100, 0], ['cuenta', 'margen', 200, 0]],
      [positionHeader, ['Cuenta', 'AAA', 'Compra', 1, 10, 9]],
    )
    await expect(parseRiskWorkbook(file)).rejects.toThrow(/repetido/)
  })

  it('rechaza posiciones con una plataforma inexistente y sugiere la más parecida', async () => {
    const file = makeFile(
      [platformHeader, ['Cuenta.MT5', 'margen', 100, 0]],
      [positionHeader, ['Cuenta MT5', 'AAA', 'Compra', 1, 10, 9]],
    )
    await expect(parseRiskWorkbook(file)).rejects.toThrow(/no existe.*Cuenta\.MT5/)
  })

  it('informa de la fila real del Excel aunque haya filas en blanco', async () => {
    const file = makeFile(
      [['PLATAFORMAS'], [''], platformHeader, ['Cuenta', 'margen', 100, 0]],
      [['POSICIONES'], [''], positionHeader, ['Cuenta', 'AAA', 'Compra', 1, 10, 9], ['Otra', 'BBB', 'Compra', 1, 10, 9]],
    )
    await expect(parseRiskWorkbook(file)).rejects.toThrow(/Fila 5 de Posiciones/)
  })

  it('carga la plantilla pública con el margen de mantenimiento por defecto', async () => {
    const buffer = readFileSync(new URL('../../public/plantilla-radar-riesgo.xlsx', import.meta.url))
    const file = new File([buffer], 'plantilla-radar-riesgo.xlsx')
    const input = await parseRiskWorkbook(file)

    expect(input.platforms.length).toBeGreaterThan(0)
    expect(input.config.maintenanceMarginPct).toBe(50)
    expect(input.config.marginLevels.length).toBeGreaterThan(0)
  })
})
