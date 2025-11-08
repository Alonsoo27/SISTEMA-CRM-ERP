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
}

module.exports = ReportesQueries;
