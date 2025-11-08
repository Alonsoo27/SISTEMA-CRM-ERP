// ============================================
// CLASE BASE PARA GENERACIÓN DE PDFs
// Métodos comunes reutilizables
// VERSIÓN OPTIMIZADA v2.0 con nuevos gráficos
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
     * Dibujar grid de KPIs (2x2) OPTIMIZADO
     */
    static dibujarGridKPIs(doc, kpis) {
        const startY = doc.y;
        const { KPI_ANCHO, KPI_ALTO, KPI_GAP, KPI_PADDING } = PDFStyles.DIMENSIONES;

        kpis.forEach((kpi, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 50 + (col * (KPI_ANCHO + KPI_GAP));
            const y = startY + (row * (KPI_ALTO + KPI_GAP));

            // Fondo del KPI con borde
            doc.rect(x, y, KPI_ANCHO, KPI_ALTO)
                .lineWidth(2)
                .fillAndStroke(kpi.color, PDFStyles.COLORES.GRIS_BORDE);

            // Símbolo (arriba izquierda)
            doc.fontSize(PDFStyles.FUENTES.TITULO_PEQUENO)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(kpi.simbolo, x + KPI_PADDING, y + KPI_PADDING);

            // Label (abajo izquierda)
            doc.fontSize(PDFStyles.FUENTES.TEXTO_PEQUENO)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(kpi.label, x + KPI_PADDING, y + KPI_ALTO - 28, {
                    width: KPI_ANCHO - KPI_PADDING * 2 - 80
                });

            // Valor (derecha, destacado)
            doc.fontSize(PDFStyles.FUENTES.VALOR_KPI)
                .fillColor(PDFStyles.COLORES.BLANCO)
                .text(String(kpi.valor), x + KPI_ANCHO - 80, y + KPI_PADDING + 5, {
                    width: 70,
                    align: 'right'
                });
        });

        // Actualizar posición Y
        doc.y = startY + (Math.ceil(kpis.length / 2) * (KPI_ALTO + KPI_GAP)) + 
                PDFStyles.DIMENSIONES.ESPACIO_ENTRE_SECCIONES;
    }

    /**
     * Dibujar tabla con formato mejorado y filas dinámicas
     */
    static dibujarTabla(doc, datos, anchos) {
        const startX = 50;
        const startY = doc.y;
        const { TABLA_FILA_ALTURA, TABLA_PADDING_HORIZONTAL, TABLA_PADDING_VERTICAL } = PDFStyles.DIMENSIONES;
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
                .text(
                    String(header),
                    currentX + TABLA_PADDING_HORIZONTAL,
                    actualStartY + TABLA_PADDING_VERTICAL,
                    {
                        width: anchos[i] - (TABLA_PADDING_HORIZONTAL * 2),
                        align: 'center'
                    }
                );

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
                    .text(
                        String(cell),
                        currentX + TABLA_PADDING_HORIZONTAL,
                        currentY + TABLA_PADDING_VERTICAL + 1,
                        {
                            width: anchos[j] - (TABLA_PADDING_HORIZONTAL * 2),
                            align: j === 0 ? 'left' : 'center'
                        }
                    );

                currentX += anchos[j];
            });
            currentY += TABLA_FILA_ALTURA;
        }

        doc.y = currentY + PDFStyles.DIMENSIONES.ESPACIO_ENTRE_ELEMENTOS;
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
     * Verificar espacio y agregar página si es necesario (MEJORADO)
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

    // ============================================
    // NUEVOS GRÁFICOS VISUALES
    // ============================================

    /**
     * NUEVO: Dibujar gráfico donut (rosca)
     * Para estados de actividades o distribución por categorías
     */
    static dibujarDonut(doc, datos, opciones = {}) {
        // Validar que doc.y sea un número válido
        const currentY = typeof doc.y === 'number' && !isNaN(doc.y) ? doc.y : 100;

        const {
            centerX = 120,
            centerY = currentY + 80,
            radius = 70,
            innerRadius = 45,
            mostrarLeyenda = true
        } = opciones;

        // Validar datos y filtrar valores inválidos
        const datosValidos = datos.filter(item =>
            item && typeof item.valor === 'number' && !isNaN(item.valor) && item.valor > 0
        );

        if (datosValidos.length === 0) {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos para mostrar', centerX - 50, centerY - 10);
            return;
        }

        const total = datosValidos.reduce((sum, item) => sum + item.valor, 0);

        if (total === 0) {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos para mostrar', centerX - 50, centerY - 10);
            return;
        }

        let startAngle = -90;

        // Dibujar segmentos
        datosValidos.forEach((item, index) => {
            const angle = (item.valor / total) * 360;
            const endAngle = startAngle + angle;

            // Solo dibujar si el ángulo es válido
            if (!isNaN(angle) && angle > 0) {
                this._dibujarArcoDonut(doc, centerX, centerY, radius, innerRadius, startAngle, endAngle, item.color);
            }

            startAngle = endAngle;
        });

        // Centro blanco
        doc.circle(centerX, centerY, innerRadius).fill(PDFStyles.COLORES.BLANCO);

        // Valor central
        doc.fontSize(20).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
            .text(String(total), centerX - 30, centerY - 10, { width: 60, align: 'center' });

        // Leyenda (a la derecha)
        if (mostrarLeyenda) {
            let legendY = centerY - (datosValidos.length * 10);
            const legendX = centerX + radius + 30;

            datosValidos.forEach((item) => {
                // Cuadrado de color
                doc.rect(legendX, legendY, 10, 10).fill(item.color);

                // Texto
                doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
                    .text(`${item.label}: ${item.valor}`, legendX + 15, legendY, { width: 150 });

                legendY += 20;
            });
        }

        // Actualizar posición Y
        doc.y = centerY + radius + 20;
    }

    /**
     * AUXILIAR: Dibujar arco para donut
     */
    static _dibujarArcoDonut(doc, cx, cy, radiusOuter, radiusInner, startAngle, endAngle, color) {
        // Validar que todos los parámetros sean números válidos
        if (isNaN(cx) || isNaN(cy) || isNaN(radiusOuter) || isNaN(radiusInner) || isNaN(startAngle) || isNaN(endAngle)) {
            console.warn('⚠️ Valores inválidos en _dibujarArcoDonut:', { cx, cy, radiusOuter, radiusInner, startAngle, endAngle });
            return;
        }

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        // Punto inicial exterior
        const x1 = cx + radiusOuter * Math.cos(startRad);
        const y1 = cy + radiusOuter * Math.sin(startRad);

        // Punto final exterior
        const x2 = cx + radiusOuter * Math.cos(endRad);
        const y2 = cy + radiusOuter * Math.sin(endRad);

        // Punto inicial interior
        const x3 = cx + radiusInner * Math.cos(endRad);
        const y3 = cy + radiusInner * Math.sin(endRad);

        // Punto final interior
        const x4 = cx + radiusInner * Math.cos(startRad);
        const y4 = cy + radiusInner * Math.sin(startRad);

        // Validar puntos calculados
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x3) || isNaN(y3) || isNaN(x4) || isNaN(y4)) {
            console.warn('⚠️ Puntos calculados inválidos en _dibujarArcoDonut');
            return;
        }

        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        doc.path(`
            M ${x1} ${y1}
            A ${radiusOuter} ${radiusOuter} 0 ${largeArc} 1 ${x2} ${y2}
            L ${x3} ${y3}
            A ${radiusInner} ${radiusInner} 0 ${largeArc} 0 ${x4} ${y4}
            Z
        `).fill(color);
    }

    /**
     * NUEVO: Dibujar gauge (medidor semicircular)
     * Para métricas como eficiencia
     */
    static dibujarGauge(doc, valor, opciones = {}) {
        // Validar que doc.y sea un número válido
        const currentY = typeof doc.y === 'number' && !isNaN(doc.y) ? doc.y : 100;

        const {
            centerX = 150,
            centerY = currentY + 100,
            radius = 80,
            label = 'Eficiencia',
            valorMax = 150,
            unidad = '%'
        } = opciones;

        // Validar valor
        if (typeof valor !== 'number' || isNaN(valor)) {
            console.warn('⚠️ Valor inválido en dibujarGauge:', valor);
            return;
        }

        // Fondo del gauge (gris)
        this._dibujarArcoGauge(doc, centerX, centerY, radius, -180, 0, PDFStyles.COLORES.GRIS_CLARO);

        // Calcular ángulo del valor (de -180° a 0°)
        const porcentaje = Math.min(valor / valorMax, 1);
        const angulo = -180 + (porcentaje * 180);

        // Determinar color según valor
        let color;
        if (valor <= 100) color = PDFStyles.COLORES.VERDE;
        else if (valor <= 120) color = PDFStyles.COLORES.AMARILLO;
        else color = PDFStyles.COLORES.ROJO;

        // Arco de progreso
        this._dibujarArcoGauge(doc, centerX, centerY, radius, -180, angulo, color);

        // Valor central
        doc.fontSize(24).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
            .text(`${valor}${unidad}`, centerX - 40, centerY - 15, { width: 80, align: 'center' });

        // Label
        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
            .text(label, centerX - 50, centerY + 15, { width: 100, align: 'center' });

        // Actualizar posición Y
        doc.y = centerY + radius + 10;
    }

    /**
     * AUXILIAR: Dibujar arco para gauge
     */
    static _dibujarArcoGauge(doc, cx, cy, radius, startAngle, endAngle, color) {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        doc.path(`
            M ${x1} ${y1}
            A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        `)
        .lineWidth(15)
        .stroke(color);
    }

    /**
     * NUEVO: Dibujar progress bar (barra de progreso)
     */
    static dibujarProgressBar(doc, porcentaje, opciones = {}) {
        const {
            ancho = PDFStyles.DIMENSIONES.PROGRESS_BAR_ANCHO,
            alto = PDFStyles.DIMENSIONES.PROGRESS_BAR_ALTURA,
            x = doc.x,
            y = doc.y,
            mostrarPorcentaje = true
        } = opciones;

        // Fondo
        doc.rect(x, y, ancho, alto)
            .fill(PDFStyles.COLORES.GRIS_CLARO);

        // Progreso
        const anchoProgreso = (ancho * porcentaje) / 100;
        const color = porcentaje >= 80 ? PDFStyles.COLORES.VERDE :
                      porcentaje >= 50 ? PDFStyles.COLORES.AMARILLO :
                      PDFStyles.COLORES.ROJO;

        doc.rect(x, y, anchoProgreso, alto)
            .fill(color);

        // Porcentaje
        if (mostrarPorcentaje) {
            doc.fontSize(8).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
                .text(`${porcentaje.toFixed(1)}%`, x + ancho + 8, y + 2);
        }

        doc.y = y + alto + PDFStyles.DIMENSIONES.ESPACIO_ENTRE_ELEMENTOS;
    }

    /**
     * Dibujar gráfico de barras horizontal (MEJORADO)
     */
    static dibujarBarrasHorizontal(doc, datos, opciones = {}) {
        const {
            ancho = 320,
            altoBarra = 22,
            espacio = 8,
            titulo = ''
        } = opciones;

        // Validar datos
        if (!datos || datos.length === 0) {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos para mostrar', 50, doc.y);
            doc.moveDown(1);
            return;
        }

        const startX = 70;
        const startY = doc.y;

        // Título si existe
        if (titulo) {
            doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
                .text(titulo, 50, startY, { underline: true });
            doc.moveDown(0.5);
        }

        let currentY = doc.y;

        // Calcular valor máximo para escala (con validación para array vacío)
        const valores = datos.map(d => d.valor).filter(v => typeof v === 'number' && !isNaN(v));
        const maxValor = valores.length > 0 ? Math.max(...valores, 1) : 1;

        datos.forEach((item) => {
            const proporcion = item.valor / maxValor;
            const anchoBarra = ancho * proporcion;

            // Label
            doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
                .text(item.label, 50, currentY + 6, { width: 120 });

            // Barra de fondo
            doc.rect(startX + 130, currentY, ancho, altoBarra)
                .fill(PDFStyles.COLORES.GRIS_CLARO);

            // Barra de progreso
            const color = item.color || PDFStyles.COLORES.AZUL_MEDIO;
            if (anchoBarra > 0) {
                doc.rect(startX + 130, currentY, anchoBarra, altoBarra)
                    .fill(color);
            }

            // Valor
            doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
                .text(String(item.valor), startX + 130 + ancho + 10, currentY + 6);

            currentY += altoBarra + espacio;
        });

        doc.y = currentY + PDFStyles.DIMENSIONES.ESPACIO_ENTRE_ELEMENTOS;
    }

    /**
     * Dibujar comparativa de métricas (MEJORADO)
     */
    static dibujarComparativa(doc, datos) {
        const startX = 80;
        const startY = doc.y;
        const anchoBarra = 180;
        const alto = 18;

        // Label principal
        doc.fontSize(10).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text(datos.label, 50, startY, { underline: false });

        // Valor anterior
        doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS)
            .text('Anterior:', startX, startY + 22);
        doc.rect(startX + 65, startY + 20, anchoBarra, alto)
            .fill(PDFStyles.COLORES.GRIS_CLARO);
        doc.fillColor(PDFStyles.COLORES.GRIS_TEXTO)
            .text(`${datos.valorAnterior}${datos.unidad || ''}`, startX + 65 + anchoBarra + 10, startY + 22);

        // Valor actual
        doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS)
            .text('Actual:', startX, startY + 45);

        const cambio = datos.valorActual - (datos.valorAnterior || 0);
        const mejora = datos.mejoraEsMejor ? cambio > 0 : cambio < 0;
        const colorBarra = cambio === 0 ? PDFStyles.COLORES.AMARILLO :
                          mejora ? PDFStyles.COLORES.VERDE : PDFStyles.COLORES.ROJO;

        doc.rect(startX + 65, startY + 43, anchoBarra, alto)
            .fill(colorBarra);
        doc.fillColor(PDFStyles.COLORES.BLANCO)
            .text(`${datos.valorActual}${datos.unidad || ''}`, startX + 65 + anchoBarra + 10, startY + 45);

        // Indicador de cambio
        if (cambio !== 0) {
            const simbolo = cambio > 0 ? '▲' : '▼';
            const textoCambio = `${simbolo} ${Math.abs(cambio).toFixed(1)}${datos.unidad || ''}`;
            doc.fillColor(colorBarra)
                .text(textoCambio, startX + 65 + anchoBarra + 80, startY + 45);
        }

        doc.y = startY + 75;
    }
}

module.exports = PDFBase;