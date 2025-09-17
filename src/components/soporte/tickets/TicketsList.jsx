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
    Clock, MoreVertical, Eye, Edit, UserPlus, AlertTriangle, 
    RefreshCw, Search, Filter, Plus, Calendar, User, 
    Phone, Wrench, Settings, CheckCircle, XCircle
} from 'lucide-react';

const TicketsList = ({ onTicketSelect, onCreateTicket }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtros, setFiltros] = useState({
        estado: '',
        tipo_ticket: '',
        prioridad: '',
        tecnico_id: '',
        asesor_id: '',
        busqueda: '',
        fecha_desde: '',
        fecha_hasta: ''
    });
    const [tecnicos, setTecnicos] = useState([]);
    const [asesores, setAsesores] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    // Configuración de estados, tipos y prioridades
    const estados = [
        { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-gray-100 text-gray-800' },
        { value: 'ASIGNADO', label: 'Asignado', color: 'bg-blue-100 text-blue-800' },
        { value: 'EN_PROCESO', label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'COMPLETADO', label: 'Completado', color: 'bg-green-100 text-green-800' },
        { value: 'CANCELADO', label: 'Cancelado', color: 'bg-red-100 text-red-800' }
    ];

    const tiposTicket = [
        { value: 'CAPACITACION', label: 'Capacitación', icon: Phone, color: 'text-purple-600' },
        { value: 'REPARACION', label: 'Reparación', icon: Wrench, color: 'text-blue-600' },
        { value: 'MANTENIMIENTO', label: 'Mantenimiento', icon: Settings, color: 'text-green-600' }
    ];

    const prioridades = [
        { value: 'BAJA', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
        { value: 'MEDIA', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'ALTA', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
        { value: 'URGENTE', label: 'Urgente', color: 'bg-red-100 text-red-800' }
    ];

    useEffect(() => {
        fetchTickets();
        fetchUsuarios();
    }, [filtros, pagination.page]);

    const fetchTickets = async () => {
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

            const response = await fetch(`/api/soporte/tickets?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching tickets');

            const data = await response.json();
            
            if (data.success) {
                setTickets(data.data.tickets || []);
                setPagination(prev => ({
                    ...prev,
                    total: data.data.total || 0,
                    totalPages: Math.ceil((data.data.total || 0) / pagination.limit)
                }));
            } else {
                throw new Error(data.message || 'Error obteniendo tickets');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsuarios = async () => {
        try {
            // Obtener técnicos
            const tecnicosResponse = await fetch('/api/usuarios?rol=tecnico', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            // Obtener asesores
            const asesoresResponse = await fetch('/api/usuarios?rol=asesor', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (tecnicosResponse.ok) {
                const tecnicosData = await tecnicosResponse.json();
                setTecnicos(tecnicosData.data || []);
            }

            if (asesoresResponse.ok) {
                const asesoresData = await asesoresResponse.json();
                setAsesores(asesoresData.data || []);
            }
        } catch (error) {
            console.error('Error fetching usuarios:', error);
        }
    };

    const handleAsignarTecnico = async (ticketId, tecnicoId) => {
        try {
            const response = await fetch(`/api/soporte/tickets/${ticketId}/asignar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tecnico_id: tecnicoId,
                    observaciones: 'Asignado desde lista de tickets'
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchTickets(); // Refresh
                alert('Técnico asignado exitosamente');
            } else {
                alert('Error asignando técnico: ' + data.message);
            }
        } catch (error) {
            alert('Error asignando técnico: ' + error.message);
        }
    };

    const handleCambiarEstado = async (ticketId, nuevoEstado) => {
        try {
            const response = await fetch(`/api/soporte/tickets/${ticketId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    estado: nuevoEstado,
                    ...(nuevoEstado === 'EN_PROCESO' && { fecha_inicio_atencion: new Date().toISOString() }),
                    ...(nuevoEstado === 'COMPLETADO' && { fecha_finalizacion: new Date().toISOString() })
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchTickets(); // Refresh
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
            tipo_ticket: '',
            prioridad: '',
            tecnico_id: '',
            asesor_id: '',
            busqueda: '',
            fecha_desde: '',
            fecha_hasta: ''
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const getEstadoBadge = (estado) => {
        const estadoConfig = estados.find(e => e.value === estado);
        return (
            <Badge className={estadoConfig?.color}>
                {estadoConfig?.label || estado}
            </Badge>
        );
    };

    const getPrioridadBadge = (prioridad) => {
        const prioridadConfig = prioridades.find(p => p.value === prioridad);
        return (
            <Badge className={prioridadConfig?.color}>
                {prioridadConfig?.label || prioridad}
            </Badge>
        );
    };

    const getTipoIcon = (tipo) => {
        const tipoConfig = tiposTicket.find(t => t.value === tipo);
        if (!tipoConfig) return <Wrench className="h-4 w-4" />;
        
        const Icon = tipoConfig.icon;
        return <Icon className={`h-4 w-4 ${tipoConfig.color}`} />;
    };

    const calcularTiempoTranscurrido = (fechaCreacion) => {
        const ahora = new Date();
        const creacion = new Date(fechaCreacion);
        const diferencia = ahora - creacion;
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (dias > 0) return `${dias}d ${horas}h`;
        return `${horas}h`;
    };

    if (loading && tickets.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-gray-600">Cargando tickets...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert className="m-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error cargando tickets: {error}
                    <Button onClick={fetchTickets} className="ml-4" size="sm">
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
                    <h2 className="text-2xl font-bold text-gray-900">Tickets de Soporte</h2>
                    <p className="text-gray-600 mt-1">
                        {pagination.total} tickets encontrados
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button onClick={fetchTickets} size="sm" variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                    {onCreateTicket && (
                        <Button onClick={onCreateTicket} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Ticket
                        </Button>
                    )}
                </div>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filtros</CardTitle>
                    <CardDescription>
                        Filtra los tickets por diferentes criterios
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Búsqueda */}
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Buscar tickets..."
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

                        {/* Tipo */}
                        <Select 
                            value={filtros.tipo_ticket} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, tipo_ticket: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todos los tipos</SelectItem>
                                {tiposTicket.map(tipo => (
                                    <SelectItem key={tipo.value} value={tipo.value}>
                                        {tipo.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Prioridad */}
                        <Select 
                            value={filtros.prioridad} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, prioridad: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Prioridad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todas las prioridades</SelectItem>
                                {prioridades.map(prioridad => (
                                    <SelectItem key={prioridad.value} value={prioridad.value}>
                                        {prioridad.label}
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

                        {/* Asesor */}
                        <Select 
                            value={filtros.asesor_id} 
                            onValueChange={(value) => setFiltros(prev => ({ ...prev, asesor_id: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Asesor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todos los asesores</SelectItem>
                                {asesores.map(asesor => (
                                    <SelectItem key={asesor.id} value={asesor.id.toString()}>
                                        {asesor.nombre} {asesor.apellido}
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

            {/* Lista de tickets */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Lista de Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                    {tickets.length > 0 ? (
                        <div className="space-y-3">
                            {tickets.map((ticket) => (
                                <div key={ticket.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="flex items-center gap-2">
                                                    {getTipoIcon(ticket.tipo_ticket)}
                                                    <span className="font-medium text-sm">
                                                        {ticket.codigo}
                                                    </span>
                                                </div>
                                                
                                                {getEstadoBadge(ticket.estado)}
                                                {getPrioridadBadge(ticket.prioridad)}
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Cliente y Descripción</p>
                                                    <p className="font-medium text-sm">{ticket.cliente_nombre || 'Sin cliente'}</p>
                                                    <p className="text-xs text-gray-600 line-clamp-2">{ticket.titulo}</p>
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Técnico Asignado</p>
                                                    {ticket.tecnico_nombre ? (
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-gray-400" />
                                                            <span className="text-sm">{ticket.tecnico_nombre}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline">Sin asignar</Badge>
                                                    )}
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Tiempo</p>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-3 w-3 text-gray-400" />
                                                            <span className="text-xs">
                                                                {new Date(ticket.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-3 w-3 text-gray-400" />
                                                            <span className="text-xs">
                                                                {calcularTiempoTranscurrido(ticket.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem 
                                                    onClick={() => onTicketSelect && onTicketSelect(ticket)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Ver Detalles
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuSeparator />
                                                
                                                {ticket.estado === 'PENDIENTE' && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleCambiarEstado(ticket.id, 'EN_PROCESO')}
                                                    >
                                                        <Play className="h-4 w-4 mr-2" />
                                                        Iniciar Atención
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                {ticket.estado === 'EN_PROCESO' && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleCambiarEstado(ticket.id, 'COMPLETADO')}
                                                        className="text-green-600"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Completar
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                {!ticket.tecnico_asignado_id && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem>
                                                            <UserPlus className="h-4 w-4 mr-2" />
                                                            Asignar Técnico
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                
                                                <DropdownMenuSeparator />
                                                
                                                <DropdownMenuItem
                                                    onClick={() => handleCambiarEstado(ticket.id, 'CANCELADO')}
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
                    ) : (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tickets</h3>
                            <p className="text-gray-600 mb-4">
                                No se encontraron tickets con los filtros aplicados.
                            </p>
                            {onCreateTicket && (
                                <Button onClick={onCreateTicket}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Crear Primer Ticket
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
                        Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} tickets
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

export default TicketsList;