'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Ban } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModuleToolbar } from '@/components/ui/module-toolbar'
import { ProductsTable } from '@/modules/products/components/products-table'
import { ProductForm } from '@/modules/products/components/product-form'
import {
  createCategory, createProduct, updateProduct, deleteProducts, getProductsWithDocuments,
  isLowStock, useCategories, useProducts,
} from '@/modules/products/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import { readExcelRows, validateImportFile, mapProductRow, type ParsedProductRow } from '@/lib/import-excel'
import { ExcelImportDialog, type ParsedImportRow } from '@/components/ui/excel-import-dialog'

const STOCK_FILTER_OPTIONS = [
  { label: 'Todo el inventario', value: 'all' },
  { label: 'En stock',           value: 'in' },
  { label: 'Por reponer',        value: 'reorder' },
  { label: 'Sin stock',          value: 'out' },
]

export default function ProductsPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [importOpen,     setImportOpen]     = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importRows,     setImportRows]     = useState<ParsedImportRow<ParsedProductRow>[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDocumentError, setShowDocumentError] = useState(false)
  const [blockedCount,      setBlockedCount]      = useState(0)
  const categoryCache = useRef<Map<string, string>>(new Map())
  /** nombre (normalizado) -> id del producto existente, para completar en vez de duplicar. */
  const existingProductsByName = useRef<Map<string, string>>(new Map())

  const { data: allProducts = [] } = useProducts(activeCompanyId ?? undefined)
  const { data: categories = [] } = useCategories(activeCompanyId ?? undefined)

  async function handleImportFile(file: File) {
    const fileError = validateImportFile(file)
    if (fileError) { window.alert(fileError); return }
    if (!activeCompanyId) { window.alert('No hay una empresa activa seleccionada.'); return }
    try {
      const rawRows = await readExcelRows(file)
      if (rawRows.length === 0) {
        window.alert('El archivo no tiene filas de datos (o la hoja de datos no es la primera hoja del archivo).')
        return
      }
      const parsed: ParsedImportRow<ParsedProductRow>[] = rawRows.map((row, i) => {
        const result = mapProductRow(row)
        return result.ok
          ? { row: i + 2, ok: true, data: result.data }
          : { row: i + 2, ok: false, message: result.message }
      })
      categoryCache.current = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
      existingProductsByName.current = new Map(allProducts.map(p => [p.name.trim().toLowerCase(), p.id]))
      setImportFileName(file.name)
      setImportRows(parsed)
      setImportOpen(true)
    } catch (e) {
      window.alert('No se pudo leer el archivo: ' + (e instanceof Error ? e.message : 'error desconocido.'))
    }
  }

  async function importOneProduct(data: ParsedProductRow) {
    if (!activeCompanyId) throw new Error('Sin empresa activa.')
    let category_id = ''
    if (data.category_name) {
      const key = data.category_name.toLowerCase()
      let id = categoryCache.current.get(key)
      if (!id) {
        const created = await createCategory({ name: data.category_name, company_id: activeCompanyId })
        const createdId = created?.id
        if (typeof createdId !== 'string' || !createdId) {
          throw new Error(`No se pudo crear la categoria "${data.category_name}".`)
        }
        id = createdId
        categoryCache.current.set(key, id)
      }
      category_id = id
    }
    const payload = {
      category_id,
      name: data.name,
      sku: data.sku,
      description: data.description,
      price: data.price,
      stock: data.stock,
      stock_minimum: data.stock_minimum,
      unit: data.unit,
      tax_type: data.tax_type,
      tax_rate: data.tax_rate,
      is_taxable: data.is_taxable,
    }
    const nameKey = data.name.trim().toLowerCase()
    const existingId = existingProductsByName.current.get(nameKey)
    if (existingId) {
      // Ya existe un producto con este nombre exacto: se completa/actualiza
      // en vez de crear uno duplicado.
      const updated = await updateProduct(existingId, payload)
      return { ...updated, _importAction: 'updated' as const }
    }
    const created = await createProduct({ company_id: activeCompanyId, ...payload })
    existingProductsByName.current.set(nameKey, created.id)
    return created
  }

  const TAX_TYPE_LABEL: Record<string, string> = {
    iva: 'IVA (gravado)', excluded: 'Excluido de IVA', exempt: 'Exento de IVA', no_tax: 'Sin impuesto',
  }

  type ProductRow = typeof allProducts[number]

  const productColumns: ExcelColumn<ProductRow>[] = [
    { header: 'Nombre',        key: 'name',        width: 30 },
    { header: 'SKU',           key: 'sku',         width: 14 },
    { header: 'Descripción',   key: 'description', width: 36 },
    { header: 'Precio',        key: 'price',         width: 14 },
    { header: 'Stock',         key: 'stock',         width: 10 },
    { header: 'Stock mínimo',  key: 'stock_minimum', width: 12 },
    { header: 'Unidad',        key: 'unit',          width: 12 },
    { header: 'Categoría',     key: (r) => (r as ProductRow & { categories?: { name: string } | null }).categories?.name ?? '', width: 18 },
    { header: 'Tipo IVA',      key: (r) => TAX_TYPE_LABEL[r.tax_type] ?? r.tax_type, width: 18 },
    // Se exporta como número plano (ej. 19, no "19%" ni 0.19) para que el
    // valor de la celda sea inequívoco al reimportarlo.
    { header: 'Tarifa IVA',    key: (r) => Math.round((r.tax_rate ?? 0) * 100), width: 12 },
  ]

  const handleExport = () => {
    let data = allProducts
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase()
      data = data.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        ((p as ProductRow & { categories?: { name: string } | null }).categories?.name ?? '').toLowerCase().includes(q)
      )
    }
    type PR = typeof allProducts[number] & { stock_minimum?: number }
    if (stockFilter === 'out')     data = data.filter(p => p.stock === 0)
    if (stockFilter === 'reorder') data = data.filter(p => isLowStock(p.stock, (p as PR).stock_minimum))
    if (stockFilter === 'in')      data = data.filter(p => p.stock > 0 && !isLowStock(p.stock, (p as PR).stock_minimum))
    exportToExcel(data, productColumns, `productos_${new Date().toISOString().slice(0, 10)}`)
  }

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const categoryMutation = useMutation({
    mutationFn: () => {
      if (!activeCompanyId) throw new Error('Sin empresa activa.')
      return createCategory({ name: categoryName.trim(), company_id: activeCompanyId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeCompanyId] })
      setCategoryName('')
      setIsCategoryDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProducts(selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', activeCompanyId] })
      setSelectedIds([])
      setShowDeleteConfirm(false)
    },
  })

  async function handleDeleteClick() {
    const blocked = await getProductsWithDocuments(selectedIds)
    if (blocked.length > 0) {
      setBlockedCount(blocked.length)
      setShowDocumentError(true)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'

  return (
    <div className="space-y-6">
      <ModuleToolbar
        title="Productos"
        subtitle="Catálogo de productos, precios y stock."
        selectedCount={selectedIds.length}
        onAdd={() => setIsProductDialogOpen(true)}
        onDelete={handleDeleteClick}
        onPrint={() => window.print()}
        onUpload={handleImportFile}
        onExport={handleExport}
        extraButtons={
          <button
            onClick={() => setIsCategoryDialogOpen(true)}
            title="Nueva categoría"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-all"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Categoría</span>
          </button>
        }
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Buscar por nombre, SKU, categoría..."
        filterOptions={STOCK_FILTER_OPTIONS}
        filterValue={stockFilter}
        onFilterChange={setStockFilter}
      />

      {activeCompanyId && (
        <ProductsTable
          onSelectionChange={setSelectedIds}
          globalFilter={searchValue}
          stockFilter={stockFilter}
        />
      )}

      {/* Dialog: Importar productos desde Excel */}
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fileName={importFileName}
        rows={importRows}
        entityLabel="producto"
        entityLabelPlural="productos"
        createFn={importOneProduct}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ['products', activeCompanyId] })
          queryClient.invalidateQueries({ queryKey: ['categories', activeCompanyId] })
        }}
      />

      {/* Dialog: Nuevo Producto */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Nuevo producto</DialogTitle>
          </DialogHeader>
          <ProductForm onSuccess={() => setIsProductDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog: No se puede eliminar (hay historial asociado) */}
      <Dialog open={showDocumentError} onOpenChange={setShowDocumentError}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">
                No se puede eliminar
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-600 leading-relaxed">
              {blockedCount === 1
                ? 'Este producto tiene cotizaciones, facturas, compras o movimientos de inventario asociados.'
                : `${blockedCount} de los productos seleccionados tienen cotizaciones, facturas, compras o movimientos de inventario asociados.`}
              {' '}Los registros históricos deben conservarse por requisitos legales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button
              onClick={() => setShowDocumentError(false)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Entendido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminación */}
      <Dialog open={showDeleteConfirm} onOpenChange={(v) => !deleteMutation.isPending && setShowDeleteConfirm(v)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-900">
              ¿Eliminar {selectedIds.length === 1 ? 'este producto' : `estos ${selectedIds.length} productos`}?
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteMutation.isPending}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nueva Categoría */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Nueva categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && categoryMutation.mutate()}
              className={inputClass}
              placeholder="Ej. Ropa, Electrónica, Alimentos..."
              autoFocus
            />
            {categoryMutation.isError && (
              <p className="text-sm text-red-500">
                {categoryMutation.error instanceof Error
                  ? categoryMutation.error.message
                  : 'Error al crear la categoría'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCategoryDialogOpen(false)}
                className="border-zinc-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => categoryMutation.mutate()}
                disabled={!categoryName.trim() || categoryMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {categoryMutation.isPending ? 'Guardando...' : 'Crear'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
