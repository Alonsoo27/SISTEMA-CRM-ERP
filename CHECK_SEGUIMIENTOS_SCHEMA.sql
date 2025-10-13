-- =====================================================
-- QUERY PARA VERIFICAR ESTRUCTURA DE TABLA SEGUIMIENTOS
-- =====================================================
-- Ejecuta esto en tu cliente PostgreSQL para ver la estructura actual

-- Ver todas las columnas de la tabla seguimientos
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'seguimientos'
ORDER BY ordinal_position;

-- Ver índices de la tabla
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'seguimientos';

-- Ver constraints y foreign keys
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'p' THEN 'Primary Key'
        WHEN 'f' THEN 'Foreign Key'
        WHEN 'u' THEN 'Unique'
        WHEN 'c' THEN 'Check'
        ELSE 'Other'
    END AS constraint_description
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'seguimientos';
