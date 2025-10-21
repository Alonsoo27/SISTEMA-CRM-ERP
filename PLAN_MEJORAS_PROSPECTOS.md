# 📋 PLAN DE MEJORAS - MÓDULO DE PROSPECTOS

**Fecha:** 2025-10-20
**Estado:** PLANIFICACIÓN COMPLETADA - PENDIENTE IMPLEMENTACIÓN

---

## 🎯 OBJETIVOS PRINCIPALES

### 1. **Diferenciadores Visuales para Prospectos Traspasados**
### 2. **Visualización de Fecha/Hora de Vencimiento en Kanban**
### 3. **Ordenamiento Automático por Proximidad de Vencimiento**
### 4. **Sistema de Sincronización de Seguimientos**
### 5. **Corrección de Cron Job Automático**

---

## 📊 PROBLEMAS IDENTIFICADOS

### ❌ **Problema 1: Cron Job NO se ejecuta automáticamente**
- **Descripción:** El proceso `procesarSeguimientosVencidos` debe correr cada hora en horario laboral
- **Configuración actual:**
  - L-V: 8am-6pm cada hora
  - Sábados: 9am-12pm cada hora
- **Estado:** Configurado en `server.js` pero NO se ejecuta en Railway
- **Causa probable:** Railway necesita un worker separado para cron jobs
- **Solución temporal:** Ejecutar manualmente POST `/api/prospectos/seguimientos/procesar-vencidos`

### ❌ **Problema 2: Desincronización de Seguimientos**
- **Descripción:** Campo `seguimiento_obligatorio` en tabla `prospectos` no se actualiza al crear nuevos seguimientos
- **Impacto:** El cron job lee fechas antiguas y procesa vencimientos incorrectos
- **Solución:** Sistema de sincronización automática (ver abajo)

### ⚠️ **Problema 3: Sin diferenciadores visuales para traspasos**
- **Descripción:** Prospectos con `traspasado_por_vencimiento = true` no se distinguen visualmente
- **Campos disponibles:**
  - `traspasado_por_vencimiento` (boolean)
  - `fecha_traspaso` (timestamp)
  - `asesor_anterior_id` (integer)
  - `motivo_traspaso` (varchar)

### ⚠️ **Problema 4: Sin visualización de vencimiento en Kanban**
- **Descripción:** Las tarjetas Kanban no muestran cuándo vence el seguimiento
- **Necesidad:** Mostrar fecha/hora y ordenar por proximidad

---

## 🎨 PLAN DE IMPLEMENTACIÓN - DIFERENCIADORES VISUALES

### **A. Prospectos Traspasados**

#### **Diseño Visual Aprobado:**
- **Color de fondo diferenciado** (no muy llamativo, armónico con paleta actual)
- **Sugerencia de color:** `bg-amber-50` o `bg-orange-50` con borde `border-l-amber-400`
- **Ubicación:** KanbanBoard y ProspectoList

#### **Implementación en KanbanBoard.jsx:**

```jsx
// Detectar si es traspasado
const esTraspasado = prospecto.traspasado_por_vencimiento;

// Aplicar clase CSS condicional
<div className={`
  bg-white p-4 rounded-lg shadow hover:shadow-md cursor-move
  transition-all duration-200 border-l-4
  ${tieneUrgencia ? 'border-l-red-400 bg-red-50' : ''}
  ${esTraspasado && !tieneUrgencia ? 'border-l-amber-400 bg-amber-50' : 'border-l-gray-300'}
`}>

// Opcional: Tooltip con detalles
{esTraspasado && (
  <div className="text-xs text-amber-700 mt-1">
    🔄 Traspasado el {formatearFecha(prospecto.fecha_traspaso)}
  </div>
)}
```

#### **Implementación en ProspectoList.jsx:**

```jsx
// Añadir clase a la fila
<tr className={`
  hover:bg-gray-50
  ${prospecto.traspasado_por_vencimiento ? 'bg-amber-50' : ''}
`}>
```

---

### **B. Fecha/Hora de Vencimiento en Kanban**

#### **Formato Híbrido Aprobado:**

