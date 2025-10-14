// utils/notificacionesProspectos.js
const { query } = require('../../../config/database');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'notificaciones-prospectos' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * SISTEMA DE NOTIFICACIONES PARA PROSPECTOS COMPARTIDOS
 * Notifica a asesores cuando otro asesor registra un prospecto duplicado
 */

class NotificacionesProspectos {
    /**
     * Notifica a asesores que ya tienen registrado este prospecto
     * @param {Object} params - Parámetros de la notificación
     * @param {string} params.telefono - Número de teléfono del prospecto
     * @param {number} params.nuevoProspectoId - ID del nuevo prospecto creado
     * @param {number} params.nuevoAsesorId - ID del asesor que registró el duplicado
     * @param {string} params.nuevoAsesorNombre - Nombre del asesor que registró
     * @param {string} params.nombreCliente - Nombre del cliente
     * @param {Array} params.asesoresActivos - Lista de asesores que tienen el prospecto activo
     */
    static async notificarProspectoCompartido({
        telefono,
        nuevoProspectoId,
        nuevoAsesorId,
        nuevoAsesorNombre,
        nombreCliente,
        asesoresActivos = []
    }) {
        try {
            const notificacionesCreadas = [];

            for (const asesor of asesoresActivos) {
                // No notificar al mismo asesor que lo creó
                if (asesor.asesor_id === nuevoAsesorId) {
                    continue;
                }

                // Crear notificación
                const notificacion = await query(`
                    INSERT INTO notificaciones (
                        usuario_id,
                        tipo,
                        titulo,
                        mensaje,
                        prioridad,
                        leida,
                        prospecto_id,
                        accion_url,
                        accion_texto,
                        datos_extra,
                        activo,
                        estado,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                    RETURNING *
                `, [
                    asesor.asesor_id, // usuario_id
                    'PROSPECTO_COMPARTIDO', // tipo
                    'Prospecto Compartido', // titulo
                    `El asesor ${nuevoAsesorNombre} está llevando un prospecto que tú registraste: ${nombreCliente} - ${telefono}`, // mensaje
                    'MEDIA', // prioridad
                    false, // leida
                    asesor.id, // prospecto_id (el del asesor original)
                    `/prospectos/${asesor.id}`, // accion_url
                    'Ver Prospecto', // accion_texto
                    JSON.stringify({
                        telefono: telefono,
                        nuevo_asesor_id: nuevoAsesorId,
                        nuevo_asesor_nombre: nuevoAsesorNombre,
                        nuevo_prospecto_id: nuevoProspectoId,
                        prospecto_original_id: asesor.id,
                        estado_original: asesor.estado,
                        fecha_registro_nuevo: new Date().toISOString()
                    }), // datos_extra
                    true, // activo
                    'PENDIENTE' // estado
                ]);

                notificacionesCreadas.push(notificacion.rows[0]);

                logger.info(`Notificación enviada a asesor ${asesor.asesor_id} por prospecto compartido: ${telefono}`);
            }

            return {
                success: true,
                notificaciones_enviadas: notificacionesCreadas.length,
                notificaciones: notificacionesCreadas
            };

        } catch (error) {
            logger.error('Error en notificarProspectoCompartido:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial de notificaciones de prospectos compartidos
     * @param {number} asesorId - ID del asesor
     * @param {Object} options - Opciones de filtrado
     * @returns {Array} Lista de notificaciones
     */
    static async obtenerNotificacionesCompartidos(asesorId, options = {}) {
        try {
            const {
                limit = 50,
                solo_no_leidas = false,
                desde = null
            } = options;

            let whereConditions = ['n.usuario_id = $1', "n.tipo = 'PROSPECTO_COMPARTIDO'", 'n.activo = true'];
            const params = [asesorId];
            let paramIndex = 2;

            if (solo_no_leidas) {
                whereConditions.push('n.leida = false');
            }

            if (desde) {
                whereConditions.push(`n.created_at >= $${paramIndex}`);
                params.push(desde);
                paramIndex++;
            }

            const result = await query(`
                SELECT
                    n.*,
                    p.codigo as prospecto_codigo,
                    p.nombre_cliente,
                    p.estado as prospecto_estado
                FROM notificaciones n
                LEFT JOIN prospectos p ON n.prospecto_id = p.id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY n.created_at DESC
                LIMIT $${paramIndex}
            `, [...params, limit]);

            return result.rows || [];

        } catch (error) {
            logger.error('Error en obtenerNotificacionesCompartidos:', error);
            throw error;
        }
    }

    /**
     * Marcar notificación como leída
     * @param {number} notificacionId - ID de la notificación
     * @param {number} asesorId - ID del asesor (para verificar permisos)
     */
    static async marcarComoLeida(notificacionId, asesorId) {
        try {
            await query(`
                UPDATE notificaciones
                SET leida = true,
                    leida_en = NOW(),
                    estado = 'LEIDA'
                WHERE id = $1
                    AND usuario_id = $2
            `, [notificacionId, asesorId]);

            return { success: true };

        } catch (error) {
            logger.error('Error en marcarComoLeida:', error);
            throw error;
        }
    }

    /**
     * Verifica si un asesor ya fue notificado sobre un prospecto específico
     * @param {number} asesorId - ID del asesor
     * @param {string} telefono - Teléfono del prospecto
     * @param {number} nuevoProspectoId - ID del nuevo prospecto registrado
     * @returns {boolean} true si ya fue notificado
     */
    static async yaFueNotificado(asesorId, telefono, nuevoProspectoId) {
        try {
            const result = await query(`
                SELECT id
                FROM notificaciones
                WHERE usuario_id = $1
                    AND tipo = 'PROSPECTO_COMPARTIDO'
                    AND datos_extra->>'telefono' = $2
                    AND datos_extra->>'nuevo_prospecto_id' = $3
                    AND created_at > NOW() - INTERVAL '24 hours'
                LIMIT 1
            `, [asesorId, telefono, nuevoProspectoId.toString()]);

            return result.rows && result.rows.length > 0;

        } catch (error) {
            logger.error('Error en yaFueNotificado:', error);
            return false;
        }
    }

    /**
     * Obtener estadísticas de prospectos compartidos para un asesor
     * @param {number} asesorId - ID del asesor
     * @returns {Object} Estadísticas
     */
    static async obtenerEstadisticasCompartidos(asesorId) {
        try {
            const stats = await query(`
                SELECT
                    COUNT(*) as total_notificaciones,
                    COUNT(*) FILTER (WHERE leida = false) as no_leidas,
                    COUNT(DISTINCT datos_extra->>'telefono') as prospectos_unicos,
                    COUNT(DISTINCT datos_extra->>'nuevo_asesor_id') as asesores_compartiendo
                FROM notificaciones
                WHERE usuario_id = $1
                    AND tipo = 'PROSPECTO_COMPARTIDO'
                    AND activo = true
                    AND created_at > NOW() - INTERVAL '30 days'
            `, [asesorId]);

            return stats.rows[0] || {
                total_notificaciones: 0,
                no_leidas: 0,
                prospectos_unicos: 0,
                asesores_compartiendo: 0
            };

        } catch (error) {
            logger.error('Error en obtenerEstadisticasCompartidos:', error);
            throw error;
        }
    }
}

module.exports = NotificacionesProspectos;
