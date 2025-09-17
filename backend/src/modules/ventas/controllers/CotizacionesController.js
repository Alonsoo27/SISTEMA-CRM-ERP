// ============================================
// COTIZACIONES CONTROLLER - GESTIÓN EMPRESARIAL
// Sistema CRM/ERP v2.0
// ============================================

const { query } = require('../../../config/database');

// Mock temporal de pdfGenerator hasta instalar pdfkit
const pdfGenerator = {
    async generarCotizacionPDF(cotizacion) {
        console.log('📄 PDF Generator Mock - Cotización:', cotizacion.id);
        return `/tmp/cotizacion-${cotizacion.id}-${Date.now()}.pdf`;
    }
};

class CotizacionesController {

    // ============================================
    // LISTAR COTIZACIONES POR VENTA
    // ============================================
    static async listarCotizacionesPorVenta(req, res) {
        try {
            const { venta_id } = req.params;
            const { incluir_inactivas = false } = req.query;

            let whereClause = 'WHERE c.venta_id = $1';
            const params = [venta_id];

            if (!incluir_inactivas) {
                whereClause += ' AND c.activo = true';
            }

            const cotizacionesQuery = `
                SELECT 
                    c.*,
                    u.nombre as creado_por_nombre, u.apellido as creado_por_nombre_apellido,
                    ua.nombre as aprobado_por_nombre, ua.apellido as aprobado_por_nombre_apellido,
                    v.codigo as venta_codigo,
                    v.cliente_nombre,
                    COUNT(cd.id) as total_productos
                FROM cotizaciones c
                LEFT JOIN usuarios u ON c.created_by = u.id
                LEFT JOIN usuarios ua ON c.aprobado_por = ua.id
                LEFT JOIN ventas v ON c.venta_id = v.id
                LEFT JOIN cotizacion_detalles cd ON c.id = cd.cotizacion_id
                ${whereClause}
                GROUP BY c.id, u.nombre, u.apellido, ua.nombre, ua.apellido, v.codigo, v.cliente_nombre
                ORDER BY c.numero_version DESC, c.fecha_creacion DESC
            `;

            const result = await query(cotizacionesQuery, params);

            res.json({
                success: true,
                data: {
                    cotizaciones: result.rows,
                    total: result.rows.length,
                    venta_id: parseInt(venta_id)
                }
            });

        } catch (error) {
            console.error('Error al listar cotizaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // OBTENER COTIZACIÓN COMPLETA
    // ============================================
    static async obtenerCotizacion(req, res) {
        try {
            const { id } = req.params;

            // Query principal de la cotización
            const cotizacionQuery = `
                SELECT 
                    c.*,
                    u.nombre as creado_por_nombre, u.apellido as creado_por_nombre_apellido,
                    ua.nombre as aprobado_por_nombre, ua.apellido as aprobado_por_nombre_apellido,
                    v.codigo as venta_codigo,
                    v.cliente_nombre,
                    v.cliente_empresa,
                    v.cliente_email,
                    v.cliente_telefono
                FROM cotizaciones c
                LEFT JOIN usuarios u ON c.created_by = u.id
                LEFT JOIN usuarios ua ON c.aprobado_por = ua.id
                LEFT JOIN ventas v ON c.venta_id = v.id
                WHERE c.id = $1
            `;

            // Query para productos de la cotización
            const detallesQuery = `
                SELECT 
                    cd.*,
                    p.nombre as producto_nombre,
                    p.descripcion as producto_descripcion,
                    p.categoria,
                    p.marca,
                    p.unidad_medida
                FROM cotizacion_detalles cd
                LEFT JOIN productos p ON cd.producto_id = p.id
                WHERE cd.cotizacion_id = $1
                ORDER BY cd.orden_linea
            `;

            const [cotizacionResult, detallesResult] = await Promise.all([
                query(cotizacionQuery, [id]),
                query(detallesQuery, [id])
            ]);

            if (cotizacionResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización no encontrada'
                });
            }

            const cotizacion = cotizacionResult.rows[0];
            cotizacion.detalles = detallesResult.rows;

            res.json({
                success: true,
                data: cotizacion
            });

        } catch (error) {
            console.error('Error al obtener cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // CREAR NUEVA COTIZACIÓN
    // ============================================
    static async crearCotizacion(req, res) {
        try {
            const {
                venta_id,
                titulo = 'Cotización',
                descripcion,
                validez_dias = 30,
                condiciones_pago,
                tiempo_entrega,
                observaciones,
                descuento_porcentaje = 0,
                descuento_monto = 0,
                incluir_impuestos = true,
                porcentaje_impuesto = 18,
                detalles = [] // Array de productos
            } = req.body;

            // Validaciones básicas
            if (!venta_id) {
                return res.status(400).json({
                    success: false,
                    message: 'venta_id es requerido'
                });
            }

            // Verificar que la venta existe
            const ventaResult = await query(`
                SELECT id, estado, cliente_nombre 
                FROM ventas 
                WHERE id = $1 AND activo = true
            `, [venta_id]);

            if (ventaResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Venta no encontrada'
                });
            }

            // Obtener número de versión siguiente
            const versionResult = await query(`
                SELECT COALESCE(MAX(numero_version), 0) + 1 as siguiente_version
                FROM cotizaciones 
                WHERE venta_id = $1
            `, [venta_id]);

            const numeroVersion = versionResult.rows[0].siguiente_version;

            // Iniciar transacción
            await query('BEGIN');

            try {
                // Crear cotización principal
                const cotizacionQuery = `
                    INSERT INTO cotizaciones (
                        venta_id, numero_version, titulo, descripcion,
                        fecha_validez, condiciones_pago, tiempo_entrega,
                        observaciones, subtotal, descuento_porcentaje,
                        descuento_monto, valor_descuento, base_impuesto,
                        porcentaje_impuesto, valor_impuesto, total,
                        estado, created_by, updated_by
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18
                    ) RETURNING *
                `;

                // Calcular fecha de validez
                const fechaValidez = new Date();
                fechaValidez.setDate(fechaValidez.getDate() + validez_dias);

                // Calcular totales (se recalculará con productos)
                let subtotal = 0;
                if (detalles && detalles.length > 0) {
                    subtotal = detalles.reduce((sum, det) => sum + (det.cantidad * det.precio_unitario), 0);
                }

                const valorDescuento = descuento_monto + (subtotal * descuento_porcentaje / 100);
                const baseImpuesto = subtotal - valorDescuento;
                const valorImpuesto = incluir_impuestos ? (baseImpuesto * porcentaje_impuesto / 100) : 0;
                const total = baseImpuesto + valorImpuesto;

                const cotizacionResult = await query(cotizacionQuery, [
                    venta_id, numeroVersion, titulo, descripcion,
                    fechaValidez, condiciones_pago, tiempo_entrega,
                    observaciones, subtotal, descuento_porcentaje,
                    descuento_monto, valorDescuento, baseImpuesto,
                    porcentaje_impuesto, valorImpuesto, total,
                    'Borrador', req.user?.id || 1
                ]);

                const nuevaCotizacion = cotizacionResult.rows[0];

                // Agregar productos si se proporcionaron
                if (detalles && detalles.length > 0) {
                    for (let i = 0; i < detalles.length; i++) {
                        const detalle = detalles[i];
                        const subtotalLinea = detalle.cantidad * detalle.precio_unitario;
                        const descuentoLinea = detalle.descuento_monto || 0;
                        const totalLinea = subtotalLinea - descuentoLinea;

                        await query(`
                            INSERT INTO cotizacion_detalles (
                                cotizacion_id, producto_id, cantidad, precio_unitario,
                                subtotal, descuento_monto, total_linea,
                                descripcion_personalizada, orden_linea
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        `, [
                            nuevaCotizacion.id, detalle.producto_id, detalle.cantidad,
                            detalle.precio_unitario, subtotalLinea, descuentoLinea,
                            totalLinea, detalle.descripcion_personalizada, i + 1
                        ]);
                    }

                    // Recalcular totales reales
                    await this.recalcularTotalesCotizacion(nuevaCotizacion.id);
                }

                await query('COMMIT');

                // Obtener cotización completa para respuesta
                const cotizacionCompleta = await this.obtenerCotizacionCompleta(nuevaCotizacion.id);

                res.status(201).json({
                    success: true,
                    message: `Cotización v${numeroVersion} creada exitosamente`,
                    data: cotizacionCompleta
                });

            } catch (error) {
                await query('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error al crear cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear cotización',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ============================================
    // ACTUALIZAR COTIZACIÓN
    // ============================================
    static async actualizarCotizacion(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Verificar que la cotización existe y está en estado editable
            const cotizacionActual = await query(`
                SELECT estado FROM cotizaciones 
                WHERE id = $1 AND activo = true
            `, [id]);

            if (cotizacionActual.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización no encontrada'
                });
            }

            if (['Aprobada', 'Rechazada'].includes(cotizacionActual.rows[0].estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede editar una cotización aprobada o rechazada'
                });
            }

            // Campos permitidos para actualización
            const camposPermitidos = [
                'titulo', 'descripcion', 'condiciones_pago', 'tiempo_entrega',
                'observaciones', 'descuento_porcentaje', 'descuento_monto',
                'porcentaje_impuesto'
            ];

            const camposActualizar = [];
            const valores = [];
            let paramCount = 0;

            for (const [key, value] of Object.entries(updates)) {
                if (camposPermitidos.includes(key) && value !== undefined) {
                    paramCount++;
                    camposActualizar.push(`${key} = $${paramCount}`);
                    valores.push(value);
                }
            }

            if (camposActualizar.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay campos válidos para actualizar'
                });
            }

            // Agregar campos de auditoría
            paramCount++;
            camposActualizar.push(`updated_by = $${paramCount}`);
            valores.push(req.user?.id || 1);

            paramCount++;
            camposActualizar.push(`updated_at = $${paramCount}`);
            valores.push(new Date());

            // Agregar ID para WHERE
            paramCount++;
            valores.push(id);

            const updateQuery = `
                UPDATE cotizaciones 
                SET ${camposActualizar.join(', ')}
                WHERE id = $${paramCount} AND activo = true
                RETURNING *
            `;

            const result = await query(updateQuery, valores);

            // Recalcular totales si se actualizaron descuentos o impuestos
            if (updates.descuento_porcentaje !== undefined || 
                updates.descuento_monto !== undefined || 
                updates.porcentaje_impuesto !== undefined) {
                await this.recalcularTotalesCotizacion(id);
            }

            res.json({
                success: true,
                message: 'Cotización actualizada exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error al actualizar cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar cotización'
            });
        }
    }

