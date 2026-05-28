'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Scale, ReceiptText, Truck,
  FileSpreadsheet, Info,
} from 'lucide-react'
import {
  flexRender, getCoreRowModel, useReactTable, type ColumnDef,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import {
  usePanelSummary, useMonthlyBars, useCartera, useObligaciones, useTaxReport,
  defaultPeriod,
  type FinancePeriod, type CarteraRow, type ObligacionRow,
} from '@/modules/finances/queries'

// ─── Tipos y constantes ───────────────────────────────────────────────────────

const TABS = [
  { id: 'panel',        label: 'Panel'        },
  { id: 'cartera',      label: 'Cartera'      },
  { id: 'obligaciones', label: 'Obligaciones' },
  { id: 'impuestos',    label: 'Impuestos'    },
] as const
type TabId = typeof TABS[number]['id']

const AGING_FILTERS = [
  { value: 'all',  label: 'Todas'        },
  { value: '0',    label: 'Al día'       },
  { value: '30',   label: '1-30 días'    },
  { value: '60',   label: '31-60 días'   },
  { value: '90',   label: '61-90 días'   },
  { value: '91',   label: '+90 días'     },
]

// ─── Utilidades ───────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function agingBand(dias: number) {
  if (dias === 0) return { cls: 'bg-green-100 text-green-700',   label: 'Al día'    }
  if (dias <= 30) return { cls: 'bg-green-100 text-green-700',   label: `${dias}d`  }
  if (dias <= 60) return { cls: 'bg-yellow-100 text-yellow-700', label: `${dias}d`  }
  if (dias <= 90) return { cls: 'bg-orange-100 text-orange-700', label: `${dias}d`  }
  return              { cls: 'bg-red-100 text-red-700',          label: `${dias}d`  }
}

