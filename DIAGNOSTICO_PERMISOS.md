# 📊 DIAGNÓSTICO COMPLETO - SISTEMA DE PERMISOS

**Fecha:** 2025-10-03
**Usuario reportante:** SUPER_ADMIN (Alonso Admin)

---

## 🔍 HALLAZGOS PRINCIPALES

### ✅ **LO QUE SÍ FUNCIONA:**

1. **Endpoint de asesores supervisables** - ✅ FUNCIONAL
   - URL: `/api/asesores/supervisables`
   - Respuesta: 6 asesores (incluye SUPER_ADMIN y vendedores)
   - Permisos correctos: `puede_ver_todos: true`

2. **SUPER_ADMIN tiene `vende: true`** - ✅ CONFIRMADO
   ```json
   {
     "id": 1,
     "nombre_completo": "Alonso Admin",
     "rol": "SUPER_ADMIN",
     "rol_id": 1,
     "vende": true,
     "es_jefe": true
   }
   ```

3. **Guard de Dashboard Ejecutivo** - ✅ CONFIGURACIÓN CORRECTA
   ```javascript
   const rolesEjecutivosAutorizados = [
     1,  // SUPER_ADMIN ✅
     2,  // GERENTE ✅
     3,  // JEFE_VENTAS ✅
     11  // ADMIN ✅
   ];
   ```

---

## ❌ **PROBLEMAS IDENTIFICADOS:**

### 1. **DASHBOARD EJECUTIVO - SUPER_ADMIN NO PUEDE ACCEDER**

**Síntoma:** Usuario reporta que no puede ver dashboards ejecutivos

**Posible causa:** El Guard verifica `usuarioActual.rol_id` pero puede estar recibiendo:
- `usuarioActual.rol` como objeto `{id: X, nombre: "..."}` en vez de `rol_id`
- Problema de deserialización del usuario desde localStorage

**Evidencia del código:**
```javascript
// Line 66-67 en DashboardEjecutivoGuard.jsx
const userRoleId = usuarioActual.rol_id;
const tieneRolPermitido = configuracion.roles_permitidos.includes(userRoleId);
```

**Archivos involucrados:**
- `frontend/src/components/guards/DashboardEjecutivoGuard.jsx`
- `frontend/src/services/authService.js` (getUser())

---

### 2. **DASHBOARD PERSONAL - "No hay asesores disponibles"**

**Síntoma:** Mensaje "No hay asesores disponibles para supervisar"

**Causa confirmada:** El endpoint SÍ regresa asesores (6 encontrados)

**Problema real:**
- El componente llama a `/api/asesores/supervisables` pero el path puede estar mal
- Usando `/api/asesores/supervisables` (relativo) en vez de URL completa

**Evidencia:**
```javascript
// Line 139 en VentasMetrics.jsx
const response = await fetch('/api/asesores/supervisables', {
```

**Solución necesaria:** Usar `API_CONFIG.BASE_URL + '/api/asesores/supervisables'`

---

### 3. **LÓGICA DE SELECCIÓN DE MES - FORZADA A ASESOR**

**Síntoma:** No permite seleccionar mes si no hay datos en mes actual

**Problema de UX:** La lógica actual:
1. Obliga a seleccionar asesor primero
2. Si no hay datos del mes actual, no muestra asesores
3. No permite cambiar a un mes con datos

**Flujo actual:**
```
Usuario → Entra a dashboard personal
         → Sistema carga mes_actual por defecto
         → No hay ventas este mes
         → "No hay asesores disponibles"
         → Usuario atascado ❌
```

**Flujo esperado:**
```
Usuario → Entra a dashboard personal
         → Selector de MES visible primero
         → Usuario selecciona mes con datos
         → Sistema muestra asesores de ese mes
         → Usuario selecciona asesor o ve vista total ✅
```

---

## 📋 ESTADO DE PERMISOS POR ROL (BACKEND)

### ✅ **SUPER_ADMIN (rol_id: 1)**
| Módulo | Estado Actual | Estado Esperado |
|--------|--------------|-----------------|
| Dashboards Ejecutivos | ❌ No accede (bug frontend) | ✅ Ver TODO |
| Dashboard Personal | ✅ SÍ puede | ✅ Correcto |
| Productos | ✅ Puede acceder | ✅ Correcto |
| Usuarios | ✅ Puede acceder | ✅ Correcto |
| Almacén (upload masivo) | ✅ Puede acceder | ✅ Correcto |
| Ventas | ✅ Puede vender (`vende: true`) | ✅ Correcto |
| Prospectos | ✅ Acceso completo | ✅ Correcto |

