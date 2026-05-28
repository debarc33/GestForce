/**
 * Generador de XML UBL 2.1 para Facturación Electrónica DIAN Colombia
 * Según Anexo Técnico DIAN versión 1.9 — Esquema UBL 2.1
 *
 * Genera el XML base (sin firma digital) listo para enviar al PT o descargar.
 * La firma digital (XAdES-BES) la aplica el Proveedor Tecnológico.
 */

import type { DocCompany, DocCustomer, DocItem } from '@/modules/sales/components/document-viewer'

export interface XMLInvoiceParams {
  invoiceNumber: string
  cufe:          string
  issueDate:     string   // YYYY-MM-DD
  issueTime:     string   // HH:mm:ss-05:00
  dueDate?:      string | null
  tipAmb:        '1' | '2'   // 1=producción, 2=habilitación
  softwareId:    string
  /** 01=Factura Venta, 91=Nota Crédito, 92=Nota Débito */
  invoiceTypeCode: '01' | '91' | '92'
  /** Número de factura referenciada (para NC/ND) */
  referencedInvoice?: string | null
  /** CUFE de la factura referenciada */
  referencedCUFE?:    string | null
  company:   DocCompany & { nit: string; ciiu_code?: string | null; dian_prefix?: string | null }
  customer:  DocCustomer & { doc_number?: string | null; doc_type?: string | null }
  items:     DocItem[]
  subtotal:  number
  taxTotal:  number
  total:     number
  notes?:    string | null
}

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmt2 = (n: number) => n.toFixed(2)
const fmt6 = (n: number) => n.toFixed(6)

/** Mapa tipo documento DIAN */
const DOC_TYPE_MAP: Record<string, { code: string; name: string }> = {
  CC:  { code: '13', name: 'Cédula de ciudadanía' },
  NIT: { code: '31', name: 'NIT' },
  CE:  { code: '22', name: 'Cédula de extranjería' },
  PA:  { code: '41', name: 'Pasaporte' },
  TI:  { code: '12', name: 'Tarjeta de identidad' },
}

