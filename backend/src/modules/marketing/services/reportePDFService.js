// ============================================
// SERVICIO PRINCIPAL DE GENERACIÓN DE PDFs
// Orquestador que delega a generadores específicos
// ============================================

const ProductividadPersonalPDF = require('./reportes/pdf/generadores/ProductividadPersonalPDF');

/**
 * Servicio principal que mantiene compatibilidad con código existente
 * pero delega la generación a los generadores específicos
 */
class ReportePDFService {
    /**
     * Generar reporte de productividad personal en PDF
     * @deprecated Use ProductividadPersonalPDF.generar() directamente
     */
    static async generarProductividadPersonal(datos) {
        return await ProductividadPersonalPDF.generar(datos);
    }

    // ============================================
    // FUTUROS REPORTES (agregar aquí)
    // ============================================

    /**
     * Generar reporte por categoría (futuro)
     */
    // static async generarPorCategoria(datos) {
    //     const CategoriaPDF = require('./reportes/pdf/generadores/CategoriaPDF');
    //     return await CategoriaPDF.generar(datos);
    // }

    /**
     * Generar reporte de equipo (futuro)
     */
    // static async generarEquipo(datos) {
    //     const EquipoPDF = require('./reportes/pdf/generadores/EquipoPDF');
    //     return await EquipoPDF.generar(datos);
    // }

    /**
     * Generar reporte mensual (futuro)
     */
    // static async generarMensual(datos) {
    //     const MensualPDF = require('./reportes/pdf/generadores/MensualPDF');
    //     return await MensualPDF.generar(datos);
    // }
}

module.exports = ReportePDFService;
