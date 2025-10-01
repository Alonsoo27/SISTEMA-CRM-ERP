-- =====================================================
-- MIGRACIÓN: SISTEMA DE LÍNEAS Y SUBLÍNEAS DE PRODUCTOS
-- Fecha: 2025-09-26
-- Descripción: Agrega sublínea y actualiza productos existentes
-- =====================================================

-- 1. AGREGAR COLUMNA SUBLINEA_PRODUCTO
ALTER TABLE productos
ADD COLUMN sublinea_producto VARCHAR(100);

-- 2. CREAR ÍNDICES PARA MEJOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_productos_linea_producto ON productos(linea_producto);
CREATE INDEX IF NOT EXISTS idx_productos_sublinea_producto ON productos(sublinea_producto);
CREATE INDEX IF NOT EXISTS idx_productos_linea_sublinea ON productos(linea_producto, sublinea_producto);

-- 3. FUNCIÓN PARA ASIGNAR LÍNEAS Y SUBLÍNEAS AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION asignar_linea_producto(descripcion_producto TEXT)
RETURNS TABLE(linea VARCHAR(100), sublinea VARCHAR(100)) AS $$
DECLARE
    desc_upper TEXT := UPPER(descripcion_producto);
BEGIN
    -- SACHETEADORAS
    IF desc_upper ~ '(SACHETERA|SACHET)' THEN
        IF desc_upper ~ '(ROLLO|FILM)' THEN
            RETURN QUERY SELECT 'SACHETEADORAS'::VARCHAR(100), 'Rollos Sacheteadoras'::VARCHAR(100);
        ELSIF desc_upper ~ '(COMPRESOR|AUTOMATICA|NEUMATICA)' THEN
            RETURN QUERY SELECT 'SACHETEADORAS'::VARCHAR(100), 'Máquinas Sacheteadoras'::VARCHAR(100);
        ELSIF desc_upper ~ '(REPUESTO|CINTA|MOTOR)' THEN
            RETURN QUERY SELECT 'SACHETEADORAS'::VARCHAR(100), 'Repuestos Sacheteadoras'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'SACHETEADORAS'::VARCHAR(100), 'Accesorios Sacheteadoras'::VARCHAR(100);
        END IF;

    -- DESHIDRATADORAS
    ELSIF desc_upper ~ '(DESHIDRATADORA|DESHIDRATADR)' THEN
        IF desc_upper ~ '(BANDEJA|DISPLAY|TARTEJA)' THEN
            RETURN QUERY SELECT 'DESHIDRATADORAS'::VARCHAR(100), 'Bandejas y Accesorios'::VARCHAR(100);
        ELSIF desc_upper ~ '(KIT|SET)' THEN
            RETURN QUERY SELECT 'DESHIDRATADORAS'::VARCHAR(100), 'Kits Deshidratadoras'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'DESHIDRATADORAS'::VARCHAR(100), 'Máquinas Deshidratadoras'::VARCHAR(100);
        END IF;

    -- MOLINOS
    ELSIF desc_upper ~ '(MOLINO|MOLINILLO|PULVERIZADOR)' THEN
        IF desc_upper ~ '(CAFE|COFFEE)' THEN
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Molinillos de Café'::VARCHAR(100);
        ELSIF desc_upper ~ '(MULTIFUNCIONAL|COLOIDAL|MANTEQUILLADOR)' THEN
            RETURN QUERY SELECT 'MOLINOS'::VARCHAR(100), 'Molinos Multifuncionales'::VARCHAR(100);
        ELSIF desc_upper ~ '(PULVERIZADOR|SMALL|MEDIUM)' THEN
            RETURN QUERY SELECT 'MOLINOS'::VARCHAR(100), 'Molinos Pulverizadores'::VARCHAR(100);
        ELSIF desc_upper ~ '(CUCHILLA|REPUESTO)' THEN
            RETURN QUERY SELECT 'MOLINOS'::VARCHAR(100), 'Repuestos Molinos'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'MOLINOS'::VARCHAR(100), 'Molinos Generales'::VARCHAR(100);
        END IF;

    -- CAFETERAS
    ELSIF desc_upper ~ '(CAFETERA|CAFE|COFFEE|EXPRESS)' THEN
        IF desc_upper ~ '(MOLINILLO|MOLINO)' THEN
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Molinillos de Café'::VARCHAR(100);
        ELSIF desc_upper ~ '(EXPRESS|PROFESIONAL|GRUPO)' THEN
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Máquinas Express'::VARCHAR(100);
        ELSIF desc_upper ~ '(KIT|SET)' THEN
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Kits de Café'::VARCHAR(100);
        ELSIF desc_upper ~ '(TOSTADORA|TOSTADOR)' THEN
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Tostadoras de Café'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Máquinas de Café'::VARCHAR(100);
        END IF;

    -- ENVASADORAS AL VACÍO
    ELSIF desc_upper ~ '(ENVASADORA|EMPACADORA|VACIO|VACÍO)' THEN
        IF desc_upper ~ '(BOLSA|STAND UP)' THEN
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Bolsas al Vacío'::VARCHAR(100);
        ELSIF desc_upper ~ '(ROLLO|FILM|GOFRADO)' THEN
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Rollos al Vacío'::VARCHAR(100);
        ELSIF desc_upper ~ '(FRASCO|POLICARBONATO)' THEN
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Frascos al Vacío'::VARCHAR(100);
        ELSIF desc_upper ~ '(FORMADOR|ACRILICO)' THEN
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Accesorios Envasado'::VARCHAR(100);
        ELSIF desc_upper ~ '(KIT|SET)' THEN
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Kits Envasadoras'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Máquinas Envasadoras'::VARCHAR(100);
        END IF;

    -- LICUADORAS
    ELSIF desc_upper ~ '(LICUADORA|BLENDER|MIX|PROCESADORA)' THEN
        IF desc_upper ~ '(CUCHILLA|VASO|TAPA)' THEN
            RETURN QUERY SELECT 'LICUADORAS'::VARCHAR(100), 'Repuestos Licuadoras'::VARCHAR(100);
        ELSIF desc_upper ~ '(KIT|SET)' THEN
            RETURN QUERY SELECT 'LICUADORAS'::VARCHAR(100), 'Kits Licuadoras'::VARCHAR(100);
        ELSIF desc_upper ~ '(PORTATIL|MINI)' THEN
            RETURN QUERY SELECT 'LICUADORAS'::VARCHAR(100), 'Licuadoras Portátiles'::VARCHAR(100);
        ELSIF desc_upper ~ '(PROFESSIONAL|HEAVY|HIGH)' THEN
            RETURN QUERY SELECT 'LICUADORAS'::VARCHAR(100), 'Licuadoras Profesionales'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'LICUADORAS'::VARCHAR(100), 'Licuadoras Generales'::VARCHAR(100);
        END IF;

    -- VASOS DESECHABLES
    ELSIF desc_upper ~ '(VASO|VASOS|CUP|COFFE|COLD)' THEN
        IF desc_upper ~ '(COMPOSTABLE|PAPEL)' THEN
            RETURN QUERY SELECT 'VASOS DESECHABLES'::VARCHAR(100), 'Vasos de Papel'::VARCHAR(100);
        ELSIF desc_upper ~ '(PP|POLIPAPEL|SHAPED)' THEN
            RETURN QUERY SELECT 'VASOS DESECHABLES'::VARCHAR(100), 'Vasos de Plástico'::VARCHAR(100);
        ELSIF desc_upper ~ '(TAPA|DOMO)' THEN
            RETURN QUERY SELECT 'VASOS DESECHABLES'::VARCHAR(100), 'Tapas y Accesorios'::VARCHAR(100);
        ELSIF desc_upper ~ '(DISEÑO|COLOR)' THEN
            RETURN QUERY SELECT 'VASOS DESECHABLES'::VARCHAR(100), 'Vasos Personalizados'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'VASOS DESECHABLES'::VARCHAR(100), 'Vasos Generales'::VARCHAR(100);
        END IF;

    -- FREIDORAS
    ELSIF desc_upper ~ '(FREIDORA|FREIR)' THEN
        IF desc_upper ~ '(AIRE|AIR)' THEN
            RETURN QUERY SELECT 'FREIDORAS'::VARCHAR(100), 'Freidoras de Aire'::VARCHAR(100);
        ELSIF desc_upper ~ '(GAS|DOBLE)' THEN
            RETURN QUERY SELECT 'FREIDORAS'::VARCHAR(100), 'Freidoras a Gas'::VARCHAR(100);
        ELSIF desc_upper ~ '(ELECTRICA|TANQUE)' THEN
            RETURN QUERY SELECT 'FREIDORAS'::VARCHAR(100), 'Freidoras Eléctricas'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'FREIDORAS'::VARCHAR(100), 'Freidoras Generales'::VARCHAR(100);
        END IF;

    -- PARRILLAS Y GRILLS
    ELSIF desc_upper ~ '(BBQ|GRILL|PARRILLA|PLANCHA|SARTEN|HIBACHI)' THEN
        IF desc_upper ~ '(BBQ|GRILL)' THEN
            RETURN QUERY SELECT 'PARRILLAS'::VARCHAR(100), 'Parrillas BBQ'::VARCHAR(100);
        ELSIF desc_upper ~ '(PLANCHA|GRILL|PANINI)' THEN
            RETURN QUERY SELECT 'PARRILLAS'::VARCHAR(100), 'Planchas Grill'::VARCHAR(100);
        ELSIF desc_upper ~ '(SARTEN|HIBACHI|SKILLETS)' THEN
            RETURN QUERY SELECT 'PARRILLAS'::VARCHAR(100), 'Sartenes Especiales'::VARCHAR(100);
        ELSIF desc_upper ~ '(COCINA|CARBON|LEÑA)' THEN
            RETURN QUERY SELECT 'PARRILLAS'::VARCHAR(100), 'Cocinas a Carbón'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'PARRILLAS'::VARCHAR(100), 'Parrillas Generales'::VARCHAR(100);
        END IF;

    -- DISPENSADORES
    ELSIF desc_upper ~ '(DISPENSADOR|DISPENSER)' THEN
        IF desc_upper ~ '(AGUA|WATER|BUCKET)' THEN
            RETURN QUERY SELECT 'DISPENSADORES'::VARCHAR(100), 'Dispensadores de Agua'::VARCHAR(100);
        ELSIF desc_upper ~ '(CHOCOLATE|CALENTADOR)' THEN
            RETURN QUERY SELECT 'DISPENSADORES'::VARCHAR(100), 'Dispensadores de Chocolate'::VARCHAR(100);
        ELSIF desc_upper ~ '(CAPSULA|CHICLES|JUGUETES)' THEN
            RETURN QUERY SELECT 'DISPENSADORES'::VARCHAR(100), 'Dispensadores de Cápsulas'::VARCHAR(100);
        ELSIF desc_upper ~ '(BASE|DISPLAY|TRIPLE)' THEN
            RETURN QUERY SELECT 'DISPENSADORES'::VARCHAR(100), 'Accesorios Dispensadores'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'DISPENSADORES'::VARCHAR(100), 'Dispensadores Generales'::VARCHAR(100);
        END IF;

    -- SELLADORAS
    ELSIF desc_upper ~ '(SELLADORA|SELLADOR)' THEN
        IF desc_upper ~ '(VASO|CUP)' THEN
            RETURN QUERY SELECT 'SELLADORAS'::VARCHAR(100), 'Selladoras de Vasos'::VARCHAR(100);
        ELSIF desc_upper ~ '(BANDA|CONTINUA)' THEN
            RETURN QUERY SELECT 'SELLADORAS'::VARCHAR(100), 'Selladoras de Banda'::VARCHAR(100);
        ELSIF desc_upper ~ '(BANDEJA|TAPER|BOLW)' THEN
            RETURN QUERY SELECT 'SELLADORAS'::VARCHAR(100), 'Selladoras de Bandejas'::VARCHAR(100);
        ELSIF desc_upper ~ '(INDUCCION|TERMOENCOGIBLE)' THEN
            RETURN QUERY SELECT 'SELLADORAS'::VARCHAR(100), 'Selladoras Especializadas'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'SELLADORAS'::VARCHAR(100), 'Selladoras Generales'::VARCHAR(100);
        END IF;

    -- WAFLERAS
    ELSIF desc_upper ~ '(WAFLERA|WAFFLE|DONUT|BUBBLE)' THEN
        IF desc_upper ~ '(DONUT|DONA)' THEN
            RETURN QUERY SELECT 'WAFLERAS'::VARCHAR(100), 'Máquinas de Donut'::VARCHAR(100);
        ELSIF desc_upper ~ '(BUBBLE|BURBUJA)' THEN
            RETURN QUERY SELECT 'WAFLERAS'::VARCHAR(100), 'Wafleras Bubble'::VARCHAR(100);
        ELSIF desc_upper ~ '(HEART|FISH|LOLLY|REFRACTARIA)' THEN
            RETURN QUERY SELECT 'WAFLERAS'::VARCHAR(100), 'Wafleras Especiales'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'WAFLERAS'::VARCHAR(100), 'Wafleras Circulares'::VARCHAR(100);
        END IF;

    -- KITS COMPLETOS
    ELSIF desc_upper ~ '(KIT|SET)' THEN
        IF desc_upper ~ 'CAFE' THEN
            RETURN QUERY SELECT 'CAFETERAS'::VARCHAR(100), 'Kits de Café'::VARCHAR(100);
        ELSIF desc_upper ~ 'DESHIDRATADORA' THEN
            RETURN QUERY SELECT 'DESHIDRATADORAS'::VARCHAR(100), 'Kits Deshidratadoras'::VARCHAR(100);
        ELSIF desc_upper ~ 'ENVASADORA' THEN
            RETURN QUERY SELECT 'ENVASADORAS'::VARCHAR(100), 'Kits Envasadoras'::VARCHAR(100);
        ELSIF desc_upper ~ 'LICUADORA' THEN
            RETURN QUERY SELECT 'LICUADORAS'::VARCHAR(100), 'Kits Licuadoras'::VARCHAR(100);
        ELSIF desc_upper ~ '(MACETA|RIEGO|SUCULENTA)' THEN
            RETURN QUERY SELECT 'KITS ESPECIALES'::VARCHAR(100), 'Kits de Jardinería'::VARCHAR(100);
        ELSIF desc_upper ~ '(TE|TAZA|FLAMINGO)' THEN
            RETURN QUERY SELECT 'KITS ESPECIALES'::VARCHAR(100), 'Sets de Mesa'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'KITS ESPECIALES'::VARCHAR(100), 'Kits Generales'::VARCHAR(100);
        END IF;

    -- CONSERVACIÓN Y LIOFILIZACIÓN
    ELSIF desc_upper ~ '(LIOFILIZADORA|FROSTDRY|FROSTY)' THEN
        RETURN QUERY SELECT 'CONSERVACION'::VARCHAR(100), 'Liofilizadoras'::VARCHAR(100);

    ELSIF desc_upper ~ '(INCUBADORA|EGG)' THEN
        RETURN QUERY SELECT 'CONSERVACION'::VARCHAR(100), 'Incubadoras'::VARCHAR(100);

    -- BANDEJAS Y RECIPIENTES
    ELSIF desc_upper ~ '(BANDEJA|FOOD|BOLW)' THEN
        IF desc_upper ~ '(FOOD|DIVISIONES)' THEN
            RETURN QUERY SELECT 'RECIPIENTES'::VARCHAR(100), 'Bandejas Food'::VARCHAR(100);
        ELSIF desc_upper ~ 'BOLW' THEN
            RETURN QUERY SELECT 'RECIPIENTES'::VARCHAR(100), 'Bowls'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'RECIPIENTES'::VARCHAR(100), 'Bandejas Generales'::VARCHAR(100);
        END IF;

    -- MÁQUINAS ESPECIALIZADAS
    ELSIF desc_upper ~ '(HELADOS|HELADO)' THEN
        RETURN QUERY SELECT 'MAQUINAS ESPECIALIZADAS'::VARCHAR(100), 'Máquinas de Helados'::VARCHAR(100);

    ELSIF desc_upper ~ '(YOGURT|FERMENTADORA)' THEN
        RETURN QUERY SELECT 'MAQUINAS ESPECIALIZADAS'::VARCHAR(100), 'Máquinas de Yogurt'::VARCHAR(100);

    ELSIF desc_upper ~ '(ALGODON|AZUCAR|POP CORN|RASPADILLA)' THEN
        RETURN QUERY SELECT 'MAQUINAS ESPECIALIZADAS'::VARCHAR(100), 'Máquinas de Dulces'::VARCHAR(100);

    ELSIF desc_upper ~ '(CREPERA|CREPE)' THEN
        RETURN QUERY SELECT 'MAQUINAS ESPECIALIZADAS'::VARCHAR(100), 'Creperas'::VARCHAR(100);

    -- ACCESORIOS Y REPUESTOS
    ELSIF desc_upper ~ '(REPUESTO|CUCHILLA|TEFLON|FILTRO|ACEITE|CARTUCHO)' THEN
        IF desc_upper ~ '(CUCHILLA|EXTRACTORA)' THEN
            RETURN QUERY SELECT 'ACCESORIOS'::VARCHAR(100), 'Cuchillas y Repuestos'::VARCHAR(100);
        ELSIF desc_upper ~ '(TEFLON|TEFLÓN)' THEN
            RETURN QUERY SELECT 'ACCESORIOS'::VARCHAR(100), 'Teflones'::VARCHAR(100);
        ELSIF desc_upper ~ '(FILTRO|PURIFICADOR)' THEN
            RETURN QUERY SELECT 'ACCESORIOS'::VARCHAR(100), 'Filtros'::VARCHAR(100);
        ELSIF desc_upper ~ '(ROLLO|TERMICO|PAPEL)' THEN
            RETURN QUERY SELECT 'ACCESORIOS'::VARCHAR(100), 'Rollos y Consumibles'::VARCHAR(100);
        ELSE
            RETURN QUERY SELECT 'ACCESORIOS'::VARCHAR(100), 'Repuestos Generales'::VARCHAR(100);
        END IF;

    -- BALANZAS Y EQUIPOS DE MEDICIÓN
    ELSIF desc_upper ~ '(BALANZA|TICKETERA|REGISTRADORA)' THEN
        RETURN QUERY SELECT 'EQUIPOS MEDICION'::VARCHAR(100), 'Balanzas'::VARCHAR(100);

    ELSIF desc_upper ~ '(TERMOMETRO|PRECISION)' THEN
        RETURN QUERY SELECT 'EQUIPOS MEDICION'::VARCHAR(100), 'Termómetros'::VARCHAR(100);

    -- OTROS EQUIPOS
    ELSIF desc_upper ~ '(EXHIBIDOR|DISPLAY)' THEN
        RETURN QUERY SELECT 'EXHIBICION'::VARCHAR(100), 'Exhibidores'::VARCHAR(100);

    ELSIF desc_upper ~ '(HORNO|PIZZA)' THEN
        RETURN QUERY SELECT 'HORNOS'::VARCHAR(100), 'Hornos'::VARCHAR(100);

    ELSIF desc_upper ~ '(MACETERO|INVERNADERO|RIEGO)' THEN
        RETURN QUERY SELECT 'JARDINERIA'::VARCHAR(100), 'Equipos de Jardinería'::VARCHAR(100);

    -- OTROS Y GENERALES
    ELSE
        RETURN QUERY SELECT 'OTROS'::VARCHAR(100), 'Productos Generales'::VARCHAR(100);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. ACTUALIZAR PRODUCTOS EXISTENTES CON LÍNEAS Y SUBLÍNEAS
