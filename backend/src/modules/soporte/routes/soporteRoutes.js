// =====================================
// RUTAS DEL MÓDULO DE SOPORTE TÉCNICO
// =====================================
// Define todas las rutas y endpoints del módulo de soporte

const express = require('express');
const router = express.Router();
const SoporteController = require('../controllers/soporteController');
const auth = require('../../../middleware/auth');

// =====================================
// MIDDLEWARE DE AUTENTICACIÓN
// =====================================
// Todas las rutas requieren autenticación
router.use(auth);

// =====================================
// RUTAS DE TICKETS DE SOPORTE
// =====================================

/**
 * @route   GET /api/soporte/tickets
 * @desc    Obtener lista de tickets con filtros opcionales
 * @access  Private
 * @query   estado, tipo_ticket, prioridad, tecnico_id, asesor_id, fecha_desde, fecha_hasta, limite, offset
 */
router.get('/tickets', SoporteController.obtenerTickets);

/**
 * @route   POST /api/soporte/tickets
 * @desc    Crear nuevo ticket de soporte
 * @access  Private
 * @body    tipo_ticket, titulo, descripcion, prioridad, cliente_nombre, etc.
 */
router.post('/tickets', SoporteController.crearTicket);

/**
 * @route   GET /api/soporte/tickets/:id
 * @desc    Obtener ticket específico por ID
 * @access  Private
 */
router.get('/tickets/:id', SoporteController.obtenerTicketPorId);

/**
 * @route   PUT /api/soporte/tickets/:id
 * @desc    Actualizar ticket existente
 * @access  Private
 */
router.put('/tickets/:id', SoporteController.actualizarTicket);

/**
 * @route   PUT /api/soporte/tickets/:id/asignar
 * @desc    Asignar técnico a ticket
 * @access  Private
 * @body    tecnico_id, observaciones
 */
router.put('/tickets/:id/asignar', SoporteController.asignarTecnico);

/**
 * @route   POST /api/soporte/tickets/desde-venta
 * @desc    Crear ticket desde módulo de ventas
 * @access  Private
 * @body    venta_id, tipo_ticket, datos_adicionales
 */
router.post('/tickets/desde-venta', SoporteController.crearTicketDesdeVenta);

// =====================================
// RUTAS DE PRODUCTOS EN SOPORTE
// =====================================

/**
 * @route   GET /api/soporte/productos/categorias
 * @desc    Obtener productos agrupados por las 4 categorías
 * @access  Private
 * @returns {Object} { POR_REPARAR: [], IRREPARABLE: [], IRREPARABLE_REPUESTOS: [], REPARADO: [] }
 */
router.get('/productos/categorias', SoporteController.obtenerProductosPorCategoria);

/**
 * @route   GET /api/soporte/productos/categorias/:categoria
 * @desc    Obtener productos de una categoría específica
 * @access  Private
 * @param   categoria - POR_REPARAR | IRREPARABLE | IRREPARABLE_REPUESTOS | REPARADO
 */
router.get('/productos/categorias/:categoria', SoporteController.obtenerProductosPorCategoria);

/**
 * @route   POST /api/soporte/productos
 * @desc    Crear producto en soporte
 * @access  Private
 * @body    ticket_id, producto_id, codigo_producto, descripcion_producto, categoria, origen, etc.
 */
router.post('/productos', SoporteController.crearProductoSoporte);

/**
 * @route   PUT /api/soporte/productos/:id
 * @desc    Actualizar estado/categoría de producto
 * @access  Private
 */
router.put('/productos/:id', SoporteController.actualizarProducto);

/**
 * @route   PUT /api/soporte/productos/:id/reparar
 * @desc    Marcar producto como reparado (genera ticket a almacén automáticamente)
 * @access  Private
 * @body    observaciones_reparacion, costo_reparacion, repuestos_utilizados
 */
router.put('/productos/:id/reparar', SoporteController.marcarProductoReparado);

// =====================================
// RUTAS DEL SISTEMA DE PAUSAS
// =====================================

/**
 * @route   POST /api/soporte/productos/:id/pausar
 * @desc    Pausar producto en reparación
 * @access  Private
 * @body    tipo_pausa, motivo
 * @note    tipo_pausa debe ser uno de los valores válidos definidos en BD
 */
router.post('/productos/:id/pausar', SoporteController.pausarProducto);

/**
 * @route   POST /api/soporte/productos/:id/reanudar
 * @desc    Reanudar producto pausado
 * @access  Private
 * @body    observaciones (opcional)
 */
router.post('/productos/:id/reanudar', SoporteController.reanudarProducto);

/**
 * @route   GET /api/soporte/productos/:id/pausas
 * @desc    Obtener historial de pausas de un producto
 * @access  Private
 * @returns {Array} Lista de pausas con información de usuarios y fechas
 */
router.get('/productos/:id/pausas', SoporteController.obtenerHistorialPausas);

