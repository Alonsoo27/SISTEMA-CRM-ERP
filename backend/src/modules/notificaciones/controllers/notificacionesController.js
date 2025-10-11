const { query } = require('../../../config/database');
const winston = require('winston');

// ✅ IMPORTAR SISTEMA DE ROLES
const { ROLES, GRUPOS_ROLES, esEjecutivo, esJefe, esJefeOEjecutivo, tienePermiso } = require('../../../config/roles');

// Función para obtener fecha Peru
const obtenerFechaPeruISO = () => {
    const ahora = new Date();
    const offsetPeru = -5 * 60; // -5 horas en minutos
    const fechaPeru = new Date(ahora.getTime() + (offsetPeru * 60 * 1000));
    return fechaPeru.toISOString();
};

// Logger unificado
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'notificaciones-superior' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/notificaciones.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

class NotificacionesController {

    /**
     * 🔐 VALIDAR SI UN USUARIO PERTENECE AL EQUIPO DE UN JEFE
     * @param {number} jefeId - ID del jefe
     * @param {number} usuarioId - ID del usuario a validar
     * @returns {Promise<boolean>} - true si pertenece al equipo
     */
    static async validarUsuarioEnEquipo(jefeId, usuarioId) {
        try {
            // Si es el mismo usuario, siempre es válido
            if (parseInt(jefeId) === parseInt(usuarioId)) {
                return true;
            }

            // Buscar si el usuario reporta directamente al jefe
            const result = await query(`
                SELECT u.id, u.jefe_id, u.rol_id, r.nombre as rol_nombre
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE u.id = $1 AND u.activo = true
            `, [usuarioId]);

            if (!result.rows || result.rows.length === 0) {
                return false;
            }

            const usuario = result.rows[0];

            // Validar si el usuario reporta al jefe directamente
            if (usuario.jefe_id && parseInt(usuario.jefe_id) === parseInt(jefeId)) {
                return true;
            }

            // TODO: Validar jerarquías indirectas si es necesario
            // Por ahora solo validamos reporte directo

            return false;

        } catch (error) {
            logger.error(`Error validando equipo: jefeId=${jefeId}, usuarioId=${usuarioId}`, error);
            return false;
        }
    }

