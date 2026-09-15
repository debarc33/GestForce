import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetPasswordForm } from '@/modules/auth/components/set-password-form'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Esta pagina solo tiene sentido con una sesion ya creada por
  // /auth/callback (invitacion o recuperacion). Sin sesion, no hay nada
  // que hacer aqui.
  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-12 text-white flex items-center justify-center">
      <SetPasswordForm />
    </main>
  )
}
