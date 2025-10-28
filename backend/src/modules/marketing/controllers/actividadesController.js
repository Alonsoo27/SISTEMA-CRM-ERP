// ============================================
// CONTROLLER DE ACTIVIDADES - MARKETING
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('../services/reajusteService');
const actividadesService = require('../services/actividadesService');
const colisionesService = require('../services/colisionesService');

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
                const slotInfo = await actividadesService.obtenerProximoSlotDisponible(
                    usuarioDestino,
                    es_prioritaria ? null : duracion_minutos // Solo validar duración si NO es prioritaria
                );

                // Si obtenerProximoSlotDisponible retorna objeto con info
                if (typeof slotInfo === 'object' && slotInfo.fecha) {
                    fechaInicioPlaneada = slotInfo.fecha;

                    // Para actividades NORMALES, si no hay espacio suficiente, buscar al final
                    if (!es_prioritaria && !slotInfo.esSuficiente) {
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
                    // Retornar HTTP 409 con información de la colisión
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
            const insertQuery = `
                INSERT INTO actividades_marketing (
                    codigo, categoria_principal, subcategoria, descripcion,
                    usuario_id, creado_por, tipo, es_prioritaria,
                    fecha_inicio_planeada, fecha_fin_planeada, duracion_planeada_minutos,
                    color_hex, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pendiente')
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
                        usuario_id, creado_por, tipo, es_grupal, es_prioritaria,
                        participantes_ids, fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos, color_hex, estado
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pendiente')
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

            res.json({
                success: true,
                data: result.rows,
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

            res.json({
                success: true,
                data: result.rows[0]
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

            // Calcular nueva fecha fin si cambia duración
            let nuevaFechaFin = actividad.fecha_fin_planeada;
            if (duracion_minutos && duracion_minutos !== actividad.duracion_planeada_minutos) {
                const fechaInicio = fecha_inicio ? new Date(fecha_inicio) : new Date(actividad.fecha_inicio_planeada);
                nuevaFechaFin = reajusteService.agregarMinutosEfectivos(fechaInicio, duracion_minutos);
            }

            // Actualizar actividad
            const updateQuery = `
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
            `;

            const result = await query(updateQuery, [
                duracion_minutos,
                fecha_inicio,
                nuevaFechaFin,
                motivo_edicion,
                user_id,
                id
            ]);

            // Reajustar actividades posteriores
            if (duracion_minutos || fecha_inicio) {
                await reajusteService.reajustarActividades(
                    actividad.usuario_id,
                    fecha_inicio || actividad.fecha_inicio_planeada,
                    duracion_minutos || actividad.duracion_planeada_minutos,
                    id
                );
            }

            res.json({
                success: true,
                message: 'Actividad editada exitosamente',
                data: result.rows[0]
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

            // Registrar extensión
            await query(`
                INSERT INTO extensiones_actividades (actividad_id, usuario_id, minutos_adicionales, motivo)
                VALUES ($1, $2, $3, $4)
            `, [id, user_id, minutos_adicionales, motivo]);

            // Actualizar actividad
            const updateQuery = `
                UPDATE actividades_marketing SET
                    tiempo_adicional_minutos = tiempo_adicional_minutos + $1,
                    fecha_fin_planeada = fecha_fin_planeada + ($1 || ' minutes')::interval
                WHERE id = $2
                RETURNING *
            `;

            const result = await query(updateQuery, [minutos_adicionales, id]);

            // Reajustar actividades posteriores
            const actividad = result.rows[0];
            await reajusteService.reajustarActividades(
                actividad.usuario_id,
                actividad.fecha_inicio_planeada,
                actividad.duracion_planeada_minutos + minutos_adicionales,
                id
            );

            res.json({
                success: true,
                message: 'Actividad extendida exitosamente',
                data: result.rows[0]
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
     */
    static async completarActividad(req, res) {
        try {
            const { id } = req.params;

            const result = await query(`
                UPDATE actividades_marketing SET
                    estado = 'completada',
                    fecha_fin_real = NOW(),
                    duracion_real_minutos = EXTRACT(EPOCH FROM (NOW() - fecha_inicio_real)) / 60
                WHERE id = $1
                RETURNING *
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Actividad no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Actividad completada exitosamente',
                data: result.rows[0]
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
     * Cancelar actividad
     */
    static async cancelarActividad(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.user;
            const { motivo } = req.body;

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

            res.json({
                success: true,
                message: 'Actividad cancelada exitosamente',
                data: result.rows[0]
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
}

module.exports = ActividadesController;
