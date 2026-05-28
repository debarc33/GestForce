'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import {
  flexRender, getCoreRowModel, useReactTable, type ColumnDef,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import { useObligaciones, type ObligacionRow } from '@/modules/finances/queries'

// ─── Constantes y utilidades ──────────────────────────────────────────────────

const AGING_FILTERS = [
  { value: 'all', label: 'Todas'      },
  { value: '0',   label: 'Al día'     },
  { value: '30',  label: '1-30 días'  },
  { value: '60',  label: '31-60 días' },
  { value: '90',  label: '61-90 días' },
  { value: '91',  label: '+90 días'   },
]

const fmtCOP = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function agingBand(dias: number) {
  if (dias === 0) return { cls: 'bg-green-100 text-green-700',   label: 'Al día'   }
  if (dias <= 30) return { cls: 'bg-green-100 text-green-700',   label: `${dias}d` }
  if (dias <= 60) return { cls: 'bg-yellow-100 text-yellow-700', label: `${dias}d` }
  if (dias <= 90) return { cls: 'bg-orange-100 text-orange-700', label: `${dias}d` }
  return              { cls: 'bg-red-100 text-red-700',          label: `${dias}d` }
}

function filterByAging(rows: ObligacionRow[], filter: string): ObligacionRow[] {
  if (filter === 'all') return rows
  if (filter === '0')   return rows.filter(r => r.dias_vencido === 0)
  if (filter === '30')  return rows.filter(r => r.dias_vencido > 0  && r.dias_vencido <= 30)
  if (filter === '60')  return rows.filter(r => r.dias_vencido > 30 && r.dias_vencido <= 60)
  if (filter === '90')  return rows.filter(r => r.dias_vencido > 60 && r.dias_vencido <= 90)
  if (filter === '91')  return rows.filter(r => r.dias_vencido > 90)
  return rows
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CxPPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const cid = activeCompanyId ?? undefined

  const [agingFilter, setAgingFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const { data: obligaciones = [], isLoading } = useObligaciones(cid)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = obligaciones
    if (q) rows = rows.filter(r =>
      r.supplier.toLowerCase().includes(q) || r.invoice_number.toLowerCase().includes(q)
    )
    return filterByAging(rows, agingFilter)
  }, [obligaciones, search, agingFilter])

  const totalOblig   = obligaciones.reduce((s, r) => s + r.balance_due, 0)
  const overdueCount = obligaciones.filter(r => r.dias_vencido > 0).length

  const onExport = () => {
    const cols: ExcelColumn<ObligacionRow>[] = [
      { header: 'Proveedor',    key: 'supplier',                                  width: 28 },
      { header: 'Factura #',    key: 'invoice_number',                            width: 14 },
      { header: 'Emisión',      key: r => fmtDate(r.issue_date),                  width: 14 },
      { header: 'Vencimiento',  key: r => fmtDate(r.due_date),                    width: 14 },
      { header: 'Total',        key: r => fmtCOP(r.total),                        width: 14 },
      { header: 'Saldo',        key: r => fmtCOP(r.balance_due),                  width: 14 },
      { header: 'Días vencido', key: r => String(r.dias_vencido),                 width: 12 },
    ]
    exportToExcel(filtered, cols, `cxp_${new Date().toISOString().split('T')[0]}`)
  }

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

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Cuentas por Pagar</h1>
        <p className="mt-0.5 text-[13px] text-zinc-400">Facturas pendientes de pago a proveedores.</p>
      </div>

      {/* Resumen + toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-zinc-500">Total obligaciones</p>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">{fmtCOP(totalOblig)}</p>
          </div>
          {overdueCount > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
              <p className="text-xs text-red-600 font-medium">
                {overdueCount} factura{overdueCount !== 1 ? 's' : ''} vencida{overdueCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Buscar proveedor o factura..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 w-56"
          />
          <select
            value={agingFilter}
            onChange={e => setAgingFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {AGING_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Exportar
          </button>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} className="border-zinc-200">
                  {hg.headers.map(h => (
                    <TableHead key={h.id} className="py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} className="border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-zinc-400">
                    No hay facturas pendientes de pago.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
