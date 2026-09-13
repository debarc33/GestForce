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
import { usePathname, useRouter } from 'next/navigation'
import { useCompanyStore } from '@/store/useCompanyStore'

interface CompanyGuardProps {
  children: React.ReactNode
}

export function CompanyGuard({ children }: CompanyGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { activeCompanyId } = useCompanyStore()

  useEffect(() => {
    // Si no hay empresa activa, redirigir a selección
    // Se conserva la ruta original en `redirect` para volver ahí después
    // de seleccionar/auto-seleccionar la empresa (en vez de perder el lugar
    // donde estaba el usuario y mandarlo siempre al dashboard).
    if (activeCompanyId === null) {
      const redirectTo = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : ''
      router.replace(`/select-company${redirectTo}`)
    }
  }, [activeCompanyId, pathname, router])

  // Mientras no hay empresa, no renderizar el contenido del dashboard
  if (activeCompanyId === null) {
    return null
  }

  return <>{children}</>
}
