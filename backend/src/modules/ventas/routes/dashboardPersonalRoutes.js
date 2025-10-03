// ============================================
// DASHBOARD PERSONAL ROUTES - MÉTRICAS INDIVIDUALES
// Sistema CRM/ERP v2.0 - Dashboards personalizados por asesor
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const DashboardController = require('../controllers/dashboardController');

// Middleware de autenticación y autorización
const { authenticateToken, requireOwnership, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// RUTAS DEL DASHBOARD PERSONAL
// ============================================

/**
 * @route   GET /api/dashboard/personal/:asesor_id
 * @desc    Dashboard personal del asesor - KPIs principales
 * @access  Private (requireOwnership: propio dashboard o jefes/ejecutivos)
 * @params  asesor_id, periodo (query)
 */
router.get('/personal/:asesor_id',
    authenticateToken,
    requireOwnership, // Permite ver propio dashboard o jefes pueden ver cualquiera
    DashboardController.dashboardPersonal
);

/**
 * @route   GET /api/dashboard/geografia-asesor/:asesor_id
 * @desc    Análisis geográfico por asesor
 * @access  Private (requireOwnership)
 */
router.get('/geografia-asesor/:asesor_id',
    authenticateToken,
    requireOwnership,
    DashboardController.geografiaPorAsesor
);

/**
 * @route   GET /api/dashboard/sectores-asesor/:asesor_id
 * @desc    Análisis por sectores por asesor
 * @access  Private (requireOwnership)
 */
router.get('/sectores-asesor/:asesor_id',
    authenticateToken,
    requireOwnership,
    DashboardController.sectoresPorAsesor
);

/**
 * @route   GET /api/dashboard/evolucion-asesor/:asesor_id
 * @desc    Evolución temporal por asesor
 * @access  Private (requireOwnership)
 */
router.get('/evolucion-asesor/:asesor_id',
    authenticateToken,
    requireOwnership,
    DashboardController.evolucionPorAsesor
);

/**
 * @route   GET /api/dashboard/ranking-asesor/:asesor_id
 * @desc    Ranking del asesor vs otros asesores
 * @access  Private (requireOwnership)
 */
router.get('/ranking-asesor/:asesor_id',
    authenticateToken,
    requireOwnership,
    DashboardController.rankingAsesor
);

/**
 * @route   GET /api/dashboard/asesores-disponibles
 * @desc    Lista de asesores disponibles (solo para supervisores)
 * @access  Private (JEFES_Y_EJECUTIVOS)
 */
router.get('/asesores-disponibles',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    DashboardController.listarAsesoresDisponibles
);

/**
 * @route   GET /api/dashboard/periodos-disponibles/:asesor_id
 * @desc    Períodos con datos disponibles para selector dinámico
 * @access  Private (requireOwnership)
 */
router.get('/periodos-disponibles/:asesor_id',
    authenticateToken,
    requireOwnership,
    DashboardController.obtenerPeriodosDisponibles
);

// ============================================
// RUTAS BÁSICAS (compatibilidad)
// ============================================

/**
 * @route   GET /api/dashboard
 * @desc    Endpoint básico de dashboard personal
 * @access  Private
 */
router.get('/', authenticateToken, requireOwnership, (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de dashboard personal funcionando',
        data: {
            info: 'Sistema de métricas personales por asesor',
            endpoints_disponibles: [
                '/api/dashboard/personal/:asesor_id',
                '/api/dashboard/geografia-asesor/:asesor_id',
                '/api/dashboard/sectores-asesor/:asesor_id',
                '/api/dashboard/evolucion-asesor/:asesor_id',
                '/api/dashboard/ranking-asesor/:asesor_id'
            ],
            parametros: {
                periodo: ['hoy', 'semana_actual', 'mes_actual', 'trimestre_actual'],
                ejemplo: '/api/dashboard/personal/1?periodo=mes_actual'
            }
        }
    });
});

/**
 * @route   GET /api/dashboard/health
 * @desc    Health check del módulo dashboard personal
 * @access  Public
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Dashboard Personal funcionando correctamente',
        version: '1.0.0',
        endpoints_activos: 5,
        status: 'OPERATIONAL',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

console.log('Dashboard Personal Routes loaded - Métricas individuales por asesor');
console.log('Rutas disponibles:');
console.log('   - GET /api/dashboard/personal/:asesor_id');
console.log('   - GET /api/dashboard/geografia-asesor/:asesor_id');
console.log('   - GET /api/dashboard/sectores-asesor/:asesor_id');
console.log('   - GET /api/dashboard/evolucion-asesor/:asesor_id');
console.log('   - GET /api/dashboard/ranking-asesor/:asesor_id');
console.log('   - GET /api/dashboard/ (info)');
console.log('   - GET /api/dashboard/health (health check)');