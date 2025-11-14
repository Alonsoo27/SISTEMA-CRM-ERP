// dashboardEjecutivoController.js - VERSIÓN CORREGIDA
// Ubicación: backend/src/modules/ventas/controllers/dashboardEjecutivoController.js

const db = require('../../../config/database');

// Función auxiliar para obtener fechas según período
const obtenerFechasPeriodo = (periodo) => {
  const hoy = new Date();
  let fechaInicio, fechaFin;

  // Manejar períodos específicos (mes_2025-09, trimestre_2025-Q3, año_2025)
  if (periodo.startsWith('mes_') && periodo.includes('-')) {
    const [year, month] = periodo.replace('mes_', '').split('-');
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Validar que year y month sean números válidos
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12 || yearNum < 2000 || yearNum > 2100) {
      console.warn(`⚠️ Período inválido recibido: ${periodo}, usando mes_actual como fallback`);
      // Usar mes actual como fallback
      fechaInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      fechaFin = new Date().toISOString().split('T')[0];
    } else {
      fechaInicio = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
      fechaFin = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
    }
  } else if (periodo.startsWith('trimestre_') && periodo.includes('-Q')) {
    const [year, quarter] = periodo.replace('trimestre_', '').split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(quarter);

    // Validar números
    if (isNaN(yearNum) || isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4 || yearNum < 2000 || yearNum > 2100) {
      console.warn(`⚠️ Trimestre inválido recibido: ${periodo}, usando trimestre_actual como fallback`);
      const mesActual = new Date().getMonth();
      const trimestreInicio = Math.floor(mesActual / 3) * 3;
      fechaInicio = new Date(new Date().getFullYear(), trimestreInicio, 1).toISOString().split('T')[0];
      fechaFin = new Date().toISOString().split('T')[0];
    } else {
      const mesInicio = (quarterNum - 1) * 3;
      fechaInicio = new Date(yearNum, mesInicio, 1).toISOString().split('T')[0];
      fechaFin = new Date(yearNum, mesInicio + 3, 0).toISOString().split('T')[0];
    }
  } else if (periodo.startsWith('año_') && /^\d{4}$/.test(periodo.replace('año_', ''))) {
    const year = periodo.replace('año_', '');
    const yearNum = parseInt(year);

    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      console.warn(`⚠️ Año inválido recibido: ${periodo}, usando año_actual como fallback`);
      fechaInicio = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      fechaFin = new Date().toISOString().split('T')[0];
    } else {
      fechaInicio = new Date(yearNum, 0, 1).toISOString().split('T')[0];
      fechaFin = new Date(yearNum, 11, 31).toISOString().split('T')[0];
    }
  } else {
    // Períodos predeterminados
    switch (periodo) {
      case 'hoy':
        fechaInicio = fechaFin = hoy.toISOString().split('T')[0];
        break;
      case 'semana_actual':
        const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
        fechaInicio = inicioSemana.toISOString().split('T')[0];
        fechaFin = new Date().toISOString().split('T')[0];
        break;
      case 'trimestre_actual':
        const mesActual = new Date().getMonth();
        const trimestreInicio = Math.floor(mesActual / 3) * 3;
        fechaInicio = new Date(new Date().getFullYear(), trimestreInicio, 1).toISOString().split('T')[0];
        fechaFin = new Date().toISOString().split('T')[0];
        break;
      case 'año_actual':
        fechaInicio = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        fechaFin = new Date().toISOString().split('T')[0];
        break;
      case 'mes_actual':
      default:
        fechaInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        fechaFin = new Date().toISOString().split('T')[0];
        break;
    }
  }

  return { fechaInicio, fechaFin };
};

// ✅ FIX: Función auxiliar para extraer año y mes del parámetro período
const extraerAñoMesDePeriodo = (periodo) => {
  const hoy = new Date();

  // Formato: mes_2025-09
  if (periodo.startsWith('mes_') && periodo.includes('-')) {
    const [year, month] = periodo.replace('mes_', '').split('-');
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (!isNaN(yearNum) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      return { año: yearNum, mes: monthNum };
    }
  }

  // Formato: trimestre_2025-Q3 (tomar el último mes del trimestre)
  if (periodo.startsWith('trimestre_') && periodo.includes('-Q')) {
    const [year, quarter] = periodo.replace('trimestre_', '').split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(quarter);

    if (!isNaN(yearNum) && !isNaN(quarterNum) && quarterNum >= 1 && quarterNum <= 4) {
      const ultimoMesTrimestre = quarterNum * 3; // Q1=3, Q2=6, Q3=9, Q4=12
      return { año: yearNum, mes: ultimoMesTrimestre };
    }
  }

  // Formato: año_2025 (tomar diciembre)
  if (periodo.startsWith('año_') && /^\d{4}$/.test(periodo.replace('año_', ''))) {
    const yearNum = parseInt(periodo.replace('año_', ''));
    if (!isNaN(yearNum)) {
      return { año: yearNum, mes: 12 };
    }
  }

  // Períodos predeterminados
  switch (periodo) {
    case 'hoy':
    case 'semana_actual':
    case 'mes_actual':
    default:
      return { año: hoy.getFullYear(), mes: hoy.getMonth() + 1 };

    case 'trimestre_actual':
      const mesActual = hoy.getMonth() + 1;
      const ultimoMesTrimestre = Math.ceil(mesActual / 3) * 3;
      return { año: hoy.getFullYear(), mes: ultimoMesTrimestre };

    case 'año_actual':
      return { año: hoy.getFullYear(), mes: 12 };
  }
};

// Función auxiliar para cálculos seguros de porcentajes
const calcularPorcentajeSafe = (parte, total) => {
  if (!total || total === 0) return 0;
  return Math.round((parte / total) * 100 * 100) / 100; // Redondeo manual
};

