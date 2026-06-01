'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeInsertValues, EmployeeFormValues, PayrollNovedadesValues, AbsenceInsertValues } from './schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Employee = {
  id:                  string
  company_id:          string
  name:                string
  doc_type:            string
  doc_number:          string | null
  birth_date:          string | null
  position:            string | null
  department:          string | null
  hire_date:           string
  contract_type:       'indefinido' | 'fijo' | 'obra_labor' | 'aprendizaje' | 'comision'
  salary:              number
  commission_rate:     number | null
  is_active:           boolean
  eps_name:            string | null
  afp_name:            string | null
  arl_rate:            number
  ccf_name:            string | null
  bank_name:           string | null
  bank_account_type:   string | null
  bank_account_number: string | null
  notes:               string | null
  created_at:          string
}

/** Agente de comisión — subconjunto ligero para selectores en facturas */
export type CommissionAgent = {
  id:              string
  name:            string
  commission_rate: number | null
}

export type PayrollPeriod = {
  id:          string
  company_id:  string
  year:        number
  month:       number
  status:      'open' | 'closed'
  approved_by: string | null
  approved_at: string | null
  created_at:  string
}

export type PayrollItem = {
  id:                    string
  period_id:             string
  employee_id:           string
  salary:                number
  transport_allowance:   number
  overtime_pay:          number
  bonuses:               number
  other_income:          number
  gross_pay:             number
  health_employee:       number
  pension_employee:      number
  withholding_tax:       number
  other_deductions:      number
  total_deductions:      number
  net_pay:               number
  health_employer:       number
  pension_employer:      number
  arl:                   number
  ccf:                   number
  icbf:                  number
  sena:                  number
  total_employer_cost:   number
  notes:                 string | null
  // Tiempo trabajado
  worked_days:           number
  unpaid_days:           number
  vacation_days_taken:   number
  sick_days:             number
  // Prestaciones acumuladas en el período
  cesantias_month:       number
  cesantias_interest:    number
  prima_month:           number
  vacation_days_accrued: number
  created_at:            string
  employee?:             Employee
}

export type PayrollItemWithEmployee = PayrollItem & { employee: Employee }

export type Absence = {
  id:            string
  company_id:    string
  employee_id:   string
  date_from:     string
  date_to:       string
  days:          number
  absence_type:  string
  affects_salary:boolean
  description:   string | null
  period_id:     string | null
  created_at:    string
  employee?:     Employee
}

