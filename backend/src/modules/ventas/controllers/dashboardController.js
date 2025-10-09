// ============================================
// DASHBOARD CONTROLLER - MÉTRICAS PERSONALES
// Sistema CRM/ERP v2.0 - Controller para dashboards individuales
// ============================================

const { query } = require('../../../config/database');

// Utilidad para obtener fechas por período
const obtenerFechasPorPeriodo = (periodo) => {
  const hoy = new Date();
  let desde, hasta;

  // Manejar formatos simples
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
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); // Último día del mes
      break;
    case 'trimestre_actual':
      const mesActual = hoy.getMonth();
      const inicioTrimestre = new Date(hoy.getFullYear(), Math.floor(mesActual / 3) * 3, 1);
      const finTrimestre = new Date(hoy.getFullYear(), Math.floor(mesActual / 3) * 3 + 3, 0);
      desde = inicioTrimestre;
      hasta = finTrimestre;
      break;
    case 'año_actual':
      desde = new Date(hoy.getFullYear(), 0, 1);
      hasta = new Date(hoy.getFullYear(), 11, 31);
      break;
    default:
      // Manejar formatos avanzados del nuevo selector
      if (periodo.startsWith('mes_')) {
        const mesInfo = periodo.split('_')[1];
        if (mesInfo.includes('-')) {
          const [año, mes] = mesInfo.split('-').map(Number);
          desde = new Date(año, mes - 1, 1);
          hasta = new Date(año, mes, 0); // Último día del mes
        }
      } else if (periodo.startsWith('trimestre_')) {
        const trimInfo = periodo.split('_')[1];
        if (trimInfo.includes('-')) {
          const [año, trimestre] = trimInfo.split('-').map(Number);
          const mesInicio = (trimestre - 1) * 3;
          desde = new Date(año, mesInicio, 1);
          hasta = new Date(año, mesInicio + 3, 0); // Último día del trimestre
        }
      } else if (periodo.startsWith('año_')) {
        const año = parseInt(periodo.split('_')[1]);
        desde = new Date(año, 0, 1);
        hasta = new Date(año, 11, 31);
      } else {
        // Fallback - mes actual
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      }
  }

  return { desde, hasta };
};

/**
 * Dashboard personal del asesor - KPIs principales (MEJORADO)
 */
