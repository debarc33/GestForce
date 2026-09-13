'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, X, Copy, AlertCircle, Loader2 } from 'lucide-react'
import { createCreditDebitNote, type CreditDebitNoteItem } from '../queries'
import type { InvoiceWithCustomer } from '../queries'

// ─── Razones por tipo ──────────────────────────────────────────────────────

const CREDIT_REASONS = [
  { value: 'return',           label: 'Devolución parcial de bienes' },
  { value: 'discount',         label: 'Descuento / bonificación no aplicado' },
  { value: 'cancellation',     label: 'Anulación total de la factura' },
  { value: 'price_adjustment', label: 'Ajuste de precio acordado' },
  { value: 'other',            label: 'Otro' },
]

const DEBIT_REASONS = [
  { value: 'interest',      label: 'Intereses por mora' },
  { value: 'extra_cost',    label: 'Gastos adicionales al contrato' },
  { value: 'price_increase', label: 'Incremento en precio acordado' },
  { value: 'other',         label: 'Otro' },
]

// ─── Tipos locales ──────────────────────────────────────────────────────────

type NoteItem = {
  product_id?:  string
  product_name: string
  sku?:         string
  quantity:     number
  unit_price:   number
  discount:     number
  tax_rate:     number
  subtotal:     number
  tax:          number
  total:        number
}

