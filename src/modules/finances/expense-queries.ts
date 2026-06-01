'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { createJournalEntry } from '@/modules/accounting/queries'
import type { FinancePeriod } from './queries'
import type {
  ExpenseFormValues, CategoryFormValues, RecurringFormValues,
} from './expense-schemas'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ExpenseCategory = {
  id:           string
  company_id:   string
  name:         string
  type:         'fijo' | 'variable'
  account_code: string
  is_active:    boolean
  created_at:   string
}

export type Expense = {
  id:                   string
  company_id:           string
  category_id:          string | null
  expense_date:         string
  description:          string
  amount:               number
  payment_method:       'efectivo' | 'transferencia' | 'tarjeta' | 'otro'
  status:               'pagado' | 'pendiente'
  receipt_url:          string | null
  journal_entry_id:     string | null
  recurring_expense_id: string | null
  notes:                string | null
  created_at:           string
  category:             ExpenseCategory | null
}

export type RecurringExpense = {
  id:             string
  company_id:     string
  category_id:    string | null
  description:    string
  amount:         number
  frequency:      'mensual' | 'trimestral' | 'semestral' | 'anual'
  day_of_month:   number
  start_date:     string
  end_date:       string | null
  is_active:      boolean
  payment_method: string
  notes:          string | null
  created_at:     string
  category:       ExpenseCategory | null
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useExpenseCategories(companyId?: string) {
  return useQuery({
    queryKey: ['expense_categories', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as ExpenseCategory[]
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useExpenses(companyId?: string, period?: FinancePeriod) {
  return useQuery({
    queryKey: ['expenses', companyId, period?.from, period?.to],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('expenses')
        .select(`*, category:expense_categories(*)`)
        .eq('company_id', companyId!)
        .order('expense_date', { ascending: false })
      if (period) {
        q = q.gte('expense_date', period.from).lte('expense_date', period.to)
      }
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as Expense[]
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 2,
  })
}

export function useRecurringExpenses(companyId?: string) {
  return useQuery({
    queryKey: ['recurring_expenses', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select(`*, category:expense_categories(*)`)
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('description')
      if (error) throw new Error(error.message)
      return (data ?? []) as RecurringExpense[]
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Mutaciones — Categorías ──────────────────────────────────────────────────

export async function createExpenseCategory(
  companyId: string,
  data: CategoryFormValues
): Promise<ExpenseCategory> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('expense_categories')
    .insert([{ company_id: companyId, ...data }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as ExpenseCategory
}

export async function updateExpenseCategory(
  id: string,
  data: Partial<CategoryFormValues>
): Promise<ExpenseCategory> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('expense_categories')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as ExpenseCategory
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('expense_categories')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Mutaciones — Gastos ──────────────────────────────────────────────────────

export async function createExpense(
  companyId: string,
  data: ExpenseFormValues,
  category: ExpenseCategory | null
): Promise<Expense> {
  const supabase = createClient()

  // 1. Opcionalmente crear comprobante contable
  let journalEntryId: string | null = null
  if (data.create_journal_entry && data.status === 'pagado' && category) {
    const entry = await createJournalEntry(companyId, {
      entry_date:  data.expense_date,
      description: data.description,
      lines: [
        { account_code: category.account_code, debit: data.amount, credit: 0,
          description: data.description },
        { account_code: '111005',               debit: 0, credit: data.amount,
          description: 'Pago gasto — Bancos nacionales' },
      ],
    })
    journalEntryId = entry.id
  }

  // 2. Opcionalmente crear plantilla recurrente
  let recurringId: string | null = null
  if (data.is_recurring && data.frequency) {
    const { data: rec, error: recErr } = await supabase
      .from('recurring_expenses')
      .insert([{
        company_id:     companyId,
        category_id:    data.category_id || null,
        description:    data.description,
        amount:         data.amount,
        frequency:      data.frequency,
        day_of_month:   data.day_of_month ?? 1,
        start_date:     data.expense_date,
        end_date:       data.end_date || null,
        payment_method: data.payment_method,
        is_active:      true,
      }])
      .select()
      .single()
    if (recErr) throw new Error(recErr.message)
    recurringId = rec.id
  }

  // 3. Insertar gasto
  const { data: result, error } = await supabase
    .from('expenses')
    .insert([{
      company_id:           companyId,
      category_id:          data.category_id || null,
      expense_date:         data.expense_date,
      description:          data.description,
      amount:               data.amount,
      payment_method:       data.payment_method,
      status:               data.status,
      notes:                data.notes || null,
      journal_entry_id:     journalEntryId,
      recurring_expense_id: recurringId,
    }])
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) throw new Error(error.message)
  return result as Expense
}

export async function updateExpense(
  id: string,
  data: Partial<ExpenseFormValues>
): Promise<Expense> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('expenses')
    .update({
      category_id:    data.category_id || null,
      expense_date:   data.expense_date,
      description:    data.description,
      amount:         data.amount,
      payment_method: data.payment_method,
      status:         data.status,
      notes:          data.notes || null,
    })
    .eq('id', id)
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) throw new Error(error.message)
  return result as Expense
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function uploadReceipt(
  companyId: string,
  expenseId: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const ext  = file.name.split('.').pop() ?? 'pdf'
  const path = `${companyId}/${expenseId}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('receipts')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) throw new Error(upErr.message)

  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(path)

  // Actualizar la URL en la fila
  const { error: updErr } = await supabase
    .from('expenses')
    .update({ receipt_url: publicUrl })
    .eq('id', expenseId)
  if (updErr) throw new Error(updErr.message)

  return publicUrl
}

// ─── Mutaciones — Recurrentes ─────────────────────────────────────────────────

export async function createRecurringExpense(
  companyId: string,
  data: RecurringFormValues
): Promise<RecurringExpense> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('recurring_expenses')
    .insert([{
      company_id:     companyId,
      category_id:    data.category_id || null,
      description:    data.description,
      amount:         data.amount,
      frequency:      data.frequency,
      day_of_month:   data.day_of_month,
      start_date:     data.start_date,
      end_date:       data.end_date || null,
      payment_method: data.payment_method,
      notes:          data.notes || null,
      is_active:      true,
    }])
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) throw new Error(error.message)
  return result as RecurringExpense
}

export async function toggleRecurring(id: string, active: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('recurring_expenses')
    .update({ is_active: active })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Genera un gasto puntual a partir de una plantilla recurrente.
 * Crea la fila en `expenses` con recurring_expense_id = plantilla.id
 */
export async function generateFromRecurring(
  companyId: string,
  recurring: RecurringExpense,
  date: string
): Promise<Expense> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('expenses')
    .insert([{
      company_id:           companyId,
      category_id:          recurring.category_id,
      expense_date:         date,
      description:          recurring.description,
      amount:               recurring.amount,
      payment_method:       recurring.payment_method,
      status:               'pagado',
      notes:                recurring.notes,
      recurring_expense_id: recurring.id,
    }])
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) throw new Error(error.message)
  return result as Expense
}

// ─── Helper: próxima fecha de un recurrente ───────────────────────────────────

export function nextDueDate(recurring: RecurringExpense): string {
  const today = new Date()
  const d = recurring.day_of_month

  // Calcular próximo mes en que cae el día
  let candidate = new Date(today.getFullYear(), today.getMonth(), d)
  if (candidate <= today) {
    const monthsAhead = recurring.frequency === 'mensual'    ? 1
      : recurring.frequency === 'trimestral' ? 3
      : recurring.frequency === 'semestral'  ? 6
      : 12
    candidate = new Date(today.getFullYear(), today.getMonth() + monthsAhead, d)
  }
  return candidate.toISOString().split('T')[0]
}
