import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

type ContactInfo = {
  phone_1: string | null
  phone_2: string | null
  email: string | null
}

/**
 * GET /api/superadmin/fe-services/contact
 *
 * Datos de contacto (migración 040) que se muestran al cliente cuando
 * toca "Contáctanos para contratar" en un ítem del catálogo de
 * Facturación Electrónica sin pago en línea. Fila única (id=1, sembrada
 * por la migración), igual patrón que invoice_pack_settings.
 */
export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('fe_contact_info')
    .select('phone_1, phone_2, email')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    contact: (data ?? { phone_1: null, phone_2: null, email: null }) as ContactInfo,
  })
}

/**
 * PUT /api/superadmin/fe-services/contact
 * Body: { phone_1, phone_2, email } (los tres opcionales/nulos)
 */
export async function PUT(request: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as Partial<ContactInfo> | null
  if (!body) {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('fe_contact_info')
    .update({
      phone_1: body.phone_1 || null,
      phone_2: body.phone_2 || null,
      email: body.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
