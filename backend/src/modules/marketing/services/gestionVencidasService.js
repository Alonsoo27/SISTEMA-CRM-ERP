// ============================================
// SERVICIO DE GESTIÓN DE ACTIVIDADES VENCIDAS
// Maneja el ciclo de vida de actividades que pasaron su hora de fin
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('./reajusteService');
const actividadesService = require('./actividadesService');

class GestionVencidasService {
    /**
     * Detectar actividades que requieren gestión
     * Retorna actividades vencidas que aún no han sido gestionadas
     * INCLUYE: en_progreso Y pendientes que nunca se iniciaron
     */
    static async detectarActividadesRequierenGestion(usuarioId) {
        try {
            const ahora = new Date();

            const result = await query(`
                SELECT
                    am.*,
                    EXTRACT(EPOCH FROM (NOW() - am.fecha_fin_planeada)) / 60 as minutos_desde_vencimiento
                FROM actividades_marketing am
                WHERE am.usuario_id = $1
                  AND am.activo = true
                  AND am.estado IN ('en_progreso', 'pendiente')
                  AND am.fecha_fin_planeada < $2
                  AND (am.fue_vencida = false OR am.fue_vencida IS NULL)
                  AND am.tipo != 'sistema'
                ORDER BY am.fecha_fin_planeada ASC
            `, [usuarioId, ahora]);

            // Clasificar actividades por ventana de tiempo
            const actividades = result.rows.map(act => {
                const minutosVencimiento = Math.round(act.minutos_desde_vencimiento);

                let ventana = 'muy_vencida'; // 60+ minutos
                if (minutosVencimiento <= 5) {
                    ventana = 'recien_vencida'; // 0-5 minutos
                } else if (minutosVencimiento <= 60) {
                    ventana = 'vencida'; // 5-60 minutos
                }

                return {
                    ...act,
                    minutos_vencimiento: minutosVencimiento,
                    ventana: ventana,
                    acciones_disponibles: this.obtenerAccionesDisponibles(ventana)
                };
            });

            // ============================================
            // CREAR NOTIFICACIONES EN LA CAMPANA
            // ============================================
            if (actividades.length > 0) {
                try {
                    // Crear notificación consolidada si hay varias actividades
                    const prioridad = actividades.some(a => a.ventana === 'muy_vencida') ? 'critica' :
                                     actividades.some(a => a.ventana === 'vencida') ? 'alta' : 'media';

                    const titulo = actividades.length === 1
                        ? `⚠️ Actividad Vencida: ${actividades[0].codigo}`
                        : `⚠️ ${actividades.length} Actividades Vencidas`;

                    const mensaje = actividades.length === 1
                        ? `Tu actividad "${actividades[0].descripcion}" venció hace ${actividades[0].minutos_vencimiento} minutos y requiere gestión inmediata.`
                        : `Tienes ${actividades.length} actividades que vencieron y requieren tu atención inmediata.`;

                    // Verificar si ya existe una notificación reciente para evitar duplicados
                    const notifExistente = await query(`
                        SELECT id FROM notificaciones
                        WHERE usuario_id = $1
                          AND tipo = 'actividad_vencida_marketing'
                          AND created_at > NOW() - INTERVAL '5 minutes'
                        LIMIT 1
                    `, [usuarioId]);

                    if (notifExistente.rows.length === 0) {
                        await query(`
                            INSERT INTO notificaciones (
                                usuario_id, tipo, titulo, mensaje, prioridad,
                                datos_extra, accion_url, accion_texto, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                        `, [
                            usuarioId,
                            'actividad_vencida_marketing',
                            titulo,
                            mensaje,
                            prioridad,
                            JSON.stringify({
                                actividades_vencidas: actividades.map(a => ({
                                    id: a.id,
                                    codigo: a.codigo,
                                    descripcion: a.descripcion,
                                    minutos_vencimiento: a.minutos_vencimiento,
                                    ventana: a.ventana
                                }))
                            }),
                            '/marketing',
                            'Gestionar Actividades'
                        ]);

                        console.log(`✅ Notificación de campana creada para usuario ${usuarioId}: ${actividades.length} actividad(es) vencida(s)`);
                    }
                } catch (notifError) {
                    console.error('Error creando notificación de campana:', notifError);
                    // No lanzar error, solo registrar - las actividades se siguen detectando
                }
            }

            return {
                success: true,
                actividades: actividades,
                total: actividades.length
            };

        } catch (error) {
            console.error('Error detectando actividades vencidas:', error);
            throw error;
        }
    }

