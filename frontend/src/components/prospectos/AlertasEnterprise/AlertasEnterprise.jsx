// src/components/prospectos/AlertasEnterprise/AlertasEnterprise.jsx
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Bell, CheckCircle, XCircle, Clock,
  TrendingDown, TrendingUp, DollarSign, Users, Target,
  Flame, Shield, Activity, Zap, Eye, EyeOff
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const AlertasEnterprise = ({ asesorId = null, showOnlyActive = true }) => {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertasVistas, setAlertasVistas] = useState(new Set());
  const [filtroTipo, setFiltroTipo] = useState('todas');

  useEffect(() => {
    cargarAlertas();
    const interval = setInterval(cargarAlertas, 2 * 60 * 1000); // Cada 2 minutos
    return () => clearInterval(interval);
  }, [asesorId]);

  const cargarAlertas = async () => {
    try {
      setLoading(true);

      // Cargar datos de múltiples fuentes
      const [dashboardResponse, metricasResponse, canalesResponse] = await Promise.all([
        prospectosService.obtenerDashboardSeguimientos(asesorId),
        prospectosService.obtenerMetricas(asesorId),
        prospectosService.obtenerMetricasPorCanal(asesorId)
      ]);

      const alertasGeneradas = generarAlertas(
        dashboardResponse.data,
        metricasResponse.data,
        canalesResponse.data
      );

      setAlertas(alertasGeneradas);
    } catch (error) {
      console.error('Error cargando alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const generarAlertas = (seguimientos, metricas, canales) => {
    const alertas = [];
    const ahora = new Date();

    // 🚨 ALERTAS CRÍTICAS DE SEGUIMIENTOS
    if (seguimientos?.alertas?.alto_valor_en_riesgo) {
      alertas.push({
        id: 'valor_en_riesgo',
        tipo: 'critica',
        categoria: 'seguimientos',
        titulo: '🚨 Alto Valor en Riesgo',
        mensaje: `$${seguimientos.metricas?.valor_en_riesgo?.toLocaleString('en-US')} en riesgo por seguimientos vencidos`,
        prioridad: 10,
        timestamp: ahora,
        accion: 'Revisar seguimientos vencidos urgentemente',
        icono: DollarSign,
        color: 'red'
      });
    }

    if (seguimientos?.conteos?.vencidos > 10) {
      alertas.push({
        id: 'muchos_vencidos',
        tipo: 'alta',
        categoria: 'seguimientos',
        titulo: '⚠️ Demasiados Seguimientos Vencidos',
        mensaje: `${seguimientos.conteos.vencidos} seguimientos vencidos requieren atención`,
        prioridad: 8,
        timestamp: ahora,
        accion: 'Procesar seguimientos vencidos',
        icono: Clock,
        color: 'orange'
      });
    }

    // 📉 ALERTAS DE PERFORMANCE
    if (metricas?.metricas_avanzadas?.performance_score < 60) {
      alertas.push({
        id: 'performance_baja',
        tipo: 'media',
        categoria: 'performance',
        titulo: '📉 Performance Baja Detectada',
        mensaje: `Score de performance: ${metricas.metricas_avanzadas.performance_score}/100`,
        prioridad: 6,
        timestamp: ahora,
        accion: 'Revisar estrategia de ventas',
        icono: TrendingDown,
        color: 'yellow'
      });
    }

    const tasaConversion = parseFloat(metricas?.tasa_conversion?.replace('%', '') || 0);
    if (tasaConversion < 10) {
      alertas.push({
        id: 'conversion_baja',
        tipo: 'media',
        categoria: 'conversion',
        titulo: '🎯 Tasa de Conversión Baja',
        mensaje: `Tasa actual: ${metricas.tasa_conversion} (objetivo: >15%)`,
        prioridad: 5,
        timestamp: ahora,
        accion: 'Analizar proceso de ventas',
        icono: Target,
        color: 'yellow'
      });
    }

    // 📊 ALERTAS DE CANALES
    if (canales?.metricas_por_canal) {
      const canalProblematico = canales.metricas_por_canal.find(
        canal => canal.score_efectividad < 30 && canal.total_prospectos > 5
      );

      if (canalProblematico) {
        alertas.push({
          id: `canal_problematico_${canalProblematico.canal}`,
          tipo: 'media',
          categoria: 'canales',
          titulo: '📱 Canal con Bajo Rendimiento',
          mensaje: `${canalProblematico.canal}: Score ${canalProblematico.score_efectividad}/100`,
          prioridad: 4,
          timestamp: ahora,
          accion: 'Optimizar estrategia del canal',
          icono: Activity,
          color: 'blue'
        });
      }
    }

    // 🎉 ALERTAS POSITIVAS
    if (tasaConversion > 20) {
      alertas.push({
        id: 'excelente_conversion',
        tipo: 'positiva',
        categoria: 'logros',
        titulo: '🎉 Excelente Tasa de Conversión',
        mensaje: `¡Felicitaciones! Conversión: ${metricas.tasa_conversion}`,
        prioridad: 3,
        timestamp: ahora,
        accion: 'Mantener estrategia actual',
        icono: TrendingUp,
        color: 'green'
      });
    }

    if (seguimientos?.conteos?.vencidos === 0) {
      alertas.push({
        id: 'sin_vencidos',
        tipo: 'positiva',
        categoria: 'logros',
        titulo: '✅ Sin Seguimientos Vencidos',
        mensaje: 'Excelente gestión de seguimientos',
        prioridad: 2,
        timestamp: ahora,
        accion: 'Continuar con la buena gestión',
        icono: CheckCircle,
        color: 'green'
      });
    }

    return alertas.sort((a, b) => b.prioridad - a.prioridad);
  };

  const marcarComoVista = (alertaId) => {
    setAlertasVistas(prev => new Set([...prev, alertaId]));
  };

  const getColorClass = (color, visto) => {
    const baseClasses = {
      red: visto ? 'bg-red-50 border-red-200' : 'bg-red-100 border-red-400',
      orange: visto ? 'bg-orange-50 border-orange-200' : 'bg-orange-100 border-orange-400',
      yellow: visto ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-100 border-yellow-400',
      blue: visto ? 'bg-blue-50 border-blue-200' : 'bg-blue-100 border-blue-400',
      green: visto ? 'bg-green-50 border-green-200' : 'bg-green-100 border-green-400'
    };
    return baseClasses[color] || baseClasses.blue;
  };

  const alertasFiltradas = alertas.filter(alerta => {
    if (showOnlyActive && alertasVistas.has(alerta.id)) return false;
    if (filtroTipo === 'todas') return true;
    return alerta.categoria === filtroTipo;
  });

  const conteosPorTipo = alertas.reduce((acc, alerta) => {
    acc[alerta.tipo] = (acc[alerta.tipo] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Bell className="h-5 w-5 text-blue-600 mr-2" />
          Centro de Alertas Enterprise
          {alertasFiltradas.length > 0 && (
            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
              {alertasFiltradas.length}
            </span>
          )}
        </h3>

        <div className="flex gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value="todas">Todas las categorías</option>
            <option value="seguimientos">Seguimientos</option>
            <option value="performance">Performance</option>
            <option value="canales">Canales</option>
            <option value="logros">Logros</option>
          </select>
        </div>
      </div>

      {/* Resumen de Alertas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { tipo: 'critica', label: 'Críticas', color: 'text-red-600', icon: AlertTriangle },
          { tipo: 'alta', label: 'Alta', color: 'text-orange-600', icon: Flame },
          { tipo: 'media', label: 'Media', color: 'text-yellow-600', icon: Clock },
          { tipo: 'positiva', label: 'Positivas', color: 'text-green-600', icon: CheckCircle },
          { tipo: 'total', label: 'Total', color: 'text-blue-600', icon: Activity }
        ].map(({ tipo, label, color, icon: Icon }) => (
          <div key={tipo} className="text-center p-3 bg-gray-50 rounded-lg">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
            <p className="text-xs text-gray-600">{label}</p>
            <p className={`text-lg font-bold ${color}`}>
              {tipo === 'total' ? alertas.length : (conteosPorTipo[tipo] || 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Lista de Alertas */}
      {alertasFiltradas.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p className="text-gray-600 font-medium">¡Todo bajo control!</p>
          <p className="text-sm text-gray-500">No hay alertas activas en este momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertasFiltradas.map((alerta) => {
            const visto = alertasVistas.has(alerta.id);
            const IconComponent = alerta.icono;

            return (
              <div
                key={alerta.id}
                className={`p-4 rounded-lg border-l-4 transition-all duration-200 ${
                  getColorClass(alerta.color, visto)
                } ${visto ? 'opacity-70' : 'hover:shadow-md'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <IconComponent className={`h-5 w-5 mt-0.5 ${
                      alerta.color === 'red' ? 'text-red-600' :
                      alerta.color === 'orange' ? 'text-orange-600' :
                      alerta.color === 'yellow' ? 'text-yellow-600' :
                      alerta.color === 'blue' ? 'text-blue-600' :
                      'text-green-600'
                    }`} />

                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">{alerta.titulo}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          alerta.tipo === 'critica' ? 'bg-red-200 text-red-800' :
                          alerta.tipo === 'alta' ? 'bg-orange-200 text-orange-800' :
                          alerta.tipo === 'media' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {alerta.tipo}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">{alerta.mensaje}</p>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Acción sugerida:</span> {alerta.accion}
                        </p>
                        <p className="text-xs text-gray-500">
                          {alerta.timestamp.toLocaleTimeString('es-PE', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!visto && (
                    <button
                      onClick={() => marcarComoVista(alerta.id)}
                      className="ml-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Marcar como vista"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <p>Actualización automática cada 2 minutos</p>
          <p>Sistema de alertas inteligente activado</p>
        </div>
      </div>
    </div>
  );
};

export default AlertasEnterprise;