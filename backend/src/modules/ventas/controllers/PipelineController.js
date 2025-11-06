// ============================================
// PIPELINE CONTROLLER - VERSIÓN PROFESIONAL v3.0
// Sistema CRM/ERP - Optimizado con temporalidad precisa
// ============================================

const db = require('../../../config/database');

// ============================================
// UTILIDADES DE FECHAS
// ============================================

/**
 * Obtener fechas por período con manejo completo
 */
const obtenerFechasPorPeriodo = (periodo) => {
  const hoy = new Date();
  let desde, hasta;

  // Manejar períodos específicos (mes_2025-09, trimestre_2025-Q3, año_2025)
  if (periodo.startsWith('mes_') && periodo.includes('-')) {
    const [year, month] = periodo.replace('mes_', '').split('-');
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (!isNaN(yearNum) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      desde = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
      hasta = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
    } else {
      // Fallback a mes actual
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
      hasta = new Date().toISOString().split('T')[0];
    }
  } else if (periodo.startsWith('trimestre_') && periodo.includes('-Q')) {
    const [year, quarter] = periodo.replace('trimestre_', '').split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(quarter);

    if (!isNaN(yearNum) && !isNaN(quarterNum) && quarterNum >= 1 && quarterNum <= 4) {
      const mesInicio = (quarterNum - 1) * 3;
      desde = new Date(yearNum, mesInicio, 1).toISOString().split('T')[0];
      hasta = new Date(yearNum, mesInicio + 3, 0).toISOString().split('T')[0];
    } else {
      const mesActual = hoy.getMonth();
      const trimestreInicio = Math.floor(mesActual / 3) * 3;
      desde = new Date(hoy.getFullYear(), trimestreInicio, 1).toISOString().split('T')[0];
      hasta = new Date().toISOString().split('T')[0];
    }
  } else if (periodo.startsWith('año_') && /^\d{4}$/.test(periodo.replace('año_', ''))) {
    const yearNum = parseInt(periodo.replace('año_', ''));
    if (!isNaN(yearNum) && yearNum >= 2000 && yearNum <= 2100) {
      desde = new Date(yearNum, 0, 1).toISOString().split('T')[0];
      hasta = new Date(yearNum, 11, 31).toISOString().split('T')[0];
    } else {
      desde = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0];
      hasta = new Date().toISOString().split('T')[0];
    }
  } else {
    // Períodos predeterminados
    switch (periodo) {
      case 'hoy':
        desde = hasta = hoy.toISOString().split('T')[0];
        break;
      case 'semana_actual':
        const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
        desde = inicioSemana.toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
      case 'trimestre_actual':
        const mesActual = hoy.getMonth();
        const trimestreInicio = Math.floor(mesActual / 3) * 3;
        desde = new Date(hoy.getFullYear(), trimestreInicio, 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
      case 'año_actual':
        desde = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
      case 'mes_actual':
      default:
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
    }
  }

  return { desde, hasta };
};

/**
 * Calcular período anterior para comparaciones
 */
const calcularPeriodoAnterior = (periodo) => {
  const { desde: desdeActual, hasta: hastaActual } = obtenerFechasPorPeriodo(periodo);
  const fechaInicio = new Date(desdeActual);
  const fechaFin = new Date(hastaActual);

  // Calcular duración del período
  const duracionDias = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;

  // Período anterior: misma duración, terminando un día antes del inicio actual
  const finAnterior = new Date(fechaInicio);
  finAnterior.setDate(finAnterior.getDate() - 1);

  const inicioAnterior = new Date(finAnterior);
  inicioAnterior.setDate(inicioAnterior.getDate() - duracionDias + 1);

  return {
    desde: inicioAnterior.toISOString().split('T')[0],
    hasta: finAnterior.toISOString().split('T')[0]
  };
};

// ============================================
// ENDPOINT PRINCIPAL: DASHBOARD COMPLETO
// ============================================

/**
 * Dashboard completo con KPIs snapshot + temporales
 */
