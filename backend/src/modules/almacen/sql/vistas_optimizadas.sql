-- ==================== VISTAS OPTIMIZADAS PARA ANÁLISIS DE INVENTARIO ====================
-- Estas vistas mejoran el performance de los análisis al precomputar datos complejos

-- ==================== VISTA 1: RESUMEN BASE DE INVENTARIO (INTELIGENTE) ====================
CREATE OR REPLACE VIEW vista_resumen_inventario AS
SELECT
    p.id as producto_id,
    p.codigo as producto_codigo,
    p.descripcion as producto_descripcion,
    p.marca,
    c.nombre as categoria,

    a.id as almacen_id,
    a.codigo as almacen_codigo,
    a.nombre as almacen_nombre,
    a.tipo as almacen_tipo,

    COALESCE(i.stock_actual, 0) as stock_actual,
    COALESCE(i.stock_minimo, 0) as stock_minimo,
    COALESCE(i.stock_maximo, 0) as stock_maximo,
    COALESCE(i.costo_promedio, 0) as costo_promedio,

    -- Estados precomputados más inteligentes
    CASE
        WHEN i.id IS NULL THEN 'SIN_INVENTARIO'  -- Nuevo estado para productos sin inventario
        WHEN COALESCE(i.stock_actual, 0) <= 0 THEN 'AGOTADO'
        WHEN COALESCE(i.stock_actual, 0) <= COALESCE(i.stock_minimo, 0) AND i.stock_minimo > 0 THEN 'CRITICO'
        WHEN COALESCE(i.stock_actual, 0) <= (COALESCE(i.stock_minimo, 0) * 1.5) AND i.stock_minimo > 0 THEN 'BAJO'
        WHEN i.id IS NOT NULL THEN 'NORMAL'
        ELSE 'SIN_INVENTARIO'
    END as estado_stock,

    -- Valorización precomputada
    (COALESCE(i.stock_actual, 0) * COALESCE(i.costo_promedio, 0)) as valor_inventario,

    i.ultimo_movimiento,
    COALESCE(i.activo, false) as inventario_activo

FROM productos p
CROSS JOIN almacenes a
LEFT JOIN inventario i ON p.id = i.producto_id AND a.id = i.almacen_id
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.activo = true AND a.activo = true;

-- ==================== VISTA 2: MOVIMIENTOS ENRIQUECIDOS ====================
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

    -- Información de producto
    p.codigo as producto_codigo,
    p.descripcion as producto_descripcion,
    p.marca as producto_marca,

    -- Información de almacenes
    ao.codigo as almacen_origen_codigo,
    ao.nombre as almacen_origen_nombre,
    ao.tipo as almacen_origen_tipo,

    ad.codigo as almacen_destino_codigo,
    ad.nombre as almacen_destino_nombre,
    ad.tipo as almacen_destino_tipo,

    -- Usuario que hizo el movimiento
    u.nombre as usuario_nombre,

    -- Cálculos adicionales
    (m.cantidad * m.precio_unitario) as valor_movimiento,

    -- Clasificación temporal
    EXTRACT(YEAR FROM m.fecha_movimiento) as año,
    EXTRACT(MONTH FROM m.fecha_movimiento) as mes,
    EXTRACT(WEEK FROM m.fecha_movimiento) as semana,
    EXTRACT(DOW FROM m.fecha_movimiento) as dia_semana,
    EXTRACT(HOUR FROM m.fecha_movimiento) as hora

FROM movimientos_inventario m
LEFT JOIN productos p ON m.producto_id = p.id
LEFT JOIN almacenes ao ON m.almacen_origen_id = ao.id
LEFT JOIN almacenes ad ON m.almacen_destino_id = ad.id
LEFT JOIN usuarios u ON m.usuario_id = u.id;

-- ==================== VISTA 3: MÉTRICAS POR ALMACÉN ====================
CREATE OR REPLACE VIEW vista_metricas_almacen AS
SELECT
    a.id as almacen_id,
    a.codigo as almacen_codigo,
    a.nombre as almacen_nombre,
    a.tipo as almacen_tipo,
    a.piso,

    -- Conteos de inventario
    COUNT(DISTINCT CASE WHEN i.stock_actual > 0 THEN i.producto_id END) as productos_con_stock,
    COUNT(DISTINCT i.producto_id) as total_productos,

    -- Estados de stock
    COUNT(CASE WHEN i.stock_actual <= 0 THEN 1 END) as productos_agotados,
    COUNT(CASE WHEN i.stock_actual > 0 AND i.stock_actual <= i.stock_minimo THEN 1 END) as productos_criticos,
    COUNT(CASE WHEN i.stock_actual > i.stock_minimo THEN 1 END) as productos_normales,

    -- Valorización
    COALESCE(SUM(i.stock_actual * i.costo_promedio), 0) as valor_total_inventario,
    COALESCE(AVG(i.stock_actual * i.costo_promedio), 0) as valor_promedio_producto,

    -- Estadísticas de stock
    COALESCE(SUM(i.stock_actual), 0) as stock_total_unidades,
    COALESCE(AVG(i.stock_actual), 0) as stock_promedio,
    COALESCE(MAX(i.stock_actual), 0) as stock_maximo,

    -- Última actividad
    MAX(i.ultimo_movimiento) as ultimo_movimiento_almacen

FROM almacenes a
LEFT JOIN inventario i ON a.id = i.almacen_id AND i.activo = true
WHERE a.activo = true
GROUP BY a.id, a.codigo, a.nombre, a.tipo, a.piso;

