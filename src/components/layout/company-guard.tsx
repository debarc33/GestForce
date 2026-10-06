'use client'

/**
 * CompanyGuard — Verifica que haya una empresa activa antes de renderizar el dashboard.
 *
 * Si el usuario llega al dashboard sin haber seleccionado empresa
 * (ej: localStorage limpiado, primera sesión), lo redirige a /select-company.
 *
 * Esto soluciona el bug P7: el dashboard se renderizaba sin empresa activa.
 *
 * IMPORTANTE: el store de Zustand usa el middleware `persist`, que lee
 * localStorage de forma asíncrona DESPUÉS del primer render (no puede
 * hacerlo durante el render en servidor). Mientras esa rehidratación no
 * termina, `activeCompanyId` vale `null` aunque el usuario ya tenga una
 * empresa guardada de una sesión anterior. Si este guard no esperaba a que
 * la rehidratación terminara, mandaba al usuario a /select-company en cada
 * recarga de página o navegación directa por URL, incluso con una empresa
 * ya seleccionada.
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCompanyStore } from '@/store/useCompanyStore'

interface CompanyGuardProps {
  children: React.ReactNode
}

export function CompanyGuard({ children }: CompanyGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { activeCompanyId } = useCompanyStore()
  const [hasHydrated, setHasHydrated] = useState(() => useCompanyStore.persist.hasHydrated())

  // Espera a que el store termine de leer localStorage antes de confiar en
  // activeCompanyId.
  useEffect(() => {
    if (useCompanyStore.persist.hasHydrated()) {
      setHasHydrated(true)
      return
    }
    const unsub = useCompanyStore.persist.onFinishHydration(() => setHasHydrated(true))
    return unsub
  }, [])

  useEffect(() => {
    if (!hasHydrated) return

    // Si no hay empresa activa, redirigir a selección
    // Se conserva la ruta original en `redirect` para volver ahí después
    // de seleccionar/auto-seleccionar la empresa (en vez de perder el lugar
    // donde estaba el usuario y mandarlo siempre al dashboard).
    if (activeCompanyId === null) {
      const redirectTo = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : ''
      router.replace(`/select-company${redirectTo}`)
    }
  }, [hasHydrated, activeCompanyId, pathname, router])

  // Mientras no sepamos si hay empresa (aún hidratando) o no hay empresa, no renderizar
  if (!hasHydrated || activeCompanyId === null) {
    return null
  }

  return <>{children}</>
}
