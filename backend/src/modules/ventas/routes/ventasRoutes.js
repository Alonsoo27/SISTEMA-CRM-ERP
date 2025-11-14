// ============================================
// VENTAS ROUTES - APIs REST EMPRESARIALES
// Sistema CRM/ERP v2.0 - VERSIÓN FINAL COMPLETA
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const VentasController = require('../controllers/ventasController');
const ClientesController = require('../controllers/clientesController');
const ConversionService = require('../services/ConversionService');
const VentasService = require('../services/ventasService');

// Middleware de autenticación y autorización
const { authenticateToken, requireRole, requireOwnership } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES, PERMISOS_OPERACION } = require('../../../config/roles');

// ============================================
// MIDDLEWARES DE AUTORIZACIÓN POR NIVEL
// ============================================

// Acceso básico al módulo de ventas (lectura)
const requireVentasAccess = requireRole(GRUPOS_ROLES.VENTAS_COMPLETO);

// Operaciones de creación y modificación (ventas, clientes, conversiones)
const requireVentasWrite = requireRole(GRUPOS_ROLES.VENTAS_COMPLETO);

// Dashboards ejecutivos (solo jefes y ejecutivos)
const requireVentasReports = requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS);

// ============================================
// ENDPOINT PÚBLICO
// ============================================

// Health check (público para monitoreo)
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Módulo de ventas funcionando',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 🆕 NUEVOS ENDPOINTS PARA SISTEMA DE CORRELATIVOS PROFESIONAL
// AGREGADOS DESPUÉS DE LA LÍNEA 78 (después del endpoint /health)
// ============================================

// 🔢 Obtener próximos correlativos (NUEVO - CRÍTICO PARA VENTAS)
router.post('/proximos-correlativos', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { asesor_id, year } = req.body;
        
        // Validar parámetros de entrada
        if (!asesor_id) {
            return res.status(400).json({
                success: false,
                message: 'asesor_id es requerido'
            });
        }
        
        const asesorIdNum = parseInt(asesor_id);
        if (isNaN(asesorIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'asesor_id debe ser un número válido'
            });
        }
        
        const targetYear = year || new Date().getFullYear();
        
        console.log(`🔢 Generando correlativos para asesor ${asesorIdNum}, año ${targetYear}`);
        
        const { query } = require('../../../config/database');
        
        // 🎯 USAR LAS FUNCIONES SQL QUE CREAMOS
        const result = await query(
            'SELECT * FROM obtener_nuevos_correlativos($1, $2)',
            [asesorIdNum, targetYear]
        );
        
        if (result.rows.length > 0) {
            const correlativos = {
                codigo_global: result.rows[0].codigo_global,
                correlativo_asesor: result.rows[0].correlativo_asesor
            };
            
            console.log('✅ Correlativos generados exitosamente:', correlativos);
            
            res.json({
                success: true,
                data: correlativos,
                message: `Correlativos generados para asesor ${asesorIdNum}, año ${targetYear}`
            });
        } else {
            console.error('❌ No se pudieron generar correlativos');
            res.status(500).json({
                success: false,
                message: 'No se pudieron generar los correlativos. Verificar funciones SQL.'
            });
        }
        
    } catch (error) {
        console.error('❌ Error completo generando correlativos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al generar correlativos',
            error_details: error.message
        });
    }
});

// 📊 Validar disponibilidad de correlativos para el año (NUEVO - MONITOREO)
router.get('/disponibilidad-correlativos/:year', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { year } = req.params;
        
        // Validar año
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
            return res.status(400).json({
                success: false,
                message: 'Año inválido. Debe estar entre 2020 y 2030.'
            });
        }
        
        const { query } = require('../../../config/database');
        
        // Verificar disponibilidad de correlativos para el año
        const result = await query(`
            SELECT 
                COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0) as ultimo_usado,
                999 - COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0) as disponibles,
                CASE 
                    WHEN COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0) >= 990 THEN 'CRITICO'
                    WHEN COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0) >= 950 THEN 'ALERTA'
                    WHEN COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0) >= 900 THEN 'ADVERTENCIA'
                    ELSE 'OK'
                END as estado,
                ROUND(
                    (COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0)::float / 999::float) * 100, 
                    2
                ) as porcentaje_uso
            FROM ventas 
            WHERE codigo LIKE $1 AND activo = true
        `, [`VTA-${yearNum}-%`]);
        
        const disponibilidad = result.rows[0] || {
            ultimo_usado: 0,
            disponibles: 999,
            estado: 'OK',
            porcentaje_uso: 0
        };
        
        // Agregar información adicional
        const info_adicional = {
            año: yearNum,
            maximo_permitido: 999,
            formato_correlativo: `VTA-${yearNum}-XXX`,
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: {
                ...disponibilidad,
                ...info_adicional
            },
            message: `Disponibilidad verificada para año ${yearNum}: ${disponibilidad.disponibles} correlativos restantes`
        });
        
    } catch (error) {
        console.error('❌ Error verificando disponibilidad:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al verificar disponibilidad'
        });
    }
});

