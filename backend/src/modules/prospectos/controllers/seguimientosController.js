const { query } = require('../../../config/database');
const winston = require('winston');
const cron = require('node-cron');

// 🔔 INTEGRACIÓN CON SISTEMA DE NOTIFICACIONES AUTOMÁTICAS
const NotificacionesController = require('../../notificaciones/controllers/notificacionesController');

// 🔄 INTEGRACIÓN CON SISTEMA DE SINCRONIZACIÓN DE CACHE
const { sincronizarCacheSeguimientos } = require('../utils/sincronizarSeguimientos');

// 📅 INTEGRACIÓN CON HELPER DE FECHAS FLEXIBLE
const { calcularFechaLimite, esHorarioLaboral } = require('../utils/fechasHelper');

// CONFIGURACIÓN DE LOGGING
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'seguimientos-avanzado' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/seguimientos.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// ============================================
// CONFIGURACIÓN DE CONVERSIÓN AUTOMÁTICA
// ============================================
const RESULTADOS_QUE_CONVIERTEN = [
    'Venta_Confirmada',
    'Cerrado_Exitoso', 
    'Compra_Aprobada',
    'Cliente_Interesado_Comprar',
    'Propuesta_Aceptada',
    'Contrato_Firmado',
    'Pago_Confirmado'
];

class SeguimientosController {
    
    // =====================================================
    // GESTIÓN DE SEGUIMIENTOS BÁSICOS
    // =====================================================
    
