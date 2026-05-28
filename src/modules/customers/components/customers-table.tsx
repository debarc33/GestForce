'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useCustomers } from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserSquare2, Eye, Pencil, MoreHorizontal, Mail, Phone } from 'lucide-react'
import { CustomerForm } from './customer-form'
import { cn } from '@/lib/utils'

/* ── Types ───────────────────────────────────────────────────── */

type Customer = {
  id: string
  name: string
  doc_type: string
  doc_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  fiscal_regime: string
  payment_type: string | null
  credit_days: number | null
  referencia: string | null
}

interface CustomersTableProps {
  companyId?: string
  onSelectionChange?: (ids: string[]) => void
  globalFilter?: string
  paymentFilter?: string
}

/* ── Helpers ─────────────────────────────────────────────────── */

const FISCAL_LABEL: Record<string, string> = {
  no_iva:             'No Resp. IVA',
  iva:                'Resp. IVA',
  gran_contribuyente: 'Gran Contrib.',
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

/* ── Pagination ──────────────────────────────────────────────── */

const PAGE_SIZES = [10, 20, 50]

/* ── Componente ──────────────────────────────────────────────── */

export function CustomersTable({
  companyId,
  onSelectionChange,
  globalFilter = '',
  paymentFilter = 'all',
}: CustomersTableProps) {
  const storeCompanyId  = useCompanyStore((state) => state.activeCompanyId)
  const activeCompanyId = companyId || storeCompanyId || undefined

  const { data: customers = [], isLoading, isError } = useCustomers(activeCompanyId)
  const [rowSelection, setRowSelection]   = useState<RowSelectionState>({})
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [viewCustomer, setViewCustomer]   = useState<Customer | null>(null)
  const [pageIndex, setPageIndex]         = useState(0)
  const [pageSize, setPageSize]           = useState(10)
  const [openMoreId, setOpenMoreId]       = useState<string | null>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  // Reset selección al cambiar filtros
  useEffect(() => {
    setRowSelection({})
    onSelectionChange?.([])
    setPageIndex(0)
  }, [globalFilter, paymentFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close "more" dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setOpenMoreId(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Datos filtrados
  const filteredData = useMemo(() => {
    let data = customers as Customer[]
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase()
      data = data.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.doc_number ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.referencia ?? '').toLowerCase().includes(q)
      )
    }
    if (paymentFilter !== 'all') {
      data = data.filter(c => (c.payment_type ?? '').toLowerCase() === paymentFilter.toLowerCase())
    }
    return data
  }, [customers, globalFilter, paymentFilter])

  // Paginación
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  // Sync selección → ids
  const filteredDataRef = useRef(filteredData)
  filteredDataRef.current = filteredData

  useEffect(() => {
    const ids = Object.keys(rowSelection)
      .filter(k => rowSelection[k])
      .map(i => filteredDataRef.current[parseInt(i)]?.id)
      .filter(Boolean) as string[]
    onSelectionChange?.(ids)
  }, [rowSelection]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Columnas ─────────────────────────────────────────────── */
  const columns: ColumnDef<Customer>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 cursor-pointer"
        />
      ),
      size: 40,
    },
    {
      id: 'nombre',
      header: 'Nombre / Razón Social',
      cell: ({ row }) => {
        const c = row.original
        const avatarColor = getAvatarColor(c.name)
        const initials = getInitials(c.name)
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
              avatarColor
            )}>
              {initials}
            </div>
            <div className="min-w-0">
              <button
                onClick={() => setEditingCustomer(c)}
                className="font-semibold text-slate-800 hover:text-blue-600 text-[13px] transition-colors text-left truncate max-w-[200px]"
              >
                {c.name}
              </button>
              {c.city && (
                <p className="text-[11px] text-slate-400 truncate">
                  {c.city}{c.department ? `, ${c.department}` : ''}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'documento',
      header: 'Documento',
      cell: ({ row }) => {
        const c = row.original
        return (
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wide">{c.doc_type}</span>
            {c.doc_number
              ? <p className="text-[13px] font-medium text-slate-700">{c.doc_number}</p>
              : <p className="text-slate-300 text-sm">—</p>
            }
          </div>
        )
      },
    },
    {
      id: 'contacto',
      header: 'Contacto',
      cell: ({ row }) => {
        const c = row.original
        if (!c.email && !c.phone) return <span className="text-slate-300">—</span>
        return (
          <div className="space-y-0.5">
            {c.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-slate-300 shrink-0" />
                <span className="text-[12px] text-slate-600 truncate max-w-[160px]">{c.email}</span>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-slate-300 shrink-0" />
                <span className="text-[12px] text-slate-500">{c.phone}</span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'fiscal',
      header: 'Régimen',
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {FISCAL_LABEL[row.original.fiscal_regime] ?? row.original.fiscal_regime}
        </span>
      ),
    },
    {
      id: 'pago',
      header: 'Tipo Pago',
      cell: ({ row }) => {
        const c = row.original
        if (!c.payment_type) return <span className="text-slate-300 text-sm">—</span>
        const isCredito = c.payment_type.toLowerCase() === 'credito'
        return (
          <div>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
              isCredito
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            )}>
              {c.payment_type}
            </span>
            {isCredito && c.credit_days != null && c.credit_days > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">{c.credit_days}d</p>
            )}
          </div>
        )
      },
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="flex items-center gap-0.5 justify-end">
            <button
              onClick={() => setViewCustomer(c)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEditingCustomer(c)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <div className="relative" ref={openMoreId === c.id ? moreRef : null}>
              <button
                onClick={() => setOpenMoreId(openMoreId === c.id ? null : c.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Más opciones"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {openMoreId === c.id && (
                <div className="absolute right-0 top-full mt-1 w-36 animate-fade-in rounded-lg border border-slate-200 bg-white py-1 shadow-xl z-50">
                  <button
                    onClick={() => { setEditingCustomer(c); setOpenMoreId(null) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Pencil className="h-3 w-3 text-slate-400" />
                    Editar
                  </button>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    onClick={() => setOpenMoreId(null)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      },
      size: 100,
    },
  ]

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  })

  /* ── Estados de carga ─────────────────────────────────────── */

  if (isLoading) return (
    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-[13px] text-slate-400">Cargando clientes...</p>
      </div>
    </div>
  )

  if (isError) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center shadow-sm">
      <p className="text-[13px] text-red-600 font-medium">Error al cargar clientes. Intenta recargar la página.</p>
    </div>
  )

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in-up">
        <table className="w-full table-premium">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} style={{ width: h.column.getSize() !== 150 ? h.column.getSize() : undefined }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(
                    'transition-colors',
                    row.getIsSelected() ? 'bg-blue-50/60' : ''
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-48 text-center" style={{ padding: '0' }}>
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <UserSquare2 className="h-5 w-5 opacity-40" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-slate-600">
                        {globalFilter || paymentFilter !== 'all'
                          ? 'Ningún cliente coincide con la búsqueda'
                          : 'No hay clientes registrados'}
                      </p>
                      <p className="text-[12px] text-slate-400 mt-0.5">
                        {globalFilter || paymentFilter !== 'all'
                          ? 'Intenta con otros términos de búsqueda.'
                          : 'Usa el botón Nuevo para agregar tu primer cliente.'}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Paginación ────────────────────────────────────── */}
        {filteredData.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-400">
              Mostrando{' '}
              <span className="font-medium text-slate-600">
                {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filteredData.length)}
              </span>{' '}
              de{' '}
              <span className="font-medium text-slate-600">{filteredData.length}</span> resultados
            </p>

            <div className="flex items-center gap-3">
              {/* Page size */}
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <span>Filas</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPageIndex(0) }}
                  className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Prev / pages / Next */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPageIndex(p => Math.max(0, p - 1))}
                  disabled={pageIndex === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i : Math.max(0, Math.min(pageIndex - 2, totalPages - 5)) + i
                  return (
                    <button
                      key={p}
                      onClick={() => setPageIndex(p)}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-medium transition-colors',
                        p === pageIndex
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {p + 1}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
                  disabled={pageIndex >= totalPages - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Editar cliente ──────────────────────────────── */}
      <Dialog open={!!editingCustomer} onOpenChange={(v) => { if (!v) setEditingCustomer(null) }}>
        <DialogContent className="max-w-xl rounded-2xl border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              {editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}
            </DialogTitle>
          </DialogHeader>
          {editingCustomer && (
            <CustomerForm
              customer={editingCustomer}
              onSuccess={() => setEditingCustomer(null)}
              onCancel={() => setEditingCustomer(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Ver detalle ─────────────────────────────────── */}
      <Dialog open={!!viewCustomer} onOpenChange={(v) => { if (!v) setViewCustomer(null) }}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Detalle del cliente
            </DialogTitle>
          </DialogHeader>
          {viewCustomer && (
            <div className="space-y-4 pt-1">
              {/* Avatar + nombre */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold',
                  getAvatarColor(viewCustomer.name)
                )}>
                  {getInitials(viewCustomer.name)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{viewCustomer.name}</p>
                  <p className="text-[12px] text-slate-400">
                    {viewCustomer.doc_type} {viewCustomer.doc_number}
                  </p>
                </div>
              </div>

              {/* Campos */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Email',      value: viewCustomer.email },
                  { label: 'Teléfono',   value: viewCustomer.phone },
                  { label: 'Ciudad',     value: viewCustomer.city },
                  { label: 'Dirección',  value: viewCustomer.address },
                  { label: 'Régimen',    value: FISCAL_LABEL[viewCustomer.fiscal_regime] ?? viewCustomer.fiscal_regime },
                  { label: 'Tipo Pago',  value: viewCustomer.payment_type },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-0.5 text-[13px] text-slate-700 font-medium">{value ?? '—'}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setViewCustomer(null); setEditingCustomer(viewCustomer) }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
