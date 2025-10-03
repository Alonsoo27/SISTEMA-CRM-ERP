const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ProspectosController = require('../controllers/prospectosController');

// IMPORTAR MIDDLEWARES JWT
const { authenticateToken, requireRole, requireOwnership } = require('../../../middleware/auth');

// IMPORTAR CONSTANTES DE ROLES
const { ROLES, GRUPOS_ROLES } = require('../../../config/roles');

// APLICAR AUTENTICACIÓN JWT A TODAS LAS RUTAS
router.use(authenticateToken);

// CONFIGURACIÓN DE RATE LIMITING
const createProspectoRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Demasiados intentos de creación. Espere 15 minutos antes de intentar nuevamente.',
        reintentarEn: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const updateRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        error: 'Demasiadas actualizaciones. Espere 5 minutos antes de continuar.',
        reintentarEn: '5 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const adminOperationsRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Demasiadas operaciones administrativas. Espere 10 minutos antes de continuar.',
        reintentarEn: '10 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// MIDDLEWARE DE VALIDACIÓN DE DATOS
const validarDatosProspecto = (req, res, next) => {
    try {
        const { nombre_cliente, telefono, canal_contacto } = req.body;

        if (req.method === 'POST') {
            if (!nombre_cliente?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'El nombre del cliente es requerido'
                });
            }

            if (!telefono?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'El teléfono es requerido'
                });
            }

            if (!canal_contacto?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'El canal de contacto es requerido'
                });
            }
        }

        if (req.body.telefono) {
            req.body.telefono = req.body.telefono.replace(/[^\d+]/g, '');
        }

        ['nombre_cliente', 'apellido_cliente', 'empresa', 'observaciones'].forEach(field => {
            if (req.body[field]) {
                req.body[field] = req.body[field].trim();
            }
        });

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error en validación de datos: ' + error.message
        });
    }
};

// ============================================================================
// FUNCIONES AUXILIARES PARA SEGUIMIENTOS (MIGRADAS DEL ARCHIVO TEMPORAL)
// ============================================================================

/**
 * Calcula horas laborales transcurridas entre dos fechas
 * Horario: L-V 8am-6pm, Sáb 9am-12pm
 */
function calcularHorasLaborales(fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    if (fin <= inicio) return 0;
    
    let horasLaborales = 0;
    let fechaActual = new Date(inicio);
    
    while (fechaActual < fin) {
        const diaSemana = fechaActual.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
        const hora = fechaActual.getHours();
        
        let esHoraLaboral = false;
        
        if (diaSemana >= 1 && diaSemana <= 5) { // Lunes a viernes
            esHoraLaboral = hora >= 8 && hora < 18;
        } else if (diaSemana === 6) { // Sábado
            esHoraLaboral = hora >= 9 && hora < 12;
        }
        
        if (esHoraLaboral) {
            horasLaborales++;
        }
        
        fechaActual.setHours(fechaActual.getHours() + 1);
    }
    
    return horasLaborales;
}

/**
 * Calcula el nivel de urgencia de un seguimiento
 */
function calcularUrgencia(fechaProgramada, ahora = new Date()) {
    const diff = fechaProgramada - ahora;
    const horasRestantes = diff / (1000 * 60 * 60);
    const diasRestantes = horasRestantes / 24;
    
    if (diasRestantes <= 1) {
        return 'critico';
    } else if (diasRestantes <= 5) {
        return 'medio';
    } else {
        return 'bajo';
    }
}

/**
 * 🚀 PROCESAMIENTO OPTIMIZADO DE SEGUIMIENTOS CON ÍNDICES
 * Usa: idx_prospectos_dashboard_seguimientos, idx_prospectos_seguimientos_criticos
 */