    /**
     * 🚀 MÉTODO SUPERIOR UNIFICADO para crear notificaciones
     * Reemplaza múltiples métodos por uno flexible con opciones
     * 
     * @param {Object} opciones - Configuración de la notificación
     * @param {string} opciones.tipo - 'seguimiento_vencido' | 'manual' | 'sistema' | 'marketing'
     * @param {string} opciones.modo - 'basico' | 'inteligente' | 'masivo'
     * @param {Array} opciones.usuarios - Lista de IDs de usuarios (para modo masivo)
     * @param {Object} opciones.data - Datos específicos de la notificación
     * @param {Object} opciones.configuracion - Configuración adicional
     */
    static async crearNotificaciones(opciones = {}) {
        try {
            const {
                tipo = 'manual',
                modo = 'basico',
                usuarios = [],
                data = {},
                configuracion = {},
                auto_prioridad = true,
                incluir_metadatos = true,
                validar_duplicados = true
            } = opciones;

            const fechaActual = obtenerFechaPeruISO();
            const resultados = [];
            let creadas = 0;
            let errores = 0;
            let duplicados_evitados = 0;

            logger.info(`🔔 Creando notificaciones (${modo}): tipo=${tipo}, usuarios=${usuarios.length || 1}`);

            // VALIDACIONES INTELIGENTES
            if (!data.titulo && !data.mensaje) {
                throw new Error('Se requiere al menos título o mensaje');
            }

            // CONFIGURACIÓN AUTOMÁTICA DE PRIORIDAD (si está habilitada)
            let prioridadCalculada = data.prioridad || 'normal';
            
            if (auto_prioridad) {
                prioridadCalculada = this.calcularPrioridadInteligente({
                    tipo,
                    valor_estimado: data.valor_estimado,
                    horas_vencidas: data.horas_vencidas,
                    numero_reintentos: data.numero_reintentos,
                    es_cliente_premium: data.es_cliente_premium
                });
            }

            // DETERMINAR LISTA DE USUARIOS
            let usuariosObjetivo = [];
            
            if (modo === 'masivo' && usuarios.length > 0) {
                usuariosObjetivo = usuarios;
            } else if (data.usuario_id) {
                usuariosObjetivo = [data.usuario_id];
            } else {
                throw new Error('Se requiere especificar usuario(s) para la notificación');
            }

            // PROCESAMIENTO POR USUARIO
            for (const userId of usuariosObjetivo) {
                try {
                    // VALIDAR DUPLICADOS (si está habilitado)
                    if (validar_duplicados && tipo !== 'manual') {
                        const duplicado = await this.verificarDuplicado(userId, tipo, data.prospecto_id, fechaActual);
                        
                        if (duplicado) {
                            duplicados_evitados++;
                            logger.info(`⚠️ Duplicado evitado: usuario ${userId}, tipo ${tipo}`);
                            continue;
                        }
                    }

                    // CONSTRUIR NOTIFICACIÓN
                    const notificacion = {
                        usuario_id: userId,
                        tipo: tipo,
                        titulo: this.generarTituloInteligente(data, tipo, modo),
                        mensaje: this.generarMensajeInteligente(data, tipo, modo),
                        prioridad: prioridadCalculada,
                        prospecto_id: data.prospecto_id || null,
                        accion_url: this.generarUrlAccion(data, tipo),
                        accion_texto: this.generarTextoAccion(tipo, prioridadCalculada),
                        created_at: fechaActual,
                        expira_en: this.calcularExpiracion(tipo, prioridadCalculada),
                        
                        // METADATOS INTELIGENTES (si están habilitados)
                        ...(incluir_metadatos ? {
                            datos_adicionales: JSON.stringify({
                                ...data,
                                generacion: {
                                    modo_usado: modo,
                                    auto_prioridad: auto_prioridad,
                                    timestamp: fechaActual,
                                    version: '2.0'
                                }
                            })
                        } : {})
                    };

                    // INSERTAR EN BASE DE DATOS
                    const insertQuery = `
                        INSERT INTO notificaciones (
                            usuario_id, tipo, titulo, mensaje, prioridad, prospecto_id,
                            accion_url, accion_texto, created_at, expira_en, datos_adicionales
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        RETURNING *
                    `;

                    const insertValues = [
                        notificacion.usuario_id, notificacion.tipo, notificacion.titulo,
                        notificacion.mensaje, notificacion.prioridad, notificacion.prospecto_id,
                        notificacion.accion_url, notificacion.accion_texto, notificacion.created_at,
                        notificacion.expira_en, notificacion.datos_adicionales
                    ];

                    const result = await query(insertQuery, insertValues);
                    
                    if (!result.rows || result.rows.length === 0) {
                        throw new Error('Notificación no creada');
                    }

                    const notifCreada = result.rows[0];

                    resultados.push({
                        id: notifCreada.id,
                        usuario_id: userId,
                        tipo: tipo,
                        prioridad: prioridadCalculada,
                        status: 'success'
                    });

                    creadas++;
                    logger.info(`✅ Notificación creada: ID ${notifCreada.id} para usuario ${userId}`);

                } catch (userError) {
                    errores++;
                    resultados.push({
                        usuario_id: userId,
                        tipo: tipo,
                        status: 'error',
                        error: userError.message
                    });
                    logger.error(`❌ Error creando notificación para usuario ${userId}:`, userError);
                }
            }

            // ESTADÍSTICAS FINALES
            const estadisticas = {
                total_usuarios: usuariosObjetivo.length,
                creadas: creadas,
                errores: errores,
                duplicados_evitados: duplicados_evitados,
                tasa_exito: usuariosObjetivo.length > 0 ? 
                    ((creadas / usuariosObjetivo.length) * 100).toFixed(1) + '%' : '0%',
                modo_usado: modo,
                tipo_usado: tipo,
                timestamp: fechaActual
            };

            logger.info(`📊 Proceso completado:`, estadisticas);

            return {
                success: true,
                data: resultados,
                estadisticas: estadisticas,
                message: `Proceso completado: ${creadas} notificaciones creadas, ${errores} errores`
            };

        } catch (error) {
            logger.error('❌ Error en crearNotificaciones unificado:', error);
            return {
                success: false,
                error: error.message,
                estadisticas: {
                    total_usuarios: 0,
                    creadas: 0,
                    errores: 1
                }
            };
        }
    }

