'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Minus, X, Search, AlertCircle, Loader2, FileText, Printer, Receipt, FileCheck, Link2 } from 'lucide-react'
import { useProducts } from '@/modules/products/queries'
import { useCustomers } from '@/modules/customers/queries'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useQuote, useQuoteItems, updateQuoteWithItems, approveQuote, useInvoiceByQuoteId } from '@/modules/sales/queries'
import { DocumentViewer, type DocData } from '@/modules/sales/components/document-viewer'
import { useCompany } from '@/modules/company/queries'
import { CustomerSearch } from '@/components/ui/customer-search'
import type { SaleItemValues } from '@/modules/sales/schemas'

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const TAX_OPTIONS = [
  { label: '0 %',  value: 0 },
  { label: '5 %',  value: 0.05 },
  { label: '19 %', value: 0.19 },
]

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Borrador',  cls: 'bg-zinc-100 text-zinc-600' },
  sent:     { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Aprobada',  cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-600' },
  expired:  { label: 'Caducada',  cls: 'bg-amber-100 text-amber-700' },
}

function recalc(item: SaleItemValues): SaleItemValues {
  const base = item.quantity * item.unit_price * (1 - item.discount / 100)
  const tax  = base * item.tax_rate
  return { ...item, subtotal: base, tax, total: base + tax }
}

const inputCls =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'
const inputRoCls =
  'w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 cursor-default'

// ─── Página ───────────────────────────────────────────────────────────────

