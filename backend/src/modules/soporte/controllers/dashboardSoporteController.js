// =====================================
// CONTROLADOR DE DASHBOARD Y MÉTRICAS DE SOPORTE - VERSIÓN CORREGIDA POSTGRESQL
// =====================================
// Maneja todas las métricas, KPIs y datos del dashboard principal
// CORREGIDO: Usa PostgreSQL directo con función query() en lugar de Supabase SDK

const { query } = require('../../../config/database');
const SoporteModel = require('../models/SoporteModel');
const { calcularTiempoTranscurrido } = require('../utils/soporteHelpers');

class DashboardSoporteController {
    // ====================================
    // DASHBOARD PRINCIPAL
    // ====================================

    /**
     * Obtener resumen completo del dashboard
     * GET /api/soporte/dashboard
     */
    static async obtenerDashboardCompleto(req, res) {
        try {
            // CORREGIDO: Ejecutar múltiples consultas en paralelo para mejor rendimiento
            // Ahora usando PostgreSQL directo en lugar de Supabase
            const [
                metricasGenerales,
                productosResumen,
                capacitacionesResumen,
                alertasActivas,
                rendimientoTecnicos
            ] = await Promise.all([
                DashboardSoporteController._obtenerMetricasGenerales(),
                DashboardSoporteController._obtenerResumenProductos(),
                DashboardSoporteController._obtenerResumenCapacitaciones(),
                DashboardSoporteController._obtenerAlertasActivas(),
                DashboardSoporteController._obtenerRendimientoTecnicos()
            ]);

            res.json({
                success: true,
                data: {
                    metricas_generales: metricasGenerales,
                    productos: productosResumen,
                    capacitaciones: capacitacionesResumen,
                    alertas: alertasActivas,
                    rendimiento_tecnicos: rendimientoTecnicos,
                    ultima_actualizacion: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error en obtenerDashboardCompleto:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ====================================
    // MÉTRICAS ESPECÍFICAS
    // ====================================

    /**
     * Obtener KPIs principales
     * GET /api/soporte/dashboard/kpis
     */
    static async obtenerKPIsPrincipales(req, res) {
        try {
            const { periodo } = req.query; // 'dia', 'semana', 'mes', 'trimestre'

            // Calcular fechas según el período
            const fechas = DashboardSoporteController._calcularRangoFechas(periodo || 'mes');

            // CORREGIDO: KPIs de tickets usando PostgreSQL directo
            const sqlTickets = `
                SELECT * FROM tickets_soporte 
                WHERE created_at >= $1 AND created_at <= $2 AND activo = true
            `;
            const resultTickets = await query(sqlTickets, [fechas.inicio, fechas.fin]);
            const tickets = resultTickets.rows;

            // CORREGIDO: KPIs de productos usando PostgreSQL directo
            let productos = [];
            try {
                // Intentar usar la vista primero
                const sqlProductosVista = `
                    SELECT * FROM vista_productos_con_pausas 
                    WHERE fecha_recepcion >= $1 AND fecha_recepcion <= $2
                `;
                const resultProductosVista = await query(sqlProductosVista, [
                    fechas.inicio.split('T')[0], 
                    fechas.fin.split('T')[0]
                ]);
                productos = resultProductosVista.rows;
            } catch (vistaError) {
                // Si la vista no existe, usar consulta directa
                console.log('Vista vista_productos_con_pausas no disponible, usando consulta directa');
                const sqlProductosDirecta = `
                    SELECT pr.*, 
                           CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as esta_pausado
                    FROM productos_reparacion pr
                    LEFT JOIN soporte_pausas_reparacion sp ON pr.id = sp.producto_id AND sp.activo = true
                    WHERE pr.fecha_recepcion >= $1 AND pr.fecha_recepcion <= $2 AND pr.activo = true
                `;
                const resultProductosDirecta = await query(sqlProductosDirecta, [
                    fechas.inicio.split('T')[0], 
                    fechas.fin.split('T')[0]
                ]);
                productos = resultProductosDirecta.rows;
            }

            // CORREGIDO: KPIs de capacitaciones usando PostgreSQL directo
            const sqlCapacitaciones = `
                SELECT * FROM soporte_capacitaciones 
                WHERE created_at >= $1 AND created_at <= $2 AND activo = true
            `;
            const resultCapacitaciones = await query(sqlCapacitaciones, [fechas.inicio, fechas.fin]);
            const capacitaciones = resultCapacitaciones.rows;

            // Calcular KPIs
            const kpis = {
                tickets: {
                    total: tickets.length,
                    completados: tickets.filter(t => t.estado === 'COMPLETADO').length,
                    pendientes: tickets.filter(t => t.estado === 'PENDIENTE').length,
                    en_proceso: tickets.filter(t => t.estado === 'EN_PROCESO').length,
                    tiempo_promedio_resolucion: DashboardSoporteController._calcularTiempoPromedioTickets(tickets),
                    sla_cumplido: DashboardSoporteController._calcularSLACumplido(tickets)
                },
                
                productos: {
                    total: productos.length,
                    reparados: productos.filter(p => p.categoria === 'REPARADO').length,
                    por_reparar: productos.filter(p => p.categoria === 'POR_REPARAR').length,
                    irreparables: productos.filter(p => p.categoria === 'IRREPARABLE').length,
                    pausados: productos.filter(p => p.esta_pausado).length,
                    eficiencia_promedio: DashboardSoporteController._calcularEficienciaPromedio(productos),
                    tiempo_promedio_reparacion: DashboardSoporteController._calcularTiempoPromedioReparacion(productos)
                },
                
                capacitaciones: {
                    total: capacitaciones.length,
                    completadas: capacitaciones.filter(c => c.estado === 'COMPLETADA').length,
                    pendientes: capacitaciones.filter(c => c.estado === 'PENDIENTE').length,
                    calificacion_promedio: DashboardSoporteController._calcularCalificacionPromedio(capacitaciones),
                    tiempo_respuesta_promedio: DashboardSoporteController._calcularTiempoRespuestaPromedio(capacitaciones)
                },
                
                tendencias: {
                    tickets_vs_periodo_anterior: 0, // Calcular comparativa
                    eficiencia_vs_periodo_anterior: 0,
                    satisfaccion_vs_periodo_anterior: 0
                }
            };

            res.json({
                success: true,
                data: {
                    kpis,
                    periodo: periodo || 'mes',
                    rango_fechas: fechas
                }
            });

        } catch (error) {
            console.error('Error en obtenerKPIsPrincipales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener gráficos para dashboard
     * GET /api/soporte/dashboard/graficos
     */
    static async obtenerGraficosDashboard(req, res) {
        try {
            const { tipo, periodo } = req.query;

            const fechas = DashboardSoporteController._calcularRangoFechas(periodo || 'mes');

            let graficos = {};

            switch (tipo) {
                case 'tickets_por_dia':
                    graficos = await DashboardSoporteController._obtenerGraficoTicketsPorDia(fechas);
                    break;

                case 'productos_por_categoria':
                    graficos = await DashboardSoporteController._obtenerGraficoProductosPorCategoria();
                    break;

                case 'eficiencia_tecnicos':
                    graficos = await DashboardSoporteController._obtenerGraficoEficienciaTecnicos();
                    break;

                case 'pausas_por_tipo':
                    graficos = await DashboardSoporteController._obtenerGraficoPausasPorTipo(fechas);
                    break;

                case 'capacitaciones_completadas':
                    graficos = await DashboardSoporteController._obtenerGraficoCapacitacionesCompletadas(fechas);
                    break;

                default:
                    // Devolver todos los gráficos
                    const [ticketsPorDia, productosPorCategoria, eficienciaTecnicos, pausasPorTipo, capacitaciones] = 
                        await Promise.all([
                            DashboardSoporteController._obtenerGraficoTicketsPorDia(fechas),
                            DashboardSoporteController._obtenerGraficoProductosPorCategoria(),
                            DashboardSoporteController._obtenerGraficoEficienciaTecnicos(),
                            DashboardSoporteController._obtenerGraficoPausasPorTipo(fechas),
                            DashboardSoporteController._obtenerGraficoCapacitacionesCompletadas(fechas)
                        ]);

                    graficos = {
                        tickets_por_dia: ticketsPorDia,
                        productos_por_categoria: productosPorCategoria,
                        eficiencia_tecnicos: eficienciaTecnicos,
                        pausas_por_tipo: pausasPorTipo,
                        capacitaciones_completadas: capacitaciones
                    };
            }

            res.json({
                success: true,
                data: graficos
            });

        } catch (error) {
            console.error('Error en obtenerGraficosDashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener alertas críticas
     * GET /api/soporte/dashboard/alertas-criticas
     */
    static async obtenerAlertasCriticas(req, res) {
        try {
            // CORREGIDO: Alertas de SLA vencido usando PostgreSQL directo
            const sqlSLAVencido = `
                SELECT ts.id, ts.codigo, ts.titulo, ts.prioridad, ts.created_at,
                       u.id as tecnico_id, u.nombre as tecnico_nombre, u.apellido as tecnico_apellido
                FROM tickets_soporte ts
                LEFT JOIN usuarios u ON ts.tecnico_asignado_id = u.id
                WHERE ts.estado IN ('PENDIENTE', 'ASIGNADO', 'EN_PROCESO') 
                  AND ts.activo = true
            `;
            const resultSLAVencido = await query(sqlSLAVencido, []);

            // Filtrar tickets con SLA vencido y estructurar como esperaba Supabase
            const ticketsSLAVencido = resultSLAVencido.rows
                .map(ticket => ({
                    id: ticket.id,
                    codigo: ticket.codigo,
                    titulo: ticket.titulo,
                    prioridad: ticket.prioridad,
                    created_at: ticket.created_at,
                    tecnico_asignado: ticket.tecnico_id ? {
                        nombre: ticket.tecnico_nombre,
                        apellido: ticket.tecnico_apellido
                    } : null
                }))
                .filter(ticket => {
                    const limitesSLA = { 'URGENTE': 2, 'ALTA': 8, 'MEDIA': 24, 'BAJA': 48 };
                    const limiteHoras = limitesSLA[ticket.prioridad] || 24;
                    const horasTranscurridas = (new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60);
                    return horasTranscurridas > limiteHoras;
                });

            // CORREGIDO: Alertas de productos pausados largamente usando PostgreSQL directo
            let productosPausados = [];
            try {
                // Intentar usar la vista primero
                const sqlAlertas = `SELECT * FROM vista_alertas_soporte`;
                const resultAlertas = await query(sqlAlertas, []);
                productosPausados = resultAlertas.rows;
            } catch (vistaError) {
                // Si la vista no existe, usar consulta directa para productos pausados más de 7 días
                console.log('Vista vista_alertas_soporte no disponible, usando consulta directa');
                const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const sqlProductosPausados = `
                    SELECT pr.*, sp.tipo_pausa, sp.fecha_inicio as fecha_pausa
                    FROM productos_reparacion pr
                    INNER JOIN soporte_pausas_reparacion sp ON pr.id = sp.producto_id
                    WHERE sp.fecha_inicio < $1 AND sp.activo = true AND pr.activo = true
                `;
                const resultProductosPausados = await query(sqlProductosPausados, [hace7dias]);
                productosPausados = resultProductosPausados.rows;
            }

            // CORREGIDO: Alertas de capacitaciones vencidas usando PostgreSQL directo
            const hoy = new Date().toISOString().split('T')[0];
            const sqlCapacitacionesVencidas = `
                SELECT * FROM soporte_capacitaciones 
                WHERE fecha_capacitacion_programada < $1 
                  AND estado IN ('PENDIENTE', 'PROGRAMADA') 
                  AND activo = true
            `;
            const resultCapacitacionesVencidas = await query(sqlCapacitacionesVencidas, [hoy]);
            const capacitacionesVencidas = resultCapacitacionesVencidas.rows;

            // CORREGIDO: Alertas de productos sin técnico asignado (más de 24h) usando PostgreSQL directo
            const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const sqlSinTecnico = `
                SELECT * FROM tickets_soporte 
                WHERE tecnico_asignado_id IS NULL 
                  AND estado = 'PENDIENTE' 
                  AND created_at < $1 
                  AND activo = true
            `;
            const resultSinTecnico = await query(sqlSinTecnico, [hace24h]);
            const sinTecnico = resultSinTecnico.rows;

            const alertasCriticas = {
                sla_vencido: {
                    count: ticketsSLAVencido.length,
                    tickets: ticketsSLAVencido.slice(0, 5), // Primeros 5
                    severidad: 'CRITICA'
                },
                productos_pausados_largamente: {
                    count: productosPausados.length,
                    productos: productosPausados.slice(0, 5),
                    severidad: 'ALTA'
                },
                capacitaciones_vencidas: {
                    count: capacitacionesVencidas.length,
                    capacitaciones: capacitacionesVencidas.slice(0, 5),
                    severidad: 'MEDIA'
                },
                tickets_sin_tecnico: {
                    count: sinTecnico.length,
                    tickets: sinTecnico.slice(0, 5),
                    severidad: 'MEDIA'
                },
                resumen: {
                    total_alertas: ticketsSLAVencido.length + productosPausados.length + 
                                  capacitacionesVencidas.length + sinTecnico.length,
                    criticas: ticketsSLAVencido.length,
                    altas: productosPausados.length,
                    medias: capacitacionesVencidas.length + sinTecnico.length
                }
            };

            res.json({
                success: true,
                data: alertasCriticas
            });

        } catch (error) {
            console.error('Error en obtenerAlertasCriticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // ====================================
    // MÉTODOS PRIVADOS AUXILIARES
    // ====================================

    static async _obtenerMetricasGenerales() {
        const resultado = await SoporteModel.obtenerMetricasGenerales();
        return resultado.success ? resultado.data : {};
    }

    static async _obtenerResumenProductos() {
        const resultado = await SoporteModel.obtenerProductosPorCategoria();
        if (!resultado.success) return {};

        const estadisticas = {
            por_categoria: {},
            total: 0,
            pausados: 0,
            requieren_atencion: 0
        };

        for (const [categoria, productos] of Object.entries(resultado.data)) {
            estadisticas.por_categoria[categoria] = productos.length;
            estadisticas.total += productos.length;
            estadisticas.pausados += productos.filter(p => p.esta_pausado).length;
        }

        return estadisticas;
    }

    static async _obtenerResumenCapacitaciones() {
        const resultado = await SoporteModel.obtenerCapacitaciones();
        if (!resultado.success) return {};

        const capacitaciones = resultado.data;
        return {
            total: capacitaciones.length,
            pendientes: capacitaciones.filter(c => c.estado === 'PENDIENTE').length,
            completadas: capacitaciones.filter(c => c.estado === 'COMPLETADA').length,
            hoy: capacitaciones.filter(c => 
                c.fecha_capacitacion_programada === new Date().toISOString().split('T')[0]
            ).length
        };
    }

    static async _obtenerAlertasActivas() {
        const resultado = await SoporteModel.obtenerAlertas();
        return resultado.success ? { 
            total: resultado.data.length,
            alertas: resultado.data.slice(0, 10)
        } : { total: 0, alertas: [] };
    }

    static async _obtenerRendimientoTecnicos() {
        const resultado = await SoporteModel.obtenerRendimientoTecnicos();
        return resultado.success ? resultado.data : [];
    }

    static _calcularRangoFechas(periodo) {
        const ahora = new Date();
        let inicio, fin = ahora.toISOString();

        switch (periodo) {
            case 'dia':
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString();
                break;
            case 'semana':
                const inicioSemana = new Date(ahora);
                inicioSemana.setDate(ahora.getDate() - ahora.getDay());
                inicio = inicioSemana.toISOString();
                break;
            case 'mes':
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
                break;
            case 'trimestre':
                const trimestreInicio = Math.floor(ahora.getMonth() / 3) * 3;
                inicio = new Date(ahora.getFullYear(), trimestreInicio, 1).toISOString();
                break;
            default:
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
        }

        return { inicio, fin };
    }

    // MEJORA: Funciones de cálculo más robustas con validación de datos
    static _calcularTiempoPromedioTickets(tickets) {
        const completados = tickets.filter(t => 
            t.estado === 'COMPLETADO' && 
            t.tiempo_real_horas && 
            t.tiempo_real_horas > 0
        );
        if (completados.length === 0) return 0;
        
        const total = completados.reduce((sum, t) => sum + t.tiempo_real_horas, 0);
        return Math.round(total / completados.length);
    }

    static _calcularSLACumplido(tickets) {
        const limitesSLA = { 'URGENTE': 2, 'ALTA': 8, 'MEDIA': 24, 'BAJA': 48 };
        const completados = tickets.filter(t => t.estado === 'COMPLETADO');
        
        if (completados.length === 0) return 100;

        const cumplidos = completados.filter(ticket => {
            const limiteHoras = limitesSLA[ticket.prioridad] || 24;
            const horasReales = ticket.tiempo_real_horas || 0;
            return horasReales <= limiteHoras;
        });

        return Math.round((cumplidos.length / completados.length) * 100);
    }

    static _calcularEficienciaPromedio(productos) {
        const conEficiencia = productos.filter(p => 
            p.eficiencia_porcentaje && 
            p.eficiencia_porcentaje > 0
        );
        if (conEficiencia.length === 0) return 0;
        
        const total = conEficiencia.reduce((sum, p) => sum + p.eficiencia_porcentaje, 0);
        return Math.round(total / conEficiencia.length);
    }

    static _calcularTiempoPromedioReparacion(productos) {
        const reparados = productos.filter(p => 
            p.tiempo_efectivo_horas && 
            p.tiempo_efectivo_horas > 0
        );
        if (reparados.length === 0) return 0;
        
        const total = reparados.reduce((sum, p) => sum + p.tiempo_efectivo_horas, 0);
        return Math.round(total / reparados.length);
    }

    static _calcularCalificacionPromedio(capacitaciones) {
        const conCalificacion = capacitaciones.filter(c => 
            c.calificacion_cliente && 
            c.calificacion_cliente > 0
        );
        if (conCalificacion.length === 0) return 0;
        
        const total = conCalificacion.reduce((sum, c) => sum + c.calificacion_cliente, 0);
        return (total / conCalificacion.length).toFixed(1);
    }

    static _calcularTiempoRespuestaPromedio(capacitaciones) {
        const conTiempo = capacitaciones.filter(c => 
            c.tiempo_respuesta_capacitacion_horas && 
            c.tiempo_respuesta_capacitacion_horas > 0
        );
        if (conTiempo.length === 0) return 0;
        
        const total = conTiempo.reduce((sum, c) => sum + c.tiempo_respuesta_capacitacion_horas, 0);
        return Math.round(total / conTiempo.length);
    }

    // ====================================
    // MÉTODOS PARA GRÁFICOS ESPECÍFICOS
    // ====================================

    // CORREGIDO: Métodos para gráficos usando PostgreSQL directo
    static async _obtenerGraficoTicketsPorDia(fechas) {
        const sql = `
            SELECT created_at, estado 
            FROM tickets_soporte 
            WHERE created_at >= $1 AND created_at <= $2 AND activo = true
        `;
        const result = await query(sql, [fechas.inicio, fechas.fin]);
        const data = result.rows;

        // Agrupar por día
        const ticketsPorDia = {};
        data.forEach(ticket => {
            const fecha = ticket.created_at.toISOString().split('T')[0];
            if (!ticketsPorDia[fecha]) {
                ticketsPorDia[fecha] = { total: 0, completados: 0 };
            }
            ticketsPorDia[fecha].total++;
            if (ticket.estado === 'COMPLETADO') {
                ticketsPorDia[fecha].completados++;
            }
        });

        return Object.entries(ticketsPorDia).map(([fecha, datos]) => ({
            fecha,
            ...datos
        }));
    }

    static async _obtenerGraficoProductosPorCategoria() {
        const resultado = await SoporteModel.obtenerProductosPorCategoria();
        if (!resultado.success) return [];

        return Object.entries(resultado.data).map(([categoria, productos]) => ({
            categoria,
            cantidad: productos.length,
            pausados: productos.filter(p => p.esta_pausado).length
        }));
    }

    static async _obtenerGraficoEficienciaTecnicos() {
        const resultado = await SoporteModel.obtenerRendimientoTecnicos();
        if (!resultado.success) return [];

        return resultado.data.map(tecnico => ({
            tecnico: tecnico.tecnico_nombre,
            eficiencia: tecnico.eficiencia_promedio || 0,
            productos_reparados: tecnico.productos_reparados || 0
        }));
    }

    static async _obtenerGraficoPausasPorTipo(fechas) {
        const sql = `
            SELECT tipo_pausa, es_pausa_justificada 
            FROM soporte_pausas_reparacion 
            WHERE fecha_inicio >= $1 AND fecha_inicio <= $2 AND activo = true
        `;
        const result = await query(sql, [fechas.inicio, fechas.fin]);
        const data = result.rows;

        const pausasPorTipo = {};
        data.forEach(pausa => {
            if (!pausasPorTipo[pausa.tipo_pausa]) {
                pausasPorTipo[pausa.tipo_pausa] = { total: 0, justificadas: 0 };
            }
            pausasPorTipo[pausa.tipo_pausa].total++;
            if (pausa.es_pausa_justificada) {
                pausasPorTipo[pausa.tipo_pausa].justificadas++;
            }
        });

        return Object.entries(pausasPorTipo).map(([tipo, datos]) => ({
            tipo,
            ...datos
        }));
    }

    static async _obtenerGraficoCapacitacionesCompletadas(fechas) {
        const sql = `
            SELECT fecha_capacitacion_realizada, calificacion_cliente 
            FROM soporte_capacitaciones 
            WHERE fecha_capacitacion_realizada >= $1 
              AND fecha_capacitacion_realizada <= $2 
              AND estado = 'COMPLETADA' 
              AND activo = true
        `;
        const result = await query(sql, [
            fechas.inicio.split('T')[0], 
            fechas.fin.split('T')[0]
        ]);
        const data = result.rows;

        const capacitacionesPorDia = {};
        data.forEach(cap => {
            const fecha = cap.fecha_capacitacion_realizada;
            if (!capacitacionesPorDia[fecha]) {
                capacitacionesPorDia[fecha] = { total: 0, calificacion_promedio: 0, calificaciones: [] };
            }
            capacitacionesPorDia[fecha].total++;
            if (cap.calificacion_cliente && cap.calificacion_cliente > 0) {
                capacitacionesPorDia[fecha].calificaciones.push(cap.calificacion_cliente);
            }
        });

        // Calcular promedio de calificaciones por día
        Object.keys(capacitacionesPorDia).forEach(fecha => {
            const calificaciones = capacitacionesPorDia[fecha].calificaciones;
            if (calificaciones.length > 0) {
                capacitacionesPorDia[fecha].calificacion_promedio = 
                    (calificaciones.reduce((sum, cal) => sum + cal, 0) / calificaciones.length).toFixed(1);
            }
            delete capacitacionesPorDia[fecha].calificaciones;
        });

        return Object.entries(capacitacionesPorDia).map(([fecha, datos]) => ({
            fecha,
            ...datos
        }));
    }
}

module.exports = DashboardSoporteController;