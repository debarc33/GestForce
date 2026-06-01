'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { Search, Bell, HelpCircle, ChevronDown, LogOut, Building2, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCompanyStore } from '@/store/useCompanyStore'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const MODULE_NAMES: Record<string, string> = {
  '/':           'Dashboard',
  '/customers':  'Clientes',
  '/sales':      'Ventas',
  '/purchases':  'Compras',
  '/products':   'Productos',
  '/inventory':  'Inventario',
  '/finances':   'Finanzas',
  '/accounting': 'Contabilidad',
  '/payroll':    'Nomina',
  '/reports':    'Reportes',
  '/settings':   'Configuracion',
}

const TAB_NAMES: Record<string, Record<string, string>> = {
  '/sales':      { quotes: 'Cotizaciones', invoices: 'Facturas', receipts: 'Recibos', customers: 'Clientes' },
  '/purchases':  { orders: 'Ordenes de Compra', invoices: 'Facturas Proveedor', payments: 'Pagos', suppliers: 'Proveedores' },
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
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const moduleEntry = Object.entries(MODULE_NAMES).find(([path]) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )
  const modulePath = moduleEntry?.[0] ?? ''
  const moduleName = moduleEntry?.[1] ?? ''
  const tab        = searchParams.get('tab') ?? searchParams.get('section') ?? ''
  const tabName    = TAB_NAMES[modulePath]?.[tab]

  if (!moduleName || moduleName === 'Dashboard') return null

  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span className="font-semibold text-zinc-800">{moduleName}</span>
      {tabName && (
        <>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-500">{tabName}</span>
        </>
      )}
    </div>
  )
}

export function Header() {
  const router   = useRouter()
  const supabase = createClient()
  const { activeCompany, clearUser } = useCompanyStore()

  const [userEmail, setUserEmail]         = useState<string | null>(null)
  const [isSuperadmin, setIsSuperadmin]   = useState(false)
  const [openUser,  setOpenUser]          = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const userRef   = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
      // app_metadata.is_superadmin solo puede ser establecido con service_role
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
        searchRef.current?.focus()
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

  const initials  = userEmail ? userEmail[0].toUpperCase() : '?'
  const roleLabel = ROLE_LABELS[activeCompany?.role ?? ''] ?? activeCompany?.role ?? ''

  return (
    <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

      {/* Empresa activa */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 cursor-pointer hover:bg-zinc-100 transition-colors shrink-0">
        <Building2 className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-[13px] font-medium text-zinc-700 max-w-[160px] truncate">
          {activeCompany?.name ?? '—'}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
      </div>

      {/* Búsqueda global */}
      <div className={cn(
        'relative flex flex-1 max-w-[400px] items-center gap-2 rounded-lg border bg-zinc-50/80 px-3 py-1.5 transition-all',
        searchFocused
          ? 'border-indigo-300 bg-white ring-2 ring-indigo-500/10'
          : 'border-zinc-200 hover:border-zinc-300'
      )}>
        <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar en GestForce..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="flex-1 bg-transparent text-[13px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <kbd className="flex h-5 items-center justify-center rounded border border-zinc-200 bg-white px-1.5 text-[10px] text-zinc-400 font-mono shadow-sm">
            ⌘
          </kbd>
          <kbd className="flex h-5 items-center justify-center rounded border border-zinc-200 bg-white px-1.5 text-[10px] text-zinc-400 font-mono shadow-sm">
            K
          </kbd>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <Suspense fallback={null}>
          <BreadcrumbInner />
        </Suspense>
      </div>

      {/* Acciones derechas */}
      <div className="flex items-center gap-1 shrink-0">

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
            3
          </span>
        </button>

        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors">
          <HelpCircle className="h-4 w-4" />
        </button>

        <ThemeToggle className="h-8 w-8" />

        <div className="relative ml-1" ref={userRef}>
          <button
            onClick={() => setOpenUser(v => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-100 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-medium text-zinc-700 max-w-[130px] truncate leading-none">
                {userEmail ?? '—'}
              </p>
              {roleLabel && (
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">{roleLabel}</p>
              )}
            </div>
            <ChevronDown className={cn(
              'h-3 w-3 text-zinc-400 transition-transform hidden sm:block',
              openUser && 'rotate-180'
            )} />
          </button>

          {openUser && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-zinc-200 bg-white shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <p className="text-[12px] font-semibold text-zinc-800 truncate">{userEmail}</p>
                {roleLabel && (
                  <p className="text-[11px] text-zinc-400 mt-0.5">{roleLabel}</p>
                )}
              </div>
              <div className="p-1">
                {/* Link al Panel Superadmin — solo visible para superadmins */}
                {isSuperadmin && (
                  <Link
                    href="/superadmin"
                    onClick={() => setOpenUser(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Panel Superadmin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
