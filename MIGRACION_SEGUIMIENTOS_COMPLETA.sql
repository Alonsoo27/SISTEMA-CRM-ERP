-- =====================================================
-- MIGRACIÓN COMPLETA: Sistema de Seguimientos Avanzado
-- =====================================================
-- Este script agrega todas las columnas necesarias para el
-- nuevo sistema de seguimientos con reprogramación múltiple

BEGIN;

-- =====================================================
-- PASO 1: AGREGAR COLUMNAS FALTANTES EN SEGUIMIENTOS
-- =====================================================

-- Columnas para completar seguimientos
ALTER TABLE seguimientos
ADD COLUMN IF NOT EXISTS notas TEXT,
ADD COLUMN IF NOT EXISTS calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS completado_por INTEGER REFERENCES usuarios(id);

-- Columnas para gestión de seguimientos
ALTER TABLE seguimientos
ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Columnas de timestamps si no existen
ALTER TABLE seguimientos
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- PASO 2: CREAR ÍNDICES PARA MEJORAR PERFORMANCE
-- =====================================================

-- Índice para búsquedas por asesor y estado
CREATE INDEX IF NOT EXISTS idx_seguimientos_asesor_completado
ON seguimientos(asesor_id, completado);

-- Índice para búsquedas por prospecto
CREATE INDEX IF NOT EXISTS idx_seguimientos_prospecto
ON seguimientos(prospecto_id);

-- Índice para búsquedas por fecha límite (vencimientos)
CREATE INDEX IF NOT EXISTS idx_seguimientos_fecha_limite
ON seguimientos(fecha_limite) WHERE completado = false;

-- Índice para búsquedas de seguimientos visibles
CREATE INDEX IF NOT EXISTS idx_seguimientos_visible
ON seguimientos(visible_para_asesor, completado);

-- =====================================================
-- PASO 3: ACTUALIZAR DATOS EXISTENTES (SI HAY)
-- =====================================================

-- Asignar valores por defecto a registros existentes
UPDATE seguimientos
SET descripcion = COALESCE(descripcion, 'Seguimiento ' || tipo)
WHERE descripcion IS NULL;

UPDATE seguimientos
SET notas = COALESCE(notas, '')
WHERE completado = true AND notas IS NULL;

-- =====================================================
-- PASO 4: CREAR TRIGGER PARA UPDATED_AT AUTOMÁTICO
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para seguimientos
DROP TRIGGER IF EXISTS update_seguimientos_updated_at ON seguimientos;
CREATE TRIGGER update_seguimientos_updated_at
    BEFORE UPDATE ON seguimientos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PASO 5: AGREGAR COMENTARIOS DESCRIPTIVOS
-- =====================================================

COMMENT ON COLUMN seguimientos.notas IS 'Notas detalladas al completar el seguimiento';
COMMENT ON COLUMN seguimientos.calificacion IS 'Calificación del resultado (1-5)';
COMMENT ON COLUMN seguimientos.completado_por IS 'ID del usuario que completó el seguimiento';
COMMENT ON COLUMN seguimientos.descripcion IS 'Descripción o recordatorio del seguimiento';

-- =====================================================
-- PASO 6: VERIFICACIÓN FINAL
-- =====================================================

-- Mostrar estructura actualizada de la tabla
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'seguimientos'
ORDER BY ordinal_position;

COMMIT;

-- =====================================================
-- MENSAJE FINAL
-- =====================================================
SELECT
    '✅ Migración completada exitosamente' as status,
    'Tabla seguimientos actualizada con todas las columnas necesarias' as mensaje;

-- =====================================================
-- ROLLBACK (en caso de error - comentado por seguridad)
-- =====================================================
-- Si algo sale mal, puedes ejecutar:
-- ROLLBACK;
