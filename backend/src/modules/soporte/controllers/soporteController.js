// =====================================
// CONTROLADOR PRINCIPAL DE SOPORTE TÉCNICO - VERSIÓN CORREGIDA
// =====================================
// Maneja todas las rutas y lógica de API para tickets de soporte,
// capacitaciones, integración con ventas y sistema de pausas
// CORREGIDO: Validaciones integradas, imports seguros, respuestas consistentes

const SoporteModel = require('../models/SoporteModel');

// CORRECCIÓN: Imports seguros - funcionan sin dependencias externas
let SoporteService = null;
let soporteHelpers = null;

try {
    SoporteService = require('../services/soporteService');
} catch (error) {
    console.log('SoporteService no disponible - funcionalidad básica habilitada');
}

try {
    soporteHelpers = require('../utils/soporteHelpers');
} catch (error) {
    console.log('soporteHelpers no disponible - validaciones integradas habilitadas');
}

class SoporteController {
    // ====================================
    // VALIDACIONES INTEGRADAS
    // ====================================

    /**
     * Validar datos para crear ticket
     */
    static validarDatosTicket(datos) {
        const errores = [];
        
        if (!datos.tipo_ticket) errores.push('tipo_ticket es requerido');
        if (!datos.cliente_nombre) errores.push('cliente_nombre es requerido');
        
        // Validar tipo_ticket
        const tiposValidos = ['CAPACITACION', 'REPARACION', 'MANTENIMIENTO'];
        if (datos.tipo_ticket && !tiposValidos.includes(datos.tipo_ticket)) {
            errores.push(`tipo_ticket debe ser uno de: ${tiposValidos.join(', ')}`);
        }
        
        // Validar estado si se proporciona
        const estadosValidos = ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'];
        if (datos.estado && !estadosValidos.includes(datos.estado)) {
            errores.push(`estado debe ser uno de: ${estadosValidos.join(', ')}`);
        }
        
        // Validar prioridad si se proporciona
        const prioridadesValidas = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];
        if (datos.prioridad && !prioridadesValidas.includes(datos.prioridad)) {
            errores.push(`prioridad debe ser una de: ${prioridadesValidas.join(', ')}`);
        }

