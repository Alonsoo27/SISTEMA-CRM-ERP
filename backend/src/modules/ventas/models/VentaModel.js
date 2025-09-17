// ============================================
// VENTA MODEL - VALIDACIONES Y SCHEMAS EMPRESARIALES
// Sistema CRM/ERP v2.0 - Módulo de Ventas
// ============================================

const Joi = require('joi');

class VentaModel {
    
    // ==========================================
    // SCHEMAS DE VALIDACIÓN EMPRESARIAL
    // ==========================================
    
    /**
     * Schema para crear nueva venta
     */
    static get crearVentaSchema() {
        return Joi.object({
            prospecto_id: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'El ID del prospecto debe ser numérico',
                    'number.integer': 'El ID del prospecto debe ser entero',
                    'number.positive': 'El ID del prospecto debe ser positivo',
                    'any.required': 'El prospecto es obligatorio'
                }),
            
            asesor_id: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'El ID del asesor debe ser numérico',
                    'any.required': 'El asesor es obligatorio'
                }),
            
            producto_id: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'El ID del producto debe ser numérico',
                    'any.required': 'El producto es obligatorio'
                }),
            
            valor_total: Joi.number().precision(2).positive().max(999999999.99).required()
                .messages({
                    'number.base': 'El valor total debe ser numérico',
                    'number.positive': 'El valor total debe ser positivo',
                    'number.max': 'El valor total no puede exceder $999,999,999.99',
                    'any.required': 'El valor total es obligatorio'
                }),
            
            cantidad: Joi.number().integer().positive().max(999999).default(1)
                .messages({
                    'number.base': 'La cantidad debe ser numérica',
                    'number.integer': 'La cantidad debe ser entera',
                    'number.positive': 'La cantidad debe ser positiva',
                    'number.max': 'La cantidad no puede exceder 999,999'
                }),
            
            descuento: Joi.number().precision(2).min(0).max(99.99).default(0)
                .messages({
                    'number.base': 'El descuento debe ser numérico',
                    'number.min': 'El descuento no puede ser negativo',
                    'number.max': 'El descuento no puede exceder 99.99%'
                }),
            
            tipo_descuento: Joi.string().valid('Porcentaje', 'Monto_Fijo').default('Porcentaje')
                .messages({
                    'any.only': 'Tipo de descuento debe ser: Porcentaje o Monto_Fijo'
                }),
            
            estado: Joi.string().valid(
                'Borrador', 'Pendiente', 'Aprobada', 'Rechazada', 
                'Facturada', 'En_Despacho', 'Entregada', 'Cancelada'
            ).default('Pendiente')
                .messages({
                    'any.only': 'Estado inválido. Estados válidos: Borrador, Pendiente, Aprobada, Rechazada, Facturada, En_Despacho, Entregada, Cancelada'
                }),
            
            fase_venta: Joi.string().valid(
                'Prospectación', 'Calificación', 'Propuesta', 
                'Negociación', 'Cierre', 'Post_Venta'
            ).default('Propuesta')
                .messages({
                    'any.only': 'Fase inválida. Fases válidas: Prospectación, Calificación, Propuesta, Negociación, Cierre, Post_Venta'
                }),
            
            fecha_estimada_cierre: Joi.date().greater('now').required()
                .messages({
                    'date.base': 'La fecha estimada debe ser válida',
                    'date.greater': 'La fecha estimada debe ser futura',
                    'any.required': 'La fecha estimada de cierre es obligatoria'
                }),
            
            probabilidad_cierre: Joi.number().integer().min(0).max(100).default(50)
                .messages({
                    'number.base': 'La probabilidad debe ser numérica',
                    'number.integer': 'La probabilidad debe ser entera',
                    'number.min': 'La probabilidad mínima es 0%',
                    'number.max': 'La probabilidad máxima es 100%'
                }),
            
            fuente_conversion: Joi.string().valid(
                'Manual', 'Seguimiento_Completado', 'Importación', 
                'API', 'Prospección_Directa'
            ).default('Manual'),
            
            observaciones: Joi.string().max(1000).allow('', null)
                .messages({
                    'string.max': 'Las observaciones no pueden exceder 1000 caracteres'
                }),
            
            metadata: Joi.object().default({})
                .messages({
                    'object.base': 'Los metadatos deben ser un objeto válido'
                }),
            
            // Validaciones condicionales para conversión automática
            seguimiento_origen_id: Joi.when('fuente_conversion', {
                is: 'Seguimiento_Completado',
                then: Joi.number().integer().positive().required(),
                otherwise: Joi.number().integer().positive().optional()
            }),
            
            // Configuración de comisiones
            configuracion_comision: Joi.object({
                tipo: Joi.string().valid('Porcentaje', 'Monto_Fijo').default('Porcentaje'),
                valor: Joi.number().precision(2).positive().required(),
                es_personalizada: Joi.boolean().default(false),
                observaciones_comision: Joi.string().max(500).allow('', null)
            }).optional()
        });
    }
    
    /**
     * Schema para actualizar venta
     */
    static get actualizarVentaSchema() {
        return Joi.object({
            producto_id: Joi.number().integer().positive(),
            valor_total: Joi.number().precision(2).positive().max(999999999.99),
            cantidad: Joi.number().integer().positive().max(999999),
            descuento: Joi.number().precision(2).min(0).max(99.99),
            tipo_descuento: Joi.string().valid('Porcentaje', 'Monto_Fijo'),
            fecha_estimada_cierre: Joi.date().greater('now'),
            probabilidad_cierre: Joi.number().integer().min(0).max(100),
            observaciones: Joi.string().max(1000).allow('', null),
            metadata: Joi.object(),
            
            // No se permite cambiar campos críticos
            prospecto_id: Joi.forbidden().error(new Error('No se puede cambiar el prospecto asociado')),
            asesor_id: Joi.forbidden().error(new Error('No se puede cambiar el asesor asignado')),
            fuente_conversion: Joi.forbidden().error(new Error('No se puede cambiar la fuente de conversión'))
        }).min(1).messages({
            'object.min': 'Debe proporcionar al menos un campo para actualizar'
        });
    }
    
    /**
     * Schema para cambio de estado
     */
    static get cambioEstadoSchema() {
        return Joi.object({
            nuevo_estado: Joi.string().valid(
                'Borrador', 'Pendiente', 'Aprobada', 'Rechazada', 
                'Facturada', 'En_Despacho', 'Entregada', 'Cancelada'
            ).required(),
            
            observaciones: Joi.string().max(500).required().messages({
                'any.required': 'Las observaciones son obligatorias para cambio de estado',
                'string.max': 'Las observaciones no pueden exceder 500 caracteres'
            }),
            
            // Validaciones específicas por estado
            datos_adicionales: Joi.when('nuevo_estado', {
                switch: [
                    {
                        is: 'Facturada',
                        then: Joi.object({
                            numero_factura: Joi.string().required(),
                            fecha_factura: Joi.date().max('now').required(),
                            metodo_pago: Joi.string().valid('Efectivo', 'Transferencia', 'Tarjeta', 'Cheque').required()
                        }).required()
                    },
                    {
                        is: 'En_Despacho',
                        then: Joi.object({
                            numero_guia: Joi.string().required(),
                            transportadora: Joi.string().required(),
                            fecha_despacho: Joi.date().max('now').required()
                        }).required()
                    },
                    {
                        is: 'Entregada',
                        then: Joi.object({
                            fecha_entrega: Joi.date().max('now').required(),
                            recibido_por: Joi.string().required(),
                            documento_recibido: Joi.string().optional()
                        }).required()
                    },
                    {
                        is: 'Rechazada',
                        then: Joi.object({
                            motivo_rechazo: Joi.string().valid(
                                'Precio', 'Producto', 'Competencia', 
                                'Presupuesto', 'Timing', 'Otro'
                            ).required(),
                            detalle_rechazo: Joi.string().max(500).required()
                        }).required()
                    }
                ],
                otherwise: Joi.object().optional()
            })
        });
    }
    
    /**
     * Schema para conversión de prospecto
     */
    static get conversionProspectoSchema() {
        return Joi.object({
            prospecto_id: Joi.number().integer().positive().required(),
            asesor_id: Joi.number().integer().positive().required(),
            producto_sugerido_id: Joi.number().integer().positive().optional(),
            valor_estimado: Joi.number().precision(2).positive().optional(),
            
            // Configuración de conversión
            crear_seguimientos_automaticos: Joi.boolean().default(true),
            probabilidad_inicial: Joi.number().integer().min(0).max(100).default(60),
            dias_para_cierre: Joi.number().integer().positive().max(365).default(30),
            
            observaciones_conversion: Joi.string().max(500).allow('', null),
            
            // Origen del seguimiento
            seguimiento_id: Joi.number().integer().positive().optional(),
            tipo_conversion: Joi.string().valid('Manual', 'Automatica').default('Manual')
        });
    }
    
    // ==========================================
    // MÉTODOS DE VALIDACIÓN EMPRESARIAL
    // ==========================================
    
    /**
     * Validar creación de venta
     */
    static async validarCreacion(data) {
        try {
            const validatedData = await this.crearVentaSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validaciones de negocio adicionales
            await this.validacionesNegocio(validatedData);
            
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
     * Validar actualización de venta
     */
    static async validarActualizacion(data, ventaActual) {
        try {
            const validatedData = await this.actualizarVentaSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validaciones de estado
            await this.validarCambiosPermitidos(validatedData, ventaActual);
            
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
    static async validarCambioEstado(data, ventaActual) {
        try {
            const validatedData = await this.cambioEstadoSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validar transición de estado permitida
            const transicionValida = this.validarTransicionEstado(
                ventaActual.estado, 
                validatedData.nuevo_estado
            );
            
            if (!transicionValida.permitida) {
                throw new Error(transicionValida.razon);
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
    
    // ==========================================
    // VALIDACIONES DE NEGOCIO EMPRESARIALES
    // ==========================================
    
    /**
     * Validaciones de negocio para nueva venta
     */
    static async validacionesNegocio(data) {
        const { query } = require('../../../config/database');
        
        // 1. Validar que el prospecto existe y está activo
        const [prospecto] = await query(
            'SELECT id, estado FROM prospectos WHERE id = ? AND estado = "Activo"', 
            [data.prospecto_id]
        );
        
        if (!prospecto) {
            throw new Error('El prospecto no existe o no está activo');
        }
        
        // 2. Validar que el asesor existe y está activo
        const [asesor] = await query(
            'SELECT id, estado, rol FROM usuarios WHERE id = ? AND estado = "Activo"', 
            [data.asesor_id]
        );
        
        if (!asesor) {
            throw new Error('El asesor no existe o no está activo');
        }
        
        if (!['Asesor', 'Vendedor', 'Supervisor'].includes(asesor.rol)) {
            throw new Error('El usuario no tiene permisos para realizar ventas');
        }
        
        // 3. Validar que el producto existe y está disponible
        const [producto] = await query(
            'SELECT id, estado, precio FROM productos WHERE id = ? AND estado = "Activo"', 
            [data.producto_id]
        );
        
        if (!producto) {
            throw new Error('El producto no existe o no está disponible');
        }
        
        // 4. Validar coherencia de precios (tolerancia del 10%)
        const precioEsperado = producto.precio * data.cantidad;
        const descuentoAplicado = data.tipo_descuento === 'Porcentaje' 
            ? (precioEsperado * data.descuento / 100)
            : data.descuento;
        const precioConDescuento = precioEsperado - descuentoAplicado;
        
        const diferencia = Math.abs(data.valor_total - precioConDescuento);
        const tolerancia = precioConDescuento * 0.10; // 10% de tolerancia
        
        if (diferencia > tolerancia) {
            throw new Error(`El valor total no coincide con el precio del producto. Esperado: $${precioConDescuento.toFixed(2)}, Recibido: $${data.valor_total}`);
        }
        
        // 5. Validar que no existe venta duplicada del mismo prospecto
        const ventaExistente = await query(
            'SELECT id FROM ventas WHERE prospecto_id = ? AND estado NOT IN ("Cancelada", "Rechazada")', 
            [data.prospecto_id]
        );
        
        if (ventaExistente.length > 0) {
            throw new Error('Ya existe una venta activa para este prospecto');
        }
        
        // 6. Validar límites de descuento por rol
        const limitesDescuento = {
            'Asesor': 15,
            'Vendedor': 10,
            'Supervisor': 25,
            'Gerente': 50
        };
        
        const limiteDescuento = limitesDescuento[asesor.rol] || 0;
        
        if (data.descuento > limiteDescuento) {
            throw new Error(`El descuento excede el límite permitido para el rol ${asesor.rol} (máximo ${limiteDescuento}%)`);
        }
        
        return true;
    }
    
    /**
     * Validar cambios permitidos según estado actual
     */
    static async validarCambiosPermitidos(cambios, ventaActual) {
        const estadosInmutables = ['Facturada', 'Entregada', 'Cancelada'];
        
        if (estadosInmutables.includes(ventaActual.estado)) {
            throw new Error(`No se pueden realizar cambios en ventas con estado ${ventaActual.estado}`);
        }
        
        // Validar cambios específicos por estado
        if (ventaActual.estado === 'Aprobada') {
            const camposRestringidos = ['valor_total', 'producto_id', 'descuento'];
            const camposModificados = Object.keys(cambios);
            
            const conflictos = camposModificados.filter(campo => 
                camposRestringidos.includes(campo)
            );
            
            if (conflictos.length > 0) {
                throw new Error(`Los campos ${conflictos.join(', ')} no pueden modificarse en ventas aprobadas`);
            }
        }
        
        return true;
    }
    
    /**
     * Validar transiciones de estado permitidas
     */
    static validarTransicionEstado(estadoActual, estadoNuevo) {
        const transicionesPermitidas = {
            'Borrador': ['Pendiente', 'Cancelada'],
            'Pendiente': ['Aprobada', 'Rechazada', 'Cancelada'],
            'Aprobada': ['Facturada', 'Cancelada'],
            'Rechazada': ['Pendiente'], // Solo si se revisa
            'Facturada': ['En_Despacho', 'Entregada'],
            'En_Despacho': ['Entregada', 'Facturada'], // Reversión por error
            'Entregada': [], // Estado final
            'Cancelada': [] // Estado final
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
    // HELPERS DE FORMATEO Y CÁLCULO
    // ==========================================
    
    /**
     * Calcular valor total con descuentos
     */
    static calcularValorTotal(precioUnitario, cantidad, descuento, tipoDescuento) {
        const subtotal = precioUnitario * cantidad;
        
        if (tipoDescuento === 'Porcentaje') {
            return subtotal - (subtotal * descuento / 100);
        } else {
            return subtotal - descuento;
        }
    }
    
    /**
     * Formatear datos para almacenamiento
     */
    static formatearParaBD(data) {
        return {
            ...data,
            valor_total: parseFloat(data.valor_total).toFixed(2),
            descuento: parseFloat(data.descuento || 0).toFixed(2),
            metadata: JSON.stringify(data.metadata || {}),
            configuracion_comision: data.configuracion_comision 
                ? JSON.stringify(data.configuracion_comision) 
                : null
        };
    }
    
    /**
     * Formatear datos para respuesta API
     */
    static formatearParaAPI(data) {
        return {
            ...data,
            valor_total: parseFloat(data.valor_total),
            descuento: parseFloat(data.descuento || 0),
            metadata: typeof data.metadata === 'string' 
                ? JSON.parse(data.metadata || '{}') 
                : data.metadata,
            configuracion_comision: data.configuracion_comision 
                ? (typeof data.configuracion_comision === 'string' 
                    ? JSON.parse(data.configuracion_comision) 
                    : data.configuracion_comision)
                : null
        };
    }
    
    /**
     * Generar código único de venta
     */
    static generarCodigoVenta(asesor_id, timestamp = Date.now()) {
        const fecha = new Date(timestamp);
        const año = fecha.getFullYear().toString().slice(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const asesorPad = asesor_id.toString().padStart(3, '0');
        const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
        
        return `VT${año}${mes}${asesorPad}${random}`;
    }
}

module.exports = VentaModel;