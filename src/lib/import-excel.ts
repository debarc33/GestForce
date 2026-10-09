import * as XLSX from 'xlsx'
import type { CustomerInsertValues } from '@/modules/customers/schemas'
import type { SupplierInsertValues } from '@/modules/suppliers/schemas'

// ─── Lectura de archivo ─────────────────────────────────────────────────────

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/** Valida extensión y tamaño antes de intentar leer el archivo. */
export function validateImportFile(file: File): string | null {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return 'El archivo debe ser .xlsx, .xls o .csv.'
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return 'El archivo es demasiado grande (máximo 5 MB).'
  }
  return null
}

/** Lee la primera hoja de un .xlsx/.xls/.csv y devuelve filas como objetos {encabezado: valor}. */
export async function readExcelRows(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  // raw: true devuelve el valor numérico real de cada celda (sin pasar por el
  // formato de visualización, que es lo que causaba inconsistencias como
  // "36.000" vs "36.0" según cómo Excel haya formateado cada celda). Las
  // celdas de texto no se ven afectadas por esta opción.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true })
  return rows.map(row => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      out[k.trim()] = (v ?? '').toString().trim()
    }
    return out
  })
}

// ─── Helpers de parseo ───────────────────────────────────────────────────────

function get(row: Record<string, string>, ...headers: string[]): string {
  for (const h of headers) {
    if (row[h] !== undefined && row[h] !== '') return row[h]
  }
  return ''
}

function parsePercentOrFraction(raw: string, fallback: number): number {
  if (!raw) return fallback
  const hadPercent = raw.includes('%')
  const s = raw.replace('%', '').replace(',', '.').trim()
  const n = parseFloat(s)
  if (isNaN(n)) return fallback
  return hadPercent || n > 1 ? n / 100 : n
}

/**
 * Convierte un texto numérico a number, interpretando el formato
 * colombiano: el PUNTO separa miles y la COMA separa decimales
 * (36.000 = treinta y seis mil, no treinta y seis). Si el texto trae
 * ambos separadores, se asume que el que aparece más a la derecha es
 * el decimal (cubre también el formato 1,234.56 por si el archivo viene
 * de una hoja en inglés).
 */
function parseMoneyOrNumber(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/[^0-9.,-]/g, '')
  if (!cleaned) return 0
  let normalized: string
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // Trae los dos separadores: el último que aparece es el decimal.
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.') // 1.234,56
      : cleaned.replace(/,/g, '')                     // 1,234.56
  } else if (lastComma !== -1) {
    // Solo coma: es el separador decimal.
    normalized = cleaned.replace(',', '.')
  } else if (lastDot !== -1) {
    // Solo punto(s): en Colombia es separador de miles, se eliminan.
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : n
}

