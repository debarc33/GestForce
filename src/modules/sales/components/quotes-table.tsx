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
  draft:    { label: 'Borrador',  cls: 'bg-[var(--glass)] border border-[var(--glass-border)] text-muted-foreground' },
  sent:     { label: 'Enviada',   cls: 'bg-blue-500/10 border border-blue-500/20 text-primary' },
  approved: { label: 'Aprobada',  cls: 'bg-green-500/10 border border-green-500/20 text-green-600' },
  rejected: { label: 'Rechazada', cls: 'bg-red-500/10 border border-red-500/20 text-red-600' },
  expired:  { label: 'Caducada',  cls: 'bg-amber-500/10 border border-amber-500/20 text-amber-600' },
}

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

function Badge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-[var(--glass-hover)] text-muted-foreground' }
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
          className="h-4 w-4 rounded border-[var(--glass-border)] accent-primary cursor-pointer" />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-[var(--glass-border)] accent-primary cursor-pointer" />
      ),
    },
    {
      accessorKey: 'quote_number',
      header: '# Cotización',
      cell: ({ row }) => (
        <Link href={`/sales/quotes/${row.original.id}`}
          className="font-mono text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors">
          {row.original.quote_number}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Cliente',
      cell: ({ row }) => (
        <span className="text-foreground">
          {row.original.customer?.name ?? <span className="text-muted-foreground italic">Sin cliente</span>}
        </span>
      ),
    },
    {
      accessorKey: 'issue_date',
      header: 'Emisión',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      accessorKey: 'expiry_date',
      header: 'Vence',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
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
      cell: ({ row }) => <span className="font-medium text-foreground">{fmt(row.original.total)}</span>,
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
                  if (!q.customer?.email) {
                    window.alert('Este cliente no tiene un correo registrado. Agrega su correo en Clientes antes de enviarle la cotización.')
                    return
                  }
                  const companyName = 'GestForce'
                  const fmtMoney = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
                  const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
                  const subject = encodeURIComponent(`Cotización ${q.quote_number} — ${companyName}`)
                  const body = encodeURIComponent(
                    `Estimado/a ${q.customer?.name ?? 'cliente'},\n\n` +
                    `Te comparto la cotización ${q.quote_number} por valor de ${fmtMoney(q.total)}. Recuerda adjuntar el PDF antes de enviar este correo.\n\n` +
                    `Esta cotización es válida ${q.expiry_date ? `hasta el ${fmtD(q.expiry_date)}` : 'por 30 días'}.\n\n` +
                    `Quedo atento/a a cualquier consulta.\n\nSaludos cordiales,\n${companyName}`
                  )
                  window.open(`mailto:${q.customer.email}?subject=${subject}&body=${body}`)
                  statusMut.mutate({ id, status: 'sent' })
                }}
                disabled={isPending}
                title="Enviar al correo y marcar como enviada"
                className="rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            )}
            {/* Aprobar */}
            {(status === 'draft' || status === 'sent') && approvingId !== id && (
              <button onClick={() => setApprovingId(id)} disabled={isPending}
                title="Aprobar cotización"
                className="rounded-md p-1.5 text-green-600 hover:bg-green-500/10 transition-colors disabled:opacity-40">
                <Check className="h-4 w-4" />
              </button>
            )}
            {approvingId === id && (
              <div className="flex items-center gap-1 rounded-lg glass-surface px-2 py-1">
                <span className="text-xs text-muted-foreground mr-1">Aprobar como:</span>
                <button
                  onClick={() => { approveMut.mutate({ id, documentType: 'invoice' }); setApprovingId(null) }}
                  className="rounded px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  Factura
                </button>
                <button
                  onClick={() => { approveMut.mutate({ id, documentType: 'ticket' }); setApprovingId(null) }}
                  className="rounded px-2 py-0.5 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                  Ticket
                </button>
                <button onClick={() => setApprovingId(null)} className="ml-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {/* Rechazar */}
            {(status === 'draft' || status === 'sent') && (
              <button onClick={() => statusMut.mutate({ id, status: 'rejected' })} disabled={isPending}
                title="Rechazar cotización"
                className="rounded-md p-1.5 text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40">
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
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">{actionError}</div>
      )}
      <div className="rounded-2xl glass-surface overflow-hidden">
        <Table>
          <TableHeader className="border-b border-[var(--glass-border)]">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b border-[var(--glass-border)]">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="py-4 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wide">
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
                  className="border-[var(--glass-border)] hover:bg-[var(--glass-hover)] data-[state=selected]:bg-primary/10 transition-colors">
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
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-30" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
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
