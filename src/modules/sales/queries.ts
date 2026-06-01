'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos de respuesta ───────────────────────────────────────────────────

export type QuoteWithCustomer = {
  id: string
  company_id: string
  customer_id: string | null
  quote_number: string
  issue_date: string
  expiry_date: string | null
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'
  notes: string | null
  created_at: string
  customer: { id: string; name: string; email: string | null } | null
}

export type InvoiceWithCustomer = {
  id: string
  company_id: string
  customer_id: string | null
  quote_id: string | null
  invoice_number: string
  quote_number?: string | null
  issue_date: string
  due_date: string | null
  subtotal: number
  tax: number
  total: number
  balance_due: number
  document_type: 'invoice' | 'ticket'
  dian_status: 'not_applicable' | 'pending' | 'accepted' | 'rejected'
  status: 'draft' | 'issued' | 'cancelled'
  payment_status: 'unpaid' | 'partial' | 'paid'
  notes: string | null
  issued_at: string | null
  created_at: string
  rete_fuente: number
  rete_iva: number
  agent_id: string | null
  customer: { id: string; name: string; email: string | null } | null
  agent: { id: string; name: string; commission_rate: number | null } | null
}

export type ReceiptWithDetails = {
  id: string
  company_id: string
  customer_id: string | null
  invoice_id: string
  receipt_number: string
  total_amount: number
  amount_paid: number
  balance: number
  status: 'pending' | 'partial' | 'paid' | 'cancelled'
  due_date: string | null
  created_at: string
  customer: { id: string; name: string } | null
  invoice_number: string | null
}

export type PaymentMethod = {
  id: string
  company_id: string
  name: string
  type: 'cash' | 'transfer' | 'card' | 'check' | 'other'
  is_active: boolean
  created_at: string
}

