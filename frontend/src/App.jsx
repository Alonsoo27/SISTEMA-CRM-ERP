// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from "./components/auth/Login/Login";
import authService from './services/authService';

// Páginas principales
import ProductosPage from './pages/ProductosPage';
import ProspectosPage from './pages/ProspectosPage';
import VentasPage from './pages/VentasPage';
import AlmacenPage from './pages/AlmacenPage'; // ✅ NUEVO: Importar AlmacenPage real
import SoportePage from './pages/SoportePage'; // ✅ NUEVO: Importar SoportePage con tabs
import AdministracionUsuariosPage from './pages/AdministracionUsuariosPage'; // ✅ NUEVO: Administración de usuarios
// import ClientesPage from './pages/ClientesPage'; // ✅ ELIMINADO: ClientesPage removido

// ✅ Componente para verificar autenticación
const ProtectedRoute = ({ children }) => {
  // Usar authService como única fuente de verdad
  if (!authService.isAuthenticated()) {
    authService.logout();
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Páginas principales
const DashboardPage = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">📊</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard General</h1>
      <p className="text-gray-600 mb-4">Vista general del sistema CRM/ERP</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl">
        {[
          { nombre: 'Prospectos', valor: '12', color: 'blue' },
          { nombre: 'Ventas', valor: '$25,480', color: 'green' },
          { nombre: 'Productos', valor: '156', color: 'purple' },
          { nombre: 'Almacén', valor: '11', color: 'orange' } // ✅ ACTUALIZADO: Cambiar "Tickets" por "Almacén"
        ].map((item, index) => (
          <div key={index} className={`bg-${item.color}-50 p-4 rounded-lg border border-${item.color}-200`}>
            <div className={`text-2xl font-bold text-${item.color}-600`}>{item.valor}</div>
            <div className={`text-sm text-${item.color}-700`}>{item.nombre}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ✅ ELIMINADO: Placeholder SoportePage - Ahora se usa SoporteDashboard real

// ✅ ELIMINADO: Placeholder AlmacenPage - Ahora se importa desde pages/AlmacenPage

const MarketingPage = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">📈</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Marketing</h1>
      <p className="text-gray-600 mb-4">Campañas y planificación</p>
      <div className="text-sm text-gray-500">
        <p>En desarrollo:</p>
        <ul className="mt-2 space-y-1">
          <li>• Planificador semanal de tareas</li>
          <li>• Gestión de urgencias</li>
          <li>• Métricas de campañas</li>
          <li>• Calendario de contenido</li>
        </ul>
      </div>
    </div>
  </div>
);

const ChatPage = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">💬</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Comunicación Interna</h1>
      <p className="text-gray-600 mb-4">Chat y calendario integrado</p>
      <div className="text-sm text-gray-500">
        <p>Próximamente:</p>
        <ul className="mt-2 space-y-1">
          <li>• Chat en tiempo real</li>
          <li>• Grupos por departamento</li>
          <li>• Calendario compartido</li>
          <li>• Notificaciones push</li>
        </ul>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta de Login - SIN protección */}
        <Route path="/login" element={<Login />} />
        
        {/* Todas las demás rutas están protegidas */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          {/* Página de inicio - Dashboard */}
          <Route index element={<DashboardPage />} />
          
          {/* Módulo de Prospectos - COMPLETAMENTE FUNCIONAL ✅ */}
          <Route path="prospectos" element={<ProspectosPage />} />
          
          {/* Módulo de Ventas - COMPLETAMENTE FUNCIONAL ✅ */}
          <Route path="ventas" element={<VentasPage />} />
          
          {/* Módulo de Productos - COMPLETAMENTE FUNCIONAL ✅ */}
          <Route path="productos" element={<ProductosPage />} />
          
          {/* Módulo de Almacén - COMPLETAMENTE FUNCIONAL ✅ */}
          <Route path="almacen" element={<AlmacenPage />} />

          {/* Otros módulos - Placeholders preparados para desarrollo */}
          <Route path="soporte" element={<SoportePage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="chat" element={<ChatPage />} />

          {/* Administración */}
          <Route path="admin/usuarios" element={<AdministracionUsuariosPage />} />

          {/* Ruta de desarrollo/testing (opcional) */}
          <Route path="dev" element={<DevPage />} />
        </Route>
        
        {/* Redirección para rutas no encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

// Página opcional para testing y desarrollo
const DevPage = () => (
  <div className="h-full p-6">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🛠️ Página de Desarrollo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Estado del Sistema */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Estado del Sistema</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Backend (Puerto 3001)</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">✅ Activo</span>
            </div>
            <div className="flex justify-between">
              <span>Frontend (Puerto 5173)</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">✅ Activo</span>
            </div>
            <div className="flex justify-between">
              <span>Base de Datos</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">✅ Conectado</span>
            </div>
          </div>
        </div>

        {/* Módulos del Sistema */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Progreso de Módulos</h2>
          <div className="space-y-3">
            {[
              { nombre: 'Prospectos', progreso: 100, color: 'green' },
              { nombre: 'Ventas', progreso: 100, color: 'green' },
              { nombre: 'Autenticación', progreso: 100, color: 'green' },
              { nombre: 'Productos', progreso: 100, color: 'green' },
              { nombre: 'Almacén', progreso: 95, color: 'green' }, // ✅ ACTUALIZADO: Progreso del almacén
              { nombre: 'Soporte', progreso: 0, color: 'gray' }
            ].map((modulo, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{modulo.nombre}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-${modulo.color}-500`}
                      style={{ width: `${modulo.progreso}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600">{modulo.progreso}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default App;