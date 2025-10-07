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
    listarAreas,
    listarModulos,
    obtenerPermisosUsuario,
    actualizarPermisosUsuario,
    listarVendedores
} = require('../controllers/usuariosController');

const { authenticateToken, requireRole, requireOwnership } = require('../../../middleware/auth');

// Importar constantes de roles
const { GRUPOS_ROLES } = require('../../../config/roles');

// ============================================
// RUTAS PÚBLICAS (Roles y Áreas para formularios)
// ============================================
// Todos los usuarios autenticados pueden ver roles y áreas (para formularios)
router.get('/roles', authenticateToken, listarRoles);
router.get('/areas', authenticateToken, listarAreas);

// Listar vendedores/asesores (para filtros y reportes de managers)
router.get('/vendedores',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS),
    listarVendedores
);

// ============================================
// RUTAS PROTEGIDAS - CRUD DE USUARIOS
// ============================================

// Listar todos los usuarios (ejecutivos y jefes pueden ver la lista)
router.get('/',
    authenticateToken,
    requireRole(GRUPOS_ROLES.JEFES_Y_EJECUTIVOS), // ← CAMBIADO: permitir JEFE_VENTAS
    listarUsuarios
);

// Obtener un usuario específico (solo jefes/ejecutivos o dueño)
router.get('/:id',
    authenticateToken,
    requireOwnership,  // Permite al usuario ver su propio perfil o a jefes/ejecutivos ver cualquiera
    obtenerUsuario
);

// Crear nuevo usuario (solo SUPER_ADMIN)
router.post('/',
    authenticateToken,
    requireRole(GRUPOS_ROLES.SOLO_ADMINISTRADORES),
    crearUsuario
);

// Actualizar usuario (solo SUPER_ADMIN)
router.put('/:id',
    authenticateToken,
    requireRole(GRUPOS_ROLES.SOLO_ADMINISTRADORES),
    actualizarUsuario
);

// Cambiar contraseña (usuario puede cambiar la suya o SUPER_ADMIN puede cambiar cualquiera)
router.put('/:id/password',
    authenticateToken,
    requireOwnership,  // Permite al usuario cambiar su propia contraseña o a SUPER_ADMIN cambiar cualquiera
    cambiarPassword
);

// Eliminar usuario (soft delete, solo SUPER_ADMIN)
router.delete('/:id',
    authenticateToken,
    requireRole(GRUPOS_ROLES.SOLO_ADMINISTRADORES),
    eliminarUsuario
);

// ============================================
// GESTIÓN DE MÓDULOS Y PERMISOS
// ============================================

// Listar todos los módulos del sistema
router.get('/modulos/list',
    authenticateToken,
    listarModulos
);

// Obtener permisos de un usuario
router.get('/:id/permisos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.SOLO_ADMINISTRADORES),
    obtenerPermisosUsuario
);

// Actualizar permisos de un usuario
router.put('/:id/permisos',
    authenticateToken,
    requireRole(GRUPOS_ROLES.SOLO_ADMINISTRADORES),
    actualizarPermisosUsuario
);

module.exports = router;
