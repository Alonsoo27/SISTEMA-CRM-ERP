const express = require('express');
const router = express.Router();
const multer = require('multer');
const almacenController = require('../controllers/almacenController');
const almacenValidations = require('../utils/almacenValidations');

// Middleware de autenticación y autorización empresarial unificado
const { authenticateToken, requireRole } = require('../../../middleware/auth');
// Importar constantes de roles
const { ROLES, GRUPOS_ROLES, PERMISOS_OPERACION } = require('../../../config/roles.js');

// Configuración de multer para upload de archivos
const upload = multer({
    storage: multer.memoryStorage(), // Almacenar en memoria para procesar directo
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB máximo
    }
});

// ==================== NIVELES DE AUTORIZACIÓN ====================

// Acceso básico al módulo de almacén
const requireAlmacenAccess = requireRole([ROLES.ALMACENERO, ROLES.JEFE_ALMACEN, ROLES.GERENTE, ROLES.SUPER_ADMIN, ROLES.ADMIN]);

// Operaciones críticas (transferencias, ajustes de stock)
const requireAlmacenOperations = requireRole([ROLES.JEFE_ALMACEN, ROLES.GERENTE, ROLES.SUPER_ADMIN, ROLES.ADMIN]);

// Administración del módulo (uploads masivos, configuración) - Solo SUPER_ADMIN
const requireAlmacenAdmin = requireRole([ROLES.SUPER_ADMIN]);

// ==================== DASHBOARD PRINCIPAL ====================

router.get('/dashboard', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenController.obtenerDashboard
);

// ==================== GESTIÓN DE INVENTARIO ====================

// Listar inventario con filtros
router.get('/inventario', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarFiltrosInventario,
    almacenController.obtenerInventario
);

// Obtener inventario por producto específico
router.get('/inventario/producto/:producto_id', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarUUID('producto_id'),
    almacenController.obtenerInventarioPorProducto
);

// Actualizar stock de producto en almacén específico
router.put('/inventario/:producto_id/almacen/:almacen_id', 
    authenticateToken, 
    requireAlmacenOperations, // Operación crítica
    almacenValidations.validarUUID('producto_id'),
    almacenValidations.validarUUID('almacen_id'),
    almacenValidations.validarActualizacionStock,
    almacenController.actualizarStockProducto
);

// ==================== GESTIÓN DE MOVIMIENTOS ====================

// Listar movimientos de inventario
router.get('/movimientos',
    authenticateToken,
    requireAlmacenAccess,
    almacenValidations.validarFiltrosMovimientos,
    almacenController.obtenerMovimientos
);

// Obtener kardex de un producto específico
router.get('/kardex/:producto_id',
    authenticateToken,
    requireAlmacenAccess,
    almacenValidations.validarUUID('producto_id'),
    almacenController.obtenerKardexProducto
);

// Realizar transferencia entre almacenes
router.post('/transferencias', 
    authenticateToken, 
    requireAlmacenOperations, // Operación crítica
    almacenValidations.validarTransferencia,
    almacenController.transferirStock
);

// ==================== GESTIÓN DE ALMACENES ====================

// Listar almacenes disponibles
router.get('/almacenes', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenController.obtenerAlmacenes
);

// ==================== GESTIÓN DE ALERTAS ====================

// Listar alertas de inventario
router.get('/alertas', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarFiltrosAlertas,
    almacenController.obtenerAlertas
);

// Resolver alerta específica
router.put('/alertas/:id/resolver', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarUUID('id'),
    almacenValidations.validarResolucionAlerta,
    almacenController.resolverAlerta
);

// ==================== GESTIÓN DE DESPACHOS ====================

// Obtener despachos pendientes/programados
router.get('/despachos', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarFiltrosDespachos,
    almacenController.obtenerDespachos
);

// Actualizar estado de despacho
router.put('/despachos/:id/estado', 
    authenticateToken, 
    requireAlmacenAccess, // Almaceneros pueden cambiar estados
    almacenValidations.validarUUID('id'),
    almacenValidations.validarCambioEstadoDespacho,
    almacenController.actualizarEstadoDespacho
);

