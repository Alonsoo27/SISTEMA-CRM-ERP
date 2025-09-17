// ============================================
// VENTAS VALIDATORS - VALIDACIONES EMPRESARIALES CENTRALIZADAS
// Sistema CRM/ERP v2.0 - Módulo de Ventas
// ============================================

const Joi = require('joi');
const { query } = require('../../../config/database');

class VentasValidators {

    // ==========================================
    // SCHEMAS DE VALIDACIÓN PRINCIPALES
    // ==========================================
    
    static get crearVentaSchema() {
        return Joi.object({
            prospecto_id: Joi.number().integer().positive().optional(),
            asesor_id: Joi.number().integer().positive().required(),
            producto_id: Joi.number().integer().positive().required(),
            cliente_nombre: Joi.string().min(3).max(100).pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).required(),
            cliente_telefono: Joi.string().pattern(/^[\d\s\-\+\(\)]{7,15}$/).required(),
            cliente_email: Joi.string().email().max(100).required(),
            cliente_direccion: Joi.string().min(10).max(200).required(),
            valor_producto: Joi.number().positive().precision(2).required(),
            descuento: Joi.number().min(0).max(100).precision(2).default(0),
            valor_total: Joi.number().positive().precision(2).required(),
            margen_ganancia: Joi.number().min(0).max(100).precision(2).required(),
            estado: Joi.string().valid('Prospecto', 'Contactado', 'Interesado', 'Cotizado', 'Negociacion', 'Aprobada', 'Facturada', 'Entregada', 'Cancelada').default('Prospecto'),
            observaciones: Joi.string().max(500).optional(),
            fecha_estimada_cierre: Joi.date().greater('now').optional(),
            canal_venta: Joi.string().valid('Directo', 'Telefono', 'Email', 'WhatsApp', 'Web', 'Referido').default('Directo'),
            origen_lead: Joi.string().max(50).optional()
        }).custom((value, helpers) => {
            // Validación custom: valor_total debe ser coherente con valor_producto y descuento
            const esperado = value.valor_producto * (1 - value.descuento / 100);
            const tolerancia = esperado * 0.01; // 1% de tolerancia
            
            if (Math.abs(value.valor_total - esperado) > tolerancia) {
                return helpers.error('any.custom', {
                    message: 'El valor total no es coherente con el valor del producto y descuento aplicado'
                });
            }
            
            return value;
        });
    }
    
    static get actualizarVentaSchema() {
        return Joi.object({
            cliente_nombre: Joi.string().min(3).max(100).pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).optional(),
            cliente_telefono: Joi.string().pattern(/^[\d\s\-\+\(\)]{7,15}$/).optional(),
            cliente_email: Joi.string().email().max(100).optional(),
            cliente_direccion: Joi.string().min(10).max(200).optional(),
            valor_producto: Joi.number().positive().precision(2).optional(),
            descuento: Joi.number().min(0).max(100).precision(2).optional(),
            valor_total: Joi.number().positive().precision(2).optional(),
            margen_ganancia: Joi.number().min(0).max(100).precision(2).optional(),
            observaciones: Joi.string().max(500).optional(),
            fecha_estimada_cierre: Joi.date().greater('now').optional(),
            canal_venta: Joi.string().valid('Directo', 'Telefono', 'Email', 'WhatsApp', 'Web', 'Referido').optional()
        }).min(1);
    }
    
    static get cambioEstadoSchema() {
        return Joi.object({
            estado_nuevo: Joi.string().valid('Prospecto', 'Contactado', 'Interesado', 'Cotizado', 'Negociacion', 'Aprobada', 'Facturada', 'Entregada', 'Cancelada').required(),
            observaciones: Joi.string().max(500).optional(),
            fecha_cierre: Joi.date().optional(),
            motivo_cancelacion: Joi.when('estado_nuevo', {
                is: 'Cancelada',
                then: Joi.string().min(10).max(200).required(),
                otherwise: Joi.optional()
            }),
            datos_facturacion: Joi.when('estado_nuevo', {
                is: 'Facturada',
                then: Joi.object({
                    numero_factura: Joi.string().required(),
                    fecha_factura: Joi.date().required(),
                    metodo_pago: Joi.string().required()
                }).required(),
                otherwise: Joi.optional()
            })
        });
    }
    
    static get conversionProspectoSchema() {
        return Joi.object({
            prospecto_id: Joi.number().integer().positive().required(),
            seguimiento_id: Joi.number().integer().positive().optional(),
            valor_estimado: Joi.number().positive().precision(2).required(),
            producto_id: Joi.number().integer().positive().required(),
            descuento: Joi.number().min(0).max(50).precision(2).default(0),
            observaciones: Joi.string().max(500).optional(),
            fecha_estimada_cierre: Joi.date().greater('now').optional()
        });
    }
    
    static get cotizacionSchema() {
        return Joi.object({
            venta_id: Joi.number().integer().positive().required(),
            items: Joi.array().items(
                Joi.object({
                    producto_id: Joi.number().integer().positive().required(),
                    cantidad: Joi.number().integer().positive().required(),
                    precio_unitario: Joi.number().positive().precision(2).required(),
                    descuento: Joi.number().min(0).max(100).precision(2).default(0)
                })
            ).min(1).required(),
            condiciones_comerciales: Joi.object({
                plazo_entrega: Joi.string().max(100).required(),
                forma_pago: Joi.string().max(100).required(),
                validez_oferta: Joi.number().integer().min(1).max(90).required(),
                garantia: Joi.string().max(200).optional(),
                incluye_instalacion: Joi.boolean().default(false),
                notas_adicionales: Joi.string().max(500).optional()
            }).required(),
            descuento_general: Joi.number().min(0).max(30).precision(2).default(0),
            impuestos: Joi.number().min(0).max(50).precision(2).default(19),
            observaciones: Joi.string().max(500).optional()
        });
    }
    
    static get metaSchema() {
        return Joi.object({
            asesor_id: Joi.number().integer().positive().required(),
            tipo_meta: Joi.string().valid('Ventas_Cantidad', 'Ventas_Valor', 'Conversion_Rate', 'Nuevos_Clientes').required(),
            valor_objetivo: Joi.number().positive().precision(2).required(),
            fecha_inicio: Joi.date().required(),
            fecha_fin: Joi.date().greater(Joi.ref('fecha_inicio')).required(),
            frecuencia: Joi.string().valid('Mensual', 'Trimestral', 'Semestral', 'Anual').default('Mensual'),
            descripcion: Joi.string().max(200).optional(),
            es_grupal: Joi.boolean().default(false),
            miembros_grupo: Joi.when('es_grupal', {
                is: true,
                then: Joi.array().items(Joi.number().integer().positive()).min(2).required(),
                otherwise: Joi.optional()
            })
        });
    }

    // ==========================================
    // VALIDACIONES DE NEGOCIO ESPECÍFICAS
    // ==========================================
    
    static async validarVentaCreacion(datos, usuario) {
        try {
            // 1. Validación de schema
            const { error, value } = this.crearVentaSchema.validate(datos);
            if (error) {
                return {
                    valido: false,
                    errores: error.details.map(d => d.message)
                };
            }
            
            // 2. Validar existencia de entidades relacionadas
            const validacionEntidades = await this._validarEntidadesRelacionadas(value);
            if (!validacionEntidades.valido) {
                return validacionEntidades;
            }
            
            // 3. Validar permisos del usuario
            const validacionPermisos = await this._validarPermisosVenta(value, usuario);
            if (!validacionPermisos.valido) {
                return validacionPermisos;
            }
            
            // 4. Validar reglas de negocio específicas
            const validacionNegocio = await this._validarReglasNegocioVenta(value, usuario);
            if (!validacionNegocio.valido) {
                return validacionNegocio;
            }
            
            // 5. Validar duplicados
            const validacionDuplicados = await this._validarVentaDuplicada(value);
            if (!validacionDuplicados.valido) {
                return validacionDuplicados;
            }
            
            return {
                valido: true,
                datos_validados: value
            };
            
        } catch (error) {
            console.error('Error en validación de venta:', error);
            return {
                valido: false,
                errores: ['Error interno en validación']
            };
        }
    }
    
    static async validarCambioEstado(venta_id, estado_nuevo, datos_adicionales, usuario) {
        try {
            // 1. Validar venta existente
            const [venta] = await query.execute(
                'SELECT * FROM ventas WHERE id = ? AND eliminado = false',
                [venta_id]
            );
            
            if (!venta.length) {
                return {
                    valido: false,
                    errores: ['Venta no encontrada']
                };
            }
            
            const ventaActual = venta[0];
            
            // 2. Validar transición de estado permitida
            const transicionValida = this._validarTransicionEstado(ventaActual.estado, estado_nuevo);
            if (!transicionValida.valido) {
                return transicionValida;
            }
            
            // 3. Validar permisos específicos para el cambio
            const permisosCambio = await this._validarPermisosCambioEstado(ventaActual, estado_nuevo, usuario);
            if (!permisosCambio.valido) {
                return permisosCambio;
            }
            
            // 4. Validar datos específicos del estado
            const validacionDatosEstado = await this._validarDatosEspecificosEstado(estado_nuevo, datos_adicionales);
            if (!validacionDatosEstado.valido) {
                return validacionDatosEstado;
            }
            
            return {
                valido: true,
                venta_actual: ventaActual
            };
            
        } catch (error) {
            console.error('Error validando cambio de estado:', error);
            return {
                valido: false,
                errores: ['Error interno en validación']
            };
        }
    }
    
    static async validarConversionProspecto(prospecto_id, datos_conversion) {
        try {
            // 1. Validar prospecto existente y elegible
            const [prospecto] = await query.execute(
                `SELECT p.*, s.resultado as ultimo_resultado
                 FROM prospectos p
                 LEFT JOIN seguimientos s ON p.id = s.prospecto_id
                 WHERE p.id = ? AND p.eliminado = false
                 ORDER BY s.fecha_seguimiento DESC
                 LIMIT 1`,
                [prospecto_id]
            );
            
            if (!prospecto.length) {
                return {
                    valido: false,
                    errores: ['Prospecto no encontrado']
                };
            }
            
            const prospectoData = prospecto[0];
            
            // 2. Validar que el prospecto no esté ya convertido
            const [ventaExistente] = await query.execute(
                'SELECT id FROM ventas WHERE prospecto_id = ? AND eliminado = false',
                [prospecto_id]
            );
            
            if (ventaExistente.length > 0) {
                return {
                    valido: false,
                    errores: ['El prospecto ya fue convertido a venta']
                };
            }
            
            // 3. Validar que el prospecto esté en estado convertible
            const estadosConvertibles = ['Interesado', 'Calificado', 'Negociacion'];
            if (!estadosConvertibles.includes(prospectoData.estado)) {
                return {
                    valido: false,
                    errores: [`El prospecto debe estar en estado: ${estadosConvertibles.join(', ')}`]
                };
            }
            
            // 4. Validar datos de conversión
            const { error, value } = this.conversionProspectoSchema.validate(datos_conversion);
            if (error) {
                return {
                    valido: false,
                    errores: error.details.map(d => d.message)
                };
            }
            
            return {
                valido: true,
                prospecto: prospectoData,
                datos_validados: value
            };
            
        } catch (error) {
            console.error('Error validando conversión de prospecto:', error);
            return {
                valido: false,
                errores: ['Error interno en validación']
            };
        }
    }
    
    static async validarCotizacion(datos_cotizacion) {
        try {
            // 1. Validación de schema
            const { error, value } = this.cotizacionSchema.validate(datos_cotizacion);
            if (error) {
                return {
                    valido: false,
                    errores: error.details.map(d => d.message)
                };
            }
            
            // 2. Validar venta asociada
            const [venta] = await query.execute(
                'SELECT * FROM ventas WHERE id = ? AND eliminado = false',
                [value.venta_id]
            );
            
            if (!venta.length) {
                return {
                    valido: false,
                    errores: ['Venta no encontrada']
                };
            }
            
            // 3. Validar que la venta esté en estado cotizable
            const estadosCotizables = ['Interesado', 'Cotizado', 'Negociacion'];
            if (!estadosCotizables.includes(venta[0].estado)) {
                return {
                    valido: false,
                    errores: ['La venta debe estar en estado Interesado, Cotizado o Negociación']
                };
            }
            
            // 4. Validar productos en items
            const validacionProductos = await this._validarProductosCotizacion(value.items);
            if (!validacionProductos.valido) {
                return validacionProductos;
            }
            
            // 5. Validar límites de cotizaciones por venta
            const [cantidadCotizaciones] = await query.execute(
                'SELECT COUNT(*) as total FROM cotizaciones WHERE venta_id = ? AND eliminado = false',
                [value.venta_id]
            );
            
            if (cantidadCotizaciones[0].total >= 5) {
                return {
                    valido: false,
                    errores: ['Máximo de 5 cotizaciones por venta alcanzado']
                };
            }
            
            return {
                valido: true,
                datos_validados: value,
                venta: venta[0]
            };
            
        } catch (error) {
            console.error('Error validando cotización:', error);
            return {
                valido: false,
                errores: ['Error interno en validación']
            };
        }
    }

    // ==========================================
    // VALIDACIONES AUXILIARES PRIVADAS
    // ==========================================
    
    static async _validarEntidadesRelacionadas(datos) {
        try {
            const errores = [];
            
            // Validar asesor
            const [asesor] = await query.execute(
                'SELECT id, activo FROM usuarios WHERE id = ? AND rol IN ("Asesor", "Supervisor", "Gerente")',
                [datos.asesor_id]
            );
            
            if (!asesor.length) {
                errores.push('Asesor no encontrado o sin permisos');
            } else if (!asesor[0].activo) {
                errores.push('El asesor está inactivo');
            }
            
            // Validar producto
            const [producto] = await query.execute(
                'SELECT id, activo, precio_base FROM productos WHERE id = ?',
                [datos.producto_id]
            );
            
            if (!producto.length) {
                errores.push('Producto no encontrado');
            } else if (!producto[0].activo) {
                errores.push('El producto está inactivo');
            }
            
            // Validar prospecto si existe
            if (datos.prospecto_id) {
                const [prospecto] = await query.execute(
                    'SELECT id, estado FROM prospectos WHERE id = ? AND eliminado = false',
                    [datos.prospecto_id]
                );
                
                if (!prospecto.length) {
                    errores.push('Prospecto no encontrado');
                }
            }
            
            return {
                valido: errores.length === 0,
                errores: errores
            };
            
        } catch (error) {
            return {
                valido: false,
                errores: ['Error validando entidades relacionadas']
            };
        }
    }
    
    static async _validarPermisosVenta(datos, usuario) {
        try {
            // Validar que el usuario puede crear ventas para el asesor especificado
            if (datos.asesor_id !== usuario.id && !['Supervisor', 'Gerente', 'Admin'].includes(usuario.rol)) {
                return {
                    valido: false,
                    errores: ['No tiene permisos para crear ventas para otro asesor']
                };
            }
            
            // Validar límites de descuento según rol
            const limitesDescuento = {
                'Asesor': 15,
                'Supervisor': 25,
                'Gerente': 40,
                'Admin': 100
            };
            
            const limiteUsuario = limitesDescuento[usuario.rol] || 0;
            if (datos.descuento > limiteUsuario) {
                return {
                    valido: false,
                    errores: [`Descuento máximo permitido para su rol: ${limiteUsuario}%`]
                };
            }
            
            return { valido: true };
            
        } catch (error) {
            return {
                valido: false,
                errores: ['Error validando permisos']
            };
        }
    }
    
    static async _validarReglasNegocioVenta(datos, usuario) {
        try {
            const errores = [];
            
            // Validar valor mínimo de venta
            if (datos.valor_total < 50000) {
                errores.push('El valor mínimo de venta es $50,000');
            }
            
            // Validar margen mínimo
            if (datos.margen_ganancia < 10) {
                errores.push('El margen mínimo de ganancia es 10%');
            }
            
            // Validar coherencia de fechas
            if (datos.fecha_estimada_cierre) {
                const diasDiferencia = Math.ceil((new Date(datos.fecha_estimada_cierre) - new Date()) / (1000 * 60 * 60 * 24));
                if (diasDiferencia > 365) {
                    errores.push('La fecha de cierre no puede ser mayor a 1 año');
                }
            }
            
            return {
                valido: errores.length === 0,
                errores: errores
            };
            
        } catch (error) {
            return {
                valido: false,
                errores: ['Error validando reglas de negocio']
            };
        }
    }
    
    static async _validarVentaDuplicada(datos) {
        try {
            // Buscar ventas similares en las últimas 24 horas
            const [ventasSimilares] = await query.execute(
                `SELECT id FROM ventas 
                 WHERE cliente_email = ? 
                   AND producto_id = ? 
                   AND fecha_creacion >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                   AND eliminado = false`,
                [datos.cliente_email, datos.producto_id]
            );
            
            if (ventasSimilares.length > 0) {
                return {
                    valido: false,
                    errores: ['Posible venta duplicada: mismo cliente y producto en las últimas 24 horas']
                };
            }
            
            return { valido: true };
            
        } catch (error) {
            return {
                valido: false,
                errores: ['Error validando duplicados']
            };
        }
    }
    
    static _validarTransicionEstado(estado_actual, estado_nuevo) {
        const transicionesPermitidas = {
            'Prospecto': ['Contactado', 'Cancelada'],
            'Contactado': ['Interesado', 'Cancelada'],
            'Interesado': ['Cotizado', 'Cancelada'],
            'Cotizado': ['Negociacion', 'Cancelada'],
            'Negociacion': ['Aprobada', 'Cancelada'],
            'Aprobada': ['Facturada', 'Cancelada'],
            'Facturada': ['Entregada'],
            'Entregada': [],
            'Cancelada': []
        };
        
        const transicionesValidas = transicionesPermitidas[estado_actual] || [];
        
        if (!transicionesValidas.includes(estado_nuevo)) {
            return {
                valido: false,
                errores: [`No se puede cambiar de ${estado_actual} a ${estado_nuevo}`]
            };
        }
        
        return { valido: true };
    }
    
    static async _validarPermisosCategoria(categoria, usuario) {
        // Validar si el usuario puede vender productos de cierta categoría
        const categoriasRestringidas = ['Premium', 'Corporativo'];
        
        if (categoriasRestringidas.includes(categoria) && !['Supervisor', 'Gerente', 'Admin'].includes(usuario.rol)) {
            return {
                valido: false,
                errores: [`No tiene permisos para vender productos de categoría ${categoria}`]
            };
        }
        
        return { valido: true };
    }
}

module.exports = VentasValidators;