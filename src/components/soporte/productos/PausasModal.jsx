import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, 
    DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Clock, AlertTriangle, CheckCircle, XCircle, Pause, 
    Play, Calendar, User, MessageSquare, History
} from 'lucide-react';

const PausasModal = ({ 
    isOpen, 
    onClose, 
    producto, 
    onPausaCreada, 
    onProductoReanudado 
}) => {
    const [activeTab, setActiveTab] = useState('pausar');
    const [loading, setLoading] = useState(false);
    const [historialPausas, setHistorialPausas] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);

    // Estados para crear pausa
    const [tipoPausa, setTipoPausa] = useState('');
    const [motivoDetallado, setMotivoDetallado] = useState('');
    const [observacionesReanudacion, setObservacionesReanudacion] = useState('');

    // Tipos de pausas con clasificación automática
    const tiposPausas = {
        justificadas: {
            label: 'Pausas Justificadas',
            color: 'bg-green-50 border-green-200',
            badgeColor: 'bg-green-100 text-green-800',
            opciones: [
                { value: 'FALTA_REPUESTOS', label: 'Falta de Repuestos', descripcion: 'No hay repuestos disponibles para completar la reparación' },
                { value: 'VACACIONES_PERSONAL', label: 'Vacaciones del Personal', descripcion: 'El técnico asignado está de vacaciones' },
                { value: 'AUTORIZACION_CLIENTE', label: 'Esperando Autorización Cliente', descripcion: 'Cliente debe autorizar costo o procedimiento' },
                { value: 'ESPERANDO_PAGO', label: 'Esperando Pago', descripcion: 'Cliente debe realizar pago antes de continuar' },
                { value: 'FALLA_HERRAMIENTAS', label: 'Falla de Herramientas', descripcion: 'Herramientas necesarias están en reparación' },
                { value: 'FALTA_ESPACIO_FISICO', label: 'Falta de Espacio Físico', descripcion: 'No hay espacio disponible para el trabajo' },
                { value: 'CORTES_SERVICIOS', label: 'Cortes de Servicios', descripcion: 'Corte de luz, internet u otros servicios necesarios' },
                { value: 'PRODUCTO_MAL_DIAGNOSTICADO', label: 'Producto Mal Diagnosticado', descripcion: 'Se necesita re-evaluar el diagnóstico inicial' },
                { value: 'CLIENTE_CANCELO', label: 'Cliente Canceló', descripcion: 'Cliente decidió cancelar la reparación' }
            ]
        },
        no_justificadas: {
            label: 'Pausas No Justificadas',
            color: 'bg-red-50 border-red-200',
            badgeColor: 'bg-red-100 text-red-800',
            opciones: [
                { value: 'OCUPADO_CAPACITACIONES', label: 'Ocupado en Capacitaciones', descripcion: 'Técnico ocupado en otras capacitaciones' },
                { value: 'OTROS_PROYECTOS', label: 'Otros Proyectos', descripcion: 'Priorizando otros proyectos internos' },
                { value: 'PRODUCTO_EXTRAVIADO', label: 'Producto Extraviado', descripcion: 'No se encuentra el producto físicamente' },
                { value: 'FALTA_CONOCIMIENTO', label: 'Falta de Conocimiento', descripcion: 'Técnico necesita capacitación adicional' },
                { value: 'CAMBIO_PRIORIDADES', label: 'Cambio de Prioridades', descripcion: 'Se cambiaron las prioridades de trabajo' },
                { value: 'PRODUCTO_DAÑADO_REPARACION', label: 'Producto Dañado en Reparación', descripcion: 'Se dañó durante el proceso de reparación' },
                { value: 'ERROR_DIAGNOSTICO_INICIAL', label: 'Error en Diagnóstico Inicial', descripcion: 'El diagnóstico inicial fue incorrecto' },
                { value: 'OTRO', label: 'Otro Motivo', descripcion: 'Otro motivo no listado anteriormente' }
            ]
        }
    };

    useEffect(() => {
        if (isOpen && producto?.id) {
            fetchHistorialPausas();
            // Determinar tab inicial según estado del producto
            setActiveTab(producto.esta_pausado ? 'reanudar' : 'pausar');
            
            // Limpiar formularios
            setTipoPausa('');
            setMotivoDetallado('');
            setObservacionesReanudacion('');
        }
    }, [isOpen, producto]);

    const fetchHistorialPausas = async () => {
        if (!producto?.id) return;
        
        try {
            setLoadingHistorial(true);
            const response = await fetch(`/api/soporte/productos/${producto.id}/pausas`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching historial');

            const data = await response.json();
            if (data.success) {
                setHistorialPausas(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching historial pausas:', error);
        } finally {
            setLoadingHistorial(false);
        }
    };

    const handlePausarProducto = async () => {
        if (!tipoPausa || !motivoDetallado.trim()) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`/api/soporte/productos/${producto.id}/pausar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tipo_pausa: tipoPausa,
                    motivo: motivoDetallado
                })
            });

            const data = await response.json();

            if (data.success) {
                onPausaCreada && onPausaCreada(data.data);
                onClose();
                
                // Determinar si es justificada para el mensaje
                const esJustificada = tiposPausas.justificadas.opciones.some(
                    op => op.value === tipoPausa
                );
                
                alert(
                    `Producto pausado exitosamente.\n` +
                    `Tipo: ${esJustificada ? 'Justificada' : 'No Justificada'}\n` +
                    `Motivo: ${motivoDetallado}`
                );
            } else {
                alert('Error pausando producto: ' + data.message);
            }
        } catch (error) {
            alert('Error pausando producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReanudarProducto = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/soporte/productos/${producto.id}/reanudar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    observaciones: observacionesReanudacion
                })
            });

            const data = await response.json();

            if (data.success) {
                onProductoReanudado && onProductoReanudado(data.data);
                onClose();
                alert('Producto reanudado exitosamente');
            } else {
                alert('Error reanudando producto: ' + data.message);
            }
        } catch (error) {
            alert('Error reanudando producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getTiempoTranscurrido = (fechaInicio) => {
        const inicio = new Date(fechaInicio);
        const ahora = new Date();
        const diferencia = ahora - inicio;
        
        const horas = Math.floor(diferencia / (1000 * 60 * 60));
        const dias = Math.floor(horas / 24);
        
        if (dias > 0) {
            return `${dias} día${dias > 1 ? 's' : ''} ${horas % 24}h`;
        }
        return `${horas}h`;
    };

    const renderOpcionesPausa = (categoria) => {
        const { opciones, color, badgeColor, label } = tiposPausas[categoria];
        
        return (
            <div className={`p-4 rounded-lg border ${color} space-y-3`}>
                <div className="flex items-center gap-2 mb-3">
                    <Badge className={badgeColor}>
                        {label}
                    </Badge>
                    {categoria === 'justificadas' && 
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    }
                    {categoria === 'no_justificadas' && 
                        <XCircle className="h-4 w-4 text-red-600" />
                    }
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {opciones.map((opcion) => (
                        <label 
                            key={opcion.value}
                            className={`flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                                tipoPausa === opcion.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                            }`}
                        >
                            <input
                                type="radio"
                                name="tipoPausa"
                                value={opcion.value}
                                checked={tipoPausa === opcion.value}
                                onChange={(e) => setTipoPausa(e.target.value)}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-medium text-sm">{opcion.label}</div>
                                <div className="text-xs text-gray-600 mt-1">{opcion.descripcion}</div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    if (!isOpen || !producto) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pause className="h-5 w-5" />
                        Gestión de Pausas - {producto.codigo_producto}
                    </DialogTitle>
                    <DialogDescription>
                        {producto.descripcion_producto}
                        {producto.cliente_nombre && (
                            <span className="block mt-1 text-sm">Cliente: {producto.cliente_nombre}</span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {/* Estado actual del producto */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">Estado:</span>
                        <Badge variant={producto.esta_pausado ? "warning" : "success"}>
                            {producto.esta_pausado ? "Pausado" : "Activo"}
                        </Badge>
                    </div>
                    
                    {producto.esta_pausado && producto.fecha_ultima_pausa && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">
                                Pausado hace: {getTiempoTranscurrido(producto.fecha_ultima_pausa)}
                            </span>
                        </div>
                    )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger 
                            value="pausar" 
                            disabled={producto.esta_pausado}
                            className="flex items-center gap-2"
                        >
                            <Pause className="h-4 w-4" />
                            Pausar
                        </TabsTrigger>
                        <TabsTrigger 
                            value="reanudar" 
                            disabled={!producto.esta_pausado}
                            className="flex items-center gap-2"
                        >
                            <Play className="h-4 w-4" />
                            Reanudar
                        </TabsTrigger>
                        <TabsTrigger value="historial" className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Historial
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab: Pausar */}
                    <TabsContent value="pausar" className="space-y-4">
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                Selecciona el tipo de pausa. Las pausas se clasifican automáticamente como 
                                <strong> justificadas</strong> o <strong> no justificadas</strong> para las métricas de eficiencia.
                            </AlertDescription>
                        </Alert>

                        <div className="space-y-4">
                            <h4 className="font-semibold text-green-700">Pausas Justificadas</h4>
                            {renderOpcionesPausa('justificadas')}

                            <h4 className="font-semibold text-red-700">Pausas No Justificadas</h4>
                            {renderOpcionesPausa('no_justificadas')}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="motivo">Motivo Detallado *</Label>
                            <Textarea
                                id="motivo"
                                placeholder="Describe el motivo específico de la pausa..."
                                value={motivoDetallado}
                                onChange={(e) => setMotivoDetallado(e.target.value)}
                                rows={3}
                                required
                            />
                            <p className="text-xs text-gray-500">
                                Proporciona detalles específicos que ayuden a entender la situación
                            </p>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handlePausarProducto}
                                disabled={loading || !tipoPausa || !motivoDetallado.trim()}
                                className="flex items-center gap-2"
                            >
                                <Pause className="h-4 w-4" />
                                {loading ? 'Pausando...' : 'Pausar Producto'}
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    {/* Tab: Reanudar */}
                    <TabsContent value="reanudar" className="space-y-4">
                        <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                                El producto será reanudado y podrá continuar con el proceso de reparación.
                                El tiempo de pausa será calculado automáticamente para las métricas.
                            </AlertDescription>
                        </Alert>

                        {/* Información de la pausa actual */}
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <h4 className="font-medium text-amber-800 mb-2">Pausa Actual</h4>
                            {producto.pausa_actual && (
                                <div className="space-y-1 text-sm">
                                    <p><strong>Tipo:</strong> {producto.pausa_actual}</p>
                                    <p><strong>Motivo:</strong> {producto.motivo_pausa_actual || 'No especificado'}</p>
                                    {producto.fecha_ultima_pausa && (
                                        <p><strong>Duración:</strong> {getTiempoTranscurrido(producto.fecha_ultima_pausa)}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="observaciones">Observaciones de Reanudación</Label>
                            <Textarea
                                id="observaciones"
                                placeholder="Observaciones sobre la reanudación (opcional)..."
                                value={observacionesReanudacion}
                                onChange={(e) => setObservacionesReanudacion(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleReanudarProducto}
                                disabled={loading}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            >
                                <Play className="h-4 w-4" />
                                {loading ? 'Reanudando...' : 'Reanudar Producto'}
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    {/* Tab: Historial */}
                    <TabsContent value="historial" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold">Historial de Pausas</h4>
                            <Button size="sm" variant="outline" onClick={fetchHistorialPausas}>
                                <History className="h-4 w-4 mr-2" />
                                Actualizar
                            </Button>
                        </div>

                        {loadingHistorial ? (
                            <div className="text-center py-8">
                                <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                                <p className="text-gray-600">Cargando historial...</p>
                            </div>
                        ) : historialPausas.length > 0 ? (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {historialPausas.map((pausa, index) => (
                                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge 
                                                    variant={pausa.es_pausa_justificada ? "success" : "destructive"}
                                                    className="text-xs"
                                                >
                                                    {pausa.es_pausa_justificada ? 'Justificada' : 'No Justificada'}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    {pausa.estado}
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {pausa.duracion_horas && `${Math.round(pausa.duracion_horas)}h`}
                                            </span>
                                        </div>
                                        
                                        <h5 className="font-medium text-sm">{pausa.tipo_pausa}</h5>
                                        <p className="text-xs text-gray-600 mt-1">{pausa.motivo_detallado}</p>
                                        
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            <span>Inicio: {new Date(pausa.fecha_inicio).toLocaleString()}</span>
                                            {pausa.fecha_fin && (
                                                <span>Fin: {new Date(pausa.fecha_fin).toLocaleString()}</span>
                                            )}
                                        </div>

                                        {pausa.observaciones_reanudacion && (
                                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                                                <strong>Observaciones de reanudación:</strong> {pausa.observaciones_reanudacion}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No hay pausas registradas para este producto</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default PausasModal;