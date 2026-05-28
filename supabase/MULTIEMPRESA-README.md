# Sistema Multiempresa - Implementación Actual

## 🚨 **PROBLEMA CRÍTICO RESUELTO**

**Error RLS "new row violates row-level security policy for table 'customers'"**

### ✅ **Solución Implementada**

1. **Políticas RLS Actualizadas**: Se corrigieron las políticas para usar la arquitectura `company_users` en lugar de `companies.user_id` directamente.

2. **Script de Inicialización**: Se creó `init-multiempresa.sql` para configurar las tablas y datos de prueba.

### 🔧 **Pasos para Resolver el Error RLS**

#### 1. Ejecutar Script de Inicialización
```sql
-- Ejecutar en Supabase SQL Editor:
-- Archivo: supabase/init-multiempresa.sql
```

#### 2. Configurar Usuario de Prueba
```sql
-- Después de hacer login, obtener el user_id desde auth.users
-- Luego ejecutar:
INSERT INTO company_users (user_id, company_id, role)
SELECT
  'TU_USER_ID_AQUI',
  (SELECT id FROM companies WHERE name = 'Mi Empresa S.A.' LIMIT 1),
  'admin'
ON CONFLICT DO NOTHING;
```

#### 3. Políticas RLS Corregidas
```sql
-- Ejecutar en Supabase SQL Editor:
-- Archivo: supabase/customers-rls-policies.sql
```

## Arquitectura Corregida

Después de analizar tu documentación, se corrigieron los siguientes puntos:

### ✅ **Problema Solucionado**
- La API `/api/company/ensure` ahora consulta `company_users` en lugar de `companies` directamente
- El store maneja múltiples empresas disponibles
- Se respeta la arquitectura `company_users` → `companies`

### 🔧 **Cambios Realizados**

#### 1. API `/api/company/ensure`
```typescript
// ANTES: Buscaba directamente en companies
.from('companies').eq('user_id', user.id)

// AHORA: Busca en company_users con join
.from('company_users')
.select(`company_id, role, companies (id, name)`)
.eq('user_id', user.id)
```

#### 2. Store Zustand Actualizado
```typescript
interface CompanyStore {
  activeCompanyId: string | null;
  activeCompany: Company | null;
  userId: string | null;
  availableCompanies: Company[]; // Para selección múltiple futura
  // ... métodos actualizados
}
```

#### 3. Página de Clientes
- Muestra el nombre de la empresa activa en el título
- Maneja errores de carga de empresa
- Respeta la arquitectura multiempresa

### 📋 **Cómo Funciona Ahora**

1. **Login**: Usuario se autentica
2. **API Call**: `/api/company/ensure` consulta `company_users`
3. **Selección**: Si hay múltiples empresas, toma la primera (por ahora)
4. **Store**: Guarda `companyId`, `companyName`, `role`
5. **Queries**: Todas las operaciones usan `activeCompanyId`

### 🎯 **Próximos Pasos Recomendados**

#### 1. Selector de Empresa (si el usuario tiene múltiples)
```typescript
// En el dashboard, mostrar dropdown si availableCompanies.length > 1
const { availableCompanies, setActiveCompany } = useCompanyStore()
```

#### 2. Middleware de Empresa
```typescript
// Verificar que el usuario tenga acceso a activeCompanyId
export async function middleware(request: NextRequest) {
  // Validar que company_id pertenezca al usuario
}
```

#### 3. Manejo de Errores Mejorado
```typescript
// En caso de que la empresa no exista o sea inválida
if (!company) {
  redirect('/select-company') // Página de selección
}
```

### 🔍 **Verificación**

Para probar que funciona:

1. **Ejecutar scripts SQL** en Supabase
2. **Login** en la aplicación
3. **Verificar** que aparezca el nombre de la empresa en el título
4. **Crear cliente** - debería funcionar sin errores RLS
5. **Ver clientes** - debería mostrar solo los de la empresa activa

### 🚨 **Si Aún Falla**

Posibles causas:
- No hay fila en `company_users` para el usuario actual
- La empresa referenciada no existe en `companies`
- Políticas RLS no permiten la operación

**Debug**: Revisa la consola del navegador y los logs del servidor para ver qué `companyId` se está usando.