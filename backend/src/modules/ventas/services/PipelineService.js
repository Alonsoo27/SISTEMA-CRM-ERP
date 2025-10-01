// ============================================
// PIPELINE SERVICE - VERSIÓN CORREGIDA PARA ESTRUCTURA REAL
// Sistema CRM/ERP v2.0 - Optimizado para tabla prospectos
// ============================================

const db = require('../../../config/database');

class PipelineService {
  
  /**
   * Obtiene métricas principales usando estructura real de prospectos
   */
  static async obtenerMetricasPrincipales(asesorId = null, fechaDesde, fechaHasta) {
    try {
      let whereAsesor = asesorId ? 'AND asesor_id = $3' : '';
      let params = [fechaDesde, fechaHasta];
      if (asesorId) params.push(asesorId);

      const queryText = `
        SELECT 
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE estado = 'Prospecto') as en_prospecto,
          COUNT(*) FILTER (WHERE estado = 'Cotizado') as en_cotizado,
          COUNT(*) FILTER (WHERE estado = 'Negociacion') as en_negociacion,
          COUNT(*) FILTER (WHERE estado = 'Cerrado') as cerrados,
          COUNT(*) FILTER (WHERE estado = 'Perdido') as perdidos,
          
          -- Conversión real usando convertido_venta
          COUNT(*) FILTER (WHERE convertido_venta = true) as total_ventas,
          ROUND(
            COUNT(*) FILTER (WHERE convertido_venta = true)::decimal / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as tasa_conversion_general,
          
          -- Valores usando campos reales (convertidos a USD)
          SUM(valor_estimado / 3.7) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as valor_pipeline_activo,
          AVG(valor_estimado / 3.7) FILTER (WHERE estado = 'Cerrado') as valor_promedio_estimado,
          
          -- Seguimientos usando campos reales
          COUNT(*) FILTER (WHERE seguimiento_vencido = true) as seguimientos_vencidos,
          COUNT(*) FILTER (WHERE seguimiento_obligatorio::date = CURRENT_DATE) as seguimientos_hoy,
          
          -- Tiempo real de cierre
          AVG(
            EXTRACT(days FROM (fecha_cierre - fecha_contacto))
          ) FILTER (WHERE estado = 'Cerrado') as dias_promedio_cierre,
          
          -- Ingresos desde tabla ventas (usando fecha_venta y conversión USD)
          (
            SELECT COALESCE(SUM(
              CASE
                WHEN v.moneda = 'USD' THEN v.valor_final
                WHEN v.moneda = 'PEN' THEN v.valor_final / 3.7
                ELSE v.valor_final / 3.7
              END
            ), 0)
            FROM ventas v
            WHERE v.activo = true
              AND v.fecha_venta::date BETWEEN $1 AND $2
              ${asesorId ? 'AND v.asesor_id = $3' : ''}
          ) as ingresos_totales,

          (
            SELECT COALESCE(AVG(
              CASE
                WHEN v.moneda = 'USD' THEN v.valor_final
                WHEN v.moneda = 'PEN' THEN v.valor_final / 3.7
                ELSE v.valor_final / 3.7
              END
            ), 0)
            FROM ventas v
            WHERE v.activo = true
              AND v.fecha_venta::date BETWEEN $1 AND $2
              ${asesorId ? 'AND v.asesor_id = $3' : ''}
          ) as ticket_promedio
          
        FROM prospectos 
        WHERE activo = true
          AND fecha_contacto::date BETWEEN $1 AND $2
          ${whereAsesor}
      `;

      const result = await db.query(queryText, params);
      return result.rows[0] || {};

    } catch (error) {
      console.error('[PipelineService] Error obtenerMetricasPrincipales:', error);
      throw error;
    }
  }

