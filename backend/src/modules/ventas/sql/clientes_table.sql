-- ============================================
-- TABLA CLIENTES - SISTEMA CRM/ERP v2.0
-- Integrada en módulo de ventas
-- ============================================

CREATE TABLE IF NOT EXISTS `clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,

  -- Tipo de cliente
  `tipo_cliente` enum('persona','empresa') NOT NULL COMMENT 'Tipo de cliente: persona natural o empresa',

  -- Datos para persona natural
  `nombres` varchar(100) DEFAULT NULL COMMENT 'Nombres de la persona',
  `apellidos` varchar(100) DEFAULT NULL COMMENT 'Apellidos de la persona',

  -- Datos para empresa
  `razon_social` varchar(255) DEFAULT NULL COMMENT 'Razón social de la empresa',

  -- Documento de identidad
  `tipo_documento` enum('DNI','RUC','PASAPORTE','CE') NOT NULL COMMENT 'Tipo de documento de identidad',
  `numero_documento` varchar(20) NOT NULL COMMENT 'Número de documento de identidad',

  -- Datos de contacto
  `telefono` varchar(20) DEFAULT NULL COMMENT 'Teléfono principal',
  `email` varchar(255) DEFAULT NULL COMMENT 'Correo electrónico',

  -- Dirección
  `direccion` text DEFAULT NULL COMMENT 'Dirección completa',
  `distrito` varchar(100) DEFAULT NULL COMMENT 'Distrito',
  `provincia` varchar(100) DEFAULT NULL COMMENT 'Provincia',
  `departamento` varchar(100) DEFAULT NULL COMMENT 'Departamento',

  -- Datos de contacto empresarial (para empresas)
  `contacto_nombres` varchar(100) DEFAULT NULL COMMENT 'Nombres del contacto principal',
  `contacto_apellidos` varchar(100) DEFAULT NULL COMMENT 'Apellidos del contacto principal',
  `contacto_cargo` varchar(100) DEFAULT NULL COMMENT 'Cargo del contacto principal',
  `contacto_telefono` varchar(20) DEFAULT NULL COMMENT 'Teléfono del contacto principal',
  `contacto_email` varchar(255) DEFAULT NULL COMMENT 'Email del contacto principal',

  -- Estado y notas
  `estado` enum('activo','inactivo') NOT NULL DEFAULT 'activo' COMMENT 'Estado del cliente',
  `notas` text DEFAULT NULL COMMENT 'Notas adicionales sobre el cliente',

  -- Metadatos
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Fecha de eliminación (soft delete)',

  PRIMARY KEY (`id`),

  -- Índices para optimización
  UNIQUE KEY `idx_numero_documento` (`numero_documento`, `deleted_at`) COMMENT 'Documento único por cliente activo',
  KEY `idx_tipo_cliente` (`tipo_cliente`),
  KEY `idx_estado` (`estado`),
  KEY `idx_departamento` (`departamento`),
  KEY `idx_email` (`email`),
  KEY `idx_nombres` (`nombres`, `apellidos`),
  KEY `idx_razon_social` (`razon_social`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),

  -- Índices compuestos para búsquedas
  KEY `idx_busqueda_persona` (`nombres`, `apellidos`, `numero_documento`),
  KEY `idx_busqueda_empresa` (`razon_social`, `numero_documento`),
  KEY `idx_ubicacion` (`departamento`, `provincia`, `distrito`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de clientes del sistema CRM/ERP';

-- ============================================
-- DATOS DE EJEMPLO PARA TESTING
-- ============================================

INSERT IGNORE INTO `clientes` (
  `tipo_cliente`, `nombres`, `apellidos`, `tipo_documento`, `numero_documento`,
  `telefono`, `email`, `direccion`, `distrito`, `provincia`, `departamento`,
  `estado`, `notas`
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
);

-- Actualizar contacto empresarial para la empresa
UPDATE `clientes`
SET
  `razon_social` = 'Empresa ABC S.A.C.',
  `contacto_nombres` = 'María',
  `contacto_apellidos` = 'González',
  `contacto_cargo` = 'Gerente Comercial',
  `contacto_telefono` = '+51 976543210',
  `contacto_email` = 'maria.gonzalez@empresaabc.com'
WHERE `numero_documento` = '20123456789';

-- ============================================
-- VERIFICACIÓN DE LA ESTRUCTURA
-- ============================================

-- Verificar que la tabla se creó correctamente
DESCRIBE `clientes`;

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
FROM `clientes`
ORDER BY created_at DESC;