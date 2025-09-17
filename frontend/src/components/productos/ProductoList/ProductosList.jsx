import React, { useState, useEffect, useCallback } from 'react';
import ProductoForm from '../ProductoForm/ProductoForm';
import MenuAcciones from '../MenuAcciones/MenuAcciones';
import ProductoDetalles from '../ProductoDetalles/ProductoDetalles';
import ConfirmDialog from '../../common/ConfirmDialog';
import UploadMasivo from '../UploadMasivo/UploadMasivo';
const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('fake-jwt-token-for-testing') || 'fake-jwt-token-for-testing';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};
const ProductosList = () => {
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para filtros y búsqueda
    const [categoriaActiva, setCategoriaActiva] = useState(null); // null = todas las categorías
    const [terminoBusqueda, setTerminoBusqueda] = useState('');
    const [busquedaDebounced, setBusquedaDebounced] = useState('');
    const [productosFiltrados, setProductosFiltrados] = useState([]);
    
    // Estados para modales
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetallesOpen, setIsDetallesOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isUploadMasivoOpen, setIsUploadMasivoOpen] = useState(false);
    
    // Estados para acciones
    const [modoForm, setModoForm] = useState('crear'); // 'crear', 'editar', 'duplicar'
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [estadisticas, setEstadisticas] = useState({
        totalProductos: 0,
        totalCategorias: 0,
        precioPromedio: 0
    });

    // Debouncing para la búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setBusquedaDebounced(terminoBusqueda);
        }, 300);
        return () => clearTimeout(timer);
    }, [terminoBusqueda]);

    // Función para cargar categorías con manejo completo de errores
    const cargarCategorias = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3001/api/productos/categorias', {
    headers: getAuthHeaders()
});
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setCategorias(data.data);
                return data.data;
            } else {
                setCategorias([]);
                throw new Error('Formato de respuesta inválido');
            }
        } catch (error) {
            console.error('Error al cargar categorías:', error);
            setCategorias([]);
            throw new Error(`Error al cargar categorías: ${error.message}`);
        }
    }, []);

    // Función para cargar productos con manejo completo de errores
    const cargarProductos = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3001/api/productos', {
    headers: getAuthHeaders()
});
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setProductos(data.data);
                return data.data;
            } else {
                setProductos([]);
                throw new Error('Formato de respuesta inválido');
            }
        } catch (error) {
            console.error('Error al cargar productos:', error);
            setProductos([]);
            throw new Error(`Error al cargar productos: ${error.message}`);
        }
    }, []);

    // Función para buscar en productos por texto
    const buscarEnProductos = useCallback((productos, terminoBusqueda) => {
        if (!terminoBusqueda?.trim()) {
            return productos;
        }
        
        const termino = terminoBusqueda.toLowerCase().trim();
        return productos.filter(producto => 
            producto.codigo.toLowerCase().includes(termino) ||
            producto.descripcion.toLowerCase().includes(termino) ||
            producto.marca.toLowerCase().includes(termino)
        );
    }, []);

    // Función para filtrar productos por categoría
    const filtrarPorCategoria = useCallback((productos, categoriaId) => {
        if (!categoriaId) {
            return productos; // Mostrar todos si no hay filtro
        }
        return productos.filter(producto => 
            producto.categorias?.id === categoriaId || producto.categoria_id === categoriaId
        );
    }, []);

    // Función para aplicar todos los filtros (categoría + búsqueda)
    const aplicarFiltros = useCallback((productos, categoriaId, terminoBusqueda) => {
        let resultado = productos;
        
        // Aplicar filtro de categoría primero
        resultado = filtrarPorCategoria(resultado, categoriaId);
        
        // Aplicar búsqueda de texto
        resultado = buscarEnProductos(resultado, terminoBusqueda);
        
        return resultado;
    }, [filtrarPorCategoria, buscarEnProductos]);

    // Función para calcular estadísticas
    const calcularEstadisticas = useCallback((productos, categorias) => {
        const totalProductos = productos.length;
        const totalCategorias = categorias.length;
        const precioPromedio = totalProductos > 0
            ? productos.reduce((sum, producto) => {
                const precio = parseFloat(producto.precio_sin_igv) || 0;
                return sum + precio;
            }, 0) / totalProductos
            : 0;
        setEstadisticas({
            totalProductos,
            totalCategorias,
            precioPromedio: parseFloat(precioPromedio.toFixed(2))
        });
    }, []);

    // Función para contar productos por categoría (sin aplicar búsqueda)
    const contarProductosPorCategoria = useCallback((productos, categoriaId) => {
        return productos.filter(producto => 
            producto.categorias?.id === categoriaId || producto.categoria_id === categoriaId
        ).length;
    }, []);

    // Efecto para aplicar filtros cuando cambian productos, categoría activa o búsqueda
    useEffect(() => {
        const productosFiltrados = aplicarFiltros(productos, categoriaActiva, busquedaDebounced);
        setProductosFiltrados(productosFiltrados);
        calcularEstadisticas(productosFiltrados, categorias);
    }, [productos, categoriaActiva, busquedaDebounced, aplicarFiltros, calcularEstadisticas, categorias]);

    // Función para cargar todos los datos
    const cargarDatos = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [productosData, categoriasData] = await Promise.all([
                cargarProductos(),
                cargarCategorias()
            ]);
            // Las estadísticas se calcularán automáticamente por el efecto de arriba
            
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [cargarProductos, cargarCategorias]);

    // Cargar datos al montar el componente
    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // Función para formatear precio
    const formatearPrecio = (precio) => {
        const precioNum = parseFloat(precio) || 0;
        return `$ ${precioNum.toFixed(2)}`;
    };

    // =============== HANDLERS DE FILTROS Y BÚSQUEDA ===============
    const handleFiltrarPorCategoria = (categoriaId) => {
        setCategoriaActiva(categoriaId);
    };

    const handleMostrarTodos = () => {
        setCategoriaActiva(null);
    };

    const handleLimpiarBusqueda = () => {
        setTerminoBusqueda('');
    };

    const handleLimpiarTodosFiltros = () => {
        setCategoriaActiva(null);
        setTerminoBusqueda('');
    };

    // =============== HANDLERS DE FORMULARIO ===============
    const handleOpenForm = (modo = 'crear', producto = null) => {
        setModoForm(modo);
        setProductoSeleccionado(producto);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setModoForm('crear');
        setProductoSeleccionado(null);
    };

    const handleProductoCreated = () => {
        cargarDatos(); // Recargar toda la data
    };

    const handleProductoUpdated = () => {
        cargarDatos(); // Recargar toda la data
    };

    // =============== HANDLERS DE UPLOAD MASIVO ===============
    const handleOpenUploadMasivo = () => {
        setIsUploadMasivoOpen(true);
    };

    const handleCloseUploadMasivo = () => {
        setIsUploadMasivoOpen(false);
    };

    const handleUploadMasivoComplete = (results) => {
        // Recargar datos después del upload masivo
        cargarDatos();
        console.log('Upload masivo completado:', results);
    };

    // =============== HANDLERS DE ACCIONES ===============
    const handleVerDetalles = (producto) => {
        setProductoSeleccionado(producto);
        setIsDetallesOpen(true);
    };

    const handleEditar = (producto) => {
        handleOpenForm('editar', producto);
    };

    const handleDuplicar = (producto) => {
        handleOpenForm('duplicar', producto);
    };

    const handleEliminar = (producto) => {
        setProductoSeleccionado(producto);
        setIsConfirmOpen(true);
    };

    const confirmarEliminacion = async () => {
        if (!productoSeleccionado) return;
        setActionLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/productos/${productoSeleccionado.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                // Cerrar modal y recargar datos
                setIsConfirmOpen(false);
                setProductoSeleccionado(null);
                cargarDatos();
            } else {
                console.error('Error al eliminar producto:', data.error);
                // Aquí podrías mostrar un toast o mensaje de error
            }
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            // Aquí podrías mostrar un toast o mensaje de error
        } finally {
            setActionLoading(false);
        }
    };

    const cancelarEliminacion = () => {
        setIsConfirmOpen(false);
        setProductoSeleccionado(null);
    };

    // =============== RENDERS AUXILIARES ===============
    const getCategoriaActual = () => {
        if (!categoriaActiva) return null;
        return categorias.find(cat => cat.id === categoriaActiva);
    };

    const getTituloLista = () => {
        const partes = ['Lista de Productos'];
        
        if (categoriaActiva) {
            const categoriaActual = getCategoriaActual();
            if (categoriaActual) {
                partes.push(`Categoría: ${categoriaActual.nombre}`);
            }
        }
        
        if (busquedaDebounced) {
            partes.push(`Búsqueda: "${busquedaDebounced}"`);
        }
        
        return partes.join(' - ');
    };

    const getEstadoEmpty = () => {
        // Hay productos en general pero los filtros no devuelven resultados
        if (productos.length > 0 && productosFiltrados.length === 0) {
            if (busquedaDebounced && categoriaActiva) {
                const categoriaActual = getCategoriaActual();
                return {
                    titulo: 'No se encontraron productos',
                    mensaje: `No hay productos que coincidan con "${busquedaDebounced}" en la categoría "${categoriaActual?.nombre}"`,
                    acciones: [
                        { text: 'Limpiar búsqueda', action: handleLimpiarBusqueda, type: 'secondary' },
                        { text: 'Quitar filtros', action: handleLimpiarTodosFiltros, type: 'secondary' },
                        { text: 'Agregar producto', action: () => handleOpenForm('crear'), type: 'primary' }
                    ]
                };
            } else if (busquedaDebounced) {
                return {
                    titulo: 'No se encontraron productos',
                    mensaje: `No hay productos que coincidan con "${busquedaDebounced}"`,
                    acciones: [
                        { text: 'Limpiar búsqueda', action: handleLimpiarBusqueda, type: 'secondary' },
                        { text: 'Agregar producto', action: () => handleOpenForm('crear'), type: 'primary' }
                    ]
                };
            } else if (categoriaActiva) {
                const categoriaActual = getCategoriaActual();
                return {
                    titulo: 'No hay productos en esta categoría',
                    mensaje: `No se encontraron productos para "${categoriaActual?.nombre}"`,
                    acciones: [
                        { text: 'Ver todos los productos', action: handleMostrarTodos, type: 'secondary' },
                        { text: 'Agregar producto', action: () => handleOpenForm('crear'), type: 'primary' }
                    ]
                };
            }
        }
        
        // No hay productos en general
        return {
            titulo: 'No hay productos registrados',
            mensaje: 'Comienza agregando productos a tu catálogo',
            acciones: [
                { text: 'Upload masivo', action: handleOpenUploadMasivo, type: 'secondary' },
                { text: 'Agregar primer producto', action: () => handleOpenForm('crear'), type: 'primary' }
            ]
        };
    };

    // =============== RENDER ===============
    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Cargando productos...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <strong>Error:</strong> {error}
                    <button
                        onClick={cargarDatos}
                        className="ml-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const estadoEmpty = getEstadoEmpty();

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Productos</h1>
                <p className="text-gray-600">Administra tu catálogo de productos de forma eficiente</p>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">
                                {(categoriaActiva || busquedaDebounced) ? 'Productos Filtrados' : 'Total Productos'}
                            </p>
                            <p className="text-2xl font-bold text-gray-900">{estadisticas.totalProductos}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Categorías</p>
                            <p className="text-2xl font-bold text-gray-900">{estadisticas.totalCategorias}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">
                                {(categoriaActiva || busquedaDebounced) ? 'Precio Promedio (Filtrado)' : 'Precio Promedio'}
                            </p>
                            <p className="text-2xl font-bold text-gray-900">{formatearPrecio(estadisticas.precioPromedio)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Lista de Productos */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex-1">
                                    <h2 className="text-lg font-semibold text-gray-900">{getTituloLista()}</h2>
                                    
                                    {/* Indicadores de filtros activos */}
                                    {(categoriaActiva || busquedaDebounced) && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {categoriaActiva && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                                                    Categoría: {getCategoriaActual()?.nombre}
                                                    <button
                                                        onClick={handleMostrarTodos}
                                                        className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                                                        title="Quitar filtro de categoría"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </span>
                                            )}
                                            {busquedaDebounced && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                                                    Búsqueda: "{busquedaDebounced}"
                                                    <button
                                                        onClick={handleLimpiarBusqueda}
                                                        className="ml-2 text-green-600 hover:text-green-800 focus:outline-none"
                                                        title="Limpiar búsqueda"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </span>
                                            )}
                                            {(categoriaActiva && busquedaDebounced) && (
                                                <button
                                                    onClick={handleLimpiarTodosFiltros}
                                                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                                                >
                                                    Limpiar todos los filtros
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Búsqueda y botones */}
                                <div className="flex items-center space-x-3">
                                    {/* Input de búsqueda */}
                                    <div className="relative flex-1 min-w-0 sm:max-w-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={terminoBusqueda}
                                            onChange={(e) => setTerminoBusqueda(e.target.value)}
                                            placeholder="Buscar por código, descripción o marca..."
                                            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                        />
                                        {terminoBusqueda && (
                                            <button
                                                onClick={handleLimpiarBusqueda}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                                title="Limpiar búsqueda"
                                            >
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Botón Upload Masivo */}
                                    <button
                                        onClick={handleOpenUploadMasivo}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center whitespace-nowrap"
                                        title="Importar productos desde Excel/CSV"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="hidden sm:inline">Upload Masivo</span>
                                        <span className="sm:hidden">Upload</span>
                                    </button>
                                    
                                    {/* Botón agregar individual */}
                                    <button
                                        onClick={() => handleOpenForm('crear')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="hidden sm:inline">Agregar Producto</span>
                                        <span className="sm:hidden">Agregar</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-6">
                            {productosFiltrados.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">{estadoEmpty.titulo}</h3>
                                    <p className="text-gray-500 mb-6">{estadoEmpty.mensaje}</p>
                                    <div className="space-x-3">
                                        {estadoEmpty.acciones.map((accion, index) => (
                                            <button
                                                key={index}
                                                onClick={accion.action}
                                                className={`px-6 py-2 rounded-lg transition-colors duration-200 ${
                                                    accion.type === 'primary'
                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                                                }`}
                                            >
                                                {accion.text}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-auto max-h-[60vh] border border-gray-200 rounded">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CÓDIGO</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DESCRIPCIÓN</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRECIO</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MARCA</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UNIDAD</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CATEGORÍA</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACCIONES</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {productosFiltrados.map((producto) => (
                                                <tr key={producto.id} className="hover:bg-gray-50 transition-colors duration-150">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">{producto.codigo}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm text-gray-900 max-w-xs truncate" title={producto.descripcion}>
                                                            {producto.descripcion}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">{formatearPrecio(producto.precio_sin_igv)}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{producto.marca}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                                            producto.unidad_medida === 'MLL' 
                                                                ? 'bg-purple-100 text-purple-800' 
                                                                : 'bg-green-100 text-green-800'
                                                        }`}>
                                                            {producto.unidad_medida}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            {producto.categorias?.nombre || "Sin categoría"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <MenuAcciones
                                                            producto={producto}
                                                            onVer={() => handleVerDetalles(producto)}
                                                            onEditar={() => handleEditar(producto)}
                                                            onDuplicar={() => handleDuplicar(producto)}
                                                            onEliminar={() => handleEliminar(producto)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar - Filtros de Categorías */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Filtrar por Categoría</h2>
                        </div>
                        <div className="p-6">
                            {/* Opción "Todas las categorías" */}
                            <button
                                onClick={handleMostrarTodos}
                                className={`w-full mb-4 p-4 rounded-lg border transition-all duration-200 text-left ${
                                    !categoriaActiva
                                        ? 'bg-blue-100 border-blue-300 text-blue-900 shadow-sm'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium mb-1">Todas las categorías</h4>
                                        <p className="text-sm opacity-75">Ver todos los productos</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        !categoriaActiva
                                            ? 'bg-blue-200 text-blue-800'
                                            : 'bg-gray-200 text-gray-600'
                                    }`}>
                                        {productos.length}
                                    </span>
                                </div>
                            </button>

                            {/* Lista de categorías */}
                            {categorias.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-500">No hay categorías disponibles</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {categorias.map((categoria) => {
                                        const cantidadProductos = contarProductosPorCategoria(productos, categoria.id);
                                        const isActive = categoriaActiva === categoria.id;
                                        
                                        return (
                                            <button
                                                key={categoria.id}
                                                onClick={() => handleFiltrarPorCategoria(categoria.id)}
                                                className={`w-full p-4 rounded-lg border transition-all duration-200 text-left ${
                                                    isActive
                                                        ? 'bg-blue-100 border-blue-300 text-blue-900 shadow-sm'
                                                        : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-medium mb-1 truncate">
                                                            {categoria.nombre || 'Sin nombre'}
                                                        </h4>
                                                        <p className="text-sm opacity-75 truncate">
                                                            {categoria.descripcion || 'Sin descripción'}
                                                        </p>
                                                    </div>
                                                    <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                                        isActive
                                                            ? 'bg-blue-200 text-blue-800'
                                                            : 'bg-blue-200 text-blue-700'
                                                    }`}>
                                                        {cantidadProductos}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modales */}
            <ProductoForm
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                onProductoCreated={handleProductoCreated}
                onProductoUpdated={handleProductoUpdated}
                modo={modoForm}
                producto={productoSeleccionado}
            />

            <ProductoDetalles
                isOpen={isDetallesOpen}
                onClose={() => setIsDetallesOpen(false)}
                producto={productoSeleccionado}
            />

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={cancelarEliminacion}
                onConfirm={confirmarEliminacion}
                title="Eliminar Producto"
                message={`¿Estás seguro de que deseas eliminar el producto "${productoSeleccionado?.codigo}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={actionLoading}
            />

            {/* Modal Upload Masivo */}
            <UploadMasivo
                isOpen={isUploadMasivoOpen}
                onClose={handleCloseUploadMasivo}
                onUploadComplete={handleUploadMasivoComplete}
                categorias={categorias}
            />
        </div>
    );
};

export default ProductosList;