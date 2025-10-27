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
 * POST /api/cron/corregir-seguimientos-huerfanos
 * Corregir seguimientos que fueron procesados pero NO traspasados por el bug antiguo
 *
 * Este endpoint detecta seguimientos que:
 * - Fueron completados automáticamente
 * - Pero el prospecto NO fue reasignado (numero_reasignaciones = 0)
 * - Y ya pasaron más de 2 días desde el vencimiento
 *
 * Headers requeridos:
 * - x-cron-token: Token secreto configurado en CRON_SECRET_TOKEN
 */
router.post('/corregir-seguimientos-huerfanos', verificarTokenCron, async (req, res) => {
    console.log('🔧 [CORRECCIÓN] Iniciando corrección de seguimientos huérfanos...');

    try {
        const { query } = require('../../config/database');

        // 1. Buscar seguimientos procesados pero no traspasados
        const seguimientosHuerfanos = await query(`
            SELECT
                s.id as seguimiento_id,
                s.prospecto_id,
                s.fecha_limite,
                s.resultado,
                p.codigo,
                p.nombre_cliente,
                p.asesor_id,
                p.asesor_nombre,
                p.numero_reasignaciones,
                p.modo_libre
            FROM seguimientos s
            INNER JOIN prospectos p ON s.prospecto_id = p.id
            WHERE s.completado = true
              AND s.vencido = true
              AND s.visible_para_asesor = false
              AND s.resultado LIKE '%Procesado automáticamente%'
              AND p.numero_reasignaciones = 0
              AND p.modo_libre = false
              AND p.activo = true
              AND p.estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
              AND s.fecha_limite + INTERVAL '2 days' < NOW()
        `);

        console.log(`📋 Encontrados ${seguimientosHuerfanos.rows.length} seguimientos huérfanos`);

        const resultados = {
            encontrados: seguimientosHuerfanos.rows.length,
            corregidos: 0,
            errores: []
        };

        // 2. Procesar cada seguimiento huérfano
        for (const seg of seguimientosHuerfanos.rows) {
            try {
                console.log(`🔄 Procesando ${seg.codigo}...`);

                // Re-activar el seguimiento temporalmente para que el sistema lo procese
                await query(`
                    UPDATE seguimientos
                    SET completado = false,
                        visible_para_asesor = true,
                        fecha_completado = NULL
                    WHERE id = $1
                `, [seg.seguimiento_id]);

                console.log(`✅ Seguimiento ${seg.seguimiento_id} reactivado`);
                resultados.corregidos++;

            } catch (error) {
                console.error(`❌ Error procesando ${seg.codigo}:`, error.message);
                resultados.errores.push({
                    codigo: seg.codigo,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            data: resultados,
            message: `Corrección completada: ${resultados.corregidos} de ${resultados.encontrados} seguimientos reactivados`
        });

    } catch (error) {
        console.error('❌ [CORRECCIÓN] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error en corrección de seguimientos huérfanos',
            detalles: error.message
        });
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
            },
            corregirHuerfanos: {
                method: 'POST',
                path: '/api/cron/corregir-seguimientos-huerfanos',
                requiresToken: true,
                header: 'x-cron-token'
            }
        }
    });
});

module.exports = router;
