import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
    DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
    Clock, MoreVertical, Eye, Calendar, Phone, User, 
    RefreshCw, Search, Filter, Plus, CheckCircle, XCircle,
    AlertTriangle, PlayCircle, PauseCircle, MapPin,
    Star, MessageSquare, Settings, CalendarDays
} from 'lucide-react';

const CapacitacionesList = ({ onCapacitacionSelect, onCreateCapacitacion }) => {
    const [capacitaciones, setCapacitaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtros, setFiltros] = useState({
        estado: '',
        tecnico_id: '',
        tipo_capacitacion: '',
        modalidad: '',
        fecha_desde: '',
        fecha_hasta: '',
        busqueda: ''
    });
    const [tecnicos, setTecnicos] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    // Configuración de estados
    const estados = [
        { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-gray-100 text-gray-800', icon: Clock },
        { value: 'PROGRAMADA', label: 'Programada', color: 'bg-blue-100 text-blue-800', icon: Calendar },
        { value: 'EN_PROCESO', label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800', icon: PlayCircle },
        { value: 'COMPLETADA', label: 'Completada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
        { value: 'CANCELADA', label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: XCircle },
        { value: 'REPROGRAMADA', label: 'Reprogramada', color: 'bg-purple-100 text-purple-800', icon: CalendarDays }
    ];

    const tiposCapacitacion = [
        { value: 'INSTALACION', label: 'Instalación', descripcion: 'Instalación inicial del producto' },
        { value: 'USO_BASICO', label: 'Uso Básico', descripcion: 'Capacitación en funciones básicas' },
        { value: 'MANTENIMIENTO', label: 'Mantenimiento', descripcion: 'Cuidado y mantenimiento del producto' },
        { value: 'AVANZADA', label: 'Avanzada', descripcion: 'Funciones avanzadas y personalización' },
        { value: 'TROUBLESHOOTING', label: 'Resolución de Problemas', descripcion: 'Solución de problemas comunes' }
    ];

    const modalidades = [
        { value: 'PRESENCIAL', label: 'Presencial', icon: MapPin, color: 'text-blue-600' },
        { value: 'VIRTUAL', label: 'Virtual', icon: Phone, color: 'text-green-600' },
        { value: 'TELEFONICA', label: 'Telefónica', icon: Phone, color: 'text-purple-600' }
    ];

    useEffect(() => {
        fetchCapacitaciones();
        fetchTecnicos();
    }, [filtros, pagination.page]);

    const fetchCapacitaciones = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            
            // Agregar filtros
            Object.entries(filtros).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });
            
            // Agregar paginación
            queryParams.append('limite', pagination.limit);
            queryParams.append('offset', (pagination.page - 1) * pagination.limit);

            const response = await fetch(`/api/soporte/capacitaciones?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching capacitaciones');

            const data = await response.json();
            
            if (data.success) {
                setCapacitaciones(data.data.capacitaciones || []);
                setPagination(prev => ({
                    ...prev,
                    total: data.data.total || 0,
                    totalPages: Math.ceil((data.data.total || 0) / pagination.limit)
                }));
            } else {
                throw new Error(data.message || 'Error obteniendo capacitaciones');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTecnicos = async () => {
        try {
            const response = await fetch('/api/usuarios?rol=tecnico&activo=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setTecnicos(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching técnicos:', error);
        }
    };

    const handleCambiarEstado = async (capacitacionId, nuevoEstado) => {
        try {
            let endpoint = `/api/soporte/capacitaciones/${capacitacionId}`;
            let body = { estado: nuevoEstado };

            // Endpoints específicos para ciertas acciones
            if (nuevoEstado === 'COMPLETADA') {
                endpoint = `/api/soporte/capacitaciones/${capacitacionId}/completar`;
                const duracion = prompt('Duración real de la capacitación (horas):');
                const exitosa = confirm('¿La capacitación fue exitosa?');
                const calificacion = prompt('Calificación del cliente (1-5):');
                
                body = {
                    duracion_real: duracion ? parseInt(duracion) : null,
                    capacitacion_exitosa: exitosa,
                    calificacion_cliente: calificacion ? parseInt(calificacion) : null,
                    observaciones_tecnico: prompt('Observaciones del técnico (opcional):') || ''
                };
            } else if (nuevoEstado === 'REPROGRAMADA') {
                endpoint = `/api/soporte/capacitaciones/${capacitacionId}/reprogramar`;
                const nuevaFecha = prompt('Nueva fecha (YYYY-MM-DD):');
                const motivo = prompt('Motivo de reprogramación:');
                
                if (!nuevaFecha || !motivo) {
                    alert('Nueva fecha y motivo son requeridos');
                    return;
                }
                
                body = {
                    nueva_fecha: nuevaFecha,
                    motivo_reprogramacion: motivo
                };
            }

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success) {
                fetchCapacitaciones(); // Refresh
                alert('Estado actualizado exitosamente');
            } else {
                alert('Error actualizando estado: ' + data.message);
            }
        } catch (error) {
            alert('Error actualizando estado: ' + error.message);
        }
    };

    const limpiarFiltros = () => {
        setFiltros({
            estado: '',
            tecnico_id: '',
            tipo_capacitacion: '',
            modalidad: '',
            fecha_desde: '',
            fecha_hasta: '',
            busqueda: ''
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const getEstadoBadge = (estado) => {
        const estadoConfig = estados.find(e => e.value === estado);
        const Icon = estadoConfig?.icon || Clock;
        return (
            <Badge className={estadoConfig?.color}>
                <Icon className="h-3 w-3 mr-1" />
                {estadoConfig?.label || estado}
            </Badge>
        );
    };

    const getModalidadIcon = (modalidad) => {
        const modalidadConfig = modalidades.find(m => m.value === modalidad);
        if (!modalidadConfig) return <Phone className="h-4 w-4" />;
        
        const Icon = modalidadConfig.icon;
        return <Icon className={`h-4 w-4 ${modalidadConfig.color}`} />;
    };

    const calcularTiempoHasta = (fecha) => {
        if (!fecha) return null;
        
        const fechaCapacitacion = new Date(fecha);
        const ahora = new Date();
        const diferencia = fechaCapacitacion - ahora;
        
        if (diferencia < 0) return 'Vencida';
        
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (dias > 0) return `En ${dias}d ${horas}h`;
        if (horas > 0) return `En ${horas}h`;
        return 'Hoy';
    };

    const getCalificacionStars = (calificacion) => {
        if (!calificacion) return null;
        
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                        key={star}
                        className={`h-3 w-3 ${
                            star <= calificacion 
                                ? 'text-yellow-400 fill-current' 
                                : 'text-gray-300'
                        }`}
                    />
                ))}
                <span className="text-xs text-gray-600 ml-1">({calificacion}/5)</span>
            </div>
        );
    };

    if (loading && capacitaciones.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-gray-600">Cargando capacitaciones...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert className="m-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error cargando capacitaciones: {error}
                    <Button onClick={fetchCapacitaciones} className="ml-4" size="sm">
                        Reintentar
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header y controles */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Capacitaciones</h2>
                    <p className="text-gray-600 mt-1">
                        {pagination.total} capacitaciones encontradas
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button onClick={fetchCapacitaciones} size="sm" variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                    {onCreateCapacitacion && (
                        <Button onClick={onCreateCapacitacion} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Capacitación
                        </Button>
                    )}
                </div>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filtros</CardTitle>
                    <CardDescription>
                        Filtra las capacitaciones por diferentes criterios
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Búsqueda */}
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Buscar capacitaciones..."
                                value={filtros.busqueda}
                                onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                                className="pl-10"
                            />
                        </div>

                        {/* Estado */}
                        <Select 
                            value={filtros.estado} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, estado: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todos los estados</SelectItem>
                                {estados.map(estado => (
                                    <SelectItem key={estado.value} value={estado.value}>
                                        {estado.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Técnico */}
                        <Select 
                            value={filtros.tecnico_id} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, tecnico_id: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Técnico" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todos los técnicos</SelectItem>
                                {tecnicos.map(tecnico => (
                                    <SelectItem key={tecnico.id} value={tecnico.id.toString()}>
                                        {tecnico.nombre} {tecnico.apellido}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Modalidad */}
                        <Select 
                            value={filtros.modalidad} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, modalidad: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Modalidad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todas las modalidades</SelectItem>
                                {modalidades.map(modalidad => (
                                    <SelectItem key={modalidad.value} value={modalidad.value}>
                                        {modalidad.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Tipo */}
                        <Select 
                            value={filtros.tipo_capacitacion} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, tipo_capacitacion: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todos los tipos</SelectItem>
                                {tiposCapacitacion.map(tipo => (
                                    <SelectItem key={tipo.value} value={tipo.value}>
                                        {tipo.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Fecha desde */}
                        <Input
                            type="date"
                            placeholder="Fecha desde"
                            value={filtros.fecha_desde}
                            onChange={(e) => setFiltros(prev => ({ ...prev, fecha_desde: e.target.value }))}
                        />

                        {/* Fecha hasta */}
                        <Input
                            type="date"
                            placeholder="Fecha hasta"
                            value={filtros.fecha_hasta}
                            onChange={(e) => setFiltros(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4">
                        <Button onClick={limpiarFiltros} variant="outline" size="sm">
                            Limpiar Filtros
                        </Button>
                        <span className="text-sm text-gray-500">
                            {Object.values(filtros).filter(Boolean).length} filtros aplicados
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de capacitaciones */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Lista de Capacitaciones</CardTitle>
                </CardHeader>
                <CardContent>
                    {capacitaciones.length > 0 ? (
                        <div className="space-y-4">
                            {capacitaciones.map((capacitacion) => (
                                <div key={capacitacion.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    {getModalidadIcon(capacitacion.modalidad)}
                                                    <span className="font-medium text-sm">
                                                        {capacitacion.cliente_nombre}
                                                    </span>
                                                </div>
                                                
                                                {getEstadoBadge(capacitacion.estado)}
                                                
                                                {capacitacion.tipo_capacitacion && (
                                                    <Badge variant="outline">
                                                        {tiposCapacitacion.find(t => t.value === capacitacion.tipo_capacitacion)?.label || capacitacion.tipo_capacitacion}
                                                    </Badge>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Producto y Contacto</p>
                                                    <p className="font-medium text-sm">{capacitacion.producto_codigo}</p>
                                                    <p className="text-xs text-gray-600">{capacitacion.producto_descripcion}</p>
                                                    {capacitacion.cliente_telefono && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Phone className="h-3 w-3 text-gray-400" />
                                                            <span className="text-xs text-gray-600">{capacitacion.cliente_telefono}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Técnico y Modalidad</p>
                                                    {capacitacion.tecnico_nombre ? (
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-gray-400" />
                                                            <span className="text-sm">{capacitacion.tecnico_nombre}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline">Sin asignar</Badge>
                                                    )}
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        {modalidades.find(m => m.value === capacitacion.modalidad)?.label || capacitacion.modalidad}
                                                    </p>
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Fechas</p>
                                                    <div className="space-y-1">
                                                        {capacitacion.fecha_capacitacion_solicitada && (
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-3 w-3 text-gray-400" />
                                                                <span className="text-xs">
                                                                    Solicitada: {new Date(capacitacion.fecha_capacitacion_solicitada).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {capacitacion.fecha_capacitacion_programada && (
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="h-3 w-3 text-blue-500" />
                                                                <span className="text-xs font-medium">
                                                                    Programada: {new Date(capacitacion.fecha_capacitacion_programada).toLocaleDateString()}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    ({calcularTiempoHasta(capacitacion.fecha_capacitacion_programada)})
                                                                </span>
                                                            </div>
                                                        )}
                                                        {capacitacion.fecha_capacitacion_realizada && (
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                                <span className="text-xs">
                                                                    Realizada: {new Date(capacitacion.fecha_capacitacion_realizada).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Resultados</p>
                                                    {capacitacion.duracion_real_horas && (
                                                        <p className="text-xs text-gray-600">
                                                            Duración: {capacitacion.duracion_real_horas}h
                                                        </p>
                                                    )}
                                                    {capacitacion.calificacion_cliente && (
                                                        <div className="mt-1">
                                                            {getCalificacionStars(capacitacion.calificacion_cliente)}
                                                        </div>
                                                    )}
                                                    {capacitacion.capacitacion_exitosa !== null && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            {capacitacion.capacitacion_exitosa ? (
                                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                            ) : (
                                                                <XCircle className="h-3 w-3 text-red-500" />
                                                            )}
                                                            <span className="text-xs">
                                                                {capacitacion.capacitacion_exitosa ? 'Exitosa' : 'No exitosa'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Observaciones */}
                                            {capacitacion.observaciones_tecnico && (
                                                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <MessageSquare className="h-3 w-3 text-blue-600" />
                                                        <span className="font-medium text-blue-800">Observaciones del técnico:</span>
                                                    </div>
                                                    <p className="text-blue-700">{capacitacion.observaciones_tecnico}</p>
                                                </div>
                                            )}
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem 
                                                    onClick={() => onCapacitacionSelect && onCapacitacionSelect(capacitacion)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Ver Detalles
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuItem>
                                                    <Settings className="h-4 w-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuSeparator />
                                                
                                                {capacitacion.estado === 'PENDIENTE' && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleCambiarEstado(capacitacion.id, 'PROGRAMADA')}
                                                    >
                                                        <Calendar className="h-4 w-4 mr-2" />
                                                        Programar
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                {capacitacion.estado === 'PROGRAMADA' && (
                                                    <>
                                                        <DropdownMenuItem
                                                            onClick={() => handleCambiarEstado(capacitacion.id, 'EN_PROCESO')}
                                                        >
                                                            <PlayCircle className="h-4 w-4 mr-2" />
                                                            Iniciar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleCambiarEstado(capacitacion.id, 'REPROGRAMADA')}
                                                        >
                                                            <CalendarDays className="h-4 w-4 mr-2" />
                                                            Reprogramar
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                
                                                {capacitacion.estado === 'EN_PROCESO' && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleCambiarEstado(capacitacion.id, 'COMPLETADA')}
                                                        className="text-green-600"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Completar
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                <DropdownMenuSeparator />
                                                
                                                <DropdownMenuItem
                                                    onClick={() => handleCambiarEstado(capacitacion.id, 'CANCELADA')}
                                                    className="text-red-600"
                                                >
                                                    <XCircle className="h-4 w-4 mr-2" />
                                                    Cancelar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Phone className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay capacitaciones</h3>
                            <p className="text-gray-600 mb-4">
                                No se encontraron capacitaciones con los filtros aplicados.
                            </p>
                            {onCreateCapacitacion && (
                                <Button onClick={onCreateCapacitacion}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Crear Primera Capacitación
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Paginación */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} capacitaciones
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm"
                            disabled={pagination.page === 1}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                            Anterior
                        </Button>
                        
                        <span className="text-sm px-3 py-1">
                            Página {pagination.page} de {pagination.totalPages}
                        </span>
                        
                        <Button 
                            variant="outline" 
                            size="sm"
                            disabled={pagination.page === pagination.totalPages}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CapacitacionesList;