// ============================================
// CONTROLLER DE CALENDARIO - VISTAS
// ============================================

const { query } = require('../../../config/database');

class CalendarioController {
    /**
     * Vista semanal
     */
    static async vistaSemanal(req, res) {
        try {
            const { user_id, rol } = req.user;
            const { usuario_id, fecha_inicio } = req.query;

            // Determinar usuario objetivo
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            const usuarioObjetivo = (usuario_id && esJefe) ? usuario_id : user_id;

            // Calcular rango de semana (Lunes a Viernes)
            // Siempre calcular desde el LUNES de la semana, independiente de la hora enviada
            const fechaReferencia = fecha_inicio ? new Date(fecha_inicio) : new Date();
            const inicio = getStartOfWeek(fechaReferencia);
            inicio.setHours(0, 0, 0, 0); // Inicio del día lunes

            const fin = new Date(inicio);
            fin.setDate(fin.getDate() + 4); // +4 días (Lunes a Viernes)
            fin.setHours(23, 59, 59, 999); // Fin del día viernes

            console.log('📅 Vista semanal - Rango:', {
                usuarioObjetivo,
                fechaReferencia,
                inicio,
                fin
            });

            const result = await query(`
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE a.usuario_id = $1
                  AND a.activo = true
                  AND a.fecha_inicio_planeada >= $2
                  AND a.fecha_inicio_planeada <= $3
                ORDER BY a.fecha_inicio_planeada ASC
            `, [usuarioObjetivo, inicio, fin]);

            console.log(`📊 Vista semanal encontró ${result.rowCount} actividades`);

            res.json({
                success: true,
                vista: 'semanal',
                fecha_inicio: inicio,
                fecha_fin: fin,
                data: result.rows,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error obteniendo vista semanal:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener vista semanal',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Vista mensual
     */
    static async vistaMensual(req, res) {
        try {
            const { user_id, rol } = req.user;
            const { usuario_id, mes, anio } = req.query;

            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            const usuarioObjetivo = (usuario_id && esJefe) ? usuario_id : user_id;

            // Calcular rango del mes
            const mesActual = mes ? parseInt(mes) : new Date().getMonth() + 1;
            const anioActual = anio ? parseInt(anio) : new Date().getFullYear();

            const inicio = new Date(anioActual, mesActual - 1, 1, 0, 0, 0);
            const fin = new Date(anioActual, mesActual, 0, 23, 59, 59);

            const result = await query(`
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE a.usuario_id = $1
                  AND a.activo = true
                  AND a.fecha_inicio_planeada >= $2
                  AND a.fecha_inicio_planeada <= $3
                ORDER BY a.fecha_inicio_planeada ASC
            `, [usuarioObjetivo, inicio, fin]);

            res.json({
                success: true,
                vista: 'mensual',
                mes: mesActual,
                anio: anioActual,
                fecha_inicio: inicio,
                fecha_fin: fin,
                data: result.rows,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error obteniendo vista mensual:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener vista mensual',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Vista trimestral
     */
    static async vistaTrimestral(req, res) {
        try {
            const { user_id, rol } = req.user;
            const { usuario_id, trimestre, anio } = req.query;

            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            const usuarioObjetivo = (usuario_id && esJefe) ? usuario_id : user_id;

            // Calcular rango del trimestre
            const anioActual = anio ? parseInt(anio) : new Date().getFullYear();
            const trimestreActual = trimestre ? parseInt(trimestre) : Math.ceil((new Date().getMonth() + 1) / 3);

            const mesInicio = (trimestreActual - 1) * 3 + 1;
            const mesFin = trimestreActual * 3;

            const inicio = new Date(anioActual, mesInicio - 1, 1, 0, 0, 0);
            const fin = new Date(anioActual, mesFin, 0, 23, 59, 59);

            const result = await query(`
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE a.usuario_id = $1
                  AND a.activo = true
                  AND a.fecha_inicio_planeada >= $2
                  AND a.fecha_inicio_planeada <= $3
                ORDER BY a.fecha_inicio_planeada ASC
            `, [usuarioObjetivo, inicio, fin]);

            // Agrupar por mes
            const actividadesPorMes = result.rows.reduce((acc, actividad) => {
                const mes = new Date(actividad.fecha_inicio_planeada).getMonth() + 1;
                if (!acc[mes]) {
                    acc[mes] = [];
                }
                acc[mes].push(actividad);
                return acc;
            }, {});

            res.json({
                success: true,
                vista: 'trimestral',
                trimestre: trimestreActual,
                anio: anioActual,
                fecha_inicio: inicio,
                fecha_fin: fin,
                data: result.rows,
                agrupado_por_mes: actividadesPorMes,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error obteniendo vista trimestral:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener vista trimestral',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Vista anual
     */
    static async vistaAnual(req, res) {
        try {
            const { user_id, rol } = req.user;
            const { usuario_id, anio } = req.query;

            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            const usuarioObjetivo = (usuario_id && esJefe) ? usuario_id : user_id;

            // Calcular rango del año
            const anioActual = anio ? parseInt(anio) : new Date().getFullYear();
            const inicio = new Date(anioActual, 0, 1, 0, 0, 0);
            const fin = new Date(anioActual, 11, 31, 23, 59, 59);

            const result = await query(`
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE a.usuario_id = $1
                  AND a.activo = true
                  AND a.fecha_inicio_planeada >= $2
                  AND a.fecha_inicio_planeada <= $3
                ORDER BY a.fecha_inicio_planeada ASC
            `, [usuarioObjetivo, inicio, fin]);

            // Estadísticas por mes
            const estadisticasPorMes = {};
            for (let mes = 1; mes <= 12; mes++) {
                const actividadesMes = result.rows.filter(a => {
                    const fechaActividad = new Date(a.fecha_inicio_planeada);
                    return fechaActividad.getMonth() + 1 === mes;
                });

                estadisticasPorMes[mes] = {
                    total: actividadesMes.length,
                    completadas: actividadesMes.filter(a => a.estado === 'completada').length,
                    pendientes: actividadesMes.filter(a => a.estado === 'pendiente').length,
                    en_progreso: actividadesMes.filter(a => a.estado === 'en_progreso').length
                };
            }

            res.json({
                success: true,
                vista: 'anual',
                anio: anioActual,
                fecha_inicio: inicio,
                fecha_fin: fin,
                data: result.rows,
                estadisticas_por_mes: estadisticasPorMes,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error obteniendo vista anual:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener vista anual',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

// Función auxiliar: Obtener inicio de semana (Lunes)
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando es domingo
    return new Date(d.setDate(diff));
}

module.exports = CalendarioController;
