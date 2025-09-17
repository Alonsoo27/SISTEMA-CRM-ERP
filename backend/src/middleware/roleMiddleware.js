// ============================================
// ROLE MIDDLEWARE - CONTROL DE ACCESO EMPRESARIAL
// Sistema CRM/ERP v2.0 - VERSIÓN ENTERPRISE
// ============================================

// ============================================
// LOGGING EMPRESARIAL
// ============================================
const logRoleEvent = (event, details = {}) => {
    console.log(`\n🔐 ROLE ACCESS: ${event}`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Details:', details);
    console.log('================================\n');
};

// ============================================
// JERARQUÍA DE ROLES EMPRESARIAL
// ============================================
const ROLE_HIERARCHY = {
    'SUPER_ADMIN': 100,
    'ADMIN': 90,
    'MANAGER': 80,
    'jefe_almacen': 75,
    'supervisor': 70,
    'vendedor': 60,
    'almacenero': 55,
    'asesor': 50,
    'usuario': 40,
    'guest': 10
};

const ROLE_PERMISSIONS = {
    'super_admin': ['read', 'write', 'delete', 'admin', 'config', 'users', 'reports', 'all'],
    'admin': ['read', 'write', 'delete', 'admin', 'config', 'users', 'reports'],
    'manager': ['read', 'write', 'delete', 'reports', 'team_management'],
    'jefe_almacen': ['read', 'write', 'delete', 'almacen_admin', 'reports', 'stock_management'],
    'almacenero': ['read', 'write', 'almacen_basic', 'stock_update'],
    'supervisor': ['read', 'write', 'reports', 'team_view'],
    'vendedor': ['read', 'write', 'own_data'],
    'asesor': ['read', 'write', 'own_data'],
    'usuario': ['read', 'own_data'],
    'guest': ['read']
};

// ============================================
// MIDDLEWARE PRINCIPAL DE ROLES
// ============================================
exports.requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            // Verificar que el usuario esté autenticado
            if (!req.user) {
                logRoleEvent('ACCESS_DENIED_NO_AUTH', {
                    ip: req.ip,
                    endpoint: req.path,
                    method: req.method
                });

                return res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado',
                    code: 'USER_NOT_AUTHENTICATED',
                    required_roles: allowedRoles
                });
            }

            // Obtener rol del usuario (compatible con diferentes formatos)
            const userRole = req.user.rol || req.user.role || req.user.user_role || 'guest';
            const userId = req.user.id || req.user.user_id || 'unknown';
            
            logRoleEvent('ROLE_CHECK_ATTEMPT', {
                user_id: userId,
                user_role: userRole,
                required_roles: allowedRoles,
                endpoint: req.path,
                method: req.method
            });

            // Convertir a array si se pasa un string
            const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

            // Verificar si el usuario tiene uno de los roles permitidos
            const hasValidRole = rolesArray.some(role => {
                // Comparación exacta
                if (userRole.toLowerCase() === role.toLowerCase()) {
                    return true;
                }
                
                // Verificar jerarquía (roles superiores tienen acceso automático)
                const userLevel = ROLE_HIERARCHY[userRole.toLowerCase()] || 0;
                const requiredLevel = ROLE_HIERARCHY[role.toLowerCase()] || 0;
                
                return userLevel >= requiredLevel;
            });

            if (hasValidRole) {
                logRoleEvent('ACCESS_GRANTED', {
                    user_id: userId,
                    user_role: userRole,
                    endpoint: req.path,
                    method: req.method
                });
                
                next();
            } else {
                logRoleEvent('ACCESS_DENIED_INSUFFICIENT_ROLE', {
                    user_id: userId,
                    user_role: userRole,
                    required_roles: allowedRoles,
                    endpoint: req.path,
                    method: req.method
                });

                res.status(403).json({
                    success: false,
                    message: 'Permisos insuficientes para acceder a este recurso',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    user_role: userRole,
                    required_roles: allowedRoles,
                    available_permissions: ROLE_PERMISSIONS[userRole.toLowerCase()] || []
                });
            }

        } catch (error) {
            logRoleEvent('ROLE_CHECK_ERROR', {
                error: error.message,
                endpoint: req.path,
                method: req.method
            });

            res.status(500).json({
                success: false,
                message: 'Error interno al verificar permisos',
                code: 'ROLE_CHECK_ERROR'
            });
        }
    };
};

