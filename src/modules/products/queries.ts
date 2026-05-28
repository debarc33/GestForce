'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CategoryInsertValues, ProductInsertValues } from './schemas'

// ─── CATEGORIES ────────────────────────────────────────────────

export function useCategories(companyId?: string) {
  return useQuery({
    queryKey: ['categories', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: !!companyId,
  })
}

export async function createCategory(data: CategoryInsertValues) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')
  const { error } = await supabase
    .from('categories')
    .insert({ company_id: data.company_id, name: data.name })
  if (error) throw new Error(error.message)
}

// ─── PRODUCTS ──────────────────────────────────────────────────

export function useProducts(companyId?: string) {
  return useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (productsError) throw new Error(productsError.message)
      if (!products || products.length === 0) return []

      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('company_id', companyId!)

      const categoryMap = Object.fromEntries(
        (categories ?? []).map(c => [c.id, c])
      )

      return products.map(p => ({
        ...p,
        categories: p.category_id ? (categoryMap[p.category_id] ?? null) : null,
      }))
    },
    enabled: !!companyId,
  })
}

export async function createProduct(data: ProductInsertValues) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('products')
    .insert({
      company_id:  data.company_id,
      category_id: data.category_id || null,
      name:        data.name,
      sku:         data.sku         || null,
      description: data.description || null,
      price:       data.price,
      stock:         data.stock,
      stock_minimum: data.stock_minimum ?? 0,
      unit:          data.unit        || 'und',
      tax_type:      data.tax_type,
      tax_rate:      data.tax_rate,
      is_taxable:    data.is_taxable,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return result
}

export async function updateProduct(id: string, data: Partial<ProductInsertValues>) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('products')
    .update({
      category_id: data.category_id || null,
      name:        data.name,
      sku:         data.sku         || null,
      description: data.description || null,
      price:       data.price,
      stock:         data.stock,
      stock_minimum: data.stock_minimum ?? 0,
      unit:          data.unit        || 'und',
      tax_type:      data.tax_type,
      tax_rate:      data.tax_rate,
      is_taxable:    data.is_taxable,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return result
}

export async function deleteProducts(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().in('id', ids)
  if (error) throw new Error(error.message)
}
