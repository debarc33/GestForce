'use client'

/**
 * ModuleGuard — Protege rutas de módulos deshabilitados.
 *
 * Si el usuario intenta acceder a una ruta cuyo módulo está deshabilitado
 * para su empresa (ej: /payroll cuando Nómina está desactivada),
 * lo redirige al dashboard.
 *
 * Esto soluciona el bug P6: el sidebar podía ocultar un módulo pero el usuario
 * podía seguir navegando directamente a su URL.
 *
 * Comportamiento:
 * - Durante la carga → renderiza los hijos normalmente (sin flash/redirect prematuro)
 * - Una vez cargados los módulos → verifica y redirige si corresponde
 * - Los módulos alwaysOn (dashboard, settings) nunca se bloquean
 */

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useEnabledModules } from '@/modules/company/module-queries'
import { getModuleIdFromPath } from '@/config/modules'

interface ModuleGuardProps {
  children: React.ReactNode
}

export function ModuleGuard({ children }: ModuleGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const { data: enabledModules, isLoading } = useEnabledModules(activeCompanyId)

  useEffect(() => {
    // No actuar durante la carga inicial (evitar redirecciones prematuras)
    if (isLoading || !enabledModules) return

    const moduleId = getModuleIdFromPath(pathname)

    // Si la ruta corresponde a un módulo y ese módulo no está habilitado → redirigir
    if (moduleId && !enabledModules.has(moduleId)) {
      router.replace('/')
    }
  }, [pathname, enabledModules, isLoading, router])

  // Renderizar siempre los hijos; la redirección es asíncrona vía useEffect
  return <>{children}</>
}
