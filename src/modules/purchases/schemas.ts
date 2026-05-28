import { z } from 'zod'

// ─── Ítem de compra ───────────────────────────────────────────────────────

export const purchaseItemSchema = z.object({
  product_id:   z.string().uuid(),
  product_name: z.string(),
  sku:          z.string().nullable().optional(),
  quantity:     z.number().positive('La cantidad debe ser mayor a 0'),
  unit_price:   z.number().min(0),
  discount:     z.number().min(0).max(100).default(0),
  tax_rate:     z.number().min(0).default(0),
  subtotal:     z.number(),
  tax:          z.number(),
  total:        z.number(),
  stock:        z.number(),
})

// ─── Orden de compra ──────────────────────────────────────────────────────

export const purchaseOrderSchema = z.object({
  supplier_id:   z.string().uuid().nullable().optional(),
  issue_date:    z.string().min(1, 'La fecha de emisión es requerida'),
  expected_date: z.string().optional(),
  notes:         z.string().optional(),
  items:         z.array(purchaseItemSchema).min(1, 'Agrega al menos un producto'),
})

// ─── Pago a proveedor ─────────────────────────────────────────────────────

export const supplierPaymentSchema = z.object({
  payment_date:   z.string().min(1, 'La fecha es requerida'),
  amount:         z.number().positive('El monto debe ser mayor a 0'),
  payment_method: z.string().optional(),
  reference:      z.string().optional(),
  notes:          z.string().optional(),
})

// ─── Tipos ────────────────────────────────────────────────────────────────

export type PurchaseItemValues    = z.infer<typeof purchaseItemSchema>
export type PurchaseOrderValues   = z.infer<typeof purchaseOrderSchema>
export type SupplierPaymentValues = z.infer<typeof supplierPaymentSchema>
