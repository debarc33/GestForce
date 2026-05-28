import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { CompanyGuard } from '@/components/layout/company-guard'
import { ModuleGuard } from '@/components/layout/module-guard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* CompanyGuard: redirige a /select-company si no hay empresa activa */}
          <CompanyGuard>
            {/* ModuleGuard: redirige al dashboard si el módulo de la ruta está deshabilitado */}
            <ModuleGuard>
              {children}
            </ModuleGuard>
          </CompanyGuard>
        </main>
        <Footer />
      </div>
    </div>
  )
}
