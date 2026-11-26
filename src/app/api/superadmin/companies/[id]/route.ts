import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SACompany } from '@/types/superadmin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// ── GET /api/superadmin/companies/[id] ────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: company, error } = await admin
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  // Seguridad (hallazgo Fase D.1, endurecido 26 nov 2026): fe_software_pin y
  // fe_technical_key son secretos de facturacion electronica (se usan para
  // calcular CUFE/CUDE/SoftwareSecurityCode) -- este panel de superadmin
  // nunca los lee ni los muestra (no hay ningun campo en la UI para ellos),
  // asi que no hay razon para que salgan en la respuesta JSON. Mismo
  // criterio que ya se aplico del lado del cliente en modules/company/queries.ts
  // (Fase A, 4 nov 2026) -- ver claude/informe-auditoria-facturacion-dian.md, Seccion 7.
  const { fe_software_pin: _pin, fe_technical_key: _key, ...safeCompany } = company
  return NextResponse.json(safeCompany as unknown as SACompany)
}

// ── PATCH /api/superadmin/companies/[id] ──────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as Partial<Omit<SACompany, 'id' | 'created_at'>>
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('companies')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Mismo criterio de seguridad que en GET arriba -- no hay necesidad de que
  // estos dos secretos viajen de vuelta al navegador tras actualizar.
  const { fe_software_pin: _pin, fe_technical_key: _key, ...safeData } = data
  return NextResponse.json(safeData as unknown as SACompany)
}
