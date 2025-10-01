// ============================================
// METAS ROUTES - DASHBOARD Y CONFIGURACI�N
// Sistema CRM/ERP v2.0 - M�dulo de Metas
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const MetasActividadController = require('../controllers/MetasActividadController');
const MetasVentasController = require('../controllers/MetasVentasController');

// Middleware de autenticaci�n
const { authenticateToken } = require('../../../middleware/auth');

// ============================================
// RUTAS DE DASHBOARD DE METAS
// ============================================

/**
 * @route   GET /api/metas/dashboard
 * @desc    Dashboard de metas por asesor
 * @access  Private
 * @params  asesor_id (query), periodo (query)
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const { asesor_id, periodo = 'mes_actual' } = req.query;
        const userId = req.user.id || req.user.user_id;
        const userRole = req.user.rol_id || req.user.role_id;

        console.log('=� Dashboard metas solicitado:', { asesor_id, periodo, userId, userRole });

        // Validar par�metros
        if (!asesor_id) {
            return res.status(400).json({
                success: false,
                message: 'El par�metro asesor_id es requerido'
            });
        }

        // Control de acceso
        const asesorIdNum = parseInt(asesor_id);
        const userIdNum = parseInt(userId);
        const isOwner = asesorIdNum === userIdNum;

        // Roles con acceso al módulo de ventas (solo área ventas + administrativos)
        const rolesVentasAutorizados = [
            1,  // SUPER_ADMIN
            2,  // GERENTE
            3,  // JEFE_VENTAS
            7,  // VENDEDOR
            11  // ADMIN
        ];

        // Supervisores que pueden ver dashboards de otros usuarios en ventas
        const rolesSupervisoresVentas = [1, 2, 3, 11]; // Sin vendedores
        // Verificar acceso al módulo de ventas
        if (!rolesVentasAutorizados.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Sin permisos para acceder al módulo de ventas'
            });
        }

        const isSupervisor = rolesSupervisoresVentas.includes(userRole) || req.user.es_jefe;

        if (!isOwner && !isSupervisor) {
            return res.status(403).json({
                success: false,
                message: 'Sin permisos para ver las metas de este asesor'
            });
        }

        // Obtener informaci�n del asesor
        const { query } = require('../../../config/database');

        const asesorInfo = await query(`
            SELECT id, nombre, apellido, rol_id, es_jefe, activo
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

        // Calcular fechas seg�n per�odo
        const hoy = new Date();
        let desde, hasta;

        switch (periodo) {
            case 'mes_actual':
                desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                hasta = hoy;
                break;
            case 'mes_anterior':
                desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                break;
            case 'trimestre_actual':
                const mesActual = hoy.getMonth();
                desde = new Date(hoy.getFullYear(), Math.floor(mesActual / 3) * 3, 1);
                hasta = hoy;
                break;
            default:
                desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                hasta = hoy;
        }

        // Obtener metas de ventas del per�odo
        const metasVentas = await query(`
            SELECT
                mv.*,
                mv.porcentaje_valor as porcentaje_cumplimiento
            FROM metas_ventas mv
            WHERE mv.asesor_id = $1
            AND mv.año = $2
            AND mv.mes = $3
            AND mv.activo = true
        `, [asesor_id, desde.getFullYear(), desde.getMonth() + 1]);
        /* const metasVentas = await query(`
            SELECT
                mv.*,
                ROUND((mv.valor_logrado::numeric / NULLIF(mv.meta_valor, 0)::numeric) * 100, 2) as porcentaje_cumplimiento
            FROM metas_ventas mv
            WHERE mv.asesor_id = $1
            AND mv.a�o = $2
            AND mv.mes = $3
            AND mv.activo = true
        `, [asesor_id, desde.getFullYear(), desde.getMonth() + 1]); */

        // Obtener ventas reales del per�odo
        const ventasReales = await query(`
            SELECT
                COUNT(*) as total_ventas,
                COALESCE(SUM(valor_final), 0) as valor_total,
                COALESCE(AVG(valor_final), 0) as ticket_promedio,
                COUNT(DISTINCT cliente_empresa) as clientes_unicos
            FROM ventas
            WHERE asesor_id = $1
            AND estado_detallado = 'vendido'
            AND fecha_venta >= $2
            AND fecha_venta <= $3
            AND activo = true
        `, [asesor_id, desde, hasta]);

        // Obtener actividad diaria si existe
        const actividadDiaria = await query(`
            SELECT
                COALESCE(SUM(total_mensajes_recibidos), 0) as total_mensajes,
                COALESCE(SUM(total_llamadas), 0) as total_llamadas,
                COUNT(*) as dias_activos,
                ROUND(AVG(total_mensajes_recibidos), 2) as promedio_mensajes_dia,
                ROUND(AVG(total_llamadas), 2) as promedio_llamadas_dia
            FROM actividad_diaria
            WHERE usuario_id = $1
            AND fecha >= $2
            AND fecha <= $3
        `, [asesor_id, desde, hasta]);

        const metas = metasVentas.rows[0] || {
            meta_valor: 0,
            valor_logrado: 0,
            porcentaje_cumplimiento: 0,
            ventas_logradas: 0
        };

        const ventas = ventasReales.rows[0];
        const actividad = actividadDiaria.rows[0];

        // Calcular m�tricas adicionales
        const diasTranscurridos = Math.ceil((hoy - desde) / (1000 * 60 * 60 * 24));
        const diasDelMes = new Date(desde.getFullYear(), desde.getMonth() + 1, 0).getDate();
        const porcentajeMesTranscurrido = (diasTranscurridos / diasDelMes) * 100;

        const respuesta = {
            success: true,
            data: {
                asesor: {
                    id: asesor.id,
                    nombre: `${asesor.nombre} ${asesor.apellido}`,
                    es_jefe: asesor.es_jefe
                },
                periodo: {
                    tipo: periodo,
                    desde: desde.toISOString().split('T')[0],
                    hasta: hasta.toISOString().split('T')[0],
                    dias_transcurridos: diasTranscurridos,
                    porcentaje_mes: Math.round(porcentajeMesTranscurrido)
                },
                metas: {
                    meta_valor: parseFloat(metas.meta_valor) || 0,
                    valor_logrado: parseFloat(metas.valor_logrado) || 0,
                    porcentaje_cumplimiento: parseFloat(metas.porcentaje_cumplimiento) || 0,
                    meta_cantidad: parseInt(metas.meta_cantidad) || 0,
                    ventas_logradas: parseInt(metas.ventas_logradas) || 0
                },
                ventas_reales: {
                    total_ventas: parseInt(ventas.total_ventas) || 0,
                    valor_total: parseFloat(ventas.valor_total) || 0,
                    ticket_promedio: parseFloat(ventas.ticket_promedio) || 0,
                    clientes_unicos: parseInt(ventas.clientes_unicos) || 0
                },
                actividad: {
                    total_mensajes: parseInt(actividad.total_mensajes) || 0,
                    total_llamadas: parseInt(actividad.total_llamadas) || 0,
                    dias_activos: parseInt(actividad.dias_activos) || 0,
                    promedio_mensajes_dia: parseFloat(actividad.promedio_mensajes_dia) || 0,
                    promedio_llamadas_dia: parseFloat(actividad.promedio_llamadas_dia) || 0
                },
                indicadores: {
                    ritmo_necesario: metas.meta_valor > 0 ?
                        Math.round((metas.meta_valor - metas.valor_logrado) / (diasDelMes - diasTranscurridos)) : 0,
                    proyeccion_mes: ventas.valor_total > 0 ?
                        Math.round((ventas.valor_total / diasTranscurridos) * diasDelMes) : 0
                }
            }
        };

        console.log(` Dashboard metas generado para ${asesor.nombre} ${asesor.apellido}`);
        res.json(respuesta);

    } catch (error) {
        console.error('L Error en dashboard metas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// ============================================
// OTRAS RUTAS DE METAS
// ============================================

/**
 * @route   GET /api/metas/tipos
 * @desc    Listar tipos de meta actividad
 * @access  Private
 */
router.get('/tipos', authenticateToken, MetasActividadController.listarTiposMetaActividad);

/**
 * @route   POST /api/metas/configurar
 * @desc    Configurar meta actividad (solo supervisores)
 * @access  Private
 */
router.post('/configurar', authenticateToken, MetasActividadController.configurarMetaActividad);

/**
 * @route   GET /api/metas/asesor/:asesor_id
 * @desc    Obtener configuraci�n de metas del asesor
 * @access  Private
 */
router.get('/asesor/:asesor_id', authenticateToken, MetasActividadController.obtenerConfiguracionAsesor);

/**
 * @route   GET /api/metas/modalidades
 * @desc    Obtener modalidades de bono disponibles
 * @access  Private
 */
router.get('/modalidades', authenticateToken, MetasActividadController.obtenerModalidadesDisponibles);

/**
 * @route   GET /api/metas/equipo/dashboard
 * @desc    Dashboard de actividad por equipo (solo supervisores)
 * @access  Private
 */
router.get('/equipo/dashboard', authenticateToken, MetasActividadController.dashboardActividadEquipo);

// ============================================
// RUTAS DE METAS DE VENTAS (NUEVO SISTEMA)
// ============================================

/**
 * @route   POST /api/metas/ventas/configurar
 * @desc    Configurar meta de ventas para asesor (solo supervisores)
 * @access  Private
 * @body    asesor_id, año, mes, meta_valor, meta_cantidad, observaciones
 */
router.post('/ventas/configurar', authenticateToken, MetasVentasController.configurarMetaVentas);

/**
 * @route   POST /api/metas/ventas/automaticas
 * @desc    Crear metas automáticas por defecto (2500→8000) (solo supervisores)
 * @access  Private
 * @body    periodo, forzar
 */
router.post('/ventas/automaticas', authenticateToken, MetasVentasController.crearMetasAutomaticas);

/**
 * @route   GET /api/metas/ventas/configurables
 * @desc    Listar asesores y sus metas para configuración (solo supervisores)
 * @access  Private
 * @query   año, mes, incluir_historico
 */
router.get('/ventas/configurables', authenticateToken, MetasVentasController.listarMetasConfigurables);

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'M�dulo de metas funcionando correctamente',
        version: '1.0.0',
        endpoints: [
            'GET /api/metas/dashboard',
            'GET /api/metas/tipos',
            'POST /api/metas/configurar',
            'GET /api/metas/asesor/:asesor_id',
            'GET /api/metas/modalidades',
            'GET /api/metas/equipo/dashboard',
            'POST /api/metas/ventas/configurar',
            'POST /api/metas/ventas/automaticas',
            'GET /api/metas/ventas/configurables'
        ],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

console.log(' Metas Routes loaded - Dashboard y configuraci�n de metas');
console.log('=� Endpoints principales:');
console.log('   - GET /api/metas/dashboard (con control de acceso)');
console.log('   - GET /api/metas/tipos');
console.log('   - GET /api/metas/asesor/:asesor_id');
console.log('   - GET /api/metas/equipo/dashboard (supervisores)');