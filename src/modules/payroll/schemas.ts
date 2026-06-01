import { z } from 'zod'

export const CONTRACT_TYPES = [
  { value: 'indefinido',   label: 'Término indefinido' },
  { value: 'fijo',         label: 'Término fijo' },
  { value: 'obra_labor',   label: 'Obra o labor' },
  { value: 'aprendizaje',  label: 'Contrato de aprendizaje' },
  { value: 'comision',     label: 'Por comisión' },
] as const

export const DOC_TYPES = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
] as const

export const ARL_RATES = [
  { value: 0.00522,  label: 'Clase I — 0.522% (oficina, administrativa)' },
  { value: 0.01044,  label: 'Clase II — 1.044% (ventas, mensajería)' },
  { value: 0.02436,  label: 'Clase III — 2.436% (industria, mecánica)' },
  { value: 0.04350,  label: 'Clase IV — 4.350% (construcción, minería)' },
  { value: 0.06960,  label: 'Clase V — 6.960% (alto riesgo)' },
] as const

export const ABSENCE_TYPES = [
  { value: 'incapacidad_eps',       label: 'Incapacidad EPS',         affects_salary: false },
  { value: 'falta_injustificada',   label: 'Falta injustificada',     affects_salary: true  },
  { value: 'permiso_remunerado',    label: 'Permiso remunerado',      affects_salary: false },
  { value: 'permiso_no_remunerado', label: 'Permiso no remunerado',   affects_salary: true  },
  { value: 'licencia_maternidad',   label: 'Licencia de maternidad',  affects_salary: false },
  { value: 'licencia_paternidad',   label: 'Licencia de paternidad',  affects_salary: false },
  { value: 'licencia_luto',         label: 'Licencia de luto',        affects_salary: false },
  { value: 'vacaciones',            label: 'Vacaciones tomadas',      affects_salary: false },
] as const

export const employeeFormSchema = z.object({
  name:               z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  doc_type:           z.enum(['CC','CE','PA','TI','PEP']).default('CC'),
  doc_number:         z.string().optional().or(z.literal('')),
  birth_date:         z.string().optional().or(z.literal('')),
  position:           z.string().optional().or(z.literal('')),
  department:         z.string().optional().or(z.literal('')),
  hire_date:          z.string().min(1, 'La fecha de ingreso es requerida'),
  contract_type:      z.enum(['indefinido','fijo','obra_labor','aprendizaje','comision']).default('indefinido'),
  salary:             z.coerce.number().min(0, 'El salario no puede ser negativo'),
  commission_rate:    z.coerce.number().min(0).max(100).optional().nullable(),
  is_active:          z.boolean().default(true),
  eps_name:           z.string().optional().or(z.literal('')),
  afp_name:           z.string().optional().or(z.literal('')),
  arl_rate:           z.coerce.number().default(0.00522),
  ccf_name:           z.string().optional().or(z.literal('')),
  bank_name:          z.string().optional().or(z.literal('')),
  bank_account_type:  z.string().optional().or(z.literal('')),
  bank_account_number:z.string().optional().or(z.literal('')),
  notes:              z.string().optional().or(z.literal('')),
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export const employeeInsertSchema = employeeFormSchema.extend({
  company_id: z.string().uuid(),
})

export type EmployeeInsertValues = z.infer<typeof employeeInsertSchema>

// ── Novedades de nómina (para editar una fila de liquidación) ──────────────────

export const payrollNovedadesSchema = z.object({
  // Tiempo trabajado
  worked_days:         z.coerce.number().min(0).max(31).default(30),
  vacation_days_taken: z.coerce.number().min(0).max(31).default(0),
  sick_days:           z.coerce.number().min(0).max(31).default(0),
  unpaid_days:         z.coerce.number().min(0).max(31).default(0),
  // Novedades económicas
  overtime_pay:        z.coerce.number().min(0).default(0),
  bonuses:             z.coerce.number().min(0).default(0),
  other_income:        z.coerce.number().min(0).default(0),
  withholding_tax:     z.coerce.number().min(0).default(0),
  other_deductions:    z.coerce.number().min(0).default(0),
  notes:               z.string().optional().or(z.literal('')),
})

export type PayrollNovedadesValues = z.infer<typeof payrollNovedadesSchema>

// ── Ausencias ─────────────────────────────────────────────────────────────────

export const absenceFormSchema = z.object({
  employee_id:    z.string().uuid('Seleccione un empleado'),
  date_from:      z.string().min(1, 'Fecha de inicio requerida'),
  date_to:        z.string().min(1, 'Fecha de fin requerida'),
  days:           z.coerce.number().min(0.5, 'Mínimo 0.5 días').max(365),
  absence_type:   z.enum([
    'incapacidad_eps','falta_injustificada','permiso_remunerado',
    'permiso_no_remunerado','licencia_maternidad','licencia_paternidad',
    'licencia_luto','vacaciones',
  ]),
  affects_salary: z.boolean().default(false),
  description:    z.string().optional().or(z.literal('')),
  period_id:      z.string().optional().or(z.literal('')),
})

export type AbsenceFormValues = z.infer<typeof absenceFormSchema>

export const absenceInsertSchema = absenceFormSchema.extend({
  company_id: z.string().uuid(),
})

export type AbsenceInsertValues = z.infer<typeof absenceInsertSchema>
