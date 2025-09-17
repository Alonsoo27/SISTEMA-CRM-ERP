-- =====================================================
-- MIGRACIÓN 011: MÓDULO PRODUCTOS (CORREGIDA)
-- Fecha: 2025-07-15
-- Descripción: Tablas para gestión de catálogo de productos
-- =====================================================

-- Tabla de categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla principal de productos
CREATE TABLE IF NOT EXISTS productos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(500) NOT NULL,
    precio_sin_igv DECIMAL(10,2) NOT NULL CHECK (precio_sin_igv >= 0),
    marca VARCHAR(100),
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_marca ON productos(marca);

-- Índices para categorías
CREATE INDEX IF NOT EXISTS idx_categorias_activo ON categorias(activo);

-- Insertar categorías por defecto
INSERT INTO categorias (nombre, descripcion) VALUES
('Máquinas', 'Equipos y maquinaria industrial'),
('Plásticos', 'Productos y materiales plásticos'),
('Repuestos', 'Piezas de repuesto y componentes'),
('Accesorios', 'Accesorios y complementos')
ON CONFLICT (nombre) DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE categorias IS 'Categorías para clasificación de productos';
COMMENT ON TABLE productos IS 'Catálogo principal de productos de la empresa';
COMMENT ON COLUMN productos.codigo IS 'Código único del producto (no se puede repetir)';
COMMENT ON COLUMN productos.precio_sin_igv IS 'Precio base sin IGV para cálculos';
