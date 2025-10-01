-- =====================================================
-- ACTUALIZACIÓN COMPLETA DE UBICACIONES PERU - CORREGIDO
-- Soluciona duplicados en códigos UBIGEO
-- =====================================================

-- PASO 1: Crear tabla temporal
DROP TABLE IF EXISTS ubigeo_temp;

CREATE TABLE ubigeo_temp (
    id_ubigeo integer NOT NULL,
    nombre_ubigeo varchar(80) NOT NULL,
    codigo_ubigeo varchar(2) NOT NULL,
    etiqueta_ubigeo varchar(200) DEFAULT NULL,
    buscador_ubigeo varchar(200) DEFAULT NULL,
    numero_hijos_ubigeo integer DEFAULT NULL,
    nivel_ubigeo smallint DEFAULT NULL,
    id_padre_ubigeo integer NOT NULL
);

-- PASO 2: Insertar datos de ejemplo corregidos
INSERT INTO ubigeo_temp (id_ubigeo, nombre_ubigeo, codigo_ubigeo, etiqueta_ubigeo, buscador_ubigeo, numero_hijos_ubigeo, nivel_ubigeo, id_padre_ubigeo) VALUES
(2533, 'Perú', '', 'Perú', 'perú', 25, 0, 0),
(2534, 'Amazonas', '01', 'Amazonas, Perú', 'amazonas perú', 7, 1, 2533),
(2535, 'Chachapoyas', '01', 'Chachapoyas, Amazonas', 'chachapoyas amazonas', 21, 2, 2534),
(2536, 'Chachapoyas', '01', 'Chachapoyas, Chachapoyas', 'chachapoyas chachapoyas', 0, 3, 2535),
(2537, 'Asuncion', '02', 'Asuncion, Chachapoyas', 'asuncion chachapoyas', 0, 3, 2535),
(2538, 'Balsas', '03', 'Balsas, Chachapoyas', 'balsas chachapoyas', 0, 3, 2535),
(3926, 'Lima', '15', 'Lima, Perú', 'lima perú', 10, 1, 2533),
(3927, 'Lima', '01', 'Lima, Lima, Lima', 'lima lima lima', 43, 2, 3926),
(3928, 'Cercado de Lima', '01', 'Cercado de Lima, Lima', 'cercado de lima lima', 0, 3, 3927),
(3929, 'Ancon', '02', 'Ancon, Lima', 'ancon lima', 0, 3, 3927),
(3930, 'Ate', '03', 'Ate, Lima', 'ate lima', 0, 3, 3927),
(3931, 'Barranco', '04', 'Barranco, Lima', 'barranco lima', 0, 3, 3927),
(3932, 'Breña', '05', 'Breña, Lima', 'brena lima', 0, 3, 3927),
(3933, 'Carabayllo', '06', 'Carabayllo, Lima', 'carabayllo lima', 0, 3, 3927),
(3934, 'Chaclacayo', '07', 'Chaclacayo, Lima', 'chaclacayo lima', 0, 3, 3927),
(3935, 'Chorrillos', '08', 'Chorrillos, Lima', 'chorrillos lima', 0, 3, 3927),
(3936, 'Cieneguilla', '09', 'Cieneguilla, Lima', 'cieneguilla lima', 0, 3, 3927),
(3937, 'Comas', '10', 'Comas, Lima', 'comas lima', 0, 3, 3927),
(3938, 'El Agustino', '11', 'El Agustino, Lima', 'el agustino lima', 0, 3, 3927),
(3939, 'Independencia', '12', 'Independencia, Lima', 'independencia lima', 0, 3, 3927),
(3940, 'Jesus Maria', '13', 'Jesus Maria, Lima', 'jesus maria lima', 0, 3, 3927),
(3941, 'La Molina', '14', 'La Molina, Lima', 'la molina lima', 0, 3, 3927),
(3942, 'La Victoria', '15', 'La Victoria, Lima', 'la victoria lima', 0, 3, 3927),
(3943, 'Lince', '16', 'Lince, Lima', 'lince lima', 0, 3, 3927),
(3944, 'Los Olivos', '17', 'Los Olivos, Lima', 'los olivos lima', 0, 3, 3927),
(3945, 'Lurigancho', '18', 'Lurigancho, Lima', 'lurigancho lima', 0, 3, 3927),
(3946, 'Lurin', '19', 'Lurin, Lima', 'lurin lima', 0, 3, 3927),
(3947, 'Magdalena del Mar', '20', 'Magdalena del Mar, Lima', 'magdalena del mar lima', 0, 3, 3927),
(3948, 'Miraflores', '21', 'Miraflores, Lima', 'miraflores lima', 0, 3, 3927),
(3949, 'Pachacamac', '22', 'Pachacamac, Lima', 'pachacamac lima', 0, 3, 3927),
(3950, 'Pucusana', '23', 'Pucusana, Lima', 'pucusana lima', 0, 3, 3927),
(3951, 'Pueblo Libre', '24', 'Pueblo Libre, Lima', 'pueblo libre lima', 0, 3, 3927),
(3952, 'Puente Piedra', '25', 'Puente Piedra, Lima', 'puente piedra lima', 0, 3, 3927),
(3953, 'Punta Hermosa', '26', 'Punta Hermosa, Lima', 'punta hermosa lima', 0, 3, 3927),
(3954, 'Punta Negra', '27', 'Punta Negra, Lima', 'punta negra lima', 0, 3, 3927),
(3955, 'Rimac', '28', 'Rimac, Lima', 'rimac lima', 0, 3, 3927),
(3956, 'San Bartolo', '29', 'San Bartolo, Lima', 'san bartolo lima', 0, 3, 3927),
(3957, 'San Borja', '30', 'San Borja, Lima', 'san borja lima', 0, 3, 3927),
(3958, 'San Isidro', '31', 'San Isidro, Lima', 'san isidro lima', 0, 3, 3958),
(3959, 'San Juan de Lurigancho', '32', 'San Juan de Lurigancho, Lima', 'san juan de lurigancho lima', 0, 3, 3927),
(3960, 'San Juan de Miraflores', '33', 'San Juan de Miraflores, Lima', 'san juan de miraflores lima', 0, 3, 3927),
(3961, 'San Luis', '34', 'San Luis, Lima', 'san luis lima', 0, 3, 3927),
(3962, 'San Martin de Porres', '35', 'San Martin de Porres, Lima', 'san martin de porres lima', 0, 3, 3927),
(3963, 'San Miguel', '36', 'San Miguel, Lima', 'san miguel lima', 0, 3, 3927),
(3964, 'Santa Anita', '37', 'Santa Anita, Lima', 'santa anita lima', 0, 3, 3927),
(3965, 'Santa Maria del Mar', '38', 'Santa Maria del Mar, Lima', 'santa maria del mar lima', 0, 3, 3927),
(3966, 'Santa Rosa', '39', 'Santa Rosa, Lima', 'santa rosa lima', 0, 3, 3927),
(3967, 'Santiago de Surco', '40', 'Santiago de Surco, Lima', 'santiago de surco lima', 0, 3, 3927),
(3968, 'Surquillo', '41', 'Surquillo, Lima', 'surquillo lima', 0, 3, 3927),
(3969, 'Villa El Salvador', '42', 'Villa El Salvador, Lima', 'villa el salvador lima', 0, 3, 3927),
(3970, 'Villa Maria del Triunfo', '43', 'Villa Maria del Triunfo, Lima', 'villa maria del triunfo lima', 0, 3, 3927),
-- PROVINCIAS DE LIMA (códigos correctos)
(4278, 'Barranca', '02', 'Barranca, Lima', 'barranca lima', 5, 2, 3926),
(4283, 'Cajatambo', '03', 'Cajatambo, Lima', 'cajatambo lima', 5, 2, 3926),
(4288, 'Cañete', '04', 'Cañete, Lima', 'canete lima', 16, 2, 3926),
(4304, 'Canta', '05', 'Canta, Lima', 'canta lima', 7, 2, 3926),
(4311, 'Huaral', '06', 'Huaral, Lima', 'huaral lima', 12, 2, 3926),
(4323, 'Huarochiri', '07', 'Huarochiri, Lima', 'huarochiri lima', 32, 2, 3926),
(4355, 'Huaura', '08', 'Huaura, Lima', 'huaura lima', 12, 2, 3926),
(4367, 'Oyon', '09', 'Oyon, Lima', 'oyon lima', 6, 2, 3926),
(4373, 'Yauyos', '10', 'Yauyos, Lima', 'yauyos lima', 33, 2, 3926);

