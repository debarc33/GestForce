'use client'

import { useEffect, useRef } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productFormSchema, type ProductFormValues, UNITS } from '../schemas'
import { createProduct, updateProduct, useCategories } from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'

type Product = {
  id: string
  name: string
  sku: string | null
  description: string | null
  price: number
  precio_compra: number | null
  margen_ganancia: number | null
  stock: number
  stock_minimum: number
  unit: string
  category_id: string | null
  tax_type: string
  tax_rate: number
  is_taxable: boolean
}

interface ProductFormProps {
  product?: Product
  onSuccess?: () => void
}

const inp =
  'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'
const lbl = 'block text-xs font-medium text-muted-foreground mb-1'

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const queryClient = useQueryClient()
  const activeCompanyId = useCompanyStore((state) => state.activeCompanyId)
  const { data: categories = [] } = useCategories(activeCompanyId ?? undefined)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: '', sku: '', description: '',
      price: 0, precio_compra: 0, margen_ganancia: 30,
      stock: 0, stock_minimum: 0, unit: 'und',
      category_id: '', tax_type: 'iva' as const,
      tax_rate: 0.19, is_taxable: true,
    },
  })

  // Controla si Venta ya tiene "dueño" (un valor que no se debe pisar con
  // el cálculo automático): al editar un producto existente, su precio de
  // venta guardado siempre cuenta como ya puesto a mano. Al crear uno
  // nuevo, empieza en falso para que el cálculo automático funcione.
  //
  // No se usa simplemente "¿Venta está en 0?" porque eso se rompía al
  // escribir Compra dígito por dígito: con el primer dígito (ej. "3" de
  // "36000") Venta pasaba de 0 a 3.9 y, al dejar de estar "vacía", los
  // siguientes dígitos ya no la recalculaban -- quedaba pegada en 3.9 en
  // vez de 46.800 (reportado por Deisy, 27 oct 2026).
  const ventaTouchedRef = useRef(!!product)

  useEffect(() => {
    if (product) {
      ventaTouchedRef.current = true
      form.reset({
        name:        product.name,
        sku:         product.sku         ?? '',
        description: product.description ?? '',
        price:           product.price,
        precio_compra:   product.precio_compra   ?? 0,
        margen_ganancia: product.margen_ganancia ?? 30,
        stock:         product.stock,
        stock_minimum: product.stock_minimum ?? 0,
        unit:          product.unit        || 'und',
        category_id: product.category_id ?? '',
        tax_type:    (product.tax_type ?? 'iva') as 'iva' | 'excluded' | 'exempt' | 'no_tax',
        tax_rate:    product.tax_rate    ?? 0.19,
        is_taxable:  product.is_taxable  ?? true,
      })
    } else {
      ventaTouchedRef.current = false
    }
  }, [product, form])

  const mutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      if (!activeCompanyId) throw new Error('Sin empresa activa.')
      if (product) return updateProduct(product.id, { ...values, company_id: activeCompanyId })
      return createProduct({ ...values, company_id: activeCompanyId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', activeCompanyId] })
      form.reset()
      ventaTouchedRef.current = false
      onSuccess?.()
    },
  })

  const taxType = form.watch('tax_type')

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">

      {/* Nombre + SKU */}
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div>
          <label className={lbl}>Nombre <span className="text-red-500">*</span></label>
          <input {...form.register('name')} className={inp} placeholder="Ej. Camisa de algodón" />
          {form.formState.errors.name && (
            <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div>
          <label className={lbl}>SKU / Ref.</label>
          <input {...form.register('sku')} className={inp} placeholder="CAM-001" />
        </div>
      </div>

      {/* Compra + Venta + Margen */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Compra</label>
          <input
            {...form.register('precio_compra', {
              onChange: (e) => {
                // Mientras Venta no haya sido tocada a mano, se recalcula
                // en cada dígito que se escribe en Compra (ver nota junto a
                // ventaTouchedRef más arriba).
                if (ventaTouchedRef.current) return
                const compra = Number(e.target.value) || 0
                const margen = form.getValues('margen_ganancia') || 0
                form.setValue('price', Number((compra * (1 + margen / 100)).toFixed(2)))
              },
            })}
            type="number" min="0" step="0.01"
            className={inp} placeholder="0"
            title="Lo que te cuesta comprar o producir este producto" />
          {form.formState.errors.precio_compra && (
            <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.precio_compra.message}</p>
          )}
        </div>
        <div>
          <label className={lbl}>Venta <span className="text-red-500">*</span></label>
          <input
            {...form.register('price', {
              // Si la clienta escribe aquí directamente, Venta queda
              // "tocada" y el cálculo automático deja de pisarla.
              onChange: () => { ventaTouchedRef.current = true },
            })}
            type="number" min="0" step="0.01"
            className={inp} placeholder="0"
            title="Precio al que se vende -- este es el que se usa en cotizaciones y facturas" />
          {form.formState.errors.price && (
            <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.price.message}</p>
          )}
        </div>
        <div>
          <label className={lbl}>Margen (%)</label>
          <input
            {...form.register('margen_ganancia', {
              onChange: (e) => {
                if (ventaTouchedRef.current) return
                const margen = Number(e.target.value) || 0
                const compra = form.getValues('precio_compra') || 0
                if (compra) {
                  form.setValue('price', Number((compra * (1 + margen / 100)).toFixed(2)))
                }
              },
            })}
            type="number" min="0" step="1"
            className={inp} placeholder="30"
            title="Porcentaje de ganancia sobre el precio de compra, usado para proponer el precio de Venta" />
          {form.formState.errors.margen_ganancia && (
            <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.margen_ganancia.message}</p>
          )}
        </div>
      </div>

      {/* Stock + Stock mínimo + Unidad */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Stock <span className="text-red-500">*</span></label>
          <input {...form.register('stock')} type="number" min="0"
            className={inp} placeholder="0" />
          {form.formState.errors.stock && (
            <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.stock.message}</p>
          )}
        </div>
        <div>
          <label className={lbl}>Mínimo</label>
          <input {...form.register('stock_minimum')} type="number" min="0"
            className={inp} placeholder="0"
            title="Cuando el stock baje de este valor aparecerá una alerta de reposición" />
          {form.formState.errors.stock_minimum && (
            <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.stock_minimum.message}</p>
          )}
        </div>
        <div>
          <label className={lbl}>Unidad</label>
          <select {...form.register('unit')} className={inp}>
            {UNITS.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Categoría + Descripción */}
      <div className="grid grid-cols-[180px_1fr] gap-3">
        <div>
          <label className={lbl}>Categoría</label>
          <select {...form.register('category_id')} className={inp}>
            <option value="">Sin categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Descripción</label>
          <textarea {...form.register('description')} rows={2}
            className={inp} placeholder="Descripción opcional del producto..." />
        </div>
      </div>

      {/* IVA — inline */}
      <div className="rounded-lg glass-surface border border-[var(--glass-border)] px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Impuesto</p>
        <div className={`grid gap-3 ${taxType === 'iva' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className={lbl}>Tipo de IVA</label>
            <select
              {...form.register('tax_type', {
                onChange: (e) => {
                  const val = e.target.value
                  form.setValue('is_taxable', val === 'iva')
                  form.setValue('tax_rate', val === 'iva' ? 0.19 : 0)
                },
              })}
              className={inp}
            >
              <option value="iva">IVA (gravado)</option>
              <option value="excluded">Excluido de IVA</option>
              <option value="exempt">Exento de IVA</option>
              <option value="no_tax">Sin impuesto</option>
            </select>
          </div>
          {taxType === 'iva' && (
            <div>
              <label className={lbl}>Tarifa</label>
              <select
                value={form.watch('tax_rate')}
                onChange={(e) => form.setValue('tax_rate', Number(e.target.value))}
                className={inp}
              >
                <option value={0}>0 %</option>
                <option value={0.05}>5 %</option>
                <option value={0.19}>19 %</option>
              </select>
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {taxType === 'iva'
            ? `Se aplicará ${(form.watch('tax_rate') * 100).toFixed(0)}% IVA al vender este producto`
            : 'Este producto no genera IVA al ser vendido'}
        </p>
      </div>

      {mutation.isError && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : 'Error al guardar'}
        </p>
      )}

      <div className="flex justify-end pt-1 border-t border-[var(--glass-border)]">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending ? 'Guardando...' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}
