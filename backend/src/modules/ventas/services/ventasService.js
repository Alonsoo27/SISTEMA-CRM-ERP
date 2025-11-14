// ============================================
// VENTAS SERVICE - LÓGICA DE NEGOCIO EMPRESARIAL
// Sistema CRM/ERP v2.0 - VERSIÓN ENTERPRISE
// ============================================

const { query } = require('../../../config/database');

// ============================================
// LOGGING EMPRESARIAL
// ============================================
const logOperation = (methodName, params = {}) => {
    console.log(`\n=== VENTAS SERVICE: ${methodName} ===`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Params:', params);
    console.log('===================================\n');
};


// ============================================
// PROCESAR CAMBIO DE ESTADO - VERSIÓN ENTERPRISE
// ============================================
exports.procesarCambioEstado = async (ventaId, nuevoEstado, estadoAnterior, usuarioId) => {
    try {
        logOperation('procesarCambioEstado', { ventaId, nuevoEstado, estadoAnterior, usuarioId });

        console.log(`🔄 Processing state change for venta ${ventaId}: ${estadoAnterior} -> ${nuevoEstado}`);

        const resultados = [];

        switch (nuevoEstado) {
            case 'vendido/enviado':
                // Crear seguimiento de entrega
                try {
                    await query(`
                        INSERT INTO venta_seguimientos (
                            venta_id, responsable_id, tipo, descripcion, fecha_programada,
                            estado, prioridad, created_by, updated_by, created_at, updated_at
                        ) VALUES ($1, $2, 'seguimiento_entrega', $3, NOW() + INTERVAL '1 day',
                                 'Pendiente', 'Alta', $4, $4, NOW(), NOW())
                    `, [
                        ventaId, usuarioId,
                        `Verificar entrega de producto para venta ${ventaId}`,
                        usuarioId
                    ]);
                    resultados.push('Seguimiento de entrega programado');
                } catch (error) {
                    console.log('Warning: No se pudo crear seguimiento de entrega');
                }
                break;

            case 'vendido/enviado/recibido':
                // Ya sabemos que crea ticket de capacitación automáticamente
                resultados.push('Ticket de capacitación creado automáticamente');
                
                // Actualizar fecha de recepción
                try {
                    await query(`
                        UPDATE ventas 
                        SET fecha_entrega_real = NOW() 
                        WHERE id = $1
                    `, [ventaId]);
                    resultados.push('Fecha de recepción registrada');
                } catch (error) {
                    console.log('Warning: No se pudo actualizar fecha de recepción');
                }
                break;

            case 'vendido':
                // Venta realizada - actualizar métricas del asesor
                try {
                    await this.actualizarMetricasAsesor(usuarioId, ventaId);
                    resultados.push('Métricas de asesor actualizadas');
                } catch (error) {
                    console.log('Warning: No se pudieron actualizar métricas del asesor');
                }
                break;

            case 'vendido/enviado/recibido/capacitado':
                // Proceso logístico completado - actualizar fecha de completado
                try {
                    await query(`
                        UPDATE ventas 
                        SET fecha_completado = NOW() 
                        WHERE id = $1
                    `, [ventaId]);
                    resultados.push('Proceso logístico completado');
                } catch (error) {
                    console.log('Warning: No se pudo actualizar fecha de completado');
                }

                // Crear notificación de éxito
                try {
                    await query(`
                        INSERT INTO notificaciones (
                            usuario_id, titulo, mensaje, tipo, origen,
                            entidad_tipo, entidad_id, created_at
                        ) VALUES ($1, $2, $3, 'success', 'sistema', 'venta', $4, NOW())
                    `, [
                        usuarioId,
                        'Proceso Completado',
                        `¡Proceso completado para venta ${ventaId}! Cliente capacitado.`,
                        ventaId
                    ]);
                    resultados.push('Notificación de completado creada');
                } catch (error) {
                    console.log('Warning: No se pudo crear notificación');
                }
                break;

            case 'anulado':
                // Registrar fecha de anulación
                try {
                    await query(`
                        UPDATE ventas 
                        SET fecha_eliminacion = NOW() 
                        WHERE id = $1
                    `, [ventaId]);
                    resultados.push('Fecha de anulación registrada');
                } catch (error) {
                    console.log('Warning: No se pudo actualizar fecha de anulación');
                }
                break;
        }

        return {
            success: true,
            venta_id: ventaId,
            estado_anterior: estadoAnterior,
            estado_nuevo: nuevoEstado,
            acciones_realizadas: resultados
        };

    } catch (error) {
        console.error('❌ Error in procesarCambioEstado:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

// ============================================
// ACTUALIZAR MÉTRICAS DEL ASESOR
// ============================================
exports.actualizarMetricasAsesor = async (asesorId, ventaId) => {
    try {
        logOperation('actualizarMetricasAsesor', { asesorId, ventaId });

        // Obtener información de la venta completada
        const ventaResult = await query(`
            SELECT valor_final, fecha_creacion, prospecto_id
            FROM ventas 
            WHERE id = $1 AND asesor_id = $2 AND estado_detallado LIKE 'vendido%'
        `, [ventaId, asesorId]);

        if (ventaResult.rows.length === 0) {
            throw new Error('Venta no encontrada o no vendida');
        }

        const venta = ventaResult.rows[0];

        // Calcular métricas del mes actual
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        const metricasResult = await query(`
            SELECT 
                COUNT(*) as ventas_completadas_mes,
                SUM(valor_final) as valor_total_mes,
                AVG(valor_final) as promedio_mes
            FROM ventas 
            WHERE asesor_id = $1 
            AND estado_detallado LIKE 'vendido%' 
            AND created_at BETWEEN $2 AND $3
        `, [asesorId, inicioMes, finMes]);

        const metricas = metricasResult.rows[0];

        // Actualizar o insertar en tabla de métricas mensuales (tabla opcional)
        try {
            await query(`
                INSERT INTO asesor_metricas_mensuales (
                    asesor_id, año, mes, ventas_completadas, valor_total,
                    promedio_venta, ultima_actualizacion
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (asesor_id, año, mes) 
                DO UPDATE SET 
                    ventas_completadas = $4,
                    valor_total = $5,
                    promedio_venta = $6,
                    ultima_actualizacion = NOW()
            `, [
                asesorId,
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                parseInt(metricas.ventas_completadas_mes),
                parseFloat(metricas.valor_total_mes || 0),
                parseFloat(metricas.promedio_mes || 0)
            ]);
        } catch (error) {
            console.log('Info: Tabla asesor_metricas_mensuales no disponible');
        }

        console.log(`✅ Metrics updated for asesor ${asesorId}: ${metricas.ventas_completadas_mes} sales, $${metricas.valor_total_mes}`);

        return {
            asesor_id: asesorId,
            venta_id: ventaId,
            metricas_mes: {
                ventas_completadas: parseInt(metricas.ventas_completadas_mes),
                valor_total: parseFloat(metricas.valor_total_mes || 0),
                promedio_venta: parseFloat(metricas.promedio_mes || 0)
            }
        };

    } catch (error) {
        console.error('❌ Error in actualizarMetricasAsesor:', error.message);
        throw error;
    }
};

// ============================================
// VALIDAR DATOS DE VENTA COMPLETOS
// ============================================
exports.validarDatosVentaCompletos = async (ventaId) => {
    try {
        logOperation('validarDatosVentaCompletos', { ventaId });

        const ventaResult = await query(`
            SELECT 
                v.*,
                COUNT(vd.id) as total_productos
            FROM ventas v
            LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
            WHERE v.id = $1 AND v.activo = true
            GROUP BY v.id
        `, [ventaId]);

        if (ventaResult.rows.length === 0) {
            return {
                completa: false,
                mensaje: 'Venta no encontrada'
            };
        }

        const venta = ventaResult.rows[0];
        const errores = [];
        const advertencias = [];

        // Validaciones obligatorias
        if (!venta.cliente_nombre || venta.cliente_nombre.trim().length < 3) {
            errores.push('Nombre del cliente incompleto');
        }

        if (!venta.valor_final || parseFloat(venta.valor_final) <= 0) {
            errores.push('Valor de venta inválido');
        }

        if (parseInt(venta.total_productos) === 0) {
            errores.push('La venta debe tener al menos un producto');
        }

        // Validaciones recomendadas
        if (!venta.cliente_email) {
            advertencias.push('Email del cliente no proporcionado');
        }

        if (!venta.cliente_telefono) {
            advertencias.push('Teléfono del cliente no proporcionado');
        }

        if (!venta.fecha_entrega_estimada) {
            advertencias.push('Fecha de entrega estimada no definida');
        }

        const resultado = {
            completa: errores.length === 0,
            venta_id: ventaId,
            errores: errores,
            advertencias: advertencias,
            resumen: {
                cliente: venta.cliente_nombre,
                valor: parseFloat(venta.valor_final || 0),
                productos: parseInt(venta.total_productos),
                estado: venta.estado
            }
        };

        if (resultado.completa) {
            resultado.mensaje = 'Venta tiene todos los datos obligatorios completos';
        } else {
            resultado.mensaje = `Faltan ${errores.length} datos obligatorios`;
        }

        return resultado;

    } catch (error) {
        console.error('❌ Error in validarDatosVentaCompletos:', error.message);
        return {
            completa: false,
            mensaje: 'Error al validar datos de la venta',
            error: error.message
        };
    }
};

// ============================================
// CALCULAR COMISIONES DE VENTA (HELPER)
// ============================================
exports.calcularComisionVenta = async (ventaId, asesorId) => {
    try {
        logOperation('calcularComisionVenta', { ventaId, asesorId });

        // Obtener datos de la venta
        const ventaResult = await query(`
            SELECT valor_final, estado FROM ventas 
            WHERE id = $1 AND asesor_id = $2 AND activo = true
        `, [ventaId, asesorId]);

        if (ventaResult.rows.length === 0) {
            throw new Error('Venta no encontrada');
        }

        const venta = ventaResult.rows[0];

        // Solo calcular comisión para ventas completadas
        if (venta.estado !== 'Completada') {
            return {
                comision_calculada: false,
                mensaje: 'Comisión solo se calcula para ventas completadas'
            };
        }

        // Obtener configuración de comisiones del asesor (tabla opcional)
        let porcentajeComision = 5; // Default 5%
        
        try {
            const comisionResult = await query(`
                SELECT porcentaje_comision FROM asesor_configuracion_comisiones 
                WHERE asesor_id = $1 AND activo = true
            `, [asesorId]);

            if (comisionResult.rows.length > 0) {
                porcentajeComision = parseFloat(comisionResult.rows[0].porcentaje_comision);
            }
        } catch (error) {
            console.log('Info: Usando porcentaje de comisión por defecto (5%)');
        }

        const valorVenta = parseFloat(venta.valor_final);
        const montoComision = valorVenta * (porcentajeComision / 100);

        console.log(`💰 Commission calculated: ${porcentajeComision}% of $${valorVenta} = $${montoComision}`);

        return {
            comision_calculada: true,
            venta_id: ventaId,
            asesor_id: asesorId,
            valor_venta: valorVenta,
            porcentaje_comision: porcentajeComision,
            monto_comision: parseFloat(montoComision.toFixed(2)),
            fecha_calculo: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Error in calcularComisionVenta:', error.message);
        throw error;
    }
};

// ============================================
// OBTENER ESTADÍSTICAS DE VENTAS POR ASESOR
// ============================================
exports.obtenerEstadisticasAsesor = async (asesorId, fechaDesde = null, fechaHasta = null) => {
    try {
        logOperation('obtenerEstadisticasAsesor', { asesorId, fechaDesde, fechaHasta });

        // Fechas por defecto (mes actual)
        const fechaDesdeDefault = fechaDesde || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const fechaHastaDefault = fechaHasta || new Date();

        const estadisticasResult = await query(`
            SELECT 
                COUNT(*) as total_ventas,
                COUNT(CASE WHEN estado = 'Completada' THEN 1 END) as ventas_completadas,
                COUNT(CASE WHEN estado = 'Cancelada' THEN 1 END) as ventas_canceladas,
                COALESCE(SUM(CASE WHEN estado = 'Completada' THEN valor_final ELSE 0 END), 0) as valor_total_completadas,
                COALESCE(AVG(CASE WHEN estado = 'Completada' THEN valor_final END), 0) as promedio_venta_completada,
                COALESCE(MIN(CASE WHEN estado = 'Completada' THEN valor_final END), 0) as venta_minima,
                COALESCE(MAX(CASE WHEN estado = 'Completada' THEN valor_final END), 0) as venta_maxima,
                COUNT(DISTINCT DATE(fecha_creacion)) as dias_activos
            FROM ventas 
            WHERE asesor_id = $1 
            AND fecha_creacion BETWEEN $2 AND $3 
            AND activo = true
        `, [asesorId, fechaDesdeDefault, fechaHastaDefault]);

        const stats = estadisticasResult.rows[0];

        // Calcular KPIs
        const totalVentas = parseInt(stats.total_ventas);
        const ventasCompletadas = parseInt(stats.ventas_completadas);
        const tasaExito = totalVentas > 0 ? (ventasCompletadas / totalVentas * 100) : 0;
        const valorTotal = parseFloat(stats.valor_total_completadas);

        return {
            asesor_id: asesorId,
            periodo: {
                desde: fechaDesdeDefault,
                hasta: fechaHastaDefault
            },
            metricas: {
                total_ventas: totalVentas,
                ventas_completadas: ventasCompletadas,
                ventas_canceladas: parseInt(stats.ventas_canceladas),
                tasa_exito: parseFloat(tasaExito.toFixed(2)),
                valor_total_completadas: valorTotal,
                promedio_venta: parseFloat(stats.promedio_venta_completada || 0),
                venta_minima: parseFloat(stats.venta_minima || 0),
                venta_maxima: parseFloat(stats.venta_maxima || 0),
                dias_activos: parseInt(stats.dias_activos)
            },
            kpis: {
                productividad_diaria: stats.dias_activos > 0 ? 
                    (valorTotal / parseInt(stats.dias_activos)).toFixed(2) : 0,
                eficiencia: tasaExito >= 70 ? 'Excelente' : 
                           tasaExito >= 50 ? 'Buena' : 
                           tasaExito >= 30 ? 'Regular' : 'Necesita mejora'
            }
        };

    } catch (error) {
        console.error('❌ Error in obtenerEstadisticasAsesor:', error.message);
        throw error;
    }
};

console.log('✅ VentasService loaded successfully - Enterprise version ready');