-- ============================================
-- CONSTRAINT: Un solo seguimiento activo por prospecto
-- ============================================
-- Fecha: 2025-10-27
-- Propósito: Prevenir que un prospecto tenga múltiples seguimientos activos simultáneamente

-- PASO 1: Crear función que valida seguimiento único
CREATE OR REPLACE FUNCTION validar_seguimiento_unico()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo validar si el seguimiento está activo (no completado y visible)
    IF NEW.completado = false AND NEW.visible_para_asesor = true THEN
        -- Verificar si ya existe otro seguimiento activo para este prospecto
        IF EXISTS (
            SELECT 1
            FROM seguimientos
            WHERE prospecto_id = NEW.prospecto_id
              AND id != COALESCE(NEW.id, 0)  -- Excluir el registro actual en UPDATE
              AND completado = false
              AND visible_para_asesor = true
        ) THEN
            RAISE EXCEPTION 'Ya existe un seguimiento activo para este prospecto (prospecto_id: %). Solo puede haber un seguimiento activo por prospecto.', NEW.prospecto_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 2: Crear trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_seguimiento_unico_insert ON seguimientos;
CREATE TRIGGER trigger_seguimiento_unico_insert
    BEFORE INSERT ON seguimientos
    FOR EACH ROW
    EXECUTE FUNCTION validar_seguimiento_unico();

-- PASO 3: Crear trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trigger_seguimiento_unico_update ON seguimientos;
CREATE TRIGGER trigger_seguimiento_unico_update
    BEFORE UPDATE ON seguimientos
    FOR EACH ROW
    WHEN (NEW.completado = false AND NEW.visible_para_asesor = true)
    EXECUTE FUNCTION validar_seguimiento_unico();

-- PASO 4: Crear índice único parcial (solo para seguimientos activos)
-- Esto da una segunda capa de protección a nivel de base de datos
DROP INDEX IF EXISTS idx_seguimiento_activo_unico;
CREATE UNIQUE INDEX idx_seguimiento_activo_unico
ON seguimientos (prospecto_id)
WHERE completado = false AND visible_para_asesor = true;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Comentario para verificar que se creó correctamente
COMMENT ON FUNCTION validar_seguimiento_unico() IS
'Función trigger que previene múltiples seguimientos activos por prospecto';

COMMENT ON INDEX idx_seguimiento_activo_unico IS
'Índice único que garantiza un solo seguimiento activo por prospecto a nivel de base de datos';
