import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

/**
 * GestForce — GlassCard
 *
 * Translucent surface with backdrop blur.
 * Use as a drop-in for shadcn's <Card> when you want the glass aesthetic.
 *
 * Variants:
 *   - default:  bg-card/55 + blur · subtle border · soft shadow
 *   - strong:   bg-card/85 + blur · stronger border · pop shadow (for drawers, modals)
 *   - flat:     plain card without blur (light mode safe on noisy bgs)
 */

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'strong' | 'flat'
  padded?: boolean
  hoverable?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', padded = true, hoverable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          variant === 'default' && 'glass-surface',
          variant === 'strong'  && 'glass-surface-strong',
          variant === 'flat'    && 'border border-[var(--glass-border)] bg-card shadow-[var(--shadow-glass)]',
          padded && 'p-5',
          hoverable && 'hover:bg-[var(--glass-hover)] hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-accent)]',
          className
        )}
        {...props}
      />
    )
  }
)
GlassCard.displayName = 'GlassCard'

export function GlassCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
}

export function GlassCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)} {...props} />
}

export function GlassCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[12.5px] text-muted-foreground', className)} {...props} />
}

export function GlassCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('pt-3', className)} {...props} />
}