```javascript
const formatearVencimiento = (fechaVencimiento) => {
  const ahora = new Date();
  const vence = new Date(fechaVencimiento);
  const diffHoras = (vence - ahora) / (1000 * 60 * 60);

  // Si ya venció
  if (diffHoras < 0) {
    const diasVencidos = Math.floor(Math.abs(diffHoras) / 24);
    const horasVencidas = Math.floor(Math.abs(diffHoras) % 24);

    if (diasVencidos > 0) {
      return { texto: `Vencido hace ${diasVencidos}d`, color: 'text-red-600', urgente: true };
    }
    return { texto: `Vencido hace ${horasVencidas}h`, color: 'text-red-600', urgente: true };
  }

  // Si vence en menos de 24 horas
  if (diffHoras < 24) {
    const horas = Math.floor(diffHoras);
    const minutos = Math.floor((diffHoras % 1) * 60);
    return {
      texto: `Vence en ${horas}h ${minutos}m`,
      color: 'text-orange-600',
      urgente: true
    };
  }

  // Si vence en más de 24 horas
  const fecha = vence.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  return { texto: `Vence: ${fecha}`, color: 'text-gray-600', urgente: false };
};
```

#### **Ubicación en tarjeta Kanban:**

```jsx
{/* Mostrar vencimiento */}
{prospecto.seguimiento_obligatorio && (
  <div className={`text-xs font-medium ${formatearVencimiento(prospecto.seguimiento_obligatorio).color}`}>
    ⏰ {formatearVencimiento(prospecto.seguimiento_obligatorio).texto}
  </div>
)}
```

---

### **C. Ordenamiento por Vencimiento**

#### **Lógica de Ordenamiento:**

```javascript
const ordenarProspectosPorVencimiento = (prospectos) => {
  return prospectos.sort((a, b) => {
    // Si ambos tienen seguimiento
    if (a.seguimiento_obligatorio && b.seguimiento_obligatorio) {
      const venceA = new Date(a.seguimiento_obligatorio);
      const venceB = new Date(b.seguimiento_obligatorio);

      // Ordenar por fecha más próxima PRIMERO (ascendente)
      return venceA - venceB;
    }

    // Si solo A tiene seguimiento, va primero
    if (a.seguimiento_obligatorio && !b.seguimiento_obligatorio) return -1;

    // Si solo B tiene seguimiento, va primero
    if (!a.seguimiento_obligatorio && b.seguimiento_obligatorio) return 1;

    // Si ninguno tiene seguimiento, mantener orden actual
    return 0;
  });
};
```

#### **Aplicar en cada columna del Kanban:**

```javascript
const prospectosPorEstado = {
  Prospecto: ordenarProspectosPorVencimiento(prospectos.filter(p => p.estado === 'Prospecto')),
  Cotizado: ordenarProspectosPorVencimiento(prospectos.filter(p => p.estado === 'Cotizado')),
  Negociacion: ordenarProspectosPorVencimiento(prospectos.filter(p => p.estado === 'Negociacion'))
};
```

---

## 🔄 SISTEMA DE SINCRONIZACIÓN DE SEGUIMIENTOS

### **Problema:**
Campo `seguimiento_obligatorio` en tabla `prospectos` se desincroniza de la tabla `seguimientos`.

### **Solución: Trigger de Base de Datos**

```sql
-- ✅ CREAR FUNCIÓN DE SINCRONIZACIÓN
CREATE OR REPLACE FUNCTION sync_prospecto_seguimiento()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuando se crea o actualiza un seguimiento
    -- Actualizar el prospecto con la fecha_limite del seguimiento más reciente
    UPDATE prospectos
    SET
        seguimiento_obligatorio = NEW.fecha_limite,
        seguimiento_completado = NEW.completado,
        seguimiento_vencido = NEW.vencido,
        updated_at = NOW()
    WHERE id = NEW.prospecto_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ CREAR TRIGGER
CREATE TRIGGER trigger_sync_seguimiento
AFTER INSERT OR UPDATE ON seguimientos
FOR EACH ROW
EXECUTE FUNCTION sync_prospecto_seguimiento();
```

### **Alternativa: Sincronización en Backend**

Si no quieres usar triggers, actualizar en cada creación/actualización de seguimiento:

```javascript
// En seguimientosController.js - después de crear seguimiento
await query(`
    UPDATE prospectos
    SET seguimiento_obligatorio = $1,
        seguimiento_completado = $2,
        seguimiento_vencido = $3
    WHERE id = $4
`, [seguimiento.fecha_limite, false, false, prospecto_id]);
```

---

## 🔧 CORRECCIÓN DEL CRON JOB

### **Opción A: Configurar Worker en Railway**

Añadir en `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "startCommand": "node server.js"
  }
}
```

Crear `Procfile` para Railway:

```
web: node server.js
worker: node src/workers/cronWorker.js
```

Crear `src/workers/cronWorker.js`:

