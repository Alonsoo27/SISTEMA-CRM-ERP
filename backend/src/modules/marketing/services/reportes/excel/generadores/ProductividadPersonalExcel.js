// ============================================
// GENERADOR EXCEL: PRODUCTIVIDAD PERSONAL
// Reporte completo de productividad individual
// ============================================

const ExcelBase = require('../utils/ExcelBase');
const ExcelStyles = require('../utils/ExcelStyles');

class ProductividadPersonalExcel {
    /**
     * Generar reporte completo de productividad personal
     */
    static async generar(datos) {
        try {
            const workbook = ExcelBase.crearWorkbook();

            // ========================================
            // HOJA 1: RESUMEN EJECUTIVO
            // ========================================
            this._generarHojaResumen(workbook, datos);

            // ========================================
            // HOJA 2: ANÁLISIS DE TIEMPO
            // ========================================
            this._generarHojaTiempo(workbook, datos);

            // ========================================
            // HOJA 3: DISTRIBUCIÓN POR CATEGORÍAS
            // ========================================
            if (datos.categorias && datos.categorias.length > 0) {
                this._generarHojaCategorias(workbook, datos);
            }

            // ========================================
            // HOJA 4: PROBLEMAS Y ALERTAS
            // ========================================
            this._generarHojaProblemas(workbook, datos);

            // Generar buffer
            return await ExcelBase.workbookABuffer(workbook);

        } catch (error) {
            console.error('❌ Error generando Excel de productividad personal:', error);
            throw error;
        }
    }

    // ============================================
    // HOJAS ESPECÍFICAS
    // ============================================

    /**
     * Generar hoja de resumen ejecutivo
     */
    static _generarHojaResumen(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Resumen Ejecutivo',
            ExcelStyles.COLORES.AZUL_MEDIO,
            [30, 20, 20, 30]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, 'REPORTE DE PRODUCTIVIDAD PERSONAL');

        // Información del usuario
        ExcelBase.agregarInfoUsuario(sheet, datos);

        // KPIs
        let currentRow = 7;
        ExcelBase.agregarEncabezadoSeccion(sheet, 'INDICADORES CLAVE DE RENDIMIENTO (KPIs)', currentRow);

        currentRow += 2;
        const kpis = this._construirKPIs(datos);
        currentRow = ExcelBase.agregarTablaKPIs(sheet, kpis, currentRow);

        // DESGLOSE POR ESTADO
        currentRow += 2;
        ExcelBase.agregarEncabezadoSeccion(sheet, 'DESGLOSE POR ESTADO', currentRow, 'A:D', '📋');

