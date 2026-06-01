import { z } from 'zod'

// ─── Cuentas PUC de gastos disponibles para categorías ───────────────────────

export const GASTO_ACCOUNTS = [
  { code: '5195',   label: '5195 — Diversos' },
  { code: '5155',   label: '5155 — Gastos de viaje' },
  { code: '5240',   label: '5240 — Publicidad y promoción' },
  { code: '510506', label: '510506 — Sueldos y salarios' },
  { code: '5105',   label: '5105 — Gastos de personal' },
  { code: '51',     label: '51 — Operacionales de administración' },
] as const

export const PAYMENT_METHODS = [
  { value: 'efectivo',     label: 'Efectivo' },
  { value: 'transferencia',label: 'Transferencia bancaria' },
  { value: 'tarjeta',      label: 'Tarjeta' },
  { value: 'otro',         label: 'Otro' },
] as const

export const FREQUENCIES = [
  { value: 'mensual',     label: 'Mensual' },
  { value: 'trimestral',  label: 'Trimestral' },
  { value: 'semestral',   label: 'Semestral' },
  { value: 'anual',       label: 'Anual' },
] as const

// ─── Categoría ────────────────────────────────────────────────────────────────

export const categoryFormSchema = z.object({
  name:         z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  type:         z.enum(['fijo', 'variable']),
  account_code: z.string().min(1, 'Selecciona una cuenta contable'),
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

// ─── Gasto individual ─────────────────────────────────────────────────────────

export const expenseFormSchema = z.object({
  category_id:            z.string().uuid('Selecciona una categoría').or(z.literal('')),
  expense_date:           z.string().min(1, 'La fecha es requerida'),
  description:            z.string().min(2, 'La descripción debe tener al menos 2 caracteres'),
  amount:                 z.coerce.number().positive('El monto debe ser mayor a 0'),
  payment_method:         z.enum(['efectivo','transferencia','tarjeta','otro']).default('transferencia'),
  status:                 z.enum(['pagado','pendiente']).default('pagado'),
  notes:                  z.string().optional().or(z.literal('')),
  create_journal_entry:   z.boolean().default(false),
  // Recurrente
  is_recurring:           z.boolean().default(false),
  frequency:              z.enum(['mensual','trimestral','semestral','anual']).optional(),
  day_of_month:           z.coerce.number().int().min(1).max(28).optional(),
  end_date:               z.string().optional().or(z.literal('')),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

// ─── Plantilla recurrente ─────────────────────────────────────────────────────

export const recurringFormSchema = z.object({
  category_id:    z.string().uuid('Selecciona una categoría').or(z.literal('')),
  description:    z.string().min(2, 'La descripción debe tener al menos 2 caracteres'),
  amount:         z.coerce.number().positive('El monto debe ser mayor a 0'),
  frequency:      z.enum(['mensual','trimestral','semestral','anual']).default('mensual'),
  day_of_month:   z.coerce.number().int().min(1).max(28).default(1),
  start_date:     z.string().min(1, 'La fecha de inicio es requerida'),
  end_date:       z.string().optional().or(z.literal('')),
  payment_method: z.enum(['efectivo','transferencia','tarjeta','otro']).default('transferencia'),
  notes:          z.string().optional().or(z.literal('')),
})

export type RecurringFormValues = z.infer<typeof recurringFormSchema>
