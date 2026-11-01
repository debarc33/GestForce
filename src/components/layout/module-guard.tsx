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
import { useMyModuleAccess } from '@/modules/roles/queries'
import { getModuleIdFromPath, ALWAYS_ON_MODULE_IDS } from '@/config/modules'

interface ModuleGuardProps {
  children: React.ReactNode
}

export function ModuleGuard({ children }: ModuleGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeCompanyId, activeCompany } = useCompanyStore()
  const { data: enabledModules, isLoading } = useEnabledModules(activeCompanyId)
  // Permisos por rol (migración 032, 1 nov 2026): bloquea también si el
  // rol del usuario tiene "Sin acceso" a ese módulo, aunque la empresa
  // sí lo tenga activo -- sin esto, alguien con un rol restringido podía
  // escribir la URL directo y entrar igual, aunque el menú lo ocultara.
  const { data: moduleAccess, isLoading: isLoadingAccess } = useMyModuleAccess(activeCompanyId ?? undefined, activeCompany?.role)

  useEffect(() => {
    // No actuar durante la carga inicial (evitar redirecciones prematuras)
    if (isLoading || !enabledModules || isLoadingAccess) return

    const moduleId = getModuleIdFromPath(pathname)
    if (!moduleId) return

    if (!enabledModules.has(moduleId)) {
      router.replace('/')
      return
    }

    const isAlwaysOn = ALWAYS_ON_MODULE_IDS.includes(moduleId)
    if (!isAlwaysOn && moduleAccess && moduleAccess[moduleId] === 'none') {
      router.replace('/')
    }
  }, [pathname, enabledModules, isLoading, moduleAccess, isLoadingAccess, router])

  // Renderizar siempre los hijos; la redirección es asíncrona vía useEffect
  return <>{children}</>
}