function recalc(item: NoteItem): NoteItem {
  const base = item.quantity * item.unit_price * (1 - item.discount / 100)
  const tax  = base * item.tax_rate
  return { ...item, subtotal: base, tax, total: base + tax }
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
const today = () => new Date().toISOString().split('T')[0]

const inp =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'
const lbl = 'block text-xs font-medium text-zinc-500 mb-1'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  invoice:       InvoiceWithCustomer
  invoiceItems:  CreditDebitNoteItem[]   // items originales de la factura
  noteType:      'credit' | 'debit'
  companyId:     string
  onClose:       () => void
  onSuccess?:    (noteId: string) => void
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function CreditDebitNoteForm({ invoice, invoiceItems, noteType, companyId, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient()

  const reasons = noteType === 'credit' ? CREDIT_REASONS : DEBIT_REASONS
  const accentColor = noteType === 'credit'
    ? { bar: 'bg-orange-600', btn: 'bg-orange-600 hover:bg-orange-700', border: 'border-orange-200 bg-orange-50/20' }
    : { bar: 'bg-primary',   btn: 'bg-primary hover:bg-blue-800',   border: 'border-blue-200 bg-blue-50/20' }

  const [reason, setReason]       = useState(reasons[0].value)
  const [issueDate, setIssueDate] = useState(today())
  const [notes, setNotes]         = useState('')
  const [items, setItems]         = useState<NoteItem[]>([])
  const [error, setError]         = useState<string | null>(null)

  const totals = useMemo(() => ({
    subtotal: items.reduce((s, i) => s + i.subtotal, 0),
    tax:      items.reduce((s, i) => s + i.tax,      0),
    total:    items.reduce((s, i) => s + i.total,    0),
  }), [items])

  // Copiar todos los ítems de la factura
  const copyFromInvoice = () => {
    setItems(invoiceItems.map(ii => recalc({
      product_id:   ii.product_id ?? undefined,
      product_name: ii.product_name,
      sku:          ii.sku ?? undefined,
      quantity:     Number(ii.quantity),
      unit_price:   Number(ii.unit_price),
      discount:     Number(ii.discount),
      tax_rate:     Number(ii.tax_rate),
      subtotal:     0, tax: 0, total: 0,
    })))
  }

  const addEmptyItem = () => {
    setItems(prev => [...prev, recalc({
      product_name: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0.19,
      subtotal: 0, tax: 0, total: 0,
    })])
  }

  const updateField = (idx: number, field: keyof NoteItem, value: number | string) => {
    setItems(prev => {
      const updated = [...prev]
      updated[idx] = recalc({ ...updated[idx], [field]: value })
      return updated
    })
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const mutation = useMutation({
    mutationFn: () => {
      if (items.length === 0) throw new Error('Agrega al menos un ítem.')
      if (!reason)            throw new Error('Selecciona la razón de la nota.')
      return createCreditDebitNote({
        company_id: companyId,
        invoice_id: invoice.id,
        type:       noteType,
        reason,
        issue_date: issueDate,
        subtotal:   totals.subtotal,
        tax:        totals.tax,
        total:      totals.total,
        notes:      notes || null,
        items:      items.map(({ product_id, product_name, sku, quantity, unit_price, discount, tax_rate, subtotal, tax, total }) => ({
          product_id, product_name, sku, quantity, unit_price, discount, tax_rate, subtotal, tax, total,
        })),
      })
    },
    onSuccess: (noteId) => {
      queryClient.invalidateQueries({ queryKey: ['credit_debit_notes', invoice.id] })
      onSuccess?.(noteId)
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const title = noteType === 'credit' ? 'NOTA CRÉDITO' : 'NOTA DÉBITO'

  return (
    <div className="flex flex-col max-h-[85vh] rounded-2xl overflow-hidden border-2 border-blue-100">
      {/* Barra de título */}
      <div className={`${accentColor.bar} px-5 py-3 flex items-center justify-between shrink-0`}>
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">{title}</p>
          <p className="text-sm font-medium text-white mt-0.5">Factura origen: <span className="font-mono font-bold">{invoice.invoice_number}</span></p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Cuerpo */}
      <div className="overflow-y-auto flex-1 p-5 space-y-4 bg-white">

        {/* Razón + Fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Razón <span className="text-red-500">*</span></label>
            <select value={reason} onChange={e => setReason(e.target.value)} className={inp}>
              {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Fecha de emisión</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inp} />
          </div>
        </div>

        {/* Tabla de ítems */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Ítems</p>
            <div className="flex items-center gap-2">
              {invoiceItems.length > 0 && (
                <button onClick={copyFromInvoice}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <Copy className="h-3 w-3" />
                  Copiar de factura
                </button>
              )}
              <button onClick={addEmptyItem}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                <Plus className="h-3 w-3" />
                Agregar ítem
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
              Usa "Copiar de factura" o agrega ítems manualmente
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Descripción</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-16">Cant.</th>
                    <th className="text-right px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-24">P. Unit.</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-14">Desc%</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-14">IVA%</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-24">Total</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="px-2 py-1.5">
                        <input value={item.product_name} onChange={e => updateField(idx, 'product_name', e.target.value)}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-400 focus:outline-none"
                          placeholder="Descripción del ítem..." />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => updateField(idx, 'quantity', Math.max(0.01, item.quantity - 1))}
                            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100"><Minus className="h-3 w-3" /></button>
                          <input type="number" min={0.01} step={0.01} value={item.quantity}
                            onChange={e => updateField(idx, 'quantity', Math.max(0.01, Number(e.target.value)))}
                            className="w-12 rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs text-center focus:border-blue-400 focus:outline-none" />
                          <button onClick={() => updateField(idx, 'quantity', item.quantity + 1)}
                            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100"><Plus className="h-3 w-3" /></button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} value={item.unit_price}
                          onChange={e => updateField(idx, 'unit_price', Number(e.target.value))}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-right focus:border-blue-400 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} max={100} value={item.discount}
                          onChange={e => updateField(idx, 'discount', Number(e.target.value))}
                          className="w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs text-center focus:border-blue-400 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={item.tax_rate} onChange={e => updateField(idx, 'tax_rate', Number(e.target.value))}
                          className="w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs text-center focus:border-blue-400 focus:outline-none">
                          <option value={0}>0%</option>
                          <option value={0.05}>5%</option>
                          <option value={0.19}>19%</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-900">{fmt(item.total)}</td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeItem(idx)}
                          className="rounded p-1 text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totales */}
        {items.length > 0 && (
          <div className="flex justify-end">
            <div className="w-52 rounded-lg border border-zinc-200 overflow-hidden text-sm">
              <div className="flex justify-between px-3 py-1.5 text-zinc-500 border-b border-zinc-100">
                <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5 text-zinc-500 border-b border-zinc-100">
                <span>IVA</span><span>{fmt(totals.tax)}</span>
              </div>
              <div className={`flex justify-between px-3 py-2 font-bold ${noteType === 'credit' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                <span>Total nota</span><span>{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className={lbl}>Observaciones <span className="text-zinc-400 font-normal">(opcional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className={inp + ' resize-none'} placeholder="Detalle adicional sobre esta nota..." />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
        )}

        {/* Acción */}
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || items.length === 0}
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 shadow-sm ${accentColor.btn}`}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Emitir {noteType === 'credit' ? 'Nota Crédito' : 'Nota Débito'}
        </button>
      </div>
    </div>
  )
}
