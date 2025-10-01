// ============================================
// RUTAS DE CAMPAÑAS - SISTEMA DINÁMICO
// ============================================

const express = require('express');
const router = express.Router();

// Controller
const CampanasController = require('../controllers/CampanasController');

// Middleware de autenticación
const { authenticateToken, requireRole } = require('../../../middleware/auth');

// Middleware específico para campañas
const requireVentasAccess = requireRole(['VENDEDOR', 'JEFE_VENTAS', 'GERENTE', 'ADMIN', 'SUPER_ADMIN']);
const requireManagerAccess = requireRole(['JEFE_VENTAS', 'GERENTE', 'ADMIN', 'SUPER_ADMIN']);

/**
 * @route GET /api/campanas/activas
 * @desc Obtener campañas activas del usuario
 * @access Vendedores (propias), Managers (todas)
 */
router.get('/activas',
    authenticateToken,
    requireVentasAccess,
    CampanasController.getCampanasActivas
);

/**
 * @route POST /api/campanas
 * @desc Crear nueva campaña
 * @access Solo Managers
 */
router.post('/',
    authenticateToken,
    requireManagerAccess,
    CampanasController.crearCampana
);

/**
 * @route GET /api/campanas/:campana_id/progreso
 * @desc Actualizar y obtener progreso de campaña
 * @access Vendedores (propias), Managers (todas)
 */
router.get('/:campana_id/progreso',
    authenticateToken,
    requireVentasAccess,
    CampanasController.actualizarProgreso
);

/**
 * @route GET /api/campanas/test
 * @desc Test de conectividad
 * @access Usuarios autenticados
 */
router.get('/test',
    authenticateToken,
    (req, res) => {
        res.json({
            success: true,
            message: 'Servicio de campañas funcionando correctamente',
            data: {
                user: {
                    id: req.user.id,
                    nombre: req.user.nombre,
                    rol: req.user.rol
                },
                timestamp: new Date().toISOString(),
                endpoints_disponibles: {
                    activas: 'GET /campanas/activas',
                    crear: 'POST /campanas',
                    progreso: 'GET /campanas/:id/progreso'
                }
            }
        });
    }
);

module.exports = router;