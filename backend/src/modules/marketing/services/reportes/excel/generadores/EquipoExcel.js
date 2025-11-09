// ============================================
// GENERADOR EXCEL: REPORTE DE EQUIPO
// Consolidado del equipo de marketing
// ============================================

const ExcelBase = require('../utils/ExcelBase');

class EquipoExcel {
    /**
     * Generar reporte consolidado de equipo en Excel
     */
    static async generar(datos) {
        const workbook = ExcelBase.crearWorkbook();
        const worksheet = workbook.addWorksheet('Equipo Marketing');

        let filaActual = 1;

        // ========================================
        // ENCABEZADO
        // ========================================
        ExcelBase.agregarTitulo(worksheet, filaActual, 'REPORTE CONSOLIDADO DEL EQUIPO');
        filaActual += 2;

        ExcelBase.agregarTexto(worksheet, filaActual, 1, 'Equipo:');
        ExcelBase.agregarTexto(worksheet, filaActual, 2, 'Marketing', { bold: true });
        filaActual++;

        ExcelBase.agregarTexto(worksheet, filaActual, 1, 'Período:');
        ExcelBase.agregarTexto(worksheet, filaActual, 2, datos.periodo.descripcion, { bold: true });
        filaActual += 2;

        // ========================================
        // RESUMEN GENERAL
        // ========================================
        ExcelBase.agregarSubtitulo(worksheet, filaActual, 'RESUMEN GENERAL DEL EQUIPO');
        filaActual += 2;

        const resumenData = [
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

        ExcelBase.agregarTabla(worksheet, filaActual, 1, resumenData, {
            headerStyle: ExcelBase.ESTILOS.ENCABEZADO_TABLA,
            dataStyle: ExcelBase.ESTILOS.CELDA_DATOS
        });

        filaActual += resumenData.length + 2;

        // ========================================
        // RANKING POR COMPLETITUD
        // ========================================
        ExcelBase.agregarSubtitulo(worksheet, filaActual, 'RANKING POR TASA DE COMPLETITUD');
        filaActual += 2;

        const rankingData = [['#', 'Miembro', 'Total', 'Completadas', 'Pendientes', 'Tasa', 'Tiempo Total']];
        datos.ranking.forEach((miembro, idx) => {
            rankingData.push([
                idx + 1,
                miembro.nombre_completo,
                miembro.totales.total,
                miembro.totales.completadas,
                miembro.totales.pendientes,
                `${miembro.tasa_completitud}%`,
                ExcelBase.minutosAHoras(miembro.tiempo_total_minutos)
            ]);
        });

        ExcelBase.agregarTabla(worksheet, filaActual, 1, rankingData, {
            headerStyle: ExcelBase.ESTILOS.ENCABEZADO_TABLA,
            dataStyle: ExcelBase.ESTILOS.CELDA_DATOS,
            alternarFilas: true
        });

        filaActual += rankingData.length + 2;

        // ========================================
        // DETALLE COMPLETO POR MIEMBRO
        // ========================================
        ExcelBase.agregarSubtitulo(worksheet, filaActual, 'DETALLE COMPLETO POR MIEMBRO');
        filaActual += 2;

        const detalleData = [['Miembro', 'Email', 'Rol', 'Total', 'Compl.', 'Pend.', 'Prog.', 'Canc.', 'Tiempo', 'Categ.']];
        datos.miembros.forEach(miembro => {
            detalleData.push([
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

        ExcelBase.agregarTabla(worksheet, filaActual, 1, detalleData, {
            headerStyle: ExcelBase.ESTILOS.ENCABEZADO_TABLA,
            dataStyle: ExcelBase.ESTILOS.CELDA_DATOS,
            alternarFilas: true
        });

        // ========================================
        // AJUSTAR ANCHOS DE COLUMNA
        // ========================================
        worksheet.getColumn(1).width = 30;  // Miembro
        worksheet.getColumn(2).width = 35;  // Email
        worksheet.getColumn(3).width = 20;  // Rol
        worksheet.getColumn(4).width = 10;  // Total
        worksheet.getColumn(5).width = 10;  // Compl
        worksheet.getColumn(6).width = 10;  // Pend
        worksheet.getColumn(7).width = 10;  // Prog
        worksheet.getColumn(8).width = 10;  // Canc
        worksheet.getColumn(9).width = 15;  // Tiempo
        worksheet.getColumn(10).width = 10; // Categ

        // ========================================
        // GENERAR BUFFER
        // ========================================
        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = EquipoExcel;
