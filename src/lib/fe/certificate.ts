/**
 * Certificado digital de firma (.p12/.pfx) -- Fase D del plan de
 * facturación electrónica (ver claude/plan-accion-facturacion-dian.md).
 *
 * Responsabilidades de este archivo:
 *  - Cifrar/descifrar la contraseña del certificado. Nunca se guarda en
 *    texto plano (ver migración 035 y la tabla company_certificates):
 *    se cifra con AES-256-GCM usando una llave que vive solo como
 *    variable de entorno del servidor (FE_CERT_ENCRYPTION_KEY), y solo se
 *    descifra en memoria, de forma transitoria, para usarla una vez.
 *  - Validar que un archivo .p12/.pfx realmente abre con la contraseña
 *    dada, y extraer su fecha de vencimiento real (notAfter del propio
 *    certificado X.509), antes de guardar nada.
 *
 * La firma XAdES-BES en sí (usar este certificado para firmar el XML de
 * una factura) queda para una fase posterior, cuando se disponga de un
 * certificado real de la DIAN para probarla de punta a punta.
 */
import forge from 'node-forge'
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.FE_CERT_ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'FE_CERT_ENCRYPTION_KEY no está configurada en las variables de entorno del servidor.'
    )
  }
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== 32) {
    throw new Error(
      'FE_CERT_ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en base64 (ver instrucciones de configuración en Vercel).'
    )
  }
  return buf
}

/**
 * Cifra la contraseña del certificado para guardarla en la base de datos.
 * Resultado: iv (12 bytes) + authTag (16 bytes) + texto cifrado, todo
 * concatenado en un solo Buffer.
 */
export function encryptCertPassword(password: string): Buffer {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

/**
 * Descifra la contraseña del certificado. Se usa solo en memoria, de forma
 * transitoria (para validar el certificado al subirlo, o para firmar un
 * documento en la fase de firma) -- el valor descifrado nunca se guarda ni
 * se registra en logs, y se descarta en cuanto termina de usarse.
 */
export function decryptCertPassword(encrypted: Buffer): string {
  const key = getEncryptionKey()
  const iv = encrypted.subarray(0, 12)
  const authTag = encrypted.subarray(12, 28)
  const ciphertext = encrypted.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

export type CertificateInfo = {
  validFrom: string   // YYYY-MM-DD (notBefore del certificado)
  validTo:   string   // YYYY-MM-DD (notAfter del certificado)
  subject:   string   // nombre del titular, solo informativo
}

/**
 * Abre el .p12/.pfx con la contraseña dada y extrae la vigencia real del
 * certificado. Lanza un Error con un mensaje claro y específico si la
 * contraseña es incorrecta, si la contraseña viene vacía, o si el archivo
 * no es un PKCS#12 válido -- para mostrar ese mensaje tal cual al usuario.
 */
export function readCertificateInfo(pfxBuffer: Buffer, password: string): CertificateInfo {
  if (!password) {
    throw new Error('La contraseña del certificado no puede estar vacía.')
  }

  let p12Asn1
  try {
    const der = forge.util.createBuffer(pfxBuffer.toString('binary'))
    p12Asn1 = forge.asn1.fromDer(der)
  } catch {
    throw new Error('El archivo no parece ser un certificado .p12/.pfx válido.')
  }

  let p12
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
  } catch {
    throw new Error('La contraseña del certificado es incorrecta.')
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBags = bags[forge.pki.oids.certBag]
  const cert = certBags?.[0]?.cert
  if (!cert) {
    throw new Error('El archivo .p12/.pfx no contiene ningún certificado legible.')
  }

  const toISODate = (d: Date) => d.toISOString().slice(0, 10)

  return {
    validFrom: toISODate(cert.validity.notBefore),
    validTo:   toISODate(cert.validity.notAfter),
    subject:   cert.subject.getField('CN')?.value ?? '(sin nombre)',
  }
}
