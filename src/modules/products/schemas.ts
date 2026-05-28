import { z } from 'zod'

export const UNITS = [
  { value: 'und',    label: 'Unidad (und)' },
  { value: 'kg',     label: 'Kilogramo (kg)' },
  { value: 'g',      label: 'Gramo (g)' },
  { value: 'lt',     label: 'Litro (lt)' },
  { value: 'ml',     label: 'Mililitro (ml)' },
  { value: 'm',      label: 'Metro (m)' },
  { value: 'm2',     label: 'Metro cuadrado (m²)' },
  { value: 'm3',     label: 'Metro cúbico (m³)' },
  { value: 'caja',   label: 'Caja' },
  { value: 'par',    label: 'Par' },
  { value: 'docena', label: 'Docena' },
  { value: 'hora',   label: 'Hora' },
  { value: 'otro',   label: 'Otro' },
] as const

export const categoryFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
})

export const categoryInsertSchema = categoryFormSchema.extend({
  company_id: z.string().uuid(),
})

export type CategoryFormValues   = z.infer<typeof categoryFormSchema>
export type CategoryInsertValues = z.infer<typeof categoryInsertSchema>

export const productFormSchema = z.object({
  name:        z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  sku:         z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  price:       z.coerce.number().min(0, 'El precio no puede ser negativo'),
  stock:         z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
  stock_minimum: z.coerce.number().int().min(0, 'El stock mínimo no puede ser negativo').default(0),
  unit:          z.string().default('und'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  tax_type:    z.enum(['iva', 'excluded', 'exempt', 'no_tax']).default('iva'),
  tax_rate:    z.coerce.number().min(0).max(1).default(0.19),
  is_taxable:  z.boolean().default(true),
})

export const productInsertSchema = productFormSchema.extend({
  company_id: z.string().uuid(),
})

export type ProductFormValues   = z.infer<typeof productFormSchema>
export type ProductInsertValues = z.infer<typeof productInsertSchema>