    // ============================================
    // ENVIAR COTIZACIÓN AL CLIENTE
    // ============================================
    static async enviarCotizacion(req, res) {
        try {
            const { id } = req.params;
            const { email_destino, mensaje_personalizado, incluir_pdf = true } = req.body;

            // Obtener cotización completa
            const cotizacion = await this.obtenerCotizacionCompleta(id);
            if (!cotizacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización no encontrada'
                });
            }

            // Cambiar estado a 'Enviada' si está en Borrador
            if (cotizacion.estado === 'Borrador') {
                await query(`
                    UPDATE cotizaciones 
                    SET estado = 'Enviada', fecha_envio = NOW(), updated_at = NOW()
                    WHERE id = $1
                `, [id]);
            }

            // Generar PDF si se solicita
            let pdfPath = null;
            if (incluir_pdf) {
                pdfPath = await pdfGenerator.generarCotizacionPDF(cotizacion);
            }

            // Registrar envío
            await query(`
                INSERT INTO cotizacion_envios (
                    cotizacion_id, email_destino, mensaje_personalizado,
                    archivo_pdf_path, enviado_por, fecha_envio
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, [id, email_destino, mensaje_personalizado, pdfPath, req.user?.id || 1]);

            // Aquí integrarías con tu servicio de email
            // await emailService.enviarCotizacion(email_destino, cotizacion, pdfPath, mensaje_personalizado);

            res.json({
                success: true,
                message: `Cotización enviada exitosamente a ${email_destino} (MOCK)`,
                data: {
                    cotizacion_id: id,
                    email_destino: email_destino,
                    pdf_generado: incluir_pdf,
                    nuevo_estado: 'Enviada',
                    note: 'Email service en modo mock'
                }
            });

        } catch (error) {
            console.error('Error al enviar cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al enviar cotización'
            });
        }
    }

    // ============================================
    // APROBAR COTIZACIÓN (CLIENTE)
    // ============================================
    static async aprobarCotizacion(req, res) {
        try {
            const { id } = req.params;
            const { comentarios_aprobacion, aprobado_por_cliente } = req.body;

            // Verificar estado actual
            const cotizacionActual = await query(`
                SELECT estado, venta_id FROM cotizaciones 
                WHERE id = $1 AND activo = true
            `, [id]);

            if (cotizacionActual.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización no encontrada'
                });
            }

            if (cotizacionActual.rows[0].estado === 'Aprobada') {
                return res.status(400).json({
                    success: false,
                    message: 'La cotización ya está aprobada'
                });
            }

            // Marcar otras versiones como obsoletas
            await query(`
                UPDATE cotizaciones 
                SET estado = 'Obsoleta'
                WHERE venta_id = $1 AND id != $2 AND estado IN ('Borrador', 'Enviada')
            `, [cotizacionActual.rows[0].venta_id, id]);

            // Aprobar cotización actual
            const result = await query(`
                UPDATE cotizaciones 
                SET 
                    estado = 'Aprobada',
                    fecha_aprobacion = NOW(),
                    comentarios_aprobacion = $1,
                    aprobado_por_cliente = $2,
                    updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [comentarios_aprobacion, aprobado_por_cliente, id]);

