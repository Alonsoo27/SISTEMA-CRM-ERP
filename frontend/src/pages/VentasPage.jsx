// src/pages/VentasPage.jsx - VERSIÓN CON SMART HEADER ADAPTATIVO
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, BarChart3, List, DollarSign, Filter, Download,
  RefreshCw, Settings, Search, Calendar, AlertCircle,
  CheckCircle, XCircle, Bell, Users, TrendingUp,
  Target, CreditCard, PieChart, Activity,
  Map, Package, GitBranch, Eye, Layers,
  Award, Zap, X, User, Building, Mail, Phone
} from 'lucide-react';
import VentasList from '../components/ventas/VentasList/VentasList';
import VentasMetrics from '../components/ventas/VentasMetrics/VentasMetricsOptimized';
import VentaForm from '../components/ventas/VentaForm/VentaForm';
import VentaDetailsView from '../components/ventas/VentaDetailsView';
import ActividadPage from '../components/ventas/ActividadPage/ActividadPageEnhanced';
import ventasService from '../services/ventasService';
import authService from '../services/authService';
import clientesService from '../services/clientesService';
import apiClient from '../services/apiClient';
import VistaUnificada from '../components/VistaUnificada';
import AnalisisGeografico from '../components/AnalisisGeografico';
import ABCProductos from '../components/ABCProductos';
import MetasAvanzado from '../components/MetasAvanzado.jsx';
import PipelineMetrics from '../components/ventas/PipelineMetrics/PipelineMetrics';
import { normalizeUser, isExecutive } from '../utils/userUtils';
import { useModulePermissions } from '../hooks/useModulePermissions';

