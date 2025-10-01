// MIGRADO: Removido Supabase import
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const winston = require('winston');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const { query } = require('../../../config/database');

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'almacen-service' },
    transports: [
        new winston.transports.File({ filename: 'logs/almacen-service.log' }),
        new winston.transports.Console()
    ]
});

// ==================== FUNCIONES PARA CONTROLADOR ====================

/**
 * Obtener métricas completas del dashboard
 */
const obtenerDashboardMetricas = async (almacen_id = null) => {
    try {
        // Obtener todas las métricas en paralelo
        const [
            productosConStockResult,
            productosStockBajoResult,
            productosAgotadosResult,
            valorTotalResult,
            movimientosDiaResult,
            alertasActivasResult,
            despachosPendientesResult,
            despachosDiaResult
        ] = await Promise.all([
            // Total productos con stock
            query(`
                SELECT COUNT(*) as total 
                FROM vista_inventario_completo 
                WHERE stock_actual > 0 
                ${almacen_id ? 'AND almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Productos con stock bajo
            query(`
                SELECT COUNT(*) as total 
                FROM vista_inventario_completo 
                WHERE estado_stock = 'BAJO'
                ${almacen_id ? 'AND almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Productos agotados
            query(`
                SELECT COUNT(*) as total 
                FROM vista_inventario_completo 
                WHERE estado_stock = 'AGOTADO'
                ${almacen_id ? 'AND almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Valor total de inventario
            query(`
                SELECT COALESCE(SUM(valor_inventario), 0) as total 
                FROM vista_inventario_completo
                ${almacen_id ? 'WHERE almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Movimientos del día
            query(`
                SELECT COUNT(*) as total 
                FROM movimientos_inventario 
                WHERE fecha_movimiento >= CURRENT_DATE
                ${almacen_id ? 'AND (almacen_origen_id = $1 OR almacen_destino_id = $1)' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Alertas activas
            query(`
                SELECT COUNT(*) as total 
                FROM alertas_inventario 
                WHERE activa = true
                ${almacen_id ? 'AND almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Despachos pendientes
            query(`
                SELECT COUNT(*) as total 
                FROM despachos 
                WHERE activo = true AND estado IN ('PENDIENTE', 'PREPARANDO')
                ${almacen_id ? 'AND almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : []),

            // Despachos del día
            query(`
                SELECT COUNT(*) as total 
                FROM despachos 
                WHERE activo = true AND fecha_programada = CURRENT_DATE
                ${almacen_id ? 'AND almacen_id = $1' : ''}
            `, almacen_id ? [almacen_id] : [])
        ]);

        // Obtener productos con mayor rotación (últimos 30 días)
        const productosRotacionResult = await query(`
            SELECT 
                mi.producto_id,
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                SUM(mi.cantidad) as total_cantidad
            FROM movimientos_inventario mi
            LEFT JOIN productos p ON mi.producto_id = p.id
            WHERE mi.tipo_movimiento = 'SALIDA' 
            AND mi.fecha_movimiento >= CURRENT_DATE - INTERVAL '30 days'
            ${almacen_id ? 'AND mi.almacen_origen_id = $1' : ''}
            GROUP BY mi.producto_id, p.codigo, p.descripcion
            ORDER BY total_cantidad DESC
            LIMIT 10
        `, almacen_id ? [almacen_id] : []);

        // Obtener despachos próximos
        const despachoProximosResult = await query(`
            SELECT 
                d.*,
                v.codigo as venta_codigo,
                v.nombre_cliente,
                v.apellido_cliente,
                v.valor_final,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre
            FROM despachos d
            LEFT JOIN ventas v ON d.venta_id = v.id
            LEFT JOIN almacenes a ON d.almacen_id = a.id
            WHERE d.activo = true 
            AND d.estado IN ('PENDIENTE', 'PREPARANDO')
            AND d.fecha_programada <= CURRENT_DATE + INTERVAL '3 days'
            ${almacen_id ? 'AND d.almacen_id = $1' : ''}
            ORDER BY d.fecha_programada ASC
            LIMIT 15
        `, almacen_id ? [almacen_id] : []);

        // Obtener alertas críticas
        const alertasCriticasResult = await query(`
            SELECT 
                ai.*,
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre
            FROM alertas_inventario ai
            LEFT JOIN productos p ON ai.producto_id = p.id
            LEFT JOIN almacenes a ON ai.almacen_id = a.id
            WHERE ai.activa = true 
            AND ai.nivel_prioridad IN ('ALTA', 'CRITICA')
            ${almacen_id ? 'AND ai.almacen_id = $1' : ''}
            ORDER BY ai.fecha_alerta DESC
            LIMIT 10
        `, almacen_id ? [almacen_id] : []);

        return {
            success: true,
            data: {
                metricas: {
                    productos_con_stock: productosConStockResult.rows[0]?.total || 0,
                    productos_stock_bajo: productosStockBajoResult.rows[0]?.total || 0,
                    productos_agotados: productosAgotadosResult.rows[0]?.total || 0,
                    valor_total_inventario: valorTotalResult.rows[0]?.total || 0,
                    movimientos_dia: movimientosDiaResult.rows[0]?.total || 0,
                    alertas_activas: alertasActivasResult.rows[0]?.total || 0,
                    despachos_pendientes: despachosPendientesResult.rows[0]?.total || 0,
                    despachos_dia: despachosDiaResult.rows[0]?.total || 0
                },
                productos_mayor_rotacion: productosRotacionResult.rows || [],
                despachos_proximos: despachoProximosResult.rows || [],
                alertas_criticas: alertasCriticasResult.rows || []
            }
        };

    } catch (error) {
        logger.error('Error en obtenerDashboardMetricas:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener inventario con filtros dinámicos
 */
const obtenerInventarioConFiltros = async (filtros) => {
    try {
        const {
            page = 1,
            limit = 20,
            categoria,
            busqueda,
            estado_stock,
            almacen_id,
            orden = 'producto_codigo',
            direccion = 'asc'
        } = filtros;

        // Construir WHERE dinámicamente
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (categoria) {
            whereConditions.push(`categoria = $${paramIndex++}`);
            queryParams.push(categoria);
        }

        if (busqueda) {
            whereConditions.push(`(
                producto_codigo ILIKE $${paramIndex} OR 
                producto_descripcion ILIKE $${paramIndex} OR 
                marca ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${busqueda}%`);
            paramIndex++;
        }

        if (estado_stock) {
            whereConditions.push(`estado_stock = $${paramIndex++}`);
            queryParams.push(estado_stock);
        }

        if (almacen_id) {
            whereConditions.push(`almacen_id = $${paramIndex++}`);
            queryParams.push(almacen_id);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Validar orden
        const ordenValido = ['producto_codigo', 'producto_descripcion', 'stock_actual', 'stock_minimo', 'valor_inventario', 'ultimo_movimiento'];
        const ordenSeguro = ordenValido.includes(orden) ? orden : 'producto_codigo';
        const direccionSegura = direccion === 'desc' ? 'DESC' : 'ASC';

        // Query principal con paginación
        const offset = (Number(page) - 1) * Number(limit);
        
        const dataResult = await query(`
            SELECT * 
            FROM vista_inventario_completo 
            ${whereClause}
            ORDER BY ${ordenSeguro} ${direccionSegura}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, Number(limit), offset]);

        // Conteo total
        const countResult = await query(`
            SELECT COUNT(*) as total 
            FROM vista_inventario_completo 
            ${whereClause}
        `, queryParams);

        const totalRegistros = countResult.rows[0]?.total || 0;

        return {
            success: true,
            data: dataResult.rows || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(totalRegistros),
                totalPages: Math.ceil(Number(totalRegistros) / Number(limit))
            }
        };

    } catch (error) {
        logger.error('Error en obtenerInventarioConFiltros:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener movimientos con filtros dinámicos
 */
const obtenerMovimientosConFiltros = async (filtros) => {
    try {
        const {
            page = 1,
            limit = 20,
            producto_id,
            almacen_id,
            tipo_movimiento,
            busqueda,
            fecha_desde,
            fecha_hasta,
            orden = 'fecha_movimiento',
            direccion = 'desc'
        } = filtros;

        // Construir WHERE dinámicamente
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (producto_id) {
            whereConditions.push(`mi.producto_id = $${paramIndex++}`);
            queryParams.push(producto_id);
        }

        if (almacen_id) {
            whereConditions.push(`(mi.almacen_origen_id = $${paramIndex} OR mi.almacen_destino_id = $${paramIndex})`);
            queryParams.push(almacen_id);
            paramIndex++;
        }

        if (tipo_movimiento) {
            whereConditions.push(`mi.tipo_movimiento = $${paramIndex++}`);
            queryParams.push(tipo_movimiento);
        }

        if (fecha_desde) {
            whereConditions.push(`mi.fecha_movimiento >= $${paramIndex++}`);
            queryParams.push(fecha_desde);
        }

        if (fecha_hasta) {
            whereConditions.push(`mi.fecha_movimiento <= $${paramIndex++}`);
            queryParams.push(fecha_hasta);
        }

        if (busqueda) {
            // Búsqueda enriquecida que incluye productos, clientes, ventas y motivos
            whereConditions.push(`(
                mi.producto_codigo ILIKE $${paramIndex} OR
                mi.producto_descripcion ILIKE $${paramIndex} OR
                mi.motivo_enriquecido ILIKE $${paramIndex} OR
                mi.cliente_completo ILIKE $${paramIndex} OR
                mi.venta_codigo ILIKE $${paramIndex} OR
                mi.referencia_id ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${busqueda}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Validar orden
        const ordenValido = ['fecha_movimiento', 'tipo_movimiento', 'cantidad'];
        const ordenSeguro = ordenValido.includes(orden) ? `mi.${orden}` : 'mi.fecha_movimiento';
        const direccionSegura = direccion === 'asc' ? 'ASC' : 'DESC';

        // Query con paginación
        const offset = (Number(page) - 1) * Number(limit);

        // Usar la vista enriquecida que incluye información de ventas y clientes
        const result = await query(`
            SELECT *
            FROM vista_movimientos_enriquecidos mi
            ${whereClause}
            ORDER BY ${ordenSeguro} ${direccionSegura}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, Number(limit), offset]);

        // Conteo total para paginación
        const countResult = await query(`
            SELECT COUNT(*) as total
            FROM vista_movimientos_enriquecidos mi
            ${whereClause}
        `, queryParams);

        const totalRegistros = countResult.rows[0]?.total || 0;

        return {
            success: true,
            data: result.rows || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(totalRegistros),
                totalPages: Math.ceil(Number(totalRegistros) / Number(limit))
            }
        };

    } catch (error) {
        logger.error('Error en obtenerMovimientosConFiltros:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener kardex de un producto con filtros dinámicos
 */
const obtenerKardexProducto = async (filtros) => {
    try {
        const {
            producto_id,
            almacen_id = null,
            fecha_desde = null,
            fecha_hasta = null,
            incluir_saldo_inicial = true,
            limit = 100,
            orden = 'fecha_movimiento',
            direccion = 'asc'
        } = filtros;

        if (!producto_id) {
            return {
                success: false,
                error: 'El ID del producto es requerido'
            };
        }

        // Construir WHERE dinámicamente
        let whereConditions = ['mi.producto_id = $1'];
        let queryParams = [producto_id];
        let paramIndex = 2;

        if (almacen_id) {
            whereConditions.push(`(mi.almacen_origen_id = $${paramIndex} OR mi.almacen_destino_id = $${paramIndex})`);
            queryParams.push(almacen_id);
            paramIndex++;
        }

        if (fecha_desde) {
            whereConditions.push(`mi.fecha_movimiento >= $${paramIndex++}`);
            queryParams.push(fecha_desde);
        }

        if (fecha_hasta) {
            whereConditions.push(`mi.fecha_movimiento <= $${paramIndex++}`);
            queryParams.push(fecha_hasta);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // Query principal del kardex
        const kardexQuery = `
            SELECT
                mi.*,
                -- Calcular saldo acumulado (running total)
                SUM(
                    CASE
                        WHEN mi.tipo_movimiento IN ('ENTRADA', 'AJUSTE_POSITIVO', 'INICIAL') THEN mi.cantidad
                        WHEN mi.tipo_movimiento IN ('SALIDA', 'AJUSTE_NEGATIVO') THEN -mi.cantidad
                        WHEN mi.tipo_movimiento = 'TRANSFERENCIA' THEN
                            CASE
                                WHEN mi.almacen_destino_id = COALESCE($${almacen_id ? 2 : 'NULL'}, mi.almacen_destino_id) THEN mi.cantidad
                                WHEN mi.almacen_origen_id = COALESCE($${almacen_id ? 2 : 'NULL'}, mi.almacen_origen_id) THEN -mi.cantidad
                                ELSE 0
                            END
                        ELSE 0
                    END
                ) OVER (
                    PARTITION BY mi.producto_id ${almacen_id ? ', COALESCE(mi.almacen_origen_id, mi.almacen_destino_id)' : ''}
                    ORDER BY mi.fecha_movimiento ${direccion.toUpperCase()}
                    ROWS UNBOUNDED PRECEDING
                ) as saldo_acumulado,

                -- Información del producto (una sola vez)
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                p.unidad_medida,

                -- Determinar tipo de operación para display
                CASE
                    WHEN mi.tipo_movimiento IN ('ENTRADA', 'AJUSTE_POSITIVO', 'INICIAL') THEN 'ENTRADA'
                    WHEN mi.tipo_movimiento IN ('SALIDA', 'AJUSTE_NEGATIVO') THEN 'SALIDA'
                    WHEN mi.tipo_movimiento = 'TRANSFERENCIA' THEN
                        CASE
                            WHEN mi.almacen_destino_id = COALESCE($${almacen_id ? 2 : 'NULL'}, mi.almacen_destino_id) THEN 'ENTRADA'
                            WHEN mi.almacen_origen_id = COALESCE($${almacen_id ? 2 : 'NULL'}, mi.almacen_origen_id) THEN 'SALIDA'
                            ELSE 'NEUTRO'
                        END
                    ELSE 'NEUTRO'
                END as tipo_operacion_kardex

            FROM vista_movimientos_enriquecidos mi
            LEFT JOIN productos p ON mi.producto_id = p.id
            ${whereClause}
            ORDER BY mi.${orden} ${direccion.toUpperCase()}
            LIMIT $${paramIndex}
        `;

        queryParams.push(Number(limit));
        const result = await query(kardexQuery, queryParams);

        // Obtener información resumida del producto
        const productoInfo = await query(`
            SELECT
                p.*,
                -- Stock actual en todos los almacenes o en el almacén específico
                COALESCE(SUM(
                    CASE WHEN $2::int IS NULL OR i.almacen_id = $2 THEN i.stock_actual ELSE 0 END
                ), 0) as stock_actual_total,

                -- Cantidad de almacenes donde existe
                COUNT(DISTINCT CASE WHEN i.stock_actual > 0 THEN i.almacen_id END) as almacenes_con_stock,
                COUNT(DISTINCT i.almacen_id) as total_almacenes_registrados

            FROM productos p
            LEFT JOIN inventario i ON p.id = i.producto_id
            WHERE p.id = $1
            GROUP BY p.id
        `, [producto_id, almacen_id]);

        // Calcular métricas dinámicas
        const movimientos = result.rows || [];
        const metricas = {
            total_movimientos: movimientos.length,
            total_entradas: movimientos.filter(m => m.tipo_operacion_kardex === 'ENTRADA').length,
            total_salidas: movimientos.filter(m => m.tipo_operacion_kardex === 'SALIDA').length,
            cantidad_total_entrada: movimientos
                .filter(m => m.tipo_operacion_kardex === 'ENTRADA')
                .reduce((sum, m) => sum + Number(m.cantidad), 0),
            cantidad_total_salida: movimientos
                .filter(m => m.tipo_operacion_kardex === 'SALIDA')
                .reduce((sum, m) => sum + Number(m.cantidad), 0),
            periodo_desde: movimientos.length > 0 ? movimientos[0].fecha_movimiento : null,
            periodo_hasta: movimientos.length > 0 ? movimientos[movimientos.length - 1].fecha_movimiento : null
        };

        return {
            success: true,
            data: {
                producto: productoInfo.rows[0] || null,
                movimientos: movimientos,
                metricas: metricas,
                filtros_aplicados: filtros
            }
        };

    } catch (error) {
        logger.error('Error en obtenerKardexProducto:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener almacenes con jerarquía opcional
 */
const obtenerAlmacenesConJerarquia = async (incluirJerarquia = true) => {
    try {
        let sqlQuery;
        
        if (incluirJerarquia) {
            sqlQuery = `
                SELECT 
                    a.*,
                    ap.codigo as almacen_padre_codigo,
                    ap.nombre as almacen_padre_nombre
                FROM almacenes a
                LEFT JOIN almacenes ap ON a.almacen_padre_id = ap.id
                WHERE a.activo = true
                ORDER BY a.tipo, a.piso, a.nombre
            `;
        } else {
            sqlQuery = `
                SELECT * 
                FROM almacenes 
                WHERE activo = true 
                ORDER BY tipo, piso, nombre
            `;
        }

        const result = await query(sqlQuery);

        return {
            success: true,
            data: result.rows || []
        };

    } catch (error) {
        logger.error('Error en obtenerAlmacenesConJerarquia:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener alertas con filtros dinámicos
 */
const obtenerAlertasConFiltros = async (filtros) => {
    try {
        const {
            page = 1,
            limit = 20,
            nivel_prioridad,
            tipo_alerta,
            activa
        } = filtros;

        // Construir WHERE dinámicamente
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (activa !== null && activa !== undefined) {
            whereConditions.push(`ai.activa = $${paramIndex++}`);
            queryParams.push(activa);
        }

        if (nivel_prioridad) {
            whereConditions.push(`ai.nivel_prioridad = $${paramIndex++}`);
            queryParams.push(nivel_prioridad);
        }

        if (tipo_alerta) {
            whereConditions.push(`ai.tipo_alerta = $${paramIndex++}`);
            queryParams.push(tipo_alerta);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query con paginación
        const offset = (Number(page) - 1) * Number(limit);

        const result = await query(`
            SELECT 
                ai.*,
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre
            FROM alertas_inventario ai
            LEFT JOIN productos p ON ai.producto_id = p.id
            LEFT JOIN almacenes a ON ai.almacen_id = a.id
            ${whereClause}
            ORDER BY ai.fecha_alerta DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, Number(limit), offset]);

        return {
            success: true,
            data: result.rows || []
        };

    } catch (error) {
        logger.error('Error en obtenerAlertasConFiltros:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Resolver alerta específica
 */
const resolverAlerta = async (alerta_id, usuario_id, observaciones = 'Resuelta manualmente') => {
    try {
        const result = await query(`
            UPDATE alertas_inventario 
            SET activa = false,
                fecha_resolucion = NOW(),
                resuelto_por = $1,
                observaciones_resolucion = $2
            WHERE id = $3
            RETURNING *
        `, [usuario_id, observaciones, alerta_id]);

        if (result.rows.length === 0) {
            return {
                success: false,
                error: 'Alerta no encontrada'
            };
        }

        return {
            success: true,
            data: result.rows[0]
        };

    } catch (error) {
        logger.error('Error en resolverAlerta:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Actualizar stock de producto con UPSERT
 */
const actualizarStockProducto = async (datosActualizacion) => {
    try {
        const {
            producto_id,
            almacen_id,
            stock_actual,
            stock_minimo,
            stock_maximo,
            costo_promedio,
            motivo,
            usuario_id
        } = datosActualizacion;

        // Obtener stock anterior si existe
        const stockAnteriorResult = await query(`
            SELECT stock_actual 
            FROM inventario 
            WHERE producto_id = $1 AND almacen_id = $2
        `, [producto_id, almacen_id]);

        const stockAnterior = stockAnteriorResult.rows[0]?.stock_actual || 0;
        const diferencia = Number(stock_actual) - stockAnterior;

        // UPSERT del inventario
        const upsertResult = await query(`
            INSERT INTO inventario (
                producto_id, almacen_id, stock_actual, stock_minimo, stock_maximo,
                costo_promedio, ultimo_movimiento, created_by, updated_by, 
                created_at, updated_at, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $7, NOW(), NOW(), true)
            ON CONFLICT (producto_id, almacen_id) 
            DO UPDATE SET 
                stock_actual = $3,
                stock_minimo = $4,
                stock_maximo = $5,
                costo_promedio = $6,
                ultimo_movimiento = NOW(),
                updated_at = NOW(),
                updated_by = $7
            RETURNING *
        `, [
            producto_id,
            almacen_id,
            Number(stock_actual),
            Number(stock_minimo),
            stock_maximo ? Number(stock_maximo) : null,
            costo_promedio ? Number(costo_promedio) : null,
            usuario_id
        ]);

        // Registrar movimiento si hay diferencia
        if (diferencia !== 0) {
            const tipoMovimiento = diferencia > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';
            
            await query(`
                INSERT INTO movimientos_inventario (
                    id, producto_id, almacen_destino_id, tipo_movimiento, cantidad,
                    precio_unitario, stock_anterior, stock_posterior, motivo,
                    referencia_tipo, usuario_id, fecha_movimiento
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'AJUSTE', $9, NOW()
                )
            `, [
                producto_id,
                almacen_id,
                tipoMovimiento,
                Math.abs(diferencia),
                costo_promedio || 0,
                stockAnterior,
                Number(stock_actual),
                motivo,
                usuario_id
            ]);
        }

        // Verificar y crear alertas automáticamente
        await verificarYCrearAlertas(producto_id, almacen_id, Number(stock_actual));

        return {
            success: true,
            data: {
                inventario: upsertResult.rows[0],
                stock_anterior: stockAnterior,
                stock_actual: Number(stock_actual),
                diferencia: diferencia
            }
        };

    } catch (error) {
        logger.error('Error en actualizarStockProducto:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verificar salud del sistema
 */
const verificarSaludSistema = async () => {
    try {
        const dbStart = Date.now();
        
        const result = await query('SELECT 1 as test');
        
        const dbTime = Date.now() - dbStart;

        return {
            success: true,
            data: {
                database: {
                    connected: result.rows.length > 0,
                    responseTime: `${dbTime}ms`,
                    status: dbTime < 1000 ? 'good' : dbTime < 3000 ? 'warning' : 'slow'
                }
            }
        };

    } catch (error) {
        logger.error('Error en verificarSaludSistema:', error);
        return {
            success: false,
            error: error.message,
            data: {
                database: {
                    connected: false,
                    responseTime: '0ms',
                    status: 'error'
                }
            }
        };
    }
};

/**
 * Ejecutar query personalizada (solo SELECT)
 */
const ejecutarQueryPersonalizada = async (sqlQuery, params = []) => {
    try {
        // Validaciones de seguridad
        const queryLimpia = sqlQuery.trim().toLowerCase();
        
        if (!queryLimpia.startsWith('select')) {
            return {
                success: false,
                error: 'Solo se permiten consultas SELECT'
            };
        }

        // Palabras prohibidas para prevenir queries peligrosas
        const palabrasProhibidas = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate'];
        const contieneProhibida = palabrasProhibidas.some(palabra => 
            queryLimpia.includes(palabra)
        );

        if (contieneProhibida) {
            return {
                success: false,
                error: 'Query contiene operaciones no permitidas'
            };
        }

        const result = await query(sqlQuery, params);

        return {
            success: true,
            data: result.rows || [],
            rowCount: result.rows?.length || 0
        };

    } catch (error) {
        logger.error('Error en ejecutarQueryPersonalizada:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ==================== SERVICIOS DE ANÁLISIS DE INVENTARIO ====================

/**
 * Obtener rotación de inventario por almacén
 */
const getRotacionInventario = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // TEMPORAL: Usar query manual directamente (función PostgreSQL no disponible o corrupta)
        // try {
        //     const result = await query(`
        //         SELECT * FROM get_rotacion_almacenes($1, $2)
        //     `, [fechaInicio.toISOString(), new Date().toISOString()]);
        //
        //     return { success: true, data: result.rows };
        // } catch (rpcError) {
            // Query manual
            const result = await query(`
                SELECT 
                    mi.almacen_origen_id,
                    mi.almacen_destino_id,
                    mi.cantidad,
                    ao.codigo as almacenes_origen_codigo,
                    ao.nombre as almacenes_origen_nombre,
                    ad.codigo as almacenes_destino_codigo,
                    ad.nombre as almacenes_destino_nombre
                FROM movimientos_inventario mi
                LEFT JOIN almacenes ao ON mi.almacen_origen_id = ao.id
                LEFT JOIN almacenes ad ON mi.almacen_destino_id = ad.id
                WHERE mi.fecha_movimiento >= $1
                  AND mi.fecha_movimiento <= $2
            `, [fechaInicio.toISOString(), new Date().toISOString()]);
            
            // Procesar movimientos manualmente (misma lógica)
            const almacenesMap = new Map();
            
            result.rows.forEach(mov => {
                // Contar movimientos de origen
                if (mov.almacen_origen_id && mov.almacenes_origen_codigo) {
                    const key = mov.almacenes_origen_codigo;
                    if (!almacenesMap.has(key)) {
                        almacenesMap.set(key, {
                            almacen: key,
                            total_movimientos: 0,
                            cantidad_total: 0,
                            nombre_almacen: mov.almacenes_origen_nombre
                        });
                    }
                    const stats = almacenesMap.get(key);
                    stats.total_movimientos++;
                    stats.cantidad_total += Number(mov.cantidad);
                }
                
                // Contar movimientos de destino
                if (mov.almacen_destino_id && mov.almacenes_destino_codigo) {
                    const key = mov.almacenes_destino_codigo;
                    if (!almacenesMap.has(key)) {
                        almacenesMap.set(key, {
                            almacen: key,
                            total_movimientos: 0,
                            cantidad_total: 0,
                            nombre_almacen: mov.almacenes_destino_nombre
                        });
                    }
                    const stats = almacenesMap.get(key);
                    stats.total_movimientos++;
                    stats.cantidad_total += Number(mov.cantidad);
                }
            });
            
            // Convertir a formato esperado
            const resultData = Array.from(almacenesMap.values()).map(stats => ({
                almacen: stats.almacen,
                rotacion_diaria: Number((stats.total_movimientos / dias).toFixed(2)),
                cantidad_promedio: stats.total_movimientos > 0 ? 
                    Number((stats.cantidad_total / stats.total_movimientos).toFixed(2)) : 0,
                total_movimientos: stats.total_movimientos
            }));

            return { success: true, data: resultData };
        // }

    } catch (error) {
        logger.error('Error en getRotacionInventario:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
};

/**
 * Obtener eficiencia operativa
 */
const getEficienciaOperativa = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // Obtener movimientos por día
        const result = await query(`
            SELECT 
                mi.fecha_movimiento,
                mi.usuario_id,
                u.nombre,
                u.apellido
            FROM movimientos_inventario mi
            LEFT JOIN usuarios u ON mi.usuario_id = u.id
            WHERE mi.fecha_movimiento >= $1
              AND mi.fecha_movimiento <= $2
            ORDER BY mi.fecha_movimiento
        `, [fechaInicio.toISOString(), new Date().toISOString()]);
        
        // Procesar datos por día (misma lógica)
        const diasMap = new Map();
        
        result.rows.forEach(mov => {
            const fecha = mov.fecha_movimiento.toISOString().split('T')[0];
            
            if (!diasMap.has(fecha)) {
                diasMap.set(fecha, {
                    fecha: fecha,
                    movimientos: 0,
                    usuarios: new Set(),
                    eficiencia: 0
                });
            }
            
            const diaData = diasMap.get(fecha);
            diaData.movimientos++;
            diaData.usuarios.add(mov.usuario_id);
        });
        
        // Resto de la lógica igual...
        const movimientos_por_dia = Array.from(diasMap.values()).map(dia => ({
            fecha: dia.fecha,
            movimientos: dia.movimientos,
            usuarios: dia.usuarios.size,
            eficiencia: dia.usuarios.size > 0 ? 
                Number((dia.movimientos / dia.usuarios.size).toFixed(1)) : 0
        }));
        
        const totalMovimientos = movimientos_por_dia.reduce((sum, dia) => sum + dia.movimientos, 0);
        const totalUsuarios = movimientos_por_dia.reduce((sum, dia) => sum + dia.usuarios, 0);
        const totalDias = movimientos_por_dia.length;
        
        const metricas_generales = {
            promedio_movimientos_dia: totalDias > 0 ? Math.round(totalMovimientos / totalDias) : 0,
            promedio_usuarios_activos: totalDias > 0 ? Number((totalUsuarios / totalDias).toFixed(1)) : 0,
            eficiencia_promedio: totalUsuarios > 0 ? Number((totalMovimientos / totalUsuarios).toFixed(1)) : 0,
            tiempo_pico: '10:00-12:00',
            dia_mas_activo: 'Lunes'
        };
        
        return {
            success: true,
            data: {
                movimientos_por_dia,
                metricas_generales
            }
        };
        
    } catch (error) {
        logger.error('Error en getEficienciaOperativa:', error);
        return {
            success: false,
            error: error.message,
            data: {
                movimientos_por_dia: [],
                metricas_generales: {
                    promedio_movimientos_dia: 0,
                    promedio_usuarios_activos: 0,
                    eficiencia_promedio: 0,
                    tiempo_pico: '',
                    dia_mas_activo: ''
                }
            }
        };
    }
};

/**
 * Análisis de stock de seguridad
 */
/**
 * Análisis de stock de seguridad
 */
const getAnalisisStockSeguridad = async () => {
    try {
        const result = await query(`
            SELECT 
                i.stock_actual,
                i.stock_minimo,
                p.codigo as productos_codigo,
                p.descripcion as productos_descripcion,
                a.codigo as almacenes_codigo,
                a.nombre as almacenes_nombre
            FROM inventario i
            LEFT JOIN productos p ON i.producto_id = p.id
            LEFT JOIN almacenes a ON i.almacen_id = a.id
            WHERE i.activo = true 
              AND i.stock_minimo > 0
        `);
        
        const inventarios = result.rows;
        
        const distribucion = { Óptimo: 0, Riesgo: 0, Crítico: 0, Sobrestockeado: 0 };
        const productos_criticos = [];
        
        inventarios?.forEach(inv => {
            const stock = Number(inv.stock_actual);
            const minimo = Number(inv.stock_minimo);
            
            let estado = 'Óptimo';
            
            if (stock <= 0) {
                estado = 'Crítico';
            } else if (stock <= minimo) {
                estado = 'Crítico';
                productos_criticos.push({
                    codigo: inv.productos_codigo,
                    descripcion: inv.productos_descripcion,
                    stock_actual: stock,
                    stock_minimo: minimo,
                    dias_sin_reposicion: Math.floor(Math.random() * 30) + 1 // Placeholder
                });
            } else if (stock <= minimo * 1.5) {
                estado = 'Riesgo';
            } else if (stock > minimo * 2) {
                estado = 'Sobrestockeado';
            }
            
            distribucion[estado]++;
        });
        
        const total = inventarios?.length || 1;
        
        const distribucion_array = [
            { 
                estado: 'Óptimo', 
                cantidad: distribucion.Óptimo, 
                porcentaje: Number(((distribucion.Óptimo / total) * 100).toFixed(1)),
                color: '#10B981' 
            },
            { 
                estado: 'Riesgo', 
                cantidad: distribucion.Riesgo, 
                porcentaje: Number(((distribucion.Riesgo / total) * 100).toFixed(1)),
                color: '#F59E0B' 
            },
            { 
                estado: 'Crítico', 
                cantidad: distribucion.Crítico, 
                porcentaje: Number(((distribucion.Crítico / total) * 100).toFixed(1)),
                color: '#EF4444' 
            },
            { 
                estado: 'Sobrestockeado', 
                cantidad: distribucion.Sobrestockeado, 
                porcentaje: Number(((distribucion.Sobrestockeado / total) * 100).toFixed(1)),
                color: '#8B5CF6' 
            }
        ];
        
        const recomendaciones = {
            ajustar_minimos: Math.floor(distribucion.Crítico * 0.6),
            incrementar_stock: distribucion.Crítico,
            revisar_demanda: Math.floor(distribucion.Sobrestockeado * 0.8),
            productos_obsoletos: Math.floor(distribucion.Sobrestockeado * 0.4)
        };
        
        return {
            success: true,
            data: {
                distribucion: distribucion_array,
                productos_criticos: productos_criticos.slice(0, 8), // Limitar a 8
                recomendaciones
            }
        };
        
    } catch (error) {
        logger.error('Error en getAnalisisStockSeguridad:', error);
        return {
            success: false,
            error: error.message,
            data: {
                distribucion: [],
                productos_criticos: [],
                recomendaciones: {
                    ajustar_minimos: 0,
                    incrementar_stock: 0,
                    revisar_demanda: 0,
                    productos_obsoletos: 0
                }
            }
        };
    }
};

/**
 * Mapa de calor de almacenes
 */
const getMapaCalorAlmacenes = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // Obtener almacenes
        const almacenesResult = await query(`
            SELECT id, codigo, nombre 
            FROM almacenes 
            WHERE activo = true
        `);
        const almacenes = almacenesResult.rows;
        
        const mapaCalor = [];
        
        for (const almacen of almacenes || []) {
            // Contar movimientos
            const movimientosResult = await query(`
                SELECT COUNT(*) as total
                FROM movimientos_inventario 
                WHERE (almacen_origen_id = $1 OR almacen_destino_id = $1)
                  AND fecha_movimiento >= $2
            `, [almacen.id, fechaInicio.toISOString()]);
            
            // Contar alertas activas
            const alertasResult = await query(`
                SELECT COUNT(*) as total
                FROM alertas_inventario 
                WHERE almacen_id = $1 AND activa = true
            `, [almacen.id]);
            
            // Calcular valor de inventario
            const inventarioValorResult = await query(`
                SELECT stock_actual, costo_promedio
                FROM inventario 
                WHERE almacen_id = $1 AND activo = true
            `, [almacen.id]);
            
            const valorInventario = inventarioValorResult.rows?.reduce((sum, inv) => 
                sum + (Number(inv.stock_actual) * Number(inv.costo_promedio || 0)), 0) || 0;
            
            const totalMovimientos = Number(movimientosResult.rows[0]?.total || 0);
            const totalAlertas = Number(alertasResult.rows[0]?.total || 0);
            
            // Clasificar actividad
            let actividad = 'Muy Baja';
            const movimientosDiarios = totalMovimientos / dias;
            
            if (movimientosDiarios >= 40) actividad = 'Muy Alta';
            else if (movimientosDiarios >= 30) actividad = 'Alta';
            else if (movimientosDiarios >= 20) actividad = 'Media';
            else if (movimientosDiarios >= 10) actividad = 'Baja';
            
            // Calcular eficiencia (placeholder mejorado)
            const baseEficiencia = Math.max(60, 100 - (totalAlertas * 5));
            const eficienciaPorMovimiento = Math.min(20, movimientosDiarios * 0.5);
            const eficiencia = Math.min(100, Math.round(baseEficiencia + eficienciaPorMovimiento));
            
            mapaCalor.push({
                almacen: almacen.codigo,
                movimientos: totalMovimientos,
                alertas: totalAlertas,
                valor_inventario: valorInventario,
                actividad: actividad,
                eficiencia: eficiencia
            });
        }
        
        return {
            success: true,
            data: mapaCalor.sort((a, b) => b.movimientos - a.movimientos)
        };
        
    } catch (error) {
        logger.error('Error en getMapaCalorAlmacenes:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
};

/**
 * Tendencias de inventario y valorización
 */
const getTendenciasInventario = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // Dividir el periodo en intervalos (semanal para 30d, mensual para 365d)
        const intervalos = dias <= 30 ? 7 : dias <= 90 ? 7 : 30; // días por intervalo
        const numIntervalos = Math.ceil(dias / intervalos);
        
        const tendencias = [];
        
        for (let i = 0; i < numIntervalos; i++) {
            const inicioIntervalo = new Date(fechaInicio);
            inicioIntervalo.setDate(inicioIntervalo.getDate() + (i * intervalos));
            
            const finIntervalo = new Date(inicioIntervalo);
            finIntervalo.setDate(finIntervalo.getDate() + intervalos - 1);
            
            // Obtener movimientos del intervalo
            const movimientosResult = await query(`
                SELECT cantidad, precio_unitario
                FROM movimientos_inventario 
                WHERE fecha_movimiento >= $1 
                  AND fecha_movimiento <= $2
            `, [inicioIntervalo.toISOString(), finIntervalo.toISOString()]);
            
            const valorMovido = movimientosResult.rows?.reduce((sum, mov) => 
                sum + (Number(mov.cantidad) * Number(mov.precio_unitario || 0)), 0) || 0;
            
            // Calcular valor total de inventario (simulado - mejorar con snapshot real)
            const inventarioActualResult = await query(`
                SELECT stock_actual, costo_promedio
                FROM inventario 
                WHERE activo = true
            `);
            
            const valorInventario = inventarioActualResult.rows?.reduce((sum, inv) =>
                sum + (Number(inv.stock_actual) * Number(inv.costo_promedio || 0)), 0) || 0;
            
            const etiquetaIntervalo = intervalos === 7 ?
                `Sem ${i + 1}` :
                inicioIntervalo.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
            
            tendencias.push({
                periodo: etiquetaIntervalo,
                valor_movido: Number(valorMovido.toFixed(2)),
                valor_inventario: Number(valorInventario.toFixed(2)),
                fecha_inicio: inicioIntervalo.toISOString().split('T')[0],
                fecha_fin: finIntervalo.toISOString().split('T')[0]
            });
        }
        
        // Calcular tendencia general
        const primerValor = tendencias[0]?.valor_inventario || 0;
        const ultimoValor = tendencias[tendencias.length - 1]?.valor_inventario || 0;
        const tendenciaGeneral = primerValor === 0 ? 0 : 
            Number((((ultimoValor - primerValor) / primerValor) * 100).toFixed(2));
        
        return {
            success: true,
            data: {
                tendencias: tendencias,
                tendencia_general: {
                    porcentaje: tendenciaGeneral,
                    direccion: tendenciaGeneral > 0 ? 'Creciente' : tendenciaGeneral < 0 ? 'Decreciente' : 'Estable',
                    valor_inicial: primerValor,
                    valor_final: ultimoValor
                }
            }
        };
        
    } catch (error) {
        logger.error('Error en getTendenciasInventario:', error);
        return {
            success: false,
            error: error.message,
            data: {
                tendencias: [],
                tendencia_general: {
                    porcentaje: 0,
                    direccion: 'Estable',
                    valor_inicial: 0,
                    valor_final: 0
                }
            }
        };
    }
};

// ==================== SERVICIOS DE STOCK ====================

/**
 * Verifica si hay stock suficiente para una venta
 */
const verificarStockDisponible = async (productos, almacen_id = null) => {
    try {
        const resultados = [];
        
        for (const item of productos) {
            const { producto_id, cantidad } = item;
            
            // Construir query SQL dinámico
            let sql = `
                SELECT i.stock_actual, a.codigo, a.nombre 
                FROM inventario i 
                INNER JOIN almacenes a ON i.almacen_id = a.id 
                WHERE i.producto_id = $1 
                AND i.stock_actual > 0 
                AND i.activo = true
            `;
            
            const params = [producto_id];
            
            if (almacen_id) {
                sql += ' AND i.almacen_id = $2';
                params.push(almacen_id);
            }
            
            const result = await query(sql, params);
            const data = result.rows;
            
            const stockTotal = data.reduce((total, inv) => total + Number(inv.stock_actual), 0);
            const tieneStock = stockTotal >= cantidad;
            
            resultados.push({
                producto_id,
                cantidad_solicitada: cantidad,
                stock_disponible: stockTotal,
                tiene_stock: tieneStock,
                ubicaciones: data.map(inv => ({
                    almacen: inv.codigo,
                    stock: inv.stock_actual
                }))
            });
        }
        
        return {
            success: true,
            data: resultados,
            puede_vender: resultados.every(r => r.tiene_stock)
        };
        
    } catch (error) {
        logger.error('Error en verificarStockDisponible:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Descontar stock automáticamente al confirmar venta
 */
const descontarStockVenta = async (venta_id, productos, almacen_id, usuario_id) => {
    try {
        const movimientos = [];
        
        for (const item of productos) {
            const { producto_id, cantidad, precio_unitario } = item;
            
            // Obtener stock actual
            const stockResult = await query(`
                SELECT stock_actual 
                FROM inventario 
                WHERE producto_id = $1 AND almacen_id = $2 AND activo = true
            `, [producto_id, almacen_id]);
            
            if (stockResult.rows.length === 0) {
                throw new Error(`No hay inventario para producto ${producto_id} en almacén especificado`);
            }
            
            const inventario = stockResult.rows[0];
            
            if (inventario.stock_actual < cantidad) {
                throw new Error(`Stock insuficiente para producto ${producto_id}. Disponible: ${inventario.stock_actual}, Solicitado: ${cantidad}`);
            }
            
            // Descontar stock
            const updateResult = await query(`
                UPDATE inventario 
                SET stock_actual = $1,
                    ultimo_movimiento = NOW(),
                    updated_at = NOW(),
                    updated_by = $2
                WHERE producto_id = $3 AND almacen_id = $4
                RETURNING stock_actual
            `, [
                inventario.stock_actual - cantidad,
                usuario_id,
                producto_id,
                almacen_id
            ]);
            
            if (updateResult.rows.length === 0) {
                throw new Error(`Error actualizando stock para producto ${producto_id}`);
            }
            
            // Registrar movimiento
            const movimientoResult = await query(`
                INSERT INTO movimientos_inventario (
                    id, producto_id, almacen_origen_id, tipo_movimiento, cantidad,
                    precio_unitario, stock_anterior, stock_posterior, motivo,
                    referencia_tipo, referencia_id, usuario_id, fecha_movimiento
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'SALIDA', $3, $4, $5, $6, $7, 'VENTA', $8, $9, NOW()
                ) RETURNING id
            `, [
                producto_id,
                almacen_id,
                cantidad,
                precio_unitario || 0,
                inventario.stock_actual,
                inventario.stock_actual - cantidad,
                `Venta confirmada - ID: ${venta_id}`,
                venta_id.toString(),
                usuario_id
            ]);
            
            movimientos.push({
                id: movimientoResult.rows[0].id,
                producto_id,
                cantidad
            });
            
            // Verificar alertas de stock bajo
            await verificarYCrearAlertas(producto_id, almacen_id, inventario.stock_actual - cantidad);
        }
        
        logger.info('Stock descontado exitosamente:', { venta_id, productos: productos.length });
        
        return {
            success: true,
            data: {
                venta_id,
                movimientos_creados: movimientos.length,
                productos_procesados: productos.length
            }
        };
        
    } catch (error) {
        logger.error('Error en descontarStockVenta:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Transferir stock entre almacenes (sin stored procedure)
 */
const transferirStock = async (producto_id, almacen_origen_id, almacen_destino_id, cantidad, motivo, usuario_id) => {
    try {
        // Validaciones tempranas
        if (!producto_id || !almacen_origen_id || !almacen_destino_id || cantidad <= 0 || !usuario_id) {
            throw new Error('Parámetros inválidos para transferencia de stock');
        }

        if (almacen_origen_id === almacen_destino_id) {
            throw new Error('El almacén origen y destino no pueden ser el mismo');
        }

        // Verificar stock origen
        const origenResult = await query(`
            SELECT stock_actual, costo_promedio
            FROM inventario 
            WHERE producto_id = $1 AND almacen_id = $2 AND activo = true
        `, [producto_id, almacen_origen_id]);
        
        if (origenResult.rows.length === 0) {
            throw new Error('No existe inventario para el producto en almacén origen');
        }
        
        const inventarioOrigen = origenResult.rows[0];
        
        if (inventarioOrigen.stock_actual < cantidad) {
            throw new Error(`Stock insuficiente en almacén origen. Disponible: ${inventarioOrigen.stock_actual}, Solicitado: ${cantidad}`);
        }

        // Verificar inventario destino o crearlo si no existe (UPSERT)
        const destinoResult = await query(`
            INSERT INTO inventario (
                producto_id, almacen_id, stock_actual, stock_minimo, 
                costo_promedio, created_by, updated_by, activo
            ) VALUES ($1, $2, 0, 0, $3, $4, $4, true)
            ON CONFLICT (producto_id, almacen_id) 
            DO UPDATE SET updated_at = NOW()
            RETURNING stock_actual, costo_promedio
        `, [producto_id, almacen_destino_id, inventarioOrigen.costo_promedio || 0, usuario_id]);
        
        const inventarioDestino = destinoResult.rows[0];

        // Actualizar stocks en ambos almacenes de forma atómica
        const updateOrigenResult = await query(`
            UPDATE inventario 
            SET stock_actual = $1,
                ultimo_movimiento = NOW(),
                updated_at = NOW(),
                updated_by = $2
            WHERE producto_id = $3 AND almacen_id = $4
            RETURNING stock_actual
        `, [
            inventarioOrigen.stock_actual - cantidad,
            usuario_id,
            producto_id,
            almacen_origen_id
        ]);

        if (updateOrigenResult.rows.length === 0) {
            throw new Error('Error actualizando stock en almacén origen');
        }

        const updateDestinoResult = await query(`
            UPDATE inventario 
            SET stock_actual = $1,
                ultimo_movimiento = NOW(),
                updated_at = NOW(),
                updated_by = $2
            WHERE producto_id = $3 AND almacen_id = $4
            RETURNING stock_actual
        `, [
            inventarioDestino.stock_actual + cantidad,
            usuario_id,
            producto_id,
            almacen_destino_id
        ]);

        if (updateDestinoResult.rows.length === 0) {
            throw new Error('Error actualizando stock en almacén destino');
        }

        // Crear movimiento de transferencia
        const movimientoResult = await query(`
            INSERT INTO movimientos_inventario (
                id, producto_id, almacen_origen_id, almacen_destino_id, 
                tipo_movimiento, cantidad, precio_unitario, stock_anterior, 
                stock_posterior, motivo, referencia_tipo, referencia_id, 
                usuario_id, fecha_movimiento
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, 'TRANSFERENCIA', $4, $5, $6, $7, $8, 
                'TRANSFERENCIA', gen_random_uuid(), $9, NOW()
            ) RETURNING id
        `, [
            producto_id,
            almacen_origen_id,
            almacen_destino_id,
            cantidad,
            inventarioOrigen.costo_promedio || 0,
            inventarioOrigen.stock_actual,
            inventarioOrigen.stock_actual - cantidad,
            motivo || 'Transferencia entre almacenes',
            usuario_id
        ]);

        const movimientoId = movimientoResult.rows[0].id;

        logger.info('Transferencia completada exitosamente:', { 
            movimiento_id: movimientoId,
            producto_id, 
            almacen_origen_id, 
            almacen_destino_id, 
            cantidad 
        });

        return {
            success: true,
            data: {
                movimiento_id: movimientoId,
                stock_origen_anterior: inventarioOrigen.stock_actual,
                stock_origen_actual: inventarioOrigen.stock_actual - cantidad,
                stock_destino_anterior: inventarioDestino.stock_actual,
                stock_destino_actual: inventarioDestino.stock_actual + cantidad
            }
        };

    } catch (error) {
        logger.error('Error en transferirStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
const verificarYCrearAlertas = async (producto_id, almacen_id, stock_actual) => {
    try {
        // Obtener configuración de stock mínimo
        const inventarioResult = await query(`
            SELECT stock_minimo 
            FROM inventario 
            WHERE producto_id = $1 AND almacen_id = $2 AND activo = true
        `, [producto_id, almacen_id]);
        
        if (inventarioResult.rows.length === 0) return;
        
        const stock_minimo = inventarioResult.rows[0].stock_minimo || 0;
        
        // Determinar tipo de alerta
        let tipo_alerta = null;
        let nivel_prioridad = null;
        let mensaje = null;
        
        if (stock_actual <= 0) {
            tipo_alerta = 'STOCK_AGOTADO';
            nivel_prioridad = 'CRITICA';
            mensaje = 'Producto completamente agotado';
        } else if (stock_actual <= stock_minimo) {
            tipo_alerta = 'STOCK_MINIMO';
            nivel_prioridad = 'MEDIA';
            mensaje = `Stock por debajo del mínimo (${stock_minimo})`;
        }
        
        if (tipo_alerta) {
            // Verificar si ya existe una alerta activa
            const alertaExistenteResult = await query(`
                SELECT id 
                FROM alertas_inventario 
                WHERE producto_id = $1 AND almacen_id = $2 AND tipo_alerta = $3 AND activa = true
            `, [producto_id, almacen_id, tipo_alerta]);
            
            if (alertaExistenteResult.rows.length === 0) {
                await query(`
                    INSERT INTO alertas_inventario (
                        id, producto_id, almacen_id, tipo_alerta, nivel_prioridad, 
                        mensaje, stock_actual, stock_minimo, fecha_alerta, activa
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), true
                    )
                `, [
                    producto_id,
                    almacen_id,
                    tipo_alerta,
                    nivel_prioridad,
                    mensaje,
                    stock_actual,
                    stock_minimo
                ]);
            }
        }
        
    } catch (error) {
        logger.error('Error en verificarYCrearAlertas:', error);
    }
};

// ==================== SERVICIOS DE DESPACHOS ====================

/**
 * Obtener despachos con filtros
 */
const obtenerDespachos = async (filtros) => {
    try {
        const {
            page = 1,
            limit = 20,
            estado,
            fecha_desde,
            fecha_hasta,
            almacen_id,
            venta_id
        } = filtros;

        // Construir query con filtros dinámicos
        let whereConditions = ['d.activo = true'];
        let queryParams = [];
        let paramIndex = 1;

        if (estado) {
            whereConditions.push(`d.estado = $${paramIndex++}`);
            queryParams.push(estado);
        }

        if (fecha_desde) {
            whereConditions.push(`d.fecha_programada >= $${paramIndex++}`);
            queryParams.push(fecha_desde);
        }

        if (fecha_hasta) {
            whereConditions.push(`d.fecha_programada <= $${paramIndex++}`);
            queryParams.push(fecha_hasta);
        }

        if (almacen_id) {
            whereConditions.push(`d.almacen_id = $${paramIndex++}`);
            queryParams.push(almacen_id);
        }

        if (venta_id) {
            whereConditions.push(`d.venta_id = $${paramIndex++}`);
            queryParams.push(venta_id);
        }

        // Calcular paginación
        const offset = (Number(page) - 1) * Number(limit);

        const sqlQuery = `
            SELECT
                d.*,
                v.codigo as venta_codigo,
                v.nombre_cliente,
                v.apellido_cliente,
                v.cliente_telefono,
                v.valor_final,
                v.ciudad,
                v.distrito,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre,
                a.tipo as almacen_tipo,
                up.nombre as preparado_nombre,
                up.apellido as preparado_apellido,
                ue.nombre as enviado_nombre,
                ue.apellido as enviado_apellido
            FROM despachos d
            LEFT JOIN ventas v ON d.venta_id = v.id
            LEFT JOIN almacenes a ON d.almacen_id = a.id
            LEFT JOIN usuarios up ON d.preparado_por = up.id
            LEFT JOIN usuarios ue ON d.enviado_por = ue.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY d.fecha_programada ASC, d.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        // Agregar LIMIT y OFFSET a los parámetros
        queryParams.push(Number(limit), offset);

        const result = await query(sqlQuery, queryParams);

        return {
            success: true,
            data: result.rows || []
        };

    } catch (error) {
        logger.error('Error en obtenerDespachos:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener despacho por ID
 */
const obtenerDespachoPorId = async (despacho_id) => {
    try {
        const result = await query(`
            SELECT 
                d.*,
                v.codigo as venta_codigo,
                v.nombre_cliente,
                v.apellido_cliente,
                v.cliente_empresa,
                v.cliente_telefono,
                v.cliente_email,
                v.valor_final,
                v.ciudad,
                v.departamento,
                v.distrito,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre,
                a.tipo as almacen_tipo,
                a.direccion as almacen_direccion,
                up.nombre as preparado_nombre,
                up.apellido as preparado_apellido,
                ue.nombre as enviado_nombre,
                ue.apellido as enviado_apellido
            FROM despachos d
            LEFT JOIN ventas v ON d.venta_id = v.id
            LEFT JOIN almacenes a ON d.almacen_id = a.id
            LEFT JOIN usuarios up ON d.preparado_por = up.id
            LEFT JOIN usuarios ue ON d.enviado_por = ue.id
            WHERE d.id = $1
        `, [despacho_id]);
        
        if (result.rows.length === 0) {
            throw new Error('Despacho no encontrado');
        }
        
        // Obtener detalles de la venta si existe
        const despacho = result.rows[0];
        if (despacho.venta_id) {
            const detallesResult = await query(`
                SELECT 
                    vd.cantidad,
                    vd.precio_unitario,
                    vd.subtotal,
                    p.codigo as producto_codigo,
                    p.descripcion as producto_descripcion,
                    p.marca as producto_marca,
                    p.unidad_medida as producto_unidad_medida
                FROM venta_detalles vd
                LEFT JOIN productos p ON vd.producto_id = p.id
                WHERE vd.venta_id = $1
            `, [despacho.venta_id]);
            
            despacho.venta_detalles = detallesResult.rows;
        }
        
        return {
            success: true,
            data: despacho
        };
        
    } catch (error) {
        logger.error('Error en obtenerDespachoPorId:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Crear despacho automático desde venta
 */
const crearDespachoDesdeVenta = async (venta_data) => {
    try {
        const {
            venta_id,
            fecha_entrega_estimada,
            almacen_id,
            observaciones_almacen,
            es_venta_presencial,
            se_lo_llevo_directamente
        } = venta_data;
        
        // No crear despacho si es presencial y se lo llevó directamente
        if (es_venta_presencial && se_lo_llevo_directamente) {
            return {
                success: true,
                message: 'No se requiere despacho - Cliente se llevó producto directamente',
                data: null
            };
        }
        
        // Generar código de despacho
        const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
        
        const ultimoDespachoResult = await query(`
            SELECT codigo 
            FROM despachos 
            WHERE codigo LIKE $1
            ORDER BY created_at DESC 
            LIMIT 1
        `, [`DESP-${fecha}-%`]);
        
        let correlativo = 1;
        if (ultimoDespachoResult.rows.length > 0) {
            const match = ultimoDespachoResult.rows[0].codigo.match(/DESP-\d{8}-(\d+)/);
            correlativo = match ? parseInt(match[1]) + 1 : 1;
        }
        
        const codigo = `DESP-${fecha}-${correlativo.toString().padStart(3, '0')}`;
        
        const insertResult = await query(`
            INSERT INTO despachos (
                id, venta_id, almacen_id, codigo, estado, fecha_programada,
                observaciones_preparacion, created_by, updated_by, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, 'PENDIENTE', $4, $5, $6, $6, NOW(), NOW()
            ) RETURNING *
        `, [
            venta_id,
            almacen_id,
            codigo,
            fecha_entrega_estimada || new Date().toISOString().split('T')[0],
            observaciones_almacen || '',
            1
        ]);
        
        const despacho = insertResult.rows[0];
        
        logger.info('Despacho creado exitosamente:', { codigo, venta_id });
        
        return {
            success: true,
            data: despacho,
            message: `Despacho ${codigo} creado exitosamente`
        };
        
    } catch (error) {
        logger.error('Error en crearDespachoDesdeVenta:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Actualizar estado de despacho
 */
const actualizarEstadoDespacho = async (despacho_id, nuevo_estado, usuario_id, observaciones = '') => {
    try {
        const estadosValidos = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
        
        if (!estadosValidos.includes(nuevo_estado)) {
            throw new Error('Estado de despacho no válido');
        }
        
        // Construir campos de actualización dinámicamente
        let updateFields = ['estado = $1', 'updated_at = NOW()', 'updated_by = $2'];
        let queryParams = [nuevo_estado, usuario_id];
        let paramIndex = 3;
        
        // Agregar campos específicos según el estado
        switch (nuevo_estado) {
            case 'PREPARANDO':
                updateFields.push(`fecha_preparacion = NOW()`, `preparado_por = $${paramIndex++}`);
                queryParams.push(usuario_id);
                if (observaciones) {
                    updateFields.push(`observaciones_preparacion = $${paramIndex++}`);
                    queryParams.push(observaciones);
                }
                break;
            case 'ENVIADO':
                updateFields.push(`fecha_envio = NOW()`, `enviado_por = $${paramIndex++}`);
                queryParams.push(usuario_id);
                if (observaciones) {
                    updateFields.push(`observaciones_envio = $${paramIndex++}`);
                    queryParams.push(observaciones);
                }
                break;
            case 'ENTREGADO':
                updateFields.push('fecha_entrega = NOW()');
                break;
        }
        
        queryParams.push(despacho_id);
        
        const updateResult = await query(`
            UPDATE despachos 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, queryParams);
        
        if (updateResult.rows.length === 0) {
            throw new Error('Despacho no encontrado');
        }
        
        const despacho = updateResult.rows[0];
        
        // Actualizar estado de venta automáticamente
        if (nuevo_estado === 'ENVIADO' || nuevo_estado === 'ENTREGADO') {
            await actualizarEstadoVentaDesdeDespacho(despacho.venta_id, nuevo_estado);
        }
        
        logger.info('Estado de despacho actualizado:', { despacho_id, nuevo_estado });
        
        return {
            success: true,
            data: despacho,
            message: `Despacho actualizado a estado: ${nuevo_estado}`
        };
        
    } catch (error) {
        logger.error('Error en actualizarEstadoDespacho:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Actualizar estado de venta desde despacho
 */
const actualizarEstadoVentaDesdeDespacho = async (venta_id, estado_despacho) => {
    try {
        let nuevo_estado_venta = null;
        
        switch (estado_despacho) {
            case 'ENVIADO':
                nuevo_estado_venta = 'vendido/enviado';
                break;
            case 'ENTREGADO':
                // No cambiar estado automáticamente - queda en 'vendido/enviado'
                // El asesor debe confirmar manualmente con el cliente
                break;
        }
        
        if (nuevo_estado_venta) {
            await query(`
                UPDATE ventas 
                SET estado_detallado = $1, updated_at = NOW()
                WHERE id = $2
            `, [nuevo_estado_venta, venta_id]);
            
            logger.info('Estado de venta actualizado automáticamente:', { venta_id, nuevo_estado_venta });
        }
        
    } catch (error) {
        logger.error('Error actualizando estado de venta:', error);
    }
};

// ==================== SERVICIOS DE REPORTES ====================

/**
 * Generar reporte de kardex por producto
 */
const generarKardex = async (producto_id, almacen_id = null, fecha_desde = null, fecha_hasta = null) => {
    try {
        // Construir query con filtros dinámicos
        let whereConditions = ['mi.producto_id = $1'];
        let queryParams = [producto_id];
        let paramIndex = 2;
        
        if (almacen_id) {
            whereConditions.push(`(mi.almacen_origen_id = $${paramIndex} OR mi.almacen_destino_id = $${paramIndex})`);
            queryParams.push(almacen_id);
            paramIndex++;
        }
        
        if (fecha_desde) {
            whereConditions.push(`mi.fecha_movimiento >= $${paramIndex++}`);
            queryParams.push(fecha_desde);
        }
        
        if (fecha_hasta) {
            whereConditions.push(`mi.fecha_movimiento <= $${paramIndex++}`);
            queryParams.push(fecha_hasta);
        }
        
        const result = await query(`
            SELECT 
                mi.*,
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                ao.codigo as almacen_origen_codigo,
                ao.nombre as almacen_origen_nombre,
                ad.codigo as almacen_destino_codigo,
                ad.nombre as almacen_destino_nombre,
                u.nombre as usuario_nombre,
                u.apellido as usuario_apellido
            FROM movimientos_inventario mi
            LEFT JOIN productos p ON mi.producto_id = p.id
            LEFT JOIN almacenes ao ON mi.almacen_origen_id = ao.id
            LEFT JOIN almacenes ad ON mi.almacen_destino_id = ad.id
            LEFT JOIN usuarios u ON mi.usuario_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY mi.fecha_movimiento ASC
        `, queryParams);
        
        // Calcular saldos acumulados
        let saldo = 0;
        const kardex = result.rows.map(mov => {
            const esEntrada = ['ENTRADA', 'AJUSTE_POSITIVO', 'TRANSFERENCIA'].includes(mov.tipo_movimiento);
            const esSalida = ['SALIDA', 'AJUSTE_NEGATIVO'].includes(mov.tipo_movimiento);
            
            if (esEntrada && (!almacen_id || mov.almacen_destino_id === almacen_id)) {
                saldo += Number(mov.cantidad);
            } else if (esSalida && (!almacen_id || mov.almacen_origen_id === almacen_id)) {
                saldo -= Number(mov.cantidad);
            }
            
            return {
                ...mov,
                saldo_acumulado: saldo
            };
        });
        
        return {
            success: true,
            data: kardex
        };
        
    } catch (error) {
        logger.error('Error en generarKardex:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generar reporte de valorización de inventario
 */
const generarReporteValorizacion = async (almacen_id = null, categoria_id = null) => {
    try {
        // Construir query con filtros dinámicos
        let whereConditions = ['vic.stock_actual > 0'];
        let queryParams = [];
        let paramIndex = 1;
        
        if (almacen_id) {
            whereConditions.push(`vic.almacen_id = $${paramIndex++}`);
            queryParams.push(almacen_id);
        }
        
        if (categoria_id) {
            whereConditions.push(`vic.categoria_id = $${paramIndex++}`);
            queryParams.push(categoria_id);
        }
        
        const result = await query(`
            SELECT * 
            FROM vista_inventario_completo vic
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY vic.valor_inventario DESC
        `, queryParams);
        
        const data = result.rows;
        
        // Calcular totales
        const resumen = {
            total_productos: data.length,
            total_unidades: data.reduce((sum, item) => sum + Number(item.stock_actual || 0), 0),
            valor_total: data.reduce((sum, item) => sum + Number(item.valor_inventario || 0), 0),
            productos_stock_bajo: data.filter(item => item.estado_stock === 'BAJO').length,
            productos_agotados: data.filter(item => item.estado_stock === 'AGOTADO').length
        };
        
        return {
            success: true,
            data: {
                resumen,
                detalle: data
            }
        };
        
    } catch (error) {
        logger.error('Error en generarReporteValorizacion:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener stock consolidado por producto
 */
const obtenerStockConsolidado = async () => {
    try {
        const result = await query(`
            SELECT * 
            FROM vista_stock_consolidado 
            ORDER BY stock_total DESC
        `);
        
        return {
            success: true,
            data: result.rows || []
        };
        
    } catch (error) {
        logger.error('Error en obtenerStockConsolidado:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ==================== SERVICIOS DE UPLOAD MASIVO ====================

// ==================== SERVICIOS DE UPLOAD MASIVO ====================

/**
 * Generar plantilla Excel para upload
 */
const generarPlantillaStock = async () => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Stock Upload');
        
        // Configurar columnas (formato actualizado)
        worksheet.columns = [
            { header: 'ALMACÉN', key: 'almacen_codigo', width: 25 },
            { header: 'CÓDIGO', key: 'codigo_producto', width: 20 },
            { header: 'DESCRIPCIÓN', key: 'descripcion', width: 40 },
            { header: 'CANTIDAD', key: 'cantidad', width: 15 },
            { header: 'U. MEDIDA', key: 'unidad_medida', width: 15 },
            { header: 'TIPO', key: 'linea_producto', width: 15 },
            { header: 'STOCK MÍNIMO', key: 'stock_minimo', width: 15 },
        ];
        
        // Estilizar encabezados
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
        
        // Agregar datos de ejemplo (formato real)
        worksheet.addRow({
            almacen_codigo: 'Almacén central',
            codigo_producto: 'INC-256EGG',
            descripcion: 'INCUBADORA DE 256 EGG',
            cantidad: 9,
            unidad_medida: 'UNIDAD',
            linea_producto: 'PRODUCTOS',
            stock_minimo: 1, // Opcional
        });

        worksheet.addRow({
            almacen_codigo: 'Almacén central',
            codigo_producto: 'SOPORTE-TEC',
            descripcion: 'SOPORTE TÉCNICO ESPECIALIZADO',
            cantidad: 0,
            unidad_medida: 'HORA',
            linea_producto: 'SERVICIOS',
            stock_minimo: 0,
        });

        // Ejemplo adicional con KILOGRAMO
        worksheet.addRow({
            almacen_codigo: 'Almacén central',
            codigo_producto: 'ALM-KG01',
            descripcion: 'ALIMENTO BALANCEADO PARA AVES',
            cantidad: 25,
            unidad_medida: 'KILOGRAMO',
            stock_minimo: 5,
        });

        // Ejemplo adicional con CIENTO
        worksheet.addRow({
            almacen_codigo: 'Almacén central',
            codigo_producto: 'TOR-C01',
            descripcion: 'TORNILLOS AUTORROSCANTES 3/4',
            cantidad: 12,
            unidad_medida: 'CIENTO',
            stock_minimo: 2
        });

        // Ejemplo adicional con DOCENA
        worksheet.addRow({
            almacen_codigo: 'Almacén central',
            codigo_producto: 'HER-D01',
            descripcion: 'DESTORNILLADORES PHILLIPS #2',
            cantidad: 8,
            unidad_medida: 'DOCENA',
            stock_minimo: 1
        });
        
        // Obtener almacenes para validación
        const almacenesResult = await query(`
            SELECT codigo 
            FROM almacenes 
            WHERE activo = true 
            ORDER BY codigo
        `);
        
        // Crear hoja de validaciones con almacenes reales
        const validacionesSheet = workbook.addWorksheet('Validaciones');
        validacionesSheet.addRow(['Almacenes Válidos:']);

        // Almacenes reales del sistema
        const almacenesReales = [
            'Almacén nuevo',
            'Almacén central',
            'Distribuidor Ecococi',
            'Almacén oficina 2 piso',
            'Almacén oficina 4 piso',
            'Almacén oficina 5 piso',
            'Anaquel piso 2',
            'Exhibición piso 1',
            'Exhibición piso 2',
            'Exhibición piso 3'
        ];

        almacenesReales.forEach(almacen => {
            validacionesSheet.addRow([almacen]);
        });

        // Agregar instrucciones
        validacionesSheet.addRow(['']);
        validacionesSheet.addRow(['INSTRUCCIONES:']);
        validacionesSheet.addRow(['• ALMACÉN: Debe coincidir exactamente con la lista']);
        validacionesSheet.addRow(['• CÓDIGO: Código único del producto']);
        validacionesSheet.addRow(['• DESCRIPCIÓN: Nombre del producto']);
        validacionesSheet.addRow(['• CANTIDAD: Stock actual (obligatorio)']);
        validacionesSheet.addRow(['• U. MEDIDA: MILLAR, UNIDAD, CIENTO, DOCENA, KILOGRAMO, HORA']);
        validacionesSheet.addRow(['• TIPO: PRODUCTOS o SERVICIOS']);
        validacionesSheet.addRow(['• STOCK MÍN: Opcional, se puede configurar después']);
        validacionesSheet.addRow(['']);
        validacionesSheet.addRow(['TIPOS PERMITIDOS:']);
        validacionesSheet.addRow(['• PRODUCTOS = Artículos físicos con stock']);
        validacionesSheet.addRow(['• SERVICIOS = Servicios sin stock físico']);
        validacionesSheet.addRow(['']);
        validacionesSheet.addRow(['UNIDADES DE MEDIDA PERMITIDAS:']);
        validacionesSheet.addRow(['• MILLAR = 1000 unidades']);
        validacionesSheet.addRow(['• UNIDAD = 1 pieza individual']);
        validacionesSheet.addRow(['• CIENTO = 100 unidades']);
        validacionesSheet.addRow(['• DOCENA = 12 unidades']);
        validacionesSheet.addRow(['• KILOGRAMO = peso en kilogramos']);
        validacionesSheet.addRow(['• HORA = servicios por horas']);
        
        // Generar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        return {
            success: true,
            data: buffer,
            filename: `Plantilla_Stock_${new Date().toISOString().split('T')[0]}.xlsx`
        };
        
    } catch (error) {
        logger.error('Error en generarPlantillaStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ==================== FUNCIONES DE BÚSQUEDA INTELIGENTE ====================

/**
 * Normalizar código para búsqueda inteligente
 */
const normalizarCodigo = (codigo) => {
    if (!codigo) return '';
    return codigo.toString()
        .trim()
        .toUpperCase()
        .replace(/[ÁÀÄÂÃ]/g, 'A')
        .replace(/[ÉÈËÊ]/g, 'E')
        .replace(/[ÍÌÏÎ]/g, 'I')
        .replace(/[ÓÒÖÔÕ]/g, 'O')
        .replace(/[ÚÙÜÛ]/g, 'U')
        .replace(/Ñ/g, 'N')
        .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
        .trim();
};

/**
 * Calcular distancia de Levenshtein entre dos strings
 */
const calcularSimilitud = (str1, str2) => {
    const a = str1.toLowerCase();
    const b = str2.toLowerCase();

    if (a === b) return 100;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const maxLength = Math.max(a.length, b.length);
    const distance = matrix[b.length][a.length];
    return Math.round(((maxLength - distance) / maxLength) * 100);
};

/**
 * Buscar producto con coincidencia inteligente
 */
const buscarProductoInteligente = (codigoBuscado, productosDisponibles, umbralSimilitud = 85) => {
    const codigoNormalizado = normalizarCodigo(codigoBuscado);

    // 1. Búsqueda exacta normalizada
    for (const producto of productosDisponibles) {
        const codigoProductoNormalizado = normalizarCodigo(producto.codigo);
        if (codigoNormalizado === codigoProductoNormalizado) {
            return {
                encontrado: true,
                producto: producto,
                tipo_coincidencia: 'EXACTA_NORMALIZADA',
                similitud: 100
            };
        }
    }

    // 2. Búsqueda por similitud
    let mejorCoincidencia = null;
    let mayorSimilitud = 0;

    for (const producto of productosDisponibles) {
        const similitud = calcularSimilitud(codigoNormalizado, normalizarCodigo(producto.codigo));
        if (similitud >= umbralSimilitud && similitud > mayorSimilitud) {
            mayorSimilitud = similitud;
            mejorCoincidencia = {
                encontrado: false,
                producto: producto,
                tipo_coincidencia: 'SIMILAR',
                similitud: similitud,
                codigo_original: codigoBuscado,
                codigo_sugerido: producto.codigo
            };
        }
    }

    return mejorCoincidencia || {
        encontrado: false,
        producto: null,
        tipo_coincidencia: 'NO_ENCONTRADO',
        similitud: 0,
        codigo_original: codigoBuscado
    };
};

/**
 * Procesar upload masivo de stock (preview)
 */
const previewUploadStock = async (excelBuffer) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);
        
        const worksheet = workbook.getWorksheet(1);
        const productos = [];
        const errores = [];
        
        // Leer filas (saltar encabezado)
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Saltar encabezado
            
            // Formato actualizado: ALMACÉN | CÓDIGO | DESCRIPCIÓN | CANTIDAD | U.MEDIDA | DETALLE | STOCK_MIN | STOCK_MAX
            const producto = {
                fila: rowNumber,
                almacen_codigo: row.getCell(1).value,
                codigo_producto: row.getCell(2).value,
                descripcion: row.getCell(3).value,
                cantidad: Number(row.getCell(4).value) || 0,
                unidad_medida: row.getCell(5).value,
                stock_minimo: Number(row.getCell(6).value) || 0
            };
            
            // Validaciones básicas (formato actualizado)
            if (!producto.codigo_producto) {
                errores.push(`Fila ${rowNumber}: Código de producto requerido`);
            }

            if (!producto.almacen_codigo) {
                errores.push(`Fila ${rowNumber}: Nombre de almacén requerido`);
            }

            if (!producto.descripcion) {
                errores.push(`Fila ${rowNumber}: Descripción del producto requerida`);
            }

            if (producto.cantidad < 0) {
                errores.push(`Fila ${rowNumber}: Cantidad no puede ser negativa`);
            }

            if (!producto.unidad_medida) {
                errores.push(`Fila ${rowNumber}: Unidad de medida requerida`);
            } else if (!['MILLAR', 'UNIDAD', 'CIENTO', 'DOCENA', 'KILOGRAMO'].includes(producto.unidad_medida.toString().trim().toUpperCase())) {
                errores.push(`Fila ${rowNumber}: La unidad de medida debe ser MILLAR, UNIDAD, CIENTO, DOCENA o KILOGRAMO`);
            }
            
            productos.push(producto);
        });
        
        // Búsqueda inteligente de productos y validación de almacenes
        let productosValidos = [];
        let productosConErrores = [];
        let sugerenciasAutomaticas = [];
        let almacenesValidos = [];

        if (productos.length > 0) {
            // Obtener todos los productos de la base de datos para búsqueda inteligente
            const todosLosProductosResult = await query(`
                SELECT codigo, id, descripcion
                FROM productos
                WHERE activo = true
            `);
            const productosDisponibles = todosLosProductosResult.rows;

            // Validar almacenes
            const codigosAlmacenes = [...new Set(productos.map(p => p.almacen_codigo).filter(Boolean))];
            const almacenesPermitidos = [
                'Almacén nuevo', 'Almacén central', 'Distribuidor Ecococi',
                'Almacén oficina 2 piso', 'Almacén oficina 4 piso', 'Almacén oficina 5 piso',
                'Anaquel piso 2', 'Exhibición piso 1', 'Exhibición piso 2', 'Exhibición piso 3'
            ];

            if (codigosAlmacenes.length > 0) {
                const almacenesResult = await query(`
                    SELECT nombre, id FROM almacenes WHERE nombre = ANY($1) AND activo = true
                `, [codigosAlmacenes]);
                almacenesValidos = almacenesResult.rows.map(a => a.nombre);

                codigosAlmacenes.forEach(almacen => {
                    if (almacenesPermitidos.includes(almacen) && !almacenesValidos.includes(almacen)) {
                        almacenesValidos.push(almacen);
                    }
                });
            }

            // Procesar cada producto con búsqueda inteligente
            productos.forEach(producto => {
                // Validar producto con búsqueda inteligente
                if (producto.codigo_producto) {
                    const resultadoBusqueda = buscarProductoInteligente(
                        producto.codigo_producto,
                        productosDisponibles,
                        85 // 85% de similitud mínima
                    );

                    if (resultadoBusqueda.encontrado) {
                        // Producto encontrado (exacto o normalizado)
                        productosValidos.push({
                            ...producto,
                            producto_id: resultadoBusqueda.producto.id,
                            tipo_coincidencia: resultadoBusqueda.tipo_coincidencia,
                            similitud: resultadoBusqueda.similitud
                        });
                    } else if (resultadoBusqueda.tipo_coincidencia === 'SIMILAR') {
                        // Producto similar encontrado - generar sugerencia
                        sugerenciasAutomaticas.push({
                            ...producto,
                            codigo_original: resultadoBusqueda.codigo_original,
                            codigo_sugerido: resultadoBusqueda.codigo_sugerido,
                            producto_sugerido_id: resultadoBusqueda.producto.id,
                            similitud: resultadoBusqueda.similitud,
                            puede_corregir: true
                        });
                    } else {
                        // Producto no encontrado
                        productosConErrores.push({
                            ...producto,
                            error: `Producto '${producto.codigo_producto}' no encontrado`,
                            tipo_error: 'PRODUCTO_NO_ENCONTRADO',
                            puede_editar: true
                        });
                        errores.push(`Fila ${producto.fila}: Producto '${producto.codigo_producto}' no encontrado`);
                    }
                }

                // Validar almacén
                if (producto.almacen_codigo && !almacenesValidos.includes(producto.almacen_codigo)) {
                    if (!almacenesPermitidos.includes(producto.almacen_codigo)) {
                        errores.push(`Fila ${producto.fila}: Almacén '${producto.almacen_codigo}' no encontrado. Almacenes válidos: ${almacenesPermitidos.slice(0,3).join(', ')}...`);
                    }
                }
            });
        }
        
        return {
            success: true,
            data: {
                productos_procesados: productos.length,
                productos_validos: productosValidos,
                productos_con_errores: productosConErrores,
                sugerencias_automaticas: sugerenciasAutomaticas,
                errores: errores,

                // Contadores para la interfaz
                total_validos: productosValidos.length,
                total_errores: productosConErrores.length,
                total_sugerencias: sugerenciasAutomaticas.length,

                // Configuración de importación
                tiene_errores: errores.length > 0,
                puede_ejecutar_parcial: productosValidos.length > 0, // Nuevo: permite importar solo válidos
                puede_ejecutar_completo: errores.length === 0, // Original: todo perfecto

                // Preview para mostrar en UI - válidos limitados, errores/sugerencias completos
                preview_validos: productosValidos.slice(0, 10), // Solo preview de válidos
                todos_errores: productosConErrores, // TODOS los errores
                todas_sugerencias: sugerenciasAutomaticas, // TODAS las sugerencias

                // Mantengo los previews por compatibilidad
                preview_errores: productosConErrores.slice(0, 10),
                preview_sugerencias: sugerenciasAutomaticas.slice(0, 10)
            }
        };
        
    } catch (error) {
        logger.error('Error en previewUploadStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Ejecutar upload masivo de stock
 */
const ejecutarUploadStock = async (excelBuffer, usuario_id, modoImportacion = 'SOLO_VALIDOS') => {
    try {
        // Primero hacer preview para validaciones
        const preview = await previewUploadStock(excelBuffer);

        if (!preview.success) {
            return {
                success: false,
                error: 'Error procesando archivo',
                errores: preview.data?.errores || []
            };
        }

        // Verificar si hay productos válidos para importar
        if (preview.data.total_validos === 0) {
            return {
                success: false,
                error: 'No se encontraron productos válidos para importar',
                errores: preview.data?.errores || []
            };
        }

        // Según el modo de importación
        let productosAProcesar = [];

        switch (modoImportacion) {
            case 'SOLO_VALIDOS':
                productosAProcesar = preview.data.productos_validos;
                break;
            case 'TODO_PERFECTO':
                if (preview.data.tiene_errores) {
                    return {
                        success: false,
                        error: 'El archivo contiene errores. Debe corregirlos antes de ejecutar en modo completo.',
                        errores: preview.data?.errores || []
                    };
                }
                productosAProcesar = preview.data.productos_validos;
                break;
            default:
                productosAProcesar = preview.data.productos_validos;
        }
        // Obtener IDs de almacenes necesarios
        const codigosAlmacenes = [...new Set(productosAProcesar.map(p => p.almacen_codigo))];

        const almacenesResult = await query(`
            SELECT codigo, nombre, id
            FROM almacenes
            WHERE (UPPER(nombre) = ANY($1) OR UPPER(codigo) = ANY($1)) AND activo = true
        `, [codigosAlmacenes.map(a => a.toUpperCase())]);

        const almacenesMap = new Map();

        // Crear mapeo case-insensitive para los almacenes originales del Excel
        codigosAlmacenes.forEach(almacenOriginal => {
            const almacenEncontrado = almacenesResult.rows.find(a =>
                a.nombre.toUpperCase() === almacenOriginal.toUpperCase() ||
                a.codigo.toUpperCase() === almacenOriginal.toUpperCase()
            );
            if (almacenEncontrado) {
                almacenesMap.set(almacenOriginal, almacenEncontrado.id);
            }
        });

        let procesados = 0;
        let errores = 0;
        let omitidos = preview.data.total_errores + preview.data.total_sugerencias; // Productos no procesados

        // Arrays para rastrear códigos no encontrados
        const productosNoEncontrados = preview.data.productos_con_errores.map(p => ({
            codigo: p.codigo_producto,
            descripcion: p.descripcion
        }));
        const almacenesNoEncontrados = [];

        // Preparar datos para procesamiento batch
        const productosValidosParaProcesar = [];

        // Filtrar productos válidos con almacenes existentes
        for (const producto of productosAProcesar) {
            const almacen_id = almacenesMap.get(producto.almacen_codigo);

            if (!almacen_id) {
                console.log(`🏪 Almacén omitido (no existe): ${producto.almacen_codigo}`);
                almacenesNoEncontrados.push(producto.almacen_codigo);
                omitidos++;
                continue;
            }

            // Validar que el producto tenga los campos requeridos y IDs válidos
            if (producto.producto_id && producto.codigo_producto && almacen_id) {
                // Verificar si el producto_id es un UUID válido (no simulado)
                const isValidProductoUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(producto.producto_id);
                // Verificar si el almacen_id es un UUID válido
                const isValidAlmacenUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(almacen_id);

                if (isValidProductoUUID && isValidAlmacenUUID) {
                    productosValidosParaProcesar.push({
                        ...producto,
                        producto_id: producto.producto_id,
                        almacen_id: almacen_id,
                        cantidad: Number(producto.cantidad) || 0,
                        stock_minimo: Number(producto.stock_minimo) || 0
                    });
                } else {
                    console.log(`🚫 Producto omitido por UUID inválido: ${producto.codigo_producto} - Producto ID: ${producto.producto_id}, Almacén ID: ${almacen_id}`);
                    omitidos++;
                }
            } else {
                console.log(`🚫 Producto inválido omitido: ${producto.codigo_producto} - datos incompletos`);
                omitidos++;
            }
        }

        // ==================== AGRUPAR PRODUCTOS DUPLICADOS ====================
        // Agrupar productos por (producto_id, almacen_id) y sumar cantidades
        const productosAgrupados = new Map();

        productosValidosParaProcesar.forEach(producto => {
            const clave = `${producto.producto_id}-${producto.almacen_id}`;

            if (productosAgrupados.has(clave)) {
                // Producto duplicado: sumar cantidades y promediar stock_minimo
                const existente = productosAgrupados.get(clave);
                existente.cantidad += producto.cantidad;
                existente.stock_minimo = Math.max(existente.stock_minimo, producto.stock_minimo); // Usar el mayor stock mínimo
                existente.ubicaciones_encontradas = (existente.ubicaciones_encontradas || 1) + 1;
            } else {
                // Primer registro de este producto-almacén
                productosAgrupados.set(clave, {
                    ...producto,
                    ubicaciones_encontradas: 1
                });
            }
        });

        // Convertir el Map de vuelta a array
        const productosFinalesParaProcesar = Array.from(productosAgrupados.values());

        logger.info(`📦 Productos originales: ${productosValidosParaProcesar.length}, después de agrupar: ${productosFinalesParaProcesar.length}`);

        if (productosFinalesParaProcesar.length === 0) {
            logger.info('No hay productos válidos para procesar');
            return {
                success: true,
                data: {
                    productos_procesados: 0,
                    productos_con_error: 0,
                    productos_omitidos: omitidos,
                    total_productos: productosAProcesar.length,
                    productos_no_encontrados: preview.data.productos_con_errores.map(p => ({
                        codigo: p.codigo_producto,
                        descripcion: p.descripcion
                    })),
                    almacenes_no_encontrados: [...new Set(almacenesNoEncontrados)],
                    mensaje: `Procesados: 0, Omitidos: ${omitidos}, Errores: 0`
                }
            };
        }

        // Procesamiento optimizado en lotes
        try {
            logger.info(`Iniciando procesamiento batch de ${productosFinalesParaProcesar.length} productos`);

            // Convertir usuario_id a entero (compatibilidad con base de datos)
            let usuario_id_entero;
            if (typeof usuario_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuario_id)) {
                // Si es UUID, usar un ID fijo para testing (debería obtenerse de la tabla usuarios)
                usuario_id_entero = 1; // ID entero para almacén
            } else if (Number.isInteger(Number(usuario_id))) {
                usuario_id_entero = Number(usuario_id);
            } else {
                throw new Error(`Usuario ID inválido: ${usuario_id}. Se requiere un UUID o entero válido.`);
            }

            // Iniciar transacción
            await query('BEGIN');

            // 1. Obtener inventarios existentes en una sola consulta
            let inventariosExistentesResult = { rows: [] };

            if (productosFinalesParaProcesar.length > 0) {
                const productoIds = productosFinalesParaProcesar.map(p => p.producto_id);
                const almacenIds = productosFinalesParaProcesar.map(p => p.almacen_id);

                inventariosExistentesResult = await query(`
                    SELECT i.producto_id, i.almacen_id, i.stock_actual, i.id as inventario_id
                    FROM inventario i
                    INNER JOIN (
                        SELECT UNNEST($1::uuid[]) as producto_id, UNNEST($2::uuid[]) as almacen_id
                    ) as busqueda ON i.producto_id = busqueda.producto_id AND i.almacen_id = busqueda.almacen_id
                `, [productoIds, almacenIds]);
            }

            const inventariosExistentesMap = new Map();
            inventariosExistentesResult.rows.forEach(row => {
                inventariosExistentesMap.set(`${row.producto_id}-${row.almacen_id}`, row);
            });

            // 2. Preparar datos para UPSERT
            const inventariosParaActualizar = [];
            const inventariosParaCrear = [];
            const movimientosParaCrear = [];

            productosFinalesParaProcesar.forEach(producto => {
                const key = `${producto.producto_id}-${producto.almacen_id}`;
                const inventarioExistente = inventariosExistentesMap.get(key);

                if (inventarioExistente) {
                    // Actualizar existente
                    inventariosParaActualizar.push({
                        inventario_id: inventarioExistente.inventario_id,
                        stock_actual: producto.cantidad,
                        stock_minimo: producto.stock_minimo || 0,
                        updated_by: usuario_id_entero,
                        stock_anterior: inventarioExistente.stock_actual
                    });
                } else {
                    // Crear nuevo
                    inventariosParaCrear.push({
                        producto_id: producto.producto_id,
                        almacen_id: producto.almacen_id,
                        stock_actual: producto.cantidad,
                        stock_minimo: producto.stock_minimo || 0,
                        created_by: usuario_id_entero,
                        updated_by: usuario_id_entero,
                        stock_anterior: 0
                    });
                }

                // Preparar movimiento
                const motivo = `Upload masivo: ${producto.descripcion} - Unidad: ${producto.unidad_medida}`;
                movimientosParaCrear.push({
                    producto_id: producto.producto_id,
                    almacen_id: producto.almacen_id,
                    cantidad: producto.cantidad,
                    stock_anterior: inventarioExistente?.stock_actual || 0,
                    stock_posterior: producto.cantidad,
                    motivo: motivo,
                    usuario_id: usuario_id_entero
                });
            });

            // 3. Ejecutar updates masivos usando UNNEST (más eficiente y seguro)
            if (inventariosParaActualizar.length > 0) {
                const inventarioIds = inventariosParaActualizar.map(inv => inv.inventario_id);
                const stockActuales = inventariosParaActualizar.map(inv => inv.stock_actual);
                const stockMinimos = inventariosParaActualizar.map(inv => inv.stock_minimo);
                const updatedBy = inventariosParaActualizar.map(() => usuario_id_entero);

                // Validar que todos los inventarioIds sean UUIDs válidos
                const invalidInventarioIds = inventarioIds.filter(id =>
                    !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
                );
                if (invalidInventarioIds.length > 0) {
                    throw new Error(`IDs de inventario inválidos encontrados: ${invalidInventarioIds.join(', ')}`);
                }

                await query(`
                    UPDATE inventario
                    SET
                        stock_actual = data_table.stock_actual,
                        stock_minimo = data_table.stock_minimo,
                        updated_by = data_table.updated_by,
                        ultimo_movimiento = NOW(),
                        updated_at = NOW()
                    FROM (
                        SELECT * FROM UNNEST(
                            $1::uuid[], $2::numeric[], $3::numeric[], $4::integer[]
                        ) AS t(inventario_id, stock_actual, stock_minimo, updated_by)
                    ) AS data_table
                    WHERE inventario.id = data_table.inventario_id
                `, [inventarioIds, stockActuales, stockMinimos, updatedBy]);
            }

            // 4. Ejecutar inserts masivos para nuevos inventarios usando UNNEST
            if (inventariosParaCrear.length > 0) {
                const productoIds = inventariosParaCrear.map(inv => inv.producto_id);
                const almacenIds = inventariosParaCrear.map(inv => inv.almacen_id);
                const stockActuales = inventariosParaCrear.map(inv => inv.stock_actual);
                const stockMinimos = inventariosParaCrear.map(inv => inv.stock_minimo);
                const createdBy = inventariosParaCrear.map(() => usuario_id_entero);
                const updatedBy = inventariosParaCrear.map(() => usuario_id_entero);

                await query(`
                    INSERT INTO inventario (
                        id, producto_id, almacen_id, stock_actual, stock_minimo,
                        ultimo_movimiento, created_by, updated_by, created_at, updated_at, activo
                    )
                    SELECT
                        gen_random_uuid(),
                        data_table.producto_id,
                        data_table.almacen_id,
                        data_table.stock_actual,
                        data_table.stock_minimo,
                        NOW(),
                        data_table.created_by,
                        data_table.updated_by,
                        NOW(),
                        NOW(),
                        true
                    FROM (
                        SELECT * FROM UNNEST(
                            $1::uuid[], $2::uuid[], $3::numeric[], $4::numeric[],
                            $5::integer[], $6::integer[]
                        ) AS t(producto_id, almacen_id, stock_actual, stock_minimo, created_by, updated_by)
                    ) AS data_table
                `, [productoIds, almacenIds, stockActuales, stockMinimos, createdBy, updatedBy]);
            }

            // 5. Ejecutar inserts masivos para movimientos usando UNNEST
            if (movimientosParaCrear.length > 0) {
                const productoIds = movimientosParaCrear.map(mov => mov.producto_id);
                const almacenIds = movimientosParaCrear.map(mov => mov.almacen_id);
                const cantidades = movimientosParaCrear.map(mov => mov.cantidad);
                const stocksAnteriores = movimientosParaCrear.map(mov => mov.stock_anterior);
                const stocksPosteriores = movimientosParaCrear.map(mov => mov.stock_posterior);
                const motivos = movimientosParaCrear.map(mov => mov.motivo);
                const usuarioIds = movimientosParaCrear.map(mov => mov.usuario_id);

                await query(`
                    INSERT INTO movimientos_inventario (
                        id, producto_id, almacen_destino_id, tipo_movimiento, cantidad,
                        stock_anterior, stock_posterior, motivo, referencia_tipo, usuario_id, fecha_movimiento
                    )
                    SELECT
                        gen_random_uuid(),
                        data_table.producto_id,
                        data_table.almacen_id,
                        'INICIAL',
                        data_table.cantidad,
                        data_table.stock_anterior,
                        data_table.stock_posterior,
                        data_table.motivo,
                        'INICIAL',
                        data_table.usuario_id,
                        NOW()
                    FROM (
                        SELECT * FROM UNNEST(
                            $1::uuid[], $2::uuid[], $3::numeric[], $4::numeric[], $5::numeric[],
                            $6::text[], $7::integer[]
                        ) AS t(producto_id, almacen_id, cantidad, stock_anterior, stock_posterior, motivo, usuario_id)
                    ) AS data_table
                `, [productoIds, almacenIds, cantidades, stocksAnteriores, stocksPosteriores, motivos, usuarioIds]);
            }

            // Confirmar transacción
            await query('COMMIT');

            procesados = productosFinalesParaProcesar.length;

        } catch (error) {
            // Rollback en caso de error
            try {
                await query('ROLLBACK');
            } catch (rollbackError) {
                logger.error('Error en rollback:', rollbackError);
            }
            logger.error('Error en procesamiento batch:', {
                message: error.message,
                stack: error.stack,
                productos_a_procesar: productosFinalesParaProcesar.length
            });

            // Retornar error más específico
            return {
                success: false,
                error: `Error en procesamiento batch: ${error.message}`,
                debug_info: {
                    productos_validos: productosValidosParaProcesar.length,
                    error_details: error.message
                }
            };
        }
        
        logger.info('Upload masivo completado:', { procesados, errores, omitidos });

        return {
            success: true,
            data: {
                productos_procesados: procesados,
                productos_con_error: errores,
                productos_omitidos: omitidos,
                total_productos: productosAProcesar.length,
                productos_no_encontrados: productosNoEncontrados,
                almacenes_no_encontrados: [...new Set(almacenesNoEncontrados)], // Eliminar duplicados
                mensaje: `Procesados: ${procesados}, Omitidos: ${omitidos}, Errores: ${errores}`,
                productos_omitidos: productosNoEncontrados.length > 0 ?
                    productosNoEncontrados.map(p => p.codigo).slice(0, 10) :
                    []
            }
        };
        
    } catch (error) {
        logger.error('Error en ejecutarUploadStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};


// ==================== SERVICIOS DE ALERTAS ====================

/**
 * Generar alertas de stock bajo automáticamente
 */
const generarAlertasStockBajo = async () => {
    try {
        const inventariosBajosResult = await query(`
            SELECT 
                i.*,
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre
            FROM inventario i
            LEFT JOIN productos p ON i.producto_id = p.id
            LEFT JOIN almacenes a ON i.almacen_id = a.id
            WHERE i.stock_actual <= i.stock_minimo 
            AND i.stock_actual > 0 
            AND i.activo = true
        `);
        
        const inventariosBajos = inventariosBajosResult.rows;
        let alertasCreadas = 0;
        
        for (const inventario of inventariosBajos) {
            // Verificar si ya existe alerta activa
            const alertaExistenteResult = await query(`
                SELECT id 
                FROM alertas_inventario 
                WHERE producto_id = $1 AND almacen_id = $2 
                AND tipo_alerta = 'STOCK_MINIMO' AND activa = true
            `, [inventario.producto_id, inventario.almacen_id]);
            
            if (alertaExistenteResult.rows.length === 0) {
                await query(`
                    INSERT INTO alertas_inventario (
                        id, producto_id, almacen_id, tipo_alerta, nivel_prioridad,
                        mensaje, stock_actual, stock_minimo, fecha_alerta, activa
                    ) VALUES (
                        gen_random_uuid(), $1, $2, 'STOCK_MINIMO', 'MEDIA', $3, $4, $5, NOW(), true
                    )
                `, [
                    inventario.producto_id,
                    inventario.almacen_id,
                    `${inventario.producto_codigo} - Stock: ${inventario.stock_actual}, Mínimo: ${inventario.stock_minimo}`,
                    inventario.stock_actual,
                    inventario.stock_minimo
                ]);
                
                alertasCreadas++;
            }
        }
        
        logger.info('Alertas de stock bajo generadas:', { alertasCreadas });
        
        return {
            success: true,
            data: {
                productos_revisados: inventariosBajos.length,
                alertas_creadas: alertasCreadas
            }
        };
        
    } catch (error) {
        logger.error('Error en generarAlertasStockBajo:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Limpiar alertas resueltas antiguas
 */
const limpiarAlertasAntiguas = async (diasAntiguedad = 30) => {
    try {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);
        
        const deleteResult = await query(`
            DELETE FROM alertas_inventario 
            WHERE activa = false 
            AND fecha_resolucion <= $1
            RETURNING id
        `, [fechaLimite.toISOString()]);
        
        const alertasEliminadas = deleteResult.rows.length;
        
        logger.info('Alertas antiguas eliminadas:', { alertasEliminadas, diasAntiguedad });
        
        return {
            success: true,
            data: {
                alertas_eliminadas: alertasEliminadas,
                dias_antiguedad: diasAntiguedad
            }
        };
        
    } catch (error) {
        logger.error('Error en limpiarAlertasAntiguas:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ==================== FUNCIÓN CONSOLIDADA DE REPORTES ====================
const getReportesConsolidado = async (tipo_reporte, periodo = '30d') => {
    try {
        // Llamar directamente a la función específica sin múltiples queries
        switch (tipo_reporte) {
            case 'performance':
                return await getPerformanceComparativa(periodo);
            case 'alertas':
                return await getAnalisisPredictivoAlertas(periodo);
            case 'valorizacion':
                return await getValorizacionEvolutiva(periodo);
            case 'kardex':
                return await getKardexInteligente(periodo);
            case 'despachos':
                return await getEficienciaDespachos(periodo);
            default:
                return { success: false, error: 'Tipo de reporte no válido' };
        }
    } catch (error) {
        console.error('Error en getReportesConsolidado:', error);
        return {
            success: false,
            error: 'Error obteniendo reporte consolidado: ' + error.message
        };
    }
};


module.exports = {
    // Funciones para controlador (NUEVAS - agregar estas 9)
    obtenerDashboardMetricas,
    obtenerInventarioConFiltros,
    obtenerMovimientosConFiltros,
    obtenerKardexProducto,
    obtenerAlmacenesConJerarquia,
    obtenerAlertasConFiltros,
    resolverAlerta,
    actualizarStockProducto,
    verificarSaludSistema,
    ejecutarQueryPersonalizada,

    // Análisis de inventario (NUEVAS)
    getRotacionInventario,
    getEficienciaOperativa,
    getAnalisisStockSeguridad,
    getMapaCalorAlmacenes,
    getTendenciasInventario,
    
    // Stock
    verificarStockDisponible,
    descontarStockVenta,
    transferirStock,
    verificarYCrearAlertas,
    
    // Despachos
    obtenerDespachos,
    obtenerDespachoPorId,
    crearDespachoDesdeVenta,
    actualizarEstadoDespacho,
    actualizarEstadoVentaDesdeDespacho,
    
    // Reportes
    generarKardex, // Renombrado para consistencia
    generarReporteValorizacion,
    obtenerStockConsolidado,
    
    // Upload masivo
    generarPlantillaStock,
    previewUploadStock,
    ejecutarUploadStock,
    
    // Alertas
    generarAlertasStockBajo,
    limpiarAlertasAntiguas
}; 
console.log('✅ almacenService cargado con funciones:', Object.keys(module.exports).length);