// 📈 Estadísticas de correlativos por asesor (NUEVO - ANÁLISIS)
router.get('/estadisticas-correlativos/:asesor_id', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { asesor_id } = req.params;
        const { year } = req.query;
        
        const asesorIdNum = parseInt(asesor_id);
        if (isNaN(asesorIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'asesor_id debe ser un número válido'
            });
        }
        
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        
        const { query } = require('../../../config/database');
        
        // Obtener estadísticas completas del asesor
        const statsResult = await query(`
            WITH asesor_stats AS (
                SELECT 
                    COUNT(*) as total_ventas_año,
                    COUNT(CASE WHEN EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) THEN 1 END) as ventas_mes_actual,
                    MAX(correlativo_asesor) as ultimo_correlativo_asesor,
                    MIN(correlativo_asesor) as primer_correlativo_asesor,
                    ARRAY_AGG(correlativo_asesor ORDER BY correlativo_asesor) as todos_correlativos,
                    SUM(valor_final) as valor_total_año,
                    AVG(valor_final) as ticket_promedio
                FROM ventas 
                WHERE asesor_id = $1 
                AND EXTRACT(YEAR FROM created_at) = $2 
                AND activo = true
            ),
            proximo_correlativo AS (
                SELECT 
                    COALESCE(MAX(correlativo_asesor), 0) + 1 as proximo_numero
                FROM ventas 
                WHERE asesor_id = $1
            ),
            ranking_asesor AS (
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as posicion_ventas,
                    ROW_NUMBER() OVER (ORDER BY SUM(valor_final) DESC) as posicion_ingresos
                FROM ventas 
                WHERE EXTRACT(YEAR FROM created_at) = $2 
                AND activo = true
                GROUP BY asesor_id
                HAVING asesor_id = $1
            )
            SELECT 
                ast.*,
                pc.proximo_numero,
                COALESCE(ra.posicion_ventas, 999) as ranking_ventas,
                COALESCE(ra.posicion_ingresos, 999) as ranking_ingresos
            FROM asesor_stats ast
            CROSS JOIN proximo_correlativo pc
            LEFT JOIN ranking_asesor ra ON true
        `, [asesorIdNum, targetYear]);
        
        const stats = statsResult.rows[0] || {
            total_ventas_año: 0,
            ventas_mes_actual: 0,
            ultimo_correlativo_asesor: 0,
            primer_correlativo_asesor: null,
            todos_correlativos: [],
            valor_total_año: 0,
            ticket_promedio: 0,
            proximo_numero: 1,
            ranking_ventas: 999,
            ranking_ingresos: 999
        };
        
        res.json({
            success: true,
            data: {
                asesor_id: asesorIdNum,
                año: targetYear,
                estadisticas_correlativos: {
                    total_ventas_año: parseInt(stats.total_ventas_año),
                    ventas_mes_actual: parseInt(stats.ventas_mes_actual),
                    ultimo_correlativo: parseInt(stats.ultimo_correlativo_asesor || 0),
                    proximo_correlativo: parseInt(stats.proximo_numero),
                    primer_correlativo: parseInt(stats.primer_correlativo_asesor || 0),
                    secuencia_completa: stats.todos_correlativos || []
                },
                metricas_comerciales: {
                    valor_total_año: parseFloat(stats.valor_total_año || 0),
                    ticket_promedio: parseFloat(stats.ticket_promedio || 0),
                    ranking_ventas: parseInt(stats.ranking_ventas),
                    ranking_ingresos: parseInt(stats.ranking_ingresos)
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de correlativos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener estadísticas'
        });
    }
});

// 🔧 Test de funciones de correlativos (NUEVO - DIAGNÓSTICO)
router.get('/test-correlativos', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { query } = require('../../../config/database');
        
        console.log('🧪 Ejecutando test de funciones de correlativos...');
        
        // Verificar si las funciones SQL existen
        const funcionesResult = await query(`
            SELECT 
                p.proname as nombre_funcion,
                p.proargnames as argumentos,
                p.prorettype::regtype as tipo_retorno
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' 
            AND p.proname LIKE '%correlativo%'
        `);
        
        // Test básico de la función principal
        let test_funcion = null;
        try {
            const testResult = await query(
                'SELECT * FROM obtener_nuevos_correlativos($1, $2)',
                [1, new Date().getFullYear()]
            );
            test_funcion = {
                status: 'OK',
                resultado: testResult.rows[0] || null
            };
        } catch (error) {
            test_funcion = {
                status: 'ERROR',
                error: error.message
            };
        }
        
        // Verificar tabla ventas
        const tablaVentasResult = await query(`
            SELECT 
                COUNT(*) as total_registros,
                COUNT(CASE WHEN codigo LIKE 'VTA-%' THEN 1 END) as con_codigo_vta,
                COUNT(CASE WHEN correlativo_asesor IS NOT NULL THEN 1 END) as con_correlativo_asesor,
                MAX(SUBSTRING(codigo FROM 10)::int) as ultimo_numero_global
            FROM ventas 
            WHERE activo = true
        `);
        
        const tabla_info = tablaVentasResult.rows[0];
        
        res.json({
            success: true,
            data: {
                funciones_disponibles: funcionesResult.rows,
                test_funcion_principal: test_funcion,
                estado_tabla_ventas: {
                    total_registros: parseInt(tabla_info.total_registros),
                    con_codigo_vta: parseInt(tabla_info.con_codigo_vta),
                    con_correlativo_asesor: parseInt(tabla_info.con_correlativo_asesor),
                    ultimo_numero_global: parseInt(tabla_info.ultimo_numero_global || 0)
                },
                diagnostico: {
                    funciones_ok: funcionesResult.rows.length > 0,
                    test_ok: test_funcion?.status === 'OK',
                    tabla_ok: parseInt(tabla_info.total_registros) > 0
                },
                timestamp: new Date().toISOString()
            },
            message: 'Test de sistema de correlativos completado'
        });
        
    } catch (error) {
        console.error('❌ Error en test de correlativos:', error);
        res.status(500).json({
            success: false,
            message: 'Error ejecutando test de correlativos',
            error_details: error.message
        });
    }
});

// ============================================
// RUTAS ESPECÍFICAS (SIN PARÁMETROS) - DEBEN IR PRIMERO
// ============================================

// Dashboard personal del asesor
router.get('/dashboard', authenticateToken, requireVentasReports, VentasController.dashboard);