-- PASO 3: Limpiar tabla actual
DELETE FROM ubicaciones_peru;

-- PASO 4: Insertar departamentos (códigos únicos)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT DISTINCT
    LPAD(d.codigo_ubigeo, 2, '0') as ubigeo,
    LPAD(d.codigo_ubigeo, 2, '0') as dept_codigo,
    LPAD(d.codigo_ubigeo, 2, '0') || '01' as prov_codigo,
    LPAD(d.codigo_ubigeo, 2, '0') || '0101' as dist_codigo,
    UPPER(d.nombre_ubigeo) as departamento,
    UPPER(d.nombre_ubigeo) as provincia,
    UPPER(d.nombre_ubigeo) as distrito,
    'departamento'
FROM ubigeo_temp d
WHERE d.nivel_ubigeo = 1
AND d.id_padre_ubigeo = 2533;

-- PASO 5: Insertar provincias (códigos únicos calculados correctamente)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT DISTINCT
    LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') as ubigeo,
    LPAD(d.codigo_ubigeo, 2, '0') as dept_codigo,
    LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') as prov_codigo,
    LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') || '01' as dist_codigo,
    UPPER(d.nombre_ubigeo) as departamento,
    UPPER(p.nombre_ubigeo) as provincia,
    UPPER(p.nombre_ubigeo) as distrito,
    'provincia'
