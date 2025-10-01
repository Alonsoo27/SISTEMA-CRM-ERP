// ============================================
// METAS VENTAS CONTROLLER - CONFIGURACIÓN DE METAS DE VENTAS
// Sistema CRM/ERP v2.0 - Módulo de Metas de Ventas
// ============================================

const { query } = require('../../../config/database');

class MetasVentasController {

    // ============================================
    // CONFIGURAR META DE VENTAS (Solo Supervisores)
    // ============================================
    static async configurarMetaVentas(req, res) {
        try {
            const {
                asesor_id,
                año = new Date().getFullYear(),
                mes = new Date().getMonth() + 1,
                meta_valor,
                meta_cantidad,
                observaciones = ''
            } = req.body;

            const userId = req.user.id || req.user.user_id;
            const userRole = req.user.rol_id || req.user.role_id;

            console.log('🎯 Configurando meta de ventas:', {
                asesor_id,
                año,
                mes,
                meta_valor,
                meta_cantidad,
                configurado_por: userId
            });

            // Validar permisos (solo supervisores y superiores)
            const rolesSupervisoresVentas = [1, 2, 3, 11]; // SUPERADMIN, GERENTE, JEFE_VENTAS, ADMIN
            if (!rolesSupervisoresVentas.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Sin permisos para configurar metas de ventas'
                });
            }

            // Validaciones
            if (!asesor_id || !meta_valor || !meta_cantidad) {
                return res.status(400).json({
                    success: false,
                    message: 'Campos obligatorios: asesor_id, meta_valor, meta_cantidad'
                });
            }

