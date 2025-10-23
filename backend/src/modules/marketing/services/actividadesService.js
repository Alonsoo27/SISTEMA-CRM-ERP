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
     * LÓGICA CORREGIDA V4 (DEFINITIVA):
     * - Encuentra el primer slot libre después de AHORA
     * - Respeta horarios laborales (8 AM - 6 PM, almuerzo 1-2 PM)
     * - Salta a siguiente día si es necesario
     * - NUNCA programa en el pasado, almuerzo, o fuera de jornada
     */
    static async obtenerProximoSlotDisponible(usuarioId) {
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
            return ahora;
        }

        // Buscar el primer hueco libre >= AHORA
        let cursorBusqueda = ahora;

        for (let i = 0; i < actividades.length; i++) {
            const actividadActual = actividades[i];

            // Si hay un hueco entre el cursor y el inicio de esta actividad
            if (cursorBusqueda < actividadActual.inicio) {
                console.log('📅 Hueco encontrado entre:', cursorBusqueda, 'y', actividadActual.inicio);
                return cursorBusqueda;
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
        return cursorBusqueda;
    }

    /**
     * Registrar huecos de tiempo pasado sin actividad
     *
     * Cuando se crea una actividad que empieza AHORA, pero la última actividad
     * terminó hace tiempo, registra ese hueco como "INACTIVO"
     */
    static async registrarHuecosPasados(usuarioId, fechaInicioNuevaActividad) {
        try {
            const ahora = new Date();
            const inicioNuevaActividad = new Date(fechaInicioNuevaActividad);

            // Solo procesar si la nueva actividad empieza cerca de AHORA (no si es programada a futuro)
            const diferenciaMinutos = Math.abs((inicioNuevaActividad - ahora) / 60000);
            if (diferenciaMinutos > 60) {
                // La actividad es programada a futuro, no registrar huecos
                return null;
            }

            // Buscar la última actividad que terminó ANTES de ahora
            const result = await query(`
                SELECT fecha_fin_planeada, codigo, descripcion
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND fecha_fin_planeada < NOW()
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

            // Si el hueco es mayor a 30 minutos, registrarlo
            const MINUTOS_MINIMOS_HUECO = 30;
            if (minutosSinActividad > MINUTOS_MINIMOS_HUECO) {
                console.log(`⚠️ Hueco detectado: ${Math.round(minutosSinActividad)} minutos desde ${finUltimaActividad} hasta ahora`);

                // Crear registro de "INACTIVO"
                const codigoHueco = await this.generarCodigoActividad();
                await query(`
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo,
                        fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos, duracion_real_minutos,
                        color_hex, estado, activo
                    ) VALUES (
                        $1, 'SISTEMA', 'INACTIVO', 'Sin actividad registrada',
                        $2, $2, 'sistema',
                        $3, NOW(),
                        $4, $4,
                        '#94A3B8', 'completada', true
                    )
                `, [
                    codigoHueco,
                    usuarioId,
                    finUltimaActividad,
                    Math.round(minutosSinActividad)
                ]);

                console.log(`✅ Hueco registrado: ${codigoHueco} (${Math.round(minutosSinActividad)} min)`);
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
