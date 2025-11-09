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
                    descripcion: obtenerDescripcionPeriodo(periodo, fechaInicio, fechaFin)
                }
            }
        };
    }

    /**
     * Método interno para obtener datos de categorías
     * (usado por los 3 endpoints: JSON, PDF, Excel)
     */
    static async _obtenerDatosPorCategoria(usuarioId, periodo, userSolicitante) {
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

        // Obtener datos de categorías con actividades detalladas
        const datos = await ReportesQueries.obtenerDatosPorCategoria(
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
                    descripcion: obtenerDescripcionPeriodo(periodo, fechaInicio, fechaFin)
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

    // ============================================
    // REPORTE POR CATEGORÍA
    // ============================================

    /**
     * Obtener datos para reporte por categoría (endpoint JSON)
     */
    static async obtenerDatosPorCategoria(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            const resultado = await ReportesController._obtenerDatosPorCategoria(
                usuarioId,
                periodo,
                userSolicitante
            );

            return res.json(resultado);

        } catch (error) {
            console.error('❌ Error obteniendo datos por categoría:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al obtener datos por categoría',
                error: error.message
            });
        }
    }

    /**
     * Generar reporte por categoría en PDF
     */
    static async generarReportePorCategoriaPDF(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            // Obtener datos
            const resultado = await ReportesController._obtenerDatosPorCategoria(
                usuarioId,
                periodo,
                userSolicitante
            );

            // Generar PDF
            const pdfBuffer = await ReportePDFService.generarPorCategoria(resultado.data);

            // Enviar PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Por_Categoria_${resultado.data.usuario.nombre_completo.replace(/\s/g, '_')}_${periodo}.pdf"`);
            res.send(pdfBuffer);

        } catch (error) {
            console.error('❌ Error generando PDF por categoría:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al generar reporte PDF por categoría',
                error: error.message
            });
        }
    }

    /**
     * Generar reporte por categoría en Excel
     */
    static async generarReportePorCategoriaExcel(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            // Obtener datos
            const resultado = await ReportesController._obtenerDatosPorCategoria(
                usuarioId,
                periodo,
                userSolicitante
            );

            // Generar Excel
            const excelBuffer = await ReporteExcelService.generarPorCategoria(resultado.data);

            // Enviar Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Por_Categoria_${resultado.data.usuario.nombre_completo.replace(/\s/g, '_')}_${periodo}.xlsx"`);
            res.send(excelBuffer);

        } catch (error) {
            console.error('❌ Error generando Excel por categoría:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al generar reporte Excel por categoría',
                error: error.message
            });
        }
    }

    // ============================================
    // REPORTE DE EQUIPO
    // ============================================

    /**
     * Obtener datos para reporte de equipo (endpoint JSON)
     */
    static async obtenerDatosEquipo(req, res) {
        try {
            const { periodo = 'mes_actual' } = req.query;

            // Calcular fechas según período
            const { fechaInicio, fechaFin } = calcularPeriodo(periodo);

            // Obtener datos del equipo
            const datos = await ReportesQueries.obtenerDatosEquipo(fechaInicio, fechaFin);

            return res.json({
                success: true,
                data: {
                    ...datos,
                    periodo: {
                        tipo: periodo,
                        fechaInicio,
                        fechaFin,
                        descripcion: obtenerDescripcionPeriodo(periodo, fechaInicio, fechaFin)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo datos de equipo:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al obtener datos de equipo',
                error: error.message
            });
        }
    }

    /**
     * Generar reporte de equipo en PDF
     */
    static async generarReporteEquipoPDF(req, res) {
        try {
            const { periodo = 'mes_actual' } = req.query;

            // Calcular fechas según período
            const { fechaInicio, fechaFin } = calcularPeriodo(periodo);

            // Obtener datos del equipo
            const datos = await ReportesQueries.obtenerDatosEquipo(fechaInicio, fechaFin);

            // Agregar información del período
            const datosConPeriodo = {
                ...datos,
                periodo: {
                    tipo: periodo,
                    fechaInicio,
                    fechaFin,
                    descripcion: obtenerDescripcionPeriodo(periodo, fechaInicio, fechaFin)
                }
            };

            // Generar PDF
            const pdfBuffer = await ReportePDFService.generarEquipo(datosConPeriodo);

            // Enviar PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Reporte_Equipo_${periodo}.pdf"`);
            res.send(pdfBuffer);

        } catch (error) {
            console.error('❌ Error generando PDF de equipo:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al generar reporte PDF de equipo',
                error: error.message
            });
        }
    }

    /**
     * Generar reporte de equipo en Excel
     */
    static async generarReporteEquipoExcel(req, res) {
        try {
            const { periodo = 'mes_actual' } = req.query;

            // Calcular fechas según período
            const { fechaInicio, fechaFin } = calcularPeriodo(periodo);

            // Obtener datos del equipo
            const datos = await ReportesQueries.obtenerDatosEquipo(fechaInicio, fechaFin);

            // Agregar información del período
            const datosConPeriodo = {
                ...datos,
                periodo: {
                    tipo: periodo,
                    fechaInicio,
                    fechaFin,
                    descripcion: obtenerDescripcionPeriodo(periodo, fechaInicio, fechaFin)
                }
            };

            // Generar Excel
            const excelBuffer = await ReporteExcelService.generarEquipo(datosConPeriodo);

            // Enviar Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Reporte_Equipo_${periodo}.xlsx"`);
            res.send(excelBuffer);

        } catch (error) {
            console.error('❌ Error generando Excel de equipo:', error);
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error al generar reporte Excel de equipo',
                error: error.message
            });
        }
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtener fechas de período considerando rangos personalizados
 */