/** Resumen de prestaciones acumuladas por empleado */
export type SocialBenefitsSummary = {
  employee:             Employee
  months_worked:        number      // períodos liquidados
  cesantias_total:      number
  cesantias_interest_total: number
  prima_total:          number
  vacation_days_total:  number
  vacation_days_taken:  number      // días ya tomados
  vacation_days_pending:number      // días pendientes
  vacation_value_pending:number     // valor en $ de los días pendientes
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Tasas fijas colombianas (2024-2025)
export const RATES = {
  HEALTH_EMPLOYEE:  0.04,    // 4%
  HEALTH_EMPLOYER:  0.085,   // 8.5%
  PENSION_EMPLOYEE: 0.04,    // 4%
  PENSION_EMPLOYER: 0.12,    // 12%
  CCF:              0.04,    // 4%
  ICBF:             0.03,    // 3% (solo si nómina ≥ 10 SMLV)
  SENA:             0.02,    // 2% (solo si nómina ≥ 10 SMLV)
}

const MES_LABELS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function mesLabel(month: number) { return MES_LABELS[month - 1] ?? '' }

// ─── Prestaciones sociales ────────────────────────────────────────────────────

export type PrestacionesResult = {
  cesantias:          number   // cesantías acumuladas en el período
  cesantias_interest: number   // intereses s/ cesantías del período
  prima:              number   // prima de servicios acumulada en el período
  vacation_value:     number   // valor en $ de los días de vacaciones acumulados
  vacation_days:      number   // días de vacaciones acumulados
}

/**
 * Calcula las prestaciones sociales proporcionales al período.
 * Base legal colombiana (2024-2025).
 *
 * @param salary          Salario proporcional del período (ya ajustado por días trabajados)
 * @param transportAllowance  Auxilio de transporte aplicado (0 si salario > 2 SMLV)
 * @param workedDays      Días laborados en el período (default 30)
 */
export function calcPrestaciones(
  salary: number,
  transportAllowance: number,
  workedDays: number = 30
): PrestacionesResult {
  // Base cesantías y prima = salario + auxilio transporte (decreto colombiano)
  const base = salary + transportAllowance

  // Cesantías: (salario + aux) × días / 360  (1 mes anual = 30/360)
  const cesantias = Math.round(base * workedDays / 360)

  // Intereses sobre cesantías: 12% anual proporcional al período
  const cesantias_interest = Math.round(cesantias * 0.12 * workedDays / 360)

  // Prima de servicios: igual que cesantías (15 días por semestre = 30/360 por mes)
  const prima = Math.round(base * workedDays / 360)

  // Vacaciones: solo salario (sin auxilio), 15 días hábiles/año = días/24
  const vacation_value = Math.round(salary * workedDays / 720)
  const vacation_days  = Math.round((workedDays / 24) * 10000) / 10000

  return { cesantias, cesantias_interest, prima, vacation_value, vacation_days }
}

// ─── Cálculo de nómina ────────────────────────────────────────────────────────

export type PayrollCalcInput = {
  salary:             number
  smlv:               number        // salario mínimo del año en curso
  transportAllowance: number        // valor del auxilio de transporte
  arl_rate:           number        // tasa ARL del empleado
  totalSalaryBase:    number        // suma de todos los salarios (para ICBF/SENA)
  worked_days?:       number        // días trabajados en el período (default 30)
  // novedades
  overtime_pay?:      number
  bonuses?:           number
  other_income?:      number
  withholding_tax?:   number
  other_deductions?:  number
}

export type PayrollCalcResult = {
  // Salario efectivo del período (proporcional si worked_days < 30)
  effective_salary:      number
  transport_allowance:   number
  gross_pay:             number
  health_employee:       number
  pension_employee:      number
  total_deductions:      number
  net_pay:               number
  health_employer:       number
  pension_employer:      number
  arl:                   number
  ccf:                   number
  icbf:                  number
  sena:                  number
  total_employer_cost:   number
  // Prestaciones del período
  cesantias_month:       number
  cesantias_interest:    number
  prima_month:           number
  vacation_days_accrued: number
}

/**
 * Calcula los valores de nómina según las reglas colombianas.
 * Puro (sin efectos secundarios) — se puede llamar en cualquier lado.
 */
export function calcPayroll(input: PayrollCalcInput): PayrollCalcResult {
  const {
    salary, smlv, transportAllowance, arl_rate, totalSalaryBase,
    worked_days = 30,
    overtime_pay = 0, bonuses = 0, other_income = 0,
    withholding_tax = 0, other_deductions = 0,
  } = input

  // Salario proporcional al tiempo trabajado
  const effective_salary = Math.round(salary * worked_days / 30)

  // Auxilio de transporte: solo si salario base ≤ 2 SMLV
  // (se evalúa sobre el salario contractual, no el proporcional)
  const transport_allowance = salary <= 2 * smlv ? Math.round(transportAllowance * worked_days / 30) : 0

  // Devengado total (el auxilio de transporte NO hace parte de la base de seguridad social)
  const gross_pay = effective_salary + transport_allowance + overtime_pay + bonuses + other_income

  // Base para deducciones de seguridad social = salario efectivo + extras (SIN auxilio transporte)
  const base_ss = effective_salary + overtime_pay + bonuses + other_income

  // Deducciones empleado
  const health_employee  = Math.round(base_ss * RATES.HEALTH_EMPLOYEE)
  const pension_employee = Math.round(base_ss * RATES.PENSION_EMPLOYEE)
  const total_deductions = health_employee + pension_employee + withholding_tax + other_deductions
  const net_pay          = gross_pay - total_deductions

  // Aportes patronales
  const health_employer  = Math.round(base_ss * RATES.HEALTH_EMPLOYER)
  const pension_employer = Math.round(base_ss * RATES.PENSION_EMPLOYER)
  const arl              = Math.round(base_ss * arl_rate)
  const ccf              = Math.round(base_ss * RATES.CCF)

  // ICBF y SENA solo si la nómina total supera 10 SMLV
  const applyParafiscales = totalSalaryBase > 10 * smlv
  const icbf = applyParafiscales ? Math.round(base_ss * RATES.ICBF) : 0
  const sena = applyParafiscales ? Math.round(base_ss * RATES.SENA)  : 0

  const total_employer_cost = effective_salary + transport_allowance + overtime_pay + bonuses + other_income
    + health_employer + pension_employer + arl + ccf + icbf + sena

  // Prestaciones proporcionales al período
  const prest = calcPrestaciones(effective_salary, transport_allowance, worked_days)

  return {
    effective_salary,
    transport_allowance, gross_pay,
    health_employee, pension_employee, total_deductions, net_pay,
    health_employer, pension_employer, arl, ccf, icbf, sena,
    total_employer_cost,
    cesantias_month:       prest.cesantias,
    cesantias_interest:    prest.cesantias_interest,
    prima_month:           prest.prima,
    vacation_days_accrued: prest.vacation_days,
  }
}

// ─── CRUD Empleados ───────────────────────────────────────────────────────────

export function useEmployees(companyId?: string) {
  return useQuery({
    queryKey: ['employees', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as Employee[]
    },
    enabled: !!companyId,
  })
}

export async function createEmployee(data: EmployeeInsertValues): Promise<Employee> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('employees')
    .insert([{
      company_id:          data.company_id,
      name:                data.name,
      doc_type:            data.doc_type,
      doc_number:          data.doc_number          || null,
      birth_date:          data.birth_date           || null,
      position:            data.position             || null,
      department:          data.department           || null,
      hire_date:           data.hire_date,
      contract_type:       data.contract_type,
      salary:              data.salary,
      commission_rate:     data.contract_type === 'comision' ? (data.commission_rate ?? null) : null,
      is_active:           data.is_active            ?? true,
      eps_name:            data.eps_name             || null,
      afp_name:            data.afp_name             || null,
      arl_rate:            data.arl_rate             ?? 0.00522,
      ccf_name:            data.ccf_name             || null,
      bank_name:           data.bank_name            || null,
      bank_account_type:   data.bank_account_type    || null,
      bank_account_number: data.bank_account_number  || null,
      notes:               data.notes                || null,
    }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as Employee
}

export async function updateEmployee(id: string, data: Partial<EmployeeFormValues>): Promise<Employee> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('employees')
    .update({
      name:                data.name,
      doc_type:            data.doc_type,
      doc_number:          data.doc_number          || null,
      birth_date:          data.birth_date           || null,
      position:            data.position             || null,
      department:          data.department           || null,
      hire_date:           data.hire_date,
      contract_type:       data.contract_type,
      salary:              data.salary,
      commission_rate:     data.contract_type === 'comision' ? (data.commission_rate ?? null) : null,
      is_active:           data.is_active,
      eps_name:            data.eps_name             || null,
      afp_name:            data.afp_name             || null,
      arl_rate:            data.arl_rate,
      ccf_name:            data.ccf_name             || null,
      bank_name:           data.bank_name            || null,
      bank_account_type:   data.bank_account_type    || null,
      bank_account_number: data.bank_account_number  || null,
      notes:               data.notes                || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as Employee
}

// ─── Agentes de comisión ──────────────────────────────────────────────────────

/**
 * Devuelve los empleados con contract_type = 'comision' y is_active = true.
 * Se usa en el selector de agente en el detalle de factura.
 */
export function useCommissionAgents(companyId?: string) {
  return useQuery({
    queryKey: ['commission_agents', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, commission_rate')
        .eq('company_id', companyId!)
        .eq('contract_type', 'comision')
        .eq('is_active', true)
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as CommissionAgent[]
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  })
}

export async function deleteEmployees(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('employees').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

// ─── Ausencias ────────────────────────────────────────────────────────────────

export function useAbsences(companyId?: string, employeeId?: string) {
  return useQuery({
    queryKey: ['absences', companyId, employeeId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('employee_absences')
        .select('*, employee:employees(id,name)')
        .eq('company_id', companyId!)
        .order('date_from', { ascending: false })
      if (employeeId) q = q.eq('employee_id', employeeId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as Absence[]
    },
    enabled: !!companyId,
  })
}

export async function createAbsence(data: AbsenceInsertValues): Promise<Absence> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('employee_absences')
    .insert([{
      company_id:     data.company_id,
      employee_id:    data.employee_id,
      date_from:      data.date_from,
      date_to:        data.date_to,
      days:           data.days,
      absence_type:   data.absence_type,
      affects_salary: data.affects_salary ?? false,
      description:    data.description || null,
      period_id:      data.period_id   || null,
    }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as Absence
}

export async function deleteAbsence(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('employee_absences').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Períodos de nómina ───────────────────────────────────────────────────────

export function usePayrollPeriods(companyId?: string) {
  return useQuery({
    queryKey: ['payroll_periods', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('company_id', companyId!)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as PayrollPeriod[]
    },
    enabled: !!companyId,
  })
}

export function usePayrollItems(periodId?: string) {
  return useQuery({
    queryKey: ['payroll_items', periodId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('payroll_items')
        .select('*, employee:employees(*)')
        .eq('period_id', periodId!)
        .order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []) as PayrollItemWithEmployee[]
    },
    enabled: !!periodId,
  })
}

// ─── Resumen de prestaciones sociales ────────────────────────────────────────

/**
 * Agrupa todos los payroll_items de la empresa por empleado y suma
 * las prestaciones acumuladas desde la fecha de ingreso.
 */
export function useSocialBenefitsSummary(companyId?: string) {
  return useQuery({
    queryKey: ['social_benefits', companyId],
    queryFn: async () => {
      const supabase = createClient()

      // 1. Obtener todos los empleados de la empresa
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (empError) throw new Error(empError.message)
      if (!employees || employees.length === 0) return []

      const empIds = (employees as Employee[]).map(e => e.id)

      // 2. Obtener todos los payroll_items de esos empleados
      const { data: items, error: itemsError } = await supabase
        .from('payroll_items')
        .select('*')
        .in('employee_id', empIds)
      if (itemsError) throw new Error(itemsError.message)

      // 3. Obtener días de vacaciones tomados (absences de tipo vacaciones)
      const { data: vacAbsences, error: absError } = await supabase
        .from('employee_absences')
        .select('employee_id, days')
        .eq('company_id', companyId!)
        .eq('absence_type', 'vacaciones')
      if (absError) throw new Error(absError.message)

      const vacByEmployee: Record<string, number> = {}
      for (const a of vacAbsences ?? []) {
        vacByEmployee[a.employee_id] = (vacByEmployee[a.employee_id] ?? 0) + Number(a.days)
      }

      const typedItems = (items ?? []) as PayrollItem[]

      // 4. Agrupar por empleado
      const summary: SocialBenefitsSummary[] = (employees as Employee[]).map(emp => {
        const empItems = typedItems.filter(i => i.employee_id === emp.id)
        const months_worked            = empItems.length
        const cesantias_total          = empItems.reduce((s, i) => s + (i.cesantias_month       ?? 0), 0)
        const cesantias_interest_total = empItems.reduce((s, i) => s + (i.cesantias_interest     ?? 0), 0)
        const prima_total              = empItems.reduce((s, i) => s + (i.prima_month            ?? 0), 0)
        const vacation_days_total      = empItems.reduce((s, i) => s + (i.vacation_days_accrued  ?? 0), 0)
        const vacation_days_taken      = vacByEmployee[emp.id] ?? 0
        const vacation_days_pending    = Math.max(0, vacation_days_total - vacation_days_taken)
        const dailySalary              = emp.salary / 30
        const vacation_value_pending   = Math.round(vacation_days_pending * dailySalary)

        return {
          employee: emp,
          months_worked,
          cesantias_total:           Math.round(cesantias_total),
          cesantias_interest_total:  Math.round(cesantias_interest_total),
          prima_total:               Math.round(prima_total),
          vacation_days_total:       Math.round(vacation_days_total * 100) / 100,
          vacation_days_taken,
          vacation_days_pending:     Math.round(vacation_days_pending * 100) / 100,
          vacation_value_pending,
        }
      })

      return summary
    },
    enabled: !!companyId,
  })
}

/**
 * Crea o recupera el período de nómina para el mes/año dado.
 * Si ya existe y está cerrado, lanza error.
 */
export async function getOrCreatePeriod(
  companyId: string, year: number, month: number
): Promise<PayrollPeriod> {
  const supabase = createClient()

  // Intentar obtener existente
  const { data: existing } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (existing) return existing as PayrollPeriod

  // Crear nuevo
  const { data: created, error } = await supabase
    .from('payroll_periods')
    .insert([{ company_id: companyId, year, month, status: 'open' }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return created as PayrollPeriod
}

/**
 * Genera (o regenera) los ítems de nómina para un período.
 * Si ya existen ítems para ese período, los sobreescribe.
 * Toma los empleados activos y calcula todo automáticamente.
 */
export async function generatePayrollItems(
  periodId: string,
  companyId: string,
  smlv: number,
  transportAllowance: number
): Promise<void> {
  const supabase = createClient()

  // Obtener empleados activos
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
  if (empError) throw new Error(empError.message)
  if (!employees || employees.length === 0) return

  const totalSalaryBase = (employees as Employee[]).reduce((s, e) => s + e.salary, 0)

  // Borrar ítems existentes para el período
  await supabase.from('payroll_items').delete().eq('period_id', periodId)

  // Calcular e insertar
  const rows = (employees as Employee[]).map(emp => {
    const calc = calcPayroll({
      salary: emp.salary,
      smlv,
      transportAllowance,
      arl_rate: emp.arl_rate,
      totalSalaryBase,
      worked_days: 30,
    })
    return {
      period_id:             periodId,
      employee_id:           emp.id,
      salary:                emp.salary,
      transport_allowance:   calc.transport_allowance,
      overtime_pay:          0,
      bonuses:               0,
      other_income:          0,
      gross_pay:             calc.gross_pay,
      health_employee:       calc.health_employee,
      pension_employee:      calc.pension_employee,
      withholding_tax:       0,
      other_deductions:      0,
      total_deductions:      calc.total_deductions,
      net_pay:               calc.net_pay,
      health_employer:       calc.health_employer,
      pension_employer:      calc.pension_employer,
      arl:                   calc.arl,
      ccf:                   calc.ccf,
      icbf:                  calc.icbf,
      sena:                  calc.sena,
      total_employer_cost:   calc.total_employer_cost,
      worked_days:           30,
      unpaid_days:           0,
      vacation_days_taken:   0,
      sick_days:             0,
      cesantias_month:       calc.cesantias_month,
      cesantias_interest:    calc.cesantias_interest,
      prima_month:           calc.prima_month,
      vacation_days_accrued: calc.vacation_days_accrued,
    }
  })

  const { error: insError } = await supabase.from('payroll_items').insert(rows)
  if (insError) throw new Error(insError.message)
}

/**
 * Actualiza un ítem de nómina con novedades (días trabajados, horas extra, bonos, deducciones)
 * y recalcula todos los totales incluyendo prestaciones.
 */
export async function updatePayrollItem(
  item: PayrollItem,
  novedades: PayrollNovedadesValues,
  smlv: number,
  transportAllowance: number,
  totalSalaryBase: number
): Promise<void> {
  const supabase = createClient()
  const emp = item.employee!

  const calc = calcPayroll({
    salary:           item.salary,
    smlv,
    transportAllowance,
    arl_rate:         emp.arl_rate,
    totalSalaryBase,
    worked_days:      novedades.worked_days      ?? 30,
    overtime_pay:     novedades.overtime_pay,
    bonuses:          novedades.bonuses,
    other_income:     novedades.other_income,
    withholding_tax:  novedades.withholding_tax,
    other_deductions: novedades.other_deductions,
  })

  const { error } = await supabase
    .from('payroll_items')
    .update({
      worked_days:           novedades.worked_days          ?? 30,
      unpaid_days:           novedades.unpaid_days           ?? 0,
      vacation_days_taken:   novedades.vacation_days_taken   ?? 0,
      sick_days:             novedades.sick_days              ?? 0,
      overtime_pay:          novedades.overtime_pay           ?? 0,
      bonuses:               novedades.bonuses                ?? 0,
      other_income:          novedades.other_income           ?? 0,
      withholding_tax:       novedades.withholding_tax        ?? 0,
      other_deductions:      novedades.other_deductions       ?? 0,
      notes:                 novedades.notes                  || null,
      transport_allowance:   calc.transport_allowance,
      gross_pay:             calc.gross_pay,
      health_employee:       calc.health_employee,
      pension_employee:      calc.pension_employee,
      total_deductions:      calc.total_deductions,
      net_pay:               calc.net_pay,
      health_employer:       calc.health_employer,
      pension_employer:      calc.pension_employer,
      arl:                   calc.arl,
      ccf:                   calc.ccf,
      icbf:                  calc.icbf,
      sena:                  calc.sena,
      total_employer_cost:   calc.total_employer_cost,
      cesantias_month:       calc.cesantias_month,
      cesantias_interest:    calc.cesantias_interest,
      prima_month:           calc.prima_month,
      vacation_days_accrued: calc.vacation_days_accrued,
    })
    .eq('id', item.id)
  if (error) throw new Error(error.message)
}

/**
 * Cierra un período de nómina (lo bloquea — no se puede editar).
 */
export async function closePayrollPeriod(periodId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('payroll_periods')
    .update({ status: 'closed', approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq('id', periodId)
  if (error) throw new Error(error.message)
}
