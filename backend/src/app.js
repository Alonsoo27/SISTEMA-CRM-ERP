// backend/src/app.js
// Servidor Express principal con configuración superior integrada

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const winston = require('winston');

// Configuración de variables de entorno
require('dotenv').config();

// ✅ VALIDACIÓN DE VARIABLES DE ENTORNO REQUERIDAS
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`❌ Variables de entorno faltantes: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Configuración de logging principal
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'api-superior' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Crear aplicación Express
const app = express();

// =====================================================
// CONFIGURACIÓN DE SEGURIDAD Y MIDDLEWARE BÁSICO
// =====================================================

// ✅ HELMET MEJORADO para mejor seguridad en producción
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        },
    } : {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Compresión GZIP
app.use(compression());

// CORS configurado para desarrollo y producción
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',  // Frontend React dev
            'http://localhost:5173',  // Vite dev
            'http://localhost:4173',  // Vite preview
            process.env.FRONTEND_URL, // URL de producción
        ].filter(Boolean);
        
        // Permitir requests sin origin (como Postman) en desarrollo
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Parsers de body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requests HTTP
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// Archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =====================================================
// RATE LIMITING CONFIGURACIÓN AVANZADA
// =====================================================

// Rate limiting general
const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // máximo 1000 requests por IP cada 15 minutos
    message: {
        success: false,
        error: 'Demasiadas solicitudes. Intente nuevamente en 15 minutos.',
        codigo: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit excedido: ${req.ip} - ${req.method} ${req.path}`);
        res.status(429).json({
            success: false,
            error: 'Demasiadas solicitudes. Intente nuevamente en 15 minutos.',
            codigo: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        });
    }
});

app.use(generalRateLimit);

// Rate limiting estricto para endpoints de autenticación
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login por IP cada 15 minutos
    message: {
        success: false,
        error: 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.',
        codigo: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    skipSuccessfulRequests: true
});

