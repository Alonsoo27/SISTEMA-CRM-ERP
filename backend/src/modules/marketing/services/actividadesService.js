// ============================================
// SERVICIO DE ACTIVIDADES
// Funciones auxiliares para gestión de actividades
// ============================================

const { query } = require('../../../config/database');

class ActividadesService {
    /**
     * Generar código único para actividad
     */
    static async generarCodigoActividad() {
        const año = new Date().getFullYear();
        const result = await query(`
            SELECT COUNT(*) as total
            FROM actividades_marketing
            WHERE EXTRACT(YEAR FROM created_at) = $1
        `, [año]);

        const total = parseInt(result.rows[0].total) + 1;
        const codigo = `ACT-MKT-${año}-${String(total).padStart(4, '0')}`;

        return codigo;
    }

    /**
     * Obtener próximo slot disponible para un usuario
     *
     * LÓGICA CORREGIDA V5 (DEFINITIVA):
     * - Encuentra el primer slot libre después de AHORA
     * - Respeta horarios laborales (8 AM - 6 PM, almuerzo 1-2 PM)
     * - Salta a siguiente día si es necesario
     * - NUNCA programa en el pasado, almuerzo, o fuera de jornada
     * - Si se especifica duracionMinutos, busca un hueco que cumpla esa duración
     *
     * @param {number} usuarioId - ID del usuario
     * @param {number} duracionMinutos - (Opcional) Duración requerida en minutos
     * @returns {Object} { fecha, espacioDisponible } o solo fecha si no se especifica duración
     */
    static async obtenerProximoSlotDisponible(usuarioId, duracionMinutos = null) {
        const INICIO_JORNADA = 8;
        const FIN_JORNADA = 18;
        const ALMUERZO_INICIO = 13;
        const ALMUERZO_FIN = 14;

        let ahora = new Date();

        // AJUSTE 1: Si estamos en almuerzo, saltar a las 2 PM
        const horaActual = ahora.getHours();
        if (horaActual >= ALMUERZO_INICIO && horaActual < ALMUERZO_FIN) {
            console.log('⏰ Estamos en almuerzo, ajustando a 2 PM');
            ahora.setHours(ALMUERZO_FIN, 0, 0, 0);
        }

        // AJUSTE 2: Si estamos fuera de jornada, saltar al próximo día laboral a las 8 AM
        if (horaActual >= FIN_JORNADA || horaActual < INICIO_JORNADA) {
            console.log('⏰ Fuera de jornada, ajustando al próximo día laboral');
            ahora.setDate(ahora.getDate() + 1);
            ahora.setHours(INICIO_JORNADA, 0, 0, 0);

            // Saltar fines de semana
            while (ahora.getDay() === 0 || ahora.getDay() === 6) {
                ahora.setDate(ahora.getDate() + 1);
            }
        }

        // Buscar TODAS las actividades pendientes/en_progreso ordenadas por inicio
        const result = await query(`
            SELECT fecha_inicio_planeada, fecha_fin_planeada
            FROM actividades_marketing
            WHERE usuario_id = $1
              AND activo = true
              AND estado IN ('pendiente', 'en_progreso')
            ORDER BY fecha_inicio_planeada ASC
        `, [usuarioId]);

        if (result.rows.length === 0) {
            // No tiene actividades - empezar desde AHORA (ya ajustado)
            console.log('📅 Sin actividades - Empezando ahora:', ahora);

            // Si requiere validación de duración, retornar objeto con info
            if (duracionMinutos) {
                return {
                    fecha: ahora,
                    espacioDisponible: Infinity, // Espacio infinito
                    esSuficiente: true
                };
            }
            return ahora;
        }

        // Convertir a objetos Date y filtrar solo futuras
        const actividades = result.rows.map(row => ({
            inicio: new Date(row.fecha_inicio_planeada),
            fin: new Date(row.fecha_fin_planeada)
        })).filter(act => act.fin > ahora); // Solo actividades que NO han terminado

        if (actividades.length === 0) {
            // Todas las actividades ya terminaron
            console.log('📅 Todas las actividades terminaron - Empezando ahora:', ahora);

            if (duracionMinutos) {
                return {
                    fecha: ahora,
                    espacioDisponible: Infinity,
                    esSuficiente: true
                };
            }
            return ahora;
        }

        // Buscar el primer hueco libre >= AHORA
        let cursorBusqueda = ahora;

        for (let i = 0; i < actividades.length; i++) {
            const actividadActual = actividades[i];

            // Si hay un hueco entre el cursor y el inicio de esta actividad
            if (cursorBusqueda < actividadActual.inicio) {
                console.log('📅 Hueco encontrado entre:', cursorBusqueda, 'y', actividadActual.inicio);

                // Si requiere validación de duración, calcular espacio disponible
                if (duracionMinutos) {
                    const colisionesService = require('./colisionesService');
                    const espacioDisponible = colisionesService.calcularMinutosEntre(
                        cursorBusqueda,
                        actividadActual.inicio
                    );

                    const esSuficiente = espacioDisponible >= duracionMinutos;

                    console.log(`📊 Espacio disponible: ${espacioDisponible} min, Necesita: ${duracionMinutos} min, Suficiente: ${esSuficiente}`);

                    if (esSuficiente) {
                        return {
                            fecha: cursorBusqueda,
                            espacioDisponible: espacioDisponible,
                            esSuficiente: true
                        };
                    }

                    // No es suficiente, continuar buscando
                } else {
                    return cursorBusqueda;
                }
            }

            // No hay hueco, mover el cursor al final de esta actividad
            cursorBusqueda = actividadActual.fin;

            // AJUSTE 3: Si el cursor quedó en almuerzo, saltar a las 2 PM
            const horaCursor = cursorBusqueda.getHours();
            if (horaCursor >= ALMUERZO_INICIO && horaCursor < ALMUERZO_FIN) {
                console.log('⏰ Cursor en almuerzo, ajustando a 2 PM');
                cursorBusqueda.setHours(ALMUERZO_FIN, 0, 0, 0);
            }

            // AJUSTE 4: Si el cursor quedó fuera de jornada, saltar al próximo día
            if (horaCursor >= FIN_JORNADA || horaCursor < INICIO_JORNADA) {
                console.log('⏰ Cursor fuera de jornada, ajustando al próximo día laboral');
                cursorBusqueda.setDate(cursorBusqueda.getDate() + 1);
                cursorBusqueda.setHours(INICIO_JORNADA, 0, 0, 0);

                // Saltar fines de semana
                while (cursorBusqueda.getDay() === 0 || cursorBusqueda.getDay() === 6) {
                    cursorBusqueda.setDate(cursorBusqueda.getDate() + 1);
                }
            }
        }

        // No se encontró ningún hueco, devolver el cursor (ya ajustado)
        console.log('📅 Sin huecos - Empezando después de última actividad:', cursorBusqueda);

        if (duracionMinutos) {
            return {
                fecha: cursorBusqueda,
                espacioDisponible: Infinity, // Después de la última actividad, espacio infinito
                esSuficiente: true
            };
        }

        return cursorBusqueda;
    }

