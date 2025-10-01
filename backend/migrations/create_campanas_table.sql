-- ============================================
-- TABLA DE CAMPAÑAS - SISTEMA DINÁMICO
-- ============================================

-- Crear tabla de campañas
CREATE TABLE IF NOT EXISTS campanas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) DEFAULT 'personal', -- 'personal', 'global'
    linea_producto VARCHAR(255) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    meta_mensajes INTEGER DEFAULT 0,
    meta_ventas INTEGER DEFAULT 0,
    color_tema VARCHAR(50) DEFAULT 'blue', -- 'blue', 'green', 'purple', 'red', 'yellow'
    vendedor_asignado INTEGER REFERENCES usuarios(id),
    creado_por INTEGER NOT NULL REFERENCES usuarios(id),
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_campanas_activa ON campanas(activa);
CREATE INDEX IF NOT EXISTS idx_campanas_fecha_inicio ON campanas(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_campanas_fecha_fin ON campanas(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_campanas_linea_producto ON campanas(linea_producto);
CREATE INDEX IF NOT EXISTS idx_campanas_vendedor_asignado ON campanas(vendedor_asignado);

-- Insertar campañas de ejemplo para testing
INSERT INTO campanas (
    nombre, descripcion, tipo, linea_producto,
    fecha_inicio, fecha_fin, meta_mensajes, meta_ventas,
    color_tema, vendedor_asignado, creado_por, activa
) VALUES
(
    'Campaña Electrodomésticos Q4',
    'Impulso de línea blanca para el último trimestre',
    'global',
    'ELECTRODOMESTICOS',
    CURRENT_DATE - INTERVAL '10 days',
    CURRENT_DATE + INTERVAL '20 days',
    500,
    20,
    'purple',
    NULL,
    1,
    true
),
(
    'Tecnología Black Friday',
    'Promoción especial de smartphones y tablets',
    'global',
    'TECNOLOGIA',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '15 days',
    300,
    15,
    'blue',
    NULL,
    1,
    true
),
(
    'Hogar Diciembre',
    'Campaña navideña de muebles y decoración',
    'personal',
    'HOGAR_DECORACION',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    200,
    10,
    'green',
    1,
    1,
    true
),
(
    'Automotriz Fin de Año',
    'Accesorios y repuestos automotrices',
    'global',
    'AUTOMOTRIZ',
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE + INTERVAL '25 days',
    400,
    18,
    'red',
    NULL,
    1,
    true
),
(
    'Deportes Verano',
    'Equipamiento deportivo para temporada alta',
    'personal',
    'DEPORTES_FITNESS',
    CURRENT_DATE + INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '45 days',
    350,
    12,
    'yellow',
    2,
    1,
    true
);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_campanas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campanas_updated_at
    BEFORE UPDATE ON campanas
    FOR EACH ROW
    EXECUTE FUNCTION update_campanas_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE campanas IS 'Tabla de campañas de ventas dinámicas';
COMMENT ON COLUMN campanas.tipo IS 'Tipo de campaña: personal (asignada) o global (para todos)';
COMMENT ON COLUMN campanas.linea_producto IS 'Línea de producto objetivo de la campaña';
COMMENT ON COLUMN campanas.meta_mensajes IS 'Meta de mensajes a enviar en la campaña';
COMMENT ON COLUMN campanas.meta_ventas IS 'Meta de ventas a alcanzar en la campaña';
COMMENT ON COLUMN campanas.color_tema IS 'Color del tema para mostrar en frontend';

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla campañas creada exitosamente' AS resultado;