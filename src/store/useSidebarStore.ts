import { create } from 'zustand'

interface SidebarStore {
  isCollapsed: boolean
  toggleSidebar: () => void
  setSidebar: (collapsed: boolean) => void
  /** Solo aplica en pantallas angostas (celular/tablet): el sidebar se
   *  comporta como un panel deslizante que entra/sale de la pantalla,
   *  independiente de `isCollapsed` (que es el modo angosto de escritorio). */
  isMobileOpen: boolean
  toggleMobileSidebar: () => void
  setMobileSidebar: (open: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()((set) => ({
  isCollapsed: false,
  toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setSidebar: (collapsed: boolean) => set({ isCollapsed: collapsed }),

  isMobileOpen: false,
  toggleMobileSidebar: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
  setMobileSidebar: (open: boolean) => set({ isMobileOpen: open }),
}))
