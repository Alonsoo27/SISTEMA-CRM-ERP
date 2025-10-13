// ============================================
// COMISIONES ROUTES - CORREGIDO PARA MÉTODOS ESTÁTICOS
// Sistema CRM/ERP v2.0 - Solo rutas que funcionan
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const ComisionesController = require('../controllers/ComisionesController');

// Middleware de autenticación y autorización
const { authenticateToken, requireOwnership, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// RUTAS DE BONOS (CORREGIDAS CON WRAPPER FUNCTIONS)
// ============================================

/**
 * @route   GET /api/comisiones/bono-actual/:asesor_id
 * @desc    Obtener bono actual del asesor basado en metas_ventas
 * @access  Private (requireOwnership - propio bono o jefes/ejecutivos)
 */
router.get('/bono-actual/:asesor_id',
    authenticateToken,
    requireOwnership,
    (req, res) => ComisionesController.obtenerBonoActual(req, res)
);

/**
 * @route   GET /api/comisiones/dashboard-equipo
 * @desc    Dashboard de bonos de todo el equipo
 * @access  Private (JEFES_Y_EJECUTIVOS)
 */
router.get('/dashboard-equipo',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    (req, res) => ComisionesController.dashboardEquipo(req, res)
);

/**
 * @route   GET /api/comisiones/configuracion-bonos
 * @desc    Listar configuración de bonos disponibles
 * @access  Private (VENTAS_COMPLETO)
 */
router.get('/configuracion-bonos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    (req, res) => ComisionesController.listarConfiguracionBonos(req, res)
);

/**
 * @route   POST /api/comisiones/simular-bono
 * @desc    Simular bono para meta y ventas específicas
 * @access  Private (VENTAS_COMPLETO)
 */
router.post('/simular-bono',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    (req, res) => ComisionesController.simularBono(req, res)
);

// ============================================
// RUTA LEGACY BÁSICA (para compatibilidad)
// ============================================

/**
 * @route   GET /api/comisiones
 * @desc    Endpoint básico de comisiones (retorna mensaje)
 * @access  Private
 */
router.get('/', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de comisiones funcionando',
        data: {
            info: 'Sistema actualizado a bonos por metas',
            endpoints_disponibles: [
                '/api/comisiones/bono-actual/:asesor_id',
                '/api/comisiones/dashboard-equipo',
                '/api/comisiones/configuracion-bonos',
                '/api/comisiones/simular-bono'
            ]
        }
    });
});

/**
 * @route   GET /api/comisiones/dashboard/:asesor_id
 * @desc    Redirect a bono-actual (compatibilidad)
 * @access  Private (requireOwnership)
 */
router.get('/dashboard/:asesor_id',
    authenticateToken,
    requireOwnership,
    (req, res) => ComisionesController.obtenerBonoActual(req, res)
);

module.exports = router;

console.log('✅ ComisionesRoutes loaded - Solo endpoints de bonos funcionando');
console.log('🎯 Rutas disponibles:');
console.log('   - GET /api/comisiones/bono-actual/:asesor_id');
console.log('   - GET /api/comisiones/dashboard-equipo');
console.log('   - GET /api/comisiones/configuracion-bonos');
console.log('   - POST /api/comisiones/simular-bono');
console.log('   - GET /api/comisiones/ (info)');
console.log('   - GET /api/comisiones/dashboard/:asesor_id (redirect)');
console.log('🔧 Wrapper functions implementadas para métodos estáticos');