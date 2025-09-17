// =====================================
// CONTROLADOR ESPECÍFICO DE PRODUCTOS EN SOPORTE
// =====================================
// Maneja operaciones específicas de los productos en las 4 categorías
// y el sistema de pausas avanzado

const SoporteModel = require('../models/SoporteModel');
const SoporteService = require('../services/soporteService');
const { validarDatosSoporte, formatearProducto } = require('../utils/soporteHelpers');

class ProductosController {
    // ====================================
    // GESTIÓN DE CATEGORÍAS (LAS 4 COLUMNAS)
    // ====================================

    /**
     * Obtener dashboard de productos por categorías
     * GET /api/soporte/productos/dashboard
     */
    static async obtenerDashboardProductos(req, res) {
        try {
            const resultado = await SoporteModel.obtenerProductosPorCategoria();

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Error obteniendo dashboard de productos',
                    error: resultado.error
                });
            }

            // Formatear productos para UI
            const productosFormateados = {};
            for (const [categoria, productos] of Object.entries(resultado.data)) {
                productosFormateados[categoria] = productos.map(formatearProducto);
            }

            // Calcular estadísticas por categoría
            const estadisticas = {
                total_productos: 0,
                por_categoria: {},
                productos_pausados: 0,
                productos_requieren_atencion: 0,
                eficiencia_promedio: 0
            };

            let totalEficiencia = 0;
            let productosConEficiencia = 0;

            for (const [categoria, productos] of Object.entries(productosFormateados)) {
                const pausados = productos.filter(p => p.esta_pausado).length;
                const requierenAtencion = productos.filter(p => p.requiere_atencion).length;

                estadisticas.por_categoria[categoria] = {
                    total: productos.length,
                    pausados,
                    requieren_atencion: requierenAtencion
                };

                estadisticas.total_productos += productos.length;
                estadisticas.productos_pausados += pausados;
                estadisticas.productos_requieren_atencion += requierenAtencion;

                // Calcular eficiencia promedio
                productos.forEach(p => {
                    if (p.eficiencia_reparacion !== null) {
                        totalEficiencia += p.eficiencia_reparacion;
                        productosConEficiencia++;
                    }
                });
            }

            if (productosConEficiencia > 0) {
                estadisticas.eficiencia_promedio = Math.round(totalEficiencia / productosConEficiencia);
            }

            res.json({
                success: true,
                data: {
                    productos: productosFormateados,
                    estadisticas
                }
            });

        } catch (error) {
            console.error('Error en obtenerDashboardProductos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Mover producto entre categorías
     * PUT /api/soporte/productos/:id/mover-categoria
     */
    static async moverProductoCategoria(req, res) {
        try {
            const { id } = req.params;
            const { nueva_categoria, motivo, observaciones } = req.body;
            const { user } = req;

            if (!id || !nueva_categoria) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de producto y nueva categoría son requeridos'
                });
            }

            // Validar que la nueva categoría sea válida
            const categoriasValidas = ['POR_REPARAR', 'IRREPARABLE', 'IRREPARABLE_REPUESTOS', 'REPARADO'];
            if (!categoriasValidas.includes(nueva_categoria)) {
                return res.status(400).json({
                    success: false,
                    message: 'Categoría inválida',
                    categorias_validas: categoriasValidas
                });
            }

            // Obtener producto actual para validación
            const { data: productoActual, error: errorProducto } = await supabase
                .from('soporte_productos')
                .select('*')
                .eq('id', id)
                .single();

            if (errorProducto) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            // Validaciones específicas por categoría
            if (nueva_categoria === 'REPARADO' && !motivo) {
                return res.status(400).json({
                    success: false,
                    message: 'Motivo de reparación es requerido'
                });
            }

            // Preparar datos de actualización
            const datosActualizacion = {
                categoria: nueva_categoria,
                observaciones_origen: observaciones || motivo,
                updated_by: user.id
            };

            // Lógica específica por categoría
            switch (nueva_categoria) {
                case 'REPARADO':
                    datosActualizacion.estado = 'REPARADO';
                    datosActualizacion.fecha_fin_reparacion = new Date().toISOString();
                    datosActualizacion.verificacion_calidad = true;
                    datosActualizacion.aprobado_por = user.id;
                    break;
                    
                case 'IRREPARABLE':
                    datosActualizacion.estado = 'IRREPARABLE';
                    datosActualizacion.estado_desecho = 'AUN_EN_ALMACEN';
                    break;
                    
                case 'IRREPARABLE_REPUESTOS':
                    datosActualizacion.estado = 'IRREPARABLE';
                    datosActualizacion.estado_desecho = 'AUN_EN_ALMACEN';
                    break;
                    
                case 'POR_REPARAR':
                    datosActualizacion.estado = 'RECIBIDO';
                    break;
            }

            const resultado = await SoporteModel.actualizarProducto(id, datosActualizacion);

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Error moviendo producto de categoría',
                    error: resultado.error
                });
            }

            // Registrar en auditoría
            await SoporteService.registrarAuditoria('PRODUCTO', id, 'CAMBIO_CATEGORIA', {
                categoria_anterior: productoActual.categoria,
                categoria_nueva: nueva_categoria,
                motivo: motivo
            });

            res.json({
                success: true,
                message: `Producto movido a categoría ${nueva_categoria} exitosamente`,
                data: formatearProducto(resultado.data)
            });

        } catch (error) {
            console.error('Error en moverProductoCategoria:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ====================================
    // SISTEMA AVANZADO DE PAUSAS
    // ====================================

    /**
     * Obtener productos pausados con detalles
     * GET /api/soporte/productos/pausados
     */
    static async obtenerProductosPausados(req, res) {
        try {
            const supabase = require('../../../config/supabase');
            
            const { data, error } = await supabase
                .from('vista_productos_con_pausas')
                .select('*')
                .eq('esta_pausado', true)
                .order('fecha_pausa_actual', { ascending: true });

            if (error) throw error;

            // Enriquecer con información de pausas
            const productosConPausas = await Promise.all(
                data.map(async (producto) => {
                    const historialPausas = await SoporteModel.obtenerHistorialPausas(producto.id);
                    return {
                        ...formatearProducto(producto),
                        historial_pausas: historialPausas.data || []
                    };
                })
            );

            res.json({
                success: true,
                data: productosConPausas
            });

        } catch (error) {
            console.error('Error en obtenerProductosPausados:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Pausar múltiples productos con el mismo motivo
     * POST /api/soporte/productos/pausar-multiple
     */
    static async pausarMultiplesProductos(req, res) {
        try {
            const { productos_ids, tipo_pausa, motivo } = req.body;
            const { user } = req;

            if (!productos_ids || !Array.isArray(productos_ids) || productos_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Lista de IDs de productos es requerida'
                });
            }

            if (!tipo_pausa || !motivo) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de pausa y motivo son requeridos'
                });
            }

            const resultados = [];
            const errores = [];

            // Pausar cada producto
            for (const productoId of productos_ids) {
                try {
                    const resultado = await SoporteModel.pausarProducto(
                        productoId, 
                        tipo_pausa, 
                        motivo, 
                        user.id
                    );

                    if (resultado.success) {
                        resultados.push({
                            producto_id: productoId,
                            success: true
                        });
                    } else {
                        errores.push({
                            producto_id: productoId,
                            error: resultado.error
                        });
                    }
                } catch (error) {
                    errores.push({
                        producto_id: productoId,
                        error: error.message
                    });
                }
            }

            res.json({
                success: errores.length === 0,
                message: `${resultados.length} productos pausados, ${errores.length} errores`,
                data: {
                    pausados: resultados,
                    errores: errores
                }
            });

        } catch (error) {
            console.error('Error en pausarMultiplesProductos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de pausas
     * GET /api/soporte/productos/estadisticas-pausas
     */
    static async obtenerEstadisticasPausas(req, res) {
        try {
            const supabase = require('../../../config/supabase');
            
            // Consulta compleja para estadísticas de pausas
            const { data: pausas, error } = await supabase
                .from('soporte_pausas_reparacion')
                .select(`
                    tipo_pausa,
                    es_pausa_justificada,
                    duracion_horas,
                    fecha_inicio,
                    estado
                `)
                .eq('activo', true);

            if (error) throw error;

            // Procesar estadísticas
            const estadisticas = {
                total_pausas: pausas.length,
                pausas_activas: pausas.filter(p => p.estado === 'ACTIVA').length,
                pausas_justificadas: pausas.filter(p => p.es_pausa_justificada).length,
                pausas_injustificadas: pausas.filter(p => !p.es_pausa_justificada).length,
                
                por_tipo: {},
                duracion_promedio_por_tipo: {},
                
                pausas_mas_largas: [],
                tipos_mas_frecuentes: [],
                
                tendencias_mensuales: {}
            };

            // Agrupar por tipo
            pausas.forEach(pausa => {
                // Contar por tipo
                estadisticas.por_tipo[pausa.tipo_pausa] = 
                    (estadisticas.por_tipo[pausa.tipo_pausa] || 0) + 1;
                
                // Calcular duraciones (solo para pausas finalizadas)
                if (pausa.duracion_horas) {
                    if (!estadisticas.duracion_promedio_por_tipo[pausa.tipo_pausa]) {
                        estadisticas.duracion_promedio_por_tipo[pausa.tipo_pausa] = [];
                    }
                    estadisticas.duracion_promedio_por_tipo[pausa.tipo_pausa].push(pausa.duracion_horas);
                }
            });

            // Calcular promedios de duración
            for (const tipo in estadisticas.duracion_promedio_por_tipo) {
                const duraciones = estadisticas.duracion_promedio_por_tipo[tipo];
                const promedio = duraciones.reduce((a, b) => a + b, 0) / duraciones.length;
                estadisticas.duracion_promedio_por_tipo[tipo] = Math.round(promedio);
            }

            // Tipos más frecuentes
            estadisticas.tipos_mas_frecuentes = Object.entries(estadisticas.por_tipo)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([tipo, cantidad]) => ({ tipo, cantidad }));

            res.json({
                success: true,
                data: estadisticas
            });

        } catch (error) {
            console.error('Error en obtenerEstadisticasPausas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ====================================
    // GESTIÓN AVANZADA DE ESTADOS
    // ====================================

    /**
     * Procesar lote de productos (cambiar estado a múltiples)
     * PUT /api/soporte/productos/procesar-lote
     */
    static async procesarLoteProductos(req, res) {
        try {
            const { productos_ids, accion, datos_adicionales } = req.body;
            const { user } = req;

            if (!productos_ids || !Array.isArray(productos_ids) || !accion) {
                return res.status(400).json({
                    success: false,
                    message: 'Lista de productos y acción son requeridos'
                });
            }

            const acciones_validas = ['marcar_reparado', 'marcar_irreparable', 'enviar_diagnostico'];
            if (!acciones_validas.includes(accion)) {
                return res.status(400).json({
                    success: false,
                    message: 'Acción inválida',
                    acciones_validas
                });
            }

            const resultados = [];
            const errores = [];

            for (const productoId of productos_ids) {
                try {
                    let datosActualizacion = { updated_by: user.id };

                    switch (accion) {
                        case 'marcar_reparado':
                            datosActualizacion = {
                                ...datosActualizacion,
                                categoria: 'REPARADO',
                                estado: 'REPARADO',
                                fecha_fin_reparacion: new Date().toISOString(),
                                verificacion_calidad: true,
                                aprobado_por: user.id,
                                reparacion_realizada: datos_adicionales?.observaciones || 'Procesado en lote'
                            };
                            break;

                        case 'marcar_irreparable':
                            datosActualizacion = {
                                ...datosActualizacion,
                                categoria: 'IRREPARABLE',
                                estado: 'IRREPARABLE',
                                estado_desecho: 'AUN_EN_ALMACEN',
                                diagnostico: datos_adicionales?.motivo || 'Irreparable - procesado en lote'
                            };
                            break;

                        case 'enviar_diagnostico':
                            datosActualizacion = {
                                ...datosActualizacion,
                                estado: 'EN_DIAGNOSTICO',
                                fecha_diagnostico: new Date().toISOString().split('T')[0]
                            };
                            break;
                    }

                    const resultado = await SoporteModel.actualizarProducto(productoId, datosActualizacion);

                    if (resultado.success) {
                        resultados.push({
                            producto_id: productoId,
                            success: true,
                            data: resultado.data
                        });
                    } else {
                        errores.push({
                            producto_id: productoId,
                            error: resultado.error
                        });
                    }

                } catch (error) {
                    errores.push({
                        producto_id: productoId,
                        error: error.message
                    });
                }
            }

            // Registrar en auditoría
            await SoporteService.registrarAuditoria('PRODUCTO', 'MULTIPLE', 'PROCESAMIENTO_LOTE', {
                accion: accion,
                productos_procesados: resultados.length,
                errores: errores.length
            });

            res.json({
                success: errores.length === 0,
                message: `${resultados.length} productos procesados, ${errores.length} errores`,
                data: {
                    procesados: resultados,
                    errores: errores
                }
            });

        } catch (error) {
            console.error('Error en procesarLoteProductos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ====================================
    // REPORTES ESPECÍFICOS DE PRODUCTOS
    // ====================================

    /**
     * Reporte de eficiencia de reparaciones
     * GET /api/soporte/productos/reporte-eficiencia
     */
    static async obtenerReporteEficiencia(req, res) {
        try {
            const { fecha_desde, fecha_hasta, tecnico_id } = req.query;
            const supabase = require('../../../config/supabase');

            let query = supabase
                .from('vista_productos_con_pausas')
                .select('*')
                .not('tiempo_efectivo_horas', 'is', null);

            // Aplicar filtros
            if (fecha_desde) {
                query = query.gte('fecha_recepcion', fecha_desde);
            }
            if (fecha_hasta) {
                query = query.lte('fecha_recepcion', fecha_hasta);
            }

            const { data, error } = await query.order('eficiencia_porcentaje', { ascending: false });

            if (error) throw error;

            // Calcular estadísticas del reporte
            const estadisticas = {
                total_productos: data.length,
                eficiencia_promedio: 0,
                tiempo_neto_promedio: 0,
                tiempo_bruto_promedio: 0,
                productos_con_pausas: data.filter(p => p.total_horas_pausadas > 0).length,
                mejor_eficiencia: null,
                peor_eficiencia: null
            };

            if (data.length > 0) {
                estadisticas.eficiencia_promedio = Math.round(
                    data.reduce((sum, p) => sum + (p.eficiencia_porcentaje || 0), 0) / data.length
                );
                
                estadisticas.tiempo_neto_promedio = Math.round(
                    data.reduce((sum, p) => sum + (p.tiempo_efectivo_horas || 0), 0) / data.length
                );
                
                estadisticas.tiempo_bruto_promedio = Math.round(
                    data.reduce((sum, p) => sum + (p.tiempo_total_horas || 0), 0) / data.length
                );

                estadisticas.mejor_eficiencia = data[0];
                estadisticas.peor_eficiencia = data[data.length - 1];
            }

            res.json({
                success: true,
                data: {
                    productos: data.map(formatearProducto),
                    estadisticas
                }
            });

        } catch (error) {
            console.error('Error en obtenerReporteEficiencia:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener productos que requieren atención urgente
     * GET /api/soporte/productos/atencion-urgente
     */
    static async obtenerProductosAtencionUrgente(req, res) {
        try {
            const resultado = await SoporteModel.obtenerProductosPorCategoria();

            if (!resultado.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Error obteniendo productos',
                    error: resultado.error
                });
            }

            // Filtrar productos que requieren atención
            const productosUrgentes = [];
            
            for (const productos of Object.values(resultado.data)) {
                productos.forEach(producto => {
                    const productoFormateado = formatearProducto(producto);
                    if (productoFormateado.requiere_atencion) {
                        productosUrgentes.push(productoFormateado);
                    }
                });
            }

            // Ordenar por prioridad (pausados primero, luego por tiempo)
            productosUrgentes.sort((a, b) => {
                if (a.esta_pausado && !b.esta_pausado) return -1;
                if (!a.esta_pausado && b.esta_pausado) return 1;
                
                // Si ambos tienen el mismo tipo, ordenar por tiempo
                const tiempoA = new Date(a.fecha_recepcion || a.created_at);
                const tiempoB = new Date(b.fecha_recepcion || b.created_at);
                return tiempoA - tiempoB;
            });

            res.json({
                success: true,
                data: productosUrgentes,
                total: productosUrgentes.length
            });

        } catch (error) {
            console.error('Error en obtenerProductosAtencionUrgente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = ProductosController;