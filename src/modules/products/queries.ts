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
  const { data: result, error } = await supabase
    .from('categories')
    .insert({ company_id: data.company_id, name: data.name })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result
}

/**
 * Renombrar una categoría existente.
 */
export async function updateCategory(id: string, name: string) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')
  const { data: result, error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result
}

/**
 * Eliminar una categoría. El llamador debe verificar antes (con
 * useCategoriesWithCounts) que no tenga productos asignados -- se
 * bloquea en la UI, no aquí, para poder mostrar cuántos productos la
 * usan antes de intentar el borrado.
 */
export async function deleteCategory(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type CategoryWithCount = {
  id: string
  company_id: string
  name: string
  created_at?: string
  /** Consecutivo por orden de creación (1, 2, 3...), solo para mostrar. */
  seq: number
  /** Cantidad de productos que usan esta categoría. */
  product_count: number
}

/**
 * Categorías de la empresa con numeración consecutiva (por orden de
 * creación) y cantidad de productos asignados a cada una. Usado por la
 * pantalla de gestión de categorías (listar / renombrar / eliminar).
 */
export function useCategoriesWithCounts(companyId?: string) {
  return useQuery({
    queryKey: ['categories_with_counts', companyId],
    queryFn: async (): Promise<CategoryWithCount[]> => {
      const supabase = createClient()

      // No se ordena por `created_at` en la consulta: la tabla `categories`
      // se creó a mano (no aparece en ninguna migración versionada, a
      // diferencia de `expense_categories`, que sí es una tabla migrada)
      // y de hecho NO tiene columna `created_at` -- se confirmó con una
      // consulta directa (23 oct 2026): las filas solo traen id,
      // company_id y name. Un `.order('created_at', ...)` hace fallar la
      // consulta completa con "column categories.created_at does not
      // exist", y como el error no se mostraba en pantalla, se veía como
      // si la lista estuviera vacía o "cargando" para siempre.
      const { data: cats, error: catsError } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId!)
      if (catsError) throw new Error(catsError.message)

      const rows = cats ?? []
      const hasCreatedAt = rows.every(c => typeof c.created_at === 'string' && c.created_at)
      const ordered = [...rows].sort((a, b) =>
        hasCreatedAt
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : String(a.name).localeCompare(String(b.name))
      )

      const { data: prods, error: prodsError } = await supabase
        .from('products')
        .select('category_id')
        .eq('company_id', companyId!)
      if (prodsError) throw new Error(prodsError.message)

      const counts = new Map<string, number>()
      for (const p of prods ?? []) {
        if (!p.category_id) continue
        counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
      }

      return ordered.map((c, i) => ({
        ...c,
        seq: i + 1,
        product_count: counts.get(c.id) ?? 0,
      }))
    },
    enabled: !!companyId,
    // Si algo falla (por ejemplo una columna que no existe), que se vea
    // el error rápido en vez de quedarse "cargando" varios segundos
    // mientras React Query reintenta con su backoff por defecto.
    retry: 1,
  })
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

/**
 * IDs, de entre los dados, que tienen historial real asociado (cotizaciones,
 * facturas, órdenes de compra o movimientos de inventario) — para bloquear su
 * eliminación, igual que ya se hace con Clientes (getCustomersWithDocuments).
 */
export async function getProductsWithDocuments(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const supabase = createClient()
  const [q, inv, po, mov] = await Promise.all([
    supabase.from('quote_items').select('product_id').in('product_id', ids),
    supabase.from('invoice_items').select('product_id').in('product_id', ids),
    supabase.from('purchase_order_items').select('product_id').in('product_id', ids),
    supabase.from('inventory_movements').select('product_id').in('product_id', ids),
  ])
  const withDocs = new Set([
    ...(q.data ?? []).map(r => r.product_id).filter(Boolean),
    ...(inv.data ?? []).map(r => r.product_id).filter(Boolean),
    ...(po.data ?? []).map(r => r.product_id).filter(Boolean),
    ...(mov.data ?? []).map(r => r.product_id).filter(Boolean),
  ])
  return ids.filter(id => withDocs.has(id))
}

/**
 * ¿Este producto está en nivel de "bajo stock / por reponer"? Si tiene un
 * stock mínimo configurado (`stock_minimum > 0`) se usa ese umbral real; si
 * no tiene uno configurado, se usa un umbral genérico (10 unidades) como
 * referencia. No incluye "sin stock" (stock === 0), que es su propia
 * categoría aparte.
 */
export function isLowStock(stock: number, stockMinimum?: number | null): boolean {
  if (stock <= 0) return false
  const min = stockMinimum ?? 0
  return min > 0 ? stock <= min : stock < 10
}
