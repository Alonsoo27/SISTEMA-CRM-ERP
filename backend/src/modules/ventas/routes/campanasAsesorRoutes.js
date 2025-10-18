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
    getCampanaActiva,
    getMisCampanasActivas,
    agregarLineaCampana,
    getProspectosCampana,      // ← Nuevo
    getDashboardCampana         // ← Nuevo
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

// Obtener campaña activa actual (una sola - legacy)
router.get('/campana-activa',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    getCampanaActiva
);

// ✅ Obtener TODAS mis campañas activas
router.get('/activas',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    getMisCampanasActivas
);

// Iniciar nueva campaña (legacy - mantener por compatibilidad)
router.post('/iniciar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    iniciarCampana
);

// ✅ Agregar nueva línea de campaña
router.post('/agregar-linea',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    agregarLineaCampana
);

// Finalizar campaña
router.put('/:id/finalizar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    finalizarCampana
);

// ============================================
// RUTAS DE ANALYTICS Y TRACKING
// ============================================

// Obtener prospectos de una campaña específica
router.get('/:id/prospectos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    getProspectosCampana
);

// Dashboard completo de una campaña (métricas y analytics)
router.get('/:id/dashboard',
    authenticateToken,
    requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
    getDashboardCampana
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
