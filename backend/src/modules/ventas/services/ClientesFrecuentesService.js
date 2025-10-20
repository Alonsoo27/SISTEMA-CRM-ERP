// ============================================
// CLIENTES FRECUENTES SERVICE
// Sistema CRM/ERP - Gestión de Clientes Frecuentes
// ============================================

const { query } = require('../../../config/database');

const ID_USUARIO_EMPRESA = 19; // Usuario EMPRESA S.A.C.

// ============================================
// VERIFICAR SI TODAS LAS LÍNEAS SON FRECUENTES
// ============================================
/**
 * Verifica si TODAS las líneas de productos de categoría PLASTICO
 * en la venta son líneas frecuentes para el cliente.
 *
 * Regla: Un cliente es frecuente en una línea cuando tiene 3+ compras
 * de esa línea en productos de categoría PLASTICO.
 *
 * @param {number} clienteId - ID del cliente
 * @param {Array} productos - Array de productos [{producto_id, cantidad, ...}]
 * @returns {Promise<{todasFrecuentes: boolean, detalles: Array}>}
 */
exports.verificarTodasLineasFrecuentes = async (clienteId, productos) => {
    try {
        console.log('🔍 [ClientesFrecuentes] Verificando líneas frecuentes para cliente:', clienteId);

        // Si no hay cliente, no puede ser frecuente
        if (!clienteId) {
            return {
                todasFrecuentes: false,
                detalles: [],
                mensaje: 'Sin cliente asignado'
            };
        }

        // Si no hay productos, no aplicar lógica
        if (!productos || productos.length === 0) {
            return {
                todasFrecuentes: false,
                detalles: [],
                mensaje: 'Sin productos en la venta'
            };
        }

        // 1. Obtener productos de la base de datos con su línea y categoría
        const productosIds = productos.map(p => p.producto_id || p.id).filter(Boolean);

        if (productosIds.length === 0) {
            return {
                todasFrecuentes: false,
                detalles: [],
                mensaje: 'No se pudieron extraer IDs de productos'
            };
        }

        const productosInfoResult = await query(`
            SELECT
                p.id,
                p.codigo,
                p.descripcion,
                p.linea_producto,
                c.nombre as categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = ANY($1::uuid[])
        `, [productosIds]);

        const productosInfo = productosInfoResult.rows;

        console.log('📦 Productos encontrados:', productosInfo.length);

        // 2. Filtrar solo productos de categoría PLASTICO
        const productosPlastico = productosInfo.filter(p =>
            p.categoria_nombre && p.categoria_nombre.toUpperCase() === 'PLASTICO'
        );

        console.log('🔹 Productos de categoría PLASTICO:', productosPlastico.length);

        // Si no hay productos de plástico, la venta NO tiene restricción
        if (productosPlastico.length === 0) {
            return {
                todasFrecuentes: false,
                detalles: [],
                mensaje: 'No hay productos de categoría PLASTICO en la venta'
            };
        }

        // 3. Obtener líneas únicas de productos de plástico
        const lineasUnicas = [...new Set(
            productosPlastico
                .map(p => p.linea_producto)
                .filter(Boolean)
        )];

        console.log('📊 Líneas únicas de PLASTICO:', lineasUnicas);

        // Si alguna línea es null/undefined, no podemos determinar frecuencia
        const hayLineasSinDefinir = productosPlastico.some(p => !p.linea_producto);
        if (hayLineasSinDefinir) {
            console.log('⚠️ Hay productos de PLASTICO sin línea definida');
            return {
                todasFrecuentes: false,
                detalles: productosPlastico.map(p => ({
                    producto_id: p.id,
                    linea: p.linea_producto,
                    categoria: p.categoria_nombre,
                    es_frecuente: false,
                    razon: 'Línea no definida'
                })),
                mensaje: 'Productos sin línea definida'
            };
        }

        // 4. Consultar tabla de clientes_lineas_frecuentes
        const frecuenciasResult = await query(`
            SELECT
                linea_producto,
                total_compras,
                es_frecuente,
                ultima_compra_fecha
            FROM clientes_lineas_frecuentes
            WHERE cliente_id = $1
            AND linea_producto = ANY($2::varchar[])
        `, [clienteId, lineasUnicas]);

        const frecuencias = frecuenciasResult.rows;

        console.log('📈 Frecuencias encontradas:', frecuencias);

        // 5. Verificar cada línea
        const detalles = lineasUnicas.map(linea => {
            const frecuencia = frecuencias.find(f => f.linea_producto === linea);

            const esFrecuente = frecuencia ? frecuencia.es_frecuente : false;

            return {
                linea: linea,
                es_frecuente: esFrecuente,
                total_compras: frecuencia ? parseInt(frecuencia.total_compras) : 0,
                ultima_compra: frecuencia ? frecuencia.ultima_compra_fecha : null,
                razon: esFrecuente
                    ? `Cliente frecuente (${frecuencia.total_compras} compras previas)`
                    : frecuencia
                        ? `No frecuente (${frecuencia.total_compras} compras previas)`
                        : 'Sin compras previas'
            };
        });

        // 6. Determinar si TODAS son frecuentes
        const todasFrecuentes = detalles.every(d => d.es_frecuente);

        console.log('✅ Resultado:', todasFrecuentes ? 'TODAS FRECUENTES → EMPRESA' : 'AL MENOS UNA NO FRECUENTE → ASESOR');

        return {
            todasFrecuentes,
            detalles,
            mensaje: todasFrecuentes
                ? `Todas las líneas (${lineasUnicas.join(', ')}) son frecuentes`
                : 'Al menos una línea no es frecuente'
        };

    } catch (error) {
        console.error('❌ Error en verificarTodasLineasFrecuentes:', error);
        // En caso de error, asignar al asesor por defecto
        return {
            todasFrecuentes: false,
            detalles: [],
            error: error.message
        };
    }
};

