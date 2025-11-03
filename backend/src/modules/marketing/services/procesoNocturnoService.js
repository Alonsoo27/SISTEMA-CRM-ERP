// ============================================
// SERVICIO DE PROCESO NOCTURNO
// Marca como no_realizada las actividades vencidas nunca gestionadas
// Se ejecuta automáticamente a las 11:59 PM todos los días
// ============================================

const { query } = require('../../../config/database');

class ProcesoNocturnoService {
    /**
     * Procesar actividades no gestionadas del día
     * Marca como 'no_realizada' todas las actividades que:
     * - Estado: pendiente o en_progreso
     * - Fecha fin planeada ya pasó
     * - No fueron gestionadas (fue_vencida = false)
     * - Son del día de hoy o anteriores
     */
    static async procesarActividadesNoGestionadas() {
        try {
            const ahora = new Date();
            console.log(`🌙 Iniciando proceso nocturno: ${ahora.toISOString()}`);

            // 1. Buscar actividades que deben marcarse como no_realizadas
            const actividadesResult = await query(`
                SELECT
                    id,
                    codigo,
                    descripcion,
                    usuario_id,
                    estado,
                    fecha_inicio_planeada,
                    fecha_fin_planeada,
                    EXTRACT(EPOCH FROM (NOW() - fecha_fin_planeada)) / 60 as minutos_vencimiento
                FROM actividades_marketing
                WHERE activo = true
                  AND estado IN ('pendiente', 'en_progreso')
                  AND fecha_fin_planeada < NOW()
                  AND (fue_vencida = false OR fue_vencida IS NULL)
                  AND tipo != 'sistema'
                ORDER BY fecha_fin_planeada ASC
            `);

            const actividadesNoGestionadas = actividadesResult.rows;
            console.log(`📋 Actividades no gestionadas encontradas: ${actividadesNoGestionadas.length}`);

            if (actividadesNoGestionadas.length === 0) {
                // Registrar ejecución sin cambios
                await this.registrarEjecucion(0, 0, {
                    mensaje: 'No hay actividades no gestionadas'
                });

                return {
                    success: true,
                    actividades_procesadas: 0,
                    actividades_marcadas: 0,
                    mensaje: 'No hay actividades no gestionadas'
                };
            }

            // 2. Marcar todas como no_realizada
            const idsAMarcar = actividadesNoGestionadas.map(act => act.id);

            const updateResult = await query(`
                UPDATE actividades_marketing SET
                    estado = 'no_realizada',
                    fue_vencida = true,
                    minutos_vencimiento = EXTRACT(EPOCH FROM (NOW() - fecha_fin_planeada)) / 60,
                    gestionada_vencimiento_en = NOW(),
                    marcada_no_realizada_en = NOW(),
                    motivo_edicion = 'Marcada automáticamente como no realizada por proceso nocturno'
                WHERE id = ANY($1::int[])
                RETURNING id
            `, [idsAMarcar]);

            const actividadesMarcadas = updateResult.rows.length;
            console.log(`✅ Actividades marcadas como no_realizada: ${actividadesMarcadas}`);

            // 3. Registrar ejecución
            const detalles = {
                actividades: actividadesNoGestionadas.map(act => ({
                    id: act.id,
                    codigo: act.codigo,
                    descripcion: act.descripcion,
                    usuario_id: act.usuario_id,
                    estado_anterior: act.estado,
                    minutos_vencimiento: Math.round(act.minutos_vencimiento)
                }))
            };

            await this.registrarEjecucion(
                actividadesNoGestionadas.length,
                actividadesMarcadas,
                detalles
            );

            return {
                success: true,
                actividades_procesadas: actividadesNoGestionadas.length,
                actividades_marcadas: actividadesMarcadas,
                detalles: detalles
            };

        } catch (error) {
            console.error('❌ Error en proceso nocturno:', error);

            // Registrar error
            await this.registrarEjecucion(0, 0, {
                error: error.message,
                stack: error.stack
            });

            throw error;
        }
    }

    /**
     * Registrar ejecución del proceso nocturno
     */
    static async registrarEjecucion(actividadesProcesadas, actividadesMarcadas, detalles) {
        try {
            await query(`
                INSERT INTO procesamiento_nocturno_marketing (
                    fecha_procesamiento,
                    actividades_procesadas,
                    actividades_marcadas_no_realizadas,
                    detalles
                ) VALUES (NOW(), $1, $2, $3)
            `, [actividadesProcesadas, actividadesMarcadas, JSON.stringify(detalles)]);

            console.log('📝 Ejecución registrada en historial');
        } catch (error) {
            console.error('Error registrando ejecución:', error);
            // No lanzar error para no interrumpir el proceso principal
        }
    }

    /**
     * Obtener historial de ejecuciones
     */
    static async obtenerHistorial(limite = 30) {
        try {
            const result = await query(`
                SELECT
                    id,
                    fecha_procesamiento,
                    actividades_procesadas,
                    actividades_marcadas_no_realizadas,
                    detalles,
                    created_at
                FROM procesamiento_nocturno_marketing
                ORDER BY fecha_procesamiento DESC
                LIMIT $1
            `, [limite]);

            return {
                success: true,
                historial: result.rows
            };
        } catch (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }
    }

    /**
     * Ejecutar proceso manualmente (para testing o corrección manual)
     */
    static async ejecutarManualmente(usuarioId = null) {
        console.log(`🔧 Ejecución manual del proceso nocturno por usuario: ${usuarioId}`);
        return await this.procesarActividadesNoGestionadas();
    }
}

module.exports = ProcesoNocturnoService;
