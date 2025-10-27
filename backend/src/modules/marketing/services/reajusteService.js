// ============================================
// SERVICIO DE REAJUSTE AUTOMÁTICO
// Motor principal de planificación dinámica
// ============================================

const { query } = require('../../../config/database');

class ReajusteService {
    /**
     * Reajustar actividades cuando se inserta/edita/extiende una actividad
     */
    static async reajustarActividades(usuarioId, fechaInsercion, duracionMinutos, actividadIdDisparadora = null) {
        try {
            // Validaciones de entrada
            if (!usuarioId || !fechaInsercion || !duracionMinutos) {
                throw new Error('Parámetros incompletos: usuarioId, fechaInsercion y duracionMinutos son requeridos');
            }

            if (duracionMinutos <= 0) {
                throw new Error('La duración debe ser mayor a 0 minutos');
            }

            // Validar que fechaInsercion es una fecha válida
            const puntoInsercion = new Date(fechaInsercion);
            if (isNaN(puntoInsercion.getTime())) {
                throw new Error('fechaInsercion no es una fecha válida');
            }

            console.log('🔄 Iniciando reajuste:', {
                usuarioId,
                puntoInsercion: puntoInsercion.toISOString(),
                duracionMinutos,
                actividadIdDisparadora
            });

            // 1. Obtener todas las actividades pendientes y en progreso del usuario
            const actividadesExistentes = await this.obtenerActividadesPendientes(usuarioId, fechaInsercion, actividadIdDisparadora);

            if (actividadesExistentes.length === 0) {
                console.log('✅ No hay actividades para reajustar');
                return { success: true, message: 'No hay actividades para reajustar' };
            }

            console.log(`📋 Actividades encontradas para analizar: ${actividadesExistentes.length}`);

            // 3. Dividir actividades afectadas
            const actividadesAReajustar = [];
            const actividadesCortadas = []; // CAMBIO: Array en lugar de variable singular

            for (const actividad of actividadesExistentes) {
                // Usar fecha_inicio_real si ya está en progreso, sino usar fecha_inicio_planeada
                const inicioActividad = actividad.fecha_inicio_real
                    ? new Date(actividad.fecha_inicio_real)
                    : new Date(actividad.fecha_inicio_planeada);

                const finActividad = new Date(actividad.fecha_fin_planeada);

                // Si la nueva actividad se inserta en medio de una actividad existente
                if (puntoInsercion > inicioActividad && puntoInsercion < finActividad) {
                    const tiempoAntes = (puntoInsercion - inicioActividad) / 60000; // minutos antes del corte
                    const tiempoDespues = (finActividad - puntoInsercion) / 60000;  // minutos después del corte

                    // Si alguno de los fragmentos es muy pequeño (< 5 minutos), mejor reajustar toda la actividad
                    const MINIMO_FRAGMENTO_MINUTOS = 5;

                    if (tiempoAntes < MINIMO_FRAGMENTO_MINUTOS || tiempoDespues < MINIMO_FRAGMENTO_MINUTOS) {
                        console.log('⚠️ Fragmento muy pequeño, se reajustará completa:', {
                            id: actividad.id,
                            minutos_antes: Math.round(tiempoAntes),
                            minutos_despues: Math.round(tiempoDespues)
                        });
                        // Tratar como si empezara después del punto de inserción
                        actividadesAReajustar.push(actividad);
                    } else {
                        // CAMBIO: Agregar al array en lugar de sobrescribir
                        actividadesCortadas.push({
                            ...actividad,
                            tiempoAntes: Math.max(0, tiempoAntes),      // Asegurar que no sea negativo
                            tiempoDespues: Math.max(0, tiempoDespues),  // Asegurar que no sea negativo
                            inicioReal: inicioActividad                 // Guardar qué tiempo usamos
                        });

                        console.log('🔍 Actividad detectada para corte:', {
                            id: actividad.id,
                            estado: actividad.estado,
                            inicio_usado: inicioActividad,
                            fin: finActividad,
                            punto_insercion: puntoInsercion,
                            minutos_antes: Math.round(tiempoAntes),
                            minutos_despues: Math.round(tiempoDespues)
                        });
                    }
                } else if (inicioActividad >= puntoInsercion) {
                    actividadesAReajustar.push(actividad);
                }
            }

            console.log(`🔪 Total actividades a cortar: ${actividadesCortadas.length}`);

            // 4. Calcular nueva programación
            let cursorTiempo = new Date(puntoInsercion);
            cursorTiempo = this.agregarMinutosEfectivos(cursorTiempo, duracionMinutos);

            const actividadesAfectadas = [];

            // CAMBIO: Procesar TODAS las actividades cortadas (no solo una)
            for (const actividadCortada of actividadesCortadas) {
                console.log('🔪 Cortando actividad:', {
                    id: actividadCortada.id,
                    tiempoAntes: actividadCortada.tiempoAntes,
                    tiempoDespues: actividadCortada.tiempoDespues,
                    puntoInsercion,
                    cursorTiempo
                });

                // PARTE 1: Tiempo trabajado antes del corte (marcar como interrumpida)
                const codigoBase = actividadCortada.codigo.replace('-PARTE1', '').replace('-PARTE2', '');
                const codigoParte1 = `${codigoBase}-PARTE1`;
                const codigoParte2 = `${codigoBase}-PARTE2`;

                // Crear PARTE 1 (lo que ya se trabajó)
                const parte1Result = await query(`
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo, es_grupal, participantes_ids,
                        fecha_inicio_planeada, fecha_inicio_real, fecha_fin_planeada,
                        duracion_planeada_minutos, duracion_real_minutos,
                        color_hex, estado, actividad_padre_id, es_continuacion,
                        tiempo_trabajado_antes_corte, cortada_por_actividad_id, hora_corte,
                        notas
                    ) VALUES (
                        $1, $2, $3, $4 || ' (INTERRUMPIDA)',
                        $5, $6, $7, $8, $9,
                        $10, $11, $12,
                        $13, $13,
                        $14, 'interrumpida', $15, false,
                        $16, $17, $18,
                        'Actividad interrumpida por inserción prioritaria'
                    )
                    RETURNING id
                `, [
                    codigoParte1,
                    actividadCortada.categoria_principal,
                    actividadCortada.subcategoria,
                    actividadCortada.descripcion,
                    actividadCortada.usuario_id,
                    actividadCortada.creado_por,
                    actividadCortada.tipo,
                    actividadCortada.es_grupal,
                    actividadCortada.participantes_ids,
                    actividadCortada.inicioReal,  // Usar el inicio real calculado
                    actividadCortada.fecha_inicio_real,  // Copiar fecha_inicio_real si existía
                    puntoInsercion,
                    Math.round(actividadCortada.tiempoAntes),
                    actividadCortada.color_hex,
                    actividadCortada.id, // actividad_padre_id
                    Math.round(actividadCortada.tiempoAntes),
                    actividadIdDisparadora,
                    puntoInsercion
                ]);

                const parte1Id = parte1Result.rows[0].id;

                // Calcular fin de la continuación
                const finContinuacion = this.agregarMinutosEfectivos(cursorTiempo, actividadCortada.tiempoDespues);

                // Crear PARTE 2 (continuación pendiente)
                const parte2Result = await query(`
                    INSERT INTO actividades_marketing (
                        codigo, categoria_principal, subcategoria, descripcion,
                        usuario_id, creado_por, tipo, es_grupal, participantes_ids,
                        fecha_inicio_planeada, fecha_fin_planeada,
                        duracion_planeada_minutos,
                        color_hex, estado, actividad_padre_id, es_continuacion,
                        cortada_por_actividad_id, hora_corte,
                        notas
                    ) VALUES (
                        $1, $2, $3, $4 || ' (CONTINUACIÓN)',
                        $5, $6, $7, $8, $9,
                        $10, $11,
                        $12,
                        $13, 'pendiente', $14, true,
                        $15, $16,
                        'Continuación de actividad interrumpida'
                    )
                    RETURNING id
                `, [
                    codigoParte2,
                    actividadCortada.categoria_principal,
                    actividadCortada.subcategoria,
                    actividadCortada.descripcion,
                    actividadCortada.usuario_id,
                    actividadCortada.creado_por,
                    actividadCortada.tipo,
                    actividadCortada.es_grupal,
                    actividadCortada.participantes_ids,
                    cursorTiempo,
                    finContinuacion,
                    Math.round(actividadCortada.tiempoDespues),
                    actividadCortada.color_hex,
                    actividadCortada.id, // actividad_padre_id
                    actividadIdDisparadora,
                    puntoInsercion
                ]);

                const parte2Id = parte2Result.rows[0].id;

                // Marcar la actividad original como dividida (soft delete)
                await query(`
                    UPDATE actividades_marketing SET
                        fue_dividida = true,
                        dividida_en_ids = $1,
                        activo = false,
                        estado = 'dividida',
                        editada = true,
                        motivo_edicion = $2,
                        deleted_at = NOW()
                    WHERE id = $3
                `, [
                    [parte1Id, parte2Id],
                    `Dividida por inserción prioritaria (ID: ${actividadIdDisparadora})`,
                    actividadCortada.id
                ]);

                console.log('✅ Actividad dividida:', {
                    original: actividadCortada.id,
                    parte1: parte1Id,
                    parte2: parte2Id
                });

                actividadesAfectadas.push(actividadCortada.id, parte1Id, parte2Id);
                cursorTiempo = finContinuacion;
            }

            // Reajustar todas las actividades posteriores
            for (const actividad of actividadesAReajustar) {
                const nuevaFechaInicio = cursorTiempo;
                const nuevaFechaFin = this.agregarMinutosEfectivos(cursorTiempo, actividad.duracion_planeada_minutos);

                await query(`
                    UPDATE actividades_marketing SET
                        fecha_inicio_planeada = $1,
                        fecha_fin_planeada = $2
                    WHERE id = $3
                `, [nuevaFechaInicio, nuevaFechaFin, actividad.id]);

                actividadesAfectadas.push(actividad.id);
                cursorTiempo = nuevaFechaFin;
            }

            // 5. Registrar reajuste en historial
            await this.registrarHistorialReajuste({
                actividad_disparadora_id: actividadIdDisparadora,
                usuario_afectado_id: usuarioId,
                actividades_afectadas_ids: actividadesAfectadas,
                tipo_reajuste: 'insercion_prioritaria',
                detalles: {
                    fecha_insercion: fechaInsercion,
                    duracion_minutos: duracionMinutos,
                    total_afectadas: actividadesAfectadas.length
                }
            });

            return {
                success: true,
                actividades_afectadas: actividadesAfectadas.length,
                detalles: {
                    cortadas: actividadesCortadas.length,
                    reajustadas: actividadesAReajustar.length
                }
            };

        } catch (error) {
            console.error('Error en reajustarActividades:', error);
            throw error;
        }
    }

