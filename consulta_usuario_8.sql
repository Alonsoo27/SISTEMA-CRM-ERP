-- Consultar información completa del usuario ID 8
SELECT
    u.id,
    u.email,
    u.nombre,
    u.apellido,
    u.estado,
    u.activo,
    u.es_jefe,
    u.vende,
    u.jefe_id,
    u.area_id,
    r.id as rol_id,
    r.nombre as rol_nombre,
    a.nombre as area_nombre
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
LEFT JOIN areas a ON u.area_id = a.id
WHERE u.id = 8;

-- Ver notificaciones del usuario 8
SELECT COUNT(*) as total_notificaciones
FROM notificaciones
WHERE usuario_id = 8;

-- Ver si hay algún problema con el rol
SELECT * FROM roles WHERE id = (SELECT rol_id FROM usuarios WHERE id = 8);