// =====================================
// RUTAS DE CAPACITACIONES
// =====================================

/**
 * @route   GET /api/soporte/capacitaciones
 * @desc    Obtener lista de capacitaciones con filtros
 * @access  Private
 * @query   estado, tecnico_id, fecha_desde, fecha_hasta
 */
router.get('/capacitaciones', SoporteController.obtenerCapacitaciones);

/**
 * @route   POST /api/soporte/capacitaciones
 * @desc    Crear nueva capacitación
 * @access  Private
 * @body    cliente_nombre, cliente_telefono, producto_codigo, fecha_capacitacion_solicitada, etc.
 */
router.post('/capacitaciones', SoporteController.crearCapacitacion);

/**
 * @route   PUT /api/soporte/capacitaciones/:id/completar
 * @desc    Marcar capacitación como completada
 * @access  Private
 * @body    duracion_real, exitosa, calificacion, comentarios, observaciones_tecnico, etc.
 */
router.put('/capacitaciones/:id/completar', (req, res, next) => {
    // Middleware específico para procesar datos de finalización
    req.body.completar = true;
    next();
}, SoporteController.actualizarTicket); // Reutilizar lógica de actualización

/**
 * @route   PUT /api/soporte/capacitaciones/:id/reprogramar
 * @desc    Reprogramar capacitación
 * @access  Private
 * @body    nueva_fecha, motivo_reprogramacion
 */
router.put('/capacitaciones/:id/reprogramar', (req, res, next) => {
    req.body.estado = 'REPROGRAMADA';
    req.body.fecha_capacitacion_programada = req.body.nueva_fecha;
    next();
}, SoporteController.actualizarTicket);

// =====================================
// RUTAS DE TICKETS A ALMACÉN
// =====================================

/**
 * @route   GET /api/soporte/tickets-almacen
 * @desc    Obtener tickets enviados a almacén
 * @access  Private
 * @query   estado, almacen_id
 */
router.get('/tickets-almacen', SoporteController.obtenerTicketsAlmacen);

/**
 * @route   POST /api/soporte/productos/:id/enviar-almacen
 * @desc    Crear ticket manual a almacén (para casos especiales)
 * @access  Private
 * @body    almacen_destino_id, observaciones_envio
 * @note    Normalmente esto se hace automáticamente al marcar como reparado
 */
router.post('/productos/:id/enviar-almacen', async (req, res) => {
    // Implementación específica para casos manuales
    try {
        const { id } = req.params;
        const { almacen_destino_id, observaciones_envio } = req.body;

        // Primero marcar como reparado si no lo está
        await SoporteController.marcarProductoReparado(req, res);
        
        // Luego personalizar el ticket de almacén si es necesario
        // Esta lógica se puede expandir según necesidades específicas
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error enviando producto a almacén',
            error: error.message
        });
    }
});

// =====================================
// RUTAS DE DASHBOARD Y MÉTRICAS
// =====================================

/**
 * @route   GET /api/soporte/dashboard/metricas
 * @desc    Obtener métricas generales para dashboard
 * @access  Private
 * @returns {Object} tickets_pendientes, en_proceso, completados, tiempo_promedio, etc.
 */
router.get('/dashboard/metricas', SoporteController.obtenerMetricasGenerales);

/**
 * @route   GET /api/soporte/dashboard/rendimiento-tecnicos
 * @desc    Obtener métricas de rendimiento por técnico
 * @access  Private
 * @returns {Array} Lista de técnicos con sus KPIs
 */
router.get('/dashboard/rendimiento-tecnicos', SoporteController.obtenerRendimientoTecnicos);

/**
 * @route   GET /api/soporte/alertas
 * @desc    Obtener alertas pendientes (pausas largas, SLA vencido, etc.)
 * @access  Private
 * @returns {Array} Lista de alertas activas
 */
router.get('/alertas', SoporteController.obtenerAlertas);

/**
 * @route   GET /api/soporte/dashboard/resumen
 * @desc    Obtener resumen completo para dashboard principal
 * @access  Private
 */
