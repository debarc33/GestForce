'use client'

import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, PackageCheck, Send, Ban, Link2 } from 'lucide-react'
import { useState } from 'react'
import {
  usePurchaseOrder, usePurchaseOrderItems,
  updatePurchaseOrderStatus, receivePurchaseOrder,
  useSupplierInvoiceByOrderId,
} from '@/modules/purchases/queries'
import Link from 'next/link'

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Borrador', cls: 'bg-zinc-100 text-zinc-600' },
  sent:      { label: 'Enviada',  cls: 'bg-blue-100 text-blue-700' },
  received:  { label: 'Recibida', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Anulada',  cls: 'bg-red-100 text-red-600' },
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string
  const queryClient = useQueryClient()

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmReceive, setConfirmReceive] = useState(false)

  const { data: order,      isLoading: loadingOrder } = usePurchaseOrder(id)
  const { data: items = [], isLoading: loadingItems } = usePurchaseOrderItems(id)
  const { data: relatedInvoice } = useSupplierInvoiceByOrderId(
    order?.status === 'received' ? id : undefined
  )

  const sentMut = useMutation({
    mutationFn: () => updatePurchaseOrderStatus(id, 'sent'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase_order', id] }),
  })

  const receiveMut = useMutation({
    mutationFn: () => receivePurchaseOrder(id),
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_order', id] })
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
      queryClient.invalidateQueries({ queryKey: ['supplier_invoices'] })
      queryClient.invalidateQueries({ queryKey: ['supplier_invoice_by_order', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setConfirmReceive(false)
      if (invoiceId) router.push(`/purchases/invoices/${invoiceId}`)
    },
  })

  const cancelMut = useMutation({
    mutationFn: () => updatePurchaseOrderStatus(id, 'cancelled'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_order', id] })
      setConfirmCancel(false)
    },
  })

  if (loadingOrder || loadingItems) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-zinc-500">
        Orden de compra no encontrada.{' '}
        <button onClick={() => router.push('/purchases')} className="text-blue-600 hover:underline">Volver</button>
      </div>
    )
  }

  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.draft
  const isEditable  = order.status === 'draft'
  const canSend     = order.status === 'draft'
  const canReceive  = order.status === 'draft' || order.status === 'sent'
  const canCancel   = order.status === 'draft' || order.status === 'sent'
  const isFinished  = order.status === 'received' || order.status === 'cancelled'

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">

      {/* Barra superior */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/purchases')}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-zinc-900">{order.order_number}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {canSend && !sentMut.isSuccess && (
            <button onClick={() => sentMut.mutate()} disabled={sentMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50">
              {sentMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Marcar enviada
            </button>
          )}
          {canReceive && !confirmReceive && (
            <button onClick={() => setConfirmReceive(true)}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors">
              <PackageCheck className="h-3.5 w-3.5" />
              Recibir mercancía
            </button>
          )}
          {canReceive && confirmReceive && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">¿Confirmar recepción? El stock aumentará.</span>
              <button onClick={() => receiveMut.mutate()} disabled={receiveMut.isPending}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                {receiveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sí, recibir'}
              </button>
              <button onClick={() => setConfirmReceive(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancelar
              </button>
            </div>
          )}
          {canCancel && !confirmCancel && (
            <button onClick={() => setConfirmCancel(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
              <Ban className="h-3.5 w-3.5" />
              Anular
            </button>
          )}
          {canCancel && confirmCancel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">¿Anular esta orden?</span>
              <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {cancelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sí, anular'}
              </button>
              <button onClick={() => setConfirmCancel(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Documento relacionado */}
      {relatedInvoice && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span>Factura de proveedor generada:</span>
          <Link href={`/purchases/invoices/${relatedInvoice.id}`}
            className="font-semibold font-mono hover:underline">
            {relatedInvoice.invoice_number}
          </Link>
        </div>
      )}

      {/* Encabezado de la OC */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-0.5">Proveedor</p>
            <p className="font-medium text-zinc-900">
              {order.supplier?.name ?? <span className="text-zinc-400 italic">Sin proveedor</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-0.5">Fecha emisión</p>
              <p className="text-zinc-700">
                {new Date(order.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-0.5">Entrega esperada</p>
              <p className="text-zinc-700">
                {order.expected_date
                  ? new Date(order.expected_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
                  : <span className="text-zinc-400">—</span>}
              </p>
            </div>
          </div>
        </div>
        {order.notes && (
          <div className="mt-3 pt-3 border-t border-zinc-100">
            <p className="text-xs font-medium text-zinc-500 mb-0.5">Notas</p>
            <p className="text-sm text-zinc-600">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Tabla de ítems */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70">
              <th className="w-10 px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">#</th>
              <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Ref.</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Descripción</th>
              <th className="w-20 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Cant.</th>
              <th className="w-28 px-2 py-2.5 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Precio unit.</th>
              <th className="w-16 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Desc%</th>
              <th className="w-20 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">IVA</th>
              <th className="w-24 px-3 py-2.5 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">Sin ítems</td>
              </tr>
            )}
            {items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-zinc-50/40 transition-colors">
                <td className="px-3 py-2.5 text-xs text-zinc-400">{idx + 1}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-zinc-500">{item.sku ?? '—'}</td>
                <td className="px-3 py-2.5 text-sm text-zinc-900">{item.product_name}</td>
                <td className="px-2 py-2.5 text-center text-sm text-zinc-700">{item.quantity}</td>
                <td className="px-2 py-2.5 text-right text-sm text-zinc-700">{fmt(item.unit_price)}</td>
                <td className="px-2 py-2.5 text-center text-sm text-zinc-500">{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                <td className="px-2 py-2.5 text-center text-sm text-zinc-500">{item.tax_rate > 0 ? `${Math.round(item.tax_rate * 100)}%` : '0%'}</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-zinc-900">{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-72 rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm text-zinc-600">
            <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-zinc-600">
            <span>IVA (descontable)</span><span>{fmt(order.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200">
            <span>Total</span><span>{fmt(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Errores de mutación */}
      {(receiveMut.isError || cancelMut.isError || sentMut.isError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {receiveMut.error?.message ?? cancelMut.error?.message ?? sentMut.error?.message}
        </div>
      )}
    </div>
  )
}