    /**
     * Agregar minutos efectivos respetando jornada laboral y almuerzo
     * Lunes-Viernes: 8 AM - 6 PM (con almuerzo 1-2 PM)
     * Sábado: 9 AM - 12 PM (sin almuerzo)
     * Domingo: NO laboral
     *
     * Las actividades SÍ pueden dividirse entre días.
     * Se trabaja todo el tiempo disponible cada día.
     *
     * PROTEGIDO CONTRA BUCLE INFINITO
     */
    static agregarMinutosEfectivos(fechaInicio, minutosAAgregar) {
        const JORNADA_INICIO_LUNES_VIERNES = 8;  // 8 AM
        const JORNADA_FIN_LUNES_VIERNES = 18;    // 6 PM
        const JORNADA_INICIO_SABADO = 9;         // 9 AM
        const JORNADA_FIN_SABADO = 12;           // 12 PM (mediodía)
        const ALMUERZO_INICIO = 13; // 1 PM
        const ALMUERZO_FIN = 14;   // 2 PM
        const MAX_ITERACIONES = 10000; // Protección contra bucle infinito
        const MAX_MINUTOS_PERMITIDOS = 14400; // 30 días * 8 horas/día * 60 min = 14,400 min

        // Validación: Rechazar actividades absurdamente largas
        if (minutosAAgregar > MAX_MINUTOS_PERMITIDOS) {
            throw new Error(`La duración máxima permitida es de ${MAX_MINUTOS_PERMITIDOS / 60 / 8} días laborales (${Math.round(minutosAAgregar / 60 / 8)} días solicitados). Por favor, divide esta actividad en partes más pequeñas.`);
        }

        if (minutosAAgregar <= 0) {
            throw new Error('La duración debe ser mayor a 0 minutos');
        }

        let cursor = new Date(fechaInicio);
        let minutosRestantes = minutosAAgregar;
        let iteraciones = 0;

        // Ajuste inicial: si la fecha de inicio cae en horario de almuerzo, saltarlo
        const horaInicial = cursor.getHours();
        const minutoInicial = cursor.getMinutes();
        const diaInicial = cursor.getDay();
        const esSabadoInicial = diaInicial === 6;

        // Si el inicio cae EN o DENTRO del almuerzo (13:00 - 13:59:59), mover a 14:00
        if (!esSabadoInicial && horaInicial >= ALMUERZO_INICIO && horaInicial < ALMUERZO_FIN) {
            console.log('⏰ Fecha de inicio cae en horario de almuerzo, ajustando a 2 PM');
            cursor.setHours(ALMUERZO_FIN, 0, 0, 0);
        }

        while (minutosRestantes > 0) {
            iteraciones++;

            // PROTECCIÓN: Si hay demasiadas iteraciones, abortar
            if (iteraciones > MAX_ITERACIONES) {
                console.error('🚨 BUCLE INFINITO DETECTADO en agregarMinutosEfectivos:', {
                    fechaInicio,
                    minutosAAgregar,
                    minutosRestantes,
                    cursorActual: cursor,
                    iteraciones
                });
                throw new Error('Bucle infinito detectado al calcular fechas. Por favor, reduce la duración de la actividad.');
            }
            const hora = cursor.getHours();
            const minuto = cursor.getMinutes();
            const diaSemana = cursor.getDay(); // 0=Domingo, 6=Sábado

            // Determinar horario según día
            const esSabado = diaSemana === 6;
            const esDomingo = diaSemana === 0;
            const JORNADA_INICIO = esSabado ? JORNADA_INICIO_SABADO : JORNADA_INICIO_LUNES_VIERNES;
            const JORNADA_FIN = esSabado ? JORNADA_FIN_SABADO : JORNADA_FIN_LUNES_VIERNES;

            // Si es domingo, saltar al lunes 8 AM
            if (esDomingo) {
                cursor.setDate(cursor.getDate() + 1);
                cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                continue;
            }

            // Si estamos fuera de jornada (antes de inicio o después de fin)
            if (hora >= JORNADA_FIN || hora < JORNADA_INICIO) {
                cursor.setDate(cursor.getDate() + 1);
                const siguienteDia = cursor.getDay();

                // Si el siguiente día es domingo, saltar al lunes
                if (siguienteDia === 0) {
                    cursor.setDate(cursor.getDate() + 1);
                    cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                } else if (siguienteDia === 6) {
                    // Si el siguiente día es sábado
                    cursor.setHours(JORNADA_INICIO_SABADO, 0, 0, 0);
                } else {
                    // Día laboral normal
                    cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                }
                continue;
            }

            // Calcular minutos hasta el almuerzo
            const minutosActuales = hora * 60 + minuto;
            const minutosAlmuerzo = ALMUERZO_INICIO * 60;
            const minutosFinAlmuerzo = ALMUERZO_FIN * 60;
            const minutosFinJornada = JORNADA_FIN * 60;

            // PROTECCIÓN: Si estamos EN el almuerzo (13:00-13:59), saltar a 14:00
            if (!esSabado && minutosActuales >= minutosAlmuerzo && minutosActuales < minutosFinAlmuerzo) {
                console.log('⚠️ Cursor en almuerzo, saltando a 2 PM');
                cursor.setHours(ALMUERZO_FIN, 0, 0, 0);
                continue;
            }

            // Si la actividad va a cruzar el almuerzo (solo lunes-viernes)
            if (!esSabado && hora < ALMUERZO_INICIO && minutosActuales + minutosRestantes > minutosAlmuerzo) {
                const minutosHastaAlmuerzo = minutosAlmuerzo - minutosActuales;

                // Validación: si es negativo, saltar este check
                if (minutosHastaAlmuerzo > 0) {
                    // Consumir los minutos hasta el almuerzo y saltar a las 2 PM
                    cursor.setHours(ALMUERZO_FIN, 0, 0, 0);
                    minutosRestantes -= minutosHastaAlmuerzo;
                    if (iteraciones % 100 === 0 || minutosAAgregar > 480) { // Log cada 100 iteraciones o si son más de 8 horas
                        console.log(`⏰ Saltando almuerzo. Restantes: ${Math.round(minutosRestantes)} min (iter: ${iteraciones})`);
                    }
                    continue;
                }
            }

            // Si llegamos al fin de jornada
            if (minutosActuales + minutosRestantes >= minutosFinJornada) {
                const minutosHastaFin = minutosFinJornada - minutosActuales;

                // Validación: si es negativo o cero, significa que ya estamos fuera de jornada
                if (minutosHastaFin <= 0) {
                    console.warn('⚠️ minutosHastaFin es <= 0, saltando al siguiente día');
                    cursor.setDate(cursor.getDate() + 1);
                    const siguienteDia = cursor.getDay();
                    if (siguienteDia === 0) {
                        cursor.setDate(cursor.getDate() + 1);
                        cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                    } else if (siguienteDia === 6) {
                        cursor.setHours(JORNADA_INICIO_SABADO, 0, 0, 0);
                    } else {
                        cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                    }
                    continue;
                }

                cursor.setDate(cursor.getDate() + 1);

                const siguienteDia = cursor.getDay();

                // Si el siguiente día es domingo, saltar al lunes
                if (siguienteDia === 0) {
                    cursor.setDate(cursor.getDate() + 1);
                    cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                } else if (siguienteDia === 6) {
                    // Si el siguiente día es sábado
                    cursor.setHours(JORNADA_INICIO_SABADO, 0, 0, 0);
                } else {
                    // Día laboral normal
                    cursor.setHours(JORNADA_INICIO_LUNES_VIERNES, 0, 0, 0);
                }

                minutosRestantes -= minutosHastaFin;
                if (iteraciones % 100 === 0 || minutosAAgregar > 480) {
                    console.log(`📅 Fin de jornada. Restantes: ${Math.round(minutosRestantes)} min (iter: ${iteraciones})`);
                }
                continue;
            }

            // Agregar minutos normalmente (dentro de la misma jornada)
            cursor.setMinutes(cursor.getMinutes() + minutosRestantes);
            if (minutosAAgregar > 480) {
                console.log(`✅ Completado. Total: ${minutosAAgregar} min, Iteraciones: ${iteraciones}`);
            }
            minutosRestantes = 0;
        }

        return cursor;
    }

