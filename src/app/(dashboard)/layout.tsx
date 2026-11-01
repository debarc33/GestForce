import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CompanyGuard } from '@/components/layout/company-guard'
import { ModuleGuard } from '@/components/layout/module-guard'
import { BackgroundLayer } from '@/components/ui/background-layer'
import { MainContent } from '@/components/layout/main-content'

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
            MainContent lee isCollapsed directo del store (ver ese archivo para
            el porqué: el selector CSS :has() que había antes no funcionaba,
            porque Sidebar y este contenido son hermanos, no padre/hijo).
          */}
          <MainContent>{children}</MainContent>
        </div>
      </ModuleGuard>
    </CompanyGuard>
  )
}
