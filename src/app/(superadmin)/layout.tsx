import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SuperadminNav } from '@/components/superadmin/superadmin-nav'

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Defensa en profundidad: el middleware ya bloqueó, pero verificamos de nuevo
  if (!user || user.app_metadata?.is_superadmin !== true) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <SuperadminNav />
      <main className="p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
