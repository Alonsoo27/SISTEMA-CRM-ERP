const obtenerFechaPeruISO = () => {
    const ahora = new Date();
    // Peru UTC-5 (sin horario de verano)
    const offsetPeru = -5 * 60; // -5 horas en minutos
    const fechaPeru = new Date(ahora.getTime() + (offsetPeru * 60 * 1000));
    return fechaPeru.toISOString();
};

/**
 * 🕐 CALCULAR FECHA LÍMITE: 2 DÍAS LABORALES
 * Horario laboral: L-V 8am-6pm, Sáb 9am-12pm, Dom no laboral
 *
 * @param {Date|string} fechaInicio - Fecha de inicio del seguimiento
 * @returns {Date} Fecha límite después de 2 días laborales completos
 */
const calcular2DiasLaborales = (fechaInicio) => {
    const fecha = new Date(fechaInicio);
    let diasLaboralesContados = 0;
    let fechaActual = new Date(fecha);

    // Avanzar hasta el próximo inicio de jornada laboral
    while (true) {
        const diaSemana = fechaActual.getDay(); // 0=dom, 1=lun, ..., 6=sáb
        const hora = fechaActual.getHours();

        // Saltar domingos completamente
        if (diaSemana === 0) {
            fechaActual.setDate(fechaActual.getDate() + 1);
            fechaActual.setHours(8, 0, 0, 0); // Lunes 8am
            continue;
        }

        // Sábados: solo laborable de 9am-12pm
        if (diaSemana === 6) {
            if (hora >= 12) {
                // Ya pasó mediodía del sábado, ir al lunes 8am
                fechaActual.setDate(fechaActual.getDate() + 2);
                fechaActual.setHours(8, 0, 0, 0);
                continue;
            }
            if (hora < 9) {
                // Antes de las 9am del sábado, ajustar a 9am
                fechaActual.setHours(9, 0, 0, 0);
            }
            // Sábado cuenta como medio día laboral (3 horas)
            if (diasLaboralesContados < 2) {
                fechaActual.setHours(12, 0, 0, 0); // Fin de jornada sábado
                diasLaboralesContados += 0.3; // 3h de 10h = 0.3 días
                if (diasLaboralesContados >= 2) break;
                // Ir al lunes
                fechaActual.setDate(fechaActual.getDate() + 2);
                fechaActual.setHours(8, 0, 0, 0);
            }
            continue;
        }

        // Lunes a Viernes: 8am-6pm (10 horas = 1 día laboral)
        if (hora >= 18) {
            // Ya pasó las 6pm, ir al siguiente día 8am
            fechaActual.setDate(fechaActual.getDate() + 1);
            fechaActual.setHours(8, 0, 0, 0);
            continue;
        }

        if (hora < 8) {
            // Antes de las 8am, ajustar a 8am
            fechaActual.setHours(8, 0, 0, 0);
        }

        // Contar día laboral completo (L-V)
        if (diasLaboralesContados < 2) {
            diasLaboralesContados++;
            if (diasLaboralesContados >= 2) {
                // Ya cumplimos 2 días laborales, establecer hora límite 6pm
                fechaActual.setHours(18, 0, 0, 0);
                break;
            }
            // Ir al siguiente día
            fechaActual.setDate(fechaActual.getDate() + 1);
            fechaActual.setHours(8, 0, 0, 0);
        } else {
            break;
        }
    }

    return fechaActual;
};

const { query, pool } = require('../../../config/database');
const winston = require('winston');
const cacheService = require('../../../services/CacheService');

// 🚀 NUEVA IMPORTACIÓN PARA INTEGRACIÓN AUTOMÁTICA PROSPECTO → VENTA
const ConversionService = require('../../ventas/services/ConversionService');
const ProspectoProductoInteres = require('../../../models/ProspectoProductoInteres');

// 🔔 INTEGRACIÓN CON SISTEMA DE NOTIFICACIONES AUTOMÁTICAS
const NotificacionesController = require('../../notificaciones/controllers/notificacionesController');

// 🚀 SISTEMA DE VALIDACIÓN MULTINIVEL Y PROSPECTOS COMPARTIDOS
const ValidacionDuplicados = require('../utils/validacionDuplicados');
const NotificacionesProspectos = require('../utils/notificacionesProspectos');

