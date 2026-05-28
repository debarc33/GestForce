'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, LayoutDashboard, ArrowLeft, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/superadmin',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/superadmin/companies', label: 'Empresas',   icon: Building2 },
  { href: '/superadmin/users',     label: 'Usuarios',   icon: Users },
]

export function SuperadminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
      {/* Logo + badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white shadow-sm">
            GF
          </div>
          <span className="text-[13px] font-bold text-white">GestForce</span>
          <span className="flex items-center gap-1 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
            <Shield className="h-3 w-3" />
            Superadmin
          </span>
        </div>

        {/* Links de navegación */}
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
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Volver al ERP */}
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al ERP
      </Link>
    </nav>
  )
}
