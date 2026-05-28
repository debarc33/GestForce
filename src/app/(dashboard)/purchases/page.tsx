'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ModuleToolbar } from '@/components/ui/module-toolbar'
import { PurchaseOrdersTable } from '@/modules/purchases/components/purchase-orders-table'
import { SupplierInvoicesTable } from '@/modules/purchases/components/supplier-invoices-table'
import { SuppliersTable } from '@/modules/suppliers/components/suppliers-table'
import { SupplierForm } from '@/modules/suppliers/components/supplier-form'
import {
  usePurchaseOrders, useSupplierInvoices,
  deletePurchaseOrders,
  type PurchaseOrderWithSupplier, type SupplierInvoiceWithDetails,
} from '@/modules/purchases/queries'
import {
  useSuppliers, deleteSuppliers, getSuppliersWithDocuments,
} from '@/modules/suppliers/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, fmtMoney, fmtDate, type ExcelColumn } from '@/lib/export-excel'

// ─── Tabs ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'orders',    label: 'Órdenes de Compra' },
  { id: 'invoices',  label: 'Facturas Proveedor' },
  { id: 'suppliers', label: 'Proveedores' },
] as const

type TabId = typeof TABS[number]['id']

const ORDER_FILTERS = [
  { label: 'Todas',    value: 'all' },
  { label: 'Borrador', value: 'draft' },
  { label: 'Enviada',  value: 'sent' },
  { label: 'Recibida', value: 'received' },
  { label: 'Anulada',  value: 'cancelled' },
]

const INVOICE_FILTERS = [
  { label: 'Todas',     value: 'all' },
  { label: 'Pendiente', value: 'pending' },
  { label: 'Parcial',   value: 'partial' },
  { label: 'Pagada',    value: 'paid' },
]

const SUPPLIER_FILTERS = [
  { label: 'Todos',          value: 'all' },
  { label: 'Resp. IVA',      value: 'iva' },
  { label: 'No Resp. IVA',   value: 'no_iva' },
  { label: 'Gran Contrib.',  value: 'gran_contribuyente' },
]

// ─── Página ───────────────────────────────────────────────────────────────

