import {
  Users, Package, ShoppingCart, CircleDollarSign,
  ArrowUpRight, TrendingUp,
} from 'lucide-react'

const stats = [
  {
    label: 'Clientes',
    value: '—',
    sub: 'Total registrados',
    icon: Users,
    iconBg: 'bg-[var(--accent-bg)]',
    iconColor: 'text-[var(--accent)]',
  },
  {
    label: 'Productos',
    value: '—',
    sub: 'En catálogo',
    icon: Package,
    iconBg: 'bg-[var(--accent-bg)]',
    iconColor: 'text-[var(--accent)]',
  },
  {
    label: 'Ventas',
    value: '—',
    sub: 'Este mes',
    icon: ShoppingCart,
    iconBg: 'bg-[var(--accent-bg)]',
    iconColor: 'text-[var(--accent)]',
  },
  {
    label: 'Facturación',
    value: '—',
    sub: 'Este mes',
    icon: CircleDollarSign,
    iconBg: 'bg-[var(--accent-bg)]',
    iconColor: 'text-[var(--accent)]',
  },
]

export default function DashboardPage() {
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
            <p className="mt-4 text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-5 py-3.5">
          <h2 className="text-[13px] font-semibold text-foreground">Actividad reciente</h2>
          <span className="text-[11px] font-medium text-[var(--accent)] hover:text-[var(--accent)] hover:opacity-80 cursor-pointer transition-colors">
            Ver todo
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--glass-hover)] mb-3">
            <TrendingUp className="h-5 w-5 opacity-40" />
          </div>
          <p className="text-[13px] font-medium text-foreground">Sin actividad reciente</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Los datos aparecerán aquí cuando tengas registros.</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Nueva cotización', href: '/sales?tab=quotes',    color: 'indigo' },
          { label: 'Registrar compra', href: '/purchases?tab=orders', color: 'violet' },
          { label: 'Ver inventario',   href: '/inventory',            color: 'emerald' },
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
