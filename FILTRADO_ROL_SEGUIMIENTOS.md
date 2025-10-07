# 🔒 Sistema de Filtrado por Rol en Seguimientos

## 📋 Resumen de Cambios

Se ha implementado un **sistema completo de filtrado por rol** para el módulo de seguimientos, similar al que ya funciona en Pipeline, con **2 capas de seguridad**:

1. **Backend**: Validación automática de permisos por rol
2. **Frontend**: Selector de vista intuitivo para ejecutivos

---

## 🎯 Problema Resuelto

### **Antes** ❌
- VENDEDOR podía ver **todos los seguimientos** de todos los asesores
- No había control de acceso por rol en el backend
- Frontend pasaba datos sin validación de permisos
- Usuario nuevo veía 34 seguimientos que no le pertenecían

### **Después** ✅
- VENDEDOR **solo ve sus propios seguimientos** (forzado en backend)
- EJECUTIVOS pueden ver vista global o filtrar por asesor específico
- Selector de vista visual y fácil de usar
- Backend valida permisos automáticamente

---

## 🔧 Cambios Implementados

### 1️⃣ **Backend** - `seguimientosController.js`

#### Ubicación: `/backend/src/modules/prospectos/controllers/seguimientosController.js`

**Cambios principales:**

```javascript
// 🔒 CONTROL DE ACCESO POR ROL (línea 925-948)
const usuarioActual = req.user || {};
const rolUsuario = usuarioActual.rol_id;
const ROLES_EJECUTIVOS = [1, 2, 3, 4, 6]; // SUPER_ADMIN, ADMIN, GERENTE, JEFE_VENTAS, SUPERVISOR

// VENDEDOR (rol_id = 7) SOLO puede ver sus propios datos
if (rolUsuario === 7) {
    asesor_id = idUsuarioActual; // Forzar su propio ID
} else if (esEjecutivo) {
    asesor_id = asesorId || null; // Puede ver global o específico
} else {
    asesor_id = idUsuarioActual; // Otros roles: solo su vista
}
```

**Queries actualizadas con filtrado condicional:**
- ✅ Seguimientos pendientes (línea 951-971)
- ✅ Seguimientos realizados (línea 979-998)
- ✅ Prospectos listos para conversión (línea 1009-1025)
- ✅ Métricas de 30 días (línea 1046-1054)
- ✅ Score de productividad (línea 1096-1126)

**Metadatos de vista agregados:**
```javascript
resultado.vista_info = {
    tipo_vista: asesor_id ? 'personal' : 'global',
    asesor_id: asesor_id,
    rol_usuario: rolUsuario,
    es_ejecutivo: esEjecutivo,
    puede_cambiar_vista: esEjecutivo
};
```

---

### 2️⃣ **Frontend** - Selector de Vista

#### **Nuevo Componente**: `VistaSelectorSeguimientos.jsx`

**Ubicación**: `/frontend/src/components/common/VistaSelectorSeguimientos.jsx`

**Características:**
- 🔍 Dropdown elegante con lista de vistas
- 👥 **Vista Global**: Todos los seguimientos (solo ejecutivos)
- 👤 **Mi Vista Personal**: Solo seguimientos propios
- 📋 **Otros Asesores**: Lista de vendedores disponibles (solo ejecutivos)
- 🎨 Interfaz visual con iconos y colores
- 🔒 Se oculta automáticamente para VENDEDOR

**Uso:**
```jsx
<VistaSelectorSeguimientos
  usuarioActual={usuarioActual}
  onVistaChange={handleCambioVista}
  vistaActual={vistaSeleccionada}
/>
```

---

### 3️⃣ **Integración en BalanzaSeguimientos**

**Ubicación**: `/frontend/src/components/prospectos/BalanzaSeguimientos/BalanzaSeguimientos.jsx`

**Cambios:**
1. Agregado estado interno `vistaSeleccionada` (línea 40)
2. Handler `handleCambioVista` para cambiar vista (línea 95-98)
3. Selector integrado en el header central (línea 333-340)
4. Simplificada lógica de carga de datos (línea 105-112)

**Resultado visual:**
```
     ⚖️ BALANZA DE SEGUIMIENTOS ⚖️
    [Selector de Vista aquí] ← 👈 POSICIONADO AQUÍ
         /\
        /  \
  pendientes realizados
```

---

### 4️⃣ **Simplificación en ProspectosPage**

**Ubicación**: `/frontend/src/pages/ProspectosPage.jsx`

**Antes:**
```jsx
asesorId={(() => {
  const esVendedor = rolUsuario === 'VENDEDOR';
  if (esVendedor) return usuarioActual?.id;
  return filtros.asesor_id || null;
})()}
```

**Después:**
```jsx
asesorId={usuarioActual?.id}
```

