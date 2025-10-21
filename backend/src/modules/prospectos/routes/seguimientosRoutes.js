const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const SeguimientosController = require('../controllers/seguimientosController');

// RATE LIMITING PARA SEGUIMIENTOS
const seguimientosRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 30, // máximo 30 operaciones de seguimientos por IP cada 15 minutos
    message: {
        success: false,
        error: 'Demasiadas operaciones de seguimiento. Espere 15 minutos antes de continuar.',
        reintentarEn: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// RATE LIMITING PARA CRON JOBS (más restrictivo)
const cronJobRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 3, // máximo 3 ejecuciones manuales cada 5 minutos
    message: {
        success: false,
        error: 'Demasiadas ejecuciones del procesamiento. Espere 5 minutos.',
        reintentarEn: '5 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// MIDDLEWARE DE SEGURIDAD PARA CRON JOBS
const verificarTokenCron = (req, res, next) => {
    const tokenCron = req.headers['x-cron-token'];
    const tokenEsperado = process.env.CRON_SECRET_TOKEN;

    // Si no hay token configurado, permitir (desarrollo local)
    if (!tokenEsperado) {
        console.warn('⚠️  ADVERTENCIA: CRON_SECRET_TOKEN no configurado en variables de entorno');
        return next();
    }

    // Verificar token
    if (!tokenCron || tokenCron !== tokenEsperado) {
        return res.status(401).json({
            success: false,
            error: 'No autorizado para ejecutar cron jobs'
        });
    }

    next();
};

// =====================================================
// RUTAS DE SEGUIMIENTOS BÁSICOS
// =====================================================

/**
 * POST /api/prospectos/:id/seguimiento
 * Crear seguimiento obligatorio para un prospecto
 * Body: { fecha_programada, tipo?, descripcion? }
 */
router.post('/:id/seguimiento', seguimientosRateLimit, SeguimientosController.crearSeguimiento);

/**
 * PUT /api/prospectos/seguimientos/:id/completar
 * Marcar seguimiento como completado
 * Body: { resultado? }
 */
router.put('/:id/completar', seguimientosRateLimit, SeguimientosController.completarSeguimiento);

// =====================================================
// RUTAS DEL SISTEMA DE REASIGNACIONES
// =====================================================

/**
 * GET /api/prospectos/seguimientos/vencidos
 * Obtener seguimientos vencidos que requieren procesamiento
 * Solo para administradores y jefes de área
 */
router.get('/vencidos', SeguimientosController.obtenerSeguimientosVencidos);

/**
 * POST /api/prospectos/seguimientos/procesar-vencidos
 * Procesar seguimientos vencidos manualmente (también se ejecuta automáticamente)
 * Endpoint para testing y ejecución manual del cron job
 * Requiere header: x-cron-token con el valor de CRON_SECRET_TOKEN
 */
router.post('/procesar-vencidos', verificarTokenCron, cronJobRateLimit, SeguimientosController.procesarSeguimientosVencidos);

/**
 * GET /api/prospectos/modo-libre/:asesorId
 * GET /api/prospectos/modo-libre
 * Obtener prospectos en modo libre para un asesor
 * Params: asesorId (opcional) - si no se proporciona, usa el del token
 */
router.get('/modo-libre/:asesorId', (req, res) => {
    // Endpoint temporal hasta implementar completamente el modo libre
    res.json({
        success: true,
        data: [],
        message: 'Modo libre en desarrollo - próximamente disponible'
    });
});

router.get('/modo-libre', (req, res) => {
    // Endpoint temporal hasta implementar completamente el modo libre
    res.json({
        success: true,
        data: [],
        message: 'Modo libre en desarrollo - próximamente disponible'
    });
});

/**
 * POST /api/prospectos/:id/cerrar-modo-libre
 * Cerrar venta en modo libre (winner takes all)
 * Body: { valor_final?, productos_vendidos? }
 */
router.post('/:id/cerrar-modo-libre', (req, res) => {
    // Endpoint temporal hasta implementar completamente el modo libre
    res.json({
        success: true,
        message: 'Funcionalidad de modo libre en desarrollo'
    });
});

// =====================================================
// 📊 HISTORIAL COMPLETO EMPRESARIAL
// =====================================================

/**
 * GET /api/prospectos/seguimientos/historial-completo/:asesor_id
 * Obtener historial completo empresarial con contexto de negocio
 * Query params: page, limit, fecha_desde, fecha_hasta, tipo_actividad, estado
 */
router.get('/historial-completo/:asesor_id', SeguimientosController.obtenerHistorialCompleto);

// =====================================================
// RUTAS DE DASHBOARDS Y MÉTRICAS
// =====================================================

/**
 * GET /api/prospectos/dashboard/seguimientos/:asesorId
 * GET /api/prospectos/dashboard/seguimientos
 * Dashboard completo de seguimientos para un asesor
 * Params: asesorId (opcional) - si no se proporciona, usa el del token
 */
router.get('/dashboard/seguimientos/:asesorId', SeguimientosController.dashboardSeguimientos);
router.get('/dashboard/seguimientos', SeguimientosController.dashboardSeguimientos);

/**
 * GET /api/prospectos/seguimientos/pendientes/:asesorId
 * GET /api/prospectos/seguimientos/pendientes
 * Obtener seguimientos pendientes de un asesor (versión simplificada del dashboard)
 */
router.get('/seguimientos/pendientes/:asesorId', async (req, res) => {
    try {
        const { asesorId } = req.params;
        const asesor_id = asesorId && !isNaN(asesorId) ? parseInt(asesorId) : (req.user?.id || 1);
        
        // Esta es una implementación simplificada
        // En producción, debería usar SeguimientosController.dashboardSeguimientos
        // pero extraer solo la sección de seguimientos pendientes
        
        res.json({
            success: true,
            data: {
                message: 'Use /dashboard/seguimientos para información completa',
                endpoint_recomendado: `/api/prospectos/dashboard/seguimientos/${asesor_id}`
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener seguimientos pendientes: ' + error.message
        });
    }
});

router.get('/seguimientos/pendientes', async (req, res) => {
    try {
        const asesor_id = req.user?.id || 1;
        
        // Esta es una implementación simplificada
        // En producción, debería usar SeguimientosController.dashboardSeguimientos
        // pero extraer solo la sección de seguimientos pendientes
        
        res.json({
            success: true,
            data: {
                message: 'Use /dashboard/seguimientos para información completa',
                endpoint_recomendado: `/api/prospectos/dashboard/seguimientos/${asesor_id}`
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener seguimientos pendientes: ' + error.message
        });
    }
});

// =====================================================
// RUTAS DE INFORMACIÓN DEL SISTEMA
// =====================================================

/**
 * GET /api/prospectos/seguimientos/info
 * Información sobre el sistema de seguimientos
 */
router.get('/seguimientos/info', (req, res) => {
    res.json({
        success: true,
        data: {
            sistema: 'Seguimientos Automáticos con Reasignación',
            version: '1.0.0',
            horario_laboral: {
                'lunes_viernes': '8:00 AM - 6:00 PM',
                'sabados': '9:00 AM - 12:00 PM',
                'domingos': 'Cerrado'
            },
            tiempo_vencimiento: '2 días laborales (L-V: 10h/día, Sáb: 3h)',
            flujo_reasignacion: {
                '1er_vencimiento': 'Reasignación automática a otro asesor',
                '2do_vencimiento': 'Segunda reasignación automática',
                '3er_vencimiento': 'Activación de modo libre (competencia abierta)'
            },
            tipos_seguimiento: [
                { codigo: 'Llamada', descripcion: 'Llamada telefónica al cliente' },
                { codigo: 'Email', descripcion: 'Envío de correo electrónico' },
                { codigo: 'WhatsApp', descripcion: 'Mensaje por WhatsApp' },
                { codigo: 'Visita', descripcion: 'Visita presencial al cliente' }
            ],
            cron_jobs: {
                frecuencia: 'Cada hora durante horario laboral',
                proxima_ejecucion: 'Automática según horario',
                ejecucion_manual: 'POST /api/prospectos/seguimientos/procesar-vencidos'
            }
        }
    });
});

/**
 * GET /api/prospectos/seguimientos/estadisticas
 * Estadísticas generales del sistema de seguimientos
 */
router.get('/seguimientos/estadisticas', async (req, res) => {
    try {
        // Implementación básica de estadísticas
        // En producción, esto debería hacer queries reales a la base de datos
        
        res.json({
            success: true,
            data: {
                mensaje: 'Estadísticas del sistema de seguimientos',
                nota: 'Implementación completa en desarrollo',
                metricas_disponibles: [
                    'Total de seguimientos programados',
                    'Porcentaje de cumplimiento',
                    'Tiempo promedio de respuesta',
                    'Número de reasignaciones por período',
                    'Efectividad del modo libre'
                ]
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas: ' + error.message
        });
    }
});

// =====================================================
// HEALTH CHECK DEL SISTEMA DE SEGUIMIENTOS
// =====================================================

/**
 * GET /api/prospectos/seguimientos/health
 * Health check del sistema de seguimientos
 */
router.get('/seguimientos/health', SeguimientosController.healthCheck);

// =====================================================
// RUTAS DE ADMINISTRACIÓN (SOLO PARA TESTING)
// =====================================================

/**
 * GET /api/prospectos/admin/cron/estado
 * Ver estado del cron job (solo para administradores)
 */
router.get('/admin/cron/estado', (req, res) => {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const diaActual = ahora.getDay();
    
    const enHorarioLaboral = (
        (diaActual >= 1 && diaActual <= 5 && horaActual >= 8 && horaActual <= 18) ||
        (diaActual === 6 && horaActual >= 9 && horaActual <= 12)
    );
    
    res.json({
        success: true,
        data: {
            estado_cron: 'Activo',
            horario_actual: ahora.toISOString(),
            en_horario_laboral: enHorarioLaboral,
            proxima_ejecucion: enHorarioLaboral ? 'Dentro de 1 hora' : 'Próximo horario laboral',
            configuracion: {
                timezone: 'America/Lima',
                lunes_viernes: '0 8-18 * * 1-5',
                sabados: '0 9-12 * * 6'
            }
        }
    });
});

/**
 * POST /api/prospectos/admin/cron/ejecutar
 * Ejecutar cron job manualmente (solo para testing)
 */
router.post('/admin/cron/ejecutar', cronJobRateLimit, async (req, res) => {
    try {
        const resultado = await SeguimientosController.ejecutarProcesamiento();
        
        res.json({
            success: true,
            data: resultado,
            message: 'Cron job ejecutado manualmente',
            timestamp: new Date().toISOString(),
            nota: 'Esta ejecución manual no interfiere con el cron job automático'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error en ejecución manual del cron job: ' + error.message
        });
    }
});

// =====================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// =====================================================

router.use((error, req, res, next) => {
    console.error('Error en rutas de seguimientos:', error);
    
    // Errores específicos de seguimientos
    if (error.message?.includes('seguimiento')) {
        return res.status(400).json({
            success: false,
            error: 'Error en operación de seguimiento',
            detalles: error.message
        });
    }
    
    // Errores de cron jobs
    if (error.message?.includes('cron') || error.message?.includes('procesamiento')) {
        return res.status(500).json({
            success: false,
            error: 'Error en procesamiento automático',
            detalles: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
            sugerencia: 'Contacte al administrador del sistema'
        });
    }
    
    // Errores generales
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor en sistema de seguimientos',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;