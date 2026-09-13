# GestForce — Especificación visual por módulo

> Para cada módulo: estructura, columnas exactas, toolbar, acciones y estados.
> Todo vestido con `GlassCard`/`GlassTable`/`Toolbar`. Datos vienen de tus hooks actuales.
> Referencia viva: abre `GestForce-respaldo.html` y navega el módulo para verlo.

Toolbar estándar (recordatorio): `[iconos imprimir/importar/exportar] [buscador flex] [filtros] [BOTÓN NUEVO derecha]`.

---

## VENTAS  (route group con tabs: Cotizaciones · Facturas · Recibos · Clientes · CxC)

### Clientes
- **Columnas:** checkbox · Nombre/Razón Social (avatar+nombre, link) · Documento (tipo arriba en gris, número mono debajo) · Email (con ícono mail) · Celular (con ícono phone) · Régimen (badge) · Acciones (✏️ editar + ⋯ más).
- **NO mostrar:** Ciudad, Tipo de Pago, Ingresos YTD, Estado (se quitaron; los datos siguen en BD y en el detalle/form).
- **Toolbar:** Nuevo (der) · iconos imprimir/importar/exportar (izq) · buscador "Buscar por nombre, email, teléfono..." · filtro **Régimen** (Todos / Resp. IVA / No Resp. IVA / Gran Contribuyente).
- **Paginación:** "Mostrando X–Y de N" · selector Filas 10/20/50 · prev/página/next.
- **Selección masiva:** barra con "N seleccionados" → Exportar / Eliminar.
- **Drawer Ver detalle:** hero (avatar, NIT, régimen) · 3 stat tiles (Forma de pago, Días crédito, Facturas) · Contacto (email/celular/ciudad) · Facturas recientes. Footer: Cerrar · Editar · Nueva factura.
- **Modal Crear/Editar:** Tipo doc + Número · Nombre · Email + Celular · Ciudad + Departamento · Régimen + Forma de pago.

### Cotizaciones
- **Columnas:** checkbox · # Cotización (link acento) · Cliente · Emisión · Vence · Estado (Borrador/Enviada/En revisión/Aprobada/Rechazada) · Total · Acciones (✈ enviar · ✓ aprobar/facturar · ✕ rechazar; las dos últimas ocultas si ya está cerrada).
- **Toolbar:** Nuevo (der) · iconos eliminar/imprimir/importar/exportar · buscador · filtro estado "Todas".

### Facturas
- **Columnas:** checkbox · # Factura (link + etiqueta **Factura/Ticket**; si es ticket, muestra # cotización origen debajo) · Cliente · Fecha · Estado (Emitida/Borrador) · Pago (Pendiente/Pagada/Vencida) · Total · Saldo (rojo si >0).
- **Toolbar:** iconos imprimir/importar/exportar · botón **"Nuevo ticket"** (der) · buscador · filtro "Todas". (Las facturas formales se generan desde cotización; el ticket POS sí se crea directo.)
- El # abre el detalle (drawer) con líneas, subtotal, IVA 19%, total e historial.

### Recibos
- **Columnas:** # Recibo (link + doc origen FAC-/TK- debajo) · Cliente · Total · Pagado (verde) · Saldo (rojo) · Estado (Pendiente/Parcial/Pagado).
- **Toolbar:** iconos imprimir/importar/exportar · buscador · filtro "Todos". **SIN botón Nuevo** (se generan desde pagos).

### CxC (Cartera por cobrar)
- Aging (Por vencer / 1–15 / 16–30 / +30 días) con barras + tabla de facturas pendientes con "Vencida hace N días" y botón Cobrar.

---

## COMPRAS  (tabs: Órdenes de Compra · Facturas Proveedor · Proveedores · CxP)

### Órdenes de Compra
- **Columnas:** checkbox · # Orden (link) · Proveedor · Fecha Emisión · Entrega Esperada · Estado (Borrador/Enviada/Parcial/Recibida) · Total.
- **Toolbar:** iconos imprimir/importar/exportar · buscador · filtro "Todas" · **Nuevo** (der).

### Facturas Proveedor
- **Columnas:** checkbox · # Factura (link) · Proveedor · Fecha · Estado · Total · Saldo.
- **SIN botón Nuevo** (se generan al recibir una OC). Empty state: "No hay facturas de proveedor — recibe una orden de compra primero".

### Proveedores
- **Columnas:** checkbox · Razón Social/Nombre (link) · Documento · Contacto · Régimen · Días Pago.
- **Toolbar:** iconos · buscador "Buscar por nombre, NIT, email..." · **Nuevo** (der).

### CxP
- Igual que Facturas Proveedor pero filtrando las no pagadas.

---

## INVENTARIO  (tabs: Productos · Movimientos de Stock · Kardex · Ajustes)
Encabezado con botones arriba a la derecha: **Entradas** (verde) y **Salidas** (rojo).

