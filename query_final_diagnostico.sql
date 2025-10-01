-- QUERY FINAL - Contar registros y ver datos reales
SELECT
    'despachos' as tabla,
    COUNT(*) as total_registros
FROM despachos
UNION ALL
SELECT 'ventas', COUNT(*) FROM ventas
UNION ALL
SELECT 'venta_detalles', COUNT(*) FROM venta_detalles
UNION ALL
SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL
SELECT 'almacenes', COUNT(*) FROM almacenes;

-- Y si hay despachos, ver los estados:
-- SELECT estado, COUNT(*) as cantidad
-- FROM despachos
-- GROUP BY estado
-- ORDER BY cantidad DESC;