// ============================================
// EMAIL SERVICE - SISTEMA UNIFICADO DE NOTIFICACIONES
// Sistema CRM/ERP v2.0 - SendGrid + Twilio + In-App
// ============================================

const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const { query } = require('../../../config/database');

class EmailService {
    constructor() {
        // Configurar SendGrid
        if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            console.log('✅ SendGrid configurado correctamente');
        } else {
            console.log('⚠️ SENDGRID_API_KEY no configurado - emails en modo simulado');
        }

        // Configurar Twilio
        if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET) {
            this.twilioClient = twilio(
                process.env.TWILIO_API_KEY_SID,
                process.env.TWILIO_API_KEY_SECRET,
                { accountSid: process.env.TWILIO_ACCOUNT_SID }
            );
            console.log('✅ Twilio configurado correctamente');
        } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.twilioClient = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );
            console.log('✅ Twilio configurado con Auth Token');
        } else {
            console.log('⚠️ Twilio no configurado - SMS en modo simulado');
            this.twilioClient = null;
        }
    }

    // ==========================================
    // NOTIFICACIONES DE PROSPECTOS (Tu código existente mejorado)
    // ==========================================

    async enviarSeguimientoVencido(prospecto, asesor) {
        const horasVencidas = Math.floor(
            (new Date() - new Date(prospecto.seguimiento_obligatorio)) / (1000 * 60 * 60)
        );

        const urgencia = horasVencidas > 24 ? '🚨 URGENTE' : '⏰ Recordatorio';
        const colorUrgencia = horasVencidas > 24 ? '#dc3545' : '#ffc107';

        // 1. Crear notificación in-app
        await this._crearNotificacionApp(
            'seguimiento_vencido',
            {
                prospecto_id: prospecto.id,
                codigo: prospecto.codigo,
                nombre_cliente: prospecto.nombre_cliente,
                horas_vencidas: horasVencidas,
                urgente: horasVencidas > 24
            },
            asesor
        );

        // 2. Enviar email con SendGrid
        const msg = {
            to: asesor.email || 'admin@localhost.com',
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'crm@localhost.com',
                name: process.env.SENDGRID_FROM_NAME || 'Sistema CRM'
            },
            subject: `${urgencia} Seguimiento - ${prospecto.nombre_cliente} (${horasVencidas}h vencido)`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Seguimiento Vencido</title>
                </head>
                <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">
                            ${urgencia === '🚨 URGENTE' ? '🚨' : '⏰'} Seguimiento Vencido
                        </h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">
                            Sistema CRM - Notificación Automática
                        </p>
                    </div>

                    <!-- Content -->
                    <div style="background: #fff; padding: 30px; border: 1px solid #ddd;">
                        <p style="font-size: 16px; margin-bottom: 20px;">
                            Hola <strong>${asesor.nombre || 'Usuario'}</strong>,
                        </p>
                        
                        <div style="background: ${horasVencidas > 24 ? '#fff5f5' : '#fffbf0'}; border-left: 4px solid ${colorUrgencia}; padding: 20px; margin: 20px 0; border-radius: 0 5px 5px 0;">
                            <h3 style="margin-top: 0; color: ${colorUrgencia};">
                                ⚠️ Atención Requerida
                            </h3>
                            <p style="margin-bottom: 15px; font-size: 16px;">
                                El prospecto <strong>${prospecto.nombre_cliente}</strong> lleva 
                                <span style="background: ${colorUrgencia}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                    ${horasVencidas} horas
                                </span> 
                                sin seguimiento.
                            </p>
                            ${horasVencidas > 24 ? 
                                '<p style="color: #dc3545; font-weight: bold; margin: 0;">🚨 Este prospecto requiere atención INMEDIATA</p>' : 
                                '<p style="color: #856404; margin: 0;">⏰ Recomendamos contactar en las próximas 2-4 horas</p>'
                            }
                        </div>

                        <!-- Detalles del Prospecto -->
                        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #495057; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                                📋 Detalles del Prospecto
                            </h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold; width: 40%;">Código:</td>
                                    <td style="padding: 8px 0;">${prospecto.codigo}</td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Cliente:</td>
                                    <td style="padding: 8px 0;">${prospecto.nombre_cliente}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Teléfono:</td>
                                    <td style="padding: 8px 0;">
                                        <a href="tel:${prospecto.telefono}" style="color: #007bff; text-decoration: none;">
                                            📞 ${prospecto.telefono}
                                        </a>
                                    </td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Estado:</td>
                                    <td style="padding: 8px 0;">
                                        <span style="background: #17a2b8; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                            ${prospecto.estado}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Valor estimado:</td>
                                    <td style="padding: 8px 0; font-size: 16px; font-weight: bold; color: #28a745;">
                                        $${prospecto.valor_estimado || 0}
                                    </td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Seguimiento era:</td>
                                    <td style="padding: 8px 0; color: #dc3545;">
                                        ${new Date(prospecto.seguimiento_obligatorio).toLocaleDateString('es-PE')} 
                                        ${new Date(prospecto.seguimiento_obligatorio).toLocaleTimeString('es-PE')}
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <!-- Call to Action -->
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/prospectos/${prospecto.id}" 
                               style="background: ${horasVencidas > 24 ? '#dc3545' : '#007bff'}; 
                                      color: white; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 8px; 
                                      font-weight: bold;
                                      font-size: 16px;
                                      display: inline-block;
                                      box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                                ${horasVencidas > 24 ? '🚨 CONTACTAR AHORA' : '📞 Ver en CRM'}
                            </a>
                        </div>

                        <!-- Tips de Acción -->
                        <div style="background: #e7f3ff; border: 1px solid #b8daff; border-radius: 8px; padding: 15px; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #004085;">💡 Próximos Pasos Recomendados:</h4>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #004085;">
                                <li>Llamar directamente al prospecto</li>
                                <li>Enviar WhatsApp de seguimiento</li>
                                <li>Programar nuevo seguimiento para ${horasVencidas > 24 ? 'hoy' : 'mañana'}</li>
                                <li>Actualizar estado en el CRM</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background: #6c757d; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; font-size: 14px;">
                        <p style="margin: 0;">
                            📊 Este email fue enviado automáticamente por tu Sistema CRM
                        </p>
                        <p style="margin: 10px 0 0 0; opacity: 0.8;">
                            Tiempo de respuesta ${horasVencidas > 24 ? 'CRÍTICO: Inmediato' : 'recomendado: 2-4 horas'}
                        </p>
                        <p style="margin: 10px 0 0 0; opacity: 0.7; font-size: 12px;">
                            ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')} (Peru)
                        </p>
                    </div>
                </body>
                </html>
            `
        };

        // 3. Enviar SMS si es CRÍTICO (>48 horas)
        if (horasVencidas > 48 && asesor.telefono) {
            await this._enviarSMS(
                asesor.telefono,
                `🚨 URGENTE: ${prospecto.nombre_cliente} lleva ${horasVencidas}h sin seguimiento. Ver CRM: ${process.env.FRONTEND_URL}/prospectos/${prospecto.id}`
            );
        }

        return await this._enviarEmailSendGrid(msg);
    }

    async enviarProspectoCreado(prospecto, asesor) {
        // 1. Crear notificación in-app
        await this._crearNotificacionApp(
            'nuevo_prospecto',
            {
                prospecto_id: prospecto.id,
                codigo: prospecto.codigo,
                nombre_cliente: prospecto.nombre_cliente,
                canal_contacto: prospecto.canal_contacto
            },
            asesor
        );

        // 2. Enviar email
        const msg = {
            to: asesor.email || 'admin@localhost.com',
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'crm@localhost.com',
                name: process.env.SENDGRID_FROM_NAME || 'Sistema CRM'
            },
            subject: `🎯 Nuevo Prospecto Asignado: ${prospecto.nombre_cliente}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="margin: 0;">🎯 Nuevo Prospecto Asignado</h1>
                    </div>
                    
                    <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
                        <p>Hola <strong>${asesor.nombre || 'Usuario'}</strong>,</p>
                        <p>Se te ha asignado un nuevo prospecto:</p>
                        
                        <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">👤 ${prospecto.nombre_cliente}</h3>
                            <p><strong>Código:</strong> ${prospecto.codigo}</p>
                            <p><strong>Teléfono:</strong> 📞 ${prospecto.telefono}</p>
                            <p><strong>Canal:</strong> ${prospecto.canal_contacto}</p>
                            <p><strong>Primer seguimiento:</strong> 
                               ${new Date(prospecto.seguimiento_obligatorio).toLocaleDateString('es-PE')} 
                               a las ${new Date(prospecto.seguimiento_obligatorio).toLocaleTimeString('es-PE')}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/prospectos/${prospecto.id}" 
                               style="background: #28a745; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                               📞 Contactar Ahora
                            </a>
                        </div>
                    </div>
                </div>
            `
        };

        return await this._enviarEmailSendGrid(msg);
    }

    // ==========================================
    // NOTIFICACIONES DE VENTAS (NUEVAS)
    // ==========================================

    async enviarNuevaVenta(venta, asesor) {
        // 1. Crear notificación in-app
        await this._crearNotificacionApp(
            'nueva_venta',
            {
                venta_id: venta.id,
                codigo_venta: venta.codigo_venta,
                cliente_nombre: venta.cliente_nombre,
                valor_total: venta.valor_total,
                producto_nombre: venta.producto_nombre
            },
            asesor
        );

        // 2. Enviar email
        const msg = {
            to: asesor.email,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: process.env.SENDGRID_FROM_NAME
            },
            subject: `🎉 Nueva Venta Registrada: ${venta.codigo_venta}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0;">🎉 ¡Nueva Venta Registrada!</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">¡Felicitaciones por tu éxito!</p>
                    </div>
                    
                    <div style="padding: 30px; background: #fff; border: 1px solid #ddd;">
                        <p>¡Excelente trabajo <strong>${asesor.nombre}</strong>!</p>
                        <p>Has registrado una nueva venta exitosamente:</p>
                        
                        <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 0 5px 5px 0;">
                            <h3 style="margin-top: 0; color: #28a745;">📋 Detalles de la Venta</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold; width: 30%;">Código:</td>
                                    <td style="padding: 8px 0;">${venta.codigo_venta}</td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Cliente:</td>
                                    <td style="padding: 8px 0;">${venta.cliente_nombre}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Producto:</td>
                                    <td style="padding: 8px 0;">${venta.producto_nombre}</td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Valor:</td>
                                    <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #28a745;">
                                        $${this._formatearMoneda(venta.valor_total)}
                                    </td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/ventas/${venta.id}" 
                               style="background: #28a745; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                📊 Ver en CRM
                            </a>
                        </div>
                    </div>
                </div>
            `
        };

        return await this._enviarEmailSendGrid(msg);
    }

    // ==========================================
    // NOTIFICACIONES DE COMISIONES (NUEVAS)
    // ==========================================

    async enviarComisionCalculada(comision, asesor) {
        // 1. Crear notificación in-app
        await this._crearNotificacionApp(
            'comision_calculada',
            {
                comision_id: comision.id,
                cuota_usd: comision.cuota_usd,
                ventas_usd: comision.ventas_usd,
                porcentaje_cumplimiento: comision.porcentaje_cumplimiento,
                bono_usd: comision.bono_usd,
                periodo: comision.periodo
            },
            asesor
        );

        // 2. Enviar email
        const msg = {
            to: asesor.email,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: process.env.SENDGRID_FROM_NAME
            },
            subject: `💰 Comisión Calculada: $${comision.bono_usd} USD`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0;">💰 Comisión Calculada</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Tu rendimiento del mes</p>
                    </div>
                    
                    <div style="padding: 30px; background: #fff; border: 1px solid #ddd;">
                        <p>Hola <strong>${asesor.nombre}</strong>,</p>
                        <p>Tu comisión del mes ha sido calculada:</p>
                        
                        <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0; border-radius: 0 5px 5px 0;">
                            <h3 style="margin-top: 0; color: #007bff;">📊 Resumen del Período</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold; width: 40%;">Período:</td>
                                    <td style="padding: 8px 0;">${new Date(comision.periodo).toLocaleDateString('es-PE', {year: 'numeric', month: 'long'})}</td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Cuota asignada:</td>
                                    <td style="padding: 8px 0;">$${this._formatearMoneda(comision.cuota_usd)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Ventas realizadas:</td>
                                    <td style="padding: 8px 0;">$${this._formatearMoneda(comision.ventas_usd)}</td>
                                </tr>
                                <tr style="background: #f8f9fa;">
                                    <td style="padding: 8px 0; font-weight: bold;">Cumplimiento:</td>
                                    <td style="padding: 8px 0;">
                                        <span style="background: ${comision.porcentaje_cumplimiento >= 100 ? '#28a745' : comision.porcentaje_cumplimiento >= 90 ? '#ffc107' : '#dc3545'}; 
                                                     color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                            ${comision.porcentaje_cumplimiento}%
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Comisión ganada:</td>
                                    <td style="padding: 8px 0; font-size: 20px; font-weight: bold; color: #28a745;">
                                        $${this._formatearMoneda(comision.bono_usd)} USD
                                    </td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/comisiones" 
                               style="background: #007bff; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                💰 Ver Comisiones
                            </a>
                        </div>
                    </div>
                </div>
            `
        };

        return await this._enviarEmailSendGrid(msg);
    }

    // ==========================================
    // MÉTODOS INTERNOS
    // ==========================================

    async _enviarEmailSendGrid(msg) {
        try {
            if (process.env.SENDGRID_API_KEY) {
                await sgMail.send(msg);
                console.log(`📧 Email SendGrid enviado a: ${msg.to}`);
                return { success: true, enviado: true };
            } else {
                console.log(`📧 Email simulado: ${msg.subject} → ${msg.to}`);
                return { success: true, enviado: false, simulado: true };
            }
        } catch (error) {
            console.error('❌ Error SendGrid:', error.response?.body || error.message);
            throw error;
        }
    }

    async _enviarSMS(telefono, mensaje) {
        try {
            if (this.twilioClient && process.env.TWILIO_PHONE_NUMBER) {
                const result = await this.twilioClient.messages.create({
                    body: mensaje,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: telefono
                });
                console.log(`📱 SMS enviado a ${telefono}: ${result.sid}`);
                return { success: true, enviado: true, sid: result.sid };
            } else {
                console.log(`📱 SMS simulado a ${telefono}: ${mensaje}`);
                return { success: true, enviado: false, simulado: true };
            }
        } catch (error) {
            console.error('❌ Error enviando SMS:', error);
            return { success: false, error: error.message };
        }
    }

    async _crearNotificacionApp(tipo, datos, usuario) {
        try {
            await query.execute(
                `INSERT INTO notificaciones 
                 (usuario_id, tipo, titulo, mensaje, datos_extra, prioridad, activo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
                [
                    usuario.id,
                    tipo,
                    this._generarTitulo(tipo, datos),
                    this._generarMensaje(tipo, datos),
                    JSON.stringify(datos),
                    this._determinarPrioridad(tipo, datos)
                ]
            );
            
            console.log(`📱 Notificación in-app creada: ${tipo} → Usuario ${usuario.id}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error creando notificación in-app:', error);
            return false;
        }
    }

    _generarTitulo(tipo, datos) {
        const titulos = {
            'seguimiento_vencido': datos.urgente ? '🚨 Seguimiento URGENTE' : '⏰ Seguimiento Vencido',
            'nuevo_prospecto': '🎯 Nuevo Prospecto Asignado',
            'nueva_venta': '🎉 Nueva Venta Registrada',
            'comision_calculada': '💰 Comisión Calculada',
            'meta_en_riesgo': '⚠️ Meta en Riesgo'
        };
        return titulos[tipo] || 'Notificación del Sistema';
    }

    _generarMensaje(tipo, datos) {
        const mensajes = {
            'seguimiento_vencido': `${datos.nombre_cliente} lleva ${datos.horas_vencidas}h sin seguimiento`,
            'nuevo_prospecto': `Nuevo prospecto asignado: ${datos.nombre_cliente}`,
            'nueva_venta': `Venta registrada: ${datos.codigo_venta} - $${this._formatearMoneda(datos.valor_total)}`,
            'comision_calculada': `Comisión: $${this._formatearMoneda(datos.bono_usd)} (${datos.porcentaje_cumplimiento}% cumplimiento)`,
            'meta_en_riesgo': `Tu meta mensual está en riesgo`
        };
        return mensajes[tipo] || 'Nueva notificación disponible';
    }

    _determinarPrioridad(tipo, datos) {
        if (tipo === 'seguimiento_vencido' && datos.urgente) return 'alta';
        if (tipo === 'nueva_venta') return 'normal';
        if (tipo === 'comision_calculada') return 'normal';
        return 'normal';
    }

    _formatearMoneda(valor) {
        return new Intl.NumberFormat('en-US').format(valor);
    }

    // ==========================================
    // MÉTODO DE TEST
    // ==========================================

    async testEmail(email) {
        const msg = {
            to: email,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'crm@localhost.com',
                name: process.env.SENDGRID_FROM_NAME || 'Sistema CRM'
            },
            subject: '✅ Test Email - Sistema CRM Funcionando',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #28a745;">✅ ¡Sistema CRM Email Funcionando!</h2>
                    <p>Este es un email de prueba para confirmar que SendGrid está configurado correctamente.</p>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    <p><strong>Peru Time:</strong> ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}</p>
                    
                    <div style="background: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <h3>🔧 Configuración Detectada:</h3>
                        <p>✅ SendGrid: ${process.env.SENDGRID_API_KEY ? 'Configurado' : 'No configurado'}</p>
                        <p>✅ Twilio: ${this.twilioClient ? 'Configurado' : 'No configurado'}</p>
                        <p>✅ Frontend URL: ${process.env.FRONTEND_URL || 'No configurado'}</p>
                    </div>
                </div>
            `
        };

        return await this._enviarEmailSendGrid(msg);
    }

    async testSMS(telefono) {
        return await this._enviarSMS(
            telefono,
            '✅ Test SMS - Sistema CRM funcionando correctamente. ' + new Date().toLocaleTimeString('es-PE')
        );
    }
}

module.exports = new EmailService();