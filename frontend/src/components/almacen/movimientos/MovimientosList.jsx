import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Filter, 
    Calendar, 
    TrendingUp, 
    TrendingDown, 
    RotateCcw,
    ArrowRight,
    Eye,
    Download,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Package,
    User,
    FileText,
    X
} from 'lucide-react';
import almacenService from "../../../services/almacenService";

const MovimientosList = () => {
    const [movimientos, setMovimientos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filtros
    const [filtros, setFiltros] = useState({
        busqueda: '',
        tipo_movimiento: '',
        almacen_id: '',
        fecha_desde: '',
        fecha_hasta: '',
        orden: 'fecha_movimiento',
        direccion: 'desc'
    });

    const [paginacion, setPaginacion] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    const [showFiltros, setShowFiltros] = useState(false);
    const [movimientoDetalle, setMovimientoDetalle] = useState(null);
    const [showModalDetalle, setShowModalDetalle] = useState(false);

    const tiposMovimiento = [
        { value: 'ENTRADA', label: 'Entrada', color: 'green', icono: TrendingUp },
        { value: 'SALIDA', label: 'Salida', color: 'red', icono: TrendingDown },
        { value: 'AJUSTE_POSITIVO', label: 'Ajuste +', color: 'blue', icono: TrendingUp },
        { value: 'AJUSTE_NEGATIVO', label: 'Ajuste -', color: 'orange', icono: TrendingDown },
        { value: 'TRANSFERENCIA', label: 'Transferencia', color: 'purple', icono: ArrowRight },
        { value: 'INICIAL', label: 'Inicial', color: 'gray', icono: RotateCcw }
    ];

    // Funciones de formateo locales
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

    useEffect(() => {
        cargarDatos();
    }, []);

    useEffect(() => {
        cargarMovimientos();
    }, [filtros, paginacion.page]);

    const cargarDatos = async () => {
        try {
            const resultadoAlmacenes = await almacenService.obtenerAlmacenes();
            if (resultadoAlmacenes.success) {
                setAlmacenes(resultadoAlmacenes.data);
            } else {
                console.error('Error cargando almacenes:', resultadoAlmacenes.error);
            }
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    };

    const cargarMovimientos = async () => {
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

            const resultado = await almacenService.obtenerMovimientos(parametros);

            if (resultado.success) {
                setMovimientos(resultado.data || []);
                // Actualizar paginación si viene en la respuesta
                if (resultado.pagination) {
                    setPaginacion(prev => ({
                        ...prev,
                        total: resultado.pagination.total || 0,
                        totalPages: resultado.pagination.totalPages || 0
                    }));
                }
            } else {
                setError(resultado.error || 'Error al cargar movimientos');
                setMovimientos([]);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al cargar movimientos');
            setMovimientos([]);
            console.error('Error cargando movimientos:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFiltroChange = (campo, valor) => {
        setFiltros(prev => ({
            ...prev,
            [campo]: valor
        }));
        setPaginacion(prev => ({ ...prev, page: 1 }));
    };

    const handleOrdenamiento = (campo) => {
        setFiltros(prev => ({
            ...prev,
            orden: campo,
            direccion: prev.orden === campo && prev.direccion === 'asc' ? 'desc' : 'asc'
        }));
    };

    const limpiarFiltros = () => {
        setFiltros({
            busqueda: '',
            tipo_movimiento: '',
            almacen_id: '',
            fecha_desde: '',
            fecha_hasta: '',
            orden: 'fecha_movimiento',
            direccion: 'desc'
        });
        setPaginacion(prev => ({ ...prev, page: 1 }));
    };

    const abrirDetalleMovimiento = (movimiento) => {
        setMovimientoDetalle(movimiento);
        setShowModalDetalle(true);
    };

    const cerrarModalDetalle = () => {
        setMovimientoDetalle(null);
        setShowModalDetalle(false);
    };

    const obtenerConfigTipoMovimiento = (tipo) => {
        return tiposMovimiento.find(t => t.value === tipo) || tiposMovimiento[0];
    };

    const exportarMovimientos = async () => {
        try {
            // Implementar exportación si el backend lo soporta
            console.log('Exportar movimientos - funcionalidad por implementar');
        } catch (error) {
            console.error('Error exportando:', error);
        }
    };

    const TipoMovimientoBadge = ({ tipo }) => {
        const config = obtenerConfigTipoMovimiento(tipo);
        const Icono = config.icono;

        const colorClasses = {
            green: 'bg-green-100 text-green-800',
            red: 'bg-red-100 text-red-800',
            blue: 'bg-blue-100 text-blue-800',
            orange: 'bg-orange-100 text-orange-800',
            purple: 'bg-purple-100 text-purple-800',
            gray: 'bg-gray-100 text-gray-800'
        };

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses[config.color]}`}>
                <Icono className="h-3 w-3 mr-1" />
                {config.label}
            </span>
        );
    };

    const ModalDetalle = () => {
        if (!showModalDetalle || !movimientoDetalle) return null;

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div 
                        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                        onClick={cerrarModalDetalle}
                        aria-hidden="true"
                    ></div>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Detalle del Movimiento
                                </h3>
                                <button
                                    onClick={cerrarModalDetalle}
                                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                                    aria-label="Cerrar"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                                        <div className="mt-1">
                                            <TipoMovimientoBadge tipo={movimientoDetalle.tipo_movimiento} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Fecha</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {formatearFecha(movimientoDetalle.fecha_movimiento)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(movimientoDetalle.fecha_movimiento).toLocaleTimeString('es-PE', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Producto</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        <span className="font-medium">{movimientoDetalle.productos?.codigo}</span>
                                        {movimientoDetalle.productos?.descripcion && (
                                            <span className="ml-2">- {movimientoDetalle.productos.descripcion}</span>
                                        )}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                                        <p className="mt-1 text-sm text-gray-900 font-medium">
                                            {formatearNumero(movimientoDetalle.cantidad, 3)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Precio Unitario</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {formatearMoneda(movimientoDetalle.precio_unitario)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Stock Anterior</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {formatearNumero(movimientoDetalle.stock_anterior, 3)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Stock Posterior</label>
                                        <p className="mt-1 text-sm text-gray-900 font-medium">
                                            {formatearNumero(movimientoDetalle.stock_posterior, 3)}
                                        </p>
                                    </div>
                                </div>

                                {movimientoDetalle.tipo_movimiento === 'TRANSFERENCIA' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Almacén Origen</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {movimientoDetalle.almacenes_origen?.nombre || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Almacén Destino</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {movimientoDetalle.almacenes_destino?.nombre || '-'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                                        {movimientoDetalle.motivo}
                                    </p>
                                </div>

                                {movimientoDetalle.referencia_tipo && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Referencia</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {movimientoDetalle.referencia_tipo}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">ID Referencia</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {movimientoDetalle.referencia_id || '-'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Usuario</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        <span className="inline-flex items-center">
                                            <User className="h-4 w-4 text-gray-400 mr-1" />
                                            {movimientoDetalle.usuarios?.nombre} {movimientoDetalle.usuarios?.apellido}
                                        </span>
                                    </p>
                                </div>

                                {movimientoDetalle.observaciones && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Observaciones</label>
                                        <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                                            {movimientoDetalle.observaciones}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                onClick={cerrarModalDetalle}
                                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                            >
                                Cerrar
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
                    <h1 className="text-2xl font-bold text-gray-900">Movimientos de Inventario</h1>
                    <p className="text-gray-600">Historial de entradas, salidas y transferencias</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={cargarMovimientos}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                    <button 
                        onClick={exportarMovimientos}
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
                                    placeholder="Buscar por producto, motivo o referencia..."
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
                            {(filtros.busqueda || filtros.tipo_movimiento || filtros.almacen_id || filtros.fecha_desde || filtros.fecha_hasta) && (
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
                                    Tipo de Movimiento
                                </label>
                                <select
                                    value={filtros.tipo_movimiento}
                                    onChange={(e) => handleFiltroChange('tipo_movimiento', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Todos los tipos</option>
                                    {tiposMovimiento.map(tipo => (
                                        <option key={tipo.value} value={tipo.value}>
                                            {tipo.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                                    Fecha Desde
                                </label>
                                <input
                                    type="date"
                                    value={filtros.fecha_desde}
                                    onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha Hasta
                                </label>
                                <input
                                    type="date"
                                    value={filtros.fecha_hasta}
                                    onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                    onClick={() => handleOrdenamiento('fecha_movimiento')}
                                >
                                    <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        Fecha
                                        {filtros.orden === 'fecha_movimiento' && (
                                            <span className="ml-1">
                                                {filtros.direccion === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Producto
                                </th>
                                <th 
                                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleOrdenamiento('cantidad')}
                                >
                                    <div className="flex items-center justify-center">
                                        Cantidad
                                        {filtros.orden === 'cantidad' && (
                                            <span className="ml-1">
                                                {filtros.direccion === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Stock Anterior
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Stock Posterior
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Motivo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Usuario
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : error ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center">
                                        <FileText className="h-12 w-12 text-red-300 mx-auto mb-4" />
                                        <p className="text-red-600 font-medium">{error}</p>
                                        <button
                                            onClick={cargarMovimientos}
                                            className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
                                        >
                                            Reintentar
                                        </button>
                                    </td>
                                </tr>
                            ) : movimientos.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center">
                                        <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">No se encontraron movimientos</p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            {Object.values(filtros).some(f => f) 
                                                ? 'Intenta ajustar los filtros de búsqueda'
                                                : 'Aún no hay movimientos registrados'
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                movimientos.map((movimiento) => (
                                    <tr key={movimiento.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <div>
                                                {formatearFecha(movimiento.fecha_movimiento)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(movimiento.fecha_movimiento).toLocaleTimeString('es-PE', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <TipoMovimientoBadge tipo={movimiento.tipo_movimiento} />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div className="font-medium">{movimiento.productos?.codigo || '-'}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-xs" title={movimiento.productos?.descripcion}>
                                                {movimiento.productos?.descripcion || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-medium">
                                                {formatearNumero(movimiento.cantidad, 3)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                            {formatearNumero(movimiento.stock_anterior, 3)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <span className="font-medium">
                                                {formatearNumero(movimiento.stock_posterior, 3)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div className="max-w-xs truncate" title={movimiento.motivo}>
                                                {movimiento.motivo}
                                            </div>
                                            {movimiento.referencia_tipo && (
                                                <div className="text-xs text-gray-500">
                                                    {movimiento.referencia_tipo}: {movimiento.referencia_id}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <div className="flex items-center">
                                                <User className="h-4 w-4 text-gray-400 mr-1" />
                                                <span className="truncate max-w-24" title={`${movimiento.usuarios?.nombre || ''} ${movimiento.usuarios?.apellido || ''}`}>
                                                    {movimiento.usuarios?.nombre || 'Usuario'} {movimiento.usuarios?.apellido || ''}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => abrirDetalleMovimiento(movimiento)}
                                                className="text-blue-600 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 transition-colors"
                                                title="Ver detalle"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {!loading && !error && paginacion.totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex-1 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Página {paginacion.page} de {paginacion.totalPages}
                                    {paginacion.total > 0 && ` - ${paginacion.total} registros total`}
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

            {/* Modal de detalle */}
            <ModalDetalle />
        </div>
    );
};

export default MovimientosList;