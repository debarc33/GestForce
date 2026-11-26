/**
 * Generador de XML UBL 2.1 para Facturación Electrónica DIAN Colombia
 * Según Anexo Técnico DIAN versión 1.9 — Esquema UBL 2.1
 *
 * Genera el XML base SIN firma digital. GestForce opera bajo el modo
 * "Desarrollo propio" (no hay Proveedor Tecnológico intermediario) -- la
 * firma XAdES-EPES se aplica después, del lado del servidor, con
 * src/lib/fe/xades.ts (Fase D.2 del plan de facturación electrónica),
 * usando el certificado .p12 propio de cada empresa.
 *
 * Por eso ext:UBLExtensions siempre trae DOS <ext:UBLExtension>: el
 * segundo es donde xades.ts inserta la firma (buscarlo por posición, no
 * por contenido). El primero, antes vacío, ahora lleva el bloque
 * obligatorio `sts:DianExtensions` (hallazgo 26 nov 2026, comparando
 * contra una factura real aceptada por la DIAN -- ver
 * claude/plan-accion-facturacion-dian.md): sin este bloque la DIAN no
 * tiene forma de validar la resolución de numeración, el origen del
 * documento ni el software que lo generó, aunque el resto del XML esté
 * bien formado.
 *
 * Fuentes usadas para la estructura exacta de sts:DianExtensions (no hay
 * una copia en texto plano fácilmente citable del Anexo Técnico oficial):
 *  - XSD "DIAN_UBL_Structures.xsd" (targetNamespace
 *    "dian:gov:co:facturaelectronica:Structures-2-1"), que define el
 *    orden exacto: InvoiceControl? / InvoiceSource / SoftwareProvider /
 *    SoftwareSecurityCode / AuthorizationProvider / QRCode.
 *  - Dos implementaciones independientes (generador_factura_electronica_2020
 *    y el módulo Odoo l10n_co_e-invoice) que coinciden en esa misma
 *    estructura y en los atributos schemeAgencyID="195"/schemeID/schemeName
 *    de ProviderID y AuthorizationProviderID.
 *  - Anexo Técnico DIAN "Mecanismos del Sistema Técnico de Control
 *    Fiscal... CUFE, UUID, QR y Software Security Code": el
 *    SoftwareSecurityCode es SHA384(IdSoftware + PIN), sin separador --
 *    ver calculateSoftwareSecurityCode() en cufe.ts.
 *
 * InvoiceControl (resolución/prefijo/rango/vigencia) es el único
 * sub-bloque opcional dentro de DianExtensions según ese XSD -- por eso,
 * si a la empresa todavía le falta configurar la Resolución DIAN en
 * Configuración → Fiscal, se omite entero en vez de emitir un XML
 * inválido con campos vacíos (mismo criterio que ya usaba el pie de
 * página del documento impreso).
 */

import type { DocCompany, DocCustomer, DocItem } from '@/modules/sales/components/document-viewer'
import { buildVerificationUrl } from './qr'

/** NIT de la propia DIAN (800.197.268-4), usado como AuthorizationProviderID
 *  -- la entidad que autoriza la numeración es siempre la DIAN misma, sin
 *  importar la empresa emisora. Dato público, confirmado contra dos
 *  implementaciones independientes (ver comentario de archivo). */
const DIAN_NIT    = '800197268'
const DIAN_NIT_DV = '4'

