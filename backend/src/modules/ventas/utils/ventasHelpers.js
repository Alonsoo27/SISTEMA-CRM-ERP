// ============================================
// VENTAS HELPERS - UTILIDADES EMPRESARIALES
// Sistema CRM/ERP v2.0 - Módulo de Ventas
// ============================================

const moment = require('moment');
const numeral = require('numeral');

class VentasHelpers {
    // ============================================
    // FORMATEO Y PRESENTACIÓN
    // ============================================

    /**
     * Formatear moneda según configuración empresarial
     */
    static formatearMoneda(valor, moneda = 'PEN') {
        const formatters = {
            PEN: (val) => `S/ ${numeral(val).format('0,0.00')}`,
            USD: (val) => `$ ${numeral(val).format('0,0.00')}`,
            EUR: (val) => `€ ${numeral(val).format('0,0.00')}`
        };
        
        return formatters[moneda] ? formatters[moneda](valor) : `${moneda} ${numeral(valor).format('0,0.00')}`;
    }

    /**
     * Formatear números con separadores de miles
     */
    static formatearNumero(numero, decimales = 0) {
        return numeral(numero).format(`0,0.${'0'.repeat(decimales)}`);
    }

    /**
     * Formatear porcentajes empresariales
     */
    static formatearPorcentaje(valor, decimales = 1) {
        return `${numeral(valor / 100).format(`0.${'0'.repeat(decimales)}%`)}`;
    }

    /**
     * Formatear fechas según estándares empresariales
     */
    static formatearFecha(fecha, formato = 'DD/MM/YYYY') {
        return moment(fecha).format(formato);
    }

    /**
     * Formatear fecha y hora completa
     */
    static formatearFechaHora(fecha) {
        return moment(fecha).format('DD/MM/YYYY HH:mm:ss');
    }

    // ============================================
    // CÁLCULOS EMPRESARIALES
    // ============================================

    /**
     * Calcular descuento aplicado
     */
    static calcularDescuento(valorOriginal, valorConDescuento) {
        const descuento = valorOriginal - valorConDescuento;
        const porcentaje = (descuento / valorOriginal) * 100;
        
        return {
            montoDescuento: descuento,
            porcentajeDescuento: porcentaje,
            porcentajeFormateado: this.formatearPorcentaje(porcentaje),
            montoFormateado: this.formatearMoneda(descuento)
        };
    }

    /**
     * Calcular impuestos empresariales
     */
    static calcularImpuestos(subtotal, tipoImpuesto = 'IGV') {
        const tasas = {
            IGV: 0.18,
            IVA: 0.19,
            VAT: 0.20
        };
        
        const tasa = tasas[tipoImpuesto] || 0.18;
        const impuesto = subtotal * tasa;
        const total = subtotal + impuesto;
        
        return {
            subtotal: subtotal,
            tasa: tasa,
            impuesto: impuesto,
            total: total,
            subtotalFormateado: this.formatearMoneda(subtotal),
            impuestoFormateado: this.formatearMoneda(impuesto),
            totalFormateado: this.formatearMoneda(total)
        };
    }

    /**
     * Calcular totales de cotización/venta con descuentos e impuestos
     */
    static calcularTotalesVenta(items, descuentoGlobal = 0, tipoImpuesto = 'IGV') {
        const subtotalItems = items.reduce((acc, item) => {
            const subtotalItem = item.cantidad * item.precio_unitario;
            const descuentoItem = subtotalItem * (item.descuento_porcentaje / 100);
            return acc + (subtotalItem - descuentoItem);
        }, 0);
        
        const descuentoGlobalMonto = subtotalItems * (descuentoGlobal / 100);
        const subtotalConDescuento = subtotalItems - descuentoGlobalMonto;
        
        const impuestos = this.calcularImpuestos(subtotalConDescuento, tipoImpuesto);
        
        return {
            subtotalItems: subtotalItems,
            descuentoGlobal: descuentoGlobalMonto,
            subtotalConDescuento: subtotalConDescuento,
            impuesto: impuestos.impuesto,
            total: impuestos.total,
            // Formateados
            subtotalItemsFormateado: this.formatearMoneda(subtotalItems),
            descuentoGlobalFormateado: this.formatearMoneda(descuentoGlobalMonto),
            subtotalConDescuentoFormateado: this.formatearMoneda(subtotalConDescuento),
            impuestoFormateado: this.formatearMoneda(impuestos.impuesto),
            totalFormateado: this.formatearMoneda(impuestos.total)
        };
    }

