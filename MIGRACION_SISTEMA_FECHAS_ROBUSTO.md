# 🌍 MIGRACIÓN A SISTEMA DE FECHAS GLOBAL ROBUSTO

**Sistema CRM/ERP Empresarial v2.0**
**Fecha de Creación:** 05 de Noviembre, 2025
**Estado:** Planificación
**Prioridad:** Media-Baja (Funcional para Perú actualmente)

---

## 📋 RESUMEN EJECUTIVO

Este documento detalla el plan de migración del sistema actual de manejo de fechas (optimizado para Perú) hacia una arquitectura robusta que soporte **múltiples timezones** y usuarios en diferentes países.

### Situación Actual
- ✅ Sistema funcional para usuarios en **Perú (UTC-5 / America/Lima)**
- ✅ Fechas se almacenan en **UTC** en PostgreSQL
- ✅ Frontend usa helpers con timezone `America/Lima` hardcodeado
- ⚠️ No soporta usuarios en otros países (España, México, Argentina, etc.)

### Objetivo
Implementar arquitectura **"Store in UTC, Display in Local"** para escalabilidad global.

### Estimación
- **Tiempo de desarrollo:** 2-3 días
- **Testing:** 1-2 días
- **Costo de downtime:** 0 (migración sin interrupción)
- **Riesgo:** Bajo (cambios no-destructivos)

---

## 🔍 ANÁLISIS DE SITUACIÓN ACTUAL

### Base de Datos (PostgreSQL + Supabase)

**Configuración actual:**
```javascript
// backend/src/config/database.js
types.setTypeParser(1114, (val) => val); // timestamp without time zone → string
types.setTypeParser(1184, (val) => val); // timestamp with time zone → string
options: "-c timezone='America/Lima'" // Timezone de sesión
```

**Estructura de tablas:**
```sql
-- Todas las tablas usan timestamp WITHOUT time zone
CREATE TABLE actividades_marketing (
    fecha_inicio_planeada TIMESTAMP,  -- ❌ Sin timezone
    fecha_fin_planeada TIMESTAMP,     -- ❌ Sin timezone
    fecha_inicio_real TIMESTAMP,      -- ❌ Sin timezone
    fecha_fin_real TIMESTAMP          -- ❌ Sin timezone
);
```

**Problema identificado:**
- Las columnas son `TIMESTAMP` en lugar de `TIMESTAMPTZ`
- node-postgres devuelve strings en lugar de Date objects
- Configuración de timezone en `America/Lima` pero datos en UTC
- Conversiones manuales propensas a errores

### Frontend (React + date-fns)

**Helpers actuales:**
```javascript
// frontend/src/utils/dateHelpers.js
export const formatearFechaHora = (fecha) => {
    // Agrega 'Z' asumiendo UTC
    let fechaStr = fecha.toString();
    if (!fechaStr.endsWith('Z')) {
        fechaStr = fechaStr.replace(' ', 'T') + 'Z';
    }

    // ✅ Usa timezone explícito (America/Lima hardcodeado)
    return new Date(fechaStr).toLocaleString('es-PE', {
        timeZone: 'America/Lima' // ❌ Hardcodeado
    });
};
```

**Problema:**
- Timezone `America/Lima` está hardcodeado
- No hay forma de cambiar timezone por usuario
- Inputs `datetime-local` asumen timezone local del navegador

---

## 🏗️ ARQUITECTURA PROPUESTA

### Principio Fundamental
**"Store in UTC, Display in Local"**

```
┌─────────────────────────────────────────────────────────────┐
│                      FLUJO DE DATOS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (Usuario en España)                               │
│  ↓ Input: 15:00 Madrid                                     │
│  ↓ Convierte: 2025-11-05T14:00:00.000Z (UTC)              │
│  ↓                                                          │
│  Backend (Node.js)                                          │
│  ↓ Recibe: ISO UTC string                                  │
│  ↓ Valida y procesa                                        │
│  ↓                                                          │
│  Base de Datos (PostgreSQL)                                 │
│  ↓ Almacena: TIMESTAMPTZ en UTC                            │
│  ↓ Retorna: TIMESTAMPTZ en UTC                             │
│  ↑                                                          │
│  Backend (Node.js)                                          │
│  ↑ Serializa: ISO UTC string                               │
│  ↑                                                          │
│  Frontend (Usuario en Perú)                                 │
│  ↑ Recibe: 2025-11-05T14:00:00.000Z                        │
│  ↑ Muestra: 09:00 Lima (UTC-5)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 PLAN DE MIGRACIÓN DETALLADO

### FASE 1: PREPARACIÓN (Día 1 - Mañana)

#### 1.1. Backup y Ambiente de Testing
```bash
# Crear backup completo de producción
pg_dump $DATABASE_URL > backup_pre_migracion_$(date +%Y%m%d).sql

