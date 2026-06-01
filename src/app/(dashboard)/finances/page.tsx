'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Scale, ReceiptText, Truck,
  FileSpreadsheet, Info,
} from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import {
  usePanelSummary, useMonthlyBars, useTaxReport,
  defaultPeriod,
  type FinancePeriod,
} from '@/modules/finances/queries'
import { ExpensesTab } from '@/modules/finances/components/expenses-tab'

// ─── Tipos y constantes ───────────────────────────────────────────────────────

const TABS = [
  { id: 'panel',     label: 'Panel'     },
  { id: 'impuestos', label: 'Impuestos' },
  { id: 'gastos',    label: 'Gastos'    },
] as const
type TabId = typeof TABS[number]['id']

// ─── Utilidades ───────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinancesPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()

  const [activeTab, setActiveTab] = useState<TabId>('panel')
  const [period, setPeriod]       = useState<FinancePeriod>(defaultPeriod())

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const cid  = activeCompanyId ?? undefined
  const year = new Date(period.from).getFullYear()

  const { data: panel, isLoading: loadingPanel } = usePanelSummary(cid, period)
  const { data: bars = []                       } = useMonthlyBars(cid, year)
  const { data: tax,  isLoading: loadingTax     } = useTaxReport(cid, period)

  type TaxRow = { concepto: string; valor: string }

  const exportImpuestos = () => {
    if (!tax) return
    const cols: ExcelColumn<TaxRow>[] = [
      { header: 'Concepto', key: 'concepto', width: 40 },
      { header: 'Valor',    key: 'valor',    width: 18 },
    ]
    const rows: TaxRow[] = [
      { concepto: 'IVA cobrado en ventas',           valor: fmtCOP(tax.ivaCobrado)      },
      { concepto: 'IVA pagado en compras',            valor: fmtCOP(tax.ivaDescontable)  },
      { concepto: 'Saldo neto IVA',                   valor: fmtCOP(tax.ivaNeto)         },
      { concepto: '',                                  valor: ''                          },
      { concepto: 'Retenciones practicadas (compras)',valor: fmtCOP(tax.retePracticada)  },
      { concepto: 'Retenciones recibidas (ventas)',   valor: fmtCOP(tax.reteRecibida)    },
      { concepto: 'ReteIVA recibida',                 valor: fmtCOP(tax.reteIvaRecibida) },
      { concepto: '',                                  valor: ''                          },
      { concepto: 'Base gravable ICA',                valor: fmtCOP(tax.baseIca)         },
      { concepto: `Tasa ICA (${(tax.icaRate * 100).toFixed(3)}%)`, valor: ''             },
      { concepto: 'ICA estimado a pagar',             valor: fmtCOP(tax.icaCalculado)    },
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
            onClick={() => setActiveTab(tab.id)}
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

              {/* Cartera (resumen — detalle en Ventas → CxC) */}
              <div className={`rounded-xl border p-4 shadow-sm col-span-1 ${(panel?.cartera ?? 0) > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-zinc-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ReceiptText className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">Por cobrar</p>
                </div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(panel?.cartera ?? 0)}</p>
                <Link href="/sales?tab=cxc" className="text-xs text-blue-500 hover:underline mt-0.5 block">
                  Ver detalle CxC →
                </Link>
              </div>

              {/* Obligaciones (resumen — detalle en Compras → CxP) */}
              <div className={`rounded-xl border p-4 shadow-sm col-span-1 ${(panel?.obligaciones ?? 0) > 0 ? 'border-red-200 bg-red-50/30' : 'border-zinc-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">Por pagar</p>
                </div>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(panel?.obligaciones ?? 0)}</p>
                <Link href="/purchases?tab=cxp" className="text-xs text-blue-500 hover:underline mt-0.5 block">
                  Ver detalle CxP →
                </Link>
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: GASTOS                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'gastos' && activeCompanyId && (
        <div className="space-y-4">
          <PeriodSelector />
          <ExpensesTab companyId={activeCompanyId} period={period} />
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
