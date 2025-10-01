import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, Filter, ChevronDown, ChevronRight, AlertTriangle,
  TrendingUp, DollarSign, Warehouse, BarChart3, Eye, Edit, RefreshCw,
  ArrowRightLeft, Plus, Minus, MapPin, Layers, Clock, CheckCircle
} from 'lucide-react';
import almacenService from '../../services/almacenService';

const InventarioEstrategico = ({ filtros = {}, onRefresh }) => {
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [filtrosLocales, setFiltrosLocales] = useState({
    busqueda: '',
    almacen_id: '',
    estado_stock: '',
    solo_con_stock: false,
    ...filtros
  });

  // Cargar datos del inventario
  useEffect(() => {
    cargarInventario();
  }, [filtrosLocales]);

  const cargarInventario = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit: 100, // Cargar por páginas
        ...(filtrosLocales.busqueda && { busqueda: filtrosLocales.busqueda }),
        ...(filtrosLocales.almacen_id && { almacen_id: filtrosLocales.almacen_id }),
        ...(filtrosLocales.estado_stock && { estado_stock: filtrosLocales.estado_stock })
      };

      const response = await almacenService.obtenerInventario(params);

      if (response.success) {
        setInventarioRaw(response.data);
      } else {
        setError(response.error || 'Error al cargar inventario');
      }
    } catch (error) {
      console.error('Error cargando inventario:', error);
      setError('Error de conexión al cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  // Consolidar inventario por producto
  const productosConsolidados = useMemo(() => {
    const productosMap = new Map();

    inventarioRaw.forEach(item => {
      const key = item.producto_codigo;

      if (productosMap.has(key)) {
        const existing = productosMap.get(key);

        // Agregar almacén al producto existente
        existing.almacenes.push({
          id: item.almacen_id,
          codigo: item.almacen_codigo,
          nombre: item.almacen_nombre,
          tipo: item.almacen_tipo,
          piso: item.piso,
          stock_actual: parseFloat(item.stock_actual) || 0,
          stock_minimo: parseFloat(item.stock_minimo) || 0,
          estado_stock: item.estado_stock,
          valor_inventario: parseFloat(item.valor_inventario) || 0,
          ultimo_movimiento: item.ultimo_movimiento
        });

        // Actualizar totales
        existing.stock_total += parseFloat(item.stock_actual) || 0;
        existing.valor_total += parseFloat(item.valor_inventario) || 0;
        existing.almacenes_con_stock += (parseFloat(item.stock_actual) || 0) > 0 ? 1 : 0;

        // Determinar estado general más crítico
        if (item.estado_stock === 'AGOTADO' || existing.estado_general === 'AGOTADO') {
          existing.estado_general = 'AGOTADO';
        } else if (item.estado_stock === 'BAJO' && existing.estado_general !== 'AGOTADO') {
          existing.estado_general = 'BAJO';
        }
      } else {
        // Crear nueva entrada
        productosMap.set(key, {
          producto_id: item.producto_id,
          producto_codigo: item.producto_codigo,
          producto_descripcion: item.producto_descripcion,
          marca: item.marca,
          unidad_medida: item.unidad_medida,
          categoria: item.categoria,
          stock_total: parseFloat(item.stock_actual) || 0,
          valor_total: parseFloat(item.valor_inventario) || 0,
          almacenes_totales: 1,
          almacenes_con_stock: (parseFloat(item.stock_actual) || 0) > 0 ? 1 : 0,
          estado_general: item.estado_stock,
          almacenes: [{
            id: item.almacen_id,
            codigo: item.almacen_codigo,
            nombre: item.almacen_nombre,
            tipo: item.almacen_tipo,
            piso: item.piso,
            stock_actual: parseFloat(item.stock_actual) || 0,
            stock_minimo: parseFloat(item.stock_minimo) || 0,
            estado_stock: item.estado_stock,
            valor_inventario: parseFloat(item.valor_inventario) || 0,
            ultimo_movimiento: item.ultimo_movimiento
          }]
        });
      }
    });

    // Aplicar filtros post-consolidación
    let productos = Array.from(productosMap.values());

    if (filtrosLocales.solo_con_stock) {
      productos = productos.filter(p => p.stock_total > 0);
    }

    if (filtrosLocales.estado_stock) {
      productos = productos.filter(p => p.estado_general === filtrosLocales.estado_stock);
    }

    // Ordenar por estado crítico primero, luego por código
    productos.sort((a, b) => {
      const prioridadEstado = { 'AGOTADO': 3, 'BAJO': 2, 'NORMAL': 1 };
      const prioridadA = prioridadEstado[a.estado_general] || 0;
      const prioridadB = prioridadEstado[b.estado_general] || 0;

      if (prioridadA !== prioridadB) {
        return prioridadB - prioridadA; // Más crítico primero
      }

      return a.producto_codigo.localeCompare(b.producto_codigo);
    });

    return productos;
  }, [inventarioRaw, filtrosLocales]);

  // Formatear moneda en USD
  const formatearUSD = (monto) => {
    if (monto === null || monto === undefined || isNaN(monto)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(monto);
  };

  // Formatear cantidad
  const formatearCantidad = (cantidad, unidad = '') => {
    if (cantidad === null || cantidad === undefined || isNaN(cantidad)) return '0';
    return `${Number(cantidad).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unidad}`.trim();
  };

  // Obtener badge de estado
  const getBadgeEstado = (estado, almacenesConStock, almacenesTotales) => {
    const porcentajeCobertura = (almacenesConStock / almacenesTotales) * 100;

    switch (estado) {
      case 'AGOTADO':
        return { color: 'bg-red-100 text-red-800 border-red-200', texto: 'Sin Stock', icono: AlertTriangle };
      case 'BAJO':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', texto: 'Stock Bajo', icono: AlertTriangle };
      case 'NORMAL':
        if (porcentajeCobertura === 100) {
          return { color: 'bg-green-100 text-green-800 border-green-200', texto: 'Stock Completo', icono: CheckCircle };
        } else {
          return { color: 'bg-blue-100 text-blue-800 border-blue-200', texto: 'Stock Parcial', icono: Package };
        }
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', texto: 'Indefinido', icono: Package };
    }
  };

  // Toggle expandir producto
  const toggleExpanded = (productoCodigo) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productoCodigo)) {
        newSet.delete(productoCodigo);
      } else {
        newSet.add(productoCodigo);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar inventario</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={cargarInventario}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={filtrosLocales.busqueda}
                onChange={(e) => setFiltrosLocales(prev => ({ ...prev, busqueda: e.target.value }))}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filtrosLocales.estado_stock}
              onChange={(e) => setFiltrosLocales(prev => ({ ...prev, estado_stock: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Todos los estados</option>
              <option value="AGOTADO">Sin Stock</option>
              <option value="BAJO">Stock Bajo</option>
              <option value="NORMAL">Stock Normal</option>
            </select>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filtrosLocales.solo_con_stock}
                onChange={(e) => setFiltrosLocales(prev => ({ ...prev, solo_con_stock: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-2"
              />
              <span className="text-sm text-gray-700">Solo con stock</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {productosConsolidados.length} productos encontrados
            </span>
            <button
              onClick={() => {
                cargarInventario();
                if (onRefresh) onRefresh();
              }}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de productos consolidados */}
      <div className="space-y-2">
        {productosConsolidados.map(producto => {
          const isExpanded = expandedProducts.has(producto.producto_codigo);
          const badge = getBadgeEstado(producto.estado_general, producto.almacenes_con_stock, producto.almacenes.length);
          const IconoEstado = badge.icono;

          return (
            <div key={producto.producto_codigo} className="bg-white rounded-lg shadow border">
              {/* Header del producto */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(producto.producto_codigo)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button className="text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>

                    <div>
                      <h3 className="font-semibold text-gray-900">{producto.producto_codigo}</h3>
                      <p className="text-sm text-gray-600">{producto.producto_descripcion}</p>
                      <p className="text-xs text-gray-500">{producto.marca}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    {/* Ubicaciones */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {producto.almacenes_con_stock}/{producto.almacenes.length} ubicaciones
                      </p>
                      <p className="text-xs text-gray-500">con stock</p>
                    </div>

                    {/* Stock total */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatearCantidad(producto.stock_total, producto.unidad_medida)}
                      </p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>

                    {/* Estado */}
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                        <IconoEstado className="h-3 w-3 mr-1" />
                        {badge.texto}
                      </span>
                    </div>

                    {/* Valor total */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatearUSD(producto.valor_total)}
                      </p>
                      <p className="text-xs text-gray-500">Valor total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desglose por almacenes */}
              {isExpanded && (
                <div className="border-t bg-gray-50">
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Distribución por almacén:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {producto.almacenes.map(almacen => (
                        <div key={almacen.id} className="bg-white rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h5 className="font-medium text-gray-900 text-sm">{almacen.nombre}</h5>
                              <p className="text-xs text-gray-500">{almacen.codigo} • {almacen.tipo}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              almacen.estado_stock === 'AGOTADO' ? 'bg-red-100 text-red-800' :
                              almacen.estado_stock === 'BAJO' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {almacen.estado_stock}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Stock:</span>
                              <span className="font-medium">
                                {formatearCantidad(almacen.stock_actual, producto.unidad_medida)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Valor:</span>
                              <span className="font-medium text-green-600">
                                {formatearUSD(almacen.valor_inventario)}
                              </span>
                            </div>
                            {almacen.stock_minimo > 0 && (
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>Mínimo:</span>
                                <span>{formatearCantidad(almacen.stock_minimo)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {productosConsolidados.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron productos</h3>
          <p className="text-gray-600 mb-4">Intenta ajustar los filtros de búsqueda</p>
          <button
            onClick={() => setFiltrosLocales({ busqueda: '', almacen_id: '', estado_stock: '', solo_con_stock: false })}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
};

export default InventarioEstrategico;