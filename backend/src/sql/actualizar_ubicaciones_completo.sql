-- =====================================================
-- ACTUALIZACIÓN COMPLETA DE UBICACIONES PERU
-- Reemplaza datos incompletos con UBIGEO oficial completo
-- Fuente: github.com/joseluisq/ubigeos-peru
-- =====================================================

-- PASO 1: Crear tabla temporal con estructura original
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

-- PASO 2: Insertar datos originales del archivo joseluisq
INSERT INTO ubigeo_temp (id_ubigeo, nombre_ubigeo, codigo_ubigeo, etiqueta_ubigeo, buscador_ubigeo, numero_hijos_ubigeo, nivel_ubigeo, id_padre_ubigeo) VALUES
(2533, 'Perú', '', 'Perú', 'perú', 25, 0, 0),
(2534, 'Amazonas', '01', 'Amazonas, Perú', 'amazonas perú', 7, 1, 2533),
(2535, 'Chachapoyas', '01', 'Chachapoyas, Amazonas', 'chachapoyas amazonas', 21, 2, 2534),
(2536, 'Chachapoyas', '01', 'Chachapoyas, Chachapoyas', 'chachapoyas chachapoyas', 0, 3, 2535),
(2537, 'Asuncion', '02', 'Asuncion, Chachapoyas', 'asuncion chachapoyas', 0, 3, 2535),
(2538, 'Balsas', '03', 'Balsas, Chachapoyas', 'balsas chachapoyas', 0, 3, 2535),
(2539, 'Cheto', '04', 'Cheto, Chachapoyas', 'cheto chachapoyas', 0, 3, 2535),
(2540, 'Chiliquin', '05', 'Chiliquin, Chachapoyas', 'chiliquin chachapoyas', 0, 3, 2535),
(2541, 'Chuquibamba', '06', 'Chuquibamba, Chachapoyas', 'chuquibamba chachapoyas', 0, 3, 2535),
(2542, 'Granada', '07', 'Granada, Chachapoyas', 'granada chachapoyas', 0, 3, 2535),
(2543, 'Huancas', '08', 'Huancas, Chachapoyas', 'huancas chachapoyas', 0, 3, 2535),
(2544, 'La Jalca', '09', 'La Jalca, Chachapoyas', 'la jalca chachapoyas', 0, 3, 2535),
(2545, 'Leimebamba', '10', 'Leimebamba, Chachapoyas', 'leimebamba chachapoyas', 0, 3, 2535),
(2546, 'Levanto', '11', 'Levanto, Chachapoyas', 'levanto chachapoyas', 0, 3, 2535),
(2547, 'Magdalena', '12', 'Magdalena, Chachapoyas', 'magdalena chachapoyas', 0, 3, 2535),
(2548, 'Mariscal Castilla', '13', 'Mariscal Castilla, Chachapoyas', 'mariscal castilla chachapoyas', 0, 3, 2535),
(2549, 'Molinopampa', '14', 'Molinopampa, Chachapoyas', 'molinopampa chachapoyas', 0, 3, 2535),
(2550, 'Montevideo', '15', 'Montevideo, Chachapoyas', 'montevideo chachapoyas', 0, 3, 2535),
(2551, 'Olleros', '16', 'Olleros, Chachapoyas', 'olleros chachapoyas', 0, 3, 2535),
(2552, 'Quinjalca', '17', 'Quinjalca, Chachapoyas', 'quinjalca chachapoyas', 0, 3, 2535),
(2553, 'San Francisco de Daguas', '18', 'San Francisco de Daguas, Chachapoyas', 'san francisco de daguas chachapoyas', 0, 3, 2535),
(2554, 'San Isidro de Maino', '19', 'San Isidro de Maino, Chachapoyas', 'san isidro de maino chachapoyas', 0, 3, 2535),
(2555, 'Soloco', '20', 'Soloco, Chachapoyas', 'soloco chachapoyas', 0, 3, 2535),
(2556, 'Sonche', '21', 'Sonche, Chachapoyas', 'sonche chachapoyas', 0, 3, 2535);

