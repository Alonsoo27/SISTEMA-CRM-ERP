import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Target,
  Award, Calendar, BarChart3, PieChart, User,
  RefreshCw, Download, AlertCircle, CheckCircle,
  Star, ArrowUp, ArrowDown, Minus, Trophy,
  Clock, Zap, Medal, MapPin, Maximize, Minimize,
  Eye, Monitor, MessageCircle, Phone, Users,
  Activity, TrendingDown as TrendDown, Globe,
  Building, Briefcase, Timer, BarChart,
  LineChart, Filter, ChevronUp, ChevronDown
} from 'lucide-react';

// Importar configuraciones optimizadas
import { API_CONFIG, DASHBOARD_CONFIG, ROLES_CONFIG, ENDPOINTS } from '../../../config/dashboardConfig';
import PeriodSelectorAdvanced from '../PeriodSelector/PeriodSelectorAdvanced';
import BonoProyectado from '../BonoProyectado';
import {
  fetchWithErrorHandling,
  cargarDatosDashboard,
  formatearMonto,
  obtenerIconoTendencia,
  obtenerColorTendencia,
  determinarModoVistaInicial,
  puedeAlternarModos,
  activarFullscreen,
  desactivarFullscreen,
  calcularPorcentajeCanal,
  calcularPorcentajeMeta,
  getCachedData,
  setCachedData
} from '../../../utils/dashboardUtils';

