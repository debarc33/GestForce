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
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    label: 'Productos',
    value: '—',
    sub: 'En catálogo',
    icon: Package,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    label: 'Ventas',
    value: '—',
    sub: 'Este mes',
    icon: ShoppingCart,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    label: 'Facturación',
    value: '—',
    sub: 'Este mes',
    icon: CircleDollarSign,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-zinc-400">Resumen general de tu empresa.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-500 shadow-sm">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span>Hoy</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group relative rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`${stat.iconColor}`} style={{ height: 18, width: 18 }} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-400 transition-colors" />
            </div>
            <p className="mt-4 text-2xl font-bold text-zinc-900 tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{stat.label}</p>
            <p className="text-[11px] text-zinc-400">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-[13px] font-semibold text-zinc-800">Actividad reciente</h2>
          <span className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors">
            Ver todo
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 mb-3">
            <TrendingUp className="h-5 w-5 opacity-40" />
          </div>
          <p className="text-[13px] font-medium text-zinc-500">Sin actividad reciente</p>
          <p className="text-[12px] text-zinc-400 mt-0.5">Los datos aparecerán aquí cuando tengas registros.</p>
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
            className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all group"
          >
            <span className="text-[13px] font-semibold text-zinc-700 group-hover:text-zinc-900 transition-colors">
              {action.label}
            </span>
            <ArrowUpRight className="h-4 w-4 text-zinc-300 group-hover:text-indigo-600 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}
