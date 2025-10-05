// ============================================
// RUTAS DE CAMPAÑAS DE ASESOR
// ============================================

const express = require('express');
const router = express.Router();

const {
    getMisCampanas,
    getVistaEquipo,
    iniciarCampana,
    finalizarCampana,
    getCampanaActiva
} = require('../controllers/CampanasAsesorController');

const { authenticateToken, requireRole } = require('../../../middleware/auth');
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// RUTAS DE ASESORES
// ============================================

// Obtener mis campañas (activas, finalizadas, todas)
router.get('/mis-campanas',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    getMisCampanas
);

// Obtener campaña activa actual
router.get('/campana-activa',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    getCampanaActiva
);

// Iniciar nueva campaña
router.post('/iniciar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    iniciarCampana
);

// Finalizar campaña
router.put('/:id/finalizar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    finalizarCampana
);

// ============================================
// RUTAS DE MANAGERS
// ============================================

// Vista de equipo (global o por asesor específico)
router.get('/vista-equipo',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    getVistaEquipo
);

module.exports = router;
