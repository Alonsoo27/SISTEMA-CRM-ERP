// src/services/actividadService.js - VERSIÓN COMPLETA FINAL
import axios from 'axios';
import { AuthUtils } from '../utils/auth';

const API_BASE_URL = 'http://localhost:3001/api';

class ActividadService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar JWT automáticamente
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        console.error('Error en request interceptor:', error);
        return Promise.reject(error);
      }
    );

    // Interceptor para manejo centralizado de errores
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleAuthError();
        }
        return Promise.reject(error);
      }
    );
  }

  // Obtener token del localStorage (PATRÓN LIMPIO)
  getAuthToken() {
    return AuthUtils.getAuthToken();
  }

  // Manejar error de autenticación (PATRÓN LIMPIO)
  handleAuthError() {
    AuthUtils.handleAuthError();
  }

  // ===============================
  // MÉTODOS PRINCIPALES
  // ===============================

  // Obtener estado de actividad de hoy
  async getEstadoHoy() {
    try {
      console.log('🔄 Llamando getEstadoHoy...');
      
      const response = await this.apiClient.get('/actividad/estado-hoy');
      
      console.log('📡 Raw response:', response.data);
      
      return response.data; // El backend ya devuelve { success: true, data: {...} }
      
    } catch (error) {
      console.error('❌ Error en getEstadoHoy:', error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  // Realizar check-in
  async checkIn(datosCheckIn = {}) {
    try {
      console.log('🔄 Llamando checkIn con:', datosCheckIn);
      
      const response = await this.apiClient.post('/actividad/check-in', datosCheckIn);
      
      console.log('📡 CheckIn response:', response.data);
      
      return response.data; // El backend ya devuelve { success: true, data: {...} }
      
    } catch (error) {
      console.error('❌ Error en checkIn:', error);
      console.error('📋 Error response data:', error.response?.data);
      console.error('📋 Error status:', error.response?.status);
      console.error('📋 Error message:', error.response?.data?.message);
      console.error('📋 Error details:', error.response?.data?.errores);
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  // Realizar check-out
  async checkOut(datosCheckOut = {}) {
    try {
      console.log('🔄 Llamando checkOut con:', datosCheckOut);
      
      const response = await this.apiClient.post('/actividad/check-out', datosCheckOut);
      
      console.log('📡 CheckOut response:', response.data);
      
      return response.data; // El backend ya devuelve { success: true, data: {...} }
      
    } catch (error) {
      console.error('❌ Error en checkOut:', error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  // Validar disponibilidad de check-in
  async validarCheckIn() {
    try {
      const response = await this.apiClient.get('/actividad/validar-checkin');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error validando check-in',
        details: error.response?.data
      };
    }
  }

  // Validar disponibilidad de check-out
  async validarCheckOut() {
    try {
      const response = await this.apiClient.get('/actividad/validar-checkout');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error validando check-out',
        details: error.response?.data
      };
    }
  }

  // Obtener actividad (histórico) con filtros
  async getActividad(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      // Agregar filtros como query parameters
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
      if (filtros.asesor_id) params.append('asesor_id', filtros.asesor_id);
      if (filtros.tipo) params.append('tipo', filtros.tipo);
      if (filtros.pagina) params.append('pagina', filtros.pagina);
      if (filtros.limite) params.append('limite', filtros.limite);
      
      const response = await this.apiClient.get(`/actividad?${params.toString()}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo actividad',
        details: error.response?.data
      };
    }
  }

  // Obtener dashboard de actividad
  async getDashboard(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
      if (filtros.asesor_id) params.append('asesor_id', filtros.asesor_id);
      
      const response = await this.apiClient.get(`/actividad/dashboard?${params.toString()}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo dashboard',
        details: error.response?.data
      };
    }
  }

  // Test de conexión
  async testConexion() {
    try {
      const response = await this.apiClient.get('/actividad/test');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // MÉTODOS PARA HISTORIAL
  // ===============================

  // Obtener historial de actividad con paginación
  async getHistorial(params = {}) {
    try {
      console.log('🔄 Llamando getHistorial con params:', params);
      
      const queryParams = new URLSearchParams();
      
      // Agregar parámetros opcionales
      if (params.fecha_inicio) queryParams.append('fecha_inicio', params.fecha_inicio);
      if (params.fecha_fin) queryParams.append('fecha_fin', params.fecha_fin);
      if (params.limite) queryParams.append('limite', params.limite);
      if (params.pagina) queryParams.append('pagina', params.pagina);
      if (params.orden_por) queryParams.append('orden_por', params.orden_por);
      if (params.direccion) queryParams.append('direccion', params.direccion);
      if (params.usuario_id) queryParams.append('usuario_id', params.usuario_id);
      
      // Valores por defecto para el historial del componente
      if (!params.limite) queryParams.append('limite', '30'); // Más registros por defecto
      if (!params.pagina) queryParams.append('pagina', '1');
      if (!params.orden_por) queryParams.append('orden_por', 'fecha'); // Ordenar por fecha
      if (!params.direccion) queryParams.append('direccion', 'desc'); // Más recientes primero
      
      const response = await this.apiClient.get(`/actividad/historial?${queryParams.toString()}`);
      
      console.log('📡 Historial response:', response.data);
      
      return response.data; // El backend debe devolver { success: true, data: { registros: [...] } }
      
    } catch (error) {
      console.error('❌ Error en getHistorial:', error);
      console.error('📋 Error details:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  // Obtener estadísticas rápidas de actividad
  async getEstadisticasRapidas(dias = 7) {
    try {
      console.log(`🔄 Llamando getEstadisticasRapidas para ${dias} días...`);
      
      const response = await this.apiClient.get(`/actividad/estadisticas-rapidas?dias=${dias}`);
      
      console.log('📡 Estadísticas response:', response.data);
      
      return response.data; // El backend debe devolver { success: true, data: {...} }
      
    } catch (error) {
      console.error('❌ Error en getEstadisticasRapidas:', error);
      console.error('📋 Error details:', error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  // Obtener resumen semanal (método bonus)
  async getResumenSemanal() {
    try {
      console.log('🔄 Llamando getResumenSemanal...');
      
      const response = await this.apiClient.get('/actividad/resumen-semanal');
      
      console.log('📡 Resumen semanal response:', response.data);
      
      return response.data; // El backend debe devolver { success: true, data: {...} }
      
    } catch (error) {
      console.error('❌ Error en getResumenSemanal:', error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  // Generar datos de prueba para historial (solo desarrollo)
  getHistorialMock() {
    const registrosMock = [];
    const ahora = new Date();
    
    for (let i = 0; i < 15; i++) {
      const fecha = new Date(ahora);
      fecha.setDate(fecha.getDate() - i);
      
      const checkInHour = 8 + Math.floor(Math.random() * 2); // 8-9 AM
      const checkOutHour = 17 + Math.floor(Math.random() * 2); // 5-6 PM
      
      const checkInTime = new Date(fecha);
      checkInTime.setHours(checkInHour, Math.floor(Math.random() * 60));
      
      const checkOutTime = new Date(fecha);
      checkOutTime.setHours(checkOutHour, Math.floor(Math.random() * 60));
      
      const horas = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      
      registrosMock.push({
        id: i + 1,
        fecha: fecha.toISOString().split('T')[0],
        estado_jornada: i < 13 ? 'finalizada' : (i === 13 ? 'en_progreso' : 'sin_iniciar'),
        check_in_time: i < 14 ? checkInTime.toISOString() : null,
        check_out_time: i < 13 ? checkOutTime.toISOString() : null,
        horas_calculadas: i < 13 ? parseFloat(horas.toFixed(1)) : 0,
        total_mensajes_recibidos: i < 14 ? Math.floor(Math.random() * 50) + 10 : 0,
        total_llamadas: i < 14 ? Math.floor(Math.random() * 15) + 2 : 0
      });
    }
    
    return {
      success: true,
      data: {
        registros: registrosMock,
        total: registrosMock.length,
        pagina: 1,
        limite: 30
      }
    };
  }

  // ===============================
  // MÉTODOS DE UTILIDAD
  // ===============================

  // Formatear tiempo
  formatearTiempo(minutos) {
    if (!minutos || isNaN(minutos)) return '0:00';
    
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    return `${horas}:${minutosRestantes.toString().padStart(2, '0')}`;
  }

  // Calcular tiempo trabajado entre dos fechas
  calcularTiempoTrabajado(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 0;
    
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    const diferenciaMs = fin.getTime() - inicio.getTime();
    return Math.floor(diferenciaMs / (1000 * 60)); // Retorna minutos
  }

  // Validar datos de check-in
  validarFormatoCheckIn(datos) {
    const errores = [];
    
    if (datos.ubicacion && (!datos.ubicacion.lat || !datos.ubicacion.lng)) {
      errores.push('Coordenadas de ubicación incompletas');
    }
    
    if (datos.comentario && datos.comentario.length > 500) {
      errores.push('Comentario no puede exceder 500 caracteres');
    }
    
    return {
      valido: errores.length === 0,
      errores
    };
  }

  // Validar datos de check-out
  validarFormatoCheckOut(datos) {
    const errores = [];
    
    if (datos.resumen_actividades && datos.resumen_actividades.length > 1000) {
      errores.push('Resumen de actividades no puede exceder 1000 caracteres');
    }
    
    if (datos.objetivos_pendientes && datos.objetivos_pendientes.length > 500) {
      errores.push('Objetivos pendientes no puede exceder 500 caracteres');
    }
    
    return {
      valido: errores.length === 0,
      errores
    };
  }
}

// Instancia singleton del servicio
const actividadService = new ActividadService();

console.log('✅ ActividadService initialized (COMPLETE VERSION)');
console.log('🌐 API Base URL:', API_BASE_URL);

export default actividadService;