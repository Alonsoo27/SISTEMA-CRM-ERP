
// ============================================
// COTIZACIONES ROUTES - APIs REST EMPRESARIALES
// Sistema CRM/ERP v2.0 - Módulo de Cotizaciones
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const CotizacionesController = require('../controllers/CotizacionesController');

// Middleware
const authMiddleware = require('../../../middleware/authMiddleware');
const roleMiddleware = require('../../../middleware/roleMiddleware');

// ============================================
// RUTAS PRINCIPALES DE COTIZACIONES
// ============================================

/**
 * @route   GET /api/cotizaciones
 * @desc    Listar cotizaciones con filtros avanzados
 * @access  Private (Asesores ven sus cotizaciones, Gerentes ven todas)
 * @params  ?venta_id, ?estado, ?fecha_desde, ?fecha_hasta, ?cliente, ?page, ?limit
 */
router.get('/', 
    authMiddleware, 
    CotizacionesController.listarCotizaciones
);

/**
 * @route   GET /api/cotizaciones/:id
 * @desc    Obtener detalle completo de cotización
 * @access  Private (Solo creador o supervisores)
 */
router.get('/:id', 
    authMiddleware, 
    CotizacionesController.obtenerCotizacion
);

/**
 * @route   POST /api/cotizaciones
 * @desc    Crear nueva cotización
 * @access  Private (Asesores y superiores)
 */
router.post('/', 
    authMiddleware, 
    CotizacionesController.crearCotizacion
);

/**
 * @route   PUT /api/cotizaciones/:id
 * @desc    Actualizar cotización existente
 * @access  Private (Solo creador en estado Borrador)
 */
router.put('/:id', 
    authMiddleware, 
    CotizacionesController.actualizarCotizacion
);

/**
 * @route   DELETE /api/cotizaciones/:id
 * @desc    Eliminar cotización (soft delete)
 * @access  Private (Solo creador o Gerentes)
 */
router.delete('/:id', 
    authMiddleware, 
    CotizacionesController.eliminarCotizacion
);

// ============================================
// RUTAS DE GESTIÓN DE ESTADO
// ============================================

/**
 * @route   PUT /api/cotizaciones/:id/enviar
 * @desc    Enviar cotización al cliente
 * @access  Private (Solo creador o supervisores)
 */
router.put('/:id/enviar', 
    authMiddleware, 
    CotizacionesController.enviarCotizacion
);

/**
 * @route   PUT /api/cotizaciones/:id/aprobar
 * @desc    Cliente aprueba la cotización
 * @access  Private (Link público con token)
 */
router.put('/:id/aprobar', 
    CotizacionesController.aprobarCotizacion
);

/**
 * @route   PUT /api/cotizaciones/:id/rechazar
 * @desc    Cliente rechaza la cotización
 * @access  Private (Link público con token)
 */
router.put('/:id/rechazar', 
    CotizacionesController.rechazarCotizacion
);

/**
 * @route   PUT /api/cotizaciones/:id/revisar
 * @desc    Marcar cotización para revisión
 * @access  Private (Solo creador)
 */
router.put('/:id/revisar', 
    authMiddleware, 
    CotizacionesController.marcarParaRevision
);

/**
 * @route   PUT /api/cotizaciones/:id/vencer
 * @desc    Marcar cotización como vencida
 * @access  Private (Proceso automático o Gerentes)
 */
router.put('/:id/vencer', 
    authMiddleware,
    roleMiddleware(['gerente', 'administrador']),
    CotizacionesController.marcarComoVencida
);

// ============================================
// RUTAS DE VERSIONING
// ============================================

/**
 * @route   GET /api/cotizaciones/:id/versiones
 * @desc    Listar todas las versiones de una cotización
 * @access  Private (Solo creador o supervisores)
 */
router.get('/:id/versiones', 
    authMiddleware, 
    CotizacionesController.listarVersiones
);

/**
 * @route   POST /api/cotizaciones/:id/nueva-version
 * @desc    Crear nueva versión de cotización
 * @access  Private (Solo creador)
 */
router.post('/:id/nueva-version', 
    authMiddleware, 
    CotizacionesController.crearNuevaVersion
);

/**
 * @route   GET /api/cotizaciones/:id/comparar/:version_id
 * @desc    Comparar versiones de cotización
 * @access  Private (Solo creador o supervisores)
 */
router.get('/:id/comparar/:version_id', 
    authMiddleware, 
    CotizacionesController.compararVersiones
);

/**
 * @route   PUT /api/cotizaciones/:id/activar-version/:version_id
 * @desc    Activar versión específica de cotización
 * @access  Private (Solo creador)
 */
router.put('/:id/activar-version/:version_id', 
    authMiddleware, 
    CotizacionesController.activarVersion
);

