// src/components/prospectos/AnalyticsEnterprise/AnalyticsEnterprise.jsx
import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Target, DollarSign, Award,
  Clock, AlertCircle, Zap, Activity, PieChart, Filter,
  Calendar, RefreshCw, Download, Eye, ArrowUp, ArrowDown
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const AnalyticsEnterprise = ({ asesorId = null }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');
  const [vistaActual, setVistaActual] = useState('resumen');

  // Cargar datos unificados
  useEffect(() => {
    cargarDatos();
  }, [asesorId, periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🚀 NUEVA FUNCIÓN UNIFICADA QUE CREAREMOS
      const response = await prospectosService.obtenerAnalyticsCompletos(asesorId, periodo);
      setDatos(response.data);

    } catch (err) {
      setError(err.message);
      console.error('Error cargando analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-gray-600">Cargando analytics empresariales...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
        <h3 className="text-red-800 font-semibold">Error al cargar datos</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={cargarDatos}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { metricas, canales, tendencias, insights } = datos || {};

  return (
    <div className="space-y-6">
      {/* 📊 HEADER UNIFICADO */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Analytics Enterprise</h2>
            <p className="text-blue-100 mt-1">Vista unificada de rendimiento y canales</p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Selector de período */}
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-md px-3 py-2 text-white"
            >
              <option value="semana_actual">Esta Semana</option>
              <option value="mes_actual">Este Mes</option>
              <option value="trimestre_actual">Este Trimestre</option>
              <option value="year_actual">Este Año</option>
            </select>

            <button
              onClick={cargarDatos}
              className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-md transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 🎯 MÉTRICAS CLAVE UNIFICADAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricaCard
          titulo="Tasa de Conversión Real"
          valor={`${metricas?.tasa_conversion_real || 0}%`}
          descripcion="Basada en ventas reales"
          icono={Target}
          color="green"
          tendencia={metricas?.tendencia_conversion}
          explicacion="Prospectos con venta confirmada / Total prospectos con seguimiento"
        />

        <MetricaCard
          titulo="Pipeline Activo"
          valor={`$${(metricas?.pipeline_activo || 0).toLocaleString()}`}
          descripcion="Valor en negociación"
          icono={DollarSign}
          color="blue"
          tendencia={metricas?.tendencia_pipeline}
          explicacion="Suma de valores estimados de prospectos activos"
        />

        <MetricaCard
          titulo="Ventas Cerradas"
          valor={`$${(metricas?.ventas_cerradas || 0).toLocaleString()}`}
          descripcion={`${metricas?.cantidad_cerradas || 0} operaciones`}
          icono={Award}
          color="purple"
          tendencia={metricas?.tendencia_ventas}
          explicacion="Suma de valores finales de ventas confirmadas"
        />

        <MetricaCard
          titulo="Efectividad Seguimientos"
          valor={`${metricas?.efectividad_seguimientos || 0}%`}
          descripcion="Seguimientos → Conversión"
          icono={Activity}
          color="orange"
          tendencia={metricas?.tendencia_efectividad}
          explicacion="Seguimientos que resultaron en venta / Total seguimientos"
        />
      </div>

      {/* 🏆 TOP CANALES MEJORADO */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <PieChart className="h-5 w-5 mr-2" />
            Rendimiento por Canal
          </h3>
          <div className="text-sm text-gray-500">
            Ordenado por ROI real
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {canales?.map((canal, index) => (
            <CanalCard
              key={canal.nombre}
              canal={canal}
              posicion={index + 1}
              esDestacado={index < 3}
            />
          ))}
        </div>
      </div>

      {/* 📈 INSIGHTS INTELIGENTES */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="h-5 w-5 text-yellow-600 mr-2" />
          Insights Automatizados
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights?.map((insight, index) => (
            <InsightCard key={index} insight={insight} />
          ))}
        </div>
      </div>

      {/* ⚡ ACCIONES RECOMENDADAS */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🎯 Acciones Recomendadas
        </h3>
        <div className="space-y-3">
          {metricas?.recomendaciones?.map((recomendacion, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-gray-700">{recomendacion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Componente para métricas individuales
const MetricaCard = ({ titulo, valor, descripcion, icono: IconComponent, color, tendencia, explicacion }) => {
  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <IconComponent className="h-6 w-6" />
        </div>
        {tendencia && (
          <div className={`flex items-center text-sm ${
            tendencia > 0 ? 'text-green-600' : tendencia < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {tendencia > 0 ? <ArrowUp className="h-4 w-4" /> :
             tendencia < 0 ? <ArrowDown className="h-4 w-4" /> : null}
            {Math.abs(tendencia)}%
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium text-gray-600">{titulo}</h4>
        <div className="text-2xl font-bold text-gray-900">{valor}</div>
        <p className="text-sm text-gray-500">{descripcion}</p>
      </div>

      {/* Tooltip explicativo */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
        {explicacion}
      </div>
    </div>
  );
};

// Componente para canales
const CanalCard = ({ canal, posicion, esDestacado }) => {
  const emojis = {
    'WhatsApp': '📱',
    'Facebook': '📘',
    'Messenger': '💬',
    'TikTok': '🎵',
    'Instagram': '📷',
    'Teléfono': '☎️',
    'Email': '📧',
    'Web': '🌐'
  };

  const medallas = ['🥇', '🥈', '🥉'];

  return (
    <div className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
      esDestacado ? 'ring-2 ring-blue-200 bg-blue-50' : ''
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{emojis[canal.nombre] || '📊'}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{canal.nombre}</h4>
            {esDestacado && (
              <span className="text-xs text-blue-600 font-medium">
                {medallas[posicion - 1]} Top {posicion}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{canal.roi}%</div>
          <div className="text-xs text-gray-500">ROI</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Prospectos:</span>
          <span className="font-medium ml-1">{canal.total_prospectos}</span>
        </div>
        <div>
          <span className="text-gray-500">Conversión:</span>
          <span className="font-medium ml-1">{canal.tasa_conversion}%</span>
        </div>
        <div>
          <span className="text-gray-500">Pipeline:</span>
          <span className="font-medium ml-1">${(canal.pipeline / 1000).toFixed(0)}k</span>
        </div>
        <div>
          <span className="text-gray-500">Cerrado:</span>
          <span className="font-medium ml-1">${(canal.cerrado / 1000).toFixed(0)}k</span>
        </div>
      </div>
    </div>
  );
};

// Componente para insights
const InsightCard = ({ insight }) => {
  const iconos = {
    'warning': '⚠️',
    'success': '✅',
    'info': 'ℹ️',
    'tip': '💡'
  };

  return (
    <div className="flex items-start space-x-3 p-3 bg-white rounded border">
      <span className="text-lg">{iconos[insight.tipo] || '📊'}</span>
      <div>
        <h5 className="font-medium text-gray-900">{insight.titulo}</h5>
        <p className="text-sm text-gray-600">{insight.descripcion}</p>
        {insight.accion && (
          <p className="text-xs text-blue-600 font-medium mt-1">
            💡 {insight.accion}
          </p>
        )}
      </div>
    </div>
  );
};

export default AnalyticsEnterprise;