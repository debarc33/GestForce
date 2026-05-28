/**
 * CLIENTE SUPABASE CON SERVICE ROLE — Solo servidor
 *
 * ⚠️  IMPORTANTE: Este archivo NUNCA debe importarse en componentes cliente.
 *     Solo usar en API Routes y Server Components del superadmin.
 *
 * NOTA SOBRE TIPOS: El cliente admin no usa el generic <Database> porque
 * el service role bypasea RLS y no necesita la inferencia de tipos del SDK.
 * Los tipos se definen explícitamente en src/types/superadmin.ts
 */

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
      'Revisa tu archivo .env.local.'
    )
  }

  // Sin generic <Database> — el admin client usa tipos explícitos en cada query
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