// ============================================
// ACTUALIZAR LÍNEAS FRECUENTES POST-VENTA
// ============================================
/**
 * Actualiza la tabla clientes_lineas_frecuentes después de crear una venta.
 * Incrementa contadores y marca como frecuente si alcanza 3+ compras.
 *
 * @param {number} ventaId - ID de la venta recién creada
 * @returns {Promise<{success: boolean, actualizaciones: Array}>}
 */
exports.actualizarLineasFrecuentes = async (ventaId) => {
    try {
        console.log('🔄 [ClientesFrecuentes] Actualizando líneas frecuentes para venta:', ventaId);

        // 1. Obtener datos de la venta con productos
        const ventaResult = await query(`
            SELECT
                v.id,
                v.cliente_id,
                v.fecha_venta,
                v.asesor_id
            FROM ventas v
            WHERE v.id = $1
        `, [ventaId]);

        if (ventaResult.rows.length === 0) {
            console.log('⚠️ Venta no encontrada');
            return { success: false, mensaje: 'Venta no encontrada' };
        }

        const venta = ventaResult.rows[0];

        // Si no hay cliente, no actualizar
        if (!venta.cliente_id) {
            console.log('⚠️ Venta sin cliente asignado');
            return { success: false, mensaje: 'Venta sin cliente asignado' };
        }

        // Si la venta ya fue asignada a EMPRESA, no contar para incrementar
        // (esto evita que una venta de cliente frecuente se cuente a sí misma)
        const esVentaEmpresa = parseInt(venta.asesor_id) === ID_USUARIO_EMPRESA;

        // 2. Obtener productos de la venta con línea y categoría
        const productosResult = await query(`
            SELECT
                p.id,
                p.linea_producto,
                c.nombre as categoria_nombre,
                vd.cantidad
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE vd.venta_id = $1
            AND vd.activo = true
        `, [ventaId]);

        const productos = productosResult.rows;

        console.log(`📦 Productos en venta: ${productos.length}`);

        // 3. Filtrar productos de categoría PLASTICO
        const productosPlastico = productos.filter(p =>
            p.categoria_nombre && p.categoria_nombre.toUpperCase() === 'PLASTICO'
        );

        console.log(`🔹 Productos PLASTICO: ${productosPlastico.length}`);

        if (productosPlastico.length === 0) {
            return {
                success: true,
                mensaje: 'No hay productos de PLASTICO para actualizar',
                actualizaciones: []
            };
        }

        // 4. Obtener líneas únicas
        const lineasUnicas = [...new Set(
            productosPlastico
                .map(p => p.linea_producto)
                .filter(Boolean)
        )];

        const añoActual = new Date().getFullYear();
        const fechaVenta = venta.fecha_venta || new Date();

        const actualizaciones = [];

        // 5. Actualizar cada línea
        for (const linea of lineasUnicas) {
            try {
                // Contar TODAS las compras previas del cliente en esta línea
                const comprasPreviasResult = await query(`
                    SELECT COUNT(DISTINCT v.id) as total
                    FROM ventas v
                    INNER JOIN venta_detalles vd ON v.id = vd.venta_id
                    INNER JOIN productos p ON vd.producto_id = p.id
                    INNER JOIN categorias c ON p.categoria_id = c.id
                    WHERE v.cliente_id = $1
                    AND p.linea_producto = $2
                    AND c.nombre ILIKE 'PLASTICO'
                    AND v.activo = true
                    AND vd.activo = true
                `, [venta.cliente_id, linea]);

                const totalCompras = parseInt(comprasPreviasResult.rows[0].total);
                const esFrecuente = totalCompras >= 3;

                console.log(`📊 Línea "${linea}": ${totalCompras} compras → ${esFrecuente ? 'FRECUENTE' : 'NO FRECUENTE'}`);

                // Upsert en la tabla
                await query(`
                    INSERT INTO clientes_lineas_frecuentes (
                        cliente_id, linea_producto, año, total_compras, es_frecuente,
                        primera_compra_fecha, ultima_compra_fecha, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                    ON CONFLICT (cliente_id, linea_producto, año)
                    DO UPDATE SET
                        total_compras = $4,
                        es_frecuente = $5,
                        ultima_compra_fecha = $7,
                        updated_at = NOW()
                `, [
                    venta.cliente_id,
                    linea,
                    añoActual,
                    totalCompras,
                    esFrecuente,
                    fechaVenta,
                    fechaVenta
                ]);

                actualizaciones.push({
                    linea,
                    total_compras: totalCompras,
                    es_frecuente: esFrecuente,
                    cambio: esFrecuente && totalCompras === 3 ? 'NUEVO_FRECUENTE' : 'ACTUALIZADO'
                });

            } catch (error) {
                console.error(`❌ Error actualizando línea ${linea}:`, error.message);
                actualizaciones.push({
                    linea,
                    error: error.message
                });
            }
        }

        console.log('✅ Actualización completada:', actualizaciones);

        return {
            success: true,
            venta_id: ventaId,
            cliente_id: venta.cliente_id,
            actualizaciones
        };

    } catch (error) {
        console.error('❌ Error en actualizarLineasFrecuentes:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ============================================
// OBTENER HISTORIAL DE CLIENTE POR LÍNEA
// ============================================
/**
 * Consulta el historial completo de compras de un cliente
 * desglosado por líneas de producto de categoría PLASTICO.
 *
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<Array>}
 */
exports.obtenerHistorialLineasCliente = async (clienteId) => {
    try {
        const result = await query(`
            SELECT
                linea_producto,
                año,
                total_compras,
                es_frecuente,
                primera_compra_fecha,
                ultima_compra_fecha,
                created_at,
                updated_at
            FROM clientes_lineas_frecuentes
            WHERE cliente_id = $1
            ORDER BY año DESC, linea_producto ASC
        `, [clienteId]);

        return result.rows;

    } catch (error) {
        console.error('❌ Error en obtenerHistorialLineasCliente:', error);
        return [];
    }
};

console.log('✅ ClientesFrecuentesService loaded successfully');

module.exports = exports;
