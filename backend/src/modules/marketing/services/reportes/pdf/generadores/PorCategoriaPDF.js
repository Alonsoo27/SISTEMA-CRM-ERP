// ============================================
// GENERADOR PDF: REPORTE POR CATEGORÍA
// Análisis detallado de distribución por tipos de actividad
// ============================================

const PDFBase = require('../utils/PDFBase');
const PDFStyles = require('../utils/PDFStyles');

class PorCategoriaPDF {
    /**
     * Generar reporte de análisis por categoría
     */
    static async generar(datos) {
        try {
            const doc = PDFBase.crearDocumento(
                `Reporte Por Categoría - ${datos.usuario.nombre_completo}`,
                'Sistema CRM/ERP',
                {
                    usuario: datos.usuario.nombre_completo,
                    periodo: datos.periodo.descripcion
                }
            );

            const bufferPromise = PDFBase.documentoABuffer(doc);

            const tieneActividades = datos.metricas.totales.total > 0;
            const tieneCategorias = datos.categorias && datos.categorias.length > 0;

            // ========================================
            // PÁGINA PRINCIPAL
            // ========================================
            doc.addPage();
            await this._generarPaginaPrincipal(doc, datos, tieneActividades, tieneCategorias);

            doc.end();
            return await bufferPromise;

        } catch (error) {
            console.error('❌ Error generando PDF por categoría:', error);
            throw error;
        }
    }

    // ============================================
    // PÁGINA PRINCIPAL
    // ============================================

    static async _generarPaginaPrincipal(doc, datos, tieneActividades, tieneCategorias) {
        PDFBase.dibujarEncabezado(doc, 'ANÁLISIS POR CATEGORÍA DE ACTIVIDADES');

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
        PDFBase.dibujarCaja(doc, datos.periodo.descripcion, PDFStyles.COLORES.PURPURA);

        if (!tieneActividades || !tieneCategorias) {
            doc.moveDown(3);
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AMARILLO)
                .text('SIN DATOS DE CATEGORÍAS', { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS).text(
                'No se encontraron actividades categorizadas para el período seleccionado.',
                { align: 'center', width: 500 }
            );
            return;
        }

        // ========================================
        // RESUMEN EJECUTIVO
        // ========================================
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('RESUMEN EJECUTIVO', { align: 'center', underline: true });
        doc.moveDown(0.5);

        const resumen = this._construirResumenEjecutivo(datos);
        PDFBase.dibujarTabla(doc, resumen, [300, 200]);

        // ========================================
        // DISTRIBUCIÓN POR CATEGORÍA PRINCIPAL
        // ========================================
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('DISTRIBUCIÓN POR CATEGORÍA PRINCIPAL', { align: 'center', underline: true });
        doc.moveDown(0.5);

        const distribucion = this._construirDistribucionPrincipal(datos);
        PDFBase.dibujarTabla(doc, distribucion, [150, 80, 80, 90, 80]);

        // ========================================
        // DETALLE CON SUBCATEGORÍAS
        // ========================================
        PDFBase.verificarEspacio(doc, 250, 'DETALLE POR CATEGORÍA Y SUBCATEGORÍA');

        const detalle = this._construirDetalleCompleto(datos);
        PDFBase.dibujarTabla(doc, detalle, [200, 60, 60, 90, 70]);

        // ========================================
        // TOP 5 CATEGORÍAS
        // ========================================
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('TOP 5 CATEGORÍAS (Mayor Tiempo Invertido)', { align: 'center', underline: true });
        doc.moveDown(0.5);

        const top5 = this._construirTop5(datos);
        PDFBase.dibujarTabla(doc, top5, [40, 180, 90, 100, 80]);

        // ========================================
        // ANÁLISIS Y RECOMENDACIONES
        // ========================================
        if (datos.categorias.length > 0) {
            doc.moveDown(1.5);
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
                .text('INSIGHTS Y RECOMENDACIONES', { align: 'center', underline: true });
            doc.moveDown(0.5);

            const insights = this._generarInsights(datos);
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
            insights.forEach(insight => {
                doc.text(`• ${insight}`, { indent: 20 });
                doc.moveDown(0.3);
            });
        }
    }

    // ============================================
    // CONSTRUCTORES DE DATOS
    // ============================================

