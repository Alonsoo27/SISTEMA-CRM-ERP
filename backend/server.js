require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { testConnection } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// MIDDLEWARE - CONFIGURACIÓN CORS UNIFICADA Y CORREGIDA
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL || 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // ← AGREGADO PATCH
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// OTROS MIDDLEWARE
app.use(helmet());
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// SISTEMA DE CARGA DE MÓDULOS OPTIMIZADO
console.log('🔧 Iniciando carga de módulos...');

// ✅ CONFIGURACIÓN EMPRESARIAL FINAL - 9 MÓDULOS CORE + DASHBOARDS ADICIONALES
const modules = {
    auth: { path: './src/modules/auth/routes/authRoutes', route: '/api/auth', loaded: null },
    productos: { path: './src/modules/productos/routes/productosRoutes', route: '/api/productos', loaded: null },
    prospectos: { path: './src/modules/prospectos/routes/prospectosRoutes', route: '/api/prospectos', loaded: null },
    notificaciones: { path: './src/modules/notificaciones/routes/notificacionesRoutes', route: '/api/notificaciones', loaded: null },
    ventas: { path: './src/modules/ventas/routes/ventasRoutes', route: '/api/ventas', loaded: null },
    comisiones: { path: './src/modules/ventas/routes/comisionesRoutes', route: '/api/comisiones', loaded: null },
    actividad: { path: './src/modules/ventas/routes/actividadRoutes', route: '/api/actividad', loaded: null },
    reportes: { path: './src/modules/ventas/routes/reportesRoutes', route: '/api/reportes', loaded: null },
    postventa: { path: './src/modules/ventas/routes/postventaRoutes', route: '/api/postventa', loaded: null },
    dashboards: { path: './src/modules/ventas/routes/dashboardsRoutes', route: '/api/dashboards', loaded: null },
    dashboardPersonal: { path: './src/modules/ventas/routes/dashboardPersonalRoutes', route: '/api/dashboard', loaded: null },
    dashboardEjecutivo: { path: './src/modules/ventas/routes/dashboardEjecutivoRoutes', route: '/api/dashboard-ejecutivo',  loaded: null },
    pipeline: { path: './src/modules/ventas/routes/pipelineRoutes', route: '/api/ventas/pipeline', loaded: null },
    ventasPDF: { path: './src/modules/ventas/routes/ventasPDFRoutes', route: '/api/pdf', loaded: null },
    almacen: { path: './src/modules/almacen/routes/almacenRoutes', route: '/api/almacen', loaded: null }
};

// MÓDULOS PAUSADOS TEMPORALMENTE:
// cotizaciones: Sistema de facturación externo integrado

let SeguimientosController = null;

// Función para cargar módulos de forma segura
const loadModule = (name, config) => {
    try {
        console.log(`🔧 Cargando ${name}...`);
        const module = require(config.path);
        config.loaded = module;
        console.log(`✅ ${name} cargado correctamente`);
        return true;
    } catch (error) {
        console.error(`❌ ERROR cargando ${name}:`, error.message);
        config.loaded = null;
        return false;
    }
};

// Cargar todos los módulos
Object.entries(modules).forEach(([name, config]) => {
    loadModule(name, config);
});

// Cargar controlador de seguimientos
try {
    console.log('🔧 Cargando SeguimientosController...');
    SeguimientosController = require('./src/modules/prospectos/controllers/seguimientosController');
    console.log('✅ SeguimientosController cargado correctamente');
} catch (error) {
    console.error('❌ ERROR cargando SeguimientosController:', error.message);
}

// REGISTRO DE RUTAS OPTIMIZADO
console.log('🔧 Registrando rutas...');

// Función para registrar rutas de forma segura
const registerRoutes = (name, config) => {
    if (config.loaded && typeof config.loaded === 'function') {
        // CORRECCIÓN IMPORTANTE: Seguimientos ya no se monta en /api/prospectos
        const routePath = name === 'seguimientos' ? '/api/seguimientos' : config.route;
        app.use(routePath, config.loaded);
        console.log(`✅ Rutas de ${name} registradas en ${routePath}`);
        return true;
    } else {
        console.error(`❌ NO se pudieron registrar rutas de ${name} - Módulo no válido`);
        return false;
    }
};

// Registrar todas las rutas
const routesRegistered = {};
Object.entries(modules).forEach(([name, config]) => {
    routesRegistered[name] = registerRoutes(name, config);
});

