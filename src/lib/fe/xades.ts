/**
 * Firma digital XAdES-EPES de facturas electrónicas DIAN -- Fase D.2 del
 * plan de facturación electrónica (ver claude/plan-accion-facturacion-dian.md).
 *
 * Toma el XML UBL 2.1 SIN firma que genera xml-ubl21.ts (con dos
 * <ext:ExtensionContent/> vacíos -- el segundo es donde esta función
 * inserta la firma) y el certificado .p12/.pfx de la empresa (ya
 * descifrado en memoria por el llamador, ver src/lib/fe/certificate.ts),
 * y devuelve el XML firmado.
 *
 * Importante sobre el certificado: esta función SOLO corre del lado del
 * servidor (requiere node:crypto y node-forge). Nunca debe llamarse desde
 * el navegador. El .p12 y su contraseña se usan únicamente en memoria,
 * durante esta llamada -- no se guardan en texto plano en ningún momento
 * (ver certificate.ts para el cifrado AES-256-GCM de la contraseña).
 *
 * ⚠ ADVERTENCIAS DE EXACTITUD (léase antes de ir a producción):
 * La estructura exacta que exige el Anexo Técnico DIAN para XAdES-EPES
 * (págs. 639-645 del Anexo, Suplemento A) no pudo descargarse completa en
 * este entorno (el PDF excede lo que las herramientas de lectura web
 * pueden traer de una vez). La estructura usada aquí se basa en:
 *   1. Los estándares XAdES-EPES/XMLDSig generales (ETSI TS 101 903 / W3C
 *      XML Signature), que SÍ son de aplicación universal.
 *   2. Una referencia cruzada de una implementación independiente de
 *      terceros (no es documentación oficial de la DIAN).
 * Dos puntos puntuales quedan sin verificar de forma independiente:
 *   - El hash SHA-256 de la política de firma (SigPolicyHash) de abajo
 *     viene de esa fuente externa, no se pudo recalcular aquí mismo
 *     (restricciones de red de este entorno al descargar el PDF de la
 *     política). Se puede verificar descargando
 *     politicadefirmav2.pdf y calculando su SHA-256 en una terminal normal.
 *   - El formato exacto de X509IssuerName (orden de los campos del
 *     emisor) no está confirmado contra el texto oficial del Anexo.
 * Ninguno de estos dos puntos afecta la validez criptográfica de la firma
 * en sí (eso sí quedó verificado exhaustivamente, ver más abajo) -- son
 * detalles de contenido que el validador de la DIAN podría o no exigir
 * en un formato distinto. Antes de usar esto contra el servicio real de
 * la DIAN, lo ideal es probar primero con el ambiente de Habilitación.
 *
 * Verificación realizada (con un certificado DUMMY generado localmente,
 * nunca con el certificado real de ninguna clienta): se firmó un XML de
 * prueba y se re-verificó de forma independiente que (a) los tres
 * ds:Reference (documento completo, KeyInfo, SignedProperties) digieren
 * exactamente al contenido que dicen firmar, y (b) el ds:SignatureValue
 * verifica correctamente contra el certificado público usando
 * crypto.createVerify -- es decir, la firma es criptográficamente válida
 * y auto-consistente de punta a punta.
 */
import forge from 'node-forge'
import { DOMParser } from '@xmldom/xmldom'
import { C14nCanonicalization } from 'xml-crypto'
import { createHash, createSign, randomBytes } from 'node:crypto'

const DS_NS      = 'http://www.w3.org/2000/09/xmldsig#'
const XADES_NS   = 'http://uri.etsi.org/01903/v1.3.2#'
const C14N_URI   = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const RSA_SHA256_URI = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const SHA256_URI = 'http://www.w3.org/2001/04/xmlenc#sha256'
const ENVELOPED_URI = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const SIGNED_PROPS_TYPE = 'http://uri.etsi.org/01903#SignedProperties'

