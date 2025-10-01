// src/services/prospectosService.js
// Servicio API SUPERIOR - Método unificado con parámetros (Opción 3) - CORREGIDO

const API_BASE_URL = 'http://localhost:3001/api/prospectos';

class ProspectosService {
  
  // ✅ FUNCIÓN PARA OBTENER HEADERS CON AUTHORIZATION
  getAuthHeaders() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('fake-jwt-token-for-testing') || 'fake-jwt-token-for-testing';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Método auxiliar para manejar respuestas
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || `HTTP Error: ${response.status}`);
    }
    return await response.json();
  }

  // ===== CRUD BÁSICO =====
  
  async obtenerTodos(filtros = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const url = queryParams.toString() 
      ? `${API_BASE_URL}?${queryParams.toString()}`
      : API_BASE_URL;
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  async obtenerPorId(id) {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  async crear(prospecto) {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(prospecto)
    });
    return await this.handleResponse(response);
  }

  async actualizar(id, datos) {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(datos)
    });
    return await this.handleResponse(response);
  }

  async obtenerProductosInteres(prospectoId) {
    const response = await fetch(`${API_BASE_URL}/${prospectoId}/productos-interes`, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }
  
  async cambiarEstado(id, nuevoEstado, motivo = '') {
    const response = await fetch(`${API_BASE_URL}/${id}/estado`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ estado: nuevoEstado, motivo })
    });
    return await this.handleResponse(response);
  }

  async cerrarVenta(id, datosVenta = {}) {
    const response = await fetch(`${API_BASE_URL}/${id}/cerrar-venta`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(datosVenta)
    });
    return await this.handleResponse(response);
  }

  // ===== KANBAN BOARD =====
  
  async obtenerKanban(asesorId = null) {
    const url = asesorId 
      ? `${API_BASE_URL}/kanban/${asesorId}`
      : `${API_BASE_URL}/kanban`;
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  // ===== MÉTRICAS ENTERPRISE =====

  async obtenerMetricas(asesorId = null, fechaDesde = null, fechaHasta = null) {
    let url = asesorId
      ? `${API_BASE_URL}/metricas/${asesorId}`
      : `${API_BASE_URL}/metricas`;

    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  /**
   * 📊 NUEVO: Métricas por canal de contacto
   */
  async obtenerMetricasPorCanal(asesorId = null, fechaDesde = null, fechaHasta = null) {
    const params = new URLSearchParams();
    if (asesorId) params.append('asesor_id', asesorId);
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);

    const url = params.toString()
      ? `${API_BASE_URL}/metricas/canales?${params.toString()}`
      : `${API_BASE_URL}/metricas/canales`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  /**
   * 🚀 NUEVO: Analytics completos unificados - Resuelve inconsistencias
   */
  async obtenerAnalyticsCompletos(asesorId = null, periodo = 'mes_actual') {
    try {
      let url = asesorId
        ? `${API_BASE_URL}/analytics-completos/${asesorId}`
        : `${API_BASE_URL}/analytics-completos`;

      const params = new URLSearchParams();
      params.append('periodo', periodo);

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error en obtenerAnalyticsCompletos:', error);
      throw error;
    }
  }

  /**
   * 🎯 NUEVO: Dashboard completo de métricas enterprise
   */
  async obtenerDashboardCompleto(asesorId = null, periodo = 'mes_actual') {
    try {
      // Ejecutar múltiples consultas en paralelo para máximo rendimiento
      const [metricas, canales, seguimientos] = await Promise.all([
        this.obtenerMetricas(asesorId),
        this.obtenerMetricasPorCanal(asesorId),
        this.obtenerDashboardSeguimientos(asesorId)
      ]);

      return {
        success: true,
        data: {
          metricas_generales: metricas.data,
          analisis_canales: canales.data,
          estado_seguimientos: seguimientos.data,
          insights_automaticos: this.generarInsightsUI(metricas.data, canales.data, seguimientos.data)
        }
      };
    } catch (error) {
      console.error('Error en dashboard completo:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🧠 Generar insights para la UI
   */
  generarInsightsUI(metricas, canales, seguimientos) {
    const insights = [];

    // Análisis de performance
    if (metricas?.metricas_avanzadas?.performance_score) {
      const score = parseInt(metricas.metricas_avanzadas.performance_score);
      if (score >= 80) insights.push({ tipo: 'success', mensaje: '🌟 Excelente performance general' });
      else if (score >= 60) insights.push({ tipo: 'warning', mensaje: '⚠️ Performance mejorable' });
      else insights.push({ tipo: 'error', mensaje: '🔴 Performance requiere atención urgente' });
    }

    // Análisis de canales
    if (canales?.ranking_canales?.length > 0) {
      const mejorCanal = canales.ranking_canales[0];
      insights.push({
        tipo: 'info',
        mensaje: `🥇 ${mejorCanal.canal} es tu canal más efectivo`
      });
    }

    // Alertas de seguimientos
    if (seguimientos?.alertas) {
      if (seguimientos.alertas.alto_valor_en_riesgo) {
        insights.push({ tipo: 'error', mensaje: '🚨 Alto valor en riesgo por seguimientos vencidos' });
      }
      if (seguimientos.alertas.efectividad_baja) {
        insights.push({ tipo: 'warning', mensaje: '📉 Efectividad de seguimientos por debajo del 70%' });
      }
    }

    return insights;
  }

  // ===== SEGUIMIENTOS =====
  
  async crearSeguimiento(prospectoId, datosSeguimiento) {
    const response = await fetch(`${API_BASE_URL}/${prospectoId}/seguimiento`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(datosSeguimiento)
    });
    return await this.handleResponse(response);
  }

  async completarSeguimiento(seguimientoId, resultado = '') {
    const response = await fetch(`${API_BASE_URL}/seguimientos/${seguimientoId}/completar`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ resultado })
    });
    return await this.handleResponse(response);
  }

  async posponerSeguimiento(seguimientoId, nuevaFecha, motivo) {
    const response = await fetch(`${API_BASE_URL}/seguimientos/${seguimientoId}/posponer`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ nueva_fecha: nuevaFecha, motivo })
    });
    return await this.handleResponse(response);
  }

  async obtenerDashboardSeguimientos(asesorId = null) {
    const url = asesorId 
      ? `${API_BASE_URL}/dashboard/seguimientos/${asesorId}`
      : `${API_BASE_URL}/dashboard/seguimientos`;
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  // ===== HISTORIAL COMPLETO EMPRESARIAL =====

  /**
   * 📊 Obtener historial completo empresarial con contexto de negocio
   * @param {string} asesorId - ID del asesor
   * @param {Object} filtros - Filtros opcionales
   * @returns {Promise<Object>} Historial completo con métricas
   */
  async obtenerHistorialCompleto(asesorId, filtros = {}) {
    const params = new URLSearchParams();

    // Agregar filtros como query params
    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(key, value);
      }
    });

    const url = params.toString()
      ? `${API_BASE_URL}/seguimientos/historial-completo/${asesorId}?${params.toString()}`
      : `${API_BASE_URL}/seguimientos/historial-completo/${asesorId}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  // ===== UTILIDADES =====
  
  async verificarDuplicado(telefono, excluirId = null) {
    let url = `${API_BASE_URL}/verificar-duplicado/${telefono}`;
    if (excluirId) {
      url += `?excluir_id=${excluirId}`;
    }
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  async obtenerEstados() {
    const response = await fetch(`${API_BASE_URL}/info/estados`, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  async obtenerCanales() {
    const response = await fetch(`${API_BASE_URL}/info/canales`, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  async healthCheck() {
    const response = await fetch(`${API_BASE_URL}/health`, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  // ===== SEGUIMIENTOS AVANZADOS - VERSIÓN SUPERIOR UNIFICADA =====
  
  async obtenerSeguimientosVencidos() {
    const response = await fetch(`${API_BASE_URL}/seguimientos/vencidos`, {
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }

  /**
   * 🚀 MÉTODO PRINCIPAL UNIFICADO - VERSIÓN SUPERIOR
   * Procesa seguimientos vencidos con configuración flexible
   * 
   * @param {Object} opciones - Configuración del procesamiento
   * @param {string} opciones.modo - 'basico' | 'mejorado' 
   * @param {boolean} opciones.incluir_notificaciones - Enviar notificaciones automáticas
   * @param {boolean} opciones.generar_estadisticas - Incluir estadísticas detalladas
   * @param {boolean} opciones.crear_reporte_detallado - Generar reporte completo
   * @param {Object} opciones.filtros - Filtros adicionales (asesor_id, valor_minimo, etc.)
   * 
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async procesarSeguimientosVencidos(opciones = {}) {
    const {
      modo = 'basico',                    // 'basico' | 'mejorado'
      incluir_notificaciones = false,
      generar_estadisticas = false,
      crear_reporte_detallado = false,
      filtros = {}
    } = opciones;

    const response = await fetch(`${API_BASE_URL}/seguimientos/procesar-vencidos`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        modo,
        incluir_notificaciones,
        generar_estadisticas,
        crear_reporte_detallado,
        filtros
      })
    });
    
    return await this.handleResponse(response);
  }

  // ===== MÉTODOS DE CONVENIENCIA (Wrappers para facilidad de uso) =====

  /**
   * 🎯 Procesamiento básico y rápido
   * Compatible con la versión anterior - sin breaking changes
   */
  async procesarSeguimientosBasico() {
    return this.procesarSeguimientosVencidos({ 
      modo: 'basico' 
    });
  }

  /**
   * 🎯 Procesamiento completo con todas las funciones
   * Equivale al antiguo "procesarSeguimientosVencidosMejorado"
   */
  async procesarSeguimientosCompleto() {
    return this.procesarSeguimientosVencidos({ 
      modo: 'mejorado',
      incluir_notificaciones: true,
      generar_estadisticas: true,
      crear_reporte_detallado: true
    });
  }

  /**
   * 🎯 Procesamiento personalizado con opciones específicas
   * Para casos de uso avanzados
   */
  async procesarSeguimientosPersonalizado(opciones) {
    return this.procesarSeguimientosVencidos(opciones);
  }

  /**
   * 🎯 Procesamiento por asesor específico
   * Útil para supervisores que quieren procesar solo un asesor
   */
  async procesarSeguimientosAsesor(asesorId, incluirNotificaciones = true) {
    return this.procesarSeguimientosVencidos({
      modo: 'mejorado',
      incluir_notificaciones: incluirNotificaciones,
      generar_estadisticas: true,
      filtros: { asesor_id: asesorId }
    });
  }

  /**
   * 🎯 Procesamiento de alto valor (prospectos importantes)
   * Solo procesa seguimientos de prospectos con valor estimado alto
   */
  async procesarSeguimientosAltoValor(valorMinimo = 10000) {
    return this.procesarSeguimientosVencidos({
      modo: 'mejorado',
      incluir_notificaciones: true,
      generar_estadisticas: true,
      crear_reporte_detallado: true,
      filtros: { valor_minimo: valorMinimo }
    });
  }

  // ===== COMPATIBILIDAD HACIA ATRÁS =====
  
  /**
   * 🔄 MÉTODO LEGACY - Para compatibilidad hacia atrás
   * @deprecated Usar procesarSeguimientosBasico() o procesarSeguimientosVencidos()
   */
  async procesarSeguimientosVencidosLegacy() {
    console.warn('⚠️ Método deprecado. Usa procesarSeguimientosBasico() o procesarSeguimientosVencidos()');
    return this.procesarSeguimientosBasico();
  }

  // ===== OPERACIONES ADMINISTRATIVAS =====
  
  async corregirSeguimientosNull() {
    const response = await fetch(`${API_BASE_URL}/seguimientos/corregir-null`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return await this.handleResponse(response);
  }
}

// Crear instancia singleton
const prospectosService = new ProspectosService();

// Exportaciones seguras (evitan errores de sintaxis)
export { prospectosService };
export default prospectosService;