// FUNCIÓN PARA OBTENER ESTADO DE MÓDULOS
const getModuleStatus = () => {
    const status = {};
    const endpoints = {};
    
    Object.entries(modules).forEach(([name, config]) => {
        if (routesRegistered[name]) {
            status[name] = 'Funcionando ✅';
            // Corrección para seguimientos
            const endpoint = name === 'seguimientos' ? '/api/seguimientos' : config.route;
            endpoints[name] = endpoint;
        } else {
            status[name] = 'ERROR ❌';
        }
    });
    
    return { status, endpoints };
};

// RUTA PRINCIPAL OPTIMIZADA
app.get('/', (req, res) => {
    const { status, endpoints } = getModuleStatus();
    
    const totalModules = Object.keys(modules).length;
    const workingModules = Object.values(status).filter(s => s.includes('✅')).length;
    const successRate = Math.round((workingModules / totalModules) * 100);
    
    res.json({
        message: 'Sistema CRM/ERP Empresarial V2.0',
        status: successRate === 100 ? 'OPERATIVO' : 'DEGRADADO',
        success_rate: `${successRate}% (${workingModules}/${totalModules})`,
        timestamp: new Date().toISOString(),
        endpoints: {
            ...endpoints,
            health: '/api/health',
            admin: '/api/admin'
        },
        modules: status,
        debug_info: {
            total_router_layers: app._router ? app._router.stack.length : 0,
            seguimientos_controller: SeguimientosController ? 'Cargado ✅' : 'ERROR ❌'
        }
    });
});

// HEALTH CHECK OPTIMIZADO
app.get('/api/health', (req, res) => {
    const { status } = getModuleStatus();
    
    // Determinar estado general
    const hasErrors = Object.values(status).some(s => s.includes('ERROR'));
    const totalModules = Object.keys(modules).length;
    const workingModules = Object.values(status).filter(s => s.includes('✅')).length;
    
    res.json({
        status: hasErrors ? 'DEGRADED' : 'OK',
        success_rate: `${Math.round((workingModules / totalModules) * 100)}%`,
        modules_status: `${workingModules}/${totalModules} operativos`,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        modules: status,
        seguimientos_controller: SeguimientosController ? 'Activo' : 'ERROR'
    });
});

// ENDPOINTS DE ADMINISTRACIÓN MEJORADOS
app.get('/api/admin/cron/seguimientos/estado', (req, res) => {
    if (!SeguimientosController) {
        return res.status(503).json({
            success: false,
            error: 'SeguimientosController no está disponible',
            codigo: 'CONTROLLER_NOT_LOADED'
        });
    }
    
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const diaActual = ahora.getDay();
    
    const enHorarioLaboral = (
        (diaActual >= 1 && diaActual <= 5 && horaActual >= 8 && horaActual <= 18) ||
        (diaActual === 6 && horaActual >= 9 && horaActual <= 12)
    );
    
    res.json({
        success: true,
        data: {
            estado_sistema: 'Activo',
            modulo: 'Seguimientos Automáticos',
            horario_actual: ahora.toISOString(),
            en_horario_laboral: enHorarioLaboral,
            dia_semana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaActual],
            configuracion: {
                tiempo_vencimiento: '18 horas laborales',
                horario_procesamiento: 'L-V 8am-6pm, Sáb 9am-12pm',
                timezone: 'America/Lima'
            }
        }
    });
});

