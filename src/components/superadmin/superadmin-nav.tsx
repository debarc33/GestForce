'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, LayoutDashboard, ArrowLeft, Shield, Settings, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/superadmin',           label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/superadmin/companies', label: 'Empresas',       icon: Building2 },
  { href: '/superadmin/users',     label: 'Usuarios',       icon: Users },
  { href: '/superadmin/settings',  label: 'Configuración',  icon: Settings },
]

export function SuperadminNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="relative border-b border-[var(--glass-border)] glass-surface px-4 md:px-6">
      <div className="flex h-14 items-center justify-between">
        {/* Logo + badge */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white shadow-sm">
              GF
            </div>
            <span className="text-[13px] font-bold text-foreground truncate">GestForce</span>
            <span className="hidden sm:flex items-center gap-1 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-400 shrink-0">
              <Shield className="h-3 w-3" />
              Superadmin
            </span>
          </div>

          {/* Links de navegación (escritorio) */}
          <div className="hidden md:flex items-center gap-1 ml-4">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/superadmin'
                  ? pathname === '/superadmin'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Volver al ERP */}
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al ERP
          </Link>

          {/* Botón de menú (solo celular/tablet) */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Menú deslizante (solo celular/tablet) */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--glass-border)] py-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/superadmin'
                ? pathname === '/superadmin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al ERP
          </Link>
        </div>
      )}
    </nav>
  )
}
