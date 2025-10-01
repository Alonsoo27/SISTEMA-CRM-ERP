-- Query para entender la estructura completa del inventario
SELECT
    -- Estructura de tabla inventario
    'inventario' as tabla,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventario'
UNION ALL
SELECT
    -- Estructura de tabla almacenes
    'almacenes' as tabla,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'almacenes'
UNION ALL
SELECT
    -- Estructura de tabla productos
    'productos' as tabla,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'productos'
ORDER BY tabla, column_name;

-- Query para obtener una muestra real de datos
WITH inventario_consolidado AS (
    SELECT
        p.id as producto_id,
        p.codigo,
        p.nombre as producto_nombre,
        p.marca,
        p.precio_venta,
        p.unidad_medida,
        COUNT(DISTINCT i.almacen_id) as almacenes_con_stock,
        COUNT(DISTINCT a.id) as total_ubicaciones_posibles,
        SUM(COALESCE(i.cantidad, 0)) as cantidad_total,
        SUM(COALESCE(i.cantidad, 0) * p.precio_venta) as valor_total,
        CASE
            WHEN SUM(COALESCE(i.cantidad, 0)) = 0 THEN 'Sin Stock'
            WHEN SUM(COALESCE(i.cantidad, 0)) <= 10 THEN 'Stock Bajo'
            ELSE 'Stock Normal'
        END as estado_stock
    FROM productos p
    LEFT JOIN inventario i ON p.id = i.producto_id
    LEFT JOIN almacenes a ON i.almacen_id = a.id AND a.activo = true
    WHERE p.activo = true
    GROUP BY p.id, p.codigo, p.nombre, p.marca, p.precio_venta, p.unidad_medida
)
SELECT * FROM inventario_consolidado
ORDER BY cantidad_total ASC, producto_nombre
LIMIT 20;