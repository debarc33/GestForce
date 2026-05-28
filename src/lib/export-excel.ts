import * as XLSX from 'xlsx'

export type ExcelColumn<T> = {
  header: string
  key: keyof T | ((row: T) => string | number | boolean | null | undefined)
  width?: number
}

/**
 * Exporta un array de objetos a un archivo .xlsx y lo descarga en el navegador.
 * @param rows      Datos a exportar (ya filtrados)
 * @param columns   Definición de columnas: encabezado + extractor
 * @param filename  Nombre del archivo sin extensión
 */
export function exportToExcel<T extends object>(
  rows: T[],
  columns: ExcelColumn<T>[],
  filename: string
): void {
  // Construir array de objetos planos para SheetJS
  const data = rows.map((row) => {
    const record: Record<string, string | number | boolean | null | undefined> = {}
    for (const col of columns) {
      const val =
        typeof col.key === 'function'
          ? col.key(row)
          : (row[col.key] as string | number | boolean | null | undefined)
      record[col.header] = val ?? ''
    }
    return record
  })

  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) })

  // Ajustar ancho de columnas
  ws['!cols'] = columns.map((col) => ({ wch: col.width ?? 20 }))

  // Estilo del encabezado (negrita) — solo disponible en versiones Pro,
  // pero definimos el objeto por si se upgradea
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C })
    if (!ws[addr]) continue
    ws[addr].s = { font: { bold: true } }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── Helpers de formato ────────────────────────────────────────────────────

export const fmtMoney = (n: number | null | undefined) =>
  n != null ? Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 }) : ''

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO') : ''

export const fmtPercent = (n: number | null | undefined) =>
  n != null ? `${(n * 100).toFixed(0)}%` : ''
