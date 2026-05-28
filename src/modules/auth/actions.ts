'use server'

/**
 * NOTA: Este archivo no está siendo usado actualmente.
 * El formulario de login maneja la autenticación completamente en el cliente
 * (src/modules/auth/components/login-form.tsx).
 *
 * Se mantiene aquí en caso de necesitar una acción de servidor en el futuro.
 * Si se reactiva, el redirect debe ir a '/select-company', NO a '/'.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { LoginFormData } from './schemas'

export async function loginAction(data: LoginFormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (error) {
    return { error: 'Credenciales incorrectas' }
  }

  revalidatePath('/', 'layout')
  redirect('/select-company') // ← Corregido: era '/' (incorrecto)
}
