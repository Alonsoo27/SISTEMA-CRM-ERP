// ============================================
// UTILIDADES DEL DASHBOARD PERSONAL
// ============================================

import { API_CONFIG as OLD_CONFIG, ENDPOINTS } from '../config/dashboardConfig';
import { apiCall, API_CONFIG } from '../config/apiConfig';

// ============================================
// UTILIDADES DE API - NUEVA VERSIÓN LIMPIA
// ============================================

export const fetchWithErrorHandling = async (endpoint, options = {}, retryCount = 0) => {
  console.log(`🔄 API Call: ${endpoint}`);
  return await apiCall(endpoint, options);
};

// Función legacy compatible
export const fetchWithErrorHandlingOld = async (url, options = {}, retryCount = 0) => {
  console.log(`🔄 Legacy API Call: ${url}`);
  const maxRetries = OLD_CONFIG.RETRY_ATTEMPTS || 3;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      // Reset retry count en caso de éxito después de fallos
      if (retryCount > 0) {
        console.log(`✅ Recuperado después de ${retryCount} reintentos: ${url}`);
      }

      return { success: true, data, status: response.status, retries: retryCount };
    } else {
      // Determinar si el error es reintentable
      const isRetryable = response.status >= 500 || response.status === 429; // Server errors o rate limiting

      if (isRetryable && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
        console.warn(`⏳ Reintentando ${url} en ${delay}ms (intento ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithErrorHandling(url, options, retryCount + 1);
      }

      console.error(`❌ Error ${response.status} en ${url} (después de ${retryCount} reintentos)`);
      return {
        success: false,
        error: `Error ${response.status}: ${response.statusText}`,
        data: null,
        status: response.status,
        retries: retryCount
      };
    }
  } catch (error) {
    // Manejar diferentes tipos de errores
    if (error.name === 'AbortError') {
      // Timeout - reintentable
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.warn(`⏳ Timeout, reintentando ${url} en ${delay}ms (intento ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithErrorHandling(url, options, retryCount + 1);
      }

      console.error(`⏱️ Timeout definitivo en ${url} después de ${retryCount} reintentos`);
      return {
        success: false,
        error: 'Timeout de conexión',
        data: null,
        retries: retryCount
      };
    }

    // Error de red - reintentable
    const isNetworkError = error.message.includes('Failed to fetch') ||
                          error.message.includes('Network Error') ||
                          error.code === 'ECONNREFUSED';

    if (isNetworkError && retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      console.warn(`🌐 Error de red, reintentando ${url} en ${delay}ms (intento ${retryCount + 1}/${maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithErrorHandling(url, options, retryCount + 1);
    }

    console.error(`❌ Error final en ${url} después de ${retryCount} reintentos:`, error);
    return {
      success: false,
      error: error.message,
      data: null,
      retries: retryCount
    };
  }
};

export const cargarDatosDashboard = async (asesorId, periodo, headers) => {
  const endpoints = [
    API_CONFIG.ENDPOINTS.DASHBOARD_PERSONAL(asesorId, periodo),
    API_CONFIG.ENDPOINTS.METAS_DASHBOARD(asesorId, periodo),
    API_CONFIG.ENDPOINTS.GEOGRAFIA_ASESOR(asesorId, periodo),
    API_CONFIG.ENDPOINTS.SECTORES_ASESOR(asesorId, periodo),
    API_CONFIG.ENDPOINTS.RANKING_ASESOR(asesorId, periodo),
    API_CONFIG.ENDPOINTS.BONO_ACTUAL(asesorId)
  ];

  console.log('📋 Cargando endpoints del dashboard:', endpoints);

  const resultados = await Promise.allSettled(
    endpoints.map(endpoint => fetchWithErrorHandling(endpoint, { headers }))
  );

  // Helper para extraer datos con estructura variable del backend
  const extraerDatos = (resultado) => {
    if (resultado.status !== 'fulfilled' || !resultado.value.success) return null;

    const data = resultado.value.data;
    // Manejar diferentes estructuras de respuesta del backend
    return data?.data || data?.asesores || data;
  };

  return {
    dashboard: extraerDatos(resultados[0]),
    metas: extraerDatos(resultados[1]),
    geografia: extraerDatos(resultados[2]),
    sectores: extraerDatos(resultados[3]),
    ranking: extraerDatos(resultados[4]),
    bono: extraerDatos(resultados[5]),
    errores: resultados.map((r, i) =>
      r.status === 'rejected' || !r.value.success ? {
        endpoint: endpoints[i],
        error: r.value?.error || r.reason,
        status: r.value?.status
      } : null
    ).filter(Boolean)
  };
};

// ============================================
// UTILIDADES DE FORMATO
// ============================================

export const formatearMonto = (monto) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(monto || 0);
};

export const formatearPorcentaje = (valor, decimales = 1) => {
  const num = parseFloat(valor || 0);
  return `${num.toFixed(decimales)}%`;
};

export const formatearNumero = (numero) => {
  return new Intl.NumberFormat('es-PE').format(numero || 0);
};

// ============================================
// UTILIDADES DE TENDENCIAS
// ============================================

export const obtenerIconoTendencia = (valor) => {
  const num = parseFloat(valor || 0);
  if (num > 0) return { icon: 'ArrowUp', color: 'text-green-500' };
  if (num < 0) return { icon: 'ArrowDown', color: 'text-red-500' };
  return { icon: 'Minus', color: 'text-gray-400' };
};

export const obtenerColorTendencia = (valor) => {
  const num = parseFloat(valor || 0);
  if (num > 0) return 'text-green-600';
  if (num < 0) return 'text-red-600';
  return 'text-gray-500';
};

export const obtenerColorProgreso = (porcentaje) => {
  const num = parseFloat(porcentaje || 0);
  if (num >= 100) return 'bg-green-500';
  if (num >= 80) return 'bg-blue-500';
  if (num >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

// ============================================
// UTILIDADES DE PERMISOS
// ============================================

export const determinarModoVistaInicial = (usuarioActual) => {
  // Normalizar usuario para extraer rol_id correctamente
  const normalizedUser = usuarioActual?.rol_id ? usuarioActual : {
    ...usuarioActual,
    rol_id: usuarioActual?.rol?.id || usuarioActual?.rol_id
  };

  const userRole = normalizedUser?.rol_id;

  console.log('🔍 determinarModoVistaInicial:', { userRole, usuarioActual: normalizedUser });

  // PRIORIDAD 1: GERENTE (2), ADMIN (11) y JEFE_VENTAS (3) → modo supervisor
  // JEFE_VENTAS aunque vende, sus metas dependen del equipo, no de sus ventas personales
  if (userRole === 2 || userRole === 11 || userRole === 3) {
    console.log('⚠️ GERENTE/ADMIN/JEFE_VENTAS → Modo supervisor (ven métricas del equipo)');
    return {
      modo: 'supervisor',
      asesorSeleccionado: null
    };
  }

  // PRIORIDAD 2: SUPER_ADMIN (1) SÍ vende y ve sus propias métricas
  if (userRole === 1) {
    console.log('✅ SUPER_ADMIN (vende) → Modo propio');
    return {
      modo: 'propio',
      asesorSeleccionado: normalizedUser?.id
    };
  }

  // PRIORIDAD 3: Si tiene flag vende=true, modo propio (VENDEDOR y otros)
  if (normalizedUser?.vende === true) {
    console.log('✅ Usuario con vende=true → Modo propio');
    return {
      modo: 'propio',
      asesorSeleccionado: normalizedUser?.id
    };
  }

  // PRIORIDAD 4: Por defecto, modo propio
  console.log('📌 Default → Modo propio');
  return {
    modo: 'propio',
    asesorSeleccionado: normalizedUser?.id
  };
};

export const puedeAlternarModos = (usuarioActual) => {
  return usuarioActual?.vende && ![2, 3].includes(usuarioActual?.rol_id);
};

// ============================================
// UTILIDADES DE DOM (FULLSCREEN)
// ============================================

export const activarFullscreen = () => {
  // Ocultar elementos de navegación
  const elementos = document.querySelectorAll('.sidebar, nav, aside, [role="navigation"], header, .header');
  elementos.forEach(el => {
    el.style.display = 'none';
    el.setAttribute('data-hidden-fullscreen', 'true');
  });

  // Configurar body
  document.body.style.overflow = 'hidden';

  // Configurar contenedor dashboard
  const dashboardContainer = document.querySelector('#dashboard-container, .dashboard-container, [data-dashboard]');
  if (dashboardContainer) {
    Object.assign(dashboardContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '9999',
      background: '#f9fafb',
      overflow: 'auto'
    });
    dashboardContainer.setAttribute('data-fullscreen-active', 'true');
  }
};

export const desactivarFullscreen = () => {
  // Restaurar elementos de navegación
  const elementosOcultos = document.querySelectorAll('[data-hidden-fullscreen="true"]');
  elementosOcultos.forEach(el => {
    el.style.display = '';
    el.removeAttribute('data-hidden-fullscreen');
  });

  // Restaurar body
  document.body.style.overflow = '';

  // Restaurar contenedor dashboard
  const dashboardContainer = document.querySelector('[data-fullscreen-active="true"]');
  if (dashboardContainer) {
    Object.assign(dashboardContainer.style, {
      position: '',
      top: '',
      left: '',
      width: '',
      height: '',
      zIndex: '',
      background: '',
      overflow: ''
    });
    dashboardContainer.removeAttribute('data-fullscreen-active');
  }
};

// ============================================
// UTILIDADES DE CÁLCULOS
// ============================================

export const calcularPorcentajeCanal = (ventasCanal, totalVentas) => {
  if (totalVentas === 0) return 0;
  return Math.round(((ventasCanal || 0) / totalVentas) * 100);
};

export const calcularPorcentajeMeta = (logrado, meta) => {
  if (!meta || meta === 0) return 0;
  return Math.round((logrado / meta) * 100);
};

export const calcularDiasRestantes = (fechaFin) => {
  const ahora = new Date();
  const fin = new Date(fechaFin);
  const diff = fin - ahora;

  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ============================================
// UTILIDADES DE VALIDACIÓN
// ============================================

export const validarDatosDashboard = (datos) => {
  const errores = [];

  if (!datos) {
    errores.push('No se recibieron datos del dashboard');
    return { valido: false, errores };
  }

  // Validar estructura básica
  const camposRequeridos = ['ventas', 'pipeline', 'actividad'];
  camposRequeridos.forEach(campo => {
    if (!datos[campo]) {
      errores.push(`Falta el campo ${campo} en los datos del dashboard`);
    }
  });

  return {
    valido: errores.length === 0,
    errores
  };
};

// ============================================
// UTILIDADES DE CACHE
// ============================================

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

export const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

export const clearCache = () => {
  cache.clear();
};