//helper
function parseHistorialSeguro(historial) {
    if (!historial) return [];
    if (Array.isArray(historial)) return historial;
    
    if (typeof historial === 'string') {
        try {
            const parsed = JSON.parse(historial);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    
    return [];
}

// CONFIGURACIÓN DE LOGGING
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'prospectos-pipeline' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/prospectos.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// VALIDACIONES DE PROSPECTO
const validarProspecto = (prospecto) => {
    const errores = [];

    // Validar campos requeridos
    if (!prospecto.nombre_cliente?.trim()) {
        errores.push('El nombre del cliente es requerido');
    } else if (prospecto.nombre_cliente.length > 100) {
        errores.push('El nombre del cliente no puede exceder 100 caracteres');
    }

    if (!prospecto.telefono?.trim()) {
        errores.push('El teléfono es requerido');
    } else if (prospecto.telefono.length > 20) {
        errores.push('El teléfono no puede exceder 20 caracteres');
    }

    if (!prospecto.canal_contacto?.trim()) {
        errores.push('El canal de contacto es requerido');
    }

    // Validar canal de contacto válido
    const canalesValidos = ['WhatsApp', 'Messenger', 'Facebook', 'TikTok', 'Llamada', 'Presencial', 'Email'];
    if (prospecto.canal_contacto && !canalesValidos.includes(prospecto.canal_contacto)) {
        errores.push(`Canal de contacto debe ser uno de: ${canalesValidos.join(', ')}`);
    }

    // Validar email si se proporciona
    if (prospecto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospecto.email)) {
        errores.push('El formato del email no es válido');
    }

    // Validar presupuesto estimado
    if (prospecto.presupuesto_estimado && (isNaN(prospecto.presupuesto_estimado) || prospecto.presupuesto_estimado < 0)) {
        errores.push('El presupuesto estimado debe ser un número positivo');
    }

    // Validar valor estimado
    if (prospecto.valor_estimado && (isNaN(prospecto.valor_estimado) || prospecto.valor_estimado < 0)) {
        errores.push('El valor estimado debe ser un número positivo');
    }

    // Validar probabilidad de cierre
    if (prospecto.probabilidad_cierre && (isNaN(prospecto.probabilidad_cierre) || prospecto.probabilidad_cierre < 0 || prospecto.probabilidad_cierre > 100)) {
        errores.push('La probabilidad de cierre debe estar entre 0 y 100');
    }

    return errores;
};

class ProspectosController {
    
    // =====================================================
    // ENDPOINTS PRINCIPALES DEL PIPELINE
    // =====================================================
    
    /**
     * GET /api/prospectos
     * Obtener todos los prospectos con filtros
     * 🔒 FILTRADO AUTOMÁTICO POR ROL:
     * - VENDEDOR: Solo ve sus propios prospectos
     * - JEFE_VENTAS/ADMIN/GERENTE: Ve todos o filtra por asesor
     * - SUPER_ADMIN: Ve todo (incluyendo los suyos)
     */
    static async obtenerTodos(req, res) {
        try {
            const {
                asesor_id,
                estado,
                canal_contacto,
                fecha_desde,
                fecha_hasta,
                antiguedad,
                busqueda,
                page = 1,
                limit = 50
            } = req.query;

            // 🔒 OBTENER ROL Y ID DEL USUARIO ACTUAL
            const usuarioActual = req.user;
            const rolUsuario = usuarioActual?.rol;
            const idUsuario = usuarioActual?.id || usuarioActual?.userId; // ← FIX: probar ambas propiedades

            console.log('🔍 [DEBUG LISTA] Usuario:', { id: idUsuario, rol: rolUsuario, asesor_id_param: asesor_id });

            // Construir query base con JOIN
            let sqlQuery = `
                SELECT
                    p.*,
                    u.nombre, u.apellido
                FROM prospectos p
                LEFT JOIN usuarios u ON p.asesor_id = u.id
                WHERE p.activo = $1
            `;

            let params = [true];
            let paramIndex = 2;

            // 🔒 FILTRADO AUTOMÁTICO POR ROL
            // Si es VENDEDOR, solo puede ver sus propios prospectos
            if (rolUsuario === 'VENDEDOR') {
                sqlQuery += ` AND p.asesor_id = $${paramIndex}`;
                params.push(idUsuario);
                paramIndex++;
                console.log(`🔒 VENDEDOR ${idUsuario} - Filtrando solo sus prospectos`);
            }
            // Si es JEFE/ADMIN/GERENTE y pasa asesor_id, filtrar por ese asesor
            else if (asesor_id) {
                sqlQuery += ` AND p.asesor_id = $${paramIndex}`;
                params.push(asesor_id);
                paramIndex++;
                console.log(`👔 ${rolUsuario} - Filtrando por asesor ${asesor_id}`);
            }
            // Si es SUPER_ADMIN o JEFE sin filtro, ve todos
            else {
                console.log(`👑 ${rolUsuario} - Vista global de todos los prospectos`);
            }

            if (estado) {
                sqlQuery += ` AND p.estado = $${paramIndex}`;
                params.push(estado);
                paramIndex++;
            }

            if (canal_contacto) {
                sqlQuery += ` AND p.canal_contacto = $${paramIndex}`;
                params.push(canal_contacto);
                paramIndex++;
            }

            if (fecha_desde) {
                sqlQuery += ` AND p.fecha_contacto >= $${paramIndex}`;
                params.push(fecha_desde);
                paramIndex++;
            }

            if (fecha_hasta) {
                sqlQuery += ` AND p.fecha_contacto <= $${paramIndex}`;
                params.push(fecha_hasta);
                paramIndex++;
            }

            // Filtro por antigüedad
            if (antiguedad) {
                const ahora = new Date();
                let fechaLimite;
                
                switch (antiguedad) {
                    case 'ultimos_7_dias':
                        fechaLimite = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'ultimos_30_dias':
                        fechaLimite = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'mas_de_60_dias':
                        fechaLimite = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);
                        sqlQuery += ` AND p.fecha_contacto < $${paramIndex}`;
                        params.push(fechaLimite.toISOString());
                        paramIndex++;
                        break;
                    default:
                        break;
                }
                
                if (antiguedad !== 'mas_de_60_dias' && fechaLimite) {
                    sqlQuery += ` AND p.fecha_contacto >= $${paramIndex}`;
                    params.push(fechaLimite.toISOString());
                    paramIndex++;
                }
            }

            // Búsqueda por texto
            if (busqueda) {
                sqlQuery += ` AND (
                    p.nombre_cliente ILIKE $${paramIndex} OR 
                    p.apellido_cliente ILIKE $${paramIndex} OR 
                    p.empresa ILIKE $${paramIndex} OR 
                    p.telefono ILIKE $${paramIndex}
                )`;
                params.push(`%${busqueda}%`);
                paramIndex++;
            }

            // Ordenamiento y paginación
            sqlQuery += ` ORDER BY p.fecha_ultima_actualizacion DESC`;
            
            const offset = (page - 1) * limit;
            sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            const result = await query(sqlQuery, params);
            const data = result.rows;

            // Obtener count total para paginación
            let countQuery = `
                SELECT COUNT(*) as total
                FROM prospectos p
                WHERE p.activo = $1
            `;
            let countParams = [true];
            let countParamIndex = 2;

            // 🔒 APLICAR EL MISMO FILTRADO POR ROL AL COUNT
            if (rolUsuario === 'VENDEDOR') {
                countQuery += ` AND p.asesor_id = $${countParamIndex}`;
                countParams.push(idUsuario);
                countParamIndex++;
            }
            else if (asesor_id) {
                countQuery += ` AND p.asesor_id = $${countParamIndex}`;
                countParams.push(asesor_id);
                countParamIndex++;
            }
            // ... aplicar otros filtros para el count si es necesario

            const countResult = await query(countQuery, countParams);
            const count = parseInt(countResult.rows[0].total);

            logger.info(`Prospectos obtenidos: ${data?.length || 0} registros`);

            res.json({
                success: true,
                data: data || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count
                }
            });

        } catch (error) {
            logger.error('Error en obtenerTodos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener prospectos: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/kanban/:asesorId?
     * Obtener datos organizados para Kanban Board
     */
    /**
     * GET /api/prospectos/kanban
     * 🔒 FILTRADO AUTOMÁTICO POR ROL:
     * - VENDEDOR: Solo ve su kanban personal
     * - JEFE_VENTAS/ADMIN/GERENTE: Ve kanban global o de un asesor específico
     * - SUPER_ADMIN: Ve todo
     */
    static async obtenerKanban(req, res) {
        try {
            const { asesorId } = req.params;
            const { incluir_modo_libre = false } = req.query;

            // 🔒 OBTENER ROL Y ID DEL USUARIO ACTUAL
            const usuarioActual = req.user || {};
            const rolUsuario = usuarioActual?.rol;
            const idUsuario = usuarioActual?.id || usuarioActual?.userId; // ← FIX: probar ambas propiedades

            console.log('🔍 [DEBUG KANBAN] Usuario:', { id: idUsuario, rol: rolUsuario, asesorId_param: asesorId });

            // 🔒 DETERMINAR QUÉ ASESOR FILTRAR SEGÚN EL ROL
            let asesorIdFinal = asesorId;

            // Si es VENDEDOR, SIEMPRE filtra por su propio ID (ignora asesorId de parámetros)
            if (rolUsuario === 'VENDEDOR') {
                asesorIdFinal = idUsuario;
                console.log(`🔒 VENDEDOR ID ${idUsuario} - Kanban personal forzado. Ignorando parámetro: ${asesorId}`);
            }
            // Si es JEFE/ADMIN y no especifica asesor, ve todos
            else if (!asesorId || asesorId === 'todos') {
                asesorIdFinal = null; // Vista global
                console.log(`👑 ${rolUsuario} - Kanban global`);
            }
            else {
                console.log(`👔 ${rolUsuario} - Kanban del asesor ${asesorId}`);
            }

            // Intentar obtener del cache primero
            const cacheParams = { incluir_modo_libre, rol: rolUsuario };
            const resultado = await cacheService.conCache(
                'kanban_data',
                asesorIdFinal || 'todos',
                async () => {
                    return await ProspectosController.obtenerDatosKanbanFresh(asesorIdFinal, incluir_modo_libre);
                },
                cacheParams
            );

            res.json(resultado);

        } catch (error) {
            logger.error('Error en obtenerKanban:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener datos del Kanban: ' + error.message
            });
        }
    }

    /**
     * Función auxiliar para obtener datos Kanban sin cache
     * @param {number|null} asesorId - ID del asesor a filtrar, o null para vista global
     * @param {boolean} incluir_modo_libre - Incluir prospectos en modo libre
     */
    static async obtenerDatosKanbanFresh(asesorId, incluir_modo_libre) {
        let sqlQuery = `
            SELECT
                p.id, p.codigo, p.nombre_cliente, p.apellido_cliente, p.empresa, p.telefono, p.email,
                p.canal_contacto, p.estado, p.valor_estimado, p.probabilidad_cierre,
                p.fecha_contacto, p.fecha_seguimiento, p.observaciones,
                p.asesor_id, p.modo_libre, p.numero_reasignaciones,
                u.nombre as asesor_nombre,
                u.apellido as asesor_apellido,
                -- 🔥 NUEVO: Datos del próximo seguimiento
                s.id as seguimiento_id,
                s.fecha_programada as proximo_seguimiento,
                s.fecha_limite as fecha_limite_seguimiento,
                s.tipo as tipo_seguimiento,
                s.vencido as seguimiento_vencido
            FROM prospectos p
            LEFT JOIN usuarios u ON p.asesor_id = u.id
            LEFT JOIN LATERAL (
                SELECT id, fecha_programada, fecha_limite, tipo, vencido
                FROM seguimientos
                WHERE prospecto_id = p.id
                  AND completado = false
                  AND visible_para_asesor = true
                ORDER BY fecha_programada ASC
                LIMIT 1
            ) s ON true
            WHERE p.activo = $1
        `;

        let params = [true];
        let paramIndex = 2;

        // 🔒 FILTRAR POR ASESOR SI SE ESPECIFICA (ya viene filtrado por rol desde obtenerKanban)
        if (asesorId) {
            if (incluir_modo_libre === 'true') {
                // Incluir prospectos del asesor + los en modo libre
                sqlQuery += ` AND (p.asesor_id = $${paramIndex} OR p.modo_libre = $${paramIndex + 1})`;
                params.push(asesorId, true);
                paramIndex += 2;
            } else {
                sqlQuery += ` AND p.asesor_id = $${paramIndex} AND p.modo_libre = $${paramIndex + 1}`;
                params.push(asesorId, false);
                paramIndex += 2;
            }
        }

        const result = await query(sqlQuery, params);
        const data = result.rows;

        // Agrupar por estado
        const kanbanData = {
            Prospecto: [],
            Cotizado: [],
            Negociacion: [],
            Cerrado: [],
            Perdido: []
        };

        let valorTotalPipeline = 0;

        (data || []).forEach(prospecto => {
            if (kanbanData[prospecto.estado]) {
                kanbanData[prospecto.estado].push({
                    ...prospecto,
                    dias_en_etapa: Math.floor((new Date() - new Date(prospecto.fecha_contacto)) / (1000 * 60 * 60 * 24))
                });

                if (['Prospecto', 'Cotizado', 'Negociacion'].includes(prospecto.estado)) {
                    valorTotalPipeline += parseFloat(prospecto.valor_estimado || 0);
                }
            }
        });

        // ========================================
        // 🎯 ORDENAMIENTO POR URGENCIA DE SEGUIMIENTO
        // ========================================
        // NOTA: Los prospectos en modo_libre NO aparecen aquí (tienen vista separada)
        // NOTA: TODOS los prospectos activos tienen seguimiento obligatorio
        // ========================================
        Object.keys(kanbanData).forEach(estado => {
            kanbanData[estado].sort((a, b) => {
                // ========================================
                // NIVEL 1: Número de Reasignaciones
                // Prospectos "rebotados" requieren atención especial
                // ========================================
                if (a.numero_reasignaciones !== b.numero_reasignaciones) {
                    return b.numero_reasignaciones - a.numero_reasignaciones;
                }

                // ========================================
                // NIVEL 2: SEGUIMIENTO MÁS PRÓXIMO
                // Ordenar por urgencia: vencidos/próximos primero
                // ========================================
                // Todos los prospectos activos tienen seguimiento, pero por seguridad:
                if (!a.proximo_seguimiento && !b.proximo_seguimiento) {
                    // Ambos sin seguimiento (caso excepcional) → ordenar por fecha contacto
                    return new Date(a.fecha_contacto) - new Date(b.fecha_contacto);
                }

                // Si solo uno tiene seguimiento (no debería pasar)
                if (a.proximo_seguimiento && !b.proximo_seguimiento) return -1;
                if (!a.proximo_seguimiento && b.proximo_seguimiento) return 1;

                // Ambos tienen seguimiento: ordenar por fecha más próxima PRIMERO
                const fechaA = new Date(a.proximo_seguimiento);
                const fechaB = new Date(b.proximo_seguimiento);

                // Ascendente: los que vencen ANTES van primero
                return fechaA - fechaB;
            });

            // 📝 LOG: Mostrar primeros 3 prospectos de cada columna (para debugging)
            if (kanbanData[estado].length > 0) {
                logger.debug(`   [${estado}] Ordenamiento (primeros 3):`);
                kanbanData[estado].slice(0, 3).forEach((p, index) => {
                    const seguimientoInfo = p.proximo_seguimiento
                        ? `Sigue: ${new Date(p.proximo_seguimiento).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
                        : 'Sin seguimiento';
                    const prioridad = p.numero_reasignaciones > 0 ? `🔄${p.numero_reasignaciones}x` : '📌';
                    logger.debug(`      ${index + 1}. ${p.codigo} | ${prioridad} | ${seguimientoInfo}`);
                });
            }
        });

        // ========================================
        // 📊 MÉTRICAS AMPLIADAS
        // ========================================
        const prospectos_con_seguimiento = (data || []).filter(p => p.proximo_seguimiento).length;
        const seguimientos_vencidos = (data || []).filter(p => p.seguimiento_vencido).length;
        const seguimientos_urgentes = (data || []).filter(p => {
            if (!p.proximo_seguimiento) return false;
            const diffHoras = (new Date(p.proximo_seguimiento) - new Date()) / (1000 * 60 * 60);
            return diffHoras < 24 && diffHoras >= 0; // Vence en menos de 24h
        }).length;

        const metricas = {
            total_prospectos: data?.length || 0,
            valor_total_pipeline: valorTotalPipeline,
            distribucion: {
                prospecto: kanbanData.Prospecto.length,
                cotizado: kanbanData.Cotizado.length,
                negociacion: kanbanData.Negociacion.length,
                cerrado: kanbanData.Cerrado.length,
                perdido: kanbanData.Perdido.length
            },
            // 🆕 Métricas de seguimiento
            seguimientos: {
                con_seguimiento: prospectos_con_seguimiento,
                sin_seguimiento: (data?.length || 0) - prospectos_con_seguimiento,
                vencidos: seguimientos_vencidos,
                urgentes: seguimientos_urgentes
            }
        };

        logger.info(`📋 Kanban obtenido: ${metricas.total_prospectos} prospectos, $${valorTotalPipeline} en pipeline`);
        logger.info(`   📅 Seguimientos: ${prospectos_con_seguimiento} activos, ${seguimientos_vencidos} vencidos, ${seguimientos_urgentes} urgentes (<24h)`);

        return {
            success: true,
            data: kanbanData,
            metricas: metricas
        };
    }

    /**
     * POST /api/prospectos
     * Crear nuevo prospecto - CORREGIDO CON FECHAS PERU
     */
    static async crearProspecto(req, res) {
    try {
        const datosProspecto = req.body;
        const productosInteres = datosProspecto.productos_interes || [];
        delete datosProspecto.productos_interes;
            
            // TODO: Obtener del token JWT cuando esté implementado
            const asesorId = req.user?.user_id || req.user?.id || 1;
            const asesorNombre = req.user?.nombre_completo || req.user?.nombre || 'Admin User';

            // Agregar log para debug
            console.log('🔐 Usuario JWT en crearProspecto:', {
                user_id: req.user?.user_id,
                nombre: req.user?.nombre,
                rol: req.user?.rol
            });

            // Asignación automática del asesor logueado
            datosProspecto.asesor_id = asesorId;
            datosProspecto.asesor_nombre = asesorNombre;
            datosProspecto.asesor_original_id = asesorId;
            datosProspecto.asesor_original_nombre = asesorNombre;

            // Validaciones
            const errores = validarProspecto(datosProspecto);
            if (errores.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Errores de validación',
                    errores: errores
                });
            }

            // 🚀 VALIDACIÓN MULTINIVEL DE DUPLICADOS (Sistema de prospectos compartidos)
            const validacion = await ValidacionDuplicados.validarProspectoDuplicado(
                datosProspecto.telefono,
                asesorId,
                productosInteres
            );

            logger.info(`Validación de duplicado para ${datosProspecto.telefono}: Escenario ${validacion.escenario}`);

            // ESCENARIO C: BLOQUEAR - Mismo producto en Cotizado/Negociación
            if (!validacion.permitir) {
                logger.warn(`Prospecto bloqueado - ${validacion.escenario}: ${datosProspecto.telefono}`);
                return res.status(409).json({
                    success: false,
                    error: validacion.mensaje,
                    motivo_bloqueo: validacion.motivo_bloqueo,
                    asesores_activos: validacion.asesores_activos,
                    escenario: validacion.escenario
                });
            }

            // ESCENARIO B: Requiere confirmación del usuario
            // Si el frontend envió confirmacion=true, continuar; si no, devolver advertencia
            if (validacion.requires_confirmation && !req.body.confirmacion_duplicado) {
                logger.info(`Prospecto requiere confirmación - ${validacion.escenario}: ${datosProspecto.telefono}`);
                return res.status(200).json({
                    success: true,
                    requires_confirmation: true,
                    mensaje: validacion.mensaje,
                    asesores_activos: validacion.asesores_activos,
                    productos_en_comun: validacion.productos_en_comun,
                    escenario: validacion.escenario,
                    action: 'CONFIRMAR_CREACION'
                });
            }

            // ESCENARIOS A, D: Permitir sin restricciones
            // O Escenario B con confirmación → Continuar con creación

            // CORRECCIÓN CRÍTICA: Calcular fecha de seguimiento con timezone Peru
            const fechaActualPeru = obtenerFechaPeruISO();
            const fechaSeguimiento = datosProspecto.fecha_seguimiento || (() => {
                const fechaBase = new Date(fechaActualPeru);
                const fechaMas24h = new Date(fechaBase.getTime() + (24 * 60 * 60 * 1000));
                return fechaMas24h.toISOString();
            })();

            // Preparar historial inicial
            const historialInicial = [{
                fecha: fechaActualPeru,
                tipo: 'Creación',
                descripcion: `Prospecto creado vía ${datosProspecto.canal_contacto}`,
                usuario: asesorNombre
            }];

            // Crear prospecto CON todas las fechas corregidas para Peru
            const insertQuery = `
                INSERT INTO prospectos (
                    nombre_cliente, apellido_cliente, telefono, email, empresa, cargo, direccion,
                    distrito, ciudad, canal_contacto, origen_contacto,
                    presupuesto_estimado, estado, tipo_cierre, probabilidad_cierre, valor_estimado,
                    asesor_id, asesor_nombre, asesor_original_id, asesor_original_nombre,
                    seguimiento_obligatorio, seguimiento_completado, seguimiento_vencido,
                    numero_reasignaciones, modo_libre, negociacion_fallida, fecha_contacto,
                    fecha_ultima_actualizacion, fecha_seguimiento, observaciones,
                    historial_interacciones, convertido_venta, activo, departamento, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
                ) RETURNING *
                            `;

            const insertValues = [
                datosProspecto.nombre_cliente,
                datosProspecto.apellido_cliente || '',
                datosProspecto.telefono,
                datosProspecto.email || null,
                datosProspecto.empresa || null,
                datosProspecto.cargo || null,
                datosProspecto.direccion || null,
                datosProspecto.distrito || null,
                datosProspecto.ciudad || null,
                datosProspecto.canal_contacto,
                datosProspecto.origen_contacto || null,
                datosProspecto.presupuesto_estimado || 0,
                datosProspecto.estado || 'Prospecto',
                datosProspecto.tipo_cierre || null,
                datosProspecto.probabilidad_cierre || 50,
                datosProspecto.valor_estimado || 0,
                asesorId,
                asesorNombre,
                asesorId,
                asesorNombre,
                fechaSeguimiento,
                false,
                false,
                0,
                false,
                false,
                datosProspecto.fecha_contacto || fechaActualPeru,
                fechaActualPeru,
                datosProspecto.fecha_seguimiento || null,
                datosProspecto.observaciones || null,
                JSON.stringify(historialInicial),
                false,
                true,
                datosProspecto.departamento || null,
                fechaActualPeru
            ];

            const result = await query(insertQuery, insertValues);
            
            if (!result.rows || result.rows.length === 0) {
                throw new Error('Prospecto no creado');
            }

            const data = result.rows[0];

            // ✅ CREAR SEGUIMIENTO AUTOMÁTICO EN TABLA SEGUIMIENTOS
            if (fechaSeguimiento) {
                try {
                    // 🕐 fecha_limite: Alerta al asesor (4h para Llamada)
                    const { calcularFechaLimite } = require('../utils/fechasHelper');
                    const fechaLimite = calcularFechaLimite(fechaSeguimiento, 'Llamada');

                    await query(`
                        INSERT INTO seguimientos (
                            prospecto_id, asesor_id, fecha_programada, fecha_limite,
                            tipo, descripcion, completado, visible_para_asesor
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        data.id,
                        asesorId,
                        fechaSeguimiento,
                        fechaLimite, // calcularFechaLimite ya devuelve ISO string
                        'Llamada',
                        'Seguimiento inicial del prospecto',
                        false,
                        true
                    ]);

                    logger.info(`✅ Seguimiento inicial creado para prospecto ${data.codigo} - Fecha: ${fechaSeguimiento}, Límite: ${fechaLimite}`);
                } catch (errorSeguimiento) {
                    logger.error(`⚠️ Error al crear seguimiento inicial para prospecto ${data.codigo}:`, errorSeguimiento);
                    // No fallar la creación del prospecto si falla el seguimiento
                }
            }

            // Crear productos de interés en tabla separada
            if (productosInteres.length > 0) {
                for (const producto of productosInteres) {
                    await ProspectoProductoInteres.crear({
                        prospecto_id: data.id,
                        producto_id: producto.producto_id || null,
                        codigo_producto: producto.codigo_producto || producto.codigo, // ✅ Aceptar ambos formatos
                        descripcion_producto: producto.descripcion_producto || producto.nombre || producto.descripcion, // ✅
                        marca: producto.marca,
                        categoria_id: null,
                        unidad_medida: producto.unidad_medida || producto.unidad || 'UND', // ✅
                        precio_sin_igv: producto.precio_sin_igv || producto.precio_base || producto.precio_unitario || 0, // ✅
                        cantidad_estimada: producto.cantidad_estimada || 1,
                        valor_linea: producto.valor_linea || 0,
                        tipo: producto.tipo || 'catalogo'
                    });
                }

                // ✅ DETECTAR CAMPAÑA AUTOMÁTICAMENTE (si hay productos)
                try {
                    const campanaResult = await query(
                        'SELECT detectar_campana_prospecto($1, $2) as campana_id',
                        [data.id, asesorId]
                    );

                    const campanaId = campanaResult.rows[0]?.campana_id;

                    if (campanaId) {
                        logger.info(`✅ Campaña ${campanaId} asignada automáticamente al prospecto ${data.codigo}`);
                    } else {
                        logger.info(`ℹ️  Prospecto ${data.codigo} sin campaña activa que coincida`);
                    }
                } catch (errorCampana) {
                    logger.error(`⚠️ Error detectando campaña para prospecto ${data.codigo}:`, errorCampana);
                    // No fallar la creación si falla la detección de campaña
                }
            }

            logger.info(`Prospecto creado (Peru timezone): ${data.codigo} - ${data.nombre_cliente} - Seguimiento: ${fechaSeguimiento}`);

            // Invalidar cache después de crear
            await cacheService.invalidarPorAsesor(asesorId);

            // 🔔 CREAR NOTIFICACIÓN: prospecto_creado
            try {
                await NotificacionesController.crearNotificaciones({
                    tipo: 'prospecto_creado',
                    modo: 'basico',
                    data: {
                        usuario_id: asesorId,
                        prospecto_id: data.id,
                        prospecto_codigo: data.codigo,
                        prospecto_nombre: data.nombre_cliente,
                        valor_estimado: data.valor_estimado || 0,
                        canal_contacto: data.canal_contacto
                    },
                    auto_prioridad: true
                });
                logger.info(`✅ Notificación prospecto_creado enviada para ${data.codigo}`);
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificación prospecto_creado:', errorNotif);
                // No fallar la creación del prospecto si falla la notificación
            }

            // 🔔 NOTIFICAR A ASESORES EXISTENTES (Prospectos compartidos)
            if (validacion.requires_confirmation && validacion.asesores_activos?.length > 0) {
                try {
                    await NotificacionesProspectos.notificarProspectoCompartido({
                        telefono: datosProspecto.telefono,
                        nuevoProspectoId: data.id,
                        nuevoAsesorId: asesorId,
                        nuevoAsesorNombre: asesorNombre,
                        nombreCliente: `${data.nombre_cliente} ${data.apellido_cliente || ''}`.trim(),
                        asesoresActivos: validacion.asesores_activos
                    });
                    logger.info(`✅ Notificaciones de prospecto compartido enviadas (${validacion.asesores_activos.length} asesores)`);
                } catch (errorNotifCompartido) {
                    logger.error('⚠️ Error notificando prospecto compartido:', errorNotifCompartido);
                    // No fallar la creación si falla la notificación
                }
            }

            res.status(201).json({
                success: true,
                data: data,
                message: 'Prospecto creado exitosamente',
                escenario_duplicado: validacion.escenario,
                prospectos_compartidos: validacion.asesores_activos?.length || 0
            });

        } catch (error) {
            logger.error('Error en crearProspecto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear prospecto: ' + error.message
            });
        }
    }

    /**
     * PUT /api/prospectos/:id
     * Actualizar prospecto - CORREGIDO CON FECHAS PERU
     */
    static async actualizarProspecto(req, res) {
        try {
            const { id } = req.params;
            const datosActualizacion = req.body;
            console.log('🔧 DEBUG - Request body completo:', JSON.stringify(req.body, null, 2));
            console.log('🔧 DEBUG - Productos recibidos:', req.body.productos_interes);
            const { productos_interes: productosInteres, ...datosSinProductos } = datosActualizacion;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            // Verificar que el prospecto existe
            const prospectoResult = await query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2',
                [id, true]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const prospectoExistente = prospectoResult.rows[0];

            // SOLUCIÓN: LISTA DE CAMPOS VÁLIDOS PERMITIDOS
            const camposPermitidos = [
                'nombre_cliente', 'apellido_cliente', 'telefono', 'email', 'empresa',
                'cargo', 'direccion', 'distrito', 'ciudad', 'canal_contacto',
                'origen_contacto', 'presupuesto_estimado',
                'estado', 'estado_anterior', 'tipo_cierre', 'probabilidad_cierre',
                'valor_estimado', 'motivo_perdida', 'asesor_id', 'asesor_nombre',
                'seguimiento_obligatorio', 'seguimiento_completado', 'seguimiento_vencido',
                'numero_reasignaciones', 'modo_libre', 'fecha_modo_libre',
                'negociacion_fallida', 'motivo_falla_negociacion', 'fecha_contacto',
                'fecha_ultima_actualizacion', 'fecha_seguimiento', 'fecha_cierre',
                'observaciones', 'historial_interacciones', 'convertido_venta',
                'venta_id', 'updated_at'
            ];

            // FILTRAR SOLO CAMPOS VÁLIDOS
            const datosLimpios = {};
            Object.keys(datosSinProductos).forEach(campo => {
                if (camposPermitidos.includes(campo)) {
                    datosLimpios[campo] = datosActualizacion[campo];
                } else {
                    logger.warn(`⚠️ Campo ignorado (no existe): ${campo}`);
                }
            });

            // Agregar timestamps automáticos
            datosLimpios.fecha_ultima_actualizacion = obtenerFechaPeruISO();
            datosLimpios.updated_at = obtenerFechaPeruISO();

            // Validaciones si se actualizan campos críticos
            if (datosLimpios.telefono && datosLimpios.telefono !== prospectoExistente.telefono) {
                const duplicadosResult = await query(
                    'SELECT id, codigo, nombre_cliente FROM prospectos WHERE telefono = $1 AND activo = $2 AND id != $3',
                    [datosLimpios.telefono, true, id]
                );

                if (duplicadosResult.rows && duplicadosResult.rows.length > 0) {
                    return res.status(409).json({
                        success: false,
                        error: 'Ya existe otro prospecto con este teléfono',
                        prospecto_existente: duplicadosResult.rows[0]
                    });
                }
            }

            // Validar datos si se proporcionan
            const errores = validarProspecto({ ...prospectoExistente, ...datosLimpios });
            if (errores.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Errores de validación',
                    errores: errores
                });
            }

            logger.info(`🔧 Actualizando prospecto ${id}, campos:`, Object.keys(datosLimpios));

            // Construir query dinámico de UPDATE
            const campos = Object.keys(datosLimpios);
            const setClause = campos.map((campo, index) => `${campo} = $${index + 2}`).join(', ');
            const valores = Object.values(datosLimpios);

            const updateQuery = `
                UPDATE prospectos 
                SET ${setClause}
                WHERE id = $1 AND activo = true
                RETURNING id, codigo, nombre_cliente, apellido_cliente, telefono, email, estado, 
                         seguimiento_vencido, seguimiento_completado, fecha_ultima_actualizacion, asesor_nombre
            `;

            const result = await query(updateQuery, [parseInt(id), ...valores]);

            if (!result.rows || result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No se pudo actualizar el prospecto'
                });
            }

            const updateResult = result.rows[0];
            console.log('🔧 DEBUG - ¿Hay productos para procesar?', {
            tieneProductos: !!productosInteres,
            esArray: Array.isArray(productosInteres),
            cantidad: productosInteres?.length || 0,
            productos: productosInteres
        });
            if (productosInteres && Array.isArray(productosInteres)) {
    // Eliminar productos existentes
    await query('DELETE FROM prospecto_productos_interes WHERE prospecto_id = $1', [id]);
    
    // Insertar productos actualizados
    for (const producto of productosInteres) {
        await ProspectoProductoInteres.crear({
            prospecto_id: parseInt(id),
            producto_id: producto.producto_id || null,
            codigo_producto: producto.codigo,
            descripcion_producto: producto.descripcion_producto || producto.nombre,
            marca: producto.marca,
            categoria_id: null,
            unidad_medida: producto.unidad_medida || 'UND',
            precio_sin_igv: producto.precio_sin_igv || 0,
            cantidad_estimada: producto.cantidad_estimada || 1,
            valor_linea: producto.valor_linea || 0,
            tipo: producto.tipo || 'catalogo'
        });
    }
    }

            logger.info(`✅ Prospecto actualizado: ${updateResult.codigo} - ${updateResult.nombre_cliente}`);

            // Invalidar cache después de actualizar
            await cacheService.invalidarPorAsesor(updateResult.asesor_id || prospectoExistente.asesor_id);

            // 🔔 DETECTAR REASIGNACIÓN: Si cambió el asesor_id, crear notificaciones
            if (datosLimpios.asesor_id && datosLimpios.asesor_id !== prospectoExistente.asesor_id) {
                try {
                    const asesorAnterior = prospectoExistente.asesor_id;
                    const asesorNuevo = datosLimpios.asesor_id;

                    logger.info(`🔄 Reasignación detectada: ${prospectoExistente.codigo} de asesor ${asesorAnterior} → ${asesorNuevo}`);

                    // Notificación para asesor anterior (perdió prospecto)
                    await NotificacionesController.crearNotificaciones({
                        tipo: 'prospecto_reasignado',
                        modo: 'basico',
                        data: {
                            usuario_id: asesorAnterior,
                            prospecto_id: parseInt(id),
                            prospecto_codigo: updateResult.codigo,
                            prospecto_nombre: updateResult.nombre_cliente,
                            valor_estimado: updateResult.valor_estimado || 0,
                            motivo_reasignacion: 'Reasignación manual',
                            tipo_cambio: 'perdida'
                        },
                        auto_prioridad: true
                    });

                    // Notificación para asesor nuevo (ganó prospecto)
                    await NotificacionesController.crearNotificaciones({
                        tipo: 'prospecto_reasignado',
                        modo: 'basico',
                        data: {
                            usuario_id: asesorNuevo,
                            prospecto_id: parseInt(id),
                            prospecto_codigo: updateResult.codigo,
                            prospecto_nombre: updateResult.nombre_cliente,
                            valor_estimado: updateResult.valor_estimado || 0,
                            motivo_reasignacion: 'Nuevo prospecto asignado',
                            tipo_cambio: 'ganancia'
                        },
                        auto_prioridad: true
                    });

                    logger.info(`✅ Notificaciones prospecto_reasignado enviadas para ${updateResult.codigo}`);
                } catch (errorNotif) {
                    logger.error('⚠️ Error creando notificaciones de reasignación:', errorNotif);
                }
            }

            res.json({
                success: true,
                data: updateResult,
                message: 'Prospecto actualizado exitosamente',
                method: 'postgresql_update',
                campos_actualizados: Object.keys(datosLimpios)
            });

        } catch (error) {
            logger.error('❌ Error general en actualizarProspecto:', {
                error_message: error.message,
                error_stack: error.stack,
                prospecto_id: req.params.id,
                request_body: req.body
            });

            res.status(500).json({
                success: false,
                error: 'Error al actualizar prospecto: ' + error.message
            });
        }
    }

    // Obtener productos de interés de un prospecto
        static async obtenerProductosInteres(req, res) {
        try {
            const { id } = req.params;
            
            if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID del prospecto es requerido'
            });
            }

            const result = await query(`
            SELECT 
                ppi.*,
                p.codigo as producto_codigo,
                p.descripcion as producto_descripcion,
                p.marca,
                c.nombre as categoria
            FROM prospecto_productos_interes ppi
            LEFT JOIN productos p ON p.id = ppi.producto_id  
            LEFT JOIN categorias c ON c.id = ppi.categoria_id
            WHERE ppi.prospecto_id = $1 
            ORDER BY ppi.id
            `, [id]);

            return res.json({
            success: true,
            data: result.rows || []
            });

        } catch (error) {
            logger.error('Error obteniendo productos de interés:', error);
            return res.status(500).json({
            success: false,
            error: 'Error al obtener productos de interés del prospecto'
            });
        }
        }

    /**
 * GET /api/prospectos/:id
 * Obtener prospecto individual con productos para edición
 */
