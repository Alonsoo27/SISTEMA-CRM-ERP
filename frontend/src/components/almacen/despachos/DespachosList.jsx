import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Filter, 
    Calendar, 
    Truck, 
    Package, 
    Eye,
    Edit,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Phone,
    MapPin,
    User,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    FileText,
    Send,
    X
} from 'lucide-react';
import almacenService from "../../../services/almacenService";

const DespachosList = () => {
    const [despachos, setDespachos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [error, setError] = useState(null);

    // Filtros
    const [filtros, setFiltros] = useState({
        busqueda: '',
        estado: '',
        almacen_id: '',
        fecha_desde: '',
        fecha_hasta: '',
        orden: 'fecha_programada',
        direccion: 'asc'
    });

    const [paginacion, setPaginacion] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    const [showFiltros, setShowFiltros] = useState(false);
    const [despachoSeleccionado, setDespachoSeleccionado] = useState(null);
    const [showModalDetalle, setShowModalDetalle] = useState(false);
    const [showModalEstado, setShowModalEstado] = useState(false);
    const [nuevoEstado, setNuevoEstado] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [actualizandoEstado, setActualizandoEstado] = useState(false);

    const estadosDespacho = [
        { value: 'PENDIENTE', label: 'Pendiente', color: 'yellow', icono: Clock, descripcion: 'Esperando preparación' },
        { value: 'PREPARANDO', label: 'Preparando', color: 'blue', icono: Package, descripcion: 'En proceso de preparación' },
        { value: 'LISTO', label: 'Listo', color: 'purple', icono: CheckCircle, descripcion: 'Listo para envío' },
        { value: 'ENVIADO', label: 'Enviado', color: 'orange', icono: Truck, descripcion: 'En camino al cliente' },
        { value: 'ENTREGADO', label: 'Entregado', color: 'green', icono: CheckCircle, descripcion: 'Entregado al cliente' },
        { value: 'CANCELADO', label: 'Cancelado', color: 'red', icono: XCircle, descripcion: 'Despacho cancelado' }
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

    const formatearFechaHora = (fecha) => {
        if (!fecha) return '-';
        try {
            return new Date(fecha).toLocaleString('es-PE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
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
        cargarDespachos();
    }, [filtros, paginacion.page]);

    const cargarDatos = async () => {
        try {
            const resultadoAlmacenes = await almacenService.obtenerAlmacenes();
            if (resultadoAlmacenes.success) {
                setAlmacenes(resultadoAlmacenes.data || []);
            } else {
                console.error('Error cargando almacenes:', resultadoAlmacenes.error);
            }
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    };

    const cargarDespachos = async () => {
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

            const resultado = await almacenService.obtenerDespachos(parametros);

            if (resultado.success) {
                setDespachos(resultado.data || []);
                // Actualizar paginación si viene en la respuesta
                if (resultado.pagination) {
                    setPaginacion(prev => ({
                        ...prev,
                        total: resultado.pagination.total || 0,
                        totalPages: resultado.pagination.totalPages || 0
                    }));
                }
            } else {
                setError(resultado.error || 'Error al cargar despachos');
                setDespachos([]);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al cargar despachos');
            setDespachos([]);
            console.error('Error cargando despachos:', err);
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

    const limpiarFiltros = () => {
        setFiltros({
            busqueda: '',
            estado: '',
            almacen_id: '',
            fecha_desde: '',
            fecha_hasta: '',
            orden: 'fecha_programada',
            direccion: 'asc'
        });
        setPaginacion(prev => ({ ...prev, page: 1 }));
    };

    const abrirModalDetalle = async (despacho) => {
        try {
            setLoadingDetalle(true);
            const resultado = await almacenService.obtenerDespachoPorId(despacho.id);
            if (resultado.success) {
                setDespachoSeleccionado(resultado.data);
                setShowModalDetalle(true);
            } else {
                setError(resultado.error || 'Error al obtener detalle del despacho');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al obtener detalle');
            console.error('Error obteniendo detalle:', err);
        } finally {
            setLoadingDetalle(false);
        }
    };

    const abrirModalEstado = (despacho) => {
        setDespachoSeleccionado(despacho);
        setNuevoEstado('');
        setObservaciones('');
        setShowModalEstado(true);
    };

    const cerrarModales = () => {
        setShowModalDetalle(false);
        setShowModalEstado(false);
        setDespachoSeleccionado(null);
        setNuevoEstado('');
        setObservaciones('');
    };

    const actualizarEstado = async () => {
        if (!nuevoEstado || !despachoSeleccionado) return;

        // Validar observaciones para cancelación
        if (nuevoEstado === 'CANCELADO' && !observaciones.trim()) {
            return;
        }

        try {
            setActualizandoEstado(true);

            const resultado = await almacenService.actualizarEstadoDespacho(
                despachoSeleccionado.id,
                {
                    nuevo_estado: nuevoEstado,
                    observaciones: observaciones.trim()
                }
            );

            if (resultado.success) {
                setShowModalEstado(false);
                await cargarDespachos(); // Recargar lista
                setError(null);
            } else {
                setError(resultado.error || 'Error al actualizar estado');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al actualizar estado');
            console.error('Error actualizando estado:', err);
        } finally {
            setActualizandoEstado(false);
        }
    };

    const obtenerConfigEstado = (estado) => {
        return estadosDespacho.find(e => e.value === estado) || estadosDespacho[0];
    };

    const EstadoDespachoBadge = ({ estado }) => {
        const config = obtenerConfigEstado(estado);
        const Icono = config.icono;

        const colorClasses = {
            yellow: 'bg-yellow-100 text-yellow-800',
            blue: 'bg-blue-100 text-blue-800',
            purple: 'bg-purple-100 text-purple-800',
            orange: 'bg-orange-100 text-orange-800',
            green: 'bg-green-100 text-green-800',
            red: 'bg-red-100 text-red-800'
        };

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses[config.color]}`}>
                <Icono className="h-3 w-3 mr-1" />
                {config.label}
            </span>
        );
    };

    const esPrioridad = (despacho) => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaProgramada = new Date(despacho.fecha_programada);
        fechaProgramada.setHours(0, 0, 0, 0);
        
        return fechaProgramada <= hoy && !['ENTREGADO', 'CANCELADO'].includes(despacho.estado);
    };

    const ModalDetalle = () => {
        if (!showModalDetalle || !despachoSeleccionado) return null;

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div 
                        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                        onClick={cerrarModales}
                        aria-hidden="true"
                    ></div>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center">
                                    <Truck className="h-6 w-6 text-blue-600 mr-2" />
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                                        Detalle del Despacho
                                    </h3>
                                </div>
                                <button
                                    onClick={cerrarModales}
                                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                                    aria-label="Cerrar"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {loadingDetalle ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-2 text-sm text-gray-500">Cargando detalle...</p>
                                </div>
                            ) : (
                                <div className="space-y-6 max-h-96 overflow-y-auto">
                                    {/* Info básica */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Código</label>
                                            <p className="mt-1 text-sm text-gray-900 font-mono">{despachoSeleccionado.codigo}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Estado</label>
                                            <div className="mt-1">
                                                <EstadoDespachoBadge estado={despachoSeleccionado.estado} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info del cliente */}
                                    <div className="border-t pt-6">
                                        <h4 className="text-md font-medium text-gray-900 mb-4">Información del Cliente</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Cliente</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {despachoSeleccionado.ventas?.nombre_cliente || '-'} {despachoSeleccionado.ventas?.apellido_cliente || ''}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Empresa</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {despachoSeleccionado.ventas?.cliente_empresa || '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                                                <div className="mt-1 flex items-center text-sm text-gray-900">
                                                    <Phone className="h-4 w-4 mr-1 text-gray-400" />
                                                    {despachoSeleccionado.ventas?.cliente_telefono || '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                                <p className="mt-1 text-sm text-gray-900 break-words">
                                                    {despachoSeleccionado.ventas?.cliente_email || '-'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700">Dirección</label>
                                            <div className="mt-1 flex items-start text-sm text-gray-900">
                                                <MapPin className="h-4 w-4 mr-1 text-gray-400 mt-0.5 flex-shrink-0" />
                                                <span>
                                                    {despachoSeleccionado.ventas?.ciudad || 'Lima'}, {despachoSeleccionado.ventas?.departamento || 'Lima'}
                                                    {despachoSeleccionado.ventas?.distrito && `, ${despachoSeleccionado.ventas?.distrito}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info del despacho */}
                                    <div className="border-t pt-6">
                                        <h4 className="text-md font-medium text-gray-900 mb-4">Información del Despacho</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Almacén</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {despachoSeleccionado.almacenes?.nombre || '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Fecha Programada</label>
                                                <div className="mt-1 flex items-center text-sm text-gray-900">
                                                    <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                                                    {formatearFecha(despachoSeleccionado.fecha_programada)}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Valor Total</label>
                                                <p className="mt-1 text-sm text-gray-900 font-medium">
                                                    {formatearMoneda(despachoSeleccionado.ventas?.valor_final)}
                                                </p>
                                            </div>
                                            {despachoSeleccionado.fecha_envio && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Fecha Envío</label>
                                                    <p className="mt-1 text-sm text-gray-900">
                                                        {formatearFechaHora(despachoSeleccionado.fecha_envio)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Productos */}
                                    {despachoSeleccionado.ventas?.venta_detalles && despachoSeleccionado.ventas.venta_detalles.length > 0 && (
                                        <div className="border-t pt-6">
                                            <h4 className="text-md font-medium text-gray-900 mb-4">Productos a Despachar</h4>
                                            <div className="space-y-3 max-h-32 overflow-y-auto">
                                                {despachoSeleccionado.ventas.venta_detalles.map((producto, index) => (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {producto.productos?.codigo || `Producto ${index + 1}`}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                {producto.productos?.descripcion || producto.descripcion_personalizada || '-'}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {producto.productos?.marca || '-'} • {producto.productos?.unidad_medida || 'UND'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {formatearNumero(producto.cantidad, 0)}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {formatearMoneda(producto.precio_unitario)} c/u
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Observaciones */}
                                    {(despachoSeleccionado.observaciones_preparacion || despachoSeleccionado.observaciones_envio) && (
                                        <div className="border-t pt-6">
                                            <h4 className="text-md font-medium text-gray-900 mb-4">Observaciones</h4>
                                            {despachoSeleccionado.observaciones_preparacion && (
                                                <div className="mb-3">
                                                    <label className="block text-sm font-medium text-gray-700">Preparación</label>
                                                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                                                        {despachoSeleccionado.observaciones_preparacion}
                                                    </p>
                                                </div>
                                            )}
                                            {despachoSeleccionado.observaciones_envio && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Envío</label>
                                                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                                                        {despachoSeleccionado.observaciones_envio}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div className="border-t pt-6">
                                        <h4 className="text-md font-medium text-gray-900 mb-4">Timeline</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <Calendar className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-900">Creado</p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatearFechaHora(despachoSeleccionado.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                            {despachoSeleccionado.fecha_preparacion && (
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                                        <Package className="h-4 w-4 text-purple-600" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-gray-900">Preparado</p>
                                                        <p className="text-xs text-gray-500">
                                                            {formatearFechaHora(despachoSeleccionado.fecha_preparacion)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {despachoSeleccionado.fecha_envio && (
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                                        <Truck className="h-4 w-4 text-orange-600" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-gray-900">Enviado</p>
                                                        <p className="text-xs text-gray-500">
                                                            {formatearFechaHora(despachoSeleccionado.fecha_envio)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {despachoSeleccionado.fecha_entrega && (
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-gray-900">Entregado</p>
                                                        <p className="text-xs text-gray-500">
                                                            {formatearFechaHora(despachoSeleccionado.fecha_entrega)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            {!loadingDetalle && despachoSeleccionado && !['ENTREGADO', 'CANCELADO'].includes(despachoSeleccionado.estado) && (
                                <button
                                    onClick={() => abrirModalEstado(despachoSeleccionado)}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Actualizar Estado
                                </button>
                            )}
                            <button
                                onClick={cerrarModales}
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

    const ModalEstado = () => {
        if (!showModalEstado || !despachoSeleccionado) return null;

        const estadosPermitidos = estadosDespacho.filter(estado => {
            const estadoActual = despachoSeleccionado.estado;
            // Lógica de transiciones permitidas
            switch (estadoActual) {
                case 'PENDIENTE':
                    return ['PREPARANDO', 'CANCELADO'].includes(estado.value);
                case 'PREPARANDO':
                    return ['LISTO', 'CANCELADO'].includes(estado.value);
                case 'LISTO':
                    return ['ENVIADO', 'CANCELADO'].includes(estado.value);
                case 'ENVIADO':
                    return ['ENTREGADO'].includes(estado.value);
                default:
                    return false;
            }
        });

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div 
                        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                        onClick={cerrarModales}
                        aria-hidden="true"
                    ></div>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Actualizar Estado del Despacho
                                </h3>
                                <button
                                    onClick={cerrarModales}
                                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                                    aria-label="Cerrar"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm font-medium text-gray-900">{despachoSeleccionado.codigo}</p>
                                    <p className="text-sm text-gray-600 flex items-center mt-1">
                                        Estado actual: <span className="ml-2"><EstadoDespachoBadge estado={despachoSeleccionado.estado} /></span>
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nuevo Estado *
                                    </label>
                                    {estadosPermitidos.length === 0 ? (
                                        <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded">
                                            No hay transiciones de estado disponibles para este despacho.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {estadosPermitidos.map(estado => {
                                                const Icono = estado.icono;
                                                return (
                                                    <label key={estado.value} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="nuevoEstado"
                                                            value={estado.value}
                                                            checked={nuevoEstado === estado.value}
                                                            onChange={(e) => setNuevoEstado(e.target.value)}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                        />
                                                        <div className="ml-3 flex items-center">
                                                            <Icono className="h-4 w-4 mr-2 text-gray-500" />
                                                            <span className="text-sm font-medium text-gray-900">{estado.label}</span>
                                                            <span className="ml-2 text-sm text-gray-500">- {estado.descripcion}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Observaciones {nuevoEstado === 'CANCELADO' ? '*' : ''}
                                    </label>
                                    <textarea
                                        value={observaciones}
                                        onChange={(e) => setObservaciones(e.target.value)}
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        placeholder={
                                            nuevoEstado === 'CANCELADO' 
                                                ? 'Motivo de cancelación (requerido)...'
                                                : 'Observaciones adicionales (opcional)...'
                                        }
                                        maxLength="1000"
                                    />
                                    {nuevoEstado === 'CANCELADO' && !observaciones.trim() && (
                                        <p className="mt-1 text-sm text-red-600">
                                            Las observaciones son requeridas para cancelar un despacho
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-gray-500">
                                        {observaciones.length}/1000 caracteres
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                onClick={actualizarEstado}
                                disabled={actualizandoEstado || !nuevoEstado || (nuevoEstado === 'CANCELADO' && !observaciones.trim()) || estadosPermitidos.length === 0}
                                className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {actualizandoEstado ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Actualizando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Actualizar Estado
                                    </>
                                )}
                            </button>
                            <button
                                onClick={cerrarModales}
                                disabled={actualizandoEstado}
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
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
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Despachos</h1>
                    <p className="text-gray-600">Control de entregas y envíos de productos</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={cargarDespachos}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
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
                                    placeholder="Buscar por código, cliente o venta..."
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
                            {(filtros.busqueda || filtros.estado || filtros.almacen_id || filtros.fecha_desde || filtros.fecha_hasta) && (
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
                                    Estado
                                </label>
                                <select
                                    value={filtros.estado}
                                    onChange={(e) => handleFiltroChange('estado', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Todos los estados</option>
                                    {estadosDespacho.map(estado => (
                                        <option key={estado.value} value={estado.value}>
                                            {estado.label}
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Código
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cliente
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Almacén
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fecha Programada
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Valor
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
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : error ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <FileText className="h-12 w-12 text-red-300 mx-auto mb-4" />
                                        <p className="text-red-600 font-medium">{error}</p>
                                        <button
                                            onClick={cargarDespachos}
                                            className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
                                        >
                                            Reintentar
                                        </button>
                                    </td>
                                </tr>
                            ) : despachos.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">No se encontraron despachos</p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            {Object.values(filtros).some(f => f) 
                                                ? 'Intenta ajustar los filtros de búsqueda'
                                                : 'Aún no hay despachos registrados'
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                despachos.map((despacho) => (
                                    <tr 
                                        key={despacho.id} 
                                        className={`hover:bg-gray-50 transition-colors ${esPrioridad(despacho) ? 'bg-red-50' : ''}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {esPrioridad(despacho) && (
                                                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" title="Urgente - Vencido" />
                                                )}
                                                <span className="text-sm font-medium text-gray-900 font-mono">
                                                    {despacho.codigo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div>
                                                <p className="font-medium">
                                                    {despacho.ventas?.nombre_cliente || 'Cliente'} {despacho.ventas?.apellido_cliente || ''}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {despacho.ventas?.cliente_telefono || '-'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {despacho.almacenes?.nombre || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                            <div className="flex items-center justify-center">
                                                <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                                                {formatearFecha(despacho.fecha_programada)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <EstadoDespachoBadge estado={despacho.estado} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                            {formatearMoneda(despacho.ventas?.valor_final)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => abrirModalDetalle(despacho)}
                                                    className="text-blue-600 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 transition-colors"
                                                    title="Ver detalle"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {!['ENTREGADO', 'CANCELADO'].includes(despacho.estado) && (
                                                    <button
                                                        onClick={() => abrirModalEstado(despacho)}
                                                        className="text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1 transition-colors"
                                                        title="Actualizar estado"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
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

            {/* Modales */}
            <ModalDetalle />
            <ModalEstado />
        </div>
    );
};

export default DespachosList;