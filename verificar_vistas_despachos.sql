-- ==========================================
-- QUERY PARA VERIFICAR VISTAS DE DESPACHOS
-- ==========================================

-- 1. Verificar todas las vistas relacionadas con despachos
SELECT
    table_name,
    table_type,
    'Vista relacionada con despachos' as descripcion
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%despacho%'
ORDER BY table_name;

-- ==========================================

-- 2. Verificar funciones y triggers de despachos
SELECT
    routine_name,
    routine_type,
    'Función/Procedimiento de despachos' as descripcion
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%despacho%' OR routine_name LIKE '%estado%')
ORDER BY routine_name;

-- ==========================================

-- 3. Verificar triggers activos en tabla despachos
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    'Trigger de despachos' as descripcion
FROM information_schema.triggers
WHERE event_object_table = 'despachos'
ORDER BY trigger_name;

-- ==========================================

-- 4. Verificar índices de despachos
SELECT
    indexname,
    tablename,
    'Índice de optimización' as descripcion
FROM pg_indexes
WHERE tablename = 'despachos'
ORDER BY indexname;

-- ==========================================

-- 5. Probar que las vistas funcionen (si existen)
-- DESCOMENTA ESTAS LÍNEAS UNA POR UNA PARA PROBAR:

-- SELECT 'vista_despachos_completos' as vista, COUNT(*) as registros
-- FROM vista_despachos_completos;

-- SELECT 'vista_despachos_dashboard' as vista, *
-- FROM vista_despachos_dashboard;

-- SELECT 'vista_despachos_criticos' as vista, COUNT(*) as registros
-- FROM vista_despachos_criticos;