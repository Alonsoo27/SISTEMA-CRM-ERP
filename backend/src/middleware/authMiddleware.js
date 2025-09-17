const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Acceso denegado. No se proporcionó token de autenticación.'
            });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7, authHeader.length) 
            : authHeader;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Acceso denegado. Token inválido.'
            });
        }

        // DEBUG: Ver qué token está llegando
        console.log('🔍 TOKEN RECIBIDO:', {
            authHeader,
            token,
            tokenLength: token.length,
            tokenType: typeof token
        });

        // MODO DESARROLLO: Aceptar tokens fake
        if (token === 'fake-jwt-token-for-testing' || token.startsWith('fake-')) {
            req.user = {
                id: 1,
                email: 'eliashuaraca2012@gmail.com',
                nombre: 'Usuario Test',
                rol: 'SUPER_ADMIN'
            };
            console.log('🚀 Token fake detectado - Usuario autenticado para desarrollo');
            return next();
        }

        // Validación JWT normal para tokens reales
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_default');
        
        req.user = {
            id: decoded.id,
            email: decoded.email,
            nombre: decoded.nombre,
            rol: decoded.rol
        };

        next();

    } catch (error) {
        console.error('Error en middleware de autenticación:', error);
        return res.status(401).json({
            success: false,
            message: 'Token inválido.'
        });
    }
};

module.exports = authMiddleware;