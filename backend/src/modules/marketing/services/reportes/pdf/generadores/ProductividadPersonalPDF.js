// ============================================
// GENERADOR PDF: PRODUCTIVIDAD PERSONAL
// Reporte completo de productividad individual
// VERSIÓN 4.0 - CON GRÁFICOS PROFESIONALES
// ============================================

const PDFBase = require('../utils/PDFBase');
const PDFStyles = require('../utils/PDFStyles');
const PDFCharts = require('../utils/PDFCharts');

class ProductividadPersonalPDF {
    /**
     * Generar reporte completo de productividad personal
     * VERSIÓN CON GRÁFICOS: Usa Chart.js para gráficos profesionales
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
            // PÁGINA 1: DASHBOARD EJECUTIVO
            // ========================================
            await this._generarDashboardEjecutivo(doc, datos, tieneActividades);

            // Pie de página 1
            PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);

            // Si no hay actividades, terminar aquí
            if (!tieneActividades) {
                doc.end();
                return await bufferPromise;
            }

            // ========================================
            // PÁGINA 2: ANÁLISIS DETALLADO
            // ========================================
            doc.addPage();
            PDFBase.dibujarEncabezado(doc, 'ANÁLISIS DETALLADO');
            doc.moveDown(2);

            // Categorías personales
            if (datos.categorias && datos.categorias.length > 0) {
                this._generarSeccionCategorias(doc, datos);
            }

            // Productividad por día
            if (this._tieneProductividadDiaria(datos)) {
                PDFBase.verificarEspacio(doc, 250);
                await this._generarSeccionProductividadDiaria(doc, datos);
            }

            // Problemas detectados
            if (this._tieneProblemas(datos)) {
                PDFBase.verificarEspacio(doc, 180);
                this._generarSeccionProblemas(doc, datos);
            }

            // Pie de página
            PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);

            // ========================================
            // PÁGINA 3: INSIGHTS (condicional)
            // ========================================
            if (this._debeGenerarSeccionInsights(datos)) {
                doc.addPage();
                PDFBase.dibujarEncabezado(doc, 'INSIGHTS Y RECOMENDACIONES');
                doc.moveDown(2);

                // Comparativa período anterior
                if (datos.analisis_avanzado?.comparativa_periodo_anterior) {
                    this._generarComparativaPeriodo(doc, datos);
                    doc.moveDown(1.5);
                }

                // Ranking equipo
                if (this._debeGenerarRanking(datos)) {
                    PDFBase.verificarEspacio(doc, 150);
                    this._generarRankingEquipo(doc, datos);
                    doc.moveDown(1.5);
                }

                // Conclusiones y recomendaciones
                if (this._tieneConclusiones(datos)) {
                    PDFBase.verificarEspacio(doc, 200);
                    this._generarConclusionesYRecomendaciones(doc, datos);
                }

                // Pie de página final
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
    // PÁGINA 1: DASHBOARD EJECUTIVO
    // ============================================

    /**
     * Dashboard ejecutivo con GRÁFICOS PROFESIONALES
     */
    static async _generarDashboardEjecutivo(doc, datos, tieneActividades) {
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

        // KPIs principales
        doc.moveDown(1);
        const kpis = this._construirKPIs(datos);
        PDFBase.dibujarGridKPIs(doc, kpis);

        // Estado de actividades - GRÁFICO DONUT
        doc.moveDown(1);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ESTADO DE ACTIVIDADES', { align: 'left', underline: true });
        doc.moveDown(0.5);

        await this._generarEstadoActividadesConGrafico(doc, datos);

        // Análisis de tiempo - GAUGE CHART
        doc.moveDown(1);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ANÁLISIS DE TIEMPO', { align: 'left', underline: true });
        doc.moveDown(0.5);

        await this._generarAnalisisTiempoConGauge(doc, datos);

        // Actividades prioritarias - BARRA SIMPLE
        doc.moveDown(1);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ACTIVIDADES PRIORITARIAS', { align: 'left', underline: true });
        doc.moveDown(0.5);

        this._generarActividadesPrioritarias(doc, datos);
    }

