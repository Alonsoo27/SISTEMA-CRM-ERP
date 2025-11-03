// ============================================
// SERVICIO DE GENERACIÓN DE REPORTES PDF
// Calidad Corporativa Superior
// ============================================

const PDFDocument = require('pdfkit');

class ReportePDFService {
    /**
     * Generar reporte de productividad personal en PDF
     * Diseño corporativo con gráficos y tablas profesionales
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
                        Subject: 'Reporte de Productividad Personal',
                        Keywords: 'marketing, productividad, reporte'
                    }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // ========================================
                // PÁGINA 1: PORTADA Y RESUMEN EJECUTIVO
                // ========================================

                this._dibujarEncabezadoCorporativo(doc, 'REPORTE DE PRODUCTIVIDAD PERSONAL');

                // Información del usuario
                doc.moveDown(2);
                doc.fontSize(18).fillColor('#1e3a8a').text(datos.usuario.nombre_completo, { align: 'center' });
                doc.fontSize(12).fillColor('#64748b').text(datos.usuario.email, { align: 'center' });
                doc.fontSize(11).fillColor('#64748b').text(`Area: ${datos.usuario.area || 'Marketing'}`, { align: 'center' });

                // Período del reporte
                doc.moveDown(1);
                this._dibujarCajaDestacada(doc, datos.periodo.descripcion, '#3b82f6');

                // RESUMEN EJECUTIVO CON KPIs
                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('RESUMEN EJECUTIVO', { underline: true });
                doc.moveDown(1);

                // Grid de KPIs (2x2)
                const kpis = [
                    {
                        label: 'Total Actividades',
                        valor: datos.metricas.totales.total,
                        simbolo: '[#]',
                        color: '#3b82f6'
                    },
                    {
                        label: 'Tasa Completitud',
                        valor: `${datos.metricas.tasas.completitud}%`,
                        simbolo: datos.metricas.tasas.completitud >= 80 ? '[OK]' : '[!]',
                        color: datos.metricas.tasas.completitud >= 80 ? '#10b981' : '#ef4444'
                    },
                    {
                        label: 'Eficiencia',
                        valor: `${datos.metricas.tasas.eficiencia}%`,
                        simbolo: datos.metricas.tasas.eficiencia <= 100 ? '[OK]' : '[~]',
                        color: datos.metricas.tasas.eficiencia <= 100 ? '#10b981' : '#f59e0b'
                    },
                    {
                        label: 'Tasa Vencimiento',
                        valor: `${datos.metricas.tasas.vencimiento}%`,
                        simbolo: datos.metricas.tasas.vencimiento < 5 ? '[OK]' : '[!]',
                        color: datos.metricas.tasas.vencimiento < 5 ? '#10b981' : '#ef4444'
                    }
                ];

                this._dibujarGridKPIs(doc, kpis);

                // MÉTRICAS DETALLADAS
                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('DESGLOSE DE ACTIVIDADES', { underline: true });
                doc.moveDown(1);

                const tablaEstados = [
                    ['Estado', 'Cantidad', 'Porcentaje'],
                    ['Completadas', datos.metricas.totales.completadas, `${((datos.metricas.totales.completadas / (datos.metricas.totales.total || 1)) * 100).toFixed(1)}%`],
                    ['En Progreso', datos.metricas.totales.en_progreso, `${((datos.metricas.totales.en_progreso / (datos.metricas.totales.total || 1)) * 100).toFixed(1)}%`],
                    ['Pendientes', datos.metricas.totales.pendientes, `${((datos.metricas.totales.pendientes / (datos.metricas.totales.total || 1)) * 100).toFixed(1)}%`],
                    ['Canceladas', datos.metricas.totales.canceladas, `${((datos.metricas.totales.canceladas / (datos.metricas.totales.total || 1)) * 100).toFixed(1)}%`]
                ];

                this._dibujarTabla(doc, tablaEstados, [200, 150, 150]);

                // ACTIVIDADES PRIORITARIAS
                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('ACTIVIDADES PRIORITARIAS', { underline: true });
                doc.moveDown(1);

                doc.fontSize(10);
                doc.fillColor('#374151').text(`Total Prioritarias: ${datos.metricas.totales.prioritarias}`);
                doc.text(`Completadas: ${datos.metricas.totales.prioritarias_completadas}`);
                doc.text(`Tasa de Cumplimiento: ${datos.metricas.tasas.prioritarias}% - ${this._obtenerCalificacion(datos.metricas.tasas.prioritarias)}`);

                // ========================================
                // PÁGINA 2: ANÁLISIS DE TIEMPO
                // ========================================

                doc.addPage();
                this._dibujarEncabezadoCorporativo(doc, 'ANALISIS DE TIEMPO');

                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('GESTION DEL TIEMPO', { underline: true });
                doc.moveDown(1);

                // Convertir minutos a horas:minutos
                const tiempoPlaneadoHoras = this._minutosAHoras(datos.metricas.tiempos.total_planeado_minutos);
                const tiempoRealHoras = this._minutosAHoras(datos.metricas.tiempos.total_real_minutos);
                const tiempoAdicionalHoras = this._minutosAHoras(datos.metricas.tiempos.total_adicional_minutos);
                const promedioHoras = this._minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos));

                const tablaTiempos = [
                    ['Metrica', 'Valor', 'Evaluacion'],
                    ['Tiempo Planeado', tiempoPlaneadoHoras, 'Estimado'],
                    ['Tiempo Real', tiempoRealHoras, datos.metricas.tasas.eficiencia <= 100 ? 'Optimo' : 'Requiere atencion'],
                    ['Tiempo Adicional', tiempoAdicionalHoras, datos.metricas.tiempos.total_adicional_minutos > 0 ? 'Extensiones' : 'Sin extensiones'],
                    ['Promedio por Actividad', promedioHoras, 'Duracion media'],
                    ['Extensiones Solicitadas', datos.metricas.tiempos.con_extension, datos.metricas.tiempos.con_extension > 5 ? 'Alto' : 'Normal']
                ];

                this._dibujarTabla(doc, tablaTiempos, [200, 150, 150]);

                // ANÁLISIS DE EFICIENCIA
                doc.moveDown(2);
                doc.fontSize(12).fillColor('#1e3a8a').text('INTERPRETACION DE EFICIENCIA:', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(10).fillColor('#374151');

                if (datos.metricas.tasas.eficiencia <= 90) {
                    doc.fillColor('#10b981').text('[EXCELENTE] Las actividades se completan antes del tiempo planeado', {
                        indent: 20
                    });
                } else if (datos.metricas.tasas.eficiencia <= 110) {
                    doc.fillColor('#3b82f6').text('[BUENO] El tiempo real esta muy cerca del planeado', {
                        indent: 20
                    });
                } else if (datos.metricas.tasas.eficiencia <= 130) {
                    doc.fillColor('#f59e0b').text('[ATENCION] Las actividades toman mas tiempo del planeado', {
                        indent: 20
                    });
                } else {
                    doc.fillColor('#ef4444').text('[CRITICO] Revisar planificacion de tiempos', {
                        indent: 20
                    });
                }

                // PROBLEMAS Y ALERTAS
                doc.moveDown(2);
                doc.fontSize(14).fillColor('#1e3a8a').text('PROBLEMAS DETECTADOS', { underline: true });
                doc.moveDown(1);

                const tablaProblemas = [
                    ['Tipo', 'Cantidad', 'Impacto'],
                    ['Actividades Vencidas', datos.metricas.problemas.vencidas, datos.metricas.problemas.vencidas === 0 ? 'Ninguno' : 'Alto'],
                    ['Transferencias', datos.metricas.problemas.transferidas, datos.metricas.problemas.transferidas > 3 ? 'Medio' : 'Bajo'],
                    ['Extensiones', datos.metricas.problemas.extensiones, datos.metricas.problemas.extensiones > 5 ? 'Medio' : 'Bajo']
                ];

                this._dibujarTabla(doc, tablaProblemas, [200, 150, 150]);

                // ========================================
                // PÁGINA 3: DISTRIBUCIÓN POR CATEGORÍAS
                // ========================================

                if (datos.categorias && datos.categorias.length > 0) {
                    doc.addPage();
                    this._dibujarEncabezadoCorporativo(doc, 'DISTRIBUCION POR CATEGORIAS');

                    doc.moveDown(2);
                    doc.fontSize(14).fillColor('#1e3a8a').text('ANALISIS POR TIPO DE ACTIVIDAD', { underline: true });
                    doc.moveDown(1);

                    // Calcular porcentajes de tiempo
                    const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);

                    const tablaCategorias = [
                        ['Categoria', 'Cant.', 'Tiempo', '%']
                    ];

                    datos.categorias.slice(0, 10).forEach(cat => {
                        const porcentaje = tiempoTotal > 0
                            ? ((parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1)
                            : 0;

                        tablaCategorias.push([
                            `${cat.categoria_principal}${cat.subcategoria ? ' - ' + cat.subcategoria : ''}`,
                            cat.cantidad,
                            this._minutosAHoras(cat.tiempo_total_minutos),
                            `${porcentaje}%`
                        ]);
                    });

                    this._dibujarTabla(doc, tablaCategorias, [220, 80, 100, 80]);

                    // Top 3 Categorías
                    doc.moveDown(2);
                    doc.fontSize(12).fillColor('#1e3a8a').text('TOP 3 CATEGORIAS (por tiempo invertido):', { underline: true });
                    doc.moveDown(0.5);

                    datos.categorias.slice(0, 3).forEach((cat, idx) => {
                        const medalla = idx === 0 ? '[1]' : idx === 1 ? '[2]' : '[3]';
                        doc.fontSize(10).fillColor('#374151').text(
                            `${medalla} ${cat.categoria_principal}: ${this._minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`,
                            { indent: 20 }
                        );
                    });
                }

                // ========================================
                // PIE DE PÁGINA CORPORATIVO
                // ========================================

                this._dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    // ============================================
    // MÉTODOS DE DISEÑO CORPORATIVO
    // ============================================

    /**
     * Dibuja encabezado corporativo con gradiente
     */
    static _dibujarEncabezadoCorporativo(doc, titulo) {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // Fondo degradado azul corporativo
        doc.rect(0, 0, pageWidth, 80)
           .fill('#1e3a8a');

        // Título
        doc.fontSize(20)
           .fillColor('#ffffff')
           .text(titulo, 50, 30, {
               width: pageWidth - 100,
               align: 'center'
           });

        // Línea decorativa
        doc.strokeColor('#3b82f6')
           .lineWidth(3)
           .moveTo(50, 75)
           .lineTo(pageWidth - 50, 75)
           .stroke();

        // Fecha de generación
        doc.fontSize(8)
           .fillColor('#94a3b8')
           .text(`Generado: ${new Date().toLocaleString('es-ES')}`, 50, pageHeight - 30, {
               width: pageWidth - 100,
               align: 'right'
           });
    }

