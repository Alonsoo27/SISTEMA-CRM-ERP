import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Plus, Upload, Eye, Edit, Trash2, Copy, MoreVertical } from 'lucide-react';
import ProductoForm from '../ProductoForm/ProductoForm';
import ProductoDetalles from '../ProductoDetalles/ProductoDetalles';
import ConfirmDialog from '../../common/ConfirmDialog';
import UploadMasivo from '../UploadMasivo/UploadMasivo';
import { API_CONFIG } from '../../../config/apiConfig';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

const ProductosList = () => {
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para filtros y búsqueda
    const [categoriaActiva, setCategoriaActiva] = useState('');
    const [lineaActiva, setLineaActiva] = useState('');
    const [terminoBusqueda, setTerminoBusqueda] = useState('');
    const [busquedaDebounced, setBusquedaDebounced] = useState('');
    const [productosFiltrados, setProductosFiltrados] = useState([]);

    // Estados para modales
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetallesOpen, setIsDetallesOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isUploadMasivoOpen, setIsUploadMasivoOpen] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(null);

    // Estados para acciones
    const [modoForm, setModoForm] = useState('crear');
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Debouncing para la búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setBusquedaDebounced(terminoBusqueda);
        }, 300);
        return () => clearTimeout(timer);
    }, [terminoBusqueda]);

    // Cargar datos iniciales
    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Cargar productos y categorías en paralelo
            const [productosResponse, categoriasResponse] = await Promise.all([
                fetch(`${API_CONFIG.BASE_URL}/api/productos`, { headers: getAuthHeaders() }),
                fetch(`${API_CONFIG.BASE_URL}/api/productos/categorias`, { headers: getAuthHeaders() })
            ]);

            if (!productosResponse.ok || !categoriasResponse.ok) {
                throw new Error('Error al cargar datos');
            }

            const [productosData, categoriasData] = await Promise.all([
                productosResponse.json(),
                categoriasResponse.json()
            ]);

            if (productosData.success && Array.isArray(productosData.data)) {
                setProductos(productosData.data);
            }

            if (categoriasData.success && Array.isArray(categoriasData.data)) {
                setCategorias(categoriasData.data);
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // Filtrar productos
    useEffect(() => {
        let filtrados = productos;

        // Filtrar por búsqueda
        if (busquedaDebounced) {
            const termino = busquedaDebounced.toLowerCase();
            filtrados = filtrados.filter(producto =>
                producto.codigo?.toLowerCase().includes(termino) ||
                producto.descripcion?.toLowerCase().includes(termino) ||
                producto.marca?.toLowerCase().includes(termino) ||
                producto.linea_producto?.toLowerCase().includes(termino) ||
                producto.sublinea_producto?.toLowerCase().includes(termino)
            );
        }

        // Filtrar por categoría
        if (categoriaActiva) {
            filtrados = filtrados.filter(producto =>
                producto.categoria_nombre === categoriaActiva
            );
        }

        // Filtrar por línea
        if (lineaActiva) {
            filtrados = filtrados.filter(producto =>
                producto.linea_producto === lineaActiva
            );
        }

        setProductosFiltrados(filtrados);
    }, [productos, busquedaDebounced, categoriaActiva, lineaActiva]);

    // Obtener líneas únicas
    const lineasUnicas = [...new Set(productos.map(p => p.linea_producto).filter(Boolean))];

    // Acciones
    const handleNuevoProducto = () => {
        setModoForm('crear');
        setProductoSeleccionado(null);
        setIsFormOpen(true);
    };

    const handleEditarProducto = (producto) => {
        setModoForm('editar');
        setProductoSeleccionado(producto);
        setIsFormOpen(true);
        setMenuAbierto(null);
    };

    const handleDuplicarProducto = (producto) => {
        setModoForm('duplicar');
        setProductoSeleccionado(producto);
        setIsFormOpen(true);
        setMenuAbierto(null);
    };

    const handleVerDetalles = (producto) => {
        setProductoSeleccionado(producto);
        setIsDetallesOpen(true);
        setMenuAbierto(null);
    };

    const handleEliminarProducto = (producto) => {
        setProductoSeleccionado(producto);
        setIsConfirmOpen(true);
        setMenuAbierto(null);
    };

    const confirmarEliminacion = async () => {
        if (!productoSeleccionado) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/${productoSeleccionado.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                await cargarDatos();
                setIsConfirmOpen(false);
                setProductoSeleccionado(null);
            } else {
                throw new Error(data.error || 'Error al eliminar producto');
            }
        } catch (error) {
            console.error('Error:', error);
            setError(error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatearPrecio = (precio) => {
        if (!precio && precio !== 0) return '$0.00';
        return `$${parseFloat(precio).toFixed(2)}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Cargando productos...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Barra de herramientas */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    {/* Búsqueda y filtros */}
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        {/* Búsqueda */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar productos..."
                                value={terminoBusqueda}
                                onChange={(e) => setTerminoBusqueda(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
                            />
                        </div>

                        {/* Filtro por categoría */}
                        <select
                            value={categoriaActiva}
                            onChange={(e) => setCategoriaActiva(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas las categorías</option>
                            {categorias.map(categoria => (
                                <option key={categoria.id} value={categoria.nombre}>
                                    {categoria.nombre}
                                </option>
                            ))}
                        </select>

                        {/* Filtro por línea */}
                        <select
                            value={lineaActiva}
                            onChange={(e) => setLineaActiva(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas las líneas</option>
                            {lineasUnicas.map(linea => (
                                <option key={linea} value={linea}>
                                    {linea}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setIsUploadMasivoOpen(true)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Masivo
                        </button>
                        <button
                            onClick={handleNuevoProducto}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Producto
                        </button>
                    </div>
                </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-gray-900">{productos.length}</div>
                    <div className="text-sm text-gray-600">Total Productos</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-gray-900">{productosFiltrados.length}</div>
                    <div className="text-sm text-gray-600">Productos Mostrados</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-gray-900">{lineasUnicas.length}</div>
                    <div className="text-sm text-gray-600">Líneas de Producto</div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">{error}</p>
                    <button
                        onClick={cargarDatos}
                        className="mt-2 text-red-600 hover:text-red-500 underline text-sm"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Tabla de productos */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Producto
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Precio
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Categoría/Línea
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Unidad
                                </th>
                                <th className="relative px-6 py-3">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {productosFiltrados.map((producto) => (
                                <tr key={producto.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {producto.codigo}
                                            </div>
                                            <div className="text-sm text-gray-500 max-w-xs truncate">
                                                {producto.descripcion}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {producto.marca}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {formatearPrecio(producto.precio_sin_igv)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900">
                                            {producto.categoria_nombre}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {producto.linea_producto || 'Sin línea'}
                                            {producto.sublinea_producto && ` • ${producto.sublinea_producto}`}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {producto.unidad_medida}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="relative inline-block text-left">
                                            <button
                                                onClick={() => setMenuAbierto(menuAbierto === producto.id ? null : producto.id)}
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                            {menuAbierto === producto.id && (
                                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                                    <div className="py-1">
                                                        <button
                                                            onClick={() => handleVerDetalles(producto)}
                                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                        >
                                                            <Eye className="h-4 w-4 mr-3" />
                                                            Ver detalles
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditarProducto(producto)}
                                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                        >
                                                            <Edit className="h-4 w-4 mr-3" />
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicarProducto(producto)}
                                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                        >
                                                            <Copy className="h-4 w-4 mr-3" />
                                                            Duplicar
                                                        </button>
                                                        <button
                                                            onClick={() => handleEliminarProducto(producto)}
                                                            className="flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-3" />
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {productosFiltrados.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <div className="text-gray-500">
                            {terminoBusqueda || categoriaActiva || lineaActiva
                                ? 'No se encontraron productos con los filtros aplicados'
                                : 'No hay productos registrados'
                            }
                        </div>
                    </div>
                )}
            </div>

            {/* Modales */}
            {isFormOpen && (
                <ProductoForm
                    isOpen={isFormOpen}
                    onClose={() => {
                        setIsFormOpen(false);
                        setProductoSeleccionado(null);
                    }}
                    onSave={cargarDatos}
                    producto={productoSeleccionado}
                    modo={modoForm}
                    categorias={categorias}
                />
            )}

            {isDetallesOpen && (
                <ProductoDetalles
                    isOpen={isDetallesOpen}
                    onClose={() => {
                        setIsDetallesOpen(false);
                        setProductoSeleccionado(null);
                    }}
                    producto={productoSeleccionado}
                />
            )}

            {isUploadMasivoOpen && (
                <UploadMasivo
                    isOpen={isUploadMasivoOpen}
                    onClose={() => setIsUploadMasivoOpen(false)}
                    onUploadComplete={cargarDatos}
                    categorias={categorias}
                />
            )}

            {isConfirmOpen && (
                <ConfirmDialog
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={confirmarEliminacion}
                    loading={actionLoading}
                    title="Confirmar eliminación"
                    message={`¿Estás seguro de que deseas eliminar el producto "${productoSeleccionado?.codigo}"?`}
                />
            )}
        </div>
    );
};

export default ProductosList;