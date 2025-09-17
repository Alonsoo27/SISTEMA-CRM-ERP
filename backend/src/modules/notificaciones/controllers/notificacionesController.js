const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
                    const { data: notifCreada, error } = await supabase
                        .from('notificaciones')
                        .insert(notificacion)
                        .select()
                        .single();

                    if (error) throw error;

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
            'seguimiento_vencido': 30,
            'seguimiento_urgente': 50,
            'seguimiento_critico': 80,
            'venta_perdida': 60,
            'cliente_insatisfecho': 70,
            'oportunidad_alta': 40,
            'sistema': 20,
            'marketing': 10,
            'manual': 25
        };

        puntos += puntosPorTipo[tipo] || 25;

        // Puntos por valor estimado
        if (valor_estimado >= 50000) puntos += 30;
        else if (valor_estimado >= 25000) puntos += 20;
        else if (valor_estimado >= 10000) puntos += 10;

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
            'seguimiento_vencido': data.horas_vencidas > 48 ? 
                `🚨 Seguimiento CRÍTICO - ${data.nombre_cliente || 'Cliente'}` :
                `⏰ Seguimiento vencido - ${data.nombre_cliente || 'Cliente'}`,
            
            'seguimiento_urgente': `🔥 URGENTE: ${data.nombre_cliente || 'Cliente'} requiere atención`,
            
            'seguimiento_critico': `🚨 CRÍTICO: ${data.nombre_cliente || 'Cliente'} - ${data.horas_vencidas}h sin contacto`,
            
            'venta_perdida': `💔 Venta perdida: ${data.nombre_cliente || 'Cliente'} ($${data.valor_estimado?.toLocaleString()})`,
            
            'oportunidad_alta': `💰 Oportunidad de alto valor: $${data.valor_estimado?.toLocaleString()}`,
            
            'sistema': `ℹ️ Actualización del sistema`,
            
            'marketing': `📢 ${data.titulo || 'Nueva promoción disponible'}`,
            
            'manual': data.titulo || `📝 Notificación importante`
        };

        return plantillas[tipo] || `📋 Notificación: ${tipo}`;
    }

    static generarMensajeInteligente(data, tipo, modo) {
        if (data.mensaje) return data.mensaje;

        const mensajes = {
            'seguimiento_vencido': `${data.nombre_cliente || 'El cliente'} lleva ${data.horas_vencidas || 0}h sin seguimiento. Valor estimado: $${data.valor_estimado?.toLocaleString() || 0}`,
            
            'seguimiento_urgente': `${data.nombre_cliente || 'El cliente'} requiere contacto inmediato. Han pasado ${data.horas_vencidas || 0}h desde el último seguimiento.`,
            
            'seguimiento_critico': `ATENCIÓN INMEDIATA: ${data.nombre_cliente || 'Cliente'} sin contacto por ${data.horas_vencidas || 0}h. Riesgo de pérdida alto.`,
            
            'venta_perdida': `La venta con ${data.nombre_cliente || 'el cliente'} se ha perdido. Valor: $${data.valor_estimado?.toLocaleString() || 0}. Revisar para mejoras futuras.`,
            
            'oportunidad_alta': `Nueva oportunidad de alto valor detectada. Cliente: ${data.nombre_cliente || 'No especificado'}. Valor estimado: $${data.valor_estimado?.toLocaleString() || 0}`,
            
            'sistema': data.mensaje || 'El sistema ha generado una actualización importante.',
            
            'marketing': data.mensaje || 'Nueva campaña de marketing disponible para tus clientes.',
            
            'manual': data.mensaje || 'Notificación creada manualmente.'
        };

        return mensajes[tipo] || `Notificación de tipo: ${tipo}`;
    }

    static generarUrlAccion(data, tipo) {
        if (data.accion_url) return data.accion_url;

        const urls = {
            'seguimiento_vencido': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?tab=seguimientos',
            'seguimiento_urgente': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos',
            'seguimiento_critico': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos',
            'venta_perdida': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/reportes/ventas-perdidas',
            'oportunidad_alta': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/prospectos?filtro=alto_valor',
            'sistema': '/configuracion',
            'marketing': '/marketing/campanas',
            'manual': data.prospecto_id ? `/prospectos/${data.prospecto_id}` : '/dashboard'
        };

        return urls[tipo] || '/dashboard';
    }

    static generarTextoAccion(tipo, prioridad) {
        const acciones = {
            'seguimiento_vencido': prioridad === 'critica' ? 'CONTACTAR AHORA' : 'Ver prospecto',
            'seguimiento_urgente': 'ATENDER INMEDIATAMENTE',
            'seguimiento_critico': 'ACCIÓN URGENTE',
            'venta_perdida': 'Revisar caso',
            'oportunidad_alta': 'Ver oportunidad',
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

        let query = supabase
            .from('notificaciones')
            .select('id')
            .eq('usuario_id', userId)
            .eq('tipo', tipo)
            .gte('created_at', hoyInicio.toISOString());

        if (prospectoId) {
            query = query.eq('prospecto_id', prospectoId);
        }

        const { data } = await query.single();
        return !!data;
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
            
            logger.info(`🔔 Obteniendo notificaciones para usuario ${usuarioId}`);

            let query = supabase
                .from('notificaciones')
                .select(`
                    id, tipo, titulo, mensaje, prioridad, leida, 
                    prospecto_id, accion_url, accion_texto, datos_adicionales,
                    created_at, leida_en, expira_en,
                    prospectos:prospecto_id(codigo, nombre_cliente, telefono, valor_estimado, estado)
                `)
                .eq('usuario_id', usuarioId)
                .or('expira_en.is.null,expira_en.gt.' + new Date().toISOString()) // No expiradas
                .order('prioridad', { ascending: false })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            if (solo_no_leidas === 'true') {
                query = query.eq('leida', false);
            }

            if (tipo) {
                query = query.eq('tipo', tipo);
            }

            if (prioridad) {
                query = query.eq('prioridad', prioridad);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;

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
                prospecto: notif.prospectos ? {
                    id: notif.prospecto_id,
                    codigo: notif.prospectos.codigo,
                    nombre_cliente: notif.prospectos.nombre_cliente,
                    telefono: notif.prospectos.telefono,
                    valor_estimado: notif.prospectos.valor_estimado,
                    estado: notif.prospectos.estado
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
     */
    static async obtenerContador(req, res) {
        try {
            const { usuarioId } = req.params;
            const { incluir_desglose = false } = req.query;
            
            const { data, error } = await supabase
                .from('notificaciones')
                .select('prioridad, tipo')
                .eq('usuario_id', usuarioId)
                .eq('leida', false)
                .or('expira_en.is.null,expira_en.gt.' + new Date().toISOString());
            
            if (error) throw error;

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
            
            const { data, error } = await supabase
                .from('notificaciones')
                .update({ 
                    leida: true, 
                    leida_en: obtenerFechaPeruISO()
                })
                .eq('id', id)
                .eq('usuario_id', usuarioId)
                .select()
                .single();
            
            if (error) throw error;
            
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
            
            const { data, error } = await supabase
                .from('notificaciones')
                .update({ 
                    leida: true, 
                    leida_en: obtenerFechaPeruISO()
                })
                .eq('usuario_id', usuarioId)
                .eq('leida', false)
                .select();
            
            if (error) throw error;
            
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
        const { data } = await supabase
            .from('notificaciones')
            .select('prioridad, tipo, leida, created_at')
            .eq('usuario_id', usuarioId);

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
            const { count, error } = await supabase
                .from('notificaciones')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            res.json({
                success: true,
                module: 'Notificaciones',
                status: 'Operativo',
                version: '2.0 - Superior Unificado',
                timestamp: obtenerFechaPeruISO(),
                timezone: 'America/Lima (UTC-5)',
                data: {
                    total_notificaciones: count || 0,
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
                        'seguimiento_vencido', 'seguimiento_urgente', 'seguimiento_critico',
                        'venta_perdida', 'oportunidad_alta', 'sistema', 'marketing', 'manual'
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