// ============================================
// DASHBOARDS ROUTES - VERSIÓN FINAL SIN FLUJO OPERATIVO
// Sistema CRM/ERP v2.0 - Solo dashboards que decidimos mantener
// Ubicación: src/modules/ventas/routes/dashboardsRoutes.js
// ============================================

const express = require('express');
const router = express.Router();

// Middleware de autenticación
const { authenticateToken, requireRole } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Módulo de dashboards funcionando',
        version: '2.0.0 - FINAL',
        dashboards_disponibles: [
            'maestro', 'geografico', 'abc-productos'
        ],
        dashboards_principales: 'Usar /api/dashboard-ejecutivo/ para sistema completo',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// DASHBOARD MAESTRO - SIMPLIFICADO
// ============================================

router.get('/maestro', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), async (req, res) => {
    try {
        const { query } = require('../../../config/database');
        const userId = req.user.id;
        const userRole = req.user.rol;

        console.log(`Dashboard maestro para usuario: ${userId}`);

        // Consulta simplificada solo con datos básicos
        const ventasData = await query(`
            SELECT 
                COUNT(*) as total_ventas,
                COUNT(CASE WHEN estado_detallado LIKE 'vendido%' THEN 1 END) as ventas_completadas,
                COALESCE(SUM(valor_final), 0) as ingresos_totales,
                COALESCE(AVG(valor_final), 0) as ticket_promedio
            FROM ventas 
            WHERE asesor_id = $1 AND activo = true 
            AND fecha_venta >= date_trunc('month', CURRENT_DATE)
        `, [userId]);

        const dashboardMaestro = {
            usuario: {
                id: userId,
                rol: userRole,
                fecha_consulta: new Date().toISOString()
            },
            resumen_ejecutivo: {
                ventas: {
                    total: parseInt(ventasData.rows[0]?.total_ventas || 0),
                    completadas: parseInt(ventasData.rows[0]?.ventas_completadas || 0),
                    ingresos: parseFloat(ventasData.rows[0]?.ingresos_totales || 0),
                    ticket_promedio: parseFloat(ventasData.rows[0]?.ticket_promedio || 0)
                }
            },
            dashboards_principales: {
                sistema_completo: `/api/dashboard-ejecutivo/vista-unificada`,
                personal: `/api/dashboard/personal/${userId}`,
                metas: `/api/metas/dashboard?asesor_id=${userId}`
            },
            periodo_analisis: 'Mes actual'
        };

        res.json({
            success: true,
            message: 'Dashboard maestro - Use /api/dashboard-ejecutivo/ para sistema completo',
            data: dashboardMaestro
        });

    } catch (error) {
        console.error('Error en dashboard maestro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// ============================================
// REDIRECCIONES AL SISTEMA PRINCIPAL
// ============================================

router.get('/geografico', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), (req, res) => {
    res.json({
        success: true,
        message: 'Redirigir al sistema principal',
        redirect: '/api/dashboard-ejecutivo/analisis-geografico',
        info: 'Este dashboard está en el sistema ejecutivo principal'
    });
});

router.get('/abc-productos', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), (req, res) => {
    res.json({
        success: true,
        message: 'Redirigir al sistema principal', 
        redirect: '/api/dashboard-ejecutivo/abc-productos',
        info: 'Este dashboard está en el sistema ejecutivo principal'
    });
});

// ============================================
// ÍNDICE PRINCIPAL
// ============================================

router.get('/', authenticateToken, requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.rol || '';
    const esAdmin = ['admin', 'manager', 'supervisor'].includes(userRole.toLowerCase());
    
    res.json({
        success: true,
        message: 'Índice de dashboards - Sistema dividido',
        data: {
            dashboard_maestro: `/api/dashboards/maestro`,
            
            sistema_ejecutivo_completo: {
                vista_unificada: `/api/dashboard-ejecutivo/vista-unificada`,
                metas_avanzado: `/api/dashboard-ejecutivo/metas-avanzado`,  
                sectores_strategy: `/api/dashboard-ejecutivo/sectores-strategy`,
                abc_productos: `/api/dashboard-ejecutivo/abc-productos`,
                analisis_geografico: `/api/dashboard-ejecutivo/analisis-geografico`
            },
            
            dashboards_personales: {
                mi_dashboard: `/api/dashboard/personal/${userId}`,
                mis_metas: `/api/metas/dashboard?asesor_id=${userId}`
            },
            
            usuario: {
                id: userId,
                rol: userRole,
                tiene_acceso_ejecutivo: esAdmin
            },
            
            recomendacion: 'Usar /api/dashboard-ejecutivo/ para dashboards ejecutivos completos'
        }
    });
});

module.exports = router;

console.log('DashboardsRoutes - VERSIÓN FINAL SIMPLIFICADA');
console.log('- Dashboard Maestro: datos básicos');
console.log('- Redirecciones al sistema ejecutivo principal');  
console.log('- SIN Flujo Operativo (eliminado como se pidió)');
console.log('- Sistema principal: /api/dashboard-ejecutivo/\n');