    /**
     * Registrar huecos de tiempo pasado sin actividad
     *
     * VERSIÓN MEJORADA V2:
     * - Threshold de 15 minutos (más sensible)
     * - Categorización automática: ALMUERZO, BREAK, INACTIVO
     * - Mejor detección de patrones
     */
    static async registrarHuecosPasados(usuarioId, fechaInicioNuevaActividad) {
        try {
            const ahora = new Date();
            const inicioNuevaActividad = new Date(fechaInicioNuevaActividad);

            // Buscar la última actividad que terminó ANTES de ahora
            const result = await query(`
                SELECT fecha_fin_planeada, codigo, descripcion
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND fecha_fin_planeada < NOW()
                  AND tipo != 'sistema'
                ORDER BY fecha_fin_planeada DESC
                LIMIT 1
            `, [usuarioId]);

            if (result.rows.length === 0) {
                // No hay actividades previas, no hay hueco que registrar
                return null;
            }

            const ultimaActividad = result.rows[0];
            const finUltimaActividad = new Date(ultimaActividad.fecha_fin_planeada);
            const minutosSinActividad = (ahora - finUltimaActividad) / 60000;

            // THRESHOLD MEJORADO: 15 minutos (antes 30)
            const MINUTOS_MINIMOS_HUECO = 15;

            if (minutosSinActividad > MINUTOS_MINIMOS_HUECO) {
                console.log(`⚠️ Hueco detectado: ${Math.round(minutosSinActividad)} minutos desde ${finUltimaActividad} hasta ahora`);

                // CATEGORIZACIÓN INTELIGENTE
                const categoriaHueco = this.categorizarHueco(
                    finUltimaActividad,
                    ahora,
                    minutosSinActividad
                );

                // Crear registro categorizado
                const codigoHueco = await this.generarCodigoActividad();
                await query(`
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo,
                        fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos, duracion_real_minutos,
                        color_hex, estado, activo
                    ) VALUES (
                        $1, 'SISTEMA', $2, $3,
                        $4, $4, 'sistema',
                        $5, NOW(),
                        $6, $6,
                        $7, 'completada', true
                    )
                `, [
                    codigoHueco,
                    categoriaHueco.subcategoria,
                    categoriaHueco.descripcion,
                    usuarioId,
                    finUltimaActividad,
                    Math.round(minutosSinActividad),
                    categoriaHueco.color
                ]);

                console.log(`✅ Hueco registrado: ${codigoHueco} - ${categoriaHueco.subcategoria} (${Math.round(minutosSinActividad)} min)`);
                return codigoHueco;
            }

            return null;
        } catch (error) {
            console.error('Error registrando huecos pasados:', error);
            // No lanzar error, solo loggearlo (no es crítico)
            return null;
        }
    }

