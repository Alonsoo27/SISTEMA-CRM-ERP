-- ========================================
-- 🔄 SINCRONIZACIÓN DE CACHE DE SEGUIMIENTOS
-- ========================================
-- Fecha: 2025-10-11
-- Objetivo: Sincronizar campos de cache en tabla prospectos con el siguiente seguimiento pendiente
-- Contexto: Después de eliminar el trigger obsoleto, los datos existentes necesitan sincronización

-- ========================================
-- PASO 1: DIAGNÓSTICO INICIAL
-- ========================================
-- Ejecuta esto primero para ver el estado actual

SELECT
    'Prospectos activos' as categoria,
    COUNT(*) as total
FROM prospectos
WHERE activo = true AND convertido_venta = false AND estado NOT IN ('Cerrado', 'Perdido')

UNION ALL

SELECT
    'Con seguimientos pendientes' as categoria,
    COUNT(DISTINCT s.prospecto_id) as total
FROM seguimientos s
INNER JOIN prospectos p ON s.prospecto_id = p.id
WHERE s.completado = false
AND s.visible_para_asesor = true
AND p.activo = true
AND p.convertido_venta = false
AND p.estado NOT IN ('Cerrado', 'Perdido')

UNION ALL

SELECT
    'Sin seguimientos pendientes' as categoria,
    COUNT(*) as total
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false AND s.visible_para_asesor = true
WHERE p.activo = true
AND p.convertido_venta = false
AND p.estado NOT IN ('Cerrado', 'Perdido')
AND s.id IS NULL

UNION ALL

SELECT
    'Cache desincronizado (tienen seguimiento pero cache dice completado)' as categoria,
    COUNT(*) as total
FROM prospectos p
INNER JOIN seguimientos s ON p.id = s.prospecto_id
WHERE p.activo = true
AND p.convertido_venta = false
AND s.completado = false
AND s.visible_para_asesor = true
AND p.seguimiento_completado = true;

-- ========================================
-- PASO 2: SINCRONIZACIÓN DE PROSPECTOS CON SEGUIMIENTOS PENDIENTES
-- ========================================
-- Actualiza los campos de cache para prospectos que TIENEN seguimientos pendientes

UPDATE prospectos p
SET seguimiento_obligatorio = siguiente.fecha_programada,
    seguimiento_completado = false,
    fecha_seguimiento = siguiente.fecha_programada,
    estado_seguimiento = 'pendiente',
    seguimiento_vencido = siguiente.vencido,
    updated_at = NOW()
FROM (
    -- Subconsulta: Obtener el PRÓXIMO seguimiento pendiente de cada prospecto
    SELECT DISTINCT ON (s.prospecto_id)
        s.prospecto_id,
        s.fecha_programada,
        s.vencido
    FROM seguimientos s
    INNER JOIN prospectos p2 ON s.prospecto_id = p2.id
    WHERE s.completado = false
    AND s.visible_para_asesor = true
    AND p2.activo = true
    AND p2.convertido_venta = false
    AND p2.estado NOT IN ('Cerrado', 'Perdido')
    ORDER BY s.prospecto_id, s.fecha_programada ASC
) AS siguiente
WHERE p.id = siguiente.prospecto_id;

-- ========================================
-- PASO 3: SINCRONIZACIÓN DE PROSPECTOS SIN SEGUIMIENTOS PENDIENTES
-- ========================================
-- Actualiza los campos de cache para prospectos que NO TIENEN seguimientos pendientes

UPDATE prospectos p
SET seguimiento_completado = true,
    estado_seguimiento = 'realizado',
    fecha_ultimo_seguimiento = NOW(),
    updated_at = NOW()
WHERE p.activo = true
AND p.convertido_venta = false
AND p.estado NOT IN ('Cerrado', 'Perdido')
AND NOT EXISTS (
    SELECT 1
    FROM seguimientos s
    WHERE s.prospecto_id = p.id
    AND s.completado = false
    AND s.visible_para_asesor = true
);

-- ========================================
-- PASO 4: VERIFICACIÓN DE RESULTADOS
-- ========================================
-- Ejecuta esto para confirmar que todo está sincronizado

SELECT
    '🟢 Prospectos con seguimiento pendiente - Cache correcto' as estado,
    COUNT(*) as total
FROM prospectos p
INNER JOIN seguimientos s ON p.id = s.prospecto_id
WHERE p.activo = true
AND p.convertido_venta = false
AND s.completado = false
AND s.visible_para_asesor = true
AND p.seguimiento_completado = false

UNION ALL

SELECT
    '🟢 Prospectos sin seguimiento - Cache correcto' as estado,
    COUNT(*) as total
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false AND s.visible_para_asesor = true
WHERE p.activo = true
AND p.convertido_venta = false
AND s.id IS NULL
AND p.seguimiento_completado = true

UNION ALL

SELECT
    '🔴 DESINCRONIZADOS (tienen seguimiento pero cache dice completado)' as estado,
    COUNT(*) as total
FROM prospectos p
INNER JOIN seguimientos s ON p.id = s.prospecto_id
WHERE p.activo = true
AND p.convertido_venta = false
AND s.completado = false
AND s.visible_para_asesor = true
AND p.seguimiento_completado = true

