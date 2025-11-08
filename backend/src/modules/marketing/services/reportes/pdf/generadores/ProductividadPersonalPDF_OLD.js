// ============================================
// GENERADOR PDF: PRODUCTIVIDAD PERSONAL
// Reporte completo de productividad individual
// VERSIÓN 2.0 - FLUJO DINÁMICO Y OPTIMIZADO
// ============================================

const PDFBase = require('../utils/PDFBase');
const PDFStyles = require('../utils/PDFStyles');

class ProductividadPersonalPDF {
    /**
     * Generar reporte completo de productividad personal
     * NUEVO: Flujo dinámico que optimiza espacio y páginas
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
            // PÁGINA 1: DASHBOARD EJECUTIVO (siempre)
            // ========================================
            this._generarDashboardEjecutivo(doc, datos, tieneActividades);

            // Pie de página 1
            PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);

            // Si no hay actividades, terminar aquí
            if (!tieneActividades) {
                doc.end();
                return await bufferPromise;
            }

            // ========================================
            // SECCIONES SIGUIENTES: FLUJO DINÁMICO
            // ========================================
            doc.addPage();
            PDFBase.dibujarEncabezado(doc, 'ANÁLISIS DETALLADO');
            doc.moveDown(2);

            // Categorías personales (siempre si hay datos)
            if (datos.categorias && datos.categorias.length > 0) {
                this._generarSeccionCategorias(doc, datos);
            }

            // Productividad por día (si hay datos)
            if (this._tieneProductividadDiaria(datos)) {
                const alturaEstimada = 250;
                PDFBase.verificarEspacio(doc, alturaEstimada);
                this._generarSeccionProductividadDiaria(doc, datos);
            }

            // Problemas detectados (solo si hay problemas)
            if (this._tieneProblemas(datos)) {
                const alturaEstimada = 180;
                PDFBase.verificarEspacio(doc, alturaEstimada);
                this._generarSeccionProblemas(doc, datos);
            }

            // Pie de página actual
            PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);

            // ========================================
            // SECCIÓN FINAL: INSIGHTS (condicional)
            // ========================================
            if (this._debeGenerarSeccionInsights(datos)) {
                doc.addPage();
                PDFBase.dibujarEncabezado(doc, 'INSIGHTS Y RECOMENDACIONES');
                doc.moveDown(2);

                // Comparativa período anterior (si existe)
                if (datos.analisis_avanzado?.comparativa_periodo_anterior) {
                    this._generarComparativaPeriodo(doc, datos);
                    doc.moveDown(1.5);
                }

                // Ranking equipo (si existe y >1 persona)
                if (this._debeGenerarRanking(datos)) {
                    const alturaEstimada = 150;
                    PDFBase.verificarEspacio(doc, alturaEstimada);
                    this._generarRankingEquipo(doc, datos);
                    doc.moveDown(1.5);
                }

                // Conclusiones y recomendaciones (si existen)
                if (this._tieneConclusiones(datos)) {
                    const alturaEstimada = 200;
                    PDFBase.verificarEspacio(doc, alturaEstimada);
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
     * Generar dashboard ejecutivo completo en página 1
     * Alta densidad de información, visualmente atractivo
     */
    static _generarDashboardEjecutivo(doc, datos, tieneActividades) {
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

        // Estado de actividades (donut + tabla compacta)
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ESTADO DE ACTIVIDADES', { align: 'left', underline: true });
        doc.moveDown(0.5);

        this._generarEstadoActividades(doc, datos);

        // Análisis de tiempo con gauge
        doc.moveDown(1);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ANÁLISIS DE TIEMPO', { align: 'left', underline: true });
        doc.moveDown(0.5);

        this._generarAnalisisTiempoCompacto(doc, datos);

        // Actividades prioritarias con progress bars
        doc.moveDown(1);
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('ACTIVIDADES PRIORITARIAS', { align: 'left', underline: true });
        doc.moveDown(0.5);

        this._generarActividadesPrioritarias(doc, datos);
    }

    /**
     * Generar estado de actividades con donut + tabla compacta
     */
    static _generarEstadoActividades(doc, datos) {
        const startY = doc.y;

        // Preparar datos para donut (solo estados con valores > 0)
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

        // Dibujar donut (izquierda)
        if (datosDonut.length > 0) {
            PDFBase.dibujarDonut(doc, datosDonut, {
                centerX: 120,
                centerY: startY + 80,
                radius: 70,
                innerRadius: 45,
                mostrarLeyenda: false
            });
        }

        // Tabla compacta (derecha) - solo estados con datos
        const yTabla = startY;
        doc.y = yTabla;

        const tablaDatos = this._construirTablaEstadosDinamica(datos);
        if (tablaDatos.length > 1) { // Si hay más que solo el header
            PDFBase.dibujarTabla(doc, tablaDatos, [180, 80, 100]);
        }

        // Ajustar Y para continuar después del donut o tabla
        const alturaDonut = 180;
        const alturaTabla = doc.y - yTabla;
        doc.y = startY + Math.max(alturaDonut, alturaTabla);
    }

