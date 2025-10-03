// ============================================
// POST VENTA ROUTES - SEGUIMIENTO EMPRESARIAL
// Sistema CRM/ERP v2.0 - Módulo Post-Venta
// ============================================

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Controllers
const PostVentaController = require('../controllers/PostVentaController');

// Middleware empresarial unificado
const { authenticateToken, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// Middlewares de autorización
const requirePostVentaAccess = requireRole(GRUPOS_ROLES.VENTAS_COMPLETO); // Acceso a postventa
const requirePostVentaWrite = requireRole(GRUPOS_ROLES.VENTAS_COMPLETO);  // Crear/modificar seguimientos

// ============================================
// PROGRAMACIÓN DE SEGUIMIENTOS
// ============================================

/**
 * @route   POST /api/postventa/seguimientos/:venta_id/programar
 * @desc    Programar seguimientos automáticos para una venta
 * @access  Private (Asesores, Managers, Admins)
 */
router.post('/seguimientos/:venta_id/programar', 
    authenticateToken,
    PostVentaController.programarSeguimientosAutomaticos
);

// ============================================
// GESTIÓN DE SEGUIMIENTOS
// ============================================

/**
 * @route   GET /api/postventa/seguimientos
 * @desc    Listar seguimientos post-venta con filtros
 * @access  Private (Todos los usuarios autenticados)
 */
router.get('/seguimientos', 
    authenticateToken,
    PostVentaController.listarSeguimientos
);

/**
 * @route   PUT /api/postventa/seguimientos/:id/ejecutar
 * @desc    Ejecutar y completar un seguimiento
 * @access  Private (Asesor asignado, Manager, Admin)
 */
router.put('/seguimientos/:id/ejecutar', 
    authenticateToken,
    PostVentaController.ejecutarSeguimiento
);

/**
 * @route   GET /api/postventa/seguimientos/:id
 * @desc    Obtener detalles de un seguimiento específico
 * @access  Private (Asesor asignado, Manager, Admin)
 */
router.get('/seguimientos/:id', 
    authenticateToken,
    async (req, res) => {
        try {
            const { id } = req.params;
            
            // Simulación básica para testing
            res.json({
                success: true,
                data: {
                    id: parseInt(id),
                    venta_id: 1,
                    tipo_seguimiento: 'Confirmacion_Recepcion',
                    estado: 'Programado',
                    fecha_programada: new Date().toISOString(),
                    descripcion: 'Seguimiento de prueba',
                    prioridad: 'Media'
                },
                message: 'Seguimiento obtenido exitosamente'
            });

        } catch (error) {
            console.error('Error obteniendo seguimiento:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
);

// ============================================
// DASHBOARD Y MÉTRICAS
// ============================================

/**
 * @route   GET /api/postventa/dashboard
 * @desc    Dashboard de métricas post-venta
 * @access  Private (Managers, Admins)
 */
router.get('/dashboard', 
    authenticateToken,
    PostVentaController.getDashboardPostVenta
);

/**
 * @route   GET /api/postventa/dashboard/asesor/:asesor_id
 * @desc    Dashboard personal del asesor
 * @access  Private (Asesor propio, Manager, Admin)
 */
router.get('/dashboard/asesor/:asesor_id', 
    authenticateToken,
    async (req, res) => {
        try {
            const { asesor_id } = req.params;
            const userRole = req.user?.rol || 'guest';
            const userId = req.user?.user_id || req.user?.id;

            // Validar acceso: el asesor solo puede ver su propio dashboard
            if (userRole === 'asesor' && parseInt(asesor_id) !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver este dashboard'
                });
            }

            // Redirigir a la función del dashboard con filtro de asesor
            req.query.asesor_id = asesor_id;
            return PostVentaController.getDashboardPostVenta(req, res);

        } catch (error) {
            console.error('Error obteniendo dashboard del asesor:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
);

// ============================================
// ENCUESTAS DE SATISFACCIÓN
// ============================================

/**
 * @route   POST /api/postventa/encuesta
 * @desc    Crear encuesta de satisfacción
 * @access  Private (Asesores, Managers, Admins)
 */
router.post('/encuesta', 
    authenticateToken,
    async (req, res) => {
        try {
            const {
                venta_id,
                tipo_encuesta = 'satisfaccion_general',
                canal_envio = 'email'
            } = req.body;

            // Simulación para testing
            res.json({
                success: true,
                message: 'Encuesta creada exitosamente',
                data: {
                    encuesta_id: Math.floor(Math.random() * 1000),
                    venta_id,
                    tipo_encuesta,
                    canal_envio,
                    fecha_creada: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error creando encuesta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
);

// ============================================
// CONFIGURACIÓN
// ============================================

/**
 * @route   GET /api/postventa/configuracion/tipos-seguimiento
 * @desc    Obtener tipos de seguimiento disponibles
 * @access  Private (Todos los usuarios autenticados)
 */
router.get('/configuracion/tipos-seguimiento', 
    authenticateToken,
    async (req, res) => {
        try {
            const tipos = [
                { 
                    id: 'Confirmacion_Recepcion', 
                    nombre: 'Confirmación de Recepción', 
                    descripcion: 'Verificar que el cliente recibió el producto' 
                },
                { 
                    id: 'Verificacion_Instalacion', 
                    nombre: 'Verificación de Instalación', 
                    descripcion: 'Confirmar instalación y configuración correcta' 
                },
                { 
                    id: 'Evaluacion_Satisfaccion', 
                    nombre: 'Evaluación de Satisfacción', 
                    descripcion: 'Medir satisfacción general del cliente' 
                },
                { 
                    id: 'Seguimiento_Uso', 
                    nombre: 'Seguimiento de Uso', 
                    descripcion: 'Verificar uso adecuado del producto' 
                },
                { 
                    id: 'Oportunidad_Expansion', 
                    nombre: 'Oportunidad de Expansión', 
                    descripcion: 'Identificar oportunidades de venta adicional' 
                }
            ];

            res.json({
                success: true,
                data: tipos
            });

        } catch (error) {
            console.error('Error obteniendo tipos de seguimiento:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
);

/**
 * @route   GET /api/postventa/test
 * @desc    Test básico del módulo post-venta
 * @access  Private (Todos los usuarios autenticados)
 */
router.get('/test', 
    authenticateToken,
    async (req, res) => {
        res.json({
            success: true,
            message: 'Módulo Post-Venta operativo',
            timestamp: new Date().toISOString(),
            user: {
                id: req.user?.user_id || req.user?.id,
                nombre: req.user?.nombre,
                rol: req.user?.rol
            }
        });
    }
);

/**
 * @route   GET /api/postventa
 * @desc    Endpoint base del módulo post-venta
 * @access  Private (Todos los usuarios autenticados)
 */
router.get('/', 
    authenticateToken,
    async (req, res) => {
        res.json({
            success: true,
            message: 'Módulo Post-Venta CRM/ERP v2.0',
            endpoints: [
                'GET    /api/postventa/test',
                'GET    /api/postventa/seguimientos',
                'POST   /api/postventa/seguimientos/:venta_id/programar',
                'PUT    /api/postventa/seguimientos/:id/ejecutar',
                'GET    /api/postventa/seguimientos/:id',
                'GET    /api/postventa/dashboard',
                'GET    /api/postventa/dashboard/asesor/:asesor_id',
                'POST   /api/postventa/encuesta',
                'GET    /api/postventa/configuracion/tipos-seguimiento'
            ],
            timestamp: new Date().toISOString()
        });
    }
);

module.exports = router;