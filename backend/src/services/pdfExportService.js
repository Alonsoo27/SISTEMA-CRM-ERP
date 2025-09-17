// ============================================
// PDF EXPORT SERVICE - GENERACIÓN DE DOCUMENTOS DE VENTAS
// Sistema CRM/ERP v2.0 - Módulo de Ventas
// ============================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFExportService {

    // ============================================
    // EXPORTAR DETALLE DE VENTA
    // ============================================
    static async exportarVentaDetalle(datos, productos) {
        try {
            console.log(`📄 Generando PDF para venta ${datos.codigo || datos.id}`);

            // Crear directorio si no existe
            const outputDir = path.join(__dirname, '../../../public/pdfs/ventas');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Nombre del archivo
            const filename = `venta-${datos.codigo || datos.id}-${Date.now()}.pdf`;
            const filepath = path.join(outputDir, filename);

            // Crear documento PDF
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 50,
                    bottom: 50,
                    left: 50,
                    right: 50
                }
            });

            // Stream para guardar archivo
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // HEADER DE LA EMPRESA
            await this.agregarHeaderEmpresa(doc);

            // INFORMACIÓN DE LA VENTA
            let currentY = await this.agregarInformacionVenta(doc, datos);

            // INFORMACIÓN DEL CLIENTE
            currentY = await this.agregarInformacionCliente(doc, datos, currentY);

            // TABLA DE PRODUCTOS
            currentY = await this.agregarTablaProductos(doc, productos, currentY);

            // RESUMEN FINANCIERO
            currentY = await this.agregarResumenFinanciero(doc, datos, currentY);

            // INFORMACIÓN ADICIONAL
            currentY = await this.agregarInformacionAdicional(doc, datos, currentY);

            // FOOTER
            await this.agregarFooter(doc);

            // Finalizar documento
            doc.end();

            // Esperar a que se complete la escritura del archivo
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            console.log(`✅ PDF generado exitosamente: ${filename}`);

            return {
                success: true,
                filepath,
                filename,
                downloadUrl: `/pdfs/ventas/${filename}`
            };

        } catch (error) {
            console.error('❌ Error al generar PDF de venta:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // HEADER DE LA EMPRESA
    // ============================================
    static async agregarHeaderEmpresa(doc) {
        try {
            // Logo de la empresa (si existe)
            const logoPath = path.join(__dirname, '../../../public/assets/logo-empresa.png');
            
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 50, { width: 80 });
            }

            // Información de la empresa
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text('EMPRESA CRM/ERP', 150, 60);

            doc.fontSize(10)
               .font('Helvetica')
               .text('Dirección: Av. Principal 123, Ciudad', 150, 85)
               .text('Teléfono: +51 999 888 777', 150, 100)
               .text('Email: ventas@empresa.com', 150, 115)
               .text('RUC: 20123456789', 150, 130);

            // Tipo de documento
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('COMPROBANTE DE VENTA', 350, 80, { align: 'center' });

            // Línea separadora
            doc.moveTo(50, 160)
               .lineTo(545, 160)
               .stroke();

            return 180;

        } catch (error) {
            console.error('Error al agregar header:', error);
            return 180;
        }
    }

    // ============================================
    // INFORMACIÓN DE LA VENTA
    // ============================================
    static async agregarInformacionVenta(doc, datos) {
        try {
            let currentY = 190;

            // Título del documento
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text(`VENTA N° ${datos.codigo || `VTA-${datos.id?.substring(0, 8)}`}`, 50, currentY);

            currentY += 30;

            // Información en dos columnas
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('Fecha:', 50, currentY)
               .font('Helvetica')
               .text(this.formatearFecha(datos.fecha_creacion), 120, currentY);

            doc.font('Helvetica-Bold')
               .text('Estado:', 300, currentY)
               .font('Helvetica')
               .text(this.obtenerEstadoTexto(datos.estado_detallado), 350, currentY);

            currentY += 15;

            doc.font('Helvetica-Bold')
               .text('Tipo documento:', 50, currentY)
               .font('Helvetica')
               .text(this.obtenerTipoDocumentoTexto(datos.tipo_venta), 120, currentY);

            if (datos.asesor_nombre_completo) {
                doc.font('Helvetica-Bold')
                   .text('Asesor:', 300, currentY)
                   .font('Helvetica')
                   .text(datos.asesor_nombre_completo, 350, currentY);
            }

            return currentY + 30;

        } catch (error) {
            console.error('Error al agregar información de venta:', error);
            return 280;
        }
    }

    // ============================================
    // INFORMACIÓN DEL CLIENTE
    // ============================================
    static async agregarInformacionCliente(doc, datos, startY) {
        try {
            let currentY = startY;

            // Título
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('INFORMACIÓN DEL CLIENTE', 50, currentY);

            currentY += 20;

            // Datos del cliente
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('Cliente:', 50, currentY)
               .font('Helvetica')
               .text(datos.cliente_nombre || 'Cliente no especificado', 120, currentY);

            if (datos.cliente_empresa) {
                currentY += 15;
                doc.font('Helvetica-Bold')
                   .text('Empresa:', 50, currentY)
                   .font('Helvetica')
                   .text(datos.cliente_empresa, 120, currentY);
            }

            if (datos.cliente_email) {
                currentY += 15;
                doc.font('Helvetica-Bold')
                   .text('Email:', 50, currentY)
                   .font('Helvetica')
                   .text(datos.cliente_email, 120, currentY);
            }

            if (datos.cliente_telefono) {
                currentY += 15;
                doc.font('Helvetica-Bold')
                   .text('Teléfono:', 50, currentY)
                   .font('Helvetica')
                   .text(datos.cliente_telefono, 120, currentY);
            }

            // Línea separadora
            currentY += 20;
            doc.moveTo(50, currentY)
               .lineTo(545, currentY)
               .stroke();

            return currentY + 15;

        } catch (error) {
            console.error('Error al agregar información del cliente:', error);
            return startY + 100;
        }
    }

    // ============================================
    // TABLA DE PRODUCTOS
    // ============================================
    static async agregarTablaProductos(doc, productos, startY) {
        try {
            let currentY = startY;

            // Verificar espacio disponible
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }

            // Título
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(`PRODUCTOS/SERVICIOS (${productos?.length || 0})`, 50, currentY);

            currentY += 25;

            // Headers de la tabla
            const tableHeaders = {
                item: { x: 50, width: 30, title: 'N°' },
                codigo: { x: 85, width: 60, title: 'Código' },
                descripcion: { x: 150, width: 180, title: 'Descripción' },
                cantidad: { x: 335, width: 50, title: 'Cant.' },
                precio: { x: 390, width: 70, title: 'P. Unit.' },
                total: { x: 465, width: 80, title: 'Total' }
            };

            // Dibujar headers
            doc.rect(50, currentY, 495, 20).fillAndStroke('#f0f0f0', '#000000');
            
            doc.fontSize(9)
               .font('Helvetica-Bold')
               .fillColor('#000000');

            Object.values(tableHeaders).forEach(header => {
                doc.text(header.title, header.x + 5, currentY + 6, {
                    width: header.width - 10,
                    align: 'center'
                });
            });

            currentY += 20;

            // Filas de productos
            if (productos && productos.length > 0) {
                productos.forEach((producto, index) => {
                    // Verificar espacio para nueva página
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 50;
                    }

                    const rowHeight = 25;

                    // Dibujar fila
                    doc.rect(50, currentY, 495, rowHeight).stroke();

                    // Contenido de la fila
                    doc.fontSize(8)
                       .font('Helvetica')
                       .fillColor('#000000');

                    // Número de item
                    doc.text((index + 1).toString(), tableHeaders.item.x + 5, currentY + 8, {
                        width: tableHeaders.item.width - 10,
                        align: 'center'
                    });

                    // Código
                    doc.text(producto.producto_codigo || 'N/A', tableHeaders.codigo.x + 5, currentY + 8, {
                        width: tableHeaders.codigo.width - 10,
                        align: 'center'
                    });

                    // Descripción
                    const descripcion = producto.descripcion_personalizada || producto.producto_nombre || 'Sin descripción';
                    doc.text(descripcion, tableHeaders.descripcion.x + 5, currentY + 5, {
                        width: tableHeaders.descripcion.width - 10,
                        align: 'left'
                    });

                    // Cantidad
                    doc.text(producto.cantidad?.toString() || '0', tableHeaders.cantidad.x + 5, currentY + 8, {
                        width: tableHeaders.cantidad.width - 10,
                        align: 'center'
                    });

                    // Precio unitario
                    doc.text(this.formatearMoneda(producto.precio_unitario), tableHeaders.precio.x + 5, currentY + 8, {
                        width: tableHeaders.precio.width - 10,
                        align: 'right'
                    });

                    // Total
                    doc.text(this.formatearMoneda(producto.total_linea || producto.subtotal), tableHeaders.total.x + 5, currentY + 8, {
                        width: tableHeaders.total.width - 10,
                        align: 'right'
                    });

                    currentY += rowHeight;
                });
            } else {
                // Sin productos
                doc.rect(50, currentY, 495, 25).stroke();
                doc.fontSize(10)
                   .font('Helvetica-Oblique')
                   .text('No hay productos registrados', 50, currentY + 8, {
                       width: 495,
                       align: 'center'
                   });
                currentY += 25;
            }

            return currentY + 20;

        } catch (error) {
            console.error('Error al agregar tabla de productos:', error);
            return startY + 200;
        }
    }

    // ============================================
    // RESUMEN FINANCIERO
    // ============================================
    static async agregarResumenFinanciero(doc, datos, startY) {
        try {
            let currentY = startY;

            // Verificar espacio
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }

            const totalesX = 350;
            const valoresX = 480;

            // Título
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('RESUMEN FINANCIERO', totalesX, currentY);

            currentY += 25;

            // Subtotal
            doc.fontSize(10)
               .font('Helvetica')
               .text('Subtotal:', totalesX, currentY)
               .text(this.formatearMoneda(datos.subtotal || datos.valor_total), valoresX, currentY, {
                   width: 85,
                   align: 'right'
               });

            currentY += 15;

            // Descuento
            if (datos.descuento_monto && parseFloat(datos.descuento_monto) > 0) {
                doc.text('Descuento:', totalesX, currentY)
                   .text(`- ${this.formatearMoneda(datos.descuento_monto)}`, valoresX, currentY, {
                       width: 85,
                       align: 'right'
                   });
                currentY += 15;
            }

            // IGV
            if (datos.igv && parseFloat(datos.igv) > 0) {
                doc.text('IGV (18%):', totalesX, currentY)
                   .text(this.formatearMoneda(datos.igv), valoresX, currentY, {
                       width: 85,
                       align: 'right'
                   });
                currentY += 15;
            }

            // Línea separadora
            doc.moveTo(totalesX, currentY + 5)
               .lineTo(565, currentY + 5)
               .stroke();

            currentY += 15;

            // Total final
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('TOTAL:', totalesX, currentY)
               .text(this.formatearMoneda(datos.valor_final), valoresX, currentY, {
                   width: 85,
                   align: 'right'
               });

            return currentY + 40;

        } catch (error) {
            console.error('Error al agregar resumen financiero:', error);
            return startY + 100;
        }
    }

    // ============================================
    // INFORMACIÓN ADICIONAL
    // ============================================
    static async agregarInformacionAdicional(doc, datos, startY) {
        try {
            let currentY = startY;

            if (datos.notas_internas) {
                // Verificar espacio
                if (currentY > 650) {
                    doc.addPage();
                    currentY = 50;
                }

                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .text('NOTAS:', 50, currentY);

                currentY += 15;

                doc.fontSize(9)
                   .font('Helvetica')
                   .text(datos.notas_internas, 50, currentY, {
                       width: 495,
                       align: 'justify'
                   });

                currentY += Math.ceil(datos.notas_internas.length / 80) * 12;
            }

            return currentY + 20;

        } catch (error) {
            console.error('Error al agregar información adicional:', error);
            return startY + 50;
        }
    }

    // ============================================
    // FOOTER
    // ============================================
    static async agregarFooter(doc) {
        try {
            const pageHeight = 792; // A4 height in points
            const footerY = pageHeight - 80;

            // Línea separadora
            doc.moveTo(50, footerY)
               .lineTo(545, footerY)
               .stroke();

            // Información de contacto
            doc.fontSize(8)
               .font('Helvetica')
               .text('¡Gracias por su preferencia! Para consultas: ventas@empresa.com', 50, footerY + 15, {
                   width: 495,
                   align: 'center'
               });

            // Fecha de generación
            doc.text(`Documento generado el ${new Date().toLocaleString('es-PE')}`, 50, footerY + 35, {
                width: 495,
                align: 'center'
            });

        } catch (error) {
            console.error('Error al agregar footer:', error);
        }
    }

    // ============================================
    // UTILIDADES HELPERS
    // ============================================
    
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

    static obtenerEstadoTexto(estado) {
        const estados = {
            'vendido': 'Vendido',
            'vendido/enviado': 'Enviado',
            'vendido/enviado/recibido': 'Recibido',
            'vendido/enviado/recibido/capacitado': 'Completado',
            'anulado': 'Anulado',
            'cambio': 'Cambio'
        };
        return estados[estado] || 'Vendido';
    }

    static obtenerTipoDocumentoTexto(tipo) {
        const tipos = {
            'factura': 'Factura',
            'boleta': 'Boleta de Venta',
            'nota_venta': 'Nota de Venta'
        };
        return tipos[tipo] || 'Boleta de Venta';
    }
}

module.exports = PDFExportService;