  /**
   * Distribución por etapas simplificada y real
   */
  static async obtenerDistribucionEtapas(asesorId = null, fechaDesde, fechaHasta) {
    try {
      let whereAsesor = asesorId ? 'AND asesor_id = $3' : '';
      let params = [fechaDesde, fechaHasta];
      if (asesorId) params.push(asesorId);

      const queryText = `
        SELECT 
          estado,
          COUNT(*) as cantidad,
          SUM(valor_estimado / 3.7) as valor_total,
          AVG(valor_estimado / 3.7) as valor_promedio,
          AVG(probabilidad_cierre) as probabilidad_promedio,
          ROUND(
            COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2
          ) as porcentaje
        FROM prospectos 
        WHERE activo = true
          AND fecha_contacto::date BETWEEN $1 AND $2
          ${whereAsesor}
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

      const result = await db.query(queryText, params);
      return result.rows;

    } catch (error) {
      console.error('[PipelineService] Error obtenerDistribucionEtapas:', error);
      throw error;
    }
  }

  /**
   * Tasas de conversión simplificadas y reales
   */
  static async obtenerTasasConversion(asesorId = null, fechaDesde, fechaHasta) {
    try {
      let whereAsesor = asesorId ? 'AND asesor_id = $3' : '';
      let params = [fechaDesde, fechaHasta];
      if (asesorId) params.push(asesorId);

      const queryText = `
        WITH estados_count AS (
          SELECT 
            COUNT(*) FILTER (WHERE estado = 'Prospecto') as prospecto_count,
            COUNT(*) FILTER (WHERE estado = 'Cotizado') as cotizado_count,
            COUNT(*) FILTER (WHERE estado = 'Negociacion') as negociacion_count,
            COUNT(*) FILTER (WHERE estado = 'Cerrado') as cerrado_count,
            COUNT(*) FILTER (WHERE estado = 'Perdido') as perdido_count
          FROM prospectos
          WHERE activo = true
            AND fecha_contacto::date BETWEEN $1 AND $2
            ${whereAsesor}
        )
        SELECT 
          prospecto_count,
          cotizado_count,
          negociacion_count,
          cerrado_count,
          perdido_count,
          
          -- Conversiones entre etapas
          CASE 
            WHEN prospecto_count > 0 THEN 
              ROUND((cotizado_count + negociacion_count + cerrado_count)::decimal / 
                    (prospecto_count + cotizado_count + negociacion_count + cerrado_count) * 100, 2)
            ELSE 0 
          END as tasa_prospecto_avanza,
          
          CASE 
            WHEN cotizado_count > 0 THEN 
              ROUND((negociacion_count + cerrado_count)::decimal / 
                    (cotizado_count + negociacion_count + cerrado_count) * 100, 2)
            ELSE 0 
          END as tasa_cotizado_avanza,
          
          CASE 
            WHEN (cerrado_count + perdido_count) > 0 THEN 
              ROUND(cerrado_count::decimal / (cerrado_count + perdido_count) * 100, 2)
            ELSE 0 
          END as win_rate
          
        FROM estados_count
      `;

      const result = await db.query(queryText, params);
      return result.rows[0] || {};

    } catch (error) {
      console.error('[PipelineService] Error obtenerTasasConversion:', error);
      throw error;
    }
  }

  /**
   * Performance por asesor optimizado
   */
  static async obtenerPerformanceAsesores(fechaDesde, fechaHasta) {
    try {
      const queryText = `
        SELECT 
          p.asesor_id,
          p.asesor_nombre,
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE p.convertido_venta = true) as ventas_cerradas,
          ROUND(
            COUNT(*) FILTER (WHERE p.convertido_venta = true)::decimal / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as tasa_conversion,
          SUM(valor_estimado / 3.7) FILTER (WHERE estado IN ('Prospecto', 'Cotizado', 'Negociacion')) as pipeline_activo,
          COUNT(*) FILTER (WHERE seguimiento_vencido = true) as seguimientos_pendientes,
          
          -- Ingresos reales desde ventas (conversión USD)
          COALESCE(SUM(
            CASE
              WHEN v.moneda = 'USD' THEN v.valor_final
              WHEN v.moneda = 'PEN' THEN v.valor_final / 3.7
              ELSE v.valor_final / 3.7
            END
          ), 0) as ingresos_generados,
          
          AVG(
            EXTRACT(days FROM (p.fecha_cierre - p.fecha_contacto))
          ) FILTER (WHERE p.estado = 'Cerrado') as dias_promedio_cierre
          
        FROM prospectos p
        LEFT JOIN ventas v ON p.venta_id = v.id AND p.convertido_venta = true
        WHERE p.activo = true
          AND p.fecha_contacto::date BETWEEN $1 AND $2
          AND p.asesor_id IS NOT NULL
        GROUP BY p.asesor_id, p.asesor_nombre
        HAVING COUNT(*) > 0
        ORDER BY tasa_conversion DESC, ventas_cerradas DESC
      `;

      const result = await db.query(queryText, [fechaDesde, fechaHasta]);
      return result.rows;

    } catch (error) {
      console.error('[PipelineService] Error obtenerPerformanceAsesores:', error);
      throw error;
    }
  }

  /**
   * Pipeline actual simplificado
   */
  static async obtenerPipelineActual(asesorId = null) {
    try {
      let whereAsesor = asesorId ? 'AND asesor_id = $1' : '';
      let params = asesorId ? [asesorId] : [];

      const queryText = `
        SELECT 
          estado,
          COUNT(*) as cantidad,
          SUM(valor_estimado / 3.7) as valor_total,
          AVG(probabilidad_cierre) as probabilidad_promedio,
          SUM((valor_estimado / 3.7) * (probabilidad_cierre / 100.0)) as valor_ponderado
        FROM prospectos 
        WHERE activo = true
          AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
          ${whereAsesor}
        GROUP BY estado
        ORDER BY 
          CASE estado 
            WHEN 'Prospecto' THEN 1
            WHEN 'Cotizado' THEN 2  
            WHEN 'Negociacion' THEN 3
          END
      `;

      const result = await db.query(queryText, params);
      return result.rows;

    } catch (error) {
      console.error('[PipelineService] Error obtenerPipelineActual:', error);
      throw error;
    }
  }

  /**
   * Análisis de embudo usando métodos optimizados
   */
  static async obtenerAnalisisEmbudo(asesorId = null, fechaDesde, fechaHasta) {
    try {
      const distribucion = await this.obtenerDistribucionEtapas(asesorId, fechaDesde, fechaHasta);
      const tasas = await this.obtenerTasasConversion(asesorId, fechaDesde, fechaHasta);
      
      return {
        distribucion_etapas: distribucion,
        tasas_conversion: tasas,
        embudo_visual: distribucion.map(etapa => ({
          etapa: etapa.estado,
          cantidad: parseInt(etapa.cantidad),
          valor: parseFloat(etapa.valor_total || 0),
          porcentaje: parseFloat(etapa.porcentaje || 0)
        }))
      };

    } catch (error) {
      console.error('[PipelineService] Error obtenerAnalisisEmbudo:', error);
      throw error;
    }
  }

  /**
   * Proyección usando probabilidades reales
   */
  static async calcularProyeccionVentas(asesorId = null) {
    try {
      let whereAsesor = asesorId ? 'AND asesor_id = $1' : '';
      let params = asesorId ? [asesorId] : [];

      const queryText = `
        SELECT 
          estado,
          COUNT(*) as cantidad_oportunidades,
          SUM(valor_estimado / 3.7) as valor_pipeline,
          AVG(probabilidad_cierre) as probabilidad_promedio,
          SUM((valor_estimado / 3.7) * (probabilidad_cierre / 100.0)) as valor_proyectado
        FROM prospectos 
        WHERE activo = true
          AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
          ${whereAsesor}
        GROUP BY estado
        ORDER BY 
          CASE estado 
            WHEN 'Prospecto' THEN 1
            WHEN 'Cotizado' THEN 2  
            WHEN 'Negociacion' THEN 3
          END
      `;

      const result = await db.query(queryText, params);
      
      const proyeccionTotal = result.rows.reduce((total, etapa) => {
        return total + parseFloat(etapa.valor_proyectado || 0);
      }, 0);

      return {
        proyeccion_por_etapa: result.rows,
        proyeccion_total: proyeccionTotal,
        fecha_calculo: new Date().toISOString()
      };

    } catch (error) {
      console.error('[PipelineService] Error calcularProyeccionVentas:', error);
      throw error;
    }
  }

  /**
   * Seguimientos críticos usando campos reales
   */
  static async obtenerSeguimientosCriticos(asesorId = null) {
    try {
      let whereAsesor = asesorId ? 'AND asesor_id = $1' : '';
      let params = asesorId ? [asesorId] : [];

      const queryText = `
        SELECT 
          id,
          codigo,
          nombre_cliente,
          apellido_cliente,
          empresa,
          telefono,
          estado,
          valor_estimado,
          probabilidad_cierre,
          seguimiento_obligatorio,
          seguimiento_vencido,
          asesor_nombre,
          observaciones,
          
          -- Días de retraso calculado
          CASE 
            WHEN seguimiento_vencido THEN 
              EXTRACT(days FROM (CURRENT_TIMESTAMP - seguimiento_obligatorio))
            ELSE 
              EXTRACT(days FROM (seguimiento_obligatorio - CURRENT_TIMESTAMP))
          END as dias_diferencia,
          
          -- Criticidad basada en valor y probabilidad
          CASE 
            WHEN valor_estimado >= 1000 AND probabilidad_cierre >= 70 THEN 'vencido'
            WHEN valor_estimado >= 500 AND probabilidad_cierre >= 50 THEN 'proximo_vencer'  
            WHEN seguimiento_vencido THEN 'vencido'
            ELSE 'normal'
          END as criticidad
          
        FROM prospectos 
        WHERE activo = true
          AND estado IN ('Prospecto', 'Cotizado', 'Negociacion')
          AND (
            seguimiento_vencido = true 
            OR seguimiento_obligatorio::date <= CURRENT_DATE + INTERVAL '3 days'
          )
          ${whereAsesor}
        ORDER BY 
          CASE criticidad 
            WHEN 'vencido' THEN 1
            WHEN 'proximo_vencer' THEN 2
            ELSE 3
          END,
          valor_estimado DESC,
          seguimiento_obligatorio ASC
      `;

      const result = await db.query(queryText, params);
      return result.rows;

    } catch (error) {
      console.error('[PipelineService] Error obtenerSeguimientosCriticos:', error);
      throw error;
    }
  }
}

module.exports = PipelineService;