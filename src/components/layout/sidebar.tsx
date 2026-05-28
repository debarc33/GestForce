'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useSidebarStore } from '@/store/useSidebarStore'
import { useEnabledModules } from '@/modules/company/module-queries'
import { MODULE_REGISTRY, type ModuleDefinition } from '@/config/modules'

export function Sidebar() {
  const pathname = usePathname()
  const { activeCompany, activeCompanyId } = useCompanyStore()
  const { isCollapsed: collapsed, setSidebar } = useSidebarStore()
  const setCollapsed = (val: boolean) => setSidebar(val)

  // Cargar módulos habilitados para la empresa activa
  const { data: enabledModules } = useEnabledModules(activeCompanyId)

  // Estado de expansión de grupos (todos expandidos por defecto)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(MODULE_REGISTRY.filter(m => m.children).map(m => m.id))
  )

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Filtrar módulos visibles:
  // - Si enabledModules aún no cargó (undefined) → mostrar todos (sin parpadeo)
  // - Si ya cargó → mostrar solo los habilitados
  const visibleModules = MODULE_REGISTRY.filter(
    (m) => !enabledModules || enabledModules.has(m.id)
  )

  // ── Helpers de estado activo ───────────────────────────────────────────────

  /** Un grupo está activo si alguno de sus hijos coincide con el pathname actual */
  function isGroupActive(module: ModuleDefinition): boolean {
    if (!module.children) return false
    return module.children.some(child => {
      const childPath = child.href.split('?')[0]
      return pathname.startsWith(childPath)
    })
  }

  /** Un hijo está activo según su href (con o sin query string) */
  function isChildActive(href: string): boolean {
    const [childPath, childQuery] = href.split('?')
    if (childQuery) {
      // Para hrefs con tab: /sales?tab=quotes → activo solo si el path Y el tab coinciden
      const tabParam = new URLSearchParams('?' + childQuery).get('tab')
      const currentTab = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tab')
        : null
      return pathname === childPath && currentTab === tabParam
    }
    return pathname.startsWith(childPath)
  }

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

          // ── MÓDULO AGRUPADO (tiene children) ────────────────────────────
          if (item.children) {
            const groupActive = isGroupActive(item)
            const isExpanded  = expandedGroups.has(item.id)

            return (
              <div key={item.id}>
                {/* Header del grupo */}
                <button
                  onClick={() => !collapsed && toggleGroup(item.id)}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-all duration-100',
                    collapsed ? 'justify-center px-0' : 'px-2.5',
                    groupActive
                      ? 'text-indigo-700'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                  )}
                >
                  <item.icon className={cn(
                    'h-[16px] w-[16px] shrink-0',
                    groupActive ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600'
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{item.name}</span>
                      <ChevronDown className={cn(
                        'h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )} />
                    </>
                  )}
                </button>

                {/* Sub-ítems del grupo */}
                {!collapsed && isExpanded && (
                  <div className="mt-0.5 ml-5 space-y-0.5 border-l border-zinc-100 pl-2">
                    {item.children.map(child => {
                      const childActive = isChildActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                            childActive
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // ── MÓDULO SIMPLE (enlace directo) ───────────────────────────────
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