    // ============================================
    // CÓDIGOS Y IDENTIFICADORES
    // ============================================

    /**
     * Generar código único de venta empresarial
     */
    static generarCodigoVenta(prefijo = 'VTA') {
        const fecha = moment().format('YYYYMMDD');
        const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        return `${prefijo}-${fecha}-${random}`;
    }

    /**
     * Generar código de cotización
     */
    static generarCodigoCotizacion(prefijo = 'COT') {
        const fecha = moment().format('YYYYMMDD');
        const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        return `${prefijo}-${fecha}-${random}`;
    }

    /**
     * Generar código de comisión
     */
    static generarCodigoComision(asesorId, periodo) {
        const fechaPeriodo = moment(periodo).format('YYYYMM');
        return `COM-${asesorId}-${fechaPeriodo}`;
    }

    // ============================================
    // VALIDACIONES DE NEGOCIO
    // ============================================

    /**
     * Validar si una venta está en plazo para modificaciones
     */
    static puedeModificarVenta(fechaCreacion, horasLimite = 24) {
        const fechaLimite = moment(fechaCreacion).add(horasLimite, 'hours');
        return moment().isBefore(fechaLimite);
    }

    /**
     * Validar si una cotización está vigente
     */
    static cotizacionVigente(fechaVencimiento) {
        return moment().isBefore(moment(fechaVencimiento));
    }

    /**
     * Calcular días hasta vencimiento
     */
    static diasHastaVencimiento(fechaVencimiento) {
        return moment(fechaVencimiento).diff(moment(), 'days');
    }

    // ============================================
    // ANÁLISIS Y MÉTRICAS
    // ============================================

    /**
     * Calcular tasa de conversión
     */
    static calcularTasaConversion(totalConvertidos, totalProspectos) {
        if (totalProspectos === 0) return 0;
        return (totalConvertidos / totalProspectos) * 100;
    }

    /**
     * Calcular crecimiento porcentual
     */
    static calcularCrecimiento(valorActual, valorAnterior) {
        if (valorAnterior === 0) return valorActual > 0 ? 100 : 0;
        return ((valorActual - valorAnterior) / valorAnterior) * 100;
    }

    /**
     * Calcular ticket promedio
     */
    static calcularTicketPromedio(ventas) {
        if (!ventas || ventas.length === 0) return 0;
        const totalVentas = ventas.reduce((acc, venta) => acc + venta.valor_total, 0);
        return totalVentas / ventas.length;
    }

    /**
     * Analizar distribución de ventas por rangos
     */
    static analizarDistribucionVentas(ventas) {
        const rangos = {
            '0-1000': 0,
            '1001-5000': 0,
            '5001-10000': 0,
            '10001-25000': 0,
            '25001+': 0
        };

        ventas.forEach(venta => {
            const valor = venta.valor_total;
            if (valor <= 1000) rangos['0-1000']++;
            else if (valor <= 5000) rangos['1001-5000']++;
            else if (valor <= 10000) rangos['5001-10000']++;
            else if (valor <= 25000) rangos['10001-25000']++;
            else rangos['25001+']++;
        });

        return rangos;
    }

    // ============================================
    // MANEJO DE ESTADOS
    // ============================================

