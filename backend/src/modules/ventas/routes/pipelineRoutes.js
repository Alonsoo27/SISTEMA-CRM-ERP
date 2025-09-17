// ============================================
// PIPELINE ROUTES - RUTAS CORREGIDAS
// Sistema CRM/ERP v2.0 - Dashboard Pipeline Prospecto → Venta
// ============================================
const express = require('express');
const router = express.Router();
// Controllers
const PipelineController = require('../controllers/PipelineController');
// Middleware de autenticación
const { authenticateToken } = require('../../../middleware/auth');

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', PipelineController.healthCheck);

// ============================================
// RUTAS PROTEGIDAS - MÉTRICAS PIPELINE
// ============================================
// Aplicar autenticación a todas las rutas siguientes
router.use(authenticateToken);

/**
 * Dashboard principal de pipeline
 * GET /api/ventas/pipeline/dashboard
 * Query params: asesor_id (opcional), periodo (opcional: hoy|semana_actual|mes_actual|trimestre_actual)
 */
router.get('/dashboard', PipelineController.dashboardPipeline);

/**
 * Análisis detallado de embudo de conversión
 * GET /api/ventas/pipeline/embudo
 * Query params: asesor_id (opcional), periodo (opcional)
 * CORREGIDO: Cambiado de analisEmbudo a analisisEmbudo
 */
router.get('/embudo', PipelineController.analisisEmbudo);

/**
 * Proyección de ventas basada en pipeline actual
 * GET /api/ventas/pipeline/proyeccion
 * Query params: asesor_id (opcional)
 */
router.get('/proyeccion', PipelineController.proyeccionVentas);

/**
 * Seguimientos críticos (próximos a vencer o vencidos)
 * GET /api/ventas/pipeline/seguimientos-criticos
 * Query params: asesor_id (opcional)
 */
router.get('/seguimientos-criticos', PipelineController.seguimientosCriticos);

// ============================================
// MANEJO DE ERRORES
// ============================================
// Middleware de manejo de errores específico para pipeline
router.use((error, req, res, next) => {
  console.error('[Pipeline Routes] Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: 'Error en Pipeline Routes',
    message: error.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;