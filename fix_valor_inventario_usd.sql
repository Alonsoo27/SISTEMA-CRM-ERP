-- Fix para corregir el cálculo de valor_inventario usando precio_sin_igv (USD)
-- PROBLEMA: La vista usa costo_promedio (que está en 0) en lugar de precio_sin_igv

CREATE OR REPLACE VIEW vista_inventario_completo AS
SELECT
    p.id AS producto_id,
    p.codigo AS producto_codigo,
    p.descripcion AS producto_descripcion,
    p.marca,
    p.unidad_medida,
    c.nombre AS categoria,
    a.id AS almacen_id,
    a.codigo AS almacen_codigo,
    a.nombre AS almacen_nombre,
    a.tipo AS almacen_tipo,
    a.piso,
    ap.codigo AS almacen_padre_codigo,
    ap.nombre AS almacen_padre_nombre,
    COALESCE(i.stock_actual, 0) AS stock_actual,
    COALESCE(i.stock_minimo, 0) AS stock_minimo,
    i.stock_maximo,
    i.costo_promedio,
    i.ultimo_movimiento,
    CASE
        WHEN COALESCE(i.stock_actual, 0) <= 0 THEN 'AGOTADO'
        WHEN COALESCE(i.stock_actual, 0) <= COALESCE(i.stock_minimo, 0) THEN 'BAJO'
        ELSE 'NORMAL'
    END AS estado_stock,
    -- CAMBIO PRINCIPAL: Usar precio_sin_igv en lugar de costo_promedio
    (COALESCE(i.stock_actual, 0) * COALESCE(p.precio_sin_igv, 0)) AS valor_inventario
FROM productos p
CROSS JOIN almacenes a
LEFT JOIN inventario i ON p.id = i.producto_id AND a.id = i.almacen_id
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN almacenes ap ON a.almacen_padre_id = ap.id
WHERE p.activo = true AND a.activo = true
ORDER BY a.tipo, a.piso, a.nombre, p.codigo;

-- Verificar que funciona correctamente
SELECT
    producto_codigo,
    producto_descripcion,
    stock_actual,
    valor_inventario
FROM vista_inventario_completo
WHERE producto_codigo IN ('VRE1510', 'VRE2805', 'VRE1505')
AND stock_actual > 0
LIMIT 5;