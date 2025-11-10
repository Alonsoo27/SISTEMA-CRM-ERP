// ============================================
// GENERADOR EXCEL: REPORTE DE EQUIPO
// Consolidado del equipo de marketing
// ============================================

const ExcelBase = require('../utils/ExcelBase');
const ExcelStyles = require('../utils/ExcelStyles');

class EquipoExcel {
    /**
     * Generar reporte consolidado de equipo en Excel
     */
    static async generar(datos) {
        try {
            const workbook = ExcelBase.crearWorkbook();

            // ========================================
            // HOJA: CONSOLIDADO DE EQUIPO
            // ========================================
            this._generarHojaConsolidado(workbook, datos);

            // Generar buffer
            return await ExcelBase.workbookABuffer(workbook);

        } catch (error) {
            console.error('❌ Error generando Excel de equipo:', error);
            throw error;
        }
    }

    /**
     * Generar hoja de consolidado de equipo
     */
    static _generarHojaConsolidado(workbook, datos) {
        const sheet = ExcelBase.crearHoja(
            workbook,
            'Equipo Marketing',
            ExcelStyles.COLORES.NARANJA_MEDIO,
            [30, 35, 20, 12, 12, 12, 12, 12, 15, 12]
        );

        let currentRow = 1;

        // ========================================
        // ENCABEZADO
        // ========================================
        ExcelBase.agregarEncabezadoPrincipal(sheet, 'REPORTE CONSOLIDADO DEL EQUIPO', 'A1:J1');
        currentRow = 3;

        // Información del período
        sheet.getCell(`A${currentRow}`).value = 'Equipo:';
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        sheet.getCell(`B${currentRow}`).value = 'Marketing';

        sheet.getCell(`C${currentRow}`).value = 'Periodo:';
        sheet.getCell(`C${currentRow}`).font = { bold: true };
        sheet.getCell(`D${currentRow}`).value = datos.periodo.descripcion;

        sheet.getCell(`F${currentRow}`).value = 'Generado:';
        sheet.getCell(`F${currentRow}`).font = { bold: true };
        sheet.getCell(`G${currentRow}`).value = new Date().toLocaleDateString('es-ES');

        currentRow += 2;

        // ========================================
        // RESUMEN GENERAL
        // ========================================
        ExcelBase.agregarEncabezadoSeccion(sheet, 'RESUMEN GENERAL DEL EQUIPO', currentRow, 'A:J');
        currentRow += 2;

        const resumen = [
            ['Métrica', 'Valor'],
            ['Total de Miembros', datos.estadisticas.total_miembros],
            ['Actividades Totales', datos.totales.total],
            ['Actividades Completadas', datos.totales.completadas],
            ['Actividades Pendientes', datos.totales.pendientes],
            ['Tasa de Completitud', `${datos.tasas.completitud}%`],
            ['Tiempo Total Invertido', ExcelBase.minutosAHoras(datos.totales.tiempo_total_minutos)],
            ['Promedio Actividades/Miembro', datos.estadisticas.promedio_actividades],
            ['Promedio Completitud del Equipo', `${datos.estadisticas.promedio_completitud}%`]
        ];

        currentRow = ExcelBase.agregarTabla(sheet, resumen, currentRow);
        currentRow += 2;

        // ========================================
        // RANKING POR COMPLETITUD
        // ========================================
        ExcelBase.agregarEncabezadoSeccion(sheet, 'RANKING POR TASA DE COMPLETITUD', currentRow, 'A:J');
        currentRow += 2;

        const ranking = [['#', 'Miembro', 'Total', 'Completadas', 'Pendientes', 'Tasa', 'Tiempo Total']];
        datos.ranking.forEach((miembro, idx) => {
            ranking.push([
                idx + 1,
                miembro.nombre_completo,
                miembro.totales.total,
                miembro.totales.completadas,
                miembro.totales.pendientes,
                `${miembro.tasa_completitud}%`,
                ExcelBase.minutosAHoras(miembro.tiempo_total_minutos)
            ]);
        });

        currentRow = ExcelBase.agregarTabla(sheet, ranking, currentRow);
        currentRow += 2;

        // ========================================
        // DETALLE COMPLETO POR MIEMBRO
        // ========================================
        ExcelBase.agregarEncabezadoSeccion(sheet, 'DETALLE COMPLETO POR MIEMBRO', currentRow, 'A:J');
        currentRow += 2;

        const detalle = [['Miembro', 'Email', 'Rol', 'Total', 'Compl.', 'Pend.', 'Prog.', 'Canc.', 'Tiempo', 'Categ.']];
        datos.miembros.forEach(miembro => {
            detalle.push([
                miembro.nombre_completo,
                miembro.email,
                miembro.rol,
                miembro.totales.total,
                miembro.totales.completadas,
                miembro.totales.pendientes,
                miembro.totales.en_progreso,
                miembro.totales.canceladas,
                ExcelBase.minutosAHoras(miembro.tiempo_total_minutos),
                miembro.categorias_trabajadas
            ]);
        });

        ExcelBase.agregarTabla(sheet, detalle, currentRow);
    }
}

module.exports = EquipoExcel;
