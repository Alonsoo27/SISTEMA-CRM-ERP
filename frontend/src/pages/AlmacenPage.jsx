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

// Lazy loading de componentes pesados
const InventarioList = React.lazy(() => import('../components/almacen/inventario/InventarioList'));
const MovimientosList = React.lazy(() => import('../components/almacen/movimientos/MovimientosList'));
const DespachosList = React.lazy(() => import('../components/almacen/despachos/DespachosList'));
const UploadStock = React.lazy(() => import('../components/almacen/upload/UploadStock'));
const AnalisisInventario = React.lazy(() => import('../components/almacen/AnalisisInventario'));
const ReportesAvanzados = React.lazy(() => import('../components/almacen/ReportesAvanzados'));

const AlmacenPage = () => {
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
        requierePermisos: ['JEFE_ALMACEN', 'GERENTE', 'SUPER_ADMIN']
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
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Productos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {almacenService.formatearCantidad(metricas.total_productos)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Warehouse className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Almacenes Activos</p>
                <p className="text-2xl font-bold text-gray-900">{metricas.total_almacenes}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Valor Inventario</p>
                <p className="text-2xl font-bold text-gray-900">
                  {almacenService.formatearValorMonetario(metricas.valor_total_inventario)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className={`h-8 w-8 ${
                  metricas.alertas_activas > 10 ? 'text-red-600' :
                  metricas.alertas_activas > 5 ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Alertas Activas</p>
                <p className="text-2xl font-bold text-gray-900">{metricas.alertas_activas}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas secundarias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Despachos Pendientes</p>
                <p className="text-xl font-bold text-gray-900">{metricas.despachos_pendientes}</p>
              </div>
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Movimientos Hoy</p>
                <p className="text-xl font-bold text-gray-900">{metricas.movimientos_hoy}</p>
              </div>
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Stock Bajo</p>
                <p className="text-xl font-bold text-gray-900">{metricas.productos_bajo_stock}</p>
              </div>
              <Archive className="h-6 w-6 text-orange-600" />
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

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            <button
              onClick={() => handleExportar('plantilla')}
              className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Plantilla
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Stock
            </button>
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

                <button
                  onClick={() => handleExportar('excel')}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </button>
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
              <InventarioList
                refreshTrigger={refreshTrigger}
                filtros={filtros}
                onFiltrosChange={setFiltros}
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
            <div className="h-full p-6 overflow-y-auto">
              <UploadStock
                isOpen={true}
                onClose={() => setVistaActual('dashboard')}
                onSuccess={() => {
                  handleRefresh();
                  showNotification('Stock actualizado exitosamente', 'success');
                }}
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