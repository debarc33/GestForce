'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useSuppliers } from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building2 } from 'lucide-react'
import { SupplierForm } from './supplier-form'
import type { SupplierRow } from '../queries'

interface SuppliersTableProps {
  companyId?: string
  onSelectionChange?: (ids: string[]) => void
  globalFilter?: string
}

const FISCAL_LABEL: Record<string, string> = {
  no_iva:             'No Resp. IVA',
  iva:                'Resp. IVA',
  gran_contribuyente: 'Gran Contrib.',
}

export function SuppliersTable({
  companyId,
  onSelectionChange,
  globalFilter = '',
}: SuppliersTableProps) {
  const storeCompanyId = useCompanyStore((state) => state.activeCompanyId)
  const activeCompanyId = companyId || storeCompanyId || undefined

  const { data: suppliers = [], isLoading, isError } = useSuppliers(activeCompanyId)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null)

  useEffect(() => {
    setRowSelection({})
    onSelectionChange?.([])
  }, [globalFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredData = useMemo(() => {
    if (!globalFilter.trim()) return suppliers
    const q = globalFilter.trim().toLowerCase()
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').toLowerCase().includes(q) ||
      (s.doc_number ?? '').toLowerCase().includes(q) ||
      (s.city ?? '').toLowerCase().includes(q) ||
      (s.contact_name ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, globalFilter])

  const filteredDataRef = useRef(filteredData)
  filteredDataRef.current = filteredData

  useEffect(() => {
    const ids = Object.keys(rowSelection)
      .filter(k => rowSelection[k])
      .map(i => filteredDataRef.current[parseInt(i)]?.id)
      .filter(Boolean) as string[]
    onSelectionChange?.(ids)
  }, [rowSelection]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnDef<SupplierRow>[] = [
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
      size: 40,
    },
    {
      id: 'nombre',
      header: 'Razón Social / Nombre',
      cell: ({ row }) => (
        <div>
          <button
            onClick={() => setEditingSupplier(row.original)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors"
          >
            {row.original.name}
          </button>
          {row.original.city && (
            <p className="text-xs text-zinc-400">{row.original.city}{row.original.department ? `, ${row.original.department}` : ''}</p>
          )}
          {row.original.contact_name && (
            <p className="text-xs text-zinc-400">Contacto: {row.original.contact_name}</p>
          )}
        </div>
      ),
    },
    {
      id: 'documento',
      header: 'Documento',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-zinc-500">{row.original.doc_type}</span>
          {row.original.doc_number && (
            <span className="ml-1 text-sm text-zinc-700">{row.original.doc_number}</span>
          )}
          {!row.original.doc_number && <span className="text-zinc-400 text-xs ml-1">—</span>}
        </div>
      ),
    },
    {
      id: 'contacto',
      header: 'Contacto',
      cell: ({ row }) => (
        <div>
          {row.original.email && <p className="text-sm text-zinc-600">{row.original.email}</p>}
          {row.original.phone && <p className="text-xs text-zinc-400">{row.original.phone}</p>}
          {!row.original.email && !row.original.phone && <span className="text-zinc-400">—</span>}
        </div>
      ),
    },
    {
      id: 'fiscal',
      header: 'Régimen',
      cell: ({ row }) => (
        <span className="text-xs text-zinc-500">
          {FISCAL_LABEL[row.original.fiscal_regime] ?? row.original.fiscal_regime}
        </span>
      ),
    },
    {
      id: 'pago',
      header: 'Días pago',
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600">
          {row.original.payment_days != null ? `${row.original.payment_days} días` : '—'}
        </span>
      ),
    },
  ]

  const table = useReactTable({
    data: filteredData, columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  })

  if (isLoading) return (
    <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
      <div className="animate-pulse text-zinc-400">Cargando proveedores...</div>
    </div>
  )

  if (isError) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center text-red-700 shadow-sm">
      Error al cargar proveedores. Intenta recargar la página.
    </div>
  )

  return (
    <>
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
                <TableRow key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="border-zinc-100 hover:bg-zinc-50/60 data-[state=selected]:bg-blue-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <Building2 className="h-10 w-10 opacity-30" />
                    <div>
                      <p className="text-sm font-medium">
                        {globalFilter
                          ? 'Ningún proveedor coincide con la búsqueda'
                          : 'No hay proveedores registrados'}
                      </p>
                      <p className="text-xs">
                        {globalFilter
                          ? 'Intenta con otros términos.'
                          : 'Usa el botón Nuevo para agregar tu primer proveedor.'}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de edición */}
      <Dialog open={!!editingSupplier} onOpenChange={(v) => { if (!v) setEditingSupplier(null) }}>
        <DialogContent className="sm:max-w-3xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          {editingSupplier && (
            <SupplierForm
              supplier={editingSupplier}
              onSuccess={() => setEditingSupplier(null)}
              onCancel={() => setEditingSupplier(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
