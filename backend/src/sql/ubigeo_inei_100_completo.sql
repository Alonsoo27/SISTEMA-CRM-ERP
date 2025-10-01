-- =====================================================
-- UBIGEO PERU 100% COMPLETO - OFICIAL INEI
-- 1,874 distritos + provincias + departamentos
-- Fuente: INEI oficial via geodir/ubigeo-peru
-- =====================================================

-- PASO 1: Crear tabla temporal para CSV
DROP TABLE IF EXISTS ubigeo_csv_temp;

CREATE TABLE ubigeo_csv_temp (
    ubigeo_original VARCHAR(6),
    distrito VARCHAR(100),
    provincia VARCHAR(100),
    departamento VARCHAR(100),
    poblacion VARCHAR(20),
    superficie VARCHAR(20),
    y VARCHAR(20),
    x VARCHAR(20)
);

-- PASO 2: Cargar datos del CSV descargado
-- NOTA: En Supabase necesitarás cargar manualmente el CSV o usar el comando SQL apropiado
-- Por ahora mostraremos la estructura SQL equivalente

-- PASO 3: Limpiar tabla actual (CUIDADO: Esto borra todo)
DELETE FROM ubicaciones_peru;

-- PASO 4: Insertar DEPARTAMENTOS únicos
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT DISTINCT
    LEFT(ubigeo_original, 2) as ubigeo,
    LEFT(ubigeo_original, 2) as dept_codigo,
    LEFT(ubigeo_original, 2) || '01' as prov_codigo,
    LEFT(ubigeo_original, 2) || '0101' as dist_codigo,
    UPPER(departamento) as departamento,
    UPPER(departamento) as provincia,
    UPPER(departamento) as distrito,
    'departamento'
FROM ubigeo_csv_temp
ORDER BY LEFT(ubigeo_original, 2);

-- PASO 5: Insertar PROVINCIAS únicas
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT DISTINCT
    LEFT(ubigeo_original, 4) as ubigeo,
    LEFT(ubigeo_original, 2) as dept_codigo,
    LEFT(ubigeo_original, 4) as prov_codigo,
    LEFT(ubigeo_original, 4) || '01' as dist_codigo,
    UPPER(departamento) as departamento,
    UPPER(provincia) as provincia,
    UPPER(provincia) as distrito,
    'provincia'
FROM ubigeo_csv_temp
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones_peru up
    WHERE up.ubigeo = LEFT(ubigeo_csv_temp.ubigeo_original, 4)
)
ORDER BY LEFT(ubigeo_original, 4);

-- PASO 6: Insertar TODOS LOS DISTRITOS (1,874)
INSERT INTO ubicaciones_peru (
    ubigeo, departamento_codigo, provincia_codigo, distrito_codigo,
    departamento, provincia, distrito, nivel
)
SELECT DISTINCT
    ubigeo_original as ubigeo,
    LEFT(ubigeo_original, 2) as dept_codigo,
    LEFT(ubigeo_original, 4) as prov_codigo,
    ubigeo_original as dist_codigo,
    UPPER(departamento) as departamento,
    UPPER(provincia) as provincia,
    UPPER(distrito) as distrito,
    'distrito'
FROM ubigeo_csv_temp
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones_peru up
    WHERE up.ubigeo = ubigeo_csv_temp.ubigeo_original
)
ORDER BY ubigeo_original;

-- PASO 7: Limpiar tabla temporal
DROP TABLE ubigeo_csv_temp;

-- PASO 8: Verificar resultados 100% completos
SELECT
    'DEPARTAMENTOS' as tipo,
    COUNT(*) as cantidad,
    '25 esperados' as esperado
FROM ubicaciones_peru
WHERE nivel = 'departamento'

UNION ALL

SELECT
    'PROVINCIAS' as tipo,
    COUNT(*) as cantidad,
    '~196 esperadas' as esperado
FROM ubicaciones_peru
WHERE nivel = 'provincia'

UNION ALL

SELECT
    'DISTRITOS' as tipo,
    COUNT(*) as cantidad,
    '1,874 esperados' as esperado
FROM ubicaciones_peru
WHERE nivel = 'distrito'

UNION ALL

SELECT
    'TOTAL REGISTROS' as tipo,
    COUNT(*) as cantidad,
    '~2,095 esperados' as esperado
FROM ubicaciones_peru;

-- PASO 9: Verificar Lima específicamente (debe tener 10 provincias, 43 distritos de Lima Metropolitana)
SELECT
    'LIMA - PROVINCIAS' as info,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'provincia'
AND departamento = 'LIMA'

UNION ALL

SELECT
    'LIMA METROPOLITANA - DISTRITOS' as info,
    COUNT(*) as cantidad
FROM ubicaciones_peru
WHERE nivel = 'distrito'
AND departamento = 'LIMA'
AND provincia = 'LIMA';

-- PASO 10: Mostrar distribución por departamento
SELECT
    departamento,
    COUNT(CASE WHEN nivel = 'provincia' THEN 1 END) as provincias,
    COUNT(CASE WHEN nivel = 'distrito' THEN 1 END) as distritos,
    COUNT(*) as total_ubicaciones
FROM ubicaciones_peru
WHERE nivel IN ('provincia', 'distrito')
GROUP BY departamento
ORDER BY departamento;