const DashboardAsesoresOptimized = ({
  usuarioActual,
  refreshTrigger = 0
}) => {
  // Estados principales
  const [metricas, setMetricas] = useState(null);
  const [metasInfo, setMetasInfo] = useState(null);
  const [datosGeografia, setDatosGeografia] = useState([]);
  const [datosSectores, setDatosSectores] = useState([]);
  const [datosRanking, setDatosRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [notification, setNotification] = useState(null);

  // Estados para el selector de asesores
  const [asesorSeleccionado, setAsesorSeleccionado] = useState(usuarioActual?.id);
  const [asesoresDisponibles, setAsesoresDisponibles] = useState([]);
  const [modoVista, setModoVista] = useState('propio');
  const [loadingAsesores, setLoadingAsesores] = useState(false);

  // Estado para modo pantalla completa
  const [modoFullscreen, setModoFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Memoizar valores computados para evitar re-renders
  const { userVende, userRole } = useMemo(() => ({
    userVende: usuarioActual?.vende,
    userRole: usuarioActual?.rol_id
  }), [usuarioActual?.vende, usuarioActual?.rol_id]);

  const puedeToggleModos = useMemo(() =>
    puedeAlternarModos(usuarioActual),
    [usuarioActual]
  );

  // Funciones para manejo de pantalla completa
  const toggleFullscreen = useCallback(() => {
    if (!modoFullscreen) {
      activarFullscreen();
      setAutoRefresh(true);
    } else {
      desactivarFullscreen();
      setAutoRefresh(false);
    }
    setModoFullscreen(!modoFullscreen);
  }, [modoFullscreen]);

  // Función para mostrar notificaciones
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), DASHBOARD_CONFIG.AUTO_REFRESH_INTERVAL);
  }, []);

  // Determinar modo de vista según permisos del usuario
  const determinarModoVista = useCallback(() => {
    const { modo, asesorSeleccionado: asesorInicial } = determinarModoVistaInicial(usuarioActual);
    setModoVista(modo);
    setAsesorSeleccionado(asesorInicial);
    return modo;
  }, [usuarioActual]);

  // Cargar lista de asesores supervisables
  const cargarAsesores = useCallback(async () => {
    try {
      setLoadingAsesores(true);
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('Token no encontrado');
        return;
      }

      const resultado = await fetchWithErrorHandling(
        ENDPOINTS.ASESORES_SUPERVISABLES,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (resultado.success) {
        const asesores = resultado.data?.data?.asesores || resultado.data?.asesores || [];
        setAsesoresDisponibles(asesores);
        console.log('✅ Asesores cargados:', asesores.length);
      } else {
        console.error('Error cargando asesores:', resultado.error);
      }

    } catch (error) {
      console.error('Error cargando asesores:', error);
    } finally {
      setLoadingAsesores(false);
    }
  }, []);

  // Cambiar asesor seleccionado
  const cambiarAsesor = useCallback((nuevoAsesorId) => {
    if (nuevoAsesorId !== asesorSeleccionado) {
      setAsesorSeleccionado(nuevoAsesorId);
      // Limpiar datos para forzar recarga
      setMetricas(null);
      setMetasInfo(null);
      setDatosGeografia([]);
      setDatosSectores([]);
      setDatosRanking(null);
    }
  }, [asesorSeleccionado]);

  // Toggle entre modo propio y supervisor
  const toggleModoVista = useCallback(() => {
    if (!puedeToggleModos) return;

    if (modoVista === 'propio') {
      setModoVista('supervisor');
      setAsesorSeleccionado(null);
    } else {
      setModoVista('propio');
      setAsesorSeleccionado(usuarioActual?.id);
    }

    // Limpiar datos para forzar recarga
    setMetricas(null);
    setMetasInfo(null);
    setDatosGeografia([]);
    setDatosSectores([]);
    setDatosRanking(null);
  }, [modoVista, usuarioActual, puedeToggleModos]);

  // Cargar métricas del asesor (OPTIMIZADO)
  const cargarMetricas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Validación: No cargar si no hay asesor seleccionado
      if (!asesorSeleccionado) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token de autenticación no encontrado');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Verificar cache (solo en producción)
      const cacheKey = `dashboard_${asesorSeleccionado}_${periodoSeleccionado}`;
      const datosCache = API_CONFIG.ENABLE_CACHE ? getCachedData(cacheKey) : null;

      if (datosCache && !autoRefresh) {
        setMetricas(datosCache.dashboard);
        setMetasInfo(datosCache.metas);
        setDatosGeografia(datosCache.geografia?.geografiaData || []);
        setDatosSectores(datosCache.sectores?.sectoresData || []);
        setDatosRanking(datosCache.ranking?.rankingData);
        setLoading(false);
        showNotification('Datos cargados desde cache', 'info');
        return;
      }

      console.log(`🔄 Cargando dashboard para asesor ${asesorSeleccionado} en modo ${modoVista}`);

      // No cargar bono - BonoProyectado se encarga de su propia carga
      const cargarBono = false;

      // Usar la función optimizada de carga
      const datos = await cargarDatosDashboard(asesorSeleccionado, periodoSeleccionado, headers, cargarBono);

      // Procesar resultados
      if (datos.dashboard) setMetricas(datos.dashboard);
      if (datos.metas) setMetasInfo(datos.metas);
      if (datos.geografia) setDatosGeografia(datos.geografia.geografiaData || []);
      if (datos.sectores) setDatosSectores(datos.sectores.sectoresData || []);
      if (datos.ranking) setDatosRanking(datos.ranking.rankingData);

      // Guardar en cache si está habilitado
      if (API_CONFIG.ENABLE_CACHE) {
        setCachedData(cacheKey, datos);
      }

      // Reportar errores si los hay
      if (datos.errores.length > 0) {
        console.warn('⚠️ Algunos endpoints fallaron:', datos.errores);
      }

      if (!autoRefresh) {
        showNotification('Dashboard actualizado correctamente', 'success');
      }

    } catch (err) {
      console.error('Error cargando dashboard:', err);
      setError(`Error de conexión: ${err.message}`);
      if (!autoRefresh) {
        showNotification('Error cargando datos del dashboard', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [asesorSeleccionado, periodoSeleccionado, autoRefresh, showNotification, modoVista]);

  // INICIALIZACIÓN - useEffect unificado y optimizado
  useEffect(() => {
    if (!usuarioActual?.id) return;

    // Determinar modo de vista inicial
    determinarModoVista();
    // Cargar lista de asesores supervisables
    cargarAsesores();
  }, [usuarioActual?.id, determinarModoVista, cargarAsesores]);

  // CARGA DE MÉTRICAS - useEffect consolidado
  useEffect(() => {
    if (asesorSeleccionado) {
      cargarMetricas();
    }
  }, [asesorSeleccionado, periodoSeleccionado, refreshTrigger, cargarMetricas]);

  // Auto-refresh en modo fullscreen
  useEffect(() => {
    if (!modoFullscreen || !autoRefresh) return;

    const interval = setInterval(() => {
      cargarMetricas();
    }, DASHBOARD_CONFIG.AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [modoFullscreen, autoRefresh, cargarMetricas]);

  // Escuchar tecla ESC para salir del modo fullscreen
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && modoFullscreen) {
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);

      // Cleanup al desmontar el componente
      if (modoFullscreen) {
        desactivarFullscreen();
      }
    };
  }, [modoFullscreen, toggleFullscreen]);

  // Componente de notificación
  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle
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

  // Estados de carga y error
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error cargando dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarMetricas}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Determinar nombre del asesor actual
  const asesorActual = asesoresDisponibles.find(a => a.id === asesorSeleccionado);
  const nombreAsesorActual = asesorActual?.nombre_completo || usuarioActual?.nombre || 'Cargando...';

  if (!asesorSeleccionado && modoVista === 'supervisor') {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Eye className="h-16 w-16 mx-auto text-blue-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Selecciona un Asesor</h3>
        <p className="text-gray-600 mb-6">Elige un asesor para ver su dashboard personal</p>

        {loadingAsesores ? (
          <div className="flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span>Cargando asesores...</span>
          </div>
        ) : asesoresDisponibles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {asesoresDisponibles.map(asesor => (
              <button
                key={asesor.id}
                onClick={() => cambiarAsesor(asesor.id)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center mb-2">
                  <User className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="font-medium text-gray-900">{asesor.nombre_completo}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>{asesor.rol}</p>
                  {asesor.metricas?.porcentaje_meta > 0 && (
                    <p className="text-green-600">Meta: {asesor.metricas.porcentaje_meta}%</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No hay asesores disponibles para supervisar</p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${modoFullscreen ? 'p-8' : ''}`} data-dashboard>
      {/* Header Dinámico */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-bold ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
              {modoVista === 'propio' ? 'Mi Dashboard Personal' : `Dashboard de ${nombreAsesorActual}`}
            </h2>
            <p className={`text-blue-100 ${modoFullscreen ? 'text-xl' : ''}`}>
              {modoVista === 'propio'
                ? `Hola, ${usuarioActual?.nombre}! Aquí tienes tus métricas y progreso`
                : `Supervisando el rendimiento de ${nombreAsesorActual}`
              }
            </p>
            {modoFullscreen && autoRefresh && (
              <div className="flex items-center mt-2 text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm">Actualización automática cada 30s • Presiona ESC para salir</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Toggle de Modo (solo para usuarios que venden) */}
            {puedeToggleModos && (
              <button
                onClick={toggleModoVista}
                className={`inline-flex items-center px-3 py-2 border border-blue-400 rounded-md text-white hover:bg-blue-700 transition-colors ${
                  modoFullscreen ? 'px-4 py-3' : ''
                }`}
                title={modoVista === 'propio' ? 'Cambiar a modo supervisor' : 'Ver mi dashboard personal'}
              >
                {modoVista === 'propio' ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Supervisar
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    Mi Dashboard
                  </>
                )}
              </button>
            )}

            {/* Selector de Asesor (modo supervisor) */}
            {modoVista === 'supervisor' && asesoresDisponibles.length > 0 && (
              <select
                value={asesorSeleccionado || ''}
                onChange={(e) => cambiarAsesor(parseInt(e.target.value))}
                className={`border border-blue-400 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 ${
                  modoFullscreen ? 'text-lg px-4 py-3' : ''
                }`}
                disabled={loadingAsesores}
              >
                <option value="">Seleccionar asesor...</option>
                {asesoresDisponibles.map(asesor => (
                  <option key={asesor.id} value={asesor.id}>
                    {asesor.nombre_completo} ({asesor.rol})
                  </option>
                ))}
              </select>
            )}

            {/* Selector simple para todos los modos */}
            <select
              value={periodoSeleccionado}
              onChange={(e) => setPeriodoSeleccionado(e.target.value)}
              className={`border border-blue-400 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 ${
                modoFullscreen ? 'text-lg px-4 py-3' : ''
              }`}
            >
              {DASHBOARD_CONFIG.PERIODOS_DISPONIBLES.map(periodo => (
                <option key={periodo.value} value={periodo.value}>
                  {periodo.label}
                </option>
              ))}
            </select>

            {/* Botón fullscreen */}
            <button
              onClick={toggleFullscreen}
              className={`inline-flex items-center px-3 py-2 border border-blue-400 rounded-md text-white hover:bg-blue-700 transition-colors ${
                modoFullscreen ? 'bg-blue-700 px-4 py-3' : ''
              }`}
              title={modoFullscreen ? 'Salir de pantalla completa (ESC)' : 'Ver en pantalla completa'}
            >
              {modoFullscreen ? (
                <>
                  <Minimize className="h-4 w-4 mr-2" />
                  Salir
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4 mr-2" />
                  Pantalla Completa
                </>
              )}
            </button>

            {/* Botón exportar */}
            <button
              onClick={() => showNotification('Reporte generado correctamente', 'success')}
              className={`inline-flex items-center px-3 py-2 border border-blue-400 rounded-md text-white hover:bg-blue-700 transition-colors ${
                modoFullscreen ? 'px-4 py-3' : ''
              }`}
            >
              <Download className={`h-4 w-4 mr-2`} />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Períodos Avanzado - Solo en modo normal */}
      {!modoFullscreen && asesorSeleccionado && (
        <div className="max-w-2xl">
          <PeriodSelectorAdvanced
            asesorId={asesorSeleccionado}
            onPeriodChange={setPeriodoSeleccionado}
            initialPeriod={periodoSeleccionado}
            loading={loading}
          />
        </div>
      )}

      {/* Métricas principales expandidas */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 ${modoFullscreen ? 'gap-6' : ''}`}>
        {/* Mis Ventas */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Mis Ventas
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.ventas?.completadas || 0}
              </p>
              <div className="flex items-center mt-1">
                {obtenerIconoTendencia(metricas?.tendencias?.ventas_completadas) && (
                  <ArrowUp className={`h-3 w-3 ${obtenerIconoTendencia(metricas?.tendencias?.ventas_completadas).color}`} />
                )}
                <span className={`ml-1 ${obtenerColorTendencia(metricas?.tendencias?.ventas_completadas)} ${
                  modoFullscreen ? 'text-sm' : 'text-xs'
                }`}>
                  {metricas?.tendencias?.ventas_completadas > 0 ? '+' : ''}{metricas?.tendencias?.ventas_completadas}%
                </span>
              </div>
            </div>
            <div className={`bg-blue-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <DollarSign className={`text-blue-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>

        {/* Ingresos */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Ingresos
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {formatearMonto(metricas?.ventas?.valor_total)}
              </p>
              <div className="flex items-center mt-1">
                {obtenerIconoTendencia(metricas?.tendencias?.valor_total_completadas) && (
                  <ArrowUp className={`h-3 w-3 ${obtenerIconoTendencia(metricas?.tendencias?.valor_total_completadas).color}`} />
                )}
                <span className={`ml-1 ${obtenerColorTendencia(metricas?.tendencias?.valor_total_completadas)} ${
                  modoFullscreen ? 'text-sm' : 'text-xs'
                }`}>
                  {metricas?.tendencias?.valor_total_completadas > 0 ? '+' : ''}{metricas?.tendencias?.valor_total_completadas}%
                </span>
              </div>
            </div>
            <div className={`bg-green-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <Target className={`text-green-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>

        {/* Tasa Conversión */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Tasa Conversión
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.pipeline?.tasa_conversion || 0}%
              </p>
              <div className="flex items-center mt-1">
                <Activity className={`h-3 w-3 ${metricas?.pipeline?.tasa_conversion >= 20 ? 'text-green-500' : 'text-yellow-500'}`} />
                <span className={`ml-1 text-xs ${
                  metricas?.pipeline?.tasa_conversion >= 20 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {metricas?.pipeline?.total_oportunidades || 0} oportunidades
                </span>
              </div>
            </div>
            <div className={`bg-purple-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <BarChart className={`text-purple-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Ticket Promedio
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {formatearMonto(metricas?.ventas?.promedio_venta)}
              </p>
              <div className="flex items-center mt-1">
                {obtenerIconoTendencia(metricas?.tendencias?.promedio_venta) && (
                  <ArrowUp className={`h-3 w-3 ${obtenerIconoTendencia(metricas?.tendencias?.promedio_venta).color}`} />
                )}
                <span className={`ml-1 ${obtenerColorTendencia(metricas?.tendencias?.promedio_venta)} ${
                  modoFullscreen ? 'text-sm' : 'text-xs'
                }`}>
                  {metricas?.tendencias?.promedio_venta > 0 ? '+' : ''}{metricas?.tendencias?.promedio_venta}%
                </span>
              </div>
            </div>
            <div className={`bg-yellow-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <Star className={`text-yellow-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>

        {/* Clientes Únicos */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Clientes Únicos
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.mercado?.clientes_unicos || 0}
              </p>
              <div className="flex items-center mt-1">
                <Users className="h-3 w-3 text-blue-500" />
                <span className={`ml-1 text-blue-600 ${modoFullscreen ? 'text-sm' : 'text-xs'}`}>
                  {metricas?.mercado?.ciudades_atendidas || 0} ciudades
                </span>
              </div>
            </div>
            <div className={`bg-indigo-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <Users className={`text-indigo-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>

        {/* Actividad Diaria */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Actividad Diaria
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.actividad?.dias_activos || 0}
              </p>
              <div className="flex items-center mt-1">
                <Activity className="h-3 w-3 text-green-500" />
                <span className={`ml-1 text-green-600 ${modoFullscreen ? 'text-sm' : 'text-xs'}`}>
                  días activos
                </span>
              </div>
            </div>
            <div className={`bg-green-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <Activity className={`text-green-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>

        {/* Bono Actual - Componente Dinámico */}
        <BonoProyectado asesorId={asesorSeleccionado} />
      </div>

      {/* Análisis de Canales de Venta */}
      <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`font-bold text-gray-900 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              Mis Canales de Venta
            </h3>
            <p className={`text-gray-600 ${modoFullscreen ? 'text-lg' : ''}`}>
              Distribución de ventas por canal de comunicación
            </p>
          </div>
          <Briefcase className={`text-blue-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${modoFullscreen ? 'gap-8' : ''}`}>
          {/* WhatsApp */}
          <div className={`bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`bg-green-500 rounded-full p-3 ${modoFullscreen ? 'p-4' : ''}`}>
                  <MessageCircle className={`text-white ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
                </div>
                <div className="ml-4">
                  <h4 className={`font-semibold text-green-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                    WhatsApp
                  </h4>
                  <p className={`text-green-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                    Canal principal
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-green-700">Ventas:</span>
                <span className="font-bold text-green-900">{metricas?.canales?.whatsapp || 0}</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-green-700">Porcentaje:</span>
                <span className="font-bold text-green-900">
                  {calcularPorcentajeCanal(metricas?.canales?.whatsapp, metricas?.ventas?.completadas)}%
                </span>
              </div>
              <div className={`w-full bg-green-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-green-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${calcularPorcentajeCanal(metricas?.canales?.whatsapp, metricas?.ventas?.completadas)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Llamadas */}
          <div className={`bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`bg-blue-500 rounded-full p-3 ${modoFullscreen ? 'p-4' : ''}`}>
                  <Phone className={`text-white ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
                </div>
                <div className="ml-4">
                  <h4 className={`font-semibold text-blue-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                    Llamadas
                  </h4>
                  <p className={`text-blue-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                    Contacto directo
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-blue-700">Ventas:</span>
                <span className="font-bold text-blue-900">{metricas?.canales?.llamadas || 0}</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-blue-700">Porcentaje:</span>
                <span className="font-bold text-blue-900">
                  {calcularPorcentajeCanal(metricas?.canales?.llamadas, metricas?.ventas?.completadas)}%
                </span>
              </div>
              <div className={`w-full bg-blue-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-blue-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${calcularPorcentajeCanal(metricas?.canales?.llamadas, metricas?.ventas?.completadas)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Presenciales */}
          <div className={`bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`bg-purple-500 rounded-full p-3 ${modoFullscreen ? 'p-4' : ''}`}>
                  <Users className={`text-white ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
                </div>
                <div className="ml-4">
                  <h4 className={`font-semibold text-purple-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                    Presencial
                  </h4>
                  <p className={`text-purple-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                    Reuniones cara a cara
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-purple-700">Ventas:</span>
                <span className="font-bold text-purple-900">{metricas?.canales?.presenciales || 0}</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-purple-700">Porcentaje:</span>
                <span className="font-bold text-purple-900">
                  {calcularPorcentajeCanal(metricas?.canales?.presenciales, metricas?.ventas?.completadas)}%
                </span>
              </div>
              <div className={`w-full bg-purple-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-purple-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${calcularPorcentajeCanal(metricas?.canales?.presenciales, metricas?.ventas?.completadas)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progreso hacia mis metas */}
      <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`font-bold text-gray-900 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              Mi Progreso hacia las Metas
            </h3>
            <p className={`text-gray-600 ${modoFullscreen ? 'text-lg' : ''}`}>
              Seguimiento de tus objetivos personales
            </p>
          </div>
          <Trophy className={`text-yellow-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${modoFullscreen ? 'gap-8' : ''}`}>
          {/* Meta de Ventas */}
          <div className={`bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-semibold text-blue-900 ${modoFullscreen ? 'text-2xl' : ''}`}>
                Meta de Ventas
              </h4>
              <span className={`font-bold text-blue-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {calcularPorcentajeMeta(metricas?.ventas?.completadas, metricas?.metas?.meta_cantidad)}%
              </span>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-blue-700">Logrado:</span>
                <span className="font-medium">{metricas?.ventas?.completadas || 0} ventas</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-blue-700">Meta:</span>
                <span className="font-medium">{metricas?.metas?.meta_cantidad || 'Sin meta'}</span>
              </div>
              <div className={`w-full bg-blue-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`${modoFullscreen ? 'h-4' : 'h-3'} rounded-full ${
                    calcularPorcentajeMeta(metricas?.ventas?.completadas, metricas?.metas?.meta_cantidad) >= 100 ? 'bg-green-500' :
                    calcularPorcentajeMeta(metricas?.ventas?.completadas, metricas?.metas?.meta_cantidad) >= 80 ? 'bg-blue-500' :
                    calcularPorcentajeMeta(metricas?.ventas?.completadas, metricas?.metas?.meta_cantidad) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(calcularPorcentajeMeta(metricas?.ventas?.completadas, metricas?.metas?.meta_cantidad), 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Meta de Ingresos */}
          <div className={`bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-semibold text-green-900 ${modoFullscreen ? 'text-2xl' : ''}`}>
                Meta de Ingresos
              </h4>
              <span className={`font-bold text-green-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {calcularPorcentajeMeta(metricas?.ventas?.valor_total, metricas?.metas?.meta_valor)}%
              </span>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-green-700">Logrado:</span>
                <span className="font-medium">{formatearMonto(metricas?.ventas?.valor_total)}</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-green-700">Meta:</span>
                <span className="font-medium">{metricas?.metas?.meta_valor ? formatearMonto(metricas?.metas?.meta_valor) : 'Sin meta'}</span>
              </div>
              <div className={`w-full bg-green-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-green-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${Math.min(calcularPorcentajeMeta(metricas?.ventas?.valor_total, metricas?.metas?.meta_valor), 100)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default DashboardAsesoresOptimized;