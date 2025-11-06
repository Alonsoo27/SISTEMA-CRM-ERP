// ============================================
// SERVICIO DE DETECCIÓN DE COLISIONES
// Detecta conflictos entre actividades y sugiere alternativas
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('./reajusteService');

class ColisionesService {
    /**
     * Detectar colisiones para actividad prioritaria individual
     * Retorna tipo de colisión y sugerencias
     */
    static async detectarColisionesPrioritaria(usuarioId, fechaInicio, duracionMinutos, actividadIdExcluir = null) {
        try {
            const inicio = new Date(fechaInicio);
            const fin = reajusteService.agregarMinutosEfectivos(inicio, duracionMinutos);

            // Buscar actividades que se solapen con el rango [inicio, fin]
            let sql = `
                SELECT
                    *,
                    (fecha_inicio_planeada, fecha_fin_planeada) OVERLAPS ($2, $3) as hay_solapamiento
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND estado IN ('pendiente', 'en_progreso')
                  AND (fecha_inicio_planeada, fecha_fin_planeada) OVERLAPS ($2, $3)
            `;

            const params = [usuarioId, inicio, fin];

            if (actividadIdExcluir) {
                sql += ` AND id != $4`;
                params.push(actividadIdExcluir);
            }

            sql += ` ORDER BY fecha_inicio_planeada ASC`;

            const result = await query(sql, params);

            if (result.rows.length === 0) {
                return { hayColision: false };
            }

            // Analizar tipo de colisión (priorizar la más crítica)
            // ORDEN DE PRIORIDAD: GRUPAL > PRIORITARIA > PROGRAMADA > NORMAL
            for (const actividad of result.rows) {
                // Colisión con GRUPAL
                if (actividad.es_grupal) {
                    const participantes = await this.obtenerNombresParticipantes(actividad.participantes_ids);

                    return {
                        hayColision: true,
                        tipo: 'grupal_desde_individual',
                        requiere_confirmacion: true,
                        actividad: {
                            id: actividad.id,
                            codigo: actividad.codigo,
                            descripcion: actividad.descripcion,
                            fecha_inicio: actividad.fecha_inicio_planeada,
                            fecha_fin: actividad.fecha_fin_planeada,
                            participantes: participantes,
                            total_participantes: actividad.participantes_ids.length
                        },
                        mensaje: 'Esta persona tiene una actividad grupal en ese horario',
                        advertencia: 'Si continúas, la actividad grupal se cortará/reajustará para TODOS los participantes'
                    };
                }

                // Colisión con PRIORITARIA
                if (actividad.es_prioritaria) {
                    const slots = await this.buscarSlotsPrevioYPosterior(
                        usuarioId,
                        actividad.fecha_inicio_planeada,
                        actividad.fecha_fin_planeada,
                        duracionMinutos
                    );

                    return {
                        hayColision: true,
                        tipo: 'prioritaria',
                        actividad: {
                            id: actividad.id,
                            codigo: actividad.codigo,
                            descripcion: actividad.descripcion,
                            fecha_inicio: actividad.fecha_inicio_planeada,
                            fecha_fin: actividad.fecha_fin_planeada,
                            duracion_minutos: actividad.duracion_planeada_minutos
                        },
                        sugerencias: slots,
                        mensaje: 'Ya hay una actividad prioritaria en ese horario'
                    };
                }

                // Colisión con PROGRAMADA (horario fijo elegido manualmente)
                if (actividad.es_programada) {
                    const slots = await this.buscarSlotsPrevioYPosterior(
                        usuarioId,
                        actividad.fecha_inicio_planeada,
                        actividad.fecha_fin_planeada,
                        duracionMinutos
                    );

                    return {
                        hayColision: true,
                        tipo: 'programada',
                        requiere_confirmacion: true,
                        actividad: {
                            id: actividad.id,
                            codigo: actividad.codigo,
                            descripcion: actividad.descripcion,
                            fecha_inicio: actividad.fecha_inicio_planeada,
                            fecha_fin: actividad.fecha_fin_planeada,
                            duracion_minutos: actividad.duracion_planeada_minutos,
                            es_prioritaria: actividad.es_prioritaria,
                            es_programada: actividad.es_programada
                        },
                        sugerencias: slots,
                        mensaje: 'Ya hay una actividad programada (horario fijo) en ese horario',
                        advertencia: 'Las actividades programadas tienen horario fijo. Puedes: buscar otro espacio, mover la programada, o acortar su duración'
                    };
                }
            }

            // Colisión con actividades NORMALES
            // Retornar información para que el controller pueda reprogramar automáticamente
            const actividadNormal = result.rows[0]; // Tomar la primera actividad normal encontrada

            return {
                hayColision: true,
                tipo: 'normal',
                actividad: {
                    id: actividadNormal.id,
                    codigo: actividadNormal.codigo,
                    descripcion: actividadNormal.descripcion,
                    fecha_inicio: actividadNormal.fecha_inicio_planeada,
                    fecha_fin: actividadNormal.fecha_fin_planeada,
                    duracion_minutos: actividadNormal.duracion_planeada_minutos
                },
                mensaje: 'Ya tienes una actividad programada en ese horario',
                reprogramar_automaticamente: true
            };

        } catch (error) {
            console.error('Error detectando colisiones prioritaria:', error);
            throw error;
        }
    }

