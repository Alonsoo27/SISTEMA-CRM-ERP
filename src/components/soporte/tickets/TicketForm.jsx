import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, 
    DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { 
    Plus, Save, X, AlertTriangle, Clock, User, Phone, 
    Calendar, Wrench, Settings, CheckCircle, Search,
    Building, Package, FileText
} from 'lucide-react';

const TicketForm = ({ 
    isOpen, 
    onClose, 
    ticketData = null, 
    ventaData = null, 
    onTicketCreated, 
    onTicketUpdated 
}) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [tecnicos, setTecnicos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [clientes, setClientes] = useState([]);
    
    // Estados del formulario
    const [formData, setFormData] = useState({
        tipo_ticket: '',
        titulo: '',
        descripcion: '',
        prioridad: 'MEDIA',
        estado: 'PENDIENTE',
        
        // Información del cliente
        cliente_nombre: '',
        cliente_telefono: '',
        cliente_email: '',
        
        // Asignación
        tecnico_asignado_id: '',
        
        // Fechas
        fecha_programada: '',
        tiempo_estimado_horas: '',
        
        // Integración con ventas
        venta_id: '',
        
        // Observaciones
        observaciones: ''
    });

    // Configuración de tipos de tickets
    const tiposTicket = [
        { 
            value: 'CAPACITACION', 
            label: 'Capacitación', 
            icon: Phone, 
            color: 'text-purple-600',
            descripcion: 'Capacitación al cliente sobre uso del producto'
        },
        { 
            value: 'REPARACION', 
            label: 'Reparación', 
            icon: Wrench, 
            color: 'text-blue-600',
            descripcion: 'Reparación de producto con falla'
        },
        { 
            value: 'MANTENIMIENTO', 
            label: 'Mantenimiento', 
            icon: Settings, 
            color: 'text-green-600',
            descripcion: 'Mantenimiento preventivo o correctivo'
        }
    ];

    const prioridades = [
        { value: 'BAJA', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
        { value: 'MEDIA', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'ALTA', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
        { value: 'URGENTE', label: 'Urgente', color: 'bg-red-100 text-red-800' }
    ];

    useEffect(() => {
        if (isOpen) {
            // Cargar datos necesarios
            fetchTecnicos();
            fetchProductos();
            
            // Si hay datos de venta, precargar información
            if (ventaData) {
                setFormData(prev => ({
                    ...prev,
                    venta_id: ventaData.id,
                    cliente_nombre: ventaData.cliente_nombre_completo || '',
                    cliente_telefono: ventaData.cliente_telefono || '',
                    cliente_email: ventaData.cliente_email || '',
                    titulo: `${ventaData.codigo_producto || ''} - Cliente: ${ventaData.cliente_nombre_completo || ''}`.trim()
                }));
            }
            
            // Si hay datos de ticket (edición), cargar información
            if (ticketData) {
                setFormData({
                    tipo_ticket: ticketData.tipo_ticket || '',
                    titulo: ticketData.titulo || '',
                    descripcion: ticketData.descripcion || '',
                    prioridad: ticketData.prioridad || 'MEDIA',
                    estado: ticketData.estado || 'PENDIENTE',
                    cliente_nombre: ticketData.cliente_nombre || '',
                    cliente_telefono: ticketData.cliente_telefono || '',
                    cliente_email: ticketData.cliente_email || '',
                    tecnico_asignado_id: ticketData.tecnico_asignado_id || '',
                    fecha_programada: ticketData.fecha_programada || '',
                    tiempo_estimado_horas: ticketData.tiempo_estimado_horas || '',
                    venta_id: ticketData.venta_id || '',
                    observaciones: ticketData.observaciones || ''
                });
            }
            
            // Limpiar errores
            setErrors({});
        }
    }, [isOpen, ventaData, ticketData]);

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

    const fetchProductos = async () => {
        try {
            const response = await fetch('/api/productos?activo=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setProductos(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching productos:', error);
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Validaciones requeridas
        if (!formData.tipo_ticket) {
            newErrors.tipo_ticket = 'Tipo de ticket es requerido';
        }

        if (!formData.titulo?.trim()) {
            newErrors.titulo = 'Título es requerido';
        }

        if (!formData.descripcion?.trim()) {
            newErrors.descripcion = 'Descripción es requerida';
        }

        if (!formData.cliente_nombre?.trim()) {
            newErrors.cliente_nombre = 'Nombre del cliente es requerido';
        }

        // Validaciones específicas por tipo
        if (formData.tipo_ticket === 'CAPACITACION') {
            if (!formData.cliente_telefono?.trim()) {
                newErrors.cliente_telefono = 'Teléfono es requerido para capacitaciones';
            }
        }

        // Validación de fecha programada
        if (formData.fecha_programada) {
            const fechaSeleccionada = new Date(formData.fecha_programada);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            
            if (fechaSeleccionada < hoy) {
                newErrors.fecha_programada = 'La fecha no puede ser anterior a hoy';
            }
        }

        // Validación de tiempo estimado
        if (formData.tiempo_estimado_horas && 
            (isNaN(formData.tiempo_estimado_horas) || formData.tiempo_estimado_horas <= 0)) {
            newErrors.tiempo_estimado_horas = 'Tiempo estimado debe ser un número positivo';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        try {
            setLoading(true);

            const url = ticketData 
                ? `/api/soporte/tickets/${ticketData.id}`
                : ventaData 
                    ? '/api/soporte/tickets/desde-venta'
                    : '/api/soporte/tickets';

            const method = ticketData ? 'PUT' : 'POST';

            const body = {
                ...formData,
                tiempo_estimado_horas: formData.tiempo_estimado_horas ? parseInt(formData.tiempo_estimado_horas) : null,
                ...(ventaData && {
                    venta_id: ventaData.id,
                    datos_adicionales: {
                        codigo_producto: ventaData.codigo_producto,
                        descripcion_producto: ventaData.descripcion_producto
                    }
                })
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success) {
                if (ticketData && onTicketUpdated) {
                    onTicketUpdated(data.data);
                } else if (onTicketCreated) {
                    onTicketCreated(data.data);
                }
                
                handleClose();
                
                alert(ticketData 
                    ? 'Ticket actualizado exitosamente' 
                    : 'Ticket creado exitosamente'
                );
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error procesando ticket: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Limpiar formulario
        setFormData({
            tipo_ticket: '',
            titulo: '',
            descripcion: '',
            prioridad: 'MEDIA',
            estado: 'PENDIENTE',
            cliente_nombre: '',
            cliente_telefono: '',
            cliente_email: '',
            tecnico_asignado_id: '',
            fecha_programada: '',
            tiempo_estimado_horas: '',
            venta_id: '',
            observaciones: ''
        });
        setErrors({});
        onClose();
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Limpiar error del campo cuando el usuario empiece a escribir
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: undefined
            }));
        }
    };

    const getTipoTicketInfo = (tipo) => {
        return tiposTicket.find(t => t.value === tipo);
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {ticketData ? (
                            <>
                                <FileText className="h-5 w-5" />
                                Editar Ticket: {ticketData.codigo}
                            </>
                        ) : (
                            <>
                                <Plus className="h-5 w-5" />
                                {ventaData ? 'Crear Ticket desde Venta' : 'Nuevo Ticket de Soporte'}
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {ventaData && (
                            <div className="flex items-center gap-2 mt-2">
                                <Building className="h-4 w-4" />
                                <span>Venta: {ventaData.codigo || 'N/A'}</span>
                                <span className="text-gray-400">•</span>
                                <span>Cliente: {ventaData.cliente_nombre_completo}</span>
                            </div>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Información básica del ticket */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Información Básica</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Tipo de ticket */}
                            <div className="space-y-2">
                                <Label htmlFor="tipo_ticket">Tipo de Ticket *</Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {tiposTicket.map((tipo) => {
                                        const Icon = tipo.icon;
                                        return (
                                            <label
                                                key={tipo.value}
                                                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                                                    formData.tipo_ticket === tipo.value 
                                                        ? 'border-blue-500 bg-blue-50' 
                                                        : 'border-gray-200'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="tipo_ticket"
                                                    value={tipo.value}
                                                    checked={formData.tipo_ticket === tipo.value}
                                                    onChange={(e) => handleInputChange('tipo_ticket', e.target.value)}
                                                />
                                                <Icon className={`h-5 w-5 ${tipo.color}`} />
                                                <div>
                                                    <div className="font-medium">{tipo.label}</div>
                                                    <div className="text-xs text-gray-600">{tipo.descripcion}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                                {errors.tipo_ticket && (
                                    <p className="text-sm text-red-600">{errors.tipo_ticket}</p>
                                )}
                            </div>

                            {/* Título */}
                            <div className="space-y-2">
                                <Label htmlFor="titulo">Título *</Label>
                                <Input
                                    id="titulo"
                                    value={formData.titulo}
                                    onChange={(e) => handleInputChange('titulo', e.target.value)}
                                    placeholder="Resumen breve del ticket"
                                    className={errors.titulo ? 'border-red-500' : ''}
                                />
                                {errors.titulo && (
                                    <p className="text-sm text-red-600">{errors.titulo}</p>
                                )}
                            </div>

                            {/* Descripción */}
                            <div className="space-y-2">
                                <Label htmlFor="descripcion">Descripción *</Label>
                                <Textarea
                                    id="descripcion"
                                    value={formData.descripcion}
                                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                                    placeholder="Describe detalladamente el problema o solicitud..."
                                    rows={4}
                                    className={errors.descripcion ? 'border-red-500' : ''}
                                />
                                {errors.descripcion && (
                                    <p className="text-sm text-red-600">{errors.descripcion}</p>
                                )}
                            </div>

                            {/* Prioridad */}
                            <div className="space-y-2">
                                <Label htmlFor="prioridad">Prioridad</Label>
                                <Select 
                                    value={formData.prioridad} 
                                    onValueChange={(value) => handleInputChange('prioridad', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar prioridad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {prioridades.map(prioridad => (
                                            <SelectItem key={prioridad.value} value={prioridad.value}>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={prioridad.color}>
                                                        {prioridad.label}
                                                    </Badge>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información del cliente */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Información del Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Nombre del cliente */}
                                <div className="space-y-2">
                                    <Label htmlFor="cliente_nombre">Nombre del Cliente *</Label>
                                    <Input
                                        id="cliente_nombre"
                                        value={formData.cliente_nombre}
                                        onChange={(e) => handleInputChange('cliente_nombre', e.target.value)}
                                        placeholder="Nombre completo del cliente"
                                        className={errors.cliente_nombre ? 'border-red-500' : ''}
                                    />
                                    {errors.cliente_nombre && (
                                        <p className="text-sm text-red-600">{errors.cliente_nombre}</p>
                                    )}
                                </div>

                                {/* Teléfono */}
                                <div className="space-y-2">
                                    <Label htmlFor="cliente_telefono">
                                        Teléfono {formData.tipo_ticket === 'CAPACITACION' && '*'}
                                    </Label>
                                    <Input
                                        id="cliente_telefono"
                                        value={formData.cliente_telefono}
                                        onChange={(e) => handleInputChange('cliente_telefono', e.target.value)}
                                        placeholder="Número de teléfono"
                                        className={errors.cliente_telefono ? 'border-red-500' : ''}
                                    />
                                    {errors.cliente_telefono && (
                                        <p className="text-sm text-red-600">{errors.cliente_telefono}</p>
                                    )}
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="cliente_email">Email (opcional)</Label>
                                <Input
                                    id="cliente_email"
                                    type="email"
                                    value={formData.cliente_email}
                                    onChange={(e) => handleInputChange('cliente_email', e.target.value)}
                                    placeholder="Correo electrónico del cliente"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Asignación y programación */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Asignación y Programación</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Técnico asignado */}
                                <div className="space-y-2">
                                    <Label htmlFor="tecnico_asignado_id">Técnico Asignado</Label>
                                    <Select 
                                        value={formData.tecnico_asignado_id} 
                                        onValueChange={(value) => handleInputChange('tecnico_asignado_id', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar técnico" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">Sin asignar</SelectItem>
                                            {tecnicos.map(tecnico => (
                                                <SelectItem key={tecnico.id} value={tecnico.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        {tecnico.nombre} {tecnico.apellido}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Fecha programada */}
                                <div className="space-y-2">
                                    <Label htmlFor="fecha_programada">Fecha Programada</Label>
                                    <Input
                                        id="fecha_programada"
                                        type="date"
                                        value={formData.fecha_programada}
                                        onChange={(e) => handleInputChange('fecha_programada', e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className={errors.fecha_programada ? 'border-red-500' : ''}
                                    />
                                    {errors.fecha_programada && (
                                        <p className="text-sm text-red-600">{errors.fecha_programada}</p>
                                    )}
                                </div>
                            </div>

                            {/* Tiempo estimado */}
                            <div className="space-y-2">
                                <Label htmlFor="tiempo_estimado_horas">Tiempo Estimado (horas)</Label>
                                <Input
                                    id="tiempo_estimado_horas"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={formData.tiempo_estimado_horas}
                                    onChange={(e) => handleInputChange('tiempo_estimado_horas', e.target.value)}
                                    placeholder="Ej: 2"
                                    className={errors.tiempo_estimado_horas ? 'border-red-500' : ''}
                                />
                                {errors.tiempo_estimado_horas && (
                                    <p className="text-sm text-red-600">{errors.tiempo_estimado_horas}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Observaciones adicionales */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Observaciones Adicionales</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="observaciones">Observaciones</Label>
                                <Textarea
                                    id="observaciones"
                                    value={formData.observaciones}
                                    onChange={(e) => handleInputChange('observaciones', e.target.value)}
                                    placeholder="Observaciones adicionales, notas internas, etc..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información de contexto si viene de venta */}
                    {ventaData && (
                        <Alert>
                            <Package className="h-4 w-4" />
                            <AlertDescription>
                                <div className="space-y-1">
                                    <p><strong>Producto:</strong> {ventaData.codigo_producto} - {ventaData.descripcion_producto}</p>
                                    <p><strong>Venta:</strong> {ventaData.codigo}</p>
                                    <p><strong>Fecha de entrega:</strong> {ventaData.fecha_entrega ? new Date(ventaData.fecha_entrega).toLocaleDateString() : 'No especificada'}</p>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} onClick={handleSubmit}>
                            <Save className="h-4 w-4 mr-2" />
                            {loading 
                                ? 'Guardando...' 
                                : ticketData 
                                    ? 'Actualizar Ticket' 
                                    : 'Crear Ticket'
                            }
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default TicketForm;