    /**
     * Obtener siguiente estado válido en el pipeline
     */
    static obtenerSiguienteEstado(estadoActual) {
        const flujoEstados = {
            'Borrador': ['En_Negociacion', 'Cancelada'],
            'En_Negociacion': ['Cotizada', 'Cancelada'],
            'Cotizada': ['Aprobada', 'En_Negociacion', 'Cancelada'],
            'Aprobada': ['Facturada', 'Cancelada'],
            'Facturada': ['Entregada', 'Cancelada'],
            'Entregada': ['Completada'],
            'Completada': [],
            'Cancelada': []
        };

        return flujoEstados[estadoActual] || [];
    }

    /**
     * Obtener color del estado para UI
     */
    static obtenerColorEstado(estado) {
        const colores = {
            'Borrador': '#6c757d',
            'En_Negociacion': '#fd7e14',
            'Cotizada': '#0dcaf0',
            'Aprobada': '#198754',
            'Facturada': '#0d6efd',
            'Entregada': '#6f42c1',
            'Completada': '#20c997',
            'Cancelada': '#dc3545'
        };

        return colores[estado] || '#6c757d';
    }

    // ============================================
    // UTILIDADES DE TIEMPO
    // ============================================

    /**
     * Calcular tiempo transcurrido desde creación
     */
    static tiempoTranscurrido(fechaInicio) {
        const inicio = moment(fechaInicio);
        const ahora = moment();
        
        const dias = ahora.diff(inicio, 'days');
        const horas = ahora.diff(inicio, 'hours') % 24;
        const minutos = ahora.diff(inicio, 'minutes') % 60;

        if (dias > 0) return `${dias} día${dias > 1 ? 's' : ''} ${horas}h`;
        if (horas > 0) return `${horas} hora${horas > 1 ? 's' : ''} ${minutos}m`;
        return `${minutos} minuto${minutos > 1 ? 's' : ''}`;
    }

    /**
     * Obtener rango de fechas para reportes
     */
    static obtenerRangoFechas(periodo) {
        const hoy = moment();
        
        switch (periodo) {
            case 'hoy':
                return {
                    inicio: hoy.clone().startOf('day'),
                    fin: hoy.clone().endOf('day')
                };
            case 'semana':
                return {
                    inicio: hoy.clone().startOf('week'),
                    fin: hoy.clone().endOf('week')
                };
            case 'mes':
                return {
                    inicio: hoy.clone().startOf('month'),
                    fin: hoy.clone().endOf('month')
                };
            case 'trimestre':
                return {
                    inicio: hoy.clone().startOf('quarter'),
                    fin: hoy.clone().endOf('quarter')
                };
            case 'año':
                return {
                    inicio: hoy.clone().startOf('year'),
                    fin: hoy.clone().endOf('year')
                };
            default:
                return {
                    inicio: hoy.clone().startOf('month'),
                    fin: hoy.clone().endOf('month')
                };
        }
    }

    // ============================================
    // UTILIDADES DE ARRAY Y OBJETOS
    // ============================================

    /**
     * Agrupar ventas por criterio
     */
    static agruparVentasPor(ventas, criterio) {
        return ventas.reduce((grupos, venta) => {
            let clave;
            
            switch (criterio) {
                case 'mes':
                    clave = moment(venta.fecha_creacion).format('YYYY-MM');
                    break;
                case 'asesor':
                    clave = venta.asesor_id;
                    break;
                case 'estado':
                    clave = venta.estado;
                    break;
                case 'producto':
                    clave = venta.producto_principal || 'Sin producto';
                    break;
                default:
                    clave = 'general';
            }
            
            if (!grupos[clave]) grupos[clave] = [];
            grupos[clave].push(venta);
            
            return grupos;
        }, {});
    }

    /**
     * Ordenar array por múltiples criterios
     */
    static ordenarPorCriterios(array, criterios) {
        return array.sort((a, b) => {
            for (let criterio of criterios) {
                const { campo, orden = 'asc' } = criterio;
                const valorA = this.obtenerValorAnidado(a, campo);
                const valorB = this.obtenerValorAnidado(b, campo);
                
                let comparacion = 0;
                if (valorA > valorB) comparacion = 1;
                if (valorA < valorB) comparacion = -1;
                
                if (comparacion !== 0) {
                    return orden === 'desc' ? -comparacion : comparacion;
                }
            }
            return 0;
        });
    }

