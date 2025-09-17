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

// CARGA DEL MÓDULO ULTRA MÍNIMO (FUNCIONA)
try {
    const prospectosRoutes = require('./src/modules/prospectos/routes/prospectosRoutes-ultra-minimal');
    app.use('/api/prospectos', prospectosRoutes);
    console.log('✅ Rutas de prospectos registradas en /api/prospectos');
} catch (error) {
    console.error('❌ ERROR cargando prospectos:', error.message);
}

// AGREGAR FUNCIONES UNA POR UNA PARA ENCONTRAR EL CULPABLE

// FUNCIÓN 1: getModuleStatus (SIMPLE)
const getModuleStatus = () => {
    return {
        status: { prospectos: 'Funcionando ✅' },
        endpoints: { prospectos: '/api/prospectos' }
    };
};

console.log('✅ getModuleStatus definida');

// FUNCIÓN 2: RUTA PRINCIPAL (PRIMERA RUTA DESPUÉS DE PROSPECTOS)
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

console.log('✅ Ruta principal / definida');

// FUNCIÓN 3: HEALTH CHECK (SEGUNDA RUTA)
app.get('/api/health', (req, res) => {
    const { status } = getModuleStatus();
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        modules: status
    });
});

console.log('✅ Ruta /api/health definida');

// AQUÍ ES DONDE DEBE ESTAR EL PROBLEMA
// Vamos a parar aquí y probar

// MIDDLEWARE DE ERRORES BÁSICO
app.use((err, req, res, next) => {
    console.error('💥 Error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: err.message
    });
});

// RUTA 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado',
        requested_path: req.originalUrl
    });
});

// INICIALIZAR SERVIDOR
app.listen(PORT, () => {
    console.log(`\n🚀 ====== SERVIDOR GRADUAL INICIADO ====== 🚀`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`\n📋 RUTAS CARGADAS:`);
    console.log(`   - GET /`);
    console.log(`   - GET /api/health`); 
    console.log(`   - GET /api/prospectos/*`);
    console.log(`\n🎯 Sistema gradual listo - PASO 1`);
});