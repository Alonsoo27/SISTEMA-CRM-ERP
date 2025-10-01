const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const winston = require('winston');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'almacen-service' },
    transports: [
        new winston.transports.File({ filename: 'logs/almacen-service.log' }),
        new winston.transports.Console()
    ]
});

// ==================== SERVICIOS DE ANÁLISIS DE INVENTARIO ====================

/**
 * Obtener rotación de inventario por almacén
 */
const getRotacionInventario = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        const { data, error } = await supabase.rpc('get_rotacion_almacenes', {
            fecha_inicio: fechaInicio.toISOString(),
            fecha_fin: new Date().toISOString()
        });
        
        if (error) {
            // Fallback a query manual si no existe la función
            const { data: movimientos, error: errorFallback } = await supabase
                .from('movimientos_inventario')
                .select(`
                    almacen_origen_id,
                    almacen_destino_id,
                    cantidad,
                    almacenes_origen:almacen_origen_id(codigo, nombre),
                    almacenes_destino:almacen_destino_id(codigo, nombre)
                `)
                .gte('fecha_movimiento', fechaInicio.toISOString())
                .lte('fecha_movimiento', new Date().toISOString());
            
            if (errorFallback) throw errorFallback;
            
            // Procesar movimientos manualmente
            const almacenesMap = new Map();
            
            movimientos?.forEach(mov => {
                // Contar movimientos de origen
                if (mov.almacen_origen_id && mov.almacenes_origen) {
                    const key = mov.almacenes_origen.codigo;
                    if (!almacenesMap.has(key)) {
                        almacenesMap.set(key, {
                            almacen: key,
                            total_movimientos: 0,
                            cantidad_total: 0,
                            nombre_almacen: mov.almacenes_origen.nombre
                        });
                    }
                    const stats = almacenesMap.get(key);
                    stats.total_movimientos++;
                    stats.cantidad_total += Number(mov.cantidad);
                }
                
                // Contar movimientos de destino
                if (mov.almacen_destino_id && mov.almacenes_destino) {
                    const key = mov.almacenes_destino.codigo;
                    if (!almacenesMap.has(key)) {
                        almacenesMap.set(key, {
                            almacen: key,
                            total_movimientos: 0,
                            cantidad_total: 0,
                            nombre_almacen: mov.almacenes_destino.nombre
                        });
                    }
                    const stats = almacenesMap.get(key);
                    stats.total_movimientos++;
                    stats.cantidad_total += Number(mov.cantidad);
                }
            });
            
            // Convertir a formato esperado
            const result = Array.from(almacenesMap.values()).map(stats => ({
                almacen: stats.almacen,
                rotacion_diaria: Number((stats.total_movimientos / dias).toFixed(2)),
                cantidad_promedio: stats.total_movimientos > 0 ? 
                    Number((stats.cantidad_total / stats.total_movimientos).toFixed(2)) : 0,
                total_movimientos: stats.total_movimientos
            }));
            
            return { success: true, data: result };
        }
        
        return { success: true, data: data || [] };
        
    } catch (error) {
        logger.error('Error en getRotacionInventario:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
};

/**
 * Obtener eficiencia operativa
 */
const getEficienciaOperativa = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // Obtener movimientos por día
        const { data: movimientosPorDia, error: errorMovimientos } = await supabase
            .from('movimientos_inventario')
            .select(`
                fecha_movimiento,
                usuario_id,
                usuarios:usuario_id(nombre, apellido)
            `)
            .gte('fecha_movimiento', fechaInicio.toISOString())
            .lte('fecha_movimiento', new Date().toISOString())
            .order('fecha_movimiento');
        
        if (errorMovimientos) throw errorMovimientos;
        
        // Procesar datos por día
        const diasMap = new Map();
        
        movimientosPorDia?.forEach(mov => {
            const fecha = mov.fecha_movimiento.split('T')[0];
            
            if (!diasMap.has(fecha)) {
                diasMap.set(fecha, {
                    fecha: fecha,
                    movimientos: 0,
                    usuarios: new Set(),
                    eficiencia: 0
                });
            }
            
            const diaData = diasMap.get(fecha);
            diaData.movimientos++;
            diaData.usuarios.add(mov.usuario_id);
        });
        
        // Calcular eficiencia y convertir a array
        const movimientos_por_dia = Array.from(diasMap.values()).map(dia => ({
            fecha: dia.fecha,
            movimientos: dia.movimientos,
            usuarios: dia.usuarios.size,
            eficiencia: dia.usuarios.size > 0 ? 
                Number((dia.movimientos / dia.usuarios.size).toFixed(1)) : 0
        }));
        
        // Calcular métricas generales
        const totalMovimientos = movimientos_por_dia.reduce((sum, dia) => sum + dia.movimientos, 0);
        const totalUsuarios = movimientos_por_dia.reduce((sum, dia) => sum + dia.usuarios, 0);
        const totalDias = movimientos_por_dia.length;
        
        const metricas_generales = {
            promedio_movimientos_dia: totalDias > 0 ? Math.round(totalMovimientos / totalDias) : 0,
            promedio_usuarios_activos: totalDias > 0 ? Number((totalUsuarios / totalDias).toFixed(1)) : 0,
            eficiencia_promedio: totalUsuarios > 0 ? Number((totalMovimientos / totalUsuarios).toFixed(1)) : 0,
            tiempo_pico: '10:00-12:00', // Placeholder - requiere análisis por horas
            dia_mas_activo: 'Lunes' // Placeholder - requiere análisis por día de semana
        };
        
        return {
            success: true,
            data: {
                movimientos_por_dia,
                metricas_generales
            }
        };
        
    } catch (error) {
        logger.error('Error en getEficienciaOperativa:', error);
        return {
            success: false,
            error: error.message,
            data: {
                movimientos_por_dia: [],
                metricas_generales: {
                    promedio_movimientos_dia: 0,
                    promedio_usuarios_activos: 0,
                    eficiencia_promedio: 0,
                    tiempo_pico: '',
                    dia_mas_activo: ''
                }
            }
        };
    }
};

/**
 * Análisis de stock de seguridad
 */
const getAnalisisStockSeguridad = async () => {
    try {
        const { data: inventarios, error } = await supabase
            .from('inventario')
            .select(`
                stock_actual,
                stock_minimo,
                productos:producto_id(codigo, descripcion),
                almacenes:almacen_id(codigo, nombre)
            `)
            .eq('activo', true)
            .gt('stock_minimo', 0);
        
        if (error) throw error;
        
        const distribucion = { Óptimo: 0, Riesgo: 0, Crítico: 0, Sobrestockeado: 0 };
        const productos_criticos = [];
        
        inventarios?.forEach(inv => {
            const stock = Number(inv.stock_actual);
            const minimo = Number(inv.stock_minimo);
            
            let estado = 'Óptimo';
            
            if (stock <= 0) {
                estado = 'Crítico';
            } else if (stock <= minimo) {
                estado = 'Crítico';
                productos_criticos.push({
                    codigo: inv.productos.codigo,
                    descripcion: inv.productos.descripcion,
                    stock_actual: stock,
                    stock_minimo: minimo,
                    dias_sin_reposicion: Math.floor(Math.random() * 30) + 1 // Placeholder
                });
            } else if (stock <= minimo * 1.5) {
                estado = 'Riesgo';
            } else if (stock > minimo * 2) {
                estado = 'Sobrestockeado';
            }
            
            distribucion[estado]++;
        });
        
        const total = inventarios?.length || 1;
        
        const distribucion_array = [
            { 
                estado: 'Óptimo', 
                cantidad: distribucion.Óptimo, 
                porcentaje: Number(((distribucion.Óptimo / total) * 100).toFixed(1)),
                color: '#10B981' 
            },
            { 
                estado: 'Riesgo', 
                cantidad: distribucion.Riesgo, 
                porcentaje: Number(((distribucion.Riesgo / total) * 100).toFixed(1)),
                color: '#F59E0B' 
            },
            { 
                estado: 'Crítico', 
                cantidad: distribucion.Crítico, 
                porcentaje: Number(((distribucion.Crítico / total) * 100).toFixed(1)),
                color: '#EF4444' 
            },
            { 
                estado: 'Sobrestockeado', 
                cantidad: distribucion.Sobrestockeado, 
                porcentaje: Number(((distribucion.Sobrestockeado / total) * 100).toFixed(1)),
                color: '#8B5CF6' 
            }
        ];
        
        const recomendaciones = {
            ajustar_minimos: Math.floor(distribucion.Crítico * 0.6),
            incrementar_stock: distribucion.Crítico,
            revisar_demanda: Math.floor(distribucion.Sobrestockeado * 0.8),
            productos_obsoletos: Math.floor(distribucion.Sobrestockeado * 0.4)
        };
        
        return {
            success: true,
            data: {
                distribucion: distribucion_array,
                productos_criticos: productos_criticos.slice(0, 8), // Limitar a 8
                recomendaciones
            }
        };
        
    } catch (error) {
        logger.error('Error en getAnalisisStockSeguridad:', error);
        return {
            success: false,
            error: error.message,
            data: {
                distribucion: [],
                productos_criticos: [],
                recomendaciones: {
                    ajustar_minimos: 0,
                    incrementar_stock: 0,
                    revisar_demanda: 0,
                    productos_obsoletos: 0
                }
            }
        };
    }
};

/**
 * Mapa de calor de almacenes
 */