    /**
     * Obtener valor anidado de objeto (ej: 'usuario.nombre')
     */
    static obtenerValorAnidado(obj, ruta) {
        return ruta.split('.').reduce((current, key) => current && current[key], obj);
    }

    // ============================================
    // GENERACIÓN DE REPORTES
    // ============================================

    /**
     * Preparar datos para gráfico de barras
     */
    static prepararDatosGraficoBarras(datos, campoX, campoY) {
        return datos.map(item => ({
            x: this.obtenerValorAnidado(item, campoX),
            y: this.obtenerValorAnidado(item, campoY)
        }));
    }

    /**
     * Calcular estadísticas básicas de un array
     */
    static calcularEstadisticas(valores) {
        if (!valores || valores.length === 0) {
            return { min: 0, max: 0, promedio: 0, mediana: 0, total: 0 };
        }

        const ordenados = [...valores].sort((a, b) => a - b);
        const total = valores.reduce((sum, val) => sum + val, 0);
        
        return {
            min: ordenados[0],
            max: ordenados[ordenados.length - 1],
            promedio: total / valores.length,
            mediana: ordenados.length % 2 === 0 
                ? (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2
                : ordenados[Math.floor(ordenados.length / 2)],
            total: total
        };
    }

    // ============================================
    // UTILIDADES DE INTEGRACIÓN
    // ============================================

    /**
     * Sanitizar datos para API externa
     */
    static sanitizarParaAPI(datos, camposPermitidos) {
        const datosSanitizados = {};
        
        camposPermitidos.forEach(campo => {
            if (datos.hasOwnProperty(campo)) {
                datosSanitizados[campo] = datos[campo];
            }
        });
        
        return datosSanitizados;
    }

    /**
     * Convertir respuesta de API a formato interno
     */
    static convertirDesdeAPI(datosAPI, mapeosCampos) {
        const datosInternos = {};
        
        Object.keys(mapeosCampos).forEach(campoInterno => {
            const campoAPI = mapeosCampos[campoInterno];
            if (datosAPI.hasOwnProperty(campoAPI)) {
                datosInternos[campoInterno] = datosAPI[campoAPI];
            }
        });
        
        return datosInternos;
    }

    // ============================================
    // LOGGING Y DEBUGGING
    // ============================================

    /**
     * Formatear log de venta para auditoría
     */
    static formatearLogVenta(accion, ventaId, usuario, cambios = {}) {
        return {
            timestamp: moment().toISOString(),
            accion: accion,
            venta_id: ventaId,
            usuario_id: usuario.id,
            usuario_nombre: usuario.nombre,
            cambios: cambios,
            ip: usuario.ip || 'desconocida',
            user_agent: usuario.user_agent || 'desconocido'
        };
    }

    /**
     * Crear resumen ejecutivo de cambios
     */
    static crearResumenCambios(cambiosAnteriores, cambiosNuevos) {
        const resumen = [];
        
        Object.keys(cambiosNuevos).forEach(campo => {
            const valorAnterior = cambiosAnteriores[campo];
            const valorNuevo = cambiosNuevos[campo];
            
            if (valorAnterior !== valorNuevo) {
                resumen.push({
                    campo: campo,
                    valorAnterior: valorAnterior,
                    valorNuevo: valorNuevo,
                    tipo: this.determinarTipoCambio(valorAnterior, valorNuevo)
                });
            }
        });
        
        return resumen;
    }

    /**
     * Determinar tipo de cambio para auditoría
     */
    static determinarTipoCambio(valorAnterior, valorNuevo) {
        if (valorAnterior === null || valorAnterior === undefined) return 'creacion';
        if (valorNuevo === null || valorNuevo === undefined) return 'eliminacion';
        if (typeof valorAnterior === 'number' && typeof valorNuevo === 'number') {
            return valorNuevo > valorAnterior ? 'incremento' : 'decremento';
        }
        return 'modificacion';
    }
}

module.exports = VentasHelpers;