// ============================================
// PDF EXPORT SERVICE - FRONTEND COMPLETO
// Sistema CRM/ERP v2.0 - Servicio para descargar PDFs
// ============================================

import apiClient from './apiClient';

class PDFExportService {
    
    // ============================================
    // EXPORTAR DETALLE DE VENTA
    // ============================================
    static async exportarVentaDetalle(datos, productos) {
        try {
            console.log('📄 Iniciando descarga de PDF de venta...');
            console.log('Datos de venta:', {
                id: datos.id,
                codigo: datos.codigo,
                cliente: datos.cliente_nombre,
                productos: productos?.length || 0
            });
            
            // Preparar datos para enviar al backend
            const payload = {
                venta: datos,
                productos: productos || []
            };

            // Usar apiClient para la descarga
            const result = await apiClient.downloadFile(
                '/pdf/exportar-pdf', 
                payload,
                `venta-${datos.codigo || datos.id}-${Date.now()}.pdf`
            );

            console.log('✅ PDF descargado exitosamente');
            return result;

        } catch (error) {
            console.error('❌ Error al descargar PDF:', error);
            
            return {
                success: false,
                error: error.message || 'Error al generar PDF'
            };
        }
    }

    // ============================================
    // EXPORTAR REPORTE DE VENTAS
    // ============================================
    static async exportarReporteVentas(filtros = {}) {
        try {
            console.log('📊 Iniciando descarga de reporte de ventas...');
            
            const result = await apiClient.downloadFile(
                '/ventas/exportar-reporte-pdf',
                filtros,
                `reporte-ventas-${Date.now()}.pdf`
            );

            console.log('✅ Reporte descargado exitosamente');
            return result;

        } catch (error) {
            console.error('❌ Error al descargar reporte:', error);
            
            return {
                success: false,
                error: error.message || 'Error al generar reporte'
            };
        }
    }

    // ============================================
    // EXPORTAR COTIZACIÓN
    // ============================================
    static async exportarCotizacion(cotizacionId) {
        try {
            console.log('📋 Iniciando descarga de cotización...');
            
            const result = await apiClient.downloadFile(
                `/cotizaciones/${cotizacionId}/exportar-pdf`,
                null,
                `cotizacion-${cotizacionId}-${Date.now()}.pdf`
            );

            console.log('✅ Cotización descargada exitosamente');
            return result;

        } catch (error) {
            console.error('❌ Error al descargar cotización:', error);
            
            return {
                success: false,
                error: error.message || 'Error al generar cotización'
            };
        }
    }

    // ============================================
    // VERIFICAR ESTADO DEL SERVICIO PDF
    // ============================================
    static async verificarServicio() {
        try {
            const response = await apiClient.get('/ventas/pdf-service-status');
            return {
                success: true,
                available: true,
                data: response
            };
        } catch (error) {
            return {
                success: false,
                available: false,
                error: error.message
            };
        }
    }
}

export default PDFExportService;