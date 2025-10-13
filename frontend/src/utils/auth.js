// src/utils/auth.js
// ============================================
// AUTH UTILS - SOLO HELPERS JWT
// ============================================
// NOTA: authService es la única fuente de verdad para autenticación
// Este archivo solo contiene utilidades para validar tokens JWT

export const AuthUtils = {
  /**
   * Verificar si un token JWT es válido y no ha expirado
   * @param {string} token - Token JWT
   * @returns {boolean} True si el token es válido
   */
  isTokenValid(token) {
    try {
      if (!token || typeof token !== 'string') {
        return false;
      }

      // Validar estructura JWT (3 partes separadas por puntos)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Decodificar payload
      const payload = JSON.parse(atob(parts[1]));

      // Verificar expiración
      if (!payload.exp) {
        return false;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const isValid = payload.exp > currentTime;

      if (!isValid) {
        console.warn('⚠️ AuthUtils: Token expirado');
      }

      return isValid;

    } catch (error) {
      console.error('❌ AuthUtils: Error validando token:', error);
      return false;
    }
  },

  /**
   * Decodificar payload de un token JWT (sin validar firma)
   * @param {string} token - Token JWT
   * @returns {Object|null} Payload decodificado o null
   */
  decodeToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        return null;
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));
      return payload;

    } catch (error) {
      console.error('❌ AuthUtils: Error decodificando token:', error);
      return null;
    }
  },

  /**
   * Obtener información del usuario desde el token JWT
   * @param {string} token - Token JWT
   * @returns {Object|null} Usuario o null
   */
  getUserFromToken(token) {
    try {
      const payload = this.decodeToken(token);
      if (!payload) {
        return null;
      }

      return {
        id: payload.user_id || payload.id,
        email: payload.email,
        nombre: payload.nombre,
        apellido: payload.apellido,
        nombre_completo: payload.nombre_completo,
        rol: payload.rol,
        rol_id: payload.rol_id
      };

    } catch (error) {
      console.error('❌ AuthUtils: Error extrayendo usuario del token:', error);
      return null;
    }
  },

  /**
   * Verificar si un token ha expirado
   * @param {string} token - Token JWT
   * @returns {boolean} True si ha expirado
   */
  isTokenExpired(token) {
    return !this.isTokenValid(token);
  },

  /**
   * Obtener tiempo restante del token en segundos
   * @param {string} token - Token JWT
   * @returns {number} Segundos restantes o 0
   */
  getTokenRemainingTime(token) {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) {
        return 0;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - currentTime;

      return remaining > 0 ? remaining : 0;

    } catch (error) {
      return 0;
    }
  },

  /**
   * Obtener token de autenticación del localStorage
   * @returns {string|null} Token JWT o null
   */
  getAuthToken() {
    try {
      const token = localStorage.getItem('token');
      if (token && this.isTokenValid(token)) {
        return token;
      }
      return null;
    } catch (error) {
      console.error('❌ AuthUtils: Error obteniendo token:', error);
      return null;
    }
  },

  /**
   * Obtener ID del usuario autenticado desde el token
   * @returns {number|null} ID del usuario o null
   */
  getUserId() {
    try {
      const token = this.getAuthToken();
      if (!token) {
        return null;
      }
      const user = this.getUserFromToken(token);
      return user?.id || null;
    } catch (error) {
      console.error('❌ AuthUtils: Error obteniendo ID de usuario:', error);
      return null;
    }
  },

  /**
   * Manejar error de autenticación
   * Redirige al login y limpia el localStorage
   */
  handleAuthError() {
    console.warn('⚠️ AuthUtils: Sesión inválida, redirigiendo a login');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  }
};
