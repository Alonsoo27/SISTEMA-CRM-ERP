-- =====================================================
-- TABLA DE UBICACIONES OFICIALES DEL PERÚ (UBIGEO)
-- Basado en datos oficiales RENIEC/INEI
-- =====================================================

CREATE TABLE IF NOT EXISTS ubicaciones_peru (
    id SERIAL PRIMARY KEY,
    ubigeo VARCHAR(6) NOT NULL UNIQUE, -- Código oficial INEI

    -- Jerarquía geográfica
    departamento_codigo VARCHAR(2) NOT NULL,
    provincia_codigo VARCHAR(4) NOT NULL,
    distrito_codigo VARCHAR(6) NOT NULL,

    -- Nombres oficiales estandarizados
    departamento VARCHAR(100) NOT NULL,
    provincia VARCHAR(100) NOT NULL,
    distrito VARCHAR(100) NOT NULL,

    -- Metadatos
    nivel VARCHAR(20) NOT NULL, -- 'departamento', 'provincia', 'distrito'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_ubicaciones_departamento ON ubicaciones_peru(departamento_codigo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_provincia ON ubicaciones_peru(provincia_codigo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_distrito ON ubicaciones_peru(distrito_codigo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_nivel ON ubicaciones_peru(nivel);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_activo ON ubicaciones_peru(activo);

-- Índices compuestos para búsquedas jerárquicas
CREATE INDEX IF NOT EXISTS idx_ubicaciones_dept_prov ON ubicaciones_peru(departamento_codigo, provincia_codigo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_jerarquia ON ubicaciones_peru(departamento_codigo, provincia_codigo, distrito_codigo);

-- =====================================================
-- INSERTAR DATOS OFICIALES DEL PERÚ
-- Estructura: Departamentos → Provincias → Distritos
-- =====================================================

-- DEPARTAMENTOS PRINCIPALES
INSERT INTO ubicaciones_peru (ubigeo, departamento_codigo, provincia_codigo, distrito_codigo, departamento, provincia, distrito, nivel) VALUES
-- AMAZONAS
('01', '01', '01', '01', 'AMAZONAS', 'CHACHAPOYAS', 'CHACHAPOYAS', 'departamento'),
('0101', '01', '01', '01', 'AMAZONAS', 'CHACHAPOYAS', 'CHACHAPOYAS', 'provincia'),
('010101', '01', '01', '01', 'AMAZONAS', 'CHACHAPOYAS', 'CHACHAPOYAS', 'distrito'),

-- ANCASH
('02', '02', '02', '02', 'ANCASH', 'HUARAZ', 'HUARAZ', 'departamento'),
('0201', '02', '01', '01', 'ANCASH', 'HUARAZ', 'HUARAZ', 'provincia'),
('020101', '02', '01', '01', 'ANCASH', 'HUARAZ', 'HUARAZ', 'distrito'),

-- APURIMAC
('03', '03', '03', '03', 'APURIMAC', 'ABANCAY', 'ABANCAY', 'departamento'),
('0301', '03', '01', '01', 'APURIMAC', 'ABANCAY', 'ABANCAY', 'provincia'),
('030101', '03', '01', '01', 'APURIMAC', 'ABANCAY', 'ABANCAY', 'distrito'),

-- AREQUIPA
('04', '04', '04', '04', 'AREQUIPA', 'AREQUIPA', 'AREQUIPA', 'departamento'),
('0401', '04', '01', '01', 'AREQUIPA', 'AREQUIPA', 'AREQUIPA', 'provincia'),
('040101', '04', '01', '01', 'AREQUIPA', 'AREQUIPA', 'AREQUIPA', 'distrito'),

-- AYACUCHO
('05', '05', '05', '05', 'AYACUCHO', 'HUAMANGA', 'AYACUCHO', 'departamento'),
('0501', '05', '01', '01', 'AYACUCHO', 'HUAMANGA', 'AYACUCHO', 'provincia'),
('050101', '05', '01', '01', 'AYACUCHO', 'HUAMANGA', 'AYACUCHO', 'distrito'),

-- CAJAMARCA
('06', '06', '06', '06', 'CAJAMARCA', 'CAJAMARCA', 'CAJAMARCA', 'departamento'),
('0601', '06', '01', '01', 'CAJAMARCA', 'CAJAMARCA', 'CAJAMARCA', 'provincia'),
('060101', '06', '01', '01', 'CAJAMARCA', 'CAJAMARCA', 'CAJAMARCA', 'distrito'),

-- CUSCO
('08', '08', '08', '08', 'CUSCO', 'CUSCO', 'CUSCO', 'departamento'),
('0801', '08', '01', '01', 'CUSCO', 'CUSCO', 'CUSCO', 'provincia'),
('080101', '08', '01', '01', 'CUSCO', 'CUSCO', 'CUSCO', 'distrito'),

-- HUANCAVELICA
('09', '09', '09', '09', 'HUANCAVELICA', 'HUANCAVELICA', 'HUANCAVELICA', 'departamento'),
('0901', '09', '01', '01', 'HUANCAVELICA', 'HUANCAVELICA', 'HUANCAVELICA', 'provincia'),
('090101', '09', '01', '01', 'HUANCAVELICA', 'HUANCAVELICA', 'HUANCAVELICA', 'distrito'),

-- HUANUCO
('10', '10', '10', '10', 'HUANUCO', 'HUANUCO', 'HUANUCO', 'departamento'),
('1001', '10', '01', '01', 'HUANUCO', 'HUANUCO', 'HUANUCO', 'provincia'),
('100101', '10', '01', '01', 'HUANUCO', 'HUANUCO', 'HUANUCO', 'distrito'),

-- ICA
('11', '11', '11', '11', 'ICA', 'ICA', 'ICA', 'departamento'),
('1101', '11', '01', '01', 'ICA', 'ICA', 'ICA', 'provincia'),
('110101', '11', '01', '01', 'ICA', 'ICA', 'ICA', 'distrito'),

-- JUNIN
('12', '12', '12', '12', 'JUNIN', 'HUANCAYO', 'HUANCAYO', 'departamento'),
('1201', '12', '01', '01', 'JUNIN', 'HUANCAYO', 'HUANCAYO', 'provincia'),
('120101', '12', '01', '01', 'JUNIN', 'HUANCAYO', 'HUANCAYO', 'distrito'),

-- LA LIBERTAD
('13', '13', '13', '13', 'LA LIBERTAD', 'TRUJILLO', 'TRUJILLO', 'departamento'),
('1301', '13', '01', '01', 'LA LIBERTAD', 'TRUJILLO', 'TRUJILLO', 'provincia'),
('130101', '13', '01', '01', 'LA LIBERTAD', 'TRUJILLO', 'TRUJILLO', 'distrito'),

-- LAMBAYEQUE
('14', '14', '14', '14', 'LAMBAYEQUE', 'CHICLAYO', 'CHICLAYO', 'departamento'),
('1401', '14', '01', '01', 'LAMBAYEQUE', 'CHICLAYO', 'CHICLAYO', 'provincia'),
('140101', '14', '01', '01', 'LAMBAYEQUE', 'CHICLAYO', 'CHICLAYO', 'distrito'),

-- LIMA
('15', '15', '15', '15', 'LIMA', 'LIMA', 'LIMA', 'departamento'),
('1501', '15', '01', '01', 'LIMA', 'LIMA', 'LIMA', 'provincia'),
('150101', '15', '01', '01', 'LIMA', 'LIMA', 'LIMA', 'distrito'),
('150102', '15', '01', '02', 'LIMA', 'LIMA', 'ANCON', 'distrito'),
('150103', '15', '01', '03', 'LIMA', 'LIMA', 'ATE', 'distrito'),
('150104', '15', '01', '04', 'LIMA', 'LIMA', 'BARRANCO', 'distrito'),
('150105', '15', '01', '05', 'LIMA', 'LIMA', 'BREÑA', 'distrito'),
('150106', '15', '01', '06', 'LIMA', 'LIMA', 'CARABAYLLO', 'distrito'),
('150107', '15', '01', '07', 'LIMA', 'LIMA', 'CHACLACAYO', 'distrito'),
('150108', '15', '01', '08', 'LIMA', 'LIMA', 'CHORRILLOS', 'distrito'),
('150109', '15', '01', '09', 'LIMA', 'LIMA', 'CIENEGUILLA', 'distrito'),
('150110', '15', '01', '10', 'LIMA', 'LIMA', 'COMAS', 'distrito'),
('150111', '15', '01', '11', 'LIMA', 'LIMA', 'EL AGUSTINO', 'distrito'),
('150112', '15', '01', '12', 'LIMA', 'LIMA', 'INDEPENDENCIA', 'distrito'),
('150113', '15', '01', '13', 'LIMA', 'LIMA', 'JESUS MARIA', 'distrito'),
('150114', '15', '01', '14', 'LIMA', 'LIMA', 'LA MOLINA', 'distrito'),
('150115', '15', '01', '15', 'LIMA', 'LIMA', 'LA VICTORIA', 'distrito'),
('150116', '15', '01', '16', 'LIMA', 'LIMA', 'LINCE', 'distrito'),
('150117', '15', '01', '17', 'LIMA', 'LIMA', 'LOS OLIVOS', 'distrito'),
('150118', '15', '01', '18', 'LIMA', 'LIMA', 'LURIGANCHO', 'distrito'),
('150119', '15', '01', '19', 'LIMA', 'LIMA', 'LURIN', 'distrito'),
('150120', '15', '01', '20', 'LIMA', 'LIMA', 'MAGDALENA DEL MAR', 'distrito'),
('150121', '15', '01', '21', 'LIMA', 'LIMA', 'MIRAFLORES', 'distrito'),
('150122', '15', '01', '22', 'LIMA', 'LIMA', 'PACHACAMAC', 'distrito'),
('150123', '15', '01', '23', 'LIMA', 'LIMA', 'PUCUSANA', 'distrito'),
('150124', '15', '01', '24', 'LIMA', 'LIMA', 'PUEBLO LIBRE', 'distrito'),
('150125', '15', '01', '25', 'LIMA', 'LIMA', 'PUENTE PIEDRA', 'distrito'),
('150126', '15', '01', '26', 'LIMA', 'LIMA', 'PUNTA HERMOSA', 'distrito'),
('150127', '15', '01', '27', 'LIMA', 'LIMA', 'PUNTA NEGRA', 'distrito'),
('150128', '15', '01', '28', 'LIMA', 'LIMA', 'RIMAC', 'distrito'),
('150129', '15', '01', '29', 'LIMA', 'LIMA', 'SAN BARTOLO', 'distrito'),
('150130', '15', '01', '30', 'LIMA', 'LIMA', 'SAN BORJA', 'distrito'),
('150131', '15', '01', '31', 'LIMA', 'LIMA', 'SAN ISIDRO', 'distrito'),
('150132', '15', '01', '32', 'LIMA', 'LIMA', 'SAN JUAN DE LURIGANCHO', 'distrito'),
('150133', '15', '01', '33', 'LIMA', 'LIMA', 'SAN JUAN DE MIRAFLORES', 'distrito'),
('150134', '15', '01', '34', 'LIMA', 'LIMA', 'SAN LUIS', 'distrito'),
('150135', '15', '01', '35', 'LIMA', 'LIMA', 'SAN MARTIN DE PORRES', 'distrito'),
('150136', '15', '01', '36', 'LIMA', 'LIMA', 'SAN MIGUEL', 'distrito'),
('150137', '15', '01', '37', 'LIMA', 'LIMA', 'SANTA ANITA', 'distrito'),
('150138', '15', '01', '38', 'LIMA', 'LIMA', 'SANTA MARIA DEL MAR', 'distrito'),
('150139', '15', '01', '39', 'LIMA', 'LIMA', 'SANTA ROSA', 'distrito'),
('150140', '15', '01', '40', 'LIMA', 'LIMA', 'SANTIAGO DE SURCO', 'distrito'),
('150141', '15', '01', '41', 'LIMA', 'LIMA', 'SURQUILLO', 'distrito'),
('150142', '15', '01', '42', 'LIMA', 'LIMA', 'VILLA EL SALVADOR', 'distrito'),
('150143', '15', '01', '43', 'LIMA', 'LIMA', 'VILLA MARIA DEL TRIUNFO', 'distrito'),

-- LORETO
('16', '16', '16', '16', 'LORETO', 'MAYNAS', 'IQUITOS', 'departamento'),
('1601', '16', '01', '01', 'LORETO', 'MAYNAS', 'IQUITOS', 'provincia'),
('160101', '16', '01', '01', 'LORETO', 'MAYNAS', 'IQUITOS', 'distrito'),

-- MADRE DE DIOS
('17', '17', '17', '17', 'MADRE DE DIOS', 'TAMBOPATA', 'TAMBOPATA', 'departamento'),
('1701', '17', '01', '01', 'MADRE DE DIOS', 'TAMBOPATA', 'TAMBOPATA', 'provincia'),
('170101', '17', '01', '01', 'MADRE DE DIOS', 'TAMBOPATA', 'TAMBOPATA', 'distrito'),

-- MOQUEGUA
('18', '18', '18', '18', 'MOQUEGUA', 'MARISCAL NIETO', 'MOQUEGUA', 'departamento'),
('1801', '18', '01', '01', 'MOQUEGUA', 'MARISCAL NIETO', 'MOQUEGUA', 'provincia'),
('180101', '18', '01', '01', 'MOQUEGUA', 'MARISCAL NIETO', 'MOQUEGUA', 'distrito'),

-- PASCO
('19', '19', '19', '19', 'PASCO', 'PASCO', 'CHAUPIMARCA', 'departamento'),
('1901', '19', '01', '01', 'PASCO', 'PASCO', 'CHAUPIMARCA', 'provincia'),
('190101', '19', '01', '01', 'PASCO', 'PASCO', 'CHAUPIMARCA', 'distrito'),

-- PIURA
('20', '20', '20', '20', 'PIURA', 'PIURA', 'PIURA', 'departamento'),
('2001', '20', '01', '01', 'PIURA', 'PIURA', 'PIURA', 'provincia'),
('200101', '20', '01', '01', 'PIURA', 'PIURA', 'PIURA', 'distrito'),

-- PUNO
('21', '21', '21', '21', 'PUNO', 'PUNO', 'PUNO', 'departamento'),
('2101', '21', '01', '01', 'PUNO', 'PUNO', 'PUNO', 'provincia'),
('210101', '21', '01', '01', 'PUNO', 'PUNO', 'PUNO', 'distrito'),

-- SAN MARTIN
('22', '22', '22', '22', 'SAN MARTIN', 'MOYOBAMBA', 'MOYOBAMBA', 'departamento'),
('2201', '22', '01', '01', 'SAN MARTIN', 'MOYOBAMBA', 'MOYOBAMBA', 'provincia'),
('220101', '22', '01', '01', 'SAN MARTIN', 'MOYOBAMBA', 'MOYOBAMBA', 'distrito'),

-- TACNA
('23', '23', '23', '23', 'TACNA', 'TACNA', 'TACNA', 'departamento'),
('2301', '23', '01', '01', 'TACNA', 'TACNA', 'TACNA', 'provincia'),
('230101', '23', '01', '01', 'TACNA', 'TACNA', 'TACNA', 'distrito'),

-- TUMBES
('24', '24', '24', '24', 'TUMBES', 'TUMBES', 'TUMBES', 'departamento'),
('2401', '24', '01', '01', 'TUMBES', 'TUMBES', 'TUMBES', 'provincia'),
('240101', '24', '01', '01', 'TUMBES', 'TUMBES', 'TUMBES', 'distrito'),

-- UCAYALI
('25', '25', '25', '25', 'UCAYALI', 'CORONEL PORTILLO', 'CALLERIA', 'departamento'),
('2501', '25', '01', '01', 'UCAYALI', 'CORONEL PORTILLO', 'CALLERIA', 'provincia'),
('250101', '25', '01', '01', 'UCAYALI', 'CORONEL PORTILLO', 'CALLERIA', 'distrito');

-- =====================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION update_ubicaciones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_ubicaciones_timestamp
    BEFORE UPDATE ON ubicaciones_peru
    FOR EACH ROW
    EXECUTE FUNCTION update_ubicaciones_timestamp();

-- =====================================================
-- VISTAS PARA CONSULTAS RÁPIDAS
-- =====================================================

-- Vista de departamentos únicos
CREATE OR REPLACE VIEW v_departamentos AS
SELECT DISTINCT
    departamento_codigo,
    departamento
FROM ubicaciones_peru
WHERE activo = true
ORDER BY departamento;

-- Vista de provincias por departamento
CREATE OR REPLACE VIEW v_provincias AS
SELECT DISTINCT
    departamento_codigo,
    departamento,
    provincia_codigo,
    provincia
FROM ubicaciones_peru
WHERE activo = true
ORDER BY departamento, provincia;

-- Vista de distritos por provincia
CREATE OR REPLACE VIEW v_distritos AS
SELECT DISTINCT
    departamento_codigo,
    departamento,
    provincia_codigo,
    provincia,
    distrito_codigo,
    distrito,
    ubigeo
FROM ubicaciones_peru
WHERE activo = true
ORDER BY departamento, provincia, distrito;

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE ubicaciones_peru IS 'Tabla oficial de ubicaciones del Perú basada en UBIGEO RENIEC/INEI';
COMMENT ON COLUMN ubicaciones_peru.ubigeo IS 'Código oficial UBIGEO de 6 dígitos';
COMMENT ON COLUMN ubicaciones_peru.nivel IS 'Nivel jerárquico: departamento, provincia, distrito';
COMMENT ON VIEW v_departamentos IS 'Vista optimizada para obtener lista de departamentos';
COMMENT ON VIEW v_provincias IS 'Vista optimizada para obtener provincias por departamento';
COMMENT ON VIEW v_distritos IS 'Vista optimizada para obtener distritos por provincia';