// ✅ RATE LIMITING ESPECÍFICO PARA NOTIFICACIONES
const notificacionesRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // máximo 100 requests por minuto para notificaciones (polling frecuente)
    message: {
        success: false,
        error: 'Demasiadas consultas de notificaciones. Espere 1 minuto.',
        codigo: 'NOTIFICATIONS_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit notificaciones excedido: ${req.ip} - ${req.method} ${req.path}`);
        res.status(429).json({
            success: false,
            error: 'Demasiadas consultas de notificaciones. Espere 1 minuto.',
            codigo: 'NOTIFICATIONS_RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ RATE LIMITING PARA OPERACIONES PESADAS
const heavyOperationsRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10, // máximo 10 operaciones pesadas cada 5 minutos
    message: {
        success: false,
        error: 'Operación pesada limitada. Espere 5 minutos.',
        codigo: 'HEAVY_OPERATION_RATE_LIMIT'
    },
    skipSuccessfulRequests: false
});

// =====================================================
// MIDDLEWARE DE INFORMACIÓN DE REQUEST
// =====================================================

app.use((req, res, next) => {
    req.requestId = require('crypto').randomUUID();
    req.startTime = Date.now();
    
    // Log de request entrante
    logger.info(`📥 ${req.method} ${req.path}`, {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
    });
    
    next();
});

// =====================================================
// RUTAS DE SALUD Y SISTEMA
// =====================================================

// Health check principal
app.get('/health', (req, res) => {
    const healthData = {
        success: true,
        status: 'Operativo',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memoria: {
            used: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        },
        sistema: {
            node_version: process.version,
            platform: process.platform,
            cpu_arch: process.arch
        }
    };
    
    logger.info('✅ Health check exitoso');
    res.json(healthData);
});

// Info de la API
app.get('/api', (req, res) => {
    res.json({
        success: true,
        api: 'Sistema CRM Superior',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        documentacion: '/api/docs',
        endpoints_principales: {
            autenticacion: '/api/auth',
            usuarios: '/api/usuarios',
            prospectos: '/api/prospectos',
            ventas: '/api/ventas',
            actividad: '/api/actividad',
            notificaciones: '/api/notificaciones',
            soporte: '/api/soporte',
            reportes: '/api/reportes',
            configuracion: '/api/configuracion',
            salud: '/health'
        },
        funcionalidades: [
            'Autenticación JWT avanzada',
            'Sistema de prospectos unificado',
            'Notificaciones inteligentes en tiempo real',
            'Rate limiting diferenciado por endpoint',
            'Logging completo con Winston',
            'CORS configurado para múltiples entornos',
            'Seguridad avanzada con Helmet',
            'Validación de variables de entorno'
        ]
    });
});

// =====================================================
// RUTAS DE AUTENTICACIÓN (con rate limiting estricto)
// =====================================================

app.use('/api/auth', authRateLimit, require('./routes/authRoutes'));

// =====================================================
// RUTAS PRINCIPALES DE LA APLICACIÓN
// =====================================================

// Middleware de autenticación para rutas protegidas
const { authenticateToken } = require('./middleware/auth');

// Rutas de usuarios (protegidas)
app.use('/api/usuarios', authenticateToken, require('./routes/usuariosRoutes'));

// Rutas de prospectos (sistema superior unificado - protegidas)
app.use('/api/prospectos', authenticateToken, require('./modules/prospectos/routes/prospectosRoutes'));
// Rutas de ventas (nuevo módulo - protegidas)
app.use('/api/ventas', authenticateToken, require('./modules/ventas/routes/ventasRoutes'));
app.use('/api/actividad', authenticateToken, require('./modules/ventas/routes/actividadRoutes'));
// ✅ RUTAS DE NOTIFICACIONES (sistema superior unificado - protegidas con rate limiting específico)
app.use('/api/notificaciones', notificacionesRateLimit, authenticateToken, require('./modules/notificaciones/routes/notificacionesRoutes'));
// ✅ RUTAS DE SOPORTE TÉCNICO (protegidas)
app.use('/api/soporte', authenticateToken, require('./modules/soporte/routes/soporteRoutes'));

// Rutas de reportes (protegidas)
app.use('/api/reportes', authenticateToken, require('./routes/reportesRoutes'));

// Rutas de configuración (protegidas)
app.use('/api/configuracion', authenticateToken, require('./routes/configuracionRoutes'));

// ✅ RUTAS CON RATE LIMITING ESPECÍFICO PARA OPERACIONES PESADAS
if (process.env.NODE_ENV !== 'development') {
    // Aplicar solo en producción para operaciones que consumen muchos recursos
    app.use('/api/prospectos/seguimientos/procesar-vencidos', heavyOperationsRateLimit);
    app.use('/api/reportes/generar-completo', heavyOperationsRateLimit);
}

// =====================================================
// RUTAS DE DESARROLLO Y TESTING
// =====================================================

if (process.env.NODE_ENV === 'development') {
    // Endpoint para testing de funcionalidades
    app.get('/api/test', authenticateToken, (req, res) => {
        res.json({
            success: true,
            message: 'Endpoint de testing funcionando',
            usuario: req.user,
            timestamp: new Date().toISOString(),
            ambiente: 'desarrollo'
        });
    });

    // Logs en tiempo real para desarrollo
    app.get('/api/logs', (req, res) => {
        res.json({
            success: true,
            message: 'Logs disponibles en la consola del servidor',
            nivel_actual: logger.level,
            transports: logger.transports.length
        });
    });

    // ✅ ENDPOINT MEJORADO para verificar rutas registradas
    app.get('/api/debug/routes', (req, res) => {
        const routes = [];
        app._router.stack.forEach((middleware) => {
            if (middleware.route) {
                routes.push({
                    path: middleware.route.path,
                    methods: Object.keys(middleware.route.methods)
                });
            } else if (middleware.name === 'router') {
                const basePath = middleware.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '');
                middleware.handle.stack.forEach((handler) => {
                    if (handler.route) {
                        routes.push({
                            path: basePath + handler.route.path,
                            methods: Object.keys(handler.route.methods)
                        });
                    }
                });
            }
        });

        res.json({
            success: true,
            total_rutas: routes.length,
            rutas: routes.sort((a, b) => a.path.localeCompare(b.path)),
            timestamp: new Date().toISOString(),
            rate_limits: {
                general: '1000 req/15min',
                auth: '5 req/15min',
                notificaciones: '100 req/1min',
                operaciones_pesadas: '10 req/5min'
            }
        });
    });

    // ✅ ENDPOINT PARA VERIFICAR ESTADO DE RATE LIMITS
    app.get('/api/debug/rate-limits', (req, res) => {
        res.json({
            success: true,
            rate_limits_activos: {
                general: {
                    ventana: '15 minutos',
                    limite: 1000,
                    estado: 'activo'
                },
                autenticacion: {
                    ventana: '15 minutos', 
                    limite: 5,
                    estado: 'activo'
                },
                notificaciones: {
                    ventana: '1 minuto',
                    limite: 100,
                    estado: 'activo'
                },
                operaciones_pesadas: {
                    ventana: '5 minutos',
                    limite: 10,
                    estado: process.env.NODE_ENV === 'production' ? 'activo' : 'desactivado'
                }
            },
            timestamp: new Date().toISOString()
        });
    });
}

// =====================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// =====================================================