        return {
            valido: errores.length === 0,
            errores
        };
    }

    /**
     * Validar datos para crear producto
     */
    static validarDatosProducto(datos) {
        const errores = [];
        
        if (!datos.ticket_id) errores.push('ticket_id es requerido');
        if (!datos.producto_id) errores.push('producto_id es requerido');
        
        // Validar categoría si se proporciona
        const categoriasValidas = ['POR_REPARAR', 'IRREPARABLE', 'IRREPARABLE_REPUESTOS', 'REPARADO'];
        if (datos.categoria && !categoriasValidas.includes(datos.categoria)) {
            errores.push(`categoria debe ser una de: ${categoriasValidas.join(', ')}`);
        }
        
        // Validar estado si se proporciona
        const estadosValidos = ['RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'REPARADO', 'IRREPARABLE'];
        if (datos.estado && !estadosValidos.includes(datos.estado)) {
            errores.push(`estado debe ser uno de: ${estadosValidos.join(', ')}`);
        }

        return {
            valido: errores.length === 0,
            errores
        };
    }

    /**
     * Validar datos para crear capacitación
     */
    static validarDatosCapacitacion(datos) {
        const errores = [];
        
        if (!datos.ticket_id) errores.push('ticket_id es requerido');
        if (!datos.producto_id) errores.push('producto_id es requerido');
        if (!datos.fecha_capacitacion_programada) errores.push('fecha_capacitacion_programada es requerida');

        return {
            valido: errores.length === 0,
            errores
        };
    }

    /**
     * Procesar filtros de manera segura
     */
    static procesarFiltros(query) {
        const filtros = {};
        
        // Filtros básicos con validación
        if (query.estado) filtros.estado = query.estado;
        if (query.tipo_ticket) filtros.tipo_ticket = query.tipo_ticket;
        if (query.prioridad) filtros.prioridad = query.prioridad;
        if (query.tecnico_id) filtros.tecnico_id = parseInt(query.tecnico_id);
        if (query.asesor_id) filtros.asesor_id = parseInt(query.asesor_id);
        if (query.almacen_id) filtros.almacen_id = parseInt(query.almacen_id);
        
        // Filtros de fecha
        if (query.fecha_desde) filtros.fecha_desde = query.fecha_desde;
        if (query.fecha_hasta) filtros.fecha_hasta = query.fecha_hasta;
        
        // Paginación
        if (query.limite) filtros.limite = parseInt(query.limite);
        if (query.offset) filtros.offset = parseInt(query.offset);
        
        // Ordenamiento
        if (query.orden) filtros.orden = query.orden;
        if (query.direccion) filtros.direccion = query.direccion;
        
        return filtros;
    }

    // ====================================
    // GESTIÓN DE TICKETS DE SOPORTE
    // ====================================

    /**
     * Crear nuevo ticket de soporte
     * POST /api/soporte/tickets
     */
    static async crearTicket(req, res) {
        try {
            const { body, user } = req;

            // Validar datos de entrada usando validación integrada
            const validacion = SoporteController.validarDatosTicket(body);
            if (!validacion.valido) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos inválidos para crear ticket',
                    error: `Errores de validación: ${validacion.errores.join(', ')}`
                });
            }

            // Agregar información del usuario de manera segura
            if (user?.id) {
                body.created_by = user.id;
                body.updated_by = user.id;
            }

            // Crear ticket usando el modelo
            const resultado = await SoporteModel.crearTicket(body);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al crear ticket',
                    error: resultado.error
                });
            }

            // Procesar lógica adicional a través del servicio (si está disponible)
            if (SoporteService && SoporteService.procesarTicketNuevo) {
                try {
                    await SoporteService.procesarTicketNuevo(resultado.data);
                } catch (serviceError) {
                    console.log('Servicio adicional no disponible:', serviceError.message);
                }
            }

            res.status(201).json({
                success: true,
                message: resultado.message || 'Ticket creado exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en crearTicket:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al crear ticket',
                error: error.message
            });
        }
    }

    /**
     * Obtener lista de tickets con filtros
     * GET /api/soporte/tickets
     */
    static async obtenerTickets(req, res) {
        try {
            const { query } = req;

            // Procesar filtros de manera segura
            const filtros = SoporteController.procesarFiltros(query);

            const resultado = await SoporteModel.obtenerTickets(filtros);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener tickets',
                    error: resultado.error,
                    data: []
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Tickets obtenidos exitosamente',
                data: resultado.data,
                filtros: filtros
            });

        } catch (error) {
            console.error('Error en obtenerTickets:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener tickets',
                error: error.message,
                data: []
            });
        }
    }

    /**
     * Obtener ticket por ID
     * GET /api/soporte/tickets/:id
     */
    static async obtenerTicketPorId(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de ticket requerido',
                    error: 'Parámetro id faltante en la URL'
                });
            }

            const resultado = await SoporteModel.obtenerTicketPorId(id);

            if (!resultado.success) {
                return res.status(404).json({
                    success: false,
                    message: resultado.message || 'Ticket no encontrado',
                    error: resultado.error
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Ticket encontrado',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerTicketPorId:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener ticket',
                error: error.message
            });
        }
    }

    /**
     * Actualizar ticket
     * PUT /api/soporte/tickets/:id
     */
    static async actualizarTicket(req, res) {
        try {
            const { id } = req.params;
            const { body, user } = req;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de ticket requerido',
                    error: 'Parámetro id faltante en la URL'
                });
            }

            // Agregar información del usuario que actualiza
            if (user?.id) {
                body.updated_by = user.id;
            }

            const resultado = await SoporteModel.actualizarTicket(id, body);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al actualizar ticket',
                    error: resultado.error
                });
            }

            // Procesar cambios a través del servicio (si está disponible)
            if (SoporteService && SoporteService.procesarCambioTicket) {
                try {
                    await SoporteService.procesarCambioTicket(resultado.data, body);
                } catch (serviceError) {
                    console.log('Servicio adicional no disponible:', serviceError.message);
                }
            }

            res.json({
                success: true,
                message: resultado.message || 'Ticket actualizado exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en actualizarTicket:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al actualizar ticket',
                error: error.message
            });
        }
    }

    /**
     * Asignar técnico a ticket
     * PUT /api/soporte/tickets/:id/asignar
     */
    static async asignarTecnico(req, res) {
        try {
            const { id } = req.params;
            const { tecnico_id, observaciones } = req.body;
            const { user } = req;

            if (!id || !tecnico_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de ticket y técnico requeridos',
                    error: 'Faltan parámetros: id del ticket y/o tecnico_id'
                });
            }

            const datosActualizacion = {
                tecnico_asignado_id: tecnico_id,
                estado: 'ASIGNADO',
                observaciones: observaciones,
                updated_by: user?.id
            };

            const resultado = await SoporteModel.actualizarTicket(id, datosActualizacion);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al asignar técnico',
                    error: resultado.error
                });
            }

            // Notificar al técnico asignado (si el servicio está disponible)
            if (SoporteService && SoporteService.notificarAsignacionTecnico) {
                try {
                    await SoporteService.notificarAsignacionTecnico(resultado.data);
                } catch (serviceError) {
                    console.log('Servicio de notificación no disponible:', serviceError.message);
                }
            }

            res.json({
                success: true,
                message: 'Técnico asignado exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en asignarTecnico:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al asignar técnico',
                error: error.message
            });
        }
    }

    // ====================================
    // GESTIÓN DE PRODUCTOS EN SOPORTE
    // ====================================

    /**
     * Crear producto en soporte
     * POST /api/soporte/productos
     */
    static async crearProductoSoporte(req, res) {
        try {
            const { body, user } = req;

            // Validar datos usando validación integrada
            const validacion = SoporteController.validarDatosProducto(body);
            if (!validacion.valido) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos inválidos para crear producto en soporte',
                    error: `Errores de validación: ${validacion.errores.join(', ')}`
                });
            }

            if (user?.id) {
                body.created_by = user.id;
                body.updated_by = user.id;
            }

            const resultado = await SoporteModel.crearProductoSoporte(body);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al crear producto en soporte',
                    error: resultado.error
                });
            }

            res.status(201).json({
                success: true,
                message: resultado.message || 'Producto agregado a soporte exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en crearProductoSoporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al crear producto en soporte',
                error: error.message
            });
        }
    }

    /**
     * Obtener productos por categoría (las 4 columnas)
     * GET /api/soporte/productos/categorias
     * GET /api/soporte/productos/categorias/:categoria
     */
    static async obtenerProductosPorCategoria(req, res) {
        try {
            const { categoria } = req.params;

            const resultado = await SoporteModel.obtenerProductosPorCategoria(categoria);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener productos',
                    error: resultado.error,
                    data: categoria ? [] : {
                        POR_REPARAR: [],
                        IRREPARABLE: [],
                        IRREPARABLE_REPUESTOS: [],
                        REPARADO: []
                    }
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Productos obtenidos exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerProductosPorCategoria:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener productos por categoría',
                error: error.message,
                data: categoria ? [] : {
                    POR_REPARAR: [],
                    IRREPARABLE: [],
                    IRREPARABLE_REPUESTOS: [],
                    REPARADO: []
                }
            });
        }
    }

    /**
     * Actualizar estado/categoría de producto
     * PUT /api/soporte/productos/:id
     */
    static async actualizarProducto(req, res) {
        try {
            const { id } = req.params;
            const { body, user } = req;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de producto requerido',
                    error: 'Parámetro id faltante en la URL'
                });
            }

            if (user?.id) {
                body.updated_by = user.id;
            }

            const resultado = await SoporteModel.actualizarProducto(id, body);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al actualizar producto',
                    error: resultado.error
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Producto actualizado exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en actualizarProducto:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al actualizar producto',
                error: error.message
            });
        }
    }

    /**
     * Marcar producto como reparado (genera ticket a almacén automáticamente)
     * PUT /api/soporte/productos/:id/reparar
     */
    static async marcarProductoReparado(req, res) {
        try {
            const { id } = req.params;
            const { observaciones_reparacion, costo_reparacion, repuestos_utilizados } = req.body;
            const { user } = req;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de producto requerido',
                    error: 'Parámetro id faltante en la URL'
                });
            }

            const datosActualizacion = {
                estado: 'REPARADO',
                categoria: 'REPARADO',
                fecha_fin_reparacion: new Date().toISOString(),
                reparacion_realizada: observaciones_reparacion,
                costo_reparacion: costo_reparacion,
                repuestos_utilizados: repuestos_utilizados,
                verificacion_calidad: true,
                aprobado_por: user?.id,
                fecha_aprobacion: new Date().toISOString().split('T')[0],
                updated_by: user?.id
            };

            const resultado = await SoporteModel.actualizarProducto(id, datosActualizacion);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al marcar producto como reparado',
                    error: resultado.error
                });
            }

            res.json({
                success: true,
                message: 'Producto marcado como reparado. Ticket a almacén creado automáticamente.',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en marcarProductoReparado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al marcar producto como reparado',
                error: error.message
            });
        }
    }

    // ====================================
    // SISTEMA DE PAUSAS
    // ====================================

    /**
     * Pausar producto
     * POST /api/soporte/productos/:id/pausar
     */
    static async pausarProducto(req, res) {
        try {
            const { id } = req.params;
            const { tipo_pausa, motivo } = req.body;
            const { user } = req;

            if (!id || !tipo_pausa || !motivo) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de producto, tipo de pausa y motivo son requeridos',
                    error: 'Faltan parámetros: id, tipo_pausa y/o motivo'
                });
            }

            const userId = user?.id;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario no identificado',
                    error: 'Se requiere información del usuario para pausar producto'
                });
            }

            const resultado = await SoporteModel.pausarProducto(id, tipo_pausa, motivo, userId);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al pausar producto',
                    error: resultado.error
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Producto pausado exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en pausarProducto:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al pausar producto',
                error: error.message
            });
        }
    }

    /**
     * Reanudar producto
     * POST /api/soporte/productos/:id/reanudar
     */
    static async reanudarProducto(req, res) {
        try {
            const { id } = req.params;
            const { observaciones } = req.body;
            const { user } = req;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de producto requerido',
                    error: 'Parámetro id faltante en la URL'
                });
            }

            const userId = user?.id;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario no identificado',
                    error: 'Se requiere información del usuario para reanudar producto'
                });
            }

            const resultado = await SoporteModel.reanudarProducto(id, observaciones || '', userId);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al reanudar producto',
                    error: resultado.error
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Producto reanudado exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en reanudarProducto:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al reanudar producto',
                error: error.message
            });
        }
    }

    /**
     * Obtener historial de pausas de un producto
     * GET /api/soporte/productos/:id/pausas
     */
    static async obtenerHistorialPausas(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de producto requerido',
                    error: 'Parámetro id faltante en la URL',
                    data: []
                });
            }

            const resultado = await SoporteModel.obtenerHistorialPausas(id);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener historial de pausas',
                    error: resultado.error,
                    data: []
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Historial de pausas obtenido',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerHistorialPausas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener historial de pausas',
                error: error.message,
                data: []
            });
        }
    }

    // ====================================
    // CAPACITACIONES
    // ====================================

    /**
     * Crear capacitación
     * POST /api/soporte/capacitaciones
     */
    static async crearCapacitacion(req, res) {
        try {
            const { body, user } = req;

            // Validar datos usando validación integrada
            const validacion = SoporteController.validarDatosCapacitacion(body);
            if (!validacion.valido) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos inválidos para crear capacitación',
                    error: `Errores de validación: ${validacion.errores.join(', ')}`
                });
            }

            if (user?.id) {
                body.created_by = user.id;
                body.updated_by = user.id;
            }

            const resultado = await SoporteModel.crearCapacitacion(body);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al crear capacitación',
                    error: resultado.error
                });
            }

            res.status(201).json({
                success: true,
                message: resultado.message || 'Capacitación creada exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en crearCapacitacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al crear capacitación',
                error: error.message
            });
        }
    }

    /**
     * Obtener capacitaciones
     * GET /api/soporte/capacitaciones
     */
    static async obtenerCapacitaciones(req, res) {
        try {
            const { query } = req;
            const filtros = SoporteController.procesarFiltros(query);

            const resultado = await SoporteModel.obtenerCapacitaciones(filtros);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener capacitaciones',
                    error: resultado.error,
                    data: []
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Capacitaciones obtenidas exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerCapacitaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener capacitaciones',
                error: error.message,
                data: []
            });
        }
    }

    // ====================================
    // INTEGRACIÓN CON VENTAS
    // ====================================

    /**
     * Crear ticket desde módulo de ventas
     * POST /api/soporte/tickets/desde-venta
     */
    static async crearTicketDesdeVenta(req, res) {
        try {
            const { venta_id, tipo_ticket, datos_adicionales } = req.body;
            const { user } = req;

            if (!venta_id || !tipo_ticket) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de venta y tipo de ticket son requeridos',
                    error: 'Faltan parámetros: venta_id y/o tipo_ticket'
                });
            }

            const userId = user?.id;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario no identificado',
                    error: 'Se requiere información del usuario'
                });
            }

            const resultado = await SoporteModel.crearTicketDesdeVenta(
                venta_id, 
                tipo_ticket, 
                datos_adicionales || {}, 
                userId
            );

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al crear ticket desde venta',
                    error: resultado.error
                });
            }

            res.status(201).json({
                success: true,
                message: resultado.message || 'Ticket de soporte creado desde venta exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en crearTicketDesdeVenta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al crear ticket desde venta',
                error: error.message
            });
        }
    }

    // ====================================
    // TICKETS A ALMACÉN
    // ====================================

    /**
     * Obtener tickets enviados a almacén
     * GET /api/soporte/tickets-almacen
     */
    static async obtenerTicketsAlmacen(req, res) {
        try {
            const { query } = req;
            const filtros = SoporteController.procesarFiltros(query);

            const resultado = await SoporteModel.obtenerTicketsAlmacen(filtros);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener tickets de almacén',
                    error: resultado.error,
                    data: []
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Tickets de almacén obtenidos exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerTicketsAlmacen:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener tickets de almacén',
                error: error.message,
                data: []
            });
        }
    }

    // ====================================
    // MÉTRICAS Y DASHBOARDS
    // ====================================

    /**
     * Obtener métricas generales del dashboard
     * GET /api/soporte/dashboard/metricas
     */
    static async obtenerMetricasGenerales(req, res) {
        try {
            const resultado = await SoporteModel.obtenerMetricasGenerales();

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener métricas',
                    error: resultado.error,
                    data: {
                        total_tickets: 0,
                        tickets_pendientes: 0,
                        tickets_proceso: 0,
                        tickets_completados: 0,
                        productos_por_reparar: 0,
                        productos_reparados: 0,
                        productos_irreparables: 0,
                        capacitaciones_pendientes: 0
                    }
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Métricas obtenidas exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerMetricasGenerales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener métricas',
                error: error.message,
                data: {
                    total_tickets: 0,
                    tickets_pendientes: 0,
                    tickets_proceso: 0,
                    tickets_completados: 0,
                    productos_por_reparar: 0,
                    productos_reparados: 0,
                    productos_irreparables: 0,
                    capacitaciones_pendientes: 0
                }
            });
        }
    }

    /**
     * Obtener métricas de rendimiento por técnico
     * GET /api/soporte/dashboard/rendimiento-tecnicos
     */
    static async obtenerRendimientoTecnicos(req, res) {
        try {
            const resultado = await SoporteModel.obtenerRendimientoTecnicos();

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener rendimiento de técnicos',
                    error: resultado.error,
                    data: []
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Rendimiento de técnicos obtenido exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerRendimientoTecnicos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener rendimiento de técnicos',
                error: error.message,
                data: []
            });
        }
    }

    /**
     * Obtener alertas pendientes
     * GET /api/soporte/alertas
     */
    static async obtenerAlertas(req, res) {
        try {
            const resultado = await SoporteModel.obtenerAlertas();

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: resultado.message || 'Error al obtener alertas',
                    error: resultado.error,
                    data: []
                });
            }

            res.json({
                success: true,
                message: resultado.message || 'Alertas obtenidas exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en obtenerAlertas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener alertas',
                error: error.message,
                data: []
            });
        }
    }

    /**
     * Obtener técnicos disponibles
     * GET /api/soporte/tecnicos
     */
    static async obtenerTecnicos(req, res) {
        try {
            const { query } = require('../../../config/database');

            const sql = `
                SELECT u.id, u.nombre, u.apellido, u.email, u.activo,
                       r.nombre as rol_nombre,
                       CONCAT(u.nombre, ' ', u.apellido) as nombre_completo
                FROM usuarios u
                JOIN roles r ON u.rol_id = r.id
                WHERE u.activo = true
                  AND (r.nombre ILIKE '%tecnico%' OR r.nombre ILIKE '%soporte%' OR r.nombre = 'Técnico')
                ORDER BY u.nombre, u.apellido
            `;

            const result = await query(sql, []);

            res.json({
                success: true,
                message: 'Técnicos obtenidos exitosamente',
                data: result.rows || []
            });

        } catch (error) {
            console.error('Error en obtenerTecnicos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener técnicos',
                error: error.message,
                data: []
            });
        }
    }
}

module.exports = SoporteController;