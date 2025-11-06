// src/services/pipelineService.js
// Cliente API para métricas de Pipeline - VERSIÓN CORREGIDA
import { API_CONFIG } from '../config/apiConfig';

const API_BASE_URL = `${API_CONFIG.BASE_URL}/api/ventas/pipeline`;

class PipelineService {

  // Función para obtener headers con authorization
  getAuthHeaders() {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Método auxiliar para manejar respuestas
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP Error: ${response.status}` 
      }));
      throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
    }
    return await response.json();
  }

  /**
   * Obtiene dashboard principal de pipeline
   * @param {string|null} asesorId - ID del asesor (opcional)
   * @param {string} periodo - Período de consulta
   * @returns {Promise<Object>} Métricas completas del pipeline
   */
  async obtenerDashboardPipeline(asesorId = null, periodo = 'mes_actual') {
    try {
      const params = new URLSearchParams();
      if (asesorId) params.append('asesor_id', asesorId);
      params.append('periodo', periodo);

      const url = `${API_BASE_URL}/dashboard?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error obteniendo dashboard pipeline:', error);
      throw error;
    }
  }

  /**
   * Obtiene análisis detallado del embudo de conversión
   * @param {string|null} asesorId - ID del asesor (opcional)
   * @param {string} periodo - Período de consulta
   * @returns {Promise<Object>} Análisis del embudo
   */
  async obtenerAnalisisEmbudo(asesorId = null, periodo = 'mes_actual') {
    try {
      const params = new URLSearchParams();
      if (asesorId) params.append('asesor_id', asesorId);
      params.append('periodo', periodo);

      const url = `${API_BASE_URL}/embudo?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error obteniendo análisis embudo:', error);
      throw error;
    }
  }

  /**
   * Obtiene proyección de ventas basada en pipeline actual
   * @param {string|null} asesorId - ID del asesor (opcional)
   * @returns {Promise<Object>} Proyección de ventas
   */
  async obtenerProyeccionVentas(asesorId = null) {
    try {
      const params = new URLSearchParams();
      if (asesorId) params.append('asesor_id', asesorId);

      const url = `${API_BASE_URL}/proyeccion?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error obteniendo proyección ventas:', error);
      throw error;
    }
  }

  /**
   * Obtiene seguimientos críticos (vencidos o próximos a vencer)
   * @param {string|null} asesorId - ID del asesor (opcional)
   * @returns {Promise<Object>} Lista de seguimientos críticos
   */
  async obtenerSeguimientosCriticos(asesorId = null) {
    try {
      const params = new URLSearchParams();
      if (asesorId) params.append('asesor_id', asesorId);

      const url = `${API_BASE_URL}/seguimientos-criticos?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error obteniendo seguimientos críticos:', error);
      throw error;
    }
  }

  /**
   * Health check del servicio
   */
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error en health check:', error);
      throw error;
    }
  }

  /**
   * Método de conveniencia para obtener todos los datos del dashboard
   * Backend v3.0 - Retorna estructura plana para fácil acceso
   * @param {string|null} asesorId - ID del asesor (opcional)
   * @param {string} periodo - Período de consulta
   * @returns {Promise<Object>} Todos los datos del dashboard en estructura plana
   */
  async obtenerDashboardCompleto(asesorId = null, periodo = 'mes_actual') {
    try {
      // Llamadas en paralelo para mejor performance
      const [dashboardResult, embudoResult, proyeccionResult, criticosResult] = await Promise.allSettled([
        this.obtenerDashboardPipeline(asesorId, periodo),
        this.obtenerAnalisisEmbudo(asesorId, periodo),
        this.obtenerProyeccionVentas(asesorId),
        this.obtenerSeguimientosCriticos(asesorId)
      ]);

      // Extraer datos con manejo de errores
      const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value.data : null;
      const embudo = embudoResult.status === 'fulfilled' ? embudoResult.value.data : null;
      const proyeccion = proyeccionResult.status === 'fulfilled' ? proyeccionResult.value.data : null;
      const criticosData = criticosResult.status === 'fulfilled' ? criticosResult.value.data : null;

      // Log de errores si los hay
      [dashboardResult, embudoResult, proyeccionResult, criticosResult].forEach((result, index) => {
        if (result.status === 'rejected') {
          const endpoints = ['dashboard', 'embudo', 'proyección', 'seguimientos críticos'];
          console.warn(`Error en ${endpoints[index]}:`, result.reason);
        }
      });

      // Estructura plana para fácil acceso desde el componente
      // Merge de datos del dashboard principal con otros endpoints
      return {
        success: true,
        data: {
          // Dashboard principal (contiene kpis_principales, kpis_secundarios, etc.)
          ...dashboard,

          // Embudo de conversión
          embudo,

          // Proyección de ventas
          proyeccion,

          // Seguimientos críticos (extraer el array directamente)
          seguimientos_criticos: criticosData?.seguimientos_criticos || [],
          metricas_seguimientos: criticosData?.metricas || null,
          recomendacion_seguimientos: criticosData?.recomendacion || null
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error obteniendo dashboard completo:', error);
      throw new Error(`Error general del dashboard: ${error.message}`);
    }
  }

  /**
   * Método utilitario para validar conexión con backend
   */
  async validarConexion() {
    try {
      await this.healthCheck();
      return { conectado: true, mensaje: 'Conexión exitosa' };
    } catch (error) {
      return { 
        conectado: false, 
        mensaje: `Error de conexión: ${error.message}`,
        url: API_BASE_URL 
      };
    }
  }
}

// Crear instancia singleton
const pipelineService = new PipelineService();

// Exportaciones
export { pipelineService };
export default pipelineService;