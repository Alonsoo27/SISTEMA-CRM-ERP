// ============================================
// SERVICIO PRINCIPAL DE GENERACIÓN DE EXCEL
// Orquestador que delega a generadores específicos
// ============================================

const ProductividadPersonalExcel = require('./reportes/excel/generadores/ProductividadPersonalExcel');

/**
 * Servicio principal que mantiene compatibilidad con código existente
 * pero delega la generación a los generadores específicos
 */
class ReporteExcelService {
    /**
     * Generar reporte de productividad personal en Excel
     * @deprecated Use ProductividadPersonalExcel.generar() directamente
     */
    static async generarProductividadPersonal(datos) {
        return await ProductividadPersonalExcel.generar(datos);
    }

    // ============================================
    // FUTUROS REPORTES (agregar aquí)
    // ============================================

    /**
     * Generar reporte por categoría (futuro)
     */
    // static async generarPorCategoria(datos) {
    //     const CategoriaExcel = require('./reportes/excel/generadores/CategoriaExcel');
    //     return await CategoriaExcel.generar(datos);
    // }

    /**
     * Generar reporte de equipo (futuro)
     */
    // static async generarEquipo(datos) {
    //     const EquipoExcel = require('./reportes/excel/generadores/EquipoExcel');
    //     return await EquipoExcel.generar(datos);
    // }

    /**
     * Generar reporte mensual (futuro)
     */
    // static async generarMensual(datos) {
    //     const MensualExcel = require('./reportes/excel/generadores/MensualExcel');
    //     return await MensualExcel.generar(datos);
    // }
}

module.exports = ReporteExcelService;