```javascript
const cron = require('node-cron');
const ProspectosController = require('../modules/prospectos/controllers/prospectosController');

// Ejecutar cada hora en horario laboral
cron.schedule('0 8-18 * * 1-5', async () => {
    console.log('🔄 Procesando seguimientos vencidos (L-V)...');
    await ProspectosController.procesarSeguimientosVencidos({ body: {} }, {
        json: (data) => console.log('Resultado:', data)
    });
}, { timezone: "America/Lima" });

console.log('✅ Worker de cron jobs iniciado');
```

### **Opción B: Usar Railway Cron (Recomendado)**

Railway soporta cron jobs nativos. Configurar en el dashboard:
- Comando: `curl -X POST https://tu-app.up.railway.app/api/prospectos/seguimientos/procesar-vencidos -H "Authorization: Bearer CRON_TOKEN"`
- Schedule: `0 8-18 * * 1-5`

---

## 📝 ARCHIVOS A MODIFICAR

### **Frontend:**
1. ✅ `frontend/src/components/prospectos/KanbanBoard/KanbanBoard.jsx`
   - Añadir diferenciador visual de traspasos
   - Añadir visualización de vencimiento
   - Implementar ordenamiento por vencimiento

2. ✅ `frontend/src/components/prospectos/ProspectoList/ProspectoList.jsx`
   - Añadir diferenciador visual de traspasos

3. 🆕 `frontend/src/utils/formatearVencimiento.js` (crear)
   - Función reutilizable para formatear fechas de vencimiento

### **Backend:**
1. ✅ `backend/src/modules/prospectos/controllers/seguimientosController.js`
   - Añadir sincronización al crear/actualizar seguimientos

2. 🆕 `backend/src/workers/cronWorker.js` (crear)
   - Worker dedicado para cron jobs

3. ✅ `backend/railway.json` (modificar)
   - Configurar worker

---

## ✅ QUERIES DE VERIFICACIÓN

```sql
-- Verificar sincronización
SELECT
    p.codigo,
    p.seguimiento_obligatorio as fecha_en_prospecto,
    (SELECT fecha_limite FROM seguimientos WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as fecha_seguimiento_reciente,
    CASE
        WHEN p.seguimiento_obligatorio = (SELECT fecha_limite FROM seguimientos WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1)
        THEN '✅ SINCRONIZADO'
        ELSE '❌ DESINCRONIZADO'
    END as estado_sync
FROM prospectos p
WHERE activo = true AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
LIMIT 20;

-- Verificar prospectos traspasados
SELECT
    COUNT(*) as total_traspasados,
    COUNT(*) FILTER (WHERE estado = 'Prospecto') as en_prospecto,
    COUNT(*) FILTER (WHERE estado = 'Cotizado') as en_cotizado,
    COUNT(*) FILTER (WHERE estado = 'Negociacion') as en_negociacion
FROM prospectos
WHERE traspasado_por_vencimiento = true AND activo = true;

-- Verificar vencimientos próximos
SELECT
    codigo,
    nombre_cliente,
    estado,
    seguimiento_obligatorio,
    EXTRACT(EPOCH FROM (seguimiento_obligatorio - NOW())) / 3600 as horas_para_vencer
FROM prospectos
WHERE activo = true
  AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
  AND seguimiento_obligatorio >= NOW()
  AND seguimiento_obligatorio <= NOW() + interval '24 hours'
ORDER BY seguimiento_obligatorio ASC;
```

---

## 📌 NOTAS IMPORTANTES

1. **NO ejecutar proceso de vencidos manualmente** a menos que sea necesario
2. **Verificar sincronización** después de cada creación de seguimiento
3. **Prospectos traspasados** que fueron revertidos el 16/10 tienen `traspasado_por_vencimiento = true` pero están con sus asesores originales
4. **Horario laboral:**
   - L-V: 8am-6pm (10 horas)
   - Sábados: 9am-12pm (3 horas = 0.3 días laborales)
   - Domingos: Cerrado
5. **Lógica de 2 días laborales está CORRECTA** en `prospectosController.js`

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Implementar diferenciadores visuales en KanbanBoard
2. ✅ Implementar visualización de vencimiento
3. ✅ Implementar ordenamiento automático
4. ✅ Crear sistema de sincronización (trigger o backend)
5. ✅ Configurar cron job en Railway
6. ✅ Probar en desarrollo
7. ✅ Deploy a producción
8. ✅ Monitorear logs de cron job

---

**Generado:** 2025-10-20
**Última actualización:** 2025-10-20 22:45
