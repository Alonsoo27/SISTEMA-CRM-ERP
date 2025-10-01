import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, X, Calendar, MapPin, Package, DollarSign,
  TrendingUp, AlertTriangle, Clock, CheckCircle, RotateCcw,
  ChevronDown, ChevronUp, Settings, Save, Download
} from 'lucide-react';

const FiltrosAvanzados = ({
  filtros,
  onFiltrosChange,
  almacenes = [],
  productos = [],
  onBuscar,
  onLimpiar,
  onGuardarFiltro,
  filtrosGuardados = []
}) => {
  const [expanded, setExpanded] = useState(false);
  const [filtrosActivos, setFiltrosActivos] = useState(filtros || {});
  const [busquedaAvanzada, setBusquedaAvanzada] = useState(false);
  const [showGuardarModal, setShowGuardarModal] = useState(false);
  const [nombreFiltro, setNombreFiltro] = useState('');

  // Detectar cambios en filtros externos
  useEffect(() => {
    setFiltrosActivos(filtros || {});
  }, [filtros]);

  // Aplicar filtros
  const aplicarFiltros = () => {
    onFiltrosChange(filtrosActivos);
    if (onBuscar) onBuscar(filtrosActivos);
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    const filtrosVacios = {
      busqueda: '',
      almacen_id: '',
      categoria: '',
      marca: '',
      proveedor: '',
      precio_min: '',
      precio_max: '',
      stock_min: '',
      stock_max: '',
      fecha_desde: '',
      fecha_hasta: '',
      estado_stock: '',
      rotacion: '',
      solo_alertas: false,
      solo_criticos: false,
      solo_sin_movimiento: false,
      ordenar_por: 'nombre',
      orden: 'asc'
    };
    setFiltrosActivos(filtrosVacios);
    onFiltrosChange(filtrosVacios);
    if (onLimpiar) onLimpiar();
  };

  // Contar filtros activos
  const conteoFiltrosActivos = useMemo(() => {
    return Object.entries(filtrosActivos).filter(([key, value]) => {
      if (key === 'ordenar_por' || key === 'orden') return false;
      return value !== '' && value !== null && value !== false && value !== undefined;
    }).length;
  }, [filtrosActivos]);

  // Opciones de estado de stock
  const estadosStock = [
    { value: '', label: 'Todos los estados' },
    { value: 'CRITICO', label: 'Stock Crítico (0 unidades)' },
    { value: 'BAJO', label: 'Stock Bajo (< mínimo)' },
    { value: 'NORMAL', label: 'Stock Normal' },
    { value: 'ALTO', label: 'Stock Alto (> promedio)' },
    { value: 'EXCESO', label: 'Exceso de Stock' }
  ];

  // Opciones de rotación
  const tiposRotacion = [
    { value: '', label: 'Todas las rotaciones' },
    { value: 'ALTA', label: 'Rotación Alta' },
    { value: 'MEDIA', label: 'Rotación Media' },
    { value: 'BAJA', label: 'Rotación Baja' },
    { value: 'NULA', label: 'Sin Rotación' }
  ];

  // Opciones de ordenamiento
  const opcionesOrden = [
    { value: 'nombre', label: 'Nombre del Producto' },
    { value: 'codigo', label: 'Código' },
    { value: 'cantidad', label: 'Cantidad en Stock' },
    { value: 'precio', label: 'Precio' },
    { value: 'fecha_actualizacion', label: 'Última Actualización' },
    { value: 'rotacion', label: 'Rotación' },
    { value: 'valor_inventario', label: 'Valor de Inventario' }
  ];

  // Categorías únicas de productos
  const categorias = useMemo(() => {
    const cats = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
    return cats.map(cat => ({ value: cat, label: cat }));
  }, [productos]);

  // Marcas únicas de productos
  const marcas = useMemo(() => {
    const marcasUnicas = [...new Set(productos.map(p => p.marca).filter(Boolean))];
    return marcasUnicas.map(marca => ({ value: marca, label: marca }));
  }, [productos]);

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* Header de filtros */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-900">Filtros de Búsqueda</span>
            {conteoFiltrosActivos > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {conteoFiltrosActivos} activos
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBusquedaAvanzada(!busquedaAvanzada)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                busquedaAvanzada
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="h-4 w-4 mr-1 inline" />
              Avanzado
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Búsqueda rápida */}
      <div className="p-4 bg-gray-50">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código, marca o categoría..."
              value={filtrosActivos.busqueda || ''}
              onChange={(e) => setFiltrosActivos(prev => ({ ...prev, busqueda: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filtrosActivos.almacen_id || ''}
            onChange={(e) => setFiltrosActivos(prev => ({ ...prev, almacen_id: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los almacenes</option>
            {almacenes.map(almacen => (
              <option key={almacen.id} value={almacen.id}>
                {almacen.nombre} ({almacen.tipo})
              </option>
            ))}
          </select>

          <button
            onClick={aplicarFiltros}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Filtros expandidos */}
      {expanded && (
        <div className="p-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={filtrosActivos.categoria || ''}
                onChange={(e) => setFiltrosActivos(prev => ({ ...prev, categoria: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <select
                value={filtrosActivos.marca || ''}
                onChange={(e) => setFiltrosActivos(prev => ({ ...prev, marca: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas las marcas</option>
                {marcas.map(marca => (
                  <option key={marca.value} value={marca.value}>{marca.label}</option>
                ))}
              </select>
            </div>

            {/* Estado de Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado de Stock</label>
              <select
                value={filtrosActivos.estado_stock || ''}
                onChange={(e) => setFiltrosActivos(prev => ({ ...prev, estado_stock: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {estadosStock.map(estado => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </select>
            </div>

            {/* Rango de Precios */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rango de Precios</label>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    placeholder="Precio mínimo"
                    value={filtrosActivos.precio_min || ''}
                    onChange={(e) => setFiltrosActivos(prev => ({ ...prev, precio_min: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <span className="text-gray-500 self-center">-</span>
                <div className="flex-1 relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    placeholder="Precio máximo"
                    value={filtrosActivos.precio_max || ''}
                    onChange={(e) => setFiltrosActivos(prev => ({ ...prev, precio_max: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Rango de Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rango de Stock</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filtrosActivos.stock_min || ''}
                  onChange={(e) => setFiltrosActivos(prev => ({ ...prev, stock_min: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filtrosActivos.stock_max || ''}
                  onChange={(e) => setFiltrosActivos(prev => ({ ...prev, stock_max: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Filtros avanzados */}
          {busquedaAvanzada && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Rotación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rotación</label>
                  <select
                    value={filtrosActivos.rotacion || ''}
                    onChange={(e) => setFiltrosActivos(prev => ({ ...prev, rotacion: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {tiposRotacion.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                {/* Rango de Fechas */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Última Actualización</label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="date"
                        value={filtrosActivos.fecha_desde || ''}
                        onChange={(e) => setFiltrosActivos(prev => ({ ...prev, fecha_desde: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <span className="text-gray-500 self-center">hasta</span>
                    <div className="flex-1 relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="date"
                        value={filtrosActivos.fecha_hasta || ''}
                        onChange={(e) => setFiltrosActivos(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Checkboxes de filtros especiales */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filtros Especiales</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filtrosActivos.solo_alertas || false}
                        onChange={(e) => setFiltrosActivos(prev => ({ ...prev, solo_alertas: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Solo con alertas</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filtrosActivos.solo_criticos || false}
                        onChange={(e) => setFiltrosActivos(prev => ({ ...prev, solo_criticos: e.target.checked }))}
                        className="h-4 w-4 text-red-600 rounded border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Solo stock crítico</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filtrosActivos.solo_sin_movimiento || false}
                        onChange={(e) => setFiltrosActivos(prev => ({ ...prev, solo_sin_movimiento: e.target.checked }))}
                        className="h-4 w-4 text-yellow-600 rounded border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Sin movimiento (30d)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ordenamiento */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">Ordenar por:</label>
                <select
                  value={filtrosActivos.ordenar_por || 'nombre'}
                  onChange={(e) => setFiltrosActivos(prev => ({ ...prev, ordenar_por: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                >
                  {opcionesOrden.map(opcion => (
                    <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                  ))}
                </select>

                <select
                  value={filtrosActivos.orden || 'asc'}
                  onChange={(e) => setFiltrosActivos(prev => ({ ...prev, orden: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                {filtrosGuardados.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const filtroGuardado = filtrosGuardados.find(f => f.id === e.target.value);
                        if (filtroGuardado) {
                          setFiltrosActivos(filtroGuardado.filtros);
                        }
                      }
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                  >
                    <option value="">Filtros guardados</option>
                    {filtrosGuardados.map(filtro => (
                      <option key={filtro.id} value={filtro.id}>{filtro.nombre}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setShowGuardarModal(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Guardar
                </button>

                <button
                  onClick={limpiarFiltros}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-4 pt-4 border-t flex justify-between">
            <div className="flex space-x-2">
              <button
                onClick={aplicarFiltros}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </button>

              <button
                onClick={() => {
                  aplicarFiltros();
                  // Aquí se podría disparar una exportación con los filtros aplicados
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Resultados
              </button>
            </div>

            <span className="text-sm text-gray-500 self-center">
              {conteoFiltrosActivos} filtros activos
            </span>
          </div>
        </div>
      )}

      {/* Modal para guardar filtro */}
      {showGuardarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Guardar Filtro</h3>
            <input
              type="text"
              placeholder="Nombre del filtro"
              value={nombreFiltro}
              onChange={(e) => setNombreFiltro(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowGuardarModal(false);
                  setNombreFiltro('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (nombreFiltro.trim() && onGuardarFiltro) {
                    onGuardarFiltro(nombreFiltro, filtrosActivos);
                    setShowGuardarModal(false);
                    setNombreFiltro('');
                  }
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FiltrosAvanzados;