El componente ahora maneja su propia lógica de vista internamente.

---

## 🎭 Flujo de Funcionamiento

### **Escenario 1: Usuario VENDEDOR**

1. Entra a Seguimientos
2. Backend detecta `rol_id = 7` (VENDEDOR)
3. Backend **fuerza** `asesor_id = usuario_actual.id`
4. Frontend **no muestra** selector de vista
5. ✅ Solo ve sus propios seguimientos

### **Escenario 2: Usuario EJECUTIVO (Admin/Jefe/Gerente)**

1. Entra a Seguimientos
2. Backend detecta rol ejecutivo
3. Frontend **muestra** selector de vista con 3 opciones:
   - 👥 **Vista Global** (null)
   - 👤 **Mi Vista Personal** (su ID)
   - 📋 **Otros Asesores** (ID específico)
4. Usuario selecciona vista
5. Backend valida permisos y devuelve datos filtrados
6. ✅ Ve datos según la vista seleccionada

---

## 🔐 Seguridad Implementada

### **Capa 1: Backend (Principal)**
- ✅ Validación automática de `req.user.rol_id`
- ✅ VENDEDOR no puede hacer bypass (forzado en servidor)
- ✅ Queries diferentes según rol
- ✅ Logs de seguridad para auditoría

### **Capa 2: Frontend (UX)**
- ✅ Selector oculto para roles sin permisos
- ✅ UI intuitiva para ejecutivos
- ✅ Validación de permisos antes de mostrar opciones

---

## 📊 Roles y Permisos

| Rol ID | Rol | Vista Global | Vista Personal | Cambiar Vista | Selector Visible |
|--------|-----|--------------|----------------|---------------|------------------|
| 1 | SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ |
| 2 | ADMIN | ✅ | ✅ | ✅ | ✅ |
| 3 | GERENTE | ✅ | ✅ | ✅ | ✅ |
| 4 | JEFE_VENTAS | ✅ | ✅ | ✅ | ✅ |
| 6 | SUPERVISOR | ✅ | ✅ | ✅ | ✅ |
| 7 | VENDEDOR | ❌ | ✅ | ❌ | ❌ |
| Otros | - | ❌ | ✅ | ❌ | ❌ |

---

## 🧪 Testing

### **Pruebas Recomendadas:**

1. **VENDEDOR:**
   - ✅ Login como vendedor
   - ✅ Ver solo sus seguimientos
   - ✅ Verificar que selector NO aparece

2. **ADMIN/JEFE:**
   - ✅ Login como ejecutivo
   - ✅ Ver selector de vista
   - ✅ Cambiar a "Vista Global" → Ver todos
   - ✅ Cambiar a "Mi Vista Personal" → Ver solo suyos
   - ✅ Cambiar a otro asesor → Ver de ese asesor

3. **Backend:**
   - ✅ Intentar pasar `asesorId` diferente como VENDEDOR
   - ✅ Verificar que backend lo ignora y fuerza su ID
   - ✅ Revisar logs para confirmar validación

---

## 📝 Logs del Sistema

El backend genera logs informativos:

```bash
🔒 [Seguimientos] VENDEDOR detectado (123). Forzando vista personal.
✅ [Seguimientos] EJECUTIVO detectado (rol 2). Vista: global
✅ [Seguimientos] EJECUTIVO detectado (rol 4). Vista: asesor 456
⚠️ [Seguimientos] Rol desconocido (99). Forzando vista personal.
```

---

## 🚀 Implementación Completa

### **Archivos Modificados:**
1. ✅ `backend/src/modules/prospectos/controllers/seguimientosController.js`
2. ✅ `frontend/src/components/prospectos/BalanzaSeguimientos/BalanzaSeguimientos.jsx`
3. ✅ `frontend/src/pages/ProspectosPage.jsx`

### **Archivos Creados:**
1. ✅ `frontend/src/components/common/VistaSelectorSeguimientos.jsx`
2. ✅ `FILTRADO_ROL_SEGUIMIENTOS.md` (este archivo)

---

## ✨ Beneficios

1. **Seguridad**: Control estricto de acceso por rol
2. **UX Mejorada**: Selector visual para ejecutivos
3. **Consistencia**: Misma lógica que Pipeline
4. **Auditoría**: Logs de todas las operaciones
5. **Escalabilidad**: Fácil agregar nuevos roles

---

## 🎯 Próximos Pasos (Opcional)

- [ ] Aplicar misma lógica a Analytics
- [ ] Agregar selector en SeguimientosDashboard (vista lista)
- [ ] Implementar caché de asesores en selector
- [ ] Agregar filtros avanzados en selector

---

**Desarrollado por:** Claude Code
**Fecha:** 2025-10-06
**Versión:** 1.0
