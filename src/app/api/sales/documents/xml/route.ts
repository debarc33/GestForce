import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { calculateCUFE, getColombiaTime } from '@/lib/fe/cufe'
import { generateXMLUBL21 } from '@/lib/fe/xml-ubl21'

export const runtime = 'nodejs'

/**
 * POST /api/sales/documents/xml
 * body: { invoiceId: string }
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
 * Alcance de esta fase: solo facturas electrónicas (no tiquets POS). Notas
 * crédito/débito quedan para la Fase G del plan.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { invoiceId?: string } | null
    const invoiceId = body?.invoiceId

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId es requerido' }, { status: 400 })
    }

    const admin = createAdminClient()

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

    // invoice_items no guarda el nombre del producto, solo product_id --
    // se resuelve igual que en send/route.ts.
    const productIds = [...new Set((items ?? []).map((i: { product_id: string | null }) => i.product_id).filter(Boolean))] as string[]
    let productMap: Record<string, { name: string; sku: string | null }> = {}
    if (productIds.length > 0) {
      const { data: prods } = await admin.from('products').select('id, name, sku').in('id', productIds)
      productMap = Object.fromEntries((prods ?? []).map((p: { id: string; name: string; sku: string | null }) => [p.id, { name: p.name, sku: p.sku }]))
    }

    const docItems = (items ?? []).map((i: {
      product_id: string | null; quantity: number; unit_price: number; discount: number
      tax_rate: number; subtotal: number; tax: number; total: number
    }) => ({
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
  } catch (e) {
    console.error('Error generando XML DIAN:', e)
    const message = e instanceof Error ? e.message : 'Error generando el XML'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
