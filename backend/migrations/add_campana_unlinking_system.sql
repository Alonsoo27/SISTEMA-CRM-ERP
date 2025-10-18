-- ============================================
-- SISTEMA DE DESVINCULACIÓN DE CAMPAÑAS EN TRASPASOS
-- ============================================
-- Fecha: 2025-10-17
-- Descripción: Crea tabla de historial de campañas y agrega campos
--              necesarios para rastrear asignaciones y desvinculaciones

-- ============================================
-- 1. CREAR TABLA DE HISTORIAL DE CAMPAÑAS
-- ============================================
CREATE TABLE IF NOT EXISTS prospecto_campanas_historial (
    id SERIAL PRIMARY KEY,
    prospecto_id INTEGER NOT NULL REFERENCES prospectos(id) ON DELETE CASCADE,
    prospecto_codigo VARCHAR(50),
    campana_id INTEGER NOT NULL REFERENCES campanas_asesor(id) ON DELETE SET NULL,
    asesor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    asesor_nombre VARCHAR(255),

    -- Datos de la línea/producto detectado
    campana_linea_detectada VARCHAR(100),
    campana_valor_producto DECIMAL(10,2),

    -- Fechas de vinculación y desvinculación
    fecha_vinculacion TIMESTAMP DEFAULT NOW(),
    fecha_desvinculacion TIMESTAMP,

    -- Motivo de desvinculación
    motivo_desvinculacion VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_prosp_camp_hist_prospecto ON prospecto_campanas_historial(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_prosp_camp_hist_campana ON prospecto_campanas_historial(campana_id);
CREATE INDEX IF NOT EXISTS idx_prosp_camp_hist_asesor ON prospecto_campanas_historial(asesor_id);
CREATE INDEX IF NOT EXISTS idx_prosp_camp_hist_fecha_vinc ON prospecto_campanas_historial(fecha_vinculacion);
CREATE INDEX IF NOT EXISTS idx_prosp_camp_hist_fecha_desv ON prospecto_campanas_historial(fecha_desvinculacion);

-- Comentarios de documentación
COMMENT ON TABLE prospecto_campanas_historial IS 'Historial completo de asignaciones y desvinculaciones de campañas para prospectos';
COMMENT ON COLUMN prospecto_campanas_historial.fecha_vinculacion IS 'Fecha cuando el prospecto fue asignado a la campaña';
COMMENT ON COLUMN prospecto_campanas_historial.fecha_desvinculacion IS 'Fecha cuando el prospecto fue desvinculado de la campaña (NULL si aún está vinculado)';
COMMENT ON COLUMN prospecto_campanas_historial.motivo_desvinculacion IS 'Razón de la desvinculación (ej: Traspaso por vencimiento de seguimiento, Conversión a venta, etc.)';

-- ============================================
-- 2. VERIFICAR/AGREGAR COLUMNAS DE CAMPAÑA EN PROSPECTOS
-- ============================================
-- Estas columnas deberían existir, pero por si acaso las agregamos con IF NOT EXISTS

DO $$
BEGIN
    -- Columna campana_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospectos' AND column_name = 'campana_id') THEN
        ALTER TABLE prospectos ADD COLUMN campana_id INTEGER REFERENCES campanas_asesor(id) ON DELETE SET NULL;
        CREATE INDEX idx_prospectos_campana_id ON prospectos(campana_id);
    END IF;

    -- Columna campana_linea_detectada
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospectos' AND column_name = 'campana_linea_detectada') THEN
        ALTER TABLE prospectos ADD COLUMN campana_linea_detectada VARCHAR(100);
    END IF;

    -- Columna campana_valor_producto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospectos' AND column_name = 'campana_valor_producto') THEN
        ALTER TABLE prospectos ADD COLUMN campana_valor_producto DECIMAL(10,2);
    END IF;
END $$;

-- ============================================
-- 3. TRIGGER PARA ACTUALIZAR updated_at EN HISTORIAL
-- ============================================
CREATE OR REPLACE FUNCTION update_prospecto_campanas_historial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_prospecto_campanas_historial ON prospecto_campanas_historial;
CREATE TRIGGER trigger_update_prospecto_campanas_historial
    BEFORE UPDATE ON prospecto_campanas_historial
    FOR EACH ROW
    EXECUTE FUNCTION update_prospecto_campanas_historial_updated_at();

-- ============================================
-- 4. FUNCIÓN HELPER: REGISTRAR VINCULACIÓN DE CAMPAÑA
-- ============================================
CREATE OR REPLACE FUNCTION registrar_vinculacion_campana(
    p_prospecto_id INTEGER,
    p_prospecto_codigo VARCHAR(50),
    p_campana_id INTEGER,
    p_asesor_id INTEGER,
    p_asesor_nombre VARCHAR(255),
    p_linea_detectada VARCHAR(100) DEFAULT NULL,
    p_valor_producto DECIMAL(10,2) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_historial_id INTEGER;
BEGIN
    INSERT INTO prospecto_campanas_historial (
        prospecto_id,
        prospecto_codigo,
        campana_id,
        asesor_id,
        asesor_nombre,
        campana_linea_detectada,
        campana_valor_producto,
        fecha_vinculacion
    ) VALUES (
        p_prospecto_id,
        p_prospecto_codigo,
        p_campana_id,
        p_asesor_id,
        p_asesor_nombre,
        p_linea_detectada,
        p_valor_producto,
        NOW()
    ) RETURNING id INTO v_historial_id;

    RETURN v_historial_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_vinculacion_campana IS 'Registra la vinculación de un prospecto a una campaña en el historial';

-- ============================================
-- 5. FUNCIÓN HELPER: REGISTRAR DESVINCULACIÓN DE CAMPAÑA
-- ============================================
CREATE OR REPLACE FUNCTION registrar_desvinculacion_campana(
    p_prospecto_id INTEGER,
    p_motivo VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Marcar como desvinculados todos los registros activos (sin fecha_desvinculacion)
    UPDATE prospecto_campanas_historial
    SET fecha_desvinculacion = NOW(),
        motivo_desvinculacion = p_motivo
    WHERE prospecto_id = p_prospecto_id
      AND fecha_desvinculacion IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_desvinculacion_campana IS 'Registra la desvinculación de un prospecto de todas sus campañas activas';

-- ============================================
-- 6. VISTA: CAMPAÑAS ACTIVAS POR PROSPECTO
-- ============================================
CREATE OR REPLACE VIEW v_prospectos_campanas_activas AS
SELECT
    pch.id AS historial_id,
    pch.prospecto_id,
    pch.prospecto_codigo,
    p.nombre_cliente,
    pch.campana_id,
    ca.nombre_campana,
    pch.asesor_id,
    pch.asesor_nombre,
    pch.campana_linea_detectada,
    pch.campana_valor_producto,
    pch.fecha_vinculacion,
    EXTRACT(DAY FROM NOW() - pch.fecha_vinculacion) AS dias_en_campana
FROM prospecto_campanas_historial pch
INNER JOIN prospectos p ON pch.prospecto_id = p.id
INNER JOIN campanas_asesor ca ON pch.campana_id = ca.id
WHERE pch.fecha_desvinculacion IS NULL
  AND p.activo = true;

COMMENT ON VIEW v_prospectos_campanas_activas IS 'Vista de prospectos actualmente vinculados a campañas';

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
SELECT
    'prospecto_campanas_historial' AS tabla_creada,
    COUNT(*) AS columnas_totales
FROM information_schema.columns
WHERE table_name = 'prospecto_campanas_historial';

SELECT 'Sistema de desvinculación de campañas instalado exitosamente ✅' AS resultado;
