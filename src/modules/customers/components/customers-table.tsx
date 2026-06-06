'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useCustomers } from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserSquare2, Pencil, MoreHorizontal, Mail, Phone } from 'lucide-react'
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
  fiscalFilter?: string
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
  fiscalFilter = 'all',
}: CustomersTableProps) {
  const storeCompanyId  = useCompanyStore((state) => state.activeCompanyId)
  const activeCompanyId = companyId || storeCompanyId || undefined

  const { data: customers = [], isLoading, isError } = useCustomers(activeCompanyId)
  const [rowSelection, setRowSelection]   = useState<RowSelectionState>({})
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [pageIndex, setPageIndex]         = useState(0)
  const [pageSize, setPageSize]           = useState(10)
  const [openMoreId, setOpenMoreId]       = useState<string | null>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  // Reset selección al cambiar filtros
  useEffect(() => {
    setRowSelection({})
    onSelectionChange?.([])
    setPageIndex(0)
  }, [globalFilter, fiscalFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (fiscalFilter !== 'all') {
      data = data.filter(c => c.fiscal_regime === fiscalFilter)
    }
    return data
  }, [customers, globalFilter, fiscalFilter])

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
          className="h-3.5 w-3.5 rounded border-[var(--glass-border)] accent-primary cursor-pointer"
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
                className="font-semibold text-foreground hover:text-primary text-[13px] transition-colors text-left truncate max-w-[200px] hover:underline underline-offset-2"
              >
                {c.name}
              </button>
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
            <span className="text-[10px] font-bold text-muted-foreground tracking-wide">{c.doc_type}</span>
            {c.doc_number
              ? <p className="text-[13px] font-medium text-foreground">{c.doc_number}</p>
              : <p className="text-muted-foreground text-sm">—</p>
            }
          </div>
        )
      },
    },
    {
      id: 'contacto',
      header: 'Email',
      cell: ({ row }) => {
        const c = row.original
        if (!c.email) return <span className="text-slate-300">—</span>
        return (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[12px] text-muted-foreground truncate max-w-[160px]">{c.email}</span>
          </div>
        )
      },
    },
    {
      id: 'celular',
      header: 'Celular',
      cell: ({ row }) => {
        const c = row.original
        if (!c.phone) return <span className="text-slate-300">—</span>
        return (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[12px] text-muted-foreground">{c.phone}</span>
          </div>
        )
      },
    },
    {
      id: 'fiscal',
      header: 'Régimen',
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-[var(--glass)] border border-[var(--glass-border)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {FISCAL_LABEL[row.original.fiscal_regime] ?? row.original.fiscal_regime}
        </span>
      ),
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="flex items-center gap-0.5 justify-end">
            <button
              onClick={() => setEditingCustomer(c)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass)] hover:text-foreground transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <div className="relative" ref={openMoreId === c.id ? moreRef : null}>
              <button
                onClick={() => setOpenMoreId(openMoreId === c.id ? null : c.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass)] hover:text-foreground transition-colors"
                title="Más opciones"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {openMoreId === c.id && (
                <div className="absolute right-0 top-full mt-1 w-36 animate-[slideUp_220ms_ease] rounded-lg glass-surface-strong py-1 z-50">
                  <button
                    onClick={() => setOpenMoreId(null)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/10 transition-colors"
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
    <div className="rounded-2xl glass-surface p-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-[13px] text-muted-foreground">Cargando clientes...</p>
      </div>
    </div>
  )

  if (isError) return (
    <div className="rounded-2xl glass-surface border border-destructive/20 p-12 text-center">
      <p className="text-[13px] text-destructive font-medium">Error al cargar clientes. Intenta recargar la página.</p>
    </div>
  )

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <>
      <div className="rounded-2xl glass-surface overflow-hidden animate-[slideUp_250ms_ease]">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-[var(--glass-border)]">
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    style={{ width: h.column.getSize() !== 150 ? h.column.getSize() : undefined }}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
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
                    'border-b border-[var(--glass-border)] transition-colors',
                    row.getIsSelected() ? 'bg-[var(--glass-strong)]' : 'hover:bg-[var(--glass)]'
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-48 text-center" style={{ padding: '0' }}>
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--glass)]">
                      <UserSquare2 className="h-5 w-5 opacity-40" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        {globalFilter || paymentFilter !== 'all'
                          ? 'Ningún cliente coincide con la búsqueda'
                          : 'No hay clientes registrados'}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
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
          <div className="flex items-center justify-between border-t border-[var(--glass-border)] px-4 py-3">
            <p className="text-[12px] text-muted-foreground">
              Mostrando{' '}
              <span className="font-medium text-foreground">
                {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filteredData.length)}
              </span>{' '}
              de{' '}
              <span className="font-medium text-foreground">{filteredData.length}</span> resultados
            </p>

            <div className="flex items-center gap-3">
              {/* Page size */}
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span>Filas</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPageIndex(0) }}
                  className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-1.5 py-0.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                >
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Prev / pages / Next */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPageIndex(p => Math.max(0, p - 1))}
                  disabled={pageIndex === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--glass-border)] text-muted-foreground hover:bg-[var(--glass)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
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
                          ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glass)]'
                          : 'border border-[var(--glass-border)] text-muted-foreground hover:bg-[var(--glass)]'
                      )}
                    >
                      {p + 1}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
                  disabled={pageIndex >= totalPages - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--glass-border)] text-muted-foreground hover:bg-[var(--glass)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
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
        <DialogContent className="sm:max-w-xl rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-[var(--shadow-pop)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
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

    </>
  )
}
