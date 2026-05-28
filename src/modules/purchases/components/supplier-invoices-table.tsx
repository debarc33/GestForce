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
  pending:   { label: 'Pendiente',  cls: 'bg-red-50 text-red-600' },
  partial:   { label: 'Parcial',    cls: 'bg-amber-50 text-amber-700' },
  paid:      { label: 'Pagada',     cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Anulada',    cls: 'bg-zinc-100 text-zinc-500' },
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
          className="h-4 w-4 rounded border-zinc-300 accent-blue-600 cursor-pointer" />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-zinc-300 accent-blue-600 cursor-pointer" />
      ),
    },
    {
      accessorKey: 'invoice_number',
      header: '# Factura',
      cell: ({ row }) => (
        <div>
          <Link href={`/purchases/invoices/${row.original.id}`}
            className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors">
            {row.original.invoice_number}
          </Link>
          {row.original.supplier_invoice_no && (
            <p className="text-xs text-zinc-400 font-mono">Prov: {row.original.supplier_invoice_no}</p>
          )}
          {row.original.order_number && (
            <p className="text-xs text-zinc-400 font-mono">{row.original.order_number}</p>
          )}
        </div>
      ),
    },
    {
      id: 'supplier',
      header: 'Proveedor',
      cell: ({ row }) => (
        <span className="text-zinc-700">
          {row.original.supplier?.name ?? <span className="text-zinc-400 italic">Sin proveedor</span>}
        </span>
      ),
    },
    {
      accessorKey: 'issue_date',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-zinc-500 text-sm">
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
      cell: ({ row }) => <span className="font-medium text-zinc-900">{fmt(row.original.total)}</span>,
    },
    {
      accessorKey: 'balance_due',
      header: 'Saldo',
      cell: ({ row }) => <span className="text-zinc-600 text-sm">{fmt(row.original.balance_due)}</span>,
    },
  ]

  const table = useReactTable({
    data: filteredData, columns, getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection, state: { rowSelection },
  })

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-zinc-50/50">
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id} className="border-zinc-200 hover:bg-zinc-50/30">
              {hg.headers.map(h => (
                <TableHead key={h.id} className="py-3 font-semibold text-zinc-600 text-xs uppercase tracking-wide">
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
                className="border-zinc-100 hover:bg-zinc-50/60 data-[state=selected]:bg-blue-50/50 transition-colors">
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
                <div className="flex flex-col items-center gap-3 text-zinc-400">
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
