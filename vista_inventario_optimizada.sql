-- Vista optimizada de inventario - Solo productos con stock real + fallback
-- Reduce de ~5,291 registros a ~680 registros (87% menos)

-- PASO 1: Respaldar vista actual
CREATE OR REPLACE VIEW vista_inventario_completo_backup AS
SELECT * FROM vista_inventario_completo;

-- PASO 2: Crear nueva vista optimizada
CREATE OR REPLACE VIEW vista_inventario_completo AS
WITH productos_con_stock AS (
    -- Productos que tienen stock real en algún almacén
    SELECT DISTINCT
        p.id AS producto_id,
        p.codigo AS producto_codigo,
        p.descripcion AS producto_descripcion,
        p.marca,
        p.unidad_medida,
        p.linea_producto,
        p.sublinea_producto,
        c.nombre AS categoria,
        a.id AS almacen_id,
        a.codigo AS almacen_codigo,
        a.nombre AS almacen_nombre,
        a.tipo AS almacen_tipo,
        a.piso,
        ap.codigo AS almacen_padre_codigo,
        ap.nombre AS almacen_padre_nombre,
        i.stock_actual,
        i.stock_minimo,
        i.stock_maximo,
        i.costo_promedio,
        i.ultimo_movimiento,
        CASE
            WHEN i.stock_actual <= 0 THEN 'AGOTADO'
            WHEN i.stock_actual <= i.stock_minimo THEN 'BAJO'
            ELSE 'NORMAL'
        END AS estado_stock,
        (i.stock_actual * COALESCE(p.precio_sin_igv, 0)) AS valor_inventario,
        p.tipo AS producto_tipo
    FROM productos p
    INNER JOIN inventario i ON p.id = i.producto_id
    INNER JOIN almacenes a ON i.almacen_id = a.id
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN almacenes ap ON a.almacen_padre_id = ap.id
    WHERE p.activo = true
    AND a.activo = true
    AND p.tipo != 'SERVICIOS'
    AND i.stock_actual > 0  -- Solo productos con stock real
),
productos_sin_stock AS (
    -- Productos sin stock: mostrar en almacén central como placeholder
    SELECT DISTINCT
        p.id AS producto_id,
        p.codigo AS producto_codigo,
        p.descripcion AS producto_descripcion,
        p.marca,
        p.unidad_medida,
        p.linea_producto,
        p.sublinea_producto,
        c.nombre AS categoria,
        a.id AS almacen_id,
        a.codigo AS almacen_codigo,
        a.nombre AS almacen_nombre,
        a.tipo AS almacen_tipo,
        a.piso,
        ap.codigo AS almacen_padre_codigo,
        ap.nombre AS almacen_padre_nombre,
        COALESCE(0, 0) AS stock_actual,
        COALESCE(0, 0) AS stock_minimo,
        NULL AS stock_maximo,
        NULL AS costo_promedio,
        NULL AS ultimo_movimiento,
        'AGOTADO' AS estado_stock,
        0 AS valor_inventario,
        p.tipo AS producto_tipo
    FROM productos p
    CROSS JOIN almacenes a
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN almacenes ap ON a.almacen_padre_id = ap.id
    WHERE p.activo = true
    AND a.activo = true
    AND p.tipo != 'SERVICIOS'
    AND a.tipo = 'PRINCIPAL'  -- Solo mostrar en almacén principal
    AND p.id NOT IN (
        SELECT DISTINCT producto_id
        FROM inventario
        WHERE stock_actual > 0
    )
)
-- Unir productos con stock + productos sin stock
SELECT * FROM productos_con_stock
UNION ALL
SELECT * FROM productos_sin_stock
ORDER BY almacen_tipo, piso, almacen_nombre, producto_codigo;

-- PASO 3: Verificar el resultado
SELECT
    'ANTES (vista_inventario_completo_backup)' as tipo,
    COUNT(*) as registros
FROM vista_inventario_completo_backup

UNION ALL

SELECT
    'DESPUÉS (vista_inventario_completo optimizada)' as tipo,
    COUNT(*) as registros
FROM vista_inventario_completo

UNION ALL

SELECT
    'Productos únicos' as tipo,
    COUNT(DISTINCT producto_codigo) as registros
FROM vista_inventario_completo;

-- PASO 4: Verificar productos sin duplicados
SELECT
    producto_codigo,
    COUNT(*) as apariciones
FROM vista_inventario_completo
GROUP BY producto_codigo
HAVING COUNT(*) > 5  -- Productos que aparecen en más de 5 almacenes
ORDER BY apariciones DESC
LIMIT 10;