    /**
     * 🧠 SISTEMA INTELIGENTE DE PRIORIDADES
     */
    static calcularPrioridadInteligente(datos) {
        const {
            tipo,
            valor_estimado = 0,
            horas_vencidas = 0,
            numero_reintentos = 0,
            es_cliente_premium = false
        } = datos;

        let puntos = 0;

        // Puntos por tipo
        const puntosPorTipo = {
            // Seguimientos
            'seguimiento_vencido': 30,
            'seguimiento_urgente': 50,
            'seguimiento_critico': 80,
            'seguimiento_completado': 15,
            'seguimiento_proximo': 25,

            // Prospectos
            'prospecto_creado': 20,
            'prospecto_reasignado': 35,
            'prospecto_eliminado': 30,
            'prospecto_libre_activado': 40,

            // Estados y ventas
            'estado_cotizado': 30,
            'estado_negociacion': 45,
            'venta_cerrada': 70,
            'venta_perdida': 60,
            'conversion_exitosa': 65,

            // Alertas
            'oportunidad_alta': 40,
            'alerta_reasignaciones': 75,
            'meta_alcanzada': 30,

            // Sistema
            'cliente_insatisfecho': 70,
            'sistema': 20,
            'marketing': 10,
            'manual': 25
        };

        puntos += puntosPorTipo[tipo] || 25;

        // Puntos por valor estimado
        if (valor_estimado >= 2000) puntos += 30;
        else if (valor_estimado >= 1000) puntos += 20;
        else if (valor_estimado >= 100) puntos += 10;

        // Puntos por tiempo vencido
        if (horas_vencidas >= 72) puntos += 25; // 3+ días
        else if (horas_vencidas >= 48) puntos += 20; // 2+ días
        else if (horas_vencidas >= 24) puntos += 15; // 1+ día

        // Puntos por reintentos
        puntos += Math.min(numero_reintentos * 5, 20);

        // Bonus cliente premium
        if (es_cliente_premium) puntos += 15;

        // Determinar prioridad final
        if (puntos >= 80) return 'critica';
        if (puntos >= 60) return 'alta';
        if (puntos >= 40) return 'media';
        return 'normal';
    }

    /**
     * 🎯 GENERADORES INTELIGENTES DE CONTENIDO
     */
    static generarTituloInteligente(data, tipo, modo) {
        if (data.titulo) return data.titulo;

        const plantillas = {
            // Seguimientos
            'seguimiento_vencido': data.horas_vencidas > 48 ?
                `🚨 Seguimiento CRÍTICO - ${data.nombre_cliente || 'Cliente'}` :
                `⏰ Seguimiento vencido - ${data.nombre_cliente || 'Cliente'}`,
            'seguimiento_urgente': `🔥 URGENTE: ${data.nombre_cliente || 'Cliente'} requiere atención`,
            'seguimiento_critico': `🚨 CRÍTICO: ${data.nombre_cliente || 'Cliente'} - ${data.horas_vencidas}h sin contacto`,
            'seguimiento_completado': `✅ Seguimiento completado: ${data.nombre_cliente || 'Cliente'}`,
            'seguimiento_proximo': `📅 Seguimiento próximo: ${data.nombre_cliente || 'Cliente'} en 24h`,

            // Prospectos
            'prospecto_creado': `🎯 Nuevo prospecto asignado: ${data.nombre_cliente || 'Cliente'}`,
            'prospecto_reasignado': `🔄 Prospecto reasignado: ${data.nombre_cliente || 'Cliente'}`,
            'prospecto_eliminado': `🗑️ Prospecto eliminado: ${data.nombre_cliente || data.codigo || 'Prospecto'}`,
            'prospecto_libre_activado': `🆓 Modo libre activado: ${data.nombre_cliente || 'Cliente'}`,

            // Estados y ventas
            'estado_cotizado': `📋 Cotización enviada: ${data.nombre_cliente || 'Cliente'}`,
            'estado_negociacion': `💼 En negociación: ${data.nombre_cliente || 'Cliente'}`,
            'venta_cerrada': `🎉 ¡Venta cerrada! ${data.nombre_cliente || 'Cliente'} - $${data.valor_estimado?.toLocaleString()}`,
            'venta_perdida': `💔 Venta perdida: ${data.nombre_cliente || 'Cliente'} ($${data.valor_estimado?.toLocaleString()})`,
            'conversion_exitosa': `🚀 Conversión exitosa: ${data.nombre_cliente || 'Cliente'} → Venta`,

            // Alertas
            'oportunidad_alta': `💰 Oportunidad de alto valor: $${data.valor_estimado?.toLocaleString()}`,
            'alerta_reasignaciones': `⚠️ ALERTA: ${data.nombre_cliente || 'Prospecto'} - ${data.numero_reasignaciones}+ reasignaciones`,
            'meta_alcanzada': `🏆 ¡Meta alcanzada! ${data.meta_nombre || 'Objetivo cumplido'}`,

            // Sistema
            'sistema': `ℹ️ Actualización del sistema`,
            'marketing': `📢 ${data.titulo || 'Nueva promoción disponible'}`,
            'manual': data.titulo || `📝 Notificación importante`
        };

        return plantillas[tipo] || `📋 Notificación: ${tipo}`;
    }

