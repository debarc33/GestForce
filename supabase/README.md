# Configuración de Políticas RLS para Supabase

## Problema
Si ves el error "new row violates row-level security policy for table 'customers'" al crear clientes, significa que las políticas de seguridad de fila (RLS) no están configuradas correctamente.

## Solución

### 1. Verificar Autenticación
Asegúrate de que el usuario esté autenticado antes de intentar crear clientes. El código ya incluye verificación de autenticación.

### 2. Configurar Políticas RLS
Ejecuta el archivo `customers-rls-policies.sql` en el SQL Editor de Supabase.

### 3. Verificar Esquema de Base de Datos
Las políticas asumen que tienes una tabla `companies` con:
- Columna `id` (UUID)
- Columna `user_id` que referencia `auth.uid()`

Si tu esquema es diferente, ajusta las políticas en consecuencia.

### 4. Políticas Incluidas
- **SELECT**: Ver clientes de compañías propias
- **INSERT**: Crear clientes para compañías propias
- **UPDATE**: Actualizar clientes de compañías propias
- **DELETE**: Eliminar clientes de compañías propias

### 5. Testing
Después de aplicar las políticas:
1. Inicia sesión en la aplicación
2. Intenta crear un cliente
3. Verifica que aparezca en la tabla

## Comandos Útiles
```sql
-- Ver políticas actuales
SELECT * FROM pg_policies WHERE tablename = 'customers';

-- Ver si RLS está habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'customers';
```