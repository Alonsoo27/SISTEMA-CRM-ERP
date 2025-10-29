// ============================================
// RUTAS DEL MÓDULO MARKETING
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const ActividadesController = require('../controllers/actividadesController');
const TransferenciasController = require('../controllers/transferenciasController');
const TiposActividadController = require('../controllers/tiposActividadController');
const CalendarioController = require('../controllers/calendarioController');
const CargaMasivaController = require('../controllers/cargaMasivaController');
const IndicadoresController = require('../controllers/indicadoresController');

// Middleware
const { authenticateToken, requireRole } = require('../../../middleware/auth');
const { ROLES, GRUPOS_ROLES } = require('../../../config/roles');

// Multer para carga de archivos
const multer = require('multer');
const storage = multer.memoryStorage(); // Guardar en memoria para procesar directamente
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
        }
    }
});

// ============================================
// RUTAS PÚBLICAS (Autenticadas)
// ============================================

/**
 * TIPOS DE ACTIVIDADES
 */
router.get('/tipos',
    authenticateToken,
    TiposActividadController.listarTipos
);

router.get('/tipos/categorias',
    authenticateToken,
    TiposActividadController.obtenerCategorias
);

router.get('/tipos/categorias/:categoria_principal',
    authenticateToken,
    TiposActividadController.obtenerSubcategorias
);

// ============================================
// GESTIÓN DE ACTIVIDADES
// ============================================

/**
 * Listar actividades (con filtros)
 * Roles: Marketing completo
 */
router.get('/actividades',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.listarActividades
);

/**
 * Obtener actividad específica
 */
router.get('/actividades/:id',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.obtenerActividad
);

/**
 * Crear actividad individual
 * Roles: Marketing + Gerentes
 */
router.post('/actividades',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.crearActividad
);

/**
 * Crear actividad grupal
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE
 */
router.post('/actividades/grupal',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE]),
    ActividadesController.crearActividadGrupal
);

/**
 * Editar actividad (requiere motivo)
 */
router.put('/actividades/:id',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.editarActividad
);

/**
 * Extender tiempo de actividad
 */
router.post('/actividades/:id/extender',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.extenderActividad
);

/**
 * Completar actividad
 */
router.post('/actividades/:id/completar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.completarActividad
);

/**
 * Cancelar actividad
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE, ADMIN
 */
router.delete('/actividades/:id',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE, ROLES.ADMIN]),
    ActividadesController.cancelarActividad
);

// ============================================
// VISTAS DE CALENDARIO
// ============================================

/**
 * Vista semanal
 */
router.get('/calendario/semanal',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    CalendarioController.vistaSemanal
);

/**
 * Vista mensual
 */
router.get('/calendario/mensual',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    CalendarioController.vistaMensual
);

/**
 * Vista trimestral
 */
router.get('/calendario/trimestral',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    CalendarioController.vistaTrimestral
);

/**
 * Vista anual
 */
router.get('/calendario/anual',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    CalendarioController.vistaAnual
);

// ============================================
// TRANSFERENCIAS Y AUSENCIAS
// ============================================

/**
 * Transferir actividad a otro usuario
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE, ADMIN
 */
router.post('/transferencias',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE, ROLES.ADMIN]),
    TransferenciasController.transferirActividad
);

/**
 * Registrar ausencia (crea actividad de reemplazo)
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE, ADMIN
 * El jefe registra ausencias de su equipo, si el jefe falta lo registra un superior
 */
router.post('/ausencias',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE, ROLES.ADMIN]),
    TransferenciasController.registrarAusencia
);

/**
 * Listar ausencias
 */
router.get('/ausencias',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    TransferenciasController.listarAusencias
);

// ============================================
// CARGA MASIVA
// ============================================

/**
 * Descargar plantilla Excel para carga masiva
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE, ADMIN
 */
router.get('/carga-masiva/plantilla',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE, ROLES.ADMIN]),
    CargaMasivaController.generarPlantilla
);

/**
 * Procesar carga masiva desde Excel
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE, ADMIN
 */
router.post('/carga-masiva',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE, ROLES.ADMIN]),
    upload.single('archivo'),
    CargaMasivaController.procesarCargaMasiva
);

// ============================================
// INDICADORES Y MÉTRICAS
// ============================================

/**
 * Indicadores de rendimiento individual
 * Roles: Marketing completo
 */
router.get('/indicadores/individual/:usuarioId',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    IndicadoresController.obtenerIndicadoresIndividual
);

/**
 * Análisis de tiempo (real vs planeado)
 * Roles: Marketing completo
 */
router.get('/indicadores/tiempo/:usuarioId',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    IndicadoresController.obtenerAnalisisTiempo
);

/**
 * Indicadores del equipo (ranking y comparativas)
 * Roles: Marketing completo
 */
router.get('/indicadores/equipo',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    IndicadoresController.obtenerIndicadoresEquipo
);

/**
 * Análisis por categoría de actividades
 * Roles: Marketing completo
 */
router.get('/indicadores/categorias',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    IndicadoresController.obtenerAnalisisCategorias
);

// ============================================
// NOTIFICACIONES Y ALERTAS
// ============================================

/**
 * Obtener actividades vencidas de un usuario
 * Roles: Marketing completo
 */
router.get('/actividades-vencidas/:usuarioId',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.obtenerActividadesVencidas
);

/**
 * Procesar huecos pendientes al final del día
 * Roles: Marketing completo
 */
router.post('/procesar-huecos/:usuarioId',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.procesarHuecosPendientes
);

module.exports = router;
