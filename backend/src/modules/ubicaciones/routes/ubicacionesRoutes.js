const express = require('express');
const router = express.Router();
const ubicacionesController = require('../controllers/ubicacionesController');

// Rutas principales
router.get('/departamentos', ubicacionesController.getDepartamentos);
router.get('/provincias/:departamento', ubicacionesController.getProvinciasByDepartamento);
router.get('/distritos/:departamento/:provincia', ubicacionesController.getDistritosByProvincia);

// Rutas auxiliares
router.get('/jerarquia', ubicacionesController.getJerarquiaCompleta);
router.get('/validar', ubicacionesController.validarUbicacion);
router.get('/buscar', ubicacionesController.buscarUbicaciones);

// Ruta de información
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🇵🇪 API de Ubicaciones Oficiales del Perú',
    version: '1.0.0',
    descripcion: 'Sistema de ubicaciones oficiales basado en códigos UBIGEO del RENIEC/INEI',
    endpoints: {
      departamentos: 'GET /api/ubicaciones/departamentos',
      provincias: 'GET /api/ubicaciones/provincias/:departamento',
      distritos: 'GET /api/ubicaciones/distritos/:departamento/:provincia',
      jerarquia: 'GET /api/ubicaciones/jerarquia',
      validar: 'GET /api/ubicaciones/validar?departamento=X&provincia=Y&distrito=Z',
      buscar: 'GET /api/ubicaciones/buscar?termino=X&tipo=Y'
    },
    total_ubicaciones: {
      departamentos: 24,
      provincias: 'Variable por departamento',
      distritos: 'Variable por provincia'
    },
    ejemplos: {
      departamentos: '/api/ubicaciones/departamentos',
      provincias: '/api/ubicaciones/provincias/LIMA',
      distritos: '/api/ubicaciones/distritos/LIMA/LIMA',
      busqueda: '/api/ubicaciones/buscar?termino=san&tipo=distrito'
    }
  });
});

module.exports = router;