const getMapaCalorAlmacenes = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // Obtener almacenes
        const { data: almacenes, error: errorAlmacenes } = await supabase
            .from('almacenes')
            .select('id, codigo, nombre')
            .eq('activo', true);
        
        if (errorAlmacenes) throw errorAlmacenes;
        
        const mapaCalor = [];
        
        for (const almacen of almacenes || []) {
            // Contar movimientos
            const { data: movimientos } = await supabase
                .from('movimientos_inventario')
                .select('id')
                .or(`almacen_origen_id.eq.${almacen.id},almacen_destino_id.eq.${almacen.id}`)
                .gte('fecha_movimiento', fechaInicio.toISOString());
            
            // Contar alertas activas
            const { data: alertas } = await supabase
                .from('alertas_inventario')
                .select('id')
                .eq('almacen_id', almacen.id)
                .eq('activa', true);
            
            // Calcular valor de inventario
            const { data: inventarioValor } = await supabase
                .from('inventario')
                .select('stock_actual, costo_promedio')
                .eq('almacen_id', almacen.id)
                .eq('activo', true);
            
            const valorInventario = inventarioValor?.reduce((sum, inv) => 
                sum + (Number(inv.stock_actual) * Number(inv.costo_promedio || 0)), 0) || 0;
            
            const totalMovimientos = movimientos?.length || 0;
            const totalAlertas = alertas?.length || 0;
            
            // Clasificar actividad
            let actividad = 'Muy Baja';
            const movimientosDiarios = totalMovimientos / dias;
            
            if (movimientosDiarios >= 40) actividad = 'Muy Alta';
            else if (movimientosDiarios >= 30) actividad = 'Alta';
            else if (movimientosDiarios >= 20) actividad = 'Media';
            else if (movimientosDiarios >= 10) actividad = 'Baja';
            
            // Calcular eficiencia (placeholder mejorado)
            const baseEficiencia = Math.max(60, 100 - (totalAlertas * 5));
            const eficienciaPorMovimiento = Math.min(20, movimientosDiarios * 0.5);
            const eficiencia = Math.min(100, Math.round(baseEficiencia + eficienciaPorMovimiento));
            
            mapaCalor.push({
                almacen: almacen.codigo,
                movimientos: totalMovimientos,
                alertas: totalAlertas,
                valor_inventario: valorInventario,
                actividad: actividad,
                eficiencia: eficiencia
            });
        }
        
        return {
            success: true,
            data: mapaCalor.sort((a, b) => b.movimientos - a.movimientos)
        };
        
    } catch (error) {
        logger.error('Error en getMapaCalorAlmacenes:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
};

/**
 * Tendencias de inventario y valorización
 */
const getTendenciasInventario = async (periodo = '30d') => {
    try {
        const dias = parseInt(periodo.replace('d', ''));
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        
        // Dividir el periodo en intervalos (semanal para 30d, mensual para 365d)
        const intervalos = dias <= 30 ? 7 : dias <= 90 ? 7 : 30; // días por intervalo
        const numIntervalos = Math.ceil(dias / intervalos);
        
        const tendencias = [];
        
        for (let i = 0; i < numIntervalos; i++) {
            const inicioIntervalo = new Date(fechaInicio);
            inicioIntervalo.setDate(inicioIntervalo.getDate() + (i * intervalos));
            
            const finIntervalo = new Date(inicioIntervalo);
            finIntervalo.setDate(finIntervalo.getDate() + intervalos - 1);
            
            // Obtener movimientos del intervalo
            const { data: movimientos } = await supabase
                .from('movimientos_inventario')
                .select('cantidad, precio_unitario')
                .gte('fecha_movimiento', inicioIntervalo.toISOString())
                .lte('fecha_movimiento', finIntervalo.toISOString());
            
            const valorMovido = movimientos?.reduce((sum, mov) => 
                sum + (Number(mov.cantidad) * Number(mov.precio_unitario || 0)), 0) || 0;
            
            // Calcular valor total de inventario (simulado - mejorar con snapshot real)
            const { data: inventarioActual } = await supabase
                .from('inventario')
                .select('stock_actual, costo_promedio')
                .eq('activo', true);
            
            const valorInventario = inventarioActual?.reduce((sum, inv) => 
                sum + (Number(inv.stock_actual) * Number(inv.costo_promedio || 0)), 0) || 0;
            
            const etiquetaIntervalo = intervalos === 7 ? 
                `Sem ${i + 1}` : 
                inicioIntervalo.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
            
            tendencias.push({
                periodo: etiquetaIntervalo,
                valor_inventario: Math.round(valorInventario),
                valor_movido: Math.round(valorMovido),
                tendencia: i > 0 && tendencias[i-1] ? 
                    (valorInventario > tendencias[i-1].valor_inventario ? 'Subida' : 
                     valorInventario < tendencias[i-1].valor_inventario ? 'Bajada' : 'Estable') : 'Inicial'
            });
        }
        
        return {
            success: true,
            data: tendencias
        };
        
    } catch (error) {
        logger.error('Error en getTendenciasInventario:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
};

// ==================== SERVICIOS DE STOCK ====================

/**
 * Verifica si hay stock suficiente para una venta
 */
const verificarStockDisponible = async (productos, almacen_id = null) => {
    try {
        const resultados = [];
        
        for (const item of productos) {
            const { producto_id, cantidad } = item;
            
            let query = supabase
                .from('inventario')
                .select('stock_actual, almacenes!inner(codigo, nombre)')
                .eq('producto_id', producto_id)
                .gt('stock_actual', 0);
            
            if (almacen_id) {
                query = query.eq('almacen_id', almacen_id);
            }
            
            const { data, error } = await query;
            
            if (error) {
                throw error;
            }
            
            const stockTotal = data.reduce((total, inv) => total + Number(inv.stock_actual), 0);
            const tieneStock = stockTotal >= cantidad;
            
            resultados.push({
                producto_id,
                cantidad_solicitada: cantidad,
                stock_disponible: stockTotal,
                tiene_stock: tieneStock,
                ubicaciones: data.map(inv => ({
                    almacen: inv.almacenes.codigo,
                    stock: inv.stock_actual
                }))
            });
        }
        
        return {
            success: true,
            data: resultados,
            puede_vender: resultados.every(r => r.tiene_stock)
        };
        
    } catch (error) {
        logger.error('Error en verificarStockDisponible:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Descontar stock automáticamente al confirmar venta
 */
const descontarStockVenta = async (venta_id, productos, almacen_id, usuario_id) => {
    try {
        const movimientos = [];
        
        for (const item of productos) {
            const { producto_id, cantidad, precio_unitario } = item;
            
            // Obtener stock actual
            const { data: inventario, error: errorStock } = await supabase
                .from('inventario')
                .select('stock_actual')
                .eq('producto_id', producto_id)
                .eq('almacen_id', almacen_id)
                .single();
            
            if (errorStock || !inventario) {
                throw new Error(`No hay inventario para producto ${producto_id} en almacén especificado`);
            }
            
            if (inventario.stock_actual < cantidad) {
                throw new Error(`Stock insuficiente para producto ${producto_id}. Disponible: ${inventario.stock_actual}, Solicitado: ${cantidad}`);
            }
            
            // Descontar stock
            const { error: errorDescuento } = await supabase
                .from('inventario')
                .update({
                    stock_actual: inventario.stock_actual - cantidad,
                    ultimo_movimiento: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    updated_by: usuario_id
                })
                .eq('producto_id', producto_id)
                .eq('almacen_id', almacen_id);
            
            if (errorDescuento) {
                throw errorDescuento;
            }
            
            // Registrar movimiento
            const movimiento = {
                id: uuidv4(),
                producto_id: producto_id,
                almacen_origen_id: almacen_id,
                tipo_movimiento: 'SALIDA',
                cantidad: cantidad,
                precio_unitario: precio_unitario || 0,
                stock_anterior: inventario.stock_actual,
                stock_posterior: inventario.stock_actual - cantidad,
                motivo: `Venta confirmada - ID: ${venta_id}`,
                referencia_tipo: 'VENTA',
                referencia_id: venta_id.toString(),
                usuario_id: usuario_id,
                fecha_movimiento: new Date().toISOString()
            };
            
            const { error: errorMovimiento } = await supabase
                .from('movimientos_inventario')
                .insert(movimiento);
            
            if (errorMovimiento) {
                throw errorMovimiento;
            }
            
            movimientos.push(movimiento);
            
            // Verificar alertas de stock bajo
            await verificarYCrearAlertas(producto_id, almacen_id, inventario.stock_actual - cantidad);
        }
        
        logger.info('Stock descontado exitosamente:', { venta_id, productos: productos.length });
        
        return {
            success: true,
            data: {
                venta_id,
                movimientos_creados: movimientos.length,
                productos_procesados: productos.length
            }
        };
        
    } catch (error) {
        logger.error('Error en descontarStockVenta:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Transferir stock entre almacenes (sin stored procedure)
 */
const transferirStock = async (producto_id, almacen_origen_id, almacen_destino_id, cantidad, motivo, usuario_id) => {
    try {
        // Iniciar transacción
        await supabase.from('inventario').select('id').limit(1); // Dummy query para verificar conexión
        
        // Verificar stock origen
        const { data: inventarioOrigen, error: errorOrigen } = await supabase
            .from('inventario')
            .select('stock_actual, costo_promedio')
            .eq('producto_id', producto_id)
            .eq('almacen_id', almacen_origen_id)
            .single();
        
        if (errorOrigen || !inventarioOrigen || inventarioOrigen.stock_actual < cantidad) {
            throw new Error('Stock insuficiente en almacén origen');
        }
        
        // Verificar/crear inventario destino
        let { data: inventarioDestino, error: errorDestino } = await supabase
            .from('inventario')
            .select('stock_actual, costo_promedio')
            .eq('producto_id', producto_id)
            .eq('almacen_id', almacen_destino_id)
            .single();
        
        if (errorDestino && errorDestino.code !== 'PGRST116') {
            throw errorDestino;
        }
        
        // Si no existe inventario en destino, crearlo
        if (!inventarioDestino) {
            const { data: nuevoInventario, error: errorCreacion } = await supabase
                .from('inventario')
                .insert({
                    id: uuidv4(),
                    producto_id: producto_id,
                    almacen_id: almacen_destino_id,
                    stock_actual: 0,
                    stock_minimo: 0,
                    costo_promedio: inventarioOrigen.costo_promedio || 0,
                    created_by: usuario_id,
                    updated_by: usuario_id
                })
                .select()
                .single();
            
            if (errorCreacion) throw errorCreacion;
            inventarioDestino = { stock_actual: 0, costo_promedio: inventarioOrigen.costo_promedio || 0 };
        }
        
        // Actualizar stock origen (reducir)
        const { error: errorUpdateOrigen } = await supabase
            .from('inventario')
            .update({
                stock_actual: inventarioOrigen.stock_actual - cantidad,
                ultimo_movimiento: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by: usuario_id
            })
            .eq('producto_id', producto_id)
            .eq('almacen_id', almacen_origen_id);
        
        if (errorUpdateOrigen) throw errorUpdateOrigen;
        
        // Actualizar stock destino (aumentar)
        const { error: errorUpdateDestino } = await supabase
            .from('inventario')
            .update({
                stock_actual: inventarioDestino.stock_actual + cantidad,
                ultimo_movimiento: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by: usuario_id
            })
            .eq('producto_id', producto_id)
            .eq('almacen_id', almacen_destino_id);
        
        if (errorUpdateDestino) throw errorUpdateDestino;
        
        // Crear movimiento de transferencia
        const movimientoId = uuidv4();
        const { error: errorMovimiento } = await supabase
            .from('movimientos_inventario')
            .insert({
                id: movimientoId,
                producto_id: producto_id,
                almacen_origen_id: almacen_origen_id,
                almacen_destino_id: almacen_destino_id,
                tipo_movimiento: 'TRANSFERENCIA',
                cantidad: cantidad,
                precio_unitario: inventarioOrigen.costo_promedio || 0,
                stock_anterior: inventarioOrigen.stock_actual,
                stock_posterior: inventarioOrigen.stock_actual - cantidad,
                motivo: motivo,
                referencia_tipo: 'TRANSFERENCIA',
                referencia_id: movimientoId,
                usuario_id: usuario_id,
                fecha_movimiento: new Date().toISOString()
            });
        
        if (errorMovimiento) throw errorMovimiento;
        
        logger.info('Transferencia completada:', { producto_id, almacen_origen_id, almacen_destino_id, cantidad });
        
        return {
            success: true,
            data: {
                movimiento_id: movimientoId,
                stock_origen_anterior: inventarioOrigen.stock_actual,
                stock_origen_actual: inventarioOrigen.stock_actual - cantidad,
                stock_destino_anterior: inventarioDestino.stock_actual,
                stock_destino_actual: inventarioDestino.stock_actual + cantidad
            }
        };
        
    } catch (error) {
        logger.error('Error en transferirStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Verificar y crear alertas automáticas
 */
const verificarYCrearAlertas = async (producto_id, almacen_id, stock_actual) => {
    try {
        // Obtener configuración de stock mínimo
        const { data: inventario } = await supabase
            .from('inventario')
            .select('stock_minimo')
            .eq('producto_id', producto_id)
            .eq('almacen_id', almacen_id)
            .single();
        
        if (!inventario) return;
        
        const stock_minimo = inventario.stock_minimo || 0;
        
        // Determinar tipo de alerta
        let tipo_alerta = null;
        let nivel_prioridad = null;
        let mensaje = null;
        
        if (stock_actual <= 0) {
            tipo_alerta = 'STOCK_AGOTADO';
            nivel_prioridad = 'CRITICA';
            mensaje = 'Producto completamente agotado';
        } else if (stock_actual <= stock_minimo) {
            tipo_alerta = 'STOCK_MINIMO';
            nivel_prioridad = 'MEDIA';
            mensaje = `Stock por debajo del mínimo (${stock_minimo})`;
        }
        
        if (tipo_alerta) {
            // Verificar si ya existe una alerta activa
            const { data: alertaExistente } = await supabase
                .from('alertas_inventario')
                .select('id')
                .eq('producto_id', producto_id)
                .eq('almacen_id', almacen_id)
                .eq('tipo_alerta', tipo_alerta)
                .eq('activa', true)
                .single();
            
            if (!alertaExistente) {
                await supabase
                    .from('alertas_inventario')
                    .insert({
                        id: uuidv4(),
                        producto_id,
                        almacen_id,
                        tipo_alerta,
                        nivel_prioridad,
                        mensaje,
                        stock_actual,
                        stock_minimo
                    });
            }
        }
        
    } catch (error) {
        logger.error('Error en verificarYCrearAlertas:', error);
    }
};

// ==================== SERVICIOS DE DESPACHOS ====================

/**
 * Obtener despachos con filtros
 */
const obtenerDespachos = async (filtros) => {
    try {
        const {
            page = 1,
            limit = 20,
            estado,
            fecha_desde,
            fecha_hasta,
            almacen_id,
            venta_id
        } = filtros;
        
        let query = supabase
            .from('despachos')
            .select(`
                *,
                ventas:venta_id (
                    codigo,
                    nombre_cliente,
                    apellido_cliente,
                    valor_final,
                    ciudad,
                    distrito
                ),
                almacenes:almacen_id (
                    codigo,
                    nombre,
                    tipo
                ),
                preparado:preparado_por (nombre, apellido),
                enviado:enviado_por (nombre, apellido)
            `)
            .eq('activo', true);
        
        // Aplicar filtros
        if (estado) {
            query = query.eq('estado', estado);
        }
        
        if (fecha_desde) {
            query = query.gte('fecha_programada', fecha_desde);
        }
        
        if (fecha_hasta) {
            query = query.lte('fecha_programada', fecha_hasta);
        }
        
        if (almacen_id) {
            query = query.eq('almacen_id', almacen_id);
        }
        
        if (venta_id) {
            query = query.eq('venta_id', venta_id);
        }
        
        // Ordenar por fecha programada
        query = query.order('fecha_programada').order('created_at', { ascending: false });
        
        // Aplicar paginación
        const offset = (Number(page) - 1) * Number(limit);
        query = query.range(offset, offset + Number(limit) - 1);
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        return {
            success: true,
            data: data || []
        };
        
    } catch (error) {
        logger.error('Error en obtenerDespachos:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener despacho por ID
 */
const obtenerDespachoPorId = async (despacho_id) => {
    try {
        const { data, error } = await supabase
            .from('despachos')
            .select(`
                *,
                ventas:venta_id (
                    codigo,
                    nombre_cliente,
                    apellido_cliente,
                    cliente_empresa,
                    cliente_telefono,
                    cliente_email,
                    valor_final,
                    ciudad,
                    departamento,
                    distrito,
                    venta_detalles (
                        cantidad,
                        precio_unitario,
                        subtotal,
                        productos:producto_id (
                            codigo,
                            descripcion,
                            marca,
                            unidad_medida
                        )
                    )
                ),
                almacenes:almacen_id (
                    codigo,
                    nombre,
                    tipo,
                    direccion
                ),
                preparado:preparado_por (nombre, apellido),
                enviado:enviado_por (nombre, apellido)
            `)
            .eq('id', despacho_id)
            .single();
        
        if (error) {
            throw error;
        }
        
        return {
            success: true,
            data: data
        };
        
    } catch (error) {
        logger.error('Error en obtenerDespachoPorId:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Crear despacho automático desde venta
 */
const crearDespachoDesdeVenta = async (venta_data) => {
    try {
        const {
            venta_id,
            fecha_entrega_estimada,
            almacen_id,
            observaciones_almacen,
            es_venta_presencial,
            se_lo_llevo_directamente
        } = venta_data;
        
        // No crear despacho si es presencial y se lo llevó directamente
        if (es_venta_presencial && se_lo_llevo_directamente) {
            return {
                success: true,
                message: 'No se requiere despacho - Cliente se llevó producto directamente',
                data: null
            };
        }
        
        // Generar código de despacho
        const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const { data: ultimoDespacho } = await supabase
            .from('despachos')
            .select('codigo')
            .like('codigo', `DESP-${fecha}-%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        let correlativo = 1;
        if (ultimoDespacho) {
            const match = ultimoDespacho.codigo.match(/DESP-\d{8}-(\d+)/);
            correlativo = match ? parseInt(match[1]) + 1 : 1;
        }
        
        const codigo = `DESP-${fecha}-${correlativo.toString().padStart(3, '0')}`;
        
        const despacho = {
            id: uuidv4(),
            venta_id: venta_id,
            almacen_id: almacen_id,
            codigo: codigo,
            estado: 'PENDIENTE',
            fecha_programada: fecha_entrega_estimada || new Date().toISOString().split('T')[0],
            observaciones_preparacion: observaciones_almacen || '',
            created_by: 1,
            updated_by: 1
        };
        
        const { data, error } = await supabase
            .from('despachos')
            .insert(despacho)
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        logger.info('Despacho creado exitosamente:', { codigo, venta_id });
        
        return {
            success: true,
            data: data,
            message: `Despacho ${codigo} creado exitosamente`
        };
        
    } catch (error) {
        logger.error('Error en crearDespachoDesdeVenta:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Actualizar estado de despacho
 */
const actualizarEstadoDespacho = async (despacho_id, nuevo_estado, usuario_id, observaciones = '') => {
    try {
        const estadosValidos = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
        
        if (!estadosValidos.includes(nuevo_estado)) {
            throw new Error('Estado de despacho no válido');
        }
        
        const datosActualizacion = {
            estado: nuevo_estado,
            updated_at: new Date().toISOString(),
            updated_by: usuario_id
        };
        
        // Agregar campos específicos según el estado
        const ahora = new Date().toISOString();
        
        switch (nuevo_estado) {
            case 'PREPARANDO':
                datosActualizacion.fecha_preparacion = ahora;
                datosActualizacion.preparado_por = usuario_id;
                if (observaciones) {
                    datosActualizacion.observaciones_preparacion = observaciones;
                }
                break;
            case 'ENVIADO':
                datosActualizacion.fecha_envio = ahora;
                datosActualizacion.enviado_por = usuario_id;
                if (observaciones) {
                    datosActualizacion.observaciones_envio = observaciones;
                }
                break;
            case 'ENTREGADO':
                datosActualizacion.fecha_entrega = ahora;
                break;
        }
        
        const { data, error } = await supabase
            .from('despachos')
            .update(datosActualizacion)
            .eq('id', despacho_id)
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        // Actualizar estado de venta automáticamente
        if (nuevo_estado === 'ENVIADO' || nuevo_estado === 'ENTREGADO') {
            await actualizarEstadoVentaDesdeDespacho(data.venta_id, nuevo_estado);
        }
        
        logger.info('Estado de despacho actualizado:', { despacho_id, nuevo_estado });
        
        return {
            success: true,
            data: data,
            message: `Despacho actualizado a estado: ${nuevo_estado}`
        };
        
    } catch (error) {
        logger.error('Error en actualizarEstadoDespacho:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Actualizar estado de venta desde despacho
 */
const actualizarEstadoVentaDesdeDespacho = async (venta_id, estado_despacho) => {
    try {
        let nuevo_estado_venta = null;
        
        switch (estado_despacho) {
            case 'ENVIADO':
                nuevo_estado_venta = 'vendido/enviado';
                break;
            case 'ENTREGADO':
                // No cambiar estado automáticamente - queda en 'vendido/enviado'
                // El asesor debe confirmar manualmente con el cliente
                break;
        }
        
        if (nuevo_estado_venta) {
            const { error } = await supabase
                .from('ventas')
                .update({
                    estado_detallado: nuevo_estado_venta,
                    updated_at: new Date().toISOString()
                })
                .eq('id', venta_id);
            
            if (error) {
                throw error;
            }
            
            logger.info('Estado de venta actualizado automáticamente:', { venta_id, nuevo_estado_venta });
        }
        
    } catch (error) {
        logger.error('Error actualizando estado de venta:', error);
    }
};

// ==================== SERVICIOS DE REPORTES ====================

/**
 * Generar reporte de kardex por producto (renombrado para consistencia)
 */
const generarKardex = async (producto_id, almacen_id = null, fecha_desde = null, fecha_hasta = null) => {
    try {
        let query = supabase
            .from('movimientos_inventario')
            .select(`
                *,
                productos:producto_id(codigo, descripcion),
                almacenes_origen:almacen_origen_id(codigo, nombre),
                almacenes_destino:almacen_destino_id(codigo, nombre),
                usuarios:usuario_id(nombre, apellido)
            `)
            .eq('producto_id', producto_id);
        
        if (almacen_id) {
            query = query.or(`almacen_origen_id.eq.${almacen_id},almacen_destino_id.eq.${almacen_id}`);
        }
        
        if (fecha_desde) {
            query = query.gte('fecha_movimiento', fecha_desde);
        }
        
        if (fecha_hasta) {
            query = query.lte('fecha_movimiento', fecha_hasta);
        }
        
        query = query.order('fecha_movimiento');
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        // Calcular saldos acumulados
        let saldo = 0;
        const kardex = data.map(mov => {
            const esEntrada = ['ENTRADA', 'AJUSTE_POSITIVO', 'TRANSFERENCIA'].includes(mov.tipo_movimiento);
            const esSalida = ['SALIDA', 'AJUSTE_NEGATIVO'].includes(mov.tipo_movimiento);
            
            if (esEntrada && (!almacen_id || mov.almacen_destino_id === almacen_id)) {
                saldo += Number(mov.cantidad);
            } else if (esSalida && (!almacen_id || mov.almacen_origen_id === almacen_id)) {
                saldo -= Number(mov.cantidad);
            }
            
            return {
                ...mov,
                saldo_acumulado: saldo
            };
        });
        
        return {
            success: true,
            data: kardex
        };
        
    } catch (error) {
        logger.error('Error en generarKardex:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generar reporte de valorización de inventario
 */
const generarReporteValorizacion = async (almacen_id = null, categoria_id = null) => {
    try {
        let query = supabase
            .from('vista_inventario_completo')
            .select('*')
            .gt('stock_actual', 0);
        
        if (almacen_id) {
            query = query.eq('almacen_id', almacen_id);
        }
        
        if (categoria_id) {
            query = query.eq('categoria_id', categoria_id);
        }
        
        query = query.order('valor_inventario', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        // Calcular totales
        const resumen = {
            total_productos: data.length,
            total_unidades: data.reduce((sum, item) => sum + Number(item.stock_actual), 0),
            valor_total: data.reduce((sum, item) => sum + Number(item.valor_inventario), 0),
            productos_stock_bajo: data.filter(item => item.estado_stock === 'BAJO').length,
            productos_agotados: data.filter(item => item.estado_stock === 'AGOTADO').length
        };
        
        return {
            success: true,
            data: {
                resumen,
                detalle: data
            }
        };
        
    } catch (error) {
        logger.error('Error en generarReporteValorizacion:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Obtener stock consolidado por producto
 */
const obtenerStockConsolidado = async () => {
    try {
        const { data, error } = await supabase
            .from('vista_stock_consolidado')
            .select('*')
            .order('stock_total', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        return {
            success: true,
            data: data || []
        };
        
    } catch (error) {
        logger.error('Error en obtenerStockConsolidado:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ==================== SERVICIOS DE UPLOAD MASIVO ====================

/**
 * Generar plantilla Excel para upload
 */
const generarPlantillaStock = async () => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Stock Upload');
        
        // Configurar columnas
        worksheet.columns = [
            { header: 'Código Producto', key: 'codigo_producto', width: 20 },
            { header: 'Almacén', key: 'almacen_codigo', width: 20 },
            { header: 'Stock Actual', key: 'stock_actual', width: 15 },
            { header: 'Stock Mínimo', key: 'stock_minimo', width: 15 },
            { header: 'Stock Máximo', key: 'stock_maximo', width: 15 },
            { header: 'Costo Promedio', key: 'costo_promedio', width: 15 },
            { header: 'Motivo', key: 'motivo', width: 30 }
        ];
        
        // Estilizar encabezados
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
        
        // Agregar datos de ejemplo
        worksheet.addRow({
            codigo_producto: 'PROD001',
            almacen_codigo: 'CENTRAL',
            stock_actual: 100,
            stock_minimo: 10,
            stock_maximo: 500,
            costo_promedio: 25.50,
            motivo: 'Carga inicial de inventario'
        });
        
        // Obtener almacenes para validación
        const { data: almacenes } = await supabase
            .from('almacenes')
            .select('codigo')
            .eq('activo', true)
            .order('codigo');
        
        // Crear hoja de validaciones
        const validacionesSheet = workbook.addWorksheet('Validaciones');
        validacionesSheet.addRow(['Almacenes Válidos:']);
        almacenes?.forEach(almacen => {
            validacionesSheet.addRow([almacen.codigo]);
        });
        
        // Generar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        return {
            success: true,
            data: buffer,
            filename: `Plantilla_Stock_${new Date().toISOString().split('T')[0]}.xlsx`
        };
        
    } catch (error) {
        logger.error('Error en generarPlantillaStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Procesar upload masivo de stock (preview)
 */
const previewUploadStock = async (excelBuffer) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);
        
        const worksheet = workbook.getWorksheet(1);
        const productos = [];
        const errores = [];
        
        // Leer filas (saltar encabezado)
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Saltar encabezado
            
            const producto = {
                fila: rowNumber,
                codigo_producto: row.getCell(1).value,
                almacen_codigo: row.getCell(2).value,
                stock_actual: Number(row.getCell(3).value) || 0,
                stock_minimo: Number(row.getCell(4).value) || 0,
                stock_maximo: Number(row.getCell(5).value) || null,
                costo_promedio: Number(row.getCell(6).value) || 0,
                motivo: row.getCell(7).value || 'Upload masivo'
            };
            
            // Validaciones básicas
            if (!producto.codigo_producto) {
                errores.push(`Fila ${rowNumber}: Código de producto requerido`);
            }
            
            if (!producto.almacen_codigo) {
                errores.push(`Fila ${rowNumber}: Código de almacén requerido`);
            }
            
            if (producto.stock_actual < 0) {
                errores.push(`Fila ${rowNumber}: Stock actual no puede ser negativo`);
            }
            
            productos.push(producto);
        });
        
        // Validar productos y almacenes existen
        if (productos.length > 0) {
            const codigosProductos = [...new Set(productos.map(p => p.codigo_producto))];
            const codigosAlmacenes = [...new Set(productos.map(p => p.almacen_codigo))];
            
            const { data: productosDB } = await supabase
                .from('productos')
                .select('codigo, id')
                .in('codigo', codigosProductos);
            
            const { data: almacenesDB } = await supabase
                .from('almacenes')
                .select('codigo, id')
                .in('codigo', codigosAlmacenes);
            
            const productosValidos = productosDB?.map(p => p.codigo) || [];
            const almacenesValidos = almacenesDB?.map(a => a.codigo) || [];
            
            productos.forEach(producto => {
                if (!productosValidos.includes(producto.codigo_producto)) {
                    errores.push(`Fila ${producto.fila}: Producto '${producto.codigo_producto}' no encontrado`);
                }
                
                if (!almacenesValidos.includes(producto.almacen_codigo)) {
                    errores.push(`Fila ${producto.fila}: Almacén '${producto.almacen_codigo}' no encontrado`);
                }
            });
        }
        
        return {
            success: true,
            data: {
                productos_procesados: productos.length,
                productos: productos.slice(0, 10), // Muestra de primeros 10
                errores: errores,
                tiene_errores: errores.length > 0,
                puede_ejecutar: errores.length === 0
            }
        };
        
    } catch (error) {
        logger.error('Error en previewUploadStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Ejecutar upload masivo de stock
 */
const ejecutarUploadStock = async (excelBuffer, usuario_id) => {
    try {
        // Primero hacer preview para validaciones
        const preview = await previewUploadStock(excelBuffer);
        
        if (!preview.success || preview.data.tiene_errores) {
            return {
                success: false,
                error: 'El archivo contiene errores. Debe corregirlos antes de ejecutar.',
                errores: preview.data?.errores || []
            };
        }
        
        // Reprocessar todo el archivo para ejecución
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);
        const worksheet = workbook.getWorksheet(1);
        
        const productos = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            
            productos.push({
                codigo_producto: row.getCell(1).value,
                almacen_codigo: row.getCell(2).value,
                stock_actual: Number(row.getCell(3).value) || 0,
                stock_minimo: Number(row.getCell(4).value) || 0,
                stock_maximo: Number(row.getCell(5).value) || null,
                costo_promedio: Number(row.getCell(6).value) || 0,
                motivo: row.getCell(7).value || 'Upload masivo'
            });
        });
        
        // Obtener IDs de productos y almacenes
        const { data: productosDB } = await supabase
            .from('productos')
            .select('codigo, id')
            .in('codigo', productos.map(p => p.codigo_producto));
        
        const { data: almacenesDB } = await supabase
            .from('almacenes')
            .select('codigo, id')
            .in('codigo', productos.map(p => p.almacen_codigo));
        
        const productosMap = new Map(productosDB?.map(p => [p.codigo, p.id]));
        const almacenesMap = new Map(almacenesDB?.map(a => [a.codigo, a.id]));
        
        let procesados = 0;
        let errores = 0;
        
        // Procesar cada producto
        for (const producto of productos) {
            try {
                const producto_id = productosMap.get(producto.codigo_producto);
                const almacen_id = almacenesMap.get(producto.almacen_codigo);
                
                // Verificar si ya existe inventario
                const { data: inventarioExistente } = await supabase
                    .from('inventario')
                    .select('stock_actual')
                    .eq('producto_id', producto_id)
                    .eq('almacen_id', almacen_id)
                    .single();
                
                const datosInventario = {
                    producto_id: producto_id,
                    almacen_id: almacen_id,
                    stock_actual: producto.stock_actual,
                    stock_minimo: producto.stock_minimo,
                    stock_maximo: producto.stock_maximo,
                    costo_promedio: producto.costo_promedio,
                    ultimo_movimiento: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    updated_by: usuario_id
                };
                
                if (inventarioExistente) {
                    // Actualizar existente
                    await supabase
                        .from('inventario')
                        .update(datosInventario)
                        .eq('producto_id', producto_id)
                        .eq('almacen_id', almacen_id);
                } else {
                    // Crear nuevo
                    await supabase
                        .from('inventario')
                        .insert({
                            id: uuidv4(),
                            ...datosInventario,
                            created_by: usuario_id
                        });
                }
                
                // Crear movimiento
                await supabase
                    .from('movimientos_inventario')
                    .insert({
                        id: uuidv4(),
                        producto_id: producto_id,
                        almacen_destino_id: almacen_id,
                        tipo_movimiento: 'INICIAL',
                        cantidad: producto.stock_actual,
                        precio_unitario: producto.costo_promedio,
                        stock_anterior: inventarioExistente?.stock_actual || 0,
                        stock_posterior: producto.stock_actual,
                        motivo: producto.motivo,
                        referencia_tipo: 'INICIAL',
                        usuario_id: usuario_id
                    });
                
                procesados++;
                
            } catch (error) {
                logger.error('Error procesando producto:', error);
                errores++;
            }
        }
        
        logger.info('Upload masivo completado:', { procesados, errores });
        
        return {
            success: true,
            data: {
                productos_procesados: procesados,
                productos_con_error: errores,
                total_productos: productos.length
            }
        };
        
    } catch (error) {
        logger.error('Error en ejecutarUploadStock:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ==================== SERVICIOS DE REPORTES AVANZADOS ====================

/**
 * Función auxiliar para convertir periodo a días
 */

const convertirPeriodoADias = (periodo) => {
    const match = periodo.match(/(\d+)([dwmy])/);
    if (!match) return 30; // default
    
    const [, numero, unidad] = match;
    const num = parseInt(numero);
    
    switch (unidad) {
        case 'd': return num;
        case 'w': return num * 7;
        case 'm': return num * 30;
        case 'y': return num * 365;
        default: return 30;
    }
};

/**
 * REPORTE 1: PERFORMANCE COMPARATIVA DE ALMACENES
 */
const getPerformanceComparativa = async (periodo = '30d') => {
    try {
        logger.info('Iniciando análisis de performance comparativa', { periodo });

        const dias = convertirPeriodoADias(periodo);
        const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

        // Obtener almacenes activos
        const { data: almacenes, error: errorAlmacenes } = await supabase
            .from('almacenes')
            .select('id, codigo, nombre, tipo')
            .eq('activo', true);

        if (errorAlmacenes) throw errorAlmacenes;

        if (!almacenes || almacenes.length === 0) {
            return {
                success: true,
                data: {
                    resumen_ejecutivo: {
                        total_almacenes: 0,
                        almacen_mas_eficiente: null,
                        promedio_eficiencia: 0,
                        oportunidad_mejora: 0
                    },
                    comparativa_almacenes: [],
                    benchmarks: {}
                }
            };
        }

        const comparativaAlmacenes = [];
        let totalMovimientos = 0;
        let totalEficiencia = 0;

        for (const almacen of almacenes) {
            // Obtener movimientos del período
            const { data: movimientos } = await supabase
                .from('movimientos_inventario')
                .select('id, cantidad, fecha_movimiento, precio_unitario, created_at')
                .or(`almacen_origen_id.eq.${almacen.id},almacen_destino_id.eq.${almacen.id}`)
                .gte('fecha_movimiento', fechaInicio);

            // Obtener alertas activas
            const { data: alertas } = await supabase
                .from('alertas_inventario')
                .select('id')
                .eq('almacen_id', almacen.id)
                .eq('activa', true);

            // Obtener valor de inventario
            const { data: inventario } = await supabase
                .from('inventario')
                .select('stock_actual, costo_promedio')
                .eq('almacen_id', almacen.id)
                .eq('activo', true);

            // Obtener despachos
            const { data: despachos } = await supabase
                .from('despachos')
                .select('estado, fecha_entrega, fecha_programada, created_at')
                .eq('almacen_id', almacen.id)
                .gte('created_at', fechaInicio);

            // Calcular métricas
            const totalMovimientosAlmacen = movimientos?.length || 0;
            const alertasActivas = alertas?.length || 0;
            const valorInventario = inventario?.reduce((sum, inv) => 
                sum + (Number(inv.stock_actual || 0) * Number(inv.costo_promedio || 0)), 0) || 0;

            // Calcular tiempo promedio entre movimientos
            let tiempoPromedio = 0;
            if (movimientos && movimientos.length > 1) {
                const tiempos = [];
                for (let i = 1; i < movimientos.length; i++) {
                    const actual = new Date(movimientos[i].created_at);
                    const anterior = new Date(movimientos[i-1].created_at);
                    tiempos.push((actual - anterior) / (1000 * 60)); // minutos
                }
                if (tiempos.length > 0) {
                    tiempoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
                }
            }

            // Calcular eficiencia de despacho (solo con datos reales)
            const despachosEntregados = despachos?.filter(d => d.estado === 'ENTREGADO') || [];
            const despachosEnTiempo = despachosEntregados.filter(d => 
                d.fecha_entrega && d.fecha_programada && 
                new Date(d.fecha_entrega) <= new Date(d.fecha_programada)
            );
            const eficienciaDespacho = despachosEntregados.length > 0 
                ? (despachosEnTiempo.length / despachosEntregados.length * 100)
                : 0; // Sin datos = 0, no hardcodeado

            // Calcular score de performance (algoritmo ponderado)
            const scoreMovimientos = totalMovimientosAlmacen > 0 ? Math.min((totalMovimientosAlmacen / (dias * 2)) * 100, 100) * 0.3 : 0;
            const scoreTiempo = tiempoPromedio > 0 ? Math.max(100 - Math.min(tiempoPromedio / 30 * 100, 100), 0) * 0.2 : 0;
            const scoreAlertas = Math.max(100 - Math.min(alertasActivas * 8, 100), 0) * 0.2;
            const scoreDespacho = eficienciaDespacho * 0.3;
            const scorePerformance = Math.round(scoreMovimientos + scoreTiempo + scoreAlertas + scoreDespacho);

            const almacenData = {
                almacen: almacen.nombre,
                codigo: almacen.codigo,
                tipo: almacen.tipo,
                movimientos: totalMovimientosAlmacen,
                tiempo_promedio: Math.round(tiempoPromedio * 10) / 10,
                alertas_activas: alertasActivas,
                valor_inventario: Math.round(valorInventario),
                despachos: despachosEntregados.length,
                eficiencia_despacho: Math.round(eficienciaDespacho * 10) / 10,
                score_performance: Math.max(scorePerformance, 0),
                tendencia: scorePerformance >= 85 ? 'up' : scorePerformance >= 70 ? 'stable' : 'down'
            };

            comparativaAlmacenes.push(almacenData);
            totalMovimientos += totalMovimientosAlmacen;
            totalEficiencia += scorePerformance;
        }

        // Calcular resumen ejecutivo
        const almacenMasEficiente = comparativaAlmacenes.length > 0 ? 
            comparativaAlmacenes.reduce((max, almacen) => 
                almacen.score_performance > max.score_performance ? almacen : max, 
                comparativaAlmacenes[0]
            ) : null;

        const promedioEficiencia = comparativaAlmacenes.length > 0 
            ? totalEficiencia / comparativaAlmacenes.length 
            : 0;

        const resumenEjecutivo = {
            total_almacenes: comparativaAlmacenes.length,
            almacen_mas_eficiente: almacenMasEficiente?.almacen || null,
            promedio_eficiencia: Math.round(promedioEficiencia * 10) / 10,
            oportunidad_mejora: Math.round((100 - promedioEficiencia) * 10) / 10
        };

        return {
            success: true,
            data: {
                resumen_ejecutivo: resumenEjecutivo,
                comparativa_almacenes: comparativaAlmacenes.sort((a, b) => b.score_performance - a.score_performance),
                benchmarks: {} // Sin datos hardcodeados
            }
        };

    } catch (error) {
        logger.error('Error en getPerformanceComparativa:', error);
        return {
            success: false,
            error: error.message,
            data: {
                resumen_ejecutivo: { total_almacenes: 0, promedio_eficiencia: 0 },
                comparativa_almacenes: [],
                benchmarks: {}
            }
        };
    }
};

/**
 * REPORTE 2: ANÁLISIS PREDICTIVO DE ALERTAS
 */
const getAnalisisPredictivoAlertas = async (periodo = '30d') => {
    try {
        logger.info('Iniciando análisis predictivo de alertas', { periodo });

        const dias = convertirPeriodoADias(periodo);
        const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

        // Obtener alertas del período
        const { data: alertasHistoricas, error } = await supabase
            .from('alertas_inventario')
            .select(`
                fecha_alerta, 
                fecha_resolucion,
                tipo_alerta,
                nivel_prioridad,
                productos:producto_id(codigo, descripcion)
            `)
            .gte('fecha_alerta', fechaInicio);

        if (error) throw error;

        if (!alertasHistoricas || alertasHistoricas.length === 0) {
            return {
                success: true,
                data: {
                    predicciones: { proximas_72h: 0, productos_en_riesgo: 0, almacenes_criticos: 0, impacto_estimado: 'BAJO' },
                    tendencias_historicas: [],
                    top_productos_problematicos: [],
                    patron_semanal: {}
                }
            };
        }

        // Procesar tendencias históricas por día
        const tendenciasPorDia = new Map();

        alertasHistoricas.forEach(alerta => {
            const fecha = alerta.fecha_alerta.split('T')[0];
            
            if (!tendenciasPorDia.has(fecha)) {
                tendenciasPorDia.set(fecha, {
                    fecha,
                    stock_bajo: 0,
                    stock_critico: 0,
                    sin_stock: 0,
                    otros: 0
                });
            }

            const dia = tendenciasPorDia.get(fecha);
            
            switch (alerta.tipo_alerta) {
                case 'STOCK_MINIMO':
                    dia.stock_bajo++;
                    break;
                case 'STOCK_AGOTADO':
                    dia.sin_stock++;
                    break;
                case 'STOCK_NEGATIVO':
                    dia.stock_critico++;
                    break;
                default:
                    dia.otros++;
                    break;
            }
        });

        const tendenciasHistoricas = Array.from(tendenciasPorDia.values())
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        // Calcular productos problemáticos
        const productosProblematicos = new Map();

        alertasHistoricas.forEach(alerta => {
            if (!alerta.productos) return;
            
            const codigo = alerta.productos.codigo;
            if (!productosProblematicos.has(codigo)) {
                productosProblematicos.set(codigo, {
                    codigo,
                    descripcion: alerta.productos.descripcion,
                    alertas_generadas: 0,
                    tiempos_resolucion: [],
                    tipos_alerta: new Set()
                });
            }

            const producto = productosProblematicos.get(codigo);
            producto.alertas_generadas++;
            producto.tipos_alerta.add(alerta.tipo_alerta);

            if (alerta.fecha_resolucion) {
                const tiempoResolucion = (new Date(alerta.fecha_resolucion) - new Date(alerta.fecha_alerta)) / (1000 * 60 * 60);
                producto.tiempos_resolucion.push(tiempoResolucion);
            }
        });

        const topProductosProblematicos = Array.from(productosProblematicos.values())
            .map(producto => ({
                codigo: producto.codigo,
                descripcion: producto.descripcion,
                alertas_generadas: producto.alertas_generadas,
                tiempo_resolucion: producto.tiempos_resolucion.length > 0 
                    ? Math.round((producto.tiempos_resolucion.reduce((a, b) => a + b, 0) / producto.tiempos_resolucion.length) * 10) / 10
                    : 0,
                tipos_alerta: Array.from(producto.tipos_alerta)
            }))
            .sort((a, b) => b.alertas_generadas - a.alertas_generadas)
            .slice(0, 5);

        // Predicciones para próximas 72 horas (basadas en datos reales)
        const alertasRecientes = alertasHistoricas.filter(a => 
            new Date(a.fecha_alerta) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );

        const alertasPorDia = alertasRecientes.length / 7;
        const alertasCriticas = alertasRecientes.filter(a => a.nivel_prioridad === 'CRITICA').length;

        const predicciones = {
            proximas_72h: Math.round(alertasPorDia * 3),
            productos_en_riesgo: topProductosProblematicos.length,
            almacenes_criticos: Math.round(alertasCriticas / 7),
            impacto_estimado: alertasPorDia > 10 ? 'ALTO' : alertasPorDia > 5 ? 'MEDIO' : 'BAJO'
        };

        // Patrón semanal basado en datos reales
        const patronSemanal = {};
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        
        diasSemana.forEach(dia => {
            patronSemanal[dia] = { promedio: 0, total_alertas: 0 };
        });

        alertasHistoricas.forEach(alerta => {
            const fecha = new Date(alerta.fecha_alerta);
            const diaSemana = diasSemana[fecha.getDay()];
            patronSemanal[diaSemana].total_alertas++;
        });

        // Calcular promedios
        const semanas = Math.ceil(dias / 7);
        Object.keys(patronSemanal).forEach(dia => {
            patronSemanal[dia].promedio = semanas > 0 ? 
                Math.round((patronSemanal[dia].total_alertas / semanas) * 10) / 10 : 0;
        });

        return {
            success: true,
            data: {
                predicciones,
                tendencias_historicas: tendenciasHistoricas,
                top_productos_problematicos: topProductosProblematicos,
                patron_semanal: patronSemanal
            }
        };

    } catch (error) {
        logger.error('Error en getAnalisisPredictivoAlertas:', error);
        return {
            success: false,
            error: error.message,
            data: {
                predicciones: { proximas_72h: 0, productos_en_riesgo: 0, almacenes_criticos: 0, impacto_estimado: 'BAJO' },
                tendencias_historicas: [],
                top_productos_problematicos: [],
                patron_semanal: {}
            }
        };
    }
};

/**
 * REPORTE 3: VALORIZACIÓN EVOLUTIVA
 */
const getValorizacionEvolutiva = async (periodo = '30d') => {
    try {
        logger.info('Iniciando análisis de valorización evolutiva', { periodo });

        const dias = convertirPeriodoADias(periodo);
        const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

        // Dividir en intervalos semanales
        const intervalos = Math.ceil(dias / 7);
        const evolucionValor = [];

        for (let i = 0; i < intervalos; i++) {
            const inicioIntervalo = new Date(fechaInicio);
            inicioIntervalo.setDate(inicioIntervalo.getDate() + (i * 7));
            
            const finIntervalo = new Date(inicioIntervalo);
            finIntervalo.setDate(finIntervalo.getDate() + 6);

            if (finIntervalo > new Date()) {
                finIntervalo.setTime(Date.now());
            }

            // Obtener movimientos del intervalo
            const { data: movimientos } = await supabase
                .from('movimientos_inventario')
                .select('cantidad, precio_unitario, tipo_movimiento')
                .gte('fecha_movimiento', inicioIntervalo.toISOString())
                .lte('fecha_movimiento', finIntervalo.toISOString());

            // Calcular ingresos y egresos
            let ingresos = 0;
            let egresos = 0;

            movimientos?.forEach(mov => {
                const valor = Number(mov.cantidad || 0) * Number(mov.precio_unitario || 0);
                
                if (['ENTRADA', 'AJUSTE_POSITIVO', 'INICIAL'].includes(mov.tipo_movimiento)) {
                    ingresos += valor;
                } else if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(mov.tipo_movimiento)) {
                    egresos += valor;
                }
            });

            evolucionValor.push({
                fecha: inicioIntervalo.toISOString().split('T')[0],
                ingresos: Math.round(ingresos),
                egresos: Math.round(egresos),
                variacion: Math.round(ingresos - egresos)
            });
        }

        // Obtener valor actual de inventario
        const { data: inventarioActual } = await supabase
            .from('inventario')
            .select('stock_actual, costo_promedio')
            .eq('activo', true);

        const valorActual = inventarioActual?.reduce((sum, inv) => 
            sum + (Number(inv.stock_actual || 0) * Number(inv.costo_promedio || 0)), 0) || 0;

        // Distribución por almacén
        const { data: almacenes } = await supabase
            .from('almacenes')
            .select('id, codigo, nombre')
            .eq('activo', true);

        const distribucionPorAlmacen = [];
        let valorTotal = 0;

        if (almacenes) {
            for (const almacen of almacenes) {
                const { data: inventario } = await supabase
                    .from('inventario')
                    .select('stock_actual, costo_promedio')
                    .eq('almacen_id', almacen.id)
                    .eq('activo', true);

                const valor = inventario?.reduce((sum, inv) => 
                    sum + (Number(inv.stock_actual || 0) * Number(inv.costo_promedio || 0)), 0) || 0;

                if (valor > 0) {
                    distribucionPorAlmacen.push({
                        almacen: almacen.nombre,
                        codigo: almacen.codigo,
                        valor: Math.round(valor)
                    });
                    valorTotal += valor;
                }
            }

            // Calcular porcentajes
            distribucionPorAlmacen.forEach(almacen => {
                almacen.porcentaje = valorTotal > 0 ? Math.round((almacen.valor / valorTotal) * 100 * 10) / 10 : 0;
            });

            // Ordenar por valor
            distribucionPorAlmacen.sort((a, b) => b.valor - a.valor);
        }

        // Métricas generales
        const valorInicial = evolucionValor.length > 0 ? evolucionValor[0].ingresos : valorActual;
        const variacionPeriodo = valorInicial > 0 ? ((valorActual - valorInicial) / valorInicial * 100) : 0;

        const metricasGenerales = {
            valor_actual: Math.round(valorActual),
            variacion_periodo: Math.round(variacionPeriodo * 10) / 10,
            valor_promedio_dia: dias > 0 ? Math.round(valorActual / dias) : 0
        };

        return {
            success: true,
            data: {
                metricas_generales: metricasGenerales,
                evolucion_valor: evolucionValor,
                distribucion_por_almacen: distribucionPorAlmacen
            }
        };

    } catch (error) {
        logger.error('Error en getValorizacionEvolutiva:', error);
        return {
            success: false,
            error: error.message,
            data: {
                metricas_generales: { valor_actual: 0, variacion_periodo: 0, valor_promedio_dia: 0 },
                evolucion_valor: [],
                distribucion_por_almacen: []
            }
        };
    }
};

/**
 * REPORTE 4: KARDEX INTELIGENTE
 */
const getKardexInteligente = async (periodo = '30d') => {
    try {
        logger.info('Iniciando análisis de kardex inteligente', { periodo });

        const dias = convertirPeriodoADias(periodo);
        const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

        // Obtener productos con movimientos
        const { data: movimientosProductos, error } = await supabase
            .from('movimientos_inventario')
            .select(`
                producto_id,
                cantidad,
                precio_unitario,
                tipo_movimiento,
                usuario_id,
                fecha_movimiento,
                productos:producto_id(codigo, descripcion),
                usuarios:usuario_id(nombre, apellido)
            `)
            .gte('fecha_movimiento', fechaInicio);

        if (error) throw error;

        if (!movimientosProductos || movimientosProductos.length === 0) {
            return {
                success: true,
                data: {
                    productos_destacados: [],
                    analisis_movimientos: {
                        total_movimientos: 0,
                        valor_total_movido: 0,
                        movimientos_por_tipo: {},
                        usuarios_mas_activos: []
                    },
                    insights_automaticos: ['No hay movimientos en el período seleccionado']
                }
            };
        }

        // Agrupar por producto
        const productosMap = new Map();

        movimientosProductos.forEach(mov => {
            if (!mov.productos) return;

            const codigo = mov.productos.codigo;
            if (!productosMap.has(codigo)) {
                productosMap.set(codigo, {
                    codigo,
                    descripcion: mov.productos.descripcion,
                    movimientos: [],
                    valor_total: 0,
                    tipos_movimiento: new Set()
                });
            }

            const producto = productosMap.get(codigo);
            producto.movimientos.push(mov);
            producto.valor_total += Number(mov.cantidad || 0) * Number(mov.precio_unitario || 0);
            producto.tipos_movimiento.add(mov.tipo_movimiento);
        });

        // Analizar productos destacados
        const productosDestacados = Array.from(productosMap.values())
            .map(producto => {
                const movimientosTotales = producto.movimientos.length;
                const valorMovido = Math.round(producto.valor_total);

                // Determinar frecuencia
                let frecuenciaMovimiento = 'Irregular';
                const movimientosPorDia = movimientosTotales / dias;
                
                if (movimientosPorDia >= 1) frecuenciaMovimiento = 'Diaria';
                else if (movimientosPorDia >= 0.14) frecuenciaMovimiento = 'Semanal';
                else if (movimientosPorDia >= 0.03) frecuenciaMovimiento = 'Mensual';

                // Calcular score de importancia
                const scoreVolumen = Math.min(movimientosTotales / 10, 1) * 40;
                const scoreValor = Math.min(valorMovido / 50000, 1) * 40;
                const scoreFrecuencia = frecuenciaMovimiento === 'Diaria' ? 20 : 
                                      frecuenciaMovimiento === 'Semanal' ? 15 : 
                                      frecuenciaMovimiento === 'Mensual' ? 10 : 5;
                const scoreImportancia = Math.round(scoreVolumen + scoreValor + scoreFrecuencia);

                return {
                    codigo: producto.codigo,
                    descripcion: producto.descripcion,
                    movimientos_totales: movimientosTotales,
                    valor_movido: valorMovido,
                    frecuencia_movimiento: frecuenciaMovimiento,
                    tipos_movimiento: Array.from(producto.tipos_movimiento),
                    score_importancia: Math.min(scoreImportancia, 100)
                };
            })
            .sort((a, b) => b.score_importancia - a.score_importancia)
            .slice(0, 10);

        // Análisis de movimientos generales
        const totalMovimientos = movimientosProductos.length;
        const valorTotalMovido = movimientosProductos.reduce((sum, mov) => 
            sum + (Number(mov.cantidad || 0) * Number(mov.precio_unitario || 0)), 0);

        // Movimientos por tipo
        const movimientosPorTipo = {
            entradas: { cantidad: 0, porcentaje: 0 },
            salidas: { cantidad: 0, porcentaje: 0 },
            transferencias: { cantidad: 0, porcentaje: 0 },
            ajustes: { cantidad: 0, porcentaje: 0 }
        };

        movimientosProductos.forEach(mov => {
            switch (mov.tipo_movimiento) {
                case 'ENTRADA':
                case 'INICIAL':
                    movimientosPorTipo.entradas.cantidad++;
                    break;
                case 'SALIDA':
                    movimientosPorTipo.salidas.cantidad++;
                    break;
                case 'TRANSFERENCIA':
                    movimientosPorTipo.transferencias.cantidad++;
                    break;
                case 'AJUSTE_POSITIVO':
                case 'AJUSTE_NEGATIVO':
                    movimientosPorTipo.ajustes.cantidad++;
                    break;
            }
        });

        // Calcular porcentajes
        Object.keys(movimientosPorTipo).forEach(tipo => {
            movimientosPorTipo[tipo].porcentaje = totalMovimientos > 0 
                ? Math.round((movimientosPorTipo[tipo].cantidad / totalMovimientos * 100) * 10) / 10
                : 0;
        });

        // Usuarios más activos
        const usuariosMap = new Map();
        movimientosProductos.forEach(mov => {
            if (!mov.usuarios) return;
            
            const usuarioId = mov.usuario_id;
            const nombre = `${mov.usuarios.nombre} ${mov.usuarios.apellido}`;
            
            if (!usuariosMap.has(usuarioId)) {
                usuariosMap.set(usuarioId, { nombre, movimientos: 0 });
            }
            
            usuariosMap.get(usuarioId).movimientos++;
        });

        const usuariosMasActivos = Array.from(usuariosMap.values())
            .map(usuario => ({
                ...usuario,
                movimientos_por_dia: Math.round((usuario.movimientos / dias) * 10) / 10
            }))
            .sort((a, b) => b.movimientos - a.movimientos)
            .slice(0, 5);

        // Insights automáticos
        const insights = [
            `Se procesaron ${totalMovimientos} movimientos en los últimos ${dias} días`,
            `Valor total movido: $${Math.round(valorTotalMovido).toLocaleString()}`,
        ];

        if (productosDestacados.length > 0) {
            insights.push(`Producto más activo: ${productosDestacados[0].codigo} con ${productosDestacados[0].movimientos_totales} movimientos`);
        }

        if (usuariosMasActivos.length > 0) {
            insights.push(`Usuario más activo: ${usuariosMasActivos[0].nombre} con ${usuariosMasActivos[0].movimientos} movimientos`);
        }

        return {
            success: true,
            data: {
                productos_destacados: productosDestacados,
                analisis_movimientos: {
                    total_movimientos: totalMovimientos,
                    valor_total_movido: Math.round(valorTotalMovido),
                    movimientos_por_tipo: movimientosPorTipo,
                    usuarios_mas_activos: usuariosMasActivos
                },
                insights_automaticos: insights
            }
        };

    } catch (error) {
        logger.error('Error en getKardexInteligente:', error);
        return {
            success: false,
            error: error.message,
            data: {
                productos_destacados: [],
                analisis_movimientos: {
                    total_movimientos: 0,
                    valor_total_movido: 0,
                    movimientos_por_tipo: {},
                    usuarios_mas_activos: []
                },
                insights_automaticos: []
            }
        };
    }
};

/**
 * REPORTE 5: EFICIENCIA DE DESPACHOS
 */
const getEficienciaDespachos = async (periodo = '30d') => {
    try {
        logger.info('Iniciando análisis de eficiencia de despachos', { periodo });

        const dias = convertirPeriodoADias(periodo);
        const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

        // Obtener despachos del período
        const { data: despachos, error } = await supabase
            .from('despachos')
            .select(`
                estado,
                fecha_programada,
                fecha_preparacion,
                fecha_envio,
                fecha_entrega,
                created_at,
                almacenes:almacen_id(nombre, codigo)
            `)
            .gte('created_at', fechaInicio)
            .eq('activo', true);

        if (error) throw error;

        if (!despachos || despachos.length === 0) {
            return {
                success: true,
                data: {
                    kpis_principales: { 
                        tiempo_promedio_preparacion: 0, 
                        tiempo_promedio_entrega: 0, 
                        tasa_entrega_tiempo: 0, 
                        despachos_problema: 0 
                    },
                    distribucion_estados: [],
                    performance_por_almacen: [],
                    tendencia_semanal: []
                }
            };
        }

        // Calcular KPIs principales
        let tiempoPreparacionTotal = 0;
        let tiempoEntregaTotal = 0;
        let despachosConTiempos = 0;
        let despachosEntregadosEnTiempo = 0;
        let despachosConProblemas = 0;

        despachos.forEach(despacho => {
            // Tiempo de preparación
            if (despacho.fecha_preparacion) {
                const tiempoPrep = (new Date(despacho.fecha_preparacion) - new Date(despacho.created_at)) / (1000 * 60 * 60);
                if (tiempoPrep >= 0) {
                    tiempoPreparacionTotal += tiempoPrep;
                    despachosConTiempos++;
                }
            }

            // Tiempo de entrega vs programado
            if (despacho.fecha_entrega && despacho.fecha_programada) {
                const tiempoEntrega = (new Date(despacho.fecha_entrega) - new Date(despacho.fecha_programada)) / (1000 * 60 * 60);
                tiempoEntregaTotal += Math.abs(tiempoEntrega);

                if (new Date(despacho.fecha_entrega) <= new Date(despacho.fecha_programada)) {
                    despachosEntregadosEnTiempo++;
                }
            }

            // Detectar problemas
            if (despacho.estado === 'CANCELADO' || 
                (despacho.fecha_entrega && despacho.fecha_programada && 
                 new Date(despacho.fecha_entrega) > new Date(despacho.fecha_programada))) {
                despachosConProblemas++;
            }
        });

        const totalDespachos = despachos.length;

        const kpisPrincipales = {
            tiempo_promedio_preparacion: despachosConTiempos > 0 ? 
                Math.round((tiempoPreparacionTotal / despachosConTiempos) * 10) / 10 : 0,
            tiempo_promedio_entrega: despachosConTiempos > 0 ? 
                Math.round((tiempoEntregaTotal / despachosConTiempos) * 10) / 10 : 0,
            tasa_entrega_tiempo: totalDespachos > 0 ? 
                Math.round((despachosEntregadosEnTiempo / totalDespachos * 100) * 10) / 10 : 0,
            despachos_problema: despachosConProblemas
        };

        // Distribución por estados
        const estadosMap = new Map();
        despachos.forEach(despacho => {
            const estado = despacho.estado;
            estadosMap.set(estado, (estadosMap.get(estado) || 0) + 1);
        });

        const distribucionEstados = Array.from(estadosMap.entries()).map(([estado, cantidad]) => ({
            estado,
            cantidad,
            porcentaje: Math.round((cantidad / totalDespachos * 100) * 10) / 10
        }));

        // Performance por almacén
        const almacenesMap = new Map();
        despachos.forEach(despacho => {
            if (!despacho.almacenes) return;

            const almacen = despacho.almacenes.nombre;
            if (!almacenesMap.has(almacen)) {
                almacenesMap.set(almacen, {
                    almacen,
                    codigo: despacho.almacenes.codigo,
                    despachos: 0,
                    tiempos_prep: [],
                    tiempos_entrega: [],
                    entregados_tiempo: 0,
                    problemas: 0
                });
            }

            const stats = almacenesMap.get(almacen);
            stats.despachos++;

            if (despacho.fecha_preparacion) {
                const tiempoPrep = (new Date(despacho.fecha_preparacion) - new Date(despacho.created_at)) / (1000 * 60 * 60);
                if (tiempoPrep >= 0) {
                    stats.tiempos_prep.push(tiempoPrep);
                }
            }

            if (despacho.fecha_entrega && despacho.fecha_programada) {
                const tiempoEntrega = (new Date(despacho.fecha_entrega) - new Date(despacho.fecha_programada)) / (1000 * 60 * 60);
                stats.tiempos_entrega.push(Math.abs(tiempoEntrega));

                if (new Date(despacho.fecha_entrega) <= new Date(despacho.fecha_programada)) {
                    stats.entregados_tiempo++;
                }
            }

            if (despacho.estado === 'CANCELADO' || 
                (despacho.fecha_entrega && despacho.fecha_programada && 
                 new Date(despacho.fecha_entrega) > new Date(despacho.fecha_programada))) {
                stats.problemas++;
            }
        });

        const performancePorAlmacen = Array.from(almacenesMap.values()).map(stats => ({
            almacen: stats.almacen,
            codigo: stats.codigo,
            despachos: stats.despachos,
            tiempo_prep: stats.tiempos_prep.length > 0 ? 
                Math.round((stats.tiempos_prep.reduce((a, b) => a + b, 0) / stats.tiempos_prep.length) * 10) / 10 : 0,
            tiempo_entrega: stats.tiempos_entrega.length > 0 ? 
                Math.round((stats.tiempos_entrega.reduce((a, b) => a + b, 0) / stats.tiempos_entrega.length) * 10) / 10 : 0,
            tasa_exito: stats.despachos > 0 ? 
                Math.round((stats.entregados_tiempo / stats.despachos * 100) * 10) / 10 : 0,
            problemas: stats.problemas
        }));

        // Tendencia semanal basada en datos reales
        const tendenciaSemanal = [];
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        for (let i = 0; i < 7; i++) {
            const despachosDia = despachos.filter(d => new Date(d.created_at).getDay() === i);
            const totalDia = despachosDia.length;
            
            let tiempoPromedioDia = 0;
            let eficienciaDia = 0;
            
            if (totalDia > 0) {
                const tiemposPrepDia = despachosDia
                    .filter(d => d.fecha_preparacion)
                    .map(d => (new Date(d.fecha_preparacion) - new Date(d.created_at)) / (1000 * 60 * 60))
                    .filter(t => t >= 0);
                
                tiempoPromedioDia = tiemposPrepDia.length > 0 ? 
                    Math.round((tiemposPrepDia.reduce((a, b) => a + b, 0) / tiemposPrepDia.length) * 10) / 10 : 0;

                const entregadosEnTiempoDia = despachosDia.filter(d => 
                    d.fecha_entrega && d.fecha_programada && 
                    new Date(d.fecha_entrega) <= new Date(d.fecha_programada)
                ).length;

                eficienciaDia = Math.round((entregadosEnTiempoDia / totalDia * 100) * 10) / 10;
            }

            tendenciaSemanal.push({
                dia: diasSemana[i],
                despachos: totalDia,
                tiempo_promedio: tiempoPromedioDia,
                eficiencia: eficienciaDia
            });
        }

        return {
            success: true,
            data: {
                kpis_principales: kpisPrincipales,
                distribucion_estados: distribucionEstados,
                performance_por_almacen: performancePorAlmacen,
                tendencia_semanal: tendenciaSemanal
            }
        };

    } catch (error) {
        logger.error('Error en getEficienciaDespachos:', error);
        return {
            success: false,
            error: error.message,
            data: {
                kpis_principales: { tiempo_promedio_preparacion: 0, tiempo_promedio_entrega: 0, tasa_entrega_tiempo: 0, despachos_problema: 0 },
                distribucion_estados: [],
                performance_por_almacen: [],
                tendencia_semanal: []
            }
        };
    }
};

/**
 * FUNCIONES AUXILIARES PARA ANÁLISIS
 */
const determinarPatronAlerta = (tiposAlerta, frecuencia) => {
    if (frecuencia > 10) return 'Cíclico';
    if (tiposAlerta.has('STOCK_MINIMO') && frecuencia > 5) return 'Estacional';
    if (frecuencia > 8) return 'Tendencial';
    return 'Irregular';
};

const determinarPatronMovimiento = (movimientos, total) => {
    if (total > 50) return 'Demanda creciente';
    if (total > 20) return 'Demanda estable';
    if (total < 5) return 'Declive sostenido';
    return 'Irregular';
};
// ==================== SERVICIOS DE ALERTAS ====================

/**
 * Generar alertas de stock bajo automáticamente
 */
const generarAlertasStockBajo = async () => {
    try {
        const { data: inventariosBajos, error } = await supabase
            .from('inventario')
            .select(`
                *,
                productos:producto_id(codigo, descripcion),
                almacenes:almacen_id(codigo, nombre)
            `)
            .lte('stock_actual', 'stock_minimo')
            .gt('stock_actual', 0)
            .eq('activo', true);
        
        if (error) {
            throw error;
        }
        
        let alertasCreadas = 0;
        
        for (const inventario of inventariosBajos) {
            // Verificar si ya existe alerta activa
            const { data: alertaExistente } = await supabase
                .from('alertas_inventario')
                .select('id')
                .eq('producto_id', inventario.producto_id)
                .eq('almacen_id', inventario.almacen_id)
                .eq('tipo_alerta', 'STOCK_MINIMO')
                .eq('activa', true)
                .single();
            
            if (!alertaExistente) {
                await supabase
                    .from('alertas_inventario')
                    .insert({
                        id: uuidv4(),
                        producto_id: inventario.producto_id,
                        almacen_id: inventario.almacen_id,
                        tipo_alerta: 'STOCK_MINIMO',
                        nivel_prioridad: 'MEDIA',
                        mensaje: `${inventario.productos.codigo} - Stock: ${inventario.stock_actual}, Mínimo: ${inventario.stock_minimo}`,
                        stock_actual: inventario.stock_actual,
                        stock_minimo: inventario.stock_minimo
                    });
                
                alertasCreadas++;
            }
        }
        
        logger.info('Alertas de stock bajo generadas:', { alertasCreadas });
        
        return {
            success: true,
            data: {
                productos_revisados: inventariosBajos.length,
                alertas_creadas: alertasCreadas
            }
        };
        
    } catch (error) {
        logger.error('Error en generarAlertasStockBajo:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Limpiar alertas resueltas antiguas
 */
const limpiarAlertasAntiguas = async (diasAntiguedad = 30) => {
    try {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);
        
        const { data, error } = await supabase
            .from('alertas_inventario')
            .delete()
            .eq('activa', false)
            .lte('fecha_resolucion', fechaLimite.toISOString())
            .select();
        
        if (error) {
            throw error;
        }
        
        const alertasEliminadas = data?.length || 0;
        
        logger.info('Alertas antiguas eliminadas:', { alertasEliminadas, diasAntiguedad });
        
        return {
            success: true,
            data: {
                alertas_eliminadas: alertasEliminadas,
                dias_antiguedad: diasAntiguedad
            }
        };
        
    } catch (error) {
        logger.error('Error en limpiarAlertasAntiguas:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    // Análisis de inventario (NUEVAS)
    getRotacionInventario,
    getEficienciaOperativa,
    getAnalisisStockSeguridad,
    getMapaCalorAlmacenes,
    getTendenciasInventario,
    
    // Stock
    verificarStockDisponible,
    descontarStockVenta,
    transferirStock,
    verificarYCrearAlertas,
    
    // Despachos
    obtenerDespachos,
    obtenerDespachoPorId,
    crearDespachoDesdeVenta,
    actualizarEstadoDespacho,
    actualizarEstadoVentaDesdeDespacho,
    
    // Reportes
    generarKardex, // Renombrado para consistencia
    generarReporteValorizacion,
    obtenerStockConsolidado,
    
    // Upload masivo
    generarPlantillaStock,
    previewUploadStock,
    ejecutarUploadStock,
    
    // Alertas
    generarAlertasStockBajo,
    limpiarAlertasAntiguas,
    getPerformanceComparativa,
    getAnalisisPredictivoAlertas,
    getValorizacionEvolutiva,
    getKardexInteligente,
    getEficienciaDespachos
}; 
console.log('✅ almacenService cargado con funciones:', Object.keys(module.exports).length);