# Crear base de datos de testing
createdb sistema_crm_testing
psql sistema_crm_testing < backup_pre_migracion_*.sql
```

#### 1.2. Agregar Columna de Timezone a Usuarios
```sql
-- Crear columna en tabla usuarios
ALTER TABLE usuarios
ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/Lima',
ADD COLUMN formato_hora VARCHAR(10) DEFAULT '24h',
ADD COLUMN primer_dia_semana INT DEFAULT 1;

-- Crear índice para consultas rápidas
CREATE INDEX idx_usuarios_timezone ON usuarios(timezone);

-- Poblar con valor default para usuarios existentes
UPDATE usuarios
SET timezone = 'America/Lima',
    formato_hora = '24h',
    primer_dia_semana = 1
WHERE timezone IS NULL;

-- Hacer columna NOT NULL después de poblar
ALTER TABLE usuarios ALTER COLUMN timezone SET NOT NULL;
```

#### 1.3. Lista de Timezones Soportados
```sql
-- Tabla de referencia de timezones válidos
CREATE TABLE timezones_soportados (
    id SERIAL PRIMARY KEY,
    timezone_name VARCHAR(50) UNIQUE NOT NULL,
    offset_utc VARCHAR(10) NOT NULL,
    pais VARCHAR(100),
    ciudad_ejemplo VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poblar con timezones principales
INSERT INTO timezones_soportados (timezone_name, offset_utc, pais, ciudad_ejemplo) VALUES
('America/Lima', 'UTC-5', 'Perú', 'Lima'),
('America/Mexico_City', 'UTC-6', 'México', 'Ciudad de México'),
('America/Bogota', 'UTC-5', 'Colombia', 'Bogotá'),
('America/Argentina/Buenos_Aires', 'UTC-3', 'Argentina', 'Buenos Aires'),
('America/Santiago', 'UTC-3/UTC-4', 'Chile', 'Santiago'),
('Europe/Madrid', 'UTC+1/UTC+2', 'España', 'Madrid'),
('America/New_York', 'UTC-5/UTC-4', 'Estados Unidos', 'Nueva York'),
('America/Los_Angeles', 'UTC-8/UTC-7', 'Estados Unidos', 'Los Ángeles');
```

---

### FASE 2: MIGRACIÓN DE BASE DE DATOS (Día 1 - Tarde)

#### 2.1. Migrar Columnas a TIMESTAMPTZ

**⚠️ IMPORTANTE:** Esta operación es **NO-DESTRUCTIVA** pero requiere downtime breve.

```sql
-- ==============================================================
-- SCRIPT DE MIGRACIÓN: timestamp → timestamptz
-- Ejecutar en ambiente de testing primero
-- ==============================================================

BEGIN;

-- 1. ACTIVIDADES MARKETING
ALTER TABLE actividades_marketing
    ALTER COLUMN fecha_inicio_planeada TYPE TIMESTAMPTZ USING fecha_inicio_planeada AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_fin_planeada TYPE TIMESTAMPTZ USING fecha_fin_planeada AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_inicio_real TYPE TIMESTAMPTZ USING fecha_inicio_real AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_fin_real TYPE TIMESTAMPTZ USING fecha_fin_real AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC',
    ALTER COLUMN editada_en TYPE TIMESTAMPTZ USING editada_en AT TIME ZONE 'UTC',
    ALTER COLUMN gestionada_vencimiento_en TYPE TIMESTAMPTZ USING gestionada_vencimiento_en AT TIME ZONE 'UTC';

-- 2. PROSPECTOS
ALTER TABLE prospectos
    ALTER COLUMN fecha_contacto TYPE TIMESTAMPTZ USING fecha_contacto AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_seguimiento TYPE TIMESTAMPTZ USING fecha_seguimiento AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- 3. SEGUIMIENTOS
ALTER TABLE seguimientos
    ALTER COLUMN fecha_programada TYPE TIMESTAMPTZ USING fecha_programada AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_realizada TYPE TIMESTAMPTZ USING fecha_realizada AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 4. ACTIVIDADES VENCIDAS GESTIONADAS
ALTER TABLE actividades_vencidas_gestionadas
    ALTER COLUMN fecha_vencimiento_original TYPE TIMESTAMPTZ USING fecha_vencimiento_original AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_deteccion TYPE TIMESTAMPTZ USING fecha_deteccion AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_gestion TYPE TIMESTAMPTZ USING fecha_gestion AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 5. AUSENCIAS
ALTER TABLE ausencias_marketing
    ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ USING fecha_inicio AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_fin TYPE TIMESTAMPTZ USING fecha_fin AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 6. NOTIFICACIONES
ALTER TABLE notificaciones
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN leida_at TYPE TIMESTAMPTZ USING leida_at AT TIME ZONE 'UTC';

-- 7. USUARIOS
ALTER TABLE usuarios
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- ⚠️ Agregar más tablas según necesidad...

-- Verificar conversión
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type LIKE '%timestamp%'
ORDER BY table_name, ordinal_position;

COMMIT; -- ✅ Solo si todo sale bien, sino ROLLBACK;
```

#### 2.2. Actualizar Configuración de PostgreSQL

```javascript
// backend/src/config/database.js
const { Pool, types } = require('pg');

// ============================================
// ✅ NUEVA CONFIGURACIÓN: Permitir parsing automático
// ============================================
// ❌ ELIMINAR estas líneas:
// types.setTypeParser(1114, (val) => val);
// types.setTypeParser(1184, (val) => val);

// ✅ Permitir que node-postgres parsee a Date objects automáticamente
// (Comportamiento default, no requiere código adicional)

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    // ✅ FORZAR TIMEZONE UTC en sesión de PostgreSQL
    options: "-c client_encoding=UTF8 -c timezone='UTC'"
});

