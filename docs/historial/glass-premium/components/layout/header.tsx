'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { Search, Bell, HelpCircle, ChevronDown, ChevronRight as ChevronRightIcon, LogOut, Building2, Shield, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useSidebarStore } from '@/store/useSidebarStore'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { CommandPalette } from '@/components/ui/command-palette'

const MODULE_NAMES: Record<string, string> = {
  '/':           'Dashboard',
  '/customers':  'Clientes',
  '/sales':      'Ventas',
  '/purchases':  'Compras',
  '/products':   'Productos',
  '/inventory':  'Inventario',
  '/finances':   'Finanzas',
  '/accounting': 'Contabilidad',
  '/payroll':    'Nómina',
  '/reports':    'Reportes',
  '/settings':   'Configuración',
  '/suppliers':  'Proveedores',
}

const TAB_NAMES: Record<string, Record<string, string>> = {
  '/sales':      { quotes: 'Cotizaciones', invoices: 'Facturas', receipts: 'Recibos', customers: 'Clientes' },
  '/purchases':  { orders: 'Órdenes de Compra', invoices: 'Facturas Proveedor', payments: 'Pagos', suppliers: 'Proveedores' },
  '/inventory':  { movements: 'Movimientos', kardex: 'Kardex', adjustments: 'Ajustes' },
  '/finances':   { overview: 'Panel', receivable: 'Cartera', payable: 'Obligaciones', taxes: 'Impuestos' },
  '/accounting': { accounts: 'Plan de Cuentas', entries: 'Comprobantes', reports: 'Informes' },
  '/payroll':    { employees: 'Empleados', liquidate: 'Liquidar', history: 'Historial', pila: 'Aportes PILA', absences: 'Ausencias', benefits: 'Prestaciones' },
}

const ROLE_LABELS: Record<string, string> = {
  admin:    'Administrador',
  contador: 'Contador',
  vendedor: 'Vendedor',
  readonly: 'Solo lectura',
}

function BreadcrumbInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const moduleEntry = Object.entries(MODULE_NAMES).find(([path]) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )
  const moduleName = moduleEntry?.[1] ?? ''
  const modulePath = moduleEntry?.[0] ?? ''
  const tab = searchParams.get('tab') ?? searchParams.get('section') ?? ''
  const tabName = TAB_NAMES[modulePath]?.[tab]

  if (!moduleName) return null

  return (
    <div className="flex items-center gap-1.5 text-[12.5px] min-w-0">
      <span className={cn(tabName ? 'text-muted-foreground' : 'text-foreground font-semibold')}>{moduleName}</span>
      {tabName && (
        <>
          <ChevronRightIcon className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-foreground font-semibold truncate">{tabName}</span>
        </>
      )}
    </div>
  )
}

/**
 * GestForce — Floating Glass Topbar
 *
 * Drop-in replacement for src/components/layout/header.tsx
 * Preserves auth, role, multi-company, breadcrumb, and Cmd+K.
 * Cmd+K now opens <CommandPalette> instead of focusing the input.
 */
export function Header() {
  const router = useRouter()
  const supabase = createClient()
  const { activeCompany, clearUser } = useCompanyStore()
  const { isCollapsed } = useSidebarStore()

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [openUser, setOpenUser] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
      setIsSuperadmin(data.user?.app_metadata?.is_superadmin === true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setOpenUser(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const handleLogout = async () => {
    clearUser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userEmail ? userEmail[0].toUpperCase() : '?'
  const roleLabel = ROLE_LABELS[activeCompany?.role ?? ''] ?? activeCompany?.role ?? ''
  const companyInitials = activeCompany?.name
    ? activeCompany.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'GF'

  return (
    <>
      <header
        className={cn(
          'fixed top-3 right-3 z-20 h-14 flex items-center gap-3 px-3.5 rounded-2xl glass-surface',
          'transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
        )}
        style={{ left: isCollapsed ? 'calc(64px + 24px)' : 'calc(232px + 24px)' }}
      >
        {/* Empresa activa */}
        <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--glass-strong)] border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-colors max-w-[240px] shrink-0">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary to-fuchsia-500 text-[9.5px] font-bold text-white">
            {companyInitials}
          </div>
          <span className="text-[12.5px] font-medium text-foreground truncate">
            {activeCompany?.name ?? '—'}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_oklch(0.7_0.18_160)]" />
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>

        {/* Breadcrumb */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={null}>
            <BreadcrumbInner />
          </Suspense>
        </div>

        {/* Command palette trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-md bg-[var(--glass-strong)] border border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] transition-colors text-muted-foreground hover:text-foreground w-[260px]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-[12.5px] flex-1 text-left">Buscar o ejecutar...</span>
          <kbd className="flex h-5 items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1.5 text-[10px] font-mono">⌘</kbd>
          <kbd className="flex h-5 items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1.5 text-[10px] font-mono">K</kbd>
        </button>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors">
            <Sparkles className="h-4 w-4" />
          </button>
          <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--ring)]" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors">
            <HelpCircle className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-[var(--glass-border)] mx-1" />

          <div className="relative" ref={userRef}>
            <button
              onClick={() => setOpenUser(v => !v)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--glass-strong)] transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-[11px] font-bold text-white">
                {initials}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-[12px] font-medium text-foreground max-w-[130px] truncate leading-none">
                  {userEmail ?? '—'}
                </p>
                {roleLabel && (
                  <p className="text-[10.5px] text-muted-foreground mt-1 leading-none">{roleLabel}</p>
                )}
              </div>
              <ChevronDown className={cn(
                'h-3 w-3 text-muted-foreground transition-transform hidden lg:block',
                openUser && 'rotate-180'
              )} />
            </button>

            {openUser && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl glass-surface-strong z-50 overflow-hidden animate-[slideUp_220ms_ease]">
                <div className="px-3.5 py-3 border-b border-[var(--glass-border)]">
                  <p className="text-[12px] font-semibold text-foreground truncate">{userEmail}</p>
                  {roleLabel && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{roleLabel}</p>
                  )}
                </div>
                <div className="p-1">
                  {isSuperadmin && (
                    <Link
                      href="/superadmin"
                      onClick={() => setOpenUser(false)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Panel Superadmin
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
