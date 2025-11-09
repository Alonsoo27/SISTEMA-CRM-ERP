// ============================================
// QUERIES REUTILIZABLES PARA REPORTES
// Consultas optimizadas y corregidas
// ============================================

const { query } = require('../../../../../config/database');

class ReportesQueries {
    // ============================================
    // INFORMACIÓN DEL USUARIO
    // ============================================

    /**
     * Obtener información completa del usuario
     */
    static async obtenerInfoUsuario(usuarioId) {
        const result = await query(`
            SELECT
                u.id,
                u.nombre || ' ' || u.apellido as nombre_completo,
                u.email,
                r.nombre as rol,
                a.nombre as area,
                u.created_at as fecha_ingreso
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            LEFT JOIN areas a ON u.area_id = a.id
            WHERE u.id = $1 AND u.activo = true
        `, [usuarioId]);

        return result.rows[0] || null;
    }

    // ============================================
    // MÉTRICAS TOTALES
    // ============================================

    /**
     * Obtener totales de actividades por estado
     * EXCLUYE actividades SISTEMA para reportes de productividad
     */
    static async obtenerTotales(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado = 'completada') as completadas,
                COUNT(*) FILTER (WHERE estado = 'cancelada') as canceladas,
                COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
                COUNT(*) FILTER (WHERE estado = 'en_progreso') as en_progreso,
                COUNT(*) FILTER (WHERE es_prioritaria = true) as prioritarias,
                COUNT(*) FILTER (WHERE es_prioritaria = true AND estado = 'completada') as prioritarias_completadas,
                COUNT(*) FILTER (WHERE estado = 'no_realizada') as no_realizadas,
                COUNT(*) FILTER (WHERE transferida_de IS NOT NULL) as transferidas
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'  -- ✅ EXCLUIR actividades SISTEMA
            AND fecha_inicio_planeada BETWEEN $2 AND $3
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows[0];
    }

    // ============================================
    // ANÁLISIS DE TIEMPO
    // ============================================

    /**
     * Obtener análisis de tiempo
     * Solo actividades completadas, EXCLUYENDO SISTEMA
     */
    static async obtenerAnalisisTiempo(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                SUM(duracion_planeada_minutos) as total_planeado,
                SUM(duracion_real_minutos) as total_real,
                SUM(tiempo_adicional_minutos) as total_adicional,
                AVG(duracion_real_minutos) as promedio_real,
                COUNT(*) FILTER (WHERE tiempo_adicional_minutos > 0) as con_extension
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'  -- ✅ EXCLUIR actividades SISTEMA
            AND estado = 'completada'
            AND duracion_real_minutos IS NOT NULL
            AND fecha_inicio_planeada BETWEEN $2 AND $3
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows[0];
    }

    // ============================================
    // DISTRIBUCIÓN POR CATEGORÍAS
    // ============================================

    /**
     * Obtener distribución por categorías
     * CORRECCIÓN: Solo actividades completadas, ordenar por tiempo
     * EXCLUYE actividades SISTEMA para evitar distorsión en reportes
     */
    static async obtenerDistribucionCategorias(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                categoria_principal,
                subcategoria,
                COUNT(*) as cantidad,
                COUNT(*) FILTER (WHERE estado = 'completada') as completadas,
                -- Solo contar tiempo de actividades completadas
                SUM(CASE WHEN estado = 'completada' THEN duracion_real_minutos ELSE 0 END) as tiempo_total_minutos,
                AVG(CASE WHEN estado = 'completada' THEN duracion_real_minutos ELSE NULL END) as tiempo_promedio_minutos
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'  -- ✅ EXCLUIR actividades SISTEMA
            AND fecha_inicio_planeada BETWEEN $2 AND $3
            GROUP BY categoria_principal, subcategoria
            ORDER BY tiempo_total_minutos DESC  -- Ordenar por tiempo, no por cantidad
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows;
    }

    // ============================================
    // PROBLEMAS Y ALERTAS
    // ============================================

    /**
     * Obtener conteo de problemas
     * EXCLUYE actividades SISTEMA
     */
    static async obtenerProblemas(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                COUNT(*) FILTER (WHERE estado = 'no_realizada') as vencidas,
                COUNT(*) FILTER (WHERE transferida_de IS NOT NULL) as transferidas,
                COUNT(*) FILTER (WHERE tiempo_adicional_minutos > 0) as extensiones
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'  -- ✅ EXCLUIR actividades SISTEMA
            AND fecha_inicio_planeada BETWEEN $2 AND $3
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows[0];
    }

    // ============================================
    // ACTIVIDADES RECIENTES
    // ============================================

    /**
     * Obtener top 10 actividades más relevantes
     * EXCLUYE actividades SISTEMA
     */
    static async obtenerActividadesRecientes(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                id,
                codigo,
                descripcion,
                estado,
                es_prioritaria,
                fecha_inicio_planeada,
                fecha_fin_planeada,
                duracion_planeada_minutos,
                duracion_real_minutos,
                categoria_principal,
                subcategoria
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'  -- ✅ EXCLUIR actividades SISTEMA
            AND fecha_inicio_planeada BETWEEN $2 AND $3
            ORDER BY
                CASE WHEN estado = 'completada' THEN 1 ELSE 0 END DESC,
                es_prioritaria DESC,
                fecha_fin_planeada DESC
            LIMIT 10
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows;
    }

    /**
     * Obtener todas las actividades con detalles completos
     * Para exportación en Excel (reporte por categoría)
     * EXCLUYE actividades SISTEMA
     */
    static async obtenerActividadesDetalladas(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                id,
                codigo,
                descripcion as titulo,
                categoria_principal,
                subcategoria,
                estado,
                es_prioritaria,
                fecha_inicio_planeada,
                fecha_fin_planeada,
                fecha_inicio_real,
                fecha_fin_real,
                duracion_planeada_minutos,
                duracion_real_minutos
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'  -- ✅ EXCLUIR actividades SISTEMA
            AND fecha_inicio_planeada BETWEEN $2 AND $3
            ORDER BY fecha_inicio_planeada DESC
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows;
    }

    // ============================================
    // MÉTODOS CONSOLIDADOS
    // ============================================

    /**
     * Obtener todos los datos necesarios para reporte de productividad personal
     * Método optimizado que ejecuta todas las queries necesarias
     */
    static async obtenerDatosProductividadPersonal(usuarioId, fechaInicio, fechaFin) {
        // Ejecutar queries en paralelo para optimizar
        const [
            usuario,
            totales,
            tiempos,
            categorias,
            problemas,
            actividades
        ] = await Promise.all([
            this.obtenerInfoUsuario(usuarioId),
            this.obtenerTotales(usuarioId, fechaInicio, fechaFin),
            this.obtenerAnalisisTiempo(usuarioId, fechaInicio, fechaFin),
            this.obtenerDistribucionCategorias(usuarioId, fechaInicio, fechaFin),
            this.obtenerProblemas(usuarioId, fechaInicio, fechaFin),
            this.obtenerActividadesRecientes(usuarioId, fechaInicio, fechaFin)
        ]);

        if (!usuario) {
            throw new Error('Usuario no encontrado');
        }

        // Calcular métricas derivadas
        const tasaCompletitud = totales.total > 0
            ? ((parseInt(totales.completadas) / parseInt(totales.total)) * 100).toFixed(1)
            : 0;

        const tasaPrioritarias = parseInt(totales.prioritarias) > 0
            ? ((parseInt(totales.prioritarias_completadas) / parseInt(totales.prioritarias)) * 100).toFixed(1)
            : 0;

        const eficiencia = tiempos.total_planeado > 0
            ? ((parseFloat(tiempos.total_real) / parseFloat(tiempos.total_planeado)) * 100).toFixed(1)
            : 0;

        const tasaVencimiento = totales.total > 0
            ? ((parseInt(problemas.vencidas) / parseInt(totales.total)) * 100).toFixed(1)
            : 0;

        // Retornar datos consolidados
        return {
            usuario,
            metricas: {
                totales: {
                    total: parseInt(totales.total),
                    completadas: parseInt(totales.completadas),
                    canceladas: parseInt(totales.canceladas),
                    pendientes: parseInt(totales.pendientes),
                    en_progreso: parseInt(totales.en_progreso),
                    prioritarias: parseInt(totales.prioritarias),
                    prioritarias_completadas: parseInt(totales.prioritarias_completadas)
                },
                tasas: {
                    completitud: parseFloat(tasaCompletitud),
                    prioritarias: parseFloat(tasaPrioritarias),
                    eficiencia: parseFloat(eficiencia),
                    vencimiento: parseFloat(tasaVencimiento)
                },
                tiempos: {
                    total_planeado_minutos: parseInt(tiempos.total_planeado || 0),
                    total_real_minutos: parseInt(tiempos.total_real || 0),
                    promedio_real_minutos: parseFloat(tiempos.promedio_real || 0).toFixed(1),
                    total_adicional_minutos: parseInt(tiempos.total_adicional || 0),
                    con_extension: parseInt(tiempos.con_extension || 0)
                },
                problemas: {
                    vencidas: parseInt(problemas.vencidas),
                    transferidas: parseInt(problemas.transferidas),
                    extensiones: parseInt(problemas.extensiones)
                }
            },
            categorias: categorias.map(cat => ({
                categoria_principal: cat.categoria_principal,
                subcategoria: cat.subcategoria,
                cantidad: parseInt(cat.cantidad),
                completadas: parseInt(cat.completadas),
                tiempo_total_minutos: parseInt(cat.tiempo_total_minutos || 0),
                tiempo_promedio_minutos: parseFloat(cat.tiempo_promedio_minutos || 0).toFixed(1)
            })),
            actividades_recientes: actividades
        };
    }

    // ============================================
    // QUERIES AVANZADAS - COMPARATIVAS Y ANÁLISIS
    // ============================================

    /**
     * Obtener datos del período anterior para comparativas
     * Maneja períodos vacíos (sin datos) retornando null
     */
    static async obtenerDatosPeriodoAnterior(usuarioId, fechaInicio, fechaFin) {
        // Calcular duración del período
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const duracionDias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

        // Calcular fechas del período anterior
        const fechaInicioAnterior = new Date(inicio);
        fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - duracionDias);
        const fechaFinAnterior = new Date(inicio);

        // Obtener totales básicos del período anterior
        const result = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado = 'completada') as completadas,
                SUM(CASE WHEN estado = 'completada' THEN duracion_real_minutos ELSE 0 END) as tiempo_real
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'
            AND fecha_inicio_planeada BETWEEN $2 AND $3
        `, [usuarioId, fechaInicioAnterior, fechaFinAnterior]);

        const datos = result.rows[0];

        // Si no hay datos del período anterior, retornar null
        if (parseInt(datos.total) === 0) {
            return null;
        }

        const tasaCompletitud = datos.total > 0
            ? ((parseInt(datos.completadas) / parseInt(datos.total)) * 100).toFixed(1)
            : 0;

        return {
            total: parseInt(datos.total),
            completadas: parseInt(datos.completadas),
            tasa_completitud: parseFloat(tasaCompletitud),
            tiempo_real_minutos: parseInt(datos.tiempo_real || 0)
        };
    }

    /**
     * Obtener ranking del usuario vs equipo (mismo rol/área)
     */
    static async obtenerRankingEquipo(usuarioId, fechaInicio, fechaFin) {
        // Obtener área del usuario
        const usuarioInfo = await query(`
            SELECT area_id, rol_id FROM usuarios WHERE id = $1
        `, [usuarioId]);

        if (usuarioInfo.rows.length === 0) return null;

        const { area_id, rol_id } = usuarioInfo.rows[0];

        // Obtener ranking de productividad del equipo
        const ranking = await query(`
            WITH metricas_equipo AS (
                SELECT
                    u.id,
                    u.nombre || ' ' || u.apellido as nombre_completo,
                    COUNT(a.id) as total_actividades,
                    COUNT(a.id) FILTER (WHERE a.estado = 'completada') as completadas,
                    CASE
                        WHEN COUNT(a.id) > 0
                        THEN (COUNT(a.id) FILTER (WHERE a.estado = 'completada')::float / COUNT(a.id)::float * 100)
                        ELSE 0
                    END as tasa_completitud,
                    SUM(CASE WHEN a.estado = 'completada' THEN a.duracion_real_minutos ELSE 0 END) as tiempo_productivo
                FROM usuarios u
                LEFT JOIN actividades_marketing a ON a.usuario_id = u.id
                    AND a.activo = true
                    AND a.tipo != 'sistema'
                    AND a.fecha_inicio_planeada BETWEEN $1 AND $2
                WHERE u.activo = true
                AND u.area_id = $3
                AND u.rol_id = $4
                GROUP BY u.id, u.nombre, u.apellido
            ),
            ranking_calculado AS (
                SELECT
                    *,
                    RANK() OVER (ORDER BY tasa_completitud DESC, tiempo_productivo DESC) as posicion
                FROM metricas_equipo
            )
            SELECT
                (SELECT COUNT(*) FROM metricas_equipo) as total_equipo,
                posicion,
                total_actividades,
                completadas,
                ROUND(tasa_completitud::numeric, 1) as tasa_completitud
            FROM ranking_calculado
            WHERE id = $5
        `, [fechaInicio, fechaFin, area_id, rol_id, usuarioId]);

        if (ranking.rows.length === 0) return null;

        return ranking.rows[0];
    }

    /**
     * Obtener productividad por día de la semana
     */
    static async obtenerProductividadPorDia(usuarioId, fechaInicio, fechaFin) {
        const result = await query(`
            SELECT
                EXTRACT(DOW FROM fecha_inicio_planeada) as dia_semana,
                CASE EXTRACT(DOW FROM fecha_inicio_planeada)
                    WHEN 0 THEN 'Domingo'
                    WHEN 1 THEN 'Lunes'
                    WHEN 2 THEN 'Martes'
                    WHEN 3 THEN 'Miércoles'
                    WHEN 4 THEN 'Jueves'
                    WHEN 5 THEN 'Viernes'
                    WHEN 6 THEN 'Sábado'
                END as nombre_dia,
                COUNT(*) as total_actividades,
                COUNT(*) FILTER (WHERE estado = 'completada') as completadas,
                SUM(CASE WHEN estado = 'completada' THEN duracion_real_minutos ELSE 0 END) as tiempo_productivo
            FROM actividades_marketing
            WHERE usuario_id = $1
            AND activo = true
            AND tipo != 'sistema'
            AND fecha_inicio_planeada BETWEEN $2 AND $3
            GROUP BY EXTRACT(DOW FROM fecha_inicio_planeada)
            ORDER BY dia_semana
        `, [usuarioId, fechaInicio, fechaFin]);

        return result.rows.map(row => ({
            dia_semana: parseInt(row.dia_semana),
            nombre_dia: row.nombre_dia,
            total_actividades: parseInt(row.total_actividades),
            completadas: parseInt(row.completadas),
            tiempo_productivo_minutos: parseInt(row.tiempo_productivo || 0),
            tasa_completitud: row.total_actividades > 0
                ? ((parseInt(row.completadas) / parseInt(row.total_actividades)) * 100).toFixed(1)
                : 0
        }));
    }

    /**
     * Obtener conclusiones automáticas basadas en métricas
     */
    static generarConclusiones(metricas, comparativa, ranking) {
        const conclusiones = [];
        const recomendaciones = [];

        // Análisis de completitud
        if (metricas.tasas.completitud >= 90) {
            conclusiones.push('Excelente tasa de completitud, superando el 90% de las actividades planificadas.');
        } else if (metricas.tasas.completitud >= 70) {
            conclusiones.push('Buena tasa de completitud, aunque hay margen de mejora.');
            recomendaciones.push('Revisar causas de actividades no completadas para optimizar planificación.');
        } else {
            conclusiones.push('La tasa de completitud está por debajo del 70%, requiere atención.');
            recomendaciones.push('Analizar carga de trabajo y redistribuir actividades si es necesario.');
        }

        // Análisis de eficiencia
        if (metricas.tasas.eficiencia <= 100) {
            conclusiones.push('El tiempo ejecutado está dentro o por debajo de lo planeado (eficiencia óptima).');
        } else if (metricas.tasas.eficiencia <= 120) {
            conclusiones.push('Ligero exceso en tiempo de ejecución respecto a lo planeado.');
            recomendaciones.push('Revisar estimaciones de tiempo para actividades similares.');
        } else {
            conclusiones.push('Tiempo de ejecución significativamente mayor a lo planeado.');
            recomendaciones.push('Considerar factores que retrasan la ejecución y ajustar planificación.');
        }

        // Análisis de problemas
        if (metricas.problemas.vencidas > 0) {
            conclusiones.push(`Se detectaron ${metricas.problemas.vencidas} actividades vencidas.`);
            recomendaciones.push('Establecer alertas tempranas para actividades próximas a vencer.');
        }

        // Comparativa vs período anterior
        if (comparativa) {
            const mejora = metricas.tasas.completitud - comparativa.tasa_completitud;
            if (mejora > 5) {
                conclusiones.push(`Mejora significativa (+${mejora.toFixed(1)}%) vs período anterior.`);
            } else if (mejora < -5) {
                conclusiones.push(`Disminución en rendimiento (-${Math.abs(mejora).toFixed(1)}%) vs período anterior.`);
                recomendaciones.push('Identificar causas de la disminución en productividad.');
            }
        }

        // Ranking
        if (ranking && ranking.total_equipo > 1) {
            if (ranking.posicion === 1) {
                conclusiones.push(`Top 1 del equipo (${ranking.total_equipo} personas). ¡Excelente desempeño!`);
            } else if (ranking.posicion <= 3) {
                conclusiones.push(`Top ${ranking.posicion} de ${ranking.total_equipo} en el equipo.`);
            } else {
                conclusiones.push(`Posición ${ranking.posicion} de ${ranking.total_equipo} en el equipo.`);
                recomendaciones.push('Revisar mejores prácticas de compañeros con mejor rendimiento.');
            }
        }

        return { conclusiones, recomendaciones };
    }

    /**
     * Método consolidado con análisis avanzado
     */
    static async obtenerDatosCompletos(usuarioId, fechaInicio, fechaFin) {
        // Datos básicos
        const datosBasicos = await this.obtenerDatosProductividadPersonal(usuarioId, fechaInicio, fechaFin);

        // Datos avanzados en paralelo
        const [comparativa, ranking, productividadDiaria] = await Promise.all([
            this.obtenerDatosPeriodoAnterior(usuarioId, fechaInicio, fechaFin),
            this.obtenerRankingEquipo(usuarioId, fechaInicio, fechaFin),
            this.obtenerProductividadPorDia(usuarioId, fechaInicio, fechaFin)
        ]);

        // Generar conclusiones
        const { conclusiones, recomendaciones } = this.generarConclusiones(
            datosBasicos.metricas,
            comparativa,
            ranking
        );

        return {
            ...datosBasicos,
            analisis_avanzado: {
                comparativa_periodo_anterior: comparativa,
                ranking_equipo: ranking,
                productividad_por_dia: productividadDiaria,
                conclusiones,
                recomendaciones
            }
        };
    }

    /**
     * Obtener datos completos para reporte por categoría
     * Incluye todas las actividades detalladas para exportación
     */
    static async obtenerDatosPorCategoria(usuarioId, fechaInicio, fechaFin) {
        // Ejecutar queries en paralelo
        const [
            usuario,
            totales,
            categorias,
            actividades
        ] = await Promise.all([
            this.obtenerInfoUsuario(usuarioId),
            this.obtenerTotales(usuarioId, fechaInicio, fechaFin),
            this.obtenerDistribucionCategorias(usuarioId, fechaInicio, fechaFin),
            this.obtenerActividadesDetalladas(usuarioId, fechaInicio, fechaFin)
        ]);

        if (!usuario) {
            throw new Error('Usuario no encontrado');
        }

        // Calcular tasas
        const tasaCompletitud = totales.total > 0
            ? ((parseInt(totales.completadas) / parseInt(totales.total)) * 100).toFixed(1)
            : 0;

        // Retornar datos consolidados
        return {
            usuario,
            metricas: {
                totales: {
                    total: parseInt(totales.total),
                    completadas: parseInt(totales.completadas),
                    canceladas: parseInt(totales.canceladas),
                    pendientes: parseInt(totales.pendientes),
                    en_progreso: parseInt(totales.en_progreso)
                },
                tasas: {
                    completitud: parseFloat(tasaCompletitud)
                }
            },
            categorias: categorias.map(cat => ({
                categoria_principal: cat.categoria_principal,
                subcategoria: cat.subcategoria,
                cantidad: parseInt(cat.cantidad),
                completadas: parseInt(cat.completadas),
                tiempo_total_minutos: parseInt(cat.tiempo_total_minutos || 0),
                tiempo_promedio_minutos: parseFloat(cat.tiempo_promedio_minutos || 0).toFixed(1)
            })),
            actividades: actividades
        };
    }

    /**
     * Obtener datos consolidados del equipo de marketing
     * Incluye métricas por miembro y totales generales
     */
    static async obtenerDatosEquipo(fechaInicio, fechaFin) {
        // Obtener todos los usuarios de marketing
        const usuariosResult = await query(`
            SELECT u.id, u.nombre, u.apellido, u.email, r.nombre as rol
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            WHERE r.nombre IN ('MARKETING_EJECUTOR', 'JEFE_MARKETING')
            AND u.activo = true
            ORDER BY u.nombre, u.apellido
        `);

        const usuarios = usuariosResult.rows;

        // Obtener métricas por cada miembro
        const miembros = await Promise.all(usuarios.map(async (usuario) => {
            const totales = await this.obtenerTotales(usuario.id, fechaInicio, fechaFin);
            const categorias = await this.obtenerDistribucionCategorias(usuario.id, fechaInicio, fechaFin);

            const tiempoTotal = categorias.reduce((sum, cat) =>
                sum + parseInt(cat.tiempo_total_minutos || 0), 0
            );

            const tasaCompletitud = parseInt(totales.total) > 0
                ? ((parseInt(totales.completadas) / parseInt(totales.total)) * 100).toFixed(1)
                : 0;

            return {
                id: usuario.id,
                nombre_completo: `${usuario.nombre} ${usuario.apellido}`,
                email: usuario.email,
                rol: usuario.rol,
                totales: {
                    total: parseInt(totales.total),
                    completadas: parseInt(totales.completadas),
                    pendientes: parseInt(totales.pendientes),
                    en_progreso: parseInt(totales.en_progreso),
                    canceladas: parseInt(totales.canceladas)
                },
                tiempo_total_minutos: tiempoTotal,
                tasa_completitud: parseFloat(tasaCompletitud),
                categorias_trabajadas: categorias.length
            };
        }));

        // Calcular totales del equipo
        const totalesEquipo = miembros.reduce((acc, miembro) => ({
            total: acc.total + miembro.totales.total,
            completadas: acc.completadas + miembro.totales.completadas,
            pendientes: acc.pendientes + miembro.totales.pendientes,
            en_progreso: acc.en_progreso + miembro.totales.en_progreso,
            canceladas: acc.canceladas + miembro.totales.canceladas,
            tiempo_total_minutos: acc.tiempo_total_minutos + miembro.tiempo_total_minutos
        }), { total: 0, completadas: 0, pendientes: 0, en_progreso: 0, canceladas: 0, tiempo_total_minutos: 0 });

        const tasaCompletitudEquipo = totalesEquipo.total > 0
            ? ((totalesEquipo.completadas / totalesEquipo.total) * 100).toFixed(1)
            : 0;

        // Ordenar miembros por completitud (top performers)
        const ranking = [...miembros].sort((a, b) => b.tasa_completitud - a.tasa_completitud);

        return {
            totales: totalesEquipo,
            tasas: {
                completitud: parseFloat(tasaCompletitudEquipo)
            },
            miembros: miembros,
            ranking: ranking,
            estadisticas: {
                total_miembros: miembros.length,
                promedio_actividades: Math.round(totalesEquipo.total / miembros.length),
                promedio_completitud: (miembros.reduce((sum, m) => sum + m.tasa_completitud, 0) / miembros.length).toFixed(1)
            }
        };
    }
}

module.exports = ReportesQueries;
