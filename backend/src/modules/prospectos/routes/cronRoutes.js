/**
 * RUTAS DE CRON JOBS
 *
 * Endpoints diseñados para ser ejecutados por Railway Cron Jobs o sistemas externos.
 * NO requieren autenticación JWT, solo el token secreto de cron (CRON_SECRET_TOKEN).
 *
 * Fecha: 2025-10-20
 */

const express = require('express');
const router = express.Router();
const SeguimientosController = require('../controllers/seguimientosController');

// =====================================================
// MIDDLEWARE DE SEGURIDAD PARA CRON JOBS
// =====================================================

const verificarTokenCron = (req, res, next) => {
    const tokenCron = req.headers['x-cron-token'];
    const tokenEsperado = process.env.CRON_SECRET_TOKEN;

    // Si no hay token configurado en producción, bloquear
    if (!tokenEsperado && process.env.NODE_ENV === 'production') {
        console.error('❌ CRÍTICO: CRON_SECRET_TOKEN no configurado en producción');
        return res.status(500).json({
            success: false,
            error: 'Configuración de seguridad incompleta'
        });
    }

    // En desarrollo, permitir si no hay token configurado (solo para testing local)
    if (!tokenEsperado && process.env.NODE_ENV === 'development') {
        console.warn('⚠️  ADVERTENCIA: CRON_SECRET_TOKEN no configurado en desarrollo');
        return next();
    }

    // Verificar token
    if (!tokenCron || tokenCron !== tokenEsperado) {
        console.warn('⚠️  Intento de acceso no autorizado a endpoint de cron job');
        return res.status(401).json({
            success: false,
            error: 'No autorizado para ejecutar cron jobs'
        });
    }

    console.log('✅ Token de cron válido, ejecutando tarea programada...');
    next();
};

// =====================================================
// ENDPOINTS DE CRON JOBS
// =====================================================

/**
 * POST /api/cron/procesar-seguimientos-vencidos
 * Procesar seguimientos vencidos y traspasar prospectos según reglas de negocio
 *
 * Este endpoint debe ser llamado por Railway Cron Jobs cada hora en horario laboral:
 * - L-V: 8am-6pm (cada hora)
 * - Sábados: 9am-12pm (cada hora)
 *
 * Headers requeridos:
 * - x-cron-token: Token secreto configurado en CRON_SECRET_TOKEN
 */
router.post('/procesar-seguimientos-vencidos', verificarTokenCron, async (req, res) => {
    console.log('🔄 [CRON JOB] Iniciando procesamiento de seguimientos vencidos...');
    console.log('   Fecha/Hora:', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));

    try {
        // Llamar al controlador de seguimientos
        await SeguimientosController.procesarSeguimientosVencidos(req, res);
    } catch (error) {
        console.error('❌ [CRON JOB] Error en procesamiento:', error);

        // Si no se ha enviado respuesta aún
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Error en procesamiento de cron job',
                detalles: error.message
            });
        }
    }
});

/**
 * GET /api/cron/health
 * Health check para verificar que el endpoint de cron está disponible
 * No requiere token (solo para verificación)
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Cron Jobs API',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        timezone: 'America/Lima',
        endpoints: {
            procesarSeguimientos: {
                method: 'POST',
                path: '/api/cron/procesar-seguimientos-vencidos',
                requiresToken: true,
                header: 'x-cron-token'
            }
        }
    });
});

module.exports = router;
