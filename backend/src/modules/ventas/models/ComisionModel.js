// ============================================
// COMISION MODEL - REGLAS Y VALIDACIONES EMPRESARIALES
// Sistema CRM/ERP v2.0 - Módulo de Comisiones
// ============================================

const Joi = require('joi');

class ComisionModel {
    
    // ==========================================
    // SCHEMAS DE VALIDACIÓN EMPRESARIAL
    // ==========================================
    
    /**
     * Schema para calcular comisión automática
     */
    static get calculoAutomaticoSchema() {
        return Joi.object({
            venta_id: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'El ID de la venta debe ser numérico',
                    'number.integer': 'El ID de la venta debe ser entero',
                    'number.positive': 'El ID de la venta debe ser positivo',
                    'any.required': 'La venta es obligatoria'
                }),
            
            forzar_recalculo: Joi.boolean().default(false)
                .messages({
                    'boolean.base': 'Forzar recálculo debe ser booleano'
                }),
            
            // Override manual de configuración
            configuracion_override: Joi.object({
                tipo_comision: Joi.string().valid('Porcentaje', 'Monto_Fijo', 'Escalada', 'Hibrida').optional(),
                valor_base: Joi.number().precision(2).positive().optional(),
                aplicar_descuentos: Joi.boolean().default(true),
                incluir_impuestos: Joi.boolean().default(false),
                observaciones_override: Joi.string().max(500).allow('', null)
            }).optional()
        });
    }
    
    /**
     * Schema para crear comisión manual
     */
    static get crearComisionSchema() {
        return Joi.object({
            venta_id: Joi.number().integer().positive().required()
                .messages({
                    'any.required': 'La venta es obligatoria'
                }),
            
            asesor_id: Joi.number().integer().positive().required()
                .messages({
                    'any.required': 'El asesor es obligatorio'
                }),
            
            tipo_comision: Joi.string().valid(
                'Porcentaje', 'Monto_Fijo', 'Escalada', 'Hibrida', 
                'Bonificacion', 'Penalizacion'
            ).required()
                .messages({
                    'any.only': 'Tipo de comisión inválido',
                    'any.required': 'El tipo de comisión es obligatorio'
                }),
            
            // Configuración de cálculo
            configuracion_calculo: Joi.object({
                valor_base: Joi.number().precision(2).positive().required()
                    .messages({
                        'any.required': 'El valor base es obligatorio',
                        'number.positive': 'El valor base debe ser positivo'
                    }),
                
                // Para tipo Porcentaje
                porcentaje: Joi.when('tipo_comision', {
                    is: Joi.valid('Porcentaje', 'Hibrida'),
                    then: Joi.number().precision(2).min(0).max(100).required(),
                    otherwise: Joi.number().precision(2).min(0).max(100).optional()
                }),
                
                // Para tipo Escalada
                escalas: Joi.when('tipo_comision', {
                    is: 'Escalada',
                    then: Joi.array().items(
                        Joi.object({
                            desde: Joi.number().precision(2).min(0).required(),
                            hasta: Joi.number().precision(2).positive().optional(),
                            porcentaje: Joi.number().precision(2).min(0).max(100).required()
                        })
                    ).min(1).required(),
                    otherwise: Joi.array().optional()
                }),
                
                // Para tipo Hibrida (porcentaje + monto fijo)
                monto_fijo_adicional: Joi.when('tipo_comision', {
                    is: 'Hibrida',
                    then: Joi.number().precision(2).min(0),
                    otherwise: Joi.number().precision(2).min(0).optional()
                }),
                
                // Modificadores
                aplicar_descuentos: Joi.boolean().default(true),
                incluir_impuestos: Joi.boolean().default(false),
                multiplicador: Joi.number().precision(2).positive().default(1),
                
                // Límites
                comision_minima: Joi.number().precision(2).min(0).optional(),
                comision_maxima: Joi.number().precision(2).positive().optional()
            }).required(),
            
            // Información adicional
            valor_venta_base: Joi.number().precision(2).positive().required(),
            valor_comision_calculado: Joi.number().precision(2).min(0).required(),
            
            periodo_comision: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
                .messages({
                    'string.pattern.base': 'El período debe tener formato YYYY-MM'
                }),
            
            estado: Joi.string().valid(
                'Calculada', 'Pendiente_Aprobacion', 'Aprobada', 
                'Rechazada', 'Pagada', 'Cancelada'
            ).default('Calculada'),
            
            // Metadatos y observaciones
            es_manual: Joi.boolean().default(false),
            requiere_aprobacion: Joi.boolean().default(false),
            observaciones: Joi.string().max(1000).allow('', null),
            metadata: Joi.object().default({}),
            
            // Para comisiones grupales o compartidas
            comision_compartida: Joi.object({
                es_compartida: Joi.boolean().default(false),
                asesores_adicionales: Joi.when('es_compartida', {
                    is: true,
                    then: Joi.array().items(
                        Joi.object({
                            asesor_id: Joi.number().integer().positive().required(),
                            porcentaje_participacion: Joi.number().precision(2).min(0).max(100).required()
                        })
                    ).min(1).required(),
                    otherwise: Joi.array().optional()
                })
            }).optional()
        });
    }
    
    /**
     * Schema para actualizar comisión
     */
    static get actualizarComisionSchema() {
        return Joi.object({
            configuracion_calculo: Joi.object({
                valor_base: Joi.number().precision(2).positive(),
                porcentaje: Joi.number().precision(2).min(0).max(100),
                aplicar_descuentos: Joi.boolean(),
                incluir_impuestos: Joi.boolean(),
                multiplicador: Joi.number().precision(2).positive(),
                comision_minima: Joi.number().precision(2).min(0),
                comision_maxima: Joi.number().precision(2).positive()
            }).optional(),
            
            observaciones: Joi.string().max(1000).allow('', null),
            metadata: Joi.object().optional(),
            
            // Campos que NO se pueden modificar
            venta_id: Joi.forbidden().error(new Error('No se puede cambiar la venta asociada')),
            asesor_id: Joi.forbidden().error(new Error('No se puede cambiar el asesor')),
            tipo_comision: Joi.forbidden().error(new Error('No se puede cambiar el tipo de comisión')),
            periodo_comision: Joi.forbidden().error(new Error('No se puede cambiar el período'))
        }).min(1).messages({
            'object.min': 'Debe proporcionar al menos un campo para actualizar'
        });
    }
    
    /**
     * Schema para cambio de estado de comisión
     */
    static get cambioEstadoSchema() {
        return Joi.object({
            nuevo_estado: Joi.string().valid(
                'Calculada', 'Pendiente_Aprobacion', 'Aprobada', 
                'Rechazada', 'Pagada', 'Cancelada'
            ).required(),
            
            observaciones: Joi.string().max(500).when('nuevo_estado', {
                switch: [
                    { is: Joi.valid('Rechazada', 'Cancelada'), then: Joi.required() },
                    { is: Joi.valid('Aprobada', 'Pagada'), then: Joi.optional() }
                ],
                otherwise: Joi.optional()
            }),
            
            // Datos específicos por estado
            datos_estado: Joi.when('nuevo_estado', {
                switch: [
                    {
                        is: 'Aprobada',
                        then: Joi.object({
                            aprobada_por: Joi.string().max(100),
                            fecha_aprobacion: Joi.date().max('now').default(new Date()),
                            valor_aprobado: Joi.number().precision(2).min(0),
                            observaciones_aprobacion: Joi.string().max(500).allow('', null)
                        }).optional()
                    },
                    {
                        is: 'Pagada',
                        then: Joi.object({
                            fecha_pago: Joi.date().max('now').required(),
                            metodo_pago: Joi.string().valid(
                                'Transferencia', 'Efectivo', 'Cheque', 'Nomina'
                            ).required(),
                            referencia_pago: Joi.string().max(100),
                            valor_pagado: Joi.number().precision(2).positive().required(),
                            observaciones_pago: Joi.string().max(500).allow('', null)
                        }).required()
                    },
                    {
                        is: 'Rechazada',
                        then: Joi.object({
                            motivo_rechazo: Joi.string().valid(
                                'Calculo_Incorrecto', 'Venta_Invalida', 'Politica_Comisiones',
                                'Documentacion_Faltante', 'Otro'
                            ).required(),
                            detalle_rechazo: Joi.string().max(500).required(),
                            requiere_recalculo: Joi.boolean().default(false)
                        }).required()
                    }
                ],
                otherwise: Joi.object().optional()
            })
        });
    }
    
    /**
     * Schema para configuración de reglas de comisión
     */
    static get configurarReglasSchema() {
        return Joi.object({
            nombre_regla: Joi.string().min(3).max(100).required(),
            descripcion: Joi.string().max(500).required(),
            
            // Criterios de aplicación
            criterios_aplicacion: Joi.object({
                roles_aplicables: Joi.array().items(
                    Joi.string().valid('Asesor', 'Vendedor', 'Supervisor', 'Gerente')
                ).min(1).required(),
                
                productos_aplicables: Joi.array().items(
                    Joi.number().integer().positive()
                ).optional(),
                
                clientes_aplicables: Joi.array().items(
                    Joi.number().integer().positive()
                ).optional(),
                
                valor_venta_minimo: Joi.number().precision(2).min(0).optional(),
                valor_venta_maximo: Joi.number().precision(2).positive().optional(),
                
                fecha_inicio: Joi.date().required(),
                fecha_fin: Joi.date().greater(Joi.ref('fecha_inicio')).optional()
            }).required(),
            
            // Configuración de cálculo
            configuracion_comision: Joi.object({
                tipo_base: Joi.string().valid(
                    'Valor_Bruto', 'Valor_Neto', 'Utilidad', 'Cantidad'
                ).required(),
                
                tipo_calculo: Joi.string().valid(
                    'Porcentaje_Fijo', 'Escalada', 'Tabla_Valores', 'Formula_Personalizada'
                ).required(),
                
                // Para porcentaje fijo
                porcentaje_fijo: Joi.when('tipo_calculo', {
                    is: 'Porcentaje_Fijo',
                    then: Joi.number().precision(2).min(0).max(100).required(),
                    otherwise: Joi.number().precision(2).min(0).max(100).optional()
                }),
                
                // Para escalada
                escalas_comision: Joi.when('tipo_calculo', {
                    is: 'Escalada',
                    then: Joi.array().items(
                        Joi.object({
                            desde: Joi.number().precision(2).min(0).required(),
                            hasta: Joi.number().precision(2).positive().optional(),
                            porcentaje: Joi.number().precision(2).min(0).max(100).required()
                        })
                    ).min(1).required(),
                    otherwise: Joi.array().optional()
                }),
                
                // Modificadores y límites
                modificadores: Joi.object({
                    incluir_descuentos: Joi.boolean().default(true),
                    incluir_impuestos: Joi.boolean().default(false),
                    multiplicador_rendimiento: Joi.number().precision(2).min(0).max(5).default(1),
                    comision_minima: Joi.number().precision(2).min(0).optional(),
                    comision_maxima: Joi.number().precision(2).positive().optional()
                }).optional()
            }).required(),
            
            // Configuración avanzada
            configuracion_avanzada: Joi.object({
                requiere_aprobacion: Joi.boolean().default(false),
                aprobadores: Joi.when('requiere_aprobacion', {
                    is: true,
                    then: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
                    otherwise: Joi.array().optional()
                }),
                
                frecuencia_pago: Joi.string().valid(
                    'Inmediato', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral'
                ).default('Mensual'),
                
                condiciones_pago: Joi.array().items(
                    Joi.string().valid(
                        'Venta_Facturada', 'Venta_Cobrada', 'Venta_Entregada', 
                        'Meta_Cumplida', 'Periodo_Completado'
                    )
                ).min(1).default(['Venta_Facturada']),
                
                permite_adelantos: Joi.boolean().default(false),
                porcentaje_adelanto_maximo: Joi.when('permite_adelantos', {
                    is: true,
                    then: Joi.number().precision(2).min(0).max(80).default(50),
                    otherwise: Joi.number().precision(2).min(0).optional()
                })
            }).optional(),
            
            estado: Joi.string().valid('Activa', 'Inactiva', 'Borrador').default('Borrador'),
            prioridad: Joi.number().integer().min(1).max(100).default(50)
        });
    }
    
    // ==========================================
    // MÉTODOS DE VALIDACIÓN EMPRESARIAL
    // ==========================================
    
    /**
     * Validar cálculo automático
     */
    static async validarCalculoAutomatico(data) {
        try {
            const validatedData = await this.calculoAutomaticoSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validaciones de negocio
            await this.validacionesNegocioCalculo(validatedData);
            
            return {
                success: true,
                data: validatedData
            };
            
        } catch (error) {
            return this.formatearErrorValidacion(error);
        }
    }
    
    /**
     * Validar creación de comisión
     */
    static async validarCreacion(data) {
        try {
            const validatedData = await this.crearComisionSchema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            // Validaciones de negocio
            await this.validacionesNegocioCreacion(validatedData);
            
            // Validar cálculo
            const calculoValidado = this.validarCalculoComision(validatedData);
            if (!calculoValidado.valido) {
                throw new Error(calculoValidado.error);
            }
            
            return {
                success: true,
                data: validatedData
            };
            
        } catch (error) {
            return this.formatearErrorValidacion(error);
        }
    }
    
    // ==========================================
    // VALIDACIONES DE NEGOCIO EMPRESARIALES
    // ==========================================
    
    /**
     * Validaciones de negocio para cálculo
     */
    static async validacionesNegocioCalculo(data) {
        const { query } = require('../../../config/database');
        
        // 1. Validar que la venta existe y está en estado facturable
        const [venta] = await query(`
            SELECT v.*, u.rol as asesor_rol
            FROM ventas v
            INNER JOIN usuarios u ON v.asesor_id = u.id
            WHERE v.id = ?
        `, [data.venta_id]);
        
        if (!venta) {
            throw new Error('La venta especificada no existe');
        }
        
        if (!['Facturada', 'Entregada'].includes(venta.estado)) {
            throw new Error('Solo se pueden calcular comisiones para ventas facturadas o entregadas');
        }
        
        // 2. Validar que no existe comisión ya calculada (a menos que se fuerce)
        if (!data.forzar_recalculo) {
            const comisionExistente = await query(
                'SELECT id FROM comisiones WHERE venta_id = ? AND estado != "Cancelada"',
                [data.venta_id]
            );
            
            if (comisionExistente.length > 0) {
                throw new Error('Ya existe una comisión calculada para esta venta. Use forzar_recalculo=true para recalcular');
            }
        }
        
        return { venta, asesor_rol: venta.asesor_rol };
    }
    
    /**
     * Validaciones de negocio para creación manual
     */
    static async validacionesNegocioCreacion(data) {
        const { query } = require('../../../config/database');
        
        // 1. Validar existencia de venta y asesor
        const [venta] = await query(
            'SELECT id, asesor_id, valor_total, estado FROM ventas WHERE id = ?',
            [data.venta_id]
        );
        
        if (!venta) {
            throw new Error('La venta especificada no existe');
        }
        
        const [asesor] = await query(
            'SELECT id, rol, estado FROM usuarios WHERE id = ?',
            [data.asesor_id]
        );
        
        if (!asesor) {
            throw new Error('El asesor especificado no existe');
        }
        
        if (asesor.estado !== 'Activo') {
            throw new Error('El asesor debe estar activo');
        }
        
        // 2. Validar que el asesor coincide con la venta o tiene permisos
        if (venta.asesor_id !== data.asesor_id && !['Supervisor', 'Gerente'].includes(asesor.rol)) {
            throw new Error('El asesor especificado no coincide con el asesor de la venta');
        }
        
        // 3. Validar coherencia de valores
        const diferencia = Math.abs(data.valor_venta_base - venta.valor_total);
        const tolerancia = venta.valor_total * 0.05; // 5% tolerancia
        
        if (diferencia > tolerancia) {
            throw new Error(`El valor base no coincide con el valor de la venta. Diferencia: $${diferencia.toFixed(2)}`);
        }
        
        return { venta, asesor };
    }
    
    /**
     * Validar cálculo de comisión
     */
    static validarCalculoComision(data) {
        const config = data.configuracion_calculo;
        
        try {
            let comisionCalculada = 0;
            
            switch (data.tipo_comision) {
                case 'Porcentaje':
                    if (!config.porcentaje) {
                        throw new Error('Porcentaje requerido para tipo Porcentaje');
                    }
                    comisionCalculada = (data.valor_venta_base * config.porcentaje) / 100;
                    break;
                    
                case 'Monto_Fijo':
                    comisionCalculada = config.valor_base;
                    break;
                    
                case 'Escalada':
                    if (!config.escalas || config.escalas.length === 0) {
                        throw new Error('Escalas requeridas para tipo Escalada');
                    }
                    comisionCalculada = this.calcularComisionEscalada(data.valor_venta_base, config.escalas);
                    break;
                    
                case 'Hibrida':
                    if (!config.porcentaje) {
                        throw new Error('Porcentaje requerido para tipo Hibrida');
                    }
                    const comisionPorcentaje = (data.valor_venta_base * config.porcentaje) / 100;
                    const montoFijo = config.monto_fijo_adicional || 0;
                    comisionCalculada = comisionPorcentaje + montoFijo;
                    break;
                    
                default:
                    throw new Error(`Tipo de comisión ${data.tipo_comision} no soportado`);
            }
            
            // Aplicar multiplicador
            comisionCalculada *= (config.multiplicador || 1);
            
            // Aplicar límites
            if (config.comision_minima && comisionCalculada < config.comision_minima) {
                comisionCalculada = config.comision_minima;
            }
            
            if (config.comision_maxima && comisionCalculada > config.comision_maxima) {
                comisionCalculada = config.comision_maxima;
            }
            
            // Validar que el cálculo coincide
            const diferencia = Math.abs(data.valor_comision_calculado - comisionCalculada);
            
            if (diferencia > 0.01) { // Tolerancia de 1 centavo
                return {
                    valido: false,
                    error: `Cálculo incorrecto. Esperado: $${comisionCalculada.toFixed(2)}, Recibido: $${data.valor_comision_calculado}`
                };
            }
            
            return { valido: true, valor_calculado: comisionCalculada };
            
        } catch (error) {
            return { valido: false, error: error.message };
        }
    }
    
    /**
     * Validar transiciones de estado
     */
    static validarTransicionEstado(estadoActual, estadoNuevo) {
        const transicionesPermitidas = {
            'Calculada': ['Pendiente_Aprobacion', 'Aprobada', 'Cancelada'],
            'Pendiente_Aprobacion': ['Aprobada', 'Rechazada', 'Cancelada'],
            'Aprobada': ['Pagada', 'Cancelada'],
            'Rechazada': ['Calculada'], // Puede recalcularse
            'Pagada': [], // Estado final
            'Cancelada': ['Calculada'] // Puede reactivarse
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
    // CÁLCULOS Y ALGORITMOS EMPRESARIALES
    // ==========================================
    
    /**
     * Calcular comisión escalada
     */
    static calcularComisionEscalada(valorBase, escalas) {
        let comisionTotal = 0;
        let valorRestante = valorBase;
        
        // Ordenar escalas por valor 'desde'
        const escalasOrdenadas = escalas.sort((a, b) => a.desde - b.desde);
        
        for (const escala of escalasOrdenadas) {
            if (valorRestante <= 0) break;
            
            const limiteInferior = escala.desde;
            const limiteSuperior = escala.hasta || Infinity;
            
            if (valorBase <= limiteInferior) continue;
            
            const valorEnEscala = Math.min(
                valorRestante,
                limiteSuperior - Math.max(limiteInferior, valorBase - valorRestante)
            );
            
            const comisionEscala = (valorEnEscala * escala.porcentaje) / 100;
            comisionTotal += comisionEscala;
            
            valorRestante -= valorEnEscala;
        }
        
        return comisionTotal;
    }
    
    /**
     * Obtener reglas aplicables para un asesor/venta
     */
    static async obtenerReglasAplicables(asesor_id, venta_data) {
        const { query } = require('../../../config/database');
        
        const [asesor] = await query(
            'SELECT rol FROM usuarios WHERE id = ?',
            [asesor_id]
        );
        
        if (!asesor) {
            throw new Error('Asesor no encontrado');
        }
        
        // Buscar reglas aplicables
        const reglas = await query(`
            SELECT r.*, rc.configuracion_comision
            FROM reglas_comisiones r
            INNER JOIN JSON_EXTRACT(r.criterios_aplicacion, '$.roles_aplicables') rc
            WHERE r.estado = 'Activa'
            AND JSON_CONTAINS(r.criterios_aplicacion->>'$.roles_aplicables', ?)
            AND (r.criterios_aplicacion->>'$.valor_venta_minimo' IS NULL 
                 OR ? >= CAST(r.criterios_aplicacion->>'$.valor_venta_minimo' AS DECIMAL))
            AND (r.criterios_aplicacion->>'$.valor_venta_maximo' IS NULL 
                 OR ? <= CAST(r.criterios_aplicacion->>'$.valor_venta_maximo' AS DECIMAL))
            AND r.criterios_aplicacion->>'$.fecha_inicio' <= CURDATE()
            AND (r.criterios_aplicacion->>'$.fecha_fin' IS NULL 
                 OR r.criterios_aplicacion->>'$.fecha_fin' >= CURDATE())
            ORDER BY r.prioridad DESC
            LIMIT 1
        `, [JSON.stringify(asesor.rol), venta_data.valor_total, venta_data.valor_total]);
        
        return reglas[0] || null;
    }
    
    /**
     * Calcular comisión automática según reglas
     */
    static async calcularComisionAutomatica(venta_id, configuracion_override = null) {
        const { query } = require('../../../config/database');
        
        // Obtener datos de la venta
        const [venta] = await query(`
            SELECT v.*, u.rol as asesor_rol
            FROM ventas v
            INNER JOIN usuarios u ON v.asesor_id = u.id
            WHERE v.id = ?
        `, [venta_id]);
        
        if (!venta) {
            throw new Error('Venta no encontrada');
        }
        
        // Obtener reglas aplicables
        const regla = await this.obtenerReglasAplicables(venta.asesor_id, venta);
        
        if (!regla && !configuracion_override) {
            throw new Error('No se encontraron reglas de comisión aplicables');
        }
        
        // Usar configuración override o regla
        const config = configuracion_override || JSON.parse(regla.configuracion_comision);
        
        // Calcular valor base según tipo
        let valorBase = venta.valor_total;
        
        if (config.tipo_base === 'Valor_Neto') {
            valorBase = venta.valor_total - (venta.descuento || 0);
        }
        
        if (!config.incluir_impuestos) {
            valorBase = valorBase / 1.19; // Asumir IVA 19% Colombia
        }
        
        // Calcular comisión según tipo
        let valorComision = 0;
        
        switch (config.tipo_calculo) {
            case 'Porcentaje_Fijo':
                valorComision = (valorBase * config.porcentaje_fijo) / 100;
                break;
                
            case 'Escalada':
                valorComision = this.calcularComisionEscalada(valorBase, config.escalas_comision);
                break;
                
            default:
                throw new Error(`Tipo de cálculo ${config.tipo_calculo} no implementado`);
        }
        
        // Aplicar modificadores
        if (config.modificadores) {
            valorComision *= (config.modificadores.multiplicador_rendimiento || 1);
            
            if (config.modificadores.comision_minima && valorComision < config.modificadores.comision_minima) {
                valorComision = config.modificadores.comision_minima;
            }
            
            if (config.modificadores.comision_maxima && valorComision > config.modificadores.comision_maxima) {
                valorComision = config.modificadores.comision_maxima;
            }
        }
        
        return {
            valor_comision: parseFloat(valorComision.toFixed(2)),
            valor_base: parseFloat(valorBase.toFixed(2)),
            regla_aplicada: regla?.id || null,
            configuracion_usada: config
        };
    }
    
    // ==========================================
    // HELPERS Y UTILIDADES
    // ==========================================
    
    /**
     * Formatear error de validación
     */
    static formatearErrorValidacion(error) {
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
    
    /**
     * Generar código único de comisión
     */
    static generarCodigoComision(asesor_id, venta_id, timestamp = Date.now()) {
        const fecha = new Date(timestamp);
        const año = fecha.getFullYear().toString().slice(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const asesorPad = asesor_id.toString().padStart(3, '0');
        const ventaPad = venta_id.toString().padStart(4, '0');
        
        return `COM${año}${mes}${asesorPad}${ventaPad}`;
    }
    
    /**
     * Formatear datos para almacenamiento
     */
    static formatearParaBD(data) {
        return {
            ...data,
            configuracion_calculo: JSON.stringify(data.configuracion_calculo || {}),
            metadata: JSON.stringify(data.metadata || {}),
            comision_compartida: data.comision_compartida 
                ? JSON.stringify(data.comision_compartida) 
                : null
        };
    }
    
    /**
     * Formatear datos para respuesta API
     */
    static formatearParaAPI(data) {
        return {
            ...data,
            configuracion_calculo: typeof data.configuracion_calculo === 'string' 
                ? JSON.parse(data.configuracion_calculo) 
                : data.configuracion_calculo,
            metadata: data.metadata 
                ? (typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata)
                : {},
            comision_compartida: data.comision_compartida 
                ? (typeof data.comision_compartida === 'string' 
                    ? JSON.parse(data.comision_compartida) 
                    : data.comision_compartida)
                : null
        };
    }
    
    /**
     * Obtener período de comisión actual
     */
    static obtenerPeriodoActual() {
        const fecha = new Date();
        const año = fecha.getFullYear();
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        return `${año}-${mes}`;
    }
    
    /**
     * Validar período de comisión
     */
    static validarPeriodo(periodo) {
        const regex = /^\d{4}-\d{2}$/;
        if (!regex.test(periodo)) {
            return false;
        }
        
        const [año, mes] = periodo.split('-').map(Number);
        
        if (año < 2020 || año > 2050) return false;
        if (mes < 1 || mes > 12) return false;
        
        return true;
    }
}

module.exports = ComisionModel;