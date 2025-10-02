// src/services/authService.js
import axios from 'axios';
import { AuthUtils } from '../utils/auth';
import { API_CONFIG } from '../config/apiConfig';

const API_BASE_URL = `${API_CONFIG.BASE_URL}/api`;

class AuthService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar JWT automáticamente
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = AuthUtils.getAuthToken();
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
          AuthUtils.handleAuthError();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Obtener información del usuario actual autenticado
   * @returns {Promise<Object>} Usuario actual con toda la información
   */
  async getCurrentUser() {
    try {
      console.log('🔍 AuthService: Obteniendo usuario actual...');

      // Temporalmente usando /profile hasta que /me se registre correctamente
      const response = await this.apiClient.get('/auth/profile');

      if (response.data?.success && response.data?.data?.usuario) {
        const data = response.data.data;
        const usuario = data.usuario;
        const rol = data.rol;

        // Adaptar estructura para compatibilidad con el sistema
        const usuarioAdaptado = {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          nombre_completo: usuario.nombre_completo,
          email: usuario.email,
          rol: rol.nombre,
          rol_id: rol.id,
          es_jefe: false, // No disponible en /profile, usar default
          vende: true, // No disponible en /profile, usar default
          jefe_id: null,
          area_id: data.area?.id || null,
          area_nombre: data.area?.nombre || null,
          jefe_nombre: null,
          permisos: {
            es_ejecutivo: [1, 2, 3, 11].includes(rol.id),
            es_administrador: [1, 2, 11].includes(rol.id),
            puede_vender: true, // Default
            es_supervisor: false // Default
          }
        };

        console.log('✅ AuthService: Usuario obtenido:', {
          id: usuarioAdaptado.id,
          nombre: usuarioAdaptado.nombre_completo,
          rol: usuarioAdaptado.rol,
          rol_id: usuarioAdaptado.rol_id,
          es_ejecutivo: usuarioAdaptado.permisos.es_ejecutivo
        });

        // Guardar usuario en localStorage para cache
        localStorage.setItem('currentUser', JSON.stringify(usuarioAdaptado));

        return usuarioAdaptado;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('❌ AuthService: Error obteniendo usuario:', error);

      // Si hay error de auth, limpiar y redirigir
      if (error.response?.status === 401 || error.response?.status === 403) {
        AuthUtils.handleAuthError();
        throw new Error('Sesión expirada');
      }

      throw new Error(`Error obteniendo usuario: ${error.message}`);
    }
  }

  /**
   * Obtener usuario desde cache (localStorage) si existe
   * @returns {Object|null} Usuario desde cache o null
   */
  getCachedUser() {
    try {
      const cachedUser = localStorage.getItem('currentUser');
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        console.log('📦 AuthService: Usuario desde cache:', {
          id: userData.id,
          nombre: userData.nombre_completo,
          rol: userData.rol
        });
        return userData;
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo usuario desde cache:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  /**
   * Obtener usuario actual con fallback a cache
   * @param {boolean} forceRefresh - Forzar obtener desde servidor
   * @returns {Promise<Object>} Usuario actual
   */
  async getUser(forceRefresh = false) {
    try {
      // Si no forzamos refresh, intentar obtener desde cache primero
      if (!forceRefresh) {
        const cachedUser = this.getCachedUser();
        if (cachedUser) {
          return cachedUser;
        }
      }

      // Si no hay cache o se fuerza refresh, obtener desde servidor
      return await this.getCurrentUser();
    } catch (error) {
      console.error('❌ AuthService: Error en getUser:', error);
      throw error;
    }
  }

  /**
   * Verificar si el usuario tiene acceso ejecutivo
   * @returns {Promise<boolean>} True si tiene acceso ejecutivo
   */
  async hasExecutiveAccess() {
    try {
      const user = await this.getUser();
      return user?.permisos?.es_ejecutivo || false;
    } catch (error) {
      console.error('❌ Error verificando acceso ejecutivo:', error);
      return false;
    }
  }

  /**
   * Verificar si el usuario puede vender
   * @returns {Promise<boolean>} True si puede vender
   */
  async canSell() {
    try {
      const user = await this.getUser();
      return user?.vende || false;
    } catch (error) {
      console.error('❌ Error verificando permisos de venta:', error);
      return false;
    }
  }

  /**
   * Limpiar cache del usuario
   */
  clearUserCache() {
    localStorage.removeItem('currentUser');
    console.log('🗑️ AuthService: Cache de usuario limpiado');
  }

  /**
   * Logout completo
   */
  logout() {
    this.clearUserCache();
    AuthUtils.clearAuth();
    console.log('👋 AuthService: Logout completo');
  }
}

// Exportar instancia singleton
const authService = new AuthService();
export default authService;