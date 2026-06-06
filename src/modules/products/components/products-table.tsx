'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import { Package, AlertTriangle } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProducts } from '../queries'
import { ProductForm } from './product-form'
import { useCompanyStore } from '@/store/useCompanyStore'

type Product = {
  id: string
  name: string
  sku: string | null
  description: string | null
  price: number
  stock: number
  stock_minimum: number
  unit: string
  category_id: string | null
  categories: { id: string; name: string } | null
  tax_type: string
  tax_rate: number
  is_taxable: boolean
}

interface ProductsTableProps {
  onSelectionChange?: (ids: string[]) => void
  globalFilter?: string
  /** 'all' | 'in' | 'low' | 'out' | 'reorder' */
  stockFilter?: string
}

export function ProductsTable({
  onSelectionChange,
  globalFilter = '',
  stockFilter = 'all',
}: ProductsTableProps) {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const { data: products = [], isLoading, isError } = useProducts(activeCompanyId ?? undefined)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Resetear selección cuando cambia el filtro/búsqueda
  useEffect(() => {
    setRowSelection({})
    onSelectionChange?.([])
  }, [globalFilter, stockFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrado en memoria
  const filteredData = useMemo(() => {
    let data = products as Product[]

    // Filtro de texto global (nombre, SKU, categoría)
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase()
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          ((p.categories as { name: string } | null)?.name ?? '').toLowerCase().includes(q)
      )
    }

    // Filtro de stock
    if (stockFilter !== 'all') {
      data = data.filter((p) => {
        const min = p.stock_minimum ?? 0
        if (stockFilter === 'out')    return p.stock === 0
        if (stockFilter === 'low')    return p.stock > 0 && p.stock < 10
        if (stockFilter === 'in')     return p.stock >= 10
        if (stockFilter === 'reorder') return min > 0 && p.stock <= min
        return true
      })
    }

    return data
  }, [products, globalFilter, stockFilter])

  const columns: ColumnDef<Product>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected()
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-4 w-4 rounded border-[var(--glass-border)] accent-primary cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-[var(--glass-border)] accent-primary cursor-pointer"
        />
      ),
      size: 40,
    },
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => (
        <div>
          <button
            onClick={() => setEditProduct(row.original)}
            className="font-medium text-primary hover:text-primary/80 hover:underline text-left transition-colors"
          >
            {row.original.name}
          </button>
          {row.original.sku && (
            <p className="text-xs font-mono text-muted-foreground">{row.original.sku}</p>
          )}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Categoría',
      cell: ({ row }) => (
        <span className="text-foreground">
          {(row.original.categories as { name: string } | null)?.name ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Precio',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          ${Number(row.original.price).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      cell: ({ row }) => {
        const { stock, stock_minimum } = row.original
        const min = stock_minimum ?? 0
        const isReorder = min > 0 && stock <= min && stock > 0
        const isOut = stock === 0
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                isOut
                  ? 'bg-red-500/10 border-red-500/20 text-red-700'
                  : isReorder
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                  : stock < 10
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700'
                  : 'bg-green-500/10 border-green-500/20 text-green-700'
              }`}
            >
              {stock}
            </span>
            {isReorder && (
              <span title={`Por reponer (mínimo: ${min})`}>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </span>
            )}
            {isOut && (
              <span title="Sin stock">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'stock_minimum',
      header: 'Mínimo',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">
          {row.original.stock_minimum > 0 ? row.original.stock_minimum : '—'}
        </span>
      ),
    },
  ]

  // Ref para acceder a filteredData desde el effect sin incluirlo como dependencia
  const filteredDataRef = useRef(filteredData)
  filteredDataRef.current = filteredData

  // Notificar al padre SOLO cuando cambia la selección (evita loops infinitos)
  useEffect(() => {
    const selectedIds = Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((rowIndex) => filteredDataRef.current[parseInt(rowIndex)]?.id)
      .filter(Boolean) as string[]
    onSelectionChange?.(selectedIds)
  }, [rowSelection]) // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  })

  if (isLoading)
    return (
      <div className="rounded-2xl glass-surface p-12 text-center">
        <div className="animate-pulse text-muted-foreground">Cargando productos...</div>
      </div>
    )

  if (isError)
    return (
      <div className="rounded-2xl glass-surface border border-red-500/20 bg-red-500/10 p-12 text-center text-red-600">
        Error al cargar productos. Intenta recargar la página.
      </div>
    )

  return (
    <>
      <div className="rounded-2xl glass-surface overflow-hidden">
        <Table>
          <TableHeader className="border-b border-[var(--glass-border)]">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b border-[var(--glass-border)]">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="border-b border-[var(--glass-border)] hover:bg-[var(--glass)] data-[state=selected]:bg-[var(--glass-strong)] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
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
                    <Package className="h-10 w-10 opacity-30" />
                    <div>
                      <p className="text-sm font-medium">
                        {globalFilter || stockFilter !== 'all'
                          ? 'Ningún producto coincide con la búsqueda'
                          : 'No hay productos registrados'}
                      </p>
                      <p className="text-xs">
                        {globalFilter || stockFilter !== 'all'
                          ? 'Intenta con otros términos o cambia el filtro.'
                          : 'Usa el botón Nuevo para agregar tu primer producto.'}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="max-w-xl rounded-2xl glass-surface shadow-xl border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Editar producto</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <ProductForm product={editProduct} onSuccess={() => setEditProduct(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
