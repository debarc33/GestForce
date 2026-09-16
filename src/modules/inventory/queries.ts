'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────

export type MovementType =
  | 'purchase'    // entrada por compra / OC recibida
  | 'sale'        // salida por venta / factura emitida
  | 'adjustment'  // ajuste manual (conteo físico)
  | 'return_in'   // devolución de cliente (entrada)
  | 'return_out'  // devolución a proveedor (salida)

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase:   'Compra',
  sale:       'Venta',
  adjustment: 'Ajuste',
  return_in:  'Devolución entrada',
  return_out: 'Devolución salida',
}

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  purchase:   'bg-green-100 text-green-700',
  sale:       'bg-red-100 text-red-700',
  adjustment: 'bg-blue-100 text-blue-700',
  return_in:  'bg-teal-100 text-teal-700',
  return_out: 'bg-orange-100 text-orange-700',
}

export type InventoryMovement = {
  id:            string
  company_id:    string
  product_id:    string
  movement_type: MovementType
  quantity:      number    // + entrada, - salida
  stock_before:  number
  stock_after:   number
  unit_cost:     number | null
  reference_id:  string | null
  reference_no:  string | null
  notes:         string | null
  created_by:    string | null
  created_at:    string
  // joined
  product?: {
    id: string
    name: string
    sku: string | null
    unit: string | null
    stock: number
    stock_minimum: number | null
  }
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useInventoryMovements(
  companyId?: string | null,
  productId?: string | null,
  limit = 200,
) {
  return useQuery({
    queryKey: ['inventory_movements', companyId, productId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('inventory_movements')
        .select(`
          *,
          product:products ( id, name, sku, unit, stock, stock_minimum )
        `)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (productId) q = q.eq('product_id', productId)

      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as InventoryMovement[]
    },
    enabled: !!companyId,
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Crea un ajuste manual: calcula la diferencia vs el stock actual,
 * registra un movimiento tipo 'adjustment' y actualiza products.stock.
 */
export async function createAdjustment(
  companyId: string,
  productId: string,
  newQty: number,
  notes: string,
  createdBy?: string,
) {
  const supabase = createClient()

  // 1. Stock actual del producto
  const { data: prod, error: e1 } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()
  if (e1) throw new Error(e1.message)

  const stockBefore = Number(prod.stock ?? 0)
  const diff        = newQty - stockBefore

  // 2. Insertar movimiento
  const { error: e2 } = await supabase
    .from('inventory_movements')
    .insert({
      company_id:    companyId,
      product_id:    productId,
      movement_type: 'adjustment',
      quantity:      diff,
      stock_before:  stockBefore,
      stock_after:   newQty,
      notes:         notes || null,
      created_by:    createdBy ?? null,
    })
  if (e2) throw new Error(e2.message)

  // 3. Actualizar stock en products
  const { error: e3 } = await supabase
    .from('products')
    .update({ stock: newQty })
    .eq('id', productId)
  if (e3) throw new Error(e3.message)
}

/**
 * Registra una entrada por compra (llamado desde OC recibida).
 */
export async function recordPurchaseEntry(
  companyId: string,
  productId: string,
  quantity: number,
  unitCost: number | null,
  referenceId: string | null,
  referenceNo: string | null,
) {
  const supabase = createClient()

  const { data: prod, error: e1 } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()
  if (e1) throw new Error(e1.message)

  const stockBefore = Number(prod.stock ?? 0)
  const stockAfter  = stockBefore + quantity

  const { error: e2 } = await supabase
    .from('inventory_movements')
    .insert({
      company_id:    companyId,
      product_id:    productId,
      movement_type: 'purchase',
      quantity,
      stock_before:  stockBefore,
      stock_after:   stockAfter,
      unit_cost:     unitCost,
      reference_id:  referenceId,
      reference_no:  referenceNo,
    })
  if (e2) throw new Error(e2.message)

  const { error: e3 } = await supabase
    .from('products')
    .update({ stock: stockAfter })
    .eq('id', productId)
  if (e3) throw new Error(e3.message)
}

/**
 * Registra una salida por venta (llamado desde factura emitida).
 */
export async function recordSaleExit(
  companyId: string,
  productId: string,
  quantity: number,
  referenceId: string | null,
  referenceNo: string | null,
) {
  const supabase = createClient()

  const { data: prod, error: e1 } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()
  if (e1) throw new Error(e1.message)

  const stockBefore = Number(prod.stock ?? 0)
  const stockAfter  = stockBefore - quantity

  const { error: e2 } = await supabase
    .from('inventory_movements')
    .insert({
      company_id:    companyId,
      product_id:    productId,
      movement_type: 'sale',
      quantity:      -quantity,
      stock_before:  stockBefore,
      stock_after:   stockAfter,
      reference_id:  referenceId,
      reference_no:  referenceNo,
    })
  if (e2) throw new Error(e2.message)

  const { error: e3 } = await supabase
    .from('products')
    .update({ stock: stockAfter })
    .eq('id', productId)
  if (e3) throw new Error(e3.message)
}
