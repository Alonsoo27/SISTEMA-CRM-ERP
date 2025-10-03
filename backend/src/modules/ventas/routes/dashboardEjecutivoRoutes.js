// ============================================
// DASHBOARD EJECUTIVO ROUTES - PATRÓN EXACTO DASHBOARD PERSONAL
// Sistema CRM/ERP v2.0 - Copiando estructura que SÍ funciona
// ============================================

const express = require('express');
const router = express.Router();

// Controllers - MISMO PATRÓN
const DashboardEjecutivoController = require('../controllers/dashboardEjecutivoController');

// Middleware de autenticación y autorización
const { authenticateToken, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// MIDDLEWARE DE PERMISOS EJECUTIVOS
// ============================================

/**
 * Middleware para verificar acceso a dashboards ejecutivos
 * Solo SUPER_ADMIN(1), GERENTE(2), JEFE_VENTAS(3), ADMIN(11)
 */
const verificarAccesoEjecutivo = (req, res, next) => {
    try {
        const userRole = req.user.rol_id || req.user.role_id;
        const userId = req.user.id || req.user.user_id;
        const userName = req.user.nombre_completo || `${req.user.nombre} ${req.user.apellido}`;

        console.log(`🔍 Verificando acceso ejecutivo:`, {
            user_id: userId,
            nombre: userName,
            rol_id: userRole,
            endpoint: req.path
        });

        // Roles autorizados para dashboards ejecutivos
        const rolesEjecutivosAutorizados = [
            1,  // SUPER_ADMIN - Acceso total
            2,  // GERENTE - Acceso total
            3,  // JEFE_VENTAS - Acceso ventas
            11  // ADMIN - Acceso total
        ];

        if (!rolesEjecutivosAutorizados.includes(userRole)) {
            console.warn(`⚠️ Acceso ejecutivo denegado:`, {
                user_id: userId,
                rol_actual: userRole,
                roles_requeridos: rolesEjecutivosAutorizados,
                endpoint: req.path
            });

            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: Se requieren privilegios ejecutivos',
                error_code: 'INSUFFICIENT_EXECUTIVE_PRIVILEGES',
                user_info: {
                    rol_actual: userRole,
                    acceso_requerido: 'Ejecutivo (Jefe de Ventas o superior)',
                    contacto: 'Solicite acceso a su supervisor'
                }
            });
        }

        // Determinar nivel de acceso específico
        let nivelAcceso = 'limitado';
        let dashboardsPermitidos = [];

        if ([1, 2, 11].includes(userRole)) {
            // SUPER_ADMIN, GERENTE, ADMIN: Acceso total
            nivelAcceso = 'total';
            dashboardsPermitidos = [
                'vista-unificada', 'metas-avanzado', 'sectores-strategy',
                'abc-productos', 'analisis-geografico'
            ];
        } else if (userRole === 3) {
            // JEFE_VENTAS: Acceso específico a ventas
            nivelAcceso = 'ventas';
            dashboardsPermitidos = [
                'vista-unificada', 'metas-avanzado', 'sectores-strategy'
            ];
        }

        // Agregar información de permisos al request
        req.permisos_ejecutivo = {
            nivel_acceso: nivelAcceso,
            dashboards_permitidos: dashboardsPermitidos,
            es_ejecutivo: true,
            puede_ver_todos_asesores: [1, 2, 11].includes(userRole),
            puede_modificar_metas: [1, 2].includes(userRole)
        };

        console.log(`✅ Acceso ejecutivo autorizado:`, {
            user_id: userId,
            nivel_acceso: nivelAcceso,
            dashboards_permitidos: dashboardsPermitidos.length
        });

        next();

    } catch (error) {
        console.error('❌ Error en verificación de acceso ejecutivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno en verificación de permisos',
            error_code: 'PERMISSION_CHECK_ERROR'
        });
    }
};

/**
 * Middleware específico para endpoints que requieren acceso total
 */
const requireAccessoTotal = (req, res, next) => {
    const userRole = req.user.rol_id || req.user.role_id;

    if (![1, 2, 11].includes(userRole)) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado: Se requieren privilegios administrativos completos',
            error_code: 'ADMIN_PRIVILEGES_REQUIRED'
        });
    }

    next();
};

// ============================================
// RUTAS DEL DASHBOARD EJECUTIVO
// ============================================

