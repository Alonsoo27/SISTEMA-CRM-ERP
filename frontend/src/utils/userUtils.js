// ============================================
// USER UTILS - NORMALIZACIÓN Y UTILIDADES
// ============================================
// Centraliza toda la lógica de manejo de usuario
// para evitar inconsistencias entre componentes

/**
 * Normaliza los datos del usuario desde diferentes fuentes
 * Maneja inconsistencias de estructura (rol como string, objeto, etc.)
 *
 * @param {Object} user - Usuario desde localStorage, API, o contexto
 * @returns {Object} Usuario normalizado con estructura consistente
 */
export const normalizeUser = (user) => {
  if (!user) return null;

  // Extraer rol_id de diferentes formatos posibles
  let rol_id = null;
  let rol_nombre = null;

  if (user.rol_id) {
    // Formato directo: { rol_id: 1, rol: "SUPER_ADMIN" }
    rol_id = user.rol_id;
    rol_nombre = user.rol;
  } else if (user.rol && typeof user.rol === 'object') {
    // Formato objeto: { rol: { id: 1, nombre: "SUPER_ADMIN" } }
    rol_id = user.rol.id;
    rol_nombre = user.rol.nombre;
  } else if (user.rol && typeof user.rol === 'string') {
    // Formato legacy: { rol: "SUPER_ADMIN" } (sin ID)
    rol_nombre = user.rol;
    // Mapear nombre a ID si es posible
    rol_id = getRoleIdFromName(user.rol);
  }

  return {
    // IDs
    id: user.id || user.user_id,
    rol_id: rol_id,

    // Información personal
    nombre: user.nombre,
    apellido: user.apellido,
    nombre_completo: user.nombre_completo || `${user.nombre || ''} ${user.apellido || ''}`.trim(),
    email: user.email,

    // Rol (ambos formatos para compatibilidad)
    rol: rol_nombre, // String para comparaciones
    rol_objeto: user.rol && typeof user.rol === 'object' ? user.rol : { id: rol_id, nombre: rol_nombre },

    // Permisos (maneja tanto snake_case como camelCase)
    vende: user.vende || false,
    es_jefe: user.es_jefe || user.esJefe || false,

    // Área (maneja ambos formatos)
    area_id: user.area_id || user.area?.id,
    area_nombre: user.area_nombre || user.area?.nombre,
    area: user.area,

    // Jefe
    jefe_id: user.jefe_id,

    // Estado
    activo: user.activo !== undefined ? user.activo : true,

    // Permisos de módulos (sistema dinámico)
    modulos_permitidos: user.modulos_permitidos || {},

    // Metadata original (por si acaso)
    _original: user
  };
};

/**
 * Mapeo de nombres de rol a IDs
 * Basado en la tabla roles de la BD
 */
const ROLE_NAME_TO_ID = {
  'SUPER_ADMIN': 1,
  'GERENTE': 2,
  'JEFE_VENTAS': 3,
  'JEFE_MARKETING': 4,
  'JEFE_SOPORTE': 5,
  'JEFE_ALMACEN': 6,
  'VENDEDOR': 7,
  'MARKETING_EJECUTOR': 8,
  'SOPORTE_TECNICO': 9,
  'ALMACENERO': 10,
  'ADMIN': 11
};

/**
 * Obtener rol_id desde nombre de rol
 */
const getRoleIdFromName = (roleName) => {
  if (!roleName) return null;
  return ROLE_NAME_TO_ID[roleName.toUpperCase()] || null;
};

/**
 * Verificar si un usuario tiene un rol específico
 * Maneja comparación por ID o por nombre
 */
export const hasRole = (user, roles) => {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser || !normalizedUser.rol_id) return false;

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  // Permitir comparación por ID o nombre
  return allowedRoles.some(role => {
    if (typeof role === 'number') {
      return normalizedUser.rol_id === role;
    } else if (typeof role === 'string') {
      return normalizedUser.rol?.toUpperCase() === role.toUpperCase();
    }
    return false;
  });
};

/**
 * Verificar si el usuario es ejecutivo (acceso alto)
 */
export const isExecutive = (user) => {
  return hasRole(user, [1, 2, 3, 11]); // SUPER_ADMIN, GERENTE, JEFE_VENTAS, ADMIN
};

/**
 * Verificar si el usuario es administrador total
 */
export const isAdmin = (user) => {
  return hasRole(user, [1, 2, 11]); // SUPER_ADMIN, GERENTE, ADMIN
};

/**
 * Verificar si el usuario es super administrador
 */
