'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SupplierInsertValues, SupplierFormValues } from './schemas'

export type SupplierRow = {
  id: string
  company_id: string
  name: string
  doc_type: string
  doc_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  fiscal_regime: string
  contact_name: string | null
  payment_days: number | null
  notes: string | null
  payment_cash: boolean
  payment_transfer: boolean
  created_at: string
}

export type SupplierBankAccount = {
  id: string
  supplier_id: string
  bank_name: string
  account_type: string
  account_number: string
  label: string | null
  created_at: string
}

// ─── CRUD Proveedores ─────────────────────────────────────────────────────

export async function createSupplier(data: SupplierInsertValues) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('suppliers')
    .insert([{
      company_id:       data.company_id,
      name:             data.name,
      doc_type:         data.doc_type,
      doc_number:       data.doc_number   || null,
      email:            data.email        || null,
      phone:            data.phone        || null,
      address:          data.address      || null,
      city:             data.city         || null,
      department:       data.department   || null,
      fiscal_regime:    data.fiscal_regime,
      contact_name:     data.contact_name || null,
      payment_days:     data.payment_days ?? 30,
      notes:            data.notes        || null,
      payment_cash:     data.payment_cash     ?? false,
      payment_transfer: data.payment_transfer ?? false,
    }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return result
}

export async function updateSupplier(id: string, data: Partial<SupplierFormValues>) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('suppliers')
    .update({
      name:             data.name,
      doc_type:         data.doc_type,
      doc_number:       data.doc_number   || null,
      email:            data.email        || null,
      phone:            data.phone        || null,
      address:          data.address      || null,
      city:             data.city         || null,
      department:       data.department   || null,
      fiscal_regime:    data.fiscal_regime,
      contact_name:     data.contact_name || null,
      payment_days:     data.payment_days ?? 30,
      notes:            data.notes        || null,
      payment_cash:     data.payment_cash     ?? false,
      payment_transfer: data.payment_transfer ?? false,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return result
}

export function useSuppliers(companyId?: string) {
  return useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as SupplierRow[]
    },
    enabled: !!companyId,
  })
}

export async function deleteSuppliers(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('suppliers').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

/** Retorna los IDs de proveedores que tienen al menos una OC o factura asociada */
export async function getSuppliersWithDocuments(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const supabase = createClient()
  const [po, si] = await Promise.all([
    supabase.from('purchase_orders').select('supplier_id').in('supplier_id', ids),
    supabase.from('supplier_invoices').select('supplier_id').in('supplier_id', ids),
  ])
  const withDocs = new Set([
    ...(po.data ?? []).map(r => r.supplier_id).filter(Boolean),
    ...(si.data ?? []).map(r => r.supplier_id).filter(Boolean),
  ])
  return ids.filter(id => withDocs.has(id))
}

// ─── Productos comprados a este proveedor (vista de proveedor) ──────────
// Punto 2 del backlog, 27 oct 2026 -- qué le compras y a qué precio. Lee
// de `producto_proveedores` (migración 030), que `receive_purchase_order`
// (migración 031) actualiza sola cada vez que se recibe una compra de ese
// proveedor. Es de solo lectura.

export type SupplierProductRow = {
  product_id:   string
  product_name: string
  sku:          string | null
  price:        number
  updated_at:   string
}

export function useSupplierProducts(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier_products', supplierId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('producto_proveedores')
        .select('product_id, price, updated_at')
        .eq('supplier_id', supplierId!)
        .order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      const rows = data ?? []
      if (rows.length === 0) return []

      const productIds = [...new Set(rows.map(r => r.product_id))]
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds)
      const productMap = Object.fromEntries(
        (prods ?? []).map(p => [p.id, { name: p.name as string, sku: p.sku as string | null }])
      )

      return rows.map(r => ({
        product_id:   r.product_id,
        product_name: productMap[r.product_id]?.name ?? 'Producto eliminado',
        sku:          productMap[r.product_id]?.sku ?? null,
        price:        Number(r.price),
        updated_at:   r.updated_at,
      })) as SupplierProductRow[]
    },
    enabled: !!supplierId,
  })
}

// ─── Cuentas bancarias del proveedor ─────────────────────────────────────

export function useSupplierBankAccounts(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier_bank_accounts', supplierId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier_bank_accounts')
        .select('*')
        .eq('supplier_id', supplierId!)
        .order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []) as SupplierBankAccount[]
    },
    enabled: !!supplierId,
  })
}

export type BankAccountInput = {
  bank_name: string
  account_type: string
  account_number: string
  label: string
}

/**
 * Reemplaza todas las cuentas bancarias del proveedor.
 * Borra las existentes e inserta las nuevas en una sola operación.
 */
export async function saveSupplierBankAccounts(
  supplierId: string,
  accounts: BankAccountInput[]
) {
  const supabase = createClient()

  // 1. Borrar todas las cuentas actuales
  const { error: delError } = await supabase
    .from('supplier_bank_accounts')
    .delete()
    .eq('supplier_id', supplierId)
  if (delError) throw new Error(delError.message)

  // 2. Insertar las nuevas (si hay alguna)
  if (accounts.length === 0) return

  const rows = accounts.map(a => ({
    supplier_id:    supplierId,
    bank_name:      a.bank_name,
    account_type:   a.account_type,
    account_number: a.account_number,
    label:          a.label || null,
  }))

  const { error: insError } = await supabase
    .from('supplier_bank_accounts')
    .insert(rows)
  if (insError) throw new Error(insError.message)
}
