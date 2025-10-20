// ============================================
// COMISIONES SERVICE - CÁLCULO AUTOMÁTICO
// Sistema CRM/ERP v2.0 - Gestión Empresarial
// ============================================

const { query } = require('../../../config/database');

class ComisionesService {

    // ============================================
    // CÁLCULO AUTOMÁTICO DE COMISIÓN
    // ============================================
    static async calcularComisionAutomatica(ventaId) {
        try {
            console.log(`💰 Iniciando cálculo automático de comisión para venta ${ventaId}`);

            // Obtener datos completos de la venta
            const ventaData = await this.obtenerDatosVentaParaComision(ventaId);
            if (!ventaData) {
                throw new Error('Venta no encontrada para cálculo de comisión');
            }

            // ⚠️ NO CALCULAR COMISIÓN PARA VENTAS DE CLIENTES FRECUENTES (EMPRESA)
            if (ventaData.asesor_id === 19) {
                console.log(`⚠️ Venta ${ventaId} asignada a EMPRESA (cliente frecuente) - No se calcula comisión`);
                return {
                    success: false,
                    comision_calculada: false,
                    mensaje: 'Venta de cliente frecuente - No genera comisión para asesor'
                };
            }

            // Verificar si ya existe comisión calculada
            const comisionExistente = await query(`
                SELECT id, estado FROM comisiones 
                WHERE venta_id = $1 AND activo = true
            `, [ventaId]);

            if (comisionExistente.rows.length > 0) {
                console.log(`⚠️ Ya existe comisión para venta ${ventaId} - Estado: ${comisionExistente.rows[0].estado}`);
                return {
                    success: true,
                    comision_existente: true,
                    comision_id: comisionExistente.rows[0].id
                };
            }

            // Calcular comisión según reglas de negocio
            const calculoComision = await this.aplicarReglasComision(ventaData);

            // Crear registro de comisión
            const nuevaComision = await this.crearRegistroComision(ventaData, calculoComision);

            // Notificar comisión calculada
            await this.notificarComisionCalculada(nuevaComision, ventaData);

            console.log(`✅ Comisión calculada exitosamente: $${calculoComision.monto_comision}`);

            return {
                success: true,
                comision_calculada: nuevaComision,
                detalle_calculo: calculoComision
            };

        } catch (error) {
            console.error('❌ Error al calcular comisión automática:', error);
            
            // Registrar error para análisis
            await this.registrarErrorComision(ventaId, error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // OBTENER DATOS COMPLETOS DE VENTA
    // ============================================
    static async obtenerDatosVentaParaComision(ventaId) {
        try {
            const ventaQuery = `
                SELECT 
                    v.*,
                    u.nombre as asesor_nombre, u.apellido as asesor_nombre_apellido,
                    u.email as asesor_email,
                    u.fecha_ingreso as asesor_fecha_ingreso,
                    COUNT(vd.id) as total_productos,
                    SUM(vd.total_linea) as suma_productos
                FROM ventas v
                LEFT JOIN usuarios u ON v.asesor_id = u.id
                LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
                WHERE v.id = $1 AND v.activo = true
                GROUP BY v.id, u.nombre, u.apellido, u.email, u.fecha_ingreso
            `;

            const ventaResult = await query(ventaQuery, [ventaId]);
            
            if (ventaResult.rows.length === 0) {
                return null;
            }

            const venta = ventaResult.rows[0];

            // Obtener productos de la venta para cálculos específicos
            const productosResult = await query(`
                SELECT 
                    vd.*,
                    p.nombre as producto_nombre,
                    p.categoria,
                    p.marca,
                    p.comision_porcentaje,
                    p.comision_fija
                FROM venta_detalles vd
                JOIN productos p ON vd.producto_id = p.id
                WHERE vd.venta_id = $1
                ORDER BY vd.orden_linea
            `, [ventaId]);

            venta.productos = productosResult.rows;

            return venta;

        } catch (error) {
            console.error('Error al obtener datos de venta:', error);
            return null;
        }
    }

    // ============================================
    // APLICAR REGLAS DE COMISIÓN
    // ============================================
    static async aplicarReglasComision(ventaData) {
        try {
            const reglas = await this.obtenerReglasComisionAsesor(ventaData.asesor_id);
            
            let calculoFinal = {
                valor_venta: ventaData.valor_final,
                porcentaje_base: reglas.porcentaje_base || 5, // 5% por defecto
                monto_base: 0,
                bonificaciones: [],
                deducciones: [],
                monto_comision: 0,
                tipo_calculo: 'porcentaje',
                detalles: []
            };

            // 1. CÁLCULO BASE POR PORCENTAJE
            calculoFinal.monto_base = ventaData.valor_final * (calculoFinal.porcentaje_base / 100);
            calculoFinal.monto_comision = calculoFinal.monto_base;

            calculoFinal.detalles.push({
                concepto: 'Comisión base',
                porcentaje: calculoFinal.porcentaje_base,
                valor_aplicado: ventaData.valor_final,
                monto: calculoFinal.monto_base
            });

            // 2. BONIFICACIÓN POR PRODUCTOS ESPECÍFICOS
            if (ventaData.productos && ventaData.productos.length > 0) {
                for (const producto of ventaData.productos) {
                    if (producto.comision_porcentaje && producto.comision_porcentaje > calculoFinal.porcentaje_base) {
                        const bonificacion_producto = producto.total_linea * (producto.comision_porcentaje / 100) - 
                                                    producto.total_linea * (calculoFinal.porcentaje_base / 100);
                        
                        calculoFinal.bonificaciones.push({
                            concepto: `Bonificación producto: ${producto.producto_nombre}`,
                            monto: bonificacion_producto
                        });
                        
                        calculoFinal.monto_comision += bonificacion_producto;
                    }
                    
                    if (producto.comision_fija && producto.comision_fija > 0) {
                        calculoFinal.bonificaciones.push({
                            concepto: `Comisión fija: ${producto.producto_nombre}`,
                            monto: producto.comision_fija * producto.cantidad
                        });
                        
                        calculoFinal.monto_comision += (producto.comision_fija * producto.cantidad);
                    }
                }
            }

            // 3. BONIFICACIÓN POR METAS ALCANZADAS
            const bonificacionMeta = await this.calcularBonificacionPorMeta(ventaData.asesor_id, ventaData.valor_final);
            if (bonificacionMeta.aplica) {
                calculoFinal.bonificaciones.push({
                    concepto: 'Bonificación por meta alcanzada',
                    monto: bonificacionMeta.monto
                });
                calculoFinal.monto_comision += bonificacionMeta.monto;
            }

            // 4. BONIFICACIÓN POR ANTIGÜEDAD
            const bonificacionAntiguedad = await this.calcularBonificacionAntiguedad(ventaData.asesor_fecha_ingreso, calculoFinal.monto_base);
            if (bonificacionAntiguedad > 0) {
                calculoFinal.bonificaciones.push({
                    concepto: 'Bonificación por antigüedad',
                    monto: bonificacionAntiguedad
                });
                calculoFinal.monto_comision += bonificacionAntiguedad;
            }

            // 5. BONIFICACIÓN POR VOLUMEN DE VENTA
            const bonificacionVolumen = await this.calcularBonificacionVolumen(ventaData.valor_final);
            if (bonificacionVolumen > 0) {
                calculoFinal.bonificaciones.push({
                    concepto: 'Bonificación por alto volumen',
                    monto: bonificacionVolumen
                });
                calculoFinal.monto_comision += bonificacionVolumen;
            }

            // 6. APLICAR LÍMITES MÁXIMOS Y MÍNIMOS
            calculoFinal = await this.aplicarLimitesComision(calculoFinal, reglas);

            return calculoFinal;

        } catch (error) {
            console.error('Error al aplicar reglas de comisión:', error);
            throw error;
        }
    }

    // ============================================
    // OBTENER REGLAS DE COMISIÓN DEL ASESOR
    // ============================================
    static async obtenerReglasComisionAsesor(asesorId) {
        try {
            // Buscar reglas específicas del asesor
            const reglasResult = await query(`
                SELECT * FROM reglas_comisiones 
                WHERE asesor_id = $1 AND activo = true
                ORDER BY fecha_creacion DESC
                LIMIT 1
            `, [asesorId]);

            if (reglasResult.rows.length > 0) {
                return reglasResult.rows[0];
            }

            // Si no hay reglas específicas, usar reglas por rol
            const rolResult = await query(`
                SELECT 
                    u.rol,
                    rc.porcentaje_base,
                    rc.comision_minima,
                    rc.comision_maxima,
                    rc.bonificacion_meta_porcentaje
                FROM usuarios u
                LEFT JOIN reglas_comisiones rc ON rc.rol = u.rol AND rc.activo = true
                WHERE u.id = $1
            `, [asesorId]);

            if (rolResult.rows.length > 0 && rolResult.rows[0].porcentaje_base) {
                return rolResult.rows[0];
            }

            // Reglas por defecto
            return {
                porcentaje_base: 5.0,
                comision_minima: 0,
                comision_maxima: null,
                bonificacion_meta_porcentaje: 10.0
            };

        } catch (error) {
            console.error('Error al obtener reglas de comisión:', error);
            return {
                porcentaje_base: 5.0,
                comision_minima: 0,
                comision_maxima: null,
                bonificacion_meta_porcentaje: 10.0
            };
        }
    }

    // ============================================
    // BONIFICACIONES ESPECÍFICAS
    // ============================================
    
    // Bonificación por meta alcanzada
    static async calcularBonificacionPorMeta(asesorId, valorVenta) {
        try {
            const metaActual = await query(`
                SELECT 
                    meta_valor,
                    valor_logrado,
                    porcentaje_valor,
                    bonificacion_meta_porcentaje
                FROM metas_ventas 
                WHERE asesor_id = $1 
                AND año = EXTRACT(YEAR FROM CURRENT_DATE)
                AND mes = EXTRACT(MONTH FROM CURRENT_DATE)
                AND activo = true
            `, [asesorId]);

            if (metaActual.rows.length === 0) {
                return { aplica: false, monto: 0 };
            }

            const meta = metaActual.rows[0];
            const nuevoValorLogrado = (meta.valor_logrado || 0) + valorVenta;
            const nuevoPorcentaje = meta.meta_valor > 0 ? (nuevoValorLogrado / meta.meta_valor) * 100 : 0;

            // Si con esta venta supera el 100% de la meta
            if (nuevoPorcentaje >= 100 && (meta.porcentaje_valor || 0) < 100) {
                const bonificacionPorcentaje = meta.bonificacion_meta_porcentaje || 10;
                const montoBase = valorVenta * 0.05; // 5% base
                const montoBonus = montoBase * (bonificacionPorcentaje / 100);
                
                return {
                    aplica: true,
                    monto: montoBonus,
                    detalle: `Meta alcanzada: ${nuevoPorcentaje.toFixed(1)}%`
                };
            }

            return { aplica: false, monto: 0 };

        } catch (error) {
            console.error('Error al calcular bonificación por meta:', error);
            return { aplica: false, monto: 0 };
        }
    }

    // Bonificación por antigüedad
    static async calcularBonificacionAntiguedad(fechaIngreso, montoBase) {
        try {
            if (!fechaIngreso) return 0;

            const anosAntiguedad = Math.floor(
                (new Date() - new Date(fechaIngreso)) / (365.25 * 24 * 60 * 60 * 1000)
            );

            let porcentajeBonificacion = 0;
            
            if (anosAntiguedad >= 5) {
                porcentajeBonificacion = 15; // 15% adicional
            } else if (anosAntiguedad >= 3) {
                porcentajeBonificacion = 10; // 10% adicional
            } else if (anosAntiguedad >= 1) {
                porcentajeBonificacion = 5;  // 5% adicional
            }

            return montoBase * (porcentajeBonificacion / 100);

        } catch (error) {
            console.error('Error al calcular bonificación por antigüedad:', error);
            return 0;
        }
    }

    // Bonificación por volumen alto
    static async calcularBonificacionVolumen(valorVenta) {
        try {
            let porcentajeBonificacion = 0;

            if (valorVenta >= 100000) {      // Ventas >= $100,000
                porcentajeBonificacion = 2;  // 2% adicional
            } else if (valorVenta >= 50000) { // Ventas >= $50,000
                porcentajeBonificacion = 1;  // 1% adicional
            }

            return valorVenta * (porcentajeBonificacion / 100);

        } catch (error) {
            console.error('Error al calcular bonificación por volumen:', error);
            return 0;
        }
    }

    // ============================================
    // APLICAR LÍMITES DE COMISIÓN
    // ============================================
    static async aplicarLimitesComision(calculo, reglas) {
        try {
            // Aplicar comisión mínima
            if (reglas.comision_minima && calculo.monto_comision < reglas.comision_minima) {
                const ajuste = reglas.comision_minima - calculo.monto_comision;
                calculo.bonificaciones.push({
                    concepto: 'Ajuste por comisión mínima',
                    monto: ajuste
                });
                calculo.monto_comision = reglas.comision_minima;
            }

            // Aplicar comisión máxima
            if (reglas.comision_maxima && calculo.monto_comision > reglas.comision_maxima) {
                const reduccion = calculo.monto_comision - reglas.comision_maxima;
                calculo.deducciones.push({
                    concepto: 'Límite máximo de comisión',
                    monto: reduccion
                });
                calculo.monto_comision = reglas.comision_maxima;
            }

            return calculo;

        } catch (error) {
            console.error('Error al aplicar límites:', error);
            return calculo;
        }
    }

    // ============================================
    // CREAR REGISTRO DE COMISIÓN
    // ============================================
    static async crearRegistroComision(ventaData, calculoComision) {
        try {
            const comisionQuery = `
                INSERT INTO comisiones (
                    venta_id,
                    asesor_id,
                    monto_venta,
                    porcentaje_aplicado,
                    monto_comision,
                    bonificaciones_json,
                    deducciones_json,
                    detalle_calculo_json,
                    estado,
                    fecha_calculo,
                    periodo_pago,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const periodoPago = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

            const result = await query(comisionQuery, [
                ventaData.id,                                           // venta_id
                ventaData.asesor_id,                                   // asesor_id
                ventaData.valor_final,                                 // monto_venta
                calculoComision.porcentaje_base,                       // porcentaje_aplicado
                calculoComision.monto_comision,                        // monto_comision
                JSON.stringify(calculoComision.bonificaciones),        // bonificaciones_json
                JSON.stringify(calculoComision.deducciones),           // deducciones_json
                JSON.stringify(calculoComision.detalles),              // detalle_calculo_json
                'Pendiente',                                           // estado
                new Date(),                                            // fecha_calculo
                periodoPago,                                           // periodo_pago
                ventaData.asesor_id                                    // created_by
            ]);

            return result.rows[0];

        } catch (error) {
            console.error('Error al crear registro de comisión:', error);
            throw error;
        }
    }

    // ============================================
    // NOTIFICAR COMISIÓN CALCULADA
    // ============================================
    static async notificarComisionCalculada(comision, ventaData) {
        try {
            console.log('=== COMISIÓN CALCULADA ===');
            console.log(`Venta: ${ventaData.codigo}`);
            console.log(`Asesor: ${ventaData.asesor_nombre}`);
            console.log(`Valor Venta: $${ventaData.valor_final.toLocaleString()}`);
            console.log(`Comisión: $${comision.monto_comision.toLocaleString()}`);
            console.log(`Porcentaje: ${comision.porcentaje_aplicado}%`);
            console.log(`Estado: ${comision.estado}`);
            console.log('========================');

            // Aquí podrías integrar notificaciones por:
            // - Email al asesor
            // - Notificación push
            // - Dashboard en tiempo real
            // - Slack/Teams

            return true;

        } catch (error) {
            console.error('Error al notificar comisión:', error);
        }
    }

    // ============================================
    // OBTENER COMISIONES POR ASESOR
    // ============================================
    static async obtenerComisionesPorAsesor(asesorId, periodo = null) {
        try {
            let whereClause = 'WHERE c.asesor_id = $1 AND c.activo = true';
            const params = [asesorId];

            if (periodo) {
                whereClause += ' AND c.periodo_pago = $2';
                params.push(periodo);
            }

            const comisionesQuery = `
                SELECT 
                    c.*,
                    v.codigo as venta_codigo,
                    v.cliente_nombre,
                    v.fecha_creacion as fecha_venta
                FROM comisiones c
                JOIN ventas v ON c.venta_id = v.id
                ${whereClause}
                ORDER BY c.fecha_calculo DESC
            `;

            const result = await query(comisionesQuery, params);

            // Calcular totales
            const totales = result.rows.reduce((acc, comision) => {
                acc.total_comisiones += parseFloat(comision.monto_comision);
                acc.total_ventas += parseFloat(comision.monto_venta);
                acc.cantidad_ventas += 1;
                
                if (comision.estado === 'Pendiente') acc.pendientes += parseFloat(comision.monto_comision);
                if (comision.estado === 'Aprobada') acc.aprobadas += parseFloat(comision.monto_comision);
                if (comision.estado === 'Pagada') acc.pagadas += parseFloat(comision.monto_comision);
                
                return acc;
            }, {
                total_comisiones: 0,
                total_ventas: 0,
                cantidad_ventas: 0,
                pendientes: 0,
                aprobadas: 0,
                pagadas: 0
            });

            return {
                comisiones: result.rows,
                totales: totales,
                periodo: periodo
            };

        } catch (error) {
            console.error('Error al obtener comisiones por asesor:', error);
            return { comisiones: [], totales: null };
        }
    }

    // ============================================
    // APROBAR COMISIONES
    // ============================================
    static async aprobarComisiones(comisionIds, aprobadoPorId) {
        try {
            const result = await query(`
                UPDATE comisiones 
                SET 
                    estado = 'Aprobada',
                    fecha_aprobacion = NOW(),
                    aprobado_por = $1,
                    updated_at = NOW()
                WHERE id = ANY($2) AND estado = 'Pendiente'
                RETURNING id, monto_comision, asesor_id
            `, [aprobadoPorId, comisionIds]);

            console.log(`✅ ${result.rows.length} comisiones aprobadas por usuario ${aprobadoPorId}`);

            return {
                success: true,
                comisiones_aprobadas: result.rows.length,
                total_aprobado: result.rows.reduce((sum, c) => sum + parseFloat(c.monto_comision), 0)
            };

        } catch (error) {
            console.error('Error al aprobar comisiones:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // REGISTRAR ERROR DE COMISIÓN
    // ============================================
    static async registrarErrorComision(ventaId, errorMessage) {
        try {
            await query(`
                INSERT INTO comisiones_errores (venta_id, error_mensaje, fecha_error)
                VALUES ($1, $2, NOW())
            `, [ventaId, errorMessage]);

        } catch (error) {
            console.error('Error al registrar error de comisión:', error);
        }
    }

    // ============================================
    // RECALCULAR COMISIÓN
    // ============================================
    static async recalcularComision(comisionId, usuarioId) {
        try {
            // Obtener comisión actual
            const comisionActual = await query(`
                SELECT * FROM comisiones WHERE id = $1
            `, [comisionId]);

            if (comisionActual.rows.length === 0) {
                throw new Error('Comisión no encontrada');
            }

            const comision = comisionActual.rows[0];
            
            // Recalcular con datos actuales
            const resultado = await this.calcularComisionAutomatica(comision.venta_id);
            
            if (resultado.success) {
                // Marcar la anterior como inactiva
                await query(`
                    UPDATE comisiones 
                    SET activo = false, updated_at = NOW(), updated_by = $1
                    WHERE id = $2
                `, [usuarioId, comisionId]);

                return {
                    success: true,
                    nueva_comision: resultado.comision_calculada,
                    mensaje: 'Comisión recalculada exitosamente'
                };
            } else {
                throw new Error(resultado.error);
            }

        } catch (error) {
            console.error('Error al recalcular comisión:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ComisionesService;