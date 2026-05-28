'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  flexRender, getCoreRowModel, useReactTable, type ColumnDef,
} from '@tanstack/react-table'
import { Plus, Loader2, Wallet, Printer, Mail, X } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registerReceiptPayment, usePaymentMethods, useReceiptPayments, type ReceiptWithDetails } from '../queries'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendiente', cls: 'bg-red-50 text-red-600' },
  partial:   { label: 'Parcial',   cls: 'bg-amber-50 text-amber-700' },
  paid:      { label: 'Pagado',    cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-zinc-100 text-zinc-500' },
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
const today = () => new Date().toISOString().split('T')[0]
const inputCls = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors'

// ─── ReceiptDialog ─────────────────────────────────────────────────────────

function ReceiptDialog({
  receipt,
  companyId,
  onClose,
}: {
  receipt: ReceiptWithDetails
  companyId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: paymentMethods = [] } = usePaymentMethods(companyId)
  const { data: payments = [] } = useReceiptPayments(receipt.id)

  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [date, setDate] = useState(today())
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      registerReceiptPayment({
        receipt_id: receipt.id,
        payment_method_id: methodId,
        amount: Number(amount),
        payment_date: date,
        reference: reference || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts', companyId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] })
      queryClient.invalidateQueries({ queryKey: ['receipt_payments', receipt.id] })
      setAmount('')
      setMethodId('')
      setReference('')
      setError(null)
      if (receipt.balance - Number(amount) <= 0) onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleRegister = () => {
    if (!methodId) { setError('Selecciona un medio de pago'); return }
    if (!amount || Number(amount) <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (Number(amount) > receipt.balance) { setError(`El monto no puede superar el saldo de ${fmt(receipt.balance)}`); return }
    setError(null)
    mutation.mutate()
  }

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=600')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/><title>${receipt.receipt_number}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, sans-serif; font-size: 13px; color: #111; padding: 40px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .mono { font-family: monospace; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #f4f4f5; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #555; }
      td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
      .right { text-align: right; }
      .total { font-weight: 700; font-size: 15px; }
      .section { margin-top: 20px; }
      .muted { color: #888; font-size: 12px; }
    </style>
  </head><body>
    <div style="display:flex;justify-content:space-between;align-items:start">
      <div><h1>GestForce</h1><p class="muted">Recibo de Cobro</p></div>
      <div style="text-align:right">
        <p class="mono" style="font-size:18px;font-weight:700">${receipt.receipt_number}</p>
        <p class="muted">${new Date().toLocaleDateString('es-CO')}</p>
      </div>
    </div>
    ${receipt.customer ? `<div class="section"><p style="font-weight:600">${receipt.customer.name}</p>${(receipt as any).customer?.email ? `<p class="muted">${(receipt as any).customer.email}</p>` : ''}</div>` : ''}
    ${receipt.invoice_number ? `<p class="section muted">Factura: <span class="mono">${receipt.invoice_number}</span></p>` : ''}
    <table class="section">
      <thead><tr><th>Concepto</th><th class="right">Valor</th></tr></thead>
      <tbody>
        <tr><td>Total factura</td><td class="right">${fmt(receipt.total_amount)}</td></tr>
        <tr><td>Total pagado</td><td class="right" style="color:#16a34a">${fmt(receipt.amount_paid)}</td></tr>
        <tr class="total"><td>Saldo pendiente</td><td class="right" style="color:${receipt.balance > 0 ? '#dc2626' : '#16a34a'}">${fmt(receipt.balance)}</td></tr>
      </tbody>
    </table>
    ${payments.length > 0 ? `
    <div class="section">
      <p style="font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.05em;margin-bottom:8px">Pagos registrados</p>
      <table>
        <thead><tr><th>Fecha</th><th>Medio</th><th>Referencia</th><th class="right">Monto</th></tr></thead>
        <tbody>
          ${payments.map(p => `<tr>
            <td>${new Date(p.payment_date + 'T12:00:00').toLocaleDateString('es-CO', {day:'2-digit',month:'short',year:'numeric'})}</td>
            <td>${p.payment_method?.name ?? '—'}</td>
            <td class="muted">${p.reference ? '#' + p.reference : '—'}</td>
            <td class="right" style="font-weight:600">${fmt(p.amount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
    <p class="section muted" style="text-align:center;margin-top:30px">Documento generado por GestForce · ${new Date().toLocaleDateString('es-CO')}</p>
  </body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const handleEmail = () => {
    const email = (receipt as any).customer?.email ?? ''
    const subject = encodeURIComponent(`Recibo de pago ${receipt.receipt_number}`)
    const body = encodeURIComponent(
      `Estimado/a ${receipt.customer?.name ?? 'cliente'},\n\n` +
      `Le informamos que hemos registrado su pago.\n\n` +
      `Recibo: ${receipt.receipt_number}\n` +
      `Total factura: ${fmt(receipt.total_amount)}\n` +
      `Total pagado: ${fmt(receipt.amount_paid)}\n` +
      `Saldo pendiente: ${fmt(receipt.balance)}\n\n` +
      `Saludos cordiales,`
    )
    window.open(`mailto:${email}?subject=${subject}&body=${body}`)
  }

  const customerEmail = (receipt as any).customer?.email as string | undefined
  const statusCfg = STATUS_CFG[receipt.status] ?? STATUS_CFG.pending

  return (
    <div className="flex flex-col max-h-[80vh] border-2 border-blue-100 rounded-2xl overflow-hidden">
      {/* ── Barra de título resaltada ── */}
      <div className="bg-blue-600 px-5 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-blue-200 uppercase">Recibo de Cobro</p>
          <p className="text-lg font-bold font-mono text-white mt-0.5">{receipt.receipt_number}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white border border-white/30 hover:bg-white/10 transition-colors">
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          {customerEmail && (
            <button onClick={handleEmail}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white border border-white/30 hover:bg-white/10 transition-colors">
              <Mail className="h-3.5 w-3.5" />
              Correo
            </button>
          )}
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 bg-white">

        {/* Cliente + Factura + Estado */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {receipt.customer && (
              <p className="font-semibold text-zinc-900">{receipt.customer.name}</p>
            )}
            {customerEmail && <p className="text-xs text-zinc-400">{customerEmail}</p>}
            {receipt.invoice_number && (
              <p className="text-xs text-zinc-500 mt-1">
                Factura:{' '}
                <button
                  onClick={() => { onClose(); router.push(`/sales/invoices/${receipt.invoice_id}`) }}
                  className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                  {receipt.invoice_number}
                </button>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-zinc-400">{new Date().toLocaleDateString('es-CO')}</p>
            <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Resumen de valores */}
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Concepto</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100">
                <td className="px-3 py-2 text-zinc-600">Total factura</td>
                <td className="px-3 py-2 text-right font-medium text-zinc-900">{fmt(receipt.total_amount)}</td>
              </tr>
              <tr className="border-t border-zinc-100">
                <td className="px-3 py-2 text-zinc-600">Total pagado</td>
                <td className="px-3 py-2 text-right font-medium text-green-600">{fmt(receipt.amount_paid)}</td>
              </tr>
              <tr className="border-t border-zinc-200 bg-blue-50">
                <td className="px-3 py-2 font-semibold text-zinc-700">Saldo pendiente</td>
                <td className={`px-3 py-2 text-right font-bold ${receipt.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(receipt.balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Historial de pagos */}
        {payments.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Pagos registrados</p>
            <div className="rounded-lg border border-zinc-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Fecha</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Medio</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Ref.</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-100">
                      <td className="px-3 py-2 text-xs text-zinc-600">
                        {new Date(p.payment_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-zinc-700">{p.payment_method?.name ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-400">{p.reference ? '#' + p.reference : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-900 text-xs">{fmt(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Registrar abono form — only if not paid/cancelled */}
        {receipt.status !== 'paid' && receipt.status !== 'cancelled' && (
          <div className="space-y-3 border-t border-zinc-100 pt-3">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Registrar abono</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Monto</label>
                <input
                  type="number"
                  min={0.01}
                  max={receipt.balance}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Máx. ${fmt(receipt.balance)}`}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Medio de pago</label>
              <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className={inputCls}>
                <option value="">Selecciona...</option>
                {paymentMethods.filter((m) => m.is_active).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {paymentMethods.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay medios de pago configurados. Ve a Configuración → Medios de pago.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Referencia / comprobante (opcional)</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="# transferencia, recibo, etc."
                className={inputCls}
              />
            </div>

            {error && <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">{error}</p>}

            <button
              onClick={handleRegister}
              disabled={mutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar abono
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tabla principal ──────────────────────────────────────────────────────

interface Props {
  receipts: ReceiptWithDetails[]
  companyId: string
  globalFilter?: string
  statusFilter?: string
  autoOpenReceiptId?: string
}

export function ReceiptsTable({ receipts, companyId, globalFilter = '', statusFilter = 'all', autoOpenReceiptId }: Props) {
  const [openReceipt, setOpenReceipt] = useState<ReceiptWithDetails | null>(null)

  // Auto-abrir modal cuando llega un ID por query param
  useEffect(() => {
    if (autoOpenReceiptId && receipts.length > 0) {
      const target = receipts.find(r => r.id === autoOpenReceiptId)
      if (target) setOpenReceipt(target)
    }
  }, [autoOpenReceiptId, receipts])

  const filteredData = useMemo(() => {
    let data = receipts
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase()
      data = data.filter(
        (r) =>
          r.receipt_number.toLowerCase().includes(q) ||
          (r.customer?.name ?? '').toLowerCase().includes(q) ||
          (r.invoice_number ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') data = data.filter((r) => r.status === statusFilter)
    return data
  }, [receipts, globalFilter, statusFilter])

  const columns: ColumnDef<ReceiptWithDetails>[] = [
    {
      accessorKey: 'receipt_number',
      header: '# Recibo',
      cell: ({ row }) => {
        const s = row.original.status
        const isPendingOrPartial = s === 'pending' || s === 'partial'
        return (
          <div>
            <button
              onClick={() => setOpenReceipt(row.original)}
              className={`font-mono text-sm font-medium hover:underline transition-colors ${
                isPendingOrPartial ? 'text-blue-600 hover:text-blue-800' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {row.original.receipt_number}
            </button>
            {row.original.invoice_number && (
              <p className="text-xs text-zinc-400 font-mono">{row.original.invoice_number}</p>
            )}
          </div>
        )
      },
    },
    {
      id: 'customer',
      header: 'Cliente',
      cell: ({ row }) => (
        <span className="text-zinc-700">
          {row.original.customer?.name ?? <span className="italic text-zinc-400">Sin cliente</span>}
        </span>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Total',
      cell: ({ row }) => <span className="font-medium text-zinc-900">{fmt(row.original.total_amount)}</span>,
    },
    {
      accessorKey: 'amount_paid',
      header: 'Pagado',
      cell: ({ row }) => <span className="text-green-600 font-medium">{fmt(row.original.amount_paid)}</span>,
    },
    {
      accessorKey: 'balance',
      header: 'Saldo',
      cell: ({ row }) => (
        <span className={row.original.balance > 0 ? 'text-red-600 font-medium' : 'text-zinc-400'}>
          {fmt(row.original.balance)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const cfg = STATUS_CFG[row.original.status] ?? STATUS_CFG.pending
        return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
      },
    },
  ]

  const table = useReactTable({ data: filteredData, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <>
      <div className="rounded-xl border border-zinc-100 bg-white shadow-md overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-zinc-200 hover:bg-zinc-50">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="py-4 px-4 font-semibold text-zinc-700 text-[12px] uppercase tracking-wide">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <Wallet className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">
                      {globalFilter || statusFilter !== 'all' ? 'Ningún recibo coincide' : 'No hay recibos — se crean al remitir una factura'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Receipt dialog */}
      <Dialog open={!!openReceipt} onOpenChange={(open) => !open && setOpenReceipt(null)}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl shadow-xl border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Recibo de pago</DialogTitle>
          {openReceipt && (
            <ReceiptDialog
              receipt={openReceipt}
              companyId={companyId}
              onClose={() => setOpenReceipt(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
