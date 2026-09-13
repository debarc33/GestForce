import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CompanyGuard } from '@/components/layout/company-guard'
import { ModuleGuard } from '@/components/layout/module-guard'
import { BackgroundLayer } from '@/components/ui/background-layer'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyGuard>
      <ModuleGuard>
        <div className="relative h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>
          {/* Fondo futurista con glows */}
          <BackgroundLayer />

          {/* Shells flotantes */}
          <Sidebar />
          <Header />

          {/*
            Panel de contenido con SCROLL PROPIO, contenido debajo del header y a
            la derecha del sidebar. Al empezar en top-[84px], el contenido nunca
            sube por encima de esa línea → nunca queda por debajo del header flotante.
              top  = 56 (header) + 14 (inset) + 14 (gap) = 84px
              left = 232 (sidebar) + 14 + 14 = 260px   (92px si está colapsado)
            El selector :has detecta el sidebar colapsado (data-collapsed="true").
          */}
          <main className="content-scroll fixed z-[1] left-[260px] right-5 top-[84px] bottom-3 overflow-y-auto overflow-x-hidden transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [&:has(aside[data-collapsed='true'])]:left-[92px]">
            {/* px-8 pt-8: el contenedor que esperan las cabeceras-banner de las
                páginas (usan -mx-8 -mt-8 para sangrar hasta los bordes). Sin
                este padding, el scroll propio recortaba el título por arriba. */}
            <div className="mx-auto max-w-[1600px] px-8 pt-8 pb-8 animate-[fadeIn_240ms_ease]">
              {children}
            </div>
          </main>
        </div>
      </ModuleGuard>
    </CompanyGuard>
  )
}
