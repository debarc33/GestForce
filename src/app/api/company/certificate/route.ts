import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { encryptCertPassword, readCertificateInfo } from '@/lib/fe/certificate'

export const runtime = 'nodejs'

/**
 * Sube o reemplaza el certificado digital (.p12/.pfx) de una empresa.
 * Fase D del plan de facturación electrónica -- ver
 * claude/plan-accion-facturacion-dian.md.
 *
 * Valida que el archivo realmente abra con la contraseña dada (y por lo
 * tanto que sea un PKCS#12 correcto) ANTES de guardar nada. La contraseña
 * nunca se guarda en texto plano: se cifra con AES-256-GCM (ver
 * src/lib/fe/certificate.ts) y solo se usa en memoria, de forma
 * transitoria, durante esta validación.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      companyId?: string
      fileBase64?: string
      fileName?: string
      password?: string
    } | null

    const { companyId, fileBase64, fileName, password } = body ?? {}

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }
    if (!fileBase64) {
      return NextResponse.json({ error: 'El archivo del certificado es requerido' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'La contraseña del certificado no puede estar vacía' }, { status: 400 })
    }

    const check = await requireCompanyMember(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    let pfxBuffer: Buffer
    try {
      pfxBuffer = Buffer.from(fileBase64, 'base64')
    } catch {
      return NextResponse.json({ error: 'El archivo del certificado no es válido' }, { status: 400 })
    }
    if (pfxBuffer.length === 0) {
      return NextResponse.json({ error: 'El archivo del certificado está vacío' }, { status: 400 })
    }

    // Validación real: intenta abrir el .p12/.pfx con la contraseña dada.
    // Si la contraseña es incorrecta o el archivo no es un PKCS#12 válido,
    // readCertificateInfo lanza un Error con un mensaje claro y específico.
    let info
    try {
      info = readCertificateInfo(pfxBuffer, password)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo leer el certificado'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Contraseña cifrada -- nunca en texto plano. El valor sin cifrar
    // (`password`) deja de usarse de aquí en adelante en esta función.
    const encryptedPassword = encryptCertPassword(password)

    const admin = createAdminClient()

    const { error: certError } = await admin
      .from('company_certificates')
      .upsert({
        company_id: companyId,
        pfx_data_base64: pfxBuffer.toString('base64'),
        pfx_password_encrypted_base64: encryptedPassword.toString('base64'),
        updated_at: new Date().toISOString(),
      })
    if (certError) {
      console.error('Error guardando certificado:', certError)
      return NextResponse.json({ error: 'No se pudo guardar el certificado' }, { status: 500 })
    }

    const { error: companyError } = await admin
      .from('companies')
      .update({
        fe_cert_filename: fileName ?? null,
        fe_cert_valid_from: info.validFrom,
        fe_cert_valid_to: info.validTo,
        fe_cert_uploaded_at: new Date().toISOString(),
      })
      .eq('id', companyId)
    if (companyError) {
      console.error('Error actualizando metadatos del certificado:', companyError)
      return NextResponse.json(
        { error: 'El certificado se guardó pero no se pudo actualizar la vigencia' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      validFrom: info.validFrom,
      validTo: info.validTo,
      subject: info.subject,
    })
  } catch (e) {
    console.error('Error subiendo certificado:', e)
    const message = e instanceof Error ? e.message : 'Error subiendo el certificado'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
