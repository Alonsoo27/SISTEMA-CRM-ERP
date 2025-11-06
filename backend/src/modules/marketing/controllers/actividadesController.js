// ============================================
// CONTROLLER DE ACTIVIDADES - MARKETING
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('../services/reajusteService');
const actividadesService = require('../services/actividadesService');
const colisionesService = require('../services/colisionesService');
const resolucionColisionesService = require('../services/resolucionColisionesService');
const { agregarZonaHorariaUTC } = require('../../../utils/timezoneHelper');

// Mapeo de colores por categoría principal
const COLORES_CATEGORIAS = {
    'GRABACIONES': '#3B82F6',
    'EDICIONES': '#F59E0B',
    'LIVES': '#EC4899',
    'DISEÑO': '#A855F7',
    'FICHAS TÉCNICAS': '#64748B',
    'FERIA': '#0EA5E9',
    'REUNIONES': '#84CC16',
    'PRUEBAS Y MUESTRAS': '#F43F5E',
    'CAPACITACIONES': '#16A34A'
};

// Función helper para obtener color por categoría
function obtenerColorCategoria(categoria_principal) {
    return COLORES_CATEGORIAS[categoria_principal] || '#3B82F6'; // Azul por defecto
}

// Función helper para validar horario laboral
function validarHorarioLaboral(fecha) {
    const diaSemana = fecha.getDay(); // 0=Domingo, 6=Sábado
    const hora = fecha.getHours();
    const minuto = fecha.getMinutes();
    const horaDecimal = hora + (minuto / 60);

    // Domingo: NO laboral
    if (diaSemana === 0) {
        return {
            valido: false,
            mensaje: 'No se pueden programar actividades los domingos'
        };
    }

    // Sábado: 9 AM - 12 PM
    if (diaSemana === 6) {
        if (horaDecimal < 9 || horaDecimal >= 12) {
            return {
                valido: false,
                mensaje: 'Los sábados el horario laboral es de 9:00 AM a 12:00 PM'
            };
        }
        return { valido: true };
    }

    // Lunes-Viernes: 8 AM - 6 PM (excluyendo almuerzo 1-2 PM)
    if (horaDecimal < 8 || horaDecimal >= 18) {
        return {
            valido: false,
            mensaje: 'El horario laboral de lunes a viernes es de 8:00 AM a 6:00 PM'
        };
    }

    // Verificar que no esté en horario de almuerzo (1 PM - 2 PM)
    if (horaDecimal >= 13 && horaDecimal < 14) {
        return {
            valido: false,
            mensaje: 'No se pueden programar actividades durante el horario de almuerzo (1:00 PM - 2:00 PM)'
        };
    }

    return { valido: true };
}