// Función query ahora retorna Date objects nativos
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;

        if (process.env.NODE_ENV === 'development') {
            console.log('Database Query:', {
                query: text.substring(0, 100) + '...',
                duration: duration + 'ms',
                rows: res.rowCount
            });
        }

        return res;
    } catch (error) {
        console.error('Database Error:', error);
        throw error;
    }
};

module.exports = { query, pool };
```

---

### FASE 3: BACKEND - SERIALIZACIÓN Y APIs (Día 2 - Mañana)

#### 3.1. Middleware de Serialización de Fechas

```javascript
// backend/src/middleware/dateSerializer.js

/**
 * Middleware para serializar Date objects a ISO UTC strings
 * antes de enviar al frontend
 */
const serializeDates = (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
        const serialized = serializeDateObjects(data);
        originalJson(serialized);
    };

    next();
};

function serializeDateObjects(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Si es un Date, convertir a ISO UTC
    if (obj instanceof Date) {
        return obj.toISOString();
    }

    // Si es un array, procesar cada elemento
    if (Array.isArray(obj)) {
        return obj.map(serializeDateObjects);
    }

    // Si es un objeto, procesar cada propiedad
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = serializeDateObjects(value);
        }
        return result;
    }

    return obj;
}

module.exports = { serializeDates };
```

#### 3.2. Actualizar app.js

```javascript
// backend/src/app.js
const { serializeDates } = require('./middleware/dateSerializer');

// Aplicar middleware globalmente ANTES de las rutas
app.use(serializeDates);

// ... resto de middlewares y rutas
```

#### 3.3. Endpoint de Preferencias de Usuario

```javascript
// backend/src/routes/userPreferencesRoutes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/usuarios/:id/preferencias
 * Obtener preferencias de timezone del usuario
 */
router.get('/:id/preferencias', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, rol } = req.user;

        // Solo puede ver sus propias preferencias o ser admin
        const esAdmin = ['SUPER_ADMIN', 'ADMIN', 'GERENTE'].includes(rol);
        if (!esAdmin && parseInt(user_id) !== parseInt(id)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver estas preferencias'
            });
        }

        const result = await query(`
            SELECT
                id,
                timezone,
                formato_hora,
                primer_dia_semana
            FROM usuarios
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            preferencias: result.rows[0]
        });

    } catch (error) {
        console.error('Error obteniendo preferencias:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener preferencias'
        });
    }
});

/**
 * PUT /api/usuarios/:id/preferencias
 * Actualizar preferencias de timezone
 */
router.put('/:id/preferencias', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, rol } = req.user;
        const { timezone, formato_hora, primer_dia_semana } = req.body;

        // Validación de permisos
        const esAdmin = ['SUPER_ADMIN', 'ADMIN', 'GERENTE'].includes(rol);
        if (!esAdmin && parseInt(user_id) !== parseInt(id)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar estas preferencias'
            });
        }

        // Validar timezone
        if (timezone) {
            const validTimezone = await query(`
                SELECT 1 FROM timezones_soportados
                WHERE timezone_name = $1 AND activo = true
            `, [timezone]);

            if (validTimezone.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Timezone no soportado'
                });
            }
        }

        // Actualizar preferencias
        const result = await query(`
            UPDATE usuarios SET
                timezone = COALESCE($1, timezone),
                formato_hora = COALESCE($2, formato_hora),
                primer_dia_semana = COALESCE($3, primer_dia_semana),
                updated_at = NOW()
            WHERE id = $4
            RETURNING id, timezone, formato_hora, primer_dia_semana
        `, [timezone, formato_hora, primer_dia_semana, id]);

        res.json({
            success: true,
            message: 'Preferencias actualizadas correctamente',
            preferencias: result.rows[0]
        });

    } catch (error) {
        console.error('Error actualizando preferencias:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar preferencias'
        });
    }
});

/**
 * GET /api/timezones
 * Lista de timezones soportados
 */
router.get('/timezones', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT
                timezone_name,
                offset_utc,
                pais,
                ciudad_ejemplo
            FROM timezones_soportados
            WHERE activo = true
            ORDER BY pais, timezone_name
        `);

        res.json({
            success: true,
            timezones: result.rows
        });

    } catch (error) {
        console.error('Error obteniendo timezones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener lista de timezones'
        });
    }
});

