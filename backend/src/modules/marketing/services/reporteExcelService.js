// ============================================
// SERVICIO PRINCIPAL DE GENERACIÓN DE EXCEL
// Orquestador que delega a generadores específicos
// ============================================

const ProductividadPersonalExcel = require('./reportes/excel/generadores/ProductividadPersonalExcel');
const PorCategoriaExcel = require('./reportes/excel/generadores/PorCategoriaExcel');
const EquipoExcel = require('./reportes/excel/generadores/EquipoExcel');

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

    /**
     * Generar reporte por categoría en Excel
     */
    static async generarPorCategoria(datos) {
        return await PorCategoriaExcel.generar(datos);
    }

    /**
     * Generar reporte de equipo en Excel
     */
    static async generarEquipo(datos) {
        return await EquipoExcel.generar(datos);
    }

    // ============================================
    // FUTUROS REPORTES (agregar aquí)
    // ============================================

    /**
     * Generar reporte mensual (futuro)
     */
    // static async generarMensual(datos) {
    //     const MensualExcel = require('./reportes/excel/generadores/MensualExcel');
    //     return await MensualExcel.generar(datos);
    // }
}

module.exports = ReporteExcelService;
