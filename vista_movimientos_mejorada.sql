-- Vista mejorada de movimientos con integración de ventas
-- Ejecutar este script para mejorar la visualización de movimientos

CREATE OR REPLACE VIEW vista_movimientos_enriquecidos AS
SELECT
    m.id,
    m.producto_id,
    m.almacen_origen_id,
    m.almacen_destino_id,
    m.tipo_movimiento,
    m.cantidad,
    m.precio_unitario,
    m.stock_anterior,
    m.stock_posterior,
    m.motivo,
    m.fecha_movimiento,
    m.usuario_id,
    m.referencia_tipo,
    m.referencia_id,

    -- Información del producto
    p.codigo as producto_codigo,
    p.descripcion as producto_descripcion,
    p.marca as producto_marca,
    p.unidad_medida,

    -- Información de almacenes
    ao.codigo as almacen_origen_codigo,
    ao.nombre as almacen_origen_nombre,
    ao.tipo as almacen_origen_tipo,

    ad.codigo as almacen_destino_codigo,
    ad.nombre as almacen_destino_nombre,
    ad.tipo as almacen_destino_tipo,

    -- Usuario que hizo el movimiento
    u.nombre as usuario_nombre,
    u.email as usuario_email,

    -- INTEGRACIÓN CON VENTAS - Información enriquecida
    CASE
        WHEN m.referencia_tipo = 'VENTA' AND v.id IS NOT NULL THEN
            CONCAT(
                'Venta #', v.codigo,
                ' → Cliente: ',
                COALESCE(v.nombre_cliente, ''), ' ',
                COALESCE(v.apellido_cliente, ''),
                CASE WHEN c.numero_documento IS NOT NULL
                     THEN CONCAT(' (', c.tipo_documento, ': ', c.numero_documento, ')')
                     ELSE ''
                END
            )
        WHEN m.referencia_tipo = 'UPLOAD' THEN
            CONCAT('📁 ', m.motivo)
        WHEN m.tipo_movimiento = 'INICIAL' THEN
            CONCAT('🔄 Carga inicial: ', p.descripcion)
        ELSE m.motivo
    END as motivo_enriquecido,

    -- Datos específicos de venta (para filtros y reportes)
    v.codigo as venta_codigo,
    v.nombre_cliente,
    v.apellido_cliente,
    v.valor_final as venta_total,
    v.fecha_venta,
    c.numero_documento as cliente_documento,
    c.tipo_documento as cliente_tipo_doc,
    COALESCE(c.nombres, '') || ' ' || COALESCE(c.apellidos, '') as cliente_completo,

    -- Cálculos adicionales
    (m.cantidad * COALESCE(m.precio_unitario, 0)) as valor_movimiento,

    -- Clasificación temporal para análisis
    EXTRACT(YEAR FROM m.fecha_movimiento) as año,
    EXTRACT(MONTH FROM m.fecha_movimiento) as mes,
    EXTRACT(DAY FROM m.fecha_movimiento) as dia,
    EXTRACT(HOUR FROM m.fecha_movimiento) as hora,

    -- Estado del movimiento mejorado
    CASE
        WHEN m.tipo_movimiento = 'ENTRADA' THEN 'success'
        WHEN m.tipo_movimiento = 'SALIDA' THEN 'danger'
        WHEN m.tipo_movimiento = 'TRANSFERENCIA' THEN 'info'
        WHEN m.tipo_movimiento LIKE 'AJUSTE%' THEN 'warning'
        WHEN m.tipo_movimiento = 'INICIAL' THEN 'secondary'
        ELSE 'light'
    END as estado_color

FROM movimientos_inventario m
LEFT JOIN productos p ON m.producto_id = p.id
LEFT JOIN almacenes ao ON m.almacen_origen_id = ao.id
LEFT JOIN almacenes ad ON m.almacen_destino_id = ad.id
LEFT JOIN usuarios u ON m.usuario_id = u.id
-- VINCULACIÓN CON VENTAS
LEFT JOIN ventas v ON m.referencia_tipo = 'VENTA' AND m.referencia_id = v.codigo
LEFT JOIN clientes c ON v.cliente_id = c.id;

-- Índice para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_movimientos_enriquecidos_fecha_tipo
ON movimientos_inventario(fecha_movimiento DESC, tipo_movimiento, referencia_tipo);

-- Comentario de documentación
COMMENT ON VIEW vista_movimientos_enriquecidos IS
'Vista optimizada de movimientos con información de ventas, clientes y almacenes integrada';