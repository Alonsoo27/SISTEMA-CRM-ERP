// ============================================
// CONTROLLER DE INDICADORES - MARKETING
// Métricas y análisis de rendimiento
// ============================================

const { query } = require('../../../config/database');
const { GRUPOS_ROLES } = require('../../../config/roles');

class IndicadoresController {
    /**
     * Obtener indicadores de rendimiento individual
     */
    static async obtenerIndicadoresIndividual(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            // Validar que solo puede ver sus propios datos (excepto jefes y ejecutivos)
            if (parseInt(usuarioId) !== userSolicitante.id &&
                !GRUPOS_ROLES.JEFES_Y_EJECUTIVOS.includes(userSolicitante.rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver indicadores de otro usuario'
                });
            }

            // Calcular rango de fechas según período
            const { fechaInicio, fechaFin } = calcularRangoFechas(periodo);

            // Total de actividades por estado
            const estadosResult = await query(`
                SELECT
                    estado,
                    COUNT(*) as total
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND created_at BETWEEN $2 AND $3
                GROUP BY estado
            `, [usuarioId, fechaInicio, fechaFin]);

            // Calcular totales
            const totales = {
                total: 0,
                completadas: 0,
                pendientes: 0,
                en_progreso: 0,
                canceladas: 0,
                pausadas: 0,
                no_realizada: 0
            };

            estadosResult.rows.forEach(row => {
                const total = parseInt(row.total);
                totales.total += total;

                // Normalizar nombres de estados (algunos estados están en singular en la BD)
                const estadoKey = row.estado === 'completada' ? 'completadas' :
                                 row.estado === 'pendiente' ? 'pendientes' :
                                 row.estado === 'cancelada' ? 'canceladas' :
                                 row.estado === 'pausada' ? 'pausadas' :
                                 row.estado === 'no_realizada' ? 'no_realizada' :
                                 row.estado;

                totales[estadoKey] = total;
            });

            // Tasa de completitud
            const tasaCompletitud = totales.total > 0
                ? ((totales.completadas / totales.total) * 100).toFixed(1)
                : 0;