module.exports = router;
```

---

### FASE 4: FRONTEND - HELPERS Y COMPONENTES (Día 2 - Tarde)

#### 4.1. Nuevo dateHelpers.js Robusto

```javascript
// frontend/src/utils/dateHelpers.js

/**
 * 🌍 HELPERS DE FORMATEO DE FECHAS CON SOPORTE MULTI-TIMEZONE
 * ============================================================
 * Sistema robusto que soporta usuarios en cualquier país del mundo.
 *
 * PRINCIPIOS:
 * - Backend siempre envía ISO UTC (ej: "2025-11-05T14:00:00.000Z")
 * - Frontend formatea según timezone del usuario
 * - Timezone se obtiene de: localStorage → userData → America/Lima (default)
 */

/**
 * Obtener timezone del usuario actual
 */
export const getUserTimezone = () => {
    // 1. Intentar desde localStorage (preferencias guardadas)
    const savedTimezone = localStorage.getItem('userTimezone');
    if (savedTimezone) return savedTimezone;

    // 2. Intentar desde userData (del backend)
    try {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.timezone) {
            localStorage.setItem('userTimezone', userData.timezone);
            return userData.timezone;
        }
    } catch (error) {
        console.warn('Error leyendo timezone de userData:', error);
    }

    // 3. Default: Perú
    return 'America/Lima';
};

/**
 * Detectar timezone del navegador (al hacer login)
 */
export const detectBrowserTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.warn('No se pudo detectar timezone del navegador:', error);
        return 'America/Lima';
    }
};

/**
 * Formatear fecha y hora completos
 * Ejemplo: "05/11/2025 09:00"
 */
export const formatearFechaHora = (fecha, timezone = null) => {
    if (!fecha) return '';

    const tz = timezone || getUserTimezone();
    const date = fecha instanceof Date ? fecha : new Date(fecha);

    // Validar fecha válida
    if (isNaN(date.getTime())) {
        console.warn('Fecha inválida:', fecha);
        return 'Fecha inválida';
    }

    const dia = date.toLocaleDateString('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: tz
    });

    const hora = date.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz
    });

    return `${dia} ${hora}`;
};

/**
 * Formatear solo fecha (DD/MM/YYYY)
 * Ejemplo: "05/11/2025"
 */
export const formatearFechaSimple = (fecha, timezone = null) => {
    if (!fecha) return '';

    const tz = timezone || getUserTimezone();
    const date = fecha instanceof Date ? fecha : new Date(fecha);

    if (isNaN(date.getTime())) return 'Fecha inválida';

    return date.toLocaleDateString('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: tz
    });
};

/**
 * Formatear solo hora (HH:mm)
 * Ejemplo: "09:00"
 */
export const formatearHora = (fecha, timezone = null) => {
    if (!fecha) return '';

    const tz = timezone || getUserTimezone();
    const date = fecha instanceof Date ? fecha : new Date(fecha);

    if (isNaN(date.getTime())) return 'Hora inválida';

    return date.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz
    });
};

/**
 * Convertir fecha para input datetime-local
 * Input datetime-local espera formato: YYYY-MM-DDTHH:mm
 * en timezone LOCAL del usuario
 */
