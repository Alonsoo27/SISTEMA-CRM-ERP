// frontend/src/services/notificacionesService.js
import { API_CONFIG } from '../config/apiConfig';

const API_BASE = `${API_CONFIG.BASE_URL}/api`;

class NotificacionesService {
    
    constructor() {
        console.log('🔔 Servicio de notificaciones inicializado');
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 segundos
    }

    // ✅ CORREGIDO: Obtener usuario actual del localStorage (misma key que authService)
    getCurrentUserId() {
        // Opción 1: Obtener del objeto user completo (PRIORIDAD)
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.id) {
                    return user.id.toString();
                }
            }
        } catch (error) {
            console.warn('⚠️ Error obteniendo user desde localStorage:', error);
        }

        // Opción 2: Decodificar token JWT
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // Validar que sea un JWT real (3 partes separadas por puntos)
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    const userId = payload.user_id || payload.id || payload.sub;
                    if (userId) return userId.toString();
                } else {
                    console.warn('⚠️ Token no tiene formato JWT válido');
                }
            } catch (error) {
                console.warn('⚠️ Error decodificando token:', error);
            }
        }

        // Opción 3: Fallback a usuario 1 para desarrollo
        console.warn('⚠️ No se encontró usuario, usando fallback');
        return '1';
    }

    // ✅ CORREGIDO: Headers con token correcto de localStorage
    getHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }

    async handleError(response, endpoint) {
        if (!response.ok) {
            switch (response.status) {
                case 401:
                    console.warn('🚫 Token expirado o inválido');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    throw new Error('Sesión expirada. Inicia sesión nuevamente.');
                
                case 403:
                    throw new Error('No tienes permisos para realizar esta acción.');
                
                case 429:
                    throw new Error('Demasiadas solicitudes. Espera un momento.');
                
                case 500:
                    throw new Error('Error interno del servidor. Intenta más tarde.');
                
                default:
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        return await response.json();
    }

    async obtenerNotificaciones(limite = 20, soloNoLeidas = false) {
        const userId = this.getCurrentUserId();
        const cacheKey = `notificaciones_${userId}_${limite}_${soloNoLeidas}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📦 Usando notificaciones desde cache');
                return cached.data;
            }
        }

        try {
            console.log(`📡 Obteniendo notificaciones para usuario ${userId}: limite=${limite}, soloNoLeidas=${soloNoLeidas}`);
            
            const response = await fetch(
                `${API_BASE}/notificaciones/${userId}?limite=${limite}&solo_no_leidas=${soloNoLeidas}`,
                {
                    method: 'GET',
                    headers: this.getHeaders()
                }
            );

            const data = await this.handleError(response, 'obtenerNotificaciones');
            console.log(`✅ Notificaciones obtenidas para usuario ${userId}:`, data);
            
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error(`❌ Error obteniendo notificaciones para usuario ${userId}:`, error);
            return { 
                success: false, 
                data: [], 
                total_no_leidas: 0,
                error: error.message 
            };
        }
    }

    async obtenerContador() {
        const userId = this.getCurrentUserId();
        
        try {
            console.log(`📡 Obteniendo contador para usuario ${userId}...`);
            
            const response = await fetch(`${API_BASE}/notificaciones/contador/${userId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await this.handleError(response, 'obtenerContador');
            console.log(`✅ Contador obtenido para usuario ${userId}:`, data);
            
            return data;
        } catch (error) {
            console.error(`❌ Error obteniendo contador para usuario ${userId}:`, error);
            return { 
                success: false, 
                contador: 0,
                error: error.message 
            };
        }
    }

    async marcarLeida(id) {
        try {
            console.log(`📡 Marcando notificación ${id} como leída...`);
            
            const response = await fetch(`${API_BASE}/notificaciones/${id}/marcar-leida`, {
                method: 'PUT',
                headers: this.getHeaders()
            });

            const data = await this.handleError(response, 'marcarLeida');
            console.log(`✅ Notificación ${id} marcada como leída:`, data);
            
            this.clearRelatedCache();
            
            return data;
        } catch (error) {
            console.error(`❌ Error marcando notificación ${id} como leída:`, error);
            return { 
                success: false,
                error: error.message 
            };
        }
    }

    async marcarTodasLeidas() {
        const userId = this.getCurrentUserId();
        
        try {
            console.log(`📡 Marcando todas las notificaciones como leídas para usuario ${userId}...`);
            
            const response = await fetch(`${API_BASE}/notificaciones/marcar-todas-leidas/${userId}`, {
                method: 'PUT',
                headers: this.getHeaders()
            });

            const data = await this.handleError(response, 'marcarTodasLeidas');
            console.log(`✅ Todas las notificaciones marcadas como leídas para usuario ${userId}:`, data);
            
            this.clearCache();
            
            return data;
        } catch (error) {
            console.error(`❌ Error marcando todas como leídas para usuario ${userId}:`, error);
            return { 
                success: false,
                error: error.message 
            };
        }
    }

    async testConexion() {
        try {
            console.log('🔍 Testeando conexión con API...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${API_BASE}/notificaciones/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }, // Sin auth para health check
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const data = await this.handleError(response, 'testConexion');
            console.log('✅ Test de conexión exitoso:', data);
            
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('❌ Timeout en test de conexión');
                return { 
                    success: false,
                    error: 'Timeout de conexión' 
                };
            }
            
            console.error('❌ Error en test de conexión:', error);
            return { 
                success: false,
                error: error.message 
            };
        }
    }

    // ✅ NUEVO: Método para crear notificaciones (si lo necesitas)
    async crearNotificacion(opciones) {
        try {
            console.log('📡 Creando notificación:', opciones);
            
            const response = await fetch(`${API_BASE}/notificaciones/crear`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(opciones)
            });

            const data = await this.handleError(response, 'crearNotificacion');
            console.log('✅ Notificación creada:', data);
            
            this.clearCache(); // Limpiar cache para reflejar nueva notificación
            
            return data;
        } catch (error) {
            console.error('❌ Error creando notificación:', error);
            return { 
                success: false,
                error: error.message 
            };
        }
    }

    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache de notificaciones limpiado');
    }

    clearRelatedCache() {
        const userId = this.getCurrentUserId();
        for (const key of this.cache.keys()) {
            if (key.startsWith(`notificaciones_${userId}_`)) {
                this.cache.delete(key);
            }
        }
    }

    formatearTiempoRelativo(fecha) {
        const ahora = new Date();
        const fechaNotif = new Date(fecha);
        const difMinutos = Math.floor((ahora - fechaNotif) / (1000 * 60));

        if (difMinutos < 1) return 'Ahora';
        if (difMinutos < 60) return `${difMinutos}m`;
        if (difMinutos < 1440) return `${Math.floor(difMinutos / 60)}h`;
        return `${Math.floor(difMinutos / 1440)}d`;
    }

    obtenerIconoPorTipo(tipo) {
        const iconos = {
            seguimiento_vencido: '⏰',
            seguimiento_urgente: '🚨',
            seguimiento_critico: '🚨',
            oportunidad_alto_valor: '💰',
            nuevo_prospecto: '👤',
            prospecto_reasignado: '🔄',
            marketing: '📢',
            sistema: '⚙️',
            recordatorio: '📝',
            manual: '📝'
        };
        return iconos[tipo] || '🔔';
    }

    obtenerColorPorPrioridad(prioridad) {
        const colores = {
            critica: 'text-red-600',
            alta: 'text-orange-600',
            media: 'text-yellow-600',
            baja: 'text-blue-600',
            normal: 'text-gray-600'
        };
        return colores[prioridad] || colores.normal;
    }
}

export default new NotificacionesService();