const dashboardPipeline = async (req, res) => {
  try {
    const { asesor_id } = req.query;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);
    const periodoAnterior = calcularPeriodoAnterior(periodo);

    console.log(`[Pipeline Dashboard] Período actual: ${periodo}`, { desde, hasta, asesor_id });
    console.log(`[Pipeline Dashboard] Período anterior:`, periodoAnterior);

    // ============================================
    // QUERY 1: KPIs SNAPSHOT (Pipeline Actual)
    // ============================================
    const snapshotQuery = `
      SELECT
        -- LEADS ACTIVOS (snapshot actual)
        COUNT(*) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as leads_activos,

        -- PIPELINE VALUE (snapshot actual - valor total)
        COALESCE(SUM(valor_estimado) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')), 0) as pipeline_valor_total,

        -- PIPELINE VALUE PONDERADO (snapshot actual - por probabilidad)
        COALESCE(SUM(valor_estimado * (probabilidad_cierre / 100.0)) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')), 0) as pipeline_valor_ponderado,

        -- PIPELINE EN RIESGO (snapshot actual - seguimientos vencidos)
        COALESCE(SUM(valor_estimado) FILTER (WHERE seguimiento_vencido = true AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')), 0) as pipeline_en_riesgo,
        COUNT(*) FILTER (WHERE seguimiento_vencido = true AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as leads_en_riesgo,

        -- Distribución actual por etapa
        COUNT(*) FILTER (WHERE estado = 'Prospecto') as prospectos_actuales,
        COUNT(*) FILTER (WHERE estado = 'Cotizado') as cotizados_actuales,
        COUNT(*) FILTER (WHERE estado = 'Negociacion') as negociacion_actuales,

        -- Probabilidad promedio actual
        AVG(probabilidad_cierre) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as probabilidad_promedio

      FROM prospectos
      WHERE activo = true
        ${asesor_id ? 'AND asesor_id = $1' : ''}
    `;

    // ============================================
    // QUERY 2: KPIs TEMPORALES (Período seleccionado)
    // ============================================
    const temporalQuery = `
      SELECT
        -- WIN RATE del período (solo leads cerrados/perdidos EN el período)
        COUNT(*) FILTER (WHERE estado = 'Cerrado' AND fecha_cierre::date BETWEEN $1 AND $2) as cerrados_periodo,
        COUNT(*) FILTER (WHERE estado = 'Perdido' AND fecha_cierre::date BETWEEN $1 AND $2) as perdidos_periodo,
        CASE
          WHEN (COUNT(*) FILTER (WHERE estado IN ('Cerrado', 'Perdido') AND fecha_cierre::date BETWEEN $1 AND $2)) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE estado = 'Cerrado' AND fecha_cierre::date BETWEEN $1 AND $2)::decimal /
            COUNT(*) FILTER (WHERE estado IN ('Cerrado', 'Perdido') AND fecha_cierre::date BETWEEN $1 AND $2) * 100, 2
          )
          ELSE 0
        END as win_rate_periodo,

        -- VELOCIDAD PROMEDIO (solo leads cerrados EN el período)
        AVG(
          EXTRACT(days FROM (fecha_cierre - fecha_contacto))
        ) FILTER (WHERE estado = 'Cerrado' AND fecha_cierre::date BETWEEN $1 AND $2 AND fecha_cierre IS NOT NULL) as dias_promedio_cierre,

        -- TASA DE CONVERSIÓN GLOBAL (cohorte: leads que entraron EN el período)
        COUNT(*) FILTER (WHERE fecha_contacto::date BETWEEN $1 AND $2) as leads_contactados_periodo,
        COUNT(*) FILTER (WHERE fecha_contacto::date BETWEEN $1 AND $2 AND convertido_venta = true) as leads_convertidos_periodo,
        CASE
          WHEN COUNT(*) FILTER (WHERE fecha_contacto::date BETWEEN $1 AND $2) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE fecha_contacto::date BETWEEN $1 AND $2 AND convertido_venta = true)::decimal /
            COUNT(*) FILTER (WHERE fecha_contacto::date BETWEEN $1 AND $2) * 100, 2
          )
          ELSE 0
        END as tasa_conversion_global

      FROM prospectos
      WHERE activo = true
        ${asesor_id ? 'AND asesor_id = $3' : ''}
    `;

    // ============================================
    // QUERY 3: INGRESOS Y TICKET PROMEDIO (desde tabla ventas)
    // ============================================
    const ventasQuery = `
      SELECT
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        COUNT(*) as ventas_cerradas
      FROM ventas
      WHERE activo = true
        AND estado_detallado = 'vendido'
        AND fecha_venta::date BETWEEN $1 AND $2
        ${asesor_id ? 'AND asesor_id = $3' : ''}
    `;

    // ============================================
    // QUERY 4: COMPARACIÓN CON PERÍODO ANTERIOR (snapshot)
    // ============================================
    const snapshotAnteriorQuery = `
      SELECT
        COUNT(*) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')
          AND created_at::date <= $1) as leads_activos_anterior,
        COALESCE(SUM(valor_estimado * (probabilidad_cierre / 100.0)) FILTER (
          WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')
          AND created_at::date <= $1
        ), 0) as pipeline_valor_anterior
      FROM prospectos
      WHERE activo = true
        ${asesor_id ? 'AND asesor_id = $2' : ''}
    `;

    // ============================================
    // QUERY 5: COMPARACIÓN CON PERÍODO ANTERIOR (temporal)
    // ============================================
    const temporalAnteriorQuery = `
      SELECT
        CASE
          WHEN (COUNT(*) FILTER (WHERE estado IN ('Cerrado', 'Perdido') AND fecha_cierre::date BETWEEN $1 AND $2)) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE estado = 'Cerrado' AND fecha_cierre::date BETWEEN $1 AND $2)::decimal /
            COUNT(*) FILTER (WHERE estado IN ('Cerrado', 'Perdido') AND fecha_cierre::date BETWEEN $1 AND $2) * 100, 2
          )
          ELSE 0
        END as win_rate_anterior,

        AVG(
          EXTRACT(days FROM (fecha_cierre - fecha_contacto))
        ) FILTER (WHERE estado = 'Cerrado' AND fecha_cierre::date BETWEEN $1 AND $2 AND fecha_cierre IS NOT NULL) as dias_promedio_anterior

      FROM prospectos
      WHERE activo = true
        ${asesor_id ? 'AND asesor_id = $3' : ''}
    `;

    // ============================================
    // QUERY 6: DISTRIBUCIÓN POR CANAL (del período)
    // ============================================
    const canalQuery = `
      SELECT
        canal_contacto,
        COUNT(*) as cantidad,
        COUNT(*) FILTER (WHERE convertido_venta = true) as conversiones,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / COUNT(*) * 100, 2)
          ELSE 0
        END as tasa_conversion,
        COALESCE(SUM(valor_estimado), 0) as valor_total
      FROM prospectos
      WHERE activo = true
        AND fecha_contacto::date BETWEEN $1 AND $2
        ${asesor_id ? 'AND asesor_id = $3' : ''}
        AND canal_contacto IS NOT NULL
      GROUP BY canal_contacto
      ORDER BY cantidad DESC
      LIMIT 10
    `;

    // Ejecutar queries
    const paramsSnapshot = asesor_id ? [asesor_id] : [];
    const paramsTemporal = asesor_id ? [desde, hasta, asesor_id] : [desde, hasta];
    const paramsSnapshotAnterior = asesor_id ? [periodoAnterior.hasta, asesor_id] : [periodoAnterior.hasta];
    const paramsTemporalAnterior = asesor_id ? [periodoAnterior.desde, periodoAnterior.hasta, asesor_id] : [periodoAnterior.desde, periodoAnterior.hasta];

    const [
      snapshotResult,
      temporalResult,
      ventasResult,
      snapshotAnteriorResult,
      temporalAnteriorResult,
      canalResult
    ] = await Promise.allSettled([
      db.query(snapshotQuery, paramsSnapshot),
      db.query(temporalQuery, paramsTemporal),
      db.query(ventasQuery, paramsTemporal),
      db.query(snapshotAnteriorQuery, paramsSnapshotAnterior),
      db.query(temporalAnteriorQuery, paramsTemporalAnterior),
      db.query(canalQuery, paramsTemporal)
    ]);

    // Extraer datos
    const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value.rows[0] : {};
    const temporal = temporalResult.status === 'fulfilled' ? temporalResult.value.rows[0] : {};
    const ventas = ventasResult.status === 'fulfilled' ? ventasResult.value.rows[0] : {};
    const snapshotAnterior = snapshotAnteriorResult.status === 'fulfilled' ? snapshotAnteriorResult.value.rows[0] : {};
    const temporalAnterior = temporalAnteriorResult.status === 'fulfilled' ? temporalAnteriorResult.value.rows[0] : {};
    const canales = canalResult.status === 'fulfilled' ? canalResult.value.rows : [];

    // Calcular variaciones
    const calcularVariacion = (actual, anterior) => {
      if (!anterior || anterior === 0) return null;
      return Math.round(((actual - anterior) / anterior) * 100);
    };

    // Construir respuesta
    res.json({
      success: true,
      data: {
        periodo,
        fecha_consulta: { desde, hasta },
        periodo_comparacion: periodoAnterior,
        asesor_filtro: asesor_id || 'todos',

        // ============================================
        // KPIs PRINCIPALES
        // ============================================
        kpis_principales: {
          // SNAPSHOT: Leads activos ahora
          leads_activos: parseInt(snapshot.leads_activos || 0),
          leads_activos_variacion: calcularVariacion(
            parseInt(snapshot.leads_activos || 0),
            parseInt(snapshotAnterior.leads_activos_anterior || 0)
          ),

          // SNAPSHOT: Pipeline value actual
          pipeline_valor_total: parseFloat(snapshot.pipeline_valor_total || 0),
          pipeline_valor_ponderado: parseFloat(snapshot.pipeline_valor_ponderado || 0),
          pipeline_valor_variacion: calcularVariacion(
            parseFloat(snapshot.pipeline_valor_ponderado || 0),
            parseFloat(snapshotAnterior.pipeline_valor_anterior || 0)
          ),

          // TEMPORAL: Win rate del período
          win_rate: parseFloat(temporal.win_rate_periodo || 0),
          win_rate_variacion: calcularVariacion(
            parseFloat(temporal.win_rate_periodo || 0),
            parseFloat(temporalAnterior.win_rate_anterior || 0)
          ),
          cerrados_periodo: parseInt(temporal.cerrados_periodo || 0),
          perdidos_periodo: parseInt(temporal.perdidos_periodo || 0),

          // TEMPORAL: Velocidad del período
          dias_promedio_cierre: Math.round(parseFloat(temporal.dias_promedio_cierre || 0)),
          dias_promedio_variacion: calcularVariacion(
            parseFloat(temporal.dias_promedio_cierre || 0),
            parseFloat(temporalAnterior.dias_promedio_anterior || 0)
          )
        },

        // ============================================
        // KPIs SECUNDARIOS
        // ============================================
        kpis_secundarios: {
          // TEMPORAL: Conversión del período
          tasa_conversion_global: parseFloat(temporal.tasa_conversion_global || 0),
          leads_contactados: parseInt(temporal.leads_contactados_periodo || 0),
          leads_convertidos: parseInt(temporal.leads_convertidos_periodo || 0),

          // TEMPORAL: Ingresos del período
          ingresos_totales: parseFloat(ventas.ingresos_totales || 0),
          ticket_promedio: parseFloat(ventas.ticket_promedio || 0),
          ventas_cerradas: parseInt(ventas.ventas_cerradas || 0),

          // SNAPSHOT: Pipeline en riesgo
          pipeline_en_riesgo: parseFloat(snapshot.pipeline_en_riesgo || 0),
          leads_en_riesgo: parseInt(snapshot.leads_en_riesgo || 0)
        },

        // ============================================
        // DISTRIBUCIÓN ACTUAL DEL PIPELINE
        // ============================================
        distribucion_snapshot: {
          prospectos: parseInt(snapshot.prospectos_actuales || 0),
          cotizados: parseInt(snapshot.cotizados_actuales || 0),
          negociacion: parseInt(snapshot.negociacion_actuales || 0),
          probabilidad_promedio: parseFloat(snapshot.probabilidad_promedio || 0)
        },

        // ============================================
        // DISTRIBUCIÓN POR CANAL
        // ============================================
        distribucion_canal: canales.map(c => ({
          canal: c.canal_contacto,
          cantidad: parseInt(c.cantidad),
          conversiones: parseInt(c.conversiones),
          tasa_conversion: parseFloat(c.tasa_conversion),
          valor_total: parseFloat(c.valor_total)
        })),

        // ============================================
        // ALERTAS
        // ============================================
        alertas: {
          seguimientos_vencidos: parseInt(snapshot.leads_en_riesgo || 0),
          valor_en_riesgo: parseFloat(snapshot.pipeline_en_riesgo || 0),
          necesita_atencion: parseInt(snapshot.leads_en_riesgo || 0) > 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Pipeline Dashboard] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas de pipeline',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ENDPOINT: EMBUDO DE CONVERSIÓN (DUAL)
// ============================================

/**
 * Análisis de embudo con modo snapshot vs cohorte
 */
const analisisEmbudo = async (req, res) => {
  try {
    const { asesor_id, modo = 'snapshot' } = req.query;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`[Embudo] Modo: ${modo}, Período: ${periodo}`, { desde, hasta });

    let embudoQuery;

    if (modo === 'cohorte') {
      // MODO COHORTE: Progresión de leads que entraron EN el período
      embudoQuery = `
        WITH cohorte_periodo AS (
          SELECT
            id,
            estado,
            valor_estimado,
            fecha_contacto,
            fecha_cierre,
            convertido_venta
          FROM prospectos
          WHERE activo = true
            AND fecha_contacto::date BETWEEN $1 AND $2
            ${asesor_id ? 'AND asesor_id = $3' : ''}
        )
        SELECT
          COUNT(*) as total_cohorte,

          -- Por estado actual
          COUNT(*) FILTER (WHERE estado = 'Prospecto') as en_prospecto,
          COUNT(*) FILTER (WHERE estado = 'Cotizado') as en_cotizado,
          COUNT(*) FILTER (WHERE estado = 'Negociacion') as en_negociacion,
          COUNT(*) FILTER (WHERE estado = 'Cerrado') as cerrados,
          COUNT(*) FILTER (WHERE estado = 'Perdido') as perdidos,

          -- Valores
          SUM(valor_estimado) FILTER (WHERE estado = 'Prospecto') as valor_prospecto,
          SUM(valor_estimado) FILTER (WHERE estado = 'Cotizado') as valor_cotizado,
          SUM(valor_estimado) FILTER (WHERE estado = 'Negociacion') as valor_negociacion,
          SUM(valor_estimado) FILTER (WHERE estado = 'Cerrado') as valor_cerrado,

          -- Tiempos promedio (solo cerrados)
          AVG(EXTRACT(days FROM (fecha_cierre - fecha_contacto))) FILTER (WHERE estado = 'Cerrado') as tiempo_total_cierre

        FROM cohorte_periodo
      `;
    } else {
      // MODO SNAPSHOT: Distribución actual del pipeline
      embudoQuery = `
        SELECT
          COUNT(*) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as total_pipeline,

          COUNT(*) FILTER (WHERE estado = 'Prospecto') as en_prospecto,
          COUNT(*) FILTER (WHERE estado = 'Cotizado') as en_cotizado,
          COUNT(*) FILTER (WHERE estado = 'Negociacion') as en_negociacion,
          COUNT(*) FILTER (WHERE estado = 'Cerrado') as cerrados_historico,
          COUNT(*) FILTER (WHERE estado = 'Perdido') as perdidos_historico,

          SUM(valor_estimado) FILTER (WHERE estado = 'Prospecto') as valor_prospecto,
          SUM(valor_estimado) FILTER (WHERE estado = 'Cotizado') as valor_cotizado,
          SUM(valor_estimado) FILTER (WHERE estado = 'Negociacion') as valor_negociacion,

          AVG(probabilidad_cierre) FILTER (WHERE estado = 'Prospecto') as prob_prospecto,
          AVG(probabilidad_cierre) FILTER (WHERE estado = 'Cotizado') as prob_cotizado,
          AVG(probabilidad_cierre) FILTER (WHERE estado = 'Negociacion') as prob_negociacion

        FROM prospectos
        WHERE activo = true
          ${asesor_id ? 'AND asesor_id = $1' : ''}
      `;
    }

    const params = modo === 'cohorte'
      ? (asesor_id ? [desde, hasta, asesor_id] : [desde, hasta])
      : (asesor_id ? [asesor_id] : []);

    const embudoResult = await db.query(embudoQuery, params);
    const embudo = embudoResult.rows[0] || {};

    // Calcular tasas de conversión
    const total = modo === 'cohorte'
      ? parseInt(embudo.total_cohorte || 0)
      : parseInt(embudo.total_pipeline || 0);

    const calcularPorcentaje = (cantidad) => {
      return total > 0 ? Math.round((cantidad / total) * 100) : 0;
    };

    const enProspecto = parseInt(embudo.en_prospecto || 0);
    const enCotizado = parseInt(embudo.en_cotizado || 0);
    const enNegociacion = parseInt(embudo.en_negociacion || 0);
    const cerrados = parseInt(modo === 'cohorte' ? embudo.cerrados : embudo.cerrados_historico || 0);
    const perdidos = parseInt(modo === 'cohorte' ? embudo.perdidos : embudo.perdidos_historico || 0);

    res.json({
      success: true,
      data: {
        modo,
        periodo,
        fecha_consulta: modo === 'cohorte' ? { desde, hasta } : null,

        embudo: {
          total,

          etapas: [
            {
              nombre: 'Prospecto',
              cantidad: enProspecto,
              porcentaje: calcularPorcentaje(enProspecto),
              valor: parseFloat(embudo.valor_prospecto || 0),
              probabilidad_promedio: modo === 'snapshot' ? parseFloat(embudo.prob_prospecto || 0) : null
            },
            {
              nombre: 'Cotizado',
              cantidad: enCotizado,
              porcentaje: calcularPorcentaje(enCotizado),
              valor: parseFloat(embudo.valor_cotizado || 0),
              probabilidad_promedio: modo === 'snapshot' ? parseFloat(embudo.prob_cotizado || 0) : null,
              conversion_desde_anterior: enProspecto > 0 ? Math.round((enCotizado / enProspecto) * 100) : 0
            },
            {
              nombre: 'Negociación',
              cantidad: enNegociacion,
              porcentaje: calcularPorcentaje(enNegociacion),
              valor: parseFloat(embudo.valor_negociacion || 0),
              probabilidad_promedio: modo === 'snapshot' ? parseFloat(embudo.prob_negociacion || 0) : null,
              conversion_desde_anterior: enCotizado > 0 ? Math.round((enNegociacion / enCotizado) * 100) : 0
            },
            {
              nombre: 'Cerrado',
              cantidad: cerrados,
              porcentaje: calcularPorcentaje(cerrados),
              valor: parseFloat(embudo.valor_cerrado || 0),
              conversion_desde_anterior: enNegociacion > 0 ? Math.round((cerrados / enNegociacion) * 100) : 0
            },
            {
              nombre: 'Perdido',
              cantidad: perdidos,
              porcentaje: calcularPorcentaje(perdidos)
            }
          ],

          win_rate: (cerrados + perdidos) > 0
            ? Math.round((cerrados / (cerrados + perdidos)) * 100)
            : 0,

          tiempo_promedio_total: modo === 'cohorte'
            ? Math.round(parseFloat(embudo.tiempo_total_cierre || 0))
            : null
        },

        insights: {
          etapa_critica: (() => {
            if (enProspecto > 0 && enCotizado / enProspecto < 0.5) return 'Prospecto → Cotizado';
            if (enCotizado > 0 && enNegociacion / enCotizado < 0.6) return 'Cotizado → Negociación';
            if (enNegociacion > 0 && cerrados / enNegociacion < 0.7) return 'Negociación → Cerrado';
            return 'Ninguna (rendimiento normal)';
          })()
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Análisis Embudo] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en análisis de embudo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ENDPOINT: SEGUIMIENTOS CRÍTICOS
// ============================================

/**
 * Seguimientos críticos con priorización empresarial
 */
const seguimientosCriticos = async (req, res) => {
  try {
    const { asesor_id } = req.query;

    const criticosQuery = `
      SELECT
        p.id,
        p.codigo,
        p.nombre_cliente,
        p.apellido_cliente,
        p.empresa,
        p.telefono,
        p.email,
        p.estado,
        p.valor_estimado,
        p.probabilidad_cierre,
        p.asesor_nombre,
        p.seguimiento_obligatorio,
        p.seguimiento_vencido,

        -- Criticidad basada en fecha
        CASE
          WHEN p.seguimiento_vencido THEN 'vencido'
          WHEN p.seguimiento_obligatorio::date = CURRENT_DATE THEN 'hoy'
          WHEN p.seguimiento_obligatorio::date <= CURRENT_DATE + INTERVAL '3 days' THEN 'proximo_vencer'
          ELSE 'normal'
        END as criticidad,

        -- Días de retraso o días restantes
        CASE
          WHEN p.seguimiento_vencido THEN
            EXTRACT(days FROM (CURRENT_TIMESTAMP - p.seguimiento_obligatorio))
          ELSE
            EXTRACT(days FROM (p.seguimiento_obligatorio - CURRENT_TIMESTAMP))
        END as dias_diferencia,

        -- Prioridad empresarial
        CASE
          WHEN p.valor_estimado >= 1000 AND p.probabilidad_cierre >= 70 THEN 'CRÍTICA'
          WHEN p.valor_estimado >= 500 AND p.probabilidad_cierre >= 50 THEN 'ALTA'
          WHEN p.seguimiento_vencido THEN 'MEDIA'
          ELSE 'BAJA'
        END as prioridad

      FROM prospectos p
      WHERE p.activo = true
        AND p.estado IN ('Prospecto', 'Cotizado', 'Negociacion')
        AND (
          p.seguimiento_vencido = true
          OR p.seguimiento_obligatorio::date <= CURRENT_DATE + INTERVAL '7 days'
        )
        ${asesor_id ? 'AND p.asesor_id = $1' : ''}
      ORDER BY
        CASE
          WHEN p.valor_estimado >= 1000 AND p.probabilidad_cierre >= 70 THEN 1
          WHEN p.valor_estimado >= 500 AND p.probabilidad_cierre >= 50 THEN 2
          WHEN p.seguimiento_vencido = true THEN 3
          ELSE 4
        END,
        p.valor_estimado DESC,
        p.seguimiento_obligatorio ASC
    `;

    const params = asesor_id ? [asesor_id] : [];
    const criticosResult = await db.query(criticosQuery, params);

    const seguimientos = criticosResult.rows.map(seg => ({
      ...seg,
      valor_estimado: parseFloat(seg.valor_estimado || 0),
      probabilidad_cierre: parseInt(seg.probabilidad_cierre || 0),
      dias_diferencia: parseInt(seg.dias_diferencia || 0)
    }));

    // Agrupar por criticidad
    const vencidos = seguimientos.filter(s => s.criticidad === 'vencido');
    const hoy = seguimientos.filter(s => s.criticidad === 'hoy');
    const proximosVencer = seguimientos.filter(s => s.criticidad === 'proximo_vencer');

    const metricas = {
      total: seguimientos.length,
      vencidos: vencidos.length,
      hoy: hoy.length,
      proximos_vencer: proximosVencer.length,
      criticos: seguimientos.filter(s => s.prioridad === 'CRÍTICA').length,
      valor_total_riesgo: vencidos.reduce((sum, s) => sum + s.valor_estimado, 0),
      valor_hoy: hoy.reduce((sum, s) => sum + s.valor_estimado, 0),
      valor_proximos: proximosVencer.reduce((sum, s) => sum + s.valor_estimado, 0)
    };

    res.json({
      success: true,
      data: {
        seguimientos_criticos: seguimientos,
        metricas,
        grupos: {
          vencidos: vencidos.slice(0, 10),
          hoy: hoy.slice(0, 10),
          proximos_vencer: proximosVencer.slice(0, 10)
        },
        recomendacion: metricas.criticos > 0
          ? `Atención inmediata: ${metricas.criticos} oportunidades CRÍTICAS`
          : metricas.vencidos > 0
          ? `Priorizar ${metricas.vencidos} seguimientos vencidos`
          : 'Mantener seguimiento regular'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Seguimientos Críticos] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo seguimientos críticos',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ENDPOINT: PROYECCIÓN DE VENTAS
// ============================================

/**
 * Proyección de ventas basada en pipeline actual
 */
const proyeccionVentas = async (req, res) => {
  try {
    const { asesor_id } = req.query;

    // Query proyección basada en pipeline actual
    const proyeccionQuery = `
      WITH pipeline_actual AS (
        SELECT
          estado,
          COUNT(*) as cantidad,
          SUM(valor_estimado) as valor_total,
          AVG(probabilidad_cierre) as probabilidad_promedio,
          SUM(valor_estimado * (probabilidad_cierre / 100.0)) as valor_ponderado
        FROM prospectos
        WHERE activo = true
          AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
          ${asesor_id ? 'AND asesor_id = $1' : ''}
        GROUP BY estado
      ),
      historico_90dias AS (
        SELECT
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE convertido_venta = true) as convertidos,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / COUNT(*)) * 100, 2)
            ELSE 0
          END as tasa_conversion_historica,
          AVG(valor_estimado) FILTER (WHERE estado = 'Cerrado') as ticket_promedio_historico
        FROM prospectos
        WHERE activo = true
          AND fecha_contacto >= CURRENT_DATE - INTERVAL '90 days'
          ${asesor_id ? 'AND asesor_id = $1' : ''}
      )
      SELECT
        pa.*,
        h.tasa_conversion_historica,
        h.ticket_promedio_historico
      FROM pipeline_actual pa
      CROSS JOIN historico_90dias h
    `;

    const params = asesor_id ? [asesor_id] : [];
    const proyeccionResult = await db.query(proyeccionQuery, params);
    const datosProyeccion = proyeccionResult.rows;

    // Cálculos
    const totalValor = datosProyeccion.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0);
    const totalPonderado = datosProyeccion.reduce((sum, item) => sum + parseFloat(item.valor_ponderado || 0), 0);
    const totalCantidad = datosProyeccion.reduce((sum, item) => sum + parseInt(item.cantidad || 0), 0);
    const tasaHistorica = parseFloat(datosProyeccion[0]?.tasa_conversion_historica || 0);

    // Distribución por probabilidad
    const distribucionQuery = `
      SELECT
        CASE
          WHEN probabilidad_cierre >= 90 THEN '90-100%'
          WHEN probabilidad_cierre >= 70 THEN '70-89%'
          WHEN probabilidad_cierre >= 50 THEN '50-69%'
          ELSE '<50%'
        END as rango_probabilidad,
        COUNT(*) as cantidad,
        SUM(valor_estimado) as valor_total
      FROM prospectos
      WHERE activo = true
        AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
        ${asesor_id ? 'AND asesor_id = $1' : ''}
      GROUP BY rango_probabilidad
      ORDER BY MIN(probabilidad_cierre) DESC
    `;

    const distribucionResult = await db.query(distribucionQuery, params);

    res.json({
      success: true,
      data: {
        pipeline_actual: {
          valor_total: totalValor,
          valor_ponderado: totalPonderado,
          cantidad_oportunidades: totalCantidad
        },

        proyecciones: {
          conservadora: {
            valor: Math.round(totalValor * (tasaHistorica / 100)),
            probabilidad: tasaHistorica,
            descripcion: 'Basada en tasa histórica de conversión (90 días)'
          },
          realista: {
            valor: Math.round(totalPonderado),
            probabilidad: 'Variable por oportunidad',
            descripcion: 'Basada en probabilidades individuales de cada lead'
          },
          optimista: {
            valor: Math.round(totalValor * 0.8),
            probabilidad: 80,
            descripcion: 'Asumiendo 80% de cierre del pipeline'
          }
        },

        distribucion_probabilidad: distribucionResult.rows.map(d => ({
          rango: d.rango_probabilidad,
          cantidad: parseInt(d.cantidad),
          valor: parseFloat(d.valor_total || 0)
        })),

        detalle_por_etapa: datosProyeccion.map(d => ({
          etapa: d.estado,
          cantidad: parseInt(d.cantidad),
          valor_total: parseFloat(d.valor_total || 0),
          valor_ponderado: parseFloat(d.valor_ponderado || 0),
          probabilidad_promedio: parseFloat(d.probabilidad_promedio || 0)
        })),

        insights: {
          foco_principal: totalPonderado > 0
            ? 'Acelerar cierre de negociaciones en curso'
            : 'Incrementar generación de leads',
          valor_mas_probable: Math.round(totalPonderado),
          rango_esperado: {
            minimo: Math.round(totalValor * (tasaHistorica / 100)),
            maximo: Math.round(totalValor * 0.8)
          }
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Proyección Ventas] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error calculando proyección',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// HEALTH CHECK
// ============================================

const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: 'Pipeline Controller v3.0 - Profesional',
    version: '3.0.0',
    endpoints: [
      'GET /dashboard - KPIs completos (snapshot + temporales)',
      'GET /embudo - Análisis de conversión (modo: snapshot|cohorte)',
      'GET /proyeccion - Proyección probabilística de ventas',
      'GET /seguimientos-criticos - Alertas priorizadas'
    ],
    mejoras_v3: [
      'Temporalidad precisa: snapshot vs temporal',
      'Comparaciones vs período anterior',
      'Embudo dual: snapshot actual + cohorte del período',
      'KPIs calculados correctamente según temporalidad',
      'Priorización inteligente de seguimientos',
      'Proyecciones basadas en pipeline actual'
    ],
    timestamp: new Date().toISOString()
  });
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  dashboardPipeline,
  analisisEmbudo,
  proyeccionVentas,
  seguimientosCriticos,
  healthCheck
};
