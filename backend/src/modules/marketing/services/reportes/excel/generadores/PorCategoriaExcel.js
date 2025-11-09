// ============================================
// GENERADOR EXCEL: REPORTE POR CATEGORÍA
// Análisis detallado con exportación completa de actividades
// ============================================

const ExcelBase = require('../utils/ExcelBase');
const ExcelStyles = require('../utils/ExcelStyles');

class PorCategoriaExcel {
    /**
     * Generar reporte completo por categoría
     */
    static async generar(datos) {
        try {
            const workbook = ExcelBase.crearWorkbook();

            // ========================================
            // HOJA 1: RESUMEN EJECUTIVO
            // ========================================
            this._generarHojaResumen(workbook, datos);

            // ========================================
            // HOJA 2: ANÁLISIS POR CATEGORÍA
            // ========================================
            this._generarHojaAnalisis(workbook, datos);

            // ========================================
            // HOJA 3: DETALLE DE ACTIVIDADES
            // ========================================
            this._generarHojaDetalleActividades(workbook, datos);

            // Generar buffer
            return await ExcelBase.workbookABuffer(workbook);

        } catch (error) {
            console.error('❌ Error generando Excel por categoría:', error);
            throw error;
        }
    }

    // ============================================
    // HOJA 1: RESUMEN EJECUTIVO
    // ============================================

    static _generarHojaResumen(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Resumen Ejecutivo',
            ExcelStyles.COLORES.PURPURA,
            [35, 20, 25, 20]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, 'ANÁLISIS POR CATEGORÍA', 'A1:D1');

        // Información del usuario
        ExcelBase.agregarInfoUsuario(sheet, datos);

        // KPIs principales
        let currentRow = 7;
        ExcelBase.agregarEncabezadoSeccion(sheet, '📊 MÉTRICAS GENERALES', currentRow, 'A:D');

        currentRow += 2;
        const kpis = this._construirKPIsGenerales(datos);
        currentRow = ExcelBase.agregarTabla(sheet, kpis, currentRow);

        // Distribución por categoría principal
        currentRow += 2;
        ExcelBase.agregarEncabezadoSeccion(sheet, '🎯 DISTRIBUCIÓN POR CATEGORÍA PRINCIPAL', currentRow, 'A:D');

        currentRow += 2;
        const distribucion = this._construirDistribucionPrincipal(datos);
        currentRow = ExcelBase.agregarTabla(sheet, distribucion, currentRow);

