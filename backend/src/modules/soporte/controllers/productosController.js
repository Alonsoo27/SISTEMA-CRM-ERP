// =====================================
// CONTROLADOR ESPECÍFICO DE PRODUCTOS EN SOPORTE - VERSIÓN CORREGIDA POSTGRESQL
// =====================================
// Maneja operaciones específicas de los productos en las 4 categorías
// y el sistema de pausas avanzado
// CORREGIDO: Usa PostgreSQL directo con función query() en lugar de Supabase SDK

const { query } = require('../../../config/database');
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

            // CORREGIDO: Obtener producto actual para validación usando PostgreSQL directo
            const sqlProducto = `
                SELECT * FROM soporte_productos 
                WHERE id = $1 AND activo = true
            `;
            const resultProducto = await query(sqlProducto, [id]);

            if (resultProducto.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            const productoActual = resultProducto.rows[0];

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
                updated_by: user.id,
                updated_at: new Date()
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

            // Registrar en auditoría (si el servicio está disponible)
            try {
                await SoporteService.registrarAuditoria('PRODUCTO', id, 'CAMBIO_CATEGORIA', {
                    categoria_anterior: productoActual.categoria,
                    categoria_nueva: nueva_categoria,
                    motivo: motivo
                });
            } catch (auditError) {
                console.log('Servicio de auditoría no disponible:', auditError.message);
            }

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
            // CORREGIDO: Usar PostgreSQL directo en lugar de Supabase
            let productos = [];
            
            try {
                // Intentar usar la vista primero
                const sqlVista = `
                    SELECT * FROM vista_productos_con_pausas 
                    WHERE esta_pausado = true 
                    ORDER BY fecha_pausa_actual ASC
                `;
                const resultVista = await query(sqlVista, []);
                productos = resultVista.rows;
            } catch (vistaError) {
                // Si la vista no existe, usar consulta directa
                console.log('Vista vista_productos_con_pausas no disponible, usando consulta directa');
                const sqlDirecta = `
                    SELECT sp.*, pr.fecha_pausa_actual, pr.tipo_pausa
                    FROM soporte_productos sp
                    INNER JOIN soporte_pausas_reparacion pr ON sp.id = pr.producto_id
                    WHERE pr.activo = true AND sp.activo = true
                    ORDER BY pr.fecha_inicio ASC
                `;
                const resultDirecta = await query(sqlDirecta, []);
                productos = resultDirecta.rows.map(row => ({
                    ...row,
                    esta_pausado: true
                }));
            }

            // Enriquecer con información de pausas
            const productosConPausas = await Promise.all(
                productos.map(async (producto) => {
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
            // CORREGIDO: Consulta compleja para estadísticas de pausas usando PostgreSQL directo
            const sql = `
                SELECT tipo_pausa,
                       es_pausa_justificada,
                       duracion_horas,
                       fecha_inicio,
                       estado
                FROM soporte_pausas_reparacion 
                WHERE activo = true
            `;
            const result = await query(sql, []);
            const pausas = result.rows;

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
                    let datosActualizacion = { 
                        updated_by: user.id,
                        updated_at: new Date()
                    };

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

            // Registrar en auditoría (si el servicio está disponible)
            try {
                await SoporteService.registrarAuditoria('PRODUCTO', 'MULTIPLE', 'PROCESAMIENTO_LOTE', {
                    accion: accion,
                    productos_procesados: resultados.length,
                    errores: errores.length
                });
            } catch (auditError) {
                console.log('Servicio de auditoría no disponible:', auditError.message);
            }

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

            // CORREGIDO: Construir query PostgreSQL directo con filtros opcionales
            let condiciones = ['tiempo_efectivo_horas IS NOT NULL'];
            const valores = [];
            let contador = 1;

            // Aplicar filtros
            if (fecha_desde) {
                condiciones.push(`fecha_recepcion >= $${contador}`);
                valores.push(fecha_desde);
                contador++;
            }
            if (fecha_hasta) {
                condiciones.push(`fecha_recepcion <= $${contador}`);
                valores.push(fecha_hasta);
                contador++;
            }

            // CORREGIDO: Intentar usar vista, si no existe usar consulta directa
            let productos = [];
            try {
                const sqlVista = `
                    SELECT * FROM vista_productos_con_pausas 
                    WHERE ${condiciones.join(' AND ')} 
                    ORDER BY eficiencia_porcentaje DESC
                `;
                const resultVista = await query(sqlVista, valores);
                productos = resultVista.rows;
            } catch (vistaError) {
                // Si la vista no existe, usar consulta directa
                console.log('Vista vista_productos_con_pausas no disponible, usando consulta directa');
                const sqlDirecta = `
                    SELECT sp.*, 
                           COALESCE(sp.tiempo_efectivo_horas, 0) as tiempo_efectivo_horas,
                           CASE 
                               WHEN sp.tiempo_total_horas > 0 AND sp.tiempo_efectivo_horas > 0 
                               THEN ROUND((sp.tiempo_efectivo_horas::numeric / sp.tiempo_total_horas::numeric) * 100, 2)
                               ELSE 0 
                           END as eficiencia_porcentaje
                    FROM soporte_productos sp
                    WHERE ${condiciones.join(' AND ')} AND sp.activo = true
                    ORDER BY eficiencia_porcentaje DESC
                `;
                const resultDirecta = await query(sqlDirecta, valores);
                productos = resultDirecta.rows;
            }

            // Calcular estadísticas del reporte
            const estadisticas = {
                total_productos: productos.length,
                eficiencia_promedio: 0,
                tiempo_neto_promedio: 0,
                tiempo_bruto_promedio: 0,
                productos_con_pausas: productos.filter(p => p.total_horas_pausadas > 0).length,
                mejor_eficiencia: null,
                peor_eficiencia: null
            };

            if (productos.length > 0) {
                estadisticas.eficiencia_promedio = Math.round(
                    productos.reduce((sum, p) => sum + (p.eficiencia_porcentaje || 0), 0) / productos.length
                );
                
                estadisticas.tiempo_neto_promedio = Math.round(
                    productos.reduce((sum, p) => sum + (p.tiempo_efectivo_horas || 0), 0) / productos.length
                );
                
                estadisticas.tiempo_bruto_promedio = Math.round(
                    productos.reduce((sum, p) => sum + (p.tiempo_total_horas || 0), 0) / productos.length
                );

                estadisticas.mejor_eficiencia = productos[0];
                estadisticas.peor_eficiencia = productos[productos.length - 1];
            }

            res.json({
                success: true,
                data: {
                    productos: productos.map(formatearProducto),
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

            // MEJORA: Ordenar por prioridad más inteligente
            productosUrgentes.sort((a, b) => {
                // Pausados primero
                if (a.esta_pausado && !b.esta_pausado) return -1;
                if (!a.esta_pausado && b.esta_pausado) return 1;
                
                // Si ambos tienen el mismo tipo, ordenar por tiempo (más antiguos primero)
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