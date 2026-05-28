'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Ban } from 'lucide-react'
import { ModuleToolbar } from '@/components/ui/module-toolbar'
import { SuppliersTable } from '@/modules/suppliers/components/suppliers-table'
import { SupplierForm } from '@/modules/suppliers/components/supplier-form'
import { deleteSuppliers, getSuppliersWithDocuments, useSuppliers } from '@/modules/suppliers/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'

export default function SuppliersPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDocumentError, setShowDocumentError] = useState(false)
  const [blockedCount, setBlockedCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState('')

  const { data: allSuppliers = [] } = useSuppliers(activeCompanyId ?? undefined)

  const FISCAL_LABEL: Record<string, string> = {
    no_iva: 'No Responsable de IVA', iva: 'Responsable de IVA', gran_contribuyente: 'Gran Contribuyente',
  }

  type SupplierRow = typeof allSuppliers[number]

  const supplierColumns: ExcelColumn<SupplierRow>[] = [
    { header: 'Razón Social / Nombre', key: 'name',          width: 30 },
    { header: 'Tipo Documento',        key: 'doc_type',       width: 16 },
    { header: 'Número Documento',      key: 'doc_number',     width: 18 },
    { header: 'Email',                 key: 'email',          width: 28 },
    { header: 'Teléfono',              key: 'phone',          width: 16 },
    { header: 'Contacto',              key: 'contact_name',   width: 24 },
    { header: 'Dirección',             key: 'address',        width: 30 },
    { header: 'Ciudad',                key: 'city',           width: 18 },
    { header: 'Departamento',          key: 'department',     width: 18 },
    { header: 'Régimen Fiscal',        key: (r) => FISCAL_LABEL[r.fiscal_regime] ?? r.fiscal_regime, width: 24 },
    { header: 'Días de Pago',          key: 'payment_days',   width: 14 },
    { header: 'Notas',                 key: 'notes',          width: 30 },
  ]

  const handleExport = () => {
    let data = allSuppliers
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase()
      data = data.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        (s.doc_number ?? '').toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q)
      )
    }
    exportToExcel(data, supplierColumns, `proveedores_${new Date().toISOString().slice(0, 10)}`)
  }

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const deleteMutation = useMutation({
    mutationFn: () => deleteSuppliers(selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', activeCompanyId] })
      setSelectedIds([])
      setShowDeleteConfirm(false)
    },
  })

  return (
    <div className="space-y-6">
      <ModuleToolbar
        title="Proveedores"
        subtitle="Directorio de proveedores de tu empresa."
        selectedCount={selectedIds.length}
        onAdd={() => setIsDialogOpen(true)}
        onDelete={async () => {
          const blocked = await getSuppliersWithDocuments(selectedIds)
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
        searchPlaceholder="Buscar por nombre, NIT, email..."
      />

      {activeCompanyId && (
        <SuppliersTable
          onSelectionChange={setSelectedIds}
          globalFilter={searchValue}
        />
      )}

      {/* Modal: nuevo proveedor */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm onSuccess={() => setIsDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Error: proveedor con documentos */}
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
                ? 'Este proveedor tiene órdenes de compra o facturas asociadas.'
                : `${blockedCount} de los proveedores seleccionados tienen documentos asociados.`}
              {' '}Los registros deben conservarse por razones contables.
              <br /><br />
              Si necesitas desactivarlo, edítalo y marca el nombre como{' '}
              <span className="font-semibold text-zinc-800">"(Inactivo)"</span>.
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

      {/* Confirmación de eliminación */}
      <Dialog open={showDeleteConfirm} onOpenChange={(v) => !deleteMutation.isPending && setShowDeleteConfirm(v)}>
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
