'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * /auth/callback
 *
 * Destino de los links que envia Supabase Auth (inviteUserByEmail,
 * resetPasswordForEmail, confirmacion de registro, etc.).
 *
 * IMPORTANTE — por que esto es una PAGINA (cliente) y no una ruta de
 * servidor: en este proyecto de Supabase, los links de invitacion y
 * recuperacion vienen con la sesion YA LISTA en el FRAGMENTO de la URL
 * (`#access_token=...&refresh_token=...&type=invite`), no como `code`
 * (PKCE) ni como `token_hash` en la query string. El fragmento (todo lo
 * que va despues de `#`) NUNCA se envia al servidor — es visible solo
 * para JavaScript en el navegador. Una ruta de servidor (route.ts) jamas
 * puede leerlo, así que siempre caía al mismo error sin importar que tan
 * fresco estuviera el link. Por eso esto tiene que resolverse aqui, del
 * lado del cliente.
 *
 * Se dejan tambien los casos `token_hash`+`type` y `code` por si el
 * proyecto de Supabase cambia de configuracion en el futuro (u otro flujo
 * los llega a usar) — no hacen daño si nunca se disparan.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function handle() {
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const hashParams = new URLSearchParams(rawHash)
      const search = new URLSearchParams(window.location.search)

      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')
      const hashError = hashParams.get('error_description') || hashParams.get('error')

      // Caso 1 (el que realmente usa este proyecto): sesión ya lista en
      // el fragmento de la URL.
      if (accessToken && refreshToken) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!setErr) {
          const destino =
            hashType === 'invite' || hashType === 'recovery' ? '/auth/set-password' : '/select-company'
          router.replace(destino)
          return
        }
        console.error('[auth/callback] setSession fallo:', setErr)
      }

      // Caso 2: token_hash + type en la query (formato alternativo).
      const tokenHash = search.get('token_hash')
      const type = search.get('type')
      if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: type as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email',
          token_hash: tokenHash,
        })
        if (!otpError) {
          const destino = type === 'invite' || type === 'recovery' ? '/auth/set-password' : '/select-company'
          router.replace(destino)
          return
        }
      }

      // Caso 3: code (PKCE) en la query.
      const code = search.get('code')
      if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!codeError) {
          router.replace('/select-company')
          return
        }
      }

      setError(hashError || 'El link de invitación o recuperación es inválido o ya expiró.')
    }

    handle()
  }, [router])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-12 text-white flex items-center justify-center">
      <div className="text-center space-y-3 max-w-md">
        <p className="text-lg">{error ? error : 'Verificando tu acceso...'}</p>
        {error && (
          <a href="/login" className="text-sky-300 underline">
            Volver al inicio de sesión
          </a>
        )}
      </div>
    </main>
  )
}
