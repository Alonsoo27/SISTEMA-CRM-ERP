-- ==========================================
-- OPTIMIZACIONES BD PARA DESPACHOS
-- ==========================================

-- 1. VISTA: Despachos completos con datos enriquecidos
CREATE OR REPLACE VIEW vista_despachos_completos AS
SELECT
    d.id as despacho_id,
    d.codigo as despacho_codigo,
    d.estado,
    d.fecha_programada,
    d.fecha_preparacion,
    d.fecha_envio,
    d.fecha_entrega,
    d.observaciones_preparacion,
    d.observaciones_envio,

    -- Datos de venta
    v.id as venta_id,
    v.codigo as venta_codigo,
    v.valor_final as venta_total,
    v.nombre_cliente,
    v.apellido_cliente,
    v.cliente_telefono,
    v.ciudad,
    v.departamento,
    v.distrito,

    -- Cliente completo (si existe relación)
    CASE
        WHEN c.id IS NOT NULL THEN
            CASE
                WHEN c.tipo_cliente = 'PERSONA' THEN CONCAT(c.nombres, ' ', c.apellidos)
                ELSE c.razon_social
            END
        ELSE CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, ''))
    END as cliente_completo,

    c.direccion as cliente_direccion,
    c.telefono as cliente_telefono_principal,
    c.email as cliente_email,

    -- Datos de almacén
    a.codigo as almacen_codigo,
    a.nombre as almacen_nombre,
    a.direccion as almacen_direccion,

    -- Usuarios
    up.nombre as preparado_por_nombre,
    ue.nombre as enviado_por_nombre,

    -- Métricas de tiempo
    CASE
        WHEN d.fecha_preparacion IS NOT NULL
        THEN EXTRACT(EPOCH FROM (d.fecha_preparacion - d.created_at))/3600
    END as horas_hasta_preparacion,

    CASE
        WHEN d.fecha_envio IS NOT NULL
        THEN EXTRACT(EPOCH FROM (d.fecha_envio - d.fecha_preparacion))/3600
    END as horas_preparacion_a_envio,

    CASE
        WHEN d.fecha_entrega IS NOT NULL
        THEN EXTRACT(EPOCH FROM (d.fecha_entrega - d.fecha_envio))/3600
    END as horas_envio_a_entrega,

    -- Productos resumen
    (SELECT COUNT(*) FROM venta_detalles vd WHERE vd.venta_id = v.id) as total_productos,
    (SELECT SUM(vd.cantidad) FROM venta_detalles vd WHERE vd.venta_id = v.id) as total_cantidad,

    d.created_at,
    d.updated_at
FROM despachos d
JOIN ventas v ON d.venta_id = v.id
LEFT JOIN clientes c ON v.cliente_id = c.id
JOIN almacenes a ON d.almacen_id = a.id
LEFT JOIN usuarios up ON d.preparado_por = up.id
LEFT JOIN usuarios ue ON d.enviado_por = ue.id
WHERE d.activo = true;

-- ==========================================

-- 2. VISTA: Dashboard de métricas en tiempo real
CREATE OR REPLACE VIEW vista_despachos_dashboard AS
WITH metricas_tiempo AS (
    SELECT
        estado,
        COUNT(*) as cantidad,
        AVG(
            CASE
                WHEN fecha_preparacion IS NOT NULL
                THEN EXTRACT(EPOCH FROM (fecha_preparacion - created_at))/3600
            END
        ) as promedio_horas_preparacion,
        AVG(
            CASE
                WHEN fecha_entrega IS NOT NULL AND fecha_envio IS NOT NULL
                THEN EXTRACT(EPOCH FROM (fecha_entrega - fecha_envio))/3600
            END
        ) as promedio_horas_entrega
    FROM despachos
    WHERE activo = true
    GROUP BY estado
)
SELECT
    -- Conteos por estado
    SUM(CASE WHEN estado = 'PENDIENTE' THEN cantidad ELSE 0 END) as pendientes,
    SUM(CASE WHEN estado = 'PREPARANDO' THEN cantidad ELSE 0 END) as preparando,
    SUM(CASE WHEN estado = 'LISTO' THEN cantidad ELSE 0 END) as listos,
    SUM(CASE WHEN estado = 'ENVIADO' THEN cantidad ELSE 0 END) as enviados,
    SUM(CASE WHEN estado = 'ENTREGADO' THEN cantidad ELSE 0 END) as entregados,
    SUM(CASE WHEN estado = 'CANCELADO' THEN cantidad ELSE 0 END) as cancelados,

    -- Métricas de rendimiento
    ROUND(AVG(promedio_horas_preparacion), 2) as tiempo_promedio_preparacion,
    ROUND(AVG(promedio_horas_entrega), 2) as tiempo_promedio_entrega,

    -- Eficiencia
    ROUND(
        (SUM(CASE WHEN estado = 'ENTREGADO' THEN cantidad ELSE 0 END) * 100.0 /
         NULLIF(SUM(cantidad), 0)), 2
    ) as porcentaje_entregados
