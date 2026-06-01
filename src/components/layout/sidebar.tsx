'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useSidebarStore } from '@/store/useSidebarStore'
import { useEnabledModules } from '@/modules/company/module-queries'
import { MODULE_REGISTRY } from '@/config/modules'

export function Sidebar() {
  const pathname = usePathname()
  const { activeCompany, activeCompanyId } = useCompanyStore()
  const { isCollapsed: collapsed, setSidebar } = useSidebarStore()
  const setCollapsed = (val: boolean) => setSidebar(val)

  const { data: enabledModules } = useEnabledModules(activeCompanyId)

  // Mostrar todos mientras carga; filtrar por habilitados una vez disponibles
  const visibleModules = MODULE_REGISTRY.filter(
    (m) => !enabledModules || enabledModules.has(m.id)
  )

  const initials = activeCompany?.name
    ? activeCompany.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'GF'

  return (
    <div
      className={cn(
        'relative flex h-full flex-col border-r border-zinc-200/80 bg-white transition-all duration-300',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-[56px] shrink-0 items-center border-b border-zinc-100 px-3',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white shadow-sm">
              GF
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-zinc-900 leading-none">GestForce</p>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">ERP</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white shadow-sm">
            GF
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Botón expandir cuando colapsado */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-[20px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visibleModules.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href!)

          return (
            <Link
              key={item.id}
              href={item.href!}
              title={collapsed ? item.name : undefined}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-all duration-100',
                collapsed ? 'justify-center px-0' : 'px-2.5',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
              )}
            >
              <item.icon className={cn(
                'h-[16px] w-[16px] shrink-0',
                isActive ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600'
              )} />
              {!collapsed && (
                <span className="truncate">{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Empresa activa */}
      <div className="border-t border-zinc-100 px-2 py-2">
        {/* Empresa activa */}
        {collapsed ? (
          <div className="flex justify-center py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-700">
              {initials}
            </div>
          </div>
        ) : (
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50 transition-colors">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-zinc-800 leading-none">
                {activeCompany?.name ?? 'Sin empresa'}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Empresa activa
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  )
}
