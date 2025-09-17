import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
    DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
    Clock, Wrench, XCircle, Package, CheckCircle, 
    MoreVertical, Pause, Play, AlertTriangle, Eye,
    RefreshCw, Filter, Search, Settings
} from 'lucide-react';

const ProductosGrid = () => {
    const [productos, setProductos] = useState({
        POR_REPARAR: [],
        IRREPARABLE: [],
        IRREPARABLE_REPUESTOS: [],
        REPARADO: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showPausasModal, setShowPausasModal] = useState(false);
    const [filtros, setFiltros] = useState({
        busqueda: '',
        solo_pausados: false,
        tecnico_id: null
    });

    // Configuración de categorías
    const categorias = {
        POR_REPARAR: {
            titulo: 'Por Reparar',
            color: 'border-amber-200 bg-amber-50',
            headerColor: 'text-amber-700 border-amber-200',
            icon: Wrench,
            iconColor: 'text-amber-600'
        },
        IRREPARABLE: {
            titulo: 'Irreparables',
            color: 'border-red-200 bg-red-50',
            headerColor: 'text-red-700 border-red-200',
            icon: XCircle,
            iconColor: 'text-red-600'
        },
        IRREPARABLE_REPUESTOS: {
            titulo: 'Para Repuestos',
            color: 'border-blue-200 bg-blue-50',
            headerColor: 'text-blue-700 border-blue-200',
            icon: Package,
            iconColor: 'text-blue-600'
        },
        REPARADO: {
            titulo: 'Reparados',
            color: 'border-green-200 bg-green-50',
            headerColor: 'text-green-700 border-green-200',
            icon: CheckCircle,
            iconColor: 'text-green-600'
        }
    };

    useEffect(() => {
        fetchProductos();
    }, [filtros]);

    const fetchProductos = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            
            if (filtros.busqueda) queryParams.append('busqueda', filtros.busqueda);
            if (filtros.solo_pausados) queryParams.append('pausados', 'true');
            if (filtros.tecnico_id) queryParams.append('tecnico_id', filtros.tecnico_id);

            const response = await fetch(`/api/soporte/productos/categorias?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching productos');

            const data = await response.json();
            
            if (data.success) {
                setProductos(data.data);
            } else {
                throw new Error(data.message || 'Error obteniendo productos');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePausarProducto = (producto) => {
        setSelectedProduct(producto);
        setShowPausasModal(true);
    };

    const handleReanudarProducto = async (productoId) => {
        try {
            const response = await fetch(`/api/soporte/productos/${productoId}/reanudar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    observaciones: 'Reanudado desde grid de productos'
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchProductos(); // Refresh
            } else {
                alert('Error reanudando producto: ' + data.message);
            }
        } catch (error) {
            alert('Error reanudando producto: ' + error.message);
        }
    };

    const handleCambiarCategoria = async (productoId, nuevaCategoria) => {
        try {
            const response = await fetch(`/api/soporte/productos/${productoId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    categoria: nuevaCategoria,
                    estado: nuevaCategoria === 'REPARADO' ? 'REPARADO' : 'EN_DIAGNOSTICO'
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchProductos(); // Refresh
            } else {
                alert('Error cambiando categoría: ' + data.message);
            }
        } catch (error) {
            alert('Error cambiando categoría: ' + error.message);
        }
    };

    const handleMarcarReparado = async (productoId) => {
        const observaciones = prompt('Observaciones de reparación (opcional):');
        const costo = prompt('Costo de reparación (opcional):');

        try {
            const response = await fetch(`/api/soporte/productos/${productoId}/reparar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    observaciones_reparacion: observaciones || '',
                    costo_reparacion: costo ? parseFloat(costo) : null
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Producto marcado como reparado. Ticket a almacén creado automáticamente.');
                fetchProductos(); // Refresh
            } else {
                alert('Error marcando como reparado: ' + data.message);
            }
        } catch (error) {
            alert('Error marcando como reparado: ' + error.message);
        }
    };

    const renderProductCard = (producto, categoria) => {
        const config = categorias[categoria];
        
        return (
            <div 
                key={producto.id} 
                className={`p-3 border rounded-lg ${config.color} hover:shadow-sm transition-shadow`}
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                                {producto.codigo_producto}
                            </h4>
                            {producto.esta_pausado && (
                                <Badge variant="warning" className="text-xs">
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pausado
                                </Badge>
                            )}
                        </div>
                        
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                            {producto.descripcion_producto}
                        </p>

                        <div className="space-y-1">
                            {producto.cliente_nombre && (
                                <p className="text-xs text-gray-500">
                                    Cliente: {producto.cliente_nombre}
                                </p>
                            )}
                            
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                {producto.fecha_recepcion ? 
                                    new Date(producto.fecha_recepcion).toLocaleDateString() : 
                                    'Sin fecha'
                                }
                            </div>

                            {producto.tiempo_total_reparacion_dias && (
                                <p className="text-xs text-gray-500">
                                    Tiempo: {producto.tiempo_total_reparacion_dias} días
                                </p>
                            )}
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => {/* Ver detalles */}}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalles
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {categoria === 'POR_REPARAR' && (
                                <>
                                    {producto.esta_pausado ? (
                                        <DropdownMenuItem 
                                            onClick={() => handleReanudarProducto(producto.id)}
                                            className="text-green-600"
                                        >
                                            <Play className="h-4 w-4 mr-2" />
                                            Reanudar
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem 
                                            onClick={() => handlePausarProducto(producto)}
                                            className="text-amber-600"
                                        >
                                            <Pause className="h-4 w-4 mr-2" />
                                            Pausar
                                        </DropdownMenuItem>
                                    )}
                                    
                                    <DropdownMenuItem 
                                        onClick={() => handleMarcarReparado(producto.id)}
                                        className="text-green-600"
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Marcar Reparado
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem 
                                        onClick={() => handleCambiarCategoria(producto.id, 'IRREPARABLE')}
                                        className="text-red-600"
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Marcar Irreparable
                                    </DropdownMenuItem>
                                </>
                            )}

                            {categoria === 'IRREPARABLE' && (
                                <>
                                    <DropdownMenuItem 
                                        onClick={() => handleCambiarCategoria(producto.id, 'IRREPARABLE_REPUESTOS')}
                                        className="text-blue-600"
                                    >
                                        <Package className="h-4 w-4 mr-2" />
                                        Usar para Repuestos
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem 
                                        onClick={() => handleCambiarCategoria(producto.id, 'POR_REPARAR')}
                                        className="text-amber-600"
                                    >
                                        <Wrench className="h-4 w-4 mr-2" />
                                        Intentar Reparar
                                    </DropdownMenuItem>
                                </>
                            )}

                            {categoria === 'IRREPARABLE_REPUESTOS' && (
                                <DropdownMenuItem 
                                    onClick={() => handleCambiarCategoria(producto.id, 'IRREPARABLE')}
                                    className="text-red-600"
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Marcar como Desecho
                                </DropdownMenuItem>
                            )}

                            {categoria === 'REPARADO' && (
                                <DropdownMenuItem disabled className="text-gray-400">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Enviado a Almacén
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-gray-600">Cargando productos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert className="m-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error cargando productos: {error}
                    <Button onClick={fetchProductos} className="ml-4" size="sm">
                        Reintentar
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filtros y controles */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            value={filtros.busqueda}
                            onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64"
                        />
                    </div>
                    
                    <Button
                        variant={filtros.solo_pausados ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFiltros(prev => ({ ...prev, solo_pausados: !prev.solo_pausados }))}
                    >
                        <Pause className="h-4 w-4 mr-2" />
                        Solo Pausados
                    </Button>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button onClick={fetchProductos} size="sm" variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                    
                    <Button size="sm" variant="outline">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtros
                    </Button>
                </div>
            </div>

            {/* Grid de las 4 categorías */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {Object.entries(categorias).map(([key, config]) => {
                    const productosCategoria = productos[key] || [];
                    const Icon = config.icon;
                    
                    return (
                        <Card key={key} className="h-fit">
                            <CardHeader className={`pb-3 border-b ${config.headerColor}`}>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Icon className={`h-5 w-5 ${config.iconColor}`} />
                                    {config.titulo}
                                    <Badge variant="secondary" className="ml-auto">
                                        {productosCategoria.length}
                                    </Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {key === 'POR_REPARAR' && 'Productos esperando reparación'}
                                    {key === 'IRREPARABLE' && 'Productos que no se pueden reparar'}
                                    {key === 'IRREPARABLE_REPUESTOS' && 'Útiles para repuestos'}
                                    {key === 'REPARADO' && 'Listos para almacén'}
                                </CardDescription>
                            </CardHeader>
                            
                            <CardContent className="p-4">
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {productosCategoria.length > 0 ? (
                                        productosCategoria.map(producto => 
                                            renderProductCard(producto, key)
                                        )
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <Icon className={`h-8 w-8 mx-auto mb-2 ${config.iconColor} opacity-50`} />
                                            <p className="text-sm">No hay productos en esta categoría</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Resumen */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Resumen</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-amber-600">
                                {productos.POR_REPARAR?.length || 0}
                            </div>
                            <div className="text-sm text-gray-600">Por Reparar</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">
                                {productos.REPARADO?.length || 0}
                            </div>
                            <div className="text-sm text-gray-600">Reparados</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-red-600">
                                {productos.IRREPARABLE?.length || 0}
                            </div>
                            <div className="text-sm text-gray-600">Irreparables</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-600">
                                {productos.IRREPARABLE_REPUESTOS?.length || 0}
                            </div>
                            <div className="text-sm text-gray-600">Para Repuestos</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Modal de pausas se renderizaría aquí cuando esté implementado */}
            {showPausasModal && selectedProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">
                            Pausar Producto: {selectedProduct.codigo_producto}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            El modal de pausas se implementará en el siguiente archivo (PausasModal.jsx)
                        </p>
                        <div className="flex gap-2 justify-end">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowPausasModal(false)}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductosGrid;