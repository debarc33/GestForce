/**
 * Mensaje y helper compartidos para cuando un rol con acceso "Solo ver"
 * (Configuración → Roles y permisos) intenta una acción que solo "Puede
 * editar" permite -- crear, editar, eliminar, aprobar, registrar pago, etc.
 * El nivel de acceso aplica al MÓDULO COMPLETO (Ventas, Finanzas, etc.),
 * no pantalla por pantalla.
 *
 * Por ahora el bloqueo es solo en pantalla (no en el servidor) -- ver
 * notas en migración 032 y en roles-permissions-panel.tsx.
 */
export const NO_EDIT_ACCESS_MESSAGE = 'Tu usuario no tiene permitido editar en este módulo, solo puedes consultar.'

export function alertNoEditAccess() {
  window.alert(NO_EDIT_ACCESS_MESSAGE)
}
