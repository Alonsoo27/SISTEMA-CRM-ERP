// ============================================
// COTIZACION MODEL - VALIDACIONES Y SCHEMAS EMPRESARIALES
// Sistema CRM/ERP v2.0 - Módulo de Cotizaciones
// ============================================

const Joi = require('joi');

class CotizacionModel {
    
    // ==========================================
    // SCHEMAS DE VALIDACIÓN EMPRESARIAL
    // ==========================================
    
    /**
     * Schema para crear nueva cotización
     */
    static get crearCotizacionSchema() {
        return Joi.object({
            venta_id: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'El ID de la venta debe ser numérico',
                    'number.integer': 'El ID de la venta debe ser entero',
                    'number.positive': 'El ID de la venta debe ser positivo',
                    'any.required': 'La venta es obligatoria'
                }),
            
            numero_cotizacion: Joi.string().pattern(/^COT\d{4}\d{2}\d{3}\d{3}$/).optional()
                .messages({
                    'string.pattern.base': 'Formato de número de cotización inválido (COT + YYYY + MM + XXX + XXX)'
                }),
            
            version: Joi.number().integer().positive().default(1)
                .messages({
                    'number.base': 'La versión debe ser numérica',
                    'number.integer': 'La versión debe ser entera',
                    'number.positive': 'La versión debe ser positiva'
                }),
            
            // Información del cliente
            datos_cliente: Joi.object({
                nombre_completo: Joi.string().min(2).max(100).required(),
                documento: Joi.string().min(5).max(20).required(),
                tipo_documento: Joi.string().valid('CC', 'NIT', 'CE', 'PP').required(),
                email: Joi.string().email().required(),
                telefono: Joi.string().min(7).max(15).required(),
                direccion: Joi.string().max(200).required(),
                ciudad: Joi.string().max(50).required(),
                departamento: Joi.string().max(50).required()
            }).required().messages({
                'any.required': 'Los datos del cliente son obligatorios'
            }),
            
            // Items de la cotización
            items: Joi.array().items(
                Joi.object({
                    producto_id: Joi.number().integer().positive().required(),
                    descripcion: Joi.string().max(500).required(),
                    cantidad: Joi.number().integer().positive().max(999999).required(),
                    precio_unitario: Joi.number().precision(2).positive().max(999999.99).required(),
                    descuento: Joi.number().precision(2).min(0).max(99.99).default(0),
                    tipo_descuento: Joi.string().valid('Porcentaje', 'Monto_Fijo').default('Porcentaje'),
                    impuestos: Joi.number().precision(2).min(0).max(99.99).default(19), // IVA Colombia
                    observaciones_item: Joi.string().max(300).allow('', null)
                })
            ).min(1).max(50).required().messages({
                'array.min': 'Debe incluir al menos un item',
                'array.max': 'No puede incluir más de 50 items',
                'any.required': 'Los items son obligatorios'
            }),
            
            // Totales calculados
            subtotal: Joi.number().precision(2).positive().max(999999999.99).required(),
            total_descuentos: Joi.number().precision(2).min(0).max(999999999.99).default(0),
            total_impuestos: Joi.number().precision(2).min(0).max(999999999.99).default(0),
            total_general: Joi.number().precision(2).positive().max(999999999.99).required(),
            
            // Condiciones comerciales
            condiciones_comerciales: Joi.object({
                forma_pago: Joi.string().valid(
                    'Contado', 'Credito_30', 'Credito_45', 'Credito_60', 
                    'Credito_90', 'Credito_120', 'Cuotas'
                ).required(),
                tiempo_entrega: Joi.string().max(100).required(),
                validez_cotizacion: Joi.number().integer().positive().max(365).default(30), // días
                lugar_entrega: Joi.string().max(200).required(),
                incluye_instalacion: Joi.boolean().default(false),
                incluye_capacitacion: Joi.boolean().default(false),
                garantia_meses: Joi.number().integer().min(0).max(120).default(12),
                observaciones_comerciales: Joi.string().max(1000).allow('', null)
            }).required(),
            
            // Estados y fechas
            estado: Joi.string().valid(
                'Borrador', 'Pendiente_Envio', 'Enviada', 'Vista_Cliente', 
                'En_Revision', 'Aprobada', 'Rechazada', 'Vencida'
            ).default('Borrador'),
            
            fecha_envio: Joi.date().optional(),
            fecha_vencimiento: Joi.date().greater('now').optional(),
            
            // Configuración adicional
            plantilla_id: Joi.number().integer().positive().optional(),
            requiere_aprobacion: Joi.boolean().default(false),
            es_revision: Joi.boolean().default(false),
            cotizacion_padre_id: Joi.number().integer().positive().optional(),
            
            observaciones: Joi.string().max(1000).allow('', null),
            configuracion_pdf: Joi.object().optional(),
            metadata: Joi.object().default({})
        });
    }
    
    /**
     * Schema para actualizar cotización
     */
    static get actualizarCotizacionSchema() {
        return Joi.object({
            // Solo se pueden actualizar cotizaciones en borrador o pendiente envío
            datos_cliente: Joi.object({
                nombre_completo: Joi.string().min(2).max(100),
                documento: Joi.string().min(5).max(20),
                tipo_documento: Joi.string().valid('CC', 'NIT', 'CE', 'PP'),
                email: Joi.string().email(),
                telefono: Joi.string().min(7).max(15),
                direccion: Joi.string().max(200),
                ciudad: Joi.string().max(50),
                departamento: Joi.string().max(50)
            }).optional(),
            
            items: Joi.array().items(
                Joi.object({
                    id: Joi.number().integer().positive().optional(), // Para items existentes
                    producto_id: Joi.number().integer().positive().required(),
                    descripcion: Joi.string().max(500).required(),
                    cantidad: Joi.number().integer().positive().max(999999).required(),
                    precio_unitario: Joi.number().precision(2).positive().max(999999.99).required(),
                    descuento: Joi.number().precision(2).min(0).max(99.99).default(0),
                    tipo_descuento: Joi.string().valid('Porcentaje', 'Monto_Fijo').default('Porcentaje'),
                    impuestos: Joi.number().precision(2).min(0).max(99.99).default(19),
                    observaciones_item: Joi.string().max(300).allow('', null),
                    _action: Joi.string().valid('CREATE', 'UPDATE', 'DELETE').optional() // Para control de cambios
                })
            ).min(1).max(50).optional(),
            
            condiciones_comerciales: Joi.object({
                forma_pago: Joi.string().valid(
                    'Contado', 'Credito_30', 'Credito_45', 'Credito_60', 
                    'Credito_90', 'Credito_120', 'Cuotas'
                ),
                tiempo_entrega: Joi.string().max(100),
                validez_cotizacion: Joi.number().integer().positive().max(365),
                lugar_entrega: Joi.string().max(200),
                incluye_instalacion: Joi.boolean(),
                incluye_capacitacion: Joi.boolean(),
                garantia_meses: Joi.number().integer().min(0).max(120),
                observaciones_comerciales: Joi.string().max(1000).allow('', null)
            }).optional(),
            
            observaciones: Joi.string().max(1000).allow('', null),
            configuracion_pdf: Joi.object().optional(),
            metadata: Joi.object().optional(),
            
            // Campos calculados automáticamente
            subtotal: Joi.forbidden().error(new Error('El subtotal se calcula automáticamente')),
            total_descuentos: Joi.forbidden().error(new Error('Los descuentos se calculan automáticamente')),
            total_impuestos: Joi.forbidden().error(new Error('Los impuestos se calculan automáticamente')),
            total_general: Joi.forbidden().error(new Error('El total general se calcula automáticamente'))
        }).min(1).messages({
            'object.min': 'Debe proporcionar al menos un campo para actualizar'
        });
    }
    
    /**
     * Schema para cambio de estado de cotización
     */
    static get cambioEstadoSchema() {
        return Joi.object({
            nuevo_estado: Joi.string().valid(
                'Borrador', 'Pendiente_Envio', 'Enviada', 'Vista_Cliente', 
                'En_Revision', 'Aprobada', 'Rechazada', 'Vencida'
            ).required(),
            
            observaciones: Joi.string().max(500).required().when('nuevo_estado', {
                switch: [
                    { is: Joi.valid('Rechazada', 'Vencida'), then: Joi.required() },
                    { is: Joi.valid('Aprobada'), then: Joi.optional() }
                ],
                otherwise: Joi.optional()
            }),
            
            // Datos específicos por estado
            datos_estado: Joi.when('nuevo_estado', {
                switch: [
                    {
                        is: 'Enviada',
                        then: Joi.object({
                            email_destino: Joi.string().email().required(),
                            medio_envio: Joi.string().valid('Email', 'WhatsApp', 'Fisico').default('Email'),
                            incluir_adjuntos: Joi.boolean().default(true)
                        }).required()
                    },
                    {
                        is: 'Aprobada',
                        then: Joi.object({
                            fecha_aprobacion: Joi.date().max('now').default(new Date()),
                            aprobada_por_cliente: Joi.string().max(100),
                            valor_aprobado: Joi.number().precision(2).positive(),
                            condiciones_especiales: Joi.string().max(500).allow('', null)
                        }).optional()
                    },
                    {
                        is: 'Rechazada',
                        then: Joi.object({
                            motivo_rechazo: Joi.string().valid(
                                'Precio', 'Condiciones', 'Producto', 'Competencia', 
                                'Presupuesto', 'Timing', 'Otro'
                            ).required(),
                            detalle_rechazo: Joi.string().max(500).required(),
                            feedback_cliente: Joi.string().max(1000).allow('', null)
                        }).required()
                    }
                ],
                otherwise: Joi.object().optional()
            })
        });
    }
    
    /**
     * Schema para creación de nueva versión
     */
    static get nuevaVersionSchema() {
        return Joi.object({
            motivo_revision: Joi.string().max(500).required().messages({
                'any.required': 'El motivo de la revisión es obligatorio'
            }),
            
            cambios_principales: Joi.array().items(
                Joi.string().valid(
                    'Precios', 'Productos', 'Cantidades', 'Condiciones_Comerciales',
                    'Descuentos', 'Datos_Cliente', 'Observaciones', 'Otros'
                )
            ).min(1).required(),
            
            // Datos a modificar (mismo esquema que actualización)
            datos_cliente: Joi.object({
                nombre_completo: Joi.string().min(2).max(100),
                documento: Joi.string().min(5).max(20),
                email: Joi.string().email(),
                telefono: Joi.string().min(7).max(15),
                direccion: Joi.string().max(200),
                ciudad: Joi.string().max(50)
            }).optional(),
            
            items: Joi.array().items(
                Joi.object({
                    producto_id: Joi.number().integer().positive().required(),
                    descripcion: Joi.string().max(500).required(),
                    cantidad: Joi.number().integer().positive().required(),
                    precio_unitario: Joi.number().precision(2).positive().required(),
                    descuento: Joi.number().precision(2).min(0).max(99.99).default(0),
                    tipo_descuento: Joi.string().valid('Porcentaje', 'Monto_Fijo').default('Porcentaje'),
                    impuestos: Joi.number().precision(2).min(0).max(99.99).default(19)
                })
            ).optional(),
            
            condiciones_comerciales: Joi.object({
                forma_pago: Joi.string().valid(
                    'Contado', 'Credito_30', 'Credito_45', 'Credito_60', 
                    'Credito_90', 'Credito_120', 'Cuotas'
                ),
                tiempo_entrega: Joi.string().max(100),
                validez_cotizacion: Joi.number().integer().positive().max(365),
                lugar_entrega: Joi.string().max(200),
                garantia_meses: Joi.number().integer().min(0).max(120)
            }).optional(),
            
            observaciones_version: Joi.string().max(1000).allow('', null)
        });
    }
    
    // ==========================================
    // MÉTODOS DE VALIDACIÓN EMPRESARIAL
    // ==========================================
    
    /**
     * Validar creación de cotización
     */
    static async validarCreacion(data) {
        try {
            const validatedData = await this.crearCotizacionSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validaciones de negocio
            await this.validacionesNegocioCotizacion(validatedData);
            
            // Calcular totales automáticamente
            const totalesCalculados = this.calcularTotales(validatedData.items);
            validatedData.subtotal = totalesCalculados.subtotal;
            validatedData.total_descuentos = totalesCalculados.total_descuentos;
            validatedData.total_impuestos = totalesCalculados.total_impuestos;
            validatedData.total_general = totalesCalculados.total_general;
            
            // Validar coherencia de totales
            this.validarCoherenciaTotales(validatedData, totalesCalculados);
            
            return {
                success: true,
                data: validatedData
            };
            
        } catch (error) {
            if (error.isJoi) {
                return {
                    success: false,
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                };
            }
            
            return {
                success: false,
                errors: [{ field: 'general', message: error.message }]
            };
        }
    }
    
    /**
     * Validar actualización de cotización
     */
    static async validarActualizacion(data, cotizacionActual) {
        try {
            const validatedData = await this.actualizarCotizacionSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validar si la cotización puede ser modificada
            await this.validarEstadoModificable(cotizacionActual);
            
            // Si se modifican items, recalcular totales
            if (validatedData.items) {
                const totalesCalculados = this.calcularTotales(validatedData.items);
                validatedData.subtotal = totalesCalculados.subtotal;
                validatedData.total_descuentos = totalesCalculados.total_descuentos;
                validatedData.total_impuestos = totalesCalculados.total_impuestos;
                validatedData.total_general = totalesCalculados.total_general;
            }
            
            return {
                success: true,
                data: validatedData
            };
            
        } catch (error) {
            if (error.isJoi) {
                return {
                    success: false,
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                };
            }
            
            return {
                success: false,
                errors: [{ field: 'general', message: error.message }]
            };
        }
    }
    
    /**
     * Validar cambio de estado
     */
    static async validarCambioEstado(data, cotizacionActual) {
        try {
            const validatedData = await this.cambioEstadoSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validar transición de estado
            const transicionValida = this.validarTransicionEstado(
                cotizacionActual.estado, 
                validatedData.nuevo_estado
            );
            
            if (!transicionValida.permitida) {
                throw new Error(transicionValida.razon);
            }
            
            // Validaciones específicas por estado
            await this.validacionesEspecificasEstado(validatedData, cotizacionActual);
            
            return {
                success: true,
                data: validatedData
            };
            
        } catch (error) {
            if (error.isJoi) {
                return {
                    success: false,
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                };
            }
            
            return {
                success: false,
                errors: [{ field: 'general', message: error.message }]
            };
        }
    }
    
    // ==========================================
    // VALIDACIONES DE NEGOCIO EMPRESARIALES
    // ==========================================
    
    /**
     * Validaciones de negocio para cotizaciones
     */
    static async validacionesNegocioCotizacion(data) {
        const { query } = require('../../../config/database');
        
        // 1. Validar que la venta existe y está activa
        const [venta] = await query(
            'SELECT id, estado, asesor_id FROM ventas WHERE id = ?', 
            [data.venta_id]
        );
        
        if (!venta) {
            throw new Error('La venta asociada no existe');
        }
        
        if (!['Pendiente', 'Aprobada'].includes(venta.estado)) {
            throw new Error('La venta debe estar en estado Pendiente o Aprobada para generar cotizaciones');
        }
        
        // 2. Validar productos en los items
        const productosIds = data.items.map(item => item.producto_id);
        const productos = await query(
            `SELECT id, precio, estado FROM productos WHERE id IN (${productosIds.map(() => '?').join(',')})`,
            productosIds
        );
        
        if (productos.length !== productosIds.length) {
            throw new Error('Algunos productos especificados no existen');
        }
        
        const productosInactivos = productos.filter(p => p.estado !== 'Activo');
        if (productosInactivos.length > 0) {
            throw new Error(`Productos inactivos detectados: ${productosInactivos.map(p => p.id).join(', ')}`);
        }
        
        // 3. Validar precios de productos (tolerancia del 15% para cotizaciones)
        for (const item of data.items) {
            const producto = productos.find(p => p.id === item.producto_id);
            const diferencia = Math.abs(item.precio_unitario - producto.precio);
            const tolerancia = producto.precio * 0.15; // 15% tolerancia
            
            if (diferencia > tolerancia) {
                throw new Error(`El precio del producto ${item.producto_id} excede la tolerancia permitida`);
            }
        }
        
        // 4. Validar límite de cotizaciones por venta
        const cotizacionesExistentes = await query(
            'SELECT COUNT(*) as total FROM cotizaciones WHERE venta_id = ? AND estado != "Rechazada"',
            [data.venta_id]
        );
        
        if (cotizacionesExistentes[0].total >= 5) {
            throw new Error('Máximo 5 cotizaciones activas por venta');
        }
        
        return true;
    }
    
    /**
     * Validar si cotización puede ser modificada
     */
    static async validarEstadoModificable(cotizacion) {
        const estadosInmutables = ['Aprobada', 'Rechazada', 'Vencida'];
        
        if (estadosInmutables.includes(cotizacion.estado)) {
            throw new Error(`No se pueden realizar cambios en cotizaciones con estado ${cotizacion.estado}`);
        }
        
        // Si está enviada, solo se permiten cambios menores
        if (cotizacion.estado === 'Enviada') {
            throw new Error('Para modificar una cotización enviada, debe crear una nueva versión');
        }
        
        return true;
    }
    
    /**
     * Validaciones específicas por estado
     */
    static async validacionesEspecificasEstado(data, cotizacionActual) {
        if (data.nuevo_estado === 'Enviada') {
            // Validar que tiene datos completos
            if (!cotizacionActual.datos_cliente.email) {
                throw new Error('Email del cliente requerido para envío');
            }
            
            if (!cotizacionActual.items || cotizacionActual.items.length === 0) {
                throw new Error('Debe tener al menos un item para enviar');
            }
        }
        
        if (data.nuevo_estado === 'Aprobada') {
            // Validar que no esté vencida
            if (cotizacionActual.fecha_vencimiento && new Date() > new Date(cotizacionActual.fecha_vencimiento)) {
                throw new Error('No se puede aprobar una cotización vencida');
            }
        }
        
        return true;
    }
    
    /**
     * Validar transiciones de estado
     */
    static validarTransicionEstado(estadoActual, estadoNuevo) {
        const transicionesPermitidas = {
            'Borrador': ['Pendiente_Envio', 'Enviada'],
            'Pendiente_Envio': ['Enviada', 'Borrador'],
            'Enviada': ['Vista_Cliente', 'En_Revision', 'Vencida'],
            'Vista_Cliente': ['En_Revision', 'Aprobada', 'Rechazada', 'Vencida'],
            'En_Revision': ['Aprobada', 'Rechazada', 'Enviada'], // Puede volver a enviar
            'Aprobada': [], // Estado final
            'Rechazada': ['Borrador'], // Puede crear nueva versión
            'Vencida': ['Borrador'] // Puede crear nueva versión
        };
        
        const estadosPermitidos = transicionesPermitidas[estadoActual] || [];
        
        if (!estadosPermitidos.includes(estadoNuevo)) {
            return {
                permitida: false,
                razon: `No se puede cambiar de ${estadoActual} a ${estadoNuevo}. Estados permitidos: ${estadosPermitidos.join(', ')}`
            };
        }
        
        return { permitida: true };
    }
    
    // ==========================================
    // CÁLCULOS Y HELPERS EMPRESARIALES
    // ==========================================
    
    /**
     * Calcular totales de cotización
     */
    static calcularTotales(items) {
        let subtotal = 0;
        let total_descuentos = 0;
        let total_impuestos = 0;
        
        for (const item of items) {
            const subtotal_item = item.precio_unitario * item.cantidad;
            
            // Calcular descuento
            let descuento_item = 0;
            if (item.tipo_descuento === 'Porcentaje') {
                descuento_item = subtotal_item * (item.descuento / 100);
            } else {
                descuento_item = item.descuento;
            }
            
            const subtotal_con_descuento = subtotal_item - descuento_item;
            
            // Calcular impuestos sobre el subtotal con descuento
            const impuestos_item = subtotal_con_descuento * (item.impuestos / 100);
            
            subtotal += subtotal_item;
            total_descuentos += descuento_item;
            total_impuestos += impuestos_item;
        }
        
        const total_general = subtotal - total_descuentos + total_impuestos;
        
        return {
            subtotal: parseFloat(subtotal.toFixed(2)),
            total_descuentos: parseFloat(total_descuentos.toFixed(2)),
            total_impuestos: parseFloat(total_impuestos.toFixed(2)),
            total_general: parseFloat(total_general.toFixed(2))
        };
    }
    
    /**
     * Validar coherencia de totales
     */
    static validarCoherenciaTotales(data, totalesCalculados) {
        const campos = ['subtotal', 'total_descuentos', 'total_impuestos', 'total_general'];
        
        for (const campo of campos) {
            const diferencia = Math.abs(data[campo] - totalesCalculados[campo]);
            if (diferencia > 0.01) { // Tolerancia de 1 centavo
                throw new Error(`Inconsistencia en ${campo}. Esperado: ${totalesCalculados[campo]}, Recibido: ${data[campo]}`);
            }
        }
        
        return true;
    }
    
    /**
     * Generar número de cotización único
     */
    static generarNumeroCotizacion(venta_id, version = 1, timestamp = Date.now()) {
        const fecha = new Date(timestamp);
        const año = fecha.getFullYear();
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const ventaPad = venta_id.toString().padStart(3, '0');
        const versionPad = version.toString().padStart(3, '0');
        
        return `COT${año}${mes}${ventaPad}${versionPad}`;
    }
    
    /**
     * Calcular fecha de vencimiento
     */
    static calcularFechaVencimiento(validez_dias = 30) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + validez_dias);
        return fecha;
    }
    
    /**
     * Formatear datos para almacenamiento
     */
    static formatearParaBD(data) {
        return {
            ...data,
            datos_cliente: JSON.stringify(data.datos_cliente),
            items: JSON.stringify(data.items),
            condiciones_comerciales: JSON.stringify(data.condiciones_comerciales),
            configuracion_pdf: JSON.stringify(data.configuracion_pdf || {}),
            metadata: JSON.stringify(data.metadata || {})
        };
    }
    
    /**
     * Formatear datos para respuesta API
     */
    static formatearParaAPI(data) {
        return {
            ...data,
            datos_cliente: typeof data.datos_cliente === 'string' 
                ? JSON.parse(data.datos_cliente) 
                : data.datos_cliente,
            items: typeof data.items === 'string' 
                ? JSON.parse(data.items) 
                : data.items,
            condiciones_comerciales: typeof data.condiciones_comerciales === 'string' 
                ? JSON.parse(data.condiciones_comerciales) 
                : data.condiciones_comerciales,
            configuracion_pdf: data.configuracion_pdf 
                ? (typeof data.configuracion_pdf === 'string' 
                    ? JSON.parse(data.configuracion_pdf) 
                    : data.configuracion_pdf)
                : {},
            metadata: data.metadata 
                ? (typeof data.metadata === 'string' 
                    ? JSON.parse(data.metadata) 
                    : data.metadata)
                : {}
        };
    }
    
    /**
     * Comparar versiones de cotización
     */
    static compararVersiones(cotizacionAnterior, cotizacionNueva) {
        const cambios = [];
        
        // Comparar datos del cliente
        if (JSON.stringify(cotizacionAnterior.datos_cliente) !== JSON.stringify(cotizacionNueva.datos_cliente)) {
            cambios.push('Datos del Cliente');
        }
        
        // Comparar items
        if (JSON.stringify(cotizacionAnterior.items) !== JSON.stringify(cotizacionNueva.items)) {
            cambios.push('Items');
        }
        
        // Comparar condiciones comerciales
        if (JSON.stringify(cotizacionAnterior.condiciones_comerciales) !== JSON.stringify(cotizacionNueva.condiciones_comerciales)) {
            cambios.push('Condiciones Comerciales');
        }
        
        // Comparar totales
        if (cotizacionAnterior.total_general !== cotizacionNueva.total_general) {
            cambios.push('Total General');
        }
        
        return cambios;
    }
}

module.exports = CotizacionModel;