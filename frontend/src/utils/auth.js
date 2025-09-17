// src/utils/auth.js
export const AuthUtils = {
  
  // ✅ NUEVO: Guardar token y datos de usuario
  setToken(token, userData = null) {
    try {
      if (!token) {
        console.error('AuthUtils.setToken: Token es requerido');
        return false;
      }
      
      // Guardar token
      localStorage.setItem('token', token);
      
      // Guardar datos de usuario si se proporcionan
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
      }
      
      console.log('✅ Token guardado exitosamente');
      return true;
    } catch (error) {
      console.error('❌ Error guardando token:', error);
      return false;
    }
  },

  // ✅ NUEVO: Obtener token simple
  getToken() {
    try {
      return localStorage.getItem('token');
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
      return null;
    }
  },

  // ✅ NUEVO: Verificar si está autenticado (simple)
  isAuthenticated() {
    const token = this.getToken();
    const isValid = token && this.isTokenValid(token);
    console.log('🔐 AuthUtils.isAuthenticated:', { 
      hasToken: !!token, 
      isValid, 
      token: token ? token.substring(0, 20) + '...' : null 
    });
    return isValid;
  },
  
  // ✅ Obtener token válido del localStorage (versión mejorada)
  getAuthToken() {
    try {
      // Intentar obtener de 'token' primero (método nuevo)
      const token = localStorage.getItem('token');
      if (token && this.isTokenValid(token)) {
        return token;
      }
      
      // Limpiar token inválido
      if (token) {
        this.clearAuth();
      }
      
      // Intentar obtener de 'auth' como fallback (método legacy)
      const authData = localStorage.getItem('auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed.token && this.isTokenValid(parsed.token)) {
            return parsed.token;
          } else {
            localStorage.removeItem('auth');
          }
        } catch (e) {
          localStorage.removeItem('auth');
        }
      }
      
      // ❌ No hay token válido
      return null;
      
    } catch (error) {
      console.warn('Error obteniendo token:', error);
      return null;
    }
  },

  // ✅ Verificar si un token JWT es válido y no ha expirado
isTokenValid(token) {
  try {
    if (!token || typeof token !== 'string') return false;
    
    // ✅ MODO DESARROLLO: Aceptar tokens fake para testing
    if (token === 'fake-jwt-token-for-testing' || token.startsWith('fake-')) {
      console.log('🛠️ AuthUtils: Token de desarrollo detectado');
      return true;
    }
    
    // ✅ MODO PRODUCCIÓN: Validar JWT real
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp && payload.exp > currentTime;
  } catch (error) {
    return false;
  }
},

  // ✅ NUEVO: Limpiar autenticación (sin redirigir)
  clearAuth() {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('🗑️ Autenticación limpiada');
  },

  // ✅ Limpiar autenticación y redirigir al login
  handleAuthError() {
    this.clearAuth();
    console.warn('Token expirado. Redirigiendo al login.');
    
    // Redirigir al login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  // ✅ Obtener headers con Authorization
  getAuthHeaders() {
    const token = this.getAuthToken();
    if (!token) {
      this.handleAuthError();
      return {};
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  },

  // ✅ Realizar fetch con autenticación automática
  async authenticatedFetch(url, options = {}) {
    const token = this.getAuthToken();
    if (!token) {
      this.handleAuthError();
      throw new Error('No authenticated');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Si hay error de autenticación, manejar automáticamente
    if (response.status === 401 || response.status === 403) {
      this.handleAuthError();
      throw new Error('Authentication failed');
    }

    return response;
  },

  // ✅ Obtener información del usuario del localStorage
  getUser() {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }
  },

  // ✅ Obtener información del usuario del token
  getUserFromToken() {
    try {
      const token = this.getAuthToken();
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.user_id,
        nombre: payload.nombre,
        apellido: payload.apellido,
        rol: payload.rol
      };
    } catch (error) {
      return null;
    }
  }
};