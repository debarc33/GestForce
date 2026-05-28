# ✅ Checklist de Uniformidad - Aplicar a Todos los Módulos

## 📋 Pasos para Replicar el Estándar en Cada Módulo

### 1. **Estructura de Archivos** (✅ Ya hecho en Ventas)
```
✅ src/components/layout/header.tsx       (Actualizado)
✅ src/components/layout/footer.tsx       (NUEVO - Compartido)
✅ src/app/(dashboard)/layout.tsx         (Actualizado con Footer)
```

---

## 🔄 Checklist por Módulo

### Módulo: **Compras** (`/purchases`)
- [ ] Abrir `src/app/(dashboard)/purchases/page.tsx`
- [ ] **ELIMINAR**: Título duplicado en la parte superior (si existe)
- [ ] **ELIMINAR**: Frases descriptivas innecesarias (ej: "Gestión de compras")
- [ ] **ACTUALIZAR**: `handleTabChange` para actualizar URL:
  ```tsx
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    router.push(`/purchases?tab=${tab}`)  // ← IMPORTANTE
    setSearch('')
    setFilter('all')
  }
  ```
- [ ] **VERIFICAR**: Header automáticamente mostrará: "Compras / [Pestaña Activa]"
- [ ] **VERIFICAR**: Footer aparece en la parte inferior
- [ ] **REVISAR**: Responsive en móvil, tablet, desktop

### Módulo: **Productos** (`/products`)
- [ ] Abrir `src/app/(dashboard)/products/page.tsx`
- [ ] Seguir el mismo checklist que **Compras**
- [ ] Actualizar `router.push()` a `/products?tab=${tab}`

### Módulo: **Inventario** (`/inventory`)
- [ ] Abrir `src/app/(dashboard)/inventory/page.tsx`
- [ ] Seguir el mismo checklist que **Compras**
- [ ] Actualizar `router.push()` a `/inventory?tab=${tab}`

### Módulo: **Finanzas** (`/finances`)
- [ ] Abrir `src/app/(dashboard)/finances/page.tsx`
- [ ] Seguir el mismo checklist que **Compras**
- [ ] Actualizar `router.push()` a `/finances?tab=${tab}`
- [ ] Nota: Si tiene gráficos, mantener el mismo espaciado premium

### Módulo: **Contabilidad** (`/accounting`)
- [ ] Abrir `src/app/(dashboard)/accounting/page.tsx`
- [ ] Seguir el mismo checklist que **Compras**
- [ ] Actualizar `router.push()` a `/accounting?tab=${tab}`

### Módulo: **Nómina** (`/payroll`)
- [ ] Abrir `src/app/(dashboard)/payroll/page.tsx`
- [ ] Seguir el mismo checklist que **Compras**
- [ ] Actualizar `router.push()` a `/payroll?tab=${tab}`
- [ ] Nota: Si hay formularios sensibles, mantener validaciones RLS

### Módulo: **Configuración** (`/settings`)
- [ ] Abrir `src/app/(dashboard)/settings/page.tsx`
- [ ] Este módulo probablemente NO tiene tabs
- [ ] SOLO eliminar título duplicado si existe
- [ ] Header mostrará: "Configuración"

---

## 🎯 Cambios Comunes a Todos

### En cada `page.tsx`:

#### ANTES:
```tsx
<div className="flex flex-col gap-3">
  <div className="flex items-baseline justify-between">
    <h1 className="text-[17px] font-semibold text-zinc-900">Nombre Módulo</h1>
    <span className="text-[11px] text-zinc-400">Descripción innecesaria</span>
  </div>
  
  {/* Tabs y contenido */}
</div>
```

#### DESPUÉS:
```tsx
<div className="flex flex-col gap-3">
  {/* NO hay título - el sidebar lo muestra */}
  
  {/* Tabs y contenido directamente */}
</div>
```

### En `handleTabChange`:

#### ANTES:
```tsx
const handleTabChange = (tab: TabId) => {
  setActiveTab(tab)
  setSearch('')
  setFilter('all')
}
```

#### DESPUÉS:
```tsx
const handleTabChange = (tab: TabId) => {
  setActiveTab(tab)
  router.push(`/[RUTA-MODULO]?tab=${tab}`)  // ← Actualizar ruta
  setSearch('')
  setFilter('all')
}
```

---

## 🧪 Verificación Visual

Para cada módulo, después de hacer cambios:

1. **Ejecutar app** → `npm run dev`
2. **Navegar al módulo** → `/purchases`, `/products`, etc.
3. **Verificar header** → Debe mostrar: "NombreMódulo / NombrePestaña"
4. **Verificar footer** → Debe mostrar copyright + tagline
5. **Cambiar pestaña** → El breadcrumb debe actualizarse automáticamente
6. **Revisar móvil** → Responsive design funcionando

---

## 📋 Template Rápido

```tsx
// CAMBIO 1: En imports, si no está:
import { useRouter } from 'next/navigation'

// CAMBIO 2: En el componente, en handleTabChange:
const router = useRouter()  // Si no existe

const handleTabChange = (tab: TabId) => {
  setActiveTab(tab)
  router.push(`/[RUTA]?tab=${tab}`)  // ← NUEVO
  setSearch('')
  setFilter('all')
  setSelectedIds([])
}

// CAMBIO 3: Eliminar en JSX:
// ❌ Remover esto:
// <div className="flex items-baseline justify-between">
//   <h1>...</h1>
//   <span>...</span>
// </div>
```

---

## 🚀 Orden de Implementación Recomendado

1. **Ventas** ✅ HECHO (patrón base)
2. **Compras** (similar estructura con tabs)
3. **Productos** (similar a compras)
4. **Inventario** (similar a compras)
5. **Finanzas** (similar a compras)
6. **Contabilidad** (similar a compras)
7. **Nómina** (similar a compras, pero más formularios)
8. **Configuración** (sin tabs, más simple)

---

## 📊 Progreso

```
Módulos: 8 total

✅ Ventas (100%)
⬜ Compras (0%)
⬜ Productos (0%)
⬜ Inventario (0%)
⬜ Finanzas (0%)
⬜ Contabilidad (0%)
⬜ Nómina (0%)
⬜ Configuración (0%)

Progreso total: 12.5%
```

---

## 💡 Notas Importantes

- El **Footer es compartido** en `src/components/layout/footer.tsx` - No duplicar
- El **Header es compartido** en `src/components/layout/header.tsx` - No duplicar
- Los cambios son **mínimos** - Solo eliminar títulos redundantes y actualizar rutas
- El **diseño premium** ya está aplicado - Solo hay que quitar ruido visual

---

## ❓ Preguntas Comunes

**P: ¿Qué pasa si un módulo NO tiene tabs?**
R: Solo elimina el título duplicado en la parte superior. El header mostrará: "NombreMódulo"

**P: ¿El breadcrumb se actualiza solo?**
R: Sí, porque `header.tsx` lee `searchParams.get('tab')`. Solo asegúrate de actualizar la URL en `handleTabChange`.

**P: ¿Qué pasa si no actualizo la URL?**
R: El breadcrumb no mostrará la pestaña activa correctamente. El header solo verá `searchParams.get('tab')`, que será null.

**P: ¿Debo cambiar estilos de colores?**
R: No. Los colores ya están correctos (azul-600, zinc-950, etc.). Solo elimina texto redundante.

---

*Documento actualizado: 2026-05-21*
*Próximo paso: Implementar en módulo Compras*
