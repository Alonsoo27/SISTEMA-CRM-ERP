const { query, pool } = require('../../../config/database');
const winston = require('winston');
const cron = require('node-cron');

// 🔔 INTEGRACIÓN CON SISTEMA DE NOTIFICACIONES AUTOMÁTICAS
const NotificacionesController = require('../../notificaciones/controllers/notificacionesController');

// 🔄 INTEGRACIÓN CON SISTEMA DE SINCRONIZACIÓN DE CACHE
const { sincronizarCacheSeguimientos } = require('../utils/sincronizarSeguimientos');

// 📅 INTEGRACIÓN CON HELPER DE FECHAS FLEXIBLE
const { convertirHoraPeruAUTC, convertirUTCAHoraPeru, calcularFechaLimite, esHorarioLaboral, calcular2DiasLaborales, corregirFechasSeguimientos } = require('../utils/fechasHelper');

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

            // 🌎 CONVERTIR DE HORA PERÚ A UTC
            // El frontend envía fechas en hora Perú (sin offset), hay que convertir a UTC
            const fechaProgramadaUTC = convertirHoraPeruAUTC(fecha_programada);

            // Validar que la fecha sea futura (comparar en UTC)
            if (fechaProgramadaUTC <= new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'La fecha de seguimiento debe ser futura'
                });
            }

            const asesor_id = req.user?.id || 1;

            // 🕐 fecha_limite: Alerta al asesor (4h para Llamada según tipo)
            // Usar la fecha UTC convertida
            const fecha_limite = calcularFechaLimite(fechaProgramadaUTC.toISOString(), tipo);

            // Crear seguimiento con fechas en UTC
            const insertQuery = `
                INSERT INTO seguimientos (
                    prospecto_id, asesor_id, fecha_programada, fecha_limite, tipo, descripcion
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const result = await query(insertQuery, [
                parseInt(id), asesor_id, fechaProgramadaUTC.toISOString(), fecha_limite.toISOString(), tipo, descripcion
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

            // ❌ NOTIFICACIÓN INMEDIATA ELIMINADA
            // Las notificaciones de "seguimiento_proximo" deben enviarse mediante cron job
            // 2-4 horas ANTES de la fecha programada, NO al momento de crear el seguimiento.
            // Esto evita spam de notificaciones cuando el asesor programa seguimientos futuros.

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

                        // 🌎 CONVERTIR DE HORA PERÚ A UTC
                        const fechaProgramadaUTC = convertirHoraPeruAUTC(fecha_programada);

                        // Validar horario laboral (usando fecha UTC)
                        if (!esHorarioLaboral(fechaProgramadaUTC.toISOString())) {
                            logger.warn(`⚠️ Fecha fuera de horario laboral: ${fecha_programada} (tipo: ${tipo})`);
                            // Continuar de todos modos, el helper ajustará automáticamente
                        }

                        // Calcular fecha_limite usando helper flexible (sin hardcode de 18h)
                        const fechaLimite = calcularFechaLimite(fechaProgramadaUTC.toISOString(), tipo);

                        // Crear seguimiento con fechas en UTC
                        await query(`
                            INSERT INTO seguimientos (
                                prospecto_id, asesor_id, fecha_programada, fecha_limite,
                                tipo, descripcion, completado, visible_para_asesor
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [
                            data.prospecto_id,
                            data.asesor_id,
                            fechaProgramadaUTC.toISOString(),
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
            // ✅ FIX: Verificar estado del prospecto antes de notificar
            try {
                const prospectoResult = await query('SELECT estado FROM prospectos WHERE id = $1', [data.prospecto_id]);
                const prospecto = prospectoResult.rows[0];

                if (prospecto && !['Cerrado', 'Perdido', 'Convertido'].includes(prospecto.estado)) {
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
                } else {
                    logger.info(`⏭️ Notificación seguimiento_completado omitida: prospecto en estado ${prospecto?.estado || 'desconocido'}`);
                }
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificación seguimiento_completado:', errorNotif);
            }

            // ============================================
            // 🔴 CAMBIO AUTOMÁTICO A PERDIDO
            // ============================================
            // Si el cliente no está interesado, marcar el prospecto como perdido
            if (resultado === 'no_interesado' || resultado === 'Cliente No Interesado') {
                logger.info(`🔴 Resultado "no_interesado" detectado - Marcando prospecto ${data.prospecto_id} como Perdido`);

                try {
                    // Cambiar estado del prospecto a Perdido
                    await query(`
                        UPDATE prospectos
                        SET estado = $1,
                            tipo_cierre = $2,
                            motivo_perdida = $3,
                            fecha_cierre = $4,
                            estado_anterior = estado
                        WHERE id = $5 AND estado NOT IN ('Cerrado', 'Perdido')
                    `, ['Perdido', 'manual', 'Cliente no interesado', new Date(), data.prospecto_id]);

                    logger.info(`✅ Prospecto ${data.prospecto_id} marcado como Perdido exitosamente`);

                    return res.json({
                        success: true,
                        message: '✅ Seguimiento completado - Prospecto marcado como Perdido (cliente no interesado)',
                        data: {
                            seguimiento_completado: true,
                            prospecto_perdido: true,
                            motivo: 'Cliente no interesado',
                            resultado: resultado
                        }
                    });

                } catch (errorPerdido) {
                    logger.error('❌ Error marcando prospecto como perdido:', errorPerdido);
                    // Continuar con el flujo normal si falla
                }
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

            // ============================================
            // ✅ VALIDACIÓN: PROSPECTO ACTIVO DEBE TENER SEGUIMIENTO FUTURO
            // ============================================
            // Verificar que si el prospecto sigue activo, se haya programado al menos un seguimiento
            const prospectoResult = await query('SELECT estado FROM prospectos WHERE id = $1', [data.prospecto_id]);
            const prospecto = prospectoResult.rows[0];

            // Resultados que cierran automáticamente el prospecto (no requieren seguimiento)
            const resultadosCierran = ['no_interesado', 'Cliente No Interesado'];
            const debeConvertir = SeguimientosController.debeConvertirAutomaticamente(resultado);

            // Si el prospecto sigue activo y NO se programó ningún seguimiento futuro
            if (prospecto &&
                !['Cerrado', 'Perdido', 'Convertido'].includes(prospecto.estado) &&
                seguimientosCreados === 0 &&
                !resultadosCierran.includes(resultado) &&
                !debeConvertir) {

                logger.warn(`⚠️ Intento de completar seguimiento sin programar siguiente - Prospecto ${data.prospecto_id} en estado ${prospecto.estado}`);

                return res.status(400).json({
                    success: false,
                    error: 'Debes programar al menos un seguimiento futuro para este prospecto activo',
                    requiere_seguimiento: true,
                    prospecto_estado: prospecto.estado,
                    ayuda: 'Usa el modal de completar seguimiento y programa la próxima acción con el cliente'
                });
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
    
    // 🗑️ CÓDIGO ELIMINADO: obtenerProspectosListos - No se usaba en ningún lugar

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
                       p.numero_reasignaciones, p.asesor_id as prospecto_asesor_id, p.asesor_nombre,
                       p.modo_libre, p.activo, p.estado_seguimiento, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND s.vencido = $2 AND s.fecha_limite < $3
                AND p.activo = $4 AND p.estado NOT IN ('Cerrado', 'Perdido')
                AND p.modo_libre = $5 AND s.visible_para_asesor = $6
            `, [false, false, ahora, true, false, true]);

            // 🔧 CORRECCIÓN: Aplicar fix de timezone a las fechas leídas
            const data = corregirFechasSeguimientos(result.rows);
            
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
            // ✅ INCLUYE prospectos tomados de modo libre (numero_reasignaciones >= 3 pero modo_libre = false)
            const result = await query(`
                SELECT s.*,
                       p.id as prospecto_id, p.codigo, p.nombre_cliente, p.estado,
                       p.numero_reasignaciones, p.asesor_id as prospecto_asesor_id, p.asesor_nombre,
                       p.modo_libre, p.activo, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND s.fecha_limite < $2
                AND p.activo = $3 AND p.estado NOT IN ('Cerrado', 'Perdido')
                AND p.modo_libre = $4
                AND s.visible_para_asesor = $5
            `, [false, ahora, true, false, true]);
            
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
                    // ✅ FIX: Verificación defensiva - Saltar prospectos cerrados o perdidos
                    if (seguimiento.estado === 'Cerrado' || seguimiento.estado === 'Perdido') {
                        logger.warn(`⚠️ Seguimiento ${seguimiento.id} saltado: prospecto ${seguimiento.codigo} está en estado ${seguimiento.estado}`);
                        resultado.procesados++;
                        continue;
                    }

                    // ✅ Verificar si han pasado 2 DÍAS LABORALES desde el vencimiento
                    const fechaLimiteVencimiento = new Date(seguimiento.fecha_limite);
                    const fechaLimite2DiasLaborales = calcular2DiasLaborales(fechaLimiteVencimiento);
                    const ahora_date = new Date();
                    const haPasado2DiasLaborales = ahora_date >= fechaLimite2DiasLaborales;

                    // Calcular horas vencidas solo para logging
                    const horasVencidas = (ahora_date - fechaLimiteVencimiento) / (1000 * 60 * 60);

                    // ✅ SOLO MARCAR COMO VENCIDO - NO ocultar ni completar
                    // El asesor debe verlo en la balanza por 2 días laborales
                    await query(`
                        UPDATE seguimientos
                        SET vencido = $1
                        WHERE id = $2
                    `, [true, seguimiento.id]);

                    // ⏰ LÓGICA CORRECTA: Esperar 2 días laborales ANTES de traspasar
                    // Si NO han pasado 2 días laborales → Solo notificar y esperar
                    if (!haPasado2DiasLaborales) {
                        // 🔔 NOTIFICACIÓN: seguimiento_vencido (aún en período de espera)
                        // ✅ FIX: Solo notificar si el prospecto está en estados activos
                        if (!['Cerrado', 'Perdido', 'Convertido'].includes(seguimiento.estado)) {
                            try {
                                // ✅ FIX SPAM: Verificar si ya notificamos en las últimas 4 horas
                                const yaNotificado = await query(`
                                    SELECT id FROM notificaciones
                                    WHERE usuario_id = $1
                                    AND tipo = $2
                                    AND prospecto_id = $3
                                    AND created_at > NOW() - INTERVAL '4 hours'
                                    LIMIT 1
                                `, [seguimiento.prospecto_asesor_id, 'seguimiento_urgente', seguimiento.prospecto_id]);

                                if (!yaNotificado.rows || yaNotificado.rows.length === 0) {
                                    // Solo notificar si no hay notificación reciente
                                    await NotificacionesController.crearNotificaciones({
                                        tipo: 'seguimiento_urgente',
                                        modo: 'basico',
                                        data: {
                                            usuario_id: seguimiento.prospecto_asesor_id,
                                            prospecto_id: seguimiento.prospecto_id,
                                            prospecto_codigo: seguimiento.codigo,
                                            prospecto_nombre: seguimiento.nombre_cliente,
                                            seguimiento_id: seguimiento.id,
                                            horas_vencidas: Math.round(horasVencidas),
                                            valor_estimado: seguimiento.valor_estimado || 0
                                        },
                                        auto_prioridad: true
                                    });
                                    logger.info(`⏰ Seguimiento vencido pero en período de gracia (faltan ${Math.round((fechaLimite2DiasLaborales - ahora_date) / (1000 * 60 * 60))}h para traspaso)`);
                                } else {
                                    logger.info(`⏭️ Notificación omitida: ya notificado hace menos de 4 horas`);
                                }
                            } catch (errorNotif) {
                                logger.error('⚠️ Error creando notificación:', errorNotif);
                            }
                        } else {
                            logger.info(`⏭️ Notificación omitida: prospecto ${seguimiento.codigo} está en estado ${seguimiento.estado}`);
                        }

                        resultado.procesados++;
                        continue; // ✅ ESPERAR - No traspasar aún
                    }

                    // ✅ HAN PASADO 2 DÍAS LABORALES → DECIDIR ACCIÓN
                    logger.info(`🔄 Procesando ${seguimiento.codigo} (pasaron 2 días laborales desde vencimiento)`, {
                        fecha_limite_original: fechaLimiteVencimiento.toISOString(),
                        fecha_limite_traspaso: fechaLimite2DiasLaborales.toISOString(),
                        horas_transcurridas: Math.round(horasVencidas),
                        numero_reasignaciones: seguimiento.numero_reasignaciones
                    });

                    // 🚨 CASO ESPECIAL: Prospecto tomado de modo libre (numero_reasignaciones >= 3)
                    // Si falla después de ser tomado de modo libre → PERDIDO (última oportunidad)
                    if (seguimiento.numero_reasignaciones >= 3) {
                        // ✅ Ocultar seguimiento antes de marcar como perdido
                        await query(`
                            UPDATE seguimientos
                            SET visible_para_asesor = $1, completado = $2,
                                fecha_completado = $3, resultado = $4
                            WHERE id = $5
                        `, [false, true, new Date(), 'Prospecto marcado como perdido automáticamente', seguimiento.id]);

                        // Marcar prospecto como perdido
                        await query(`
                            UPDATE prospectos
                            SET estado = $1, tipo_cierre = $2, motivo_perdida = $3, fecha_cierre = $4
                            WHERE id = $5 AND estado NOT IN ('Cerrado', 'Perdido')
                        `, ['Perdido', 'automatico', 'Sin seguimiento después de ser tomado de modo libre', new Date(), seguimiento.prospecto_id]);

                        logger.info(`🔴 Prospecto ${seguimiento.codigo} marcado como PERDIDO (tomado de modo libre y sin seguimiento)`, {
                            numero_reasignaciones: seguimiento.numero_reasignaciones,
                            asesor_final: seguimiento.asesor_nombre
                        });

                        resultado.procesados++;
                        continue;
                    }

                    const nuevasReasignaciones = seguimiento.numero_reasignaciones + 1;

                    // ✅ FIX: Validación explícita para evitar bugs con contadores inconsistentes
                    if (nuevasReasignaciones <= 2) {
                        // ✅ CRÍTICO: PRIMERO completar el seguimiento viejo ANTES de reasignar
                        // Esto previene violación del constraint idx_seguimiento_activo_unico
                        await query(`
                            UPDATE seguimientos
                            SET visible_para_asesor = $1, completado = $2,
                                fecha_completado = $3, resultado = $4
                            WHERE id = $5
                        `, [false, true, new Date(), 'Traspasado por vencimiento después de 2 días laborales', seguimiento.id]);

                        // ✅ DESPUÉS: REASIGNACIÓN NORMAL (1er o 2do rebote)
                        // Ahora sí puede crear un nuevo seguimiento sin violar el constraint
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

                    } else if (nuevasReasignaciones === 3) {
                        // ✅ CRÍTICO: PRIMERO completar el seguimiento viejo ANTES de activar modo libre
                        await query(`
                            UPDATE seguimientos
                            SET visible_para_asesor = $1, completado = $2,
                                fecha_completado = $3, resultado = $4
                            WHERE id = $5
                        `, [false, true, new Date(), 'Modo libre activado después de 3 reasignaciones', seguimiento.id]);

                        // ✅ DESPUÉS: ACTIVAR MODO LIBRE (3er rebote exacto - numero_reasignaciones = 2 → 3)
                        await SeguimientosController.activarModoLibre(seguimiento.prospecto_id);
                        resultado.modo_libre_activado++;

                        // Actualizar estado del prospecto a modo libre
                        await query(`
                            UPDATE prospectos
                            SET estado_seguimiento = $1, fecha_ultimo_seguimiento = $2
                            WHERE id = $3
                        `, ['modo_libre', new Date(), seguimiento.prospecto_id]);

                    } else {
                        // ⚠️ CASO ANÓMALO: numero_reasignaciones > 3 (no debería pasar con LEAST())
                        logger.warn(`⚠️ ALERTA: Prospecto ${seguimiento.codigo} tiene ${seguimiento.numero_reasignaciones} reasignaciones (>3). Ignorando procesamiento.`, {
                            prospecto_id: seguimiento.prospecto_id,
                            numero_reasignaciones: seguimiento.numero_reasignaciones,
                            asesor_actual: seguimiento.asesor_nombre
                        });
                        // No hacer nada, ya está en un estado inconsistente que requiere revisión manual
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
        const client = await pool.connect();

        try {
            // 🔒 INICIAR TRANSACCIÓN ATÓMICA - Fix race condition
            await client.query('BEGIN');

            // 🎯 SELECT FOR UPDATE: Bloquear el prospecto para esta transacción
            const prospectoResult = await client.query(
                'SELECT * FROM prospectos WHERE id = $1 AND activo = $2 FOR UPDATE',
                [prospecto_id, true]
            );

            if (!prospectoResult.rows || prospectoResult.rows.length === 0) {
                await client.query('ROLLBACK');
                throw new Error('Prospecto no encontrado');
            }

            const prospecto = prospectoResult.rows[0];

            // ✅ Validar que el prospecto esté en estado válido para reasignar
            if (['Cerrado', 'Perdido', 'Convertido'].includes(prospecto.estado)) {
                await client.query('ROLLBACK');
                logger.warn(`⚠️ Intento de reasignar prospecto ${prospecto.codigo} en estado ${prospecto.estado}`);
                throw new Error(`No se puede reasignar prospecto en estado ${prospecto.estado}`);
            }

            // ============================================
            // DESVINCULACIÓN DE CAMPAÑA (si está asignado)
            // ============================================
            // Al traspasar un prospecto, se desvincula de la campaña original
            // para mantener métricas limpias de efectividad del asesor
            if (prospecto.campana_id && prospecto.campana_id !== null) {
                try {
                    logger.info(`🔗 Desvinculando prospecto ${prospecto.codigo} de campaña ${prospecto.campana_id} antes de traspaso`);

                    // Registrar desvinculación en historial usando función SQL
                    await client.query(
                        `SELECT registrar_desvinculacion_campana($1, $2) as desvinculado`,
                        [prospecto_id, `Traspaso por ${motivo}`]
                    );

                    // Limpiar campos de campaña en el prospecto
                    await client.query(`
                        UPDATE prospectos
                        SET campana_id = NULL,
                            campana_linea_detectada = NULL,
                            campana_valor_producto = NULL
                        WHERE id = $1
                    `, [prospecto_id]);

                    logger.info(`✅ Prospecto ${prospecto.codigo} desvinculado exitosamente de campaña`);
                } catch (errorCampana) {
                    logger.error('⚠️ Error desvinculando campaña (continuando con traspaso):', errorCampana);
                    // No detener el traspaso si falla la desvinculación
                }
            }

            // ============================================
            // SISTEMA DE REASIGNACIÓN ALEATORIA
            // ============================================
            // LÓGICA: Buscar solo VENDEDOREs (rol_id = 7) disponibles
            // - Selección ALEATORIA entre vendedores activos
            // - Prospectos de SUPER_ADMIN/ADMIN/JEFE_VENTAS → van a VENDEDOREs
            // - Prospectos de VENDEDOREs → van a otros VENDEDOREs
            // - Si no hay VENDEDOREs disponibles → MODO LIBRE automático
            // - EXCLUYE asesor ID 19 (EMPRESA S.A.C. - usuario ficticio)
            // ============================================
            const asesoresResult = await client.query(`
                SELECT u.id, u.nombre, u.apellido
                FROM usuarios u
                WHERE u.rol_id = $1 AND u.activo = $2 AND u.id != $3 AND u.id != 19
                ORDER BY RANDOM()
                LIMIT 1
            `, [7, true, prospecto.asesor_id]); // rol_id = 7 (VENDEDOR)

            if (!asesoresResult.rows || asesoresResult.rows.length === 0) {
                // ✅ FIX: Si no hay VENDEDOREs disponibles, activar MODO LIBRE + LIMPIAR asesor_id
                const asesorAnteriorId = prospecto.asesor_id; // Guardar para invalidar cache

                await client.query(`
                    UPDATE prospectos
                    SET asesor_anterior_id = asesor_id,
                        asesor_id = NULL,
                        asesor_nombre = NULL,
                        modo_libre = $1,
                        fecha_modo_libre = CURRENT_TIMESTAMP,
                        numero_reasignaciones = LEAST($2, 5),
                        fecha_traspaso = NOW(),
                        motivo_traspaso = $3
                    WHERE id = $4
                `, [true, prospecto.numero_reasignaciones + 1, 'sin_vendedores_disponibles', prospecto.id]);

                // ✅ COMMIT: Todo exitoso
                await client.query('COMMIT');

                // ✅ FIX: Invalidar cache del asesor anterior
                const cacheService = require('../utils/sincronizarSeguimientos');
                if (asesorAnteriorId && cacheService.invalidarPorAsesor) {
                    await cacheService.invalidarPorAsesor(asesorAnteriorId);
                }

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
            
            // Seleccionar asesor aleatorio
            const asesorSeleccionado = asesoresResult.rows[0];
            const asesorAnteriorId = prospecto.asesor_id; // Guardar para invalidar cache

            // Actualizar prospecto con auditoría completa
            await client.query(`
                UPDATE prospectos
                SET asesor_anterior_id = asesor_id,
                    asesor_id = $1,
                    asesor_nombre = $2,
                    numero_reasignaciones = $3,
                    seguimiento_vencido = $4,
                    fecha_traspaso = NOW(),
                    motivo_traspaso = $5
                WHERE id = $6
            `, [
                asesorSeleccionado.id,
                `${asesorSeleccionado.nombre} ${asesorSeleccionado.apellido}`,
                prospecto.numero_reasignaciones + 1,
                true,
                motivo,
                prospecto_id
            ]);

            // ✅ FIX: Crear nuevo seguimiento para el nuevo asesor
            // 🕐 Programar seguimiento para 2 días laborales desde ahora
            const ahora = new Date();
            const fechaProgramada = calcular2DiasLaborales(ahora);

            // ✅ FIX: Validar que fechaProgramada sea válida antes de crear seguimiento
            if (!fechaProgramada || isNaN(fechaProgramada.getTime())) {
                await client.query('ROLLBACK');
                logger.error(`❌ Error: fechaProgramada inválida para prospecto ${prospecto_id}`, {
                    fechaProgramada,
                    ahora: ahora.toISOString()
                });
                throw new Error('No se pudo calcular fecha programada válida');
            }

            // fecha_limite: 4h después de la fecha programada (alerta al asesor)
            const fechaLimite = calcularFechaLimite(fechaProgramada.toISOString(), 'Llamada');

            // Validar fechaLimite también
            if (!fechaLimite) {
                await client.query('ROLLBACK');
                logger.error(`❌ Error: fechaLimite inválida para prospecto ${prospecto_id}`);
                throw new Error('No se pudo calcular fecha límite válida');
            }

            // ✅ DEFENSA EN PROFUNDIDAD: Completar CUALQUIER seguimiento activo previo
            // Esto previene violaciones del constraint idx_seguimiento_activo_unico
            const seguimientosCompletados = await client.query(`
                UPDATE seguimientos
                SET completado = true,
                    visible_para_asesor = false,
                    fecha_completado = NOW(),
                    resultado = 'Completado automáticamente al reasignar prospecto'
                WHERE prospecto_id = $1
                  AND completado = false
                  AND visible_para_asesor = true
                RETURNING id
            `, [prospecto_id]);

            if (seguimientosCompletados.rows.length > 0) {
                logger.info(`🔄 Completados ${seguimientosCompletados.rows.length} seguimiento(s) activo(s) previo(s) del prospecto ${prospecto_id}`);
            }

            // ✅ AHORA SÍ: Crear nuevo seguimiento para el nuevo asesor
            await client.query(`
                INSERT INTO seguimientos (
                    prospecto_id, asesor_id, fecha_programada, fecha_limite,
                    tipo, descripcion, completado, visible_para_asesor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                prospecto_id,
                asesorSeleccionado.id,
                fechaProgramada.toISOString(),
                fechaLimite, // calcularFechaLimite ya devuelve ISO string
                'Llamada',
                `Seguimiento automático después de reasignación por: ${motivo}`,
                false,
                true
            ]);

            logger.info(`✅ Nuevo seguimiento creado para ${asesorSeleccionado.nombre} (fecha: ${fechaProgramada.toISOString()})`);

            // ✅ FIX: Usar solo sistema unificado de notificaciones
            // La tabla notificaciones_reasignacion se mantiene solo para auditoría histórica
            // Las notificaciones activas se envían por el sistema unificado
            await SeguimientosController.crearNotificacionesReasignacion(
                prospecto_id,
                prospecto.asesor_id,
                asesorSeleccionado.id,
                motivo
            );

            // ✅ COMMIT: Todo exitoso
            await client.query('COMMIT');

            // ✅ FIX: Invalidar cache del asesor anterior y nuevo
            const cacheService = require('../utils/sincronizarSeguimientos');
            if (asesorAnteriorId && cacheService.invalidarPorAsesor) {
                await cacheService.invalidarPorAsesor(asesorAnteriorId);
            }
            if (asesorSeleccionado.id && cacheService.invalidarPorAsesor) {
                await cacheService.invalidarPorAsesor(asesorSeleccionado.id);
            }

            logger.info(`🔄 Prospecto ${prospecto.codigo} reasignado de ${prospecto.asesor_nombre} a ${asesorSeleccionado.nombre}`);

            return {
                asesor_anterior: prospecto.asesor_nombre,
                asesor_nuevo: `${asesorSeleccionado.nombre} ${asesorSeleccionado.apellido}`,
                motivo
            };

        } catch (error) {
            // ❌ ROLLBACK en caso de error
            await client.query('ROLLBACK');
            logger.error('Error en reasignarProspecto:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Activar modo libre (free-for-all)
     */
    static async activarModoLibre(prospecto_id) {
        try {
            // ✅ FIX: Obtener datos del prospecto antes de actualizar (para invalidar cache)
            const prospectoActualResult = await query('SELECT asesor_id FROM prospectos WHERE id = $1', [prospecto_id]);
            const asesorAnteriorId = prospectoActualResult.rows[0]?.asesor_id;

            // Obtener todos los asesores de ventas (VENDEDORES activos, excluir usuario ficticio)
            const asesoresResult = await query(`
                SELECT id FROM usuarios
                WHERE rol_id = $1 AND activo = $2 AND id != 19
            `, [7, true]); // rol_id = 7 (VENDEDOR)

            const asesor_ids = asesoresResult.rows?.map(a => a.id) || [];

            // ✅ FIX: Activar modo libre en prospecto con auditoría + LIMPIAR asesor_id
            // Cuando un prospecto está en modo libre, no pertenece a nadie hasta que lo tomen
            await query(`
                UPDATE prospectos
                SET asesor_anterior_id = asesor_id,
                    asesor_id = NULL,
                    asesor_nombre = NULL,
                    modo_libre = $1,
                    fecha_modo_libre = $2,
                    numero_reasignaciones = LEAST(numero_reasignaciones + 1, 5),
                    fecha_traspaso = NOW(),
                    motivo_traspaso = $3
                WHERE id = $4
            `, [true, new Date().toISOString(), 'modo_libre_activado', prospecto_id]);
            
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

            // ✅ FIX: Registrar en tabla de auditoría (notificaciones_reasignacion)
            // Solo para histórico, las notificaciones activas se envían más abajo
            await SeguimientosController.crearNotificacionModoLibre(prospecto_id, asesor_ids);

            // 🔔 NOTIFICACIÓN VÍA SISTEMA UNIFICADO: prospecto_libre_activado (SISTEMA PRINCIPAL)
            // ✅ FIX: Solo notificar si el prospecto está en estados activos
            try {
                // Obtener datos del prospecto
                const prospectoData = await query('SELECT * FROM prospectos WHERE id = $1', [prospecto_id]);
                const prospecto = prospectoData.rows[0];

                if (prospecto && !['Cerrado', 'Perdido', 'Convertido'].includes(prospecto.estado)) {
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
                } else {
                    logger.info(`⏭️ Notificaciones modo libre omitidas: prospecto en estado ${prospecto?.estado || 'desconocido'}`);
                }
            } catch (errorNotif) {
                logger.error('⚠️ Error creando notificaciones de modo libre:', errorNotif);
            }

            logger.info(`🏁 Modo libre activado para prospecto ${prospecto_id}`);

            // ✅ FIX: Invalidar cache del asesor anterior para que vea los cambios inmediatamente
            if (asesorAnteriorId) {
                const cacheService = require('../utils/sincronizarSeguimientos');
                if (cacheService.invalidarPorAsesor) {
                    await cacheService.invalidarPorAsesor(asesorAnteriorId);
                    logger.info(`✅ Cache invalidado para asesor ${asesorAnteriorId}`);
                }
            }

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
                AND p.estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                ORDER BY s.fecha_programada ASC`
                : `SELECT s.*,
                       p.codigo, p.nombre_cliente, p.apellido_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND p.activo = $2
                AND s.visible_para_asesor = $3
                AND p.estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                ORDER BY s.fecha_programada ASC`;

            const seguimientosParams = asesor_id
                ? [asesor_id, false, true, true]
                : [false, true, true];

            const seguimientosResult = await query(seguimientosQuery, seguimientosParams);

            // 🔧 CORRECCIÓN: Aplicar fix de timezone a las fechas leídas
            const seguimientos = corregirFechasSeguimientos(seguimientosResult.rows);

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
                       p.codigo, p.nombre_cliente, p.apellido_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.asesor_id = $1 AND s.completado = $2
                AND COALESCE(s.fecha_completado, s.updated_at, s.created_at) >= $3
                AND p.activo = true
                AND p.estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                ORDER BY COALESCE(s.fecha_completado, s.updated_at, s.created_at) DESC`
                : `SELECT s.*,
                       p.codigo, p.nombre_cliente, p.apellido_cliente, p.empresa, p.telefono, p.estado, p.valor_estimado
                FROM seguimientos s
                INNER JOIN prospectos p ON s.prospecto_id = p.id
                WHERE s.completado = $1 AND COALESCE(s.fecha_completado, s.updated_at, s.created_at) >= $2
                AND p.activo = true
                AND p.estado NOT IN ('Cerrado', 'Perdido', 'Convertido')
                ORDER BY COALESCE(s.fecha_completado, s.updated_at, s.created_at) DESC`;

            const realizadosParams = asesor_id
                ? [asesor_id, true, unMesAtras.toISOString()]
                : [true, unMesAtras.toISOString()];

            const realizadosResult = await query(realizadosQuery, realizadosParams);
            // 🔧 CORRECCIÓN: Aplicar fix de timezone a las fechas leídas
            const seguimientosRealizados = corregirFechasSeguimientos(realizadosResult.rows);

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
            
            // Categorizar seguimientos - CORRECCIÓN: Usar fecha_programada con timezone Perú
            // 🌎 IMPORTANTE: Convertir a hora de Perú para clasificar correctamente
            const ahoraUTC = new Date();
            const ahoraPeru = convertirUTCAHoraPeru(ahoraUTC);

            // Obtener solo la parte de fecha (YYYY-MM-DD) en hora Perú para comparaciones de día
            const diaHoyPeru = ahoraPeru.toISOString().split('T')[0];

            const seguimientosCategorias = {
                // 🔴 VENCIDOS: fecha_programada ya pasó (excluyendo los de hoy en hora Perú)
                vencidos: seguimientos?.filter(s => {
                    const fechaProgramadaUTC = new Date(s.fecha_programada);
                    const fechaProgramadaPeru = convertirUTCAHoraPeru(fechaProgramadaUTC);
                    const diaProgramadoPeru = fechaProgramadaPeru.toISOString().split('T')[0];

                    return fechaProgramadaPeru < ahoraPeru && diaProgramadoPeru !== diaHoyPeru;
                }) || [],
                // 📅 HOY: fecha_programada es hoy en hora Perú
                hoy: seguimientos?.filter(s => {
                    const fechaProgramadaUTC = new Date(s.fecha_programada);
                    const fechaProgramadaPeru = convertirUTCAHoraPeru(fechaProgramadaUTC);
                    const diaProgramadoPeru = fechaProgramadaPeru.toISOString().split('T')[0];

                    return diaProgramadoPeru === diaHoyPeru;
                }) || [],
                // 📆 PRÓXIMOS: fecha_programada es futura en hora Perú (no hoy)
                proximos: seguimientos?.filter(s => {
                    const fechaProgramadaUTC = new Date(s.fecha_programada);
                    const fechaProgramadaPeru = convertirUTCAHoraPeru(fechaProgramadaUTC);
                    const diaProgramadoPeru = fechaProgramadaPeru.toISOString().split('T')[0];

                    return fechaProgramadaPeru > ahoraPeru && diaProgramadoPeru !== diaHoyPeru;
                }) || []
            };

            // 🔍 LOG: Verificar clasificación
            console.log(`📊 [DEBUG Clasificación] Total pendientes: ${seguimientos?.length || 0}`);
            console.log(`   - Vencidos: ${seguimientosCategorias.vencidos.length}`);
            console.log(`   - Hoy: ${seguimientosCategorias.hoy.length}`);
            console.log(`   - Próximos: ${seguimientosCategorias.proximos.length}`);

            // Verificar que todos fueron clasificados
            const totalClasificados = seguimientosCategorias.vencidos.length +
                                     seguimientosCategorias.hoy.length +
                                     seguimientosCategorias.proximos.length;
            if (totalClasificados !== (seguimientos?.length || 0)) {
                console.warn(`⚠️ [DEBUG] ALERTA: ${(seguimientos?.length || 0) - totalClasificados} seguimientos NO clasificados`);
            }
            
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
                    tiempo_vencimiento: '2 días laborales (L-V: 10h/día, Sáb: 3h)',
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

            // 🔧 CORRECCIÓN: Aplicar fix de timezone a las fechas leídas
            const seguimientosCorregidos = corregirFechasSeguimientos(result.rows);

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
            const historial = seguimientosCorregidos.map(row => ({
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
                        total: seguimientosCorregidos.length,
                        has_next: seguimientosCorregidos.length === parseInt(limit)
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