// ============================================
// RUTAS DE GENERACIÓN Y ENVÍO
// ============================================

/**
 * @route   GET /api/cotizaciones/:id/pdf
 * @desc    Generar PDF de la cotización
 * @access  Private (Solo creador o cliente con token)
 */
router.get('/:id/pdf', 
    CotizacionesController.generarPDF
);

/**
 * @route   POST /api/cotizaciones/:id/enviar-email
 * @desc    Enviar cotización por email
 * @access  Private (Solo creador o supervisores)
 */
router.post('/:id/enviar-email', 
    authMiddleware, 
    CotizacionesController.enviarPorEmail
);

/**
 * @route   POST /api/cotizaciones/:id/reenviar
 * @desc    Reenviar cotización al cliente
 * @access  Private (Solo creador)
 */
router.post('/:id/reenviar', 
    authMiddleware, 
    CotizacionesController.reenviarCotizacion
);

/**
 * @route   GET /api/cotizaciones/:id/link-publico
 * @desc    Generar link público para cliente
 * @access  Private (Solo creador)
 */
router.get('/:id/link-publico', 
    authMiddleware, 
    CotizacionesController.generarLinkPublico
);

// ============================================
// RUTAS DE SEGUIMIENTO
// ============================================

/**
 * @route   GET /api/cotizaciones/:id/tracking
 * @desc    Tracking de visualización del cliente
 * @access  Private (Solo creador o supervisores)
 */
router.get('/:id/tracking', 
    authMiddleware, 
    CotizacionesController.obtenerTracking
);

/**
 * @route   POST /api/cotizaciones/:id/registro-vista
 * @desc    Registrar visualización de cliente
 * @access  Public (Token de cotización)
 */
router.post('/:id/registro-vista', 
    CotizacionesController.registrarVisualizacion
);

/**
 * @route   POST /api/cotizaciones/:id/comentario
 * @desc    Agregar comentario del cliente
 * @access  Public (Token de cotización)
 */
router.post('/:id/comentario', 
    CotizacionesController.agregarComentarioCliente
);

/**
 * @route   GET /api/cotizaciones/:id/comentarios
 * @desc    Obtener comentarios de la cotización
 * @access  Private (Solo creador o supervisores)
 */
router.get('/:id/comentarios', 
    authMiddleware, 
    CotizacionesController.obtenerComentarios
);

// ============================================
// RUTAS DE PRODUCTOS Y CÁLCULOS
// ============================================

/**
 * @route   POST /api/cotizaciones/:id/agregar-item
 * @desc    Agregar item a cotización
 * @access  Private (Solo creador en estado Borrador)
 */
router.post('/:id/agregar-item', 
    authMiddleware, 
    CotizacionesController.agregarItem
);

/**
 * @route   PUT /api/cotizaciones/:id/actualizar-item/:item_id
 * @desc    Actualizar item de cotización
 * @access  Private (Solo creador en estado Borrador)
 */
router.put('/:id/actualizar-item/:item_id', 
    authMiddleware, 
    CotizacionesController.actualizarItem
);

/**
 * @route   DELETE /api/cotizaciones/:id/eliminar-item/:item_id
 * @desc    Eliminar item de cotización
 * @access  Private (Solo creador en estado Borrador)
 */
router.delete('/:id/eliminar-item/:item_id', 
    authMiddleware, 
    CotizacionesController.eliminarItem
);

/**
 * @route   POST /api/cotizaciones/:id/calcular-totales
 * @desc    Recalcular totales de cotización
 * @access  Private (Solo creador)
 */
router.post('/:id/calcular-totales', 
    authMiddleware, 
    CotizacionesController.calcularTotales
);

/**
 * @route   POST /api/cotizaciones/:id/aplicar-descuento
 * @desc    Aplicar descuento global
 * @access  Private (Solo creador o Gerentes)
 */
router.post('/:id/aplicar-descuento', 
    authMiddleware, 
    CotizacionesController.aplicarDescuentoGlobal
);

// ============================================
// RUTAS DE PLANTILLAS
// ============================================

/**
 * @route   GET /api/cotizaciones/plantillas
 * @desc    Listar plantillas de cotización
 * @access  Private (Todos los usuarios autenticados)
 */
router.get('/plantillas', 
    authMiddleware, 
    CotizacionesController.listarPlantillas
);

/**
 * @route   POST /api/cotizaciones/plantillas
 * @desc    Crear plantilla de cotización
 * @access  Private (Asesores y superiores)
 */
router.post('/plantillas', 
    authMiddleware, 
    CotizacionesController.crearPlantilla
);

/**
 * @route   POST /api/cotizaciones/desde-plantilla/:plantilla_id
 * @desc    Crear cotización desde plantilla
 * @access  Private (Asesores y superiores)
 */