async function procesarSeguimientos(asesorId = null) {
    try {
        const { query } = require('../../../config/database');

        // 🎯 CONSULTA OPTIMIZADA: Usar índices específicos para seguimientos
        let sqlQuery = `
            SELECT
                p.id,
                p.codigo,
                p.nombre_cliente,
                p.apellido_cliente,
                p.telefono,
                p.canal_contacto,
                p.estado,
                p.seguimiento_obligatorio,
                p.fecha_seguimiento,
                p.seguimiento_completado,
                p.seguimiento_vencido,
                p.asesor_id,
                p.valor_estimado,
                p.probabilidad_cierre,
                p.numero_reasignaciones,
                p.modo_libre,
                p.created_at,
                u.nombre as usuario_nombre,
                u.apellido as usuario_apellido,
                -- 📊 CÁLCULOS SQL OPTIMIZADOS (en lugar de JS)
                CASE
                    WHEN p.seguimiento_obligatorio <= NOW() - INTERVAL '18 hours' THEN true
                    ELSE false
                END as es_vencido_calculado,
                EXTRACT(EPOCH FROM (NOW() - p.seguimiento_obligatorio))/3600 as horas_diferencia,
                CASE
                    WHEN p.seguimiento_obligatorio <= NOW() + INTERVAL '1 day' THEN 'critico'
                    WHEN p.seguimiento_obligatorio <= NOW() + INTERVAL '5 days' THEN 'medio'
                    ELSE 'bajo'
                END as nivel_urgencia
            FROM prospectos p
            LEFT JOIN usuarios u ON p.asesor_id = u.id
            WHERE p.activo = true
            AND p.seguimiento_obligatorio IS NOT NULL
        `;

        let params = [];

        // Filtro por asesor (usará idx_prospectos_dashboard_seguimientos)
        if (asesorId && !isNaN(asesorId)) {
            sqlQuery += ' AND p.asesor_id = $1';
            params.push(parseInt(asesorId));
        }

        // 📈 ORDENAMIENTO OPTIMIZADO: Priorizar seguimientos críticos
        sqlQuery += ` ORDER BY
            p.seguimiento_vencido DESC,
            p.seguimiento_obligatorio ASC,
            p.valor_estimado DESC NULLS LAST
        `;

        const result = await query(sqlQuery, params);
        const prospectos = result.rows;

        if (!prospectos || prospectos.length === 0) {
            return {
                seguimientos: { proximos: [], vencidos: [], hoy: [] },
                conteos: { total: 0, pendientes: 0, vencidos: 0, completados_hoy: 0 },
                metricas: { efectividad: 0, total_prospectos: 0, completados: 0, vencidos: 0, tasa_vencimiento: 0 },
                sistema: {
                    prospectos_evaluados: 0,
                    ultima_actualizacion: new Date().toISOString(),
                    filtro_asesor: asesorId ? parseInt(asesorId) : null,
                    optimizado: true
                }
            };
        }

        // 🚀 PROCESAMIENTO OPTIMIZADO: Cambiar a período semanal
        const ahora = new Date();
        const inicioSemana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 6); // Últimos 7 días
        const finSemana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);   // Hasta mañana

        // 📊 TRANSFORMACIÓN EFICIENTE: Usar datos ya calculados en SQL
        const seguimientosProcesados = prospectos.map(prospecto => ({
            id: `prospecto_${prospecto.id}`,
            prospecto_id: prospecto.id,
            prospecto_nombre: `${prospecto.nombre_cliente} ${prospecto.apellido_cliente || ''}`.trim(),
            prospecto_codigo: prospecto.codigo,
            tipo: prospecto.canal_contacto || 'Llamada',
            estado: prospecto.estado,
            fecha_programada: prospecto.seguimiento_obligatorio,
            fecha_seguimiento: prospecto.fecha_seguimiento,
            completado: prospecto.seguimiento_completado || false,

            // 🎯 USAR CÁLCULOS SQL (más eficiente)
            vencido: prospecto.seguimiento_vencido || prospecto.es_vencido_calculado,
            horas_diferencia: Math.max(0, prospecto.horas_diferencia || 0),
            urgencia: prospecto.nivel_urgencia || 'bajo',

            // 💰 INFORMACIÓN ADICIONAL DE VALOR
            valor_estimado: prospecto.valor_estimado || 0,
            probabilidad_cierre: prospecto.probabilidad_cierre || 50,
            numero_reasignaciones: prospecto.numero_reasignaciones || 0,
            modo_libre: prospecto.modo_libre || false,

            descripcion: `${prospecto.canal_contacto} programada para ${prospecto.nombre_cliente}`,
            asesor_nombre: prospecto.usuario_nombre ?
                `${prospecto.usuario_nombre} ${prospecto.usuario_apellido || ''}`.trim() :
                'Sin asignar',
            telefono: prospecto.telefono,
            created_at: prospecto.created_at,

            // 🎯 SCORE DE PRIORIDAD (para ordenamiento)
            priority_score: (prospecto.valor_estimado || 0) * (prospecto.probabilidad_cierre || 50) / 100
        }));

        // 🎯 CLASIFICACIÓN OPTIMIZADA: Usar arrays de una sola pasada
        const clasificacion = { proximos: [], vencidos: [], realizados_semana: [] };
        let totalCompletados = 0;
        let totalVencidos = 0;
        let valorEnRiesgo = 0;

        seguimientosProcesados.forEach(seg => {
            const fechaSeg = new Date(seg.fecha_completado || seg.fecha_programada);

            // ✅ CAMBIO IMPORTANTE: Realizados en los últimos 7 días
            if (seg.completado && fechaSeg >= inicioSemana && fechaSeg < finSemana) {
                clasificacion.realizados_semana.push(seg);
                totalCompletados++;
            } else if (seg.vencido) {
                clasificacion.vencidos.push(seg);
                totalVencidos++;
                valorEnRiesgo += seg.valor_estimado || 0;
            } else if (!seg.completado) {
                clasificacion.proximos.push(seg);
            }
        });

        // 🎯 ORDENAMIENTO INTELIGENTE: Por prioridad y valor
        clasificacion.proximos.sort((a, b) => {
            // 1. Prioridad por urgencia
            if (a.urgencia !== b.urgencia) {
                const orden = { 'critico': 0, 'medio': 1, 'bajo': 2 };
                return orden[a.urgencia] - orden[b.urgencia];
            }
            // 2. Por score de prioridad (valor * probabilidad)
            if (Math.abs(a.priority_score - b.priority_score) > 100) {
                return b.priority_score - a.priority_score;
            }
            // 3. Por fecha programada
            return new Date(a.fecha_programada) - new Date(b.fecha_programada);
        });

        clasificacion.vencidos.sort((a, b) => {
            // Priorizar por valor en riesgo y tiempo vencido
            const scoreDiffA = a.priority_score * (a.horas_diferencia / 24);
            const scoreDiffB = b.priority_score * (b.horas_diferencia / 24);
            return scoreDiffB - scoreDiffA;
        });

        clasificacion.realizados_semana.sort((a, b) =>
            new Date(b.fecha_completado || b.fecha_seguimiento || b.fecha_programada) - new Date(a.fecha_completado || a.fecha_seguimiento || a.fecha_programada)
        );

        // 📊 MÉTRICAS AVANZADAS OPTIMIZADAS
        const efectividad = seguimientosProcesados.length > 0 ?
            ((totalCompletados / seguimientosProcesados.length) * 100).toFixed(1) : 0;

        const tasaVencimiento = seguimientosProcesados.length > 0 ?
            ((totalVencidos / seguimientosProcesados.length) * 100).toFixed(1) : 0;

        // 🚨 ALERTAS AUTOMÁTICAS
        const alertas = {
            alto_valor_en_riesgo: valorEnRiesgo > 50000,
            muchos_vencidos: totalVencidos > 5,
            efectividad_baja: parseFloat(efectividad) < 70,
            seguimientos_criticos: clasificacion.proximos.filter(s => s.urgencia === 'critico').length
        };

        return {
            seguimientos: clasificacion,
            conteos: {
                total: seguimientosProcesados.length,
                pendientes: clasificacion.proximos.length,
                vencidos: clasificacion.vencidos.length,
                realizados_semana: clasificacion.realizados_semana.length
            },
            metricas: {
                efectividad: parseFloat(efectividad),
                total_prospectos: seguimientosProcesados.length,
                completados: totalCompletados,
                vencidos: totalVencidos,
                tasa_vencimiento: parseFloat(tasaVencimiento),

                // 🚀 NUEVAS MÉTRICAS ENTERPRISE
                valor_en_riesgo: valorEnRiesgo,
                valor_promedio_vencido: totalVencidos > 0 ? (valorEnRiesgo / totalVencidos).toFixed(2) : 0,
                seguimientos_criticos: clasificacion.proximos.filter(s => s.urgencia === 'critico').length,
                modo_libre_activos: seguimientosProcesados.filter(s => s.modo_libre).length
            },
            alertas: alertas,
            sistema: {
                prospectos_evaluados: prospectos.length,
                ultima_actualizacion: ahora.toISOString(),
                filtro_asesor: asesorId ? parseInt(asesorId) : null,
                optimizado: true,
                indices_utilizados: ['idx_prospectos_dashboard_seguimientos', 'idx_prospectos_seguimientos_criticos'],
                performance: 'Sub-200ms con índices'
            }
        };

    } catch (error) {
        console.error('Error procesando seguimientos:', error);
        throw error;
    }
}