// ⚠ Ver advertencia en el encabezado del archivo: hash no verificado de
// forma independiente en este entorno.
const POLICY_URL = 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf'
const POLICY_HASH_B64 = 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y='

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type CertInfo = {
  certPem: string
  keyPem: string
  certB64: string
  certSha256B64: string
  issuerName: string
  serialDec: string
  subjectCN: string
}

/** Extrae la llave privada y el certificado de un .p12/.pfx ya en memoria. */
function extractKeyAndCert(pfxBuffer: Buffer, password: string): CertInfo {
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

  const certPem = forge.pki.certificateToPem(certObj)
  const keyPem = forge.pki.privateKeyToPem(keyObj)

  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes()
  const certDerBuf = Buffer.from(certDerBytes, 'binary')
  const certB64 = certDerBuf.toString('base64')
  const certSha256B64 = createHash('sha256').update(certDerBuf).digest('base64')

  // Orden de los campos del emisor tal como forge los expone (ver
  // advertencia de exactitud en el encabezado del archivo).
  const issuerName = (certObj.issuer.attributes as Array<{ shortName?: string; name?: string; value: unknown }>)
    .map((a) => `${a.shortName || a.name}=${a.value}`)
    .join(',')
  const serialDec = BigInt('0x' + certObj.serialNumber).toString(10)

  return {
    certPem, keyPem, certB64, certSha256B64, issuerName, serialDec,
    subjectCN: certObj.subject.getField('CN')?.value ?? '',
  }
}

function collectAncestorNamespaces(node: Node): Array<{ prefix: string; namespaceURI: string }> {
  const seen = new Set<string>()
  const result: Array<{ prefix: string; namespaceURI: string }> = []
  let el = node.parentNode as Element | null
  while (el && el.nodeType === 1) {
    const attrs = el.attributes
    if (attrs) {
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i] as unknown as { name: string; prefix: string | null; localName: string; value: string }
        if (attr.name === 'xmlns' && !seen.has('')) {
          seen.add('')
          result.push({ prefix: '', namespaceURI: attr.value })
        } else if (attr.prefix === 'xmlns' && !seen.has(attr.localName)) {
          seen.add(attr.localName)
          result.push({ prefix: attr.localName, namespaceURI: attr.value })
        }
      }
    }
    el = el.parentNode as Element | null
  }
  return result
}

function canonicalizeNode(node: Node): string {
  const c14n = new C14nCanonicalization()
  return c14n.process(node, { ancestorNamespaces: collectAncestorNamespaces(node) })
}

function sha256B64(str: string): string {
  return createHash('sha256').update(Buffer.from(str, 'utf8')).digest('base64')
}

function findById(doc: Document, id: string): Element | null {
  let found: Element | null = null
  const walk = (n: Node) => {
    if (found) return
    if (n.nodeType === 1 && (n as Element).getAttribute?.('Id') === id) { found = n as Element; return }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c)
  }
  walk(doc.documentElement)
  return found
}

function findFirstByLocalName(doc: Document, localName: string): Element | null {
  let found: Element | null = null
  const walk = (n: Node) => {
    if (found) return
    if (n.nodeType === 1 && (n as Element).localName === localName) { found = n as Element; return }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c)
  }
  walk(doc.documentElement)
  return found
}

function findExtensionContents(doc: Document): Element[] {
  const out: Element[] = []
  const walk = (n: Node) => {
    if (n.nodeType === 1 && (n as Element).localName === 'ExtensionContent') out.push(n as Element)
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c)
  }
  walk(doc.documentElement)
  return out
}

/** Regex que ubica el SEGUNDO <ext:ExtensionContent/> (vacío) del template. */
function secondExtensionContentPattern(): RegExp {
  return /^([\s\S]*<ext:ExtensionContent\/>[\s\S]*?)(<ext:ExtensionContent\/>)([\s\S]*)$/
}

