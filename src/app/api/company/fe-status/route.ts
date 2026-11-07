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
 * únicamente booleanos, nunca los valores.
 *
 * Hallazgo 7 nov 2026: `configured` (ID de Software + Llave Técnica) es lo
 * que necesitan las FACTURAS (CUFE), pero las notas crédito/débito (Fase G)
 * usan un secreto aparte, `fe_software_pin` (CUDE) -- antes esta ruta no lo
 * consultaba, y en Configuración > Facturación Electrónica el campo "PIN"
 * mostraba "••••••••" (configurado) con solo mirar `configured`, aunque el
 * PIN en sí nunca se hubiera guardado. Ahora se devuelve `pinConfigured`
 * aparte para que esa pantalla no mienta sobre si el PIN está puesto.
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
    .select('fe_software_id, fe_technical_key, fe_software_pin')
    .eq('id', companyId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    configured:    !!(data.fe_software_id && data.fe_technical_key),
    pinConfigured: !!(data.fe_software_id && data.fe_software_pin),
  })
}