router.get('/dashboard/resumen', async (req, res) => {
    try {
        // Agregar múltiples métricas en una sola llamada
        const [metricas, rendimiento, alertas] = await Promise.all([
            SoporteController.obtenerMetricasGenerales(req, res),
            SoporteController.obtenerRendimientoTecnicos(req, res),
            SoporteController.obtenerAlertas(req, res)
        ]);

        // Nota: Esto es un ejemplo. En implementación real, necesitarías manejar
        // las respuestas de los controladores de manera diferente
        res.json({
            success: true,
            data: {
                metricas: metricas,
                rendimiento: rendimiento,
                alertas: alertas
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error obteniendo resumen de dashboard',
            error: error.message
        });
    }
});

// =====================================
// RUTAS DE CONFIGURACIÓN Y ADMINISTRACIÓN
// =====================================

/**
 * @route   GET /api/soporte/configuracion
 * @desc    Obtener configuración del módulo
 * @access  Private (Admin)
 */
router.get('/configuracion', async (req, res) => {
    try {
        const SoporteService = require('../services/soporteService');
        const resultado = await SoporteService.obtenerConfiguracion();
        
        if (!resultado.success) {
            return res.status(400).json({
                success: false,
                message: 'Error obteniendo configuración',
                error: resultado.error
            });
        }

        res.json({
            success: true,
            data: resultado.data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/soporte/configuracion
 * @desc    Actualizar configuración del módulo
 * @access  Private (Admin)
 * @body    tiempo_respuesta_sla_horas, calificacion_minima_aceptable, etc.
 */
router.put('/configuracion', async (req, res) => {
    try {
        const { body, user } = req;
        body.updated_by = user.id;
        body.updated_at = new Date().toISOString();

        const supabase = require('../../../config/supabase');
        const { data, error } = await supabase
            .from('soporte_configuracion')
            .update(body)
            .eq('activo', true)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Configuración actualizada exitosamente',
            data: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error actualizando configuración',
            error: error.message
        });
    }
});

// =====================================
// RUTAS DE REPORTES Y EXPORTACIÓN
// =====================================

/**
 * @route   GET /api/soporte/reportes/productos
 * @desc    Reporte de productos en soporte con filtros
 * @access  Private
 * @query   fecha_desde, fecha_hasta, categoria, tecnico_id, formato (json|csv)
 */
router.get('/reportes/productos', async (req, res) => {
    try {
        const { query } = req;
        const resultado = await SoporteController.obtenerProductosPorCategoria(req, res);
        
        // Si se solicita CSV, convertir y enviar
        if (query.formato === 'csv') {
            // Implementar conversión a CSV aquí
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="productos_soporte.csv"');
            // ... lógica de conversión CSV
        }
        
        // Por defecto devolver JSON (ya manejado por el controlador)
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generando reporte',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/soporte/reportes/tiempos
 * @desc    Reporte de métricas de tiempo de reparación
 * @access  Private
 */
router.get('/reportes/tiempos', async (req, res) => {
    try {
        const supabase = require('../../../config/supabase');
        const { data, error } = await supabase
            .from('vista_productos_con_pausas')
            .select('*')
            .not('tiempo_efectivo_horas', 'is', null)
            .order('eficiencia_porcentaje', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generando reporte de tiempos',
            error: error.message
        });
    }
});

// =====================================
// RUTAS DE ESTADÍSTICAS AVANZADAS
// =====================================

/**
 * @route   GET /api/soporte/estadisticas/pausas
 * @desc    Estadísticas de pausas por tipo y frecuencia
 * @access  Private
 */
router.get('/estadisticas/pausas', async (req, res) => {
    try {
        const supabase = require('../../../config/supabase');
        const { data, error } = await supabase
            .from('soporte_pausas_reparacion')
            .select(`
                tipo_pausa,
                es_pausa_justificada,
                duracion_horas,
                fecha_inicio
            `)
            .eq('activo', true);

        if (error) throw error;

        // Procesar estadísticas
        const estadisticas = {
            por_tipo: {},
            justificadas_vs_no_justificadas: {
                justificadas: 0,
                no_justificadas: 0
            },
            duracion_promedio: 0,
            pausas_mas_frecuentes: []
        };

        data.forEach(pausa => {
            // Contar por tipo
            estadisticas.por_tipo[pausa.tipo_pausa] = 
                (estadisticas.por_tipo[pausa.tipo_pausa] || 0) + 1;
            
            // Justificadas vs no justificadas
            if (pausa.es_pausa_justificada) {
                estadisticas.justificadas_vs_no_justificadas.justificadas++;
            } else {
                estadisticas.justificadas_vs_no_justificadas.no_justificadas++;
            }
        });

        res.json({
            success: true,
            data: estadisticas
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas de pausas',
            error: error.message
        });
    }
});

// =====================================
// RUTA PARA PROCESAMIENTO DE ALERTAS AUTOMÁTICO
// =====================================

/**
 * @route   POST /api/soporte/procesar-alertas
 * @desc    Ejecutar procesamiento manual de alertas (normalmente automático via cron)
 * @access  Private (Admin)
 */
router.post('/procesar-alertas', async (req, res) => {
    try {
        const supabase = require('../../../config/supabase');
        await supabase.rpc('procesar_alertas_pausas');

        res.json({
            success: true,
            message: 'Procesamiento de alertas ejecutado exitosamente'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error procesando alertas',
            error: error.message
        });
    }
});

// =====================================
// MIDDLEWARE DE MANEJO DE ERRORES
// =====================================

// Manejo de rutas no encontradas
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Manejo de errores generales
router.use((error, req, res, next) => {
    console.error('Error en rutas de soporte:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

module.exports = router;