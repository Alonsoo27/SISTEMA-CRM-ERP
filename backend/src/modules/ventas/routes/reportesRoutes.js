// ============================================
// REPORTES ROUTES - APIs REST DE ANALYTICS
// Sistema CRM/ERP v2.0 - Módulo de Reportes Avanzados
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const VentasController = require('../controllers/ventasController');
const ReportesVentasService = require('../services/ReportesVentasService');

// Middleware empresarial unificado
const { authenticateToken, requireRole } = require('../../../middleware/auth');
// Importar constantes de roles
const { ROLES, GRUPOS_ROLES, PERMISOS_OPERACION } = require('../../../config/roles.js');

// ============================================
// DASHBOARDS EJECUTIVOS
// ============================================

/**
 * @route   GET /api/reportes/dashboard/ejecutivo
 * @desc    Dashboard ejecutivo principal
 * @access  Private (Solo Gerentes y Administradores)
 */
router.get('/dashboard/ejecutivo',
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.generarDashboardEjecutivo(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/dashboard/asesor/:asesor_id
 * @desc    Dashboard personalizado del asesor
 * @access  Private (Solo el asesor o sus supervisores)
 */
router.get('/dashboard/asesor/:asesor_id', 
    authenticateToken, 
    VentasController.dashboard
);

/**
 * @route   GET /api/reportes/dashboard/equipo/:gerente_id
 * @desc    Dashboard del equipo de ventas
 * @access  Private (Solo Gerentes)
 */
router.get('/dashboard/equipo/:gerente_id', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.dashboardEquipo(req.params.gerente_id, req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES DE VENTAS
// ============================================

/**
 * @route   GET /api/reportes/ventas/resumen
 * @desc    Resumen general de ventas
 * @access  Private (Según rol del usuario)
 * @params  ?periodo, ?fecha_desde, ?fecha_hasta, ?asesor_id
 */
router.get('/ventas/resumen', 
    authenticateToken,
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.resumenVentas(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/ventas/pipeline
 * @desc    Estado del pipeline de ventas
 * @access  Private (Gerentes y Administradores)
 */
router.get('/ventas/pipeline', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.reportePipeline(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/ventas/conversion
 * @desc    Métricas de conversión
 * @access  Private (Gerentes y Administradores)
 */
router.get('/ventas/conversion', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.reporteConversion(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/ventas/tendencias
 * @desc    Análisis de tendencias de ventas
 * @access  Private (Gerentes y Administradores)
 */
router.get('/ventas/tendencias', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.reporteTendencias(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES DE PERFORMANCE
// ============================================

/**
 * @route   GET /api/reportes/performance/asesores
 * @desc    Ranking de performance de asesores
 * @access  Private (Gerentes y Administradores)
 */
router.get('/performance/asesores', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.rankingAsesores(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/performance/productos
 * @desc    Análisis de performance de productos
 * @access  Private (Gerentes y Administradores)
 */
router.get('/performance/productos', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.performanceProductos(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/performance/regiones
 * @desc    Performance por regiones/territorios
 * @access  Private (Gerentes y Administradores)
 */
router.get('/performance/regiones', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.performanceRegiones(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES PREDICTIVOS
// ============================================

/**
 * @route   GET /api/reportes/predictivos/proyecciones
 * @desc    Proyecciones de ventas
 * @access  Private (Gerentes y Administradores)
 */
router.get('/predictivos/proyecciones', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.proyeccionesVentas(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/predictivos/metas
 * @desc    Análisis predictivo de cumplimiento de metas
 * @access  Private (Gerentes y Administradores)
 */
router.get('/predictivos/metas', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.prediccionMetas(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/predictivos/demanda
 * @desc    Predicción de demanda de productos
 * @access  Private (Gerentes y Administradores)
 */
router.get('/predictivos/demanda', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.prediccionDemanda(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES FINANCIEROS
// ============================================

/**
 * @route   GET /api/reportes/financieros/ingresos
 * @desc    Reporte de ingresos por ventas
 * @access  Private (Gerentes, Administradores, Finanzas)
 */
router.get('/financieros/ingresos', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.reporteIngresos(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/financieros/comisiones
 * @desc    Reporte detallado de comisiones
 * @access  Private (Gerentes, Administradores, Finanzas)
 */
router.get('/financieros/comisiones', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.reporteComisiones(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/financieros/roi
 * @desc    Análisis de ROI por campañas/canales
 * @access  Private (Gerentes y Administradores)
 */
router.get('/financieros/roi', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.analisisROI(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES DE CUSTOMER JOURNEY
// ============================================

/**
 * @route   GET /api/reportes/customer-journey/funnel
 * @desc    Análisis del funnel de conversión
 * @access  Private (Gerentes y Administradores)
 */
router.get('/customer-journey/funnel', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.analisisFunnel(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/customer-journey/touchpoints
 * @desc    Análisis de puntos de contacto
 * @access  Private (Gerentes y Administradores)
 */
router.get('/customer-journey/touchpoints', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.analisisTouchpoints(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// EXPORTACIÓN DE REPORTES
// ============================================

/**
 * @route   POST /api/reportes/exportar/excel
 * @desc    Exportar reporte específico a Excel
 * @access  Private (Según reporte solicitado)
 */
router.post('/exportar/excel', 
    authenticateToken,
    async (req, res) => {
        try {
            const { tipoReporte, parametros } = req.body;
            const archivo = await ReportesVentasService.exportarExcel(tipoReporte, parametros);
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipoReporte}_${Date.now()}.xlsx"`);
            res.send(archivo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   POST /api/reportes/exportar/pdf
 * @desc    Exportar reporte específico a PDF
 * @access  Private (Según reporte solicitado)
 */
router.post('/exportar/pdf', 
    authenticateToken,
    async (req, res) => {
        try {
            const { tipoReporte, parametros } = req.body;
            const archivo = await ReportesVentasService.exportarPDF(tipoReporte, parametros);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipoReporte}_${Date.now()}.pdf"`);
            res.send(archivo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   POST /api/reportes/exportar/csv
 * @desc    Exportar datos a CSV
 * @access  Private (Según reporte solicitado)
 */
router.post('/exportar/csv', 
    authenticateToken,
    async (req, res) => {
        try {
            const { tipoReporte, parametros } = req.body;
            const archivo = await ReportesVentasService.exportarCSV(tipoReporte, parametros);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="datos_${tipoReporte}_${Date.now()}.csv"`);
            res.send(archivo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES PROGRAMADOS
// ============================================

/**
 * @route   GET /api/reportes/programados
 * @desc    Listar reportes programados
 * @access  Private (Gerentes y Administradores)
 */
router.get('/programados', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reportes = await ReportesVentasService.listarReportesProgramados(req.user.id);
            res.json(reportes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   POST /api/reportes/programados
 * @desc    Crear reporte programado
 * @access  Private (Gerentes y Administradores)
 */
router.post('/programados', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.crearReporteProgramado(req.body, req.user.id);
            res.status(201).json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   PUT /api/reportes/programados/:id
 * @desc    Actualizar reporte programado
 * @access  Private (Solo creador o Administradores)
 */
router.put('/programados/:id', 
    authenticateToken,
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.actualizarReporteProgramado(req.params.id, req.body, req.user);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   DELETE /api/reportes/programados/:id
 * @desc    Eliminar reporte programado
 * @access  Private (Solo creador o Administradores)
 */
router.delete('/programados/:id', 
    authenticateToken,
    async (req, res) => {
        try {
            await ReportesVentasService.eliminarReporteProgramado(req.params.id, req.user);
            res.json({ message: 'Reporte programado eliminado exitosamente' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// REPORTES PERSONALIZADOS
// ============================================

/**
 * @route   POST /api/reportes/personalizado
 * @desc    Generar reporte personalizado
 * @access  Private (Gerentes y Administradores)
 */
router.post('/personalizado', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.generarReportePersonalizado(req.body);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/plantillas
 * @desc    Obtener plantillas de reportes disponibles
 * @access  Private (Todos los usuarios autenticados)
 */
router.get('/plantillas', 
    authenticateToken,
    async (req, res) => {
        try {
            const plantillas = await ReportesVentasService.obtenerPlantillasReportes();
            res.json(plantillas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// ANÁLISIS COMPARATIVOS
// ============================================

/**
 * @route   GET /api/reportes/comparativos/periodos
 * @desc    Comparación entre períodos
 * @access  Private (Gerentes y Administradores)
 */
router.get('/comparativos/periodos', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.comparisonPeriodos(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/comparativos/asesores
 * @desc    Comparación entre asesores
 * @access  Private (Gerentes y Administradores)
 */
router.get('/comparativos/asesores', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.comparisonAsesores(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @route   GET /api/reportes/comparativos/equipos
 * @desc    Comparación entre equipos
 * @access  Private (Solo Administradores)
 */
router.get('/comparativos/equipos', 
    authenticateToken,
    requireRole(GRUPOS_ROLES.EJECUTIVOS),
    async (req, res) => {
        try {
            const reporte = await ReportesVentasService.comparisonEquipos(req.query);
            res.json(reporte);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;