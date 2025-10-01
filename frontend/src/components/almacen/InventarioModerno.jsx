import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Search, Filter, ChevronDown, ChevronRight, AlertTriangle,
  TrendingUp, DollarSign, Warehouse, BarChart3, Eye, Edit, RefreshCw,
  MapPin, Layers, Clock, CheckCircle, Building, Home, Store,
  Archive, Zap, Activity, ExternalLink, Copy, ArrowUpDown, X, Plus, FileText
} from 'lucide-react';
import almacenService from '../../services/almacenService';
import InventarioForm from './inventario/InventarioForm';
import KardexModal from './kardex/KardexModal';

const InventarioModerno = ({ filtros = {}, onRefresh, usuario = { rol: 'VENDEDOR' } }) => {
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [inventarioCache, setInventarioCache] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [filtrosLocales, setFiltrosLocales] = useState({
    busqueda: '',
    estado_stock: '',
    linea_producto: '',
    sublinea_producto: '',
    solo_con_stock: false,
    ...filtros
  });
  const [busquedaInput, setBusquedaInput] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedInventarioItem, setSelectedInventarioItem] = useState(null);
  const [lineasDisponibles, setLineasDisponibles] = useState([]);
  const [sublineasDisponibles, setSublineasDisponibles] = useState([]);
  const [showKardexModal, setShowKardexModal] = useState(false);
  const [selectedProductoKardex, setSelectedProductoKardex] = useState(null);
  const [almacenesData, setAlmacenesData] = useState([]);

  // Verificar permisos para edición
  const puedeEditarStock = useMemo(() => {
    return ['ALMACENERO', 'JEFE_ALMACEN', 'SUPER_ADMIN'].includes(usuario?.rol);
  }, [usuario?.rol]);

  // Cargar datos del inventario y almacenes (solo la primera vez)
  useEffect(() => {
    cargarInventario();
    cargarAlmacenes();
  }, []);

  // Debouncing para búsqueda
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      setFiltrosLocales(prev => ({ ...prev, busqueda: busquedaInput }));
    }, 500);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [busquedaInput]);

  const cargarInventario = async () => {
    try {
      setLoading(true);
      setError(null);

      // Intentar cargar todos los productos de una vez
      // 481 productos × 11 almacenes = 5,291 registros necesarios
      let params = {
        limit: 6000, // Suficiente para todos los productos en todos los almacenes
      };

      let response = await almacenService.obtenerInventario(params);

      // Si no funciona con 1000, usar paginación automática
      if (!response.success) {
        console.log('Limite alto falló, usando paginación automática para cargar ~5,291 registros...');
        const todosLosProductos = await cargarInventarioCompleto();

        if (todosLosProductos) {
          setInventarioRaw(todosLosProductos);
          setInventarioCache(todosLosProductos);

          // Extraer líneas y sublíneas únicas para los filtros
          const lineasUnicas = [...new Set(todosLosProductos.map(item => item.linea_producto).filter(Boolean))];
          const sublineasUnicas = [...new Set(todosLosProductos.map(item => item.sublinea_producto).filter(Boolean))];

          setLineasDisponibles(lineasUnicas.sort());
          setSublineasDisponibles(sublineasUnicas.sort());
        } else {
          setError('Error al cargar inventario completo');
        }
        return;
      }

      if (response.success) {
        console.log(`📊 INVENTARIO CARGADO: ${response.data.length} productos recibidos`);
        console.log('Primeros 3 productos:', response.data.slice(0, 3));

        setInventarioRaw(response.data);
        setInventarioCache(response.data);

        // Extraer líneas y sublíneas únicas para los filtros
        const lineasUnicas = [...new Set(response.data.map(item => item.linea_producto).filter(Boolean))];
        const sublineasUnicas = [...new Set(response.data.map(item => item.sublinea_producto).filter(Boolean))];

        setLineasDisponibles(lineasUnicas.sort());
        setSublineasDisponibles(sublineasUnicas.sort());

        console.log(`🏷️ Líneas encontradas: ${lineasUnicas.length}`, lineasUnicas);
        console.log(`📋 Sublíneas encontradas: ${sublineasUnicas.length}`, sublineasUnicas);
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

  // Función para cargar todo el inventario usando paginación automática
  const cargarInventarioCompleto = async () => {
    try {
      let todosLosProductos = [];
      let page = 1;
      let hasMore = true;
      const limitPorPagina = 1000; // Usar páginas más grandes para ser eficiente

      while (hasMore) {
        const params = {
          limit: limitPorPagina,
          page: page
        };

        const response = await almacenService.obtenerInventario(params);

        if (response.success && response.data.length > 0) {
          todosLosProductos = [...todosLosProductos, ...response.data];

          // Si obtuvo menos productos que el límite, ya no hay más
          if (response.data.length < limitPorPagina) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`🔄 PAGINACIÓN COMPLETADA: ${todosLosProductos.length} productos en ${page-1} páginas`);
      return todosLosProductos;
    } catch (error) {
      console.error('Error en paginación automática:', error);
      return null;
    }
  };

  // Filtrado client-side mejorado
  const aplicarFiltrosClientSide = useCallback(() => {
    let datosFiltrados = [...inventarioCache];

    // Filtro por búsqueda (código, descripción, marca, línea, sublínea)
    if (filtrosLocales.busqueda) {
      const busqueda = filtrosLocales.busqueda.toLowerCase();
      datosFiltrados = datosFiltrados.filter(item =>
        item.producto_codigo?.toLowerCase().includes(busqueda) ||
        item.producto_descripcion?.toLowerCase().includes(busqueda) ||
        item.marca?.toLowerCase().includes(busqueda) ||
        item.linea_producto?.toLowerCase().includes(busqueda) ||
        item.sublinea_producto?.toLowerCase().includes(busqueda)
      );
    }

    // Filtro por estado de stock
    if (filtrosLocales.estado_stock) {
      datosFiltrados = datosFiltrados.filter(item => item.estado_stock === filtrosLocales.estado_stock);
    }

    // Filtro por línea de producto
    if (filtrosLocales.linea_producto) {
      datosFiltrados = datosFiltrados.filter(item => item.linea_producto === filtrosLocales.linea_producto);
    }

    // Filtro por sublínea de producto
    if (filtrosLocales.sublinea_producto) {
      datosFiltrados = datosFiltrados.filter(item => item.sublinea_producto === filtrosLocales.sublinea_producto);
    }

    // Filtro solo con stock
    if (filtrosLocales.solo_con_stock) {
      datosFiltrados = datosFiltrados.filter(item => (parseFloat(item.stock_actual) || 0) > 0);
    }

    console.log(`✅ FILTROS APLICADOS: ${datosFiltrados.length} productos de ${inventarioCache.length} totales`);
    console.log('Filtros activos:', filtrosLocales);
    setInventarioRaw(datosFiltrados);
  }, [inventarioCache, filtrosLocales]);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    if (inventarioCache.length > 0) {
      console.log(`🔍 APLICANDO FILTROS a ${inventarioCache.length} productos...`);
      aplicarFiltrosClientSide();
    }
  }, [aplicarFiltrosClientSide, inventarioCache]);

  // Consolidar inventario por producto
  const productosConsolidados = useMemo(() => {
    console.log(`🔄 INICIANDO CONSOLIDACIÓN de ${inventarioRaw.length} registros...`);
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
        existing.total_almacenes = existing.almacenes.length;

        // Determinar estado general más crítico
        if (item.estado_stock === 'AGOTADO' && existing.stock_total === 0) {
          existing.estado_general = 'AGOTADO';
        } else if (item.estado_stock === 'BAJO' && existing.estado_general !== 'AGOTADO') {
          existing.estado_general = 'BAJO';
        } else if (existing.stock_total > 0 && existing.estado_general === 'AGOTADO') {
          existing.estado_general = 'PARCIAL';
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
          total_almacenes: 1,
          almacenes_con_stock: (parseFloat(item.stock_actual) || 0) > 0 ? 1 : 0,
          estado_general: (parseFloat(item.stock_actual) || 0) > 0 ? item.estado_stock : 'AGOTADO',
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
      productos = productos.filter(p => {
        if (filtrosLocales.estado_stock === 'AGOTADO') {
          return p.stock_total === 0;
        }
        return p.estado_general === filtrosLocales.estado_stock;
      });
    }

    // Filtrar por línea de producto
    if (filtrosLocales.linea_producto) {
      productos = productos.filter(p => {
        // Buscar en la data del API si existe linea_producto
        const item = inventarioRaw.find(item => item.producto_codigo === p.producto_codigo);
        const lineaProducto = item?.linea_producto || '';
        return lineaProducto.toUpperCase() === filtrosLocales.linea_producto.toUpperCase();
      });
    }

    // Ordenar por prioridad: productos con stock crítico primero
    productos.sort((a, b) => {
      const prioridadEstado = { 'AGOTADO': 4, 'BAJO': 3, 'PARCIAL': 2, 'NORMAL': 1 };
      const prioridadA = prioridadEstado[a.estado_general] || 0;
      const prioridadB = prioridadEstado[b.estado_general] || 0;

      if (prioridadA !== prioridadB) {
        return prioridadB - prioridadA; // Más crítico primero
      }

      return a.producto_codigo.localeCompare(b.producto_codigo);
    });

    console.log(`✅ CONSOLIDACIÓN COMPLETADA: ${productos.length} productos únicos de ${inventarioRaw.length} registros`);
    console.log('Primeros 5 productos consolidados:', productos.slice(0, 5).map(p => `${p.producto_codigo} (${p.total_almacenes} almacenes)`));

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
    const formatted = Number(cantidad).toLocaleString('en-US', { maximumFractionDigits: 3 });
    return unidad ? `${formatted} ${unidad}` : formatted;
  };

  // Obtener icono del tipo de almacén
  const getAlmacenIcon = (tipo) => {
    switch (tipo) {
      case 'PRINCIPAL': return Building;
      case 'SUCURSAL': return Store;
      case 'DISTRIBUIDOR': return Warehouse;
      case 'SUBALMACEN': return Archive;
      case 'EXHIBICION': return Eye;
      case 'OFICINA': return Home;
      default: return Package;
    }
  };

  // Obtener color del tipo de almacén
  const getAlmacenColor = (tipo) => {
    switch (tipo) {
      case 'PRINCIPAL': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'SUCURSAL': return 'text-green-600 bg-green-50 border-green-200';
      case 'DISTRIBUIDOR': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'SUBALMACEN': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'EXHIBICION': return 'text-pink-600 bg-pink-50 border-pink-200';
      case 'OFICINA': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Obtener badge de estado mejorado
  const getBadgeEstado = (estado, almacenesConStock, totalAlmacenes, stockTotal) => {
    if (stockTotal === 0) {
      return {
        color: 'bg-red-100 text-red-800 border-red-200',
        texto: '🚫 Sin Stock',
        icono: AlertTriangle,
        descripcion: 'Producto agotado en todos los almacenes'
      };
    }

    const porcentajeCobertura = (almacenesConStock / totalAlmacenes) * 100;

    if (estado === 'BAJO' || porcentajeCobertura < 50) {
      return {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        texto: '⚠️ Stock Crítico',
        icono: AlertTriangle,
        descripcion: `Stock bajo en ${almacenesConStock}/${totalAlmacenes} ubicaciones`
      };
    }

    if (porcentajeCobertura < 100) {
      return {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        texto: '📍 Stock Parcial',
        icono: Package,
        descripcion: `Disponible en ${almacenesConStock}/${totalAlmacenes} ubicaciones`
      };
    }

    return {
      color: 'bg-green-100 text-green-800 border-green-200',
      texto: '✅ Stock Completo',
      icono: CheckCircle,
      descripcion: `Stock disponible en todas las ubicaciones`
    };
  };

  // Handlers para edición de stock
  const handleEditStock = (inventarioItem) => {
    setSelectedInventarioItem(inventarioItem);
    setShowEditModal(true);
  };

  // Handler para agregar stock a productos sin inventario
  const handleAgregarAAlmacen = (producto) => {
    // Crear un item ficticio para el formulario de inventario
    const inventarioItem = {
      producto_id: producto.producto_id,
      producto_codigo: producto.producto_codigo,
      producto_descripcion: producto.producto_descripcion,
      marca: producto.marca,
      unidad_medida: producto.unidad_medida,
      almacen_id: null, // Se seleccionará en el formulario
      almacen_nombre: null,
      stock_actual: 0,
      stock_minimo: 0,
      stock_maximo: null,
      costo_promedio: 0,
      esNuevoInventario: true // Flag para indicar que es un nuevo producto en inventario
    };
    setSelectedInventarioItem(inventarioItem);
    setShowEditModal(true);
  };

  const handleEditSuccess = (data) => {
    // Recargar inventario después de edición exitosa
    cargarInventario();
    if (onRefresh) onRefresh();
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedInventarioItem(null);
  };

  // Función para cargar almacenes
  const cargarAlmacenes = async () => {
    try {
      const response = await almacenService.obtenerAlmacenes();
      if (response.success) {
        setAlmacenesData(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando almacenes:', error);
    }
  };

  // Handler para abrir kardex de producto
  const handleVerKardex = (producto) => {
    setSelectedProductoKardex(producto);
    setShowKardexModal(true);
  };

  // Handler para cerrar modal de kardex
  const handleCloseKardexModal = () => {
    setShowKardexModal(false);
    setSelectedProductoKardex(null);
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
      {/* Header con filtros mejorado */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por código, descripción, marca, línea o sublínea..."
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
              />
            </div>

            <select
              value={filtrosLocales.estado_stock}
              onChange={(e) => setFiltrosLocales(prev => ({ ...prev, estado_stock: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">📊 Todos los estados</option>
              <option value="AGOTADO">🚫 Sin Stock</option>
              <option value="BAJO">⚠️ Stock Crítico</option>
              <option value="NORMAL">✅ Stock Normal</option>
            </select>

            <select
              value={filtrosLocales.linea_producto}
              onChange={(e) => {
                setFiltrosLocales(prev => ({
                  ...prev,
                  linea_producto: e.target.value,
                  sublinea_producto: '' // Reset sublínea cuando cambie línea
                }));
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">🏷️ Todas las líneas</option>
              {lineasDisponibles.map(linea => (
                <option key={linea} value={linea}>{linea}</option>
              ))}
            </select>

            <select
              value={filtrosLocales.sublinea_producto}
              onChange={(e) => setFiltrosLocales(prev => ({ ...prev, sublinea_producto: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">📋 Todas las sublíneas</option>
              {sublineasDisponibles
                .filter(sublinea => {
                  if (!filtrosLocales.linea_producto) return true;
                  // Filtrar sublíneas que correspondan a la línea seleccionada
                  const itemsLinea = inventarioCache.filter(item => item.linea_producto === filtrosLocales.linea_producto);
                  return itemsLinea.some(item => item.sublinea_producto === sublinea);
                })
                .map(sublinea => (
                  <option key={sublinea} value={sublinea}>{sublinea}</option>
                ))
              }
            </select>

            <label className="flex items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                checked={filtrosLocales.solo_con_stock}
                onChange={(e) => setFiltrosLocales(prev => ({ ...prev, solo_con_stock: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-2"
              />
              <span className="text-sm text-gray-700">Solo con stock</span>
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              📦 {productosConsolidados.length} productos encontrados
            </div>
            <button
              onClick={() => {
                setBusquedaInput('');
                setFiltrosLocales({
                  busqueda: '',
                  estado_stock: '',
                  linea_producto: '',
                  sublinea_producto: '',
                  solo_con_stock: false
                });
              }}
              className="p-2 text-orange-600 hover:text-orange-900 hover:bg-orange-100 rounded-lg transition-colors"
              title="Limpiar filtros"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                cargarInventario();
                if (onRefresh) onRefresh();
              }}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Actualizar inventario"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de productos consolidados con diseño moderno */}
      <div className="space-y-3">
        {productosConsolidados.map(producto => {
          const isExpanded = expandedProducts.has(producto.producto_codigo);
          const badge = getBadgeEstado(
            producto.estado_general,
            producto.almacenes_con_stock,
            producto.total_almacenes,
            producto.stock_total
          );

          return (
            <div key={producto.producto_codigo} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              {/* Header del producto mejorado */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-xl"
                onClick={() => toggleExpanded(producto.producto_codigo)}
              >
                <div className="flex items-center justify-between">
                  {/* Información del producto */}
                  <div className="flex items-center space-x-4">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="font-bold text-gray-900 text-lg">{producto.producto_codigo}</h3>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {producto.categoria}
                        </span>
                        {inventarioRaw.find(item => item.producto_codigo === producto.producto_codigo)?.linea_producto && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {inventarioRaw.find(item => item.producto_codigo === producto.producto_codigo)?.linea_producto}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mt-1 font-medium">{producto.producto_descripcion}</p>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                        <span><span className="font-medium">Marca:</span> {producto.marca}</span>
                        {inventarioRaw.find(item => item.producto_codigo === producto.producto_codigo)?.sublinea_producto && (
                          <span><span className="font-medium">Sublínea:</span> {inventarioRaw.find(item => item.producto_codigo === producto.producto_codigo)?.sublinea_producto}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Métricas principales */}
                  <div className="flex items-center space-x-8">
                    {/* Ubicaciones */}
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-lg font-bold text-gray-900">
                          {producto.almacenes_con_stock}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {producto.almacenes_con_stock === 1 ? 'ubicación' : 'ubicaciones'}
                      </p>
                    </div>

                    {/* Stock total */}
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <Package className="h-4 w-4 text-green-600" />
                        <span className="text-xl font-bold text-gray-900">
                          {formatearCantidad(producto.stock_total)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{producto.unidad_medida}</p>
                    </div>

                    {/* Estado */}
                    <div className="text-center">
                      <span
                        className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium border ${badge.color}`}
                        title={badge.descripcion}
                      >
                        {badge.texto}
                      </span>
                    </div>

                    {/* Acciones */}
                    <div className="text-center space-y-2">
                      {puedeEditarStock && (
                        <div>
                          {producto.stock_total > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Crear item para edición con datos del primer almacén que tenga stock
                                const primerAlmacenConStock = producto.almacenes.find(alm => alm.stock_actual > 0) || producto.almacenes[0];
                                const inventarioItem = {
                                  producto_id: producto.producto_id,
                                  producto_codigo: producto.producto_codigo,
                                  producto_descripcion: producto.producto_descripcion,
                                  marca: producto.marca,
                                  unidad_medida: producto.unidad_medida,
                                  almacen_id: primerAlmacenConStock.id,
                                  almacen_nombre: primerAlmacenConStock.nombre,
                                  stock_actual: primerAlmacenConStock.stock_actual,
                                  stock_minimo: primerAlmacenConStock.stock_minimo,
                                  stock_maximo: null,
                                  costo_promedio: 0
                                };
                                handleEditStock(inventarioItem);
                              }}
                              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                              title="Editar stock"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAgregarAAlmacen(producto);
                              }}
                              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                              title="Agregar stock a almacén"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar
                            </button>
                          )}
                        </div>
                      )}

                      {/* Botón Kardex - siempre visible */}
                      <div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerKardex(producto);
                          }}
                          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors"
                          title="Ver kardex del producto"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Kardex
                        </button>
                      </div>
                    </div>

                    {/* Valor total */}
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-xl font-bold text-green-600">
                          {formatearUSD(producto.valor_total)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">valor total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desglose por almacenes mejorado */}
              {isExpanded && (
                <div className="border-t bg-gradient-to-r from-gray-50 to-blue-50 rounded-b-xl">
                  <div className="p-6">
                    {producto.stock_total === 0 ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                        <h4 className="text-lg font-semibold text-red-800 mb-2">Sin Stock</h4>
                        <p className="text-red-600 mb-4">Este producto no tiene stock en ningún almacén</p>
                        {puedeEditarStock && (
                          <button
                            onClick={() => handleAgregarAAlmacen(producto)}
                            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar stock a almacén
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                          <Warehouse className="h-4 w-4 mr-2" />
                          Ubicaciones con stock disponible:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {producto.almacenes.filter(almacen => almacen.stock_actual > 0).map(almacen => {
                        const AlmacenIcon = getAlmacenIcon(almacen.tipo);
                        const almacenColor = getAlmacenColor(almacen.tipo);

                            return (
                              <div key={almacen.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg border ${almacenColor}`}>
                                      <AlmacenIcon className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-gray-900">{almacen.nombre}</h5>
                                      <p className="text-xs text-gray-500">{almacen.tipo}</p>
                                    </div>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    almacen.estado_stock === 'BAJO' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                    {almacen.estado_stock === 'BAJO' ? '⚠️ Bajo' : '✅ Normal'}
                                  </span>
                                </div>

                                <div className="space-y-3">
                                  {puedeEditarStock && (
                                    <div className="flex justify-end mb-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const inventarioItem = {
                                            producto_id: producto.producto_id,
                                            producto_codigo: producto.producto_codigo,
                                            producto_descripcion: producto.producto_descripcion,
                                            marca: producto.marca,
                                            unidad_medida: producto.unidad_medida,
                                            almacen_id: almacen.id,
                                            almacen_nombre: almacen.nombre,
                                            stock_actual: almacen.stock_actual,
                                            stock_minimo: almacen.stock_minimo,
                                            stock_maximo: null,
                                            costo_promedio: 0
                                          };
                                          handleEditStock(inventarioItem);
                                        }}
                                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors flex items-center"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Editar
                                      </button>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Stock:</span>
                                    <span className="font-bold text-xl text-gray-900">
                                      {formatearCantidad(almacen.stock_actual)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Valor:</span>
                                    <span className="font-bold text-lg text-green-600">
                                      {formatearUSD(almacen.valor_inventario)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Estado vacío mejorado */}
      {productosConsolidados.length === 0 && (
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-12 text-center">
          <Package className="h-20 w-20 mx-auto text-gray-400 mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">No se encontraron productos</h3>
          <p className="text-gray-600 mb-6">Intenta ajustar los filtros de búsqueda para encontrar productos</p>
          <button
            onClick={() => {
              setBusquedaInput('');
              setFiltrosLocales({ busqueda: '', estado_stock: '', linea_producto: '', sublinea_producto: '', solo_con_stock: false });
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔄 Limpiar filtros
          </button>
        </div>
      )}

      {/* Modal de Edición de Stock */}
      {showEditModal && selectedInventarioItem && (
        <InventarioForm
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          inventarioItem={selectedInventarioItem}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Modal de Kardex */}
      <KardexModal
        isOpen={showKardexModal}
        onClose={handleCloseKardexModal}
        producto={selectedProductoKardex}
        almacenes={almacenesData}
      />
    </div>
  );
};

export default InventarioModerno;