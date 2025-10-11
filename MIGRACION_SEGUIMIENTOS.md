# 🔧 Migración: Sistema de Seguimientos Corregido

## 📋 Resumen del Problema

### Problema Identificado:
- **70 de 89 prospectos** no tenían seguimientos en la tabla `seguimientos`
- Los seguimientos solo existían en campos de la tabla `prospectos`
- La balanza mostraba **0 pendientes** cuando había seguimientos reales
- No se podía reprogramar seguimientos correctamente

### Causa Raíz:
1. Al crear prospecto, solo se actualizaba `prospectos.seguimiento_obligatorio`
2. **NO** se creaba registro en tabla `seguimientos`
3. Dashboard consultaba solo tabla `seguimientos` → No encontraba nada

---

## ✅ Solución Implementada

### 1. **Migración de Base de Datos** (Ejecutar en Supabase)

```sql
-- Eliminar constraint UNIQUE para permitir múltiples seguimientos
ALTER TABLE seguimientos
DROP CONSTRAINT IF EXISTS seguimientos_prospecto_id_unique;

-- Migrar seguimientos huérfanos (70 prospectos)
INSERT INTO seguimientos (
    prospecto_id, asesor_id, fecha_programada, fecha_limite,
    tipo, descripcion, completado, visible_para_asesor, created_at
)
SELECT
    p.id, p.asesor_id, p.seguimiento_obligatorio,
    p.seguimiento_obligatorio + INTERVAL '18 hours',
    'Llamada', 'Seguimiento migrado automáticamente',
    p.seguimiento_completado, NOT p.seguimiento_completado, p.created_at
FROM prospectos p
LEFT JOIN seguimientos s ON s.prospecto_id = p.id
WHERE p.seguimiento_obligatorio IS NOT NULL
AND p.activo = true
AND s.id IS NULL;

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_seguimientos_prospecto_activo
ON seguimientos(prospecto_id, completado, fecha_programada DESC);

CREATE INDEX IF NOT EXISTS idx_seguimientos_asesor_completado
ON seguimientos(asesor_id, completado, visible_para_asesor);
```

---

### 2. **Cambios en el Código Backend**

#### A. `prospectosController.js` (línea ~580)

**ANTES:**
```javascript
const data = result.rows[0];
// ❌ NO creaba seguimiento en tabla seguimientos
```

**DESPUÉS:**
```javascript
const data = result.rows[0];

// ✅ Crear seguimiento automático
if (fechaSeguimiento) {
    const fechaLimite = new Date(fechaSeguimiento);
    fechaLimite.setHours(fechaLimite.getHours() + 18);

    await query(`
        INSERT INTO seguimientos (
            prospecto_id, asesor_id, fecha_programada, fecha_limite,
            tipo, descripcion, completado, visible_para_asesor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [data.id, asesorId, fechaSeguimiento, fechaLimite.toISOString(),
        'Llamada', 'Seguimiento inicial del prospecto', false, true]);
}
```

---

#### B. `seguimientosController.js` - `completarSeguimiento` (línea ~129)

**NUEVOS PARÁMETROS:**
```javascript
{
    resultado: string,
    notas: string,
    calificacion: number,
    reprogramar: boolean,        // ✅ NUEVO
    nueva_fecha: string,         // ✅ NUEVO
    tipo_seguimiento: string     // ✅ NUEVO (Llamada, Email, WhatsApp)
}
```

**LÓGICA:**
```javascript
// 1. Marcar seguimiento actual como completado
UPDATE seguimientos SET completado = true, fecha_completado = NOW()

// 2. Si reprogramar = true, crear NUEVO seguimiento
if (reprogramar && nueva_fecha) {
    INSERT INTO seguimientos (
        prospecto_id, asesor_id, fecha_programada, fecha_limite,
        tipo, descripcion, completado, visible_para_asesor
    ) VALUES (...)
}
```

---

#### C. `seguimientosController.js` - `posponerSeguimiento` (línea ~300)

**CAMBIO DE LÓGICA:**

**ANTES:**
```javascript
// ❌ Actualizaba el mismo registro
UPDATE seguimientos SET fecha_programada = nueva_fecha WHERE id = X
```

**DESPUÉS:**
```javascript
// ✅ Marca actual como completado (pospuesto)
UPDATE seguimientos SET completado = true, resultado = 'pospuesto'