FROM metricas_tiempo;

-- ==========================================

-- 3. VISTA: Despachos críticos (necesitan atención)
CREATE OR REPLACE VIEW vista_despachos_criticos AS
SELECT
    d.id,
    d.codigo,
    d.estado,
    d.fecha_programada,
    v.codigo as venta_codigo,
    v.nombre_cliente,
    a.nombre as almacen_nombre,

    -- Razón de criticidad
    CASE
        WHEN d.estado = 'PENDIENTE' AND d.fecha_programada < CURRENT_DATE
            THEN 'VENCIDO'
        WHEN d.estado = 'PENDIENTE' AND d.fecha_programada = CURRENT_DATE
            THEN 'VENCE_HOY'
        WHEN d.estado = 'PREPARANDO' AND d.fecha_preparacion < (NOW() - INTERVAL '4 hours')
            THEN 'PREPARACION_LENTA'
        WHEN d.estado = 'ENVIADO' AND d.fecha_envio < (NOW() - INTERVAL '24 hours')
            THEN 'ENVIO_LENTO'
        ELSE 'NORMAL'
    END as criticidad,

    -- Días de retraso
    CASE
        WHEN d.fecha_programada < CURRENT_DATE
        THEN CURRENT_DATE - d.fecha_programada
        ELSE 0
    END as dias_retraso

FROM despachos d
JOIN ventas v ON d.venta_id = v.id
JOIN almacenes a ON d.almacen_id = a.id
WHERE d.activo = true
AND d.estado NOT IN ('ENTREGADO', 'CANCELADO')
AND (
    d.fecha_programada <= CURRENT_DATE + INTERVAL '1 day' OR
    (d.estado = 'PREPARANDO' AND d.fecha_preparacion < (NOW() - INTERVAL '4 hours')) OR
    (d.estado = 'ENVIADO' AND d.fecha_envio < (NOW() - INTERVAL '24 hours'))
)
ORDER BY
    CASE criticidad
        WHEN 'VENCIDO' THEN 1
        WHEN 'VENCE_HOY' THEN 2
        WHEN 'PREPARACION_LENTA' THEN 3
        WHEN 'ENVIO_LENTO' THEN 4
        ELSE 5
    END,
    d.fecha_programada ASC;

-- ==========================================

-- 4. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_despachos_estado_fecha
    ON despachos(estado, fecha_programada) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_despachos_venta_almacen
    ON despachos(venta_id, almacen_id) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_despachos_fechas_timeline
    ON despachos(fecha_preparacion, fecha_envio, fecha_entrega) WHERE activo = true;

-- ==========================================

-- 5. FUNCIÓN PARA TRANSICIONES DE ESTADO VÁLIDAS
CREATE OR REPLACE FUNCTION validar_transicion_estado_despacho(
    estado_actual VARCHAR,
    estado_nuevo VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    -- Definir transiciones válidas
    RETURN CASE
        WHEN estado_actual = 'PENDIENTE' AND estado_nuevo IN ('PREPARANDO', 'CANCELADO') THEN TRUE
        WHEN estado_actual = 'PREPARANDO' AND estado_nuevo IN ('LISTO', 'CANCELADO') THEN TRUE
        WHEN estado_actual = 'LISTO' AND estado_nuevo IN ('ENVIADO', 'CANCELADO') THEN TRUE
        WHEN estado_actual = 'ENVIADO' AND estado_nuevo IN ('ENTREGADO', 'CANCELADO') THEN TRUE
        WHEN estado_actual = 'ENTREGADO' THEN FALSE -- No se puede cambiar
        WHEN estado_actual = 'CANCELADO' THEN FALSE -- No se puede cambiar
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql;

-- ==========================================

-- 6. TRIGGER PARA ACTUALIZAR TIMESTAMPS AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION actualizar_timestamps_despacho()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar timestamps según el estado
    IF NEW.estado = 'PREPARANDO' AND OLD.estado != 'PREPARANDO' THEN
        NEW.fecha_preparacion = NOW();
    END IF;

    IF NEW.estado = 'ENVIADO' AND OLD.estado != 'ENVIADO' THEN
        NEW.fecha_envio = NOW();
    END IF;

    IF NEW.estado = 'ENTREGADO' AND OLD.estado != 'ENTREGADO' THEN
        NEW.fecha_entrega = NOW();
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_actualizar_timestamps_despacho ON despachos;
CREATE TRIGGER trigger_actualizar_timestamps_despacho
    BEFORE UPDATE ON despachos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamps_despacho();