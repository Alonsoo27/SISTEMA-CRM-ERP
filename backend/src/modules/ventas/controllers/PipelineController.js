// ============================================
// PIPELINE CONTROLLER - VERSIÓN MEJORADA EMPRESARIAL
// Sistema CRM/ERP v2.0 - Optimizado para estructura real de datos
// ============================================

const db = require('../../../config/database');

// Utilidad mejorada para fechas
const obtenerFechasPorPeriodo = (periodo) => {
  const hoy = new Date();
  let desde, hasta;

  // Manejar períodos específicos (mes_2025-09, trimestre_2025-Q3, año_2025)
  if (periodo.startsWith('mes_') && periodo.includes('-')) {
    const [year, month] = periodo.replace('mes_', '').split('-');
    desde = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0];
    hasta = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
  } else if (periodo.startsWith('trimestre_') && periodo.includes('-Q')) {
    const [year, quarter] = periodo.replace('trimestre_', '').split('-Q');
    const mesInicio = (parseInt(quarter) - 1) * 3;
    desde = new Date(parseInt(year), mesInicio, 1).toISOString().split('T')[0];
    hasta = new Date(parseInt(year), mesInicio + 3, 0).toISOString().split('T')[0];
  } else if (periodo.startsWith('año_') && /^\d{4}$/.test(periodo.replace('año_', ''))) {
    const year = periodo.replace('año_', '');
    desde = new Date(parseInt(year), 0, 1).toISOString().split('T')[0];
    hasta = new Date(parseInt(year), 11, 31).toISOString().split('T')[0];
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
      case 'mes_actual':
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
      case 'trimestre_actual':
        const mesActual = new Date().getMonth();
        const trimestreInicio = Math.floor(mesActual / 3) * 3;
        desde = new Date(new Date().getFullYear(), trimestreInicio, 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
      case 'año_actual':
        desde = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
        break;
      default:
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        hasta = new Date().toISOString().split('T')[0];
    }
  }

  return { desde, hasta };
};

/**
 * Dashboard principal - KPIs empresariales optimizados
 */
