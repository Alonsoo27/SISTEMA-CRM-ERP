// ============================================
// CACHE SERVICE - SISTEMA EMPRESARIAL
// Redis Cache Inteligente para Módulo Prospectos
// Mejora Performance 10x - Invalidación Automática
// ============================================

const redis = require('redis');

class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.hasLoggedError = false;

        // Configuración de TTL por tipo de data
        this.ttlConfig = {
            dashboard_metricas: 300,      // 5 minutos
            kanban_data: 180,             // 3 minutos
            prospectos_list: 120,         // 2 minutos
            seguimientos: 60,             // 1 minuto
            filtros_rapidos: 600,         // 10 minutos
            productos_autocomplete: 1800, // 30 minutos
            usuarios_asesores: 3600       // 1 hora
        };
    }

    /**
     * Inicializar conexión Redis
     */
    async inicializar() {
        // NO intentar conectar si no hay REDIS_HOST configurado
        if (!process.env.REDIS_HOST) {
            if (!this.hasLoggedError) {
                console.log('📦 Redis no configurado - Sistema funcionando sin cache');
                this.hasLoggedError = true;
            }
            this.isConnected = false;
            return false;
        }

        // Ya se intentó conectar antes y falló
        if (this.retryAttempts >= this.maxRetries) {
            return false;
        }

        try {
            // Configuración Redis
            const redisConfig = {
                socket: {
                    host: process.env.REDIS_HOST,
                    port: process.env.REDIS_PORT || 6379,
                    connectTimeout: 5000,
                    lazyConnect: true
                },
                password: process.env.REDIS_PASSWORD || undefined,
                database: process.env.REDIS_DB || 0
            };

            this.client = redis.createClient(redisConfig);

            // Event handlers - SIN REINTENTOS AUTOMÁTICOS
            this.client.on('connect', () => {
                console.log('🔥 Redis Cache: Conectado exitosamente');
                this.isConnected = true;
                this.retryAttempts = 0;
            });

            this.client.on('error', (error) => {
                this.isConnected = false;
                // NO hacer reintentos automáticos
            });

            this.client.on('ready', () => {
                console.log('✅ Redis Cache: Listo para operaciones');
            });

            // Conectar
            await this.client.connect();

            return true;
        } catch (error) {
            this.retryAttempts++;

            if (!this.hasLoggedError) {
                console.log('📦 Redis no disponible - Sistema funcionando sin cache');
                this.hasLoggedError = true;
            }

            this.isConnected = false;
            return false;
        }
    }

    /**
     * Verificar si Redis está disponible
     */
    isAvailable() {
        return this.isConnected && this.client && this.client.isReady;
    }

    /**
     * Generar clave de cache consistente
     */
    generarClave(tipo, identificador, parametros = {}) {
        const base = `prospectos:${tipo}:${identificador}`;

        if (Object.keys(parametros).length === 0) {
            return base;
        }

        // Ordenar parámetros para consistencia
        const paramsOrdenados = Object.keys(parametros)
            .sort()
            .map(key => `${key}:${parametros[key]}`)
            .join('|');

        return `${base}:${paramsOrdenados}`;
    }

    /**
     * Obtener datos del cache
     */
    async obtener(tipo, identificador, parametros = {}) {
        if (!this.isAvailable()) {
            return null;
        }

        try {
            const clave = this.generarClave(tipo, identificador, parametros);
            const data = await this.client.get(clave);

            if (data) {
                console.log(`🎯 Cache HIT: ${clave}`);
                return JSON.parse(data);
            }

            console.log(`❌ Cache MISS: ${clave}`);
            return null;
        } catch (error) {
            console.error('Error obteniendo cache:', error.message);
            return null;
        }
    }

    /**
     * Guardar datos en cache
     */
    async guardar(tipo, identificador, datos, parametros = {}, ttlPersonalizado = null) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            const clave = this.generarClave(tipo, identificador, parametros);
            const ttl = ttlPersonalizado || this.ttlConfig[tipo] || 300;

            await this.client.setEx(clave, ttl, JSON.stringify(datos));
            console.log(`💾 Cache SAVE: ${clave} (TTL: ${ttl}s)`);

            return true;
        } catch (error) {
            console.error('Error guardando cache:', error.message);
            return false;
        }
    }

    /**
     * Invalidar cache específico
     */
    async invalidar(tipo, identificador = '*', parametros = {}) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            let patron;

            if (identificador === '*') {
                patron = `prospectos:${tipo}:*`;
            } else if (Object.keys(parametros).length === 0) {
                patron = `prospectos:${tipo}:${identificador}*`;
            } else {
                const clave = this.generarClave(tipo, identificador, parametros);
                patron = clave;
            }

            const claves = await this.client.keys(patron);

            if (claves.length > 0) {
                await this.client.del(claves);
                console.log(`🗑️  Cache INVALIDADO: ${patron} (${claves.length} claves)`);
            }

            return true;
        } catch (error) {
            console.error('Error invalidando cache:', error.message);
            return false;
        }
    }

    /**
     * Invalidar cache por asesor (cuando actualiza sus prospectos)
     */
    async invalidarPorAsesor(asesorId) {
        if (!this.isAvailable()) return false;

        try {
            // Invalidar todos los caches relacionados con este asesor
            await Promise.all([
                this.invalidar('dashboard_metricas', asesorId),
                this.invalidar('kanban_data', asesorId),
                this.invalidar('prospectos_list', asesorId),
                this.invalidar('seguimientos', asesorId)
            ]);

            console.log(`🔄 Cache invalidado completamente para asesor: ${asesorId}`);
            return true;
        } catch (error) {
            console.error('Error invalidando cache por asesor:', error.message);
            return false;
        }
    }

    /**
     * Invalidar cache global (cuando hay cambios estructurales)
     */
    async invalidarGlobal() {
        if (!this.isAvailable()) return false;

        try {
            const claves = await this.client.keys('prospectos:*');

            if (claves.length > 0) {
                await this.client.del(claves);
                console.log(`🌍 Cache GLOBAL invalidado: ${claves.length} claves`);
            }

            return true;
        } catch (error) {
            console.error('Error invalidando cache global:', error.message);
            return false;
        }
    }

    /**
     * Obtener estadísticas del cache
     */
    async obtenerEstadisticas() {
        if (!this.isAvailable()) {
            return { estado: 'desconectado' };
        }

        try {
            const info = await this.client.info('memory');
            const claves = await this.client.keys('prospectos:*');

            // Agrupar claves por tipo
            const tipoContadores = {};
            claves.forEach(clave => {
                const tipo = clave.split(':')[1];
                tipoContadores[tipo] = (tipoContadores[tipo] || 0) + 1;
            });

            return {
                estado: 'conectado',
                total_claves: claves.length,
                tipos: tipoContadores,
                memoria: info,
                uptime: await this.client.info('server')
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas cache:', error.message);
            return { estado: 'error', error: error.message };
        }
    }

    /**
     * Wrapper para operaciones con cache automático
     */
    async conCache(tipo, identificador, funcionDatos, parametros = {}, ttlPersonalizado = null) {
        // Intentar obtener del cache primero
        const datosCache = await this.obtener(tipo, identificador, parametros);

        if (datosCache) {
            return datosCache;
        }

        // Si no está en cache, ejecutar función y guardar resultado
        try {
            const datos = await funcionDatos();

            if (datos) {
                await this.guardar(tipo, identificador, datos, parametros, ttlPersonalizado);
            }

            return datos;
        } catch (error) {
            console.error('Error en operación con cache:', error.message);
            throw error;
        }
    }

    /**
     * Cerrar conexión Redis
     */
    async cerrar() {
        if (this.client) {
            await this.client.quit();
            console.log('🔌 Redis Cache: Conexión cerrada');
        }
    }

    /**
     * Health Check del servicio
     */
    async healthCheck() {
        if (!this.isAvailable()) {
            return {
                status: 'error',
                message: 'Redis no disponible',
                timestamp: new Date().toISOString()
            };
        }

        try {
            const start = Date.now();
            await this.client.ping();
            const latencia = Date.now() - start;

            return {
                status: 'ok',
                latencia: `${latencia}ms`,
                conexion: 'activa',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Crear instancia singleton
const cacheService = new CacheService();

// Solo inicializar automáticamente si REDIS_HOST está configurado
// (No forzar conexión en producción si no hay Redis disponible)
if (process.env.REDIS_HOST) {
    cacheService.inicializar().catch(() => {
        // Fallar silenciosamente, el log ya se mostró en inicializar()
    });
}

module.exports = cacheService;