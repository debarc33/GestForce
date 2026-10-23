import { redirect } from 'next/navigation'

/**
 * Antigua página de Inventario en inglés (versión incompleta: nunca
 * tuvo la pestaña de Productos). El módulo se renombró a /inventario
 * (español) en algún momento anterior a esta sesión, pero esta página
 * vieja se quedó en el código sin que nada la actualizara.
 *
 * Se deja como redirección en vez de eliminarse por completo para que
 * cualquier enlace o atajo antiguo que apunte a /inventory siga
 * funcionando sin dar un error 404 (el atajo de teclado "G I" del
 * buscador rápido ya se corrigió para ir directo a /inventario, 22 oct
 * 2026, pero esta redirección queda como respaldo adicional).
 */
export default function InventoryRedirect() {
  redirect('/inventario')
}