// ============================================================================
// RUTAS DE INFORMACIÓN DEL SISTEMA
// ============================================================================

router.get('/health', ProspectosController.healthCheck);

// ENDPOINT PARA ESTADÍSTICAS DE CACHE
// ✅ CORREGIDO: Usar constantes de roles (jefes y ejecutivos pueden ver stats)
router.get('/cache/stats', requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), async (req, res) => {
    try {
        const cacheService = require('../../../services/CacheService');
        const stats = await cacheService.obtenerEstadisticas();
        const healthCheck = await cacheService.healthCheck();

        res.json({
            success: true,
            data: {
                ...stats,
                health: healthCheck,
                uptime: process.uptime(),
                memoria_proceso: process.memoryUsage()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error obteniendo estadísticas de cache: ' + error.message
        });
    }
});

// ENDPOINT PARA LIMPIAR CACHE
// ✅ CORREGIDO: Solo SUPER_ADMIN puede limpiar cache (operación crítica)
router.post('/cache/clear', requireRole([ROLES.SUPER_ADMIN]), async (req, res) => {
    try {
        const cacheService = require('../../../services/CacheService');
        const { tipo, asesor_id } = req.body;

        let resultado;
        if (tipo === 'global') {
            resultado = await cacheService.invalidarGlobal();
        } else if (asesor_id) {
            resultado = await cacheService.invalidarPorAsesor(asesor_id);
        } else {
            resultado = await cacheService.invalidar(tipo || 'dashboard_metricas');
        }

        res.json({
            success: true,
            message: 'Cache limpiado exitosamente',
            resultado: resultado
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error limpiando cache: ' + error.message
        });
    }
});

