// ============================================
// CLASE BASE PARA GENERACIÓN DE PDFs
// Métodos comunes reutilizables
// ============================================

const PDFDocument = require('pdfkit');
const PDFStyles = require('./PDFStyles');

class PDFBase {
    /**
     * Crear documento PDF con configuración estándar
     */
    static crearDocumento(titulo, autor = 'Sistema CRM/ERP') {
        return new PDFDocument({
            size: 'A4',
            margins: {
                top: PDFStyles.DIMENSIONES.MARGEN_SUPERIOR,
                bottom: PDFStyles.DIMENSIONES.MARGEN_INFERIOR,
                left: PDFStyles.DIMENSIONES.MARGEN_IZQUIERDO,
                right: PDFStyles.DIMENSIONES.MARGEN_DERECHO
            },
            info: {
                Title: titulo,
                Author: autor,
                Subject: 'Reporte Corporativo'
            }
        });
    }

    /**
     * Convertir documento a buffer (Promise)
     */
    static async documentoABuffer(doc) {
        return new Promise((resolve, reject) => {
            try {
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    // ============================================
    // COMPONENTES COMUNES
    // ============================================

    /**
     * Dibujar encabezado corporativo
     */
    static dibujarEncabezado(doc, titulo) {
        const pageWidth = doc.page.width;

        // Fondo azul
        doc.rect(0, 0, pageWidth, PDFStyles.DIMENSIONES.ALTURA_ENCABEZADO)
            .fill(PDFStyles.COLORES.AZUL_OSCURO);

        // Título
        doc.fontSize(PDFStyles.FUENTES.TITULO_GRANDE)
            .fillColor(PDFStyles.COLORES.BLANCO)
            .text(titulo, 50, 30, { width: pageWidth - 100, align: 'center' });

        // Línea decorativa
        doc.strokeColor(PDFStyles.COLORES.AZUL_MEDIO)
            .lineWidth(3)
            .moveTo(50, 75)
            .lineTo(pageWidth - 50, 75)
            .stroke();

        // Resetear posición Y después del encabezado
        doc.y = PDFStyles.DIMENSIONES.ALTURA_ENCABEZADO + 20;
    }

    /**
     * Dibujar pie de página
     */
    static dibujarPiePagina(doc, usuario, periodo) {
        const pageHeight = doc.page.height;
        const pageWidth = doc.page.width;
        const yPos = pageHeight - PDFStyles.DIMENSIONES.ALTURA_PIE;

        // Línea separadora
        doc.strokeColor(PDFStyles.COLORES.GRIS_BORDE)
            .lineWidth(1)
            .moveTo(50, yPos)
            .lineTo(pageWidth - 50, yPos)
            .stroke();

        // Información
        doc.fontSize(PDFStyles.FUENTES.TEXTO_MUY_PEQUENO)
            .fillColor(PDFStyles.COLORES.GRIS);

        doc.text('Sistema CRM/ERP - Reporte de Productividad', 50, yPos + 10);
        doc.text(`Usuario: ${usuario} | Período: ${periodo}`, 50, yPos + 20);
        doc.text('CONFIDENCIAL - Uso interno exclusivo', 50, yPos + 30, {
            align: 'center',
            width: pageWidth - 100
        });
    }

    /**
     * Dibujar caja de información
     */
    static dibujarCaja(doc, texto, color = PDFStyles.COLORES.AZUL_MEDIO) {
        const boxY = doc.y;
        const boxWidth = doc.page.width - 100;

        doc.rect(50, boxY, boxWidth, 40).fill(color);
        doc.fontSize(PDFStyles.FUENTES.TITULO_PEQUENO)
            .fillColor(PDFStyles.COLORES.BLANCO)
            .text(texto, 50, boxY + 12, { width: boxWidth, align: 'center' });

        doc.y = boxY + 50;
    }

    /**
     * Dibujar grid de KPIs (2x2)
     */
    static dibujarGridKPIs(doc, kpis) {
        const startY = doc.y;
        const { KPI_ANCHO, KPI_ALTO, KPI_GAP } = PDFStyles.DIMENSIONES;

        kpis.forEach((kpi, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 50 + (col * (KPI_ANCHO + KPI_GAP));
            const y = startY + (row * (KPI_ALTO + KPI_GAP));

            // Fondo del KPI
            doc.rect(x, y, KPI_ANCHO, KPI_ALTO)
                .fillAndStroke(kpi.color, PDFStyles.COLORES.GRIS_BORDE);

            // Símbolo
            doc.fontSize(PDFStyles.FUENTES.TITULO_PEQUENO)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(kpi.simbolo, x + 15, y + 15);

            // Label
            doc.fontSize(PDFStyles.FUENTES.TEXTO_PEQUENO)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(kpi.label, x + 15, y + 50, { width: KPI_ANCHO - 30 });

            // Valor
            doc.fontSize(18)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(String(kpi.valor), x + KPI_ANCHO - 80, y + 20, {
                    width: 70,
                    align: 'right'
                });
        });

        // Actualizar posición Y
        doc.y = startY + (Math.ceil(kpis.length / 2) * (KPI_ALTO + KPI_GAP));
    }

    /**
     * Dibujar tabla con formato
     */
    static dibujarTabla(doc, datos, anchos) {
        const startX = 50;
        const startY = doc.y;
        const { TABLA_FILA_ALTURA } = PDFStyles.DIMENSIONES;
        let currentX = startX;

        // Verificar espacio disponible
        const alturaTotal = datos.length * TABLA_FILA_ALTURA;
        const espacioDisponible = doc.page.height - doc.y - PDFStyles.DIMENSIONES.MARGEN_INFERIOR - 20;

        if (alturaTotal > espacioDisponible) {
            doc.addPage();
            this.dibujarEncabezado(doc, 'CONTINUACIÓN');
            doc.moveDown(2);
        }

        const actualStartY = doc.y;

        // Encabezados
        datos[0].forEach((header, i) => {
            doc.rect(currentX, actualStartY, anchos[i], TABLA_FILA_ALTURA)
                .fillAndStroke(PDFStyles.COLORES.AZUL_OSCURO, PDFStyles.COLORES.GRIS_BORDE);

            doc.fontSize(PDFStyles.FUENTES.TEXTO_NORMAL)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(String(header), currentX + 5, actualStartY + 7, {
                    width: anchos[i] - 10,
                    align: 'center'
                });

            currentX += anchos[i];
        });

        // Filas
        let currentY = actualStartY + TABLA_FILA_ALTURA;
        for (let i = 1; i < datos.length; i++) {
            currentX = startX;
            const fillColor = i % 2 === 0
                ? PDFStyles.COLORES.GRIS_CLARO
                : PDFStyles.COLORES.BLANCO;

            datos[i].forEach((cell, j) => {
                doc.rect(currentX, currentY, anchos[j], TABLA_FILA_ALTURA)
                    .fillAndStroke(fillColor, PDFStyles.COLORES.GRIS_BORDE);

                doc.fontSize(PDFStyles.FUENTES.TEXTO_PEQUENO)
                    .fillColor(PDFStyles.COLORES.GRIS_TEXTO)
                    .text(String(cell), currentX + 5, currentY + 8, {
                        width: anchos[j] - 10,
                        align: j === 0 ? 'left' : 'center'
                    });

                currentX += anchos[j];
            });
            currentY += TABLA_FILA_ALTURA;
        }

        doc.y = currentY + 10;
    }

    // ============================================
    // UTILIDADES DE FORMATO
    // ============================================

    /**
     * Convertir minutos a formato legible
     */
    static minutosAHoras(minutos) {
        if (!minutos || minutos === 0) return '0min';
        const horas = Math.floor(minutos / 60);
        const mins = Math.round(minutos % 60);
        return horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;
    }

    /**
     * Formatear porcentaje
     */
    static formatearPorcentaje(valor) {
        return `${parseFloat(valor).toFixed(1)}%`;
    }

    /**
     * Verificar espacio y agregar página si es necesario
     */
    static verificarEspacio(doc, alturaRequerida, tituloNuevaPagina = '') {
        const espacioDisponible = doc.page.height - doc.y - PDFStyles.DIMENSIONES.MARGEN_INFERIOR;

        if (alturaRequerida > espacioDisponible) {
            doc.addPage();
            if (tituloNuevaPagina) {
                this.dibujarEncabezado(doc, tituloNuevaPagina);
                doc.moveDown(2);
            }
            return true;
        }
        return false;
    }
}

module.exports = PDFBase;
