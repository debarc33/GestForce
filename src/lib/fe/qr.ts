/**
 * QR de la representación gráfica (Fase F de claude/plan-accion-facturacion-dian.md).
 *
 * Según el Anexo Técnico de Factura Electrónica de Venta DIAN v1.9 (sección
 * 11.7 "Código Bidimensional QR" / 11.7.1 "URL QRCode"), el código QR no
 * lleva solo la URL de consulta: lleva un bloque de texto con los campos
 * principales de la factura (uno por línea) y, al final, la URL pública de
 * verificación del documento en el catálogo de la DIAN.
 *
 * Formato verificado contra dos fuentes independientes (no hay una copia
 * fácilmente citable en texto plano del PDF oficial de la DIAN):
 *  - https://www.dlpsystems.co/normatividad/el-qr-de-la-factura-electronica/
 *  - https://felcowiki.thefactoryhka.com.co/index.php/Preguntas_Frecuentes_de_Integraci%C3%B3n_con_servicio_Web_(Val._Previa)
 *    (wiki técnica de un proveedor de FE colombiano, que cita el ejemplo
 *    textual del Anexo 1.8 -- mismo formato heredado en la 1.9 -- con las
 *    rutas XPath de cada campo, incluidas las dos URLs de catálogo).
 *
 * "ValTolFac" (no "ValTotFac") es el nombre del campo tal como lo usa el
 * propio Anexo Técnico -- se respeta tal cual, no es un error de tipeo
 * nuestro.
 */
import QRCode from 'qrcode'

const CATALOG_PRODUCCION   = 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey='
const CATALOG_HABILITACION = 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey='

export interface QrFields {
  /** Número de la factura, ej. "FAC-000007" */
  numFac:    string
  /** Fecha de emisión YYYY-MM-DD */
  fecFac:    string
  /** Hora de emisión HH:mm:ss-05:00 */
  horFac:    string
  /** NIT del emisor, solo dígitos */
  nitFac:    string
  /** Documento del adquiriente, solo dígitos (o "222222222222" si es consumidor final) */
  docAdq:    string
  /** Valor base (subtotal sin impuestos) */
  valFac:    number
  /** Valor total IVA */
  valIva:    number
  /** Valor de otros impuestos (ICA + INC) */
  valOtroIm: number
  /** Valor total de la factura */
  valTolFac: number
  /** CUFE ya calculado (Fase C) */
  cufe:      string
  /** true = ambiente de habilitación/pruebas, false = producción */
  testMode:  boolean
}

/** Construye el texto exacto que debe codificar el QR (campos + URL final). */
export function buildQrContent(f: QrFields): string {
  const money = (n: number) => Number(n ?? 0).toFixed(2)
  return [
    `NumFac: ${f.numFac}`,
    `FecFac: ${f.fecFac}`,
    `HorFac: ${f.horFac}`,
    `NitFac: ${f.nitFac}`,
    `DocAdq: ${f.docAdq}`,
    `ValFac: ${money(f.valFac)}`,
    `ValIva: ${money(f.valIva)}`,
    `ValOtroIm: ${money(f.valOtroIm)}`,
    `ValTolFac: ${money(f.valTolFac)}`,
    `CUFE: ${f.cufe}`,
    buildVerificationUrl(f.cufe, f.testMode),
  ].join('\n')
}

/** URL pública de verificación del documento (la misma línea final del QR),
 *  útil para mostrarla también como texto/enlace junto al QR. */
export function buildVerificationUrl(cufe: string, testMode: boolean): string {
  return (testMode ? CATALOG_HABILITACION : CATALOG_PRODUCCION) + cufe
}

export interface QrMatrix {
  size:  number
  cells: boolean[][]
}

/**
 * Calcula la matriz de módulos del QR de forma síncrona. QRCode.create()
 * solo hace el cálculo matemático de codificación (no genera ninguna
 * imagen/canvas) -- por eso se puede llamar directo dentro del render de un
 * componente, tanto en @react-pdf/renderer (servidor) como en el navegador,
 * sin necesidad de async/efectos (importante para que handlePrint() en
 * document-viewer.tsx, que captura el HTML ya renderizado, nunca capture un
 * QR a medio generar).
 */
export function buildQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const { size, data } = qr.modules
  const cells: boolean[][] = []
  for (let row = 0; row < size; row++) {
    const r: boolean[] = []
    for (let col = 0; col < size; col++) r.push(!!data[row * size + col])
    cells.push(r)
  }
  return { size, cells }
}

export interface QrRect { x: number; y: number; w: number; h: number }

/**
 * Convierte la matriz en rectángulos (en unidades de "módulo", 0..size),
 * uniendo cada corrida horizontal de módulos oscuros en un solo rectángulo
 * -- reduce de miles de celdas individuales a unas pocas centenas de
 * rectángulos, más liviano tanto para el PDF como para la impresión HTML.
 */
export function buildQrRects(matrix: QrMatrix): QrRect[] {
  const rects: QrRect[] = []
  for (let row = 0; row < matrix.size; row++) {
    let runStart = -1
    for (let col = 0; col <= matrix.size; col++) {
      const dark = col < matrix.size && matrix.cells[row][col]
      if (dark && runStart === -1) runStart = col
      if (!dark && runStart !== -1) {
        rects.push({ x: runStart, y: row, w: col - runStart, h: 1 })
        runStart = -1
      }
    }
  }
  return rects
}

/**
 * Convierte un timestamp ISO en UTC (como invoices.fe_generated_at) a la
 * hora de Colombia en formato HH:mm:ss-05:00 -- mismo formato que
 * getColombiaTime() de cufe.ts, pero a partir de un instante ya guardado,
 * no de "ahora" (el CUFE se calculó en el momento de fe_generated_at, no en
 * el momento en que se abre o se imprime el documento después).
 */
export function isoToColombiaTime(iso: string): string {
  const d   = new Date(iso)
  const col = new Date(d.getTime() - 5 * 60 * 60 * 1000)
  const hh  = String(col.getUTCHours()).padStart(2, '0')
  const mm  = String(col.getUTCMinutes()).padStart(2, '0')
  const ss  = String(col.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}-05:00`
}
