// ============================================
// SERVICIO DE OPTIMIZACIÓN DE CALENDARIO
// Adelanta actividades cuando se cancela una actividad
// ============================================

const { query } = require('../../../config/database');
const reajusteService = require('./reajusteService');

class OptimizacionService {
    /**
     * Analizar qué actividades se pueden adelantar al cancelar una actividad
     *
     * Retorna:
     * - actividades_a_adelantar: Array de actividades que se moverán
     * - advertencias: Mensajes sobre limitaciones encontradas
     * - total_tiempo_optimizado: Minutos totales que se optimizan
     */
    static async analizarOptimizacion(actividadCanceladaId) {
        try {
            // 1. Obtener la actividad cancelada
            const actividadResult = await query(
                'SELECT * FROM actividades_marketing WHERE id = $1',
                [actividadCanceladaId]
            );

            if (actividadResult.rows.length === 0) {
                throw new Error('Actividad no encontrada');
            }

            const actividadCancelada = actividadResult.rows[0];
            const inicioHueco = new Date(actividadCancelada.fecha_inicio_planeada);
            const finHueco = new Date(actividadCancelada.fecha_fin_planeada);
            const duracionHueco = actividadCancelada.duracion_planeada_minutos;

            console.log('🔍 Analizando optimización:', {
                actividad_id: actividadCanceladaId,
                usuario_id: actividadCancelada.usuario_id,
                inicio_hueco: inicioHueco,
                fin_hueco: finHueco,
                duracion_hueco: duracionHueco
            });

            // 2. Obtener actividades posteriores PENDIENTES del mismo usuario y mismo día
            const diaInicio = new Date(inicioHueco);
            diaInicio.setHours(0, 0, 0, 0);
            const diaFin = new Date(inicioHueco);
            diaFin.setHours(23, 59, 59, 999);

            const actividadesResult = await query(`
                SELECT
                    id,
                    codigo,
                    descripcion,
                    categoria_principal,
                    subcategoria,
                    fecha_inicio_planeada,
                    fecha_fin_planeada,
                    duracion_planeada_minutos,
                    es_programada,
                    es_grupal,
                    es_prioritaria
                FROM actividades_marketing
                WHERE usuario_id = $1
                  AND activo = true
                  AND estado = 'pendiente'
                  AND id != $2
                  AND fecha_inicio_planeada >= $3
                  AND fecha_inicio_planeada >= $4
                  AND fecha_inicio_planeada <= $5
                ORDER BY fecha_inicio_planeada ASC
            `, [
                actividadCancelada.usuario_id,
                actividadCanceladaId,
                finHueco,
                diaInicio,
                diaFin
            ]);

            if (actividadesResult.rows.length === 0) {
                return {
                    puede_optimizar: false,
                    actividades_a_adelantar: [],
                    advertencias: ['No hay actividades posteriores en el mismo día para adelantar'],
                    total_tiempo_optimizado: 0
                };
            }

            console.log(`📋 Actividades candidatas: ${actividadesResult.rows.length}`);

            // 3. Simular adelantamiento en cascada
            const actividadesAdelantar = [];
            const advertencias = [];
            let cursorTiempo = new Date(inicioHueco);

            for (const actividad of actividadesResult.rows) {
                const inicioOriginal = new Date(actividad.fecha_inicio_planeada);
                const finOriginal = new Date(actividad.fecha_fin_planeada);
                const duracion = actividad.duracion_planeada_minutos;

                // VALIDACIÓN 1: No adelantar actividades programadas manualmente
                if (actividad.es_programada) {
                    advertencias.push(`"${actividad.descripcion}" es programada manualmente - no se adelantará`);
                    console.log(`⚠️ Actividad ${actividad.id} es programada - DETENER cascada`);
                    break; // Detener cascada
                }

                // Calcular nuevo horario
                const nuevoInicio = new Date(cursorTiempo);
                const nuevoFin = this.calcularFinConLimites(nuevoInicio, duracion);

                if (!nuevoFin) {
                    // No se pudo calcular fin válido (cruza límites)
                    advertencias.push(`"${actividad.descripcion}" cruza límites de jornada - cascada detenida`);
                    console.log(`⚠️ Actividad ${actividad.id} cruza límites - DETENER cascada`);
                    break;
                }

                // VALIDACIÓN 2: Verificar que el nuevo horario no cruza almuerzo
                if (this.cruzaAlmuerzo(nuevoInicio, nuevoFin)) {
                    advertencias.push(`"${actividad.descripcion}" cruzaría el almuerzo - cascada detenida`);
                    console.log(`⚠️ Actividad ${actividad.id} cruza almuerzo - DETENER cascada`);
                    break;
                }

                // VALIDACIÓN 3: Verificar que no cruza fin de jornada
                if (this.cruzaFinJornada(nuevoFin)) {
                    advertencias.push(`"${actividad.descripcion}" cruzaría el fin de jornada - cascada detenida`);
                    console.log(`⚠️ Actividad ${actividad.id} cruza fin jornada - DETENER cascada`);
                    break;
                }

                // VALIDACIÓN 4: Solo adelantar si realmente se mueve
                const tiempoAdelantado = (inicioOriginal - nuevoInicio) / 60000; // minutos
                if (tiempoAdelantado <= 0) {
                    // Ya no hay más actividades que adelantar
                    console.log(`✅ Actividad ${actividad.id} ya está en su lugar óptimo`);
                    break;
                }

                // Actividad válida para adelantar
                actividadesAdelantar.push({
                    id: actividad.id,
                    codigo: actividad.codigo,
                    descripcion: actividad.descripcion,
                    categoria: `${actividad.categoria_principal} › ${actividad.subcategoria}`,
                    inicio_original: inicioOriginal,
                    fin_original: finOriginal,
                    inicio_nuevo: nuevoInicio,
                    fin_nuevo: nuevoFin,
                    minutos_adelantados: Math.round(tiempoAdelantado),
                    es_grupal: actividad.es_grupal,
                    es_prioritaria: actividad.es_prioritaria
                });

                console.log(`✅ Actividad ${actividad.id} se puede adelantar ${Math.round(tiempoAdelantado)} minutos`);

                // Mover cursor al fin de esta actividad (en su nuevo horario)
                cursorTiempo = new Date(nuevoFin);
            }

            // 4. Calcular tiempo total optimizado
            const totalTiempoOptimizado = actividadesAdelantar.reduce(
                (sum, act) => sum + act.minutos_adelantados,
                0
            );

            return {
                puede_optimizar: actividadesAdelantar.length > 0,
                actividades_a_adelantar: actividadesAdelantar,
                advertencias: advertencias,
                total_tiempo_optimizado: totalTiempoOptimizado,
                actividad_cancelada: {
                    codigo: actividadCancelada.codigo,
                    descripcion: actividadCancelada.descripcion,
                    inicio: inicioHueco,
                    fin: finHueco
                }
            };

        } catch (error) {
            console.error('Error analizando optimización:', error);
            throw error;
        }
    }