function filterByAging<T extends { dias_vencido: number }>(
  rows: T[], filter: string
): T[] {
  if (filter === 'all') return rows
  if (filter === '0')  return rows.filter(r => r.dias_vencido === 0)
  if (filter === '30') return rows.filter(r => r.dias_vencido > 0  && r.dias_vencido <= 30)
  if (filter === '60') return rows.filter(r => r.dias_vencido > 30 && r.dias_vencido <= 60)
  if (filter === '90') return rows.filter(r => r.dias_vencido > 60 && r.dias_vencido <= 90)
  if (filter === '91') return rows.filter(r => r.dias_vencido > 90)
  return rows
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinancesPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()

  const [activeTab, setActiveTab]     = useState<TabId>('panel')
  const [period, setPeriod]           = useState<FinancePeriod>(defaultPeriod())
  const [agingFilter, setAgingFilter] = useState('all')
  const [search, setSearch]           = useState('')

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const cid = activeCompanyId ?? undefined
  const year = new Date(period.from).getFullYear()

  const { data: panel,  isLoading: loadingPanel  } = usePanelSummary(cid, period)
  const { data: bars   = []                       } = useMonthlyBars(cid, year)
  const { data: cartera = [], isLoading: loadingAR} = useCartera(cid)
  const { data: oblig  = [], isLoading: loadingAP } = useObligaciones(cid)
  const { data: tax,    isLoading: loadingTax     } = useTaxReport(cid, period)

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filteredCartera = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = cartera
    if (q) rows = rows.filter(r =>
      r.customer.toLowerCase().includes(q) || r.invoice_number.toLowerCase().includes(q)
    )
    return filterByAging(rows, agingFilter)
  }, [cartera, search, agingFilter])

  const filteredOblig = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = oblig
    if (q) rows = rows.filter(r =>
      r.supplier.toLowerCase().includes(q) || r.invoice_number.toLowerCase().includes(q)
    )
    return filterByAging(rows, agingFilter)
  }, [oblig, search, agingFilter])

  // ── Exportar ──────────────────────────────────────────────────────────────
  const exportCartera = () => {
    const cols: ExcelColumn<CarteraRow>[] = [
      { header: 'Cliente',       key: 'customer',       width: 28 },
      { header: 'Factura #',     key: 'invoice_number', width: 14 },
      { header: 'Emisión',       key: r => fmtDate(r.issue_date), width: 14 },
      { header: 'Vencimiento',   key: r => fmtDate(r.due_date),   width: 14 },
      { header: 'Total',         key: 'total',          width: 14 },
      { header: 'Saldo',         key: 'balance_due',    width: 14 },
      { header: 'Días vencido',  key: 'dias_vencido',   width: 12 },
    ]
    exportToExcel(filteredCartera, cols, `cartera_${period.from}_${period.to}`)
  }

  const exportObligaciones = () => {
    const cols: ExcelColumn<ObligacionRow>[] = [
      { header: 'Proveedor',     key: 'supplier',       width: 28 },
      { header: 'Factura #',     key: 'invoice_number', width: 14 },
      { header: 'Emisión',       key: r => fmtDate(r.issue_date), width: 14 },
      { header: 'Vencimiento',   key: r => fmtDate(r.due_date),   width: 14 },
      { header: 'Total',         key: 'total',          width: 14 },
      { header: 'Saldo',         key: 'balance_due',    width: 14 },
      { header: 'Días vencido',  key: 'dias_vencido',   width: 12 },
    ]
    exportToExcel(filteredOblig, cols, `obligaciones_${period.from}_${period.to}`)
  }

  type TaxRow = { concepto: string; valor: string }

  const exportImpuestos = () => {
    if (!tax) return
    const cols: ExcelColumn<TaxRow>[] = [
      { header: 'Concepto', key: 'concepto', width: 40 },
      { header: 'Valor',    key: 'valor',    width: 18 },
    ]
    const rows: TaxRow[] = [
      { concepto: 'IVA cobrado en ventas',          valor: fmtCOP(tax.ivaCobrado)     },
      { concepto: 'IVA pagado en compras',           valor: fmtCOP(tax.ivaDescontable) },
      { concepto: 'Saldo neto IVA',                  valor: fmtCOP(tax.ivaNeto)        },
      { concepto: '',                                 valor: ''                         },
      { concepto: 'Retenciones practicadas (compras)',valor: fmtCOP(tax.retePracticada) },
      { concepto: 'Retenciones recibidas (ventas)',   valor: fmtCOP(tax.reteRecibida)   },
      { concepto: 'ReteIVA recibida',                 valor: fmtCOP(tax.reteIvaRecibida)},
      { concepto: '',                                 valor: ''                         },
      { concepto: 'Base gravable ICA',                valor: fmtCOP(tax.baseIca)        },
      { concepto: `Tasa ICA (${(tax.icaRate * 100).toFixed(3)}%)`, valor: '' },
      { concepto: 'ICA estimado a pagar',             valor: fmtCOP(tax.icaCalculado)   },
    ]
    exportToExcel(rows, cols, `impuestos_${period.from}_${period.to}`)
  }

  // ─── Selector de período ──────────────────────────────────────────────────
  const PeriodSelector = () => (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500 text-xs font-medium">Período:</span>
      <input
        type="date"
        value={period.from}
        onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
      />
      <span className="text-zinc-400">→</span>
      <input
        type="date"
        value={period.to}
        onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
      />
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Finanzas</h1>
        <p className="mt-0.5 text-[13px] text-zinc-400">Resumen financiero y fiscal de tu empresa.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-zinc-200">
        {TABS.map(tab => (
          <button key={tab.id} type="button"
            onClick={() => { setActiveTab(tab.id); setSearch(''); setAgingFilter('all') }}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PANEL                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'panel' && (
        <div className="space-y-6">
          <PeriodSelector />

          {/* KPI Cards */}
          {loadingPanel ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Ingresos */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm col-span-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">Ingresos</p>
                </div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(panel?.ingresos ?? 0)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Facturas emitidas en el período</p>
              </div>

              {/* Gastos */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm col-span-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-zinc-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">Gastos</p>
                </div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(panel?.gastos ?? 0)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Facturas de proveedor en el período</p>
              </div>

              {/* IVA neto */}
              {(() => {
                const iva = panel?.ivaNeto ?? 0
                const positive = iva >= 0
                return (
                  <div className={`rounded-xl border p-4 shadow-sm col-span-1 ${positive ? 'border-green-200 bg-green-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${positive ? 'bg-green-100' : 'bg-amber-100'}`}>
                        <Scale className={`h-4 w-4 ${positive ? 'text-green-600' : 'text-amber-600'}`} />
                      </div>
                      <p className="text-xs font-medium text-zinc-500">IVA neto</p>
                    </div>
                    <p className={`text-xl font-bold tabular-nums ${positive ? 'text-green-700' : 'text-amber-700'}`}>{fmtCOP(Math.abs(iva))}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{positive ? 'A pagar a la DIAN' : 'Saldo a favor'}</p>
                  </div>
                )
              })()}

              {/* Cartera */}
              <div className={`rounded-xl border p-4 shadow-sm col-span-1 ${(panel?.cartera ?? 0) > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-zinc-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ReceiptText className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">Por cobrar</p>
                </div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(panel?.cartera ?? 0)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Saldo pendiente de clientes</p>
              </div>

              {/* Obligaciones */}
              <div className={`rounded-xl border p-4 shadow-sm col-span-1 ${(panel?.obligaciones ?? 0) > 0 ? 'border-red-200 bg-red-50/30' : 'border-zinc-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">Por pagar</p>
                </div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(panel?.obligaciones ?? 0)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Saldo pendiente a proveedores</p>
              </div>
            </div>
          )}

          {/* Gráfico de barras mensual */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-700">Ingresos vs. Gastos — {year}</h3>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" />Ingresos</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-300" />Gastos</span>
              </div>
            </div>
            {(() => {
              const maxVal = Math.max(...bars.flatMap(b => [b.ingresos, b.gastos]), 1)
              return (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-3 h-40 min-w-[560px]">
                    {bars.map(bar => (
                      <div key={bar.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: '128px' }}>
                          <div
                            className="w-4 bg-blue-400 rounded-t transition-all duration-500"
                            style={{ height: `${Math.max(2, (bar.ingresos / maxVal) * 128)}px` }}
                            title={`Ingresos ${bar.mes}: ${fmtCOP(bar.ingresos)}`}
                          />
                          <div
                            className="w-4 bg-zinc-300 rounded-t transition-all duration-500"
                            style={{ height: `${Math.max(2, (bar.gastos / maxVal) * 128)}px` }}
                            title={`Gastos ${bar.mes}: ${fmtCOP(bar.gastos)}`}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-400">{bar.mes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: CARTERA                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cartera' && (
        <CarteraTab
          rows={filteredCartera}
          isLoading={loadingAR}
          search={search}
          onSearchChange={setSearch}
          agingFilter={agingFilter}
          onAgingChange={setAgingFilter}
          onExport={exportCartera}
          totalCartera={cartera.reduce((s, r) => s + r.balance_due, 0)}
          overdueCount={cartera.filter(r => r.dias_vencido > 0).length}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: OBLIGACIONES                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'obligaciones' && (
        <ObligacionesTab
          rows={filteredOblig}
          isLoading={loadingAP}
          search={search}
          onSearchChange={setSearch}
          agingFilter={agingFilter}
          onAgingChange={setAgingFilter}
          onExport={exportObligaciones}
          totalOblig={oblig.reduce((s, r) => s + r.balance_due, 0)}
          overdueCount={oblig.filter(r => r.dias_vencido > 0).length}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: IMPUESTOS                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'impuestos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <PeriodSelector />
            <button
              onClick={exportImpuestos}
              disabled={!tax}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition-colors">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Exportar Excel
            </button>
          </div>

          {loadingTax ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-36 animate-pulse rounded-xl bg-zinc-100" />)}</div>
          ) : tax ? (
            <div className="space-y-4">

              {/* IVA */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <span className="text-base">🧾</span> IVA
                </h3>
                <div className="space-y-2">
                  <TaxLine label="IVA cobrado en ventas" value={tax.ivaCobrado} />
                  <TaxLine label="IVA pagado en compras (descontable)" value={-tax.ivaDescontable} />
                  <div className="border-t border-zinc-100 pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-800">Saldo neto a declarar</span>
                      <div className="flex items-center gap-2">
                        {tax.ivaNeto < 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Saldo a favor
                          </span>
                        )}
                        <span className={`text-sm font-bold tabular-nums ${tax.ivaNeto >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                          {fmtCOP(Math.abs(tax.ivaNeto))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Retenciones */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <span className="text-base">✂️</span> Retención en la fuente
                </h3>
                <div className="space-y-2">
                  <TaxLine label="Retenciones practicadas en compras" value={tax.retePracticada} />
                  <TaxLine label="Retenciones recibidas en ventas" value={tax.reteRecibida} />
                  <TaxLine label="ReteIVA recibida en ventas" value={tax.reteIvaRecibida} />
                </div>
                {tax.reteRecibida === 0 && tax.reteIvaRecibida === 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2.5">
                    <Info className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-zinc-500">
                      Para registrar retenciones recibidas de clientes gran contribuyente, edita la factura
                      de venta e ingresa el valor en el campo <strong>Retención</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* ICA */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <span className="text-base">🏙️</span> ICA — Industria y Comercio
                </h3>
                <div className="space-y-2">
                  <TaxLine label="Base gravable (ingresos brutos del período)" value={tax.baseIca} />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-zinc-600">Tasa ICA configurada</span>
                    <span className="text-sm font-medium text-zinc-700 tabular-nums">
                      {(tax.icaRate * 100).toFixed(3)}%
                    </span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2">
                    <TaxLine label="ICA estimado a pagar" value={tax.icaCalculado} bold />
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  La tasa ICA puede modificarse en{' '}
                  <Link href="/settings" className="text-blue-600 hover:underline">Configuración → Empresa</Link>.
                </p>
              </div>

            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">
              Selecciona un período para ver el resumen de impuestos.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente TaxLine ───────────────────────────────────────────────────────

function TaxLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const neg = value < 0
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${bold ? 'font-semibold text-zinc-800' : 'text-zinc-600'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-zinc-900' : 'font-medium text-zinc-700'} ${neg ? 'text-red-600' : ''}`}>
        {neg ? `-${fmtCOP(Math.abs(value))}` : fmtCOP(value)}
      </span>
    </div>
  )
}

// ─── Tab Cartera ──────────────────────────────────────────────────────────────

function CarteraTab({
  rows, isLoading, search, onSearchChange,
  agingFilter, onAgingChange, onExport,
  totalCartera, overdueCount,
}: {
  rows: CarteraRow[]
  isLoading: boolean
  search: string
  onSearchChange: (v: string) => void
  agingFilter: string
  onAgingChange: (v: string) => void
  onExport: () => void
  totalCartera: number
  overdueCount: number
}) {
  const columns: ColumnDef<CarteraRow>[] = [
    {
      id: 'customer',
      header: 'Cliente',
      cell: ({ row }) => <span className="font-medium text-zinc-800">{row.original.customer}</span>,
    },
    {
      id: 'invoice_number',
      header: 'Factura #',
      cell: ({ row }) => (
        <Link
          href={`/sales/invoices/${row.original.id}`}
          className="font-mono text-blue-600 hover:underline text-sm"
        >
          {row.original.invoice_number}
        </Link>
      ),
    },
    {
      id: 'issue_date',
      header: 'Emisión',
      cell: ({ row }) => <span className="text-sm text-zinc-500">{fmtDate(row.original.issue_date)}</span>,
    },
    {
      id: 'due_date',
      header: 'Vencimiento',
      cell: ({ row }) => <span className="text-sm text-zinc-500">{fmtDate(row.original.due_date)}</span>,
    },
    {
      id: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="text-sm tabular-nums text-zinc-700">{fmtCOP(row.original.total)}</span>,
    },
    {
      id: 'balance_due',
      header: 'Saldo',
      cell: ({ row }) => <span className="text-sm font-semibold tabular-nums text-zinc-900">{fmtCOP(row.original.balance_due)}</span>,
    },
    {
      id: 'payment_status',
      header: 'Estado',
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          row.original.payment_status === 'partial'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-zinc-100 text-zinc-600'
        }`}>
          {row.original.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
        </span>
      ),
    },
    {
      id: 'aging',
      header: 'Vencido',
      cell: ({ row }) => {
        const band = agingBand(row.original.dias_vencido)
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${band.cls}`}>
            {band.label}
          </span>
        )
      },
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Resumen + toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-zinc-500">Total cartera</p>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(totalCartera)}</p>
          </div>
          {overdueCount > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
              <p className="text-xs text-red-600 font-medium">{overdueCount} factura{overdueCount !== 1 ? 's' : ''} vencida{overdueCount !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Buscar cliente o factura..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 w-56"
          />
          <select
            value={agingFilter}
            onChange={e => onAgingChange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {AGING_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button onClick={onExport}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Exportar
          </button>
        </div>
      </div>

      <AgingTable table={table} colSpan={columns.length} isLoading={isLoading} emptyMsg="No hay facturas pendientes de cobro." />
    </div>
  )
}

// ─── Tab Obligaciones ─────────────────────────────────────────────────────────

function ObligacionesTab({
  rows, isLoading, search, onSearchChange,
  agingFilter, onAgingChange, onExport,
  totalOblig, overdueCount,
}: {
  rows: ObligacionRow[]
  isLoading: boolean
  search: string
  onSearchChange: (v: string) => void
  agingFilter: string
  onAgingChange: (v: string) => void
  onExport: () => void
  totalOblig: number
  overdueCount: number
}) {
  const columns: ColumnDef<ObligacionRow>[] = [
    {
      id: 'supplier',
      header: 'Proveedor',
      cell: ({ row }) => <span className="font-medium text-zinc-800">{row.original.supplier}</span>,
    },
    {
      id: 'invoice_number',
      header: 'Factura #',
      cell: ({ row }) => (
        <Link
          href={`/purchases/invoices/${row.original.id}`}
          className="font-mono text-blue-600 hover:underline text-sm"
        >
          {row.original.invoice_number}
        </Link>
      ),
    },
    {
      id: 'issue_date',
      header: 'Emisión',
      cell: ({ row }) => <span className="text-sm text-zinc-500">{fmtDate(row.original.issue_date)}</span>,
    },
    {
      id: 'due_date',
      header: 'Vencimiento',
      cell: ({ row }) => <span className="text-sm text-zinc-500">{fmtDate(row.original.due_date)}</span>,
    },
    {
      id: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="text-sm tabular-nums text-zinc-700">{fmtCOP(row.original.total)}</span>,
    },
    {
      id: 'balance_due',
      header: 'Saldo',
      cell: ({ row }) => <span className="text-sm font-semibold tabular-nums text-zinc-900">{fmtCOP(row.original.balance_due)}</span>,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          row.original.status === 'partial'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-zinc-100 text-zinc-600'
        }`}>
          {row.original.status === 'partial' ? 'Parcial' : 'Pendiente'}
        </span>
      ),
    },
    {
      id: 'aging',
      header: 'Vencido',
      cell: ({ row }) => {
        const band = agingBand(row.original.dias_vencido)
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${band.cls}`}>
            {band.label}
          </span>
        )
      },
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-zinc-500">Total obligaciones</p>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(totalOblig)}</p>
          </div>
          {overdueCount > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
              <p className="text-xs text-red-600 font-medium">{overdueCount} factura{overdueCount !== 1 ? 's' : ''} vencida{overdueCount !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Buscar proveedor o factura..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 w-56"
          />
          <select
            value={agingFilter}
            onChange={e => onAgingChange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {AGING_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button onClick={onExport}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Exportar
          </button>
        </div>
      </div>

      <AgingTable table={table} colSpan={columns.length} isLoading={isLoading} emptyMsg="No hay facturas pendientes de pago." />
    </div>
  )
}

// ─── Tabla genérica con aging ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AgingTable({ table, colSpan, isLoading, emptyMsg }: { table: any; colSpan: number; isLoading: boolean; emptyMsg: string }) {
  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-zinc-50/50">
          {table.getHeaderGroups().map((hg: any) => (
            <TableRow key={hg.id} className="border-zinc-200">
              {hg.headers.map((h: any) => (
                <TableHead key={h.id} className="py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row: any) => (
              <TableRow key={row.id} className="border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                {row.getVisibleCells().map((cell: any) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-32 text-center text-sm text-zinc-400">
                {emptyMsg}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