// ✅ Crea NUEVO seguimiento con la fecha reprogramada
INSERT INTO seguimientos (prospecto_id, fecha_programada, ...)
```

---

## 🎯 Flujo de Uso Actualizado

### Escenario: Seguimiento Completo con Reprogramación

```
DÍA 1: Creas prospecto "Juan Pérez"
   ↓
   Backend automáticamente:
   - INSERT en prospectos
   - INSERT en seguimientos (fecha: día 3) ✅
   ↓
   Balanza muestra: 1 pendiente

DÍA 3: Completas seguimiento con resultado "interesado"
   Request al backend:
   {
       "resultado": "interesado",
       "notas": "Quiere cotización",
       "reprogramar": true,
       "nueva_fecha": "2025-10-13T10:00:00"
   }
   ↓
   Backend:
   - UPDATE seguimiento día 3 → completado = true ✅
   - INSERT nuevo seguimiento → fecha: día 13 ✅
   ↓
   Balanza muestra:
   - Pendientes: 1 (día 13)
   - Realizados 7D: 1 (día 3)

DÍA 13: Completas sin reprogramar
   Request:
   {
       "resultado": "compra_confirmada",
       "notas": "Cerró venta",
       "reprogramar": false
   }
   ↓
   Backend:
   - UPDATE seguimiento día 13 → completado = true ✅
   - (Opcional) Conversión automática a venta
   ↓
   Balanza muestra:
   - Pendientes: 0
   - Realizados 7D: 2
```

---

## 📊 Verificación Post-Migración

Ejecuta este query en Supabase para verificar:

```sql
SELECT
    'Prospectos activos' as metrica,
    COUNT(*) as valor
FROM prospectos WHERE activo = true

UNION ALL

SELECT
    'Con seguimiento activo' as metrica,
    COUNT(DISTINCT s.prospecto_id) as valor
FROM seguimientos s
INNER JOIN prospectos p ON s.prospecto_id = p.id
WHERE s.completado = false AND p.activo = true

UNION ALL

SELECT
    'Sin seguimiento (DEBE SER 0)' as metrica,
    COUNT(*) as valor
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false
WHERE p.activo = true AND s.id IS NULL;
```

**Resultado Esperado:**
```
| metrica                     | valor |
|-----------------------------|-------|
| Prospectos activos          | 89    |
| Con seguimiento activo      | 89    |
| Sin seguimiento (DEBE SER 0)| 0     |
```

---

## 🚀 Próximos Pasos

1. ✅ Ejecutar script SQL en Supabase
2. ✅ Reiniciar servidor backend
3. ✅ Verificar que balanza muestre los 89 seguimientos
4. ✅ Probar creación de prospecto nuevo
5. ✅ Probar completar seguimiento con reprogramación
6. ✅ Probar posponer seguimiento

---

## 📝 Notas Importantes

### Arquitectura Nueva:
- **1 prospecto = N seguimientos** (historial completo)
- Tabla `seguimientos` = fuente de verdad
- Tabla `prospectos.seguimiento_obligatorio` = cache/denormalización

### Compatibilidad:
- ✅ Código anterior sigue funcionando
- ✅ Nuevos prospectos automáticamente crean seguimiento
- ✅ Reprogramación opcional (compatible con frontend antiguo)

### Performance:
- Índices creados para optimizar queries
- Dashboard filtra `completado = false` para seguimientos activos

---

## 🆘 Rollback (Si algo falla)

```sql
-- 1. Restaurar constraint UNIQUE (solo si es necesario)
ALTER TABLE seguimientos
ADD CONSTRAINT seguimientos_prospecto_id_unique
UNIQUE (prospecto_id);

-- 2. Eliminar seguimientos duplicados (mantener solo el más reciente)
DELETE FROM seguimientos s1
USING seguimientos s2
WHERE s1.prospecto_id = s2.prospecto_id
AND s1.id < s2.id;
```

---

**Fecha de migración:** 2025-10-10
**Desarrollado por:** Claude Code
**Ticket relacionado:** Balanza de Seguimientos mostrando 0 pendientes
