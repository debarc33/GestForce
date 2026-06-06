'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useAppearance } from '@/modules/settings/useAppearance'

export function DashboardContent({ children }: { children: React.ReactNode }) {
  useAppearance()

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Ambient background — radial glows behind everything */}
      <div className="ambient" />

      <Sidebar />
      <Header />

      {/*
        Offsets:
          top:  56 (header height) + 14 (top inset) + 14 (gap) = 84
          left: 232 (sidebar) + 14 + 14 = 260  (handled via :where for collapsed)
        Sidebar/header are fixed and the layout is intentionally offset by margins
        so floating shells don't get scrolled.
      */}
      <main
        className="relative z-[1] min-h-screen pt-[84px] pl-[260px] pr-[20px] pb-6 transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [&:has(aside[data-collapsed='true'])]:pl-[92px]"
      >
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