### Productos
- **Columnas:** Nombre (ícono categoría + nombre) · Categoría · Precio · Stock (barra + número) · Estado (Disponible/Stock bajo/Sin stock). Toolbar: iconos · buscador · filtro Categoría · filtro "Por reponer" · **Nuevo** (der).

### Movimientos de Stock
- **Columnas:** Fecha · Producto (nombre + SKU) · Tipo (Entrada/Salida/Ajuste con badge) · Cantidad (+/−) · Saldo · Referencia · Responsable.
- **Toolbar:** buscador "Buscar producto o referencia..." · dropdown "Todos los productos" · dropdown "Todos los tipos" · **Exportar** (der). **SIN "Nuevo ajuste"** (eso va en su pestaña).

### Kardex
- Dropdown "— Selecciona un producto —". Empty state con ícono de caja: "Selecciona un producto para ver su kardex." Al elegir: encabezado (producto, SKU, saldo actual) + tabla de movimientos con saldo acumulado.

### Ajustes
- Formulario (máx ~460px): "Ajuste de inventario" + descripción · Producto (select) · Cantidad real (conteo físico) · Motivo del ajuste (textarea) · botón **Registrar ajuste**.

---

## DASHBOARD / TABLERO
- Saludo en 1–2 líneas (no en columnas). Fila de KPIs con `MetricCard` (los más solicitados). Gráfico principal (área de ingresos) + actividad reciente. Opción "Personalizar" para elegir qué tarjetas/gráficos ver. (En el mockup: módulo `dashboard.jsx`.)

## FINANZAS  (tabs: Panel · Impuestos · Gastos)
- **Panel:** rango de Período (2 fechas) · 5 tarjetas (Ingresos, Gastos, IVA neto "A pagar a la DIAN", Por cobrar→link CxC, Por pagar→link CxP) · gráfico de barras "Ingresos vs. Gastos".
- **Gastos:** 3 tarjetas (fijos/variables/total) · tabla (Descripción · Categoría · Tipo · Fecha · Valor) · **Nuevo gasto** (der) · filtro tipo.
- **Impuestos:** panel fiscal (IVA, retenciones).

## CONTABILIDAD  (tabs: Plan de Cuentas · Comprobantes · Informes)
- **Plan de Cuentas:** árbol/tabla PUC (código · cuenta · tipo · naturaleza).
- **Comprobantes:** rango de fechas (Desde → Hasta) · botón **"Asiento manual"** (der) · tabla (Comprobante · Concepto · Tipo · Débito · Crédito · Fecha · Estado) · nota "se generan automáticamente...".
- **Informes:** banner de aviso + 6 tarjetas por clase PUC (Activos, Pasivos, Patrimonio, Ingresos, Gastos, Costo de ventas), cada cuenta con código mono + nombre + saldo.

## NÓMINA  (6 tabs: Empleados · Liquidar · Historial · Aportes PILA · Ausencias · Prestaciones)
- **Empleados:** checkbox · Empleado (avatar + cargo/doc) · Contrato · Ingreso · Salario base · Estado. Toolbar: buscador · Exportar · **Nuevo empleado** (der).
- **Liquidar:** selección de periodo + cálculo de devengados/deducciones.
- **Historial:** liquidaciones pasadas (con PDF).
- **Aportes PILA:** aportes a seguridad social.
- **Ausencias:** vacaciones/incapacidades/permisos.
- **Prestaciones:** cesantías, intereses, prima, vacaciones (provisión mensual).

## CONFIGURACIÓN
- Nav lateral interno: Organización · Apariencia · Equipo · Integraciones · Seguridad · (las que ya tengas).
- **Apariencia** (NUEVA, importante): tema claro/oscuro · color de acento (5 swatches) · fondo futurista (6 opciones) · grid técnico (toggle). Guarda preferencias por empresa (tabla `ui_preferences` o columna JSON en `companies`) y aplícalas vía `BackgroundLayer` + variables CSS de acento.
- **Organización:** logo del software arriba; opción de logo del cliente.

---

## SUPERADMIN  (shell DISTINTO — route group `(superadmin)`)
- **No usa el sidebar del ERP.** Barra superior horizontal, fondo negro total, badge "Superadmin", botón "← Volver al ERP".
- Nav: Dashboard · Empresas · Usuarios · Configuración.
- **Dashboard:** 4 stat cards (Empresas registradas, Usuarios totales, Módulos activados, Empresas inactivas) + "Empresas recientes".
- **Empresas:** tabla (Empresa · Plan · Usuarios · Módulos · MRR · Creada · Estado · Acciones: Entrar-como/soporte, Módulos y plan, Suspender/Activar) · **Crear empresa** (der).
- **Usuarios:** tabla global de usuarios.
- **Configuración:** Módulos disponibles · Planes y precios · Suspensión automática (toggle) · Notificaciones.
- Acceso: link "Panel Superadmin" en el menú de usuario del ERP (ya existe en tu header). El estilo negro lo logras con un layout propio en `(superadmin)/layout.tsx` que NO monte el shell glass del ERP.