    static generarMensajeInteligente(data, tipo, modo) {
        if (data.mensaje) return data.mensaje;

        const mensajes = {
            // Seguimientos
            'seguimiento_vencido': `${data.nombre_cliente || 'El cliente'} lleva ${data.horas_vencidas || 0}h sin seguimiento. Valor estimado: $${data.valor_estimado?.toLocaleString() || 0}`,
            'seguimiento_urgente': `${data.nombre_cliente || 'El cliente'} requiere contacto inmediato. Han pasado ${data.horas_vencidas || 0}h desde el último seguimiento.`,
            'seguimiento_critico': `ATENCIÓN INMEDIATA: ${data.nombre_cliente || 'Cliente'} sin contacto por ${data.horas_vencidas || 0}h. Riesgo de pérdida alto.`,
            'seguimiento_completado': `Seguimiento completado exitosamente con ${data.nombre_cliente || 'el cliente'}. Resultado: ${data.resultado || 'Positivo'}.`,
            'seguimiento_proximo': `Tienes un seguimiento programado con ${data.nombre_cliente || 'cliente'} en las próximas 24 horas. ¡Prepárate!`,

            // Prospectos
            'prospecto_creado': `Se te ha asignado un nuevo prospecto: ${data.codigo || 'N/A'}. Cliente: ${data.nombre_cliente || 'No especificado'}. Canal: ${data.canal_contacto || 'N/A'}. Valor estimado: $${data.valor_estimado?.toLocaleString() || 0}`,
            'prospecto_reasignado': `El prospecto ${data.codigo || 'N/A'} ha sido reasignado a ti. ${data.motivo_reasignacion ? 'Motivo: ' + data.motivo_reasignacion : ''} Asesor anterior: ${data.asesor_anterior || 'No especificado'}.`,
            'prospecto_eliminado': `El prospecto ${data.codigo || 'N/A'} (${data.nombre_cliente || 'Cliente'}) ha sido eliminado del sistema. ${data.motivo_eliminacion ? 'Motivo: ' + data.motivo_eliminacion : ''}`,
            'prospecto_libre_activado': `El prospecto ${data.nombre_cliente || 'Cliente'} ahora está en modo libre. Cualquier asesor puede trabajarlo. Actúa rápido para no perder la oportunidad.`,

            // Estados y ventas
            'estado_cotizado': `Se ha enviado cotización a ${data.nombre_cliente || 'el cliente'} por $${data.valor_estimado?.toLocaleString() || 0}. Realiza seguimiento en las próximas 48h.`,
            'estado_negociacion': `${data.nombre_cliente || 'El cliente'} está en negociación. Valor: $${data.valor_estimado?.toLocaleString() || 0}. Probabilidad de cierre: ${data.probabilidad_cierre || 50}%. ¡Es momento de cerrar!`,
            'venta_cerrada': `¡Felicitaciones! Venta cerrada con ${data.nombre_cliente || 'cliente'} por $${data.valor_estimado?.toLocaleString() || 0}. ${data.comision ? 'Comisión estimada: $' + data.comision.toLocaleString() : ''}`,
            'venta_perdida': `La venta con ${data.nombre_cliente || 'el cliente'} se ha perdido. Valor: $${data.valor_estimado?.toLocaleString() || 0}. ${data.motivo_perdida ? 'Motivo: ' + data.motivo_perdida : 'Revisar para mejoras futuras.'}`,
            'conversion_exitosa': `El prospecto ${data.nombre_cliente || 'cliente'} se convirtió automáticamente en venta. Código de venta: ${data.venta_codigo || 'N/A'}. Valor: $${data.valor_estimado?.toLocaleString() || 0}`,

            // Alertas
            'oportunidad_alta': `Nueva oportunidad de alto valor detectada. Cliente: ${data.nombre_cliente || 'No especificado'}. Valor estimado: $${data.valor_estimado?.toLocaleString() || 0}. Canal: ${data.canal_contacto || 'N/A'}`,
            'alerta_reasignaciones': `ATENCIÓN: El prospecto ${data.nombre_cliente || 'cliente'} ha sido reasignado ${data.numero_reasignaciones || 0} veces. Revisar estrategia de asignación y contacto.`,
            'meta_alcanzada': `¡Felicitaciones! Has alcanzado tu meta de ${data.meta_nombre || 'ventas'}. ${data.meta_detalle || 'Sigue así para mantener el rendimiento.'}`,

            // Sistema
            'sistema': data.mensaje || 'El sistema ha generado una actualización importante.',
            'marketing': data.mensaje || 'Nueva campaña de marketing disponible para tus clientes.',
            'manual': data.mensaje || 'Notificación creada manualmente.'
        };

        return mensajes[tipo] || `Notificación de tipo: ${tipo}`;
    }

