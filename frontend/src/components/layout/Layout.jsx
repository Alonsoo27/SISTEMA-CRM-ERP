// src/components/layout/Layout.jsx
import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: '🏠',
      description: 'Vista general del sistema'
    },
    { 
      name: 'Prospectos', 
      path: '/prospectos', 
      icon: '🎯',
      description: 'Pipeline de ventas y seguimientos'
    },
    { 
      name: 'Productos', 
      path: '/productos', 
      icon: '📦',
      description: 'Gestión de productos y catálogo'
    },
    { 
      name: 'Ventas', 
      path: '/ventas', 
      icon: '💰',
      description: 'Gestión de ventas cerradas'
    },
    { 
      name: 'Soporte', 
      path: '/soporte', 
      icon: '🛠️',
      description: 'Tickets y soporte técnico'
    },
    { 
      name: 'Almacén', 
      path: '/almacen', 
      icon: '📋',
      description: 'Control de inventario'
    },
    { 
      name: 'Marketing', 
      path: '/marketing', 
      icon: '📢',
      description: 'Campañas y planificación'
    },
    { 
      name: 'Chat', 
      path: '/chat', 
      icon: '💬',
      description: 'Comunicación interna'
    }
  ];

  // FUNCIÓN LOGOUT COMPLETA
  const handleLogout = () => {
    try {
      // Limpiar todos los datos de autenticación
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      
      // Limpiar sessionStorage también por si acaso
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('user');
      
      // Opcional: mostrar mensaje de confirmación
      console.log('Sesión cerrada correctamente');
      
      // Redireccionar al login
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
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

  return (
    <div className="h-screen flex bg-gray-100">
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
              <span className="text-white text-sm font-medium">A</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Admin User</div>
              <div className="text-xs text-gray-600">Administrador</div>
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
      <div className="flex-1 flex flex-col overflow-hidden">
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
              <span className="text-sm text-gray-600">Bienvenido, Admin</span>
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* Área de contenido principal */}
        <main className="flex-1 overflow-hidden bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;