export const fechaParaInput = (fecha, timezone = null) => {
    if (!fecha) return '';

    const tz = timezone || getUserTimezone();
    const date = fecha instanceof Date ? fecha : new Date(fecha);

    if (isNaN(date.getTime())) return '';

    // Formatear en timezone del usuario usando formato ISO-like
    const formatted = date.toLocaleString('sv-SE', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // sv-SE retorna: "2025-11-05 09:00:00"
    // Convertir a: "2025-11-05T09:00"
    return formatted.slice(0, 16).replace(' ', 'T');
};

/**
 * Convertir input datetime-local a ISO UTC para enviar al backend
 * @param {string} inputValue - Valor del input (YYYY-MM-DDTHH:mm)
 * @param {string} timezone - Timezone del usuario (opcional)
 * @returns {string} - ISO UTC string
 */
export const fechaParaBackend = (inputValue, timezone = null) => {
    if (!inputValue) return null;

    const tz = timezone || getUserTimezone();

    // El input viene como "2025-11-05T09:00" en timezone del usuario
    // Necesitamos interpretarlo en ese timezone y convertir a UTC

    // Crear una fecha "ficticia" en UTC con los valores del input
    const [datePart, timePart] = inputValue.split('T');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');

    // Formatear como string con timezone
    const dateString = `${year}-${month}-${day}T${hour}:${minute}:00`;

    // Opción 1: Usar Intl.DateTimeFormat (más preciso)
    try {
        // Crear formatter para el timezone del usuario
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // Parsear la fecha en el timezone del usuario
        const date = new Date(dateString);

        // Ajustar por offset del timezone
        const offsetMs = getTimezoneOffset(tz, date);
        const utcDate = new Date(date.getTime() - offsetMs);

        return utcDate.toISOString();
    } catch (error) {
        console.warn('Error convirtiendo fecha a UTC:', error);
        // Fallback: asumir timezone local del navegador
        return new Date(inputValue).toISOString();
    }
};

/**
 * Obtener offset de timezone en milisegundos
 */
function getTimezoneOffset(timezone, date) {
    try {
        // Crear formatters para UTC y el timezone target
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

        return tzDate.getTime() - utcDate.getTime();
    } catch (error) {
        console.warn('Error calculando offset:', error);
        return 0;
    }
}

/**
 * Formatear fecha relativa (hace X tiempo)
 * Ejemplo: "hace 2 horas", "hace 3 días"
 */
export const formatearFechaRelativa = (fecha, timezone = null) => {
    if (!fecha) return '';

    const ahora = new Date();
    const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);

    if (isNaN(fechaObj.getTime())) return 'Fecha inválida';

    const diffMs = ahora - fechaObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

    return formatearFechaHora(fecha, timezone);
};

/**
 * Verificar si una fecha es hoy
 */
export const esHoy = (fecha, timezone = null) => {
    if (!fecha) return false;

    const tz = timezone || getUserTimezone();
    const hoy = new Date().toLocaleDateString('es', { timeZone: tz });
    const fechaComparar = new Date(fecha).toLocaleDateString('es', { timeZone: tz });

    return hoy === fechaComparar;
};

/**
 * Verificar si una fecha es mañana
 */
export const esManana = (fecha, timezone = null) => {
    if (!fecha) return false;

    const tz = timezone || getUserTimezone();
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const mananaStr = manana.toLocaleDateString('es', { timeZone: tz });
    const fechaComparar = new Date(fecha).toLocaleDateString('es', { timeZone: tz });

    return mananaStr === fechaComparar;
};

/**
 * Formatear monto en formato peruano
 * Ejemplo: "S/ 1,200.00"
 */
