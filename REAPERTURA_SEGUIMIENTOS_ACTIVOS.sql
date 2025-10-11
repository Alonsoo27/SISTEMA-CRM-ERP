-- ========================================
-- 🔄 REAPERTURA DE SEGUIMIENTOS ACTIVOS
-- ========================================
-- Fecha: 2025-10-10
-- Objetivo: Crear seguimientos para 27 prospectos activos que quedaron sin seguimiento
-- Programación: 1 semana desde hoy

-- ========================================
-- PASO 1: VERIFICAR PROSPECTOS AFECTADOS
-- ========================================
-- Ejecuta este query primero para confirmar qué prospectos se van a reactivar

SELECT
    p.id,
    p.codigo,
    p.nombre_cliente,
    p.estado,
    p.asesor_id,
    p.asesor_nombre,
    p.seguimiento_obligatorio as ultimo_seguimiento,
    p.seguimiento_completado,
    COUNT(s.id) as total_seguimientos,
    COUNT(CASE WHEN s.completado = false THEN 1 END) as seguimientos_activos
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id
WHERE p.activo = true
  AND p.convertido_venta = false
  AND p.estado NOT IN ('Cerrado', 'Perdido')
GROUP BY p.id, p.codigo, p.nombre_cliente, p.estado, p.asesor_id, p.asesor_nombre,
         p.seguimiento_obligatorio, p.seguimiento_completado
HAVING COUNT(CASE WHEN s.completado = false THEN 1 END) = 0
ORDER BY p.estado, p.codigo;

-- Resultado esperado: ~27 prospectos (Cotizado: 16, Negociacion: 8, Prospecto: 3)

-- ========================================
-- PASO 2: CREAR SEGUIMIENTOS AUTOMÁTICOS
-- ========================================
-- Este script crea seguimientos para 1 semana desde ahora

INSERT INTO seguimientos (
    prospecto_id,
    asesor_id,
    fecha_programada,
    fecha_limite,
    tipo,
    descripcion,
    completado,
    visible_para_asesor,
    created_at
)
SELECT
    p.id as prospecto_id,
    p.asesor_id,
    -- Fecha programada: En 7 días a las 10:00 AM
    (CURRENT_DATE + INTERVAL '7 days' + INTERVAL '10 hours') as fecha_programada,
    -- Fecha límite: 18 horas después de la fecha programada
    (CURRENT_DATE + INTERVAL '7 days' + INTERVAL '10 hours' + INTERVAL '18 hours') as fecha_limite,
    'Llamada' as tipo,
    CONCAT(
        'Seguimiento de reactivación automática - Prospecto en estado: ',
        p.estado,
        '. Último contacto: ',
        TO_CHAR(p.seguimiento_obligatorio, 'DD/MM/YYYY')
    ) as descripcion,
    false as completado,
    true as visible_para_asesor,
    NOW() as created_at
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false
WHERE p.activo = true
  AND p.convertido_venta = false
  AND p.estado NOT IN ('Cerrado', 'Perdido')
  AND s.id IS NULL  -- Solo prospectos sin seguimientos activos
GROUP BY p.id, p.asesor_id, p.estado, p.seguimiento_obligatorio;

-- ========================================
-- PASO 3: ACTUALIZAR TABLA PROSPECTOS
-- ========================================
-- Sincronizar campos de cache en tabla prospectos

UPDATE prospectos p
SET
    seguimiento_obligatorio = (CURRENT_DATE + INTERVAL '7 days' + INTERVAL '10 hours'),
    seguimiento_completado = false,
    fecha_seguimiento = (CURRENT_DATE + INTERVAL '7 days' + INTERVAL '10 hours'),
    estado_seguimiento = 'pendiente',
    updated_at = NOW()
FROM (
    SELECT DISTINCT p2.id
    FROM prospectos p2
    LEFT JOIN seguimientos s ON p2.id = s.prospecto_id AND s.completado = false
    WHERE p2.activo = true
      AND p2.convertido_venta = false
      AND p2.estado NOT IN ('Cerrado', 'Perdido')
      AND s.id IS NULL
) as prospectos_sin_seguimiento
WHERE p.id = prospectos_sin_seguimiento.id;

-- ========================================
-- PASO 4: VERIFICAR RESULTADOS
-- ========================================
-- Confirmar que los seguimientos se crearon correctamente

SELECT
    p.codigo,
    p.nombre_cliente,
    p.estado,
    p.asesor_nombre,
    s.fecha_programada,
    s.fecha_limite,
    s.tipo,
    s.descripcion,
    s.completado,
    s.visible_para_asesor,
    s.created_at
FROM seguimientos s
INNER JOIN prospectos p ON s.prospecto_id = p.id
WHERE s.created_at >= NOW() - INTERVAL '5 minutes'
  AND s.descripcion LIKE '%reactivación automática%'
ORDER BY p.codigo;

-- ========================================
-- PASO 5: ESTADÍSTICAS FINALES
-- ========================================
-- Ver el estado actual de seguimientos

SELECT
    'Total prospectos activos' as metrica,
    COUNT(*) as valor
FROM prospectos WHERE activo = true AND convertido_venta = false

UNION ALL

SELECT
    'Prospectos con seguimiento activo' as metrica,
    COUNT(DISTINCT s.prospecto_id) as valor
FROM seguimientos s
INNER JOIN prospectos p ON s.prospecto_id = p.id
WHERE s.completado = false
  AND p.activo = true
  AND p.convertido_venta = false

UNION ALL

SELECT
    'Prospectos sin seguimiento (DEBE SER 0)' as metrica,
    COUNT(*) as valor
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false
WHERE p.activo = true
  AND p.convertido_venta = false
  AND p.estado NOT IN ('Cerrado', 'Perdido')
  AND s.id IS NULL

UNION ALL

SELECT
    'Seguimientos creados hoy' as metrica,
    COUNT(*) as valor
FROM seguimientos
WHERE created_at >= CURRENT_DATE;

-- ========================================
-- ROLLBACK (Solo si algo falla)
-- ========================================
-- NO EJECUTAR A MENOS QUE NECESITES REVERTIR

/*
DELETE FROM seguimientos
WHERE descripcion LIKE '%reactivación automática%'
  AND created_at >= NOW() - INTERVAL '1 hour';

UPDATE prospectos
SET seguimiento_completado = true,
    estado_seguimiento = 'realizado'
WHERE id IN (
    SELECT DISTINCT p.id
    FROM prospectos p
    LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false
    WHERE p.activo = true
      AND p.convertido_venta = false
      AND p.estado NOT IN ('Cerrado', 'Perdido')
      AND s.id IS NULL
);
*/

-- ========================================
-- NOTAS IMPORTANTES
-- ========================================
-- 1. Los seguimientos se crean para 7 días desde HOY a las 10:00 AM
-- 2. La fecha límite es 18 horas después (ventana laboral del sistema)
-- 3. Los seguimientos son visibles para los asesores asignados
-- 4. Se marcan como tipo "Llamada" por defecto
-- 5. La descripción indica que es una reactivación automática

-- ========================================
-- ORDEN DE EJECUCIÓN RECOMENDADO
-- ========================================
-- 1. Ejecutar PASO 1 (verificar) ✓
-- 2. Ejecutar PASO 2 (crear seguimientos) ✓
-- 3. Ejecutar PASO 3 (actualizar prospectos) ✓
-- 4. Ejecutar PASO 4 (verificar resultados) ✓
-- 5. Ejecutar PASO 5 (ver estadísticas) ✓
