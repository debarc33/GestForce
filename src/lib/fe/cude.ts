/**
 * Cálculo del CUDE (Código Único de Documento Electrónico) para Notas
 * Crédito y Notas Débito.
 *
 * Fase G de claude/plan-accion-facturacion-dian.md.
 *
 * Fuente: Anexo Técnico de Factura Electrónica de Venta DIAN v1.9
 * (Resolución 000165 del 01/nov/2023), Suplemento B, Sección 11.4
 * "Generación de CUDE":
 *   - 11.4.3 / 11.4.4 → Notas Crédito (campos NumCr, FecCr, HorCr, ValCr...)
 *   - 11.4.5 / 11.4.6 → Notas Débito  (campos NumDb, FecDb, HorDb, ValDb...)
 *
 * La fórmula es estructuralmente idéntica a la del CUFE (mismo orden de
 * concatenación, mismo SHA-384), con UNA diferencia crítica y no obvia: en
 * vez de la Clave Técnica (`company.fe_technical_key`, el secreto que usa
 * `calculateCUFE` en cufe.ts) usa el **Software-PIN**
 * (`company.fe_software_pin`). Por eso esto vive en un archivo aparte en
 * vez de reusar `calculateCUFE` con otro parámetro: son dos fórmulas DIAN
 * distintas que solo lucen parecidas.
 *
 * Fórmula (idéntica para Nota Crédito y Nota Débito, solo cambia el nombre
 * de los campos en el Anexo, no el orden ni el contenido):
 *   SHA384(Num + Fec + Hor + Val + CodImp1 + ValImp1 + CodImp2 + ValImp2 +
 *          CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + SoftwarePIN + TipoAmbiente)
 */

export interface CUDEParams {
  /** Número de la nota, ej. "NC-000001" o "ND-000001" */
  num:      string
  /** Fecha de emisión YYYY-MM-DD */
  fec:      string
  /** Hora de emisión HH:mm:ss-05:00 */
  hor:      string
  /** Valor base (subtotal sin IVA) */
  val:      number
  /** Valor total IVA */
  valImp1:  number
  /** Valor total de la nota (con IVA) -- se recibe explícito (no se
   *  recalcula aquí) para que coincida exactamente con el total ya
   *  guardado en credit_debit_notes.total, igual que hace calculateCUFE
   *  con valTot. */
  valTot:   number
  /** NIT del emisor sin guión ni puntos, ej. "900123456" */
  nitOFE:   string
  /** NIT / cédula del adquiriente, o "222222222222" si es consumidor final */
  numAdq:   string
  /** Software-PIN del Proveedor Tecnológico (company.fe_software_pin) --
   *  NO es la Clave Técnica. Ver nota de archivo arriba. */
  softwarePin: string
  /** "1" = Producción, "2" = Habilitación/Pruebas */
  tipAmb:   '1' | '2'
  /** Valor total de ICA, igual que en calculateCUFE. Opcional: por defecto 0. */
  valImp3?: number
}

/**
 * Calcula el CUDE usando la Web Crypto API (compatible con Node 18+ y
 * navegadores). Retorna el hash SHA-384 en hexadecimal.
 */
export async function calculateCUDE(params: CUDEParams): Promise<string> {
  const fmt = (n: number) => n.toFixed(2)

  const raw = [
    params.num,
    params.fec,
    params.hor,
    fmt(params.val),
    '01',             // CodImp1 = IVA
    fmt(params.valImp1),
    '04',             // CodImp2 = INC (siempre 0, igual que en CUFE)
    '0.00',
    '03',             // CodImp3 = ICA
    fmt(params.valImp3 ?? 0),
    fmt(params.valTot),
    params.nitOFE,
    params.numAdq,
    params.softwarePin,
    params.tipAmb,
  ].join('')

  const encoder  = new TextEncoder()
  const data     = encoder.encode(raw)
  const hashBuf  = await crypto.subtle.digest('SHA-384', data)
  const hashArr  = Array.from(new Uint8Array(hashBuf))
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('')
}
