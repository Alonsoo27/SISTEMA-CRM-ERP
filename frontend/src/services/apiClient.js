// ============================================
// API CLIENT - CLIENTE HTTP BASE
// Sistema CRM/ERP v2.0 - Servicio de comunicación con Backend
// ============================================

class ApiClient {
    constructor() {
        // URL base del backend - obtener de .env o usar Railway en producción
        this.baseURL = import.meta.env.VITE_API_URL ||
                       (import.meta.env.MODE === 'production'
                         ? 'https://sistema-crm-erp-production.up.railway.app/api'
                         : 'http://localhost:3001/api');
        
        // Headers por defecto
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    // ============================================
    // OBTENER HEADERS CON AUTENTICACIÓN
    // ============================================
    getHeaders(customHeaders = {}) {
        const headers = { ...this.defaultHeaders, ...customHeaders };
        
        // Agregar token de autenticación si existe
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    // ============================================
    // MÉTODO GET
    // ============================================
    async get(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                method: 'GET',
                headers: this.getHeaders(options.headers),
                ...options
            };

            console.log(`📡 GET Request: ${url}`);
            
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Si es una respuesta JSON
            if (response.headers.get('content-type')?.includes('application/json')) {
                return await response.json();
            }
            
            // Si es otro tipo de contenido (como PDF), retornar response completo
            return response;

        } catch (error) {
            console.error(`❌ Error en GET ${endpoint}:`, error);
            throw this.handleError(error);
        }
    }

    // ============================================
    // MÉTODO POST
    // ============================================
    async post(endpoint, data = null, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                method: 'POST',
                headers: this.getHeaders(options.headers),
                ...(data && { body: JSON.stringify(data) }),
                ...options
            };

            console.log(`📡 POST Request: ${url}`);

            const response = await fetch(url, config);

            if (!response.ok) {
                // Intentar leer el body del error para pasarlo al catch
                let errorData = null;
                try {
                    if (response.headers.get('content-type')?.includes('application/json')) {
                        errorData = await response.json();
                    }
                } catch (e) {
                    // Si no se puede parsear, continuar sin data
                }

                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.response = { status: response.status, data: errorData };
                throw error;
            }

            // Si es una respuesta JSON
            if (response.headers.get('content-type')?.includes('application/json')) {
                return await response.json();
            }

            // Si es otro tipo de contenido (como PDF), retornar response completo
            return response;

        } catch (error) {
            // No loggear como error si es una colisión (409) - es parte del flujo normal
            if (error.status !== 409) {
                console.error(`❌ Error en POST ${endpoint}:`, error);
            }
            throw this.handleError(error);
        }
    }

    // ============================================
    // MÉTODO ESPECIAL PARA DESCARGAR ARCHIVOS
    // ============================================
    async downloadFile(endpoint, data = null, filename = null) {
    try {
        const url = `${this.baseURL}${endpoint}`;
        
        // Obtener token para authorization
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        // Headers limpios - solo Authorization, NO Content-Type
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            method: data ? 'POST' : 'GET',
            headers: headers
        };
        
        // Solo agregar body y Content-Type si hay data
        if (data) {
            config.body = JSON.stringify(data);
            config.headers['Content-Type'] = 'application/json';
        }
        
        console.log(`📥 Download Request: ${url}`);
        
        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Obtener el blob
        const blob = await response.blob();
        
        // Crear URL temporal
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // Crear elemento de descarga
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename || this.getFilenameFromResponse(response) || 'download';
        
        // Ejecutar descarga
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpiar URL temporal
        window.URL.revokeObjectURL(downloadUrl);
        
        return {
            success: true,
            message: 'Archivo descargado exitosamente'
        };
        
    } catch (error) {
        console.error(`❌ Error en download ${endpoint}:`, error);
        throw this.handleError(error);
    }
}

    // ============================================
    // UTILIDADES
    // ============================================
    getFilenameFromResponse(response) {
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) {
                return filenameMatch[1];
            }
        }
        return null;
    }

    handleError(error) {
        // Manejo centralizado de errores
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return new Error('Error de conexión con el servidor');
        }

        if (error.message.includes('401')) {
            // Token expirado o no autorizado
            localStorage.removeItem('token');
            localStorage.removeItem('authToken');
            // No redirigir automáticamente, solo limpiar tokens
            return new Error('Sesión expirada');
        }

        if (error.message.includes('403')) {
            return new Error('No tiene permisos para realizar esta acción');
        }

        if (error.message.includes('404')) {
            return new Error('Recurso no encontrado');
        }

        if (error.message.includes('500')) {
            return new Error('Error interno del servidor');
        }

        // IMPORTANTE: Preservar propiedades del error original (como response y status)
        // para que el manejo de colisiones funcione correctamente
        return error;
    }

    // ============================================
    // CONFIGURACIÓN DINÁMICA
    // ============================================
    setBaseURL(url) {
        this.baseURL = url;
    }

    setDefaultHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }
}

// Crear instancia única (Singleton)
const apiClient = new ApiClient();

export default apiClient;