router.post('/desde-plantilla/:plantilla_id', 
    authMiddleware, 
    CotizacionesController.crearDesdeInstalla
);

// ============================================
// RUTAS DE REPORTES Y ANALYTICS
// ============================================

/**
 * @route   GET /api/cotizaciones/reportes/dashboard
 * @desc    Dashboard de cotizaciones
 * @access  Private (Según rol del usuario)
 */
router.get('/reportes/dashboard', 
    authMiddleware, 
    CotizacionesController.dashboardCotizaciones
);

/**
 * @route   GET /api/cotizaciones/reportes/conversion
 * @desc    Reporte de conversión de cotizaciones
 * @access  Private (Gerentes y Administradores)
 */
router.get('/reportes/conversion', 
    authMiddleware,
    roleMiddleware(['gerente', 'administrador']),
    CotizacionesController.reporteConversion
);

/**
 * @route   GET /api/cotizaciones/reportes/tiempo-respuesta
 * @desc    Análisis de tiempo de respuesta de clientes
 * @access  Private (Gerentes y Administradores)
 */
router.get('/reportes/tiempo-respuesta', 
    authMiddleware,
    roleMiddleware(['gerente', 'administrador']),
    CotizacionesController.reporteTiempoRespuesta
);

/**
 * @route   GET /api/cotizaciones/reportes/productos-populares
 * @desc    Productos más cotizados
 * @access  Private (Gerentes y Administradores)
 */
router.get('/reportes/productos-populares', 
    authMiddleware,
    roleMiddleware(['gerente', 'administrador']),
    CotizacionesController.reporteProductosPopulares
);

// ============================================
// RUTAS DE EXPORTACIÓN
// ============================================

/**
 * @route   GET /api/cotizaciones/exportar/excel
 * @desc    Exportar cotizaciones a Excel
 * @access  Private (Gerentes y Administradores)
 */
router.get('/exportar/excel', 
    authMiddleware,
    roleMiddleware(['gerente', 'administrador']),
    CotizacionesController.exportarExcel
);

/**
 * @route   GET /api/cotizaciones/exportar/csv
 * @desc    Exportar cotizaciones a CSV
 * @access  Private (Gerentes y Administradores)
 */
router.get('/exportar/csv', 
    authMiddleware,
    roleMiddleware(['gerente', 'administrador']),
    CotizacionesController.exportarCSV
);

// ============================================
// RUTAS DE AUTOMATIZACIÓN
// ============================================

/**
 * @route   POST /api/cotizaciones/automatizar/recordatorios
 * @desc    Configurar recordatorios automáticos
 * @access  Private (Solo Administradores)
 */
router.post('/automatizar/recordatorios', 
    authMiddleware,
    roleMiddleware(['administrador']),
    CotizacionesController.configurarRecordatorios
);

/**
 * @route   POST /api/cotizaciones/automatizar/vencimientos
 * @desc    Procesar vencimientos automáticos
 * @access  Private (Proceso automático)
 */
router.post('/automatizar/vencimientos', 
    authMiddleware,
    roleMiddleware(['sistema']),
    CotizacionesController.procesarVencimientos
);

/**
 * @route   POST /api/cotizaciones/automatizar/seguimientos
 * @desc    Generar seguimientos automáticos
 * @access  Private (Proceso automático)
 */
router.post('/automatizar/seguimientos', 
    authMiddleware,
    roleMiddleware(['sistema']),
    CotizacionesController.generarSeguimientos
);

// ============================================
// RUTAS PÚBLICAS PARA CLIENTES
// ============================================

/**
 * @route   GET /api/cotizaciones/publica/:token
 * @desc    Ver cotización pública (cliente)
 * @access  Public (Token válido)
 */
router.get('/publica/:token', 
    CotizacionesController.verCotizacionPublica
);

/**
 * @route   POST /api/cotizaciones/publica/:token/aprobar
 * @desc    Aprobar cotización (cliente)
 * @access  Public (Token válido)
 */
router.post('/publica/:token/aprobar', 
    CotizacionesController.aprobarCotizacionPublica
);

/**
 * @route   POST /api/cotizaciones/publica/:token/rechazar
 * @desc    Rechazar cotización (cliente)
 * @access  Public (Token válido)
 */
router.post('/publica/:token/rechazar', 
    CotizacionesController.rechazarCotizacionPublica
);

/**
 * @route   POST /api/cotizaciones/publica/:token/consulta
 * @desc    Enviar consulta sobre cotización (cliente)
 * @access  Public (Token válido)
 */
router.post('/publica/:token/consulta', 
    CotizacionesController.enviarConsultaPublica
);

module.exports = router;