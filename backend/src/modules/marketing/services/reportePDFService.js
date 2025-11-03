// ============================================
// SERVICIO DE GENERACIÓN DE REPORTES PDF
// Calidad Corporativa Superior - Versión Corregida
// ============================================

const PDFDocument = require('pdfkit');

class ReportePDFService {
    /**
     * Generar reporte de productividad personal en PDF
     * Diseño corporativo con validación de datos
     */
    static async generarProductividadPersonal(datos) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 50, right: 50 },
                    info: {
                        Title: `Reporte de Productividad - ${datos.usuario.nombre_completo}`,
                        Author: 'Sistema CRM/ERP',
                        Subject: 'Reporte de Productividad Personal'
                    }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const tieneActividades = datos.metricas.totales.total > 0;

                // ========================================
                // ENCABEZADO CORPORATIVO (todas las páginas)
                // ========================================
                this._dibujarEncabezado(doc, 'REPORTE DE PRODUCTIVIDAD PERSONAL');

                // Información del usuario
                doc.moveDown(2);
                doc.fontSize(18).fillColor('#1e3a8a').text(datos.usuario.nombre_completo, { align: 'center' });
                doc.fontSize(12).fillColor('#64748b').text(datos.usuario.email, { align: 'center' });
                doc.fontSize(11).fillColor('#64748b').text(`Área: ${datos.usuario.area || 'Marketing'}`, { align: 'center' });

                // Período
                doc.moveDown(1);
                this._dibujarCaja(doc, datos.periodo.descripcion, '#3b82f6');

                // ========================================
                // SI NO HAY ACTIVIDADES: PDF SIMPLIFICADO
                // ========================================
                if (!tieneActividades) {
                    doc.moveDown(3);
                    doc.fontSize(14).fillColor('#f59e0b').text('SIN ACTIVIDADES REGISTRADAS', { align: 'center' });
                    doc.moveDown(1);
                    doc.fontSize(10).fillColor('#64748b').text(
                        `No se encontraron actividades para el período seleccionado (${datos.periodo.descripcion}).`,
                        { align: 'center', width: 500 }
                    );
                    doc.text('Por favor, selecciona otro período o crea actividades.', { align: 'center', width: 500 });

                    this._dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);
                    doc.end();
                    return;
                }

                // ========================================
                // RESUMEN EJECUTIVO
                // ========================================
                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('RESUMEN EJECUTIVO', { align: 'left', underline: true });
                doc.moveDown(1);

                // KPIs en grid
                const kpis = [
                    { label: 'Total Actividades', valor: datos.metricas.totales.total, simbolo: '[#]', color: '#3b82f6' },
                    { label: 'Tasa Completitud', valor: `${this._formatPct(datos.metricas.tasas.completitud)}`, simbolo: this._getSimbolo(datos.metricas.tasas.completitud, 80, true), color: this._getColor(datos.metricas.tasas.completitud, 80, true) },
                    { label: 'Eficiencia', valor: `${this._formatPct(datos.metricas.tasas.eficiencia)}`, simbolo: this._getSimbolo(datos.metricas.tasas.eficiencia, 100, false), color: this._getColor(datos.metricas.tasas.eficiencia, 100, false) },
                    { label: 'Tasa Vencimiento', valor: `${this._formatPct(datos.metricas.tasas.vencimiento)}`, simbolo: this._getSimbolo(datos.metricas.tasas.vencimiento, 5, false), color: this._getColor(datos.metricas.tasas.vencimiento, 5, false) }
                ];

                this._dibujarGridKPIs(doc, kpis);

                // ========================================
                // DESGLOSE DE ACTIVIDADES
                // ========================================
                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('DESGLOSE DE ACTIVIDADES', { align: 'left', underline: true });
                doc.moveDown(1);

                const tablaEstados = [
                    ['Estado', 'Cantidad', 'Porcentaje'],
                    ['Completadas', datos.metricas.totales.completadas, this._formatPct((datos.metricas.totales.completadas / datos.metricas.totales.total) * 100)],
                    ['En Progreso', datos.metricas.totales.en_progreso, this._formatPct((datos.metricas.totales.en_progreso / datos.metricas.totales.total) * 100)],
                    ['Pendientes', datos.metricas.totales.pendientes, this._formatPct((datos.metricas.totales.pendientes / datos.metricas.totales.total) * 100)],
                    ['Canceladas', datos.metricas.totales.canceladas, this._formatPct((datos.metricas.totales.canceladas / datos.metricas.totales.total) * 100)]
                ];

                this._dibujarTabla(doc, tablaEstados, [200, 150, 150]);

                // ========================================
                // ACTIVIDADES PRIORITARIAS
                // ========================================
                doc.moveDown(1);
                doc.fontSize(14).fillColor('#1e3a8a').text('ACTIVIDADES PRIORITARIAS', { align: 'left', underline: true });
                doc.moveDown(0.5);

                doc.fontSize(10).fillColor('#374151');
                doc.text(`Total Prioritarias: ${datos.metricas.totales.prioritarias}`);
                doc.text(`Completadas: ${datos.metricas.totales.prioritarias_completadas}`);

                if (datos.metricas.totales.prioritarias > 0) {
                    const tasaPrioritarias = datos.metricas.tasas.prioritarias;
                    doc.text(`Tasa de Cumplimiento: ${this._formatPct(tasaPrioritarias)} - ${this._obtenerCalificacion(tasaPrioritarias)}`);
                } else {
                    doc.text('Tasa de Cumplimiento: N/A (sin actividades prioritarias)');
                }

                // ========================================
                // NUEVA PÁGINA: ANÁLISIS DE TIEMPO
                // ========================================
                doc.addPage();
                this._dibujarEncabezado(doc, 'ANÁLISIS DE TIEMPO');

                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('GESTIÓN DEL TIEMPO', { align: 'left', underline: true });
                doc.moveDown(1);

                const tablaTiempos = [
                    ['Métrica', 'Valor', 'Evaluación'],
                    ['Tiempo Planeado', this._minutosAHoras(datos.metricas.tiempos.total_planeado_minutos), 'Estimado'],
                    ['Tiempo Real', this._minutosAHoras(datos.metricas.tiempos.total_real_minutos), datos.metricas.tiempos.total_real_minutos > 0 ? (datos.metricas.tasas.eficiencia <= 100 ? 'Óptimo' : 'Requiere atención') : 'Sin datos'],
                    ['Tiempo Adicional', this._minutosAHoras(datos.metricas.tiempos.total_adicional_minutos), datos.metricas.tiempos.total_adicional_minutos > 0 ? 'Con extensiones' : 'Sin extensiones'],
                    ['Promedio por Actividad', this._minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos)), 'Duración media'],
                    ['Extensiones Solicitadas', datos.metricas.tiempos.con_extension, datos.metricas.tiempos.con_extension > 5 ? 'Alto' : 'Normal']
                ];

                this._dibujarTabla(doc, tablaTiempos, [200, 150, 150]);

                // INTERPRETACIÓN DE EFICIENCIA (solo si hay datos)
                if (datos.metricas.tiempos.total_real_minutos > 0) {
                    doc.moveDown(1);
                    doc.fontSize(12).fillColor('#1e3a8a').text('INTERPRETACIÓN DE EFICIENCIA:', { align: 'left', underline: true });
                    doc.moveDown(0.5);
                    doc.fontSize(10);

                    const eficiencia = datos.metricas.tasas.eficiencia;
                    if (eficiencia <= 90) {
                        doc.fillColor('#10b981').text('[EXCELENTE] Las actividades se completan antes del tiempo planeado.', { indent: 20 });
                    } else if (eficiencia <= 110) {
                        doc.fillColor('#3b82f6').text('[BUENO] El tiempo real está muy cerca del planeado.', { indent: 20 });
                    } else if (eficiencia <= 130) {
                        doc.fillColor('#f59e0b').text('[ATENCIÓN] Las actividades toman más tiempo del planeado.', { indent: 20 });
                    } else {
                        doc.fillColor('#ef4444').text('[CRÍTICO] Revisar planificación de tiempos.', { indent: 20 });
                    }
                }

                // ========================================
                // PROBLEMAS DETECTADOS
                // ========================================
                doc.moveDown(1.5);
                doc.fontSize(14).fillColor('#1e3a8a').text('PROBLEMAS DETECTADOS', { align: 'left', underline: true });
                doc.moveDown(1);

                const tablaProblemas = [
                    ['Tipo', 'Cantidad', 'Impacto'],
                    ['Actividades Vencidas', datos.metricas.problemas.vencidas, this._getImpacto(datos.metricas.problemas.vencidas, [0, 3])],
                    ['Transferencias', datos.metricas.problemas.transferidas, this._getImpacto(datos.metricas.problemas.transferidas, [0, 3])],
                    ['Extensiones', datos.metricas.problemas.extensiones, this._getImpacto(datos.metricas.problemas.extensiones, [0, 5])]
                ];

                this._dibujarTabla(doc, tablaProblemas, [200, 150, 150]);

                // ========================================
                // DISTRIBUCIÓN POR CATEGORÍAS (si hay)
                // ========================================
                if (datos.categorias && datos.categorias.length > 0) {
                    doc.addPage();
                    this._dibujarEncabezado(doc, 'DISTRIBUCIÓN POR CATEGORÍAS');

                    doc.moveDown(2);
                    doc.fontSize(14).fillColor('#1e3a8a').text('ANÁLISIS POR TIPO DE ACTIVIDAD', { align: 'left', underline: true });
                    doc.moveDown(1);

                    const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);
                    const tablaCategorias = [['Categoría', 'Cant.', 'Tiempo', '%']];

                    datos.categorias.slice(0, 10).forEach(cat => {
                        const porcentaje = tiempoTotal > 0 ? (parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100 : 0;
                        tablaCategorias.push([
                            `${cat.categoria_principal}${cat.subcategoria ? ' - ' + cat.subcategoria : ''}`,
                            cat.cantidad,
                            this._minutosAHoras(cat.tiempo_total_minutos),
                            this._formatPct(porcentaje)
                        ]);
                    });

                    this._dibujarTabla(doc, tablaCategorias, [220, 80, 100, 80]);

                    // Top 3
                    doc.moveDown(1);
                    doc.fontSize(12).fillColor('#1e3a8a').text('TOP 3 CATEGORÍAS (por tiempo invertido):', { align: 'left', underline: true });
                    doc.moveDown(0.5);

                    datos.categorias.slice(0, 3).forEach((cat, idx) => {
                        doc.fontSize(10).fillColor('#374151').text(
                            `[${idx + 1}] ${cat.categoria_principal}: ${this._minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`,
                            { indent: 20 }
                        );
                    });
                }

                this._dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);
                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    // ============================================
    // MÉTODOS DE DISEÑO
    // ============================================

    static _dibujarEncabezado(doc, titulo) {
        const pageWidth = doc.page.width;
        doc.rect(0, 0, pageWidth, 80).fill('#1e3a8a');
        doc.fontSize(20).fillColor('#ffffff').text(titulo, 50, 30, { width: pageWidth - 100, align: 'center' });
        doc.strokeColor('#3b82f6').lineWidth(3).moveTo(50, 75).lineTo(pageWidth - 50, 75).stroke();
    }

    static _dibujarGridKPIs(doc, kpis) {
        const startY = doc.y;
        const boxWidth = 240;
        const boxHeight = 80;
        const gap = 20;

        kpis.forEach((kpi, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 50 + (col * (boxWidth + gap));
            const y = startY + (row * (boxHeight + gap));

            doc.rect(x, y, boxWidth, boxHeight).fillAndStroke(kpi.color, '#e5e7eb');
            doc.fontSize(14).fillColor('#ffffff').text(kpi.simbolo, x + 15, y + 15);
            doc.fontSize(9).fillColor('#ffffff').text(kpi.label, x + 15, y + 50, { width: boxWidth - 30 });
            doc.fontSize(18).fillColor('#ffffff').text(String(kpi.valor), x + boxWidth - 80, y + 20, { width: 70, align: 'right' });
        });

        doc.y = startY + (Math.ceil(kpis.length / 2) * (boxHeight + gap));
    }

    static _dibujarTabla(doc, datos, anchos) {
        const startX = 50;
        const startY = doc.y;
        const rowHeight = 25;
        let currentX = startX;

        // Encabezados
        datos[0].forEach((header, i) => {
            doc.rect(currentX, startY, anchos[i], rowHeight).fillAndStroke('#1e3a8a', '#e5e7eb');
            doc.fontSize(10).fillColor('#ffffff').text(String(header), currentX + 5, startY + 7, { width: anchos[i] - 10, align: 'center' });
            currentX += anchos[i];
        });

        // Filas
        let currentY = startY + rowHeight;
        for (let i = 1; i < datos.length; i++) {
            currentX = startX;
            const fillColor = i % 2 === 0 ? '#f9fafb' : '#ffffff';
            datos[i].forEach((cell, j) => {
                doc.rect(currentX, currentY, anchos[j], rowHeight).fillAndStroke(fillColor, '#e5e7eb');
                doc.fontSize(9).fillColor('#374151').text(String(cell), currentX + 5, currentY + 8, { width: anchos[j] - 10, align: j === 0 ? 'left' : 'center' });
                currentX += anchos[j];
            });
            currentY += rowHeight;
        }

        doc.y = currentY + 10;
    }

    static _dibujarCaja(doc, texto, color) {
        const boxY = doc.y;
        const boxWidth = doc.page.width - 100;
        doc.rect(50, boxY, boxWidth, 40).fill(color);
        doc.fontSize(14).fillColor('#ffffff').text(texto, 50, boxY + 12, { width: boxWidth, align: 'center' });
        doc.y = boxY + 50;
    }

    static _dibujarPiePagina(doc, usuario, periodo) {
        const pageHeight = doc.page.height;
        const pageWidth = doc.page.width;
        doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, pageHeight - 50).lineTo(pageWidth - 50, pageHeight - 50).stroke();
        doc.fontSize(8).fillColor('#64748b').text('Sistema CRM/ERP - Reporte de Productividad', 50, pageHeight - 40);
        doc.text(`Usuario: ${usuario} | Período: ${periodo}`, 50, pageHeight - 30);
        doc.text('CONFIDENCIAL - Uso interno exclusivo', 50, pageHeight - 20, { align: 'center', width: pageWidth - 100 });
    }

    // ============================================
    // UTILIDADES
    // ============================================

    static _minutosAHoras(minutos) {
        const horas = Math.floor(minutos / 60);
        const mins = Math.round(minutos % 60);
        return horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;
    }

    static _formatPct(valor) {
        return `${valor.toFixed(1)}%`;
    }

    static _getSimbolo(valor, umbral, mayor) {
        if (mayor) return valor >= umbral ? '[OK]' : '[!]';
        return valor <= umbral ? '[OK]' : '[!]';
    }

    static _getColor(valor, umbral, mayor) {
        if (mayor) return valor >= umbral ? '#10b981' : '#ef4444';
        return valor <= umbral ? '#10b981' : '#ef4444';
    }

    static _getImpacto(cantidad, umbrales) {
        if (cantidad === 0) return 'Ninguno';
        if (cantidad <= umbrales[1]) return 'Bajo';
        return 'Alto';
    }

    static _obtenerCalificacion(porcentaje) {
        if (porcentaje >= 95) return 'Excelente';
        if (porcentaje >= 85) return 'Muy Bueno';
        if (porcentaje >= 70) return 'Bueno';
        if (porcentaje >= 50) return 'Regular';
        return 'Deficiente';
    }
}

module.exports = ReportePDFService;