        currentRow += 2;
        const desglose = this._construirDesglose(datos);
        ExcelBase.agregarTabla(sheet, desglose, currentRow);
    }

    /**
     * Generar hoja de análisis de tiempo
     */
    static _generarHojaTiempo(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Análisis de Tiempo',
            ExcelStyles.COLORES.AMARILLO,
            [35, 20, 25, 20]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, 'ANÁLISIS DETALLADO DE TIEMPO', 'A1:D1');

        // Métricas de tiempo
        let currentRow = 3;
        const metricasTiempo = this._construirMetricasTiempo(datos);
        currentRow = ExcelBase.agregarTabla(sheet, metricasTiempo, currentRow);

        // Interpretación de eficiencia
        currentRow += 2;
        const interpretacion = ExcelStyles.getInterpretacionEficiencia(datos.metricas.tasas.eficiencia);
        ExcelBase.agregarInterpretacion(
            sheet,
            '💡 INTERPRETACIÓN DE EFICIENCIA',
            interpretacion.texto,
            interpretacion.color,
            currentRow
        );
    }

    /**
     * Generar hoja de distribución por categorías
     */
    static _generarHojaCategorias(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Por Categorías',
            ExcelStyles.COLORES.PURPURA,
            [35, 15, 15, 20, 15]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, '🎯 DISTRIBUCIÓN POR CATEGORÍAS', 'A1:E1');

        // Calcular totales
        const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);

        // Tabla de categorías
        let currentRow = 3;
        const tablaCategorias = this._construirTablaCategorias(datos.categorias, tiempoTotal);
        currentRow = ExcelBase.agregarTabla(sheet, tablaCategorias, currentRow);

        // Top 3
        currentRow += 2;
        const top3Items = datos.categorias.slice(0, 3).map(cat =>
            `${cat.categoria_principal}: ${ExcelBase.minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`
        );
        ExcelBase.agregarTop3(sheet, '🏆 TOP 3 CATEGORÍAS (por tiempo invertido)', top3Items, currentRow);
    }

    /**
     * Generar hoja de problemas
     */
    static _generarHojaProblemas(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Problemas',
            ExcelStyles.COLORES.ROJO,
            [30, 15, 25, 30]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, '⚠️ PROBLEMAS Y ALERTAS DETECTADAS', 'A1:D1');

        // Tabla de problemas
        const currentRow = 3;
        const tablaProblemas = this._construirTablaProblemas(datos);
        ExcelBase.agregarTabla(sheet, tablaProblemas, currentRow);
    }

    // ============================================
    // CONSTRUCTORES DE DATOS
    // ============================================

    static _construirKPIs(datos) {
        return [
            [
                'Total Actividades',
                datos.metricas.totales.total,
                '-',
                '[#]'
            ],
            [
                'Tasa de Completitud',
                ExcelBase.formatearPorcentaje(datos.metricas.tasas.completitud),
                '>= 80%',
                ExcelStyles.getSimboloPorValor(datos.metricas.tasas.completitud, 80, true)
            ],
            [
                'Eficiencia Temporal',
                ExcelBase.formatearPorcentaje(datos.metricas.tasas.eficiencia),
                '<= 100%',
                ExcelStyles.getSimboloPorValor(datos.metricas.tasas.eficiencia, 100, false)
            ],
            [
                'Tasa de Vencimiento',
                ExcelBase.formatearPorcentaje(datos.metricas.tasas.vencimiento),
                '< 5%',
                ExcelStyles.getSimboloPorValor(datos.metricas.tasas.vencimiento, 5, false)
            ],
            [
                'Actividades Prioritarias',
                `${datos.metricas.totales.prioritarias_completadas}/${datos.metricas.totales.prioritarias}`,
                '-',
                datos.metricas.tasas.prioritarias >= 90 ? '⭐⭐' : '⭐'
            ],
            [
                'Tiempo Total Invertido',
                ExcelBase.minutosAHoras(datos.metricas.tiempos.total_real_minutos),
                '-',
                '⏱️'
            ]
        ];
    }

    static _construirDesglose(datos) {
        const total = datos.metricas.totales.total;
        return [
            ['Estado', 'Cantidad', 'Porcentaje', 'Símbolo'],
            [
                'Completadas',
                datos.metricas.totales.completadas,
                ExcelBase.formatearPorcentaje((datos.metricas.totales.completadas / total) * 100),
                '✅'
            ],
            [
                'En Progreso',
                datos.metricas.totales.en_progreso,
                ExcelBase.formatearPorcentaje((datos.metricas.totales.en_progreso / total) * 100),
                '🔄'
            ],
            [
                'Pendientes',
                datos.metricas.totales.pendientes,
                ExcelBase.formatearPorcentaje((datos.metricas.totales.pendientes / total) * 100),
                '⏳'
            ],
            [
                'Canceladas',
                datos.metricas.totales.canceladas,
                ExcelBase.formatearPorcentaje((datos.metricas.totales.canceladas / total) * 100),
                '❌'
            ]
        ];
    }

    static _construirMetricasTiempo(datos) {
        return [
            ['Métrica', 'Valor', 'Equivalente', 'Evaluación'],
            [
                'Tiempo Planeado Total',
                ExcelBase.minutosAHoras(datos.metricas.tiempos.total_planeado_minutos),
                `${datos.metricas.tiempos.total_planeado_minutos} min`,
                '📅'
            ],
            [
                'Tiempo Real Total',
                ExcelBase.minutosAHoras(datos.metricas.tiempos.total_real_minutos),
                `${datos.metricas.tiempos.total_real_minutos} min`,
                datos.metricas.tasas.eficiencia <= 100 ? '✅' : '⚠️'
            ],
            [
                'Tiempo Adicional',
                ExcelBase.minutosAHoras(datos.metricas.tiempos.total_adicional_minutos),
                `${datos.metricas.tiempos.total_adicional_minutos} min`,
                datos.metricas.tiempos.total_adicional_minutos === 0 ? '✅' : '🔄'
            ],
            [
                'Promedio por Actividad',
                ExcelBase.minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos)),
                `${datos.metricas.tiempos.promedio_real_minutos} min`,
                '⏱️'
            ],
            [
                'Extensiones Solicitadas',
                datos.metricas.tiempos.con_extension,
                '-',
                datos.metricas.tiempos.con_extension > 5 ? '⚠️' : '✅'
            ]
        ];
    }

    static _construirTablaCategorias(categorias, tiempoTotal) {
        const tabla = [['Categoría / Subcategoría', 'Cantidad', 'Completadas', 'Tiempo Total', '% Tiempo']];

        categorias.forEach(cat => {
            const porcentajeTiempo = tiempoTotal > 0
                ? ((parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1)
                : 0;

            tabla.push([
                `${cat.categoria_principal}${cat.subcategoria ? ' - ' + cat.subcategoria : ''}`,
                cat.cantidad,
                cat.completadas,
                ExcelBase.minutosAHoras(cat.tiempo_total_minutos),
                `${porcentajeTiempo}%`
            ]);
        });

        return tabla;
    }

    static _construirTablaProblemas(datos) {
        return [
            ['Tipo de Problema', 'Cantidad', 'Nivel de Impacto', 'Recomendación'],
            [
                'Actividades Vencidas',
                datos.metricas.problemas.vencidas,
                datos.metricas.problemas.vencidas === 0 ? '✅ Ninguno' :
                    datos.metricas.problemas.vencidas < 3 ? '⚠️ Bajo' : '❌ Alto',
                datos.metricas.problemas.vencidas === 0 ?
                    'Mantener buenas prácticas' : 'Revisar planificación y prioridades'
            ],
            [
                'Actividades Transferidas',
                datos.metricas.problemas.transferidas,
                datos.metricas.problemas.transferidas < 2 ? '✅ Bajo' :
                    datos.metricas.problemas.transferidas < 5 ? '⚠️ Medio' : '❌ Alto',
                datos.metricas.problemas.transferidas > 3 ?
                    'Analizar causas de transferencias' : 'Nivel aceptable'
            ],
            [
                'Extensiones de Tiempo',
                datos.metricas.problemas.extensiones,
                datos.metricas.problemas.extensiones < 3 ? '✅ Bajo' :
                    datos.metricas.problemas.extensiones < 8 ? '⚠️ Medio' : '❌ Alto',
                datos.metricas.problemas.extensiones > 5 ?
                    'Mejorar estimaciones de tiempo' : 'Planificación adecuada'
            ]
        ];
    }
}

module.exports = ProductividadPersonalExcel;
