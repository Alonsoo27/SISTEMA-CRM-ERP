// ============================================
// CONTROLLER DE CAMPAÑAS - SISTEMA DINÁMICO
// ============================================

const { query } = require('../../../config/database');

class CampanasController {
    /**
     * Obtener campañas activas del usuario
     */
    static async getCampanasActivas(req, res) {
        try {
            const { user_id, rol } = req.user;

            // Para managers: ver todas las campañas
            // Para vendedores: solo campañas asignadas
            let whereClause = '';
            let params = [];

            if (['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(rol)) {
                // Managers ven todas las campañas activas
                whereClause = 'WHERE c.activa = true';
            } else {
                // Vendedores solo ven sus campañas asignadas
                whereClause = `
                    WHERE c.activa = true
                    AND (
                        c.vendedor_asignado = $1
                        OR c.vendedor_asignado IS NULL
                        OR c.tipo = 'global'
                    )
                `;
                params.push(user_id);
            }

            const campanasQuery = `
                SELECT
                    c.id,
                    c.nombre,
                    c.descripcion,
                    c.tipo,
                    c.linea_producto,
                    c.fecha_inicio,
                    c.fecha_fin,
                    c.meta_mensajes,
                    c.meta_ventas,
                    c.color_tema,
                    c.vendedor_asignado,
                    c.created_at,

                    -- Progreso de la campaña
                    COALESCE(SUM(CASE
                        WHEN a.check_in_time IS NOT NULL
                        AND a.producto_campana = c.linea_producto
                        THEN a.mensajes_meta + a.mensajes_whatsapp + a.mensajes_instagram + a.mensajes_tiktok
                        ELSE 0
                    END), 0) as mensajes_realizados,

                    COALESCE(COUNT(CASE
                        WHEN p.linea_producto = c.linea_producto
                        AND v.fecha_venta >= c.fecha_inicio
                        AND v.fecha_venta <= c.fecha_fin
                        THEN 1
                    END), 0) as ventas_realizadas,

                    -- Calcular porcentaje de progreso
                    CASE
                        WHEN c.meta_mensajes > 0 THEN
                            ROUND((COALESCE(SUM(CASE
                                WHEN a.check_in_time IS NOT NULL
                                AND a.producto_campana = c.linea_producto
                                THEN a.mensajes_meta + a.mensajes_whatsapp + a.mensajes_instagram + a.mensajes_tiktok
                                ELSE 0
                            END), 0) * 100.0) / c.meta_mensajes, 1)
                        ELSE 0
                    END as porcentaje_progreso

                FROM campanas c
                LEFT JOIN actividad_diaria a ON (
                    a.producto_campana = c.linea_producto
                    AND a.fecha >= c.fecha_inicio
                    AND a.fecha <= c.fecha_fin
                    AND (
                        c.vendedor_asignado IS NULL
                        OR c.vendedor_asignado = a.usuario_id
                        OR c.tipo = 'global'
                    )
                )
                LEFT JOIN ventas v ON (
                    v.fecha_venta >= c.fecha_inicio
                    AND v.fecha_venta <= c.fecha_fin
                    AND (
                        c.vendedor_asignado IS NULL
                        OR c.vendedor_asignado = v.asesor_id
                        OR c.tipo = 'global'
                    )
                )
                LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
                LEFT JOIN productos p ON vd.producto_id = p.id AND p.linea_producto = c.linea_producto
                ${whereClause}
                GROUP BY
                    c.id, c.nombre, c.descripcion, c.tipo, c.linea_producto,
                    c.fecha_inicio, c.fecha_fin, c.meta_mensajes, c.meta_ventas,
                    c.color_tema, c.vendedor_asignado, c.created_at
                ORDER BY
                    c.fecha_inicio DESC,
                    c.created_at DESC
                LIMIT 20
            `;

            const result = await query(campanasQuery, params);

            // Procesar datos para frontend
            const campanasProcessed = result.rows.map(campana => ({
                id: campana.id,
                nombre: campana.nombre,
                descripcion: campana.descripcion,
                tipo: campana.tipo,
                linea_producto: campana.linea_producto,
                color_tema: campana.color_tema || 'blue',
                fecha_inicio: campana.fecha_inicio,
                fecha_fin: campana.fecha_fin,
                estado: determinarEstadoCampana(campana),
                progreso: {
                    mensajes_realizados: parseInt(campana.mensajes_realizados) || 0,
                    mensajes_meta: campana.meta_mensajes || 0,
                    ventas_realizadas: parseInt(campana.ventas_realizadas) || 0,
                    ventas_meta: campana.meta_ventas || 0,
                    porcentaje: Math.min(parseFloat(campana.porcentaje_progreso) || 0, 100)
                },
                dias_restantes: calcularDiasRestantes(campana.fecha_fin)
            }));

            res.json({
                success: true,
                data: campanasProcessed,
                total: campanasProcessed.length,
                mensaje: `${campanasProcessed.length} campañas activas encontradas`
            });

        } catch (error) {
            console.error('❌ Error obteniendo campañas activas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener campañas activas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Crear nueva campaña (solo managers)
     */
    static async crearCampana(req, res) {
        try {
            const { user_id, rol } = req.user;

            // Verificar permisos
            if (!['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para crear campañas'
                });
            }

            const {
                nombre,
                descripcion,
                tipo = 'personal', // 'personal' o 'global'
                linea_producto,
                fecha_inicio,
                fecha_fin,
                meta_mensajes = 0,
                meta_ventas = 0,
                color_tema = 'blue',
                vendedor_asignado = null
            } = req.body;

            // Validaciones
            if (!nombre || !linea_producto || !fecha_inicio || !fecha_fin) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos obligatorios: nombre, linea_producto, fecha_inicio, fecha_fin'
                });
            }

            const insertQuery = `
                INSERT INTO campanas (
                    nombre, descripcion, tipo, linea_producto,
                    fecha_inicio, fecha_fin, meta_mensajes, meta_ventas,
                    color_tema, vendedor_asignado, creado_por, activa
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true
                ) RETURNING *
            `;

            const result = await query(insertQuery, [
                nombre, descripcion, tipo, linea_producto,
                fecha_inicio, fecha_fin, meta_mensajes, meta_ventas,
                color_tema, vendedor_asignado, user_id
            ]);

            res.status(201).json({
                success: true,
                data: result.rows[0],
                message: 'Campaña creada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error creando campaña:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear campaña',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Actualizar progreso de campaña
     */
    static async actualizarProgreso(req, res) {
        try {
            const { campana_id } = req.params;
            const { user_id } = req.user;

            // Recalcular progreso de la campaña
            const progressQuery = `
                SELECT
                    c.*,
                    COALESCE(SUM(
                        a.mensajes_meta + a.mensajes_whatsapp +
                        a.mensajes_instagram + a.mensajes_tiktok
                    ), 0) as mensajes_total,
                    COUNT(v.id) as ventas_total
                FROM campanas c
                LEFT JOIN actividad_diaria a ON (
                    a.producto_campana = c.linea_producto
                    AND a.fecha >= c.fecha_inicio
                    AND a.fecha <= c.fecha_fin
                    AND a.usuario_id = $2
                )
                LEFT JOIN ventas v ON (
                    v.fecha_venta >= c.fecha_inicio
                    AND v.fecha_venta <= c.fecha_fin
                    AND v.asesor_id = $2
                )
                LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
                LEFT JOIN productos p ON vd.producto_id = p.id AND p.linea_producto = c.linea_producto
                WHERE c.id = $1
                GROUP BY c.id
            `;

            const result = await query(progressQuery, [campana_id, user_id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Campaña no encontrada'
                });
            }

            const campana = result.rows[0];
            const porcentaje = campana.meta_mensajes > 0
                ? Math.min((campana.mensajes_total * 100) / campana.meta_mensajes, 100)
                : 0;

            res.json({
                success: true,
                data: {
                    campana_id: campana.id,
                    mensajes_realizados: parseInt(campana.mensajes_total),
                    ventas_realizadas: parseInt(campana.ventas_total),
                    porcentaje_progreso: Math.round(porcentaje * 10) / 10
                },
                message: 'Progreso actualizado'
            });

        } catch (error) {
            console.error('❌ Error actualizando progreso:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar progreso',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

// Funciones auxiliares
function determinarEstadoCampana(campana) {
    const ahora = new Date();
    const inicio = new Date(campana.fecha_inicio);
    const fin = new Date(campana.fecha_fin);

    if (ahora < inicio) return 'PROGRAMADA';
    if (ahora > fin) return 'FINALIZADA';

    const porcentaje = parseFloat(campana.porcentaje_progreso) || 0;
    if (porcentaje >= 100) return 'COMPLETADA';
    if (porcentaje >= 80) return 'CERCA_META';

    return 'ACTIVA';
}

function calcularDiasRestantes(fechaFin) {
    const ahora = new Date();
    const fin = new Date(fechaFin);
    const diff = fin - ahora;

    if (diff <= 0) return 0;

    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports = CampanasController;