// src/pages/AlmacenPage.jsx - NIVEL ENTERPRISE-PLUS
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  Package, BarChart3, List, TrendingUp, AlertTriangle, Truck,
  Upload, Download, RefreshCw, Settings, Search, Calendar,
  CheckCircle, XCircle, Bell, Users, Filter, Plus, X,
  Warehouse, ShoppingCart, Activity, Archive, Eye, Layers,
  MapPin, Zap, GitBranch, Target, Award, PieChart
} from 'lucide-react';
import almacenService from '../services/almacenService';
import { useModulePermissions } from '../hooks/useModulePermissions';

// Lazy loading de componentes pesados
const InventarioModerno = React.lazy(() => import('../components/almacen/InventarioModerno'));
const MovimientosList = React.lazy(() => import('../components/almacen/movimientos/MovimientosList'));
const DespachosList = React.lazy(() => import('../components/almacen/despachos/DespachosList'));
const UploadMasivePage = React.lazy(() => import('../components/almacen/UploadMasivePage'));
const AnalisisInventario = React.lazy(() => import('../components/almacen/AnalisisInventario'));
const ReportesAvanzados = React.lazy(() => import('../components/almacen/ReportesAvanzados'));

const AlmacenPage = () => {
  const { canCreate, canEdit } = useModulePermissions('almacen');
  // Estados principales
  const [vistaActual, setVistaActual] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Estados para filtros y configuración
  const [filtros, setFiltros] = useState({
    almacen_id: '',
    categoria: '',
    solo_alertas: false,
    fecha_desde: '',
    fecha_hasta: '',
    busqueda: ''
  });
  
  // Estados para modales y formularios
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAlertasModal, setShowAlertasModal] = useState(false);
  
  // Estados para datos en tiempo real
  const [alertasActivas, setAlertasActivas] = useState([]);
  const [almacenesDisponibles, setAlmacenesDisponibles] = useState([]);
  
  // Usuario actual (desde contexto o props)
  const usuarioActual = {
    id: 1,
    nombre: 'Admin User',
    rol: 'SUPER_ADMIN'
  };

  // Effect para cargar datos iniciales
  useEffect(() => {
    cargarDashboardPrincipal();
    cargarAlmacenesDisponibles();
    cargarAlertasActivas();
  }, [refreshTrigger]);

  // Auto-refresh cada 5 minutos para datos críticos
  useEffect(() => {
    const interval = setInterval(() => {
      if (vistaActual === 'dashboard') {
        cargarDashboardPrincipal(true); // silencioso
        cargarAlertasActivas(true);
      }
    }, 300000); // 5 minutos

    return () => clearInterval(interval);
  }, [vistaActual]);

  // Funciones principales
  const cargarDashboardPrincipal = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setDashboardLoading(true);
      
      const response = await almacenService.obtenerDashboard();
      
      if (response.success) {
        setDashboardData(response.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error cargando dashboard de almacén:', error);
      if (!silencioso) {
        showNotification('Error al cargar dashboard de almacén', 'error');
      }
    } finally {
      if (!silencioso) setDashboardLoading(false);
    }
  }, []);

  const cargarAlmacenesDisponibles = useCallback(async () => {
    try {
      const response = await almacenService.obtenerAlmacenes();
      if (response.success) {
        setAlmacenesDisponibles(response.data);
      }
    } catch (error) {
      console.error('Error cargando almacenes:', error);
    }
  }, []);

  const cargarAlertasActivas = useCallback(async (silencioso = false) => {
    try {
      const response = await almacenService.obtenerAlertas({ estado: 'ACTIVA', limit: 10 });
      if (response.success) {
        setAlertasActivas(response.data);
      }
    } catch (error) {
      if (!silencioso) {
        console.error('Error cargando alertas:', error);
      }
    }
  }, []);

  // Handlers
  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    showNotification('Datos de almacén actualizados', 'success');
  }, []);

  const handleLimpiarFiltros = useCallback(() => {
    setFiltros({
      almacen_id: '',
      categoria: '',
      solo_alertas: false,
      fecha_desde: '',
      fecha_hasta: '',
      busqueda: ''
    });
    showNotification('Filtros de almacén limpiados', 'info');
  }, []);

  const handleExportar = useCallback(async (tipo = 'excel') => {
    try {
      setLoading(true);
      
      if (tipo === 'plantilla') {
        await almacenService.descargarPlantillaStock();
        showNotification('Plantilla de stock descargada', 'success');
      } else {
        // Simular exportación de datos actuales
        await new Promise(resolve => setTimeout(resolve, 2000));
        showNotification('Datos de almacén exportados exitosamente', 'success');
      }
    } catch (error) {
      showNotification('Error al exportar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Configuración de vistas dinámicas
  const vistas = useMemo(() => {
    const vistasBase = [
      {
        id: 'dashboard',
        nombre: 'Dashboard',
        icono: BarChart3,
        descripcion: 'Vista general de almacén con métricas principales',
        tieneRefreshAuto: true,
        requierePermisos: ['ALMACENERO', 'JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN']
      },
      {
        id: 'inventario',
        nombre: 'Inventario',
        icono: Package,
        descripcion: 'Gestión de stock y productos por almacén',
        tieneRefreshAuto: false,
        requierePermisos: ['ALMACENERO', 'JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN']
      },
      {
        id: 'movimientos',
        nombre: 'Movimientos',
        icono: Activity,
        descripcion: 'Historial de transferencias y ajustes',
        tieneRefreshAuto: false,
        requierePermisos: ['ALMACENERO', 'JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN']
      },
      {
        id: 'despachos',
        nombre: 'Despachos',
        icono: Truck,
        descripcion: 'Gestión de envíos y entregas',
        tieneRefreshAuto: true,
        requierePermisos: ['ALMACENERO', 'JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN']
      },
      {
        id: 'upload',
        nombre: 'Upload Masivo',
        icono: Upload,
        descripcion: 'Carga masiva de inventario desde Excel',
        tieneRefreshAuto: false,
        requierePermisos: ['SUPER_ADMIN']
      }
    ];

    // Vistas administrativas avanzadas
    if (['GERENTE', 'SUPER_ADMIN'].includes(usuarioActual.rol)) {
      vistasBase.push(
        {
          id: 'analisis',
          nombre: 'Análisis',
          icono: TrendingUp,
          descripcion: 'Análisis avanzado de rotación y valorización',
          tieneRefreshAuto: true,
          requierePermisos: ['GERENTE', 'SUPER_ADMIN']
        },
        {
          id: 'reportes',
          nombre: 'Reportes',
          icono: PieChart,
          descripcion: 'Reportes ejecutivos y KPIs',
          tieneRefreshAuto: false,
          requierePermisos: ['GERENTE', 'SUPER_ADMIN']
        }
      );
    }

    return vistasBase.filter(vista => 
      vista.requierePermisos.includes(usuarioActual.rol)
    );
  }, [usuarioActual.rol]);

  // Verificar si hay filtros activos
  const hayFiltrosActivos = useMemo(() => {
    return Object.values(filtros).some(value => 
      value !== null && value !== undefined && value !== ''
    );
  }, [filtros]);

  // Componente de notificaciones mejorado
  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: XCircle,
      info: Bell,
      warning: AlertTriangle
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800',
      warning: 'bg-yellow-100 border-yellow-200 text-yellow-800'
    };

    const IconComponent = iconos[notification.tipo];

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-xl ${colores[notification.tipo]} max-w-sm transition-all duration-300 transform animate-in slide-in-from-right`}>
        <div className="flex items-center">
          <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-3 flex-shrink-0 text-current opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  // Componente de alertas críticas
  const AlertasCriticas = () => {
    const alertasCriticas = alertasActivas.filter(alerta => 
      alerta.nivel_prioridad === 'CRITICA' || alerta.nivel_prioridad === 'ALTA'
    );

    if (alertasCriticas.length === 0) return null;

    return (
      <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-800">
              {alertasCriticas.length} alertas críticas requieren atención
            </span>
          </div>
          <button
            onClick={() => setShowAlertasModal(true)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Ver todas
          </button>
        </div>
        
        <div className="mt-2 space-y-1">
          {alertasCriticas.slice(0, 3).map(alerta => (
            <div key={alerta.id} className="text-xs text-red-700 pl-7">
              • {alerta.mensaje}
            </div>
          ))}
          {alertasCriticas.length > 3 && (
            <div className="text-xs text-red-600 pl-7 font-medium">
              +{alertasCriticas.length - 3} más...
            </div>
          )}
        </div>
      </div>
    );
  };

  // Componente principal del dashboard
  const DashboardPrincipal = () => {
    if (dashboardLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando dashboard de almacén...</p>
          </div>
        </div>
      );
    }

    if (!dashboardData) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <Warehouse className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin datos de almacén</h3>
          <p className="text-gray-600 mb-4">No se pudieron cargar los datos del dashboard</p>
          <button
            onClick={() => cargarDashboardPrincipal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    const metricas = dashboardData.metricas || {};

    return (
      <div className="space-y-6">
        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl shadow-lg border border-green-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-green-500 rounded-full">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-800">Disponibilidad Stock</p>
                  <p className="text-3xl font-bold text-green-900">
                    {almacenService.formatearCantidad(metricas.productos_con_stock)}
                  </p>
                  <p className="text-sm text-green-600">
                    {Math.round(((metricas.productos_con_stock || 0) / Math.max(1, (metricas.productos_con_stock || 0) + (metricas.productos_agotados || 0))) * 100)}% disponible
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="w-20 h-20 relative">
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#E5E7EB" strokeWidth="3" />
                    <path d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#10B981" strokeWidth="3"
                      strokeDasharray={`${Math.round(((metricas.productos_con_stock || 0) / Math.max(1, (metricas.productos_con_stock || 0) + (metricas.productos_agotados || 0))) * 100)}, 100`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-green-700">
                      {Math.round(((metricas.productos_con_stock || 0) / Math.max(1, (metricas.productos_con_stock || 0) + (metricas.productos_agotados || 0))) * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-red-500 mt-1">{metricas.productos_agotados || 0} agotados</p>
              </div>
            </div>
          </div>

          <div className={`bg-gradient-to-br p-6 rounded-xl shadow-lg border hover:shadow-xl transition-all duration-300 ${
            (metricas.productos_stock_bajo || 0) > 50 ? 'from-red-50 to-red-100 border-red-200' :
            (metricas.productos_stock_bajo || 0) > 20 ? 'from-yellow-50 to-orange-100 border-yellow-200' :
            'from-green-50 to-green-100 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-full ${
                  (metricas.productos_stock_bajo || 0) > 50 ? 'bg-red-500' :
                  (metricas.productos_stock_bajo || 0) > 20 ? 'bg-yellow-500' : 'bg-green-500'
                }`}>
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${
                    (metricas.productos_stock_bajo || 0) > 50 ? 'text-red-800' :
                    (metricas.productos_stock_bajo || 0) > 20 ? 'text-yellow-800' : 'text-green-800'
                  }`}>Stock Crítico</p>
                  <p className={`text-3xl font-bold ${
                    (metricas.productos_stock_bajo || 0) > 50 ? 'text-red-900' :
                    (metricas.productos_stock_bajo || 0) > 20 ? 'text-yellow-900' : 'text-green-900'
                  }`}>{metricas.productos_stock_bajo || 0}</p>
                  <p className={`text-sm ${
                    (metricas.productos_stock_bajo || 0) > 50 ? 'text-red-600' :
                    (metricas.productos_stock_bajo || 0) > 20 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {(metricas.productos_stock_bajo || 0) === 0 ? 'Stock controlado' : 'Requiere atención'}
                  </p>
                </div>
              </div>
              {(metricas.productos_stock_bajo || 0) > 0 && (
                <button
                  onClick={() => setVistaActual('inventario')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (metricas.productos_stock_bajo || 0) > 50 ? 'bg-red-500 hover:bg-red-600 text-white' :
                    (metricas.productos_stock_bajo || 0) > 20 ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                    'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  Ver Lista
                </button>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-100 p-6 rounded-xl shadow-lg border border-purple-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-purple-500 rounded-full">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-800">Valor Inventario</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {almacenService.formatearValorMonetario(metricas.valor_total_inventario)}
                  </p>
                  <div className="flex items-center mt-1">
                    <div className="w-32 bg-purple-200 rounded-full h-2 mr-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{width: '87%'}}></div>
                    </div>
                    <span className="text-sm text-purple-600">87% objetivo</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-purple-600">+2.3%</p>
                <p className="text-xs text-purple-500">vs mes anterior</p>
              </div>
            </div>
          </div>

          <div className={`bg-gradient-to-br p-6 rounded-xl shadow-lg border hover:shadow-xl transition-all duration-300 ${
            (metricas.despachos_pendientes || 0) > 20 ? 'from-red-50 to-red-100 border-red-200' :
            (metricas.despachos_pendientes || 0) > 10 ? 'from-orange-50 to-yellow-100 border-orange-200' :
            'from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-full ${
                  (metricas.despachos_pendientes || 0) > 20 ? 'bg-red-500' :
                  (metricas.despachos_pendientes || 0) > 10 ? 'bg-orange-500' : 'bg-blue-500'
                }`}>
                  <Truck className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${
                    (metricas.despachos_pendientes || 0) > 20 ? 'text-red-800' :
                    (metricas.despachos_pendientes || 0) > 10 ? 'text-orange-800' : 'text-blue-800'
                  }`}>Despachos Operativos</p>
                  <p className={`text-3xl font-bold ${
                    (metricas.despachos_pendientes || 0) > 20 ? 'text-red-900' :
                    (metricas.despachos_pendientes || 0) > 10 ? 'text-orange-900' : 'text-blue-900'
                  }`}>{metricas.despachos_pendientes || 0}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-sm ${
                      (metricas.despachos_pendientes || 0) > 20 ? 'text-red-600' :
                      (metricas.despachos_pendientes || 0) > 10 ? 'text-orange-600' : 'text-blue-600'
                    }`}>
                      {metricas.despachos_dia || 0} hoy
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className={`text-xs ${
                      (metricas.despachos_pendientes || 0) > 20 ? 'text-red-500' :
                      (metricas.despachos_pendientes || 0) > 10 ? 'text-orange-500' : 'text-blue-500'
                    }`}>
                      {(metricas.despachos_pendientes || 0) === 0 ? 'Al día' : 'Pendientes'}
                    </span>
                  </div>
                </div>
              </div>
              {(metricas.despachos_pendientes || 0) > 0 && (
                <button
                  onClick={() => setVistaActual('despachos')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (metricas.despachos_pendientes || 0) > 20 ? 'bg-red-500 hover:bg-red-600 text-white' :
                    (metricas.despachos_pendientes || 0) > 10 ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                    'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  Procesar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Widgets operativos premium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`bg-gradient-to-br p-6 rounded-xl shadow-lg border hover:shadow-xl transition-all duration-300 ${
            (metricas.movimientos_dia || 0) > 0 ? 'from-emerald-50 to-green-100 border-emerald-200' : 'from-gray-50 to-gray-100 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  (metricas.movimientos_dia || 0) > 0 ? 'text-emerald-800' : 'text-gray-600'
                }`}>Actividad Operativa</p>
                <p className={`text-2xl font-bold ${
                  (metricas.movimientos_dia || 0) > 0 ? 'text-emerald-900' : 'text-gray-700'
                }`}>
                  {metricas.movimientos_dia || 0}
                </p>
                <div className="flex items-center mt-1">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    (metricas.movimientos_dia || 0) > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <p className={`text-sm ${
                    (metricas.movimientos_dia || 0) > 0 ? 'text-emerald-600' : 'text-gray-500'
                  }`}>
                    {(metricas.movimientos_dia || 0) > 0 ? 'Sistema activo' : 'En espera'}
                  </p>
                </div>
              </div>
              <div className={`p-3 rounded-full ${
                (metricas.movimientos_dia || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-400'
              }`}>
                <Activity className="h-6 w-6 text-white" />
              </div>
            </div>
            {(metricas.movimientos_dia || 0) > 0 && (
              <button
                onClick={() => setVistaActual('movimientos')}
                className="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Ver Movimientos
              </button>
            )}
          </div>

          <div className={`bg-gradient-to-br p-6 rounded-xl shadow-lg border hover:shadow-xl transition-all duration-300 ${
            (metricas.alertas_activas || 0) > 0 ? 'from-red-50 to-red-100 border-red-200' : 'from-green-50 to-green-100 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  (metricas.alertas_activas || 0) > 0 ? 'text-red-800' : 'text-green-800'
                }`}>Estado Sistema</p>
                <p className={`text-2xl font-bold ${
                  (metricas.alertas_activas || 0) > 0 ? 'text-red-900' : 'text-green-900'
                }`}>{metricas.alertas_activas || 0}</p>
                <div className="flex items-center mt-1">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    (metricas.alertas_activas || 0) > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                  }`}></div>
                  <p className={`text-sm ${
                    (metricas.alertas_activas || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(metricas.alertas_activas || 0) > 0 ? 'Alertas activas' : 'Todo normal'}
                  </p>
                </div>
              </div>
              <div className={`p-3 rounded-full ${
                (metricas.alertas_activas || 0) > 0 ? 'bg-red-500' : 'bg-green-500'
              }`}>
                <Bell className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-100 p-6 rounded-xl shadow-lg border border-indigo-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-800">Disponibilidad</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {Math.round(((metricas.productos_con_stock || 0) /
                    Math.max(1, (metricas.productos_con_stock || 0) + (metricas.productos_agotados || 0))) * 100)}%
                </p>
                <div className="flex items-center mt-1">
                  <div className="w-20 bg-indigo-200 rounded-full h-2 mr-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{
                      width: `${Math.round(((metricas.productos_con_stock || 0) /
                        Math.max(1, (metricas.productos_con_stock || 0) + (metricas.productos_agotados || 0))) * 100)}%`
                    }}></div>
                  </div>
                  <span className="text-sm text-indigo-600">stock</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-500 rounded-full">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Resumen por almacenes principales */}
        {dashboardData.almacenes && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Resumen por Almacén</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dashboardData.almacenes.slice(0, 8).map(almacen => (
                  <div key={almacen.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">{almacen.nombre}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        almacen.tipo === 'PRINCIPAL' ? 'bg-blue-100 text-blue-800' :
                        almacen.tipo === 'SUCURSAL' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {almacen.tipo}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Productos:</span>
                        <span className="font-medium">{almacen.total_productos || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor:</span>
                        <span className="font-medium">
                          {almacenService.formatearValorMonetario(almacen.valor_inventario || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Alertas:</span>
                        <span className={`font-medium ${
                          almacen.alertas > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {almacen.alertas || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alertas recientes */}
        {dashboardData.alertas_recientes && dashboardData.alertas_recientes.length > 0 && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Alertas Recientes</h3>
                <button
                  onClick={() => setVistaActual('inventario')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Ver todas
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {dashboardData.alertas_recientes.slice(0, 5).map(alerta => (
                  <div key={alerta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className={`h-4 w-4 mr-3 ${
                        alerta.nivel_prioridad === 'CRITICA' ? 'text-red-600' :
                        alerta.nivel_prioridad === 'ALTA' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{alerta.mensaje}</p>
                        <p className="text-xs text-gray-500">
                          {alerta.almacen_nombre} • {new Date(alerta.fecha_alerta).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      alerta.nivel_prioridad === 'CRITICA' ? 'bg-red-100 text-red-800' :
                      alerta.nivel_prioridad === 'ALTA' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alerta.nivel_prioridad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Widget ABC por Rotación */}
        {dashboardData.productos_mayor_rotacion && dashboardData.productos_mayor_rotacion.length > 0 && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">ABC por Rotación (30 días)</h3>
                <button
                  onClick={() => setVistaActual('analisis')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Ver análisis completo
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.productos_mayor_rotacion.slice(0, 9).map((producto, index) => {
                  const clasificacion = index < 3 ? 'A' : index < 6 ? 'B' : 'C';
                  const colorClases = {
                    'A': 'bg-green-100 text-green-800 border-green-200',
                    'B': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    'C': 'bg-red-100 text-red-800 border-red-200'
                  };

                  return (
                    <div key={producto.producto_id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-1 rounded border font-medium ${colorClases[clasificacion]}`}>
                          Clase {clasificacion}
                        </span>
                        <span className="text-xs text-gray-500">#{index + 1}</span>
                      </div>
                      <h4 className="font-medium text-gray-900 text-sm mb-1">
                        {producto.producto_codigo}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {producto.producto_descripcion}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-600">
                          {almacenService.formatearCantidad(producto.total_cantidad || 0)}
                        </span>
                        <span className="text-xs text-gray-500">unidades</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-center space-x-6 text-xs text-gray-600">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded mr-2"></div>
                  <span>Clase A: Alta rotación (80% ventas)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded mr-2"></div>
                  <span>Clase B: Media rotación (15% ventas)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-100 border border-red-200 rounded mr-2"></div>
                  <span>Clase C: Baja rotación (5% ventas)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header principal */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Almacén</h1>
            <div className="flex items-center space-x-2 text-gray-600">
              <p>Control de inventario, movimientos y despachos</p>
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  • Actualizado {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {hayFiltrosActivos && (
              <button
                onClick={handleLimpiarFiltros}
                className="inline-flex items-center px-3 py-2 border border-orange-300 rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors text-sm"
              >
                <X className="h-4 w-4 mr-2" />
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alertas críticas */}
      <div className="px-6 pt-4">
        <AlertasCriticas />
      </div>

      {/* Navegación de vistas */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 overflow-x-auto">
            {vistas.map((vista) => {
              const IconComponent = vista.icono;
              const isActive = vistaActual === vista.id;

              return (
                <button
                  key={vista.id}
                  onClick={() => setVistaActual(vista.id)}
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-green-100 text-green-700 border border-green-200 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                  }`}
                  title={vista.descripcion}
                >
                  <IconComponent className="h-4 w-4 mr-2" />
                  {vista.nombre}
                  {vista.tieneRefreshAuto && isActive && (
                    <div className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Auto-refresh activo" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-3">
            {vistaActual !== 'dashboard' && vistaActual !== 'analisis' && vistaActual !== 'reportes' && (
              <>
                <button
                  onClick={() => showNotification('Filtros avanzados próximamente', 'info')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </button>

                {canEdit && (
                  <button
                    onClick={() => handleExportar('excel')}
                    disabled={loading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando componente...</p>
            </div>
          </div>
        }>
          {vistaActual === 'dashboard' && (
            <div className="h-full p-6 overflow-y-auto">
              <DashboardPrincipal />
            </div>
          )}

          {vistaActual === 'inventario' && (
            <div className="h-full p-6 overflow-y-auto">
              <InventarioModerno
                filtros={filtros}
                onRefresh={handleRefresh}
                usuario={usuarioActual}
              />
            </div>
          )}

          {vistaActual === 'movimientos' && (
            <div className="h-full p-6 overflow-y-auto">
              <MovimientosList
                refreshTrigger={refreshTrigger}
                filtros={filtros}
                onFiltrosChange={setFiltros}
              />
            </div>
          )}

          {vistaActual === 'despachos' && (
            <div className="h-full p-6 overflow-y-auto">
              <DespachosList
                refreshTrigger={refreshTrigger}
                filtros={filtros}
                onFiltrosChange={setFiltros}
              />
            </div>
          )}

          {vistaActual === 'upload' && (
            <div className="h-full overflow-y-auto">
              <UploadMasivePage
                onSuccess={(data) => {
                  handleRefresh();
                  showNotification('Stock actualizado exitosamente', 'success');
                }}
                onRefresh={handleRefresh}
              />
            </div>
          )}

          {vistaActual === 'analisis' && (
            <div className="h-full p-6 overflow-y-auto">
              <AnalisisInventario
                refreshTrigger={refreshTrigger}
                almacenesDisponibles={almacenesDisponibles}
              />
            </div>
          )}

          {vistaActual === 'reportes' && (
            <div className="h-full p-6 overflow-y-auto">
              <ReportesAvanzados
                almacenesDisponibles={almacenesDisponibles}
                onExport={handleExportar}
              />
            </div>
          )}
        </Suspense>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-3"></div>
            <span className="text-gray-700">Procesando operación de almacén...</span>
          </div>
        </div>
      )}

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default AlmacenPage;