UPDATE productos
SET (linea_producto, sublinea_producto) = (
    SELECT linea, sublinea
    FROM asignar_linea_producto(productos.descripcion)
)
WHERE linea_producto IS NULL OR linea_producto = '';

-- 5. CREAR TRIGGER PARA PRODUCTOS NUEVOS
CREATE OR REPLACE FUNCTION trigger_asignar_lineas()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo asignar si no tiene línea o está vacía
    IF NEW.linea_producto IS NULL OR NEW.linea_producto = '' THEN
        SELECT linea, sublinea
        INTO NEW.linea_producto, NEW.sublinea_producto
        FROM asignar_linea_producto(NEW.descripcion);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS tr_asignar_lineas_productos ON productos;
CREATE TRIGGER tr_asignar_lineas_productos
    BEFORE INSERT OR UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_asignar_lineas();

-- 6. COMENTARIOS PARA DOCUMENTACIÓN
COMMENT ON COLUMN productos.linea_producto IS 'Línea principal del producto (ej: SACHETEADORAS, CAFETERAS)';
COMMENT ON COLUMN productos.sublinea_producto IS 'Sublínea específica del producto (ej: Máquinas Sacheteadoras, Rollos Sacheteadoras)';
COMMENT ON FUNCTION asignar_linea_producto(TEXT) IS 'Función que asigna línea y sublínea basada en la descripción del producto';
COMMENT ON TRIGGER tr_asignar_lineas_productos ON productos IS 'Trigger que asigna automáticamente líneas a productos nuevos o actualizados';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================