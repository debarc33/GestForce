import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { TOGGLEABLE_MODULES } from '@/config/modules'

const VALID_ACCESS_LEVELS = ['none', 'view', 'edit']
const VALID_MODULE_IDS = new Set(TOGGLEABLE_MODULES.map(m => m.id))

/**
 * PATCH /api/company/roles/[roleId]   body: { companyId, name?, permissions? }
 * Renombra el rol y/o actualiza sus permisos por módulo. Al menos uno
 * de los dos debe venir en el body.
 *
 * El rol "admin" (is_system) no se puede renombrar -- requireCompanyAdmin
 * (src/lib/auth/require-company-admin.ts) y el resto de las rutas de
 * usuarios siguen reconociendo ese nombre literal para decidir quién
 * administra la empresa. Si se permitiera renombrarlo, cualquier admin
 * actual quedaría sin poder administrar nada hasta corregirlo a mano
 * en la base de datos -- por eso queda bloqueado aquí.
 *
 * Al renombrar cualquier otro rol, se actualiza también el texto en
 * `company_users.role` de todos los que ya lo tenían asignado (esa
 * columna guarda el nombre, no un id) -- si no se hiciera, esos
 * usuarios quedarían con un rol que ya no existe con ese nombre.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const { roleId } = await params
    const { companyId, name, permissions } = await req.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }
    const trimmedName: string | null = typeof name === 'string' && name.trim() ? name.trim() : null
    const hasPermissions = Array.isArray(permissions) && permissions.length > 0

    if (trimmedName === null && !hasPermissions) {
      return NextResponse.json({ error: 'Debes indicar un nombre o permisos para actualizar' }, { status: 400 })
    }

    if (hasPermissions) {
      for (const p of permissions) {
        if (!VALID_MODULE_IDS.has(p?.module_id)) {
          return NextResponse.json({ error: `Módulo inválido: ${p?.module_id}` }, { status: 400 })
        }
        if (!VALID_ACCESS_LEVELS.includes(p?.access_level)) {
          return NextResponse.json({ error: `Nivel de acceso inválido: ${p?.access_level}` }, { status: 400 })
        }
      }
    }

    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    const { data: role, error: roleError } = await admin
      .from('company_roles')
      .select('id, name, is_system')
      .eq('id', roleId)
      .eq('company_id', companyId)
      .single()

    if (roleError || !role) {
      return NextResponse.json({ error: 'Rol no encontrado en esta empresa' }, { status: 404 })
    }

    if (trimmedName !== null) {
      if (role.is_system) {
        return NextResponse.json({ error: 'No puedes renombrar el rol Administrador.' }, { status: 400 })
      }

      const oldName = role.name

      const { error: updateError } = await admin
        .from('company_roles')
        .update({ name: trimmedName, updated_at: new Date().toISOString() })
        .eq('id', roleId)

      if (updateError) {
        if (updateError.code === '23505') {
          return NextResponse.json({ error: 'Ya existe un rol con ese nombre en esta empresa' }, { status: 409 })
        }
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      if (oldName !== trimmedName) {
        const { error: cascadeError } = await admin
          .from('company_users')
          .update({ role: trimmedName })
          .eq('company_id', companyId)
          .eq('role', oldName)

        if (cascadeError) {
          return NextResponse.json(
            { error: 'El rol se renombró, pero no se pudo actualizar a los usuarios que lo tenían asignado: ' + cascadeError.message },
            { status: 500 }
          )
        }
      }
    }

    if (hasPermissions) {
      const rows = permissions.map((p: { module_id: string; access_level: string }) => ({
        role_id: roleId,
        module_id: p.module_id,
        access_level: p.access_level,
        updated_at: new Date().toISOString(),
      }))

      const { error: permError } = await admin
        .from('company_role_permissions')
        .upsert(rows, { onConflict: 'role_id,module_id' })

      if (permError) {
        return NextResponse.json({ error: 'Error al guardar los permisos: ' + permError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en PATCH /api/company/roles/[roleId]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/company/roles/[roleId]?companyId=...
 * Elimina un rol personalizado. Bloqueado si es el rol "admin"
 * (is_system), o si todavía hay algún usuario de la empresa con ese
 * rol asignado (mismo patrón de seguridad que ya existe para no dejar
 * la empresa sin administrador: primero hay que reasignar a esas
 * personas a otro rol).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const { roleId } = await params
    const companyId = req.nextUrl.searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    const { data: role, error: roleError } = await admin
      .from('company_roles')
      .select('id, name, is_system')
      .eq('id', roleId)
      .eq('company_id', companyId)
      .single()

    if (roleError || !role) {
      return NextResponse.json({ error: 'Rol no encontrado en esta empresa' }, { status: 404 })
    }

    if (role.is_system) {
      return NextResponse.json({ error: 'No se puede eliminar el rol Administrador.' }, { status: 400 })
    }

    const { count, error: countError } = await admin
      .from('company_users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('role', role.name)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Hay ${count} usuario(s) con el rol "${role.name}". Asígnales otro rol antes de eliminar este.` },
        { status: 400 }
      )
    }

    const { error: deleteError } = await admin.from('company_roles').delete().eq('id', roleId)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/company/roles/[roleId]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
