'use client'

import {
  Users, Package, ShoppingCart, CircleDollarSign,
  ArrowUpRight, TrendingUp, FileText, UserPlus, ReceiptText,
} from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useCustomers } from '@/modules/customers/queries'
import { useProducts } from '@/modules/products/queries'
import { useInvoices, useQuotes } from '@/modules/sales/queries'

// ─── Helpers ────────────────────────────────────────────────────────────

/** Compara si una fecha (solo fecha, sin hora — ej. issue_date) cae en el mes/año actual. */
function isDateThisMonth(dateOnly: string | null | undefined, now: Date) {
  if (!dateOnly) return false
  const d = new Date(dateOnly + 'T12:00:00')
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

const fmtMoneyCOP = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

function formatActivityDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

type ActivityItem = {
  id: string
  date: string
  icon: typeof FileText
  iconColor: string
  label: string
  sub?: string
}

export default function DashboardPage() {
  const { activeCompanyId } = useCompanyStore()

  const { data: customers, isLoading: loadingCustomers } = useCustomers(activeCompanyId ?? undefined)
  const { data: products, isLoading: loadingProducts } = useProducts(activeCompanyId ?? undefined)
  const { data: invoices, isLoading: loadingInvoices } = useInvoices(activeCompanyId ?? undefined)
  const { data: quotes, isLoading: loadingQuotes } = useQuotes(activeCompanyId ?? undefined)

  const loadingStats = loadingCustomers || loadingProducts || loadingInvoices
  const now = new Date()

  // "Ventas (este mes)": total de facturas creadas este mes, así no estén emitidas
  // todavía (borrador incluido) — solo se excluyen las anuladas, que no cuentan
  // como trabajo real del mes.
  const invoicesThisMonth = (invoices ?? []).filter(
    inv => isDateThisMonth(inv.issue_date, now) && inv.status !== 'cancelled'
  )
  const ventasCount = invoicesThisMonth.length

  // "Facturación (este mes)": suma de las facturas ya emitidas este mes, sin
  // importar si el cliente ya pagó o sigue en cuentas por cobrar.
  const facturacionTotal = (invoices ?? [])
    .filter(inv => isDateThisMonth(inv.issue_date, now) && inv.status === 'issued')
    .reduce((sum, inv) => sum + Number(inv.total ?? 0), 0)

  const stats = [
    {
      label: 'Clientes',
      value: loadingCustomers ? '—' : String(customers?.length ?? 0),
      sub: 'Total registrados',
      icon: Users,
      iconBg: 'bg-[var(--accent-bg)]',
      iconColor: 'text-[var(--accent)]',
    },
    {
      label: 'Productos',
      value: loadingProducts ? '—' : String(products?.length ?? 0),
      sub: 'En catálogo',
      icon: Package,
      iconBg: 'bg-[var(--accent-bg)]',
      iconColor: 'text-[var(--accent)]',
    },
    {
      label: 'Ventas',
      value: loadingInvoices ? '—' : String(ventasCount),
      sub: 'Este mes',
      icon: ShoppingCart,
      iconBg: 'bg-[var(--accent-bg)]',
      iconColor: 'text-[var(--accent)]',
    },
    {
      label: 'Facturación',
      value: loadingInvoices ? '—' : fmtMoneyCOP(facturacionTotal),
      sub: 'Este mes',
      icon: CircleDollarSign,
      iconBg: 'bg-[var(--accent-bg)]',
      iconColor: 'text-[var(--accent)]',
    },
  ]

  // ── Actividad reciente: últimas facturas emitidas, cotizaciones y clientes nuevos ──
  const loadingActivity = loadingInvoices || loadingQuotes || loadingCustomers

  const activity: ActivityItem[] = !loadingActivity ? [
    ...(invoices ?? [])
      .filter(inv => inv.status === 'issued')
      .map((inv): ActivityItem => ({
        id: `invoice-${inv.id}`,
        date: inv.issued_at ?? inv.created_at,
        icon: ReceiptText,
        iconColor: 'text-emerald-400',
        label: `Factura ${inv.invoice_number} emitida a ${inv.customer?.name ?? 'cliente'}`,
        sub: fmtMoneyCOP(Number(inv.total ?? 0)),
      })),
    ...(quotes ?? []).map((q): ActivityItem => ({
      id: `quote-${q.id}`,
      date: q.created_at,
      icon: FileText,
      iconColor: 'text-[var(--accent)]',
      label: `Cotización ${q.quote_number} creada para ${q.customer?.name ?? 'cliente'}`,
      sub: fmtMoneyCOP(Number(q.total ?? 0)),
    })),
    ...(customers ?? []).map((c): ActivityItem => ({
      id: `customer-${c.id}`,
      date: c.created_at,
      icon: UserPlus,
      iconColor: 'text-sky-400',
      label: `Cliente ${c.name} registrado`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6) : []

  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Tablero</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Resumen general de tu empresa.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-1.5 text-[12px] text-muted-foreground shadow-sm">
          <TrendingUp className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>Hoy</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group relative rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-5 shadow-sm hover:shadow-md hover:border-[var(--glass-hover)] transition-all"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`${stat.iconColor}`} style={{ height: 18, width: 18 }} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <p className={`mt-4 font-bold text-foreground tracking-tight ${loadingStats ? 'text-2xl' : 'text-2xl'}`}>
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-5 py-3.5">
          <h2 className="text-[13px] font-semibold text-foreground">Actividad reciente</h2>
          <a
            href="/sales?tab=invoices"
            className="text-[11px] font-medium text-[var(--accent)] hover:opacity-80 cursor-pointer transition-colors"
          >
            Ver todo
          </a>
        </div>

        {loadingActivity ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--glass-hover)]" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--glass-hover)] mb-3">
              <TrendingUp className="h-5 w-5 opacity-40" />
            </div>
            <p className="text-[13px] font-medium text-foreground">Sin actividad reciente</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Los datos aparecerán aquí cuando tengas registros.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--glass-border)]">
            {activity.map(item => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-hover)]">
                  <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{formatActivityDate(item.date)}</p>
                </div>
                {item.sub && (
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">{item.sub}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Nueva cotización', href: '/sales?tab=quotes',    color: 'indigo' },
          { label: 'Registrar compra', href: '/purchases?tab=orders', color: 'violet' },
          { label: 'Ver inventario',   href: '/inventario',           color: 'emerald' },
        ].map((action) => (
          <a
            key={action.href}
            href={action.href}
            className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-3.5 shadow-sm hover:shadow-md hover:border-[var(--glass-hover)] transition-all group"
          >
            <span className="text-[13px] font-semibold text-foreground group-hover:text-[var(--accent)] transition-colors">
              {action.label}
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-[var(--accent)] transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}