### ✅ **GERENTE (rol_id: 2)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Todo | ✅ Debe ser igual a SUPER_ADMIN | ✅ Ver TODO |

### ⚠️ **ADMIN (rol_id: 11)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Productos | ❓ No verificado | ❌ NO puede ver |
| Usuarios | ❓ No verificado | ❌ NO puede ver |
| Almacén (upload masivo) | ❓ No verificado | ❌ NO puede ver |

### ✅ **JEFE_VENTAS (rol_id: 3)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Prospectos | ✅ Acceso completo | ✅ Correcto |
| Ventas | ✅ Puede vender | ✅ Correcto (necesita `vende: true`) |
| Dashboard Ejecutivo | ⚠️ Puede acceder | ❓ Revisar si es correcto |
| Otros módulos | ❓ No verificado | ❌ NO debería ver |

### ✅ **VENDEDOR (rol_id: 7)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Prospectos | ✅ Acceso completo | ✅ Correcto |
| Ventas | ✅ TODO menos dashboard ejecutivo | ✅ Correcto |
| Dashboard Ejecutivo | ❓ No verificado | ❌ NO puede ver |

### ⚠️ **ALMACENERO (rol_id: 10)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Almacén | ❓ No verificado | ✅ Solo almacén |
| Otros | ❓ No verificado | ❌ NO puede ver |

### ⚠️ **SOPORTE_TECNICO (rol_id: 9)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Soporte | ❓ No verificado | ✅ Solo soporte |
| Otros | ❓ No verificado | ❌ NO puede ver |

### ⚠️ **MARKETING (rol_id: 8)**
| Módulo | Estado | Esperado |
|--------|--------|----------|
| Marketing | ❓ No verificado | ✅ Solo marketing |
| Otros | ❓ No verificado | ❌ NO puede ver |

---

## 🔧 CORRECCIONES NECESARIAS

### **PRIORIDAD ALTA:**

1. **Fix Dashboard Ejecutivo Guard**
   - Archivo: `frontend/src/components/guards/DashboardEjecutivoGuard.jsx:66`
   - Cambiar de `usuarioActual.rol_id` a manejo robusto que considere tanto `rol_id` directo como `rol.id`

2. **Fix path de asesores supervisables**
   - Archivo: `frontend/src/components/ventas/VentasMetrics/VentasMetrics.jsx:139`
   - Cambiar de path relativo a `API_CONFIG.BASE_URL + '/api/asesores/supervisables'`

3. **Cambiar lógica de Dashboard Personal**
   - Archivo: `frontend/src/components/ventas/VentasMetrics/VentasMetrics.jsx`
   - Mostrar selector de MES primero (antes que selector de asesor)
   - Permitir cambiar mes independientemente de si hay datos o no

### **PRIORIDAD MEDIA:**

4. **Verificar permisos de ADMIN**
   - Restringir acceso a productos
   - Restringir acceso a usuarios
   - Restringir upload masivo en almacén

5. **Verificar `vende: true` en JEFE_VENTAS**
   - Confirmar en BD que tienen el flag correcto

### **PRIORIDAD BAJA:**

6. **Verificar aislamiento de módulos**
   - ALMACENERO solo ve almacén
   - SOPORTE solo ve soporte
   - MARKETING solo ve marketing

---

## 📝 DATOS DE VERIFICACIÓN

**Usuario de prueba:**
```json
{
  "id": 1,
  "nombre_completo": "Alonso Admin",
  "rol": "SUPER_ADMIN",
  "rol_id": 1,
  "vende": true,
  "es_jefe": true,
  "area": {"id": 5, "nombre": "GERENCIA"}
}
```

**Asesores supervisables encontrados:** 6
- 2 SUPER_ADMIN (ambos con `vende: true`)
- 4 VENDEDORES (todos con `vende: true`)

**Endpoint funcional:** `/api/asesores/supervisables` ✅

---

## 🎯 RESUMEN

**Problemas críticos:** 2
- Dashboard ejecutivo inaccesible para SUPER_ADMIN (bug frontend)
- Dashboard personal no muestra asesores (path incorrecto)

**Cambios de lógica:** 1
- Selector de mes debe ir ANTES que selector de asesor

**Verificaciones pendientes:** 4
- Permisos de ADMIN (productos, usuarios, almacén upload)
- Permisos de roles especializados (almacén, soporte, marketing)
- Flag `vende` en JEFE_VENTAS
- Restricción de dashboard ejecutivo para VENDEDOR
