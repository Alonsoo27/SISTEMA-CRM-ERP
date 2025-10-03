-- ============================================
-- QUERIES DE DEBUG PARA PERMISOS
-- ============================================

-- 1. Ver TODOS los roles existentes
SELECT
    id,
    nombre,
    descripcion,
    permisos
FROM roles
ORDER BY id;

-- 2. Ver el usuario SUPER_ADMIN específico (ajusta el email si es necesario)
SELECT
    u.id,
    u.email,
    u.nombre,
    u.apellido,
    u.nombre || ' ' || u.apellido as nombre_completo,
    u.rol_id,
    u.es_jefe,
    u.vende,
    u.jefe_id,
    u.activo,
    r.nombre as rol_nombre,
    r.permisos,
    a.nombre as area_nombre
FROM usuarios u
JOIN roles r ON u.rol_id = r.id
JOIN areas a ON u.area_id = a.id
WHERE u.email = 'admin@sistema.com'  -- ← AJUSTA ESTE EMAIL
   OR u.rol_id = 1  -- SUPER_ADMIN
ORDER BY u.id;

-- 3. Ver TODOS los usuarios con sus roles
SELECT
    u.id,
    u.email,
    u.nombre || ' ' || u.apellido as nombre_completo,
    u.rol_id,
    r.nombre as rol_nombre,
    u.es_jefe,
    u.vende,
    u.activo
FROM usuarios u
JOIN roles r ON u.rol_id = r.id
WHERE u.activo = true
ORDER BY u.rol_id, u.id;