app.use('*', (req, res) => {
    logger.warn(`🚫 Ruta no encontrada: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        codigo: 'ENDPOINT_NOT_FOUND',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        sugerencias: [
            'Verificar la URL solicitada',
            'Consultar la documentación en /api',
            'Verificar el método HTTP utilizado',
            'Revisar rutas disponibles en /api/debug/routes (solo desarrollo)'
        ]
    });
});

// =====================================================
// MIDDLEWARE DE MANEJO DE ERRORES GLOBAL
// =====================================================

app.use((error, req, res, next) => {
    const requestDuration = Date.now() - req.startTime;
    
    // Log detallado del error
    logger.error('❌ Error no manejado:', {
        requestId: req.requestId,
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        duration: `${requestDuration}ms`
    });

    // Respuesta según el tipo de error
    let statusCode = 500;
    let errorMessage = 'Error interno del servidor';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    // Errores específicos de JWT
    if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorMessage = 'Token de autenticación inválido';
        errorCode = 'INVALID_TOKEN';
    } else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        errorMessage = 'Token de autenticación expirado';
        errorCode = 'EXPIRED_TOKEN';
    } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = 'No autorizado';
        errorCode = 'UNAUTHORIZED';
    }
    
    // Errores de validación
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Error de validación de datos';
        errorCode = 'VALIDATION_ERROR';
    }
    
    // Errores de base de datos
    else if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint violations
        statusCode = 400;
        errorMessage = 'Error de restricción de base de datos';
        errorCode = 'DATABASE_CONSTRAINT_ERROR';
    }

    // ✅ ERRORES DE CORS MEJORADOS
    else if (error.message && error.message.includes('CORS')) {
        statusCode = 403;
        errorMessage = 'Error de CORS: Origen no permitido';
        errorCode = 'CORS_ERROR';
    }

    // ✅ ERRORES DE RATE LIMITING
    else if (error.message && error.message.includes('Too many requests')) {
        statusCode = 429;
        errorMessage = 'Demasiadas solicitudes';
        errorCode = 'RATE_LIMIT_EXCEEDED';
    }

    // Respuesta de error estructurada
    const errorResponse = {
        success: false,
        error: errorMessage,
        codigo: errorCode,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
    };

    // Incluir detalles adicionales en desarrollo
    if (process.env.NODE_ENV === 'development') {
        errorResponse.detalles = {
            message: error.message,
            stack: error.stack,
            duration: `${requestDuration}ms`
        };
    }

    res.status(statusCode).json(errorResponse);
});

// =====================================================
// MIDDLEWARE DE RESPUESTA EXITOSA (para logging)
// =====================================================

app.use((req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        const requestDuration = Date.now() - req.startTime;
        
        // Log de respuesta exitosa
        if (res.statusCode < 400) {
            logger.info(`📤 ${req.method} ${req.path} - ${res.statusCode}`, {
                requestId: req.requestId,
                duration: `${requestDuration}ms`,
                statusCode: res.statusCode,
                ip: req.ip
            });
        }
        
        originalSend.call(this, data);
    };
    
    next();
});

// =====================================================
// CONFIGURACIÓN DEL SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// Función de inicio del servidor
const startServer = () => {
    try {
        const server = app.listen(PORT, HOST, () => {
            logger.info(`🚀 Servidor iniciado exitosamente:`, {
                port: PORT,
                host: HOST,
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString(),
                processId: process.pid,
                nodeVersion: process.version
            });

            logger.info(`📊 Configuración del servidor:`, {
                cors_enabled: true,
                rate_limiting: {
                    general: '1000 req/15min',
                    auth: '5 req/15min',
                    notificaciones: '100 req/1min',
                    operaciones_pesadas: process.env.NODE_ENV === 'production' ? '10 req/5min' : 'desactivado'
                },
                compression: true,
                helmet_security: true,
                jwt_auth: true,
                logging: 'winston',
                env_validation: true
            });

            logger.info(`🔗 URLs disponibles:`, {
                api_health: `http://${HOST}:${PORT}/health`,
                api_info: `http://${HOST}:${PORT}/api`,
                prospectos: `http://${HOST}:${PORT}/api/prospectos`,
                ventas: `http://${HOST}:${PORT}/api/ventas`,
                notificaciones: `http://${HOST}:${PORT}/api/notificaciones`,
                soporte: `http://${HOST}:${PORT}/api/soporte`,
                debug_routes: process.env.NODE_ENV === 'development' ? `http://${HOST}:${PORT}/api/debug/routes` : 'N/A',
                debug_rate_limits: process.env.NODE_ENV === 'development' ? `http://${HOST}:${PORT}/api/debug/rate-limits` : 'N/A'
            });
        });

        // Manejo de señales del sistema para cierre elegante
        process.on('SIGTERM', () => {
            logger.info('🛑 Señal SIGTERM recibida, cerrando servidor...');
            server.close((err) => {
                if (err) {
                    logger.error('❌ Error cerrando servidor:', err);
                    process.exit(1);
                }
                logger.info('✅ Servidor cerrado exitosamente');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            logger.info('🛑 Señal SIGINT recibida, cerrando servidor...');
            server.close((err) => {
                if (err) {
                    logger.error('❌ Error cerrando servidor:', err);
                    process.exit(1);
                }
                logger.info('✅ Servidor cerrado exitosamente');
                process.exit(0);
            });
        });

        return server;

    } catch (error) {
        logger.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
};

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    logger.error('❌ Excepción no capturada:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Promesa rechazada no manejada:', { reason, promise });
    process.exit(1);
});

// Iniciar servidor solo si este archivo se ejecuta directamente
if (require.main === module) {
    startServer();
}

// Exportar app para testing
module.exports = app;