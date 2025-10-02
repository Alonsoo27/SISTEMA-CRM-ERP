import React, { useState, useEffect } from 'react';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';
import { API_CONFIG } from '../../../config/apiConfig';

const DashboardProductos = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    periodo: '30',
    linea_producto: ''
  });

  // Cargar datos del dashboard
  const cargarDashboard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');

      const params = new URLSearchParams();
      params.append('periodo', filtros.periodo);
      if (filtros.linea_producto) {
        params.append('linea_producto', filtros.linea_producto);
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/dashboard?${params.toString()}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setDashboardData(data.data);
        setError(null);
      } else {
        throw new Error(data.error || 'Error cargando dashboard');
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, [filtros]);

  const handleFiltroChange = (key, value) => {
    setFiltros(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const formatearNumero = (numero) => {
    if (!numero && numero !== 0) return '0';
    return new Intl.NumberFormat('es-ES').format(numero);
  };

  const formatearPrecio = (precio) => {
    if (!precio && precio !== 0) return '$0.00';
    return `$${parseFloat(precio).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error cargando dashboard</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={cargarDashboard}
              className="mt-3 text-sm text-red-600 hover:text-red-500 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles y Filtros */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filtros</span>

            {/* Filtro de período */}
            <select
              value={filtros.periodo}
              onChange={(e) => handleFiltroChange('periodo', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </select>

            {/* Filtro de línea de producto */}
            <input
              type="text"
              placeholder="Filtrar por línea..."
              value={filtros.linea_producto}
              onChange={(e) => handleFiltroChange('linea_producto', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={cargarDashboard}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearNumero(dashboardData?.resumen?.total_productos || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <PieChart className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Líneas de Producto</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearNumero(dashboardData?.resumen?.total_lineas || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-purple-100">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Valor Inventario</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearPrecio(dashboardData?.resumen?.valor_total_inventario || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-amber-100">
              <BarChart3 className="h-6 w-6 text-amber-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Precio Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearPrecio(dashboardData?.resumen?.precio_promedio || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productos Top */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Productos por Precio</h3>
          </div>
          <div className="p-6">
            {dashboardData?.top_productos?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.top_productos.slice(0, 8).map((producto, index) => (
                  <div key={producto.codigo} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{producto.codigo}</p>
                        <p className="text-xs text-gray-600 truncate max-w-md">{producto.descripcion}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{formatearPrecio(producto.precio_sin_igv)}</p>
                      <p className="text-xs text-gray-600">
                        {producto.linea_producto || 'Sin línea'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay productos para mostrar</p>
              </div>
            )}
          </div>
        </div>

        {/* Líneas de Producto */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Líneas de Producto</h3>
          </div>
          <div className="p-6">
            {dashboardData?.lineas_producto?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.lineas_producto.slice(0, 10).map((linea, index) => (
                  <div key={`${linea.linea_producto}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        index % 4 === 0 ? 'bg-blue-500' :
                        index % 4 === 1 ? 'bg-green-500' :
                        index % 4 === 2 ? 'bg-yellow-500' : 'bg-purple-500'
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {linea.linea_producto || 'Sin línea'}
                        </p>
                        {linea.sublinea_producto && linea.sublinea_producto !== 'Sin sublínea' && (
                          <p className="text-xs text-gray-500">{linea.sublinea_producto}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatearNumero(linea.cantidad_productos)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay líneas de producto</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardProductos;