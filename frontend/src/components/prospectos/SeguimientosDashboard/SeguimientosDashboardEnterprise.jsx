// src/components/prospectos/SeguimientosDashboard/SeguimientosDashboardEnterprise.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Clock, AlertTriangle, Calendar, Phone, Mail, MessageSquare,
  MapPin, CheckCircle, XCircle, RefreshCw, User, Bell, Settings,
  TrendingUp, Eye, ExternalLink, Loader2, ChevronDown, ChevronUp,
  Zap, Filter, BarChart3, Target, Star, DollarSign, Users,
  Flame, ShieldAlert, Award, Activity, Timer, Gauge
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const SeguimientosDashboardEnterprise = ({ asesorId = null, refreshTrigger = 0 }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [vistaExpandida, setVistaExpandida] = useState(true);
  const [filtroUrgencia, setFiltroUrgencia] = useState('todos');
  const [notification, setNotification] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    cargarDashboard();
  }, [asesorId, refreshTrigger]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(cargarDashboard, 5 * 60 * 1000); // 5 minutos
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await prospectosService.obtenerDashboardSeguimientos(asesorId);

      if (response.success) {
        setDashboardData(response.data);

        // Mostrar notificaciones críticas
        if (response.data.alertas?.alto_valor_en_riesgo) {
          mostrarNotificacion('error', '🚨 Alto valor en riesgo detectado');
        } else if (response.data.alertas?.muchos_vencidos) {
          mostrarNotificacion('warning', '⚠️ Muchos seguimientos vencidos');
        }
      } else {
        setError('Error al cargar dashboard de seguimientos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const mostrarNotificacion = (tipo, mensaje) => {
    setNotification({ tipo, mensaje });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUrgenciaColor = (urgencia) => {
    switch (urgencia) {
      case 'critico': return 'border-red-500 bg-red-50 text-red-700';
      case 'medio': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case 'bajo': return 'border-green-500 bg-green-50 text-green-700';
      default: return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  const getPriorityIcon = (priorityScore) => {
    if (priorityScore > 5000) return <Flame className="h-4 w-4 text-red-600" />;
    if (priorityScore > 2000) return <Star className="h-4 w-4 text-yellow-600" />;
    return <Activity className="h-4 w-4 text-blue-600" />;
  };

  const seguimientosFiltrados = useMemo(() => {
    if (!dashboardData?.seguimientos) return [];

    let todos = [
      ...dashboardData.seguimientos.proximos.map(s => ({ ...s, categoria: 'proximo' })),
      ...dashboardData.seguimientos.vencidos.map(s => ({ ...s, categoria: 'vencido' }))
    ];

    if (filtroUrgencia !== 'todos') {
      todos = todos.filter(s => s.urgencia === filtroUrgencia);
    }

    return todos.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  }, [dashboardData, filtroUrgencia]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-8">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarDashboard}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { seguimientos, conteos, metricas, alertas, sistema } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Notificaciones */}
      {notification && (
        <div className={`p-4 rounded-lg border-l-4 ${
          notification.tipo === 'error' ? 'bg-red-50 border-red-400 text-red-700' :
          notification.tipo === 'warning' ? 'bg-yellow-50 border-yellow-400 text-yellow-700' :
          'bg-blue-50 border-blue-400 text-blue-700'
        }`}>
          {notification.mensaje}
        </div>
      )}

      {/* Header con Controles */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center mb-4 md:mb-0">
            <Timer className="h-6 w-6 text-blue-600 mr-2" />
            Dashboard de Seguimientos Enterprise
            {sistema?.optimizado && (
              <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                ⚡ Optimizado
              </span>
            )}
          </h2>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                autoRefresh ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {autoRefresh ? 'Auto ✓' : 'Manual'}
            </button>

            <button
              onClick={() => setVistaExpandida(!vistaExpandida)}
              className="px-3 py-1.5 text-sm rounded-md font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              {vistaExpandida ? 'Vista Simple' : 'Vista Completa'}
            </button>

            <button
              onClick={cargarDashboard}
              className="flex items-center px-3 py-1.5 text-sm rounded-md font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualizar
            </button>
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Seguimientos</p>
                <p className="text-2xl font-bold text-blue-900">{conteos?.total || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            (conteos?.vencidos || 0) > 5 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Vencidos</p>
                <p className={`text-2xl font-bold ${
                  (conteos?.vencidos || 0) > 5 ? 'text-red-700' : 'text-green-700'
                }`}>
                  {conteos?.vencidos || 0}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${
                (conteos?.vencidos || 0) > 5 ? 'text-red-600' : 'text-green-600'
              }`} />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Efectividad</p>
                <p className="text-2xl font-bold text-purple-900">{metricas?.efectividad || 0}%</p>
              </div>
              <Gauge className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700">Valor en Riesgo</p>
                <p className="text-xl font-bold text-yellow-900">
                  {formatearMoneda(metricas?.valor_en_riesgo || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Alertas Críticas */}
        {alertas && (Object.keys(alertas).some(key => alertas[key] === true)) && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4 border border-red-200 mb-6">
            <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center">
              <ShieldAlert className="h-5 w-5 text-red-600 mr-2" />
              Alertas Críticas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alertas.alto_valor_en_riesgo && (
                <div className="bg-white p-3 rounded-md border border-red-300">
                  <p className="text-sm font-medium text-red-700">🚨 Alto valor en riesgo por seguimientos vencidos</p>
                </div>
              )}
              {alertas.muchos_vencidos && (
                <div className="bg-white p-3 rounded-md border border-red-300">
                  <p className="text-sm font-medium text-red-700">⚠️ Demasiados seguimientos vencidos</p>
                </div>
              )}
              {alertas.efectividad_baja && (
                <div className="bg-white p-3 rounded-md border border-yellow-300">
                  <p className="text-sm font-medium text-yellow-700">📉 Efectividad por debajo del 70%</p>
                </div>
              )}
              {(alertas.seguimientos_criticos || 0) > 0 && (
                <div className="bg-white p-3 rounded-md border border-orange-300">
                  <p className="text-sm font-medium text-orange-700">
                    🔥 {alertas.seguimientos_criticos} seguimientos críticos pendientes
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700 self-center mr-2">Filtrar por urgencia:</span>
          {['todos', 'critico', 'medio', 'bajo'].map(urgencia => (
            <button
              key={urgencia}
              onClick={() => setFiltroUrgencia(urgencia)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filtroUrgencia === urgencia
                  ? urgencia === 'critico' ? 'bg-red-600 text-white' :
                    urgencia === 'medio' ? 'bg-yellow-600 text-white' :
                    urgencia === 'bajo' ? 'bg-green-600 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {urgencia === 'todos' ? 'Todos' : urgencia.charAt(0).toUpperCase() + urgencia.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Seguimientos */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Seguimientos Prioritarios ({seguimientosFiltrados.length})
        </h3>

        {seguimientosFiltrados.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="text-gray-600">¡Excelente! No hay seguimientos en esta categoría</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seguimientosFiltrados.map((seguimiento) => (
              <div
                key={seguimiento.id}
                className={`p-4 rounded-lg border-l-4 ${
                  seguimiento.categoria === 'vencido' ? 'border-red-500 bg-red-50' :
                  seguimiento.urgencia === 'critico' ? 'border-orange-500 bg-orange-50' :
                  'border-blue-500 bg-blue-50'
                } hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(seguimiento.priority_score)}
                      <span className="font-medium text-gray-900">
                        {seguimiento.prospecto_codigo}
                      </span>
                    </div>

                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${getUrgenciaColor(seguimiento.urgencia)}`}>
                      {seguimiento.urgencia}
                    </span>

                    {seguimiento.modo_libre && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                        🏁 Modo Libre
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatearMoneda(seguimiento.valor_estimado)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Score: {Math.round(seguimiento.priority_score || 0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{seguimiento.prospecto_nombre}</p>
                    <p className="text-sm text-gray-600">{seguimiento.asesor_nombre}</p>
                    <p className="text-sm text-gray-600">{seguimiento.telefono}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Tipo:</span> {seguimiento.tipo}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Estado:</span> {seguimiento.estado}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Programado:</span> {formatearFecha(seguimiento.fecha_programada)}
                    </p>
                  </div>

                  <div className="flex flex-col justify-between">
                    {vistaExpandida && (
                      <>
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <Clock className="h-4 w-4 mr-1" />
                          {seguimiento.horas_diferencia > 0
                            ? `${Math.round(seguimiento.horas_diferencia)}h transcurridas`
                            : 'Pendiente'
                          }
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Star className="h-4 w-4 mr-1" />
                          Probabilidad: {seguimiento.probabilidad_cierre}%
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completados Hoy */}
      {seguimientos?.hoy && seguimientos.hoy.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            Completados Hoy ({seguimientos.hoy.length})
          </h3>

          <div className="space-y-3">
            {seguimientos.hoy.map((seguimiento) => (
              <div key={seguimiento.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {seguimiento.prospecto_codigo} - {seguimiento.prospecto_nombre}
                    </p>
                    <p className="text-sm text-gray-600">
                      Completado: {formatearFecha(seguimiento.fecha_seguimiento)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-700">
                      {formatearMoneda(seguimiento.valor_estimado)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer con Info del Sistema */}
      {sistema && (
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>
            Última actualización: {sistema.ultima_actualizacion ?
              new Date(sistema.ultima_actualizacion).toLocaleString('es-PE') :
              'No disponible'
            }
          </p>
          {sistema.optimizado && (
            <p>⚡ Sistema optimizado con {sistema.indices_utilizados?.join(', ')} - {sistema.performance}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SeguimientosDashboardEnterprise;