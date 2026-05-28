# 🎨 Estándares de Diseño Premium - GestForce ERP

## Fecha de Implementación
- Módulo Ventas: 2026-05-21 ✅
- Otros módulos: Por implementar

---

## 📐 Estructura General (Todos los módulos)

### Layout Principal
```
┌─────────────────────────────────────────────┐
│ Empresa │ Módulo / Pestaña │ 🔔 ? │ Usuario │  <- Header h-11
├─────────────────────────────────────────────┤
│                                              │
│           CONTENIDO DEL MÓDULO              │  <- Main con p-5
│                                              │  <- Flex-1 overflow-y-auto
│                                              │
├─────────────────────────────────────────────┤
│ © 2026 QS Tech... │ ❤️ Para empresas...    │  <- Footer h-10
└─────────────────────────────────────────────┘
```

---

## 📋 Componentes Estándar

### 1. **Header** ✅ Implementado
- **Ubicación**: `src/components/layout/header.tsx`
- **Alto**: `h-11` (44px)
- **Contenido izquierda**: Nombre de empresa activa
- **Contenido centro**: Breadcrumb (Módulo / Pestaña activa)
- **Contenido derecha**: 
  - 🔔 Notificaciones (con badge animado)
  - ❓ Ayuda/Soporte
  - 👤 Usuario con dropdown

### 2. **Footer** ✅ Implementado  
- **Ubicación**: `src/components/layout/footer.tsx`
- **Alto**: `h-10` (40px)
- **Contenido izquierda**: `© 2026 QS Solution Tech — Todos los derechos reservados`
- **Contenido derecha**: `Hecho con ❤️ para empresas que crecen`

### 3. **Sidebar**
- **Ubicación**: `src/components/layout/sidebar.tsx`
- **Color**: `bg-zinc-950` (fondo oscuro elegante)
- **Ya existente** ✅

---

## 🎨 Paleta de Colores (Mantenida)

```css
Sidebar:      bg-zinc-950      /* Fondo oscuro elegante */
Fondo:        bg-zinc-100      /* Gris claro (heredado: #f0efed) */
Cards:        bg-white         /* Blanco puro */
Accent:       blue-600         /* Azul profundo */
Borders:      zinc-200         /* Bordes sutiles */
Hover:        zinc-50/50       /* Hover suave */
```

---

## 📑 Patrón de Página (Módulos con Tabs)

### Estructura base en `page.tsx`:

```tsx
<div className="flex flex-col gap-3">
  {/* NO repetir título del módulo - ya está en sidebar + header */}
  
  {/* Tabs tipo archivador */}
  <div className="flex items-end gap-0.5 border-b border-zinc-300/60">
    {TABS.map((tab) => (
      <button
        onClick={() => handleTabChange(tab.id)}
        // ... clases de pestaña
      >
        {tab.label}
        <span>{count}</span>
      </button>
    ))}
  </div>

  {/* Toolbar (buscar, filtrar, acciones) */}
  <ModuleToolbar {...toolbarProps} />

  {/* Contenido del tab activo */}
  {activeTab === 'tab1' && <Table1 />}
  {activeTab === 'tab2' && <Table2 />}
  
  {/* Dialogs y modales */}
</div>
```

### Requisitos:
1. **NO incluir título** repetido en la página (ya está en sidebar)
2. **actualizar URL** cuando cambias de tab para que header lo detecte:
   ```tsx
   const handleTabChange = (tab: TabId) => {
     setActiveTab(tab)
     router.push(`/sales?tab=${tab}`)  // ← IMPORTANTE
     setSearch('')
     setFilter('all')
   }
   ```
3. **Tabs deben ser claras** - mostrar contador de items
4. **Toolbar consistente** - buscar, filtrar, agregar, eliminar, exportar

---

## 🔄 Implementación en Otros Módulos

Cuando implementes otros módulos, sigue este checklist:

- [ ] **Importar Footer** en `src/app/(dashboard)/layout.tsx`
- [ ] **Remover título redundante** de la página del módulo
- [ ] **Implementar tabs** con `router.push()` para actualizar URL
- [ ] **ModuleToolbar** con acciones consistentes
- [ ] **Dialogs y modales** con estilos premium (`rounded-2xl`, `shadow-xl`)

---

## 🎯 Módulos Completados

### ✅ Ventas (`/sales`)
- **Pestaña**: Cotizaciones, Facturas, Recibos, Clientes
- **Acciones**: Crear, Eliminar, Exportar Excel
- **Estado**: Implementado 2026-05-21

---

## 🚀 Próximos Módulos por Implementar

1. **Compras** (`/purchases`)
   - Pestaña: Órdenes de Compra, Facturas Proveedor, Pagos, Proveedores
   
2. **Productos** (`/products`)
   - Pestaña: Catálogo, Categorías, Proveedores
   
3. **Inventario** (`/inventory`)
   - Pestaña: Movimientos, Kardex, Ajustes
   
4. **Finanzas** (`/finances`)
   - Pestaña: Panel, Cartera, Obligaciones, Impuestos
   
5. **Contabilidad** (`/accounting`)
   - Pestaña: Plan de Cuentas, Comprobantes, Informes
   
6. **Nómina** (`/payroll`)
   - Pestaña: Empleados, Liquidar, Historial, Aportes PILA, Ausencias, Prestaciones

---

## 💡 Notas de Implementación

### Breadcrumb inteligente
El header ya detecta automáticamente:
- **Módulo actual** basado en `pathname`
- **Pestaña actual** basado en `searchParams.get('tab')`

Esto funciona para todos los módulos que sigan el patrón de actualizar la URL en `handleTabChange`.

### Responsividad
- **Desktop**: Todos los elementos visibles
- **Tablet**: Sidebar oculto, se muestra con botón hamburguesa
- **Mobile**: Sidebar colapsable, header más compacto

---

## 🔐 Estándares de Seguridad

- Todo `company_id` debe estar en los queries
- RLS policies actualizadas
- No hardcodear UUIDs
- Usar Zustand store para tenant management

---

*Documento actualizado: 2026-05-21 v1.0*
