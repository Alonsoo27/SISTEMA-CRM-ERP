const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const NotificacionesController = require('../controllers/notificacionesController');

// 🔧 IMPORTAR MIDDLEWARES JWT
const { authenticateToken, requireRole, requireOwnership } = require('../../../middleware/auth');

// IMPORTAR CONSTANTES DE ROLES
const { PERMISOS_OPERACION } = require('../../../config/roles');

// RATE LIMITING PARA NOTIFICACIONES MASIVAS
const massiveNotificationsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 operaciones masivas cada 15 minutos
    message: {
        success: false,
        error: 'Demasiadas operaciones de notificaciones masivas. Espere 15 minutos.',
        reintentarEn: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// RATE LIMITING PARA CREACIÓN DE NOTIFICACIONES
const createNotificationsRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 50, // máximo 50 notificaciones cada 5 minutos
    message: {
        success: false,
        error: 'Demasiadas notificaciones creadas. Espere 5 minutos.',
        reintentarEn: '5 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// RATE LIMITING PARA CONSULTAS
const queryRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // máximo 100 consultas por minuto
    message: {
        success: false,
        error: 'Demasiadas consultas. Espere 1 minuto.',
        reintentarEn: '1 minuto'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// =====================================================
// 🌐 RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// =====================================================

/**
 * GET /api/notificaciones/health
 * Health check del módulo de notificaciones
 */
router.get('/health', NotificacionesController.healthCheck);

/**
 * GET /api/notificaciones/test
 * Endpoint de prueba general
 */
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '🔔 Módulo de notificaciones SUPERIOR funcionando',
        version: '2.0 - Unificado',
        timestamp: new Date().toISOString(),
        timezone: 'America/Lima (UTC-5)',
        endpoints_disponibles: {
            lectura: [
                'GET /:usuarioId - Obtener notificaciones con opciones avanzadas',
                'GET /contador/:usuarioId - Contador inteligente con desglose',
                'GET /info/tipos - Información de tipos disponibles'
            ],
            escritura: [
                'POST /crear - Método unificado superior (básico/inteligente/masivo)',
                'PUT /:id/marcar-leida - Marcar como leída',
                'PUT /marcar-todas-leidas/:usuarioId - Marcar todas como leídas'
            ],
            administrativas: [
                'POST /seguimiento-vencido - Conveniencia para seguimientos',
                'POST /oportunidad-alto-valor - Conveniencia para oportunidades',
                'POST /masivas - Notificaciones masivas'
            ],
            testing: [
                'GET /test/crear-ejemplo - Crear notificación de prueba',
                'GET /debug/auth - Debug de autenticación (requiere token)',
                'GET /health - Health check completo'
            ]
        },
        funcionalidades_superiores: [
            'Método unificado con opciones configurables',
            'Prioridades automáticas inteligentes',
            'Contenido generado automáticamente',
            'Validación de duplicados',
            'Notificaciones masivas optimizadas',
            'Rate limiting diferenciado',
            'Metadatos enriquecidos',
            'Estadísticas avanzadas'
        ]
    });
});

/**
 * GET /api/notificaciones/debug/auth
 * Endpoint de debug para verificar autenticación
 * Ayuda a diagnosticar problemas de permisos
 */
