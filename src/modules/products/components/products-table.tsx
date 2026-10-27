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
import { useProducts, isLowStock } from '../queries'
import { ProductForm } from './product-form'
import { useCompanyStore } from '@/store/useCompanyStore'

type Product = {
  id: string
  name: string
  sku: string | null
  description: string | null
  price: number
  precio_compra: number | null
  margen_ganancia: number | null
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
  /** 'all' | 'in' | 'reorder' | 'out' */
  stockFilter?: string
}

const PAGE_SIZES = [10, 20, 50]

export function ProductsTable({
  onSelectionChange,
  globalFilter = '',
  stockFilter = 'all',
}: ProductsTableProps) {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const { data: products = [], isLoading, isError } = useProducts(activeCompanyId ?? undefined)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // Resetear selección y página cuando cambia el filtro/búsqueda
  useEffect(() => {
    setRowSelection({})
    onSelectionChange?.([])
    setPageIndex(0)
  }, [globalFilter, stockFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resetear selección al cambiar de página. Los IDs de fila de
  // @tanstack/react-table son el índice dentro de `paginatedData` (el
  // array de la página actual) — si no se limpia aquí, una fila marcada
  // en la página 2 (p. ej. índice 2) queda "pegada" en rowSelection y,
  // al volver a la página 1, se renderiza como seleccionada la fila que
  // ocupe ese mismo índice ahí (un producto totalmente distinto), sin que
  // el usuario la haya tocado — riesgo real en una eliminación masiva.
  useEffect(() => {
    setRowSelection({})
    onSelectionChange?.([])
  }, [pageIndex]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (stockFilter === 'out')     return p.stock === 0
        if (stockFilter === 'reorder') return isLowStock(p.stock, p.stock_minimum)
        if (stockFilter === 'in')      return p.stock > 0 && !isLowStock(p.stock, p.stock_minimum)
        return true
      })
    }

    return data
  }, [products, globalFilter, stockFilter])

  // Paginación (en memoria, sobre los datos ya filtrados)
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const paginatedData = useMemo(
    () => filteredData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredData, pageIndex, pageSize]
  )

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
      // Se relabela a "Venta" (25 oct 2026): ahora que el producto también
      // tiene precio de Compra (ver product-form.tsx), hay que distinguir
      // cuál de los dos se muestra aquí -- `price` siempre fue y sigue
      // siendo el precio de VENTA, el que se usa en cotizaciones/facturas.
      header: 'Venta',
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

  // Ref para acceder a paginatedData desde el effect sin incluirlo como
  // dependencia. IMPORTANTE: debe ser paginatedData (lo que de verdad recibe
  // la tabla vía `data:`), no filteredData completo -- los IDs de fila de
  // @tanstack/react-table son el índice dentro del array que se le pasa.
  const filteredDataRef = useRef(paginatedData)
  filteredDataRef.current = paginatedData

  // Notificar al padre SOLO cuando cambia la selección (evita loops infinitos)
  useEffect(() => {
    const selectedIds = Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((rowIndex) => filteredDataRef.current[parseInt(rowIndex)]?.id)
      .filter(Boolean) as string[]
    onSelectionChange?.(selectedIds)
  }, [rowSelection]) // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: paginatedData,
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
      <div className="hidden md:block rounded-2xl glass-surface overflow-hidden">
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

      <div className="md:hidden rounded-2xl glass-surface overflow-hidden divide-y divide-[var(--glass-border)]">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const p = row.original
            const min = p.stock_minimum ?? 0
            const isReorder = min > 0 && p.stock <= min && p.stock > 0
            const isOut = p.stock === 0
            return (
              <div key={row.id} className="flex items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  className="h-4 w-4 mt-1 rounded border-[var(--glass-border)] accent-primary cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        onClick={() => setEditProduct(p)}
                        className="font-medium text-primary hover:text-primary/80 hover:underline text-left transition-colors"
                      >
                        {p.name}
                      </button>
                      {p.sku && <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        isOut
                          ? 'bg-red-500/10 border-red-500/20 text-red-700'
                          : isReorder
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                          : p.stock < 10
                          ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700'
                          : 'bg-green-500/10 border-green-500/20 text-green-700'
                      }`}
                    >
                      {p.stock}
                      {(isReorder || isOut) && <AlertTriangle className="h-3 w-3" />}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {(p.categories as { name: string } | null)?.name ?? '—'}
                    </span>
                    <span className="font-medium text-foreground">
                      ${Number(p.price).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {min > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground font-mono">Mínimo: {min}</p>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-10 text-center">
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
          </div>
        )}
      </div>

      {filteredData.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl glass-surface border border-[var(--glass-border)] px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            Mostrando{' '}
            <span className="font-medium text-foreground">
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filteredData.length)}
            </span>{' '}
            de{' '}
            <span className="font-medium text-foreground">{filteredData.length}</span> resultados
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span>Filas</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0) }}
                className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-1.5 py-0.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
                title="Página anterior"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--glass-border)] text-muted-foreground hover:bg-[var(--glass)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
              >
                ‹
              </button>
              <span className="px-1 text-[12px] text-muted-foreground">
                Página <span className="font-medium text-foreground">{pageIndex + 1}</span> de {totalPages}
              </span>
              <button
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageIndex >= totalPages - 1}
                title="Página siguiente"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--glass-border)] text-muted-foreground hover:bg-[var(--glass)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[13px]"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

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
