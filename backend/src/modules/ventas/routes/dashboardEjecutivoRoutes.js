// ============================================
// DASHBOARD EJECUTIVO ROUTES - PATRÓN EXACTO DASHBOARD PERSONAL
// Sistema CRM/ERP v2.0 - Copiando estructura que SÍ funciona
// ============================================

const express = require('express');
const router = express.Router();

// Controllers - MISMO PATRÓN
const DashboardEjecutivoController = require('../controllers/dashboardEjecutivoController');

// Middleware de autenticación - EXACTAMENTE IGUAL AL PERSONAL
const { authenticateToken } = require('../../../middleware/auth');

// ============================================
// RUTAS DEL DASHBOARD EJECUTIVO
// ============================================

/**
 * @route   GET /api/dashboard-ejecutivo/vista-unificada
 * @desc    Dashboard ejecutivo - Vista unificada del equipo
 * @access  Private
 */
router.get('/vista-unificada', 
    authenticateToken,
    DashboardEjecutivoController.vistaUnificada
);

/**
 * @route   GET /api/dashboard-ejecutivo/metas-avanzado
 * @desc    Dashboard metas avanzadas del equipo
 * @access  Private
 */
router.get('/metas-avanzado', 
    authenticateToken,
    DashboardEjecutivoController.metasAvanzado
);

/**
 * @route   GET /api/dashboard-ejecutivo/sectores-strategy
 * @desc    Análisis estratégico por sectores
 * @access  Private
 */
router.get('/sectores-strategy', 
    authenticateToken,
    DashboardEjecutivoController.sectoresStrategy
);

/**
 * @route   GET /api/dashboard-ejecutivo/abc-productos
 * @desc    Análisis ABC de productos
 * @access  Private
 */
router.get('/abc-productos', 
    authenticateToken,
    DashboardEjecutivoController.abcProductos
);

/**
 * @route   GET /api/dashboard-ejecutivo/analisis-geografico
 * @desc    Análisis geográfico del equipo
 * @access  Private
 */
router.get('/analisis-geografico', 
    authenticateToken,
    DashboardEjecutivoController.analisisGeografico
);

// ============================================
// RUTAS BÁSICAS (IGUAL AL PERSONAL)
// ============================================

/**
 * @route   GET /api/dashboard-ejecutivo
 * @desc    Endpoint básico de dashboard ejecutivo
 * @access  Private
 */
router.get('/', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de dashboard ejecutivo funcionando',
        data: {
            info: 'Sistema de métricas consolidadas para administradores',
            endpoints_disponibles: [
                '/api/dashboard-ejecutivo/vista-unificada',
                '/api/dashboard-ejecutivo/metas-avanzado',
                '/api/dashboard-ejecutivo/sectores-strategy',
                '/api/dashboard-ejecutivo/abc-productos',
                '/api/dashboard-ejecutivo/analisis-geografico'
            ],
            parametros: {
                periodo: ['hoy', 'semana_actual', 'mes_actual', 'trimestre_actual'],
                ejemplo: '/api/dashboard-ejecutivo/vista-unificada?periodo=mes_actual'
            }
        }
    });
});

/**
 * @route   GET /api/dashboard-ejecutivo/health
 * @desc    Health check del módulo ejecutivo
 * @access  Public
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Dashboard Ejecutivo funcionando correctamente',
        version: '1.0.0',
        endpoints_activos: 5,
        status: 'OPERATIONAL',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

console.log('Dashboard Ejecutivo Routes loaded - Patrón exacto Dashboard Personal');
console.log('Rutas disponibles:');
console.log('   - GET /api/dashboard-ejecutivo/vista-unificada');
console.log('   - GET /api/dashboard-ejecutivo/metas-avanzado');
console.log('   - GET /api/dashboard-ejecutivo/sectores-strategy');
console.log('   - GET /api/dashboard-ejecutivo/abc-productos');
console.log('   - GET /api/dashboard-ejecutivo/analisis-geografico');
console.log('   - GET /api/dashboard-ejecutivo/ (info)');
console.log('   - GET /api/dashboard-ejecutivo/health (health check)');