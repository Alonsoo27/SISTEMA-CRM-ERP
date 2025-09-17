// dashboardEjecutivoController.js - VERSIÓN CORREGIDA
// Ubicación: backend/src/modules/ventas/controllers/dashboardEjecutivoController.js

const db = require('../../../config/database');

// Función auxiliar para obtener fechas según período
const obtenerFechasPeriodo = (periodo) => {
  const hoy = new Date();
  let fechaInicio, fechaFin;
  
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
    case 'mes_actual':
    default:
      fechaInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      fechaFin = new Date().toISOString().split('T')[0];
      break;
  }
  
  return { fechaInicio, fechaFin };
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
        COUNT(DISTINCT COALESCE(sector, 'Sin Sector')) as sectores_atendidos,
        COUNT(DISTINCT canal_contacto) as canales_activos
      FROM ventas 
      WHERE estado_detallado = 'vendido' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
    `;

    // Query 2: TOP asesores por ventas (sin ROUND problemático)
    const topAsesorVentasQuery = `
      SELECT 
        asesor_id,
        COUNT(*) as ventas,
        COALESCE(SUM(valor_final), 0) as ingresos,
        COALESCE(AVG(valor_final), 0) as ticket_promedio
      FROM ventas 
      WHERE estado_detallado = 'vendido' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY asesor_id
      ORDER BY ventas DESC
      LIMIT 3
    `;

    // Query 3: TOP asesores por ingresos
    const topAsesorIngresosQuery = `
      SELECT 
        asesor_id,
        COALESCE(SUM(valor_final), 0) as ingresos,
        COUNT(*) as ventas,
        COALESCE(AVG(valor_final), 0) as ticket_promedio
      FROM ventas 
      WHERE estado_detallado = 'vendido' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY asesor_id
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
      WHERE estado_detallado = 'vendido' 
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
      WHERE estado_detallado = 'vendido' 
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
      WHERE estado_detallado = 'vendido' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY tipo_venta
      ORDER BY cantidad DESC
    `;

    // Ejecutar queries con manejo individual de errores
    const resultados = await Promise.allSettled([
      db.query(kpisGeneralesQuery, [fechaInicio, fechaFin]),
      db.query(topAsesorVentasQuery, [fechaInicio, fechaFin]),
      db.query(topAsesorIngresosQuery, [fechaInicio, fechaFin]),
      db.query(distributionCanalQuery, [fechaInicio, fechaFin]),
      db.query(tendenciasQuery),
      db.query(tiposVentaQuery, [fechaInicio, fechaFin])
    ]);

    // Extraer resultados con manejo seguro
    const [kpisResult, topVentasResult, topIngresosResult, canalResult, tendenciasResult, tiposResult] = resultados;

    const kpis = kpisResult.status === 'fulfilled' ? kpisResult.value.rows[0] : {};
    const topVentas = topVentasResult.status === 'fulfilled' ? topVentasResult.value.rows : [];
    const topIngresos = topIngresosResult.status === 'fulfilled' ? topIngresosResult.value.rows : [];
    const canales = canalResult.status === 'fulfilled' ? canalResult.value.rows : [];
    const tendencias = tendenciasResult.status === 'fulfilled' ? tendenciasResult.value.rows : [];
    const tipos = tiposResult.status === 'fulfilled' ? tiposResult.value.rows : [];

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

    const responseData = {
      periodo,
      fechas: { fechaInicio, fechaFin },
      kpis_generales: kpis,
      top_asesores_ventas: topVentas,
      top_asesores_ingresos: topIngresos,
      distribucion_canales: canales,
      tendencias_15_dias: tendencias,
      tipos_venta: tipos
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
    const { fechaInicio, fechaFin } = obtenerFechasPeriodo(periodo);

    console.log(`[Metas Avanzado] Consultando período: ${periodo}`);

    // Buscar el mes más reciente con datos disponibles
    const mesRecienteQuery = `
      SELECT año, mes 
      FROM metas_ventas 
      WHERE activo = true 
      ORDER BY año DESC, mes DESC 
      LIMIT 1
    `;

    const mesRecienteResult = await db.query(mesRecienteQuery);

    if (mesRecienteResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          periodo,
          fechas: { fechaInicio, fechaFin },
          dias_total: 0,
          dias_transcurridos: 0,
          progreso_periodo: 0,
          asesores_metas: [],
          mensaje: 'No hay metas configuradas en el sistema'
        }
      });
    }

    const { año, mes } = mesRecienteResult.rows[0];
    console.log(`[Metas Avanzado] Usando datos del período: ${año}-${mes}`);

    // Query principal: obtener metas_ventas con datos de asesores
    const metasVentasQuery = `
      SELECT 
        mv.asesor_id,
        mv.meta_valor,
        mv.valor_logrado,
        mv.porcentaje_valor,
        mv.ventas_logradas,
        mv.año,
        mv.mes,
        u.nombre,
        u.apellido,
        u.email,
        
        -- Obtener modalidad del asesor
        COALESCE(mb.nombre, 'solo_ventas') as modalidad
        
      FROM metas_ventas mv
      INNER JOIN usuarios u ON mv.asesor_id = u.id
      LEFT JOIN asesor_configuracion_bonos acb ON mv.asesor_id = acb.asesor_id AND acb.activo = true
      LEFT JOIN modalidades_bono mb ON acb.modalidad_bono_id = mb.id
      WHERE mv.activo = true 
        AND mv.año = $1 
        AND mv.mes = $2
      ORDER BY mv.porcentaje_valor DESC
    `;

    const metasResult = await db.query(metasVentasQuery, [año, mes]);

    if (metasResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          periodo,
          fechas: { fechaInicio, fechaFin },
          dias_total: 0,
          dias_transcurridos: 0,
          progreso_periodo: 0,
          asesores_metas: [],
          mensaje: 'No hay metas configuradas para el período actual'
        }
      });
    }

    // Importar ComisionesController para cálculos de bonos
    const ComisionesController = require('./ComisionesController');

    // Calcular días del período
    const fechaInicioObj = new Date(fechaInicio);
    const fechaFinObj = new Date(fechaFin);
    const fechaActual = new Date();
    
    const diasTotal = Math.ceil((fechaFinObj - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;
    const diasTranscurridos = Math.ceil((fechaActual - fechaInicioObj) / (1000 * 60 * 60 * 24)) + 1;
    const progresoPorcentaje = calcularPorcentajeSafe(diasTranscurridos, diasTotal);

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
          // Modalidad solo_ventas
          const bonoSimple = ComisionesController.calcularBono(
            asesor.meta_valor, 
            asesor.valor_logrado
          );
          calculoBono = {
            porcentaje_ventas: bonoSimple.porcentaje,
            bono_final: bonoSimple.bono,
            nivel: bonoSimple.nivel,
            mensaje: bonoSimple.mensaje,
            modalidad: 'solo_ventas',
            actividad: null
          };
        }

        // Calcular siguiente nivel usando tu sistema
        const siguienteNivel = ComisionesController.calcularSiguienteNivel(
          asesor.meta_valor, 
          asesor.valor_logrado
        );

        // Proyecciones simples basadas en tendencia
        const proyeccionVentas = diasTranscurridos > 0 ? 
          Math.round((asesor.ventas_logradas / diasTranscurridos) * diasTotal) : 0;
        
        const proyeccionIngresos = diasTranscurridos > 0 ? 
          Math.round((asesor.valor_logrado / diasTranscurridos) * diasTotal) : 0;

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
          probabilidad_cumplimiento: asesor.porcentaje_valor >= progresoPorcentaje ? 'Alta' : 'Riesgo'
        };
      })
    );

    // Métricas consolidadas del equipo
    const totalMetas = asesorConMetas.reduce((sum, a) => sum + a.meta_usd, 0);
    const totalLogrado = asesorConMetas.reduce((sum, a) => sum + a.valor_logrado_usd, 0);
    const totalBonos = asesorConMetas.reduce((sum, a) => sum + a.bono_actual, 0);
    
    const metricsEquipo = {
      total_asesores: asesorConMetas.length,
      meta_total_usd: totalMetas,
      logrado_total_usd: totalLogrado,
      bonos_total_usd: totalBonos,
      promedio_cumplimiento: totalMetas > 0 ? ((totalLogrado / totalMetas) * 100).toFixed(2) : 0,
      asesores_con_bono: asesorConMetas.filter(a => a.bono_actual > 0).length,
      asesores_en_riesgo: asesorConMetas.filter(a => a.probabilidad_cumplimiento === 'Riesgo').length
    };

    console.log(`✅ Metas avanzado procesado: ${asesorConMetas.length} asesores del ${año}-${mes}`);

    res.json({
      success: true,
      data: {
        periodo: `${año}-${String(mes).padStart(2, '0')}`,
        fechas: { fechaInicio, fechaFin },
        dias_total: diasTotal,
        dias_transcurridos: diasTranscurridos,
        progreso_periodo: progresoPorcentaje,
        asesores_metas: asesorConMetas,
        metricas_equipo: metricsEquipo
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
      WHERE estado_detallado = 'vendido' 
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
      WHERE estado_detallado = 'vendido' 
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

    // Query básico de productos
    const productosQuery = `
      SELECT 
        vd.producto_id,
        SUM(vd.total_linea) as ingresos_totales,
        SUM(vd.cantidad) as cantidad_total,
        COUNT(*) as veces_vendido,
        COUNT(DISTINCT v.asesor_id) as asesores_que_vendieron,
        AVG(vd.precio_unitario) as precio_promedio,
        MIN(v.fecha_venta) as primera_venta,
        MAX(v.fecha_venta) as ultima_venta
      FROM venta_detalles vd
      INNER JOIN ventas v ON vd.venta_id = v.id
      WHERE v.estado_detallado = 'vendido' 
        AND v.activo = true
        AND vd.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY vd.producto_id
      ORDER BY ingresos_totales DESC
    `;

    // Query productos por asesor
    const productosAsesorQuery = `
      SELECT 
        v.asesor_id,
        COUNT(DISTINCT vd.producto_id) as productos_unicos,
        SUM(vd.cantidad) as cantidad_total,
        COALESCE(SUM(vd.total_linea), 0) as ingresos_productos,
        COALESCE(AVG(vd.precio_unitario), 0) as precio_promedio,
        COUNT(*) as lineas_vendidas
      FROM ventas v
      INNER JOIN venta_detalles vd ON v.id = vd.venta_id
      WHERE v.estado_detallado = 'vendido' 
        AND v.activo = true
        AND vd.activo = true
        AND v.fecha_venta BETWEEN $1 AND $2
      GROUP BY v.asesor_id
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
      WHERE v.estado_detallado = 'vendido' 
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
        COUNT(DISTINCT COALESCE(sector, 'Sin Sector')) as sectores,
        MIN(fecha_venta) as primera_venta,
        MAX(fecha_venta) as ultima_venta
      FROM ventas 
      WHERE estado_detallado = 'vendido' 
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
        COUNT(DISTINCT asesor_id) as asesores_activos,
        COUNT(DISTINCT COALESCE(sector, 'Sin Sector')) as sectores
      FROM ventas 
      WHERE estado_detallado = 'vendido' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY ciudad, departamento
      ORDER BY ingresos_totales DESC
      LIMIT 15
    `;

    // Cobertura por asesor
    const coberturaQuery = `
      SELECT 
        asesor_id,
        COUNT(DISTINCT departamento) as departamentos_cubiertos,
        COUNT(DISTINCT ciudad) as ciudades_cubiertas,
        COUNT(*) as ventas_totales,
        COALESCE(SUM(valor_final), 0) as ingresos_totales
      FROM ventas 
      WHERE estado_detallado = 'vendido' 
        AND activo = true
        AND fecha_venta BETWEEN $1 AND $2
      GROUP BY asesor_id
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
        matriz_asesor_ciudad: [] // Simplificado por ahora
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

module.exports = {
  vistaUnificada,
  metasAvanzado,
  sectoresStrategy,
  abcProductos,
  analisisGeografico,
  healthCheck
};