// Obtener despacho específico con detalles
router.get('/despachos/:id', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarUUID('id'),
    almacenController.obtenerDespachoPorId
);

// ==================== ANÁLISIS AVANZADOS (CON VALIDACIÓN DE PERÍODO) ====================

// Análisis de rotación de inventario
router.get('/analisis/rotacion', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Usando tu validación existente
    almacenController.obtenerRotacionInventario
);

// Análisis de eficiencia operativa
router.get('/analisis/eficiencia', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Usando tu validación existente
    almacenController.obtenerEficienciaOperativa
);

// Análisis de stock de seguridad
router.get('/analisis/stock-seguridad', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenController.obtenerAnalisisStockSeguridad
);

// Mapa de calor de almacenes
router.get('/analisis/mapa-calor', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Usando tu validación existente
    almacenController.obtenerMapaCalorAlmacenes
);

// Tendencias de inventario
router.get('/analisis/tendencias',
    authenticateToken,
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Usando tu validación existente
    almacenController.obtenerTendenciasInventario
);

// ✅ ANÁLISIS CONSOLIDADO OPTIMIZADO - REEMPLAZA 5 LLAMADAS CON 1 SOLA
router.get('/analisis/consolidado',
    authenticateToken,
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo,
    almacenController.obtenerAnalisisConsolidado
);

// ✅ REPORTES CONSOLIDADO - UNA SOLA LLAMADA PARA CUALQUIER REPORTE
router.get('/reportes/consolidado/:tipo_reporte',
    authenticateToken,
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo,
    almacenController.obtenerReportesConsolidado
);

// ==================== REPORTES BÁSICOS ====================

// Generar kardex de producto
router.get('/reportes/kardex/:producto_id', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarUUID('producto_id'),
    almacenValidations.validarParametrosKardex,
    almacenController.generarKardex
);

// Reporte de valorización de inventario
router.get('/reportes/valorizacion', 
    authenticateToken, 
    requireAlmacenOperations, // Info sensible financiera
    almacenValidations.validarParametrosValorizacion,
    almacenController.generarReporteValorizacion
);

// Resumen de stock consolidado
router.get('/reportes/stock-consolidado', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenController.obtenerStockConsolidado
);

// ==================== REPORTES AVANZADOS (CON VALIDACIONES) ====================

// Performance comparativa entre almacenes
router.get('/reportes/performance-comparativa', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Validación de período
    almacenController.getPerformanceComparativa
);

// Análisis predictivo de alertas
router.get('/reportes/analisis-predictivo', 
    authenticateToken, 
    requireAlmacenOperations, // Info más sensible para toma de decisiones
    almacenValidations.validarParametrosPeriodo, // ✅ Validación de período
    almacenController.getAnalisisPredictivoAlertas
);

// Evolución de valorización temporal
router.get('/reportes/valorizacion-evolutiva', 
    authenticateToken, 
    requireAlmacenOperations, // Info financiera sensible
    almacenValidations.validarParametrosPeriodo, // ✅ Validación de período
    almacenController.getValorizacionEvolutiva
);

// Kardex inteligente con insights
router.get('/reportes/kardex-inteligente', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Validación de período
    almacenController.getKardexInteligente
);

// Eficiencia de despachos
router.get('/reportes/eficiencia-despachos', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenValidations.validarParametrosPeriodo, // ✅ Validación de período
    almacenController.getEficienciaDespachos
);

// ==================== CONSULTAS PERSONALIZADAS ====================

