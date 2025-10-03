// ============================================
// CONFIGURACIÓN CENTRALIZADA DE ROLES Y PERMISOS
// Sistema CRM/ERP v2.0
// ============================================
// Este archivo define TODOS los roles del sistema y grupos de permisos
// para mantener consistencia en todo el código.
//
// IMPORTANTE: Estos valores deben coincidir EXACTAMENTE con los de la BD
// ============================================

/**
 * ROLES DEL SISTEMA
 * Valores exactos de la tabla 'roles' en PostgreSQL
 */
const ROLES = {
  // Nivel Ejecutivo
  SUPER_ADMIN: 'SUPER_ADMIN',           // ID: 1 - Administrador del sistema
  ADMIN: 'ADMIN',                       // ID: 11 - Administrador de supervisión
  GERENTE: 'GERENTE',                   // ID: 2 - Gerencia ejecutiva

  // Jefes de Área
  JEFE_VENTAS: 'JEFE_VENTAS',          // ID: 3 - Jefe del área de ventas
  JEFE_MARKETING: 'JEFE_MARKETING',    // ID: 4 - Jefe del área de marketing
  JEFE_SOPORTE: 'JEFE_SOPORTE',        // ID: 5 - Jefe del área de soporte
  JEFE_ALMACEN: 'JEFE_ALMACEN',        // ID: 6 - Jefe del área de almacén

  // Operativos
  VENDEDOR: 'VENDEDOR',                 // ID: 7 - Asesor comercial
  MARKETING_EJECUTOR: 'MARKETING_EJECUTOR', // ID: 8 - Ejecutor de marketing
  SOPORTE_TECNICO: 'SOPORTE_TECNICO',  // ID: 9 - Técnico de soporte
  ALMACENERO: 'ALMACENERO'             // ID: 10 - Operario de almacén
};

/**
 * GRUPOS DE ROLES
 * Facilitan la asignación de permisos por categorías
 */