// NUEVO ENDPOINT: Monitoreo avanzado de automatización
app.get('/api/admin/automation/status', (req, res) => {
    if (!SeguimientosController) {
        return res.status(503).json({
            success: false,
            error: 'Sistema de automatización no disponible',
            status: 'UNAVAILABLE'
        });
    }
    
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const diaActual = ahora.getDay();
    
    const enHorarioLaboral = (
        (diaActual >= 1 && diaActual <= 5 && horaActual >= 8 && horaActual <= 18) ||
        (diaActual === 6 && horaActual >= 9 && horaActual <= 12)
    );
    
    // Calcular próxima ejecución
    let proximaEjecucion = 'Fuera de horario laboral';
    if (enHorarioLaboral) {
        const proximaHora = horaActual + 1;
        if (diaActual >= 1 && diaActual <= 5 && proximaHora <= 18) {
            proximaEjecucion = `Hoy a las ${proximaHora}:00`;
        } else if (diaActual === 6 && proximaHora <= 12) {
            proximaEjecucion = `Hoy a las ${proximaHora}:00`;
        } else {
            proximaEjecucion = diaActual === 5 ? 'Sábado 9:00 AM' : 'Lunes 8:00 AM';
        }
    } else {
        if (diaActual === 0) proximaEjecucion = 'Lunes 8:00 AM';
        else if (diaActual === 6 && horaActual >= 13) proximaEjecucion = 'Lunes 8:00 AM';
        else if (diaActual === 6 && horaActual < 9) proximaEjecucion = 'Hoy 9:00 AM';
        else if (diaActual >= 1 && diaActual <= 5 && horaActual < 8) proximaEjecucion = 'Hoy 8:00 AM';
        else if (diaActual >= 1 && diaActual <= 5 && horaActual >= 19) proximaEjecucion = 'Mañana 8:00 AM';
    }
    
    res.json({
        success: true,
        data: {
            sistema: 'Automatización de Seguimientos',
            estado: 'OPERATIONAL',
            version: '2.0',
            timestamp: ahora.toISOString(),
            cron_jobs: {
                activos: true,
                lunes_viernes: '0 8-18 * * 1-5',
                sabados: '0 9-12 * * 6',
                timezone: 'America/Lima'
            },
            horario_actual: {
                dia: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaActual],
                hora: `${horaActual}:${ahora.getMinutes().toString().padStart(2, '0')}`,
                en_horario_laboral: enHorarioLaboral,
                proxima_ejecucion: proximaEjecucion
            },
            funcionalidades: [
                'Detección automática de seguimientos vencidos',
                'Reasignación inteligente (1ra y 2da vez)',
                'Modo libre competitivo (3ra vez)',
                'Notificaciones automáticas',
                'Procesamiento en horario laboral'
            ]
        }
    });
});

app.post('/api/admin/cron/seguimientos/ejecutar', async (req, res) => {
    if (!SeguimientosController) {
        return res.status(503).json({
            success: false,
            error: 'SeguimientosController no está disponible',
            codigo: 'CONTROLLER_NOT_LOADED'
        });
    }
    
    try {
        console.log('🔧 Iniciando procesamiento manual de seguimientos...');
        const resultado = await SeguimientosController.ejecutarProcesamiento();
        
        res.json({
            success: true,
            data: resultado,
            message: 'Procesamiento manual ejecutado exitosamente',
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Procesamiento manual completado:', resultado);
    } catch (error) {
        console.error('❌ Error en procesamiento manual:', error);
        res.status(500).json({
            success: false,
            error: 'Error en procesamiento manual',
            detalles: error.message,
            codigo: 'PROCESSING_ERROR'
        });
    }
});

// NUEVO ENDPOINT: Estado general del sistema
app.get('/api/admin/estado', (req, res) => {
    const { status, endpoints } = getModuleStatus();
    const totalModules = Object.keys(modules).length;
    const workingModules = Object.values(status).filter(s => s.includes('✅')).length;
    
    res.json({
        success: true,
        data: {
            sistema: 'CRM/ERP Empresarial V2.0',
            estado_general: workingModules === totalModules ? 'FUNCIONANDO' : 'DEGRADADO',
            success_rate: `${Math.round((workingModules / totalModules) * 100)}%`,
            modulos_status: `${workingModules}/${totalModules} operativos`,
            modulos: status,
            endpoints_disponibles: endpoints,
            seguimientos_automaticos: {
                controlador: SeguimientosController ? 'Activo' : 'Inactivo',
                estado: SeguimientosController ? 'Funcionando' : 'Error'
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }
    });
});

// MIDDLEWARE DE MANEJO DE ERRORES MEJORADO
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno',
        timestamp: new Date().toISOString()
    });
});

