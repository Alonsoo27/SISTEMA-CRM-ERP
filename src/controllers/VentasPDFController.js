// ============================================
// VENTAS PDF CONTROLLER - GENERACIÓN DE PDFs
// Sistema CRM/ERP v2.0 - Controlador de PDFs de Ventas
// ============================================

const PDFGenerator = require('../utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

class VentasPDFController {

    // ============================================
    // EXPORTAR DETALLE DE VENTA A PDF
    // ============================================
    static async exportarVentaDetalle(req, res) {
        try {
            console.log('📄 Generando PDF de venta - Request recibido');
            
            const { venta, productos } = req.body;
            
            // Validar datos recibidos
            if (!venta) {
                return res.status(400).json({
                    success: false,
                    error: 'Datos de venta requeridos'
                });
            }

            // Preparar datos para el PDF adaptados al formato del PDFGenerator
            const ventaData = {
                ...venta,
                detalles: productos || []
            };

            console.log('📄 Datos de venta preparados:', {
                id: ventaData.id,
                codigo: ventaData.codigo,
                cliente: ventaData.cliente_nombre,
                productos: productos?.length || 0
            });

            // Generar PDF usando tu PDFGenerator existente
            const pdfPath = await this.generarPDFVenta(ventaData);
            
            if (!pdfPath || !fs.existsSync(pdfPath)) {
                throw new Error('Error al generar el archivo PDF');
            }

            // Configurar headers para descarga
            const filename = `venta-${venta.codigo || venta.id}-${Date.now()}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', fs.statSync(pdfPath).size);

            // Enviar archivo
            const fileStream = fs.createReadStream(pdfPath);
            fileStream.pipe(res);

            // Limpiar archivo temporal después de enviarlo
            fileStream.on('end', () => {
                setTimeout(() => {
                    if (fs.existsSync(pdfPath)) {
                        fs.unlinkSync(pdfPath);
                        console.log('🗑️ Archivo temporal eliminado:', filename);
                    }
                }, 1000);
            });

            console.log('✅ PDF enviado exitosamente:', filename);

        } catch (error) {
            console.error('❌ Error al exportar PDF de venta:', error);
            
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al generar PDF'
                });
            }
        }
    }

    // ============================================
    // GENERAR PDF DE VENTA (Adaptador para PDFGenerator)
    // ============================================
    static async generarPDFVenta(ventaData) {
        try {
            // Adaptar datos al formato que espera tu PDFGenerator
            const cotizacionFormat = {
                id: ventaData.id,
                venta_codigo: ventaData.codigo || `VTA-${ventaData.id}`,
                numero_version: 1,
                fecha_creacion: ventaData.fecha_creacion || new Date(),
                fecha_validez: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
                
                // Información del cliente
                cliente_nombre: ventaData.cliente_nombre || 'Cliente',
                cliente_empresa: ventaData.cliente_empresa,
                cliente_email: ventaData.cliente_email,
                cliente_telefono: ventaData.cliente_telefono,
                
                // Información de la venta
                descripcion: 'Comprobante de venta',
                tiempo_entrega: '2-3 días hábiles',
                condiciones_pago: 'Contado',
                
                // Detalles de productos
                detalles: (ventaData.detalles || []).map(producto => ({
                    descripcion_personalizada: producto.descripcion_personalizada || producto.producto_nombre,
                    producto_nombre: producto.producto_nombre,
                    cantidad: producto.cantidad || 1,
                    precio_unitario: producto.precio_unitario || 0,
                    descuento_monto: producto.descuento_monto || 0,
                    total_linea: producto.total_linea || producto.subtotal || 0
                })),
                
                // Totales financieros
                subtotal: ventaData.subtotal || ventaData.valor_total || 0,
                valor_descuento: ventaData.descuento_monto || 0,
                base_impuesto: ventaData.base_impuesto || 0,
                valor_impuesto: ventaData.igv || 0,
                porcentaje_impuesto: 18,
                total: ventaData.valor_final || ventaData.total || 0,
                
                // Observaciones
                observaciones: ventaData.notas_internas
            };

            console.log('📄 Generando PDF con PDFGenerator...');
            
            // Usar tu PDFGenerator existente
            const pdfPath = await PDFGenerator.generarCotizacionPDF(cotizacionFormat);
            
            console.log('✅ PDF generado exitosamente:', pdfPath);
            return pdfPath;

        } catch (error) {
            console.error('❌ Error en generarPDFVenta:', error);
            throw error;
        }
    }

    // ============================================
    // EXPORTAR REPORTE DE VENTAS
    // ============================================
    static async exportarReporteVentas(req, res) {
        try {
            console.log('📊 Generando reporte de ventas...');
            
            const filtros = req.body;
            
            // Aquí podrías obtener datos de ventas según los filtros
            const datosReporte = {
                resumen: {
                    'Total de ventas': '150',
                    'Monto total': 'S/ 45,000.00',
                    'Período': filtros.periodo || 'Mes actual'
                }
            };

            const pdfPath = await PDFGenerator.generarReporteVentas(datosReporte, filtros);
            
            if (!fs.existsSync(pdfPath)) {
                throw new Error('Error al generar reporte PDF');
            }

            const filename = `reporte-ventas-${Date.now()}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            const fileStream = fs.createReadStream(pdfPath);
            fileStream.pipe(res);

            fileStream.on('end', () => {
                setTimeout(() => {
                    if (fs.existsSync(pdfPath)) {
                        fs.unlinkSync(pdfPath);
                    }
                }, 1000);
            });

            console.log('✅ Reporte enviado exitosamente');

        } catch (error) {
            console.error('❌ Error al exportar reporte:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ============================================
    // VERIFICAR ESTADO DEL SERVICIO PDF
    // ============================================
    static async verificarServicio(req, res) {
        try {
            // Verificar que el directorio de PDFs existe
            const pdfDir = path.join(__dirname, '../../public/pdfs');
            
            const status = {
                pdfServiceAvailable: true,
                pdfDirectory: fs.existsSync(pdfDir),
                timestamp: new Date().toISOString(),
                version: '2.0'
            };

            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ============================================
    // UTILIDADES
    // ============================================
    static ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log('📁 Directorio creado:', dirPath);
        }
    }

    static formatearMoneda(valor) {
        if (!valor || isNaN(valor)) return 'S/ 0.00';
        return `S/ ${parseFloat(valor).toFixed(2)}`;
    }

    static formatearFecha(fecha) {
        return new Date(fecha).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}

module.exports = VentasPDFController;