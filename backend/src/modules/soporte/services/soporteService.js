// =====================================
// SERVICIO DE SOPORTE TÉCNICO
// =====================================
// Contiene la lógica de negocio para el módulo de soporte
// Maneja notificaciones, flujos automáticos y reglas de negocio

const supabase = require('../../../config/supabase');

class SoporteService {
    // ====================================
    // PROCESAMIENTO DE TICKETS NUEVOS
    // ====================================

    /**
     * Procesar ticket recién creado
     */
    static async procesarTicketNuevo(ticket) {
        try {
            console.log(`Procesando ticket nuevo: ${ticket.codigo}`);

            // 1. Asignar automáticamente según tipo y prioridad
            await this.asignarTecnicoAutomatico(ticket);

            // 2. Enviar notificaciones relevantes
            await this.notificarTicketNuevo(ticket);

            // 3. Crear registros de auditoría
            await this.registrarAuditoria('TICKET', ticket.id, 'CREADO', {
                tipo: ticket.tipo_ticket,
                prioridad: ticket.prioridad,
                cliente: ticket.cliente_nombre
            });

            // 4. Si es capacitación, crear registro en tabla específica
            if (ticket.tipo_ticket === 'CAPACITACION') {
                await this.crearRegistroCapacitacion(ticket);
            }

            return { success: true };
        } catch (error) {
            console.error('Error procesando ticket nuevo:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Asignar técnico automáticamente según disponibilidad y especialidad
     */
    static async asignarTecnicoAutomatico(ticket) {
        try {
            // Obtener técnicos disponibles
            const { data: tecnicos, error } = await supabase
                .from('usuarios')
                .select('id, nombre, apellido')
                .eq('activo', true)
                .eq('rol', 'TECNICO') // Asumiendo que tienes un campo rol
                .is('deleted_at', null);

            if (error || !tecnicos.length) {
                console.log('No hay técnicos disponibles para asignación automática');
                return null;
            }

            // Lógica simple: asignar al técnico con menos tickets activos
            const { data: cargaTrabajo, error: errorCarga } = await supabase
                .from('tickets_soporte')
                .select('tecnico_asignado_id')
                .in('estado', ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO'])
                .eq('activo', true);

            if (errorCarga) throw errorCarga;

            // Contar tickets por técnico
            const conteoTickets = {};
            cargaTrabajo.forEach(t => {
                if (t.tecnico_asignado_id) {
                    conteoTickets[t.tecnico_asignado_id] = (conteoTickets[t.tecnico_asignado_id] || 0) + 1;
                }
            });

            // Encontrar técnico con menor carga
            let tecnicoSeleccionado = tecnicos[0];
            let menorCarga = conteoTickets[tecnicos[0].id] || 0;

            tecnicos.forEach(tecnico => {
                const carga = conteoTickets[tecnico.id] || 0;
                if (carga < menorCarga) {
                    menorCarga = carga;
                    tecnicoSeleccionado = tecnico;
                }
            });

            // Asignar el técnico
            const { error: errorAsignacion } = await supabase
                .from('tickets_soporte')
                .update({
                    tecnico_asignado_id: tecnicoSeleccionado.id,
                    estado: 'ASIGNADO',
                    updated_at: new Date().toISOString()
                })
                .eq('id', ticket.id);

            if (errorAsignacion) throw errorAsignacion;

            console.log(`Ticket ${ticket.codigo} asignado automáticamente a ${tecnicoSeleccionado.nombre}`);
            return tecnicoSeleccionado;

        } catch (error) {
            console.error('Error en asignación automática:', error);
            return null;
        }
    }

    // ====================================
    // PROCESAMIENTO DE CAMBIOS EN TICKETS
    // ====================================

    /**
     * Procesar cambio en ticket
     */
    static async procesarCambioTicket(ticket, cambios) {
        try {
            console.log(`Procesando cambios en ticket: ${ticket.codigo}`);

            // 1. Registrar cambios en auditoría
            for (const [campo, valor] of Object.entries(cambios)) {
                if (campo !== 'updated_by' && campo !== 'updated_at') {
                    await this.registrarAuditoria('TICKET', ticket.id, 'MODIFICADO', {
                        campo: campo,
                        valor_nuevo: valor
                    });
                }
            }

            // 2. Verificar si cambió el estado y procesar consecuencias
            if (cambios.estado) {
                await this.procesarCambioEstadoTicket(ticket, cambios.estado);
            }

            // 3. Si se asignó técnico, notificar
            if (cambios.tecnico_asignado_id) {
                await this.notificarAsignacionTecnico(ticket);
            }

            return { success: true };
        } catch (error) {
            console.error('Error procesando cambio de ticket:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Procesar cambio de estado específico
     */
    static async procesarCambioEstadoTicket(ticket, nuevoEstado) {
        try {
            switch (nuevoEstado) {
                case 'EN_PROCESO':
                    // Marcar fecha de inicio de atención
                    await supabase
                        .from('tickets_soporte')
                        .update({ fecha_inicio_atencion: new Date().toISOString() })
                        .eq('id', ticket.id);
                    break;

                case 'COMPLETADO':
                    // Marcar fecha de finalización y calcular tiempo real
                    const fechaFin = new Date().toISOString();
                    const tiempoReal = ticket.fecha_inicio_atencion 
                        ? Math.ceil((new Date(fechaFin) - new Date(ticket.fecha_inicio_atencion)) / (1000 * 60 * 60))
                        : null;

                    await supabase
                        .from('tickets_soporte')
                        .update({ 
                            fecha_finalizacion: fechaFin,
                            tiempo_real_horas: tiempoReal
                        })
                        .eq('id', ticket.id);

                    // Notificar cliente si corresponde
                    if (ticket.cliente_email) {
                        await this.notificarClienteTicketCompletado(ticket);
                    }
                    break;

                case 'CANCELADO':
                    // Liberar técnico asignado y notificar
                    await this.liberarRecursosTicket(ticket);
                    break;
            }

            return { success: true };
        } catch (error) {
            console.error('Error procesando cambio de estado:', error);
            return { success: false, error: error.message };
        }
    }

    // ====================================
    // GESTIÓN DE CAPACITACIONES
    // ====================================

    /**
     * Crear registro específico de capacitación desde ticket
     */
    static async crearRegistroCapacitacion(ticket) {
        try {
            // Buscar si ya existe un registro de capacitación para este ticket
            const { data: existente, error: errorBusqueda } = await supabase
                .from('soporte_capacitaciones')
                .select('id')
                .eq('ticket_id', ticket.id)
                .single();

            if (existente) {
                console.log('Ya existe registro de capacitación para este ticket');
                return existente;
            }

            // Crear nuevo registro de capacitación
            const datosCapacitacion = {
                ticket_id: ticket.id,
                venta_id: ticket.venta_id,
                tecnico_asignado_id: ticket.tecnico_asignado_id,
                cliente_nombre: ticket.cliente_nombre,
                cliente_telefono: ticket.cliente_telefono,
                cliente_email: ticket.cliente_email,
                fecha_capacitacion_solicitada: ticket.fecha_programada || new Date().toISOString().split('T')[0],
                estado: 'PENDIENTE',
                tipo_capacitacion: 'USO_BASICO', // Por defecto
                modalidad: 'PRESENCIAL', // Por defecto
                created_by: ticket.created_by,
                updated_by: ticket.updated_by
            };

            const { data: nuevaCapacitacion, error } = await supabase
                .from('soporte_capacitaciones')
                .insert([datosCapacitacion])
                .select('*')
                .single();

            if (error) throw error;

            console.log(`Registro de capacitación creado: ${nuevaCapacitacion.id}`);
            return nuevaCapacitacion;

        } catch (error) {
            console.error('Error creando registro de capacitación:', error);
            throw error;
        }
    }

    /**
     * Marcar capacitación como completada
     */
    static async completarCapacitacion(capacitacionId, datos) {
        try {
            const datosActualizacion = {
                estado: 'COMPLETADA',
                fecha_capacitacion_realizada: new Date().toISOString().split('T')[0],
                duracion_real_horas: datos.duracion_real || null,
                capacitacion_exitosa: datos.exitosa !== false,
                objetivos_cumplidos: datos.objetivos_cumplidos || [],
                temas_pendientes: datos.temas_pendientes || [],
                calificacion_cliente: datos.calificacion || null,
                comentarios_cliente: datos.comentarios || null,
                observaciones_tecnico: datos.observaciones_tecnico || null,
                materiales_entregados: datos.materiales || [],
                updated_at: new Date().toISOString(),
                ...datos
            };

            const { data, error } = await supabase
                .from('soporte_capacitaciones')
                .update(datosActualizacion)
                .eq('id', capacitacionId)
                .select('*')
                .single();

            if (error) throw error;

            // Actualizar ticket relacionado si existe
            if (data.ticket_id) {
                await supabase
                    .from('tickets_soporte')
                    .update({ estado: 'COMPLETADO' })
                    .eq('id', data.ticket_id);
            }

            console.log(`Capacitación completada: ${capacitacionId}`);
            return { success: true, data };

        } catch (error) {
            console.error('Error completando capacitación:', error);
            return { success: false, error: error.message };
        }
    }

    // ====================================
    // GESTIÓN DE PRODUCTOS Y PAUSAS
    // ====================================

    /**
     * Procesar producto marcado como reparado
     */
    static async procesarProductoReparado(producto) {
        try {
            console.log(`Procesando producto reparado: ${producto.codigo_interno}`);

            // 1. Verificar si debe ir a almacén
            if (producto.debe_retornar_almacen) {
                console.log('Producto debe retornar a almacén - ticket será creado automáticamente');
            }

            // 2. Si es producto de cliente, notificar que está listo
            if (producto.es_producto_cliente && producto.cliente_nombre) {
                await this.notificarClienteProductoListo(producto);
            }

            // 3. Actualizar métricas de rendimiento del técnico
            await this.actualizarMetricasTecnico(producto);

            // 4. Registrar en auditoría
            await this.registrarAuditoria('PRODUCTO', producto.id, 'REPARADO', {
                tiempo_reparacion: producto.tiempo_neto_reparacion_horas,
                costo: producto.costo_reparacion
            });

            return { success: true };
        } catch (error) {
            console.error('Error procesando producto reparado:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Procesar alerta de pausa larga
     */
    static async procesarAlertaPausa(pausa) {
        try {
            console.log(`Procesando alerta de pausa: ${pausa.tipo_pausa}`);

            // 1. Notificar a supervisores
            await this.notificarSupervisoresPausaLarga(pausa);

            // 2. Si es pausa crítica, escalar
            const pausasCriticas = ['CORTES_SERVICIOS', 'FALLA_HERRAMIENTAS'];
            if (pausasCriticas.includes(pausa.tipo_pausa)) {
                await this.escalarPausaCritica(pausa);
            }

            // 3. Registrar en sistema de alertas
            await this.registrarAlerta('PAUSA_LARGA', pausa.soporte_producto_id, {
                tipo_pausa: pausa.tipo_pausa,
                horas_transcurridas: pausa.horas_transcurridas
            });

            return { success: true };
        } catch (error) {
            console.error('Error procesando alerta de pausa:', error);
            return { success: false, error: error.message };
        }
    }

    // ====================================
    // SISTEMA DE NOTIFICACIONES
    // ====================================

    /**
     * Notificar ticket nuevo
     */
    static async notificarTicketNuevo(ticket) {
        try {
            // Aquí integrarías con tu sistema de notificaciones (email, SMS, etc.)
            console.log(`📧 Notificación: Nuevo ticket ${ticket.codigo} - ${ticket.tipo_ticket}`);
            
            // Ejemplo de estructura para integración futura:
            const notificacion = {
                tipo: 'TICKET_NUEVO',
                destinatarios: ['soporte@empresa.com'], // Configurar según tu negocio
                ticket: ticket,
                prioridad: ticket.prioridad
            };

            // await sistemaNotificaciones.enviar(notificacion);
            return { success: true };
        } catch (error) {
            console.error('Error enviando notificación:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notificar asignación de técnico
     */
    static async notificarAsignacionTecnico(ticket) {
        try {
            console.log(`📧 Notificación: Ticket ${ticket.codigo} asignado a técnico`);
            
            // Estructura para notificar al técnico asignado
            const notificacion = {
                tipo: 'TICKET_ASIGNADO',
                tecnico_id: ticket.tecnico_asignado_id,
                ticket: ticket
            };

            return { success: true };
        } catch (error) {
            console.error('Error notificando asignación:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notificar cliente que producto está listo
     */
    static async notificarClienteProductoListo(producto) {
        try {
            console.log(`📧 Notificación: Producto listo para ${producto.cliente_nombre}`);
            
            if (producto.cliente_telefono) {
                // Integrar con sistema de SMS/WhatsApp
                const mensaje = `Su producto ${producto.descripcion_producto} ha sido reparado y está listo para recoger. Código: ${producto.codigo_interno}`;
                console.log(`📱 SMS a ${producto.cliente_telefono}: ${mensaje}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error notificando cliente:', error);
            return { success: false, error: error.message };
        }
    }

    // ====================================
    // UTILIDADES Y HELPERS
    // ====================================

    /**
     * Registrar evento en auditoría
     */
    static async registrarAuditoria(tipo, id, accion, detalles = {}) {
        try {
            const registro = {
                referencia_tipo: tipo,
                referencia_id: id,
                campo_modificado: accion,
                valor_nuevo: JSON.stringify(detalles),
                fecha_cambio: new Date().toISOString()
            };

            await supabase
                .from('soporte_historial_estados')
                .insert([registro]);

            return { success: true };
        } catch (error) {
            console.error('Error registrando auditoría:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtener configuración del módulo
     */
    static async obtenerConfiguracion() {
        try {
            const { data, error } = await supabase
                .from('soporte_configuracion')
                .select('*')
                .eq('activo', true)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error obteniendo configuración:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Actualizar métricas de técnico
     */
    static async actualizarMetricasTecnico(producto) {
        try {
            // Esta función podría calcular KPIs específicos del técnico
            // y actualizar tablas de métricas si las tuvieras
            console.log(`📊 Actualizando métricas para técnico del producto: ${producto.codigo_interno}`);
            return { success: true };
        } catch (error) {
            console.error('Error actualizando métricas:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Liberar recursos de ticket cancelado
     */
    static async liberarRecursosTicket(ticket) {
        try {
            // Marcar productos relacionados como disponibles, etc.
            console.log(`🔄 Liberando recursos del ticket: ${ticket.codigo}`);
            return { success: true };
        } catch (error) {
            console.error('Error liberando recursos:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Registrar alerta en sistema
     */
    static async registrarAlerta(tipo, referenciaId, detalles) {
        try {
            // Registrar en tabla de alertas o sistema de monitoreo
            console.log(`⚠️ ALERTA: ${tipo} - ${JSON.stringify(detalles)}`);
            return { success: true };
        } catch (error) {
            console.error('Error registrando alerta:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Escalar pausa crítica
     */
    static async escalarPausaCritica(pausa) {
        try {
            console.log(`🚨 ESCALAMIENTO: Pausa crítica ${pausa.tipo_pausa}`);
            // Notificar a gerencia, crear tickets de alta prioridad, etc.
            return { success: true };
        } catch (error) {
            console.error('Error escalando pausa crítica:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notificar supervisores sobre pausa larga
     */
    static async notificarSupervisoresPausaLarga(pausa) {
        try {
            console.log(`👥 Notificando supervisores sobre pausa larga: ${pausa.tipo_pausa}`);
            return { success: true };
        } catch (error) {
            console.error('Error notificando supervisores:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notificar cliente sobre ticket completado
     */
    static async notificarClienteTicketCompletado(ticket) {
        try {
            console.log(`📧 Notificando cliente sobre ticket completado: ${ticket.codigo}`);
            return { success: true };
        } catch (error) {
            console.error('Error notificando cliente:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SoporteService;