-- ============================================
-- SISTEMA COMPLETO DE JERARQUÍA ORGANIZACIONAL
-- Sistema CRM/ERP v2.0 - Estructura Empresarial
-- ============================================

-- 1. Agregar columna jefe_id para jerarquía
ALTER TABLE usuarios
ADD COLUMN jefe_id INTEGER REFERENCES usuarios(id);

-- 2. Agregar columna area_id si no existe (para departamentos)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='usuarios' AND column_name='area_id') THEN
        ALTER TABLE usuarios ADD COLUMN area_id INTEGER;
    END IF;
END $$;

-- 3. Crear tabla de áreas/departamentos si no existe
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    jefe_area_id INTEGER REFERENCES usuarios(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Insertar áreas básicas empresariales
INSERT INTO areas (id, nombre, descripcion) VALUES
(1, 'Dirección General', 'Dirección ejecutiva y estratégica'),
(2, 'Ventas', 'Área comercial y desarrollo de negocios'),
(3, 'Marketing', 'Promoción, publicidad y posicionamiento'),
(4, 'Soporte Técnico', 'Atención al cliente y soporte'),
(5, 'Almacén', 'Gestión de inventarios y logística'),
(6, 'Administración', 'Recursos humanos y finanzas')
ON CONFLICT (nombre) DO NOTHING;

-- 5. Establecer jerarquía organizacional típica
UPDATE usuarios SET
    area_id = CASE rol_id
        WHEN 1 THEN 1  -- SUPER_ADMIN → Dirección General
        WHEN 2 THEN 1  -- GERENTE → Dirección General
        WHEN 3 THEN 2  -- JEFE_VENTAS → Ventas
        WHEN 4 THEN 3  -- JEFE_MARKETING → Marketing
        WHEN 5 THEN 4  -- JEFE_SOPORTE → Soporte
        WHEN 6 THEN 5  -- JEFE_ALMACEN → Almacén
        WHEN 7 THEN 2  -- VENDEDOR → Ventas
        WHEN 8 THEN 3  -- ESPECIALISTA_MARKETING → Marketing
        WHEN 9 THEN 4  -- AGENTE_SOPORTE → Soporte
        WHEN 10 THEN 5 -- OPERADOR_ALMACEN → Almacén
        WHEN 11 THEN 6 -- ADMIN → Administración
        ELSE 1
    END;

-- 6. Establecer relaciones jerárquicas (ejemplo organizacional)
-- GERENTE supervisa a todos los jefes de área
UPDATE usuarios SET jefe_id = (
    SELECT id FROM usuarios WHERE rol_id = 2 AND activo = true LIMIT 1
) WHERE rol_id IN (3, 4, 5, 6) AND activo = true;

-- Jefes supervisan a su equipo
UPDATE usuarios SET jefe_id = (
    SELECT id FROM usuarios WHERE rol_id = 3 AND activo = true LIMIT 1
) WHERE rol_id = 7 AND activo = true;

UPDATE usuarios SET jefe_id = (
    SELECT id FROM usuarios WHERE rol_id = 4 AND activo = true LIMIT 1
) WHERE rol_id = 8 AND activo = true;

UPDATE usuarios SET jefe_id = (
    SELECT id FROM usuarios WHERE rol_id = 5 AND activo = true LIMIT 1
) WHERE rol_id = 9 AND activo = true;

UPDATE usuarios SET jefe_id = (
    SELECT id FROM usuarios WHERE rol_id = 6 AND activo = true LIMIT 1
) WHERE rol_id = 10 AND activo = true;

-- 7. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_usuarios_jefe_id ON usuarios(jefe_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_area_id ON usuarios(area_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_jerarquia ON usuarios(jefe_id, area_id, activo);

-- 8. Función recursiva para obtener subordinados
CREATE OR REPLACE FUNCTION obtener_subordinados(jefe_usuario_id INTEGER)
RETURNS TABLE(
    subordinado_id INTEGER,
    nivel INTEGER,
    path TEXT
) AS $$
WITH RECURSIVE subordinados AS (
    -- Caso base: subordinados directos
    SELECT
        u.id as subordinado_id,
        1 as nivel,
        CAST(u.id AS TEXT) as path
    FROM usuarios u
    WHERE u.jefe_id = jefe_usuario_id AND u.activo = true

    UNION ALL

    -- Caso recursivo: subordinados de subordinados
    SELECT
        u.id as subordinado_id,
        s.nivel + 1 as nivel,
        s.path || '->' || u.id as path
    FROM usuarios u
    INNER JOIN subordinados s ON u.jefe_id = s.subordinado_id
    WHERE u.activo = true AND s.nivel < 10 -- Limitar recursión
)
SELECT subordinado_id, nivel, path FROM subordinados;
$$ LANGUAGE SQL;

-- 9. Vista para consultas jerárquicas rápidas
CREATE OR REPLACE VIEW vista_jerarquia_usuarios AS
SELECT
    u.id,
    u.nombre,
    u.apellido,
    CONCAT(u.nombre, ' ', u.apellido) as nombre_completo,
    u.rol_id,
    r.nombre as rol_nombre,
    u.vende,
    u.es_jefe,
    u.area_id,
    a.nombre as area_nombre,
    u.jefe_id,
    CONCAT(jefe.nombre, ' ', jefe.apellido) as jefe_nombre,
    u.activo
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
LEFT JOIN areas a ON u.area_id = a.id
LEFT JOIN usuarios jefe ON u.jefe_id = jefe.id
WHERE u.activo = true;

-- 10. Verificar estructura creada
SELECT
    'Usuarios con jerarquía' as tipo,
    COUNT(*) as cantidad
FROM usuarios
WHERE activo = true AND jefe_id IS NOT NULL

UNION ALL

SELECT
    'Usuarios con área asignada' as tipo,
    COUNT(*) as cantidad
FROM usuarios
WHERE activo = true AND area_id IS NOT NULL

UNION ALL

SELECT
    'Usuarios que pueden vender' as tipo,
    COUNT(*) as cantidad
FROM usuarios
WHERE activo = true AND vende = true;

-- 11. Log de migración
INSERT INTO migraciones (
    nombre,
    descripcion,
    fecha_ejecucion,
    version
) VALUES (
    'complete_hierarchy_system',
    'Sistema completo de jerarquía organizacional con áreas y jefes',
    NOW(),
    '2.2.0'
);

-- 12. Comentarios de documentación
COMMENT ON COLUMN usuarios.jefe_id IS 'ID del jefe directo en la jerarquía organizacional';
COMMENT ON COLUMN usuarios.area_id IS 'ID del área/departamento al que pertenece el usuario';
COMMENT ON TABLE areas IS 'Tabla de áreas/departamentos de la empresa';
COMMENT ON FUNCTION obtener_subordinados(INTEGER) IS 'Función recursiva para obtener todos los subordinados de un usuario';

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- ✅ Jerarquía organizacional completa
-- ✅ Relaciones jefe-subordinado definidas
-- ✅ Áreas empresariales estructuradas
-- ✅ Funciones de consulta optimizadas
-- ✅ Vista para queries rápidas
-- ✅ Índices para performance