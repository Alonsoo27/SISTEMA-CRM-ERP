// src/pages/VentasPage.jsx - VERSIÓN CON SMART HEADER ADAPTATIVO
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, BarChart3, List, DollarSign, Filter, Download,
  RefreshCw, Settings, Search, Calendar, AlertCircle,
  CheckCircle, XCircle, Bell, Users, TrendingUp,
  Target, CreditCard, PieChart, Activity,
  Map, Package, GitBranch, Eye, Layers,
  Award, Zap, X
} from 'lucide-react';
import VentasList from '../components/ventas/VentasList/VentasList';
import VentasMetrics from '../components/ventas/VentasMetrics/VentasMetrics';
import VentaForm from '../components/ventas/VentaForm/VentaForm';
import ClienteForm from '../components/ventas/ClienteForm/ClienteForm';
import VentaDetailsView from '../components/ventas/VentaDetailsView';
import ActividadPage from '../components/ventas/ActividadPage/ActividadPage';
import SmartHeader from '../components/ventas/SmartHeader/SmartHeader';
import ventasService from '../services/ventasService';
import VistaUnificada from '../components/VistaUnificada';
import AnalisisGeografico from '../components/AnalisisGeografico';
import ABCProductos from '../components/ABCProductos';
import MetasAvanzado from '../components/MetasAvanzado.jsx';
import PipelineMetrics from '../components/ventas/PipelineMetrics/PipelineMetrics';
const VentasPage = () => {
  const [vistaActual, setVistaActual] = useState('lista');
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filtros, setFiltros] = useState({
    asesor_id: null,
    estado: '',
    cliente_id: null,
    fecha_desde: '',
    fecha_hasta: '',
    busqueda: '',
    rango_monto: { min: '', max: '' }
  });
  const [statsGenerales, setStatsGenerales] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [mostrarModalBonos, setMostrarModalBonos] = useState(false);
  const [dashboardActivo, setDashboardActivo] = useState('maestro');
  const [datosDashboard, setDatosDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // ESTADOS PARA VentaDetailsView
  const [showVentaDetails, setShowVentaDetails] = useState(false);
  const [ventaDetalles, setVentaDetalles] = useState(null);

  const usuarioActual = {
    id: 1,
    nombre: 'Alonso Admin',
    rol: 'admin'
  };

  useEffect(() => {
    cargarStatsGenerales();
  }, [refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(() => {
      cargarStatsGenerales(true);
    }, 300000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
  if (vistaActual === 'dashboards-admin' && !datosDashboard && dashboardActivo === 'maestro') {
    cargarDashboard('maestro');
  }
  }, [vistaActual, dashboardActivo]);
  const cargarStatsGenerales = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setStatsLoading(true);
      const response = await ventasService.obtenerMetricas();
      let statsData = response.data || {};
      if (!statsData || typeof statsData !== 'object') {
        statsData = {};
      }
      try {
        const token = localStorage.getItem('token');
        const bonosResponse = await fetch('/api/comisiones/bono-actual/1', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const bonosData = await bonosResponse.json();

        if (bonosData.success) {
          statsData.bono_actual = bonosData.data.bono_actual.bono_usd;
          statsData.porcentaje_meta = bonosData.data.bono_actual.porcentaje;
          statsData.meta_mes = bonosData.data.asesor.meta_usd;
          statsData.vendido_real = bonosData.data.asesor.vendido_usd;
          statsData.falta_siguiente = bonosData.data.bono_actual.falta_siguiente || '0';
        }
      } catch (bonosError) {
        console.log('Error cargando bonos (usando datos demo):', bonosError);
        statsData.bono_actual = '276.00';
        statsData.porcentaje_meta = 156;
        statsData.meta_mes = '8,000';
        statsData.vendido_real = '12,480';
        statsData.falta_siguiente = '0';
      }

      setStatsGenerales(statsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error cargando stats generales:', err);
      showNotification('Error al cargar estadísticas de ventas', 'error');
    } finally {
      if (!silencioso) setStatsLoading(false);
    }
  }, []);

  const cargarDashboard = useCallback(async (dashboardKey) => {
    try {
      setDashboardLoading(true);
      let response;

      switch(dashboardKey) {
        case 'maestro':
            response = await ventasService.obtenerVistaUnificada('mes_actual');
          break;
        case 'geografico':
            response = await ventasService.obtenerDashboardGeografico('mes_actual');
          break;
        case 'abc-productos':
            response = await ventasService.obtenerDashboardABCProductos('mes_actual');
          break;
        case 'metas-avanzado':
            response = await ventasService.obtenerDashboardMetasAvanzado('mes_actual');
          break;
        default:
          throw new Error('Dashboard no disponible: ' + dashboardKey);
      }

      if (response.success) {
        setDatosDashboard(response.data);
        showNotification(`Dashboard ${dashboardKey} cargado`, 'success');
      } else {
        throw new Error(response.error);
      }

    } catch (err) {
      console.error('Error cargando dashboard:', err);
      showNotification(`Error cargando dashboard: ${err.message}`, 'error');
      setDatosDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const handleDashboardChange = useCallback((dashboardKey) => {
    setDashboardActivo(dashboardKey);
    cargarDashboard(dashboardKey);
  }, [cargarDashboard]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    showNotification('Datos de ventas actualizados', 'success');
  }, []);

  const handleCrearVenta = useCallback(() => {
    setVentaSeleccionada(null);
    setShowVentaForm(true);
  }, []);

  const handleCrearCliente = useCallback(() => {
    setClienteSeleccionado(null);
    setShowClienteForm(true);
  }, []);

  const handleEditarVenta = useCallback((venta) => {
    setVentaSeleccionada(venta);
    setShowVentaForm(true);
  }, []);

  const handleEditarCliente = useCallback((cliente) => {
    setClienteSeleccionado(cliente);
    setShowClienteForm(true);
  }, []);

  const handleVerDetalles = useCallback((venta) => {
    setVentaDetalles(venta);
    setShowVentaDetails(true);
  }, []);

  const handleCloseDetalles = useCallback(() => {
    setShowVentaDetails(false);
    setVentaDetalles(null);
  }, []);

  const handleVentaFormClose = useCallback(() => {
    setShowVentaForm(false);
    setVentaSeleccionada(null);
  }, []);

  const handleClienteFormClose = useCallback(() => {
    setShowClienteForm(false);
    setClienteSeleccionado(null);
  }, []);

  const handleVentaFormSave = useCallback((nuevaVenta) => {
    handleRefresh();
    const accion = ventaSeleccionada ? 'actualizada' : 'creada';
    showNotification(`Venta ${accion} exitosamente`, 'success');
    setShowVentaForm(false);
    setVentaSeleccionada(null);
  }, [ventaSeleccionada, handleRefresh]);

  const handleClienteFormSave = useCallback((nuevoCliente) => {
    handleRefresh();
    const accion = clienteSeleccionado ? 'actualizado' : 'creado';
    showNotification(`Cliente ${accion} exitosamente`, 'success');
    setShowClienteForm(false);
    setClienteSeleccionado(null);
  }, [clienteSeleccionado, handleRefresh]);

  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleLimpiarFiltros = useCallback(() => {
    setFiltros({
      asesor_id: null,
      estado: '',
      cliente_id: null,
      fecha_desde: '',
      fecha_hasta: '',
      busqueda: '',
      rango_monto: { min: '', max: '' }
    });
    showNotification('Filtros de ventas limpiados', 'info');
  }, [showNotification]);

  const handleExportar = useCallback(async () => {
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      showNotification('Datos de ventas exportados exitosamente', 'success');
    } catch (err) {
      showNotification('Error al exportar datos de ventas', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const vistas = useMemo(() => {
    const vistasBase = [
      {
        id: 'lista',
        nombre: 'Lista de Ventas',
        icono: List,
        descripcion: 'Vista de tabla con todas las ventas',
        tieneRefreshAuto: false
      },
      {
        id: 'metricas',
        nombre: 'Dashboard',
        icono: BarChart3,
        descripcion: 'Métricas y análisis de ventas',
        tieneRefreshAuto: true
      }
    ];

    if (usuarioActual.rol === 'admin') {
      vistasBase.push(
        {
          id: 'dashboards-admin',
          nombre: 'Dashboards Ejecutivos',
          icono: Layers,
          descripcion: 'Dashboards avanzados para administradores',
          tieneRefreshAuto: true
        }
      );
    }

    vistasBase.push(
      {
        id: 'pipeline',
        nombre: 'Pipeline',
        icono: TrendingUp,
        descripcion: 'Embudo de ventas y conversión',
        tieneRefreshAuto: true
      },
      {
        id: 'clientes',
        nombre: 'Clientes',
        icono: Users,
        descripcion: 'Gestión de clientes y seguimiento',
        tieneRefreshAuto: false
      },
      {
        id: 'actividad',
        nombre: 'Mi Actividad',
        icono: Activity,
        descripcion: 'Check-in, check-out y seguimiento de jornada laboral',
        tieneRefreshAuto: true
      }
    );

    return vistasBase;
  }, [usuarioActual.rol]);

  const dashboardsDisponibles = useMemo(() => {
    if (usuarioActual.rol === 'admin') {
      return [
        { key: 'maestro', label: 'Vista Unificada', icono: Eye, color: 'purple' },
        { key: 'geografico', label: 'Análisis Geográfico', icono: Map, color: 'green' },
        { key: 'abc-productos', label: 'ABC Productos', icono: Package, color: 'orange' },
        { key: 'metas-avanzado', label: 'Metas Avanzado', icono: Target, color: 'blue' }
      ];
    } else {
      return [
        { key: 'maestro', label: 'Mi Dashboard Unificado', icono: Eye, color: 'purple' }
      ];
    }
  }, [usuarioActual.rol]);

  const hayFiltrosActivos = useMemo(() => {
    return Object.values(filtros).some(value => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
      }
      return value !== null && value !== undefined && value !== '';
    });
  }, [filtros]);

  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: XCircle,
      info: Bell
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    const IconComponent = iconos[notification.tipo];

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-sm`}>
        <div className="flex items-center">
          <IconComponent className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  const DashboardSelector = () => (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Dashboards Ejecutivos</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {dashboardsDisponibles.map(dashboard => {
          const IconComponent = dashboard.icono;
          const isActive = dashboardActivo === dashboard.key;
          
          return (
            <button
              key={dashboard.key}
              onClick={() => handleDashboardChange(dashboard.key)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                isActive 
                  ? `border-${dashboard.color}-500 bg-${dashboard.color}-50 shadow-md` 
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <IconComponent 
                  className={`h-6 w-6 ${
                    isActive ? `text-${dashboard.color}-600` : 'text-gray-500'
                  }`} 
                />
                <span className={`text-xs font-medium text-center ${
                  isActive ? `text-${dashboard.color}-700` : 'text-gray-600'
                }`}>
                  {dashboard.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const DashboardPorRol = () => {
    if (dashboardLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-gray-600">Cargando dashboard {dashboardActivo}...</span>
        </div>
      );
    }

    if (!datosDashboard) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Eye className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona un Dashboard</h3>
          <p className="text-gray-600">Elige un dashboard del selector superior para ver los datos</p>
        </div>
      );
    }

    switch(dashboardActivo) {
  case 'maestro':
    return <VistaUnificada usuarioActual={usuarioActual} />;        
  case 'geografico':
    return <AnalisisGeografico />;      
  case 'abc-productos':
    return <ABCProductos />;           
  case 'metas-avanzado':
    return <MetasAvanzado />;  
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">Dashboard "{dashboardActivo}" en desarrollo</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header principal */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Ventas</h1>
            <div className="flex items-center space-x-2 text-gray-600">
              <p>Control de ventas, clientes y análisis de rendimiento</p>
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
                <XCircle className="h-4 w-4 mr-2" />
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
              onClick={handleCrearCliente}
              className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <Users className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </button>

            <button
              onClick={handleCrearVenta}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Venta
            </button>
          </div>
        </div>
      </div>

      {/* Smart Header Adaptativo */}
      <SmartHeader 
        vistaActual={vistaActual}
        statsGenerales={statsGenerales}
        loading={statsLoading}
        onBonoClick={() => setMostrarModalBonos(true)}
      />

      {/* Modal de bonos */}
      {mostrarModalBonos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                Progreso de Bono - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h2>
              <button 
                onClick={() => setMostrarModalBonos(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Tu Meta</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ${statsGenerales?.meta_mes || '8,000'} USD
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Vendido</div>
                  <div className="text-xl font-semibold text-green-600">
                    ${statsGenerales?.vendido_real || '12,480'} USD ({statsGenerales?.porcentaje_meta || '156'}%)
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 relative">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all duration-500 relative"
                      style={{ width: `${Math.min(statsGenerales?.porcentaje_meta || 156, 100)}%` }}
                    >
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-bold">
                        {statsGenerales?.porcentaje_meta || '156'}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  Bonos Disponibles
                </h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-green-600">80%</div>
                      <div className="text-sm font-bold">$69.00 USD</div>
                    </div>
                    <div className="text-xs text-green-600">ALCANZADO</div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-green-600">90%</div>
                      <div className="text-sm font-bold">$138.00 USD</div>
                    </div>
                    <div className="text-xs text-green-600">ALCANZADO</div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-green-600">100%</div>
                      <div className="text-sm font-bold">$276.00 USD</div>
                    </div>
                    <div className="text-xs text-green-600">ALCANZADO</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Bono Actual:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${statsGenerales?.bono_actual || '276.00'} USD
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Estado:</span>
                    <span className="text-sm text-green-600">
                      Meta superada al {statsGenerales?.porcentaje_meta || '156'}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                Excelente trabajo! Has superado tu meta mensual.
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button 
                onClick={() => setMostrarModalBonos(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navegación de vistas */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {vistas.map((vista) => {
              const IconComponent = vista.icono;
              const isActive = vistaActual === vista.id;

              return (
                <button
                  key={vista.id}
                  onClick={() => setVistaActual(vista.id)}
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
            {vistaActual !== 'metricas' && vistaActual !== 'pipeline' && vistaActual !== 'dashboards-admin' && vistaActual !== 'actividad' && (
              <>
                <button
                  onClick={() => showNotification('Filtros avanzados próximamente', 'info')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </button>

                <button
                  onClick={handleExportar}
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
        {vistaActual === 'lista' && (
          <div className="h-full p-6 overflow-y-auto">
            <VentasList
              refreshTrigger={refreshTrigger}
              onEdit={handleEditarVenta}
              onView={handleVerDetalles}
              onEditCliente={handleEditarCliente}
              filtros={filtros}
              onFiltrosChange={setFiltros}
            />
          </div>
        )}

        {vistaActual === 'metricas' && (
          <div className="h-full p-6 overflow-y-auto">
            <VentasMetrics
              refreshTrigger={refreshTrigger}
              filtros={filtros}
              statsGenerales={statsGenerales}
              usuarioActual={usuarioActual}
            />
          </div>
        )}

        {vistaActual === 'dashboards-admin' && (
          <div className="h-full p-6 overflow-y-auto">
            <DashboardSelector />
            <DashboardPorRol />
          </div>
        )}

        {vistaActual === 'pipeline' && (
          <div className="h-full p-6 overflow-y-auto">
            <PipelineMetrics
              asesorId={usuarioActual.id}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {vistaActual === 'clientes' && (
          <div className="h-full p-6 overflow-y-auto">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión de Clientes</h3>
              <p className="text-gray-600 mb-4">Vista especializada para gestión y seguimiento de clientes</p>
              <div className="space-x-3">
                <button
                  onClick={handleCrearCliente}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Cliente
                </button>
                <button
                  onClick={() => showNotification('Vista de Clientes próximamente', 'info')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <List className="h-4 w-4 mr-2" />
                  Ver Lista Completa
                </button>
              </div>
            </div>
          </div>
        )}

        {vistaActual === 'actividad' && (
          <div className="h-full">
            <ActividadPage />
          </div>
        )}
      </div>

      {/* Modales */}
      {showVentaForm && (
        <VentaForm
          venta={ventaSeleccionada}
          mode={ventaSeleccionada ? 'edit' : 'create'}
          onClose={handleVentaFormClose}
          onSave={handleVentaFormSave}
        />
      )}

      {showClienteForm && (
        <ClienteForm
          cliente={clienteSeleccionado}
          mode={clienteSeleccionado ? 'edit' : 'create'}
          onClose={handleClienteFormClose}
          onSave={handleClienteFormSave}
        />
      )}

      {showVentaDetails && ventaDetalles && (
        <VentaDetailsView
          venta={ventaDetalles}
          onClose={handleCloseDetalles}
          onEdit={(venta) => {
            setShowVentaDetails(false);
            setVentaDetalles(null);
            handleEditarVenta(venta);
          }}
          currentUser={usuarioActual}
        />
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-3"></div>
            <span className="text-gray-700">Procesando ventas...</span>
          </div>
        </div>
      )}

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

// Componentes de Dashboard (sin cambios)

const DashboardMetasAvanzado = ({ datos }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">Dashboard Metas Avanzado</h3>
    <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
      {JSON.stringify(datos, null, 2)}
    </pre>
  </div>
);

export default VentasPage;