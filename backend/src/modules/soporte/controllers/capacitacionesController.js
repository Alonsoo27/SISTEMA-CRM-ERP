// =====================================
// CONTROLADOR ESPECÍFICO DE CAPACITACIONES - VERSIÓN CORREGIDA POSTGRESQL
// =====================================
// Maneja la cola de capacitaciones, programación, y métricas de tiempo
// desde que el cliente recibe el producto hasta que es capacitado
// CORREGIDO: Usa PostgreSQL directo con función query() en lugar de Supabase SDK

const { query } = require('../../../config/database');
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
            // CORREGIDO: Usar PostgreSQL directo en lugar de Supabase
            let capacitaciones = [];
            
            try {
                // Intentar usar la vista primero
                const sql = `
                    SELECT * FROM vista_capacitaciones_completas 
                    ORDER BY fecha_capacitacion_programada ASC
                `;
                const result = await query(sql, []);
                capacitaciones = result.rows;
            } catch (vistaError) {
                // Si la vista no existe, usar consulta directa
                console.log('Vista vista_capacitaciones_completas no disponible, usando consulta directa');
                
                const sqlDirecta = `
                    SELECT sc.*,
                           tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido,
                           p.codigo as producto_codigo, p.descripcion as producto_descripcion
                    FROM soporte_capacitaciones sc
                    LEFT JOIN usuarios tecnico ON sc.tecnico_asignado_id = tecnico.id
                    LEFT JOIN productos p ON sc.producto_id = p.id
                    WHERE sc.activo = true
                    ORDER BY sc.fecha_capacitacion_programada ASC
                `;
                const resultDirecta = await query(sqlDirecta, []);
                capacitaciones = resultDirecta.rows;
            }

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

            // Registrar en auditoría (si el servicio está disponible)
            try {
                await SoporteService.registrarAuditoria('CAPACITACION', resultado.data.id, 'PROGRAMADA_DESDE_ENTREGA', {
                    cliente: cliente_nombre,
                    producto: producto_codigo,
                    modalidad: modalidad
                });
            } catch (auditError) {
                console.log('Servicio de auditoría no disponible:', auditError.message);
            }

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

            // CORREGIDO: Verificar que el técnico existe usando PostgreSQL directo
            const sqlTecnico = `
                SELECT id, nombre, apellido 
                FROM usuarios 
                WHERE id = $1 AND activo = true
            `;
            const resultTecnico = await query(sqlTecnico, [tecnico_id]);

            if (resultTecnico.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Técnico no encontrado o no disponible'
                });
            }

            const tecnico = resultTecnico.rows[0];

            // CORREGIDO: Actualizar capacitación usando PostgreSQL directo
            const datosActualizacion = {
                tecnico_asignado_id: tecnico_id,
                fecha_capacitacion_programada: fecha_programada || new Date().toISOString().split('T')[0],
                estado: 'PROGRAMADA',
                observaciones_tecnico: observaciones || null,
                updated_by: user.id,
                updated_at: new Date()
            };

            // Construir query UPDATE dinámicamente
            const campos = [];
            const valores = [];
            let contador = 1;

            Object.keys(datosActualizacion).forEach(campo => {
                if (datosActualizacion[campo] !== undefined && datosActualizacion[campo] !== null) {
                    campos.push(`${campo} = $${contador}`);
                    valores.push(datosActualizacion[campo]);
                    contador++;
                }
            });

            const sqlUpdate = `
                UPDATE soporte_capacitaciones 
                SET ${campos.join(', ')}
                WHERE id = $${contador}
                RETURNING *
            `;
            valores.push(id);

            const resultUpdate = await query(sqlUpdate, valores);

            if (resultUpdate.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Capacitación no encontrada'
                });
            }

            const capacitacionActualizada = resultUpdate.rows[0];
            
            // Estructurar respuesta como esperaba Supabase
            capacitacionActualizada.tecnico_asignado = {
                id: tecnico.id,
                nombre: tecnico.nombre,
                apellido: tecnico.apellido
            };

            // Notificar al técnico asignado
            console.log(`📧 Capacitación asignada a ${tecnico.nombre} ${tecnico.apellido || ''}`);

            res.json({
                success: true,
                message: 'Técnico asignado exitosamente',
                data: capacitacionActualizada
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

            // CORREGIDO: Obtener capacitación actual usando PostgreSQL directo
            const sqlCapacitacion = `SELECT * FROM soporte_capacitaciones WHERE id = $1`;
            const resultCapacitacion = await query(sqlCapacitacion, [id]);

            if (resultCapacitacion.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Capacitación no encontrada'
                });
            }

            const capacitacionActual = resultCapacitacion.rows[0];

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
                objetivos_cumplidos: JSON.stringify(objetivos_cumplidos || []),
                temas_pendientes: JSON.stringify(temas_pendientes || []),
                calificacion_cliente: calificacion_cliente || null,
                comentarios_cliente: comentarios_cliente || null,
                recomendaria_servicio: recomendaria_servicio || null,
                observaciones_tecnico: observaciones_tecnico || null,
                materiales_entregados: JSON.stringify(materiales_entregados || []),
                requiere_seguimiento: requiere_seguimiento || false,
                fecha_seguimiento_programado: requiere_seguimiento ? fecha_seguimiento_programado : null,
                tiempo_respuesta_capacitacion_horas: tiempoRespuestaHoras,
                tiempo_respuesta_capacitacion_dias: tiempoRespuestaDias,
                updated_by: user.id,
                updated_at: new Date()
            };

            // CORREGIDO: Actualizar usando PostgreSQL directo
            const campos = [];
            const valores = [];
            let contador = 1;

            Object.keys(datosActualizacion).forEach(campo => {
                if (datosActualizacion[campo] !== undefined) {
                    campos.push(`${campo} = $${contador}`);
                    valores.push(datosActualizacion[campo]);
                    contador++;
                }
            });

            const sqlUpdate = `
                UPDATE soporte_capacitaciones 
                SET ${campos.join(', ')}
                WHERE id = $${contador}
                RETURNING *
            `;
            valores.push(id);

            const resultUpdate = await query(sqlUpdate, valores);
            const capacitacionCompletada = resultUpdate.rows[0];

            // Si está vinculado a un ticket, completar el ticket también
            if (capacitacionCompletada.ticket_id) {
                const sqlTicket = `
                    UPDATE tickets_soporte 
                    SET estado = 'COMPLETADO', fecha_finalizacion = $1, updated_by = $2
                    WHERE id = $3
                `;
                await query(sqlTicket, [new Date(), user.id, capacitacionCompletada.ticket_id]);
            }

            // Registrar en auditoría (si el servicio está disponible)
            try {
                await SoporteService.registrarAuditoria('CAPACITACION', id, 'COMPLETADA', {
                    exitosa: capacitacion_exitosa,
                    calificacion: calificacion_cliente,
                    tiempo_respuesta_dias: tiempoRespuestaDias
                });
            } catch (auditError) {
                console.log('Servicio de auditoría no disponible:', auditError.message);
            }

            // Notificar si la calificación es baja
            if (calificacion_cliente && calificacion_cliente < 4) {
                console.log(`⚠️ Calificación baja en capacitación: ${calificacion_cliente}/5`);
                // Aquí podrías enviar notificación a supervisores
            }

            res.json({
                success: true,
                message: 'Capacitación completada exitosamente',
                data: {
                    ...capacitacionCompletada,
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

            // CORREGIDO: Usar PostgreSQL directo
            const datosActualizacion = {
                estado: 'REPROGRAMADA',
                fecha_capacitacion_programada: nueva_fecha,
                observaciones_tecnico: motivo_reprogramacion,
                updated_by: user.id,
                updated_at: new Date()
            };

            // Agregar nueva modalidad solo si se proporciona
            if (nueva_modalidad) {
                datosActualizacion.modalidad = nueva_modalidad;
            }

            const campos = [];
            const valores = [];
            let contador = 1;

            Object.keys(datosActualizacion).forEach(campo => {
                campos.push(`${campo} = $${contador}`);
                valores.push(datosActualizacion[campo]);
                contador++;
            });

            const sqlUpdate = `
                UPDATE soporte_capacitaciones 
                SET ${campos.join(', ')}
                WHERE id = $${contador}
                RETURNING *
            `;
            valores.push(id);

            const result = await query(sqlUpdate, valores);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Capacitación no encontrada'
                });
            }

            const capacitacionReprogramada = result.rows[0];

            // Registrar en auditoría (si el servicio está disponible)
            try {
                await SoporteService.registrarAuditoria('CAPACITACION', id, 'REPROGRAMADA', {
                    nueva_fecha: nueva_fecha,
                    motivo: motivo_reprogramacion
                });
            } catch (auditError) {
                console.log('Servicio de auditoría no disponible:', auditError.message);
            }

            // Notificar al cliente sobre la reprogramación
            console.log(`📧 Capacitación reprogramada para ${capacitacionReprogramada.cliente_nombre} - Nueva fecha: ${nueva_fecha}`);

            res.json({
                success: true,
                message: 'Capacitación reprogramada exitosamente',
                data: capacitacionReprogramada
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

            // CORREGIDO: Construir query PostgreSQL directo con filtros
            const condiciones = ['activo = true'];
            const valores = [];
            let contador = 1;

            if (fecha_desde) {
                condiciones.push(`fecha_capacitacion_realizada >= $${contador}`);
                valores.push(fecha_desde);
                contador++;
            }
            if (fecha_hasta) {
                condiciones.push(`fecha_capacitacion_realizada <= $${contador}`);
                valores.push(fecha_hasta);
                contador++;
            }
            if (tecnico_id) {
                condiciones.push(`tecnico_asignado_id = $${contador}`);
                valores.push(tecnico_id);
                contador++;
            }

            const sql = `
                SELECT * FROM soporte_capacitaciones 
                WHERE ${condiciones.join(' AND ')}
            `;

            const result = await query(sql, valores);
            const data = result.rows;

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
            const hoy = new Date().toISOString().split('T')[0];
            const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // CORREGIDO: Capacitaciones vencidas usando PostgreSQL directo
            const sqlVencidas = `
                SELECT sc.*,
                       tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido
                FROM soporte_capacitaciones sc
                LEFT JOIN usuarios tecnico ON sc.tecnico_asignado_id = tecnico.id
                WHERE sc.fecha_capacitacion_programada < $1 
                  AND sc.estado IN ('PENDIENTE', 'PROGRAMADA')
                  AND sc.activo = true
            `;
            const resultVencidas = await query(sqlVencidas, [hoy]);

            // CORREGIDO: Capacitaciones para mañana usando PostgreSQL directo
            const sqlProximas = `
                SELECT sc.*,
                       tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido
                FROM soporte_capacitaciones sc
                LEFT JOIN usuarios tecnico ON sc.tecnico_asignado_id = tecnico.id
                WHERE sc.fecha_capacitacion_programada = $1
                  AND sc.estado IN ('PENDIENTE', 'PROGRAMADA')
                  AND sc.activo = true
            `;
            const resultProximas = await query(sqlProximas, [manana]);

            // CORREGIDO: Capacitaciones sin técnico asignado usando PostgreSQL directo
            const sqlSinTecnico = `
                SELECT * FROM soporte_capacitaciones
                WHERE tecnico_asignado_id IS NULL
                  AND estado = 'PENDIENTE'
                  AND activo = true
            `;
            const resultSinTecnico = await query(sqlSinTecnico, []);

            // Estructurar respuesta como esperaba Supabase
            const vencidas = resultVencidas.rows.map(row => ({
                ...row,
                tecnico_asignado: row.tecnico_nombre ? {
                    nombre: row.tecnico_nombre,
                    apellido: row.tecnico_apellido
                } : null
            }));

            const proximasVencer = resultProximas.rows.map(row => ({
                ...row,
                tecnico_asignado: row.tecnico_nombre ? {
                    nombre: row.tecnico_nombre,
                    apellido: row.tecnico_apellido
                } : null
            }));

            const sinTecnico = resultSinTecnico.rows;

            res.json({
                success: true,
                data: {
                    vencidas: vencidas,
                    proximas_vencer: proximasVencer,
                    sin_tecnico_asignado: sinTecnico,
                    alertas: {
                        total_vencidas: vencidas.length,
                        total_proximas: proximasVencer.length,
                        total_sin_tecnico: sinTecnico.length
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

            // Calcular rango de fechas para el mes
            const fechaInicio = `${anio || new Date().getFullYear()}-${(mes || new Date().getMonth() + 1).toString().padStart(2, '0')}-01`;
            const fechaFin = new Date(anio || new Date().getFullYear(), mes || new Date().getMonth() + 1, 0).toISOString().split('T')[0];

            // CORREGIDO: Construir query PostgreSQL directo
            const condiciones = [
                'sc.fecha_capacitacion_programada >= $1',
                'sc.fecha_capacitacion_programada <= $2',
                'sc.activo = true'
            ];
            const valores = [fechaInicio, fechaFin];
            let contador = 3;

            if (tecnico_id) {
                condiciones.push(`sc.tecnico_asignado_id = $${contador}`);
                valores.push(tecnico_id);
                contador++;
            }

            const sql = `
                SELECT sc.id,
                       sc.cliente_nombre,
                       sc.cliente_telefono,
                       sc.producto_descripcion,
                       sc.fecha_capacitacion_programada,
                       sc.tipo_capacitacion,
                       sc.modalidad,
                       sc.estado,
                       tecnico.id as tecnico_id, tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido
                FROM soporte_capacitaciones sc
                LEFT JOIN usuarios tecnico ON sc.tecnico_asignado_id = tecnico.id
                WHERE ${condiciones.join(' AND ')}
                ORDER BY sc.fecha_capacitacion_programada
            `;

            const result = await query(sql, valores);

            // Estructurar respuesta como esperaba Supabase
            const capacitaciones = result.rows.map(row => ({
                id: row.id,
                cliente_nombre: row.cliente_nombre,
                cliente_telefono: row.cliente_telefono,
                producto_descripcion: row.producto_descripcion,
                fecha_capacitacion_programada: row.fecha_capacitacion_programada,
                tipo_capacitacion: row.tipo_capacitacion,
                modalidad: row.modalidad,
                estado: row.estado,
                tecnico_asignado: row.tecnico_id ? {
                    id: row.tecnico_id,
                    nombre: row.tecnico_nombre,
                    apellido: row.tecnico_apellido
                } : null
            }));

            // Agrupar por fecha
            const calendario = {};
            capacitaciones.forEach(cap => {
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
                    total_capacitaciones: capacitaciones.length,
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