import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleId } from '@/config/modules';

interface Company {
  id: string;
  name: string;
  role?: string; // Rol del usuario en la empresa
}

interface CompanyStore {
  activeCompanyId: string | null;
  activeCompany: Company | null;
  userId: string | null; // Usuario actualmente autenticado
  availableCompanies: Company[]; // Para selección múltiple

  /**
   * Módulos habilitados para la empresa activa.
   * - `null`: aún no se han cargado (React Query los está trayendo)
   * - `Set<ModuleId>`: ya cargados desde company_modules
   *
   * NO se persiste en localStorage — se recarga fresco en cada sesión
   * vía el hook useEnabledModules en module-queries.ts
   */
  enabledModules: Set<ModuleId> | null;

  setActiveCompany: (id: string, name?: string, role?: string) => void;
  setUser: (userId: string) => void;
  setAvailableCompanies: (companies: Company[]) => void;
  setEnabledModules: (modules: Set<ModuleId>) => void;
  clearActiveCompany: () => void;
  clearUser: () => void;
}

// Crear el store con persistencia en localStorage
export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set) => ({
      activeCompanyId: null,
      activeCompany: null,
      userId: null,
      availableCompanies: [],
      enabledModules: null, // Se carga via useEnabledModules hook

      setActiveCompany: (id: string, name: string = '', role?: string) => {
        set({
          activeCompanyId: id,
          activeCompany: { id, name, role },
          enabledModules: null, // Resetear módulos al cambiar de empresa
        });
      },

      setUser: (userId: string) => {
        set({ userId });
      },

      setAvailableCompanies: (companies: Company[]) => {
        set({ availableCompanies: companies });
      },

      setEnabledModules: (modules: Set<ModuleId>) => {
        set({ enabledModules: modules });
      },

      clearActiveCompany: () => {
        set({
          activeCompanyId: null,
          activeCompany: null,
          enabledModules: null,
        });
      },

      clearUser: () => {
        set({
          userId: null,
          activeCompanyId: null,
          activeCompany: null,
          availableCompanies: [],
          enabledModules: null,
        });
      },
    }),
    {
      name: 'company-store', // localStorage key
      // enabledModules NO se persiste (Set no serializable + debe recargarse fresco)
      partialize: (state) => ({
        activeCompanyId: state.activeCompanyId,
        activeCompany: state.activeCompany,
        userId: state.userId,
        availableCompanies: state.availableCompanies,
      }),
    }
  )
);