export const isSuperAdmin = (user) => {
  return hasRole(user, [1]); // Solo SUPER_ADMIN
};

/**
 * Verificar si el usuario puede vender
 */
export const canSell = (user) => {
  const normalizedUser = normalizeUser(user);
  return normalizedUser?.vende === true;
};

/**
 * Verificar si el usuario es jefe
 */
export const isManager = (user) => {
  const normalizedUser = normalizeUser(user);
  return normalizedUser?.es_jefe === true;
};

/**
 * Obtener nivel de acceso del usuario
 * @returns {'super_admin' | 'admin' | 'ejecutivo' | 'jefe' | 'empleado' | 'limitado'}
 */
export const getUserAccessLevel = (user) => {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return 'limitado';

  if (normalizedUser.rol_id === 1) return 'super_admin';
  if ([2, 11].includes(normalizedUser.rol_id)) return 'admin';
  if (normalizedUser.rol_id === 3) return 'ejecutivo';
  if (normalizedUser.es_jefe) return 'jefe';
  if (normalizedUser.vende) return 'empleado';

  return 'limitado';
};

/**
 * Verificar si el usuario tiene un permiso específico en un módulo
 * @param {Object} user - Usuario normalizado
 * @param {string} moduloCode - Código del módulo (ej: 'ventas', 'productos', 'dashboard')
 * @param {string} action - Acción a verificar: 'ver', 'crear', 'editar', 'eliminar'
 * @returns {boolean}
 */
export const hasModulePermission = (user, moduloCode, action = 'ver') => {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser?.modulos_permitidos) return false;

  const modulo = normalizedUser.modulos_permitidos[moduloCode];
  if (!modulo) return false;

  const actionKey = `puede_${action}`;
  return modulo[actionKey] === true;
};

/**
 * Verificar si el usuario puede ver/acceder a un módulo
 * @param {Object} user - Usuario
 * @param {string} moduloCode - Código del módulo
 * @returns {boolean}
 */
export const canAccessModule = (user, moduloCode) => {
  return hasModulePermission(user, moduloCode, 'ver');
};

/**
 * Verificar si el usuario puede crear en un módulo
 * @param {Object} user - Usuario
 * @param {string} moduloCode - Código del módulo
 * @returns {boolean}
 */
export const canCreateIn = (user, moduloCode) => {
  return hasModulePermission(user, moduloCode, 'crear');
};

/**
 * Verificar si el usuario puede editar en un módulo
 * @param {Object} user - Usuario
 * @param {string} moduloCode - Código del módulo
 * @returns {boolean}
 */
export const canEditIn = (user, moduloCode) => {
  return hasModulePermission(user, moduloCode, 'editar');
};

/**
 * Verificar si el usuario puede eliminar en un módulo
 * @param {Object} user - Usuario
 * @param {string} moduloCode - Código del módulo
 * @returns {boolean}
 */
export const canDeleteIn = (user, moduloCode) => {
  return hasModulePermission(user, moduloCode, 'eliminar');
};

/**
 * Obtener todos los módulos a los que el usuario tiene acceso
 * @param {Object} user - Usuario
 * @returns {Array<string>} - Array de códigos de módulos con acceso
 */
export const getAccessibleModules = (user) => {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser?.modulos_permitidos) return [];

  return Object.keys(normalizedUser.modulos_permitidos).filter(
    moduloCode => normalizedUser.modulos_permitidos[moduloCode].puede_ver === true
  );
};

/**
 * Debug: Imprimir información del usuario (solo desarrollo)
 */
export const debugUser = (user, label = 'Usuario') => {
  if (process.env.NODE_ENV !== 'development') return;

  const normalized = normalizeUser(user);
  console.log(`🔍 ${label}:`, {
    id: normalized?.id,
    nombre: normalized?.nombre_completo,
    rol_id: normalized?.rol_id,
    rol: normalized?.rol,
    vende: normalized?.vende,
    es_jefe: normalized?.es_jefe,
    nivel_acceso: getUserAccessLevel(user)
  });
};

/**
 * Obtener usuario desde localStorage de forma segura
 */
export const getUserFromStorage = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    return normalizeUser(user);
  } catch (error) {
    console.error('Error obteniendo usuario de localStorage:', error);
    return null;
  }
};

export default {
  normalizeUser,
  hasRole,
  isExecutive,
  isAdmin,
  isSuperAdmin,
  canSell,
  isManager,
  getUserAccessLevel,
  hasModulePermission,
  canAccessModule,
  canCreateIn,
  canEditIn,
  canDeleteIn,
  getAccessibleModules,
  debugUser,
  getUserFromStorage
};
