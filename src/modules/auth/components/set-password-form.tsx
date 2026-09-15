'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { setPasswordSchema, type SetPasswordFormData } from '../schemas'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SetPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const router = useRouter()
  const supabase = createClient()

  const onSubmit = async (data: SetPasswordFormData) => {
    setError(null)
    setIsPending(true)

    const { error } = await supabase.auth.updateUser({ password: data.password })

    if (error) {
      setError('No se pudo guardar la contraseña: ' + error.message)
      setIsPending(false)
      return
    }

    router.push('/select-company')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md shadow-sm border-zinc-200">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">Crea tu contraseña</CardTitle>
        <CardDescription className="text-zinc-500">
          Este es tu primer ingreso a GestForce. Elige una contraseña para tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input id="password" type="password" {...form.register('password')} disabled={isPending} />
            {form.formState.errors.password && (
              <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirma tu contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register('confirmPassword')}
              disabled={isPending}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-md">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar y continuar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