export function generateXMLUBL21(p: XMLInvoiceParams): string {
  const nitOFE   = (p.company.nit ?? '').replace(/[^0-9]/g, '')
  const numAdq   = (p.customer.doc_number ?? '222222222222').replace(/[^0-9]/g, '')
  const docType  = DOC_TYPE_MAP[p.customer.doc_type ?? 'CC'] ?? { code: '13', name: 'Cédula de ciudadanía' }
  const isFinal  = !p.customer.doc_number  // consumidor final

  // Calcular IVA por tasa para TaxSubtotal
  const taxByRate = p.items.reduce<Record<number, { base: number; tax: number }>>((acc, item) => {
    const rate = item.tax_rate
    if (!acc[rate]) acc[rate] = { base: 0, tax: 0 }
    acc[rate].base += item.subtotal
    acc[rate].tax  += item.tax
    return acc
  }, {})

  const taxSubtotals = Object.entries(taxByRate).map(([rate, { base, tax }]) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="COP">${fmt2(base)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="COP">${fmt2(tax)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${(Number(rate) * 100).toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>01</cbc:ID>
            <cbc:Name>IVA</cbc:Name>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`).join('')

  const invoiceLines = p.items.map((item, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="NAL">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${fmt2(item.subtotal)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${fmt2(item.tax)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="COP">${fmt2(item.subtotal)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="COP">${fmt2(item.tax)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>${(item.tax_rate * 100).toFixed(2)}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>01</cbc:ID>
              <cbc:Name>IVA</cbc:Name>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${esc(item.product_name)}</cbc:Description>
        ${item.sku ? `<cac:SellersItemIdentification><cbc:ID>${esc(item.sku)}</cbc:ID></cac:SellersItemIdentification>` : ''}
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="COP">${fmt6(item.unit_price)}</cbc:PriceAmount>
        <cbc:BaseQuantity unitCode="NAL">1</cbc:BaseQuantity>
      </cac:Price>
    </cac:InvoiceLine>`).join('')

  const billingReference = p.referencedInvoice ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(p.referencedInvoice)}</cbc:ID>
      ${p.referencedCUFE ? `<cbc:UUID schemeName="CUFE-SHA384">${p.referencedCUFE}</cbc:UUID>` : ''}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''

  const rootTag    = p.invoiceTypeCode === '01' ? 'Invoice' : 'CreditNote'
  const nsInvoice  = p.invoiceTypeCode === '01'
    ? 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
    : p.invoiceTypeCode === '91'
    ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    : 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2'

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="${nsInvoice}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ProfileExecutionID>${p.tipAmb}</cbc:ProfileExecutionID>
  <cbc:ID>${esc(p.invoiceNumber)}</cbc:ID>
  <cbc:UUID schemeID="${p.tipAmb}" schemeName="CUFE-SHA384">${p.cufe}</cbc:UUID>
  <cbc:IssueDate>${p.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${p.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${p.invoiceTypeCode}</cbc:InvoiceTypeCode>
  ${p.notes ? `<cbc:Note>${esc(p.notes)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${p.items.length}</cbc:LineCountNumeric>

  ${p.dueDate ? `<cac:InvoicePeriod><cbc:EndDate>${p.dueDate}</cbc:EndDate></cac:InvoicePeriod>` : ''}
  ${billingReference}

  <!-- Proveedor Tecnológico -->
  <cac:AdditionalDocumentReference>
    <cbc:ID>${esc(p.softwareId)}</cbc:ID>
    <cbc:DocumentTypeCode>18</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>

  <!-- Emisor -->
  <cac:AccountingSupplierParty>
    <cbc:AdditionalAccountID>${isFinal ? '2' : '1'}</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="31" schemeName="NIT">${nitOFE}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(p.company.name)}</cbc:Name></cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:CityName>${esc(p.company.city)}</cbc:CityName>
          <cbc:CountrySubentity>${esc(p.company.department)}</cbc:CountrySubentity>
          <cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${esc(p.company.legal_name ?? p.company.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="31" schemeName="NIT">${nitOFE}</cbc:CompanyID>
        ${p.company.ciiu_code ? `<cbc:TaxLevelCode listName="48.17.13">${esc(p.company.ciiu_code)}</cbc:TaxLevelCode>` : ''}
        <cac:RegistrationAddress>
          <cbc:CityName>${esc(p.company.city)}</cbc:CityName>
          <cbc:CountrySubentity>${esc(p.company.department)}</cbc:CountrySubentity>
          <cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country>
        </cac:RegistrationAddress>
        <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(p.company.legal_name ?? p.company.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="31" schemeName="NIT">${nitOFE}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      ${p.company.phone ? `<cac:Contact><cbc:Telephone>${esc(p.company.phone)}</cbc:Telephone>${p.company.email ? `<cbc:ElectronicMail>${esc(p.company.email)}</cbc:ElectronicMail>` : ''}</cac:Contact>` : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Adquiriente -->
  <cac:AccountingCustomerParty>
    <cbc:AdditionalAccountID>${isFinal ? '2' : '1'}</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${docType.code}" schemeName="${docType.name}">${numAdq}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(p.customer.name)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${esc(p.customer.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="${docType.code}" schemeName="${docType.name}">${numAdq}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(p.customer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${p.customer.email ? `<cac:Contact><cbc:ElectronicMail>${esc(p.customer.email)}</cbc:ElectronicMail></cac:Contact>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Totales de impuesto -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${fmt2(p.taxTotal)}</cbc:TaxAmount>
    ${taxSubtotals}
  </cac:TaxTotal>

  <!-- Totales monetarios -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${fmt2(p.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${fmt2(p.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${fmt2(p.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${fmt2(p.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Líneas -->
  ${invoiceLines}

</${rootTag}>`
}

/** Descarga el XML como archivo .xml */
export function downloadXML(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename + '.xml'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