export type ReceiptPayment = {
  id: string
  receipt_id: string
  payment_method_id: string
  amount: number
  payment_date: string
  reference: string | null
  created_at: string
  payment_method: { name: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function fetchCustomerMap(
  supabase: ReturnType<typeof createClient>,
  customerIds: string[]
): Promise<Record<string, { id: string; name: string; email: string | null }>> {
  if (customerIds.length === 0) return {}
  const { data } = await supabase.from('customers').select('id, name, email').in('id', customerIds)
  return Object.fromEntries((data ?? []).map((c) => [c.id, { ...c, email: c.email ?? null }]))
}

// ─── COTIZACIONES ─────────────────────────────────────────────────────────

export function useQuotes(companyId?: string) {
  return useQuery({
    queryKey: ['quotes', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return []

      const customerIds = [...new Set(data.map((q) => q.customer_id).filter(Boolean))] as string[]
      const customerMap = await fetchCustomerMap(supabase, customerIds)

      return data.map((q) => ({
        ...q,
        customer: q.customer_id ? (customerMap[q.customer_id] ?? null) : null,
      })) as QuoteWithCustomer[]
    },
    enabled: !!companyId,
  })
}

export type CreateQuotePayload = {
  company_id: string
  customer_id: string | null
  issue_date: string
  expiry_date: string | null
  notes: string | null
  subtotal: number
  tax: number
  total: number
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    discount: number
    tax_rate: number
    subtotal: number
    tax: number
    total: number
  }>
}

export async function createQuoteWithItems(payload: CreateQuotePayload) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_quote_with_items', {
    p_company_id: payload.company_id,
    p_customer_id: payload.customer_id,
    p_issue_date: payload.issue_date,
    p_expiry_date: payload.expiry_date,
    p_notes: payload.notes,
    p_subtotal: payload.subtotal,
    p_tax: payload.tax,
    p_total: payload.total,
    p_items: payload.items,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function updateQuoteStatus(
  id: string,
  status: 'sent' | 'rejected' | 'expired'
) {
  const supabase = createClient()
  const { error } = await supabase.from('quotes').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function approveQuote(quoteId: string, documentType: 'invoice' | 'ticket' = 'invoice') {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('approve_quote', {
    p_quote_id: quoteId,
    p_document_type: documentType,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function deleteQuotes(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('quotes').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

// ─── FACTURAS ─────────────────────────────────────────────────────────────

export function useInvoices(companyId?: string) {
  return useQuery({
    queryKey: ['invoices', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return []

      const customerIds = [...new Set(data.map((i) => i.customer_id).filter(Boolean))] as string[]
      const customerMap = await fetchCustomerMap(supabase, customerIds)

      // Obtener números de cotización referenciadas
      const quoteIds = [...new Set(data.map((i) => i.quote_id).filter(Boolean))] as string[]
      let quoteMap: Record<string, string> = {}
      if (quoteIds.length > 0) {
        const { data: quotes } = await supabase
          .from('quotes')
          .select('id, quote_number')
          .in('id', quoteIds)
        quoteMap = Object.fromEntries((quotes ?? []).map((q) => [q.id, q.quote_number]))
      }

      return data.map((inv) => ({
        ...inv,
        customer: inv.customer_id ? (customerMap[inv.customer_id] ?? null) : null,
        quote_number: inv.quote_id ? (quoteMap[inv.quote_id] ?? null) : null,
      })) as InvoiceWithCustomer[]
    },
    enabled: !!companyId,
  })
}

export async function issueInvoice(invoiceId: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('issue_invoice', { p_invoice_id: invoiceId })
  if (error) throw new Error(error.message)
}

export async function deleteInvoices(ids: string[]) {
  const supabase = createClient()
  // Solo se pueden eliminar borradores
  const { error } = await supabase
    .from('invoices')
    .delete()
    .in('id', ids)
    .eq('status', 'draft')
  if (error) throw new Error(error.message)
}

// ─── RECIBOS ──────────────────────────────────────────────────────────────

export function useReceipts(companyId?: string) {
  return useQuery({
    queryKey: ['receipts', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return []

      const customerIds = [...new Set(data.map((r) => r.customer_id).filter(Boolean))] as string[]
      const customerMap = await fetchCustomerMap(supabase, customerIds)

      const invoiceIds = data.map((r) => r.invoice_id).filter(Boolean) as string[]
      let invoiceMap: Record<string, string> = {}
      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, invoice_number')
          .in('id', invoiceIds)
        invoiceMap = Object.fromEntries((invoices ?? []).map((inv) => [inv.id, inv.invoice_number]))
      }

      return data.map((r) => ({
        ...r,
        customer: r.customer_id ? (customerMap[r.customer_id] ?? null) : null,
        invoice_number: r.invoice_id ? (invoiceMap[r.invoice_id] ?? null) : null,
      })) as ReceiptWithDetails[]
    },
    enabled: !!companyId,
  })
}

export function useReceiptPayments(receiptId?: string) {
  return useQuery({
    queryKey: ['receipt_payments', receiptId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('receipt_payments')
        .select('*, payment_methods(name)')
        .eq('receipt_id', receiptId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map((p) => ({
        ...p,
        payment_method: p.payment_methods ?? null,
      })) as ReceiptPayment[]
    },
    enabled: !!receiptId,
  })
}

export async function registerReceiptPayment(payload: {
  receipt_id: string
  payment_method_id: string
  amount: number
  payment_date: string
  reference?: string
}) {
  const supabase = createClient()
  const { error } = await supabase.rpc('register_receipt_payment', {
    p_receipt_id: payload.receipt_id,
    p_payment_method_id: payload.payment_method_id,
    p_amount: payload.amount,
    p_payment_date: payload.payment_date,
    p_reference: payload.reference ?? null,
  })
  if (error) throw new Error(error.message)
}

// ─── MEDIOS DE PAGO ───────────────────────────────────────────────────────

export function usePaymentMethods(companyId?: string) {
  return useQuery({
    queryKey: ['payment_methods', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as PaymentMethod[]
    },
    enabled: !!companyId,
  })
}

export async function createPaymentMethod(payload: {
  company_id: string
  name: string
  type: string
}) {
  const supabase = createClient()
  const { error } = await supabase.from('payment_methods').insert(payload)
  if (error) throw new Error(error.message)
}

export async function updatePaymentMethod(
  id: string,
  payload: { name?: string; type?: string; is_active?: boolean }
) {
  const supabase = createClient()
  const { error } = await supabase.from('payment_methods').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePaymentMethod(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('payment_methods').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── QUERY: single quote with customer email ──────────────────────────────
export type QuoteCustomer = {
  id: string
  name: string
  email: string | null
  doc_type: string | null
  doc_number: string | null
  phone: string | null
  address: string | null
  city: string | null
}

export function useQuote(id?: string) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('quotes').select('*').eq('id', id!).single()
      if (error) throw new Error(error.message)
      let customer: QuoteCustomer | null = null
      if (data.customer_id) {
        const { data: c } = await supabase
          .from('customers')
          .select('id, name, email, doc_type, doc_number, phone, address, city')
          .eq('id', data.customer_id).single()
        customer = c ?? null
      }
      return { ...data, customer } as QuoteWithCustomer & { customer: QuoteCustomer | null }
    },
    enabled: !!id,
  })
}

export type QuoteItemWithProduct = {
  id: string
  quote_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  subtotal: number
  tax: number
  total: number
  stock: number
}

export function useQuoteItems(quoteId?: string) {
  return useQuery({
    queryKey: ['quote_items', quoteId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('quote_items').select('*').eq('quote_id', quoteId!).order('id')
      if (error) throw new Error(error.message)
      const items = data ?? []
      const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))] as string[]
      let productMap: Record<string, { name: string; sku: string | null; stock: number }> = {}
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products').select('id, name, sku, stock').in('id', productIds)
        productMap = Object.fromEntries((prods ?? []).map(p => [p.id, { name: p.name, sku: p.sku, stock: p.stock }]))
      }
      return items.map(item => ({
        ...item,
        product_name: item.product_id ? (productMap[item.product_id]?.name ?? '') : '',
        sku: item.product_id ? (productMap[item.product_id]?.sku ?? null) : null,
        stock: item.product_id ? (productMap[item.product_id]?.stock ?? 0) : 0,
      })) as QuoteItemWithProduct[]
    },
    enabled: !!quoteId,
  })
}

