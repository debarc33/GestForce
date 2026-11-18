/**
 * Sobre SOAP 1.2 + WS-Security para el servicio web de la DIAN
 * (`WcfDianCustomerServices`) -- Fase E de
 * claude/plan-accion-facturacion-dian.md.
 *
 * A diferencia de la firma XAdES-EPES del XML de la factura
 * (src/lib/fe/xades.ts), esta es la firma del SOBRE que transporta esa
 * factura hasta la DIAN -- dos firmas distintas, con el mismo
 * certificado, pero estructuras diferentes.
 *
 * La política de seguridad usada aquí (`WSHttpBinding_IWcfDianCustomerServices_policy`)
 * se confirmó contra el WSDL OFICIAL real que Deisy descargó directamente
 * de `https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?singleWsdl`
 * (18 nov 2026) -- no es una reconstrucción de terceros como tuvo que
 * hacerse para algunos detalles de la firma XAdES. La política exige:
 *   - Transporte: HTTPS (sin certificado de cliente TLS).
 *   - Un token X.509 "Endorsing" (de apoyo) que firma ÚNICAMENTE el
 *     encabezado <wsa:To> (`sp:SignedParts` solo lista ese header) --
 *     referenciado por su huella SHA-1 (`sp:RequireThumbprintReference`),
 *     sin incluir el certificado completo en el mensaje.
 *   - AlgorithmSuite `Basic256Sha256Rsa15` => firma RSA-SHA256, digest
 *     SHA-256, canonicalización EXCLUSIVA (distinta de la inclusiva que
 *     exige la firma XAdES del XML -- no es un error, son normas
 *     distintas: WS-Security vs. XAdES).
 *   - `IncludeTimestamp`: un wsu:Timestamp es obligatorio en el header de
 *     seguridad (no necesita estar firmado -- SignedParts no lo incluye).
 *
 * Verificación realizada (con el certificado DUMMY, nunca el real): se
 * armó un sobre de prueba completo y se confirmó de forma independiente
 * que el digest de <wsa:To> y el valor de la firma son exactos.
 *
 * ⚠ Lo que esto NO puede confirmar sin una llamada real a la DIAN: si el
 * servicio acepta el sobre en la práctica (por ejemplo, si exige algún
 * encabezado adicional no declarado en la política, o si hay algún
 * detalle de implementación del lado de la DIAN que no se refleje en su
 * propio WSDL). Por eso `dian-client.ts` expone un modo "solo construir"
 * (sin enviar) para poder inspeccionar el sobre antes de usarlo contra el
 * servicio real.
 */
import { createHash, randomUUID } from 'node:crypto'
import { SignedXml } from 'xml-crypto'

export const SOAP12_NS = 'http://www.w3.org/2003/05/soap-envelope'
export const WSA_NS = 'http://www.w3.org/2005/08/addressing'
export const WSU_NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
export const WSSE_NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
export const DIAN_NS = 'http://wcf.dian.colombia'
const THUMBPRINT_VALUETYPE = 'http://docs.oasis-open.org/wss/oasis-wss-soap-message-security-1.1#ThumbprintSHA1'
const B64_ENCODINGTYPE = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'

function isoNoMillis(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Huella SHA-1 del certificado (en DER), codificada en base64. */
export function thumbprintSha1B64(certDerBuf: Buffer): string {
  return createHash('sha1').update(certDerBuf).digest('base64')
}

/**
 * Cuerpo (`<soap12:Body>`) de una operación del contrato
 * `IWcfDianCustomerServices`. El esquema del WSDL usa
 * `elementFormDefault="qualified"`, así que los campos (fileName,
 * contentFile, testSetId, trackId...) heredan el namespace del elemento
 * de la operación -- no hay que repetirlo en cada uno.
 */
export function buildOperationBody(operation: string, fields: Record<string, string | null | undefined>): string {
  const inner = Object.entries(fields)
    .map(([k, v]) => (v === null || v === undefined) ? `<${k} xsi:nil="true"/>` : `<${k}>${v}</${k}>`)
    .join('')
  return `<${operation} xmlns="${DIAN_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${inner}</${operation}>`
}

/** Sobre SOAP sin firmar, con los headers de WS-Addressing y el Timestamp. */
function buildUnsignedEnvelope(toUrl: string, action: string, bodyInnerXml: string): string {
  const messageId = `urn:uuid:${randomUUID()}`
  const now = new Date()
  const expires = new Date(now.getTime() + 5 * 60 * 1000) // 5 min (igual al default de WCF)

  return `<soap12:Envelope xmlns:soap12="${SOAP12_NS}" xmlns:wsa="${WSA_NS}">` +
    `<soap12:Header>` +
    `<wsa:Action soap12:mustUnderstand="1">${action}</wsa:Action>` +
    `<wsa:MessageID>${messageId}</wsa:MessageID>` +
    `<wsa:ReplyTo><wsa:Address>${WSA_NS}/anonymous</wsa:Address></wsa:ReplyTo>` +
    `<wsa:To soap12:mustUnderstand="1" xmlns:wsu="${WSU_NS}" wsu:Id="_to">${toUrl}</wsa:To>` +
    `<wsse:Security xmlns:wsse="${WSSE_NS}" soap12:mustUnderstand="1">` +
    `<wsu:Timestamp xmlns:wsu="${WSU_NS}" wsu:Id="_ts">` +
    `<wsu:Created>${isoNoMillis(now)}</wsu:Created>` +
    `<wsu:Expires>${isoNoMillis(expires)}</wsu:Expires>` +
    `</wsu:Timestamp>` +
    `</wsse:Security>` +
    `</soap12:Header>` +
    `<soap12:Body>${bodyInnerXml}</soap12:Body>` +
    `</soap12:Envelope>`
}

/**
 * Firma el encabezado <wsa:To> (el único que exige la política real) e
 * inserta la ds:Signature dentro de <wsse:Security>, después del
 * Timestamp -- mismo orden que genera WCF.
 */
function signEnvelope(unsignedXml: string, certDerBuf: Buffer, keyPem: string): string {
  const thumbprint = thumbprintSha1B64(certDerBuf)

  const sig = new SignedXml({
    privateKey: keyPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    getKeyInfoContent: () =>
      `<wsse:SecurityTokenReference xmlns:wsse="${WSSE_NS}">` +
      `<wsse:KeyIdentifier EncodingType="${B64_ENCODINGTYPE}" ValueType="${THUMBPRINT_VALUETYPE}">${thumbprint}</wsse:KeyIdentifier>` +
      `</wsse:SecurityTokenReference>`,
  })

  sig.addReference({
    xpath: "//*[@wsu:Id='_to']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
    isEmptyUri: false,
  })

  sig.computeSignature(unsignedXml, {
    prefix: 'ds',
    location: { reference: "//*[local-name(.)='Security']", action: 'append' },
    existingPrefixes: { wsu: WSU_NS, wsa: WSA_NS, soap12: SOAP12_NS, wsse: WSSE_NS },
  })

  return sig.getSignedXml()
}

/** Construye y firma el sobre SOAP completo para una operación del contrato DIAN. */
export function buildSignedSoapEnvelope(params: {
  toUrl: string
  operation: string
  fields: Record<string, string | null | undefined>
  certDerBuf: Buffer
  keyPem: string
}): string {
  const action = `${DIAN_NS}/IWcfDianCustomerServices/${params.operation}`
  const bodyXml = buildOperationBody(params.operation, params.fields)
  const unsignedXml = buildUnsignedEnvelope(params.toUrl, action, bodyXml)
  return signEnvelope(unsignedXml, params.certDerBuf, params.keyPem)
}
