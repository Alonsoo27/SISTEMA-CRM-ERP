const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const productosController = require('../controllers/productosController');

// Middleware de autenticación y autorización
const { authenticateToken, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// CONFIGURACIÓN DE RATE LIMITING PARA UPLOADS
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 uploads por IP cada 15 minutos
  message: {
    success: false,
    error: 'Demasiados intentos de carga. Espere 15 minutos antes de intentar nuevamente.',
    reintentarEn: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// MIDDLEWARE DE VALIDACIÓN DE ARCHIVO
const validarArchivoUpload = (req, res, next) => {
    try {
        // Verificar tamaño del request (máximo 10MB)
        if (req.body && JSON.stringify(req.body).length > 10 * 1024 * 1024) {
            return res.status(413).json({
                success: false,
                error: 'Archivo demasiado grande. Máximo 10MB permitido.',
                sugerencia: 'Divida el archivo en lotes más pequeños.'
            });
        }

        // Verificar estructura del request
        const { productos } = req.body;
        if (!productos || !Array.isArray(productos)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de datos inválido. Se esperaba un array de productos.'
            });
        }

        // Verificar estructura mínima de productos
        const camposRequeridos = ['codigo', 'descripcion', 'precio_sin_igv', 'marca', 'categoria', 'unidad_medida'];
        const erroresEstructura = [];

        productos.slice(0, 5).forEach((producto, index) => {
            camposRequeridos.forEach(campo => {
                if (!producto.hasOwnProperty(campo)) {
                    erroresEstructura.push(`Producto ${index + 1}: falta campo '${campo}'`);
                }
            });
        });

        if (erroresEstructura.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Estructura de datos inválida',
                details: erroresEstructura,
                sugerencia: 'Verifique que su archivo tenga todas las columnas requeridas.'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error validando archivo',
            details: error.message
        });
    }
};

// MIDDLEWARE DE MONITOREO DE PERFORMANCE
const monitorearPerformance = (req, res, next) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        const stats = {
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            duration: endTime - startTime,
            memoryUsed: {
                rss: endMemory.rss - startMemory.rss,
                heapUsed: endMemory.heapUsed - startMemory.heapUsed
            },
            timestamp: new Date().toISOString()
        };

        // Log si la operación tomó más de 10 segundos o usó mucha memoria
        if (stats.duration > 10000 || stats.memoryUsed.heapUsed > 100 * 1024 * 1024) {
            console.log('⚠️  Operación lenta detectada:', stats);
        }
    });

    next();
};

// MIDDLEWARE DE AUTORIZACIÓN PARA PRODUCTOS
// ✅ ACTUALIZADO: Diferenciar entre lectura (GET) y escritura (POST/PUT/DELETE)
const requireProductsAuth = (req, res, next) => {
    // Permitir healthcheck básico sin restricción de rol
    if (req.path === '/health/basic') {
        return next();
    }

    const rolUsuario = req.user?.rol?.toUpperCase();
    const metodo = req.method;

    // 📖 LECTURA (GET): Permitir a TODO el equipo de ventas (incluye VENDEDOR)
    if (metodo === 'GET') {
        if (GRUPOS_ROLES.VENTAS_COMPLETO.includes(rolUsuario)) {
            return next();
        }
    }

    // ✍️ ESCRITURA (POST/PUT/DELETE): Solo EJECUTIVOS
    if (['POST', 'PUT', 'DELETE'].includes(metodo)) {
        if (GRUPOS_ROLES.EJECUTIVOS.includes(rolUsuario)) {
            return next();
        }
    }

    // 🔒 Acceso denegado
    return res.status(403).json({
        success: false,
        error: 'Sin autorización',
        message: metodo === 'GET'
            ? 'Solo el equipo de ventas puede ver productos'
            : 'Solo ejecutivos pueden modificar productos',
        codigo: 'INSUFFICIENT_PERMISSIONS',
        rol_requerido: metodo === 'GET' ? GRUPOS_ROLES.VENTAS_COMPLETO : GRUPOS_ROLES.EJECUTIVOS,
        rol_actual: req.user?.rol || 'sin_rol'
    });
};

// ==================== RUTAS BÁSICAS ====================
// ✅ CAMBIO CRÍTICO: Aplicar authenticateToken INDIVIDUALMENTE
router.get('/', authenticateToken, requireProductsAuth, productosController.obtenerProductos);
router.get('/dashboard', authenticateToken, requireProductsAuth, productosController.dashboardProductos);
router.get('/categorias', authenticateToken, requireProductsAuth, productosController.obtenerCategorias);
router.get('/lineas', authenticateToken, productosController.obtenerLineasProductos);
router.get('/:id', authenticateToken, requireProductsAuth, productosController.obtenerProductoPorId);
router.post('/', authenticateToken, requireProductsAuth, productosController.crearProducto);
router.put('/:id', authenticateToken, requireProductsAuth, productosController.actualizarProducto);
router.delete('/:id', authenticateToken, requireProductsAuth, productosController.eliminarProducto);

// ==================== RUTAS DE UPLOAD MASIVO CON PROTECCIONES ====================
router.post('/upload/preview', 
    authenticateToken,
    requireProductsAuth,
    uploadRateLimit, 
    validarArchivoUpload, 
    monitorearPerformance, 
    productosController.previewUploadMasivo
);

router.post('/upload/masivo', 
    authenticateToken,
    requireProductsAuth,
    uploadRateLimit, 
    validarArchivoUpload, 
    monitorearPerformance, 
    productosController.uploadMasivo
);

// ==================== NUEVAS RUTAS DE UTILIDADES ====================
// Búsqueda de producto por código
router.post('/buscar-codigo', authenticateToken, requireProductsAuth, productosController.buscarPorCodigo);

// Plantilla Excel mejorada
router.get('/plantilla/premium', authenticateToken, requireProductsAuth, productosController.generarPlantillaMejorada);

// Healthcheck del módulo
router.get('/health', authenticateToken, requireProductsAuth, productosController.healthCheck);

// Estadísticas y monitoreo
router.get('/stats', authenticateToken, requireProductsAuth, productosController.estadisticasUpload);

// Healthcheck básico (mantener compatibilidad) - SIN RESTRICCIÓN DE ROL
router.get('/health/basic', authenticateToken, (req, res) => {
    res.json({
        success: true,
        module: 'Productos',
        status: 'Operativo',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        user: req.user ? {
            id: req.user.id,
            nombre: req.user.nombre,
            rol: req.user.rol
        } : 'No autenticado'
    });
});

module.exports = router;