// Endpoint genérico para queries personalizadas (uso administrativo restringido)
router.post('/query/ejecutar', 
    authenticateToken,
    requireAlmacenAdmin, // Solo administradores por seguridad
    (req, res, next) => {
        // Validación específica para queries personalizadas
        const { query } = req.body;
        
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query requerida y debe ser texto',
                codigo: 'INVALID_QUERY'
            });
        }
        
        const queryLimpia = query.trim().toLowerCase();
        if (!queryLimpia.startsWith('select')) {
            return res.status(400).json({
                success: false,
                error: 'Solo se permiten consultas SELECT',
                codigo: 'ONLY_SELECT_ALLOWED'
            });
        }
        
        // Palabras prohibidas por seguridad
        const palabrasProhibidas = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
        const tieneProhibidas = palabrasProhibidas.some(palabra => queryLimpia.includes(palabra));
        
        if (tieneProhibidas) {
            return res.status(400).json({
                success: false,
                error: 'Query contiene operaciones no permitidas',
                codigo: 'FORBIDDEN_OPERATIONS'
            });
        }
        
        next();
    },
    almacenController.ejecutarQuery
);

// ==================== UPLOAD MASIVO ====================

// Descargar plantilla Excel para upload
router.get('/upload/plantilla', 
    authenticateToken,
    requireAlmacenAccess,
    almacenController.generarPlantillaStock
);

// Preview de upload masivo de stock
router.post('/upload/preview',
    authenticateToken,
    requireAlmacenAdmin, // Solo administradores
    upload.single('archivo'), // Middleware de multer para procesar archivo
    almacenValidations.validarUploadExcel,
    almacenController.previewUploadStock
);

// Ejecutar upload masivo de stock
router.post('/upload/ejecutar',
    authenticateToken,
    requireAlmacenAdmin, // Solo administradores
    upload.single('archivo'), // Middleware de multer para procesar archivo
    almacenValidations.validarUploadExcel,
    almacenController.ejecutarUploadStock
);

// ==================== INTEGRACIONES CON OTROS MÓDULOS ====================

// Verificar stock disponible para venta (usado desde módulo ventas)
router.post('/verificar-stock', 
    authenticateToken, // Sin restricción de rol - usado por ventas
    almacenValidations.validarVerificacionStock,
    almacenController.verificarStockParaVenta
);

// Descontar stock automáticamente (trigger desde ventas)
router.post('/descontar-stock', 
    authenticateToken, // Sin restricción de rol - usado por ventas  
    almacenValidations.validarDescuentoStock,
    almacenController.descontarStockVenta
);

// Crear despacho desde venta
router.post('/despachos/desde-venta', 
    authenticateToken, // Sin restricción de rol - usado por ventas
    almacenValidations.validarCreacionDespacho,
    almacenController.crearDespachoDesdeVenta
);

// ==================== UTILIDADES Y MANTENIMIENTO ====================

// Health check completo del módulo
router.get('/health', 
    authenticateToken, 
    requireAlmacenAccess,
    almacenController.healthCheck
);

// Health check básico (acceso amplio para monitoreo)
router.get('/health/basic', 
    authenticateToken, 
    (req, res) => {
        res.json({
            success: true,
            module: 'Almacén',
            status: 'Operativo',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            user: {
                id: req.user.id,
                rol: req.user.rol,
                tiene_acceso_almacen: ['ALMACENERO', 'JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN'].includes(req.user.rol)
            }
        });
    }
);

// Generar alertas automáticas (tarea programada o manual)
router.post('/mantenimiento/generar-alertas', 
    authenticateToken,
    requireAlmacenAdmin,
    almacenController.generarAlertasAutomaticas
);

// Limpiar alertas resueltas antiguas
router.delete('/mantenimiento/limpiar-alertas', 
    authenticateToken,
    requireAlmacenAdmin,
    almacenController.limpiarAlertasAntiguas
);

// ==================== CONFIGURACIÓN EXPANDIDA DEL MÓDULO ====================

