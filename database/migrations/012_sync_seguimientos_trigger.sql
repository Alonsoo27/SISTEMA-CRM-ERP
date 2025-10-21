-- ========================================
-- MIGRACIÓN: Sistema de Sincronización de Seguimientos
-- Fecha: 2025-10-20
-- Objetivo: Mantener sincronizado el campo seguimiento_obligatorio
--           en la tabla prospectos con la tabla seguimientos
-- ========================================

-- ✅ FUNCIÓN DE SINCRONIZACIÓN
-- Esta función se ejecuta automáticamente cuando se crea o actualiza un seguimiento
-- Actualiza los campos relacionados con seguimiento en la tabla prospectos

CREATE OR REPLACE FUNCTION sync_prospecto_seguimiento()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar el prospecto con los datos del seguimiento más reciente
    UPDATE prospectos
    SET
        seguimiento_obligatorio = NEW.fecha_limite,
        seguimiento_completado = NEW.completado,
        seguimiento_vencido = NEW.vencido,
        updated_at = NOW()
    WHERE id = NEW.prospecto_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ TRIGGER DE SINCRONIZACIÓN
-- Se ejecuta DESPUÉS de insertar o actualizar un seguimiento
-- Garantiza que los datos en prospectos siempre estén actualizados

CREATE TRIGGER trigger_sync_seguimiento
AFTER INSERT OR UPDATE ON seguimientos
FOR EACH ROW
EXECUTE FUNCTION sync_prospecto_seguimiento();

-- ========================================
-- SINCRONIZACIÓN INICIAL
-- Actualizar todos los prospectos existentes con su seguimiento más reciente
-- ========================================

UPDATE prospectos p
SET
    seguimiento_obligatorio = s.fecha_limite,
    seguimiento_completado = s.completado,
    seguimiento_vencido = s.vencido,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (prospecto_id)
        prospecto_id,
        fecha_limite,
        completado,
        vencido
    FROM seguimientos
    ORDER BY prospecto_id, created_at DESC
) s
WHERE p.id = s.prospecto_id
  AND p.activo = true;

-- ========================================
-- VERIFICACIÓN
-- ========================================

-- Comentario: Ejecutar después de aplicar la migración para verificar
-- SELECT
--     p.codigo,
--     p.seguimiento_obligatorio as fecha_en_prospecto,
--     (SELECT fecha_limite FROM seguimientos WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as fecha_seguimiento_reciente,
--     CASE
--         WHEN p.seguimiento_obligatorio = (SELECT fecha_limite FROM seguimientos WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1)
--         THEN '✅ SINCRONIZADO'
--         ELSE '❌ DESINCRONIZADO'
--     END as estado_sync
-- FROM prospectos p
-- WHERE activo = true AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
-- LIMIT 20;
