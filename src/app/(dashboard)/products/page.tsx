import { redirect } from 'next/navigation'

/**
 * Antigua página independiente de Productos.
 *
 * El catálogo de productos (con categorías, importar/exportar, etc.)
 * ahora vive solo dentro de /inventario (pestaña "Productos"), para no
 * mantener dos implementaciones separadas del mismo formulario y
 * tabla -- eso fue justamente lo que causó que un arreglo al botón de
 * categorías se aplicara aquí pero se quedara pendiente en la otra
 * pantalla (22 oct 2026).
 *
 * Se deja como redirección en vez de eliminarse por completo para que
 * cualquier enlace o atajo antiguo que apunte a /products (el buscador
 * rápido Ctrl/Cmd+K lo usaba, y la campanita de notificaciones de
 * stock bajo también) siga funcionando sin dar un error 404.
 */
export default function ProductsRedirect() {
  redirect('/inventario')
}