    /**
     * POST /api/prospectos/:id/seguimiento
     * Crear seguimiento obligatorio para un prospecto
     */
    static async crearSeguimiento(req, res) {
        try {
            const { id } = req.params;
            const { fecha_programada, tipo = 'Llamada', descripcion = '' } = req.body;
            
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }
            
            if (!fecha_programada) {
                return res.status(400).json({
                    success: false,
                    error: 'La fecha de seguimiento es obligatoria'
                });
            }
            
            // Validar que la fecha sea futura
            const fechaSeguimiento = new Date(fecha_programada);
            if (fechaSeguimiento <= new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'La fecha de seguimiento debe ser futura'
                });
            }
            
            const asesor_id = req.user?.id || 1;
            
            // Calcular fecha límite (18 horas laborales después)
            const fechaBase = new Date(fecha_programada);
            const fecha_limite = new Date(fechaBase.getTime() + (18 * 60 * 60 * 1000)); // 18 horas después
            
            // Crear seguimiento
            const insertQuery = `
                INSERT INTO seguimientos (
                    prospecto_id, asesor_id, fecha_programada, fecha_limite, tipo, descripcion
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const result = await query(insertQuery, [
                parseInt(id), asesor_id, fecha_programada, fecha_limite.toISOString(), tipo, descripcion
            ]);
            
            if (!result.rows || result.rows.length === 0) {
                throw new Error('Seguimiento no creado');
            }

            const seguimiento = result.rows[0];

            // 🔄 SINCRONIZAR CACHE: Actualizar campos de cache en prospecto
            try {
                await sincronizarCacheSeguimientos(parseInt(id));
                logger.info(`🔄 Cache de seguimientos sincronizado para prospecto ${id}`);
            } catch (errorSync) {
                logger.error('⚠️ Error sincronizando cache de seguimientos:', errorSync);
                // No detener el flujo si falla la sincronización
            }

            logger.info(`Seguimiento creado: Prospecto ${id}, fecha límite: ${fecha_limite.toISOString()}`);

            // 🔔 NOTIFICACIÓN: seguimiento_proximo si está dentro de las próximas 24 horas
            try {
                const horasHastaSeguimiento = (new Date(fecha_programada) - new Date()) / (1000 * 60 * 60);

                if (horasHastaSeguimiento > 0 && horasHastaSeguimiento <= 24) {
                    // Obtener datos del prospecto
                    const prospectoData = await query('SELECT * FROM prospectos WHERE id = $1', [id]);
                    const prospecto = prospectoData.rows[0];

                    if (prospecto) {
                        await NotificacionesController.crearNotificaciones({
                            tipo: 'seguimiento_proximo',
                            modo: 'basico',
                            data: {
                                usuario_id: asesor_id,
                                prospecto_id: parseInt(id),
                                prospecto_codigo: prospecto.codigo,
                                prospecto_nombre: prospecto.nombre_cliente,
                                seguimiento_id: seguimiento.id,
                                fecha_programada: fecha_programada,
                                horas_restantes: Math.round(horasHastaSeguimiento),
                                valor_estimado: prospecto.valor_estimado || 0
                            },
                            auto_prioridad: true
                        });
                        logger.info(`✅ Notificación seguimiento_proximo enviada (${Math.round(horasHastaSeguimiento)}h)`);
                    }
                }
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificación seguimiento_proximo:', errorNotif);
            }

            res.status(201).json({
                success: true,
                data: seguimiento,
                message: 'Seguimiento programado exitosamente'
            });
            
        } catch (error) {
            logger.error('Error en crearSeguimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear seguimiento: ' + error.message
            });
        }
    }
    
    /**
     * PUT /api/prospectos/seguimientos/:id/completar
     * Marcar seguimiento como completado - CON CONVERSIÓN AUTOMÁTICA Y REPROGRAMACIÓN MÚLTIPLE
     */
    static async completarSeguimiento(req, res) {
        try {
            const { id } = req.params;
            const {
                resultado = 'Seguimiento completado',
                notas = '',
                calificacion = null,
                seguimientos_futuros = []  // ✅ NUEVO: Array de seguimientos a crear
                // Formato: [
                //   { tipo: 'Llamada', fecha_programada: '...', notas: '...' },
                //   { tipo: 'WhatsApp', fecha_programada: '...', notas: '...' }
                // ]
            } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de seguimiento inválido'
                });
            }

            // Actualizar seguimiento actual como completado
            const updateResult = await query(`
                UPDATE seguimientos
                SET completado = $1, fecha_completado = $2, resultado = $3, notas = $4,
                    calificacion = $5, completado_por = $6, resultado_seguimiento = $7
                WHERE id = $8
                RETURNING prospecto_id, asesor_id
            `, [true, new Date().toISOString(), resultado, notas, calificacion, req.user?.id, resultado, id]);

            if (!updateResult.rows || updateResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Seguimiento no encontrado'
                });
            }

            const data = updateResult.rows[0];

            // ✅ REPROGRAMACIÓN MÚLTIPLE: Crear seguimientos futuros si se solicitan
            let seguimientosCreados = 0;
            if (Array.isArray(seguimientos_futuros) && seguimientos_futuros.length > 0) {
                logger.info(`🔄 Creando ${seguimientos_futuros.length} seguimientos futuros para prospecto ${data.prospecto_id}`);

                for (const seguimiento of seguimientos_futuros) {
                    try {
                        const { tipo, fecha_programada, notas: notasSeguimiento } = seguimiento;

                        // Validar datos requeridos
                        if (!tipo || !fecha_programada) {
                            logger.warn(`⚠️ Seguimiento omitido: falta tipo o fecha_programada`);
                            continue;
                        }

                        // Validar horario laboral
                        if (!esHorarioLaboral(fecha_programada)) {
                            logger.warn(`⚠️ Fecha fuera de horario laboral: ${fecha_programada} (tipo: ${tipo})`);
                            // Continuar de todos modos, el helper ajustará automáticamente
                        }

                        // Calcular fecha_limite usando helper flexible (sin hardcode de 18h)
                        const fechaLimite = calcularFechaLimite(fecha_programada, tipo);

                        // Crear seguimiento
                        await query(`
                            INSERT INTO seguimientos (
                                prospecto_id, asesor_id, fecha_programada, fecha_limite,
                                tipo, descripcion, completado, visible_para_asesor
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [
                            data.prospecto_id,
                            data.asesor_id,
                            fecha_programada,
                            fechaLimite,
                            tipo,
                            notasSeguimiento || `Seguimiento reprogramado: ${resultado}`,
                            false,
                            true
                        ]);

                        seguimientosCreados++;
                        logger.info(`✅ Seguimiento ${tipo} creado para ${fecha_programada} (límite: ${fechaLimite})`);

                    } catch (errorSeguimiento) {
                        logger.error(`❌ Error creando seguimiento ${seguimiento.tipo}:`, errorSeguimiento);
                        // Continuar con los siguientes seguimientos
                    }
                }

                logger.info(`✅ ${seguimientosCreados}/${seguimientos_futuros.length} seguimientos creados exitosamente`);
            }

            // 🔄 SINCRONIZAR CACHE: Buscar el siguiente seguimiento pendiente y actualizar campos de cache
            try {
                await sincronizarCacheSeguimientos(data.prospecto_id);
                logger.info(`🔄 Cache de seguimientos sincronizado para prospecto ${data.prospecto_id}`);
            } catch (errorSync) {
                logger.error('⚠️ Error sincronizando cache de seguimientos:', errorSync);
                // No detener el flujo si falla la sincronización
            }
            
            logger.info(`Seguimiento completado: ${id} con resultado: ${resultado}`);

            // 🔔 NOTIFICACIÓN: seguimiento_completado
            try {
                await NotificacionesController.crearNotificaciones({
                    tipo: 'seguimiento_completado',
                    modo: 'basico',
                    data: {
                        usuario_id: data.asesor_id,
                        prospecto_id: data.prospecto_id,
                        seguimiento_id: parseInt(id),
                        resultado: resultado,
                        calificacion: calificacion
                    },
                    auto_prioridad: true
                });
                logger.info(`✅ Notificación seguimiento_completado enviada para seguimiento ${id}`);
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificación seguimiento_completado:', errorNotif);
            }

            // ============================================
            // 🚀 CONVERSIÓN AUTOMÁTICA
            // ============================================

            if (SeguimientosController.debeConvertirAutomaticamente(resultado)) {
                logger.info(`🎯 Resultado exitoso detectado: ${resultado} - Iniciando conversión automática`);

                try {
                    const resultadoConversion = await SeguimientosController.ejecutarConversionAutomatica({
                        prospecto_id: data.prospecto_id,
                        seguimiento_id: id,
                        asesor_id: req.user?.id,
                        resultado: resultado,
                        notas: notas
                    });
                    
                    if (resultadoConversion.success) {
                        logger.info(`✅ Conversión automática exitosa: ${resultadoConversion.mensaje}`);
                        
                        return res.json({
                            success: true,
                            message: '🎉 Seguimiento completado y prospecto convertido automáticamente',
                            data: {
                                seguimiento_completado: true,
                                conversion: {
                                    success: true,
                                    venta_codigo: resultadoConversion.venta_creada?.codigo,
                                    venta_id: resultadoConversion.venta_creada?.id,
                                    mensaje: resultadoConversion.mensaje
                                }
                            }
                        });
                    } else {
                        logger.warn(`⚠️ Error en conversión automática: ${resultadoConversion.error}`);
                        
                        return res.json({
                            success: true,
                            message: 'Seguimiento completado. Error en conversión automática.',
                            data: {
                                seguimiento_completado: true,
                                conversion: {
                                    success: false,
                                    error: resultadoConversion.error,
                                    nota: 'Puedes convertir manualmente desde el módulo de ventas'
                                }
                            }
                        });
                    }
                    
                } catch (errorConversion) {
                    logger.error('❌ Error crítico en conversión automática:', errorConversion);
                    
                    return res.json({
                        success: true,
                        message: 'Seguimiento completado. Error técnico en conversión automática.',
                        data: {
                            seguimiento_completado: true,
                            conversion: {
                                success: false,
                                error: 'Error técnico - contactar soporte'
                            }
                        }
                    });
                }
            }
            
            // Respuesta normal (sin conversión)
            res.json({
                success: true,
                message: 'Seguimiento completado exitosamente',
                data: {
                    seguimiento_completado: true,
                    resultado: resultado
                }
            });
            
        } catch (error) {
            logger.error('Error en completarSeguimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al completar seguimiento: ' + error.message
            });
        }
    }
    
    // =====================================================
    // 🚀 SISTEMA DE CONVERSIÓN AUTOMÁTICA
    // =====================================================
    
    /**
     * Verificar si el resultado debe activar conversión automática
     */
    static debeConvertirAutomaticamente(resultado) {
        return RESULTADOS_QUE_CONVIERTEN.includes(resultado);
    }
    
    /**
     * Ejecutar conversión automática de prospecto a venta
     */
    static async ejecutarConversionAutomatica(config) {
        const ConversionService = require('../../ventas/services/ConversionService');
        
        return await ConversionService.convertirDesdeSeguimiento(
            config.prospecto_id,
            config.asesor_id, 
            config.seguimiento_id,
            config.resultado,
            config.notas
        );
    }
    
    /**
     * POST /api/prospectos/:prospecto_id/convertir
     * Conversión manual de prospecto a venta
     */
    static async convertirProspectoManual(req, res) {
        try {
            const { prospecto_id } = req.params;
            const { valor_estimado, notas_conversion } = req.body;

            const resultado = await SeguimientosController.ejecutarConversionAutomatica({
                prospecto_id: parseInt(prospecto_id),
                asesor_id: req.user?.id,
                resultado: 'Conversion_Manual',
                notas: notas_conversion || '',
                seguimiento_id: null
            });
            
            if (resultado.success) {
                res.json({
                    success: true,
                    message: 'Prospecto convertido exitosamente de forma manual',
                    data: {
                        venta_creada: resultado.venta_creada,
                        mensaje: resultado.mensaje
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Error al convertir prospecto',
                    error: resultado.error
                });
            }
            
        } catch (error) {
            logger.error('Error en conversión manual:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    
    /**
     * GET /api/prospectos/listos-conversion
     * Obtener prospectos listos para conversión
     */
    static async obtenerProspectosListos(req, res) {
        try {
            const asesor_id = req.user?.id;

            const result = await query(`
                SELECT p.*, s.resultado, s.fecha_completado, s.completado
                FROM prospectos p
                INNER JOIN seguimientos s ON p.id = s.prospecto_id
                LEFT JOIN ventas v ON p.id = v.prospecto_id
                WHERE p.asesor_id = $1 AND p.activo = $2
                AND v.id IS NULL
                AND s.completado = $3 AND s.resultado = ANY($4::text[])
                ORDER BY s.fecha_completado DESC
            `, [asesor_id, true, true, RESULTADOS_QUE_CONVIERTEN]);
            
            const prospectos = result.rows;
            
            res.json({
                success: true,
                data: {
                    prospectos_listos: prospectos || [],
                    total: prospectos?.length || 0,
                    mensaje: prospectos?.length > 0 
                        ? `${prospectos.length} prospecto(s) listo(s) para conversión`
                        : 'No hay prospectos listos para conversión en este momento'
                }
            });
            
        } catch (error) {
            logger.error('Error al obtener prospectos listos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    
    /**
     * Generar código único para venta
     */
    static async generarCodigoVenta() {
        const prefijo = 'VTA';
        const fecha = new Date();
        const año = fecha.getFullYear().toString().slice(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        
        // Obtener siguiente número secuencial
        const result = await query(`
            SELECT codigo FROM ventas 
            WHERE codigo LIKE $1 
            ORDER BY codigo DESC 
            LIMIT 1
        `, [`${prefijo}${año}${mes}%`]);
        
        let siguienteNumero = 1;
        
        if (result.rows && result.rows.length > 0) {
            const ultimoCodigo = result.rows[0].codigo;
            const numeroActual = parseInt(ultimoCodigo.slice(-4)) || 0;
            siguienteNumero = numeroActual + 1;
        }
        
        return `${prefijo}${año}${mes}${siguienteNumero.toString().padStart(4, '0')}`;
    }
    
    /**
     * Calcular días desde creación hasta conversión
     */
    static calcularDiasConversion(fechaCreacion) {
        const inicio = new Date(fechaCreacion);
        const fin = new Date();
        const diffTime = Math.abs(fin - inicio);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // =====================================================
    // SISTEMA DE REASIGNACIONES AUTOMÁTICAS
    // =====================================================
    
    /**
     * GET /api/prospectos/seguimientos/vencidos
     * Obtener seguimientos vencidos para procesamiento
     */
    static async obtenerSeguimientosVencidos(req, res) {
        try {
            const ahora = new Date().toISOString();
            const horaActual = new Date().getHours();
            const diaActual = new Date().getDay(); // 0=domingo, 1=lunes, etc.
            
            // Verificar horario laboral
            const enHorarioLaboral = (
                (diaActual >= 1 && diaActual <= 5 && horaActual >= 8 && horaActual <= 18) || // Lun-Vie 8am-6pm
                (diaActual === 6 && horaActual >= 9 && horaActual <= 12) // Sáb 9am-12pm
            );
            
            if (!enHorarioLaboral) {
                return res.json({
                    success: true,
                    data: [],
                    message: 'Fuera de horario laboral'
                });
            }
            
            // Obtener seguimientos vencidos con nuevos campos
            const result = await query(`
                SELECT s.*,
                       p.id as prospecto_id, p.codigo, p.nombre_cliente, p.estado,
                       p.numero_reasignaciones, p.asesor_id, p.asesor_nombre,
                       p.modo_libre, p.activo, p.estado_seguimiento
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND s.vencido = $2 AND s.fecha_limite < $3
                AND p.activo = $4 AND p.estado NOT IN ('Cerrado', 'Perdido')
                AND p.modo_libre = $5 AND s.visible_para_asesor = $6
            `, [false, false, ahora, true, false, true]);
            
            const data = result.rows;
            
            res.json({
                success: true,
                data: data || [],
                total: data?.length || 0
            });
            
        } catch (error) {
            logger.error('Error en obtenerSeguimientosVencidos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener seguimientos vencidos: ' + error.message
            });
        }
    }
    
    /**
     * POST /api/prospectos/seguimientos/procesar-vencidos
     * Procesar seguimientos vencidos (cron job manual)
     */
    static async procesarSeguimientosVencidos(req, res) {
        try {
            const resultado = await SeguimientosController.ejecutarProcesamiento();
            
            res.json({
                success: true,
                data: resultado,
                message: 'Seguimientos vencidos procesados exitosamente'
            });
            
        } catch (error) {
            logger.error('Error en procesarSeguimientosVencidos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al procesar seguimientos vencidos: ' + error.message
            });
        }
    }
    
    /**
     * Lógica principal de procesamiento (usada por cron y endpoint manual)
     */
    static async ejecutarProcesamiento() {
        try {
            const ahora = new Date().toISOString();
            
            // Obtener seguimientos vencidos
            const result = await query(`
                SELECT s.*, 
                       p.id as prospecto_id, p.codigo, p.nombre_cliente, p.estado, 
                       p.numero_reasignaciones, p.asesor_id, p.asesor_nombre, 
                       p.modo_libre, p.activo
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND s.fecha_limite < $2
                AND p.activo = $3 AND p.estado NOT IN ('Cerrado', 'Perdido')
                AND p.modo_libre = $4 AND p.numero_reasignaciones < 3
            `, [false, ahora, true, false]);
            
            const vencidos = result.rows;
            
            const resultado = {
                procesados: 0,
                reasignados: 0,
                modo_libre_activado: 0,
                errores: 0
            };
            
            logger.info(`🔄 Procesando ${vencidos?.length || 0} seguimientos vencidos...`);
            
            for (const seguimiento of vencidos || []) {
                try {
                    // Verificar si el seguimiento lleva más de 18 horas vencido
                    const horasVencidas = (new Date() - new Date(seguimiento.fecha_limite)) / (1000 * 60 * 60);

                    // Marcar seguimiento como vencido y no visible para el asesor actual
                    await query(`
                        UPDATE seguimientos
                        SET vencido = $1, visible_para_asesor = $2
                        WHERE id = $3
                    `, [true, false, seguimiento.id]);

                    // 🔔 NOTIFICACIÓN: seguimiento_vencido
                    try {
                        const tipoNotificacion = horasVencidas < 6 ? 'seguimiento_urgente' :
                                               horasVencidas >= 18 ? 'seguimiento_critico' : 'seguimiento_vencido';

                        await NotificacionesController.crearNotificaciones({
                            tipo: tipoNotificacion,
                            modo: 'basico',
                            data: {
                                usuario_id: seguimiento.asesor_id,
                                prospecto_id: seguimiento.prospecto_id,
                                prospecto_codigo: seguimiento.codigo,
                                prospecto_nombre: seguimiento.nombre_cliente,
                                seguimiento_id: seguimiento.id,
                                horas_vencidas: Math.round(horasVencidas),
                                valor_estimado: seguimiento.valor_estimado || 0
                            },
                            auto_prioridad: true
                        });
                        logger.info(`✅ Notificación ${tipoNotificacion} enviada para seguimiento ${seguimiento.id}`);
                    } catch (errorNotif) {
                        logger.error('⚠️ Error creando notificación de seguimiento vencido:', errorNotif);
                    }

                    // Si lleva más de 18 horas vencido, cambiar prospecto a "Perdido"
                    if (horasVencidas >= 18) {
                        await query(`
                            UPDATE prospectos
                            SET estado = $1, tipo_cierre = $2, motivo_perdida = $3, fecha_cierre = $4
                            WHERE id = $5 AND estado NOT IN ('Cerrado', 'Perdido')
                        `, ['Perdido', 'automatico', 'Sin respuesta - seguimiento vencido más de 18 horas', new Date(), seguimiento.prospecto_id]);

                        logger.info(`🔄 Prospecto ${seguimiento.codigo} cambiado a PERDIDO (vencido ${Math.round(horasVencidas)}h)`, {
                            service: 'seguimientos-avanzado',
                            prospecto_id: seguimiento.prospecto_id,
                            horas_vencidas: Math.round(horasVencidas)
                        });

                        resultado.procesados++;
                        continue; // No reasignar si ya está perdido
                    }

                    const nuevasReasignaciones = seguimiento.numero_reasignaciones + 1;

                    if (nuevasReasignaciones <= 2) {
                        // REASIGNACIÓN NORMAL (1er o 2do rebote)
                        const resultadoReasignacion = await SeguimientosController.reasignarProspecto(seguimiento.prospecto_id, 'seguimiento_vencido');

                        if (resultadoReasignacion && resultadoReasignacion.action === 'modo_libre') {
                            resultado.modo_libre_activado++;
                        } else {
                            resultado.reasignados++;
                        }

                        // Actualizar estado del prospecto
                        await query(`
                            UPDATE prospectos
                            SET estado_seguimiento = $1, traspasado_por_vencimiento = $2,
                                fecha_traspaso = $3, asesor_anterior_id = $4, motivo_traspaso = $5
                            WHERE id = $6
                        `, ['traspasado', true, new Date(), seguimiento.asesor_id, 'seguimiento_vencido', seguimiento.prospecto_id]);

                    } else {
                        // ACTIVAR MODO LIBRE (3er strike)
                        await SeguimientosController.activarModoLibre(seguimiento.prospecto_id);
                        resultado.modo_libre_activado++;

                        // Actualizar estado del prospecto a modo libre
                        await query(`
                            UPDATE prospectos
                            SET estado_seguimiento = $1, fecha_ultimo_seguimiento = $2
                            WHERE id = $3
                        `, ['modo_libre', new Date(), seguimiento.prospecto_id]);
                    }
                    
                    resultado.procesados++;
                    
                } catch (error) {
                    logger.error(`Error procesando seguimiento ${seguimiento.id}:`, error);
                    resultado.errores++;
                }
            }
            
            logger.info(`✅ Procesamiento completado:`, resultado);
            return resultado;
            
        } catch (error) {
            logger.error('Error en ejecutarProcesamiento:', error);
            throw error;
        }
    }
    
    /**
     * Reasignar prospecto a otro asesor
     */
    static async reasignarProspecto(prospecto_id, motivo = 'manual') {
        try {
            // Obtener prospecto actual
            const prospectoResult = await query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2',
                [prospecto_id, true]
            );
            
            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                throw new Error('Prospecto no encontrado');
            }

            const prospecto = prospectoResult.rows[0];
            
            // ============================================
            // SISTEMA DE REASIGNACIÓN INTELIGENTE v2.0
            // ============================================
            // LÓGICA: Buscar solo VENDEDOREs (rol_id = 7) disponibles
            // - Prospectos de SUPER_ADMIN/ADMIN/JEFE_VENTAS → van a VENDEDOREs
            // - Prospectos de VENDEDOREs → van a otros VENDEDOREs
            // - Si no hay VENDEDOREs disponibles → MODO LIBRE automático
            // ============================================
            const asesoresResult = await query(`
                SELECT u.id, u.nombre, u.apellido,
                       COUNT(p.id) as prospectos_count
                FROM usuarios u
                LEFT JOIN prospectos p ON u.id = p.asesor_id AND p.activo = true
                WHERE u.rol_id = $1 AND u.activo = $2 AND u.id != $3
                GROUP BY u.id, u.nombre, u.apellido
                ORDER BY prospectos_count ASC
            `, [7, true, prospecto.asesor_id]); // rol_id = 7 (VENDEDOR)
            
            if (!asesoresResult.rows || asesoresResult.rows.length === 0) {
                // Si no hay VENDEDOREs disponibles, activar MODO LIBRE
                await query(`
                    UPDATE prospectos
                    SET modo_libre = $1, fecha_modo_libre = CURRENT_TIMESTAMP,
                        numero_reasignaciones = $2
                    WHERE id = $3
                `, [true, prospecto.numero_reasignaciones + 1, prospecto.id]);

                logger.info(`🔄 Prospecto ${prospecto.codigo} activado en MODO LIBRE (sin vendedores disponibles)`, {
                    service: 'seguimientos-avanzado',
                    prospecto_id: prospecto.id,
                    asesor_original: prospecto.asesor_id
                });

                return {
                    success: true,
                    action: 'modo_libre',
                    prospecto_id: prospecto.id,
                    message: 'Prospecto activado en modo libre por falta de vendedores'
                };
            }
            
            // Seleccionar asesor con menos carga
            const asesorSeleccionado = asesoresResult.rows[0];
            
            // Actualizar prospecto
            await query(`
                UPDATE prospectos 
                SET asesor_id = $1, asesor_nombre = $2, numero_reasignaciones = $3, seguimiento_vencido = $4
                WHERE id = $5
            `, [
                asesorSeleccionado.id, 
                `${asesorSeleccionado.nombre} ${asesorSeleccionado.apellido}`,
                prospecto.numero_reasignaciones + 1,
                true,
                prospecto_id
            ]);
            
            // Crear notificaciones
            await SeguimientosController.crearNotificacionesReasignacion(
                prospecto_id,
                prospecto.asesor_id,
                asesorSeleccionado.id,
                motivo
            );
            
            logger.info(`🔄 Prospecto ${prospecto.codigo} reasignado de ${prospecto.asesor_nombre} a ${asesorSeleccionado.nombre}`);
            
            return {
                asesor_anterior: prospecto.asesor_nombre,
                asesor_nuevo: `${asesorSeleccionado.nombre} ${asesorSeleccionado.apellido}`,
                motivo
            };
            
        } catch (error) {
            logger.error('Error en reasignarProspecto:', error);
            throw error;
        }
    }
    
    /**
     * Activar modo libre (free-for-all)
     */
    static async activarModoLibre(prospecto_id) {
        try {
            // Obtener todos los asesores de ventas
            const asesoresResult = await query(`
                SELECT id FROM usuarios 
                WHERE area_id = $1 AND activo = $2
            `, [2, true]); // Área VENTAS
            
            const asesor_ids = asesoresResult.rows?.map(a => a.id) || [];
            
            // Activar modo libre en prospecto
            await query(`
                UPDATE prospectos 
                SET modo_libre = $1, fecha_modo_libre = $2, numero_reasignaciones = numero_reasignaciones + 1
                WHERE id = $3
            `, [true, new Date().toISOString(), prospecto_id]);
            
            // Crear registro en tabla modo_libre (si existe la tabla)
            try {
                await query(`
                    INSERT INTO prospecto_modo_libre (prospecto_id, asesores_con_acceso)
                    VALUES ($1, $2)
                `, [prospecto_id, JSON.stringify(asesor_ids)]);
            } catch (modoLibreError) {
                // Tabla modo_libre puede no existir, continuar sin error
                logger.warn('Tabla prospecto_modo_libre no existe, continuando...');
            }
            
            // Notificar a todos los asesores mediante el sistema unificado
            await SeguimientosController.crearNotificacionModoLibre(prospecto_id, asesor_ids);

            // 🔔 NOTIFICACIÓN VÍA SISTEMA UNIFICADO: prospecto_libre_activado
            try {
                // Obtener datos del prospecto
                const prospectoData = await query('SELECT * FROM prospectos WHERE id = $1', [prospecto_id]);
                const prospecto = prospectoData.rows[0];

                if (prospecto) {
                    // Crear notificación para cada asesor del área de ventas
                    for (const asesorId of asesor_ids) {
                        await NotificacionesController.crearNotificaciones({
                            tipo: 'prospecto_libre_activado',
                            modo: 'basico',
                            data: {
                                usuario_id: asesorId,
                                prospecto_id: prospecto_id,
                                prospecto_codigo: prospecto.codigo,
                                prospecto_nombre: prospecto.nombre_cliente,
                                valor_estimado: prospecto.valor_estimado || 0
                            },
                            auto_prioridad: true
                        });
                    }
                    logger.info(`✅ Notificaciones prospecto_libre_activado enviadas a ${asesor_ids.length} asesores`);
                }
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificaciones de modo libre:', errorNotif);
            }

            logger.info(`🏁 Modo libre activado para prospecto ${prospecto_id}`);

            return { modo_libre: true, asesores_con_acceso: asesor_ids.length };
            
        } catch (error) {
            logger.error('Error en activarModoLibre:', error);
            throw error;
        }
    }
    
    /**
     * Crear notificaciones de reasignación
     */
    static async crearNotificacionesReasignacion(prospecto_id, asesor_perdio_id, asesor_gano_id, motivo) {
        try {
            // Obtener datos del prospecto
            const result = await query(
                'SELECT codigo, nombre_cliente, empresa FROM prospectos WHERE id = $1',
                [prospecto_id]
            );
            
            if (!result.rows || result.rows.length === 0) return;
            
            const prospecto = result.rows[0];
            
            // Crear notificación de pérdida
            await query(`
                INSERT INTO notificaciones_reasignacion (
                    prospecto_id, asesor_perdio_id, tipo, motivo, titulo, mensaje
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                prospecto_id, asesor_perdio_id, 'perdida', motivo,
                `Prospecto reasignado: ${prospecto?.codigo}`,
                `El prospecto ${prospecto?.nombre_cliente} ha sido reasignado por ${motivo}`
            ]);
            
            // Crear notificación de ganancia
            await query(`
                INSERT INTO notificaciones_reasignacion (
                    prospecto_id, asesor_gano_id, tipo, motivo, titulo, mensaje
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                prospecto_id, asesor_gano_id, 'ganancia', motivo,
                `Nuevo prospecto asignado: ${prospecto?.codigo}`,
                `Te ha sido asignado el prospecto ${prospecto?.nombre_cliente} de ${prospecto?.empresa || 'empresa no especificada'}`
            ]);
            
        } catch (error) {
            logger.error('Error al crear notificaciones de reasignación:', error);
        }
    }
    
    /**
     * Crear notificaciones de modo libre
     */
    static async crearNotificacionModoLibre(prospecto_id, asesor_ids) {
        try {
            // Obtener datos del prospecto
            const result = await query(
                'SELECT codigo, nombre_cliente, empresa, valor_estimado FROM prospectos WHERE id = $1',
                [prospecto_id]
            );
            
            if (!result.rows || result.rows.length === 0) return;
            
            const prospecto = result.rows[0];
            
            // Crear notificación para cada asesor
            for (const asesor_id of asesor_ids) {
                await query(`
                    INSERT INTO notificaciones_reasignacion (
                        prospecto_id, asesor_gano_id, tipo, motivo, titulo, mensaje
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    prospecto_id, asesor_id, 'modo_libre', 'libre_competencia',
                    `🏁 MODO LIBRE: ${prospecto?.codigo}`,
                    `¡COMPETENCIA ABIERTA! El prospecto ${prospecto?.nombre_cliente} (${prospecto?.codigo}) valor estimado $${prospecto?.valor_estimado || 0} está ahora disponible para todos. ¡El primero en cerrar la venta se lo queda!`
                ]);
            }
            
        } catch (error) {
            logger.error('Error al crear notificaciones de modo libre:', error);
        }
    }
    
    // =====================================================
    // CRON JOB AUTOMÁTICO
    // =====================================================
    
    /**
     * Inicializar cron jobs
     */
    static inicializarCronJobs() {
        logger.info('🕐 Inicializando Cron Jobs de Seguimientos...');
        
        // Lunes-Viernes: 8am-6pm (cada hora)
        cron.schedule('0 8-18 * * 1-5', async () => {
            try {
                await SeguimientosController.ejecutarProcesamiento();
            } catch (error) {
                logger.error('Error en cron job (L-V):', error);
            }
        }, {
            timezone: "America/Lima"
        });
        
        // Sábados: 9am-12pm (cada hora)
        cron.schedule('0 9-12 * * 6', async () => {
            try {
                await SeguimientosController.ejecutarProcesamiento();
            } catch (error) {
                logger.error('Error en cron job (Sáb):', error);
            }
        }, {
            timezone: "America/Lima"
        });
        
        logger.info('✅ Cron Jobs configurados: L-V 8am-6pm, Sáb 9am-12pm');
    }
    
    // =====================================================
    // ENDPOINTS DE INFORMACIÓN Y MÉTRICAS
    // =====================================================
    
    /**
     * GET /api/prospectos/dashboard/seguimientos/:asesorId
     * Dashboard completo de seguimientos para un asesor
     * 🔒 SEGURIDAD: Filtrado automático por rol
     */
    static async dashboardSeguimientos(req, res) {
        try {
            const { asesorId } = req.params;

            // 🔒 CONTROL DE ACCESO POR ROL
            const usuarioActual = req.user || {};
            const rolUsuario = usuarioActual.rol_id;
            const idUsuarioActual = usuarioActual.id;

            // 🔍 LOG DETALLADO PARA DEBUG
            console.log('🔍 [DEBUG] Usuario actual:', {
                id: idUsuarioActual,
                rol_id: rolUsuario,
                nombre: usuarioActual.nombre,
                asesorId_param: asesorId
            });

            // Roles que pueden ver vista global
            const ROLES_EJECUTIVOS = [1, 2, 3, 4, 6]; // SUPER_ADMIN, ADMIN, GERENTE, JEFE_VENTAS, SUPERVISOR
            const esEjecutivo = ROLES_EJECUTIVOS.includes(rolUsuario);

            // VENDEDOR (rol_id = 7) SOLO puede ver sus propios datos
            let asesor_id;
            if (rolUsuario === 7) {
                // 🔒 VENDEDOR: Forzar su propio ID, ignorar parámetro
                asesor_id = idUsuarioActual;
                console.log(`🔒 [Seguimientos] VENDEDOR detectado (ID: ${idUsuarioActual}). Forzando vista personal. Ignorando parámetro: ${asesorId}`);
                logger.info(`🔒 [Seguimientos] VENDEDOR detectado (${idUsuarioActual}). Forzando vista personal.`);
            } else if (esEjecutivo) {
                // ✅ EJECUTIVO: Puede ver vista global (null) o específica (asesorId)
                asesor_id = asesorId && !isNaN(asesorId) ? parseInt(asesorId) : null;
                console.log(`✅ [Seguimientos] EJECUTIVO detectado (rol ${rolUsuario}). Vista: ${asesor_id ? `asesor ${asesor_id}` : 'global'}`);
                logger.info(`✅ [Seguimientos] EJECUTIVO detectado (rol ${rolUsuario}). Vista: ${asesor_id ? `asesor ${asesor_id}` : 'global'}`);
            } else {
                // 🔒 OTROS ROLES: Solo su vista personal
                asesor_id = idUsuarioActual;
                console.log(`⚠️ [Seguimientos] Rol desconocido (${rolUsuario}). Forzando vista personal.`);
                logger.warn(`⚠️ [Seguimientos] Rol desconocido (${rolUsuario}). Forzando vista personal.`);
            }

            console.log(`🎯 [DEBUG] asesor_id FINAL usado en queries: ${asesor_id}`);

            // Construir query con filtrado condicional
            const seguimientosQuery = asesor_id
                ? `SELECT s.*,
                       p.codigo, p.nombre_cliente, p.apellido_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.asesor_id = $1 AND s.completado = $2 AND p.activo = $3
                AND s.visible_para_asesor = $4
                ORDER BY s.fecha_programada ASC`
                : `SELECT s.*,
                       p.codigo, p.nombre_cliente, p.apellido_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND p.activo = $2
                AND s.visible_para_asesor = $3
                ORDER BY s.fecha_programada ASC`;

            const seguimientosParams = asesor_id
                ? [asesor_id, false, true, true]
                : [false, true, true];

            const seguimientosResult = await query(seguimientosQuery, seguimientosParams);

            const seguimientos = seguimientosResult.rows;

            console.log(`📊 [DEBUG pendientes] Seguimientos pendientes encontrados: ${seguimientos.length}`);
            if (seguimientos.length > 0) {
                console.log('📋 [DEBUG] Primeros pendientes:', seguimientos.slice(0, 3).map(s => ({
                    id: s.id,
                    prospecto: s.codigo,
                    tipo: s.tipo,
                    fecha: s.fecha_programada,
                    completado: s.completado,
                    visible: s.visible_para_asesor,
                    asesor_id: s.asesor_id
                })));
            } else {
                console.log('⚠️ [DEBUG] No se encontraron seguimientos pendientes');
                console.log('🔍 [DEBUG] Query ejecutada:', seguimientosQuery);
                console.log('🔍 [DEBUG] Parámetros:', seguimientosParams);
            }

            // Verificar si PROS-041 existe en la BD (debug específico)
            const pros041Check = await query(`
                SELECT s.*, p.codigo, p.asesor_id as prospecto_asesor_id
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE p.codigo = $1
                ORDER BY s.created_at DESC
                LIMIT 1
            `, ['PROS-041']);

            if (pros041Check.rows && pros041Check.rows.length > 0) {
                console.log('🔍 [DEBUG PROS-041] Estado completo en BD:', pros041Check.rows[0]);
            }

            // Obtener seguimientos realizados (último mes) - con filtrado por rol
            const unMesAtras = new Date();
            unMesAtras.setMonth(unMesAtras.getMonth() - 1);

            const realizadosQuery = asesor_id
                ? `SELECT s.*,
                       p.codigo, p.nombre_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.asesor_id = $1 AND s.completado = $2
                AND COALESCE(s.fecha_completado, s.updated_at, s.created_at) >= $3
                ORDER BY COALESCE(s.fecha_completado, s.updated_at, s.created_at) DESC`
                : `SELECT s.*,
                       p.codigo, p.nombre_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND COALESCE(s.fecha_completado, s.updated_at, s.created_at) >= $2
                ORDER BY COALESCE(s.fecha_completado, s.updated_at, s.created_at) DESC`;

            const realizadosParams = asesor_id
                ? [asesor_id, true, unMesAtras.toISOString()]
                : [true, unMesAtras.toISOString()];

            const realizadosResult = await query(realizadosQuery, realizadosParams);
            const seguimientosRealizados = realizadosResult.rows;

            console.log(`📊 [DEBUG realizados] Total seguimientos realizados encontrados: ${seguimientosRealizados.length}`);
            if (seguimientosRealizados.length > 0) {
                console.log('📋 [DEBUG] Primeros realizados:', seguimientosRealizados.slice(0, 3).map(s => ({
                    id: s.id,
                    prospecto: s.codigo,
                    completado: s.completado,
                    fecha_completado: s.fecha_completado,
                    updated_at: s.updated_at,
                    created_at: s.created_at,
                    asesor_id: s.asesor_id
                })));
            }

            // Calcular realizados última semana (para la balanza)
            const unaSemanaAtras = new Date();
            unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
            const seguimientosRealizadosSemana = seguimientosRealizados.filter(s => {
                const fechaCompletar = s.fecha_completado || s.updated_at || s.created_at;
                const esReciente = fechaCompletar && new Date(fechaCompletar) >= unaSemanaAtras;

                if (s.codigo === 'PROS-041') {
                    console.log('🔍 [DEBUG PROS-041] Clasificación:', {
                        prospecto: s.codigo,
                        completado: s.completado,
                        fecha_completado: s.fecha_completado,
                        updated_at: s.updated_at,
                        created_at: s.created_at,
                        fechaUsada: fechaCompletar,
                        unaSemanaAtras: unaSemanaAtras.toISOString(),
                        esReciente,
                        clasificado: esReciente ? 'realizados_semana' : 'fuera_de_rango'
                    });
                }

                return esReciente;
            });

            console.log(`📊 [DEBUG] Clasificación final: { realizados_mes: ${seguimientosRealizados.length}, realizados_semana: ${seguimientosRealizadosSemana.length} }`);

            // Obtener prospectos en modo libre (no filtrar por asesor, es para todos)
            const modoLibreResult = await query(
                'SELECT * FROM prospectos WHERE modo_libre = $1 AND activo = $2',
                [true, true]
            );
            const modoLibre = modoLibreResult.rows;

            // Obtener prospectos listos para conversión - con filtrado por rol
            // Verificar que no tengan venta asociada (LEFT JOIN con v.id IS NULL)
            const listosConversionQuery = asesor_id
                ? `SELECT p.*, s.resultado, s.fecha_completado, s.completado
                FROM prospectos p
                INNER JOIN seguimientos s ON p.id = s.prospecto_id
                LEFT JOIN ventas v ON p.id = v.prospecto_id
                WHERE p.asesor_id = $1 AND p.activo = $2
                AND v.id IS NULL
                AND s.completado = $3 AND s.resultado = ANY($4::text[])`
                : `SELECT p.*, s.resultado, s.fecha_completado, s.completado
                FROM prospectos p
                INNER JOIN seguimientos s ON p.id = s.prospecto_id
                LEFT JOIN ventas v ON p.id = v.prospecto_id
                WHERE p.activo = $1
                AND v.id IS NULL
                AND s.completado = $2 AND s.resultado = ANY($3::text[])`;

            const listosConversionParams = asesor_id
                ? [asesor_id, true, true, RESULTADOS_QUE_CONVIERTEN]
                : [true, true, RESULTADOS_QUE_CONVIERTEN];

            const listosConversionResult = await query(listosConversionQuery, listosConversionParams);

            const listosConversion = listosConversionResult.rows;
            
            // Categorizar seguimientos
            const ahora = new Date();
            const seguimientosCategorias = {
                vencidos: seguimientos?.filter(s => new Date(s.fecha_limite) < ahora) || [],
                hoy: seguimientos?.filter(s => {
                    const fecha = new Date(s.fecha_programada);
                    return fecha.toDateString() === ahora.toDateString();
                }) || [],
                proximos: seguimientos?.filter(s => {
                    const fecha = new Date(s.fecha_programada);
                    return fecha > ahora && fecha.toDateString() !== ahora.toDateString();
                }) || []
            };
            
            // Obtener métricas (últimos 30 días) - con filtrado por rol
            const fechaLimite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const metricasQuery = asesor_id
                ? `SELECT completado, vencido, pospuesto FROM seguimientos
                   WHERE asesor_id = $1 AND created_at >= $2`
                : `SELECT completado, vencido, pospuesto FROM seguimientos
                   WHERE created_at >= $1`;

            const metricasParams = asesor_id ? [asesor_id, fechaLimite] : [fechaLimite];
            const metricasResult = await query(metricasQuery, metricasParams);
            const metricas = metricasResult.rows;
            
            const totalSeguimientos = metricas?.length || 0;
            const completados = metricas?.filter(m => m.completado).length || 0;
            const vencidos = metricas?.filter(m => m.vencido).length || 0;
            
            const resultado = {
                seguimientos: {
                    ...seguimientosCategorias,
                    pendientes: seguimientos || [],
                    realizados: seguimientosRealizados || [],
                    realizados_semana: seguimientosRealizadosSemana || [],
                    conteos: {
                        total: seguimientos?.length || 0,
                        pendientes: seguimientos?.length || 0,
                        vencidos: seguimientosCategorias.vencidos.length,
                        hoy: seguimientosCategorias.hoy.length,
                        proximos: seguimientosCategorias.proximos.length,
                        realizados_mes: seguimientosRealizados?.length || 0,
                        realizados_semana: seguimientosRealizadosSemana?.length || 0,
                        completados_hoy: seguimientosRealizados?.filter(s => {
                            const fechaComp = new Date(s.fecha_completado);
                            return fechaComp.toDateString() === new Date().toDateString();
                        }).length || 0
                    }
                },
                modo_libre: {
                    prospectos: modoLibre || [],
                    total: modoLibre?.length || 0
                },
                listos_conversion: {
                    prospectos: listosConversion || [],
                    total: listosConversion?.length || 0
                },
                metricas: {
                    total_seguimientos_30d: totalSeguimientos,
                    completados_30d: completados,
                    vencidos_30d: vencidos,
                    porcentaje_completados: totalSeguimientos > 0 ? ((completados / totalSeguimientos) * 100).toFixed(2) : 0,
                    porcentaje_vencidos: totalSeguimientos > 0 ? ((vencidos / totalSeguimientos) * 100).toFixed(2) : 0,
                    // 📊 PERFORMANCE SCORE para la balanza (0-100) - con filtrado por rol
                    score_productividad: await (async () => {
                        try {
                            // Obtener datos para el score de los últimos 30 días
                            const scoreQuery = asesor_id
                                ? `SELECT
                                    COUNT(*) as total_actividades,
                                    COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END) as conversiones,
                                    AVG(COALESCE(
                                        EXTRACT(EPOCH FROM (v.fecha_venta - p.created_at))/86400,
                                        EXTRACT(EPOCH FROM (s.fecha_completado - p.created_at))/86400,
                                        30
                                    )) as dias_promedio_proceso,
                                    AVG(p.probabilidad_cierre) as probabilidad_promedio
                                FROM seguimientos s
                                INNER JOIN prospectos p ON s.prospecto_id = p.id
                                LEFT JOIN ventas v ON p.id = v.prospecto_id
                                WHERE p.asesor_id = $1 AND s.created_at >= $2`
                                : `SELECT
                                    COUNT(*) as total_actividades,
                                    COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END) as conversiones,
                                    AVG(COALESCE(
                                        EXTRACT(EPOCH FROM (v.fecha_venta - p.created_at))/86400,
                                        EXTRACT(EPOCH FROM (s.fecha_completado - p.created_at))/86400,
                                        30
                                    )) as dias_promedio_proceso,
                                    AVG(p.probabilidad_cierre) as probabilidad_promedio
                                FROM seguimientos s
                                INNER JOIN prospectos p ON s.prospecto_id = p.id
                                LEFT JOIN ventas v ON p.id = v.prospecto_id
                                WHERE s.created_at >= $1`;

                            const fechaLimiteScore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                            const scoreParams = asesor_id ? [asesor_id, fechaLimiteScore] : [fechaLimiteScore];
                            const scoreResult = await query(scoreQuery, scoreParams);
                            const scoreData = scoreResult.rows[0];

                            const totalActividades = parseInt(scoreData.total_actividades || 0);
                            if (totalActividades === 0) return 0;

                            // Componente 1: Tasa de conversión (40% del score)
                            const tasaConversion = (scoreData.conversiones / totalActividades) * 100;
                            const scoreConversion = Math.min((tasaConversion / 20) * 40, 40); // 20% = 40pts máximo

                            // Componente 2: Velocidad de proceso (30% del score)
                            const diasPromedio = parseFloat(scoreData.dias_promedio_proceso || 30);
                            const scoreVelocidad = Math.max(30 - (diasPromedio / 2), 0); // Menos días = mejor score

                            // Componente 3: Probabilidad promedio (30% del score)
                            const probabilidadPromedio = parseFloat(scoreData.probabilidad_promedio || 50);
                            const scoreProbabilidad = (probabilidadPromedio / 100) * 30;

                            return Math.round(scoreConversion + scoreVelocidad + scoreProbabilidad);
                        } catch (error) {
                            logger.error('Error calculando score_productividad:', error);
                            return 0;
                        }
                    })()
                },
                alertas: {
                    seguimientos_vencidos: seguimientosCategorias.vencidos.length > 0,
                    oportunidades_libres: (modoLibre?.length || 0) > 0,
                    conversiones_pendientes: (listosConversion?.length || 0) > 0,
                    performance_baja: totalSeguimientos > 0 && ((completados / totalSeguimientos) * 100) < 80
                }
            };

            // 📊 Agregar metadatos de vista para el frontend
            resultado.vista_info = {
                tipo_vista: asesor_id ? 'personal' : 'global',
                asesor_id: asesor_id,
                asesor_nombre: asesor_id ? (await query('SELECT nombre, apellido FROM usuarios WHERE id = $1', [asesor_id])).rows[0] : null,
                rol_usuario: rolUsuario,
                es_ejecutivo: esEjecutivo,
                puede_cambiar_vista: esEjecutivo
            };

            res.json({
                success: true,
                data: resultado
            });
            
        } catch (error) {
            logger.error('Error en dashboardSeguimientos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener dashboard de seguimientos: ' + error.message
            });
        }
    }
    
    /**
     * GET /api/prospectos/seguimientos/health
     * Health check del sistema de seguimientos
     */
    static async healthCheck(req, res) {
        try {
            // Verificar conectividad con base de datos
            const result = await query(`
                SELECT COUNT(*) as total FROM seguimientos 
                WHERE completado = $1 AND fecha_limite < $2
            `, [false, new Date().toISOString()]);
            
            const seguimientosVencidos = parseInt(result.rows[0]?.total) || 0;
            
            res.json({
                success: true,
                module: 'Seguimientos',
                status: 'Operativo',
                timestamp: new Date().toISOString(),
                version: '2.0.0 (PostgreSQL)',
                data: {
                    seguimientos_vencidos: seguimientosVencidos,
                    horario_laboral: 'L-V 8am-6pm, Sáb 9am-12pm',
                    tiempo_vencimiento: '18 horas laborales',
                    conversion_automatica: true,
                    resultados_conversion: RESULTADOS_QUE_CONVIERTEN,
                    funcionalidades: [
                        'Seguimientos obligatorios',
                        'Conversión automática',
                        'Conversión manual',
                        'Reasignación automática',
                        'Modo libre (free-for-all)',
                        'Notificaciones automáticas',
                        'Dashboard personalizado',
                        'Métricas de conversión'
                    ]
                }
            });
            
        } catch (error) {
            logger.error('Error en health check seguimientos:', error);
            res.status(500).json({
                success: false,
                module: 'Seguimientos',
                status: 'Error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    /**
     * POST /api/prospectos/seguimientos/sincronizar-cache
     * Sincronizar cache de seguimientos de todos los prospectos activos
     * ⚠️ ADMIN ONLY - Operación de mantenimiento
     */
    static async sincronizarCacheMasivo(req, res) {
        try {
            logger.info('🔄 Iniciando sincronización masiva de cache de seguimientos');

            const { sincronizarTodosLosProspectos } = require('../utils/sincronizarSeguimientos');

            const resultado = await sincronizarTodosLosProspectos();

            res.json({
                success: true,
                message: 'Sincronización masiva completada',
                data: resultado
            });

        } catch (error) {
            logger.error('Error en sincronizarCacheMasivo:', error);
            res.status(500).json({
                success: false,
                error: 'Error en sincronización masiva: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/seguimientos/historial-completo/:asesor_id
     * Obtener historial completo empresarial con contexto de negocio
     */
    static async obtenerHistorialCompleto(req, res) {
        try {
            const { asesor_id } = req.params;
            const {
                page = 1,
                limit = 50,
                fecha_desde = null,
                fecha_hasta = null,
                tipo_actividad = 'todos', // seguimiento, conversion, perdida, reasignacion
                estado = 'todos'
            } = req.query;

            const offset = (page - 1) * limit;

            // 🔐 CONTROL DE ACCESO: Solo admins/supervisores pueden ver otros asesores
            const userRole = req.user?.rol || 'asesor';
            const requestUserId = req.user?.id;

            let asesorIdFinal = asesor_id;
            if (userRole === 'asesor' && parseInt(asesor_id) !== requestUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'No tienes permisos para ver el historial de otros asesores'
                });
            }

            // 📊 CONSULTA SIMPLE Y DIRECTA - Solo seguimientos existentes
            let baseQuery = `
                SELECT
                    s.id as seguimiento_id,
                    s.fecha_programada,
                    s.fecha_completado,
                    s.created_at as fecha_creacion,
                    s.tipo as tipo_seguimiento,
                    s.descripcion,
                    s.resultado,
                    s.resultado_seguimiento as notas,
                    s.completado,
                    s.vencido,
                    p.id as prospecto_id,
                    p.codigo as prospecto_codigo,
                    p.nombre_cliente,
                    p.telefono,
                    p.email,
                    p.estado as estado_prospecto,
                    p.estado_anterior,
                    p.valor_estimado,
                    p.probabilidad_cierre,
                    p.canal_contacto,
                    p.motivo_perdida,
                    p.created_at as fecha_creacion_prospecto,
                    u.nombre as asesor_nombre,
                    u.apellido as asesor_apellido,
                    v.codigo as venta_codigo,
                    v.valor_final as venta_total,
                    v.fecha_venta,
                    -- Tipo de actividad simplificado
                    CASE
                        WHEN v.id IS NOT NULL THEN 'conversion'
                        WHEN p.estado = 'Perdido' THEN 'perdida'
                        WHEN s.completado = true THEN 'seguimiento_completado'
                        WHEN s.vencido = true THEN 'seguimiento_vencido'
                        ELSE 'seguimiento_pendiente'
                    END as tipo_actividad,
                    -- Días proceso
                    COALESCE(
                        EXTRACT(EPOCH FROM (s.fecha_completado - p.created_at))/86400,
                        EXTRACT(EPOCH FROM (v.fecha_venta - p.created_at))/86400,
                        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at))/86400
                    ) as dias_proceso,
                    (p.valor_estimado * p.probabilidad_cierre / 100) as impacto_economico
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                LEFT JOIN usuarios u ON p.asesor_id = u.id
                LEFT JOIN ventas v ON p.id = v.prospecto_id
                WHERE p.asesor_id = $1
            `;

            let queryParams = [asesorIdFinal];
            let paramIndex = 2;

            // Filtro por fechas
            if (fecha_desde) {
                baseQuery += ` AND s.fecha_completado >= $${paramIndex}`;
                queryParams.push(fecha_desde);
                paramIndex++;
            }

            if (fecha_hasta) {
                baseQuery += ` AND s.fecha_completado <= $${paramIndex}`;
                queryParams.push(fecha_hasta);
                paramIndex++;
            }

            // Filtro por tipo de actividad
            if (tipo_actividad !== 'todos') {
                if (tipo_actividad === 'conversion') {
                    baseQuery += ` AND v.id IS NOT NULL`;
                } else if (tipo_actividad === 'perdida') {
                    baseQuery += ` AND p.estado = 'Perdido'`;
                } else if (tipo_actividad === 'seguimiento_completado') {
                    baseQuery += ` AND s.completado = true AND v.id IS NULL AND p.estado != 'Perdido'`;
                }
            }

            // Ordenar por fecha real de actividad (conversión primero, completado segundo, programado último)
            baseQuery += ` ORDER BY COALESCE(v.fecha_venta, s.fecha_completado, s.fecha_programada) DESC`;

            // Paginación
            baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            queryParams.push(limit, offset);

            const result = await query(baseQuery, queryParams);

            // 📈 CONSULTA SIMPLE PARA MÉTRICAS
            const metricsQuery = `
                SELECT
                    COUNT(*) as total_actividades,
                    COUNT(CASE WHEN s.completado = true THEN 1 END) as seguimientos_completados,
                    COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END) as conversiones,
                    COUNT(CASE WHEN p.estado = 'Perdido' THEN 1 END) as perdidas,
                    COALESCE(SUM(v.valor_final), 0) as valor_total_ventas,
                    AVG(COALESCE(
                        EXTRACT(EPOCH FROM (s.fecha_completado - p.created_at))/86400,
                        EXTRACT(EPOCH FROM (v.fecha_venta - p.created_at))/86400,
                        0
                    )) as dias_promedio_proceso,
                    CASE WHEN COUNT(*) > 0 THEN
                        ROUND((COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 2)
                        ELSE 0
                    END as tasa_conversion
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                LEFT JOIN ventas v ON p.id = v.prospecto_id
                WHERE p.asesor_id = $1
            `;

            const metricsResult = await query(metricsQuery, [asesorIdFinal]);
            const metricas = metricsResult.rows[0];

            // 📊 FORMATEAR DATOS PARA LA UI
            const historial = result.rows.map(row => ({
                id: row.seguimiento_id,
                fecha_actividad: row.fecha_venta || row.fecha_completado || row.fecha_programada,
                tipo_actividad: row.tipo_actividad,

                // Información del prospecto
                prospecto: {
                    id: row.prospecto_id,
                    codigo: row.prospecto_codigo,
                    nombre: row.nombre_cliente,
                    telefono: row.telefono,
                    email: row.email,
                    canal_contacto: row.canal_contacto,
                    valor_estimado: parseFloat(row.valor_estimado || 0),
                    probabilidad_cierre: row.probabilidad_cierre
                },

                // Detalles de la actividad
                actividad: {
                    tipo: row.tipo_seguimiento,
                    tipo_contexto: row.tipo_actividad === 'conversion' ? 'Venta Cerrada' :
                                  row.tipo_actividad === 'perdida' ? 'Prospecto Perdido' :
                                  row.tipo_actividad === 'seguimiento_completado' ? 'Seguimiento Realizado' :
                                  row.tipo_actividad === 'seguimiento_vencido' ? 'Seguimiento Vencido' :
                                  row.tipo_seguimiento,
                    descripcion: row.descripcion,
                    resultado: row.resultado,
                    notas: row.notas,
                    calificacion: row.calificacion,
                    estado_prospecto: row.estado_prospecto,
                    motivo_perdida: row.motivo_perdida
                },

                // Información de conversión (si aplica)
                conversion: row.venta_codigo ? {
                    codigo: row.venta_codigo,
                    total: parseFloat(row.venta_total || 0),
                    fecha: row.fecha_venta
                } : null,

                // Métricas calculadas
                metricas: {
                    dias_proceso: parseFloat(row.dias_proceso || 0),
                    impacto_economico: parseFloat(row.impacto_economico || 0)
                },

                // Metadatos
                asesor_nombre: `${row.asesor_nombre} ${row.asesor_apellido || ''}`.trim()
            }));

            res.json({
                success: true,
                data: {
                    historial,
                    paginacion: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: result.rows.length,
                        has_next: result.rows.length === parseInt(limit)
                    },
                    metricas_resumen: {
                        total_actividades: parseInt(metricas.total_actividades),
                        seguimientos_completados: parseInt(metricas.seguimientos_completados),
                        conversiones: parseInt(metricas.conversiones),
                        perdidas: parseInt(metricas.perdidas),
                        valor_total_ventas: parseFloat(metricas.valor_total_ventas || 0),
                        calificacion_promedio: parseFloat(metricas.calificacion_promedio || 0).toFixed(1),
                        dias_promedio_proceso: parseFloat(metricas.dias_promedio_proceso || 0).toFixed(1),
                        tasa_conversion: metricas.total_actividades > 0 ?
                            ((metricas.conversiones / metricas.total_actividades) * 100).toFixed(1) : 0,
                        // 📊 PERFORMANCE SCORE (0-100)
                        score_productividad: (() => {
                            const totalActividades = parseInt(metricas.total_actividades);
                            if (totalActividades === 0) return 0;

                            // Componente 1: Tasa de conversión (40% del score)
                            const tasaConversion = parseFloat(metricas.tasa_conversion || 0);
                            const scoreConversion = Math.min((tasaConversion / 20) * 40, 40); // 20% = 40pts máximo

                            // Componente 2: Velocidad de proceso (30% del score)
                            const diasPromedio = parseFloat(metricas.dias_promedio_proceso || 30);
                            const scoreVelocidad = Math.max(30 - (diasPromedio / 2), 0); // Menos días = mejor score

                            // Componente 3: Probabilidad promedio (30% del score)
                            const avgProbabilidad = historial.reduce((acc, item) =>
                                acc + (item.prospecto.probabilidad_cierre || 50), 0) / historial.length;
                            const scoreProbabilidad = (avgProbabilidad / 100) * 30;

                            return Math.round(scoreConversion + scoreVelocidad + scoreProbabilidad);
                        })()
                    },
                    filtros_aplicados: {
                        asesor_id: asesorIdFinal,
                        fecha_desde,
                        fecha_hasta,
                        tipo_actividad,
                        estado
                    }
                },
                message: `Historial obtenido: ${historial.length} actividades encontradas`
            });

        } catch (error) {
            logger.error('Error en obtenerHistorialCompleto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener historial completo: ' + error.message
            });
        }
    }
}

module.exports = SeguimientosController;