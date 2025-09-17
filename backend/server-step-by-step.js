require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARE BÁSICO
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

console.log('🔍 Iniciando carga de módulos...');

// ⚠️  PASO 1: USAR EL MÓDULO QUE SABEMOS QUE FUNCIONA
try {
    const prospectosRoutes = require('./src/modules/prospectos/routes/prospectosRoutes-ultra-minimal');
    app.use('/api/prospectos', prospectosRoutes);
    console.log('✅ Rutas de prospectos registradas en /api/prospectos');
} catch (error) {
    console.error('❌ ERROR cargando prospectos:', error.message);
}

console.log('🔄 PASO 1 COMPLETADO - Módulo ultra mínimo cargado');

// ⚠️  PASO 2: AGREGAR SISTEMA DE MÓDULOS BÁSICO
const modules = {
    prospectos: { path: './src/modules/prospectos/routes/prospectosRoutes-ultra-minimal', route: '/api/prospectos', loaded: true }
};

const getModuleStatus = () => {
    return {
        status: { prospectos: 'Funcionando ✅' },
        endpoints: { prospectos: '/api/prospectos' }
    };
};

console.log('🔄 PASO 2 COMPLETADO - Sistema de módulos básico');

// ⚠️  PASO 3: AGREGAR RUTAS BÁSICAS
app.get('/', (req, res) => {
    const { status, endpoints } = getModuleStatus();
    
    res.json({
        message: 'Sistema CRM/ERP Empresarial V2.0',
        status: 'Funcionando',
        timestamp: new Date().toISOString(),
        endpoints: {
            ...endpoints,
            health: '/api/health'
        },
        modules: status
    });
});

app.get('/api/health', (req, res) => {
    const { status } = getModuleStatus();
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        modules: status
    });
});

console.log('🔄 PASO 3 COMPLETADO - Rutas básicas agregadas');

// ⚠️  PASO 4: AGREGAR UNA RUTA ADMINISTRATIVA SIMPLE
app.get('/api/admin/test', (req, res) => {
    res.json({
        success: true,
        message: 'Ruta administrativa de prueba',
        timestamp: new Date().toISOString()
    });
});

console.log('🔄 PASO 4 COMPLETADO - Ruta admin simple agregada');

// ⚠️  PASO 5: MIDDLEWARES DE ERROR
app.use((err, req, res, next) => {
    console.error('💥 Error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: err.message
    });
});

console.log('🔄 PASO 5 COMPLETADO - Middleware de errores');

// ⚠️  PASO 6: CATCH-ALL CORREGIDO
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado',
        requested_path: req.originalUrl
    });
});

console.log('🔄 PASO 6 COMPLETADO - Catch-all agregado');

// INICIALIZAR SERVIDOR
console.log('🔄 INICIANDO SERVIDOR...');

app.listen(PORT, () => {
    console.log(`\n🚀 ====== SERVIDOR PASO A PASO INICIADO ====== 🚀`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`\n📋 PASOS COMPLETADOS:`);
    console.log(`   ✅ PASO 1: Módulo ultra mínimo`);
    console.log(`   ✅ PASO 2: Sistema de módulos básico`);
    console.log(`   ✅ PASO 3: Rutas básicas`);
    console.log(`   ✅ PASO 4: Ruta admin simple`);
    console.log(`   ✅ PASO 5: Middleware de errores`);
    console.log(`   ✅ PASO 6: Catch-all`);
    console.log(`\n🎯 Servidor paso a paso funcionando`);
});

console.log('✅ app.listen() ejecutado');