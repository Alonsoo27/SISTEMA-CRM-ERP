// src/components/ventas/ClienteForm/ClienteForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Save, AlertCircle, CheckCircle, User, Mail, Phone,
  Building, MapPin, Calendar, CreditCard, Tag, Globe,
  Users, Briefcase
} from 'lucide-react';
import ventasService from '../../../services/ventasService';

const ClienteForm = ({
  cliente = null,
  mode = 'create', // 'create' | 'edit'
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    telefono_secundario: '',
    direccion: '',
    ciudad: '',
    departamento: '',
    codigo_postal: '',
    tipo_cliente: 'persona', // 'persona' | 'empresa'
    tipo_documento: 'cedula', // 'cedula' | 'nit' | 'pasaporte'
    numero_documento: '',
    empresa: '',
    cargo: '',
    sector: '',
    origen: 'directo', // 'directo' | 'referido' | 'web' | 'redes'
    estado: 'activo', // 'activo' | 'inactivo' | 'prospecto'
    observaciones: '',
    fecha_nacimiento: '',
    genero: '',
    preferencias_comunicacion: 'email', // 'email' | 'telefono' | 'whatsapp'
    tags: []
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [tagInput, setTagInput] = useState('');

  // Opciones para selects
  const tiposCliente = [
    { value: 'persona', label: 'Persona Natural' },
    { value: 'empresa', label: 'Empresa' }
  ];

  const tiposDocumento = [
    { value: 'cedula', label: 'Cédula' },
    { value: 'nit', label: 'NIT' },
    { value: 'pasaporte', label: 'Pasaporte' },
    { value: 'cedula_extranjeria', label: 'Cédula de Extranjería' }
  ];

  const origenes = [
    { value: 'directo', label: 'Contacto Directo' },
    { value: 'referido', label: 'Referido' },
    { value: 'web', label: 'Página Web' },
    { value: 'redes', label: 'Redes Sociales' },
    { value: 'publicidad', label: 'Publicidad' },
    { value: 'evento', label: 'Evento' }
  ];

  const estados = [
    { value: 'prospecto', label: 'Prospecto' },
    { value: 'activo', label: 'Cliente Activo' },
    { value: 'inactivo', label: 'Inactivo' }
  ];

  const sectores = [
    'Tecnología', 'Salud', 'Educación', 'Comercio', 'Servicios',
    'Manufactura', 'Construcción', 'Agricultura', 'Turismo', 'Otro'
  ];

  const departamentos = [
    'Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Atlántico',
    'Santander', 'Cundinamarca', 'Bolívar', 'Norte de Santander',
    'Córdoba', 'Tolima', 'Otro'
  ];

  // Inicializar formulario con datos de cliente existente
  useEffect(() => {
    if (mode === 'edit' && cliente) {
      setFormData({
        nombre: cliente.nombre || '',
        email: cliente.email || '',
        telefono: cliente.telefono || '',
        telefono_secundario: cliente.telefono_secundario || '',
        direccion: cliente.direccion || '',
        ciudad: cliente.ciudad || '',
        departamento: cliente.departamento || '',
        codigo_postal: cliente.codigo_postal || '',
        tipo_cliente: cliente.tipo_cliente || 'persona',
        tipo_documento: cliente.tipo_documento || 'cedula',
        numero_documento: cliente.numero_documento || '',
        empresa: cliente.empresa || '',
        cargo: cliente.cargo || '',
        sector: cliente.sector || '',
        origen: cliente.origen || 'directo',
        estado: cliente.estado || 'activo',
        observaciones: cliente.observaciones || '',
        fecha_nacimiento: cliente.fecha_nacimiento ? 
          new Date(cliente.fecha_nacimiento).toISOString().split('T')[0] : '',
        genero: cliente.genero || '',
        preferencias_comunicacion: cliente.preferencias_comunicacion || 'email',
        tags: cliente.tags || []
      });
    }
  }, [mode, cliente]);

  // Validar formulario
  const validarFormulario = useCallback(() => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    if (!formData.telefono.trim()) {
      newErrors.telefono = 'El teléfono es obligatorio';
    } else if (formData.telefono.length < 7) {
      newErrors.telefono = 'El teléfono debe tener al menos 7 dígitos';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.tipo_cliente === 'empresa' && !formData.empresa.trim()) {
      newErrors.empresa = 'El nombre de la empresa es obligatorio';
    }

    if (formData.numero_documento && formData.numero_documento.length < 5) {
      newErrors.numero_documento = 'Número de documento inválido';
    }

    if (formData.fecha_nacimiento) {
      const fechaNacimiento = new Date(formData.fecha_nacimiento);
      const hoy = new Date();
      const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
      
      if (edad < 0 || edad > 120) {
        newErrors.fecha_nacimiento = 'Fecha de nacimiento inválida';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Manejar cambios en el formulario
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  // Manejar tags
  const agregarTag = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const nuevoTag = tagInput.trim().toLowerCase();
      
      if (nuevoTag && !formData.tags.includes(nuevoTag)) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, nuevoTag]
        }));
      }
      setTagInput('');
    }
  }, [tagInput, formData.tags]);

  const eliminarTag = useCallback((tagAEliminar) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagAEliminar)
    }));
  }, []);

  // Manejar envío del formulario
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      showNotification('Por favor corrige los errores en el formulario', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Preparar datos para envío
      const datosCliente = {
        ...formData,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        tags: formData.tags.join(',') // Convertir array a string
      };

      let response;
      if (mode === 'edit') {
        response = await ventasService.actualizarCliente(cliente.id, datosCliente);
      } else {
        response = await ventasService.crearCliente(datosCliente);
      }

      if (response.success) {
        showNotification(
          `Cliente ${mode === 'edit' ? 'actualizado' : 'creado'} exitosamente`,
          'success'
        );
        setTimeout(() => {
          onSave(response.data);
        }, 1000);
      } else {
        showNotification(response.error, 'error');
      }
    } catch (err) {
      showNotification('Error procesando el cliente', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, mode, cliente, validarFormulario, onSave]);

  // Sistema de notificaciones
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Componente de notificación
  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    const IconComponent = iconos[notification.tipo];

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-sm`}>
        <div className="flex items-center">
          <IconComponent className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'edit' ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <p className="text-sm text-gray-600">
              {mode === 'edit' ? 'Actualiza la información del cliente' : 'Completa los datos para registrar un nuevo cliente'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tipo de cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Cliente
              </label>
              <select
                value={formData.tipo_cliente}
                onChange={(e) => handleInputChange('tipo_cliente', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {tiposCliente.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={formData.estado}
                onChange={(e) => handleInputChange('estado', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {estados.map(estado => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Información básica */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.nombre ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Nombre completo del cliente"
                  />
                </div>
                {errors.nombre && (
                  <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
                )}
              </div>

              {formData.tipo_cliente === 'empresa' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empresa *
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.empresa}
                      onChange={(e) => handleInputChange('empresa', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.empresa ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  {errors.empresa && (
                    <p className="mt-1 text-sm text-red-600">{errors.empresa}</p>
                  )}
                </div>
              )}

              {formData.tipo_cliente === 'persona' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Nacimiento
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.fecha_nacimiento}
                      onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.fecha_nacimiento ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.fecha_nacimiento && (
                    <p className="mt-1 text-sm text-red-600">{errors.fecha_nacimiento}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Documento
                </label>
                <select
                  value={formData.tipo_documento}
                  onChange={(e) => handleInputChange('tipo_documento', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {tiposDocumento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Documento
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.numero_documento}
                    onChange={(e) => handleInputChange('numero_documento', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.numero_documento ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Número de documento"
                  />
                </div>
                {errors.numero_documento && (
                  <p className="mt-1 text-sm text-red-600">{errors.numero_documento}</p>
                )}
              </div>

              {formData.tipo_cliente === 'persona' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Género
                  </label>
                  <select
                    value={formData.genero}
                    onChange={(e) => handleInputChange('genero', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                    <option value="no_especifica">Prefiere no especificar</option>
                  </select>
                </div>
              )}

              {formData.tipo_cliente === 'empresa' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cargo
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => handleInputChange('cargo', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Cargo en la empresa"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información de contacto */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de Contacto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="cliente@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono Principal *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.telefono ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Número de teléfono"
                  />
                </div>
                {errors.telefono && (
                  <p className="mt-1 text-sm text-red-600">{errors.telefono}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono Secundario
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.telefono_secundario}
                    onChange={(e) => handleInputChange('telefono_secundario', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Teléfono alternativo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferencia de Comunicación
                </label>
                <select
                  value={formData.preferencias_comunicacion}
                  onChange={(e) => handleInputChange('preferencias_comunicacion', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="email">Email</option>
                  <option value="telefono">Teléfono</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </div>
          </div>

          {/* Información de ubicación */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubicación</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <textarea
                    value={formData.direccion}
                    onChange={(e) => handleInputChange('direccion', e.target.value)}
                    rows={2}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dirección completa"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={formData.ciudad}
                  onChange={(e) => handleInputChange('ciudad', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ciudad"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento
                </label>
                <select
                  value={formData.departamento}
                  onChange={(e) => handleInputChange('departamento', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  {departamentos.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código Postal
                </label>
                <input
                  type="text"
                  value={formData.codigo_postal}
                  onChange={(e) => handleInputChange('codigo_postal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Código postal"
                />
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Adicional</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origen del Cliente
                </label>
                <select
                  value={formData.origen}
                  onChange={(e) => handleInputChange('origen', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {origenes.map(origen => (
                    <option key={origen.value} value={origen.value}>
                      {origen.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.tipo_cliente === 'empresa' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sector
                  </label>
                  <select
                    value={formData.sector}
                    onChange={(e) => handleInputChange('sector', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    {sectores.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags/Etiquetas
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={agregarTag}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Escribe una etiqueta y presiona Enter o coma"
                  />
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => eliminarTag(tag)}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => handleInputChange('observaciones', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas adicionales sobre el cliente..."
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {mode === 'edit' ? 'Actualizar Cliente' : 'Crear Cliente'}
            </button>
          </div>
        </form>

        {/* Notificaciones */}
        <NotificationComponent />
      </div>
    </div>
  );
};

export default ClienteForm;