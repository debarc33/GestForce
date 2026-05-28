import { z } from 'zod'

export const DOC_TYPES = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'TE',  label: 'Tarjeta de Extranjería' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
] as const

export const FISCAL_REGIMES = [
  { value: 'no_iva',             label: 'No Responsable de IVA' },
  { value: 'iva',                label: 'Responsable de IVA' },
  { value: 'gran_contribuyente', label: 'Gran Contribuyente' },
] as const

export const supplierFormSchema = z.object({
  name:              z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  doc_type:          z.enum(['NIT','CC','CE','PA','TE','PEP']).default('NIT'),
  doc_number:        z.string().optional().or(z.literal('')),
  email:             z.string().email('Email inválido').optional().or(z.literal('')),
  phone:             z.string().optional().or(z.literal('')),
  address:           z.string().optional().or(z.literal('')),
  city:              z.string().optional().or(z.literal('')),
  department:        z.string().optional().or(z.literal('')),
  fiscal_regime:     z.enum(['iva','no_iva','gran_contribuyente']).default('no_iva'),
  contact_name:      z.string().optional().or(z.literal('')),
  payment_days:      z.coerce.number().int().min(0).optional(),
  notes:             z.string().optional().or(z.literal('')),
  // Medios de pago
  payment_cash:     z.boolean().default(false),
  payment_transfer: z.boolean().default(false),
})

export type SupplierFormValues = z.infer<typeof supplierFormSchema>

export const supplierInsertSchema = supplierFormSchema.extend({
  company_id: z.string().uuid('ID de compañía inválido'),
})

export type SupplierInsertValues = z.infer<typeof supplierInsertSchema>