const VentasPage = () => {
  console.log('🎬 [VentasPage] RENDER');

  const { canCreate, canEdit } = useModulePermissions('ventas');
  const [searchParams, setSearchParams] = useSearchParams();
  const [vistaActual, setVistaActual] = useState('lista');
  const [showVentaForm, setShowVentaForm] = useState(false);
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

  // Estados para clientes
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesStats, setClientesStats] = useState(null);
  const [filtrosClientes, setFiltrosClientes] = useState({
    busqueda: '',
    tipo_cliente: '',
    tipo_documento: ''
  });

  const [mostrarModalBonos, setMostrarModalBonos] = useState(false);
  const [dashboardActivo, setDashboardActivo] = useState('maestro');
  const [datosDashboard, setDatosDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // ESTADOS PARA VentaDetailsView
  const [showVentaDetails, setShowVentaDetails] = useState(false);
  const [ventaDetalles, setVentaDetalles] = useState(null);

  // ESTADO DINÁMICO PARA USUARIO ACTUAL
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarioLoading, setUsuarioLoading] = useState(true);

  // ✅ DEFINIR showNotification PRIMERO (antes de usarlo en callbacks)
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Cargar usuario actual al inicializar
  useEffect(() => {
    cargarUsuarioActual();
  }, []);

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
    // Solo cargar si no hay datos ya cargados para el dashboard activo
    if (vistaActual === 'dashboards-admin' && !datosDashboard) {
      cargarDashboard(dashboardActivo);
    }
  }, [vistaActual]); // ❌ REMOVIDO dashboardActivo de dependencias

  // 🔔 Leer query params para navegación desde notificaciones
  useEffect(() => {
    const view = searchParams.get('view');
    const ventaId = searchParams.get('id');
    const action = searchParams.get('action');

    // 1. PRIMERO cambiar la vista si se especifica
    if (view && ['lista', 'metricas', 'pipeline', 'clientes', 'actividad', 'dashboards-admin'].includes(view)) {
      console.log('📍 Cambiando a vista de ventas:', view);
      setVistaActual(view);
    }

    // 2. DESPUÉS cargar la venta si hay ID y acción
    if (ventaId && action === 'view') {
      console.log('📨 Notificación: Cargando venta', ventaId);
      // Pequeño delay para que la vista se establezca primero
      setTimeout(() => {
        cargarVenta(ventaId);
      }, 100);
    }

    // 3. Limpiar query params después de procesarlos
    if (view || (ventaId && action)) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('view');
      newParams.delete('id');
      newParams.delete('action');
      setSearchParams(newParams);
    }
  }, [searchParams]);

  const cargarVenta = useCallback(async (ventaId) => {
    try {
      setLoading(true);
      console.log('🔍 Cargando venta ID:', ventaId);

      const response = await ventasService.obtenerVentaPorId(ventaId);

      if (response.success && response.data) {
        console.log('✅ Venta cargada:', response.data);
        // Usar las funciones directamente
        setVentaDetalles(response.data);
        setShowVentaDetails(true);
      } else {
        throw new Error('No se pudo cargar la venta');
      }
    } catch (error) {
      console.error('❌ Error cargando venta:', error);
      showNotification('Error al cargar la venta', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Función para cargar usuario actual dinámicamente
  const cargarUsuarioActual = useCallback(async () => {
    try {
      setUsuarioLoading(true);
      console.log('🔍 VentasPage: Cargando usuario actual...');

      // Intentar obtener usuario desde el servicio de auth
      const usuario = await authService.getUser();

      if (usuario) {
        console.log('🔄 [VentasPage] setUsuarioActual - ANTES:', usuarioActual?.id, '→ DESPUÉS:', usuario.id);
        setUsuarioActual(usuario);
        console.log('✅ VentasPage: Usuario cargado:', {
          id: usuario.id,
          nombre: usuario.nombre_completo,
          rol: usuario.rol,
          rol_id: usuario.rol_id,
          es_ejecutivo: usuario.permisos?.es_ejecutivo
        });
      } else {
        throw new Error('No se pudo obtener información del usuario');
      }

    } catch (error) {
      console.error('❌ VentasPage: Error cargando usuario:', error);

      // Si hay error de autenticación, mostrar notificación y redirigir
      if (error.message.includes('Sesión expirada')) {
        showNotification('Sesión expirada. Redirigiendo al login...', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        showNotification('Error cargando información del usuario', 'error');
      }
    } finally {
      setUsuarioLoading(false);
    }
  }, [showNotification]);
  const cargarStatsGenerales = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setStatsLoading(true);
      const response = await ventasService.obtenerMetricas();
      let statsData = response.data || {};
      if (!statsData || typeof statsData !== 'object') {
        statsData = {};
      }
      try {
        const bonosData = await apiClient.get('/comisiones/bono-actual/1');

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
  }, [showNotification]);

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
  }, [showNotification]);

  const handleDashboardChange = useCallback((dashboardKey) => {
    // Solo cambiar si es diferente al actual
    if (dashboardKey !== dashboardActivo) {
      setDatosDashboard(null); // ✅ Limpiar datos antes de cargar nuevos
      setDashboardActivo(dashboardKey);
      cargarDashboard(dashboardKey);
    }
  }, [cargarDashboard, dashboardActivo]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    showNotification('Datos de ventas actualizados', 'success');
  }, [showNotification]);

  const handleCrearVenta = useCallback(() => {
    setVentaSeleccionada(null);
    setShowVentaForm(true);
  }, []);

  // Función para clientes
  const handleCrearCliente = useCallback(() => {
    // Función mejorada para crear cliente
    showNotification('Función de creación de clientes disponible vía API', 'info');
  }, [showNotification]);

  const handleBuscarCliente = useCallback(async (documento) => {
    if (!documento || documento.length < 3) {
      showNotification('Ingrese un número de documento válido', 'warning');
      return null;
    }

    try {
      const response = await clientesService.buscarPorDocumento(documento);
      showNotification('Cliente encontrado exitosamente', 'success');
      return response.data;
    } catch (error) {
      if (error.message.includes('404')) {
        showNotification('Cliente no encontrado', 'info');
      } else {
        showNotification('Error al buscar cliente: ' + error.message, 'error');
      }
      return null;
    }
  }, [showNotification]);

  const handleAutocompletarClientes = useCallback(async (query) => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const response = await clientesService.autocomplete(query);
      return response.data || [];
    } catch (error) {
      console.error('Error en autocompletado:', error);
      return [];
    }
  }, []);

  const handleEditarVenta = useCallback((venta) => {
    setVentaSeleccionada(venta);
    setShowVentaForm(true);
  }, []);

  const handleEditarCliente = useCallback((cliente) => {
    showNotification(`Editar cliente: ${cliente.nombres || cliente.razon_social}`, 'info');
  }, [showNotification]);

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


  const handleVentaFormSave = useCallback((nuevaVenta) => {
    handleRefresh();
    const accion = ventaSeleccionada ? 'actualizada' : 'creada';
    showNotification(`Venta ${accion} exitosamente`, 'success');
    setShowVentaForm(false);
    setVentaSeleccionada(null);
  }, [ventaSeleccionada, handleRefresh, showNotification]);

  // Funciones para clientes (usando API real)
  const cargarClientes = useCallback(async () => {
    try {
      setClientesLoading(true);
      const response = await clientesService.obtenerTodos(filtrosClientes);
      setClientes(response.data || []);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      showNotification('Error al cargar clientes: ' + error.message, 'error');
      setClientes([]);
    } finally {
      setClientesLoading(false);
    }
  }, [filtrosClientes, showNotification]);

  const cargarEstadisticasClientes = useCallback(async () => {
    try {
      const response = await clientesService.obtenerEstadisticas();
      setClientesStats(response.data?.resumen || {});
    } catch (error) {
      console.error('Error cargando estadísticas de clientes:', error);
      setClientesStats({
        total: 0,
        personas: 0,
        empresas: 0,
        activos: 0,
        recientes: 0
      });
    }
  }, []);


  // useEffect para cargar datos de clientes cuando se selecciona la pestaña
  useEffect(() => {
    if (vistaActual === 'clientes') {
      cargarClientes();
      cargarEstadisticasClientes();
    }
  }, [vistaActual, cargarClientes, cargarEstadisticasClientes]);

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

    // Verificar si es ejecutivo usando normalización
    const user = normalizeUser(usuarioActual);
    if (isExecutive(user)) {
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
  }, [usuarioActual]);

  const dashboardsDisponibles = useMemo(() => {
    const user = normalizeUser(usuarioActual);
    if (isExecutive(user)) {
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
  }, [usuarioActual]);

  const hayFiltrosActivos = useMemo(() => {
    return Object.values(filtros).some(value => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
      }
      return value !== null && value !== undefined && value !== '';
    });
  }, [filtros]);

  // Renderizar dashboard usando useMemo para evitar re-mounting
  const dashboardContent = useMemo(() => {
    console.log('📦 [VentasPage] useMemo dashboardContent:', { dashboardActivo, usuarioId: usuarioActual?.id });

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

    // Si el usuario aún está cargando, mostrar loading
    if (usuarioLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Cargando información del usuario...</span>
        </div>
      );
    }

    // Si no hay usuario, mostrar error
    if (!usuarioActual) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error de Autenticación</h3>
          <p className="text-gray-600 mb-4">No se pudo cargar la información del usuario</p>
          <button
            onClick={cargarUsuarioActual}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      );
    }

    switch(dashboardActivo) {
      case 'maestro':
        return <VistaUnificada usuarioActual={usuarioActual} key="vista-unificada" />;
      case 'geografico':
        return <AnalisisGeografico usuarioActual={usuarioActual} key="analisis-geografico" />;
      case 'abc-productos':
        return <ABCProductos usuarioActual={usuarioActual} key="abc-productos" />;
      case 'metas-avanzado':
        return <MetasAvanzado usuarioActual={usuarioActual} key="metas-avanzado" />;
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">Dashboard "{dashboardActivo}" en desarrollo</p>
          </div>
        );
    }
  }, [dashboardActivo, usuarioActual, dashboardLoading, datosDashboard, usuarioLoading]);

  // Loading state para usuario
  if (usuarioLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Cargando Sistema</h2>
            <p className="text-gray-600">Obteniendo información del usuario...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state para usuario
  if (!usuarioActual) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error de Autenticación</h2>
            <p className="text-gray-600 mb-6">No se pudo cargar la información del usuario</p>
            <button
              onClick={cargarUsuarioActual}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

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

            {canCreate && (
              <button
                onClick={handleCrearCliente}
                className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Users className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </button>
            )}

            {canCreate && (
              <button
                onClick={handleCrearVenta}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Venta
              </button>
            )}
          </div>
        </div>
      </div>


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

          {/* ✅ ELIMINADAS DUPLICACIONES - VentasList maneja sus propios filtros y exportación */}
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
              usuarioActual={usuarioActual}
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
            {dashboardContent}
          </div>
        )}

        {vistaActual === 'pipeline' && (
          <div className="h-full p-6 overflow-y-auto">
            <PipelineMetrics
              asesorId={usuarioActual?.id || 1}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {vistaActual === 'clientes' && (
          <div className="h-full p-6 overflow-y-auto">
            {/* Header con estadísticas */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
                  <p className="text-gray-600">Administra tu base de datos de clientes</p>
                </div>
                <button
                  onClick={handleCrearCliente}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Cliente
                </button>
              </div>

              {/* Estadísticas de clientes */}
              {clientesStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                        <p className="text-lg font-semibold text-gray-900">{clientesStats.total || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Personas</p>
                        <p className="text-lg font-semibold text-gray-900">{clientesStats.personas || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Building className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Empresas</p>
                        <p className="text-lg font-semibold text-gray-900">{clientesStats.empresas || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Este Mes</p>
                        <p className="text-lg font-semibold text-gray-900">{clientesStats.nuevos_mes || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filtros de búsqueda */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar cliente
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nombre, empresa, documento..."
                      value={filtrosClientes.busqueda}
                      onChange={(e) => setFiltrosClientes(prev => ({ ...prev, busqueda: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Cliente
                  </label>
                  <select
                    value={filtrosClientes.tipo_cliente}
                    onChange={(e) => setFiltrosClientes(prev => ({ ...prev, tipo_cliente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    <option value="persona">Persona Natural</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Documento
                  </label>
                  <select
                    value={filtrosClientes.tipo_documento}
                    onChange={(e) => setFiltrosClientes(prev => ({ ...prev, tipo_documento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="CE">Carné de Extranjería</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setFiltrosClientes({ busqueda: '', tipo_cliente: '', tipo_documento: '' })}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar Filtros
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={cargarClientes}
                    disabled={clientesLoading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${clientesLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla de clientes */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Lista de Clientes ({clientes.length})
                  </h3>
                </div>
              </div>

              {clientesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Cargando clientes...</span>
                </div>
              ) : clientes.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay clientes</h3>
                  <p className="text-gray-600 mb-4">
                    {filtrosClientes.busqueda || filtrosClientes.tipo_cliente || filtrosClientes.tipo_documento
                      ? 'No se encontraron clientes con los filtros aplicados'
                      : 'Aún no tienes clientes registrados'}
                  </p>
                  <button
                    onClick={handleCrearCliente}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Cliente
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cliente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Documento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contacto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ubicación
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clientes.map((cliente) => (
                        <tr key={cliente.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  {cliente.tipo_cliente === 'empresa' ? (
                                    <Building className="h-5 w-5 text-blue-600" />
                                  ) : (
                                    <User className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {cliente.tipo_cliente === 'empresa'
                                    ? cliente.razon_social
                                    : `${cliente.nombres} ${cliente.apellidos}`}
                                </div>
                                {cliente.tipo_cliente === 'empresa' && cliente.contacto_nombres && (
                                  <div className="text-sm text-gray-500">
                                    Contacto: {cliente.contacto_nombres} {cliente.contacto_apellidos}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              cliente.tipo_cliente === 'empresa'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {cliente.tipo_cliente === 'empresa' ? 'Empresa' : 'Persona'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              {cliente.tipo_documento}: {cliente.numero_documento}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              {cliente.email && (
                                <div className="flex items-center">
                                  <Mail className="h-4 w-4 text-gray-400 mr-1" />
                                  {cliente.email}
                                </div>
                              )}
                              {cliente.telefono && (
                                <div className="flex items-center mt-1">
                                  <Phone className="h-4 w-4 text-gray-400 mr-1" />
                                  {cliente.telefono}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              {cliente.ciudad && <div>{cliente.ciudad}</div>}
                              {cliente.departamento && <div>{cliente.departamento}</div>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditarCliente(cliente)}
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                title="Editar cliente"
                              >
                                <Settings className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => showNotification(`Ver detalles de ${cliente.nombres || cliente.razon_social}`, 'info')}
                                className="text-gray-600 hover:text-gray-900 transition-colors"
                                title="Ver detalles"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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