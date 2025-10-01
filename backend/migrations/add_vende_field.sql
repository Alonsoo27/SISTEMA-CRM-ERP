-- ============================================
-- MIGRACIÓN: Agregar campo 'vende' a usuarios
-- Sistema CRM/ERP v2.0 - Gestión de Permisos
-- ============================================

-- Agregar campo 'vende' a la tabla usuarios
ALTER TABLE usuarios
ADD COLUMN vende BOOLEAN DEFAULT false;

-- Actualizar usuarios que pueden vender según roles
UPDATE usuarios SET vende = true
WHERE rol_id IN (
    1,  -- SUPER_ADMIN
    7,  -- VENDEDOR
    11  -- ADMIN
);

-- Agregar comentarios para documentación
COMMENT ON COLUMN usuarios.vende IS 'Indica si el usuario puede realizar ventas y acceder a dashboard personal';

-- Crear índice para optimizar consultas
CREATE INDEX idx_usuarios_vende ON usuarios(vende) WHERE vende = true;

-- Verificar cambios aplicados
SELECT
    u.id,
    u.nombre,
    u.apellido,
    r.nombre as rol,
    u.vende,
    u.activo
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
WHERE u.activo = true
ORDER BY u.rol_id, u.nombre;

-- ============================================
-- LOG DE MIGRACIÓN
-- ============================================
INSERT INTO migraciones (
    nombre,
    descripcion,
    fecha_ejecucion,
    version
) VALUES (
    'add_vende_field',
    'Agregar campo vende a usuarios para control de permisos de venta',
    NOW(),
    '2.1.0'
);