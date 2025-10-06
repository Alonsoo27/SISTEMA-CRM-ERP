-- ============================================
-- MIGRACIÓN: Agregar campos de IGV a tabla ventas
-- Fecha: 2025-10-05
-- Propósito: Permitir control de IGV para cuadres fiscales
-- ============================================

-- 1. Agregar columna para indicar si el precio incluye IGV
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS incluye_igv BOOLEAN DEFAULT true;

-- 2. Agregar columna para base imponible (precio sin IGV)
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS base_imponible NUMERIC(10,2);

-- 3. Agregar columna para monto de IGV
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS igv_monto NUMERIC(10,2);

-- 4. Agregar comentarios para documentación
COMMENT ON COLUMN ventas.incluye_igv IS 'Indica si el valor_final incluye IGV (18%). TRUE para Factura/Boleta, FALSE para Nota de Venta';
COMMENT ON COLUMN ventas.base_imponible IS 'Monto sin IGV. Calculado como: valor_final / 1.18 si incluye_igv=true';
COMMENT ON COLUMN ventas.igv_monto IS 'Monto del IGV (18%). Calculado como: valor_final - base_imponible';

-- 5. Actualizar registros existentes
-- Asumiendo que las ventas existentes tipo 'factura' o 'boleta' incluyen IGV
UPDATE ventas
SET
    incluye_igv = CASE
        WHEN tipo_venta IN ('factura', 'boleta') THEN true
        ELSE false
    END,
    base_imponible = CASE
        WHEN tipo_venta IN ('factura', 'boleta') THEN ROUND(valor_final / 1.18, 2)
        ELSE valor_final
    END,
    igv_monto = CASE
        WHEN tipo_venta IN ('factura', 'boleta') THEN ROUND(valor_final - (valor_final / 1.18), 2)
        ELSE 0
    END
WHERE incluye_igv IS NULL;

-- 6. Verificar resultados
SELECT
    tipo_venta,
    COUNT(*) as cantidad,
    SUM(valor_final) as total_con_igv,
    SUM(base_imponible) as total_sin_igv,
    SUM(igv_monto) as total_igv
FROM ventas
WHERE activo = true
GROUP BY tipo_venta
ORDER BY tipo_venta;

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- * valor_final SIEMPRE es el precio total que paga el cliente
-- * Las comisiones y metas SIGUEN usando valor_final (sin cambios)
-- * base_imponible e igv_monto son SOLO para reportes fiscales
-- * incluye_igv se marca automáticamente según tipo_venta:
--   - factura: true (precio incluye IGV 18%)
--   - boleta: true (precio incluye IGV 18%)
--   - nota_venta: false (precio sin IGV)
-- ============================================
