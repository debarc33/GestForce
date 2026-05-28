'use client'

/**
 * CompanyGuard — Verifica que haya una empresa activa antes de renderizar el dashboard.
 *
 * Si el usuario llega al dashboard sin haber seleccionado empresa
 * (ej: localStorage limpiado, primera sesión), lo redirige a /select-company.
 *
 * Esto soluciona el bug P7: el dashboard se renderizaba sin empresa activa.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCompanyStore } from '@/store/useCompanyStore'

interface CompanyGuardProps {
  children: React.ReactNode
}

export function CompanyGuard({ children }: CompanyGuardProps) {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()

  useEffect(() => {
    // Si no hay empresa activa, redirigir a selección
    if (activeCompanyId === null) {
      router.replace('/select-company')
    }
  }, [activeCompanyId, router])

  // Mientras no hay empresa, no renderizar el contenido del dashboard
  if (activeCompanyId === null) {
    return null
  }

  return <>{children}</>
}
