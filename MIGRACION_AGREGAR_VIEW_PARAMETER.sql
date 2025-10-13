-- ========================================
-- MIGRACIÓN: Agregar parámetro VIEW a URLs de notificaciones
-- Fecha: 2025-10-12
-- Descripción: Agregar view parameter para navegación contextual
-- Convierte: /prospectos?id=123&action=view -> /prospectos?view=kanban&id=123&action=view
-- ========================================

-- 1. SEGUIMIENTOS - Vista "seguimientos" (Balanza)
UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=seguimientos&id=')
WHERE tipo IN (
    'seguimiento_vencido',
    'seguimiento_urgente',
    'seguimiento_critico',
    'seguimiento_proximo'
)
AND accion_url LIKE '/prospectos?id=%'
AND accion_url NOT LIKE '%view=seguimientos%';

-- Caso especial: seguimiento_completado va a kanban
UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=kanban&id=')
WHERE tipo = 'seguimiento_completado'
AND accion_url LIKE '/prospectos?id=%'
AND accion_url NOT LIKE '%view=kanban%';

-- 2. PROSPECTOS - Vista "kanban" (Pipeline)
UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=kanban&id=')
WHERE tipo IN (
    'prospecto_creado',
    'prospecto_reasignado',
    'prospecto_libre_activado',
    'estado_cotizado',
    'estado_negociacion',
    'oportunidad_alta'
)
AND accion_url LIKE '/prospectos?id=%'
AND accion_url NOT LIKE '%view=kanban%';

-- 3. PROSPECTOS - Vista "lista"
UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/prospectos?id=', '/prospectos?view=lista&id=')
WHERE tipo IN (
    'venta_perdida',
    'alerta_reasignaciones'
)
AND accion_url LIKE '/prospectos?id=%'
AND accion_url NOT LIKE '%view=lista%';

-- 4. VENTAS - Vista "lista"
UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/ventas?id=', '/ventas?view=lista&id=')
WHERE tipo IN (
    'venta_cerrada',
    'conversion_exitosa'
)
AND accion_url LIKE '/ventas?id=%'
AND accion_url NOT LIKE '%view=lista%';

-- 5. URLs sin ID específico - agregar view por defecto
UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/prospectos?', '/prospectos?view=kanban&')
WHERE (tipo IN ('prospecto_creado', 'prospecto_reasignado', 'sistema') OR tipo IS NULL)
AND accion_url = '/prospectos'
AND accion_url NOT LIKE '%view=%';

UPDATE notificaciones
SET accion_url = REPLACE(accion_url, '/ventas?', '/ventas?view=lista&')
WHERE tipo IN ('venta_cerrada', 'conversion_exitosa')
AND accion_url = '/ventas'
AND accion_url NOT LIKE '%view=%';

-- 6. VERIFICAR RESULTADOS
SELECT
    id,
    tipo,
    titulo,
    accion_url,
    prospecto_id,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM notificaciones
WHERE usuario_id = 1
ORDER BY created_at DESC
LIMIT 10;

-- 7. ESTADÍSTICAS DETALLADAS
SELECT
    tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN accion_url LIKE '%view=kanban%' THEN 1 END) as vista_kanban,
    COUNT(CASE WHEN accion_url LIKE '%view=seguimientos%' THEN 1 END) as vista_seguimientos,
    COUNT(CASE WHEN accion_url LIKE '%view=lista%' THEN 1 END) as vista_lista,
    COUNT(CASE WHEN accion_url LIKE '%view=%' THEN 1 END) as total_con_view,
    COUNT(CASE WHEN accion_url NOT LIKE '%view=%' THEN 1 END) as sin_view
FROM notificaciones
GROUP BY tipo
ORDER BY total DESC;

-- 8. VERIFICAR QUE NO HAYA URLs SIN VIEW PARAMETER (debería retornar 0 o solo URLs externas/especiales)
SELECT COUNT(*) as notificaciones_sin_view
FROM notificaciones
WHERE accion_url LIKE '/prospectos%'
   OR accion_url LIKE '/ventas%'
AND accion_url NOT LIKE '%view=%';