    static generarUrlAccion(data, tipo) {
        if (data.accion_url) return data.accion_url;

        const urls = {
            // Seguimientos
            'seguimiento_vencido': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?tab=seguimientos',
            'seguimiento_urgente': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos',
            'seguimiento_critico': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos',
            'seguimiento_completado': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?tab=historial',
            'seguimiento_proximo': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?tab=seguimientos',

            // Prospectos
            'prospecto_creado': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos',
            'prospecto_reasignado': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos',
            'prospecto_eliminado': '/prospectos?tab=eliminados',
            'prospecto_libre_activado': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?filtro=modo_libre',

            // Estados y ventas
            'estado_cotizado': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?estado=Cotizado',
            'estado_negociacion': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?estado=Negociacion',
            'venta_cerrada': data.venta_id ? `/ventas/${data.venta_id}` : '/ventas',
            'venta_perdida': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/reportes/ventas-perdidas',
            'conversion_exitosa': data.venta_id ? `/ventas/${data.venta_id}` : '/ventas',

            // Alertas
            'oportunidad_alta': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?filtro=alto_valor',
            'alerta_reasignaciones': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?filtro=multiples_reasignaciones',
            'meta_alcanzada': '/dashboard/metas',

            // Sistema
            'sistema': '/configuracion',
            'marketing': '/marketing/campanas',
            'manual': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/dashboard'
        };

        return urls[tipo] || '/dashboard';
    }

    static generarTextoAccion(tipo, prioridad) {
        const acciones = {
            // Seguimientos
            'seguimiento_vencido': prioridad === 'critica' ? 'CONTACTAR AHORA' : 'Ver prospecto',
            'seguimiento_urgente': 'ATENDER INMEDIATAMENTE',
            'seguimiento_critico': 'ACCIÓN URGENTE',
            'seguimiento_completado': 'Ver detalles',
            'seguimiento_proximo': 'Preparar seguimiento',

            // Prospectos
            'prospecto_creado': 'Ver nuevo prospecto',
            'prospecto_reasignado': 'Revisar prospecto',
            'prospecto_eliminado': 'Ver historial',
            'prospecto_libre_activado': 'Tomar prospecto',

            // Estados y ventas
            'estado_cotizado': 'Ver cotización',
            'estado_negociacion': 'Continuar negociación',
            'venta_cerrada': 'Ver venta',
            'venta_perdida': 'Revisar caso',
            'conversion_exitosa': 'Ver venta creada',

            // Alertas
            'oportunidad_alta': 'Ver oportunidad',
            'alerta_reasignaciones': 'REVISAR URGENTE',
            'meta_alcanzada': 'Ver estadísticas',

            // Sistema
            'sistema': 'Ver detalles',
            'marketing': 'Ver campaña',
            'manual': 'Ver más'
        };

        return acciones[tipo] || 'Ver más';
    }

    static calcularExpiracion(tipo, prioridad) {
        const ahora = new Date();
        let diasExpiracion = 7; // Default

        if (prioridad === 'critica') diasExpiracion = 3;
        else if (prioridad === 'alta') diasExpiracion = 5;
        else if (tipo === 'marketing') diasExpiracion = 14;

        return new Date(ahora.getTime() + diasExpiracion * 24 * 60 * 60 * 1000).toISOString();
    }

    static async verificarDuplicado(userId, tipo, prospectoId, fechaActual) {
        const hoyInicio = new Date(fechaActual);
        hoyInicio.setHours(0, 0, 0, 0);

        let sqlQuery = `
            SELECT id FROM notificaciones 
            WHERE usuario_id = $1 AND tipo = $2 AND created_at >= $3
        `;
        let params = [userId, tipo, hoyInicio.toISOString()];

        if (prospectoId) {
            sqlQuery += ` AND prospecto_id = $4`;
            params.push(prospectoId);
        }

        sqlQuery += ` LIMIT 1`;

        const result = await query(sqlQuery, params);
        return result.rows.length > 0;
    }

    /**
     * 🎯 MÉTODOS DE CONVENIENCIA (wrappers para facilidad de uso)
     */
    static async notificarSeguimientoVencido(usuarioId, prospectoData) {
        return this.crearNotificaciones({
            tipo: 'seguimiento_vencido',
            modo: 'inteligente',
            data: {
                usuario_id: usuarioId,
                ...prospectoData
            },
            auto_prioridad: true,
            incluir_metadatos: true
        });
    }

    static async notificarOportunidadAltoValor(usuarioId, prospectoData) {
        return this.crearNotificaciones({
            tipo: 'oportunidad_alta',
            modo: 'inteligente',
            data: {
                usuario_id: usuarioId,
                ...prospectoData
            },
            auto_prioridad: true
        });
    }

    static async notificacionMasiva(usuarios, data, tipo = 'marketing') {
        return this.crearNotificaciones({
            tipo: tipo,
            modo: 'masivo',
            usuarios: usuarios,
            data: data,
            validar_duplicados: false // Para marketing masivo
        });
    }