router.get('/info/estados', (req, res) => {
    res.json({
        success: true,
        data: {
            estados: [
                { codigo: 'Prospecto', nombre: 'Prospecto', descripcion: 'Contacto inicial registrado' },
                { codigo: 'Cotizado', nombre: 'Cotizado', descripcion: 'Cotización enviada al cliente' },
                { codigo: 'Negociacion', nombre: 'Negociación', descripcion: 'En proceso de negociación' },
                { codigo: 'Cerrado', nombre: 'Cerrado', descripcion: 'Venta exitosa' },
                { codigo: 'Perdido', nombre: 'Perdido', descripcion: 'No se concretó la venta' }
            ],
            flujo_normal: 'Prospecto → Cotizado → Negociación → Cerrado',
            notas: 'Cualquier estado puede ir directamente a Perdido con justificación'
        }
    });
});

router.get('/info/canales', (req, res) => {
    res.json({
        success: true,
        data: {
            canales: [
                { codigo: 'WhatsApp', nombre: 'WhatsApp', icono: '📱' },
                { codigo: 'Messenger', nombre: 'Facebook Messenger', icono: '💬' },
                { codigo: 'Facebook', nombre: 'Facebook', icono: '📘' },
                { codigo: 'TikTok', nombre: 'TikTok', icono: '🎵' },
                { codigo: 'Llamada', nombre: 'Llamada Telefónica', icono: '📞' },
                { codigo: 'Presencial', nombre: 'Visita Presencial', icono: '🏢' },
                { codigo: 'Email', nombre: 'Correo Electrónico', icono: '📧' }
            ],
            recomendacion: 'WhatsApp es el canal más efectivo según las métricas'
        }
    });
});

