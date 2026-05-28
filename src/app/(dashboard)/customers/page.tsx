'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Ban, Users, UserCheck, CreditCard, DollarSign } from 'lucide-react'
import { ModuleToolbar } from '@/components/ui/module-toolbar'
import { CustomersTable } from '@/modules/customers/components/customers-table'
import { CustomerForm } from '@/modules/customers/components/customer-form'
import { deleteCustomers, getCustomersWithDocuments, useCustomers } from '@/modules/customers/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const PAYMENT_FILTER_OPTIONS = [
  { label: 'Todos los clientes', value: 'all' },
  { label: 'Contado',            value: 'contado' },
  { label: 'Crédito',            value: 'credito' },
]

const TABS = [
  { label: 'Cotizaciones', href: '/sales?tab=quotes' },
  { label: 'Facturas',     href: '/sales?tab=invoices' },
  { label: 'Recibos',      href: '/sales?tab=receipts' },
  { label: 'Clientes',     href: '/customers', active: true },
]

export default function CustomersPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [isDialogOpen,      setIsDialogOpen]      = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDocumentError, setShowDocumentError] = useState(false)
  const [blockedCount,      setBlockedCount]      = useState(0)
  const [selectedIds,       setSelectedIds]       = useState<string[]>([])
  const [searchValue,       setSearchValue]       = useState('')
  const [paymentFilter,     setPaymentFilter]     = useState('all')

  const { data: allCustomers = [] } = useCustomers(activeCompanyId ?? undefined)

  /* ── Stats derivadas ────────────────────────────────────── */
  const stats = useMemo(() => {
    const total   = allCustomers.length
    const activos = allCustomers.length // todos los registrados se consideran activos
    const credito = allCustomers.filter(c => (c.payment_type ?? '').toLowerCase() === 'credito').length
    return { total, activos, credito }
  }, [allCustomers])

  const FISCAL_LABEL: Record<string, string> = {
    no_iva: 'No Responsable de IVA', iva: 'Responsable de IVA', gran_contribuyente: 'Gran Contribuyente',
  }

  type CustomerRow = typeof allCustomers[number]

  const customerColumns: ExcelColumn<CustomerRow>[] = [
    { header: 'Nombre / Razón Social', key: 'name',        width: 30 },
    { header: 'Tipo Documento',        key: 'doc_type',     width: 16 },
    { header: 'Número Documento',      key: 'doc_number',   width: 18 },
    { header: 'Email',                 key: 'email',        width: 28 },
    { header: 'Teléfono',              key: 'phone',        width: 16 },
    { header: 'Dirección',             key: 'address',      width: 30 },
    { header: 'Ciudad',                key: 'city',         width: 18 },
    { header: 'Departamento',          key: 'department',   width: 18 },
    { header: 'Régimen Fiscal',        key: (r) => FISCAL_LABEL[r.fiscal_regime] ?? r.fiscal_regime, width: 24 },
    { header: 'Tipo de Pago',          key: 'payment_type', width: 14 },
    { header: 'Días de Crédito',       key: 'credit_days',  width: 14 },
  ]

  const handleExport = () => {
    let data = allCustomers
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase()
      data = data.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        ((c as CustomerRow & { doc_number?: string | null }).doc_number ?? '').toLowerCase().includes(q) ||
        ((c as CustomerRow & { city?: string | null }).city ?? '').toLowerCase().includes(q)
      )
    }
    if (paymentFilter !== 'all') {
      data = data.filter(c => (c.payment_type ?? '').toLowerCase() === paymentFilter.toLowerCase())
    }
    exportToExcel(data, customerColumns, `clientes_${new Date().toISOString().slice(0, 10)}`)
  }

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomers(selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', activeCompanyId] })
      setSelectedIds([])
      setShowDeleteConfirm(false)
    },
  })

  return (
    <div className="space-y-5">

      {/* ── Encabezado ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Clientes</h1>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[11px] font-semibold text-indigo-700">
              {stats.total}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-zinc-400">Gestiona tu ciclo completo de ventas y clientes.</p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
        >
          + Nuevo Cliente
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-zinc-200">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
              tab.active
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
            )}
          >
            {tab.label}
            {tab.active && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-600">
                {stats.total}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Stats cards ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Clientes',
            value: stats.total,
            sub: '100% del total',
            icon: Users,
            iconBg: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
          },
          {
            label: 'Clientes Activos',
            value: stats.activos,
            sub: stats.total > 0 ? `${Math.round((stats.activos / stats.total) * 100)}% del total` : '—',
            icon: UserCheck,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
          },
          {
            label: 'Con Crédito',
            value: stats.credito,
            sub: stats.total > 0 ? `${Math.round((stats.credito / stats.total) * 100)}% del total` : '—',
            icon: CreditCard,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
          },
          {
            label: 'Saldo Total',
            value: '—',
            sub: 'COP',
            icon: DollarSign,
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', stat.iconBg)}>
                <stat.icon className={cn('h-4.5 w-4.5', stat.iconColor)} style={{ height: 18, width: 18 }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide leading-none">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900 leading-none">{stat.value}</p>
                <p className="mt-1 text-[11px] text-zinc-400">{stat.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <ModuleToolbar
        selectedCount={selectedIds.length}
        onDelete={async () => {
          const blocked = await getCustomersWithDocuments(selectedIds)
          if (blocked.length > 0) {
            setBlockedCount(blocked.length)
            setShowDocumentError(true)
          } else {
            setShowDeleteConfirm(true)
          }
        }}
        onPrint={() => window.print()}
        onUpload={(file) => console.log('Archivo cargado:', file.name)}
        onExport={handleExport}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Buscar por nombre, email, teléfono..."
        filterOptions={PAYMENT_FILTER_OPTIONS}
        filterValue={paymentFilter}
        onFilterChange={setPaymentFilter}
      />

      {/* ── Tabla ─────────────────────────────────────────────── */}
      {activeCompanyId && (
        <CustomersTable
          onSelectionChange={setSelectedIds}
          globalFilter={searchValue}
          paymentFilter={paymentFilter}
        />
      )}

      {/* ── Modal: Nuevo cliente ──────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Nuevo cliente</DialogTitle>
          </DialogHeader>
          <CustomerForm onSuccess={() => setIsDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* ── Modal: Error documentos ───────────────────────────── */}
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
                ? 'Este cliente tiene cotizaciones, facturas o recibos asociados.'
                : `${blockedCount} de los clientes seleccionados tienen documentos asociados.`}
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

      {/* ── Modal: Confirmar eliminación ──────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={(v) => !deleteMutation.isPending && setShowDeleteConfirm(v)}>
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
    </div>
  )
}