    /**
     * Ejecutar optimización: adelantar actividades
     */
    static async ejecutarOptimizacion(actividadCanceladaId) {
        try {
            // 1. Analizar primero
            const analisis = await this.analizarOptimizacion(actividadCanceladaId);

            if (!analisis.puede_optimizar) {
                return {
                    success: false,
                    message: 'No hay actividades para optimizar',
                    advertencias: analisis.advertencias
                };
            }

            console.log(`🚀 Ejecutando optimización: ${analisis.actividades_a_adelantar.length} actividades`);

            // 2. Ejecutar adelantamiento
            const actividadesModificadas = [];

            for (const actividad of analisis.actividades_a_adelantar) {
                await query(`
                    UPDATE actividades_marketing SET
                        fecha_inicio_planeada = $1,
                        fecha_fin_planeada = $2,
                        editada = true,
                        motivo_edicion = $3,
                        editada_en = NOW()
                    WHERE id = $4
                `, [
                    actividad.inicio_nuevo,
                    actividad.fin_nuevo,
                    `Adelantada ${actividad.minutos_adelantados} minutos por optimización de calendario`,
                    actividad.id
                ]);

                actividadesModificadas.push(actividad.id);
                console.log(`✅ Actividad ${actividad.id} adelantada exitosamente`);
            }

            return {
                success: true,
                message: `${actividadesModificadas.length} actividades adelantadas exitosamente`,
                actividades_modificadas: actividadesModificadas,
                total_tiempo_optimizado: analisis.total_tiempo_optimizado,
                advertencias: analisis.advertencias
            };

        } catch (error) {
            console.error('Error ejecutando optimización:', error);
            throw error;
        }
    }

