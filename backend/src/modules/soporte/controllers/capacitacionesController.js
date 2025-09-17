// =====================================
// CONTROLADOR ESPECÍFICO DE CAPACITACIONES
// =====================================
// Maneja la cola de capacitaciones, programación, y métricas de tiempo
// desde que el cliente recibe el producto hasta que es capacitado

const SoporteModel = require('../models/SoporteModel');
const SoporteService = require('../services/soporteService');
const { validarDatosSoporte, calcularTiempoTranscurrido } = require('../utils/soporteHelpers');

class CapacitacionesController {
    // ====================================
    // GESTIÓN DE COLA DE CAPACITACIONES
    // ====================================

    /**
     * Obtener dashboard de capacitaciones
     * GET /api/soporte/capacitaciones/dashboard
     */
    static async obtenerDashboardCapacitaciones(req, res) {
        try {
            const supabase = require('../../../config/supabase');
            
            // Obtener capacitaciones con información completa
            const { data: capacitaciones, error } = await supabase
                .from('vista_capacitaciones_completas')
                .select('*')
                .order('fecha_capacitacion_programada', { ascending: true });

            if (error) throw error;

            // Agrupar por estado
            const capacitacionesPorEstado = {
                PENDIENTE: [],
                PROGRAMADA: [],
                EN_PROCESO: [],
                COMPLETADA: [],
                CANCELADA: [],
                REPROGRAMADA: []
            };

            capacitaciones.forEach(cap => {
                if (capacitacionesPorEstado[cap.estado]) {
                    capacitacionesPorEstado[cap.estado].push(cap);
                }
            });

            // Calcular estadísticas
            const estadisticas = {
                total_capacitaciones: capacitaciones.length,
                pendientes_hoy: 0,
                programadas_esta_semana: 0,
                completadas_este_mes: 0,
                promedio_calificacion: 0,
                tiempo_respuesta_promedio: 0,
                capacitaciones_exitosas: 0
            };

            const hoy = new Date().toISOString().split('T')[0];
            const inicioSemana = new Date();
            inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
            const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

            let totalCalificaciones = 0;
            let capacitacionesConCalificacion = 0;
            let tiempoRespuestaTotal = 0;
            let capacitacionesConTiempo = 0;

            capacitaciones.forEach(cap => {
                // Pendientes hoy
                if (cap.estado === 'PENDIENTE' || (cap.fecha_capacitacion_programada === hoy)) {
                    estadisticas.pendientes_hoy++;
                }

                // Programadas esta semana
                if (cap.fecha_capacitacion_programada >= inicioSemana.toISOString().split('T')[0]) {
                    estadisticas.programadas_esta_semana++;
                }

                // Completadas este mes
                if (cap.estado === 'COMPLETADA' && cap.fecha_capacitacion_realizada >= inicioMes.toISOString().split('T')[0]) {
                    estadisticas.completadas_este_mes++;
                }

                // Calificaciones
                if (cap.calificacion_cliente && cap.calificacion_cliente > 0) {
                    totalCalificaciones += cap.calificacion_cliente;
                    capacitacionesConCalificacion++;
                }

                // Capacitaciones exitosas
                if (cap.capacitacion_exitosa === true) {
                    estadisticas.capacitaciones_exitosas++;
                }

                // Tiempo de respuesta
                if (cap.tiempo_respuesta_capacitacion_horas) {
                    tiempoRespuestaTotal += cap.tiempo_respuesta_capacitacion_horas;
                    capacitacionesConTiempo++;
                }
            });

            // Calcular promedios
            if (capacitacionesConCalificacion > 0) {
                estadisticas.promedio_calificacion = (totalCalificaciones / capacitacionesConCalificacion).toFixed(1);
            }

            if (capacitacionesConTiempo > 0) {
                estadisticas.tiempo_respuesta_promedio = Math.round(tiempoRespuestaTotal / capacitacionesConTiempo);
            }

            res.json({
                success: true,
                data: {
                    capacitaciones: capacitacionesPorEstado,
                    estadisticas
                }
            });

        } catch (error) {
            console.error('Error en obtenerDashboardCapacitaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Programar capacitación desde confirmación de entrega
     * POST /api/soporte/capacitaciones/programar-desde-entrega
     */
    static async programarDesdeEntrega(req, res) {
        try {
            const { 
                venta_id, 
                cliente_nombre, 
                cliente_telefono, 
                cliente_email,
                producto_codigo, 
                producto_descripcion, 
                fecha_confirmacion_entrega,
                fecha_capacitacion_solicitada,
                tipo_capacitacion,
                modalidad,
                observaciones 
            } = req.body;
            const { user } = req;

            // Validación básica
            if (!cliente_nombre || !cliente_telefono || !producto_codigo) {
                return res.status(400).json({
                    success: false,
                    message: 'Cliente, teléfono y producto son requeridos'
                });
            }

            // Crear datos de capacitación
            const datosCapacitacion = {
                venta_id: venta_id || null,
                cliente_nombre: cliente_nombre,
                cliente_telefono: cliente_telefono,
                cliente_email: cliente_email || null,
                producto_codigo: producto_codigo,
                producto_descripcion: producto_descripcion,
                fecha_confirmacion_entrega: fecha_confirmacion_entrega || new Date().toISOString().split('T')[0],
                fecha_capacitacion_solicitada: fecha_capacitacion_solicitada || new Date().toISOString().split('T')[0],
                tipo_capacitacion: tipo_capacitacion || 'USO_BASICO',
                modalidad: modalidad || 'PRESENCIAL',
                estado: 'PENDIENTE',
                observaciones_tecnico: observaciones || null,
                created_by: user.id,
                updated_by: user.id
            };

            const resultado = await SoporteModel.crearCapacitacion(datosCapacitacion);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Error programando capacitación',
                    error: resultado.error
                });
            }

            // Registrar en auditoría
            await SoporteService.registrarAuditoria('CAPACITACION', resultado.data.id, 'PROGRAMADA_DESDE_ENTREGA', {
                cliente: cliente_nombre,
                producto: producto_codigo,
                modalidad: modalidad
            });

            res.status(201).json({
                success: true,
                message: 'Capacitación programada exitosamente',
                data: resultado.data
            });

        } catch (error) {
            console.error('Error en programarDesdeEntrega:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Asignar técnico a capacitación
     * PUT /api/soporte/capacitaciones/:id/asignar-tecnico
     */
    static async asignarTecnico(req, res) {
        try {
            const { id } = req.params;
            const { tecnico_id, fecha_programada, observaciones } = req.body;
            const { user } = req;

            if (!id || !tecnico_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de capacitación y técnico son requeridos'
                });
            }

            const supabase = require('../../../config/supabase');

            // Verificar que el técnico existe y está disponible
            const { data: tecnico, error: errorTecnico } = await supabase
                .from('usuarios')
                .select('id, nombre, apellido')
                .eq('id', tecnico_id)
                .eq('activo', true)
                .single();

            if (errorTecnico || !tecnico) {
                return res.status(404).json({
                    success: false,
                    message: 'Técnico no encontrado o no disponible'
                });
            }

            // Actualizar capacitación
            const datosActualizacion = {
                tecnico_asignado_id: tecnico_id,
                fecha_capacitacion_programada: fecha_programada || new Date().toISOString().split('T')[0],
                estado: 'PROGRAMADA',
                observaciones_tecnico: observaciones || null,
                updated_by: user.id,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('soporte_capacitaciones')
                .update(datosActualizacion)
                .eq('id', id)
                .select(`
                    *,
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido)
                `)
                .single();

            if (error) throw error;

            // Notificar al técnico asignado
            console.log(`📧 Capacitación asignada a ${tecnico.nombre} ${tecnico.apellido || ''}`);

            res.json({
                success: true,
                message: 'Técnico asignado exitosamente',
                data: data
            });

        } catch (error) {
            console.error('Error en asignarTecnico:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Completar capacitación con métricas de tiempo
     * PUT /api/soporte/capacitaciones/:id/completar
     */
    static async completarCapacitacion(req, res) {
        try {
            const { id } = req.params;
            const { 
                duracion_real_horas,
                capacitacion_exitosa,
                objetivos_cumplidos,
                temas_pendientes,
                calificacion_cliente,
                comentarios_cliente,
                recomendaria_servicio,
                observaciones_tecnico,
                materiales_entregados,
                requiere_seguimiento,
                fecha_seguimiento_programado
            } = req.body;
            const { user } = req;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de capacitación requerido'
                });
            }

            const supabase = require('../../../config/supabase');

            // Obtener capacitación actual para calcular métricas
            const { data: capacitacionActual, error: errorCapacitacion } = await supabase
                .from('soporte_capacitaciones')
                .select('*')
                .eq('id', id)
                .single();

            if (errorCapacitacion || !capacitacionActual) {
                return res.status(404).json({
                    success: false,
                    message: 'Capacitación no encontrada'
                });
            }

            // Calcular métricas de tiempo automáticamente
            const fechaRealizacion = new Date().toISOString().split('T')[0];
            let tiempoRespuestaHoras = null;
            let tiempoRespuestaDias = null;

            if (capacitacionActual.fecha_confirmacion_entrega) {
                const fechaEntrega = new Date(capacitacionActual.fecha_confirmacion_entrega);
                const fechaCapacitacion = new Date(fechaRealizacion);
                const diferenciaMilisegundos = fechaCapacitacion - fechaEntrega;
                
                tiempoRespuestaHoras = Math.round(diferenciaMilisegundos / (1000 * 60 * 60));
                tiempoRespuestaDias = Math.round(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
            }

            // Preparar datos de actualización
            const datosActualizacion = {
                estado: 'COMPLETADA',
                fecha_capacitacion_realizada: fechaRealizacion,
                duracion_real_horas: duracion_real_horas || null,
                capacitacion_exitosa: capacitacion_exitosa !== false, // Por defecto true
                objetivos_cumplidos: objetivos_cumplidos || [],
                temas_pendientes: temas_pendientes || [],
                calificacion_cliente: calificacion_cliente || null,
                comentarios_cliente: comentarios_cliente || null,
                recomendaria_servicio: recomendaria_servicio || null,
                observaciones_tecnico: observaciones_tecnico || null,
                materiales_entregados: materiales_entregados || [],
                requiere_seguimiento: requiere_seguimiento || false,
                fecha_seguimiento_programado: requiere_seguimiento ? fecha_seguimiento_programado : null,
                tiempo_respuesta_capacitacion_horas: tiempoRespuestaHoras,
                tiempo_respuesta_capacitacion_dias: tiempoRespuestaDias,
                updated_by: user.id,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('soporte_capacitaciones')
                .update(datosActualizacion)
                .eq('id', id)
                .select(`
                    *,
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido)
                `)
                .single();

            if (error) throw error;

            // Si está vinculado a un ticket, completar el ticket también
            if (data.ticket_id) {
                await supabase
                    .from('tickets_soporte')
                    .update({ 
                        estado: 'COMPLETADO',
                        fecha_finalizacion: new Date().toISOString(),
                        updated_by: user.id
                    })
                    .eq('id', data.ticket_id);
            }

            // Registrar en auditoría
            await SoporteService.registrarAuditoria('CAPACITACION', id, 'COMPLETADA', {
                exitosa: capacitacion_exitosa,
                calificacion: calificacion_cliente,
                tiempo_respuesta_dias: tiempoRespuestaDias
            });

            // Notificar si la calificación es baja
            if (calificacion_cliente && calificacion_cliente < 4) {
                console.log(`⚠️ Calificación baja en capacitación: ${calificacion_cliente}/5`);
                // Aquí podrías enviar notificación a supervisores
            }

            res.json({
                success: true,
                message: 'Capacitación completada exitosamente',
                data: {
                    ...data,
                    metricas: {
                        tiempo_respuesta_dias: tiempoRespuestaDias,
                        tiempo_respuesta_horas: tiempoRespuestaHoras,
                        calificacion: calificacion_cliente
                    }
                }
            });

        } catch (error) {
            console.error('Error en completarCapacitacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Reprogramar capacitación
     * PUT /api/soporte/capacitaciones/:id/reprogramar
     */
    static async reprogramarCapacitacion(req, res) {
        try {
            const { id } = req.params;
            const { nueva_fecha, motivo_reprogramacion, nueva_modalidad } = req.body;
            const { user } = req;

            if (!id || !nueva_fecha || !motivo_reprogramacion) {
                return res.status(400).json({
                    success: false,
                    message: 'ID, nueva fecha y motivo son requeridos'
                });
            }

            const supabase = require('../../../config/supabase');

            const datosActualizacion = {
                estado: 'REPROGRAMADA',
                fecha_capacitacion_programada: nueva_fecha,
                modalidad: nueva_modalidad || undefined, // Solo actualizar si se proporciona
                observaciones_tecnico: motivo_reprogramacion,
                updated_by: user.id,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('soporte_capacitaciones')
                .update(datosActualizacion)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            // Registrar en auditoría
            await SoporteService.registrarAuditoria('CAPACITACION', id, 'REPROGRAMADA', {
                nueva_fecha: nueva_fecha,
                motivo: motivo_reprogramacion
            });

            // Notificar al cliente sobre la reprogramación
            console.log(`📧 Capacitación reprogramada para ${data.cliente_nombre} - Nueva fecha: ${nueva_fecha}`);

            res.json({
                success: true,
                message: 'Capacitación reprogramada exitosamente',
                data: data
            });

        } catch (error) {
            console.error('Error en reprogramarCapacitacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ====================================
    // REPORTES Y MÉTRICAS
    // ====================================

    /**
     * Reporte de métricas de capacitación
     * GET /api/soporte/capacitaciones/metricas
     */
    static async obtenerMetricasCapacitacion(req, res) {
        try {
            const { fecha_desde, fecha_hasta, tecnico_id } = req.query;
            const supabase = require('../../../config/supabase');

            let query = supabase
                .from('soporte_capacitaciones')
                .select('*')
                .eq('activo', true);

            // Aplicar filtros
            if (fecha_desde) {
                query = query.gte('fecha_capacitacion_realizada', fecha_desde);
            }
            if (fecha_hasta) {
                query = query.lte('fecha_capacitacion_realizada', fecha_hasta);
            }
            if (tecnico_id) {
                query = query.eq('tecnico_asignado_id', tecnico_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Calcular métricas
            const metricas = {
                total_capacitaciones: data.length,
                completadas: data.filter(c => c.estado === 'COMPLETADA').length,
                pendientes: data.filter(c => c.estado === 'PENDIENTE').length,
                canceladas: data.filter(c => c.estado === 'CANCELADA').length,
                reprogramadas: data.filter(c => c.estado === 'REPROGRAMADA').length,
                
                // Métricas de calidad
                calificacion_promedio: 0,
                capacitaciones_exitosas: data.filter(c => c.capacitacion_exitosa === true).length,
                clientes_recomendarian: data.filter(c => c.recomendaria_servicio === true).length,
                
                // Métricas de tiempo
                tiempo_respuesta_promedio_dias: 0,
                tiempo_respuesta_promedio_horas: 0,
                capacitaciones_rapidas: 0, // Menos de 2 días
                capacitaciones_lentas: 0,  // Más de 7 días
                
                // Por modalidad
                por_modalidad: {
                    PRESENCIAL: data.filter(c => c.modalidad === 'PRESENCIAL').length,
                    VIRTUAL: data.filter(c => c.modalidad === 'VIRTUAL').length,
                    TELEFONICA: data.filter(c => c.modalidad === 'TELEFONICA').length
                },
                
                // Por tipo
                por_tipo: {
                    INSTALACION: data.filter(c => c.tipo_capacitacion === 'INSTALACION').length,
                    USO_BASICO: data.filter(c => c.tipo_capacitacion === 'USO_BASICO').length,
                    MANTENIMIENTO: data.filter(c => c.tipo_capacitacion === 'MANTENIMIENTO').length,
                    AVANZADA: data.filter(c => c.tipo_capacitacion === 'AVANZADA').length
                }
            };

            // Calcular promedios
            const capacitacionesConCalificacion = data.filter(c => c.calificacion_cliente > 0);
            if (capacitacionesConCalificacion.length > 0) {
                metricas.calificacion_promedio = (
                    capacitacionesConCalificacion.reduce((sum, c) => sum + c.calificacion_cliente, 0) / 
                    capacitacionesConCalificacion.length
                ).toFixed(1);
            }

            const capacitacionesConTiempo = data.filter(c => c.tiempo_respuesta_capacitacion_dias > 0);
            if (capacitacionesConTiempo.length > 0) {
                metricas.tiempo_respuesta_promedio_dias = Math.round(
                    capacitacionesConTiempo.reduce((sum, c) => sum + c.tiempo_respuesta_capacitacion_dias, 0) / 
                    capacitacionesConTiempo.length
                );
                
                metricas.tiempo_respuesta_promedio_horas = Math.round(
                    capacitacionesConTiempo.reduce((sum, c) => sum + c.tiempo_respuesta_capacitacion_horas, 0) / 
                    capacitacionesConTiempo.length
                );

                // Contar rápidas y lentas
                metricas.capacitaciones_rapidas = capacitacionesConTiempo.filter(c => c.tiempo_respuesta_capacitacion_dias <= 2).length;
                metricas.capacitaciones_lentas = capacitacionesConTiempo.filter(c => c.tiempo_respuesta_capacitacion_dias > 7).length;
            }

            res.json({
                success: true,
                data: metricas
            });

        } catch (error) {
            console.error('Error en obtenerMetricasCapacitacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener capacitaciones vencidas o próximas a vencer
     * GET /api/soporte/capacitaciones/vencidas
     */
    static async obtenerCapacitacionesVencidas(req, res) {
        try {
            const supabase = require('../../../config/supabase');
            const hoy = new Date().toISOString().split('T')[0];
            const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Capacitaciones vencidas (fecha pasada y aún pendientes/programadas)
            const { data: vencidas, error: errorVencidas } = await supabase
                .from('soporte_capacitaciones')
                .select(`
                    *,
                    tecnico_asignado:usuarios!tecnico_asignado_id(nombre, apellido)
                `)
                .lt('fecha_capacitacion_programada', hoy)
                .in('estado', ['PENDIENTE', 'PROGRAMADA'])
                .eq('activo', true);

            if (errorVencidas) throw errorVencidas;

            // Capacitaciones para mañana
            const { data: proximasVencer, error: errorProximas } = await supabase
                .from('soporte_capacitaciones')
                .select(`
                    *,
                    tecnico_asignado:usuarios!tecnico_asignado_id(nombre, apellido)
                `)
                .eq('fecha_capacitacion_programada', manana)
                .in('estado', ['PENDIENTE', 'PROGRAMADA'])
                .eq('activo', true);

            if (errorProximas) throw errorProximas;

            // Capacitaciones sin técnico asignado
            const { data: sinTecnico, error: errorSinTecnico } = await supabase
                .from('soporte_capacitaciones')
                .select('*')
                .is('tecnico_asignado_id', null)
                .in('estado', ['PENDIENTE'])
                .eq('activo', true);

            if (errorSinTecnico) throw errorSinTecnico;

            res.json({
                success: true,
                data: {
                    vencidas: vencidas || [],
                    proximas_vencer: proximasVencer || [],
                    sin_tecnico_asignado: sinTecnico || [],
                    alertas: {
                        total_vencidas: (vencidas || []).length,
                        total_proximas: (proximasVencer || []).length,
                        total_sin_tecnico: (sinTecnico || []).length
                    }
                }
            });

        } catch (error) {
            console.error('Error en obtenerCapacitacionesVencidas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener calendario de capacitaciones
     * GET /api/soporte/capacitaciones/calendario
     */
    static async obtenerCalendarioCapacitaciones(req, res) {
        try {
            const { mes, anio, tecnico_id } = req.query;
            const supabase = require('../../../config/supabase');

            // Calcular rango de fechas para el mes
            const fechaInicio = `${anio || new Date().getFullYear()}-${(mes || new Date().getMonth() + 1).toString().padStart(2, '0')}-01`;
            const fechaFin = new Date(anio || new Date().getFullYear(), mes || new Date().getMonth() + 1, 0).toISOString().split('T')[0];

            let query = supabase
                .from('soporte_capacitaciones')
                .select(`
                    id,
                    cliente_nombre,
                    cliente_telefono,
                    producto_descripcion,
                    fecha_capacitacion_programada,
                    tipo_capacitacion,
                    modalidad,
                    estado,
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido)
                `)
                .gte('fecha_capacitacion_programada', fechaInicio)
                .lte('fecha_capacitacion_programada', fechaFin)
                .eq('activo', true);

            if (tecnico_id) {
                query = query.eq('tecnico_asignado_id', tecnico_id);
            }

            const { data, error } = await query.order('fecha_capacitacion_programada');
            if (error) throw error;

            // Agrupar por fecha
            const calendario = {};
            data.forEach(cap => {
                const fecha = cap.fecha_capacitacion_programada;
                if (!calendario[fecha]) {
                    calendario[fecha] = [];
                }
                calendario[fecha].push(cap);
            });

            res.json({
                success: true,
                data: {
                    calendario,
                    total_capacitaciones: data.length,
                    rango: {
                        inicio: fechaInicio,
                        fin: fechaFin
                    }
                }
            });

        } catch (error) {
            console.error('Error en obtenerCalendarioCapacitaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = CapacitacionesController;