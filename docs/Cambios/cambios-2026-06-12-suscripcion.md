# Cambios — 12 jun 2026 · Suscripción, Configuración y fechas

Resumen de lo implementado en esta sesión, con foco en **funcionamiento** (no solo presentación).

---

## 1. Logo y barra de Configuración (presentación)

- **Sidebar**: se reemplazó el badge "GF" + subtítulo "ERP · Multiempresa" por el logo real (`public/logo.png`). Solo el logo, sin texto duplicado.
- **Configuración (`/settings`)**: la barra lateral ahora muestra **grupos** (Empresa, Fiscal, Equipo, Documentos, Suscripción, Personalización). Al entrar a un grupo, sus subsecciones aparecen como **acordeones colapsables** (componente `src/components/settings/settings-accordion.tsx`), evitando una página larga con scroll.
- Se recuperó la sección **"Usuarios y roles"** (grupo Equipo) que se había perdido en una edición previa.
- **Sin cambios de funcionalidad**: todos los formularios, botones Editar/Guardar, hooks y queries siguen igual; solo cambió la presentación.

## 2. Nueva sección "Suscripción" en Configuración (funcional)

Archivo UI: `src/components/settings/subscription-section.tsx`. El **admin de cada empresa** ahora puede:

- **Ver su plan**: período, estado (Activa/Pendiente/Vencida/Suspendida), fecha de inicio, vencimiento, días restantes y alertas (ámbar si vence ≤7 días, rojo si vencida, gris si suspendida).
- **Ver su historial de pagos** (tabla con monto, período, estado, fecha).
- **Renovar / cambiar plan**: selecciona período (3/6/12 meses) y va a la pasarela de pago (Bold). **No se registran tarjetas** — Bold procesa el pago externamente.
- Al volver de la pasarela (`?payment=success|cancelled`) aterriza en la sección con un banner de confirmación.

### Piezas nuevas que lo soportan

- `src/modules/subscription/constants.ts` — **fuente única** de precios y períodos (3_months/6_months/1_year). Provisionales: $299.000 / $499.000 / $799.000 COP. Los consumen el checkout de superadmin, el de empresa y la UI.
- `src/services/subscription-checkout.ts` — lógica de checkout compartida (crea la orden y la sesión de pago en Bold/Stripe). Extraída del checkout de superadmin para no duplicar.
- `src/lib/auth/require-company-admin.ts` — valida sesión + que el usuario sea **admin** de la empresa.
- `src/app/api/company/subscription/checkout/route.ts` — inicia el pago (solo admin de la empresa).
- `src/app/api/company/subscription/payments/route.ts` — historial de pagos (solo admin; lee con service role, nunca expone datos del proveedor).
- `src/modules/subscription/queries.ts` — hooks de cliente (`useCompanyPayments`, `startSubscriptionCheckout`).
- `src/modules/company/queries.ts` — se extendió el tipo `CompanyProfile` con los campos `subscription_*` (solo lectura).

> El checkout de superadmin existente quedó intacto (misma respuesta JSON); solo delega internamente en el servicio compartido.

## 3. Cambio en la lógica de cobro: "stacking" al pagar durante el trial (funcional)

Archivo: `src/app/api/webhooks/payment/route.ts`.

- **Antes**: al confirmarse un pago, el período arrancaba **el día del pago** (si pagabas en el día 5 del trial, perdías los 10 días restantes).
- **Ahora**: el período pagado arranca **desde el fin de la suscripción actual** si esta aún no venció. Es decir, `inicio = max(hoy, vencimiento_actual)` y `vence = inicio + período`. Así el cliente **no pierde** los días de prueba restantes. Si ya venció, arranca hoy.

## 4. Bug del trial corregido vía migración 011 (funcional)

- **Problema encontrado**: la migración 003 instaló un **trigger** en `companies` que forzaba `subscription_end = inicio + período` en cada INSERT/UPDATE. Esto **sobreescribía el trial**: los "15 días de prueba" en realidad duraban el período completo (1 año).
- **Solución**: nueva migración `supabase/migrations/011_drop_subscription_end_trigger.sql` que elimina ese trigger. A partir de ahí **la aplicación controla las fechas** explícitamente (creación = hoy + días de prueba; pago = stacking; ajuste manual = inicio + días definidos).
- **Pendiente**: aplicar la 011 en Supabase (ver sección Migraciones).

## 5. Panel de superadmin: fechas de suscripción editables (funcional)

Archivo: `src/app/(superadmin)/superadmin/companies/[id]/subscription/page.tsx`.

- Nuevo botón **"Editar fechas"** con:
  - **Fecha de inicio** (selector de fecha).
  - **Días gratis (prueba/cortesía)** → fija `vencimiento = inicio + N días`.
  - Vista previa del vencimiento resultante.
- Útil para dar prueba/cortesía a una empresa puntual o ajustar fechas manualmente. Requiere la migración 011 aplicada para que el campo "días" se respete (si no, el trigger lo sobreescribe).

## 6. Control de acceso / bloqueo (verificado, sin cambios)

Se auditó el control de acceso. **Hoy NO existe bloqueo del ERP por estado de suscripción**:

- El **superadmin** depende solo de `app_metadata.is_superadmin` → **nunca** se bloquea por suscripción.
- El **middleware** y el **layout del dashboard** no miran la suscripción.
- El **ModuleGuard** solo revisa módulos habilitados.
- El **cron** (`subscription-checker`) solo cambia estado a "expired" y manda email; **no quita acceso**.

Conclusión: una empresa vencida solo ve un banner y recibe correo; no se la saca. La empresa de prueba no se bloquea.

---

## Estado de migraciones (verificado 12 jun 2026)

| Migración | Estado |
|-----------|--------|
| 001 company_modules | ✅ Aplicada |
| 002 superadmins | ✅ Aplicada |
| 003 company_subscription | ✅ Aplicada (incluye el trigger a eliminar) |
| 005 commission_agent | ✅ Aplicada |
| 006 expenses | ✅ Aplicada |
| 007 payment_orders | ✅ Aplicada |
| 008 payment_events | ✅ Aplicada |
| 009 payment_providers | ✅ Aplicada |
| 010 ui_preferences | ✅ Aplicada |
| **011 drop_subscription_end_trigger** | ⏳ **PENDIENTE (única que falta)** |

> Nota: un error 500 visto antes ("payment_orders no existe") fue un **cache de esquema desactualizado** de PostgREST, no una tabla faltante. Verificado: las tablas de pago SÍ existen.

### Acción pendiente

Aplicar **solo la migración 011** en Supabase → SQL Editor (contenido en `supabase/migrations/011_drop_subscription_end_trigger.sql`). Es segura: usa `DROP ... IF EXISTS`.

Después: dejar la empresa de prueba activa 1 año desde Superadmin → empresa → Suscripción → "Editar fechas" (inicio = hoy, días = 365).
