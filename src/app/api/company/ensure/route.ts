import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
  }

  // Buscar las empresas del usuario en company_users
  const { data: companyUsers, error } = await supabase
    .from('company_users')
    .select(`
      company_id,
      role,
      companies (
        id,
        name
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!companyUsers || companyUsers.length === 0) {
    return NextResponse.json(
      {
        error: 'No perteneces a ninguna empresa. Contacta al administrador.',
      },
      { status: 404 }
    )
  }

  // Si hay múltiples empresas, devolver la primera por ahora
  const firstCompanyUser = companyUsers[0]
  // El join de Supabase retorna el objeto anidado como array en los tipos generados;
  // en runtime es un objeto único gracias a la FK de company_id → companies
  const companyRaw = firstCompanyUser.companies
  const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as
    | { id: string; name: string }
    | null

  if (!company) {
    return NextResponse.json(
      { error: 'Empresa no encontrada.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    companyId: company.id,
    companyName: company.name,
    role: firstCompanyUser.role,
    totalCompanies: companyUsers.length
  })
}
