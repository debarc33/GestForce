import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { sendDocumentEmail } from '@/services/send-document-email'
import type { PdfDocData } from '@/lib/pdf/document-pdf'

// @react-pdf/renderer necesita APIs de Node (Buffer, etc.) — no funciona en
// el runtime "edge" de Next.
export const runtime = 'nodejs'

type DocumentType = 'quote' | 'invoice' | 'credit_note' | 'debit_note'

const TABLE_BY_TYPE: Record<DocumentType, string> = {
  quote: 'quotes', invoice: 'invoices',
  credit_note: 'credit_debit_notes', debit_note: 'credit_debit_notes',
}
const ITEMS_TABLE_BY_TYPE: Record<DocumentType, string> = {
  quote: 'quote_items', invoice: 'invoice_items',
  credit_note: 'credit_debit_note_items', debit_note: 'credit_debit_note_items',
}
const ITEMS_FK_BY_TYPE: Record<DocumentType, string> = {
  quote: 'quote_id', invoice: 'invoice_id', credit_note: 'note_id', debit_note: 'note_id',
}
const NUMBER_FIELD_BY_TYPE: Record<DocumentType, string> = {
  quote: 'quote_number', invoice: 'invoice_number',
  credit_note: 'note_number', debit_note: 'note_number',
}

/**
 * POST /api/sales/documents/send
 * body: { documentType: 'quote' | 'invoice' | 'credit_note' | 'debit_note', documentId: string }
 *
 * Genera el PDF del documento (servidor, @react-pdf/renderer) y lo envía
 * por correo al cliente vía Resend, con el PDF adjunto. Reemplaza el botón
 * "Enviar al correo" basado en mailto: (ver src/services/send-document-email.ts
 * para el porqué del cambio).
 *
 * Para cotizaciones: si estaba en "draft", queda marcada como "sent" al
 * enviarse con éxito (mismo comportamiento que tenía el flujo anterior).
 *
 * Fase G (claude/plan-accion-facturacion-dian.md): agrega credit_note/
 * debit_note -- antes solo quote/invoice. credit_debit_notes no tiene
 * customer_id propio ni columna de "número" unificada, así que ambos se
 * resuelven aparte (el cliente vía la factura referenciada, invoice_id).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { documentType?: DocumentType; documentId?: string } | null
    const documentType = body?.documentType
    const documentId   = body?.documentId

    if (!documentType || !documentId || !(documentType in TABLE_BY_TYPE)) {
      return NextResponse.json({ error: 'documentType y documentId son requeridos' }, { status: 400 })
    }

    const admin  = createAdminClient()
    const table  = TABLE_BY_TYPE[documentType]
    const isNote = documentType === 'credit_note' || documentType === 'debit_note'

    const { data: record, error: recordError } = await admin
      .from(table)
      .select('*')
      .eq('id', documentId)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Nunca confiar en un company_id enviado por el cliente: se valida
    // membresía contra el company_id real del documento ya encontrado.
    const check = await requireCompanyMember(record.company_id)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    // credit_debit_notes no tiene customer_id propio -- se resuelve vía la
    // factura referenciada (record.invoice_id).
    let customerId: string | null = record.customer_id ?? null
    if (isNote) {
      const { data: refInvoice } = await admin
        .from('invoices').select('customer_id').eq('id', record.invoice_id).single()
      customerId = refInvoice?.customer_id ?? null
    }

    const itemsTable = ITEMS_TABLE_BY_TYPE[documentType]
    const itemsFk    = ITEMS_FK_BY_TYPE[documentType]

    const [{ data: company }, { data: customer }, { data: items }] = await Promise.all([
      admin.from('companies').select('*').eq('id', record.company_id).single(),
      customerId
        ? admin.from('customers')
            .select('id, name, email, doc_type, doc_number, phone, address, city')
            .eq('id', customerId).single()
        : Promise.resolve({ data: null }),
      admin.from(itemsTable).select('*').eq(itemsFk, documentId).order('id'),
    ])

    if (!customer?.email) {
      return NextResponse.json(
        { error: 'Este cliente no tiene un correo registrado. Agrega su correo en Clientes antes de enviarle el documento.' },
        { status: 400 }
      )
    }

    // quote_items/invoice_items no guardan el nombre del producto, solo
    // product_id — se resuelve igual que en las queries del cliente
    // (useQuoteItems/useInvoiceItems). credit_debit_note_items SÍ guarda su
    // propio product_name/sku, así que para notas se usan directo (igual
    // que en /api/sales/documents/xml).
    let docItems: PdfDocData['items']
    if (isNote) {
      docItems = (items ?? []).map((i: {
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
    } else {
      const productIds = [...new Set((items ?? []).map((i: { product_id: string | null }) => i.product_id).filter(Boolean))] as string[]
      let productMap: Record<string, { name: string; sku: string | null }> = {}
      if (productIds.length > 0) {
        const { data: prods } = await admin.from('products').select('id, name, sku').in('id', productIds)
        productMap = Object.fromEntries((prods ?? []).map((p: { id: string; name: string; sku: string | null }) => [p.id, { name: p.name, sku: p.sku }]))
      }
      docItems = (items ?? []).map((i: {
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
    }

    const isTaxResponsible = company?.fiscal_regime === 'iva' || company?.fiscal_regime === 'gran_contribuyente'

    const docData: PdfDocData = {
      type: documentType,
      is_tax_responsible: isTaxResponsible,
      number: (record as Record<string, string>)[NUMBER_FIELD_BY_TYPE[documentType]],
      issue_date: record.issue_date,
      expiry_date: record.expiry_date ?? null,
      due_date: record.due_date ?? null,
      status: record.status,
      subtotal: Number(record.subtotal),
      tax: Number(record.tax),
      total: Number(record.total),
      notes: record.notes ?? null,
      // Fase F/G: CUFE (facturas) / CUDE (notas) + QR -- las cotizaciones no
      // tienen estas columnas, por lo que llegan undefined/null (DocumentPdf
      // solo pinta el bloque si el documento tiene su código calculado).
      cufe: (record as { cufe?: string | null }).cufe ?? null,
      cude: (record as { cude?: string | null }).cude ?? null,
      fe_generated_at: (record as { fe_generated_at?: string | null }).fe_generated_at ?? null,
      company: company ?? null,
      customer: customer ?? null,
      items: docItems,
    }

    await sendDocumentEmail(docData)

    if (documentType === 'quote' && record.status !== 'sent') {
      await admin.from('quotes').update({ status: 'sent' }).eq('id', documentId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error enviando documento por correo:', e)
    const message = e instanceof Error ? e.message : 'Error enviando el correo'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
