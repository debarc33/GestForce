import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const fmt = (n: number) => '$' + Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : ''

const TAX_LABELS: Record<number, string> = { 0: '0%', 0.05: '5%', 0.19: '19%' }
const REGIME_LABELS: Record<string, string> = {
  iva: 'Responsable de IVA',
  no_iva: 'No Responsable de IVA',
  gran_contribuyente: 'Gran Contribuyente',
}
const STATUS_ES: Record<string, string> = {
  draft: 'BORRADOR', sent: 'ENVIADA', approved: 'APROBADA',
  rejected: 'RECHAZADA', expired: 'CADUCADA',
  issued: 'EMITIDA', cancelled: 'ANULADA',
}

export interface PdfCompany {
  name: string
  nit?: string | null
  legal_name?: string | null
  address?: string | null
  city?: string | null
  department?: string | null
  phone?: string | null
  email?: string | null
  fiscal_regime?: string | null
  dian_resolution?: string | null
  dian_resolution_date?: string | null
  dian_prefix?: string | null
  dian_from_number?: number | null
  dian_to_number?: number | null
  dian_validity_to?: string | null
  invoice_footer?: string | null
  print_legal_lines?: string | null
}

export interface PdfCustomer {
  name: string
  doc_type?: string | null
  doc_number?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
}

