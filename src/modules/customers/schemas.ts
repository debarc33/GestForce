import { z } from 'zod'

export const DOC_TYPES = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
  { value: 'RC',  label: 'Registro Civil' },
  { value: 'TE',  label: 'Tarjeta de Extranjería' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
] as const

export const FISCAL_REGIMES = [
  { value: 'no_iva',             label: 'No Responsable de IVA' },
  { value: 'iva',                label: 'Responsable de IVA' },
  { value: 'gran_contribuyente', label: 'Gran Contribuyente' },
] as const

export const customerFormSchema = z.object({
  name:          z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  doc_type:      z.enum(['CC','NIT','CE','PA','TI','RC','TE','PEP']).default('CC'),
  doc_number:    z.string().min(3, 'El número de identificación es requerido'),
  email:         z.string().email('Email inválido').optional().or(z.literal('')),
  phone:         z.string().min(7, 'El celular es requerido'),
  address:       z.string().optional().or(z.literal('')),
  city:          z.string().optional().or(z.literal('')),
  department:    z.string().optional().or(z.literal('')),
  fiscal_regime: z.enum(['iva','no_iva','gran_contribuyente']).default('no_iva'),
  payment_type:  z.string().optional().or(z.literal('')),
  credit_days:   z.coerce.number().int().min(0).optional(),
  referencia:    z.string().optional().or(z.literal('')),
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>

export const customerInsertSchema = customerFormSchema.extend({
  company_id: z.string().uuid('ID de compañía inválido'),
})

export type CustomerInsertValues = z.infer<typeof customerInsertSchema>
