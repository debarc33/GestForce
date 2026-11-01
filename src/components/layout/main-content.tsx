'use client'

import { useSidebarStore } from '@/store/useSidebarStore'
import { cn } from '@/lib/utils'

/**
 * Envoltorio del contenido principal del dashboard (a la derecha del
 * sidebar flotante). Antes, el ancho izquierdo dependía de un selector
 * CSS `main:has(aside[data-collapsed='true'])` -- pero `<Sidebar />` y
 * `<main>` son HERMANOS en layout.tsx, no un padre/hijo, así que ese
 * `:has()` nunca podía encontrar el `aside` (busca descendientes, no
 * hermanos) y nunca se aplicaba. Por eso el contenido no se ampliaba al
 * colapsar el menú (bug real reportado por Deisy, 1 nov 2026).
 *
 * Arreglo: leer `isCollapsed` directo del mismo store que ya usa
 * `Sidebar` para decidir su propio ancho, y aplicar la posición
 * izquierda del contenido desde JavaScript en vez de CSS puro.
 */
export function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarStore()

  return (
    <main
      className={cn(
        'content-scroll fixed z-[1] right-5 top-[84px] bottom-3 overflow-y-auto overflow-x-hidden',
        'transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isCollapsed ? 'left-[92px]' : 'left-[260px]',
        'max-md:!left-3 max-md:!right-3'
      )}
    >
      <div className="mx-auto max-w-[1600px] px-8 pt-8 pb-8 max-md:px-4 max-md:pt-4 animate-[fadeIn_240ms_ease]">
        {children}
      </div>
    </main>
  )
}
