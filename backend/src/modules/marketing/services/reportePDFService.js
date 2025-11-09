// ============================================
// SERVICIO PRINCIPAL DE GENERACIÓN DE PDFs
// Orquestador que delega a generadores específicos
// ============================================

const ProductividadPersonalPDF = require('./reportes/pdf/generadores/ProductividadPersonalPDF');
const PorCategoriaPDF = require('./reportes/pdf/generadores/PorCategoriaPDF');

/**
 * Servicio principal que mantiene compatibilidad con código existente
 * pero delega la generación a los generadores específicos
 */
class ReportePDFService {
    /**
     * Generar reporte de productividad personal en PDF
     */
    static async generarProductividadPersonal(datos) {
        return await ProductividadPersonalPDF.generar(datos);
    }

    /**
     * Generar reporte por categoría en PDF
     */
    static async generarPorCategoria(datos) {
        return await PorCategoriaPDF.generar(datos);
    }

    // ============================================
    // FUTUROS REPORTES (agregar aquí)
    // ============================================

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
