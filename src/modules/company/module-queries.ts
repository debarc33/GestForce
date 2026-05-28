'use client'

/**
 * Queries para gestión de módulos habilitados por empresa.
 * Usado por el sidebar y los module guards.
 */

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { MODULE_REGISTRY, ALWAYS_ON_MODULE_IDS, type ModuleId } from '@/config/modules'

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Devuelve el Set de IDs de módulos habilitados para la empresa activa.
 *
 * Lógica:
 *   - Si no hay filas en `company_modules` para la empresa → devuelve TODOS
 *     (retrocompatibilidad con empresas anteriores a la migración)
 *   - Los módulos `alwaysOn` (dashboard, settings) siempre se incluyen
 *   - Los módulos deshabilitados explícitamente (is_enabled = false) se excluyen
 *
 * @param companyId  ID de la empresa activa (de useCompanyStore)
 */
export function useEnabledModules(companyId: string | null) {
  return useQuery({
    queryKey: ['company_modules', companyId],
    queryFn: async (): Promise<Set<ModuleId>> => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('company_modules')
        .select('module_id, is_enabled')
        .eq('company_id', companyId!)

      if (error) {
        console.error('[useEnabledModules] Error consultando módulos:', error.message)
        // En caso de error, devolver todos para no bloquear al usuario
        return new Set<ModuleId>(MODULE_REGISTRY.map((m) => m.id))
      }

      // Sin filas → empresa sin configuración → todos los módulos activos
      if (!data || data.length === 0) {
        return new Set<ModuleId>(MODULE_REGISTRY.map((m) => m.id))
      }

      // Partir de los módulos alwaysOn (siempre incluidos)
      const enabled = new Set<ModuleId>(ALWAYS_ON_MODULE_IDS)

      // Agregar los que están habilitados en la DB
      data.forEach(({ module_id, is_enabled }) => {
        if (is_enabled) {
          enabled.add(module_id as ModuleId)
        }
      })

      // Garantizar que alwaysOn nunca se excluya (aunque haya un row erróneo en DB)
      ALWAYS_ON_MODULE_IDS.forEach((id) => enabled.add(id))

      return enabled
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,   // 5 minutos de caché
    gcTime: 1000 * 60 * 10,      // 10 minutos antes de limpiar
    retry: 2,
  })
}

// ─── Helper para verificar un módulo específico ────────────────────────────────

/**
 * Verifica si un módulo específico está habilitado para la empresa.
 * Conveniente para componentes que necesitan verificar un solo módulo.
 *
 * @example
 * const { isEnabled, isLoading } = useModuleEnabled('payroll', companyId)
 */
export function useModuleEnabled(moduleId: ModuleId, companyId: string | null) {
  const query = useEnabledModules(companyId)
  return {
    isEnabled: query.data ? query.data.has(moduleId) : true, // true mientras carga
    isLoading: query.isLoading,
    error: query.error,
  }
}
