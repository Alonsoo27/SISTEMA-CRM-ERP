// ============================================
// CONTROLADOR DE REPORTES - MARKETING
// Generación de reportes corporativos en PDF y Excel
// ============================================

const { query } = require('../../../config/database');
const { GRUPOS_ROLES } = require('../../../config/roles');
const ReportePDFService = require('../services/reportePDFService');
const ReporteExcelService = require('../services/reporteExcelService');

class ReportesController {
    /**
     * Método interno para obtener datos de productividad
     * (usado por los 3 endpoints: JSON, PDF, Excel)
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

        // 1. INFORMACIÓN DEL USUARIO
        const usuarioResult = await query(`
            SELECT
                u.id,
                u.nombre || ' ' || u.apellido as nombre_completo,
                u.email,
                r.nombre as rol,
                a.nombre as area,
                u.created_at as fecha_ingreso
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            WHERE u.id = $1 AND u.activo = true
        `, [usuarioId]);

        if (usuarioResult.rows.length === 0) {
            throw {
                status: 404,
                success: false,
                message: 'Usuario no encontrado'
            };
        }

        const usuario = usuarioResult.rows[0];

            // 2. INDICADORES TOTALES
            const totalesResult = await query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE estado = 'completada') as completadas,
                    COUNT(*) FILTER (WHERE estado = 'cancelada') as canceladas,
                    COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
                    COUNT(*) FILTER (WHERE estado = 'en_progreso') as en_progreso,
                    COUNT(*) FILTER (WHERE es_prioritaria = true) as prioritarias,
                    COUNT(*) FILTER (WHERE es_prioritaria = true AND estado = 'completada') as prioritarias_completadas,
                    COUNT(*) FILTER (WHERE estado = 'no_realizada') as no_realizadas,
                    COUNT(*) FILTER (WHERE transferida_de IS NOT NULL) as transferidas
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const totales = totalesResult.rows[0];

            // 3. ANÁLISIS DE TIEMPO
            const tiemposResult = await query(`
                SELECT
                    SUM(duracion_planeada_minutos) as total_planeado,
                    SUM(duracion_real_minutos) as total_real,
                    SUM(tiempo_adicional_minutos) as total_adicional,
                    AVG(duracion_real_minutos) as promedio_real,
                    COUNT(*) FILTER (WHERE tiempo_adicional_minutos > 0) as con_extension
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND estado = 'completada'
                AND duracion_real_minutos IS NOT NULL
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const tiempos = tiemposResult.rows[0];

            // 4. DISTRIBUCIÓN POR CATEGORÍAS
            const categoriasResult = await query(`
                SELECT
                    categoria_principal,
                    subcategoria,
                    COUNT(*) as cantidad,
                    COUNT(*) FILTER (WHERE estado = 'completada') as completadas,
                    SUM(COALESCE(duracion_real_minutos, duracion_planeada_minutos)) as tiempo_total_minutos,
                    AVG(COALESCE(duracion_real_minutos, duracion_planeada_minutos)) as tiempo_promedio_minutos
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND created_at BETWEEN $2 AND $3
                GROUP BY categoria_principal, subcategoria
                ORDER BY cantidad DESC
            `, [usuarioId, fechaInicio, fechaFin]);

            // 5. ACTIVIDADES VENCIDAS Y PROBLEMAS
            const problemasResult = await query(`
                SELECT
                    COUNT(*) FILTER (WHERE estado = 'no_realizada') as vencidas,
                    COUNT(*) FILTER (WHERE transferida_de IS NOT NULL) as transferidas,
                    COUNT(*) FILTER (WHERE tiempo_adicional_minutos > 0) as extensiones
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const problemas = problemasResult.rows[0];

            // 6. ACTIVIDADES RECIENTES (Top 10 más relevantes)
            const actividadesResult = await query(`
                SELECT
                    id,
                    codigo,
                    descripcion,
                    estado,
                    es_prioritaria,
                    fecha_inicio_planeada,
                    fecha_fin_planeada,
                    duracion_planeada_minutos,
                    duracion_real_minutos,
                    categoria_principal,
                    subcategoria
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND created_at BETWEEN $2 AND $3
                ORDER BY
                    CASE WHEN estado = 'completada' THEN 1 ELSE 0 END DESC,
                    es_prioritaria DESC,
                    fecha_fin_planeada DESC
                LIMIT 10
            `, [usuarioId, fechaInicio, fechaFin]);

            // CALCULAR MÉTRICAS DERIVADAS
            const tasaCompletitud = totales.total > 0
                ? ((parseInt(totales.completadas) / parseInt(totales.total)) * 100).toFixed(1)
                : 0;

            const tasaPrioritarias = parseInt(totales.prioritarias) > 0
                ? ((parseInt(totales.prioritarias_completadas) / parseInt(totales.prioritarias)) * 100).toFixed(1)
                : 0;

            const eficiencia = tiempos.total_planeado > 0
                ? ((parseFloat(tiempos.total_real) / parseFloat(tiempos.total_planeado)) * 100).toFixed(1)
                : 0;

            const tasaVencimiento = totales.total > 0
                ? ((parseInt(problemas.vencidas) / parseInt(totales.total)) * 100).toFixed(1)
                : 0;

        // RETORNAR DATOS CONSOLIDADOS
        return {
            success: true,
            data: {
                usuario,
                periodo: {
                    tipo: periodo,
                    fechaInicio,
                    fechaFin,
                    descripcion: obtenerDescripcionPeriodo(periodo)
                },
                metricas: {
                    totales: {
                        total: parseInt(totales.total),
                        completadas: parseInt(totales.completadas),
                        canceladas: parseInt(totales.canceladas),
                        pendientes: parseInt(totales.pendientes),
                        en_progreso: parseInt(totales.en_progreso),
                        prioritarias: parseInt(totales.prioritarias),
                        prioritarias_completadas: parseInt(totales.prioritarias_completadas)
                    },
                    tasas: {
                        completitud: parseFloat(tasaCompletitud),
                        prioritarias: parseFloat(tasaPrioritarias),
                        eficiencia: parseFloat(eficiencia),
                        vencimiento: parseFloat(tasaVencimiento)
                    },
                    tiempos: {
                        total_planeado_minutos: parseInt(tiempos.total_planeado || 0),
                        total_real_minutos: parseInt(tiempos.total_real || 0),
                        promedio_real_minutos: parseFloat(tiempos.promedio_real || 0).toFixed(1),
                        total_adicional_minutos: parseInt(tiempos.total_adicional || 0),
                        con_extension: parseInt(tiempos.con_extension || 0)
                    },
                    problemas: {
                        vencidas: parseInt(problemas.vencidas),
                        transferidas: parseInt(problemas.transferidas),
                        extensiones: parseInt(problemas.extensiones)
                    }
                },
                categorias: categoriasResult.rows.map(cat => ({
                    categoria_principal: cat.categoria_principal,
                    subcategoria: cat.subcategoria,
                    cantidad: parseInt(cat.cantidad),
                    completadas: parseInt(cat.completadas),
                    tiempo_total_minutos: parseInt(cat.tiempo_total_minutos || 0),
                    tiempo_promedio_minutos: parseFloat(cat.tiempo_promedio_minutos || 0).toFixed(1),
                    porcentaje_tiempo: 0 // Se calcula después
                })),
                actividades_recientes: actividadesResult.rows
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