    /**
     * Obtener acciones disponibles según ventana de tiempo
     */
    static obtenerAccionesDisponibles(ventana) {
        const acciones = {
            recien_vencida: [
                {
                    id: 'completar',
                    label: 'Ya la completé',
                    descripcion: 'Se marcará como completada ahora'
                },
                {
                    id: 'extender',
                    label: 'Necesito más tiempo',
                    descripcion: 'Aún estoy trabajando en ella (sin límite de minutos)'
                },
                {
                    id: 'posponer',
                    label: 'Recordarme en 5 minutos',
                    descripcion: 'Aún no termino pero estoy en ello'
                }
            ],
            vencida: [
                {
                    id: 'completar_retroactivo',
                    label: 'La completé fuera de tiempo',
                    descripcion: 'Indica a qué hora terminaste realmente'
                },
                {
                    id: 'reprogramar',
                    label: 'Reprogramar como continuación',
                    descripcion: 'No pude completarla, crear PARTE 2'
                },
                {
                    id: 'cancelar',
                    label: 'No la pude hacer',
                    descripcion: 'Cancelar con motivo'
                }
            ],
            muy_vencida: [
                {
                    id: 'completar_fuera_tiempo',
                    label: 'Marcar como completada',
                    descripcion: 'Se registrará como completada fuera de tiempo'
                },
                {
                    id: 'cancelar',
                    label: 'Cancelar',
                    descripcion: 'No se completó'
                }
            ]
        };

        return acciones[ventana] || [];
    }

    /**
     * Gestionar actividad vencida según acción tomada
     */
    static async gestionarActividadVencida(actividadId, userId, accion, datos) {
        try {
            const ahora = new Date();

            // 1. Obtener actividad
            const actResult = await query(
                'SELECT * FROM actividades_marketing WHERE id = $1',
                [actividadId]
            );

            if (actResult.rows.length === 0) {
                throw new Error('Actividad no encontrada');
            }

            const actividad = actResult.rows[0];

            // Calcular minutos de vencimiento
            const minutosVencimiento = Math.round(
                (ahora - new Date(actividad.fecha_fin_planeada)) / 60000
            );

            // 2. Validar ventana de tiempo según acción
            if (accion === 'extender' && minutosVencimiento > 5) {
                return {
                    success: false,
                    message: 'Solo puedes extender una actividad dentro de los primeros 5 minutos después de vencer'
                };
            }

            if (accion === 'posponer' && minutosVencimiento > 5) {
                return {
                    success: false,
                    message: 'Solo puedes posponer la alerta dentro de los primeros 5 minutos'
                };
            }

            // 3. Ejecutar acción correspondiente
            let resultado;
            switch (accion) {
                case 'completar':
                    resultado = await this.completarAhora(actividadId, userId, minutosVencimiento, datos);
                    break;

                case 'extender':
                    resultado = await this.extenderVencida(actividadId, userId, minutosVencimiento, datos);
                    break;

                case 'posponer':
                    resultado = await this.posponerAlerta(actividadId, userId, minutosVencimiento);
                    break;

                case 'completar_retroactivo':
                    resultado = await this.completarRetroactivo(actividadId, userId, minutosVencimiento, datos);
                    break;

                case 'reprogramar':
                    resultado = await this.reprogramarContinuacion(actividadId, userId, minutosVencimiento, datos);
                    break;

                case 'completar_fuera_tiempo':
                    resultado = await this.completarFueraTiempo(actividadId, userId, minutosVencimiento, datos);
                    break;

                case 'cancelar':
                    resultado = await this.cancelarVencida(actividadId, userId, minutosVencimiento, datos);
                    break;

                default:
                    throw new Error(`Acción no válida: ${accion}`);
            }

            // 4. Registrar gestión
            await query(`
                INSERT INTO actividades_vencidas_gestionadas (
                    actividad_id, usuario_id, fecha_vencimiento_original,
                    fecha_deteccion, fecha_gestion, accion_tomada,
                    minutos_vencimiento, motivo
                ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
            `, [
                actividadId,
                userId,
                actividad.fecha_fin_planeada,
                accion,
                minutosVencimiento,
                datos.motivo || null
            ]);

            return resultado;

        } catch (error) {
            console.error('Error gestionando actividad vencida:', error);
            throw error;
        }
    }

