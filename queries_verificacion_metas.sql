-- ============================================
-- QUERIES DE VERIFICACIÓN: METAS AVANZADO DASHBOARD
-- Sistema CRM/ERP - Verificación de datos con 0% performance
-- ============================================

-- 1. VERIFICAR ASESORES Y SUS METAS CONFIGURADAS
SELECT
    u.id,
    u.nombre,
    u.apellido,
    u.rol_id,
    u.activo as usuario_activo,
    mv.meta_valor,
    mv.meta_cantidad,
    mv.año,
    mv.mes,
    mv.activo as meta_activa,
    mv.valor_logrado,
    mv.ventas_logradas,
    mv.porcentaje_valor
FROM usuarios u
LEFT JOIN metas_ventas mv ON u.id = mv.asesor_id AND mv.activo = true
WHERE u.rol_id = 7 -- VENDEDOR
ORDER BY u.id;

-- 2. VERIFICAR VENTAS REALES EN AGOSTO 2025 (PERIODO FALLBACK)
SELECT
    v.asesor_id,
    u.nombre,
    u.apellido,
    COUNT(*) as total_ventas,
    SUM(v.valor_final) as valor_total,
    AVG(v.valor_final) as ticket_promedio,
    MIN(v.fecha_venta) as primera_venta,
    MAX(v.fecha_venta) as ultima_venta
FROM ventas v
INNER JOIN usuarios u ON v.asesor_id = u.id
WHERE v.estado_detallado = 'vendido'
    AND v.activo = true
    AND v.fecha_venta >= '2025-08-01'
    AND v.fecha_venta < '2025-09-01'
    AND u.rol_id = 7
GROUP BY v.asesor_id, u.nombre, u.apellido
ORDER BY valor_total DESC;

-- 3. VERIFICAR VENTAS REALES EN SEPTIEMBRE 2025 (PERIODO ACTUAL)
SELECT
    v.asesor_id,
    u.nombre,
    u.apellido,
    COUNT(*) as total_ventas,
    SUM(v.valor_final) as valor_total,
    AVG(v.valor_final) as ticket_promedio,
    MIN(v.fecha_venta) as primera_venta,
    MAX(v.fecha_venta) as ultima_venta
FROM ventas v
INNER JOIN usuarios u ON v.asesor_id = u.id
WHERE v.estado_detallado = 'vendido'
    AND v.activo = true
    AND v.fecha_venta >= '2025-09-01'
    AND v.fecha_venta < '2025-10-01'
    AND u.rol_id = 7
GROUP BY v.asesor_id, u.nombre, u.apellido
ORDER BY valor_total DESC;

-- 4. VERIFICAR TODAS LAS VENTAS POR ASESOR (HISTÓRICO COMPLETO)
SELECT
    v.asesor_id,
    u.nombre,
    u.apellido,
    COUNT(*) as total_ventas,
    SUM(v.valor_final) as valor_total,
    MIN(v.fecha_venta) as primera_venta,
    MAX(v.fecha_venta) as ultima_venta,
    EXTRACT(YEAR FROM v.fecha_venta) as año,
    EXTRACT(MONTH FROM v.fecha_venta) as mes
FROM ventas v
INNER JOIN usuarios u ON v.asesor_id = u.id
WHERE v.estado_detallado = 'vendido'
    AND v.activo = true
    AND u.rol_id = 7
GROUP BY v.asesor_id, u.nombre, u.apellido,
         EXTRACT(YEAR FROM v.fecha_venta), EXTRACT(MONTH FROM v.fecha_venta)
ORDER BY año DESC, mes DESC, valor_total DESC;

-- 5. VERIFICAR USUARIOS COMPLETOS CON DATOS
SELECT
    u.id,
    u.nombre,
    u.apellido,
    u.email,
    u.rol_id,
    r.nombre as rol_nombre,
    u.activo,
    u.created_at,
    u.es_jefe
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
WHERE u.activo = true
ORDER BY u.rol_id, u.nombre;

-- 6. VERIFICAR METAS_VENTAS COMPLETAS
SELECT
    mv.*,
    u.nombre,
    u.apellido
FROM metas_ventas mv
INNER JOIN usuarios u ON mv.asesor_id = u.id
WHERE mv.activo = true
ORDER BY mv.año DESC, mv.mes DESC, mv.asesor_id;

-- 7. VERIFICAR SI HAY DATOS EN LA CONSULTA EXACTA DEL DASHBOARD
WITH metas_data AS (
    SELECT
        mv.asesor_id,
        mv.meta_valor,
        mv.meta_cantidad,
        mv.año,
        mv.mes,
        u.nombre,
        u.apellido,
        u.email,
        u.rol_id,
        -- CALCULAR EN TIEMPO REAL desde tabla ventas
        COALESCE(v.ventas_reales, 0) as ventas_logradas,
        COALESCE(v.valor_real, 0) as valor_logrado,
        -- Calcular porcentaje
        CASE
            WHEN mv.meta_valor > 0 THEN
                ROUND((COALESCE(v.valor_real, 0) / mv.meta_valor) * 100, 2)
            ELSE 0
        END as porcentaje_valor,
        -- Datos adicionales para vista ejecutiva
        CASE
            WHEN mv.meta_valor = 2500 THEN 'Nuevo'
            WHEN mv.meta_valor BETWEEN 4000 AND 5000 THEN 'Intermedio'
            WHEN mv.meta_valor = 8000 THEN 'Avanzado'
            WHEN mv.meta_valor > 8000 THEN 'Elite'
            ELSE 'Custom'
        END as nivel_asesor
    FROM metas_ventas mv
    INNER JOIN usuarios u ON mv.asesor_id = u.id
    LEFT JOIN (
        SELECT
            asesor_id,
            COUNT(*) as ventas_reales,
            SUM(valor_final) as valor_real
        FROM ventas
        WHERE estado_detallado = 'vendido'
            AND activo = true
            AND fecha_venta >= '2025-08-01'
            AND fecha_venta < '2025-09-01'  -- AGOSTO 2025 (fallback)
        GROUP BY asesor_id
    ) v ON mv.asesor_id = v.asesor_id
    WHERE mv.activo = true
        AND u.rol_id IN (7) -- VENDEDOR
        AND mv.año = 2025
        AND mv.mes = 8  -- AGOSTO (fallback)
)
SELECT * FROM metas_data
ORDER BY porcentaje_valor DESC, meta_valor DESC;

-- 8. RESUMEN EJECUTIVO DEL PROBLEMA
SELECT
    'RESUMEN DIAGNÓSTICO' as titulo,
    COUNT(DISTINCT u.id) as total_asesores_activos,
    COUNT(DISTINCT mv.asesor_id) as asesores_con_metas,
    COUNT(DISTINCT v.asesor_id) as asesores_con_ventas,
    SUM(CASE WHEN v.asesor_id IS NOT NULL THEN 1 ELSE 0 END) as total_ventas,
    SUM(COALESCE(v.valor_final, 0)) as valor_total_ventas
FROM usuarios u
LEFT JOIN metas_ventas mv ON u.id = mv.asesor_id AND mv.activo = true
LEFT JOIN ventas v ON u.id = v.asesor_id AND v.estado_detallado = 'vendido' AND v.activo = true
WHERE u.rol_id = 7 AND u.activo = true;