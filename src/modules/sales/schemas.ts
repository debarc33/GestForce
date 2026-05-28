import { z } from 'zod'

// ─── Ítem compartido (cotización / factura) ───────────────────────────────

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  sku: z.string().nullable().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unit_price: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).default(0),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  stock: z.number(),
})

// ─── Cotización ───────────────────────────────────────────────────────────

export const quoteFormSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  issue_date: z.string().min(1, 'La fecha de emisión es requerida'),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Agrega al menos un producto'),
})

// ─── Medio de pago ────────────────────────────────────────────────────────

export const paymentMethodSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['cash', 'transfer', 'card', 'check', 'other']),
  is_active: z.boolean().default(true),
})

// ─── Abono (registro de pago parcial) ─────────────────────────────────────

export const receiptPaymentSchema = z.object({
  payment_method_id: z.string().uuid('Selecciona un medio de pago'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  payment_date: z.string().min(1, 'La fecha es requerida'),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// ─── Tipos inferidos ──────────────────────────────────────────────────────

export type SaleItemValues = z.infer<typeof saleItemSchema>
export type QuoteFormValues = z.infer<typeof quoteFormSchema>
export type PaymentMethodValues = z.infer<typeof paymentMethodSchema>
export type ReceiptPaymentValues = z.infer<typeof receiptPaymentSchema>

// Alias por compatibilidad con código anterior
export type InvoiceItemValues = SaleItemValues
