import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { DocumentPdf, type PdfDocData } from '@/lib/pdf/document-pdf'

const resend = new Resend(process.env.RESEND_API_KEY)

const fmt = (n: number) => '$' + Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : ''

/**
 * Envía una cotización/factura (o nota) por correo al cliente, generando
 * el PDF en el servidor y adjuntándolo directamente — reemplaza el flujo
 * anterior basado en mailto: desde el navegador, que:
 *   (a) dependía de que cada usuario tuviera un cliente de correo
 *       configurado como predeterminado en su navegador/equipo (si no, el
 *       botón "Enviar" simplemente no hacía nada visible), y
 *   (b) no podía adjuntar el PDF automáticamente — había que descargarlo
 *       aparte con "Imprimir / PDF" y adjuntarlo a mano en el borrador.
 * Con Resend, el correo sale directo desde el servidor de GestForce con
 * el PDF ya adjunto, sin depender de nada en la máquina del usuario.
 */
export async function sendDocumentEmail(doc: PdfDocData) {
  if (!doc.customer?.email) {
    throw new Error('Este cliente no tiene un correo registrado.')
  }

  const companyName = doc.company?.name ?? 'GestForce'
  const docTypeLabel =
    doc.type === 'quote'       ? 'Cotización' :
    doc.type === 'credit_note' ? 'Nota crédito' :
    doc.type === 'debit_note'  ? 'Nota débito' :
                                  'Factura'

  const pdfBuffer = await renderToBuffer(DocumentPdf({ doc }) as Parameters<typeof renderToBuffer>[0])

  const subject = `${docTypeLabel} ${doc.number} — ${companyName}`

  const introLine = doc.type === 'quote'
    ? `Te comparto la cotización <strong>${doc.number}</strong> por valor de <strong>${fmt(doc.total)}</strong>.` +
      (doc.expiry_date
        ? ` Esta cotización es válida hasta el ${fmtDate(doc.expiry_date)}.`
        : ' Esta cotización es válida por 30 días.')
    : `Te comparto la ${docTypeLabel.toLowerCase()} <strong>${doc.number}</strong> por valor de <strong>${fmt(doc.total)}</strong>.`

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0;">
        <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
          <p>Estimado/a ${doc.customer?.name ?? 'cliente'},</p>
          <p>${introLine}</p>
          <p>Adjunto encontrarás el documento en PDF.</p>
          <p>Quedo atento/a a cualquier consulta.</p>
          <p style="margin-top: 24px;">Saludos cordiales,<br>${companyName}</p>
        </div>
      </body>
    </html>
  `

  return resend.emails.send({
    from: process.env.SENDER_EMAIL || 'noreply@gestforce.com',
    to: doc.customer.email,
    subject,
    html,
    attachments: [
      {
        filename: `${doc.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })
}