        // Top 5
        currentRow += 2;
        const top5Items = datos.categorias.slice(0, 5).map((cat, idx) => {
            const nombre = cat.subcategoria
                ? `${cat.categoria_principal} - ${cat.subcategoria}`
                : cat.categoria_principal;
            return `${nombre}: ${ExcelBase.minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`;
        });
        ExcelBase.agregarTop3(sheet, '🏆 TOP 5 CATEGORÍAS (por tiempo invertido)', top5Items, currentRow, 'A:D');
    }

    // ============================================
    // HOJA 2: ANÁLISIS POR CATEGORÍA
    // ============================================

    static _generarHojaAnalisis(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Análisis Detallado',
            ExcelStyles.COLORES.AZUL_MEDIO,
            [40, 15, 15, 20, 15, 20]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, '📋 ANÁLISIS DETALLADO POR CATEGORÍA', 'A1:F1');

        // Tabla completa con todas las categorías
        let currentRow = 3;
        const tablaAnalisis = this._construirTablaAnalisisCompleto(datos);
        ExcelBase.agregarTabla(sheet, tablaAnalisis, currentRow);
    }

    // ============================================
    // HOJA 3: DETALLE DE ACTIVIDADES
    // ============================================

    static _generarHojaDetalleActividades(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Detalle Actividades',
            ExcelStyles.COLORES.VERDE,
            [10, 35, 20, 15, 15, 12, 18, 18, 18, 18, 15, 15, 12]
        );

        // Encabezado
        ExcelBase.agregarEncabezadoPrincipal(sheet, '📅 EXPORTACIÓN COMPLETA DE ACTIVIDADES', 'A1:M1');

        let currentRow = 3;

        // Nota informativa
        sheet.mergeCells(`A${currentRow}:M${currentRow}`);
        const noteCell = sheet.getCell(`A${currentRow}`);
        noteCell.value = '💡 Esta hoja contiene TODAS las actividades del período seleccionado. Úsala para filtrar, ordenar y crear tablas dinámicas.';
        noteCell.font = { size: 10, italic: true, color: { argb: ExcelStyles.COLORES.AZUL_OSCURO } };
        noteCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ExcelStyles.COLORES.AZUL_CLARO }
        };
        noteCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getRow(currentRow).height = 35;

        currentRow += 2;

        // Tabla con todas las actividades
        const tablaActividades = this._construirTablaActividades(datos);
        ExcelBase.agregarTabla(sheet, tablaActividades, currentRow);

        // Configurar filtros automáticos
        const headerRow = currentRow;
        const lastCol = 13; // M
        const lastRow = currentRow + tablaActividades.length - 1;
        sheet.autoFilter = {
            from: { row: headerRow, column: 1 },
            to: { row: lastRow, column: lastCol }
        };

        // Congelar primera fila
        sheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: headerRow, topLeftCell: `A${headerRow + 1}` }
        ];
    }

    // ============================================
    // CONSTRUCTORES DE DATOS
    // ============================================

    static _construirKPIsGenerales(datos) {
        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos), 0
        );
        const categoriasPrincipales = [...new Set(datos.categorias.map(c => c.categoria_principal))].length;

        return [
            ['Métrica', 'Valor'],
            ['Total de Categorías Principales', categoriasPrincipales],
            ['Total de Subcategorías', datos.categorias.length],
            ['Actividades Totales', datos.metricas.totales.total],
            ['Actividades Completadas', datos.metricas.totales.completadas],
            ['Tasa de Completitud', ExcelBase.formatearPorcentaje(datos.metricas.tasas.completitud)],
            ['Tiempo Total Invertido', ExcelBase.minutosAHoras(tiempoTotal)],
            ['Promedio por Actividad', ExcelBase.minutosAHoras(Math.floor(tiempoTotal / datos.metricas.totales.total))]
        ];
    }

    static _construirDistribucionPrincipal(datos) {
        // Agrupar por categoría principal
        const principales = {};
        datos.categorias.forEach(cat => {
            const principal = cat.categoria_principal;
            if (!principales[principal]) {
                principales[principal] = {
                    cantidad: 0,
                    completadas: 0,
                    tiempo: 0
                };
            }
            principales[principal].cantidad += parseInt(cat.cantidad);
            principales[principal].completadas += parseInt(cat.completadas);
            principales[principal].tiempo += parseInt(cat.tiempo_total_minutos);
        });

        const tiempoTotal = Object.values(principales).reduce((sum, p) => sum + p.tiempo, 0);

        const tabla = [['Categoría Principal', 'Actividades', 'Completadas', 'Tiempo Total']];

        Object.entries(principales)
            .sort((a, b) => b[1].tiempo - a[1].tiempo)
            .forEach(([categoria, datos]) => {
                tabla.push([
                    categoria,
                    datos.cantidad,
                    datos.completadas,
                    ExcelBase.minutosAHoras(datos.tiempo)
                ]);
            });

        return tabla;
    }

    static _construirTablaAnalisisCompleto(datos) {
        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos), 0
        );

        const tabla = [
            ['Categoría Principal', 'Subcategoría', 'Cantidad', 'Completadas', 'Tiempo Total', '% del Total']
        ];

        datos.categorias.forEach(cat => {
            const porcentaje = tiempoTotal > 0
                ? `${((parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1)}%`
                : '0%';

            tabla.push([
                cat.categoria_principal,
                cat.subcategoria || '-',
                cat.cantidad,
                cat.completadas,
                ExcelBase.minutosAHoras(cat.tiempo_total_minutos),
                porcentaje
            ]);
        });

        return tabla;
    }

    static _construirTablaActividades(datos) {
        const tabla = [
            [
                'ID',
                'Título',
                'Categoría Principal',
                'Subcategoría',
                'Estado',
                'Prioridad',
                'Fecha Inicio Planeada',
                'Fecha Fin Planeada',
                'Fecha Inicio Real',
                'Fecha Fin Real',
                'Tiempo Planeado',
                'Tiempo Real',
                'Eficiencia %'
            ]
        ];

        // Obtener actividades desde datos.actividades si existe
        const actividades = datos.actividades || [];

        actividades.forEach(act => {
            const tiempoPlaneadoMin = act.duracion_planeada_minutos || 0;
            const tiempoRealMin = act.duracion_real_minutos || 0;
            const eficiencia = tiempoPlaneadoMin > 0
                ? ((tiempoRealMin / tiempoPlaneadoMin) * 100).toFixed(1)
                : '-';

            tabla.push([
                act.id,
                act.titulo || act.descripcion || '-',
                act.categoria_principal || '-',
                act.subcategoria || '-',
                act.estado || '-',
                act.prioridad || '-',
                act.fecha_inicio_planeada ? this._formatearFecha(act.fecha_inicio_planeada) : '-',
                act.fecha_fin_planeada ? this._formatearFecha(act.fecha_fin_planeada) : '-',
                act.fecha_inicio_real ? this._formatearFecha(act.fecha_inicio_real) : '-',
                act.fecha_fin_real ? this._formatearFecha(act.fecha_fin_real) : '-',
                tiempoPlaneadoMin > 0 ? ExcelBase.minutosAHoras(tiempoPlaneadoMin) : '-',
                tiempoRealMin > 0 ? ExcelBase.minutosAHoras(tiempoRealMin) : '-',
                eficiencia
            ]);
        });

        return tabla;
    }

    static _formatearFecha(fecha) {
        if (!fecha) return '-';
        const d = new Date(fecha);
        return d.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

module.exports = PorCategoriaExcel;
