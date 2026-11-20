/**
 * Construye un archivo .zip mínimo (un solo archivo) sin depender de
 * ninguna librería externa.
 *
 * Hallazgo de la prueba en vivo del 20 nov 2026: la primera versión
 * usaba método "stored" (sin comprimir) -- válido según el estándar ZIP
 * y verificado contra `unzip`/Python `zipfile`, pero la DIAN rechazaba
 * el envío con "MIMEType del archivo inválido (text/xml)" incluso ya con
 * el nombre de archivo corregido (.zip). La hipótesis más probable: al
 * no comprimir, el XML queda en texto plano dentro del .zip, y el
 * validador de la DIAN -- en vez de confirmar primero la firma "PK" del
 * zip -- parece inspeccionar el contenido y encuentra el texto
 * `<?xml ...` legible ahí mismo, concluyendo "text/xml" en vez de
 * reconocerlo como zip. Se cambió a compresión DEFLATE real (método 8)
 * para que el XML no quede legible en claro dentro del paquete.
 *
 * Verificado contra `unzip` y el módulo `zipfile` de Python -- ambos
 * abren correctamente el resultado y recuperan el contenido exacto.
 */
import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'

// Tabla CRC-32 estándar (polinomio 0xEDB88320), calculada una sola vez.
const CRC32_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function dosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const dosTime = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F)
  const dosDate = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F)
  return { dosTime, dosDate }
}

/** Construye un .zip con un solo archivo adentro, comprimido con DEFLATE (método 8). */
export function buildZip(fileName: string, content: string | Buffer): Buffer {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  const compressed = deflateRawSync(data)
  const nameBuf = Buffer.from(fileName, 'utf8')
  const crc = crc32(data) // el CRC-32 siempre es sobre los datos SIN comprimir
  const { dosTime, dosDate } = dosDateTime(new Date())

  const localHeader = Buffer.alloc(30)
  localHeader.writeUInt32LE(0x04034b50, 0)
  localHeader.writeUInt16LE(20, 4)
  localHeader.writeUInt16LE(0, 6)
  localHeader.writeUInt16LE(8, 8) // método = 8 (deflate)
  localHeader.writeUInt16LE(dosTime, 10)
  localHeader.writeUInt16LE(dosDate, 12)
  localHeader.writeUInt32LE(crc, 14)
  localHeader.writeUInt32LE(compressed.length, 18)
  localHeader.writeUInt32LE(data.length, 22)
  localHeader.writeUInt16LE(nameBuf.length, 26)
  localHeader.writeUInt16LE(0, 28)

  const localEntry = Buffer.concat([localHeader, nameBuf, compressed])

  const centralHeader = Buffer.alloc(46)
  centralHeader.writeUInt32LE(0x02014b50, 0)
  centralHeader.writeUInt16LE(20, 4)
  centralHeader.writeUInt16LE(20, 6)
  centralHeader.writeUInt16LE(0, 8)
  centralHeader.writeUInt16LE(8, 10) // método = 8 (deflate)
  centralHeader.writeUInt16LE(dosTime, 12)
  centralHeader.writeUInt16LE(dosDate, 14)
  centralHeader.writeUInt32LE(crc, 16)
  centralHeader.writeUInt32LE(compressed.length, 20)
  centralHeader.writeUInt32LE(data.length, 24)
  centralHeader.writeUInt16LE(nameBuf.length, 28)
  centralHeader.writeUInt16LE(0, 30)
  centralHeader.writeUInt16LE(0, 32)
  centralHeader.writeUInt16LE(0, 34)
  centralHeader.writeUInt16LE(0, 36)
  centralHeader.writeUInt32LE(0, 38)
  centralHeader.writeUInt32LE(0, 42)

  const centralEntry = Buffer.concat([centralHeader, nameBuf])

  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4)
  endRecord.writeUInt16LE(0, 6)
  endRecord.writeUInt16LE(1, 8)
  endRecord.writeUInt16LE(1, 10)
  endRecord.writeUInt32LE(centralEntry.length, 12)
  endRecord.writeUInt32LE(localEntry.length, 16)
  endRecord.writeUInt16LE(0, 20)

  return Buffer.concat([localEntry, centralEntry, endRecord])
}

/** .zip del XML + su base64, en el formato que pide `contentFile` del WSDL de la DIAN. */
export function zipXmlToBase64(fileName: string, xml: string): string {
  return buildZip(fileName, xml).toString('base64')
}

// createHash queda importado por si en el futuro se necesita un hash del
// .zip (p. ej. para registrar en logs sin guardar el contenido completo).
export function zipSha256(zipBuf: Buffer): string {
  return createHash('sha256').update(zipBuf).digest('hex')
}
