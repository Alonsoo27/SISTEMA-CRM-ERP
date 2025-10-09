// ============================================
// CONTROLLER DE CAMPAÑAS DE ASESOR
// Sistema de tracking de actividad por línea de producto
// ============================================

const { query } = require('../../../config/database');

// ============================================
// OBTENER MIS CAMPAÑAS (Asesor)
// ============================================
const getMisCampanas = async (req, res) => {
    try {
        const userId = req.user.id;
        const { estado = 'todas' } = req.query;

        let whereClause = 'WHERE usuario_id = $1';
        if (estado !== 'todas') {
            whereClause += ` AND estado = '${estado}'`;
        }

        const result = await query(`
            SELECT
                id,
                linea_producto,
                nombre_campana,
                fecha_inicio,
                fecha_fin,
                estado,
                total_mensajes,
                total_llamadas,
                dias_trabajados,
                horas_efectivas,
                total_ventas,
                monto_total_vendido,
                tasa_conversion,
                notas,
                created_at
            FROM campanas_asesor
            ${whereClause}
            ORDER BY
                CASE WHEN estado = 'activa' THEN 1 ELSE 2 END,
                fecha_inicio DESC
        `, [userId]);

        res.json({
            success: true,
            data: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error obteniendo campañas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener campañas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// VISTA DE EQUIPO (Managers)
// ============================================
const getVistaEquipo = async (req, res) => {
    try {
        const { usuario_id, estado = 'todas' } = req.query;
        const userRole = req.user.rol?.toUpperCase();

        // Validar permisos
        const esManager = ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(userRole);
        if (!esManager) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver datos de equipo'
            });
        }

        let whereConditions = [];
        let params = [];
        let paramCount = 0;

        // Filtro por usuario específico
        if (usuario_id) {
            paramCount++;
            whereConditions.push(`ca.usuario_id = $${paramCount}`);
            params.push(usuario_id);
        }

        // Filtro por estado
        if (estado !== 'todas') {
            paramCount++;
            whereConditions.push(`ca.estado = $${paramCount}`);
            params.push(estado);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const result = await query(`
            SELECT
                ca.*,
                u.nombre || ' ' || u.apellido as asesor_nombre,
                u.email as asesor_email,
                r.nombre as rol
            FROM campanas_asesor ca
            INNER JOIN usuarios u ON ca.usuario_id = u.id
            LEFT JOIN roles r ON u.rol_id = r.id
            ${whereClause}
            ORDER BY
                CASE WHEN ca.estado = 'activa' THEN 1 ELSE 2 END,
                ca.fecha_inicio DESC
            LIMIT 200
        `, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rowCount,
            vista: usuario_id ? 'individual' : 'global'
        });

    } catch (error) {
        console.error('Error obteniendo vista de equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener vista de equipo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// INICIAR CAMPAÑA
// ============================================
const iniciarCampana = async (req, res) => {
    try {
        const userId = req.user.id;
        const { linea_producto, nombre_campana, notas } = req.body;

        // Validar campos requeridos
        if (!linea_producto) {
            return res.status(400).json({
                success: false,
                message: 'La línea de producto es requerida'
            });
        }

        // Verificar que no tenga una campaña activa de esa línea
        const existente = await query(`
            SELECT id, nombre_campana, fecha_inicio
            FROM campanas_asesor
            WHERE usuario_id = $1
              AND linea_producto = $2
              AND estado = 'activa'
        `, [userId, linea_producto]);

        if (existente.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Ya tienes una campaña activa de ${linea_producto}`,
                campana_existente: existente.rows[0]
            });
        }

        // Crear nueva campaña
        const result = await query(`
            INSERT INTO campanas_asesor (
                usuario_id,
                linea_producto,
                nombre_campana,
                fecha_inicio,
                notas,
                estado
            ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'activa')
            RETURNING *
        `, [userId, linea_producto, nombre_campana || `Campaña ${linea_producto}`, notas]);

        res.status(201).json({
            success: true,
            message: 'Campaña iniciada exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error iniciando campaña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar campaña',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// FINALIZAR CAMPAÑA
// ============================================
const finalizarCampana = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.rol?.toUpperCase();

        // Managers pueden finalizar cualquier campaña
        const esManager = ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(userRole);

        let whereClause = 'WHERE id = $1 AND estado = $2';
        let params = [id, 'activa'];

        if (!esManager) {
            whereClause += ' AND usuario_id = $3';
            params.push(userId);
        }

        const result = await query(`
            UPDATE campanas_asesor
            SET fecha_fin = CURRENT_DATE,
                estado = 'finalizada',
                updated_at = NOW()
            ${whereClause}
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaña no encontrada o ya finalizada'
            });
        }

        // Recalcular métricas de ventas
        await calcularMetricasVentas(id);

        res.json({
            success: true,
            message: 'Campaña finalizada exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error finalizando campaña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al finalizar campaña',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// OBTENER CAMPAÑA ACTIVA (UNA SOLA - LEGACY)
// ============================================
const getCampanaActiva = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(`
            SELECT * FROM campanas_asesor
            WHERE usuario_id = $1 AND estado = 'activa'
            ORDER BY fecha_inicio DESC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No tienes campañas activas'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error obteniendo campaña activa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener campaña activa',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// OBTENER TODAS MIS CAMPAÑAS ACTIVAS
// ============================================
const getMisCampanasActivas = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(`
            SELECT
                id,
                linea_producto,
                nombre_campana,
                fecha_inicio,
                total_mensajes,
                total_ventas,
                dias_trabajados,
                created_at
            FROM campanas_asesor
            WHERE usuario_id = $1 AND estado = 'activa'
            ORDER BY fecha_inicio DESC
        `, [userId]);

        res.json({
            success: true,
            data: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error obteniendo campañas activas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener campañas activas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// AGREGAR NUEVA LÍNEA DE CAMPAÑA
// ============================================
const agregarLineaCampana = async (req, res) => {
    try {
        const userId = req.user.id;
        const { linea_producto } = req.body;

        // Validar campo requerido
        if (!linea_producto || !linea_producto.trim()) {
            return res.status(400).json({
                success: false,
                message: 'La línea de producto es requerida'
            });
        }

        // Verificar que no tenga una campaña activa de esa línea
        const existente = await query(`
            SELECT id, nombre_campana
            FROM campanas_asesor
            WHERE usuario_id = $1
              AND linea_producto = $2
              AND estado = 'activa'
        `, [userId, linea_producto]);

        if (existente.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Ya tienes una campaña activa de ${linea_producto}`,
                campana_existente: existente.rows[0]
            });
        }

        // Crear nueva campaña
        const result = await query(`
            INSERT INTO campanas_asesor (
                usuario_id,
                linea_producto,
                nombre_campana,
                fecha_inicio,
                estado,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, CURRENT_DATE, 'activa', NOW(), NOW())
            RETURNING *
        `, [userId, linea_producto, `Campaña ${linea_producto}`]);

        console.log(`✅ Nueva campaña creada: ${linea_producto} para usuario ${userId}`);

        res.status(201).json({
            success: true,
            message: 'Campaña iniciada exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error agregando línea de campaña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar línea de campaña',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// FUNCIÓN AUXILIAR: Calcular métricas de ventas
// ============================================
async function calcularMetricasVentas(campanaId) {
    try {
        const campana = await query(
            'SELECT usuario_id, linea_producto, fecha_inicio, fecha_fin FROM campanas_asesor WHERE id = $1',
            [campanaId]
        );

        if (campana.rows.length === 0) return;

        const c = campana.rows[0];

        // Calcular ventas de esa línea en ese período
        const ventas = await query(`
            SELECT
                COUNT(DISTINCT v.id) as total_ventas,
                COALESCE(SUM(vd.cantidad * vd.precio_unitario), 0) as monto_total
            FROM ventas v
            INNER JOIN venta_detalles vd ON v.id = vd.venta_id
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE v.asesor_id = $1
              AND p.linea_producto = $2
              AND v.fecha_venta >= $3
              AND ($4 IS NULL OR v.fecha_venta <= $4)
              AND v.activo = true
        `, [c.usuario_id, c.linea_producto, c.fecha_inicio, c.fecha_fin]);

        const v = ventas.rows[0];

        // Obtener total de mensajes
        const actividad = await query(
            'SELECT total_mensajes FROM campanas_asesor WHERE id = $1',
            [campanaId]
        );

        const totalMensajes = actividad.rows[0]?.total_mensajes || 0;

        // Actualizar métricas
        await query(`
            UPDATE campanas_asesor SET
                total_ventas = $1,
                monto_total_vendido = $2,
                tasa_conversion = CASE
                    WHEN $3 > 0 THEN ROUND(($1::DECIMAL / $3) * 100, 2)
                    ELSE 0
                END,
                updated_at = NOW()
            WHERE id = $4
        `, [v.total_ventas, v.monto_total, totalMensajes, campanaId]);

    } catch (error) {
        console.error('Error calculando métricas de ventas:', error);
    }
}

module.exports = {
    getMisCampanas,
    getVistaEquipo,
    iniciarCampana,
    finalizarCampana,
    getCampanaActiva,
    getMisCampanasActivas,  // ← Nuevo
    agregarLineaCampana      // ← Nuevo
};