export const formatearMonto = (valor) => {
    if (!valor || isNaN(valor)) return 'S/ 0.00';
    return `S/ ${parseFloat(valor).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};
```

#### 4.2. Hook de Timezone

```javascript
// frontend/src/hooks/useTimezone.js
import { useState, useEffect } from 'react';
import { getUserTimezone, detectBrowserTimezone } from '../utils/dateHelpers';
import apiClient from '../services/apiClient';

/**
 * Hook para manejar timezone del usuario
 */
export const useTimezone = () => {
    const [timezone, setTimezone] = useState(getUserTimezone());
    const [loading, setLoading] = useState(false);

    // Cargar timezone del backend al montar
    useEffect(() => {
        const loadUserTimezone = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                if (!user.id) return;

                const response = await apiClient.get(`/usuarios/${user.id}/preferencias`);
                if (response.success && response.preferencias.timezone) {
                    const tz = response.preferencias.timezone;
                    setTimezone(tz);
                    localStorage.setItem('userTimezone', tz);
                }
            } catch (error) {
                console.warn('No se pudo cargar timezone del usuario:', error);
            }
        };

        loadUserTimezone();
    }, []);

    // Actualizar timezone
    const updateTimezone = async (newTimezone) => {
        try {
            setLoading(true);
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            const response = await apiClient.put(`/usuarios/${user.id}/preferencias`, {
                timezone: newTimezone
            });

            if (response.success) {
                setTimezone(newTimezone);
                localStorage.setItem('userTimezone', newTimezone);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error actualizando timezone:', error);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        timezone,
        updateTimezone,
        loading,
        browserTimezone: detectBrowserTimezone()
    };
};
```

#### 4.3. Componente de Selector de Timezone

```javascript
// frontend/src/components/common/TimezoneSelector.jsx
import { useState, useEffect } from 'react';
import { useTimezone } from '../../hooks/useTimezone';
import apiClient from '../../services/apiClient';

const TimezoneSelector = ({ onClose, onSuccess }) => {
    const { timezone: currentTimezone, updateTimezone, loading } = useTimezone();
    const [timezones, setTimezones] = useState([]);
    const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);
    const [loadingTimezones, setLoadingTimezones] = useState(true);

    useEffect(() => {
        loadTimezones();
    }, []);

    const loadTimezones = async () => {
        try {
            const response = await apiClient.get('/timezones');
            if (response.success) {
                setTimezones(response.timezones);
            }
        } catch (error) {
            console.error('Error cargando timezones:', error);
        } finally {
            setLoadingTimezones(false);
        }
    };

    const handleSave = async () => {
        const success = await updateTimezone(selectedTimezone);
        if (success) {
            onSuccess?.();
            onClose();
        } else {
            alert('Error al actualizar timezone');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold mb-4">Configurar Zona Horaria</h2>

                {loadingTimezones ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Selecciona tu zona horaria:
                            </label>
                            <select
                                value={selectedTimezone}
                                onChange={(e) => setSelectedTimezone(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                {timezones.map(tz => (
                                    <option key={tz.timezone_name} value={tz.timezone_name}>
                                        {tz.pais} - {tz.ciudad_ejemplo} ({tz.offset_utc})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TimezoneSelector;
```

---

### FASE 5: TESTING EXHAUSTIVO (Día 3)

#### 5.1. Tests Unitarios de Helpers

```javascript
// frontend/src/utils/__tests__/dateHelpers.test.js
import {
    formatearFechaHora,
    fechaParaInput,
    fechaParaBackend,
    esHoy
} from '../dateHelpers';

describe('dateHelpers', () => {
    // Mock de timezone
    beforeEach(() => {
        localStorage.setItem('userTimezone', 'America/Lima');
    });

    test('formatearFechaHora muestra correctamente en Lima', () => {
        const fecha = '2025-11-05T14:00:00.000Z'; // 14:00 UTC
        const resultado = formatearFechaHora(fecha, 'America/Lima');
        expect(resultado).toBe('05/11/2025 09:00'); // 09:00 Lima (UTC-5)
    });

    test('formatearFechaHora muestra correctamente en Madrid', () => {
        const fecha = '2025-11-05T14:00:00.000Z'; // 14:00 UTC
        const resultado = formatearFechaHora(fecha, 'Europe/Madrid');
        expect(resultado).toBe('05/11/2025 15:00'); // 15:00 Madrid (UTC+1)
    });

    test('fechaParaInput convierte correctamente UTC a Lima', () => {
        const fecha = '2025-11-05T14:00:00.000Z';
        const resultado = fechaParaInput(fecha, 'America/Lima');
        expect(resultado).toBe('2025-11-05T09:00');
    });

    test('fechaParaBackend convierte correctamente Lima a UTC', () => {
        const input = '2025-11-05T09:00'; // 09:00 Lima
        const resultado = fechaParaBackend(input, 'America/Lima');
        expect(resultado).toBe('2025-11-05T14:00:00.000Z'); // 14:00 UTC
    });

    test('esHoy funciona correctamente con timezone', () => {
        const ahora = new Date();
        expect(esHoy(ahora, 'America/Lima')).toBe(true);
    });
});
```

#### 5.2. Tests de Integración

```javascript
// backend/src/__tests__/integration/fechas.test.js
const request = require('supertest');
const app = require('../../app');
const { query } = require('../../config/database');

describe('API de Fechas con Timezone', () => {
    let authToken;
    let testUserId;

    beforeAll(async () => {
        // Login y obtener token
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'test123'
            });

        authToken = response.body.token;
        testUserId = response.body.user.id;
    });

    test('Crear actividad con fecha en UTC', async () => {
        const response = await request(app)
            .post('/api/marketing/actividades')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                descripcion: 'Test Timezone',
                fecha_inicio_planeada: '2025-11-05T14:00:00.000Z',
                fecha_fin_planeada: '2025-11-05T15:00:00.000Z',
                duracion_planeada_minutos: 60,
                usuario_id: testUserId
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        // Verificar que la fecha se guardó correctamente en UTC
        const dbResult = await query(
            'SELECT fecha_inicio_planeada FROM actividades_marketing WHERE id = $1',
            [response.body.actividad.id]
        );

        const fechaDb = dbResult.rows[0].fecha_inicio_planeada;
        expect(fechaDb.toISOString()).toBe('2025-11-05T14:00:00.000Z');
    });

    test('Obtener actividad retorna ISO UTC', async () => {
        // Crear actividad de test
        const createResponse = await request(app)
            .post('/api/marketing/actividades')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                descripcion: 'Test Retorno UTC',
                fecha_inicio_planeada: '2025-11-05T14:00:00.000Z',
                fecha_fin_planeada: '2025-11-05T15:00:00.000Z',
                duracion_planeada_minutos: 60,
                usuario_id: testUserId
            });

        const actividadId = createResponse.body.actividad.id;

        // Obtener actividad
        const getResponse = await request(app)
            .get(`/api/marketing/actividades/${actividadId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(getResponse.status).toBe(200);

        // Verificar formato ISO UTC
        const fecha = getResponse.body.actividad.fecha_inicio_planeada;
        expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(fecha).toBe('2025-11-05T14:00:00.000Z');
    });

    test('Actualizar preferencias de timezone', async () => {
        const response = await request(app)
            .put(`/api/usuarios/${testUserId}/preferencias`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                timezone: 'Europe/Madrid'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.preferencias.timezone).toBe('Europe/Madrid');
    });
});
```

#### 5.3. Checklist de Testing Manual

```markdown
## Testing Manual de Timezone