function obtenerFechasPeriodo(req) {
    const { periodo = 'mes_actual', fechaInicio: fechaInicioParam, fechaFin: fechaFinParam } = req.query;

    // Si es rango personalizado, usar fechas provistas
    if (periodo === 'custom' && fechaInicioParam && fechaFinParam) {
        return {
            fechaInicio: new Date(fechaInicioParam + 'T00:00:00'),
            fechaFin: new Date(fechaFinParam + 'T23:59:59'),
            periodo
        };
    }

    // Si no, calcular según período predefinido
    const { fechaInicio, fechaFin } = calcularPeriodo(periodo);
    return { fechaInicio, fechaFin, periodo };
}

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

        default:
            // Soportar períodos dinámicos del selector avanzado
            if (periodo.startsWith('semana_')) {
                const semanaNum = parseInt(periodo.split('_')[1]);
                const primerDia = (semanaNum - 1) * 7 + 1;
                const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
                fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), primerDia, 0, 0, 0);
                fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), Math.min(primerDia + 6, ultimoDiaMes), 23, 59, 59);
            } else if (periodo.startsWith('mes_')) {
                const [_, anio, mes] = periodo.split('_');
                fechaInicio = new Date(parseInt(anio), parseInt(mes), 1, 0, 0, 0);
                fechaFin = new Date(parseInt(anio), parseInt(mes) + 1, 0, 23, 59, 59);
            } else if (periodo.startsWith('trimestre_')) {
                const [_, anio, q] = periodo.split('_');
                const mesInicio = (parseInt(q) - 1) * 3;
                fechaInicio = new Date(parseInt(anio), mesInicio, 1, 0, 0, 0);
                fechaFin = new Date(parseInt(anio), mesInicio + 3, 0, 23, 59, 59);
            } else if (periodo.startsWith('anio_')) {
                const anio = parseInt(periodo.split('_')[1]);
                fechaInicio = new Date(anio, 0, 1, 0, 0, 0);
                fechaFin = new Date(anio, 11, 31, 23, 59, 59);
            } else {
                // Default: mes actual
                fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
                fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
            }
    }

    return { fechaInicio, fechaFin };
}

/**
 * Obtener descripción legible del período
 */
function obtenerDescripcionPeriodo(periodo, fechaInicio = null, fechaFin = null) {
    const ahora = new Date();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Rango personalizado
    if (periodo === 'custom' && fechaInicio && fechaFin) {
        const inicio = typeof fechaInicio === 'string' ? new Date(fechaInicio) : fechaInicio;
        const fin = typeof fechaFin === 'string' ? new Date(fechaFin) : fechaFin;
        return `${inicio.getDate()} ${meses[inicio.getMonth()]} ${inicio.getFullYear()} - ${fin.getDate()} ${meses[fin.getMonth()]} ${fin.getFullYear()}`;
    }

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
            // Soportar períodos dinámicos
            if (periodo.startsWith('semana_')) {
                const semanaNum = parseInt(periodo.split('_')[1]);
                return `Semana ${semanaNum} de ${meses[ahora.getMonth()]}`;
            } else if (periodo.startsWith('mes_')) {
                const [_, anio, mes] = periodo.split('_');
                return `${meses[parseInt(mes)]} ${anio}`;
            } else if (periodo.startsWith('trimestre_')) {
                const [_, anio, q] = periodo.split('_');
                return `Q${q} ${anio}`;
            } else if (periodo.startsWith('anio_')) {
                const anio = periodo.split('_')[1];
                return `Año ${anio}`;
            }
            return periodo;
    }
}

module.exports = ReportesController;