FROM ubigeo_temp p
INNER JOIN ubigeo_temp d ON p.id_padre_ubigeo = d.id_ubigeo
WHERE p.nivel_ubigeo = 2
AND d.nivel_ubigeo = 1
AND d.id_padre_ubigeo = 2533
-- Evitar duplicados con departamentos
AND LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') NOT IN (
    SELECT ubigeo FROM ubicaciones_peru
);

-- PASO 6: Insertar distritos (códigos únicos calculados correctamente)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT DISTINCT
    LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') || LPAD(dist.codigo_ubigeo, 2, '0') as ubigeo,
    LPAD(d.codigo_ubigeo, 2, '0') as dept_codigo,
    LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') as prov_codigo,
    LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') || LPAD(dist.codigo_ubigeo, 2, '0') as dist_codigo,
    UPPER(d.nombre_ubigeo) as departamento,
    UPPER(p.nombre_ubigeo) as provincia,
    UPPER(dist.nombre_ubigeo) as distrito,
    'distrito'
FROM ubigeo_temp dist
INNER JOIN ubigeo_temp p ON dist.id_padre_ubigeo = p.id_ubigeo
INNER JOIN ubigeo_temp d ON p.id_padre_ubigeo = d.id_ubigeo
WHERE dist.nivel_ubigeo = 3
AND p.nivel_ubigeo = 2
AND d.nivel_ubigeo = 1
AND d.id_padre_ubigeo = 2533
-- Evitar duplicados con departamentos y provincias
AND LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') || LPAD(dist.codigo_ubigeo, 2, '0') NOT IN (
    SELECT ubigeo FROM ubicaciones_peru
);

-- PASO 7: Limpiar tabla temporal
DROP TABLE ubigeo_temp;

-- PASO 8: Verificar resultados
SELECT
    'DEPARTAMENTOS' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'departamento'

UNION ALL

SELECT
    'PROVINCIAS' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'provincia'

UNION ALL

SELECT
    'DISTRITOS' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'distrito';

-- PASO 9: Verificar Lima específicamente
SELECT
    'PROVINCIAS DE LIMA' as info,
    provincia,
    ubigeo
FROM ubicaciones_peru
WHERE nivel = 'provincia'
AND departamento = 'LIMA'
ORDER BY provincia;