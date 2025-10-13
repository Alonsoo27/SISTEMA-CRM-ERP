-- =====================================================
-- SCRIPT DE VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================
-- Ejecuta este script DESPUÉS de correr MIGRACION_SEGUIMIENTOS_COMPLETA.sql
-- para verificar que todo esté correctamente configurado

-- =====================================================
-- 1. VERIFICAR COLUMNAS REQUERIDAS
-- =====================================================

SELECT
    'Columnas de la tabla seguimientos' as verificacion;

SELECT
    column_name,
    data_type,
    is_nullable,
    CASE
        WHEN column_name IN ('notas', 'calificacion', 'completado_por', 'descripcion', 'created_at', 'updated_at')
        THEN '✅ NUEVA/ACTUALIZADA'
        ELSE 'Existente'
    END as estado
FROM information_schema.columns
WHERE table_name = 'seguimientos'
ORDER BY
    CASE
        WHEN column_name IN ('notas', 'calificacion', 'completado_por', 'descripcion', 'created_at', 'updated_at')
        THEN 0
        ELSE 1
    END,
    ordinal_position;

-- =====================================================
-- 2. VERIFICAR ÍNDICES CREADOS
-- =====================================================

SELECT
    'Índices de la tabla seguimientos' as verificacion;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'seguimientos'
ORDER BY indexname;

-- =====================================================
-- 3. VERIFICAR CONSTRAINTS
-- =====================================================

SELECT
    'Constraints de la tabla seguimientos' as verificacion;

SELECT
    con.conname AS constraint_name,
    CASE con.contype
        WHEN 'p' THEN 'Primary Key'
        WHEN 'f' THEN 'Foreign Key'
        WHEN 'u' THEN 'Unique'
        WHEN 'c' THEN 'Check'
        ELSE 'Other'
    END AS constraint_type
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'seguimientos'
ORDER BY con.contype, con.conname;

-- =====================================================
-- 4. VERIFICAR TRIGGERS
-- =====================================================

SELECT
    'Triggers de la tabla seguimientos' as verificacion;

SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'seguimientos'
ORDER BY trigger_name;

-- =====================================================
-- 5. PRUEBA DE INSERCIÓN (OPCIONAL)
-- =====================================================

-- Descomenta esto solo si quieres hacer una prueba real de inserción
/*
BEGIN;

-- Prueba de inserción con las nuevas columnas
INSERT INTO seguimientos (
    prospecto_id,
    asesor_id,
    fecha_programada,
    fecha_limite,
    tipo,
    descripcion,
    completado,
    visible_para_asesor
) VALUES (
    1, -- Cambia esto por un prospecto_id real
    1, -- Cambia esto por un asesor_id real
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '2 days',
    'Llamada',
    'Seguimiento de prueba post-migración',
    false,
    true
)
RETURNING id, descripcion, created_at, updated_at;

ROLLBACK; -- No guardar la prueba
*/

-- =====================================================
-- 6. RESUMEN DE VERIFICACIÓN
-- =====================================================

SELECT
    '✅ VERIFICACIÓN COMPLETA' as status,
    'Si ves todas las columnas nuevas arriba, la migración fue exitosa' as mensaje,
    'Ahora puedes reiniciar el backend y probar la funcionalidad' as siguiente_paso;
