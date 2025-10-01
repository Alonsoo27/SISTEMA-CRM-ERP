// src/services/almacenService.js
// Servicio Empresarial para Gestión de Almacén - Patrón Profesional
import axios from 'axios';
import { AuthUtils } from '../utils/auth';

const API_BASE_URL = 'http://localhost:3001/api';

class AlmacenService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 20000, // 20 segundos para operaciones de almacén
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para autenticación automática
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        console.error('Error en request interceptor de almacén:', error);
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

  // ===============================
  // UTILIDADES DE AUTENTICACIÓN
  // ===============================

  getAuthToken() {
    return AuthUtils.getAuthToken();
  }

  handleAuthError() {
    AuthUtils.handleAuthError();
  }

  // ===============================
  // FORMATEO Y VALIDACIONES
  // ===============================

  formatearCantidad(cantidad) {
    if (!cantidad || isNaN(cantidad)) return '0';
    return parseFloat(cantidad).toLocaleString('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  formatearValorMonetario(valor) {
    if (!valor || isNaN(valor)) return '$0.00';
    return '$' + parseFloat(valor).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatearFechaParaAPI(fecha) {
    if (!fecha) return null;
    
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    
    try {
      const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
      return fechaObj.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Error formateando fecha para almacén:', error);
      return null;
    }
  }

  // ===============================
  // DASHBOARD PRINCIPAL
  // ===============================

  async obtenerDashboard() {
    try {
      const response = await this.apiClient.get('/almacen/dashboard');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo dashboard de almacén',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // GESTIÓN DE INVENTARIO
  // ===============================

  async obtenerInventario(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.stock_minimo) params.append('stock_minimo', filtros.stock_minimo);
      if (filtros.solo_alertas !== undefined) params.append('solo_alertas', filtros.solo_alertas);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);

      const response = await this.apiClient.get(`/almacen/inventario?${params.toString()}`);
      return {
        success: true,
        data: response.data.data || response.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo inventario',
        details: error.response?.data
      };
    }
  }

  async obtenerInventarioPorProducto(productoId) {
    try {
      const response = await this.apiClient.get(`/almacen/inventario/producto/${productoId}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo inventario del producto',
        details: error.response?.data
      };
    }
  }

  async actualizarStockProducto(productoId, almacenId, datosActualizacion) {
    try {
      const validacion = this.validarActualizacionStock(datosActualizacion);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.put(
        `/almacen/inventario/${productoId}/almacen/${almacenId}`, 
        datosActualizacion
      );
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error actualizando stock',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // GESTIÓN DE MOVIMIENTOS
  // ===============================

  async obtenerMovimientos(filtros = {}) {
    try {
      const params = new URLSearchParams();

      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);
      if (filtros.producto_id) params.append('producto_id', filtros.producto_id);
      if (filtros.tipo_movimiento) params.append('tipo_movimiento', filtros.tipo_movimiento);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.fecha_desde) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
        if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
      }
      if (filtros.fecha_hasta) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
        if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
      }
      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);
      if (filtros.orden) params.append('orden', filtros.orden);
      if (filtros.direccion) params.append('direccion', filtros.direccion);

      const response = await this.apiClient.get(`/almacen/movimientos?${params.toString()}`);
      return {
        success: true,
        data: response.data.data || response.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo movimientos',
        details: error.response?.data
      };
    }
  }

  async transferirStock(datosTransferencia) {
    try {
      const validacion = this.validarTransferencia(datosTransferencia);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos de transferencia inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.post('/almacen/transferencias', datosTransferencia);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error en transferencia de stock',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // GESTIÓN DE ALMACENES
  // ===============================

  async obtenerAlmacenes() {
    try {
      const response = await this.apiClient.get('/almacen/almacenes');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo almacenes',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // GESTIÓN DE ALERTAS
  // ===============================

  async obtenerAlertas(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);
      if (filtros.tipo_alerta) params.append('tipo_alerta', filtros.tipo_alerta);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);

      const response = await this.apiClient.get(`/almacen/alertas?${params.toString()}`);
      return {
        success: true,
        data: response.data.data || response.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo alertas',
        details: error.response?.data
      };
    }
  }

  async resolverAlerta(alertaId, datosResolucion) {
    try {
      const validacion = this.validarResolucionAlerta(datosResolucion);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos de resolución inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.put(
        `/almacen/alertas/${alertaId}/resolver`, 
        datosResolucion
      );
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error resolviendo alerta',
        details: error.response?.data
      };
    }
  }

  async generarAlertasAutomaticas() {
    try {
      const response = await this.apiClient.post('/almacen/mantenimiento/generar-alertas');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error generando alertas automáticas',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // GESTIÓN DE DESPACHOS
  // ===============================

  async obtenerDespachos(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.fecha_desde) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
        if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
      }
      if (filtros.fecha_hasta) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
        if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
      }
      if (filtros.page) params.append('page', filtros.page);
      if (filtros.limit) params.append('limit', filtros.limit);

      const response = await this.apiClient.get(`/almacen/despachos?${params.toString()}`);
      return {
        success: true,
        data: response.data.data || response.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo despachos',
        details: error.response?.data
      };
    }
  }

  async obtenerDespachoPorId(despachoId) {
    try {
      const response = await this.apiClient.get(`/almacen/despachos/${despachoId}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo despacho',
        details: error.response?.data
      };
    }
  }

  async actualizarEstadoDespacho(despachoId, datosEstado) {
    try {
      const validacion = this.validarCambioEstadoDespacho(datosEstado);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos de estado inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.put(
        `/almacen/despachos/${despachoId}/estado`, 
        datosEstado
      );
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error actualizando estado de despacho',
        details: error.response?.data
      };
    }
  }

  async crearDespachoDesdeVenta(datosDespacho) {
    try {
      const validacion = this.validarCreacionDespacho(datosDespacho);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos de despacho inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.post('/almacen/despachos/desde-venta', datosDespacho);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error creando despacho desde venta',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // REPORTES Y ANÁLISIS
  // ===============================

  async generarKardex(productoId, filtros = {}) {
    try {
      const params = new URLSearchParams();

      if (filtros.fecha_desde) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
        if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
      }
      if (filtros.fecha_hasta) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
        if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
      }
      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);

      const response = await this.apiClient.get(
        `/almacen/reportes/kardex/${productoId}?${params.toString()}`
      );
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error generando kardex',
        details: error.response?.data
      };
    }
  }

  async obtenerKardexProducto(productoId, filtros = {}) {
    try {
      const params = new URLSearchParams();

      if (filtros.fecha_desde) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
        if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
      }
      if (filtros.fecha_hasta) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
        if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
      }
      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);
      if (filtros.tipo_movimiento) params.append('tipo_movimiento', filtros.tipo_movimiento);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);

      const response = await this.apiClient.get(
        `/almacen/kardex/${productoId}?${params.toString()}`
      );
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo kardex del producto',
        details: error.response?.data
      };
    }
  }

  async obtenerReporteValorizacion(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fecha_corte) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_corte);
        if (fechaFormateada) params.append('fecha_corte', fechaFormateada);
      }
      if (filtros.almacen_id) params.append('almacen_id', filtros.almacen_id);
      if (filtros.categoria) params.append('categoria', filtros.categoria);

      const response = await this.apiClient.get(
        `/almacen/reportes/valorizacion?${params.toString()}`
      );
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo reporte de valorización',
        details: error.response?.data
      };
    }
  }

  async obtenerStockConsolidado() {
    try {
      const response = await this.apiClient.get('/almacen/reportes/stock-consolidado');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo stock consolidado',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // UPLOAD MASIVO DE STOCK
  // ===============================

  async previewUploadStock(formData) {
    try {
      const response = await this.apiClient.post('/almacen/upload/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000 // 2 minutos para preview de archivos grandes
      });
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error en preview de upload',
        details: error.response?.data
      };
    }
  }

  async ejecutarUploadStock(formData) {
    try {
      const response = await this.apiClient.post('/almacen/upload/ejecutar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000 // 5 minutos para ejecución de archivos grandes
      });
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error ejecutando upload',
        details: error.response?.data
      };
    }
  }

  async descargarPlantillaStock() {
    try {
      const response = await this.apiClient.get('/almacen/upload/plantilla', {
        responseType: 'blob',
      });

      // Crear y descargar archivo
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fecha = new Date().toISOString().split('T')[0];
      link.download = `plantilla_stock_${fecha}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        message: 'Plantilla descargada exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error descargando plantilla',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // INTEGRACIÓN CON VENTAS
  // ===============================

  async verificarStockParaVenta(datosVerificacion) {
    try {
      const validacion = this.validarVerificacionStock(datosVerificacion);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos de verificación inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.post('/almacen/verificar-stock', datosVerificacion);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error verificando stock para venta',
        details: error.response?.data
      };
    }
  }

  async descontarStockVenta(datosDescuento) {
    try {
      const validacion = this.validarDescuentoStock(datosDescuento);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos de descuento inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.post('/almacen/descontar-stock', datosDescuento);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error descontando stock por venta',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // UTILIDADES Y MANTENIMIENTO
  // ===============================

  async healthCheck() {
    try {
      const response = await this.apiClient.get('/almacen/health/basic');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error en health check',
        details: error.response?.data
      };
    }
  }

  async limpiarAlertasAntiguas() {
    try {
      const response = await this.apiClient.delete('/almacen/mantenimiento/limpiar-alertas');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error limpiando alertas antiguas',
        details: error.response?.data
      };
    }
  }

  async obtenerConfiguracion() {
    try {
      const response = await this.apiClient.get('/almacen/config');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo configuración',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // VALIDACIONES EMPRESARIALES
  // ===============================

  validarActualizacionStock(datos) {
    const errores = [];

    if (!datos.cantidad || isNaN(datos.cantidad) || datos.cantidad < 0) {
      errores.push('Cantidad debe ser un número positivo');
    }

    if (!datos.motivo || datos.motivo.trim().length < 5) {
      errores.push('Motivo debe tener al menos 5 caracteres');
    }

    if (!datos.tipo_movimiento || !['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'INICIAL'].includes(datos.tipo_movimiento)) {
      errores.push('Tipo de movimiento inválido');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarTransferencia(datos) {
    const errores = [];

    if (!datos.producto_id || !this.esUUIDValido(datos.producto_id)) {
      errores.push('ID de producto inválido');
    }

    if (!datos.almacen_origen_id || !this.esUUIDValido(datos.almacen_origen_id)) {
      errores.push('ID de almacén origen inválido');
    }

    if (!datos.almacen_destino_id || !this.esUUIDValido(datos.almacen_destino_id)) {
      errores.push('ID de almacén destino inválido');
    }

    if (datos.almacen_origen_id === datos.almacen_destino_id) {
      errores.push('Almacén origen y destino no pueden ser iguales');
    }

    if (!datos.cantidad || isNaN(datos.cantidad) || datos.cantidad <= 0) {
      errores.push('Cantidad debe ser mayor a 0');
    }

    if (!datos.motivo || datos.motivo.trim().length < 5) {
      errores.push('Motivo debe tener al menos 5 caracteres');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarResolucionAlerta(datos) {
    const errores = [];

    if (!datos.accion_tomada || datos.accion_tomada.trim().length < 5) {
      errores.push('Acción tomada debe tener al menos 5 caracteres');
    }

    if (datos.observaciones && datos.observaciones.length > 500) {
      errores.push('Observaciones no pueden exceder 500 caracteres');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarCambioEstadoDespacho(datos) {
    const errores = [];

    const estadosValidos = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
    if (!datos.nuevo_estado || !estadosValidos.includes(datos.nuevo_estado)) {
      errores.push('Estado de despacho inválido');
    }

    if (datos.observaciones && datos.observaciones.length > 255) {
      errores.push('Observaciones no pueden exceder 255 caracteres');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarCreacionDespacho(datos) {
    const errores = [];

    if (!datos.venta_id || !this.esUUIDValido(datos.venta_id)) {
      errores.push('ID de venta inválido');
    }

    if (!datos.almacen_id || !this.esUUIDValido(datos.almacen_id)) {
      errores.push('ID de almacén inválido');
    }

    if (!datos.fecha_programada) {
      errores.push('Fecha programada es requerida');
    }

    if (!datos.direccion_entrega || datos.direccion_entrega.trim().length < 10) {
      errores.push('Dirección de entrega debe tener al menos 10 caracteres');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarVerificacionStock(datos) {
    const errores = [];

    if (!datos.productos || !Array.isArray(datos.productos) || datos.productos.length === 0) {
      errores.push('Debe incluir al menos un producto');
    }

    if (datos.productos) {
      datos.productos.forEach((producto, index) => {
        if (!producto.producto_id || !this.esUUIDValido(producto.producto_id)) {
          errores.push(`Producto ${index + 1}: ID inválido`);
        }
        if (!producto.cantidad || isNaN(producto.cantidad) || producto.cantidad <= 0) {
          errores.push(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
        }
      });
    }

    if (datos.almacen_id && !this.esUUIDValido(datos.almacen_id)) {
      errores.push('ID de almacén inválido');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarDescuentoStock(datos) {
    const errores = [];

    if (!datos.venta_id || !this.esUUIDValido(datos.venta_id)) {
      errores.push('ID de venta inválido');
    }

    if (!datos.productos || !Array.isArray(datos.productos) || datos.productos.length === 0) {
      errores.push('Debe incluir al menos un producto');
    }

    if (datos.productos) {
      datos.productos.forEach((producto, index) => {
        if (!producto.producto_id || !this.esUUIDValido(producto.producto_id)) {
          errores.push(`Producto ${index + 1}: ID inválido`);
        }
        if (!producto.cantidad || isNaN(producto.cantidad) || producto.cantidad <= 0) {
          errores.push(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
        }
      });
    }

    if (datos.almacen_id && !this.esUUIDValido(datos.almacen_id)) {
      errores.push('ID de almacén inválido');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  // ===============================
  // UTILIDADES AUXILIARES
  // ===============================

  esUUIDValido(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  obtenerTiposMovimiento() {
    return [
      { value: 'ENTRADA', label: 'Entrada', descripcion: 'Ingreso de mercancía' },
      { value: 'SALIDA', label: 'Salida', descripcion: 'Egreso de mercancía' },
      { value: 'AJUSTE_POSITIVO', label: 'Ajuste Positivo', descripcion: 'Incremento por ajuste' },
      { value: 'AJUSTE_NEGATIVO', label: 'Ajuste Negativo', descripcion: 'Reducción por ajuste' },
      { value: 'TRANSFERENCIA', label: 'Transferencia', descripcion: 'Movimiento entre almacenes' },
      { value: 'INICIAL', label: 'Stock Inicial', descripcion: 'Inventario inicial' }
    ];
  }

  obtenerEstadosDespacho() {
    return [
      { value: 'PENDIENTE', label: 'Pendiente', color: 'yellow' },
      { value: 'PREPARANDO', label: 'Preparando', color: 'blue' },
      { value: 'LISTO', label: 'Listo', color: 'green' },
      { value: 'ENVIADO', label: 'Enviado', color: 'purple' },
      { value: 'ENTREGADO', label: 'Entregado', color: 'green' },
      { value: 'CANCELADO', label: 'Cancelado', color: 'red' }
    ];
  }

  obtenerTiposAlerta() {
    return [
      { value: 'STOCK_BAJO', label: 'Stock Bajo', color: 'yellow' },
      { value: 'STOCK_CRITICO', label: 'Stock Crítico', color: 'orange' },
      { value: 'SIN_STOCK', label: 'Sin Stock', color: 'red' },
      { value: 'VENCIMIENTO', label: 'Próximo Vencimiento', color: 'purple' }
    ];
  }

  async testConexion() {
    try {
      const response = await this.apiClient.get('/almacen/health/basic');
      return {
        success: true,
        data: response.data,
        message: 'Conexión con módulo de almacén exitosa'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error de conexión con almacén',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // EJECUCIÓN DE QUERIES Y ANÁLISIS ESPECÍFICOS
  // ===============================

  async ejecutarQuery(query, params = []) {
    try {
      // Validar que la query no sea peligrosa
      const validacion = this.validarQuerySegura(query);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Query no permitida: ${validacion.razon}`
        };
      }

      const response = await this.apiClient.post('/almacen/query/ejecutar', {
        query: query,
        params: params
      });

      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error ejecutando query personalizada',
        details: error.response?.data
      };
    }
  }

  async obtenerRotacionInventario(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/analisis/rotacion?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo rotación de inventario',
        details: error.response?.data
      };
    }
  }

  async obtenerEficienciaOperativa(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/analisis/eficiencia?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo eficiencia operativa',
        details: error.response?.data
      };
    }
  }

  async obtenerAnalisisStockSeguridad() {
    try {
      const response = await this.apiClient.get('/almacen/analisis/stock-seguridad');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo análisis de stock de seguridad',
        details: error.response?.data
      };
    }
  }

  async obtenerMapaCalorAlmacenes(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/analisis/mapa-calor?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo mapa de calor de almacenes',
        details: error.response?.data
      };
    }
  }

  async obtenerTendenciasInventario(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/analisis/tendencias?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo tendencias de inventario',
        details: error.response?.data
      };
    }
  }

  // ✅ MÉTODO CONSOLIDADO OPTIMIZADO - REEMPLAZA 5 LLAMADAS CON 1 SOLA
  async obtenerAnalisisConsolidado(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/analisis/consolidado?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data,
        performance: response.data.performance || {}
      };
    } catch (error) {
      console.error('Error en análisis consolidado, usando fallback:', error);

      // FALLBACK: Si falla, usar métodos individuales
      try {
        const [rotacion, eficiencia, stockSeguridad, mapaCalor, tendencias] = await Promise.all([
          this.obtenerRotacionInventario(periodo),
          this.obtenerEficienciaOperativa(periodo),
          this.obtenerAnalisisStockSeguridad(),
          this.obtenerMapaCalorAlmacenes(periodo),
          this.obtenerTendenciasInventario(periodo)
        ]);

        return {
          success: true,
          data: {
            rotacion: rotacion.data || [],
            eficiencia: eficiencia.data || { movimientos_por_dia: [], metricas_generales: {} },
            stock_seguridad: stockSeguridad.data || { distribucion: [], productos_criticos: [], recomendaciones: {} },
            mapa_calor: mapaCalor.data || [],
            tendencias: tendencias.data || []
          },
          fallback: true,
          performance: {
            optimizado: false,
            nota: 'Usando métodos individuales como fallback'
          }
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: 'Error en análisis consolidado y fallback: ' + fallbackError.message,
          details: error.response?.data
        };
      }
    }
  }

  // Validar que la query sea segura (solo SELECT, no DELETE/DROP/etc)
  validarQuerySegura(query) {
    if (!query || typeof query !== 'string') {
      return { valido: false, razon: 'Query inválida' };
    }

    const queryLimpia = query.trim().toLowerCase();
    
    // Solo permitir SELECT
    if (!queryLimpia.startsWith('select')) {
      return { valido: false, razon: 'Solo se permiten consultas SELECT' };
    }

    // Prohibir palabras peligrosas
    const palabrasProhibidas = [
      'drop', 'delete', 'insert', 'update', 'create', 'alter', 
      'truncate', 'exec', 'execute', 'sp_', 'xp_'
    ];

    for (const palabra of palabrasProhibidas) {
      if (queryLimpia.includes(palabra)) {
        return { valido: false, razon: `Palabra prohibida: ${palabra}` };
      }
    }

    return { valido: true };
  }
  
  // ===============================
  // REPORTES AVANZADOS (NUEVOS)
  // ===============================

  async getPerformanceComparativa(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/reportes/performance-comparativa?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo performance comparativa',
        details: error.response?.data
      };
    }
  }

  async getAnalisisPredictivoAlertas(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/reportes/analisis-predictivo?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo análisis predictivo de alertas',
        details: error.response?.data
      };
    }
  }

  async getValorizacionEvolutiva(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/reportes/valorizacion-evolutiva?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo valorización evolutiva',
        details: error.response?.data
      };
    }
  }

  async getKardexInteligente(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/reportes/kardex-inteligente?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo kardex inteligente',
        details: error.response?.data
      };
    }
  }

  async getEficienciaDespachos(periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/reportes/eficiencia-despachos?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo eficiencia de despachos',
        details: error.response?.data
      };
    }
  }

  // ==================== REPORTES CONSOLIDADO ====================
  async getReportesConsolidado(tipo_reporte, periodo = '30d') {
    try {
      const response = await this.apiClient.get(`/almacen/reportes/consolidado/${tipo_reporte}?periodo=${periodo}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo reporte consolidado',
        details: error.response?.data
      };
    }
  }
}

// Instancia singleton del servicio
const almacenService = new AlmacenService();
export default almacenService;