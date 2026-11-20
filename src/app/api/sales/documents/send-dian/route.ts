import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { decryptCertPassword } from '@/lib/fe/certificate'
import { sendTestSetAsync, sendBillSync, getStatus, type DianResponse, type UploadDocumentResponse } from '@/lib/fe/dian-client'

type AdminClient = ReturnType<typeof createAdminClient>

export const runtime = 'nodejs'

/**
 * POST /api/sales/documents/send-dian
 * body: { invoiceId: string } | { noteId: string }, + { checkStatus?: true }
 *
 * Fase E de claude/plan-accion-facturacion-dian.md: transmite el XML ya
 * firmado (fe_xml_signed, migración 043) al servicio web de la DIAN --
 * `SendTestSetAsync` si la empresa está en Habilitación (fe_test_mode),
 * `SendBillSync` si está en Producción. El resultado (o el error) se
 * guarda en fe_track_id/fe_dian_status/fe_dian_response/fe_sent_at
 * (migración 044).
 *
 * Con `checkStatus: true` en vez de enviar, consulta el estado de un
 * envío asíncrono anterior (Habilitación) usando el fe_track_id ya
 * guardado -- para cuando SendTestSetAsync no responde el resultado al
 * instante.
 *
 * ⚠ Esta ruta hace una llamada real al servicio de la DIAN -- no se ha
 * podido probar en vivo todavía (ver advertencias en dian-client.ts).
 * Por eso NO se dispara automáticamente desde ningún otro flujo: es una
 * acción explícita, para usarla solo cuando Deisy esté lista para probar
 * con el certificado y la cuenta DIAN reales de la clienta.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as
      { invoiceId?: string; noteId?: string; checkStatus?: boolean } | null
    const invoiceId = body?.invoiceId
    const noteId = body?.noteId
    const checkStatus = body?.checkStatus === true

    if (!invoiceId && !noteId) {
      return NextResponse.json({ error: 'invoiceId o noteId es requerido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const table = noteId ? 'credit_debit_notes' : 'invoices'
    const docId = noteId ?? invoiceId!

    const { data: doc, error: docError } = await admin.from(table).select('*').eq('id', docId).single()
    if (docError || !doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const check = await requireCompanyMember(doc.company_id)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const { data: company, error: companyError } = await admin
      .from('companies').select('*').eq('id', doc.company_id).single()
    if (companyError || !company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    if (!company.fe_api_url) {
      return NextResponse.json({ error: 'Esta empresa no tiene configurada la URL del servicio web de la DIAN (Configuración → Resolución DIAN).' }, { status: 400 })
    }

    const { data: certRow } = await admin
      .from('company_certificates')
      .select('pfx_data_base64, pfx_password_encrypted_base64')
      .eq('company_id', doc.company_id)
      .maybeSingle()
    if (!certRow?.pfx_data_base64 || !certRow?.pfx_password_encrypted_base64) {
      return NextResponse.json({ error: 'Esta empresa todavía no tiene un certificado digital cargado.' }, { status: 400 })
    }
    const pfxBuffer = Buffer.from(certRow.pfx_data_base64, 'base64')
    const pfxPassword = decryptCertPassword(Buffer.from(certRow.pfx_password_encrypted_base64, 'base64'))

    const isHabilitacion = company.fe_test_mode !== false

    // --- Consultar estado de un envío asíncrono anterior ---
    if (checkStatus) {
      if (!doc.fe_track_id) {
        return NextResponse.json({ error: 'Este documento no tiene un envío asíncrono pendiente de consultar.' }, { status: 400 })
      }
      const statusResult = await getStatus({
        apiUrl: company.fe_api_url, pfxBuffer, pfxPassword, trackId: doc.fe_track_id,
      })
      const { status, responseJson } = interpretStatusResult(statusResult)
      await admin.from(table).update({
        fe_dian_status: status, fe_dian_response: responseJson, fe_sent_at: new Date().toISOString(),
      }).eq('id', docId)
      return NextResponse.json({ status, response: responseJson })
    }

    // --- Envío nuevo ---
    if (!doc.xml_ubl || !doc.fe_xml_signed) {
      return NextResponse.json({ error: 'Primero genera el XML firmado (botón "XML DIAN") antes de enviarlo.' }, { status: 400 })
    }

    const nitOFE = (company.nit ?? '').replace(/[^0-9]/g, '')
    const docNumber = (noteId ? doc.note_number : doc.invoice_number) ?? docId
    // Convención de nombre de archivo: best-effort (NIT + número de
    // documento) -- no se pudo confirmar contra el Anexo Técnico oficial
    // el formato exacto que exige la DIAN para este nombre.
    const fileName = `${nitOFE}${String(docNumber).replace(/[^0-9A-Za-z-]/g, '')}.xml`

    let sendResult: { ok: boolean; result?: UploadDocumentResponse | DianResponse; fault?: { code: string | null; reason: string | null } }

    if (isHabilitacion) {
      if (!company.fe_test_set_id) {
        return NextResponse.json({ error: 'Esta empresa no tiene guardado el TestSetId que entrega la DIAN (Configuración → Resolución DIAN).' }, { status: 400 })
      }
      sendResult = await sendTestSetAsync({
        apiUrl: company.fe_api_url, pfxBuffer, pfxPassword,
        fileName, signedXml: doc.xml_ubl, testSetId: company.fe_test_set_id,
      })
    } else {
      sendResult = await sendBillSync({
        apiUrl: company.fe_api_url, pfxBuffer, pfxPassword,
        fileName, signedXml: doc.xml_ubl,
      })
    }

    const { status, responseJson } = interpretSendResult(sendResult, isHabilitacion)
    const trackId = isHabilitacion && sendResult.ok ? (sendResult.result as UploadDocumentResponse).zipKey : null

    await admin.from(table).update({
      fe_dian_status: status,
      fe_dian_response: responseJson,
      fe_track_id: trackId,
      fe_sent_at: new Date().toISOString(),
    }).eq('id', docId)

    return NextResponse.json({ status, trackId, response: responseJson })
  } catch (e) {
    console.error('Error enviando a la DIAN:', e)
    const message = e instanceof Error ? e.message : 'Error enviando el documento a la DIAN'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function interpretSendResult(
  r: { ok: boolean; result?: UploadDocumentResponse | DianResponse; fault?: { code: string | null; reason: string | null } },
  isHabilitacion: boolean,
): { status: string; responseJson: unknown } {
  if (!r.ok) return { status: 'error', responseJson: r.fault }
  if (isHabilitacion) {
    // Hallazgo de la prueba en vivo del 20 nov 2026: antes se asumía
    // "enviado" con que no hubiera Fault SOAP, pero la DIAN puede
    // rechazar de inmediato (p. ej. MIMEType inválido) dentro de
    // errorMessageList sin que eso sea un Fault SOAP -- hay que revisar
    // ese campo para no mostrar "enviado" cuando en realidad fue un
    // rechazo inmediato.
    const upload = r.result as UploadDocumentResponse
    const rejected = upload.errorMessageList?.some((m) => m.success === false)
    return { status: rejected ? 'rechazado' : 'enviado', responseJson: upload } // si no rechazó de inmediato, sigue pendiente -- falta consultar GetStatus
  }
  const dianResponse = r.result as DianResponse
  return { status: dianResponse.isValid ? 'aceptado' : 'rechazado', responseJson: dianResponse }
}

// statusCode "66" ("TrackId no existe en los registros de la DIAN") significa que la
// DIAN todavia no indexo el trackId -- es una condicion transitoria de "aun no disponible",
// NO un rechazo real por contenido. Un rechazo real trae isValid:false con un
// errorMessage/statusDescription que explica el problema del documento. Hay que separar
// ambos casos; de lo contrario se le muestra "Rechazado" al usuario cuando en realidad
// solo hay que esperar y volver a consultar.
const TRACK_ID_NOT_FOUND_STATUS_CODE = '66'

function interpretStatusResult(
  r: { ok: boolean; result?: DianResponse; fault?: { code: string | null; reason: string | null } },
): { status: string; responseJson: unknown } {
  if (!r.ok) return { status: 'error', responseJson: r.fault }
  const dianResponse = r.result as DianResponse
  if (dianResponse.statusCode === TRACK_ID_NOT_FOUND_STATUS_CODE) {
    return { status: 'pendiente', responseJson: dianResponse }
  }
  return { status: dianResponse.isValid ? 'aceptado' : 'rechazado', responseJson: dianResponse }
}