router.get('/debug/auth', (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        const debugInfo = {
            success: true,
            message: 'Debug de autenticación para notificaciones',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            request_info: {
                has_auth_header: !!authHeader,
                has_token: !!token,
                token_preview: token ? token.substring(0, 20) + '...' : null,
                ip: req.ip,
                user_agent: req.get('User-Agent')
            }
        };

        // Si hay token, intentar decodificar
        if (token) {
            try {
                if (process.env.NODE_ENV === 'development' && token.startsWith('fake-')) {
                    debugInfo.token_info = {
                        type: 'fake_development_token',
                        is_valid: true,
                        user_id: 1,
                        message: 'Token fake de desarrollo - siempre válido'
                    };
                } else {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');

                    debugInfo.token_info = {
                        type: 'jwt',
                        is_valid: true,
                        user_id: decoded.user_id || decoded.id,
                        email: decoded.email,
                        rol: decoded.rol,
                        expires_at: new Date(decoded.exp * 1000).toISOString(),
                        issued_at: new Date(decoded.iat * 1000).toISOString()
                    };
                }

                debugInfo.access_test = {
                    can_access_own_notifications: true,
                    user_id_to_use: debugInfo.token_info.user_id,
                    example_url: `/api/notificaciones/${debugInfo.token_info.user_id}`,
                    message: `Usa esta URL para obtener tus notificaciones: /api/notificaciones/${debugInfo.token_info.user_id}`
                };

            } catch (jwtError) {
                debugInfo.token_info = {
                    type: 'jwt',
                    is_valid: false,
                    error: jwtError.message,
                    error_type: jwtError.name,
                    message: 'Token inválido o expirado'
                };

                debugInfo.access_test = {
                    can_access_own_notifications: false,
                    message: 'No puedes acceder a notificaciones con un token inválido',
                    solution: 'Cierra sesión y vuelve a iniciar sesión para obtener un token válido'
                };
            }
        } else {
            debugInfo.access_test = {
                can_access_own_notifications: false,
                message: 'No se proporcionó token de autenticación',
                solution: 'Incluye el header: Authorization: Bearer <tu_token>'
            };
        }

        res.json(debugInfo);

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error en debug de autenticación',
            details: error.message
        });
    }
});

/**
 * GET /api/notificaciones/info/tipos
 * Obtener tipos de notificaciones disponibles
 */
router.get('/info/tipos', (req, res) => {
    res.json({
        success: true,
        data: {
            tipos_disponibles: [
                { 
                    codigo: 'seguimiento_vencido', 
                    nombre: 'Seguimiento Vencido', 
                    descripcion: 'Seguimiento de prospecto vencido',
                    prioridad_default: 'media'
                },
                { 
                    codigo: 'seguimiento_urgente', 
                    nombre: 'Seguimiento Urgente', 
                    descripcion: 'Seguimiento que requiere atención inmediata',
                    prioridad_default: 'alta'
                },
                { 
                    codigo: 'seguimiento_critico', 
                    nombre: 'Seguimiento Crítico', 
                    descripcion: 'Seguimiento crítico con riesgo alto',
                    prioridad_default: 'critica'
                },
                { 
                    codigo: 'venta_perdida', 
                    nombre: 'Venta Perdida', 
                    descripcion: 'Notificación de venta perdida',
                    prioridad_default: 'alta'
                },
                { 
                    codigo: 'oportunidad_alta', 
                    nombre: 'Oportunidad Alto Valor', 
                    descripcion: 'Oportunidad de alto valor detectada',
                    prioridad_default: 'alta'
                },
                { 
                    codigo: 'sistema', 
                    nombre: 'Sistema', 
                    descripcion: 'Notificación del sistema',
                    prioridad_default: 'normal'
                },
                { 
                    codigo: 'marketing', 
                    nombre: 'Marketing', 
                    descripcion: 'Campañas y promociones',
                    prioridad_default: 'normal'
                },
                { 
                    codigo: 'manual', 
                    nombre: 'Manual', 
                    descripcion: 'Notificación creada manualmente',
                    prioridad_default: 'normal'
                }
            ],
            prioridades: [
                { codigo: 'critica', nombre: 'Crítica', color: '#EF4444' },
                { codigo: 'alta', nombre: 'Alta', color: '#F59E0B' },
                { codigo: 'media', nombre: 'Media', color: '#3B82F6' },
                { codigo: 'normal', nombre: 'Normal', color: '#6B7280' }
            ],
            modos_creacion: [
                { codigo: 'basico', nombre: 'Básico', descripcion: 'Creación simple y rápida' },
                { codigo: 'inteligente', nombre: 'Inteligente', descripcion: 'Con auto-priorización y contenido inteligente' },
                { codigo: 'masivo', nombre: 'Masivo', descripcion: 'Para múltiples usuarios simultáneamente' }
            ]
        }
    });
});

