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

/**
 * GestForce — Floating Glass Sidebar
 *
 * Drop-in replacement for src/components/layout/sidebar.tsx
 * Same exports, same hooks, same MODULE_REGISTRY behavior.
 * Only the visuals change: floating card, blur, glass surfaces.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { activeCompany, activeCompanyId } = useCompanyStore()
  const { isCollapsed: collapsed, setSidebar } = useSidebarStore()
  const setCollapsed = (val: boolean) => setSidebar(val)

  const { data: enabledModules } = useEnabledModules(activeCompanyId)

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

  const visibleModules = MODULE_REGISTRY.filter(
    (m) => !enabledModules || enabledModules.has(m.id)
  )

  function isGroupActive(module: ModuleDefinition): boolean {
    if (!module.children) return false
    return module.children.some(child => pathname.startsWith(child.href.split('?')[0]))
  }

  function isChildActive(href: string): boolean {
    const [childPath, childQuery] = href.split('?')
    if (childQuery) {
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
    <aside
      className={cn(
        'fixed top-3 left-3 bottom-3 z-30 flex flex-col overflow-hidden',
        'rounded-2xl glass-surface p-2.5',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        collapsed ? 'w-[64px]' : 'w-[232px]'
      )}
    >
      {/* Brand */}
      <div className={cn(
        'relative flex items-center gap-2.5 px-2 pb-3.5 mb-2.5 border-b border-[var(--glass-border)]',
        collapsed && 'justify-center'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-[11px] font-bold text-white shadow-[0_4px_12px_oklch(0.5_0.25_280/0.35)]">
          GF
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 animate-[fadeIn_200ms_ease]">
            <p className="text-[13.5px] font-semibold text-foreground leading-none tracking-tight">GestForce</p>
            <p className="mt-1 text-[11px] text-muted-foreground leading-none">ERP · Multiempresa</p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Colapsar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground border border-transparent hover:bg-[var(--glass-strong)] hover:text-foreground hover:border-[var(--glass-border)] transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Re-expand */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-2.5 top-[22px] z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--glass-border-strong)] bg-[var(--glass-strong)] backdrop-blur text-muted-foreground hover:text-foreground transition-colors shadow-[var(--shadow-glass)]"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto -mx-0.5 px-0.5 flex flex-col gap-[2px]">
        {!collapsed && (
          <div className="px-2.5 pt-2 pb-1.5 text-[10.5px] font-semibold tracking-[0.07em] uppercase text-muted-foreground/60">
            Módulos
          </div>
        )}
        {visibleModules.map((item) => {
          if (item.children) {
            const groupActive = isGroupActive(item)
            const isExpanded = expandedGroups.has(item.id)
            return (
              <div key={item.id}>
                <button
                  onClick={() => !collapsed && toggleGroup(item.id)}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-md py-1.5 text-[13px] font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-2.5',
                    groupActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-[var(--glass)] hover:text-foreground'
                  )}
                >
                  <item.icon className={cn(
                    'h-4 w-4 shrink-0',
                    groupActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{item.name}</span>
                      <ChevronDown className={cn(
                        'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200',
                        !isExpanded && '-rotate-90'
                      )} />
                    </>
                  )}
                </button>
                {!collapsed && isExpanded && (
                  <div className="mt-0.5 ml-[18px] pl-2.5 border-l border-[var(--glass-border)] flex flex-col gap-[1px]">
                    {item.children.map(child => {
                      const childActive = isChildActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
                            childActive
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'border border-transparent text-muted-foreground hover:bg-[var(--glass)] hover:text-foreground'
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

          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href!)

          return (
            <Link
              key={item.id}
              href={item.href!}
              title={collapsed ? item.name : undefined}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md py-1.5 text-[13px] font-medium transition-all',
                collapsed ? 'justify-center px-0' : 'px-2.5',
                isActive
                  ? 'bg-[var(--glass-strong)] text-foreground font-semibold border border-[var(--glass-border)] shadow-[var(--shadow-glass)]'
                  : 'border border-transparent text-muted-foreground hover:bg-[var(--glass)] hover:text-foreground'
              )}
            >
              {isActive && !collapsed && (
                <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-primary shadow-[0_0_12px_var(--ring)]" />
              )}
              <item.icon className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Empresa activa */}
      <button
        className={cn(
          'mt-2 flex items-center gap-2.5 transition-colors',
          collapsed
            ? 'justify-center py-1.5'
            : 'rounded-lg p-2.5 bg-[var(--glass-strong)] border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] text-left'
        )}
        title="Cambiar empresa"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-fuchsia-500 text-[10.5px] font-bold text-white shadow-sm">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 animate-[fadeIn_200ms_ease]">
              <p className="truncate text-[12px] font-semibold text-foreground leading-none">
                {activeCompany?.name ?? 'Sin empresa'}
              </p>
              <p className="mt-1 text-[10.5px] text-muted-foreground flex items-center gap-1 leading-none">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_oklch(0.7_0.18_160)]" />
                Empresa activa
              </p>
            </div>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </aside>
  )
}
