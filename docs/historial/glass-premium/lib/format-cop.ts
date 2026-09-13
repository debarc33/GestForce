/**
 * GestForce — Formato monetario y fiscal (Colombia)
 *
 * Helpers consistentes para mostrar pesos colombianos y datos DIAN.
 */

/** Formato COP completo: $1.284.000 */
export function formatCOP(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Formato compacto: $48.9M, $284K, $1.2B */
export function formatCOPCompact(amount: number | null | undefined): string {
  if (amount == null) return '—'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(amount / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000)     return `${sign}$${(amount / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)         return `${sign}$${(amount / 1_000).toFixed(1)}K`
  return formatCOP(amount)
}

/** Fecha corta es-CO: 24 may 2026 */
export function formatDate(
  iso: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', opts)
}

/** Etiquetas de régimen fiscal DIAN */
export const FISCAL_LABEL: Record<string, string> = {
  no_iva: 'No Resp. IVA',
  iva: 'Resp. IVA',
  gran_contribuyente: 'Gran Contribuyente',
}

/** Etiquetas de tipo de documento DIAN */
export const DOC_TYPE_LABEL: Record<string, string> = {
  CC: 'Cédula de Ciudadanía',
  CE: 'Cédula de Extranjería',
  NIT: 'NIT',
  PA: 'Pasaporte',
  TI: 'Tarjeta de Identidad',
}

/** Calcula IVA 19% sobre un subtotal */
export function calcIVA(subtotal: number, rate = 0.19): { tax: number; total: number } {
  const tax = Math.round(subtotal * rate)
  return { tax, total: subtotal + tax }
}

/** Extrae subtotal e IVA de un total que ya incluye IVA */
export function fromTotalWithIVA(total: number, rate = 0.19): { subtotal: number; tax: number } {
  const subtotal = Math.round(total / (1 + rate))
  return { subtotal, tax: total - subtotal }
}
