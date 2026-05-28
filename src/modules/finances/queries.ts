'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinancePeriod = {
  from: string  // YYYY-MM-DD
  to:   string  // YYYY-MM-DD
}

export type PanelSummary = {
  ingresos:     number
  gastos:       number
  ivaNeto:      number   // ivaCobrado - ivaDescontable (negativo = saldo a favor)
  cartera:      number   // total balance_due de facturas pendientes/parciales
  obligaciones: number   // total balance_due de facturas proveedor pendientes/parciales
}

export type MonthlyBar = {
  mes:      string   // 'Ene', 'Feb', ...
  ingresos: number
  gastos:   number
}

export type CarteraRow = {
  id:             string
  invoice_number: string
  customer:       string
  issue_date:     string
  due_date:       string | null
  total:          number
  balance_due:    number
  payment_status: 'unpaid' | 'partial' | 'paid'
  dias_vencido:   number   // 0 si al día o sin vencimiento
}

export type ObligacionRow = {
  id:             string
  invoice_number: string
  supplier:       string
  issue_date:     string
  due_date:       string | null
  total:          number
  balance_due:    number
  status:         'pending' | 'partial' | 'paid' | 'cancelled'
  dias_vencido:   number
}

export type TaxReport = {
  ivaCobrado:      number
  ivaDescontable:  number
  ivaNeto:         number
  retePracticada:  number   // retención practicada en compras
  reteRecibida:    number   // retención recibida en ventas
  reteIvaRecibida: number   // reteIVA recibida en ventas
  baseIca:         number   // ingresos brutos (subtotal facturas emitidas)
  icaRate:         number   // tasa configurada en la empresa
  icaCalculado:    number   // baseIca × icaRate
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** Calcula días vencidos desde due_date hasta hoy. Retorna 0 si al día o sin vencimiento. */
function calcDiasVencido(due_date: string | null): number {
  if (!due_date) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(due_date + 'T12:00:00')
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
}

/** Calcula el bimestre actual como período por defecto */
export function defaultPeriod(): FinancePeriod {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed
  const bimStart = Math.floor(m / 2) * 2
  const bimEnd   = bimStart + 1
  const from = `${y}-${String(bimStart + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, bimEnd + 1, 0).getDate()
  const to = `${y}-${String(bimEnd + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

// ─── Panel summary ────────────────────────────────────────────────────────────

export function usePanelSummary(companyId?: string, period?: FinancePeriod) {
  return useQuery({
    queryKey: ['finance_panel', companyId, period],
    queryFn: async (): Promise<PanelSummary> => {
      const supabase = createClient()

      const [invRes, supInvRes, arRes, apRes] = await Promise.all([
        // Facturas de venta emitidas en el período
        supabase
          .from('invoices')
          .select('total, tax')
          .eq('company_id', companyId!)
          .eq('status', 'issued')
          .gte('issue_date', period!.from)
          .lte('issue_date', period!.to),

        // Facturas de proveedor en el período
        supabase
          .from('supplier_invoices')
          .select('total, tax')
          .eq('company_id', companyId!)
          .neq('status', 'cancelled')
          .gte('issue_date', period!.from)
          .lte('issue_date', period!.to),

        // Cartera abierta (todos los tiempos)
        supabase
          .from('invoices')
          .select('balance_due')
          .eq('company_id', companyId!)
          .eq('status', 'issued')
          .in('payment_status', ['unpaid', 'partial']),

        // Obligaciones abiertas (todos los tiempos)
        supabase
          .from('supplier_invoices')
          .select('balance_due')
          .eq('company_id', companyId!)
          .in('status', ['pending', 'partial']),
      ])

      const invoices  = invRes.data    ?? []
      const supInvs   = supInvRes.data ?? []
      const arItems   = arRes.data     ?? []
      const apItems   = apRes.data     ?? []

      return {
        ingresos:     invoices.reduce((s, r) => s + Number(r.total), 0),
        gastos:       supInvs.reduce((s, r) => s + Number(r.total), 0),
        ivaNeto:      invoices.reduce((s, r) => s + Number(r.tax), 0)
                    - supInvs.reduce((s, r) => s + Number(r.tax), 0),
        cartera:      arItems.reduce((s, r) => s + Number(r.balance_due), 0),
        obligaciones: apItems.reduce((s, r) => s + Number(r.balance_due), 0),
      }
    },
    enabled: !!companyId && !!period,
  })
}

// ─── Monthly bars ─────────────────────────────────────────────────────────────

export function useMonthlyBars(companyId?: string, year?: number) {
  return useQuery({
    queryKey: ['finance_monthly', companyId, year],
    queryFn: async (): Promise<MonthlyBar[]> => {
      const supabase = createClient()
      const from = `${year}-01-01`
      const to   = `${year}-12-31`

      const [invRes, supRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('issue_date, total')
          .eq('company_id', companyId!)
          .eq('status', 'issued')
          .gte('issue_date', from)
          .lte('issue_date', to),

        supabase
          .from('supplier_invoices')
          .select('issue_date, total')
          .eq('company_id', companyId!)
          .neq('status', 'cancelled')
          .gte('issue_date', from)
          .lte('issue_date', to),
      ])

      const bars: MonthlyBar[] = MES_LABELS.map((mes) => ({ mes, ingresos: 0, gastos: 0 }))

      for (const inv of (invRes.data ?? [])) {
        const m = new Date(inv.issue_date + 'T12:00:00').getMonth()
        bars[m].ingresos += Number(inv.total)
      }
      for (const sup of (supRes.data ?? [])) {
        const m = new Date(sup.issue_date + 'T12:00:00').getMonth()
        bars[m].gastos += Number(sup.total)
      }

      return bars
    },
    enabled: !!companyId && !!year,
  })
}

// ─── Cartera (A/R) ───────────────────────────────────────────────────────────

export function useCartera(companyId?: string) {
  return useQuery({
    queryKey: ['finance_cartera', companyId],
    queryFn: async (): Promise<CarteraRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_id, issue_date, due_date, total, balance_due, payment_status')
        .eq('company_id', companyId!)
        .eq('status', 'issued')
        .in('payment_status', ['unpaid', 'partial'])
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw new Error(error.message)
      const rows = data ?? []

      // Obtener nombres de clientes
      const customerIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))] as string[]
      let customerMap: Record<string, string> = {}
      if (customerIds.length > 0) {
        const { data: cs } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)
        customerMap = Object.fromEntries((cs ?? []).map(c => [c.id, c.name]))
      }

      return rows.map(r => ({
        id:             r.id,
        invoice_number: r.invoice_number,
        customer:       r.customer_id ? (customerMap[r.customer_id] ?? 'Sin cliente') : 'Sin cliente',
        issue_date:     r.issue_date,
        due_date:       r.due_date,
        total:          Number(r.total),
        balance_due:    Number(r.balance_due),
        payment_status: r.payment_status as 'unpaid' | 'partial' | 'paid',
        dias_vencido:   calcDiasVencido(r.due_date),
      }))
    },
    enabled: !!companyId,
  })
}

