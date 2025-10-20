const winston = require('winston');
const almacenService = require('../services/almacenService');
const reportesService = require('../services/reportesService');

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

        // Delegar al service para obtener métricas del dashboard
        const resultado = await almacenService.obtenerDashboardMetricas(almacen_id);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

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
        const filtros = {
            page: req.query.page || 1,
            limit: req.query.limit || 20,
            categoria: req.query.categoria,
            busqueda: req.query.busqueda,
            estado_stock: req.query.estado_stock,
            almacen_id: req.query.almacen_id,
            orden: req.query.orden || 'producto_codigo',
            direccion: req.query.direccion || 'asc'
        };

        const resultado = await almacenService.obtenerInventarioConFiltros(filtros);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

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

        const resultado = await almacenService.obtenerInventarioPorProducto(producto_id);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

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

        const datosActualizacion = {
            producto_id,
            almacen_id,
            stock_actual: Number(stock_actual),
            stock_minimo: Number(stock_minimo),
            stock_maximo: stock_maximo ? Number(stock_maximo) : null,
            costo_promedio: costo_promedio ? Number(costo_promedio) : null,
            motivo,
            usuario_id: req.user?.id
        };

        const resultado = await almacenService.actualizarStockProducto(datosActualizacion);

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        logger.info('Stock actualizado exitosamente', {
            producto_id,
            almacen_id,
            stock_actual,
            usuario: req.user?.id
        });

        res.json({
            success: true,
            message: 'Stock actualizado exitosamente',
            data: resultado.data
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
        const filtros = {
            page: req.query.page || 1,
            limit: req.query.limit || 20,
            producto_id: req.query.producto_id,
            almacen_id: req.query.almacen_id,
            tipo_movimiento: req.query.tipo_movimiento,
            fecha_desde: req.query.fecha_desde,
            fecha_hasta: req.query.fecha_hasta,
            orden: req.query.orden || 'fecha_movimiento',
            direccion: req.query.direccion || 'desc'
        };

        const resultado = await almacenService.obtenerMovimientosConFiltros(filtros);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerMovimientos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== KARDEX DE PRODUCTO ====================

const obtenerKardexProducto = async (req, res) => {
    try {
        const { producto_id } = req.params;
        const filtros = {
            producto_id,
            almacen_id: req.query.almacen_id,
            fecha_desde: req.query.fecha_desde,
            fecha_hasta: req.query.fecha_hasta,
            limit: req.query.limit || 100,
            orden: req.query.orden || 'fecha_movimiento',
            direccion: req.query.direccion || 'asc'
        };

        // Validación básica
        if (!producto_id) {
            return res.status(400).json({
                success: false,
                error: 'El ID del producto es requerido'
            });
        }

        const resultado = await almacenService.obtenerKardexProducto(filtros);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerKardexProducto:', error);
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
            req.user?.id
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

        const resultado = await almacenService.obtenerAlmacenesConJerarquia(incluir_jerarquia === 'true');

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

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
        const filtros = {
            page: req.query.page || 1,
            limit: req.query.limit || 20,
            nivel_prioridad: req.query.nivel_prioridad,
            tipo_alerta: req.query.tipo_alerta,
            activa: req.query.activa !== 'all' ? req.query.activa === 'true' : null
        };

        const resultado = await almacenService.obtenerAlertasConFiltros(filtros);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

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

        const resultado = await almacenService.resolverAlerta(
            id,
            req.user?.id,
            observaciones_resolucion || 'Resuelta manualmente'
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json({
            success: true,
            message: 'Alerta resuelta exitosamente',
            data: resultado.data
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

// ==================== GESTIÓN DE DESPACHOS ====================

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
            req.user?.id,
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

const actualizarEstadoDespachosMultiples = async (req, res) => {
    try {
        const { despacho_ids, nuevo_estado, observaciones } = req.body;

        if (!Array.isArray(despacho_ids) || despacho_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de IDs de despachos'
            });
        }

        if (!nuevo_estado) {
            return res.status(400).json({
                success: false,
                error: 'El nuevo estado es requerido'
            });
        }

        const resultado = await almacenService.actualizarEstadoDespachosMultiples(
            despacho_ids,
            nuevo_estado,
            req.user?.id,
            observaciones
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        logger.info('Despachos actualizados múltiples exitosamente', {
            cantidad: despacho_ids.length,
            nuevo_estado,
            usuario: req.user?.id
        });

        res.json(resultado);

    } catch (error) {
        logger.error('Error en actualizarEstadoDespachosMultiples:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const asignarDespachosMultiples = async (req, res) => {
    try {
        const { despacho_ids, asignado_a_id, asignado_a_nombre } = req.body;

        if (!Array.isArray(despacho_ids) || despacho_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de IDs de despachos'
            });
        }

        if (!asignado_a_id) {
            return res.status(400).json({
                success: false,
                error: 'El ID del usuario asignado es requerido'
            });
        }

        const resultado = await almacenService.asignarDespachosMultiples(
            despacho_ids,
            asignado_a_id,
            asignado_a_nombre,
            req.user?.id
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        logger.info('Despachos asignados múltiples exitosamente', {
            cantidad: despacho_ids.length,
            asignado_a_id,
            usuario: req.user?.id
        });

        res.json(resultado);

    } catch (error) {
        logger.error('Error en asignarDespachosMultiples:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerHistorialDespacho = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'El ID del despacho es requerido'
            });
        }

        const resultado = await almacenService.obtenerHistorialDespacho(id);

        if (!resultado.success) {
            return res.status(404).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerHistorialDespacho:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerNotificacionesUsuario = async (req, res) => {
    try {
        const usuario_id = req.user?.id;
        const { solo_no_leidas = 'true', limit = 20, offset = 0 } = req.query;

        if (!usuario_id) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado'
            });
        }

        const resultado = await almacenService.obtenerNotificacionesUsuario(
            usuario_id,
            solo_no_leidas === 'true',
            Number(limit),
            Number(offset)
        );

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerNotificacionesUsuario:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const marcarNotificacionLeida = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'El ID de la notificación es requerido'
            });
        }

        const resultado = await almacenService.marcarNotificacionLeida(id);

        if (!resultado.success) {
            return res.status(404).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en marcarNotificacionLeida:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const marcarTodasNotificacionesLeidas = async (req, res) => {
    try {
        const usuario_id = req.user?.id;

        if (!usuario_id) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado'
            });
        }

        const resultado = await almacenService.marcarTodasNotificacionesLeidas(usuario_id);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        logger.info('Todas las notificaciones marcadas como leídas', {
            usuario: usuario_id
        });

        res.json(resultado);

    } catch (error) {
        logger.error('Error en marcarTodasNotificacionesLeidas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerMetricasDespachosOptimizado = async (req, res) => {
    try {
        const resultado = await almacenService.obtenerMetricasDespachosOptimizado();

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        logger.error('Error en obtenerMetricasDespachosOptimizado:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== REPORTES ====================

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

// ==================== UPLOAD MASIVO ====================

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

        // Obtener modo de importación del body
        const modoImportacion = req.body.modo_importacion || 'SOLO_VALIDOS';

        // Validar que el usuario tenga un ID válido
        const usuarioId = req.user?.id;
        if (!usuarioId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuarioId)) {
            return res.status(400).json({
                success: false,
                error: 'Usuario no identificado correctamente. Se requiere un ID de usuario válido.',
                codigo: 'USER_ID_INVALID'
            });
        }

        const resultado = await almacenService.ejecutarUploadStock(
            req.file.buffer,
            usuarioId,
            modoImportacion
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

// ==================== INTEGRACIÓN CON VENTAS ====================

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
            req.user?.id
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

// ==================== ANÁLISIS ESPECÍFICOS ====================

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

// ✅ CONTROLADOR CONSOLIDADO - OPTIMIZACIÓN PRINCIPAL
const obtenerAnalisisConsolidado = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';
        const resultado = await reportesService.getAnalisisConsolidado(periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerAnalisisConsolidado:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerReportesConsolidado = async (req, res) => {
    try {
        const { tipo_reporte } = req.params;
        const periodo = req.query.periodo || '30d';

        const resultado = await reportesService.getReportesConsolidado(tipo_reporte, periodo);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);
    } catch (error) {
        logger.error('Error en obtenerReportesConsolidado:', error);
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
        
        // Delegar al service para ejecutar query personalizada
        const resultado = await almacenService.ejecutarQueryPersonalizada(query, params);
        
        if (!resultado.success) {
            return res.status(400).json(resultado);
        }
        
        res.json(resultado);
        
    } catch (error) {
        logger.error('Error en ejecutarQuery:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== REPORTES AVANZADOS ====================

const getPerformanceComparativa = async (req, res) => {
    try {
        const periodo = req.query.periodo || '30d';

        const resultado = await reportesService.getPerformanceComparativa(periodo);

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

        const resultado = await reportesService.getAnalisisPredictivoAlertas(periodo);

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

        const resultado = await reportesService.getValorizacionEvolutiva(periodo);

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

        const resultado = await reportesService.getKardexInteligente(periodo);

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

        const resultado = await reportesService.getEficienciaDespachos(periodo);

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

// ==================== MANTENIMIENTO ====================

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
        // Delegar al service para verificar salud del sistema
        const resultado = await almacenService.verificarSaludSistema();

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        const memory = process.memoryUsage();
        const uptime = process.uptime();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: resultado.data.database,
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
    obtenerKardexProducto,
    transferirStock,
    
    // Almacenes
    obtenerAlmacenes,
    
    // Alertas
    obtenerAlertas,
    resolverAlerta,
    
    // Despachos
    obtenerDespachos,
    obtenerDespachoPorId,
    actualizarEstadoDespacho,
    crearDespachoDesdeVenta,
    actualizarEstadoDespachosMultiples,
    asignarDespachosMultiples,
    obtenerHistorialDespacho,
    obtenerNotificacionesUsuario,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
    obtenerMetricasDespachosOptimizado,
    
    // Reportes
    generarKardex,
    generarReporteValorizacion,
    obtenerStockConsolidado,
    
    // Upload masivo
    generarPlantillaStock,
    previewUploadStock,
    ejecutarUploadStock,
    
    // Integración con ventas
    verificarStockParaVenta,
    descontarStockVenta,
    
    // Análisis específicos
    obtenerRotacionInventario,
    obtenerEficienciaOperativa,
    obtenerAnalisisStockSeguridad,
    obtenerMapaCalorAlmacenes,
    obtenerTendenciasInventario,

    // Análisis consolidado (OPTIMIZADO)
    obtenerAnalisisConsolidado,
    obtenerReportesConsolidado,

    ejecutarQuery,
    
    // Reportes avanzados
    getPerformanceComparativa,
    getAnalisisPredictivoAlertas,
    getValorizacionEvolutiva,
    getKardexInteligente,
    getEficienciaDespachos,
    
    // Mantenimiento
    generarAlertasAutomaticas,
    limpiarAlertasAntiguas,
    
    // Utilidades
    healthCheck
};