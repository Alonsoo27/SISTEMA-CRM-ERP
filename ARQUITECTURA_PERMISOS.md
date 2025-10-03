# 🏗️ ARQUITECTURA DE PERMISOS - Sistema CRM/ERP

**Versión:** 2.0
**Fecha:** 2025-10-03
**Estado:** ✅ Implementado y funcional

---

## 📚 TABLA DE CONTENIDOS

1. [Visión General](#visión-general)
2. [Estructura Centralizada](#estructura-centralizada)
3. [Matriz de Permisos](#matriz-de-permisos)
4. [Guía de Uso](#guía-de-uso)
5. [Casos de Uso](#casos-de-uso)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 VISIÓN GENERAL

### Problema que Resuelve

**ANTES:**
- Datos de usuario inconsistentes entre componentes
- Lógica de permisos duplicada en 20+ archivos
- Bugs por estructura variable de `rol` (string vs objeto vs id)
- Difícil mantener y actualizar permisos

**AHORA:**
- ✅ **Single Source of Truth**: `userUtils.js`
- ✅ Normalización automática de usuario
- ✅ Permisos centralizados y reutilizables
- ✅ Debugging consistente
- ✅ Mantenimiento simplificado

### Principios de Diseño

1. **Normalización Automática**: Cualquier estructura de usuario → formato consistente
2. **Funciones Puras**: Sin efectos secundarios, fácil de testear
3. **Granularidad**: Permisos a nivel de módulo y operación
4. **Extensibilidad**: Fácil agregar nuevos permisos
5. **Debugging**: Logs detallados en desarrollo

---

## 🏛️ ESTRUCTURA CENTRALIZADA

### 1. `userUtils.js` - Core de Permisos

```javascript
import {
  normalizeUser,      // Normaliza cualquier estructura de usuario
  hasRole,            // Verificar roles específicos
  isExecutive,        // Verificar si es ejecutivo
  isAdmin,            // Verificar si es admin
  isSuperAdmin,       // Verificar si es super admin
  canSell,            // Verificar si puede vender
  isManager,          // Verificar si es jefe
  getUserAccessLevel, // Obtener nivel de acceso
  hasModulePermission,// Verificar permisos de módulo
  debugUser           // Debug en desarrollo
} from './utils/userUtils';
```

### 2. Normalización de Usuario

**Entrada (variable):**
```javascript
// Formato 1
{ id: 1, rol_id: 1, rol: "SUPER_ADMIN" }

// Formato 2
{ id: 1, rol: { id: 1, nombre: "SUPER_ADMIN" } }

// Formato 3 (legacy)
{ user_id: 1, role_id: 1, role: { nombre: "SUPER_ADMIN" } }
```

**Salida (consistente):**
```javascript
{
  id: 1,
  rol_id: 1,
  nombre: "Juan",
  apellido: "Pérez",
  nombre_completo: "Juan Pérez",
  email: "juan@empresa.com",
  rol: "SUPER_ADMIN",              // String
  rol_objeto: { id: 1, nombre: "SUPER_ADMIN" }, // Objeto
  vende: true,
  es_jefe: true,
  area_id: 5,
  area_nombre: "GERENCIA",
  _original: {...}  // Usuario original por si acaso
}
```

### 3. Funciones de Permisos

```javascript
// Verificar roles específicos
hasRole(user, [1, 2, 3])           // Por ID
hasRole(user, ['SUPER_ADMIN', 'GERENTE']) // Por nombre
hasRole(user, 1)                    // Single role

// Verificar niveles de acceso
isExecutive(user)    // SUPER_ADMIN, GERENTE, JEFE_VENTAS, ADMIN
isAdmin(user)        // SUPER_ADMIN, GERENTE, ADMIN
isSuperAdmin(user)   // Solo SUPER_ADMIN

// Verificar capacidades
canSell(user)        // Tiene flag vende = true
isManager(user)      // Tiene flag es_jefe = true

// Obtener nivel
getUserAccessLevel(user)
// Retorna: 'super_admin' | 'admin' | 'ejecutivo' | 'jefe' | 'empleado' | 'limitado'
```

### 4. Permisos por Módulo

```javascript
hasModulePermission(user, 'productos')        // [1, 2] SUPER_ADMIN, GERENTE
hasModulePermission(user, 'usuarios')         // [1, 2] SUPER_ADMIN, GERENTE
hasModulePermission(user, 'almacen_upload')   // [1, 2] SUPER_ADMIN, GERENTE
hasModulePermission(user, 'dashboard_ejecutivo') // [1, 2, 3, 11]
hasModulePermission(user, 'ventas')           // [1, 2, 3, 7, 11]
hasModulePermission(user, 'almacen')          // [1, 2, 6, 10, 11]
hasModulePermission(user, 'soporte')          // [1, 2, 5, 9, 11]
hasModulePermission(user, 'marketing')        // [1, 2, 4, 8, 11]
```

---

## 📊 MATRIZ DE PERMISOS

### Roles del Sistema

| ID | Rol | Descripción | Vende | Nivel |
|----|-----|-------------|-------|-------|
| 1 | SUPER_ADMIN | Administrador supremo | ✅ | Total |
| 2 | GERENTE | Gerencia ejecutiva | ❓ | Total |
| 3 | JEFE_VENTAS | Jefe del área de ventas | ✅ | Ejecutivo |
| 4 | JEFE_MARKETING | Jefe de marketing | ❌ | Jefe |
| 5 | JEFE_SOPORTE | Jefe de soporte | ❌ | Jefe |
| 6 | JEFE_ALMACEN | Jefe de almacén | ❌ | Jefe |
| 7 | VENDEDOR | Asesor comercial | ✅ | Empleado |
| 8 | MARKETING_EJECUTOR | Ejecutor de marketing | ❌ | Empleado |
| 9 | SOPORTE_TECNICO | Técnico de soporte | ❌ | Empleado |
| 10 | ALMACENERO | Operario de almacén | ❌ | Empleado |
| 11 | ADMIN | Admin de supervisión | ❌ | Admin |

### Permisos por Módulo

| Módulo | SUPER_ADMIN | GERENTE | ADMIN | JEFE_VENTAS | VENDEDOR | Otros |
|--------|-------------|---------|-------|-------------|----------|-------|
| **Productos** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Usuarios** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Almacén (Upload)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Dashboard Ejecutivo** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Ventas** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Prospectos** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Almacén** | ✅ | ✅ | ✅ | ❌ | ❌ | ALMACEN |
| **Soporte** | ✅ | ✅ | ✅ | ❌ | ❌ | SOPORTE |
| **Marketing** | ✅ | ✅ | ✅ | ❌ | ❌ | MARKETING |

### Operaciones Especiales

| Operación | Roles Permitidos |
|-----------|------------------|
| Ver Dashboard Personal Propio | Todos con `vende = true` |
| Ver Dashboard Personal de Otros | SUPER_ADMIN, GERENTE, JEFE_VENTAS, ADMIN |
| Crear Ventas | Todos con `vende = true` |
| Ver Todas las Ventas | SUPER_ADMIN, GERENTE, JEFE_VENTAS, ADMIN |
| Modificar Productos | SUPER_ADMIN, GERENTE |
| Gestionar Usuarios | SUPER_ADMIN, GERENTE |
| Upload Masivo Almacén | SUPER_ADMIN, GERENTE |

---

## 📖 GUÍA DE USO

### 1. En Componentes React

```javascript
import { normalizeUser, isExecutive, canSell } from '../../utils/userUtils';

function MiComponente({ usuarioActual }) {
  // SIEMPRE normalizar primero
  const user = normalizeUser(usuarioActual);

  // Verificar permisos
  if (!isExecutive(user)) {
    return <AccesoDenegado />;
  }

  // Verificar capacidades
  const puedeVender = canSell(user);

  return (
    <div>
      {puedeVender && <BotonNuevaVenta />}
    </div>
  );
}
```

### 2. En Guards

```javascript
import { normalizeUser, isExecutive } from '../../utils/userUtils';

const ProtectedRoute = ({ children, usuarioActual }) => {
  const user = normalizeUser(usuarioActual);

  if (!isExecutive(user)) {
    return <Redirect to="/acceso-denegado" />;
  }

  return children;
};
```

### 3. En Servicios

```javascript
import { getUserFromStorage, hasModulePermission } from '../utils/userUtils';

class MyService {
  async getProductos() {
    const user = getUserFromStorage();

    if (!hasModulePermission(user, 'productos')) {
      throw new Error('Sin permisos para ver productos');
    }

    // Continuar...
  }
}
```

### 4. Debugging

```javascript
import { debugUser } from '../utils/userUtils';

function MyComponent({ usuarioActual }) {
  const user = normalizeUser(usuarioActual);

  // Solo en desarrollo, imprime info estructurada
  debugUser(user, 'MyComponent - Usuario actual');

  // Output en consola:
  // 🔍 MyComponent - Usuario actual: {
  //   id: 1,
  //   nombre: "Admin Test",
  //   rol_id: 1,
  //   rol: "SUPER_ADMIN",
  //   vende: true,
  //   es_jefe: true,
  //   nivel_acceso: "super_admin"
  // }
}
```

---

## 💡 CASOS DE USO

### Caso 1: Verificar Acceso a Dashboard Ejecutivo

```javascript
import { normalizeUser, isExecutive } from '../../utils/userUtils';

function DashboardEjecutivo({ usuarioActual }) {
  const user = normalizeUser(usuarioActual);

  if (!isExecutive(user)) {
    return <AccesoDenegado mensaje="Requiere nivel ejecutivo" />;
  }

  return <DashboardContent />;
}
```

### Caso 2: Mostrar Opciones Según Rol

```javascript
import { normalizeUser, isSuperAdmin, hasModulePermission } from '../../utils/userUtils';

function MenuPrincipal({ usuarioActual }) {
  const user = normalizeUser(usuarioActual);

  return (
    <nav>
      <MenuItem to="/ventas">Ventas</MenuItem>
      <MenuItem to="/prospectos">Prospectos</MenuItem>

      {hasModulePermission(user, 'productos') && (
        <MenuItem to="/productos">Productos</MenuItem>
      )}

      {hasModulePermission(user, 'usuarios') && (
        <MenuItem to="/usuarios">Usuarios</MenuItem>
      )}

      {isSuperAdmin(user) && (
        <MenuItem to="/configuracion">Configuración</MenuItem>
      )}
    </nav>
  );
}
```

### Caso 3: Cargar Datos Según Permisos

```javascript
import { normalizeUser, hasRole } from '../../utils/userUtils';

async function cargarVentas(usuarioActual) {
  const user = normalizeUser(usuarioActual);

  // Ejecutivos ven todas las ventas
  if (hasRole(user, [1, 2, 3, 11])) {
    return await api.get('/ventas/todas');
  }

  // Vendedores solo ven sus ventas
  return await api.get(`/ventas/asesor/${user.id}`);
}
```

### Caso 4: Validar Operación Crítica

```javascript
import { normalizeUser, isSuperAdmin } from '../../utils/userUtils';

async function eliminarProducto(productoId, usuarioActual) {
  const user = normalizeUser(usuarioActual);

  // Solo super admin puede eliminar
  if (!isSuperAdmin(user)) {
    throw new Error('Operación no permitida');
  }

  return await api.delete(`/productos/${productoId}`);
}
```

---

## 🔧 TROUBLESHOOTING

### Problema: Usuario no tiene rol_id

**Síntoma:**
```
Warning: Usuario no válido
usuarioNormalizado: { id: 1, rol_id: null }
```

**Causa:** El usuario en localStorage tiene estructura incorrecta

**Solución:**
```javascript
// Verificar localStorage
const userStr = localStorage.getItem('user');
console.log('Usuario en storage:', JSON.parse(userStr));

// Si falta rol_id, volver a hacer login
authService.logout();
window.location.href = '/login';
```

### Problema: hasRole() siempre retorna false

**Síntoma:** Permisos no funcionan aunque el usuario tiene el rol correcto

**Causa:** Comparando tipos diferentes (string vs number)

**Solución:**
```javascript
// ❌ MAL
hasRole(user, '1')  // String

// ✅ BIEN
hasRole(user, 1)    // Number
hasRole(user, 'SUPER_ADMIN')  // String de nombre
```

### Problema: Dashboard ejecutivo no se muestra

**Síntoma:** Guard bloquea acceso aunque usuario es SUPER_ADMIN

**Solución:**
```javascript
// 1. Verificar normalización
const user = normalizeUser(usuarioActual);
debugUser(user, 'Debug Dashboard');

// 2. Verificar función de validación
console.log('Es ejecutivo?', isExecutive(user));

// 3. Si sigue fallando, verificar constantes de roles
console.log('Rol ID:', user.rol_id); // Debe ser 1
```

### Problema: Asesores no se cargan

**Síntoma:** "No hay asesores disponibles"

**Solución:**
```javascript
// Verificar que se use URL completa
const url = `${API_CONFIG.BASE_URL}/api/asesores/supervisables`;
console.log('URL de asesores:', url);

// No usar path relativo
// ❌ '/api/asesores/supervisables'
// ✅ '${API_CONFIG.BASE_URL}/api/asesores/supervisables'
```

---

## 🚀 PRÓXIMOS PASOS

### Implementaciones Futuras

1. **Permisos por Operación** (CRUD granular)
```javascript
hasPermission(user, 'productos', 'create')
hasPermission(user, 'productos', 'delete')
```

2. **Permisos Temporales** (roles por tiempo limitado)
```javascript
hasTemporaryAccess(user, 'dashboard_ejecutivo', validUntil)
```

3. **Audit Log** (registro de cambios de permisos)
```javascript
logPermissionChange(user, module, action, reason)
```

4. **Permisos por Recurso** (ownership granular)
```javascript
canAccessResource(user, 'venta', ventaId)
```

---

## 📝 CHANGELOG

### v2.0 (2025-10-03) - Arquitectura Completa
- ✅ Sistema centralizado de permisos
- ✅ Normalización automática de usuario
- ✅ Permisos granulares por módulo
- ✅ Debug tools integradas
- ✅ Documentación completa

### v1.0 (2025-10-02) - Versión Inicial
- Permisos básicos por rol
- Lógica duplicada en componentes
- Sin normalización centralizada

---

## 👥 CONTACTO

**Mantenedor:** Sistema CRM/ERP
**Documentación:** `/ARQUITECTURA_PERMISOS.md`
**Diagnóstico:** `/DIAGNOSTICO_PERMISOS.md`
**Core:** `/frontend/src/utils/userUtils.js`

---

**🤖 Generated with Claude Code**
