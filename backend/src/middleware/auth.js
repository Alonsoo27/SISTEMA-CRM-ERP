const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/auth.log' })
    ]
});

const authenticateToken = async (req, res, next) => {
    const correlationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            logger.warn('Intento de acceso sin token', {
                correlation_id: correlationId,
                endpoint: req.path,
                ip: req.ip
            });

            return res.status(401).json({
                success: false,
                error: 'Token de acceso requerido',
                code: 'NO_TOKEN',
                correlation_id: correlationId
            });
        }

        // ==========================================
        // MODO DESARROLLO: Aceptar tokens fake
        // ==========================================
        if (process.env.NODE_ENV === 'development' && 
            (token === 'fake-jwt-token-for-testing' || token.startsWith('fake-'))) {
            
            req.user = {
                id: 1, // ID numérico real del usuario en la BD
                user_id: 1, // Compatibilidad con ambos campos
                nombre: 'Alonso',
                apellido: 'Admin',
                email: 'eliashuaraca2012@gmail.com',
                rol: 'SUPER_ADMIN',
                rol_id: 1,
                es_jefe: true,
                vende: true, // SUPER_ADMIN puede vender
                jefe_id: null, // SUPER_ADMIN no tiene jefe
                area_id: 1, // Dirección General
                area_nombre: 'Dirección General',
                jefe_nombre: null,
                nombre_completo: 'Alonso Admin'
            };
            
            logger.info('Token fake detectado - Usuario autenticado para desarrollo', {
                correlation_id: correlationId,
                user_id: 1,
                action: 'authenticate_fake',
                endpoint: req.path,
                environment: 'development'
            });
            
            return next();
        }

        // ==========================================
        // MODO PRODUCCIÓN: Validación JWT completa
        // ==========================================
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Soporte flexible para user_id o id en el JWT
        const userId = decoded.user_id || decoded.id;
        
        if (!userId) {
            logger.error('JWT no contiene user_id ni id válido', {
                correlation_id: correlationId,
                decoded_keys: Object.keys(decoded),
                endpoint: req.path
            });

            return res.status(403).json({
                success: false,
                error: 'Token JWT inválido - estructura incorrecta',
                code: 'INVALID_TOKEN_STRUCTURE',
                correlation_id: correlationId
            });
        }

        // CORREGIDO: Consultar usuario con jerarquía completa
        const sql = `
            SELECT u.id, u.nombre, u.apellido, u.email, u.rol_id, u.activo, u.es_jefe, u.vende,
                   u.jefe_id, u.area_id,
                   r.nombre as rol_nombre,
                   a.nombre as area_nombre,
                   CONCAT(jefe.nombre, ' ', jefe.apellido) as jefe_nombre
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            LEFT JOIN usuarios jefe ON u.jefe_id = jefe.id
            WHERE u.id = $1 AND u.activo = true
        `;
        
        const result = await query(sql, [userId]);
        const usuario = result.rows.length > 0 ? result.rows[0] : null;

        if (!usuario) {
            logger.warn('Usuario no válido, inactivo o no encontrado', {
                correlation_id: correlationId,
                user_id: userId,
                endpoint: req.path,
                database_rows_found: result.rows.length
            });

            return res.status(403).json({
                success: false,
                error: 'Usuario no válido o inactivo',
                code: 'INVALID_USER',
                correlation_id: correlationId
            });
        }

        // Construir objeto de usuario empresarial completo
        req.user = {
            id: usuario.id,
            user_id: usuario.id, // Compatibilidad con ambos campos
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol_nombre || 'sin_rol',
            rol_id: usuario.rol_id,
            es_jefe: usuario.es_jefe || false,
            vende: usuario.vende || false,
            jefe_id: usuario.jefe_id,
            area_id: usuario.area_id,
            area_nombre: usuario.area_nombre,
            jefe_nombre: usuario.jefe_nombre,
            nombre_completo: `${usuario.nombre} ${usuario.apellido}`
        };

        logger.info('Usuario autenticado exitosamente', {
            correlation_id: correlationId,
            user_id: usuario.id,
            rol: req.user.rol,
            action: 'authenticate_success',
            endpoint: req.path
        });

        next();

    } catch (error) {
        logger.error('Error crítico de autenticación', {
            correlation_id: correlationId,
            error: error.message,
            error_name: error.name,
            endpoint: req.path,
            stack: error.stack
        });

        // Manejo específico de errores JWT
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                error: 'Token inválido',
                code: 'INVALID_TOKEN',
                correlation_id: correlationId
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                error: 'Token expirado. Inicie sesión nuevamente',
                code: 'EXPIRED_TOKEN',
                correlation_id: correlationId
            });
        }

        // Error de conexión a base de datos
        if (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED')) {
            return res.status(503).json({
                success: false,
                error: 'Error de conectividad del sistema',
                code: 'SERVICE_UNAVAILABLE',
                correlation_id: correlationId
            });
        }

        // Error genérico
        return res.status(500).json({
            success: false,
            error: 'Error interno de autenticación',
            code: 'AUTH_ERROR',
            correlation_id: correlationId
        });
    }
};

const requireRole = (rolesPermitidos) => {
    if (!Array.isArray(rolesPermitidos)) {
        rolesPermitidos = [rolesPermitidos];
    }

    return (req, res, next) => {
        const correlationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        if (!req.user) {
            logger.error('requireRole llamado sin usuario autenticado', {
                correlation_id: correlationId,
                endpoint: req.path
            });

            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado',
                code: 'NOT_AUTHENTICATED',
                correlation_id: correlationId
            });
        }

        // Normalizar roles para compatibilidad
        const rolesNormalizados = rolesPermitidos.map(rol => 
            typeof rol === 'string' ? rol.toUpperCase() : rol
        );
        
        const rolUsuario = req.user.rol?.toUpperCase();

        if (!rolesNormalizados.includes(rolUsuario)) {
            logger.warn('Acceso denegado por rol insuficiente', {
                correlation_id: correlationId,
                user_id: req.user.id,
                rol_actual: req.user.rol,
                roles_requeridos: rolesPermitidos,
                endpoint: req.path
            });

            return res.status(403).json({
                success: false,
                error: 'Permisos insuficientes para esta operación',
                code: 'INSUFFICIENT_PERMISSIONS',
                rol_requerido: rolesPermitidos,
                rol_actual: req.user.rol,
                correlation_id: correlationId
            });
        }

        logger.info('Acceso autorizado por rol', {
            correlation_id: correlationId,
            user_id: req.user.id,
            rol: req.user.rol,
            endpoint: req.path
        });

        next();
    };
};

const requireOwnership = (req, res, next) => {
    const correlationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Usuario no autenticado',
            code: 'NOT_AUTHENTICATED',
            correlation_id: correlationId
        });
    }

    // Permitir acceso total a roles administrativos
    const rolAdministrativo = ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'GERENTE']
        .includes(req.user.rol?.toUpperCase());

    if (rolAdministrativo) {
        logger.info('Acceso administrativo concedido', {
            correlation_id: correlationId,
            user_id: req.user.id,
            rol: req.user.rol,
            endpoint: req.path
        });
        return next();
    }

    // Obtener ID del usuario autenticado
    const currentUserId = req.user.user_id || req.user.id;

    // Extraer IDs solicitados de parámetros de ruta y query
    const {
        asesorId, usuarioId, userId, id
    } = req.params;

    const asesorIdQuery = req.query.asesor_id;
    const userIdQuery = req.query.user_id;

    // Determinar qué ID se está solicitando
    const requestedId = asesorId || usuarioId || userId || id;
    const requestedIdFromQuery = asesorIdQuery || userIdQuery;

    // Validar ownership para parámetros de ruta
    if (requestedId && requestedId !== 'todos' && !isNaN(requestedId)) {
        if (parseInt(requestedId) !== currentUserId) {
            logger.warn('Acceso denegado por ownership - parámetro de ruta', {
                correlation_id: correlationId,
                user_id: currentUserId,
                requested_id: requestedId,
                endpoint: req.path
            });

            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para acceder a esta información',
                code: 'OWNERSHIP_REQUIRED',
                correlation_id: correlationId
            });
        }
    }

    // Validar ownership para parámetros de query
    if (requestedIdFromQuery && !isNaN(requestedIdFromQuery)) {
        if (parseInt(requestedIdFromQuery) !== currentUserId) {
            logger.warn('Acceso denegado por ownership - parámetro query', {
                correlation_id: correlationId,
                user_id: currentUserId,
                requested_id: requestedIdFromQuery,
                endpoint: req.path
            });

            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para acceder a esta información',
                code: 'OWNERSHIP_REQUIRED',
                correlation_id: correlationId
            });
        }
    }

    logger.info('Validación de ownership exitosa', {
        correlation_id: correlationId,
        user_id: currentUserId,
        endpoint: req.path
    });

    next();
};

// Middleware para debugging en desarrollo
const debugAuth = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 AUTH DEBUG:', {
            endpoint: req.path,
            method: req.method,
            authorization: req.headers.authorization ? 'Presente' : 'Ausente',
            user: req.user ? {
                id: req.user.id,
                nombre: req.user.nombre,
                rol: req.user.rol
            } : 'No autenticado'
        });
    }
    next();
};

// Exportar todos los middlewares
module.exports = {
    authenticateToken,
    requireRole,
    requireOwnership,
    debugAuth
};