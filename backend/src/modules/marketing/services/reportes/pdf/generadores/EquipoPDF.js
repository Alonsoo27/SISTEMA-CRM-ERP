// ============================================
// GENERADOR PDF: REPORTE DE EQUIPO
// Consolidado del equipo de marketing
// ============================================

const PDFBase = require('../utils/PDFBase');
const PDFStyles = require('../utils/PDFStyles');

class EquipoPDF {
    /**
     * Generar reporte consolidado de equipo
     */
    static async generar(datos) {
        try {
            const doc = PDFBase.crearDocumento(
                `Reporte de Equipo - Marketing`,
                'Sistema CRM/ERP',
                {
                    equipo: 'Marketing',
                    periodo: datos.periodo.descripcion
                }
            );

            const bufferPromise = PDFBase.documentoABuffer(doc);

            const tieneMiembros = datos.miembros && datos.miembros.length > 0;

            // ========================================
            // PÁGINA PRINCIPAL
            // ========================================
            doc.addPage();
            await this._generarPaginaPrincipal(doc, datos, tieneMiembros);

            doc.end();
            return await bufferPromise;

        } catch (error) {
            console.error('❌ Error generando PDF de equipo:', error);
            throw error;
        }
    }

    // ============================================
    // PÁGINA PRINCIPAL
    // ============================================

    static async _generarPaginaPrincipal(doc, datos, tieneMiembros) {
        PDFBase.dibujarEncabezado(doc, 'REPORTE CONSOLIDADO DEL EQUIPO');

        // Título
        doc.moveDown(2);
        doc.fontSize(18).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('Equipo de Marketing', { align: 'center' });

        // Período
        doc.moveDown(1);
        PDFBase.dibujarCaja(doc, datos.periodo.descripcion, PDFStyles.COLORES.AZUL_MEDIO);

        if (!tieneMiembros) {
            doc.moveDown(3);
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AMARILLO)
                .text('SIN MIEMBROS EN EL EQUIPO', { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS).text(
                'No se encontraron miembros activos en el equipo de marketing.',
                { align: 'center', width: 500 }
            );
            return;
        }

        // ========================================
        // RESUMEN GENERAL
        // ========================================
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('RESUMEN GENERAL DEL EQUIPO', { align: 'center', underline: true });
        doc.moveDown(0.5);

        const resumen = this._construirResumenGeneral(datos);
        PDFBase.dibujarTabla(doc, resumen, [300, 200]);

        // ========================================
        // RANKING DE MIEMBROS
        // ========================================
        doc.moveDown(1.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('RANKING POR TASA DE COMPLETITUD', { align: 'center', underline: true });
        doc.moveDown(0.5);

        const ranking = this._construirRanking(datos);
        PDFBase.dibujarTabla(doc, ranking, [40, 200, 80, 80, 80]);

        // ========================================
        // DETALLE POR MIEMBRO
        // ========================================
        PDFBase.verificarEspacio(doc, 250, 'DETALLE POR MIEMBRO');

        const detalle = this._construirDetalleMiembros(datos);
        PDFBase.dibujarTabla(doc, detalle, [180, 70, 70, 90, 70]);

        // ========================================
        // ANÁLISIS DEL EQUIPO
        // ========================================
        if (datos.miembros.length > 0) {
            doc.moveDown(1.5);
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
                .text('ANÁLISIS Y OBSERVACIONES', { align: 'center', underline: true });
            doc.moveDown(0.5);

            const analisis = this._generarAnalisis(datos);
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
            analisis.forEach(obs => {
                doc.text(`• ${obs}`, { indent: 20 });
                doc.moveDown(0.3);
            });
        }
    }

    // ============================================
    // CONSTRUCTORES DE DATOS
    // ============================================

    static _construirResumenGeneral(datos) {
        return [
            ['Métrica', 'Valor'],
            ['Total de Miembros', datos.estadisticas.total_miembros],
            ['Actividades Totales', datos.totales.total],
            ['Actividades Completadas', datos.totales.completadas],
            ['Tasa de Completitud', `${datos.tasas.completitud}%`],
            ['Tiempo Total Invertido', PDFBase.minutosAHoras(datos.totales.tiempo_total_minutos)],
            ['Promedio Actividades/Miembro', datos.estadisticas.promedio_actividades]
        ];
    }

    static _construirRanking(datos) {
        const tabla = [['#', 'Miembro', 'Actividades', 'Completadas', 'Tasa']];

        datos.ranking.forEach((miembro, idx) => {
            tabla.push([
                `${idx + 1}`,
                miembro.nombre_completo,
                miembro.totales.total,
                miembro.totales.completadas,
                `${miembro.tasa_completitud}%`
            ]);
        });

        return tabla;
    }

    static _construirDetalleMiembros(datos) {
        const tabla = [['Miembro', 'Total', 'Compl.', 'Tiempo', 'Categ.']];

        datos.miembros.forEach(miembro => {
            tabla.push([
                miembro.nombre_completo,
                miembro.totales.total,
                miembro.totales.completadas,
                PDFBase.minutosAHoras(miembro.tiempo_total_minutos),
                miembro.categorias_trabajadas
            ]);
        });

        return tabla;
    }

    static _generarAnalisis(datos) {
        const analisis = [];

        // Completitud del equipo
        if (datos.tasas.completitud >= 80) {
            analisis.push(`Excelente desempeño del equipo con ${datos.tasas.completitud}% de tasa de completitud.`);
        } else if (datos.tasas.completitud < 60) {
            analisis.push(`Atención: Tasa de completitud del equipo es de ${datos.tasas.completitud}%. Requiere revisión.`);
        }

        // Top performer
        const topPerformer = datos.ranking[0];
        if (topPerformer) {
            analisis.push(`${topPerformer.nombre_completo} lidera con ${topPerformer.tasa_completitud}% de completitud.`);
        }

        // Distribución de carga
        const desviacion = datos.miembros.reduce((sum, m) =>
            sum + Math.abs(m.totales.total - datos.estadisticas.promedio_actividades), 0
        ) / datos.miembros.length;

        if (desviacion < 5) {
            analisis.push('Carga de trabajo bien distribuida entre los miembros del equipo.');
        } else if (desviacion > 15) {
            analisis.push('Alta variación en la carga de trabajo. Considerar redistribución.');
        }

        // Productividad general
        const tiempoPromedioPorActividad = datos.totales.tiempo_total_minutos / datos.totales.completadas;
        if (tiempoPromedioPorActividad > 180) {
            analisis.push(`Tiempo promedio por actividad: ${Math.round(tiempoPromedioPorActividad)} min. Considerar optimización.`);
        }

        return analisis;
    }
}

module.exports = EquipoPDF;