function parseInt0(raw: string): number {
  if (!raw) return 0
  const n = parseInt(raw.replace(/[^0-9-]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

/** Acepta tanto el valor crudo (CC, iva, und...) como la etiqueta visible (case-insensitive). */
function matchEnum(raw: string, options: { value: string; label: string }[], fallback: string): string {
  if (!raw) return fallback
  const lower = raw.toLowerCase()
  const byValue = options.find(o => o.value.toLowerCase() === lower)
  if (byValue) return byValue.value
  const byLabel = options.find(o => o.label.toLowerCase() === lower)
  if (byLabel) return byLabel.value
  return fallback
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type MapResult<T> = { ok: true; data: T } | { ok: false; message: string }

// ─── Clientes ────────────────────────────────────────────────────────────────

const CUSTOMER_DOC_TYPES = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
  { value: 'RC',  label: 'Registro Civil' },
  { value: 'TE',  label: 'Tarjeta de Extranjería' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
]

const FISCAL_REGIMES = [
  { value: 'no_iva',             label: 'No Responsable de IVA' },
  { value: 'iva',                label: 'Responsable de IVA' },
  { value: 'gran_contribuyente', label: 'Gran Contribuyente' },
]

export function mapCustomerRow(
  row: Record<string, string>,
  companyId: string
): MapResult<CustomerInsertValues> {
  const name = get(row, 'Nombre / Razón Social', 'Nombre', 'Razón Social', 'Razon Social')
  if (name.length < 2) return { ok: false, message: 'El nombre es obligatorio (mínimo 2 caracteres).' }

  const docNumber = get(row, 'Número Documento', 'Numero Documento', 'Documento', 'NIT')
  if (docNumber.length < 3) return { ok: false, message: 'El número de documento es obligatorio (mínimo 3 caracteres).' }

  const phone = get(row, 'Teléfono', 'Telefono', 'Celular')
  if (phone.length < 7) return { ok: false, message: 'El teléfono es obligatorio (mínimo 7 dígitos).' }

  const email = get(row, 'Email', 'Correo')
  if (email && !EMAIL_RE.test(email)) return { ok: false, message: `Email inválido: "${email}".` }

  const creditDaysRaw = get(row, 'Días de Crédito', 'Dias de Credito')
  const creditDays = creditDaysRaw ? parseInt0(creditDaysRaw) : undefined

  return {
    ok: true,
    data: {
      company_id: companyId,
      name,
      doc_type: matchEnum(get(row, 'Tipo Documento', 'Tipo de Documento'), CUSTOMER_DOC_TYPES, 'CC') as CustomerInsertValues['doc_type'],
      doc_number: docNumber,
      email: email || '',
      phone,
      address: get(row, 'Dirección', 'Direccion'),
      city: get(row, 'Ciudad'),
      department: get(row, 'Departamento'),
      fiscal_regime: matchEnum(get(row, 'Régimen Fiscal', 'Regimen Fiscal'), FISCAL_REGIMES, 'no_iva') as CustomerInsertValues['fiscal_regime'],
      payment_type: get(row, 'Tipo de Pago', 'Tipo Pago'),
      credit_days: creditDays,
      referencia: '',
    },
  }
}

// ─── Proveedores ─────────────────────────────────────────────────────────────

const SUPPLIER_DOC_TYPES = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'TE',  label: 'Tarjeta de Extranjería' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
]

export function mapSupplierRow(
  row: Record<string, string>,
  companyId: string
): MapResult<SupplierInsertValues> {
  const name = get(row, 'Razón Social / Nombre', 'Razon Social / Nombre', 'Nombre', 'Razón Social')
  if (name.length < 2) return { ok: false, message: 'El nombre es obligatorio (mínimo 2 caracteres).' }

  const email = get(row, 'Email', 'Correo')
  if (email && !EMAIL_RE.test(email)) return { ok: false, message: `Email inválido: "${email}".` }

  const paymentDaysRaw = get(row, 'Días de Pago', 'Dias de Pago')

  return {
    ok: true,
    data: {
      company_id: companyId,
      name,
      doc_type: matchEnum(get(row, 'Tipo Documento', 'Tipo de Documento'), SUPPLIER_DOC_TYPES, 'NIT') as SupplierInsertValues['doc_type'],
      doc_number: get(row, 'Número Documento', 'Numero Documento', 'NIT'),
      email: email || '',
      phone: get(row, 'Teléfono', 'Telefono', 'Celular'),
      address: get(row, 'Dirección', 'Direccion'),
      city: get(row, 'Ciudad'),
      department: get(row, 'Departamento'),
      fiscal_regime: matchEnum(get(row, 'Régimen Fiscal', 'Regimen Fiscal'), FISCAL_REGIMES, 'no_iva') as SupplierInsertValues['fiscal_regime'],
      contact_name: get(row, 'Contacto'),
      payment_days: paymentDaysRaw ? parseInt0(paymentDaysRaw) : undefined,
      notes: get(row, 'Notas'),
      payment_cash: false,
      payment_transfer: false,
    },
  }
}

// ─── Productos ───────────────────────────────────────────────────────────────

const UNITS = [
  { value: 'und',    label: 'Unidad (und)' },
  { value: 'kg',     label: 'Kilogramo (kg)' },
  { value: 'g',      label: 'Gramo (g)' },
  { value: 'lt',     label: 'Litro (lt)' },
  { value: 'ml',     label: 'Mililitro (ml)' },
  { value: 'm',      label: 'Metro (m)' },
  { value: 'm2',     label: 'Metro cuadrado (m²)' },
  { value: 'm3',     label: 'Metro cúbico (m³)' },
  { value: 'caja',   label: 'Caja' },
  { value: 'par',    label: 'Par' },
  { value: 'docena', label: 'Docena' },
  { value: 'hora',   label: 'Hora' },
  { value: 'otro',   label: 'Otro' },
]

const TAX_TYPES = [
  { value: 'iva',      label: 'IVA (gravado)' },
  { value: 'excluded', label: 'Excluido de IVA' },
  { value: 'exempt',   label: 'Exento de IVA' },
  { value: 'no_tax',   label: 'Sin impuesto' },
]

/** Resultado de mapear una fila de Productos. category_name queda sin resolver
 *  (el id de categoría se busca/crea al momento de insertar, ver import-dialog en cada página). */
export type ParsedProductRow = {
  name: string
  sku: string
  description: string
  price: number
  stock: number
  stock_minimum: number
  unit: string
  category_name: string
  tax_type: 'iva' | 'excluded' | 'exempt' | 'no_tax'
  tax_rate: number
  is_taxable: boolean
}

export function mapProductRow(row: Record<string, string>): MapResult<ParsedProductRow> {
  const name = get(row, 'Nombre')
  if (name.length < 2) return { ok: false, message: 'El nombre es obligatorio (mínimo 2 caracteres).' }

  const priceRaw = get(row, 'Precio')
  const price = parseMoneyOrNumber(priceRaw)
  if (price < 0) return { ok: false, message: 'El precio no puede ser negativo.' }

  const stockRaw = get(row, 'Stock')
  const stock = stockRaw ? parseInt0(stockRaw) : 0
  if (stock < 0) return { ok: false, message: `Stock inválido: "${stockRaw}".` }

  const taxType = matchEnum(get(row, 'Tipo IVA'), TAX_TYPES, 'iva') as ParsedProductRow['tax_type']

  return {
    ok: true,
    data: {
      name,
      sku: get(row, 'SKU'),
      description: get(row, 'Descripción', 'Descripcion'),
      price,
      stock,
      stock_minimum: parseInt0(get(row, 'Stock mínimo', 'Stock minimo')),
      unit: matchEnum(get(row, 'Unidad'), UNITS, 'und'),
      category_name: get(row, 'Categoría', 'Categoria').trim(),
      tax_type: taxType,
      tax_rate: parsePercentOrFraction(get(row, 'Tarifa IVA'), 0.19),
      is_taxable: taxType !== 'no_tax',
    },
  }
}