    /**
     * Categorizar hueco según duración y horario
     */
    static categorizarHueco(fechaInicio, fechaFin, minutosDuracion) {
        const horaInicio = fechaInicio.getHours();
        const horaFin = fechaFin.getHours();
        const minutoInicio = fechaInicio.getMinutes();
        const minutoFin = fechaFin.getMinutes();

        // ALMUERZO: Si el hueco cae en horario 13:00-14:00
        const esHorarioAlmuerzo = (
            (horaInicio === 13 || (horaInicio === 12 && minutoInicio >= 45)) &&
            (horaFin === 14 || (horaFin === 13 && minutoFin <= 15))
        );

        if (esHorarioAlmuerzo && minutosDuracion >= 45 && minutosDuracion <= 75) {
            return {
                subcategoria: 'ALMUERZO',
                descripcion: 'Hora de almuerzo',
                color: '#10B981' // Verde
            };
        }

        // BREAK: Huecos cortos (15-30 minutos)
        if (minutosDuracion >= 15 && minutosDuracion <= 30) {
            return {
                subcategoria: 'BREAK',
                descripcion: 'Descanso breve',
                color: '#F59E0B' // Ámbar
            };
        }

        // INACTIVO: Huecos largos (más de 30 minutos)
        return {
            subcategoria: 'INACTIVO',
            descripcion: 'Sin actividad registrada',
            color: '#94A3B8' // Gris
        };
    }

    /**
     * Cambiar estado de actividad automáticamente según hora actual
     */
    static async actualizarEstadosAutomatico() {
        try {
            const ahora = new Date();

            // 1. Actividades que deben empezar (pendiente -> en_progreso)
            await query(`
                UPDATE actividades_marketing SET
                    estado = 'en_progreso',
                    fecha_inicio_real = NOW()
                WHERE estado = 'pendiente'
                  AND activo = true
                  AND fecha_inicio_planeada <= $1
            `, [ahora]);

            // 2. Actividades que deberían haber terminado (en_progreso -> requiere confirmación)
            const actividadesVencidas = await query(`
                SELECT id, usuario_id, descripcion
                FROM actividades_marketing
                WHERE estado = 'en_progreso'
                  AND activo = true
                  AND fecha_fin_planeada < $1
            `, [ahora]);

            // Aquí se podría disparar notificaciones para cada actividad vencida
            return {
                actividades_iniciadas: actividadesVencidas.rowCount,
                actividades_vencidas: actividadesVencidas.rows
            };

        } catch (error) {
            console.error('Error actualizando estados automáticos:', error);
            throw error;
        }
    }

    /**
     * Validar si un usuario puede crear actividades
     */
    static async validarPermisoCreacion(usuarioId, rolUsuario) {
        const rolesPermitidos = [
            'JEFE_MARKETING',
            'MARKETING_EJECUTOR',
            'SUPER_ADMIN',
            'GERENTE'
        ];

        return rolesPermitidos.includes(rolUsuario);
    }

    /**
     * Obtener equipo de marketing (para actividades grupales)
     */
    static async obtenerEquipoMarketing() {
        const result = await query(`
            SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.nombre || ' ' || u.apellido as nombre_completo,
                u.email,
                r.nombre as rol
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            WHERE r.nombre IN ('MARKETING_EJECUTOR', 'JEFE_MARKETING')
              AND u.activo = true
              AND u.deleted_at IS NULL
            ORDER BY r.nombre, u.nombre
        `);

        return result.rows;
    }

    /**
     * Calcular estadísticas de un usuario
     */
    static async calcularEstadisticasUsuario(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                COUNT(*) as total_actividades,
                COUNT(CASE WHEN estado = 'completada' THEN 1 END) as completadas,
                COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado = 'en_progreso' THEN 1 END) as en_progreso,
                COUNT(CASE WHEN estado = 'cancelada' THEN 1 END) as canceladas,
                SUM(duracion_planeada_minutos) as minutos_planeados_total,
                SUM(duracion_real_minutos) as minutos_reales_total,
                AVG(CASE
                    WHEN duracion_real_minutos IS NOT NULL AND duracion_planeada_minutos > 0
                    THEN (duracion_real_minutos::DECIMAL / duracion_planeada_minutos) * 100
                END) as porcentaje_cumplimiento_promedio
            FROM actividades_marketing
            WHERE usuario_id = $1
              AND activo = true
              AND fecha_inicio_planeada >= $2
              AND fecha_inicio_planeada <= $3
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows[0];
    }
}

module.exports = ActividadesService;