-- ==================== VISTA 4: ACTIVIDAD POR PERÍODO ====================
CREATE OR REPLACE VIEW vista_actividad_periodo AS
SELECT
    DATE_TRUNC('day', m.fecha_movimiento) as fecha,
    DATE_TRUNC('week', m.fecha_movimiento) as semana,
    DATE_TRUNC('month', m.fecha_movimiento) as mes,

    -- Almacén (tanto origen como destino cuentan como actividad)
    COALESCE(m.almacen_origen_id, m.almacen_destino_id) as almacen_id,
    COALESCE(ao.codigo, ad.codigo) as almacen_codigo,
    COALESCE(ao.nombre, ad.nombre) as almacen_nombre,

    -- Métricas de actividad
    COUNT(*) as total_movimientos,
    COUNT(DISTINCT m.producto_id) as productos_movidos,
    COUNT(DISTINCT m.usuario_id) as usuarios_activos,

    SUM(m.cantidad) as cantidad_total_movida,
    SUM(m.cantidad * m.precio_unitario) as valor_total_movido,

    -- Tipos de movimiento
    COUNT(CASE WHEN m.tipo_movimiento = 'ENTRADA' THEN 1 END) as entradas,
    COUNT(CASE WHEN m.tipo_movimiento = 'SALIDA' THEN 1 END) as salidas,
    COUNT(CASE WHEN m.tipo_movimiento = 'TRANSFERENCIA' THEN 1 END) as transferencias,
    COUNT(CASE WHEN m.tipo_movimiento LIKE 'AJUSTE%' THEN 1 END) as ajustes,

    -- Horas pico (para análisis de eficiencia) - Compatible con más versiones de PostgreSQL
    (SELECT EXTRACT(HOUR FROM m.fecha_movimiento)
     FROM vista_movimientos_enriquecidos m2
     WHERE DATE_TRUNC('day', m2.fecha_movimiento) = DATE_TRUNC('day', m.fecha_movimiento)
     GROUP BY EXTRACT(HOUR FROM m2.fecha_movimiento)
     ORDER BY COUNT(*) DESC
     LIMIT 1) as hora_pico

FROM vista_movimientos_enriquecidos m
LEFT JOIN almacenes ao ON m.almacen_origen_id = ao.id
LEFT JOIN almacenes ad ON m.almacen_destino_id = ad.id
GROUP BY
    DATE_TRUNC('day', m.fecha_movimiento),
    DATE_TRUNC('week', m.fecha_movimiento),
    DATE_TRUNC('month', m.fecha_movimiento),
    COALESCE(m.almacen_origen_id, m.almacen_destino_id),
    COALESCE(ao.codigo, ad.codigo),
    COALESCE(ao.nombre, ad.nombre);

-- ==================== VISTA 5: ROTACIÓN PRECOMPUTADA ====================
CREATE OR REPLACE VIEW vista_rotacion_almacenes AS
WITH movimientos_periodo AS (
    SELECT
        almacen_codigo,
        almacen_nombre,
        COUNT(*) as total_movimientos,
        SUM(cantidad) as cantidad_total,
        COUNT(DISTINCT fecha) as dias_activos,
        AVG(total_movimientos) as movimientos_promedio_dia
    FROM vista_actividad_periodo
    WHERE fecha >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY almacen_codigo, almacen_nombre
)
SELECT
    mp.*,
    vm.valor_total_inventario,
    vm.productos_con_stock,

    -- Cálculo de rotación
    CASE
        WHEN vm.valor_total_inventario > 0 THEN
            (mp.cantidad_total * 30) / vm.valor_total_inventario
        ELSE 0
    END as rotacion_mensual,

    CASE
        WHEN mp.dias_activos > 0 THEN mp.total_movimientos::float / mp.dias_activos
        ELSE 0
    END as rotacion_diaria,

    -- Clasificación de velocidad
    CASE
        WHEN mp.total_movimientos >= 100 THEN 'Muy Alta'
        WHEN mp.total_movimientos >= 50 THEN 'Alta'
        WHEN mp.total_movimientos >= 20 THEN 'Media'
        WHEN mp.total_movimientos >= 5 THEN 'Baja'
        ELSE 'Muy Baja'
    END as velocidad_rotacion

FROM movimientos_periodo mp
LEFT JOIN vista_metricas_almacen vm ON mp.almacen_codigo = vm.almacen_codigo;

-- ==================== ÍNDICES PARA OPTIMIZACIÓN ====================
-- Índices en campos utilizados frecuentemente en las vistas

-- Para vista_actividad_periodo
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha_almacen
ON movimientos_inventario(fecha_movimiento, almacen_origen_id, almacen_destino_id);

-- Para búsquedas por período
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha_tipo
ON movimientos_inventario(fecha_movimiento, tipo_movimiento);

-- Para análisis de productos
CREATE INDEX IF NOT EXISTS idx_inventario_estado_stock
ON inventario(stock_actual, stock_minimo, activo);

-- Para análisis de valorización
CREATE INDEX IF NOT EXISTS idx_inventario_valorizacion
ON inventario(stock_actual, costo_promedio) WHERE activo = true;

-- ==================== COMENTARIOS DE DOCUMENTACIÓN ====================
COMMENT ON VIEW vista_resumen_inventario IS 'Vista optimizada con stock y valorización precomputados para análisis rápidos';
COMMENT ON VIEW vista_movimientos_enriquecidos IS 'Movimientos con información completa de productos, almacenes y usuarios';
COMMENT ON VIEW vista_metricas_almacen IS 'Métricas agregadas por almacén: stock, valorización y estadísticas';
COMMENT ON VIEW vista_actividad_periodo IS 'Actividad agregada por día/semana/mes para análisis de tendencias';
COMMENT ON VIEW vista_rotacion_almacenes IS 'Cálculos de rotación precomputados para análisis de performance';