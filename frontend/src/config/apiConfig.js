// ============================================
// CONFIGURACIÓN CENTRALIZADA DE API
// Reemplaza todas las URLs hardcodeadas del proyecto
// ============================================

// Configuración base
const getBaseURL = () => {
  // Para desarrollo local
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }

  // Para producción (Railway)
  return import.meta.env.VITE_API_URL || 'https://sistema-crm-erp-production.up.railway.app';
};

export const API_CONFIG = {
  BASE_URL: getBaseURL(),
  ENDPOINTS: {
    // Autenticación
    AUTH: '/api/auth',

    // Dashboard Personal
    DASHBOARD_PERSONAL: (asesorId, periodo) => `/api/dashboard/personal/${asesorId}?periodo=${periodo}`,
    GEOGRAFIA_ASESOR: (asesorId, periodo) => `/api/dashboard/geografia-asesor/${asesorId}?periodo=${periodo}`,
    SECTORES_ASESOR: (asesorId, periodo) => `/api/dashboard/sectores-asesor/${asesorId}?periodo=${periodo}`,
    RANKING_ASESOR: (asesorId, periodo) => `/api/dashboard/ranking-asesor/${asesorId}?periodo=${periodo}`,
    PERIODOS_DISPONIBLES: (asesorId) => `/api/dashboard/periodos-disponibles/${asesorId}`,

    // Metas y Comisiones
    METAS_DASHBOARD: (asesorId, periodo) => `/api/metas/dashboard?asesor_id=${asesorId}&periodo=${periodo}`,
    BONO_ACTUAL: (asesorId) => `/api/comisiones/bono-actual/${asesorId}`,

    // Asesores
    ASESORES_SUPERVISABLES: '/api/asesores/supervisables',

    // Ventas
    VENTAS: '/api/ventas',
    VENTAS_DASHBOARD: '/api/ventas/dashboard',

    // Productos
    PRODUCTOS: '/api/productos',

    // Prospectos
    PROSPECTOS: '/api/prospectos',

    // Actividad
    ACTIVIDAD: '/api/actividad',

    // Almacén
    ALMACEN: '/api/almacen',

    // Notificaciones
    NOTIFICACIONES: '/api/notificaciones',

    // Pipeline
    PIPELINE: '/api/ventas/pipeline'
  }
};

// Función unificada para hacer llamadas API
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  console.log(`🌐 API Call: ${url}`);

  const token = localStorage.getItem('token');
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();

    if (response.ok) {
      return { success: true, data, status: response.status };
    } else {
      console.error(`❌ API Error ${response.status}: ${url}`, data);
      return { success: false, error: data.message || 'Error en la API', status: response.status };
    }
  } catch (error) {
    console.error(`❌ Network Error: ${url}`, error);
    return { success: false, error: error.message, status: 0 };
  }
};

export default API_CONFIG;