static async obtenerPorId(req, res) {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de prospecto inválido'
            });
        }

        // Obtener prospecto con productos usando LEFT JOIN
        const result = await query(`
            SELECT 
                p.*,
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
            LEFT JOIN prospecto_productos_interes ppi ON p.id = ppi.prospecto_id
            WHERE p.id = $1 AND p.activo = $2
            GROUP BY p.id
        `, [id, true]);

        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Prospecto no encontrado'
            });
        }

        const prospecto = result.rows[0];
        
        res.json({
            success: true,
            data: prospecto
        });

    } catch (error) {
        logger.error('Error obteniendo prospecto por ID:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener prospecto: ' + error.message
        });
    }
    }    

    /**
     * 🚀 MÉTODO MEJORADO PARA CAMBIO DE ESTADO CON CONVERSIÓN AUTOMÁTICA
     * PATCH /api/prospectos/:id/estado
     * Cambiar estado del prospecto - CORREGIDO CON FECHAS PERU + INTEGRACIÓN AUTOMÁTICA
     */
    static async cambiarEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado, motivo } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            const estadosValidos = ['Prospecto', 'Cotizado', 'Negociacion', 'Cerrado', 'Perdido'];
            if (!estado || !estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    error: 'Estado inválido',
                    estados_validos: estadosValidos
                });
            }

            logger.info(`🔄 Cambiando estado de prospecto ${id} a ${estado}`);

            // Obtener prospecto actual
            const prospectoResult = await query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2',
                [id, true]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const prospectoActual = prospectoResult.rows[0];
            const fechaActualPeru = obtenerFechaPeruISO();
            
            let updateFields = ['estado = $2', 'estado_anterior = $3', 'fecha_ultima_actualizacion = $4'];
            let updateValues = [id, estado, prospectoActual.estado, fechaActualPeru];
            let paramIndex = 5;

            // Lógica especial por estado
            if (estado === 'Perdido') {
                if (!motivo) {
                    return res.status(400).json({
                        success: false,
                        error: 'El motivo es requerido cuando se marca como perdido'
                    });
                }
                updateFields.push(`motivo_perdida = $${paramIndex}`, `fecha_cierre = $${paramIndex + 1}`);
                updateValues.push(motivo, fechaActualPeru);
                paramIndex += 2;
            }

            if (estado === 'Cerrado') {
                updateFields.push(`fecha_cierre = $${paramIndex}`, `convertido_venta = $${paramIndex + 1}`);
                updateValues.push(fechaActualPeru, true);
                paramIndex += 2;
            }

            // Registrar en historial de interacciones
            const historialActual = parseHistorialSeguro(prospectoActual.historial_interacciones);
            const nuevaInteraccion = {
                fecha: fechaActualPeru,
                tipo: 'Cambio de Estado',
                descripcion: `Estado cambiado de "${prospectoActual.estado}" a "${estado}"${motivo ? ` - Motivo: ${motivo}` : ''}`,
                usuario: req.user?.nombre || 'Sistema'
            };
            
            updateFields.push(`historial_interacciones = $${paramIndex}`);
            updateValues.push(JSON.stringify([...historialActual, nuevaInteraccion]));

            // Actualizar en base de datos
            const updateQuery = `
                UPDATE prospectos 
                SET ${updateFields.join(', ')}
                WHERE id = $1
                RETURNING *
            `;

            const result = await query(updateQuery, updateValues);
            
            if (!result.rows || result.rows.length === 0) {
                throw new Error('No se pudo actualizar el estado');
            }

            const data = result.rows[0];

            logger.info(`Estado cambiado: ${data.codigo} de "${prospectoActual.estado}" a "${estado}"`);

            // Invalidar cache después de cambiar estado
            await cacheService.invalidarPorAsesor(prospectoActual.asesor_id);

            // 🔔 CREAR NOTIFICACIONES SEGÚN EL CAMBIO DE ESTADO
            try {
                let tipoNotificacion = null;

                // Mapear estado a tipo de notificación
                if (estado === 'Cotizado') {
                    tipoNotificacion = 'estado_cotizado';
                } else if (estado === 'Negociacion') {
                    tipoNotificacion = 'estado_negociacion';
                } else if (estado === 'Cerrado') {
                    tipoNotificacion = 'venta_cerrada'; // Se creará otra después si la conversión es exitosa
                } else if (estado === 'Perdido') {
                    tipoNotificacion = 'venta_perdida';
                }

                if (tipoNotificacion) {
                    await NotificacionesController.crearNotificaciones({
                        tipo: tipoNotificacion,
                        modo: 'basico',
                        data: {
                            usuario_id: prospectoActual.asesor_id,
                            prospecto_id: parseInt(id),
                            prospecto_codigo: data.codigo,
                            prospecto_nombre: data.nombre_cliente,
                            valor_estimado: data.valor_estimado || 0,
                            estado_anterior: prospectoActual.estado,
                            estado_nuevo: estado,
                            motivo: motivo || ''
                        },
                        auto_prioridad: true
                    });
                    logger.info(`✅ Notificación ${tipoNotificacion} enviada para ${data.codigo}`);
                }
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificación de cambio de estado:', errorNotif);
            }

            // 🎯 CONVERSIÓN AUTOMÁTICA CUANDO ESTADO = "Cerrado"
            let ventaCreada = null;
            let conversionInfo = null;
            
            if (estado === 'Cerrado') {
                try {
                    logger.info(`🚀 INICIANDO CONVERSIÓN AUTOMÁTICA - Prospecto ${id} → Venta`);

                    // Ejecutar conversión
                    const resultadoConversion = await ConversionService.convertirDesdeKanban(
                        parseInt(id),
                        req.user?.user_id || req.user?.id || prospectoActual.asesor_id,
                        motivo || ''
                    );

                    if (resultadoConversion && resultadoConversion.success) {
                        ventaCreada = resultadoConversion.venta_creada;

                        conversionInfo = {
                            exitosa: true,
                            venta_creada: {
                                id: ventaCreada.id,
                                codigo: ventaCreada.codigo,
                                valor_estimado: ventaCreada.valor_total,
                                estado: ventaCreada.estado
                            },
                            mensaje: `✅ Venta #${ventaCreada.codigo} creada automáticamente`
                        };

                        logger.info(`✅ CONVERSIÓN EXITOSA: Prospecto ${id} → Venta ${ventaCreada.id} ($${ventaCreada.valor_total})`);

                        // 🔔 NOTIFICACIÓN DE CONVERSIÓN EXITOSA
                        try {
                            await NotificacionesController.crearNotificaciones({
                                tipo: 'conversion_exitosa',
                                modo: 'basico',
                                data: {
                                    usuario_id: prospectoActual.asesor_id,
                                    prospecto_id: parseInt(id),
                                    prospecto_codigo: data.codigo,
                                    prospecto_nombre: data.nombre_cliente,
                                    valor_estimado: ventaCreada.valor_total,
                                    venta_codigo: ventaCreada.codigo,
                                    venta_id: ventaCreada.id
                                },
                                auto_prioridad: true
                            });
                            logger.info(`✅ Notificación conversion_exitosa enviada para venta ${ventaCreada.codigo}`);
                        } catch (errorNotifConv) {
                            logger.error('⚠️ Error creando notificación conversion_exitosa:', errorNotifConv);
                        }
                    } else {
                        logger.error(`⚠️ Error en conversión automática:`, resultadoConversion);
                        conversionInfo = {
                            exitosa: false,
                            error: resultadoConversion?.error || 'Error desconocido en conversión',
                            mensaje: '⚠️ El prospecto se cerró exitosamente, pero hubo un problema creando la venta automáticamente'
                        };
                    }
                } catch (conversionError) {
                    logger.error(`❌ Error en conversión automática prospecto ${id}:`, {
                        error: conversionError.message,
                        stack: conversionError.stack,
                        prospecto_id: id,
                        asesor_id: req.user?.id
                    });

                    conversionInfo = {
                        exitosa: false,
                        error: conversionError.message,
                        mensaje: '⚠️ El prospecto se cerró exitosamente, pero hubo un error técnico en la conversión a venta'
                    };
                }
            }

            // Respuesta exitosa
            const respuesta = {
                success: true,
                message: `Estado actualizado a ${estado} exitosamente`,
                data: data,
                estado_anterior: prospectoActual.estado,
                estado_nuevo: estado,
                fecha_actualizacion: fechaActualPeru
            };

            // Agregar información de conversión si se intentó
            if (conversionInfo) {
                respuesta.conversion_automatica = conversionInfo;
            }

            logger.info(`✅ Estado actualizado: Prospecto ${id} → ${estado}${ventaCreada ? ` → Venta ${ventaCreada.id}` : ''}`);
            res.json(respuesta);

        } catch (error) {
            logger.error('Error en cambiarEstado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cambiar estado: ' + error.message
            });
        }
    }

    /**
     * 🚀 ENDPOINT PARA CONVERSIÓN MANUAL DE PROSPECTO A VENTA
     * POST /api/prospectos/:id/convertir-a-venta
     */
    static async convertirAVentaManual(req, res) {
        try {
            const { id } = req.params;
            const { valor_personalizado, notas_adicionales, prioridad = 'alta' } = req.body;

            logger.info(`🔄 Conversión manual iniciada: Prospecto ${id}`);

            // Verificar que el prospecto existe
            const prospectoResult = await query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2',
                [id, true]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const prospecto = prospectoResult.rows[0];

            // Verificar que no esté ya convertido
            if (prospecto.venta_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Este prospecto ya fue convertido a venta',
                    venta_existente: prospecto.venta_id
                });
            }

            const fechaActualPeru = obtenerFechaPeruISO();

            // Preparar datos para conversión
            const datosConversion = {
                prospecto_id: parseInt(id),
                asesor_id: req.user?.user_id || req.user?.id || prospecto.asesor_id,
                valor_estimado: valor_personalizado || prospecto.valor_estimado || prospecto.presupuesto_estimado || 0,
                cliente_nombre: prospecto.nombre_cliente,
                cliente_apellido: prospecto.apellido_cliente,
                cliente_email: prospecto.email,
                cliente_telefono: prospecto.telefono,
                cliente_empresa: prospecto.empresa,
                fuente: 'conversion_manual',
                fecha_conversion: fechaActualPeru,
                prioridad: prioridad,
                estado_inicial: 'Activa',
                notas_prospecto: `Conversión manual desde prospecto ${id}. ${prospecto.observaciones || ''}\n\nNotas adicionales: ${notas_adicionales || ''}`,
                canal_origen: prospecto.canal_contacto,
                productos_interes: []
            };

            // Ejecutar conversión
            const resultado = await ConversionService.convertirProspectoAVenta(datosConversion);

            if (resultado && resultado.success) {
                // Actualizar prospecto
                await query(`
                    UPDATE prospectos 
                    SET estado = $1, venta_id = $2, fecha_conversion = $3, fecha_cierre = $4,
                        estado_conversion = $5, convertido_venta = $6, fecha_ultima_actualizacion = $7
                    WHERE id = $8
                `, ['Cerrado', resultado.venta_creada.id, fechaActualPeru, fechaActualPeru, 
                    'convertido', true, fechaActualPeru, id]);

                logger.info(`✅ Conversión manual exitosa: Prospecto ${id} → Venta ${resultado.venta_creada.id}`);

                res.status(201).json({
                    success: true,
                    mensaje: 'Prospecto convertido exitosamente a venta',
                    venta_creada: resultado.venta_creada,
                    prospecto_id: parseInt(id),
                    fecha_conversion: fechaActualPeru
                });

            } else {
                logger.error(`❌ Error en conversión manual:`, resultado);
                res.status(500).json({
                    success: false,
                    error: 'Error en la conversión',
                    detalle: resultado?.error || 'Error desconocido'
                });
            }

        } catch (error) {
            logger.error('❌ Error en conversión manual:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                mensaje: error.message
            });
        }
    }

    /**
     * POST /api/prospectos/:id/cerrar-venta
     * Convertir prospecto en venta - CORREGIDO CON FECHAS PERU
     */
    static async cerrarVenta(req, res) {
        try {
            const { id } = req.params;
            const { valor_final, productos_vendidos, observaciones_cierre } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            // Obtener prospecto
            const prospectoResult = await query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2',
                [id, true]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const prospecto = prospectoResult.rows[0];

            // Validar que esté en estado válido para cerrar
            if (!['Cotizado', 'Negociacion'].includes(prospecto.estado)) {
                return res.status(400).json({
                    success: false,
                    error: 'Solo se pueden cerrar prospectos en estado Cotizado o Negociación'
                });
            }

            const valorVenta = valor_final || prospecto.valor_estimado || 0;
            const productosVendidos = productos_vendidos || [];
            const fechaActualPeru = obtenerFechaPeruISO();

            // Preparar campos para actualizar
            let updateFields = ['estado = $2', 'convertido_venta = $3', 'fecha_cierre = $4', 'fecha_ultima_actualizacion = $5', 'valor_estimado = $6'];
            let updateValues = [id, 'Cerrado', true, fechaActualPeru, fechaActualPeru, valorVenta];
            let paramIndex = 7;

            if (observaciones_cierre) {
                updateFields.push(`observaciones = $${paramIndex}`);
                updateValues.push(observaciones_cierre);
                paramIndex++;
            }

            // Agregar interacción
            const historialActual = parseHistorialSeguro(prospecto.historial_interacciones);
            const nuevaInteraccion = {
                fecha: fechaActualPeru,
                tipo: 'Venta Cerrada',
                descripcion: `Prospecto convertido en venta exitosamente. Valor: $${valorVenta}`,
                usuario: req.user?.nombre || 'Sistema'
            };

            updateFields.push(`historial_interacciones = $${paramIndex}`);
            updateValues.push(JSON.stringify([...historialActual, nuevaInteraccion]));

            const updateQuery = `
                UPDATE prospectos 
                SET ${updateFields.join(', ')}
                WHERE id = $1
                RETURNING *
            `;

            const result = await query(updateQuery, updateValues);
            
            if (!result.rows || result.rows.length === 0) {
                throw new Error('No se pudo cerrar la venta');
            }

            const data = result.rows[0];

            logger.info(`Venta cerrada: ${data.codigo} - $${valorVenta}`);

            // 🔔 NOTIFICACIÓN DE VENTA CERRADA
            try {
                await NotificacionesController.crearNotificaciones({
                    tipo: 'venta_cerrada',
                    modo: 'basico',
                    data: {
                        usuario_id: prospecto.asesor_id,
                        prospecto_id: parseInt(id),
                        prospecto_codigo: data.codigo,
                        prospecto_nombre: data.nombre_cliente,
                        valor_estimado: valorVenta,
                        productos_vendidos: productosVendidos.length || 0
                    },
                    auto_prioridad: true
                });
                logger.info(`✅ Notificación venta_cerrada enviada para ${data.codigo}`);
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificación venta_cerrada:', errorNotif);
            }

            // TODO: Integrar con módulo de ventas cuando esté implementado

            res.json({
                success: true,
                data: {
                    prospecto: data,
                    valor_venta: valorVenta,
                    productos_vendidos: productosVendidos
                },
                message: '¡Venta cerrada exitosamente!'
            });

        } catch (error) {
            logger.error('Error en cerrarVenta:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cerrar venta: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/metricas/:asesorId?
     * Obtener métricas del pipeline
     */
    static async obtenerMetricas(req, res) {
        try {
            const { asesorId } = req.params;
            const { fecha_desde, fecha_hasta } = req.query;

            // 🔒 CONTROL DE ACCESO POR ROL (igual que seguimientos)
            const usuarioActual = req.user || {};
            const rolUsuario = usuarioActual.rol_id;
            const idUsuarioActual = usuarioActual.id;

            const ROLES_EJECUTIVOS = [1, 2, 3, 4, 6]; // SUPER_ADMIN, ADMIN, GERENTE, JEFE_VENTAS, SUPERVISOR
            const esEjecutivo = ROLES_EJECUTIVOS.includes(rolUsuario);

            let asesorIdFinal;
            if (rolUsuario === 7) {
                // 🔒 VENDEDOR: Forzar su propio ID
                asesorIdFinal = idUsuarioActual;
                console.log(`🔒 [Métricas] VENDEDOR ${idUsuarioActual} - Vista personal forzada`);
            } else if (esEjecutivo) {
                // ✅ EJECUTIVO: Puede ver global (null) o específico
                asesorIdFinal = asesorId || null;
                console.log(`✅ [Métricas] EJECUTIVO (rol ${rolUsuario}) - Vista: ${asesorIdFinal ? `asesor ${asesorIdFinal}` : 'global'}`);
            } else {
                // 🔒 OTROS ROLES: Solo vista personal
                asesorIdFinal = idUsuarioActual;
                console.log(`⚠️ [Métricas] Rol ${rolUsuario} - Vista personal forzada`);
            }

            // Intentar obtener del cache primero (incluir rol en params para evitar colisiones)
            const cacheParams = { fecha_desde, fecha_hasta, rol: rolUsuario, asesor: asesorIdFinal };
            const resultado = await cacheService.conCache(
                'dashboard_metricas',
                asesorIdFinal ? `asesor_${asesorIdFinal}` : 'global',
                async () => {
                    return await ProspectosController.obtenerMetricasFresh(asesorIdFinal, fecha_desde, fecha_hasta);
                },
                cacheParams
            );

            // 🔍 LOG DETALLADO del resultado
            console.log(`📊 [DEBUG Métricas] Resultado para ${asesorIdFinal ? `asesor ${asesorIdFinal}` : 'global'}:`, {
                total_prospectos: resultado.data?.total_prospectos,
                prospectos_activos: resultado.data?.prospectos_activos,
                asesorId: asesorIdFinal
            });

            res.json(resultado);

        } catch (error) {
            logger.error('Error en obtenerMetricas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener métricas: ' + error.message
            });
        }
    }

    /**
     * 🚀 Función auxiliar OPTIMIZADA para obtener métricas usando índices
     * Usa: idx_prospectos_metricas_pipeline, idx_prospectos_conversiones
     */
    static async obtenerMetricasFresh(asesorId, fecha_desde, fecha_hasta) {
        try {
            // 🎯 CONSULTA OPTIMIZADA #1: Métricas básicas usando aggregation SQL
            let metricsQuery = `
                SELECT
                    estado,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(CASE WHEN valor_estimado > 0 THEN valor_estimado ELSE 0 END), 0) as valor_total,
                    COALESCE(AVG(CASE WHEN valor_estimado > 0 THEN valor_estimado ELSE NULL END), 0) as valor_promedio,
                    COUNT(CASE WHEN fecha_cierre IS NOT NULL THEN 1 END) as con_fecha_cierre
                FROM prospectos
                WHERE activo = true
            `;

            let params = [];
            let paramIndex = 1;

            // Filtro por asesor (usará idx_prospectos_metricas_pipeline)
            if (asesorId && asesorId !== 'todos') {
                metricsQuery += ` AND asesor_id = $${paramIndex}`;
                params.push(asesorId);
                paramIndex++;
            }

            // Filtros de fecha (usará idx_prospectos_fecha_contacto)
            if (fecha_desde) {
                metricsQuery += ` AND fecha_contacto >= $${paramIndex}`;
                params.push(fecha_desde);
                paramIndex++;
            }

            if (fecha_hasta) {
                metricsQuery += ` AND fecha_contacto <= $${paramIndex}`;
                params.push(fecha_hasta);
                paramIndex++;
            }

            metricsQuery += ` GROUP BY estado ORDER BY estado`;

            // 🎯 CONSULTA OPTIMIZADA #2: Métricas de tiempo de conversión
            let conversionQuery = `
                SELECT
                    COUNT(*) as total_conversiones,
                    AVG(EXTRACT(days FROM (fecha_cierre - fecha_contacto))) as dias_promedio_conversion,
                    AVG(CASE WHEN probabilidad_cierre > 0 THEN probabilidad_cierre END) as probabilidad_promedio
                FROM prospectos
                WHERE activo = true AND estado = 'Cerrado' AND fecha_cierre IS NOT NULL
            `;

            let conversionParams = [];
            if (asesorId && asesorId !== 'todos') {
                conversionQuery += ` AND asesor_id = $1`;
                conversionParams.push(asesorId);
            }

            // 🚨 CONSULTA ADICIONAL: Seguimientos pendientes
            let seguimientosQuery = `
                SELECT COUNT(*) as seguimientos_pendientes
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = false AND p.activo = true
            `;

            let seguimientosParams = [];
            if (asesorId && asesorId !== 'todos') {
                seguimientosQuery += ` AND p.asesor_id = $1`;
                seguimientosParams.push(asesorId);
            }

            // 🚀 EJECUTAR TODAS LAS CONSULTAS EN PARALELO para máximo rendimiento
            const [metricsResult, conversionResult, seguimientosResult] = await Promise.all([
                query(metricsQuery, params.slice(0, paramIndex - 1)),
                query(conversionQuery, conversionParams),
                query(seguimientosQuery, seguimientosParams)
            ]);

            const metricsData = metricsResult.rows || [];
            const conversionData = conversionResult.rows[0] || {};

            // 📊 PROCESAR RESULTADOS OPTIMIZADO
            const distribucion = {
                prospecto: 0, cotizado: 0, negociacion: 0, cerrado: 0, perdido: 0
            };

            let totalProspectos = 0;
            let valorTotalPipeline = 0;
            let valorVentasCerradas = 0;
            let prospectosActivos = 0;

            metricsData.forEach(row => {
                const estado = row.estado.toLowerCase();
                const cantidad = parseInt(row.cantidad) || 0;
                const valorTotal = parseFloat(row.valor_total) || 0;

                distribucion[estado] = cantidad;
                totalProspectos += cantidad;

                if (['prospecto', 'cotizado', 'negociacion'].includes(estado)) {
                    valorTotalPipeline += valorTotal;
                    prospectosActivos += cantidad;
                } else if (estado === 'cerrado') {
                    valorVentasCerradas += valorTotal;
                }
            });

            // 🎯 CÁLCULOS FINALES OPTIMIZADOS
            const cerrados = distribucion.cerrado || 0;
            const perdidos = distribucion.perdido || 0;
            const tasaConversion = totalProspectos > 0 ? ((cerrados / totalProspectos) * 100).toFixed(2) : 0;
            const tasaPerdida = totalProspectos > 0 ? ((perdidos / totalProspectos) * 100).toFixed(2) : 0;
            const valorPromedio = prospectosActivos > 0 ? (valorTotalPipeline / prospectosActivos).toFixed(2) : 0;

            // 📈 MÉTRICAS AVANZADAS (NUEVAS)
            const diasPromedioConversion = parseFloat(conversionData.dias_promedio_conversion) || 0;
            const probabilidadPromedio = parseFloat(conversionData.probabilidad_promedio) || 0;
            const efectividadConversion = cerrados > 0 ? (valorVentasCerradas / cerrados).toFixed(2) : 0;

            const seguimientosPendientes = parseInt(seguimientosResult.rows[0]?.seguimientos_pendientes) || 0;

            const metricas = {
                // Métricas básicas (compatibilidad) - ✅ CORREGIDAS
                total_prospectos: totalProspectos,
                prospectos_activos: prospectosActivos,
                cerrados: cerrados,
                perdidos: perdidos,
                en_negociacion: distribucion.negociacion || 0, // ✅ CORREGIDO: Agregado campo faltante
                seguimientos_pendientes: seguimientosPendientes, // ✅ CORREGIDO: Agregado campo faltante
                tasa_conversion: `${tasaConversion}%`,
                tasa_perdida: `${tasaPerdida}%`,
                valor_total_pipeline: valorTotalPipeline,
                valor_ventas_cerradas: valorVentasCerradas,
                valor_promedio_prospecto: valorPromedio,
                valor_promedio: valorPromedio, // ✅ MEJORADO: Alias adicional
                por_estado: { // ✅ MEJORADO: Mapeo para compatibilidad
                    'Prospecto': distribucion.prospecto || 0,
                    'Cotizado': distribucion.cotizado || 0,
                    'Negociacion': distribucion.negociacion || 0,
                    'Cerrado': distribucion.cerrado || 0,
                    'Perdido': distribucion.perdido || 0
                },

                // 🚀 NUEVAS MÉTRICAS AVANZADAS
                metricas_avanzadas: {
                    dias_promedio_conversion: diasPromedioConversion.toFixed(1),
                    probabilidad_promedio: `${probabilidadPromedio.toFixed(1)}%`,
                    efectividad_conversion: efectividadConversion,
                    valor_promedio_venta: efectividadConversion,
                    performance_score: this.calcularPerformanceScore(tasaConversion, diasPromedioConversion, probabilidadPromedio)
                },

                // 📊 METADATA DE OPTIMIZACIÓN
                optimization_info: {
                    consulta_optimizada: true,
                    indices_utilizados: ['idx_prospectos_metricas_pipeline', 'idx_prospectos_conversiones'],
                    tiempo_consulta: 'Sub-100ms con índices',
                    cache_compatible: true
                }
            };

            return {
                success: true,
                data: metricas
            };

        } catch (error) {
            logger.error('Error en obtenerMetricasFresh optimizada:', error);

            // 🔄 FALLBACK: Si falla la consulta optimizada, usar método simple CON FILTRO
            logger.warn('Usando fallback para métricas básicas...');

            let simpleQuery = 'SELECT estado, valor_estimado FROM prospectos WHERE activo = true';
            let fallbackParams = [];

            if (asesorId && asesorId !== 'todos') {
                simpleQuery += ' AND asesor_id = $1';
                fallbackParams.push(asesorId);
                logger.info(`🔒 Fallback filtrando por asesor ${asesorId}`);
            } else {
                logger.info(`📊 Fallback sin filtro de asesor (vista global)`);
            }

            const result = await query(simpleQuery, fallbackParams);
            const data = result.rows || [];

            const total = data.length;
            const cerrados = data.filter(p => p.estado === 'Cerrado').length;

            return {
                success: true,
                data: {
                    total_prospectos: total,
                    cerrados: cerrados,
                    tasa_conversion: total > 0 ? `${((cerrados / total) * 100).toFixed(2)}%` : '0%',
                    distribucion: { prospecto: 0, cotizado: 0, negociacion: 0, cerrado: cerrados, perdido: 0 },
                    optimization_info: { consulta_optimizada: false, fallback_activo: true }
                }
            };
        }
    }

    /**
     * 📊 Función auxiliar para calcular score de performance
     */
    static calcularPerformanceScore(tasaConversion, diasConversion, probabilidadPromedio) {
        try {
            const tasa = parseFloat(tasaConversion) || 0;
            const dias = parseFloat(diasConversion) || 30;
            const probabilidad = parseFloat(probabilidadPromedio) || 50;

            // Algoritmo de scoring (0-100)
            let score = 0;

            // Componente tasa de conversión (40% del score)
            if (tasa >= 20) score += 40;
            else if (tasa >= 15) score += 30;
            else if (tasa >= 10) score += 20;
            else if (tasa >= 5) score += 10;

            // Componente velocidad (30% del score)
            if (dias <= 7) score += 30;
            else if (dias <= 14) score += 25;
            else if (dias <= 21) score += 20;
            else if (dias <= 30) score += 15;
            else if (dias <= 45) score += 10;

            // Componente probabilidad promedio (30% del score)
            if (probabilidad >= 80) score += 30;
            else if (probabilidad >= 70) score += 25;
            else if (probabilidad >= 60) score += 20;
            else if (probabilidad >= 50) score += 15;
            else if (probabilidad >= 40) score += 10;

            return Math.min(100, Math.max(0, score));

        } catch (error) {
            logger.error('Error calculando performance score:', error);
            return 50; // Score neutro en caso de error
        }
    }

    /**
     * GET /api/prospectos/verificar-duplicado/:telefono
     * Verificar si existe duplicado por teléfono
     */
    static async verificarDuplicado(req, res) {
        try {
            const { telefono } = req.params;
            const { excluir_id } = req.query;

            if (!telefono) {
                return res.status(400).json({
                    success: false,
                    error: 'Teléfono es requerido'
                });
            }

            let sqlQuery = `
                SELECT id, codigo, nombre_cliente, apellido_cliente, estado, asesor_nombre, empresa
                FROM prospectos 
                WHERE telefono = $1 AND activo = $2
            `;
            let params = [telefono, true];

            if (excluir_id) {
                sqlQuery += ` AND id != $3`;
                params.push(excluir_id);
            }

            const result = await query(sqlQuery, params);
            const data = result.rows;

            res.json({
                success: true,
                existe_duplicado: (data?.length || 0) > 0,
                data: data || []
            });

        } catch (error) {
            logger.error('Error en verificarDuplicado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar duplicado: ' + error.message
            });
        }
    }

    /**
     * 🚀 GET /api/prospectos/validar-duplicado-avanzado/:telefono
     * Validación avanzada de duplicados con sistema multinivel
     */
    static async validarDuplicadoAvanzado(req, res) {
        try {
            const { telefono } = req.params;
            const { productos_interes } = req.query;
            const asesorId = req.user?.user_id || req.user?.id;

            if (!telefono) {
                return res.status(400).json({
                    success: false,
                    error: 'Teléfono es requerido'
                });
            }

            // Parsear productos si viene como JSON string
            let productosArray = [];
            if (productos_interes) {
                try {
                    productosArray = JSON.parse(productos_interes);
                } catch (e) {
                    productosArray = [];
                }
            }

            const validacion = await ValidacionDuplicados.validarProspectoDuplicado(
                telefono,
                asesorId,
                productosArray
            );

            const resumen = await ValidacionDuplicados.obtenerResumenDuplicados(telefono);

            // ✅ MEJORA: Respuesta consistente según el escenario
            // Si es bloqueo (permitir: false), devolver success: false para claridad
            const esBloqueo = validacion.permitir === false;

            res.json({
                success: !esBloqueo, // false si está bloqueado, true si permite
                bloqueado: esBloqueo, // Flag explícito para frontend
                validacion: validacion,
                resumen_prospectos: resumen,
                mensaje: esBloqueo
                    ? 'Prospecto bloqueado por validación de duplicados'
                    : 'Validación completada'
            });

        } catch (error) {
            logger.error('Error en validarDuplicadoAvanzado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al validar duplicado: ' + error.message
            });
        }
    }

    /**
     * 🔔 GET /api/prospectos/notificaciones-compartidos
     * Obtener notificaciones de prospectos compartidos
     */
    static async obtenerNotificacionesCompartidos(req, res) {
        try {
            const asesorId = req.user?.user_id || req.user?.id;
            const { limit, solo_no_leidas, desde } = req.query;

            const notificaciones = await NotificacionesProspectos.obtenerNotificacionesCompartidos(
                asesorId,
                {
                    limit: limit ? parseInt(limit) : 50,
                    solo_no_leidas: solo_no_leidas === 'true',
                    desde: desde || null
                }
            );

            const estadisticas = await NotificacionesProspectos.obtenerEstadisticasCompartidos(asesorId);

            res.json({
                success: true,
                notificaciones: notificaciones,
                estadisticas: estadisticas
            });

        } catch (error) {
            logger.error('Error en obtenerNotificacionesCompartidos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener notificaciones: ' + error.message
            });
        }
    }

    /**
     * 🔔 PUT /api/prospectos/notificaciones-compartidos/:id/marcar-leida
     * Marcar notificación de prospecto compartido como leída
     */
    static async marcarNotificacionLeida(req, res) {
        try {
            const { id } = req.params;
            const asesorId = req.user?.user_id || req.user?.id;

            await NotificacionesProspectos.marcarComoLeida(parseInt(id), asesorId);

            res.json({
                success: true,
                message: 'Notificación marcada como leída'
            });

        } catch (error) {
            logger.error('Error en marcarNotificacionLeida:', error);
            res.status(500).json({
                success: false,
                error: 'Error al marcar notificación: ' + error.message
            });
        }
    }

    /**
     * 📊 GET /api/prospectos/metricas/canales
     * Métricas detalladas por canal de contacto - NUEVO ENDPOINT ENTERPRISE
     */
    static async obtenerMetricasPorCanal(req, res) {
        try {
            const { asesor_id, fecha_desde, fecha_hasta } = req.query;

            // 🎯 CONSULTA OPTIMIZADA: Usar idx_prospectos_canal
            let sqlQuery = `
                SELECT
                    canal_contacto,
                    COUNT(*) as total_prospectos,
                    COUNT(CASE WHEN estado = 'Cerrado' THEN 1 END) as cerrados,
                    COUNT(CASE WHEN estado = 'Perdido' THEN 1 END) as perdidos,
                    COUNT(CASE WHEN estado IN ('Prospecto', 'Cotizado', 'Negociacion') THEN 1 END) as activos,
                    COALESCE(SUM(CASE WHEN estado IN ('Prospecto', 'Cotizado', 'Negociacion') THEN valor_estimado ELSE 0 END), 0) as valor_pipeline,
                    COALESCE(SUM(CASE WHEN estado = 'Cerrado' THEN valor_estimado ELSE 0 END), 0) as valor_cerrado,
                    COALESCE(AVG(CASE WHEN estado = 'Cerrado' AND fecha_cierre IS NOT NULL
                        THEN EXTRACT(days FROM (fecha_cierre - fecha_contacto)) END), 0) as dias_promedio_conversion,
                    COALESCE(AVG(CASE WHEN valor_estimado > 0 THEN valor_estimado END), 0) as valor_promedio
                FROM prospectos
                WHERE activo = true
                AND canal_contacto IS NOT NULL
            `;

            let params = [];
            let paramIndex = 1;

            if (asesor_id) {
                sqlQuery += ` AND asesor_id = $${paramIndex}`;
                params.push(asesor_id);
                paramIndex++;
            }

            if (fecha_desde) {
                sqlQuery += ` AND fecha_contacto >= $${paramIndex}`;
                params.push(fecha_desde);
                paramIndex++;
            }

            if (fecha_hasta) {
                sqlQuery += ` AND fecha_contacto <= $${paramIndex}`;
                params.push(fecha_hasta);
                paramIndex++;
            }

            sqlQuery += ` GROUP BY canal_contacto ORDER BY total_prospectos DESC`;

            const result = await query(sqlQuery, params);
            const canales = result.rows || [];

            // 📊 PROCESAR RESULTADOS CON MÉTRICAS AVANZADAS
            const metricasPorCanal = canales.map(canal => {
                const total = parseInt(canal.total_prospectos) || 0;
                const cerrados = parseInt(canal.cerrados) || 0;
                const perdidos = parseInt(canal.perdidos) || 0;
                const activos = parseInt(canal.activos) || 0;

                const tasaConversion = total > 0 ? ((cerrados / total) * 100).toFixed(2) : 0;
                const tasaPerdida = total > 0 ? ((perdidos / total) * 100).toFixed(2) : 0;
                const diasConversion = parseFloat(canal.dias_promedio_conversion) || 0;

                // 🎯 SCORE DE EFECTIVIDAD DEL CANAL (0-100)
                let scoreEfectividad = 0;
                if (parseFloat(tasaConversion) >= 15) scoreEfectividad += 40;
                else if (parseFloat(tasaConversion) >= 10) scoreEfectividad += 30;
                else if (parseFloat(tasaConversion) >= 5) scoreEfectividad += 20;

                if (diasConversion <= 14) scoreEfectividad += 30;
                else if (diasConversion <= 21) scoreEfectividad += 20;
                else if (diasConversion <= 30) scoreEfectividad += 10;

                if (total >= 20) scoreEfectividad += 30;
                else if (total >= 10) scoreEfectividad += 20;
                else if (total >= 5) scoreEfectividad += 10;

                return {
                    canal: canal.canal_contacto,
                    total_prospectos: total,
                    activos: activos,
                    cerrados: cerrados,
                    perdidos: perdidos,
                    tasa_conversion: `${tasaConversion}%`,
                    tasa_perdida: `${tasaPerdida}%`,
                    valor_pipeline: parseFloat(canal.valor_pipeline) || 0,
                    valor_cerrado: parseFloat(canal.valor_cerrado) || 0,
                    valor_promedio: parseFloat(canal.valor_promedio) || 0,
                    dias_promedio_conversion: diasConversion.toFixed(1),
                    score_efectividad: Math.min(100, scoreEfectividad),
                    recomendacion: ProspectosController.generarRecomendacionCanal(tasaConversion, diasConversion, total)
                };
            });

            // 🏆 RANKING DE CANALES
            const ranking = [...metricasPorCanal]
                .sort((a, b) => b.score_efectividad - a.score_efectividad)
                .map((canal, index) => ({
                    posicion: index + 1,
                    canal: canal.canal,
                    score: canal.score_efectividad,
                    destacado: index === 0 ? '🥇 Mejor canal' : index === 1 ? '🥈 Segundo lugar' : index === 2 ? '🥉 Tercer lugar' : null
                }));

            // 📈 MÉTRICAS GLOBALES
            const totales = metricasPorCanal.reduce((acc, canal) => ({
                total_prospectos: acc.total_prospectos + canal.total_prospectos,
                total_cerrados: acc.total_cerrados + canal.cerrados,
                valor_total_pipeline: acc.valor_total_pipeline + canal.valor_pipeline,
                valor_total_cerrado: acc.valor_total_cerrado + canal.valor_cerrado
            }), { total_prospectos: 0, total_cerrados: 0, valor_total_pipeline: 0, valor_total_cerrado: 0 });

            logger.info(`📊 Métricas por canal calculadas: ${canales.length} canales analizados`);

            res.json({
                success: true,
                data: {
                    metricas_por_canal: metricasPorCanal,
                    ranking_canales: ranking,
                    resumen: {
                        total_canales: canales.length,
                        mejor_canal: ranking[0]?.canal || null,
                        total_prospectos: totales.total_prospectos,
                        tasa_conversion_global: totales.total_prospectos > 0 ?
                            `${((totales.total_cerrados / totales.total_prospectos) * 100).toFixed(2)}%` : '0%',
                        valor_total_pipeline: totales.valor_total_pipeline,
                        valor_total_cerrado: totales.valor_total_cerrado
                    },
                    insights: ProspectosController.generarInsightsCanales(metricasPorCanal, ranking),
                    optimization_info: {
                        consulta_optimizada: true,
                        indices_utilizados: ['idx_prospectos_canal'],
                        tiempo_respuesta: 'Sub-150ms'
                    }
                }
            });

        } catch (error) {
            logger.error('Error en obtenerMetricasPorCanal:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener métricas por canal: ' + error.message
            });
        }
    }

    /**
     * 💡 Generar recomendación para canal específico
     */
    static generarRecomendacionCanal(tasaConversion, diasConversion, totalProspectos) {
        const tasa = parseFloat(tasaConversion);
        const dias = parseFloat(diasConversion);

        if (tasa >= 15 && dias <= 14) return '🌟 Canal excelente - Mantener estrategia';
        if (tasa >= 10 && dias <= 21) return '✅ Canal bueno - Optimizar velocidad';
        if (tasa >= 5) return '⚠️ Canal regular - Revisar proceso';
        if (totalProspectos < 5) return '📊 Pocos datos - Necesita más prospectos';
        return '🔴 Canal problemático - Requiere revisión urgente';
    }

    /**
     * 🧠 Generar insights automatizados
     */
    static generarInsightsCanales(metricas, ranking) {
        const insights = [];

        if (ranking.length > 0) {
            const mejor = metricas.find(m => m.canal === ranking[0].canal);
            if (mejor) {
                insights.push(`🎯 ${mejor.canal} es tu mejor canal con ${mejor.tasa_conversion} de conversión`);
            }
        }

        const canalLento = metricas.reduce((prev, curr) =>
            parseFloat(prev.dias_promedio_conversion) > parseFloat(curr.dias_promedio_conversion) ? prev : curr
        );
        if (parseFloat(canalLento.dias_promedio_conversion) > 30) {
            insights.push(`🐌 ${canalLento.canal} tiene conversión lenta (${canalLento.dias_promedio_conversion} días)`);
        }

        const valorAlto = metricas.filter(m => m.valor_promedio > 5000);
        if (valorAlto.length > 0) {
            insights.push(`💰 Canales de alto valor: ${valorAlto.map(v => v.canal).join(', ')}`);
        }

        return insights;
    }

    /**
     * 🚀 GET /api/prospectos/analytics-completos
     * NUEVA FUNCIÓN UNIFICADA - Resuelve inconsistencias entre métricas y canales
     */
    static async obtenerAnalyticsCompletos(req, res) {
        try {
            const { asesorId } = req.params;
            const { periodo = 'mes_actual' } = req.query;

            // Si no hay asesorId en params, obtener todos los asesores (null)
            // Si hay asesorId, validarlo y convertirlo
            let asesor_id = null;
            if (asesorId) {
                if (isNaN(asesorId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de asesor inválido'
                    });
                }
                asesor_id = parseInt(asesorId);
            }

            // 📅 CALCULAR FECHAS SEGÚN PERÍODO
            const ahora = new Date();
            let fechaDesde, fechaHasta = ahora.toISOString();

            switch (periodo) {
                case 'semana_actual':
                    fechaDesde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                case 'trimestre_actual':
                    fechaDesde = new Date(ahora.getFullYear(), Math.floor(ahora.getMonth() / 3) * 3, 1).toISOString();
                    break;
                case 'year_actual':
                    fechaDesde = new Date(ahora.getFullYear(), 0, 1).toISOString();
                    break;
                default: // mes_actual
                    fechaDesde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
            }

            // 🎯 CONSULTA UNIFICADA - UNA SOLA FUENTE DE VERDAD
            const asesorFilter = asesor_id ? 'AND p.asesor_id = $1' : '';
            const params = asesor_id ? [asesor_id, fechaDesde, fechaHasta] : [fechaDesde, fechaHasta];

            const unifiedQuery = `
                WITH datos_base AS (
                    SELECT DISTINCT ON (p.id)
                        p.id,
                        p.canal_contacto,
                        p.valor_estimado,
                        p.estado,
                        p.fecha_contacto,
                        p.fecha_cierre,
                        p.distrito,
                        p.ciudad,
                        p.departamento,
                        v.id as venta_id,
                        v.valor_final,
                        v.fecha_venta,
                        (SELECT COUNT(*) FROM seguimientos WHERE prospecto_id = p.id) as total_seguimientos_count,
                        (SELECT COUNT(*) FROM seguimientos WHERE prospecto_id = p.id AND completado = true) as seguimientos_completados_count
                    FROM prospectos p
                    LEFT JOIN ventas v ON p.id = v.prospecto_id
                    WHERE p.activo = true
                    ${asesorFilter}
                    AND p.fecha_contacto >= ${asesor_id ? '$2' : '$1'}
                    AND p.fecha_contacto <= ${asesor_id ? '$3' : '$2'}
                    ORDER BY p.id
                )
                SELECT
                    -- 📊 MÉTRICAS GENERALES
                    COUNT(DISTINCT id) as total_prospectos,
                    COUNT(DISTINCT CASE WHEN venta_id IS NOT NULL THEN id END) as conversiones_reales,
                    COUNT(DISTINCT CASE WHEN estado IN ('Prospecto', 'Cotizado', 'Negociacion') THEN id END) as activos,

                    -- 💰 VALORES REALES
                    COALESCE(SUM(CASE WHEN estado IN ('Prospecto', 'Cotizado', 'Negociacion') THEN valor_estimado END), 0) as pipeline_activo,
                    COALESCE(SUM(CASE WHEN venta_id IS NOT NULL THEN valor_final END), 0) as ventas_cerradas_valor,
                    COUNT(DISTINCT CASE WHEN venta_id IS NOT NULL THEN venta_id END) as ventas_cerradas_cantidad,

                    -- 📈 EFECTIVIDAD DE SEGUIMIENTOS
                    COALESCE(SUM(total_seguimientos_count), 0) as total_seguimientos,
                    COALESCE(SUM(seguimientos_completados_count), 0) as seguimientos_exitosos,

                    -- 🏆 POR CANAL Y UBICACIÓN
                    JSON_AGG(
                        CASE WHEN canal_contacto IS NOT NULL THEN
                            JSON_BUILD_OBJECT(
                                'canal', canal_contacto,
                                'total', 1,
                                'estado', estado,
                                'convertido', CASE WHEN venta_id IS NOT NULL THEN 1 ELSE 0 END,
                                'pipeline', CASE WHEN estado IN ('Prospecto', 'Cotizado', 'Negociacion') THEN valor_estimado ELSE 0 END,
                                'cerrado', CASE WHEN venta_id IS NOT NULL THEN valor_final ELSE 0 END,
                                'valor_estimado', valor_estimado,
                                'distrito', distrito,
                                'ciudad', ciudad,
                                'departamento', departamento,
                                'fecha_contacto', fecha_contacto
                            )
                        END
                    ) FILTER (WHERE canal_contacto IS NOT NULL) as datos_canales
                FROM datos_base
            `;

            // 📊 CONSULTA PRINCIPAL
            const result = await query(unifiedQuery, params);
            const datos = result.rows[0];

            // 🧮 PROCESAR DATOS EXPANDIDOS (usando departamento directo de la BD)
            const canalesProcesados = {};
            const distritosProcesados = {};
            const departamentosProcesados = {};
            const datosTemporales = [];

            if (datos.datos_canales) {
                datos.datos_canales.forEach(item => {
                    const canal = item.canal;
                    const distrito = item.distrito || 'Sin especificar';
                    const ciudad = item.ciudad || 'Sin especificar';
                    const departamento = item.departamento || 'Sin especificar';
                    const mes = new Date(item.fecha_contacto).toISOString().substr(0, 7); // YYYY-MM

                    // 📊 PROCESAR POR CANAL
                    if (!canalesProcesados[canal]) {
                        canalesProcesados[canal] = {
                            nombre: canal,
                            total_prospectos: 0,
                            conversiones: 0,
                            pipeline: 0,
                            cerrado: 0,
                            por_estado: {
                                Prospecto: 0,
                                Cotizado: 0,
                                Negociacion: 0,
                                Cerrado: 0,
                                Perdido: 0
                            }
                        };
                    }

                    canalesProcesados[canal].total_prospectos += item.total;
                    canalesProcesados[canal].conversiones += item.convertido;
                    canalesProcesados[canal].pipeline += item.pipeline;
                    canalesProcesados[canal].cerrado += item.cerrado;
                    canalesProcesados[canal].por_estado[item.estado] += 1;

                    // 🗺️ PROCESAR POR DISTRITO (TODOS los prospectos - intención de compra histórica)
                    if (!distritosProcesados[distrito]) {
                        distritosProcesados[distrito] = {
                            nombre: distrito,
                            total_prospectos: 0,
                            conversiones: 0,
                            valor_estimado_total: 0
                        };
                    }

                    distritosProcesados[distrito].total_prospectos += item.total;
                    distritosProcesados[distrito].conversiones += item.convertido;
                    distritosProcesados[distrito].valor_estimado_total += (item.valor_estimado || 0);

                    // 🏛️ PROCESAR POR DEPARTAMENTO (TODOS los prospectos - intención de compra histórica)
                    if (!departamentosProcesados[departamento]) {
                        departamentosProcesados[departamento] = {
                            departamento: departamento,
                            total_prospectos: 0,
                            conversiones: 0,
                            valor_estimado_total: 0,
                            ciudades: new Set(),
                            asesores_activos: 1
                        };
                    }

                    // 📍 CONTAR TODOS LOS PROSPECTOS (intención de compra total)
                    departamentosProcesados[departamento].total_prospectos += item.total;
                    departamentosProcesados[departamento].conversiones += item.convertido;
                    departamentosProcesados[departamento].valor_estimado_total += (item.valor_estimado || 0);
                    departamentosProcesados[departamento].ciudades.add(ciudad);

                    // 📈 DATOS TEMPORALES
                    datosTemporales.push({
                        mes: mes,
                        canal: canal,
                        estado: item.estado,
                        valor: item.valor_estimado || 0
                    });
                });
            }

            // 📊 CALCULAR MÉTRICAS UNIFICADAS
            const totalProspectos = parseInt(datos.total_prospectos) || 0;
            const conversionesReales = parseInt(datos.conversiones_reales) || 0;
            const totalSeguimientos = parseInt(datos.total_seguimientos) || 0;
            const seguimientosExitosos = parseInt(datos.seguimientos_exitosos) || 0;

            const metricas = {
                tasa_conversion_real: totalProspectos > 0 ? ((conversionesReales / totalProspectos) * 100).toFixed(2) : 0,
                pipeline_activo: parseFloat(datos.pipeline_activo) || 0,
                ventas_cerradas: parseFloat(datos.ventas_cerradas_valor) || 0,
                cantidad_cerradas: parseInt(datos.ventas_cerradas_cantidad) || 0,
                efectividad_seguimientos: totalSeguimientos > 0 ? ((seguimientosExitosos / totalSeguimientos) * 100).toFixed(2) : 0,

                // 📈 RECOMENDACIONES INTELIGENTES
                recomendaciones: ProspectosController.generarRecomendacionesUnificadas({
                    tasaConversion: parseFloat(((conversionesReales / totalProspectos) * 100).toFixed(2)),
                    efectividadSeguimientos: parseFloat(((seguimientosExitosos / totalSeguimientos) * 100).toFixed(2)),
                    pipelineActivo: parseFloat(datos.pipeline_activo) || 0,
                    canales: Object.values(canalesProcesados)
                })
            };

            // 🏆 PROCESAR CANALES EXPANDIDOS
            const canales = Object.values(canalesProcesados).map(canal => ({
                ...canal,
                tasa_conversion: canal.total_prospectos > 0 ?
                    ((canal.conversiones / canal.total_prospectos) * 100).toFixed(2) : 0
            })).sort((a, b) => b.total_prospectos - a.total_prospectos);

            // 🗺️ PROCESAR DATOS GEOGRÁFICOS (distritos)
            const geograficos = Object.values(distritosProcesados)
                .map(distrito => ({
                    ...distrito,
                    tasa_conversion: distrito.total_prospectos > 0 ?
                        ((distrito.conversiones / distrito.total_prospectos) * 100).toFixed(2) : 0
                }))
                .sort((a, b) => b.total_prospectos - a.total_prospectos);

            // 🏛️ PROCESAR DATOS POR DEPARTAMENTOS (para el mapa de PROSPECTOS)
            const departamentos = Object.values(departamentosProcesados)
                .map(dept => ({
                    ...dept,
                    ciudades: dept.ciudades.size,
                    // ✅ Ticket promedio basado en PROSPECTOS (no solo ventas)
                    ticket_promedio: dept.total_prospectos > 0 ? dept.valor_estimado_total / dept.total_prospectos : 0,
                    // ✅ Mantener compatibilidad con componente mapa (que espera total_ventas)
                    total_ventas: dept.total_prospectos,
                    ingresos_totales: dept.valor_estimado_total
                }))
                .sort((a, b) => b.valor_estimado_total - a.valor_estimado_total);

            // 📈 PROCESAR DATOS TEMPORALES
            const temporales = datosTemporales.reduce((acc, item) => {
                if (!acc[item.mes]) {
                    acc[item.mes] = { mes: item.mes, total_prospectos: 0, total_valor: 0, por_canal: {} };
                }
                acc[item.mes].total_prospectos += 1;
                acc[item.mes].total_valor += item.valor;

                if (!acc[item.mes].por_canal[item.canal]) {
                    acc[item.mes].por_canal[item.canal] = 0;
                }
                acc[item.mes].por_canal[item.canal] += 1;
                return acc;
            }, {});

            // 💡 INSIGHTS AUTOMATIZADOS EXPANDIDOS
            const insights = ProspectosController.generarInsightsUnificadosExpandidos(
                metricas, canales, geograficos
            );

            res.json({
                success: true,
                data: {
                    // 📊 DATOS EXISTENTES
                    metricas,
                    canales: canales.slice(0, 8), // Top 8 canales
                    insights,

                    // 🆕 NUEVOS DATOS PARA GRÁFICOS
                    geograficos: geograficos.slice(0, 10), // Top 10 distritos
                    departamentos: departamentos, // Datos agrupados por departamento para el mapa
                    evolucion_temporal: Object.values(temporales)
                        .sort((a, b) => a.mes.localeCompare(b.mes))
                        .slice(-12), // Últimos 12 meses

                    // 📅 METADATA
                    periodo,
                    fecha_actualizacion: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Error en obtenerAnalyticsCompletos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener analytics completos: ' + error.message
            });
        }
    }

    /**
     * 🧠 Generar recomendaciones inteligentes unificadas
     */
    static generarRecomendacionesUnificadas({ tasaConversion, efectividadSeguimientos, pipelineActivo, canales }) {
        const recomendaciones = [];

        if (tasaConversion < 15) {
            recomendaciones.push('🎯 Tu tasa de conversión está baja. Enfócate en calificar mejor tus prospectos antes del seguimiento.');
        }

        if (efectividadSeguimientos < 30) {
            recomendaciones.push('📞 Mejora la calidad de tus seguimientos. Considera usar scripts o capacitarte en técnicas de cierre.');
        }

        if (pipelineActivo > 50000) {
            recomendaciones.push('💰 Tienes un pipeline robusto. Prioriza los prospectos de mayor valor y probabilidad de cierre.');
        }

        const mejorCanal = canales.length > 0 ? canales[0] : null;
        if (mejorCanal && parseFloat(mejorCanal.tasa_conversion) > 50) {
            recomendaciones.push(`📱 ${mejorCanal.nombre} es tu canal más efectivo. Considera invertir más recursos en este canal.`);
        }

        if (recomendaciones.length === 0) {
            recomendaciones.push('🚀 ¡Excelente rendimiento! Mantén la consistencia en tu estrategia actual.');
        }

        return recomendaciones;
    }

    /**
     * 💡 Generar insights automatizados unificados
     */
    static generarInsightsUnificados(metricas, canales) {
        const insights = [];

        // Insight de conversión
        const tasaConversion = parseFloat(metricas.tasa_conversion_real);
        if (tasaConversion >= 25) {
            insights.push({
                tipo: 'success',
                titulo: 'Excelente Tasa de Conversión',
                descripcion: `Con ${tasaConversion}% estás por encima del promedio del mercado.`,
                accion: 'Documenta tu proceso para replicarlo'
            });
        } else if (tasaConversion < 10) {
            insights.push({
                tipo: 'warning',
                titulo: 'Oportunidad de Mejora',
                descripcion: `Tu tasa de conversión (${tasaConversion}%) tiene potencial de crecimiento.`,
                accion: 'Analiza tu proceso de calificación de prospectos'
            });
        }

        // Insight de efectividad
        const efectividad = parseFloat(metricas.efectividad_seguimientos);
        if (efectividad < 20) {
            insights.push({
                tipo: 'warning',
                titulo: 'Seguimientos Poco Efectivos',
                descripcion: `Solo ${efectividad}% de tus seguimientos resultan en conversión.`,
                accion: 'Revisa la calidad y timing de tus seguimientos'
            });
        }

        // Insight de canales
        if (canales.length >= 3) {
            const mejorCanal = canales[0];
            insights.push({
                tipo: 'info',
                titulo: `${mejorCanal.nombre} es tu mejor canal`,
                descripcion: `Genera ${mejorCanal.roi}% de ROI con ${mejorCanal.tasa_conversion}% de conversión.`,
                accion: 'Considera incrementar tu inversión en este canal'
            });
        }

        return insights;
    }

    /**
     * 🔥 NUEVA: Generar insights expandidos con datos geográficos y productos
     */
    static generarInsightsUnificadosExpandidos(metricas, canales, geograficos) {
        const insights = [];

        // Insight de conversión general
        const conversionRate = parseFloat(metricas.tasa_conversion_real);
        if (conversionRate >= 70) {
            insights.push({
                tipo: 'success',
                titulo: 'Excelente Tasa de Conversión',
                descripcion: `Con ${conversionRate}% estás por encima del promedio del mercado.`,
                accion: 'Documenta tu proceso para replicarlo'
            });
        } else if (conversionRate < 30) {
            insights.push({
                tipo: 'warning',
                titulo: 'Conversión Baja',
                descripcion: `${conversionRate}% puede mejorar significativamente.`,
                accion: 'Revisa tu proceso de calificación de prospectos'
            });
        }

        // Insight del mejor canal
        if (canales.length > 0) {
            const mejorCanal = canales[0];
            insights.push({
                tipo: 'info',
                titulo: `${mejorCanal.nombre} es tu mejor canal`,
                descripcion: `${mejorCanal.total_prospectos} prospectos con ${mejorCanal.tasa_conversion}% de conversión.`,
                accion: 'Considera enfocar más recursos en este canal'
            });
        }

        // Insight geográfico
        if (geograficos.length > 0) {
            const mejorDistrito = geograficos[0];
            insights.push({
                tipo: 'tip',
                titulo: `${mejorDistrito.nombre} lidera geográficamente`,
                descripcion: `${mejorDistrito.total_prospectos} prospectos con ${mejorDistrito.tasa_conversion}% de conversión.`,
                accion: 'Evalúa replicar esta estrategia en otras zonas'
            });
        }

        // Insight adicional basado en datos disponibles
        if (canales.length > 1 && geograficos.length > 1) {
            const totalProspectos = geograficos.reduce((sum, g) => sum + g.total_prospectos, 0);
            insights.push({
                tipo: 'tip',
                titulo: 'Diversificación geográfica exitosa',
                descripcion: `Tienes presencia en ${geograficos.length} zonas con ${totalProspectos} prospectos.`,
                accion: 'Mantén esta diversificación para reducir riesgos'
            });
        }

        return insights;
    }

    /**
     * GET /api/prospectos/health
     * Health check del módulo - MEJORADO
     */
    static async healthCheck(req, res) {
        try {
            // Verificar conexión con base de datos
            const countResult = await query('SELECT COUNT(*) as total FROM prospectos WHERE activo = $1', [true]);
            const count = parseInt(countResult.rows[0].total);

            // Debug de usuario autenticado
            if (req.user) {
                console.log('🔐 Usuario autenticado en health:', {
                    user_id: req.user.user_id,
                    nombre: req.user.nombre_completo,
                    rol: req.user.rol
                });
            }

            // Obtener estadísticas del cache
            const cacheStats = await cacheService.obtenerEstadisticas();

            res.json({
                success: true,
                module: 'Prospectos',
                status: 'Operativo',
                timestamp: obtenerFechaPeruISO(), // Usar fecha Peru
                timezone: 'America/Lima (UTC-5)',
                version: '1.0.3 (PostgreSQL + Redis Cache)',
                integraciones: {
                    ventas_module: 'ConversionService integrado ✅',
                    conversion_automatica: 'Activa ✅',
                    conversion_manual: 'Disponible ✅',
                    redis_cache: cacheService.isAvailable() ? 'Activo ✅' : 'Desconectado ⚠️'
                },
                cache_performance: {
                    estado: cacheStats.estado,
                    claves_activas: cacheStats.total_claves || 0,
                    tipos_cache: cacheStats.tipos || {},
                    rendimiento_estimado: cacheService.isAvailable() ? '10x más rápido' : 'Sin optimización'
                },
                data: {
                    total_prospectos: count,
                    estados_disponibles: ['Prospecto', 'Cotizado', 'Negociacion', 'Cerrado', 'Perdido'],
                    funcionalidades: [
                        'Pipeline Kanban',
                        'Detección de duplicados',
                        'Métricas en tiempo real',
                        'Filtros por fecha/antigüedad',
                        'Conversión automática a ventas ✨',
                        'Conversión manual a ventas ✨',
                        'Sistema de seguimientos automáticos',
                        'Timezone Peru (UTC-5) integrado',
                        'Cache inteligente Redis ⚡',
                        'Invalidación automática de cache ⚡'
                    ]
                }
            });

        } catch (error) {
            logger.error('Error en health check:', error);
            res.status(500).json({
                success: false,
                module: 'Prospectos',
                status: 'Error',
                timestamp: obtenerFechaPeruISO(),
                error: error.message
            });
        }
    }

    /**
     * POST /api/prospectos/seguimientos/corregir-null
     * Script para corregir seguimientos null en prospectos existentes
     */
    static async corregirSeguimientosNull(req, res) {
        try {
            logger.info('🔧 Iniciando corrección de seguimientos null...');
            
            // Buscar prospectos con seguimiento_obligatorio null
            const prospectosResult = await query(`
                SELECT id, codigo, created_at, fecha_contacto 
                FROM prospectos 
                WHERE seguimiento_obligatorio IS NULL AND activo = $1
            `, [true]);

            const prospectosNull = prospectosResult.rows;

            logger.info(`📊 Encontrados ${prospectosNull.length} prospectos para corregir`);

            let corregidos = 0;
            for (const prospecto of prospectosNull) {
                try {
                    // Calcular seguimiento_obligatorio basado en fecha_contacto + 24h (Peru timezone)
                    const fechaBase = new Date(prospecto.fecha_contacto || prospecto.created_at);
                    const fechaSeguimiento = new Date(fechaBase.getTime() + (24 * 60 * 60 * 1000));
                    
                    await query(
                        'UPDATE prospectos SET seguimiento_obligatorio = $1 WHERE id = $2',
                        [fechaSeguimiento.toISOString(), prospecto.id]
                    );

                    logger.info(`✅ Corregido ${prospecto.codigo}: ${fechaSeguimiento.toISOString()}`);
                    corregidos++;
                } catch (updateError) {
                    logger.error(`❌ Error corrigiendo ${prospecto.codigo}:`, updateError);
                }
            }

            logger.info(`🎯 Corrección completada: ${corregidos}/${prospectosNull.length} prospectos`);
            
            res.json({
                success: true,
                message: 'Corrección de seguimientos completada',
                data: {
                    total_encontrados: prospectosNull.length,
                    total_corregidos: corregidos,
                    timestamp: obtenerFechaPeruISO()
                }
            });
            
        } catch (error) {
            logger.error('❌ Error en corrección:', error);
            res.status(500).json({
                success: false,
                error: 'Error al corregir seguimientos: ' + error.message
            });
        }
    }

    /**
     * 🚀 MÉTODO SUPERIOR UNIFICADO - VERSIÓN FINAL
     * POST /api/prospectos/seguimientos/procesar-vencidos
     * Procesar seguimientos vencidos con configuración flexible
     */
    static async procesarSeguimientosVencidos(req, res) {
        try {
            // Extraer configuración del request (con defaults seguros)
            const {
                modo = 'basico',                    // 'basico' | 'mejorado'
                incluir_notificaciones = false,
                generar_estadisticas = false,
                crear_reporte_detallado = false,
                filtros = {}
            } = req.body;

            const fechaActual = obtenerFechaPeruISO();
            
            logger.info(`🔄 Procesando seguimientos vencidos (modo: ${modo})...`);
            
            // 1. IDENTIFICAR SEGUIMIENTOS VENCIDOS (lógica base compartida)
            let sqlQuery = `
                SELECT 
                    id, codigo, nombre_cliente, apellido_cliente, telefono, 
                    asesor_id, asesor_nombre, seguimiento_obligatorio,
                    estado, valor_estimado, canal_contacto, empresa
                FROM prospectos
                WHERE seguimiento_obligatorio < $1 
                AND seguimiento_completado = $2 
                AND seguimiento_vencido = $3
                AND activo = $4
                AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
            `;
            
            let params = [fechaActual, false, false, true];
            let paramIndex = 5;

            // APLICAR FILTROS ADICIONALES si se proporcionan
            if (filtros.asesor_id) {
                sqlQuery += ` AND asesor_id = $${paramIndex}`;
                params.push(filtros.asesor_id);
                paramIndex++;
                logger.info(`🎯 Filtrando por asesor: ${filtros.asesor_id}`);
            }
            
            if (filtros.valor_minimo) {
                sqlQuery += ` AND valor_estimado >= $${paramIndex}`;
                params.push(filtros.valor_minimo);
                paramIndex++;
                logger.info(`💰 Filtrando por valor mínimo: ${filtros.valor_minimo}`);
            }

            if (filtros.estado_especifico) {
                sqlQuery += ` AND estado = $${paramIndex}`;
                params.push(filtros.estado_especifico);
                paramIndex++;
            }

            const result = await query(sqlQuery, params);
            const seguimientosVencidos = result.rows;

            // CASO: No hay seguimientos vencidos
            if (!seguimientosVencidos || seguimientosVencidos.length === 0) {
                return res.json({
                    success: true,
                    message: '✅ No hay seguimientos vencidos por procesar',
                    data: {
                        total_procesados: 0,
                        exitosos: 0,
                        errores: 0,
                        modo_ejecutado: modo,
                        filtros_aplicados: Object.keys(filtros).length > 0 ? filtros : null,
                        timestamp: fechaActual
                    }
                });
            }

            logger.info(`📊 Encontrados ${seguimientosVencidos.length} seguimientos vencidos`);

            // 2. PROCESAMIENTO CORE (común para todos los modos)
            const resultados = [];
            let exitosos = 0;
            let errores = 0;
            
            for (const prospecto of seguimientosVencidos) {
                try {
                    // Update usando PostgreSQL
                    await query(`
                        UPDATE prospectos 
                        SET seguimiento_vencido = $1, fecha_ultima_actualizacion = $2 
                        WHERE id = $3
                    `, [true, fechaActual, prospecto.id]);

                    // Calcular días vencido
                    const diasVencido = Math.floor(
                        (new Date(fechaActual) - new Date(prospecto.seguimiento_obligatorio)) / (1000 * 60 * 60 * 24)
                    );

                    // RESPUESTA DIFERENCIADA POR MODO
                    const resultado = {
                        prospecto_id: prospecto.id,
                        codigo: prospecto.codigo,
                        nombre: prospecto.nombre_cliente,
                        asesor: prospecto.asesor_nombre,
                        status: 'success'
                    };

                    if (modo === 'basico') {
                        // MODO BÁSICO: Información mínima, respuesta rápida
                        resultado.mensaje = `✅ Procesado exitosamente`;
                    } else {
                        // MODO MEJORADO: Información detallada
                        resultado.telefono = prospecto.telefono;
                        resultado.valor_estimado = prospecto.valor_estimado;
                        resultado.dias_vencido = diasVencido;
                        resultado.empresa = prospecto.empresa;
                        resultado.canal_contacto = prospecto.canal_contacto;
                        resultado.mensaje = `✅ Procesado exitosamente - ${diasVencido} días vencido`;
                    }

                    resultados.push(resultado);
                    exitosos++;

                    logger.info(`✅ Procesado: ${prospecto.codigo} - ${prospecto.nombre_cliente}`);

                } catch (updateError) {
                    const errorResult = {
                        prospecto_id: prospecto.id,
                        codigo: prospecto.codigo,
                        nombre: prospecto.nombre_cliente,
                        status: 'error',
                        mensaje: `❌ Error: ${updateError.message}`
                    };

                    resultados.push(errorResult);
                    errores++;
                    logger.error(`❌ Error procesando ${prospecto.codigo}:`, updateError);
                }
            }

            // 3. PREPARAR RESPUESTA BASE
            const respuestaBase = {
                success: true,
                message: `🎯 Procesamiento completado (${modo}): ${exitosos}/${seguimientosVencidos.length} seguimientos`,
                data: {
                    total_procesados: seguimientosVencidos.length,
                    exitosos: exitosos,
                    errores: errores,
                    modo_ejecutado: modo,
                    filtros_aplicados: Object.keys(filtros).length > 0 ? filtros : null,
                    timestamp: fechaActual
                }
            };

            // 4. FUNCIONALIDADES ADICIONALES OPCIONALES

            // ESTADÍSTICAS DETALLADAS (si se solicita o es modo mejorado)
            if (generar_estadisticas || modo === 'mejorado') {
                const valorTotalAfectado = seguimientosVencidos.reduce((sum, p) => 
                    sum + (parseFloat(p.valor_estimado) || 0), 0
                );

                const asesoresAfectados = [...new Set(seguimientosVencidos.map(p => p.asesor_id))];
                
                respuestaBase.data.estadisticas = {
                    valor_total_afectado: valorTotalAfectado,
                    asesores_afectados: asesoresAfectados.length,
                    tasa_exito: seguimientosVencidos.length > 0 ? 
                        ((exitosos / seguimientosVencidos.length) * 100).toFixed(1) + '%' : '0%',
                    promedio_dias_vencido: resultados
                        .filter(r => r.dias_vencido)
                        .reduce((sum, r) => sum + r.dias_vencido, 0) / 
                        Math.max(resultados.filter(r => r.dias_vencido).length, 1),
                    distribucion_por_asesor: asesoresAfectados.map(asesorId => {
                        const prospectosAsesor = seguimientosVencidos.filter(p => p.asesor_id === asesorId);
                        return {
                            asesor_id: asesorId,
                            asesor_nombre: prospectosAsesor[0]?.asesor_nombre || 'Desconocido',
                            cantidad: prospectosAsesor.length,
                            valor_total: prospectosAsesor.reduce((sum, p) => sum + (parseFloat(p.valor_estimado) || 0), 0)
                        };
                    })
                };

                logger.info(`📈 Estadísticas generadas: $${valorTotalAfectado} afectados, ${asesoresAfectados.length} asesores`);
            }

            // NOTIFICACIONES AUTOMÁTICAS (si se solicita)
            if (incluir_notificaciones) {
                const notificacionesCreadas = [];
                const asesoresInfo = respuestaBase.data.estadisticas?.distribucion_por_asesor || [];
                
                for (const asesorInfo of asesoresInfo) {
                    try {
                        const prioridad = asesorInfo.valor_total > 2000 ? 'alta' : 
                                         asesorInfo.cantidad > 3 ? 'media' : 'normal';

                        const insertResult = await query(`
                            INSERT INTO notificaciones (
                                usuario_id, tipo, titulo, mensaje, datos_adicionales, 
                                prioridad, accion_url, accion_texto
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            RETURNING *
                        `, [
                            asesorInfo.asesor_id,
                            'seguimiento_vencido',
                            `⚠️ Seguimientos Vencidos (${asesorInfo.cantidad})`,
                            `Tienes ${asesorInfo.cantidad} seguimiento(s) vencido(s) que requieren atención inmediata por un valor de $${asesorInfo.valor_total.toLocaleString()}`,
                            JSON.stringify({
                                cantidad_vencidos: asesorInfo.cantidad,
                                valor_total: asesorInfo.valor_total,
                                procesamiento_id: `proc_${Date.now()}`,
                                timestamp: fechaActual
                            }),
                            prioridad,
                            '/prospectos?tab=seguimientos',
                            'Ver Seguimientos'
                        ]);

                        if (insertResult.rows && insertResult.rows.length > 0) {
                            const notificacion = insertResult.rows[0];
                            notificacionesCreadas.push({
                                asesor_id: asesorInfo.asesor_id,
                                asesor_nombre: asesorInfo.asesor_nombre,
                                notificacion_id: notificacion.id,
                                cantidad_vencidos: asesorInfo.cantidad,
                                prioridad: prioridad
                            });
                            
                            logger.info(`🔔 Notificación creada para ${asesorInfo.asesor_nombre}: ${asesorInfo.cantidad} seguimientos (${prioridad})`);
                        }

                    } catch (notifError) {
                        logger.error(`❌ Error creando notificación para asesor ${asesorInfo.asesor_id}:`, notifError);
                    }
                }

                respuestaBase.data.notificaciones_enviadas = notificacionesCreadas;
                logger.info(`📬 ${notificacionesCreadas.length} notificaciones enviadas`);
            }

            // REPORTE DETALLADO (si se solicita o es modo mejorado)
            if (crear_reporte_detallado || modo === 'mejorado') {
                respuestaBase.data.prospectos = resultados;
                
                respuestaBase.data.resumen = {
                    titulo: `🎯 Procesamiento Completado (${modo.toUpperCase()})`,
                    descripcion: exitosos > 0 ? 
                        `Se procesaron ${exitosos} seguimientos vencidos exitosamente de ${seguimientosVencidos.length} encontrados.` :
                        'No se pudieron procesar seguimientos en este momento. Revisar logs para más detalles.',
                    proximos_pasos: [
                        '📋 Los seguimientos han sido marcados como vencidos',
                        '📈 El dashboard refleja los cambios automáticamente',
                        ...(respuestaBase.data.notificaciones_enviadas?.length > 0 ? 
                            [`🔔 ${respuestaBase.data.notificaciones_enviadas.length} notificaciones enviadas a asesores`] : []),
                        '⏰ Se recomienda hacer seguimiento inmediato a los prospectos afectados',
                        ...(respuestaBase.data.estadisticas?.valor_total_afectado > 2000 ? 
                            ['🚨 ALTA PRIORIDAD: Valor total en riesgo superior a $2,000'] : [])
                    ],
                    timestamp: fechaActual,
                    criticidad: exitosos > 0 ? 
                        (respuestaBase.data.estadisticas?.valor_total_afectado > 2000 ? 'alta' :
                         respuestaBase.data.estadisticas?.valor_total_afectado > 1000 ? 'media' : 'normal') : 'baja'
                };
            }

            // ALERTAS AUTOMÁTICAS (solo en modo mejorado)
            if (modo === 'mejorado') {
                respuestaBase.data.alertas = {
                    valor_alto_riesgo: (respuestaBase.data.estadisticas?.valor_total_afectado || 0) > 2000,
                    multiples_asesores_afectados: (respuestaBase.data.estadisticas?.asesores_afectados || 0) > 3,
                    tasa_error_alta: errores > (seguimientosVencidos.length * 0.1),
                    seguimientos_muy_vencidos: resultados.some(r => r.dias_vencido && r.dias_vencido > 30)
                };
            }

            // LOG FINAL UNIFICADO
            logger.info(`📊 Procesamiento ${modo} completado:`, {
                total: seguimientosVencidos.length,
                exitosos,
                errores,
                filtros: Object.keys(filtros).length > 0 ? filtros : 'ninguno',
                estadisticas_incluidas: !!respuestaBase.data.estadisticas,
                notificaciones_enviadas: respuestaBase.data.notificaciones_enviadas?.length || 0,
                valor_afectado: respuestaBase.data.estadisticas?.valor_total_afectado || 0
            });

            res.json(respuestaBase);

        } catch (error) {
            logger.error('❌ Error en procesarSeguimientosVencidos unificado:', error);
            res.status(500).json({
                success: false,
                message: '❌ Error procesando seguimientos vencidos',
                error: error.message,
                data: {
                    total_procesados: 0,
                    exitosos: 0,
                    errores: 1,
                    modo_ejecutado: req.body.modo || 'basico',
                    filtros_aplicados: req.body.filtros || null,
                    timestamp: obtenerFechaPeruISO()
                }
            });
        }
    }

    // ============================================================================
    // 🆕 SISTEMA DE MODO LIBRE Y HISTORIAL DE REASIGNACIONES
    // ============================================================================

    /**
     * 🔧 MÉTODO HELPER: Inicializar tracking cuando prospecto entra en modo libre
     * Debe llamarse cada vez que un prospecto cambia a modo_libre = true
     */
    static async inicializarModoLibre(prospecto_id, asesor_anterior_id, motivo = 'Reasignación automática') {
        try {
            // Verificar si ya existe un registro activo
            const existente = await query(
                'SELECT id FROM prospecto_modo_libre WHERE prospecto_id = $1 AND activo = true',
                [prospecto_id]
            );

            if (existente.rows.length > 0) {
                // Ya existe, solo actualizar la fecha
                await query(`
                    UPDATE prospecto_modo_libre
                    SET fecha_inicio_modo_libre = NOW()
                    WHERE prospecto_id = $1 AND activo = true
                `, [prospecto_id]);

                logger.info(`♻️ Prospecto ${prospecto_id} reactivado en modo libre`);
            } else {
                // Crear nuevo registro
                await query(`
                    INSERT INTO prospecto_modo_libre (
                        prospecto_id,
                        asesores_con_acceso,
                        fecha_inicio_modo_libre,
                        activo,
                        cerrado
                    ) VALUES ($1, ARRAY[$2::integer], NOW(), true, false)
                `, [
                    prospecto_id,
                    asesor_anterior_id
                ]);

                logger.info(`🆕 Prospecto ${prospecto_id} inicializado en modo libre`);
            }

            return { success: true };
        } catch (error) {
            logger.error('Error en inicializarModoLibre:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔧 MÉTODO HELPER: Registrar que un asesor vio un prospecto en modo libre
     * Útil para analytics y detectar interés múltiple
     */
    static async registrarVisualizacionModoLibre(prospecto_id, asesor_id, asesor_nombre) {
        try {
            await query(`
                UPDATE prospecto_modo_libre
                SET asesores_con_acceso = array_append(
                        CASE
                            WHEN $2 = ANY(asesores_con_acceso) THEN asesores_con_acceso
                            ELSE asesores_con_acceso
                        END,
                        CASE
                            WHEN $2 = ANY(asesores_con_acceso) THEN NULL
                            ELSE $2
                        END
                    ),
                    interacciones_simultaneas =
                        COALESCE(interacciones_simultaneas, '{}'::jsonb) ||
                        jsonb_build_object($2::text, jsonb_build_object(
                            'timestamp', NOW(),
                            'accion', 'visualizacion',
                            'asesor_nombre', $3
                        ))
                WHERE prospecto_id = $1 AND activo = true
            `, [prospecto_id, asesor_id, asesor_nombre]);

            return { success: true };
        } catch (error) {
            logger.error('Error en registrarVisualizacionModoLibre:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * POST /api/prospectos/:id/tomar
     * Tomar un prospecto en modo libre (asignarlo al asesor actual)
     * 🔒 PROTEGIDO CONTRA RACE CONDITIONS con transacción SQL
     */
    static async tomarProspecto(req, res) {
        const client = await pool.connect();

        try {
            const { id } = req.params;
            const asesor_id = req.user.id;
            const asesor_nombre = `${req.user.nombre} ${req.user.apellido || ''}`.trim();

            // 🔒 INICIAR TRANSACCIÓN ATÓMICA
            await client.query('BEGIN');

            // 🎯 SELECT FOR UPDATE: Bloquear el prospecto para esta transacción
            const prospectoResult = await client.query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = true FOR UPDATE',
                [id]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const prospecto = prospectoResult.rows[0];

            // ❌ VALIDAR: Prospecto ya no está disponible
            if (!prospecto.modo_libre) {
                await client.query('ROLLBACK');

                logger.warn(`❌ Intento fallido: Asesor ${asesor_id} intentó tomar prospecto ${prospecto.codigo} ya tomado por ${prospecto.asesor_nombre}`);

                return res.status(400).json({
                    success: false,
                    error: 'Este prospecto ya fue tomado por otro asesor',
                    tomado_por: prospecto.asesor_nombre,
                    codigo: prospecto.codigo
                });
            }

            // ✅ ASIGNAR EL PROSPECTO (salir de modo libre)
            const updateResult = await client.query(`
                UPDATE prospectos
                SET modo_libre = false,
                    asesor_id = $1,
                    asesor_nombre = $2,
                    fecha_modo_libre = NULL
                WHERE id = $3
                RETURNING *
            `, [asesor_id, asesor_nombre, id]);

            const prospectoActualizado = updateResult.rows[0];

            // 📊 REGISTRAR EN prospecto_modo_libre quién ganó
            await client.query(`
                UPDATE prospecto_modo_libre
                SET asesor_ganador_id = $1,
                    fecha_cierre = NOW(),
                    cerrado = true,
                    activo = false
                WHERE prospecto_id = $2 AND activo = true
            `, [asesor_id, id]);

            // 📝 Crear seguimiento automático
            // 🕐 Programar para 2 días laborales desde ahora
            const ahora = new Date();
            const fechaProgramada = calcular2DiasLaborales(ahora);
            // fecha_limite: 4h después de la fecha programada (alerta al asesor)
            const { calcularFechaLimite } = require('../utils/fechasHelper');
            const fechaLimite = calcularFechaLimite(fechaProgramada.toISOString(), 'Llamada');

            await client.query(`
                INSERT INTO seguimientos (
                    prospecto_id, asesor_id, fecha_programada, fecha_limite,
                    tipo, descripcion, completado, visible_para_asesor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                id,
                asesor_id,
                fechaProgramada.toISOString(),
                fechaLimite, // calcularFechaLimite ya devuelve ISO string
                'Llamada',
                'Seguimiento después de tomar prospecto en modo libre',
                false,
                true
            ]);

            // ✅ COMMIT: Todo exitoso
            await client.query('COMMIT');

            // 🔄 INVALIDAR CACHE: Para que el kanban se actualice inmediatamente
            await cacheService.invalidarPorAsesor(asesor_id);

            logger.info(`✅ Prospecto ${prospecto.codigo} tomado por ${asesor_nombre} desde modo libre`);

            res.json({
                success: true,
                message: 'Prospecto asignado exitosamente',
                data: {
                    prospecto_id: id,
                    codigo: prospecto.codigo,
                    nombre_cliente: prospecto.nombre_cliente,
                    nuevo_asesor: asesor_nombre,
                    proximo_seguimiento: fechaProgramada
                }
            });

        } catch (error) {
            // ❌ ROLLBACK en caso de error
            await client.query('ROLLBACK');
            logger.error('Error en tomarProspecto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al tomar prospecto: ' + error.message
            });
        } finally {
            client.release();
        }
    }

    /**
     * GET /api/prospectos/disponibles
     * Listar todos los prospectos en modo libre (disponibles para tomar)
     */
    static async obtenerDisponibles(req, res) {
        try {
            const result = await query(`
                SELECT
                    p.id,
                    p.codigo,
                    p.nombre_cliente,
                    p.apellido_cliente,
                    p.empresa,
                    p.telefono,
                    p.email,
                    p.valor_estimado,
                    p.probabilidad_cierre,
                    p.numero_reasignaciones,
                    p.fecha_modo_libre,
                    p.canal_contacto,
                    p.estado,
                    p.created_at,
                    -- Calcular hace cuánto tiempo está disponible
                    EXTRACT(EPOCH FROM (NOW() - p.fecha_modo_libre))/3600 as horas_disponible
                FROM prospectos p
                WHERE p.modo_libre = true
                AND p.activo = true
                AND p.estado NOT IN ('Cerrado', 'Perdido')
                ORDER BY p.valor_estimado DESC, p.fecha_modo_libre ASC
            `);

            const prospectos = result.rows.map(p => ({
                ...p,
                horas_disponible: Math.round(p.horas_disponible || 0),
                valor_estimado: parseFloat(p.valor_estimado || 0)
            }));

            res.json({
                success: true,
                data: prospectos,
                total: prospectos.length,
                valor_total_disponible: prospectos.reduce((sum, p) => sum + p.valor_estimado, 0)
            });

        } catch (error) {
            logger.error('Error en obtenerDisponibles:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener prospectos disponibles: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/mis-perdidos/:asesor_id
     * Obtener prospectos que el asesor perdió por reasignación
     */
    static async obtenerMisPerdidos(req, res) {
        try {
            const { asesor_id } = req.params;
            const { limit = 50 } = req.query;

            const result = await query(`
                SELECT
                    p.id,
                    p.codigo,
                    p.nombre_cliente,
                    p.apellido_cliente,
                    p.empresa,
                    p.valor_estimado,
                    p.probabilidad_cierre,
                    p.estado as estado_actual,
                    p.asesor_nombre as asesor_actual,
                    nr.motivo as motivo_reasignacion,
                    nr.fecha_reasignacion as fecha_que_lo_perdi,
                    nr.asesor_gano_id,
                    u_gano.nombre || ' ' || u_gano.apellido as nuevo_asesor_nombre,
                    EXTRACT(EPOCH FROM (nr.fecha_reasignacion - p.created_at))/86400 as dias_que_lo_tuve
                FROM notificaciones_reasignacion nr
                INNER JOIN prospectos p ON nr.prospecto_id = p.id
                LEFT JOIN usuarios u_gano ON nr.asesor_gano_id = u_gano.id
                WHERE nr.tipo = 'perdida'
                AND nr.asesor_perdio_id = $1
                ORDER BY nr.fecha_reasignacion DESC
                LIMIT $2
            `, [asesor_id, limit]);

            const prospectos_perdidos = result.rows.map(p => ({
                ...p,
                dias_que_lo_tuve: parseFloat((p.dias_que_lo_tuve || 0).toFixed(1)),
                valor_estimado: parseFloat(p.valor_estimado || 0)
            }));

            const valor_total_perdido = prospectos_perdidos.reduce((sum, p) => sum + p.valor_estimado, 0);

            res.json({
                success: true,
                data: {
                    prospectos_perdidos,
                    total: prospectos_perdidos.length,
                    valor_total_perdido
                }
            });

        } catch (error) {
            logger.error('Error en obtenerMisPerdidos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener prospectos perdidos: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/:id/historial-reasignaciones
     * Obtener historial completo de reasignaciones de un prospecto
     */
    static async obtenerHistorialReasignaciones(req, res) {
        try {
            const { id } = req.params;

            // Obtener datos del prospecto
            const prospectoResult = await query(
                'SELECT codigo, nombre_cliente, asesor_nombre, numero_reasignaciones, modo_libre FROM prospectos WHERE id = $1',
                [id]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const prospecto = prospectoResult.rows[0];

            // Obtener historial de reasignaciones
            const historialResult = await query(`
                SELECT
                    nr.id,
                    nr.tipo,
                    nr.motivo,
                    nr.fecha_reasignacion as fecha,
                    nr.asesor_perdio_id,
                    u_perdio.nombre || ' ' || u_perdio.apellido as asesor_perdio_nombre,
                    nr.asesor_gano_id,
                    u_gano.nombre || ' ' || u_gano.apellido as asesor_gano_nombre,
                    nr.titulo,
                    nr.mensaje
                FROM notificaciones_reasignacion nr
                LEFT JOIN usuarios u_perdio ON nr.asesor_perdio_id = u_perdio.id
                LEFT JOIN usuarios u_gano ON nr.asesor_gano_id = u_gano.id
                WHERE nr.prospecto_id = $1
                ORDER BY nr.fecha_reasignacion ASC
            `, [id]);

            // Extraer asesores únicos
            const asesoresSet = new Set();
            historialResult.rows.forEach(r => {
                if (r.asesor_perdio_nombre) asesoresSet.add(r.asesor_perdio_nombre);
                if (r.asesor_gano_nombre) asesoresSet.add(r.asesor_gano_nombre);
            });

            res.json({
                success: true,
                data: {
                    prospecto: {
                        codigo: prospecto.codigo,
                        nombre_cliente: prospecto.nombre_cliente,
                        asesor_actual: prospecto.asesor_nombre,
                        numero_reasignaciones: prospecto.numero_reasignaciones,
                        en_modo_libre: prospecto.modo_libre
                    },
                    historial: historialResult.rows,
                    resumen: {
                        total_reasignaciones: prospecto.numero_reasignaciones,
                        asesores_que_lo_tuvieron: Array.from(asesoresSet)
                    }
                }
            });

        } catch (error) {
            logger.error('Error en obtenerHistorialReasignaciones:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener historial de reasignaciones: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/reasignaciones/metricas
     * Métricas globales de reasignaciones (para admin/jefes)
     */
    static async obtenerMetricasReasignaciones(req, res) {
        try {
            const { periodo = 'mes_actual' } = req.query;

            // Calcular rango de fechas
            let fechaDesde;
            const fechaHasta = new Date();

            switch (periodo) {
                case 'semana_actual':
                    fechaDesde = new Date(fechaHasta.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                case 'mes_pasado':
                    fechaDesde = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() - 1, 1);
                    fechaHasta.setMonth(fechaHasta.getMonth(), 0);
                    break;
                default: // mes_actual
                    fechaDesde = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth(), 1);
            }

            // Métricas globales
            const globalResult = await query(`
                SELECT
                    COUNT(*) as total_reasignaciones,
                    COUNT(DISTINCT prospecto_id) as prospectos_afectados,
                    COUNT(*) FILTER (WHERE tipo = 'modo_libre') as modo_libre_activados
                FROM notificaciones_reasignacion
                WHERE fecha_reasignacion >= $1 AND fecha_reasignacion <= $2
            `, [fechaDesde, fechaHasta]);

            // Métricas por asesor
            const porAsesorResult = await query(`
                SELECT
                    u.id as asesor_id,
                    u.nombre || ' ' || u.apellido as asesor_nombre,
                    COUNT(*) FILTER (WHERE nr.tipo = 'perdida') as prospectos_perdidos,
                    COUNT(*) FILTER (WHERE nr.tipo = 'ganancia') as prospectos_ganados
                FROM usuarios u
                LEFT JOIN notificaciones_reasignacion nr ON
                    (u.id = nr.asesor_perdio_id AND nr.tipo = 'perdida') OR
                    (u.id = nr.asesor_gano_id AND nr.tipo = 'ganancia')
                WHERE nr.fecha_reasignacion >= $1 AND nr.fecha_reasignacion <= $2
                GROUP BY u.id, u.nombre, u.apellido
                HAVING COUNT(*) > 0
                ORDER BY prospectos_perdidos DESC
            `, [fechaDesde, fechaHasta]);

            // Métricas por motivo
            const porMotivoResult = await query(`
                SELECT
                    motivo,
                    COUNT(*) as cantidad
                FROM notificaciones_reasignacion
                WHERE fecha_reasignacion >= $1 AND fecha_reasignacion <= $2
                GROUP BY motivo
                ORDER BY cantidad DESC
            `, [fechaDesde, fechaHasta]);

            const metricas = globalResult.rows[0];
            const porAsesor = porAsesorResult.rows.map(r => ({
                ...r,
                prospectos_perdidos: parseInt(r.prospectos_perdidos || 0),
                prospectos_ganados: parseInt(r.prospectos_ganados || 0),
                neto: parseInt(r.prospectos_ganados || 0) - parseInt(r.prospectos_perdidos || 0)
            }));

            const motivos = {};
            porMotivoResult.rows.forEach(r => {
                motivos[r.motivo] = parseInt(r.cantidad);
            });

            res.json({
                success: true,
                data: {
                    periodo: {
                        tipo: periodo,
                        desde: fechaDesde,
                        hasta: fechaHasta
                    },
                    total_reasignaciones: parseInt(metricas.total_reasignaciones || 0),
                    prospectos_afectados: parseInt(metricas.prospectos_afectados || 0),
                    modo_libre_activados: parseInt(metricas.modo_libre_activados || 0),
                    por_asesor: porAsesor,
                    motivos: motivos
                }
            });

        } catch (error) {
            logger.error('Error en obtenerMetricasReasignaciones:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener métricas de reasignaciones: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/traspasos/consolidado
     * Vista consolidada de todos los prospectos con traspasos (tabla ejecutiva)
     */
    static async obtenerTraspasosConsolidado(req, res) {
        try {
            const {
                periodo = 'mes_actual',
                asesor_origen = null,
                asesor_actual = null,
                min_rebotes = 0,
                busqueda = '',
                limit = 100
            } = req.query;

            // Calcular rango de fechas según período
            let fechaDesde, fechaHasta;
            const hoy = new Date();

            switch (periodo) {
                case 'semana_actual':
                    fechaDesde = new Date(hoy.getTime() - (7 * 24 * 60 * 60 * 1000));
                    fechaHasta = hoy;
                    break;
                case 'mes_pasado':
                    fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                    fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                    break;
                case 'trimestre_actual':
                    const mesActual = hoy.getMonth();
                    const inicioTrimestre = Math.floor(mesActual / 3) * 3;
                    fechaDesde = new Date(hoy.getFullYear(), inicioTrimestre, 1);
                    fechaHasta = hoy;
                    break;
                case 'año_actual':
                    fechaDesde = new Date(hoy.getFullYear(), 0, 1);
                    fechaHasta = hoy;
                    break;
                default: // mes_actual o específico (mes_2024-10)
                    if (periodo.startsWith('mes_') && periodo.length > 11) {
                        const [_, yearMonth] = periodo.split('_');
                        const [year, month] = yearMonth.split('-');
                        fechaDesde = new Date(parseInt(year), parseInt(month) - 1, 1);
                        fechaHasta = new Date(parseInt(year), parseInt(month), 0);
                    } else {
                        fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                        fechaHasta = hoy;
                    }
            }

            // === KPIs GLOBALES ===
            // 1. Total prospectos traspasados VIGENTES (solo los que actualmente tienen traspasos)
            const kpisResult = await query(`
                SELECT
                    COUNT(DISTINCT p.id) as total_prospectos_traspasados,
                    COUNT(*) FILTER (WHERE p.motivo_traspaso = 'seguimiento_vencido') as total_vencidos,
                    COUNT(*) FILTER (WHERE p.modo_libre = true) as total_modo_libre
                FROM prospectos p
                WHERE p.numero_reasignaciones > 0
                  AND p.activo = true
                  AND p.fecha_traspaso >= $1
                  AND p.fecha_traspaso <= $2
            `, [fechaDesde, fechaHasta]);

            // 2. Prospectos actualmente en modo libre
            const modoLibreResult = await query(`
                SELECT
                    COUNT(*) as en_modo_libre,
                    COALESCE(SUM(valor_estimado), 0) as valor_modo_libre
                FROM prospectos
                WHERE modo_libre = true AND activo = true
            `);

            // 3. Valor en riesgo (2+ rebotes o modo libre)
            const valorRiesgoResult = await query(`
                SELECT
                    COUNT(*) as prospectos_riesgo,
                    COALESCE(SUM(valor_estimado), 0) as valor_total_riesgo
                FROM prospectos
                WHERE activo = true
                AND (numero_reasignaciones >= 2 OR modo_libre = true)
            `);

            // 4. Balance por asesores (solo traspasos VIGENTES)
            const balanceAsesoresResult = await query(`
                SELECT
                    u.id as asesor_id,
                    u.nombre || ' ' || u.apellido as asesor_nombre,
                    COUNT(DISTINCT p_perdidos.id) as perdidos,
                    COUNT(DISTINCT p_ganados.id) as ganados
                FROM usuarios u
                -- Prospectos que PERDIÓ y siguen traspasados (ya no los tiene)
                LEFT JOIN prospectos p_perdidos ON
                    p_perdidos.asesor_anterior_id = u.id
                    AND p_perdidos.numero_reasignaciones > 0
                    AND p_perdidos.asesor_id != u.id
                    AND p_perdidos.fecha_traspaso >= $1
                    AND p_perdidos.fecha_traspaso <= $2
                    AND p_perdidos.activo = true
                -- Prospectos que GANÓ y aún conserva
                LEFT JOIN prospectos p_ganados ON
                    p_ganados.asesor_id = u.id
                    AND p_ganados.numero_reasignaciones > 0
                    AND p_ganados.fecha_traspaso >= $1
                    AND p_ganados.fecha_traspaso <= $2
                    AND p_ganados.activo = true
                    AND p_ganados.asesor_anterior_id IS NOT NULL
                WHERE u.activo = true  -- Solo usuarios activos
                GROUP BY u.id, u.nombre, u.apellido
                HAVING COUNT(DISTINCT p_perdidos.id) > 0 OR COUNT(DISTINCT p_ganados.id) > 0
                ORDER BY COUNT(DISTINCT p_perdidos.id) DESC
                LIMIT 5
            `, [fechaDesde, fechaHasta]);

            // === TABLA CONSOLIDADA ===
            let whereConditions = ['p.numero_reasignaciones > 0', 'p.activo = true'];
            let queryParams = [];
            let paramIndex = 1;

            // Filtro por asesor origen (primer asesor que tuvo el prospecto)
            if (asesor_origen && asesor_origen !== 'todos') {
                whereConditions.push(`EXISTS (
                    SELECT 1 FROM notificaciones_reasignacion nr_origen
                    WHERE nr_origen.prospecto_id = p.id
                    AND nr_origen.asesor_perdio_id = $${paramIndex}
                    AND nr_origen.tipo = 'perdida'
                )`);
                queryParams.push(parseInt(asesor_origen));
                paramIndex++;
            }

            // Filtro por asesor actual
            if (asesor_actual) {
                if (asesor_actual === 'modo_libre') {
                    whereConditions.push('p.modo_libre = true');
                } else if (asesor_actual !== 'todos') {
                    whereConditions.push(`p.asesor_id = $${paramIndex}`);
                    queryParams.push(parseInt(asesor_actual));
                    paramIndex++;
                }
            }

            // Filtro por número mínimo de rebotes
            if (min_rebotes && parseInt(min_rebotes) > 0) {
                whereConditions.push(`p.numero_reasignaciones >= $${paramIndex}`);
                queryParams.push(parseInt(min_rebotes));
                paramIndex++;
            }

            // Filtro por búsqueda
            if (busqueda && busqueda.trim() !== '') {
                whereConditions.push(`(
                    p.codigo ILIKE $${paramIndex} OR
                    p.nombre_cliente ILIKE $${paramIndex} OR
                    p.empresa ILIKE $${paramIndex}
                )`);
                queryParams.push(`%${busqueda.trim()}%`);
                paramIndex++;
            }

            const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

            const prospectosResult = await query(`
                SELECT
                    p.id as prospecto_id,
                    p.codigo,
                    p.nombre_cliente,
                    p.apellido_cliente,
                    p.empresa,
                    p.valor_estimado,
                    p.probabilidad_cierre,
                    p.numero_reasignaciones as rebotes,
                    p.modo_libre,
                    p.asesor_id as asesor_actual_id,
                    p.asesor_nombre as asesor_actual,
                    p.estado,
                    p.created_at,

                    -- Historial completo de traspasos como JSON array
                    COALESCE(
                        (SELECT json_agg(
                            json_build_object(
                                'id', nr.id,
                                'fecha', nr.created_at,
                                'tipo', nr.tipo,
                                'motivo', nr.motivo,
                                'asesor_perdio_id', nr.asesor_perdio_id,
                                'asesor_perdio_nombre', u_perdio.nombre || ' ' || u_perdio.apellido,
                                'asesor_gano_id', nr.asesor_gano_id,
                                'asesor_gano_nombre', u_gano.nombre || ' ' || u_gano.apellido
                            ) ORDER BY nr.created_at ASC
                        )
                        FROM notificaciones_reasignacion nr
                        LEFT JOIN usuarios u_perdio ON nr.asesor_perdio_id = u_perdio.id
                        LEFT JOIN usuarios u_gano ON nr.asesor_gano_id = u_gano.id
                        WHERE nr.prospecto_id = p.id
                        ),
                        '[]'::json
                    ) as historial_traspasos,

                    -- Fecha del primer traspaso
                    (SELECT MIN(created_at)
                     FROM notificaciones_reasignacion
                     WHERE prospecto_id = p.id) as fecha_primer_traspaso

                FROM prospectos p
                ${whereClause}
                ORDER BY p.numero_reasignaciones DESC, p.valor_estimado DESC
                LIMIT $${paramIndex}
            `, [...queryParams, parseInt(limit)]);

            // Formatear datos
            const prospectos = prospectosResult.rows.map(p => ({
                ...p,
                valor_estimado: parseFloat(p.valor_estimado || 0),
                probabilidad_cierre: parseInt(p.probabilidad_cierre || 50),
                historial_traspasos: Array.isArray(p.historial_traspasos) ? p.historial_traspasos : [],
                dias_en_transito: p.fecha_primer_traspaso
                    ? Math.floor((new Date() - new Date(p.fecha_primer_traspaso)) / (1000 * 60 * 60 * 24))
                    : 0
            }));

            const kpis = kpisResult.rows[0];
            const modoLibre = modoLibreResult.rows[0];
            const valorRiesgo = valorRiesgoResult.rows[0];
            const balanceAsesores = balanceAsesoresResult.rows.map(a => ({
                ...a,
                perdidos: parseInt(a.perdidos),
                ganados: parseInt(a.ganados),
                neto: parseInt(a.ganados) - parseInt(a.perdidos)
            }));

            res.json({
                success: true,
                data: {
                    // KPIs
                    kpis: {
                        total_prospectos_traspasados: parseInt(kpis.total_prospectos_traspasados),
                        en_modo_libre: parseInt(modoLibre.en_modo_libre),
                        valor_modo_libre: parseFloat(modoLibre.valor_modo_libre),
                        prospectos_riesgo: parseInt(valorRiesgo.prospectos_riesgo),
                        valor_total_riesgo: parseFloat(valorRiesgo.valor_total_riesgo),
                        distribucion_motivo: {
                            vencidos: parseInt(kpis.total_vencidos),
                            modo_libre: parseInt(kpis.total_modo_libre)
                        },
                        balance_asesores: balanceAsesores
                    },

                    // Período
                    periodo: {
                        tipo: periodo,
                        desde: fechaDesde,
                        hasta: fechaHasta
                    },

                    // Tabla
                    prospectos: prospectos,
                    total_registros: prospectos.length
                }
            });

        } catch (error) {
            logger.error('Error en obtenerTraspasosConsolidado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener traspasos consolidados: ' + error.message
            });
        }
    }
}

module.exports = ProspectosController;