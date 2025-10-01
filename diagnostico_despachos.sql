-- ====================================
-- DIAGNÓSTICO DE DESPACHOS - ESTRUCTURA
-- ====================================

-- 1. Verificar si existe tabla despachos
SELECT
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name IN ('despachos', 'despacho')
ORDER BY table_name;

-- 2. Estructura de tabla despachos (si existe)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'despachos'
ORDER BY ordinal_position;

-- 3. Verificar relación con ventas
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('ventas', 'venta', 'venta_detalles', 'detalle_ventas')
ORDER BY table_name, ordinal_position;

-- 4. Contar registros en despachos (si existe)
-- SELECT COUNT(*) as total_despachos FROM despachos;

-- 5. Ver algunos despachos de ejemplo (si existen)
-- SELECT * FROM despachos LIMIT 5;

-- 6. Verificar estados de despachos
-- SELECT estado, COUNT(*) as cantidad
-- FROM despachos
-- GROUP BY estado
-- ORDER BY cantidad DESC;

-- 7. Verificar clientes relacionados
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('clientes', 'cliente')
AND column_name LIKE '%nombre%' OR column_name LIKE '%direccion%' OR column_name LIKE '%telefono%'
ORDER BY table_name, ordinal_position;