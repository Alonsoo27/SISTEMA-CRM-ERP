// =====================================
// MODELO PRINCIPAL DE SOPORTE TÉCNICO - VERSIÓN CORREGIDA
// =====================================
// Maneja todas las operaciones de BD para tickets de soporte,
// capacitaciones, productos y flujos automáticos
// Integra con el sistema de pausas implementado
// CORREGIDO: Alineado con vistas existentes en la BD

const supabase = require('../../../config/supabase');

class SoporteModel {
    // ====================================
    // GESTIÓN DE TICKETS DE SOPORTE
    // ====================================

    /**
     * Crear nuevo ticket de soporte
     */
    static async crearTicket(datosTicket) {
        try {
            // Validación básica de datos requeridos
            if (!datosTicket.tipo_ticket || !datosTicket.cliente_nombre) {
                throw new Error('Datos requeridos faltantes: tipo_ticket y cliente_nombre son obligatorios');
            }

            const { data, error } = await supabase
                .from('tickets_soporte')
                .insert([datosTicket])
                .select(`
                    *,
                    asesor_origen:usuarios!asesor_origen_id(id, nombre, apellido),
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido)
                `);

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Ticket creado exitosamente',
                data: data[0] 
            };
        } catch (error) {
            console.error('Error al crear ticket:', error);
            return { 
                success: false, 
                message: 'Error al crear el ticket de soporte',
                error: error.message 
            };
        }
    }

    /**
     * Obtener tickets con filtros
     */
    static async obtenerTickets(filtros = {}) {
        try {
            let query = supabase
                .from('tickets_soporte')
                .select(`
                    *,
                    asesor_origen:usuarios!asesor_origen_id(id, nombre, apellido, email),
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido, email),
                    venta:ventas(id, cliente_nombre_completo, total),
                    productos_count:soporte_productos(count)
                `)
                .eq('activo', true);

            // Aplicar filtros con validación
            if (filtros.estado) query = query.eq('estado', filtros.estado);
            if (filtros.tipo_ticket) query = query.eq('tipo_ticket', filtros.tipo_ticket);
            if (filtros.prioridad) query = query.eq('prioridad', filtros.prioridad);
            if (filtros.tecnico_id) query = query.eq('tecnico_asignado_id', filtros.tecnico_id);
            if (filtros.asesor_id) query = query.eq('asesor_origen_id', filtros.asesor_id);
            if (filtros.fecha_desde) query = query.gte('created_at', filtros.fecha_desde);
            if (filtros.fecha_hasta) query = query.lte('created_at', filtros.fecha_hasta);

            // Ordenamiento con valores por defecto seguros
            const orden = filtros.orden || 'created_at';
            const direccion = filtros.direccion || 'desc';
            query = query.order(orden, { ascending: direccion === 'asc' });

            // Paginación segura
            if (filtros.limite && filtros.limite > 0) {
                query = query.limit(filtros.limite);
                if (filtros.offset && filtros.offset >= 0) {
                    query = query.range(filtros.offset, filtros.offset + filtros.limite - 1);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            
            return { 
                success: true, 
                message: `${data?.length || 0} tickets encontrados`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener tickets:', error);
            return { 
                success: false, 
                message: 'Error al obtener los tickets',
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Obtener ticket por ID
     */
    static async obtenerTicketPorId(id) {
        try {
            if (!id) {
                throw new Error('ID del ticket es requerido');
            }

            const { data, error } = await supabase
                .from('tickets_soporte')
                .select(`
                    *,
                    asesor_origen:usuarios!asesor_origen_id(id, nombre, apellido, email, telefono),
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido, email, telefono),
                    venta:ventas(id, codigo, cliente_nombre_completo, total, estado),
                    productos:soporte_productos(*),
                    capacitaciones:soporte_capacitaciones(*)
                `)
                .eq('id', id)
                .eq('activo', true)
                .single();

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Ticket encontrado',
                data 
            };
        } catch (error) {
            console.error('Error al obtener ticket:', error);
            return { 
                success: false, 
                message: 'Ticket no encontrado',
                error: error.message 
            };
        }
    }

    /**
     * Actualizar ticket
     */
    static async actualizarTicket(id, datos) {
        try {
            if (!id || !datos) {
                throw new Error('ID y datos del ticket son requeridos');
            }

            datos.updated_at = new Date().toISOString();
            
            const { data, error } = await supabase
                .from('tickets_soporte')
                .update(datos)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Ticket actualizado exitosamente',
                data 
            };
        } catch (error) {
            console.error('Error al actualizar ticket:', error);
            return { 
                success: false, 
                message: 'Error al actualizar el ticket',
                error: error.message 
            };
        }
    }

    // ====================================
    // GESTIÓN DE PRODUCTOS EN SOPORTE
    // ====================================

    /**
     * Crear producto en soporte
     */
    static async crearProductoSoporte(datosProducto) {
        try {
            if (!datosProducto.ticket_id || !datosProducto.producto_id) {
                throw new Error('ticket_id y producto_id son requeridos');
            }

            const { data, error } = await supabase
                .from('soporte_productos')
                .insert([datosProducto])
                .select(`
                    *,
                    producto:productos(id, codigo, descripcion, marca),
                    ticket:tickets_soporte(id, codigo, tipo_ticket)
                `);

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Producto agregado al soporte exitosamente',
                data: data[0] 
            };
        } catch (error) {
            console.error('Error al crear producto en soporte:', error);
            return { 
                success: false, 
                message: 'Error al agregar producto al soporte',
                error: error.message 
            };
        }
    }

    /**
     * Obtener productos por categoría (las 4 columnas)
     * CORREGIDO: Usar vista_productos_flujo_completo en lugar de vista_productos_con_pausas
     */
    static async obtenerProductosPorCategoria(categoria = null) {
        try {
            let query = supabase
                .from('vista_productos_flujo_completo')
                .select('*');

            if (categoria) {
                // Validar que la categoría sea válida
                const categoriasValidas = ['POR_REPARAR', 'IRREPARABLE', 'IRREPARABLE_REPUESTOS', 'REPARADO'];
                if (!categoriasValidas.includes(categoria)) {
                    throw new Error(`Categoría inválida. Debe ser una de: ${categoriasValidas.join(', ')}`);
                }
                query = query.eq('categoria', categoria);
            }

            const { data, error } = await query.order('fecha_recepcion', { ascending: false });
            
            if (error) throw error;

            // Agrupar por categorías si no se especifica una
            if (!categoria) {
                const agrupados = {
                    POR_REPARAR: data?.filter(p => p.categoria === 'POR_REPARAR') || [],
                    IRREPARABLE: data?.filter(p => p.categoria === 'IRREPARABLE') || [],
                    IRREPARABLE_REPUESTOS: data?.filter(p => p.categoria === 'IRREPARABLE_REPUESTOS') || [],
                    REPARADO: data?.filter(p => p.categoria === 'REPARADO') || []
                };
                return { 
                    success: true, 
                    message: 'Productos agrupados por categoría obtenidos',
                    data: agrupados 
                };
            }

            return { 
                success: true, 
                message: `${data?.length || 0} productos en categoría ${categoria}`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener productos por categoría:', error);
            return { 
                success: false, 
                message: 'Error al obtener productos por categoría',
                error: error.message,
                data: categoria ? [] : {
                    POR_REPARAR: [],
                    IRREPARABLE: [],
                    IRREPARABLE_REPUESTOS: [],
                    REPARADO: []
                }
            };
        }
    }

    /**
     * Actualizar estado/categoría de producto
     */
    static async actualizarProducto(id, datos) {
        try {
            if (!id || !datos) {
                throw new Error('ID y datos del producto son requeridos');
            }

            datos.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('soporte_productos')
                .update(datos)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            // Si se marca como reparado y debe volver a almacén, crear ticket automático
            if (datos.estado === 'REPARADO' && data.debe_retornar_almacen) {
                await this.crearTicketAlmacenAutomatico(id);
            }

            return { 
                success: true, 
                message: 'Producto actualizado exitosamente',
                data 
            };
        } catch (error) {
            console.error('Error al actualizar producto:', error);
            return { 
                success: false, 
                message: 'Error al actualizar el producto',
                error: error.message 
            };
        }
    }

    // ====================================
    // SISTEMA DE PAUSAS
    // ====================================

    /**
     * Pausar producto
     */
    static async pausarProducto(productoId, tipoPausa, motivo, usuarioId) {
        try {
            if (!productoId || !tipoPausa || !motivo || !usuarioId) {
                throw new Error('Todos los parámetros son requeridos para pausar un producto');
            }

            const { data, error } = await supabase.rpc('pausar_producto', {
                p_producto_id: productoId,
                p_tipo_pausa: tipoPausa,
                p_motivo: motivo,
                p_usuario_id: usuarioId
            });

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Producto pausado exitosamente',
                data 
            };
        } catch (error) {
            console.error('Error al pausar producto:', error);
            return { 
                success: false, 
                message: 'Error al pausar el producto',
                error: error.message 
            };
        }
    }

    /**
     * Reanudar producto
     */
    static async reanudarProducto(productoId, observaciones, usuarioId) {
        try {
            if (!productoId || !usuarioId) {
                throw new Error('productoId y usuarioId son requeridos');
            }

            const { data, error } = await supabase.rpc('reanudar_producto', {
                p_producto_id: productoId,
                p_observaciones: observaciones || '',
                p_usuario_id: usuarioId
            });

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Producto reanudado exitosamente',
                data 
            };
        } catch (error) {
            console.error('Error al reanudar producto:', error);
            return { 
                success: false, 
                message: 'Error al reanudar el producto',
                error: error.message 
            };
        }
    }

    /**
     * Obtener historial de pausas de un producto
     */
    static async obtenerHistorialPausas(productoId) {
        try {
            if (!productoId) {
                throw new Error('ID del producto es requerido');
            }

            const { data, error } = await supabase
                .from('soporte_pausas_reparacion')
                .select(`
                    *,
                    usuario_pausa:usuarios!usuario_pausa_id(nombre, apellido),
                    usuario_reanuda:usuarios!usuario_reanuda_id(nombre, apellido)
                `)
                .eq('soporte_producto_id', productoId)
                .eq('activo', true)
                .order('fecha_inicio', { ascending: false });

            if (error) throw error;
            
            return { 
                success: true, 
                message: `${data?.length || 0} pausas encontradas`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener historial de pausas:', error);
            return { 
                success: false, 
                message: 'Error al obtener historial de pausas',
                error: error.message,
                data: []
            };
        }
    }

    // ====================================
    // CAPACITACIONES
    // ====================================

    /**
     * Crear capacitación
     */
    static async crearCapacitacion(datosCapacitacion) {
        try {
            if (!datosCapacitacion.ticket_id || !datosCapacitacion.producto_id) {
                throw new Error('ticket_id y producto_id son requeridos');
            }

            const { data, error } = await supabase
                .from('soporte_capacitaciones')
                .insert([datosCapacitacion])
                .select(`
                    *,
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido),
                    producto:productos(id, codigo, descripcion, marca),
                    ticket:tickets_soporte(id, codigo)
                `);

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Capacitación creada exitosamente',
                data: data[0] 
            };
        } catch (error) {
            console.error('Error al crear capacitación:', error);
            return { 
                success: false, 
                message: 'Error al crear la capacitación',
                error: error.message 
            };
        }
    }

    /**
     * Obtener capacitaciones con filtros
     * CORREGIDO: Usar consulta directa con JOINs en lugar de vista_capacitaciones_completas
     */
    static async obtenerCapacitaciones(filtros = {}) {
        try {
            let query = supabase
                .from('soporte_capacitaciones')
                .select(`
                    *,
                    tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, apellido, email),
                    producto:productos(id, codigo, descripcion, marca),
                    ticket:tickets_soporte(id, codigo, tipo_ticket, estado)
                `)
                .eq('activo', true);

            // Aplicar filtros con validación
            if (filtros.estado) query = query.eq('estado', filtros.estado);
            if (filtros.tecnico_id) query = query.eq('tecnico_asignado_id', filtros.tecnico_id);
            if (filtros.fecha_desde) query = query.gte('fecha_capacitacion_programada', filtros.fecha_desde);
            if (filtros.fecha_hasta) query = query.lte('fecha_capacitacion_programada', filtros.fecha_hasta);

            const { data, error } = await query.order('fecha_capacitacion_programada', { ascending: true });
            
            if (error) throw error;
            
            return { 
                success: true, 
                message: `${data?.length || 0} capacitaciones encontradas`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener capacitaciones:', error);
            return { 
                success: false, 
                message: 'Error al obtener capacitaciones',
                error: error.message,
                data: []
            };
        }
    }

    // ====================================
    // TICKETS A ALMACÉN
    // ====================================

    /**
     * Crear ticket a almacén automáticamente
     */
    static async crearTicketAlmacenAutomatico(productoId) {
        try {
            if (!productoId) {
                throw new Error('ID del producto es requerido');
            }

            const { data, error } = await supabase.rpc('crear_ticket_almacen_automatico', {
                producto_id: productoId
            });

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Ticket a almacén creado automáticamente',
                data 
            };
        } catch (error) {
            console.error('Error al crear ticket automático a almacén:', error);
            return { 
                success: false, 
                message: 'Error al crear ticket automático a almacén',
                error: error.message 
            };
        }
    }

    /**
     * Obtener tickets enviados a almacén
     */
    static async obtenerTicketsAlmacen(filtros = {}) {
        try {
            let query = supabase
                .from('soporte_tickets_almacen')
                .select(`
                    *,
                    producto_soporte:soporte_productos(*),
                    producto:productos(id, codigo, descripcion, marca),
                    almacen:almacenes(id, nombre, ubicacion),
                    tecnico_envia:usuarios!tecnico_envia_id(nombre, apellido),
                    almacenero_recibe:usuarios!almacenero_recibe_id(nombre, apellido)
                `)
                .eq('activo', true);

            if (filtros.estado) query = query.eq('estado', filtros.estado);
            if (filtros.almacen_id) query = query.eq('almacen_destino_id', filtros.almacen_id);

            const { data, error } = await query.order('fecha_envio', { ascending: false });
            
            if (error) throw error;
            
            return { 
                success: true, 
                message: `${data?.length || 0} tickets de almacén encontrados`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener tickets de almacén:', error);
            return { 
                success: false, 
                message: 'Error al obtener tickets de almacén',
                error: error.message,
                data: []
            };
        }
    }

    // ====================================
    // MÉTRICAS Y DASHBOARDS
    // ====================================

    /**
     * Obtener métricas generales
     * CORREGIDO: Usar vista_dashboard_soporte en lugar de vista_metricas_soporte
     */
    static async obtenerMetricasGenerales() {
        try {
            const { data, error } = await supabase
                .from('vista_dashboard_soporte')
                .select('*')
                .single();

            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Métricas generales obtenidas',
                data: data || {} 
            };
        } catch (error) {
            console.error('Error al obtener métricas generales:', error);
            // Devolver estructura por defecto en caso de error
            return { 
                success: false, 
                message: 'Error al obtener métricas, mostrando datos por defecto',
                error: error.message,
                data: {
                    total_tickets: 0,
                    tickets_pendientes: 0,
                    tickets_proceso: 0,
                    tickets_completados: 0,
                    productos_por_reparar: 0,
                    productos_reparados: 0,
                    productos_irreparables: 0,
                    capacitaciones_pendientes: 0
                }
            };
        }
    }

    /**
     * Obtener métricas de rendimiento por técnico
     */
    static async obtenerRendimientoTecnicos() {
        try {
            const { data, error } = await supabase
                .from('vista_rendimiento_tecnicos')
                .select('*')
                .order('eficiencia_promedio', { ascending: false });

            if (error) throw error;
            
            return { 
                success: true, 
                message: `${data?.length || 0} técnicos analizados`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener rendimiento de técnicos:', error);
            return { 
                success: false, 
                message: 'Error al obtener rendimiento de técnicos',
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Obtener alertas pendientes
     */
    static async obtenerAlertas() {
        try {
            const { data, error } = await supabase
                .from('vista_alertas_soporte')
                .select('*')
                .order('horas_transcurridas', { ascending: false });

            if (error) throw error;
            
            return { 
                success: true, 
                message: `${data?.length || 0} alertas encontradas`,
                data: data || [] 
            };
        } catch (error) {
            console.error('Error al obtener alertas:', error);
            return { 
                success: false, 
                message: 'Error al obtener alertas',
                error: error.message,
                data: []
            };
        }
    }

    // ====================================
    // INTEGRACIÓN CON VENTAS
    // ====================================

    /**
     * Crear ticket desde módulo de ventas
     */
    static async crearTicketDesdeVenta(ventaId, tipoTicket, datosAdicionales, usuarioId) {
        try {
            if (!ventaId || !tipoTicket || !usuarioId) {
                throw new Error('ventaId, tipoTicket y usuarioId son requeridos');
            }

            // Obtener información de la venta
            const { data: venta, error: ventaError } = await supabase
                .from('ventas')
                .select('*')
                .eq('id', ventaId)
                .single();

            if (ventaError) throw ventaError;

            // Crear ticket de soporte
            const datosTicket = {
                venta_id: ventaId,
                asesor_origen_id: venta.asesor_id || usuarioId,
                tipo_ticket: tipoTicket,
                estado: 'PENDIENTE',
                prioridad: datosAdicionales?.prioridad || 'MEDIA',
                cliente_nombre: venta.cliente_nombre_completo,
                cliente_telefono: venta.cliente_telefono,
                cliente_email: venta.cliente_email,
                titulo: datosAdicionales?.titulo || `Ticket automático para venta ${venta.codigo}`,
                descripcion: datosAdicionales?.descripcion || `Ticket generado automáticamente desde venta ${venta.codigo}`,
                created_by: usuarioId,
                updated_by: usuarioId,
                ...datosAdicionales
            };

            const resultado = await this.crearTicket(datosTicket);
            
            if (resultado.success) {
                resultado.message = 'Ticket creado desde venta exitosamente';
            }
            
            return resultado;
        } catch (error) {
            console.error('Error al crear ticket desde venta:', error);
            return { 
                success: false, 
                message: 'Error al crear ticket desde venta',
                error: error.message 
            };
        }
    }
}

module.exports = SoporteModel;