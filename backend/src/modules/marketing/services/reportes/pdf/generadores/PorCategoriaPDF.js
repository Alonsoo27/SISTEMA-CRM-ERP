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
                doc.end();
                return await bufferPromise;
            }

            // ========================================
            // RESUMEN EJECUTIVO
            // ========================================
            doc.moveDown(1.5);
            PDFBase.dibujarSubtitulo(doc, '📊 RESUMEN EJECUTIVO');
            doc.moveDown(0.5);

            const resumen = this._construirResumenEjecutivo(datos);
            PDFBase.dibujarTabla(doc, resumen);

            // ========================================
            // DISTRIBUCIÓN POR CATEGORÍA PRINCIPAL
            // ========================================
            doc.moveDown(1.5);
            PDFBase.dibujarSubtitulo(doc, '🎯 DISTRIBUCIÓN POR CATEGORÍA PRINCIPAL');
            doc.moveDown(0.5);

            const distribucion = this._construirDistribucionPrincipal(datos);
            PDFBase.dibujarTabla(doc, distribucion);

            // ========================================
            // DETALLE CON SUBCATEGORÍAS (si cabe, sino nueva página)
            // ========================================
            PDFBase.verificarEspacio(doc, 250, '📋 DETALLE POR CATEGORÍA Y SUBCATEGORÍA');

            const detalle = this._construirDetalleCompleto(datos);
            PDFBase.dibujarTabla(doc, detalle);

            // ========================================
            // TOP 5 CATEGORÍAS
            // ========================================
            doc.moveDown(1.5);
            PDFBase.dibujarSubtitulo(doc, '🏆 TOP 5 CATEGORÍAS (Mayor Tiempo Invertido)');
            doc.moveDown(0.5);

            const top5 = this._construirTop5(datos);
            PDFBase.dibujarTabla(doc, top5);

            // ========================================
            // ANÁLISIS Y RECOMENDACIONES
            // ========================================
            if (datos.categorias.length > 0) {
                doc.moveDown(1.5);
                PDFBase.dibujarSubtitulo(doc, '💡 INSIGHTS Y RECOMENDACIONES');
                doc.moveDown(0.5);

                const insights = this._generarInsights(datos);
                doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
                insights.forEach(insight => {
                    doc.text(`• ${insight}`, { indent: 20 });
                    doc.moveDown(0.3);
                });
            }

            doc.end();
            return await bufferPromise;

        } catch (error) {
            console.error('❌ Error generando PDF por categoría:', error);
            throw error;
        }
    }

    // ============================================
    // CONSTRUCTORES DE DATOS
    // ============================================

    static _construirResumenEjecutivo(datos) {
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
            ['Tiempo Total Invertido', PDFBase.minutosAHoras(tiempoTotal)],
            ['Promedio por Categoría', PDFBase.minutosAHoras(Math.floor(tiempoTotal / datos.categorias.length))]
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
        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos), 0
        );

        const tabla = [['Categoría / Subcategoría', 'Cant.', 'Compl.', 'Tiempo', '%']];

        datos.categorias.forEach(cat => {
            const porcentaje = tiempoTotal > 0
                ? ((parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1)
                : 0;

            const nombre = cat.subcategoria
                ? `${cat.categoria_principal} / ${cat.subcategoria}`
                : cat.categoria_principal;

            tabla.push([
                nombre,
                cat.cantidad,
                cat.completadas,
                PDFBase.minutosAHoras(cat.tiempo_total_minutos),
                `${porcentaje}%`
            ]);
        });

        return tabla;
    }

    static _construirTop5(datos) {
        const tabla = [['#', 'Categoría', 'Actividades', 'Tiempo Total', '% del Total']];

        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos), 0
        );

        datos.categorias
            .slice(0, 5)
            .forEach((cat, idx) => {
                const porcentaje = tiempoTotal > 0
                    ? ((parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1)
                    : 0;

                const nombre = cat.subcategoria
                    ? `${cat.categoria_principal} - ${cat.subcategoria}`
                    : cat.categoria_principal;

                const medalla = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}°`;

                tabla.push([
                    medalla,
                    nombre,
                    cat.cantidad,
                    PDFBase.minutosAHoras(cat.tiempo_total_minutos),
                    `${porcentaje}%`
                ]);
            });

        return tabla;
    }

    static _generarInsights(datos) {
        const insights = [];
        const tiempoTotal = datos.categorias.reduce((sum, cat) =>
            sum + parseInt(cat.tiempo_total_minutos), 0
        );

        // Categoría dominante
        if (datos.categorias.length > 0) {
            const top = datos.categorias[0];
            const porcentaje = ((parseInt(top.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1);
            insights.push(
                `La categoría "${top.categoria_principal}" consume el ${porcentaje}% del tiempo total (${PDFBase.minutosAHoras(top.tiempo_total_minutos)}).`
            );
        }

        // Diversificación
        const categoriasPrincipales = [...new Set(datos.categorias.map(c => c.categoria_principal))].length;
        if (categoriasPrincipales < 3) {
            insights.push('El trabajo está muy concentrado en pocas categorías. Considerar diversificar actividades.');
        } else if (categoriasPrincipales > 8) {
            insights.push('Alta diversificación de categorías. Evaluar si es necesario consolidar tareas similares.');
        } else {
            insights.push(`Distribución balanceada con ${categoriasPrincipales} categorías principales.`);
        }

        // Completitud por categoría
        const categoriasBajaCompletitud = datos.categorias.filter(cat => {
            const completitud = (parseInt(cat.completadas) / parseInt(cat.cantidad)) * 100;
            return completitud < 70 && parseInt(cat.cantidad) >= 3;
        });

        if (categoriasBajaCompletitud.length > 0) {
            insights.push(
                `Atención: ${categoriasBajaCompletitud.length} categorías tienen baja tasa de completitud (<70%).`
            );
        }

        // Promedio de actividades por categoría
        const promedioPorCategoria = datos.metricas.totales.total / datos.categorias.length;
        if (promedioPorCategoria < 2) {
            insights.push('Muchas categorías con pocas actividades. Considerar reagrupar para mejor organización.');
        }

        return insights;
    }
}

module.exports = PorCategoriaPDF;