export default function EditQuotePage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [initialized, setInitialized] = useState(false)
  const [items, setItems]             = useState<SaleItemValues[]>([])
  const [customerId, setCustomerId]   = useState('')
  const [issueDate, setIssueDate]     = useState('')
  const [expiryDate, setExpiryDate]   = useState('')
  const [notes, setNotes]             = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [showDoc, setShowDoc]         = useState(false)
  const [autoPrint, setAutoPrint]     = useState(false)
  const [search, setSearch]           = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const { data: quote,      isLoading: loadingQuote  } = useQuote(id)
  const { data: quoteItems = [], isLoading: loadingItems } = useQuoteItems(id)
  const { data: products   = [] } = useProducts(activeCompanyId ?? undefined)
  const { data: customers  = [] } = useCustomers(activeCompanyId ?? undefined)
  const { data: company           } = useCompany(activeCompanyId)
  const { data: relatedInvoice    } = useInvoiceByQuoteId(quote?.status === 'approved' ? quote?.id : undefined)

  useEffect(() => {
    if (!initialized && quote && !loadingItems) {
      setCustomerId(quote.customer_id ?? '')
      setIssueDate(quote.issue_date)
      setExpiryDate(quote.expiry_date ?? '')
      setNotes(quote.notes ?? '')
      setItems(quoteItems.map(qi => ({
        product_id:   qi.product_id ?? '',
        product_name: qi.product_name,
        sku:          qi.sku,
        quantity:     Number(qi.quantity),
        unit_price:   Number(qi.unit_price),
        discount:     Number(qi.discount),
        tax_rate:     Number(qi.tax_rate),
        subtotal:     Number(qi.subtotal),
        tax:          Number(qi.tax),
        total:        Number(qi.total),
        stock:        qi.stock,
      })))
      setInitialized(true)
    }
  }, [quote, quoteItems, loadingItems, initialized])

  const editable = quote?.status === 'draft' || quote?.status === 'sent'

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return products
      .filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [products, search])

  const totals = useMemo(() => ({
    subtotal: items.reduce((s, i) => s + i.subtotal, 0),
    tax:      items.reduce((s, i) => s + i.tax,      0),
    total:    items.reduce((s, i) => s + i.total,    0),
  }), [items])

  const addProduct = (product: typeof products[0]) => {
    const idx = items.findIndex(i => i.product_id === product.id)
    if (idx >= 0) {
      updateField(idx, 'quantity', items[idx].quantity + 1)
    } else {
      const price   = Number(product.price)
      const taxRate = product.is_taxable ? (product.tax_rate ?? 0.19) : 0
      setItems(prev => [...prev, {
        product_id: product.id, product_name: product.name, sku: product.sku,
        quantity: 1, unit_price: price, discount: 0, tax_rate: taxRate,
        subtotal: price, tax: price * taxRate, total: price * (1 + taxRate),
        stock: product.stock,
      }])
    }
    setSearch('')
    setShowDropdown(false)
  }

  const updateField = (index: number, field: keyof SaleItemValues, value: number) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = recalc({ ...updated[index], [field]: value })
      return updated
    })
  }

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))

  const mutation = useMutation({
    mutationFn: () => updateQuoteWithItems({
      quote_id:    id,
      customer_id: customerId || null,
      issue_date:  issueDate,
      expiry_date: expiryDate || null,
      notes:       notes || null,
      subtotal:    totals.subtotal,
      tax:         totals.tax,
      total:       totals.total,
      items: items.map(({ product_id, quantity, unit_price, discount, tax_rate, subtotal, tax, total }) => ({
        product_id, quantity, unit_price, discount, tax_rate, subtotal, tax, total,
      })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes',      activeCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['quote',       id] })
      queryClient.invalidateQueries({ queryKey: ['quote_items', id] })
      router.push('/sales')
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSave = () => {
    if (items.length === 0) { setError('Agrega al menos un producto.'); return }
    setError(null)
    mutation.mutate()
  }

  const approveMut = useMutation({
    mutationFn: (documentType: 'invoice' | 'ticket') => approveQuote(id, documentType),
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['quotes',   activeCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompanyId] })
      router.push(`/sales/invoices/${invoiceId}`)
    },
    onError: (e: Error) => setError(e.message),
  })

  // DocData para el visor
  const docData: DocData | null = quote ? {
    type:               'quote',
    is_tax_responsible: company?.fiscal_regime === 'iva' || company?.fiscal_regime === 'gran_contribuyente',
    number:     quote.quote_number,
    issue_date: quote.issue_date,
    expiry_date: quote.expiry_date,
    status:     quote.status,
    subtotal:   initialized ? totals.subtotal : Number(quote.subtotal),
    tax:        initialized ? totals.tax      : Number(quote.tax),
    total:      initialized ? totals.total    : Number(quote.total),
    notes:      quote.notes,
    company:    company ? { ...company, dian_resolution: (company as typeof company & { dian_resolution?: string | null }).dian_resolution ?? null } : null,
    customer:   quote.customer ? {
      name:       quote.customer.name,
      doc_type:   quote.customer.doc_type ?? null,
      doc_number: quote.customer.doc_number ?? null,
      email:      quote.customer.email ?? null,
      phone:      quote.customer.phone ?? null,
      address:    quote.customer.address ?? null,
      city:       quote.customer.city ?? null,
    } : null,
    items: initialized
      ? items.map(i => ({
          product_name: i.product_name, sku: i.sku,
          quantity: i.quantity, unit_price: i.unit_price, discount: i.discount,
          tax_rate: i.tax_rate, subtotal: i.subtotal, tax: i.tax, total: i.total,
        }))
      : quoteItems.map(qi => ({
          product_name: qi.product_name, sku: qi.sku,
          quantity: Number(qi.quantity), unit_price: Number(qi.unit_price), discount: Number(qi.discount),
          tax_rate: Number(qi.tax_rate), subtotal: Number(qi.subtotal), tax: Number(qi.tax), total: Number(qi.total),
        })),
  } : null

  // ── Loading / not found ────────────────────────────────────────────────

  if (loadingQuote) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 text-zinc-400">
        <p className="text-sm">Cotización no encontrada.</p>
        <button onClick={() => router.push('/sales')} className="text-xs text-primary underline">Volver</button>
      </div>
    )
  }

  const statusCfg = STATUS_CFG[quote.status] ?? { label: quote.status, cls: 'bg-zinc-100 text-zinc-600' }

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
            <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase leading-none mb-0.5">Cotización</p>
            <h1 className="text-xl font-semibold text-zinc-900 font-mono leading-none">{quote.quote_number}</h1>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Generar venta — solo si aprobada */}
          {quote?.status === 'approved' && (
            <>
              <button
                onClick={() => approveMut.mutate('ticket')}
                disabled={approveMut.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm">
                {approveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                Ticket POS
              </button>
              <button
                onClick={() => approveMut.mutate('invoice')}
                disabled={approveMut.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                {approveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                Factura Electrónica
              </button>
            </>
          )}
          <button onClick={() => { setAutoPrint(false); setShowDoc(true) }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            <FileText className="h-4 w-4" />
            Ver documento
          </button>
          <button onClick={() => { setAutoPrint(true); setShowDoc(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition-colors">
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* 1b · Documentos relacionados */}
      {relatedInvoice && (
        <div className="flex items-center gap-2 -mt-2">
          <Link2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-xs text-zinc-400">Relacionado:</span>
          <button
            onClick={() => router.push(`/sales/invoices/${relatedInvoice.id}`)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono font-medium text-primary bg-blue-50 hover:bg-blue-100 transition-colors">
            <FileText className="h-3 w-3" />
            {relatedInvoice.invoice_number}
            {relatedInvoice.document_type === 'ticket' && <span className="ml-1 text-[10px] font-sans text-blue-400">· Ticket</span>}
          </button>
        </div>
      )}

      {/* 2 · Encabezado */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Cliente</label>
            <CustomerSearch
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              readOnly={!editable}
            />
            {/* Datos fiscales del cliente seleccionado */}
            {quote.customer && (() => {
              const c = quote.customer!
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
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
              readOnly={!editable} className={editable ? inputCls : inputRoCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha vencimiento</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              readOnly={!editable} className={editable ? inputCls : inputRoCls} />
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
                  {editable ? 'Busca un producto en el campo de abajo para comenzar' : 'Esta cotización no tiene productos'}
                </td>
              </tr>
            )}

            {/* Item rows */}
            {items.map((item, idx) => (
              <tr key={`${item.product_id}-${idx}`} className="hover:bg-zinc-50/50 transition-colors group">
                <td className="px-3 py-2 text-xs text-zinc-400 tabular-nums">{idx + 1}</td>
                <td className="px-3 py-2 text-xs font-mono text-zinc-500">{item.sku ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-medium text-zinc-900">{item.product_name}</td>

                {editable ? (
                  <>
                    {/* Cantidad editable */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => updateField(idx, 'quantity', Math.max(1, item.quantity - 1))}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <input type="number" min={1} value={item.quantity}
                          onChange={e => updateField(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="w-12 rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs text-center text-zinc-900 focus:border-blue-400 focus:outline-none" />
                        <button onClick={() => updateField(idx, 'quantity', item.quantity + 1)}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    {/* Precio */}
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={item.unit_price}
                        onChange={e => updateField(idx, 'unit_price', Number(e.target.value))}
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-right text-zinc-900 focus:border-blue-400 focus:outline-none" />
                    </td>
                    {/* Descuento */}
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} value={item.discount}
                        onChange={e => updateField(idx, 'discount', Number(e.target.value))}
                        className="w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs text-center text-zinc-900 focus:border-blue-400 focus:outline-none" />
                    </td>
                    {/* IVA */}
                    <td className="px-2 py-1.5">
                      <select value={item.tax_rate}
                        onChange={e => updateField(idx, 'tax_rate', Number(e.target.value))}
                        className="w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs text-zinc-700 focus:border-blue-400 focus:outline-none">
                        {TAX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-2 text-center text-sm text-zinc-700">{item.quantity}</td>
                    <td className="px-2 py-2 text-right text-sm text-zinc-700">{fmt(item.unit_price)}</td>
                    <td className="px-2 py-2 text-center text-sm text-zinc-500">{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                    <td className="px-2 py-2 text-center text-xs text-zinc-500">{(item.tax_rate * 100).toFixed(0)}%</td>
                  </>
                )}

                {/* Total */}
                <td className="px-3 py-2 text-right text-sm font-semibold text-zinc-900">{fmt(item.total)}</td>
                {/* Eliminar */}
                <td className="px-2 py-1.5 text-center">
                  {editable && (
                    <button onClick={() => removeItem(idx)}
                      className="rounded p-1 text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Fila de búsqueda — solo si editable */}
            {editable && (
              <tr className="border-t-2 border-dashed border-zinc-200 bg-zinc-50/30">
                <td colSpan={9} className="relative p-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      placeholder="Buscar producto por nombre o referencia para agregar..."
                      className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors"
                    />
                  </div>
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute left-2 right-2 top-full mt-0.5 z-30 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {searchResults.map(product => {
                        const outOfStock = product.stock === 0
                        return (
                          <button key={product.id}
                            onMouseDown={() => { if (!outOfStock) addProduct(product) }}
                            disabled={outOfStock}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${outOfStock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-50'}`}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-zinc-900 truncate">{product.name}</p>
                              {product.sku && <p className="text-xs font-mono text-zinc-400">{product.sku}</p>}
                            </div>
                            <div className="flex items-center gap-2 ml-3 shrink-0">
                              <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
                                product.stock === 0 ? 'bg-red-100 text-red-600'
                                : product.stock < 10 ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'}`}>{product.stock}</span>
                              <span className="text-sm font-semibold text-zinc-700">{fmt(Number(product.price))}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* 4 · Notas + Totales */}
      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Notas / condiciones comerciales</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={4} placeholder="Condiciones de pago, vigencia, observaciones..."
            readOnly={!editable} className={`${editable ? inputCls : inputRoCls} resize-none`} />
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
          {editable ? 'Cancelar' : 'Volver'}
        </button>
        {editable && (
          <button onClick={handleSave} disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </button>
        )}
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
    </div>
  )
}