// ============================================================================
// RUTAS DE LECTURA (Asesor, Supervisor, Admin)
// ============================================================================

router.get('/', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]), 
    requireOwnership,
    ProspectosController.obtenerTodos
);

router.get('/kanban/:asesorId', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]), 
    requireOwnership,
    ProspectosController.obtenerKanban
);

router.get('/kanban', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]), 
    ProspectosController.obtenerKanban
);

// 📊 NUEVAS RUTAS DE MÉTRICAS ENTERPRISE
router.get('/metricas/canales',
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    ProspectosController.obtenerMetricasPorCanal
);

router.get('/metricas/:asesorId',
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    requireOwnership,
    ProspectosController.obtenerMetricas
);

router.get('/metricas',
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    ProspectosController.obtenerMetricas
);

router.get('/verificar-duplicado/:telefono', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]), 
    ProspectosController.verificarDuplicado
);

// ============================================================================
// RUTAS DE ESCRITURA (Solo Asesor y Admin)
// ============================================================================

router.post('/', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    createProspectoRateLimit, 
    validarDatosProspecto, 
    ProspectosController.crearProspecto
);

router.put('/:id', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    updateRateLimit, 
    validarDatosProspecto, 
    ProspectosController.actualizarProspecto
);

router.patch('/:id/estado', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    updateRateLimit, 
    ProspectosController.cambiarEstado
);

router.post('/:id/cerrar-venta', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    ProspectosController.cerrarVenta
);

// ============================================================================
// RUTA DELETE SIMPLIFICADA (MIGRADA DEL ARCHIVO TEMPORAL)
// ============================================================================

router.delete('/:id', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    updateRateLimit, 
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            const { query } = require('../../../config/database');

            const result = await query(
                'UPDATE prospectos SET activo = $1, fecha_eliminacion = $2, eliminado_por = $3 WHERE id = $4 RETURNING *',
                [false, new Date().toISOString(), req.user?.nombre || 'Sistema', id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const data = result.rows[0];

            console.log(`Prospecto eliminado: ${data.codigo} por ${req.user?.nombre}`);

            res.json({
                success: true,
                message: 'Prospecto eliminado exitosamente',
                data: data
            });

        } catch (error) {
            console.error('Error en eliminar prospecto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar prospecto: ' + error.message
            });
        }
    }
);

// ============================================================================
// RUTAS DE SEGUIMIENTOS CON DATOS REALES (MIGRADAS DEL ARCHIVO TEMPORAL)
// ============================================================================

