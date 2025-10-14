-- ============================================
-- MIGRACIÓN: Sistema de Prospectos Compartidos
-- Fecha: 2025-10-13
-- Descripción: Índices para validación de duplicados multinivel
-- ============================================

-- 1. ÍNDICE COMPUESTO para validaciones rápidas de duplicados
-- Optimiza búsquedas: telefono + activo + estado
CREATE INDEX IF NOT EXISTS idx_prospectos_telefono_estado_validacion
ON prospectos(telefono, activo, estado)
WHERE activo = true;

-- 2. ÍNDICE para comparación de productos en conflicto
-- Optimiza: buscar productos específicos por prospecto
CREATE INDEX IF NOT EXISTS idx_prospecto_productos_lookup
ON prospecto_productos_interes(prospecto_id, codigo_producto)
WHERE codigo_producto IS NOT NULL;

-- 3. ÍNDICE para notificaciones de prospectos compartidos
-- Optimiza: buscar notificaciones por prospecto
CREATE INDEX IF NOT EXISTS idx_notificaciones_prospecto_tipo
ON notificaciones(prospecto_id, tipo, usuario_id)
WHERE prospecto_id IS NOT NULL AND activo = true;

-- 4. ÍNDICE para búsquedas de asesores originales
-- Optimiza: ver todos los prospectos que un asesor registró originalmente
CREATE INDEX IF NOT EXISTS idx_prospectos_asesor_original
ON prospectos(asesor_original_id, estado, activo)
WHERE asesor_original_id IS NOT NULL AND activo = true;

-- ============================================
-- VERIFICACIÓN DE ÍNDICES
-- ============================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('prospectos', 'prospecto_productos_interes', 'notificaciones')
    AND indexname LIKE '%telefono%' OR indexname LIKE '%producto%' OR indexname LIKE '%prospecto%'
ORDER BY tablename, indexname;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON INDEX idx_prospectos_telefono_estado_validacion IS
'Optimiza validación de duplicados con estado para sistema de prospectos compartidos';

COMMENT ON INDEX idx_prospecto_productos_lookup IS
'Optimiza comparación de productos en conflicto entre asesores';

COMMENT ON INDEX idx_notificaciones_prospecto_tipo IS
'Optimiza búsqueda de notificaciones de prospectos compartidos';

COMMENT ON INDEX idx_prospectos_asesor_original IS
'Optimiza tracking de asesores que registraron originalmente prospectos';
