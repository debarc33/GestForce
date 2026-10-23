import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { countCompanyAdmins } from '@/lib/auth/company-admin-guard'

const VALID_ROLES = ['admin', 'contador', 'vendedor', 'readonly']

/**
 * PATCH /api/company/users/[userId]  body: { companyId, role?, name? }
 * Cambia el rol y/o el nombre de un miembro de la empresa (al menos uno
 * de los dos debe venir en el body).
 *
 * El cambio de nombre (22 oct 2026) se agregó para poder editar el
 * nombre de colaboradores que ya habían sido invitados antes de que el
 * formulario de invitación empezara a pedirlo -- esos quedaban
 * mostrando "Sin nombre" en la tabla de Equipo sin forma de arreglarlo.
 * Actualiza `user_metadata.first_name` en Supabase Auth (mismo campo
 * que usa /invite al crear la cuenta), sin tocar el resto del
 * user_metadata que ya tuviera la persona.
 *
 * BUG ENCONTRADO (16 oct 2026, probando en vivo Configuración → Equipo):
 * el selector de rol de cada usuario llamaba a updateUserRole(), que
 * hacía el UPDATE directo contra company_users desde el cliente del
 * navegador (ver queries.ts). Esa tabla nunca tuvo una política RLS de
 * UPDATE — igual que pasó con expenses (migración 027) y payroll_items
 * (migración 028), es una tabla creada a mano en el origen del proyecto
 * y solo tiene la política de SELECT agregada después (migraciones 012
 * y 013). Sin política de UPDATE, el UPDATE no daba error: con RLS
 * activado, simplemente no afectaba ninguna fila (0 rows), y el
 * .select().single() posterior fallaba — pero updateRoleMutation en
 * users-table.tsx no tenía onError, así que el fallo quedaba
 * completamente silencioso. El selector mostraba el rol nuevo al
 * instante (estado local optimista) pero, al recargar la página, volvía
 * a mostrar el rol real (que nunca había cambiado en la base de datos).
 * Confirmado en vivo consultando /api/company/users después del cambio.
 *
 * FIX: en vez de solo agregar una política RLS abierta a company_users
 * (lo que permitiría que CUALQUIER miembro de la empresa, incluido un
 * "vendedor", cambiara roles ajenos o se autoasignara "admin" llamando
 * al cliente de Supabase directo desde la consola del navegador — un
 * hueco de seguridad real), este endpoint sigue el mismo patrón ya
 * usado para invitar usuarios (/api/company/users/invite): valida con
 * requireCompanyAdmin() que quien llama sea admin de ESTA empresa, y
 * solo entonces usa el admin client (que sí bypasea RLS) para escribir.
 * RLS en company_users se deja tal cual (sin política de escritura),
 * lo cual ahora es correcto: ningún cliente debe poder escribir ahí
 * directo, todo pasa por esta ruta con su propio chequeo de permisos.
 *
 * También se bloquea dejar la empresa sin ningún admin: si el usuario
 * que se está degradando es el único admin actual, se rechaza el
 * cambio (misma regla que ya existía para invitar, en
 * checkCanAddUserWithRole, extendida aquí a "editar rol existente").
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { companyId, role, name } = await req.json()
    const trimmedName: string | null = typeof name === 'string' && name.trim() ? name.trim() : null

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }
    if (!role && trimmedName === null) {
      return NextResponse.json({ error: 'Debes indicar un rol o un nombre para actualizar' }, { status: 400 })
    }
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    const { data: target, error: targetError } = await admin
      .from('company_users')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    let updatedRow: typeof target & Record<string, unknown> = target

    if (role) {
      // No dejar la empresa sin ningún admin: si este usuario es admin y
      // se le está quitando ese rol, y es el único admin, se bloquea.
      if (target.role === 'admin' && role !== 'admin') {
        const adminCount = await countCompanyAdmins(admin, companyId)
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'No puedes quitarle el rol de administrador: es el único admin de esta empresa. Asigna primero el rol de administrador a otra persona.' },
            { status: 400 }
          )
        }
      }

      const { data, error } = await admin
        .from('company_users')
        .update({ role })
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      updatedRow = data
    }

    if (trimmedName !== null) {
      const { data: existingUser } = await admin.auth.admin.getUserById(userId)
      const { error: nameError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: { ...(existingUser?.user?.user_metadata ?? {}), first_name: trimmedName },
      })
      if (nameError) {
        return NextResponse.json({ error: 'No se pudo actualizar el nombre: ' + nameError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ...updatedRow, user_name: trimmedName ?? undefined })
  } catch (error) {
    console.error('Error en PATCH /api/company/users/[userId]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/company/users/[userId]?companyId=...
 * Elimina a un usuario de la empresa. Mismo patrón y misma protección
 * de "no dejar la empresa sin admin" que PATCH arriba — antes esto
 * también hacía el DELETE directo desde el cliente (removeUserFromCompany
 * en queries.ts) y fallaba silenciosamente por la misma falta de
 * política RLS.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const companyId = req.nextUrl.searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    const { data: target, error: targetError } = await admin
      .from('company_users')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    if (target.role === 'admin') {
      const adminCount = await countCompanyAdmins(admin, companyId)
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'No puedes eliminar a este usuario: es el único administrador de esta empresa. Asigna primero el rol de administrador a otra persona.' },
          { status: 400 }
        )
      }
    }

    const { error } = await admin
      .from('company_users')
      .delete()
      .eq('company_id', companyId)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/company/users/[userId]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
