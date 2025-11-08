// ============================================
// CONTROLADOR DE REPORTES - MARKETING
// Generación de reportes corporativos en PDF y Excel
// ============================================

const { query } = require('../../../config/database');
const { GRUPOS_ROLES } = require('../../../config/roles');
const ReportePDFService = require('../services/reportePDFService');
const ReporteExcelService = require('../services/reporteExcelService');
const ReportesQueries = require('../services/reportes/queries/reportesQueries');

class ReportesController {
    /**
     * Método interno para obtener datos de productividad
     * (usado por los 3 endpoints: JSON, PDF, Excel)
     * Ahora usa ReportesQueries para queries corregidas
     */
    static async _obtenerDatosProductividad(usuarioId, periodo, userSolicitante) {
        // Validar permisos: solo el mismo usuario o jefes/ejecutivos
        if (parseInt(usuarioId) !== userSolicitante.id &&
            !GRUPOS_ROLES.JEFES_Y_EJECUTIVOS.includes(userSolicitante.rol)) {
            throw {
                status: 403,
                success: false,
                message: 'No tienes permiso para generar reportes de otro usuario'
            };
        }

        // Calcular fechas según período
        const { fechaInicio, fechaFin } = calcularPeriodo(periodo);

        // Usar ReportesQueries.obtenerDatosCompletos para obtener datos con análisis avanzado
        // (Excluye actividades SISTEMA, usa fecha_inicio_planeada, solo suma tiempo de completadas)
        // Incluye: comparativa período anterior, ranking, productividad por día, conclusiones
        const datos = await ReportesQueries.obtenerDatosCompletos(
            usuarioId,
            fechaInicio,
            fechaFin
        );

        // RETORNAR DATOS CONSOLIDADOS con formato esperado
        return {
            success: true,
            data: {
                ...datos,
                periodo: {
                    tipo: periodo,
                    fechaInicio,
                    fechaFin,
                    descripcion: obtenerDescripcionPeriodo(periodo)
                }
            }
        };
    }

    /**
     * Obtener datos para reporte de productividad personal (endpoint JSON)
     */
    static async obtenerDatosProductividadPersonal(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            const resultado = await ReportesController._obtenerDatosProductividad(
                usuarioId,
                periodo,
                userSolicitante
            );

            return res.json(resultado);

        } catch (error) {
            console.error('❌ Error obteniendo datos de productividad:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al obtener datos de productividad',
                error: error.message
            });
        }
    }

    /**
     * Generar reporte de productividad en PDF
     */
    static async generarReporteProductividadPDF(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            // Obtener datos
            const resultado = await ReportesController._obtenerDatosProductividad(
                usuarioId,
                periodo,
                userSolicitante
            );

            // Generar PDF
            const pdfBuffer = await ReportePDFService.generarProductividadPersonal(resultado.data);

            // Enviar PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Productividad_${resultado.data.usuario.nombre_completo.replace(/\s/g, '_')}_${periodo}.pdf"`);
            res.send(pdfBuffer);

        } catch (error) {
            console.error('❌ Error generando PDF de productividad:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al generar reporte PDF',
                error: error.message
            });
        }
    }

    /**
     * Generar reporte de productividad en Excel
     */
    static async generarReporteProductividadExcel(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            // Obtener datos
            const resultado = await ReportesController._obtenerDatosProductividad(
                usuarioId,
                periodo,
                userSolicitante
            );

            // Generar Excel
            const excelBuffer = await ReporteExcelService.generarProductividadPersonal(resultado.data);

            // Enviar Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Productividad_${resultado.data.usuario.nombre_completo.replace(/\s/g, '_')}_${periodo}.xlsx"`);
            res.send(excelBuffer);

        } catch (error) {
            console.error('❌ Error generando Excel de productividad:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al generar reporte Excel',
                error: error.message
            });
        }
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Calcular fechas de inicio y fin según período
 */
function calcularPeriodo(periodo) {
    const ahora = new Date();
    let fechaInicio, fechaFin;

    switch (periodo) {
        case 'hoy':
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
            fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
            break;

        case 'semana_actual':
            const diaSemana = ahora.getDay();
            const diffInicio = diaSemana === 0 ? -6 : 1 - diaSemana;
            fechaInicio = new Date(ahora);
            fechaInicio.setDate(ahora.getDate() + diffInicio);
            fechaInicio.setHours(0, 0, 0, 0);
            fechaFin = new Date(fechaInicio);
            fechaFin.setDate(fechaInicio.getDate() + 6);
            fechaFin.setHours(23, 59, 59, 999);
            break;

        case 'mes_actual':
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
            fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
            break;

        case 'mes_pasado':
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1, 0, 0, 0);
            fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59);
            break;

        case 'trimestre_actual':
            const mesInicioTrimestre = Math.floor(ahora.getMonth() / 3) * 3;
            fechaInicio = new Date(ahora.getFullYear(), mesInicioTrimestre, 1, 0, 0, 0);
            fechaFin = new Date(ahora.getFullYear(), mesInicioTrimestre + 3, 0, 23, 59, 59);
            break;

        case 'anio_actual':
            fechaInicio = new Date(ahora.getFullYear(), 0, 1, 0, 0, 0);
            fechaFin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59);
            break;

        default: // mes_actual
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
            fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
    }

    return { fechaInicio, fechaFin };
}

/**
 * Obtener descripción legible del período
 */
function obtenerDescripcionPeriodo(periodo) {
    const ahora = new Date();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    switch (periodo) {
        case 'hoy':
            return `Hoy - ${ahora.getDate()} de ${meses[ahora.getMonth()]}`;
        case 'semana_actual':
            return `Semana actual`;
        case 'mes_actual':
            return `${meses[ahora.getMonth()]} ${ahora.getFullYear()}`;
        case 'mes_pasado':
            const mesPasado = ahora.getMonth() === 0 ? 11 : ahora.getMonth() - 1;
            const anioPasado = ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();
            return `${meses[mesPasado]} ${anioPasado}`;
        case 'trimestre_actual':
            const trimestre = Math.floor(ahora.getMonth() / 3) + 1;
            return `Q${trimestre} ${ahora.getFullYear()}`;
        case 'anio_actual':
            return `Año ${ahora.getFullYear()}`;
        default:
            return periodo;
    }
}

module.exports = ReportesController;
