// ============================================
// HOOK PERSONALIZADO - PERMISOS DE MÓDULO
// ============================================
// Hook reutilizable para obtener permisos de un módulo específico

import { useMemo } from 'react';
import { canAccessModule, canCreateIn, canEditIn, canDeleteIn } from '../utils/userUtils';

/**
 * Hook para obtener permisos de un módulo
 * @param {string} moduleName - Código del módulo (ej: 'ventas', 'productos')
 * @returns {Object} Objeto con permisos: { canView, canCreate, canEdit, canDelete, hasAnyPermission }
 */
export const useModulePermissions = (moduleName) => {
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    }, []);

    const permissions = useMemo(() => {
        const canView = canAccessModule(user, moduleName);
        const canCreate = canCreateIn(user, moduleName);
        const canEdit = canEditIn(user, moduleName);
        const canDelete = canDeleteIn(user, moduleName);

        return {
            canView,
            canCreate,
            canEdit,
            canDelete,
            hasAnyPermission: canView || canCreate || canEdit || canDelete,
            user
        };
    }, [user, moduleName]);

    return permissions;
};

export default useModulePermissions;