    /**
     * Detectar colisiones para actividad grupal
     * Verifica conflictos en TODOS los participantes
     */
    static async detectarColisionesGrupal(participantesIds, fechaInicio, duracionMinutos) {
        try {
            const inicio = new Date(fechaInicio);
            const fin = reajusteService.agregarMinutosEfectivos(inicio, duracionMinutos);

            const conflictos = [];

            for (const participanteId of participantesIds) {
                const result = await query(`
                    SELECT *
                    FROM actividades_marketing
                    WHERE usuario_id = $1
                      AND activo = true
                      AND estado IN ('pendiente', 'en_progreso')
                      AND (fecha_inicio_planeada, fecha_fin_planeada) OVERLAPS ($2, $3)
                    ORDER BY fecha_inicio_planeada ASC
                `, [participanteId, inicio, fin]);

                for (const actividad of result.rows) {
                    // CRÍTICO: Actividad PRIORITARIA bloquea la grupal
                    if (actividad.es_prioritaria) {
                        const usuario = await this.obtenerNombreUsuario(participanteId);

                        conflictos.push({
                            tipo: 'prioritaria',
                            bloqueante: true,
                            usuario: usuario,
                            actividad: {
                                id: actividad.id,
                                codigo: actividad.codigo,
                                descripcion: actividad.descripcion,
                                fecha_inicio: actividad.fecha_inicio_planeada,
                                fecha_fin: actividad.fecha_fin_planeada
                            }
                        });
                    }

                    // Actividad GRUPAL también genera conflicto
                    if (actividad.es_grupal) {
                        const usuario = await this.obtenerNombreUsuario(participanteId);

                        conflictos.push({
                            tipo: 'grupal',
                            bloqueante: true,
                            usuario: usuario,
                            actividad: {
                                id: actividad.id,
                                codigo: actividad.codigo,
                                descripcion: actividad.descripcion,
                                fecha_inicio: actividad.fecha_inicio_planeada,
                                fecha_fin: actividad.fecha_fin_planeada
                            }
                        });
                    }
                }
            }

            if (conflictos.length === 0) {
                return { hayColision: false };
            }

            // Buscar slots alternativos basados en el primer conflicto
            const primerConflicto = conflictos[0];
            const slots = await this.buscarSlotsPrevioYPosteriorGrupal(
                participantesIds,
                primerConflicto.actividad.fecha_inicio,
                primerConflicto.actividad.fecha_fin,
                duracionMinutos
            );

            return {
                hayColision: true,
                tipo: 'prioritaria_desde_grupal',
                bloqueante: true,
                conflictos: conflictos,
                sugerencias: slots,
                mensaje: 'Uno o más participantes tienen actividades prioritarias o grupales en ese horario'
            };

        } catch (error) {
            console.error('Error detectando colisiones grupal:', error);
            throw error;
        }
    }

