// =====================================
// MODELO PRINCIPAL DE SOPORTE TÉCNICO - VERSIÓN CORREGIDA POSTGRESQL
// =====================================
// Maneja todas las operaciones de BD para tickets de soporte,
// capacitaciones, productos y flujos automáticos
// CORREGIDO: Usa PostgreSQL directo con función query() en lugar de Supabase SDK

const { query } = require('../../../config/database');

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

            // Preparar datos con valores por defecto
            const campos = [];
            const valores = [];
            const placeholders = [];
            let contador = 1;

            // Campos requeridos
            campos.push('tipo_ticket', 'cliente_nombre');
            valores.push(datosTicket.tipo_ticket, datosTicket.cliente_nombre);
            placeholders.push(`$${contador++}`, `$${contador++}`);

            // Campos opcionales
            if (datosTicket.titulo) {
                campos.push('titulo');
                valores.push(datosTicket.titulo);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.descripcion) {
                campos.push('descripcion');
                valores.push(datosTicket.descripcion);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.prioridad) {
                campos.push('prioridad');
                valores.push(datosTicket.prioridad);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.cliente_telefono) {
                campos.push('cliente_telefono');
                valores.push(datosTicket.cliente_telefono);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.cliente_email) {
                campos.push('cliente_email');
                valores.push(datosTicket.cliente_email);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.asesor_origen_id) {
                campos.push('asesor_origen_id');
                valores.push(datosTicket.asesor_origen_id);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.tecnico_asignado_id) {
                campos.push('tecnico_asignado_id');
                valores.push(datosTicket.tecnico_asignado_id);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.venta_id) {
                campos.push('venta_id');
                valores.push(datosTicket.venta_id);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.created_by) {
                campos.push('created_by');
                valores.push(datosTicket.created_by);
                placeholders.push(`$${contador++}`);
            }
            if (datosTicket.updated_by) {
                campos.push('updated_by');
                valores.push(datosTicket.updated_by);
                placeholders.push(`$${contador++}`);
            }

            // Agregar campos por defecto
            campos.push('estado', 'activo', 'created_at', 'updated_at');
            valores.push(datosTicket.estado || 'PENDIENTE', true, new Date(), new Date());
            placeholders.push(`$${contador++}`, `$${contador++}`, `$${contador++}`, `$${contador++}`);

            const sql = `
                INSERT INTO tickets_soporte (${campos.join(', ')})
                VALUES (${placeholders.join(', ')})
                RETURNING id, codigo, tipo_ticket, estado, prioridad, titulo, descripcion, 
                         cliente_nombre, cliente_telefono, cliente_email, created_at
            `;

            const result = await query(sql, valores);
            
            if (result.rows.length === 0) {
                throw new Error('No se pudo crear el ticket');
            }

            const ticket = result.rows[0];

            // Obtener datos completos con joins si es necesario
            if (ticket.asesor_origen_id || ticket.tecnico_asignado_id) {
                const sqlCompleto = `
                    SELECT t.*,
                           asesor.id as asesor_id, asesor.nombre as asesor_nombre, asesor.apellido as asesor_apellido,
                           tecnico.id as tecnico_id, tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido
                    FROM tickets_soporte t
                    LEFT JOIN usuarios asesor ON t.asesor_origen_id = asesor.id
                    LEFT JOIN usuarios tecnico ON t.tecnico_asignado_id = tecnico.id
                    WHERE t.id = $1
                `;
                const resultCompleto = await query(sqlCompleto, [ticket.id]);
                if (resultCompleto.rows.length > 0) {
                    const ticketCompleto = resultCompleto.rows[0];
                    // Estructurar la respuesta como esperaba Supabase
                    ticketCompleto.asesor_origen = ticketCompleto.asesor_id ? {
                        id: ticketCompleto.asesor_id,
                        nombre: ticketCompleto.asesor_nombre,
                        apellido: ticketCompleto.asesor_apellido
                    } : null;
                    ticketCompleto.tecnico_asignado = ticketCompleto.tecnico_id ? {
                        id: ticketCompleto.tecnico_id,
                        nombre: ticketCompleto.tecnico_nombre,
                        apellido: ticketCompleto.tecnico_apellido
                    } : null;
                    return { 
                        success: true, 
                        message: 'Ticket creado exitosamente',
                        data: ticketCompleto
                    };
                }
            }
            
            return { 
                success: true, 
                message: 'Ticket creado exitosamente',
                data: ticket 
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
            const condiciones = ['t.activo = $1'];
            const valores = [true];
            let contador = 2;

            // Construir condiciones WHERE dinámicamente
            if (filtros.estado) {
                condiciones.push(`t.estado = $${contador}`);
                valores.push(filtros.estado);
                contador++;
            }
            if (filtros.tipo_ticket) {
                condiciones.push(`t.tipo_ticket = $${contador}`);
                valores.push(filtros.tipo_ticket);
                contador++;
            }
            if (filtros.prioridad) {
                condiciones.push(`t.prioridad = $${contador}`);
                valores.push(filtros.prioridad);
                contador++;
            }
            if (filtros.tecnico_id) {
                condiciones.push(`t.tecnico_asignado_id = $${contador}`);
                valores.push(filtros.tecnico_id);
                contador++;
            }
            if (filtros.asesor_id) {
                condiciones.push(`t.asesor_origen_id = $${contador}`);
                valores.push(filtros.asesor_id);
                contador++;
            }
            if (filtros.fecha_desde) {
                condiciones.push(`t.created_at >= $${contador}`);
                valores.push(filtros.fecha_desde);
                contador++;
            }
            if (filtros.fecha_hasta) {
                condiciones.push(`t.created_at <= $${contador}`);
                valores.push(filtros.fecha_hasta);
                contador++;
            }

            // Construir ORDER BY
            const orden = filtros.orden || 'created_at';
            const direccion = filtros.direccion || 'desc';
            const orderBy = `ORDER BY t.${orden} ${direccion.toUpperCase()}`;

            // Construir LIMIT y OFFSET
            let limitOffset = '';
            if (filtros.limite && filtros.limite > 0) {
                limitOffset = `LIMIT $${contador}`;
                valores.push(filtros.limite);
                contador++;
                
                if (filtros.offset && filtros.offset >= 0) {
                    limitOffset += ` OFFSET $${contador}`;
                    valores.push(filtros.offset);
                    contador++;
                }
            }

            const sql = `
                SELECT t.*,
                       asesor.id as asesor_id, asesor.nombre as asesor_nombre, asesor.apellido as asesor_apellido, asesor.email as asesor_email,
                       tecnico.id as tecnico_id, tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido, tecnico.email as tecnico_email,
                       v.id as venta_id, CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) as cliente_nombre_completo, v.valor_final as venta_total,
                       (SELECT COUNT(*) FROM soporte_productos sp WHERE sp.ticket_id = t.id AND sp.activo = true) as productos_count
                FROM tickets_soporte t
                LEFT JOIN usuarios asesor ON t.asesor_origen_id = asesor.id
                LEFT JOIN usuarios tecnico ON t.tecnico_asignado_id = tecnico.id
                LEFT JOIN ventas v ON t.venta_id = v.id
                WHERE ${condiciones.join(' AND ')}
                ${orderBy}
                ${limitOffset}
            `;

            const result = await query(sql, valores);
            
            // Estructurar la respuesta como esperaba Supabase
            const tickets = result.rows.map(row => ({
                ...row,
                asesor_origen: row.asesor_id ? {
                    id: row.asesor_id,
                    nombre: row.asesor_nombre,
                    apellido: row.asesor_apellido,
                    email: row.asesor_email
                } : null,
                tecnico_asignado: row.tecnico_id ? {
                    id: row.tecnico_id,
                    nombre: row.tecnico_nombre,
                    apellido: row.tecnico_apellido,
                    email: row.tecnico_email
                } : null,
                venta: row.venta_id ? {
                    id: row.venta_id,
                    cliente_nombre_completo: row.cliente_nombre_completo,
                    valor_final: row.venta_total
                } : null
            }));
            
            return { 
                success: true, 
                message: `${tickets.length} tickets encontrados`,
                data: tickets
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

            const sql = `
                SELECT t.*,
                       asesor.id as asesor_id, asesor.nombre as asesor_nombre, asesor.apellido as asesor_apellido, asesor.email as asesor_email, asesor.telefono as asesor_telefono,
                       tecnico.id as tecnico_id, tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido, tecnico.email as tecnico_email, tecnico.telefono as tecnico_telefono,
                       v.id as venta_id, v.codigo as venta_codigo, CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) as cliente_nombre_completo, v.valor_final as venta_total, v.estado_detallado as venta_estado
                FROM tickets_soporte t
                LEFT JOIN usuarios asesor ON t.asesor_origen_id = asesor.id
                LEFT JOIN usuarios tecnico ON t.tecnico_asignado_id = tecnico.id
                LEFT JOIN ventas v ON t.venta_id = v.id
                WHERE t.id = $1 AND t.activo = true
            `;

            const result = await query(sql, [id]);
            
            if (result.rows.length === 0) {
                throw new Error('Ticket no encontrado');
            }

            const ticket = result.rows[0];

            // Obtener productos relacionados
            const sqlProductos = `
                SELECT * FROM soporte_productos WHERE ticket_id = $1 AND activo = true
            `;
            const resultProductos = await query(sqlProductos, [id]);

            // Obtener capacitaciones relacionadas
            const sqlCapacitaciones = `
                SELECT * FROM soporte_capacitaciones WHERE ticket_id = $1 AND activo = true
            `;
            const resultCapacitaciones = await query(sqlCapacitaciones, [id]);

            // Estructurar la respuesta como esperaba Supabase
            const ticketCompleto = {
                ...ticket,
                asesor_origen: ticket.asesor_id ? {
                    id: ticket.asesor_id,
                    nombre: ticket.asesor_nombre,
                    apellido: ticket.asesor_apellido,
                    email: ticket.asesor_email,
                    telefono: ticket.asesor_telefono
                } : null,
                tecnico_asignado: ticket.tecnico_id ? {
                    id: ticket.tecnico_id,
                    nombre: ticket.tecnico_nombre,
                    apellido: ticket.tecnico_apellido,
                    email: ticket.tecnico_email,
                    telefono: ticket.tecnico_telefono
                } : null,
                venta: ticket.venta_id ? {
                    id: ticket.venta_id,
                    codigo: ticket.venta_codigo,
                    cliente_nombre_completo: ticket.cliente_nombre_completo,
                    valor_final: ticket.venta_total,
                    estado: ticket.venta_estado
                } : null,
                productos: resultProductos.rows,
                capacitaciones: resultCapacitaciones.rows
            };
            
            return { 
                success: true, 
                message: 'Ticket encontrado',
                data: ticketCompleto
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

            datos.updated_at = new Date();

            // Construir query UPDATE dinámicamente
            const campos = [];
            const valores = [];
            let contador = 1;

            Object.keys(datos).forEach(campo => {
                if (datos[campo] !== undefined && datos[campo] !== null) {
                    campos.push(`${campo} = $${contador}`);
                    valores.push(datos[campo]);
                    contador++;
                }
            });

            if (campos.length === 0) {
                throw new Error('No hay datos para actualizar');
            }

            const sql = `
                UPDATE tickets_soporte 
                SET ${campos.join(', ')}
                WHERE id = $${contador}
                RETURNING *
            `;
            valores.push(id);

            const result = await query(sql, valores);
            
            if (result.rows.length === 0) {
                throw new Error('Ticket no encontrado o no se pudo actualizar');
            }
            
            return { 
                success: true, 
                message: 'Ticket actualizado exitosamente',
                data: result.rows[0] 
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

            // Preparar datos con valores por defecto
            const campos = [];
            const valores = [];
            const placeholders = [];
            let contador = 1;

            // Campos requeridos
            campos.push('ticket_id', 'producto_id');
            valores.push(datosProducto.ticket_id, datosProducto.producto_id);
            placeholders.push(`$${contador++}`, `$${contador++}`);

            // Campos opcionales
            if (datosProducto.codigo_producto) {
                campos.push('codigo_producto');
                valores.push(datosProducto.codigo_producto);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.descripcion_producto) {
                campos.push('descripcion_producto');
                valores.push(datosProducto.descripcion_producto);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.categoria) {
                campos.push('categoria');
                valores.push(datosProducto.categoria);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.estado) {
                campos.push('estado');
                valores.push(datosProducto.estado);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.origen) {
                campos.push('origen');
                valores.push(datosProducto.origen);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.numero_lote) {
                campos.push('numero_lote');
                valores.push(datosProducto.numero_lote);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.created_by) {
                campos.push('created_by');
                valores.push(datosProducto.created_by);
                placeholders.push(`$${contador++}`);
            }
            if (datosProducto.updated_by) {
                campos.push('updated_by');
                valores.push(datosProducto.updated_by);
                placeholders.push(`$${contador++}`);
            }

            // Agregar campos por defecto
            campos.push('activo', 'fecha_recepcion', 'created_at', 'updated_at');
            valores.push(true, new Date(), new Date(), new Date());
            placeholders.push(`$${contador++}`, `$${contador++}`, `$${contador++}`, `$${contador++}`);

            const sql = `
                INSERT INTO soporte_productos (${campos.join(', ')})
                VALUES (${placeholders.join(', ')})
                RETURNING id
            `;

            const result = await query(sql, valores);
            
            if (result.rows.length === 0) {
                throw new Error('No se pudo crear el producto en soporte');
            }

            const productoId = result.rows[0].id;

            // Obtener datos completos con joins
            const sqlCompleto = `
                SELECT sp.*,
                       p.id as producto_id, p.codigo as producto_codigo, p.descripcion as producto_descripcion, p.marca as producto_marca,
                       t.id as ticket_id, t.codigo as ticket_codigo, t.tipo_ticket
                FROM soporte_productos sp
                LEFT JOIN productos p ON sp.producto_id = p.id
                LEFT JOIN tickets_soporte t ON sp.ticket_id = t.id
                WHERE sp.id = $1
            `;
            const resultCompleto = await query(sqlCompleto, [productoId]);
            
            if (resultCompleto.rows.length > 0) {
                const productoCompleto = resultCompleto.rows[0];
                // Estructurar la respuesta como esperaba Supabase
                productoCompleto.producto = {
                    id: productoCompleto.producto_id,
                    codigo: productoCompleto.producto_codigo,
                    descripcion: productoCompleto.producto_descripcion,
                    marca: productoCompleto.producto_marca
                };
                productoCompleto.ticket = {
                    id: productoCompleto.ticket_id,
                    codigo: productoCompleto.ticket_codigo,
                    tipo_ticket: productoCompleto.tipo_ticket
                };
                
                return { 
                    success: true, 
                    message: 'Producto agregado al soporte exitosamente',
                    data: productoCompleto
                };
            }
            
            return { 
                success: true, 
                message: 'Producto agregado al soporte exitosamente',
                data: result.rows[0] 
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
            let sql;
            let valores = [];

            if (categoria) {
                // Validar que la categoría sea válida
                const categoriasValidas = ['POR_REPARAR', 'IRREPARABLE', 'IRREPARABLE_REPUESTOS', 'REPARADO'];
                if (!categoriasValidas.includes(categoria)) {
                    throw new Error(`Categoría inválida. Debe ser una de: ${categoriasValidas.join(', ')}`);
                }
                
                sql = `
                    SELECT * FROM vista_productos_flujo_completo 
                    WHERE categoria = $1 
                    ORDER BY fecha_recepcion DESC
                `;
                valores = [categoria];
            } else {
                sql = `
                    SELECT * FROM vista_productos_flujo_completo 
                    ORDER BY fecha_recepcion DESC
                `;
            }

            const result = await query(sql, valores);
            
            // Agrupar por categorías si no se especifica una
            if (!categoria) {
                const agrupados = {
                    POR_REPARAR: result.rows?.filter(p => p.categoria === 'POR_REPARAR') || [],
                    IRREPARABLE: result.rows?.filter(p => p.categoria === 'IRREPARABLE') || [],
                    IRREPARABLE_REPUESTOS: result.rows?.filter(p => p.categoria === 'IRREPARABLE_REPUESTOS') || [],
                    REPARADO: result.rows?.filter(p => p.categoria === 'REPARADO') || []
                };
                return { 
                    success: true, 
                    message: 'Productos agrupados por categoría obtenidos',
                    data: agrupados 
                };
            }

            return { 
                success: true, 
                message: `${result.rows?.length || 0} productos en categoría ${categoria}`,
                data: result.rows || [] 
            };
        } catch (error) {
            console.error('Error al obtener productos por categoría:', error);
            
            // Si la vista no existe, hacer consulta directa a la tabla
            if (error.message && error.message.includes('does not exist')) {
                try {
                    let sqlFallback;
                    let valores = [];

                    if (categoria) {
                        sqlFallback = `
                            SELECT sp.*,
                                   p.codigo as producto_codigo, p.descripcion as producto_descripcion, p.marca as producto_marca,
                                   t.codigo as ticket_codigo, t.tipo_ticket
                            FROM soporte_productos sp
                            LEFT JOIN productos p ON sp.producto_id = p.id
                            LEFT JOIN tickets_soporte t ON sp.ticket_id = t.id
                            WHERE sp.categoria = $1 AND sp.activo = true
                            ORDER BY sp.fecha_recepcion DESC
                        `;
                        valores = [categoria];
                    } else {
                        sqlFallback = `
                            SELECT sp.*,
                                   p.codigo as producto_codigo, p.descripcion as producto_descripcion, p.marca as producto_marca,
                                   t.codigo as ticket_codigo, t.tipo_ticket
                            FROM soporte_productos sp
                            LEFT JOIN productos p ON sp.producto_id = p.id
                            LEFT JOIN tickets_soporte t ON sp.ticket_id = t.id
                            WHERE sp.activo = true
                            ORDER BY sp.fecha_recepcion DESC
                        `;
                    }

                    const resultFallback = await query(sqlFallback, valores);
                    
                    if (!categoria) {
                        const agrupados = {
                            POR_REPARAR: resultFallback.rows?.filter(p => p.categoria === 'POR_REPARAR') || [],
                            IRREPARABLE: resultFallback.rows?.filter(p => p.categoria === 'IRREPARABLE') || [],
                            IRREPARABLE_REPUESTOS: resultFallback.rows?.filter(p => p.categoria === 'IRREPARABLE_REPUESTOS') || [],
                            REPARADO: resultFallback.rows?.filter(p => p.categoria === 'REPARADO') || []
                        };
                        return { 
                            success: true, 
                            message: 'Productos agrupados por categoría obtenidos (consulta directa)',
                            data: agrupados 
                        };
                    }

                    return { 
                        success: true, 
                        message: `${resultFallback.rows?.length || 0} productos en categoría ${categoria}`,
                        data: resultFallback.rows || [] 
                    };
                } catch (fallbackError) {
                    console.error('Error en consulta fallback:', fallbackError);
                }
            }
            
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

            datos.updated_at = new Date();

            // Construir query UPDATE dinámicamente
            const campos = [];
            const valores = [];
            let contador = 1;

            Object.keys(datos).forEach(campo => {
                if (datos[campo] !== undefined && datos[campo] !== null) {
                    campos.push(`${campo} = $${contador}`);
                    valores.push(datos[campo]);
                    contador++;
                }
            });

            if (campos.length === 0) {
                throw new Error('No hay datos para actualizar');
            }

            const sql = `
                UPDATE soporte_productos 
                SET ${campos.join(', ')}
                WHERE id = $${contador}
                RETURNING *
            `;
            valores.push(id);

            const result = await query(sql, valores);
            
            if (result.rows.length === 0) {
                throw new Error('Producto no encontrado o no se pudo actualizar');
            }

            const producto = result.rows[0];

            // Si se marca como reparado y debe volver a almacén, crear ticket automático
            if (datos.estado === 'REPARADO' && producto.debe_retornar_almacen) {
                await this.crearTicketAlmacenAutomatico(id);
            }

            return { 
                success: true, 
                message: 'Producto actualizado exitosamente',
                data: producto 
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

            // Llamar a la función almacenada si existe
            try {
                const sql = `SELECT pausar_producto($1, $2, $3, $4) as resultado`;
                const result = await query(sql, [productoId, tipoPausa, motivo, usuarioId]);
                
                return { 
                    success: true, 
                    message: 'Producto pausado exitosamente',
                    data: result.rows[0]?.resultado 
                };
            } catch (rpcError) {
                // Si la función no existe, implementar lógica básica
                console.log('Función pausar_producto no disponible, usando implementación directa');
                
                // Verificar que el producto existe
                const sqlVerificar = `SELECT id FROM soporte_productos WHERE id = $1 AND activo = true`;
                const resultVerificar = await query(sqlVerificar, [productoId]);
                
                if (resultVerificar.rows.length === 0) {
                    throw new Error('Producto no encontrado');
                }

                // Crear registro de pausa
                const sqlPausa = `
                    INSERT INTO soporte_pausas_reparacion 
                    (soporte_producto_id, tipo_pausa, motivo, usuario_pausa_id, fecha_inicio, activo, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, true, $6, $7)
                    RETURNING *
                `;
                const resultPausa = await query(sqlPausa, [
                    productoId, tipoPausa, motivo, usuarioId, new Date(), new Date(), new Date()
                ]);

                // Actualizar estado del producto
                const sqlActualizar = `
                    UPDATE soporte_productos 
                    SET esta_pausado = true, fecha_ultima_pausa = $1, updated_at = $2
                    WHERE id = $3
                `;
                await query(sqlActualizar, [new Date(), new Date(), productoId]);

                return { 
                    success: true, 
                    message: 'Producto pausado exitosamente',
                    data: resultPausa.rows[0] 
                };
            }
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

            // Llamar a la función almacenada si existe
            try {
                const sql = `SELECT reanudar_producto($1, $2, $3) as resultado`;
                const result = await query(sql, [productoId, observaciones || '', usuarioId]);
                
                return { 
                    success: true, 
                    message: 'Producto reanudado exitosamente',
                    data: result.rows[0]?.resultado 
                };
            } catch (rpcError) {
                // Si la función no existe, implementar lógica básica
                console.log('Función reanudar_producto no disponible, usando implementación directa');
                
                // Verificar que el producto existe y está pausado
                const sqlVerificar = `SELECT id FROM soporte_productos WHERE id = $1 AND esta_pausado = true AND activo = true`;
                const resultVerificar = await query(sqlVerificar, [productoId]);
                
                if (resultVerificar.rows.length === 0) {
                    throw new Error('Producto no encontrado o no está pausado');
                }

                // Actualizar la pausa activa
                const sqlPausa = `
                    UPDATE soporte_pausas_reparacion 
                    SET fecha_fin = $1, observaciones_reanudacion = $2, usuario_reanuda_id = $3, activo = false, updated_at = $4
                    WHERE soporte_producto_id = $5 AND fecha_fin IS NULL AND activo = true
                    RETURNING *
                `;
                const resultPausa = await query(sqlPausa, [new Date(), observaciones, usuarioId, new Date(), productoId]);

                // Actualizar estado del producto
                const sqlActualizar = `
                    UPDATE soporte_productos 
                    SET esta_pausado = false, updated_at = $1
                    WHERE id = $2
                `;
                await query(sqlActualizar, [new Date(), productoId]);

                return { 
                    success: true, 
                    message: 'Producto reanudado exitosamente',
                    data: resultPausa.rows[0] || { producto_id: productoId, reanudado: true }
                };
            }
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

            const sql = `
                SELECT sp.*,
                       up.nombre as usuario_pausa_nombre, up.apellido as usuario_pausa_apellido,
                       ur.nombre as usuario_reanuda_nombre, ur.apellido as usuario_reanuda_apellido
                FROM soporte_pausas_reparacion sp
                LEFT JOIN usuarios up ON sp.usuario_pausa_id = up.id
                LEFT JOIN usuarios ur ON sp.usuario_reanuda_id = ur.id
                WHERE sp.soporte_producto_id = $1 AND sp.activo = true
                ORDER BY sp.fecha_inicio DESC
            `;

            const result = await query(sql, [productoId]);
            
            // Estructurar la respuesta como esperaba Supabase
            const pausas = result.rows.map(row => ({
                ...row,
                usuario_pausa: row.usuario_pausa_nombre ? {
                    nombre: row.usuario_pausa_nombre,
                    apellido: row.usuario_pausa_apellido
                } : null,
                usuario_reanuda: row.usuario_reanuda_nombre ? {
                    nombre: row.usuario_reanuda_nombre,
                    apellido: row.usuario_reanuda_apellido
                } : null
            }));
            
            return { 
                success: true, 
                message: `${pausas.length} pausas encontradas`,
                data: pausas
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

            // Preparar datos con valores por defecto
            const campos = [];
            const valores = [];
            const placeholders = [];
            let contador = 1;

            // Campos requeridos
            campos.push('ticket_id', 'producto_id');
            valores.push(datosCapacitacion.ticket_id, datosCapacitacion.producto_id);
            placeholders.push(`$${contador++}`, `$${contador++}`);

            // Campos opcionales
            const camposOpcionales = [
                'cliente_nombre', 'cliente_telefono', 'cliente_email', 'producto_codigo',
                'producto_descripcion', 'tipo_capacitacion', 'modalidad', 'estado',
                'fecha_capacitacion_programada', 'fecha_capacitacion_solicitada',
                'duracion_estimada_horas', 'observaciones', 'tecnico_asignado_id',
                'created_by', 'updated_by'
            ];

            camposOpcionales.forEach(campo => {
                if (datosCapacitacion[campo] !== undefined && datosCapacitacion[campo] !== null) {
                    campos.push(campo);
                    valores.push(datosCapacitacion[campo]);
                    placeholders.push(`$${contador++}`);
                }
            });

            // Agregar campos por defecto
            campos.push('activo', 'created_at', 'updated_at');
            valores.push(true, new Date(), new Date());
            placeholders.push(`$${contador++}`, `$${contador++}`, `$${contador++}`);

            const sql = `
                INSERT INTO soporte_capacitaciones (${campos.join(', ')})
                VALUES (${placeholders.join(', ')})
                RETURNING id
            `;

            const result = await query(sql, valores);
            
            if (result.rows.length === 0) {
                throw new Error('No se pudo crear la capacitación');
            }

            const capacitacionId = result.rows[0].id;

            // Obtener datos completos con joins
            const sqlCompleto = `
                SELECT sc.*,
                       tecnico.id as tecnico_id, tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido,
                       p.id as producto_id, p.codigo as producto_codigo, p.descripcion as producto_descripcion, p.marca as producto_marca,
                       t.id as ticket_id, t.codigo as ticket_codigo
                FROM soporte_capacitaciones sc
                LEFT JOIN usuarios tecnico ON sc.tecnico_asignado_id = tecnico.id
                LEFT JOIN productos p ON sc.producto_id = p.id
                LEFT JOIN tickets_soporte t ON sc.ticket_id = t.id
                WHERE sc.id = $1
            `;
            const resultCompleto = await query(sqlCompleto, [capacitacionId]);
            
            if (resultCompleto.rows.length > 0) {
                const capacitacionCompleta = resultCompleto.rows[0];
                // Estructurar la respuesta como esperaba Supabase
                capacitacionCompleta.tecnico_asignado = capacitacionCompleta.tecnico_id ? {
                    id: capacitacionCompleta.tecnico_id,
                    nombre: capacitacionCompleta.tecnico_nombre,
                    apellido: capacitacionCompleta.tecnico_apellido
                } : null;
                capacitacionCompleta.producto = {
                    id: capacitacionCompleta.producto_id,
                    codigo: capacitacionCompleta.producto_codigo,
                    descripcion: capacitacionCompleta.producto_descripcion,
                    marca: capacitacionCompleta.producto_marca
                };
                capacitacionCompleta.ticket = {
                    id: capacitacionCompleta.ticket_id,
                    codigo: capacitacionCompleta.ticket_codigo
                };
                
                return { 
                    success: true, 
                    message: 'Capacitación creada exitosamente',
                    data: capacitacionCompleta
                };
            }
            
            return { 
                success: true, 
                message: 'Capacitación creada exitosamente',
                data: result.rows[0] 
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
            const condiciones = ['sc.activo = $1'];
            const valores = [true];
            let contador = 2;

            // Aplicar filtros con validación
            if (filtros.estado) {
                condiciones.push(`sc.estado = $${contador}`);
                valores.push(filtros.estado);
                contador++;
            }
            if (filtros.tecnico_id) {
                condiciones.push(`sc.tecnico_asignado_id = $${contador}`);
                valores.push(filtros.tecnico_id);
                contador++;
            }
            if (filtros.fecha_desde) {
                condiciones.push(`sc.fecha_capacitacion_programada >= $${contador}`);
                valores.push(filtros.fecha_desde);
                contador++;
            }
            if (filtros.fecha_hasta) {
                condiciones.push(`sc.fecha_capacitacion_programada <= $${contador}`);
                valores.push(filtros.fecha_hasta);
                contador++;
            }

            const sql = `
                SELECT sc.*,
                       tecnico.id as tecnico_id, tecnico.nombre as tecnico_nombre, tecnico.apellido as tecnico_apellido, tecnico.email as tecnico_email,
                       p.id as producto_id, p.codigo as producto_codigo, p.descripcion as producto_descripcion, p.marca as producto_marca,
                       t.id as ticket_id, t.codigo as ticket_codigo, t.tipo_ticket, t.estado as ticket_estado
                FROM soporte_capacitaciones sc
                LEFT JOIN usuarios tecnico ON sc.tecnico_asignado_id = tecnico.id
                LEFT JOIN productos p ON sc.producto_id = p.id
                LEFT JOIN tickets_soporte t ON sc.ticket_id = t.id
                WHERE ${condiciones.join(' AND ')}
                ORDER BY sc.fecha_capacitacion_programada ASC
            `;

            const result = await query(sql, valores);
            
            // Estructurar la respuesta como esperaba Supabase
            const capacitaciones = result.rows.map(row => ({
                ...row,
                tecnico_asignado: row.tecnico_id ? {
                    id: row.tecnico_id,
                    nombre: row.tecnico_nombre,
                    apellido: row.tecnico_apellido,
                    email: row.tecnico_email
                } : null,
                producto: {
                    id: row.producto_id,
                    codigo: row.producto_codigo,
                    descripcion: row.producto_descripcion,
                    marca: row.producto_marca
                },
                ticket: {
                    id: row.ticket_id,
                    codigo: row.ticket_codigo,
                    tipo_ticket: row.tipo_ticket,
                    estado: row.ticket_estado
                }
            }));
            
            return { 
                success: true, 
                message: `${capacitaciones.length} capacitaciones encontradas`,
                data: capacitaciones
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

            // Llamar a la función almacenada si existe
            try {
                const sql = `SELECT crear_ticket_almacen_automatico($1) as resultado`;
                const result = await query(sql, [productoId]);
                
                return { 
                    success: true, 
                    message: 'Ticket a almacén creado automáticamente',
                    data: result.rows[0]?.resultado 
                };
            } catch (rpcError) {
                // Si la función no existe, implementar lógica básica
                console.log('Función crear_ticket_almacen_automatico no disponible, usando implementación directa');
                
                // Obtener información del producto
                const sqlProducto = `
                    SELECT sp.*, t.asesor_origen_id, t.tecnico_asignado_id
                    FROM soporte_productos sp
                    LEFT JOIN tickets_soporte t ON sp.ticket_id = t.id
                    WHERE sp.id = $1 AND sp.activo = true
                `;
                const resultProducto = await query(sqlProducto, [productoId]);
                
                if (resultProducto.rows.length === 0) {
                    throw new Error('Producto no encontrado');
                }

                const producto = resultProducto.rows[0];

                // Crear ticket a almacén
                const sqlTicketAlmacen = `
                    INSERT INTO soporte_tickets_almacen 
                    (soporte_producto_id, producto_id, almacen_destino_id, tecnico_envia_id, 
                     estado, fecha_envio, observaciones_envio, activo, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, 'PENDIENTE', $5, $6, true, $7, $8)
                    RETURNING *
                `;
                const resultTicketAlmacen = await query(sqlTicketAlmacen, [
                    productoId,
                    producto.producto_id,
                    'b86b6533-b492-4f16-9789-57f82d3cec77', // Almacén por defecto UUID
                    producto.tecnico_asignado_id,
                    new Date(),
                    'Ticket generado automáticamente - producto reparado',
                    new Date(),
                    new Date()
                ]);

                return { 
                    success: true, 
                    message: 'Ticket a almacén creado automáticamente',
                    data: resultTicketAlmacen.rows[0] 
                };
            }
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
            const condiciones = ['sta.activo = $1'];
            const valores = [true];
            let contador = 2;

            if (filtros.estado) {
                condiciones.push(`sta.estado = $${contador}`);
                valores.push(filtros.estado);
                contador++;
            }
            if (filtros.almacen_id) {
                condiciones.push(`sta.almacen_destino_id = $${contador}`);
                valores.push(filtros.almacen_id);
                contador++;
            }

            const sql = `
                SELECT sta.*,
                       sp.codigo_producto, sp.descripcion_producto, sp.categoria as producto_categoria,
                       p.id as producto_id, p.codigo as producto_codigo, p.descripcion as producto_descripcion, p.marca as producto_marca,
                       a.id as almacen_id, a.nombre as almacen_nombre, a.direccion as almacen_direccion,
                       te.nombre as tecnico_envia_nombre, te.apellido as tecnico_envia_apellido,
                       ar.nombre as almacenero_recibe_nombre, ar.apellido as almacenero_recibe_apellido
                FROM soporte_tickets_almacen sta
                LEFT JOIN soporte_productos sp ON sta.soporte_producto_id = sp.id
                LEFT JOIN productos p ON sta.producto_id = p.id
                LEFT JOIN almacenes a ON sta.almacen_destino_id = a.id
                LEFT JOIN usuarios te ON sta.tecnico_envia_id = te.id
                LEFT JOIN usuarios ar ON sta.almacenero_recibe_id = ar.id
                WHERE ${condiciones.join(' AND ')}
                ORDER BY sta.fecha_envio DESC
            `;

            const result = await query(sql, valores);
            
            // Estructurar la respuesta como esperaba Supabase
            const tickets = result.rows.map(row => ({
                ...row,
                producto_soporte: {
                    codigo_producto: row.codigo_producto,
                    descripcion_producto: row.descripcion_producto,
                    categoria: row.producto_categoria
                },
                producto: {
                    id: row.producto_id,
                    codigo: row.producto_codigo,
                    descripcion: row.producto_descripcion,
                    marca: row.producto_marca
                },
                almacen: row.almacen_id ? {
                    id: row.almacen_id,
                    nombre: row.almacen_nombre,
                    direccion: row.almacen_direccion
                } : null,
                tecnico_envia: row.tecnico_envia_nombre ? {
                    nombre: row.tecnico_envia_nombre,
                    apellido: row.tecnico_envia_apellido
                } : null,
                almacenero_recibe: row.almacenero_recibe_nombre ? {
                    nombre: row.almacenero_recibe_nombre,
                    apellido: row.almacenero_recibe_apellido
                } : null
            }));
            
            return { 
                success: true, 
                message: `${tickets.length} tickets de almacén encontrados`,
                data: tickets
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
            // Intentar usar la vista primero
            try {
                const sql = `SELECT * FROM vista_dashboard_soporte LIMIT 1`;
                const result = await query(sql, []);
                
                return { 
                    success: true, 
                    message: 'Métricas generales obtenidas',
                    data: result.rows[0] || {} 
                };
            } catch (vistaError) {
                // Si la vista no existe, calcular métricas directamente
                console.log('Vista vista_dashboard_soporte no disponible, calculando métricas directamente');
                
                const sqlMetricas = `
                    SELECT 
                        (SELECT COUNT(*) FROM tickets_soporte WHERE activo = true) as total_tickets,
                        (SELECT COUNT(*) FROM tickets_soporte WHERE estado = 'PENDIENTE' AND activo = true) as tickets_pendientes,
                        (SELECT COUNT(*) FROM tickets_soporte WHERE estado = 'EN_PROCESO' AND activo = true) as tickets_proceso,
                        (SELECT COUNT(*) FROM tickets_soporte WHERE estado = 'COMPLETADO' AND activo = true) as tickets_completados,
                        (SELECT COUNT(*) FROM soporte_productos WHERE categoria = 'POR_REPARAR' AND activo = true) as productos_por_reparar,
                        (SELECT COUNT(*) FROM soporte_productos WHERE categoria = 'REPARADO' AND activo = true) as productos_reparados,
                        (SELECT COUNT(*) FROM soporte_productos WHERE categoria = 'IRREPARABLE' AND activo = true) as productos_irreparables,
                        (SELECT COUNT(*) FROM soporte_capacitaciones WHERE estado = 'PENDIENTE' AND activo = true) as capacitaciones_pendientes
                `;
                
                const resultMetricas = await query(sqlMetricas, []);
                
                return { 
                    success: true, 
                    message: 'Métricas generales calculadas directamente',
                    data: resultMetricas.rows[0] || {
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
            // Intentar usar la vista primero
            try {
                const sql = `
                    SELECT * FROM vista_rendimiento_tecnicos 
                    ORDER BY eficiencia_promedio DESC
                `;
                const result = await query(sql, []);
                
                return { 
                    success: true, 
                    message: `${result.rows?.length || 0} técnicos analizados`,
                    data: result.rows || [] 
                };
            } catch (vistaError) {
                // Si la vista no existe, calcular rendimiento directamente
                console.log('Vista vista_rendimiento_tecnicos no disponible, calculando rendimiento directamente');
                
                const sqlRendimiento = `
                    SELECT 
                        u.id as tecnico_id,
                        u.nombre || ' ' || COALESCE(u.apellido, '') as tecnico_nombre,
                        COUNT(sp.id) as productos_reparados,
                        AVG(EXTRACT(EPOCH FROM (sp.fecha_fin_reparacion - sp.fecha_recepcion))/3600) as promedio_tiempo_neto,
                        CASE 
                            WHEN COUNT(sp.id) > 0 THEN 
                                (COUNT(CASE WHEN sp.categoria = 'REPARADO' THEN 1 END) * 100.0 / COUNT(sp.id))
                            ELSE 0 
                        END as eficiencia_promedio,
                        COUNT(CASE WHEN sp.esta_pausado = true THEN 1 END) as productos_pausados_actual
                    FROM usuarios u
                    LEFT JOIN tickets_soporte t ON u.id = t.tecnico_asignado_id
                    LEFT JOIN soporte_productos sp ON t.id = sp.ticket_id AND sp.activo = true
                    WHERE u.id IN (SELECT DISTINCT tecnico_asignado_id FROM tickets_soporte WHERE tecnico_asignado_id IS NOT NULL)
                    GROUP BY u.id, u.nombre, u.apellido
                    ORDER BY eficiencia_promedio DESC
                `;
                
                const resultRendimiento = await query(sqlRendimiento, []);
                
                return { 
                    success: true, 
                    message: `${resultRendimiento.rows?.length || 0} técnicos analizados (cálculo directo)`,
                    data: resultRendimiento.rows || [] 
                };
            }
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
            // Intentar usar la vista primero
            try {
                const sql = `
                    SELECT * FROM vista_alertas_soporte 
                    ORDER BY horas_transcurridas DESC
                `;
                const result = await query(sql, []);
                
                return { 
                    success: true, 
                    message: `${result.rows?.length || 0} alertas encontradas`,
                    data: result.rows || [] 
                };
            } catch (vistaError) {
                // Si la vista no existe, calcular alertas directamente
                console.log('Vista vista_alertas_soporte no disponible, calculando alertas directamente');
                
                const sqlAlertas = `
                    SELECT 
                        sp.id,
                        sp.codigo_producto as codigo_interno,
                        spr.tipo_pausa,
                        EXTRACT(EPOCH FROM (NOW() - spr.fecha_inicio))/3600 as horas_transcurridas,
                        'PAUSA_PROLONGADA' as tipo_alerta,
                        'Producto pausado por más de 48 horas' as descripcion
                    FROM soporte_productos sp
                    INNER JOIN soporte_pausas_reparacion spr ON sp.id = spr.soporte_producto_id
                    WHERE sp.esta_pausado = true 
                      AND spr.activo = true 
                      AND spr.fecha_fin IS NULL
                      AND EXTRACT(EPOCH FROM (NOW() - spr.fecha_inicio))/3600 > 48
                    
                    UNION ALL
                    
                    SELECT 
                        sp.id,
                        sp.codigo_producto as codigo_interno,
                        'DIAGNOSTICO_PROLONGADO' as tipo_pausa,
                        EXTRACT(EPOCH FROM (NOW() - sp.fecha_recepcion))/3600 as horas_transcurridas,
                        'DIAGNOSTICO_PROLONGADO' as tipo_alerta,
                        'Producto en diagnóstico por más de 48 horas' as descripcion
                    FROM soporte_productos sp
                    WHERE sp.estado = 'EN_DIAGNOSTICO' 
                      AND sp.activo = true
                      AND EXTRACT(EPOCH FROM (NOW() - sp.fecha_recepcion))/3600 > 48
                    
                    ORDER BY horas_transcurridas DESC
                `;
                
                const resultAlertas = await query(sqlAlertas, []);
                
                return { 
                    success: true, 
                    message: `${resultAlertas.rows?.length || 0} alertas calculadas directamente`,
                    data: resultAlertas.rows || [] 
                };
            }
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
            const sqlVenta = `SELECT * FROM ventas WHERE id = $1`;
            const resultVenta = await query(sqlVenta, [ventaId]);

            if (resultVenta.rows.length === 0) {
                throw new Error('Venta no encontrada');
            }

            const venta = resultVenta.rows[0];

            // Crear ticket de soporte
            const datosTicket = {
                venta_id: ventaId,
                asesor_origen_id: venta.asesor_id || usuarioId,
                tipo_ticket: tipoTicket,
                estado: 'PENDIENTE',
                prioridad: datosAdicionales?.prioridad || 'MEDIA',
                cliente_nombre: `${venta.nombre_cliente} ${venta.apellido_cliente}`.trim(),
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