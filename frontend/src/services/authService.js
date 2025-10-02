// src/services/authService.js
// ============================================
// AUTH SERVICE - ÚNICA FUENTE DE VERDAD
// ============================================
import axios from 'axios';
import { AuthUtils } from '../utils/auth';
import { API_CONFIG } from '../config/apiConfig';

const API_BASE_URL = `${API_CONFIG.BASE_URL}/api`;
const USER_STORAGE_KEY = 'user'; // ← ÚNICA KEY DE STORAGE

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
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        console.error('❌ Error en request interceptor:', error);
        return Promise.reject(error);
      }
    );

    // Interceptor para manejo centralizado de errores
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.warn('⚠️ Error de autenticación detectado, limpiando sesión');
          this.logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * ========================================
   * MÉTODOS DE AUTENTICACIÓN
   * ========================================
   */

  /**
   * Login - Autenticar usuario
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} Usuario autenticado
   */
  async login(email, password) {
    try {
      console.log('🔐 AuthService: Iniciando login para', email);

      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/api/auth/login`,
        { email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { data } = response;

      if (!data.success || !data.data?.token || !data.data?.user) {
        throw new Error(data.message || 'Respuesta inválida del servidor');
      }

      const { token, user } = data.data;

      // Guardar token
      localStorage.setItem('token', token);

      // Guardar usuario (estructura completa del backend)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      // Limpiar cache viejo si existe
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');

      console.log('✅ AuthService: Login exitoso', {
        id: user.id,
        email: user.email,
        rol: user.rol?.nombre || user.rol
      });

      return user;

    } catch (error) {
      console.error('❌ AuthService: Error en login:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error en el login');
    }
  }

  /**
   * Obtener token del localStorage
   * @returns {string|null} Token JWT
   */
  getToken() {
    try {
      const token = localStorage.getItem('token');
      if (token && AuthUtils.isTokenValid(token)) {
        return token;
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
      return null;
    }
  }

  /**
   * Obtener usuario del localStorage
   * @returns {Object|null} Usuario o null
   */
  getUser() {
    try {
      const userData = localStorage.getItem(USER_STORAGE_KEY);
      if (!userData) {
        console.warn('⚠️ AuthService: No hay usuario en localStorage');
        return null;
      }

      const user = JSON.parse(userData);

      console.log('📦 AuthService: Usuario obtenido de localStorage:', {
        id: user.id,
        email: user.email,
        nombre: user.nombre_completo || user.nombre,
        rol: user.rol?.nombre || user.rol
      });

      return user;
    } catch (error) {
      console.error('❌ AuthService: Error obteniendo usuario:', error);
      return null;
    }
  }

  /**
   * Verificar si hay un usuario autenticado
   * @returns {boolean} True si hay usuario autenticado
   */
  isAuthenticated() {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  }

  /**
   * Logout - Limpiar sesión
   */
  logout() {
    console.log('🚪 AuthService: Cerrando sesión...');

    // Limpiar todo el localStorage relacionado con auth
    localStorage.removeItem('token');
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('currentUser'); // Legacy
    localStorage.removeItem('authToken'); // Legacy

    console.log('✅ AuthService: Sesión cerrada');
  }

  /**
   * ========================================
   * MÉTODOS DE PERMISOS
   * ========================================
   */

  /**
   * Verificar si el usuario tiene rol específico
   * @param {string|string[]} roles - Rol o array de roles permitidos
   * @returns {boolean} True si tiene el rol
   */
  hasRole(roles) {
    const user = this.getUser();
    if (!user) return false;

    const userRole = user.rol?.nombre || user.rol;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return allowedRoles.includes(userRole);
  }

  /**
   * Verificar si el usuario es administrador
   * @returns {boolean} True si es admin
   */
  isAdmin() {
    return this.hasRole(['ADMIN', 'SUPER_ADMIN']);
  }

  /**
   * Verificar si el usuario es gerente o superior
   * @returns {boolean} True si es gerente o admin
   */
  isManager() {
    return this.hasRole(['ADMIN', 'SUPER_ADMIN', 'GERENTE']);
  }
}

// Exportar instancia singleton
const authService = new AuthService();
export default authService;