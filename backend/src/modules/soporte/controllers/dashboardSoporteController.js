// =====================================
// CONTROLADOR DE DASHBOARD Y MÉTRICAS DE SOPORTE
// =====================================
// Maneja todas las métricas, KPIs y datos del dashboard principal

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
            const supabase = require('../../../config/supabase');

            // Ejecutar múltiples consultas en paralelo para mejor rendimiento
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
            const supabase = require('../../../config/supabase');

            // Calcular fechas según el período
            const fechas = DashboardSoporteController._calcularRangoFechas(periodo || 'mes');

            // KPIs de tickets
            const { data: tickets, error: errorTickets } = await supabase
                .from('tickets_soporte')
                .select('*')
                .gte('created_at', fechas.inicio)
                .lte('created_at', fechas.fin)
                .eq('activo', true);

            if (errorTickets) throw errorTickets;

            // KPIs de productos
            const { data: productos, error: errorProductos } = await supabase
                .from('vista_productos_con_pausas')
                .select('*')
                .gte('fecha_recepcion', fechas.inicio.split('T')[0])
                .lte('fecha_recepcion', fechas.fin.split('T')[0]);

            if (errorProductos) throw errorProductos;

            // KPIs de capacitaciones
            const { data: capacitaciones, error: errorCapacitaciones } = await supabase
                .from('soporte_capacitaciones')
                .select('*')
                .gte('created_at', fechas.inicio)
                .lte('created_at', fechas.fin)
                .eq('activo', true);

            if (errorCapacitaciones) throw errorCapacitaciones;

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
            const supabase = require('../../../config/supabase');

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
            const supabase = require('../../../config/supabase');

            // Alertas de SLA vencido
            const { data: slaVencido, error: errorSLA } = await supabase
                .from('tickets_soporte')
                .select(`
                    id, codigo, titulo, prioridad, created_at,
                    tecnico_asignado:usuarios!tecnico_asignado_id(nombre, apellido)
                `)
                .in('estado', ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO'])
                .eq('activo', true);

            if (errorSLA) throw errorSLA;

            // Filtrar tickets con SLA vencido
            const ticketsSLAVencido = slaVencido.filter(ticket => {
                const limitesSLA = { 'URGENTE': 2, 'ALTA': 8, 'MEDIA': 24, 'BAJA': 48 };
                const limiteHoras = limitesSLA[ticket.prioridad] || 24;
                const horasTranscurridas = (new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60);
                return horasTranscurridas > limiteHoras;
            });

            // Alertas de productos pausados largamente
            const { data: productosPausados, error: errorPausas } = await supabase
                .from('vista_alertas_soporte')
                .select('*');

            if (errorPausas) throw errorPausas;

            // Alertas de capacitaciones vencidas
            const hoy = new Date().toISOString().split('T')[0];
            const { data: capacitacionesVencidas, error: errorCapVencidas } = await supabase
                .from('soporte_capacitaciones')
                .select('*')
                .lt('fecha_capacitacion_programada', hoy)
                .in('estado', ['PENDIENTE', 'PROGRAMADA'])
                .eq('activo', true);

            if (errorCapVencidas) throw errorCapVencidas;

            // Alertas de productos sin técnico asignado (más de 24h)
            const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: sinTecnico, error: errorSinTecnico } = await supabase
                .from('tickets_soporte')
                .select('*')
                .is('tecnico_asignado_id', null)
                .eq('estado', 'PENDIENTE')
                .lt('created_at', hace24h)
                .eq('activo', true);

            if (errorSinTecnico) throw errorSinTecnico;

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

    static _calcularTiempoPromedioTickets(tickets) {
        const completados = tickets.filter(t => t.estado === 'COMPLETADO' && t.tiempo_real_horas);
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
        const conEficiencia = productos.filter(p => p.eficiencia_porcentaje > 0);
        if (conEficiencia.length === 0) return 0;
        
        const total = conEficiencia.reduce((sum, p) => sum + p.eficiencia_porcentaje, 0);
        return Math.round(total / conEficiencia.length);
    }

    static _calcularTiempoPromedioReparacion(productos) {
        const reparados = productos.filter(p => p.tiempo_efectivo_horas > 0);
        if (reparados.length === 0) return 0;
        
        const total = reparados.reduce((sum, p) => sum + p.tiempo_efectivo_horas, 0);
        return Math.round(total / reparados.length);
    }

    static _calcularCalificacionPromedio(capacitaciones) {
        const conCalificacion = capacitaciones.filter(c => c.calificacion_cliente > 0);
        if (conCalificacion.length === 0) return 0;
        
        const total = conCalificacion.reduce((sum, c) => sum + c.calificacion_cliente, 0);
        return (total / conCalificacion.length).toFixed(1);
    }

    static _calcularTiempoRespuestaPromedio(capacitaciones) {
        const conTiempo = capacitaciones.filter(c => c.tiempo_respuesta_capacitacion_horas > 0);
        if (conTiempo.length === 0) return 0;
        
        const total = conTiempo.reduce((sum, c) => sum + c.tiempo_respuesta_capacitacion_horas, 0);
        return Math.round(total / conTiempo.length);
    }

    // Métodos para gráficos específicos
    static async _obtenerGraficoTicketsPorDia(fechas) {
        const supabase = require('../../../config/supabase');
        const { data, error } = await supabase
            .from('tickets_soporte')
            .select('created_at, estado')
            .gte('created_at', fechas.inicio)
            .lte('created_at', fechas.fin)
            .eq('activo', true);

        if (error) throw error;

        // Agrupar por día
        const ticketsPorDia = {};
        data.forEach(ticket => {
            const fecha = ticket.created_at.split('T')[0];
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
        const supabase = require('../../../config/supabase');
        const { data, error } = await supabase
            .from('soporte_pausas_reparacion')
            .select('tipo_pausa, es_pausa_justificada')
            .gte('fecha_inicio', fechas.inicio)
            .lte('fecha_inicio', fechas.fin)
            .eq('activo', true);

        if (error) throw error;

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
        const supabase = require('../../../config/supabase');
        const { data, error } = await supabase
            .from('soporte_capacitaciones')
            .select('fecha_capacitacion_realizada, calificacion_cliente')
            .gte('fecha_capacitacion_realizada', fechas.inicio.split('T')[0])
            .lte('fecha_capacitacion_realizada', fechas.fin.split('T')[0])
            .eq('estado', 'COMPLETADA')
            .eq('activo', true);

        if (error) throw error;

        const capacitacionesPorDia = {};
        data.forEach(cap => {
            const fecha = cap.fecha_capacitacion_realizada;
            if (!capacitacionesPorDia[fecha]) {
                capacitacionesPorDia[fecha] = { total: 0, calificacion_promedio: 0, calificaciones: [] };
            }
            capacitacionesPorDia[fecha].total++;
            if (cap.calificacion_cliente > 0) {
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