    // ============================================
    // ACCIONES ESPECÍFICAS
    // ============================================

    /**
     * ACCIÓN: Completar ahora (0-5 min)
     */
    static async completarAhora(actividadId, userId, minutosVencimiento, datos) {
        await query(`
            UPDATE actividades_marketing SET
                estado = 'completada',
                fecha_fin_real = NOW(),
                duracion_real_minutos = EXTRACT(EPOCH FROM (NOW() - fecha_inicio_real)) / 60,
                fue_vencida = true,
                minutos_vencimiento = $1,
                gestionada_vencimiento_en = NOW()
            WHERE id = $2
        `, [minutosVencimiento, actividadId]);

        return {
            success: true,
            message: 'Actividad completada exitosamente',
            accion: 'completada'
        };
    }

    /**
     * ACCIÓN: Extender (0-5 min) - SIN LÍMITE DE MINUTOS
     */
    static async extenderVencida(actividadId, userId, minutosVencimiento, datos) {
        const { minutos_adicionales, motivo } = datos;

        if (!minutos_adicionales || minutos_adicionales <= 0) {
            throw new Error('Debes especificar minutos adicionales válidos');
        }

        // Calcular nueva fecha de fin desde AHORA (no desde la fecha original)
        const ahora = new Date();
        const nuevaFechaFin = new Date(ahora.getTime() + (minutos_adicionales * 60000));

        // Actualizar actividad
        await query(`
            UPDATE actividades_marketing SET
                tiempo_adicional_minutos = tiempo_adicional_minutos + $1,
                fecha_fin_planeada = $2,
                fue_vencida = true,
                minutos_vencimiento = $3,
                gestionada_vencimiento_en = NOW(),
                motivo_edicion = $4,
                editada = true,
                editada_en = NOW()
            WHERE id = $5
        `, [minutos_adicionales, nuevaFechaFin, minutosVencimiento, motivo, actividadId]);

        // Registrar extensión
        await query(`
            INSERT INTO extensiones_actividades (actividad_id, usuario_id, minutos_adicionales, motivo)
            VALUES ($1, $2, $3, $4)
        `, [actividadId, userId, minutos_adicionales, motivo]);

        return {
            success: true,
            message: `Actividad extendida ${minutos_adicionales} minutos desde ahora`,
            nueva_fecha_fin: nuevaFechaFin,
            accion: 'extendida'
        };
    }

    /**
     * ACCIÓN: Posponer alerta (0-5 min)
     */
    static async posponerAlerta(actividadId, userId, minutosVencimiento) {
        // No modifica la BD, solo retorna info para el frontend
        return {
            success: true,
            message: 'Alerta pospuesta 5 minutos',
            posponer_hasta: new Date(Date.now() + 5 * 60000),
            accion: 'pospuesta'
        };
    }

    /**
     * ACCIÓN: Completar retroactivo (5-60 min)
     */
    static async completarRetroactivo(actividadId, userId, minutosVencimiento, datos) {
        const { hora_fin_real, motivo } = datos;

        if (!hora_fin_real) {
            throw new Error('Debes especificar la hora real de finalización');
        }

        const fechaFinReal = new Date(hora_fin_real);
        const ahora = new Date();

        // Validar que no sea en el futuro
        if (fechaFinReal > ahora) {
            throw new Error('La hora de finalización no puede ser en el futuro');
        }

        await query(`
            UPDATE actividades_marketing SET
                estado = 'completada',
                fecha_fin_real = $1,
                duracion_real_minutos = EXTRACT(EPOCH FROM ($1 - fecha_inicio_real)) / 60,
                fue_vencida = true,
                minutos_vencimiento = $2,
                gestionada_vencimiento_en = NOW(),
                motivo_edicion = $3
            WHERE id = $4
        `, [fechaFinReal, minutosVencimiento, motivo, actividadId]);

        return {
            success: true,
            message: 'Actividad completada con hora ajustada',
            accion: 'completada_retroactiva'
        };
    }

