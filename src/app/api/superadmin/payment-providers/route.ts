import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const { data: providers, error } = await admin
      .from('payment_providers')
      .select('id, name, display_name, is_active, webhook_url, webhook_secret, config, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(providers ?? [])
  } catch (error) {
    console.error('Get payment providers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment providers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { name, display_name, is_active, webhook_url, webhook_secret, config } = body

    const admin = createAdminClient()
    const { data: provider, error } = await admin
      .from('payment_providers')
      .insert({
        name,
        display_name,
        is_active,
        webhook_url,
        webhook_secret,
        config: config || {},
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(provider, { status: 201 })
  } catch (error) {
    console.error('Create payment provider error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment provider' },
      { status: 500 }
    )
  }
}