            // Actividades prioritarias completadas
            const prioritariasResult = await query(`
                SELECT COUNT(*) as total
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND es_prioritaria = true
                AND estado = 'completada'
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const prioritariasCompletadas = parseInt(prioritariasResult.rows[0]?.total || 0);

            // Tiempo promedio de ejecución (solo completadas)
            const tiempoPromedioResult = await query(`
                SELECT
                    AVG(duracion_real_minutos) as promedio_real,
                    AVG(duracion_planeada_minutos) as promedio_planeado
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND estado = 'completada'
                AND duracion_real_minutos IS NOT NULL
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const tiempoPromedio = {
                real: parseFloat(tiempoPromedioResult.rows[0]?.promedio_real || 0).toFixed(0),
                planeado: parseFloat(tiempoPromedioResult.rows[0]?.promedio_planeado || 0).toFixed(0)
            };

            // Extensiones de tiempo solicitadas
            const extensionesResult = await query(`
                SELECT COUNT(*) as total
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND tiempo_adicional_minutos > 0
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const extensiones = parseInt(extensionesResult.rows[0]?.total || 0);

            // Actividades vencidas (crítico)
            const vencidasResult = await query(`
                SELECT COUNT(*) as total
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND fue_vencida = true
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const actividadesVencidas = parseInt(vencidasResult.rows[0]?.total || 0);

            // Actividades transferidas (indica carga desbalanceada)
            const transferidasResult = await query(`
                SELECT COUNT(*) as total
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND transferida_de IS NOT NULL
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const actividadesTransferidas = parseInt(transferidasResult.rows[0]?.total || 0);

            // Tasa de vencimiento (%)
            const tasaVencimiento = totales.total > 0
                ? ((actividadesVencidas / totales.total) * 100).toFixed(1)
                : 0;

            res.json({
                success: true,
                data: {
                    periodo,
                    fechaInicio,
                    fechaFin,
                    totales,
                    tasaCompletitud: parseFloat(tasaCompletitud),
                    prioritariasCompletadas,
                    tiempoPromedio,
                    extensiones,
                    actividadesVencidas,
                    actividadesTransferidas,
                    tasaVencimiento: parseFloat(tasaVencimiento)
                }
            });

        } catch (error) {
            console.error('Error obteniendo indicadores individuales:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener indicadores individuales',
                error: error.message
            });
        }
    }

    /**
     * Obtener análisis de tiempo (real vs planeado)
     */
    static async obtenerAnalisisTiempo(req, res) {
        try {
            const { usuarioId } = req.params;
            const { periodo = 'mes_actual' } = req.query;
            const userSolicitante = req.user;

            // Validar que solo puede ver sus propios datos (excepto jefes y ejecutivos)
            if (parseInt(usuarioId) !== userSolicitante.id &&
                !GRUPOS_ROLES.JEFES_Y_EJECUTIVOS.includes(userSolicitante.rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver indicadores de otro usuario'
                });
            }

            const { fechaInicio, fechaFin } = calcularRangoFechas(periodo);

            // Tiempo total planeado vs real (solo actividades completadas)
            const tiemposResult = await query(`
                SELECT
                    SUM(duracion_planeada_minutos) as total_planeado,
                    SUM(duracion_real_minutos) as total_real,
                    SUM(tiempo_adicional_minutos) as total_adicional
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND estado = 'completada'
                AND duracion_real_minutos IS NOT NULL
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const totalPlaneado = parseInt(tiemposResult.rows[0]?.total_planeado || 0);
            const totalReal = parseInt(tiemposResult.rows[0]?.total_real || 0);
            const totalAdicional = parseInt(tiemposResult.rows[0]?.total_adicional || 0);

            // Calcular eficiencia (% de cumplimiento del tiempo planeado)
            // Eficiencia = (Tiempo Planeado / Tiempo Real) * 100
            // 100% = perfecto, >100% = más rápido de lo esperado, <100% = más lento
            const eficiencia = totalReal > 0
                ? ((totalPlaneado / totalReal) * 100).toFixed(1)
                : 100;

            // Actividades que excedieron tiempo planeado
            const excedidasResult = await query(`
                SELECT COUNT(*) as total
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND estado = 'completada'
                AND duracion_real_minutos > duracion_planeada_minutos
                AND created_at BETWEEN $2 AND $3
            `, [usuarioId, fechaInicio, fechaFin]);

            const actividadesExcedidas = parseInt(excedidasResult.rows[0]?.total || 0);

            // Convertir minutos a horas para mejor visualización
            const convertirAHoras = (minutos) => (minutos / 60).toFixed(1);

            res.json({
                success: true,
                data: {
                    periodo,
                    fechaInicio,
                    fechaFin,
                    tiempos: {
                        totalPlaneado,
                        totalReal,
                        totalAdicional,
                        totalPlaneadoHoras: convertirAHoras(totalPlaneado),
                        totalRealHoras: convertirAHoras(totalReal),
                        totalAdicionalHoras: convertirAHoras(totalAdicional)
                    },
                    eficiencia: parseFloat(eficiencia),
                    actividadesExcedidas
                }
            });

        } catch (error) {
            console.error('Error obteniendo análisis de tiempo:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener análisis de tiempo',
                error: error.message
            });
        }
    }

