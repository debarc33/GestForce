import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/company/subscription/fe-services?companyId=...
 *
 * Fase 2 de la nueva oferta de Facturación Electrónica (9 nov 2026, ver
 * claude/plan-accion-facturacion-dian.md Fase H): catálogo de los ítems
 * ACTIVOS (fe_services_catalog, migración 037) para la pantalla de
 * Suscripción del cliente. Mismo patrón que
 * /api/company/subscription/pricing -- cualquier miembro de la empresa
 * puede leerlo (es solo informativo), la tabla tiene RLS solo-superadmin
 * así que se lee con el admin client después de validar membresía aquí.
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    const auth = await requireCompanyMember(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = createAdminClient()
    const [{ data, error }, { data: contactRow }] = await Promise.all([
      admin
        .from('fe_services_catalog')
        .select('item_id, category, label, description, billing_type, price, quantity, self_checkout')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      // Datos de contacto (migración 040) para el botón "Contáctanos" de
      // los ítems sin pago en línea. Si la fila no existe todavía
      // (proyecto sin migrar), se devuelve null y el cliente no muestra
      // nada roto -- solo no aparece el panel de contacto.
      admin
        .from('fe_contact_info')
        .select('phone_1, phone_2, email')
        .eq('id', 1)
        .maybeSingle(),
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data ?? [], contact: contactRow ?? null })
  } catch (error) {
    console.error('FE services catalog error:', error)
    return NextResponse.json({ error: 'Error al cargar el catálogo' }, { status: 500 })
  }
}
