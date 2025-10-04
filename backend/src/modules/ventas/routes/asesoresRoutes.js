// ============================================
// ASESORES ROUTES - GESTIÓN DE ASESORES PARA SUPERVISIÓN
// Sistema CRM/ERP v2.0 - Módulo de Asesores
// ============================================

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Middleware de autenticación
const { authenticateToken, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// ENDPOINT: LISTA DE ASESORES SUPERVISABLES
// ============================================

/**
 * @route   GET /api/asesores/supervisables
 * @desc    Obtener lista de asesores que el usuario puede supervisar
 * @access  Private (Solo supervisores)
 * @logic   - Supervisores pueden ver todos los asesores de ventas
 *          - Jefes de área pueden ver solo su equipo
 */
router.get('/supervisables', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), async (req, res) => {
    try {
        const userId = req.user.id || req.user.user_id;
        const userRole = req.user.rol_id || req.user.role_id;
        const esJefe = req.user.es_jefe || false;

        console.log('🔍 Consultando asesores supervisables:', { userId, userRole, esJefe });

        // Roles con capacidad de supervisión
        const rolesSupervisores = [1, 2, 3, 11]; // SUPER_ADMIN, GERENTE, JEFE_VENTAS, ADMIN

        // Verificar permisos de supervisión
        if (!rolesSupervisores.includes(userRole) && !esJefe) {
            return res.status(403).json({
                success: false,
                message: 'Sin permisos para supervisar asesores'
            });
        }

        let whereCondition = 'u.activo = true AND u.vende = true';
        let queryParams = [];

        // LÓGICA COMPLETA DE JERARQUÍA ORGANIZACIONAL
        if (userRole === 3) {
            // JEFE_VENTAS: Ve todos los vendedores + SUPER_ADMIN (empresa pequeña)
            whereCondition += ` AND (u.vende = true OR u.id = 1)`;
        } else if (esJefe && ![1, 2, 11].includes(userRole)) {
            // Otros jefes: Ve solo su equipo directo
            whereCondition += ` AND u.jefe_id = $1`;
            queryParams.push(userId);
        } else if (userRole === 2) {
            // GERENTE: Ve todos los asesores de ventas (área 1) + SUPER_ADMIN
            whereCondition += ` AND (u.area_id = 1 OR u.id = 1)`;
        }
        // SUPER_ADMIN, ADMIN: Ven todos los asesores sin filtro adicional

        const sqlAsesores = `
            SELECT
                u.id,
                u.nombre,
                u.apellido,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_completo,
                r.nombre as rol_nombre,
                u.rol_id,
                u.vende,
                u.es_jefe,
                u.activo,
                u.area_id,
                a.nombre as area_nombre,
                u.jefe_id,
                CONCAT(jefe.nombre, ' ', jefe.apellido) as jefe_nombre,
                -- Métricas básicas del mes actual
                COALESCE(mv.meta_valor, 0) as meta_mes,
                COALESCE(mv.valor_logrado, 0) as vendido_mes,
                CASE
                    WHEN mv.meta_valor > 0 THEN
                        ROUND((mv.valor_logrado / mv.meta_valor) * 100, 1)
                    ELSE 0
                END as porcentaje_meta
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            LEFT JOIN usuarios jefe ON u.jefe_id = jefe.id
            LEFT JOIN metas_ventas mv ON mv.asesor_id = u.id
                AND mv.año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND mv.mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND mv.activo = true
            WHERE ${whereCondition}
            ORDER BY
                u.area_id,
                CASE u.rol_id
                    WHEN 1 THEN 1  -- SUPER_ADMIN
                    WHEN 11 THEN 2 -- ADMIN
                    WHEN 3 THEN 3  -- JEFE_VENTAS
                    WHEN 7 THEN 4  -- VENDEDOR
                    ELSE 5
                END,
                u.nombre, u.apellido
        `;

        const result = await query(sqlAsesores, queryParams);
        const asesores = result.rows;

        // Estadísticas adicionales para el supervisor
        const sqlStats = `
            SELECT
                COUNT(*) as total_asesores,
                COUNT(CASE WHEN u.vende = true THEN 1 END) as asesores_vendedores,
                COUNT(CASE WHEN mv.valor_logrado > 0 THEN 1 END) as asesores_con_ventas,
                COALESCE(AVG(CASE WHEN mv.meta_valor > 0 THEN (mv.valor_logrado / mv.meta_valor) * 100 END), 0) as promedio_cumplimiento
            FROM usuarios u
            LEFT JOIN metas_ventas mv ON mv.asesor_id = u.id
                AND mv.año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND mv.mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND mv.activo = true
            WHERE ${whereCondition}
        `;

        const statsResult = await query(sqlStats, queryParams);
        const estadisticas = statsResult.rows[0];

        // Procesar datos para respuesta con información jerárquica
        const asesoresFormateados = asesores.map(asesor => ({
            id: asesor.id,
            nombre_completo: asesor.nombre_completo,
            rol: asesor.rol_nombre,
            rol_id: asesor.rol_id,
            vende: asesor.vende,
            es_jefe: asesor.es_jefe,
            area: {
                id: asesor.area_id,
                nombre: asesor.area_nombre
            },
            jefe: {
                id: asesor.jefe_id,
                nombre: asesor.jefe_nombre || 'Sin supervisor'
            },
            metricas: {
                meta_mes: parseFloat(asesor.meta_mes) || 0,
                vendido_mes: parseFloat(asesor.vendido_mes) || 0,
                porcentaje_meta: parseFloat(asesor.porcentaje_meta) || 0,
                estado: asesor.porcentaje_meta >= 100 ? 'cumplida' :
                       asesor.porcentaje_meta >= 80 ? 'en_progreso' : 'rezagada'
            }
        }));

        // Categorizar asesores por área y rol
        const categorizados = {
            por_rol: {
                super_admin: asesoresFormateados.filter(a => a.rol_id === 1),
                admins: asesoresFormateados.filter(a => a.rol_id === 11),
                jefes_ventas: asesoresFormateados.filter(a => a.rol_id === 3),
                vendedores: asesoresFormateados.filter(a => a.rol_id === 7),
                otros: asesoresFormateados.filter(a => ![1, 11, 3, 7].includes(a.rol_id))
            },
            por_area: asesoresFormateados.reduce((acc, asesor) => {
                const areaNombre = asesor.area.nombre || 'Sin área';
                if (!acc[areaNombre]) acc[areaNombre] = [];
                acc[areaNombre].push(asesor);
                return acc;
            }, {}),
            por_jefe: asesoresFormateados.reduce((acc, asesor) => {
                const jefeNombre = asesor.jefe.nombre || 'Sin supervisor';
                if (!acc[jefeNombre]) acc[jefeNombre] = [];
                acc[jefeNombre].push(asesor);
                return acc;
            }, {})
        };

        res.json({
            success: true,
            data: {
                asesores: asesoresFormateados,
                asesores_categorizados: categorizados,
                estadisticas: {
                    total_asesores: parseInt(estadisticas.total_asesores) || 0,
                    asesores_vendedores: parseInt(estadisticas.asesores_vendedores) || 0,
                    asesores_con_ventas: parseInt(estadisticas.asesores_con_ventas) || 0,
                    promedio_cumplimiento: Math.round(parseFloat(estadisticas.promedio_cumplimiento) || 0)
                },
                permisos_usuario: {
                    puede_supervisar: true,
                    rol: userRole,
                    es_jefe: esJefe,
                    puede_ver_todos: [1, 2, 11].includes(userRole),
                    area_id: req.user.area_id,
                    area_nombre: req.user.area_nombre,
                    nivel_acceso: userRole === 1 ? 'total' :
                                 userRole === 2 ? 'area_ventas' :
                                 userRole === 3 ? 'equipo_directo' :
                                 userRole === 11 ? 'total' : 'limitado'
                }
            },
            message: `${asesoresFormateados.length} asesores disponibles para supervisión`
        });

    } catch (error) {
        console.error('❌ Error obteniendo asesores supervisables:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// ============================================
// ENDPOINT: VALIDAR ACCESO A ASESOR ESPECÍFICO
// ============================================

/**
 * @route   GET /api/asesores/validar-acceso/:asesor_id
 * @desc    Validar si el usuario puede supervisar a un asesor específico
 * @access  Private
 */
router.get('/validar-acceso/:asesor_id', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), async (req, res) => {
    try {
        const { asesor_id } = req.params;
        const userId = req.user.id || req.user.user_id;
        const userRole = req.user.rol_id || req.user.role_id;
        const esJefe = req.user.es_jefe || false;

        // Verificar si el asesor existe y está activo
        const asesorInfo = await query(`
            SELECT id, nombre, apellido, rol_id, vende, activo, jefe_id, area_id
            FROM usuarios
            WHERE id = $1 AND activo = true
        `, [asesor_id]);

        if (asesorInfo.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Asesor no encontrado'
            });
        }

        const asesor = asesorInfo.rows[0];

        // Verificar permisos con jerarquía completa
        const rolesSupervisores = [1, 2, 3, 11];
        const isOwner = parseInt(asesor_id) === userId;
        const isSupervisor = rolesSupervisores.includes(userRole) || esJefe;

        // Verificar jerarquía específica
        let jerarquiaPermitida = false;
        if (userRole === 3) {
            // JEFE_VENTAS: Puede ver subordinados directos o de subordinados
            jerarquiaPermitida = asesor.jefe_id === userId;
        } else if (userRole === 2) {
            // GERENTE: Puede ver todos los de área ventas
            jerarquiaPermitida = asesor.area_id === 1;
        } else if ([1, 11].includes(userRole)) {
            // SUPER_ADMIN, ADMIN: Pueden ver todos
            jerarquiaPermitida = true;
        }

        const tieneAcceso = isOwner || (isSupervisor && jerarquiaPermitida);

        res.json({
            success: true,
            data: {
                tiene_acceso: tieneAcceso,
                asesor: {
                    id: asesor.id,
                    nombre_completo: `${asesor.nombre} ${asesor.apellido}`,
                    vende: asesor.vende
                },
                motivo_acceso: isOwner ? 'propietario' :
                              isSupervisor ? 'supervisor' : 'sin_acceso',
                permisos: {
                    es_propietario: isOwner,
                    es_supervisor: isSupervisor,
                    puede_supervision: isSupervisor
                }
            }
        });

    } catch (error) {
        console.error('❌ Error validando acceso a asesor:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Módulo de asesores funcionando correctamente',
        version: '1.0.0',
        endpoints: [
            'GET /api/asesores/supervisables',
            'GET /api/asesores/validar-acceso/:asesor_id'
        ],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

console.log('✅ Asesores Routes loaded - Gestión de supervisión');
console.log('📋 Endpoints principales:');
console.log('   - GET /api/asesores/supervisables (lista de asesores)');
console.log('   - GET /api/asesores/validar-acceso/:id (validación de permisos)');