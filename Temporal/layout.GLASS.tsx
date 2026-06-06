/**
 * GestForce — (dashboard)/layout.tsx  [REEMPLAZO COMPLETO]
 *
 * Pega esto en: src/app/(dashboard)/layout.tsx
 *
 * Lo que arregla:
 *  - Monta el FONDO futurista (gf-ambient + grid) detrás de todo → ya no se ve negro plano.
 *  - Deja el <main> con offsets correctos para el sidebar/header flotantes.
 *  - Conserva tus guards (CompanyGuard / ModuleGuard) intactos.
 *
 * Requisitos:
 *  - Pegaste production/globals.GLASS.css al final de src/app/globals.css
 *  - Copiaste background-layer.tsx y los demás primitivos a src/components/ui/
 *  - Envolviste la app con <AppearanceProvider> en src/app/layout.tsx
 *
 * NOTA: ajusta los imports a las rutas reales de TU proyecto si difieren.
 */

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CompanyGuard } from '@/components/layout/company-guard'
import { ModuleGuard } from '@/components/layout/module-guard'
import { BackgroundLayer } from '@/components/ui/background-layer'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyGuard>
      <ModuleGuard>
        <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>
          {/* Fondo futurista con glows (lee el fondo elegido del AppearanceProvider) */}
          <BackgroundLayer />

          {/* Shells flotantes */}
          <Sidebar />
          <Header />

          {/*
            Offsets para que el contenido no quede debajo de los shells flotantes:
              top  = 56 (header) + 14 (inset) + 14 (gap) = 84px
              left = 232 (sidebar) + 14 + 14 = 260px   (92px si está colapsado)
            El selector :has detecta el sidebar colapsado (data-collapsed="true").
          */}
          <main className="relative z-[1] min-h-screen pb-8 pl-[260px] pr-5 pt-[84px] transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [&:has(aside[data-collapsed='true'])]:pl-[92px]">
            <div className="mx-auto max-w-[1600px] animate-[fadeIn_240ms_ease]">
              {children}
            </div>
          </main>
        </div>
      </ModuleGuard>
    </CompanyGuard>
  )
}
