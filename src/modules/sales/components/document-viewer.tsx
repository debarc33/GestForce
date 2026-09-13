'use client'

import { useRef, useState, useEffect } from 'react'
import { Printer, Mail, X, FileCode2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { calculateCUFE, getColombiaTime } from '@/lib/fe/cufe'
import { generateXMLUBL21, downloadXML } from '@/lib/fe/xml-ubl21'

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

const TAX_LABELS: Record<number, string> = { 0: '0%', 0.05: '5%', 0.19: '19%' }

export interface DocCompany {
  name: string
  nit?: string | null
  legal_name?: string | null
  address?: string | null
  city?: string | null
  department?: string | null
  phone?: string | null
  email?: string | null
  fiscal_regime?: string | null
  // DIAN
  dian_resolution?: string | null
  dian_resolution_date?: string | null
  dian_prefix?: string | null
  dian_from_number?: number | null
  dian_to_number?: number | null
  dian_validity_to?: string | null
  // Formatos de impresión
  logo_url?: string | null
  invoice_footer?: string | null
  print_paper_size?: string | null
  print_show_logo?: boolean | null
  print_auto_dian_footer?: boolean | null
  print_legal_lines?: string | null
}

export interface DocCustomer {
  name: string
  doc_type?: string | null
  doc_number?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
}

export interface DocItem {
  product_name: string
  sku?: string | null
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  subtotal: number
  tax: number
  total: number
}

export interface DocData {
  type: 'quote' | 'invoice' | 'credit_note' | 'debit_note'
  document_type?: 'invoice' | 'ticket'
  is_tax_responsible?: boolean
  number: string
  issue_date: string
  expiry_date?: string | null
  due_date?: string | null
  status: string
  subtotal: number
  tax: number
  total: number
  notes?: string | null
  company?: DocCompany | null
  customer?: DocCustomer | null
  items: DocItem[]
  /** Solo para NC/ND: número de factura referenciada */
  referenced_invoice?: string | null
  /** Solo para NC/ND: razón */
  note_reason?: string | null
  /** Credenciales FE — para mostrar botón XML */
  fe_software_id?: string | null
  fe_technical_key?: string | null
  fe_test_mode?: boolean
}

interface Props {
  open:       boolean
  onClose:    () => void
  doc:        DocData
  autoPrint?: boolean
}

export function DocumentViewer({ open, onClose, doc, autoPrint }: Props) {
  const printRef  = useRef<HTMLDivElement>(null)
  const [xmlBusy, setXmlBusy] = useState(false)

  const companyName = doc.company?.name ?? 'GestForce'
  const isTicket    = doc.document_type === 'ticket'
  const isTaxResp   = doc.is_tax_responsible ?? true
  const isNote      = doc.type === 'credit_note' || doc.type === 'debit_note'
  const canExportXml = (doc.type === 'invoice' || isNote) && !isTicket
    && !!(doc.fe_software_id && doc.fe_technical_key)

  const docTypeLabel =
    doc.type === 'quote'       ? 'COTIZACIÓN' :
    doc.type === 'credit_note' ? 'NOTA CRÉDITO' :
    doc.type === 'debit_note'  ? 'NOTA DÉBITO' :
    isTicket                   ? 'TICKET POS' :
                                 'FACTURA DE VENTA'

  const barColor =
    doc.type === 'credit_note' ? 'bg-orange-600' :
    doc.type === 'debit_note'  ? 'bg-primary' :
                                 'bg-primary'

  const STATUS_ES: Record<string, string> = {
    draft: 'BORRADOR', sent: 'ENVIADA', approved: 'APROBADA',
    rejected: 'RECHAZADA', expired: 'CADUCADA',
    issued: 'EMITIDA', cancelled: 'ANULADA',
  }

  const REGIME_LABELS: Record<string, string> = {
    iva: 'Responsable de IVA',
    no_iva: 'No Responsable de IVA',
    gran_contribuyente: 'Gran Contribuyente',
  }

  // Modo impresión directa: monta contenido oculto, captura HTML, imprime, cierra
  // El usuario nunca ve el visor — solo aparece el diálogo del sistema
  useEffect(() => {
    if (!open || !autoPrint) return
    const t = setTimeout(() => {
      handlePrint()
      onClose()
    }, 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoPrint])

  const handlePrint = () => {
    const content   = printRef.current?.innerHTML ?? ''
    const paperSize = doc.company?.print_paper_size ?? 'carta'

    if (isTicket || paperSize === 'tiquete_80mm') {
      const win = window.open('', '_blank', 'width=380,height=600')
      if (!win) return
      win.document.write(`
        <!DOCTYPE html><html><head>
          <meta charset="utf-8"/>
          <title>${doc.number}</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: monospace, 'Courier New', Courier; font-size: 11px; color: #000; width: 76mm; }
            .center { text-align: center; }
            .right  { text-align: right; }
            .bold   { font-weight: bold; }
            .sep    { border-top: 1px dashed #000; margin: 4px 0; }
            table   { width: 100%; border-collapse: collapse; font-size: 10px; }
            td      { padding: 1px 2px; vertical-align: top; }
            .td-r   { text-align: right; white-space: nowrap; }
            img     { max-width: 100%; height: auto; }
          </style>
        </head><body>${content}</body></html>
      `)
      win.document.close(); win.focus(); win.print(); win.close()
    } else {
      const pageSize  = paperSize === 'media_carta' ? '216mm 139.7mm' : '216mm 279mm'
      const winH      = paperSize === 'media_carta' ? 560 : 700
      const win = window.open('', '_blank', `width=900,height=${winH}`)
      if (!win) return
      win.document.write(`
        <!DOCTYPE html><html><head>
          <meta charset="utf-8"/>
          <title>${doc.number}</title>
          <style>
            @page { size: ${pageSize}; margin: 12mm 16mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, sans-serif; font-size: 12px; color: #111; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f4f4f5; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
            td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
            .right { text-align: right; }
            .bold { font-weight: 600; }
            .muted { color: #888; font-size: 11px; }
            .title-bar { background: #1d4ed8; color: white; padding: 10px 16px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
            .title-bar-label { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.85; }
            .title-bar-num { font-family: monospace; font-size: 18px; font-weight: 700; }
            img { max-width: 100%; height: auto; }
          </style>
        </head><body>${content}</body></html>
      `)
      win.document.close(); win.focus(); win.print(); win.close()
    }
  }

  const handleDownloadXML = async () => {
    if (!doc.fe_technical_key || !doc.fe_software_id) return
    setXmlBusy(true)
    try {
      const tipAmb = doc.fe_test_mode === false ? '1' : '2'
      const nitOFE = (doc.company?.nit ?? '').replace(/[^0-9]/g, '')
      const numAdq = (doc.customer?.doc_number ?? '222222222222').replace(/[^0-9]/g, '')
      const horFac = getColombiaTime()

      const cufe = await calculateCUFE({
        numFac:   doc.number,
        fecFac:   doc.issue_date,
        horFac,
        valFac:   doc.subtotal,
        valImp1:  doc.tax,
        valTot:   doc.total,
        nitOFE,
        numAdq,
        clTec:    doc.fe_technical_key,
        tipAmb,
      })

      const invoiceTypeCode =
        doc.type === 'credit_note' ? '91' :
        doc.type === 'debit_note'  ? '92' : '01'

      const xml = generateXMLUBL21({
        invoiceNumber:    doc.number,
        cufe,
        issueDate:        doc.issue_date,
        issueTime:        horFac,
        dueDate:          doc.due_date,
        tipAmb,
        softwareId:       doc.fe_software_id,
        invoiceTypeCode,
        referencedInvoice: doc.referenced_invoice,
        company: {
          ...doc.company!,
          nit:       doc.company?.nit ?? '',
          ciiu_code: (doc.company as DocCompany & { ciiu_code?: string | null })?.ciiu_code,
        },
        customer: {
          ...doc.customer!,
          name: doc.customer?.name ?? 'Consumidor Final',
        },
        items:     doc.items,
        subtotal:  doc.subtotal,
        taxTotal:  doc.tax,
        total:     doc.total,
        notes:     doc.notes,
      })

      downloadXML(xml, doc.number.replace(/[^a-zA-Z0-9-]/g, '_'))
    } catch (e) {
      console.error('Error generando XML:', e)
    } finally {
      setXmlBusy(false)
    }
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(
      doc.type === 'quote'
        ? `Cotización ${doc.number} — ${companyName}`
        : `Factura ${doc.number} — ${companyName}`
    )
    const body = encodeURIComponent(
      `Estimado/a ${doc.customer?.name ?? 'cliente'},\n\n` +
      (doc.type === 'quote'
        ? `Adjuntamos la cotización ${doc.number} por valor de ${fmt(doc.total)}.\n\nEsta cotización es válida ${doc.expiry_date ? `hasta el ${fmtDate(doc.expiry_date)}` : 'por 30 días'}.\n\n`
        : `Adjuntamos la factura ${doc.number} por valor de ${fmt(doc.total)}.\n\n`) +
      `Quedo atento/a a cualquier consulta.\n\nSaludos cordiales,\n${companyName}`
    )
    window.open(`mailto:${doc.customer?.email ?? ''}?subject=${subject}&body=${body}`)
  }

  // ── Ticket POS (58mm) ───────────────────────────────────────────────────
  const TicketContent = () => (
    <div style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%' }}>
      <div className="text-center">
        <p className="font-bold text-sm">{companyName}</p>
        {doc.company?.legal_name && doc.company.legal_name !== doc.company.name && (
          <p className="text-[10px]">{doc.company.legal_name}</p>
        )}
        {doc.company?.nit && <p className="text-[10px]">NIT: {doc.company.nit}</p>}
        {(doc.company?.address || doc.company?.city) && (
          <p className="text-[10px]">{[doc.company.address, doc.company.city].filter(Boolean).join(', ')}</p>
        )}
        {doc.company?.phone && <p className="text-[10px]">Tel: {doc.company.phone}</p>}
      </div>
      <div className="border-t border-dashed border-zinc-600 my-1.5" />
      <div className="text-center text-[10px]">
        <p className="font-bold text-xs">TICKET POS</p>
        <p className="font-bold">{doc.number}</p>
        <p>{fmtDate(doc.issue_date)}</p>
        <p>{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      {doc.customer && (
        <>
          <div className="border-t border-dashed border-zinc-600 my-1.5" />
          <div className="text-[10px]">
            <p><span className="font-bold">Cliente:</span> {doc.customer.name}</p>
            {(doc.customer.doc_type && doc.customer.doc_number) && (
              <p>{doc.customer.doc_type}: {doc.customer.doc_number}</p>
            )}
          </div>
        </>
      )}
      <div className="border-t border-dashed border-zinc-600 my-1.5" />
      <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="text-left font-semibold pb-0.5">Descripción</th>
            <th className="text-center font-semibold pb-0.5 w-8">Cant</th>
            {isTaxResp && <th className="text-right font-semibold pb-0.5 w-12">IVA</th>}
            <th className="text-right font-semibold pb-0.5 w-14">Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, i) => (
            <tr key={i}>
              <td className="align-top pb-0.5">
                <p className="leading-tight">{item.product_name}</p>
                <p className="text-zinc-500">{fmt(item.unit_price)}{item.discount > 0 ? ` -${item.discount}%` : ''}</p>
              </td>
              <td className="text-center align-top pb-0.5">{item.quantity}</td>
              {isTaxResp && <td className="text-right align-top pb-0.5">{fmt(item.tax)}</td>}
              <td className="text-right align-top font-semibold pb-0.5">{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-zinc-600 my-1.5" />
      <div className="text-[10px] space-y-0.5">
        {isTaxResp && (
          <>
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(doc.subtotal)}</span></div>
            <div className="flex justify-between"><span>IVA</span><span>{fmt(doc.tax)}</span></div>
          </>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-dashed border-zinc-600 pt-1 mt-1">
          <span>TOTAL</span><span>{fmt(doc.total)}</span>
        </div>
      </div>
      {doc.notes && (
        <>
          <div className="border-t border-dashed border-zinc-600 my-1.5" />
          <p className="text-[10px] text-zinc-600">{doc.notes}</p>
        </>
      )}
      <div className="border-t border-dashed border-zinc-600 my-1.5" />
      <p className="text-center text-[10px] text-zinc-500">¡Gracias por su compra!</p>
    </div>
  )

  // ── FE / Cotización ─────────────────────────────────────────────────────
  const DocContent = () => (
    <div>
      {/* ── Barra de título resaltada ── */}
      <div className={`${barColor} px-5 py-3 flex items-center justify-between`}>
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">{docTypeLabel}</p>
          <p className="text-xl font-bold font-mono text-white mt-0.5">{doc.number}</p>
          {doc.referenced_invoice && (
            <p className="text-[10px] text-white/60 mt-0.5">
              Ref. factura: <span className="font-mono">{doc.referenced_invoice}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider border border-white/30 text-white bg-white/15">
            {STATUS_ES[doc.status] ?? doc.status}
          </div>
          <p className="text-xs text-blue-200 mt-1">{fmtDate(doc.issue_date)}</p>
        </div>
      </div>

      {/* ── Cuerpo del documento ── */}
      <div className="p-5 space-y-4">

        {/* Empresa + Cliente en 2 columnas */}
        <div className="grid grid-cols-2 gap-4">
          {/* Empresa */}
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Emisor</p>
            {/* Logo */}
            {doc.company?.print_show_logo !== false && doc.company?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.company.logo_url}
                alt={companyName}
                className="mb-2 object-contain"
                style={{ maxHeight: '48px', maxWidth: '140px' }}
              />
            )}
            <p className="font-bold text-zinc-900">{companyName}</p>
            {doc.company?.legal_name && doc.company.legal_name !== doc.company.name && (
              <p className="text-xs text-zinc-500">{doc.company.legal_name}</p>
            )}
            {doc.company?.nit && <p className="text-xs text-zinc-500">NIT: {doc.company.nit}</p>}
            {(doc.company?.address || doc.company?.city) && (
              <p className="text-xs text-zinc-400">
                {[doc.company.address, doc.company.city, doc.company.department].filter(Boolean).join(', ')}
              </p>
            )}
            {doc.company?.phone && <p className="text-xs text-zinc-400">Tel: {doc.company.phone}</p>}
            {doc.company?.email && <p className="text-xs text-zinc-400">{doc.company.email}</p>}
            {doc.company?.fiscal_regime && (
              <p className="text-xs text-zinc-400 mt-0.5 italic">
                {REGIME_LABELS[doc.company.fiscal_regime] ?? doc.company.fiscal_regime}
              </p>
            )}
          </div>

          {/* Cliente + Fechas */}
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Cliente</p>
            {doc.customer ? (
              <>
                <p className="font-bold text-zinc-900">{doc.customer.name}</p>
                {(doc.customer.doc_type && doc.customer.doc_number) && (
                  <p className="text-xs text-zinc-500">{doc.customer.doc_type} {doc.customer.doc_number}</p>
                )}
                {doc.customer.email && <p className="text-xs text-zinc-500">{doc.customer.email}</p>}
                {doc.customer.phone && <p className="text-xs text-zinc-400">{doc.customer.phone}</p>}
                {(doc.customer.address || doc.customer.city) && (
                  <p className="text-xs text-zinc-400">
                    {[doc.customer.address, doc.customer.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-zinc-400 italic text-sm">Sin cliente</p>
            )}
            <div className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2">
              {doc.expiry_date && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Válida hasta</span>
                  <span className="font-medium text-zinc-700">{fmtDate(doc.expiry_date)}</span>
                </div>
              )}
              {doc.due_date && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Vence</span>
                  <span className="font-medium text-zinc-700">{fmtDate(doc.due_date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Producto</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-14">Cant.</th>
                <th className="text-right px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-24">P. Unit.</th>
                <th className="text-right px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-16">Desc.</th>
                {isTaxResp && (
                  <th className="text-right px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-14">IVA</th>
                )}
                <th className="text-right px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {doc.items.map((item, i) => (
                <tr key={i} className="hover:bg-zinc-50/50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-900 text-sm">{item.product_name}</p>
                    {item.sku && <p className="text-[10px] font-mono text-zinc-400">{item.sku}</p>}
                  </td>
                  <td className="px-2 py-2 text-center text-zinc-700">{item.quantity}</td>
                  <td className="px-2 py-2 text-right text-zinc-700 text-xs">{fmt(item.unit_price)}</td>
                  <td className="px-2 py-2 text-right text-zinc-500 text-xs">{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                  {isTaxResp && (
                    <td className="px-2 py-2 text-right text-zinc-500 text-xs">
                      {TAX_LABELS[item.tax_rate] ?? `${(item.tax_rate * 100).toFixed(0)}%`}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-semibold text-zinc-900">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals + Notes en 2 columnas */}
        <div className="flex gap-4 items-start">
          {/* Notas */}
          <div className="flex-1">
            {doc.notes && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2.5 h-full">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Notas / Condiciones</p>
                <p className="text-xs text-zinc-600">{doc.notes}</p>
              </div>
            )}
          </div>
          {/* Totales */}
          <div className="w-56 shrink-0 rounded-lg border border-zinc-200 overflow-hidden">
            {isTaxResp && (
              <>
                <div className="flex justify-between px-3 py-2 text-xs text-zinc-500 border-b border-zinc-100">
                  <span>Subtotal</span><span>{fmt(doc.subtotal)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 text-xs text-zinc-500 border-b border-zinc-100">
                  <span>IVA</span><span>{fmt(doc.tax)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between px-3 py-2.5 font-bold text-zinc-900 bg-blue-50 border-t border-blue-100">
              <span>TOTAL</span><span className="text-blue-700">{fmt(doc.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer legal */}
        <div className="border-t border-zinc-100 pt-3 space-y-1">
          {/* Resolución DIAN (auto-generada) */}
          {doc.type === 'invoice' && doc.company?.dian_resolution &&
           doc.company?.print_auto_dian_footer !== false && (
            <p className="text-[10px] text-zinc-500 font-medium text-center leading-relaxed">
              {'Resolución de Facturación DIAN No. ' + doc.company.dian_resolution}
              {doc.company.dian_resolution_date
                ? ' del ' + fmtDate(doc.company.dian_resolution_date)
                : ''}
              {doc.company.dian_prefix && doc.company.dian_from_number && doc.company.dian_to_number
                ? `, autoriza del ${doc.company.dian_prefix}${doc.company.dian_from_number} al ${doc.company.dian_prefix}${doc.company.dian_to_number}`
                : ''}
              {doc.company.dian_validity_to
                ? '. Vigente hasta ' + fmtDate(doc.company.dian_validity_to)
                : '.'}
            </p>
          )}
          {/* No responsable de IVA */}
          {doc.type === 'invoice' && !isTaxResp && (
            <p className="text-[10px] text-zinc-500 italic text-center">
              No somos responsables de IVA — Régimen No Responsable
            </p>
          )}
          {/* Líneas legales configuradas */}
          {doc.company?.print_legal_lines &&
           doc.company.print_legal_lines.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-[10px] text-zinc-500 text-center">{line.trim()}</p>
          ))}
          {/* Pie de página (datos bancarios, etc.) */}
          {doc.company?.invoice_footer && (
            <div className="mt-1.5 pt-2 border-t border-zinc-100">
              <p className="text-[10px] text-zinc-600 text-center leading-relaxed whitespace-pre-line">
                {doc.company.invoice_footer}
              </p>
            </div>
          )}
          <p className="text-[10px] text-zinc-400 text-center mt-1">
            Documento generado por {companyName} · {new Date().toLocaleDateString('es-CO')}
          </p>
        </div>
      </div>
    </div>
  )

  // Modo impresión directa: div invisible fuera de pantalla (sin Dialog)
  if (open && autoPrint) {
    return (
      <div
        aria-hidden="true"
        style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm', pointerEvents: 'none', overflow: 'hidden' }}
      >
        <div ref={printRef}>
          {isTicket ? <div className="p-6"><TicketContent /></div> : <DocContent />}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-2 border-blue-100">
        <DialogTitle className="sr-only">{docTypeLabel}</DialogTitle>
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-white rounded-t-2xl">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{docTypeLabel}</span>
          <div className="flex items-center gap-1.5">
            {doc.customer?.email && (
              <button onClick={handleEmail}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-blue-50 transition-colors border border-blue-200">
                <Mail className="h-3.5 w-3.5" />
                Enviar al correo
              </button>
            )}
            {canExportXml && (
              <button onClick={handleDownloadXML} disabled={xmlBusy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors border border-green-300 disabled:opacity-40">
                <FileCode2 className="h-3.5 w-3.5" />
                {xmlBusy ? 'Generando...' : 'XML DIAN'}
              </button>
            )}
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">
              <Printer className="h-3.5 w-3.5" />
              {isTicket ? 'Imprimir ticket' : 'Imprimir / PDF'}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Document */}
        <div ref={printRef} className="bg-white overflow-hidden">
          {isTicket
            ? <div className="p-6"><TicketContent /></div>
            : <DocContent />
          }
        </div>
      </DialogContent>
    </Dialog>
  )
}
