'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsAccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function SettingsAccordion({
  title,
  children,
  defaultOpen = false,
}: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[var(--glass-border)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-0 py-3 text-left transition-colors hover:text-foreground group"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
            isOpen && 'rotate-90'
          )}
        />
        <h3 className={cn(
          'text-sm font-medium transition-colors',
          isOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
        )}>
          {title}
        </h3>
      </button>

      {isOpen && (
        <div className="pb-4 pl-7 space-y-4 animate-[slideDown_200ms_ease]">
          {children}
        </div>
      )}
    </div>
  )
}
