// ============================================
// CLIENTES SERVICE - COMUNICACIÓN API MEJORADA
// Sistema CRM/ERP v2.0 - Servicio profesional integrado
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ClientesService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/ventas/clientes`;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Obtener headers con autenticación
   */
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || 'fake-jwt-token-for-testing'}`
    };
  }

  /**
   * Sistema de caché inteligente
   */
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Wrapper para peticiones con manejo de errores mejorado
   */
  async apiRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
        ...options
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`Error en petición a ${url}:`, error);

      // Manejo específico de errores
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Error de conexión. Verifique su conexión a internet.');
      }

      throw error;
    }
  }

  /**
   * Buscar cliente por documento (DNI/RUC) con caché
   */
  async buscarPorDocumento(documento) {
    const cacheKey = `documento_${documento}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseURL}/buscar/${documento}`, {
        headers: this.getAuthHeaders()
      });

      const data = await response.json();

      // 404 es un resultado válido (cliente no encontrado)
      if (response.status === 404) {
        const result = {
          success: false,
          message: 'Cliente no encontrado',
          data: null
        };
        this.setCachedData(cacheKey, result);
        return result;
      }

      // Otros errores sí son problemas
      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP Error: ${response.status}`);
      }

      // Cliente encontrado exitosamente
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      // Solo logear errores reales, no 404
      if (!error.message.includes('404')) {
        console.error('Error buscando cliente por documento:', error);
      }
      throw error;
    }
  }

  /**
   * Crear nuevo cliente con validaciones
   */
  async crear(datosCliente) {
    try {
      // Validaciones básicas
      this.validarDatosCliente(datosCliente);

      const data = await this.apiRequest(this.baseURL, {
        method: 'POST',
        body: JSON.stringify(datosCliente)
      });

      // Limpiar caché después de crear
      this.clearCache();

      return data;
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los clientes con filtros avanzados
   */
  async obtenerTodos(filtros = {}) {
    try {
      const queryParams = new URLSearchParams();

      // Filtros mejorados
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });

      const cacheKey = `clientes_${queryParams.toString()}`;
      const cached = this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }

      const url = queryParams.toString()
        ? `${this.baseURL}?${queryParams.toString()}`
        : this.baseURL;

      const data = await this.apiRequest(url);

      // Procesar y enriquecer datos
      if (data.data && Array.isArray(data.data)) {
        data.data = data.data.map(cliente => this.procesarClienteData(cliente));
      }

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      throw error;
    }
  }

  /**
   * Obtener cliente por ID
   */
  async obtenerPorId(id) {
    const cacheKey = `cliente_${id}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const data = await this.apiRequest(`${this.baseURL}/${id}`);

      if (data.data) {
        data.data = this.procesarClienteData(data.data);
      }

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error obteniendo cliente por ID:', error);
      throw error;
    }
  }

  /**
   * Actualizar cliente
   */
  async actualizar(id, datosCliente) {
    try {
      this.validarDatosCliente(datosCliente);

      const data = await this.apiRequest(`${this.baseURL}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(datosCliente)
      });

      // Limpiar caché después de actualizar
      this.clearCache();

      return data;
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      throw error;
    }
  }

  /**
   * Eliminar cliente (soft delete)
   */
  async eliminar(id) {
    try {
      const data = await this.apiRequest(`${this.baseURL}/${id}`, {
        method: 'DELETE'
      });

      // Limpiar caché después de eliminar
      this.clearCache();

      return data;
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      throw error;
    }
  }

  /**
   * Autocompletado inteligente
   */
  async autocomplete(query, limite = 10) {
    if (!query || query.length < 2) {
      return { data: [] };
    }

    try {
      const url = `${this.baseURL}/autocomplete?q=${encodeURIComponent(query)}&limit=${limite}`;
      return await this.apiRequest(url);
    } catch (error) {
      console.error('Error en autocompletado:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas avanzadas
   */
  async obtenerEstadisticas(periodo = 'mes_actual') {
    const cacheKey = `estadisticas_${periodo}`;
    const cached = this.getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const url = `${this.baseURL}/estadisticas?periodo=${periodo}`;
      const data = await this.apiRequest(url);

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Exportar clientes a diferentes formatos
   */
  async exportar(formato = 'excel', filtros = {}) {
    try {
      const queryParams = new URLSearchParams({
        formato,
        ...filtros
      });

      const url = `${this.baseURL}/exportar?${queryParams.toString()}`;

      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al exportar clientes');
      }

      // Retornar blob para descarga
      return await response.blob();
    } catch (error) {
      console.error('Error exportando clientes:', error);
      throw error;
    }
  }

  /**
   * Health check del servicio
   */
  async healthCheck() {
    try {
      return await this.apiRequest(`${this.baseURL}/health`);
    } catch (error) {
      console.error('Error en health check:', error);
      throw error;
    }
  }

  /**
   * Validaciones de datos de cliente
   */
  validarDatosCliente(datos) {
    const errores = [];

    // Validar tipo de cliente
    if (!datos.tipo_cliente || !['persona', 'empresa'].includes(datos.tipo_cliente)) {
      errores.push('Tipo de cliente requerido (persona/empresa)');
    }

    // Validar según tipo
    if (datos.tipo_cliente === 'persona') {
      if (!datos.nombres?.trim()) errores.push('Nombres requeridos');
      if (!datos.apellidos?.trim()) errores.push('Apellidos requeridos');
    } else if (datos.tipo_cliente === 'empresa') {
      if (!datos.razon_social?.trim()) errores.push('Razón social requerida');
    }

    // Validar documento
    if (!datos.tipo_documento || !datos.numero_documento) {
      errores.push('Tipo y número de documento requeridos');
    } else if (!this.validarDocumento(datos.tipo_documento, datos.numero_documento)) {
      errores.push('Número de documento inválido');
    }

    // Validar email si se proporciona
    if (datos.email && !this.validarEmail(datos.email)) {
      errores.push('Email inválido');
    }

    if (errores.length > 0) {
      throw new Error(`Errores de validación: ${errores.join(', ')}`);
    }
  }

  /**
   * Validar número de documento mejorado
   */
  validarDocumento(tipoDocumento, numeroDocumento) {
    if (!numeroDocumento || numeroDocumento.trim().length < 3) {
      return false;
    }

    const numero = numeroDocumento.trim();

    switch (tipoDocumento) {
      case 'DNI':
        return /^[0-9]{8}$/.test(numero);
      case 'RUC':
        return /^[0-9]{11}$/.test(numero) && this.validarRUC(numero);
      case 'PASAPORTE':
        return numero.length >= 6 && numero.length <= 12 && /^[A-Z0-9]+$/.test(numero);
      case 'CE':
        return numero.length >= 6 && numero.length <= 12 && /^[A-Z0-9]+$/.test(numero);
      default:
        return false;
    }
  }

  /**
   * Validación específica de RUC peruano
   */
  validarRUC(ruc) {
    if (ruc.length !== 11) return false;

    // Verificar primer dígito (tipo de contribuyente)
    const primerDigito = ruc.charAt(0);
    if (!['1', '2'].includes(primerDigito)) return false;

    // Validar dígito verificador (algoritmo simplificado)
    const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 10; i++) {
      suma += parseInt(ruc.charAt(i)) * factores[i];
    }

    const resto = suma % 11;
    const digitoVerificador = resto < 2 ? resto : 11 - resto;

    return digitoVerificador === parseInt(ruc.charAt(10));
  }

  /**
   * Validar email
   */
  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Procesar y enriquecer datos del cliente
   */
  procesarClienteData(cliente) {
    if (!cliente) return null;

    return {
      ...cliente,
      // Campos calculados
      nombre_completo: cliente.tipo_cliente === 'persona'
        ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
        : cliente.razon_social || '',

      contacto_completo: cliente.contacto_nombres && cliente.contacto_apellidos
        ? `${cliente.contacto_nombres} ${cliente.contacto_apellidos}`
        : cliente.contacto_nombres || '',

      documento_completo: `${cliente.tipo_documento}: ${cliente.numero_documento}`,

      ubicacion_completa: [
        cliente.distrito,
        cliente.provincia,
        cliente.departamento
      ].filter(Boolean).join(', '),

      // Metadatos útiles
      es_persona: cliente.tipo_cliente === 'persona',
      es_empresa: cliente.tipo_cliente === 'empresa',
      tiene_email: Boolean(cliente.email),
      tiene_telefono: Boolean(cliente.telefono),

      // Fecha formateada
      fecha_registro: cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('es-PE') : null
    };
  }

  /**
   * Obtener opciones para formularios
   */
  getOpcionesFormulario() {
    return {
      tiposDocumento: [
        { value: 'DNI', label: 'DNI', longitud: 8 },
        { value: 'RUC', label: 'RUC', longitud: 11 },
        { value: 'PASAPORTE', label: 'Pasaporte', longitud: [6, 12] },
        { value: 'CE', label: 'Carnet de Extranjería', longitud: [6, 12] }
      ],
      tiposCliente: [
        { value: 'persona', label: 'Persona Natural' },
        { value: 'empresa', label: 'Empresa' }
      ]
    };
  }
}

export default new ClientesService();