'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Account = {
  id:           string
  company_id:   string
  code:         string
  name:         string
  account_type: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'costo'
  nature:       'debito' | 'credito'
  is_leaf:      boolean
  parent_code:  string | null
  is_system:    boolean
  created_at:   string
}

export type JournalEntry = {
  id:           string
  company_id:   string
  entry_number: string
  entry_date:   string
  entry_type:   'sale' | 'purchase' | 'payment' | 'payroll' | 'adjustment'
  description:  string
  reference_id: string | null
  status:       string
  created_by:   string | null
  created_at:   string
}

export type JournalEntryLine = {
  id:           string
  entry_id:     string
  account_code: string
  description:  string | null
  debit:        number
  credit:       number
}

export type JournalEntryWithLines = JournalEntry & {
  lines: JournalEntryLine[]
}

// ─── PUC básico pre-cargado ───────────────────────────────────────────────────
// ~60 cuentas más usadas por una PYME colombiana (NIIF PYMES)

export const PUC_SEED: Omit<Account, 'id' | 'company_id' | 'created_at'>[] = [
  // ── ACTIVO ──────────────────────────────────────────────────────────
  { code: '1',      name: 'ACTIVO',                             account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: null,  is_system: true },
  { code: '11',     name: 'Disponible',                         account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '1',   is_system: true },
  { code: '1105',   name: 'Caja',                               account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '11',  is_system: true },
  { code: '110505', name: 'Caja general',                       account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '1105',is_system: true },
  { code: '1110',   name: 'Bancos',                             account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '11',  is_system: true },
  { code: '111005', name: 'Bancos nacionales',                  account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '1110',is_system: true },
  { code: '13',     name: 'Deudores',                           account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '1',   is_system: true },
  { code: '1305',   name: 'Clientes',                           account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '13',  is_system: true },
  { code: '130505', name: 'Clientes nacionales',                account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '1305',is_system: true },
  { code: '1355',   name: 'Anticipo y avances',                 account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '13',  is_system: true },
  { code: '135515', name: 'A proveedores',                      account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '1355',is_system: true },
  { code: '14',     name: 'Inventarios',                        account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '1',   is_system: true },
  { code: '1435',   name: 'Mercancías no fabricadas por la empresa', account_type: 'activo', nature: 'debito', is_leaf: false, parent_code: '14',  is_system: true },
  { code: '143505', name: 'Productos para la venta',            account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '1435',is_system: true },
  { code: '15',     name: 'Propiedades, planta y equipo',       account_type: 'activo',     nature: 'debito', is_leaf: false, parent_code: '1',   is_system: true },
  { code: '1524',   name: 'Equipo de oficina',                  account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '15',  is_system: true },
  { code: '1528',   name: 'Equipo de computación',              account_type: 'activo',     nature: 'debito', is_leaf: true,  parent_code: '15',  is_system: true },
  // ── PASIVO ──────────────────────────────────────────────────────────
  { code: '2',      name: 'PASIVO',                             account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: null,  is_system: true },
  { code: '22',     name: 'Proveedores',                        account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: '2',   is_system: true },
  { code: '2205',   name: 'Proveedores nacionales',             account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '22',  is_system: true },
  { code: '23',     name: 'Cuentas por pagar',                  account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: '2',   is_system: true },
  { code: '2335',   name: 'Costos y gastos por pagar',          account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '23',  is_system: true },
  { code: '2360',   name: 'Dividendos o participaciones por pagar', account_type: 'pasivo', nature: 'credito', is_leaf: true,  parent_code: '23',  is_system: true },
  { code: '24',     name: 'Impuestos, gravámenes y tasas',      account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: '2',   is_system: true },
  { code: '2408',   name: 'IVA por pagar',                      account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '24',  is_system: true },
  { code: '2365',   name: 'Retención en la fuente',             account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: '23',  is_system: true },
  { code: '236540', name: 'Honorarios',                         account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '2365',is_system: true },
  { code: '236560', name: 'Servicios',                          account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '2365',is_system: true },
  { code: '25',     name: 'Obligaciones laborales',             account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: '2',   is_system: true },
  { code: '2505',   name: 'Salarios por pagar',                 account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '25',  is_system: true },
  { code: '2510',   name: 'Cesantías consolidadas',             account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '25',  is_system: true },
  { code: '2515',   name: 'Intereses sobre cesantías',          account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '25',  is_system: true },
  { code: '2520',   name: 'Prima de servicios',                 account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '25',  is_system: true },
  { code: '2525',   name: 'Vacaciones consolidadas',            account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '25',  is_system: true },
  { code: '26',     name: 'Pasivos estimados y provisiones',    account_type: 'pasivo',     nature: 'credito', is_leaf: false, parent_code: '2',   is_system: true },
  { code: '2610',   name: 'Para costos y gastos',               account_type: 'pasivo',     nature: 'credito', is_leaf: true,  parent_code: '26',  is_system: true },
  // ── PATRIMONIO ──────────────────────────────────────────────────────
  { code: '3',      name: 'PATRIMONIO',                         account_type: 'patrimonio', nature: 'credito', is_leaf: false, parent_code: null,  is_system: true },
  { code: '31',     name: 'Capital social',                     account_type: 'patrimonio', nature: 'credito', is_leaf: false, parent_code: '3',   is_system: true },
  { code: '3105',   name: 'Capital suscrito y pagado',          account_type: 'patrimonio', nature: 'credito', is_leaf: true,  parent_code: '31',  is_system: true },
  { code: '37',     name: 'Resultados del ejercicio',           account_type: 'patrimonio', nature: 'credito', is_leaf: false, parent_code: '3',   is_system: true },
  { code: '3710',   name: 'Utilidad del ejercicio',             account_type: 'patrimonio', nature: 'credito', is_leaf: true,  parent_code: '37',  is_system: true },
  { code: '3715',   name: 'Pérdida del ejercicio',              account_type: 'patrimonio', nature: 'debito',  is_leaf: true,  parent_code: '37',  is_system: true },
  // ── INGRESOS ────────────────────────────────────────────────────────
  { code: '4',      name: 'INGRESOS',                           account_type: 'ingreso',    nature: 'credito', is_leaf: false, parent_code: null,  is_system: true },
  { code: '41',     name: 'Operacionales',                      account_type: 'ingreso',    nature: 'credito', is_leaf: false, parent_code: '4',   is_system: true },
  { code: '4135',   name: 'Comercio al por mayor y al por menor', account_type: 'ingreso',  nature: 'credito', is_leaf: false, parent_code: '41',  is_system: true },
  { code: '413505', name: 'Ventas',                             account_type: 'ingreso',    nature: 'credito', is_leaf: true,  parent_code: '4135',is_system: true },
  { code: '4175',   name: 'Devoluciones en ventas',             account_type: 'ingreso',    nature: 'debito',  is_leaf: true,  parent_code: '41',  is_system: true },
  { code: '42',     name: 'No operacionales',                   account_type: 'ingreso',    nature: 'credito', is_leaf: false, parent_code: '4',   is_system: true },
  { code: '4210',   name: 'Financieros',                        account_type: 'ingreso',    nature: 'credito', is_leaf: true,  parent_code: '42',  is_system: true },
  // ── GASTOS ──────────────────────────────────────────────────────────
  { code: '5',      name: 'GASTOS',                             account_type: 'gasto',      nature: 'debito',  is_leaf: false, parent_code: null,  is_system: true },
  { code: '51',     name: 'Operacionales de administración',    account_type: 'gasto',      nature: 'debito',  is_leaf: false, parent_code: '5',   is_system: true },
  { code: '5105',   name: 'Gastos de personal',                 account_type: 'gasto',      nature: 'debito',  is_leaf: false, parent_code: '51',  is_system: true },
  { code: '510506', name: 'Sueldos y salarios',                 account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '5105',is_system: true },
  { code: '510530', name: 'Cesantías',                          account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '5105',is_system: true },
  { code: '510545', name: 'Prima de servicios',                 account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '5105',is_system: true },
  { code: '510548', name: 'Vacaciones',                         account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '5105',is_system: true },
  { code: '5155',   name: 'Gastos de viaje',                    account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '51',  is_system: true },
  { code: '5195',   name: 'Diversos',                           account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '51',  is_system: true },
  { code: '52',     name: 'Operacionales de ventas',            account_type: 'gasto',      nature: 'debito',  is_leaf: false, parent_code: '5',   is_system: true },
  { code: '5205',   name: 'Gastos de personal ventas',          account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '52',  is_system: true },
  { code: '5240',   name: 'Publicidad, propaganda y promoción', account_type: 'gasto',      nature: 'debito',  is_leaf: true,  parent_code: '52',  is_system: true },
  // ── COSTO DE VENTAS ─────────────────────────────────────────────────
  { code: '6',      name: 'COSTO DE VENTAS',                    account_type: 'costo',      nature: 'debito',  is_leaf: false, parent_code: null,  is_system: true },
  { code: '61',     name: 'Costo de ventas y de prestación de servicios', account_type: 'costo', nature: 'debito', is_leaf: false, parent_code: '6', is_system: true },
  { code: '6135',   name: 'Comercio al por mayor y al por menor', account_type: 'costo',    nature: 'debito',  is_leaf: true,  parent_code: '61',  is_system: true },
]

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useChartOfAccounts(companyId?: string) {
  return useQuery({
    queryKey: ['chart_of_accounts', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId!)
        .order('code')
      if (error) throw new Error(error.message)
      return (data ?? []) as Account[]
    },
    enabled: !!companyId,
  })
}

