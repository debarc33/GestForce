'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────

export type PurchaseOrderWithSupplier = {
  id: string
  company_id: string
  supplier_id: string | null
  order_number: string
  issue_date: string
  expected_date: string | null
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'received' | 'cancelled'
  notes: string | null
  created_at: string
  supplier: { id: string; name: string; email: string | null } | null
}

export type SupplierInvoiceWithDetails = {
  id: string
  company_id: string
  supplier_id: string | null
  order_id: string | null
  invoice_number: string
  supplier_invoice_no: string | null
  order_number?: string | null
  issue_date: string
  due_date: string | null
  subtotal: number
  tax: number
  withholding: number
  total: number
  balance_due: number
  status: 'pending' | 'partial' | 'paid' | 'cancelled'
  notes: string | null
  created_at: string
  supplier: { id: string; name: string; email: string | null } | null
}

export type PurchaseOrderItem = {
  id: string
  order_id: string
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

export type SupplierInvoiceItem = {
  id: string
  invoice_id: string
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
}

export type SupplierPayment = {
  id: string
  company_id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function fetchSupplierMap(
  supabase: ReturnType<typeof createClient>,
  supplierIds: string[]
): Promise<Record<string, { id: string; name: string; email: string | null }>> {
  if (supplierIds.length === 0) return {}
  const { data } = await supabase.from('suppliers').select('id, name, email').in('id', supplierIds)
  return Object.fromEntries((data ?? []).map(s => [s.id, { ...s, email: s.email ?? null }]))
}

// ─── ÓRDENES DE COMPRA ────────────────────────────────────────────────────

export function usePurchaseOrders(companyId?: string) {
  return useQuery({
    queryKey: ['purchase_orders', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return []
      const supplierIds = [...new Set(data.map(o => o.supplier_id).filter(Boolean))] as string[]
      const supplierMap = await fetchSupplierMap(supabase, supplierIds)
      return data.map(o => ({
        ...o,
        supplier: o.supplier_id ? (supplierMap[o.supplier_id] ?? null) : null,
      })) as PurchaseOrderWithSupplier[]
    },
    enabled: !!companyId,
  })
}

export function usePurchaseOrder(id?: string) {
  return useQuery({
    queryKey: ['purchase_order', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('purchase_orders').select('*').eq('id', id!).single()
      if (error) throw new Error(error.message)
      let supplier: { id: string; name: string; email: string | null; doc_type: string | null; doc_number: string | null; phone: string | null; address: string | null; city: string | null } | null = null
      if (data.supplier_id) {
        const { data: s } = await supabase
          .from('suppliers')
          .select('id, name, email, doc_type, doc_number, phone, address, city')
          .eq('id', data.supplier_id).single()
        supplier = s ?? null
      }
      return { ...data, supplier } as PurchaseOrderWithSupplier & { supplier: typeof supplier }
    },
    enabled: !!id,
  })
}

export function usePurchaseOrderItems(orderId?: string) {
  return useQuery({
    queryKey: ['purchase_order_items', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('purchase_order_items').select('*').eq('order_id', orderId!).order('id')
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
        product_name: item.product_id ? (productMap[item.product_id]?.name ?? item.product_name) : item.product_name,
        sku:   item.product_id ? (productMap[item.product_id]?.sku ?? null) : null,
        stock: item.product_id ? (productMap[item.product_id]?.stock ?? 0)  : 0,
      })) as PurchaseOrderItem[]
    },
    enabled: !!orderId,
  })
}

export type CreatePurchaseOrderPayload = {
  company_id: string
  supplier_id: string | null
  issue_date: string
  expected_date: string | null
  notes: string | null
  subtotal: number
  tax: number
  total: number
  items: Array<{
    product_id: string
    product_name: string
    sku?: string | null
    quantity: number
    unit_price: number
    discount: number
    tax_rate: number
    subtotal: number
    tax: number
    total: number
  }>
}

