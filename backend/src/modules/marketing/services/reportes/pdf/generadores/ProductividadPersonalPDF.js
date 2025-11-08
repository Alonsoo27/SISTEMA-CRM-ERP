// ============================================
// GENERADOR PDF: PRODUCTIVIDAD PERSONAL
// Reporte completo de productividad individual
// ============================================

const PDFBase = require('../utils/PDFBase');
const PDFStyles = require('../utils/PDFStyles');

class ProductividadPersonalPDF {
    /**
     * Generar reporte completo de productividad personal
     */
    static async generar(datos) {
        try {
            const doc = PDFBase.crearDocumento(
                `Reporte de Productividad - ${datos.usuario.nombre_completo}`,
                'Sistema CRM/ERP'
            );

            const bufferPromise = PDFBase.documentoABuffer(doc);

            const tieneActividades = datos.metricas.totales.total > 0;

            // ========================================
            // PÁGINA 1: RESUMEN EJECUTIVO
            // ========================================
            this._generarPaginaResumen(doc, datos, tieneActividades);

            // Si no hay actividades, terminar aquí
            if (!tieneActividades) {
                PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);
                doc.end();
                return await bufferPromise;
            }

            // ========================================
            // PÁGINA 2: ANÁLISIS DE TIEMPO
            // ========================================
            doc.addPage();
            this._generarPaginaAnalisisTiempo(doc, datos);
            PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);

