# 🔧 Cambios CSS Específicos - Implementación Paso a Paso

## 📋 Tabla de Contenidos
1. Cambios globales (app/layout.tsx)
2. Cambios en dashboard layout
3. Cambios en header
4. Cambios en footer
5. Cambios en tablas/componentes

---

## 1️⃣ CAMBIOS GLOBALES - `src/app/layout.tsx`

### Cambio: Background color más neutro

**ANTES:**
```tsx
<div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: '#faf8f6' }}>
```

**DESPUÉS:**
```tsx
<div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: '#f9fafb' }}>
```

**Por qué:** Neutral gray es más profesional que warm beige

---

## 2️⃣ CAMBIOS DASHBOARD LAYOUT - `src/app/(dashboard)/layout.tsx`

### Cambio 1: Aumentar padding del main

**ANTES:**
```tsx
<main className="flex-1 overflow-y-auto p-5">
```

**DESPUÉS:**
```tsx
<main className="flex-1 overflow-y-auto p-6">
```

**Por qué:** p-5=20px, p-6=24px. Más respiro para premium look

---

## 3️⃣ CAMBIOS EN HEADER - `src/components/layout/header.tsx`

### Cambio 1: Aumentar tamaño de empresa

**ANTES:**
```tsx
<span className="text-[13px] font-semibold text-zinc-800">
```

**DESPUÉS:**
```tsx
<span className="text-[15px] font-semibold text-zinc-900">
```

**Por qué:** Más visible, texto-base más oscuro

---

### Cambio 2: Mejorar breadcrumb

**ANTES:**
```tsx
<div className="flex items-center gap-1.5 text-xs">
  <span className="text-zinc-500 font-medium">{moduleName}</span>
  {tabName && (
    <>
      <span className="text-zinc-300">/</span>
      <span className="text-zinc-400">{tabName}</span>
    </>
  )}
</div>
```

**DESPUÉS:**
```tsx
<div className="flex items-center gap-2 text-[13px]">
  <span className="text-zinc-600 font-medium">{moduleName}</span>
  {tabName && (
    <>
      <span className="text-zinc-300">/</span>
      <span className="text-zinc-500">{tabName}</span>
    </>
  )}
</div>
```

**Cambios:**
- `text-xs` → `text-[13px]` (más legible)
- `gap-1.5` → `gap-2` (más aire)
- `text-zinc-500` → `text-zinc-600` (más visible)
- `text-zinc-400` → `text-zinc-500` (más visible)

---

### Cambio 3: Iconos más refinados

**ANTES:**
```tsx
<button className="relative flex items-center justify-center h-9 w-9 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors group">
  <Bell className="h-4 w-4" />
```

**DESPUÉS:**
```tsx
<button className="relative flex items-center justify-center h-10 w-10 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors group">
  <Bell className="h-4 w-4" />
```

**Cambios:**
- `h-9 w-9` → `h-10 w-10` (un poco más grandes)
- `text-zinc-600` → `text-zinc-500` (más neutro)
- `hover:bg-zinc-50` → `hover:bg-zinc-100` (más evidente)

---

## 4️⃣ CAMBIOS EN FOOTER - `src/components/layout/footer.tsx`

### Cambio 1: Font size y spacing

**ANTES:**
```tsx
<footer className="flex h-10 shrink-0 items-center justify-between border-t border-zinc-200/80 bg-white px-5 text-xs text-zinc-500">
  <div className="flex items-center gap-1">
```

**DESPUÉS:**
```tsx
<footer className="flex h-10 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-5 text-[12px] text-zinc-600">
  <div className="flex items-center gap-2">
```

**Cambios:**
- `text-xs` → `text-[12px]` (un poco más grande)
- `text-zinc-500` → `text-zinc-600` (más visible)
- `gap-1` → `gap-2` (más espaciado)
- `border-zinc-200/80` → `border-zinc-200` (más visible)

---

## 5️⃣ CAMBIOS EN PÁGINA DE VENTAS - `src/app/(dashboard)/sales/page.tsx`

### Cambio 1: Aumentar gap entre secciones

**ANTES:**
```tsx
<div className="flex flex-col gap-3">
```

**DESPUÉS:**
```tsx
<div className="flex flex-col gap-4">
```

**Por qué:** 12px → 16px. Más aire entre tabs, toolbar, tabla

---

### Cambio 2: Mejorar espaciado de tablas (en `modules/sales/components/invoices-table.tsx` u otro)

