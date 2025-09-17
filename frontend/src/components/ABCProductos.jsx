import React, { useState, useEffect } from 'react';
import { 
  Package, TrendingUp, DollarSign, BarChart3, Award, 
  Download, Calendar, RefreshCw, AlertCircle, Star,
  ShoppingCart, Target, Users, Activity, Box
} from 'lucide-react';
import ventasService from '../services/ventasService';

const ABCProductos = ({ usuarioActual }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');
  const [vistaActiva, setVistaActiva] = useState('todos');

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await ventasService.obtenerDashboardABCProductos(periodo);
      
      if (response.success) {
        setDatos(response.data);
        setError(null);
      } else {
        setError(response.error || 'Error cargando datos ABC de productos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error cargando ABC productos:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    if (!valor || valor === 0) return 'S/ 0.00';
    return `S/ ${parseFloat(valor).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  const obtenerTextoSegunPeriodo = () => {
    switch(periodo) {
      case 'hoy': return 'Hoy';
      case 'semana_actual': return 'Semana Actual';
      case 'trimestre_actual': return 'Trimestre Actual';
      default: return 'Este Mes';
    }
  };

  const obtenerColorClasificacion = (clasificacion) => {
    switch(clasificacion) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-yellow-500';
      case 'C': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const obtenerProductosParaVista = () => {
    if (!datos) return [];
    
    switch(vistaActiva) {
      case 'clase-a': return datos.productos_clase_a || [];
      case 'clase-b': return datos.productos_clase_b || [];
      case 'clase-c': return datos.productos_clase_c || [];
      default: return datos.todos_productos || [];
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Error: {error}</span>
          <button 
            onClick={cargarDatos}
            className="ml-4 text-red-600 hover:text-red-800 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const metricas = datos?.metricas_productos || {};
  const productosClaseA = datos?.productos_clase_a || [];
  const productosClaseB = datos?.productos_clase_b || [];
  const productosClaseC = datos?.productos_clase_c || [];
  const productosPorAsesor = datos?.productos_por_asesor || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ABC Análisis de Productos</h1>
            <p className="text-orange-100 mt-1">
              Clasificación y rentabilidad de productos - {obtenerTextoSegunPeriodo()}
            </p>
            <p className="text-sm text-orange-200 mt-1">
              Período: {datos?.fechas?.fechaInicio} al {datos?.fechas?.fechaFin}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20"
            >
              <option value="mes_actual">Este mes</option>
              <option value="semana_actual">Esta semana</option>
              <option value="hoy">Hoy</option>
              <option value="trimestre_actual">Trimestre</option>
            </select>
            
            <button
              onClick={cargarDatos}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Métricas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Productos Vendidos</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.productos_unicos_vendidos || 0}</p>
              <p className="text-xs text-blue-600">Únicos en período</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ingresos Productos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearMoneda(metricas.ingresos_totales_productos)}
              </p>
              <p className="text-xs text-green-600">Revenue total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cantidad Vendida</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.cantidad_total_vendida || 0}</p>
              <p className="text-xs text-purple-600">Unidades totales</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Precio Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearMoneda(metricas.precio_promedio_productos)}
              </p>
              <p className="text-xs text-orange-600">Por producto</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clasificación ABC Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Star className="h-5 w-5 text-green-500 mr-2" />
                Productos Clase A
              </h3>
              <p className="text-sm text-gray-600 mt-1">Alto rendimiento (80% ingresos)</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-600">{productosClaseA.length}</p>
              <p className="text-sm text-gray-500">productos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Contribución: <span className="font-semibold text-green-600">
                {formatearMoneda(productosClaseA.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0))}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Award className="h-5 w-5 text-yellow-500 mr-2" />
                Productos Clase B
              </h3>
              <p className="text-sm text-gray-600 mt-1">Rendimiento medio (15% ingresos)</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-yellow-600">{productosClaseB.length}</p>
              <p className="text-sm text-gray-500">productos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Contribución: <span className="font-semibold text-yellow-600">
                {formatearMoneda(productosClaseB.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0))}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Box className="h-5 w-5 text-red-500 mr-2" />
                Productos Clase C
              </h3>
              <p className="text-sm text-gray-600 mt-1">Bajo rendimiento (5% ingresos)</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-red-600">{productosClaseC.length}</p>
              <p className="text-sm text-gray-500">productos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Contribución: <span className="font-semibold text-red-600">
                {formatearMoneda(productosClaseC.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0))}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Filtros de Vista */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Ver productos:</span>
          {[
            { key: 'todos', label: 'Todos', color: 'blue' },
            { key: 'clase-a', label: 'Clase A', color: 'green' },
            { key: 'clase-b', label: 'Clase B', color: 'yellow' },
            { key: 'clase-c', label: 'Clase C', color: 'red' }
          ].map(vista => (
            <button
              key={vista.key}
              onClick={() => setVistaActiva(vista.key)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                vistaActiva === vista.key
                  ? `bg-${vista.color}-100 text-${vista.color}-700 border border-${vista.color}-200`
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {vista.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Productos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-orange-600" />
            Productos - {vistaActiva === 'todos' ? 'Todos' : `Clase ${vistaActiva.slice(-1).toUpperCase()}`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clasificación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingresos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Veces Vendido
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Ingresos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {obtenerProductosParaVista().slice(0, 20).map((producto) => (
                <tr key={producto.producto_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <Package className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Producto #{producto.producto_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          {producto.asesores_que_vendieron} asesores vendieron
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${obtenerColorClasificacion(producto.clasificacion_abc)}`}>
                      Clase {producto.clasificacion_abc}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {formatearMoneda(producto.ingresos_totales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {producto.cantidad_total} unidades
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {producto.veces_vendido} ventas
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {producto.porcentaje_ingresos}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance de Asesores por Productos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Performance por Asesor - Productos
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {productosPorAsesor.map((asesor) => (
              <div key={asesor.asesor_id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Asesor #{asesor.asesor_id}</h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Productos:</span>
                      <span className="font-medium">{asesor.productos_unicos}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cantidad:</span>
                      <span className="font-medium">{asesor.cantidad_total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Líneas:</span>
                      <span className="font-medium">{asesor.lineas_vendidas}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-lg font-bold text-green-600">
                        {formatearMoneda(asesor.ingresos_productos)}
                      </p>
                      <p className="text-xs text-gray-500">ingresos productos</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ABCProductos;