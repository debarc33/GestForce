'use client'

/**
 * Gestión de categorías de productos (crear, renombrar, eliminar).
 *
 * Antes solo existía un diálogo de "Nueva categoría" (crear por nombre,
 * sin lista, sin editar, sin eliminar, sin ver el consecutivo). Este
 * componente lo reemplaza con una pantalla completa: lista con número
 * consecutivo (por orden de creación) y cantidad de productos por
 * categoría, renombrar en línea, y eliminar con bloqueo si la
 * categoría tiene productos asignados (mismo criterio que ya se usa
 * para no poder borrar productos con historial).
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Check, X, Ban } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  createCategory, updateCategory, deleteCategory,
  useCategoriesWithCounts, type CategoryWithCount,
} from '../queries'
// NOTA (23 oct 2026): este archivo tuvo por un momento un bloque de
// diagnóstico temporal (useDebugInfo + recuadro amarillo) para encontrar
// el bug de "no cargan las categorías". Ya se encontró la causa real
// (ver queries.ts: useCategoriesWithCounts ordenaba por una columna
// `created_at` que la tabla no tiene) y se quitó ese diagnóstico -- este
// componente vuelve a ser solo el diálogo de gestión de categorías.

interface CategoryManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

const inputClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'

export function CategoryManager({ open, onOpenChange, companyId }: CategoryManagerProps) {
  const queryClient = useQueryClient()
  const { data: categories = [], isLoading, isError, error: listError } = useCategoriesWithCounts(companyId)

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [blockedDelete, setBlockedDelete] = useState<CategoryWithCount | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CategoryWithCount | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['categories_with_counts', companyId] })
    queryClient.invalidateQueries({ queryKey: ['categories', companyId] })
  }

  const createMutation = useMutation({
    mutationFn: () => createCategory({ name: newName.trim(), company_id: companyId }),
    onSuccess: () => { setNewName(''); invalidate() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, name),
    onSuccess: () => { setEditingId(null); invalidate() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => { setConfirmDelete(null); invalidate() },
  })

  function startEdit(cat: CategoryWithCount) {
    setEditingId(cat.id)
    setEditingName(cat.name)
  }

  function handleDeleteClick(cat: CategoryWithCount) {
    if (cat.product_count > 0) {
      setBlockedDelete(cat)
    } else {
      setConfirmDelete(cat)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">Categorías</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              Crea, renombra o elimina las categorías de productos de tu empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {/* Crear nueva */}
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate()}
                className={inputClass}
                placeholder="Nueva categoría..."
              />
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white shrink-0"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear'}
              </Button>
            </div>
            {createMutation.isError && (
              <p className="text-sm text-red-500">
                {createMutation.error instanceof Error ? createMutation.error.message : 'Error al crear la categoría'}
              </p>
            )}

            {/* Lista */}
            <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-100 divide-y divide-zinc-100">
              {isLoading ? (
                <p className="p-4 text-sm text-zinc-400 text-center">Cargando...</p>
              ) : isError ? (
                <p className="p-4 text-sm text-red-500 text-center">
                  No se pudieron cargar las categorías
                  {listError instanceof Error ? `: ${listError.message}` : ''}
                </p>
              ) : categories.length === 0 ? (
                <p className="p-4 text-sm text-zinc-400 text-center">Aún no hay categorías.</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500">
                      {String(cat.seq).padStart(2, '0')}
                    </span>
                    {editingId === cat.id ? (
                      <>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingName.trim()) {
                              updateMutation.mutate({ id: cat.id, name: editingName.trim() })
                            }
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          className={inputClass + ' py-1.5'}
                          autoFocus
                        />
                        <button
                          onClick={() => editingName.trim() && updateMutation.mutate({ id: cat.id, name: editingName.trim() })}
                          disabled={updateMutation.isPending}
                          className="shrink-0 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Guardar"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition-colors"
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-sm text-zinc-800">{cat.name}</span>
                        <span className="shrink-0 text-xs text-zinc-400">
                          {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
                        </span>
                        <button
                          onClick={() => startEdit(cat)}
                          className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 transition-colors"
                          title="Renombrar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(cat)}
                          className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-red-500">
                {updateMutation.error instanceof Error ? updateMutation.error.message : 'Error al renombrar la categoría'}
              </p>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-200">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No se puede eliminar: tiene productos asignados */}
      <Dialog open={!!blockedDelete} onOpenChange={(v) => !v && setBlockedDelete(null)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-900">No se puede eliminar</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-600 leading-relaxed">
              La categoría &quot;{blockedDelete?.name}&quot; tiene {blockedDelete?.product_count}{' '}
              {blockedDelete?.product_count === 1 ? 'producto asignado' : 'productos asignados'}.
              Reasigna o elimina esos productos antes de poder borrar esta categoría.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button
              onClick={() => setBlockedDelete(null)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Entendido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !deleteMutation.isPending && !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-900">
              ¿Eliminar la categoría &quot;{confirmDelete?.name}&quot;?
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
