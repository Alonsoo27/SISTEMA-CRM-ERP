// ============================================
// SERVICIO DE RESOLUCIÓN DE COLISIONES
// Genera opciones inteligentes para resolver conflictos
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('./reajusteService');
const colisionesService = require('./colisionesService');

class ResolucionColisionesService {
    /**
     * Analizar colisión y generar opciones de resolución
     *
     * @param {Object} params - Parámetros de la nueva actividad
     * @param {Object} actividadConflicto - Actividad que está en conflicto
     * @param {string} tipoColision - Tipo de colisión detectada
     */
    static async generarOpcionesResolucion(params, actividadConflicto, tipoColision) {
        const { usuario_id, fecha_inicio, duracion_minutos, es_prioritaria } = params;
        const opciones = [];

        // OPCIÓN 1: Siempre disponible - Cancelar
        opciones.push({
            id: 'cancelar',
            nombre: 'Cancelar operación',
            descripcion: 'No crear la nueva actividad',
            viable: true,
            impacto: 'ninguno',
            requiere_confirmacion: false
        });

        // Calcular fechas de la nueva actividad
        const nuevaInicio = new Date(fecha_inicio);
        const nuevaFin = reajusteService.agregarMinutosEfectivos(nuevaInicio, duracion_minutos);

        const conflictoInicio = new Date(actividadConflicto.fecha_inicio);
        const conflictoFin = new Date(actividadConflicto.fecha_fin);

        // Si es colisión con PROGRAMADA
        if (tipoColision === 'programada') {
            // OPCIÓN 2: Mover la actividad programada después de la nueva
            const opcionMover = await this.analizarOpcionMoverProgramada(
                usuario_id,
                actividadConflicto,
                nuevaFin,
                duracion_minutos
            );
            if (opcionMover) {
                opciones.push(opcionMover);
            }

            // OPCIÓN 3: Acortar la actividad programada
            const opcionAcortar = this.analizarOpcionAcortarActividad(
                actividadConflicto,
                nuevaInicio,
                nuevaFin,
                conflictoInicio,
                conflictoFin
            );
            if (opcionAcortar) {
                opciones.push(opcionAcortar);
            }

            // OPCIÓN 4: Buscar otro espacio para la nueva actividad
            const opcionOtroEspacio = await this.analizarOpcionBuscarOtroEspacio(
                usuario_id,
                duracion_minutos,
                nuevaInicio
            );
            if (opcionOtroEspacio) {
                opciones.push(opcionOtroEspacio);
            }

            // OPCIÓN 5: Crear de todos modos (forzar solapamiento)
            opciones.push({
                id: 'forzar_solapamiento',
                nombre: 'Crear de todos modos',
                descripcion: 'Crear la actividad aunque se solape con la programada',
                viable: true,
                impacto: 'alto',
                requiere_confirmacion: true,
                advertencia: 'Esto creará un conflicto de horarios. Ambas actividades estarán programadas al mismo tiempo.',
                color: 'red'
            });
        }

        // Si es colisión con PRIORITARIA
        if (tipoColision === 'prioritaria') {
            // Solo ofrecer buscar otro espacio o cancelar
            const opcionOtroEspacio = await this.analizarOpcionBuscarOtroEspacio(
                usuario_id,
                duracion_minutos,
                nuevaInicio
            );
            if (opcionOtroEspacio) {
                opciones.push(opcionOtroEspacio);
            }
        }

        // Si es colisión con GRUPAL
        if (tipoColision === 'grupal_desde_individual') {
            // OPCIÓN: Buscar otro espacio
            const opcionOtroEspacio = await this.analizarOpcionBuscarOtroEspacio(
                usuario_id,
                duracion_minutos,
                nuevaInicio
            );
            if (opcionOtroEspacio) {
                opciones.push(opcionOtroEspacio);
            }

            // OPCIÓN: Forzar (afectará a todos los participantes)
            opciones.push({
                id: 'forzar_sobre_grupal',
                nombre: 'Insertar de todos modos (IMPACTO GRUPAL)',
                descripcion: `Esto afectará a ${actividadConflicto.total_participantes} participantes de la actividad grupal`,
                viable: true,
                impacto: 'muy_alto',
                requiere_confirmacion: true,
                advertencia: `La actividad grupal "${actividadConflicto.descripcion}" será reajustada para TODOS los participantes`,
                color: 'red'
            });
        }

        return opciones;
    }

