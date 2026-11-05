import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { calculateCUFE, getColombiaTime } from '@/lib/fe/cufe'
import { calculateCUDE } from '@/lib/fe/cude'
import { generateXMLUBL21 } from '@/lib/fe/xml-ubl21'

export const runtime = 'nodejs'

/**
 * POST /api/sales/documents/xml
 * body: { invoiceId: string } | { noteId: string }
 *
 * Fase C de claude/plan-accion-facturacion-dian.md: genera (o regenera) el
 * CUFE y el XML UBL 2.1 de una factura del lado del servidor. Antes esto
 * corría en el navegador (`document-viewer.tsx`) con las credenciales FE
 * expuestas al cliente (ver Fase A, hallazgo Sección 7 del informe de
 * auditoría) -- ahora `fe_technical_key` nunca sale de este servidor.
 *
 * También corrige dos hallazgos de la Sección 4 del informe:
 *   - El ambiente (tipAmb) se deriva directo de companies.fe_test_mode en la
 *     base de datos, no de un booleano que viajaba desde el cliente.
 *   - El CUFE incluye el ICA real (companies.ica_rate) en vez del '0.00' fijo.
 *
 * El resultado se persiste en invoices.cufe / invoices.xml_ubl (migración
 * 034) para no perderlo si el usuario no lo descarga en el momento -- antes
 * no se guardaba en ningún lado.
 *
 * Fase G (claude/plan-accion-facturacion-dian.md): agrega el mismo flujo
 * para Notas Crédito/Débito -- body { noteId } en vez de { invoiceId }.
 * Usa CUDE (no CUFE; fórmula distinta, ver src/lib/fe/cude.ts) y
 * `company.fe_software_pin` (no `fe_technical_key`) como secreto. El
 * resultado se persiste en credit_debit_notes.cude/xml_ubl/fe_generated_at
 * (migración 036). El XML referencia la factura original vía
 * BillingReference (su número + su CUFE ya calculado).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { invoiceId?: string; noteId?: string } | null
    const invoiceId = body?.invoiceId
    const noteId    = body?.noteId

    if (!invoiceId && !noteId) {
      return NextResponse.json({ error: 'invoiceId o noteId es requerido' }, { status: 400 })
    }

    const admin = createAdminClient()

    if (noteId) {
      return await handleNote(admin, noteId)
    }
    return await handleInvoice(admin, invoiceId!)
  } catch (e) {
    console.error('Error generando XML DIAN:', e)
    const message = e instanceof Error ? e.message : 'Error generando el XML'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleInvoice(admin: AdminClient, invoiceId: string) {
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  if (invoice.document_type === 'ticket') {
    return NextResponse.json({ error: 'Los tiquets POS no generan XML DIAN' }, { status: 400 })
  }

  // Nunca confiar en un company_id enviado por el cliente: se valida
  // membresía contra el company_id real de la factura ya encontrada.
  const check = await requireCompanyMember(invoice.company_id)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('*')
    .eq('id', invoice.company_id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  if (!company.fe_software_id || !company.fe_technical_key) {
    return NextResponse.json(
      { error: 'Esta empresa no tiene configurada la Facturación Electrónica (falta ID de Software o Llave Técnica en Configuración).' },
      { status: 400 }
    )
  }

  const [{ data: customer }, { data: items }] = await Promise.all([
    invoice.customer_id
      ? admin.from('customers')
          .select('id, name, email, doc_type, doc_number, phone, address, city')
          .eq('id', invoice.customer_id).single()
      : Promise.resolve({ data: null }),
    admin.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('id'),
  ])

  const docItems = await resolveItems(admin, items ?? [])

  // Ambiente: derivado directo de la base de datos (hallazgo Sección 4.5
  // del informe -- antes dependía de un booleano frágil pasado desde el
  // cliente). Por defecto "2" (pruebas) si el dato no está, igual que
  // antes -- queda del lado seguro.
  const tipAmb: '1' | '2' = company.fe_test_mode === false ? '1' : '2'

  // ICA real (hallazgo Sección 4.4 del informe -- antes siempre '0.00').
  // company.ica_rate es una fracción (ej. 0.00414 = 0.414%), igual que
  // tax_rate de IVA (ver comentario en src/modules/company/queries.ts).
  const icaRate   = Number(company.ica_rate ?? 0)
  const icaAmount = icaRate > 0 ? Number(invoice.subtotal) * icaRate : 0

  const nitOFE = (company.nit ?? '').replace(/[^0-9]/g, '')
  const numAdq = (customer?.doc_number ?? '222222222222').replace(/[^0-9]/g, '')
  const horFac = getColombiaTime()

  const cufe = await calculateCUFE({
    numFac:  invoice.invoice_number,
    fecFac:  invoice.issue_date,
    horFac,
    valFac:  Number(invoice.subtotal),
    valImp1: Number(invoice.tax),
    valTot:  Number(invoice.total),
    nitOFE,
    numAdq,
    clTec:   company.fe_technical_key,
    tipAmb,
    valImp3: icaAmount,
  })

  const xml = generateXMLUBL21({
    invoiceNumber:   invoice.invoice_number,
    cufe,
    issueDate:       invoice.issue_date,
    issueTime:       horFac,
    dueDate:         invoice.due_date ?? null,
    tipAmb,
    softwareId:      company.fe_software_id,
    invoiceTypeCode: '01',
    company: {
      name:       company.name,
      nit:        company.nit ?? '',
      legal_name: company.legal_name,
      address:    company.address,
      city:       company.city,
      department: company.department,
      phone:      company.phone,
      email:      company.email,
      ciiu_code:  company.ciiu_code,
    },
    customer: {
      name:       customer?.name ?? 'Consumidor Final',
      doc_type:   customer?.doc_type,
      doc_number: customer?.doc_number,
      email:      customer?.email,
    },
    items:    docItems,
    subtotal: Number(invoice.subtotal),
    taxTotal: Number(invoice.tax),
    total:    Number(invoice.total),
    notes:    invoice.notes,
  })

  const fe_generated_at = new Date().toISOString()

  await admin
    .from('invoices')
    .update({ cufe, xml_ubl: xml, fe_generated_at })
    .eq('id', invoiceId)

  return NextResponse.json({ cufe, xml, fe_generated_at })
}

async function handleNote(admin: AdminClient, noteId: string) {
  const { data: note, error: noteError } = await admin
    .from('credit_debit_notes')
    .select('*')
    .eq('id', noteId)
    .single()

  if (noteError || !note) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
  }

  // Nunca confiar en un company_id enviado por el cliente: se valida
  // membresía contra el company_id real de la nota ya encontrada.
  const check = await requireCompanyMember(note.company_id)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const [{ data: company, error: companyError }, { data: invoice }] = await Promise.all([
    admin.from('companies').select('*').eq('id', note.company_id).single(),
    admin.from('invoices').select('invoice_number, cufe, customer_id').eq('id', note.invoice_id).single(),
  ])

  if (companyError || !company) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  // La nota usa el Software-PIN (no la Llave Técnica -- fórmula CUDE
  // distinta de la CUFE, ver src/lib/fe/cude.ts), además del mismo ID de
  // Software que las facturas.
  if (!company.fe_software_id || !company.fe_software_pin) {
    return NextResponse.json(
      { error: 'Esta empresa no tiene configurada la Facturación Electrónica (falta ID de Software o Software-PIN en Configuración).' },
      { status: 400 }
    )
  }

  const customerId = invoice?.customer_id ?? null

  const [{ data: customer }, { data: items }] = await Promise.all([
    customerId
      ? admin.from('customers')
          .select('id, name, email, doc_type, doc_number, phone, address, city')
          .eq('id', customerId).single()
      : Promise.resolve({ data: null }),
    admin.from('credit_debit_note_items').select('*').eq('note_id', noteId).order('id'),
  ])

  // A diferencia de invoice_items, credit_debit_note_items SÍ guarda su
  // propio product_name/sku (no hace falta resolverlos contra products) --
  // se usan tal cual, en vez de resolveItems() (que es para invoice_items).
  const docItems = (items ?? []).map((i: {
    product_name: string; sku: string | null; quantity: number; unit_price: number; discount: number
    tax_rate: number; subtotal: number; tax: number; total: number
  }) => ({
    product_name: i.product_name ?? '',
    sku: i.sku ?? null,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    discount: Number(i.discount),
    tax_rate: Number(i.tax_rate),
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    total: Number(i.total),
  }))

  const tipAmb: '1' | '2' = company.fe_test_mode === false ? '1' : '2'

  const icaRate   = Number(company.ica_rate ?? 0)
  const icaAmount = icaRate > 0 ? Number(note.subtotal) * icaRate : 0

  const nitOFE = (company.nit ?? '').replace(/[^0-9]/g, '')
  const numAdq = (customer?.doc_number ?? '222222222222').replace(/[^0-9]/g, '')
  const hor    = getColombiaTime()

  const cude = await calculateCUDE({
    num:     note.note_number,
    fec:     note.issue_date,
    hor,
    val:     Number(note.subtotal),
    valImp1: Number(note.tax),
    valTot:  Number(note.total),
    nitOFE,
    numAdq,
    softwarePin: company.fe_software_pin,
    tipAmb,
    valImp3: icaAmount,
  })

  const xml = generateXMLUBL21({
    invoiceNumber:      note.note_number,
    cufe:               cude,
    issueDate:          note.issue_date,
    issueTime:          hor,
    dueDate:            null,
    tipAmb,
    softwareId:         company.fe_software_id,
    invoiceTypeCode:    note.type === 'credit' ? '91' : '92',
    referencedInvoice:  invoice?.invoice_number ?? null,
    referencedCUFE:     invoice?.cufe ?? null,
    company: {
      name:       company.name,
      nit:        company.nit ?? '',
      legal_name: company.legal_name,
      address:    company.address,
      city:       company.city,
      department: company.department,
      phone:      company.phone,
      email:      company.email,
      ciiu_code:  company.ciiu_code,
    },
    customer: {
      name:       customer?.name ?? 'Consumidor Final',
      doc_type:   customer?.doc_type,
      doc_number: customer?.doc_number,
      email:      customer?.email,
    },
    items:    docItems,
    subtotal: Number(note.subtotal),
    taxTotal: Number(note.tax),
    total:    Number(note.total),
    notes:    note.notes,
  })

  const fe_generated_at = new Date().toISOString()

  await admin
    .from('credit_debit_notes')
    .update({ cude, xml_ubl: xml, fe_generated_at })
    .eq('id', noteId)

  return NextResponse.json({ cufe: cude, xml, fe_generated_at })
}

// invoice_items / credit_debit_note_items no guardan el nombre del producto,
// solo product_id -- se resuelve igual en ambos casos (y en send/route.ts).
async function resolveItems(
  admin: AdminClient,
  items: Array<{
    product_id: string | null; quantity: number; unit_price: number; discount: number
    tax_rate: number; subtotal: number; tax: number; total: number
  }>
) {
  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))] as string[]
  let productMap: Record<string, { name: string; sku: string | null }> = {}
  if (productIds.length > 0) {
    const { data: prods } = await admin.from('products').select('id, name, sku').in('id', productIds)
    productMap = Object.fromEntries((prods ?? []).map((p: { id: string; name: string; sku: string | null }) => [p.id, { name: p.name, sku: p.sku }]))
  }

  return items.map(i => ({
    product_name: i.product_id ? (productMap[i.product_id]?.name ?? '') : '',
    sku: i.product_id ? (productMap[i.product_id]?.sku ?? null) : null,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    discount: Number(i.discount),
    tax_rate: Number(i.tax_rate),
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    total: Number(i.total),
  }))
}