export function useJournalEntries(companyId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['journal_entries', companyId, from, to],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', companyId!)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (from) q = q.gte('entry_date', from)
      if (to)   q = q.lte('entry_date', to)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as JournalEntry[]
    },
    enabled: !!companyId,
  })
}

export function useJournalEntryLines(entryId?: string) {
  return useQuery({
    queryKey: ['journal_entry_lines', entryId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select('*')
        .eq('entry_id', entryId!)
        .order('id')
      if (error) throw new Error(error.message)
      return (data ?? []) as JournalEntryLine[]
    },
    enabled: !!entryId,
  })
}

// ── Seed PUC ──────────────────────────────────────────────────────────────────

export async function seedChartOfAccounts(companyId: string): Promise<void> {
  const supabase = createClient()

  // Verificar si ya hay cuentas
  const { count } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if ((count ?? 0) > 0) return  // ya inicializado

  const rows = PUC_SEED.map(a => ({ ...a, company_id: companyId }))
  const { error } = await supabase.from('chart_of_accounts').insert(rows)
  if (error) throw new Error(error.message)
}

// ── CRUD cuentas ──────────────────────────────────────────────────────────────

export async function createAccount(
  companyId: string,
  data: Omit<Account, 'id' | 'company_id' | 'created_at'>
): Promise<Account> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('chart_of_accounts')
    .insert([{ ...data, company_id: companyId }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as Account
}

export async function updateAccount(id: string, data: Partial<Omit<Account, 'id' | 'company_id' | 'created_at' | 'is_system'>>): Promise<Account> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('chart_of_accounts')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as Account
}

// ── Crear asiento manual ──────────────────────────────────────────────────────

export type JournalEntryInput = {
  entry_date:  string
  description: string
  lines: { account_code: string; description?: string; debit: number; credit: number }[]
}

export async function createJournalEntry(
  companyId: string,
  data: JournalEntryInput
): Promise<JournalEntry> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Validar que débitos = créditos
  const totalDebit  = data.lines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('El asiento no cuadra: total débitos debe ser igual a total créditos.')
  }

  // Generar número (CE-YYYY-NNNN)
  const year = data.entry_date.slice(0, 4)
  const { count } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const entry_number = `CE-${year}-${seq}`

  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert([{
      company_id:  companyId,
      entry_number,
      entry_date:  data.entry_date,
      entry_type:  'adjustment',
      description: data.description,
      status:      'posted',
      created_by:  user?.id,
    }])
    .select()
    .single()
  if (entryError) throw new Error(entryError.message)

  const lines = data.lines.map(l => ({
    entry_id:     entry.id,
    account_code: l.account_code,
    description:  l.description ?? null,
    debit:        l.debit,
    credit:       l.credit,
  }))
  const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines)
  if (linesError) throw new Error(linesError.message)

  return entry as JournalEntry
}