const GRUPOS_ROLES = {
  /**
   * EJECUTIVOS: Acceso total a reportes y vista global
   * Incluye: SUPER_ADMIN, ADMIN, GERENTE
   */
  EJECUTIVOS: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * JEFES: Líderes de área con acceso a su equipo
   * Incluye: JEFE_VENTAS, JEFE_MARKETING, JEFE_SOPORTE, JEFE_ALMACEN
   */
  JEFES: [
    ROLES.JEFE_VENTAS,
    ROLES.JEFE_MARKETING,
    ROLES.JEFE_SOPORTE,
    ROLES.JEFE_ALMACEN
  ],

  /**
   * JEFES_Y_EJECUTIVOS: Todos los niveles de gestión
   * Combinación de EJECUTIVOS + JEFES
   */
  JEFES_Y_EJECUTIVOS: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE,
    ROLES.JEFE_VENTAS,
    ROLES.JEFE_MARKETING,
    ROLES.JEFE_SOPORTE,
    ROLES.JEFE_ALMACEN
  ],

  /**
   * VENTAS: Todo el equipo de ventas
   * Incluye: VENDEDOR, JEFE_VENTAS
   */
  VENTAS: [
    ROLES.VENDEDOR,
    ROLES.JEFE_VENTAS
  ],

  /**
   * VENTAS_COMPLETO: Ventas + Ejecutivos
   * Para reportes y dashboards de ventas
   */
  VENTAS_COMPLETO: [
    ROLES.VENDEDOR,
    ROLES.JEFE_VENTAS,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * MARKETING: Todo el equipo de marketing
   * Incluye: MARKETING_EJECUTOR, JEFE_MARKETING
   */
  MARKETING: [
    ROLES.MARKETING_EJECUTOR,
    ROLES.JEFE_MARKETING
  ],

  /**
   * MARKETING_COMPLETO: Marketing + Ejecutivos
   */
  MARKETING_COMPLETO: [
    ROLES.MARKETING_EJECUTOR,
    ROLES.JEFE_MARKETING,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * SOPORTE: Todo el equipo de soporte técnico
   * Incluye: SOPORTE_TECNICO, JEFE_SOPORTE
   */
  SOPORTE: [
    ROLES.SOPORTE_TECNICO,
    ROLES.JEFE_SOPORTE
  ],

  /**
   * SOPORTE_COMPLETO: Soporte + Ejecutivos
   */
  SOPORTE_COMPLETO: [
    ROLES.SOPORTE_TECNICO,
    ROLES.JEFE_SOPORTE,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * ALMACEN: Todo el equipo de almacén
   * Incluye: ALMACENERO, JEFE_ALMACEN
   */
  ALMACEN: [
    ROLES.ALMACENERO,
    ROLES.JEFE_ALMACEN
  ],

  /**
   * ALMACEN_COMPLETO: Almacén + Ejecutivos
   */
  ALMACEN_COMPLETO: [
    ROLES.ALMACENERO,
    ROLES.JEFE_ALMACEN,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * ALMACEN_Y_VENTAS: Para despachos (almacén necesita ver ventas)
   */
  ALMACEN_Y_VENTAS: [
    ROLES.ALMACENERO,
    ROLES.JEFE_ALMACEN,
    ROLES.VENDEDOR,
    ROLES.JEFE_VENTAS,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * SOLO_ADMINISTRADORES: Solo SUPER_ADMIN
   * Para operaciones críticas (gestión de usuarios, configuración)
   */
  SOLO_ADMINISTRADORES: [
    ROLES.SUPER_ADMIN
  ],

  /**
   * SOLO_EJECUTIVOS: Solo nivel ejecutivo sin SUPER_ADMIN
   * Para reportes ejecutivos que no incluyen configuración
   */
  SOLO_EJECUTIVOS: [
    ROLES.ADMIN,
    ROLES.GERENTE
  ],

  /**
   * TODOS: Todos los roles del sistema
   * Para endpoints públicos autenticados
   */
  TODOS: Object.values(ROLES)
};

/**
 * PERMISOS POR OPERACIÓN
 * Define qué roles pueden realizar qué tipo de operaciones
 */
const PERMISOS_OPERACION = {
  // Operaciones de lectura (GET)
  LECTURA: {
    VENTAS: GRUPOS_ROLES.VENTAS_COMPLETO,
    SOPORTE: GRUPOS_ROLES.SOPORTE_COMPLETO,
    ALMACEN: GRUPOS_ROLES.ALMACEN_COMPLETO,
    MARKETING: GRUPOS_ROLES.MARKETING_COMPLETO,
    PRODUCTOS: GRUPOS_ROLES.TODOS,  // Todos pueden ver productos
    USUARIOS: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    REPORTES: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS
  },

  // Operaciones de creación (POST)
  CREACION: {
    VENTAS: GRUPOS_ROLES.VENTAS_COMPLETO,
    SOPORTE: GRUPOS_ROLES.SOPORTE_COMPLETO,
    ALMACEN: GRUPOS_ROLES.ALMACEN_COMPLETO,
    MARKETING: GRUPOS_ROLES.MARKETING_COMPLETO,
    PRODUCTOS: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    USUARIOS: GRUPOS_ROLES.SOLO_ADMINISTRADORES
  },

  // Operaciones de actualización (PUT/PATCH)
  ACTUALIZACION: {
    VENTAS: GRUPOS_ROLES.VENTAS_COMPLETO,
    SOPORTE: GRUPOS_ROLES.SOPORTE_COMPLETO,
    ALMACEN: GRUPOS_ROLES.ALMACEN_COMPLETO,
    MARKETING: GRUPOS_ROLES.MARKETING_COMPLETO,
    PRODUCTOS: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    USUARIOS: GRUPOS_ROLES.SOLO_ADMINISTRADORES
  },

  // Operaciones de eliminación (DELETE)
  ELIMINACION: {
    VENTAS: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    SOPORTE: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    ALMACEN: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    MARKETING: GRUPOS_ROLES.JEFES_Y_EJECUTIVOS,
    PRODUCTOS: GRUPOS_ROLES.EJECUTIVOS,
    USUARIOS: GRUPOS_ROLES.SOLO_ADMINISTRADORES
  }
};

/**
 * Función helper para verificar si un rol tiene permiso
 * @param {string} rol - Rol del usuario (de req.user.rol)
 * @param {Array<string>} rolesPermitidos - Array de roles que tienen permiso
 * @returns {boolean}
 */
const tienePermiso = (rol, rolesPermitidos) => {
  if (!rol || !Array.isArray(rolesPermitidos)) return false;
  return rolesPermitidos.includes(rol.toUpperCase());
};

/**
 * Función helper para verificar si un usuario es ejecutivo
 * @param {string} rol - Rol del usuario
 * @returns {boolean}
 */
const esEjecutivo = (rol) => {
  return tienePermiso(rol, GRUPOS_ROLES.EJECUTIVOS);
};

/**
 * Función helper para verificar si un usuario es jefe
 * @param {string} rol - Rol del usuario
 * @returns {boolean}
 */
const esJefe = (rol) => {
  return tienePermiso(rol, GRUPOS_ROLES.JEFES);
};

/**
 * Función helper para verificar si un usuario es jefe o ejecutivo
 * @param {string} rol - Rol del usuario
 * @returns {boolean}
 */
const esJefeOEjecutivo = (rol) => {
  return tienePermiso(rol, GRUPOS_ROLES.JEFES_Y_EJECUTIVOS);
};

// ============================================
// EXPORTACIONES
// ============================================

module.exports = {
  ROLES,
  GRUPOS_ROLES,
  PERMISOS_OPERACION,
  tienePermiso,
  esEjecutivo,
  esJefe,
  esJefeOEjecutivo
};

// ============================================
// DOCUMENTACIÓN DE USO
// ============================================
/*
EJEMPLO DE USO EN RUTAS:

const { ROLES, GRUPOS_ROLES, PERMISOS_OPERACION } = require('../../../config/roles');
const { requireRole } = require('../../../middleware/auth');

// Opción 1: Usar constantes directas
router.get('/ventas',
  requireRole([ROLES.VENDEDOR, ROLES.JEFE_VENTAS, ROLES.SUPER_ADMIN]),
  VentasController.obtenerVentas
);

// Opción 2: Usar grupos predefinidos (RECOMENDADO)
router.get('/ventas',
  requireRole(GRUPOS_ROLES.VENTAS_COMPLETO),
  VentasController.obtenerVentas
);

// Opción 3: Usar permisos por operación (MÁS SEMÁNTICO)
router.get('/ventas',
  requireRole(PERMISOS_OPERACION.LECTURA.VENTAS),
  VentasController.obtenerVentas
);

router.delete('/ventas/:id',
  requireRole(PERMISOS_OPERACION.ELIMINACION.VENTAS),
  VentasController.eliminarVenta
);

// IMPORTANTE: Ya no usar strings hardcodeados como:
// requireRole(['VENDEDOR', 'ADMIN'])  ❌ EVITAR
// requireRole(GRUPOS_ROLES.VENTAS_COMPLETO)  ✅ CORRECTO
*/
