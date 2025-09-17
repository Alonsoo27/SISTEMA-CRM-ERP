import React, { useState, useEffect } from 'react';
import ventasService from '../services/ventasService';
import { 
  Target, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  DollarSign, 
  Users, 
  Calendar,
  Activity,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

const MetasAvanzado = () => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');

  // Cargar datos del endpoint
  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ventasService.obtenerDashboardMetasAvanzado(periodo);
      
      if (response.success) {
        setDatos(response.data);
      } else {
        setError('Error al cargar datos de metas');
      }
    } catch (err) {
      console.error('Error cargando metas avanzado:', err);
      setError('Error de conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  // Componente de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando metas avanzado...</span>
      </div>
    );
  }

  // Componente de error
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
        <button 
          onClick={cargarDatos}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Sin datos
  if (!datos || !datos.asesores_metas || datos.asesores_metas.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Target className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-800 mb-2">No hay metas configuradas</h3>
        <p className="text-yellow-700">No se encontraron metas para el período seleccionado.</p>
      </div>
    );
  }

  const { asesores_metas, metricas_equipo, progreso_periodo, dias_transcurridos, dias_total } = datos;

  // Función para obtener color de progreso
  const getProgresoColor = (porcentaje) => {
    if (porcentaje >= 100) return 'text-green-600 bg-green-100';
    if (porcentaje >= 80) return 'text-blue-600 bg-blue-100';
    if (porcentaje >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Función para obtener ícono de tendencia
  const getTrendIcon = (porcentaje) => {
    if (porcentaje >= 100) return <CheckCircle className="h-4 w-4" />;
    if (porcentaje >= 80) return <TrendingUp className="h-4 w-4" />;
    if (porcentaje >= 50) return <Minus className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  // Función para formatear dinero
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            Metas Avanzado
          </h2>
          <p className="text-gray-600 mt-1">
            Sistema de bonos por performance y actividad
          </p>
        </div>
        
        {/* Selector de período */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="hoy">Hoy</option>
            <option value="semana_actual">Semana Actual</option>
            <option value="mes_actual">Mes Actual</option>
            <option value="trimestre_actual">Trimestre Actual</option>
          </select>
        </div>
      </div>

      {/* KPIs del Equipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Asesores</p>
              <p className="text-2xl font-bold text-gray-900">{metricas_equipo?.total_asesores || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bonos Generados</p>
              <p className="text-2xl font-bold text-green-600">{formatMoney(metricas_equipo?.bonos_total_usd)}</p>
            </div>
            <Award className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Asesores con Bono</p>
              <p className="text-2xl font-bold text-purple-600">{metricas_equipo?.asesores_con_bono || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Promedio Equipo</p>
              <p className="text-2xl font-bold text-blue-600">{metricas_equipo?.promedio_cumplimiento || 0}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Progreso del Período */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Progreso del Período
        </h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Días transcurridos: {dias_transcurridos} de {dias_total}</span>
          <span className="text-sm font-medium text-gray-900">{Math.round(progreso_periodo || 0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progreso_periodo || 0, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Tabla de Asesores */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Performance por Asesor
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asesor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modalidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meta / Logrado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progreso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bono Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Siguiente Nivel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividad
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {asesores_metas.map((asesor) => (
                <tr key={asesor.asesor_id} className="hover:bg-gray-50">
                  
                  {/* Nombre del Asesor */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">
                            {asesor.nombre.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{asesor.nombre}</div>
                        <div className="text-xs text-gray-500">{asesor.ventas_cantidad} ventas</div>
                      </div>
                    </div>
                  </td>

                  {/* Modalidad */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      asesor.modalidad === 'ventas_actividad' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {asesor.modalidad === 'ventas_actividad' ? 'Ventas + Actividad' : 'Solo Ventas'}
                    </span>
                  </td>

                  {/* Meta / Logrado */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{formatMoney(asesor.meta_usd)}</div>
                      <div className="text-gray-500">{formatMoney(asesor.valor_logrado_usd)} logrado</div>
                    </div>
                  </td>

                  {/* Progreso */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getProgresoColor(asesor.porcentaje_cumplimiento)}`}>
                        {getTrendIcon(asesor.porcentaje_cumplimiento)}
                        {Math.round(asesor.porcentaje_cumplimiento)}%
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          asesor.porcentaje_cumplimiento >= 100 ? 'bg-green-600' :
                          asesor.porcentaje_cumplimiento >= 80 ? 'bg-blue-600' :
                          asesor.porcentaje_cumplimiento >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.min(asesor.porcentaje_cumplimiento, 100)}%` }}
                      ></div>
                    </div>
                  </td>

                  {/* Bono Actual */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-bold text-green-600">{formatMoney(asesor.bono_actual)}</div>
                      <div className="text-xs text-gray-500">{asesor.nivel_bono}</div>
                    </div>
                  </td>

                  {/* Siguiente Nivel */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {asesor.siguiente_nivel ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{asesor.siguiente_nivel.objetivo}</div>
                        <div className="text-xs text-gray-500">
                          Falta: {formatMoney(asesor.siguiente_nivel.falta_usd)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">Meta Cumplida</span>
                    )}
                  </td>

                  {/* Actividad */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {asesor.modalidad === 'ventas_actividad' && asesor.actividad ? (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                          <span>{asesor.actividad.total_mensajes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-green-500" />
                          <span>{asesor.actividad.total_llamadas}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-purple-500" />
                          <span>{asesor.actividad.dias_activos}d</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen de Modalidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Solo Ventas */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            Solo Ventas
          </h4>
          <div className="space-y-2">
            {asesores_metas.filter(a => a.modalidad === 'solo_ventas').map(asesor => (
              <div key={asesor.asesor_id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-700">{asesor.nombre}</span>
                <span className="text-sm font-medium text-green-600">{formatMoney(asesor.bono_actual)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ventas + Actividad */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Ventas + Actividad
          </h4>
          <div className="space-y-2">
            {asesores_metas.filter(a => a.modalidad === 'ventas_actividad').map(asesor => (
              <div key={asesor.asesor_id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-700">{asesor.nombre}</span>
                <div className="text-right">
                  <div className="text-sm font-medium text-green-600">{formatMoney(asesor.bono_actual)}</div>
                  {asesor.actividad && (
                    <div className="text-xs text-gray-500">
                      {asesor.actividad.conversion_mensajes.toFixed(1)}% msg | {asesor.actividad.conversion_llamadas.toFixed(1)}% calls
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default MetasAvanzado;