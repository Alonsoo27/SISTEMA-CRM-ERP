// ============================================
// VENTAS PDF ROUTES - RUTAS DE EXPORTACIÓN PDF
// Sistema CRM/ERP v2.0 - Rutas para generación de PDFs
// ============================================

const express = require('express');
const router = express.Router();

// Controllers
const VentasPDFController = require('../controllers/VentasPDFController');

// Middleware - ajusta según tu configuración existente
// const authMiddleware = require('../middleware/authMiddleware');

// ============================================
// RUTAS DE EXPORTACIÓN PDF
// ============================================

/**
 * @route   POST /api/ventas/exportar-pdf
 * @desc    Exportar detalle de venta a PDF
 * @access  Private
 * @body    { venta: Object, productos: Array }
 */
router.post('/exportar-pdf', 
    // authMiddleware, // Descomenta si tienes autenticación
    VentasPDFController.exportarVentaDetalle
);

/**
 * @route   POST /api/ventas/exportar-reporte-pdf
 * @desc    Exportar reporte de ventas a PDF
 * @access  Private
 * @body    { filtros: Object }
 */
router.post('/exportar-reporte-pdf', 
    // authMiddleware, // Descomenta si tienes autenticación
    VentasPDFController.exportarReporteVentas
);

/**
 * @route   GET /api/ventas/pdf-service-status
 * @desc    Verificar estado del servicio PDF
 * @access  Private
 */
router.get('/pdf-service-status', 
    // authMiddleware, // Descomenta si tienes autenticación
    VentasPDFController.verificarServicio
);

// ============================================
// RUTAS ADICIONALES (para futuras funcionalidades)
// ============================================

/**
 * @route   POST /api/ventas/:id/exportar-pdf
 * @desc    Exportar venta específica por ID
 * @access  Private
 */
router.post('/:id/exportar-pdf', 
    // authMiddleware, // Descomenta si tienes autenticación
    async (req, res) => {
        try {
            const ventaId = req.params.id;
            
            // Aquí podrías obtener la venta de la base de datos
            // const venta = await VentasService.obtenerVentaPorId(ventaId);
            // const productos = venta.detalles;
            
            // Por ahora, simular datos básicos
            req.body = {
                venta: { 
                    id: ventaId, 
                    codigo: `VTA-${ventaId}`,
                    cliente_nombre: 'Cliente de la venta'
                },
                productos: []
            };
            
            // Llamar al controlador principal
            return VentasPDFController.exportarVentaDetalle(req, res);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;