    /**
     * Analizar si es viable mover la actividad programada después de la nueva
     */
    static async analizarOpcionMoverProgramada(usuarioId, actividadConflicto, despuesDeFecha, duracionNueva) {
        try {
            // Calcular cuánto tiempo ocuparía la programada si se mueve
            const duracionProgramada = actividadConflicto.duracion_minutos;
            const nuevoInicioProgramada = despuesDeFecha;
            const nuevoFinProgramada = reajusteService.agregarMinutosEfectivos(
                nuevoInicioProgramada,
                duracionProgramada
            );

            // Verificar si hay espacio disponible
            const hayColision = await this.verificarColisionEnRango(
                usuarioId,
                nuevoInicioProgramada,
                nuevoFinProgramada,
                actividadConflicto.id
            );

            // Contar cuántas actividades normales serían afectadas
            const actividadesAfectadas = await this.contarActividadesNormalesEnRango(
                usuarioId,
                nuevoInicioProgramada,
                nuevoFinProgramada
            );

            return {
                id: 'mover_programada',
                nombre: 'Mover actividad programada',
                descripcion: `Mover "${actividadConflicto.codigo}" después de la nueva actividad`,
                viable: true,
                impacto: actividadesAfectadas > 0 ? 'medio' : 'bajo',
                requiere_confirmacion: actividadesAfectadas > 0,
                detalles: {
                    actividad_a_mover: actividadConflicto.codigo,
                    horario_original: {
                        inicio: actividadConflicto.fecha_inicio,
                        fin: actividadConflicto.fecha_fin
                    },
                    horario_nuevo: {
                        inicio: nuevoInicioProgramada,
                        fin: nuevoFinProgramada
                    },
                    actividades_normales_afectadas: actividadesAfectadas,
                    advertencia: actividadesAfectadas > 0
                        ? `Esto moverá ${actividadesAfectadas} actividad(es) normal(es)`
                        : null
                }
            };
        } catch (error) {
            console.error('Error analizando opción mover programada:', error);
            return null;
        }
    }

    /**
     * Analizar si es viable acortar la actividad en conflicto
     */
    static analizarOpcionAcortarActividad(actividadConflicto, nuevaInicio, nuevaFin, conflictoInicio, conflictoFin) {
        // Caso 1: La nueva actividad empieza después del inicio del conflicto
        // Podemos acortar el conflicto para que termine cuando empiece la nueva
        if (nuevaInicio > conflictoInicio && nuevaInicio < conflictoFin) {
            const duracionAcortadaMinutos = (nuevaInicio - conflictoInicio) / 60000;
            const reduccionMinutos = actividadConflicto.duracion_minutos - duracionAcortadaMinutos;

            // Solo ofrecer si la reducción no es más del 50%
            if (duracionAcortadaMinutos >= (actividadConflicto.duracion_minutos * 0.5)) {
                return {
                    id: 'acortar_programada',
                    nombre: 'Acortar actividad programada',
                    descripcion: `Reducir "${actividadConflicto.codigo}" para que termine antes`,
                    viable: true,
                    impacto: 'medio',
                    requiere_confirmacion: true,
                    detalles: {
                        actividad_a_acortar: actividadConflicto.codigo,
                        duracion_original: actividadConflicto.duracion_minutos,
                        duracion_nueva: Math.round(duracionAcortadaMinutos),
                        reduccion_minutos: Math.round(reduccionMinutos),
                        horario_nuevo: {
                            inicio: conflictoInicio,
                            fin: nuevaInicio
                        },
                        advertencia: `La actividad se reducirá de ${this.formatearDuracion(actividadConflicto.duracion_minutos)} a ${this.formatearDuracion(duracionAcortadaMinutos)}`
                    }
                };
            }
        }

        // Caso 2: La nueva actividad termina antes del fin del conflicto
        // Podemos acortar el conflicto para que empiece cuando termine la nueva
        if (nuevaFin > conflictoInicio && nuevaFin < conflictoFin) {
            const duracionAcortadaMinutos = (conflictoFin - nuevaFin) / 60000;
            const reduccionMinutos = actividadConflicto.duracion_minutos - duracionAcortadaMinutos;

            if (duracionAcortadaMinutos >= (actividadConflicto.duracion_minutos * 0.5)) {
                return {
                    id: 'acortar_programada_inicio',
                    nombre: 'Acortar actividad programada (retrasar inicio)',
                    descripcion: `Reducir "${actividadConflicto.codigo}" para que empiece después`,
                    viable: true,
                    impacto: 'medio',
                    requiere_confirmacion: true,
                    detalles: {
                        actividad_a_acortar: actividadConflicto.codigo,
                        duracion_original: actividadConflicto.duracion_minutos,
                        duracion_nueva: Math.round(duracionAcortadaMinutos),
                        reduccion_minutos: Math.round(reduccionMinutos),
                        horario_nuevo: {
                            inicio: nuevaFin,
                            fin: conflictoFin
                        },
                        advertencia: `La actividad se reducirá de ${this.formatearDuracion(actividadConflicto.duracion_minutos)} a ${this.formatearDuracion(duracionAcortadaMinutos)}`
                    }
                };
            }
        }

        return null;
    }

    /**
     * Buscar espacios disponibles para la nueva actividad
     */
    static async analizarOpcionBuscarOtroEspacio(usuarioId, duracionMinutos, fechaActual) {
        try {
            // Buscar próximos 3 espacios disponibles
            const espacios = await this.buscarProximosEspaciosDisponibles(
                usuarioId,
                duracionMinutos,
                fechaActual,
                3
            );

            if (espacios.length === 0) {
                return null;
            }

            return {
                id: 'buscar_otro_espacio',
                nombre: 'Buscar otro espacio',
                descripcion: 'Programar la nueva actividad en otro horario disponible',
                viable: true,
                impacto: 'ninguno',
                requiere_confirmacion: false,
                detalles: {
                    espacios_disponibles: espacios.map(e => ({
                        fecha_inicio: e.inicio,
                        fecha_fin: e.fin,
                        disponible_completo: true,
                        descripcion: this.describirEspacio(e.inicio)
                    }))
                }
            };
        } catch (error) {
            console.error('Error buscando otros espacios:', error);
            return null;
        }
    }

    /**
     * Buscar próximos N espacios disponibles
     */
    static async buscarProximosEspaciosDisponibles(usuarioId, duracionMinutos, despuesDe, limite = 3) {
        const espacios = [];
        let fechaBusqueda = new Date(despuesDe);
        let intentos = 0;
        const MAX_INTENTOS = 50; // Buscar hasta 50 días adelante

        while (espacios.length < limite && intentos < MAX_INTENTOS) {
            const espacio = await colisionesService.buscarHuecoPosterior(
                usuarioId,
                fechaBusqueda,
                duracionMinutos
            );

            if (espacio) {
                espacios.push(espacio);
                fechaBusqueda = espacio.fin;
            } else {
                // Si no encuentra hueco, avanzar 1 día
                fechaBusqueda = new Date(fechaBusqueda);
                fechaBusqueda.setDate(fechaBusqueda.getDate() + 1);
                fechaBusqueda.setHours(8, 0, 0, 0);
            }

            intentos++;
        }

        return espacios;
    }

    /**
     * Verificar si hay colisión en un rango de fechas
     */
    static async verificarColisionEnRango(usuarioId, inicio, fin, excluirActividadId = null) {
        let sql = `
            SELECT COUNT(*) as total
            FROM actividades_marketing
            WHERE usuario_id = $1
              AND activo = true
              AND estado IN ('pendiente', 'en_progreso')
              AND (fecha_inicio_planeada, fecha_fin_planeada) OVERLAPS ($2, $3)
        `;

        const params = [usuarioId, inicio, fin];

        if (excluirActividadId) {
            sql += ` AND id != $4`;
            params.push(excluirActividadId);
        }

        const result = await query(sql, params);
        return result.rows[0].total > 0;
    }

    /**
     * Contar actividades NORMALES en un rango (que serían afectadas)
     */
    static async contarActividadesNormalesEnRango(usuarioId, inicio, fin) {
        const sql = `
            SELECT COUNT(*) as total
            FROM actividades_marketing
            WHERE usuario_id = $1
              AND activo = true
              AND estado IN ('pendiente', 'en_progreso')
              AND (fecha_inicio_planeada, fecha_fin_planeada) OVERLAPS ($2, $3)
              AND es_programada = false
              AND es_grupal = false
              AND es_prioritaria = false
        `;

        const result = await query(sql, [usuarioId, inicio, fin]);
        return parseInt(result.rows[0].total);
    }

    /**
     * Formatear duración en formato legible
     */
    static formatearDuracion(minutos) {
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        if (horas > 0 && mins > 0) {
            return `${horas}h ${mins}min`;
        } else if (horas > 0) {
            return `${horas}h`;
        } else {
            return `${mins}min`;
        }
    }

    /**
     * Describir espacio en lenguaje natural
     */
    static describirEspacio(fecha) {
        const f = new Date(fecha);
        const hoy = new Date();
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const esMismaFecha = (d1, d2) => {
            return d1.getFullYear() === d2.getFullYear() &&
                   d1.getMonth() === d2.getMonth() &&
                   d1.getDate() === d2.getDate();
        };

        let dia = '';
        if (esMismaFecha(f, hoy)) {
            dia = 'Hoy';
        } else if (esMismaFecha(f, manana)) {
            dia = 'Mañana';
        } else {
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            dia = dias[f.getDay()] + ' ' + f.getDate() + '/' + (f.getMonth() + 1);
        }

        const hora = f.getHours().toString().padStart(2, '0');
        const min = f.getMinutes().toString().padStart(2, '0');

        return `${dia} a las ${hora}:${min}`;
    }

