// ============================================
// ACTIVIDAD DIARIA SERVICE - LÓGICA DE NEGOCIO EMPRESARIAL
// Servicios avanzados para gestión de actividad y métricas
// ============================================

const { query } = require('../../../config/database');

// ============================================
// LOGGING EMPRESARIAL
// ============================================
const logService = (methodName, context = {}) => {
    console.log(`\n🔧 SERVICE: ${methodName}`);
    console.log('Context:', context);
    console.log('Timestamp:', new Date().toISOString());
    console.log('================================\n');
};

// ============================================
// SERVICIOS DE ACTIVIDAD DIARIA
// ============================================

/**
 * Obtener estado completo de actividad para un usuario específico
 * @param {number} userId - ID del usuario
 * @param {string} fecha - Fecha específica (opcional, default hoy)
 * @returns {Object} Estado completo de la actividad
 */
exports.getActividadCompleta = async (userId, fecha = null) => {
    try {
        logService('getActividadCompleta', { userId, fecha });

        const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

        const actividadQuery = `
            SELECT 
                ad.*,
                u.nombre,
                u.apellido,
                r.nombre as rol_nombre,
                a.nombre as area_nombre,
                
                -- Métricas calculadas avanzadas
                CASE 
                    WHEN ad.jornada_horas >= 8 THEN 'completa'
                    WHEN ad.jornada_horas >= 6 THEN 'parcial'
                    WHEN ad.jornada_horas > 0 THEN 'incompleta'
                    ELSE 'sin_datos'
                END as tipo_jornada,
                
                CASE 
                    WHEN ad.total_mensajes_recibidos + ad.total_llamadas > 50 THEN 'alta'
                    WHEN ad.total_mensajes_recibidos + ad.total_llamadas > 20 THEN 'media'
                    WHEN ad.total_mensajes_recibidos + ad.total_llamadas > 0 THEN 'baja'
                    ELSE 'sin_actividad'
                END as productividad,
                
                -- Análisis de puntualidad
                CASE 
                    WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 8 THEN 'muy_puntual'
                    WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 10 THEN 'puntual'
                    WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 12 THEN 'aceptable'
                    ELSE 'tardio'
                END as nivel_puntualidad,
                
                -- Eficiencia comunicacional
                CASE 
                    WHEN ad.total_llamadas > 0 AND ad.total_mensajes_recibidos > 0 
                    THEN ROUND((ad.total_llamadas::DECIMAL / ad.total_mensajes_recibidos) * 100, 2)
                    ELSE 0
                END as ratio_llamadas_mensajes

            FROM actividad_diaria ad
            JOIN usuarios u ON ad.usuario_id = u.id
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            WHERE ad.usuario_id = $1 AND ad.fecha = $2
        `;

        const result = await query(actividadQuery, [userId, fechaConsulta]);

        if (result.rows.length === 0) {
            return {
                success: true,
                data: null,
                message: 'No hay actividad registrada para esta fecha'
            };
        }

        const actividad = result.rows[0];

        // Formatear respuesta empresarial
        return {
            success: true,
            data: {
                ...actividad,
                jornada_horas: parseFloat(actividad.jornada_horas || 0),
                analisis_empresarial: {
                    tipo_jornada: actividad.tipo_jornada,
                    productividad: actividad.productividad,
                    nivel_puntualidad: actividad.nivel_puntualidad,
                    ratio_llamadas_mensajes: parseFloat(actividad.ratio_llamadas_mensajes || 0),
                    recomendaciones: await generarRecomendaciones(actividad)
                }
            }
        };

    } catch (error) {
        console.error('Error en getActividadCompleta:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Calcular métricas empresariales de un período
 * @param {number} userId - ID del usuario
 * @param {string} fechaInicio - Fecha de inicio
 * @param {string} fechaFin - Fecha de fin
 * @returns {Object} Métricas empresariales calculadas
 */
exports.calcularMetricasEmpresariales = async (userId, fechaInicio, fechaFin) => {
    try {
        logService('calcularMetricasEmpresariales', { userId, fechaInicio, fechaFin });

        const metricas = await Promise.all([
            // Métricas generales
            query(`
                SELECT 
                    COUNT(*) as dias_trabajados,
                    COUNT(CASE WHEN estado_jornada = 'finalizada' THEN 1 END) as dias_completos,
                    AVG(jornada_horas) as promedio_horas,
                    SUM(total_mensajes_recibidos) as total_mensajes,
                    SUM(total_llamadas) as total_llamadas,
                    AVG(total_mensajes_recibidos + total_llamadas) as promedio_actividad_diaria,
                    
                    -- Puntualidad
                    COUNT(CASE WHEN EXTRACT(HOUR FROM check_in_time) <= 8 THEN 1 END) as dias_muy_puntuales,
                    COUNT(CASE WHEN EXTRACT(HOUR FROM check_in_time) BETWEEN 8 AND 10 THEN 1 END) as dias_puntuales,
                    COUNT(CASE WHEN EXTRACT(HOUR FROM check_in_time) > 12 THEN 1 END) as dias_tardios,
                    
                    -- Productividad
                    COUNT(CASE WHEN (total_mensajes_recibidos + total_llamadas) > 50 THEN 1 END) as dias_alta_productividad,
                    COUNT(CASE WHEN (total_mensajes_recibidos + total_llamadas) BETWEEN 21 AND 50 THEN 1 END) as dias_media_productividad,
                    COUNT(CASE WHEN (total_mensajes_recibidos + total_llamadas) BETWEEN 1 AND 20 THEN 1 END) as dias_baja_productividad
                    
                FROM actividad_diaria 
                WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
            `, [userId, fechaInicio, fechaFin]),

            // Distribución por canal de mensajes
            query(`
                SELECT 
                    AVG(mensajes_meta) as promedio_meta,
                    AVG(mensajes_whatsapp) as promedio_whatsapp,
                    AVG(mensajes_instagram) as promedio_instagram,
                    AVG(mensajes_tiktok) as promedio_tiktok,
                    SUM(mensajes_meta) as total_meta,
                    SUM(mensajes_whatsapp) as total_whatsapp,
                    SUM(mensajes_instagram) as total_instagram,
                    SUM(mensajes_tiktok) as total_tiktok
                FROM actividad_diaria 
                WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
            `, [userId, fechaInicio, fechaFin]),

            // Tendencias por día de la semana
            query(`
                SELECT 
                    EXTRACT(DOW FROM fecha) as dia_semana,
                    COUNT(*) as frecuencia,
                    AVG(jornada_horas) as promedio_horas,
                    AVG(total_mensajes_recibidos + total_llamadas) as promedio_actividad
                FROM actividad_diaria 
                WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
                GROUP BY EXTRACT(DOW FROM fecha)
                ORDER BY dia_semana
            `, [userId, fechaInicio, fechaFin])
        ]);

        const general = metricas[0].rows[0] || {};
        const canales = metricas[1].rows[0] || {};
        const tendencias = metricas[2].rows || [];

        // Calcular KPIs empresariales
        const diasTrabajados = parseInt(general.dias_trabajados || 0);
        const tasaFinalizacion = diasTrabajados > 0 ? 
            ((parseInt(general.dias_completos || 0) / diasTrabajados) * 100).toFixed(2) : 0;
        const tasaPuntualidad = diasTrabajados > 0 ? 
            (((parseInt(general.dias_muy_puntuales || 0) + parseInt(general.dias_puntuales || 0)) / diasTrabajados) * 100).toFixed(2) : 0;
        const tasaProductividadAlta = diasTrabajados > 0 ? 
            ((parseInt(general.dias_alta_productividad || 0) / diasTrabajados) * 100).toFixed(2) : 0;

        // Clasificación empresarial
        const clasificacion = calcularClasificacionEmpresarial(tasaFinalizacion, tasaPuntualidad, tasaProductividadAlta);

        return {
            success: true,
            data: {
                periodo: {
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin,
                    dias_analizados: diasTrabajados
                },
                kpis_principales: {
                    tasa_finalizacion: parseFloat(tasaFinalizacion),
                    tasa_puntualidad: parseFloat(tasaPuntualidad),
                    tasa_productividad_alta: parseFloat(tasaProductividadAlta),
                    promedio_horas_diarias: parseFloat(general.promedio_horas || 0),
                    promedio_actividad_diaria: parseFloat(general.promedio_actividad_diaria || 0)
                },
                distribucion_actividad: {
                    total_mensajes: parseInt(general.total_mensajes || 0),
                    total_llamadas: parseInt(general.total_llamadas || 0),
                    canales_mensajes: {
                        meta: {
                            total: parseInt(canales.total_meta || 0),
                            promedio: parseFloat(canales.promedio_meta || 0)
                        },
                        whatsapp: {
                            total: parseInt(canales.total_whatsapp || 0),
                            promedio: parseFloat(canales.promedio_whatsapp || 0)
                        },
                        instagram: {
                            total: parseInt(canales.total_instagram || 0),
                            promedio: parseFloat(canales.promedio_instagram || 0)
                        },
                        tiktok: {
                            total: parseInt(canales.total_tiktok || 0),
                            promedio: parseFloat(canales.promedio_tiktok || 0)
                        }
                    }
                },
                tendencias_semanales: tendencias.map(dia => ({
                    dia_semana: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][parseInt(dia.dia_semana)],
                    frecuencia: parseInt(dia.frecuencia),
                    promedio_horas: parseFloat(dia.promedio_horas || 0),
                    promedio_actividad: parseFloat(dia.promedio_actividad || 0)
                })),
                clasificacion_empresarial: clasificacion,
                recomendaciones_estrategicas: await generarRecomendacionesEstrategicas(general, canales, clasificacion)
            }
        };

    } catch (error) {
        console.error('Error en calcularMetricasEmpresariales:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener dashboard comparativo de equipo (para jefes/supervisores)
 * @param {Array} userIds - Array de IDs de usuarios del equipo
 * @param {string} fechaInicio - Fecha de inicio
 * @param {string} fechaFin - Fecha de fin
 * @returns {Object} Dashboard comparativo del equipo
 */
exports.getDashboardEquipo = async (userIds, fechaInicio, fechaFin) => {
    try {
        logService('getDashboardEquipo', { userIds, fechaInicio, fechaFin });

        const equipoQuery = `
            SELECT 
                u.id,
                u.nombre,
                u.apellido,
                r.nombre as rol_nombre,
                
                -- Métricas de asistencia
                COUNT(ad.id) as dias_trabajados,
                COUNT(CASE WHEN ad.estado_jornada = 'finalizada' THEN 1 END) as dias_completos,
                AVG(ad.jornada_horas) as promedio_horas,
                
                -- Métricas de actividad
                SUM(ad.total_mensajes_recibidos) as total_mensajes,
                SUM(ad.total_llamadas) as total_llamadas,
                AVG(ad.total_mensajes_recibidos + ad.total_llamadas) as promedio_actividad,
                
                -- Métricas de puntualidad
                COUNT(CASE WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 8 THEN 1 END) as dias_muy_puntuales,
                COUNT(CASE WHEN EXTRACT(HOUR FROM ad.check_in_time) BETWEEN 8 AND 10 THEN 1 END) as dias_puntuales,
                COUNT(CASE WHEN EXTRACT(HOUR FROM ad.check_in_time) > 12 THEN 1 END) as dias_tardios,
                
                -- Ranking de productividad
                RANK() OVER (ORDER BY AVG(ad.total_mensajes_recibidos + ad.total_llamadas) DESC) as ranking_productividad,
                RANK() OVER (ORDER BY AVG(ad.jornada_horas) DESC) as ranking_horas,
                RANK() OVER (ORDER BY COUNT(CASE WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 10 THEN 1 END) DESC) as ranking_puntualidad

            FROM usuarios u
            LEFT JOIN actividad_diaria ad ON u.id = ad.usuario_id 
                AND ad.fecha BETWEEN $2 AND $3
            LEFT JOIN roles r ON u.rol_id = r.id
            WHERE u.id = ANY($1) AND u.activo = true
            GROUP BY u.id, u.nombre, u.apellido, r.nombre
            ORDER BY promedio_actividad DESC, promedio_horas DESC
        `;

        const result = await query(equipoQuery, [userIds, fechaInicio, fechaFin]);

        const equipoData = result.rows.map(miembro => {
            const diasTrabajados = parseInt(miembro.dias_trabajados || 0);
            const tasaFinalizacion = diasTrabajados > 0 ? 
                ((parseInt(miembro.dias_completos || 0) / diasTrabajados) * 100).toFixed(2) : 0;
            const tasaPuntualidad = diasTrabajados > 0 ? 
                (((parseInt(miembro.dias_muy_puntuales || 0) + parseInt(miembro.dias_puntuales || 0)) / diasTrabajados) * 100).toFixed(2) : 0;

            return {
                usuario: {
                    id: miembro.id,
                    nombre_completo: `${miembro.nombre} ${miembro.apellido || ''}`.trim(),
                    rol: miembro.rol_nombre
                },
                metricas: {
                    dias_trabajados: diasTrabajados,
                    tasa_finalizacion: parseFloat(tasaFinalizacion),
                    promedio_horas: parseFloat(miembro.promedio_horas || 0),
                    total_mensajes: parseInt(miembro.total_mensajes || 0),
                    total_llamadas: parseInt(miembro.total_llamadas || 0),
                    promedio_actividad: parseFloat(miembro.promedio_actividad || 0),
                    tasa_puntualidad: parseFloat(tasaPuntualidad)
                },
                rankings: {
                    productividad: parseInt(miembro.ranking_productividad || 0),
                    horas: parseInt(miembro.ranking_horas || 0),
                    puntualidad: parseInt(miembro.ranking_puntualidad || 0)
                },
                clasificacion: calcularClasificacionMiembro(tasaFinalizacion, tasaPuntualidad, miembro.promedio_actividad)
            };
        });

        // Calcular métricas del equipo completo
        const metricas_equipo = {
            total_miembros: equipoData.length,
            promedio_dias_trabajados: equipoData.reduce((sum, m) => sum + m.metricas.dias_trabajados, 0) / equipoData.length,
            promedio_productividad: equipoData.reduce((sum, m) => sum + m.metricas.promedio_actividad, 0) / equipoData.length,
            promedio_puntualidad: equipoData.reduce((sum, m) => sum + m.metricas.tasa_puntualidad, 0) / equipoData.length,
            miembros_alta_performance: equipoData.filter(m => m.clasificacion === 'Excelente' || m.clasificacion === 'Muy Bueno').length
        };

        return {
            success: true,
            data: {
                periodo: {
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin
                },
                metricas_equipo: metricas_equipo,
                miembros: equipoData,
                insights_gerenciales: generarInsightsGerenciales(equipoData, metricas_equipo)
            }
        };

    } catch (error) {
        console.error('Error en getDashboardEquipo:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Validar disponibilidad para check-in
 * @param {number} userId - ID del usuario
 * @returns {Object} Estado de disponibilidad
 */
exports.validarDisponibilidadCheckIn = async (userId) => {
    try {
        const fechaHoy = new Date().toISOString().split('T')[0];
        const horaActual = new Date().getHours();

        // Verificar registro existente
        const registroResult = await query(
            'SELECT check_in_time, estado_jornada FROM actividad_diaria WHERE usuario_id = $1 AND fecha = $2',
            [userId, fechaHoy]
        );

        const validaciones = {
            puede_checkin: true,
            razones: [],
            recomendaciones: []
        };

        // Validar horario
        if (horaActual < 8) {
            validaciones.puede_checkin = false;
            validaciones.razones.push('Muy temprano para check-in');
            validaciones.recomendaciones.push('Puedes hacer check-in a partir de las 8:00 AM');
        } else if (horaActual > 14) {
            validaciones.puede_checkin = false;
            validaciones.razones.push('Muy tarde para check-in');
            validaciones.recomendaciones.push('El check-in debe realizarse antes de las 2:00 PM');
        }

        // Validar si ya hizo check-in
        if (registroResult.rows.length > 0 && registroResult.rows[0].check_in_time) {
            validaciones.puede_checkin = false;
            validaciones.razones.push('Ya realizaste check-in hoy');
            validaciones.recomendaciones.push('Puedes proceder con tus actividades diarias');
        }

        return {
            success: true,
            data: {
                fecha: fechaHoy,
                hora_actual: new Date().toLocaleTimeString('es-PE'),
                validaciones: validaciones,
                horario_permitido: '8:00 AM - 2:00 PM'
            }
        };

    } catch (error) {
        console.error('Error en validarDisponibilidadCheckIn:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Validar disponibilidad para check-out
 * @param {number} userId - ID del usuario
 * @returns {Object} Estado de disponibilidad
 */
exports.validarDisponibilidadCheckOut = async (userId) => {
    try {
        const fechaHoy = new Date().toISOString().split('T')[0];
        const horaActual = new Date().getHours();

        // Verificar registro existente
        const registroResult = await query(
            'SELECT check_in_time, check_out_time, estado_jornada FROM actividad_diaria WHERE usuario_id = $1 AND fecha = $2',
            [userId, fechaHoy]
        );

        const validaciones = {
            puede_checkout: true,
            razones: [],
            recomendaciones: []
        };

        // Validar que existe check-in
        if (registroResult.rows.length === 0 || !registroResult.rows[0].check_in_time) {
            validaciones.puede_checkout = false;
            validaciones.razones.push('No has realizado check-in hoy');
            validaciones.recomendaciones.push('Debes hacer check-in antes del check-out');
            
            return {
                success: true,
                data: {
                    fecha: fechaHoy,
                    hora_actual: new Date().toLocaleTimeString('es-PE'),
                    validaciones: validaciones
                }
            };
        }

        const registro = registroResult.rows[0];

        // Validar si ya hizo check-out
        if (registro.check_out_time) {
            validaciones.puede_checkout = false;
            validaciones.razones.push('Ya realizaste check-out hoy');
            validaciones.recomendaciones.push('Tu jornada ya está finalizada');
        }

        // Validar horario (más flexible para check-out)
        if (horaActual < 16) {
            validaciones.recomendaciones.push('Es temprano para check-out, pero se permite');
        }

        return {
            success: true,
            data: {
                fecha: fechaHoy,
                hora_actual: new Date().toLocaleTimeString('es-PE'),
                validaciones: validaciones,
                horario_recomendado: '4:00 PM - 10:00 PM',
                check_in_realizado: registro.check_in_time
            }
        };

    } catch (error) {
        console.error('Error en validarDisponibilidadCheckOut:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ============================================
// NUEVAS FUNCIONES INTEGRADAS
// ============================================

/**
 * Obtener historial de actividad de un usuario con paginación y filtros
 * @param {number} userId - ID del usuario
 * @param {Object} filtros - Filtros de búsqueda
 * @param {string} filtros.fechaInicio - Fecha de inicio (opcional)
 * @param {string} filtros.fechaFin - Fecha de fin (opcional)
 * @param {number} filtros.limite - Número de registros por página (default: 30)
 * @param {number} filtros.offset - Desplazamiento para paginación (default: 0)
 * @param {string} filtros.ordenPor - Campo para ordenar (fecha, jornada_horas, total_actividad)
 * @param {string} filtros.direccion - Dirección del orden (ASC, DESC)
 * @returns {Object} Historial paginado con métricas de resumen
 */
exports.obtenerHistorialUsuario = async (userId, filtros = {}) => {
    try {
        logService('obtenerHistorialUsuario', { userId, filtros });

        // Parámetros por defecto
        const {
            fechaInicio = null,
            fechaFin = null,
            limite = 30,
            offset = 0,
            ordenPor = 'fecha',
            direccion = 'DESC'
        } = filtros;

        // Construir condiciones WHERE dinámicas
        let whereConditions = ['ad.usuario_id = $1'];
        let queryParams = [userId];
        let paramIndex = 2;

        if (fechaInicio) {
            whereConditions.push(`ad.fecha >= $${paramIndex}`);
            queryParams.push(fechaInicio);
            paramIndex++;
        }

        if (fechaFin) {
            whereConditions.push(`ad.fecha <= $${paramIndex}`);
            queryParams.push(fechaFin);
            paramIndex++;
        }

        // Validar campos de ordenamiento permitidos
        const camposPermitidos = ['fecha', 'jornada_horas', 'total_mensajes_recibidos', 'total_llamadas'];
        const campoOrden = camposPermitidos.includes(ordenPor) ? ordenPor : 'fecha';
        const direccionOrden = ['ASC', 'DESC'].includes(direccion.toUpperCase()) ? direccion.toUpperCase() : 'DESC';

        // Query principal para obtener registros
        const historialQuery = `
            SELECT 
                ad.*,
                u.nombre,
                u.apellido,
                
                -- Calcular total de actividad
                (ad.total_mensajes_recibidos + ad.total_llamadas) as total_actividad,
                
                -- Análisis de productividad del día
                CASE 
                    WHEN (ad.total_mensajes_recibidos + ad.total_llamadas) > 50 THEN 'Alta'
                    WHEN (ad.total_mensajes_recibidos + ad.total_llamadas) > 20 THEN 'Media'
                    WHEN (ad.total_mensajes_recibidos + ad.total_llamadas) > 0 THEN 'Baja'
                    ELSE 'Sin actividad'
                END as nivel_productividad,
                
                -- Análisis de puntualidad
                CASE 
                    WHEN ad.check_in_time IS NULL THEN 'Sin check-in'
                    WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 8 THEN 'Muy puntual'
                    WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 10 THEN 'Puntual'
                    WHEN EXTRACT(HOUR FROM ad.check_in_time) <= 12 THEN 'Aceptable'
                    ELSE 'Tardío'
                END as nivel_puntualidad,
                
                -- Estado de finalización
                CASE 
                    WHEN ad.estado_jornada = 'finalizada' THEN 'Completa'
                    WHEN ad.check_in_time IS NOT NULL AND ad.check_out_time IS NULL THEN 'En progreso'
                    WHEN ad.check_in_time IS NULL THEN 'No iniciada'
                    ELSE ad.estado_jornada
                END as estado_jornada_legible,
                
                -- Distribución de canales (porcentajes)
                CASE 
                    WHEN ad.total_mensajes_recibidos > 0 THEN
                        ROUND((ad.mensajes_whatsapp::DECIMAL / ad.total_mensajes_recibidos) * 100, 1)
                    ELSE 0
                END as porcentaje_whatsapp,
                
                CASE 
                    WHEN ad.total_mensajes_recibidos > 0 THEN
                        ROUND((ad.mensajes_meta::DECIMAL / ad.total_mensajes_recibidos) * 100, 1)
                    ELSE 0
                END as porcentaje_meta,
                
                -- Día de la semana
                TO_CHAR(ad.fecha, 'Day') as dia_semana,
                TO_CHAR(ad.fecha, 'DD/MM/YYYY') as fecha_formateada

            FROM actividad_diaria ad
            JOIN usuarios u ON ad.usuario_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ad.${campoOrden} ${direccionOrden}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        queryParams.push(limite, offset);

        // Query para contar total de registros
        const countQuery = `
            SELECT COUNT(*) as total
            FROM actividad_diaria ad
            WHERE ${whereConditions.join(' AND ')}
        `;

        // Query para métricas de resumen del período
        const resumenQuery = `
            SELECT 
                COUNT(*) as total_dias_registrados,
                COUNT(CASE WHEN estado_jornada = 'finalizada' THEN 1 END) as dias_completos,
                AVG(jornada_horas) as promedio_horas_diarias,
                SUM(total_mensajes_recibidos) as total_mensajes_periodo,
                SUM(total_llamadas) as total_llamadas_periodo,
                AVG(total_mensajes_recibidos + total_llamadas) as promedio_actividad_diaria,
                
                -- Métricas de puntualidad
                COUNT(CASE WHEN EXTRACT(HOUR FROM check_in_time) <= 8 THEN 1 END) as dias_muy_puntuales,
                COUNT(CASE WHEN EXTRACT(HOUR FROM check_in_time) BETWEEN 8 AND 10 THEN 1 END) as dias_puntuales,
                COUNT(CASE WHEN EXTRACT(HOUR FROM check_in_time) > 12 THEN 1 END) as dias_tardios,
                
                -- Métricas de productividad
                COUNT(CASE WHEN (total_mensajes_recibidos + total_llamadas) > 50 THEN 1 END) as dias_alta_productividad,
                COUNT(CASE WHEN (total_mensajes_recibidos + total_llamadas) BETWEEN 21 AND 50 THEN 1 END) as dias_media_productividad,
                
                -- Distribución de canales
                AVG(mensajes_whatsapp) as promedio_whatsapp,
                AVG(mensajes_meta) as promedio_meta,
                AVG(mensajes_instagram) as promedio_instagram,
                AVG(mensajes_tiktok) as promedio_tiktok,
                
                -- Fechas límite del período consultado
                MIN(fecha) as primera_fecha,
                MAX(fecha) as ultima_fecha

            FROM actividad_diaria ad
            WHERE ${whereConditions.slice(0, -2).join(' AND ')}
        `;

        // Ejecutar todas las queries en paralelo
        const [historialResult, countResult, resumenResult] = await Promise.all([
            query(historialQuery, queryParams),
            query(countQuery, queryParams.slice(0, -2)), // Sin LIMIT y OFFSET
            query(resumenQuery, queryParams.slice(0, -2))  // Sin LIMIT y OFFSET
        ]);

        const registros = historialResult.rows;
        const totalRegistros = parseInt(countResult.rows[0]?.total || 0);
        const resumen = resumenResult.rows[0] || {};

        // Calcular métricas adicionales
        const totalPaginas = Math.ceil(totalRegistros / limite);
        const paginaActual = Math.floor(offset / limite) + 1;
        const tieneSiguiente = offset + limite < totalRegistros;
        const tieneAnterior = offset > 0;

        // Calcular KPIs del período consultado
        const diasRegistrados = parseInt(resumen.total_dias_registrados || 0);
        const tasaFinalizacion = diasRegistrados > 0 ? 
            ((parseInt(resumen.dias_completos || 0) / diasRegistrados) * 100).toFixed(1) : 0;
        const tasaPuntualidad = diasRegistrados > 0 ? 
            (((parseInt(resumen.dias_muy_puntuales || 0) + parseInt(resumen.dias_puntuales || 0)) / diasRegistrados) * 100).toFixed(1) : 0;

        // Formatear registros para respuesta
        const registrosFormateados = registros.map(registro => ({
            id: registro.id,
            fecha: registro.fecha,
            fecha_formateada: registro.fecha_formateada,
            dia_semana: registro.dia_semana.trim(),
            
            // Horarios
            check_in_time: registro.check_in_time,
            check_out_time: registro.check_out_time,
            jornada_horas: parseFloat(registro.jornada_horas || 0),
            
            // Estado
            estado_jornada: registro.estado_jornada,
            estado_jornada_legible: registro.estado_jornada_legible,
            
            // Actividad
            total_mensajes: parseInt(registro.total_mensajes_recibidos || 0),
            total_llamadas: parseInt(registro.total_llamadas || 0),
            total_actividad: parseInt(registro.total_actividad || 0),
            
            // Distribución por canales
            mensajes_por_canal: {
                whatsapp: parseInt(registro.mensajes_whatsapp || 0),
                meta: parseInt(registro.mensajes_meta || 0),
                instagram: parseInt(registro.mensajes_instagram || 0),
                tiktok: parseInt(registro.mensajes_tiktok || 0)
            },
            
            // Porcentajes de distribución
            distribucion_porcentajes: {
                whatsapp: parseFloat(registro.porcentaje_whatsapp || 0),
                meta: parseFloat(registro.porcentaje_meta || 0)
            },
            
            // Análisis del día
            analisis: {
                nivel_productividad: registro.nivel_productividad,
                nivel_puntualidad: registro.nivel_puntualidad,
                duracion_jornada: registro.jornada_horas ? 
                    (parseFloat(registro.jornada_horas) >= 8 ? 'Completa' : 
                     parseFloat(registro.jornada_horas) >= 6 ? 'Parcial' : 'Corta') : 'Sin datos'
            }
        }));

        return {
            success: true,
            data: {
                // Metadatos de paginación
                paginacion: {
                    pagina_actual: paginaActual,
                    total_paginas: totalPaginas,
                    total_registros: totalRegistros,
                    limite: limite,
                    offset: offset,
                    tiene_siguiente: tieneSiguiente,
                    tiene_anterior: tieneAnterior
                },
                
                // Período consultado
                periodo: {
                    fecha_inicio: fechaInicio || resumen.primera_fecha,
                    fecha_fin: fechaFin || resumen.ultima_fecha,
                    dias_en_periodo: diasRegistrados
                },
                
                // Registros del historial
                registros: registrosFormateados,
                
                // Métricas de resumen del período
                resumen_periodo: {
                    kpis_principales: {
                        tasa_finalizacion: parseFloat(tasaFinalizacion),
                        tasa_puntualidad: parseFloat(tasaPuntualidad),
                        promedio_horas_diarias: parseFloat(resumen.promedio_horas_diarias || 0),
                        promedio_actividad_diaria: parseFloat(resumen.promedio_actividad_diaria || 0)
                    },
                    totales: {
                        dias_registrados: diasRegistrados,
                        dias_completos: parseInt(resumen.dias_completos || 0),
                        total_mensajes: parseInt(resumen.total_mensajes_periodo || 0),
                        total_llamadas: parseInt(resumen.total_llamadas_periodo || 0)
                    },
                    distribucion_puntualidad: {
                        muy_puntuales: parseInt(resumen.dias_muy_puntuales || 0),
                        puntuales: parseInt(resumen.dias_puntuales || 0),
                        tardios: parseInt(resumen.dias_tardios || 0)
                    },
                    distribucion_productividad: {
                        alta: parseInt(resumen.dias_alta_productividad || 0),
                        media: parseInt(resumen.dias_media_productividad || 0),
                        baja: diasRegistrados - parseInt(resumen.dias_alta_productividad || 0) - parseInt(resumen.dias_media_productividad || 0)
                    },
                    canales_promedio: {
                        whatsapp: parseFloat(resumen.promedio_whatsapp || 0),
                        meta: parseFloat(resumen.promedio_meta || 0),
                        instagram: parseFloat(resumen.promedio_instagram || 0),
                        tiktok: parseFloat(resumen.promedio_tiktok || 0)
                    }
                },
                
                // Insights y recomendaciones
                insights: generarInsightsHistorial(registrosFormateados, resumen, tasaFinalizacion, tasaPuntualidad)
            }
        };

    } catch (error) {
        console.error('Error en obtenerHistorialUsuario:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener estadísticas rápidas de un usuario (para widgets)
 * @param {number} userId - ID del usuario
 * @param {number} ultimosDias - Número de días hacia atrás (default: 7)
 * @returns {Object} Estadísticas rápidas
 */
exports.obtenerEstadisticasRapidas = async (userId, ultimosDias = 7) => {
    try {
        logService('obtenerEstadisticasRapidas', { userId, ultimosDias });

        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - ultimosDias);

        const statsQuery = `
            SELECT 
                COUNT(*) as dias_activos,
                COUNT(CASE WHEN estado_jornada = 'finalizada' THEN 1 END) as dias_completos,
                AVG(jornada_horas) as promedio_horas,
                SUM(total_mensajes_recibidos + total_llamadas) as total_actividad,
                AVG(total_mensajes_recibidos + total_llamadas) as promedio_actividad,
                
                -- Tendencia (comparar primera vs segunda mitad del período)
                AVG(CASE 
                    WHEN fecha >= (CURRENT_DATE - INTERVAL '${Math.floor(ultimosDias/2)} days') 
                    THEN (total_mensajes_recibidos + total_llamadas) 
                    ELSE NULL 
                END) as actividad_reciente,
                
                AVG(CASE 
                    WHEN fecha < (CURRENT_DATE - INTERVAL '${Math.floor(ultimosDias/2)} days') 
                    THEN (total_mensajes_recibidos + total_llamadas) 
                    ELSE NULL 
                END) as actividad_anterior,
                
                -- Mejor día
                MAX(total_mensajes_recibidos + total_llamadas) as mejor_dia_actividad,
                MAX(jornada_horas) as mejor_dia_horas

            FROM actividad_diaria 
            WHERE usuario_id = $1 
                AND fecha >= $2 
                AND fecha <= CURRENT_DATE
        `;

        const result = await query(statsQuery, [userId, fechaInicio.toISOString().split('T')[0]]);
        const stats = result.rows[0] || {};

        // Calcular tendencia
        const actividadReciente = parseFloat(stats.actividad_reciente || 0);
        const actividadAnterior = parseFloat(stats.actividad_anterior || 0);
        const tendencia = actividadAnterior > 0 ? 
            (((actividadReciente - actividadAnterior) / actividadAnterior) * 100).toFixed(1) : 0;

        return {
            success: true,
            data: {
                periodo_dias: ultimosDias,
                resumen: {
                    dias_activos: parseInt(stats.dias_activos || 0),
                    dias_completos: parseInt(stats.dias_completos || 0),
                    promedio_horas_diarias: parseFloat(stats.promedio_horas || 0),
                    total_actividad: parseInt(stats.total_actividad || 0),
                    promedio_actividad_diaria: parseFloat(stats.promedio_actividad || 0),
                    mejor_dia_actividad: parseInt(stats.mejor_dia_actividad || 0),
                    mejor_dia_horas: parseFloat(stats.mejor_dia_horas || 0)
                },
                tendencia: {
                    porcentaje_cambio: parseFloat(tendencia),
                    direccion: parseFloat(tendencia) > 0 ? 'mejorando' : parseFloat(tendencia) < 0 ? 'declinando' : 'estable',
                    actividad_reciente: actividadReciente,
                    actividad_anterior: actividadAnterior
                }
            }
        };

    } catch (error) {
        console.error('Error en obtenerEstadisticasRapidas:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ============================================
// FUNCIONES AUXILIARES EMPRESARIALES
// ============================================

/**
 * Generar recomendaciones personalizadas
 */
const generarRecomendaciones = async (actividad) => {
    const recomendaciones = [];

    if (parseFloat(actividad.jornada_horas || 0) < 6) {
        recomendaciones.push('Considera extender tu jornada laboral para mayor productividad');
    }

    if (parseInt(actividad.total_mensajes_recibidos || 0) > 100) {
        recomendaciones.push('Alto volumen de mensajes: prioriza respuestas importantes');
    }

    if (parseInt(actividad.total_llamadas || 0) < 5 && parseInt(actividad.total_mensajes_recibidos || 0) > 20) {
        recomendaciones.push('Considera hacer más llamadas directas para mejor conversión');
    }

    const horaCheckIn = actividad.check_in_time ? new Date(actividad.check_in_time).getHours() : null;
    if (horaCheckIn && horaCheckIn > 10) {
        recomendaciones.push('Trata de llegar más temprano para aprovechar mejor el día');
    }

    return recomendaciones;
};

/**
 * Clasificación empresarial de rendimiento
 */
const calcularClasificacionEmpresarial = (tasaFinalizacion, tasaPuntualidad, tasaProductividad) => {
    const promedio = (parseFloat(tasaFinalizacion) + parseFloat(tasaPuntualidad) + parseFloat(tasaProductividad)) / 3;

    if (promedio >= 90) return { nivel: 'Excelente', color: '#22c55e', descripcion: 'Rendimiento sobresaliente' };
    if (promedio >= 75) return { nivel: 'Muy Bueno', color: '#3b82f6', descripcion: 'Rendimiento superior al promedio' };
    if (promedio >= 60) return { nivel: 'Bueno', color: '#f59e0b', descripcion: 'Rendimiento satisfactorio' };
    if (promedio >= 40) return { nivel: 'Regular', color: '#f97316', descripcion: 'Requiere mejora' };
    return { nivel: 'Necesita Mejora', color: '#ef4444', descripcion: 'Rendimiento por debajo del estándar' };
};

/**
 * Clasificación de miembro de equipo
 */
const calcularClasificacionMiembro = (tasaFinalizacion, tasaPuntualidad, promedioActividad) => {
    const score = (parseFloat(tasaFinalizacion) * 0.4) + (parseFloat(tasaPuntualidad) * 0.3) + (parseFloat(promedioActividad) * 0.3);
    
    if (score >= 80) return 'Excelente';
    if (score >= 65) return 'Muy Bueno';
    if (score >= 50) return 'Bueno';
    if (score >= 35) return 'Regular';
    return 'Necesita Mejora';
};

/**
 * Generar recomendaciones estratégicas
 */
const generarRecomendacionesEstrategicas = async (general, canales, clasificacion) => {
    const recomendaciones = [];

    // Análisis de productividad
    const totalActividad = parseInt(general.total_mensajes || 0) + parseInt(general.total_llamadas || 0);
    if (totalActividad < 100) {
        recomendaciones.push('Incrementar actividad diaria para mejorar resultados');
    }

    // Análisis de canales
    const totalWhatsapp = parseInt(canales.total_whatsapp || 0);
    const totalMeta = parseInt(canales.total_meta || 0);
    if (totalWhatsapp > totalMeta * 3) {
        recomendaciones.push('Diversificar canales de comunicación');
    }

    // Análisis de clasificación
    if (clasificacion.nivel === 'Necesita Mejora' || clasificacion.nivel === 'Regular') {
        recomendaciones.push('Revisar estrategias de trabajo y establecer metas diarias');
    }

    return recomendaciones;
};

/**
 * Generar insights gerenciales
 */
const generarInsightsGerenciales = (equipoData, metricas) => {
    const insights = [];

    const mejorPerformer = equipoData.reduce((prev, current) => 
        (prev.metricas.promedio_actividad > current.metricas.promedio_actividad) ? prev : current
    );

    insights.push(`${mejorPerformer.usuario.nombre_completo} lidera en productividad con ${mejorPerformer.metricas.promedio_actividad.toFixed(1)} actividades promedio`);

    const equipoAltaPerformance = equipoData.filter(m => m.clasificacion === 'Excelente' || m.clasificacion === 'Muy Bueno');
    const porcentajeAlto = ((equipoAltaPerformance.length / equipoData.length) * 100).toFixed(1);
    
    insights.push(`${porcentajeAlto}% del equipo tiene alta performance (${equipoAltaPerformance.length}/${equipoData.length} miembros)`);

    if (metricas.promedio_puntualidad < 70) {
        insights.push('Oportunidad de mejora en puntualidad del equipo');
    }

    return insights;
};

// ============================================
// FUNCIONES AUXILIARES PARA HISTORIAL
// ============================================

/**
 * Generar insights inteligentes basados en el historial
 */
const generarInsightsHistorial = (registros, resumen, tasaFinalizacion, tasaPuntualidad) => {
    const insights = [];

    // Análisis de consistencia
    if (registros.length >= 7) {
        const diasConsecutivos = calcularDiasConsecutivos(registros);
        if (diasConsecutivos >= 5) {
            insights.push(`Has trabajado ${diasConsecutivos} días consecutivos - excelente consistencia`);
        }
    }

    // Análisis de productividad
    const promedioActividad = parseFloat(resumen.promedio_actividad_diaria || 0);
    if (promedioActividad > 40) {
        insights.push('Tu nivel de actividad diaria está por encima del promedio');
    } else if (promedioActividad < 15) {
        insights.push('Oportunidad de incrementar tu actividad diaria');
    }

    // Análisis de puntualidad
    if (parseFloat(tasaPuntualidad) > 80) {
        insights.push('Excelente nivel de puntualidad - continúa así');
    } else if (parseFloat(tasaPuntualidad) < 50) {
        insights.push('Considera mejorar tus horarios de llegada');
    }

    // Análisis de finalización
    if (parseFloat(tasaFinalizacion) > 90) {
        insights.push('Muy buena tasa de finalización de jornadas');
    }

    // Análisis de canales preferidos
    const canalPrincipal = determinarCanalPrincipal(resumen);
    if (canalPrincipal) {
        insights.push(`Tu canal principal de comunicación es ${canalPrincipal}`);
    }

    return insights;
};

/**
 * Calcular días consecutivos trabajados
 */
const calcularDiasConsecutivos = (registros) => {
    if (registros.length === 0) return 0;

    // Ordenar por fecha descendente
    const registrosOrdenados = registros
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .filter(r => r.estado_jornada !== 'no_iniciada');

    let consecutivos = 1;
    let fechaAnterior = new Date(registrosOrdenados[0].fecha);

    for (let i = 1; i < registrosOrdenados.length; i++) {
        const fechaActual = new Date(registrosOrdenados[i].fecha);
        const diferenciaDias = Math.abs(fechaAnterior - fechaActual) / (1000 * 60 * 60 * 24);

        if (diferenciaDias === 1) {
            consecutivos++;
            fechaAnterior = fechaActual;
        } else {
            break;
        }
    }

    return consecutivos;
};

/**
 * Determinar canal principal de comunicación
 */
const determinarCanalPrincipal = (resumen) => {
    const canales = [
        { nombre: 'WhatsApp', valor: parseFloat(resumen.promedio_whatsapp || 0) },
        { nombre: 'Meta', valor: parseFloat(resumen.promedio_meta || 0) },
        { nombre: 'Instagram', valor: parseFloat(resumen.promedio_instagram || 0) },
        { nombre: 'TikTok', valor: parseFloat(resumen.promedio_tiktok || 0) }
    ];

    const canalMaximo = canales.reduce((max, canal) => 
        canal.valor > max.valor ? canal : max, canales[0]
    );

    return canalMaximo.valor > 0 ? canalMaximo.nombre : null;
};

console.log('✅ ActividadDiariaService loaded successfully - Enterprise business logic ready');
console.log('🎯 Available methods: getActividadCompleta, calcularMetricasEmpresariales, getDashboardEquipo');
console.log('🆕 New methods: obtenerHistorialUsuario, obtenerEstadisticasRapidas');
console.log('📊 Features: Advanced analytics, Team comparisons, Strategic recommendations, History tracking');
console.log('🔧 Business rules: Productivity analysis, Punctuality tracking, Performance classification\n');