            if (meta_valor <= 0 || meta_cantidad <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Los valores de meta deben ser mayores a 0'
                });
            }

            // Verificar que el asesor existe y es vendedor
            const asesorResult = await query(`
                SELECT id, nombre, apellido, rol_id, created_at
                FROM usuarios
                WHERE id = $1 AND activo = true AND rol_id IN (1, 7)
            `, [asesor_id]);

            if (asesorResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Asesor no encontrado o no tiene rol de ventas'
                });
            }

            const asesor = asesorResult.rows[0];

            // Desactivar meta anterior para el mismo período
            await query(`
                UPDATE metas_ventas
                SET activo = false,
                    updated_at = NOW(),
                    modificado_por = $1
                WHERE asesor_id = $2 AND año = $3 AND mes = $4 AND activo = true
            `, [userId, asesor_id, año, mes]);

            // Crear nueva meta
            const metaResult = await query(`
                INSERT INTO metas_ventas
                (asesor_id, año, mes, meta_valor, meta_cantidad, configurado_por, observaciones, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING *
            `, [asesor_id, año, mes, meta_valor, meta_cantidad, userId, observaciones]);

            const nuevaMeta = metaResult.rows[0];

            console.log(`✅ Meta configurada: ${asesor.nombre} ${asesor.apellido} - $${meta_valor} (${meta_cantidad} ventas) para ${año}-${mes}`);

            res.status(201).json({
                success: true,
                data: {
                    meta: nuevaMeta,
                    asesor: {
                        id: asesor.id,
                        nombre: `${asesor.nombre} ${asesor.apellido}`,
                        rol_id: asesor.rol_id
                    },
                    periodo: `${año}-${String(mes).padStart(2, '0')}`
                },
                message: `Meta configurada correctamente para ${asesor.nombre} ${asesor.apellido}`
            });

        } catch (error) {
            console.error('❌ Error configurando meta de ventas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ============================================
    // CREAR METAS AUTOMÁTICAS POR DEFECTO
    // ============================================
    static async crearMetasAutomaticas(req, res) {
        try {
            const {
                periodo = 'mes_actual', // mes_actual, mes_siguiente
                forzar = false // Para recrear metas existentes
            } = req.body;

            const userId = req.user.id || req.user.user_id;
            const userRole = req.user.rol_id || req.user.role_id;

            // Validar permisos
            const rolesSupervisoresVentas = [1, 2, 3, 11];
            if (!rolesSupervisoresVentas.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Sin permisos para crear metas automáticas'
                });
            }

            // Calcular período
            const hoy = new Date();
            let año, mes;

            if (periodo === 'mes_siguiente') {
                const siguienteMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
                año = siguienteMes.getFullYear();
                mes = siguienteMes.getMonth() + 1;
            } else {
                año = hoy.getFullYear();
                mes = hoy.getMonth() + 1;
            }

            console.log(`🤖 Creando metas automáticas para ${año}-${mes}`);

            // Obtener todos los asesores de ventas activos
            const asesoresResult = await query(`
                SELECT
                    id,
                    nombre,
                    apellido,
                    rol_id,
                    created_at,
                    -- Calcular meses de experiencia
                    EXTRACT(YEAR FROM AGE(NOW(), created_at)) * 12 +
                    EXTRACT(MONTH FROM AGE(NOW(), created_at)) as meses_experiencia
                FROM usuarios
                WHERE activo = true AND rol_id IN (1, 7)
                ORDER BY created_at ASC
            `);

            let metasCreadas = 0;
            let metasActualizadas = 0;
            const resultados = [];

            for (const asesor of asesoresResult.rows) {
                try {
                    // Verificar si ya tiene meta para el período
                    const metaExistente = await query(`
                        SELECT id, meta_valor, meta_cantidad
                        FROM metas_ventas
                        WHERE asesor_id = $1 AND año = $2 AND mes = $3 AND activo = true
                    `, [asesor.id, año, mes]);

                    if (metaExistente.rows.length > 0 && !forzar) {
                        resultados.push({
                            asesor: `${asesor.nombre} ${asesor.apellido}`,
                            accion: 'ya_existe',
                            meta_actual: metaExistente.rows[0]
                        });
                        continue;
                    }

                    // Determinar meta según experiencia
                    const mesesExp = parseInt(asesor.meses_experiencia) || 0;
                    let metaValor, metaCantidad, requiereActividad;

                    if (mesesExp < 3) {
                        // Primeros 3 meses: Meta básica
                        metaValor = 2500;
                        metaCantidad = 3;
                        requiereActividad = false;
                    } else {
                        // Después de 3 meses: Meta avanzada + actividad
                        metaValor = 8000;
                        metaCantidad = 10;
                        requiereActividad = true;
                    }

                    // Desactivar meta anterior si existe
                    if (metaExistente.rows.length > 0) {
                        await query(`
                            UPDATE metas_ventas
                            SET activo = false, updated_at = NOW(), modificado_por = $1
                            WHERE asesor_id = $2 AND año = $3 AND mes = $4
                        `, [userId, asesor.id, año, mes]);
                    }

                    // Crear nueva meta
                    const nuevaMetaResult = await query(`
                        INSERT INTO metas_ventas
                        (asesor_id, año, mes, meta_valor, meta_cantidad, configurado_por, observaciones, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                        RETURNING *
                    `, [asesor.id, año, mes, metaValor, metaCantidad, userId,
                        `Meta automática - ${mesesExp < 3 ? 'Nuevo asesor' : 'Asesor experimentado'} (${mesesExp} meses exp.)`]);

                    // Si requiere actividad, configurar modalidad
                    if (requiereActividad) {
                        // Verificar si ya tiene modalidad configurada
                        const modalidadExistente = await query(`
                            SELECT id FROM asesor_configuracion_bonos
                            WHERE asesor_id = $1 AND activo = true
                        `, [asesor.id]);

                        if (modalidadExistente.rows.length === 0) {
                            // Buscar modalidad "ventas_actividad"
                            const modalidadResult = await query(`
                                SELECT id FROM modalidades_bono
                                WHERE nombre = 'ventas_actividad' AND activo = true
                                LIMIT 1
                            `);

                            if (modalidadResult.rows.length > 0) {
                                await query(`
                                    INSERT INTO asesor_configuracion_bonos
                                    (asesor_id, modalidad_bono_id, meses_experiencia, asignado_por, observaciones)
                                    VALUES ($1, $2, $3, $4, $5)
                                `, [asesor.id, modalidadResult.rows[0].id, mesesExp, userId,
                                   'Actividad requerida - Asignación automática']);
                            }
                        }
                    }

                    resultados.push({
                        asesor: `${asesor.nombre} ${asesor.apellido}`,
                        accion: metaExistente.rows.length > 0 ? 'actualizada' : 'creada',
                        meta: nuevaMetaResult.rows[0],
                        meses_experiencia: mesesExp,
                        requiere_actividad: requiereActividad
                    });

                    if (metaExistente.rows.length > 0) {
                        metasActualizadas++;
                    } else {
                        metasCreadas++;
                    }

                } catch (asesorError) {
                    console.error(`❌ Error procesando asesor ${asesor.nombre}:`, asesorError);
                    resultados.push({
                        asesor: `${asesor.nombre} ${asesor.apellido}`,
                        accion: 'error',
                        error: asesorError.message
                    });
                }
            }

            console.log(`✅ Metas automáticas procesadas: ${metasCreadas} creadas, ${metasActualizadas} actualizadas`);

            res.status(201).json({
                success: true,
                data: {
                    periodo: `${año}-${String(mes).padStart(2, '0')}`,
                    metas_creadas: metasCreadas,
                    metas_actualizadas: metasActualizadas,
                    total_asesores: asesoresResult.rows.length,
                    resultados: resultados
                },
                message: `Procesadas metas automáticas: ${metasCreadas + metasActualizadas} metas gestionadas`
            });

        } catch (error) {
            console.error('❌ Error creando metas automáticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ============================================
    // LISTAR METAS CONFIGURABLES (Vista Ejecutiva)
    // ============================================
    static async listarMetasConfigurables(req, res) {
        try {
            const {
                año = new Date().getFullYear(),
                mes = new Date().getMonth() + 1,
                incluir_historico = false
            } = req.query;

            const userRole = req.user.rol_id || req.user.role_id;

            // Validar permisos
            const rolesSupervisoresVentas = [1, 2, 3, 11];
            if (!rolesSupervisoresVentas.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Sin permisos para ver configuración de metas'
                });
            }

            console.log(`📋 Listando metas configurables para ${año}-${mes}`);

            // Query base para metas del período
            let query_metas = `
                SELECT
                    u.id as asesor_id,
                    u.nombre,
                    u.apellido,
                    u.rol_id,
                    u.created_at,
                    EXTRACT(YEAR FROM AGE(NOW(), u.created_at)) * 12 +
                    EXTRACT(MONTH FROM AGE(NOW(), u.created_at)) as meses_experiencia,

                    mv.id as meta_id,
                    mv.año,
                    mv.mes,
                    mv.meta_valor,
                    mv.meta_cantidad,
                    mv.observaciones as meta_observaciones,
                    mv.created_at as meta_creada,

                    uc.nombre as configurado_por_nombre,
                    mb.nombre as modalidad_bono,
                    mb.requiere_experiencia_meses,

                    -- Performance actual
                    COALESCE(v.total_ventas, 0) as ventas_realizadas,
                    COALESCE(v.valor_total, 0) as valor_realizado,
                    CASE
                        WHEN mv.meta_valor > 0 THEN
                            ROUND((COALESCE(v.valor_total, 0) / mv.meta_valor) * 100, 2)
                        ELSE 0
                    END as porcentaje_cumplimiento

                FROM usuarios u
                LEFT JOIN metas_ventas mv ON u.id = mv.asesor_id
                    AND mv.año = $1 AND mv.mes = $2 AND mv.activo = true
                LEFT JOIN usuarios uc ON mv.configurado_por = uc.id
                LEFT JOIN asesor_configuracion_bonos acb ON u.id = acb.asesor_id AND acb.activo = true
                LEFT JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id
                LEFT JOIN (
                    SELECT
                        asesor_id,
                        COUNT(*) as total_ventas,
                        SUM(valor_final) as valor_total
                    FROM ventas
                    WHERE estado_detallado = 'vendido' AND activo = true
                        AND EXTRACT(YEAR FROM fecha_venta) = $1
                        AND EXTRACT(MONTH FROM fecha_venta) = $2
                    GROUP BY asesor_id
                ) v ON u.id = v.asesor_id
                WHERE u.activo = true AND u.rol_id IN (1, 7)
                ORDER BY mv.meta_valor DESC NULLS LAST, u.nombre ASC
            `;

            const metasResult = await query(query_metas, [año, mes]);

            // Estadísticas del período
            const estadisticas = {
                total_asesores: metasResult.rows.length,
                con_metas: metasResult.rows.filter(r => r.meta_id !== null).length,
                sin_metas: metasResult.rows.filter(r => r.meta_id === null).length,
                nuevos_asesores: metasResult.rows.filter(r => parseInt(r.meses_experiencia) < 3).length,
                experimentados: metasResult.rows.filter(r => parseInt(r.meses_experiencia) >= 3).length,
                promedio_cumplimiento: 0
            };

            const asesoresToConMetas = metasResult.rows.filter(r => r.meta_id !== null);
            if (asesoresToConMetas.length > 0) {
                const sumaCumplimiento = asesoresToConMetas.reduce((sum, r) => sum + parseFloat(r.porcentaje_cumplimiento || 0), 0);
                estadisticas.promedio_cumplimiento = Math.round(sumaCumplimiento / asesoresToConMetas.length);
            }

            res.json({
                success: true,
                data: {
                    periodo: `${año}-${String(mes).padStart(2, '0')}`,
                    asesores: metasResult.rows,
                    estadisticas: estadisticas
                },
                message: `${metasResult.rows.length} asesores encontrados para configuración`
            });

        } catch (error) {
            console.error('❌ Error listando metas configurables:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = MetasVentasController;

console.log('✅ MetasVentasController loaded - Sistema completo de configuración de metas');
console.log('🎯 Funciones: Configurar metas manuales, Crear automáticas, Listar configurables');
console.log('🤖 Auto-metas: Nuevos = $2,500, Experimentados = $8,000 + actividad');