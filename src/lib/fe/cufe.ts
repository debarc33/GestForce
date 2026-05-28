/**
 * Cálculo del CUFE (Código Único de Factura Electrónica)
 * Según Anexo Técnico DIAN versión 1.9 — SHA-384
 *
 * Fórmula: SHA384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 +
 *          CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + tipAmb)
 */

export interface CUFEParams {
  /** Número de la factura, ej. "FV-0001" */
  numFac:   string
  /** Fecha de emisión YYYY-MM-DD */
  fecFac:   string
  /** Hora de emisión HH:mm:ss-05:00 */
  horFac:   string
  /** Valor base (subtotal sin IVA) */
  valFac:   number
  /** Valor total IVA */
  valImp1:  number
  /** Valor total (con IVA) */
  valTot:   number
  /** NIT del emisor sin guión ni puntos, ej. "900123456" */
  nitOFE:   string
  /** NIT / cédula del adquiriente, o "222222222222" si es consumidor final */
  numAdq:   string
  /** Llave técnica del Proveedor Tecnológico */
  clTec:    string
  /** "1" = Producción, "2" = Habilitación/Pruebas */
  tipAmb:   '1' | '2'
}

/**
 * Calcula el CUFE usando la Web Crypto API (compatible con browsers y Node 18+).
 * Retorna el hash SHA-384 en hexadecimal.
 */
export async function calculateCUFE(params: CUFEParams): Promise<string> {
  const fmt = (n: number) => n.toFixed(2)

  // Cadena de concatenación según spec DIAN
  const raw = [
    params.numFac,
    params.fecFac,
    params.horFac,
    fmt(params.valFac),
    '01',             // CodImp1 = IVA
    fmt(params.valImp1),
    '04',             // CodImp2 = INC (siempre 0 para bienes/servicios generales)
    '0.00',
    '03',             // CodImp3 = ICA (siempre 0 salvo configuración especial)
    '0.00',
    fmt(params.valTot),
    params.nitOFE,
    params.numAdq,
    params.clTec,
    params.tipAmb,
  ].join('')

  const encoder  = new TextEncoder()
  const data     = encoder.encode(raw)
  const hashBuf  = await crypto.subtle.digest('SHA-384', data)
  const hashArr  = Array.from(new Uint8Array(hashBuf))
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Hora actual formateada para Colombia (UTC-5) */
export function getColombiaTime(): string {
  const now = new Date()
  // Colombia no cambia de horario, siempre UTC-5
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const hh  = String(col.getUTCHours()).padStart(2, '0')
  const mm  = String(col.getUTCMinutes()).padStart(2, '0')
  const ss  = String(col.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}-05:00`
}
