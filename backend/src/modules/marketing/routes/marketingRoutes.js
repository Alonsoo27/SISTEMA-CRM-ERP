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
const ProcesoNocturnoController = require('../controllers/procesoNocturnoController');
const ReportesController = require('../controllers/reportesController');

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
 * Analizar colisión y obtener opciones de resolución
 * Roles: Marketing completo
 */
router.post('/actividades/analizar-colision',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.analizarColision
);

/**
 * Resolver colisión y crear actividad
 * Roles: Marketing completo
 */
router.post('/actividades/resolver-colision',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.resolverColision
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

/**
 * Analizar optimización de calendario
 * Retorna qué actividades se adelantarían al cancelar una actividad
 */
router.get('/actividades/:id/analizar-optimizacion',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.analizarOptimizacion
);

/**
 * Detectar actividades vencidas que requieren gestión
 */
router.get('/actividades-vencidas/:usuarioId/detectar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.detectarActividadesVencidas
);

/**
 * Detectar actividades próximas a vencer (notificaciones preventivas)
 */
router.get('/actividades-proximas-vencer/:usuarioId/detectar',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.detectarActividadesProximasVencer
);

/**
 * Gestionar actividad vencida
 */
router.post('/actividades/:id/gestionar-vencida',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.gestionarActividadVencida
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

/**
 * 🔧 DEBUG: Ejecutar manualmente registrarHuecosPasados()
 * TEMPORAL - Para diagnosticar por qué no se recrean huecos eliminados
 */
router.post('/debug/registrar-huecos/:usuario_id',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ActividadesController.debugRegistrarHuecos
);

// ============================================
// PROCESO NOCTURNO
// ============================================

/**
 * Ejecutar proceso nocturno manualmente
 * Marca como no_realizada las actividades vencidas nunca gestionadas
 * Solo: SUPER_ADMIN
 */
router.post('/proceso-nocturno/ejecutar',
    authenticateToken,
    requireRole([ROLES.SUPER_ADMIN]),
    ProcesoNocturnoController.ejecutarManualmente
);

/**
 * Obtener historial de ejecuciones del proceso nocturno
 * Solo: JEFE_MARKETING, SUPER_ADMIN, GERENTE, ADMIN
 */
router.get('/proceso-nocturno/historial',
    authenticateToken,
    requireRole([ROLES.JEFE_MARKETING, ROLES.SUPER_ADMIN, ROLES.GERENTE, ROLES.ADMIN]),
    ProcesoNocturnoController.obtenerHistorial
);

// ============================================
// REPORTES CORPORATIVOS
// ============================================

/**
 * Obtener datos para reporte de productividad personal (JSON)
 * Roles: Marketing completo
 */
router.get('/reportes/productividad/:usuarioId/datos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.obtenerDatosProductividadPersonal
);

/**
 * Generar reporte de productividad personal en PDF
 * Roles: Marketing completo
 */
router.get('/reportes/productividad/:usuarioId/pdf',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.generarReporteProductividadPDF
);

/**
 * Generar reporte de productividad personal en Excel
 * Roles: Marketing completo
 */
router.get('/reportes/productividad/:usuarioId/excel',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.generarReporteProductividadExcel
);

/**
 * Obtener datos para reporte por categoría (JSON)
 * Roles: Marketing completo
 */
router.get('/reportes/categoria/:usuarioId/datos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.obtenerDatosPorCategoria
);

/**
 * Generar reporte por categoría en PDF
 * Roles: Marketing completo
 */
router.get('/reportes/categoria/:usuarioId/pdf',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.generarReportePorCategoriaPDF
);

/**
 * Generar reporte por categoría en Excel
 * Roles: Marketing completo
 */
router.get('/reportes/categoria/:usuarioId/excel',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.generarReportePorCategoriaExcel
);

/**
 * Obtener datos para reporte de equipo (JSON)
 * Roles: Jefes y ejecutivos
 */
router.get('/reportes/equipo/datos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    ReportesController.obtenerDatosEquipo
);

/**
 * Generar reporte de equipo en PDF
 * Roles: Jefes y ejecutivos
 */
router.get('/reportes/equipo/pdf',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    ReportesController.generarReporteEquipoPDF
);

/**
 * Generar reporte de equipo en Excel
 * Roles: Jefes y ejecutivos
 */
router.get('/reportes/equipo/excel',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    ReportesController.generarReporteEquipoExcel
);

module.exports = router;
