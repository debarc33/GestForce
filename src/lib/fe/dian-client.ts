/**
 * Cliente de alto nivel para el servicio web de la DIAN
 * (`WcfDianCustomerServices`) -- Fase E de
 * claude/plan-accion-facturacion-dian.md.
 *
 * Junta las piezas de las fases anteriores: toma el XML YA FIRMADO
 * (XAdES-EPES, src/lib/fe/xades.ts), lo empaqueta en un .zip
 * (src/lib/fe/zip.ts), construye y firma el sobre SOAP que exige la
 * DIAN (src/lib/fe/dian-soap.ts, firma distinta de la del XML -- ver ese
 * archivo), lo envía por HTTPS, y traduce la respuesta a un objeto
 * entendible.
 *
 * Operaciones confirmadas contra el WSDL OFICIAL real (descargado por
 * Deisy el 18 nov 2026 de `?singleWsdl`, no una reconstrucción de
 * terceros):
 *   - `sendTestSetAsync` (Habilitación): envía UNA factura del set de
 *     pruebas. Es asíncrona -- devuelve un `ZipKey` (identificador de
 *     seguimiento), no el resultado final. El resultado final hay que
 *     consultarlo después con `getStatus`/`getStatusZip`.
 *   - `sendBillSync` (Producción): envía una factura real. Es
 *     SÍNCRONA -- devuelve el resultado (`DianResponse`, con `isValid`)
 *     en la misma respuesta, sin necesidad de consultar después.
 *   - `getStatus`/`getStatusZip`: consultan el resultado de un envío
 *     asíncrono anterior, dado su `trackId` (el `ZipKey` que devolvió
 *     `sendTestSetAsync`). `getStatus` devuelve un solo resultado;
 *     `getStatusZip` devuelve una lista (para sets con varios XML).
 *
 * ⚠ Esto NO se ha podido probar contra el servicio real de la DIAN
 * (Deisy no tiene acceso a la cuenta de su clienta en este momento --
 * las pruebas reales se harán presencialmente con ella más adelante).
 * La construcción del sobre SOAP sí se verificó exhaustivamente de forma
 * criptográfica (ver dian-soap.ts) con un certificado de prueba, y la
 * estructura de operaciones/parámetros viene del WSDL oficial real, no
 * de una fuente de terceros -- pero el único chequeo que de verdad
 * confirma que la DIAN acepta esto es la prueba en vivo.
 */
import { zipXmlToBase64 } from './zip'
import { buildSignedSoapEnvelope, DIAN_NS } from './dian-soap'
import forge from 'node-forge'

export type DianResponse = {
  errorMessage: string[]
  isValid: boolean | null
  statusCode: string | null
  statusDescription: string | null
  statusMessage: string | null
  xmlBase64Bytes: string | null
  xmlBytes: string | null
  xmlDocumentKey: string | null
  xmlFileName: string | null
}

export type XmlParamsResponseTrackId = {
  documentKey: string | null
  processedMessage: string | null
  senderCode: string | null
  success: boolean | null
  xmlFileName: string | null
}

export type UploadDocumentResponse = {
  errorMessageList: XmlParamsResponseTrackId[]
  zipKey: string | null
}

export type DianCallResult<T> =
  | { ok: true; result: T; rawResponseXml: string }
  | { ok: false; fault: { code: string | null; reason: string | null }; rawResponseXml: string }

// --- utilidades mínimas de XML (sin depender de una librería de parseo
// genérica -- mismo patrón ya usado en xades.ts) ---

function findFirstByLocalName(node: any, localName: string): any {
  let found: any = null
  const walk = (n: any) => {
    if (found) return
    if (n.nodeType === 1 && n.localName === localName) { found = n; return }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c)
  }
  walk(node)
  return found
}

function findAllByLocalName(node: any, localName: string): any[] {
  const out: any[] = []
  const walk = (n: any) => {
    if (n.nodeType === 1 && n.localName === localName) out.push(n)
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c)
  }
  walk(node)
  return out
}