    /**
     * Ejecutar resolución seleccionada
     */
    static async ejecutarResolucion(opcionId, datosActividad, actividadConflictoId, detallesOpcion) {
        try {
            switch (opcionId) {
                case 'cancelar':
                    return {
                        success: true,
                        accion: 'cancelado',
                        mensaje: 'Operación cancelada'
                    };

                case 'mover_programada':
                    return await this.ejecutarMoverProgramada(
                        actividadConflictoId,
                        detallesOpcion.horario_nuevo,
                        datosActividad
                    );

                case 'acortar_programada':
                case 'acortar_programada_inicio':
                    return await this.ejecutarAcortarProgramada(
                        actividadConflictoId,
                        detallesOpcion.horario_nuevo,
                        datosActividad
                    );

                case 'buscar_otro_espacio':
                    return await this.ejecutarBuscarOtroEspacio(
                        datosActividad,
                        detallesOpcion.espacio_seleccionado
                    );

                case 'forzar_solapamiento':
                case 'forzar_sobre_grupal':
                    return await this.ejecutarForzarSolapamiento(datosActividad);

                default:
                    throw new Error(`Opción de resolución desconocida: ${opcionId}`);
            }
        } catch (error) {
            console.error('Error ejecutando resolución:', error);
            throw error;
        }
    }

    /**
     * Ejecutar: Mover actividad programada
     */
    static async ejecutarMoverProgramada(actividadId, nuevoHorario, datosActividadNueva) {
        // 1. Actualizar la actividad programada con el nuevo horario
        const nuevaFechaFin = reajusteService.agregarMinutosEfectivos(
            new Date(nuevoHorario.inicio),
            (new Date(nuevoHorario.fin) - new Date(nuevoHorario.inicio)) / 60000
        );

        await query(`
            UPDATE actividades_marketing
            SET fecha_inicio_planeada = $1,
                fecha_fin_planeada = $2,
                editada = true,
                motivo_edicion = 'MOVIDA POR COLISIÓN CON PRIORITARIA'
            WHERE id = $3
        `, [nuevoHorario.inicio, nuevaFechaFin, actividadId]);

        // 2. Ejecutar reajuste de actividades normales que ahora colisionan
        const actividadActualizada = await query('SELECT * FROM actividades_marketing WHERE id = $1', [actividadId]);
        if (actividadActualizada.rows.length > 0) {
            const act = actividadActualizada.rows[0];
            await reajusteService.reajustarActividades(
                act.usuario_id,
                new Date(nuevoHorario.inicio),
                act.duracion_planeada_minutos,
                actividadId,
                true // Solo mover normales
            );
        }

        return {
            success: true,
            accion: 'actividad_programada_movida',
            actividad_movida_id: actividadId,
            nuevo_horario: nuevoHorario,
            mensaje: 'Actividad programada movida exitosamente. Ahora puedes crear la nueva actividad.'
        };
    }

    /**
     * Ejecutar: Acortar actividad programada
     */
    static async ejecutarAcortarProgramada(actividadId, nuevoHorario, datosActividadNueva) {
        const nuevaDuracion = (new Date(nuevoHorario.fin) - new Date(nuevoHorario.inicio)) / 60000;

        await query(`
            UPDATE actividades_marketing
            SET fecha_inicio_planeada = $1,
                fecha_fin_planeada = $2,
                duracion_planeada_minutos = $3,
                editada = true,
                motivo_edicion = 'ACORTADA POR COLISIÓN CON PRIORITARIA'
            WHERE id = $4
        `, [nuevoHorario.inicio, nuevoHorario.fin, Math.round(nuevaDuracion), actividadId]);

        return {
            success: true,
            accion: 'actividad_programada_acortada',
            actividad_acortada_id: actividadId,
            nuevo_horario: nuevoHorario,
            nueva_duracion: Math.round(nuevaDuracion),
            mensaje: 'Actividad programada acortada exitosamente. Ahora puedes crear la nueva actividad.'
        };
    }

    /**
     * Ejecutar: Buscar otro espacio
     */
    static async ejecutarBuscarOtroEspacio(datosActividad, espacioSeleccionado) {
        // Retornar los datos modificados para que el controller cree la actividad
        return {
            success: true,
            accion: 'usar_otro_espacio',
            fecha_inicio_modificada: espacioSeleccionado.inicio,
            mensaje: 'Actividad será creada en el espacio seleccionado'
        };
    }

    /**
     * Ejecutar: Forzar solapamiento
     */
    static async ejecutarForzarSolapamiento(datosActividad) {
        // Solo retornar confirmación, el controller creará la actividad normalmente
        return {
            success: true,
            accion: 'forzar_creacion',
            advertencia: 'La actividad se creará con solapamiento confirmado',
            mensaje: 'Proceder con la creación de la actividad'
        };
    }
}

module.exports = ResolucionColisionesService;
