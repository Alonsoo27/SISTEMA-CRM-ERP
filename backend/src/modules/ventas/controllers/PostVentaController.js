// ============================================
// POST VENTA CONTROLLER - SEGUIMIENTO AUTOMÁTICO EMPRESARIAL
// Sistema CRM/ERP v2.0 - Módulo de Ventas Avanzado
// ============================================

const { query } = require('../../../config/database');
const NotificacionesVentasService = require('../services/NotificacionesVentasService');

class PostVentaController {

    // ==========================================
    // PROGRAMACIÓN AUTOMÁTICA DE SEGUIMIENTOS
    // ==========================================
    
    static async programarSeguimientosAutomaticos(req, res) {
        const connection = await query.getConnection();
        
        try {
            await connection.beginTransaction();
            
            const { venta_id } = req.params;
            const { cronograma_personalizado } = req.body;
            
            // Validar venta
            const [venta] = await connection.execute(
                `SELECT v.*, p.nombre as producto_nombre, p.categoria, p.requiere_instalacion
                 FROM ventas v 
                 JOIN productos p ON v.producto_id = p.id 
                 WHERE v.id = ? AND v.eliminado = false`,
                [venta_id]
            );
            
            if (!venta.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Venta no encontrada'
                });
            }
            
            const ventaData = venta[0];
            
            // Determinar cronograma según tipo de producto
            let cronograma = cronograma_personalizado || await this._determinarCronogramaAutomatico(ventaData);
            
            // Crear seguimientos programados
            const seguimientos_creados = [];
            
            for (const item of cronograma) {
                const [result] = await connection.execute(
                    `INSERT INTO post_venta_seguimientos 
                     (venta_id, tipo_seguimiento, fecha_programada, prioridad, 
                      descripcion, canal_preferido, datos_contexto, estado, 
                      creado_por, fecha_creacion)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'Programado', ?, NOW())`,
                    [
                        venta_id,
                        item.tipo,
                        item.fecha_programada,
                        item.prioridad,
                        item.descripcion,
                        item.canal || 'email',
                        JSON.stringify(item.contexto || {}),
                        req.user.id
                    ]
                );
                
                seguimientos_creados.push({
                    id: result.insertId,
                    tipo: item.tipo,
                    fecha_programada: item.fecha_programada,
                    prioridad: item.prioridad
                });
            }
            
            // Programar recordatorios automáticos
            await this._programarRecordatoriosAutomaticos(connection, venta_id, seguimientos_creados);
            
            await connection.commit();
            
            // Notificar al asesor
            await NotificacionesVentasService.enviarNotificacion({
                tipo: 'post_venta_programado',
                usuario_id: ventaData.asesor_id,
                datos: {
                    venta_id,
                    codigo_venta: ventaData.codigo_venta,
                    cliente: ventaData.cliente_nombre,
                    seguimientos_programados: seguimientos_creados.length
                }
            });
            
