const { query } = require('../../../config/database');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'sincronizar-seguimientos' },
    transports: [
        new winston.transports.File({ filename: 'logs/seguimientos-sync.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

/**
 * 🔄 SINCRONIZAR CACHE DE SEGUIMIENTOS EN PROSPECTOS
 * ===================================================
 * Esta función busca el PRÓXIMO seguimiento pendiente y actualiza
 * los campos de cache en la tabla prospectos:
 * - seguimiento_obligatorio
 * - seguimiento_completado
 * - fecha_seguimiento
 * - estado_seguimiento
 * - seguimiento_vencido
 *
 * LÓGICA:
 * 1. Buscar el seguimiento pendiente MÁS PRÓXIMO (por fecha_programada ASC)
 * 2. Si existe → actualizar campos de cache con sus datos
 * 3. Si NO existe → marcar prospecto como "sin seguimiento pendiente"
 *
 * @param {number} prospecto_id - ID del prospecto a sincronizar
 * @returns {Promise<Object>} Resultado de la sincronización
 */
async function sincronizarCacheSeguimientos(prospecto_id) {
    try {
        logger.info(`🔄 Sincronizando cache de seguimientos para prospecto ${prospecto_id}`);

        // Buscar el PRÓXIMO seguimiento pendiente (más cercano en el tiempo)
        const siguienteResult = await query(`
            SELECT
                id,
                fecha_programada,
                fecha_limite,
                tipo,
                descripcion,
                vencido
            FROM seguimientos
            WHERE prospecto_id = $1
            AND completado = false
            AND visible_para_asesor = true
            ORDER BY fecha_programada ASC
            LIMIT 1
        `, [prospecto_id]);

        const siguiente = siguienteResult.rows[0];

        if (siguiente) {
            // ✅ HAY SEGUIMIENTO PENDIENTE → Actualizar cache con sus datos
            await query(`
                UPDATE prospectos
                SET seguimiento_obligatorio = $1,
                    seguimiento_completado = false,
                    fecha_seguimiento = $2,
                    estado_seguimiento = 'pendiente',
                    seguimiento_vencido = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [
                siguiente.fecha_programada,
                siguiente.fecha_programada,
                siguiente.vencido || false,
                prospecto_id
            ]);

            logger.info(`✅ Cache sincronizado: Prospecto ${prospecto_id} tiene seguimiento pendiente (${siguiente.tipo}) para ${siguiente.fecha_programada}`);

            return {
                success: true,
                tiene_seguimiento_pendiente: true,
                siguiente_seguimiento: {
                    id: siguiente.id,
                    fecha_programada: siguiente.fecha_programada,
                    tipo: siguiente.tipo,
                    vencido: siguiente.vencido
                }
            };
        } else {
            // ❌ NO HAY SEGUIMIENTOS PENDIENTES → Marcar como completado
            await query(`
                UPDATE prospectos
                SET seguimiento_completado = true,
                    estado_seguimiento = 'realizado',
                    fecha_ultimo_seguimiento = NOW(),
                    updated_at = NOW()
                WHERE id = $1
            `, [prospecto_id]);

            logger.info(`✅ Cache sincronizado: Prospecto ${prospecto_id} NO tiene seguimientos pendientes`);

            return {
                success: true,
                tiene_seguimiento_pendiente: false,
                siguiente_seguimiento: null
            };
        }

    } catch (error) {
        logger.error(`❌ Error sincronizando cache para prospecto ${prospecto_id}:`, error);
        throw error;
    }
}

/**
 * 🔄 SINCRONIZAR MÚLTIPLES PROSPECTOS
 * ====================================
 * Sincroniza el cache de seguimientos para múltiples prospectos
 *
 * @param {Array<number>} prospecto_ids - Array de IDs de prospectos
 * @returns {Promise<Object>} Resumen de la sincronización
 */
async function sincronizarMultiplesProspectos(prospecto_ids) {
    const resultados = {
        exitosos: 0,
        fallidos: 0,
        con_seguimiento: 0,
        sin_seguimiento: 0,
        errores: []
    };

    for (const prospecto_id of prospecto_ids) {
        try {
            const resultado = await sincronizarCacheSeguimientos(prospecto_id);

            if (resultado.success) {
                resultados.exitosos++;
                if (resultado.tiene_seguimiento_pendiente) {
                    resultados.con_seguimiento++;
                } else {
                    resultados.sin_seguimiento++;
                }
            }
        } catch (error) {
            resultados.fallidos++;
            resultados.errores.push({
                prospecto_id,
                error: error.message
            });
        }
    }

    logger.info(`📊 Sincronización masiva completada:`, resultados);
    return resultados;
}

/**
 * 🔄 SINCRONIZAR TODOS LOS PROSPECTOS ACTIVOS
 * ============================================
 * Sincroniza el cache de seguimientos para TODOS los prospectos activos
 * Útil para migraciones o correcciones masivas
 *
 * @returns {Promise<Object>} Resumen de la sincronización
 */
async function sincronizarTodosLosProspectos() {
    try {
        logger.info(`🔄 Iniciando sincronización masiva de TODOS los prospectos activos`);

        // Obtener todos los prospectos activos
        const prospectosResult = await query(`
            SELECT id FROM prospectos
            WHERE activo = true
            AND convertido_venta = false
            AND estado NOT IN ('Cerrado', 'Perdido')
        `);

        const prospecto_ids = prospectosResult.rows.map(p => p.id);
        logger.info(`📊 Se encontraron ${prospecto_ids.length} prospectos activos para sincronizar`);

        const resultado = await sincronizarMultiplesProspectos(prospecto_ids);

        logger.info(`✅ Sincronización masiva completada: ${resultado.exitosos} exitosos, ${resultado.fallidos} fallidos`);

        return resultado;

    } catch (error) {
        logger.error(`❌ Error en sincronización masiva:`, error);
        throw error;
    }
}

module.exports = {
    sincronizarCacheSeguimientos,
    sincronizarMultiplesProspectos,
    sincronizarTodosLosProspectos
};