function PurchasesPageInner() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabId>('orders')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Estados para órdenes de compra
  const [showDeleteConfirm, setShowDeleteConfirm]     = useState(false)
  const [showReceivedError, setShowReceivedError]     = useState(false)

  // Estados para proveedores
  const [isSupplierDialogOpen, setIsSupplierDialogOpen]             = useState(false)
  const [showSupplierDeleteConfirm, setShowSupplierDeleteConfirm]   = useState(false)
  const [showSupplierDocError, setShowSupplierDocError]             = useState(false)
  const [supplierBlockedCount, setSupplierBlockedCount]             = useState(0)

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    setSearch('')
    setFilter('all')
    setSelectedIds([])
  }

  const { data: orders    = [], isLoading: loadingO } = usePurchaseOrders(activeCompanyId ?? undefined)
  const { data: invoices  = [], isLoading: loadingI } = useSupplierInvoices(activeCompanyId ?? undefined)
  const { data: suppliers = [], isLoading: loadingS } = useSuppliers(activeCompanyId ?? undefined)

  const isLoading =
    (activeTab === 'orders'    && loadingO) ||
    (activeTab === 'invoices'  && loadingI) ||
    (activeTab === 'suppliers' && loadingS)

  // ─── Eliminación ─────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: () => {
      if (activeTab === 'orders')    return deletePurchaseOrders(selectedIds)
      if (activeTab === 'suppliers') return deleteSuppliers(selectedIds)
      return Promise.resolve()
    },
    onSuccess: () => {
      if (activeTab === 'orders')    queryClient.invalidateQueries({ queryKey: ['purchase_orders', activeCompanyId] })
      if (activeTab === 'suppliers') queryClient.invalidateQueries({ queryKey: ['suppliers',       activeCompanyId] })
      setSelectedIds([])
      setShowDeleteConfirm(false)
      setShowSupplierDeleteConfirm(false)
    },
  })

  const handleOrderDelete = () => {
    const sel = orders.filter(o => selectedIds.includes(o.id))
    if (sel.some(o => o.status !== 'draft')) {
      setShowReceivedError(true)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const handleSupplierDelete = async () => {
    const blocked = await getSuppliersWithDocuments(selectedIds)
    if (blocked.length > 0) {
      setSupplierBlockedCount(blocked.length)
      setShowSupplierDocError(true)
    } else {
      setShowSupplierDeleteConfirm(true)
    }
  }

  // ─── Exportar ─────────────────────────────────────────────────────────────

  const STATUS_ORDER: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', received: 'Recibida', cancelled: 'Anulada' }
  const STATUS_INV:   Record<string, string> = { pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada', cancelled: 'Anulada' }
  const FISCAL_LABEL: Record<string, string> = { no_iva: 'No Resp. IVA', iva: 'Resp. IVA', gran_contribuyente: 'Gran Contrib.' }

  type SupplierRow = typeof suppliers[number]

  const orderColumns: ExcelColumn<PurchaseOrderWithSupplier>[] = [
    { header: '# OC',             key: 'order_number', width: 14 },
    { header: 'Proveedor',        key: (r) => r.supplier?.name ?? '', width: 28 },
    { header: 'Fecha emisión',    key: (r) => fmtDate(r.issue_date),    width: 14 },
    { header: 'Entrega esperada', key: (r) => fmtDate(r.expected_date), width: 16 },
    { header: 'Subtotal',         key: (r) => fmtMoney(r.subtotal), width: 14 },
    { header: 'IVA',              key: (r) => fmtMoney(r.tax),      width: 12 },
    { header: 'Total',            key: (r) => fmtMoney(r.total),    width: 14 },
    { header: 'Estado',           key: (r) => STATUS_ORDER[r.status] ?? r.status, width: 12 },
  ]

  const invoiceColumns: ExcelColumn<SupplierInvoiceWithDetails>[] = [
    { header: '# Interno',   key: 'invoice_number',     width: 16 },
    { header: '# Proveedor', key: (r) => r.supplier_invoice_no ?? '', width: 16 },
    { header: '# OC',        key: (r) => r.order_number ?? '', width: 14 },
    { header: 'Proveedor',   key: (r) => r.supplier?.name ?? '', width: 28 },
    { header: 'Fecha',       key: (r) => fmtDate(r.issue_date), width: 14 },
    { header: 'Subtotal',    key: (r) => fmtMoney(r.subtotal),    width: 14 },
    { header: 'IVA',         key: (r) => fmtMoney(r.tax),         width: 12 },
    { header: 'Retención',   key: (r) => fmtMoney(r.withholding), width: 12 },
    { header: 'Total',       key: (r) => fmtMoney(r.total),       width: 14 },
    { header: 'Saldo',       key: (r) => fmtMoney(r.balance_due), width: 14 },
    { header: 'Estado',      key: (r) => STATUS_INV[r.status] ?? r.status, width: 12 },
  ]

  const supplierColumns: ExcelColumn<SupplierRow>[] = [
    { header: 'Razón Social / Nombre', key: 'name',         width: 30 },
    { header: 'Tipo Documento',        key: 'doc_type',      width: 16 },
    { header: 'Número Documento',      key: 'doc_number',    width: 18 },
    { header: 'Email',                 key: 'email',         width: 28 },
    { header: 'Teléfono',              key: 'phone',         width: 16 },
    { header: 'Contacto',              key: 'contact_name',  width: 24 },
    { header: 'Ciudad',                key: 'city',          width: 18 },
    { header: 'Régimen Fiscal',        key: (r) => FISCAL_LABEL[r.fiscal_regime] ?? r.fiscal_regime, width: 24 },
    { header: 'Días de Pago',          key: 'payment_days',  width: 14 },
  ]

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10)
    const lq = search.trim().toLowerCase()
    if (activeTab === 'orders') {
      let data = orders
      if (lq) data = data.filter(r => (r.supplier?.name ?? '').toLowerCase().includes(lq) || r.order_number.toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(r => r.status === filter)
      exportToExcel(data, orderColumns, `ordenes_compra_${today}`)
    } else if (activeTab === 'invoices') {
      let data = invoices
      if (lq) data = data.filter(r => (r.supplier?.name ?? '').toLowerCase().includes(lq) || r.invoice_number.toLowerCase().includes(lq) || (r.supplier_invoice_no ?? '').toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(r => r.status === filter)
      exportToExcel(data, invoiceColumns, `facturas_proveedor_${today}`)
    } else {
      let data = suppliers
      if (lq) data = data.filter(s => s.name.toLowerCase().includes(lq) || (s.email ?? '').toLowerCase().includes(lq) || (s.doc_number ?? '').toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(s => s.fiscal_regime === filter)
      exportToExcel(data, supplierColumns, `proveedores_${today}`)
    }
  }

  // ─── Toolbar por tab ──────────────────────────────────────────────────────

  const toolbarProps = {
    orders: {
      subtitle: 'Crea y gestiona órdenes de compra a proveedores.',
      onAdd: () => router.push('/purchases/orders/new'),
      onDelete: selectedIds.length > 0 ? handleOrderDelete : undefined,
      filterOptions: ORDER_FILTERS,
      searchPlaceholder: 'Buscar por # OC o proveedor...',
    },
    invoices: {
      subtitle: 'Facturas generadas al recibir órdenes de compra.',
      onAdd: undefined as (() => void) | undefined,
      onDelete: undefined as (() => void) | undefined,
      filterOptions: INVOICE_FILTERS,
      searchPlaceholder: 'Buscar por # factura, # OC o proveedor...',
    },
    suppliers: {
      subtitle: 'Directorio de proveedores de tu empresa.',
      onAdd: () => setIsSupplierDialogOpen(true),
      onDelete: selectedIds.length > 0 ? handleSupplierDelete : undefined,
      filterOptions: SUPPLIER_FILTERS,
      searchPlaceholder: 'Buscar por nombre, NIT, email...',
    },
  }[activeTab]

  const tabCounts: Record<TabId, number> = {
    orders:    orders.length,
    invoices:  invoices.length,
    suppliers: suppliers.length,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Compras</h1>
        <p className="mt-0.5 text-[13px] text-zinc-400">Gestiona órdenes de compra, facturas de proveedor y proveedores.</p>
      </div>

      {/* Tabs underline */}
      <div className="flex items-center gap-1 border-b border-zinc-200">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const count    = tabCounts[tab.id]
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <ModuleToolbar
        title=""
        selectedCount={selectedIds.length}
        onAdd={toolbarProps.onAdd}
        onDelete={toolbarProps.onDelete}
        onPrint={() => window.print()}
        onUpload={(file) => console.log('Archivo:', file.name)}
        onExport={handleExport}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={toolbarProps.searchPlaceholder}
        filterOptions={toolbarProps.filterOptions}
        filterValue={filter}
        onFilterChange={setFilter}
      />

      {isLoading && <div className="h-60 animate-pulse rounded-xl bg-zinc-100" />}

      {!isLoading && activeCompanyId && (
        <>
          {activeTab === 'orders' && (
            <PurchaseOrdersTable orders={orders} companyId={activeCompanyId}
              onSelectionChange={setSelectedIds} globalFilter={search} statusFilter={filter} />
          )}
          {activeTab === 'invoices' && (
            <SupplierInvoicesTable invoices={invoices}
              onSelectionChange={setSelectedIds} globalFilter={search} statusFilter={filter} />
          )}
          {activeTab === 'suppliers' && (
            <SuppliersTable
              onSelectionChange={setSelectedIds}
              globalFilter={search}
            />
          )}
        </>
      )}

      {/* ── Dialogs: Órdenes de compra ────────────────────────────────── */}

      <Dialog open={showReceivedError} onOpenChange={setShowReceivedError}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">No se puede eliminar</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-600 leading-relaxed">
              Solo se pueden eliminar órdenes en estado <span className="font-semibold text-zinc-800">Borrador</span>.
              Las órdenes enviadas o recibidas tienen movimientos de inventario asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button onClick={() => setShowReceivedError(false)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
              Entendido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={(v) => !deleteMut.isPending && setShowDeleteConfirm(v)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">
                ¿Eliminar {selectedIds.length === 1 ? 'este borrador' : `estos ${selectedIds.length} borradores`}?
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-500">Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteMut.isPending}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50">
              {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogs: Proveedores ──────────────────────────────────────── */}

      {/* Nuevo proveedor */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm onSuccess={() => setIsSupplierDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Error: proveedor con documentos */}
      <Dialog open={showSupplierDocError} onOpenChange={setShowSupplierDocError}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">No se puede eliminar</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-600 leading-relaxed">
              {supplierBlockedCount === 1
                ? 'Este proveedor tiene órdenes de compra o facturas asociadas.'
                : `${supplierBlockedCount} de los proveedores seleccionados tienen documentos asociados.`}
              {' '}Los registros deben conservarse.
              <br /><br />
              Para desactivarlo, edítalo y añade <span className="font-semibold text-zinc-800">"(Inactivo)"</span> a su nombre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button onClick={() => setShowSupplierDocError(false)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
              Entendido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar proveedor */}
      <Dialog open={showSupplierDeleteConfirm} onOpenChange={(v) => !deleteMut.isPending && setShowSupplierDeleteConfirm(v)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-900">
              ¿Eliminar {selectedIds.length === 1 ? 'este proveedor' : `estos ${selectedIds.length} proveedores`}?
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowSupplierDeleteConfirm(false)} disabled={deleteMut.isPending}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50">
              {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-zinc-100" />}>
      <PurchasesPageInner />
    </Suspense>
  )
}
