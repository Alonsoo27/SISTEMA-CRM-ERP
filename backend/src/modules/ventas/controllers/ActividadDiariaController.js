// ============================================
// ACTIVIDAD DIARIA CONTROLLER - SISTEMA EMPRESARIAL
// Check-in/Check-out para Vendedores y Asesores
// Integrado con módulo de ventas existente
// VERSIÓN CORREGIDA - ZONA HORARIA LIMA
// ============================================

const { query } = require('../../../config/database');
const actividadService = require('../services/ActividadDiariaService');

// ============================================
// LOGGING EMPRESARIAL
// ============================================
const logRequest = (methodName, req, additionalInfo = {}) => {
    console.log(`\n=== ACTIVIDAD DIARIA: ${methodName} ===`);
    console.log('User:', req.user?.nombre || 'Unknown', `(${req.user?.id})`);
    console.log('Timestamp:', new Date().toISOString());
    if (Object.keys(additionalInfo).length > 0) {
        console.log('Context:', additionalInfo);
    }
    console.log('================================\n');
};

const logSuccess = (methodName, result, duration = null) => {
    console.log(`✅ ${methodName} completed successfully`);
    if (duration) console.log(`⏱️  Duration: ${duration}ms`);
    if (result.action) console.log(`🎯 Action: ${result.action}`);
    if (result.estado) console.log(`📊 Estado: ${result.estado}`);
    console.log('================================\n');
};

const logError = (methodName, error, context = {}) => {
    console.error(`❌ ${methodName} failed:`, error.message);
    console.error('Context:', context);
    if (process.env.NODE_ENV === 'development') {
        console.error('Stack:', error.stack);
    }
    console.error('================================\n');
};

// ============================================
// HELPER FUNCTIONS - VERSIÓN CORREGIDA LIMA
// ============================================

/**
 * Obtener fecha actual en zona horaria Lima (formato YYYY-MM-DD)
 * @returns {string} - Fecha en formato YYYY-MM-DD
 */
const obtenerFechaLima = () => {
    return new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Lima'
    });
};

/**
 * Obtener hora actual en zona horaria Lima (0-23)
 * @returns {number} - Hora en formato 24h
 */
const obtenerHoraLima = () => {
    const fechaLima = new Date().toLocaleString('en-US', {
        timeZone: 'America/Lima'
    });
    return new Date(fechaLima).getHours();
};

/**
 * Obtener fecha/hora completa en zona horaria Lima
 * @returns {Date} - Objeto Date en hora Lima
 */
const obtenerFechaHoraLima = () => {
    const fechaLima = new Date().toLocaleString('en-US', {
        timeZone: 'America/Lima'
    });
    return new Date(fechaLima);
};

/**
 * Obtener día de la semana en zona horaria Lima (0=Domingo, 6=Sábado)
 * @returns {number} - Día de la semana
 */
const obtenerDiaSemanaLima = () => {
    const fechaLima = obtenerFechaHoraLima();
    return fechaLima.getDay();
};

/**
 * Validar horario de check-in empresarial (LIMA)
 * Lunes-Viernes: 8:00 AM - 12:00 PM
 * Sábado: 9:15 AM - 12:10 PM
 * Domingo: No permitido
 * @returns {boolean} - true si está en horario válido
 */
const validarHorarioCheckin = () => {
    // Permitir bypass en desarrollo si está configurado
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SCHEDULE_VALIDATION === 'true') {
        console.log('⚠️  DEVELOPMENT: Schedule validation bypassed for check-in');
        return true;
    }

    const fechaHoraLima = obtenerFechaHoraLima();
    const diaSemana = fechaHoraLima.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const hora = fechaHoraLima.getHours();
    const minutos = fechaHoraLima.getMinutes();

    // Domingo: No se permite check-in
    if (diaSemana === 0) {
        return false;
    }

    // Sábado: 9:15 AM - 10:00 AM
    if (diaSemana === 6) {
        // Después de 9:15 AM
        if (hora > 9 || (hora === 9 && minutos >= 15)) {
            // Antes de 10:00 AM
            if (hora < 10) {
                return true;
            }
        }
        return false;
    }

    // Lunes a Viernes: 8:00 AM - 12:00 PM (mediodía)
    return hora >= 8 && hora < 12;
};

/**
 * Validar horario de check-out empresarial (LIMA)
 * Lunes-Viernes: 5:00 PM - 6:10 PM
 * Sábado: 11:00 AM - 12:00 PM (mediodía)
 * Domingo: No permitido
 * @returns {boolean} - true si está en horario válido
 */
const validarHorarioCheckout = () => {
    // Permitir bypass en desarrollo si está configurado
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SCHEDULE_VALIDATION === 'true') {
        console.log('⚠️  DEVELOPMENT: Schedule validation bypassed for check-out');
        return true;
    }

    const fechaHoraLima = obtenerFechaHoraLima();
    const diaSemana = fechaHoraLima.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const hora = fechaHoraLima.getHours();
    const minutos = fechaHoraLima.getMinutes();

    // Domingo: No se permite check-out
    if (diaSemana === 0) {
        return false;
    }

    // Sábado: 11:00 AM - 12:00 PM (mediodía)
    if (diaSemana === 6) {
        return hora === 11 || (hora === 12 && minutos === 0);
    }

    // Lunes a Viernes: 5:00 PM - 6:10 PM
    // Después de 5:00 PM (17:00)
    if (hora > 17 || (hora === 17 && minutos >= 0)) {
        // Antes de 6:10 PM (18:10)
        if (hora < 18 || (hora === 18 && minutos <= 10)) {
            return true;
        }
    }

    return false;
};

/**
 * Obtener horarios permitidos según día de la semana
 * @returns {Object} - Horarios de check-in y check-out
 */
const obtenerHorariosPermitidos = () => {
    const diaSemana = obtenerDiaSemanaLima();

    // Domingo
    if (diaSemana === 0) {
        return {
            check_in: 'No disponible los domingos',
            check_out: 'No disponible los domingos'
        };
    }

    // Sábado
    if (diaSemana === 6) {
        return {
            check_in: '9:15 AM - 10:00 AM',
            check_out: '11:00 AM - 12:00 PM'
        };
    }

    // Lunes a Viernes
    return {
        check_in: '8:00 AM - 12:00 PM',
        check_out: '5:00 PM - 6:10 PM'
    };
};

/**
 * Validar datos de mensajes recibidos
 * @param {Object} mensajes - Datos de mensajes
 * @returns {Array} - Array de errores de validación
 */
const validarMensajes = (mensajes) => {
    const { mensajes_meta = 0, mensajes_whatsapp = 0, mensajes_instagram = 0, mensajes_tiktok = 0 } = mensajes;
    
    const validaciones = [];
    
    if (mensajes_meta < 0 || mensajes_meta > 1000) {
        validaciones.push('Mensajes Meta debe estar entre 0 y 1000');
    }
    if (mensajes_whatsapp < 0 || mensajes_whatsapp > 1000) {
        validaciones.push('Mensajes WhatsApp debe estar entre 0 y 1000');
    }
    if (mensajes_instagram < 0 || mensajes_instagram > 1000) {
        validaciones.push('Mensajes Instagram debe estar entre 0 y 1000');
    }
    if (mensajes_tiktok < 0 || mensajes_tiktok > 1000) {
        validaciones.push('Mensajes TikTok debe estar entre 0 y 1000');
    }
    
    return validaciones;
};

/**
 * Validar datos de llamadas realizadas
 * @param {Object} llamadas - Datos de llamadas
 * @returns {Array} - Array de errores de validación
 */
