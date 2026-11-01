/**
 * REGISTRO CENTRAL DE ROLES — GestForce
 *
 * Fuente de verdad única para los roles que puede tener un usuario dentro
 * de una empresa (`company_users.role`). Antes esta lista de 4 roles
 * estaba repetida a mano en 4 archivos distintos (riesgo real: si se
 * agrega un rol nuevo en uno y se olvida en otro, quedan inconsistentes
 * sin que nada avise). Importar siempre desde aquí en vez de volver a
 * escribir la lista:
 *   - src/app/api/company/users/invite/route.ts        (valida el rol al invitar)
 *   - src/app/api/company/users/[userId]/route.ts       (valida el rol al editar)
 *   - src/modules/team/queries.ts                       (selector de rol en Equipo)
 *   - src/components/layout/header.tsx                  (etiqueta de rol en el menú)
 *   - src/app/(superadmin)/superadmin/companies/[id]/users/page.tsx (panel superadmin)
 *
 * NOTA (1 nov 2026): hoy estos roles son solo una etiqueta. El único
 * permiso real que el sistema aplica es "admin sí / admin no"
 * (ver requireCompanyAdmin). contador/vendedor/readonly no restringen
 * todavía ningún módulo ni acción -- eso queda pendiente como una
 * funcionalidad aparte (ver plan-accion-productos-proveedores-roles.md).
 */

export type CompanyRole = 'admin' | 'contador' | 'vendedor' | 'readonly'

export interface RoleDefinition {
  id: CompanyRole
  label: string
}

export const ROLE_REGISTRY: RoleDefinition[] = [
  { id: 'admin',    label: 'Administrador' },
  { id: 'contador', label: 'Contador' },
  { id: 'vendedor', label: 'Vendedor' },
  { id: 'readonly', label: 'Solo lectura' },
]

/** IDs válidos, para validar el body de las rutas /api/company/users/*. */
export const VALID_ROLES: CompanyRole[] = ROLE_REGISTRY.map((r) => r.id)

/**
 * Mapa id → etiqueta visible, para selectores y menús.
 * Tipado como Record<string, string> (no Record<CompanyRole, string>)
 * a propósito: donde se usa (header.tsx, panel superadmin) el valor que
 * llega es un `role: string` leído de la base de datos, no un
 * `CompanyRole` ya validado -- así se puede indexar sin pelear con TS,
 * igual que en el código original que reemplaza.
 */
export const ROLE_LABELS: Record<string, string> = ROLE_REGISTRY.reduce(
  (acc, r) => ({ ...acc, [r.id]: r.label }),
  {} as Record<string, string>
)
