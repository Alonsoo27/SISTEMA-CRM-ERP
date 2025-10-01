-- DIAGNÓSTICO RÁPIDO: ¿Por qué todos los asesores tienen 0% performance?

-- 1. Ver qué datos hay en metas_ventas
SELECT
    'metas_ventas' as tabla,
    COUNT(*) as total_registros,
    MIN(año) as año_min,
    MAX(año) as año_max,
    MIN(mes) as mes_min,
    MAX(mes) as mes_max
FROM metas_ventas
WHERE activo = true;

-- 2. Ver qué datos hay en ventas
SELECT
    'ventas' as tabla,
    COUNT(*) as total_registros,
    MIN(fecha_venta) as fecha_min,
    MAX(fecha_venta) as fecha_max,
    COUNT(DISTINCT asesor_id) as asesores_distintos
FROM ventas
WHERE estado_detallado = 'vendido' AND activo = true;

-- 3. Ver detalle por mes de las ventas
SELECT
    EXTRACT(YEAR FROM fecha_venta) as año,
    EXTRACT(MONTH FROM fecha_venta) as mes,
    COUNT(*) as total_ventas,
    SUM(valor_final) as valor_total,
    COUNT(DISTINCT asesor_id) as asesores_activos
FROM ventas
WHERE estado_detallado = 'vendido' AND activo = true
GROUP BY EXTRACT(YEAR FROM fecha_venta), EXTRACT(MONTH FROM fecha_venta)
ORDER BY año DESC, mes DESC;

-- 4. Ver qué asesores tienen metas configuradas
SELECT
    mv.asesor_id,
    u.nombre,
    u.apellido,
    mv.año,
    mv.mes,
    mv.meta_valor,
    mv.meta_cantidad
FROM metas_ventas mv
INNER JOIN usuarios u ON mv.asesor_id = u.id
WHERE mv.activo = true
ORDER BY mv.año DESC, mv.mes DESC, mv.asesor_id;

-- 5. Verificar el JOIN exacto que está fallando (agosto 2025)
SELECT
    mv.asesor_id,
    u.nombre,
    u.apellido,
    mv.meta_valor,
    COALESCE(v.ventas_reales, 0) as ventas_logradas,
    COALESCE(v.valor_real, 0) as valor_logrado,
    CASE
        WHEN mv.meta_valor > 0 THEN ROUND((COALESCE(v.valor_real, 0) / mv.meta_valor) * 100, 2)
        ELSE 0
    END as porcentaje_valor
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
        AND EXTRACT(YEAR FROM fecha_venta) = 2025
        AND EXTRACT(MONTH FROM fecha_venta) = 8  -- AGOSTO
    GROUP BY asesor_id
) v ON mv.asesor_id = v.asesor_id
WHERE mv.activo = true
    AND mv.año = 2025
    AND mv.mes = 8
    AND u.rol_id = 7  -- VENDEDOR
ORDER BY porcentaje_valor DESC;