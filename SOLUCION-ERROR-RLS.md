# 🚨 ERROR RLS - SOLUCIÓN COMPLETA

## Problema
- Error: "new row violates row-level security policy for table 'customers'"
- API `/api/company/ensure` devuelve error 500
- No se pueden crear clientes

## ✅ Solución Paso a Paso

### 1. Ejecutar Setup en Supabase
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Copia y pega el contenido de `supabase/setup-rapido.sql`
5. **Ejecuta el script**

### 2. Configurar Usuario
Después de hacer login en la aplicación:

1. Ve a **SQL Editor** en Supabase
2. Ejecuta esta consulta para ver tu `user_id`:
```sql
SELECT id, email FROM auth.users;
```

3. Copia tu `user_id` y ejecuta:
```sql
INSERT INTO company_users (user_id, company_id, role)
SELECT 'TU_USER_ID_AQUI', (SELECT id FROM companies WHERE name = 'Mi Empresa S.A.'), 'admin'
ON CONFLICT DO NOTHING;
```

### 3. Verificar
1. **Recarga** la aplicación
2. Ve a **Clientes**
3. **Crea un cliente** - debería funcionar sin errores

## 🎨 Rediseño Premium Aplicado

El rediseño premium ya está implementado:
- ✅ Sidebar oscuro (`bg-zinc-950`)
- ✅ Fondo gris claro (`bg-zinc-100`)
- ✅ Tipografía Inter
- ✅ Colores azul profundo
- ✅ Espaciado generoso
- ✅ Bordes redondeados

## 🔍 Si Aún No Funciona

### Verificar Logs
1. Abre **DevTools** (F12)
2. Ve a **Console**
3. Busca errores relacionados con:
   - `company_id`
   - RLS policies
   - Authentication

### Debug API
1. Ve a `http://localhost:3000/api/company/ensure`
2. Debería devolver JSON con `companyId`, `companyName`, `role`

### Verificar Base de Datos
En Supabase SQL Editor:
```sql
-- Ver empresas
SELECT * FROM companies;

-- Ver memberships
SELECT * FROM company_users;

-- Ver clientes
SELECT * FROM customers;
```

## 📞 Soporte

Si el problema persiste:
1. Comparte los logs de error
2. Indica qué paso falló
3. Incluye capturas de pantalla si es posible