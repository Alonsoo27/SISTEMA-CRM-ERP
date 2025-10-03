import React from 'react';
import { AlertTriangle, Lock, Users, ArrowLeft } from 'lucide-react';
import { normalizeUser, isExecutive, isAdmin, isSuperAdmin, debugUser } from '../../utils/userUtils';

/**
 * Guard Component para Dashboard Ejecutivo
 * Controla acceso basado en roles de usuario
 *
 * ARQUITECTURA MEJORADA:
 * - Usa normalización centralizada de usuario
 * - Maneja inconsistencias de estructura automáticamente
 * - Logs detallados en desarrollo
 */
const DashboardEjecutivoGuard = ({
  children,
  usuarioActual,
  requiredAccess = 'ejecutivo',
  onAccessDenied = null
}) => {

  // ============================================
  // NORMALIZACIÓN DE USUARIO
  // ============================================

  const user = normalizeUser(usuarioActual);

  // Debug en desarrollo
  if (process.env.NODE_ENV === 'development') {
    debugUser(user, 'DashboardEjecutivoGuard - Usuario');
  }

  // ============================================
  // CONFIGURACIÓN DE PERMISOS
  // ============================================

  const PERMISOS_CONFIGURACION = {
    // Acceso ejecutivo básico (Jefe Ventas+)
    ejecutivo: {
      validator: (u) => isExecutive(u),
      nivel_descripcion: 'Ejecutivo (Jefe de Ventas o superior)',
      mensaje_acceso: 'Dashboard ejecutivo disponible',
      roles_ejemplo: ['SUPER_ADMIN', 'GERENTE', 'JEFE_VENTAS', 'ADMIN']
    },

    // Acceso administrativo total (Gerente+)
    admin_total: {
      validator: (u) => isAdmin(u),
      nivel_descripcion: 'Administrativo (Gerente o superior)',
      mensaje_acceso: 'Acceso administrativo completo',
      roles_ejemplo: ['SUPER_ADMIN', 'GERENTE', 'ADMIN']
    },

    // Solo super usuarios
    super_admin: {
      validator: (u) => isSuperAdmin(u),
      nivel_descripcion: 'Super Administrador',
      mensaje_acceso: 'Acceso de super administrador',
      roles_ejemplo: ['SUPER_ADMIN']
    }
  };

  // ============================================
  // VALIDACIÓN DE ACCESO
  // ============================================

  const verificarAcceso = () => {
    // Verificar si el usuario está autenticado
    if (!user || !user.rol_id) {
      console.warn('⚠️ DashboardEjecutivoGuard: Usuario no válido', {
        usuarioOriginal: usuarioActual,
        usuarioNormalizado: user
      });

      return {
        tieneAcceso: false,
        motivo: 'Usuario no autenticado o rol no definido',
        codigo: 'NOT_AUTHENTICATED'
      };
    }

    const configuracion = PERMISOS_CONFIGURACION[requiredAccess];

    if (!configuracion) {
      console.error('❌ DashboardEjecutivoGuard: Configuración inválida', { requiredAccess });
      return {
        tieneAcceso: false,
        motivo: 'Configuración de acceso inválida',
        codigo: 'INVALID_CONFIG'
      };
    }

    // Usar validador funcional en lugar de array de IDs
    const tienePermiso = configuracion.validator(user);

    if (!tienePermiso) {
      console.warn('⚠️ DashboardEjecutivoGuard: Acceso denegado', {
        user_id: user.id,
        rol_id: user.rol_id,
        rol: user.rol,
        requiredAccess,
        roles_permitidos: configuracion.roles_ejemplo
      });

      return {
        tieneAcceso: false,
        motivo: `Se requiere: ${configuracion.nivel_descripcion}`,
        codigo: 'INSUFFICIENT_PRIVILEGES',
        configuracion
      };
    }

    console.log('✅ DashboardEjecutivoGuard: Acceso autorizado', {
      user_id: user.id,
      rol_id: user.rol_id,
      rol: user.rol,
      nivel: requiredAccess
    });

    return {
      tieneAcceso: true,
      motivo: configuracion.mensaje_acceso,
      codigo: 'ACCESS_GRANTED',
      configuracion
    };
  };

  const resultadoAcceso = verificarAcceso();

  // ============================================
  // RENDER CONDICIONAL
  // ============================================

  if (resultadoAcceso.tieneAcceso) {
    // Usuario autorizado - renderizar children
    return (
      <div className="dashboard-ejecutivo-authorized">
        {/* Header opcional con info de permisos */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-green-800">
              <Users className="h-4 w-4" />
              <span>Acceso autorizado: {resultadoAcceso.motivo}</span>
              <span className="text-xs opacity-75">
                (Rol: {user?.rol || 'N/A'})
              </span>
            </div>
          </div>
        )}

        {children}
      </div>
    );
  }

  // ============================================
  // COMPONENTE DE ACCESO DENEGADO
  // ============================================

  return (
    <div className="min-h-96 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto">

        {/* Ícono principal */}
        <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-red-600" />
        </div>

        {/* Título */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Acceso Restringido
        </h3>

        {/* Mensaje principal */}
        <p className="text-gray-600 mb-4">
          {resultadoAcceso.motivo}
        </p>

        {/* Información del usuario actual */}
        {user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
            <div className="flex items-center justify-center gap-2 text-gray-700">
              <Users className="h-4 w-4" />
              <span className="font-medium">
                {user.nombre_completo || 'Usuario'}
              </span>
            </div>
            <div className="text-gray-500 mt-1">
              Rol actual: {user.rol || 'No definido'} (ID: {user.rol_id || 'N/A'})
            </div>
          </div>
        )}

        {/* Detalles del error */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-red-800 mb-1">
                Dashboard Ejecutivo
              </p>
              <p className="text-sm text-red-700">
                Este módulo está restringido a personal ejecutivo y administrativo.
                {resultadoAcceso.configuracion && (
                  <span className="block mt-1 font-medium">
                    Nivel requerido: {resultadoAcceso.configuracion.nivel_descripcion}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones disponibles */}
        <div className="space-y-3">

          {/* Botón personalizado si se proporciona callback */}
          {onAccessDenied && (
            <button
              onClick={onAccessDenied}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          )}

          {/* Información de contacto */}
          <div className="text-sm text-gray-500">
            <p>¿Necesitas acceso?</p>
            <p className="font-medium text-gray-700 mt-1">
              Contacta a tu supervisor o administrador del sistema
            </p>
          </div>

          {/* Info técnica en desarrollo */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Información técnica (desarrollo)
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 font-mono">
                <div>Código: {resultadoAcceso.codigo}</div>
                <div>Acceso requerido: {requiredAccess}</div>
                <div>Rol actual: {user?.rol_id} ({user?.rol})</div>
                <div>Roles permitidos: {resultadoAcceso.configuracion?.roles_ejemplo?.join(', ')}</div>
              </div>
            </details>
          )}

        </div>

      </div>
    </div>
  );
};

export default DashboardEjecutivoGuard;