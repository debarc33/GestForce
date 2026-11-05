import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyMember } from '@/lib/auth/require-company-member'

export const runtime = 'nodejs'

/**
 * GET /api/company/fe-status?companyId=...
 *
 * Fase C de claude/plan-accion-facturacion-dian.md: desde la Fase A,
 * `fe_technical_key` ya no se trae al navegador, así que el cliente no puede
 * saber por sí mismo si la Facturación Electrónica está realmente completa
 * (ID de Software + Llave Técnica) -- solo si hay un ID de Software. Esta
 * ruta hace esa verificación completa del lado del servidor y devuelve
 * únicamente un booleano, nunca los valores.
 */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
  }

  const check = await requireCompanyMember(companyId)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .select('fe_software_id, fe_technical_key')
    .eq('id', companyId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    configured: !!(data.fe_software_id && data.fe_technical_key),
  })
}