class ActividadesController {
    /**
     * Crear actividad individual
     * V2: Con validaciones de colisiones completas
     */
    static async crearActividad(req, res) {
        try {
            const { user_id: usuarioLogueado, rol } = req.user;
            const {
                categoria_principal,
                subcategoria,
                descripcion,
                duracion_minutos,
                fecha_inicio,
                es_prioritaria = false,
                usuario_id, // ID del usuario para quien se crea (opcional)
                confirmar_colision = false // Flag para confirmar que usuario acepta la colisión
            } = req.body;

            // Determinar para quién es la actividad
            const usuarioDestino = usuario_id || usuarioLogueado;

            // Validar permisos: solo jefe+ puede crear para otros
            if (usuario_id && usuario_id !== usuarioLogueado) {
                const puedeCrearParaOtros = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
                if (!puedeCrearParaOtros) {
                    return res.status(403).json({
                        success: false,
                        message: 'Solo el jefe de marketing y superiores pueden crear actividades para otros usuarios'
                    });
                }
            }

            // Validaciones básicas
            if (!categoria_principal || !subcategoria || !descripcion || !duracion_minutos) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: categoria_principal, subcategoria, descripcion, duracion_minutos'
                });
            }

            if (duracion_minutos <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La duración debe ser mayor a 0 minutos'
                });
            }

            const MAX_MINUTOS = 14400;
            if (duracion_minutos > MAX_MINUTOS) {
                const diasSolicitados = Math.round(duracion_minutos / 60 / 8);
                const diasMaximos = MAX_MINUTOS / 60 / 8;
                return res.status(400).json({
                    success: false,
                    message: `La duración máxima permitida es de ${diasMaximos} días laborales. Estás intentando crear una actividad de ${diasSolicitados} días. Por favor, divide esta actividad en partes más pequeñas.`
                });
            }

            // Validar que el tipo de actividad existe
            const tipoResult = await query(
                'SELECT 1 FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2',
                [categoria_principal, subcategoria]
            );

            if (tipoResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de actividad no válido'
                });
            }

            // VALIDACIÓN #1: Bloquear fechas al pasado
            if (fecha_inicio) {
                const fechaManual = new Date(fecha_inicio);
                const ahora = new Date();

                // Validar que la fecha sea válida
                if (isNaN(fechaManual.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Fecha inválida. Formato esperado: YYYY-MM-DDTHH:mm'
                    });
                }

                // Comparar con margen de 1 minuto para evitar problemas de sincronización
                const MARGEN_SEGUNDOS = 60;
                const diferencia = (fechaManual - ahora) / 1000; // segundos

                console.log('🕐 Validando fecha:', {
                    fecha_recibida: fecha_inicio,
                    fecha_parseada_utc: fechaManual.toISOString(),
                    ahora_utc: ahora.toISOString(),
                    diferencia_segundos: Math.round(diferencia)
                });

                if (diferencia < -MARGEN_SEGUNDOS) {
                    return res.status(400).json({
                        success: false,
                        message: `No se pueden programar actividades en el pasado. La fecha debe ser posterior a ${ahora.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
                    });
                }

                // VALIDACIÓN #1.5: Verificar horario laboral
                const validacionHorario = validarHorarioLaboral(fechaManual);
                if (!validacionHorario.valido) {
                    return res.status(400).json({
                        success: false,
                        message: validacionHorario.mensaje
                    });
                }
            }

            // Obtener color
            const color_hex = obtenerColorCategoria(categoria_principal);

            // Calcular fecha de inicio
            let fechaInicioPlaneada;
            let esAutomatica = false;

            if (fecha_inicio) {
                // FECHA MANUAL
                fechaInicioPlaneada = new Date(fecha_inicio);
                console.log('📅 Usando fecha_inicio MANUAL:', fecha_inicio);
            } else {
                // FECHA AUTOMÁTICA
                esAutomatica = true;

                // Para actividades PRIORITARIAS automáticas: usar AHORA
                // Esto permite que la detección de colisiones funcione correctamente
                if (es_prioritaria) {
                    fechaInicioPlaneada = new Date();
                    console.log('📅 Actividad PRIORITARIA automática - Usando AHORA:', fechaInicioPlaneada);
                } else {
                    // Para actividades NORMALES: buscar hueco disponible
                    const slotInfo = await actividadesService.obtenerProximoSlotDisponible(
                        usuarioDestino,
                        duracion_minutos
                    );

                    // Si obtenerProximoSlotDisponible retorna objeto con info
                    if (typeof slotInfo === 'object' && slotInfo.fecha) {
                        fechaInicioPlaneada = slotInfo.fecha;

                        // Para actividades NORMALES, si no hay espacio suficiente, buscar al final
                        if (!slotInfo.esSuficiente) {
                            console.log('⚠️ No hay espacio suficiente en slot encontrado para actividad normal');
                            // Buscar siguiente hueco suficiente
                            const huecoPosterior = await colisionesService.buscarHuecoPosterior(
                                usuarioDestino,
                                slotInfo.fecha,
                                duracion_minutos
                            );

                            if (huecoPosterior) {
                                fechaInicioPlaneada = huecoPosterior.inicio;
                            }
                        }
                    } else {
                        fechaInicioPlaneada = slotInfo;
                    }

                    console.log('📅 Usando fecha_inicio AUTOMÁTICA:', fechaInicioPlaneada);
                }
            }

            // Calcular fecha fin
            let fechaFinPlaneada = reajusteService.agregarMinutosEfectivos(
                new Date(fechaInicioPlaneada),
                duracion_minutos
            );

            // VALIDACIÓN #2: Detectar colisiones (solo para PRIORITARIAS)
            if (es_prioritaria && !confirmar_colision) {
                const colision = await colisionesService.detectarColisionesPrioritaria(
                    usuarioDestino,
                    fechaInicioPlaneada,
                    duracion_minutos
                );

                if (colision.hayColision) {
                    // Si colisiona con NORMAL → continuar (se cortará automáticamente después)
                    if (colision.tipo === 'normal') {
                        console.log('✅ Actividad prioritaria vs normal - Se ejecutará reajuste automático');
                        // No hacer nada, continuar con la creación
                    } else {
                        // Si colisiona con PRIORITARIA, GRUPAL o PROGRAMADA → devolver 409 (requiere confirmación)
                        console.log(`⚠️ Actividad prioritaria vs ${colision.tipo} - Requiere confirmación`);
                        return res.status(409).json({
                            success: false,
                            tipo_colision: colision.tipo,
                            mensaje: colision.mensaje,
                            actividad_conflicto: colision.actividad,
                            sugerencias: colision.sugerencias || null,
                            requiere_confirmacion: colision.requiere_confirmacion || false,
                            advertencia: colision.advertencia || null,
                            instruccion: 'Para continuar, vuelve a enviar la solicitud con confirmar_colision: true'
                        });
                    }
                }
            }

            // VALIDACIÓN #3: Alertas informativas para actividades NORMALES con fecha manual
            let huboReprogramacion = false;
            let infoReprogramacion = null;

            if (!es_prioritaria && fecha_inicio) {
                const colision = await colisionesService.detectarColisionesPrioritaria(
                    usuarioDestino,
                    fechaInicioPlaneada,
                    duracion_minutos
                );

                if (colision.hayColision) {
                    // Para actividades normales, reprogramar automáticamente después
                    console.log('ℹ️ Actividad normal con colisión, reprogramando automáticamente');

                    const huecoPosterior = await colisionesService.buscarHuecoPosterior(
                        usuarioDestino,
                        colision.actividad.fecha_fin,
                        duracion_minutos
                    );

                    if (huecoPosterior) {
                        const fechaOriginal = new Date(fechaInicioPlaneada);

                        // Actualizar fecha de inicio planeada
                        fechaInicioPlaneada = new Date(huecoPosterior.inicio);

                        // Recalcular fin
                        fechaFinPlaneada = reajusteService.agregarMinutosEfectivos(
                            fechaInicioPlaneada,
                            duracion_minutos
                        );

                        // Guardar info para retornar después de crear la actividad
                        huboReprogramacion = true;
                        infoReprogramacion = {
                            actividad_conflicto: {
                                descripcion: colision.actividad.descripcion,
                                fecha_inicio: colision.actividad.fecha_inicio,
                                fecha_fin: colision.actividad.fecha_fin
                            },
                            fecha_original: fechaOriginal,
                            nueva_fecha: fechaInicioPlaneada
                        };

                        console.log('📅 Actividad reprogramada:', {
                            original: fechaOriginal,
                            nueva: fechaInicioPlaneada
                        });
                    }
                }
            }

            console.log('📅 Creando actividad:', {
                usuarioDestino,
                usuarioLogueado,
                fecha_inicio_recibida: fecha_inicio || 'NO ENVIADA (automático)',
                fechaInicioPlaneada,
                fechaFinPlaneada,
                duracion_minutos,
                es_prioritaria
            });

            // Registrar huecos pasados
            await actividadesService.registrarHuecosPasados(usuarioDestino, fechaInicioPlaneada);

            // IMPORTANTE: Generar código DESPUÉS de registrar huecos para evitar duplicados
            const codigo = await actividadesService.generarCodigoActividad();

            // Insertar actividad
            const esProgramada = !!fecha_inicio; // true si se especificó fecha_inicio, false si fue automática

            const insertQuery = `
                INSERT INTO actividades_marketing (
                    codigo, categoria_principal, subcategoria, descripcion,
                    usuario_id, creado_por, tipo, es_prioritaria, es_programada,
                    fecha_inicio_planeada, fecha_fin_planeada, duracion_planeada_minutos,
                    color_hex, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pendiente')
                RETURNING *
            `;

            const result = await query(insertQuery, [
                codigo,
                categoria_principal,
                subcategoria,
                descripcion,
                usuarioDestino,
                usuarioLogueado,
                'individual',
                es_prioritaria,
                esProgramada,
                fechaInicioPlaneada,
                fechaFinPlaneada,
                duracion_minutos,
                color_hex
            ]);

            const actividad = result.rows[0];

            // Si es prioritaria, reajustar actividades existentes
            if (es_prioritaria) {
                await reajusteService.reajustarActividades(
                    usuarioDestino,
                    fechaInicioPlaneada,
                    duracion_minutos,
                    actividad.id
                );
            }

            // Respuesta con información de reprogramación si aplica
            const response = {
                success: true,
                message: huboReprogramacion
                    ? 'Actividad creada y reprogramada automáticamente por conflicto de horarios'
                    : 'Actividad creada exitosamente',
                data: actividad,
                automatica: esAutomatica
            };

            if (huboReprogramacion) {
                response.reprogramada = true;
                response.actividad_conflicto = infoReprogramacion.actividad_conflicto;
                response.fecha_solicitada = infoReprogramacion.fecha_original;
                response.fecha_asignada = infoReprogramacion.nueva_fecha;
            }

            res.status(201).json(response);

        } catch (error) {
            console.error('Error creando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Crear actividad grupal (solo JEFE_MARKETING)
     * V2: Con validaciones de colisiones completas
     */
    static async crearActividadGrupal(req, res) {
        try {
            const { user_id, rol } = req.user;
            const {
                categoria_principal,
                subcategoria,
                descripcion,
                duracion_minutos,
                fecha_inicio,
                participantes_ids,
                es_prioritaria = true // Ahora es configurable, por defecto true
            } = req.body;

            // Validar que sea jefe de marketing
            if (rol !== 'JEFE_MARKETING' && !['SUPER_ADMIN', 'GERENTE'].includes(rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el Jefe de Marketing puede crear actividades grupales'
                });
            }

            // Validaciones básicas
            if (!participantes_ids || participantes_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe seleccionar al menos un participante'
                });
            }

            // VALIDACIÓN #1: fecha_inicio es OBLIGATORIA para actividades grupales
            if (!fecha_inicio) {
                return res.status(400).json({
                    success: false,
                    message: 'Las actividades grupales requieren fecha y hora específica'
                });
            }

            // VALIDACIÓN #2: Bloquear fechas al pasado
            const fechaManual = new Date(fecha_inicio);
            const ahora = new Date();

            // Validar que la fecha sea válida
            if (isNaN(fechaManual.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Fecha inválida. Formato esperado: YYYY-MM-DDTHH:mm'
                });
            }

            // Comparar con margen de 1 minuto para evitar problemas de sincronización
            const MARGEN_SEGUNDOS = 60;
            const diferencia = (fechaManual - ahora) / 1000; // segundos

            if (diferencia < -MARGEN_SEGUNDOS) {
                return res.status(400).json({
                    success: false,
                    message: `No se pueden programar actividades en el pasado. La fecha debe ser posterior a ${ahora.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
                });
            }

            // VALIDACIÓN #2.5: Verificar horario laboral
            const validacionHorario = validarHorarioLaboral(fechaManual);
            if (!validacionHorario.valido) {
                return res.status(400).json({
                    success: false,
                    message: validacionHorario.mensaje
                });
            }

            if (duracion_minutos <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La duración debe ser mayor a 0 minutos'
                });
            }

            const MAX_MINUTOS = 14400;
            if (duracion_minutos > MAX_MINUTOS) {
                const diasSolicitados = Math.round(duracion_minutos / 60 / 8);
                const diasMaximos = MAX_MINUTOS / 60 / 8;
                return res.status(400).json({
                    success: false,
                    message: `La duración máxima permitida es de ${diasMaximos} días laborales. Estás intentando crear una actividad de ${diasSolicitados} días. Por favor, divide esta actividad en partes más pequeñas.`
                });
            }

            // Validar que el tipo de actividad existe
            const tipoResult = await query(
                'SELECT 1 FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2',
                [categoria_principal, subcategoria]
            );

            if (tipoResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de actividad no válido'
                });
            }

            const fechaInicioPlaneada = fechaManual;
            const fechaFinPlaneada = reajusteService.agregarMinutosEfectivos(
                fechaInicioPlaneada,
                duracion_minutos
            );

            // VALIDACIÓN #3: Detectar colisiones con TODOS los participantes
            const colision = await colisionesService.detectarColisionesGrupal(
                participantes_ids,
                fechaInicioPlaneada,
                duracion_minutos
            );

            if (colision.hayColision) {
                // BLOQUEANTE: No se puede crear la grupal si hay colisiones con prioritarias
                return res.status(409).json({
                    success: false,
                    tipo_colision: colision.tipo,
                    bloqueante: colision.bloqueante,
                    mensaje: colision.mensaje,
                    conflictos: colision.conflictos,
                    sugerencias: colision.sugerencias,
                    mensaje_accion: 'Debes elegir otro horario para la actividad grupal'
                });
            }

            // Obtener color y código
            const color_hex = obtenerColorCategoria(categoria_principal);
            const codigo = await actividadesService.generarCodigoActividad();

            console.log('📅 Creando actividad grupal:', {
                participantes: participantes_ids.length,
                fecha_inicio: fechaInicioPlaneada,
                fecha_fin: fechaFinPlaneada,
                duracion_minutos,
                es_prioritaria
            });

            // Crear actividad para cada participante
            const actividadesCreadas = [];

            for (const participante_id of participantes_ids) {
                // Registrar huecos pasados para cada participante
                await actividadesService.registrarHuecosPasados(participante_id, fechaInicioPlaneada);

                const insertQuery = `
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo, es_grupal, es_prioritaria, es_programada,
                        participantes_ids, fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos, color_hex, estado
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pendiente')
                    RETURNING *
                `;

                const result = await query(insertQuery, [
                    `${codigo}-U${participante_id}`,
                    categoria_principal,
                    subcategoria,
                    descripcion,
                    participante_id,
                    user_id,
                    'grupal',
                    true,
                    es_prioritaria, // Ahora es configurable
                    true, // Las actividades grupales SIEMPRE son programadas (fecha_inicio obligatoria)
                    participantes_ids,
                    fechaInicioPlaneada,
                    fechaFinPlaneada,
                    duracion_minutos,
                    color_hex
                ]);

                actividadesCreadas.push(result.rows[0]);

                // Reajustar actividades de cada participante (siempre, porque se inserta forzadamente)
                await reajusteService.reajustarActividades(
                    participante_id,
                    fechaInicioPlaneada,
                    duracion_minutos,
                    result.rows[0].id
                );
            }

            res.status(201).json({
                success: true,
                message: 'Actividad grupal creada exitosamente',
                data: actividadesCreadas
            });

        } catch (error) {
            console.error('Error creando actividad grupal:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear actividad grupal',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Listar actividades con filtros
     */
    static async listarActividades(req, res) {
        try {
            const { user_id, rol } = req.user;
            const {
                usuario_id,
                estado,
                fecha_inicio,
                fecha_fin,
                categoria_principal,
                vista = 'semanal'
            } = req.query;

            let whereConditions = ['a.activo = true'];
            let params = [];
            let paramCount = 0;

            // Filtro por usuario
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);

            if (usuario_id && esJefe) {
                paramCount++;
                whereConditions.push(`a.usuario_id = $${paramCount}`);
                params.push(usuario_id);
            } else if (!usuario_id) {
                paramCount++;
                whereConditions.push(`a.usuario_id = $${paramCount}`);
                params.push(user_id);
            }

            // Filtro por estado
            if (estado) {
                paramCount++;
                whereConditions.push(`a.estado = $${paramCount}`);
                params.push(estado);
            }

            // Filtro por fechas
            if (fecha_inicio) {
                paramCount++;
                whereConditions.push(`a.fecha_inicio_planeada >= $${paramCount}`);
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                paramCount++;
                whereConditions.push(`a.fecha_fin_planeada <= $${paramCount}`);
                params.push(fecha_fin);
            }

            // Filtro por categoría
            if (categoria_principal) {
                paramCount++;
                whereConditions.push(`a.categoria_principal = $${paramCount}`);
                params.push(categoria_principal);
            }

            const whereClause = whereConditions.join(' AND ');

            const sql = `
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE ${whereClause}
                ORDER BY a.fecha_inicio_planeada ASC
            `;

            const result = await query(sql, params);

            // Agregar 'Z' a los timestamps para indicar que son UTC
            const actividadesConTimezone = agregarZonaHorariaUTC(result.rows);

            res.json({
                success: true,
                data: actividadesConTimezone,
                total: result.rowCount
            });

        } catch (error) {
            console.error('Error listando actividades:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar actividades',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Obtener actividad por ID
     */
    static async obtenerActividad(req, res) {
        try {
            const { id } = req.params;

            const result = await query(`
                SELECT
                    a.*,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    c.nombre || ' ' || c.apellido as creado_por_nombre
                FROM actividades_marketing a
                INNER JOIN usuarios u ON a.usuario_id = u.id
                INNER JOIN usuarios c ON a.creado_por = c.id
                WHERE a.id = $1
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            // Agregar 'Z' a los timestamps para indicar que son UTC
            const actividadConTimezone = agregarZonaHorariaUTC(result.rows[0]);

            res.json({
                success: true,
                data: actividadConTimezone
            });

        } catch (error) {
            console.error('Error obteniendo actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Editar actividad (requiere motivo)
     */
    static async editarActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { motivo_edicion, duracion_minutos, fecha_inicio } = req.body;

            if (!motivo_edicion) {
                return res.status(400).json({
                    success: false,
                    message: 'El motivo de edición es obligatorio'
                });
            }

            // Obtener actividad actual
            const actividadActual = await query('SELECT * FROM actividades_marketing WHERE id = $1', [id]);

            if (actividadActual.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            const actividad = actividadActual.rows[0];

            // VALIDACIÓN: No permitir editar actividades pasadas
            const ahora = new Date();
            const fechaFinPlaneada = new Date(actividad.fecha_fin_planeada);

            if (fechaFinPlaneada < ahora) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede editar una actividad que ya venció.'
                });
            }

            // VALIDACIÓN: Regla de 5 minutos para editar fecha_inicio en actividades EN_PROGRESO
            if (actividad.estado === 'en_progreso' && fecha_inicio) {
                const fechaInicioReal = new Date(actividad.fecha_inicio_real);
                const minutosDesdeInicio = (ahora - fechaInicioReal) / 60000;

                if (minutosDesdeInicio > 5) {
                    return res.status(400).json({
                        success: false,
                        message: 'No se puede cambiar la fecha de inicio de una actividad que lleva más de 5 minutos en progreso. Solo puedes editar la duración.'
                    });
                }
            }

            // ======================================
            // MANEJO ESPECIAL PARA ACTIVIDADES GRUPALES
            // ======================================
            let actividadesRelacionadas = [actividad];
            let todosParticipantes = [actividad.usuario_id];

            if (actividad.es_grupal) {
                console.log('👥 Actividad GRUPAL detectada - Editando para TODOS los participantes');

                // Extraer código base (sin el -usuario_id final)
                const codigoBase = actividad.codigo.replace(/-\d+$/, '');
                console.log(`📋 Código base: ${codigoBase}, buscando todas las actividades relacionadas...`);

                // Obtener TODAS las actividades con ese código base
                const actividadesGrupales = await query(`
                    SELECT * FROM actividades_marketing
                    WHERE codigo LIKE $1 AND activo = true
                    ORDER BY usuario_id
                `, [`${codigoBase}%`]);

                actividadesRelacionadas = actividadesGrupales.rows;
                todosParticipantes = actividadesRelacionadas.map(a => a.usuario_id);

                console.log(`👥 Encontrados ${actividadesRelacionadas.length} participantes: IDs ${todosParticipantes.join(', ')}`);
            }

            // Calcular nueva fecha inicio y fin
            // LÓGICA: Si la actividad está en progreso y NO se cambia fecha_inicio, partir desde fecha_inicio_real
            let nuevaFechaInicio;
            if (fecha_inicio) {
                // Usuario cambió explícitamente la fecha de inicio (reprogramar)
                nuevaFechaInicio = new Date(fecha_inicio);
            } else if (actividad.estado === 'en_progreso' && actividad.fecha_inicio_real) {
                // Actividad en progreso, calcular desde fecha_inicio_real
                nuevaFechaInicio = new Date(actividad.fecha_inicio_real);
            } else {
                // Actividad pendiente, usar fecha_inicio_planeada
                nuevaFechaInicio = new Date(actividad.fecha_inicio_planeada);
            }

            const duracionOriginal = actividad.duracion_planeada_minutos;
            const nuevaDuracion = duracion_minutos || duracionOriginal;
            const nuevaFechaFin = reajusteService.agregarMinutosEfectivos(nuevaFechaInicio, nuevaDuracion);

            // Detectar si se redujo duración (para optimizar calendario)
            const seReduceDuracion = duracion_minutos && duracion_minutos < duracionOriginal && !fecha_inicio;

            // VALIDACIÓN: Detectar colisiones para TODOS los participantes
            let todosConflictos = [];
            let hayBloqueo = false;
            let infoDesplazamiento = null;

            for (const participante of todosParticipantes) {
                const actividadParticipante = actividadesRelacionadas.find(a => a.usuario_id === participante);

                const colision = await colisionesService.detectarColisionesEdicion(
                    participante,
                    nuevaFechaInicio,
                    nuevaFechaFin,
                    actividadParticipante.id
                );

                if (colision.hayColision) {
                    todosConflictos.push({
                        usuario_id: participante,
                        conflictos: colision.conflictos,
                        bloqueante: colision.bloqueante
                    });

                    if (colision.bloqueante) {
                        hayBloqueo = true;
                    }
                }
            }

            // Si algún participante tiene colisión bloqueante, NO proceder
            if (hayBloqueo) {
                console.log('🚫 Colisión BLOQUEANTE detectada en al menos un participante');
                return res.status(409).json({
                    success: false,
                    tipo_error: 'colision_edicion_grupal',
                    mensaje: actividad.es_grupal
                        ? 'Uno o más participantes tienen conflictos de horario al editar esta actividad grupal'
                        : 'Hay conflictos de horario al editar esta actividad',
                    conflictos_por_participante: todosConflictos,
                    total_participantes_afectados: todosConflictos.filter(c => c.bloqueante).length,
                    instruccion: 'Elige otro horario o reduce la duración para evitar colisiones'
                });
            }

            // Si hay colisiones NO bloqueantes, informar
            if (todosConflictos.length > 0 && !hayBloqueo) {
                const totalActividadesDesplazadas = todosConflictos.reduce((sum, c) => sum + c.conflictos.length, 0);
                infoDesplazamiento = {
                    actividades_desplazadas: totalActividadesDesplazadas,
                    participantes_afectados: todosConflictos.length,
                    mensaje: actividad.es_grupal
                        ? `Se desplazarán ${totalActividadesDesplazadas} actividad(es) normal(es) de ${todosConflictos.length} participante(s)`
                        : `Se desplazarán ${totalActividadesDesplazadas} actividad(es) normal(es)`
                };
                console.log(`ℹ️ ${infoDesplazamiento.mensaje}`);
            }

            // Actualizar TODAS las actividades relacionadas (grupal) o solo la actual (individual)
            let result;
            if (actividad.es_grupal) {
                const idsActualizar = actividadesRelacionadas.map(a => a.id);
                console.log(`🔄 Actualizando ${idsActualizar.length} registros grupales...`);

                result = await query(`
                    UPDATE actividades_marketing SET
                        duracion_planeada_minutos = COALESCE($1, duracion_planeada_minutos),
                        fecha_inicio_planeada = COALESCE($2, fecha_inicio_planeada),
                        fecha_fin_planeada = $3,
                        editada = true,
                        motivo_edicion = $4,
                        editada_por = $5,
                        editada_en = NOW()
                    WHERE id = ANY($6::int[])
                    RETURNING *
                `, [
                    duracion_minutos,
                    fecha_inicio,
                    nuevaFechaFin,
                    motivo_edicion,
                    user_id,
                    idsActualizar
                ]);

                console.log(`✅ ${result.rows.length} actividades grupales editadas correctamente`);
            } else {
                result = await query(`
                    UPDATE actividades_marketing SET
                        duracion_planeada_minutos = COALESCE($1, duracion_planeada_minutos),
                        fecha_inicio_planeada = COALESCE($2, fecha_inicio_planeada),
                        fecha_fin_planeada = $3,
                        editada = true,
                        motivo_edicion = $4,
                        editada_por = $5,
                        editada_en = NOW()
                    WHERE id = $6
                    RETURNING *
                `, [
                    duracion_minutos,
                    fecha_inicio,
                    nuevaFechaFin,
                    motivo_edicion,
                    user_id,
                    id
                ]);

                console.log(`✅ Actividad individual editada correctamente`);
            }

            // Reajustar actividades posteriores para CADA participante (SOLO actividades normales)
            if (duracion_minutos || fecha_inicio) {
                for (const actividadActualizada of result.rows) {
                    await reajusteService.reajustarActividades(
                        actividadActualizada.usuario_id,
                        fecha_inicio || actividadActualizada.fecha_inicio_planeada,
                        duracion_minutos || actividadActualizada.duracion_planeada_minutos,
                        actividadActualizada.id,
                        true  // soloDesplazarNormales = true (NO mover programadas, grupales, prioritarias)
                    );
                }
            }

            // OPTIMIZACIÓN AUTOMÁTICA: Si se redujo duración, adelantar actividades posteriores
            let resultadoOptimizacion = null;
            if (seReduceDuracion) {
                console.log(`📊 Duración reducida de ${duracionOriginal} a ${nuevaDuracion} minutos - Optimizando calendario...`);
                const optimizacionService = require('../services/optimizacionService');

                try {
                    // Ejecutar optimización para cada actividad actualizada (por si es grupal)
                    for (const actividadActualizada of result.rows) {
                        const optimizacion = await optimizacionService.ejecutarOptimizacion(actividadActualizada.id);

                        if (optimizacion.success) {
                            console.log(`✅ Optimización aplicada: ${optimizacion.message}`);
                            resultadoOptimizacion = optimizacion;
                        }
                    }
                } catch (errorOptimizacion) {
                    console.warn('⚠️ Error en optimización automática (no crítico):', errorOptimizacion.message);
                    // No fallar la edición si la optimización falla
                }
            }

            // Agregar 'Z' a los timestamps para indicar que son UTC
            const actividadConTimezone = agregarZonaHorariaUTC(result.rows[0]);

            res.json({
                success: true,
                message: actividad.es_grupal
                    ? `Actividad grupal editada para ${result.rows.length} participante(s)`
                    : 'Actividad editada exitosamente',
                data: actividadConTimezone,
                participantes_actualizados: actividad.es_grupal ? result.rows.length : 1,
                info_desplazamiento: infoDesplazamiento,
                optimizacion: resultadoOptimizacion  // Incluir info de optimización si se aplicó
            });

        } catch (error) {
            console.error('Error editando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al editar actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Extender tiempo de actividad
     */
    static async extenderActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { minutos_adicionales, motivo } = req.body;

            if (!minutos_adicionales || minutos_adicionales <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Los minutos adicionales deben ser mayor a 0'
                });
            }

            // VALIDACIÓN: No permitir extender actividades pasadas
            const actividadCheck = await query(
                'SELECT fecha_fin_planeada, estado FROM actividades_marketing WHERE id = $1',
                [id]
            );

            if (actividadCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            const actividadValidacion = actividadCheck.rows[0];
            const ahora = new Date();
            const fechaFinPlaneada = new Date(actividadValidacion.fecha_fin_planeada);

            if (fechaFinPlaneada < ahora) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede extender una actividad que ya venció. Usa el sistema de gestión de vencidas.'
                });
            }

            // Obtener datos completos de la actividad
            const actividadCompleta = await query('SELECT * FROM actividades_marketing WHERE id = $1', [id]);
            const actividad = actividadCompleta.rows[0];

            // Calcular nueva fecha fin con la extensión
            const nuevaFechaFin = new Date(actividad.fecha_fin_planeada);
            nuevaFechaFin.setMinutes(nuevaFechaFin.getMinutes() + minutos_adicionales);

            // ======================================
            // MANEJO ESPECIAL PARA ACTIVIDADES GRUPALES
            // ======================================
            let actividadesRelacionadas = [actividad];
            let todosParticipantes = [actividad.usuario_id];

            if (actividad.es_grupal) {
                console.log('👥 Actividad GRUPAL detectada - Extendiendo para TODOS los participantes');

                // Extraer código base (sin el -usuario_id final)
                // Ejemplo: MKT-20250104-001-1 → MKT-20250104-001
                const codigoBase = actividad.codigo.replace(/-\d+$/, '');
                console.log(`📋 Código base: ${codigoBase}, buscando todas las actividades relacionadas...`);

                // Obtener TODAS las actividades con ese código base
                const actividadesGrupales = await query(`
                    SELECT * FROM actividades_marketing
                    WHERE codigo LIKE $1 AND activo = true
                    ORDER BY usuario_id
                `, [`${codigoBase}%`]);

                actividadesRelacionadas = actividadesGrupales.rows;
                todosParticipantes = actividadesRelacionadas.map(a => a.usuario_id);

                console.log(`👥 Encontrados ${actividadesRelacionadas.length} participantes: IDs ${todosParticipantes.join(', ')}`);
            }

            // VALIDACIÓN: Detectar colisiones para TODOS los participantes
            let todosConflictos = [];
            let hayBloqueo = false;
            let infoDesplazamiento = null;

            for (const participante of todosParticipantes) {
                const actividadParticipante = actividadesRelacionadas.find(a => a.usuario_id === participante);

                const colision = await colisionesService.detectarColisionesEdicion(
                    participante,
                    actividadParticipante.fecha_inicio_planeada,
                    nuevaFechaFin,
                    actividadParticipante.id
                );

                if (colision.hayColision) {
                    todosConflictos.push({
                        usuario_id: participante,
                        conflictos: colision.conflictos,
                        bloqueante: colision.bloqueante
                    });

                    if (colision.bloqueante) {
                        hayBloqueo = true;
                    }
                }
            }

            // Si algún participante tiene colisión bloqueante, NO proceder
            if (hayBloqueo) {
                console.log('🚫 Colisión BLOQUEANTE detectada en al menos un participante');
                return res.status(409).json({
                    success: false,
                    tipo_error: 'colision_extension_grupal',
                    mensaje: actividad.es_grupal
                        ? 'Uno o más participantes tienen conflictos de horario al extender esta actividad grupal'
                        : 'Hay conflictos de horario al extender esta actividad',
                    conflictos_por_participante: todosConflictos,
                    total_participantes_afectados: todosConflictos.filter(c => c.bloqueante).length,
                    instruccion: 'Reduce los minutos adicionales o resuelve los conflictos primero'
                });
            }

            // Si hay colisiones NO bloqueantes, informar
            if (todosConflictos.length > 0 && !hayBloqueo) {
                const totalActividadesDesplazadas = todosConflictos.reduce((sum, c) => sum + c.conflictos.length, 0);
                infoDesplazamiento = {
                    actividades_desplazadas: totalActividadesDesplazadas,
                    participantes_afectados: todosConflictos.length,
                    mensaje: actividad.es_grupal
                        ? `Se desplazarán ${totalActividadesDesplazadas} actividad(es) normal(es) de ${todosConflictos.length} participante(s)`
                        : `Se desplazarán ${totalActividadesDesplazadas} actividad(es) normal(es)`
                };
                console.log(`ℹ️ ${infoDesplazamiento.mensaje}`);
            }

            // Registrar extensión para cada participante
            for (const actividadRel of actividadesRelacionadas) {
                await query(`
                    INSERT INTO extensiones_actividades (actividad_id, usuario_id, minutos_adicionales, motivo)
                    VALUES ($1, $2, $3, $4)
                `, [actividadRel.id, user_id, minutos_adicionales, motivo]);
            }

            // Actualizar TODAS las actividades relacionadas (grupal) o solo la actual (individual)
            let result;
            if (actividad.es_grupal) {
                const idsActualizar = actividadesRelacionadas.map(a => a.id);
                console.log(`🔄 Actualizando ${idsActualizar.length} registros grupales...`);

                result = await query(`
                    UPDATE actividades_marketing SET
                        tiempo_adicional_minutos = tiempo_adicional_minutos + $1,
                        fecha_fin_planeada = fecha_fin_planeada + ($1 || ' minutes')::interval
                    WHERE id = ANY($2::int[])
                    RETURNING *
                `, [minutos_adicionales, idsActualizar]);

                console.log(`✅ ${result.rows.length} actividades grupales extendidas correctamente`);
            } else {
                result = await query(`
                    UPDATE actividades_marketing SET
                        tiempo_adicional_minutos = tiempo_adicional_minutos + $1,
                        fecha_fin_planeada = fecha_fin_planeada + ($1 || ' minutes')::interval
                    WHERE id = $2
                    RETURNING *
                `, [minutos_adicionales, id]);

                console.log(`✅ Actividad individual extendida correctamente`);
            }

            // Reajustar actividades posteriores para CADA participante (SOLO actividades normales)
            for (const actividadActualizada of result.rows) {
                await reajusteService.reajustarActividades(
                    actividadActualizada.usuario_id,
                    actividadActualizada.fecha_inicio_planeada,
                    actividadActualizada.duracion_planeada_minutos + minutos_adicionales,
                    actividadActualizada.id,
                    true  // soloDesplazarNormales = true (NO mover programadas, grupales, prioritarias)
                );
            }

            // Agregar 'Z' a los timestamps para indicar que son UTC
            const actividadConTimezone = agregarZonaHorariaUTC(result.rows[0]);

            res.json({
                success: true,
                message: actividad.es_grupal
                    ? `Actividad grupal extendida para ${result.rows.length} participante(s)`
                    : 'Actividad extendida exitosamente',
                data: actividadConTimezone,
                participantes_actualizados: actividad.es_grupal ? result.rows.length : 1,
                info_desplazamiento: infoDesplazamiento
            });

        } catch (error) {
            console.error('Error extendiendo actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al extender actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Completar actividad
     * NOTA: Permite completar en cualquier momento (antes o después del vencimiento)
     * útil para completar anticipadamente o registrar completadas fuera de tiempo
     * NUEVO: Soporte para actividades grupales
     */
    static async completarActividad(req, res) {
        try {
            const { id } = req.params;
            const { completar_todos_participantes = false } = req.body;

            // Verificar que la actividad existe y obtener info de si es grupal
            const actividadCheck = await query(
                'SELECT id, estado, es_grupal, participantes_ids FROM actividades_marketing WHERE id = $1',
                [id]
            );

            if (actividadCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            const actividad = actividadCheck.rows[0];

            // VALIDACIÓN REMOVIDA: Ahora se permite completar en cualquier momento
            // Esto es consistente con el frontend que permite completar actividades vencidas

            // Si es grupal Y se solicita completar para todos
            if (actividad.es_grupal && completar_todos_participantes) {
                console.log(`📋 Completando actividad grupal para TODOS los participantes:`, actividad.participantes_ids);

                // Completar todas las actividades con los mismos participantes_ids
                const result = await query(`
                    UPDATE actividades_marketing SET
                        estado = 'completada',
                        fecha_fin_real = timezone('America/Lima', NOW()),
                        duracion_real_minutos = calcular_minutos_laborales(fecha_inicio_real, timezone('America/Lima', NOW()))
                    WHERE participantes_ids = $1
                      AND es_grupal = true
                      AND estado != 'completada'
                    RETURNING *
                `, [actividad.participantes_ids]);

                const actividadesCompletadas = result.rows.map(agregarZonaHorariaUTC);

                return res.json({
                    success: true,
                    message: `Actividad grupal completada para ${result.rows.length} participante(s)`,
                    data: actividadesCompletadas,
                    tipo_completado: 'grupal_todos'
                });
            }

            // Completar solo la actividad individual
            const result = await query(`
                UPDATE actividades_marketing SET
                    estado = 'completada',
                    fecha_fin_real = timezone('America/Lima', NOW()),
                    duracion_real_minutos = calcular_minutos_laborales(fecha_inicio_real, timezone('America/Lima', NOW()))
                WHERE id = $1
                RETURNING *
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            // Agregar 'Z' a los timestamps para indicar que son UTC
            const actividadConTimezone = agregarZonaHorariaUTC(result.rows[0]);

            res.json({
                success: true,
                message: 'Actividad completada exitosamente',
                data: actividadConTimezone,
                tipo_completado: actividad.es_grupal ? 'grupal_individual' : 'individual'
            });

        } catch (error) {
            console.error('Error completando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al completar actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Cancelar actividad (con opción de optimización de calendario)
     */
    static async cancelarActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { motivo, optimizar_calendario = false } = req.body;

            const result = await query(`
                UPDATE actividades_marketing SET
                    estado = 'cancelada',
                    activo = false,
                    editada = true,
                    motivo_edicion = $1,
                    editada_por = $2,
                    editada_en = NOW(),
                    deleted_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [motivo, user_id, id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            const actividadCancelada = result.rows[0];

            // Si se solicita optimización de calendario, adelantar actividades posteriores
            let resultadoOptimizacion = null;
            if (optimizar_calendario) {
                const optimizacionService = require('../services/optimizacionService');
                resultadoOptimizacion = await optimizacionService.ejecutarOptimizacion(id);
            }

            res.json({
                success: true,
                message: 'Actividad cancelada exitosamente',
                data: actividadCancelada,
                optimizacion: resultadoOptimizacion
            });

        } catch (error) {
            console.error('Error cancelando actividad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar actividad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Obtener actividades vencidas (pendientes o en_progreso cuya hora ya pasó)
     */
    static async obtenerActividadesVencidas(req, res) {
        try {
            const { usuarioId } = req.params;
            const { user_id, rol } = req.user;

            // Validar permisos: solo puede ver sus propias actividades vencidas o si es jefe/superior
            const esJefeOSuperior = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            if (!esJefeOSuperior && parseInt(user_id) !== parseInt(usuarioId)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver las actividades de este usuario'
                });
            }

            const ahora = new Date();

            // Buscar actividades vencidas
            const result = await query(`
                SELECT
                    am.*,
                    ta.categoria_principal,
                    ta.subcategoria,
                    ta.descripcion as descripcion_tipo,
                    ta.color_hex,
                    u.nombre || ' ' || u.apellido as usuario_nombre,
                    creador.nombre || ' ' || creador.apellido as creado_por_nombre
                FROM actividades_marketing am
                LEFT JOIN tipos_actividad_marketing ta ON
                    am.categoria_principal = ta.categoria_principal
                    AND am.subcategoria = ta.subcategoria
                LEFT JOIN usuarios u ON am.usuario_id = u.id
                LEFT JOIN usuarios creador ON am.creado_por = creador.id
                WHERE am.usuario_id = $1
                  AND am.activo = true
                  AND am.estado IN ('pendiente', 'en_progreso')
                  AND am.fecha_fin_planeada < $2
                  AND am.tipo != 'sistema'
                ORDER BY am.fecha_fin_planeada ASC
            `, [usuarioId, ahora]);

            console.log(`⏰ Actividades vencidas encontradas para usuario ${usuarioId}:`, result.rows.length);

            // Agregar 'Z' a los timestamps para indicar que son UTC
            const actividadesConTimezone = agregarZonaHorariaUTC(result.rows);

            res.json({
                success: true,
                data: actividadesConTimezone,
                total: result.rows.length,
                fecha_actual: ahora
            });

        } catch (error) {
            console.error('Error obteniendo actividades vencidas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener actividades vencidas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Procesar huecos pendientes del día al finalizar jornada
     * Se ejecuta automáticamente o manualmente al final del día
     */
    static async procesarHuecosPendientes(req, res) {
        try {
            const { usuarioId } = req.params;
            const { fecha_referencia } = req.body; // Opcional: para procesar día específico

            const fechaProcesar = fecha_referencia ? new Date(fecha_referencia) : new Date();

            console.log(`🕐 Procesando huecos pendientes para usuario ${usuarioId} del día ${fechaProcesar.toDateString()}`);

            // Determinar horarios según día de la semana
            const diaSemana = fechaProcesar.getDay();
            const esSabado = diaSemana === 6;
            const esDomingo = diaSemana === 0;

            if (esDomingo) {
                return res.json({
                    success: true,
                    message: 'Los domingos no son día laboral',
                    huecos_creados: []
                });
            }

            const INICIO_JORNADA = esSabado ? 9 : 8;
            const FIN_JORNADA = esSabado ? 12 : 18;
            const ALMUERZO_INICIO = 13;
            const ALMUERZO_FIN = 14;

            // Buscar todas las actividades del día (excluyendo sistema)
            const inicioDelDia = new Date(fechaProcesar);
            inicioDelDia.setHours(INICIO_JORNADA, 0, 0, 0);

            const finDelDia = new Date(fechaProcesar);
            finDelDia.setHours(FIN_JORNADA, 0, 0, 0);

            const actividadesResult = await query(`
                SELECT
                    fecha_inicio_planeada,
                    fecha_fin_planeada,
                    duracion_planeada_minutos,
                    codigo,
                    descripcion
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND tipo != 'sistema'
                  AND (
                    (fecha_inicio_planeada >= $2 AND fecha_inicio_planeada < $3)
                    OR (fecha_fin_planeada > $2 AND fecha_fin_planeada <= $3)
                  )
                ORDER BY fecha_inicio_planeada ASC
            `, [usuarioId, inicioDelDia, finDelDia]);

            const actividades = actividadesResult.rows.map(row => ({
                inicio: new Date(row.fecha_inicio_planeada),
                fin: new Date(row.fecha_fin_planeada),
                codigo: row.codigo,
                descripcion: row.descripcion
            }));

            console.log(`📋 Actividades encontradas del día: ${actividades.length}`);

            // Encontrar huecos en el día
            const huecos = [];
            let cursorTiempo = inicioDelDia;

            for (let i = 0; i < actividades.length; i++) {
                const actividad = actividades[i];

                // Si hay un hueco entre el cursor y el inicio de esta actividad
                if (cursorTiempo < actividad.inicio) {
                    const minutos = (actividad.inicio - cursorTiempo) / 60000;

                    // Solo registrar huecos de al menos 15 minutos
                    if (minutos >= 15) {
                        huecos.push({
                            inicio: new Date(cursorTiempo),
                            fin: new Date(actividad.inicio),
                            minutos: Math.round(minutos)
                        });
                    }
                }

                // Mover cursor al final de esta actividad
                cursorTiempo = new Date(Math.max(cursorTiempo, actividad.fin));
            }

            // Último hueco: desde última actividad hasta fin de jornada
            if (cursorTiempo < finDelDia) {
                const minutos = (finDelDia - cursorTiempo) / 60000;

                if (minutos >= 15) {
                    huecos.push({
                        inicio: new Date(cursorTiempo),
                        fin: finDelDia,
                        minutos: Math.round(minutos)
                    });
                }
            }

            console.log(`⚠️ Huecos detectados: ${huecos.length}`);

            // Crear registros de huecos
            const huecosCreados = [];

            for (const hueco of huecos) {
                // Categorizar hueco
                const categoria = actividadesService.categorizarHueco(
                    hueco.inicio,
                    hueco.fin,
                    hueco.minutos
                );

                // Generar código
                const codigo = await actividadesService.generarCodigoActividad();

                // Insertar hueco
                await query(`
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo,
                        fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos, duracion_real_minutos,
                        color_hex, estado, activo
                    ) VALUES (
                        $1, 'SISTEMA', $2, $3,
                        $4, $4, 'sistema',
                        $5, $6,
                        $7, $7,
                        $8, 'completada', true
                    )
                `, [
                    codigo,
                    categoria.subcategoria,
                    categoria.descripcion,
                    usuarioId,
                    hueco.inicio,
                    hueco.fin,
                    hueco.minutos,
                    categoria.color
                ]);

                huecosCreados.push({
                    codigo,
                    tipo: categoria.subcategoria,
                    inicio: hueco.inicio,
                    fin: hueco.fin,
                    minutos: hueco.minutos
                });

                console.log(`✅ Hueco registrado: ${codigo} - ${categoria.subcategoria} (${hueco.minutos} min)`);
            }

            res.json({
                success: true,
                message: `Se procesaron ${huecosCreados.length} huecos del día`,
                data: huecosCreados,
                fecha_procesada: fechaProcesar
            });

        } catch (error) {
            console.error('Error procesando huecos pendientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar huecos pendientes',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Analizar optimización de calendario antes de cancelar
     * Retorna qué actividades se adelantarían sin ejecutar el adelantamiento
     */
    static async analizarOptimizacion(req, res) {
        try {
            const { id } = req.params;
            const optimizacionService = require('../services/optimizacionService');

            const analisis = await optimizacionService.analizarOptimizacion(id);

            res.json({
                success: true,
                data: analisis
            });

        } catch (error) {
            console.error('Error analizando optimización:', error);
            res.status(500).json({
                success: false,
                message: 'Error al analizar optimización',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Detectar actividades vencidas que requieren gestión
     */
    static async detectarActividadesVencidas(req, res) {
        try {
            const { usuarioId } = req.params;
            const { user_id, rol } = req.user;

            // Validar permisos
            const esJefeOSuperior = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            if (!esJefeOSuperior && parseInt(user_id) !== parseInt(usuarioId)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver las actividades de este usuario'
                });
            }

            const gestionVencidasService = require('../services/gestionVencidasService');
            const resultado = await gestionVencidasService.detectarActividadesRequierenGestion(usuarioId);

            res.json(resultado);

        } catch (error) {
            console.error('Error detectando actividades vencidas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al detectar actividades vencidas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Detectar actividades próximas a vencer (15 minutos antes)
     * Para notificaciones preventivas
     */
    static async detectarActividadesProximasVencer(req, res) {
        try {
            const { usuarioId } = req.params;
            const { user_id, rol } = req.user;
            const { minutosAntes = 15 } = req.query; // Por defecto 15 minutos

            // Validar permisos
            const esJefeOSuperior = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            if (!esJefeOSuperior && parseInt(user_id) !== parseInt(usuarioId)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver las actividades de este usuario'
                });
            }

            // Calcular ventana de tiempo
            const ahora = new Date();
            const tiempoLimite = new Date(ahora.getTime() + (minutosAntes * 60 * 1000));

            // Buscar actividades que vencen entre ahora y los próximos X minutos
            const result = await query(`
                SELECT
                    id,
                    codigo,
                    categoria_principal,
                    subcategoria,
                    descripcion,
                    estado,
                    fecha_fin_planeada,
                    duracion_planeada_minutos,
                    es_prioritaria,
                    color_hex,
                    EXTRACT(EPOCH FROM (fecha_fin_planeada - NOW())) / 60 AS minutos_restantes
                FROM actividades_marketing
                WHERE usuario_id = $1
                AND activo = true
                AND estado IN ('pendiente', 'en_progreso')
                AND fecha_fin_planeada > NOW()
                AND fecha_fin_planeada <= $2
                ORDER BY fecha_fin_planeada ASC
            `, [usuarioId, tiempoLimite]);

            res.json({
                success: true,
                actividades: result.rows,
                minutosVentana: minutosAntes,
                cantidad: result.rows.length
            });

        } catch (error) {
            console.error('Error detectando actividades próximas a vencer:', error);
            res.status(500).json({
                success: false,
                message: 'Error al detectar actividades próximas a vencer',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Gestionar actividad vencida
     */
    static async gestionarActividadVencida(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { accion, datos } = req.body;

            if (!accion) {
                return res.status(400).json({
                    success: false,
                    message: 'La acción es obligatoria'
                });
            }

            const gestionVencidasService = require('../services/gestionVencidasService');
            const resultado = await gestionVencidasService.gestionarActividadVencida(
                id,
                user_id,
                accion,
                datos || {}
            );

            // Envolver el resultado en un objeto con 'data' para consistencia con otros endpoints
            res.json({
                success: true,
                data: resultado
            });

        } catch (error) {
            console.error('Error gestionando actividad vencida:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al gestionar actividad vencida',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Analizar colisión y generar opciones de resolución
     * POST /api/marketing/actividades/analizar-colision
     */
    static async analizarColision(req, res) {
        try {
            const { user_id: usuarioLogueado } = req.user;
            const {
                usuario_id,
                fecha_inicio,
                duracion_minutos,
                es_prioritaria = false,
                categoria_principal,
                subcategoria,
                descripcion
            } = req.body;

            // Validaciones
            if (!fecha_inicio || !duracion_minutos) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: fecha_inicio, duracion_minutos'
                });
            }

            const usuarioDestino = usuario_id || usuarioLogueado;

            // Detectar colisión
            const colision = await colisionesService.detectarColisionesPrioritaria(
                usuarioDestino,
                fecha_inicio,
                duracion_minutos
            );

            if (!colision.hayColision) {
                return res.json({
                    success: true,
                    hay_colision: false,
                    mensaje: 'No hay colisiones. Puedes crear la actividad directamente.'
                });
            }

            // Si hay colisión, generar opciones
            const opciones = await resolucionColisionesService.generarOpcionesResolucion(
                {
                    usuario_id: usuarioDestino,
                    fecha_inicio,
                    duracion_minutos,
                    es_prioritaria,
                    categoria_principal,
                    subcategoria,
                    descripcion
                },
                colision.actividad,
                colision.tipo
            );

            res.json({
                success: true,
                hay_colision: true,
                tipo_colision: colision.tipo,
                actividad_conflicto: colision.actividad,
                mensaje: colision.mensaje,
                advertencia: colision.advertencia,
                opciones_resolucion: opciones
            });

        } catch (error) {
            console.error('Error analizando colisión:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al analizar colisión',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Resolver colisión ejecutando la opción seleccionada
     * POST /api/marketing/actividades/resolver-colision
     */
    static async resolverColision(req, res) {
        try {
            const { user_id: usuarioLogueado, rol } = req.user;
            const {
                opcion_id,
                datos_actividad_nueva,
                actividad_conflicto_id,
                detalles_opcion,
                espacio_seleccionado // Para la opción de buscar otro espacio
            } = req.body;

            // Validaciones
            if (!opcion_id || !datos_actividad_nueva) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: opcion_id, datos_actividad_nueva'
                });
            }

            // Si cancelar, solo retornar
            if (opcion_id === 'cancelar') {
                return res.json({
                    success: true,
                    accion: 'cancelado',
                    mensaje: 'Operación cancelada por el usuario'
                });
            }

            // Determinar usuario destino
            const usuarioDestino = datos_actividad_nueva.usuario_id || usuarioLogueado;

            // Validar permisos
            if (datos_actividad_nueva.usuario_id && datos_actividad_nueva.usuario_id !== usuarioLogueado) {
                const puedeCrearParaOtros = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
                if (!puedeCrearParaOtros) {
                    return res.status(403).json({
                        success: false,
                        message: 'Solo el jefe de marketing y superiores pueden crear actividades para otros usuarios'
                    });
                }
            }

            // Ejecutar la resolución
            let resultadoResolucion;

            if (opcion_id === 'buscar_otro_espacio') {
                if (!espacio_seleccionado) {
                    return res.status(400).json({
                        success: false,
                        message: 'Debes seleccionar un espacio disponible'
                    });
                }

                resultadoResolucion = await resolucionColisionesService.ejecutarResolucion(
                    opcion_id,
                    datos_actividad_nueva,
                    actividad_conflicto_id,
                    { espacio_seleccionado }
                );

                // Modificar fecha de inicio con el espacio seleccionado
                datos_actividad_nueva.fecha_inicio = espacio_seleccionado.inicio;

            } else if (opcion_id === 'forzar_solapamiento' || opcion_id === 'forzar_sobre_grupal') {
                // Forzar creación con solapamiento
                resultadoResolucion = {
                    success: true,
                    accion: 'forzar_creacion',
                    confirmar_colision: true
                };
            } else {
                // Otras opciones (mover_programada, acortar_programada, etc)
                resultadoResolucion = await resolucionColisionesService.ejecutarResolucion(
                    opcion_id,
                    datos_actividad_nueva,
                    actividad_conflicto_id,
                    detalles_opcion
                );
            }

            if (!resultadoResolucion.success) {
                return res.status(500).json(resultadoResolucion);
            }

            // Ahora crear la actividad nueva
            const {
                categoria_principal,
                subcategoria,
                descripcion,
                duracion_minutos,
                fecha_inicio,
                es_prioritaria = false
            } = datos_actividad_nueva;

            // Validar tipo de actividad
            const tipoResult = await query(
                'SELECT 1 FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2',
                [categoria_principal, subcategoria]
            );

            if (tipoResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de actividad no válido'
                });
            }

            // Obtener color
            const color_hex = obtenerColorCategoria(categoria_principal);

            // Calcular fecha de inicio (puede haber sido modificada por la resolución)
            const fechaInicioPlaneada = new Date(fecha_inicio);

            // Calcular fecha fin
            const fechaFinPlaneada = reajusteService.agregarMinutosEfectivos(
                fechaInicioPlaneada,
                duracion_minutos
            );

            // Registrar huecos pasados
            await actividadesService.registrarHuecosPasados(usuarioDestino, fechaInicioPlaneada);

            // Generar código
            const codigo = await actividadesService.generarCodigoActividad();

            // Insertar actividad
            const esProgramada = true; // Siempre es programada si pasó por resolución de colisión

            const insertQuery = `
                INSERT INTO actividades_marketing (
                    codigo, categoria_principal, subcategoria, descripcion,
                    usuario_id, creado_por, tipo, es_prioritaria, es_programada,
                    fecha_inicio_planeada, fecha_fin_planeada, duracion_planeada_minutos,
                    color_hex, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pendiente')
                RETURNING *
            `;

            const result = await query(insertQuery, [
                codigo,
                categoria_principal,
                subcategoria,
                descripcion,
                usuarioDestino,
                usuarioLogueado,
                'individual',
                es_prioritaria,
                esProgramada,
                fechaInicioPlaneada,
                fechaFinPlaneada,
                duracion_minutos,
                color_hex
            ]);

            const actividadCreada = result.rows[0];

            // Si es prioritaria, reajustar actividades normales
            if (es_prioritaria) {
                await reajusteService.reajustarActividades(
                    usuarioDestino,
                    fechaInicioPlaneada,
                    duracion_minutos,
                    actividadCreada.id,
                    true // Solo mover normales
                );
            }

            res.json({
                success: true,
                resolucion_aplicada: resultadoResolucion,
                actividad_creada: {
                    id: actividadCreada.id,
                    codigo: actividadCreada.codigo,
                    descripcion: actividadCreada.descripcion,
                    fecha_inicio: actividadCreada.fecha_inicio_planeada,
                    fecha_fin: actividadCreada.fecha_fin_planeada,
                    duracion_minutos: actividadCreada.duracion_planeada_minutos,
                    es_prioritaria: actividadCreada.es_prioritaria,
                    es_programada: actividadCreada.es_programada,
                    estado: actividadCreada.estado
                },
                mensaje: 'Colisión resuelta y actividad creada exitosamente'
            });

        } catch (error) {
            console.error('Error resolviendo colisión:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al resolver colisión',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = ActividadesController;