// Obtener configuración y capacidades del módulo
router.get('/config', 
    authenticateToken, 
    requireAlmacenAccess,
    (req, res) => {
        res.json({
            success: true,
            data: {
                modulo: 'Almacén',
                version: '1.0.0',
                usuario: {
                    id: req.user.id,
                    rol: req.user.rol,
                    permisos_almacen: req.user.permisos?.areas?.includes('ALMACEN') || 
                                     req.user.permisos?.areas?.includes('TODAS'),
                    puede_operar: ['JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN'].includes(req.user.rol),
                    puede_administrar: ['GERENTE', 'SUPER_ADMIN'].includes(req.user.rol)
                },
                funcionalidades: [
                    'Gestión de inventario multi-almacén',
                    'Transferencias entre almacenes',
                    'Alertas automáticas de stock',
                    'Despachos integrados con ventas',
                    'Reportes y trazabilidad completa',
                    'Upload masivo de stock',
                    'Análisis avanzados de inventario',
                    'Reportes predictivos y comparativos'
                ],
                configuracion: {
                    tipos_almacen: ['PRINCIPAL', 'SUCURSAL', 'DISTRIBUIDOR', 'OFICINA', 'SUBALMACEN', 'EXHIBICION'],
                    tipos_movimiento: ['ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA', 'INICIAL'],
                    estados_despacho: ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'],
                    niveles_alerta: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
                    estados_stock: ['NORMAL', 'BAJO', 'AGOTADO'],
                    periodos_analisis: ['7d', '30d', '90d', '365d']
                },
                endpoints_disponibles: {
                    dashboard: '/api/almacen/dashboard',
                    inventario: '/api/almacen/inventario',
                    movimientos: '/api/almacen/movimientos',
                    analisis: '/api/almacen/analisis/*',
                    reportes: '/api/almacen/reportes/*',
                    upload: '/api/almacen/upload/*',
                    health: '/api/almacen/health'
                }
            }
        });
    }
);

// ==================== MANEJO DE ERRORES MEJORADO ====================

// Middleware de manejo de errores específico para almacén
router.use((error, req, res, next) => {
    console.error('Error en módulo almacén:', {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        ruta: req.originalUrl,
        metodo: req.method,
        usuario: req.user?.id,
        rol: req.user?.rol,
        timestamp: new Date().toISOString(),
        parametros: {
            query: req.query,
            params: req.params,
            body: req.body ? Object.keys(req.body) : []
        }
    });

    // Errores específicos de almacén con códigos estandarizados y soluciones
    if (error.message.includes('stock insuficiente')) {
        return res.status(400).json({
            success: false,
            error: 'Stock insuficiente',
            details: error.message,
            codigo: 'INSUFFICIENT_STOCK',
            solucion: 'Verifique el stock disponible antes de realizar la operación'
        });
    }

    if (error.message.includes('almacén no encontrado')) {
        return res.status(404).json({
            success: false,
            error: 'Almacén no encontrado',
            details: error.message,
            codigo: 'WAREHOUSE_NOT_FOUND',
            solucion: 'Verifique que el almacén exista y esté activo'
        });
    }

    if (error.message.includes('producto no encontrado')) {
        return res.status(404).json({
            success: false,
            error: 'Producto no encontrado',
            details: error.message,
            codigo: 'PRODUCT_NOT_FOUND',
            solucion: 'Verifique que el producto exista y esté activo'
        });
    }

    if (error.message.includes('transferencia inválida')) {
        return res.status(400).json({
            success: false,
            error: 'Transferencia inválida',
            details: error.message,
            codigo: 'INVALID_TRANSFER',
            solucion: 'Verifique que los almacenes origen y destino sean diferentes y tengan stock suficiente'
        });
    }

    if (error.message.includes('archivo inválido')) {
        return res.status(400).json({
            success: false,
            error: 'Archivo de upload inválido',
            details: error.message,
            codigo: 'INVALID_UPLOAD_FILE',
            solucion: 'Use la plantilla oficial Excel descargada desde el sistema'
        });
    }

    if (error.message.includes('permisos insuficientes')) {
        return res.status(403).json({
            success: false,
            error: 'Permisos insuficientes',
            details: error.message,
            codigo: 'INSUFFICIENT_PERMISSIONS',
            solucion: 'Contacte al administrador para obtener los permisos necesarios'
        });
    }

    // Error genérico con información útil para debugging
    res.status(500).json({
        success: false,
        error: 'Error interno del módulo de almacén',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
        codigo: 'WAREHOUSE_INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        contacto: 'Contacte al administrador del sistema si el problema persiste'
    });
});

module.exports = router;