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

        let whereClause = 'WHERE ca.usuario_id = $1';
        if (estado !== 'todas') {
            whereClause += ` AND ca.estado = '${estado}'`;
        }

        const result = await query(`
            WITH ventas_campana AS (
                -- FUENTE 1: Ventas de prospectos marcados con esta campaña
                SELECT
                    ca.id as campana_id,
                    v.id as venta_id,
                    vd.total_linea,
                    'prospecto_marcado' as fuente
                FROM campanas_asesor ca
                INNER JOIN prospectos p ON ca.id = p.campana_id AND p.activo = true
                INNER JOIN ventas v ON p.id = v.prospecto_id AND v.activo = true
                INNER JOIN venta_detalles vd ON v.id = vd.venta_id AND vd.activo = true
                INNER JOIN productos prod ON vd.producto_id = prod.id AND prod.linea_producto = ca.linea_producto
                ${whereClause}

                UNION ALL

                -- FUENTE 2: Ventas directas durante el período de la campaña
                SELECT
                    ca.id as campana_id,
                    v.id as venta_id,
                    vd.total_linea,
                    'venta_directa' as fuente
                FROM campanas_asesor ca
                INNER JOIN ventas v ON v.asesor_id = ca.usuario_id
                    AND v.fecha_venta >= ca.fecha_inicio
                    AND (ca.fecha_fin IS NULL OR v.fecha_venta <= ca.fecha_fin)
                    AND v.prospecto_id IS NULL
                    AND v.activo = true
                INNER JOIN venta_detalles vd ON v.id = vd.venta_id AND vd.activo = true
                INNER JOIN productos prod ON vd.producto_id = prod.id AND prod.linea_producto = ca.linea_producto
                ${whereClause}
            )
            SELECT
                ca.id,
                ca.linea_producto,
                ca.nombre_campana,
                ca.fecha_inicio,
                ca.fecha_fin,
                ca.estado,
                ca.total_mensajes,
                ca.total_llamadas,
                ca.dias_trabajados,
                ca.horas_efectivas,
                ca.notas,
                ca.created_at,
                COUNT(DISTINCT p.id) as total_prospectos,
                COUNT(DISTINCT CASE WHEN p.convertido_venta = true THEN p.id END) as prospectos_convertidos,
                COUNT(DISTINCT CASE WHEN p.convertido_venta = false AND p.estado IN ('Prospecto', 'Cotizado', 'Negociación') THEN p.id END) as prospectos_pendientes,
                COUNT(DISTINCT vc.venta_id) as total_ventas,
                COALESCE(SUM(vc.total_linea), 0) as monto_total_vendido,
                CASE
                    WHEN COUNT(DISTINCT p.id) > 0 THEN
                        ROUND((COUNT(DISTINCT CASE WHEN p.convertido_venta = true THEN p.id END)::DECIMAL / COUNT(DISTINCT p.id)) * 100, 2)
                    ELSE 0
                END as tasa_conversion
            FROM campanas_asesor ca
            LEFT JOIN prospectos p ON ca.id = p.campana_id AND p.activo = true
            LEFT JOIN ventas_campana vc ON ca.id = vc.campana_id
            ${whereClause}
            GROUP BY ca.id, ca.linea_producto, ca.nombre_campana, ca.fecha_inicio, ca.fecha_fin,
                     ca.estado, ca.total_mensajes, ca.total_llamadas, ca.dias_trabajados,
                     ca.horas_efectivas, ca.notas, ca.created_at
            ORDER BY
                CASE WHEN ca.estado = 'activa' THEN 1 ELSE 2 END,
                ca.fecha_inicio DESC
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
            WITH ventas_campana AS (
                -- FUENTE 1: Ventas de prospectos marcados con esta campaña
                SELECT
                    ca.id as campana_id,
                    v.id as venta_id,
                    vd.total_linea,
                    'prospecto_marcado' as fuente
                FROM campanas_asesor ca
                INNER JOIN prospectos p ON ca.id = p.campana_id AND p.activo = true
                INNER JOIN ventas v ON p.id = v.prospecto_id AND v.activo = true
                INNER JOIN venta_detalles vd ON v.id = vd.venta_id AND vd.activo = true
                INNER JOIN productos prod ON vd.producto_id = prod.id AND prod.linea_producto = ca.linea_producto
                ${whereClause}

                UNION ALL

                -- FUENTE 2: Ventas directas durante el período de la campaña
                SELECT
                    ca.id as campana_id,
                    v.id as venta_id,
                    vd.total_linea,
                    'venta_directa' as fuente
                FROM campanas_asesor ca
                INNER JOIN ventas v ON v.asesor_id = ca.usuario_id
                    AND v.fecha_venta >= ca.fecha_inicio
                    AND (ca.fecha_fin IS NULL OR v.fecha_venta <= ca.fecha_fin)
                    AND v.prospecto_id IS NULL
                    AND v.activo = true
                INNER JOIN venta_detalles vd ON v.id = vd.venta_id AND vd.activo = true
                INNER JOIN productos prod ON vd.producto_id = prod.id AND prod.linea_producto = ca.linea_producto
                ${whereClause}
            )
            SELECT
                ca.id,
                ca.usuario_id,
                ca.linea_producto,
                ca.nombre_campana,
                ca.fecha_inicio,
                ca.fecha_fin,
                ca.estado,
                ca.total_mensajes,
                ca.total_llamadas,
                ca.dias_trabajados,
                ca.horas_efectivas,
                ca.notas,
                ca.created_at,
                ca.updated_at,
                u.nombre || ' ' || u.apellido as asesor_nombre,
                u.email as asesor_email,
                r.nombre as rol,
                COUNT(DISTINCT p.id) as total_prospectos,
                COUNT(DISTINCT CASE WHEN p.convertido_venta = true THEN p.id END) as prospectos_convertidos,
                COUNT(DISTINCT CASE WHEN p.convertido_venta = false AND p.estado IN ('Prospecto', 'Cotizado', 'Negociación') THEN p.id END) as prospectos_pendientes,
                COUNT(DISTINCT vc.venta_id) as total_ventas,
                COALESCE(SUM(vc.total_linea), 0) as monto_total_vendido,
                CASE
                    WHEN COUNT(DISTINCT p.id) > 0 THEN
                        ROUND((COUNT(DISTINCT CASE WHEN p.convertido_venta = true THEN p.id END)::DECIMAL / COUNT(DISTINCT p.id)) * 100, 2)
                    ELSE 0
                END as tasa_conversion
            FROM campanas_asesor ca
            INNER JOIN usuarios u ON ca.usuario_id = u.id
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN prospectos p ON ca.id = p.campana_id AND p.activo = true
            LEFT JOIN ventas_campana vc ON ca.id = vc.campana_id
            ${whereClause}
            GROUP BY ca.id, ca.usuario_id, ca.linea_producto, ca.nombre_campana, ca.fecha_inicio, ca.fecha_fin,
                     ca.estado, ca.total_mensajes, ca.total_llamadas, ca.dias_trabajados,
                     ca.horas_efectivas, ca.notas, ca.created_at, ca.updated_at,
                     u.nombre, u.apellido, u.email, r.nombre
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

// ============================================
// OBTENER PROSPECTOS DE UNA CAMPAÑA
// ============================================
const getProspectosCampana = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.rol?.toUpperCase();

        // Validar permisos: solo el dueño o managers
        const esManager = ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(userRole);

        // Verificar que la campaña existe y pertenece al usuario (si no es manager)
        let campanaQuery = 'SELECT * FROM campanas_asesor WHERE id = $1';
        let campanaParams = [id];

        if (!esManager) {
            campanaQuery += ' AND usuario_id = $2';
            campanaParams.push(userId);
        }

        const campanaResult = await query(campanaQuery, campanaParams);

        if (campanaResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaña no encontrada o sin permisos'
            });
        }

        // Obtener prospectos de la campaña
        const prospectos = await query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre_cliente,
                p.apellido_cliente,
                p.empresa,
                p.email,
                p.telefono,
                p.valor_estimado,
                p.estado,
                p.convertido_venta,
                p.venta_id,
                p.campana_linea_detectada,
                p.campana_valor_producto,
                p.created_at as fecha_creacion,
                p.fecha_cierre,
                v.codigo as venta_codigo,
                v.valor_total as venta_monto,
                v.estado_detallado as venta_estado,
                v.fecha_venta,
                EXTRACT(DAY FROM (COALESCE(p.fecha_cierre, NOW()) - p.created_at)) as dias_hasta_conversion
            FROM prospectos p
            LEFT JOIN ventas v ON p.venta_id = v.id
            WHERE p.campana_id = $1
            ORDER BY
                p.convertido_venta DESC,
                p.created_at DESC
        `, [id]);

        // Para cada prospecto, obtener sus productos
        const prospectosConProductos = await Promise.all(
            prospectos.rows.map(async (prospecto) => {
                // Obtener productos del prospecto
                const productosResult = await query(`
                    SELECT
                        pp.id,
                        pp.producto_id,
                        pp.descripcion_producto as descripcion,
                        pp.cantidad_estimada,
                        pp.valor_linea,
                        pp.precio_sin_igv,
                        prod.linea_producto,
                        prod.sublinea_producto,
                        pp.codigo_producto as producto_codigo
                    FROM prospecto_productos_interes pp
                    LEFT JOIN productos prod ON pp.producto_id = prod.id
                    WHERE pp.prospecto_id = $1
                    ORDER BY pp.valor_linea DESC
                `, [prospecto.id]);

                return {
                    ...prospecto,
                    productos: productosResult.rows || []
                };
            })
        );

        res.json({
            success: true,
            campana: campanaResult.rows[0],
            prospectos: prospectosConProductos,
            total: prospectos.rowCount,
            convertidos: prospectos.rows.filter(p => p.convertido_venta).length,
            pendientes: prospectos.rows.filter(p => !p.convertido_venta).length
        });

    } catch (error) {
        console.error('Error obteniendo prospectos de campaña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener prospectos de campaña',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// DASHBOARD DE CAMPAÑA - ANALYTICS COMPLETO
// ============================================
const getDashboardCampana = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.rol?.toUpperCase();

        // Validar permisos
        const esManager = ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(userRole);

        // Verificar que la campaña existe y pertenece al usuario
        let campanaQuery = 'SELECT * FROM campanas_asesor WHERE id = $1';
        let campanaParams = [id];

        if (!esManager) {
            campanaQuery += ' AND usuario_id = $2';
            campanaParams.push(userId);
        }

        const campanaResult = await query(campanaQuery, campanaParams);

        if (campanaResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaña no encontrada o sin permisos'
            });
        }

        const campana = campanaResult.rows[0];

        // Métricas de prospectos
        const metricsProspectos = await query(`
            SELECT
                COUNT(*) as total_prospectos,
                COUNT(CASE WHEN convertido_venta = true THEN 1 END) as prospectos_convertidos,
                COUNT(CASE WHEN convertido_venta = false THEN 1 END) as prospectos_pendientes,
                ROUND(AVG(CASE WHEN convertido_venta = true
                    THEN EXTRACT(DAY FROM (fecha_cierre - created_at))
                END), 1) as dias_promedio_conversion,
                ROUND(AVG(valor_estimado), 2) as valor_promedio_estimado
            FROM prospectos
            WHERE campana_id = $1
        `, [id]);

        // Métricas de ventas generadas
        const metricsVentas = await query(`
            SELECT
                COUNT(v.id) as total_ventas,
                COALESCE(SUM(v.valor_total), 0) as monto_total_ventas,
                ROUND(AVG(v.valor_total), 2) as ticket_promedio,
                COUNT(CASE WHEN v.fecha_venta >= ca.fecha_inicio
                    AND (ca.fecha_fin IS NULL OR v.fecha_venta <= ca.fecha_fin)
                    THEN 1 END) as ventas_durante_campana,
                COUNT(CASE WHEN v.fecha_venta > COALESCE(ca.fecha_fin, CURRENT_DATE)
                    THEN 1 END) as ventas_post_campana
            FROM ventas v
            INNER JOIN campanas_asesor ca ON v.campana_origen_id = ca.id
            WHERE v.campana_origen_id = $1
        `, [id]);

        // Distribución por estado de prospecto
        const distribucionEstados = await query(`
            SELECT
                estado,
                COUNT(*) as cantidad,
                ROUND((COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM prospectos WHERE campana_id = $1), 0)), 1) as porcentaje
            FROM prospectos
            WHERE campana_id = $1
            GROUP BY estado
            ORDER BY cantidad DESC
        `, [id]);

        // Timeline de conversiones (por semana)
        const timelineConversiones = await query(`
            SELECT
                DATE_TRUNC('week', fecha_cierre)::DATE as semana,
                COUNT(*) as conversiones,
                ROUND(AVG(valor_estimado), 2) as valor_promedio
            FROM prospectos
            WHERE campana_id = $1
              AND convertido_venta = true
              AND fecha_cierre IS NOT NULL
            GROUP BY DATE_TRUNC('week', fecha_cierre)
            ORDER BY semana
        `, [id]);

        const metrics = metricsProspectos.rows[0];
        const ventasData = metricsVentas.rows[0];

        // Calcular tasa de conversión
        const tasaConversion = metrics.total_prospectos > 0
            ? ((metrics.prospectos_convertidos / metrics.total_prospectos) * 100).toFixed(2)
            : 0;

        // Calcular ROI estimado (si se tienen datos de costo)
        const roiEstimado = ventasData.monto_total_ventas > 0
            ? ((ventasData.monto_total_ventas / (campana.costo_campana || 1)) * 100).toFixed(2)
            : null;

        res.json({
            success: true,
            campana: {
                id: campana.id,
                nombre: campana.nombre_campana,
                linea_producto: campana.linea_producto,
                estado: campana.estado,
                fecha_inicio: campana.fecha_inicio,
                fecha_fin: campana.fecha_fin,
                dias_activa: campana.fecha_fin
                    ? Math.ceil((new Date(campana.fecha_fin) - new Date(campana.fecha_inicio)) / (1000 * 60 * 60 * 24))
                    : Math.ceil((new Date() - new Date(campana.fecha_inicio)) / (1000 * 60 * 60 * 24))
            },
            metricas_prospectos: {
                total: parseInt(metrics.total_prospectos),
                convertidos: parseInt(metrics.prospectos_convertidos),
                pendientes: parseInt(metrics.prospectos_pendientes),
                tasa_conversion: parseFloat(tasaConversion),
                dias_promedio_conversion: parseFloat(metrics.dias_promedio_conversion) || null,
                valor_promedio_estimado: parseFloat(metrics.valor_promedio_estimado) || 0
            },
            metricas_ventas: {
                total_ventas: parseInt(ventasData.total_ventas),
                monto_total: parseFloat(ventasData.monto_total_ventas),
                ticket_promedio: parseFloat(ventasData.ticket_promedio) || 0,
                ventas_durante_campana: parseInt(ventasData.ventas_durante_campana),
                ventas_post_campana: parseInt(ventasData.ventas_post_campana),
                roi_estimado: roiEstimado
            },
            distribucion_estados: distribucionEstados.rows,
            timeline_conversiones: timelineConversiones.rows
        });

    } catch (error) {
        console.error('Error obteniendo dashboard de campaña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener dashboard de campaña',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getMisCampanas,
    getVistaEquipo,
    iniciarCampana,
    finalizarCampana,
    getCampanaActiva,
    getMisCampanasActivas,
    agregarLineaCampana,
    getProspectosCampana,     // ← Nuevo
    getDashboardCampana        // ← Nuevo
};
