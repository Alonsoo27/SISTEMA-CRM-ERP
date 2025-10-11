// src/components/layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';
import { ToastContainer } from '../common/NotificationToast';
import { useNotificaciones } from '../../hooks/useNotificaciones';
import authService from '../../services/authService';
import { canAccessModule } from '../../utils/userUtils';
import CambioPasswordObligatorio from '../auth/CambioPasswordObligatorio';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false);

  // 🍞 Hook de notificaciones para toasts
  const { toasts, removerToast } = useNotificaciones();

  // Cargar usuario al montar componente
  useEffect(() => {
    console.log('🔍 Layout: Cargando usuario...');

    // Verificar autenticación
    if (!authService.isAuthenticated()) {
      console.warn('⚠️ Layout: Usuario no autenticado, redirigiendo a login');
      navigate('/login', { replace: true });
      return;
    }

    // Obtener usuario del localStorage
    const usuario = authService.getUser();

    if (usuario) {
      setUsuarioActual(usuario);
      console.log('✅ Layout: Usuario cargado:', {
        id: usuario.id,
        nombre: usuario.nombre_completo || usuario.nombre,
        rol: usuario.rol?.nombre || usuario.rol,
        debe_cambiar_password: usuario.debe_cambiar_password
      });

      // Verificar si debe cambiar contraseña
      if (usuario.debe_cambiar_password === true) {
        console.log('🔐 Layout: Usuario debe cambiar contraseña');
        setMostrarCambioPassword(true);
      }
    } else {
      console.warn('⚠️ Layout: No se pudo obtener usuario');
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Definición de todos los módulos del menú
  const allMenuItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: '🏠',
      description: 'Vista general del sistema',
      moduleCode: 'dashboard'
    },
    {
      name: 'Prospectos',
      path: '/prospectos',
      icon: '🎯',
      description: 'Pipeline de ventas y seguimientos',
      moduleCode: 'prospectos'
    },
    {
      name: 'Productos',
      path: '/productos',
      icon: '📦',
      description: 'Gestión de productos y catálogo',
      moduleCode: 'productos'
    },
    {
      name: 'Ventas',
      path: '/ventas',
      icon: '💰',
      description: 'Gestión de ventas cerradas',
      moduleCode: 'ventas'
    },
    {
      name: 'Soporte',
      path: '/soporte',
      icon: '🛠️',
      description: 'Tickets y soporte técnico',
      moduleCode: 'soporte'
    },
    {
      name: 'Almacén',
      path: '/almacen',
      icon: '📋',
      description: 'Control de inventario',
      moduleCode: 'almacen'
    },
    {
      name: 'Marketing',
      path: '/marketing',
      icon: '📢',
      description: 'Campañas y planificación',
      moduleCode: 'marketing'
    },
    {
      name: 'Chat',
      path: '/chat',
      icon: '💬',
      description: 'Comunicación interna',
      moduleCode: 'chat'
    },
    {
      name: 'Usuarios',
      path: '/admin/usuarios',
      icon: '👥',
      description: 'Administración de usuarios',
      moduleCode: 'usuarios'
    }
  ];

  // Filtrar módulos según permisos del usuario
  const menuItems = allMenuItems.filter(item => {
    // Dashboard siempre visible
    if (item.moduleCode === 'dashboard') return true;

    // Verificar permiso de acceso al módulo
    return canAccessModule(usuarioActual, item.moduleCode);
  });

  // FUNCIÓN LOGOUT COMPLETA
  const handleLogout = () => {
    try {
      console.log('🚪 Layout: Cerrando sesión...');

      // Usar authService para logout completo
      authService.logout();

      // Limpiar estado local
      setUsuarioActual(null);

      console.log('✅ Layout: Sesión cerrada correctamente');

      // Redireccionar al login
      navigate('/login', { replace: true });

    } catch (error) {
      console.error('❌ Layout: Error al cerrar sesión:', error);
      // Aún así redireccionar
      navigate('/login', { replace: true });
    }
  };

  const isActiveRoute = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const currentItem = menuItems.find(item => isActiveRoute(item.path));
    return currentItem ? currentItem.name : 'Sistema CRM/ERP';
  };

  // Obtener iniciales del usuario
  const getIniciales = () => {
    if (!usuarioActual) return 'U';

    const nombre = usuarioActual.nombre || usuarioActual.username || '';
    const apellido = usuarioActual.apellido || '';

    const inicial1 = nombre.charAt(0).toUpperCase();
    const inicial2 = apellido.charAt(0).toUpperCase();

    return inicial2 ? inicial1 + inicial2 : inicial1;
  };

  // Obtener nombre completo del usuario
  const getNombreCompleto = () => {
    if (!usuarioActual) return 'Usuario';

    const nombre = usuarioActual.nombre || usuarioActual.username || 'Usuario';
    const apellido = usuarioActual.apellido || '';

    return apellido ? `${nombre} ${apellido}` : nombre;
  };

  // Obtener rol del usuario
  const getRol = () => {
    if (!usuarioActual) return 'Usuario';

    // Si rol es un objeto, extraer el nombre
    let rol = usuarioActual.rol;
    if (typeof rol === 'object' && rol !== null) {
      rol = rol.nombre || rol.name || 'Usuario';
    }

    // Si no hay rol, usar fallback
    if (!rol) {
      rol = usuarioActual.role || 'Usuario';
    }

    // Formatear rol para mostrar
    const rolesFormato = {
      'ADMIN': 'Administrador',
      'SUPER_ADMIN': 'Super Administrador',
      'GERENTE': 'Gerente',
      'ASESOR': 'Asesor de Ventas',
      'VENDEDOR': 'Vendedor',
      'SOPORTE': 'Soporte Técnico',
      'ALMACEN': 'Almacén'
    };

    return rolesFormato[rol] || rol;
  };

  // Manejar éxito del cambio de contraseña
  const handlePasswordChangeSuccess = () => {
    console.log('✅ Layout: Contraseña cambiada exitosamente');
    setMostrarCambioPassword(false);

    // Actualizar usuario actual
    const usuarioActualizado = authService.getUser();
    if (usuarioActualizado) {
      setUsuarioActual(usuarioActualizado);
    }
  };

  return (
    <div className="h-screen flex bg-gray-100">
      {/* 🍞 Toast Container para notificaciones críticas */}
      <ToastContainer toasts={toasts} onRemoveToast={removerToast} />

      {/* Modal de cambio de contraseña obligatorio */}
      {mostrarCambioPassword && (
        <CambioPasswordObligatorio onSuccess={handlePasswordChangeSuccess} />
      )}

      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        {/* Logo y título */}
        <div className="h-16 px-6 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center">
          <div className="h-8 w-8 bg-white rounded flex items-center justify-center mr-3">
            <span className="text-blue-600 font-bold text-lg">C</span>
          </div>
          <div>
            <span className="text-xl font-bold text-white">CRM/ERP</span>
            <div className="text-xs text-blue-100">Sistema Empresarial</div>
          </div>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`group flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title={item.description}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                <div className="flex-1">
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <div className="text-xs text-blue-600 opacity-75">
                      {item.description}
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Información del usuario y logout */}
        <div className="p-4 border-t border-gray-200">
          {/* Info del usuario */}
          <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
              <span className="text-white text-sm font-medium">{getIniciales()}</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{getNombreCompleto()}</div>
              <div className="text-xs text-gray-600">{getRol()}</div>
            </div>
          </div>

          {/* Botón de cerrar sesión CON FUNCIONALIDAD */}
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
          >
            <span className="mr-3 text-lg">🚪</span>
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col">
        {/* Header superior */}
        <header className="bg-white shadow-sm border-b h-16 px-6 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {getPageTitle()}
            </h1>
            
            {/* Breadcrumb */}
            <nav className="ml-4 flex items-center text-sm text-gray-500">
              <span>Sistema CRM/ERP</span>
              <span className="mx-2">/</span>
              <span className="text-gray-700">{getPageTitle()}</span>
            </nav>
          </div>

          {/* Acciones del header */}
          <div className="flex items-center space-x-4">
            {/* Indicador de estado del sistema */}
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Sistema Operativo</span>
            </div>

            {/* Notificaciones funcionales */}
            <NotificationBell />

            {/* Avatar del usuario */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                Bienvenido, {usuarioActual?.nombre || 'Usuario'}
              </span>
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">{getIniciales()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Área de contenido principal */}
        <main className="flex-1 overflow-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;