    /**
     * Análisis de tiempo compacto con gauge y métricas
     */
    static _generarAnalisisTiempoCompacto(doc, datos) {
        const startY = doc.y;

        // Gauge de eficiencia (izquierda)
        if (datos.metricas.tiempos.total_real_minutos > 0) {
            PDFBase.dibujarGauge(doc, datos.metricas.tasas.eficiencia, {
                centerX: 140,
                centerY: startY + 90,
                radius: 75,
                label: 'Eficiencia',
                valorMax: 150,
                unidad: '%'
            });
        }

        // Métricas clave (derecha)
        const xMetricas = 280;
        const yMetricas = startY + 10;

        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
        doc.text('Tiempo Planeado:', xMetricas, yMetricas);
        doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text(PDFBase.minutosAHoras(datos.metricas.tiempos.total_planeado_minutos), xMetricas + 120, yMetricas);

        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
            .text('Tiempo Real:', xMetricas, yMetricas + 25);
        doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text(PDFBase.minutosAHoras(datos.metricas.tiempos.total_real_minutos), xMetricas + 120, yMetricas + 25);

        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
            .text('Promedio/Actividad:', xMetricas, yMetricas + 50);
        doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text(PDFBase.minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos)), xMetricas + 120, yMetricas + 50);

        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO)
            .text('Extensiones:', xMetricas, yMetricas + 75);
        doc.fontSize(12).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text(String(datos.metricas.tiempos.con_extension), xMetricas + 120, yMetricas + 75);

        // Interpretación
        if (datos.metricas.tiempos.total_real_minutos > 0) {
            const interpretacion = PDFStyles.getInterpretacionEficiencia(datos.metricas.tasas.eficiencia);
            doc.fontSize(9).fillColor(interpretacion.color)
                .text(`${interpretacion.nivel}: ${interpretacion.texto}`, xMetricas, yMetricas + 105, { width: 230 });
        }

        doc.y = startY + 190;
    }

    /**
     * Actividades prioritarias con progress bars
     */
    static _generarActividadesPrioritarias(doc, datos) {
        const startY = doc.y;

        doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS_TEXTO);
        doc.text(`Total Prioritarias: ${datos.metricas.totales.prioritarias}`, 60, startY);
        doc.text(`Completadas: ${datos.metricas.totales.prioritarias_completadas}`, 60, startY + 15);

        if (datos.metricas.totales.prioritarias > 0) {
            const tasaPrioritarias = datos.metricas.tasas.prioritarias;
            const calificacion = PDFStyles.getCalificacion(tasaPrioritarias);

            doc.text(`Tasa de Cumplimiento: ${PDFBase.formatearPorcentaje(tasaPrioritarias)} - ${calificacion.texto}`,
                60, startY + 30);

            // Progress bar
            PDFBase.dibujarProgressBar(doc, tasaPrioritarias, {
                x: 60,
                y: startY + 50,
                ancho: 400,
                alto: 16,
                mostrarPorcentaje: false
            });

            doc.y = startY + 80;
        } else {
            doc.text('Tasa de Cumplimiento: N/A (sin actividades prioritarias)', 60, startY + 30);
            doc.y = startY + 50;
        }
    }

    // ============================================
    // SECCIONES DINÁMICAS: ANÁLISIS DETALLADO
    // ============================================

    /**
     * Sección de categorías personales
     */
    static _generarSeccionCategorias(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('DISTRIBUCIÓN POR CATEGORÍAS', { align: 'left', underline: true });
        doc.moveDown(1);

        // Tabla de categorías (top 10, dinámico)
        const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);
        const tablaCategorias = this._construirTablaCategorias(datos.categorias, tiempoTotal);

        if (tablaCategorias.length > 1) {
            PDFBase.dibujarTabla(doc, tablaCategorias, [220, 80, 100, 80]);
        }

        // Top 3 categorías
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

    /**
     * Sección de productividad por día
     */
    static _generarSeccionProductividadDiaria(doc, datos) {
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

            PDFBase.dibujarBarrasHorizontal(doc, datosBarra, {
                titulo: '',
                ancho: 320,
                altoBarra: 22
            });
        } else {
            doc.fontSize(10).fillColor(PDFStyles.COLORES.GRIS)
                .text('Sin datos suficientes para análisis por día.', { indent: 20 });
            doc.moveDown(1);
        }
    }

    /**
     * Sección de problemas detectados (solo si hay)
     */
    static _generarSeccionProblemas(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('PROBLEMAS DETECTADOS', { align: 'left', underline: true });
        doc.moveDown(1);

        const tablaProblemas = this._construirTablaProblemasDinamica(datos);

        if (tablaProblemas.length > 1) {
            PDFBase.dibujarTabla(doc, tablaProblemas, [200, 150, 150]);
        }

        doc.moveDown(1);
    }

    // ============================================
    // SECCIÓN FINAL: INSIGHTS
    // ============================================

    /**
     * Comparativa con período anterior
     */
    static _generarComparativaPeriodo(doc, datos) {
        doc.fontSize(14).fillColor(PDFStyles.COLORES.AZUL_OSCURO)
            .text('COMPARATIVA CON PERÍODO ANTERIOR', { align: 'left', underline: true });
        doc.moveDown(1);

        const comp = datos.analisis_avanzado.comparativa_periodo_anterior;

        // Comparativa de actividades
        PDFBase.dibujarComparativa(doc, {
            label: 'Total de Actividades',
            valorAnterior: comp.total,
            valorActual: datos.metricas.totales.total,
            unidad: '',
            mejoraEsMejor: true
        });

        // Comparativa de completitud
        PDFBase.dibujarComparativa(doc, {
            label: 'Tasa de Completitud',
            valorAnterior: comp.tasa_completitud,
            valorActual: datos.metricas.tasas.completitud,
            unidad: '%',
            mejoraEsMejor: true
        });

        // Comparativa de tiempo
        PDFBase.dibujarComparativa(doc, {
            label: 'Tiempo Productivo (horas)',
            valorAnterior: Math.round(comp.tiempo_real_minutos / 60),
            valorActual: Math.round(datos.metricas.tiempos.total_real_minutos / 60),
            unidad: 'h',
            mejoraEsMejor: true
        });
    }

    /**
     * Ranking en el equipo
     */
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

        // Medalla si está en top 3
        if (ranking.posicion <= 3) {
            doc.moveDown(0.5);
            const medalla = ranking.posicion === 1 ? '[1°]' :
                           ranking.posicion === 2 ? '[2°]' : '[3°]';
            doc.fontSize(12).fillColor(PDFStyles.COLORES.VERDE)
                .text(`${medalla} Top ${ranking.posicion} del equipo!`, { indent: 20 });
        }

        doc.moveDown(1);
    }

    /**
     * Conclusiones y recomendaciones
     */
    static _generarConclusionesYRecomendaciones(doc, datos) {
        const analisis = datos.analisis_avanzado;

        // Conclusiones
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

        // Recomendaciones
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

        // Nota final
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

    /**
     * NUEVO: Tabla de estados dinámica (solo estados con datos)
     */
    static _construirTablaEstadosDinamica(datos) {
        const tabla = [['Estado', 'Cantidad', 'Porcentaje']];

        const estados = [
            { label: 'Completadas', valor: datos.metricas.totales.completadas },
            { label: 'En Progreso', valor: datos.metricas.totales.en_progreso },
            { label: 'Pendientes', valor: datos.metricas.totales.pendientes },
            { label: 'Canceladas', valor: datos.metricas.totales.canceladas }
        ];

        // Solo agregar filas con datos
        estados.forEach(({ label, valor }) => {
            if (valor > 0) {
                const porcentaje = (valor / datos.metricas.totales.total) * 100;
                tabla.push([label, valor, PDFBase.formatearPorcentaje(porcentaje)]);
            }
        });

        return tabla;
    }

    /**
     * NUEVO: Tabla de problemas dinámica (solo problemas existentes)
     */
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

        // Solo agregar problemas que existen
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

    /**
     * Verificar si debe generar sección de insights
     */
    static _debeGenerarSeccionInsights(datos) {
        const analisis = datos.analisis_avanzado;
        if (!analisis) return false;

        const tieneComparativa = analisis.comparativa_periodo_anterior !== null;
        const tieneRanking = this._debeGenerarRanking(datos);
        const tieneConclusiones = this._tieneConclusiones(datos);

        // Requiere al menos 1 tipo de dato
        return tieneComparativa || tieneRanking || tieneConclusiones;
    }

    /**
     * Verificar si debe generar ranking
     */
    static _debeGenerarRanking(datos) {
        return datos.analisis_avanzado?.ranking_equipo &&
               datos.analisis_avanzado.ranking_equipo.total_equipo > 1;
    }

    /**
     * Verificar si tiene productividad diaria
     */
    static _tieneProductividadDiaria(datos) {
        return datos.analisis_avanzado?.productividad_por_dia &&
               datos.analisis_avanzado.productividad_por_dia.length > 0;
    }

    /**
     * Verificar si tiene problemas
     */
    static _tieneProblemas(datos) {
        const problemas = datos.metricas.problemas;
        return problemas.vencidas > 0 || problemas.transferidas > 0 || problemas.extensiones > 0;
    }

    /**
     * Verificar si tiene conclusiones o recomendaciones
     */
    static _tieneConclusiones(datos) {
        const analisis = datos.analisis_avanzado;
        return (analisis?.conclusiones && analisis.conclusiones.length > 0) ||
               (analisis?.recomendaciones && analisis.recomendaciones.length > 0);
    }
}

module.exports = ProductividadPersonalPDF;