/**
 * @route   GET /api/dashboard-ejecutivo/vista-unificada
 * @desc    Dashboard ejecutivo - Vista unificada del equipo
 * @access  Private (Ejecutivos: Jefe Ventas+)
 */
router.get('/vista-unificada',
    authenticateToken,
    verificarAccesoEjecutivo,
    DashboardEjecutivoController.vistaUnificada
);

/**
 * @route   GET /api/dashboard-ejecutivo/metas-avanzado
 * @desc    Dashboard metas avanzadas del equipo
 * @access  Private (Ejecutivos: Jefe Ventas+)
 */
router.get('/metas-avanzado',
    authenticateToken,
    verificarAccesoEjecutivo,
    DashboardEjecutivoController.metasAvanzado
);

/**
 * @route   GET /api/dashboard-ejecutivo/sectores-strategy
 * @desc    Análisis estratégico por sectores
 * @access  Private (Ejecutivos: Jefe Ventas+)
 */
router.get('/sectores-strategy',
    authenticateToken,
    verificarAccesoEjecutivo,
    DashboardEjecutivoController.sectoresStrategy
);

/**
 * @route   GET /api/dashboard-ejecutivo/abc-productos
 * @desc    Análisis ABC de productos
 * @access  Private (Administradores: Gerente+)
 */
router.get('/abc-productos',
    authenticateToken,
    verificarAccesoEjecutivo,
    requireAccessoTotal,
    DashboardEjecutivoController.abcProductos
);

/**
 * @route   GET /api/dashboard-ejecutivo/analisis-geografico
 * @desc    Análisis geográfico del equipo
 * @access  Private (Administradores: Gerente+)
 */
router.get('/analisis-geografico',
    authenticateToken,
    verificarAccesoEjecutivo,
    requireAccessoTotal,
    DashboardEjecutivoController.analisisGeografico
);

// ============================================
// RUTAS BÁSICAS (IGUAL AL PERSONAL)
// ============================================

/**
 * @route   GET /api/dashboard-ejecutivo
 * @desc    Endpoint básico de dashboard ejecutivo
 * @access  Private (Ejecutivos)
 */
router.get('/', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), verificarAccesoEjecutivo, (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de dashboard ejecutivo funcionando',
        data: {
            info: 'Sistema de métricas consolidadas para ejecutivos',
            permisos_usuario: req.permisos_ejecutivo,
            endpoints_disponibles: req.permisos_ejecutivo.dashboards_permitidos.map(dashboard =>
                `/api/dashboard-ejecutivo/${dashboard}`
            ),
            endpoints_completos: {
                'vista-unificada': 'KPIs generales y TOP performers',
                'metas-avanzado': 'Sistema de bonos con alertas inteligentes',
                'sectores-strategy': 'Análisis estratégico por sectores',
                'abc-productos': 'Clasificación ABC de productos (Solo Admin+)',
                'analisis-geografico': 'Análisis territorial (Solo Admin+)'
            },
            parametros: {
                periodo: ['hoy', 'semana_actual', 'mes_actual', 'trimestre_actual'],
                ejemplo: '/api/dashboard-ejecutivo/vista-unificada?periodo=mes_actual'
            },
            acceso_usuario: {
                nivel: req.permisos_ejecutivo.nivel_acceso,
                puede_ver_todos_asesores: req.permisos_ejecutivo.puede_ver_todos_asesores,
                puede_modificar_metas: req.permisos_ejecutivo.puede_modificar_metas
            }
        }
    });
});

/**
 * @route   GET /api/dashboard-ejecutivo/health
 * @desc    Health check del módulo ejecutivo
 * @access  Public
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Dashboard Ejecutivo funcionando correctamente',
        version: '1.0.0',
        endpoints_activos: 5,
        status: 'OPERATIONAL',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

console.log('Dashboard Ejecutivo Routes loaded - Patrón exacto Dashboard Personal');
console.log('Rutas disponibles:');
console.log('   - GET /api/dashboard-ejecutivo/vista-unificada');
console.log('   - GET /api/dashboard-ejecutivo/metas-avanzado');
console.log('   - GET /api/dashboard-ejecutivo/sectores-strategy');
console.log('   - GET /api/dashboard-ejecutivo/abc-productos');
console.log('   - GET /api/dashboard-ejecutivo/analisis-geografico');
console.log('   - GET /api/dashboard-ejecutivo/ (info)');
console.log('   - GET /api/dashboard-ejecutivo/health (health check)');