    /**
     * Buscar slots previo y posterior para actividad individual
     */
    static async buscarSlotsPrevioYPosterior(usuarioId, fechaInicioConflicto, fechaFinConflicto, duracionMinutos) {
        const slots = {
            previo: null,
            posterior: null
        };

        try {
            // SLOT PREVIO: buscar antes del conflicto
            const huecoPrevio = await this.buscarHuecoAnterior(
                usuarioId,
                fechaInicioConflicto,
                duracionMinutos
            );

            if (huecoPrevio) {
                slots.previo = {
                    fecha_inicio: huecoPrevio.inicio,
                    fecha_fin: reajusteService.agregarMinutosEfectivos(
                        new Date(huecoPrevio.inicio),
                        duracionMinutos
                    ),
                    hueco_disponible_minutos: huecoPrevio.duracion
                };
            }

            // SLOT POSTERIOR: buscar después del conflicto
            const huecoPosterior = await this.buscarHuecoPosterior(
                usuarioId,
                fechaFinConflicto,
                duracionMinutos
            );

            if (huecoPosterior) {
                slots.posterior = {
                    fecha_inicio: huecoPosterior.inicio,
                    fecha_fin: reajusteService.agregarMinutosEfectivos(
                        new Date(huecoPosterior.inicio),
                        duracionMinutos
                    ),
                    hueco_disponible_minutos: huecoPosterior.duracion
                };
            }

            return slots;

        } catch (error) {
            console.error('Error buscando slots previo/posterior:', error);
            return slots;
        }
    }

    /**
     * Buscar slots para actividad grupal (todos los participantes)
     */
    static async buscarSlotsPrevioYPosteriorGrupal(participantesIds, fechaInicioConflicto, fechaFinConflicto, duracionMinutos) {
        const slots = {
            previo: null,
            posterior: null
        };

        try {
            // Buscar hueco PREVIO que funcione para TODOS
            const huecoPrevio = await this.buscarHuecoAnteriorGrupal(
                participantesIds,
                fechaInicioConflicto,
                duracionMinutos
            );

            if (huecoPrevio) {
                slots.previo = {
                    fecha_inicio: huecoPrevio.inicio,
                    fecha_fin: reajusteService.agregarMinutosEfectivos(
                        new Date(huecoPrevio.inicio),
                        duracionMinutos
                    ),
                    hueco_disponible_minutos: huecoPrevio.duracion
                };
            }

            // Buscar hueco POSTERIOR que funcione para TODOS
            const huecoPosterior = await this.buscarHuecoPosteriorGrupal(
                participantesIds,
                fechaFinConflicto,
                duracionMinutos
            );

            if (huecoPosterior) {
                slots.posterior = {
                    fecha_inicio: huecoPosterior.inicio,
                    fecha_fin: reajusteService.agregarMinutosEfectivos(
                        new Date(huecoPosterior.inicio),
                        duracionMinutos
                    ),
                    hueco_disponible_minutos: huecoPosterior.duracion
                };
            }

            return slots;

        } catch (error) {
            console.error('Error buscando slots grupal:', error);
            return slots;
        }
    }

