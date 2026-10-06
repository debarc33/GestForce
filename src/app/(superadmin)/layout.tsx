import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SuperadminNav } from '@/components/superadmin/superadmin-nav'
import { BackgroundLayer } from '@/components/ui/background-layer'

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
    <div className="relative min-h-screen" style={{ background: 'var(--app-bg)' }}>
      {/* Mismo fondo con degradados que el ERP de cliente, para que el panel
          de superadmin se sienta parte de la misma aplicación. */}
      <BackgroundLayer />
      <div className="relative z-[1] text-foreground">
        <SuperadminNav />
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