export interface PdfItem {
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

export interface PdfDocData {
  type: 'quote' | 'invoice' | 'credit_note' | 'debit_note'
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
  company?: PdfCompany | null
  customer?: PdfCustomer | null
  items: PdfItem[]
}

// NOTA: estilos con StyleSheet.create de @react-pdf/renderer -- es un motor
// de layout propio (parecido a React Native), no HTML/CSS real. Por eso no
// se reusan las clases de Tailwind del visor en pantalla; este documento
// define su propio diseño, pensado para verse ordenado y legible como PDF
// adjunto al correo (a diferencia del PDF por "Imprimir", que sí reusa los
// estilos reales de la app -- ver el fix de handlePrint en document-viewer.tsx).
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#18181b' },
  titleBar: {
    backgroundColor: '#1d4ed8', color: '#ffffff', paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 4,
  },
  titleLabel: { fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },
  titleNumber: { fontSize: 15, fontWeight: 700, fontFamily: 'Courier', marginTop: 2 },
  statusBadge: {
    fontSize: 7, fontWeight: 700, borderWidth: 1, borderColor: '#ffffffaa',
    borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'flex-end',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  col: { width: '48%' },
  sectionLabel: { fontSize: 7, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  bold: { fontWeight: 700, color: '#18181b' },
  muted: { color: '#71717a', fontSize: 8, marginTop: 1 },
  table: { marginTop: 16, borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  th: { fontSize: 7, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', padding: 6 },
  td: { fontSize: 8, padding: 6, color: '#27272a' },
  colProduct: { width: '38%' },
  colQty: { width: '10%', textAlign: 'center' },
  colPrice: { width: '15%', textAlign: 'right' },
  colDisc: { width: '10%', textAlign: 'right' },
  colTax: { width: '10%', textAlign: 'right' },
  colTotal: { width: '17%', textAlign: 'right' },
  totalsBox: { width: 200, marginLeft: 'auto', marginTop: 12, borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 4, overflow: 'hidden' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 6, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', fontSize: 8, color: '#52525b' },
  totalsFinal: { flexDirection: 'row', justifyContent: 'space-between', padding: 7, backgroundColor: '#eff6ff', fontSize: 10, fontWeight: 700 },
  notesBox: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 4, padding: 8, marginTop: 12 },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f4f4f5' },
  footerLine: { fontSize: 7, color: '#71717a', textAlign: 'center', marginBottom: 2 },
})

export function DocumentPdf({ doc }: { doc: PdfDocData }) {
  const company = doc.company
  const customer = doc.customer
  const isTaxResp = doc.is_tax_responsible ?? true
  const docTypeLabel =
    doc.type === 'quote' ? 'COTIZACIÓN' :
    doc.type === 'credit_note' ? 'NOTA CRÉDITO' :
    doc.type === 'debit_note' ? 'NOTA DÉBITO' : 'FACTURA DE VENTA'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleBar}>
          <View>
            <Text style={styles.titleLabel}>{docTypeLabel}</Text>
            <Text style={styles.titleNumber}>{doc.number}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.statusBadge}>{STATUS_ES[doc.status] ?? doc.status}</Text>
            <Text style={{ fontSize: 8, marginTop: 4 }}>{fmtDate(doc.issue_date)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Emisor</Text>
            <Text style={styles.bold}>{company?.name ?? 'GestForce'}</Text>
            {!!company?.legal_name && company.legal_name !== company.name && (
              <Text style={styles.muted}>{company.legal_name}</Text>
            )}
            {!!company?.nit && <Text style={styles.muted}>NIT: {company.nit}</Text>}
            {(!!company?.address || !!company?.city) && (
              <Text style={styles.muted}>{[company?.address, company?.city, company?.department].filter(Boolean).join(', ')}</Text>
            )}
            {!!company?.phone && <Text style={styles.muted}>Tel: {company.phone}</Text>}
            {!!company?.email && <Text style={styles.muted}>{company.email}</Text>}
            {!!company?.fiscal_regime && (
              <Text style={[styles.muted, { fontStyle: 'italic' }]}>{REGIME_LABELS[company.fiscal_regime] ?? company.fiscal_regime}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Cliente</Text>
            {customer ? (
              <>
                <Text style={styles.bold}>{customer.name}</Text>
                {!!customer.doc_type && !!customer.doc_number && (
                  <Text style={styles.muted}>{customer.doc_type} {customer.doc_number}</Text>
                )}
                {!!customer.email && <Text style={styles.muted}>{customer.email}</Text>}
                {!!customer.phone && <Text style={styles.muted}>{customer.phone}</Text>}
                {(!!customer.address || !!customer.city) && (
                  <Text style={styles.muted}>{[customer.address, customer.city].filter(Boolean).join(', ')}</Text>
                )}
              </>
            ) : (
              <Text style={[styles.muted, { fontStyle: 'italic' }]}>Sin cliente</Text>
            )}
            {!!doc.expiry_date && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={styles.muted}>Válida hasta</Text>
                <Text style={{ fontSize: 8, fontWeight: 700 }}>{fmtDate(doc.expiry_date)}</Text>
              </View>
            )}
            {!!doc.due_date && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={styles.muted}>Vence</Text>
                <Text style={{ fontSize: 8, fontWeight: 700 }}>{fmtDate(doc.due_date)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colProduct]}>Producto</Text>
            <Text style={[styles.th, styles.colQty]}>Cant.</Text>
            <Text style={[styles.th, styles.colPrice]}>P. Unit.</Text>
            <Text style={[styles.th, styles.colDisc]}>Desc.</Text>
            {isTaxResp && <Text style={[styles.th, styles.colTax]}>IVA</Text>}
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {doc.items.map((item, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <View style={styles.colProduct}>
                <Text style={styles.td}>{item.product_name}</Text>
                {!!item.sku && <Text style={[styles.td, { fontSize: 6, color: '#a1a1aa', paddingTop: 0 }]}>{item.sku}</Text>}
              </View>
              <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>{fmt(item.unit_price)}</Text>
              <Text style={[styles.td, styles.colDisc]}>{item.discount > 0 ? `${item.discount}%` : '—'}</Text>
              {isTaxResp && (
                <Text style={[styles.td, styles.colTax]}>{TAX_LABELS[item.tax_rate] ?? `${(item.tax_rate * 100).toFixed(0)}%`}</Text>
              )}
              <Text style={[styles.td, styles.colTotal, { fontWeight: 700 }]}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          {isTaxResp && (
            <>
              <View style={styles.totalsRow}><Text>Subtotal</Text><Text>{fmt(doc.subtotal)}</Text></View>
              <View style={styles.totalsRow}><Text>IVA</Text><Text>{fmt(doc.tax)}</Text></View>
            </>
          )}
          <View style={styles.totalsFinal}><Text>TOTAL</Text><Text>{fmt(doc.total)}</Text></View>
        </View>

        {!!doc.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.sectionLabel}>Notas / Condiciones</Text>
            <Text style={{ fontSize: 8, color: '#52525b' }}>{doc.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          {doc.type === 'invoice' && !!company?.dian_resolution && (
            <Text style={styles.footerLine}>
              {'Resolución de Facturación DIAN No. ' + company.dian_resolution}
              {company.dian_resolution_date ? ' del ' + fmtDate(company.dian_resolution_date) : ''}
              {company.dian_prefix && company.dian_from_number && company.dian_to_number
                ? `, autoriza del ${company.dian_prefix}${company.dian_from_number} al ${company.dian_prefix}${company.dian_to_number}`
                : ''}
              {company.dian_validity_to ? '. Vigente hasta ' + fmtDate(company.dian_validity_to) : '.'}
            </Text>
          )}
          {doc.type === 'invoice' && !isTaxResp && (
            <Text style={[styles.footerLine, { fontStyle: 'italic' }]}>No somos responsables de IVA — Régimen No Responsable</Text>
          )}
          {!!company?.print_legal_lines && company.print_legal_lines.split('\n').filter(l => l.trim()).map((line, i) => (
            <Text key={i} style={styles.footerLine}>{line.trim()}</Text>
          ))}
          {!!company?.invoice_footer && (
            <Text style={[styles.footerLine, { marginTop: 4 }]}>{company.invoice_footer}</Text>
          )}
          <Text style={[styles.footerLine, { marginTop: 4, color: '#a1a1aa' }]}>
            Documento generado por {company?.name ?? 'GestForce'} · {new Date().toLocaleDateString('es-CO')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