    /**
     * Buscar hueco anterior para un usuario
     */
    static async buscarHuecoAnterior(usuarioId, fechaLimite, duracionMinutos) {
        try {
            const limite = new Date(fechaLimite);

            // Obtener actividades ANTES de fechaLimite
            const result = await query(`
                SELECT fecha_inicio_planeada, fecha_fin_planeada
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND estado IN ('pendiente', 'en_progreso')
                  AND fecha_fin_planeada <= $2
                ORDER BY fecha_fin_planeada DESC
                LIMIT 1
            `, [usuarioId, limite]);

            if (result.rows.length === 0) {
                // No hay actividades previas, el hueco es desde inicio de jornada hasta el límite
                const inicioJornada = this.calcularInicioJornada(limite);
                const duracionHueco = this.calcularMinutosEntre(inicioJornada, limite);

                if (duracionHueco >= duracionMinutos) {
                    return {
                        inicio: inicioJornada,
                        duracion: duracionHueco
                    };
                }
                return null;
            }

            // Calcular hueco entre última actividad y el límite
            const ultimaActividad = result.rows[0];
            const finUltima = new Date(ultimaActividad.fecha_fin_planeada);
            const duracionHueco = this.calcularMinutosEntre(finUltima, limite);

            if (duracionHueco >= duracionMinutos) {
                return {
                    inicio: finUltima,
                    duracion: duracionHueco
                };
            }

            return null;

        } catch (error) {
            console.error('Error buscando hueco anterior:', error);
            return null;
        }
    }

    /**
     * Buscar hueco posterior para un usuario
     * NUEVA LÓGICA: Ignora actividades NORMALES (pueden ser desplazadas)
     * Solo se detiene en PRIORITARIAS o GRUPALES
     */
    static async buscarHuecoPosterior(usuarioId, fechaInicio, duracionMinutos) {
        try {
            let cursor = new Date(fechaInicio);
            const MAX_INTENTOS = 30; // Buscar hasta 30 días adelante

            for (let i = 0; i < MAX_INTENTOS; i++) {
                // Buscar siguiente actividad PRIORITARIA o GRUPAL después del cursor
                const result = await query(`
                    SELECT fecha_inicio_planeada, fecha_fin_planeada, es_prioritaria, es_grupal
                    FROM actividades_marketing
                    WHERE usuario_id = $1
                      AND activo = true
                      AND estado IN ('pendiente', 'en_progreso')
                      AND fecha_inicio_planeada >= $2
                      AND (es_prioritaria = true OR es_grupal = true)
                    ORDER BY fecha_inicio_planeada ASC
                    LIMIT 1
                `, [usuarioId, cursor]);

                if (result.rows.length === 0) {
                    // No hay más actividades prioritarias/grupales, hay espacio infinito
                    return {
                        inicio: cursor,
                        duracion: duracionMinutos // Espacio "infinito"
                    };
                }

                const siguienteActividad = result.rows[0];
                const inicioSiguiente = new Date(siguienteActividad.fecha_inicio_planeada);
                const espacioDisponible = this.calcularMinutosEntre(cursor, inicioSiguiente);

                if (espacioDisponible >= duracionMinutos) {
                    return {
                        inicio: cursor,
                        duracion: espacioDisponible
                    };
                }

                // No hay espacio, mover cursor al fin de la siguiente actividad prioritaria/grupal
                cursor = new Date(siguienteActividad.fecha_fin_planeada);
            }

            return null;

        } catch (error) {
            console.error('Error buscando hueco posterior:', error);
            return null;
        }
    }

    /**
     * Buscar hueco anterior que funcione para TODOS los participantes (grupal)
     */
    static async buscarHuecoAnteriorGrupal(participantesIds, fechaLimite, duracionMinutos) {
        try {
            // Para cada participante, obtener su hueco anterior
            const huecosIndividuales = [];

            for (const participanteId of participantesIds) {
                const hueco = await this.buscarHuecoAnterior(participanteId, fechaLimite, duracionMinutos);
                if (!hueco) {
                    return null; // Si alguno no tiene hueco, no es viable
                }
                huecosIndividuales.push(hueco);
            }

            // Encontrar el hueco común (intersección)
            // El inicio es el MÁS TARDÍO de todos
            const inicioComun = huecosIndividuales.reduce((max, hueco) => {
                const inicioHueco = new Date(hueco.inicio);
                return inicioHueco > max ? inicioHueco : max;
            }, new Date(huecosIndividuales[0].inicio));

            // Verificar que haya espacio suficiente desde el inicio común
            const duracionDisponible = this.calcularMinutosEntre(inicioComun, new Date(fechaLimite));

            if (duracionDisponible >= duracionMinutos) {
                return {
                    inicio: inicioComun,
                    duracion: duracionDisponible
                };
            }

            return null;

        } catch (error) {
            console.error('Error buscando hueco anterior grupal:', error);
            return null;
        }
    }

    /**
     * Buscar hueco posterior que funcione para TODOS los participantes (grupal)
     */
    static async buscarHuecoPosteriorGrupal(participantesIds, fechaInicio, duracionMinutos) {
        try {
            const MAX_INTENTOS = 30;
            let cursor = new Date(fechaInicio);

            for (let intento = 0; intento < MAX_INTENTOS; intento++) {
                // Verificar si todos los participantes tienen espacio en este cursor
                let todosDisponibles = true;
                let siguienteCursor = null;

                for (const participanteId of participantesIds) {
                    const hueco = await this.buscarHuecoPosterior(participanteId, cursor, duracionMinutos);

                    if (!hueco) {
                        todosDisponibles = false;
                        break;
                    }

                    // Si el hueco no empieza exactamente en el cursor, ajustar
                    const inicioHueco = new Date(hueco.inicio);
                    if (inicioHueco > cursor && (!siguienteCursor || inicioHueco < siguienteCursor)) {
                        siguienteCursor = inicioHueco;
                    }
                }

                if (todosDisponibles && !siguienteCursor) {
                    // Todos tienen espacio en el cursor actual
                    return {
                        inicio: cursor,
                        duracion: duracionMinutos
                    };
                }

                if (!siguienteCursor) {
                    return null; // No se encontró hueco viable
                }

                // Ajustar cursor al siguiente intento
                cursor = siguienteCursor;
            }

            return null;

        } catch (error) {
            console.error('Error buscando hueco posterior grupal:', error);
            return null;
        }
    }

    /**
     * Calcular inicio de jornada laboral para una fecha
     */
    static calcularInicioJornada(fecha) {
        const inicio = new Date(fecha);
        const diaSemana = inicio.getDay();

        if (diaSemana === 6) {
            // Sábado: 9 AM
            inicio.setHours(9, 0, 0, 0);
        } else {
            // Lunes-Viernes: 8 AM
            inicio.setHours(8, 0, 0, 0);
        }

        return inicio;
    }

    /**
     * Calcular minutos entre dos fechas (solo tiempo laboral)
     */
    static calcularMinutosEntre(fechaInicio, fechaFin) {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        // Simplificación: calcular diferencia bruta
        // TODO: Podría mejorarse para considerar solo horario laboral
        const minutos = (fin - inicio) / 60000;
        return Math.max(0, Math.floor(minutos));
    }

    /**
     * Obtener nombre de usuario
     */
    static async obtenerNombreUsuario(usuarioId) {
        const result = await query(`
            SELECT id, nombre, apellido, nombre || ' ' || apellido as nombre_completo
            FROM usuarios
            WHERE id = $1
        `, [usuarioId]);

        return result.rows[0] || { id: usuarioId, nombre_completo: 'Usuario desconocido' };
    }

    /**
     * Obtener nombres de participantes
     */
    static async obtenerNombresParticipantes(participantesIds) {
        if (!participantesIds || participantesIds.length === 0) {
            return [];
        }

        const result = await query(`
            SELECT id, nombre, apellido, nombre || ' ' || apellido as nombre_completo
            FROM usuarios
            WHERE id = ANY($1::int[])
        `, [participantesIds]);

        return result.rows;
    }