UNION ALL

SELECT
    '🔴 DESINCRONIZADOS (no tienen seguimiento pero cache dice pendiente)' as estado,
    COUNT(*) as total
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.completado = false AND s.visible_para_asesor = true
WHERE p.activo = true
AND p.convertido_venta = false
AND s.id IS NULL
AND p.seguimiento_completado = false;

-- ========================================
-- PASO 5: DETALLE DE PROSPECTOS ACTUALIZADOS
-- ========================================
-- Ver qué prospectos se sincronizaron

SELECT
    p.codigo,
    p.nombre_cliente,
    p.estado,
    p.seguimiento_obligatorio as cache_fecha_programada,
    p.seguimiento_completado as cache_completado,
    p.estado_seguimiento as cache_estado,
    COUNT(s.id) FILTER (WHERE s.completado = false) as seguimientos_pendientes,
    COUNT(s.id) FILTER (WHERE s.completado = true) as seguimientos_completados,
    MIN(s.fecha_programada) FILTER (WHERE s.completado = false) as proximo_seguimiento
FROM prospectos p
LEFT JOIN seguimientos s ON p.id = s.prospecto_id AND s.visible_para_asesor = true
WHERE p.activo = true
AND p.convertido_venta = false
AND p.estado NOT IN ('Cerrado', 'Perdido')
AND p.updated_at >= NOW() - INTERVAL '5 minutes'
GROUP BY p.id, p.codigo, p.nombre_cliente, p.estado, p.seguimiento_obligatorio, p.seguimiento_completado, p.estado_seguimiento
ORDER BY p.estado, p.codigo;

-- ========================================
-- PASO 6: CASOS ESPECIALES - PROSPECTOS CON MÚLTIPLES SEGUIMIENTOS
-- ========================================
-- Ver prospectos que tienen más de 1 seguimiento pendiente (correcto en nuevo modelo)

SELECT
    p.codigo,
    p.nombre_cliente,
    p.estado,
    p.seguimiento_completado as cache_dice_completado,
    COUNT(s.id) as total_seguimientos_pendientes,
    array_agg(s.tipo ORDER BY s.fecha_programada) as tipos_seguimientos,
    array_agg(s.fecha_programada::date ORDER BY s.fecha_programada) as fechas_programadas,
    MIN(s.fecha_programada) as proximo_seguimiento
FROM prospectos p
INNER JOIN seguimientos s ON p.id = s.prospecto_id
WHERE p.activo = true
AND p.convertido_venta = false
AND s.completado = false
AND s.visible_para_asesor = true
GROUP BY p.id, p.codigo, p.nombre_cliente, p.estado, p.seguimiento_completado
HAVING COUNT(s.id) > 1
ORDER BY COUNT(s.id) DESC, p.codigo;

-- ========================================
-- RESUMEN EJECUTIVO
-- ========================================

SELECT
    '📊 RESUMEN DE SINCRONIZACIÓN' as titulo,
    (SELECT COUNT(*) FROM prospectos WHERE activo = true AND convertido_venta = false) as total_prospectos_activos,
    (SELECT COUNT(DISTINCT prospecto_id) FROM seguimientos WHERE completado = false AND visible_para_asesor = true) as con_seguimientos_pendientes,
    (SELECT COUNT(*) FROM prospectos p
     WHERE p.activo = true AND p.seguimiento_completado = false
     AND EXISTS (SELECT 1 FROM seguimientos s WHERE s.prospecto_id = p.id AND s.completado = false)) as cache_correcto_pendientes,
    (SELECT COUNT(*) FROM prospectos p
     WHERE p.activo = true AND p.seguimiento_completado = true
     AND NOT EXISTS (SELECT 1 FROM seguimientos s WHERE s.prospecto_id = p.id AND s.completado = false AND s.visible_para_asesor = true)) as cache_correcto_completados;

-- ========================================
-- NOTAS IMPORTANTES
-- ========================================
-- 1. Este script se puede ejecutar múltiples veces sin problemas (idempotente)
-- 2. Los campos de cache se actualizan automáticamente en el backend después de esta sincronización
-- 3. El trigger obsoleto YA FUE ELIMINADO, por lo que no interferirá
-- 4. Los campos de cache ahora reflejan el PRÓXIMO seguimiento pendiente, no el último
-- 5. Prospectos pueden tener múltiples seguimientos pendientes, pero el cache muestra el más próximo

-- ========================================
-- ORDEN DE EJECUCIÓN RECOMENDADO
-- ========================================
-- 1. Ejecutar PASO 1 (diagnóstico inicial) ✓
-- 2. Ejecutar PASO 2 (sincronizar con seguimientos) ✓
-- 3. Ejecutar PASO 3 (sincronizar sin seguimientos) ✓
-- 4. Ejecutar PASO 4 (verificación de resultados) ✓
-- 5. Ejecutar PASO 5 (detalle de actualizados) ✓
-- 6. Ejecutar PASO 6 (casos especiales) ✓
-- 7. Ejecutar RESUMEN EJECUTIVO ✓