// ─── Obligaciones (A/P) ───────────────────────────────────────────────────────

export function useObligaciones(companyId?: string) {
  return useQuery({
    queryKey: ['finance_obligaciones', companyId],
    queryFn: async (): Promise<ObligacionRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('id, invoice_number, supplier_id, issue_date, due_date, total, balance_due, status')
        .eq('company_id', companyId!)
        .in('status', ['pending', 'partial'])
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw new Error(error.message)
      const rows = data ?? []

      // Obtener nombres de proveedores
      const supplierIds = [...new Set(rows.map(r => r.supplier_id).filter(Boolean))] as string[]
      let supplierMap: Record<string, string> = {}
      if (supplierIds.length > 0) {
        const { data: ss } = await supabase
          .from('suppliers')
          .select('id, name')
          .in('id', supplierIds)
        supplierMap = Object.fromEntries((ss ?? []).map(s => [s.id, s.name]))
      }

      return rows.map(r => ({
        id:             r.id,
        invoice_number: r.invoice_number,
        supplier:       r.supplier_id ? (supplierMap[r.supplier_id] ?? 'Sin proveedor') : 'Sin proveedor',
        issue_date:     r.issue_date,
        due_date:       r.due_date,
        total:          Number(r.total),
        balance_due:    Number(r.balance_due),
        status:         r.status as 'pending' | 'partial' | 'paid' | 'cancelled',
        dias_vencido:   calcDiasVencido(r.due_date),
      }))
    },
    enabled: !!companyId,
  })
}

// ─── Tax report ───────────────────────────────────────────────────────────────

export function useTaxReport(companyId?: string, period?: FinancePeriod) {
  return useQuery({
    queryKey: ['finance_taxes', companyId, period],
    queryFn: async (): Promise<TaxReport> => {
      const supabase = createClient()

      const [invRes, supInvRes, companyRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('tax, subtotal, rete_fuente, rete_iva')
          .eq('company_id', companyId!)
          .eq('status', 'issued')
          .gte('issue_date', period!.from)
          .lte('issue_date', period!.to),

        supabase
          .from('supplier_invoices')
          .select('tax, withholding')
          .eq('company_id', companyId!)
          .neq('status', 'cancelled')
          .gte('issue_date', period!.from)
          .lte('issue_date', period!.to),

        supabase
          .from('companies')
          .select('ica_rate')
          .eq('id', companyId!)
          .single(),
      ])

      const invoices  = invRes.data    ?? []
      const supInvs   = supInvRes.data ?? []
      const icaRate   = Number(companyRes.data?.ica_rate ?? 0.00414)

      const ivaCobrado     = invoices.reduce((s, r) => s + Number(r.tax),          0)
      const ivaDescontable = supInvs.reduce((s, r) => s + Number(r.tax),           0)
      const retePracticada = supInvs.reduce((s, r) => s + Number(r.withholding),   0)
      const reteRecibida   = invoices.reduce((s, r) => s + Number(r.rete_fuente),  0)
      const reteIvaRecibida= invoices.reduce((s, r) => s + Number(r.rete_iva),     0)
      const baseIca        = invoices.reduce((s, r) => s + Number(r.subtotal),     0)

      return {
        ivaCobrado,
        ivaDescontable,
        ivaNeto:      ivaCobrado - ivaDescontable,
        retePracticada,
        reteRecibida,
        reteIvaRecibida,
        baseIca,
        icaRate,
        icaCalculado: baseIca * icaRate,
      }
    },
    enabled: !!companyId && !!period,
  })
}