export async function updateQuoteWithItems(payload: {
  quote_id: string
  customer_id: string | null
  issue_date: string
  expiry_date: string | null
  notes: string | null
  subtotal: number
  tax: number
  total: number
  items: Array<{
    product_id: string; quantity: number; unit_price: number
    discount: number; tax_rate: number; subtotal: number; tax: number; total: number
  }>
}) {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_quote_with_items', {
    p_quote_id: payload.quote_id,
    p_customer_id: payload.customer_id,
    p_issue_date: payload.issue_date,
    p_expiry_date: payload.expiry_date,
    p_notes: payload.notes,
    p_subtotal: payload.subtotal,
    p_tax: payload.tax,
    p_total: payload.total,
    p_items: payload.items,
  })
  if (error) throw new Error(error.message)
}

// ─── QUERY: invoice linked to a quote ────────────────────────────────────
export function useInvoiceByQuoteId(quoteId?: string) {
  return useQuery({
    queryKey: ['invoice_by_quote', quoteId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, document_type, status')
        .eq('quote_id', quoteId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    enabled: !!quoteId,
  })
}

// ─── QUERY: single invoice with customer email ────────────────────────────
export function useInvoice(id?: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices').select('*').eq('id', id!).single()
      if (error) throw new Error(error.message)
      let customer: QuoteCustomer | null = null
      if (data.customer_id) {
        const { data: c } = await supabase
          .from('customers')
          .select('id, name, email, doc_type, doc_number, phone, address, city')
          .eq('id', data.customer_id).single()
        customer = c ?? null
      }
      let quote_number: string | null = null
      if (data.quote_id) {
        const { data: q } = await supabase
          .from('quotes').select('quote_number').eq('id', data.quote_id).single()
        quote_number = q?.quote_number ?? null
      }
      let agent: InvoiceWithCustomer['agent'] = null
      if (data.agent_id) {
        const { data: a } = await supabase
          .from('employees')
          .select('id, name, commission_rate')
          .eq('id', data.agent_id).single()
        agent = a ?? null
      }
      return { ...data, customer, quote_number, agent } as InvoiceWithCustomer & { customer: QuoteCustomer | null }
    },
    enabled: !!id,
  })
}

export type InvoiceItemWithProduct = QuoteItemWithProduct & { invoice_id: string }

export function useInvoiceItems(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice_items', invoiceId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoice_items').select('*').eq('invoice_id', invoiceId!).order('id')
      if (error) throw new Error(error.message)
      const items = data ?? []
      const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))] as string[]
      let productMap: Record<string, { name: string; sku: string | null; stock: number }> = {}
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products').select('id, name, sku, stock').in('id', productIds)
        productMap = Object.fromEntries((prods ?? []).map(p => [p.id, { name: p.name, sku: p.sku, stock: p.stock }]))
      }
      return items.map(item => ({
        ...item,
        product_name: item.product_id ? (productMap[item.product_id]?.name ?? '') : '',
        sku: item.product_id ? (productMap[item.product_id]?.sku ?? null) : null,
        stock: item.product_id ? (productMap[item.product_id]?.stock ?? 0) : 0,
      })) as InvoiceItemWithProduct[]
    },
    enabled: !!invoiceId,
  })
}