    // ============================================
    // FUNCIONES AUXILIARES
    // ============================================

    /**
     * Calcular fin de actividad respetando límites de jornada
     * Retorna null si no es posible calcular (cruza límites no permitidos)
     */
    static calcularFinConLimites(inicio, duracionMinutos) {
        try {
            const fin = new Date(inicio);
            fin.setMinutes(fin.getMinutes() + duracionMinutos);

            const hora = inicio.getHours();
            const horaFin = fin.getHours();
            const minutoFin = fin.getMinutes();
            const horaFinDecimal = horaFin + (minutoFin / 60);

            const ALMUERZO_INICIO = 13;
            const ALMUERZO_FIN = 14;
            const FIN_JORNADA = 18;

            // Si el inicio cae en almuerzo, no es válido
            if (hora >= ALMUERZO_INICIO && hora < ALMUERZO_FIN) {
                return null;
            }

            // Si el fin cae después de fin de jornada, no es válido
            if (horaFinDecimal > FIN_JORNADA) {
                return null;
            }

            // Si cruza el almuerzo, no es válido
            if (hora < ALMUERZO_INICIO && horaFin >= ALMUERZO_INICIO) {
                return null;
            }

            return fin;

        } catch (error) {
            console.error('Error calculando fin con límites:', error);
            return null;
        }
    }

    /**
     * Verificar si un rango cruza el horario de almuerzo (1-2 PM)
     */
    static cruzaAlmuerzo(inicio, fin) {
        const horaInicio = inicio.getHours();
        const minutoInicio = inicio.getMinutes();
        const horaFin = fin.getHours();
        const minutoFin = fin.getMinutes();

        const inicioDecimal = horaInicio + (minutoInicio / 60);
        const finDecimal = horaFin + (minutoFin / 60);

        const ALMUERZO_INICIO = 13;
        const ALMUERZO_FIN = 14;

        // Si inicia antes del almuerzo y termina durante o después del almuerzo
        if (inicioDecimal < ALMUERZO_INICIO && finDecimal > ALMUERZO_INICIO) {
            return true;
        }

        // Si inicia durante el almuerzo
        if (inicioDecimal >= ALMUERZO_INICIO && inicioDecimal < ALMUERZO_FIN) {
            return true;
        }

        return false;
    }

    /**
     * Verificar si el fin cruza el fin de jornada (6 PM)
     */
    static cruzaFinJornada(fin) {
        const horaFin = fin.getHours();
        const minutoFin = fin.getMinutes();
        const finDecimal = horaFin + (minutoFin / 60);

        const FIN_JORNADA = 18;

        return finDecimal > FIN_JORNADA;
    }

    /**
     * Formatear tiempo para mostrar en frontend
     */
    static formatearHora(fecha) {
        const hora = fecha.getHours().toString().padStart(2, '0');
        const minuto = fecha.getMinutes().toString().padStart(2, '0');
        return `${hora}:${minuto}`;
    }
}

module.exports = OptimizacionService;