// Dashboard de equipo (solo para managers)
router.get('/dashboard/equipo', authenticateToken, requireVentasReports, async (req, res) => {
    try {
        // Verificar si el usuario tiene permisos de manager
        const { query } = require('../../../config/database');
        const userResult = await query(`
            SELECT rol FROM usuarios WHERE id = $1
        `, [req.user.id]);

        if (userResult.rows[0]?.rol !== 'manager' && userResult.rows[0]?.rol !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Solo para managers.'
            });
        }

        // Obtener métricas del equipo con nombres completos - PATRÓN PROFESIONAL
        const equipoResult = await query(`
            SELECT 
                u.id, 
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as nombre_completo,
                u.nombre, 
                u.apellido,
                COUNT(v.id) as total_ventas,
                SUM(v.valor_final) as valor_total,
                AVG(v.valor_final) as ticket_promedio,
                COUNT(CASE WHEN v.estado = 'Completada' THEN 1 END) as ventas_completadas
            FROM usuarios u
            LEFT JOIN ventas v ON u.id = v.asesor_id 
                AND v.fecha_creacion >= date_trunc('month', CURRENT_DATE)
                AND v.activo = true
            WHERE u.rol IN ('asesor', 'vendedor')
            GROUP BY u.id, u.nombre, u.apellido
            ORDER BY valor_total DESC NULLS LAST
        `);

        res.json({
            success: true,
            data: {
                periodo: 'Mes actual',
                equipo_ventas: equipoResult.rows
            }
        });

    } catch (error) {
        console.error('Error en dashboard de equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// 🆕 ENDPOINTS PARA DASHBOARD DE ASESORES
// ============================================

// Estadísticas específicas del asesor (NECESARIO PARA DASHBOARD ASESORES)
router.get('/estadisticas-asesor/:id', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_desde, fecha_hasta } = req.query;

        // Validar que el ID sea válido
        const asesorId = parseInt(id);
        if (isNaN(asesorId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de asesor inválido'
            });
        }

        // Verificar que el usuario puede ver estas estadísticas
        // (solo sus propias estadísticas o si es admin/manager)
        if (req.user.id !== asesorId && !['admin', 'manager'].includes(req.user.rol)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver estas estadísticas'
            });
        }

        // Usar el método existente del VentasService
        const estadisticas = await VentasService.obtenerEstadisticasAsesor(
            asesorId,
            fecha_desde ? new Date(fecha_desde) : null,
            fecha_hasta ? new Date(fecha_hasta) : null
        );

        res.json({
            success: true,
            data: estadisticas
        });

    } catch (error) {
        console.error('Error al obtener estadísticas del asesor:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Métricas básicas para dashboard (ALTERNATIVA LIGERA)
// REEMPLAZAR el endpoint /metricas-asesor/:id en ventasRoutes.js con este código corregido:

// REEMPLAZAR el endpoint /metricas-asesor/:id en ventasRoutes.js con este código corregido:

router.get('/metricas-asesor/:id', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const asesorId = parseInt(id);

        if (isNaN(asesorId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de asesor inválido'
            });
        }

        // Solo permitir ver sus propias métricas o si es admin/manager
        if (req.user.id !== asesorId && !['admin', 'manager'].includes(req.user.rol)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado'
            });
        }

        const { query } = require('../../../config/database');

        // Query corregido para PostgreSQL
        const metricasResult = await query(`
            WITH metricas_mes AS (
                SELECT 
                    COUNT(*) as ventas_mes,
                    COUNT(CASE WHEN estado_detallado LIKE 'vendido%' THEN 1 END) as ventas_completadas,
                    SUM(CASE WHEN estado_detallado LIKE 'vendido%' THEN valor_final ELSE 0 END) as ingresos_mes,
                    AVG(CASE WHEN estado_detallado LIKE 'vendido%' THEN valor_final END) as ticket_promedio,
                    COUNT(CASE WHEN DATE(fecha_creacion) = CURRENT_DATE THEN 1 END) as ventas_hoy,
                    COUNT(CASE WHEN estado_detallado = 'anulado' THEN 1 END) as ventas_canceladas
                FROM ventas 
                WHERE asesor_id = $1 
                AND fecha_creacion >= date_trunc('month', CURRENT_DATE)
                AND activo = true
            ),
            metas_mes AS (
                SELECT 
                    meta_cantidad,
                    meta_valor,
                    COALESCE(ventas_logradas, 0) as ventas_logradas,
                    COALESCE(valor_logrado, 0) as valor_logrado,
                    CASE 
                        WHEN meta_cantidad > 0 THEN 
                            CAST((COALESCE(ventas_logradas, 0)::float / meta_cantidad::float) * 100 AS DECIMAL(10,2))
                        ELSE 0 
                    END as porcentaje_cantidad,
                    CASE 
                        WHEN meta_valor > 0 THEN 
                            CAST((COALESCE(valor_logrado, 0)::float / meta_valor::float) * 100 AS DECIMAL(10,2))
                        ELSE 0 
                    END as porcentaje_valor
                FROM metas_ventas 
                WHERE asesor_id = $1 
                AND año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND activo = true
                LIMIT 1
            )
            SELECT 
                mm.*,
                mt.*,
                CASE 
                    WHEN mm.ventas_mes > 0 THEN 
                        CAST((mm.ventas_completadas::float / mm.ventas_mes::float) * 100 AS DECIMAL(10,2))
                    ELSE 0 
                END as tasa_exito
            FROM metricas_mes mm
            LEFT JOIN metas_mes mt ON true
        `, [asesorId]);

        const metricas = metricasResult.rows[0] || {
            ventas_mes: 0,
            ventas_completadas: 0,
            ingresos_mes: 0,
            ticket_promedio: 0,
            ventas_hoy: 0,
            ventas_canceladas: 0,
            tasa_exito: 0,
            meta_cantidad: 0,
            meta_valor: 0,
            ventas_logradas: 0,
            valor_logrado: 0,
            porcentaje_cantidad: 0,
            porcentaje_valor: 0
        };

        res.json({
            success: true,
            data: {
                asesor_id: asesorId,
                periodo: 'mes_actual',
                metricas: {
                    ventas_completadas: parseInt(metricas.ventas_completadas || 0),
                    valor_total_completadas: parseFloat(metricas.ingresos_mes || 0),
                    promedio_venta: parseFloat(metricas.ticket_promedio || 0),
                    tasa_exito: parseFloat(metricas.tasa_exito || 0),
                    ventas_hoy: parseInt(metricas.ventas_hoy || 0),
                    total_ventas: parseInt(metricas.ventas_mes || 0)
                },
                metas: {
                    meta_cantidad: parseInt(metricas.meta_cantidad || 0),
                    meta_valor: parseFloat(metricas.meta_valor || 0),
                    ventas_logradas: parseInt(metricas.ventas_logradas || 0),
                    valor_logrado: parseFloat(metricas.valor_logrado || 0),
                    porcentaje_cantidad: parseFloat(metricas.porcentaje_cantidad || 0),
                    porcentaje_valor: parseFloat(metricas.porcentaje_valor || 0)
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener métricas del asesor:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});
// Estadísticas de ventas
router.get('/estadisticas', authenticateToken, requireVentasAccess, VentasController.getEstadisticas);

// Análisis de conversiones
router.get('/analisis-conversiones', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta } = req.query;
        
        // Validar fechas si se proporcionan
        let fechaDesdeDate = null;
        let fechaHastaDate = null;

        if (fecha_desde) {
            fechaDesdeDate = new Date(fecha_desde);
            if (isNaN(fechaDesdeDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Fecha desde inválida'
                });
            }
        }

        if (fecha_hasta) {
            fechaHastaDate = new Date(fecha_hasta);
            if (isNaN(fechaHastaDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Fecha hasta inválida'
                });
            }
        }
        
        const analisis = await ConversionService.analizarTasasConversion(
            req.user.id, 
            fechaDesdeDate,
            fechaHastaDate
        );

        res.json({
            success: true,
            data: analisis
        });

    } catch (error) {
        console.error('Error en análisis de conversiones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Obtener prospectos listos para conversión
router.get('/prospectos-listos', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const prospectos = await ConversionService.obtenerProspectosListosParaConversion(req.user.id);
        
        res.json({
            success: true,
            data: {
                prospectos_listos: prospectos,
                total: prospectos.length
            }
        });

    } catch (error) {
        console.error('Error al obtener prospectos listos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// REPORTES ESPECÍFICOS - SECCIÓN COMPLETA
// ============================================

// Pipeline de ventas
router.get('/reportes/pipeline', authenticateToken, requireVentasReports, async (req, res) => {
    try {
        const { asesor_id } = req.query;
        const targetAsesor = asesor_id || req.user.id;

        const { query } = require('../../../config/database');
        const pipelineResult = await query(`
            SELECT 
                fase,
                COUNT(*) as cantidad,
                SUM(valor_final) as valor_total,
                AVG(probabilidad_cierre) as probabilidad_promedio
            FROM ventas 
            WHERE asesor_id = $1 AND activo = true AND estado != 'Cancelada'
            GROUP BY fase
            ORDER BY 
                CASE fase
                    WHEN 'Negociacion' THEN 1
                    WHEN 'Propuesta' THEN 2
                    WHEN 'Cierre' THEN 3
                    WHEN 'Ejecucion' THEN 4
                    WHEN 'Entrega' THEN 5
                    ELSE 6
                END
        `, [targetAsesor]);

        res.json({
            success: true,
            data: {
                asesor_id: targetAsesor,
                pipeline: pipelineResult.rows
            }
        });

    } catch (error) {
        console.error('Error en reporte de pipeline:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// 🆕 Reporte dashboard específico - NUEVA RUTA FALTANTE
router.get('/reportes/dashboard', authenticateToken, requireVentasReports, async (req, res) => {
    try {
        const { asesor_id, fecha_desde, fecha_hasta } = req.query;
        const targetAsesor = asesor_id || req.user.id;

        // Fechas por defecto (mes actual)
        const fechaDesde = fecha_desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const fechaHasta = fecha_hasta || new Date().toISOString();

        const { query } = require('../../../config/database');
        
        const dashboardData = await query(`
            WITH ventas_resumen AS (
                SELECT 
                    COUNT(*) as total_ventas,
                    COUNT(CASE WHEN estado = 'Completada' THEN 1 END) as ventas_completadas,
                    SUM(CASE WHEN estado = 'Completada' THEN valor_final ELSE 0 END) as ingresos_totales,
                    AVG(CASE WHEN estado = 'Completada' THEN valor_final END) as ticket_promedio,
                    COUNT(CASE WHEN fecha_creacion >= date_trunc('month', CURRENT_DATE) THEN 1 END) as ventas_mes_actual,
                    SUM(CASE WHEN fecha_creacion >= date_trunc('month', CURRENT_DATE) AND estado = 'Completada' THEN valor_final ELSE 0 END) as ingresos_mes_actual
                FROM ventas 
                WHERE asesor_id = $1 
                AND fecha_creacion BETWEEN $2 AND $3
                AND activo = true
            ),
            metas_mes AS (
                SELECT 
                    meta_cantidad,
                    meta_valor,
                    COALESCE(ventas_logradas, 0) as ventas_logradas,
                    COALESCE(valor_logrado, 0) as valor_logrado
                FROM metas_ventas 
                WHERE asesor_id = $1 
                AND año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND activo = true
                LIMIT 1
            )
            SELECT 
                vr.*,
                mm.meta_cantidad,
                mm.meta_valor,
                mm.ventas_logradas,
                mm.valor_logrado,
                CASE 
                    WHEN mm.meta_cantidad > 0 THEN ROUND((mm.ventas_logradas::float / mm.meta_cantidad::float) * 100, 2)
                    ELSE 0 
                END as porcentaje_cantidad,
                CASE 
                    WHEN mm.meta_valor > 0 THEN ROUND((mm.valor_logrado::float / mm.meta_valor::float) * 100, 2)
                    ELSE 0 
                END as porcentaje_valor
            FROM ventas_resumen vr
            LEFT JOIN metas_mes mm ON true
        `, [targetAsesor, fechaDesde, fechaHasta]);

        const metricas = dashboardData.rows[0] || {};

        res.json({
            success: true,
            data: {
                asesor_id: targetAsesor,
                periodo: {
                    desde: fechaDesde,
                    hasta: fechaHasta
                },
                metricas_generales: {
                    total_ventas: parseInt(metricas.total_ventas || 0),
                    ventas_completadas: parseInt(metricas.ventas_completadas || 0),
                    ingresos_totales: parseFloat(metricas.ingresos_totales || 0),
                    ticket_promedio: parseFloat(metricas.ticket_promedio || 0),
                    ventas_mes_actual: parseInt(metricas.ventas_mes_actual || 0),
                    ingresos_mes_actual: parseFloat(metricas.ingresos_mes_actual || 0)
                },
                metas_mes_actual: {
                    meta_cantidad: parseInt(metricas.meta_cantidad || 0),
                    meta_valor: parseFloat(metricas.meta_valor || 0),
                    ventas_logradas: parseInt(metricas.ventas_logradas || 0),
                    valor_logrado: parseFloat(metricas.valor_logrado || 0),
                    porcentaje_cantidad: parseFloat(metricas.porcentaje_cantidad || 0),
                    porcentaje_valor: parseFloat(metricas.porcentaje_valor || 0)
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error en reporte dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// 🆕 Reporte resumen específico - NUEVA RUTA FALTANTE
router.get('/reportes/resumen', authenticateToken, requireVentasReports, async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, asesor_id } = req.query;
        const targetAsesor = asesor_id || req.user.id;
        
        // Fechas por defecto (último mes)
        const fechaDesde = fecha_desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const fechaHasta = fecha_hasta || new Date().toISOString();

        const { query } = require('../../../config/database');
        
        const resumenData = await query(`
            WITH resumen_estados AS (
                SELECT 
                    estado,
                    COUNT(*) as cantidad,
                    SUM(valor_final) as valor_total,
                    AVG(valor_final) as valor_promedio,
                    MIN(valor_final) as valor_minimo,
                    MAX(valor_final) as valor_maximo
                FROM ventas 
                WHERE asesor_id = $1 
                AND fecha_creacion BETWEEN $2 AND $3
                AND activo = true
                GROUP BY estado
            ),
            resumen_fases AS (
                SELECT 
                    fase,
                    COUNT(*) as cantidad_fase,
                    SUM(valor_final) as valor_fase,
                    AVG(probabilidad_cierre) as probabilidad_promedio
                FROM ventas 
                WHERE asesor_id = $1 
                AND fecha_creacion BETWEEN $2 AND $3
                AND activo = true
                AND estado NOT IN ('Completada', 'Cancelada')
                GROUP BY fase
            ),
            totales AS (
                SELECT 
                    COUNT(*) as total_general,
                    SUM(valor_final) as valor_general,
                    COUNT(CASE WHEN estado = 'Completada' THEN 1 END) as total_completadas
                FROM ventas 
                WHERE asesor_id = $1 
                AND fecha_creacion BETWEEN $2 AND $3
                AND activo = true
            )
            SELECT 
                (SELECT json_agg(resumen_estados) FROM resumen_estados) as por_estado,
                (SELECT json_agg(resumen_fases) FROM resumen_fases) as por_fase,
                (SELECT row_to_json(totales) FROM totales) as totales
        `, [targetAsesor, fechaDesde, fechaHasta]);

        const resultado = resumenData.rows[0] || {};

        res.json({
            success: true,
            data: {
                asesor_id: targetAsesor,
                periodo: { 
                    desde: fechaDesde, 
                    hasta: fechaHasta 
                },
                resumen_por_estado: resultado.por_estado || [],
                resumen_por_fase: resultado.por_fase || [],
                totales_generales: resultado.totales || {
                    total_general: 0,
                    valor_general: 0,
                    total_completadas: 0
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error en reporte resumen:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Reporte de productos más vendidos
router.get('/reportes/productos-top', authenticateToken, requireVentasReports, async (req, res) => {
    try {
        const { limit = 10, fecha_desde, fecha_hasta } = req.query;

        let whereClause = 'WHERE v.activo = true AND v.estado = \'Completada\'';
        const params = [];

        if (fecha_desde) {
            params.push(fecha_desde);
            whereClause += ` AND v.fecha_creacion >= $${params.length}`;
        }

        if (fecha_hasta) {
            params.push(fecha_hasta + ' 23:59:59');
            whereClause += ` AND v.fecha_creacion <= $${params.length}`;
        }

        params.push(parseInt(limit));

        const { query } = require('../../../config/database');
        const productosResult = await query(`
SELECT 
    p.id, p.descripcion as nombre, p.categoria_id as categoria, p.marca,
    COUNT(vd.id) as veces_vendido,
    SUM(vd.cantidad) as cantidad_total,
    SUM(vd.total_linea) as ingresos_generados,
    AVG(vd.precio_unitario) as precio_promedio
FROM productos p
JOIN venta_detalles vd ON p.id = vd.producto_id
JOIN ventas v ON vd.venta_id = v.id
${whereClause}
GROUP BY p.id, p.descripcion, p.categoria_id, p.marca
ORDER BY ingresos_generados DESC
LIMIT $${params.length}
        `, params);

        res.json({
            success: true,
            data: {
                productos_top: productosResult.rows,
                total: productosResult.rows.length
            }
        });

    } catch (error) {
        console.error('Error en reporte de productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// BÚSQUEDAS Y FILTROS AVANZADOS
// ============================================

// Búsqueda inteligente de ventas
router.get('/buscar/:termino', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { termino } = req.params;
        const { limite = 20 } = req.query;

        // Validar parámetros
        if (!termino || termino.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'El término de búsqueda debe tener al menos 2 caracteres'
            });
        }

        const terminoBusqueda = termino.trim();
        const limiteBusqueda = Math.min(parseInt(limite) || 20, 100); // Máximo 100 resultados

        const { query } = require('../../../config/database');
        const searchResult = await query(`
            SELECT 
                v.*,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as asesor_nombre_completo,
                u.nombre as asesor_nombre, 
                u.apellido as asesor_apellido,
                CONCAT(p.nombre_cliente, ' ', COALESCE(p.apellido_cliente, '')) as prospecto_nombre
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            LEFT JOIN prospectos p ON v.prospecto_id = p.id
            WHERE v.activo = true
AND (
    v.codigo ILIKE $1 OR
    v.nombre_cliente ILIKE $1 OR
    v.cliente_empresa ILIKE $1 OR
    v.cliente_email ILIKE $1 OR
    (u.nombre ILIKE $1 OR u.apellido ILIKE $1) OR
    (p.nombre_cliente ILIKE $1 OR p.apellido_cliente ILIKE $1)
)
            ORDER BY v.fecha_creacion DESC
            LIMIT $2
        `, [`%${terminoBusqueda}%`, limiteBusqueda]);

        res.json({
            success: true,
            data: {
                resultados: searchResult.rows,
                total: searchResult.rows.length,
                termino_busqueda: terminoBusqueda,
                limite_aplicado: limiteBusqueda
            }
        });

    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Búsqueda avanzada con múltiples filtros
router.post('/busqueda-avanzada', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const {
            termino,
            estado,
            fase,
            fecha_desde,
            fecha_hasta,
            valor_minimo,
            valor_maximo,
            asesor_id,
            limite = 50
        } = req.body;

        let whereClause = 'WHERE v.activo = true';
        const params = [];
        let paramCount = 0;

        // Construir WHERE dinámico
        if (termino && termino.trim().length >= 2) {
            paramCount++;
            whereClause += ` AND (
                v.codigo ILIKE $${paramCount} OR
                v.cliente_nombre ILIKE $${paramCount} OR
                v.cliente_empresa ILIKE $${paramCount} OR
                v.cliente_email ILIKE $${paramCount}
            )`;
            params.push(`%${termino.trim()}%`);
        }

        if (estado) {
            paramCount++;
            whereClause += ` AND v.estado = $${paramCount}`;
            params.push(estado);
        }

        if (fase) {
            paramCount++;
            whereClause += ` AND v.fase = $${paramCount}`;
            params.push(fase);
        }

        if (fecha_desde) {
            paramCount++;
            whereClause += ` AND v.fecha_creacion >= $${paramCount}`;
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            paramCount++;
            whereClause += ` AND v.fecha_creacion <= $${paramCount}`;
            params.push(fecha_hasta + ' 23:59:59');
        }

        if (valor_minimo) {
            paramCount++;
            whereClause += ` AND v.valor_final >= $${paramCount}`;
            params.push(parseFloat(valor_minimo));
        }

        if (valor_maximo) {
            paramCount++;
            whereClause += ` AND v.valor_final <= $${paramCount}`;
            params.push(parseFloat(valor_maximo));
        }

        if (asesor_id) {
            paramCount++;
            whereClause += ` AND v.asesor_id = $${paramCount}`;
            params.push(parseInt(asesor_id));
        }

        paramCount++;
        params.push(Math.min(parseInt(limite), 100));

        const { query } = require('../../../config/database');
        const searchResult = await query(`
            SELECT 
                v.*,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as asesor_nombre_completo,
                CONCAT(p.nombre_cliente, ' ', COALESCE(p.apellido_cliente, '')) as prospecto_nombre
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            LEFT JOIN prospectos p ON v.prospecto_id = p.id
            ${whereClause}
            ORDER BY v.fecha_creacion DESC
            LIMIT $${paramCount}
        `, params);

        res.json({
            success: true,
            data: {
                resultados: searchResult.rows,
                total: searchResult.rows.length,
                filtros_aplicados: {
                    termino: termino || null,
                    estado,
                    fase,
                    fecha_desde,
                    fecha_hasta,
                    valor_minimo,
                    valor_maximo,
                    asesor_id
                }
            }
        });

    } catch (error) {
        console.error('Error en búsqueda avanzada:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// CONVERSIÓN DE PROSPECTOS
// ============================================

// Convertir prospecto individual
router.post('/convertir-prospecto/:prospecto_id', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { prospecto_id } = req.params;
        const { valor_estimado, notas } = req.body;

        // Validar que prospecto_id sea un número válido
        const prospectoIdNum = parseInt(prospecto_id);
        if (isNaN(prospectoIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'ID de prospecto inválido'
            });
        }

        const config = {
            prospecto_id: prospectoIdNum,
            asesor_id: req.user.id,
            fuente: 'conversion_manual',
            valor_estimado: valor_estimado
        };

        const resultado = await ConversionService.convertirProspectoAVenta(config);

        if (resultado.success) {
            res.json({
                success: true,
                message: 'Prospecto convertido exitosamente',
                data: resultado.venta_creada
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Error al convertir prospecto',
                error: resultado.error
            });
        }

    } catch (error) {
        console.error('Error en conversión:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Conversión masiva de prospectos
router.post('/conversion-masiva', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { prospectos } = req.body; // Array de {prospecto_id, valor_estimado}
        
        if (!Array.isArray(prospectos) || prospectos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de prospectos'
            });
        }

        // Validar que todos los prospectos tengan la estructura correcta
        const prospectos_validos = prospectos.every(p => 
            p.prospecto_id && !isNaN(parseInt(p.prospecto_id))
        );

        if (!prospectos_validos) {
            return res.status(400).json({
                success: false,
                message: 'Algunos prospectos tienen ID inválido'
            });
        }

        const resultados = await ConversionService.convertirProspectosMasivo(prospectos, req.user.id);

        res.json({
            success: true,
            message: `Conversión masiva completada: ${resultados.exitosas.length} éxitos, ${resultados.fallidas.length} fallos`,
            data: resultados
        });

    } catch (error) {
        console.error('Error en conversión masiva:', error);
        res.status(500).json({
            success: false,
            message: 'Error en conversión masiva'
        });
    }
});

// ============================================
// RUTAS DE CLIENTES INTEGRADAS - DEBEN IR ANTES DE RUTAS CON PARÁMETROS
// ============================================

/**
 * GET /api/ventas/clientes
 * Obtener todos los clientes con filtros
 */
router.get('/clientes', (req, res, next) => {
  console.log('🔍 DEBUGGING: Ruta /clientes interceptada correctamente');
  console.log('🔍 Method:', req.method);
  console.log('🔍 Path:', req.path);
  console.log('🔍 Params:', req.params);
  next();
}, authenticateToken, ClientesController.obtenerTodos);

/**
 * POST /api/ventas/clientes
 * Crear nuevo cliente
 */
router.post('/clientes', authenticateToken, requireVentasWrite, ClientesController.crear);

/**
 * GET /api/ventas/clientes/estadisticas
 * Obtener estadísticas de clientes
 */
router.get('/clientes/estadisticas', authenticateToken, requireVentasAccess, ClientesController.obtenerEstadisticas);

/**
 * GET /api/ventas/clientes/health
 * Health check del servicio de clientes
 */
router.get('/clientes/health', authenticateToken, requireVentasAccess, ClientesController.healthCheck);

/**
 * GET /api/ventas/clientes/autocomplete
 * Autocompletado para formularios
 */
router.get('/clientes/autocomplete', authenticateToken, requireVentasAccess, ClientesController.autocomplete);

/**
 * GET /api/ventas/clientes/buscar/:documento
 * Buscar cliente por documento
 */
router.get('/clientes/buscar/:documento', authenticateToken, requireVentasAccess, ClientesController.buscarPorDocumento);

/**
 * GET /api/ventas/clientes/:id
 * Obtener cliente por ID
 */
router.get('/clientes/:id', authenticateToken, requireVentasAccess, ClientesController.obtenerPorId);

/**
 * PUT /api/ventas/clientes/:id
 * Actualizar cliente
 */
router.put('/clientes/:id', authenticateToken, requireVentasWrite, ClientesController.actualizar);

/**
 * DELETE /api/ventas/clientes/:id
 * Eliminar cliente (soft delete) - Solo jefes y ejecutivos
 */
router.delete('/clientes/:id', authenticateToken, requireRole(PERMISOS_OPERACION.ELIMINACION.VENTAS), ClientesController.eliminar);


// ============================================
// RUTAS ESPECÍFICAS (SIN PARÁMETROS) - DEBEN IR PRIMERO
// ============================================

// 👥 Obtener lista de asesores para filtros
router.get('/asesores', authenticateToken, requireVentasAccess, VentasController.obtenerAsesores);

// 📊 Exportar ventas con filtros
router.get('/exportar', authenticateToken, requireVentasAccess, VentasController.exportarVentas);

// ============================================
// RUTAS PRINCIPALES DE VENTAS (CON PARÁMETROS)
// ============================================

// CRUD Básico - ESTAS DEBEN IR DESPUÉS DE RUTAS ESPECÍFICAS
router.get('/', authenticateToken, requireVentasAccess, VentasController.listarVentas);
router.post('/', authenticateToken, requireVentasWrite, VentasController.crearVenta);
router.get('/:id', authenticateToken, requireVentasAccess, VentasController.obtenerVenta);
router.put('/:id', authenticateToken, requireVentasWrite, VentasController.actualizarVenta);
// Solo jefes y ejecutivos pueden eliminar ventas
router.delete('/:id', authenticateToken, requireRole(PERMISOS_OPERACION.ELIMINACION.VENTAS), VentasController.eliminarVenta);

// ============================================
// GESTIÓN DE ESTADOS (CON PARÁMETROS)
// ============================================

// Cambiar estado de venta
router.put('/:id/estado', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevo_estado_detallado, notas } = req.body;

        // Validaciones básicas de integridad
        const { query } = require('../../../config/database');
        
        const ventaResult = await query(
            'SELECT id, estado_detallado, activo FROM ventas WHERE id = $1',
            [id]
        );

        if (ventaResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        const venta = ventaResult.rows[0];

        if (!venta.activo) {
            return res.status(400).json({
                success: false,
                message: 'No se puede modificar una venta inactiva'
            });
        }

        // Ejecutar cambio de estado
        await VentasController.cambiarEstado(req, res);

    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Avanzar fase de venta
router.put('/:id/fase', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { id } = req.params;
        const { nueva_fase, probabilidad } = req.body;

        const fasesValidas = ['Negociacion', 'Propuesta', 'Cierre', 'Ejecucion', 'Entrega'];
        
        if (!fasesValidas.includes(nueva_fase)) {
            return res.status(400).json({
                success: false,
                message: 'Fase no válida',
                fases_validas: fasesValidas
            });
        }

        const { query } = require('../../../config/database');
        const result = await query(`
            UPDATE ventas 
            SET fase = $1, probabilidad_cierre = $2, updated_at = NOW(), updated_by = $3
            WHERE id = $4 AND activo = true
            RETURNING *
        `, [nueva_fase, probabilidad || null, req.user.id, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        res.json({
            success: true,
            message: `Fase actualizada a "${nueva_fase}"`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error al cambiar fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar fase'
        });
    }
});

// Aprobar venta
router.post('/:id/aprobar', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { id } = req.params;
        const { notas_aprobacion } = req.body;

        // Cambiar estado a 'Aprobada'
        req.body = { nuevo_estado: 'Aprobada', notas: notas_aprobacion };
        await VentasController.cambiarEstado(req, res);

    } catch (error) {
        console.error('Error al aprobar venta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al aprobar venta'
        });
    }
});

// ============================================
// DETALLES DE VENTA Y PRODUCTOS
// ============================================

// Obtener detalles de productos de una venta
router.get('/:id/detalles', authenticateToken, requireVentasAccess, async (req, res) => {
    try {
        const { id } = req.params;

        // Validar que el ID sea un número válido
        const ventaId = parseInt(id);
        if (isNaN(ventaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta inválido'
            });
        }

        const { query } = require('../../../config/database');
const detallesResult = await query(`
SELECT 
    vd.*,
    p.codigo,
    p.descripcion as producto_nombre,
    p.descripcion as producto_descripcion,
    c.nombre as categoria,
    p.marca,
    p.unidad_medida,
    p.precio_sin_igv as precio_actual_producto
FROM venta_detalles vd
JOIN productos p ON vd.producto_id = p.id
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE vd.venta_id = $1
ORDER BY vd.orden_linea
`, [ventaId]);

        res.json({
            success: true,
            data: detallesResult.rows
        });

    } catch (error) {
        console.error('Error al obtener detalles:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Agregar producto a venta existente
router.post('/:id/productos', authenticateToken, requireVentasWrite, async (req, res) => {
    try {
        const { id } = req.params;
        const { producto_id, cantidad, precio_unitario, descripcion_personalizada } = req.body;

        // Validaciones mejoradas
        const ventaId = parseInt(id);
        if (isNaN(ventaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta inválido'
            });
        }

        if (!producto_id || !cantidad || !precio_unitario) {
            return res.status(400).json({
                success: false,
                message: 'Datos requeridos: producto_id, cantidad, precio_unitario'
            });
        }

        if (cantidad <= 0 || precio_unitario <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Cantidad y precio deben ser mayores a 0'
            });
        }

        const { query } = require('../../../config/database');

        // Verificar que la venta existe y está activa
        const ventaResult = await query(`
            SELECT id, estado FROM ventas WHERE id = $1 AND activo = true
        `, [ventaId]);

        if (ventaResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        if (['Completada', 'Cancelada', 'Facturada'].includes(ventaResult.rows[0].estado)) {
            return res.status(400).json({
                success: false,
                message: 'No se pueden agregar productos a una venta en estado ' + ventaResult.rows[0].estado
            });
        }

        // Verificar que el producto existe
        const productoResult = await query(`
            SELECT id, nombre FROM productos WHERE id = $1 AND activo = true
        `, [producto_id]);

        if (productoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        // Calcular totales
        const subtotal = cantidad * precio_unitario;
        const total_linea = subtotal; // Sin descuentos por ahora

        // Obtener próximo orden_linea
        const ordenResult = await query(`
            SELECT COALESCE(MAX(orden_linea), 0) + 1 as siguiente_orden
            FROM venta_detalles WHERE venta_id = $1
        `, [ventaId]);

        const siguiente_orden = ordenResult.rows[0].siguiente_orden;

        // Iniciar transacción
        await query('BEGIN');

        try {
            // Insertar nuevo detalle
            const detalleResult = await query(`
                INSERT INTO venta_detalles (
                    venta_id, producto_id, cantidad, precio_unitario, subtotal,
                    total_linea, descripcion_personalizada, orden_linea
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [ventaId, producto_id, cantidad, precio_unitario, subtotal, total_linea, descripcion_personalizada, siguiente_orden]);

            // Recalcular total de la venta
            const totalResult = await query(`
                SELECT SUM(total_linea) as nuevo_total
                FROM venta_detalles WHERE venta_id = $1
            `, [ventaId]);

            const nuevo_total = totalResult.rows[0].nuevo_total;

            // Actualizar venta
            await query(`
                UPDATE ventas 
                SET valor_total = $1, valor_final = $1, updated_at = NOW(), updated_by = $2
                WHERE id = $3
            `, [nuevo_total, req.user.id, ventaId]);

            await query('COMMIT');

            res.json({
                success: true,
                message: 'Producto agregado exitosamente',
                data: {
                    detalle_agregado: detalleResult.rows[0],
                    nuevo_total_venta: parseFloat(nuevo_total),
                    producto_nombre: productoResult.rows[0].nombre
                }
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error al agregar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// EXPORTAR EL ROUTER - LÍNEA CRÍTICA
// ============================================

module.exports = router;

console.log('✅ VentasRoutes loaded successfully - Enterprise version with CORRELATIVO SYSTEM ready');