export async function updateInvoiceWithItems(payload: {
  invoice_id: string
  customer_id: string | null
  issue_date: string
  due_date: string | null
  notes: string | null
  subtotal: number
  tax: number
  total: number
  items: Array<{
    product_id: string; quantity: number; unit_price: number
    discount: number; tax_rate: number; subtotal: number; tax: number; total: number
  }>
}) {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_invoice_with_items', {
    p_invoice_id: payload.invoice_id,
    p_customer_id: payload.customer_id,
    p_issue_date: payload.issue_date,
    p_due_date: payload.due_date,
    p_notes: payload.notes,
    p_subtotal: payload.subtotal,
    p_tax: payload.tax,
    p_total: payload.total,
    p_items: payload.items,
  })
  if (error) throw new Error(error.message)
}

export async function cancelInvoice(invoiceId: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: invoiceId })
  if (error) throw new Error(error.message)
}

/** Asigna o desasigna el agente de comisión en una factura */
export async function updateInvoiceAgent(invoiceId: string, agentId: string | null) {
  const supabase = createClient()
  const { error } = await supabase
    .from('invoices')
    .update({ agent_id: agentId })
    .eq('id', invoiceId)
  if (error) throw new Error(error.message)
}

// ─── TICKET POS DIRECTO ────────────────────────────────────────────────────

export type CreateTicketPayload = {
  company_id: string
  customer_id: string | null
  issue_date: string
  notes: string | null
  subtotal: number
  tax: number
  total: number
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    discount: number
    tax_rate: number
    subtotal: number
    tax: number
    total: number
  }>
}

export async function createTicketWithItems(payload: CreateTicketPayload): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_ticket_with_items', {
    p_company_id:  payload.company_id,
    p_customer_id: payload.customer_id,
    p_issue_date:  payload.issue_date,
    p_notes:       payload.notes,
    p_subtotal:    payload.subtotal,
    p_tax:         payload.tax,
    p_total:       payload.total,
    p_items:       payload.items,
  })
  if (error) throw new Error(error.message)
  return data as string
}

// ─── NOTAS CRÉDITO / DÉBITO ───────────────────────────────────────────────

export type CreditDebitNote = {
  id:          string
  company_id:  string
  invoice_id:  string
  note_number: string
  type:        'credit' | 'debit'
  reason:      string
  issue_date:  string
  subtotal:    number
  tax:         number
  total:       number
  notes:       string | null
  status:      'issued' | 'cancelled'
  created_at:  string
}

export type CreditDebitNoteItem = {
  id:           string
  note_id:      string
  product_id:   string | null
  product_name: string
  sku:          string | null
  quantity:     number
  unit_price:   number
  discount:     number
  tax_rate:     number
  subtotal:     number
  tax:          number
  total:        number
}

export function useCreditDebitNotes(invoiceId?: string) {
  return useQuery({
    queryKey: ['credit_debit_notes', invoiceId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('credit_debit_notes')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as CreditDebitNote[]
    },
    enabled: !!invoiceId,
  })
}

export function useCreditDebitNoteItems(noteId?: string) {
  return useQuery({
    queryKey: ['credit_debit_note_items', noteId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('credit_debit_note_items')
        .select('*')
        .eq('note_id', noteId!)
      if (error) throw new Error(error.message)
      return (data ?? []) as CreditDebitNoteItem[]
    },
    enabled: !!noteId,
  })
}

export type CreateCreditDebitNotePayload = {
  company_id: string
  invoice_id: string
  type:       'credit' | 'debit'
  reason:     string
  issue_date: string
  subtotal:   number
  tax:        number
  total:      number
  notes?:     string | null
  items: Array<{
    product_id?:  string
    product_name: string
    sku?:         string
    quantity:     number
    unit_price:   number
    discount:     number
    tax_rate:     number
    subtotal:     number
    tax:          number
    total:        number
  }>
}

export async function createCreditDebitNote(payload: CreateCreditDebitNotePayload): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_credit_debit_note', {
    p_company_id: payload.company_id,
    p_invoice_id: payload.invoice_id,
    p_type:       payload.type,
    p_reason:     payload.reason,
    p_issue_date: payload.issue_date,
    p_subtotal:   payload.subtotal,
    p_tax:        payload.tax,
    p_total:      payload.total,
    p_notes:      payload.notes ?? null,
    p_items:      payload.items,
  })
  if (error) throw new Error(error.message)
  return data as string
}
