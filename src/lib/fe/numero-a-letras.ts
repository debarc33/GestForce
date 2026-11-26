/**
 * Conversión de un valor numérico (pesos colombianos) a su escritura en
 * letras -- hallazgo 26 nov 2026, comparando el documento impreso de
 * GestForce contra una factura real de Siigo: a Siigo (y en general a la
 * práctica comercial/legal colombiana) siempre le aparece la línea "Valor
 * en Letras", y GestForce no la mostraba en ningún lado.
 *
 * Soporta enteros de 0 a 999.999.999 (más que suficiente para cualquier
 * factura real) -- no maneja centavos porque COP no los usa en la
 * práctica (los totales ya vienen redondeados al peso).
 */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const DIEZ_A_DIECINUEVE = [
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
]
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

/** Convierte un grupo de 0 a 999. */
function convertirGrupo(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'

  const centena = Math.floor(n / 100)
  const resto = n % 100

  let out = ''
  if (centena > 0) out += CENTENAS[centena]

  if (resto > 0) {
    if (out) out += ' '
    if (resto < 10) {
      out += UNIDADES[resto]
    } else if (resto < 20) {
      out += DIEZ_A_DIECINUEVE[resto - 10]
    } else {
      const decena = Math.floor(resto / 10)
      const unidad = resto % 10
      if (decena === 2 && unidad > 0) {
        out += 'veinti' + UNIDADES[unidad]
      } else {
        out += DECENAS[decena]
        if (unidad > 0) out += ' y ' + UNIDADES[unidad]
      }
    }
  }
  return out
}

/** "uno" → "un" cuando precede a un sustantivo (millones/mil/pesos) --
 *  incluye el caso especial "veintiuno" → "veintiún". Compara el FINAL del
 *  string (no el string completo) porque "uno"/"veintiuno" pueden venir
 *  precedidos de una centena, ej. "ciento veintiuno" → "ciento veintiún"
 *  (bug encontrado en pruebas: la versión anterior solo comparaba el
 *  string completo y no detectaba este caso). */
function apocope(s: string): string {
  if (s.endsWith('veintiuno')) return s.slice(0, -3) + 'ún'
  if (s.endsWith('uno')) return s.slice(0, -3) + 'un'
  return s
}

/** Número entero (ya redondeado) a su escritura en palabras, sin el
 *  sufijo "pesos m/cte" -- ver valorEnLetras() más abajo para eso. */
export function numeroALetras(valor: number): string {
  const n = Math.round(Math.abs(valor))
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const resto1    = n % 1_000_000
  const miles     = Math.floor(resto1 / 1000)
  const resto2    = resto1 % 1000

  const partes: string[] = []
  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : apocope(convertirGrupo(millones)) + ' millones')
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : apocope(convertirGrupo(miles)) + ' mil')
  }
  if (resto2 > 0) {
    partes.push(apocope(convertirGrupo(resto2)))
  }

  const texto = partes.join(' ').replace(/\s+/g, ' ').trim()
  return (valor < 0 ? 'menos ' : '') + texto
}

/** "Valor en Letras" listo para imprimir, ej. "Seis millones ochocientos
 *  cuarenta mil setecientos cincuenta pesos m/cte" -- mismo formato que
 *  usa Siigo (fuente de la comparación, 26 nov 2026). */
export function valorEnLetras(valor: number): string {
  const texto = numeroALetras(valor)
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1)
  const unidad = Math.round(Math.abs(valor)) === 1 ? 'peso' : 'pesos'
  return `${capitalizado} ${unidad} m/cte`
}
