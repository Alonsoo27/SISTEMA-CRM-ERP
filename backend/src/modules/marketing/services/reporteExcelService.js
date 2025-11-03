// ============================================
// SERVICIO DE GENERACIÓN DE REPORTES EXCEL
// Calidad Corporativa Superior con ExcelJS
// ============================================

const ExcelJS = require('exceljs');

class ReporteExcelService {
    /**
     * Generar reporte de productividad personal en Excel
     * Múltiples hojas con formato profesional
     */
    static async generarProductividadPersonal(datos) {
        const workbook = new ExcelJS.Workbook();

        // Metadatos del documento
        workbook.creator = 'Sistema CRM/ERP';
        workbook.lastModifiedBy = 'Sistema CRM/ERP';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.properties.date1904 = false;

        // ========================================
        // HOJA 1: RESUMEN EJECUTIVO
        // ========================================

        const sheetResumen = workbook.addWorksheet('Resumen Ejecutivo', {
            properties: { tabColor: { argb: 'FF3B82F6' } },
            views: [{ showGridLines: false }]
        });

        // Configurar columnas
        sheetResumen.columns = [
            { key: 'col1', width: 30 },
            { key: 'col2', width: 20 },
            { key: 'col3', width: 20 },
            { key: 'col4', width: 30 }
        ];

        // ENCABEZADO CORPORATIVO
        sheetResumen.mergeCells('A1:D1');
        const headerCell = sheetResumen.getCell('A1');
        headerCell.value = 'REPORTE DE PRODUCTIVIDAD PERSONAL';
        headerCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        headerCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };
        headerCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sheetResumen.getRow(1).height = 35;

        // INFORMACIÓN DEL USUARIO
        sheetResumen.getCell('A3').value = 'Usuario:';
        sheetResumen.getCell('B3').value = datos.usuario.nombre_completo;
        sheetResumen.getCell('C3').value = 'Periodo:';
        sheetResumen.getCell('D3').value = datos.periodo.descripcion;

        sheetResumen.getCell('A4').value = 'Email:';
        sheetResumen.getCell('B4').value = datos.usuario.email;
        sheetResumen.getCell('C4').value = 'Generado:';
        sheetResumen.getCell('D4').value = new Date().toLocaleString('es-ES');

        // Estilo de información
        ['A3', 'C3', 'A4', 'C4'].forEach(cell => {
            sheetResumen.getCell(cell).font = { bold: true, color: { argb: 'FF1E3A8A' } };
        });

        // KPIs PRINCIPALES (con formato de tarjetas)
        let currentRow = 7;
        sheetResumen.mergeCells(`A${currentRow}:D${currentRow}`);
        const kpiHeader = sheetResumen.getCell(`A${currentRow}`);
        kpiHeader.value = 'INDICADORES CLAVE DE RENDIMIENTO (KPIs)';
        kpiHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        kpiHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
        };
        kpiHeader.alignment = { vertical: 'middle', horizontal: 'center' };
        sheetResumen.getRow(currentRow).height = 30;

        currentRow += 2;

        // Tabla de KPIs
        const kpis = [
            ['Metrica', 'Valor', 'Objetivo', 'Estado'],
            ['Total Actividades', datos.metricas.totales.total, '-', '[#]'],
            ['Tasa de Completitud', `${datos.metricas.tasas.completitud}%`, '>= 80%', datos.metricas.tasas.completitud >= 80 ? '[OK]' : '[!]'],
            ['Eficiencia Temporal', `${datos.metricas.tasas.eficiencia}%`, '<= 100%', datos.metricas.tasas.eficiencia <= 100 ? '[OK]' : '[~]'],
            ['Tasa de Vencimiento', `${datos.metricas.tasas.vencimiento}%`, '< 5%', datos.metricas.tasas.vencimiento < 5 ? '[OK]' : '[!]'],
            ['Actividades Prioritarias', `${datos.metricas.totales.prioritarias_completadas}/${datos.metricas.totales.prioritarias}`, '-', datos.metricas.tasas.prioritarias >= 90 ? '[**]' : '[*]'],
            ['Tiempo Total Invertido', this._minutosAHoras(datos.metricas.tiempos.total_real_minutos), '-', '[T]']
        ];

        kpis.forEach((row, idx) => {
            const excelRow = sheetResumen.getRow(currentRow + idx);
            excelRow.values = row;

            if (idx === 0) {
                // Encabezado de tabla
                excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                excelRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3A8A' }
                };
            } else {
                // Filas alternas
                excelRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' }
                };
            }

            excelRow.alignment = { vertical: 'middle', horizontal: 'center' };
            excelRow.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
        });

        currentRow += kpis.length + 2;

        // DESGLOSE DE ACTIVIDADES
        sheetResumen.mergeCells(`A${currentRow}:D${currentRow}`);
        const desgloseHeader = sheetResumen.getCell(`A${currentRow}`);
        desgloseHeader.value = '📋 DESGLOSE POR ESTADO';
        desgloseHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        desgloseHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' }
        };
        desgloseHeader.alignment = { vertical: 'middle', horizontal: 'center' };

        currentRow += 2;

        const desglose = [
            ['Estado', 'Cantidad', 'Porcentaje', 'Simbolo'],
            ['Completadas', datos.metricas.totales.completadas, `${((datos.metricas.totales.completadas / datos.metricas.totales.total) * 100).toFixed(1)}%`, '✅'],
            ['En Progreso', datos.metricas.totales.en_progreso, `${((datos.metricas.totales.en_progreso / datos.metricas.totales.total) * 100).toFixed(1)}%`, '🔄'],
            ['Pendientes', datos.metricas.totales.pendientes, `${((datos.metricas.totales.pendientes / datos.metricas.totales.total) * 100).toFixed(1)}%`, '⏳'],
            ['Canceladas', datos.metricas.totales.canceladas, `${((datos.metricas.totales.canceladas / datos.metricas.totales.total) * 100).toFixed(1)}%`, '❌']
        ];

        this._agregarTabla(sheetResumen, desglose, currentRow);

        // ========================================
        // HOJA 2: ANÁLISIS DE TIEMPO
        // ========================================

        const sheetTiempo = workbook.addWorksheet('Análisis de Tiempo', {
            properties: { tabColor: { argb: 'FFF59E0B' } },
            views: [{ showGridLines: false }]
        });

        sheetTiempo.columns = [
            { key: 'col1', width: 35 },
            { key: 'col2', width: 20 },
            { key: 'col3', width: 25 },
            { key: 'col4', width: 20 }
        ];

        // Encabezado
        sheetTiempo.mergeCells('A1:D1');
        const timeHeader = sheetTiempo.getCell('A1');
        timeHeader.value = 'ANALISIS DETALLADO DE TIEMPO';
        timeHeader.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        timeHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF59E0B' }
        };
        timeHeader.alignment = { vertical: 'middle', horizontal: 'center' };
        sheetTiempo.getRow(1).height = 30;

        // Métricas de tiempo
        const metricasTiempo = [
            ['Métrica', 'Valor', 'Equivalente', 'Evaluación'],
            ['Tiempo Planeado Total', this._minutosAHoras(datos.metricas.tiempos.total_planeado_minutos), `${datos.metricas.tiempos.total_planeado_minutos} min`, '📅'],
            ['Tiempo Real Total', this._minutosAHoras(datos.metricas.tiempos.total_real_minutos), `${datos.metricas.tiempos.total_real_minutos} min`, datos.metricas.tasas.eficiencia <= 100 ? '✅' : '⚠️'],
            ['Tiempo Adicional', this._minutosAHoras(datos.metricas.tiempos.total_adicional_minutos), `${datos.metricas.tiempos.total_adicional_minutos} min`, datos.metricas.tiempos.total_adicional_minutos === 0 ? '✅' : '🔄'],
            ['Promedio por Actividad', this._minutosAHoras(parseFloat(datos.metricas.tiempos.promedio_real_minutos)), `${datos.metricas.tiempos.promedio_real_minutos} min`, '⏱️'],
            ['Extensiones Solicitadas', datos.metricas.tiempos.con_extension, '-', datos.metricas.tiempos.con_extension > 5 ? '⚠️' : '✅']
        ];

        this._agregarTabla(sheetTiempo, metricasTiempo, 3);

        // Interpretación de eficiencia
        let interpretRow = 3 + metricasTiempo.length + 2;
        sheetTiempo.mergeCells(`A${interpretRow}:D${interpretRow}`);
        const interpretHeader = sheetTiempo.getCell(`A${interpretRow}`);
        interpretHeader.value = '💡 INTERPRETACIÓN DE EFICIENCIA';
        interpretHeader.font = { size: 12, bold: true, color: { argb: 'FF1E3A8A' } };
        interpretHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDBeafe' }
        };
        interpretHeader.alignment = { vertical: 'middle', horizontal: 'center' };

        interpretRow += 2;

        let interpretacion = '';
        let colorInterpret = '';

        if (datos.metricas.tasas.eficiencia <= 90) {
            interpretacion = '✅ EXCELENTE: Las actividades se completan antes del tiempo estimado. Se está siendo más eficiente que la planificación original.';
            colorInterpret = 'FF10B981';
        } else if (datos.metricas.tasas.eficiencia <= 110) {
            interpretacion = '✓ BUENO: El tiempo real está muy cerca del tiempo planeado. La planificación es precisa.';
            colorInterpret = 'FF3B82F6';
        } else if (datos.metricas.tasas.eficiencia <= 130) {
            interpretacion = '⚠️ ATENCIÓN: Las actividades están tomando más tiempo del planeado. Revisar la planificación o los obstáculos que retrasan las tareas.';
            colorInterpret = 'FFF59E0B';
        } else {
            interpretacion = '❌ CRÍTICO: Existe una desviación significativa entre el tiempo planeado y el real. Es necesario revisar el proceso de planificación.';
            colorInterpret = 'FFEF4444';
        }

        sheetTiempo.mergeCells(`A${interpretRow}:D${interpretRow + 1}`);
        const interpretCell = sheetTiempo.getCell(`A${interpretRow}`);
        interpretCell.value = interpretacion;
        interpretCell.font = { size: 10, italic: true };
        interpretCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorInterpret + '20' } // Transparencia
        };
        interpretCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        sheetTiempo.getRow(interpretRow).height = 40;

        // ========================================
        // HOJA 3: DISTRIBUCIÓN POR CATEGORÍAS
        // ========================================

        if (datos.categorias && datos.categorias.length > 0) {
            const sheetCategorias = workbook.addWorksheet('Por Categorías', {
                properties: { tabColor: { argb: 'FF8B5CF6' } },
                views: [{ showGridLines: false }]
            });

            sheetCategorias.columns = [
                { key: 'col1', width: 35 },
                { key: 'col2', width: 15 },
                { key: 'col3', width: 15 },
                { key: 'col4', width: 20 },
                { key: 'col5', width: 15 }
            ];

            // Encabezado
            sheetCategorias.mergeCells('A1:E1');
            const catHeader = sheetCategorias.getCell('A1');
            catHeader.value = '🎯 DISTRIBUCIÓN POR CATEGORÍAS';
            catHeader.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            catHeader.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF8B5CF6' }
            };
            catHeader.alignment = { vertical: 'middle', horizontal: 'center' };
            sheetCategorias.getRow(1).height = 30;

            // Calcular totales para porcentajes
            const tiempoTotal = datos.categorias.reduce((sum, cat) => sum + parseInt(cat.tiempo_total_minutos), 0);

            // Tabla de categorías
            const tablaCategorias = [
                ['Categoría / Subcategoría', 'Cantidad', 'Completadas', 'Tiempo Total', '% Tiempo']
            ];

            datos.categorias.forEach(cat => {
                const porcentajeTiempo = tiempoTotal > 0
                    ? ((parseInt(cat.tiempo_total_minutos) / tiempoTotal) * 100).toFixed(1)
                    : 0;

                tablaCategorias.push([
                    `${cat.categoria_principal}${cat.subcategoria ? ' - ' + cat.subcategoria : ''}`,
                    cat.cantidad,
                    cat.completadas,
                    this._minutosAHoras(cat.tiempo_total_minutos),
                    `${porcentajeTiempo}%`
                ]);
            });

            this._agregarTabla(sheetCategorias, tablaCategorias, 3);

            // Top 3 con medallas
            const topRow = 3 + tablaCategorias.length + 2;
            sheetCategorias.mergeCells(`A${topRow}:E${topRow}`);
            const topHeader = sheetCategorias.getCell(`A${topRow}`);
            topHeader.value = '🏆 TOP 3 CATEGORÍAS (por tiempo invertido)';
            topHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            topHeader.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF59E0B' }
            };
            topHeader.alignment = { vertical: 'middle', horizontal: 'center' };

            const medallas = ['🥇', '🥈', '🥉'];
            datos.categorias.slice(0, 3).forEach((cat, idx) => {
                const row = topRow + idx + 1;
                sheetCategorias.mergeCells(`A${row}:E${row}`);
                const cell = sheetCategorias.getCell(`A${row}`);
                cell.value = `${medallas[idx]} ${cat.categoria_principal}: ${this._minutosAHoras(cat.tiempo_total_minutos)} (${cat.cantidad} actividades)`;
                cell.font = { size: 11, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: idx === 0 ? 'FFFDE68A' : idx === 1 ? 'FFD1D5DB' : 'FFFED7AA' }
                };
            });
        }

        // ========================================
        // HOJA 4: PROBLEMAS Y ALERTAS
        // ========================================

        const sheetProblemas = workbook.addWorksheet('Problemas', {
            properties: { tabColor: { argb: 'FFEF4444' } },
            views: [{ showGridLines: false }]
        });

        sheetProblemas.columns = [
            { key: 'col1', width: 30 },
            { key: 'col2', width: 15 },
            { key: 'col3', width: 25 },
            { key: 'col4', width: 30 }
        ];

        // Encabezado
        sheetProblemas.mergeCells('A1:D1');
        const probHeader = sheetProblemas.getCell('A1');
        probHeader.value = '⚠️ PROBLEMAS Y ALERTAS DETECTADAS';
        probHeader.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        probHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' }
        };
        probHeader.alignment = { vertical: 'middle', horizontal: 'center' };
        sheetProblemas.getRow(1).height = 30;

        // Tabla de problemas
        const tablaProblemas = [
            ['Tipo de Problema', 'Cantidad', 'Nivel de Impacto', 'Recomendación'],
            [
                'Actividades Vencidas',
                datos.metricas.problemas.vencidas,
                datos.metricas.problemas.vencidas === 0 ? '✅ Ninguno' : datos.metricas.problemas.vencidas < 3 ? '⚠️ Bajo' : '❌ Alto',
                datos.metricas.problemas.vencidas === 0 ? 'Mantener buenas prácticas' : 'Revisar planificación y prioridades'
            ],
            [
                'Actividades Transferidas',
                datos.metricas.problemas.transferidas,
                datos.metricas.problemas.transferidas < 2 ? '✅ Bajo' : datos.metricas.problemas.transferidas < 5 ? '⚠️ Medio' : '❌ Alto',
                datos.metricas.problemas.transferidas > 3 ? 'Analizar causas de transferencias' : 'Nivel aceptable'
            ],
            [
                'Extensiones de Tiempo',
                datos.metricas.problemas.extensiones,
                datos.metricas.problemas.extensiones < 3 ? '✅ Bajo' : datos.metricas.problemas.extensiones < 8 ? '⚠️ Medio' : '❌ Alto',
                datos.metricas.problemas.extensiones > 5 ? 'Mejorar estimaciones de tiempo' : 'Planificación adecuada'
            ]
        ];

        this._agregarTabla(sheetProblemas, tablaProblemas, 3);

        // ========================================
        // GENERAR BUFFER
        // ========================================

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    // ============================================
    // MÉTODOS AUXILIARES
    // ============================================

    /**
     * Agrega una tabla con formato profesional
     */
    static _agregarTabla(sheet, datos, startRow) {
        datos.forEach((row, idx) => {
            const excelRow = sheet.getRow(startRow + idx);
            excelRow.values = row;

            if (idx === 0) {
                // Encabezado
                excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                excelRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3A8A' }
                };
                excelRow.height = 25;
            } else {
                // Filas alternas
                excelRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' }
                };
            }

            excelRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            excelRow.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
        });
    }

    /**
     * Convertir minutos a formato legible
     */
    static _minutosAHoras(minutos) {
        const horas = Math.floor(minutos / 60);
        const mins = Math.round(minutos % 60);
        return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
    }
}

module.exports = ReporteExcelService;
