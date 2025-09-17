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

  const tarjetas = [
    {
      titulo: 'Total Prospectos',
      valor: metricas.total_prospectos || 0,
      icono: Users,
      color: 'blue',
      descripcion: `${metricas.prospectos_activos || 0} activos`
    },
    {
      titulo: 'Tasa Conversión',
      valor: metricas.tasa_conversion || '0.00%',
      icono: TrendingUp,
      color: 'green',
      descripcion: `${metricas.cerrados || 0} cerrados`
    },
    {
      titulo: 'En Negociación',
      valor: metricas.en_negociacion || 0,
      icono: Target,
      color: 'yellow',
      descripcion: 'Próximos a cerrar'
    },
    {
      titulo: 'Valor Pipeline',
      valor: metricas.valor_total_pipeline ? `$${(metricas.valor_total_pipeline).toLocaleString()}` : '$0',
      icono: DollarSign,
      color: 'purple',
      descripcion: `Valor promedio: $${metricas.valor_promedio || 0}`
    }
  ];

  const colores = {
    blue: 'bg-blue-500 text-blue-600 bg-blue-50',
    green: 'bg-green-500 text-green-600 bg-green-50',
    yellow: 'bg-yellow-500 text-yellow-600 bg-yellow-50',
    purple: 'bg-purple-500 text-purple-600 bg-purple-50'
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tarjetas.map((tarjeta, index) => {
          const IconComponent = tarjeta.icono;
          const [bgColor, textColor, bgLight] = colores[tarjeta.color].split(' ');
          
          return (
            <div key={index} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${bgLight}`}>
                  <IconComponent className={`h-6 w-6 ${textColor}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{tarjeta.titulo}</p>
                  <p className="text-2xl font-bold text-gray-900">{tarjeta.valor}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">{tarjeta.descripcion}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Métricas por estado */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Distribución por Estado</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {metricas.por_estado && Object.entries(metricas.por_estado).map(([estado, cantidad]) => {
            const coloresEstado = {
              'Prospecto': 'bg-blue-100 text-blue-800',
              'Cotizado': 'bg-yellow-100 text-yellow-800',
              'Negociacion': 'bg-orange-100 text-orange-800',
              'Cerrado': 'bg-green-100 text-green-800',
              'Perdido': 'bg-red-100 text-red-800'
            };

            return (
              <div key={estado} className="text-center">
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${coloresEstado[estado] || 'bg-gray-100 text-gray-800'}`}>
                  {cantidad}
                </div>
                <p className="text-xs text-gray-600 mt-1">{estado}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Métricas adicionales */}
      {metricas.tiempo_promedio_cierre && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Métricas de Tiempo</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metricas.tiempo_promedio_cierre}</p>
              <p className="text-sm text-gray-600">Tiempo promedio de cierre</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metricas.seguimientos_pendientes || 0}</p>
              <p className="text-sm text-gray-600">Seguimientos pendientes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metricas.reasignaciones_mes || 0}</p>
              <p className="text-sm text-gray-600">Reasignaciones este mes</p>
            </div>
          </div>
        </div>
      )}

      {/* Información del asesor (si aplica) */}
      {asesorId && metricas.asesor_info && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Rendimiento de {metricas.asesor_info.nombre}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-blue-600">{metricas.asesor_info.prospectos_asignados || 0}</p>
              <p className="text-sm text-gray-600">Asignados</p>
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{metricas.asesor_info.ventas_cerradas || 0}</p>
              <p className="text-sm text-gray-600">Cerradas</p>
            </div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{metricas.asesor_info.tasa_conversion || '0%'}</p>
              <p className="text-sm text-gray-600">Conversión</p>
            </div>
            <div>
              <p className="text-xl font-bold text-purple-600">${metricas.asesor_info.valor_generado || 0}</p>
              <p className="text-sm text-gray-600">Valor generado</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineMetrics;