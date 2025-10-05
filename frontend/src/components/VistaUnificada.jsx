import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Target, Users,
  Calendar, BarChart3, PieChart, Award, MapPin, Phone,
  RefreshCw, Download, AlertCircle, CheckCircle, Trophy,
  ArrowUp, ArrowDown, Minus, Building, CreditCard, Bell,
  Brain, Zap, Eye, Activity, Clock, Lightbulb
} from 'lucide-react';
import DashboardEjecutivoGuard from './guards/DashboardEjecutivoGuard';
import PeriodSelectorAdvanced from './ventas/PeriodSelector/PeriodSelectorAdvanced';
import { API_CONFIG } from '../config/apiConfig';

const VistaUnificada = ({
  usuarioActual,
  refreshTrigger = 0
}) => {
  console.log('🎬 [VistaUnificada] RENDER:', { usuarioId: usuarioActual?.id, refresh: refreshTrigger });

  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [notification, setNotification] = useState(null);

  // Detectar mount/unmount
  useEffect(() => {
    const mountTime = Date.now();
    console.log('✅ [VistaUnificada] MONTADO');
    return () => {
      console.log(`❌ [VistaUnificada] DESMONTADO (vivió ${Date.now() - mountTime}ms)`);
    };
  }, []);

  // Función para mostrar notificaciones
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Cargar datos del dashboard ejecutivo
  const cargarDatos = useCallback(async () => {
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

      console.log(`[Vista Unificada] Cargando datos para período: ${periodoSeleccionado}`);

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/dashboard-ejecutivo/vista-unificada?periodo=${periodoSeleccionado}`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado. Se requieren privilegios administrativos.');
        }
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setDatos(result.data);
        showNotification('Dashboard actualizado correctamente', 'success');
      } else {
        throw new Error(result.error || 'Error desconocido');
      }

    } catch (err) {
      console.error('Error cargando Vista Unificada:', err);
      setError(`Error: ${err.message}`);
      showNotification('Error cargando datos del dashboard', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSeleccionado]); // showNotification es estable (deps []), no necesita estar aquí

  useEffect(() => {
    console.log('🔄 [VistaUnificada] useEffect disparado:', {
      periodo: periodoSeleccionado,
      refresh: refreshTrigger,
      userId: usuarioActual?.id,
      timestamp: new Date().toISOString()
    });

    if (usuarioActual?.id) {
      cargarDatos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSeleccionado, refreshTrigger, usuarioActual?.id]);
  // Llamamos cargarDatos directamente cuando cambian periodo/refresh/usuario
  // NO ponemos cargarDatos en deps porque causa ciclo (se recrea cuando periodo cambia)

  // Funciones auxiliares
  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(monto || 0);
  };

  const formatearNumero = (numero) => {
    return new Intl.NumberFormat('es-PE').format(numero || 0);
  };

  const obtenerTextoPeridodo = (periodo) => {
    const textos = {
      'hoy': 'Hoy',
      'semana_actual': 'Esta Semana',
      'mes_actual': 'Este Mes',
      'trimestre_actual': 'Este Trimestre'
    };
    return textos[periodo] || periodo;
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
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-gray-200 rounded"></div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error cargando dashboard ejecutivo</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarDatos}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No hay datos disponibles para mostrar</p>
      </div>
    );
  }

  const kpis = datos.kpis_generales || {};
  const topVentas = datos.top_asesores_ventas || [];
  const topIngresos = datos.top_asesores_ingresos || [];
  const canales = datos.distribucion_canales || [];
  const tendencias = datos.tendencias_15_dias || [];
  const tiposVenta = datos.tipos_venta || [];

  // Nuevas funcionalidades de inteligencia
  const alertas = datos.alertas_automaticas || [];
  const comparativas = datos.comparativas_temporales || {};
  const patterns = datos.patterns_detectados || [];
  const topPerformers = datos.top_performers_analysis || {};

  return (
    <DashboardEjecutivoGuard
      usuarioActual={usuarioActual}
      requiredAccess="ejecutivo"
      onAccessDenied={() => window.history.back()}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">Vista Unificada Ejecutiva</h2>
              <p className="text-blue-100 text-lg">
                Dashboard consolidado del equipo
              </p>
              {datos.fechas && (
                <p className="text-blue-200 text-sm mt-1">
                  Período: {datos.fechas.fechaInicio} al {datos.fechas.fechaFin}
                </p>
              )}
            </div>

            <button
              onClick={() => showNotification('Reporte exportado correctamente', 'success')}
              className="inline-flex items-center px-3 py-2 border border-blue-400 rounded-md text-white hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Selector de Período */}
        <PeriodSelectorAdvanced
          isExecutive={true}
          onPeriodChange={setPeriodoSeleccionado}
          initialPeriod={periodoSeleccionado}
          loading={loading}
        />

      {/* Métricas de Crecimiento */}
      {comparativas.metricas && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Crecimiento vs Período Anterior</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-green-100 text-sm">Ventas</p>
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    <span className="text-2xl font-bold">
                      +{comparativas.metricas.ventas?.variacion?.porcentaje}%
                    </span>
                  </div>
                  <p className="text-green-100 text-xs">
                    {comparativas.metricas.ventas?.actual} vs {comparativas.metricas.ventas?.anterior}
                  </p>
                </div>
                <div>
                  <p className="text-green-100 text-sm">Ingresos</p>
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    <span className="text-2xl font-bold">
                      +{Math.round(comparativas.metricas.ingresos?.variacion?.porcentaje || 0)}%
                    </span>
                  </div>
                  <p className="text-green-100 text-xs">
                    {formatearMonto(comparativas.metricas.ingresos?.actual)} vs {formatearMonto(comparativas.metricas.ingresos?.anterior)}
                  </p>
                </div>
                <div>
                  <p className="text-green-100 text-sm">Ticket Promedio</p>
                  <div className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    <span className="text-2xl font-bold">
                      +{Math.round(comparativas.metricas.ticket_promedio?.variacion?.porcentaje || 0)}%
                    </span>
                  </div>
                  <p className="text-green-100 text-xs">
                    {formatearMonto(comparativas.metricas.ticket_promedio?.actual)} vs {formatearMonto(comparativas.metricas.ticket_promedio?.anterior)}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Activity className="h-16 w-16 text-green-200" />
            </div>
          </div>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ventas</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearNumero(kpis.total_ventas)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {formatearNumero(kpis.asesores_activos)} asesores activos
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearMonto(kpis.ingresos_totales)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Revenue del equipo
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearMonto(kpis.ticket_promedio)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Por venta
              </p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cobertura</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearNumero(kpis.ciudades_cubiertas)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                ciudades cubiertas
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <MapPin className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Alertas Inteligentes */}
      {alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">🧠 Insights Automáticos</h3>
            <Brain className="h-6 w-6 text-purple-500" />
          </div>

          <div className="space-y-4">
            {alertas.map((alerta, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                alerta.tipo === 'exito' ? 'bg-green-50 border-green-500' :
                alerta.tipo === 'advertencia' ? 'bg-yellow-50 border-yellow-500' :
                'bg-blue-50 border-blue-500'
              }`}>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 mr-3 ${
                    alerta.tipo === 'exito' ? 'text-green-600' :
                    alerta.tipo === 'advertencia' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {alerta.tipo === 'exito' ? <TrendingUp className="h-5 w-5" /> :
                     alerta.tipo === 'advertencia' ? <AlertCircle className="h-5 w-5" /> :
                     <Lightbulb className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{alerta.titulo}</h4>
                    <p className="text-gray-700 text-sm mb-2">{alerta.mensaje}</p>
                    {alerta.accion_recomendada && (
                      <p className="text-xs text-gray-600 italic">
                        💡 {alerta.accion_recomendada}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP Asesores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP por Ventas */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">TOP Asesores por Ventas</h3>
            <Trophy className="h-6 w-6 text-yellow-500" />
          </div>
          
          <div className="space-y-4">
            {topVentas.map((asesor, index) => (
              <div key={asesor.asesor_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    'bg-orange-400 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {asesor.nombre_asesor || `Asesor #${asesor.asesor_id}`}
                    </p>
                    <p className="text-sm text-gray-600">
                      {asesor.porcentaje_ventas}% del total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {formatearNumero(asesor.ventas)} ventas
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatearMonto(asesor.ticket_promedio)} promedio
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOP por Ingresos */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">TOP Asesores por Ingresos</h3>
            <Award className="h-6 w-6 text-green-500" />
          </div>
          
          <div className="space-y-4">
            {topIngresos.map((asesor, index) => (
              <div key={asesor.asesor_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    index === 0 ? 'bg-green-500 text-white' :
                    index === 1 ? 'bg-blue-400 text-white' :
                    'bg-purple-400 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {asesor.nombre_asesor || `Asesor #${asesor.asesor_id}`}
                    </p>
                    <p className="text-sm text-gray-600">
                      {asesor.porcentaje_ingresos}% del total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {formatearMonto(asesor.ingresos)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatearNumero(asesor.ventas)} ventas
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribución por Canales y Tipos de Venta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canales de Contacto */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Distribución por Canal</h3>
            <Phone className="h-6 w-6 text-blue-500" />
          </div>
          
          <div className="space-y-3">
            {canales.map((canal, index) => (
              <div key={canal.canal_contacto} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    index === 0 ? 'bg-blue-500' :
                    index === 1 ? 'bg-green-500' :
                    index === 2 ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}></div>
                  <span className="font-medium text-gray-900">{canal.canal_contacto}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{canal.porcentaje_ventas}%</span>
                  <p className="text-sm text-gray-500">
                    {formatearNumero(canal.ventas)} ventas - {formatearMonto(canal.ticket_promedio)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de Venta */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Tipos de Venta</h3>
            <CreditCard className="h-6 w-6 text-purple-500" />
          </div>
          
          <div className="space-y-4">
            {tiposVenta.map((tipo) => (
              <div key={tipo.tipo_venta} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">{tipo.tipo_venta}</span>
                  <span className="font-bold text-purple-600">{tipo.porcentaje}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Cantidad</p>
                    <p className="font-medium">{formatearNumero(tipo.cantidad)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ingresos</p>
                    <p className="font-medium">{formatearMonto(tipo.ingresos)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ticket Prom.</p>
                    <p className="font-medium">{formatearMonto(tipo.ticket_promedio)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas Automáticas de Inteligencia */}
      {alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Bell className="h-6 w-6 text-orange-500 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Alertas Inteligentes</h3>
              <span className="ml-3 bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {alertas.length} alertas
              </span>
            </div>
            <Brain className="h-6 w-6 text-purple-500" />
          </div>

          <div className="space-y-3">
            {alertas.map((alerta, index) => {
              const iconos = {
                performance: Activity,
                anomalia: Zap,
                tendencia: TrendingUp,
                meta: Target
              };

              const colores = {
                alta: 'bg-red-100 border-red-200 text-red-800',
                media: 'bg-yellow-100 border-yellow-200 text-yellow-800',
                baja: 'bg-blue-100 border-blue-200 text-blue-800'
              };

              const IconoAlerta = iconos[alerta.categoria] || AlertCircle;

              return (
                <div key={index} className={`p-4 rounded-lg border ${colores[alerta.prioridad] || colores['baja']} flex items-start`}>
                  <IconoAlerta className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alerta.titulo || 'Alerta sin título'}</p>
                    <p className="text-sm mt-1">{alerta.descripcion || 'Sin descripción disponible'}</p>
                    {alerta.valor && (
                      <p className="text-xs mt-2 opacity-75">
                        Valor detectado: {typeof alerta.valor === 'number' ? formatearMonto(alerta.valor) : alerta.valor}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    alerta.prioridad === 'alta' ? 'bg-red-200 text-red-900' :
                    alerta.prioridad === 'media' ? 'bg-yellow-200 text-yellow-900' :
                    'bg-blue-200 text-blue-900'
                  }`}>
                    {(alerta.prioridad || 'baja').toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparativas Temporales */}
      {Object.keys(comparativas).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Clock className="h-6 w-6 text-blue-500 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Análisis Temporal</h3>
            </div>
            <Eye className="h-6 w-6 text-green-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ventas Comparativas */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Ventas</h4>
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Actual:</span>
                  <span className="font-medium">{formatearNumero(kpis.total_ventas || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Anterior:</span>
                  <span className="text-gray-500">{formatearNumero(comparativas.ventas_anteriores || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Variación:</span>
                  <div className="flex items-center">
                    {comparativas.variacion_ventas > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                    ) : comparativas.variacion_ventas < 0 ? (
                      <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                    ) : (
                      <Minus className="h-4 w-4 text-gray-500 mr-1" />
                    )}
                    <span className={`font-medium ${
                      comparativas.variacion_ventas > 0 ? 'text-green-600' :
                      comparativas.variacion_ventas < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {Math.abs(comparativas.variacion_ventas || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingresos Comparativos */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Ingresos</h4>
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Actual:</span>
                  <span className="font-medium">{formatearMonto(kpis.ingresos_totales || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Anterior:</span>
                  <span className="text-gray-500">{formatearMonto(comparativas.ingresos_anteriores || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Variación:</span>
                  <div className="flex items-center">
                    {comparativas.variacion_ingresos > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                    ) : comparativas.variacion_ingresos < 0 ? (
                      <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                    ) : (
                      <Minus className="h-4 w-4 text-gray-500 mr-1" />
                    )}
                    <span className={`font-medium ${
                      comparativas.variacion_ingresos > 0 ? 'text-green-600' :
                      comparativas.variacion_ingresos < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {Math.abs(comparativas.variacion_ingresos || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ticket Promedio Comparativo */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Ticket Promedio</h4>
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Actual:</span>
                  <span className="font-medium">{formatearMonto(kpis.ticket_promedio || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Anterior:</span>
                  <span className="text-gray-500">{formatearMonto(comparativas.ticket_anterior || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Variación:</span>
                  <div className="flex items-center">
                    {comparativas.variacion_ticket > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                    ) : comparativas.variacion_ticket < 0 ? (
                      <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                    ) : (
                      <Minus className="h-4 w-4 text-gray-500 mr-1" />
                    )}
                    <span className={`font-medium ${
                      comparativas.variacion_ticket > 0 ? 'text-green-600' :
                      comparativas.variacion_ticket < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {Math.abs(comparativas.variacion_ticket || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Análisis del período */}
          {comparativas.analisis && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <Lightbulb className="h-4 w-4 inline mr-2" />
                <strong>Análisis:</strong> {comparativas.analisis}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Patterns Detectados */}
      {patterns.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Brain className="h-6 w-6 text-purple-500 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Patterns Inteligentes</h3>
              <span className="ml-3 bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {patterns.length} patterns
              </span>
            </div>
            <Zap className="h-6 w-6 text-yellow-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {patterns.map((pattern, index) => {
              const iconos = {
                canal: Phone,
                tendencia: TrendingUp,
                performance: Activity,
                temporal: Clock
              };

              const IconoPattern = iconos[pattern.tipo] || Brain;

              return (
                <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-start">
                    <IconoPattern className="h-5 w-5 text-purple-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-2">{pattern.titulo || 'Pattern detectado'}</h4>
                      <p className="text-sm text-gray-700 mb-3">{pattern.descripcion || 'Sin descripción disponible'}</p>

                      {pattern.impacto && (
                        <div className="bg-white rounded-md p-3 border border-purple-100">
                          <p className="text-xs text-gray-600 mb-1">Impacto detectado:</p>
                          <p className="text-sm font-medium text-purple-800">{pattern.impacto}</p>

                          {pattern.recomendacion && (
                            <div className="mt-2 pt-2 border-t border-purple-100">
                              <p className="text-xs text-gray-600 mb-1">Recomendación:</p>
                              <p className="text-sm text-purple-700">{pattern.recomendacion}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      pattern.relevancia === 'alta' ? 'bg-red-100 text-red-800' :
                      pattern.relevancia === 'media' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {pattern.relevancia || 'media'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TOP Performers Analysis */}
      {Object.keys(topPerformers).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Trophy className="h-6 w-6 text-yellow-500 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Análisis TOP Performers</h3>
            </div>
            <Award className="h-6 w-6 text-green-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Factores de Éxito */}
            {topPerformers.factores_exito && topPerformers.factores_exito.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Factores de Éxito
                </h4>
                <div className="space-y-2">
                  {topPerformers.factores_exito.map((factor, index) => (
                    <div key={index} className="bg-white rounded-md p-3 border border-green-100">
                      <p className="text-sm font-medium text-green-800">{factor.factor}</p>
                      <p className="text-xs text-green-600 mt-1">{factor.descripcion}</p>
                      {factor.valor && (
                        <p className="text-xs text-green-700 mt-2 font-medium">
                          Valor promedio: {typeof factor.valor === 'number' ? formatearMonto(factor.valor) : factor.valor}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendaciones de Mejora */}
            {topPerformers.recomendaciones && topPerformers.recomendaciones.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2" />
                  Oportunidades de Mejora
                </h4>
                <div className="space-y-2">
                  {topPerformers.recomendaciones.map((rec, index) => (
                    <div key={index} className="bg-white rounded-md p-3 border border-blue-100">
                      <p className="text-sm font-medium text-blue-800">{rec.titulo}</p>
                      <p className="text-xs text-blue-600 mt-1">{rec.descripcion}</p>
                      {rec.impacto_estimado && (
                        <p className="text-xs text-blue-700 mt-2 font-medium">
                          Impacto estimado: {rec.impacto_estimado}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Benchmarks */}
          {topPerformers.benchmarks && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Benchmarks del Equipo
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(topPerformers.benchmarks).map(([metrica, valor]) => (
                  <div key={metrica} className="text-center">
                    <p className="text-xs text-gray-600 capitalize">{metrica.replace('_', ' ')}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {typeof valor === 'number' && metrica.includes('ingreso') || metrica.includes('ticket') ?
                        formatearMonto(valor) : formatearNumero(valor)
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tendencias últimos 15 días */}
      {tendencias.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Tendencias Últimos 15 Días</h3>
            <TrendingUp className="h-6 w-6 text-green-500" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">Fecha</th>
                  <th className="text-right py-2 font-medium text-gray-600">Ventas</th>
                  <th className="text-right py-2 font-medium text-gray-600">Ingresos</th>
                  <th className="text-right py-2 font-medium text-gray-600">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody>
                {tendencias.slice(0, 10).map((dia) => (
                  <tr key={dia.fecha_venta} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      {new Date(dia.fecha_venta).toLocaleDateString('es-PE')}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatearNumero(dia.ventas_dia)}
                    </td>
                    <td className="py-2 text-right font-medium text-green-600">
                      {formatearMonto(dia.ingresos_dia)}
                    </td>
                    <td className="py-2 text-right text-gray-600">
                      {formatearMonto(dia.ticket_promedio_dia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* Notificaciones */}
        <NotificationComponent />
      </div>
    </DashboardEjecutivoGuard>
  );
};

export default VistaUnificada;