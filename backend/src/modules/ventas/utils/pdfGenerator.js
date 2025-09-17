// ============================================
// PDF GENERATOR - GENERACIÓN PROFESIONAL DE DOCUMENTOS
// Sistema CRM/ERP v2.0 - Utilidad Empresarial
// ============================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {

    // ============================================
    // GENERAR PDF DE COTIZACIÓN
    // ============================================
    static async generarCotizacionPDF(cotizacion) {
        try {
            console.log(`📄 Generando PDF para cotización ${cotizacion.id} v${cotizacion.numero_version}`);

            // Crear directorio si no existe
            const outputDir = path.join(__dirname, '../../../public/pdfs/cotizaciones');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Nombre del archivo
            const filename = `cotizacion-${cotizacion.id}-v${cotizacion.numero_version}-${Date.now()}.pdf`;
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
            doc.pipe(fs.createWriteStream(filepath));

            // HEADER DE LA EMPRESA
            await this.agregarHeaderEmpresa(doc);

            // INFORMACIÓN DEL CLIENTE
            await this.agregarInformacionCliente(doc, cotizacion);

            // INFORMACIÓN DE LA COTIZACIÓN
            await this.agregarInformacionCotizacion(doc, cotizacion);

            // TABLA DE PRODUCTOS/SERVICIOS
            await this.agregarTablaProductos(doc, cotizacion);

            // TOTALES
            await this.agregarTotales(doc, cotizacion);

            // CONDICIONES Y TÉRMINOS
            await this.agregarCondicionesTerminos(doc, cotizacion);

            // FOOTER
            await this.agregarFooter(doc);

            // Finalizar documento
            doc.end();

            console.log(`✅ PDF generado exitosamente: ${filename}`);

            return filepath;

        } catch (error) {
            console.error('❌ Error al generar PDF de cotización:', error);
            throw error;
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
                doc.image(logoPath, 50, 50, { width: 100 });
            }

            // Información de la empresa
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text('EMPRESA CRM/ERP', 170, 60);

            doc.fontSize(10)
               .font('Helvetica')
               .text('Dirección: Av. Principal 123, Ciudad', 170, 85)
               .text('Teléfono: +51 999 888 777', 170, 100)
               .text('Email: ventas@empresa.com', 170, 115)
               .text('RUC: 20123456789', 170, 130);

            // Línea separadora
            doc.moveTo(50, 160)
               .lineTo(545, 160)
               .stroke();

            return 180; // Posición Y donde continúa el contenido

        } catch (error) {
            console.error('Error al agregar header:', error);
            return 180;
        }
    }

    // ============================================
    // INFORMACIÓN DEL CLIENTE
    // ============================================
    static async agregarInformacionCliente(doc, cotizacion) {
        try {
            let currentY = 190;

            // Título
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('INFORMACIÓN DEL CLIENTE', 50, currentY);

            currentY += 25;

            // Datos del cliente
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Cliente: ${cotizacion.cliente_nombre}`, 50, currentY);

            if (cotizacion.cliente_empresa) {
                currentY += 15;
                doc.text(`Empresa: ${cotizacion.cliente_empresa}`, 50, currentY);
            }

            if (cotizacion.cliente_email) {
                currentY += 15;
                doc.text(`Email: ${cotizacion.cliente_email}`, 50, currentY);
            }

            if (cotizacion.cliente_telefono) {
                currentY += 15;
                doc.text(`Teléfono: ${cotizacion.cliente_telefono}`, 50, currentY);
            }

            return currentY + 30;

        } catch (error) {
            console.error('Error al agregar información del cliente:', error);
            return 280;
        }
    }

    // ============================================
    // INFORMACIÓN DE LA COTIZACIÓN
    // ============================================
    static async agregarInformacionCotizacion(doc, cotizacion) {
        try {
            let currentY = 300;

            // Título de la cotización
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text(`COTIZACIÓN N° ${cotizacion.venta_codigo}-V${cotizacion.numero_version}`, 50, currentY);

            currentY += 30;

            // Información en dos columnas
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('Fecha:', 50, currentY)
               .font('Helvetica')
               .text(new Date(cotizacion.fecha_creacion).toLocaleDateString('es-PE'), 120, currentY);

            doc.font('Helvetica-Bold')
               .text('Válida hasta:', 300, currentY)
               .font('Helvetica')
               .text(new Date(cotizacion.fecha_validez).toLocaleDateString('es-PE'), 380, currentY);

            currentY += 15;

            if (cotizacion.tiempo_entrega) {
                doc.font('Helvetica-Bold')
                   .text('Tiempo de entrega:', 50, currentY)
                   .font('Helvetica')
                   .text(cotizacion.tiempo_entrega, 120, currentY);
            }

            if (cotizacion.condiciones_pago) {
                doc.font('Helvetica-Bold')
                   .text('Condiciones de pago:', 300, currentY)
                   .font('Helvetica')
                   .text(cotizacion.condiciones_pago, 380, currentY);
            }

            currentY += 25;

            if (cotizacion.descripcion) {
                doc.font('Helvetica-Bold')
                   .text('Descripción:', 50, currentY);
                
                currentY += 15;
                
                doc.font('Helvetica')
                   .text(cotizacion.descripcion, 50, currentY, {
                       width: 495,
                       align: 'justify'
                   });
                
                currentY += Math.ceil(cotizacion.descripcion.length / 80) * 12;
            }

            return currentY + 20;

        } catch (error) {
            console.error('Error al agregar información de cotización:', error);
            return 400;
        }
    }

    // ============================================
    // TABLA DE PRODUCTOS/SERVICIOS
    // ============================================
    static async agregarTablaProductos(doc, cotizacion) {
        try {
            let currentY = 420;

            // Verificar si necesitamos una nueva página
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }

            // Título de la tabla
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('DETALLE DE PRODUCTOS/SERVICIOS', 50, currentY);

            currentY += 25;

            // Headers de la tabla
            const tableHeaders = {
                item: { x: 50, width: 30, title: 'Item' },
                descripcion: { x: 85, width: 200, title: 'Descripción' },
                cantidad: { x: 290, width: 60, title: 'Cant.' },
                precio: { x: 355, width: 70, title: 'Precio Unit.' },
                descuento: { x: 430, width: 60, title: 'Desc.' },
                total: { x: 495, width: 70, title: 'Total' }
            };

            // Dibujar headers
            doc.rect(50, currentY, 515, 20).fillAndStroke('#f0f0f0', '#000000');
            
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
            if (cotizacion.detalles && cotizacion.detalles.length > 0) {
                cotizacion.detalles.forEach((detalle, index) => {
                    // Verificar espacio para nueva página
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 50;
                    }

                    const rowHeight = 25;

                    // Dibujar fila
                    doc.rect(50, currentY, 515, rowHeight).stroke();

                    // Contenido de la fila
                    doc.fontSize(8)
                       .font('Helvetica')
                       .fillColor('#000000');

                    // Item
                    doc.text((index + 1).toString(), tableHeaders.item.x + 5, currentY + 8, {
                        width: tableHeaders.item.width - 10,
                        align: 'center'
                    });

                    // Descripción
                    const descripcion = detalle.descripcion_personalizada || detalle.producto_nombre || 'Servicio';
                    doc.text(descripcion, tableHeaders.descripcion.x + 5, currentY + 5, {
                        width: tableHeaders.descripcion.width - 10,
                        align: 'left'
                    });

                    // Cantidad
                    doc.text(detalle.cantidad.toString(), tableHeaders.cantidad.x + 5, currentY + 8, {
                        width: tableHeaders.cantidad.width - 10,
                        align: 'center'
                    });

                    // Precio unitario
                    doc.text(`S/ ${parseFloat(detalle.precio_unitario).toFixed(2)}`, tableHeaders.precio.x + 5, currentY + 8, {
                        width: tableHeaders.precio.width - 10,
                        align: 'right'
                    });

                    // Descuento
                    const descuento = detalle.descuento_monto || 0;
                    doc.text(`S/ ${parseFloat(descuento).toFixed(2)}`, tableHeaders.descuento.x + 5, currentY + 8, {
                        width: tableHeaders.descuento.width - 10,
                        align: 'right'
                    });

                    // Total
                    doc.text(`S/ ${parseFloat(detalle.total_linea).toFixed(2)}`, tableHeaders.total.x + 5, currentY + 8, {
                        width: tableHeaders.total.width - 10,
                        align: 'right'
                    });

                    currentY += rowHeight;
                });
            } else {
                // Sin productos
                doc.rect(50, currentY, 515, 25).stroke();
                doc.fontSize(10)
                   .font('Helvetica-Oblique')
                   .text('No hay productos/servicios especificados', 50, currentY + 8, {
                       width: 515,
                       align: 'center'
                   });
                currentY += 25;
            }

            return currentY + 20;

        } catch (error) {
            console.error('Error al agregar tabla de productos:', error);
            return 500;
        }
    }

    // ============================================
    // TOTALES
    // ============================================
    static async agregarTotales(doc, cotizacion) {
        try {
            let currentY = 550;

            // Verificar espacio
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }

            const totalesX = 350;
            const valoresX = 480;

            // Subtotal
            doc.fontSize(10)
               .font('Helvetica')
               .text('Subtotal:', totalesX, currentY)
               .text(`S/ ${parseFloat(cotizacion.subtotal || 0).toFixed(2)}`, valoresX, currentY, {
                   width: 85,
                   align: 'right'
               });

            currentY += 15;

            // Descuento
            if (cotizacion.valor_descuento > 0) {
                doc.text('Descuento:', totalesX, currentY)
                   .text(`- S/ ${parseFloat(cotizacion.valor_descuento).toFixed(2)}`, valoresX, currentY, {
                       width: 85,
                       align: 'right'
                   });
                currentY += 15;
            }

            // Base imponible
            doc.text('Base imponible:', totalesX, currentY)
               .text(`S/ ${parseFloat(cotizacion.base_impuesto || 0).toFixed(2)}`, valoresX, currentY, {
                   width: 85,
                   align: 'right'
               });

            currentY += 15;

            // IGV
            if (cotizacion.valor_impuesto > 0) {
                doc.text(`IGV (${cotizacion.porcentaje_impuesto}%):`, totalesX, currentY)
                   .text(`S/ ${parseFloat(cotizacion.valor_impuesto).toFixed(2)}`, valoresX, currentY, {
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
               .text(`S/ ${parseFloat(cotizacion.total || 0).toFixed(2)}`, valoresX, currentY, {
                   width: 85,
                   align: 'right'
               });

            return currentY + 40;

        } catch (error) {
            console.error('Error al agregar totales:', error);
            return 600;
        }
    }

    // ============================================
    // CONDICIONES Y TÉRMINOS
    // ============================================
    static async agregarCondicionesTerminos(doc, cotizacion) {
        try {
            let currentY = 620;

            // Verificar espacio
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }

            doc.fontSize(11)
               .font('Helvetica-Bold')
               .text('CONDICIONES GENERALES:', 50, currentY);

            currentY += 20;

            const condiciones = [
                '• Esta cotización tiene una validez limitada según se indica en el encabezado.',
                '• Los precios están expresados en soles peruanos e incluyen IGV.',
                '• La forma de pago se especifica en las condiciones particulares.',
                '• El tiempo de entrega se cuenta a partir de la confirmación del pedido.',
                '• Cualquier modificación debe ser acordada por escrito.'
            ];

            doc.fontSize(9)
               .font('Helvetica');

            condiciones.forEach(condicion => {
                doc.text(condicion, 50, currentY, {
                    width: 495,
                    align: 'justify'
                });
                currentY += 12;
            });

            // Observaciones específicas
            if (cotizacion.observaciones) {
                currentY += 10;
                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .text('OBSERVACIONES:', 50, currentY);

                currentY += 15;

                doc.fontSize(9)
                   .font('Helvetica')
                   .text(cotizacion.observaciones, 50, currentY, {
                       width: 495,
                       align: 'justify'
                   });
            }

            return currentY + 30;

        } catch (error) {
            console.error('Error al agregar condiciones:', error);
            return 700;
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
               .text('¡Gracias por su confianza! Para consultas o aclaraciones, no dude en contactarnos.', 50, footerY + 15, {
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
    // GENERAR REPORTE DE VENTAS
    // ============================================
    static async generarReporteVentas(datos, configuracion = {}) {
        try {
            console.log('📊 Generando reporte de ventas...');

            const outputDir = path.join(__dirname, '../../../public/pdfs/reportes');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const filename = `reporte-ventas-${Date.now()}.pdf`;
            const filepath = path.join(outputDir, filename);

            const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
            doc.pipe(fs.createWriteStream(filepath));

            // Header
            await this.agregarHeaderEmpresa(doc);

            // Título del reporte
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text('REPORTE DE VENTAS', 50, 200, { align: 'center' });

            let currentY = 240;

            // Período
            if (configuracion.periodo) {
                doc.fontSize(12)
                   .font('Helvetica')
                   .text(`Período: ${configuracion.periodo}`, 50, currentY, { align: 'center' });
                currentY += 30;
            }

            // Resumen general
            if (datos.resumen) {
                doc.fontSize(12)
                   .font('Helvetica-Bold')
                   .text('RESUMEN GENERAL', 50, currentY);

                currentY += 20;

                Object.entries(datos.resumen).forEach(([key, value]) => {
                    doc.fontSize(10)
                       .font('Helvetica')
                       .text(`${key}: ${value}`, 70, currentY);
                    currentY += 15;
                });
            }

            doc.end();

            console.log(`✅ Reporte generado: ${filename}`);
            return filepath;

        } catch (error) {
            console.error('❌ Error al generar reporte:', error);
            throw error;
        }
    }

    // ============================================
    // UTILIDADES HELPERS
    // ============================================
    
    static formatearMoneda(valor) {
        return `S/ ${parseFloat(valor || 0).toFixed(2)}`;
    }

    static formatearFecha(fecha) {
        return new Date(fecha).toLocaleDateString('es-PE');
    }

    static calcularAltoTexto(texto, ancho, fontSize = 10) {
        // Estimación aproximada del alto de texto
        const caracteresPerLinea = Math.floor(ancho / (fontSize * 0.6));
        const lineas = Math.ceil(texto.length / caracteresPerLinea);
        return lineas * fontSize * 1.2;
    }
}

module.exports = PDFGenerator;