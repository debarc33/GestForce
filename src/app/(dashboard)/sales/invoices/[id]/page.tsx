'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertCircle, Loader2, FileText, Printer, Ban, Link2, Receipt, FileMinus, FilePlus, AlertTriangle } from 'lucide-react'
import { useCustomers } from '@/modules/customers/queries'
import { useCommissionAgents } from '@/modules/payroll/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  useInvoice, useInvoiceItems, cancelInvoice, updateInvoiceAgent, useReceipts,
  useCreditDebitNotes, useCreditDebitNoteItems,
  type CreditDebitNote,
} from '@/modules/sales/queries'
import { DocumentViewer, type DocData } from '@/modules/sales/components/document-viewer'
import { CreditDebitNoteForm } from '@/modules/sales/components/credit-debit-note-form'
import { useCompany, getDianAlerts, isIvaResponsible } from '@/modules/company/queries'
import { CustomerSearch } from '@/components/ui/customer-search'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { SaleItemValues } from '@/modules/sales/schemas'

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Borrador', cls: 'bg-zinc-100 text-zinc-600' },
  issued:    { label: 'Emitida',  cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Anulada', cls: 'bg-red-100 text-red-600' },
}

const inputRoCls =
  'w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 cursor-default'

// ─── Página ───────────────────────────────────────────────────────────────

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [initialized, setInitialized] = useState(false)
  const [items, setItems]             = useState<SaleItemValues[]>([])
  const [error, setError]             = useState<string | null>(null)
  const [showDoc, setShowDoc]             = useState(false)
  const [autoPrint, setAutoPrint]         = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [noteType, setNoteType]           = useState<'credit' | 'debit' | null>(null)
  const [viewingNote, setViewingNote]     = useState<CreditDebitNote | null>(null)
  const [agentSaved, setAgentSaved]       = useState(false)

  const { data: invoice,      isLoading: loadingInvoice } = useInvoice(id)
  const { data: invoiceItems = [], isLoading: loadingItems } = useInvoiceItems(id)
  const { data: customers    = [] } = useCustomers(activeCompanyId ?? undefined)
  const { data: company            } = useCompany(activeCompanyId)
  const { data: allReceipts = []   } = useReceipts(activeCompanyId ?? undefined)
  const { data: creditDebitNotes = [] } = useCreditDebitNotes(id)
  const { data: noteItems = []     } = useCreditDebitNoteItems(viewingNote?.id)
  const { data: commissionAgents = [] } = useCommissionAgents(activeCompanyId ?? undefined)

  const agentMut = useMutation({
    mutationFn: (agentId: string | null) => updateInvoiceAgent(id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      setAgentSaved(true)
      setTimeout(() => setAgentSaved(false), 2000)
    },
  })
  const invoiceReceipts = allReceipts.filter(r => r.invoice_id === id)

  const { expiryAlert } = getDianAlerts(company)
  const ivaMode         = isIvaResponsible(company?.fiscal_regime)
  const buyerThreshold  = company?.buyer_threshold ?? 212000

  useEffect(() => {
    if (!initialized && invoice && !loadingItems) {
      setItems(invoiceItems.map(ii => ({
        product_id:   ii.product_id ?? '',
        product_name: ii.product_name,
        sku:          ii.sku,
        quantity:     Number(ii.quantity),
        unit_price:   Number(ii.unit_price),
        discount:     Number(ii.discount),
        tax_rate:     Number(ii.tax_rate),
        subtotal:     Number(ii.subtotal),
        tax:          Number(ii.tax),
        total:        Number(ii.total),
        stock:        ii.stock,
      })))
      setInitialized(true)
    }
  }, [invoice, invoiceItems, loadingItems, initialized])

  // Facturas siempre en modo lectura — la edición se hace en la cotización
  const isDraft = invoice?.status === 'draft'

  const totals = useMemo(() => ({
    subtotal: items.reduce((s, i) => s + i.subtotal, 0),
    tax:      items.reduce((s, i) => s + i.tax,      0),
    total:    items.reduce((s, i) => s + i.total,    0),
  }), [items])

  const cancelMut = useMutation({
    mutationFn: () => cancelInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['invoice',  id] })
      router.push('/sales')
    },
    onError: (e: Error) => setError(e.message),
  })

  // DocData para el visor
  const docData: DocData | null = invoice ? {
    type:               'invoice',
    document_type:      invoice.document_type ?? 'invoice',
    is_tax_responsible: company?.fiscal_regime === 'iva' || company?.fiscal_regime === 'gran_contribuyente',
    number:     invoice.invoice_number,
    issue_date: invoice.issue_date,
    due_date:   invoice.due_date,
    status:     invoice.status,
    subtotal:   Number(invoice.subtotal),
    tax:        Number(invoice.tax),
    total:      Number(invoice.total),
    notes:           invoice.notes,
    fe_software_id:  company?.fe_software_id  ?? null,
    fe_technical_key: company?.fe_technical_key ?? null,
    fe_test_mode:    company?.fe_test_mode    ?? true,
    company:    company ? { ...company, dian_resolution: company.dian_resolution ?? null } : null,
    customer:   invoice.customer ? {
      name:       invoice.customer.name,
      doc_type:   invoice.customer.doc_type ?? null,
      doc_number: invoice.customer.doc_number ?? null,
      email:      invoice.customer.email ?? null,
      phone:      invoice.customer.phone ?? null,
      address:    invoice.customer.address ?? null,
      city:       invoice.customer.city ?? null,
    } : null,
    items: invoiceItems.map(ii => ({
      product_name: ii.product_name, sku: ii.sku,
      quantity: Number(ii.quantity), unit_price: Number(ii.unit_price), discount: Number(ii.discount),
      tax_rate: Number(ii.tax_rate), subtotal: Number(ii.subtotal), tax: Number(ii.tax), total: Number(ii.total),
    })),
  } : null

  // ── Loading / not found ────────────────────────────────────────────────

  if (loadingInvoice) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 text-zinc-400">
        <p className="text-sm">Factura no encontrada.</p>
        <button onClick={() => router.push('/sales')} className="text-xs text-primary underline">Volver</button>
      </div>
    )
  }

  const statusCfg = STATUS_CFG[invoice.status] ?? { label: invoice.status, cls: 'bg-zinc-100 text-zinc-600' }
  const isTicket  = invoice.document_type === 'ticket'

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">

      {/* 1 · Barra superior */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sales')}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase leading-none mb-0.5
              text-zinc-400">
              {isTicket ? 'Ticket de Venta' : 'Factura de Venta'}
            </p>
            <h1 className="text-xl font-semibold text-zinc-900 font-mono leading-none">{invoice.invoice_number}</h1>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notas Crédito / Débito — solo facturas emitidas */}
          {invoice.status === 'issued' && !isTicket && (
            <>
              <button onClick={() => setNoteType('credit')}
                className="flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-2 text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors">
                <FileMinus className="h-4 w-4" />
                Nota Crédito
              </button>
              <button onClick={() => setNoteType('debit')}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-primary hover:bg-blue-50 transition-colors">
                <FilePlus className="h-4 w-4" />
                Nota Débito
              </button>
            </>
          )}
          {/* Anular — solo borradores heredados del sistema anterior */}
          {isDraft && !confirmCancel && (
            <button onClick={() => setConfirmCancel(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
              <Ban className="h-4 w-4" />
              Anular
            </button>
          )}
          {isDraft && confirmCancel && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-xs text-red-700 font-medium">¿Confirmar anulación?</span>
              <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
                className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-40">
                {cancelMut.isPending ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Sí, anular'}
              </button>
              <button onClick={() => setConfirmCancel(false)} className="text-xs text-zinc-500 hover:text-zinc-700">
                No
              </button>
            </div>
          )}
          <button onClick={() => { setAutoPrint(false); setShowDoc(true) }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            <FileText className="h-4 w-4" />
            Ver documento
          </button>
          <button onClick={() => { setAutoPrint(true); setShowDoc(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition-colors">
            <Printer className="h-4 w-4" />
            {isTicket ? 'Imprimir ticket' : 'Imprimir / PDF'}
          </button>
        </div>
      </div>

      {/* 1b · Alerta resolución DIAN vencida */}
      {expiryAlert === 'expired' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 -mt-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          La resolución DIAN está vencida. Los documentos emitidos no tendrán validez fiscal.
          <button onClick={() => router.push('/settings')} className="underline font-medium ml-1">Ir a Configuración</button>
        </div>
      )}
      {expiryAlert === 'warning' && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 -mt-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          La resolución DIAN está próxima a vencer. Renuévala antes de que se agote.
        </div>
      )}

      {/* 1c · Documentos relacionados */}
      {(invoice.quote_id || invoiceReceipts.length > 0 || creditDebitNotes.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap -mt-2">
          <Link2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-xs text-zinc-400">Relacionado:</span>
          {invoice.quote_id && (
            <button
              onClick={() => router.push(`/sales/quotes/${invoice.quote_id!}`)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors">
              <ArrowLeft className="h-3 w-3" />
              {invoice.quote_number ?? invoice.quote_id}
            </button>
          )}
          {invoiceReceipts.map(r => (
            <button key={r.id}
              onClick={() => router.push(`/sales?tab=receipts&openReceipt=${r.id}`)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors">
              <Receipt className="h-3 w-3" />
              {r.receipt_number}
            </button>
          ))}
          {creditDebitNotes.map(n => (
            <button key={n.id} onClick={() => setViewingNote(n)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono font-medium transition-colors ${
                n.type === 'credit'
                  ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
              }`}>
              {n.type === 'credit' ? <FileMinus className="h-3 w-3" /> : <FilePlus className="h-3 w-3" />}
              {n.note_number}
            </button>
          ))}
        </div>
      )}

      {/* Banner borrador heredado */}
      {isDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Esta es una factura en borrador del sistema anterior. Si ya no la necesitas, usa el botón <strong>Anular</strong>.
        </div>
      )}

      {/* 2 · Encabezado */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Cliente</label>
            <CustomerSearch customers={customers} value={invoice.customer_id ?? ''} onChange={() => {}} readOnly />
            {invoice.customer && (() => {
              const c = invoice.customer!
              const docStr = (c.doc_type && c.doc_number) ? `${c.doc_type} ${c.doc_number}` : null
              const locStr = [c.address, c.city].filter(Boolean).join(' · ')
              return (docStr || locStr) ? (
                <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                  {[docStr, locStr].filter(Boolean).join('  ·  ')}
                </p>
              ) : null
            })()}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha emisión</label>
            <input type="date" value={invoice.issue_date} readOnly className={inputRoCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha vencimiento</label>
            <input type="date" value={invoice.due_date ?? ''} readOnly className={inputRoCls} />
          </div>
        </div>

        {/* Agente de venta — siempre visible, no aparece en el documento del cliente */}
        <div className="border-t border-zinc-100 pt-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Agente de venta
                </label>
                <select
                  value={invoice.agent_id ?? ''}
                  onChange={e => agentMut.mutate(e.target.value === '' ? null : e.target.value)}
                  disabled={agentMut.isPending}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-colors disabled:opacity-60"
                >
                  <option value="">— Sin agente —</option>
                  {commissionAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.commission_rate != null ? ` (${a.commission_rate}%)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comisión calculada */}
              {invoice.agent && invoice.agent.commission_rate != null && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 min-w-40">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 mb-0.5">
                    Comisión estimada
                  </p>
                  <p className="text-sm font-bold text-indigo-700 tabular-nums">
                    {fmt(invoice.total * invoice.agent.commission_rate / 100)}
                  </p>
                  <p className="text-[10px] text-indigo-400">
                    {invoice.agent.commission_rate}% de {fmt(invoice.total)}
                  </p>
                </div>
              )}

              {/* Confirmación de guardado */}
              {agentSaved && (
                <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                  ✓ Agente guardado
                </span>
              )}
            </div>
        </div>
      </div>

      {/* 3 · Tabla de ítems */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70">
              <th className="w-10 px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">#</th>
              <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Ref.</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Descripción</th>
              <th className="w-32 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Cant.</th>
              <th className="w-28 px-2 py-2.5 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Precio unit.</th>
              <th className="w-16 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Desc%</th>
              <th className="w-20 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">IVA</th>
              <th className="w-24 px-3 py-2.5 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
              <th className="w-9 px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">

            {/* Empty state */}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-400">
                  Esta factura no tiene productos registrados
                </td>
              </tr>
            )}

            {/* Item rows — solo lectura */}
            {items.map((item, idx) => (
              <tr key={`${item.product_id}-${idx}`} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-3 py-2 text-xs text-zinc-400 tabular-nums">{idx + 1}</td>
                <td className="px-3 py-2 text-xs font-mono text-zinc-500">{item.sku ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-medium text-zinc-900">{item.product_name}</td>
                <td className="px-2 py-2 text-center text-sm text-zinc-700">{item.quantity}</td>
                <td className="px-2 py-2 text-right text-sm text-zinc-700">{fmt(item.unit_price)}</td>
                <td className="px-2 py-2 text-center text-sm text-zinc-500">{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                <td className="px-2 py-2 text-center text-xs text-zinc-500">{(item.tax_rate * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-zinc-900">{fmt(item.total)}</td>
                <td className="px-2 py-1.5"></td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>

      {/* 3b · Advertencia umbral comprador */}
      {totals.total > buyerThreshold && !invoice.customer_id && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Esta venta supera <strong>{fmt(buyerThreshold)}</strong>. La DIAN requiere identificar al comprador para documentos válidos.
        </div>
      )}

      {/* 4 · Notas + Totales */}
      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Notas / observaciones</label>
          <textarea value={invoice.notes ?? ''} readOnly rows={4}
            className={`${inputRoCls} resize-none`} />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm text-zinc-600">
            <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-zinc-600">
            <span>IVA</span><span>{fmt(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200">
            <span>Total</span><span>{fmt(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* 5 · Acciones */}
      <div className="flex items-center justify-end gap-3">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex-1">
            <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
        )}
        <button onClick={() => router.push('/sales')}
          className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          Volver
        </button>
      </div>

      {/* Visor de documento */}
      {docData && (
        <DocumentViewer
          open={showDoc}
          onClose={() => { setShowDoc(false); setAutoPrint(false) }}
          doc={docData}
          autoPrint={autoPrint}
        />
      )}

      {/* Modal: Nota Crédito / Débito */}
      <Dialog open={!!noteType} onOpenChange={(open) => !open && setNoteType(null)}>
        <DialogContent className="sm:max-w-[680px] p-0 rounded-2xl shadow-xl border-zinc-100 overflow-hidden">
          <DialogTitle className="sr-only">
            {noteType === 'credit' ? 'Crear Nota Crédito' : 'Crear Nota Débito'}
          </DialogTitle>
          {noteType && (
            <CreditDebitNoteForm
              invoice={invoice}
              invoiceItems={invoiceItems.map(ii => ({
                id: ii.id ?? '', note_id: '', product_id: ii.product_id ?? null,
                product_name: ii.product_name, sku: ii.sku ?? null,
                quantity: Number(ii.quantity), unit_price: Number(ii.unit_price),
                discount: Number(ii.discount), tax_rate: Number(ii.tax_rate),
                subtotal: Number(ii.subtotal), tax: Number(ii.tax), total: Number(ii.total),
              }))}
              noteType={noteType}
              companyId={activeCompanyId!}
              onClose={() => setNoteType(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Visor nota crédito/débito */}
      {viewingNote && (
        <DocumentViewer
          open={!!viewingNote}
          onClose={() => setViewingNote(null)}
          doc={{
            type:                viewingNote.type === 'credit' ? 'credit_note' : 'debit_note',
            number:              viewingNote.note_number,
            issue_date:          viewingNote.issue_date,
            status:              viewingNote.status,
            subtotal:            Number(viewingNote.subtotal),
            tax:                 Number(viewingNote.tax),
            total:               Number(viewingNote.total),
            notes:               viewingNote.notes,
            referenced_invoice:  invoice.invoice_number,
            note_reason:         viewingNote.reason,
            is_tax_responsible:  ivaMode,
            fe_software_id:      company?.fe_software_id ?? null,
            fe_technical_key:    company?.fe_technical_key ?? null,
            fe_test_mode:        company?.fe_test_mode ?? true,
            company: company ? { ...company, dian_resolution: company.dian_resolution ?? null } : null,
            customer: invoice.customer ? {
              name:       invoice.customer.name,
              email:      invoice.customer.email ?? null,
            } : null,
            items: noteItems.map(ni => ({
              product_name: ni.product_name,
              sku:          ni.sku,
              quantity:     Number(ni.quantity),
              unit_price:   Number(ni.unit_price),
              discount:     Number(ni.discount),
              tax_rate:     Number(ni.tax_rate),
              subtotal:     Number(ni.subtotal),
              tax:          Number(ni.tax),
              total:        Number(ni.total),
            })),
          }}
        />
      )}
    </div>
  )
}