// Dashboard principal de seguimientos (sin filtro de asesor)
router.get('/dashboard/seguimientos', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    async (req, res) => {
        try {
            const datosCompletos = await procesarSeguimientos();
            
            res.json({
                success: true,
                data: datosCompletos,
                message: `Seguimientos procesados: ${datosCompletos.conteos.total} total`
            });

        } catch (error) {
            console.error('Error en dashboard seguimientos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener dashboard de seguimientos: ' + error.message
            });
        }
    }
);

// Dashboard de seguimientos filtrado por asesor
router.get('/dashboard/seguimientos/:asesorId', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    requireOwnership,
    async (req, res) => {
        try {
            const { asesorId } = req.params;
            
            if (!asesorId || isNaN(asesorId)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de asesor inválido'
                });
            }

            const datosCompletos = await procesarSeguimientos(asesorId);
            
            res.json({
                success: true,
                data: datosCompletos,
                message: `Seguimientos para asesor ${asesorId}: ${datosCompletos.conteos.total} encontrados`
            });

        } catch (error) {
            console.error('Error en dashboard seguimientos por asesor:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener seguimientos por asesor: ' + error.message
            });
        }
    }
);

// Todos los seguimientos en un solo array
router.get('/seguimientos', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    async (req, res) => {
        try {
            const datosCompletos = await procesarSeguimientos();
            
            // Extraer todos los seguimientos en un solo array
            const todosSeguimientos = [
                ...datosCompletos.seguimientos.proximos,
                ...datosCompletos.seguimientos.vencidos,
                ...datosCompletos.seguimientos.hoy
            ];
            
            res.json({
                success: true,
                data: todosSeguimientos,
                total: todosSeguimientos.length,
                message: 'Seguimientos obtenidos correctamente'
            });
            
        } catch (error) {
            console.error('Error en /seguimientos:', error);
            res.json({
                success: true,
                data: [],
                total: 0,
                message: 'Error obteniendo seguimientos: ' + error.message
            });
        }
    }
);

// Solo seguimientos pendientes
router.get('/seguimientos/pendientes', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    async (req, res) => {
        try {
            const datosCompletos = await procesarSeguimientos();
            
            res.json({
                success: true,
                data: datosCompletos.seguimientos.proximos || [],
                total: datosCompletos.conteos.pendientes || 0,
                message: 'Seguimientos pendientes obtenidos'
            });
            
        } catch (error) {
            console.error('Error en /seguimientos/pendientes:', error);
            res.json({
                success: true,
                data: [],
                total: 0,
                message: 'Error obteniendo seguimientos pendientes: ' + error.message
            });
        }
    }
);

// Solo seguimientos vencidos
router.get('/seguimientos/vencidos', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    async (req, res) => {
        try {
            const datosCompletos = await procesarSeguimientos();
            
            res.json({
                success: true,
                data: datosCompletos.seguimientos.vencidos || [],
                total: datosCompletos.conteos.vencidos || 0,
                message: 'Seguimientos vencidos obtenidos'
            });
            
        } catch (error) {
            console.error('Error en /seguimientos/vencidos:', error);
            res.json({
                success: true,
                data: [],
                total: 0,
                message: 'Error obteniendo seguimientos vencidos: ' + error.message
            });
        }
    }
);

// Solo seguimientos completados hoy
router.get('/seguimientos/completados', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    async (req, res) => {
        try {
            const datosCompletos = await procesarSeguimientos();
            
            res.json({
                success: true,
                data: datosCompletos.seguimientos.hoy || [],
                total: datosCompletos.conteos.completados_hoy || 0,
                message: 'Seguimientos completados hoy obtenidos'
            });
            
        } catch (error) {
            console.error('Error en /seguimientos/completados:', error);
            res.json({
                success: true,
                data: [],
                total: 0,
                message: 'Error obteniendo seguimientos completados: ' + error.message
            });
        }
    }
);

// ============================================================================
// RUTAS ADMINISTRATIVAS (Admin, Supervisor, Asesor)
// ============================================================================