function textOrNull(parent: any, localName: string): string | null {
  const el = findFirstByLocalName(parent, localName)
  if (!el) return null
  const nil = el.getAttribute?.('xsi:nil')
  if (nil === 'true') return null
  return el.textContent
}

function boolOrNull(parent: any, localName: string): boolean | null {
  const t = textOrNull(parent, localName)
  if (t === null) return null
  return t === 'true' || t === '1'
}

function parseDianResponse(node: any): DianResponse {
  const errMsgsNode = findFirstByLocalName(node, 'ErrorMessage')
  const errorMessage = errMsgsNode ? findAllByLocalName(errMsgsNode, 'string').map((n) => n.textContent) : []
  return {
    errorMessage,
    isValid: boolOrNull(node, 'IsValid'),
    statusCode: textOrNull(node, 'StatusCode'),
    statusDescription: textOrNull(node, 'StatusDescription'),
    statusMessage: textOrNull(node, 'StatusMessage'),
    xmlBase64Bytes: textOrNull(node, 'XmlBase64Bytes'),
    xmlBytes: textOrNull(node, 'XmlBytes'),
    xmlDocumentKey: textOrNull(node, 'XmlDocumentKey'),
    xmlFileName: textOrNull(node, 'XmlFileName'),
  }
}

function parseUploadDocumentResponse(node: any): UploadDocumentResponse {
  const listNode = findFirstByLocalName(node, 'ErrorMessageList')
  const items = listNode ? findAllByLocalName(listNode, 'XmlParamsResponseTrackId') : []
  return {
    errorMessageList: items.map((it) => ({
      documentKey: textOrNull(it, 'DocumentKey'),
      processedMessage: textOrNull(it, 'ProcessedMessage'),
      senderCode: textOrNull(it, 'SenderCode'),
      success: boolOrNull(it, 'Success'),
      xmlFileName: textOrNull(it, 'XmlFileName'),
    })),
    zipKey: textOrNull(node, 'ZipKey'),
  }
}

/** Extrae la llave privada + certificado (DER, para el thumbprint) del .p12. */
function extractForSoap(pfxBuffer: Buffer, password: string): { keyPem: string; certDerBuf: Buffer } {
  const der = forge.util.createBuffer(pfxBuffer.toString('binary'))
  const p12Asn1 = forge.asn1.fromDer(der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
  const shroudedBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
  const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]
  const keyBags = (shroudedBags && shroudedBags.length) ? shroudedBags : plainKeyBags
  const certObj = certBags?.[0]?.cert
  const keyObj = keyBags?.[0]?.key
  if (!certObj) throw new Error('El .p12 no contiene un certificado legible.')
  if (!keyObj) throw new Error('El .p12 no contiene una llave privada legible.')
  const keyPem = forge.pki.privateKeyToPem(keyObj)
  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes()
  const certDerBuf = Buffer.from(certDerBytes, 'binary')
  return { keyPem, certDerBuf }
}

/**
 * Construye el sobre SOAP firmado y, si `dryRun` no es true, lo envía al
 * servicio de la DIAN. `dryRun: true` sirve para inspeccionar el sobre
 * sin tocar el servicio real -- útil mientras no se pueda probar en vivo.
 */