            res.json({
                success: true,
                message: 'Seguimientos post-venta programados exitosamente',
                data: {
                    venta_id,
                    seguimientos_creados: seguimientos_creados.length,
                    cronograma: seguimientos_creados
                }
            });
            
        } catch (error) {
            await connection.rollback();
            console.error('Error programando seguimientos post-venta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            connection.release();
        }
    }

    // ==========================================
    // GESTIÓN DE SEGUIMIENTOS
    // ==========================================
    
    static async listarSeguimientos(req, res) {
        try {
            const {
                venta_id,
                asesor_id,
                estado = 'all',
                fecha_desde,
                fecha_hasta,
                tipo,
                prioridad,
                vencidos_solo = false,
                page = 1,
                limit = 20
            } = req.query;
            
            let whereConditions = ['pv.eliminado = false'];
            let params = [];
            
            if (venta_id) {
                whereConditions.push('pv.venta_id = ?');
                params.push(venta_id);
            }
            
            if (asesor_id) {
                whereConditions.push('v.asesor_id = ?');
                params.push(asesor_id);
            }
            
            if (estado !== 'all') {
                whereConditions.push('pv.estado = ?');
                params.push(estado);
            }
            
            if (fecha_desde) {
                whereConditions.push('pv.fecha_programada >= ?');
                params.push(fecha_desde);
            }
            
            if (fecha_hasta) {
                whereConditions.push('pv.fecha_programada <= ?');
                params.push(fecha_hasta);
            }
            
            if (tipo) {
                whereConditions.push('pv.tipo_seguimiento = ?');
                params.push(tipo);
            }
            
            if (prioridad) {
                whereConditions.push('pv.prioridad = ?');
                params.push(prioridad);
            }
            
            if (vencidos_solo === 'true') {
                whereConditions.push('pv.fecha_programada < NOW() AND pv.estado IN ("Programado", "En_Proceso")');
            }
            
            const offset = (page - 1) * limit;
            
            const [seguimientos] = await query.execute(
                `SELECT 
                    pv.*,
                    v.codigo_venta,
                    v.cliente_nombre,
                    v.cliente_telefono,
                    v.cliente_email,
                    v.valor_total,
                    p.nombre as producto_nombre,
                    u.nombre as asesor_nombre, u.apellido as asesor_nombre_apellido,
                    CASE 
                        WHEN pv.fecha_programada < NOW() AND pv.estado IN ('Programado', 'En_Proceso') 
                        THEN 'Vencido'
                        WHEN pv.fecha_programada <= DATE_ADD(NOW(), INTERVAL 1 DAY) AND pv.estado = 'Programado'
                        THEN 'Próximo'
                        ELSE 'Normal'
                    END as urgencia
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 JOIN productos p ON v.producto_id = p.id
                 JOIN usuarios u ON v.asesor_id = u.id
                 WHERE ${whereConditions.join(' AND ')}
                 ORDER BY 
                    CASE pv.prioridad 
                        WHEN 'Alta' THEN 1 
                        WHEN 'Media' THEN 2 
                        WHEN 'Baja' THEN 3 
                    END,
                    pv.fecha_programada ASC
                 LIMIT ? OFFSET ?`,
                [...params, parseInt(limit), offset]
            );
            
            // Contar total para paginación
            const [totalCount] = await query.execute(
                `SELECT COUNT(*) as total 
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 WHERE ${whereConditions.join(' AND ')}`,
                params
            );
            
            // Obtener estadísticas rápidas
            const [stats] = await query.execute(
                `SELECT 
                    COUNT(*) as total_seguimientos,
                    SUM(CASE WHEN estado = 'Programado' THEN 1 ELSE 0 END) as programados,
                    SUM(CASE WHEN estado = 'Completado' THEN 1 ELSE 0 END) as completados,
                    SUM(CASE WHEN fecha_programada < NOW() AND estado IN ('Programado', 'En_Proceso') THEN 1 ELSE 0 END) as vencidos,
                    SUM(CASE WHEN prioridad = 'Alta' AND estado != 'Completado' THEN 1 ELSE 0 END) as alta_prioridad
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 WHERE ${whereConditions.join(' AND ')}`,
                params
            );
            
            res.json({
                success: true,
                data: {
                    seguimientos,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: totalCount[0].total,
                        last_page: Math.ceil(totalCount[0].total / limit)
                    },
                    stats: stats[0]
                }
            });
            
        } catch (error) {
            console.error('Error listando seguimientos post-venta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    
    static async ejecutarSeguimiento(req, res) {
        const connection = await query.getConnection();
        
        try {
            await connection.beginTransaction();
            
            const { id } = req.params;
            const {
                resultado,
                notas,
                satisfaccion_cliente,
                requiere_accion_adicional,
                proxima_accion,
                evidencias = []
            } = req.body;
            
            // Validar seguimiento
            const [seguimiento] = await connection.execute(
                `SELECT pv.*, v.codigo_venta, v.cliente_nombre, v.asesor_id
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 WHERE pv.id = ? AND pv.eliminado = false`,
                [id]
            );
            
            if (!seguimiento.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Seguimiento no encontrado'
                });
            }
            
            const seguimientoData = seguimiento[0];
            
            // Actualizar seguimiento
            await connection.execute(
                `UPDATE post_venta_seguimientos 
                 SET estado = 'Completado',
                     fecha_ejecucion = NOW(),
                     ejecutado_por = ?,
                     resultado = ?,
                     notas = ?,
                     satisfaccion_cliente = ?,
                     requiere_accion_adicional = ?,
                     proxima_accion = ?,
                     evidencias = ?,
                     fecha_actualizacion = NOW()
                 WHERE id = ?`,
                [
                    req.user.id,
                    resultado,
                    notas,
                    satisfaccion_cliente,
                    requiere_accion_adicional ? 1 : 0,
                    proxima_accion,
                    JSON.stringify(evidencias),
                    id
                ]
            );
            
            // Si requiere acción adicional, crear nuevo seguimiento
            if (requiere_accion_adicional && proxima_accion) {
                await connection.execute(
                    `INSERT INTO post_venta_seguimientos 
                     (venta_id, tipo_seguimiento, fecha_programada, prioridad,
                      descripcion, canal_preferido, estado, creado_por, fecha_creacion)
                     VALUES (?, 'Seguimiento_Adicional', DATE_ADD(NOW(), INTERVAL 3 DAY), 'Media',
                             ?, 'telefono', 'Programado', ?, NOW())`,
                    [seguimientoData.venta_id, proxima_accion, req.user.id]
                );
            }
            
            // Actualizar métricas de satisfacción de la venta
            if (satisfaccion_cliente) {
                await connection.execute(
                    `UPDATE ventas 
                     SET satisfaccion_promedio = (
                         SELECT AVG(CAST(satisfaccion_cliente AS DECIMAL(3,1)))
                         FROM post_venta_seguimientos 
                         WHERE venta_id = ? AND satisfaccion_cliente IS NOT NULL
                         AND eliminado = false
                     )
                     WHERE id = ?`,
                    [seguimientoData.venta_id, seguimientoData.venta_id]
                );
            }
            
            await connection.commit();
            
            // Notificar si el resultado requiere atención
            if (resultado === 'Problema_Detectado' || satisfaccion_cliente < 3) {
                await NotificacionesVentasService.enviarNotificacion({
                    tipo: 'post_venta_problema',
                    usuario_id: seguimientoData.asesor_id,
                    datos: {
                        seguimiento_id: id,
                        venta_codigo: seguimientoData.codigo_venta,
                        cliente: seguimientoData.cliente_nombre,
                        resultado,
                        satisfaccion: satisfaccion_cliente
                    }
                });
            }
            
            res.json({
                success: true,
                message: 'Seguimiento ejecutado exitosamente',
                data: {
                    seguimiento_id: id,
                    resultado,
                    accion_adicional_creada: !!requiere_accion_adicional
                }
            });
            
        } catch (error) {
            await connection.rollback();
            console.error('Error ejecutando seguimiento post-venta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        } finally {
            connection.release();
        }
    }

    // ==========================================
    // DASHBOARD Y ANALYTICS POST-VENTA
    // ==========================================
    
    static async getDashboardPostVenta(req, res) {
        try {
            const { asesor_id, fecha_desde, fecha_hasta } = req.query;
            
            let whereCondition = 'pv.eliminado = false';
            let params = [];
            
            if (asesor_id) {
                whereCondition += ' AND v.asesor_id = ?';
                params.push(asesor_id);
            }
            
            if (fecha_desde) {
                whereCondition += ' AND pv.fecha_creacion >= ?';
                params.push(fecha_desde);
            }
            
            if (fecha_hasta) {
                whereCondition += ' AND pv.fecha_creacion <= ?';
                params.push(fecha_hasta);
            }
            
            // Métricas generales
            const [metricas] = await query.execute(
                `SELECT 
                    COUNT(*) as total_seguimientos,
                    SUM(CASE WHEN pv.estado = 'Completado' THEN 1 ELSE 0 END) as completados,
                    SUM(CASE WHEN pv.fecha_programada < NOW() AND pv.estado IN ('Programado', 'En_Proceso') THEN 1 ELSE 0 END) as vencidos,
                    AVG(CASE WHEN pv.satisfaccion_cliente IS NOT NULL THEN pv.satisfaccion_cliente END) as satisfaccion_promedio,
                    SUM(CASE WHEN pv.resultado = 'Problema_Detectado' THEN 1 ELSE 0 END) as problemas_detectados
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 WHERE ${whereCondition}`,
                params
            );
            
            // Distribución por tipo de seguimiento
            const [tiposSeguimiento] = await query.execute(
                `SELECT 
                    pv.tipo_seguimiento,
                    COUNT(*) as cantidad,
                    AVG(pv.satisfaccion_cliente) as satisfaccion_promedio
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 WHERE ${whereCondition}
                 GROUP BY pv.tipo_seguimiento
                 ORDER BY cantidad DESC`,
                params
            );
            
            // Evolución de satisfacción mensual
            const [evolucionSatisfaccion] = await query.execute(
                `SELECT 
                    DATE_FORMAT(pv.fecha_ejecucion, '%Y-%m') as mes,
                    AVG(pv.satisfaccion_cliente) as satisfaccion_promedio,
                    COUNT(*) as seguimientos_completados
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 WHERE ${whereCondition} AND pv.estado = 'Completado' AND pv.satisfaccion_cliente IS NOT NULL
                 GROUP BY DATE_FORMAT(pv.fecha_ejecucion, '%Y-%m')
                 ORDER BY mes DESC
                 LIMIT 12`,
                params
            );
            
            // Top productos con problemas
            const [productosProblemas] = await query.execute(
                `SELECT 
                    p.nombre as producto,
                    COUNT(*) as problemas_reportados,
                    AVG(pv.satisfaccion_cliente) as satisfaccion_promedio
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 JOIN productos p ON v.producto_id = p.id
                 WHERE ${whereCondition} AND pv.resultado = 'Problema_Detectado'
                 GROUP BY p.id, p.nombre
                 ORDER BY problemas_reportados DESC
                 LIMIT 10`,
                params
            );
            
            // Próximos seguimientos urgentes
            const [proximosUrgentes] = await query.execute(
                `SELECT 
                    pv.*,
                    v.codigo_venta,
                    v.cliente_nombre,
                    p.nombre as producto_nombre
                 FROM post_venta_seguimientos pv
                 JOIN ventas v ON pv.venta_id = v.id
                 JOIN productos p ON v.producto_id = p.id
                 WHERE ${whereCondition} 
                   AND pv.estado IN ('Programado', 'En_Proceso')
                   AND pv.fecha_programada <= DATE_ADD(NOW(), INTERVAL 3 DAY)
                 ORDER BY pv.fecha_programada ASC
                 LIMIT 10`,
                params
            );
            
            res.json({
                success: true,
                data: {
                    metricas_generales: metricas[0],
                    tipos_seguimiento: tiposSeguimiento,
                    evolucion_satisfaccion: evolucionSatisfaccion,
                    productos_con_problemas: productosProblemas,
                    proximos_urgentes: proximosUrgentes,
                    fecha_generacion: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Error generando dashboard post-venta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ==========================================
    // MÉTODOS AUXILIARES PRIVADOS
    // ==========================================
    
    static async _determinarCronogramaAutomatico(venta) {
        const cronograma = [];
        const fechaBase = new Date();
        
        // Seguimiento inmediato (24-48 horas)
        cronograma.push({
            tipo: 'Confirmacion_Recepcion',
            fecha_programada: new Date(fechaBase.getTime() + 24 * 60 * 60 * 1000),
            prioridad: 'Alta',
            descripcion: 'Confirmar recepción del producto y primera impresión',
            contexto: { automatico: true, dias_post_venta: 1 }
        });
        
        // Seguimiento de instalación/configuración (3-5 días)
        if (venta.requiere_instalacion) {
            cronograma.push({
                tipo: 'Verificacion_Instalacion',
                fecha_programada: new Date(fechaBase.getTime() + 3 * 24 * 60 * 60 * 1000),
                prioridad: 'Alta',
                descripcion: 'Verificar instalación y funcionamiento correcto',
                contexto: { automatico: true, dias_post_venta: 3 }
            });
        }
        
        // Seguimiento de satisfacción (7 días)
        cronograma.push({
            tipo: 'Evaluacion_Satisfaccion',
            fecha_programada: new Date(fechaBase.getTime() + 7 * 24 * 60 * 60 * 1000),
            prioridad: 'Media',
            descripcion: 'Evaluar satisfacción general y resolver dudas',
            contexto: { automatico: true, dias_post_venta: 7 }
        });
        
        // Seguimiento de uso (15 días)
        cronograma.push({
            tipo: 'Seguimiento_Uso',
            fecha_programada: new Date(fechaBase.getTime() + 15 * 24 * 60 * 60 * 1000),
            prioridad: 'Media',
            descripcion: 'Verificar uso adecuado y optimización',
            contexto: { automatico: true, dias_post_venta: 15 }
        });
        
        // Seguimiento de fidelización (30 días)
        cronograma.push({
            tipo: 'Oportunidad_Expansion',
            fecha_programada: new Date(fechaBase.getTime() + 30 * 24 * 60 * 60 * 1000),
            prioridad: 'Baja',
            descripcion: 'Identificar oportunidades de productos complementarios',
            contexto: { automatico: true, dias_post_venta: 30 }
        });
        
        return cronograma;
    }
    
    static async _programarRecordatoriosAutomaticos(connection, venta_id, seguimientos) {
        for (const seguimiento of seguimientos) {
            // Recordatorio 1 día antes
            const fechaRecordatorio = new Date(seguimiento.fecha_programada);
            fechaRecordatorio.setDate(fechaRecordatorio.getDate() - 1);
            
            await connection.execute(
                `INSERT INTO recordatorios_automaticos 
                 (tipo, referencia_id, fecha_programada, mensaje, usuario_destino, estado)
                 VALUES ('post_venta_seguimiento', ?, ?, ?, 
                         (SELECT asesor_id FROM ventas WHERE id = ?), 'Programado')`,
                [
                    seguimiento.id,
                    fechaRecordatorio,
                    `Recordatorio: Seguimiento post-venta programado para mañana - ${seguimiento.tipo}`,
                    venta_id
                ]
            );
        }
    }
}

module.exports = PostVentaController;