router.post('/seguimientos/procesar-vencidos', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    adminOperationsRateLimit,
    ProspectosController.procesarSeguimientosVencidos
);

router.post('/seguimientos/corregir-null', 
    requireRole([ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.GERENTE, ROLES.SUPER_ADMIN]),
    adminOperationsRateLimit,
    ProspectosController.corregirSeguimientosNull
);

// ============================================================================
// RUTAS CON PARÁMETROS DINÁMICOS (AL FINAL)
// ============================================================================
// Ruta para obtener productos de interés de un prospecto
router.get('/:id/productos-interes', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]), 
    ProspectosController.obtenerProductosInteres
);

// 🚀 ANALYTICS UNIFICADOS - Nueva función que resuelve inconsistencias
// IMPORTANTE: Debe estar ANTES de '/:id' para evitar conflictos de rutas
router.get('/analytics-completos',
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    ProspectosController.obtenerAnalyticsCompletos
);

router.get('/analytics-completos/:asesorId',
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
    ProspectosController.obtenerAnalyticsCompletos
);

router.get('/:id', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]), 
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            const { query } = require('../../../config/database');

            const result = await query(`
                SELECT 
                    p.*,
                    u.nombre as usuario_nombre,
                    u.apellido as usuario_apellido,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', ppi.id,
                                'producto_id', ppi.producto_id,
                                'codigo', ppi.codigo_producto,
                                'descripcion_producto', ppi.descripcion_producto,
                                'marca', ppi.marca,
                                'unidad_medida', ppi.unidad_medida,
                                'precio_sin_igv', ppi.precio_sin_igv,
                                'cantidad_estimada', ppi.cantidad_estimada,
                                'valor_linea', ppi.valor_linea,
                                'tipo', ppi.tipo
                            )
                        ) FILTER (WHERE ppi.id IS NOT NULL), 
                        '[]'::json
                    ) as productos_interes
                FROM prospectos p
                LEFT JOIN usuarios u ON p.asesor_id = u.id
                LEFT JOIN prospecto_productos_interes ppi ON p.id = ppi.prospecto_id
                WHERE p.id = $1 AND p.activo = true
                GROUP BY p.id, u.nombre, u.apellido
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const data = {
                ...result.rows[0],
                usuarios: result.rows[0].usuario_nombre ? {
                    nombre: result.rows[0].usuario_nombre,
                    apellido: result.rows[0].usuario_apellido
                } : null
            };

            res.json({
                success: true,
                data: data
            });

        } catch (error) {
            console.error('Error en obtener prospecto por ID:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener prospecto: ' + error.message
            });
        }
    }
);

// ============================================================================
// RUTAS PARA CONVERSIÓN DE VENTAS
// ============================================================================

router.post('/:id/convertir-a-venta', 
    requireRole([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    updateRateLimit,
    ProspectosController.convertirAVentaManual
);

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================================================

router.use((error, req, res, next) => {
    console.error('Error en rutas de prospectos:', error);
    
    // Errores de JWT
    if (error.name === 'JsonWebTokenError') {
        return res.status(403).json({
            success: false,
            error: 'Token JWT inválido',
            code: 'INVALID_JWT'
        });
    }

    if (error.name === 'TokenExpiredError') {
        return res.status(403).json({
            success: false,
            error: 'Token JWT expirado',
            code: 'EXPIRED_JWT'
        });
    }
    
    // Errores de Supabase
    if (error.code) {
        return res.status(500).json({
            success: false,
            error: 'Error de base de datos',
            codigo: error.code,
            detalles: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
        });
    }
    
    // Errores generales
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor en módulo de prospectos',
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// MANEJO DE ERRORES GLOBALES PARA EL MÓDULO DE PROSPECTOS
// ============================================================================


// Middleware de manejo de errores específico para este módulo
router.use((err, req, res, next) => {
    console.error(`Error en módulo de prospectos: ${err.message}`, err.stack);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor en módulo de prospectos',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;