### Escenario 1: Usuario en Lima (UTC-5)
- [ ] Login con usuario de Lima
- [ ] Verificar timezone en localStorage = "America/Lima"
- [ ] Crear actividad para 10:00 AM Lima (debe guardar como 15:00 UTC)
- [ ] Ver actividad creada (debe mostrar 10:00 AM)
- [ ] Verificar en BD que se guardó 15:00 UTC
- [ ] Editar actividad a 11:00 AM Lima (debe actualizar a 16:00 UTC)

### Escenario 2: Usuario en España (UTC+1)
- [ ] Cambiar timezone a "Europe/Madrid"
- [ ] Crear actividad para 10:00 AM Madrid (debe guardar como 09:00 UTC)
- [ ] Ver actividad creada (debe mostrar 10:00 AM)
- [ ] Ver la MISMA actividad desde usuario de Lima (debe mostrar 04:00 AM)

### Escenario 3: Horario de Verano (DST)
- [ ] Crear actividad en fecha con DST (marzo/octubre)
- [ ] Verificar que offset se aplica correctamente
- [ ] Comparar con fecha sin DST

### Escenario 4: Actividades Vencidas
- [ ] Crear actividad que venza en 1 minuto
- [ ] Esperar a que venza
- [ ] Verificar que modal aparece exactamente cuando vence
- [ ] Verificar que la hora mostrada es correcta según timezone del usuario

### Escenario 5: Reportes y Filtros
- [ ] Filtrar actividades por rango de fechas
- [ ] Verificar que el filtro respeta timezone del usuario
- [ ] Exportar reporte y verificar fechas

### Escenario 6: Múltiples Navegadores
- [ ] Login en Chrome (Lima) y Firefox (Madrid) con mismo usuario
- [ ] Crear actividad en Chrome
- [ ] Refrescar en Firefox
- [ ] Verificar que ambos muestran la hora correcta según su timezone
```

---

### FASE 6: DESPLIEGUE Y ROLLBACK (Día 3 - Tarde)

#### 6.1. Plan de Despliegue

```bash
#!/bin/bash
# deploy_timezone_migration.sh

echo "🚀 Iniciando migración de timezone..."

# 1. Backup de producción
echo "📦 Creando backup..."
pg_dump $DATABASE_URL > "backup_pre_timezone_$(date +%Y%m%d_%H%M%S).sql"

# 2. Detener workers de Bullmq (notificaciones, seguimientos)
echo "⏸️ Deteniendo workers..."
pm2 stop all

# 3. Aplicar migración de BD
echo "🔄 Aplicando migración de base de datos..."
psql $DATABASE_URL < migration_to_timestamptz.sql

# 4. Actualizar código backend
echo "📤 Actualizando backend..."
git pull origin main
cd backend
npm install
pm2 restart backend

# 5. Actualizar código frontend
echo "🎨 Actualizando frontend..."
cd ../frontend
npm install
npm run build

# 6. Reiniciar workers
echo "▶️ Reiniciando workers..."
pm2 start all

echo "✅ Migración completada"
echo "📊 Verificando sistema..."

# 7. Health check
curl -f http://localhost:3001/api/health || echo "⚠️ Backend no responde"
curl -f http://localhost:3000/ || echo "⚠️ Frontend no responde"

