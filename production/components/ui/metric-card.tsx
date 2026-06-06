'use client'

import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, type LucideIcon } from 'lucide-react'
import { GlassCard } from './glass-card'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: number          // percentage change, sign indicates direction
  deltaLabel?: string     // "vs mes anterior", "este trimestre", etc.
  icon?: LucideIcon
  iconTone?: 'default' | 'success' | 'danger' | 'warning' | 'accent'
  sparkline?: number[]
  className?: string
}

const TONE_CLASSES: Record<NonNullable<MetricCardProps['iconTone']>, string> = {
  default: 'bg-[var(--glass-strong)] text-foreground',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  danger:  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  accent:  'bg-primary/10 text-primary border-primary/20',
}

/**
 * GestForce — MetricCard
 *
 * Compact, premium KPI tile for dashboards and module heads.
 * Plug-and-play replacement for the inline KPI grids in customers/page.tsx etc.
 *
 * @example
 *   <MetricCard
 *     label="Total Clientes"
 *     value={stats.total}
 *     delta={12.4}
 *     deltaLabel="vs mes anterior"
 *     icon={Users}
 *     iconTone="accent"
 *     sparkline={[20,22,24,25,28,30,33,35]}
 *   />
 */
export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  iconTone = 'default',
  sparkline,
  className,
}: MetricCardProps) {
  return (
    <GlassCard hoverable padded={false} className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
              {label}
            </p>
            {delta !== undefined && <Delta value={delta} />}
          </div>
          <p className="text-2xl font-semibold text-foreground tabular-nums tracking-tight leading-none">
            {value}
          </p>
          {deltaLabel && (
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-none">{deltaLabel}</p>
          )}
        </div>
        {Icon && !sparkline && (
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            TONE_CLASSES[iconTone]
          )}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
        {sparkline && <Sparkline data={sparkline} positive={(delta ?? 0) >= 0} />}
      </div>
    </GlassCard>
  )
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums',
      positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
    )}>
      {positive ? <ArrowUp className="h-3 w-3 stroke-[2.4]" /> : <ArrowDown className="h-3 w-3 stroke-[2.4]" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const width = 88
  const height = 36
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((v, i) => [i * stepX, height - ((v - min) / range) * height] as const)
  const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`
  const gradId = `sg-${Math.random().toString(36).slice(2, 8)}`
  const stroke = positive ? 'var(--primary)' : 'oklch(0.65 0.22 25)'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
