import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    AlertTriangle, Clock, Pause, User, Calendar, 
    RefreshCw, Filter, Eye, Play, CheckCircle,
    XCircle, Bell, BellOff, Zap, Target
} from 'lucide-react';

const AlertasList = ({ 
    mostrarSoloNoLeidas = false, 
    limite = 10, 
    onAlertaClick = null,
    autoRefresh = false 
}) => {
    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtros, setFiltros] = useState({
        tipo: '',
        prioridad: '',
        solo_no_leidas: mostrarSoloNoLeidas
    });
    const [alertasLeidas, setAlertasLeidas] = useState(new Set());

    // Configuración de tipos de alertas
    const tiposAlertas = {
        PAUSA_LARGA: {
            label: 'Pausa Prolongada',
            icon: Pause,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50 border-amber-200',
            descripcion: 'Producto pausado por más tiempo del recomendado'
        },
        SLA_VENCIDO: {
            label: 'SLA Vencido',
            icon: Clock,
            color: 'text-red-600',
            bgColor: 'bg-red-50 border-red-200',
            descripcion: 'Ticket que superó el tiempo de respuesta establecido'
        },
        TICKET_SIN_ASIGNAR: {
            label: 'Sin Asignar',
            icon: User,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 border-blue-200',
            descripcion: 'Ticket que no tiene técnico asignado'
        },
        CAPACITACION_VENCIDA: {
            label: 'Capacitación Vencida',
            icon: Calendar,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50 border-purple-200',
            descripcion: 'Capacitación programada que no se realizó en la fecha'
        },
        PRODUCTO_EXTRAVIADO: {
            label: 'Producto Extraviado',
            icon: Target,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50 border-orange-200',
            descripcion: 'Producto que no se encuentra físicamente'
        }
    };

    const prioridades = [
        { value: 'BAJA', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
        { value: 'MEDIA', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'ALTA', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
        { value: 'URGENTE', label: 'Urgente', color: 'bg-red-100 text-red-800' }
    ];

    useEffect(() => {
        fetchAlertas();
        
        if (autoRefresh) {
            const interval = setInterval(fetchAlertas, 30000); // Cada 30 segundos
            return () => clearInterval(interval);
        }
    }, [filtros, autoRefresh]);

    const fetchAlertas = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            
            // Agregar filtros
            Object.entries(filtros).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });
            
            if (limite) queryParams.append('limite', limite);

            const response = await fetch(`/api/soporte/alertas?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching alertas');

            const data = await response.json();
            
            if (data.success) {
                setAlertas(data.data || []);
            } else {
                throw new Error(data.message || 'Error obteniendo alertas');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const marcarComoLeida = (alertaId) => {
        setAlertasLeidas(prev => new Set(prev).add(alertaId));
    };

    const handleAlertaClick = (alerta) => {
        marcarComoLeida(alerta.id);
        if (onAlertaClick) {
            onAlertaClick(alerta);
        }
    };

    const handleAccionDirecta = async (alerta, accion) => {
        try {
            let endpoint = '';
            let body = {};
            
            switch (accion) {
                case 'reanudar':
                    endpoint = `/api/soporte/productos/${alerta.referencia_id}/reanudar`;
                    body = { observaciones: 'Reanudado desde alertas' };
                    break;
                    
                case 'asignar_tecnico':
                    const tecnicoId = prompt('ID del técnico a asignar:');
                    if (!tecnicoId) return;
                    endpoint = `/api/soporte/tickets/${alerta.referencia_id}/asignar`;
                    body = { tecnico_id: tecnicoId };
                    break;
                    
                case 'completar_ticket':
                    endpoint = `/api/soporte/tickets/${alerta.referencia_id}`;
                    body = { estado: 'COMPLETADO' };
                    break;
                    
                default:
                    return;
            }

            const response = await fetch(endpoint, {
                method: accion === 'asignar_tecnico' ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success) {
                fetchAlertas(); // Refresh alertas
                alert('Acción ejecutada exitosamente');
            } else {
                alert('Error ejecutando acción: ' + data.message);
            }
        } catch (error) {
            alert('Error ejecutando acción: ' + error.message);
        }
    };

    const calcularTiempoTranscurrido = (fechaInicio) => {
        const inicio = new Date(fechaInicio);
        const ahora = new Date();
        const diferencia = ahora - inicio;
        
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (dias > 0) return `${dias}d ${horas}h`;
        return `${horas}h`;
    };

    const getPrioridadAlerta = (tipoAlerta, horasTranscurridas) => {
        // Determinar prioridad automáticamente según tipo y tiempo
        switch (tipoAlerta) {
            case 'PAUSA_LARGA':
                if (horasTranscurridas >= 240) return 'URGENTE'; // 10 días
                if (horasTranscurridas >= 168) return 'ALTA';    // 7 días
                if (horasTranscurridas >= 72) return 'MEDIA';    // 3 días
                return 'BAJA';
                
            case 'SLA_VENCIDO':
                if (horasTranscurridas >= 72) return 'URGENTE';  // 3 días vencido
                if (horasTranscurridas >= 24) return 'ALTA';     // 1 día vencido
                return 'MEDIA';
                
            case 'TICKET_SIN_ASIGNAR':
                if (horasTranscurridas >= 48) return 'ALTA';     // 2 días sin asignar
                if (horasTranscurridas >= 24) return 'MEDIA';    // 1 día sin asignar
                return 'BAJA';
                
            case 'CAPACITACION_VENCIDA':
                if (horasTranscurridas >= 168) return 'ALTA';    // 1 semana vencida
                return 'MEDIA';
                
            default:
                return 'BAJA';
        }
    };

    const renderAlerta = (alerta) => {
        const tipoConfig = tiposAlertas[alerta.tipo_alerta] || tiposAlertas.PAUSA_LARGA;
        const Icon = tipoConfig.icon;
        const horasTranscurridas = alerta.horas_transcurridas || 0;
        const prioridad = getPrioridadAlerta(alerta.tipo_alerta, horasTranscurridas);
        const prioridadConfig = prioridades.find(p => p.value === prioridad);
        const esLeida = alertasLeidas.has(alerta.id);

        return (
            <div 
                key={alerta.id}
                className={`p-4 border rounded-lg transition-all duration-200 cursor-pointer hover:shadow-sm ${
                    tipoConfig.bgColor
                } ${esLeida ? 'opacity-75' : ''}`}
                onClick={() => handleAlertaClick(alerta)}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0">
                            <Icon className={`h-5 w-5 ${tipoConfig.color}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium text-sm">
                                    {tipoConfig.label}
                                </h4>
                                <Badge className={prioridadConfig?.color}>
                                    {prioridadConfig?.label}
                                </Badge>
                                {!esLeida && (
                                    <Badge variant="destructive" className="text-xs">
                                        Nueva
                                    </Badge>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {alerta.codigo_interno || alerta.titulo}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        {alerta.descripcion_producto || alerta.motivo_detallado}
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                                    {alerta.tipo_pausa && (
                                        <div>
                                            <strong>Tipo pausa:</strong> {alerta.tipo_pausa.replace(/_/g, ' ')}
                                        </div>
                                    )}
                                    
                                    {alerta.tecnico_responsable && (
                                        <div>
                                            <strong>Técnico:</strong> {alerta.tecnico_responsable}
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <strong>Tiempo:</strong> {calcularTiempoTranscurrido(alerta.fecha_inicio)}
                                    </div>
                                    
                                    {alerta.limite_horas && (
                                        <div>
                                            <strong>Límite:</strong> {alerta.limite_horas}h
                                        </div>
                                    )}
                                </div>
                                
                                {alerta.observaciones && (
                                    <div className="p-2 bg-white bg-opacity-50 rounded text-xs">
                                        <strong>Observaciones:</strong> {alerta.observaciones}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                        {/* Acciones rápidas según tipo de alerta */}
                        {alerta.tipo_alerta === 'PAUSA_LARGA' && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAccionDirecta(alerta, 'reanudar');
                                }}
                                className="text-xs"
                            >
                                <Play className="h-3 w-3 mr-1" />
                                Reanudar
                            </Button>
                        )}
                        
                        {alerta.tipo_alerta === 'TICKET_SIN_ASIGNAR' && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAccionDirecta(alerta, 'asignar_tecnico');
                                }}
                                className="text-xs"
                            >
                                <User className="h-3 w-3 mr-1" />
                                Asignar
                            </Button>
                        )}
                        
                        {alerta.tipo_alerta === 'SLA_VENCIDO' && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAccionDirecta(alerta, 'completar_ticket');
                                }}
                                className="text-xs"
                            >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Completar
                            </Button>
                        )}
                        
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAlertaClick(alerta);
                            }}
                            className="text-xs"
                        >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading && alertas.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-32">
                <div className="text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-sm text-gray-600">Cargando alertas...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error cargando alertas: {error}
                    <Button onClick={fetchAlertas} className="ml-4" size="sm">
                        Reintentar
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    const alertasNoLeidas = alertas.filter(alerta => !alertasLeidas.has(alerta.id));
    const alertasMostrar = filtros.solo_no_leidas ? alertasNoLeidas : alertas;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">Alertas</h3>
                    {alertasNoLeidas.length > 0 && (
                        <Badge variant="destructive">
                            {alertasNoLeidas.length} nuevas
                        </Badge>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    <Button onClick={fetchAlertas} size="sm" variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
                <Select 
                    value={filtros.tipo} 
                    onValueChange={(value) => setFiltros(prev => ({ ...prev, tipo: value }))}
                >
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Tipo de alerta" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Todos los tipos</SelectItem>
                        {Object.entries(tiposAlertas).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                                {config.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select 
                    value={filtros.prioridad} 
                    onValueChange={(value) => setFiltros(prev => ({ ...prev, prioridad: value }))}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Todas</SelectItem>
                        {prioridades.map(prioridad => (
                            <SelectItem key={prioridad.value} value={prioridad.value}>
                                {prioridad.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant={filtros.solo_no_leidas ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFiltros(prev => ({ ...prev, solo_no_leidas: !prev.solo_no_leidas }))}
                >
                    {filtros.solo_no_leidas ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
                    Solo No Leídas
                </Button>
            </div>

            {/* Lista de alertas */}
            <div className="space-y-3">
                {alertasMostrar.length > 0 ? (
                    alertasMostrar.map(alerta => renderAlerta(alerta))
                ) : (
                    <div className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <h3 className="text-lg font-medium text-gray-900">
                                {filtros.solo_no_leidas ? 'No hay alertas nuevas' : 'No hay alertas'}
                            </h3>
                            <p className="text-gray-600">
                                {filtros.solo_no_leidas 
                                    ? 'Todas las alertas han sido revisadas'
                                    : 'No se encontraron alertas con los filtros aplicados'
                                }
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Resumen */}
            {alertas.length > 0 && (
                <div className="text-center text-sm text-gray-500 border-t pt-4">
                    Mostrando {alertasMostrar.length} de {alertas.length} alertas
                    {alertasNoLeidas.length > 0 && (
                        <span className="ml-2">• {alertasNoLeidas.length} sin leer</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default AlertasList;