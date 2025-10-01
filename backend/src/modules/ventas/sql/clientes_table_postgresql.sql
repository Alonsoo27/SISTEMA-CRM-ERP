-- ============================================
-- TABLA CLIENTES - SISTEMA CRM/ERP v2.0 (POSTGRESQL)
-- Integrada en módulo de ventas
-- ============================================

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,

  -- Tipo de cliente
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('persona','empresa')),

  -- Datos para persona natural
  nombres VARCHAR(100),
  apellidos VARCHAR(100),

  -- Datos para empresa
  razon_social VARCHAR(255),

  -- Documento de identidad
  tipo_documento VARCHAR(20) NOT NULL CHECK (tipo_documento IN ('DNI','RUC','PASAPORTE','CE')),
  numero_documento VARCHAR(20) NOT NULL,

  -- Datos de contacto
  telefono VARCHAR(20),
  email VARCHAR(255),

  -- Dirección
  direccion TEXT,
  distrito VARCHAR(100),
  provincia VARCHAR(100),
  departamento VARCHAR(100),

  -- Datos de contacto empresarial (para empresas)
  contacto_nombres VARCHAR(100),
  contacto_apellidos VARCHAR(100),
  contacto_cargo VARCHAR(100),
  contacto_telefono VARCHAR(20),
  contacto_email VARCHAR(255),

  -- Estado y notas
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  observaciones TEXT,

  -- Metadatos
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER DEFAULT 1,
  updated_by INTEGER DEFAULT 1,

  -- Índices únicos
  UNIQUE(numero_documento)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_cliente ON clientes (tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes (estado);
CREATE INDEX IF NOT EXISTS idx_clientes_departamento ON clientes (departamento);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes (email);
CREATE INDEX IF NOT EXISTS idx_clientes_nombres ON clientes (nombres, apellidos);
CREATE INDEX IF NOT EXISTS idx_clientes_razon_social ON clientes (razon_social);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON clientes (created_at);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes (activo);

-- Índices compuestos para búsquedas
CREATE INDEX IF NOT EXISTS idx_clientes_busqueda_persona ON clientes (nombres, apellidos, numero_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_busqueda_empresa ON clientes (razon_social, numero_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_ubicacion ON clientes (departamento, provincia, distrito);

-- ============================================
-- DATOS DE EJEMPLO PARA TESTING
-- ============================================

INSERT INTO clientes (
  tipo_cliente, nombres, apellidos, tipo_documento, numero_documento,
  telefono, email, direccion, distrito, provincia, departamento,
  estado, observaciones
) VALUES
(
  'persona', 'Juan Carlos', 'Pérez García', 'DNI', '12345678',
  '+51 987654321', 'juan.perez@email.com', 'Av. Principal 123',
  'Miraflores', 'Lima', 'Lima', 'activo', 'Cliente frecuente'
),
(
  'persona', 'Ana Sofía', 'Rodriguez López', 'DNI', '87654321',
  '+51 965432109', 'ana.rodriguez@email.com', 'Jr. Los Olivos 456',
  'San Borja', 'Lima', 'Lima', 'activo', 'Cliente premium'
),
(
  'empresa', NULL, NULL, 'RUC', '20123456789',
  '+51 976543210', 'contacto@empresaabc.com', 'Av. Industrial 789',
  'Cercado', 'Arequipa', 'Arequipa', 'activo', 'Empresa proveedora'
)
ON CONFLICT (numero_documento) DO NOTHING;

-- Actualizar contacto empresarial para la empresa
UPDATE clientes
SET
  razon_social = 'Empresa ABC S.A.C.',
  contacto_nombres = 'María',
  contacto_apellidos = 'González',
  contacto_cargo = 'Gerente Comercial',
  contacto_telefono = '+51 976543210',
  contacto_email = 'maria.gonzalez@empresaabc.com'
WHERE numero_documento = '20123456789';

-- ============================================
-- VERIFICACIÓN DE LA ESTRUCTURA
-- ============================================

-- Verificar que la tabla se creó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clientes'
ORDER BY ordinal_position;

-- Mostrar los datos de ejemplo
SELECT
  id,
  tipo_cliente,
  CASE
    WHEN tipo_cliente = 'persona' THEN CONCAT(nombres, ' ', apellidos)
    ELSE razon_social
  END as nombre_completo,
  tipo_documento,
  numero_documento,
  email,
  departamento,
  estado,
  created_at
FROM clientes
ORDER BY created_at DESC;