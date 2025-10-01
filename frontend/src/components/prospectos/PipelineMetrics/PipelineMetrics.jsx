// src/components/prospectos/PipelineMetrics/PipelineMetrics.jsx
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Target, Clock, DollarSign, AlertCircle } from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const PipelineMetrics = ({ asesorId = null, refreshTrigger = 0 }) => {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarMetricas();
  }, [asesorId, refreshTrigger]);

  const cargarMetricas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await prospectosService.obtenerMetricas(asesorId);
      setMetricas(response.data);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-red-700">Error cargando métricas: {error}</p>
        </div>
        <button
          onClick={cargarMetricas}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!metricas) {
    return null;
  }

  // 📊 Tarjetas principales OPTIMIZADAS - Diseño más compacto
  const tarjetas = [
    {
      titulo: 'Total Prospectos',
      valor: metricas.total_prospectos || 0,
      icono: Users,
      color: 'blue',
      extra: `${metricas.prospectos_activos || 0} activos`,
      badge: metricas.seguimientos_pendientes > 0 ? metricas.seguimientos_pendientes : null,
      badgeLabel: 'pendientes'
    },
    {
      titulo: 'En Negociación',
      valor: metricas.en_negociacion || 0,
      icono: Target,
      color: 'orange',
      extra: 'Próximos a cerrar'
    },
    {
      titulo: 'Tasa Conversión',
      valor: metricas.tasa_conversion || '0%',
      icono: TrendingUp,
      color: 'green',
      extra: `${metricas.cerrados || 0} cerrados`
    },
    {
      titulo: 'Seguimientos',
      valor: metricas.seguimientos_pendientes || 0,
      icono: Clock,
      color: 'red',
      extra: 'Requieren atención',
      urgent: (metricas.seguimientos_pendientes || 0) > 0
    }
  ];

  const colores = {
    blue: 'bg-blue-500 text-blue-600 bg-blue-50',
    green: 'bg-green-500 text-green-600 bg-green-50',
    orange: 'bg-orange-500 text-orange-600 bg-orange-50',
    red: 'bg-red-500 text-red-600 bg-red-50'
  };

  return (
    // 🚀 DISEÑO ULTRA MINIMALISTA - UNA SOLA BARRA COMPACTA
    <div className="bg-white rounded border shadow-sm p-2 mb-4">
      <div className="flex items-center justify-between text-xs">

        {/* 📊 MÉTRICAS PRINCIPALES EN LÍNEA */}
        <div className="flex items-center space-x-4">
          {tarjetas.map((tarjeta, index) => {
            const IconComponent = tarjeta.icono;
            const [bgColor, textColor, bgLight] = colores[tarjeta.color].split(' ');

            return (
              <div key={index} className={`flex items-center space-x-1 ${tarjeta.urgent ? 'text-red-600' : ''}`}>
                <IconComponent className={`h-3 w-3 ${textColor} flex-shrink-0`} />
                <span className="font-bold text-sm">{tarjeta.valor}</span>
                {tarjeta.badge && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none ml-1">
                    {tarjeta.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 📈 ESTADOS COMPACTOS */}
        <div className="flex items-center space-x-2">
          {metricas.por_estado && Object.entries(metricas.por_estado).map(([estado, cantidad]) => {
            if (cantidad === 0) return null;

            const colores = {
              'Prospecto': 'text-blue-600',
              'Cotizado': 'text-yellow-600',
              'Negociacion': 'text-orange-600',
              'Cerrado': 'text-green-600',
              'Perdido': 'text-red-600'
            };

            const emoji = {
              'Prospecto': '👤',
              'Cotizado': '📋',
              'Negociacion': '🤝',
              'Cerrado': '✅',
              'Perdido': '❌'
            };

            return (
              <span key={estado} className={`${colores[estado]} font-medium text-xs flex items-center`}>
                {emoji[estado]}{cantidad}
              </span>
            );
          })}

          {/* 💰 VALORES ULTRA COMPACTOS */}
          {(metricas.valor_total_pipeline > 0 || metricas.valor_ventas_cerradas > 0) && (
            <>
              <span className="text-green-600 font-medium text-xs">
                📈{(metricas.valor_total_pipeline / 1000).toFixed(0)}k
              </span>
              <span className="text-blue-600 font-medium text-xs">
                💰{(metricas.valor_ventas_cerradas / 1000).toFixed(0)}k
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineMetrics;