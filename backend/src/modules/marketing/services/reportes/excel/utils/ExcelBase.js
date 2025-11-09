// ============================================
// CLASE BASE PARA GENERACIÓN DE EXCEL
// Métodos comunes reutilizables
// ============================================

const ExcelJS = require('exceljs');
const ExcelStyles = require('./ExcelStyles');

class ExcelBase {
    /**
     * Crear workbook con configuración estándar
     */
    static crearWorkbook() {
        const workbook = new ExcelJS.Workbook();

        // Metadatos
        workbook.creator = 'Sistema CRM/ERP';
        workbook.lastModifiedBy = 'Sistema CRM/ERP';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.properties.date1904 = false;

        return workbook;
    }

    /**
     * Crear hoja con configuración estándar
     */
    static crearHoja(workbook, nombre, colorTab, anchoColumnas = []) {
        const sheet = workbook.addWorksheet(nombre, {
            properties: { tabColor: { argb: colorTab } },
            views: [{ showGridLines: false }]
        });

        // Configurar anchos de columnas si se proporcionan
        if (anchoColumnas.length > 0) {
            sheet.columns = anchoColumnas.map((ancho, index) => ({
                key: `col${index + 1}`,
                width: ancho
            }));
        }

        return sheet;
    }

    /**
     * Convertir workbook a buffer
     */
    static async workbookABuffer(workbook) {
        return await workbook.xlsx.writeBuffer();
    }

    // ============================================
    // COMPONENTES COMUNES
    // ============================================

    /**
     * Agregar encabezado principal
     */
    static agregarEncabezadoPrincipal(sheet, titulo, rangoColumnas = 'A1:D1') {
        sheet.mergeCells(rangoColumnas);
        const cell = sheet.getCell(rangoColumnas.split(':')[0]);

        cell.value = titulo;
        Object.assign(cell, ExcelStyles.ENCABEZADO_PRINCIPAL);
        sheet.getRow(1).height = 35;
    }

    /**
     * Agregar información del usuario
     */
    static agregarInfoUsuario(sheet, datos, rowInicio = 3) {
        // Usuario y Período
        sheet.getCell(`A${rowInicio}`).value = 'Usuario:';
        sheet.getCell(`B${rowInicio}`).value = datos.usuario.nombre_completo;
        sheet.getCell(`C${rowInicio}`).value = 'Periodo:';
        sheet.getCell(`D${rowInicio}`).value = datos.periodo.descripcion;

        // Email y Fecha generación
        sheet.getCell(`A${rowInicio + 1}`).value = 'Email:';
        sheet.getCell(`B${rowInicio + 1}`).value = datos.usuario.email;
        sheet.getCell(`C${rowInicio + 1}`).value = 'Generado:';
        sheet.getCell(`D${rowInicio + 1}`).value = new Date().toLocaleString('es-ES');

        // Estilo a labels
        ['A3', 'C3', 'A4', 'C4'].forEach(cell => {
            Object.assign(sheet.getCell(cell), ExcelStyles.TEXTO_INFO);
        });
    }

    /**
     * Agregar encabezado de sección
     */
    static agregarEncabezadoSeccion(sheet, titulo, rowInicio, rangoColumnas = 'A:D', emoji = '') {
        const rango = `${rangoColumnas.split(':')[0]}${rowInicio}:${rangoColumnas.split(':')[1]}${rowInicio}`;
        sheet.mergeCells(rango);

        const cell = sheet.getCell(`${rangoColumnas.split(':')[0]}${rowInicio}`);
        cell.value = emoji ? `${emoji} ${titulo}` : titulo;
        Object.assign(cell, ExcelStyles.ENCABEZADO_SECCION);
        sheet.getRow(rowInicio).height = 30;
    }

    /**
     * Agregar tabla con formato
     */
    static agregarTabla(sheet, datos, rowInicio) {
        datos.forEach((row, idx) => {
            const excelRow = sheet.getRow(rowInicio + idx);
            excelRow.values = row;

            if (idx === 0) {
                // Encabezado - aplicar estilo solo a celdas con datos
                excelRow.height = 25;
                row.forEach((_, colIdx) => {
                    const cell = excelRow.getCell(colIdx + 1);
                    Object.assign(cell, ExcelStyles.ENCABEZADO_TABLA);
                });
            } else {
                // Filas de datos - aplicar estilo solo a celdas con datos
                const fillAlterna = ExcelStyles.getFillFilaAlterna(idx);
                row.forEach((_, colIdx) => {
                    const cell = excelRow.getCell(colIdx + 1);
                    cell.fill = fillAlterna;
                    cell.alignment = ExcelStyles.CELDA_DATOS.alignment;
                    cell.border = ExcelStyles.BORDE_COMPLETO;
                });
            }
        });

        return rowInicio + datos.length;
    }

    /**
     * Agregar tabla de KPIs
     */
    static agregarTablaKPIs(sheet, kpis, rowInicio) {
        const datos = [
            ['Métrica', 'Valor', 'Objetivo', 'Estado'],
            ...kpis
        ];

        return this.agregarTabla(sheet, datos, rowInicio);
    }

    /**
     * Agregar interpretación con fondo de color
     */
    static agregarInterpretacion(sheet, titulo, texto, color, rowInicio, rangoColumnas = 'A:D') {
        // Título
        const rangoTitulo = `${rangoColumnas.split(':')[0]}${rowInicio}:${rangoColumnas.split(':')[1]}${rowInicio}`;
        sheet.mergeCells(rangoTitulo);
        const cellTitulo = sheet.getCell(`${rangoColumnas.split(':')[0]}${rowInicio}`);
        cellTitulo.value = titulo;
        cellTitulo.font = { size: 12, bold: true, color: { argb: ExcelStyles.COLORES.AZUL_OSCURO } };
        cellTitulo.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ExcelStyles.COLORES.AZUL_CLARO }
        };
        cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };

        // Texto
        const rangoTexto = `${rangoColumnas.split(':')[0]}${rowInicio + 2}:${rangoColumnas.split(':')[1]}${rowInicio + 3}`;
        sheet.mergeCells(rangoTexto);
        const cellTexto = sheet.getCell(`${rangoColumnas.split(':')[0]}${rowInicio + 2}`);
        cellTexto.value = texto;
        cellTexto.font = { size: 10, italic: true };

        // Calcular transparencia correctamente: reemplazar FF (opaco) por CC (80% opacidad)
        const colorConTransparencia = color.replace(/^FF/, 'CC');
        cellTexto.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorConTransparencia }
        };
        cellTexto.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        sheet.getRow(rowInicio + 2).height = 40;

        return rowInicio + 4;
    }

    /**
     * Agregar top 3 con medallas
     */
    static agregarTop3(sheet, titulo, items, rowInicio, rangoColumnas = 'A:E') {
        // Encabezado
        const rangoHeader = `${rangoColumnas.split(':')[0]}${rowInicio}:${rangoColumnas.split(':')[1]}${rowInicio}`;
        sheet.mergeCells(rangoHeader);
        const headerCell = sheet.getCell(`${rangoColumnas.split(':')[0]}${rowInicio}`);
        headerCell.value = titulo;
        headerCell.font = { size: 12, bold: true, color: { argb: ExcelStyles.COLORES.BLANCO } };
        headerCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ExcelStyles.COLORES.NARANJA }
        };
        headerCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Medallas
        const medallas = ['🥇', '🥈', '🥉'];
        const colores = [ExcelStyles.COLORES.ORO, ExcelStyles.COLORES.PLATA, ExcelStyles.COLORES.BRONCE];

        items.slice(0, 3).forEach((item, idx) => {
            const row = rowInicio + idx + 1;
            const rango = `${rangoColumnas.split(':')[0]}${row}:${rangoColumnas.split(':')[1]}${row}`;
            sheet.mergeCells(rango);

            const cell = sheet.getCell(`${rangoColumnas.split(':')[0]}${row}`);
            cell.value = `${medallas[idx]} ${item}`;
            cell.font = { size: 11, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: colores[idx] }
            };
        });

        return rowInicio + items.length + 1;
    }

    // ============================================
    // UTILIDADES DE FORMATO
    // ============================================

    /**
     * Convertir minutos a formato legible
     */
    static minutosAHoras(minutos) {
        if (!minutos || minutos === 0) return '0m';
        const horas = Math.floor(minutos / 60);
        const mins = Math.round(minutos % 60);
        return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
    }

    /**
     * Formatear porcentaje
     */
    static formatearPorcentaje(valor) {
        return `${parseFloat(valor).toFixed(1)}%`;
    }
}

module.exports = ExcelBase;
