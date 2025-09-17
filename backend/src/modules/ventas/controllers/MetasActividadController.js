// ============================================
// METAS ACTIVIDAD CONTROLLER - CONFIGURACIÓN DE BONOS
// Sistema CRM/ERP v2.0 - Módulo de Metas de Actividad
// ============================================

const { query } = require('../../../config/database');

class MetasActividadController {

    // ============================================
    // LISTAR TIPOS DE META ACTIVIDAD DISPONIBLES
    // ============================================
    static async listarTiposMetaActividad(req, res) {
        try {
            console.log('🔍 Listando tipos de meta actividad');

            const tiposResult = await query(`
                SELECT 
                    t.*,
                    c.valor_minimo,
                    c.valor_objetivo, 
                    c.valor_excelente,
                    c.periodo_evaluacion,
                    u.nombre as configurado_por_nombre
                FROM tipos_meta_actividad t
                LEFT JOIN configuracion_metas_actividad c ON t.id = c.tipo_meta_id AND c.activo = true
                LEFT JOIN usuarios u ON c.configurado_por = u.id
                WHERE t.activo = true
                ORDER BY t.id
            `);

            res.json({
                success: true,
                data: tiposResult.rows,
                message: `${tiposResult.rows.length} tipos de meta actividad disponibles`
            });

        } catch (error) {
            console.error('❌ Error listando tipos meta actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================  
    // CONFIGURAR META ACTIVIDAD (Solo Admin/Manager)
    // ============================================
    static async configurarMetaActividad(req, res) {
        try {
            const {
                tipo_meta_id,
                valor_minimo,
                valor_objetivo,
                valor_excelente,
                periodo_evaluacion = 'mensual'
            } = req.body;

            const userId = req.user.id || req.user.user_id;
            const userRole = req.user.rol || req.user.role;

            console.log('🔧 Configurando meta actividad:', {
                tipo_meta_id,
                valor_minimo,
                valor_objetivo,
                valor_excelente,
                configurado_por: userId
            });

            // Validaciones
            if (!tipo_meta_id || !valor_minimo || !valor_objetivo) {
                return res.status(400).json({
                    success: false,
                    message: 'Campos obligatorios: tipo_meta_id, valor_minimo, valor_objetivo'
                });
            }

            if (valor_minimo >= valor_objetivo) {
                return res.status(400).json({
                    success: false,
                    message: 'El valor objetivo debe ser mayor al valor mínimo'
                });
            }

            // Verificar que el tipo de meta existe
            const tipoExiste = await query(`
                SELECT id, nombre FROM tipos_meta_actividad 
                WHERE id = $1 AND activo = true
            `, [tipo_meta_id]);

            if (tipoExiste.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Tipo de meta no encontrado'
                });
            }

            // Desactivar configuración anterior
            await query(`
                UPDATE configuracion_metas_actividad 
                SET activo = false 
                WHERE tipo_meta_id = $1
            `, [tipo_meta_id]);

            // Crear nueva configuración
            const configResult = await query(`
                INSERT INTO configuracion_metas_actividad 
                (tipo_meta_id, valor_minimo, valor_objetivo, valor_excelente, 
                 periodo_evaluacion, configurado_por)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [tipo_meta_id, valor_minimo, valor_objetivo, valor_excelente, 
                periodo_evaluacion, userId]);

            console.log('✅ Meta actividad configurada:', configResult.rows[0]);

            res.status(201).json({
                success: true,
                data: configResult.rows[0],
                message: `Configuración creada para ${tipoExiste.rows[0].nombre}`
            });

        } catch (error) {
            console.error('❌ Error configurando meta actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // ASIGNAR MODALIDAD DE BONO A ASESOR 
    // ============================================
    static async asignarModalidadAsesor(req, res) {
        try {
            const { asesor_id } = req.params;
            const {
                modalidad_nombre = 'solo_ventas', // 'solo_ventas' o 'ventas_actividad'
                meses_experiencia = 0,
                observaciones = ''
            } = req.body;

            const asignadorId = req.user.id || req.user.user_id;
            const userRole = req.user.rol || req.user.role;

            console.log('👤 Asignando modalidad bono:', {
                asesor_id,
                modalidad_nombre,
                meses_experiencia,
                asignado_por: asignadorId
            });

            // Validar que el asesor existe
            const asesorExiste = await query(`
                SELECT id, nombre, apellido FROM usuarios 
                WHERE id = $1 AND activo = true
            `, [asesor_id]);

            if (asesorExiste.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Asesor no encontrado'
                });
            }

            // Obtener modalidad por nombre
            const modalidadResult = await query(`
                SELECT id, nombre, requiere_experiencia_meses 
                FROM modalidades_bono 
                WHERE nombre = $1 AND activo = true
            `, [modalidad_nombre]);

            if (modalidadResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Modalidad '${modalidad_nombre}' no encontrada`
                });
            }

            const modalidad = modalidadResult.rows[0];

            // Verificar experiencia requerida
            if (meses_experiencia < modalidad.requiere_experiencia_meses) {
                console.log('⚠️  Advertencia: Experiencia insuficiente para modalidad');
                // No bloqueamos, pero alertamos
            }

            // Desactivar asignación anterior
            await query(`
                UPDATE asesor_configuracion_bonos 
                SET activo = false 
                WHERE asesor_id = $1
            `, [asesor_id]);

            // Crear nueva asignación
            const asignacionResult = await query(`
                INSERT INTO asesor_configuracion_bonos
                (asesor_id, modalidad_bono_id, meses_experiencia, 
                 asignado_por, observaciones)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [asesor_id, modalidad.id, meses_experiencia, asignadorId, observaciones]);

            const asesor = asesorExiste.rows[0];

            console.log(`✅ Modalidad '${modalidad_nombre}' asignada a ${asesor.nombre} ${asesor.apellido}`);

            res.status(201).json({
                success: true,
                data: {
                    asesor: `${asesor.nombre} ${asesor.apellido}`,
                    modalidad: modalidad_nombre,
                    meses_experiencia,
                    observaciones,
                    asignacion: asignacionResult.rows[0]
                },
                message: `Modalidad '${modalidad_nombre}' asignada correctamente`
            });

        } catch (error) {
            console.error('❌ Error asignando modalidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // OBTENER CONFIGURACIÓN ACTUAL DEL ASESOR
    // ============================================
    static async obtenerConfiguracionAsesor(req, res) {
        try {
            const { asesor_id } = req.params;
            const userId = req.user.id || req.user.user_id;
            const userRole = req.user.rol || req.user.role;

            console.log('🔍 Obteniendo configuración asesor:', asesor_id);

            // Control de acceso
            const isOwner = parseInt(asesor_id) === parseInt(userId);
            const isManager = ['manager', 'supervisor', 'admin', 'super_admin'].includes(userRole);
            
            if (!isOwner && !isManager) {
                return res.status(403).json({
                    success: false,
                    message: 'Sin permisos para ver esta configuración'
                });
            }

            // Obtener configuración completa del asesor
            const configResult = await query(`
                SELECT 
                    u.id as asesor_id,
                    u.nombre,
                    u.apellido,
                    mb.nombre as modalidad_nombre,
                    mb.descripcion as modalidad_descripcion,
                    acb.meses_experiencia,
                    acb.observaciones,
                    acb.fecha_inicio,
                    ua.nombre as asignado_por_nombre
                FROM usuarios u
                LEFT JOIN asesor_configuracion_bonos acb ON u.id = acb.asesor_id AND acb.activo = true
                LEFT JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id
                LEFT JOIN usuarios ua ON acb.asignado_por = ua.id
                WHERE u.id = $1 AND u.activo = true
            `, [asesor_id]);

            if (configResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Asesor no encontrado'
                });
            }

            const config = configResult.rows[0];

            // Si no tiene modalidad asignada, usar por defecto
            if (!config.modalidad_nombre) {
                config.modalidad_nombre = 'solo_ventas';
                config.modalidad_descripcion = 'Modalidad por defecto - Solo ventas USD';
                config.meses_experiencia = 0;
            }

            // Si la modalidad es ventas_actividad, obtener metas de actividad
            let metasActividad = [];
            if (config.modalidad_nombre === 'ventas_actividad') {
                const metasResult = await query(`
                    SELECT 
                        t.nombre as tipo_meta,
                        t.descripcion,
                        c.valor_minimo,
                        c.valor_objetivo,
                        c.valor_excelente,
                        c.periodo_evaluacion
                    FROM tipos_meta_actividad t
                    INNER JOIN configuracion_metas_actividad c ON t.id = c.tipo_meta_id
                    WHERE t.activo = true AND c.activo = true
                `);
                metasActividad = metasResult.rows;
            }

            console.log(`✅ Configuración obtenida para ${config.nombre} ${config.apellido}`);

            res.json({
                success: true,
                data: {
                    asesor: {
                        id: config.asesor_id,
                        nombre: `${config.nombre} ${config.apellido}`,
                        modalidad: config.modalidad_nombre,
                        descripcion_modalidad: config.modalidad_descripcion,
                        experiencia_meses: config.meses_experiencia,
                        observaciones: config.observaciones,
                        fecha_asignacion: config.fecha_inicio,
                        asignado_por: config.asignado_por_nombre
                    },
                    metas_actividad: metasActividad,
                    puede_configurar: isManager
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // DASHBOARD DE ACTIVIDAD POR EQUIPO (Gerencial)
    // ============================================
    static async dashboardActividadEquipo(req, res) {
        try {
            const userRole = req.user.rol || req.user.role;

            if (!['manager', 'supervisor', 'admin', 'super_admin'].includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Sin permisos para ver dashboard de equipo'
                });
            }

            const año = new Date().getFullYear();
            const mes = new Date().getMonth() + 1;

            console.log('📊 Generando dashboard actividad equipo:', { año, mes });

            // Obtener equipo con configuración de bonos y métricas
            const equipoResult = await query(`
                SELECT 
                    u.id as asesor_id,
                    u.nombre,
                    u.apellido,
                    mb.nombre as modalidad,
                    acb.meses_experiencia,
                    mv.meta_valor,
                    mv.valor_logrado,
                    mv.porcentaje_valor,
                    
                    -- Actividad del mes
                    COALESCE(SUM(ad.total_mensajes_recibidos), 0) as total_mensajes,
                    COALESCE(SUM(ad.total_llamadas), 0) as total_llamadas,
                    COUNT(ad.id) as dias_activos,
                    
                    -- Conversiones (si aplica)
                    CASE 
                        WHEN COALESCE(SUM(ad.total_mensajes_recibidos), 0) > 0 AND mv.ventas_logradas > 0 THEN
                            CAST((mv.ventas_logradas::float / NULLIF(SUM(ad.total_mensajes_recibidos), 0)::float) * 100 AS DECIMAL(10,2))
                        ELSE 0
                    END as conversion_mensajes,
                    
                    CASE 
                        WHEN COALESCE(SUM(ad.total_llamadas), 0) > 0 AND mv.ventas_logradas > 0 THEN
                            CAST((mv.ventas_logradas::float / NULLIF(SUM(ad.total_llamadas), 0)::float) * 100 AS DECIMAL(10,2))
                        ELSE 0
                    END as conversion_llamadas
                    
                FROM usuarios u
                LEFT JOIN asesor_configuracion_bonos acb ON u.id = acb.asesor_id AND acb.activo = true
                LEFT JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id
                LEFT JOIN metas_ventas mv ON u.id = mv.asesor_id 
                    AND mv.año = $1 AND mv.mes = $2 AND mv.activo = true
                LEFT JOIN actividad_diaria ad ON u.id = ad.usuario_id 
                    AND EXTRACT(YEAR FROM ad.fecha) = $1 
                    AND EXTRACT(MONTH FROM ad.fecha) = $2
                WHERE u.activo = true 
                AND u.id IN (SELECT DISTINCT asesor_id FROM metas_ventas WHERE activo = true)
                GROUP BY u.id, u.nombre, u.apellido, mb.nombre, acb.meses_experiencia, 
                         mv.meta_valor, mv.valor_logrado, mv.porcentaje_valor, mv.ventas_logradas
                ORDER BY mv.porcentaje_valor DESC NULLS LAST
            `, [año, mes]);

            const resumenEquipo = {
                total_asesores: equipoResult.rows.length,
                solo_ventas: equipoResult.rows.filter(a => a.modalidad === 'solo_ventas' || !a.modalidad).length,
                ventas_actividad: equipoResult.rows.filter(a => a.modalidad === 'ventas_actividad').length,
                promedio_conversion_mensajes: 0,
                promedio_conversion_llamadas: 0
            };

            // Calcular promedios de conversión
            const asesoresToVentasActividad = equipoResult.rows.filter(a => a.modalidad === 'ventas_actividad');
            if (asesoresToVentasActividad.length > 0) {
                const sumaConversionMensajes = asesoresToVentasActividad.reduce((sum, a) => sum + parseFloat(a.conversion_mensajes || 0), 0);
                const sumaConversionLlamadas = asesoresToVentasActividad.reduce((sum, a) => sum + parseFloat(a.conversion_llamadas || 0), 0);
                
                resumenEquipo.promedio_conversion_mensajes = (sumaConversionMensajes / asesoresToVentasActividad.length).toFixed(2);
                resumenEquipo.promedio_conversion_llamadas = (sumaConversionLlamadas / asesoresToVentasActividad.length).toFixed(2);
            }

            console.log('✅ Dashboard equipo generado:', resumenEquipo);

            res.json({
                success: true,
                data: {
                    periodo: `${año}-${mes.toString().padStart(2, '0')}`,
                    equipo: equipoResult.rows,
                    resumen: resumenEquipo
                }
            });

        } catch (error) {
            console.error('❌ Error en dashboard actividad equipo:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // OBTENER MODALIDADES DISPONIBLES
    // ============================================
    static async obtenerModalidadesDisponibles(req, res) {
        try {
            const modalidadesResult = await query(`
                SELECT * FROM modalidades_bono 
                WHERE activo = true 
                ORDER BY requiere_experiencia_meses ASC
            `);

            res.json({
                success: true,
                data: modalidadesResult.rows,
                message: `${modalidadesResult.rows.length} modalidades disponibles`
            });

        } catch (error) {
            console.error('❌ Error obteniendo modalidades:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = MetasActividadController;

console.log('✅ MetasActividadController loaded - Sistema de configuración de metas actividad');
console.log('🎯 Funciones: Configurar tipos, Asignar modalidades, Dashboard equipo');
console.log('🔐 Control: Solo managers pueden configurar, asesores ven solo lo suyo');