const dashboardPersonal = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const { periodo = 'mes_actual' } = req.query;
    const { desde, hasta } = obtenerFechasPorPeriodo(periodo);

    const userId = req.user.id || req.user.user_id;
    const userRole = req.user.rol_id || req.user.role_id;
    const esJefe = req.user.es_jefe;
    const userVende = req.user.vende; // NUEVO: Campo para permisos de venta

    console.log(`📊 Dashboard personal - Asesor: ${asesor_id}, Usuario: ${userId}, Rol: ${userRole}, Vende: ${userVende}, Periodo: ${periodo}`);

    // ============================================
    // CONTROL DE ACCESO CON CAMPO 'VENDE'
    // ============================================
    const asesorIdNum = parseInt(asesor_id);
    const userIdNum = parseInt(userId);
    const isOwner = asesorIdNum === userIdNum;

    // Definir roles de supervisión con acceso empresarial
    const rolesSupervisores = [
      1,  // SUPER_ADMIN
      2,  // GERENTE
      3,  // JEFE_VENTAS
      4,  // JEFE_MARKETING
      5,  // JEFE_SOPORTE
      6,  // JEFE_ALMACEN
      11  // ADMIN
    ];
    const rolesAdministrativos = [1, 2, 11]; // SUPER_ADMIN, GERENTE, ADMIN

    const isSupervisor = rolesSupervisores.includes(userRole) || esJefe;
    const isAdmin = rolesAdministrativos.includes(userRole);

    // NUEVA LÓGICA: Control de acceso usando campo 'vende'
    // 1. Si es el propietario, debe tener vende=true para ver su propio dashboard
    // 2. Si es supervisor, puede ver cualquier dashboard de ventas
    if (isOwner && !userVende) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos de venta para acceder al dashboard personal',
        codigo: 'NO_SALES_PERMISSION',
        suggestion: 'Contacta a tu administrador para habilitar permisos de venta'
      });
    }

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Sin permisos para ver el dashboard de este asesor',
        codigo: 'ACCESS_DENIED'
      });
    }

    // Verificar que el asesor existe, está activo y tiene permisos de venta
    const asesorInfo = await query(`
      SELECT id, nombre, apellido, rol_id, es_jefe, activo, area_id, vende
      FROM usuarios
      WHERE id = $1 AND activo = true
    `, [asesor_id]);

    if (asesorInfo.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asesor no encontrado o inactivo'
      });
    }

    const asesor = asesorInfo.rows[0];

    // VALIDACIÓN: El asesor objetivo debe tener permisos de venta
    if (!asesor.vende) {
      return res.status(400).json({
        success: false,
        message: `El usuario ${asesor.nombre} ${asesor.apellido} no tiene permisos de venta`,
        codigo: 'TARGET_NO_SALES_PERMISSION',
        suggestion: 'Solo usuarios con permisos de venta pueden tener dashboard personal'
      });
    }

    // ============================================
    // QUERIES MEJORADAS CON MÁS MÉTRICAS
    // ============================================

    // Query principal para KPIs expandidos
    const queryActual = `
      SELECT
        COUNT(*) as ventas_completadas,
        COALESCE(SUM(valor_final), 0) as valor_total_completadas,
        COALESCE(AVG(valor_final), 0) as promedio_venta,
        -- COALESCE(SUM(monto_usd), 0) as valor_total_usd, -- Campo siempre null, removido
        COUNT(DISTINCT CASE WHEN cliente_empresa IS NOT NULL THEN cliente_empresa END) as clientes_unicos,
        COUNT(DISTINCT ciudad) as ciudades_atendidas,
        COUNT(CASE WHEN UPPER(canal_contacto) = 'WHATSAPP' THEN 1 END) as ventas_whatsapp,
        COUNT(CASE WHEN UPPER(canal_contacto) IN ('LLAMADA', 'MESSENGER', 'FACEBOOK') THEN 1 END) as ventas_llamada,
        COUNT(CASE WHEN UPPER(canal_contacto) = 'TIKTOK' OR es_venta_presencial = true THEN 1 END) as ventas_presenciales,
        MIN(CASE WHEN valor_final > 0 THEN valor_final END) as venta_minima,
        MAX(valor_final) as venta_maxima,
        COALESCE(AVG(tiempo_conversion_dias), 0) as promedio_tiempo_conversion
      FROM ventas
      WHERE asesor_id = $1
        AND estado_detallado = 'vendido'
        AND fecha_venta >= $2
        AND fecha_venta <= $3
        AND activo = true
    `;

    // PIPELINE: Prospectos y ventas del período seleccionado
    const queryPipeline = `
      SELECT
        -- OPORTUNIDADES TOTALES DEL MES (Arrastrados + Nuevos)
        -- Incluye: prospectos activos al inicio + nuevos del mes + convertidos en el mes
        -- Excluye: solo los perdidos ANTES del mes
        (
          SELECT COUNT(*)
          FROM prospectos
          WHERE asesor_id = $1
            AND activo = true
            AND (
              -- Prospectos creados DURANTE el período
              (created_at >= $2 AND created_at <= $3)
              OR
              -- Prospectos creados ANTES del período que seguían vivos
              (
                created_at < $2
                AND (
                  -- Siguen activos
                  estado IN ('Prospecto', 'Cotizado', 'Negociacion')
                  OR
                  -- Se cerraron o perdieron EN el período (contaban como oportunidad hasta ese momento)
                  (
                    estado IN ('Cerrado', 'Perdido')
                    AND fecha_ultima_actualizacion >= $2
                    AND fecha_ultima_actualizacion <= $3
                  )
                )
              )
            )
        ) as total_oportunidades,
        -- Ventas cerradas que PROVIENEN de prospectos (conversión real del pipeline)
        (
          SELECT COUNT(*)
          FROM ventas
          WHERE asesor_id = $1
          AND estado_detallado = 'vendido'
          AND prospecto_id IS NOT NULL
          AND fecha_venta >= $2
          AND fecha_venta <= $3
          AND activo = true
        ) as cerradas_ganadas,
        -- Pipeline activo (prospectos activos sin importar fecha)
        (
          SELECT COUNT(*)
          FROM prospectos
          WHERE asesor_id = $1
          AND estado IN ('Cotizado', 'Negociacion', 'Prospecto')
          AND activo = true
        ) as activas_pipeline,
        -- Oportunidades perdidas en el período
        (
          SELECT COUNT(*)
          FROM prospectos
          WHERE asesor_id = $1
          AND estado = 'Perdido'
          AND fecha_ultima_actualizacion >= $2
          AND fecha_ultima_actualizacion <= $3
          AND activo = true
        ) as cerradas_perdidas,
        -- Valor de ventas cerradas
        (
          SELECT COALESCE(SUM(valor_final), 0)
          FROM ventas
          WHERE asesor_id = $1
          AND estado_detallado = 'vendido'
          AND fecha_venta >= $2
          AND fecha_venta <= $3
          AND activo = true
        ) as valor_cerradas_ganadas,
        -- Valor del pipeline activo
        (
          SELECT COALESCE(SUM(valor_estimado), 0)
          FROM prospectos
          WHERE asesor_id = $1
          AND estado IN ('Cotizado', 'Negociacion', 'Prospecto')
          AND activo = true
        ) as valor_pipeline_activo
    `;

    // Query para metas del período (CON CÁLCULO REAL)
    const queryMetas = `
      SELECT
        mv.meta_valor,
        COALESCE(ventas_reales.valor_real, 0) as valor_logrado,
        mv.meta_cantidad,
        COALESCE(ventas_reales.cantidad_real, 0) as ventas_logradas,
        CASE WHEN mv.meta_valor > 0
          THEN (COALESCE(ventas_reales.valor_real, 0) / mv.meta_valor * 100)::numeric(10,2)
          ELSE 0
        END as porcentaje_cumplimiento
      FROM metas_ventas mv
      LEFT JOIN (
        SELECT
          asesor_id,
          COUNT(*) as cantidad_real,
          SUM(valor_final) as valor_real
        FROM ventas
        WHERE asesor_id = $1
          AND estado_detallado = 'vendido'
          AND EXTRACT(YEAR FROM fecha_venta) = $2
          AND EXTRACT(MONTH FROM fecha_venta) = $3
          AND activo = true
        GROUP BY asesor_id
      ) ventas_reales ON mv.asesor_id = ventas_reales.asesor_id
      WHERE mv.asesor_id = $1
        AND mv.año = $2
        AND mv.mes = $3
        AND mv.activo = true
    `;

    // Query para actividad diaria
    const queryActividad = `
      SELECT
        COALESCE(SUM(total_mensajes_recibidos), 0) as total_mensajes,
        COALESCE(SUM(total_llamadas), 0) as total_llamadas,
        COUNT(*) as dias_activos,
        COALESCE(AVG(total_mensajes_recibidos), 0) as promedio_mensajes_dia,
        COALESCE(AVG(total_llamadas), 0) as promedio_llamadas_dia,
        MAX(total_mensajes_recibidos) as max_mensajes_dia,
        MAX(total_llamadas) as max_llamadas_dia
      FROM actividad_diaria
      WHERE usuario_id = $1
        AND fecha >= $2
        AND fecha <= $3
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

    // ============================================
    // EJECUTAR QUERIES EN PARALELO
    // ============================================
    const añoActual = desde.getFullYear();
    const mesActual = desde.getMonth() + 1;

    const [resultadoActual, resultadoAnterior, resultadoPipeline, resultadoMetas, resultadoActividad] = await Promise.all([
      query(queryActual, [asesor_id, desde.toISOString().split('T')[0], hasta.toISOString().split('T')[0]]),
      query(queryAnterior, [asesor_id, desdeAnterior.toISOString().split('T')[0], hastaAnterior.toISOString().split('T')[0]]),
      query(queryPipeline, [asesor_id, desde.toISOString().split('T')[0], hasta.toISOString().split('T')[0]]),
      query(queryMetas, [asesor_id, añoActual, mesActual]),
      query(queryActividad, [asesor_id, desde.toISOString().split('T')[0], hasta.toISOString().split('T')[0]])
    ]);

    const metricas = resultadoActual.rows[0];
    const metricasAnteriores = resultadoAnterior.rows[0];
    const pipeline = resultadoPipeline.rows[0];
    const metas = resultadoMetas.rows[0] || {};
    const actividad = resultadoActividad.rows[0];

    // Calcular tendencias
    const calcularTendencia = (actual, anterior) => {
      if (!anterior || parseFloat(anterior) === 0) return 0;
      return (((parseFloat(actual) - parseFloat(anterior)) / parseFloat(anterior)) * 100).toFixed(1);
    };

    // Calcular tasa de conversión del pipeline (modelo acumulativo)
    // Oportunidades = Arrastrados del mes anterior + Nuevos del mes (incluyendo los que se convirtieron)
    // Ventas = Solo las que tienen prospecto_id (conversión real del pipeline)
    // Fórmula: (Ventas del período / Oportunidades totales disponibles) × 100
    const tasaConversion = pipeline.total_oportunidades > 0 ?
      ((pipeline.cerradas_ganadas / pipeline.total_oportunidades) * 100).toFixed(2) : 0;

    const diasTranscurridos = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24));
    const proyeccionMes = metricas.valor_total_completadas > 0 ?
      (metricas.valor_total_completadas / diasTranscurridos * 30).toFixed(2) : 0;

    // ============================================
    // RESPUESTA MEJORADA CON INFORMACIÓN COMPLETA
    // ============================================
    const respuesta = {
      success: true,
      data: {
        // Información del contexto
        asesor: {
          id: asesor.id,
          nombre: `${asesor.nombre} ${asesor.apellido}`,
          rol_id: asesor.rol_id,
          es_jefe: asesor.es_jefe
        },
        usuario_consulta: {
          id: userId,
          es_propietario: isOwner,
          es_supervisor: isSupervisor,
          puede_ver_otros: isSupervisor
        },
        periodo: {
          tipo: periodo,
          desde: desde.toISOString().split('T')[0],
          hasta: hasta.toISOString().split('T')[0],
          dias_transcurridos: diasTranscurridos
        },

        // KPIs principales
        ventas: {
          completadas: parseInt(metricas.ventas_completadas) || 0,
          valor_total: parseFloat(metricas.valor_total_completadas) || 0,
          promedio_venta: parseFloat(metricas.promedio_venta) || 0,
          venta_minima: parseFloat(metricas.venta_minima) || 0,
          venta_maxima: parseFloat(metricas.venta_maxima) || 0,
          tiempo_promedio_conversion: parseFloat(metricas.promedio_tiempo_conversion) || 0
        },

        // Información de clientes y mercado
        mercado: {
          clientes_unicos: parseInt(metricas.clientes_unicos) || 0,
          ciudades_atendidas: parseInt(metricas.ciudades_atendidas) || 0
        },

        // Canales de venta
        canales: {
          whatsapp: parseInt(metricas.ventas_whatsapp) || 0,
          llamadas: parseInt(metricas.ventas_llamada) || 0,
          presenciales: parseInt(metricas.ventas_presenciales) || 0
        },

        // Pipeline y conversión
        pipeline: {
          total_oportunidades: parseInt(pipeline.total_oportunidades) || 0,
          cerradas_ganadas: parseInt(pipeline.cerradas_ganadas) || 0,
          activas_pipeline: parseInt(pipeline.activas_pipeline) || 0,
          cerradas_perdidas: parseInt(pipeline.cerradas_perdidas) || 0,
          valor_pipeline_activo: parseFloat(pipeline.valor_pipeline_activo) || 0,
          tasa_conversion: parseFloat(tasaConversion)
        },

        // Metas (si existen)
        metas: {
          meta_valor: parseFloat(metas.meta_valor) || 0,
          valor_logrado: parseFloat(metas.valor_logrado) || 0,
          meta_cantidad: parseInt(metas.meta_cantidad) || 0,
          ventas_logradas: parseInt(metas.ventas_logradas) || 0,
          porcentaje_cumplimiento: parseFloat(metas.porcentaje_cumplimiento) || 0
        },

        // Actividad diaria
        actividad: {
          total_mensajes: parseInt(actividad.total_mensajes) || 0,
          total_llamadas: parseInt(actividad.total_llamadas) || 0,
          dias_activos: parseInt(actividad.dias_activos) || 0,
          promedio_mensajes_dia: parseFloat(actividad.promedio_mensajes_dia) || 0,
          promedio_llamadas_dia: parseFloat(actividad.promedio_llamadas_dia) || 0,
          max_mensajes_dia: parseInt(actividad.max_mensajes_dia) || 0,
          max_llamadas_dia: parseInt(actividad.max_llamadas_dia) || 0
        },

        // Tendencias vs período anterior
        tendencias: {
          ventas_completadas: calcularTendencia(metricas.ventas_completadas, metricasAnteriores.ventas_completadas_anterior),
          valor_total_completadas: calcularTendencia(metricas.valor_total_completadas, metricasAnteriores.valor_total_completadas_anterior),
          promedio_venta: calcularTendencia(metricas.promedio_venta, metricasAnteriores.promedio_venta_anterior)
        },

        // Proyecciones e insights
        insights: {
          proyeccion_mes: parseFloat(proyeccionMes),
          ritmo_diario_necesario: metas.meta_valor > 0 && diasTranscurridos < 30 ?
            ((metas.meta_valor - (metas.valor_logrado || 0)) / (30 - diasTranscurridos)).toFixed(2) : 0,
          eficiencia_mensajes: metricas.ventas_completadas > 0 ?
            (actividad.total_mensajes / metricas.ventas_completadas).toFixed(2) : 0,
          eficiencia_llamadas: metricas.ventas_completadas > 0 ?
            (actividad.total_llamadas / metricas.ventas_completadas).toFixed(2) : 0
        }
      }
    };

    console.log(`✅ Dashboard personal mejorado - ${asesor.nombre} ${asesor.apellido}: ${metricas.ventas_completadas} ventas, ${pipeline.activas_pipeline} activas`);
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

/**
 * Listar asesores disponibles para supervisores
 */
const listarAsesoresDisponibles = async (req, res) => {
  try {
    const userId = req.user.id || req.user.user_id;
    const userRole = req.user.rol_id || req.user.role_id;
    const esJefe = req.user.es_jefe;

    console.log(`📋 Solicitando lista de asesores - Usuario: ${userId}, Rol: ${userRole}`);

    // Verificar permisos de supervisor con roles explícitos
    const rolesSupervisores = [
      1,  // SUPER_ADMIN
      2,  // GERENTE
      3,  // JEFE_VENTAS
      4,  // JEFE_MARKETING
      5,  // JEFE_SOPORTE
      6,  // JEFE_ALMACEN
      11  // ADMIN
    ];
    const isSupervisor = rolesSupervisores.includes(userRole) || esJefe;

    if (!isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Sin permisos para ver lista de asesores',
        codigo: 'ACCESS_DENIED'
      });
    }

    // Obtener lista de asesores activos con métricas básicas
    const asesoresResult = await query(`
      SELECT
        u.id,
        u.nombre,
        u.apellido,
        u.rol_id,
        u.es_jefe,
        u.area_id,
        u.ultimo_login,

        -- Métricas del mes actual
        COALESCE(SUM(v.valor_final), 0) as ventas_mes_actual,
        COUNT(v.id) as total_ventas_mes,
        COALESCE(AVG(v.valor_final), 0) as ticket_promedio,

        -- Última actividad
        MAX(v.fecha_venta) as ultima_venta,

        -- Metas si existen
        mv.meta_valor,
        mv.valor_logrado,
        ROUND((mv.valor_logrado::numeric / NULLIF(mv.meta_valor, 0)::numeric) * 100, 2) as porcentaje_meta

      FROM usuarios u
      LEFT JOIN ventas v ON u.id = v.asesor_id
        AND v.estado_detallado = 'vendido'
        AND v.fecha_venta >= date_trunc('month', CURRENT_DATE)
        AND v.activo = true
      LEFT JOIN metas_ventas mv ON u.id = mv.asesor_id
        AND mv.año = EXTRACT(YEAR FROM CURRENT_DATE)
        AND mv.mes = EXTRACT(MONTH FROM CURRENT_DATE)
        AND mv.activo = true
      WHERE u.activo = true
        AND u.rol_id = 7  -- Solo VENDEDOR(7) para el módulo de ventas
      GROUP BY u.id, u.nombre, u.apellido, u.rol_id, u.es_jefe, u.area_id,
               u.ultimo_login, mv.meta_valor, mv.valor_logrado
      ORDER BY
        u.es_jefe DESC,
        COALESCE(SUM(v.valor_final), 0) DESC,
        u.nombre ASC
    `);

    // Obtener información de áreas si existe tabla áreas
    let areas = [];
    try {
      const areasResult = await query(`
        SELECT DISTINCT area_id, 'Área ' || area_id as nombre_area
        FROM usuarios
        WHERE area_id IS NOT NULL AND activo = true
      `);
      areas = areasResult.rows;
    } catch (areaError) {
      console.log('Tabla de áreas no encontrada, continuando sin información de áreas');
    }

    const asesores = asesoresResult.rows.map(asesor => ({
      id: asesor.id,
      nombre: asesor.nombre,
      apellido: asesor.apellido,
      nombre_completo: `${asesor.nombre} ${asesor.apellido}`,
      rol_id: asesor.rol_id,
      es_jefe: asesor.es_jefe,
      area_id: asesor.area_id,
      tipo: asesor.es_jefe ? 'Supervisor' : 'Asesor',

      // Estado de actividad
      ultimo_login: asesor.ultimo_login,
      dias_sin_login: asesor.ultimo_login ?
        Math.floor((new Date() - new Date(asesor.ultimo_login)) / (1000 * 60 * 60 * 24)) : null,

      // Métricas del mes
      metricas_mes: {
        ventas_valor: parseFloat(asesor.ventas_mes_actual) || 0,
        total_ventas: parseInt(asesor.total_ventas_mes) || 0,
        ticket_promedio: parseFloat(asesor.ticket_promedio) || 0,
        ultima_venta: asesor.ultima_venta
      },

      // Metas
      metas: {
        meta_valor: parseFloat(asesor.meta_valor) || 0,
        valor_logrado: parseFloat(asesor.valor_logrado) || 0,
        porcentaje_cumplimiento: parseFloat(asesor.porcentaje_meta) || 0
      },

      // Indicadores de estado
      estado: {
        tiene_ventas: (asesor.total_ventas_mes > 0),
        tiene_metas: (asesor.meta_valor > 0),
        cumpliendo_meta: (parseFloat(asesor.porcentaje_meta) || 0) >= 80,
        activo_reciente: asesor.ultimo_login &&
          (new Date() - new Date(asesor.ultimo_login)) < (7 * 24 * 60 * 60 * 1000) // 7 días
      }
    }));

    // Estadísticas generales
    const estadisticas = {
      total_asesores: asesores.length,
      supervisores: asesores.filter(a => a.es_jefe).length,
      asesores_regulares: asesores.filter(a => !a.es_jefe).length,
      con_ventas_mes: asesores.filter(a => a.metricas_mes.total_ventas > 0).length,
      cumpliendo_metas: asesores.filter(a => a.estado.cumpliendo_meta).length,
      activos_recientes: asesores.filter(a => a.estado.activo_reciente).length
    };

    console.log(`✅ Lista de asesores generada: ${asesores.length} usuarios encontrados`);

    res.json({
      success: true,
      data: {
        asesores,
        areas: areas.length > 0 ? areas : null,
        estadisticas,
        usuario_consulta: {
          id: userId,
          es_supervisor: isSupervisor,
          puede_ver_todos: true
        },
        filtros_sugeridos: [
          { key: 'todos', label: 'Todos los asesores', count: asesores.length },
          { key: 'supervisores', label: 'Solo supervisores', count: estadisticas.supervisores },
          { key: 'asesores', label: 'Solo asesores', count: estadisticas.asesores_regulares },
          { key: 'con_ventas', label: 'Con ventas este mes', count: estadisticas.con_ventas_mes },
          { key: 'cumpliendo_metas', label: 'Cumpliendo metas', count: estadisticas.cumpliendo_metas }
        ]
      },
      message: `${asesores.length} asesores disponibles para supervisión`
    });

  } catch (error) {
    console.error('❌ Error listando asesores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener períodos disponibles con datos para el selector dinámico
 */
const obtenerPeriodosDisponibles = async (req, res) => {
  try {
    const { asesor_id } = req.params;
    const userId = req.user.id || req.user.user_id;
    const userRole = req.user.rol_id || req.user.role_id;

    console.log(`📅 Obteniendo períodos disponibles para asesor: ${asesor_id}`);

    // Validar permisos (similar a dashboardPersonal)
    const asesorIdNum = parseInt(asesor_id);
    const userIdNum = parseInt(userId);
    const isOwner = asesorIdNum === userIdNum;
    const rolesSupervisores = [1, 2, 3, 4, 5, 6, 11];
    const isSupervisor = rolesSupervisores.includes(userRole);

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Sin permisos para ver datos de este asesor'
      });
    }

    // Query para obtener todos los períodos con datos
    const queryPeriodos = `
      SELECT
        EXTRACT(YEAR FROM fecha_venta) as año,
        EXTRACT(MONTH FROM fecha_venta) as mes,
        EXTRACT(QUARTER FROM fecha_venta) as trimestre,
        DATE_TRUNC('week', fecha_venta) as semana_inicio,
        COUNT(*) as total_ventas,
        SUM(valor_final) as total_valor,
        MIN(fecha_venta) as primera_venta,
        MAX(fecha_venta) as ultima_venta
      FROM ventas
      WHERE asesor_id = $1
        AND activo = true
        AND estado_detallado = 'vendido'
        AND fecha_venta IS NOT NULL
      GROUP BY año, mes, trimestre, DATE_TRUNC('week', fecha_venta)
      ORDER BY año DESC, mes DESC, semana_inicio DESC
    `;

    const resultado = await query(queryPeriodos, [asesor_id]);
    const datos = resultado.rows;

    // Procesar datos para cada tipo de período
    const periodos = {
      semanas: [],
      meses: [],
      trimestres: [],
      años: []
    };

    // Obtener fecha actual para comparaciones
    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const trimestreActual = Math.floor((hoy.getMonth()) / 3) + 1;

    // Agrupar por años
    const años = [...new Set(datos.map(d => parseInt(d.año)))];
    años.forEach(año => {
      const ventasAño = datos.filter(d => parseInt(d.año) === año);
      const totalVentas = ventasAño.reduce((sum, v) => sum + parseInt(v.total_ventas), 0);
      const totalValor = ventasAño.reduce((sum, v) => sum + parseFloat(v.total_valor), 0);

      periodos.años.push({
        value: año.toString(),
        label: año === añoActual ? `${año} (Actual)` : año.toString(),
        estadisticas: `${totalVentas} ventas`,
        esActual: año === añoActual,
        totalVentas,
        totalValor
      });
    });

    // Agrupar por trimestres (solo del año actual y anterior)
    const trimestres = [...new Set(datos
      .filter(d => parseInt(d.año) >= añoActual - 1)
      .map(d => `${d.año}-Q${d.trimestre}`))];

    trimestres.forEach(trimestre => {
      const [año, q] = trimestre.split('-Q');
      const ventasTrimestre = datos.filter(d =>
        parseInt(d.año) === parseInt(año) && parseInt(d.trimestre) === parseInt(q)
      );
      const totalVentas = ventasTrimestre.reduce((sum, v) => sum + parseInt(v.total_ventas), 0);

      const mesesTrimestre = {
        1: 'Ene-Mar',
        2: 'Abr-Jun',
        3: 'Jul-Sep',
        4: 'Oct-Dic'
      };

      const esActual = parseInt(año) === añoActual && parseInt(q) === trimestreActual;

      periodos.trimestres.push({
        value: trimestre,
        label: `Q${q} ${año} (${mesesTrimestre[q]})${esActual ? ' - Actual' : ''}`,
        estadisticas: `${totalVentas} ventas`,
        esActual,
        totalVentas
      });
    });

    // Agrupar por meses (últimos 12 meses con datos)
    const meses = [...new Set(datos
      .filter(d => {
        const fechaVenta = new Date(parseInt(d.año), parseInt(d.mes) - 1);
        const hace12Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 12);
        return fechaVenta >= hace12Meses;
      })
      .map(d => `${d.año}-${String(d.mes).padStart(2, '0')}`))];

    meses.forEach(mes => {
      const [año, m] = mes.split('-');
      const ventasMes = datos.filter(d =>
        parseInt(d.año) === parseInt(año) && parseInt(d.mes) === parseInt(m)
      );
      const totalVentas = ventasMes.reduce((sum, v) => sum + parseInt(v.total_ventas), 0);

      const fechaMes = new Date(parseInt(año), parseInt(m) - 1);
      const nombreMes = fechaMes.toLocaleDateString('es', { month: 'long', year: 'numeric' });
      const esActual = parseInt(año) === añoActual && parseInt(m) === mesActual;

      periodos.meses.push({
        value: mes,
        label: `${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}${esActual ? ' (Actual)' : ''}`,
        estadisticas: `${totalVentas} ventas`,
        esActual,
        totalVentas
      });
    });

    // Semana actual (siempre disponible)
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);

    periodos.semanas.push({
      value: 'semana_actual',
      label: `Semana actual (${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1} - ${finSemana.getDate()}/${finSemana.getMonth() + 1})`,
      estadisticas: 'Siempre disponible',
      esActual: true
    });

    // Determinar período por defecto
    let periodoDefecto = {
      tipo: 'semana',
      value: 'semana_actual'
    };

    // Si hay datos del mes actual, usar mes actual
    if (periodos.meses.some(m => m.esActual && m.totalVentas > 0)) {
      periodoDefecto = {
        tipo: 'mes',
        value: `${añoActual}-${String(mesActual).padStart(2, '0')}`
      };
    }

    res.json({
      success: true,
      data: {
        periodos,
        defecto: periodoDefecto,
        estadisticas: {
          total_registros: datos.length,
          primer_venta: datos.length > 0 ? datos[datos.length - 1].primera_venta : null,
          ultima_venta: datos.length > 0 ? datos[0].ultima_venta : null
        }
      },
      message: `Períodos disponibles cargados para asesor ${asesor_id}`
    });

  } catch (error) {
    console.error('❌ Error obteniendo períodos disponibles:', error);
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
  rankingAsesor,
  listarAsesoresDisponibles,
  obtenerPeriodosDisponibles
};

module.exports = DashboardController;

console.log('Dashboard Personal Controller loaded - Sistema de métricas individuales');
console.log('Métodos disponibles: dashboardPersonal, geografiaPorAsesor, sectoresPorAsesor, evolucionPorAsesor, rankingAsesor');