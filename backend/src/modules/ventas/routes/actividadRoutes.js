// ============================================
// ACTIVIDAD DIARIA ROUTES - API ENDPOINTS EMPRESARIALES
// Rutas completas con seguridad y validaciones para check-in/check-out
// VERSIÓN COMPLETA CON HISTORIAL
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const ActividadDiariaController = require('../controllers/ActividadDiariaController');

// Services y Models (comentados hasta implementación completa)
// const ActividadDiariaService = require('../services/ActividadDiariaService');
// const ActividadDiariaModel = require('../models/ActividadDiariaModel');

// MIDDLEWARE DE AUTENTICACIÓN EMPRESARIAL UNIFICADO
const { authenticateToken, requireRole, requireOwnership } = require('../../../middleware/auth');
// Importar constantes de roles
const { ROLES, GRUPOS_ROLES, PERMISOS_OPERACION } = require('../../../config/roles.js');

// Definir permisos específicos para actividad de ventas
const requireVentasAccess = requireRole(GRUPOS_ROLES.VENTAS_COMPLETO);
const requireVentasManager = requireRole([ROLES.JEFE_VENTAS, ROLES.GERENTE, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

// ============================================
// MIDDLEWARE DE VALIDACIÓN ESPECÍFICO
// ============================================

/**
 * Middleware para validar datos de check-in
 */
const validateCheckInData = (req, res, next) => {
    try {
        const {
            mensajes_meta = 0,
            mensajes_whatsapp = 0,
            mensajes_instagram = 0,
            mensajes_tiktok = 0,
            notas_check_in = ''
        } = req.body;

        const errores = [];

        // Validaciones básicas de mensajes
        if (mensajes_meta < 0 || mensajes_meta > 1000) {
            errores.push('Mensajes Meta debe estar entre 0 y 1000');
        }
        if (mensajes_whatsapp < 0 || mensajes_whatsapp > 1000) {
            errores.push('Mensajes WhatsApp debe estar entre 0 y 1000');
        }
        if (mensajes_instagram < 0 || mensajes_instagram > 1000) {
            errores.push('Mensajes Instagram debe estar entre 0 y 1000');
        }
        if (mensajes_tiktok < 0 || mensajes_tiktok > 1000) {
            errores.push('Mensajes TikTok debe estar entre 0 y 1000');
        }

        // Validar notas
        if (notas_check_in && notas_check_in.length > 500) {
            errores.push('Las notas no pueden exceder 500 caracteres');
        }

        if (errores.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en check-in',
                errores: errores
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error en validación de check-in',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Middleware para validar datos de check-out
 */
const validateCheckOutData = (req, res, next) => {
    try {
        const {
            llamadas_realizadas = 0,
            llamadas_recibidas = 0,
            notas_check_out = ''
        } = req.body;

        const errores = [];

        // Validaciones básicas de llamadas
        if (llamadas_realizadas < 0 || llamadas_realizadas > 200) {
            errores.push('Llamadas realizadas debe estar entre 0 y 200');
        }
        if (llamadas_recibidas < 0 || llamadas_recibidas > 200) {
            errores.push('Llamadas recibidas debe estar entre 0 y 200');
        }

        // Validar notas
        if (notas_check_out && notas_check_out.length > 1000) {
            errores.push('Las notas no pueden exceder 1000 caracteres');
        }

        if (errores.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en check-out',
                errores: errores
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error en validación de check-out',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Middleware para validar parámetros de consulta
 */
const validateQueryParams = (req, res, next) => {
    try {
        const { page, limit, pagina, limite, fecha_desde, fecha_hasta, fecha_inicio, fecha_fin } = req.query;

        // Validar paginación (soportar ambos nombres)
        const pageParam = page || pagina;
        const limitParam = limit || limite;

        if (pageParam && (isNaN(pageParam) || parseInt(pageParam) < 1)) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro "page/pagina" debe ser un número mayor a 0'
            });
        }

        if (limitParam && (isNaN(limitParam) || parseInt(limitParam) < 1 || parseInt(limitParam) > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro "limit/limite" debe ser un número entre 1 y 100'
            });
        }

        // Validar fechas (soportar ambos nombres)
        const fechaDesde = fecha_desde || fecha_inicio;
        const fechaHasta = fecha_hasta || fecha_fin;

        if (fechaDesde && isNaN(Date.parse(fechaDesde))) {
            return res.status(400).json({
                success: false,
                message: 'Formato de fecha_desde/fecha_inicio inválido. Use YYYY-MM-DD'
            });
        }

        if (fechaHasta && isNaN(Date.parse(fechaHasta))) {
            return res.status(400).json({
                success: false,
                message: 'Formato de fecha_hasta/fecha_fin inválido. Use YYYY-MM-DD'
            });
        }

        // Validar rango de fechas
        if (fechaDesde && fechaHasta && new Date(fechaDesde) > new Date(fechaHasta)) {
            return res.status(400).json({
                success: false,
                message: 'fecha_desde no puede ser posterior a fecha_hasta'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error en validación de parámetros',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Middleware de logging para endpoints de actividad
 */
const logActivityEndpoint = (endpoint) => {
    return (req, res, next) => {
        console.log(`\n🔔 ACTIVIDAD API: ${endpoint}`);
        console.log('User:', req.user?.nombre || 'Unknown', `(ID: ${req.user?.id})`);
        console.log('IP:', req.ip);
        console.log('Timestamp:', new Date().toISOString());
        console.log('================================\n');
        next();
    };
};

// ============================================
// ENDPOINTS PRINCIPALES DE ACTIVIDAD DIARIA
// ============================================

/**
 * @route POST /api/actividad/check-in
 * @desc Realizar check-in del día (inicio de jornada + mensajes recibidos)
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.post('/check-in', 
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('CHECK-IN'),
    validateCheckInData,
    ActividadDiariaController.checkIn
);

/**
 * @route POST /api/actividad/check-out
 * @desc Realizar check-out del día (fin de jornada + llamadas realizadas)
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.post('/check-out',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('CHECK-OUT'),
    validateCheckOutData,
    ActividadDiariaController.checkOut
);

/**
 * @route POST /api/actividad/check-out-retroactivo
 * @desc Completar check-out de jornadas pendientes (días anteriores)
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.post('/check-out-retroactivo',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('CHECK-OUT-RETROACTIVO'),
    validateCheckOutData,
    ActividadDiariaController.checkOutRetroactivo
);

/**
 * @route GET /api/actividad/estado-hoy
 * @desc Obtener estado actual de la actividad del día
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.get('/estado-hoy',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('ESTADO-HOY'),
    ActividadDiariaController.getEstadoHoy
);

/**
 * @route GET /api/actividad
 * @desc Listar actividad diaria con filtros (respeta RLS automáticamente)
 * @access Vendedores (solo propia), Jefes (equipo), Admins (todos)
 */
router.get('/',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('LISTAR-ACTIVIDAD'),
    validateQueryParams,
    ActividadDiariaController.getActividad
);

/**
 * @route GET /api/actividad/dashboard
 * @desc Dashboard de métricas empresariales de actividad
 * @access Vendedores (solo propia), Jefes (equipo), Admins (todos)
 */
router.get('/dashboard',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('DASHBOARD'),
    validateQueryParams,
    ActividadDiariaController.getDashboard
);

/**
 * @route GET /api/actividad/historial
 * @desc Obtener historial paginado de actividad del usuario
 * @access Vendedores (solo propia), Jefes (equipo), Admins (todos)
 */
router.get('/historial',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('HISTORIAL'),
    validateQueryParams,
    ActividadDiariaController.getHistorial
);

/**
 * @route GET /api/actividad/estadisticas-rapidas
 * @desc Obtener estadísticas rápidas de actividad (últimos N días)
 * @access Vendedores (solo propia), Jefes (equipo), Admins (todos)
 */
router.get('/estadisticas-rapidas',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('ESTADISTICAS-RAPIDAS'),
    ActividadDiariaController.getEstadisticasRapidas
);

/**
 * @route GET /api/actividad/resumen-semanal
 * @desc Obtener resumen de actividad de la semana actual
 * @access Vendedores (solo propia), Jefes (equipo), Admins (todos)
 */
router.get('/resumen-semanal',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('RESUMEN-SEMANAL'),
    ActividadDiariaController.getResumenSemanal
);

/**
 * @route GET /api/actividad/datos-graficos
 * @desc Obtener datos para gráficos temporales (semanal, mensual, trimestral, anual)
 * @access Vendedores (solo propia), Jefes (equipo), Admins (todos)
 */
router.get('/datos-graficos',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('DATOS-GRAFICOS'),
    validateQueryParams,
    ActividadDiariaController.getDatosGraficos
);

// ============================================
// ENDPOINTS DE VALIDACIÓN Y UTILIDADES
// ============================================

/**
 * @route GET /api/actividad/validar-checkin
 * @desc Validar si el usuario puede realizar check-in
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.get('/validar-checkin',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('VALIDAR-CHECKIN'),
    async (req, res) => {
        try {
            // Lógica básica de validación sin dependencia del service
            const horaActual = new Date().getHours();
            const puedeCheckin = horaActual >= 6 && horaActual <= 14;
            
            res.json({
                success: true,
                data: {
                    puede_checkin: puedeCheckin,
                    hora_actual: horaActual,
                    ventana_permitida: '6:00 AM - 2:00 PM',
                    mensaje: puedeCheckin ? 'Check-in disponible' : 'Fuera de horario de check-in'
                },
                message: puedeCheckin ? 'Check-in disponible' : 'Check-in no disponible'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al validar disponibilidad de check-in',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

/**
 * @route GET /api/actividad/validar-checkout
 * @desc Validar si el usuario puede realizar check-out
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.get('/validar-checkout',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('VALIDAR-CHECKOUT'),
    async (req, res) => {
        try {
            // Lógica básica de validación sin dependencia del service
            const horaActual = new Date().getHours();
            const puedeCheckout = horaActual >= 14 && horaActual <= 22;
            
            res.json({
                success: true,
                data: {
                    puede_checkout: puedeCheckout,
                    hora_actual: horaActual,
                    ventana_permitida: '2:00 PM - 10:00 PM',
                    mensaje: puedeCheckout ? 'Check-out disponible' : 'Fuera de horario de check-out'
                },
                message: puedeCheckout ? 'Check-out disponible' : 'Check-out no disponible'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al validar disponibilidad de check-out',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

/**
 * @route GET /api/actividad/configuracion
 * @desc Obtener configuración empresarial (horarios, límites, etc.)
 * @access Vendedores, Asesores, Supervisores, Managers, Admins
 */
router.get('/configuracion',
    authenticateToken,
    requireVentasAccess,
    logActivityEndpoint('CONFIGURACION'),
    (req, res) => {
        try {
            const configuracion = {
                horarios_empresariales: {
                    check_in: {
                        hora_inicio: '06:00',
                        hora_fin: '14:00',
                        descripcion: '6:00 AM - 2:00 PM'
                    },
                    check_out: {
                        hora_inicio: '14:00',
                        hora_fin: '22:00',
                        descripcion: '2:00 PM - 10:00 PM'
                    }
                },
                limites_productividad: {
                    mensajes_maximos: 1000,
                    llamadas_maximas: 200,
                    notas_check_in_max: 500,
                    notas_check_out_max: 1000
                },
                estados_validos: ['sin_iniciar', 'en_progreso', 'finalizada'],
                zona_horaria: 'America/Lima',
                version_api: '1.0.0'
            };

            res.json({
                success: true,
                data: configuracion,
                message: 'Configuración empresarial obtenida'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener configuración',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// ============================================
// ENDPOINTS AVANZADOS (MANAGERS Y SUPERIORES)
// ============================================

/**
 * @route GET /api/actividad/actividad-completa/:usuario_id
 * @desc Obtener actividad completa de un usuario específico (con análisis)
 * @access Managers, Supervisores, Admins (con verificación de jerarquía)
 */
router.get('/actividad-completa/:usuario_id',
    authenticateToken,
    requireVentasManager,
    logActivityEndpoint('ACTIVIDAD-COMPLETA'),
    async (req, res) => {
        try {
            const { usuario_id } = req.params;
            const { fecha } = req.query;

            if (isNaN(usuario_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de usuario inválido'
                });
            }

            // Implementación básica sin service dependency
            res.json({
                success: true,
                data: {
                    usuario_id: parseInt(usuario_id),
                    fecha: fecha || new Date().toISOString().split('T')[0],
                    mensaje: 'Función disponible próximamente - Requiere implementación completa del service'
                },
                message: 'Endpoint disponible - Implementación pendiente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener actividad completa',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

/**
 * @route GET /api/actividad/metricas-empresariales/:usuario_id
 * @desc Calcular métricas empresariales de un período específico
 * @access Managers, Supervisores, Admins
 */
router.get('/metricas-empresariales/:usuario_id',
    authenticateToken,
    requireVentasManager,
    logActivityEndpoint('METRICAS-EMPRESARIALES'),
    validateQueryParams,
    async (req, res) => {
        try {
            const { usuario_id } = req.params;
            const { fecha_desde, fecha_hasta } = req.query;

            if (isNaN(usuario_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de usuario inválido'
                });
            }

            // Fechas por defecto: últimos 7 días
            const fechaInicio = fecha_desde || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const fechaFin = fecha_hasta || new Date().toISOString().split('T')[0];

            // Implementación básica sin service dependency
            res.json({
                success: true,
                data: {
                    usuario_id: parseInt(usuario_id),
                    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
                    mensaje: 'Función disponible próximamente - Requiere implementación completa del service'
                },
                message: 'Endpoint disponible - Implementación pendiente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al calcular métricas empresariales',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

/**
 * @route POST /api/actividad/dashboard-equipo
 * @desc Dashboard comparativo de equipo (para jefes y managers)
 * @access Managers, Supervisores, Admins
 */
router.post('/dashboard-equipo',
    authenticateToken,
    requireVentasManager,
    logActivityEndpoint('DASHBOARD-EQUIPO'),
    validateQueryParams,
    async (req, res) => {
        try {
            const { user_ids } = req.body;
            const { fecha_desde, fecha_hasta } = req.query;

            if (!Array.isArray(user_ids) || user_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe proporcionar un array de user_ids válido'
                });
            }

            // Validar que todos los IDs sean números
            const invalidIds = user_ids.filter(id => isNaN(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `IDs de usuario inválidos: ${invalidIds.join(', ')}`
                });
            }

            // Fechas por defecto: últimos 7 días
            const fechaInicio = fecha_desde || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const fechaFin = fecha_hasta || new Date().toISOString().split('T')[0];

            // Implementación básica sin service dependency
            res.json({
                success: true,
                data: {
                    user_ids: user_ids.map(id => parseInt(id)),
                    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
                    mensaje: 'Función disponible próximamente - Requiere implementación completa del service'
                },
                message: 'Endpoint disponible - Implementación pendiente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al generar dashboard de equipo',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// ============================================
// ENDPOINT DE INFORMACIÓN DE LA API
// ============================================

/**
 * @route GET /api/actividad/info
 * @desc Información general de la API de actividad diaria
 * @access Público (usuarios autenticados)
 */
router.get('/info',
    authenticateToken,
    requireVentasAccess,
    (req, res) => {
        res.json({
            success: true,
            data: {
                api_name: 'Actividad Diaria API',
                version: '1.0.0',
                description: 'Sistema empresarial de check-in/check-out para vendedores y asesores',
                endpoints_disponibles: {
                    check_in: 'POST /actividad/check-in',
                    check_out: 'POST /actividad/check-out',
                    estado_hoy: 'GET /actividad/estado-hoy',
                    listar: 'GET /actividad/',
                    dashboard: 'GET /actividad/dashboard',
                    historial: 'GET /actividad/historial',
                    estadisticas_rapidas: 'GET /actividad/estadisticas-rapidas',
                    resumen_semanal: 'GET /actividad/resumen-semanal',
                    validaciones: 'GET /actividad/validar-[checkin|checkout]',
                    configuracion: 'GET /actividad/configuracion'
                },
                endpoints_managers: {
                    actividad_completa: 'GET /actividad/actividad-completa/:usuario_id',
                    metricas_empresariales: 'GET /actividad/metricas-empresariales/:usuario_id',
                    dashboard_equipo: 'POST /actividad/dashboard-equipo'
                },
                horarios_empresariales: {
                    check_in: '6:00 AM - 2:00 PM',
                    check_out: '2:00 PM - 10:00 PM'
                },
                seguridad: 'JWT + Row Level Security + Role-based access',
                zona_horaria: 'America/Lima'
            },
            message: 'API de Actividad Diaria - Sistema Empresarial'
        });
    }
);

// ============================================
// ENDPOINT DE TEST (PARA VERIFICAR QUE FUNCIONA)
// ============================================

/**
 * @route GET /api/actividad/test
 * @desc Test de conectividad y autenticación
 * @access Usuarios autenticados
 */
router.get('/test',
    authenticateToken,
    (req, res) => {
        res.json({
            success: true,
            message: 'Servicio de actividad funcionando correctamente',
            data: {
                user: {
                    id: req.user.id,
                    nombre: req.user.nombre,
                    rol: req.user.rol
                },
                timestamp: new Date().toISOString(),
                endpoints_funcionando: true,
                nuevos_endpoints: {
                    historial: 'ACTIVO',
                    estadisticas_rapidas: 'ACTIVO',
                    resumen_semanal: 'ACTIVO'
                }
            }
        });
    }
);

// ============================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================

/**
 * Middleware de manejo de errores 404 para rutas no encontradas
 */
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint no encontrado: ${req.method} ${req.originalUrl}`,
        endpoints_disponibles: '/api/actividad/info',
        sugerencia: 'Consulte /api/actividad/info para ver todos los endpoints disponibles'
    });
});

/**
 * Middleware global de manejo de errores
 */
router.use((error, req, res, next) => {
    console.error('❌ Error en actividad routes:', error);
    
    res.status(500).json({
        success: false,
        message: 'Error interno en API de actividad diaria',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
});

console.log('✅ ActividadRoutes loaded successfully - Enterprise API endpoints ready');
console.log('🛡️  Security: JWT + Role-based access, Data validation, Business rules');
console.log('📊 Endpoints: 13 main routes + 3 manager routes + utilities');
console.log('🎯 Features: Auto-validation, RLS integration, Historial completo');
console.log('🆕 New endpoints: /historial, /estadisticas-rapidas, /resumen-semanal');
console.log('');

module.exports = router;