function buildSignedPropertiesXml(id: string, signingTimeISO: string, cert: CertInfo): string {
  return `<xades:SignedProperties Id="${id}">` +
    `<xades:SignedSignatureProperties>` +
    `<xades:SigningTime>${signingTimeISO}</xades:SigningTime>` +
    `<xades:SigningCertificate>` +
    `<xades:Cert>` +
    `<xades:CertDigest>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/>` +
    `<ds:DigestValue>${cert.certSha256B64}</ds:DigestValue>` +
    `</xades:CertDigest>` +
    `<xades:IssuerSerial>` +
    `<ds:X509IssuerName>${esc(cert.issuerName)}</ds:X509IssuerName>` +
    `<ds:X509SerialNumber>${cert.serialDec}</ds:X509SerialNumber>` +
    `</xades:IssuerSerial>` +
    `</xades:Cert>` +
    `</xades:SigningCertificate>` +
    `<xades:SignaturePolicyIdentifier>` +
    `<xades:SignaturePolicyId>` +
    `<xades:SigPolicyId><xades:Identifier>${esc(POLICY_URL)}</xades:Identifier></xades:SigPolicyId>` +
    `<xades:SigPolicyHash>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/>` +
    `<ds:DigestValue>${POLICY_HASH_B64}</ds:DigestValue>` +
    `</xades:SigPolicyHash>` +
    `</xades:SignaturePolicyId>` +
    `</xades:SignaturePolicyIdentifier>` +
    `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>supplier</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>` +
    `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`
}

