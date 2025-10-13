-- ========================================
-- MIGRACIÓN: Actualizar URLs de notificaciones
-- Fecha: 2025-10-12
-- Descripción: Convertir URLs de formato /prospectos/123 a /prospectos?id=123&action=view
-- ========================================

-- 1. Actualizar notificaciones de prospectos con ID específico
UPDATE notificaciones
SET accion_url = CONCAT('/prospectos?id=', prospecto_id, '&action=view')
WHERE prospecto_id IS NOT NULL
  AND accion_url ~ '^/prospectos/[0-9]+$';

-- 2. Actualizar notificaciones de ventas con ID específico (si existen en datos_adicionales)
UPDATE notificaciones
SET accion_url = CONCAT('/ventas?id=', (datos_adicionales::json->>'venta_id')::integer, '&action=view')
WHERE datos_adicionales IS NOT NULL
  AND datos_adicionales::json->>'venta_id' IS NOT NULL
  AND accion_url ~ '^/ventas/[0-9]+$';

-- 3. Verificar resultados
SELECT
    id,
    tipo,
    titulo,
    accion_url,
    prospecto_id,
    created_at
FROM notificaciones
WHERE usuario_id = 1
ORDER BY created_at DESC
LIMIT 10;

-- 4. Mostrar estadísticas de la migración
SELECT
    tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN accion_url LIKE '%?id=%' THEN 1 END) as con_query_params,
    COUNT(CASE WHEN accion_url ~ '^/(prospectos|ventas)/[0-9]+$' THEN 1 END) as formato_antiguo
FROM notificaciones
GROUP BY tipo
ORDER BY total DESC;
