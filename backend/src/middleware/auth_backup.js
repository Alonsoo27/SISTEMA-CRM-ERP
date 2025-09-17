const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 🔧 USAR ESTRUCTURA REAL DE TABLA USUARIOS
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('id, nombre, apellido, email, rol_id, activo')
            .eq('id', decoded.user_id)
            .eq('activo', true)
            .single();

        if (error || !usuario) {
            logger.warn('Usuario no válido o inactivo', {
                correlation_id: correlationId,
                user_id: decoded.user_id,
                endpoint: req.path,
                error: error?.message
            });
            
            return res.status(403).json({
                success: false,
                error: 'Usuario no válido o inactivo',
                code: 'INVALID_USER',
                correlation_id: correlationId
            });
        }

        // 🔧 MAPEAR rol_id A ROLES STRING
        const rolesMap = {
            1: 'admin',
            2: 'asesor', 
            3: 'supervisor'
        };

        req.user = {
            user_id: usuario.id,  // Para compatibilidad con controller
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: rolesMap[usuario.rol_id] || 'asesor',
            nombre_completo: usuario.nombre + ' ' + usuario.apellido
        };

        logger.info('Usuario autenticado exitosamente', {
            correlation_id: correlationId,
            user_id: usuario.id,
            rol: req.user.rol,
            action: 'authenticate',
            endpoint: req.path
        });

        next();

    } catch (error) {
        logger.error('Error crítico de autenticación', {
            correlation_id: correlationId,
            error: error.message,
            endpoint: req.path
        });

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
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado',
                code: 'NOT_AUTHENTICATED',
                correlation_id: correlationId
            });
        }

        if (!rolesPermitidos.includes(req.user.rol)) {
            logger.warn('Acceso denegado por rol insuficiente', {
                correlation_id: correlationId,
                user_id: req.user.id,
                rol_actual: req.user.rol,
                roles_requeridos: rolesPermitidos
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

        next();
    };
};

const requireOwnership = (req, res, next) => {
    if (['admin', 'supervisor'].includes(req.user.rol)) {
        return next();
    }
    
    const { asesorId } = req.params;
    const asesorIdQuery = req.query.asesor_id;
    
    if ((asesorId && asesorId !== 'todos' && parseInt(asesorId) !== req.user.id) ||
        (asesorIdQuery && parseInt(asesorIdQuery) !== req.user.id)) {
        
        return res.status(403).json({
            success: false,
            error: 'Solo puede acceder a sus propios prospectos',
            code: 'OWNERSHIP_REQUIRED'
        });
    }
    
    next();
};

module.exports = { 
    authenticateToken, 
    requireRole, 
    requireOwnership 
};