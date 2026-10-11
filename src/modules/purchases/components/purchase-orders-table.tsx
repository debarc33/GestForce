'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PurchaseOrderWithSupplier } from '../queries'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Borrador', cls: 'bg-[var(--glass)] border border-[var(--glass-border)] text-muted-foreground' },
  sent:      { label: 'Enviada',  cls: 'bg-blue-500/10 border border-blue-500/20 text-primary' },
  received:  { label: 'Recibida', cls: 'bg-green-500/10 border border-green-500/20 text-green-600' },
  cancelled: { label: 'Anulada',  cls: 'bg-red-500/10 border border-red-500/20 text-red-600' },
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

interface Props {
  orders: PurchaseOrderWithSupplier[]
  companyId: string
  onSelectionChange?: (ids: string[]) => void
  globalFilter?: string
  statusFilter?: string
}

export function PurchaseOrdersTable({
  orders,
  companyId: _companyId,
  onSelectionChange,
  globalFilter = '',
  statusFilter = 'all',
}: Props) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const filteredData = useMemo(() => {
    let data = orders
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase()
      data = data.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        (o.supplier?.name ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') data = data.filter(o => o.status === statusFilter)
    return data
  }, [orders, globalFilter, statusFilter])

  const filteredRef = useRef(filteredData)
  filteredRef.current = filteredData

  useEffect(() => { setRowSelection({}); onSelectionChange?.([]) }, [globalFilter, statusFilter]) // eslint-disable-line

  useEffect(() => {
    const ids = Object.keys(rowSelection).filter(k => rowSelection[k])
      .map(i => filteredRef.current[parseInt(i)]?.id).filter(Boolean) as string[]
    onSelectionChange?.(ids)
  }, [rowSelection]) // eslint-disable-line

  const columns: ColumnDef<PurchaseOrderWithSupplier>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox" checked={table.getIsAllPageRowsSelected()}
          ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
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
      accessorKey: 'order_number',
      header: '# Orden',
      cell: ({ row }) => (
        <Link href={`/purchases/orders/${row.original.id}`}
          className="font-mono text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors">
          {row.original.order_number}
        </Link>
      ),
    },
    {
      id: 'supplier',
      header: 'Proveedor',
      cell: ({ row }) => (
        <span className="text-foreground">
          {row.original.supplier?.name ?? <span className="text-muted-foreground italic">Sin proveedor</span>}
        </span>
      ),
    },
    {
      accessorKey: 'issue_date',
      header: 'Fecha emisión',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      accessorKey: 'expected_date',
      header: 'Entrega esperada',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.expected_date
            ? new Date(row.original.expected_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            : <span className="text-muted-foreground/50">—</span>}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const cfg = STATUS_CFG[row.original.status] ?? STATUS_CFG.draft
        return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
      },
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="font-medium text-foreground">{fmt(row.original.total)}</span>,
    },
  ]

  const table = useReactTable({
    data: filteredData, columns, getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection, state: { rowSelection },
  })

  return (
    <>
      {/* Escritorio/tablet (≥ md): tabla normal */}
      <div className="hidden md:block rounded-2xl glass-surface overflow-hidden">
        <Table>
          <TableHeader className="border-b border-[var(--glass-border)]">
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="border-b border-[var(--glass-border)]">
                {hg.headers.map(h => (
                  <TableHead key={h.id} className="py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="border-b border-[var(--glass-border)] hover:bg-[var(--glass)] data-[state=selected]:bg-[var(--glass-strong)] transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <ShoppingBag className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">
                      {globalFilter || statusFilter !== 'all'
                        ? 'Ninguna orden coincide'
                        : 'No hay órdenes de compra — crea la primera con el botón Nueva OC'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Celular (< md): tarjetas apiladas en vez de tabla con scroll horizontal
          — Fase 4, punto 10 del plan de corrección UX/UI. */}
      <div className="md:hidden rounded-2xl glass-surface overflow-hidden divide-y divide-[var(--glass-border)]">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map(row => {
            const o = row.original
            const cfg = STATUS_CFG[o.status] ?? STATUS_CFG.draft
            return (
              <div key={row.id} className={row.getIsSelected() ? 'bg-[var(--glass-strong)]' : undefined}>
                <div className="flex items-start gap-3 p-4">
                  <input type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--glass-border)] accent-primary cursor-pointer" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/purchases/orders/${o.id}`}
                        className="font-mono text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors">
                        {o.order_number}
                      </Link>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-foreground">
                      {o.supplier?.name ?? <span className="text-muted-foreground italic">Sin proveedor</span>}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {o.expected_date && ` · entrega ${new Date(o.expected_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                      </span>
                      <span className="text-sm font-medium text-foreground">{fmt(o.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">
              {globalFilter || statusFilter !== 'all'
                ? 'Ninguna orden coincide'
                : 'No hay órdenes de compra — crea la primera con el botón Nueva OC'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