    /**
     * Dibuja grid de KPIs con cajas de colores
     */
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

            // Fondo de la caja
            doc.rect(x, y, boxWidth, boxHeight)
               .fillAndStroke(kpi.color, '#e5e7eb');

            // Simbolo
            doc.fontSize(14)
               .fillColor('#ffffff')
               .text(kpi.simbolo, x + 15, y + 15);

            // Label
            doc.fontSize(9)
               .fillColor('#ffffff')
               .text(kpi.label, x + 15, y + 50, {
                   width: boxWidth - 30
               });

            // Valor
            doc.fontSize(18)
               .fillColor('#ffffff')
               .text(kpi.valor, x + boxWidth - 80, y + 20, {
                   width: 70,
                   align: 'right'
               });
        });

        doc.y = startY + (Math.ceil(kpis.length / 2) * (boxHeight + gap));
    }

    /**
     * Dibuja tabla profesional con encabezados
     */
    static _dibujarTabla(doc, datos, anchos) {
        const startX = 50;
        const startY = doc.y;
        const rowHeight = 25;

        // Encabezados
        let currentX = startX;
        datos[0].forEach((header, i) => {
            doc.rect(currentX, startY, anchos[i], rowHeight)
               .fillAndStroke('#1e3a8a', '#e5e7eb');

            doc.fontSize(10)
               .fillColor('#ffffff')
               .text(String(header), currentX + 5, startY + 7, {
                   width: anchos[i] - 10,
                   align: 'center'
               });

            currentX += anchos[i];
        });

        // Filas de datos
        let currentY = startY + rowHeight;
        for (let i = 1; i < datos.length; i++) {
            currentX = startX;
            const fillColor = i % 2 === 0 ? '#f9fafb' : '#ffffff';

            datos[i].forEach((cell, j) => {
                doc.rect(currentX, currentY, anchos[j], rowHeight)
                   .fillAndStroke(fillColor, '#e5e7eb');

                doc.fontSize(9)
                   .fillColor('#374151')
                   .text(String(cell), currentX + 5, currentY + 8, {
                       width: anchos[j] - 10,
                       align: j === 0 ? 'left' : 'center'
                   });

                currentX += anchos[j];
            });

            currentY += rowHeight;
        }

        doc.y = currentY + 10;
    }

    /**
     * Dibuja caja destacada con texto centrado
     */
    static _dibujarCajaDestacada(doc, texto, color) {
        const boxY = doc.y;
        const boxHeight = 40;
        const boxWidth = doc.page.width - 100;

        doc.rect(50, boxY, boxWidth, boxHeight)
           .fill(color);

        doc.fontSize(14)
           .fillColor('#ffffff')
           .text(texto, 50, boxY + 12, {
               width: boxWidth,
               align: 'center'
           });

        doc.y = boxY + boxHeight + 10;
    }

    /**
     * Dibuja pie de página corporativo
     */
    static _dibujarPiePagina(doc, usuario, periodo) {
        const pageHeight = doc.page.height;
        const pageWidth = doc.page.width;

        // Línea separadora
        doc.strokeColor('#e5e7eb')
           .lineWidth(1)
           .moveTo(50, pageHeight - 50)
           .lineTo(pageWidth - 50, pageHeight - 50)
           .stroke();

        // Información del documento
        doc.fontSize(8)
           .fillColor('#64748b')
           .text(`Sistema CRM/ERP - Reporte de Productividad`, 50, pageHeight - 40);

        doc.text(`Usuario: ${usuario} | Periodo: ${periodo}`, 50, pageHeight - 30);

        doc.text('CONFIDENCIAL - Uso interno exclusivo', 50, pageHeight - 20, {
            align: 'center',
            width: pageWidth - 100
        });
    }

    // ============================================
    // UTILIDADES
    // ============================================

    static _minutosAHoras(minutos) {
        const horas = Math.floor(minutos / 60);
        const mins = Math.round(minutos % 60);
        return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
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