            // ========================================
            // PÁGINA 3: DISTRIBUCIÓN POR CATEGORÍAS (si hay)
            // ========================================
            if (datos.categorias && datos.categorias.length > 0) {
                doc.addPage();
                this._generarPaginaCategorias(doc, datos);
                PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);
            }

            doc.end();
            return await bufferPromise;

        } catch (error) {
            console.error('❌ Error generando PDF de productividad personal:', error);
            throw error;
        }
    }

    // ============================================
    // PÁGINAS ESPECÍFICAS
    // ============================================

    /**
     * Generar página de resumen ejecutivo
     */
    static _generarPaginaResumen(doc, datos, tieneActividades) {
        PDFBase.dibujarEncabezado(doc, 'REPORTE DE PRODUCTIVIDAD PERSONAL');

        // Información del usuario
        doc.moveDown(2);
        doc.fontSize(18).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text(datos.usuario.nombre_completo, { align: 'center' });
        doc.fontSize(12).fillColor(PDFStyles.COLORES.GRIS)
            .text(datos.usuario.email, { align: 'center' });
        doc.fontSize(11).fillColor(PDFStyles.COLORES.GRIS)
            .text(`Área: ${datos.usuario.area || 'Marketing'}`, { align: 'center' });

        // Período
        doc.moveDown(1);
        PDFBase.dibujarCaja(doc, datos.periodo.descripcion, PDFStyles.COLORES.AZUL_MEDIO);

        // Si no hay actividades
        if (!tieneActividades) {
            doc.moveDown(3);
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AMARILLO)
                .text('SIN ACTIVIDADES REGISTRADAS', { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS).text(
                `No se encontraron actividades para el período seleccionado (${datos.periodo.descripcion}).`,
                { align: 'center', width: 500 }
            );
            doc.text('Por favor, selecciona otro período o crea actividades.', { align: 'center', width: 500 });
            return;
        }

        // RESUMEN EJECUTIVO
        doc.moveDown(2);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('RESUMEN EJECUTIVO', { align: 'left', underline: true });
        doc.moveDown(1);

        // KPIs
        const kpis = this._construirKPIs(datos);
        PDFBase.dibujarGridKPIs(doc, kpis);

        // DESGLOSE DE ACTIVIDADES
        doc.moveDown(2);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('DESGLOSE DE ACTIVIDADES', { align: 'left', underline: true });
        doc.moveDown(1);

        const tablaEstados = this._construirTablaEstados(datos);
        PDFBase.dibujarTabla(doc, tablaEstados, [200, 150, 150]);

        // ACTIVIDADES PRIORITARIAS
        doc.moveDown(1);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ACTIVIDADES PRIORITARIAS', { align: 'left', underline: true });
        doc.moveDown(0.5);

        this._mostrarPrioritarias(doc, datos);
    }

    /**
     * Generar página de análisis de tiempo
     */
    static _generarPaginaAnalisisTiempo(doc, datos) {
        PDFBase.dibujarEncabezado(doc, 'ANÁLISIS DE TIEMPO');

        doc.moveDown(2);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('GESTIÓN DEL TIEMPO', { align: 'left', underline: true });
        doc.moveDown(1);

        const tablaTiempos = this._construirTablaTiempos(datos);
        PDFBase.dibujarTabla(doc, tablaTiempos, [200, 150, 150]);

        // INTERPRETACIÓN DE EFICIENCIA (solo si hay datos)
        if (datos.metricas.tiempos.total_real_minutos > 0) {
            doc.moveDown(1);
            doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
                .text('INTERPRETACIÓN DE EFICIENCIA:', { align: 'left', underline: true });
            doc.moveDown(0.5);

            const interpretacion = PDFStyles.getInterpretacionEficiencia(datos.metricas.tasas.eficiencia);
            doc.fontSize(10).fillColor(interpretacion.color)
                .text(`[${interpretacion.nivel}] ${interpretacion.texto}`, { indent: 20 });
        }

        // PROBLEMAS DETECTADOS
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('PROBLEMAS DETECTADOS', { align: 'left', underline: true });
        doc.moveDown(1);

        const tablaProblemas = this._construirTablaProblemas(datos);
        PDFBase.dibujarTabla(doc, tablaProblemas, [200, 150, 150]);
    }

    /**
     * Generar página de distribución por categorías
     */
    static _generarPaginaCategorias(doc, datos) {
        PDFBase.dibujarEncabezado(doc, 'DISTRIBUCIÓN POR CATEGORÍAS');

        doc.moveDown(2);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ANÁLISIS POR TIPO DE ACTIVIDAD', { align: 'left', underline: true });
        doc.moveDown(1);

        const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);
        const tablaCategorias = this._construirTablaCategorias(datos.categorias, tiempoTotal);
        PDFBase.dibujarTabla(doc, tablaCategorias, [220, 80, 100, 80]);

        // Top 3
        doc.moveDown(1);
        doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('TOP 3 CATEGORÍAS (por tiempo invertido):', { align: 'left', underline: true });
        doc.moveDown(0.5);

        datos.categorias.slice(0, 3).forEach((cat, idx) => {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO).text(
                `[${idx + 1}] ${cat.categoria_principal}: ${PDFBase.minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`,
                { indent: 20 }
            );
        });
    }

    // ============================================
    // CONSTRUCTORES DE DATOS
    // ============================================

    static _construirKPIs(datos) {
        return [
            {
                label: 'Total Actividades',
                valor: datos.metricas.totales.total,
                simbolo: '[#]',
                color: PDFStyles.COLORES.AZUL_MEDIO
            },
            {
                label: 'Tasa Completitud',
                valor: PDFBase.formatearPorcentaje(datos.metricas.tasas.completitud),
                simbolo: PDFStyles.getSimboloPorValor(datos.metricas.tasas.completitud, 80, true),
                color: PDFStyles.getColorPorValor(datos.metricas.tasas.completitud, 80, true)
            },
            {
                label: 'Eficiencia',
                valor: PDFBase.formatearPorcentaje(datos.metricas.tasas.eficiencia),
                simbolo: PDFStyles.getSimboloPorValor(datos.metricas.tasas.eficiencia, 100, false),
                color: PDFStyles.getColorPorValor(datos.metricas.tasas.eficiencia, 100, false)
            },
            {
                label: 'Tasa Vencimiento',
                valor: PDFBase.formatearPorcentaje(datos.metricas.tasas.vencimiento),
                simbolo: PDFStyles.getSimboloPorValor(datos.metricas.tasas.vencimiento, 5, false),
                color: PDFStyles.getColorPorValor(datos.metricas.tasas.vencimiento, 5, false)
            }
        ];
    }

    static _construirTablaEstados(datos) {
        return [
            ['Estado', 'Cantidad', 'Porcentaje'],
            ['Completadas', datos.metricas.totales.completadas,
                PDFBase.formatearPorcentaje((datos.metricas.totales.completadas / datos.metricas.totales.total) * 100)],
            ['En Progreso', datos.metricas.totales.en_progreso,
                PDFBase.formatearPorcentaje((datos.metricas.totales.en_progreso / datos.metricas.totales.total) * 100)],
            ['Pendientes', datos.metricas.totales.pendientes,
                PDFBase.formatearPorcentaje((datos.metricas.totales.pendientes / datos.metricas.totales.total) * 100)],
            ['Canceladas', datos.metricas.totales.canceladas,
                PDFBase.formatearPorcentaje((datos.metricas.totales.canceladas / datos.metricas.totales.total) * 100)]
        ];
    }

    static _mostrarPrioritarias(doc, datos) {
        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
        doc.text(`Total Prioritarias: ${datos.metricas.totales.prioritarias}`);
        doc.text(`Completadas: ${datos.metricas.totales.prioritarias_completadas}`);

        if (datos.metricas.totales.prioritarias > 0) {
            const tasaPrioritarias = datos.metricas.tasas.prioritarias;
            const calificacion = PDFStyles.getCalificacion(tasaPrioritarias);
            doc.text(`Tasa de Cumplimiento: ${PDFBase.formatearPorcentaje(tasaPrioritarias)} - ${calificacion.texto}`);
        } else {
            doc.text('Tasa de Cumplimiento: N/A (sin actividades prioritarias)');
        }
    }

    static _construirTablaTiempos(datos) {
        return [
            ['Métrica', 'Valor', 'Evaluación'],
            ['Tiempo Planeado', PDFBase.minutosAHoras(datos.metricas.tiempos.total_planeado_minutos), 'Estimado'],
            ['Tiempo Real', PDFBase.minutosAHoras(datos.metricas.tiempos.total_real_minutos),
                datos.metricas.tiempos.total_real_minutos > 0 ?
                    (datos.metricas.tasas.eficiencia <= 100 ? 'Óptimo' : 'Requiere atención') : 'Sin datos'],
            ['Tiempo Adicional', PDFBase.minutosAHoras(datos.metricas.tiempos.total_adicional_minutos),
                datos.metricas.tiempos.total_adicional_minutos > 0 ? 'Con extensiones' : 'Sin extensiones'],
            ['Promedio por Actividad', PDFBase.minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos)),
                'Duración media'],
            ['Extensiones Solicitadas', datos.metricas.tiempos.con_extension,
                datos.metricas.tiempos.con_extension > 5 ? 'Alto' : 'Normal']
        ];
    }

    static _construirTablaProblemas(datos) {
        return [
            ['Tipo', 'Cantidad', 'Impacto'],
            ['Actividades Vencidas', datos.metricas.problemas.vencidas,
                PDFStyles.getNivelImpacto(datos.metricas.problemas.vencidas, [0, 3]).texto],
            ['Transferencias', datos.metricas.problemas.transferidas,
                PDFStyles.getNivelImpacto(datos.metricas.problemas.transferidas, [0, 3]).texto],
            ['Extensiones', datos.metricas.problemas.extensiones,
                PDFStyles.getNivelImpacto(datos.metricas.problemas.extensiones, [0, 5]).texto]
        ];
    }

    static _construirTablaCategorias(categorias, tiempoTotal) {
        const tabla = [['Categoría', 'Cant.', 'Tiempo', '%']];

        categorias.slice(0, 10).forEach(cat => {
            const porcentaje = tiempoTotal > 0 ? (parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100 : 0;
            tabla.push([
                `${cat.categoria_principal}${cat.subcategoria ? ' - ' + cat.subcategoria : ''}`,
                cat.cantidad,
                PDFBase.minutosAHoras(cat.tiempo_total_minutos),
                PDFBase.formatearPorcentaje(porcentaje)
            ]);
        });

        return tabla;
    }
}

module.exports = ProductividadPersonalPDF;
