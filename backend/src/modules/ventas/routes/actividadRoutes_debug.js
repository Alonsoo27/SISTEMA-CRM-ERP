// DEBUG STEP 3 - AÑADIR MIDDLEWARE DE VALIDACIÓN
const express = require('express');
const router = express.Router();

// Imports
const ActividadDiariaController = require('../controllers/ActividadDiariaController');
const ActividadDiariaService = require('../services/ActividadDiariaService');
const ActividadDiariaModel = require('../models/ActividadDiariaModel');

const { 
    requireSalesAccess, 
    requireManager, 
    requireOwnershipOrRole 
} = require('../../../middleware/roleMiddleware');

// ===== MIDDLEWARE DE VALIDACIÓN (COPIADO DEL ORIGINAL) =====
const validateCheckInData = (req, res, next) => {
    try {
        const validation = ActividadDiariaModel.validateCheckIn(req.body);
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en check-in',
                errores: validation.errors,
                advertencias: validation.warnings
            });
        }

        req.validatedData = validation.sanitizedData;
        req.businessInsights = validation.businessInsights;
        
        if (validation.warnings && validation.warnings.length > 0) {
            req.validationWarnings = validation.warnings;
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error en validación de check-in',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const logActivityEndpoint = (endpoint) => {
    return (req, res, next) => {
        console.log(`\n🔔 ACTIVIDAD API: ${endpoint}`);
        console.log('User:', req.user?.nombre || 'Unknown', `(ID: ${req.user?.id})`);
        console.log('IP:', req.ip);
        console.log('Timestamp:', new Date().toISOString());
        console.log('================================\n');
        next();
    };
};

// ===== RUTAS CON MIDDLEWARE COMPLEJO =====
router.post('/check-in', 
    requireSalesAccess,
    logActivityEndpoint('CHECK-IN'),
    validateCheckInData,
    (req, res) => {
        res.json({ success: true, message: 'Check-in con middleware completo funciona' });
    }
);

router.get('/estado-hoy',
    requireSalesAccess,
    logActivityEndpoint('ESTADO-HOY'),
    (req, res) => {
        res.json({ success: true, message: 'Estado hoy funciona' });
    }
);

router.get('/validar-checkin',
    requireSalesAccess,
    logActivityEndpoint('VALIDAR-CHECKIN'),
    async (req, res) => {
        res.json({ success: true, message: 'Validar checkin funciona' });
    }
);

console.log('✅ ActividadRoutes DEBUG STEP 3 - Con middleware de validación');
// Middleware 404 - VERSIÓN CORREGIDA
router.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Endpoint no encontrado: ${req.method} ${req.originalUrl}`,
        endpoints_disponibles: '/api/actividad/info'
    });
});

// Middleware global de manejo de errores (este estaba bien)
router.use((error, req, res, next) => {
    console.error('❌ Error en actividad routes:', error);
    
    res.status(500).json({
        success: false,
        message: 'Error interno en API de actividad diaria',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
});
module.exports = router;