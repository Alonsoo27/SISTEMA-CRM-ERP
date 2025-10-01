-- =====================================================
-- SCRIPT PARA CONVERTIR DATOS UBIGEO COMPLETOS
-- Convierte la estructura de joseluisq/ubigeos-peru a nuestra estructura
-- =====================================================

-- 1. PRIMERO: Crear tabla temporal con la estructura original
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

-- 2. CARGAR DATOS DEL ARCHIVO DESCARGADO
-- (Aquí insertaremos los datos del archivo ubigeo_completo.sql)

-- 3. LIMPIAR TABLA ACTUAL
DELETE FROM ubicaciones_peru;

-- 4. CONVERTIR Y INSERTAR DATOS DEPARTAMENTOS
WITH departamentos AS (
    SELECT DISTINCT
        d.id_ubigeo,
        d.nombre_ubigeo as departamento,
        d.codigo_ubigeo as dept_codigo,
        LPAD(d.codigo_ubigeo::text, 2, '0') as ubigeo_dept
    FROM ubigeo_temp d
    WHERE d.nivel_ubigeo = 1 -- Departamentos
    AND d.id_padre_ubigeo = 2533 -- Perú
)
INSERT INTO ubicaciones_peru (
    ubigeo,
    departamento_codigo,
    provincia_codigo,
    distrito_codigo,
    departamento,
    provincia,
    distrito,
    nivel
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

-- 5. CONVERTIR Y INSERTAR DATOS PROVINCIAS
WITH provincias AS (
    SELECT DISTINCT
        p.id_ubigeo,
        p.nombre_ubigeo as provincia,
        p.codigo_ubigeo as prov_codigo,
        d.codigo_ubigeo as dept_codigo,
        d.nombre_ubigeo as departamento,
        LPAD(d.codigo_ubigeo::text, 2, '0') || LPAD(p.codigo_ubigeo::text, 2, '0') as ubigeo_prov
    FROM ubigeo_temp p
    INNER JOIN ubigeo_temp d ON p.id_padre_ubigeo = d.id_ubigeo
    WHERE p.nivel_ubigeo = 2 -- Provincias
    AND d.nivel_ubigeo = 1 -- Sus padres son departamentos
    AND d.id_padre_ubigeo = 2533 -- Perú
)
INSERT INTO ubicaciones_peru (
    ubigeo,
    departamento_codigo,
    provincia_codigo,
    distrito_codigo,
    departamento,
    provincia,
    distrito,
    nivel
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

-- 6. CONVERTIR Y INSERTAR DATOS DISTRITOS
WITH distritos AS (
    SELECT DISTINCT
        dist.id_ubigeo,
        dist.nombre_ubigeo as distrito,
        dist.codigo_ubigeo as dist_codigo,
        p.codigo_ubigeo as prov_codigo,
        p.nombre_ubigeo as provincia,
        d.codigo_ubigeo as dept_codigo,
        d.nombre_ubigeo as departamento,
        LPAD(d.codigo_ubigeo::text, 2, '0') ||
        LPAD(p.codigo_ubigeo::text, 2, '0') ||
        LPAD(dist.codigo_ubigeo::text, 2, '0') as ubigeo_dist
    FROM ubigeo_temp dist
    INNER JOIN ubigeo_temp p ON dist.id_padre_ubigeo = p.id_ubigeo
    INNER JOIN ubigeo_temp d ON p.id_padre_ubigeo = d.id_ubigeo
    WHERE dist.nivel_ubigeo = 3 -- Distritos
    AND p.nivel_ubigeo = 2 -- Sus padres son provincias
    AND d.nivel_ubigeo = 1 -- Sus abuelos son departamentos
    AND d.id_padre_ubigeo = 2533 -- Perú
)
INSERT INTO ubicaciones_peru (
    ubigeo,
    departamento_codigo,
    provincia_codigo,
    distrito_codigo,
    departamento,
    provincia,
    distrito,
    nivel
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

-- 7. LIMPIAR TABLA TEMPORAL
DROP TABLE ubigeo_temp;

-- 8. VERIFICAR RESULTADOS
SELECT
    'TOTAL DEPARTAMENTOS' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'departamento'

UNION ALL

SELECT
    'TOTAL PROVINCIAS' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'provincia'

UNION ALL

SELECT
    'TOTAL DISTRITOS' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'distrito'

UNION ALL

SELECT
    'PROVINCIAS LIMA' as tipo,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'provincia'
AND departamento = 'LIMA';

-- 9. MOSTRAR PROVINCIAS DE LIMA PARA VERIFICAR
SELECT
    provincia,
    ubigeo,
    provincia_codigo
FROM ubicaciones_peru
WHERE nivel = 'provincia'
AND departamento = 'LIMA'
ORDER BY provincia;