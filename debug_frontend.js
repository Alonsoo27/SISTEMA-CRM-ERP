// ============================================
// DEBUG FRONTEND - Ejecuta esto en la CONSOLA DEL NAVEGADOR
// ============================================

console.log('=== DEBUG DE PERMISOS ===\n');

// 1. Usuario en localStorage
const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;

console.log('1. USUARIO EN LOCALSTORAGE:');
console.log(JSON.stringify(user, null, 2));

// 2. Verificar campos críticos
console.log('\n2. CAMPOS CRÍTICOS:');
console.log({
    'user.id': user?.id,
    'user.rol_id': user?.rol_id,
    'user.es_jefe': user?.es_jefe,
    'user.vende': user?.vende,
    'user.rol': user?.rol,
    'user.rol (tipo)': typeof user?.rol,
    'user.rol.id': user?.rol?.id,
    'user.rol.nombre': user?.rol?.nombre
});

// 3. Simular normalizeUser
function normalizeUser(user) {
  if (!user) return null;

  let rol_id = null;
  let rol_nombre = null;

  if (user.rol_id) {
    rol_id = user.rol_id;
    rol_nombre = user.rol;
  } else if (user.rol && typeof user.rol === 'object') {
    rol_id = user.rol.id;
    rol_nombre = user.rol.nombre;
  } else if (user.rol && typeof user.rol === 'string') {
    rol_nombre = user.rol;
    const ROLE_MAP = {
      'SUPER_ADMIN': 1, 'GERENTE': 2, 'JEFE_VENTAS': 3,
      'JEFE_MARKETING': 4, 'JEFE_SOPORTE': 5, 'JEFE_ALMACEN': 6,
      'VENDEDOR': 7, 'MARKETING_EJECUTOR': 8, 'SOPORTE_TECNICO': 9,
      'ALMACENERO': 10, 'ADMIN': 11
    };
    rol_id = ROLE_MAP[user.rol?.toUpperCase()] || null;
  }

  return {
    id: user.id,
    rol_id: rol_id,
    rol: rol_nombre,
    es_jefe: user.es_jefe || user.esJefe || false,
    vende: user.vende || false
  };
}

const normalized = normalizeUser(user);
console.log('\n3. USUARIO NORMALIZADO:');
console.log(JSON.stringify(normalized, null, 2));

// 4. Verificar permisos
const hasRole = (user, roles) => {
  if (!user || !user.rol_id) return false;
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.some(role => {
    if (typeof role === 'number') {
      return user.rol_id === role;
    } else if (typeof role === 'string') {
      return user.rol?.toUpperCase() === role.toUpperCase();
    }
    return false;
  });
};

const isExecutive = (user) => hasRole(user, [1, 2, 3, 11]);

console.log('\n4. VERIFICACIÓN DE PERMISOS:');
console.log({
    'hasRole([1])': hasRole(normalized, [1]),
    'hasRole([1,2,3,11])': hasRole(normalized, [1, 2, 3, 11]),
    'isExecutive()': isExecutive(normalized)
});

// 5. Token
const token = localStorage.getItem('token');
console.log('\n5. TOKEN:');
console.log('Existe:', !!token);
console.log('Primeros 50 chars:', token?.substring(0, 50) + '...');

console.log('\n=== FIN DEBUG ===');