// ============================================
// MIDDLEWARE DE PERMISOS ESPECÍFICOS
// ============================================
exports.requirePermission = (requiredPermissions) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
            }

            const userRole = req.user.rol || req.user.role || 'guest';
            const userPermissions = ROLE_PERMISSIONS[userRole.toLowerCase()] || [];
            
            const permissionsArray = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
            
            const hasPermission = permissionsArray.some(permission => 
                userPermissions.includes(permission) || userPermissions.includes('all')
            );

            if (hasPermission) {
                logRoleEvent('PERMISSION_GRANTED', {
                    user_id: req.user.id,
                    user_role: userRole,
                    required_permissions: permissionsArray,
                    user_permissions: userPermissions
                });
                
                next();
            } else {
                logRoleEvent('PERMISSION_DENIED', {
                    user_id: req.user.id,
                    user_role: userRole,
                    required_permissions: permissionsArray,
                    user_permissions: userPermissions
                });

                res.status(403).json({
                    success: false,
                    message: 'Permisos específicos insuficientes',
                    code: 'INSUFFICIENT_SPECIFIC_PERMISSIONS',
                    required_permissions: permissionsArray,
                    user_permissions: userPermissions
                });
            }

        } catch (error) {
            logRoleEvent('PERMISSION_CHECK_ERROR', { error: error.message });
            
            res.status(500).json({
                success: false,
                message: 'Error al verificar permisos específicos'
            });
        }
    };
};

// ============================================
// MIDDLEWARE PARA ADMINISTRADORES
// ============================================
exports.requireAdmin = exports.requireRole(['admin', 'super_admin']);

// ============================================
// MIDDLEWARE PARA MANAGERS
// ============================================
exports.requireManager = exports.requireRole(['manager', 'admin', 'super_admin']);

// ============================================
// MIDDLEWARE PARA VENDEDORES
// ============================================
exports.requireSalesAccess = exports.requireRole(['vendedor', 'asesor', 'supervisor', 'manager', 'admin', 'super_admin']);

// ============================================
// VERIFICAR PROPIEDAD DE RECURSO
// ============================================
exports.requireOwnershipOrRole = (allowedRoles, ownershipField = 'asesor_id') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
            }

            const userRole = req.user.rol || req.user.role || 'guest';
            const userId = req.user.id || req.user.user_id;

            // Verificar si tiene rol suficiente
            const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
            const hasValidRole = rolesArray.some(role => {
                const userLevel = ROLE_HIERARCHY[userRole.toLowerCase()] || 0;
                const requiredLevel = ROLE_HIERARCHY[role.toLowerCase()] || 0;
                return userLevel >= requiredLevel;
            });

            if (hasValidRole) {
                logRoleEvent('OWNERSHIP_BYPASS_BY_ROLE', {
                    user_id: userId,
                    user_role: userRole,
                    endpoint: req.path
                });
                return next();
            }

            // Verificar ownership (esto requeriría lógica adicional según el recurso)
            // Por ahora, permitir acceso si es el mismo usuario
            const resourceOwnerId = req.params.asesor_id || req.body.asesor_id || req.query.asesor_id;
            
            if (resourceOwnerId && parseInt(resourceOwnerId) === parseInt(userId)) {
                logRoleEvent('ACCESS_GRANTED_BY_OWNERSHIP', {
                    user_id: userId,
                    resource_owner: resourceOwnerId,
                    endpoint: req.path
                });
                return next();
            }

            logRoleEvent('ACCESS_DENIED_NO_OWNERSHIP', {
                user_id: userId,
                user_role: userRole,
                resource_owner: resourceOwnerId,
                endpoint: req.path
            });

            res.status(403).json({
                success: false,
                message: 'No tienes permisos para acceder a este recurso',
                code: 'NO_OWNERSHIP_OR_SUFFICIENT_ROLE'
            });

        } catch (error) {
            logRoleEvent('OWNERSHIP_CHECK_ERROR', { error: error.message });
            
            res.status(500).json({
                success: false,
                message: 'Error al verificar propiedad del recurso'
            });
        }
    };
};

// ============================================
// UTILIDADES ADICIONALES
// ============================================

// Obtener información de roles disponibles
exports.getRoleInfo = () => {
    return {
        hierarchy: ROLE_HIERARCHY,
        permissions: ROLE_PERMISSIONS,
        available_roles: Object.keys(ROLE_HIERARCHY)
    };
};

// Verificar si un rol tiene un permiso específico
exports.roleHasPermission = (role, permission) => {
    const rolePermissions = ROLE_PERMISSIONS[role.toLowerCase()] || [];
    return rolePermissions.includes(permission) || rolePermissions.includes('all');
};

// Obtener nivel de jerarquía de un rol
exports.getRoleLevel = (role) => {
    return ROLE_HIERARCHY[role.toLowerCase()] || 0;
};

console.log('✅ RoleMiddleware loaded successfully - Enterprise access control ready');
console.log('🔐 Available roles:', Object.keys(ROLE_HIERARCHY).join(', '));
console.log('🛡️  Security features: Role hierarchy, Permission-based access, Ownership verification');
console.log('📊 Logging: All access attempts logged for security audit\n');