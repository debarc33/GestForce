'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Package } from 'lucide-react'
import { useSupplierProducts } from '../queries'
import { fmtMoney } from '@/lib/export-excel'

/**
 * `fmtDate` de `export-excel.ts` espera una fecha simple ("2026-10-31", sin
 * hora) como las que guardan `issue_date`/`due_date`. `updated_at` aquí es
 * una marca de tiempo completa (con hora y zona horaria) -- concatenarle lo
 * que `fmtDate` agrega producía una fecha inválida y la columna no mostraba
 * nada útil. Esta versión formatea directo el timestamp completo.
 */
function fmtTimestamp(d: string | null | undefined) {
  if (!d) return ''
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-CO')
}

interface SupplierProductsDialogProps {
  /** id del proveedor a mostrar, o null si el diálogo está cerrado */
  supplierId: string | null
  supplierName: string
  onOpenChange: (open: boolean) => void
}

/**
 * Vista de proveedor (punto 2 del backlog, 27 oct 2026): qué productos se le
 * compran a un proveedor y a qué precio. Lee de `producto_proveedores`
 * (migración 030), que se actualiza sola cada vez que se recibe una orden
 * de compra de ese proveedor (migración 031) — este diálogo es de solo
 * lectura, no edita nada.
 */
export function SupplierProductsDialog({ supplierId, supplierName, onOpenChange }: SupplierProductsDialogProps) {
  const { data: rows = [], isLoading, isError } = useSupplierProducts(supplierId ?? undefined)

  return (
    <Dialog open={!!supplierId} onOpenChange={(v) => { if (!v) onOpenChange(false) }}>
      <DialogContent className="sm:max-w-2xl rounded-2xl glass-surface shadow-xl border-[var(--glass-border)]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Productos comprados a {supplierName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-red-600">No se pudo cargar la información.</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <Package className="h-10 w-10 opacity-30" />
            <div>
              <p className="text-sm font-medium">Todavía no le has comprado nada a este proveedor</p>
              <p className="text-xs">El precio se registra solo cuando recibes una orden de compra de él.</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--glass-border)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--glass)]">
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Precio pagado</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Última compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {rows.map(r => (
                  <tr key={r.product_id} className="hover:bg-[var(--glass)] transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{r.product_name}</p>
                      {r.sku && <p className="text-xs text-muted-foreground">{r.sku}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtMoney(r.price)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtTimestamp(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
