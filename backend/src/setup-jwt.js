// setup-jwt-complete.js - Script JWT COMPLETO con toda la funcionalidad
const fs = require('fs');
const path = require('path');

console.log('🚀 CONFIGURANDO JWT AUTHENTICATION EMPRESARIAL COMPLETO...\n');

// =====================================================
// CONTENIDO COMPLETO DEL MIDDLEWARE AUTH.JS
// =====================================================
const authMiddlewareContent = `const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            return JSON.stringify({
                timestamp,
                level,
                service,
                message,
                correlation_id: meta.correlation_id,
                user_id: meta.user_id,
                action: meta.action,
                ...meta
            });
        })
    ),
    defaultMeta: { service: 'jwt-auth' },
    transports: [
        new winston.transports.File({ 
            filename: 'logs/auth-error.log', 
            level: 'error',
            maxsize: 10485760,
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: 'logs/auth.log',
            maxsize: 10485760,
            maxFiles: 10
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Middleware de autenticación JWT empresarial COMPLETO
 * Valida token y obtiene información del usuario desde Supabase
 */
const authenticateToken = async (req, res, next) => {
    const correlationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            logger.warn('Intento de acceso sin token', {
                correlation_id: correlationId,
                endpoint: req.path,
                method: req.method,
                ip: req.ip,
                user_agent: req.get('User-Agent'),
                response_time_ms: Date.now() - startTime
            });
            
            return res.status(401).json({
                success: false,
                error: 'Token de acceso requerido',
                code: 'NO_TOKEN',
                correlation_id: correlationId,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar JWT con manejo de errores detallado
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Obtener usuario de Supabase para validar que existe y está activo
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('id, nombre, apellido, email, rol, activo, ultimo_acceso, fecha_creacion')
            .eq('id', decoded.user_id)
            .eq('activo', true)
            .single();

        if (error || !usuario) {
            logger.warn('Usuario no válido o inactivo', {
                correlation_id: correlationId,
                user_id: decoded.user_id,
                endpoint: req.path,
                method: req.method,
                error_message: error?.message,
                error_code: error?.code,
                response_time_ms: Date.now() - startTime
            });
            
            return res.status(403).json({
                success: false,
                error: 'Usuario no válido o inactivo',
                code: 'INVALID_USER',
                correlation_id: correlationId,
                timestamp: new Date().toISOString()
            });
        }

        // Actualizar último acceso del usuario para auditoría empresarial
        try {
            const updateResult = await supabase
                .from('usuarios')
                .update({ 
                    ultimo_acceso: new Date().toISOString(),
                    contador_accesos: usuario.contador_accesos ? usuario.contador_accesos + 1 : 1
                })
                .eq('id', usuario.id);
                
            if (updateResult.error) {
                logger.warn('No se pudo actualizar último acceso', {
                    correlation_id: correlationId,
                    user_id: usuario.id,
                    error: updateResult.error.message
                });
            }
        } catch (updateError) {
            // No fallar la autenticación si no se puede actualizar el último acceso
            logger.warn('Error actualizando último acceso', {
                correlation_id: correlationId,
                user_id: usuario.id,
                error: updateError.message
            });
        }

        // Agregar información completa del usuario al request
        req.user = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol,
            nombre_completo: usuario.nombre + ' ' + usuario.apellido,
            ultimo_acceso: usuario.ultimo_acceso,
            fecha_creacion: usuario.fecha_creacion,
            token_issued_at: decoded.iat,
            token_expires_at: decoded.exp
        };

        // Verificar si el token está próximo a expirar (menos de 2 horas)
        const timeToExpiry = (decoded.exp * 1000) - Date.now();
        const hoursToExpiry = timeToExpiry / (1000 * 60 * 60);
        
        if (hoursToExpiry < 2 && hoursToExpiry > 0) {
            logger.info('Token próximo a expirar', {
                correlation_id: correlationId,
                user_id: usuario.id,
                hours_to_expiry: hoursToExpiry.toFixed(2)
            });
            
            // Agregar header de advertencia
            res.set('X-Token-Warning', 'Token expires in ' + hoursToExpiry.toFixed(2) + ' hours');
        }

        const responseTime = Date.now() - startTime;

        logger.info('Usuario autenticado exitosamente', {
            correlation_id: correlationId,
            user_id: usuario.id,
            action: 'authenticate_success',
            endpoint: req.path,
            method: req.method,
            rol: usuario.rol,
            ip: req.ip,
            user_agent: req.get('User-Agent'),
            response_time_ms: responseTime,
            token_expiry_hours: hoursToExpiry.toFixed(2)
        });

        next();

    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        logger.error('Error crítico de autenticación', {
            correlation_id: correlationId,
            error: error.message,
            stack: error.stack,
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
            user_agent: req.get('User-Agent'),
            response_time_ms: responseTime
        });

        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                error: 'Token inválido',
                code: 'INVALID_TOKEN',
                correlation_id: correlationId,
                timestamp: new Date().toISOString()
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                error: 'Token expirado. Por favor, inicie sesión nuevamente',
                code: 'EXPIRED_TOKEN',
                correlation_id: correlationId,
                timestamp: new Date().toISOString(),
                expired_at: new Date(error.expiredAt).toISOString()
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Error interno de autenticación',
            code: 'AUTH_ERROR',
            correlation_id: correlationId,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Middleware para roles específicos con logging empresarial
 * Valida que el usuario autenticado tenga uno de los roles permitidos
 */
const requireRole = (rolesPermitidos) => {
    if (!Array.isArray(rolesPermitidos)) {
        rolesPermitidos = [rolesPermitidos];
    }
    
    return (req, res, next) => {
        const correlationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const startTime = Date.now();
        
        if (!req.user) {
            logger.error('Usuario no autenticado en requireRole', {
                correlation_id: correlationId,
                endpoint: req.path,
                method: req.method,
                roles_requeridos: rolesPermitidos
            });
            
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado',
                code: 'NOT_AUTHENTICATED',
                correlation_id: correlationId,
                timestamp: new Date().toISOString()
            });
        }

        if (!rolesPermitidos.includes(req.user.rol)) {
            const responseTime = Date.now() - startTime;
            
            logger.warn('Acceso denegado por rol insuficiente', {
                correlation_id: correlationId,
                user_id: req.user.id,
                rol_actual: req.user.rol,
                roles_requeridos: rolesPermitidos,
                endpoint: req.path,
                method: req.method,
                ip: req.ip,
                response_time_ms: responseTime
            });
            
            return res.status(403).json({
                success: false,
                error: 'Permisos insuficientes para esta operación',
                code: 'INSUFFICIENT_PERMISSIONS',
                rol_requerido: rolesPermitidos,
                rol_actual: req.user.rol,
                correlation_id: correlationId,
                timestamp: new Date().toISOString()
            });
        }

        const responseTime = Date.now() - startTime;

        logger.info('Autorización exitosa', {
            correlation_id: correlationId,
            user_id: req.user.id,
            rol: req.user.rol,
            endpoint: req.path,
            method: req.method,
            roles_aceptados: rolesPermitidos,
            response_time_ms: responseTime
        });

        next();
    };
};

/**
 * Middleware empresarial para verificar propiedad de recursos
 * Asegura que asesores solo puedan acceder a sus propios recursos
 */
const requireOwnership = (req, res, next) => {
    const correlationId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    // Los admins y supervisores pueden ver todos los recursos
    if (['admin', 'supervisor'].includes(req.user.rol)) {
        logger.info('Acceso autorizado por rol administrativo', {
            correlation_id: correlationId,
            user_id: req.user.id,
            rol: req.user.rol,
            endpoint: req.path
        });
        return next();
    }
    
    // Para asesores, validar que solo accedan a sus recursos
    const { asesorId } = req.params;
    const asesorIdQuery = req.query.asesor_id;
    
    // Si se especifica un asesor en la URL o query, debe ser el mismo usuario
    if ((asesorId && asesorId !== 'todos' && parseInt(asesorId) !== req.user.id) ||
        (asesorIdQuery && parseInt(asesorIdQuery) !== req.user.id)) {
        
        const responseTime = Date.now() - startTime;
        
        logger.warn('Intento de acceso a recursos de otro asesor', {
            correlation_id: correlationId,
            user_id: req.user.id,
            user_rol: req.user.rol,
            asesor_solicitado: asesorId || asesorIdQuery,
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
            response_time_ms: responseTime
        });
        
        return res.status(403).json({
            success: false,
            error: 'Solo puede acceder a sus propios prospectos',
            code: 'OWNERSHIP_REQUIRED',
            correlation_id: correlationId,
            timestamp: new Date().toISOString()
        });
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Verificación de propiedad exitosa', {
        correlation_id: correlationId,
        user_id: req.user.id,
        endpoint: req.path,
        response_time_ms: responseTime
    });
    
    next();
};

/**
 * Middleware para rate limiting por usuario
 */
const rateLimitByUser = (maxRequests = 100, windowMinutes = 60) => {
    const userRequests = new Map();
    
    return (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) return next();
        
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;
        const userKey = 'user_' + userId;
        
        if (!userRequests.has(userKey)) {
            userRequests.set(userKey, []);
        }
        
        const requests = userRequests.get(userKey);
        const validRequests = requests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            logger.warn('Rate limit excedido por usuario', {
                user_id: userId,
                endpoint: req.path,
                requests_count: validRequests.length,
                max_allowed: maxRequests,
                window_minutes: windowMinutes
            });
            
            return res.status(429).json({
                success: false,
                error: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
                code: 'RATE_LIMIT_EXCEEDED',
                retry_after: Math.ceil(windowMs / 1000)
            });
        }
        
        validRequests.push(now);
        userRequests.set(userKey, validRequests);
        
        next();
    };
};

module.exports = { 
    authenticateToken, 
    requireRole, 
    requireOwnership,
    rateLimitByUser
};`;

