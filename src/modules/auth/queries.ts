import { createClient } from '@/lib/supabase/client'

export async function getUserCompanies() {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('No autenticado')

  const { data: memberships, error: membershipError } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', user.id)

  if (membershipError) throw new Error(membershipError.message)
  if (!memberships || memberships.length === 0) return []

  const companyIds = memberships.map((m) => m.company_id)

  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', companyIds)

  if (companiesError) throw new Error(companiesError.message)

  return memberships.map((m) => ({
    company_id: m.company_id as string,
    role: m.role as string,
    companies: (companies ?? []).find((c) => c.id === m.company_id) ?? { id: m.company_id, name: '' },
  }))
}
