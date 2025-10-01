-- ====================================
-- DIAGNÓSTICO DE DESPACHOS - SUPABASE
-- ====================================

-- 1. Verificar si existe tabla despachos y su estructura
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'despachos'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver estructura completa de ventas
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('ventas', 'venta_detalles')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Ver estructura de clientes
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'clientes'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Verificar relaciones entre tablas (foreign keys)
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('despachos', 'ventas', 'venta_detalles')
AND tc.table_schema = 'public';

-- 5. Contar registros existentes (ejecutar solo si las tablas existen)
-- SELECT 'despachos' as tabla, COUNT(*) as registros FROM despachos
-- UNION ALL
-- SELECT 'ventas', COUNT(*) FROM ventas
-- UNION ALL
-- SELECT 'venta_detalles', COUNT(*) FROM venta_detalles
-- UNION ALL
-- SELECT 'clientes', COUNT(*) FROM clientes;

-- 6. Ver estados actuales de despachos (si existe la tabla)
-- SELECT estado, COUNT(*) as cantidad
-- FROM despachos
-- GROUP BY estado
-- ORDER BY cantidad DESC;

-- 7. Ver algunos despachos de ejemplo (si existen)
-- SELECT * FROM despachos LIMIT 3;

-- 8. Ver estructura de almacenes (para el mapa)
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'almacenes'
AND table_schema = 'public'
ORDER BY ordinal_position;