// =====================================================
// CONTENIDO COMPLETO DE LAS RUTAS
// =====================================================
const routesContent = `const express = require('express');
const router = express.Router();
const ProspectosController = require('../controllers/prospectosController');
const { 
    authenticateToken, 
    requireRole, 
    requireOwnership, 
    rateLimitByUser 
} = require('../../../middleware/auth');

// Aplicar autenticación a TODAS las rutas
router.use(authenticateToken);

// Rate limiting empresarial por usuario
router.use(rateLimitByUser(200, 60)); // 200 requests por hora por usuario

// =====================================================
// RUTAS PÚBLICAS (Solo requieren autenticación)
// =====================================================
router.get('/health', ProspectosController.healthCheck);

// =====================================================
// RUTAS DE LECTURA (Asesor, Supervisor, Admin)
// =====================================================
router.get('/', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    requireOwnership,
    ProspectosController.obtenerTodos
);

router.get('/kanban/:asesorId?', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    requireOwnership,
    ProspectosController.obtenerKanban
);

router.get('/metricas/:asesorId?', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    requireOwnership,
    ProspectosController.obtenerMetricas
);

router.get('/verificar-duplicado/:telefono', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    ProspectosController.verificarDuplicado
);

router.get('/:id', 
    requireRole(['asesor', 'admin', 'supervisor', 'super_admin', 'jefe_ventas']), 
    ProspectosController.obtenerPorId
);

// =====================================================
// RUTAS DE ESCRITURA (Solo Asesor y Admin)
// =====================================================
router.post('/', 
    requireRole(['asesor', 'admin', 'super_admin']),
    rateLimitByUser(50, 60), // Límite más estricto para creación
    ProspectosController.crearProspecto
);

router.put('/:id', 
    requireRole(['asesor', 'admin', 'super_admin']), 
    ProspectosController.actualizarProspecto
);

router.patch('/:id/estado', 
    requireRole(['asesor', 'admin', 'super_admin']), 
    ProspectosController.cambiarEstado
);

router.post('/:id/cerrar-venta', 
    requireRole(['asesor', 'admin', 'super_admin']), 
    ProspectosController.cerrarVenta
);

// =====================================================
// RUTAS ADMINISTRATIVAS (Solo Admin)
// =====================================================
router.get('/admin/usuarios-activos', 
    requireRole(['admin']), 
    (req, res) => {
        // Placeholder para futuras funcionalidades administrativas
        res.json({
            success: true,
            message: 'Funcionalidad administrativa en desarrollo',
            user: req.user
        });
    }
);

router.get('/admin/auditoria/:fechaInicio/:fechaFin', 
    requireRole(['admin', 'supervisor']), 
    (req, res) => {
        // Placeholder para auditoría
        res.json({
            success: true,
            message: 'Funcionalidad de auditoría en desarrollo',
            parametros: req.params
        });
    }
);

module.exports = router;`;

