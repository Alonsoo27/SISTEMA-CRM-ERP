-- ============================================
-- VERIFICAR ESTRUCTURA ACTUAL DE USUARIOS
-- ============================================

-- 1. VERIFICAR SI EXISTEN LAS TABLAS
SELECT
    table_name,
    CASE
        WHEN table_name IN ('usuarios', 'roles', 'areas', 'sesiones') THEN '✅ Existe'
        ELSE '❌ No existe'
    END as estado
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('usuarios', 'roles', 'areas', 'sesiones')
ORDER BY table_name;

-- ============================================

-- 2. VER ESTRUCTURA DE TABLA USUARIOS (si existe)
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================

-- 3. VER ROLES EXISTENTES (si la tabla existe)
SELECT
    id,
    nombre,
    descripcion,
    nivel,
    permisos,
    activo,
    created_at
FROM roles
ORDER BY
    CASE nivel
        WHEN 'ADMIN' THEN 1
        WHEN 'EJECUTIVO' THEN 2
        WHEN 'OPERATIVO' THEN 3
    END,
    nombre;

-- ============================================

-- 4. VER ÁREAS EXISTENTES (si la tabla existe)
SELECT
    id,
    nombre,
    departamento,
    descripcion,
    activo,
    created_at
FROM areas
ORDER BY departamento, nombre;

-- ============================================

-- 5. VER USUARIOS EXISTENTES (si la tabla existe)
SELECT
    u.id,
    u.email,
    u.nombre,
    u.apellido,
    u.nombre_completo,
    r.nombre as rol,
    r.nivel as nivel_rol,
    a.nombre as area,
    u.estado,
    u.es_jefe,
    u.vende,
    u.created_at,
    u.ultimo_login
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE u.deleted_at IS NULL
ORDER BY u.created_at DESC;

-- ============================================

-- 6. CONTAR REGISTROS
SELECT
    'Roles' as tabla,
    COUNT(*) as cantidad
FROM roles
WHERE activo = true

UNION ALL

SELECT
    'Áreas' as tabla,
    COUNT(*) as cantidad
FROM areas
WHERE activo = true

UNION ALL

SELECT
    'Usuarios' as tabla,
    COUNT(*) as cantidad
FROM usuarios
WHERE deleted_at IS NULL;

-- ============================================

-- 7. VERIFICAR SI EXISTE EL USUARIO ADMIN INICIAL
SELECT
    'Usuario Admin Existe' as verificacion,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ SÍ - Email: ' || email
        ELSE '❌ NO - Necesitas crear usuario admin'
    END as resultado
FROM usuarios
WHERE email = 'eliashuaraca2012@gmail.com'
    AND deleted_at IS NULL
GROUP BY email;