    /**
     * Obtener actividades pendientes y en progreso del usuario
     *
     * LÓGICA CORREGIDA:
     * - Busca actividades que TERMINAN después del punto de inserción
     * - Esto incluye tanto actividades futuras como actividades ya en progreso
     */
    static async obtenerActividadesPendientes(usuarioId, fechaDesde, excluirActividadId = null) {
        let sql = `
            SELECT *
            FROM actividades_marketing
            WHERE usuario_id = $1
              AND activo = true
              AND estado IN ('pendiente', 'en_progreso')
              AND fecha_fin_planeada > $2  -- CORREGIDO: actividades que terminan DESPUÉS del punto
        `;

        const params = [usuarioId, fechaDesde];

        if (excluirActividadId) {
            sql += ` AND id != $3`;
            params.push(excluirActividadId);
        }

        sql += ` ORDER BY fecha_inicio_planeada ASC`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Registrar reajuste en historial
     */
    static async registrarHistorialReajuste(datos) {
        try {
            await query(`
                INSERT INTO historial_reajustes (
                    actividad_disparadora_id,
                    usuario_afectado_id,
                    actividades_afectadas_ids,
                    tipo_reajuste,
                    detalles
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                datos.actividad_disparadora_id,
                datos.usuario_afectado_id,
                datos.actividades_afectadas_ids,
                datos.tipo_reajuste,
                JSON.stringify(datos.detalles)
            ]);
        } catch (error) {
            console.error('Error registrando historial de reajuste:', error);
        }
    }

    /**
     * Calcular minutos disponibles restantes en el día actual
     */
    static calcularMinutosDisponiblesHoy(fechaActual) {
        const JORNADA_FIN = 18; // 6 PM
        const ALMUERZO_INICIO = 13;
        const ALMUERZO_FIN = 14;

        const hora = fechaActual.getHours();
        const minutos = fechaActual.getMinutes();
        const horaDecimal = hora + (minutos / 60);

        // Si ya pasó la jornada, no hay tiempo disponible
        if (hora >= JORNADA_FIN) {
            return 0;
        }

        // Calcular minutos hasta el fin de jornada (18:00)
        const minutosHastaFin = (JORNADA_FIN - horaDecimal) * 60;

        // Si estamos ANTES del almuerzo, restar la hora de almuerzo
        if (hora < ALMUERZO_INICIO) {
            return minutosHastaFin - 60; // Restar 1 hora de almuerzo
        }

        // Si estamos EN el almuerzo o DESPUÉS, no restar nada (ya pasó)
        return minutosHastaFin;
    }

    /**
     * Saltar almuerzo si cae en ese horario
     */
    static saltarAlmuerzo(fecha) {
        const hora = fecha.getHours();
        const minuto = fecha.getMinutes();

        if (hora === 13 || (hora === 14 && minuto === 0)) {
            fecha.setHours(14, 0, 0, 0);
        }

        return fecha;
    }
}

module.exports = ReajusteService;