            // Actualizar venta a estado "Aprobada" automáticamente
            await query(`
                UPDATE ventas 
                SET estado = 'Aprobada', fase = 'Cierre', probabilidad_cierre = 95
                WHERE id = $1
            `, [cotizacionActual.rows[0].venta_id]);

            res.json({
                success: true,
                message: 'Cotización aprobada exitosamente',
                data: {
                    cotizacion: result.rows[0],
                    acciones_automaticas: [
                        'Otras versiones marcadas como obsoletas',
                        'Venta actualizada a estado Aprobada'
                    ]
                }
            });

        } catch (error) {
            console.error('Error al aprobar cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al aprobar cotización'
            });
        }
    }

    // ============================================
    // RECHAZAR COTIZACIÓN
    // ============================================
    static async rechazarCotizacion(req, res) {
        try {
            const { id } = req.params;
            const { motivo_rechazo, comentarios } = req.body;

            const result = await query(`
                UPDATE cotizaciones 
                SET 
                    estado = 'Rechazada',
                    fecha_rechazo = NOW(),
                    motivo_rechazo = $1,
                    comentarios_rechazo = $2,
                    updated_at = NOW()
                WHERE id = $3 AND activo = true
                RETURNING *
            `, [motivo_rechazo, comentarios, id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Cotización rechazada',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Error al rechazar cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al rechazar cotización'
            });
        }
    }

    // ============================================
    // GENERAR PDF DE COTIZACIÓN
    // ============================================
    static async generarPDF(req, res) {
        try {
            const { id } = req.params;
            
            const cotizacion = await this.obtenerCotizacionCompleta(id);
            if (!cotizacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización no encontrada'
                });
            }

            const pdfPath = await pdfGenerator.generarCotizacionPDF(cotizacion);
            
            // En modo mock, devolver información del PDF
            res.json({
                success: true,
                message: 'PDF generado (Mock mode)',
                data: {
                    cotizacion_id: id,
                    pdf_path: pdfPath,
                    filename: `cotizacion-v${cotizacion.numero_version}-${cotizacion.id}.pdf`,
                    note: 'Para descargar PDF real, instalar pdfkit'
                }
            });

        } catch (error) {
            console.error('Error al generar PDF:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar PDF'
            });
        }
    }

    // ============================================
    // DUPLICAR COTIZACIÓN (NUEVA VERSIÓN)
    // ============================================
    static async duplicarCotizacion(req, res) {
        try {
            const { id } = req.params;
            const { modificaciones = {} } = req.body;

            // Obtener cotización original completa
            const cotizacionOriginal = await this.obtenerCotizacionCompleta(id);
            if (!cotizacionOriginal) {
                return res.status(404).json({
                    success: false,
                    message: 'Cotización original no encontrada'
                });
            }

            // Preparar datos para nueva cotización
            const nuevaCotizacionData = {
                venta_id: cotizacionOriginal.venta_id,
                titulo: modificaciones.titulo || `${cotizacionOriginal.titulo} (Copia)`,
                descripcion: modificaciones.descripcion || cotizacionOriginal.descripcion,
                condiciones_pago: modificaciones.condiciones_pago || cotizacionOriginal.condiciones_pago,
                tiempo_entrega: modificaciones.tiempo_entrega || cotizacionOriginal.tiempo_entrega,
                observaciones: modificaciones.observaciones || cotizacionOriginal.observaciones,
                descuento_porcentaje: modificaciones.descuento_porcentaje || cotizacionOriginal.descuento_porcentaje,
                descuento_monto: modificaciones.descuento_monto || cotizacionOriginal.descuento_monto,
                porcentaje_impuesto: modificaciones.porcentaje_impuesto || cotizacionOriginal.porcentaje_impuesto,
                detalles: cotizacionOriginal.detalles.map(d => ({
                    producto_id: d.producto_id,
                    cantidad: d.cantidad,
                    precio_unitario: d.precio_unitario,
                    descuento_monto: d.descuento_monto,
                    descripcion_personalizada: d.descripcion_personalizada
                }))
            };

            // Simular request para crear cotización
            req.body = nuevaCotizacionData;
            await this.crearCotizacion(req, res);

        } catch (error) {
            console.error('Error al duplicar cotización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al duplicar cotización'
            });
        }
    }

    // ============================================
    // LISTAR TODAS LAS COTIZACIONES
    // ============================================
    static async listarCotizaciones(req, res) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                estado, 
                venta_id, 
                fecha_desde, 
                fecha_hasta 
            } = req.query;

            let whereClause = 'WHERE c.activo = true';
            const params = [];
            let paramCount = 0;

            if (estado) {
                paramCount++;
                whereClause += ` AND c.estado = $${paramCount}`;
                params.push(estado);
            }

            if (venta_id) {
                paramCount++;
                whereClause += ` AND c.venta_id = $${paramCount}`;
                params.push(venta_id);
            }

            if (fecha_desde) {
                paramCount++;
                whereClause += ` AND c.fecha_creacion >= $${paramCount}`;
                params.push(fecha_desde);
            }

            if (fecha_hasta) {
                paramCount++;
                whereClause += ` AND c.fecha_creacion <= $${paramCount}`;
                params.push(fecha_hasta);
            }

            const offset = (page - 1) * limit;
            paramCount++;
            params.push(limit);
            paramCount++;
            params.push(offset);

            const cotizacionesQuery = `
                SELECT 
                    c.*,
                    u.nombre as creado_por_nombre, u.apellido as creado_por_apellido,
                    v.codigo as venta_codigo,
                    v.cliente_nombre,
                    COUNT(cd.id) as total_productos
                FROM cotizaciones c
                LEFT JOIN usuarios u ON c.created_by = u.id
                LEFT JOIN ventas v ON c.venta_id = v.id
                LEFT JOIN cotizacion_detalles cd ON c.id = cd.cotizacion_id
                ${whereClause}
                GROUP BY c.id, u.nombre, u.apellido, v.codigo, v.cliente_nombre
                ORDER BY c.fecha_creacion DESC
                LIMIT $${paramCount-1} OFFSET $${paramCount}
            `;

            const countQuery = `
                SELECT COUNT(DISTINCT c.id) as total
                FROM cotizaciones c
                LEFT JOIN ventas v ON c.venta_id = v.id
                ${whereClause}
            `;

            const [cotizaciones, countResult] = await Promise.all([
                query(cotizacionesQuery, params),
                query(countQuery, params.slice(0, -2)) // Remover limit y offset para count
            ]);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            res.json({
                success: true,
                data: {
                    cotizaciones: cotizaciones.rows,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: totalPages,
                        total_records: total,
                        per_page: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Error al listar cotizaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // ============================================
    // HELPERS INTERNOS
    // ============================================

    // Obtener cotización completa (uso interno)
    static async obtenerCotizacionCompleta(cotizacionId) {
        try {
            const cotizacionQuery = `
                SELECT 
                    c.*,
                    u.nombre as creado_por_nombre, u.apellido as creado_por_nombre_apellido,
                    v.codigo as venta_codigo,
                    v.cliente_nombre,
                    v.cliente_empresa,
                    v.cliente_email,
                    v.cliente_telefono
                FROM cotizaciones c
                LEFT JOIN usuarios u ON c.created_by = u.id
                LEFT JOIN ventas v ON c.venta_id = v.id
                WHERE c.id = $1
            `;

            const detallesQuery = `
                SELECT 
                    cd.*,
                    p.nombre as producto_nombre,
                    p.descripcion as producto_descripcion
                FROM cotizacion_detalles cd
                LEFT JOIN productos p ON cd.producto_id = p.id
                WHERE cd.cotizacion_id = $1
                ORDER BY cd.orden_linea
            `;

            const [cotizacionResult, detallesResult] = await Promise.all([
                query(cotizacionQuery, [cotizacionId]),
                query(detallesQuery, [cotizacionId])
            ]);

            if (cotizacionResult.rows.length === 0) {
                return null;
            }

            const cotizacion = cotizacionResult.rows[0];
            cotizacion.detalles = detallesResult.rows;

            return cotizacion;

        } catch (error) {
            console.error('Error al obtener cotización completa:', error);
            return null;
        }
    }

    // Recalcular totales de cotización
    static async recalcularTotalesCotizacion(cotizacionId) {
        try {
            // Obtener datos actuales
            const cotizacionResult = await query(`
                SELECT descuento_porcentaje, descuento_monto, porcentaje_impuesto
                FROM cotizaciones WHERE id = $1
            `, [cotizacionId]);

            const detallesResult = await query(`
                SELECT SUM(total_linea) as subtotal
                FROM cotizacion_detalles 
                WHERE cotizacion_id = $1
            `, [cotizacionId]);

            if (cotizacionResult.rows.length === 0) return;

            const cotizacion = cotizacionResult.rows[0];
            const subtotal = parseFloat(detallesResult.rows[0].subtotal || 0);

            const valorDescuento = cotizacion.descuento_monto + (subtotal * cotizacion.descuento_porcentaje / 100);
            const baseImpuesto = subtotal - valorDescuento;
            const valorImpuesto = baseImpuesto * (cotizacion.porcentaje_impuesto / 100);
            const total = baseImpuesto + valorImpuesto;

            // Actualizar totales
            await query(`
                UPDATE cotizaciones 
                SET 
                    subtotal = $1,
                    valor_descuento = $2,
                    base_impuesto = $3,
                    valor_impuesto = $4,
                    total = $5,
                    updated_at = NOW()
                WHERE id = $6
            `, [subtotal, valorDescuento, baseImpuesto, valorImpuesto, total, cotizacionId]);

        } catch (error) {
            console.error('Error al recalcular totales:', error);
        }
    }
}

// ============================================
// FUNCIONES BÁSICAS FALTANTES PARA COTIZACIONES
// ============================================

// Exportar funciones individuales para compatibilidad con rutas
if (!exports.listarCotizaciones) {
    exports.listarCotizaciones = CotizacionesController.listarCotizaciones;
}

if (!exports.crearCotizacion) {
    exports.crearCotizacion = CotizacionesController.crearCotizacion;
}

if (!exports.obtenerCotizacion) {
    exports.obtenerCotizacion = CotizacionesController.obtenerCotizacion;
}

if (!exports.actualizarCotizacion) {
    exports.actualizarCotizacion = CotizacionesController.actualizarCotizacion;
}

if (!exports.enviarCotizacion) {
    exports.enviarCotizacion = CotizacionesController.enviarCotizacion;
}

if (!exports.aprobarCotizacion) {
    exports.aprobarCotizacion = CotizacionesController.aprobarCotizacion;
}

if (!exports.rechazarCotizacion) {
    exports.rechazarCotizacion = CotizacionesController.rechazarCotizacion;
}

if (!exports.generarPDF) {
    exports.generarPDF = CotizacionesController.generarPDF;
}

if (!exports.duplicarCotizacion) {
    exports.duplicarCotizacion = CotizacionesController.duplicarCotizacion;
}

if (!exports.listarCotizacionesPorVenta) {
    exports.listarCotizacionesPorVenta = CotizacionesController.listarCotizacionesPorVenta;
}

// Exportar la clase completa
module.exports = CotizacionesController;

console.log('✅ CotizacionesController loaded with ALL original functions plus PDF mock');