// =====================================================
// GENERADOR DE TOKENS COMPLETO
// =====================================================
const tokenGeneratorContent = `// generate-token.js - Generador completo de tokens JWT para testing
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Script empresarial para generar tokens JWT de prueba
 * Ejecutar con: node generate-token.js
 */

function generateTestToken(userId = 1, nombre = 'Test', apellido = 'User', rol = 'asesor', horasValidez = 24) {
    const ahora = Math.floor(Date.now() / 1000);
    const payload = {
        user_id: userId,
        nombre: nombre,
        apellido: apellido,
        rol: rol,
        iat: ahora,
        exp: ahora + (horasValidez * 60 * 60),
        jti: crypto.randomBytes(16).toString('hex'), // JWT ID único
        iss: 'sistema-crm-erp', // Emisor
        aud: 'prospectos-api' // Audiencia
    };

    if (!process.env.JWT_SECRET) {
        console.error('❌ ERROR: JWT_SECRET no está configurado en .env');
        console.log('   Agrega esta línea a tu archivo .env:');
        console.log('   JWT_SECRET=tu_clave_secreta_super_segura_2025');
        process.exit(1);
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET);
    
    console.log('🔐 TOKEN JWT GENERADO:');
    console.log('='.repeat(80));
    console.log(token);
    console.log('='.repeat(80));
    console.log('\\n📋 INFORMACIÓN DETALLADA DEL TOKEN:');
    console.log('👤 Usuario ID:', userId);
    console.log('🏷️  Nombre completo:', nombre, apellido);
    console.log('🎭 Rol:', rol);
    console.log('⏰ Válido por:', horasValidez, 'horas');
    console.log('🌍 Creado:', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));
    console.log('🌍 Expira:', new Date((payload.exp * 1000)).toLocaleString('es-PE', { timeZone: 'America/Lima' }));
    console.log('🔑 JWT ID:', payload.jti);
    console.log('📡 Emisor:', payload.iss);
    console.log('👥 Audiencia:', payload.aud);
    
    console.log('\\n🚀 CÓMO USAR EN POSTMAN/THUNDER CLIENT:');
    console.log('1. Copia el token de arriba (toda la línea)');
    console.log('2. Ve a Headers en tu cliente REST');
    console.log('3. Agrega nuevo header:');
    console.log('   Key: Authorization');
    console.log('   Value: Bearer ' + token.substring(0, 50) + '...');
    console.log('4. Haz requests a: http://localhost:3000/api/prospectos/*');
    
    console.log('\\n📱 EJEMPLO CON FETCH (JavaScript):');
    console.log('fetch("http://localhost:3000/api/prospectos/health", {');
    console.log('  headers: {');
    console.log('    "Authorization": "Bearer ' + token.substring(0, 30) + '...",');
    console.log('    "Content-Type": "application/json"');
    console.log('  }');
    console.log('});');
    
    console.log('\\n📝 EJEMPLO CURL:');
    console.log('curl -H "Authorization: Bearer ' + token + '" \\\\');
    console.log('     -H "Content-Type: application/json" \\\\');
    console.log('     http://localhost:3000/api/prospectos/health');
    
    console.log('\\n🧪 TESTING ENDPOINTS ESPECÍFICOS:');
    console.log('- Health check: GET /api/prospectos/health');
    console.log('- Listar prospectos: GET /api/prospectos/');
    console.log('- Kanban: GET /api/prospectos/kanban/' + userId);
    console.log('- Métricas: GET /api/prospectos/metricas/' + userId);
    console.log('- Crear prospecto: POST /api/prospectos/');
    
    return token;
}

// Función para validar un token
function validateToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ TOKEN VÁLIDO');
        console.log('Información del token:', decoded);
        
        const tiempoRestante = decoded.exp - Math.floor(Date.now() / 1000);
        const horasRestantes = tiempoRestante / 3600;
        
        if (horasRestantes > 0) {
            console.log('⏰ Tiempo restante:', horasRestantes.toFixed(2), 'horas');
        } else {
            console.log('⚠️  TOKEN EXPIRADO hace', Math.abs(horasRestantes).toFixed(2), 'horas');
        }
        
        return decoded;
    } catch (error) {
        console.log('❌ TOKEN INVÁLIDO:', error.message);
        return null;
    }
}

// Verificar configuración
function verificarConfiguracion() {
    console.log('🔍 VERIFICANDO CONFIGURACIÓN...\\n');
    
    if (!process.env.JWT_SECRET) {
        console.log('❌ JWT_SECRET no configurado');
        return false;
    } else {
        console.log('✅ JWT_SECRET configurado');
        console.log('   Longitud:', process.env.JWT_SECRET.length, 'caracteres');
        if (process.env.JWT_SECRET.length < 32) {
            console.log('⚠️  RECOMENDACIÓN: Usa una clave más larga (>32 caracteres)');
        }
    }
    
    console.log('✅ Node.js versión:', process.version);
    console.log('✅ Directorio actual:', process.cwd());
    console.log('');
    
    return true;
}

// =====================================================
// EJECUCIÓN PRINCIPAL
// =====================================================

console.log('🎯 GENERADOR EMPRESARIAL DE TOKENS JWT\\n');

if (!verificarConfiguracion()) {
    process.exit(1);
}

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.length > 0 && args[0] === 'validate') {
    const tokenToValidate = args[1];
    if (!tokenToValidate) {
        console.log('❌ Uso: node generate-token.js validate [TOKEN]');
        process.exit(1);
    }
    validateToken(tokenToValidate);
    process.exit(0);
}

console.log('🏭 GENERANDO TOKENS DE PRUEBA EMPRESARIALES...\\n');

// Token de Asesor
console.log('1️⃣ TOKEN ASESOR (Juan Pérez):');
generateTestToken(1, 'Juan', 'Pérez', 'asesor', 24);

console.log('\\n' + '='.repeat(100) + '\\n');

// Token de Admin
console.log('2️⃣ TOKEN ADMIN (María García):');
generateTestToken(2, 'María', 'García', 'admin', 48); // Admin con más tiempo

console.log('\\n' + '='.repeat(100) + '\\n');

// Token de Supervisor
console.log('3️⃣ TOKEN SUPERVISOR (Carlos López):');
generateTestToken(3, 'Carlos', 'López', 'supervisor', 12); // Supervisor con menos tiempo

console.log('\\n' + '='.repeat(100) + '\\n');

// Token de corta duración para testing
console.log('4️⃣ TOKEN TESTING (1 hora - Ana Test):');
generateTestToken(99, 'Ana', 'Testing', 'asesor', 1);

console.log('\\n🎉 TOKENS GENERADOS EXITOSAMENTE');
console.log('\\n📚 COMANDOS ADICIONALES:');
console.log('- Validar token: node generate-token.js validate [TOKEN]');
console.log('- Regenerar tokens: node generate-token.js');
console.log('\\n⚠️  IMPORTANTE:');
console.log('- Estos tokens son SOLO para desarrollo y testing');
console.log('- En producción, genera tokens mediante login real');
console.log('- Guarda los tokens en un lugar seguro para testing');
console.log('- Los tokens expiran según el tiempo configurado');
console.log('\\n🔒 SEGURIDAD:');
console.log('- Nunca compartas tokens en repositorios públicos');
console.log('- Usa HTTPS en producción');
console.log('- Implementa refresh tokens para producción');`;

