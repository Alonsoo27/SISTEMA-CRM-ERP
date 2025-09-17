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
    Calendar, Phone, MapPin, User, Clock, Save, X, Plus,
    AlertTriangle, CheckCircle, Settings, Package, Building
} from 'lucide-react';

const CapacitacionForm = ({ 
    isOpen, 
    onClose, 
    capacitacionData = null, 
    ticketData = null,
    onCapacitacionCreated, 
    onCapacitacionUpdated 
}) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [tecnicos, setTecnicos] = useState([]);
    const [productos, setProductos] = useState([]);
    
    // Estados del formulario
    const [formData, setFormData] = useState({
        // Referencias
        venta_id: '',
        ticket_id: '',
        producto_id: '',
        tecnico_asignado_id: '',
        
        // Información del cliente
        cliente_nombre: '',
        cliente_telefono: '',
        cliente_email: '',
        direccion_capacitacion: '',
        
        // Información del producto
        producto_codigo: '',
        producto_descripcion: '',
        numero_serie: '',
        
        // Fechas
        fecha_capacitacion_solicitada: '',
        fecha_capacitacion_programada: '',
        
        // Configuración
        tipo_capacitacion: 'USO_BASICO',
        modalidad: 'PRESENCIAL',
        duracion_estimada_horas: '2',
        
        // Observaciones
        observaciones: ''
    });

    // Configuración de tipos y modalidades
    const tiposCapacitacion = [
        { 
            value: 'INSTALACION', 
            label: 'Instalación', 
            descripcion: 'Instalación inicial y configuración básica',
            duracion_sugerida: 3
        },
        { 
            value: 'USO_BASICO', 
            label: 'Uso Básico', 
            descripcion: 'Capacitación en funciones básicas del producto',
            duracion_sugerida: 2
        },
        { 
            value: 'MANTENIMIENTO', 
            label: 'Mantenimiento', 
            descripcion: 'Cuidado y mantenimiento preventivo',
            duracion_sugerida: 1.5
        },
        { 
            value: 'AVANZADA', 
            label: 'Avanzada', 
            descripcion: 'Funciones avanzadas y personalización',
            duracion_sugerida: 4
        },
        { 
            value: 'TROUBLESHOOTING', 
            label: 'Resolución de Problemas', 
            descripcion: 'Solución de problemas comunes',
            duracion_sugerida: 2.5
        }
    ];

    const modalidades = [
        { 
            value: 'PRESENCIAL', 
            label: 'Presencial', 
            icon: MapPin, 
            color: 'text-blue-600',
            descripcion: 'Capacitación en las instalaciones del cliente'
        },
        { 
            value: 'VIRTUAL', 
            label: 'Virtual', 
            icon: Phone, 
            color: 'text-green-600',
            descripcion: 'Capacitación por videollamada'
        },
        { 
            value: 'TELEFONICA', 
            label: 'Telefónica', 
            icon: Phone, 
            color: 'text-purple-600',
            descripcion: 'Capacitación por llamada telefónica'
        }
    ];

    useEffect(() => {
        if (isOpen) {
            fetchTecnicos();
            fetchProductos();
            
            // Si hay datos de ticket, precargar información
            if (ticketData) {
                setFormData(prev => ({
                    ...prev,
                    ticket_id: ticketData.id,
                    venta_id: ticketData.venta_id || '',
                    cliente_nombre: ticketData.cliente_nombre || '',
                    cliente_telefono: ticketData.cliente_telefono || '',
                    cliente_email: ticketData.cliente_email || '',
                    tecnico_asignado_id: ticketData.tecnico_asignado_id || '',
                    fecha_capacitacion_solicitada: ticketData.fecha_programada || '',
                    tipo_capacitacion: 'USO_BASICO' // Default para tickets
                }));
            }
            
            // Si hay datos de capacitación (edición), cargar información
            if (capacitacionData) {
                setFormData({
                    venta_id: capacitacionData.venta_id || '',
                    ticket_id: capacitacionData.ticket_id || '',
                    producto_id: capacitacionData.producto_id || '',
                    tecnico_asignado_id: capacitacionData.tecnico_asignado_id || '',
                    cliente_nombre: capacitacionData.cliente_nombre || '',
                    cliente_telefono: capacitacionData.cliente_telefono || '',
                    cliente_email: capacitacionData.cliente_email || '',
                    direccion_capacitacion: capacitacionData.direccion_capacitacion || '',
                    producto_codigo: capacitacionData.producto_codigo || '',
                    producto_descripcion: capacitacionData.producto_descripcion || '',
                    numero_serie: capacitacionData.numero_serie || '',
                    fecha_capacitacion_solicitada: capacitacionData.fecha_capacitacion_solicitada || '',
                    fecha_capacitacion_programada: capacitacionData.fecha_capacitacion_programada || '',
                    tipo_capacitacion: capacitacionData.tipo_capacitacion || 'USO_BASICO',
                    modalidad: capacitacionData.modalidad || 'PRESENCIAL',
                    duracion_estimada_horas: capacitacionData.duracion_estimada_horas || '2',
                    observaciones: capacitacionData.observaciones || ''
                });
            }
            
            // Limpiar errores
            setErrors({});
        }
    }, [isOpen, ticketData, capacitacionData]);

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
        if (!formData.cliente_nombre?.trim()) {
            newErrors.cliente_nombre = 'Nombre del cliente es requerido';
        }

        if (!formData.cliente_telefono?.trim()) {
            newErrors.cliente_telefono = 'Teléfono del cliente es requerido';
        }

        if (!formData.producto_codigo?.trim()) {
            newErrors.producto_codigo = 'Código del producto es requerido';
        }

        if (!formData.fecha_capacitacion_solicitada) {
            newErrors.fecha_capacitacion_solicitada = 'Fecha solicitada es requerida';
        }

        if (!formData.tipo_capacitacion) {
            newErrors.tipo_capacitacion = 'Tipo de capacitación es requerido';
        }

        if (!formData.modalidad) {
            newErrors.modalidad = 'Modalidad es requerida';
        }

        // Validaciones específicas por modalidad
        if (formData.modalidad === 'PRESENCIAL' && !formData.direccion_capacitacion?.trim()) {
            newErrors.direccion_capacitacion = 'Dirección es requerida para capacitación presencial';
        }

        // Validación de fechas
        if (formData.fecha_capacitacion_solicitada) {
            const fechaSolicitada = new Date(formData.fecha_capacitacion_solicitada);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            
            if (fechaSolicitada < hoy) {
                newErrors.fecha_capacitacion_solicitada = 'La fecha no puede ser anterior a hoy';
            }
        }

        if (formData.fecha_capacitacion_programada) {
            const fechaProgramada = new Date(formData.fecha_capacitacion_programada);
            const fechaSolicitada = new Date(formData.fecha_capacitacion_solicitada);
            
            if (fechaProgramada < fechaSolicitada) {
                newErrors.fecha_capacitacion_programada = 'La fecha programada no puede ser anterior a la solicitada';
            }
        }

        // Validación de duración
        if (formData.duracion_estimada_horas && 
            (isNaN(formData.duracion_estimada_horas) || formData.duracion_estimada_horas <= 0)) {
            newErrors.duracion_estimada_horas = 'Duración debe ser un número positivo';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setLoading(true);

            const url = capacitacionData 
                ? `/api/soporte/capacitaciones/${capacitacionData.id}`
                : '/api/soporte/capacitaciones';

            const method = capacitacionData ? 'PUT' : 'POST';

            const body = {
                ...formData,
                duracion_estimada_horas: formData.duracion_estimada_horas ? parseFloat(formData.duracion_estimada_horas) : null,
                estado: capacitacionData?.estado || 'PENDIENTE'
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
                if (capacitacionData && onCapacitacionUpdated) {
                    onCapacitacionUpdated(data.data);
                } else if (onCapacitacionCreated) {
                    onCapacitacionCreated(data.data);
                }
                
                handleClose();
                
                alert(capacitacionData 
                    ? 'Capacitación actualizada exitosamente' 
                    : 'Capacitación programada exitosamente'
                );
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error procesando capacitación: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Limpiar formulario
        setFormData({
            venta_id: '',
            ticket_id: '',
            producto_id: '',
            tecnico_asignado_id: '',
            cliente_nombre: '',
            cliente_telefono: '',
            cliente_email: '',
            direccion_capacitacion: '',
            producto_codigo: '',
            producto_descripcion: '',
            numero_serie: '',
            fecha_capacitacion_solicitada: '',
            fecha_capacitacion_programada: '',
            tipo_capacitacion: 'USO_BASICO',
            modalidad: 'PRESENCIAL',
            duracion_estimada_horas: '2',
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
        
        // Auto-completar duración sugerida cuando cambia el tipo
        if (field === 'tipo_capacitacion') {
            const tipoConfig = tiposCapacitacion.find(t => t.value === value);
            if (tipoConfig) {
                setFormData(prev => ({
                    ...prev,
                    duracion_estimada_horas: tipoConfig.duracion_sugerida.toString()
                }));
            }
        }
        
        // Limpiar error del campo cuando el usuario empiece a escribir
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: undefined
            }));
        }
    };

    const handleProductoChange = (productoId) => {
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            setFormData(prev => ({
                ...prev,
                producto_id: productoId,
                producto_codigo: producto.codigo,
                producto_descripcion: producto.descripcion
            }));
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {capacitacionData ? (
                            <>
                                <Settings className="h-5 w-5" />
                                Editar Capacitación
                            </>
                        ) : (
                            <>
                                <Plus className="h-5 w-5" />
                                {ticketData ? 'Programar Capacitación desde Ticket' : 'Nueva Capacitación'}
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {ticketData && (
                            <div className="flex items-center gap-2 mt-2">
                                <Building className="h-4 w-4" />
                                <span>Ticket: {ticketData.codigo}</span>
                                <span className="text-gray-400">•</span>
                                <span>Cliente: {ticketData.cliente_nombre}</span>
                            </div>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
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
                                    <Label htmlFor="cliente_telefono">Teléfono *</Label>
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

                            {/* Email y dirección */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cliente_email">Email (opcional)</Label>
                                    <Input
                                        id="cliente_email"
                                        type="email"
                                        value={formData.cliente_email}
                                        onChange={(e) => handleInputChange('cliente_email', e.target.value)}
                                        placeholder="Correo electrónico"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="direccion_capacitacion">
                                        Dirección {formData.modalidad === 'PRESENCIAL' && '*'}
                                    </Label>
                                    <Input
                                        id="direccion_capacitacion"
                                        value={formData.direccion_capacitacion}
                                        onChange={(e) => handleInputChange('direccion_capacitacion', e.target.value)}
                                        placeholder="Dirección para capacitación presencial"
                                        className={errors.direccion_capacitacion ? 'border-red-500' : ''}
                                        disabled={formData.modalidad !== 'PRESENCIAL'}
                                    />
                                    {errors.direccion_capacitacion && (
                                        <p className="text-sm text-red-600">{errors.direccion_capacitacion}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información del producto */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Información del Producto</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Selección de producto */}
                                <div className="space-y-2">
                                    <Label htmlFor="producto_id">Producto</Label>
                                    <Select 
                                        value={formData.producto_id} 
                                        onValueChange={handleProductoChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar producto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {productos.map(producto => (
                                                <SelectItem key={producto.id} value={producto.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Package className="h-4 w-4" />
                                                        {producto.codigo} - {producto.descripcion}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Código manual */}
                                <div className="space-y-2">
                                    <Label htmlFor="producto_codigo">Código del Producto *</Label>
                                    <Input
                                        id="producto_codigo"
                                        value={formData.producto_codigo}
                                        onChange={(e) => handleInputChange('producto_codigo', e.target.value)}
                                        placeholder="Código del producto"
                                        className={errors.producto_codigo ? 'border-red-500' : ''}
                                    />
                                    {errors.producto_codigo && (
                                        <p className="text-sm text-red-600">{errors.producto_codigo}</p>
                                    )}
                                </div>
                            </div>

                            {/* Descripción y número de serie */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="producto_descripcion">Descripción del Producto</Label>
                                    <Input
                                        id="producto_descripcion"
                                        value={formData.producto_descripcion}
                                        onChange={(e) => handleInputChange('producto_descripcion', e.target.value)}
                                        placeholder="Descripción del producto"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="numero_serie">Número de Serie (opcional)</Label>
                                    <Input
                                        id="numero_serie"
                                        value={formData.numero_serie}
                                        onChange={(e) => handleInputChange('numero_serie', e.target.value)}
                                        placeholder="Número de serie del producto"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configuración de la capacitación */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Configuración de la Capacitación</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Tipo de capacitación */}
                            <div className="space-y-2">
                                <Label htmlFor="tipo_capacitacion">Tipo de Capacitación *</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {tiposCapacitacion.map((tipo) => (
                                        <label
                                            key={tipo.value}
                                            className={`flex flex-col gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                                                formData.tipo_capacitacion === tipo.value 
                                                    ? 'border-blue-500 bg-blue-50' 
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="tipo_capacitacion"
                                                    value={tipo.value}
                                                    checked={formData.tipo_capacitacion === tipo.value}
                                                    onChange={(e) => handleInputChange('tipo_capacitacion', e.target.value)}
                                                />
                                                <span className="font-medium text-sm">{tipo.label}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {tipo.duracion_sugerida}h
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-600 ml-6">{tipo.descripcion}</p>
                                        </label>
                                    ))}
                                </div>
                                {errors.tipo_capacitacion && (
                                    <p className="text-sm text-red-600">{errors.tipo_capacitacion}</p>
                                )}
                            </div>

                            {/* Modalidad */}
                            <div className="space-y-2">
                                <Label htmlFor="modalidad">Modalidad *</Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {modalidades.map((modalidad) => {
                                        const Icon = modalidad.icon;
                                        return (
                                            <label
                                                key={modalidad.value}
                                                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                                                    formData.modalidad === modalidad.value 
                                                        ? 'border-blue-500 bg-blue-50' 
                                                        : 'border-gray-200'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="modalidad"
                                                    value={modalidad.value}
                                                    checked={formData.modalidad === modalidad.value}
                                                    onChange={(e) => handleInputChange('modalidad', e.target.value)}
                                                />
                                                <Icon className={`h-5 w-5 ${modalidad.color}`} />
                                                <div>
                                                    <div className="font-medium text-sm">{modalidad.label}</div>
                                                    <div className="text-xs text-gray-600">{modalidad.descripcion}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                                {errors.modalidad && (
                                    <p className="text-sm text-red-600">{errors.modalidad}</p>
                                )}
                            </div>

                            {/* Fechas y asignación */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fecha_capacitacion_solicitada">Fecha Solicitada *</Label>
                                    <Input
                                        id="fecha_capacitacion_solicitada"
                                        type="date"
                                        value={formData.fecha_capacitacion_solicitada}
                                        onChange={(e) => handleInputChange('fecha_capacitacion_solicitada', e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className={errors.fecha_capacitacion_solicitada ? 'border-red-500' : ''}
                                    />
                                    {errors.fecha_capacitacion_solicitada && (
                                        <p className="text-sm text-red-600">{errors.fecha_capacitacion_solicitada}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="fecha_capacitacion_programada">Fecha Programada</Label>
                                    <Input
                                        id="fecha_capacitacion_programada"
                                        type="date"
                                        value={formData.fecha_capacitacion_programada}
                                        onChange={(e) => handleInputChange('fecha_capacitacion_programada', e.target.value)}
                                        min={formData.fecha_capacitacion_solicitada || new Date().toISOString().split('T')[0]}
                                        className={errors.fecha_capacitacion_programada ? 'border-red-500' : ''}
                                    />
                                    {errors.fecha_capacitacion_programada && (
                                        <p className="text-sm text-red-600">{errors.fecha_capacitacion_programada}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="duracion_estimada_horas">Duración (horas)</Label>
                                    <Input
                                        id="duracion_estimada_horas"
                                        type="number"
                                        min="0.5"
                                        max="8"
                                        step="0.5"
                                        value={formData.duracion_estimada_horas}
                                        onChange={(e) => handleInputChange('duracion_estimada_horas', e.target.value)}
                                        className={errors.duracion_estimada_horas ? 'border-red-500' : ''}
                                    />
                                    {errors.duracion_estimada_horas && (
                                        <p className="text-sm text-red-600">{errors.duracion_estimada_horas}</p>
                                    )}
                                </div>
                            </div>

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
                        </CardContent>
                    </Card>

                    {/* Observaciones */}
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
                                    placeholder="Observaciones adicionales, requisitos especiales, etc..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información de contexto si viene de ticket */}
                    {ticketData && (
                        <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="space-y-1">
                                    <p><strong>Ticket origen:</strong> {ticketData.codigo} - {ticketData.titulo}</p>
                                    <p><strong>Tipo:</strong> {ticketData.tipo_ticket}</p>
                                    <p><strong>Prioridad:</strong> {ticketData.prioridad}</p>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            <Save className="h-4 w-4 mr-2" />
                            {loading 
                                ? 'Guardando...' 
                                : capacitacionData 
                                    ? 'Actualizar Capacitación' 
                                    : 'Programar Capacitación'
                            }
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CapacitacionForm;