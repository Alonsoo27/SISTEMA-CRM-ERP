// ============================================
// COMPONENTE - ACCIÓN PROTEGIDA
// ============================================
// Componente que solo renderiza hijos si el usuario tiene el permiso requerido

import React from 'react';
import { canAccessModule, canCreateIn, canEditIn, canDeleteIn } from '../../utils/userUtils';

/**
 * Componente que protege acciones según permisos
 * @param {string} module - Código del módulo
 * @param {string} action - Tipo de acción: 'view', 'create', 'edit', 'delete'
 * @param {ReactNode} children - Contenido a renderizar si tiene permiso
 * @param {ReactNode} fallback - Contenido alternativo si NO tiene permiso (opcional)
 */
const ProtectedAction = ({ module, action = 'view', children, fallback = null }) => {
    const user = React.useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    }, []);

    const hasPermission = React.useMemo(() => {
        switch (action) {
            case 'view':
                return canAccessModule(user, module);
            case 'create':
                return canCreateIn(user, module);
            case 'edit':
                return canEditIn(user, module);
            case 'delete':
                return canDeleteIn(user, module);
            default:
                return false;
        }
    }, [user, module, action]);

    if (!hasPermission) {
        return fallback;
    }

    return <>{children}</>;
};

export default ProtectedAction;