// =====================================================
// FUNCIONES PARA ESCRIBIR ARCHIVOS
// =====================================================

function writeFile(filePath, content, description) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('📁 Carpeta creada:', dir);
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✅', description + ':', filePath);
        
        // Mostrar tamaño del archivo
        const stats = fs.statSync(filePath);
        console.log('   📊 Tamaño:', (stats.size / 1024).toFixed(2), 'KB');
        
        return true;
    } catch (error) {
        console.error('❌ Error creando', description + ':', error.message);
        return false;
    }
}

function createBackup(filePath) {
    if (fs.existsSync(filePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPath = filePath + '.backup-' + timestamp;
        fs.copyFileSync(filePath, backupPath);
        console.log('💾 Backup creado:', backupPath);
        return backupPath;
    }
    return null;
}

function validateEnvironment() {
    const requiredDirs = ['middleware', 'modules/prospectos'];
    let isValid = true;
    
    console.log('🔍 VALIDANDO ESTRUCTURA DE PROYECTO...\\n');
    
    requiredDirs.forEach(dir => {
        const fullPath = path.join(process.cwd(), dir);
        if (fs.existsSync(fullPath)) {
            console.log('✅ Directorio existe:', dir);
        } else {
            console.log('⚠️  Directorio no existe:', dir);
            isValid = false;
        }
    });
    
    return isValid;
}

// =====================================================
// CREAR ARCHIVOS COMPLETOS
// =====================================================

const currentDir = process.cwd();
console.log('📂 Directorio de trabajo:', currentDir);

if (!validateEnvironment()) {
    console.log('\\n⚠️  AVISO: Algunas carpetas no existen, se crearán automáticamente');
}

const authPath = path.join(currentDir, 'middleware', 'auth.js');
const routesDir = path.join(currentDir, 'modules', 'prospectos', 'routes');
const routesPath = path.join(routesDir, 'prospectos.js');
const tokenGenPath = path.join(currentDir, '..', 'generate-token.js');

console.log('\\n🎯 ARCHIVOS EMPRESARIALES A CREAR:');
console.log('   1. JWT Auth Middleware:', authPath);
console.log('   2. Rutas protegidas:', routesPath);
console.log('   3. Generador de tokens:', tokenGenPath);

console.log('\\n🚀 CREANDO ARQUITECTURA JWT EMPRESARIAL...\\n');

// Crear backups si existen archivos
const authBackup = createBackup(authPath);
const routesBackup = createBackup(routesPath);
const tokenBackup = createBackup(tokenGenPath);

// Crear archivos con contenido completo
const authCreated = writeFile(authPath, authMiddlewareContent, 'Middleware JWT empresarial completo');
const routesCreated = writeFile(routesPath, routesContent, 'Rutas con autenticación y rate limiting');
const tokenCreated = writeFile(tokenGenPath, tokenGeneratorContent, 'Generador empresarial de tokens');

console.log('\\n📋 RESUMEN DE CREACIÓN:');
console.log('Auth middleware:', authCreated ? '✅ Creado' : '❌ Error');
console.log('Rutas protegidas:', routesCreated ? '✅ Creado' : '❌ Error');
console.log('Generador tokens:', tokenCreated ? '✅ Creado' : '❌ Error');

if (authCreated && routesCreated && tokenCreated) {
    console.log('\\n🎉 CONFIGURACIÓN JWT EMPRESARIAL COMPLETADA!');
    console.log('\\n📋 FUNCIONALIDADES INCLUIDAS:');
    console.log('✅ Autenticación JWT completa');
    console.log('✅ Sistema de roles granular');
    console.log('✅ Logging empresarial detallado');
    console.log('✅ Rate limiting por usuario');
    console.log('✅ Actualización de último acceso');
    console.log('✅ Verificación de propiedad de recursos');
    console.log('✅ Manejo de expiración de tokens');
    console.log('✅ Generador de tokens para testing');
    console.log('✅ Validador de tokens');
    console.log('✅ Rutas administrativas');
    console.log('\\n📋 PRÓXIMOS PASOS:');
    console.log('1. ✅ jsonwebtoken ya instalado');
    console.log('2. Agregar a .env: JWT_SECRET=tu_clave_super_segura_2025');
    console.log('3. Modificar prospectosController.js (manual)');
    console.log('4. Actualizar app principal (manual)');
    console.log('5. Probar con: node ../generate-token.js');
    console.log('6. Validar token: node ../generate-token.js validate [TOKEN]');
} else {
    console.log('\\n❌ ALGUNOS ARCHIVOS NO SE PUDIERON CREAR');
    console.log('Revisa los errores de arriba y vuelve a intentar');
    
    if (authBackup) console.log('Restore auth:', 'cp', authBackup, authPath);
    if (routesBackup) console.log('Restore routes:', 'cp', routesBackup, routesPath);
    if (tokenBackup) console.log('Restore tokens:', 'cp', tokenBackup, tokenGenPath);
}

console.log('\\n🔒 VERSIÓN: JWT EMPRESARIAL COMPLETO - SIN REDUCCIÓN DE FUNCIONALIDAD');
console.log('📅 Generado:', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }));
console.log('✅ SCRIPT COMPLETADO - FUNCIONALIDAD EMPRESARIAL COMPLETA');`;