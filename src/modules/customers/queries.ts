'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CustomerInsertValues, CustomerFormValues } from './schemas'

export async function createCustomer(data: CustomerInsertValues) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('customers')
    .insert([{
      company_id:    data.company_id,
      name:          data.name,
      doc_type:      data.doc_type,
      doc_number:    data.doc_number   || null,
      email:         data.email        || null,
      phone:         data.phone        || null,
      address:       data.address      || null,
      city:          data.city         || null,
      department:    data.department   || null,
      fiscal_regime: data.fiscal_regime,
      payment_type:  data.payment_type || null,
      credit_days:   data.credit_days  ?? null,
      referencia:    data.referencia   ? data.referencia.toUpperCase() : null,
    }])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('ref')) throw new Error('Ya existe un cliente con esa Referencia en esta empresa.')
      throw new Error('Ya existe un cliente con ese número de documento en esta empresa.')
    }
    throw new Error(error.message)
  }
  return result
}

export async function updateCustomer(id: string, data: Partial<CustomerFormValues>) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('customers')
    .update({
      name:          data.name,
      doc_type:      data.doc_type,
      doc_number:    data.doc_number   || null,
      email:         data.email        || null,
      phone:         data.phone        || null,
      address:       data.address      || null,
      city:          data.city         || null,
      department:    data.department   || null,
      fiscal_regime: data.fiscal_regime,
      payment_type:  data.payment_type || null,
      credit_days:   data.credit_days  ?? null,
      referencia:    data.referencia   ? data.referencia.toUpperCase() : null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('ref')) throw new Error('Ya existe un cliente con esa Referencia en esta empresa.')
      throw new Error('Ya existe un cliente con ese número de documento en esta empresa.')
    }
    throw new Error(error.message)
  }
  return result
}

export function useCustomers(companyId?: string) {
  return useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Usuario no autenticado.')

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')

      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: !!companyId,
  })
}

export async function deleteCustomers(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('customers').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

/** Retorna los IDs de clientes que tienen al menos un documento asociado (cotización, factura o recibo) */
export async function getCustomersWithDocuments(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const supabase = createClient()
  const [q, inv, rec] = await Promise.all([
    supabase.from('quotes').select('customer_id').in('customer_id', ids),
    supabase.from('invoices').select('customer_id').in('customer_id', ids),
    supabase.from('receipts').select('customer_id').in('customer_id', ids),
  ])
  const withDocs = new Set([
    ...(q.data ?? []).map(r => r.customer_id).filter(Boolean),
    ...(inv.data ?? []).map(r => r.customer_id).filter(Boolean),
    ...(rec.data ?? []).map(r => r.customer_id).filter(Boolean),
  ])
  return ids.filter(id => withDocs.has(id))
}
