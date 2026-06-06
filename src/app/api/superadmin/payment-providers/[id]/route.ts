import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  try {
    const admin = createAdminClient()

    // Si se activa este proveedor, desactivar los demás
    if (body.is_active === true) {
      await admin
        .from('payment_providers')
        .update({ is_active: false })
        .neq('id', id)
    }

    const { data: provider, error } = await admin
      .from('payment_providers')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(provider)
  } catch (error) {
    console.error('Update payment provider error:', error)
    return NextResponse.json(
      { error: 'Failed to update payment provider' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('payment_providers')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete payment provider error:', error)
    return NextResponse.json(
      { error: 'Failed to delete payment provider' },
      { status: 500 }
    )
  }
}
