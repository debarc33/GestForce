import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { TOGGLEABLE_MODULES } from '@/config/modules'

/**
 * POST /api/company/roles   body: { companyId, name }
 * Crea un rol nuevo (personalizado) para la empresa.
 *
 * Arranca con 'none' (sin acceso) en todos los módulos activos de la
 * empresa -- a diferencia de los 4 roles de siempre (que al sembrarse
 * en la migración 032 quedaron en 'edit' para no restringir nada de
 * golpe), un rol recién creado no corresponde a ningún usuario
 * existente todavía, así que no hay riesgo de bloquear a nadie por
 * sorpresa: el administrador asigna los permisos después, desde
 * Configuración → Roles y permisos.
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, name } = await req.json()

    if (!companyId || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'companyId y name son requeridos' }, { status: 400 })
    }
    const trimmedName = name.trim()
    if (trimmedName.length > 60) {
      return NextResponse.json({ error: 'El nombre del rol es demasiado largo' }, { status: 400 })
    }

    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    const { data: role, error: roleError } = await admin
      .from('company_roles')
      .insert([{ company_id: companyId, name: trimmedName, is_system: false }])
      .select()
      .single()

    if (roleError) {
      // Violación de UNIQUE(company_id, name) -> ya existe un rol con ese nombre
      if (roleError.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un rol con ese nombre en esta empresa' }, { status: 409 })
      }
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    const permRows = TOGGLEABLE_MODULES.map(m => ({
      role_id: role.id,
      module_id: m.id,
      access_level: 'none' as const,
    }))

    const { error: permError } = await admin.from('company_role_permissions').insert(permRows)
    if (permError) {
      // No dejar un rol sin ninguna fila de permisos -- revertir su creación.
      await admin.from('company_roles').delete().eq('id', role.id)
      return NextResponse.json({ error: 'Error al crear los permisos del rol: ' + permError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, role })
  } catch (error) {
    console.error('Error en POST /api/company/roles:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