// =====================================================
// 🔐 APLICAR AUTENTICACIÓN JWT A LAS RUTAS PRIVADAS
// =====================================================
router.use(authenticateToken);

// Middleware de logging mejorado (DESPUÉS de autenticación)
router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const userInfo = req.user ? `Usuario: ${req.user.user_id}` : 'Sin auth';
    console.log(`🔔 NotificacionesAPI: ${req.method} ${req.path} - ${timestamp} - ${userInfo}`);
    next();
});

// =====================================================
// 🔐 RUTAS DE LECTURA (Asesor, Supervisor, Admin)
// =====================================================

/**
 * GET /api/notificaciones/:usuarioId
 * Obtener notificaciones de un usuario con opciones avanzadas
 * 🔐 Requiere: Usuarios autenticados + ownership
 */
router.get('/:usuarioId',
    requireOwnership,  // Ya valida que sea el propietario o ejecutivo/jefe
    queryRateLimit,
    NotificacionesController.obtenerNotificaciones
);

/**
 * GET /api/notificaciones/contador/:usuarioId
 * Obtener contador inteligente con desglose
 * 🔐 Requiere: Usuarios autenticados + ownership
 */
router.get('/contador/:usuarioId',
    requireOwnership,  // Ya valida que sea el propietario o ejecutivo/jefe
    queryRateLimit,
    NotificacionesController.obtenerContador
);

// =====================================================
// 🔐 RUTAS DE ESCRITURA (Solo Asesor y Admin)
// =====================================================

/**
 * 🚀 POST /api/notificaciones/crear
 * Crear notificaciones usando el método UNIFICADO SUPERIOR
 * 🔐 Requiere: Vendedores, jefes y ejecutivos
 *
 * Body examples:
 * - Básico: { "tipo": "manual", "data": { "usuario_id": 1, "titulo": "Test", "mensaje": "Mensaje" } }
 * - Inteligente: { "tipo": "seguimiento_vencido", "modo": "inteligente", "data": { "usuario_id": 1, "prospecto_data": {...} }, "auto_prioridad": true }
 * - Masivo: { "tipo": "marketing", "modo": "masivo", "usuarios": [1,2,3], "data": { "titulo": "Promoción", "mensaje": "Nueva campaña" } }
 */
router.post('/crear',
    requireRole(PERMISOS_OPERACION.CREACION.VENTAS),  // Vendedores y superiores
    createNotificationsRateLimit,
    NotificacionesController.crearNotificacion
);

/**
 * PUT /api/notificaciones/:id/marcar-leida
 * Marcar notificación como leída
 * 🔐 Requiere: Usuario autenticado (se valida ownership en controller)
 */
router.put('/:id/marcar-leida',
    queryRateLimit,
    NotificacionesController.marcarLeida
);

/**
 * PUT /api/notificaciones/marcar-todas-leidas/:usuarioId
 * Marcar todas las notificaciones como leídas
 * 🔐 Requiere: Usuarios autenticados + ownership
 */
router.put('/marcar-todas-leidas/:usuarioId',
    requireOwnership,  // Ya valida que sea el propietario o ejecutivo/jefe
    queryRateLimit,
    NotificacionesController.marcarTodasLeidas
);

// =====================================================
// 🔐 RUTAS ADMINISTRATIVAS SUPERIORES (Admin, Supervisor)
// =====================================================

/**
 * 🎯 POST /api/notificaciones/seguimiento-vencido
 * Método de conveniencia para seguimientos vencidos
 * 🔐 Requiere rol: admin, supervisor
 */
