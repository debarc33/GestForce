'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SupplierInvoiceWithDetails } from '../queries'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendiente',  cls: 'bg-red-500/10 border border-red-500/20 text-red-600' },
  partial:   { label: 'Parcial',    cls: 'bg-amber-500/10 border border-amber-500/20 text-amber-700' },
  paid:      { label: 'Pagada',     cls: 'bg-green-500/10 border border-green-500/20 text-green-700' },
  cancelled: { label: 'Anulada',    cls: 'bg-zinc-500/10 border border-zinc-500/20 text-muted-foreground' },
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

interface Props {
  invoices: SupplierInvoiceWithDetails[]
  onSelectionChange?: (ids: string[]) => void
  globalFilter?: string
  statusFilter?: string
}

export function SupplierInvoicesTable({
  invoices,
  onSelectionChange,
  globalFilter = '',
  statusFilter = 'all',
}: Props) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const filteredData = useMemo(() => {
    let data = invoices
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase()
      data = data.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.supplier?.name ?? '').toLowerCase().includes(q) ||
        (inv.supplier_invoice_no ?? '').toLowerCase().includes(q) ||
        (inv.order_number ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') data = data.filter(inv => inv.status === statusFilter)
    return data
  }, [invoices, globalFilter, statusFilter])

  const filteredRef = useRef(filteredData)
  filteredRef.current = filteredData

  useEffect(() => { setRowSelection({}); onSelectionChange?.([]) }, [globalFilter, statusFilter]) // eslint-disable-line

  useEffect(() => {
    const ids = Object.keys(rowSelection).filter(k => rowSelection[k])
      .map(i => filteredRef.current[parseInt(i)]?.id).filter(Boolean) as string[]
    onSelectionChange?.(ids)
  }, [rowSelection]) // eslint-disable-line

  const columns: ColumnDef<SupplierInvoiceWithDetails>[] = [
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
      accessorKey: 'invoice_number',
      header: '# Factura',
      cell: ({ row }) => (
        <div>
          <Link href={`/purchases/invoices/${row.original.id}`}
            className="font-mono text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors">
            {row.original.invoice_number}
          </Link>
          {row.original.supplier_invoice_no && (
            <p className="text-xs text-muted-foreground font-mono">Prov: {row.original.supplier_invoice_no}</p>
          )}
          {row.original.order_number && (
            <p className="text-xs text-muted-foreground font-mono">{row.original.order_number}</p>
          )}
        </div>
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
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const cfg = STATUS_CFG[row.original.status] ?? STATUS_CFG.pending
        return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
      },
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="font-medium text-foreground">{fmt(row.original.total)}</span>,
    },
    {
      accessorKey: 'balance_due',
      header: 'Saldo',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{fmt(row.original.balance_due)}</span>,
    },
  ]

  const table = useReactTable({
    data: filteredData, columns, getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection, state: { rowSelection },
  })

  return (
    <div className="rounded-2xl glass-surface overflow-hidden">
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
                  <FileText className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">
                    {globalFilter || statusFilter !== 'all'
                      ? 'Ninguna factura coincide'
                      : 'No hay facturas de proveedor — recibe una orden de compra primero'}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
