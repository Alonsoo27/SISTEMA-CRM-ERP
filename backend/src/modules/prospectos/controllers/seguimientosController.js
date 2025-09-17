const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const cron = require('node-cron');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
            
            // Calcular fecha límite usando la función de BD (18 horas laborales)
            const { data: fechaLimiteResult } = await supabase
                .rpc('calcular_fecha_limite_laboral', {
                    fecha_inicio: fecha_programada
                });
            
            const fecha_limite = fechaLimiteResult;
            
            // Crear seguimiento
            const { data: seguimiento, error: errorSeguimiento } = await supabase
                .from('seguimientos')
                .insert([{
                    prospecto_id: parseInt(id),
                    asesor_id: asesor_id,
                    fecha_programada: fecha_programada,
                    fecha_limite: fecha_limite,
                    tipo: tipo,
                    descripcion: descripcion
                }])
                .select()
                .single();
            
            if (errorSeguimiento) {
                logger.error('Error al crear seguimiento:', errorSeguimiento);
                throw errorSeguimiento;
            }
            
            // Actualizar prospecto con seguimiento obligatorio
            const { error: errorProspecto } = await supabase
                .from('prospectos')
                .update({
                    seguimiento_obligatorio: fecha_programada,
                    seguimiento_completado: false,
                    fecha_seguimiento: fecha_programada
                })
                .eq('id', id);
            
            if (errorProspecto) {
                logger.error('Error al actualizar prospecto con seguimiento:', errorProspecto);
                throw errorProspecto;
            }
            
            logger.info(`Seguimiento creado: Prospecto ${id}, fecha límite: ${fecha_limite}`);
            
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
     * Marcar seguimiento como completado - CON CONVERSIÓN AUTOMÁTICA
     */
    static async completarSeguimiento(req, res) {
        try {
            const { id } = req.params;
            const { resultado = 'Seguimiento completado', notas = '', calificacion = null } = req.body;
            
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de seguimiento inválido'
                });
            }
            
            // Actualizar seguimiento
            const { data, error } = await supabase
                .from('seguimientos')
                .update({
                    completado: true,
                    fecha_completado: new Date().toISOString(),
                    resultado: resultado,
                    notas: notas,
                    calificacion: calificacion,
                    completed_by: req.user?.id
                })
                .eq('id', id)
                .select('prospecto_id')
                .single();
            
            if (error) {
                logger.error('Error al completar seguimiento:', error);
                throw error;
            }
            
            if (!data) {
                return res.status(404).json({
                    success: false,
                    error: 'Seguimiento no encontrado'
                });
            }
            
            // Actualizar prospecto
            await supabase
                .from('prospectos')
                .update({ seguimiento_completado: true })
                .eq('id', data.prospecto_id);
            
            logger.info(`Seguimiento completado: ${id} con resultado: ${resultado}`);
            
            // ============================================
            // 🚀 CONVERSIÓN AUTOMÁTICA
            // ============================================
            
            if (this.debeConvertirAutomaticamente(resultado)) {
                logger.info(`🎯 Resultado exitoso detectado: ${resultado} - Iniciando conversión automática`);
                
                try {
                    const resultadoConversion = await this.ejecutarConversionAutomatica({
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
    
    /**
     * PUT /api/prospectos/seguimientos/:id/posponer
     * Posponer seguimiento (snooze)
     */
    static async posponerSeguimiento(req, res) {
        try {
            const { id } = req.params;
            const { nueva_fecha, motivo } = req.body;
            
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de seguimiento inválido'
                });
            }
            
            if (!nueva_fecha || !motivo) {
                return res.status(400).json({
                    success: false,
                    error: 'Nueva fecha y motivo son obligatorios'
                });
            }
            
            // Validar que la nueva fecha sea futura
            const fechaNueva = new Date(nueva_fecha);
            if (fechaNueva <= new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'La nueva fecha debe ser futura'
                });
            }
            
            // Calcular nueva fecha límite
            const { data: nuevaFechaLimite } = await supabase
                .rpc('calcular_fecha_limite_laboral', {
                    fecha_inicio: nueva_fecha
                });
            
            // Actualizar seguimiento
            const { data, error } = await supabase
                .from('seguimientos')
                .update({
                    pospuesto: true,
                    fecha_posposicion: new Date().toISOString(),
                    motivo_posposicion: motivo,
                    nueva_fecha_programada: nueva_fecha,
                    fecha_programada: nueva_fecha,
                    fecha_limite: nuevaFechaLimite
                })
                .eq('id', id)
                .select()
                .single();
            
            if (error) {
                logger.error('Error al posponer seguimiento:', error);
                throw error;
            }
            
            if (!data) {
                return res.status(404).json({
                    success: false,
                    error: 'Seguimiento no encontrado'
                });
            }
            
            logger.info(`Seguimiento pospuesto: ${id} hasta ${nueva_fecha}`);
            
            res.json({
                success: true,
                data: data,
                message: 'Seguimiento pospuesto exitosamente'
            });
            
        } catch (error) {
            logger.error('Error en posponerSeguimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al posponer seguimiento: ' + error.message
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
            
            const resultado = await this.ejecutarConversionAutomatica({
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
            
            const { data: prospectos, error } = await supabase
                .from('prospectos')
                .select(`
                    *,
                    seguimientos!inner(resultado, fecha_completado, completado)
                `)
                .eq('asesor_id', asesor_id)
                .eq('activo', true)
                .eq('convertido', false)
                .eq('seguimientos.completado', true)
                .in('seguimientos.resultado', RESULTADOS_QUE_CONVIERTEN)
                .order('seguimientos.fecha_completado', { ascending: false });
            
            if (error) {
                throw error;
            }
            
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
        const { data, error } = await supabase
            .from('ventas')
            .select('codigo')
            .like('codigo', `${prefijo}${año}${mes}%`)
            .order('codigo', { ascending: false })
            .limit(1);
        
        let siguienteNumero = 1;
        
        if (data && data.length > 0) {
            const ultimoCodigo = data[0].codigo;
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
            
            // Obtener seguimientos vencidos
            const { data, error } = await supabase
                .from('seguimientos')
                .select(`
                    *,
                    prospectos!inner(
                        id, codigo, nombre_cliente, estado, numero_reasignaciones,
                        asesor_id, asesor_nombre, modo_libre, activo
                    )
                `)
                .eq('completado', false)
                .eq('vencido', false)
                .lt('fecha_limite', ahora)
                .eq('prospectos.activo', true)
                .not('prospectos.estado', 'in', '(Cerrado,Perdido)')
                .eq('prospectos.modo_libre', false);
            
            if (error) {
                logger.error('Error al obtener seguimientos vencidos:', error);
                throw error;
            }
            
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
            const { data: vencidos, error } = await supabase
                .from('seguimientos')
                .select(`
                    *,
                    prospectos!inner(
                        id, codigo, nombre_cliente, estado, numero_reasignaciones,
                        asesor_id, asesor_nombre, modo_libre, activo
                    )
                `)
                .eq('completado', false)
                .eq('vencido', false)
                .lt('fecha_limite', ahora)
                .eq('prospectos.activo', true)
                .not('prospectos.estado', 'in', '(Cerrado,Perdido)')
                .eq('prospectos.modo_libre', false);
            
            if (error) {
                logger.error('Error al obtener seguimientos para procesamiento:', error);
                throw error;
            }
            
            const resultado = {
                procesados: 0,
                reasignados: 0,
                modo_libre_activado: 0,
                errores: 0
            };
            
            logger.info(`🔄 Procesando ${vencidos?.length || 0} seguimientos vencidos...`);
            
            for (const seguimiento of vencidos || []) {
                try {
                    // Marcar seguimiento como vencido
                    await supabase
                        .from('seguimientos')
                        .update({ vencido: true })
                        .eq('id', seguimiento.id);
                    
                    const prospecto = seguimiento.prospectos;
                    const nuevasReasignaciones = prospecto.numero_reasignaciones + 1;
                    
                    if (nuevasReasignaciones <= 2) {
                        // REASIGNACIÓN NORMAL (1er o 2do rebote)
                        await this.reasignarProspecto(prospecto.id, 'seguimiento_vencido');
                        resultado.reasignados++;
                    } else {
                        // ACTIVAR MODO LIBRE (3er strike)
                        await this.activarModoLibre(prospecto.id);
                        resultado.modo_libre_activado++;
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
            const { data: prospecto, error: errorProspecto } = await supabase
                .from('prospectos')
                .select('*')
                .eq('id', prospecto_id)
                .eq('activo', true)
                .single();
            
            if (errorProspecto || !prospecto) {
                throw new Error('Prospecto no encontrado');
            }
            
            // Obtener asesores disponibles (excluyendo el actual)
            const { data: asesores, error: errorAsesores } = await supabase
                .from('usuarios')
                .select(`
                    id, nombre, apellido,
                    prospectos_count:prospectos(count)
                `)
                .eq('area_id', 2) // Asumiendo que área VENTAS tiene ID 2
                .eq('activo', true)
                .neq('id', prospecto.asesor_id);
            
            if (errorAsesores || !asesores || asesores.length === 0) {
                throw new Error('No hay asesores disponibles para reasignación');
            }
            
            // Seleccionar asesor con menos carga (o aleatorio si empate)
            const asesorSeleccionado = asesores
                .sort((a, b) => a.prospectos_count - b.prospectos_count)[0];
            
            // Actualizar prospecto
            const { error: errorUpdate } = await supabase
                .from('prospectos')
                .update({
                    asesor_id: asesorSeleccionado.id,
                    asesor_nombre: `${asesorSeleccionado.nombre} ${asesorSeleccionado.apellido}`,
                    numero_reasignaciones: prospecto.numero_reasignaciones + 1,
                    seguimiento_vencido: true
                })
                .eq('id', prospecto_id);
            
            if (errorUpdate) {
                throw errorUpdate;
            }
            
            // Crear notificaciones
            await this.crearNotificacionesReasignacion(
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
            const { data: asesores } = await supabase
                .from('usuarios')
                .select('id')
                .eq('area_id', 2) // Área VENTAS
                .eq('activo', true);
            
            const asesor_ids = asesores?.map(a => a.id) || [];
            
            // Activar modo libre en prospecto
            const { error: errorProspecto } = await supabase
                .from('prospectos')
                .update({
                    modo_libre: true,
                    fecha_modo_libre: new Date().toISOString(),
                    numero_reasignaciones: supabase.sql`numero_reasignaciones + 1`
                })
                .eq('id', prospecto_id);
            
            if (errorProspecto) {
                throw errorProspecto;
            }
            
            // Crear registro en tabla modo_libre
            const { error: errorModoLibre } = await supabase
                .from('prospecto_modo_libre')
                .insert([{
                    prospecto_id: prospecto_id,
                    asesores_con_acceso: asesor_ids
                }]);
            
            if (errorModoLibre) {
                throw errorModoLibre;
            }
            
            // Notificar a todos los asesores
            await this.crearNotificacionModoLibre(prospecto_id, asesor_ids);
            
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
            const { data: prospecto } = await supabase
                .from('prospectos')
                .select('codigo, nombre_cliente, empresa')
                .eq('id', prospecto_id)
                .single();
            
            // Crear notificación de pérdida
            await supabase
                .from('notificaciones_reasignacion')
                .insert([{
                    prospecto_id: prospecto_id,
                    asesor_perdio_id: asesor_perdio_id,
                    tipo: 'perdida',
                    motivo: motivo,
                    titulo: `Prospecto reasignado: ${prospecto?.codigo}`,
                    mensaje: `El prospecto ${prospecto?.nombre_cliente} ha sido reasignado por ${motivo}`
                }]);
            
            // Crear notificación de ganancia
            await supabase
                .from('notificaciones_reasignacion')
                .insert([{
                    prospecto_id: prospecto_id,
                    asesor_gano_id: asesor_gano_id,
                    tipo: 'ganancia',
                    motivo: motivo,
                    titulo: `Nuevo prospecto asignado: ${prospecto?.codigo}`,
                    mensaje: `Te ha sido asignado el prospecto ${prospecto?.nombre_cliente} de ${prospecto?.empresa || 'empresa no especificada'}`
                }]);
            
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
            const { data: prospecto } = await supabase
                .from('prospectos')
                .select('codigo, nombre_cliente, empresa, valor_estimado')
                .eq('id', prospecto_id)
                .single();
            
            // Crear notificación para cada asesor
            const notificaciones = asesor_ids.map(asesor_id => ({
                prospecto_id: prospecto_id,
                asesor_gano_id: asesor_id,
                tipo: 'modo_libre',
                motivo: 'libre_competencia',
                titulo: `🏁 MODO LIBRE: ${prospecto?.codigo}`,
                mensaje: `¡COMPETENCIA ABIERTA! El prospecto ${prospecto?.nombre_cliente} (${prospecto?.codigo}) valor estimado $${prospecto?.valor_estimado || 0} está ahora disponible para todos. ¡El primero en cerrar la venta se lo queda!`
            }));
            
            await supabase
                .from('notificaciones_reasignacion')
                .insert(notificaciones);
            
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
     */
    static async dashboardSeguimientos(req, res) {
        try {
            const { asesorId } = req.params;
            const asesor_id = asesorId && !isNaN(asesorId) ? parseInt(asesorId) : (req.user?.id || 1);
            
            // Obtener seguimientos pendientes
            const { data: seguimientos } = await supabase
                .from('seguimientos')
                .select(`
                    *,
                    prospectos!inner(codigo, nombre_cliente, empresa, telefono, estado, valor_estimado)
                `)
                .eq('asesor_id', asesor_id)
                .eq('completado', false)
                .eq('prospectos.activo', true)
                .order('fecha_programada', { ascending: true });
            
            // Obtener prospectos en modo libre
            const { data: modoLibre } = await supabase
                .from('prospectos')
                .select('*')
                .eq('modo_libre', true)
                .eq('activo', true);
            
            // Obtener prospectos listos para conversión
            const { data: listosConversion } = await supabase
                .from('prospectos')
                .select(`
                    *,
                    seguimientos!inner(resultado, fecha_completado, completado)
                `)
                .eq('asesor_id', asesor_id)
                .eq('activo', true)
                .eq('convertido', false)
                .eq('seguimientos.completado', true)
                .in('seguimientos.resultado', RESULTADOS_QUE_CONVIERTEN);
            
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
            
            // Obtener métricas del asesor
            const { data: metricas } = await supabase
                .from('seguimientos')
                .select('completado, vencido, pospuesto')
                .eq('asesor_id', asesor_id)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 30 días
            
            const totalSeguimientos = metricas?.length || 0;
            const completados = metricas?.filter(m => m.completado).length || 0;
            const vencidos = metricas?.filter(m => m.vencido).length || 0;
            
            const resultado = {
                seguimientos: {
                    ...seguimientosCategorias,
                    conteos: {
                        total: seguimientos?.length || 0,
                        vencidos: seguimientosCategorias.vencidos.length,
                        hoy: seguimientosCategorias.hoy.length,
                        proximos: seguimientosCategorias.proximos.length
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
                    porcentaje_vencidos: totalSeguimientos > 0 ? ((vencidos / totalSeguimientos) * 100).toFixed(2) : 0
                },
                alertas: {
                    seguimientos_vencidos: seguimientosCategorias.vencidos.length > 0,
                    oportunidades_libres: (modoLibre?.length || 0) > 0,
                    conversiones_pendientes: (listosConversion?.length || 0) > 0,
                    performance_baja: totalSeguimientos > 0 && ((completados / totalSeguimientos) * 100) < 80
                }
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
            const { count: seguimientosVencidos } = await supabase
                .from('seguimientos')
                .select('*', { count: 'exact', head: true })
                .eq('completado', false)
                .lt('fecha_limite', new Date().toISOString());
            
            res.json({
                success: true,
                module: 'Seguimientos',
                status: 'Operativo',
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                data: {
                    seguimientos_vencidos: seguimientosVencidos || 0,
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
}

module.exports = SeguimientosController;