Si tienes una tabla renderizada con clases, busca:

**ANTES:**
```tsx
<div className="table-container">
  <table>
    <thead>
      <tr>
        <th className="px-4 py-3 text-xs font-semibold">
```

**DESPUÉS:**
```tsx
<div className="table-container rounded-2xl shadow-md border border-zinc-100">
  <table>
    <thead>
      <tr>
        <th className="px-4 py-3 text-[12px] font-semibold text-zinc-700 bg-zinc-50">
```

**Cambios:**
- Agregar `shadow-md` (en lugar de `shadow-sm`)
- Agregar `border border-zinc-100`
- `text-xs` → `text-[12px]`
- Agregar `text-zinc-700`
- `bg-zinc-50/50` → `bg-zinc-50`

---

## 6️⃣ CAMBIOS EN TOOLBARS/BOTONES

Si usas `ModuleToolbar`, busca los botones en `src/components/ui/module-toolbar.tsx`:

### Cambio: Padding de botones

**ANTES:**
```tsx
<button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium">
```

**DESPUÉS:**
```tsx
<button className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium">
```

**Cambios:**
- `px-3` → `px-4` (más padding horizontal)
- `py-2` → `py-2.5` (más padding vertical)
- `text-xs` → `text-sm` (más legible)
- `gap-1.5` → `gap-2` (más aire)

---

## 📋 RESUMEN DE CAMBIOS

```
┌─────────────────────────────────────────────────────┐
│ Archivo                    │ Cambios                 │
├─────────────────────────────────────────────────────┤
│ layout.tsx (root)          │ BG color: #f9fafb       │
│ dashboard/layout.tsx       │ p-5 → p-6               │
│ layout/header.tsx          │ 5 cambios tipográficos  │
│ layout/footer.tsx          │ 3 cambios tipográficos  │
│ sales/page.tsx            │ gap-3 → gap-4           │
│ módulos varios             │ Sombras, borders, text  │
└─────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1 - Cambios Críticos (30 min):
- [ ] Cambiar background en layout.tsx: `#faf8f6` → `#f9fafb`
- [ ] Aumentar padding main: `p-5` → `p-6`
- [ ] Aumentar gap sales: `gap-3` → `gap-4`
- [ ] Aumentar empresa font: `text-[13px]` → `text-[15px]`

### Fase 2 - Refineamiento (1 hora):
- [ ] Mejorar header breadcrumb
- [ ] Ajustar iconos
- [ ] Mejorar footer
- [ ] Actualizar botones

### Fase 3 - Tablas (1-2 horas):
- [ ] Actualizar sombras (shadow-sm → shadow-md)
- [ ] Ajustar font sizes en headers
- [ ] Mejorar padding
- [ ] Refinar borders

---

## 🎨 COLORES FINALES (Mantener)

```css
Background:     #f9fafb (zinc-50)      ← NUEVO
Sidebar:        #18181b (zinc-950)     ✅
Cards:          #ffffff                 ✅
Accent:         #2563eb (blue-600)     ✅
Text primary:   #27272a (zinc-900)     ✅
Text secondary: #52525b (zinc-600)     ← MÁS OSCURO
Borders:        #e4e4e7 (zinc-200)     ✅
```

---

## 🚀 PRÓXIMOS PASOS

1. **Implementar Fase 1** (cambios críticos)
2. **Verificar visualmente** en navegador
3. **Captura de pantalla** para comparación
4. **Implementar Fase 2** (refineamiento)
5. **Implementar Fase 3** (tablas)
6. **Aplicar a otros módulos** (usando este mismo patrón)

---

## 💡 TIPS IMPORTANTES

**Orden de implementación:**
1. Global (background)
2. Layout (padding, spacing)
3. Header (mayor impacto visual)
4. Footer
5. Contenido (tablas, botones)

**Cómo verificar:**
- Abrir DevTools (F12)
- Ir a Elements
- Buscar las clases que vamos a cambiar
- Editar en tiempo real para ver cambios
- Copiar a los archivos

**Si algo no se ve bien:**
- Limpiar cache: `npm run build` o `rm -rf .next`
- Recargar página: Ctrl+Shift+R (hard refresh)
- Verificar clases con DevTools

---

*Documento de implementación detallado*  
*Cambios listos para copiar-pegar*  
*Estimado: 2-3 horas de implementación total*
