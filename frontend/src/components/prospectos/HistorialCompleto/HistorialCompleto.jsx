import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  BarChart3,
  Eye
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const HistorialCompleto = ({ asesorId = 1, onClose }) => {
  const [historialData, setHistorialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    page: 1,
    limit: 20,
    fecha_desde: '',
    fecha_hasta: '',
    tipo_actividad: 'todos',
    estado: 'todos'
  });

  // Cargar datos
  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const response = await prospectosService.obtenerHistorialCompleto(asesorId, filtros);

      if (response.success) {
        setHistorialData(response.data);
        setError(null);
      } else {
        setError(response.error || 'Error al cargar historial');
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError('Error de conexión al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, [asesorId, filtros]);

  // Manejar cambios de filtros
  const handleFiltroChange = (key, value) => {
    setFiltros(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset a primera página
    }));
  };

  // Cambiar página
  const cambiarPagina = (nuevaPagina) => {
    setFiltros(prev => ({
      ...prev,
      page: nuevaPagina
    }));
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatear dinero
  const formatearDinero = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(cantidad);
  };

  // Obtener icono y color por tipo de actividad
  const getActividadInfo = (tipoActividad) => {
    switch (tipoActividad) {
      case 'conversion':
        return {
          icono: <DollarSign className="h-5 w-5" />,
          color: 'text-green-600 bg-green-100',
          texto: 'Conversión'
        };
      case 'perdida':
        return {
          icono: <XCircle className="h-5 w-5" />,
          color: 'text-red-600 bg-red-100',
          texto: 'Perdido'
        };
      case 'seguimiento_completado':
        return {
          icono: <CheckCircle className="h-5 w-5" />,
          color: 'text-blue-600 bg-blue-100',
          texto: 'Completado'
        };
      case 'seguimiento_vencido':
        return {
          icono: <Clock className="h-5 w-5" />,
          color: 'text-orange-600 bg-orange-100',
          texto: 'Vencido'
        };
      default:
        return {
          icono: <Clock className="h-5 w-5" />,
          color: 'text-gray-600 bg-gray-100',
          texto: 'Pendiente'
        };
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4">Cargando historial completo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md">
          <div className="text-red-600 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error</h3>
            <p>{error}</p>
            <div className="mt-4 space-x-2">
              <button
                onClick={cargarHistorial}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reintentar
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { historial, paginacion, metricas_resumen } = historialData || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center">
                <BarChart3 className="h-7 w-7 mr-3" />
                Historial Completo - Asesor #{asesorId}
              </h2>
              <p className="text-blue-100 mt-1">
                Análisis empresarial completo de actividades y conversiones
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Métricas resumen */}
          {metricas_resumen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                <Target className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">{metricas_resumen.total_actividades}</div>
                <div className="text-sm text-blue-100">Total Actividades</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                <Award className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">{metricas_resumen.conversiones}</div>
                <div className="text-sm text-blue-100">Conversiones</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">{formatearDinero(metricas_resumen.valor_total_ventas)}</div>
                <div className="text-sm text-blue-100">Valor Total</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">{metricas_resumen.tasa_conversion}%</div>
                <div className="text-sm text-blue-100">Tasa Conversión</div>
              </div>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Actividad</label>
              <select
                value={filtros.tipo_actividad}
                onChange={(e) => handleFiltroChange('tipo_actividad', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="todos">Todas</option>
                <option value="conversion">Conversiones</option>
                <option value="perdida">Perdidas</option>
                <option value="seguimiento_completado">Seguimientos</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registros por página</label>
              <select
                value={filtros.limit}
                onChange={(e) => handleFiltroChange('limit', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFiltros({
                  page: 1,
                  limit: 20,
                  fecha_desde: '',
                  fecha_hasta: '',
                  tipo_actividad: 'todos',
                  estado: 'todos'
                })}
                className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-y-auto max-h-[60vh]">
          {historial && historial.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actividad</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Prospecto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Resultado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Valor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((item, index) => {
                  const actividadInfo = getActividadInfo(item.tipo_actividad);

                  return (
                    <tr key={item.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900">{formatearFecha(item.fecha_actividad)}</div>
                        <div className="text-gray-500 text-xs">
                          {item.metricas.dias_proceso.toFixed(0)} días proceso
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-sm ${actividadInfo.color}`}>
                          {actividadInfo.icono}
                          <span className="ml-2">{actividadInfo.texto}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.actividad.tipo_contexto || item.actividad.tipo}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.prospecto.nombre}</div>
                        <div className="text-xs text-gray-500">{item.prospecto.codigo}</div>
                        <div className="text-xs text-gray-500">{item.prospecto.telefono}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{item.actividad.resultado}</div>
                        {item.actividad.notas && (
                          <div className="text-xs text-gray-500 max-w-xs truncate">
                            {item.actividad.notas}
                          </div>
                        )}
                        {item.conversion && (
                          <div className="text-xs text-green-600 font-medium">
                            Venta: {item.conversion.codigo}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {formatearDinero(item.prospecto.valor_estimado)}
                        </div>
                        {item.conversion && (
                          <div className="text-sm text-green-600 font-bold">
                            {formatearDinero(item.conversion.total)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Prob: {item.prospecto.probabilidad_cierre}%
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <button className="text-blue-600 hover:text-blue-800 text-sm">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay resultados</h3>
              <p className="text-gray-500">No se encontraron actividades con los filtros seleccionados</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {paginacion && historial && historial.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Página {paginacion.page} • {historial.length} resultados
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => cambiarPagina(paginacion.page - 1)}
                disabled={paginacion.page <= 1}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => cambiarPagina(paginacion.page + 1)}
                disabled={!paginacion.has_next}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorialCompleto;