import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CompanyGuard } from '@/components/layout/company-guard'
import { ModuleGuard } from '@/components/layout/module-guard'
import { DashboardContent } from './dashboard-content'

/**
 * GestForce — Floating Glass Shell
 *
 * Drop-in replacement for src/app/(dashboard)/layout.tsx
 * Preserves CompanyGuard + ModuleGuard.
 * Adds the ambient background and offsets <main> for floating shells.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyGuard>
      <ModuleGuard>
        <DashboardContent>{children}</DashboardContent>
      </ModuleGuard>
    </CompanyGuard>
  )
}