    /**
     * NUEVO: Generar estado de actividades con gráfico donut real
     */
    static async _generarEstadoActividadesConGrafico(doc, datos) {
        const datosDonut = [];

        if (datos.metricas.totales.completadas > 0) {
            datosDonut.push({
                label: 'Completadas',
                valor: datos.metricas.totales.completadas,
                color: PDFStyles.COLORES.VERDE
            });
        }
        if (datos.metricas.totales.en_progreso > 0) {
            datosDonut.push({
                label: 'En Progreso',
                valor: datos.metricas.totales.en_progreso,
                color: PDFStyles.COLORES.AZUL_MEDIO
            });
        }
        if (datos.metricas.totales.pendientes > 0) {
            datosDonut.push({
                label: 'Pendientes',
                valor: datos.metricas.totales.pendientes,
                color: PDFStyles.COLORES.AMARILLO
            });
        }
        if (datos.metricas.totales.canceladas > 0) {
            datosDonut.push({
                label: 'Canceladas',
                valor: datos.metricas.totales.canceladas,
                color: PDFStyles.COLORES.GRIS
            });
        }

        if (datosDonut.length > 0) {
            const donutBuffer = await PDFCharts.generarDonut(datosDonut, {
                width: 450,
                height: 250,
                showLegend: true
            });

            // FIXED: NO usar coordenadas absolutas - usar solo flujo automático
            doc.image(donutBuffer, {
                fit: [480, 250],
                align: 'center'
            });
            doc.moveDown(1);
        } else {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos para mostrar', { indent: 20 });
            doc.moveDown(1);
        }
    }

    /**
     * NUEVO: Generar análisis de tiempo con gauge real
     */
    static async _generarAnalisisTiempoConGauge(doc, datos) {
        if (datos.metricas.tiempos.total_real_minutos > 0) {
            const gaugeBuffer = await PDFCharts.generarGauge(
                datos.metricas.tasas.eficiencia,
                {
                    max: 150,
                    label: 'Eficiencia de Tiempo',
                    width: 400,
                    height: 250,
                    unidad: '%'
                }
            );

            // FIXED: NO usar coordenadas absolutas - usar solo flujo automático
            doc.image(gaugeBuffer, {
                fit: [440, 250],
                align: 'center'
            });
            doc.moveDown(0.5);

            // Interpretación textual
            const interpretacion = PDFStyles.getInterpretacionEficiencia(datos.metricas.tasas.eficiencia);
            doc.fontSize(10).fillColor(interpretacion.color)
                .text(`${interpretacion.nivel}: ${interpretacion.texto}`, { indent: 20 });

            // Métricas adicionales
            doc.moveDown(0.5);
            doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
            doc.text(`Tiempo Planeado: ${PDFBase.minutosAHoras(datos.metricas.tiempos.total_planeado_minutos)}`, { indent: 20 });
            doc.text(`Tiempo Real: ${PDFBase.minutosAHoras(datos.metricas.tiempos.total_real_minutos)}`, { indent: 20 });
            doc.text(`Extensiones: ${datos.metricas.tiempos.con_extension}`, { indent: 20 });
        } else {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos suficientes para análisis de tiempo', { indent: 20 });
            doc.moveDown(1);
        }
    }

    /**
     * NUEVA: Construir tabla de tiempos (en vez de gauge)
     */
    static _construirTablaTiempos(datos) {
        const tabla = [['Métrica', 'Valor']];

        tabla.push(['Tiempo Planeado', PDFBase.minutosAHoras(datos.metricas.tiempos.total_planeado_minutos)]);
        tabla.push(['Tiempo Real', PDFBase.minutosAHoras(datos.metricas.tiempos.total_real_minutos)]);
        tabla.push(['Promedio por Actividad', PDFBase.minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos))]);
        tabla.push(['Eficiencia', `${datos.metricas.tasas.eficiencia}%`]);
        tabla.push(['Extensiones de Tiempo', String(datos.metricas.tiempos.con_extension)]);

        // Interpretación
        const interpretacion = PDFStyles.getInterpretacionEficiencia(datos.metricas.tasas.eficiencia);
        tabla.push(['Evaluación', `${interpretacion.nivel}: ${interpretacion.texto}`]);

        return tabla;
    }

    /**
     * Actividades prioritarias con barra simple
     */
    static _generarActividadesPrioritarias(doc, datos) {
        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
        doc.text(`Total Prioritarias: ${datos.metricas.totales.prioritarias}`);
        doc.text(`Completadas: ${datos.metricas.totales.prioritarias_completadas}`);

        if (datos.metricas.totales.prioritarias > 0) {
            const tasaPrioritarias = datos.metricas.tasas.prioritarias;
            const calificacion = PDFStyles.getCalificacion(tasaPrioritarias);

            doc.text(`Tasa de Cumplimiento: ${PDFBase.formatearPorcentaje(tasaPrioritarias)} - ${calificacion.texto}`);

            doc.moveDown(0.5);

            // Progress bar
            PDFBase.dibujarProgressBar(doc, tasaPrioritarias, {
                x: 60,
                y: doc.y,
                ancho: 400,
                alto: 16,
                mostrarPorcentaje: false
            });

            doc.moveDown(2);
        } else {
            doc.text('Tasa de Cumplimiento: N/A (sin actividades prioritarias)');
            doc.moveDown(1);
        }
    }

    // ============================================
    // SECCIONES DINÁMICAS: ANÁLISIS DETALLADO
    // ============================================

    static _generarSeccionCategorias(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('DISTRIBUCIÓN POR CATEGORÍAS', { align: 'left', underline: true });
        doc.moveDown(1);

        const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);
        const tablaCategorias = this._construirTablaCategorias(datos.categorias, tiempoTotal);

        PDFBase.dibujarTabla(doc, tablaCategorias, [220, 80, 100, 80]);

        doc.moveDown(1);
        doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('TOP 3 CATEGORÍAS (por tiempo invertido):', { align: 'left', underline: true });
        doc.moveDown(0.5);

        datos.categorias.slice(0, 3).forEach((cat, idx) => {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO).text(
                `[${idx + 1}] ${cat.categoria_principal}${cat.subcategoria ? ' - ' + cat.subcategoria : ''}: ${PDFBase.minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`,
                { indent: 20 }
            );
        });

        doc.moveDown(1);
    }

    static async _generarSeccionProductividadDiaria(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('PRODUCTIVIDAD POR DÍA DE LA SEMANA', { align: 'left', underline: true });
        doc.moveDown(1);

        const productividad = datos.analisis_avanzado?.productividad_por_dia || [];

        if (productividad.length > 0) {
            const datosBarra = productividad.map(dia => ({
                label: dia.nombre_dia,
                valor: dia.completadas,
                color: PDFStyles.COLORES.AZUL_MEDIO
            }));

            // Usar gráfico profesional de Chart.js
            const barrasBuffer = await PDFCharts.generarBarrasHorizontal(datosBarra, {
                width: 550,
                height: 300,
                title: ''
            });

            // FIXED: NO usar coordenadas absolutas - usar solo flujo automático
            doc.image(barrasBuffer, {
                fit: [520, 300],
                align: 'center'
            });
            doc.moveDown(1);
        } else {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos suficientes para análisis por día.', { indent: 20 });
            doc.moveDown(1);
        }
    }

    static _generarSeccionProblemas(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('PROBLEMAS DETECTADOS', { align: 'left', underline: true });
        doc.moveDown(1);

        const tablaProblemas = this._construirTablaProblemasDinamica(datos);
        PDFBase.dibujarTabla(doc, tablaProblemas, [200, 150, 150]);

        doc.moveDown(1);
    }

    // ============================================
    // SECCIÓN FINAL: INSIGHTS
    // ============================================

    static _generarComparativaPeriodo(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('COMPARATIVA CON PERÍODO ANTERIOR', { align: 'left', underline: true });
        doc.moveDown(1);

        const comp = datos.analisis_avanzado.comparativa_periodo_anterior;

        PDFBase.dibujarComparativa(doc, {
            label: 'Total de Actividades',
            valorAnterior: comp.total,
            valorActual: datos.metricas.totales.total,
            unidad: '',
            mejoraEsMejor: true
        });

        PDFBase.dibujarComparativa(doc, {
            label: 'Tasa de Completitud',
            valorAnterior: comp.tasa_completitud,
            valorActual: datos.metricas.tasas.completitud,
            unidad: '%',
            mejoraEsMejor: true
        });

        PDFBase.dibujarComparativa(doc, {
            label: 'Tiempo Productivo (horas)',
            valorAnterior: Math.round(comp.tiempo_real_minutos / 60),
            valorActual: Math.round(datos.metricas.tiempos.total_real_minutos / 60),
            unidad: 'h',
            mejoraEsMejor: true
        });
    }

    static _generarRankingEquipo(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('RANKING EN EL EQUIPO', { align: 'left', underline: true });
        doc.moveDown(1);

        const ranking = datos.analisis_avanzado.ranking_equipo;

        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
        doc.text(`Posición: ${ranking.posicion} de ${ranking.total_equipo}`, { indent: 20 });
        doc.text(`Tasa de Completitud: ${ranking.tasa_completitud}%`, { indent: 20 });
        doc.text(`Total Actividades: ${ranking.total_actividades}`, { indent: 20 });
        doc.text(`Actividades Completadas: ${ranking.completadas}`, { indent: 20 });

        if (ranking.posicion <= 3) {
            doc.moveDown(0.5);
            const medalla = ranking.posicion === 1 ? '[1°]' :
                           ranking.posicion === 2 ? '[2°]' : '[3°]';
            doc.fontSize(12).fillColor(PDFStyles.COLORES.VERDE)
                .text(`${medalla} Top ${ranking.posicion} del equipo!`, { indent: 20 });
        }

        doc.moveDown(1);
    }

    static _generarConclusionesYRecomendaciones(doc, datos) {
        const analisis = datos.analisis_avanzado;

        if (analisis.conclusiones && analisis.conclusiones.length > 0) {
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
                .text('CONCLUSIONES PRINCIPALES', { align: 'left', underline: true });
            doc.moveDown(1);

            analisis.conclusiones.forEach((conclusion, idx) => {
                doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
                doc.text(`${idx + 1}. ${conclusion}`, 60, doc.y, {
                    indent: 0,
                    width: 480
                });
                doc.moveDown(0.5);
            });

            doc.moveDown(1);
        }

        if (analisis.recomendaciones && analisis.recomendaciones.length > 0) {
            doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
                .text('RECOMENDACIONES DE MEJORA', { align: 'left', underline: true });
            doc.moveDown(1);

            analisis.recomendaciones.forEach((recomendacion, idx) => {
                doc.fontSize(10).fillColor(PDFStyles.COLORES.AZUL_MEDIO);
                doc.text(`[${idx + 1}] ${recomendacion}`, 60, doc.y, {
                    indent: 0,
                    width: 480
                });
                doc.moveDown(0.5);
            });

            doc.moveDown(2);
        }

        doc.fontSize(9).fillColor(PDFStyles.COLORES.GRIS)
            .text(
                'Este reporte fue generado automáticamente por el Sistema CRM/ERP. ' +
                'Las conclusiones y recomendaciones se basan en el análisis de datos del período seleccionado.',
                {
                    align: 'center',
                    width: 500
                }
            );
    }

    // ============================================
    // MÉTODOS AUXILIARES: CONSTRUCCIÓN DE DATOS
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

    static _construirTablaEstadosDinamica(datos) {
        const tabla = [['Estado', 'Cantidad', 'Porcentaje']];

        const estados = [
            { label: 'Completadas', valor: datos.metricas.totales.completadas },
            { label: 'En Progreso', valor: datos.metricas.totales.en_progreso },
            { label: 'Pendientes', valor: datos.metricas.totales.pendientes },
            { label: 'Canceladas', valor: datos.metricas.totales.canceladas }
        ];

        estados.forEach(({ label, valor }) => {
            if (valor > 0) {
                const porcentaje = (valor / datos.metricas.totales.total) * 100;
                tabla.push([label, valor, PDFBase.formatearPorcentaje(porcentaje)]);
            }
        });

        return tabla;
    }

    static _construirTablaProblemasDinamica(datos) {
        const tabla = [['Tipo', 'Cantidad', 'Impacto']];

        const problemas = [
            {
                tipo: 'Actividades Vencidas',
                cantidad: datos.metricas.problemas.vencidas,
                umbrales: [0, 3]
            },
            {
                tipo: 'Transferencias',
                cantidad: datos.metricas.problemas.transferidas,
                umbrales: [0, 3]
            },
            {
                tipo: 'Extensiones',
                cantidad: datos.metricas.problemas.extensiones,
                umbrales: [0, 5]
            }
        ];

        problemas.forEach(({ tipo, cantidad, umbrales }) => {
            if (cantidad > 0) {
                const impacto = PDFStyles.getNivelImpacto(cantidad, umbrales);
                tabla.push([tipo, cantidad, impacto.texto]);
            }
        });

        return tabla;
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

    // ============================================
    // MÉTODOS AUXILIARES: VALIDACIONES
    // ============================================

    static _debeGenerarSeccionInsights(datos) {
        const analisis = datos.analisis_avanzado;
        if (!analisis) return false;

        const tieneComparativa = analisis.comparativa_periodo_anterior !== null;
        const tieneRanking = this._debeGenerarRanking(datos);
        const tieneConclusiones = this._tieneConclusiones(datos);

        return tieneComparativa || tieneRanking || tieneConclusiones;
    }

    static _debeGenerarRanking(datos) {
        return datos.analisis_avanzado?.ranking_equipo &&
               datos.analisis_avanzado.ranking_equipo.total_equipo > 1;
    }

    static _tieneProductividadDiaria(datos) {
        return datos.analisis_avanzado?.productividad_por_dia &&
               datos.analisis_avanzado.productividad_por_dia.length > 0;
    }

    static _tieneProblemas(datos) {
        const problemas = datos.metricas.problemas;
        return problemas.vencidas > 0 || problemas.transferidas > 0 || problemas.extensiones > 0;
    }

    static _tieneConclusiones(datos) {
        const analisis = datos.analisis_avanzado;
        return (analisis?.conclusiones && analisis.conclusiones.length > 0) ||
               (analisis?.recomendaciones && analisis.recomendaciones.length > 0);
    }
}

module.exports = ProductividadPersonalPDF;
