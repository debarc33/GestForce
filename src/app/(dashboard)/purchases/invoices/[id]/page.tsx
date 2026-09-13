'use client'

import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, CreditCard, Link2, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import {
  useSupplierInvoice, useSupplierInvoiceItems,
  useSupplierPayments, registerSupplierPayment,
} from '@/modules/purchases/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import Link from 'next/link'

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendiente', cls: 'bg-red-50 text-red-600' },
  partial:   { label: 'Parcial',   cls: 'bg-amber-50 text-amber-700' },
  paid:      { label: 'Pagada',    cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Anulada',   cls: 'bg-zinc-100 text-zinc-500' },
}

const today = () => new Date().toISOString().split('T')[0]

const inputCls =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'

export default function SupplierInvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [showPayForm, setShowPayForm]       = useState(false)
  const [payAmount, setPayAmount]           = useState('')
  const [payDate, setPayDate]               = useState(today())
  const [payMethod, setPayMethod]           = useState('')
  const [payReference, setPayReference]     = useState('')
  const [payNotes, setPayNotes]             = useState('')
  const [payError, setPayError]             = useState<string | null>(null)

  const { data: invoice,      isLoading: loadingInv  } = useSupplierInvoice(id)
  const { data: items   = [], isLoading: loadingItems } = useSupplierInvoiceItems(id)
  const { data: payments = [] } = useSupplierPayments(id)

  const payMut = useMutation({
    mutationFn: () => {
      const amount = parseFloat(payAmount)
      if (!payAmount || isNaN(amount) || amount <= 0) {
        throw new Error('Ingresa un monto válido mayor a 0.')
      }
      if (!activeCompanyId) throw new Error('Sin empresa activa.')
      return registerSupplierPayment({
        company_id:     activeCompanyId,
        invoice_id:     id,
        payment_date:   payDate,
        amount,
        payment_method: payMethod   || undefined,
        reference:      payReference|| undefined,
        notes:          payNotes    || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['supplier_payments', id] })
      queryClient.invalidateQueries({ queryKey: ['supplier_invoices', activeCompanyId] })
      setShowPayForm(false)
      setPayAmount('')
      setPayDate(today())
      setPayMethod('')
      setPayReference('')
      setPayNotes('')
      setPayError(null)
    },
    onError: (e: Error) => setPayError(e.message),
  })

  if (loadingInv || loadingItems) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 text-zinc-500">
        Factura no encontrada.{' '}
        <button onClick={() => router.push('/purchases')} className="text-primary hover:underline">Volver</button>
      </div>
    )
  }

  const cfg = STATUS_CFG[invoice.status] ?? STATUS_CFG.pending
  const canPay = invoice.status === 'pending' || invoice.status === 'partial'

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">

      {/* Barra superior */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/purchases')}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-zinc-900">{invoice.invoice_number}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>
        {canPay && (
          <button onClick={() => setShowPayForm(!showPayForm)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors">
            <CreditCard className="h-3.5 w-3.5" />
            Registrar pago
          </button>
        )}
      </div>

      {/* OC relacionada */}
      {invoice.order_number && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span>Generada desde:</span>
          <Link href={`/purchases/orders/${invoice.order_id}`}
            className="font-semibold font-mono text-primary hover:underline">
            {invoice.order_number}
          </Link>
        </div>
      )}

      {/* Formulario de pago */}
      {showPayForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800">Registrar pago</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Monto *</label>
              <input type="number" min="0" step="any"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={`Máx. ${fmt(invoice.balance_due)}`}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha *</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Medio de pago</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls}>
                <option value="">Sin especificar</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia bancaria</option>
                <option value="cheque">Cheque</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Referencia / # transacción</label>
              <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)}
                placeholder="Ej. 20240001" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Notas</label>
              <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                placeholder="Observaciones opcionales" className={inputCls} />
            </div>
          </div>
          {payError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />{payError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowPayForm(false); setPayError(null) }}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              Cancelar
            </button>
            <button onClick={() => payMut.mutate()} disabled={payMut.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {payMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar pago
            </button>
          </div>
        </div>
      )}

      {/* Encabezado de la factura */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-0.5">Proveedor</p>
            <p className="font-medium text-zinc-900">
              {invoice.supplier?.name ?? <span className="text-zinc-400 italic">Sin proveedor</span>}
            </p>
            {invoice.supplier_invoice_no && (
              <p className="text-xs text-zinc-500 mt-0.5">
                # Factura proveedor: <span className="font-mono">{invoice.supplier_invoice_no}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-0.5">Fecha emisión</p>
              <p className="text-zinc-700">
                {new Date(invoice.issue_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-0.5">Vencimiento</p>
                <p className="text-zinc-700">
                  {new Date(invoice.due_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de ítems */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70">
              <th className="w-10 px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">#</th>
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
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">Sin ítems</td>
              </tr>
            )}
            {items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-zinc-50/40 transition-colors">
                <td className="px-3 py-2.5 text-xs text-zinc-400">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <p className="text-sm text-zinc-900">{item.product_name}</p>
                  {item.sku && <p className="text-xs font-mono text-zinc-400">{item.sku}</p>}
                </td>
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

      {/* Totales + Resumen fiscal */}
      <div className="flex justify-end">
        <div className="w-80 rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm text-zinc-600">
            <span>Subtotal</span><span>{fmt(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-zinc-600">
            <span>IVA descontable</span><span>{fmt(invoice.tax)}</span>
          </div>
          {invoice.withholding > 0 && (
            <div className="flex justify-between text-sm text-amber-700">
              <span>Retención en la fuente</span><span>-{fmt(invoice.withholding)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200">
            <span>Total a pagar</span><span>{fmt(invoice.total)}</span>
          </div>
          {invoice.balance_due < invoice.total && (
            <div className="flex justify-between text-sm text-green-700 pt-1 border-t border-zinc-100">
              <span>Pagado</span><span>{fmt(invoice.total - invoice.balance_due)}</span>
            </div>
          )}
          <div className={`flex justify-between text-sm font-semibold pt-1 ${invoice.balance_due > 0 ? 'text-red-700' : 'text-green-700'}`}>
            <span>Saldo pendiente</span><span>{fmt(invoice.balance_due)}</span>
          </div>
        </div>
      </div>

      {/* Historial de pagos */}
      {payments.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-sm font-semibold text-zinc-700">Historial de pagos</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/30">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Medio</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Referencia</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payments.map(pmt => (
                <tr key={pmt.id} className="hover:bg-zinc-50/40 transition-colors">
                  <td className="px-4 py-2.5 text-zinc-600">
                    {new Date(pmt.payment_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 capitalize">{pmt.payment_method ?? '—'}</td>
                  <td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">{pmt.reference ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{fmt(pmt.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