export interface XMLInvoiceParams {
  invoiceNumber: string
  /** CUFE (facturas) o CUDE (notas crédito/débito) ya calculado. El nombre
   *  del campo se conserva por compatibilidad; el esquema del UUID (abajo)
   *  sí distingue cuál es según invoiceTypeCode. */
  cufe:          string
  issueDate:     string   // YYYY-MM-DD
  issueTime:     string   // HH:mm:ss-05:00
  dueDate?:      string | null
  /** 'contado' | 'credito' -- forma de pago (hallazgo 20 nov 2026: antes no
   *  existia este campo en absoluto, el XML nunca declaraba forma de pago). */
  paymentForm?:  'contado' | 'credito' | null
  tipAmb:        '1' | '2'   // 1=producción, 2=habilitación
  softwareId:    string
  /** Código de Seguridad del Software ya calculado (SHA384 de ID+PIN) --
   *  se recibe ya calculado porque el hash se hace con Web Crypto (async)
   *  y esta función es síncrona; ver calculateSoftwareSecurityCode() en
   *  cufe.ts y su uso en route.ts. */
  softwareSecurityCode: string
  /** 01=Factura Venta, 91=Nota Crédito, 92=Nota Débito */
  invoiceTypeCode: '01' | '91' | '92'
  /** Número de factura referenciada (para NC/ND) */
  referencedInvoice?: string | null
  /** CUFE de la factura referenciada */
  referencedCUFE?:    string | null
  company:   DocCompany & {
    nit: string; ciiu_code?: string | null; dian_prefix?: string | null
    /** Campos de la Resolución de Facturación DIAN (Configuración → Fiscal).
     *  Si falta alguno, se omite sts:InvoiceControl entero (ver comentario
     *  de archivo) -- no se envía un bloque a medias. */
    dian_resolution?:      string | null
    dian_from_number?:     number | null
    dian_to_number?:       number | null
    dian_validity_from?:   string | null
    dian_validity_to?:     string | null
  }
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

/**
 * Forma de pago (hallazgo 20 nov 2026, comparado contra Siigo): antes este
 * bloque <cac:PaymentMeans>/<cac:PaymentTerms> no existia en absoluto -- la
 * DIAN nunca recibia si la venta era de contado o a credito. Codigos
 * 1=Contado, 2=Credito, convencion estandar usada por el software de
 * facturacion electronica en Colombia -- pendiente de verificar contra un
 * XML real validado por la DIAN si se presenta algun problema de
 * validacion especifico de este bloque.
 */
export function generateXMLUBL21(p: XMLInvoiceParams): string {
  const nitOFE   = (p.company.nit ?? '').replace(/[^0-9]/g, '')
  const numAdq   = (p.customer.doc_number ?? '222222222222').replace(/[^0-9]/g, '')
  const docType  = DOC_TYPE_MAP[p.customer.doc_type ?? 'CC'] ?? { code: '13', name: 'Cédula de ciudadanía' }
  const isFinal  = !p.customer.doc_number  // consumidor final

  // Fase G: antes esto SIEMPRE caía en 'CreditNote' para invoiceTypeCode
  // '92' (Nota Débito) -- bug real, no solo de notas débito "pendientes":
  // el XML de una nota débito habría salido con el tag raíz y el esquema
  // UBL de una nota crédito. Corregido aquí, antes de que notas débito
  // generen su primer XML real. Estas constantes se declaran ARRIBA de
  // invoiceLines (no donde antes vivían, más abajo) porque invoiceLines ya
  // las usa dentro de su propio template -- declararlas después causaba un
  // ReferenceError en tiempo de ejecución (temporal dead zone de `const`).
  const rootTag    = p.invoiceTypeCode === '01' ? 'Invoice'
    : p.invoiceTypeCode === '91' ? 'CreditNote' : 'DebitNote'
  const nsInvoice  = p.invoiceTypeCode === '01'
    ? 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
    : p.invoiceTypeCode === '91'
    ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    : 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2'
  // El esquema UBL de CreditNote/DebitNote nombra sus líneas y su cantidad
  // distinto al de Invoice (CreditNoteLine/CreditedQuantity,
  // DebitNoteLine/DebitedQuantity) -- antes el código reusaba siempre
  // InvoiceLine/InvoicedQuantity, lo que habría invalidado el XML de
  // cualquier nota contra el XSD de la DIAN.
  const lineTag    = p.invoiceTypeCode === '01' ? 'InvoiceLine'
    : p.invoiceTypeCode === '91' ? 'CreditNoteLine' : 'DebitNoteLine'
  const qtyTag     = p.invoiceTypeCode === '01' ? 'InvoicedQuantity'
    : p.invoiceTypeCode === '91' ? 'CreditedQuantity' : 'DebitedQuantity'
  // El Anexo Técnico llama "CUDE" (no "CUFE") al código de notas -- el
  // esquema del UUID debe decirlo, aunque el valor del hash viaja en el
  // mismo campo `cufe` de este tipo por compatibilidad.
  const codeSchemeName = p.invoiceTypeCode === '01' ? 'CUFE-SHA384' : 'CUDE-SHA384'

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
    <cac:${lineTag}>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:${qtyTag} unitCode="NAL">${item.quantity}</cbc:${qtyTag}>
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
    </cac:${lineTag}>`).join('')

  const billingReference = p.referencedInvoice ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(p.referencedInvoice)}</cbc:ID>
      ${p.referencedCUFE ? `<cbc:UUID schemeName="CUFE-SHA384">${p.referencedCUFE}</cbc:UUID>` : ''}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''

  // Dígito de verificación (DV) del NIT propio, si el usuario lo escribió
  // con guion en Configuración (ej. "900123456-7", el placeholder que ya
  // usa esa pantalla) -- se usa solo como atributo schemeID de
  // sts:ProviderID, nunca se recalcula con el algoritmo módulo 11 para no
  // arriesgar un valor distinto al que la empresa ya tiene registrado ante
  // la DIAN. Si no hay guion, se omite el atributo (no es obligatorio en
  // el esquema).
  const nitDV = (p.company.nit ?? '').includes('-')
    ? (p.company.nit ?? '').split('-').pop()!.replace(/[^0-9]/g, '')
    : ''

  // sts:DianExtensions -- ver comentario de cabecera del archivo. Solo
  // InvoiceControl es condicional (requiere los 6 campos de la Resolución
  // DIAN completos); el resto siempre va, porque solo depende de datos que
  // ya son obligatorios para llegar hasta acá (NIT, Software ID, PIN).
  const hasResolution = !!(
    p.company.dian_resolution && p.company.dian_prefix &&
    p.company.dian_from_number && p.company.dian_to_number &&
    p.company.dian_validity_from && p.company.dian_validity_to
  )

  const invoiceControl = hasResolution ? `
    <sts:InvoiceControl>
      <sts:InvoiceAuthorization>${esc(p.company.dian_resolution)}</sts:InvoiceAuthorization>
      <sts:AuthorizationPeriod>
        <cbc:StartDate>${p.company.dian_validity_from}</cbc:StartDate>
        <cbc:EndDate>${p.company.dian_validity_to}</cbc:EndDate>
      </sts:AuthorizationPeriod>
      <sts:AuthorizedInvoices>
        <sts:Prefix>${esc(p.company.dian_prefix)}</sts:Prefix>
        <sts:From>${p.company.dian_from_number}</sts:From>
        <sts:To>${p.company.dian_to_number}</sts:To>
      </sts:AuthorizedInvoices>
    </sts:InvoiceControl>` : ''

  const dianExtensions = `
      <sts:DianExtensions>${invoiceControl}
        <sts:InvoiceSource>
          <cbc:IdentificationCode>CO</cbc:IdentificationCode>
        </sts:InvoiceSource>
        <sts:SoftwareProvider>
          <sts:ProviderID schemeAgencyID="195"${nitDV ? ` schemeID="${nitDV}"` : ''} schemeName="31">${nitOFE}</sts:ProviderID>
          <sts:SoftwareID schemeAgencyID="195">${esc(p.softwareId)}</sts:SoftwareID>
        </sts:SoftwareProvider>
        <sts:SoftwareSecurityCode schemeAgencyID="195">${p.softwareSecurityCode}</sts:SoftwareSecurityCode>
        <sts:AuthorizationProvider>
          <sts:AuthorizationProviderID schemeAgencyID="195" schemeID="${DIAN_NIT_DV}" schemeName="31">${DIAN_NIT}</sts:AuthorizationProviderID>
        </sts:AuthorizationProvider>
        <sts:QRCode>${esc(buildVerificationUrl(p.cufe, p.tipAmb === '2'))}</sts:QRCode>
      </sts:DianExtensions>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="${nsInvoice}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>${dianExtensions}
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ProfileExecutionID>${p.tipAmb}</cbc:ProfileExecutionID>
  <cbc:ID>${esc(p.invoiceNumber)}</cbc:ID>
  <cbc:UUID schemeID="${p.tipAmb}" schemeName="${codeSchemeName}">${p.cufe}</cbc:UUID>
  <cbc:IssueDate>${p.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${p.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${p.invoiceTypeCode}</cbc:InvoiceTypeCode>
  ${p.notes ? `<cbc:Note>${esc(p.notes)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${p.items.length}</cbc:LineCountNumeric>

  ${p.dueDate ? `<cac:InvoicePeriod><cbc:EndDate>${p.dueDate}</cbc:EndDate></cac:InvoicePeriod>` : ''}
  ${billingReference}

  <!-- Identificación del software (Software ID) -->
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

  ${p.invoiceTypeCode === '01' ? `<!-- Forma de pago -->
  <cac:PaymentMeans>
    <cbc:ID>1</cbc:ID>
    <cbc:PaymentMeansCode>${p.paymentForm === 'credito' ? '1' : '10'}</cbc:PaymentMeansCode>
    ${p.dueDate ? `<cbc:PaymentDueDate>${p.dueDate}</cbc:PaymentDueDate>` : ''}
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:ID>1</cbc:ID>
    <cbc:PaymentMeansID>${p.paymentForm === 'credito' ? '2' : '1'}</cbc:PaymentMeansID>
    <cbc:Amount currencyID="COP">${fmt2(p.total)}</cbc:Amount>
  </cac:PaymentTerms>` : ''}

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