    /**
     * GET /api/notificaciones/:usuarioId
     * Obtener notificaciones con opciones avanzadas
     * 🔐 CON VALIDACIÓN POR ROL
     */
    static async obtenerNotificaciones(req, res) {
        try {
            const { usuarioId } = req.params;
            const {
                limit = 20,
                offset = 0,
                solo_no_leidas = false,
                tipo = null,
                prioridad = null,
                incluir_estadisticas = false
            } = req.query;

            const usuarioLogueado = req.user;

            logger.info(`🔔 Obteniendo notificaciones para usuario ${usuarioId} - Solicitado por: ${usuarioLogueado?.user_id} (${usuarioLogueado?.rol})`);

            // 🔐 VALIDACIÓN POR ROL
            const rolUsuario = usuarioLogueado?.rol?.toUpperCase() || '';

            // Si NO es ejecutivo ni jefe, solo puede ver sus propias notificaciones
            if (!esEjecutivo(rolUsuario) && !esJefe(rolUsuario)) {
                if (parseInt(usuarioLogueado.user_id) !== parseInt(usuarioId)) {
                    logger.warn(`❌ Acceso denegado: Usuario ${usuarioLogueado.user_id} (${rolUsuario}) intentó ver notificaciones de usuario ${usuarioId}`);
                    return res.status(403).json({
                        success: false,
                        error: 'No tienes permiso para ver notificaciones de otros usuarios',
                        code: 'FORBIDDEN_ACCESS'
                    });
                }
            }

            // Si es JEFE (pero no ejecutivo), validar que el usuario pertenezca a su equipo
            if (esJefe(rolUsuario) && !esEjecutivo(rolUsuario)) {
                const perteneceEquipo = await this.validarUsuarioEnEquipo(
                    usuarioLogueado.user_id,
                    usuarioId
                );

                if (!perteneceEquipo) {
                    logger.warn(`❌ Acceso denegado: Jefe ${usuarioLogueado.user_id} intentó ver notificaciones de usuario ${usuarioId} que no pertenece a su equipo`);
                    return res.status(403).json({
                        success: false,
                        error: 'Solo puedes ver notificaciones de tu equipo',
                        code: 'FORBIDDEN_TEAM_ACCESS'
                    });
                }
            }

            // EJECUTIVOS: Pueden ver todo (no se valida nada adicional)
            if (esEjecutivo(rolUsuario)) {
                logger.info(`✅ Acceso ejecutivo: Usuario ${usuarioLogueado.user_id} puede ver notificaciones de cualquier usuario`);
            }

            // Construir query base
            let sqlQuery = `
                SELECT 
                    n.id, n.tipo, n.titulo, n.mensaje, n.prioridad, n.leida, 
                    n.prospecto_id, n.accion_url, n.accion_texto, n.datos_adicionales,
                    n.created_at, n.leida_en, n.expira_en,
                    p.codigo, p.nombre_cliente, p.telefono, p.valor_estimado, p.estado
                FROM notificaciones n
                LEFT JOIN prospectos p ON n.prospecto_id = p.id
                WHERE n.usuario_id = $1
                AND (n.expira_en IS NULL OR n.expira_en > $2)
            `;
            
            let params = [usuarioId, new Date().toISOString()];
            let paramIndex = 3;

            if (solo_no_leidas === 'true') {
                sqlQuery += ` AND n.leida = $${paramIndex}`;
                params.push(false);
                paramIndex++;
            }

            if (tipo) {
                sqlQuery += ` AND n.tipo = $${paramIndex}`;
                params.push(tipo);
                paramIndex++;
            }

            if (prioridad) {
                sqlQuery += ` AND n.prioridad = $${paramIndex}`;
                params.push(prioridad);
                paramIndex++;
            }

            sqlQuery += ` 
                ORDER BY 
                    CASE n.prioridad 
                        WHEN 'critica' THEN 4
                        WHEN 'alta' THEN 3
                        WHEN 'media' THEN 2
                        ELSE 1 
                    END DESC,
                    n.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;
            
            params.push(parseInt(limit), parseInt(offset));
            
            const result = await query(sqlQuery, params);
            const data = result.rows;

            // Formatear datos
            const notificacionesFormateadas = (data || []).map(notif => ({
                id: notif.id,
                titulo: notif.titulo,
                mensaje: notif.mensaje,
                tipo: notif.tipo,
                prioridad: notif.prioridad,
                leida: notif.leida,
                created_at: notif.created_at,
                leida_en: notif.leida_en,
                accion_url: notif.accion_url,
                accion_texto: notif.accion_texto,
                urgente: ['critica', 'alta'].includes(notif.prioridad),
                prospecto: notif.codigo ? {
                    id: notif.prospecto_id,
                    codigo: notif.codigo,
                    nombre_cliente: notif.nombre_cliente,
                    telefono: notif.telefono,
                    valor_estimado: notif.valor_estimado,
                    estado: notif.estado
                } : null,
                metadatos: notif.datos_adicionales ? JSON.parse(notif.datos_adicionales) : null
            }));

            let estadisticas = null;
            if (incluir_estadisticas === 'true') {
                estadisticas = await this.calcularEstadisticasUsuario(usuarioId);
            }

            res.json({
                success: true,
                data: notificacionesFormateadas,
                total: notificacionesFormateadas.length,
                total_no_leidas: notificacionesFormateadas.filter(n => !n.leida).length,
                estadisticas: estadisticas,
                meta: {
                    usuario_id: parseInt(usuarioId),
                    filtros_aplicados: { solo_no_leidas, tipo, prioridad },
                    timestamp: obtenerFechaPeruISO()
                }
            });
            
        } catch (error) {
            logger.error('Error obteniendo notificaciones:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener notificaciones: ' + error.message
            });
        }
    }

    /**
     * GET /api/notificaciones/contador/:usuarioId
     * Contador inteligente con desglose
     * 🔐 CON VALIDACIÓN POR ROL
     */
    static async obtenerContador(req, res) {
        try {
            const { usuarioId } = req.params;
            const { incluir_desglose = false } = req.query;

            const usuarioLogueado = req.user;
            const rolUsuario = usuarioLogueado?.rol?.toUpperCase() || '';

            logger.info(`📊 Obteniendo contador para usuario ${usuarioId} - Solicitado por: ${usuarioLogueado?.user_id} (${rolUsuario})`);

            // 🔐 VALIDACIÓN POR ROL (misma lógica que obtenerNotificaciones)

            // Si NO es ejecutivo ni jefe, solo puede ver su propio contador
            if (!esEjecutivo(rolUsuario) && !esJefe(rolUsuario)) {
                if (parseInt(usuarioLogueado.user_id) !== parseInt(usuarioId)) {
                    logger.warn(`❌ Acceso denegado: Usuario ${usuarioLogueado.user_id} (${rolUsuario}) intentó ver contador de usuario ${usuarioId}`);
                    return res.status(403).json({
                        success: false,
                        error: 'No tienes permiso para ver el contador de otros usuarios',
                        code: 'FORBIDDEN_ACCESS',
                        contador: 0
                    });
                }
            }

            // Si es JEFE (pero no ejecutivo), validar que el usuario pertenezca a su equipo
            if (esJefe(rolUsuario) && !esEjecutivo(rolUsuario)) {
                const perteneceEquipo = await this.validarUsuarioEnEquipo(
                    usuarioLogueado.user_id,
                    usuarioId
                );

                if (!perteneceEquipo) {
                    logger.warn(`❌ Acceso denegado: Jefe ${usuarioLogueado.user_id} intentó ver contador de usuario ${usuarioId} que no pertenece a su equipo`);
                    return res.status(403).json({
                        success: false,
                        error: 'Solo puedes ver el contador de tu equipo',
                        code: 'FORBIDDEN_TEAM_ACCESS',
                        contador: 0
                    });
                }
            }
            
            const result = await query(`
                SELECT prioridad, tipo FROM notificaciones 
                WHERE usuario_id = $1 AND leida = $2 
                AND (expira_en IS NULL OR expira_en > $3)
            `, [usuarioId, false, new Date().toISOString()]);
            
            const data = result.rows;
            const total = data?.length || 0;
            let desglose = null;

            if (incluir_desglose === 'true' && data) {
                desglose = {
                    por_prioridad: {
                        critica: data.filter(n => n.prioridad === 'critica').length,
                        alta: data.filter(n => n.prioridad === 'alta').length,
                        media: data.filter(n => n.prioridad === 'media').length,
                        normal: data.filter(n => n.prioridad === 'normal').length
                    },
                    por_tipo: data.reduce((acc, notif) => {
                        acc[notif.tipo] = (acc[notif.tipo] || 0) + 1;
                        return acc;
                    }, {}),
                    urgentes: data.filter(n => ['critica', 'alta'].includes(n.prioridad)).length
                };
            }
            
            res.json({
                success: true,
                contador: total,
                desglose: desglose,
                meta: {
                    usuario_id: parseInt(usuarioId),
                    timestamp: obtenerFechaPeruISO()
                }
            });
            
        } catch (error) {
            logger.error('Error obteniendo contador:', error);
            res.status(500).json({
                success: false,
                contador: 0,
                error: error.message
            });
        }
    }

    /**
     * PUT /api/notificaciones/:id/marcar-leida
     */
    static async marcarLeida(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user?.user_id || req.body.usuario_id;
            
            const result = await query(`
                UPDATE notificaciones 
                SET leida = $1, leida_en = $2 
                WHERE id = $3 AND usuario_id = $4
                RETURNING *
            `, [true, obtenerFechaPeruISO(), id, usuarioId]);
            
            if (result.rows.length === 0) {
                throw new Error('Notificación no encontrada o no autorizada');
            }

            const data = result.rows[0];
            
            logger.info(`✅ Notificación ${id} marcada como leída`);

            res.json({
                success: true,
                data: data,
                message: 'Notificación marcada como leída'
            });
            
        } catch (error) {
            logger.error('Error marcando como leída:', error);
            res.status(500).json({
                success: false,
                error: 'Error al marcar como leída: ' + error.message
            });
        }
    }

    /**
     * PUT /api/notificaciones/marcar-todas-leidas/:usuarioId
     */
    static async marcarTodasLeidas(req, res) {
        try {
            const { usuarioId } = req.params;
            
            const result = await query(`
                UPDATE notificaciones 
                SET leida = $1, leida_en = $2 
                WHERE usuario_id = $3 AND leida = $4
                RETURNING *
            `, [true, obtenerFechaPeruISO(), usuarioId, false]);
            
            const data = result.rows;
            
            logger.info(`✅ ${data?.length || 0} notificaciones marcadas como leídas para usuario ${usuarioId}`);

            res.json({
                success: true,
                data: data,
                total_marcadas: data?.length || 0,
                message: `${data?.length || 0} notificaciones marcadas como leídas`
            });
            
        } catch (error) {
            logger.error('Error marcando todas como leídas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al marcar todas como leídas: ' + error.message
            });
        }
    }

    /**
     * POST /api/notificaciones/crear
     * Endpoint para usar el método unificado
     */
    static async crearNotificacion(req, res) {
        try {
            const opciones = req.body;
            const resultado = await this.crearNotificaciones(opciones);
            
            if (resultado.success) {
                res.status(201).json(resultado);
            } else {
                res.status(400).json(resultado);
            }
            
        } catch (error) {
            logger.error('Error en endpoint crear:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear notificación: ' + error.message
            });
        }
    }

    /**
     * Método auxiliar para estadísticas
     */
    static async calcularEstadisticasUsuario(usuarioId) {
        const result = await query(`
            SELECT prioridad, tipo, leida, created_at 
            FROM notificaciones 
            WHERE usuario_id = $1
        `, [usuarioId]);

        const data = result.rows;
        if (!data) return null;

        return {
            total: data.length,
            no_leidas: data.filter(n => !n.leida).length,
            por_prioridad: {
                critica: data.filter(n => n.prioridad === 'critica').length,
                alta: data.filter(n => n.prioridad === 'alta').length,
                media: data.filter(n => n.prioridad === 'media').length,
                normal: data.filter(n => n.prioridad === 'normal').length
            },
            por_tipo: data.reduce((acc, notif) => {
                acc[notif.tipo] = (acc[notif.tipo] || 0) + 1;
                return acc;
            }, {}),
            ultima_semana: data.filter(n => 
                new Date(n.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ).length
        };
    }

    /**
     * GET /api/notificaciones/health
     */
    static async healthCheck(req, res) {
        try {
            const result = await query(`SELECT COUNT(*) as total FROM notificaciones`);
            const count = result.rows[0]?.total || 0;

            res.json({
                success: true,
                module: 'Notificaciones',
                status: 'Operativo',
                version: '2.0 - Superior Unificado (PostgreSQL)',
                timestamp: obtenerFechaPeruISO(),
                timezone: 'America/Lima (UTC-5)',
                data: {
                    total_notificaciones: parseInt(count),
                    funcionalidades: [
                        'Método unificado con opciones',
                        'Prioridades inteligentes automáticas',
                        'Generación de contenido automática',
                        'Validación de duplicados',
                        'Notificaciones masivas',
                        'Estadísticas avanzadas',
                        'Metadatos enriquecidos',
                        'Expiración automática'
                    ],
                    modos_disponibles: ['basico', 'inteligente', 'masivo'],
                    tipos_soportados: [
                        // Seguimientos
                        'seguimiento_vencido', 'seguimiento_urgente', 'seguimiento_critico',
                        'seguimiento_completado', 'seguimiento_proximo',
                        // Prospectos
                        'prospecto_creado', 'prospecto_reasignado', 'prospecto_eliminado',
                        'prospecto_libre_activado',
                        // Estados y ventas
                        'estado_cotizado', 'estado_negociacion', 'venta_cerrada',
                        'venta_perdida', 'conversion_exitosa',
                        // Alertas
                        'oportunidad_alta', 'alerta_reasignaciones', 'meta_alcanzada',
                        // Sistema
                        'sistema', 'marketing', 'manual'
                    ]
                }
            });

        } catch (error) {
            logger.error('Error en health check:', error);
            res.status(500).json({
                success: false,
                module: 'Notificaciones',
                status: 'Error',
                error: error.message
            });
        }
    }
}

module.exports = NotificacionesController;