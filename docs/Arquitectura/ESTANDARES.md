# Estándares de GestForce v1.0

**Vigente desde:** 2026-07-14
**Basado en:** [ADR-001](./ADR/ADR-001.md), [ADR-002](./ADR/ADR-002.md), [ADR-003](./ADR/ADR-003.md)
**Estado:** Documento vivo — se actualiza cuando un nuevo ADR lo motiva, no editando reglas pasadas sin dejar registro.

Este documento responde **cómo se hace** las cosas en GestForce. El **por qué** de cada regla vive en su ADR correspondiente, en `docs/Arquitectura/ADR/`. Cuando exista duda de "¿esto dónde va?", la respuesta está aquí. Si un caso no está cubierto, se discute, se decide, se documenta como un ADR nuevo y **luego** se refleja aquí.

---

## 1. Mapa general

```
src/
  app/            → SOLO páginas, layouts, route handlers (Next.js App Router)
  modules/        → TODA la lógica de negocio, organizada por dominio
  components/ui/  → primitivos de UI compartidos (botones, cards, tablas base)
  hooks/          → hooks genéricos, sin dominio de negocio
  types/          → tipos genéricos, sin dominio de negocio
  lib/            → utilidades técnicas (no de negocio)
  services/       → SOLO servicios transversales (correo, pagos)
  store/          → estado global (zustand)
  config/         → configuración/registro central (ej. módulos del sistema)
```

No existe una carpeta `shared/` como tal — su rol lo cumplen `components/ui/`, `hooks/`, `types/` y `lib/` (ver sección 5). No crear una carpeta `shared/` nueva; sería un cajón de sastre duplicado.

---

## 2. ¿Qué va en `app/`?

**Solo:**
- `page.tsx`
- `layout.tsx`
- `route.ts`
- `loading.tsx`
- `error.tsx`

Una página puede tener JSX de presentación, y puede llamar hooks/queries/actions importados de `modules/<dominio>`. Lo que **no puede** hacer es:
- Definir queries de Supabase inline.
- Definir funciones de cálculo o transformación de datos de negocio.
- Contener formularios completos con su propia lógica de validación/envío (eso vive en `modules/<dominio>/components`).

**Prueba rápida:** si una página de `app/` supera ~100-150 líneas o tiene funciones que no son JSX de layout, esa lógica probablemente pertenece a `modules/`.

---

## 3. ¿Qué va en `modules/`?

Toda la lógica de negocio de un dominio: queries, mutations, componentes específicos del dominio, cálculos, validaciones, tipos del dominio.

Módulos actuales: `accounting`, `auth`, `company`, `customers`, `finances`, `inventory`, `payroll`, `products`, `purchases`, `sales`, `settings`, `subscription`, `suppliers`, `team`.

Regla de nombres: el nombre del módulo en `modules/` debe coincidir con el nombre de ruta en `app/` (ej. `modules/sales` ↔ `app/(dashboard)/sales`). Si no coinciden (como `app/inventory` vs `app/inventario` hoy), es una señal de deuda a resolver antes de migrar ese módulo.

---

## 4. Estructura interna de un módulo

```
modules/<dominio>/
  components/     # obligatoria si el módulo tiene UI propia
  hooks/           # opcional — solo si el módulo necesita hooks propios
  services/        # opcional — solo si hay lógica de acceso a datos/orquestación no trivial
  types/           # opcional — solo si el módulo tiene tipos propios más allá de los de queries.ts
  schemas/         # obligatoria si el módulo tiene formularios (validación Zod)
  actions/         # opcional — Server Actions específicas del módulo
  utils/           # opcional — helpers puros específicos del dominio
  constants/       # opcional — enums, listas fijas propias del dominio
  queries.ts       # patrón actual del repo — se mantiene mientras no crezca demasiado
```

Está bien crear una carpeta vacía (o con un solo archivo) desde el inicio si se sabe que va a crecer — evita reestructurar después. No está bien crear las 8 carpetas "por si acaso" en un módulo que nunca las va a usar (ej. un módulo pequeño de solo lectura no necesita `actions/`).

**Cuándo dividir `queries.ts` en `services/`:** cuando el archivo supera ~300 líneas o mezcla más de un sub-dominio (ej. `sales` mezclando cotizaciones, facturas y recibos) — ahí se separa en `services/quote.service.ts`, `services/invoice.service.ts`, `services/receipt.service.ts`.

---

## 5. ¿Qué pertenece a lo "compartido" (`shared`)?

No hay carpeta `shared/` literal. El código compartido entre módulos vive en una de estas, según su naturaleza:

| Tipo de código | Va en |
|---|---|
| Componente de UI sin lógica de negocio (Button, GlassCard, Dialog, Table base) | `components/ui/` |
| Hook genérico, reutilizable en cualquier proyecto (useDebounce, useMediaQuery, useDarkMode) | `hooks/` (raíz) |
| Tipo genérico sin dominio (respuesta de API genérica, tipos de Supabase generados, tipo común de paginación) | `types/` (raíz) |
| Utilidad técnica pura (formateo, export a Excel, cliente Supabase, generación de XML/CUFE para facturación electrónica) | `lib/` |
| Lógica que menciona un concepto de negocio de GestForce (factura, cotización, empleado, comisión) | **nunca aquí** → va en `modules/<dominio>` |

**Prueba rápida:** si al leer el archivo hay que saber qué es una "cotización" o una "nómina" para entenderlo, no es código compartido — es de un módulo.

---

## 6. ¿Qué pertenece a `lib/`?

Utilidades técnicas, agnósticas del dominio de negocio de GestForce. Ejemplos ya existentes que **sí** califican:

- `lib/supabase/*` — clientes de Supabase (admin, client, server, middleware)
- `lib/format-cop.ts` — formateo de moneda
- `lib/export-excel.ts` — exportación genérica a Excel
- `lib/utils.ts` — helpers genéricos (cn, etc.)
- `lib/fe/*` (CUFE, XML UBL 2.1) — es técnico (implementa un estándar DIAN), aunque toca facturación; se queda en `lib` porque es infraestructura de facturación electrónica reutilizable, no lógica de negocio de "cómo se calcula una factura en GestForce".
- `lib/auth/require-company-admin.ts` — guard técnico de autorización

Si mañana se agrega algo como `lib/calcular-comision.ts`, eso **no** es `lib` — es lógica de negocio de Nómina y va en `modules/payroll/services/`.

---

## 7. ¿Cuándo crear un servicio global vs. un servicio de módulo?

| Pregunta | Respuesta |
|---|---|
| ¿El servicio lo usa un solo módulo? | `modules/<dominio>/services/` |
| ¿El servicio lo usan 2+ módulos pero es sobre un concepto de negocio de GestForce? | Se evalúa: probablemente el concepto merece su propio módulo, o uno de los módulos expone una función pública que el otro importa. No crear un tercer lugar. |
| ¿El servicio es sobre algo que no es negocio de GestForce en sí — es infraestructura pura usada por cualquier módulo? (enviar correo, cobrar con Bold/Wompi/Stripe) | `services/` (raíz) — servicio transversal |

`services/` en la raíz queda reservado exclusivamente para lo transversal. Hoy contiene correctamente: `email.ts`, `bold.ts`, `payment-provider.ts`, `subscription-checkout.ts`. No debe crecer con archivos por dominio (`sales.ts`, `customers.ts`, etc.) — eso migra a `modules/<dominio>/services/`.

---

## 8. Checklist para crear un módulo nuevo

1. Crear `app/(dashboard)/<nombre-ruta>/page.tsx` — solo la página.
2. Crear `modules/<dominio>/queries.ts` con las queries/mutations iniciales.
3. Crear `modules/<dominio>/components/` si hay UI propia.
4. Crear `modules/<dominio>/schemas.ts` (o carpeta `schemas/` si hay varios formularios) si hay validación Zod.
5. Agregar el módulo a `config/modules.ts` si debe aparecer en el sidebar / ser activable por empresa.
6. Registrar el nombre del módulo consistente entre `app/` y `modules/` (ver sección 3).
7. Crear `hooks/`, `services/`, `types/`, `actions/`, `utils/`, `constants/` **solo cuando haga falta**, no por adelantado.

---

## 9. Carpetas obligatorias vs. opcionales — resumen

**Obligatorias siempre:**
- `modules/<dominio>/queries.ts` (o su reemplazo en `services/` si ya migró)
- `modules/<dominio>/components/` si el módulo tiene UI propia

**Obligatorias condicionalmente:**
- `modules/<dominio>/schemas/` — si el módulo tiene formularios
- `modules/<dominio>/services/` — si `queries.ts` supera ~300 líneas o mezcla sub-dominios

**Opcionales (crear solo cuando se necesiten):**
- `hooks/`, `types/`, `actions/`, `utils/`, `constants/` dentro de cada módulo

---

## 10. Disciplina de limpieza de la raíz

Ver [ADR-003](./ADR/ADR-003.md) para el detalle. Resumen:

- **Se puede limpiar sin revisión previa:** temporales, documentación duplicada, logs, archivos generados para análisis.
- **Requiere revisión previa:** cualquier cosa que pueda afectar código en ejecución (scripts no evidentemente de un solo uso, carpetas con trabajo en progreso, archivos referenciados desde configuración).

---

## 11. Lo que NO se toca

- `components/ui/`
- `store/`
- `app/api/`
- `(superadmin)/`

(Heredado de ADR-002, sigue vigente.)

---

## 12. Gobernanza de este documento

- Este archivo es la versión **v1.0**.
- Cualquier cambio de regla arquitectónica se decide primero como un nuevo ADR (`docs/Arquitectura/ADR/ADR-004.md`, ...) y luego se refleja aquí, subiendo la versión (v1.1, v2.0, etc.) con una nota de qué ADR lo motivó.
- No se edita este documento "sobre la marcha" sin el ADR correspondiente — eso es exactamente lo que la Fase 1 buscaba evitar.