export async function createPurchaseOrderWithItems(payload: CreatePurchaseOrderPayload) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_purchase_order_with_items', {
    p_company_id:    payload.company_id,
    p_supplier_id:   payload.supplier_id,
    p_issue_date:    payload.issue_date,
    p_expected_date: payload.expected_date,
    p_notes:         payload.notes,
    p_subtotal:      payload.subtotal,
    p_tax:           payload.tax,
    p_total:         payload.total,
    p_items:         payload.items,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: 'sent' | 'cancelled'
) {
  const supabase = createClient()
  const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function receivePurchaseOrder(orderId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('receive_purchase_order', { p_order_id: orderId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function deletePurchaseOrders(ids: string[]) {
  const supabase = createClient()
  // Solo borradores
  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .in('id', ids)
    .eq('status', 'draft')
  if (error) throw new Error(error.message)
}

// ─── FACTURAS PROVEEDOR ───────────────────────────────────────────────────

export function useSupplierInvoices(companyId?: string) {
  return useQuery({
    queryKey: ['supplier_invoices', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return []
      const supplierIds = [...new Set(data.map(i => i.supplier_id).filter(Boolean))] as string[]
      const supplierMap = await fetchSupplierMap(supabase, supplierIds)
      const orderIds = [...new Set(data.map(i => i.order_id).filter(Boolean))] as string[]
      let orderMap: Record<string, string> = {}
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('purchase_orders').select('id, order_number').in('id', orderIds)
        orderMap = Object.fromEntries((orders ?? []).map(o => [o.id, o.order_number]))
      }
      return data.map(inv => ({
        ...inv,
        supplier: inv.supplier_id ? (supplierMap[inv.supplier_id] ?? null) : null,
        order_number: inv.order_id ? (orderMap[inv.order_id] ?? null) : null,
      })) as SupplierInvoiceWithDetails[]
    },
    enabled: !!companyId,
  })
}

export function useSupplierInvoice(id?: string) {
  return useQuery({
    queryKey: ['supplier_invoice', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier_invoices').select('*').eq('id', id!).single()
      if (error) throw new Error(error.message)
      let supplier: { id: string; name: string; email: string | null; doc_type: string | null; doc_number: string | null; phone: string | null; address: string | null; city: string | null } | null = null
      if (data.supplier_id) {
        const { data: s } = await supabase
          .from('suppliers')
          .select('id, name, email, doc_type, doc_number, phone, address, city')
          .eq('id', data.supplier_id).single()
        supplier = s ?? null
      }
      let order_number: string | null = null
      if (data.order_id) {
        const { data: o } = await supabase
          .from('purchase_orders').select('order_number').eq('id', data.order_id).single()
        order_number = o?.order_number ?? null
      }
      return { ...data, supplier, order_number } as SupplierInvoiceWithDetails & { supplier: typeof supplier }
    },
    enabled: !!id,
  })
}

export function useSupplierInvoiceItems(invoiceId?: string) {
  return useQuery({
    queryKey: ['supplier_invoice_items', invoiceId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier_invoice_items').select('*').eq('invoice_id', invoiceId!).order('id')
      if (error) throw new Error(error.message)
      return (data ?? []) as SupplierInvoiceItem[]
    },
    enabled: !!invoiceId,
  })
}

export function useSupplierPayments(invoiceId?: string) {
  return useQuery({
    queryKey: ['supplier_payments', invoiceId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .order('payment_date', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as SupplierPayment[]
    },
    enabled: !!invoiceId,
  })
}

export async function registerSupplierPayment(payload: {
  company_id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_method?: string
  reference?: string
  notes?: string
}) {
  const supabase = createClient()
  const { error } = await supabase.rpc('register_supplier_payment', {
    p_invoice_id:     payload.invoice_id,
    p_company_id:     payload.company_id,
    p_payment_date:   payload.payment_date,
    p_amount:         payload.amount,
    p_payment_method: payload.payment_method ?? null,
    p_reference:      payload.reference      ?? null,
    p_notes:          payload.notes          ?? null,
  })
  if (error) throw new Error(error.message)
}

// ─── OC relacionada a factura de proveedor ────────────────────────────────

export function useSupplierInvoiceByOrderId(orderId?: string) {
  return useQuery({
    queryKey: ['supplier_invoice_by_order', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('supplier_invoices')
        .select('id, invoice_number, status')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    enabled: !!orderId,
  })
}