    /**
     * Detectar colisiones al EDITAR/EXTENDER una actividad
     * Valida que el nuevo horario no colisione con actividades inmovibles
     */
    static async detectarColisionesEdicion(usuarioId, nuevaFechaInicio, nuevaFechaFin, actividadIdExcluir) {
        try {
            const inicio = new Date(nuevaFechaInicio);
            const fin = new Date(nuevaFechaFin);

            console.log('🔍 Detectando colisiones de edición:', {
                usuarioId,
                inicio,
                fin,
                excluir: actividadIdExcluir
            });

            // Buscar actividades que se solapen con el nuevo rango
            const result = await query(`
                SELECT *
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND estado IN ('pendiente', 'en_progreso')
                  AND id != $2
                  AND (fecha_inicio_planeada, fecha_fin_planeada) OVERLAPS ($3, $4)
                ORDER BY fecha_inicio_planeada ASC
            `, [usuarioId, actividadIdExcluir, inicio, fin]);

            if (result.rows.length === 0) {
                return { hayColision: false };
            }

            console.log(`⚠️ ${result.rows.length} colisiones detectadas`);

            // Analizar tipo de colisión (priorizar la más crítica)
            const conflictos = [];

            for (const actividad of result.rows) {
                let tipoConflicto = 'normal';
                let bloqueante = false;
                let razon = '';

                // TIPO 1: Actividad PROGRAMADA (horario fijo elegido por usuario)
                if (actividad.es_programada) {
                    tipoConflicto = 'programada';
                    bloqueante = true;
                    razon = 'Actividad con horario programado manualmente';
                }
                // TIPO 2: Actividad GRUPAL (afecta a múltiples usuarios)
                else if (actividad.es_grupal) {
                    tipoConflicto = 'grupal';
                    bloqueante = true;
                    razon = 'Actividad grupal (afecta a ' + (actividad.participantes_ids?.length || 0) + ' participantes)';
                }
                // TIPO 3: Actividad PRIORITARIA (no se puede mover)
                else if (actividad.es_prioritaria) {
                    tipoConflicto = 'prioritaria';
                    bloqueante = true;
                    razon = 'Actividad prioritaria';
                }
                // TIPO 4: Actividad NORMAL (se puede mover)
                else {
                    tipoConflicto = 'normal';
                    bloqueante = false;
                    razon = 'Actividad normal (se desplazará automáticamente)';
                }

                conflictos.push({
                    tipo: tipoConflicto,
                    bloqueante: bloqueante,
                    razon: razon,
                    actividad: {
                        id: actividad.id,
                        codigo: actividad.codigo,
                        descripcion: actividad.descripcion,
                        fecha_inicio: actividad.fecha_inicio_planeada,
                        fecha_fin: actividad.fecha_fin_planeada,
                        duracion_minutos: actividad.duracion_planeada_minutos,
                        es_programada: actividad.es_programada,
                        es_grupal: actividad.es_grupal,
                        es_prioritaria: actividad.es_prioritaria,
                        participantes_ids: actividad.participantes_ids
                    }
                });
            }

            // Verificar si hay algún conflicto BLOQUEANTE
            const hayBloqueantes = conflictos.some(c => c.bloqueante);

            if (hayBloqueantes) {
                // Buscar horarios alternativos
                const duracionMinutos = Math.round((fin - inicio) / 60000);
                const primerConflicto = conflictos.find(c => c.bloqueante);

                const slots = await this.buscarSlotsPrevioYPosterior(
                    usuarioId,
                    primerConflicto.actividad.fecha_inicio,
                    primerConflicto.actividad.fecha_fin,
                    duracionMinutos
                );

                return {
                    hayColision: true,
                    bloqueante: true,
                    conflictos: conflictos,
                    sugerencias: slots,
                    mensaje: 'El nuevo horario colisiona con actividades que no se pueden mover',
                    advertencia: 'Las actividades programadas, grupales y prioritarias no pueden ser desplazadas',
                    total_conflictos: conflictos.length,
                    conflictos_bloqueantes: conflictos.filter(c => c.bloqueante).length
                };
            } else {
                // Solo hay conflictos con actividades NORMALES (se desplazarán)
                return {
                    hayColision: true,
                    bloqueante: false,
                    conflictos: conflictos,
                    mensaje: 'El nuevo horario desplazará actividades normales',
                    advertencia: 'Las siguientes actividades se moverán automáticamente',
                    total_conflictos: conflictos.length,
                    conflictos_bloqueantes: 0
                };
            }

        } catch (error) {
            console.error('Error detectando colisiones de edición:', error);
            throw error;
        }
    }
}

module.exports = ColisionesService;
