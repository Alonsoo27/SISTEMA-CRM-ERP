// src/services/productosService.js
import axios from 'axios';
import { AuthUtils } from '../utils/auth';

const API_BASE_URL = 'http://localhost:3001/api';

class ProductosService {
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
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para manejo centralizado de errores
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);

        if (error.response?.status === 401) {
          // Token expirado o inválido
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
  // BÚSQUEDA INTELIGENTE PARA AUTOCOMPLETADO
  // ===============================

  // Búsqueda rápida para autocompletado (CLAVE PARA TU VISIÓN)
  async buscarProductosParaAutocompletado(texto, limite = 10) {
    try {
      if (!texto || texto.length < 2) {
        return {
          success: true,
          data: []
        };
      }

      const params = new URLSearchParams();
      params.append('busqueda', texto.trim());
      params.append('limit', limite);
      params.append('page', 1);

      const response = await this.apiClient.get(`/productos?${params.toString()}`);
      
      if (response.data.success) {
        // Formatear para autocompletado
        const productosFormateados = response.data.data.map(producto => ({
          id: producto.id,
          codigo: producto.codigo,
          descripcion: producto.descripcion,
          precio_base: producto.precio_sin_igv,
          marca: producto.marca,
          categoria: producto.categorias?.nombre || 'Sin categoría',
          unidad: producto.unidad_medida || 'UND',
          // Texto para mostrar en el autocompletado
          textoMostrar: `${producto.codigo} - ${producto.descripcion}`,
          // Texto secundario
          textoSecundario: `${producto.marca} | $${producto.precio_sin_igv} | ${producto.unidad_medida || 'UND'}`
        }));

        return {
          success: true,
          data: productosFormateados
        };
      }

      return {
        success: false,
        data: [],
        error: 'No se pudieron obtener productos'
      };

    } catch (error) {
      console.error('Error en búsqueda de autocompletado:', error);
      return {
        success: false,
        data: [],
        error: error.response?.data?.error || 'Error en búsqueda de productos'
      };
    }
  }

  // Búsqueda por código específico (para validaciones)
  async buscarPorCodigo(codigo) {
    try {
      const response = await this.buscarProductosParaAutocompletado(codigo, 1);
      
      if (response.success && response.data.length > 0) {
        const producto = response.data.find(p => 
          p.codigo.toLowerCase() === codigo.toLowerCase()
        );
        return {
          success: true,
          data: producto || null
        };
      }

      return {
        success: false,
        data: null,
        error: 'Producto no encontrado'
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // ===============================
  // GESTIÓN COMPLETA DE PRODUCTOS
  // ===============================

  // Obtener todos los productos con filtros avanzados
  async obtenerProductos(filtros = {}) {
    try {
      const params = new URLSearchParams();

      // Parámetros de filtrado
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);
      if (filtros.orden) params.append('orden', filtros.orden);
      if (filtros.direccion) params.append('direccion', filtros.direccion);

      const response = await this.apiClient.get(`/productos?${params.toString()}`);
      
      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo productos',
        details: error.response?.data
      };
    }
  }

  // Obtener producto por ID
  async obtenerProductoPorId(id) {
    try {
      const response = await this.apiClient.get(`/productos/${id}`);
      
      return {
        success: true,
        data: response.data.data
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo producto',
        details: error.response?.data
      };
    }
  }

  // Crear nuevo producto
  async crearProducto(datosProducto) {
    try {
      const response = await this.apiClient.post('/productos', datosProducto);
      
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error creando producto',
        details: error.response?.data?.details
      };
    }
  }

  // Actualizar producto existente
  async actualizarProducto(id, datosProducto) {
    try {
      const response = await this.apiClient.put(`/productos/${id}`, datosProducto);
      
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error actualizando producto',
        details: error.response?.data?.details
      };
    }
  }

  // Eliminar producto (eliminación lógica)
  async eliminarProducto(id) {
    try {
      const response = await this.apiClient.delete(`/productos/${id}`);
      
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error eliminando producto',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // CATEGORÍAS
  // ===============================

  // Obtener todas las categorías activas
  async obtenerCategorias() {
    try {
      const response = await this.apiClient.get('/productos/categorias');
      
      return {
        success: true,
        data: response.data.data || []
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo categorías',
        data: []
      };
    }
  }

  // ===============================
  // UTILIDADES PARA FORMULARIOS
  // ===============================

  // Formatear precio para mostrar
  formatearPrecio(precio) {
    if (!precio || isNaN(precio)) return '0.00';
    return parseFloat(precio).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Validar datos de producto
  validarDatosProducto(datosProducto) {
    const errores = [];

    if (!datosProducto.codigo?.trim()) {
      errores.push('El código es obligatorio');
    }

    if (!datosProducto.descripcion?.trim()) {
      errores.push('La descripción es obligatoria');
    }

    if (!datosProducto.precio_sin_igv || parseFloat(datosProducto.precio_sin_igv) <= 0) {
      errores.push('El precio debe ser mayor a cero');
    }

    if (!datosProducto.marca?.trim()) {
      errores.push('La marca es obligatoria');
    }

    if (!datosProducto.categoria_id?.trim()) {
      errores.push('La categoría es obligatoria');
    }

    if (!datosProducto.unidad_medida?.trim()) {
      errores.push('La unidad de medida es obligatoria');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  // ===============================
  // FUNCIONES ESPECIALES PARA TU VISIÓN
  // ===============================

  // Obtener productos populares para sugerencias iniciales
  async obtenerProductosPopulares(limite = 5) {
    try {
      const response = await this.obtenerProductos({
        limit: limite,
        orden: 'created_at',
        direccion: 'desc'
      });

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data.map(producto => ({
            id: producto.id,
            codigo: producto.codigo,
            descripcion: producto.descripcion,
            precio_base: producto.precio_sin_igv,
            textoMostrar: `${producto.codigo} - ${producto.descripcion}`
          }))
        };
      }

      return {
        success: false,
        data: [],
        error: 'No se pudieron cargar productos populares'
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  // Calcular precio con descuento por cantidad (lógica empresarial)
  calcularPrecioConDescuento(precioBase, cantidad) {
    const precio = parseFloat(precioBase) || 0;
    const cant = parseInt(cantidad) || 1;

    // Lógica de descuentos por volumen
    let factorDescuento = 1;

    if (cant >= 100) {
      factorDescuento = 0.90; // 10% descuento
    } else if (cant >= 50) {
      factorDescuento = 0.95; // 5% descuento
    } else if (cant >= 20) {
      factorDescuento = 0.97; // 3% descuento
    }

    return {
      precioUnitario: precio * factorDescuento,
      precioOriginal: precio,
      descuentoAplicado: factorDescuento < 1,
      porcentajeDescuento: Math.round((1 - factorDescuento) * 100),
      subtotal: precio * factorDescuento * cant
    };
  }

  // Test de conectividad
  async testConexion() {
    try {
      const response = await this.apiClient.get('/productos/health');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión',
        details: error.response?.data
      };
    }
  }
}

// Instancia singleton del servicio
const productosService = new ProductosService();
export default productosService;