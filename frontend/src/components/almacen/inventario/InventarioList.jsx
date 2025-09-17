import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Filter, 
    Package, 
    AlertTriangle,
    TrendingUp, 
    TrendingDown,
    RefreshCw,
    Download,
    Edit3,
    Eye,
    Plus,
    Minus,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Warehouse,
    BarChart3,
    X,
    Grid3X3,
    List,
    MapPin,
    Layers
} from 'lucide-react';
import almacenService from '../../../services/almacenService';

const InventarioList = ({ refreshTrigger, filtros: filtrosExternos, onFiltrosChange }) => {
    const [inventario, setInventario] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // NUEVO: Estados para vista optimizada
    const [vistaConsolidada, setVistaConsolidada] = useState(true);
    const [productosExpandidos, setProductosExpandidos] = useState(new Set());

    // Filtros locales
    const [filtros, setFiltros] = useState({
        busqueda: '',
        almacen_id: '',
        categoria: '',
        solo_alertas: false,
        stock_minimo: '',
        estado_stock: '',
        orden: 'producto_codigo',
        direccion: 'asc'
    });

    const [paginacion, setPaginacion] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    const [showFiltros, setShowFiltros] = useState(false);
    const [productoDetalle, setProductoDetalle] = useState(null);
    const [showModalDetalle, setShowModalDetalle] = useState(false);
    const [showModalAjuste, setShowModalAjuste] = useState(false);
    const [ajusteData, setAjusteData] = useState({
        producto_id: '',
        almacen_id: '',
        cantidad: '',
        tipo_movimiento: 'AJUSTE_POSITIVO',
        motivo: ''
    });

    const estadosStock = [
        { value: 'NORMAL', label: 'Normal', color: 'green', icono: TrendingUp },
        { value: 'BAJO', label: 'Stock Bajo', color: 'yellow', icono: AlertTriangle },
        { value: 'AGOTADO', label: 'Agotado', color: 'red', icono: TrendingDown }
    ];

    // NUEVO: Función de consolidación de inventario
    const consolidarInventario = (inventarioOriginal) => {
        const productosMap = new Map();
        
        inventarioOriginal.forEach(item => {
            const key = item.producto_codigo || `temp-${item.producto_id}`;
            
            if (productosMap.has(key)) {
                const existing = productosMap.get(key);
                existing.almacenes.push({
                    id: item.almacen_id,
                    nombre: item.almacen_nombre,
                    tipo: item.almacen_tipo,
                    stock: parseFloat(item.stock_actual) || 0,
                    stock_minimo: parseFloat(item.stock_minimo) || 0,
                    stock_maximo: parseFloat(item.stock_maximo) || 0,
                    estado: item.estado_stock,
                    valor: parseFloat(item.valor_inventario) || 0,
                    costo_promedio: parseFloat(item.costo_promedio) || 0,
                    piso: item.piso,
                    unidad_medida: item.unidad_medida
                });
                existing.stock_total += parseFloat(item.stock_actual) || 0;
                existing.valor_total += parseFloat(item.valor_inventario) || 0;
                existing.almacenes_con_stock += (parseFloat(item.stock_actual) || 0) > 0 ? 1 : 0;
            } else {
                productosMap.set(key, {
                    ...item,
                    stock_total: parseFloat(item.stock_actual) || 0,
                    valor_total: parseFloat(item.valor_inventario) || 0,
                    almacenes_con_stock: (parseFloat(item.stock_actual) || 0) > 0 ? 1 : 0,
                    almacenes: [{
                        id: item.almacen_id,
                        nombre: item.almacen_nombre,
                        tipo: item.almacen_tipo,
                        stock: parseFloat(item.stock_actual) || 0,
                        stock_minimo: parseFloat(item.stock_minimo) || 0,
                        stock_maximo: parseFloat(item.stock_maximo) || 0,
                        estado: item.estado_stock,
                        valor: parseFloat(item.valor_inventario) || 0,
                        costo_promedio: parseFloat(item.costo_promedio) || 0,
                        piso: item.piso,
                        unidad_medida: item.unidad_medida
                    }]
                });
            }
        });
        
        return Array.from(productosMap.values());
    };

    // NUEVO: Obtener estado general del producto consolidado
    const obtenerEstadoGeneral = (almacenes) => {
        const totalAlmacenes = almacenes.length;
        const conStock = almacenes.filter(a => a.stock > 0).length;
        const criticos = almacenes.filter(a => a.estado === 'AGOTADO' || a.estado === 'BAJO').length;
        
        if (conStock === 0) return { color: 'red', texto: 'Sin Stock', icono: AlertTriangle };
        if (criticos > totalAlmacenes / 2) return { color: 'yellow', texto: 'Crítico', icono: AlertTriangle };
        if (conStock === totalAlmacenes) return { color: 'green', texto: 'Completo', icono: TrendingUp };
        return { color: 'blue', texto: 'Parcial', icono: Package };
    };

    // Funciones de formateo
    const formatearNumero = (numero, decimales = 2) => {
        if (numero === null || numero === undefined || isNaN(numero)) return '0';
        return Number(numero).toLocaleString('es-PE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    };

    const formatearMoneda = (monto) => {
        if (monto === null || monto === undefined || isNaN(monto)) return 'S/ 0.00';
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN'
        }).format(monto);
    };

    const formatearFecha = (fecha) => {
        if (!fecha) return '-';
        try {
            return new Date(fecha).toLocaleDateString('es-PE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            return '-';
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    useEffect(() => {
        cargarInventario();
    }, [filtros, paginacion.page, refreshTrigger]);

    // Sincronizar con filtros externos
    useEffect(() => {
        if (filtrosExternos && onFiltrosChange) {
            setFiltros(prev => ({ ...prev, ...filtrosExternos }));
        }
    }, [filtrosExternos]);

    const cargarDatos = async () => {
        try {
            const [resultadoAlmacenes] = await Promise.all([
                almacenService.obtenerAlmacenes()
            ]);

            if (resultadoAlmacenes.success) {
                setAlmacenes(resultadoAlmacenes.data);
            }

            // Mock categorías - ajustar según tu backend
            setCategorias([
                { id: 'electronica', nombre: 'Electrónica' },
                { id: 'hogar', nombre: 'Hogar' },
                { id: 'oficina', nombre: 'Oficina' },
                { id: 'industrial', nombre: 'Industrial' }
            ]);
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    };

    const cargarInventario = async () => {
        try {
            setLoading(true);
            setError(null);

            const parametros = {
                ...filtros,
                page: paginacion.page,
                limit: paginacion.limit
            };

            // Limpiar parámetros vacíos
            Object.keys(parametros).forEach(key => {
                if (parametros[key] === '' || parametros[key] === null || parametros[key] === undefined) {
                    delete parametros[key];
                }
            });

            const resultado = await almacenService.obtenerStockConsolidado();

            if (resultado.success) {
                setInventario(resultado.data || []);
                if (resultado.pagination) {
                    setPaginacion(prev => ({
                        ...prev,
                        total: resultado.pagination.total || 0,
                        totalPages: resultado.pagination.totalPages || 0
                    }));
                }
            } else {
                setError(resultado.error || 'Error al cargar inventario');
                setInventario([]);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al cargar inventario');
            setInventario([]);
            console.error('Error cargando inventario:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFiltroChange = (campo, valor) => {
        const nuevosFiltros = { ...filtros, [campo]: valor };
        setFiltros(nuevosFiltros);
        setPaginacion(prev => ({ ...prev, page: 1 }));
        
        // Propagar cambios a componente padre si existe
        if (onFiltrosChange) {
            onFiltrosChange(nuevosFiltros);
        }
    };

    const handleOrdenamiento = (campo) => {
        setFiltros(prev => ({
            ...prev,
            orden: campo,
            direccion: prev.orden === campo && prev.direccion === 'asc' ? 'desc' : 'asc'
        }));
    };

    const limpiarFiltros = () => {
        const filtrosLimpios = {
            busqueda: '',
            almacen_id: '',
            categoria: '',
            solo_alertas: false,
            stock_minimo: '',
            estado_stock: '',
            orden: 'producto_codigo',
            direccion: 'asc'
        };
        setFiltros(filtrosLimpios);
        setPaginacion(prev => ({ ...prev, page: 1 }));
        
        if (onFiltrosChange) {
            onFiltrosChange(filtrosLimpios);
        }
    };

    // NUEVO: Toggle expandir/colapsar producto
    const toggleExpandirProducto = (productoCodigo) => {
        const nuevosExpandidos = new Set(productosExpandidos);
        if (nuevosExpandidos.has(productoCodigo)) {
            nuevosExpandidos.delete(productoCodigo);
        } else {
            nuevosExpandidos.add(productoCodigo);
        }
        setProductosExpandidos(nuevosExpandidos);
    };

    const abrirDetalleProducto = (producto) => {
        setProductoDetalle(producto);
        setShowModalDetalle(true);
    };

    const abrirModalAjuste = (producto, almacenSeleccionado = null) => {
        setAjusteData({
            producto_id: producto.producto_id,
            almacen_id: almacenSeleccionado ? almacenSeleccionado.id : producto.almacen_id,
            cantidad: '',
            tipo_movimiento: 'AJUSTE_POSITIVO',
            motivo: ''
        });
        setShowModalAjuste(true);
    };

    const ejecutarAjusteStock = async () => {
        try {
            if (!ajusteData.cantidad || !ajusteData.motivo) {
                alert('Por favor complete todos los campos');
                return;
            }

            const resultado = await almacenService.actualizarStockProducto(
                ajusteData.producto_id,
                ajusteData.almacen_id,
                {
                    cantidad: parseFloat(ajusteData.cantidad),
                    tipo_movimiento: ajusteData.tipo_movimiento,
                    motivo: ajusteData.motivo
                }
            );

            if (resultado.success) {
                setShowModalAjuste(false);
                cargarInventario();
                setAjusteData({
                    producto_id: '',
                    almacen_id: '',
                    cantidad: '',
                    tipo_movimiento: 'AJUSTE_POSITIVO',
                    motivo: ''
                });
            } else {
                alert(resultado.error || 'Error al ajustar stock');
            }
        } catch (error) {
            console.error('Error ajustando stock:', error);
            alert('Error al ajustar stock');
        }
    };

    const obtenerConfigEstadoStock = (estado) => {
        return estadosStock.find(e => e.value === estado) || estadosStock[0];
    };

    const exportarInventario = async () => {
        try {
            console.log('Exportar inventario - funcionalidad por implementar');
        } catch (error) {
            console.error('Error exportando:', error);
        }
    };

    const EstadoStockBadge = ({ estado }) => {
        const config = obtenerConfigEstadoStock(estado);
        const Icono = config.icono;

        const colorClasses = {
            green: 'bg-green-100 text-green-800',
            yellow: 'bg-yellow-100 text-yellow-800',
            red: 'bg-red-100 text-red-800',
            blue: 'bg-blue-100 text-blue-800'
        };

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses[config.color]}`}>
                <Icono className="h-3 w-3 mr-1" />
                {config.label}
            </span>
        );
    };

    // NUEVO: Componente para barra de distribución de almacenes
    const BarraDistribucion = ({ almacenes }) => {
        return (
            <div className="flex items-center space-x-2 w-full">
                <div className="flex-1">
                    <div className="flex items-center space-x-1 mb-1">
                        <Warehouse className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                            {almacenes.filter(a => a.stock > 0).length}/{almacenes.length} ubicaciones
                        </span>
                    </div>
                    <div className="flex space-x-1 h-2">
                        {almacenes.slice(0, 8).map((almacen, idx) => (
                            <div
                                key={idx}
                                className={`flex-1 rounded min-w-[4px] ${
                                    almacen.stock > 0 
                                        ? almacen.estado === 'BAJO' ? 'bg-yellow-400' : 'bg-green-400'
                                        : 'bg-gray-200'
                                }`}
                                title={`${almacen.nombre}: ${almacen.stock}`}
                            />
                        ))}
                        {almacenes.length > 8 && (
                            <span className="text-xs text-gray-400 ml-1">+{almacenes.length - 8}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // NUEVO: Fila de producto consolidado
    const FilaProductoConsolidado = ({ producto }) => {
        const expandido = productosExpandidos.has(producto.producto_codigo);
        const estadoGeneral = obtenerEstadoGeneral(producto.almacenes);
        const IconoEstado = estadoGeneral.icono;

        return (
            <>
                {/* Fila Principal */}
                <tr className={`hover:bg-gray-50 transition-colors border-l-4 ${
                    expandido ? 'border-l-blue-500 bg-blue-50' : 'border-l-transparent'
                }`}>
                    <td className="px-6 py-4">
                        <div className="flex items-center">
                            <button
                                onClick={() => toggleExpandirProducto(producto.producto_codigo)}
                                className="mr-3 p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                                {expandido ? 
                                    <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                }
                            </button>
                            <div>
                                <div className="font-medium text-gray-900">{producto.producto_codigo || '-'}</div>
                                <div className="text-xs text-gray-500 truncate max-w-xs" title={producto.producto_descripcion}>
                                    {producto.producto_descripcion || '-'}
                                </div>
                                {producto.marca && (
                                    <div className="text-xs text-gray-400">{producto.marca}</div>
                                )}
                            </div>
                        </div>
                    </td>

                    <td className="px-6 py-4">
                        <BarraDistribucion almacenes={producto.almacenes} />
                    </td>

                    <td className="px-6 py-4 text-center">
                        <div className="text-lg font-bold text-gray-900">
                            {formatearNumero(producto.stock_total, 3)}
                        </div>
                        <div className="text-xs text-gray-500">
                            {producto.unidad_medida || 'UND'} (total)
                        </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            estadoGeneral.color === 'green' ? 'bg-green-100 text-green-800' :
                            estadoGeneral.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            estadoGeneral.color === 'red' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                            <IconoEstado className="h-3 w-3 mr-1" />
                            {estadoGeneral.texto}
                        </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                        <div className="font-bold text-gray-900">{formatearMoneda(producto.valor_total)}</div>
                        <div className="text-xs text-gray-500">Total consolidado</div>
                    </td>

                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                            <button
                                onClick={() => abrirDetalleProducto(producto)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                                title="Ver detalle completo"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => abrirModalAjuste(producto)}
                                className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                                title="Ajustar stock"
                            >
                                <Edit3 className="h-4 w-4" />
                            </button>
                        </div>
                    </td>
                </tr>

                {/* Filas de Detalle Expandible */}
                {expandido && (
                    <tr>
                        <td colSpan="6" className="px-6 py-0">
                            <div className="bg-gray-50 rounded-lg p-4 my-2">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <Layers className="h-4 w-4 mr-2" />
                                    Distribución por Almacén
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {producto.almacenes.map((almacen, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-lg border-l-4 bg-white ${
                                                almacen.stock > 0 
                                                    ? almacen.estado === 'BAJO' 
                                                        ? 'border-l-yellow-400' 
                                                        : 'border-l-green-400'
                                                    : 'border-l-red-400'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <div>
                                                    <span className="font-medium text-sm text-gray-900">
                                                        {almacen.nombre}
                                                    </span>
                                                    {almacen.tipo && (
                                                        <div className="text-xs text-gray-500">{almacen.tipo}</div>
                                                    )}
                                                    {almacen.piso && (
                                                        <div className="text-xs text-gray-400">Piso {almacen.piso}</div>
                                                    )}
                                                </div>
                                                <EstadoStockBadge estado={almacen.estado} />
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-gray-500 text-xs">Stock:</span>
                                                    <div className="font-bold text-gray-900">
                                                        {formatearNumero(almacen.stock, 3)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 text-xs">Valor:</span>
                                                    <div className="font-medium text-gray-900">
                                                        {formatearMoneda(almacen.valor)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                                                <div className="text-xs text-gray-500">
                                                    Min: {formatearNumero(almacen.stock_minimo, 1)}
                                                    {almacen.stock_maximo && ` | Max: ${formatearNumero(almacen.stock_maximo, 1)}`}
                                                </div>
                                                <button
                                                    onClick={() => abrirModalAjuste(producto, almacen)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                                >
                                                    Ajustar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </>
        );
    };

    // Preparar datos según la vista seleccionada
    const datosParaMostrar = vistaConsolidada ? consolidarInventario(inventario) : inventario;

    const ModalDetalle = () => {
        if (!showModalDetalle || !productoDetalle) return null;

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div 
                        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                        onClick={() => setShowModalDetalle(false)}
                    ></div>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    {vistaConsolidada ? 'Detalle Consolidado' : 'Detalle de Inventario'}
                                </h3>
                                <button
                                    onClick={() => setShowModalDetalle(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Producto</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        <span className="font-medium">{productoDetalle.producto_codigo}</span>
                                        {productoDetalle.producto_descripcion && (
                                            <span className="ml-2">- {productoDetalle.producto_descripcion}</span>
                                        )}
                                    </p>
                                </div>

                                {vistaConsolidada && productoDetalle.almacenes ? (
                                    // Vista consolidada con todos los almacenes
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Distribución en Almacenes ({productoDetalle.almacenes.length})
                                        </label>
                                        <div className="max-h-60 overflow-y-auto space-y-2">
                                            {productoDetalle.almacenes.map((almacen, idx) => (
                                                <div key={idx} className="p-3 border rounded-lg">
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div>
                                                            <span className="font-medium">{almacen.nombre}</span>
                                                            <p className="text-xs text-gray-500">{almacen.tipo}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <span className="text-lg font-bold">{formatearNumero(almacen.stock, 3)}</span>
                                                            <p className="text-xs text-gray-500">Stock</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <EstadoStockBadge estado={almacen.estado} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Stock Total</label>
                                                <p className="mt-1 text-lg font-bold text-gray-900">
                                                    {formatearNumero(productoDetalle.stock_total, 3)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Valor Total</label>
                                                <p className="mt-1 text-lg font-bold text-gray-900">
                                                    {formatearMoneda(productoDetalle.valor_total)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Vista individual original
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Almacén</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {productoDetalle.almacen_nombre}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {productoDetalle.almacen_tipo}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Estado</label>
                                                <div className="mt-1">
                                                    <EstadoStockBadge estado={productoDetalle.estado_stock} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Stock Actual</label>
                                                <p className="mt-1 text-lg font-bold text-gray-900">
                                                    {formatearNumero(productoDetalle.stock_actual, 3)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Stock Mínimo</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {formatearNumero(productoDetalle.stock_minimo, 3)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Stock Máximo</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {productoDetalle.stock_maximo ? formatearNumero(productoDetalle.stock_maximo, 3) : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Costo Promedio</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {formatearMoneda(productoDetalle.costo_promedio)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Valor Total</label>
                                                <p className="mt-1 text-sm font-bold text-gray-900">
                                                    {formatearMoneda(productoDetalle.valor_inventario)}
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Último Movimiento</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {formatearFecha(productoDetalle.ultimo_movimiento)}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                onClick={() => {
                                    setShowModalDetalle(false);
                                    abrirModalAjuste(productoDetalle);
                                }}
                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                            >
                                Ajustar Stock
                            </button>
                            <button
                                onClick={() => setShowModalDetalle(false)}
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const ModalAjusteStock = () => {
        if (!showModalAjuste) return null;

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div 
                        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                        onClick={() => setShowModalAjuste(false)}
                    ></div>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Ajustar Stock
                                </h3>
                                <button
                                    onClick={() => setShowModalAjuste(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tipo de Ajuste</label>
                                    <select
                                        value={ajusteData.tipo_movimiento}
                                        onChange={(e) => setAjusteData(prev => ({ ...prev, tipo_movimiento: e.target.value }))}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="AJUSTE_POSITIVO">Ajuste Positivo (+)</option>
                                        <option value="AJUSTE_NEGATIVO">Ajuste Negativo (-)</option>
                                        <option value="INICIAL">Stock Inicial</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        value={ajusteData.cantidad}
                                        onChange={(e) => setAjusteData(prev => ({ ...prev, cantidad: e.target.value }))}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Ingrese la cantidad"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                                    <textarea
                                        value={ajusteData.motivo}
                                        onChange={(e) => setAjusteData(prev => ({ ...prev, motivo: e.target.value }))}
                                        rows={3}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Describa el motivo del ajuste"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                onClick={ejecutarAjusteStock}
                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                            >
                                Ejecutar Ajuste
                            </button>
                            <button
                                onClick={() => setShowModalAjuste(false)}
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {vistaConsolidada ? 'Inventario Consolidado' : 'Inventario por Almacén'}
                    </h1>
                    <p className="text-gray-600">Gestión de stock y control de inventarios</p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* NUEVO: Toggle de Vista */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setVistaConsolidada(true)}
                            className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                vistaConsolidada
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Grid3X3 className="h-4 w-4 mr-1" />
                            Consolidado
                        </button>
                        <button
                            onClick={() => setVistaConsolidada(false)}
                            className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                !vistaConsolidada
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <List className="h-4 w-4 mr-1" />
                            Detallado
                        </button>
                    </div>

                    <button
                        onClick={cargarInventario}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                    <button 
                        onClick={exportarInventario}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o descripción..."
                                    value={filtros.busqueda}
                                    onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                                />
                            </div>
                            <button
                                onClick={() => setShowFiltros(!showFiltros)}
                                className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md ${
                                    showFiltros ? 'bg-blue-50 text-blue-700 border-blue-300' : 'text-gray-700 bg-white hover:bg-gray-50'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Filtros
                            </button>
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={filtros.solo_alertas}
                                    onChange={(e) => handleFiltroChange('solo_alertas', e.target.checked)}
                                    className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                />
                                <span className="ml-2 text-sm text-gray-600">Solo alertas</span>
                            </label>
                            {(filtros.busqueda || filtros.almacen_id || filtros.categoria || filtros.solo_alertas || filtros.estado_stock) && (
                                <button
                                    onClick={limpiarFiltros}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {showFiltros && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Almacén
                                </label>
                                <select
                                    value={filtros.almacen_id}
                                    onChange={(e) => handleFiltroChange('almacen_id', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Categoría
                                </label>
                                <select
                                    value={filtros.categoria}
                                    onChange={(e) => handleFiltroChange('categoria', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Todas las categorías</option>
                                    {categorias.map(categoria => (
                                        <option key={categoria.id} value={categoria.id}>
                                            {categoria.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Estado de Stock
                                </label>
                                <select
                                    value={filtros.estado_stock}
                                    onChange={(e) => handleFiltroChange('estado_stock', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Todos los estados</option>
                                    {estadosStock.map(estado => (
                                        <option key={estado.value} value={estado.value}>
                                            {estado.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Stock Mínimo
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={filtros.stock_minimo}
                                    onChange={(e) => handleFiltroChange('stock_minimo', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Stock mínimo"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabla */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleOrdenamiento('producto_codigo')}
                                >
                                    <div className="flex items-center">
                                        <Package className="h-4 w-4 mr-1" />
                                        Producto
                                        {filtros.orden === 'producto_codigo' && (
                                            <span className="ml-1">
                                                {filtros.direccion === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center">
                                        <MapPin className="h-4 w-4 mr-1" />
                                        {vistaConsolidada ? 'Distribución' : 'Almacén'}
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleOrdenamiento('stock_actual')}
                                >
                                    <div className="flex items-center justify-center">
                                        {vistaConsolidada ? 'Stock Total' : 'Stock Actual'}
                                        {filtros.orden === 'stock_actual' && (
                                            <span className="ml-1">
                                                {filtros.direccion === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {vistaConsolidada ? 'Estado General' : 'Estado'}
                                </th>
                                <th 
                                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleOrdenamiento('valor_inventario')}
                                >
                                    <div className="flex items-center justify-end">
                                        <BarChart3 className="h-4 w-4 mr-1" />
                                        Valor Total
                                        {filtros.orden === 'valor_inventario' && (
                                            <span className="ml-1">
                                                {filtros.direccion === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                [...Array(10)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : error ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <Package className="h-12 w-12 text-red-300 mx-auto mb-4" />
                                        <p className="text-red-600 font-medium">{error}</p>
                                        <button
                                            onClick={cargarInventario}
                                            className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
                                        >
                                            Reintentar
                                        </button>
                                    </td>
                                </tr>
                            ) : datosParaMostrar.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">No se encontró inventario</p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            {Object.values(filtros).some(f => f) 
                                                ? 'Intenta ajustar los filtros de búsqueda'
                                                : 'Aún no hay productos en inventario'
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : vistaConsolidada ? (
                                // NUEVA: Vista consolidada
                                datosParaMostrar.map((producto) => (
                                    <FilaProductoConsolidado 
                                        key={producto.producto_codigo} 
                                        producto={producto}
                                    />
                                ))
                            ) : (
                                // Vista original detallada
                                datosParaMostrar.map((item) => (
                                    <tr key={`${item.producto_id}-${item.almacen_id}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div className="font-medium">{item.producto_codigo || '-'}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-xs" title={item.producto_descripcion}>
                                                {item.producto_descripcion || '-'}
                                            </div>
                                            {item.marca && (
                                                <div className="text-xs text-gray-400">{item.marca}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div className="font-medium">{item.almacen_nombre || '-'}</div>
                                            <div className="text-xs text-gray-500">{item.almacen_tipo || '-'}</div>
                                            {item.piso && (
                                                <div className="text-xs text-gray-400">Piso {item.piso}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-bold text-lg">
                                                {formatearNumero(item.stock_actual, 3)}
                                            </span>
                                            {item.unidad_medida && (
                                                <div className="text-xs text-gray-500">{item.unidad_medida}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <EstadoStockBadge estado={item.estado_stock} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                            <div className="font-bold">{formatearMoneda(item.valor_inventario)}</div>
                                            <div className="text-xs text-gray-500">
                                                @ {formatearMoneda(item.costo_promedio)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => abrirDetalleProducto(item)}
                                                    className="text-blue-600 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 transition-colors"
                                                    title="Ver detalle"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => abrirModalAjuste(item)}
                                                    className="text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1 transition-colors"
                                                    title="Ajustar stock"
                                                >
                                                    <Edit3 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Información de Vista */}
                {vistaConsolidada && !loading && !error && datosParaMostrar.length > 0 && (
                    <div className="px-6 py-3 bg-blue-50 border-t border-blue-200">
                        <div className="flex items-center text-sm text-blue-700">
                            <Grid3X3 className="h-4 w-4 mr-2" />
                            Vista consolidada: {datosParaMostrar.length} productos únicos
                            {inventario.length !== datosParaMostrar.length && (
                                <span className="ml-2 text-blue-600">
                                    (de {inventario.length} registros totales)
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Paginación */}
                {!loading && !error && paginacion.totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex-1 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Página {paginacion.page} de {paginacion.totalPages}
                                    {paginacion.total > 0 && ` - ${paginacion.total} ${vistaConsolidada ? 'productos' : 'registros'} total`}
                                </p>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setPaginacion(prev => ({ ...prev, page: prev.page - 1 }))}
                                    disabled={paginacion.page === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => setPaginacion(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={paginacion.page === paginacion.totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modales */}
            <ModalDetalle />
            <ModalAjusteStock />
        </div>
    );
};

export default InventarioList;