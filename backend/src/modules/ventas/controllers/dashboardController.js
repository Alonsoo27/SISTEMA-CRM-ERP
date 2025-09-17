// ============================================
// DASHBOARD CONTROLLER - MÉTRICAS PERSONALES
// Sistema CRM/ERP v2.0 - Controller para dashboards individuales
// ============================================

const { query } = require('../../../config/database');

// Utilidad para obtener fechas por período
const obtenerFechasPorPeriodo = (periodo) => {
  const hoy = new Date();
  let desde, hasta;

  switch (periodo) {
    case 'hoy':
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      hasta = hoy;
      break;
    case 'semana_actual':
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay());
      desde = inicioSemana;
      hasta = hoy;
      break;
    case 'mes_actual':
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      hasta = hoy;
      break;
    case 'trimestre_actual':
      const mesActual = hoy.getMonth();
      const inicioTrimestre = new Date(hoy.getFullYear(), Math.floor(mesActual / 3) * 3, 1);
      desde = inicioTrimestre;
      hasta = hoy;
      break;
    default:
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      hasta = hoy;
  }

  return { desde, hasta };
};

/**
 * Dashboard personal del asesor - KPIs principales
 */
const dashboardPersonal = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`Dashboard personal - Asesor: ${asesor_id}, Periodo: ${periodo}`);

    // Query principal para KPIs
    const queryActual = `
      SELECT 
        COUNT(*) as ventas_completadas,
        COALESCE(SUM(valor_final), 0) as valor_total_completadas,
        COALESCE(AVG(valor_final), 0) as promedio_venta,
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) * 100.0 / COUNT(*), 2)
          ELSE 0 
        END as tasa_exito,
        COUNT(DISTINCT CASE WHEN cliente_empresa IS NOT NULL THEN cliente_empresa END) as clientes_unicos
      FROM ventas 
      WHERE asesor_id = $1 
        AND estado_detallado = 'vendido'
        AND fecha_venta >= $2 
        AND fecha_venta <= $3
    `;

    // Query para período anterior (comparación)
    const diasDiferencia = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24));
    const desdeAnterior = new Date(desde);
    desdeAnterior.setDate(desde.getDate() - diasDiferencia);
    const hastaAnterior = new Date(desde);
    hastaAnterior.setDate(desde.getDate() - 1);

    const queryAnterior = `
      SELECT 
        COUNT(*) as ventas_completadas_anterior,
        COALESCE(SUM(valor_final), 0) as valor_total_completadas_anterior,
        COALESCE(AVG(valor_final), 0) as promedio_venta_anterior
      FROM ventas 
      WHERE asesor_id = $1 
        AND estado_detallado = 'vendido'
        AND fecha_venta >= $2 
        AND fecha_venta <= $3
    `;

    const [resultadoActual, resultadoAnterior] = await Promise.all([
      query(queryActual, [asesor_id, desde, hasta]),
      query(queryAnterior, [asesor_id, desdeAnterior, hastaAnterior])
    ]);

    const metricas = resultadoActual.rows[0];
    const metricasAnteriores = resultadoAnterior.rows[0];

    // Calcular tendencias
    const calcularTendencia = (actual, anterior) => {
      if (!anterior || parseFloat(anterior) === 0) return 0;
      return (((parseFloat(actual) - parseFloat(anterior)) / parseFloat(anterior)) * 100).toFixed(1);
    };

    const respuesta = {
      success: true,
      data: {
        periodo,
        fechas: { desde, hasta },
        metricas: {
          ventas_completadas: parseInt(metricas.ventas_completadas) || 0,
          valor_total_completadas: parseFloat(metricas.valor_total_completadas) || 0,
          promedio_venta: parseFloat(metricas.promedio_venta) || 0,
          tasa_exito: parseFloat(metricas.tasa_exito) || 0,
          clientes_unicos: parseInt(metricas.clientes_unicos) || 0,
        },
        tendencias: {
          ventas_completadas: calcularTendencia(metricas.ventas_completadas, metricasAnteriores.ventas_completadas_anterior),
          valor_total_completadas: calcularTendencia(metricas.valor_total_completadas, metricasAnteriores.valor_total_completadas_anterior),
          promedio_venta: calcularTendencia(metricas.promedio_venta, metricasAnteriores.promedio_venta_anterior)
        }
      }
    };

    console.log(`Dashboard personal generado - ${metricas.ventas_completadas} ventas`);
    res.json(respuesta);

  } catch (error) {
    console.error('Error en dashboardPersonal:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Análisis geográfico por asesor
 */
const geografiaPorAsesor = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`Geografia asesor - ID: ${asesor_id}, Periodo: ${periodo}`);

    const queryGeografia = `
      SELECT 
        COALESCE(departamento, 'Sin especificar') as departamento,
        COALESCE(ciudad, 'Sin especificar') as ciudad,
        COUNT(*) as cantidad_ventas,
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje_ventas
      FROM ventas 
      WHERE asesor_id = $1 
        AND estado_detallado = 'vendido'
        AND fecha_venta >= $2 
        AND fecha_venta <= $3
      GROUP BY departamento, ciudad
      ORDER BY ingresos_totales DESC
      LIMIT 10
    `;

    const resultado = await query(queryGeografia, [asesor_id, desde, hasta]);

    const respuesta = {
      success: true,
      data: {
        periodo,
        asesor_id: parseInt(asesor_id),
        geografiaData: resultado.rows.map(row => ({
          departamento: row.departamento,
          ciudad: row.ciudad,
          cantidad_ventas: parseInt(row.cantidad_ventas),
          ingresos_totales: parseFloat(row.ingresos_totales),
          ticket_promedio: parseFloat(row.ticket_promedio),
          porcentaje_ventas: parseFloat(row.porcentaje_ventas)
        }))
      }
    };

    console.log(`Geografia generada - ${resultado.rows.length} ubicaciones`);
    res.json(respuesta);

  } catch (error) {
    console.error('Error en geografiaPorAsesor:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Análisis por sectores por asesor
 */
const sectoresPorAsesor = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`Sectores asesor - ID: ${asesor_id}, Periodo: ${periodo}`);

    const querySectores = `
      SELECT 
        COALESCE(sector, 'Sin especificar') as sector,
        COUNT(*) as cantidad_ventas,
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        COUNT(DISTINCT CASE WHEN cliente_empresa IS NOT NULL THEN cliente_empresa END) as clientes_unicos,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje_ventas
      FROM ventas 
      WHERE asesor_id = $1 
        AND estado_detallado = 'vendido'
        AND fecha_venta >= $2 
        AND fecha_venta <= $3
      GROUP BY sector
      ORDER BY ingresos_totales DESC
    `;

    const resultado = await query(querySectores, [asesor_id, desde, hasta]);

    const respuesta = {
      success: true,
      data: {
        periodo,
        asesor_id: parseInt(asesor_id),
        sectoresData: resultado.rows.map(row => ({
          sector: row.sector,
          cantidad_ventas: parseInt(row.cantidad_ventas),
          ingresos_totales: parseFloat(row.ingresos_totales),
          ticket_promedio: parseFloat(row.ticket_promedio),
          clientes_unicos: parseInt(row.clientes_unicos),
          porcentaje_ventas: parseFloat(row.porcentaje_ventas)
        }))
      }
    };

    console.log(`Sectores generados - ${resultado.rows.length} sectores`);
    res.json(respuesta);

  } catch (error) {
    console.error('Error en sectoresPorAsesor:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Evolución temporal por asesor
 */
const evolucionPorAsesor = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`Evolución asesor - ID: ${asesor_id}, Periodo: ${periodo}`);

    // Ajustar agrupación según período
    let dateColumn;
    switch (periodo) {
      case 'hoy':
      case 'semana_actual':
        dateColumn = "TO_CHAR(fecha_venta, 'Day DD/MM')";
        break;
      case 'mes_actual':
        dateColumn = "EXTRACT(WEEK FROM fecha_venta)";
        break;
      case 'trimestre_actual':
        dateColumn = "TO_CHAR(fecha_venta, 'Month YYYY')";
        break;
      default:
        dateColumn = "EXTRACT(WEEK FROM fecha_venta)";
    }

    const queryEvolucion = `
      SELECT 
        ${dateColumn} as periodo_label,
        DATE_TRUNC('week', fecha_venta) as periodo_fecha,
        COUNT(*) as ventas,
        COALESCE(SUM(valor_final), 0) as ingresos,
        COALESCE(AVG(valor_final), 0) as ticket_promedio
      FROM ventas 
      WHERE asesor_id = $1 
        AND estado_detallado = 'vendido'
        AND fecha_venta >= $2 
        AND fecha_venta <= $3
      GROUP BY periodo_label, periodo_fecha
      ORDER BY periodo_fecha ASC
    `;

    const resultado = await query(queryEvolucion, [asesor_id, desde, hasta]);

    const respuesta = {
      success: true,
      data: {
        periodo,
        asesor_id: parseInt(asesor_id),
        evolucionData: resultado.rows.map(row => ({
          periodo_label: row.periodo_label,
          periodo_fecha: row.periodo_fecha,
          ventas: parseInt(row.ventas),
          ingresos: parseFloat(row.ingresos),
          ticket_promedio: parseFloat(row.ticket_promedio)
        }))
      }
    };

    console.log(`Evolución generada - ${resultado.rows.length} períodos`);
    res.json(respuesta);

  } catch (error) {
    console.error('Error en evolucionPorAsesor:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Ranking del asesor vs otros asesores
 */
const rankingAsesor = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`Ranking asesor - ID: ${asesor_id}, Periodo: ${periodo}`);

    const queryRanking = `
      WITH ranking_ventas AS (
        SELECT 
          v.asesor_id,
          COALESCE(u.nombre, 'Usuario ' || v.asesor_id) as nombre_asesor,
          COUNT(*) as total_ventas,
          COALESCE(SUM(v.valor_final), 0) as total_ingresos,
          COALESCE(AVG(v.valor_final), 0) as promedio_venta,
          RANK() OVER (ORDER BY COUNT(*) DESC) as posicion_ventas,
          RANK() OVER (ORDER BY SUM(v.valor_final) DESC) as posicion_ingresos
        FROM ventas v
        LEFT JOIN usuarios u ON v.asesor_id = u.id
        WHERE v.estado_detallado = 'vendido'
          AND v.fecha_venta >= $2 
          AND v.fecha_venta <= $3
        GROUP BY v.asesor_id, u.nombre
      ),
      estadisticas_equipo AS (
        SELECT 
          COUNT(DISTINCT asesor_id) as total_asesores,
          AVG(total_ventas) as promedio_ventas_equipo,
          AVG(total_ingresos) as promedio_ingresos_equipo,
          AVG(promedio_venta) as promedio_ticket_equipo
        FROM ranking_ventas
      )
      SELECT 
        r.*,
        e.total_asesores,
        e.promedio_ventas_equipo,
        e.promedio_ingresos_equipo,
        e.promedio_ticket_equipo
      FROM ranking_ventas r
      CROSS JOIN estadisticas_equipo e
      WHERE r.asesor_id = $1
    `;

    const resultado = await query(queryRanking, [asesor_id, desde, hasta]);

    if (resultado.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          periodo,
          asesor_id: parseInt(asesor_id),
          mensaje: 'No hay datos de ventas para este período',
          rankingData: null
        }
      });
    }

    const datos = resultado.rows[0];

    const respuesta = {
      success: true,
      data: {
        periodo,
        asesor_id: parseInt(asesor_id),
        rankingData: {
          nombre_asesor: datos.nombre_asesor,
          posicion_ventas: parseInt(datos.posicion_ventas),
          posicion_ingresos: parseInt(datos.posicion_ingresos),
          total_asesores: parseInt(datos.total_asesores),
          mis_ventas: parseInt(datos.total_ventas),
          mis_ingresos: parseFloat(datos.total_ingresos),
          mi_promedio: parseFloat(datos.promedio_venta),
          promedio_equipo_ventas: parseFloat(datos.promedio_ventas_equipo),
          promedio_equipo_ingresos: parseFloat(datos.promedio_ingresos_equipo),
          promedio_equipo_ticket: parseFloat(datos.promedio_ticket_equipo)
        }
      }
    };

    console.log(`Ranking generado - Posición: ${datos.posicion_ventas}°`);
    res.json(respuesta);

  } catch (error) {
    console.error('Error en rankingAsesor:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// ============================================
// EXPORTACIÓN DEL CONTROLLER
// ============================================

const DashboardController = {
  dashboardPersonal,
  geografiaPorAsesor,
  sectoresPorAsesor,
  evolucionPorAsesor,
  rankingAsesor
};

module.exports = DashboardController;

console.log('Dashboard Personal Controller loaded - Sistema de métricas individuales');
console.log('Métodos disponibles: dashboardPersonal, geografiaPorAsesor, sectoresPorAsesor, evolucionPorAsesor, rankingAsesor');