const validarLlamadas = (llamadas) => {
    const { llamadas_realizadas = 0, llamadas_recibidas = 0 } = llamadas;
    
    const validaciones = [];
    
    if (llamadas_realizadas < 0 || llamadas_realizadas > 200) {
        validaciones.push('Llamadas realizadas debe estar entre 0 y 200');
    }
    if (llamadas_recibidas < 0 || llamadas_recibidas > 200) {
        validaciones.push('Llamadas recibidas debe estar entre 0 y 200');
    }
    
    return validaciones;
};

// ============================================
// OBTENER ESTADO ACTUAL DEL DÍA - CORREGIDO
// ============================================
exports.getEstadoHoy = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getEstadoHoy', req);

        const userId = req.user.id;
        
        // ✅ CORRECCIÓN 1: Calcular fecha de hoy en zona horaria Lima
        const fechaHoy = obtenerFechaLima();
        const horaActualLima = obtenerHoraLima();
        
        // ✅ DEBUG TEMPORAL para verificar corrección
        console.log('🔍 DEBUG RESET DIARIO:');
        console.log('- fechaHoy calculada (Lima):', fechaHoy);
        console.log('- Hora actual Lima:', horaActualLima);
        
        // ✅ CORRECCIÓN 2: Consulta con fecha Lima y timestamps convertidos
        const actividadResult = await query(`
            SELECT
                id, fecha,
                check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_in_time,
                check_out_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_out_time,
                estado_jornada,
                created_at, updated_at,
                mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok as total_mensajes_recibidos,
                llamadas_realizadas + llamadas_recibidas as total_llamadas,
                CASE
                    WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0
                    ELSE 0
                END as jornada_horas
            FROM actividad_diaria
            WHERE usuario_id = $1 AND fecha = $2
        `, [userId, fechaHoy]);

        // ✅ DEBUG: Mostrar qué encontró la consulta
        console.log('📊 Consulta BD resultado:', {
            records_found: actividadResult.rows.length,
            fecha_buscada: fechaHoy,
            primer_registro: actividadResult.rows[0] || 'ninguno'
        });

        // ✅ NUEVA FUNCIONALIDAD: Detectar jornadas pendientes (check-in sin check-out)
        const jornadaPendienteResult = await query(`
            SELECT
                id, fecha,
                check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' as check_in_time,
                estado_jornada,
                mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok as total_mensajes_recibidos,
                llamadas_realizadas + llamadas_recibidas as total_llamadas
            FROM actividad_diaria
            WHERE usuario_id = $1
                AND fecha < $2
                AND check_in_time IS NOT NULL
                AND check_out_time IS NULL
                AND fecha >= $3
            ORDER BY fecha DESC
            LIMIT 1
        `, [userId, fechaHoy, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]); // Máximo 7 días atrás

        const jornadaPendiente = jornadaPendienteResult.rows[0] || null;

        if (jornadaPendiente) {
            console.log('⚠️  JORNADA PENDIENTE DETECTADA:', {
                fecha: jornadaPendiente.fecha,
                check_in: jornadaPendiente.check_in_time,
                dias_atras: Math.floor((new Date(fechaHoy) - new Date(jornadaPendiente.fecha)) / (1000 * 60 * 60 * 24))
            });
        }

        const actividad = actividadResult.rows[0];

        // ✅ CORRECCIÓN 3: Lógica de reset diario mejorada
        const checkInRealizado = !!(actividad?.check_in_time);
        const checkOutRealizado = !!(actividad?.check_out_time);
        
        // ✅ CORRECCIÓN 4: Usar funciones con hora Lima
        const puedeCheckIn = !checkInRealizado && validarHorarioCheckin();
        const puedeCheckOut = checkInRealizado && !checkOutRealizado && validarHorarioCheckout();

        // ✅ CORRECCIÓN 5: Determinar estado con lógica de reset
        let estadoActual = 'sin_iniciar';
        if (checkOutRealizado) {
            estadoActual = 'finalizada';
        } else if (checkInRealizado) {
            estadoActual = 'en_progreso';
        }

        // ✅ CORRECCIÓN 6: Mensaje de estado claro
        let mensaje_estado = '';
        if (!actividad) {
            mensaje_estado = 'Nuevo día - Puedes hacer check-in';
        } else if (estadoActual === 'finalizada') {
            mensaje_estado = 'Jornada completada - Nuevo día disponible';
        } else if (estadoActual === 'en_progreso') {
            mensaje_estado = 'Jornada en progreso';
        } else {
            mensaje_estado = 'Listo para iniciar jornada';
        }

        const estado = {
            check_in_realizado: checkInRealizado,
            check_out_realizado: checkOutRealizado,
            puede_check_in: puedeCheckIn,
            puede_check_out: puedeCheckOut,
            estado_actual: estadoActual,
            horas_jornada: parseFloat(actividad?.jornada_horas || 0),
            total_mensajes: parseInt(actividad?.total_mensajes_recibidos || 0),
            total_llamadas: parseInt(actividad?.total_llamadas || 0),
            hora_check_in: actividad?.check_in_time || null,
            hora_check_out: actividad?.check_out_time || null,
            mensaje_estado: mensaje_estado
        };

        // ✅ DEBUG RESULTADO FINAL
        console.log('🎯 Estado calculado:', {
            estado_actual: estado.estado_actual,
            puede_check_in: estado.puede_check_in,
            puede_check_out: estado.puede_check_out,
            mensaje: mensaje_estado
        });

        const duration = Date.now() - startTime;
        logSuccess('getEstadoHoy', { 
            estado: estado.estado_actual,
            check_in: estado.check_in_realizado,
            check_out: estado.check_out_realizado,
            puede_check_out: estado.puede_check_out
        }, duration);

        res.json({
            success: true,
            data: {
                fecha: fechaHoy,
                estado_actual: estado.estado_actual,
                mensaje: mensaje_estado,
                jornada: {
                    check_in_realizado: estado.check_in_realizado,
                    check_out_realizado: estado.check_out_realizado,
                    puede_check_in: estado.puede_check_in,
                    puede_check_out: estado.puede_check_out,
                    horas_jornada: estado.horas_jornada,
                    hora_check_in: estado.hora_check_in,
                    hora_check_out: estado.hora_check_out
                },
                actividad: {
                    total_mensajes: estado.total_mensajes,
                    total_llamadas: estado.total_llamadas
                },
                horarios: {
                    hora_actual: new Date().toLocaleTimeString('es-PE'),
                    ventana_check_in: obtenerHorariosPermitidos().check_in,
                    ventana_check_out: obtenerHorariosPermitidos().check_out
                },
                // ✅ NUEVA FUNCIONALIDAD: Jornada pendiente
                jornada_pendiente: jornadaPendiente ? {
                    tiene_pendiente: true,
                    fecha: jornadaPendiente.fecha,
                    check_in_time: jornadaPendiente.check_in_time,
                    total_mensajes: parseInt(jornadaPendiente.total_mensajes_recibidos || 0),
                    total_llamadas: parseInt(jornadaPendiente.total_llamadas || 0),
                    dias_atrasados: Math.floor((new Date(fechaHoy) - new Date(jornadaPendiente.fecha)) / (1000 * 60 * 60 * 24))
                } : {
                    tiene_pendiente: false
                },
                debug_info: process.env.NODE_ENV === 'development' ? {
                    fecha_consultada: fechaHoy,
                    registros_encontrados: actividadResult.rows.length,
                    hora_lima: horaActualLima
                } : undefined
            }
        });

    } catch (error) {
        logError('getEstadoHoy', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error al obtener estado de actividad',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// CHECK-IN: INICIAR JORNADA + MENSAJES RECIBIDOS - CORREGIDO
// ============================================
exports.checkIn = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('checkIn', req);

        const {
            mensajes_meta = 0,
            mensajes_whatsapp = 0,
            mensajes_instagram = 0,
            mensajes_tiktok = 0,
            notas_check_in = '',
            en_campana = false,
            producto_campana = ''
        } = req.body;

        const userId = req.user.id;
        
        // ✅ CORRECCIÓN: Usar fecha Lima en lugar de UTC
        const fechaHoy = obtenerFechaLima();
        const horaActualLima = obtenerHoraLima();

        // ✅ DEBUG: Verificar fecha y hora Lima
        console.log('🔍 DEBUG CHECK-IN:');
        console.log('- fechaHoy (Lima):', fechaHoy);
        console.log('- horaActualLima:', horaActualLima);

        // Validaciones de negocio
        const validaciones = [];

        // ✅ CORRECCIÓN: Validar horario usando funciones Lima
        const horariosPermitidos = obtenerHorariosPermitidos();
        if (!validarHorarioCheckin()) {
            validaciones.push(`Check-in fuera de horario. Horario permitido: ${horariosPermitidos.check_in}`);
        }

        // Validar mensajes
        const validacionesMensajes = validarMensajes({
            mensajes_meta, mensajes_whatsapp, mensajes_instagram, mensajes_tiktok
        });
        validaciones.push(...validacionesMensajes);

        if (validaciones.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en check-in',
                errores: validaciones,
                horario_actual: `${horaActualLima}:00 Lima`,
                horario_permitido: horariosPermitidos.check_in
            });
        }

        // Verificar si ya hizo check-in hoy
        const registroExistente = await query(
            'SELECT id, estado_jornada, check_in_time FROM actividad_diaria WHERE usuario_id = $1 AND fecha = $2',
            [userId, fechaHoy]
        );

        if (registroExistente.rows.length > 0 && registroExistente.rows[0].check_in_time) {
            return res.status(400).json({
                success: false,
                message: 'Ya has realizado check-in hoy',
                data: {
                    check_in_time: registroExistente.rows[0].check_in_time,
                    estado_actual: registroExistente.rows[0].estado_jornada
                }
            });
        }

        // ✅ NUEVA LÓGICA: Calcular estado de entrada y tardanza
        const horaActual = new Date();
        const horaCheckIn = new Date(horaActual.toLocaleString("en-US", {timeZone: "America/Lima"}));
        const hora = horaCheckIn.getHours();
        const minutos = horaCheckIn.getMinutes();

        // Lógica de puntualidad: 8:00-8:15 = puntual, 8:16+ = tardanza
        let estado_entrada = 'puntual';
        let minutos_tardanza = 0;

        if (hora > 8 || (hora === 8 && minutos > 15)) {
            estado_entrada = 'tardanza';
            // Calcular minutos de tardanza desde las 8:15
            const limiteHora = new Date(horaCheckIn);
            limiteHora.setHours(8, 15, 0, 0);
            minutos_tardanza = Math.floor((horaCheckIn - limiteHora) / (1000 * 60));
        }

        console.log(`📝 Check-in: ${hora}:${minutos.toString().padStart(2, '0')} → ${estado_entrada} (${minutos_tardanza} min tardanza)`);

        // Obtener campaña activa si está marcando en_campana
        let campanaAsesorId = null;
        if (en_campana && producto_campana) {
            const campanaActiva = await query(`
                SELECT id FROM campanas_asesor
                WHERE usuario_id = $1
                  AND linea_producto = $2
                  AND estado = 'activa'
                LIMIT 1
            `, [userId, producto_campana]);

            if (campanaActiva.rows.length > 0) {
                campanaAsesorId = campanaActiva.rows[0].id;
            }
        }

        // Realizar check-in
        const checkInQuery = registroExistente.rows.length > 0 ?
            // Actualizar registro existente
            `UPDATE actividad_diaria SET
                check_in_time = NOW(),
                mensajes_meta = $3,
                mensajes_whatsapp = $4,
                mensajes_instagram = $5,
                mensajes_tiktok = $6,
                notas_check_in = $7,
                en_campana = $8,
                producto_campana = $9,
                campana_asesor_id = $10,
                estado_entrada = $11,
                minutos_tardanza = $12,
                estado_jornada = 'en_progreso',
                updated_at = NOW()
             WHERE usuario_id = $1 AND fecha = $2
             RETURNING *` :
            // Crear nuevo registro
            `INSERT INTO actividad_diaria (
                usuario_id, fecha, check_in_time,
                mensajes_meta, mensajes_whatsapp, mensajes_instagram, mensajes_tiktok,
                notas_check_in, en_campana, producto_campana, campana_asesor_id,
                estado_entrada, minutos_tardanza, estado_jornada,
                created_at, updated_at
             ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'en_progreso', NOW(), NOW())
             RETURNING *`;

        const result = await query(checkInQuery, [
            userId, fechaHoy, mensajes_meta, mensajes_whatsapp,
            mensajes_instagram, mensajes_tiktok, notas_check_in,
            en_campana, producto_campana, campanaAsesorId, estado_entrada, minutos_tardanza
        ]);

        const actividad = result.rows[0];

        const duration = Date.now() - startTime;
        logSuccess('checkIn', { 
            action: 'check-in',
            estado: actividad.estado_jornada,
            total_mensajes: (mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok)
        }, duration);

        res.status(201).json({
            success: true,
            message: 'Check-in realizado exitosamente',
            data: {
                id: actividad.id,
                check_in_time: actividad.check_in_time,
                estado_jornada: actividad.estado_jornada,
                total_mensajes_recibidos: (mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok),
                mensajes_por_canal: {
                    meta: actividad.mensajes_meta,
                    whatsapp: actividad.mensajes_whatsapp,
                    instagram: actividad.mensajes_instagram,
                    tiktok: actividad.mensajes_tiktok
                },
                notas_check_in: actividad.notas_check_in
            }
        });

    } catch (error) {
        logError('checkIn', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error interno al realizar check-in',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// CHECK-OUT: FINALIZAR JORNADA + LLAMADAS REALIZADAS - CORREGIDO
// ============================================
exports.checkOut = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('checkOut', req);

        const {
            llamadas_realizadas = 0,
            llamadas_recibidas = 0,
            notas_check_out = ''
        } = req.body;

        const userId = req.user.id;
        
        // ✅ CORRECCIÓN: Usar fecha Lima en lugar de UTC
        const fechaHoy = obtenerFechaLima();
        const horaActualLima = obtenerHoraLima();

        // ✅ DEBUG: Verificar fecha y hora Lima
        console.log('🔍 DEBUG CHECK-OUT:');
        console.log('- fechaHoy (Lima):', fechaHoy);
        console.log('- horaActualLima:', horaActualLima);

        // Validaciones de negocio
        const validaciones = [];

        // ✅ CORRECCIÓN: Validar horario usando funciones Lima
        const horariosPermitidos = obtenerHorariosPermitidos();
        if (!validarHorarioCheckout()) {
            validaciones.push(`Check-out fuera de horario. Horario permitido: ${horariosPermitidos.check_out}`);
        }

        // Validar llamadas
        const validacionesLlamadas = validarLlamadas({
            llamadas_realizadas, llamadas_recibidas
        });
        validaciones.push(...validacionesLlamadas);

        if (validaciones.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en check-out',
                errores: validaciones,
                horario_actual: `${horaActualLima}:00 Lima`,
                horario_permitido: horariosPermitidos.check_out
            });
        }

        // Verificar que existe registro y check-in del día
        const registroExistente = await query(`
            SELECT id, estado_jornada, check_in_time, check_out_time 
            FROM actividad_diaria 
            WHERE usuario_id = $1 AND fecha = $2
        `, [userId, fechaHoy]);

        if (registroExistente.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se encontró registro de check-in para hoy',
                recomendacion: 'Debes realizar check-in antes del check-out'
            });
        }

        const registro = registroExistente.rows[0];

        if (!registro.check_in_time) {
            return res.status(400).json({
                success: false,
                message: 'Debes realizar check-in antes del check-out',
                estado_actual: registro.estado_jornada
            });
        }

        if (registro.check_out_time) {
            return res.status(400).json({
                success: false,
                message: 'Ya has realizado check-out hoy',
                data: {
                    check_out_time: registro.check_out_time,
                    estado_actual: registro.estado_jornada
                }
            });
        }

        // ✅ NUEVA LÓGICA: Calcular estado de salida y horas efectivas
        const horaActual = new Date();
        const horaCheckOut = new Date(horaActual.toLocaleString("en-US", {timeZone: "America/Lima"}));
        const hora = horaCheckOut.getHours();
        const minutos = horaCheckOut.getMinutes();

        // Lógica de salida: 5:50-6:00 PM = normal, antes 5:50 = temprana
        let estado_salida = 'normal';
        if (hora < 17 || (hora === 17 && minutos < 50)) {
            estado_salida = 'temprana';
        }

        // Calcular horas efectivas
        const checkInTime = new Date(registro.check_in_time);
        const horasEfectivas = (horaCheckOut - checkInTime) / (1000 * 60 * 60); // Convertir a horas
        const total_horas_efectivas = Math.round(horasEfectivas * 100) / 100; // 2 decimales

        console.log(`📝 Check-out: ${hora}:${minutos.toString().padStart(2, '0')} → ${estado_salida} (${total_horas_efectivas}h efectivas)`);

        // Realizar check-out
        const checkOutQuery = `
            UPDATE actividad_diaria SET
                check_out_time = NOW(),
                llamadas_realizadas = $3,
                llamadas_recibidas = $4,
                notas_check_out = $5,
                estado_salida = $6,
                total_horas_efectivas = $7,
                estado_jornada = 'finalizada',
                updated_at = NOW()
            WHERE usuario_id = $1 AND fecha = $2
            RETURNING *
        `;

        const result = await query(checkOutQuery, [
            userId, fechaHoy, llamadas_realizadas, llamadas_recibidas, notas_check_out,
            estado_salida, total_horas_efectivas
        ]);

        const actividad = result.rows[0];

        const duration = Date.now() - startTime;
        logSuccess('checkOut', { 
            action: 'check-out',
            estado: actividad.estado_jornada,
            total_llamadas: (llamadas_realizadas + llamadas_recibidas)
        }, duration);

        res.json({
            success: true,
            message: 'Check-out realizado exitosamente',
            data: {
                id: actividad.id,
                check_out_time: actividad.check_out_time,
                estado_jornada: actividad.estado_jornada,
                jornada_horas: parseFloat(actividad.jornada_horas || 0),
                total_llamadas: (llamadas_realizadas + llamadas_recibidas),
                llamadas_por_tipo: {
                    realizadas: actividad.llamadas_realizadas,
                    recibidas: actividad.llamadas_recibidas
                },
                resumen_dia: {
                    total_mensajes: actividad.mensajes_meta + actividad.mensajes_whatsapp + 
                                  actividad.mensajes_instagram + actividad.mensajes_tiktok,
                    total_llamadas: (llamadas_realizadas + llamadas_recibidas),
                    horas_trabajadas: parseFloat(actividad.jornada_horas || 0)
                },
                notas_check_out: actividad.notas_check_out
            }
        });

    } catch (error) {
        logError('checkOut', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error interno al realizar check-out',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// CHECK-OUT RETROACTIVO: COMPLETAR JORNADA PENDIENTE
// ============================================
exports.checkOutRetroactivo = async (req, res) => {
    const startTime = Date.now();

    try {
        logRequest('checkOutRetroactivo', req);

        const {
            fecha_pendiente,
            hora_salida, // Formato: "17:30" o "5:30 PM"
            llamadas_realizadas = 0,
            llamadas_recibidas = 0,
            notas_check_out = '',
            motivo_tardanza = '' // Opcional: por qué no hizo check-out a tiempo
        } = req.body;

        const userId = req.user.id;

        // Validaciones
        const validaciones = [];

        if (!fecha_pendiente) {
            validaciones.push('Fecha pendiente es requerida');
        }

        if (!hora_salida) {
            validaciones.push('Hora de salida es requerida');
        }

        // Validar que la fecha no sea futura
        const fechaHoy = obtenerFechaLima();
        if (fecha_pendiente >= fechaHoy) {
            validaciones.push('No se puede hacer check-out retroactivo del día de hoy o futuro');
        }

        // Validar que no sea muy antigua (máximo 7 días)
        const diasDiferencia = Math.floor((new Date(fechaHoy) - new Date(fecha_pendiente)) / (1000 * 60 * 60 * 24));
        if (diasDiferencia > 7) {
            validaciones.push('No se puede hacer check-out retroactivo de más de 7 días atrás');
        }

        // Validar llamadas
        const validacionesLlamadas = validarLlamadas({
            llamadas_realizadas, llamadas_recibidas
        });
        validaciones.push(...validacionesLlamadas);

        if (validaciones.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en check-out retroactivo',
                errores: validaciones
            });
        }

        // Verificar que existe el registro con check-in
        const registroResult = await query(`
            SELECT id, check_in_time, check_out_time, estado_jornada
            FROM actividad_diaria
            WHERE usuario_id = $1 AND fecha = $2
        `, [userId, fecha_pendiente]);

        if (registroResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró registro de check-in para la fecha especificada'
            });
        }

        const registro = registroResult.rows[0];

        if (!registro.check_in_time) {
            return res.status(400).json({
                success: false,
                message: 'No hay check-in registrado para esa fecha'
            });
        }

        if (registro.check_out_time) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un check-out para esa fecha',
                data: {
                    check_out_existente: registro.check_out_time
                }
            });
        }

        // Parsear hora de salida ingresada por el usuario
        let horaSalidaParsed;
        try {
            // Convertir hora ingresada a timestamp completo
            const [horas, minutos] = hora_salida.includes(':')
                ? hora_salida.split(':').map(Number)
                : [parseInt(hora_salida), 0];

            const fechaSalida = new Date(fecha_pendiente);
            fechaSalida.setHours(horas, minutos, 0, 0);
            horaSalidaParsed = fechaSalida;

            console.log(`📝 Check-out retroactivo: ${fecha_pendiente} a las ${hora_salida} → ${horaSalidaParsed.toISOString()}`);
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                message: 'Formato de hora inválido. Use formato HH:MM (ej: 17:30 o 5:30 PM)'
            });
        }

        // Validar que la hora de salida sea posterior al check-in
        const checkInTime = new Date(registro.check_in_time);
        if (horaSalidaParsed <= checkInTime) {
            return res.status(400).json({
                success: false,
                message: 'La hora de salida debe ser posterior a la hora de check-in',
                data: {
                    check_in: registro.check_in_time
                }
            });
        }

        // Calcular horas efectivas
        const horasEfectivas = (horaSalidaParsed - checkInTime) / (1000 * 60 * 60);
        const total_horas_efectivas = Math.round(horasEfectivas * 100) / 100;

        // Determinar estado de salida (siempre será 'retroactivo' para identificarlo)
        const estado_salida = 'retroactivo';

        // Actualizar registro con check-out retroactivo
        const updateQuery = `
            UPDATE actividad_diaria SET
                check_out_time = $3,
                llamadas_realizadas = $4,
                llamadas_recibidas = $5,
                notas_check_out = $6,
                estado_salida = $7,
                total_horas_efectivas = $8,
                estado_jornada = 'finalizada',
                motivo_checkout_retroactivo = $9,
                updated_at = NOW()
            WHERE usuario_id = $1 AND fecha = $2
            RETURNING *
        `;

        const result = await query(updateQuery, [
            userId,
            fecha_pendiente,
            horaSalidaParsed,
            llamadas_realizadas,
            llamadas_recibidas,
            notas_check_out,
            estado_salida,
            total_horas_efectivas,
            motivo_tardanza || 'Check-out completado retroactivamente'
        ]);

        const actividad = result.rows[0];

        const duration = Date.now() - startTime;
        logSuccess('checkOutRetroactivo', {
            action: 'check-out-retroactivo',
            fecha: fecha_pendiente,
            horas_efectivas: total_horas_efectivas
        }, duration);

        res.json({
            success: true,
            message: 'Check-out retroactivo completado exitosamente',
            data: {
                id: actividad.id,
                fecha: actividad.fecha,
                check_in_time: actividad.check_in_time,
                check_out_time: actividad.check_out_time,
                estado_jornada: actividad.estado_jornada,
                total_horas_efectivas: total_horas_efectivas,
                total_llamadas: (llamadas_realizadas + llamadas_recibidas),
                estado_salida: estado_salida,
                dias_atrasados: diasDiferencia,
                advertencia: 'Este check-out fue completado retroactivamente'
            }
        });

    } catch (error) {
        logError('checkOutRetroactivo', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error interno al realizar check-out retroactivo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// OBTENER ACTIVIDAD COMPLETA (CON PERMISOS)
// ============================================
exports.getActividad = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getActividad', req);

        const { usuario_id, fecha_desde, fecha_hasta, limit = 10, page = 1 } = req.query;
        const userId = req.user.id;

        // Construir query con permisos (RLS se encarga automáticamente)
        let whereConditions = ['1=1'];
        const params = [];
        let paramCount = 0;

        if (fecha_desde) {
            paramCount++;
            whereConditions.push(`fecha >= $${paramCount}`);
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            paramCount++;
            whereConditions.push(`fecha <= $${paramCount}`);
            params.push(fecha_hasta);
        }

        if (usuario_id) {
            paramCount++;
            whereConditions.push(`usuario_id = $${paramCount}`);
            params.push(usuario_id);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        params.push(parseInt(limit));
        paramCount++;
        params.push(offset);

        const actividadQuery = `
            SELECT * FROM v_actividad_diaria_completa
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY fecha DESC, check_in_time DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;

        const countQuery = `
            SELECT COUNT(*) as total FROM v_actividad_diaria_completa
            WHERE ${whereConditions.join(' AND ')}
        `;

        const [actividadResult, countResult] = await Promise.all([
            query(actividadQuery, params),
            query(countQuery, params.slice(0, -2))
        ]);

        const actividades = actividadResult.rows.map(actividad => ({
            ...actividad,
            jornada_horas: parseFloat(actividad.jornada_horas || 0),
            total_mensajes_recibidos: parseInt(actividad.total_mensajes_recibidos || 0),
            total_llamadas: parseInt(actividad.total_llamadas || 0)
        }));

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit));

        const duration = Date.now() - startTime;
        logSuccess('getActividad', { 
            records: actividades.length,
            total: total
        }, duration);

        res.json({
            success: true,
            data: {
                actividades: actividades,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: total,
                    limit: parseInt(limit),
                    has_next: parseInt(page) < totalPages,
                    has_prev: parseInt(page) > 1
                },
                filtros_aplicados: {
                    usuario_id,
                    fecha_desde,
                    fecha_hasta
                }
            }
        });

    } catch (error) {
        logError('getActividad', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error al obtener actividad',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// DASHBOARD DE ACTIVIDAD (MÉTRICAS EMPRESARIALES)
// ============================================
exports.getDashboard = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getDashboard', req);

        const { fecha_desde, fecha_hasta, usuario_id } = req.query;
        const targetUserId = usuario_id || req.user.id;

        // ✅ CORRECCIÓN: Usar fecha Lima para rangos por defecto
        const fechaDesde = fecha_desde || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
            timeZone: 'America/Lima'
        });
        const fechaHasta = fecha_hasta || obtenerFechaLima();

        // Obtener métricas básicas directamente si no existe la función de BD
        const resumenResult = await query(`
            SELECT 
                COUNT(*) as dias_trabajados,
                SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                AVG(CASE 
                    WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0
                    ELSE 0
                END) as promedio_horas,
                SUM(CASE 
                    WHEN EXTRACT(HOUR FROM check_in_time) <= 10 THEN 1 
                    ELSE 0 
                END) as dias_puntuales,
                SUM(CASE 
                    WHEN EXTRACT(HOUR FROM check_in_time) > 10 THEN 1 
                    ELSE 0 
                END) as dias_tardios
            FROM actividad_diaria
            WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
        `, [targetUserId, fechaDesde, fechaHasta]);

        const resumen = resumenResult.rows[0] || {
            dias_trabajados: 0,
            total_mensajes: 0,
            total_llamadas: 0,
            promedio_horas: 0,
            dias_puntuales: 0,
            dias_tardios: 0
        };

        const dashboard = {
            periodo: {
                desde: fechaDesde,
                hasta: fechaHasta,
                usuario_id: targetUserId
            },
            resumen_general: {
                dias_trabajados: parseInt(resumen.dias_trabajados || 0),
                total_mensajes: parseInt(resumen.total_mensajes || 0),
                total_llamadas: parseInt(resumen.total_llamadas || 0),
                promedio_horas_diarias: parseFloat(resumen.promedio_horas || 0),
                dias_puntuales: parseInt(resumen.dias_puntuales || 0),
                dias_tardios: parseInt(resumen.dias_tardios || 0),
                tasa_puntualidad: resumen.dias_trabajados > 0 ? 
                    ((resumen.dias_puntuales / resumen.dias_trabajados) * 100).toFixed(2) : 0
            }
        };

        const duration = Date.now() - startTime;
        logSuccess('getDashboard', { 
            dias_trabajados: dashboard.resumen_general.dias_trabajados,
            total_actividad: dashboard.resumen_general.total_mensajes + dashboard.resumen_general.total_llamadas
        }, duration);

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        logError('getDashboard', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error al generar dashboard de actividad',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// NUEVOS ENDPOINTS INTEGRADOS
// ============================================

// ============================================
// OBTENER HISTORIAL PAGINADO DE USUARIO
// ============================================
exports.getHistorial = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getHistorial', req);

        const {
            fecha_inicio,
            fecha_fin,
            limite = 30,
            pagina = 1,
            orden_por = 'fecha',
            direccion = 'desc',
            usuario_id
        } = req.query;

        // Determinar si es manager
        const rolesManager = ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'];
        const esManager = rolesManager.includes(req.user.rol);

        // Validación de permisos: Solo managers pueden ver historial de otros
        if (usuario_id && usuario_id !== req.user.id.toString()) {
            if (!esManager) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver historial de otros usuarios'
                });
            }
        }

        const offset = (parseInt(pagina) - 1) * parseInt(limite);

        // Query corregido usando los campos reales de la BD
        let whereConditions = [];
        const params = [];
        let paramCount = 0;

        // Si se especifica usuario_id, filtrar por ese usuario
        // Si NO se especifica Y es manager, traer TODOS los vendedores (vista global)
        // Si NO se especifica Y NO es manager, traer solo sus datos
        if (usuario_id) {
            paramCount++;
            whereConditions.push(`usuario_id = $${paramCount}`);
            params.push(usuario_id);
        } else if (!esManager) {
            // No es manager, solo puede ver sus propios datos
            paramCount++;
            whereConditions.push(`usuario_id = $${paramCount}`);
            params.push(req.user.id);
        }
        // Si es manager y NO hay usuario_id, no agregamos filtro de usuario (trae todos)

        if (fecha_inicio) {
            paramCount++;
            whereConditions.push(`fecha >= $${paramCount}`);
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            paramCount++;
            whereConditions.push(`fecha <= $${paramCount}`);
            params.push(fecha_fin);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const historialQuery = `
    SELECT
        a.id,
        a.usuario_id,
        a.fecha,
        a.estado_jornada,
        a.check_in_time,
        a.check_out_time,
        COALESCE(a.jornada_horas, 0.0) as horas_calculadas,
        COALESCE(a.total_mensajes_recibidos, 0) as total_mensajes_recibidos,
        COALESCE(a.total_llamadas, 0) as total_llamadas,
        a.created_at,
        a.updated_at,
        u.nombre || ' ' || u.apellido as usuario_nombre
    FROM actividad_diaria a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    ${whereClause}
    ORDER BY a.${orden_por} ${direccion.toUpperCase()}
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
`;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM actividad_diaria
            ${whereClause}
        `;

        params.push(parseInt(limite), offset);

        const [historialResult, countResult] = await Promise.all([
            query(historialQuery, params),
            query(countQuery, params.slice(0, -2))
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPaginas = Math.ceil(total / parseInt(limite));

        const duration = Date.now() - startTime;
        logSuccess('getHistorial', { 
            records: historialResult.rows.length,
            total: total 
        }, duration);

        res.json({
            success: true,
            data: {
                registros: historialResult.rows,
                total: total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total_paginas: totalPaginas
            }
        });

    } catch (error) {
        logError('getHistorial', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            error: 'Error al obtener historial',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// Reemplaza exports.getEstadisticasRapidas con esto:
exports.getEstadisticasRapidas = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getEstadisticasRapidas', req);

        const { usuario_id, dias = 7 } = req.query;
        const userId = usuario_id || req.user.id;

        // Validación de permisos (del segundo método)
        if (usuario_id && usuario_id !== req.user.id.toString()) {
            if (req.user.rol !== 'admin' && req.user.rol !== 'manager') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver estadísticas de otros usuarios'
                });
            }
        }

        // Validar parámetro de días (del segundo método)
        const diasNum = parseInt(dias);
        if (diasNum < 1 || diasNum > 90) {
            return res.status(400).json({
                success: false,
                message: 'El número de días debe estar entre 1 y 90'
            });
        }

        // Query directo (del primer método, pero corregido)
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasNum);

        const statsQuery = `
            SELECT 
                COUNT(*) as dias_activos,
                COUNT(CASE WHEN estado_jornada = 'finalizada' THEN 1 END) as dias_completos,
                AVG(CASE 
                    WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0
                    ELSE 0
                END) as promedio_horas,
                SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                AVG((mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) + 
                    (llamadas_realizadas + llamadas_recibidas)) as promedio_actividad
            FROM actividad_diaria
            WHERE usuario_id = $1 
                AND fecha >= $2
        `;

        const result = await query(statsQuery, [userId, fechaLimite.toISOString().split('T')[0]]);
        const stats = result.rows[0] || {};

        const duration = Date.now() - startTime;
        logSuccess('getEstadisticasRapidas', { 
            dias_activos: stats.dias_activos,
            target_user: userId 
        }, duration);

        res.json({
            success: true,
            data: {
                periodo_dias: diasNum,
                resumen: {
                    dias_activos: parseInt(stats.dias_activos || 0),
                    dias_completos: parseInt(stats.dias_completos || 0),
                    promedio_horas_diarias: parseFloat(stats.promedio_horas || 0),
                    total_mensajes: parseInt(stats.total_mensajes || 0),
                    total_llamadas: parseInt(stats.total_llamadas || 0),
                    promedio_actividad_diaria: parseFloat(stats.promedio_actividad || 0)
                }
            }
        });

    } catch (error) {
        logError('getEstadisticasRapidas', error, {
            userId: req.user.id,
            targetUserId: usuario_id,
            dias: dias
        });
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// ============================================
// OBTENER RESUMEN SEMANAL (BONUS ENDPOINT)
// ============================================
exports.getResumenSemanal = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getResumenSemanal', req);

        const userId = req.user.id;
        
        // Calcular fechas de la semana actual (Lima timezone)
        const hoy = new Date();
        const fechaLima = new Date(hoy.toLocaleString('en-US', { timeZone: 'America/Lima' }));
        
        // Obtener el lunes de esta semana
        const lunes = new Date(fechaLima);
        lunes.setDate(fechaLima.getDate() - fechaLima.getDay() + 1);
        
        // Obtener el domingo de esta semana
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);

        const fechaInicio = lunes.toISOString().split('T')[0];
        const fechaFin = domingo.toISOString().split('T')[0];

        // Obtener datos de la semana
        const resumenQuery = `
            SELECT 
                fecha,
                EXTRACT(DOW FROM fecha) as dia_semana,
                TO_CHAR(fecha, 'Day') as nombre_dia,
                check_in_time,
                check_out_time,
                estado_jornada,
                CASE 
                    WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0
                    ELSE 0
                END as horas_trabajadas,
                (mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                (llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                CASE 
                    WHEN check_in_time IS NOT NULL THEN
                        EXTRACT(HOUR FROM check_in_time)
                    ELSE NULL
                END as hora_llegada
            FROM actividad_diaria
            WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
            ORDER BY fecha ASC
        `;

        const result = await query(resumenQuery, [userId, fechaInicio, fechaFin]);
        
        // Procesar datos por día
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const resumenDias = [];
        
        for (let i = 0; i < 7; i++) {
            const fechaDia = new Date(lunes);
            fechaDia.setDate(lunes.getDate() + i);
            const fechaStr = fechaDia.toISOString().split('T')[0];
            
            const registroDia = result.rows.find(row => row.fecha === fechaStr);
            
            resumenDias.push({
                fecha: fechaStr,
                dia_semana: diasSemana[i],
                nombre_dia: diasSemana[i],
                trabajado: !!registroDia,
                horas_trabajadas: parseFloat(registroDia?.horas_trabajadas || 0),
                total_mensajes: parseInt(registroDia?.total_mensajes || 0),
                total_llamadas: parseInt(registroDia?.total_llamadas || 0),
                estado_jornada: registroDia?.estado_jornada || 'no_trabajado',
                hora_llegada: registroDia?.hora_llegada || null,
                puntualidad: registroDia?.hora_llegada ? 
                    (registroDia.hora_llegada <= 8 ? 'puntual' : 
                     registroDia.hora_llegada <= 10 ? 'aceptable' : 'tardio') : null
            });
        }

        // Calcular totales de la semana
        const totalHoras = resumenDias.reduce((sum, dia) => sum + dia.horas_trabajadas, 0);
        const totalMensajes = resumenDias.reduce((sum, dia) => sum + dia.total_mensajes, 0);
        const totalLlamadas = resumenDias.reduce((sum, dia) => sum + dia.total_llamadas, 0);
        const diasTrabajados = resumenDias.filter(dia => dia.trabajado).length;
        const diasPuntuales = resumenDias.filter(dia => dia.puntualidad === 'puntual').length;

        const resumenSemana = {
            periodo: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                semana: `Semana ${Math.ceil(fechaLima.getDate() / 7)} de ${fechaLima.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`
            },
            totales: {
                dias_trabajados: diasTrabajados,
                total_horas: parseFloat(totalHoras.toFixed(1)),
                total_mensajes: totalMensajes,
                total_llamadas: totalLlamadas,
                promedio_horas_diarias: diasTrabajados > 0 ? parseFloat((totalHoras / diasTrabajados).toFixed(1)) : 0,
                tasa_puntualidad: diasTrabajados > 0 ? parseFloat(((diasPuntuales / diasTrabajados) * 100).toFixed(1)) : 0
            },
            detalle_dias: resumenDias,
            analisis: {
                mejor_dia: resumenDias.reduce((mejor, actual) => 
                    actual.horas_trabajadas > mejor.horas_trabajadas ? actual : mejor, 
                    resumenDias[0]
                ),
                consistencia: diasTrabajados >= 5 ? 'excelente' : 
                             diasTrabajados >= 3 ? 'buena' : 'mejorable'
            }
        };

        const duration = Date.now() - startTime;
        logSuccess('getResumenSemanal', {
            dias_trabajados: diasTrabajados,
            total_horas: totalHoras
        }, duration);

        res.json({
            success: true,
            message: 'Resumen semanal obtenido exitosamente',
            data: resumenSemana
        });

    } catch (error) {
        logError('getResumenSemanal', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error interno al obtener resumen semanal',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// DATOS PARA GRÁFICOS TEMPORALES
// ============================================
exports.getDatosGraficos = async (req, res) => {
    const startTime = Date.now();

    try {
        logRequest('getDatosGraficos', req);

        const { vista = 'semanal', periodo, usuario_id, fecha_inicio, fecha_fin } = req.query;
        const vistaActual = periodo || vista;
        const userId = req.user.id;
        const userRole = req.user.rol?.toUpperCase();

        // Verificar permisos: jefes pueden ver otros usuarios
        const esManager = ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(userRole);

        // Determinar filtro de usuario:
        // - Si es manager y NO hay usuario_id → vista global (todos los asesores)
        // - Si es manager y hay usuario_id → ese usuario específico
        // - Si NO es manager → siempre su propio ID
        let filtroUsuario = null;
        if (usuario_id && esManager) {
            filtroUsuario = usuario_id; // Usuario específico
        } else if (!esManager) {
            filtroUsuario = userId; // Solo sus datos
        }
        // Si esManager y NO hay usuario_id, filtroUsuario = null (todos)

        let datos = [];
        const fechaHoy = new Date().toLocaleDateString('en-CA', {
            timeZone: 'America/Lima'
        });

        switch(vistaActual) {
            case 'semanal':
                // Últimos 7 días
                const fechaInicioSemanal = fecha_inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
                    timeZone: 'America/Lima'
                });

                let querySemanal, paramsSemanal;
                if (filtroUsuario) {
                    // Usuario específico
                    querySemanal = `
                        SELECT
                            fecha,
                            TO_CHAR(fecha, 'YYYY-MM-DD') as fecha_str,
                            EXTRACT(DOW FROM fecha) as dia_semana,
                            TO_CHAR(fecha, 'Day') as nombre_dia,
                            COALESCE(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok, 0) as total_mensajes,
                            COALESCE(llamadas_realizadas + llamadas_recibidas, 0) as total_llamadas,
                            COALESCE(jornada_horas, 0) as horas_efectivas,
                            estado_entrada,
                            minutos_tardanza,
                            estado_jornada
                        FROM actividad_diaria
                        WHERE usuario_id = $1 AND fecha >= $2 AND fecha <= $3
                        ORDER BY fecha ASC
                    `;
                    paramsSemanal = [filtroUsuario, fechaInicioSemanal, fechaHoy];
                } else {
                    // Vista global (suma de todos los asesores)
                    querySemanal = `
                        SELECT
                            fecha,
                            TO_CHAR(fecha, 'YYYY-MM-DD') as fecha_str,
                            EXTRACT(DOW FROM fecha) as dia_semana,
                            TO_CHAR(fecha, 'Day') as nombre_dia,
                            COALESCE(SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok), 0) as total_mensajes,
                            COALESCE(SUM(llamadas_realizadas + llamadas_recibidas), 0) as total_llamadas,
                            COALESCE(SUM(jornada_horas), 0) as horas_efectivas
                        FROM actividad_diaria
                        WHERE fecha >= $1 AND fecha <= $2
                        GROUP BY fecha, fecha_str, dia_semana, nombre_dia
                        ORDER BY fecha ASC
                    `;
                    paramsSemanal = [fechaInicioSemanal, fechaHoy];
                }

                const datosSemana = await query(querySemanal, paramsSemanal);

                // Crear array con todos los días de la semana
                const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                datos = [];

                for (let i = 0; i < 7; i++) {
                    const fecha = new Date(Date.now() - (6-i) * 24 * 60 * 60 * 1000);
                    const fechaStr = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
                    const registro = datosSemana.rows.find(row => row.fecha_str === fechaStr);

                    datos.push({
                        fecha: fechaStr,
                        dia: diasSemana[fecha.getDay()],
                        mensajes: registro ? parseInt(registro.total_mensajes) : 0,
                        llamadas: registro ? parseInt(registro.total_llamadas) : 0,
                        horas: registro ? parseFloat(registro.horas_efectivas) : 0,
                        actividad_total: registro ? (parseInt(registro.total_mensajes) + parseInt(registro.total_llamadas)) : 0,
                        puntual: registro ? (registro.estado_entrada === 'puntual') : null,
                        tardanza: registro ? parseInt(registro.minutos_tardanza || 0) : 0,
                        trabajado: !!registro
                    });
                }
                break;

            case 'mensual':
                // Últimas 4 semanas - agrupado por semanas
                const fechaInicioMensual = fecha_inicio || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
                    timeZone: 'America/Lima'
                });

                let queryMensual, paramsMensual;
                if (filtroUsuario) {
                    queryMensual = `
                        SELECT
                            DATE_TRUNC('week', fecha) as semana,
                            EXTRACT(WEEK FROM fecha) as numero_semana,
                            TO_CHAR(DATE_TRUNC('week', fecha), 'Mon DD') as semana_label,
                            SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                            SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                            SUM(jornada_horas) as total_horas,
                            COUNT(*) as dias_trabajados,
                            SUM(CASE WHEN estado_entrada = 'puntual' THEN 1 ELSE 0 END) as dias_puntuales
                        FROM actividad_diaria
                        WHERE usuario_id = $1 AND fecha >= $2 AND fecha <= $3
                        GROUP BY DATE_TRUNC('week', fecha), EXTRACT(WEEK FROM fecha)
                        ORDER BY semana ASC
                    `;
                    paramsMensual = [filtroUsuario, fechaInicioMensual, fechaHoy];
                } else {
                    queryMensual = `
                        SELECT
                            DATE_TRUNC('week', fecha) as semana,
                            EXTRACT(WEEK FROM fecha) as numero_semana,
                            TO_CHAR(DATE_TRUNC('week', fecha), 'Mon DD') as semana_label,
                            SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                            SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                            SUM(jornada_horas) as total_horas,
                            COUNT(*) as dias_trabajados,
                            SUM(CASE WHEN estado_entrada = 'puntual' THEN 1 ELSE 0 END) as dias_puntuales
                        FROM actividad_diaria
                        WHERE fecha >= $1 AND fecha <= $2
                        GROUP BY DATE_TRUNC('week', fecha), EXTRACT(WEEK FROM fecha)
                        ORDER BY semana ASC
                    `;
                    paramsMensual = [fechaInicioMensual, fechaHoy];
                }

                const datosMes = await query(queryMensual, paramsMensual);

                datos = datosMes.rows.map((row, index) => ({
                    dia: `Sem ${index + 1}`,
                    semana_completa: row.semana_label,
                    fecha: row.semana,
                    mensajes: parseInt(row.total_mensajes || 0),
                    llamadas: parseInt(row.total_llamadas || 0),
                    horas: parseFloat(row.total_horas || 0),
                    actividad_total: parseInt(row.total_mensajes || 0) + parseInt(row.total_llamadas || 0),
                    dias_trabajados: parseInt(row.dias_trabajados || 0),
                    puntualidad: row.dias_trabajados > 0 ? Math.round((row.dias_puntuales / row.dias_trabajados) * 100) : 0
                }));
                break;

            case 'trimestral':
                // Últimos 3 meses agrupados por mes
                const fechaInicioTrimestral = fecha_inicio || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
                    timeZone: 'America/Lima'
                });

                let queryTrimestral, paramsTrimestral;
                if (filtroUsuario) {
                    queryTrimestral = `
                        SELECT
                            DATE_TRUNC('month', fecha) as mes,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Mon') as mes_abrev,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Month YYYY') as nombre_mes_completo,
                            SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                            SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                            SUM(jornada_horas) as total_horas,
                            COUNT(*) as dias_trabajados,
                            SUM(CASE WHEN estado_entrada = 'puntual' THEN 1 ELSE 0 END) as dias_puntuales
                        FROM actividad_diaria
                        WHERE usuario_id = $1 AND fecha >= $2 AND fecha <= $3
                        GROUP BY DATE_TRUNC('month', fecha)
                        ORDER BY mes ASC
                    `;
                    paramsTrimestral = [filtroUsuario, fechaInicioTrimestral, fechaHoy];
                } else {
                    queryTrimestral = `
                        SELECT
                            DATE_TRUNC('month', fecha) as mes,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Mon') as mes_abrev,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Month YYYY') as nombre_mes_completo,
                            SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                            SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                            SUM(jornada_horas) as total_horas,
                            COUNT(*) as dias_trabajados,
                            SUM(CASE WHEN estado_entrada = 'puntual' THEN 1 ELSE 0 END) as dias_puntuales
                        FROM actividad_diaria
                        WHERE fecha >= $1 AND fecha <= $2
                        GROUP BY DATE_TRUNC('month', fecha)
                        ORDER BY mes ASC
                    `;
                    paramsTrimestral = [fechaInicioTrimestral, fechaHoy];
                }

                const datosTrimestre = await query(queryTrimestral, paramsTrimestral);

                datos = datosTrimestre.rows.map(row => ({
                    dia: row.mes_abrev.trim(),
                    mes_completo: row.nombre_mes_completo.trim(),
                    fecha: row.mes,
                    mensajes: parseInt(row.total_mensajes || 0),
                    llamadas: parseInt(row.total_llamadas || 0),
                    horas: parseFloat(row.total_horas || 0),
                    actividad_total: parseInt(row.total_mensajes || 0) + parseInt(row.total_llamadas || 0),
                    dias_trabajados: parseInt(row.dias_trabajados || 0),
                    puntualidad: row.dias_trabajados > 0 ? Math.round((row.dias_puntuales / row.dias_trabajados) * 100) : 0
                }));
                break;

            case 'anual':
                // Últimos 12 meses agrupados por mes
                const fechaInicioAnual = fecha_inicio || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
                    timeZone: 'America/Lima'
                });

                let queryAnual, paramsAnual;

                if (filtroUsuario) {
                    // Vista individual - usuario específico
                    queryAnual = `
                        SELECT
                            DATE_TRUNC('month', fecha) as mes,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Mon') as mes_abrev,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Mon YYYY') as mes_anio,
                            SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                            SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                            SUM(jornada_horas) as total_horas,
                            COUNT(*) as dias_trabajados,
                            SUM(CASE WHEN estado_entrada = 'puntual' THEN 1 ELSE 0 END) as dias_puntuales
                        FROM actividad_diaria
                        WHERE usuario_id = $1 AND fecha >= $2 AND fecha <= $3
                        GROUP BY DATE_TRUNC('month', fecha)
                        ORDER BY mes ASC
                    `;
                    paramsAnual = [filtroUsuario, fechaInicioAnual, fechaHoy];
                } else {
                    // Vista global - suma de todos los asesores
                    queryAnual = `
                        SELECT
                            DATE_TRUNC('month', fecha) as mes,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Mon') as mes_abrev,
                            TO_CHAR(DATE_TRUNC('month', fecha), 'Mon YYYY') as mes_anio,
                            SUM(mensajes_meta + mensajes_whatsapp + mensajes_instagram + mensajes_tiktok) as total_mensajes,
                            SUM(llamadas_realizadas + llamadas_recibidas) as total_llamadas,
                            SUM(jornada_horas) as total_horas,
                            COUNT(*) as dias_trabajados,
                            SUM(CASE WHEN estado_entrada = 'puntual' THEN 1 ELSE 0 END) as dias_puntuales
                        FROM actividad_diaria
                        WHERE fecha >= $1 AND fecha <= $2
                        GROUP BY DATE_TRUNC('month', fecha)
                        ORDER BY mes ASC
                    `;
                    paramsAnual = [fechaInicioAnual, fechaHoy];
                }

                const datosAnual = await query(queryAnual, paramsAnual);

                datos = datosAnual.rows.map(row => ({
                    dia: row.mes_abrev.trim(),
                    mes_anio: row.mes_anio.trim(),
                    fecha: row.mes,
                    mensajes: parseInt(row.total_mensajes || 0),
                    llamadas: parseInt(row.total_llamadas || 0),
                    horas: parseFloat(row.total_horas || 0),
                    actividad_total: parseInt(row.total_mensajes || 0) + parseInt(row.total_llamadas || 0),
                    dias_trabajados: parseInt(row.dias_trabajados || 0),
                    puntualidad: row.dias_trabajados > 0 ? Math.round((row.dias_puntuales / row.dias_trabajados) * 100) : 0
                }));
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Vista no válida. Use: semanal, mensual, trimestral, anual'
                });
        }

        const duration = Date.now() - startTime;
        logSuccess('getDatosGraficos', {
            vista: vistaActual,
            registros: datos.length,
            usuario_objetivo: filtroUsuario || 'vista_global'
        }, duration);

        res.json({
            success: true,
            data: {
                vista: vistaActual,
                datos,
                usuario_id: filtroUsuario,
                es_manager: esManager,
                vista_global: !filtroUsuario && esManager,
                fecha_generacion: new Date().toISOString()
            }
        });

    } catch (error) {
        logError('getDatosGraficos', error, { userId: req.user.id });
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos para gráficos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// LOGGING FINAL
// ============================================
console.log('✅ ActividadDiariaController loaded successfully - Enterprise check-in/check-out system ready');
console.log('🎯 Available endpoints: checkIn, checkOut, getEstadoHoy, getActividad, getDashboard');
console.log('🆕 New endpoints: getHistorial, getEstadisticasRapidas, getResumenSemanal');
console.log('🔒 Security: RLS enabled, Role-based access, Business validations');
console.log('🌎 TIMEZONE CORRECTION: All operations now use Lima timezone (UTC-5)');

// Mostrar configuración de validación de horarios
if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SCHEDULE_VALIDATION === 'true') {
    console.log('⚠️  DEVELOPMENT MODE: Schedule validation bypassed');
} else {
    console.log('🕐 Business hours enforced (Lima time):');
    console.log('   Lunes-Viernes: Check-in 8AM-12PM, Check-out 5PM-6:10PM');
    console.log('   Sábado: Check-in 9:15AM-10AM, Check-out 11AM-12PM');
    console.log('   Domingo: No disponible');
}

console.log('');