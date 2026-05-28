import { create } from 'zustand'

interface SidebarStore {
  isCollapsed: boolean
  toggleSidebar: () => void
  setSidebar: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()((set) => ({
  isCollapsed: false,
  toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setSidebar: (collapsed: boolean) => set({ isCollapsed: collapsed }),
}))