router.post('/seguimiento-vencido', 
    requireRole([ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.GERENTE, ROLES.SUPER_ADMIN]),
    createNotificationsRateLimit,
    async (req, res) => {
        try {
            const { usuario_id, prospecto_data } = req.body;
            
            if (!usuario_id || !prospecto_data) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere usuario_id y prospecto_data'
                });
            }

            const resultado = await NotificacionesController.notificarSeguimientoVencido(
                usuario_id, 
                prospecto_data
            );
            
            res.json(resultado);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Error creando notificación de seguimiento: ' + error.message
            });
        }
    }
);

/**
 * 🎯 POST /api/notificaciones/oportunidad-alto-valor
 * Método de conveniencia para oportunidades de alto valor
 * 🔐 Requiere rol: admin, supervisor
 */
router.post('/oportunidad-alto-valor', 
    requireRole([ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.GERENTE, ROLES.SUPER_ADMIN]),
    createNotificationsRateLimit,
    async (req, res) => {
        try {
            const { usuario_id, prospecto_data } = req.body;
            
            if (!usuario_id || !prospecto_data) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere usuario_id y prospecto_data'
                });
            }

            const resultado = await NotificacionesController.notificarOportunidadAltoValor(
                usuario_id, 
                prospecto_data
            );
            
            res.json(resultado);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Error creando notificación de oportunidad: ' + error.message
            });
        }
    }
);

/**
 * 🎯 POST /api/notificaciones/masivas
 * Crear notificaciones masivas (marketing, anuncios, etc.)
 * 🔐 Requiere rol: admin
 */
router.post('/masivas', 
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    massiveNotificationsRateLimit,
    async (req, res) => {
        try {
            const { usuarios, data, tipo = 'marketing' } = req.body;
            
            if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere un array de usuarios no vacío'
                });
            }

            if (!data || !data.titulo || !data.mensaje) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere data con titulo y mensaje'
                });
            }

            const resultado = await NotificacionesController.notificacionMasiva(
                usuarios, 
                data, 
                tipo
            );
            
            res.json(resultado);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Error creando notificaciones masivas: ' + error.message
            });
        }
    }
);

// =====================================================
// 🔐 RUTAS DE TESTING Y DEBUG (Solo Admin)
// =====================================================

/**
 * GET /api/notificaciones/test/crear-ejemplo
 * Crear notificación de ejemplo para testing
 * 🔐 Requiere rol: admin
 */
router.get('/test/crear-ejemplo', 
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const { usuario_id = 1, tipo = 'manual' } = req.query;
            
            const resultado = await NotificacionesController.crearNotificaciones({
                tipo: tipo,
                modo: 'inteligente',
                data: {
                    usuario_id: parseInt(usuario_id),
                    titulo: `🧪 Notificación de prueba`,
                    mensaje: `Esta es una notificación de prueba creada el ${new Date().toLocaleString('es-PE')}`,
                    prospecto_data: {
                        nombre_cliente: 'Cliente de Prueba',
                        valor_estimado: 15000,
                        horas_vencidas: 25
                    }
                },
                auto_prioridad: true,
                incluir_metadatos: true
            });
            
            res.json({
                success: true,
                message: 'Notificación de prueba creada',
                data: resultado
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Error creando notificación de prueba: ' + error.message
            });
        }
    }
);

// =====================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// =====================================================

router.use((error, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`❌ Error en NotificacionesAPI ${req.method} ${req.path} - ${timestamp}:`, error);
    
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
    
    // Errores de Supabase
    if (error.code) {
        return res.status(500).json({
            success: false,
            error: 'Error de base de datos en notificaciones',
            codigo: error.code,
            detalles: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
        });
    }
    
    // Errores generales
    res.status(500).json({
        success: false,
        error: 'Error interno del módulo de notificaciones',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: timestamp,
        path: req.path,
        method: req.method
    });
});

module.exports = router;