/** Hora local de Colombia (UTC-5 fijo, sin horario de verano) en formato ISO completo. */
export function getColombiaISODateTime(): string {
  const now = new Date()
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${col.getUTCFullYear()}-${pad(col.getUTCMonth() + 1)}-${pad(col.getUTCDate())}`
  const time = `${pad(col.getUTCHours())}:${pad(col.getUTCMinutes())}:${pad(col.getUTCSeconds())}`
  return `${date}T${time}-05:00`
}

/**
 * Firma un XML UBL 2.1 (generado por generateXMLUBL21, sin firma) con
 * XAdES-EPES, usando el certificado .p12/.pfx y contraseña dados (ya
 * descifrada en memoria por el llamador -- ver certificate.ts).
 *
 * El XML de entrada debe tener exactamente dos <ext:ExtensionContent/>
 * vacíos (ver xml-ubl21.ts) -- la firma se inserta en el segundo.
 */
export function signInvoiceXML(
  xmlNoSignature: string,
  pfxBuffer: Buffer,
  pfxPassword: string,
  signingTimeISO: string = getColombiaISODateTime(),
): string {
  const cert = extractKeyAndCert(pfxBuffer, pfxPassword)
  const uid = randomBytes(8).toString('hex')
  const sigId = `xmldsig-${uid}`
  const keyInfoId = `${sigId}-keyinfo`
  const signedPropsId = `${sigId}-signedprops`

  const pattern = secondExtensionContentPattern()
  if (!pattern.test(xmlNoSignature)) {
    throw new Error('El XML debe tener dos <ext:ExtensionContent/> vacíos -- el segundo es donde va la firma.')
  }

  // Paso 1: digest de todo el documento SIN firma. Es equivalente a
  // aplicar la transformada enveloped-signature sobre el documento CON
  // firma (que remueve el nodo ds:Signature antes de canonicalizar): acá
  // se logra el mismo resultado no insertando la firma todavía.
  const docNoSig = new DOMParser().parseFromString(xmlNoSignature, 'text/xml')
  const extContentsNoSig = findExtensionContents(docNoSig)
  if (extContentsNoSig.length < 2) {
    throw new Error('El XML debe tener dos <ext:ExtensionContent> -- el segundo es donde va la firma.')
  }
  const digest1 = sha256B64(canonicalizeNode(docNoSig.documentElement))

  const keyInfoXml = `<ds:KeyInfo Id="${keyInfoId}"><ds:X509Data><ds:X509Certificate>${cert.certB64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`
  const signedPropertiesXml = buildSignedPropertiesXml(signedPropsId, signingTimeISO, cert)
  const qualifyingPropsXml = `<ds:Object><xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${sigId}">${signedPropertiesXml}</xades:QualifyingProperties></ds:Object>`

  // Paso 2: digest de KeyInfo y de SignedProperties, ya en su posición
  // final (mismo contexto de namespaces ancestrales que tendrán en el
  // documento firmado), pero todavía sin ds:SignedInfo -- el orden de los
  // hermanos no afecta la forma canónica de cada uno.
  const skeleton1 = xmlNoSignature.replace(
    pattern,
    (_m, before: string, _empty: string, after: string) =>
      `${before}<ext:ExtensionContent><ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}">${keyInfoXml}${qualifyingPropsXml}</ds:Signature></ext:ExtensionContent>${after}`,
  )
  const docSkeleton1 = new DOMParser().parseFromString(skeleton1, 'text/xml')
  const keyInfoNode1 = findById(docSkeleton1, keyInfoId)
  const signedPropsNode1 = findById(docSkeleton1, signedPropsId)
  if (!keyInfoNode1 || !signedPropsNode1) {
    throw new Error('No se pudo ubicar KeyInfo/SignedProperties en el documento intermedio.')
  }
  const digest2 = sha256B64(canonicalizeNode(keyInfoNode1))
  const digest3 = sha256B64(canonicalizeNode(signedPropsNode1))

  // Paso 3: SignedInfo con los 3 digests, canonicalizado ya en su
  // posición final dentro de ds:Signature.
  const signedInfoXml =
    `<ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="${C14N_URI}"/>` +
    `<ds:SignatureMethod Algorithm="${RSA_SHA256_URI}"/>` +
    `<ds:Reference URI="">` +
    `<ds:Transforms><ds:Transform Algorithm="${ENVELOPED_URI}"/><ds:Transform Algorithm="${C14N_URI}"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${digest1}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${keyInfoId}">` +
    `<ds:Transforms><ds:Transform Algorithm="${C14N_URI}"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${digest2}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${signedPropsId}" Type="${SIGNED_PROPS_TYPE}">` +
    `<ds:Transforms><ds:Transform Algorithm="${C14N_URI}"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/><ds:DigestValue>${digest3}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`

  const skeleton2 = xmlNoSignature.replace(
    pattern,
    (_m, before: string, _empty: string, after: string) =>
      `${before}<ext:ExtensionContent><ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}">${signedInfoXml}${keyInfoXml}${qualifyingPropsXml}</ds:Signature></ext:ExtensionContent>${after}`,
  )
  const docSkeleton2 = new DOMParser().parseFromString(skeleton2, 'text/xml')
  const signedInfoNode = findFirstByLocalName(docSkeleton2, 'SignedInfo')
  if (!signedInfoNode) throw new Error('No se pudo ubicar SignedInfo en el documento intermedio.')
  const canonicalSignedInfo = canonicalizeNode(signedInfoNode)

  // Paso 4: firmar (RSASSA-PKCS1-v1_5 con SHA-256 == rsa-sha256).
  const signer = createSign('RSA-SHA256')
  signer.update(Buffer.from(canonicalSignedInfo, 'utf8'))
  signer.end()
  const signatureValueB64 = signer.sign(cert.keyPem).toString('base64')

  // Paso 5: ensamblar la firma final e insertarla en el documento real.
  const finalSignatureXml =
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}">` +
    signedInfoXml +
    `<ds:SignatureValue>${signatureValueB64}</ds:SignatureValue>` +
    keyInfoXml +
    qualifyingPropsXml +
    `</ds:Signature>`

  return xmlNoSignature.replace(
    pattern,
    (_m, before: string, _empty: string, after: string) =>
      `${before}<ext:ExtensionContent>${finalSignatureXml}</ext:ExtensionContent>${after}`,
  )
}