// 1. VISTA UNIFICADA - VERSIÓN CORREGIDA
const vistaUnificada = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes_actual';
    const { fechaInicio, fechaFin } = obtenerFechasPeriodo(periodo);
    
    console.log(`[Vista Unificada] Consultando período: ${periodo} (${fechaInicio} - ${fechaFin})`);

    // Query 1: KPIs generales (simplificado y robusto)
    const kpisGeneralesQuery = `
      SELECT 
        COUNT(*) as total_ventas,
        COUNT(DISTINCT asesor_id) as asesores_activos,
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        COUNT(DISTINCT ciudad) as ciudades_cubiertas,
        COUNT(DISTINCT canal_contacto) as canales_activos
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
    `;

    // Query 2: TOP asesores por ventas (con nombres)
    const topAsesorVentasQuery = `
      SELECT
        v.asesor_id,
        CONCAT(u.nombre, ' ', u.apellido) as nombre_asesor,
        COUNT(*) as ventas,
        COALESCE(SUM(v.valor_final), 0) as ingresos,
        COALESCE(AVG(v.valor_final), 0) as ticket_promedio
      FROM ventas v
      INNER JOIN usuarios u ON v.asesor_id = u.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY v.asesor_id, u.nombre, u.apellido
      ORDER BY ventas DESC
      LIMIT 3
    `;

    // Query 3: TOP asesores por ingresos (con nombres)
    const topAsesorIngresosQuery = `
      SELECT
        v.asesor_id,
        CONCAT(u.nombre, ' ', u.apellido) as nombre_asesor,
        COALESCE(SUM(v.valor_final), 0) as ingresos,
        COUNT(*) as ventas,
        COALESCE(AVG(v.valor_final), 0) as ticket_promedio
      FROM ventas v
      INNER JOIN usuarios u ON v.asesor_id = u.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY v.asesor_id, u.nombre, u.apellido
      ORDER BY ingresos DESC
      LIMIT 3
    `;

    // Query 4: Distribución por canal
    const distributionCanalQuery = `
      SELECT 
        canal_contacto,
        COUNT(*) as ventas,
        COALESCE(SUM(valor_final), 0) as ingresos,
        COALESCE(AVG(valor_final), 0) as ticket_promedio
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY canal_contacto
      ORDER BY ventas DESC
    `;

    // Query 5: Tendencias (simplificado)
    const tendenciasQuery = `
      SELECT 
        fecha_venta,
        COUNT(*) as ventas_dia,
        COALESCE(SUM(valor_final), 0) as ingresos_dia,
        COALESCE(AVG(valor_final), 0) as ticket_promedio_dia
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta >= CURRENT_DATE - INTERVAL '15 days'
      GROUP BY fecha_venta
      ORDER BY fecha_venta DESC
      LIMIT 15
    `;

    // Query 6: Tipos de venta
    const tiposVentaQuery = `
      SELECT 
        tipo_venta,
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_final), 0) as ingresos,
        COALESCE(AVG(valor_final), 0) as ticket_promedio
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY tipo_venta
      ORDER BY cantidad DESC
    `;

    // ============================================
    // NUEVAS QUERIES PARA INTELLIGENCE AVANZADO
    // ============================================

    // Query 7: Datos del período anterior para comparación
    const periodoAnterior = calcularPeriodoAnterior(periodo, fechaInicio, fechaFin);

    const kpisComparativaQuery = `
      SELECT
        COUNT(*) as total_ventas_anterior,
        COALESCE(SUM(valor_final), 0) as ingresos_totales_anterior,
        COALESCE(AVG(valor_final), 0) as ticket_promedio_anterior,
        COUNT(DISTINCT asesor_id) as asesores_activos_anterior
      FROM ventas
      WHERE estado_detallado LIKE 'vendido%'
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
    `;

    // Query 8: Asesores con performance crítica
    const asesoresCriticosQuery = `
      SELECT
        v.asesor_id,
        u.nombre,
        u.apellido,
        COUNT(*) as ventas_periodo,
        COALESCE(SUM(v.valor_final), 0) as ingresos_periodo,

        -- Calcular performance vs período anterior
        COALESCE((
          SELECT COUNT(*)
          FROM ventas v2
          WHERE v2.asesor_id = v.asesor_id
            AND v2.estado_detallado LIKE 'vendido%'
            AND v2.activo = true
            AND v2.fecha_venta BETWEEN $3 AND $4
        ), 0) as ventas_anterior,

        COALESCE((
          SELECT SUM(v2.valor_final)
          FROM ventas v2
          WHERE v2.asesor_id = v.asesor_id
            AND v2.estado_detallado LIKE 'vendido%'
            AND v2.activo = true
            AND v2.fecha_venta BETWEEN $3 AND $4
        ), 0) as ingresos_anterior

      FROM ventas v
      INNER JOIN usuarios u ON v.asesor_id = u.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
        AND u.vende = true
        AND u.activo = true
      GROUP BY v.asesor_id, u.nombre, u.apellido
      HAVING COUNT(*) > 0
      ORDER BY ventas_periodo DESC
    `;

    // Query 9: Detección de patterns de canales
    const patternsCanalesQuery = `
      SELECT
        canal_contacto,
        COUNT(*) as total_ventas,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,

        -- Ventas por día de la semana
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 1 THEN 1 END) as lunes,
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 2 THEN 1 END) as martes,
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 3 THEN 1 END) as miercoles,
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 4 THEN 1 END) as jueves,
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 5 THEN 1 END) as viernes,
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 6 THEN 1 END) as sabado,
        COUNT(CASE WHEN EXTRACT(DOW FROM fecha_venta) = 0 THEN 1 END) as domingo

      FROM ventas
      WHERE estado_detallado LIKE 'vendido%'
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY canal_contacto
      ORDER BY total_ventas DESC
    `;

    // Ejecutar queries con manejo individual de errores
    const resultados = await Promise.allSettled([
      db.query(kpisGeneralesQuery, [fechaInicio, fechaFin]),
      db.query(topAsesorVentasQuery, [fechaInicio, fechaFin]),
      db.query(topAsesorIngresosQuery, [fechaInicio, fechaFin]),
      db.query(distributionCanalQuery, [fechaInicio, fechaFin]),
      db.query(tendenciasQuery),
      db.query(tiposVentaQuery, [fechaInicio, fechaFin]),
      db.query(kpisComparativaQuery, [periodoAnterior.inicio, periodoAnterior.fin]),
      db.query(asesoresCriticosQuery, [fechaInicio, fechaFin, periodoAnterior.inicio, periodoAnterior.fin]),
      db.query(patternsCanalesQuery, [fechaInicio, fechaFin])
    ]);

    // Extraer resultados con manejo seguro - AMPLIADO
    const [kpisResult, topVentasResult, topIngresosResult, canalResult, tendenciasResult, tiposResult,
           kpisComparativaResult, asesoresCriticosResult, patternsCanalesResult] = resultados;

    const kpis = kpisResult.status === 'fulfilled' ? kpisResult.value.rows[0] : {};
    const topVentas = topVentasResult.status === 'fulfilled' ? topVentasResult.value.rows : [];
    const topIngresos = topIngresosResult.status === 'fulfilled' ? topIngresosResult.value.rows : [];
    const canales = canalResult.status === 'fulfilled' ? canalResult.value.rows : [];
    const tendencias = tendenciasResult.status === 'fulfilled' ? tendenciasResult.value.rows : [];
    const tipos = tiposResult.status === 'fulfilled' ? tiposResult.value.rows : [];

    // NUEVOS DATOS INTELLIGENCE
    const kpisAnterior = kpisComparativaResult.status === 'fulfilled' ? kpisComparativaResult.value.rows[0] : {};
    const asesoresCriticos = asesoresCriticosResult.status === 'fulfilled' ? asesoresCriticosResult.value.rows : [];
    const patternsCanales = patternsCanalesResult.status === 'fulfilled' ? patternsCanalesResult.value.rows : [];

    // Calcular porcentajes de forma segura
    const totalVentas = kpis.total_ventas || 0;
    const totalIngresos = kpis.ingresos_totales || 0;

    // Agregar porcentajes a TOP asesores
    topVentas.forEach(asesor => {
      asesor.porcentaje_ventas = calcularPorcentajeSafe(asesor.ventas, totalVentas);
    });

    topIngresos.forEach(asesor => {
      asesor.porcentaje_ingresos = calcularPorcentajeSafe(asesor.ingresos, totalIngresos);
    });

    // Agregar porcentajes a canales
    canales.forEach(canal => {
      canal.porcentaje_ventas = calcularPorcentajeSafe(canal.ventas, totalVentas);
    });

    // Agregar porcentajes a tipos
    tipos.forEach(tipo => {
      tipo.porcentaje = calcularPorcentajeSafe(tipo.cantidad, totalVentas);
    });

    // ============================================
    // GENERAR ALERTAS AUTOMÁTICAS Y INTELLIGENCE
    // ============================================

    const alertasAutomaticas = generarAlertasAutomaticas(kpis, kpisAnterior, asesoresCriticos, canales, periodo);
    const comparativasTemporales = generarComparativasTemporales(kpis, kpisAnterior, periodo);
    const patternsDetectados = detectarPatterns(patternsCanales, tendencias, asesoresCriticos);
    const topPerformersAnalysis = analizarTopPerformers(topVentas, topIngresos, asesoresCriticos, canales);

    const responseData = {
      periodo,
      fechas: { fechaInicio, fechaFin },
      kpis_generales: kpis,
      top_asesores_ventas: topVentas,
      top_asesores_ingresos: topIngresos,
      distribucion_canales: canales,
      tendencias_15_dias: tendencias,
      tipos_venta: tipos,

      // ============================================
      // NUEVAS FUNCIONALIDADES INTELLIGENCE
      // ============================================
      alertas_automaticas: alertasAutomaticas,
      comparativas_temporales: comparativasTemporales,
      patterns_detectados: patternsDetectados,
      top_performers_analysis: topPerformersAnalysis,
      asesores_criticos: asesoresCriticos,

      // Metadatos del análisis
      intelligence_metadata: {
        periodo_comparacion: `${periodoAnterior.inicio} - ${periodoAnterior.fin}`,
        total_alertas: alertasAutomaticas.length,
        total_patterns: Object.keys(patternsDetectados).length,
        fecha_analisis: new Date().toISOString()
      }
    };

    res.json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error en vistaUnificada:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 2. METAS AVANZADO - VERSIÓN CORREGIDA
const metasAvanzado = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes_actual';
    let { fechaInicio, fechaFin } = obtenerFechasPeriodo(periodo);

    console.log(`[Metas Avanzado] Consultando período: ${periodo}`);

    // ✅ FIX: Extraer año y mes del período seleccionado por el usuario
    let { año, mes } = extraerAñoMesDePeriodo(periodo);
    console.log(`[Metas Avanzado] Usando datos del período seleccionado: ${año}-${mes}`);

    // Query ejecutivo: obtener TODOS los asesores con metas (Vista de Jefe)
    const metasVentasQuery = `
      SELECT
        mv.asesor_id,
        mv.meta_valor,
        mv.meta_cantidad,
        mv.año,
        mv.mes,
        u.nombre,
        u.apellido,
        u.email,
        u.rol_id,

        -- CALCULAR EN TIEMPO REAL desde tabla ventas
        COALESCE(v.ventas_reales, 0) as ventas_logradas,
        COALESCE(v.valor_real, 0) as valor_logrado,
        CASE
          WHEN mv.meta_valor > 0 THEN ROUND((COALESCE(v.valor_real, 0) / mv.meta_valor) * 100, 2)
          ELSE 0
        END as porcentaje_valor,

        -- Obtener modalidad del asesor
        COALESCE(mb.nombre, 'solo_ventas') as modalidad,

        -- Datos adicionales para vista ejecutiva
        CASE
          WHEN mv.meta_valor = 2500 THEN 'Nuevo'
          WHEN mv.meta_valor BETWEEN 4000 AND 5000 THEN 'Intermedio'
          WHEN mv.meta_valor = 8000 THEN 'Avanzado'
          WHEN mv.meta_valor > 8000 THEN 'Elite'
          ELSE 'Custom'
        END as nivel_asesor,

        -- Cálculo de rentabilidad (para vista ejecutiva)
        CASE
          WHEN COALESCE(v.valor_real, 0) > 0
          THEN ROUND((COALESCE(v.valor_real, 0) / mv.meta_valor) * 100, 2)
          ELSE 0
        END as ratio_performance

      FROM metas_ventas mv
      INNER JOIN usuarios u ON mv.asesor_id = u.id
      LEFT JOIN asesor_configuracion_bonos acb ON mv.asesor_id = acb.asesor_id AND acb.activo = true
      LEFT JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id

      -- JOIN con ventas calculadas en tiempo real
      LEFT JOIN (
        SELECT
          asesor_id,
          COUNT(*) as ventas_reales,
          SUM(valor_final) as valor_real
        FROM ventas
        WHERE estado_detallado LIKE 'vendido%'
          AND activo = true
          AND EXTRACT(YEAR FROM fecha_venta) = $1
          AND EXTRACT(MONTH FROM fecha_venta) = $2
        GROUP BY asesor_id
      ) v ON mv.asesor_id = v.asesor_id

      WHERE mv.activo = true
        AND mv.año = $1
        AND mv.mes = $2
        AND u.vende = true
        AND u.activo = true
      ORDER BY porcentaje_valor DESC, mv.meta_valor DESC
    `;

    // ✅ FIX: Rastrear si hubo fallback a otro período
    const añoSolicitado = año;
    const mesSolicitado = mes;
    let hubofallback = false;

    const metasResult = await db.query(metasVentasQuery, [año, mes]);

    if (metasResult.rows.length === 0) {
      console.log(`[Metas Avanzado] No hay datos para ${año}-${mes}, buscando período anterior...`);
      hubofallback = true;

      // FALLBACK AUTOMÁTICO: Buscar el período anterior con datos
      const periodosAnterioresQuery = `
        SELECT DISTINCT año, mes, COUNT(*) as asesores
        FROM metas_ventas
        WHERE activo = true
          AND (año < $1 OR (año = $1 AND mes < $2))
        GROUP BY año, mes
        HAVING COUNT(*) > 0
        ORDER BY año DESC, mes DESC
        LIMIT 3
      `;

      const periodosResult = await db.query(periodosAnterioresQuery, [año, mes]);

      if (periodosResult.rows.length === 0) {
        return res.json({
          success: true,
          data: {
            periodo: `${año}-${String(mes).padStart(2, '0')}`,
            fechas: { fechaInicio, fechaFin },
            dias_total: 0,
            dias_transcurridos: 0,
            progreso_periodo: 0,
            asesores_metas: [],
            metricas_equipo: {
              total_asesores: 0,
              mensaje: 'No hay metas configuradas en el sistema'
            },
            mensaje: 'No hay metas configuradas. Configure metas para empezar.',
            periodos_disponibles: [],
            configuracion_requerida: true
          }
        });
      }

      // Usar el período más reciente con datos
      const periodoAnterior = periodosResult.rows[0];
      console.log(`[Metas Avanzado] Usando período anterior: ${periodoAnterior.año}-${periodoAnterior.mes}`);

      // Re-ejecutar query con el período que tiene datos
      const metasResultAnterior = await db.query(metasVentasQuery, [periodoAnterior.año, periodoAnterior.mes]);

      if (metasResultAnterior.rows.length === 0) {
        return res.json({
          success: true,
          data: {
            periodo: `${periodoAnterior.año}-${String(periodoAnterior.mes).padStart(2, '0')}`,
            fechas: { fechaInicio, fechaFin },
            mensaje: 'No hay datos disponibles para mostrar',
            configuracion_requerida: true
          }
        });
      }

      // Actualizar variables para usar el período anterior
      const añoAnterior = periodoAnterior.año;
      const mesAnterior = periodoAnterior.mes;

      // Actualizar fechas para el período anterior
      const nuevaFechaInicio = `${añoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
      const nuevaFechaFin = new Date(añoAnterior, mesAnterior, 0).toISOString().split('T')[0];

      // Usar las variables del período anterior
      año = añoAnterior;
      mes = mesAnterior;
      fechaInicio = nuevaFechaInicio;
      fechaFin = nuevaFechaFin;

      // Reemplazar el resultado
      metasResult.rows = metasResultAnterior.rows;
    }

    // Importar ComisionesController para cálculos de bonos
    const ComisionesController = require('./ComisionesController');

    // Calcular días del período correctamente
    const fechaInicioObj = new Date(fechaInicio);
    const fechaFinObj = new Date(fechaFin);
    const fechaActual = new Date();

    // Calcular días totales del período
    const diasTotal = Math.ceil((fechaFinObj - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;

    // Calcular días transcurridos (limitado por fechaFin)
    const fechaLimite = fechaActual > fechaFinObj ? fechaFinObj : fechaActual;
    const diasTranscurridos = Math.ceil((fechaLimite - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;

    // Asegurar que días transcurridos no excedan días totales
    const diasTranscurridosReal = Math.min(diasTranscurridos, diasTotal);
    const progresoPorcentaje = calcularPorcentajeSafe(diasTranscurridosReal, diasTotal);

    console.log(`[Metas Avanzado] Período: ${fechaInicio} a ${fechaFin}`);
    console.log(`[Metas Avanzado] Días: ${diasTranscurridosReal}/${diasTotal} (${progresoPorcentaje}%)`);

    // Procesar cada asesor con cálculo de bonos real
    const asesorConMetas = await Promise.all(
      metasResult.rows.map(async (asesor) => {
        let calculoBono;
        
        // Calcular bono según modalidad usando tu sistema real
        if (asesor.modalidad === 'ventas_actividad') {
          calculoBono = await ComisionesController.calcularBonoConActividad(
            asesor.asesor_id,
            asesor.meta_valor,
            asesor.valor_logrado,
            asesor.año,
            asesor.mes
          );
        } else {
          // Modalidad solo_ventas - USAR calcularMejorBono para incluir metas opcionales
          const bonoSimple = ComisionesController.calcularMejorBono(
            asesor.meta_valor,
            asesor.valor_logrado
          );
          calculoBono = {
            porcentaje_ventas: bonoSimple.porcentaje,
            bono_final: bonoSimple.bono,
            nivel: bonoSimple.nivel,
            mensaje: bonoSimple.mensaje,
            modalidad: 'solo_ventas',
            actividad: null,
            meta_alcanzada: bonoSimple.meta_alcanzada // Meta opcional alcanzada (si aplica)
          };
        }

        // Calcular siguiente nivel usando tu sistema
        const siguienteNivel = ComisionesController.calcularSiguienteNivel(
          asesor.meta_valor, 
          asesor.valor_logrado
        );

        // ============================================
        // ALERTAS INTELIGENTES POR NIVEL DE ASESOR
        // ============================================
        const alertasInteligentes = generarAlertasInteligentes(
          asesor.meta_valor,
          asesor.valor_logrado,
          asesor.porcentaje_valor,
          asesor.modalidad,
          diasTranscurridosReal,
          diasTotal,
          calculoBono.actividad
        );

        // ============================================
        // SIMULADOR DE BONOS INTELIGENTE
        // ============================================
        const simuladorBonos = calcularSimuladorBonos(
          asesor.meta_valor,
          asesor.valor_logrado
        );

        // Proyecciones simples basadas en tendencia
        const proyeccionVentas = diasTranscurridosReal > 0 ?
          Math.round((asesor.ventas_logradas / diasTranscurridosReal) * diasTotal) : 0;

        const proyeccionIngresos = diasTranscurridosReal > 0 ?
          Math.round((asesor.valor_logrado / diasTranscurridosReal) * diasTotal) : 0;

        return {
          asesor_id: asesor.asesor_id,
          nombre: `${asesor.nombre} ${asesor.apellido}`,
          email: asesor.email,
          modalidad: asesor.modalidad,
          
          // Datos de meta y progreso actual
          meta_usd: parseFloat(asesor.meta_valor),
          valor_logrado_usd: parseFloat(asesor.valor_logrado),
          ventas_cantidad: asesor.ventas_logradas,
          porcentaje_cumplimiento: parseFloat(asesor.porcentaje_valor || 0),
          
          // Cálculo de bonos real
          bono_actual: calculoBono.bono_final,
          nivel_bono: calculoBono.nivel,
          mensaje_bono: calculoBono.mensaje,
          
          // Métricas de actividad (si aplica)
          actividad: calculoBono.actividad,
          detalles_actividad: calculoBono.detalles_actividad,
          
          // Proyecciones
          proyeccion_ventas: proyeccionVentas,
          proyeccion_ingresos: proyeccionIngresos,
          
          // Siguiente objetivo
          siguiente_nivel: siguienteNivel,
          
          // Estado de riesgo basado en progreso temporal vs real
          probabilidad_cumplimiento: asesor.porcentaje_valor >= progresoPorcentaje ? 'Alta' : 'Riesgo',

          // ============================================
          // NUEVAS FUNCIONALIDADES INTELIGENTES
          // ============================================
          alertas_inteligentes: alertasInteligentes,
          simulador_bonos: simuladorBonos,

          // Análisis de nivel de asesor
          nivel_asesor: determinarNivelAsesor(asesor.meta_valor),
          recomendaciones: generarRecomendaciones(
            asesor.meta_valor,
            asesor.porcentaje_valor,
            asesor.modalidad,
            diasTranscurridos,
            diasTotal
          )
        };
      })
    );

    // Métricas consolidadas del equipo
    // ============================================
    // MÉTRICAS EJECUTIVAS AVANZADAS
    // ============================================
    const totalMetas = asesorConMetas.reduce((sum, a) => sum + a.meta_usd, 0);
    const totalLogrado = asesorConMetas.reduce((sum, a) => sum + a.valor_logrado_usd, 0);
    const totalBonos = asesorConMetas.reduce((sum, a) => sum + a.bono_actual, 0);

    // Distribución por niveles (para jefes)
    const distribucionNiveles = {
      nuevo: asesorConMetas.filter(a => a.meta_usd === 2500).length,
      intermedio: asesorConMetas.filter(a => a.meta_usd >= 4000 && a.meta_usd <= 5000).length,
      avanzado: asesorConMetas.filter(a => a.meta_usd === 8000).length,
      elite: asesorConMetas.filter(a => a.meta_usd > 8000).length
    };

    // Distribución por performance (para gestión)
    const distribucionPerformance = {
      superando: asesorConMetas.filter(a => a.porcentaje_cumplimiento >= 100).length,
      en_meta: asesorConMetas.filter(a => a.porcentaje_cumplimiento >= 80 && a.porcentaje_cumplimiento < 100).length,
      rezagados: asesorConMetas.filter(a => a.porcentaje_cumplimiento >= 50 && a.porcentaje_cumplimiento < 80).length,
      criticos: asesorConMetas.filter(a => a.porcentaje_cumplimiento < 50).length
    };

    // Rentabilidad de bonos (KPI ejecutivo clave)
    const rentabilidadBonos = {
      ratio_bono_ventas: totalLogrado > 0 ? ((totalBonos / totalLogrado) * 100).toFixed(2) : 0,
      inversion_bonos: totalBonos,
      retorno_ventas: totalLogrado,
      eficiencia: totalBonos > 0 ? (totalLogrado / totalBonos).toFixed(2) : 0
    };

    // Top performers (para reconocimiento)
    const topPerformers = asesorConMetas
      .sort((a, b) => b.porcentaje_cumplimiento - a.porcentaje_cumplimiento)
      .slice(0, 3)
      .map(a => ({
        nombre: a.nombre,
        porcentaje: a.porcentaje_cumplimiento,
        nivel: a.meta_usd === 2500 ? 'Nuevo' : a.meta_usd >= 4000 && a.meta_usd <= 5000 ? 'Intermedio' : a.meta_usd === 8000 ? 'Avanzado' : 'Elite'
      }));

    const metricsEquipo = {
      // KPIs Básicos
      total_asesores: asesorConMetas.length,
      meta_total_usd: totalMetas,
      logrado_total_usd: totalLogrado,
      bonos_total_usd: totalBonos,
      promedio_cumplimiento: totalMetas > 0 ? ((totalLogrado / totalMetas) * 100).toFixed(2) : 0,

      // KPIs de Gestión
      asesores_con_bono: asesorConMetas.filter(a => a.bono_actual > 0).length,
      asesores_en_riesgo: asesorConMetas.filter(a => a.probabilidad_cumplimiento === 'Riesgo').length,

      // Nuevas métricas ejecutivas
      distribucion_niveles: distribucionNiveles,
      distribucion_performance: distribucionPerformance,
      rentabilidad_bonos: rentabilidadBonos,
      top_performers: topPerformers
    };

    console.log(`✅ Metas avanzado procesado: ${asesorConMetas.length} asesores del ${año}-${mes}`);

    // Obtener períodos disponibles para navegación temporal
    const periodosDisponiblesQuery = `
      SELECT DISTINCT año, mes, COUNT(*) as asesores_con_metas
      FROM metas_ventas
      WHERE activo = true
      GROUP BY año, mes
      HAVING COUNT(*) > 0
      ORDER BY año DESC, mes DESC
      LIMIT 12
    `;

    const periodosDisponibles = await db.query(periodosDisponiblesQuery);

    // ✅ FIX: Determinar si se está mostrando el período actual
    const esPeriodoActual = año === new Date().getFullYear() && mes === (new Date().getMonth() + 1);

    res.json({
      success: true,
      data: {
        // Información del período
        periodo: `${año}-${String(mes).padStart(2, '0')}`,
        periodo_solicitado: periodo,
        es_periodo_actual: esPeriodoActual,
        fechas: { fechaInicio, fechaFin },
        dias_total: diasTotal,
        dias_transcurridos: diasTranscurridosReal,
        progreso_periodo: progresoPorcentaje,

        // Datos principales
        asesores_metas: asesorConMetas,
        metricas_equipo: metricsEquipo,

        // Navegación temporal
        periodos_disponibles: periodosDisponibles.rows.map(p => ({
          año: p.año,
          mes: p.mes,
          periodo_label: `${p.año}-${String(p.mes).padStart(2, '0')}`,
          asesores_con_metas: p.asesores_con_metas
        })),

        // ✅ FIX: Información de contexto (solo mostrar si hubo fallback)
        fallback_aplicado: hubofallback,
        mensaje_contexto: hubofallback ?
          `No hay datos para ${añoSolicitado}-${String(mesSolicitado).padStart(2, '0')}. Mostrando ${año}-${String(mes).padStart(2, '0')} (período más reciente con datos)` :
          null
      }
    });

  } catch (error) {
    console.error('Error en metasAvanzado:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// 3. SECTORES STRATEGY - VERSIÓN SIMPLIFICADA
const sectoresStrategy = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes_actual';
    const { fechaInicio, fechaFin } = obtenerFechasPeriodo(periodo);

    console.log(`[Sectores Strategy] Consultando período: ${periodo}`);

    // Query principal simplificado
    const sectoresQuery = `
      SELECT 
        COALESCE(sector, 'Sin Sector') as sector,
        COUNT(*) as total_ventas,
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        COUNT(DISTINCT asesor_id) as asesores_activos,
        COUNT(DISTINCT ciudad) as ciudades_cubiertas,
        MIN(fecha_venta) as primera_venta,
        MAX(fecha_venta) as ultima_venta
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY sector
      ORDER BY ingresos_totales DESC
    `;

    // Query matriz asesor-sector simplificado
    const sectoresAsesorQuery = `
      SELECT 
        asesor_id,
        COALESCE(sector, 'Sin Sector') as sector,
        COUNT(*) as ventas,
        COALESCE(SUM(valor_final), 0) as ingresos,
        COALESCE(AVG(valor_final), 0) as ticket_promedio
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY asesor_id, sector
      ORDER BY asesor_id, ingresos DESC
    `;

    const [sectoresResult, sectoresAsesorResult] = await Promise.allSettled([
      db.query(sectoresQuery, [fechaInicio, fechaFin]),
      db.query(sectoresAsesorQuery, [fechaInicio, fechaFin])
    ]);

    const sectores = sectoresResult.status === 'fulfilled' ? sectoresResult.value.rows : [];
    const sectoresAsesor = sectoresAsesorResult.status === 'fulfilled' ? sectoresAsesorResult.value.rows : [];

    // Calcular porcentajes manualmente
    const totalVentas = sectores.reduce((sum, s) => sum + parseInt(s.total_ventas || 0), 0);
    const totalIngresos = sectores.reduce((sum, s) => sum + parseFloat(s.ingresos_totales || 0), 0);

    sectores.forEach(sector => {
      sector.porcentaje_ventas = calcularPorcentajeSafe(sector.total_ventas, totalVentas);
      sector.porcentaje_ingresos = calcularPorcentajeSafe(sector.ingresos_totales, totalIngresos);
    });

    // Especialización simplificada
    const especializacion = [];
    const asesorSectorMap = {};

    sectoresAsesor.forEach(item => {
      if (!asesorSectorMap[item.asesor_id]) {
        asesorSectorMap[item.asesor_id] = {
          asesor_id: item.asesor_id,
          sector_principal: item.sector,
          ventas_sector: item.ventas,
          ingresos_sector: item.ingresos,
          tipo_especializacion: 'Enfocado'
        };
      }
    });

    Object.values(asesorSectorMap).forEach(item => {
      especializacion.push(item);
    });

    res.json({
      success: true,
      data: {
        periodo,
        fechas: { fechaInicio, fechaFin },
        sectores: sectores,
        matriz_asesor_sector: sectoresAsesor,
        especializacion_asesores: especializacion
      }
    });

  } catch (error) {
    console.error('Error en sectoresStrategy:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

// 4. ABC PRODUCTOS - VERSIÓN SIMPLIFICADA
const abcProductos = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes_actual';
    const { fechaInicio, fechaFin } = obtenerFechasPeriodo(periodo);

    console.log(`[ABC Productos] Consultando período: ${periodo}`);

    // Query básico de productos CON JOIN A TABLA PRODUCTOS
    const productosQuery = `
      SELECT
        vd.producto_id,
        p.codigo,
        p.descripcion,
        p.unidad_medida,
        p.marca,
        SUM(vd.total_linea) as ingresos_totales,
        SUM(vd.cantidad) as cantidad_total,
        COUNT(*) as veces_vendido,
        COUNT(DISTINCT v.asesor_id) as asesores_que_vendieron,
        AVG(vd.precio_unitario) as precio_promedio,
        MIN(v.fecha_venta) as primera_venta,
        MAX(v.fecha_venta) as ultima_venta
      FROM venta_detalles vd
      INNER JOIN ventas v ON vd.venta_id = v.id
      INNER JOIN productos p ON vd.producto_id = p.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND vd.activo = true
        AND p.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY vd.producto_id, p.codigo, p.descripcion, p.unidad_medida, p.marca
      ORDER BY ingresos_totales DESC
    `;

    // Query productos por asesor CON NOMBRE DE ASESOR
    const productosAsesorQuery = `
      SELECT
        v.asesor_id,
        u.nombre,
        u.apellido,
        CONCAT(u.nombre, ' ', u.apellido) as nombre_completo,
        COUNT(DISTINCT vd.producto_id) as productos_unicos,
        SUM(vd.cantidad) as cantidad_total,
        COALESCE(SUM(vd.total_linea), 0) as ingresos_productos,
        COALESCE(AVG(vd.precio_unitario), 0) as precio_promedio,
        COUNT(*) as lineas_vendidas
      FROM ventas v
      INNER JOIN venta_detalles vd ON v.id = vd.venta_id
      INNER JOIN usuarios u ON v.asesor_id = u.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND vd.activo = true
        AND u.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY v.asesor_id, u.nombre, u.apellido
      ORDER BY ingresos_productos DESC
    `;

    // Métricas generales
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT vd.producto_id) as productos_unicos_vendidos,
        COALESCE(SUM(vd.cantidad), 0) as cantidad_total_vendida,
        COALESCE(SUM(vd.total_linea), 0) as ingresos_totales_productos,
        COALESCE(AVG(vd.precio_unitario), 0) as precio_promedio_productos,
        COUNT(*) as total_lineas_vendidas,
        COUNT(DISTINCT v.id) as ventas_con_productos
      FROM venta_detalles vd
      INNER JOIN ventas v ON vd.venta_id = v.id
      WHERE v.estado_detallado LIKE 'vendido%' 
        AND v.activo = true
        AND vd.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
    `;

    const [productosResult, productosAsesorResult, metricsResult] = await Promise.allSettled([
      db.query(productosQuery, [fechaInicio, fechaFin]),
      db.query(productosAsesorQuery, [fechaInicio, fechaFin]),
      db.query(metricsQuery, [fechaInicio, fechaFin])
    ]);

    const productos = productosResult.status === 'fulfilled' ? productosResult.value.rows : [];
    const productosAsesor = productosAsesorResult.status === 'fulfilled' ? productosAsesorResult.value.rows : [];
    const metrics = metricsResult.status === 'fulfilled' ? metricsResult.value.rows[0] : {};

    // Clasificación ABC manual
    const totalIngresos = productos.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0);
    
    let acumulado = 0;
    productos.forEach((producto, index) => {
      acumulado += parseFloat(producto.ingresos_totales || 0);
      const porcentajeAcumulado = calcularPorcentajeSafe(acumulado, totalIngresos);
      
      producto.porcentaje_ingresos = calcularPorcentajeSafe(producto.ingresos_totales, totalIngresos);
      producto.porcentaje_cantidad = calcularPorcentajeSafe(producto.cantidad_total, metrics.cantidad_total_vendida);
      producto.acumulado_ingresos = porcentajeAcumulado;
      
      if (porcentajeAcumulado <= 80) {
        producto.clasificacion_abc = 'A';
      } else if (porcentajeAcumulado <= 95) {
        producto.clasificacion_abc = 'B';
      } else {
        producto.clasificacion_abc = 'C';
      }
    });

    // Separar por clasificación
    const productosA = productos.filter(p => p.clasificacion_abc === 'A');
    const productosB = productos.filter(p => p.clasificacion_abc === 'B');
    const productosC = productos.filter(p => p.clasificacion_abc === 'C');

    res.json({
      success: true,
      data: {
        periodo,
        fechas: { fechaInicio, fechaFin },
        metricas_productos: metrics,
        todos_productos: productos,
        productos_clase_a: productosA,
        productos_clase_b: productosB,
        productos_clase_c: productosC,
        productos_por_asesor: productosAsesor
      }
    });

  } catch (error) {
    console.error('Error en abcProductos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

// 5. ANÁLISIS GEOGRÁFICO - VERSIÓN SIMPLIFICADA
// Función auxiliar para generar matriz asesor-ciudad
const generarMatrizAsesorCiudad = async (fechaInicio, fechaFin) => {
  try {
    const matrizQuery = `
      SELECT
        v.asesor_id,
        CONCAT(u.nombre, ' ', u.apellido) as nombre_asesor,
        v.ciudad,
        v.departamento,
        COUNT(*) as ventas,
        COALESCE(SUM(v.valor_final), 0) as ingresos,
        COALESCE(AVG(v.valor_final), 0) as ticket_promedio
      FROM ventas v
      INNER JOIN usuarios u ON v.asesor_id = u.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY v.asesor_id, u.nombre, u.apellido, v.ciudad, v.departamento
      ORDER BY v.asesor_id, ingresos DESC
    `;

    const result = await db.query(matrizQuery, [fechaInicio, fechaFin]);
    return result.rows;
  } catch (error) {
    console.error('Error generando matriz asesor-ciudad:', error);
    return [];
  }
};

const analisisGeografico = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes_actual';
    const { fechaInicio, fechaFin } = obtenerFechasPeriodo(periodo);

    console.log(`[Análisis Geográfico] Consultando período: ${periodo}`);

    // Query por departamento
    const departamentosQuery = `
      SELECT 
        departamento,
        COUNT(*) as total_ventas,
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        COUNT(DISTINCT asesor_id) as asesores_activos,
        COUNT(DISTINCT ciudad) as ciudades,
        MIN(fecha_venta) as primera_venta,
        MAX(fecha_venta) as ultima_venta
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY departamento
      ORDER BY ingresos_totales DESC
    `;

    // Query por ciudad
    const ciudadesQuery = `
      SELECT 
        ciudad,
        departamento,
        COUNT(*) as total_ventas,
        COALESCE(SUM(valor_final), 0) as ingresos_totales,
        COALESCE(AVG(valor_final), 0) as ticket_promedio,
        COUNT(DISTINCT asesor_id) as asesores_activos
      FROM ventas 
      WHERE estado_detallado LIKE 'vendido%' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY ciudad, departamento
      ORDER BY ingresos_totales DESC
      LIMIT 15
    `;

    // Cobertura por asesor
    const coberturaQuery = `
      SELECT
        v.asesor_id,
        CONCAT(u.nombre, ' ', u.apellido) as nombre_asesor,
        u.email,
        COUNT(DISTINCT v.departamento) as departamentos_cubiertos,
        COUNT(DISTINCT v.ciudad) as ciudades_cubiertas,
        COUNT(*) as ventas_totales,
        COALESCE(SUM(v.valor_final), 0) as ingresos_totales
      FROM ventas v
      INNER JOIN usuarios u ON v.asesor_id = u.id
      WHERE v.estado_detallado LIKE 'vendido%'
        AND v.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY v.asesor_id, u.nombre, u.apellido, u.email
      ORDER BY departamentos_cubiertos DESC, ciudades_cubiertas DESC
    `;

    const [departamentosResult, ciudadesResult, coberturaResult] = await Promise.allSettled([
      db.query(departamentosQuery, [fechaInicio, fechaFin]),
      db.query(ciudadesQuery, [fechaInicio, fechaFin]),
      db.query(coberturaQuery, [fechaInicio, fechaFin])
    ]);

    const departamentos = departamentosResult.status === 'fulfilled' ? departamentosResult.value.rows : [];
    const ciudades = ciudadesResult.status === 'fulfilled' ? ciudadesResult.value.rows : [];
    const cobertura = coberturaResult.status === 'fulfilled' ? coberturaResult.value.rows : [];

    // Calcular porcentajes
    const totalVentas = departamentos.reduce((sum, d) => sum + parseInt(d.total_ventas || 0), 0);

    departamentos.forEach(dept => {
      dept.porcentaje_ventas = calcularPorcentajeSafe(dept.total_ventas, totalVentas);
    });

    ciudades.forEach(ciudad => {
      ciudad.porcentaje_ventas = calcularPorcentajeSafe(ciudad.total_ventas, totalVentas);
    });

    res.json({
      success: true,
      data: {
        periodo,
        fechas: { fechaInicio, fechaFin },
        departamentos: departamentos,
        ciudades: ciudades,
        cobertura_asesores: cobertura,
        matriz_asesor_ciudad: await generarMatrizAsesorCiudad(fechaInicio, fechaFin)
      }
    });

  } catch (error) {
    console.error('Error en analisisGeografico:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

// HEALTH CHECK
const healthCheck = async (req, res) => {
  try {
    const testQuery = 'SELECT COUNT(*) as total FROM ventas WHERE activo = true';
    const result = await db.query(testQuery);
    
    res.json({ 
      success: true, 
      message: 'Dashboard Ejecutivo operativo',
      data: {
        total_ventas: result.rows[0].total,
        timestamp: new Date().toISOString(),
        dashboards_disponibles: [
          'vista-unificada',
          'metas-avanzado', 
          'sectores-strategy',
          'abc-productos',
          'analisis-geografico'
        ],
        version: '1.1.0-STABLE'
      }
    });
  } catch (error) {
    console.error('Error en healthCheck:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error de conexión a la base de datos' 
    });
  }
};

// ============================================
// FUNCIONES AUXILIARES PARA ALERTAS INTELIGENTES
// ============================================

/**
 * Genera alertas inteligentes específicas según el nivel del asesor
 */
const generarAlertasInteligentes = (metaUsd, valorLogrado, porcentaje, modalidad, diasTranscurridos, diasTotal, actividad) => {
  const alertas = [];
  const metaNumero = parseFloat(metaUsd);
  const porcentajeNum = parseFloat(porcentaje);
  const progresoPeriodo = (diasTranscurridos / diasTotal) * 100;

  // ============================================
  // ALERTAS POR NIVEL DE ASESOR
  // ============================================

  if (metaNumero === 2500) {
    // ASESORES NUEVOS - Solo ventas
    if (porcentajeNum < 60 && diasTranscurridos >= 15) {
      alertas.push({
        tipo: 'critica',
        categoria: 'nuevo_asesor',
        mensaje: 'Asesor nuevo con bajo rendimiento - Requiere acompañamiento inmediato',
        accion_recomendada: 'Sesión de coaching urgente'
      });
    } else if (porcentajeNum < 80 && diasTranscurridos >= 20) {
      alertas.push({
        tipo: 'advertencia',
        categoria: 'nuevo_asesor',
        mensaje: 'Riesgo de no cumplir meta en período de prueba',
        accion_recomendada: 'Intensificar capacitación y seguimiento'
      });
    }
  }

  else if (metaNumero >= 4000 && metaNumero <= 5000) {
    // ASESORES INTERMEDIOS - Ventas + Actividad
    if (porcentajeNum < 70 && progresoPeriodo > 50) {
      alertas.push({
        tipo: 'critica',
        categoria: 'asesor_intermedio',
        mensaje: 'Asesor intermedio por debajo del mínimo esperado',
        accion_recomendada: 'Revisar estrategia comercial y actividad'
      });
    }

    // Alerta específica de actividad
    if (modalidad === 'ventas_actividad' && actividad) {
      if (actividad.total_mensajes < 100 || actividad.total_llamadas < 20) {
        alertas.push({
          tipo: 'advertencia',
          categoria: 'actividad_insuficiente',
          mensaje: 'Actividad por debajo del mínimo requerido para tu nivel',
          accion_recomendada: 'Incrementar mensajes y llamadas diarias'
        });
      }
    }
  }

  else if (metaNumero === 8000) {
    // ASESORES AVANZADOS - Ambos obligatorios
    if (porcentajeNum < 80) {
      alertas.push({
        tipo: 'critica',
        categoria: 'asesor_avanzado',
        mensaje: 'CRÍTICO: Asesor avanzado sin bono (mínimo 80% requerido)',
        accion_recomendada: 'Intervención inmediata - Revisar pipeline completo'
      });
    } else if (porcentajeNum >= 80 && porcentajeNum < 90) {
      alertas.push({
        tipo: 'info',
        categoria: 'optimizacion',
        mensaje: 'Cerca del siguiente nivel de bono (90%)',
        accion_recomendada: 'Push final para maximizar bono'
      });
    }
  }

  else if (metaNumero > 8000) {
    // ASESORES ELITE - Performance excepcional
    alertas.push({
      tipo: 'exito',
      categoria: 'elite',
      mensaje: 'Asesor de performance élite - Mantener estrategia actual',
      accion_recomendada: 'Considerar como mentor para otros asesores'
    });
  }

  // ============================================
  // ALERTAS DE OPORTUNIDAD
  // ============================================
  const ventasFaltantes = calcularVentasFaltantesParaSiguienteNivel(metaNumero, valorLogrado);
  if (ventasFaltantes.oportunidad) {
    alertas.push({
      tipo: 'oportunidad',
      categoria: 'bono_superior',
      mensaje: `¡Oportunidad! Estás a $${ventasFaltantes.faltante} del bono superior`,
      accion_recomendada: `Vende $${ventasFaltantes.faltante} más y gana $${ventasFaltantes.beneficio_extra} adicionales`
    });
  }

  return alertas;
};

/**
 * Calcula simulador de bonos inteligente - VERSIÓN CORREGIDA
 * Lógica: Solo mostrar objetivos que den MÁS bono que el actual
 */
const calcularSimuladorBonos = (metaUsd, valorLogrado) => {
  const ComisionesController = require('./ComisionesController');
  const metaNumero = parseFloat(metaUsd);
  const ventasActuales = parseFloat(valorLogrado);

  // 1. Calcular el BONO ACTUAL del asesor (incluyendo metas opcionales)
  const bonoActual = ComisionesController.calcularMejorBono(metaNumero, ventasActuales);
  const bonoActualValor = bonoActual.bono || 0;

  // 2. Información de la meta asignada (para mostrar siempre en frontend)
  const metaAsignadaConfig = ComisionesController.BONOS_POR_META.find(b => b.meta_usd === metaNumero);
  const infoMetaAsignada = metaAsignadaConfig ? {
    meta_usd: metaNumero,
    niveles_disponibles: []
  } : null;

  // Agregar niveles de la meta asignada (si aún no los alcanzó)
  if (infoMetaAsignada && metaAsignadaConfig) {
    if (metaAsignadaConfig.bono_80 && ventasActuales < (metaNumero * 0.8)) {
      infoMetaAsignada.niveles_disponibles.push({
        porcentaje: 80,
        ventas_necesarias: Math.round(metaNumero * 0.8),
        faltante: Math.round((metaNumero * 0.8) - ventasActuales),
        bono: metaAsignadaConfig.bono_80
      });
    }
    if (metaAsignadaConfig.bono_90 && ventasActuales < (metaNumero * 0.9)) {
      infoMetaAsignada.niveles_disponibles.push({
        porcentaje: 90,
        ventas_necesarias: Math.round(metaNumero * 0.9),
        faltante: Math.round((metaNumero * 0.9) - ventasActuales),
        bono: metaAsignadaConfig.bono_90
      });
    }
    if (ventasActuales < metaNumero) {
      infoMetaAsignada.niveles_disponibles.push({
        porcentaje: 100,
        ventas_necesarias: metaNumero,
        faltante: Math.round(metaNumero - ventasActuales),
        bono: metaAsignadaConfig.bono_100
      });
    }
  }

  // 3. Crear lista PLANA de TODOS los niveles posibles (80%, 90%, 100% de cada meta)
  const todosLosNiveles = ComisionesController.BONOS_POR_META
    .flatMap(meta => {
      const niveles = [];

      // 100% siempre existe
      niveles.push({
        meta_usd: meta.meta_usd,
        porcentaje: 100,
        ventas_necesarias: meta.meta_usd,
        bono: meta.bono_100
      });

      // 90% si existe
      if (meta.bono_90) {
        niveles.push({
          meta_usd: meta.meta_usd,
          porcentaje: 90,
          ventas_necesarias: meta.meta_usd * 0.9,
          bono: meta.bono_90
        });
      }

      // 80% si existe
      if (meta.bono_80) {
        niveles.push({
          meta_usd: meta.meta_usd,
          porcentaje: 80,
          ventas_necesarias: meta.meta_usd * 0.8,
          bono: meta.bono_80
        });
      }

      return niveles;
    });

  // 4. Filtrar SOLO niveles que:
  //    - Den MÁS bono que el actual
  //    - Requieran ventas MAYORES a las actuales (aún no alcanzados)
  //    - NO estén ya en la meta asignada (para evitar duplicados)
  //    - Sean de metas IGUALES O SUPERIORES a tu meta asignada (no mostrar metas inferiores)
  const nivelesMetaAsignada = infoMetaAsignada ?
    infoMetaAsignada.niveles_disponibles.map(n => `${metaNumero}-${n.porcentaje}`) : [];

  const proximosNiveles = todosLosNiveles
    .filter(nivel => {
      const claveNivel = `${nivel.meta_usd}-${nivel.porcentaje}`;

      // Regla 1: Debe dar MÁS bono que el actual
      if (nivel.bono <= bonoActualValor) return false;

      // Regla 2: Debe requerir ventas MAYORES a las actuales
      if (ventasActuales >= nivel.ventas_necesarias) return false;

      // Regla 3: No duplicar niveles de la meta asignada
      if (nivelesMetaAsignada.includes(claveNivel)) return false;

      // Regla 4: NO mostrar metas inferiores a la asignada
      if (nivel.meta_usd < metaNumero) return false;

      // Regla 5 (NUEVA): Para metas SUPERIORES, SOLO mostrar el 100%
      if (nivel.meta_usd > metaNumero && nivel.porcentaje < 100) return false;

      return true;
    })
    .sort((a, b) => a.ventas_necesarias - b.ventas_necesarias) // Ordenar por cercanía
    .slice(0, 3) // Los próximos 3 alcanzables
    .map(nivel => ({
      meta_usd: nivel.meta_usd,
      porcentaje: nivel.porcentaje,
      ventas_necesarias: Math.round(nivel.ventas_necesarias),
      faltante: Math.round(nivel.ventas_necesarias - ventasActuales),
      bono: nivel.bono
    }));

  return {
    ventas_actuales: ventasActuales,
    meta_asignada: metaNumero,
    bono_actual: bonoActualValor,
    nivel_actual: bonoActual.nivel,
    info_meta_asignada: infoMetaAsignada, // Info de TU meta (para mostrar arriba)
    proximos_niveles: proximosNiveles, // Próximos 3 objetivos alcanzables
    recomendacion: generarRecomendacionSimulador(ventasActuales, proximosNiveles, bonoActualValor)
  };
};

/**
 * Función auxiliar para calcular bono según meta específica
 */
const calcularBonoParaMeta = (ventas, meta, config) => {
  const porcentaje = (ventas / meta) * 100;

  if (porcentaje >= 100) return { porcentaje, bono: config.bono_100, nivel: '100%' };
  if (porcentaje >= 90 && config.bono_90) return { porcentaje, bono: config.bono_90, nivel: '90%' };
  if (porcentaje >= 80 && config.bono_80) return { porcentaje, bono: config.bono_80, nivel: '80%' };

  return { porcentaje, bono: 0, nivel: 'sin_bono' };
};

/**
 * Calcular ventas faltantes para siguiente nivel
 */
const calcularVentasFaltantesParaSiguienteNivel = (metaActual, ventasActuales) => {
  const ComisionesController = require('./ComisionesController');
  const siguienteNivel = ComisionesController.BONOS_POR_META
    .find(b => b.meta_usd > metaActual && ventasActuales < (b.meta_usd * 0.8));

  if (!siguienteNivel) return { oportunidad: false };

  const ventasNecesarias = siguienteNivel.meta_usd * 0.8;
  const faltante = Math.round(ventasNecesarias - ventasActuales);

  if (faltante <= ventasActuales * 0.2) { // Si falta menos del 20% de lo que ya vendió
    const bonoActual = calcularBonoParaMeta(ventasActuales, metaActual,
      ComisionesController.BONOS_POR_META.find(b => b.meta_usd === metaActual));
    const bonoSiguiente = calcularBonoParaMeta(ventasNecesarias, siguienteNivel.meta_usd, siguienteNivel);

    return {
      oportunidad: true,
      faltante,
      beneficio_extra: Math.round(bonoSiguiente.bono - bonoActual.bono)
    };
  }

  return { oportunidad: false };
};

/**
 * Determinar nivel del asesor
 */
const determinarNivelAsesor = (metaUsd) => {
  const meta = parseFloat(metaUsd);

  if (meta === 2500) return { nivel: 'nuevo', descripcion: 'Asesor nuevo (3 meses)', modalidad_requerida: 'solo_ventas' };
  if (meta >= 4000 && meta <= 5000) return { nivel: 'intermedio', descripcion: 'Asesor intermedio', modalidad_requerida: 'ventas_actividad' };
  if (meta === 8000) return { nivel: 'avanzado', descripcion: 'Asesor avanzado', modalidad_requerida: 'ventas_actividad' };
  if (meta > 8000) return { nivel: 'elite', descripcion: 'Performance élite', modalidad_requerida: 'ventas_actividad' };

  return { nivel: 'indefinido', descripcion: 'Meta no estándar', modalidad_requerida: 'revisar' };
};

/**
 * Generar recomendaciones personalizadas
 */
const generarRecomendaciones = (metaUsd, porcentaje, modalidad, diasTranscurridos, diasTotal) => {
  const recomendaciones = [];
  const meta = parseFloat(metaUsd);
  const porcentajeNum = parseFloat(porcentaje);
  const progresoPeriodo = (diasTranscurridos / diasTotal) * 100;

  // Recomendaciones por nivel
  if (meta === 2500) {
    if (porcentajeNum >= 120) {
      recomendaciones.push('🚀 Excelente performance! Considera solicitar ascenso a meta $4,000');
    } else if (porcentajeNum < 80) {
      recomendaciones.push('📚 Enfócate en capacitación y técnicas de venta básicas');
    }
  } else if (meta >= 4000 && meta <= 5000) {
    if (porcentajeNum >= 110) {
      recomendaciones.push('🎯 Buen ritmo! Considera optimizar actividad para maximizar bonos');
    }
  } else if (meta === 8000) {
    if (porcentajeNum < 80) {
      recomendaciones.push('⚠️ URGENTE: Revisar pipeline y estrategia inmediatamente');
    } else if (porcentajeNum >= 100) {
      recomendaciones.push('⭐ Performance sólida! Mantén la estrategia actual');
    }
  }

  // Recomendaciones por progreso temporal
  if (porcentajeNum < progresoPeriodo - 10) {
    recomendaciones.push('📈 Acelerar el ritmo de ventas para alcanzar la meta');
  } else if (porcentajeNum > progresoPeriodo + 15) {
    recomendaciones.push('🎉 Vas adelantado! Considera establecer objetivos adicionales');
  }

  return recomendaciones;
};

/**
 * Generar recomendación del simulador
 */
const generarRecomendacionSimulador = (ventasActuales, proximosNiveles, bonoActual) => {
  if (!proximosNiveles || proximosNiveles.length === 0) {
    if (bonoActual > 0) {
      return '🏆 ¡Excelente! Mantén el ritmo para asegurar tu bono';
    }
    return '📊 Continúa vendiendo para alcanzar tu primera meta';
  }

  // Buscar el nivel más cercano (primero en la lista)
  const nivelCercano = proximosNiveles[0];

  if (!nivelCercano) {
    return '📊 Mantén el ritmo actual para asegurar tu bono';
  }

  const porcentajeFaltante = (nivelCercano.faltante / ventasActuales) * 100;

  // Oportunidad muy cercana (menos del 15% de lo que ya vendiste)
  if (porcentajeFaltante <= 15) {
    return `💡 OPORTUNIDAD: Vende $${nivelCercano.faltante.toLocaleString()} más y alcanza $${nivelCercano.bono.toLocaleString()} de bono (Meta $${nivelCercano.meta_usd.toLocaleString()} al ${nivelCercano.porcentaje}%)`;
  }

  // Objetivo cercano (menos del 25% de lo que ya vendiste)
  if (porcentajeFaltante <= 25) {
    return `🎯 CERCA: Solo $${nivelCercano.faltante.toLocaleString()} para bono de $${nivelCercano.bono.toLocaleString()} (Meta $${nivelCercano.meta_usd.toLocaleString()} al ${nivelCercano.porcentaje}%)`;
  }

  // Objetivo más lejano
  return `📊 Mantén el ritmo actual para asegurar tu bono`;
};

// ============================================
// FUNCIONES AUXILIARES PARA VISTA UNIFICADA INTELLIGENCE
// ============================================

/**
 * Calcular período anterior basado en el período actual
 */
const calcularPeriodoAnterior = (periodo, fechaInicio, fechaFin) => {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  let inicioAnterior, finAnterior;

  switch (periodo) {
    case 'hoy':
      inicioAnterior = new Date(inicio);
      inicioAnterior.setDate(inicioAnterior.getDate() - 1);
      finAnterior = new Date(inicioAnterior);
      break;

    case 'semana_actual':
      inicioAnterior = new Date(inicio);
      inicioAnterior.setDate(inicioAnterior.getDate() - 7);
      finAnterior = new Date(fin);
      finAnterior.setDate(finAnterior.getDate() - 7);
      break;

    case 'mes_actual':
      inicioAnterior = new Date(inicio);
      inicioAnterior.setMonth(inicioAnterior.getMonth() - 1);
      finAnterior = new Date(fin);
      finAnterior.setMonth(finAnterior.getMonth() - 1);
      break;

    case 'trimestre_actual':
      inicioAnterior = new Date(inicio);
      inicioAnterior.setMonth(inicioAnterior.getMonth() - 3);
      finAnterior = new Date(fin);
      finAnterior.setMonth(finAnterior.getMonth() - 3);
      break;

    default:
      inicioAnterior = new Date(inicio);
      inicioAnterior.setMonth(inicioAnterior.getMonth() - 1);
      finAnterior = new Date(fin);
      finAnterior.setMonth(finAnterior.getMonth() - 1);
  }

  return {
    inicio: inicioAnterior.toISOString().split('T')[0],
    fin: finAnterior.toISOString().split('T')[0]
  };
};

/**
 * Generar alertas automáticas basadas en anomalías detectadas
 */
const generarAlertasAutomaticas = (kpis, kpisAnterior, asesoresCriticos, canales, periodo) => {
  const alertas = [];

  // 1. ALERTAS DE PERFORMANCE GENERAL
  const ventasActuales = parseFloat(kpis.total_ventas || 0);
  const ventasAnteriores = parseFloat(kpisAnterior.total_ventas_anterior || 0);
  const ingresosActuales = parseFloat(kpis.ingresos_totales || 0);
  const ingresosAnteriores = parseFloat(kpisAnterior.ingresos_totales_anterior || 0);

  if (ventasAnteriores > 0) {
    const variacionVentas = ((ventasActuales - ventasAnteriores) / ventasAnteriores) * 100;

    if (variacionVentas < -20) {
      alertas.push({
        tipo: 'critica',
        categoria: 'performance_general',
        titulo: 'Caída significativa en ventas',
        mensaje: `Las ventas han caído ${Math.abs(variacionVentas).toFixed(1)}% vs período anterior`,
        valor_actual: ventasActuales,
        valor_anterior: ventasAnteriores,
        accion_recomendada: 'Revisar estrategia comercial y pipeline inmediatamente'
      });
    } else if (variacionVentas > 30) {
      alertas.push({
        tipo: 'exito',
        categoria: 'performance_general',
        titulo: 'Crecimiento excepcional detectado',
        mensaje: `Las ventas han crecido ${variacionVentas.toFixed(1)}% vs período anterior`,
        valor_actual: ventasActuales,
        valor_anterior: ventasAnteriores,
        accion_recomendada: 'Analizar factores de éxito para replicar estrategia'
      });
    }
  }

  // 2. ALERTAS DE INGRESOS
  if (ingresosAnteriores > 0) {
    const variacionIngresos = ((ingresosActuales - ingresosAnteriores) / ingresosAnteriores) * 100;

    if (variacionIngresos < -25) {
      alertas.push({
        tipo: 'critica',
        categoria: 'ingresos',
        titulo: 'Caída crítica en ingresos',
        mensaje: `Los ingresos han caído ${Math.abs(variacionIngresos).toFixed(1)}% vs período anterior`,
        valor_actual: ingresosActuales,
        valor_anterior: ingresosAnteriores,
        accion_recomendada: 'Enfocarse en ventas de mayor valor y revisar precios'
      });
    }
  }

  // 3. ALERTAS DE ASESORES CRÍTICOS
  const asesoresConCaidas = asesoresCriticos.filter(asesor => {
    const ventasPeriodo = parseFloat(asesor.ventas_periodo || 0);
    const ventasAnterior = parseFloat(asesor.ventas_anterior || 0);

    if (ventasAnterior > 0) {
      const variacion = ((ventasPeriodo - ventasAnterior) / ventasAnterior) * 100;
      return variacion < -30;
    }
    return false;
  });

  if (asesoresConCaidas.length > 0) {
    alertas.push({
      tipo: 'advertencia',
      categoria: 'asesores_criticos',
      titulo: `${asesoresConCaidas.length} asesor(es) con caída significativa`,
      mensaje: `Asesores con caída >30%: ${asesoresConCaidas.slice(0,3).map(a => a.nombre).join(', ')}`,
      asesores_afectados: asesoresConCaidas,
      accion_recomendada: 'Coaching individual urgente y revisión de estrategias'
    });
  }

  // 4. ALERTAS DE CANALES
  const canalPrincipal = canales.length > 0 ? canales[0] : null;
  if (canalPrincipal && canales.length > 1) {
    const participacionPrincipal = parseFloat(canalPrincipal.porcentaje_ventas || 0);

    if (participacionPrincipal > 70) {
      alertas.push({
        tipo: 'advertencia',
        categoria: 'concentracion_canales',
        titulo: 'Alta concentración en un canal',
        mensaje: `${participacionPrincipal.toFixed(1)}% de ventas provienen de ${canalPrincipal.canal_contacto}`,
        canal_dominante: canalPrincipal.canal_contacto,
        porcentaje: participacionPrincipal,
        accion_recomendada: 'Diversificar canales para reducir riesgo de concentración'
      });
    }
  }

  // 5. ALERTAS DE TICKET PROMEDIO
  const ticketActual = parseFloat(kpis.ticket_promedio || 0);
  const ticketAnterior = parseFloat(kpisAnterior.ticket_promedio_anterior || 0);

  if (ticketAnterior > 0) {
    const variacionTicket = ((ticketActual - ticketAnterior) / ticketAnterior) * 100;

    if (variacionTicket < -15) {
      alertas.push({
        tipo: 'advertencia',
        categoria: 'ticket_promedio',
        titulo: 'Reducción en ticket promedio',
        mensaje: `El ticket promedio ha bajado ${Math.abs(variacionTicket).toFixed(1)}%`,
        valor_actual: ticketActual,
        valor_anterior: ticketAnterior,
        accion_recomendada: 'Revisar estrategia de precios y upselling'
      });
    }
  }

  return alertas;
};

/**
 * Generar comparativas temporales detalladas
 */
const generarComparativasTemporales = (kpis, kpisAnterior, periodo) => {
  const ventasActuales = parseFloat(kpis.total_ventas || 0);
  const ventasAnteriores = parseFloat(kpisAnterior.total_ventas_anterior || 0);
  const ingresosActuales = parseFloat(kpis.ingresos_totales || 0);
  const ingresosAnteriores = parseFloat(kpisAnterior.ingresos_totales_anterior || 0);
  const ticketActual = parseFloat(kpis.ticket_promedio || 0);
  const ticketAnterior = parseFloat(kpisAnterior.ticket_promedio_anterior || 0);
  const asesoresActuales = parseFloat(kpis.asesores_activos || 0);
  const asesoresAnteriores = parseFloat(kpisAnterior.asesores_activos_anterior || 0);

  const calcularVariacion = (actual, anterior) => {
    if (anterior === 0) return { porcentaje: 0, tendencia: 'estable' };
    const porcentaje = ((actual - anterior) / anterior) * 100;
    const tendencia = porcentaje > 5 ? 'creciente' : porcentaje < -5 ? 'decreciente' : 'estable';
    return { porcentaje: parseFloat(porcentaje.toFixed(2)), tendencia };
  };

  const variacionVentas = calcularVariacion(ventasActuales, ventasAnteriores);
  const variacionIngresos = calcularVariacion(ingresosActuales, ingresosAnteriores);
  const variacionTicket = calcularVariacion(ticketActual, ticketAnterior);
  const variacionAsesores = calcularVariacion(asesoresActuales, asesoresAnteriores);

  return {
    periodo_actual: periodo,
    resumen: {
      tendencia_general: variacionVentas.tendencia,
      mejora_principal: variacionIngresos.porcentaje > variacionVentas.porcentaje ? 'ingresos' : 'ventas',
      area_atencion: Math.abs(variacionTicket.porcentaje) > 10 ? 'ticket_promedio' : null
    },
    metricas: {
      ventas: {
        actual: ventasActuales,
        anterior: ventasAnteriores,
        variacion: variacionVentas,
        diferencia_absoluta: ventasActuales - ventasAnteriores
      },
      ingresos: {
        actual: ingresosActuales,
        anterior: ingresosAnteriores,
        variacion: variacionIngresos,
        diferencia_absoluta: ingresosActuales - ingresosAnteriores
      },
      ticket_promedio: {
        actual: ticketActual,
        anterior: ticketAnterior,
        variacion: variacionTicket,
        diferencia_absoluta: ticketActual - ticketAnterior
      },
      asesores_activos: {
        actual: asesoresActuales,
        anterior: asesoresAnteriores,
        variacion: variacionAsesores,
        diferencia_absoluta: asesoresActuales - asesoresAnteriores
      }
    }
  };
};

/**
 * Detectar patterns automáticamente
 */
const detectarPatterns = (patternsCanales, tendencias, asesoresCriticos) => {
  const patterns = {};

  // 1. PATTERNS DE CANALES POR DÍA DE LA SEMANA
  if (patternsCanales.length > 0) {
    patterns.canales_dias_semana = patternsCanales.map(canal => {
      const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const ventasPorDia = diasSemana.map(dia => parseInt(canal[dia] || 0));
      const totalVentas = ventasPorDia.reduce((sum, ventas) => sum + ventas, 0);

      const diasTop = diasSemana
        .map((dia, index) => ({ dia, ventas: ventasPorDia[index], porcentaje: totalVentas > 0 ? (ventasPorDia[index] / totalVentas) * 100 : 0 }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 3);

      return {
        canal: canal.canal_contacto,
        total_ventas: totalVentas,
        dias_mas_activos: diasTop,
        pattern_detectado: diasTop[0].porcentaje > 30 ? `Concentrado en ${diasTop[0].dia}` : 'Distribuido uniformemente'
      };
    });
  }

  // 2. PATTERNS DE TENDENCIAS TEMPORALES
  if (tendencias.length >= 7) {
    const ventasPorDia = tendencias.slice(0, 7).map(dia => parseInt(dia.ventas_dia || 0));
    const promedioVentas = ventasPorDia.reduce((sum, v) => sum + v, 0) / ventasPorDia.length;

    const tendenciaReciente = ventasPorDia.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
    const tendenciaAnterior = ventasPorDia.slice(0, 3).reduce((sum, v) => sum + v, 0) / 3;

    patterns.tendencia_semanal = {
      promedio_diario: Math.round(promedioVentas),
      tendencia_reciente: Math.round(tendenciaReciente),
      tendencia_anterior: Math.round(tendenciaAnterior),
      direccion: tendenciaReciente > tendenciaAnterior * 1.1 ? 'ascendente' :
                  tendenciaReciente < tendenciaAnterior * 0.9 ? 'descendente' : 'estable',
      variacion_porcentual: tendenciaAnterior > 0 ? ((tendenciaReciente - tendenciaAnterior) / tendenciaAnterior * 100).toFixed(1) : 0
    };
  }

  // 3. PATTERNS DE PERFORMANCE DE ASESORES
  if (asesoresCriticos.length > 0) {
    const asesoresConCrecimiento = asesoresCriticos.filter(asesor => {
      const actual = parseFloat(asesor.ventas_periodo || 0);
      const anterior = parseFloat(asesor.ventas_anterior || 0);
      return anterior > 0 && actual > anterior * 1.2;
    });

    const asesoresEstables = asesoresCriticos.filter(asesor => {
      const actual = parseFloat(asesor.ventas_periodo || 0);
      const anterior = parseFloat(asesor.ventas_anterior || 0);
      return anterior > 0 && actual >= anterior * 0.8 && actual <= anterior * 1.2;
    });

    patterns.performance_asesores = {
      total_asesores: asesoresCriticos.length,
      asesores_crecimiento: asesoresConCrecimiento.length,
      asesores_estables: asesoresEstables.length,
      asesores_decrecimiento: asesoresCriticos.length - asesoresConCrecimiento.length - asesoresEstables.length,
      top_crecimiento: asesoresConCrecimiento.slice(0, 3).map(a => ({
        nombre: a.nombre,
        crecimiento_porcentual: a.ventas_anterior > 0 ?
          (((a.ventas_periodo - a.ventas_anterior) / a.ventas_anterior) * 100).toFixed(1) : 0
      }))
    };
  }

  return patterns;
};

/**
 * Analizar TOP performers y factores de éxito
 */
const analizarTopPerformers = (topVentas, topIngresos, asesoresCriticos, canales) => {
  const analysis = {};

  // 1. ANÁLISIS DE TOP PERFORMERS POR VENTAS
  if (topVentas.length > 0) {
    const topPerformer = topVentas[0];
    const promedioVentas = topVentas.reduce((sum, asesor) => sum + parseInt(asesor.ventas || 0), 0) / topVentas.length;

    analysis.top_ventas = {
      lider: topPerformer,
      diferencia_vs_promedio: ((parseInt(topPerformer.ventas) - promedioVentas) / promedioVentas * 100).toFixed(1),
      gap_lider_segundo: topVentas.length > 1 ?
        (((parseInt(topPerformer.ventas) - parseInt(topVentas[1].ventas)) / parseInt(topVentas[1].ventas)) * 100).toFixed(1) : 0,
      factores_exito_detectados: [
        `${topPerformer.ventas} ventas (${((parseInt(topPerformer.ventas) / promedioVentas) * 100).toFixed(0)}% del promedio)`,
        `Ticket promedio: $${parseFloat(topPerformer.ticket_promedio || 0).toFixed(0)}`
      ]
    };
  }

  // 2. ANÁLISIS DE TOP PERFORMERS POR INGRESOS
  if (topIngresos.length > 0) {
    const topIngreso = topIngresos[0];
    const promedioIngresos = topIngresos.reduce((sum, asesor) => sum + parseFloat(asesor.ingresos || 0), 0) / topIngresos.length;

    analysis.top_ingresos = {
      lider: topIngreso,
      diferencia_vs_promedio: ((parseFloat(topIngreso.ingresos) - promedioIngresos) / promedioIngresos * 100).toFixed(1),
      eficiencia: `$${(parseFloat(topIngreso.ingresos) / parseInt(topIngreso.ventas || 1)).toFixed(0)} por venta`,
      estrategia_detectada: parseFloat(topIngreso.ticket_promedio) > promedioIngresos ? 'Alto valor por venta' : 'Alto volumen'
    };
  }

  // 3. RECOMENDACIONES BASADAS EN ANÁLISIS
  analysis.recomendaciones = [];

  if (topVentas.length > 1 && topIngresos.length > 1) {
    const liderVentas = topVentas[0];
    const liderIngresos = topIngresos[0];

    if (liderVentas.asesor_id !== liderIngresos.asesor_id) {
      analysis.recomendaciones.push({
        tipo: 'benchmark_interno',
        mensaje: `Combinar volumen de ${liderVentas.asesor_id} con eficiencia de ${liderIngresos.asesor_id}`,
        accion: 'Sesión de intercambio de mejores prácticas'
      });
    }

    // Detectar oportunidades de mejora
    const ticketPromedioGlobal = canales.reduce((sum, canal) => sum + parseFloat(canal.ticket_promedio || 0), 0) / Math.max(canales.length, 1);

    if (ticketPromedioGlobal > 0) {
      const asesoresBajoTicket = [...topVentas, ...topIngresos].filter(asesor =>
        parseFloat(asesor.ticket_promedio || 0) < ticketPromedioGlobal * 0.8
      );

      if (asesoresBajoTicket.length > 0) {
        analysis.recomendaciones.push({
          tipo: 'mejora_ticket',
          mensaje: `${asesoresBajoTicket.length} top performer(s) con ticket promedio bajo`,
          accion: 'Capacitación en upselling y venta consultiva'
        });
      }
    }
  }

  return analysis;
};

// PERÍODOS DISPONIBLES - DASHBOARD EJECUTIVO
const periodosDisponibles = async (req, res) => {
  try {
    console.log('📅 [Períodos Disponibles Ejecutivo] Consultando períodos con ventas');

    // Query para obtener todos los períodos con ventas (sin filtrar por asesor)
    const periodosQuery = `
      SELECT DISTINCT
        EXTRACT(YEAR FROM fecha_venta) as año,
        EXTRACT(MONTH FROM fecha_venta) as mes,
        COUNT(*) as total_ventas,
        COUNT(DISTINCT asesor_id) as asesores_activos
      FROM ventas
      WHERE estado_detallado LIKE 'vendido%'
        AND activo = true
        AND fecha_venta IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM fecha_venta), EXTRACT(MONTH FROM fecha_venta)
      HAVING COUNT(*) > 0
      ORDER BY año DESC, mes DESC
      LIMIT 24
    `;

    const result = await db.query(periodosQuery);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          periodos: {
            semanas: [{ value: 'semana_actual', label: 'Semana Actual', disponible: true }],
            meses: [],
            trimestres: [],
            años: []
          },
          estadisticas: {
            total_periodos: 0,
            periodo_mas_antiguo: null,
            periodo_mas_reciente: null
          }
        }
      });
    }

    // Procesar períodos
    const meses = [];
    const trimestresSet = new Set();
    const añosSet = new Set();

    result.rows.forEach(row => {
      const año = parseInt(row.año);
      const mes = parseInt(row.mes);

      // Validar que año y mes sean números válidos
      if (isNaN(año) || isNaN(mes) || mes < 1 || mes > 12 || año < 2000 || año > 2100) {
        console.warn(`⚠️ Período inválido detectado: año=${año}, mes=${mes}`);
        return; // Saltar este registro
      }

      // Meses individuales
      const fecha = new Date(año, mes - 1, 1);

      // Validar que la fecha sea válida
      if (isNaN(fecha.getTime())) {
        console.warn(`⚠️ Fecha inválida: ${año}-${mes}`);
        return; // Saltar este registro
      }

      const mesLabel = fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
      meses.push({
        value: `${año}-${String(mes).padStart(2, '0')}`,
        label: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1), // Capitalizar
        año,
        mes,
        ventas: parseInt(row.total_ventas),
        asesores: parseInt(row.asesores_activos),
        disponible: true
      });

      // Trimestres
      const trimestre = Math.ceil(mes / 3);
      const trimestreKey = `${año}-Q${trimestre}`;
      trimestresSet.add(JSON.stringify({
        value: trimestreKey,
        label: `Q${trimestre} ${año}`,
        año,
        trimestre,
        disponible: true
      }));

      // Años
      añosSet.add(JSON.stringify({
        value: año.toString(),
        label: año.toString(),
        año,
        disponible: true
      }));
    });

    const trimestres = Array.from(trimestresSet).map(t => JSON.parse(t));
    const años = Array.from(añosSet).map(a => JSON.parse(a));

    const periodoMasReciente = result.rows[0];
    const periodoMasAntiguo = result.rows[result.rows.length - 1];

    console.log(`✅ [Períodos Disponibles Ejecutivo] ${meses.length} meses, ${trimestres.length} trimestres, ${años.length} años`);

    res.json({
      success: true,
      data: {
        periodos: {
          semanas: [{ value: 'semana_actual', label: 'Semana Actual', disponible: true }],
          meses,
          trimestres,
          años
        },
        estadisticas: {
          total_periodos: result.rows.length,
          total_meses: meses.length,
          total_trimestres: trimestres.length,
          total_años: años.length,
          periodo_mas_reciente: {
            año: parseInt(periodoMasReciente.año),
            mes: parseInt(periodoMasReciente.mes),
            ventas: parseInt(periodoMasReciente.total_ventas)
          },
          periodo_mas_antiguo: {
            año: parseInt(periodoMasAntiguo.año),
            mes: parseInt(periodoMasAntiguo.mes),
            ventas: parseInt(periodoMasAntiguo.total_ventas)
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en periodosDisponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  vistaUnificada,
  metasAvanzado,
  sectoresStrategy,
  abcProductos,
  analisisGeografico,
  healthCheck,
  periodosDisponibles
};