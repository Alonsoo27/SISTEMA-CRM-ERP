import React, { useState, useEffect, useCallback } from 'react';
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

const DashboardAsesores = ({
  usuarioActual,
  refreshTrigger = 0
}) => {
  const [metricas, setMetricas] = useState(null);
  const [metasInfo, setMetasInfo] = useState(null);
  const [datosGeografia, setDatosGeografia] = useState([]);
  const [datosSectores, setDatosSectores] = useState([]);
  const [datosRanking, setDatosRanking] = useState(null);
  const [datosBono, setDatosBono] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [notification, setNotification] = useState(null);

  // NUEVO: Estados para el selector de asesores
  const [asesorSeleccionado, setAsesorSeleccionado] = useState(usuarioActual?.id);
  const [asesoresDisponibles, setAsesoresDisponibles] = useState([]);
  const [modoVista, setModoVista] = useState('propio'); // 'propio' | 'supervisor'
  const [loadingAsesores, setLoadingAsesores] = useState(false);
  
  // Estado para modo pantalla completa
  const [modoFullscreen, setModoFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Funciones para manejo de pantalla completa
  const toggleFullscreen = useCallback(() => {
    setModoFullscreen(!modoFullscreen);
    
    if (!modoFullscreen) {
      // Ocultar sidebar y otros elementos del layout principal
      const sidebar = document.querySelector('.sidebar, nav, aside, [role="navigation"]');
      const header = document.querySelector('header, .header');
      
      if (sidebar) sidebar.style.display = 'none';
      if (header) header.style.display = 'none';
      
      // Hacer que el dashboard ocupe toda la pantalla
      document.body.style.overflow = 'hidden';
      
      // Aplicar estilos fullscreen al contenedor padre
      const dashboardContainer = document.querySelector('#dashboard-container') || 
                                document.querySelector('.dashboard-container') ||
                                document.querySelector('[data-dashboard]');
      
      if (dashboardContainer) {
        dashboardContainer.style.position = 'fixed';
        dashboardContainer.style.top = '0';
        dashboardContainer.style.left = '0';
        dashboardContainer.style.width = '100vw';
        dashboardContainer.style.height = '100vh';
        dashboardContainer.style.zIndex = '9999';
        dashboardContainer.style.background = '#f9fafb';
        dashboardContainer.style.overflow = 'auto';
      }
      
      setAutoRefresh(true);
    } else {
      // Restaurar elementos
      const sidebar = document.querySelector('.sidebar, nav, aside, [role="navigation"]');
      const header = document.querySelector('header, .header');
      
      if (sidebar) sidebar.style.display = '';
      if (header) header.style.display = '';
      
      document.body.style.overflow = '';
      
      // Restaurar estilos del contenedor
      const dashboardContainer = document.querySelector('#dashboard-container') || 
                                document.querySelector('.dashboard-container') ||
                                document.querySelector('[data-dashboard]');
      
      if (dashboardContainer) {
        dashboardContainer.style.position = '';
        dashboardContainer.style.top = '';
        dashboardContainer.style.left = '';
        dashboardContainer.style.width = '';
        dashboardContainer.style.height = '';
        dashboardContainer.style.zIndex = '';
        dashboardContainer.style.background = '';
        dashboardContainer.style.overflow = '';
      }
      
      setAutoRefresh(false);
    }
  }, [modoFullscreen]);

  // Funciones auxiliares
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // NUEVA: Determinar modo de vista según permisos del usuario
  const determinarModoVista = useCallback(() => {
    const userVende = usuarioActual?.vende;
    const userRole = usuarioActual?.rol_id;

    // Roles que NO venden pero pueden supervisar
    const rolesSoloSupervisores = [2, 3]; // GERENTE, JEFE_VENTAS

    if (rolesSoloSupervisores.includes(userRole) || !userVende) {
      // FORZAR modo supervisor para usuarios que no venden
      setModoVista('supervisor');
      setAsesorSeleccionado(null); // No seleccionar ningún asesor por defecto
      return 'supervisor';
    } else {
      // Usuarios que venden inician viendo su propio dashboard
      setModoVista('propio');
      setAsesorSeleccionado(usuarioActual?.id);
      return 'propio';
    }
  }, [usuarioActual]);

  // NUEVA: Cargar lista de asesores supervisables
  const cargarAsesores = useCallback(async () => {
    try {
      setLoadingAsesores(true);
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('Token no encontrado');
        return;
      }

      const response = await fetch('/api/asesores/supervisables', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAsesoresDisponibles(data.data.asesores || []);
        console.log('✅ Asesores cargados:', data.data.asesores.length);
      } else {
        console.error('Error cargando asesores:', response.status);
      }

    } catch (error) {
      console.error('Error cargando asesores:', error);
    } finally {
      setLoadingAsesores(false);
    }
  }, []);

  // NUEVA: Cambiar asesor seleccionado
  const cambiarAsesor = useCallback((nuevoAsesorId) => {
    if (nuevoAsesorId !== asesorSeleccionado) {
      setAsesorSeleccionado(nuevoAsesorId);
      setMetricas(null); // Limpiar datos para forzar recarga
      setMetasInfo(null);
      setDatosGeografia([]);
      setDatosSectores([]);
      setDatosRanking(null);
    }
  }, [asesorSeleccionado]);

  // NUEVA: Toggle entre modo propio y supervisor
  const toggleModoVista = useCallback(() => {
    const userVende = usuarioActual?.vende;
    const userRole = usuarioActual?.rol_id;
    const rolesSoloSupervisores = [2, 3];

    // Solo permitir toggle si el usuario puede vender
    if (rolesSoloSupervisores.includes(userRole) || !userVende) {
      return; // No hacer nada si es un rol que solo supervisa
    }

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
  }, [modoVista, usuarioActual]);

  // Cargar métricas del asesor
  const cargarMetricas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // VALIDACIÓN: No cargar si no hay asesor seleccionado
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

      console.log(`🔄 Cargando dashboard para asesor ${asesorSeleccionado} en modo ${modoVista}`);

      // Llamadas paralelas a todos los endpoints usando el asesor seleccionado
      const [
        dashboardResponse,
        metasResponse,
        geografiaResponse,
        sectoresResponse,
        rankingResponse,
        bonoResponse
      ] = await Promise.all([
        fetch(`/api/dashboard/personal/${asesorSeleccionado}?periodo=${periodoSeleccionado}`, { headers }),
        fetch(`/api/metas/dashboard?asesor_id=${asesorSeleccionado}&periodo=${periodoSeleccionado}`, { headers }),
        fetch(`/api/dashboard/geografia-asesor/${asesorSeleccionado}?periodo=${periodoSeleccionado}`, { headers }).catch(() => ({ ok: false })),
        fetch(`/api/dashboard/sectores-asesor/${asesorSeleccionado}?periodo=${periodoSeleccionado}`, { headers }).catch(() => ({ ok: false })),
        fetch(`/api/dashboard/ranking-asesor/${asesorSeleccionado}?periodo=${periodoSeleccionado}`, { headers }).catch(() => ({ ok: false })),
        fetch(`/api/comisiones/bono-actual/${asesorSeleccionado}`, { headers }).catch(() => ({ ok: false }))
      ]);

      // Procesar respuestas
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setMetricas(dashboardData.data);
      }

      if (metasResponse.ok) {
        const metasData = await metasResponse.json();
        setMetasInfo(metasData.data);
      }

      if (geografiaResponse.ok) {
        const geografiaData = await geografiaResponse.json();
        setDatosGeografia(geografiaData.data?.geografiaData || []);
      }

      if (sectoresResponse.ok) {
        const sectoresData = await sectoresResponse.json();
        setDatosSectores(sectoresData.data?.sectoresData || []);
      }

      if (rankingResponse.ok) {
        const rankingData = await rankingResponse.json();
        setDatosRanking(rankingData.data?.rankingData);
      }

      if (bonoResponse.ok) {
        const bonoData = await bonoResponse.json();
        setDatosBono(bonoData.data);
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

  // NUEVO: Inicialización del componente
  useEffect(() => {
    if (usuarioActual?.id) {
      // Determinar modo de vista inicial
      determinarModoVista();
      // Cargar lista de asesores supervisables
      cargarAsesores();
    }
  }, [usuarioActual?.id, determinarModoVista, cargarAsesores]);

  // ACTUALIZADO: useEffect para cargar métricas cuando cambia el asesor o período
  useEffect(() => {
    if (asesorSeleccionado) {
      cargarMetricas();
    }
  }, [cargarMetricas, refreshTrigger, asesorSeleccionado]);

  // Auto-refresh en modo fullscreen
  useEffect(() => {
    if (modoFullscreen) {
      const interval = setInterval(() => {
        cargarMetricas();
      }, 30000); // Refresh cada 30 segundos

      return () => {
        clearInterval(interval);
      };
    }
  }, [modoFullscreen, cargarMetricas]);

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
        const sidebar = document.querySelector('.sidebar, nav, aside, [role="navigation"]');
        const header = document.querySelector('header, .header');
        
        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = '';
        
        document.body.style.overflow = '';
        
        const dashboardContainer = document.querySelector('#dashboard-container') || 
                                  document.querySelector('.dashboard-container') ||
                                  document.querySelector('[data-dashboard]');
        
        if (dashboardContainer) {
          dashboardContainer.style.position = '';
          dashboardContainer.style.top = '';
          dashboardContainer.style.left = '';
          dashboardContainer.style.width = '';
          dashboardContainer.style.height = '';
          dashboardContainer.style.zIndex = '';
          dashboardContainer.style.background = '';
          dashboardContainer.style.overflow = '';
        }
      }
    };
  }, [modoFullscreen, toggleFullscreen]);

  useEffect(() => {
    if (usuarioActual?.id) {
      cargarMetricas();
    }
  }, [cargarMetricas, refreshTrigger, usuarioActual?.id]);

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(monto || 0);
  };

  const obtenerIconoTendencia = (valor) => {
    const num = parseFloat(valor || 0);
    if (num > 0) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (num < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const obtenerColorTendencia = (valor) => {
    const num = parseFloat(valor || 0);
    if (num > 0) return 'text-green-600';
    if (num < 0) return 'text-red-600';
    return 'text-gray-500';
  };

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

  // Verificar si el usuario puede alternar entre modos
  const puedeAlternarModos = usuarioActual?.vende && ![2, 3].includes(usuarioActual?.rol_id);

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
            {puedeAlternarModos && (
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

            {/* Selector de período */}
            <select
              value={periodoSeleccionado}
              onChange={(e) => setPeriodoSeleccionado(e.target.value)}
              className={`border border-blue-400 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 ${
                modoFullscreen ? 'text-lg px-4 py-3' : ''
              }`}
            >
              <option value="hoy">Hoy</option>
              <option value="semana_actual">Esta semana</option>
              <option value="mes_actual">Este mes</option>
              <option value="trimestre_actual">Este trimestre</option>
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

      {/* Métricas principales expandidas */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 ${modoFullscreen ? 'gap-6' : ''}`}>
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
                {obtenerIconoTendencia(metricas?.tendencias?.ventas_completadas)}
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
                {obtenerIconoTendencia(metricas?.tendencias?.valor_total_completadas)}
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
                {obtenerIconoTendencia(metricas?.tendencias?.promedio_venta)}
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

        {/* Bono Actual */}
        <div className={`bg-white rounded-lg shadow p-4 ${modoFullscreen ? 'p-6' : ''} cursor-pointer hover:shadow-lg transition-shadow`}
             title="Click para ver detalles del bono">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Mi Bono Actual
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                ${datosBono?.bono_actual?.bono_usd || '0.00'}
              </p>
              <div className="flex items-center mt-1">
                <Trophy className={`h-3 w-3 ${
                  (datosBono?.bono_actual?.porcentaje || 0) >= 100 ? 'text-yellow-500' : 'text-orange-500'
                }`} />
                <span className={`ml-1 ${
                  (datosBono?.bono_actual?.porcentaje || 0) >= 100 ? 'text-yellow-600' : 'text-orange-600'
                } ${modoFullscreen ? 'text-sm' : 'text-xs'}`}>
                  {Math.round(datosBono?.bono_actual?.porcentaje || 0)}% de meta
                </span>
              </div>
            </div>
            <div className={`bg-yellow-100 rounded-full ${modoFullscreen ? 'p-3' : 'p-2'}`}>
              <Award className={`text-yellow-600 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            </div>
          </div>
        </div>
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
                  {metricas?.ventas?.completadas > 0 ?
                    Math.round(((metricas?.canales?.whatsapp || 0) / metricas.ventas.completadas) * 100) : 0}%
                </span>
              </div>
              <div className={`w-full bg-green-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-green-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${metricas?.ventas?.completadas > 0 ?
                      Math.min(((metricas?.canales?.whatsapp || 0) / metricas.ventas.completadas) * 100, 100) : 0}%`
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
                  {metricas?.ventas?.completadas > 0 ?
                    Math.round(((metricas?.canales?.llamadas || 0) / metricas.ventas.completadas) * 100) : 0}%
                </span>
              </div>
              <div className={`w-full bg-blue-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-blue-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${metricas?.ventas?.completadas > 0 ?
                      Math.min(((metricas?.canales?.llamadas || 0) / metricas.ventas.completadas) * 100, 100) : 0}%`
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
                  {metricas?.ventas?.completadas > 0 ?
                    Math.round(((metricas?.canales?.presenciales || 0) / metricas.ventas.completadas) * 100) : 0}%
                </span>
              </div>
              <div className={`w-full bg-purple-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div
                  className={`bg-purple-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{
                    width: `${metricas?.ventas?.completadas > 0 ?
                      Math.min(((metricas?.canales?.presenciales || 0) / metricas.ventas.completadas) * 100, 100) : 0}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actividad y Comunicación */}
      <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`font-bold text-gray-900 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              Mi Actividad Diaria
            </h3>
            <p className={`text-gray-600 ${modoFullscreen ? 'text-lg' : ''}`}>
              Seguimiento de interacciones y comunicación con clientes
            </p>
          </div>
          <Activity className={`text-green-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${modoFullscreen ? 'gap-8' : ''}`}>
          {/* Total Mensajes */}
          <div className={`bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <MessageCircle className={`text-blue-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
              <span className={`font-bold text-blue-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.actividad?.total_mensajes || 0}
              </span>
            </div>
            <div>
              <h4 className={`font-semibold text-blue-900 ${modoFullscreen ? 'text-xl' : ''}`}>
                Total Mensajes
              </h4>
              <p className={`text-blue-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                Promedio: {Math.round(metricas?.actividad?.promedio_mensajes_dia || 0)}/día
              </p>
              <p className={`text-blue-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Máximo: {metricas?.actividad?.max_mensajes_dia || 0} en un día
              </p>
            </div>
          </div>

          {/* Total Llamadas */}
          <div className={`bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <Phone className={`text-green-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
              <span className={`font-bold text-green-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.actividad?.total_llamadas || 0}
              </span>
            </div>
            <div>
              <h4 className={`font-semibold text-green-900 ${modoFullscreen ? 'text-xl' : ''}`}>
                Total Llamadas
              </h4>
              <p className={`text-green-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                Promedio: {Math.round(metricas?.actividad?.promedio_llamadas_dia || 0)}/día
              </p>
              <p className={`text-green-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Máximo: {metricas?.actividad?.max_llamadas_dia || 0} en un día
              </p>
            </div>
          </div>

          {/* Días Activos */}
          <div className={`bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <Calendar className={`text-purple-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
              <span className={`font-bold text-purple-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.actividad?.dias_activos || 0}
              </span>
            </div>
            <div>
              <h4 className={`font-semibold text-purple-900 ${modoFullscreen ? 'text-xl' : ''}`}>
                Días Activos
              </h4>
              <p className={`text-purple-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                En el período seleccionado
              </p>
              <p className={`text-purple-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Constancia en seguimiento
              </p>
            </div>
          </div>

          {/* Eficiencia */}
          <div className={`bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <Zap className={`text-yellow-500 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
              <span className={`font-bold text-yellow-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.insights?.eficiencia_mensajes || '0.00'}
              </span>
            </div>
            <div>
              <h4 className={`font-semibold text-yellow-900 ${modoFullscreen ? 'text-xl' : ''}`}>
                Eficiencia
              </h4>
              <p className={`text-yellow-700 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                Mensajes por venta
              </p>
              <p className={`text-yellow-600 ${modoFullscreen ? 'text-base' : 'text-xs'}`}>
                Eficiencia de contacto
              </p>
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
                {metricas?.metas?.porcentaje_cumplimiento > 0 ?
                  Math.round(((metricas?.ventas?.completadas || 0) / (metricas?.metas?.meta_cantidad || 1)) * 100) : 0}%
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
                    (metasInfo?.metas?.porcentaje_cumplimiento || 0) >= 100 ? 'bg-green-500' :
                    (metasInfo?.metas?.porcentaje_cumplimiento || 0) >= 80 ? 'bg-blue-500' :
                    (metasInfo?.metas?.porcentaje_cumplimiento || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(metricas?.metas?.porcentaje_cumplimiento || 0, 100)}%` }}
                ></div>
              </div>
              {metricas?.insights?.ritmo_diario_necesario > 0 && (
                <div className={`text-xs ${modoFullscreen ? 'text-sm' : ''} text-blue-600 bg-blue-50 p-2 rounded`}>
                  <strong>Ritmo necesario:</strong> {formatearMonto(metricas.insights.ritmo_diario_necesario)}/día
                </div>
              )}
            </div>
          </div>

          {/* Meta de Ingresos */}
          <div className={`bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`font-semibold text-green-900 ${modoFullscreen ? 'text-2xl' : ''}`}>
                Meta de Ingresos
              </h4>
              <span className={`font-bold text-green-600 ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                {metricas?.metas?.meta_valor > 0 ?
                  Math.round(((metricas?.ventas?.valor_total || 0) / metricas?.metas?.meta_valor) * 100) :
                  0}%
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
                    width: `${metricas?.metas?.meta_valor > 0 ?
                      Math.min(((metricas?.ventas?.valor_total || 0) / metricas?.metas?.meta_valor) * 100, 100) : 0}%`
                  }}
                ></div>
              </div>
              {metricas?.insights?.proyeccion_mes > 0 && (
                <div className={`text-xs ${modoFullscreen ? 'text-sm' : ''} text-green-600 bg-green-50 p-2 rounded`}>
                  <strong>Proyección del mes:</strong> {formatearMonto(metricas.insights.proyeccion_mes)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Métricas Avanzadas de Rendimiento */}
        <div className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 ${modoFullscreen ? 'p-8' : ''} mt-6`}>
          <h4 className={`font-bold text-gray-900 mb-6 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
            <BarChart className={`inline-block mr-2 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
            Métricas Avanzadas de Rendimiento
          </h4>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${modoFullscreen ? 'gap-6' : ''}`}>
            {/* Venta Mínima */}
            <div className={`bg-white rounded-lg p-4 ${modoFullscreen ? 'p-6' : ''} border-l-4 border-red-400`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-red-600 ${modoFullscreen ? 'text-lg' : 'text-sm'} font-medium`}>
                  Venta Mínima
                </span>
                <TrendDown className={`text-red-500 ${modoFullscreen ? 'h-6 w-6' : 'h-4 w-4'}`} />
              </div>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                {formatearMonto(metricas?.ventas?.venta_minima)}
              </p>
            </div>

            {/* Venta Máxima */}
            <div className={`bg-white rounded-lg p-4 ${modoFullscreen ? 'p-6' : ''} border-l-4 border-green-400`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-green-600 ${modoFullscreen ? 'text-lg' : 'text-sm'} font-medium`}>
                  Venta Máxima
                </span>
                <TrendingUp className={`text-green-500 ${modoFullscreen ? 'h-6 w-6' : 'h-4 w-4'}`} />
              </div>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                {formatearMonto(metricas?.ventas?.venta_maxima)}
              </p>
            </div>

            {/* Tiempo de Conversión */}
            <div className={`bg-white rounded-lg p-4 ${modoFullscreen ? 'p-6' : ''} border-l-4 border-blue-400`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-blue-600 ${modoFullscreen ? 'text-lg' : 'text-sm'} font-medium`}>
                  Tiempo Conversión
                </span>
                <Timer className={`text-blue-500 ${modoFullscreen ? 'h-6 w-6' : 'h-4 w-4'}`} />
              </div>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                {Math.round(metricas?.ventas?.tiempo_promedio_conversion || 0)} días
              </p>
            </div>

            {/* Pipeline Activo */}
            <div className={`bg-white rounded-lg p-4 ${modoFullscreen ? 'p-6' : ''} border-l-4 border-purple-400`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-purple-600 ${modoFullscreen ? 'text-lg' : 'text-sm'} font-medium`}>
                  Pipeline Activo
                </span>
                <LineChart className={`text-purple-500 ${modoFullscreen ? 'h-6 w-6' : 'h-4 w-4'}`} />
              </div>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                {formatearMonto(metricas?.pipeline?.valor_pipeline_activo)}
              </p>
              <p className={`text-purple-600 ${modoFullscreen ? 'text-sm' : 'text-xs'}`}>
                {metricas?.pipeline?.activas_pipeline || 0} oportunidades
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Secciones adicionales */}
      {/* Análisis geográfico personal */}
      {datosGeografia.length > 0 && (
        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-bold text-gray-900 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              Mis Ventas por Ubicación
            </h3>
            <div className="flex items-center space-x-2">
              <MapPin className={`text-blue-500 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
              <span className={`text-gray-500 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                {datosGeografia.length} ubicaciones
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {datosGeografia.slice(0, modoFullscreen ? 8 : 6).map((ubicacion, index) => (
              <div key={`${ubicacion.departamento}-${ubicacion.ciudad}`} 
                   className={`flex items-center justify-between bg-gray-50 rounded-lg ${
                     modoFullscreen ? 'p-6' : 'p-3'
                   }`}>
                <div className="flex items-center">
                  <div className={`rounded-full mr-3 ${modoFullscreen ? 'w-4 h-4' : 'w-3 h-3'} ${
                    index === 0 ? 'bg-green-500' : index === 1 ? 'bg-blue-500' : 'bg-gray-400'
                  }`}></div>
                  <div>
                    <p className={`font-medium text-gray-900 ${modoFullscreen ? 'text-lg' : ''}`}>
                      {ubicacion.ciudad}
                    </p>
                    <p className={`text-gray-600 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                      {ubicacion.departamento}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-blue-600 ${modoFullscreen ? 'text-lg' : ''}`}>
                    {formatearMonto(ubicacion.ingresos_totales)}
                  </p>
                  <p className={`text-gray-500 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                    {ubicacion.cantidad_ventas} ventas ({ubicacion.porcentaje_ventas}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análisis sectorial personal */}
      {datosSectores.length > 0 && (
        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-bold text-gray-900 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              Mis Ventas por Sector
            </h3>
            <div className="flex items-center space-x-2">
              <PieChart className={`text-green-500 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
              <span className={`text-gray-500 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                {datosSectores.length} sectores
              </span>
            </div>
          </div>
          
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${
            modoFullscreen ? 'gap-6' : ''
          }`}>
            {datosSectores.map((sector) => (
              <div key={sector.sector} 
                   className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg ${
                     modoFullscreen ? 'p-6' : 'p-4'
                   }`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`font-semibold text-gray-900 ${modoFullscreen ? 'text-lg' : ''}`}>
                    {sector.sector}
                  </h4>
                  <span className={`font-medium text-blue-600 ${
                    modoFullscreen ? 'text-base' : 'text-sm'
                  }`}>
                    {sector.porcentaje_ventas}%
                  </span>
                </div>
                
                <div className={`space-y-2 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ventas:</span>
                    <span className="font-medium">{sector.cantidad_ventas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ingresos:</span>
                    <span className="font-medium text-green-600">
                      {formatearMonto(sector.ingresos_totales)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ticket prom:</span>
                    <span className="font-medium">{formatearMonto(sector.ticket_promedio)}</span>
                  </div>
                  {sector.clientes_unicos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Clientes:</span>
                      <span className="font-medium">{sector.clientes_unicos}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mi ranking */}
      {datosRanking && (
        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-bold text-gray-900 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              Mi Posición en el Equipo
            </h3>
            <Medal className={`text-yellow-500 ${modoFullscreen ? 'h-8 w-8' : 'h-6 w-6'}`} />
          </div>

          <div className="text-center">
            <div className={`bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 ${
              modoFullscreen ? 'w-32 h-32' : 'w-20 h-20'
            }`}>
              <span className={`font-bold text-white ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                #{datosRanking.posicion_ventas}
              </span>
            </div>
            
            <h4 className={`font-bold text-gray-900 mb-2 ${modoFullscreen ? 'text-3xl' : 'text-xl'}`}>
              {datosRanking.posicion_ventas}° lugar
            </h4>
            <p className={`text-gray-600 mb-4 ${modoFullscreen ? 'text-lg' : ''}`}>
              de {datosRanking.total_asesores} asesores este {periodoSeleccionado.replace('_', ' ')}
            </p>
            
            <div className={`grid grid-cols-2 gap-4 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
              <div className={`bg-blue-50 rounded-lg ${modoFullscreen ? 'p-6' : 'p-3'}`}>
                <p className="font-medium text-blue-900">Mis ventas</p>
                <p className={`text-blue-600 font-bold ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                  {datosRanking.mis_ventas}
                </p>
              </div>
              <div className={`bg-gray-50 rounded-lg ${modoFullscreen ? 'p-6' : 'p-3'}`}>
                <p className="font-medium text-gray-900">Promedio equipo</p>
                <p className={`text-gray-600 font-bold ${modoFullscreen ? 'text-2xl' : 'text-lg'}`}>
                  {Math.round(datosRanking.promedio_equipo_ventas || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default DashboardAsesores;