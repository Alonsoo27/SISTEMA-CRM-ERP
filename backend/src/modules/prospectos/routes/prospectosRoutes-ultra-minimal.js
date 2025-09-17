const express = require('express');
const router = express.Router();

// =====================================================
// VERSIÓN ULTRA MÍNIMA - SIN MIDDLEWARES, SIN CONTROLLER
// =====================================================

/**
 * GET /api/prospectos/test
 * Ruta de prueba básica
 */
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Prueba básica funcionando',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/prospectos/health
 * Health check básico
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        module: 'Prospectos',
        status: 'Test Funcionando',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/prospectos
 * Ruta raíz básica
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Módulo de prospectos - modo test',
        routes: ['/test', '/health'],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;