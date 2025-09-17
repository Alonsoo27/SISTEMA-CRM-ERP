// ============================================
// REPORTES VENTAS SERVICE - ANALYTICS EMPRESARIAL CORREGIDO
// Sistema CRM/ERP v2.0 - Compatible PostgreSQL
// ============================================

const { query } = require('../../../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class ReportesVentasService {

    // ==========================================
    // REPORTES EJECUTIVOS PRINCIPALES
    // ==========================================
    
    static async generarReporteEjecutivo(params) {
        try {
            const {
                fecha_desde,
                fecha_hasta,
                asesor_id,
                equipo_id,
                formato = 'json',
                incluir_graficos = true
            } = params;
            
            const reporte = {
                metadata: {
                    titulo: 'Reporte Ejecutivo de Ventas',
                    periodo: { desde: fecha_desde, hasta: fecha_hasta },
                    fecha_generacion: new Date().toISOString(),
                    parametros: params
                },
                resumen_ejecutivo: await this._generarResumenEjecutivo(params),
                metricas_clave: await this._generarMetricasClave(params),
                analisis_pipeline: await this._generarAnalisisPipeline(params),
                rendimiento_asesores: await this._generarRendimientoAsesores(params),
                analisis_productos: await this._generarAnalisisProductos(params),
                tendencias_temporales: await this._generarTendenciasTemporales(params),
                conversion_metrics: await this._generarMetricasConversion(params)
            };
            
            if (incluir_graficos) {
                reporte.graficos = await this._generarDatosGraficos(params);
            }
            
            // Generar archivo según formato solicitado
            switch (formato) {
                case 'excel':
                    return await this._exportarReporteExcel(reporte);
                case 'pdf':
                    return await this._exportarReportePDF(reporte);
                default:
                    return reporte;
            }
            
        } catch (error) {
            console.error('Error generando reporte ejecutivo:', error);
            throw error;
        }
    }
    
    static async generarReportePipeline(params) {
        try {
            const {
                fecha_desde,
                fecha_hasta,
                asesor_id,
                incluir_proyecciones = true
            } = params;
            
            let whereConditions = ['v.eliminado = false'];
            let queryParams = [];
            
            if (fecha_desde) {
                whereConditions.push('v.fecha_creacion >= $' + (queryParams.length + 1));
                queryParams.push(fecha_desde);
            }
            
            if (fecha_hasta) {
                whereConditions.push('v.fecha_creacion <= $' + (queryParams.length + 1));
                queryParams.push(fecha_hasta);
            }
            
            if (asesor_id) {
                whereConditions.push('v.asesor_id = $' + (queryParams.length + 1));
                queryParams.push(asesor_id);
            }
            
            // Estado actual del pipeline - SINTAXIS POSTGRESQL
            const [estadoPipeline] = await query.execute(
                `SELECT 
                    v.estado,
                    COUNT(*) as cantidad_ventas,
                    SUM(v.valor_total) as valor_total,
                    AVG(v.valor_total) as valor_promedio,
                    AVG(EXTRACT(DAY FROM (NOW() - v.fecha_creacion))) as dias_promedio_estado
                 FROM ventas v
                 WHERE ${whereConditions.join(' AND ')}
                 GROUP BY v.estado
                 ORDER BY 
                    CASE v.estado 
                        WHEN 'Prospecto' THEN 1
                        WHEN 'Contactado' THEN 2  
                        WHEN 'Interesado' THEN 3
                        WHEN 'Cotizacion' THEN 4
                        WHEN 'Negociacion' THEN 5
                        WHEN 'Aprobada' THEN 6
                        WHEN 'Completada' THEN 7
                        WHEN 'Cancelada' THEN 8
                    END`,
                queryParams
            );
            
            // Velocity del pipeline - POSTGRESQL
            const [velocityPipeline] = await query.execute(
                `SELECT 
                    AVG(EXTRACT(DAY FROM (COALESCE(fecha_cierre, NOW()) - fecha_creacion))) as dias_promedio_cierre,
                    MIN(EXTRACT(DAY FROM (COALESCE(fecha_cierre, NOW()) - fecha_creacion))) as dias_minimo_cierre,
                    MAX(EXTRACT(DAY FROM (COALESCE(fecha_cierre, NOW()) - fecha_creacion))) as dias_maximo_cierre,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(DAY FROM (COALESCE(fecha_cierre, NOW()) - fecha_creacion))) as mediana_dias_cierre
                 FROM ventas v
                 WHERE ${whereConditions.join(' AND ')}
                   AND v.estado IN ('Completada', 'Entregada')`,
                queryParams
            );
            
            let proyecciones = null;
            if (incluir_proyecciones) {
                proyecciones = await this._calcularProyeccionesPipeline(queryParams, whereConditions);
            }
            
            return {
                metadata: {
                    titulo: 'Análisis de Pipeline de Ventas',
                    fecha_generacion: new Date().toISOString(),
                    parametros: params
                },
                estado_pipeline: estadoPipeline,
                velocity_pipeline: velocityPipeline[0] || {},
                proyecciones: proyecciones,
                valor_total_pipeline: estadoPipeline.reduce((sum, estado) => sum + parseFloat(estado.valor_total || 0), 0),
                cantidad_total_pipeline: estadoPipeline.reduce((sum, estado) => sum + parseInt(estado.cantidad_ventas || 0), 0)
            };
            
        } catch (error) {
            console.error('Error generando reporte de pipeline:', error);
            throw error;
        }
    }
    
    static async generarReporteBonos(params) {
        try {
            const {
                fecha_desde,
                fecha_hasta,
                asesor_id,
                estado_bono = 'all'
            } = params;
            
            let whereConditions = ['c.eliminado = false'];
            let queryParams = [];
            
            if (fecha_desde) {
                whereConditions.push('c.created_at >= $' + (queryParams.length + 1));
                queryParams.push(fecha_desde);
            }
            
            if (fecha_hasta) {
                whereConditions.push('c.created_at <= $' + (queryParams.length + 1));
                queryParams.push(fecha_hasta);
            }
            
            if (asesor_id) {
                whereConditions.push('c.asesor_id = $' + (queryParams.length + 1));
                queryParams.push(asesor_id);
            }
            
            if (estado_bono !== 'all') {
                whereConditions.push('c.estado = $' + (queryParams.length + 1));
                queryParams.push(estado_bono);
            }
            
            // Resumen de bonos por asesor - USANDO TU ESTRUCTURA REAL
            const [bonosPorAsesor] = await query.execute(
                `SELECT 
                    u.nombre as asesor, u.apellido as asesor_apellido,
                    c.asesor_id,
                    COUNT(*) as total_bonos,
                    SUM(c.bono_usd) as total_bono_usd,
                    AVG(c.porcentaje_cumplimiento) as porcentaje_promedio,
                    SUM(CASE WHEN c.estado = 'Pagado' THEN c.bono_usd ELSE 0 END) as bonos_pagados,
                    SUM(CASE WHEN c.estado = 'Calculado' THEN c.bono_usd ELSE 0 END) as bonos_pendientes,
                    MIN(c.created_at) as primer_bono,
                    MAX(c.created_at) as ultimo_bono
                 FROM comisiones c
                 JOIN usuarios u ON c.asesor_id = u.id
                 WHERE ${whereConditions.join(' AND ')}
                 GROUP BY c.asesor_id, u.nombre, u.apellido
                 ORDER BY total_bono_usd DESC`,
                queryParams
            );
            
            // Evolución mensual de bonos - POSTGRESQL
            const [evolucionMensual] = await query.execute(
                `SELECT 
                    TO_CHAR(c.created_at, 'YYYY-MM') as mes,
                    COUNT(*) as cantidad_bonos,
                    SUM(c.bono_usd) as total_bonos_usd,
                    AVG(c.bono_usd) as promedio_bono,
                    COUNT(DISTINCT c.asesor_id) as asesores_activos
                 FROM comisiones c
                 WHERE ${whereConditions.join(' AND ')}
                 GROUP BY TO_CHAR(c.created_at, 'YYYY-MM')
                 ORDER BY mes DESC
                 LIMIT 12`,
                queryParams
            );
            
            // Estadísticas generales
            const [estadisticasGenerales] = await query.execute(
                `SELECT 
                    COUNT(*) as total_bonos,
                    SUM(c.bono_usd) as monto_total_usd,
                    AVG(c.bono_usd) as promedio_bono,
                    AVG(c.porcentaje_cumplimiento) as porcentaje_promedio,
                    COUNT(DISTINCT c.asesor_id) as asesores_con_bonos,
                    SUM(CASE WHEN c.estado = 'Pagado' THEN 1 ELSE 0 END) as bonos_pagados,
                    SUM(CASE WHEN c.estado = 'Calculado' THEN 1 ELSE 0 END) as bonos_pendientes
                 FROM comisiones c
                 WHERE ${whereConditions.join(' AND ')}`,
                queryParams
            );
            
            return {
                metadata: {
                    titulo: 'Reporte de Sistema de Bonos',
                    fecha_generacion: new Date().toISOString(),
                    parametros: params
                },
                estadisticas_generales: estadisticasGenerales[0],
                bonos_por_asesor: bonosPorAsesor,
                evolucion_mensual: evolucionMensual
            };
            
        } catch (error) {
            console.error('Error generando reporte de bonos:', error);
            throw error;
        }
    }

    // ==========================================
    // ANÁLISIS AVANZADOS Y PREDICTIVOS
    // ==========================================
    
    static async generarAnalisisPredictivo(params) {
        try {
            const { asesor_id, meses_historicos = 6 } = params;
            
            // Datos históricos para análisis de tendencias - POSTGRESQL
            const [datosHistoricos] = await query.execute(
                `SELECT 
                    TO_CHAR(fecha_creacion, 'YYYY-MM') as mes,
                    COUNT(*) as cantidad_ventas,
                    SUM(valor_total) as valor_total,
                    AVG(valor_total) as valor_promedio,
                    COUNT(DISTINCT asesor_id) as asesores_activos
                 FROM ventas
                 WHERE eliminado = false
                   AND fecha_creacion >= NOW() - INTERVAL '${meses_historicos} months'
                   ${asesor_id ? 'AND asesor_id = $1' : ''}
                 GROUP BY TO_CHAR(fecha_creacion, 'YYYY-MM')
                 ORDER BY mes`,
                asesor_id ? [asesor_id] : []
            );
            
            // Calcular tendencias usando regresión lineal simple
            const tendencias = this._calcularTendencias(datosHistoricos);
            
            // Proyección para próximos 3 meses
            const proyecciones = this._calcularProyecciones(datosHistoricos, tendencias, 3);
            
            return {
                metadata: {
                    titulo: 'Análisis Predictivo de Ventas',
                    fecha_generacion: new Date().toISOString(),
                    meses_analizados: meses_historicos
                },
                datos_historicos: datosHistoricos,
                tendencias: tendencias,
                proyecciones: proyecciones,
                confiabilidad: this._calcularConfiabilidad(datosHistoricos)
            };
            
        } catch (error) {
            console.error('Error generando análisis predictivo:', error);
            throw error;
        }
    }
    
    static async generarAnalisisProductos(params) {
        try {
            const { incluir_categorias = true } = params;
            
            // Análisis de productos más vendidos - COMPATIBLE CON TU ESTRUCTURA
            const [productosTop] = await query.execute(
                `SELECT 
                    p.nombre as producto,
                    p.categoria,
                    COUNT(v.id) as ventas_cantidad,
                    SUM(v.valor_total) as ventas_valor,
                    AVG(v.valor_total) as precio_promedio
                 FROM productos p
                 LEFT JOIN ventas v ON p.id = v.producto_id AND v.eliminado = false
                 WHERE p.eliminado = false
                 GROUP BY p.id, p.nombre, p.categoria
                 ORDER BY ventas_valor DESC NULLS LAST
                 LIMIT 20`
            );
            
            let analisisCategoria = [];
            if (incluir_categorias) {
                // Análisis por categoría - USANDO TUS CATEGORÍAS REALES
                const [categorias] = await query.execute(
                    `SELECT 
                        p.categoria,
                        COUNT(p.id) as productos_categoria,
                        COUNT(v.id) as ventas_cantidad,
                        SUM(v.valor_total) as ventas_totales,
                        AVG(v.valor_total) as precio_promedio_categoria
                     FROM productos p
                     LEFT JOIN ventas v ON p.id = v.producto_id AND v.eliminado = false
                     WHERE p.eliminado = false
                     GROUP BY p.categoria
                     ORDER BY ventas_totales DESC NULLS LAST`
                );
                analisisCategoria = categorias;
            }
            
            return {
                metadata: {
                    titulo: 'Análisis de Productos y Categorías',
                    fecha_generacion: new Date().toISOString()
                },
                productos_top: productosTop,
                analisis_categoria: analisisCategoria,
                resumen: {
                    total_productos: productosTop.length,
                    productos_con_ventas: productosTop.filter(p => p.ventas_cantidad > 0).length,
                    categorias_activas: [...new Set(productosTop.map(p => p.categoria))].length
                }
            };
            
        } catch (error) {
            console.error('Error generando análisis de productos:', error);
            throw error;
        }
    }

    // ==========================================
    // EXPORTACIÓN DE REPORTES
    // ==========================================
    
    static async _exportarReporteExcel(reporte) {
        try {
            const workbook = new ExcelJS.Workbook();
            
            // Hoja de resumen ejecutivo
            const resumenSheet = workbook.addWorksheet('Resumen Ejecutivo');
            
            // Configurar estilos
            const headerStyle = {
                font: { bold: true, color: { argb: 'FFFFFF' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } },
                alignment: { horizontal: 'center' }
            };
            
            // Agregar título
            resumenSheet.mergeCells('A1:F1');
            resumenSheet.getCell('A1').value = reporte.metadata.titulo;
            resumenSheet.getCell('A1').style = {
                font: { bold: true, size: 16 },
                alignment: { horizontal: 'center' }
            };
            
            // Agregar métricas clave
            let row = 3;
            if (reporte.metricas_clave) {
                resumenSheet.getCell(`A${row}`).value = 'Métricas Clave';
                resumenSheet.getCell(`A${row}`).style = headerStyle;
                
                row++;
                for (const [key, value] of Object.entries(reporte.metricas_clave)) {
                    resumenSheet.getCell(`A${row}`).value = this._formatearNombreMetrica(key);
                    resumenSheet.getCell(`B${row}`).value = value;
                    row++;
                }
            }
            
            // Generar buffer del archivo
            const buffer = await workbook.xlsx.writeBuffer();
            
            return {
                tipo: 'excel',
                nombre_archivo: `reporte_ventas_${new Date().toISOString().split('T')[0]}.xlsx`,
                buffer: buffer,
                size: buffer.length
            };
            
        } catch (error) {
            console.error('Error exportando a Excel:', error);
            throw error;
        }
    }
    
    static async _exportarReportePDF(reporte) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];
                
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        tipo: 'pdf',
                        nombre_archivo: `reporte_ventas_${new Date().toISOString().split('T')[0]}.pdf`,
                        buffer: buffer,
                        size: buffer.length
                    });
                });
                
                // Configurar fuentes y estilos
                doc.fontSize(20).text(reporte.metadata.titulo, { align: 'center' });
                doc.moveDown();
                
                // Fecha de generación
                doc.fontSize(10).text(`Generado el: ${new Date(reporte.metadata.fecha_generacion).toLocaleString()}`, { align: 'right' });
                doc.moveDown();
                
                // Resumen ejecutivo
                if (reporte.resumen_ejecutivo) {
                    doc.fontSize(16).text('Resumen Ejecutivo', { underline: true });
                    doc.moveDown();
                    doc.fontSize(12).text('Análisis del período especificado');
                    doc.moveDown();
                }
                
                // Métricas clave
                if (reporte.metricas_clave) {
                    doc.fontSize(14).text('Métricas Principales', { underline: true });
                    doc.moveDown();
                    
                    for (const [key, value] of Object.entries(reporte.metricas_clave)) {
                        doc.fontSize(11).text(`${this._formatearNombreMetrica(key)}: ${this._formatearValorMetrica(key, value)}`);
                    }
                    doc.moveDown();
                }
                
                // Finalizar documento
                doc.end();
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // ==========================================
    // MÉTODOS AUXILIARES IMPLEMENTADOS
    // ==========================================
    
    static async _generarResumenEjecutivo(params) {
        try {
            let whereConditions = ['eliminado = false'];
            let queryParams = [];
            
            if (params.fecha_desde) {
                whereConditions.push('fecha_creacion >= $' + (queryParams.length + 1));
                queryParams.push(params.fecha_desde);
            }
            
            if (params.fecha_hasta) {
                whereConditions.push('fecha_creacion <= $' + (queryParams.length + 1));
                queryParams.push(params.fecha_hasta);
            }
            
            if (params.asesor_id) {
                whereConditions.push('asesor_id = $' + (queryParams.length + 1));
                queryParams.push(params.asesor_id);
            }
            
            const [resumen] = await query.execute(
                `SELECT 
                    COUNT(*) as total_ventas,
                    SUM(valor_total) as valor_total,
                    AVG(valor_total) as valor_promedio,
                    COUNT(DISTINCT asesor_id) as asesores_activos,
                    SUM(CASE WHEN estado = 'Completada' THEN 1 ELSE 0 END) as ventas_completadas,
                    SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as ventas_canceladas
                 FROM ventas 
                 WHERE ${whereConditions.join(' AND ')}`,
                queryParams
            );
            
            return resumen[0] || {};
        } catch (error) {
            console.error('Error generando resumen ejecutivo:', error);
            return {};
        }
    }
    
    static async _generarMetricasClave(params) {
        try {
            const resumen = await this._generarResumenEjecutivo(params);
            
            return {
                total_ventas: resumen.total_ventas || 0,
                valor_total: resumen.valor_total || 0,
                valor_promedio: resumen.valor_promedio || 0,
                tasa_conversion: resumen.total_ventas > 0 ? 
                    (resumen.ventas_completadas / resumen.total_ventas * 100).toFixed(2) + '%' : '0%',
                tasa_cancelacion: resumen.total_ventas > 0 ? 
                    (resumen.ventas_canceladas / resumen.total_ventas * 100).toFixed(2) + '%' : '0%',
                asesores_activos: resumen.asesores_activos || 0
            };
        } catch (error) {
            console.error('Error generando métricas clave:', error);
            return {};
        }
    }

    static async _generarAnalisisPipeline(params) {
        try {
            return await this.generarReportePipeline(params);
        } catch (error) {
            console.error('Error generando análisis pipeline:', error);
            return { mensaje: 'Error generando análisis de pipeline' };
        }
    }

    static async _generarRendimientoAsesores(params) {
        try {
            let whereConditions = ['v.eliminado = false'];
            let queryParams = [];
            
            if (params.fecha_desde) {
                whereConditions.push('v.fecha_creacion >= $' + (queryParams.length + 1));
                queryParams.push(params.fecha_desde);
            }
            
            if (params.fecha_hasta) {
                whereConditions.push('v.fecha_creacion <= $' + (queryParams.length + 1));
                queryParams.push(params.fecha_hasta);
            }
            
            const [asesores] = await query.execute(
                `SELECT 
                    u.nombre, u.apellido,
                    COUNT(v.id) as total_ventas,
                    SUM(v.valor_total) as ingresos_totales,
                    AVG(v.valor_total) as ticket_promedio
                 FROM usuarios u
                 LEFT JOIN ventas v ON u.id = v.asesor_id AND ${whereConditions.join(' AND ')}
                 WHERE u.rol IN ('asesor', 'vendedor', 'admin') AND u.activo = true
                 GROUP BY u.id, u.nombre, u.apellido
                 ORDER BY ingresos_totales DESC NULLS LAST
                 LIMIT 10`,
                queryParams
            );
            
            return asesores;
        } catch (error) {
            console.error('Error generando rendimiento asesores:', error);
            return [];
        }
    }

    static async _generarAnalisisProductos(params) {
        try {
            return await this.generarAnalisisProductos(params);
        } catch (error) {
            console.error('Error generando análisis productos:', error);
            return { mensaje: 'Error generando análisis de productos' };
        }
    }

    static async _generarTendenciasTemporales(params) {
        try {
            const datosHistoricos = await this.generarAnalisisPredictivo(params);
            return datosHistoricos.tendencias || {};
        } catch (error) {
            console.error('Error generando tendencias temporales:', error);
            return {};
        }
    }

    static async _generarMetricasConversion(params) {
        try {
            const resumen = await this._generarResumenEjecutivo(params);
            
            return {
                tasa_conversion_general: resumen.total_ventas > 0 ? 
                    (resumen.ventas_completadas / resumen.total_ventas * 100).toFixed(2) : 0,
                ventas_por_asesor: resumen.asesores_activos > 0 ? 
                    (resumen.total_ventas / resumen.asesores_activos).toFixed(1) : 0,
                valor_promedio_por_asesor: resumen.asesores_activos > 0 ? 
                    (resumen.valor_total / resumen.asesores_activos).toFixed(2) : 0
            };
        } catch (error) {
            console.error('Error generando métricas conversión:', error);
            return {};
        }
    }

    static async _generarDatosGraficos(params) {
        try {
            return {
                graficos_disponibles: ['barras', 'lineas', 'pastel'],
                datos_para_graficos: 'Implementación pendiente'
            };
        } catch (error) {
            console.error('Error generando datos gráficos:', error);
            return {};
        }
    }

    static async _calcularProyeccionesPipeline(queryParams, whereConditions) {
        try {
            return {
                proyeccion_30_dias: 'En desarrollo',
                proyeccion_90_dias: 'En desarrollo',
                confiabilidad: 'Media'
            };
        } catch (error) {
            return {};
        }
    }
    
    static _calcularTendencias(datosHistoricos) {
        try {
            if (!datosHistoricos || datosHistoricos.length < 2) return null;
            
            const n = datosHistoricos.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            
            datosHistoricos.forEach((data, index) => {
                const x = index + 1;
                const y = parseFloat(data.valor_total || 0);
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumX2 += x * x;
            });
            
            const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercepto = (sumY - pendiente * sumX) / n;
            
            return {
                pendiente: pendiente,
                intercepto: intercepto,
                tendencia: pendiente > 0 ? 'creciente' : pendiente < 0 ? 'decreciente' : 'estable'
            };
        } catch (error) {
            console.error('Error calculando tendencias:', error);
            return null;
        }
    }

    static _calcularProyecciones(datosHistoricos, tendencias, mesesProyeccion) {
        try {
            if (!tendencias || !datosHistoricos) return [];
            
            const proyecciones = [];
            for (let i = 1; i <= mesesProyeccion; i++) {
                const x = datosHistoricos.length + i;
                const valorProyectado = tendencias.intercepto + (tendencias.pendiente * x);
                
                proyecciones.push({
                    mes: `Proyección +${i}`,
                    valor_proyectado: Math.max(0, valorProyectado).toFixed(2)
                });
            }
            
            return proyecciones;
        } catch (error) {
            console.error('Error calculando proyecciones:', error);
            return [];
        }
    }

    static _calcularConfiabilidad(datosHistoricos) {
        try {
            if (!datosHistoricos || datosHistoricos.length < 3) return 'Baja';
            if (datosHistoricos.length >= 6) return 'Alta';
            return 'Media';
        } catch (error) {
            return 'Baja';
        }
    }
    
    static _formatearNombreMetrica(key) {
        const nombres = {
            total_ventas: 'Total de Ventas',
            valor_total: 'Valor Total',
            valor_promedio: 'Valor Promedio',
            tasa_conversion: 'Tasa de Conversión',
            tasa_cancelacion: 'Tasa de Cancelación',
            asesores_activos: 'Asesores Activos'
        };
        
        return nombres[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    static _formatearValorMetrica(key, value) {
        if (key.includes('valor') || key.includes('total')) {
            return new Intl.NumberFormat('es-PE', {
                style: 'currency',
                currency: 'PEN',
                minimumFractionDigits: 0
            }).format(value);
        }
        
        if (key.includes('tasa') || key.includes('porcentaje')) {
            return value + (typeof value === 'string' && value.includes('%') ? '' : '%');
        }
        
        return value?.toLocaleString ? value.toLocaleString() : value;
    }
}

module.exports = ReportesVentasService;