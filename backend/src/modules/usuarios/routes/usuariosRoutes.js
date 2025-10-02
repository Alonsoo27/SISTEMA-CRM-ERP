// ============================================
// RUTAS DE GESTIÓN DE USUARIOS
// Sistema CRM/ERP - Administración de Usuarios
// ============================================

const express = require('express');
const router = express.Router();
const {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    actualizarUsuario,
    cambiarPassword,
    eliminarUsuario,
    listarRoles,
    listarAreas
} = require('../controllers/usuariosController');

const { authenticateToken } = require('../../../middleware/auth');

// ============================================
// RUTAS PÚBLICAS (Roles y Áreas para formularios)
// ============================================
router.get('/roles', authenticateToken, listarRoles);
router.get('/areas', authenticateToken, listarAreas);

// ============================================
// RUTAS PROTEGIDAS - CRUD DE USUARIOS
// ============================================

// Listar todos los usuarios
router.get('/', authenticateToken, listarUsuarios);

// Obtener un usuario específico
router.get('/:id', authenticateToken, obtenerUsuario);

// Crear nuevo usuario (solo admins)
router.post('/', authenticateToken, crearUsuario);

// Actualizar usuario (solo admins)
router.put('/:id', authenticateToken, actualizarUsuario);

// Cambiar contraseña
router.put('/:id/password', authenticateToken, cambiarPassword);

// Eliminar usuario (soft delete, solo admins)
router.delete('/:id', authenticateToken, eliminarUsuario);

module.exports = router;