async function callDianOperation<T>(params: {
  apiUrl: string
  operation: string
  fields: Record<string, string | null | undefined>
  pfxBuffer: Buffer
  pfxPassword: string
  parseResult: (resultNode: any) => T
  resultElementName: string
  dryRun?: boolean
}): Promise<DianCallResult<T> & { requestXml: string }> {
  const { keyPem, certDerBuf } = extractForSoap(params.pfxBuffer, params.pfxPassword)
  const requestXml = buildSignedSoapEnvelope({
    toUrl: params.apiUrl,
    operation: params.operation,
    fields: params.fields,
    certDerBuf,
    keyPem,
  })

  if (params.dryRun) {
    return { ok: true, result: null as unknown as T, rawResponseXml: '', requestXml }
  }

  const action = `${DIAN_NS}/IWcfDianCustomerServices/${params.operation}`
  const res = await fetch(params.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"` },
    body: requestXml,
  })
  const responseXml = await res.text()

  const { DOMParser } = await import('@xmldom/xmldom')
  const doc = new DOMParser().parseFromString(responseXml, 'text/xml')

  const faultNode = findFirstByLocalName(doc.documentElement, 'Fault')
  if (faultNode) {
    const code = textOrNull(faultNode, 'Value') ?? textOrNull(faultNode, 'faultcode')
    const reason = textOrNull(faultNode, 'Text') ?? textOrNull(faultNode, 'faultstring')
    return { ok: false, fault: { code, reason }, rawResponseXml: responseXml, requestXml }
  }

  const resultNode = findFirstByLocalName(doc.documentElement, params.resultElementName)
  if (!resultNode) {
    return {
      ok: false,
      fault: { code: null, reason: `No se encontró ${params.resultElementName} en la respuesta (HTTP ${res.status}).` },
      rawResponseXml: responseXml,
      requestXml,
    }
  }

  return { ok: true, result: params.parseResult(resultNode), rawResponseXml: responseXml, requestXml }
}

/** Habilitación: envía una factura del set de pruebas. Asíncrono -- usar el `zipKey` devuelto con getStatus/getStatusZip. */
export async function sendTestSetAsync(params: {
  apiUrl: string; pfxBuffer: Buffer; pfxPassword: string
  fileName: string; signedXml: string; testSetId: string; dryRun?: boolean
}) {
  return callDianOperation<UploadDocumentResponse>({
    apiUrl: params.apiUrl,
    operation: 'SendTestSetAsync',
    fields: {
      fileName: params.fileName,
      contentFile: zipXmlToBase64(params.fileName, params.signedXml),
      testSetId: params.testSetId,
    },
    pfxBuffer: params.pfxBuffer,
    pfxPassword: params.pfxPassword,
    parseResult: parseUploadDocumentResponse,
    resultElementName: 'SendTestSetAsyncResult',
    dryRun: params.dryRun,
  })
}

/** Producción: envía una factura real. Síncrono -- el resultado llega en la misma respuesta. */
export async function sendBillSync(params: {
  apiUrl: string; pfxBuffer: Buffer; pfxPassword: string
  fileName: string; signedXml: string; dryRun?: boolean
}) {
  return callDianOperation<DianResponse>({
    apiUrl: params.apiUrl,
    operation: 'SendBillSync',
    fields: {
      fileName: params.fileName,
      contentFile: zipXmlToBase64(params.fileName, params.signedXml),
    },
    pfxBuffer: params.pfxBuffer,
    pfxPassword: params.pfxPassword,
    parseResult: parseDianResponse,
    resultElementName: 'SendBillSyncResult',
    dryRun: params.dryRun,
  })
}

/** Consulta el resultado de un envío asíncrono anterior (un solo documento). */
export async function getStatus(params: {
  apiUrl: string; pfxBuffer: Buffer; pfxPassword: string; trackId: string; dryRun?: boolean
}) {
  return callDianOperation<DianResponse>({
    apiUrl: params.apiUrl,
    operation: 'GetStatus',
    fields: { trackId: params.trackId },
    pfxBuffer: params.pfxBuffer,
    pfxPassword: params.pfxPassword,
    parseResult: parseDianResponse,
    resultElementName: 'GetStatusResult',
    dryRun: params.dryRun,
  })
}

/** Consulta el resultado de un envío asíncrono anterior (varios documentos, p. ej. un set de pruebas completo). */
export async function getStatusZip(params: {
  apiUrl: string; pfxBuffer: Buffer; pfxPassword: string; trackId: string; dryRun?: boolean
}) {
  return callDianOperation<DianResponse[]>({
    apiUrl: params.apiUrl,
    operation: 'GetStatusZip',
    fields: { trackId: params.trackId },
    pfxBuffer: params.pfxBuffer,
    pfxPassword: params.pfxPassword,
    parseResult: (node) => findAllByLocalName(node, 'DianResponse').map(parseDianResponse),
    resultElementName: 'GetStatusZipResult',
    dryRun: params.dryRun,
  })
}