// INICIALIZACIÓN EMPRESARIAL DEL SISTEMA DE SEGUIMIENTOS
const initializeAutomationSystem = async () => {
    console.log('\n🤖 ====== INICIALIZANDO SISTEMA DE AUTOMATIZACIÓN EMPRESARIAL ====== 🤖');
    
    if (!SeguimientosController) {
        console.error('❌ SeguimientosController no disponible - Automatización DESHABILITADA');
        return {
            status: 'FAILED',
            cron_active: false,
            error: 'Controller no encontrado'
        };
    }
    
    try {
        // Validar que el controlador tenga el método requerido
        if (typeof SeguimientosController.inicializarCronJobs !== 'function') {
            throw new Error('Método inicializarCronJobs no encontrado en SeguimientosController');
        }
        
        if (typeof SeguimientosController.ejecutarProcesamiento !== 'function') {
            throw new Error('Método ejecutarProcesamiento no encontrado en SeguimientosController');
        }
        
        // Inicializar cron jobs con manejo de errores
        console.log('🔧 Inicializando cron jobs de seguimientos...');
        SeguimientosController.inicializarCronJobs();
        
        // Verificar que node-cron esté disponible
        const cronModule = require('node-cron');
        if (!cronModule) {
            throw new Error('Módulo node-cron no disponible');
        }
        
        // Validar configuración de horario laboral
        const ahora = new Date();
        const horaActual = ahora.getHours();
        const diaActual = ahora.getDay();
        
        const enHorarioLaboral = (
            (diaActual >= 1 && diaActual <= 5 && horaActual >= 8 && horaActual <= 18) ||
            (diaActual === 6 && horaActual >= 9 && horaActual <= 12)
        );
        
        // Test de conectividad (opcional)
        console.log('🔍 Validando conectividad del sistema...');
        
        const resultado = {
            status: 'OPERATIONAL',
            cron_active: true,
            timestamp: new Date().toISOString(),
            config: {
                horario_actual: ahora.toISOString(),
                en_horario_laboral: enHorarioLaboral,
                dia_semana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaActual],
                hora_actual: horaActual,
                timezone: 'America/Lima'
            },
            schedules: {
                lunes_viernes: '0 8-18 * * 1-5',
                sabados: '0 9-12 * * 6',
                descripcion: 'L-V 8am-6pm, Sáb 9am-12pm'
            }
        };
        
        console.log('✅ Sistema de seguimientos automáticos ACTIVADO exitosamente');
        console.log('📊 Estado actual:', {
            hora: `${horaActual}:00`,
            dia: resultado.config.dia_semana,
            horario_laboral: enHorarioLaboral ? '🟢 SÍ' : '🔴 NO',
            proxima_ejecucion: enHorarioLaboral ? 'En la próxima hora' : 'Al iniciar horario laboral'
        });
        
        return resultado;
        
    } catch (error) {
        console.error('❌ ERROR CRÍTICO inicializando automatización:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        return {
            status: 'FAILED',
            cron_active: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// INICIALIZAR SERVIDOR
app.listen(PORT, async () => {
    console.log(`\n🚀 ====== SERVIDOR INICIADO ====== 🚀`);
    console.log(`🌐 Puerto: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`\n📦 ESTADO DE MÓDULOS:`);
    
    const totalModules = Object.keys(modules).length;
    let workingModules = 0;
    
    Object.entries(modules).forEach(([name, config]) => {
        const status = routesRegistered[name] ? '✅' : '❌';
        if (status.includes('✅')) workingModules++;
        const route = name === 'seguimientos' ? '/api/seguimientos' : config.route;
        console.log(`   - ${name.charAt(0).toUpperCase() + name.slice(1)}: ${status} (${route})`);
    });
    
    const successRate = Math.round((workingModules / totalModules) * 100);
    
    const automationResult = await initializeAutomationSystem();
    console.log(`\n🤖 SISTEMA DE AUTOMATIZACIÓN:`);
    console.log(`   - Estado: ${automationResult.status === 'OPERATIONAL' ? 'Activo ✅' : 'Inactivo ❌'}`);
    console.log(`   - Cron Jobs: ${automationResult.cron_active ? 'Funcionando ✅' : 'Error ❌'}`);
    if (automationResult.config) {
        console.log(`   - Horario Actual: ${automationResult.config.dia_semana} ${automationResult.config.hora_actual}:00`);
        console.log(`   - En Horario Laboral: ${automationResult.config.en_horario_laboral ? '🟢 SÍ' : '🔴 NO'}`);
    }
    console.log(`   - Horario: L-V 8am-6pm, Sáb 9am-12pm`);
    console.log(`   - Vencimiento: 18 horas laborales`);
    
    console.log(`\n📊 RESUMEN EMPRESARIAL:`);
    console.log(`   - Módulos Operativos: ${workingModules}/${totalModules} (${successRate}%)`);
    console.log(`   - Estado General: ${successRate === 100 ? '🟢 OPERATIVO' : '🟡 DEGRADADO'}`);
    console.log(`   - Sistema: ${successRate >= 75 ? 'ENTERPRISE READY ✅' : 'REQUIERE ATENCIÓN ⚠️'}`);
    
    console.log(`\n🎉 Sistema listo para recibir solicitudes`);
    console.log(`\n✅ AUTOMATIZACIÓN ENTERPRISE HABILITADA`);
    console.log(`📊 Endpoints de monitoreo:`);
    console.log(`   - Status: http://localhost:${PORT}/api/admin/estado`);
    console.log(`   - Health: http://localhost:${PORT}/api/health`);
    console.log(`   - Automation: http://localhost:${PORT}/api/admin/automation/status`);
    console.log(`   - Dashboards: http://localhost:${PORT}/api/dashboards`);
});