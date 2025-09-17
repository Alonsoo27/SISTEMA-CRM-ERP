// ============================================
// NOTIFICACIONES VENTAS SERVICE - SISTEMA DE ALERTAS EMPRESARIAL
// Sistema CRM/ERP v2.0 - Módulo de Ventas Avanzado
// VERSIÓN FINAL CORREGIDA PARA POSTGRESQL/SUPABASE
// ============================================

const { query } = require('../../../config/database');
const nodemailer = require('nodemailer');

class NotificacionesVentasService {

    // ==========================================
    // CONFIGURACIÓN DE TRANSPORTE
    // ==========================================
    
    static async _getEmailTransporter() {
        return nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // ==========================================
    // ENVÍO DE NOTIFICACIONES PRINCIPALES
    // ==========================================
    
    static async enviarNotificacion(params) {
        try {
            const { tipo, usuario_id, datos, canal = 'multiple', prioridad = 'media' } = params;
            
            // Obtener configuración de usuario
            const { data: usuario, error: userError } = await query.execute(
                `SELECT u.*, up.notificaciones_ventas, up.canal_preferido_ventas, up.horario_notificaciones
                 FROM usuarios u
                 LEFT JOIN usuarios_preferencias up ON u.id = up.usuario_id
                 WHERE u.id = $1 AND u.activo = true`,
                [usuario_id]
            );
            
            if (userError || !usuario || usuario.length === 0) {
                console.warn(`Usuario ${usuario_id} no encontrado para notificación`);
                return false;
            }
            
            const usuarioData = usuario[0];
            
            // Verificar si el usuario acepta notificaciones de ventas
            if (usuarioData.notificaciones_ventas === false) {
                console.log(`Usuario ${usuario_id} tiene deshabilitadas las notificaciones de ventas`);
                return false;
            }
            
            // Verificar horarios de notificación
            if (!this._esDentroDeHorarioPermitido(usuarioData.horario_notificaciones)) {
                await this._programarNotificacionPosterior(params, usuarioData);
                return true;
            }
            
            // Generar contenido de la notificación
            const contenido = await this._generarContenidoNotificacion(tipo, datos, usuarioData);
            
            if (!contenido) {
                console.warn(`No se pudo generar contenido para notificación tipo: ${tipo}`);
                return false;
            }
            
            // ✅ CORREGIDO: Usar tabla 'notificaciones' existente y campo 'datos_extra'
            const { data: notificacionResult, error: insertError } = await query.execute(
                `INSERT INTO notificaciones 
                 (usuario_id, tipo, titulo, mensaje, datos_extra, prioridad, estado, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'Enviada', NOW())
                 RETURNING id`,
                [
                    usuario_id,
                    tipo,
                    contenido.titulo,
                    contenido.mensaje,
                    JSON.stringify(datos),
                    prioridad
                ]
            );
            
            if (insertError) {
                console.error('Error insertando notificación:', insertError);
                return false;
            }
            
            // Enviar por canales seleccionados
            const canalPreferido = canal === 'multiple' ? usuarioData.canal_preferido_ventas || 'app' : canal;
            let resultados = {};
            
            if (canalPreferido === 'multiple' || canalPreferido === 'email') {
                resultados.email = await this._enviarNotificacionEmail(usuarioData, contenido);
            }
            
            if (canalPreferido === 'multiple' || canalPreferido === 'app') {
                resultados.app = await this._enviarNotificacionApp(usuarioData, contenido, notificacionResult[0].id);
            }
            
            if (canalPreferido === 'sms' && prioridad === 'alta') {
                resultados.sms = await this._enviarNotificacionSMS(usuarioData, contenido);
            }
            
            // Actualizar estado según resultados
            const estadoFinal = Object.values(resultados).some(r => r) ? 'Entregada' : 'Fallida';
            
            // ✅ CORREGIDO: Usar tabla 'notificaciones' y PostgreSQL syntax
            await query.execute(
                `UPDATE notificaciones 
                 SET estado = $1, resultados_envio = $2, fecha_actualizacion = NOW()
                 WHERE id = $3`,
                [estadoFinal, JSON.stringify(resultados), notificacionResult[0].id]
            );
            
            return estadoFinal === 'Entregada';
            
        } catch (error) {
            console.error('Error enviando notificación de ventas:', error);
            return false;
        }
    }

    // ==========================================
    // NOTIFICACIONES AUTOMÁTICAS ESPECÍFICAS
    // ==========================================
    
    static async notificarNuevaVenta(venta) {
        // Notificar al asesor
        await this.enviarNotificacion({
            tipo: 'nueva_venta_creada',
            usuario_id: venta.asesor_id,
            datos: {
                venta_id: venta.id,
                codigo_venta: venta.codigo_venta,
                cliente: venta.cliente_nombre,
                valor_total: venta.valor_total,
                producto: venta.producto_nombre
            },
            prioridad: 'media'
        });
        
        // Notificar al supervisor si la venta es alta
        if (venta.valor_total > 10000) {
            // Buscar usuarios con rol supervisor/manager
            const { data: supervisores } = await query.execute(
                `SELECT u.id FROM usuarios u
                 JOIN roles r ON u.rol_id = r.id 
                 WHERE r.nombre IN ('supervisor', 'manager', 'admin') 
                   AND u.activo = true 
                 LIMIT 1`
            );
            
            if (supervisores && supervisores.length > 0) {
                await this.enviarNotificacion({
                    tipo: 'venta_alta_valor',
                    usuario_id: supervisores[0].id,
                    datos: {
                        venta_id: venta.id,
                        codigo_venta: venta.codigo_venta,
                        asesor: venta.asesor_nombre,
                        cliente: venta.cliente_nombre,
                        valor_total: venta.valor_total
                    },
                    prioridad: 'alta'
                });
            }
        }
    }
    
    static async notificarCambioEstadoVenta(venta, estado_anterior, estado_nuevo) {
        const datos = {
            venta_id: venta.id,
            codigo_venta: venta.codigo_venta,
            cliente: venta.cliente_nombre,
            estado_anterior,
            estado_nuevo,
            valor_total: venta.valor_total
        };
        
        // Notificar al asesor del cambio
        await this.enviarNotificacion({
            tipo: 'cambio_estado_venta',
            usuario_id: venta.asesor_id,
            datos,
            prioridad: estado_nuevo === 'Cancelada' ? 'alta' : 'media'
        });
        
        // Notificaciones específicas por estado
        switch (estado_nuevo) {
            case 'Aprobada':
                await this._notificarVentaAprobada(venta);
                break;
            case 'Facturada':
                await this._notificarVentaFacturada(venta);
                break;
            case 'Cancelada':
                await this._notificarVentaCancelada(venta);
                break;
        }
    }
    
    static async notificarMetaEnRiesgo(asesor, meta, progreso) {
        const diasRestantes = Math.ceil((new Date(meta.fecha_fin) - new Date()) / (1000 * 60 * 60 * 24));
        const porcentajeAvance = (progreso.valor_actual / meta.valor_objetivo) * 100;
        
        if (diasRestantes <= 7 && porcentajeAvance < 70) {
            await this.enviarNotificacion({
                tipo: 'meta_en_riesgo',
                usuario_id: asesor.id,
                datos: {
                    meta_id: meta.id,
                    tipo_meta: meta.tipo_meta,
                    valor_objetivo: meta.valor_objetivo,
                    valor_actual: progreso.valor_actual,
                    porcentaje_avance: porcentajeAvance.toFixed(1),
                    dias_restantes: diasRestantes
                },
                prioridad: 'alta'
            });
            
            // Notificar también al supervisor
            if (asesor.supervisor_id) {
                await this.enviarNotificacion({
                    tipo: 'asesor_meta_riesgo',
                    usuario_id: asesor.supervisor_id,
                    datos: {
                        asesor_nombre: asesor.asesor_nombre_completo || `${asesor.nombre || ''} ${asesor.apellido || ''}`.trim(),
                        asesor_id: asesor.id,
                        meta_tipo: meta.tipo_meta,
                        porcentaje_avance: porcentajeAvance.toFixed(1),
                        dias_restantes: diasRestantes
                    },
                    prioridad: 'alta'
                });
            }
        }
    }
    
    static async notificarCotizacionVencida(cotizacion) {
        await this.enviarNotificacion({
            tipo: 'cotizacion_vencida',
            usuario_id: cotizacion.asesor_id,
            datos: {
                cotizacion_id: cotizacion.id,
                numero_cotizacion: cotizacion.numero_cotizacion,
                cliente: cotizacion.cliente_nombre,
                valor_total: cotizacion.valor_total,
                dias_vencida: Math.ceil((new Date() - new Date(cotizacion.fecha_vencimiento)) / (1000 * 60 * 60 * 24))
            },
            prioridad: 'media'
        });
    }
    
    static async notificarSeguimientoVencido(seguimiento) {
        await this.enviarNotificacion({
            tipo: 'seguimiento_post_venta_vencido',
            usuario_id: seguimiento.asesor_id,
            datos: {
                seguimiento_id: seguimiento.id,
                venta_codigo: seguimiento.codigo_venta,
                cliente: seguimiento.cliente_nombre,
                tipo_seguimiento: seguimiento.tipo_seguimiento,
                dias_vencido: Math.ceil((new Date() - new Date(seguimiento.fecha_programada)) / (1000 * 60 * 60 * 24))
            },
            prioridad: 'alta'
        });
    }

    // ==========================================
    // ALERTAS MASIVAS Y AUTOMATIZADAS
    // ==========================================
    
    static async ejecutarAlertasAutomaticas() {
        try {
            console.log('Iniciando ejecución de alertas automáticas de ventas...');
            
            // 1. Detectar metas en riesgo
            await this._procesarMetasEnRiesgo();
            
            // 2. Detectar cotizaciones próximas a vencer
            await this._procesarCotizacionesProximasVencer();
            
            // 3. Detectar seguimientos post-venta vencidos
            await this._procesarSeguimientosVencidos();
            
            // 4. Detectar ventas estancadas
            await this._procesarVentasEstancadas();
            
            // 5. Generar alertas de rendimiento
            await this._procesarAlertasRendimiento();
            
            console.log('Alertas automáticas de ventas ejecutadas exitosamente');
            
        } catch (error) {
            console.error('Error ejecutando alertas automáticas:', error);
        }
    }
    
    // ✅ CORREGIDO: Sintaxis PostgreSQL en lugar de MySQL
    static async _procesarMetasEnRiesgo() {
        try {
            const { data: metasRiesgo } = await query.execute(
                `SELECT 
                    m.*,
                    u.nombre, u.apellido,
                    u.rol_id as supervisor_id,
                    COALESCE(p.valor_actual, 0) as valor_actual
                 FROM metas_ventas m
                 JOIN usuarios u ON m.asesor_id = u.id
                 LEFT JOIN (
                     SELECT 
                         asesor_id,
                         SUM(CASE WHEN 'Ventas_Valor' = 'Ventas_Valor' THEN valor_total ELSE 1 END) as valor_actual
                     FROM ventas 
                     WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
                       AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                       AND estado NOT IN ('Cancelada')
                     GROUP BY asesor_id
                 ) p ON m.asesor_id = p.asesor_id
                 WHERE m.activo = true
                   AND m.fecha_fin >= CURRENT_DATE
                   AND (m.fecha_fin - CURRENT_DATE) <= 7
                   AND (COALESCE(p.valor_actual, 0) / m.valor_objetivo) < 0.7`
            );
            
            for (const meta of metasRiesgo || []) {
                // Formatear nombre completo
                const asesorNombreCompleto = meta.nombre && meta.apellido 
                    ? `${meta.nombre} ${meta.apellido}`.trim()
                    : meta.nombre || 'Sin nombre';
                    
                await this.notificarMetaEnRiesgo(
                    { 
                        id: meta.asesor_id, 
                        nombre: meta.nombre,
                        apellido: meta.apellido,
                        asesor_nombre_completo: asesorNombreCompleto,
                        supervisor_id: meta.supervisor_id 
                    },
                    meta,
                    { valor_actual: meta.valor_actual }
                );
            }
        } catch (error) {
            console.error('Error procesando metas en riesgo:', error);
        }
    }
    
    // ✅ CORREGIDO: Sintaxis PostgreSQL
    static async _procesarCotizacionesProximasVencer() {
        try {
            const { data: cotizacionesVencen } = await query.execute(
                `SELECT c.*, v.asesor_id, v.cliente_nombre
                 FROM cotizaciones c
                 JOIN ventas v ON c.venta_id = v.id
                 WHERE c.estado = 'Enviada'
                   AND c.fecha_vencimiento <= CURRENT_DATE + INTERVAL '2 days'
                   AND c.fecha_vencimiento >= CURRENT_DATE`
            );
            
            for (const cotizacion of cotizacionesVencen || []) {
                await this.enviarNotificacion({
                    tipo: 'cotizacion_proxima_vencer',
                    usuario_id: cotizacion.asesor_id,
                    datos: {
                        cotizacion_id: cotizacion.id,
                        numero_cotizacion: cotizacion.numero_cotizacion,
                        cliente: cotizacion.cliente_nombre,
                        valor_total: cotizacion.valor_total,
                        fecha_vencimiento: cotizacion.fecha_vencimiento
                    },
                    prioridad: 'alta'
                });
            }
        } catch (error) {
            console.error('Error procesando cotizaciones próximas a vencer:', error);
        }
    }

    // ✅ MÉTODOS AUXILIARES COMPLETADOS
    static async _procesarSeguimientosVencidos() {
        try {
            const { data: seguimientosVencidos } = await query.execute(
                `SELECT * FROM seguimientos 
                 WHERE fecha_programada < CURRENT_DATE 
                   AND estado = 'Programado'
                 LIMIT 50`
            );
            
            for (const seguimiento of seguimientosVencidos || []) {
                await this.notificarSeguimientoVencido(seguimiento);
            }
        } catch (error) {
            console.log('Error procesando seguimientos vencidos:', error.message);
        }
    }

    static async _procesarVentasEstancadas() {
        try {
            const { data: ventasEstancadas } = await query.execute(
                `SELECT v.*, u.id as asesor_id
                 FROM ventas v
                 JOIN usuarios u ON v.asesor_id = u.id
                 WHERE v.estado IN ('Prospecto', 'Contactado', 'Negociacion')
                   AND v.updated_at < CURRENT_DATE - INTERVAL '7 days'
                 LIMIT 20`
            );
            
            for (const venta of ventasEstancadas || []) {
                await this.enviarNotificacion({
                    tipo: 'venta_estancada',
                    usuario_id: venta.asesor_id,
                    datos: {
                        venta_id: venta.id,
                        codigo_venta: venta.codigo_venta,
                        cliente: venta.cliente_nombre,
                        estado: venta.estado,
                        dias_estancada: Math.ceil((new Date() - new Date(venta.updated_at)) / (1000 * 60 * 60 * 24))
                    },
                    prioridad: 'media'
                });
            }
        } catch (error) {
            console.log('Error procesando ventas estancadas:', error.message);
        }
    }

    static async _procesarAlertasRendimiento() {
        try {
            const { data: bajosRendimientos } = await query.execute(
                `SELECT 
                    u.id, u.nombre, u.apellido,
                    COUNT(v.id) as ventas_mes,
                    COALESCE(SUM(v.valor_total), 0) as valor_total_mes
                 FROM usuarios u
                 LEFT JOIN ventas v ON u.id = v.asesor_id 
                   AND v.created_at >= DATE_TRUNC('month', CURRENT_DATE)
                   AND v.estado NOT IN ('Cancelada')
                 WHERE u.activo = true 
                   AND u.rol_id IN (SELECT id FROM roles WHERE nombre IN ('asesor', 'vendedor'))
                 GROUP BY u.id, u.nombre, u.apellido
                 HAVING COUNT(v.id) < 3
                 LIMIT 10`
            );
            
            for (const usuario of bajosRendimientos || []) {
                await this.enviarNotificacion({
                    tipo: 'alerta_bajo_rendimiento',
                    usuario_id: usuario.id,
                    datos: {
                        ventas_mes: usuario.ventas_mes,
                        valor_total_mes: usuario.valor_total_mes,
                        meta_minima: 3
                    },
                    prioridad: 'media'
                });
            }
        } catch (error) {
            console.log('Error procesando alertas de rendimiento:', error.message);
        }
    }

    // Métodos auxiliares para estados específicos de ventas
    static async _notificarVentaAprobada(venta) {
        await this.enviarNotificacion({
            tipo: 'venta_aprobada',
            usuario_id: venta.asesor_id,
            datos: {
                venta_id: venta.id,
                codigo_venta: venta.codigo_venta,
                cliente: venta.cliente_nombre,
                valor_total: venta.valor_total
            },
            prioridad: 'alta'
        });
    }

    static async _notificarVentaFacturada(venta) {
        await this.enviarNotificacion({
            tipo: 'venta_facturada',
            usuario_id: venta.asesor_id,
            datos: {
                venta_id: venta.id,
                codigo_venta: venta.codigo_venta,
                cliente: venta.cliente_nombre,
                valor_total: venta.valor_total
            },
            prioridad: 'media'
        });
    }

    static async _notificarVentaCancelada(venta) {
        await this.enviarNotificacion({
            tipo: 'venta_cancelada',
            usuario_id: venta.asesor_id,
            datos: {
                venta_id: venta.id,
                codigo_venta: venta.codigo_venta,
                cliente: venta.cliente_nombre,
                valor_total: venta.valor_total,
                razon_cancelacion: venta.razon_cancelacion || 'No especificada'
            },
            prioridad: 'alta'
        });
    }

    // ==========================================
    // GENERACIÓN DE CONTENIDO DE NOTIFICACIONES
    // ==========================================
    
    static async _generarContenidoNotificacion(tipo, datos, usuario) {
        const plantillas = {
            nueva_venta_creada: {
                titulo: '🎉 Nueva Venta Registrada',
                mensaje: `¡Felicitaciones! Has registrado una nueva venta:\n\n` +
                        `📋 Código: ${datos.codigo_venta}\n` +
                        `👤 Cliente: ${datos.cliente}\n` +
                        `💰 Valor: $${this._formatearMoneda(datos.valor_total)}\n` +
                        `📦 Producto: ${datos.producto}`
            },
            
            venta_alta_valor: {
                titulo: '🔥 Venta de Alto Valor Registrada',
                mensaje: `Se ha registrado una venta de alto valor:\n\n` +
                        `👨‍💼 Asesor: ${datos.asesor}\n` +
                        `📋 Código: ${datos.codigo_venta}\n` +
                        `👤 Cliente: ${datos.cliente}\n` +
                        `💰 Valor: $${this._formatearMoneda(datos.valor_total)}`
            },
            
            cambio_estado_venta: {
                titulo: '🔄 Cambio de Estado en Venta',
                mensaje: `La venta ${datos.codigo_venta} ha cambiado de estado:\n\n` +
                        `📋 Código: ${datos.codigo_venta}\n` +
                        `👤 Cliente: ${datos.cliente}\n` +
                        `📊 Estado anterior: ${datos.estado_anterior}\n` +
                        `📊 Estado actual: ${datos.estado_nuevo}\n` +
                        `💰 Valor: $${this._formatearMoneda(datos.valor_total)}`
            },
            
            meta_en_riesgo: {
                titulo: '⚠️ Meta en Riesgo',
                mensaje: `Tu meta mensual está en riesgo de no cumplirse:\n\n` +
                        `🎯 Tipo: ${datos.tipo_meta}\n` +
                        `📊 Progreso: ${datos.porcentaje_avance}%\n` +
                        `💰 Objetivo: $${this._formatearMoneda(datos.valor_objetivo)}\n` +
                        `💰 Actual: $${this._formatearMoneda(datos.valor_actual)}\n` +
                        `📅 Días restantes: ${datos.dias_restantes}`
            },
            
            comision_calculada: {
                titulo: '💰 Comisión Calculada',
                mensaje: `Tu comisión ha sido calculada:\n\n` +
                        `📊 Cumplimiento: ${datos.porcentaje_cumplimiento}%\n` +
                        `💰 Comisión: $${this._formatearMoneda(datos.bono_usd)}\n` +
                        `📅 Período: ${datos.periodo}`
            },
            
            cotizacion_vencida: {
                titulo: '⏰ Cotización Vencida',
                mensaje: `Una cotización ha vencido sin respuesta:\n\n` +
                        `📋 Número: ${datos.numero_cotizacion}\n` +
                        `👤 Cliente: ${datos.cliente}\n` +
                        `💰 Valor: $${this._formatearMoneda(datos.valor_total)}\n` +
                        `📅 Días vencida: ${datos.dias_vencida}`
            },
            
            seguimiento_post_venta_vencido: {
                titulo: '📞 Seguimiento Post-Venta Vencido',
                mensaje: `Tienes un seguimiento post-venta vencido:\n\n` +
                        `📋 Venta: ${datos.venta_codigo}\n` +
                        `👤 Cliente: ${datos.cliente}\n` +
                        `📋 Tipo: ${datos.tipo_seguimiento}\n` +
                        `📅 Días vencido: ${datos.dias_vencido}`
            },

            venta_estancada: {
                titulo: '⏳ Venta Estancada',
                mensaje: `Una venta lleva varios días sin progreso:\n\n` +
                        `📋 Código: ${datos.codigo_venta}\n` +
                        `👤 Cliente: ${datos.cliente}\n` +
                        `📊 Estado: ${datos.estado}\n` +
                        `📅 Días estancada: ${datos.dias_estancada}\n` +
                        `💡 Considera hacer seguimiento pronto`
            },

            alerta_bajo_rendimiento: {
                titulo: '📊 Alerta de Rendimiento',
                mensaje: `Tu rendimiento del mes está por debajo del promedio:\n\n` +
                        `📈 Ventas realizadas: ${datos.ventas_mes}\n` +
                        `🎯 Meta mínima: ${datos.meta_minima} ventas\n` +
                        `💰 Valor total: $${this._formatearMoneda(datos.valor_total_mes)}\n` +
                        `💪 ¡Aún tienes tiempo para mejorar!`
            }
        };
        
        return plantillas[tipo] || null;
    }

    // ==========================================
    // MÉTODOS DE ENVÍO POR CANAL
    // ==========================================
    
    static async _enviarNotificacionEmail(usuario, contenido) {
        try {
            const transporter = await this._getEmailTransporter();
            
            const mailOptions = {
                from: `"Sistema CRM/ERP" <${process.env.SMTP_FROM}>`,
                to: usuario.email,
                subject: contenido.titulo,
                html: this._generarHTMLEmail(contenido, usuario),
                priority: 'normal'
            };
            
            await transporter.sendMail(mailOptions);
            return true;
            
        } catch (error) {
            console.error('Error enviando email:', error);
            return false;
        }
    }
    
    // ✅ CORREGIDO: Usar campo correcto notificacion_id
    static async _enviarNotificacionApp(usuario, contenido, notificacion_id) {
        try {
            // Crear notificación en la aplicación
            await query.execute(
                `INSERT INTO notificaciones_app 
                 (usuario_id, notificacion_id, titulo, mensaje, leida, fecha_creacion)
                 VALUES ($1, $2, $3, $4, false, NOW())`,
                [usuario.id, notificacion_id, contenido.titulo, contenido.mensaje]
            );
            
            return true;
            
        } catch (error) {
            console.error('Error enviando notificación app:', error);
            return false;
        }
    }
    
    static async _enviarNotificacionSMS(usuario, contenido) {
        try {
            // Implementar integración con servicio SMS (Twilio, etc.)
            console.log(`SMS a ${usuario.telefono}: ${contenido.titulo}`);
            return true;
            
        } catch (error) {
            console.error('Error enviando SMS:', error);
            return false;
        }
    }

    // ==========================================
    // MÉTODOS AUXILIARES
    // ==========================================
    
    static _esDentroDeHorarioPermitido(horarioConfig) {
        if (!horarioConfig) return true;
        
        try {
            const config = typeof horarioConfig === 'string' ? JSON.parse(horarioConfig) : horarioConfig;
            const ahora = new Date();
            const horaActual = ahora.getHours();
            
            return horaActual >= (config.hora_inicio || 8) && horaActual <= (config.hora_fin || 20);
            
        } catch (error) {
            return true; // Si hay error en configuración, permitir envío
        }
    }
    
    static async _programarNotificacionPosterior(params, usuario) {
        const mañana8AM = new Date();
        mañana8AM.setDate(mañana8AM.getDate() + 1);
        mañana8AM.setHours(8, 0, 0, 0);
        
        await query.execute(
            `INSERT INTO notificaciones_programadas 
             (usuario_id, tipo, datos, fecha_programada, estado)
             VALUES ($1, $2, $3, $4, 'Programada')`,
            [params.usuario_id, params.tipo, JSON.stringify(params.datos), mañana8AM]
        );
    }
    
    static _formatearMoneda(valor) {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 0
        }).format(valor).replace('PEN', '').trim();
    }
    
    static _generarHTMLEmail(contenido, usuario) {
        // Formatear nombre completo del usuario
        const usuarioNombreCompleto = usuario.nombre && usuario.apellido 
            ? `${usuario.nombre} ${usuario.apellido}`.trim()
            : usuario.nombre || 'Usuario';
            
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${contenido.titulo}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>${contenido.titulo}</h2>
                </div>
                <div class="content">
                    <p>Hola ${usuarioNombreCompleto},</p>
                    <p>${contenido.mensaje.replace(/\n/g, '<br>')}</p>
                </div>
                <div class="footer">
                    <p>Sistema CRM/ERP - Módulo de Ventas</p>
                    <p>Este es un mensaje automático, no responder a este email.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = NotificacionesVentasService;