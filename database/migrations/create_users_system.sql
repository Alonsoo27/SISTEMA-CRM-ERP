-- ============================================
-- SISTEMA CRM/ERP - GESTIÓN DE USUARIOS
-- Migración: Sistema completo de autenticación
-- ============================================

-- 1. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    nivel VARCHAR(20) NOT NULL, -- 'ADMIN', 'EJECUTIVO', 'OPERATIVO'
    permisos JSONB DEFAULT '[]'::jsonb,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE ÁREAS/DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    departamento VARCHAR(100),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    nombre_completo VARCHAR(255) GENERATED ALWAYS AS (nombre || ' ' || apellido) STORED,

    -- Relaciones
    rol_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    jefe_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Configuración
    avatar TEXT,
    telefono VARCHAR(20),
    es_jefe BOOLEAN DEFAULT false,
    vende BOOLEAN DEFAULT false,
    estado VARCHAR(20) DEFAULT 'ACTIVO', -- 'ACTIVO', 'INACTIVO', 'SUSPENDIDO'

    -- Preferencias de usuario
    configuracion JSONB DEFAULT '{
        "tema": "light",
        "idioma": "es",
        "zona_horaria": "America/Lima",
        "notificaciones": true
    }'::jsonb,

    -- Auditoría
    ultimo_login TIMESTAMP,
    total_sesiones INTEGER DEFAULT 0,
    password_cambiado_en TIMESTAMP,
    debe_cambiar_password BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 4. TABLA DE SESIONES (opcional, para tracking)
CREATE TABLE IF NOT EXISTS sesiones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_area ON usuarios(area_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token_hash);

-- 6. FUNCIÓN PARA ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. TRIGGERS PARA AUTO-UPDATE
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_areas_updated_at ON areas;
CREATE TRIGGER update_areas_updated_at
    BEFORE UPDATE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. INSERTAR ROLES POR DEFECTO
INSERT INTO roles (nombre, descripcion, nivel, permisos) VALUES
('SUPER_ADMIN', 'Administrador con acceso total al sistema', 'ADMIN', '["READ", "WRITE", "DELETE", "ADMIN", "CONFIG", "USERS"]'::jsonb),
('ADMIN', 'Administrador general', 'ADMIN', '["READ", "WRITE", "DELETE", "ADMIN"]'::jsonb),
('GERENTE', 'Gerente de área', 'EJECUTIVO', '["READ", "WRITE", "DELETE"]'::jsonb),
('JEFE', 'Jefe de equipo', 'EJECUTIVO', '["READ", "WRITE"]'::jsonb),
('VENDEDOR', 'Ejecutivo de ventas', 'OPERATIVO', '["READ", "WRITE"]'::jsonb),
('ALMACEN', 'Personal de almacén', 'OPERATIVO', '["READ", "WRITE"]'::jsonb),
('SOPORTE', 'Personal de soporte', 'OPERATIVO', '["READ", "WRITE"]'::jsonb),
('USUARIO', 'Usuario básico', 'OPERATIVO', '["READ"]'::jsonb)
ON CONFLICT (nombre) DO NOTHING;

-- 9. INSERTAR ÁREAS POR DEFECTO
INSERT INTO areas (nombre, departamento, descripcion) VALUES
('SISTEMAS', 'TECNOLOGÍA', 'Departamento de tecnología e informática'),
('VENTAS', 'COMERCIAL', 'Departamento de ventas y comercial'),
('ALMACÉN', 'OPERACIONES', 'Gestión de inventario y almacén'),
('SOPORTE', 'SERVICIOS', 'Atención al cliente y soporte'),
('ADMINISTRACIÓN', 'ADMINISTRACIÓN', 'Administración general'),
('RECURSOS HUMANOS', 'ADMINISTRACIÓN', 'Gestión de personal')
ON CONFLICT DO NOTHING;

-- 10. INSERTAR USUARIO SUPERADMIN INICIAL
-- Password: admin123 (hash bcrypt con 12 rounds)
-- IMPORTANTE: Cambiar la contraseña después del primer login
INSERT INTO usuarios (
    email,
    password_hash,
    nombre,
    apellido,
    rol_id,
    area_id,
    es_jefe,
    estado,
    debe_cambiar_password
) VALUES (
    'eliashuaraca2012@gmail.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIr.0W7zAe', -- admin123
    'Alonso',
    'Admin',
    (SELECT id FROM roles WHERE nombre = 'SUPER_ADMIN'),
    (SELECT id FROM areas WHERE nombre = 'SISTEMAS'),
    true,
    'ACTIVO',
    true
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT
    'Roles creados:' as tipo,
    COUNT(*) as cantidad
FROM roles
UNION ALL
SELECT
    'Áreas creadas:' as tipo,
    COUNT(*) as cantidad
FROM areas
UNION ALL
SELECT
    'Usuarios creados:' as tipo,
    COUNT(*) as cantidad
FROM usuarios;
