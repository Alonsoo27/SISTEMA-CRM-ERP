// ============================================
// CONFIGURACIÓN DEL DASHBOARD PERSONAL
// ============================================

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  TIMEOUT: 10000, // 10 segundos
  RETRY_ATTEMPTS: 3,
  ENABLE_CACHE: import.meta.env.MODE === 'production',
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutos
};


export const DASHBOARD_CONFIG = {
  AUTO_REFRESH_INTERVAL: 30000, // 30 segundos
  FULLSCREEN_AUTO_REFRESH: true,
  MAX_UBICACIONES_MOSTRAR: {
    normal: 6,
    fullscreen: 8
  },
  PERIODOS_DISPONIBLES: [
    { value: 'hoy', label: 'Hoy' },
    { value: 'semana_actual', label: 'Esta semana' },
    { value: 'mes_actual', label: 'Este mes' },
    { value: 'trimestre_actual', label: 'Este trimestre' }
  ]
};

export const ROLES_CONFIG = {
  SOLO_SUPERVISORES: [2, 3], // GERENTE, JEFE_VENTAS
  CON_PERMISOS_VENTAS: [1, 7], // SUPER_ADMIN, VENDEDOR
  SUPER_ADMINS: [1] // SUPER_ADMIN
};

export const ENDPOINTS = {
  ASESORES_SUPERVISABLES: '/api/asesores/supervisables',
  DASHBOARD_PERSONAL: (asesorId, periodo) => `/api/dashboard/personal/${asesorId}?periodo=${periodo}`,
  METAS_DASHBOARD: (asesorId, periodo) => `/api/metas/dashboard?asesor_id=${asesorId}&periodo=${periodo}`,
  GEOGRAFIA_ASESOR: (asesorId, periodo) => `/api/dashboard/geografia-asesor/${asesorId}?periodo=${periodo}`,
  SECTORES_ASESOR: (asesorId, periodo) => `/api/dashboard/sectores-asesor/${asesorId}?periodo=${periodo}`,
  RANKING_ASESOR: (asesorId, periodo) => `/api/dashboard/ranking-asesor/${asesorId}?periodo=${periodo}`,
  BONO_ACTUAL: (asesorId) => `/api/comisiones/bono-actual/${asesorId}`,
  PERIODOS_DISPONIBLES: (asesorId) => `/api/dashboard/periodos-disponibles/${asesorId}`
};

export const NOTIFICATIONS_CONFIG = {
  DURATION: 3000, // 3 segundos
  TYPES: {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info'
  }
};

export const COLORS = {
  PROGRESS_BARS: {
    EXCELENTE: 'bg-green-500', // >= 100%
    BUENO: 'bg-blue-500',      // >= 80%
    REGULAR: 'bg-yellow-500',   // >= 50%
    MALO: 'bg-red-500'         // < 50%
  },
  CANALES: {
    WHATSAPP: 'green',
    LLAMADAS: 'blue',
    PRESENCIAL: 'purple'
  }
};