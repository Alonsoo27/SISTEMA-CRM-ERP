const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const almacenService = require('../services/almacenService');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'almacen-controller' },
    transports: [
        new winston.transports.File({ filename: 'logs/almacen.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// CONSTANTES
const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA', 'INICIAL'];
const TIPOS_REFERENCIA = ['VENTA', 'COMPRA', 'AJUSTE', 'TRANSFERENCIA', 'INICIAL', 'DEVOLUCION'];
const NIVELES_ALERTA = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

// ==================== DASHBOARD PRINCIPAL ====================

const obtenerDashboard = async (req, res) => {
    try {
        const { almacen_id } = req.query;

        // Obtener métricas principales
        const metricas = await Promise.all([
            // Total productos con stock
            supabase
                .from('vista_inventario_completo')
                .select('*', { count: 'exact', head: true })
                .gt('stock_actual', 0),

            // Productos con stock bajo
            supabase
                .from('vista_inventario_completo')
                .select('*', { count: 'exact', head: true })
                .eq('estado_stock', 'BAJO'),

            // Productos agotados
            supabase
                .from('vista_inventario_completo')
                .select('*', { count: 'exact', head: true })
                .eq('estado_stock', 'AGOTADO'),

            // Valor total de inventario
            supabase
                .from('vista_inventario_completo')
                .select('valor_inventario.sum()'),

            // Movimientos del día
            supabase
                .from('movimientos_inventario')
                .select('*', { count: 'exact', head: true })
                .gte('fecha_movimiento', new Date().toISOString().split('T')[0]),

            // Alertas activas
            supabase
                .from('alertas_inventario')
                .select('*', { count: 'exact', head: true })
                .eq('activa', true),

            // Despachos pendientes
            supabase
                .from('despachos')
                .select('*', { count: 'exact', head: true })
                .eq('activo', true)
                .in('estado', ['PENDIENTE', 'PREPARANDO']),

            // Despachos del día
            supabase
                .from('despachos')
                .select('*', { count: 'exact', head: true })
                .eq('activo', true)  
                .eq('fecha_programada', new Date().toISOString().split('T')[0])
        ]);

        // Obtener productos con mayor rotación (últimos 30 días)
        const { data: productosRotacion } = await supabase
            .from('movimientos_inventario')
            .select(`
                producto_id,
                productos:producto_id (codigo, descripcion),
                cantidad.sum()
            `)
            .eq('tipo_movimiento', 'SALIDA')
            .gte('fecha_movimiento', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('cantidad.sum()', { ascending: false })
            .limit(10);

        // Obtener despachos próximos
        const { data: despachoProximos } = await supabase
            .from('despachos')
            .select(`
                *,
                ventas:venta_id (
                    codigo,
                    nombre_cliente,
                    apellido_cliente,
                    valor_final
                ),
                almacenes:almacen_id (
                    codigo,
                    nombre
                )
            `)
            .eq('activo', true)
            .in('estado', ['PENDIENTE', 'PREPARANDO'])
            .lte('fecha_programada', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('fecha_programada')
            .limit(15);

        // Obtener alertas críticas
        const { data: alertasCriticas } = await supabase
            .from('alertas_inventario')
            .select(`
                *,
                productos:producto_id (codigo, descripcion),
                almacenes:almacen_id (codigo, nombre)
            `)
            .eq('activa', true)
            .in('nivel_prioridad', ['ALTA', 'CRITICA'])
            .order('fecha_alerta', { ascending: false })
            .limit(10);

        res.json({
            success: true,
            data: {
                metricas: {
                    productos_con_stock: metricas[0].count || 0,
                    productos_stock_bajo: metricas[1].count || 0,
                    productos_agotados: metricas[2].count || 0,
                    valor_total_inventario: metricas[3].data?.[0]?.sum || 0,
                    movimientos_dia: metricas[4].count || 0,
                    alertas_activas: metricas[5].count || 0,
                    despachos_pendientes: metricas[6].count || 0,
                    despachos_dia: metricas[7].count || 0
                },
                productos_mayor_rotacion: productosRotacion || [],
                despachos_proximos: despachoProximos || [],
                alertas_criticas: alertasCriticas || []
            }
        });

    } catch (error) {
        logger.error('Error en obtenerDashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== GESTIÓN DE INVENTARIO ====================

const obtenerInventario = async (req, res) => {
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
        } = req.query;

        let query = supabase
            .from('vista_inventario_completo')
            .select('*');

        // Filtros
        if (categoria) {
            query = query.eq('categoria', categoria);
        }

        if (busqueda) {
            query = query.or(
                `producto_codigo.ilike.%${busqueda}%,producto_descripcion.ilike.%${busqueda}%,marca.ilike.%${busqueda}%`
            );
        }

        if (estado_stock) {
            query = query.eq('estado_stock', estado_stock);
        }

        if (almacen_id) {
            query = query.eq('almacen_id', almacen_id);
        }

        // Ordenamiento
        const ordenValido = ['producto_codigo', 'producto_descripcion', 'stock_actual', 'stock_minimo', 'valor_inventario', 'ultimo_movimiento'];
        if (ordenValido.includes(orden)) {
            query = query.order(orden, { ascending: direccion === 'asc' });
        }

        // Paginación
        const offset = (Number(page) - 1) * Number(limit);
        query = query.range(offset, offset + Number(limit) - 1);

        const { data, error } = await query;

        if (error) {
            logger.error('Error al obtener inventario:', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            });
        }

        // Obtener conteo total
        const { count: totalRegistros } = await supabase
            .from('vista_inventario_completo')
            .select('*', { count: 'exact', head: true });

        res.json({
            success: true,
            data: data || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalRegistros || 0,
                totalPages: Math.ceil((totalRegistros || 0) / Number(limit))
            }
        });

    } catch (error) {
        logger.error('Error en obtenerInventario:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerInventarioPorProducto = async (req, res) => {
    try {
        const { producto_id } = req.params;

        const { data, error } = await supabase
            .from('vista_inventario_completo')
            .select('*')
            .eq('producto_id', producto_id);

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        logger.error('Error en obtenerInventarioPorProducto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const actualizarStockProducto = async (req, res) => {
    try {
        const { producto_id, almacen_id } = req.params;
        const {
            stock_actual,
            stock_minimo,
            stock_maximo,
            costo_promedio,
            motivo = 'Ajuste manual desde panel'
        } = req.body;

        // Validaciones
        if (stock_actual < 0) {
            return res.status(400).json({
                success: false,
                error: 'El stock actual no puede ser negativo'
            });
        }

        if (stock_minimo < 0) {
            return res.status(400).json({
                success: false,
                error: 'El stock mínimo no puede ser negativo'
            });
        }

        // Obtener stock anterior
        const { data: inventarioAnterior, error: errorAnterior } = await supabase
            .from('inventario')
            .select('stock_actual')
            .eq('producto_id', producto_id)
            .eq('almacen_id', almacen_id)
            .single();

        if (errorAnterior && errorAnterior.code !== 'PGRST116') {
            throw errorAnterior;
        }

        const stockAnterior = inventarioAnterior?.stock_actual || 0;
        const diferencia = Number(stock_actual) - stockAnterior;

        // Actualizar o insertar inventario
        const datosInventario = {
            producto_id: producto_id,
            almacen_id: almacen_id,
            stock_actual: Number(stock_actual),
            stock_minimo: Number(stock_minimo),
            stock_maximo: stock_maximo ? Number(stock_maximo) : null,
            costo_promedio: costo_promedio ? Number(costo_promedio) : null,
            ultimo_movimiento: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: req.user?.id || 1
        };

        if (inventarioAnterior) {
            // Actualizar existente
            const { data, error } = await supabase
                .from('inventario')
                .update(datosInventario)
                .eq('producto_id', producto_id)
                .eq('almacen_id', almacen_id)
                .select()
                .single();

            if (error) throw error;
        } else {
            // Insertar nuevo
            const { data, error } = await supabase
                .from('inventario')
                .insert({
                    id: uuidv4(),
                    ...datosInventario,
                    created_by: req.user?.id || 1
                })
                .select()
                .single();

            if (error) throw error;
        }

        // Registrar movimiento si hay diferencia
        if (diferencia !== 0) {
            const tipoMovimiento = diferencia > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';
            
            await supabase
                .from('movimientos_inventario')
                .insert({
                    id: uuidv4(),
                    producto_id: producto_id,
                    almacen_destino_id: almacen_id,
                    tipo_movimiento: tipoMovimiento,
                    cantidad: Math.abs(diferencia),
                    precio_unitario: costo_promedio || 0,
                    stock_anterior: stockAnterior,
                    stock_posterior: Number(stock_actual),
                    motivo: motivo,
                    referencia_tipo: 'AJUSTE',
                    usuario_id: req.user?.id || 1
                });
        }

        // Verificar alertas de stock mínimo
        if (Number(stock_actual) <= Number(stock_minimo) && Number(stock_actual) > 0) {
            await supabase
                .from('alertas_inventario')
                .insert({
                    id: uuidv4(),
                    producto_id: producto_id,
                    almacen_id: almacen_id,
                    tipo_alerta: 'STOCK_MINIMO',
                    nivel_prioridad: 'MEDIA',
                    mensaje: `Stock por debajo del mínimo establecido`,
                    stock_actual: Number(stock_actual),
                    stock_minimo: Number(stock_minimo)
                });
        } else if (Number(stock_actual) === 0) {
            await supabase
                .from('alertas_inventario')
                .insert({
                    id: uuidv4(),
                    producto_id: producto_id,
                    almacen_id: almacen_id,
                    tipo_alerta: 'STOCK_AGOTADO',
                    nivel_prioridad: 'CRITICA',
                    mensaje: `Producto agotado en almacén`,
                    stock_actual: 0,
                    stock_minimo: Number(stock_minimo)
                });
        }

        logger.info('Stock actualizado exitosamente', {
            producto_id,
            almacen_id,
            stock_anterior: stockAnterior,
            stock_nuevo: stock_actual,
            diferencia
        });

        res.json({
            success: true,
            message: 'Stock actualizado exitosamente',
            data: {
                stock_anterior: stockAnterior,
                stock_actual: Number(stock_actual),
                diferencia: diferencia
            }
        });

    } catch (error) {
        logger.error('Error en actualizarStockProducto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== GESTIÓN DE MOVIMIENTOS ====================

const obtenerMovimientos = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            producto_id,
            almacen_id,
            tipo_movimiento,
            fecha_desde,
            fecha_hasta,
            orden = 'fecha_movimiento',
            direccion = 'desc'
        } = req.query;

        let query = supabase
            .from('movimientos_inventario')
            .select(`
                *,
                productos:producto_id (codigo, descripcion),
                almacenes_origen:almacen_origen_id (codigo, nombre),
                almacenes_destino:almacen_destino_id (codigo, nombre),
                usuarios:usuario_id (nombre, apellido)
            `);

        // Filtros
        if (producto_id) {
            query = query.eq('producto_id', producto_id);
        }

        if (almacen_id) {
            query = query.or(`almacen_origen_id.eq.${almacen_id},almacen_destino_id.eq.${almacen_id}`);
        }

        if (tipo_movimiento) {
            query = query.eq('tipo_movimiento', tipo_movimiento);
        }

        if (fecha_desde) {
            query = query.gte('fecha_movimiento', fecha_desde);
        }

        if (fecha_hasta) {
            query = query.lte('fecha_movimiento', fecha_hasta);
        }

        // Ordenamiento
        const ordenValido = ['fecha_movimiento', 'tipo_movimiento', 'cantidad'];
        if (ordenValido.includes(orden)) {
            query = query.order(orden, { ascending: direccion === 'asc' });
        }

        // Paginación
        const offset = (Number(page) - 1) * Number(limit);
        query = query.range(offset, offset + Number(limit) - 1);

        const { data, error } = await query;

        if (error) {
            logger.error('Error al obtener movimientos:', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            });
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        logger.error('Error en obtenerMovimientos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== GESTIÓN DE TRANSFERENCIAS ====================

const transferirStock = async (req, res) => {
    try {
        const {
            producto_id,
            almacen_origen_id,
            almacen_destino_id,
            cantidad,
            motivo = 'Transferencia manual'
        } = req.body;

        // Validaciones básicas
        if (!producto_id || !almacen_origen_id || !almacen_destino_id || !cantidad) {
            return res.status(400).json({
                success: false,
                error: 'Todos los campos son requeridos'
            });
        }

        if (cantidad <= 0) {
            return res.status(400).json({
                success: false,
                error: 'La cantidad debe ser mayor a cero'
            });
        }

        if (almacen_origen_id === almacen_destino_id) {
            return res.status(400).json({
                success: false,
                error: 'El almacén origen y destino no pueden ser el mismo'
            });
        }

        // Usar el service para realizar la transferencia
        const resultado = await almacenService.transferirStock(
            producto_id,
            almacen_origen_id,
            almacen_destino_id,
            cantidad,
            motivo,
            req.user?.id || 1
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        logger.info('Transferencia realizada exitosamente', {
            producto_id,
            almacen_origen_id,
            almacen_destino_id,
            cantidad,
            usuario: req.user?.id
        });

        res.json({
            success: true,
            message: 'Transferencia realizada exitosamente',
            data: resultado.data
        });

    } catch (error) {
        logger.error('Error en transferirStock:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== GESTIÓN DE ALMACENES ====================

const obtenerAlmacenes = async (req, res) => {
    try {
        const { incluir_jerarquia = true } = req.query;

        let query = supabase
            .from('almacenes')
            .select('*')
            .eq('activo', true);

        if (incluir_jerarquia === 'true') {
            query = query.select(`
                *,
                almacen_padre:almacen_padre_id (
                    codigo,
                    nombre
                )
            `);
        }

        query = query.order('tipo').order('piso').order('nombre');

        const { data, error } = await query;

        if (error) {
            logger.error('Error al obtener almacenes:', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            });
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        logger.error('Error en obtenerAlmacenes:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== GESTIÓN DE ALERTAS ====================

const obtenerAlertas = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            nivel_prioridad,
            tipo_alerta,
            activa = true
        } = req.query;

        let query = supabase
            .from('alertas_inventario')
            .select(`
                *,
                productos:producto_id (codigo, descripcion),
                almacenes:almacen_id (codigo, nombre)
            `);

        if (activa !== 'all') {
            query = query.eq('activa', activa === 'true');
        }

        if (nivel_prioridad) {
            query = query.eq('nivel_prioridad', nivel_prioridad);
        }

        if (tipo_alerta) {
            query = query.eq('tipo_alerta', tipo_alerta);
        }

        query = query.order('fecha_alerta', { ascending: false });

        const offset = (Number(page) - 1) * Number(limit);
        query = query.range(offset, offset + Number(limit) - 1);

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        logger.error('Error en obtenerAlertas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const resolverAlerta = async (req, res) => {
    try {
        const { id } = req.params;
        const { observaciones_resolucion } = req.body;

        const { data, error } = await supabase
            .from('alertas_inventario')
            .update({
                activa: false,
                fecha_resolucion: new Date().toISOString(),
                resuelto_por: req.user?.id || 1,
                observaciones_resolucion: observaciones_resolucion || 'Resuelta manualmente'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            message: 'Alerta resuelta exitosamente',
            data: data
        });

    } catch (error) {
        logger.error('Error en resolverAlerta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== GESTIÓN DE DESPACHOS (FUNCIONES FALTANTES) ====================

const obtenerDespachos = async (req, res) => {
    try {
        const filtros = req.query;
        const resultado = await almacenService.obtenerDespachos(filtros);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerDespachos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerDespachoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await almacenService.obtenerDespachoPorId(id);

        if (!resultado.success) {
            return res.status(404).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerDespachoPorId:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const actualizarEstadoDespacho = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevo_estado, observaciones } = req.body;

        const resultado = await almacenService.actualizarEstadoDespacho(
            id,
            nuevo_estado,
            req.user?.id || 1,
            observaciones
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en actualizarEstadoDespacho:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const crearDespachoDesdeVenta = async (req, res) => {
    try {
        const resultado = await almacenService.crearDespachoDesdeVenta(req.body);

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en crearDespachoDesdeVenta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== REPORTES (FUNCIONES FALTANTES) ====================

const generarKardex = async (req, res) => {
    try {
        const { producto_id } = req.params;
        const { almacen_id, fecha_desde, fecha_hasta } = req.query;

        const resultado = await almacenService.generarKardex(
            producto_id,
            almacen_id,
            fecha_desde,
            fecha_hasta
        );

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en generarKardex:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const generarReporteValorizacion = async (req, res) => {
    try {
        const { almacen_id, categoria_id } = req.query;

        const resultado = await almacenService.generarReporteValorizacion(
            almacen_id,
            categoria_id
        );

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en generarReporteValorizacion:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerStockConsolidado = async (req, res) => {
    try {
        const resultado = await almacenService.obtenerStockConsolidado();

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerStockConsolidado:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== UPLOAD MASIVO (FUNCIONES FALTANTES) ====================

const generarPlantillaStock = async (req, res) => {
    try {
        const resultado = await almacenService.generarPlantillaStock();

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${resultado.filename}"`);
        
        res.send(resultado.data);

    } catch (error) {
        logger.error('Error en generarPlantillaStock:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const previewUploadStock = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo Excel'
            });
        }

        const resultado = await almacenService.previewUploadStock(req.file.buffer);

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en previewUploadStock:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const ejecutarUploadStock = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo Excel'
            });
        }

        const resultado = await almacenService.ejecutarUploadStock(
            req.file.buffer,
            req.user?.id || 1
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en ejecutarUploadStock:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== INTEGRACIÓN CON VENTAS (FUNCIONES FALTANTES) ====================

const verificarStockParaVenta = async (req, res) => {
    try {
        const { productos, almacen_id } = req.body;

        const resultado = await almacenService.verificarStockDisponible(productos, almacen_id);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en verificarStockParaVenta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const descontarStockVenta = async (req, res) => {
    try {
        const { venta_id, productos, almacen_id } = req.body;

        const resultado = await almacenService.descontarStockVenta(
            venta_id,
            productos,
            almacen_id,
            req.user?.id || 1
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en descontarStockVenta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== ANÁLISIS ESPECÍFICOS (NUEVOS) ====================

const obtenerRotacionInventario = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';
        const resultado = await almacenService.getRotacionInventario(periodo);
        
        if (!resultado.success) {
            return res.status(500).json(resultado);
        }
        
        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerRotacionInventario:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerEficienciaOperativa = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';
        const resultado = await almacenService.getEficienciaOperativa(periodo);
        
        if (!resultado.success) {
            return res.status(500).json(resultado);
        }
        
        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerEficienciaOperativa:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerAnalisisStockSeguridad = async (req, res) => {
    try {
        const resultado = await almacenService.getAnalisisStockSeguridad();
        
        if (!resultado.success) {
            return res.status(500).json(resultado);
        }
        
        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerAnalisisStockSeguridad:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerMapaCalorAlmacenes = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';
        const resultado = await almacenService.getMapaCalorAlmacenes(periodo);
        
        if (!resultado.success) {
            return res.status(500).json(resultado);
        }
        
        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerMapaCalorAlmacenes:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerTendenciasInventario = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';
        const resultado = await almacenService.getTendenciasInventario(periodo);
        
        if (!resultado.success) {
            return res.status(500).json(resultado);
        }
        
        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerTendenciasInventario:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const ejecutarQuery = async (req, res) => {
    try {
        const { query, params = [] } = req.body;
        
        // Validaciones de seguridad básicas
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query inválida'
            });
        }
        
        const queryLimpia = query.trim().toLowerCase();
        if (!queryLimpia.startsWith('select')) {
            return res.status(400).json({
                success: false,
                error: 'Solo se permiten consultas SELECT'
            });
        }
        
        // Por simplicidad, usar alguna función existente del service
        // O implementar lógica específica según necesites
        res.json({
            success: true,
            message: 'Funcionalidad de query personalizada disponible',
            data: []
        });
        
    } catch (error) {
        logger.error('Error en ejecutarQuery:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

    // ==================== REPORTES AVANZADOS (FUNCIONES FALTANTES) ====================

const getPerformanceComparativa = async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, almacen_id } = req.query;
        const periodo = req.query.periodo || '30d'; // Parámetro adicional

        const resultado = await almacenService.getPerformanceComparativa(periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en getPerformanceComparativa:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const getAnalisisPredictivoAlertas = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';

        const resultado = await almacenService.getAnalisisPredictivoAlertas(periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en getAnalisisPredictivoAlertas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const getValorizacionEvolutiva = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';

        const resultado = await almacenService.getValorizacionEvolutiva(periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en getValorizacionEvolutiva:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const getKardexInteligente = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';

        const resultado = await almacenService.getKardexInteligente(periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en getKardexInteligente:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const getEficienciaDespachos = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';

        const resultado = await almacenService.getEficienciaDespachos(periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en getEficienciaDespachos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== MANTENIMIENTO (FUNCIONES FALTANTES) ====================

const generarAlertasAutomaticas = async (req, res) => {
    try {
        const resultado = await almacenService.generarAlertasStockBajo();

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json({
            success: true,
            message: 'Alertas automáticas generadas exitosamente',
            data: resultado.data
        });

    } catch (error) {
        logger.error('Error en generarAlertasAutomaticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const limpiarAlertasAntiguas = async (req, res) => {
    try {
        const { dias = 30 } = req.query;
        
        const resultado = await almacenService.limpiarAlertasAntiguas(Number(dias));

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json({
            success: true,
            message: 'Alertas antiguas eliminadas exitosamente',
            data: resultado.data
        });

    } catch (error) {
        logger.error('Error en limpiarAlertasAntiguas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== UTILIDADES ====================

const healthCheck = async (req, res) => {
    try {
        // Verificar conexión a BD
        const dbStart = Date.now();
        const { error } = await supabase
            .from('almacenes')
            .select('id')
            .limit(1)
            .single();
        const dbTime = Date.now() - dbStart;

        const memory = process.memoryUsage();
        const uptime = process.uptime();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: !error,
                responseTime: `${dbTime}ms`,
                status: dbTime < 1000 ? 'good' : dbTime < 3000 ? 'warning' : 'slow'
            },
            memory: {
                rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`
            },
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            version: '1.0.0',
            module: 'Almacén'
        });
    } catch (error) {
        logger.error('Error en healthcheck:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
    // Dashboard
    obtenerDashboard,
    
    // Inventario
    obtenerInventario,
    obtenerInventarioPorProducto,
    actualizarStockProducto,
    
    // Movimientos
    obtenerMovimientos,
    transferirStock,
    
    // Almacenes
    obtenerAlmacenes,
    
    // Alertas
    obtenerAlertas,
    resolverAlerta,
    
    // Despachos (agregadas)
    obtenerDespachos,
    obtenerDespachoPorId,
    actualizarEstadoDespacho,
    crearDespachoDesdeVenta,
    
    // Reportes (agregadas)
    generarKardex,
    generarReporteValorizacion,
    obtenerStockConsolidado,
    
    // Upload masivo (agregadas)
    generarPlantillaStock,
    previewUploadStock,
    ejecutarUploadStock,
    
    // Integración con ventas (agregadas)
    verificarStockParaVenta,
    descontarStockVenta,
    
    // Mantenimiento (agregadas)
    generarAlertasAutomaticas,
    limpiarAlertasAntiguas,

    obtenerRotacionInventario,
    obtenerEficienciaOperativa,
    obtenerAnalisisStockSeguridad,
    obtenerMapaCalorAlmacenes,
    obtenerTendenciasInventario,
    ejecutarQuery,
    
    // Reportes avanzados (AGREGAR ESTAS 5)
    getPerformanceComparativa,
    getAnalisisPredictivoAlertas,
    getValorizacionEvolutiva,
    getKardexInteligente,
    getEficienciaDespachos,
    
    // Utilidades
    healthCheck
};