    static _construirResumenEjecutivo(datos) {
        if (!datos.categorias || datos.categorias.length === 0) {
            return [
                ['Métrica', 'Valor'],
                ['Total de Categorías Principales', 0],
                ['Total de Subcategorías', 0],
                ['Actividades Totales', datos.metricas?.totales?.total || 0],
                ['Actividades Completadas', datos.metricas?.totales?.completadas || 0],
                ['Tiempo Total Invertido', '0h 0m'],
                ['Promedio por Categoría', '0h 0m']
            ];
        }

        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos || 0), 0
        );
        const categoriasPrincipales = [...new Set(datos.categorias.map(c => c.categoria_principal))].length;

        return [
            ['Métrica', 'Valor'],
            ['Total de Categorías Principales', categoriasPrincipales],
            ['Total de Subcategorías', datos.categorias.length],
            ['Actividades Totales', datos.metricas.totales.total],
            ['Actividades Completadas', datos.metricas.totales.completadas],
            ['Tiempo Total Invertido', PDFBase.minutosAHoras(tiempoTotal)],
            ['Promedio por Categoría', PDFBase.minutosAHoras(Math.floor(tiempoTotal / datos.categorias.length))]
        ];
    }

    static _construirDistribucionPrincipal(datos) {
        if (!datos.categorias || datos.categorias.length === 0) {
            return [
                ['Categoría Principal', 'Actividades', 'Completadas', 'Tiempo Total', '% Tiempo'],
                ['Sin datos', 0, 0, '0h 0m', '0%']
            ];
        }

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
            principales[principal].cantidad += parseInt(cat.cantidad || 0);
            principales[principal].completadas += parseInt(cat.completadas || 0);
            principales[principal].tiempo += parseInt(cat.tiempo_total_minutos || 0);
        });

        const tiempoTotal = Object.values(principales).reduce((sum, p) => sum + p.tiempo, 0);

        const tabla = [['Categoría Principal', 'Actividades', 'Completadas', 'Tiempo Total', '% Tiempo']];

        Object.entries(principales)
            .sort((a, b) => b[1].tiempo - a[1].tiempo)
            .forEach(([categoria, datos]) => {
                const porcentaje = tiempoTotal > 0
                    ? ((datos.tiempo / tiempoTotal) * 100).toFixed(1)
                    : 0;

                tabla.push([
                    categoria,
                    datos.cantidad,
                    datos.completadas,
                    PDFBase.minutosAHoras(datos.tiempo),
                    `${porcentaje}%`
                ]);
            });

        return tabla;
    }

    static _construirDetalleCompleto(datos) {
        if (!datos.categorias || datos.categorias.length === 0) {
            return [
                ['Categoría / Subcategoría', 'Cant.', 'Compl.', 'Tiempo', '%'],
                ['Sin datos', 0, 0, '0h 0m', '0%']
            ];
        }

        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos || 0), 0
        );

        const tabla = [['Categoría / Subcategoría', 'Cant.', 'Compl.', 'Tiempo', '%']];

        datos.categorias.forEach(cat => {
            const porcentaje = tiempoTotal > 0
                ? ((parseInt(cat.tiempo_total_minutos || 0) / tiempoTotal) * 100).toFixed(1)
                : 0;

            const nombre = cat.subcategoria
                ? `${cat.categoria_principal} / ${cat.subcategoria}`
                : cat.categoria_principal;

            tabla.push([
                nombre,
                cat.cantidad || 0,
                cat.completadas || 0,
                PDFBase.minutosAHoras(cat.tiempo_total_minutos || 0),
                `${porcentaje}%`
            ]);
        });

        return tabla;
    }

    static _construirTop5(datos) {
        const tabla = [['#', 'Categoría', 'Actividades', 'Tiempo Total', '% del Total']];

        if (!datos.categorias || datos.categorias.length === 0) {
            tabla.push(['N/A', 'Sin datos', 0, '0h 0m', '0%']);
            return tabla;
        }

        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos || 0), 0
        );

        datos.categorias
            .slice(0, 5)
            .forEach((cat, idx) => {
                const porcentaje = tiempoTotal > 0
                    ? ((parseInt(cat.tiempo_total_minutos || 0) / tiempoTotal) * 100).toFixed(1)
                    : 0;

                const nombre = cat.subcategoria
                    ? `${cat.categoria_principal} - ${cat.subcategoria}`
                    : cat.categoria_principal;

                const medalla = `${idx + 1}`;

                tabla.push([
                    medalla,
                    nombre,
                    cat.cantidad || 0,
                    PDFBase.minutosAHoras(cat.tiempo_total_minutos || 0),
                    `${porcentaje}%`
                ]);
            });

        return tabla;
    }

    static _generarInsights(datos) {
        const insights = [];

        if (!datos.categorias || datos.categorias.length === 0) {
            return ['No hay suficientes datos para generar insights.'];
        }

        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos || 0), 0
        );

        // Top categoría
        const topCategoria = datos.categorias[0];
        if (topCategoria) {
            const porcentaje = ((parseInt(topCategoria.tiempo_total_minutos || 0) / tiempoTotal) * 100).toFixed(1);
            insights.push(`La categoría "${topCategoria.categoria_principal}" concentra el ${porcentaje}% del tiempo total.`);
        }

        // Tasa de completitud
        const tasaCompletitud = datos.metricas?.tasas?.completitud || 0;
        if (tasaCompletitud >= 80) {
            insights.push(`Excelente tasa de completitud: ${tasaCompletitud}% de actividades completadas.`);
        } else if (tasaCompletitud < 60) {
            insights.push(`Alerta: Solo ${tasaCompletitud}% de actividades completadas. Revisar carga de trabajo.`);
        }

        // Diversificación
        const categoriasPrincipales = [...new Set(datos.categorias.map(c => c.categoria_principal))].length;
        if (categoriasPrincipales >= 5) {
            insights.push(`Alta diversificación: Trabajo distribuido en ${categoriasPrincipales} categorías principales.`);
        } else if (categoriasPrincipales <= 2) {
            insights.push(`Baja diversificación: Trabajo concentrado en ${categoriasPrincipales} categorías. Considerar ampliar alcance.`);
        }

        return insights;
    }
}

module.exports = PorCategoriaPDF;
