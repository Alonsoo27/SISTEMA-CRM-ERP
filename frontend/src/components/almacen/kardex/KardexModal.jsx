import React, { useState, useEffect, useMemo } from 'react';
import { X, Filter, Download, Calendar, Building2, FileText, ArrowUpDown, Search, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import almacenService from '../../../services/almacenService';

const KardexModal = ({ isOpen, onClose, producto, almacenes = [] }) => {
  const [kardexData, setKardexData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    almacen_id: '',
    tipo_movimiento: '',
    busqueda: ''
  });
  const [busquedaInput, setBusquedaInput] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [ordenamiento, setOrdenamiento] = useState({
    campo: 'fecha_movimiento',
    direccion: 'desc'
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const tiposMovimiento = useMemo(() => [
    { value: '', label: 'Todos los movimientos' },
    { value: 'ENTRADA', label: 'Entradas', icon: TrendingUp, color: 'text-green-600' },
    { value: 'SALIDA', label: 'Salidas', icon: TrendingDown, color: 'text-red-600' },
    { value: 'AJUSTE_POSITIVO', label: 'Ajuste Positivo', icon: TrendingUp, color: 'text-blue-600' },
    { value: 'AJUSTE_NEGATIVO', label: 'Ajuste Negativo', icon: TrendingDown, color: 'text-orange-600' },
    { value: 'TRANSFERENCIA', label: 'Transferencias', icon: ArrowUpDown, color: 'text-purple-600' },
    { value: 'INICIAL', label: 'Stock Inicial', icon: Minus, color: 'text-gray-600' }
  ], []);

  useEffect(() => {
    if (isOpen && producto?.id) {
      cargarKardex();
    }
  }, [isOpen, producto?.id]);

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      if (busquedaInput !== filtros.busqueda) {
        setFiltros(prev => ({ ...prev, busqueda: busquedaInput }));
      }
    }, 500);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [busquedaInput]);

  useEffect(() => {
    if (isOpen && producto?.id) {
      cargarKardex();
    }
  }, [filtros]);

  const cargarKardex = async () => {
    if (!producto?.id) return;

    setLoading(true);
    try {
      const response = await almacenService.obtenerKardexProducto(producto.id, filtros);
      if (response.success) {
        setKardexData(response.data || []);
      } else {
        console.error('Error cargando kardex:', response.error);
        setKardexData([]);
      }
    } catch (error) {
      console.error('Error cargando kardex:', error);
      setKardexData([]);
    } finally {
      setLoading(false);
    }
  };

  const datosOrdenados = useMemo(() => {
    if (!kardexData.length) return [];

    const datos = [...kardexData];

    datos.sort((a, b) => {
      let valorA = a[ordenamiento.campo];
      let valorB = b[ordenamiento.campo];

      if (ordenamiento.campo === 'fecha_movimiento') {
        valorA = new Date(valorA);
        valorB = new Date(valorB);
      } else if (ordenamiento.campo === 'cantidad' || ordenamiento.campo === 'stock_acumulado') {
        valorA = parseFloat(valorA) || 0;
        valorB = parseFloat(valorB) || 0;
      } else {
        valorA = String(valorA).toLowerCase();
        valorB = String(valorB).toLowerCase();
      }

      if (ordenamiento.direccion === 'asc') {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });

    return datos;
  }, [kardexData, ordenamiento]);

  const cambiarOrdenamiento = (campo) => {
    setOrdenamiento(prev => ({
      campo,
      direccion: prev.campo === campo && prev.direccion === 'desc' ? 'asc' : 'desc'
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      fecha_desde: '',
      fecha_hasta: '',
      almacen_id: '',
      tipo_movimiento: '',
      busqueda: ''
    });
    setBusquedaInput('');
  };

  const exportarKardex = () => {
    if (!datosOrdenados.length) return;

    const encabezados = [
      'Fecha',
      'Tipo Movimiento',
      'Almacén',
      'Motivo',
      'Cantidad',
      'Stock Acumulado',
      'Usuario',
      'Referencia'
    ];

    const filas = datosOrdenados.map(item => [
      new Date(item.fecha_movimiento).toLocaleDateString('es-ES'),
      item.tipo_movimiento,
      item.almacen_nombre || '',
      item.motivo || '',
      item.cantidad || 0,
      item.stock_acumulado || 0,
      item.usuario_nombre || '',
      item.referencia_numero || ''
    ]);

    const csvContent = [encabezados, ...filas]
      .map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    const fechaActual = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `kardex_${producto.codigo}_${fechaActual}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearCantidad = (cantidad) => {
    if (!cantidad && cantidad !== 0) return '0';
    return parseFloat(cantidad).toLocaleString('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const obtenerIconoTipoMovimiento = (tipo) => {
    const tipoConfig = tiposMovimiento.find(t => t.value === tipo);
    if (tipoConfig?.icon) {
      const IconComponent = tipoConfig.icon;
      return <IconComponent className={`w-4 h-4 ${tipoConfig.color}`} />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const obtenerColorTipoMovimiento = (tipo) => {
    const tipoConfig = tiposMovimiento.find(t => t.value === tipo);
    return tipoConfig?.color || 'text-gray-600';
  };

  const stockActual = datosOrdenados.length > 0
    ? datosOrdenados[datosOrdenados.length - 1]?.stock_acumulado || 0
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Kardex - {producto?.nombre}
              </h2>
              <p className="text-sm text-gray-600">
                Código: {producto?.codigo} | Stock Actual: {formatearCantidad(stockActual)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Filtros y controles */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Búsqueda */}
            <div className="flex items-center space-x-2 flex-1 min-w-64">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar en motivo, referencia..."
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Controles */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Filtros</span>
              </button>

              <button
                onClick={cargarKardex}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>

              <button
                onClick={exportarKardex}
                disabled={!datosOrdenados.length}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          {/* Panel de filtros expandible */}
          {mostrarFiltros && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={filtros.fecha_desde}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fecha_desde: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={filtros.fecha_hasta}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Almacén
                </label>
                <select
                  value={filtros.almacen_id}
                  onChange={(e) => setFiltros(prev => ({ ...prev, almacen_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos los almacenes</option>
                  {almacenes.map(almacen => (
                    <option key={almacen.id} value={almacen.id}>
                      {almacen.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ArrowUpDown className="w-4 h-4 inline mr-1" />
                  Tipo Movimiento
                </label>
                <select
                  value={filtros.tipo_movimiento}
                  onChange={(e) => setFiltros(prev => ({ ...prev, tipo_movimiento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {tiposMovimiento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={limpiarFiltros}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-2 text-gray-600">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Cargando kardex...</span>
              </div>
            </div>
          ) : datosOrdenados.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No hay movimientos</p>
                <p className="text-sm">No se encontraron movimientos con los filtros seleccionados</p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => cambiarOrdenamiento('fecha_movimiento')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Fecha</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => cambiarOrdenamiento('tipo_movimiento')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Tipo</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Almacén
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => cambiarOrdenamiento('cantidad')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Cantidad</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => cambiarOrdenamiento('stock_acumulado')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Stock Acumulado</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referencia
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {datosOrdenados.map((item, index) => (
                    <tr key={`${item.id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatearFecha(item.fecha_movimiento)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {obtenerIconoTipoMovimiento(item.tipo_movimiento)}
                          <span className={`text-sm font-medium ${obtenerColorTipoMovimiento(item.tipo_movimiento)}`}>
                            {item.tipo_movimiento}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span>{item.almacen_nombre || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate" title={item.motivo}>
                        {item.motivo || 'Sin motivo especificado'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span className={
                          parseFloat(item.cantidad) > 0
                            ? 'text-green-600'
                            : parseFloat(item.cantidad) < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }>
                          {parseFloat(item.cantidad) > 0 ? '+' : ''}{formatearCantidad(item.cantidad)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600">
                        {formatearCantidad(item.stock_acumulado)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {item.usuario_nombre || 'Sistema'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {item.referencia_numero && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {item.referencia_numero}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer con información adicional */}
        {datosOrdenados.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>Total de movimientos: <span className="font-medium text-gray-900">{datosOrdenados.length}</span></span>
                <span>Stock actual: <span className="font-bold text-blue-600">{formatearCantidad(stockActual)}</span></span>
              </div>
              <div className="text-xs text-gray-500">
                Última actualización: {new Date().toLocaleTimeString('es-ES')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KardexModal;