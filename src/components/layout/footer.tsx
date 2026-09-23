'use client'

import React from 'react'
import { Heart } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between border-t border-slate-200/80 bg-white/80 px-5 text-[11px] text-slate-400">
      <div className="flex items-center gap-1.5">
        <span>&copy;</span>
        <span>{currentYear}</span>
        <span className="mx-0.5 text-slate-300">-</span>
        <span className="font-medium text-slate-500">GestForce ERP</span>
        <span className="text-slate-300">/</span>
        <span>Todos los derechos reservados</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>Hecho con</span>
        <Heart className="h-3 w-3 fill-red-400 text-red-400" />
        <span>para empresas que crecen</span>
      </div>
    </footer>
  )
}
