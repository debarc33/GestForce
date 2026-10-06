import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { sendDocumentEmail } from '@/services/send-document-email'
import type { PdfDocData } from '@/lib/pdf/document-pdf'

// @react-pdf/renderer necesita APIs de Node (Buffer, etc.) — no funciona en
// el runtime "edge" de Next.
export const runtime = 'nodejs'

type DocumentType = 'quote' | 'invoice'

/**
 * POST /api/sales/documents/send
 * body: { documentType: 'quote' | 'invoice', documentId: string }
 *
 * Genera el PDF del documento (servidor, @react-pdf/renderer) y lo envía
 * por correo al cliente vía Resend, con el PDF adjunto. Reemplaza el botón
 * "Enviar al correo" basado en mailto: (ver src/services/send-document-email.ts
 * para el porqué del cambio).
 *
 * Para cotizaciones: si estaba en "draft", queda marcada como "sent" al
 * enviarse con éxito (mismo comportamiento que tenía el flujo anterior).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { documentType?: DocumentType; documentId?: string } | null
    const documentType = body?.documentType
    const documentId   = body?.documentId

    if (!documentType || !documentId || !['quote', 'invoice'].includes(documentType)) {
      return NextResponse.json({ error: 'documentType y documentId son requeridos' }, { status: 400 })
    }

    const admin = createAdminClient()
    const table = documentType === 'quote' ? 'quotes' : 'invoices'

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

    const itemsTable = documentType === 'quote' ? 'quote_items' : 'invoice_items'
    const itemsFk    = documentType === 'quote' ? 'quote_id'    : 'invoice_id'

    const [{ data: company }, { data: customer }, { data: items }] = await Promise.all([
      admin.from('companies').select('*').eq('id', record.company_id).single(),
      record.customer_id
        ? admin.from('customers')
            .select('id, name, email, doc_type, doc_number, phone, address, city')
            .eq('id', record.customer_id).single()
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
    // (useQuoteItems/useInvoiceItems).
    const productIds = [...new Set((items ?? []).map((i: { product_id: string | null }) => i.product_id).filter(Boolean))] as string[]
    let productMap: Record<string, { name: string; sku: string | null }> = {}
    if (productIds.length > 0) {
      const { data: prods } = await admin.from('products').select('id, name, sku').in('id', productIds)
      productMap = Object.fromEntries((prods ?? []).map((p: { id: string; name: string; sku: string | null }) => [p.id, { name: p.name, sku: p.sku }]))
    }

    const isTaxResponsible = company?.fiscal_regime === 'iva' || company?.fiscal_regime === 'gran_contribuyente'

    const docData: PdfDocData = {
      type: documentType,
      is_tax_responsible: isTaxResponsible,
      number: documentType === 'quote' ? record.quote_number : record.invoice_number,
      issue_date: record.issue_date,
      expiry_date: record.expiry_date ?? null,
      due_date: record.due_date ?? null,
      status: record.status,
      subtotal: Number(record.subtotal),
      tax: Number(record.tax),
      total: Number(record.total),
      notes: record.notes ?? null,
      company: company ?? null,
      customer: customer ?? null,
      items: (items ?? []).map((i: {
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
      })),
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
