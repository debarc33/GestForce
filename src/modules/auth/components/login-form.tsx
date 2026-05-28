'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../schemas'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const router = useRouter()
  const supabase = createClient()

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setIsPending(true)

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setError('Credenciales incorrectas')
      setIsPending(false)
      return
    }

    if (!authData.session) {
      setError('No se pudo iniciar sesión. Intenta de nuevo.')
      setIsPending(false)
      return
    }

    router.push('/select-company')
  }

  return (
    <Card className="w-full max-w-md shadow-sm border-zinc-200">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">GestForce ERP</CardTitle>
        <CardDescription className="text-zinc-500">Ingresa tus credenciales para acceder</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" {...form.register('email')} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" {...form.register('password')} disabled={isPending} />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-md">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Iniciando sesión...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}