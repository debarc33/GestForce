'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ModuleToolbar } from '@/components/ui/module-toolbar'
import { QuotesTable } from '@/modules/sales/components/quotes-table'
import { InvoicesTable } from '@/modules/sales/components/invoices-table'
import { ReceiptsTable } from '@/modules/sales/components/receipts-table'
import { CustomersTable } from '@/modules/customers/components/customers-table'
import { CustomerForm } from '@/modules/customers/components/customer-form'
import {
  useQuotes, useInvoices, useReceipts,
  deleteQuotes, deleteInvoices,
  type QuoteWithCustomer, type InvoiceWithCustomer, type ReceiptWithDetails,
} from '@/modules/sales/queries'
import {
  useCustomers, deleteCustomers, getCustomersWithDocuments,
} from '@/modules/customers/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, fmtMoney, fmtDate, type ExcelColumn } from '@/lib/export-excel'

// ─── Configuración de tabs ─────────────────────────────────────────────────

const TABS = [
  { id: 'quotes',    label: 'Cotizaciones' },
  { id: 'invoices',  label: 'Facturas' },
  { id: 'receipts',  label: 'Recibos' },
  { id: 'customers', label: 'Clientes' },
] as const

type TabId = typeof TABS[number]['id']

const QUOTE_FILTERS = [
  { label: 'Todas',     value: 'all' },
  { label: 'Borrador',  value: 'draft' },
  { label: 'Enviada',   value: 'sent' },
  { label: 'Aprobada',  value: 'approved' },
  { label: 'Rechazada', value: 'rejected' },
  { label: 'Caducada',  value: 'expired' },
]

const INVOICE_FILTERS = [
  { label: 'Todas',    value: 'all' },
  { label: 'Borrador', value: 'draft' },
  { label: 'Emitida',  value: 'issued' },
  { label: 'Anulada',  value: 'cancelled' },
]

const RECEIPT_FILTERS = [
  { label: 'Todos',     value: 'all' },
  { label: 'Pendiente', value: 'pending' },
  { label: 'Parcial',   value: 'partial' },
  { label: 'Pagado',    value: 'paid' },
]

const CUSTOMER_FILTERS = [
  { label: 'Todos los clientes', value: 'all' },
  { label: 'Contado',            value: 'contado' },
  { label: 'Crédito',            value: 'credito' },
]

// ─── Componente principal ──────────────────────────────────────────────────

function SalesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const tabParam      = searchParams.get('tab') as TabId | null
  const openReceiptId = searchParams.get('openReceipt') ?? undefined

  const [activeTab, setActiveTab] = useState<TabId>(tabParam ?? 'quotes')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Estados para facturas
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showIssuedError, setShowIssuedError]     = useState(false)

  // Estados para clientes
  const [isCustomerDialogOpen, setIsCustomerDialogOpen]       = useState(false)
  const [showCustomerDeleteConfirm, setShowCustomerDeleteConfirm] = useState(false)
  const [showCustomerDocError, setShowCustomerDocError]           = useState(false)
  const [customerBlockedCount, setCustomerBlockedCount]           = useState(0)

  useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam)) setActiveTab(tabParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    router.push(`/sales?tab=${tab}`)
    setSearch('')
    setFilter('all')
    setSelectedIds([])
  }

  // Datos
  const { data: quotes    = [], isLoading: loadingQ } = useQuotes(activeCompanyId ?? undefined)
  const { data: invoices  = [], isLoading: loadingI } = useInvoices(activeCompanyId ?? undefined)
  const { data: receipts  = [], isLoading: loadingR } = useReceipts(activeCompanyId ?? undefined)
  const { data: customers = [], isLoading: loadingC } = useCustomers(activeCompanyId ?? undefined)

  const isLoading =
    (activeTab === 'quotes'    && loadingQ) ||
    (activeTab === 'invoices'  && loadingI) ||
    (activeTab === 'receipts'  && loadingR) ||
    (activeTab === 'customers' && loadingC)

  // ─── Eliminación ─────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: () => {
      if (activeTab === 'quotes')    return deleteQuotes(selectedIds)
      if (activeTab === 'invoices')  return deleteInvoices(selectedIds)
      if (activeTab === 'customers') return deleteCustomers(selectedIds)
      return Promise.resolve()
    },
    onSuccess: () => {
      if (activeTab === 'quotes')    queryClient.invalidateQueries({ queryKey: ['quotes',    activeCompanyId] })
      if (activeTab === 'invoices')  queryClient.invalidateQueries({ queryKey: ['invoices',  activeCompanyId] })
      if (activeTab === 'customers') queryClient.invalidateQueries({ queryKey: ['customers', activeCompanyId] })
      setSelectedIds([])
      setShowDeleteConfirm(false)
      setShowCustomerDeleteConfirm(false)
    },
  })

  const handleInvoiceDelete = () => {
    const sel = invoices.filter(inv => selectedIds.includes(inv.id))
    if (sel.some(inv => inv.status === 'issued' || inv.status === 'cancelled')) {
      setShowIssuedError(true)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const handleCustomerDelete = async () => {
    const blocked = await getCustomersWithDocuments(selectedIds)
    if (blocked.length > 0) {
      setCustomerBlockedCount(blocked.length)
      setShowCustomerDocError(true)
    } else {
      setShowCustomerDeleteConfirm(true)
    }
  }

  // ─── Exportar ─────────────────────────────────────────────────────────────

  const STATUS_QUOTE:   Record<string, string> = { draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Caducada' }
  const STATUS_INVOICE: Record<string, string> = { draft: 'Borrador', issued: 'Emitida', cancelled: 'Anulada' }
  const STATUS_RECEIPT: Record<string, string> = { pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', cancelled: 'Anulado' }
  const PAYMENT_STATUS: Record<string, string> = { unpaid: 'Sin pagar', partial: 'Parcial', paid: 'Pagado' }
  const FISCAL_LABEL:   Record<string, string> = { no_iva: 'No Resp. IVA', iva: 'Resp. IVA', gran_contribuyente: 'Gran Contrib.' }

  type CustomerRow = typeof customers[number]

  const quoteColumns: ExcelColumn<QuoteWithCustomer>[] = [
    { header: '#',            key: 'quote_number',  width: 14 },
    { header: 'Cliente',      key: (r) => r.customer?.name ?? '', width: 28 },
    { header: 'Fecha',        key: (r) => fmtDate(r.issue_date), width: 14 },
    { header: 'Válida hasta', key: (r) => fmtDate(r.expiry_date), width: 14 },
    { header: 'Subtotal',     key: (r) => fmtMoney(r.subtotal), width: 14 },
    { header: 'IVA',          key: (r) => fmtMoney(r.tax),      width: 12 },
    { header: 'Total',        key: (r) => fmtMoney(r.total),    width: 14 },
    { header: 'Estado',       key: (r) => STATUS_QUOTE[r.status] ?? r.status, width: 12 },
  ]

  const invoiceColumns: ExcelColumn<InvoiceWithCustomer>[] = [
    { header: '#',               key: 'invoice_number', width: 16 },
    { header: '# Cotización',    key: (r) => r.quote_number ?? '', width: 14 },
    { header: 'Cliente',         key: (r) => r.customer?.name ?? '', width: 28 },
    { header: 'Fecha emisión',   key: (r) => fmtDate(r.issue_date), width: 14 },
    { header: 'Vencimiento',     key: (r) => fmtDate(r.due_date), width: 14 },
    { header: 'Subtotal',        key: (r) => fmtMoney(r.subtotal), width: 14 },
    { header: 'IVA',             key: (r) => fmtMoney(r.tax),      width: 12 },
    { header: 'Total',           key: (r) => fmtMoney(r.total),    width: 14 },
    { header: 'Saldo pendiente', key: (r) => fmtMoney(r.balance_due), width: 16 },
    { header: 'Estado',          key: (r) => STATUS_INVOICE[r.status] ?? r.status, width: 12 },
    { header: 'Pago',            key: (r) => PAYMENT_STATUS[r.payment_status] ?? r.payment_status, width: 12 },
  ]

  const receiptColumns: ExcelColumn<ReceiptWithDetails>[] = [
    { header: '#',           key: 'receipt_number',  width: 16 },
    { header: '# Factura',   key: (r) => r.invoice_number ?? '', width: 16 },
    { header: 'Cliente',     key: (r) => r.customer?.name ?? '', width: 28 },
    { header: 'Monto total', key: (r) => fmtMoney(r.total_amount), width: 14 },
    { header: 'Pagado',      key: (r) => fmtMoney(r.amount_paid),  width: 14 },
    { header: 'Saldo',       key: (r) => fmtMoney(r.balance),      width: 14 },
    { header: 'Estado',      key: (r) => STATUS_RECEIPT[r.status] ?? r.status, width: 12 },
    { header: 'Vencimiento', key: (r) => fmtDate(r.due_date), width: 14 },
  ]

  const customerColumns: ExcelColumn<CustomerRow>[] = [
    { header: 'Nombre / Razón Social', key: 'name',          width: 30 },
    { header: 'Tipo Documento',        key: 'doc_type',       width: 16 },
    { header: 'Número Documento',      key: 'doc_number',     width: 18 },
    { header: 'Email',                 key: 'email',          width: 28 },
    { header: 'Teléfono',              key: 'phone',          width: 16 },
    { header: 'Ciudad',                key: 'city',           width: 18 },
    { header: 'Régimen Fiscal',        key: (r) => FISCAL_LABEL[r.fiscal_regime] ?? r.fiscal_regime, width: 24 },
    { header: 'Tipo de Pago',          key: 'payment_type',   width: 14 },
    { header: 'Días de Crédito',       key: 'credit_days',    width: 14 },
  ]

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10)
    const lq = search.trim().toLowerCase()
    if (activeTab === 'quotes') {
      let data = quotes
      if (lq) data = data.filter(r => (r.customer?.name ?? '').toLowerCase().includes(lq) || r.quote_number.toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(r => r.status === filter)
      exportToExcel(data, quoteColumns, `cotizaciones_${today}`)
    } else if (activeTab === 'invoices') {
      let data = invoices
      if (lq) data = data.filter(r => (r.customer?.name ?? '').toLowerCase().includes(lq) || r.invoice_number.toLowerCase().includes(lq) || (r.quote_number ?? '').toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(r => r.status === filter)
      exportToExcel(data, invoiceColumns, `facturas_${today}`)
    } else if (activeTab === 'receipts') {
      let data = receipts
      if (lq) data = data.filter(r => (r.customer?.name ?? '').toLowerCase().includes(lq) || r.receipt_number.toLowerCase().includes(lq) || (r.invoice_number ?? '').toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(r => r.status === filter)
      exportToExcel(data, receiptColumns, `recibos_${today}`)
    } else {
      let data = customers
      if (lq) data = data.filter(c => c.name.toLowerCase().includes(lq) || (c.email ?? '').toLowerCase().includes(lq) || (c.doc_number ?? '').toLowerCase().includes(lq))
      if (filter !== 'all') data = data.filter(c => (c.payment_type ?? '').toLowerCase() === filter)
      exportToExcel(data, customerColumns, `clientes_${today}`)
    }
  }

  // ─── Toolbar por tab ──────────────────────────────────────────────────────

  const toolbarProps = {
    quotes: {
      subtitle: 'Crea y gestiona cotizaciones para tus clientes.',
      onAdd: () => router.push('/sales/quotes/new'),
      onDelete: () => deleteMut.mutate(),
      filterOptions: QUOTE_FILTERS,
      searchPlaceholder: 'Buscar por # cotización o cliente...',
      extraButtons: undefined as React.ReactNode,
    },
    invoices: {
      subtitle: 'Facturas y tickets generados desde cotizaciones o directamente.',
      onAdd: undefined as (() => void) | undefined,
      onDelete: selectedIds.length > 0 ? handleInvoiceDelete : undefined,
      filterOptions: INVOICE_FILTERS,
      searchPlaceholder: 'Buscar por # factura, # cotización o cliente...',
      extraButtons: (
        <button
          onClick={() => router.push('/sales/tickets/new')}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">
          <span className="text-base leading-none">🧾</span>
          <span className="hidden sm:inline">Nuevo ticket</span>
        </button>
      ),
    },
    receipts: {
      subtitle: 'Recibos generados al remitir facturas.',
      onAdd: undefined as (() => void) | undefined,
      onDelete: undefined as (() => void) | undefined,
      filterOptions: RECEIPT_FILTERS,
      searchPlaceholder: 'Buscar por # recibo, # factura o cliente...',
      extraButtons: undefined as React.ReactNode,
    },
    customers: {
      subtitle: 'Directorio de clientes de tu empresa.',
      onAdd: () => setIsCustomerDialogOpen(true),
      onDelete: selectedIds.length > 0 ? handleCustomerDelete : undefined,
      filterOptions: CUSTOMER_FILTERS,
      searchPlaceholder: 'Buscar por nombre, email, teléfono...',
      extraButtons: undefined as React.ReactNode,
    },
  }[activeTab]

  const tabCounts: Record<TabId, number> = {
    quotes:    quotes.length,
    invoices:  invoices.length,
    receipts:  receipts.length,
    customers: customers.length,
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Ventas</h1>
        <p className="mt-0.5 text-[13px] text-zinc-400">Gestiona cotizaciones, facturas, recibos y clientes.</p>
      </div>

      {/* Tabs underline */}
      <div className="flex items-center gap-1 border-b border-zinc-200">
        {TABS.map((tab) => {
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
        extraButtons={toolbarProps.extraButtons}
      />

      {isLoading && <div className="h-60 animate-pulse rounded-xl bg-zinc-100" />}

      {!isLoading && activeCompanyId && (
        <>
          {activeTab === 'quotes' && (
            <QuotesTable quotes={quotes} companyId={activeCompanyId}
              onSelectionChange={setSelectedIds} globalFilter={search} statusFilter={filter} />
          )}
          {activeTab === 'invoices' && (
            <InvoicesTable invoices={invoices} companyId={activeCompanyId}
              onSelectionChange={setSelectedIds} globalFilter={search} statusFilter={filter} />
          )}
          {activeTab === 'receipts' && (
            <ReceiptsTable receipts={receipts} companyId={activeCompanyId}
              globalFilter={search} statusFilter={filter} autoOpenReceiptId={openReceiptId} />
          )}
          {activeTab === 'customers' && (
            <CustomersTable
              onSelectionChange={setSelectedIds}
              globalFilter={search}
              paymentFilter={filter}
            />
          )}
        </>
      )}

      {/* ── Dialogs: Facturas ─────────────────────────────────────────── */}

      <Dialog open={showIssuedError} onOpenChange={setShowIssuedError}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">No se puede eliminar</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-600 leading-relaxed">
              Las facturas <span className="font-semibold text-zinc-800">emitidas o anuladas</span> no pueden eliminarse.
              La normativa de la DIAN exige conservar el registro de todos los documentos fiscales emitidos.
              <br /><br />
              Si necesitas corregir una factura emitida, utiliza una <span className="font-semibold text-orange-700">Nota Crédito</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button onClick={() => setShowIssuedError(false)}
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

      {/* ── Dialogs: Clientes ─────────────────────────────────────────── */}

      {/* Nuevo cliente */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Nuevo cliente</DialogTitle>
          </DialogHeader>
          <CustomerForm onSuccess={() => setIsCustomerDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Error: cliente con documentos */}
      <Dialog open={showCustomerDocError} onOpenChange={setShowCustomerDocError}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">No se puede eliminar</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-600 leading-relaxed">
              {customerBlockedCount === 1
                ? 'Este cliente tiene cotizaciones, facturas o recibos asociados.'
                : `${customerBlockedCount} de los clientes seleccionados tienen documentos asociados.`}
              {' '}Los registros históricos deben conservarse.
              <br /><br />
              Para desactivar el cliente sin eliminarlo, edítalo y añade <span className="font-semibold text-zinc-800">"(Inactivo)"</span> a su nombre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button onClick={() => setShowCustomerDocError(false)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
              Entendido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar cliente */}
      <Dialog open={showCustomerDeleteConfirm} onOpenChange={(v) => !deleteMut.isPending && setShowCustomerDeleteConfirm(v)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-900">
              ¿Eliminar {selectedIds.length === 1 ? 'este cliente' : `estos ${selectedIds.length} clientes`}?
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowCustomerDeleteConfirm(false)} disabled={deleteMut.isPending}
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

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-zinc-100" />}>
      <SalesPageInner />
    </Suspense>
  )
}
