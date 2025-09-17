const express = require('express');
const router = express.Router();
const ProspectosController = require('../controllers/prospectosController');

// 🔐 IMPORTAR MIDDLEWARES JWT
const { authenticateToken, requireRole, requireOwnership } = require('../../../middleware/auth');

// 🔐 APLICAR AUTENTICACIÓN JWT A TODAS LAS RUTAS
router.use(authenticateToken);

// =====================================================
// RUTAS BÁSICAS PARA TESTING JWT
// =====================================================

/**
 * GET /api/prospectos/health
 * Verificar estado del módulo de prospectos
 */
router.get('/health', ProspectosController.healthCheck);

/**
 * GET /api/prospectos/info/estados
 * Obtener lista de estados válidos del pipeline
 */
router.get('/info/estados', (req, res) => {
    res.json({
        success: true,
        data: {
            estados: [
                { codigo: 'Prospecto', nombre: 'Prospecto', descripcion: 'Contacto inicial registrado' },
                { codigo: 'Cotizado', nombre: 'Cotizado', descripcion: 'Cotización enviada al cliente' },
                { codigo: 'Negociacion', nombre: 'Negociación', descripcion: 'En proceso de negociación' },
                { codigo: 'Cerrado', nombre: 'Cerrado', descripcion: 'Venta exitosa' },
                { codigo: 'Perdido', nombre: 'Perdido', descripcion: 'No se concretó la venta' }
            ],
            flujo_normal: 'Prospecto → Cotizado → Negociación → Cerrado'
        }
    });
});

/**
 * GET /api/prospectos
 * Obtener todos los prospectos con filtros
 */
router.get('/', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    ProspectosController.obtenerTodos
);

/**
 * GET /api/prospectos/kanban
 * Obtener datos organizados para Kanban Board
 */
router.get('/kanban', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    ProspectosController.obtenerKanban
);

/**
 * GET /api/prospectos/metricas
 * Obtener métricas del pipeline
 */
router.get('/metricas', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    ProspectosController.obtenerMetricas
);

/**
 * POST /api/prospectos
 * Crear nuevo prospecto
 */
router.post('/', 
    requireRole(['asesor', 'admin', 'super_admin']),
    ProspectosController.crearProspecto
);

/**
 * PUT /api/prospectos/:id
 * Actualizar prospecto completo
 */
router.put('/:id', 
    requireRole(['asesor', 'admin', 'super_admin']),
    ProspectosController.actualizarProspecto
);

/**
 * PATCH /api/prospectos/:id/estado
 * Cambiar estado del prospecto
 */
router.patch('/:id/estado', 
    requireRole(['asesor', 'admin', 'super_admin']),
    ProspectosController.cambiarEstado
);

// MIDDLEWARE DE MANEJO DE ERRORES
router.use((error, req, res, next) => {
    console.error('Error en rutas de prospectos:', error);
    
    // Errores de JWT
    if (error.name === 'JsonWebTokenError') {
        return res.status(403).json({
            success: false,
            error: 'Token JWT inválido',
            code: 'INVALID_JWT'
        });
    }

    if (error.name === 'TokenExpiredError') {
        return res.status(403).json({
            success: false,
            error: 'Token JWT expirado',
            code: 'EXPIRED_JWT'
        });
    }
    
    // Errores generales
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor en módulo de prospectos',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;