    /**
     * ACCIÓN: Reprogramar como continuación (5-60 min)
     */
    static async reprogramarContinuacion(actividadId, userId, minutosVencimiento, datos) {
        const { tiempo_restante_minutos, motivo, descripcion_adicional } = datos;

        if (!tiempo_restante_minutos || tiempo_restante_minutos <= 0) {
            throw new Error('Debes especificar el tiempo restante necesario');
        }

        // Obtener actividad original
        const actResult = await query(
            'SELECT * FROM actividades_marketing WHERE id = $1',
            [actividadId]
        );
        const actividadOriginal = actResult.rows[0];

        // Marcar original como interrumpida
        await query(`
            UPDATE actividades_marketing SET
                estado = 'interrumpida',
                fue_vencida = true,
                minutos_vencimiento = $1,
                gestionada_vencimiento_en = NOW(),
                motivo_edicion = $2
            WHERE id = $3
        `, [minutosVencimiento, motivo, actividadId]);

        // Buscar próximo slot disponible
        const proximoSlot = await actividadesService.obtenerProximoSlotDisponible(
            actividadOriginal.usuario_id,
            tiempo_restante_minutos
        );

        const fechaInicio = proximoSlot.fecha || proximoSlot;
        const fechaFin = reajusteService.agregarMinutosEfectivos(fechaInicio, tiempo_restante_minutos);

        // Crear actividad continuación
        const codigo = await actividadesService.generarCodigoActividad();
        const descripcionContinuacion = descripcion_adicional
            ? `${actividadOriginal.descripcion} (PARTE 2 - ${descripcion_adicional})`
            : `${actividadOriginal.descripcion} (PARTE 2)`;

        const resultContinuacion = await query(`
            INSERT INTO actividades_marketing (
                codigo, categoria_principal, subcategoria, descripcion,
                usuario_id, creado_por, tipo, es_continuacion, actividad_padre_id,
                fecha_inicio_planeada, fecha_fin_planeada, duracion_planeada_minutos,
                color_hex, estado, notas
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, 'pendiente', $13)
            RETURNING *
        `, [
            codigo,
            actividadOriginal.categoria_principal,
            actividadOriginal.subcategoria,
            descripcionContinuacion,
            actividadOriginal.usuario_id,
            userId,
            'continuacion',
            actividadId,
            fechaInicio,
            fechaFin,
            tiempo_restante_minutos,
            actividadOriginal.color_hex,
            `Continuación de ${actividadOriginal.codigo}. Motivo: ${motivo}`
        ]);

        // Registrar en tabla de continuaciones
        await query(`
            INSERT INTO continuaciones_actividades (
                actividad_original_id, actividad_continuacion_id,
                motivo_continuacion, parte_numero, tiempo_restante_minutos
            ) VALUES ($1, $2, $3, 2, $4)
        `, [actividadId, resultContinuacion.rows[0].id, motivo, tiempo_restante_minutos]);

        return {
            success: true,
            message: 'Actividad reprogramada como continuación',
            actividad_continuacion: resultContinuacion.rows[0],
            accion: 'reprogramada'
        };
    }

    /**
     * ACCIÓN: Completar fuera de tiempo (60+ min)
     */
    static async completarFueraTiempo(actividadId, userId, minutosVencimiento, datos) {
        const { motivo } = datos;

        await query(`
            UPDATE actividades_marketing SET
                estado = 'completada',
                fecha_fin_real = NOW(),
                duracion_real_minutos = EXTRACT(EPOCH FROM (NOW() - fecha_inicio_real)) / 60,
                fue_vencida = true,
                minutos_vencimiento = $1,
                gestionada_vencimiento_en = NOW(),
                motivo_edicion = $2
            WHERE id = $3
        `, [minutosVencimiento, `Completada fuera de tiempo: ${motivo}`, actividadId]);

        return {
            success: true,
            message: 'Actividad completada (fuera de tiempo)',
            accion: 'completada_fuera_tiempo'
        };
    }

    /**
     * ACCIÓN: Cancelar vencida
     */
    static async cancelarVencida(actividadId, userId, minutosVencimiento, datos) {
        const { motivo } = datos;

        if (!motivo) {
            throw new Error('El motivo de cancelación es obligatorio');
        }

        await query(`
            UPDATE actividades_marketing SET
                estado = 'cancelada',
                activo = false,
                fue_vencida = true,
                minutos_vencimiento = $1,
                gestionada_vencimiento_en = NOW(),
                motivo_edicion = $2,
                editada = true,
                editada_por = $3,
                editada_en = NOW(),
                deleted_at = NOW()
            WHERE id = $4
        `, [minutosVencimiento, motivo, userId, actividadId]);

        return {
            success: true,
            message: 'Actividad cancelada',
            accion: 'cancelada'
        };
    }
}

module.exports = GestionVencidasService;
