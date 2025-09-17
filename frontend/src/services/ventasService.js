// src/services/ventasService.js
import axios from 'axios';
import { AuthUtils } from '../utils/auth';

const API_BASE_URL = 'http://localhost:3001/api';

class VentasService {
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

  // Formatear montos para mostrar
  formatearMonto(monto) {
    if (!monto || isNaN(monto)) return '0.00';
    return parseFloat(monto).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatearPrecio(precio) {
    return this.formatearMonto(precio);
  }

  // Formatear fecha para API (YYYY-MM-DD)
  formatearFechaParaAPI(fecha) {
    if (!fecha) return null;
    
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    
    try {
      const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
      return fechaObj.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Error formateando fecha:', error);
      return null;
    }
  }

  // ===============================
  // GESTIÓN DE VENTAS
  // ===============================

  // Obtener todas las ventas con filtros
  async obtenerVentas(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.asesor_id) params.append('asesor_id', filtros.asesor_id);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.estado_detallado) params.append('estado_detallado', filtros.estado_detallado);
      if (filtros.cliente_id) params.append('cliente_id', filtros.cliente_id);
      if (filtros.fecha_desde) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
        if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
      }
      if (filtros.fecha_hasta) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
        if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
      }
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.rango_monto?.min) params.append('monto_min', filtros.rango_monto.min);
      if (filtros.rango_monto?.max) params.append('monto_max', filtros.rango_monto.max);
      if (filtros.tipo_venta) params.append('tipo_venta', filtros.tipo_venta);
      if (filtros.orden) params.append('orden', filtros.orden);
      if (filtros.pagina) params.append('pagina', filtros.pagina);
      if (filtros.limite) params.append('limite', filtros.limite);

      const response = await this.apiClient.get(`/ventas?${params.toString()}`);
      return response.data;

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo ventas',
        details: error.response?.data
      };
    }
  }

  // ✅ CORREGIDO: obtenerMetricas procesa datos para VentasMetrics.jsx
  // REEMPLAZAR el método obtenerMetricas() existente en ventasService.js (línea ~472)
  
  // Obtener métricas generales de ventas CON BONOS INTEGRADOS
  async obtenerMetricas(filtros = {}) {
    const params = new URLSearchParams();
    
    if (filtros.asesor_id) params.append('asesor_id', filtros.asesor_id);
    if (filtros.fecha_desde) {
      const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
      if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
    }
    if (filtros.fecha_hasta) {
      const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
      if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
    }

    try {
      // 🔥 PARALELO: Obtener ventas Y bonos al mismo tiempo
      const [ventasResponse, bonosResponse] = await Promise.all([
        this.apiClient.get(`/ventas?${params.toString()}`),
        this.apiClient.get(`/comisiones/bono-actual/${filtros.asesor_id || 1}`) // Usuario actual
      ]);
      
      // Procesar respuesta de ventas
      const ventasData = ventasResponse.data;
      const ventasMetricas = ventasData.metricas || {};
      
      // Procesar respuesta de bonos
      const bonosData = bonosResponse.data;
      console.log('🔍 DATOS BONOS RECIBIDOS:', bonosData);
      
      let bonoActual = 0;
      let porcentajeMeta = 0;
      let faltaParaSiguiente = 0;
      let metaTotal = 0;
      let vendidoTotal = 0;
      
      if (bonosData.success && bonosData.data) {
        const bono = bonosData.data;
        bonoActual = bono.bono_actual?.bono_usd || 0;
        porcentajeMeta = bono.bono_actual?.porcentaje || 0;
        metaTotal = bono.asesor?.meta_usd || 0;
        vendidoTotal = bono.asesor?.vendido_usd || 0;
        faltaParaSiguiente = bono.siguiente_nivel?.falta_usd || 0;
      }
      
      const processed = {
        // 🔄 REORGANIZACIÓN: Ingresos reales en lugar de ventas
        ventas_periodo: ventasData.ventas?.length || 0,
        meta_periodo: metaTotal,
        ingresos_periodo: vendidoTotal ? `$${this.formatearMonto(vendidoTotal)}` : '$0', // ✅ INGRESOS REALES
        
        // 🔥 NUEVO: Bonos proyectados (reemplaza comisiones)
        bonos_periodo: bonoActual ? `$${this.formatearMonto(bonoActual)}` : '$0', // ✅ BONOS CALCULADOS
        comisiones_periodo: bonoActual ? `$${this.formatearMonto(bonoActual)}` : '$0', // Mantener compatibilidad
        porcentaje_meta: `${porcentajeMeta}%`,
        falta_siguiente_nivel: faltaParaSiguiente,
        
        // Métricas existentes (mantener compatibilidad)
        tasa_conversion: '16.67%', // Calcular desde prospectos
        oportunidades: ventasData.ventas?.length || 0,
        ticket_promedio: ventasMetricas.promedio_venta || 0,
        ventas_cerradas: ventasData.ventas?.filter(v => v.estado_detallado?.includes('capacitado')).length || 0,
        ventas_pendientes: ventasData.ventas?.filter(v => !v.estado_detallado?.includes('capacitado')).length || 0,
        pipeline_total: ventasMetricas.total_valor ? `$${this.formatearMonto(ventasMetricas.total_valor)}` : '$0',
        
        // Crecimiento (mockup por ahora)
        crecimiento_ventas: '0.0',
        crecimiento_ingresos: '0.0',
        cambio_conversion: '0.0',
        crecimiento_clientes: '0.0',
        clientes_nuevos_periodo: 0,
        clientes_activos: 10, // Desde tu imagen
        cumplimiento_meta: `${porcentajeMeta}%`,
        tiempo_promedio_cierre: 0,
        
        // 🔥 NUEVO: Datos para el modal de bonos
        detalle_bonos: bonosData.data || null,
        
        distribucion_estados: ventasData.ventas?.reduce((acc, venta) => {
          const estado = venta.estado_detallado || venta.estado || 'Sin estado';
          const existente = acc.find(item => item.estado === estado);
          if (existente) {
            existente.cantidad++;
          } else {
            acc.push({ estado, cantidad: 1, porcentaje: 0 });
          }
          return acc;
        }, []).map(item => ({
          ...item,
          porcentaje: Math.round((item.cantidad / (ventasData.ventas?.length || 1)) * 100)
        })) || []
      };
      
      console.log('✅ MÉTRICAS PROCESADAS CON BONOS:', processed);
      
      return {
        success: true,
        data: processed
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo métricas con bonos:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo métricas',
        details: error.response?.data
      };
    }
  }

  // Obtener último correlativo del asesor
  async obtenerUltimoCorrelativo(asesorId) {
    try {
      const response = await this.apiClient.get(`/ventas/ultimo-correlativo/${asesorId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo correlativo',
        details: error.response?.data
      };
    }
  }

  // 🆕 NUEVO MÉTODO: Obtener próximos correlativos usando las funciones SQL profesionales
  async obtenerProximosCorrelativos(asesorId, year = null) {
    try {
      const targetYear = year || new Date().getFullYear();
      
      console.log(`🔢 Solicitando correlativos para asesor ${asesorId}, año ${targetYear}`);
      
      const response = await this.apiClient.post('/ventas/proximos-correlativos', {
        asesor_id: parseInt(asesorId),
        year: targetYear
      });
      
      console.log('✅ Respuesta correlativos:', response.data);
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      console.error('❌ Error obteniendo correlativos:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo correlativos',
        details: error.response?.data
      };
    }
  }

  // Crear venta con correlativo automático
  async crearVentaConCorrelativo(datosVenta) {
    try {
      const response = await this.apiClient.post('/ventas/crear-con-correlativo', datosVenta);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error creando venta con correlativo',
        details: error.response?.data
      };
    }
  }

  // Crear venta completa con productos
  async crearVentaCompleta(datosVenta) {
    try {
      const validacion = this.validarDatosVentaCompleta(datosVenta);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos inválidos: ${validacion.errores.join(', ')}`
        };
      }

      const response = await this.apiClient.post('/ventas', datosVenta);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error creando venta completa',
        details: error.response?.data
      };
    }
  }

  // Actualizar venta completa con productos
  async actualizarVentaCompleta(ventaId, datosVenta) {
    try {
      const validacion = this.validarDatosVentaCompleta(datosVenta);
      if (!validacion.valido) {
        return {
          success: false,
          error: `Datos inválidos: ${validacion.errores.join(', ')}`
        };
      }
      console.log('🔍 DATOS ENVIADOS AL BACKEND:', datosVenta);
      console.log('🔍 PRODUCTOS DETALLADOS:', JSON.stringify(datosVenta.productos, null, 2));
      const response = await this.apiClient.put(`/ventas/${ventaId}`, datosVenta);  // ← CAMBIO AQUÍ
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error actualizando venta completa',
        details: error.response?.data
      };
    }
  }

  // Obtener detalles de productos de una venta
  async obtenerDetallesVenta(ventaId) {
    try {
      const response = await this.apiClient.get(`/ventas/${ventaId}/detalles`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo detalles de venta',
        details: error.response?.data
      };
    }
  }

  // Cambiar estado detallado de venta
  async cambiarEstadoDetallado(ventaId, nuevoEstado, observacion = '') {
    try {
      const response = await this.apiClient.patch(`/ventas/${ventaId}/estado-detallado`, {
        estado_detallado: nuevoEstado,
        observacion: observacion
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error cambiando estado detallado',
        details: error.response?.data
      };
    }
  }

  // Validar cambio de estado
  async validarCambioEstado(ventaId, nuevoEstado) {
    try {
      const response = await this.apiClient.post(`/ventas/${ventaId}/validar-cambio-estado`, {
        nuevo_estado: nuevoEstado
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error validando cambio de estado',
        details: error.response?.data
      };
    }
  }

  // Cambiar estado general de venta
  async cambiarEstadoVenta(ventaId, datos) {
    try {
      const response = await this.apiClient.put(`/ventas/${ventaId}/estado`, datos);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error cambiando estado de venta',
        details: error.response?.data
      };
    }
  }

  // Obtener estadísticas del asesor
  async obtenerEstadisticasAsesor(asesorId) {
    try {
      const response = await this.apiClient.get(`/ventas/estadisticas-asesor/${asesorId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo estadísticas del asesor',
        details: error.response?.data
      };
    }
  }

  // Obtener una venta por ID
  async obtenerVentaPorId(id) {
    try {
      const response = await this.apiClient.get(`/ventas/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo venta',
        details: error.response?.data
      };
    }
  }

  // Crear nueva venta (método legacy mantenido)
  async crearVenta(datosVenta) {
    try {
      const response = await this.apiClient.post('/ventas', datosVenta);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error creando venta',
        details: error.response?.data
      };
    }
  }

  // Actualizar venta existente (método legacy mantenido)
  async actualizarVenta(id, datosVenta) {
    try {
      const response = await this.apiClient.put(`/ventas/${id}`, datosVenta);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error actualizando venta',
        details: error.response?.data
      };
    }
  }

  // Eliminar venta
  async eliminarVenta(id) {
    try {
      const response = await this.apiClient.delete(`/ventas/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error eliminando venta',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // DASHBOARDS POR ROL
  // ===============================

// Obtener dashboard del equipo
  async obtenerDashboardEquipo(filtros = {}) {
    try {
      const response = await this.apiClient.get('/ventas/dashboard', {
        params: filtros
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo dashboard de equipo',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // NUEVOS DASHBOARDS EJECUTIVOS - ENDPOINTS CORREGIDOS
  // ===============================

  async obtenerVistaUnificada(periodo = 'mes_actual') {
    try {
      const response = await this.apiClient.get(`/dashboard-ejecutivo/vista-unificada?periodo=${periodo}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo vista unificada',
        details: error.response?.data
      };
    }
  }

  async obtenerDashboardGeografico(periodo = 'mes_actual') {
    try {
      const response = await this.apiClient.get(`/dashboard-ejecutivo/analisis-geografico?periodo=${periodo}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo análisis geográfico',
        details: error.response?.data
      };
    }
  }

  async obtenerDashboardABCProductos(periodo = 'mes_actual') {
    try {
      const response = await this.apiClient.get(`/dashboard-ejecutivo/abc-productos?periodo=${periodo}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo ABC productos',
        details: error.response?.data
      };
    }
  }

  async obtenerDashboardMetasAvanzado(periodo = 'mes_actual') {
    try {
      const response = await this.apiClient.get(`/dashboard-ejecutivo/metas-avanzado?periodo=${periodo}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo metas avanzado',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // MÉTODOS LEGACY MANTENIDOS
  // ===============================

  async obtenerIndicesDashboards() {
    try {
      const response = await this.apiClient.get('/dashboards/');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error obteniendo índice de dashboards',
        details: error.response?.data
      };
    }
  }

  async testDashboards() {
    try {
      const response = await this.apiClient.get('/dashboards/health');
      return {
        success: true,
        data: response.data,
        message: 'Dashboards funcionando correctamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error conectando con dashboards',
        details: error.response?.data
      };
    }
  }

  // Obtener tendencias de ventas para gráficos
  async obtenerTendenciasVentas(periodo = '30d', asesorId = null) {
    try {
      const params = new URLSearchParams();
      params.append('periodo', periodo);
      if (asesorId) params.append('asesor_id', asesorId);

      const response = await this.apiClient.get(`/ventas/tendencias?${params.toString()}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo tendencias',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // GESTIÓN DE CLIENTES
  // ===============================

  async obtenerClientes(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.tipo) params.append('tipo', filtros.tipo);
      if (filtros.activo !== undefined) params.append('activo', filtros.activo);

      const response = await this.apiClient.get(`/clientes?${params.toString()}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error obteniendo clientes',
        details: error.response?.data
      };
    }
  }

  async crearCliente(datosCliente) {
    try {
      const response = await this.apiClient.post('/clientes', datosCliente);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error creando cliente',
        details: error.response?.data
      };
    }
  }

  async actualizarCliente(id, datosCliente) {
    try {
      const response = await this.apiClient.put(`/clientes/${id}`, datosCliente);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error actualizando cliente',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // PRODUCTOS Y SERVICIOS
  // ===============================

  async obtenerProductos(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.activo !== undefined) params.append('activo', filtros.activo);

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

  // ===============================
  // EXPORTACIÓN Y REPORTES
  // ===============================

  async exportarVentas(filtros = {}, formato = 'excel') {
    try {
      const params = new URLSearchParams();
      
      if (filtros.asesor_id) params.append('asesor_id', filtros.asesor_id);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.estado_detallado) params.append('estado_detallado', filtros.estado_detallado);
      if (filtros.fecha_desde) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_desde);
        if (fechaFormateada) params.append('fecha_desde', fechaFormateada);
      }
      if (filtros.fecha_hasta) {
        const fechaFormateada = this.formatearFechaParaAPI(filtros.fecha_hasta);
        if (fechaFormateada) params.append('fecha_hasta', fechaFormateada);
      }
      params.append('formato', formato);

      const response = await this.apiClient.get(`/ventas/exportar?${params.toString()}`, {
        responseType: 'blob'
      });

      // Crear y descargar archivo
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fecha = new Date().toISOString().split('T')[0];
      const extension = formato === 'excel' ? 'xlsx' : 'csv';
      link.download = `ventas_${fecha}.${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        message: 'Archivo descargado exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error exportando ventas',
        details: error.response?.data
      };
    }
  }

  // ===============================
  // VALIDACIONES Y UTILIDADES
  // ===============================

  validarDatosVentaCompleta(datosVenta) {
  const errores = [];

  if (!datosVenta.nombre_cliente?.trim()) {
    errores.push('Nombre del cliente es requerido');
  }

  if (!datosVenta.productos || datosVenta.productos.length === 0) {
    errores.push('Debe incluir al menos un producto');
  }

  if (!datosVenta.valor_total || datosVenta.valor_total <= 0) {
    errores.push('Valor total debe ser mayor a 0');
  }

  if (!datosVenta.tipo_venta) {
    errores.push('Tipo de venta es requerido');
  }

  if (!datosVenta.estado_detallado) {
    errores.push('Estado detallado es requerido');
  }

  // Validar email si se proporciona
  if (datosVenta.cliente_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datosVenta.cliente_email)) {
    errores.push('Email no tiene formato válido');
  }

  // Validar productos
  if (datosVenta.productos) {
    datosVenta.productos.forEach((producto, index) => {
      if (!producto.producto_id) {
        errores.push(`Producto ${index + 1}: ID de producto requerido`);
      }
      if (!producto.cantidad || producto.cantidad <= 0) {
        errores.push(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
      }
      if (!producto.precio_unitario || producto.precio_unitario <= 0) {
        errores.push(`Producto ${index + 1}: Precio unitario debe ser mayor a 0`);
      }
    });
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

  validarDatosCliente(datosCliente) {
    const errores = [];

    if (!datosCliente.nombre?.trim()) {
      errores.push('Nombre es requerido');
    }

    if (!datosCliente.email?.trim()) {
      errores.push('Email es requerido');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datosCliente.email)) {
      errores.push('Email no tiene formato válido');
    }

    if (!datosCliente.telefono?.trim()) {
      errores.push('Teléfono es requerido');
    }

    if (datosCliente.tipo === 'empresa' && !datosCliente.empresa?.trim()) {
      errores.push('Nombre de empresa es requerido para clientes tipo empresa');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  validarTransicionEstado(estadoActual, estadoNuevo) {
    const transicionesValidas = {
      'vendido': ['vendido/enviado', 'anulado', 'cambio'],
      'vendido/enviado': ['vendido/enviado/recibido', 'anulado', 'cambio'],
      'vendido/enviado/recibido': ['vendido/enviado/recibido/capacitado', 'anulado', 'cambio'],
      'vendido/enviado/recibido/capacitado': ['anulado', 'cambio'],
      'anulado': [],
      'cambio': ['cambio/enviado', 'anulado'],
      'cambio/enviado': ['cambio/enviado/recibido', 'anulado'],
      'cambio/enviado/recibido': ['vendido/enviado/recibido/capacitado', 'anulado']
    };

    const transicionesPermitidas = transicionesValidas[estadoActual] || [];
    return transicionesPermitidas.includes(estadoNuevo);
  }

  obtenerSiguientesEstados(estadoActual) {
    const transicionesValidas = {
      'vendido': [
        { value: 'vendido/enviado', label: 'Marcar como Enviado', descripcion: 'Producto enviado al cliente' },
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar la venta' },
        { value: 'cambio', label: 'Solicitar Cambio', descripcion: 'Cliente solicita cambio' }
      ],
      'vendido/enviado': [
        { value: 'vendido/enviado/recibido', label: 'Marcar como Recibido', descripcion: 'Cliente confirma recepción' },
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar la venta' },
        { value: 'cambio', label: 'Solicitar Cambio', descripcion: 'Cliente solicita cambio' }
      ],
      'vendido/enviado/recibido': [
        { value: 'vendido/enviado/recibido/capacitado', label: 'Marcar como Capacitado', descripcion: 'Cliente capacitado - Venta completa' },
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar la venta' },
        { value: 'cambio', label: 'Solicitar Cambio', descripcion: 'Cliente solicita cambio' }
      ],
      'vendido/enviado/recibido/capacitado': [
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar la venta (excepcional)' },
        { value: 'cambio', label: 'Solicitar Cambio', descripcion: 'Cliente solicita cambio (excepcional)' }
      ],
      'cambio': [
        { value: 'cambio/enviado', label: 'Marcar Cambio Enviado', descripcion: 'Producto de cambio enviado' },
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar completamente' }
      ],
      'cambio/enviado': [
        { value: 'cambio/enviado/recibido', label: 'Cambio Recibido', descripcion: 'Cliente recibió el cambio' },
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar completamente' }
      ],
      'cambio/enviado/recibido': [
        { value: 'vendido/enviado/recibido/capacitado', label: 'Completar Venta', descripcion: 'Cambio exitoso - Venta completa' },
        { value: 'anulado', label: 'Anular Venta', descripcion: 'Cancelar completamente' }
      ],
      'anulado': []
    };

    return transicionesValidas[estadoActual] || [];
  }

  async testConexion() {
    try {
      const response = await this.apiClient.get('/ventas/test');
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
const ventasService = new VentasService();
export default ventasService;