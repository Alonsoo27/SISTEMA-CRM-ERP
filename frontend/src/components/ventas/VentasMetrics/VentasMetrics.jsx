import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Target, 
  Award, Calendar, BarChart3, PieChart, User,
  RefreshCw, Download, AlertCircle, CheckCircle,
  Star, ArrowUp, ArrowDown, Minus, Trophy,
  Clock, Zap, Medal, MapPin, Maximize, Minimize,
  Eye, Monitor
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [notification, setNotification] = useState(null);
  
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

  // Cargar métricas del asesor
  const cargarMetricas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Token de autenticación no encontrado');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Llamadas paralelas a todos los endpoints
      const [
        dashboardResponse,
        metasResponse,
        geografiaResponse,
        sectoresResponse,
        rankingResponse
      ] = await Promise.all([
        fetch(`/api/dashboard/personal/${usuarioActual.id}?periodo=${periodoSeleccionado}`, { headers }),
        fetch(`/api/metas/dashboard?asesor_id=${usuarioActual.id}&periodo=${periodoSeleccionado}`, { headers }),
        fetch(`/api/dashboard/geografia-asesor/${usuarioActual.id}?periodo=${periodoSeleccionado}`, { headers }).catch(() => ({ ok: false })),
        fetch(`/api/dashboard/sectores-asesor/${usuarioActual.id}?periodo=${periodoSeleccionado}`, { headers }).catch(() => ({ ok: false })),
        fetch(`/api/dashboard/ranking-asesor/${usuarioActual.id}?periodo=${periodoSeleccionado}`, { headers }).catch(() => ({ ok: false }))
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
  }, [usuarioActual.id, periodoSeleccionado, autoRefresh, showNotification]);

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
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
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

  return (
    <div className={`space-y-6 ${modoFullscreen ? 'p-8' : ''}`} data-dashboard>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-bold ${modoFullscreen ? 'text-4xl' : 'text-2xl'}`}>
              Mi Dashboard Personal
            </h2>
            <p className={`text-blue-100 ${modoFullscreen ? 'text-xl' : ''}`}>
              Hola, {usuarioActual?.nombre}! Aquí tienes tus métricas y progreso
            </p>
            {modoFullscreen && autoRefresh && (
              <div className="flex items-center mt-2 text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm">Actualización automática cada 30s • Presiona ESC para salir</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
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

      {/* Métricas principales */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${modoFullscreen ? 'gap-8' : ''}`}>
        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                Mis Ventas
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-5xl' : 'text-3xl'}`}>
                {metricas?.metricas?.ventas_completadas || 0}
              </p>
              <div className="flex items-center mt-2">
                {obtenerIconoTendencia(metricas?.tendencias?.ventas_completadas)}
                <span className={`ml-1 ${obtenerColorTendencia(metricas?.tendencias?.ventas_completadas)} ${
                  modoFullscreen ? 'text-base' : 'text-sm'
                }`}>
                  {metricas?.tendencias?.ventas_completadas > 0 ? '+' : ''}{metricas?.tendencias?.ventas_completadas}% vs período anterior
                </span>
              </div>
            </div>
            <div className={`bg-blue-100 rounded-full ${modoFullscreen ? 'p-4' : 'p-3'}`}>
              <DollarSign className={`text-blue-600 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                Mis Ingresos
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-5xl' : 'text-3xl'}`}>
                {formatearMonto(metricas?.metricas?.valor_total_completadas)}
              </p>
              <div className="flex items-center mt-2">
                {obtenerIconoTendencia(metricas?.tendencias?.valor_total_completadas)}
                <span className={`ml-1 ${obtenerColorTendencia(metricas?.tendencias?.valor_total_completadas)} ${
                  modoFullscreen ? 'text-base' : 'text-sm'
                }`}>
                  {metricas?.tendencias?.valor_total_completadas > 0 ? '+' : ''}{metricas?.tendencias?.valor_total_completadas}% vs período anterior
                </span>
              </div>
            </div>
            <div className={`bg-green-100 rounded-full ${modoFullscreen ? 'p-4' : 'p-3'}`}>
              <Target className={`text-green-600 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                Mi Tasa de Éxito
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-5xl' : 'text-3xl'}`}>
                {metricas?.metricas?.tasa_exito || 0}%
              </p>
              <div className="flex items-center mt-2">
                <ArrowUp className="h-4 w-4 text-green-500" />
                <span className={`ml-1 text-green-600 ${modoFullscreen ? 'text-base' : 'text-sm'}`}>
                  Excelente rendimiento
                </span>
              </div>
            </div>
            <div className={`bg-purple-100 rounded-full ${modoFullscreen ? 'p-4' : 'p-3'}`}>
              <Award className={`text-purple-600 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-lg shadow p-6 ${modoFullscreen ? 'p-8' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium text-gray-600 ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                Ticket Promedio
              </p>
              <p className={`font-bold text-gray-900 ${modoFullscreen ? 'text-5xl' : 'text-3xl'}`}>
                {formatearMonto(metricas?.metricas?.promedio_venta)}
              </p>
              <div className="flex items-center mt-2">
                {obtenerIconoTendencia(metricas?.tendencias?.promedio_venta)}
                <span className={`ml-1 ${obtenerColorTendencia(metricas?.tendencias?.promedio_venta)} ${
                  modoFullscreen ? 'text-base' : 'text-sm'
                }`}>
                  {metricas?.tendencias?.promedio_venta > 0 ? '+' : ''}{metricas?.tendencias?.promedio_venta}% vs período anterior
                </span>
              </div>
            </div>
            <div className={`bg-yellow-100 rounded-full ${modoFullscreen ? 'p-4' : 'p-3'}`}>
              <Star className={`text-yellow-600 ${modoFullscreen ? 'h-12 w-12' : 'h-8 w-8'}`} />
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
                {metasInfo?.metricas?.promedio_cumplimiento || 0}%
              </span>
            </div>
            
            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-blue-700">Logrado:</span>
                <span className="font-medium">{metricas?.metricas?.ventas_completadas || 0} ventas</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-blue-700">Meta:</span>
                <span className="font-medium">15 ventas</span>
              </div>
              <div className={`w-full bg-blue-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div 
                  className={`${modoFullscreen ? 'h-4' : 'h-3'} rounded-full ${
                    (metasInfo?.metricas?.promedio_cumplimiento || 0) >= 100 ? 'bg-green-500' :
                    (metasInfo?.metricas?.promedio_cumplimiento || 0) >= 80 ? 'bg-blue-500' :
                    (metasInfo?.metricas?.promedio_cumplimiento || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(metasInfo?.metricas?.promedio_cumplimiento || 0, 100)}%` }}
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
                {Math.round(((metricas?.metricas?.valor_total_completadas || 0) / 5000) * 100)}%
              </span>
            </div>
            
            <div className="space-y-3">
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-green-700">Logrado:</span>
                <span className="font-medium">{formatearMonto(metricas?.metricas?.valor_total_completadas)}</span>
              </div>
              <div className={`flex justify-between ${modoFullscreen ? 'text-lg' : 'text-sm'}`}>
                <span className="text-green-700">Meta:</span>
                <span className="font-medium">{formatearMonto(5000)}</span>
              </div>
              <div className={`w-full bg-green-200 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}>
                <div 
                  className={`bg-green-500 rounded-full ${modoFullscreen ? 'h-4' : 'h-3'}`}
                  style={{ width: `${Math.min(((metricas?.metricas?.valor_total_completadas || 0) / 5000) * 100, 100)}%` }}
                ></div>
              </div>
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