const dashboardPipeline = async (req, res) => {
  try {
    const { asesor_id } = req.query;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    console.log(`[Pipeline Dashboard] Consultando período: ${periodo}`, { desde, hasta, asesor_id });

    // Query 1: KPIs principales usando tu estructura real
    const kpisQuery = `
      SELECT 
        COUNT(*) as total_prospectos,
        COUNT(*) FILTER (WHERE estado = 'Prospecto') as en_prospecto,
        COUNT(*) FILTER (WHERE estado = 'Cotizado') as en_cotizado,
        COUNT(*) FILTER (WHERE estado = 'Negociacion') as en_negociacion,
        COUNT(*) FILTER (WHERE estado = 'Cerrado') as cerrados,
        COUNT(*) FILTER (WHERE estado = 'Perdido') as perdidos,
        
        -- Conversiones basadas en tu estructura
        ROUND(
          COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as tasa_conversion_general,
        
        -- Pipeline value usando campos reales
        SUM(valor_estimado) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as valor_pipeline_activo,
        AVG(valor_estimado) FILTER (WHERE estado = 'Cerrado') as ticket_promedio,

        -- Ingresos totales desde tabla ventas
        (
          SELECT COALESCE(SUM(v.valor_final), 0)
          FROM ventas v
          WHERE v.activo = true
            AND v.fecha_venta::date BETWEEN $1 AND $2
            ${asesor_id ? 'AND v.asesor_id = $3' : ''}
        ) as ingresos_totales,
        
        -- Seguimientos críticos
        COUNT(*) FILTER (WHERE seguimiento_vencido = true) as seguimientos_vencidos,
        COUNT(*) FILTER (WHERE seguimiento_obligatorio::date = CURRENT_DATE) as seguimientos_hoy,
        
        -- Tiempo promedio usando tus fechas reales
        AVG(
          EXTRACT(days FROM (fecha_cierre - fecha_contacto))
        ) FILTER (WHERE estado = 'Cerrado') as tiempo_promedio_cierre_dias,
        
        -- Probabilidad promedio
        AVG(probabilidad_cierre) FILTER (WHERE estado IN ('Cotizado', 'Negociacion')) as probabilidad_promedio
        
      FROM prospectos 
      WHERE activo = true
        AND fecha_contacto::date BETWEEN $1 AND $2
        ${asesor_id ? 'AND asesor_id = $3' : ''}
    `;

    // Query 2: Distribución por etapas con valores
    const distribucionQuery = `
      SELECT
        estado,
        COUNT(*) as cantidad,
        SUM(valor_estimado) as valor_total,
        AVG(valor_estimado) as valor_promedio,
        AVG(probabilidad_cierre) as probabilidad_promedio,
        -- Tiempo promedio en cada etapa
        AVG(
          EXTRACT(days FROM (COALESCE(fecha_cierre, CURRENT_TIMESTAMP) - fecha_contacto))
        ) as dias_promedio_etapa
      FROM prospectos 
      WHERE activo = true
        AND fecha_contacto::date BETWEEN $1 AND $2
        ${asesor_id ? 'AND asesor_id = $3' : ''}
      GROUP BY estado
      ORDER BY 
        CASE estado 
          WHEN 'Prospecto' THEN 1
          WHEN 'Cotizado' THEN 2  
          WHEN 'Negociacion' THEN 3
          WHEN 'Cerrado' THEN 4
          WHEN 'Perdido' THEN 5
        END
    `;

    // Query 3: Performance por asesor
    const performanceQuery = `
      SELECT 
        asesor_id,
        asesor_nombre,
        COUNT(*) as total_prospectos,
        COUNT(*) FILTER (WHERE convertido_venta = true) as ventas_logradas,
        ROUND(
          COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as tasa_conversion,
        SUM(valor_estimado) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as pipeline_activo,
        COUNT(*) FILTER (WHERE seguimiento_vencido = true) as seguimientos_vencidos,
        AVG(probabilidad_cierre) FILTER (WHERE estado IN ('Cotizado', 'Negociacion')) as probabilidad_promedio
      FROM prospectos 
      WHERE activo = true
        AND fecha_contacto::date BETWEEN $1 AND $2
        ${asesor_id ? 'AND asesor_id = $3' : ''}
      GROUP BY asesor_id, asesor_nombre
      ORDER BY tasa_conversion DESC, ventas_logradas DESC
    `;

    // Query 4: Análisis de productos más demandados
    const productosQuery = `
      SELECT 
        empresa as producto,
        COUNT(*) as frecuencia,
        AVG(valor_estimado / 3.7) as valor_promedio,
        COUNT(*) FILTER (WHERE convertido_venta = true) as conversiones_logradas,
        ROUND(
          COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as tasa_conversion_producto
      FROM prospectos
      WHERE activo = true
        AND fecha_contacto::date BETWEEN $1 AND $2
        ${asesor_id ? 'AND asesor_id = $3' : ''}
        AND empresa IS NOT NULL AND empresa != ''
      GROUP BY empresa
      HAVING COUNT(*) >= 2  -- Solo productos con mínimo 2 intereses
      ORDER BY tasa_conversion_producto DESC, frecuencia DESC
      LIMIT 10
    `;

    // Ejecutar queries con parámetros correctos
    const params = asesor_id ? [desde, hasta, asesor_id] : [desde, hasta];
    
    const [kpisResult, distribucionResult, performanceResult, productosResult] = await Promise.allSettled([
      db.query(kpisQuery, params),
      db.query(distribucionQuery, params),  
      db.query(performanceQuery, params),
      db.query(productosQuery, params)
    ]);

    // Extraer resultados con manejo seguro
    const kpis = kpisResult.status === 'fulfilled' ? kpisResult.value.rows[0] : {};
    const distribucion = distribucionResult.status === 'fulfilled' ? distribucionResult.value.rows : [];
    const performance = performanceResult.status === 'fulfilled' ? performanceResult.value.rows : [];
    const productos = productosResult.status === 'fulfilled' ? productosResult.value.rows : [];

    // Calcular métricas adicionales empresariales
    const totalProspectos = parseInt(kpis.total_prospectos || 0);
    
    // Agregar porcentajes a distribución
    distribucion.forEach(etapa => {
      etapa.porcentaje = totalProspectos > 0 ? 
        Math.round((etapa.cantidad / totalProspectos) * 100 * 100) / 100 : 0;
    });

    res.json({
      success: true,
      data: {
        periodo,
        fecha_consulta: { desde, hasta },
        asesor_filtro: asesor_id || 'todos',
        
        // KPIs principales optimizados
        kpis_principales: {
          ...kpis,
          eficiencia_seguimiento: kpis.seguimientos_vencidos > 0 ? 
            Math.round(((totalProspectos - kpis.seguimientos_vencidos) / totalProspectos) * 100) : 100
        },
        
        // Distribución con insights
        distribucion_etapas: distribucion,
        
        // Performance con rankings
        performance_asesores: performance,
        
        // Productos con mayor potencial
        productos_demandados: productos,
        
        // Alertas empresariales
        alertas: {
          seguimientos_criticos: kpis.seguimientos_vencidos || 0,
          oportunidades_hoy: kpis.seguimientos_hoy || 0,
          pipeline_en_riesgo: performance.filter(p => p.seguimientos_vencidos > 0).length
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

/**
 * Análisis de embudo - Tasas de conversión entre etapas
 */
const analisisEmbudo = async (req, res) => {
  try {
    const { asesor_id } = req.query;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    // Query embudo con flujo real de conversiones
    const embudoQuery = `
      WITH conversion_flow AS (
        SELECT 
          COUNT(*) FILTER (WHERE estado = 'Prospecto') as entrada_prospecto,
          COUNT(*) FILTER (WHERE estado IN ('Cotizado', 'Negociacion', 'Cerrado', 'Perdido')) as salida_prospecto,
          COUNT(*) FILTER (WHERE estado = 'Cotizado') as entrada_cotizado,
          COUNT(*) FILTER (WHERE estado IN ('Negociacion', 'Cerrado', 'Perdido')) as salida_cotizado,
          COUNT(*) FILTER (WHERE estado = 'Negociacion') as entrada_negociacion,
          COUNT(*) FILTER (WHERE estado IN ('Cerrado', 'Perdido')) as salida_negociacion,
          COUNT(*) FILTER (WHERE estado = 'Cerrado') as cerrados,
          COUNT(*) FILTER (WHERE estado = 'Perdido') as perdidos
        FROM prospectos 
        WHERE activo = true
          AND fecha_contacto::date BETWEEN $1 AND $2
          ${asesor_id ? 'AND asesor_id = $3' : ''}
      )
      SELECT 
        entrada_prospecto,
        salida_prospecto,
        CASE WHEN entrada_prospecto > 0 THEN 
          ROUND((salida_prospecto::decimal / entrada_prospecto) * 100, 2) 
        ELSE 0 END as conversion_prospecto_to_next,
        
        entrada_cotizado,
        salida_cotizado,
        CASE WHEN entrada_cotizado > 0 THEN 
          ROUND((salida_cotizado::decimal / entrada_cotizado) * 100, 2) 
        ELSE 0 END as conversion_cotizado_to_next,
        
        entrada_negociacion,
        salida_negociacion,
        CASE WHEN entrada_negociacion > 0 THEN 
          ROUND((salida_negociacion::decimal / entrada_negociacion) * 100, 2) 
        ELSE 0 END as conversion_negociacion_to_next,
        
        cerrados,
        perdidos,
        CASE WHEN (cerrados + perdidos) > 0 THEN 
          ROUND((cerrados::decimal / (cerrados + perdidos)) * 100, 2) 
        ELSE 0 END as win_rate
      FROM conversion_flow
    `;

    const params = asesor_id ? [desde, hasta, asesor_id] : [desde, hasta];
    const embudoResult = await db.query(embudoQuery, params);
    const embudo = embudoResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        periodo,
        fecha_consulta: { desde, hasta },
        embudo_conversiones: embudo,
        // Insights empresariales
        insights: {
          etapa_critica: embudo.conversion_prospecto_to_next < 50 ? 'Prospecto' : 
                        embudo.conversion_cotizado_to_next < 60 ? 'Cotizado' :
                        embudo.conversion_negociacion_to_next < 70 ? 'Negociación' : 'Ninguna',
          win_rate_status: embudo.win_rate >= 80 ? 'Excelente' : 
                          embudo.win_rate >= 60 ? 'Bueno' : 
                          embudo.win_rate >= 40 ? 'Regular' : 'Crítico'
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

/**
 * Seguimientos críticos con priorización empresarial
 */
const seguimientosCriticos = async (req, res) => {
  try {
    const { asesor_id } = req.query;

    const criticosQuery = `
      SELECT 
        id,
        codigo,
        nombre_cliente,
        apellido_cliente,
        empresa,
        telefono,
        email,
        estado,
        valor_estimado,
        probabilidad_cierre,
        asesor_nombre,
        seguimiento_obligatorio,
        seguimiento_vencido,
        
        -- Días de retraso
        CASE 
          WHEN seguimiento_vencido THEN 
            EXTRACT(days FROM (CURRENT_TIMESTAMP - seguimiento_obligatorio))
          ELSE 0 
        END as dias_retraso,
        
        -- Prioridad empresarial basada en valor y probabilidad
        CASE 
          WHEN valor_estimado >= 1000 AND probabilidad_cierre >= 70 THEN 'CRÍTICA'
          WHEN valor_estimado >= 500 AND probabilidad_cierre >= 50 THEN 'ALTA'  
          WHEN seguimiento_vencido THEN 'MEDIA'
          ELSE 'BAJA'
        END as prioridad,
        
        fecha_contacto,
        observaciones
        
      FROM prospectos 
      WHERE activo = true
        AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
        AND (
          seguimiento_vencido = true 
          OR seguimiento_obligatorio::date <= CURRENT_DATE + INTERVAL '3 days'
        )
        ${asesor_id ? 'AND asesor_id = $1' : ''}
      ORDER BY 
        CASE 
            WHEN valor_estimado >= 1000 AND probabilidad_cierre >= 70 THEN 1
            WHEN valor_estimado >= 500 AND probabilidad_cierre >= 50 THEN 2  
            WHEN seguimiento_vencido = true THEN 3
            ELSE 4
        END,
        valor_estimado DESC,
        seguimiento_obligatorio ASC
    `;

    const params = asesor_id ? [asesor_id] : [];
    const criticosResult = await db.query(criticosQuery, params);

    const seguimientos = criticosResult.rows.map(seguimiento => ({
      ...seguimiento,
      valor_estimado: parseFloat(seguimiento.valor_estimado || 0),
      probabilidad_cierre: parseInt(seguimiento.probabilidad_cierre || 0),
      dias_retraso: parseInt(seguimiento.dias_retraso || 0)
    }));

    // Métricas de seguimientos
    const metricas = {
      total: seguimientos.length,
      criticos: seguimientos.filter(s => s.prioridad === 'CRÍTICA').length,
      altos: seguimientos.filter(s => s.prioridad === 'ALTA').length,
      vencidos: seguimientos.filter(s => s.seguimiento_vencido).length,
      valor_total_en_riesgo: seguimientos.reduce((sum, s) => sum + s.valor_estimado, 0)
    };

    res.json({
      success: true,
      data: {
        seguimientos_criticos: seguimientos,
        metricas_seguimientos: metricas,
        recomendacion: metricas.criticos > 0 ? 
          'Atender inmediatamente seguimientos CRÍTICOS' : 
          'Mantener seguimiento regular de oportunidades'
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

/**
 * Proyección de ventas empresarial
 */
const proyeccionVentas = async (req, res) => {
  try {
    const { asesor_id } = req.query;

    // Query proyección basada en pipeline y probabilidades reales
    const proyeccionQuery = `
      WITH pipeline_probabilistico AS (
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
      conversion_historica AS (
        SELECT 
          ROUND(
            COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as tasa_conversion_historica,
          AVG(valor_estimado) FILTER (WHERE estado = 'Cerrado') as ticket_promedio_historico
        FROM prospectos 
        WHERE activo = true
          AND fecha_contacto >= CURRENT_DATE - INTERVAL '90 days'
          ${asesor_id ? 'AND asesor_id = $1' : ''}
      )
      SELECT 
        pp.*,
        ch.tasa_conversion_historica,
        ch.ticket_promedio_historico
      FROM pipeline_probabilistico pp
      CROSS JOIN conversion_historica ch
    `;

    const params = asesor_id ? [asesor_id] : [];
    const proyeccionResult = await db.query(proyeccionQuery, params);
    const datosProyeccion = proyeccionResult.rows;

    // Cálculos de proyección empresarial
    const totalPipelineValor = datosProyeccion.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0);
    const totalPipelinePonderado = datosProyeccion.reduce((sum, item) => sum + parseFloat(item.valor_ponderado || 0), 0);
    const tasaHistorica = parseFloat(datosProyeccion[0]?.tasa_conversion_historica || 0);

    const proyecciones = {
      pipeline_actual: {
        valor_total: totalPipelineValor,
        valor_ponderado: totalPipelinePonderado,
        cantidad_oportunidades: datosProyeccion.reduce((sum, item) => sum + parseInt(item.cantidad || 0), 0)
      },
      proyeccion_conservadora: {
        valor: Math.round(totalPipelineValor * (tasaHistorica / 100)),
        probabilidad: tasaHistorica
      },
      proyeccion_probabilistica: {
        valor: Math.round(totalPipelinePonderado),
        probabilidad: 'Variable por oportunidad'
      },
      escenarios: {
        optimista: Math.round(totalPipelineValor * 0.8),
        realista: Math.round(totalPipelinePonderado),
        conservador: Math.round(totalPipelineValor * (tasaHistorica / 100))
      }
    };

    res.json({
      success: true,
      data: {
        proyecciones,
        detalle_por_etapa: datosProyeccion,
        recomendaciones: {
          foco_principal: totalPipelinePonderado > 0 ? 'Acelerar cierre de Negociaciones' : 'Generar más Prospectos',
          accion_inmediata: datosProyeccion.find(d => d.estado === 'Negociacion')?.cantidad > 0 ? 
            'Revisar seguimientos en Negociación' : 'Incrementar actividad de prospección'
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

/**
 * Health check mejorado
 */
const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: 'Pipeline Controller v2.0 - Optimizado',
    endpoints: [
      '/dashboard - KPIs principales con insights empresariales',
      '/embudo - Análisis de conversión entre etapas', 
      '/proyeccion - Proyección probabilística de ventas',
      '/seguimientos-criticos - Alertas priorizadas por valor'
    ],
    optimizaciones: [
      'Queries específicos para tabla prospectos',
      'Cálculos basados en probabilidad_cierre',
      'Información de seguimientos',
      'Priorización empresarial por valor'
    ],
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  dashboardPipeline,
  analisisEmbudo,
  proyeccionVentas, 
  seguimientosCriticos,
  healthCheck
};