echo "🎉 Sistema operacional"
```

#### 6.2. Plan de Rollback

```bash
#!/bin/bash
# rollback_timezone_migration.sh

echo "🔙 Iniciando rollback de migración..."

# 1. Detener servicios
echo "⏸️ Deteniendo servicios..."
pm2 stop all

# 2. Restaurar código anterior
echo "📥 Restaurando código..."
git reset --hard HEAD~1
cd backend && npm install
cd ../frontend && npm install && npm run build

# 3. Restaurar base de datos
echo "🗄️ Restaurando base de datos..."
BACKUP_FILE=$(ls -t backup_pre_timezone_*.sql | head -1)
psql $DATABASE_URL < $BACKUP_FILE

# 4. Reiniciar servicios
echo "▶️ Reiniciando servicios..."
pm2 restart all

echo "✅ Rollback completado"
```

---

## ⚠️ RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Pérdida de datos durante migración | Baja | Crítico | Backup completo + testing exhaustivo |
| Downtime prolongado | Media | Alto | Migración en horario de bajo tráfico + plan de rollback |
| Bugs de timezone en producción | Media | Medio | Testing extensivo + rollout gradual |
| Incompatibilidad de browsers antiguos | Baja | Bajo | Polyfills para Intl API |
| Problemas de performance | Baja | Bajo | Índices en columnas de fecha |

---

## 📊 ESTIMACIÓN DE ESFUERZO

### Desglose por Fase

| Fase | Tareas | Tiempo Estimado | Recursos |
|------|--------|-----------------|----------|
| 1. Preparación | Backup, tablas auxiliares | 2-3 horas | 1 Dev Backend |
| 2. Migración BD | ALTER TABLE, testing | 3-4 horas | 1 Dev Backend + DBA |
| 3. Backend APIs | Middleware, endpoints | 4-5 horas | 1 Dev Backend |
| 4. Frontend | Helpers, components | 4-5 horas | 1 Dev Frontend |
| 5. Testing | Unit + Integration + Manual | 8-10 horas | 2 Devs + QA |
| 6. Despliegue | Deploy + monitoring | 2-3 horas | DevOps + Lead |

**Total:** 23-30 horas = **3-4 días**

---

## ✅ CRITERIOS DE ÉXITO

### Funcionales
- [ ] Usuario puede seleccionar su timezone
- [ ] Fechas se muestran correctamente según timezone del usuario
- [ ] Actividades vencen a la hora correcta
- [ ] Reportes muestran fechas correctas
- [ ] Filtros de fecha funcionan correctamente

### Técnicos
- [ ] Todas las columnas migradas a TIMESTAMPTZ
- [ ] Backend retorna siempre ISO UTC
- [ ] Frontend formatea con timezone del usuario
- [ ] Tests unitarios pasan al 100%
- [ ] Tests de integración pasan al 100%

### Performance
- [ ] Queries de fecha no más lentas que antes
- [ ] Tiempo de carga de vistas no aumenta > 10%
- [ ] Índices optimizados en columnas de fecha

### Calidad
- [ ] Cero bugs críticos en producción primera semana
- [ ] Documentación actualizada
- [ ] Código revisado por 2+ desarrolladores

---

## 📚 DOCUMENTACIÓN ADICIONAL

### Para Desarrolladores
- Leer: [MDN - Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- Leer: [PostgreSQL Timezone Documentation](https://www.postgresql.org/docs/current/datatype-datetime.html)
- Leer: [node-postgres Type Parsers](https://node-postgres.com/features/types)

### Para QA
- Usar herramienta: [Time Zone Converter](https://www.timeanddate.com/worldclock/converter.html)
- Testing en múltiples timezones con Chrome DevTools
- Validar DST con fechas en marzo/octubre

### Para Usuarios
- Configurar timezone en: Perfil → Preferencias → Zona Horaria
- Todas las fechas se mostrarán en tu hora local
- El sistema detecta automáticamente tu timezone al iniciar sesión

---

## 🎯 PRÓXIMOS PASOS

1. **Revisar y aprobar** este documento con el equipo
2. **Asignar recursos** (devs, QA, DevOps)
3. **Crear tickets** en Jira/GitHub para cada fase
4. **Programar sprint** dedicado a esta migración
5. **Preparar ambiente de staging** con datos de producción
6. **Ejecutar FASE 1** en staging primero

---

## 📝 HISTORIAL DE CAMBIOS

| Fecha | Versión | Autor | Cambios |
|-------|---------|-------|---------|
| 2025-11-05 | 1.0 | Claude Code | Documento inicial |

---

**Documento generado por Claude Code**
Sistema CRM/ERP Empresarial v2.0
