'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import { Check, X, Send, FileText } from 'lucide-react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveQuote, updateQuoteStatus, type QuoteWithCustomer } from '../queries'

// ─── Status config ────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Borrador',  cls: 'bg-zinc-100 text-zinc-600' },
  sent:     { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Aprobada',  cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-600' },
  expired:  { label: 'Caducada',  cls: 'bg-amber-100 text-amber-700' },
}

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

function Badge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-zinc-100 text-zinc-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────

interface Props {
  quotes: QuoteWithCustomer[]
  companyId: string
  onSelectionChange?: (ids: string[]) => void
  globalFilter?: string
  statusFilter?: string
}

export function QuotesTable({ quotes, companyId, onSelectionChange, globalFilter = '', statusFilter = 'all' }: Props) {
  const queryClient = useQueryClient()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const filteredData = useMemo(() => {
    let data = quotes
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase()
      data = data.filter(
        (item) =>
          item.quote_number.toLowerCase().includes(q) ||
          (item.customer?.name ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') data = data.filter((item) => item.status === statusFilter)
    return data
  }, [quotes, globalFilter, statusFilter])

  const filteredRef = useRef(filteredData)
  filteredRef.current = filteredData

  useEffect(() => { setRowSelection({}); onSelectionChange?.([]) }, [globalFilter, statusFilter]) // eslint-disable-line
  useEffect(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
      .map((i) => filteredRef.current[parseInt(i)]?.id).filter(Boolean) as string[]
    onSelectionChange?.(ids)
  }, [rowSelection]) // eslint-disable-line

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['quotes', companyId] })
    queryClient.invalidateQueries({ queryKey: ['invoices', companyId] })
    setActionError(null)
  }

  const approveMut = useMutation({
    mutationFn: ({ id, documentType }: { id: string; documentType: 'invoice' | 'ticket' }) =>
      approveQuote(id, documentType),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'sent' | 'rejected' | 'expired' }) =>
      updateQuoteStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotes', companyId] }); setActionError(null) },
    onError: (e: Error) => setActionError(e.message),
  })

  const columns: ColumnDef<QuoteWithCustomer>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox" checked={table.getIsAllPageRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-4 w-4 rounded border-zinc-300 accent-blue-600 cursor-pointer" />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-zinc-300 accent-blue-600 cursor-pointer" />
      ),
    },
    {
      accessorKey: 'quote_number',
      header: '# Cotización',
      cell: ({ row }) => (
        <Link href={`/sales/quotes/${row.original.id}`}
          className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors">
          {row.original.quote_number}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Cliente',
      cell: ({ row }) => (
        <span className="text-zinc-700">
          {row.original.customer?.name ?? <span className="text-zinc-400 italic">Sin cliente</span>}
        </span>
      ),
    },
    {
      accessorKey: 'issue_date',
      header: 'Emisión',
      cell: ({ row }) => (
        <span className="text-zinc-500 text-sm">
          {new Date(row.original.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      accessorKey: 'expiry_date',
      header: 'Vence',
      cell: ({ row }) => (
        <span className="text-zinc-500 text-sm">
          {row.original.expiry_date
            ? new Date(row.original.expiry_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </span>
      ),
    },
    { id: 'status', header: 'Estado', cell: ({ row }) => <Badge status={row.original.status} /> },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="font-medium text-zinc-900">{fmt(row.original.total)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const { status, id } = row.original
        const isPending = approveMut.isPending || statusMut.isPending
        if (status === 'approved' || status === 'rejected' || status === 'expired') return null
        return (
          <div className="flex items-center gap-1">
            {/* Enviar — marca como enviada Y abre cliente de correo */}
            {status === 'draft' && (
              <button
                onClick={() => {
                  const q = row.original
                  const companyName = 'GestForce'
                  const fmtMoney = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
                  const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
                  const subject = encodeURIComponent(`Cotización ${q.quote_number} — ${companyName}`)
                  const body = encodeURIComponent(
                    `Estimado/a ${q.customer?.name ?? 'cliente'},\n\n` +
                    `Adjuntamos la cotización ${q.quote_number} por valor de ${fmtMoney(q.total)}.\n\n` +
                    `Esta cotización es válida ${q.expiry_date ? `hasta el ${fmtD(q.expiry_date)}` : 'por 30 días'}.\n\n` +
                    `Quedo atento/a a cualquier consulta.\n\nSaludos cordiales,\n${companyName}`
                  )
                  window.open(`mailto:${q.customer?.email ?? ''}?subject=${subject}&body=${body}`)
                  statusMut.mutate({ id, status: 'sent' })
                }}
                disabled={isPending}
                title="Enviar al correo y marcar como enviada"
                className="rounded-md p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            )}
            {/* Aprobar */}
            {(status === 'draft' || status === 'sent') && approvingId !== id && (
              <button onClick={() => setApprovingId(id)} disabled={isPending}
                title="Aprobar cotización"
                className="rounded-md p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors disabled:opacity-40">
                <Check className="h-4 w-4" />
              </button>
            )}
            {approvingId === id && (
              <div className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1">
                <span className="text-xs text-zinc-500 mr-1">Aprobar como:</span>
                <button
                  onClick={() => { approveMut.mutate({ id, documentType: 'invoice' }); setApprovingId(null) }}
                  className="rounded px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  Factura
                </button>
                <button
                  onClick={() => { approveMut.mutate({ id, documentType: 'ticket' }); setApprovingId(null) }}
                  className="rounded px-2 py-0.5 text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  Ticket
                </button>
                <button onClick={() => setApprovingId(null)} className="ml-1 text-zinc-400 hover:text-zinc-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {/* Rechazar */}
            {(status === 'draft' || status === 'sent') && (
              <button onClick={() => statusMut.mutate({ id, status: 'rejected' })} disabled={isPending}
                title="Rechazar cotización"
                className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData, columns, getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection, state: { rowSelection },
  })

  return (
    <>
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}
      <div className="rounded-xl border border-zinc-100 bg-white shadow-md overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-zinc-200 hover:bg-zinc-50">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="py-4 px-4 font-semibold text-zinc-700 text-[12px] uppercase tracking-wide">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="border-zinc-100 hover:bg-zinc-50/60 data-[state=selected]:bg-blue-50/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <FileText className="h-10 w-10 opacity-30" />
                    <div>
                      <p className="text-sm font-medium">
                        {globalFilter || statusFilter !== 'all' ? 'Ninguna cotización coincide' : 'No hay cotizaciones'}
                      </p>
                      <p className="text-xs">
                        {globalFilter || statusFilter !== 'all' ? 'Cambia los filtros.' : 'Usa Nuevo para crear la primera cotización.'}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