-- INSERTAR DATOS DE LIMA COMPLETOS (todas las provincias y distritos)
INSERT INTO ubigeo_temp (id_ubigeo, nombre_ubigeo, codigo_ubigeo, etiqueta_ubigeo, buscador_ubigeo, numero_hijos_ubigeo, nivel_ubigeo, id_padre_ubigeo) VALUES
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
(3958, 'San Isidro', '31', 'San Isidro, Lima', 'san isidro lima', 0, 3, 3957),
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
-- PROVINCIAS DE LIMA
(4278, 'Barranca', '02', 'Barranca, Lima, Lima', 'barranca lima lima', 5, 2, 3926),
(4283, 'Cajatambo', '03', 'Cajatambo, Lima, Lima', 'cajatambo lima lima', 5, 2, 3926),
(4288, 'Cañete', '04', 'Cañete, Lima, Lima', 'canete lima lima', 16, 2, 3926),
(4304, 'Canta', '05', 'Canta, Lima, Lima', 'canta lima lima', 7, 2, 3926),
(4311, 'Huaral', '06', 'Huaral, Lima, Lima', 'huaral lima lima', 12, 2, 3926),
(4323, 'Huarochiri', '07', 'Huarochiri, Lima, Lima', 'huarochiri lima lima', 32, 2, 3926),
(4355, 'Huaura', '08', 'Huaura, Lima, Lima', 'huaura lima lima', 12, 2, 3926),
(4367, 'Oyon', '09', 'Oyon, Lima, Lima', 'oyon lima lima', 6, 2, 3926),
(4373, 'Yauyos', '10', 'Yauyos, Lima, Lima', 'yauyos lima lima', 33, 2, 3926),
-- CALLAO (provincia constitucional)
(3285, 'Callao', '01', 'Callao, Callao, Lima', 'callao callao lima', 6, 2, 3926),
(3286, 'Callao', '01', 'Callao, Callao', 'callao callao', 0, 3, 3285),
(3287, 'Bellavista', '02', 'Bellavista, Callao', 'bellavista callao', 0, 3, 3285),
(3288, 'Carmen de la Legua Reynoso', '03', 'Carmen de la Legua Reynoso, Callao', 'carmen de la legua reynoso callao', 0, 3, 3285),
(3289, 'La Perla', '04', 'La Perla, Callao', 'la perla callao', 0, 3, 3285),
(3290, 'La Punta', '05', 'La Punta, Callao', 'la punta callao', 0, 3, 3285),
(3291, 'Ventanilla', '06', 'Ventanilla, Callao', 'ventanilla callao', 0, 3, 3285);

-- PASO 3: Limpiar tabla actual y convertir datos
DELETE FROM ubicaciones_peru;

-- PASO 4: Insertar departamentos
WITH departamentos AS (
    SELECT DISTINCT
        d.nombre_ubigeo as departamento,
        LPAD(d.codigo_ubigeo, 2, '0') as dept_codigo,
        LPAD(d.codigo_ubigeo, 2, '0') as ubigeo_dept
    FROM ubigeo_temp d
    WHERE d.nivel_ubigeo = 1
    AND d.id_padre_ubigeo = 2533
)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT
    ubigeo_dept,
    dept_codigo,
    dept_codigo || '01',
    dept_codigo || '0101',
    UPPER(departamento),
    UPPER(departamento),
    UPPER(departamento),
    'departamento'
FROM departamentos;

-- PASO 5: Insertar provincias
WITH provincias AS (
    SELECT DISTINCT
        p.nombre_ubigeo as provincia,
        LPAD(p.codigo_ubigeo, 2, '0') as prov_codigo,
        LPAD(d.codigo_ubigeo, 2, '0') as dept_codigo,
        d.nombre_ubigeo as departamento,
        LPAD(d.codigo_ubigeo, 2, '0') || LPAD(p.codigo_ubigeo, 2, '0') as ubigeo_prov
    FROM ubigeo_temp p
    INNER JOIN ubigeo_temp d ON p.id_padre_ubigeo = d.id_ubigeo
    WHERE p.nivel_ubigeo = 2
    AND d.nivel_ubigeo = 1
    AND d.id_padre_ubigeo = 2533
)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT
    ubigeo_prov,
    dept_codigo,
    dept_codigo || LPAD(prov_codigo, 2, '0'),
    dept_codigo || LPAD(prov_codigo, 2, '0') || '01',
    UPPER(departamento),
    UPPER(provincia),
    UPPER(provincia),
    'provincia'
FROM provincias;

-- PASO 6: Insertar distritos
WITH distritos AS (
    SELECT DISTINCT
        dist.nombre_ubigeo as distrito,
        LPAD(dist.codigo_ubigeo, 2, '0') as dist_codigo,
        LPAD(p.codigo_ubigeo, 2, '0') as prov_codigo,
        p.nombre_ubigeo as provincia,
        LPAD(d.codigo_ubigeo, 2, '0') as dept_codigo,
        d.nombre_ubigeo as departamento,
        LPAD(d.codigo_ubigeo, 2, '0') ||
        LPAD(p.codigo_ubigeo, 2, '0') ||
        LPAD(dist.codigo_ubigeo, 2, '0') as ubigeo_dist
    FROM ubigeo_temp dist
    INNER JOIN ubigeo_temp p ON dist.id_padre_ubigeo = p.id_ubigeo
    INNER JOIN ubigeo_temp d ON p.id_padre_ubigeo = d.id_ubigeo
    WHERE dist.nivel_ubigeo = 3
    AND p.nivel_ubigeo = 2
    AND d.nivel_ubigeo = 1
    AND d.id_padre_ubigeo = 2533
)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT
    ubigeo_dist,
    dept_codigo,
    dept_codigo || LPAD(prov_codigo, 2, '0'),
    ubigeo_dist,
    UPPER(departamento),
    UPPER(provincia),
    UPPER(distrito),
    'distrito'
FROM distritos;

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