    /**
     * Obtener indicadores del equipo
     */
    static async obtenerIndicadoresEquipo(req, res) {
        try {
            const { periodo = 'mes_actual' } = req.query;
            const { fechaInicio, fechaFin } = calcularRangoFechas(periodo);

            // Ranking de usuarios por actividades completadas
            const rankingResult = await query(`
                SELECT
                    u.id,
                    u.nombre || ' ' || u.apellido as nombre_completo,
                    COUNT(*) as total_actividades,
                    SUM(CASE WHEN am.estado = 'completada' THEN 1 ELSE 0 END) as completadas,
                    SUM(CASE WHEN am.estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN am.estado = 'en_progreso' THEN 1 ELSE 0 END) as en_progreso,
                    AVG(CASE
                        WHEN am.duracion_real_minutos IS NOT NULL AND am.estado = 'completada'
                        THEN am.duracion_real_minutos::float / NULLIF(am.duracion_planeada_minutos, 0)
                        ELSE NULL
                    END) * 100 as eficiencia_promedio
                FROM usuarios u
                INNER JOIN actividades_marketing am ON u.id = am.usuario_id
                WHERE am.activo = true
                AND am.created_at BETWEEN $1 AND $2
                AND u.deleted_at IS NULL
                AND u.activo = true
                GROUP BY u.id, u.nombre, u.apellido
                ORDER BY completadas DESC, total_actividades DESC
                LIMIT 10
            `, [fechaInicio, fechaFin]);

            // Estadísticas globales del equipo
            const globalesResult = await query(`
                SELECT
                    COUNT(DISTINCT usuario_id) as miembros_activos,
                    COUNT(*) as total_actividades,
                    SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as total_completadas,
                    SUM(CASE WHEN es_grupal THEN 1 ELSE 0 END) as actividades_grupales,
                    SUM(tiempo_adicional_minutos) as total_extensiones
                FROM actividades_marketing
                WHERE activo = true
                AND created_at BETWEEN $1 AND $2
            `, [fechaInicio, fechaFin]);

            const globales = globalesResult.rows[0];

            res.json({
                success: true,
                data: {
                    periodo,
                    fechaInicio,
                    fechaFin,
                    ranking: rankingResult.rows.map(r => ({
                        ...r,
                        eficiencia_promedio: r.eficiencia_promedio
                            ? parseFloat(r.eficiencia_promedio).toFixed(1)
                            : 'N/A'
                    })),
                    globales: {
                        miembrosActivos: parseInt(globales.miembros_activos || 0),
                        totalActividades: parseInt(globales.total_actividades || 0),
                        totalCompletadas: parseInt(globales.total_completadas || 0),
                        actividadesGrupales: parseInt(globales.actividades_grupales || 0),
                        totalExtensiones: parseInt(globales.total_extensiones || 0)
                    }
                }
            });

        } catch (error) {
            console.error('Error obteniendo indicadores de equipo:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener indicadores de equipo',
                error: error.message
            });
        }
    }

    /**
     * Obtener análisis por categoría
     */
    static async obtenerAnalisisCategorias(req, res) {
        try {
            const { periodo = 'mes_actual', usuarioId } = req.query;
            const { fechaInicio, fechaFin } = calcularRangoFechas(periodo);

            // Construir query base
            let queryBase = `
                SELECT
                    categoria_principal,
                    COUNT(*) as total_actividades,
                    SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as completadas,
                    SUM(COALESCE(duracion_real_minutos, duracion_planeada_minutos)) as minutos_totales,
                    AVG(COALESCE(duracion_real_minutos, duracion_planeada_minutos)) as duracion_promedio,
                    SUM(CASE WHEN tiempo_adicional_minutos > 0 THEN 1 ELSE 0 END) as con_extensiones
                FROM actividades_marketing
                WHERE activo = true
                AND created_at BETWEEN $1 AND $2
            `;

            const params = [fechaInicio, fechaFin];

            // Si se especifica usuario, filtrar por él
            if (usuarioId) {
                queryBase += ` AND usuario_id = $3`;
                params.push(usuarioId);
            }

            queryBase += `
                GROUP BY categoria_principal
                ORDER BY total_actividades DESC
            `;

            const result = await query(queryBase, params);

            // Calcular tasa de éxito por categoría
            const categorias = result.rows.map(row => ({
                categoria: row.categoria_principal,
                totalActividades: parseInt(row.total_actividades),
                completadas: parseInt(row.completadas),
                tasaExito: row.total_actividades > 0
                    ? ((row.completadas / row.total_actividades) * 100).toFixed(1)
                    : 0,
                minutosTotales: parseInt(row.minutos_totales),
                horasTotales: (parseInt(row.minutos_totales) / 60).toFixed(1),
                duracionPromedio: parseFloat(row.duracion_promedio || 0).toFixed(0),
                conExtensiones: parseInt(row.con_extensiones || 0)
            }));

            res.json({
                success: true,
                data: {
                    periodo,
                    fechaInicio,
                    fechaFin,
                    usuarioId: usuarioId || 'todos',
                    categorias
                }
            });

        } catch (error) {
            console.error('Error obteniendo análisis de categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener análisis de categorías',
                error: error.message
            });
        }
    }
}

// ============================================
// FUNCIÓN HELPER: Calcular rango de fechas
// ============================================
function calcularRangoFechas(periodo) {
    const ahora = new Date();
    let fechaInicio, fechaFin;

    switch (periodo) {
        case 'semana_actual':
            const inicioDeSemana = new Date(ahora);
            const diaSemana = ahora.getDay();
            const diff = ahora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
            inicioDeSemana.setDate(diff);
            inicioDeSemana.setHours(0, 0, 0, 0);

            fechaInicio = inicioDeSemana;
            fechaFin = new Date(ahora);
            fechaFin.setHours(23, 59, 59, 999);
            break;

        case 'mes_actual':
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
            break;

        case 'trimestre_actual':
            const trimestreActual = Math.floor(ahora.getMonth() / 3);
            fechaInicio = new Date(ahora.getFullYear(), trimestreActual * 3, 1);
            fechaFin = new Date(ahora.getFullYear(), (trimestreActual + 1) * 3, 0, 23, 59, 59, 999);
            break;

        case 'anio_actual':
            fechaInicio = new Date(ahora.getFullYear(), 0, 1);
            fechaFin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;

        default:
            // Por defecto, mes actual
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { fechaInicio, fechaFin };
}

module.exports = IndicadoresController;
