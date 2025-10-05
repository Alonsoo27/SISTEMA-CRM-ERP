// src/components/ventas/ActividadWidget/ModalCheckIn.jsx
import React, { useState, useEffect } from 'react';
import {
  X, MessageSquare, Phone, Instagram, Mic,
  Save, AlertCircle, CheckCircle, Target, ChevronDown
} from 'lucide-react';

const ModalCheckIn = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading = false 
}) => {
  const [formData, setFormData] = useState({
    mensajes_meta: 0,
    mensajes_whatsapp: 0,
    mensajes_instagram: 0,
    mensajes_tiktok: 0,
    notas_check_in: '',
    en_campana: false,
    producto_campana: ''
  });

  const [errors, setErrors] = useState({});
  const [lineasProductos, setLineasProductos] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [campanaActiva, setCampanaActiva] = useState(null);

  // Cargar líneas de productos y campaña activa cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      cargarLineasProductos();
      cargarCampanaActiva();
    } else {
      // Reset del formulario cuando se cierra el modal
      setFormData({
        mensajes_meta: 0,
        mensajes_whatsapp: 0,
        mensajes_instagram: 0,
        mensajes_tiktok: 0,
        notas_check_in: '',
        en_campana: false,
        producto_campana: ''
      });
      setCampanaActiva(null);
      setErrors({});
    }
  }, [isOpen]);

  const cargarLineasProductos = async () => {
    try {
      setLoadingLineas(true);
      const response = await fetch('/api/productos/lineas', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLineasProductos(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error cargando líneas:', error);
    } finally {
      setLoadingLineas(false);
    }
  };

  const cargarCampanaActiva = async () => {
    try {
      // Consultar campaña activa del asesor en el nuevo sistema
      const response = await fetch('/api/campanas-asesor/campana-activa', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const campana = data.data;

          setCampanaActiva({
            id: campana.id,
            nombre_campana: campana.nombre_campana,
            linea_producto: campana.linea_producto,
            fecha_inicio: campana.fecha_inicio,
            dias_trabajados: campana.dias_trabajados,
            total_mensajes: campana.total_mensajes
          });

          // Pre-cargar en el formulario
          setFormData(prev => ({
            ...prev,
            en_campana: true,
            producto_campana: campana.linea_producto || ''
          }));
        }
      }
    } catch (error) {
      console.error('Error cargando campaña activa:', error);
    }
  };

  // Manejar cambios en inputs
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    // Validar rangos de mensajes
    Object.keys(formData).forEach(field => {
      if (field.startsWith('mensajes_')) {
        const value = parseInt(formData[field]);
        if (isNaN(value) || value < 0) {
          newErrors[field] = 'Debe ser un número mayor o igual a 0';
        } else if (value > 1000) {
          newErrors[field] = 'No puede ser mayor a 1000';
        }
      }
    });

    // Validar notas
    if (formData.notas_check_in && formData.notas_check_in.length > 500) {
      newErrors.notas_check_in = 'No puede exceder 500 caracteres';
    }

    // Validar línea de producto si está en campaña
    if (formData.en_campana && !formData.producto_campana.trim()) {
      newErrors.producto_campana = 'Debes especificar la línea de producto';
    }

    if (formData.producto_campana && formData.producto_campana.length > 100) {
      newErrors.producto_campana = 'No puede exceder 100 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Convertir a números
    const sanitizedData = {
      ...formData,
      mensajes_meta: parseInt(formData.mensajes_meta) || 0,
      mensajes_whatsapp: parseInt(formData.mensajes_whatsapp) || 0,
      mensajes_instagram: parseInt(formData.mensajes_instagram) || 0,
      mensajes_tiktok: parseInt(formData.mensajes_tiktok) || 0,
    };

    onSubmit(sanitizedData);
  };

  // Calcular total de mensajes
  const totalMensajes = Object.keys(formData)
    .filter(key => key.startsWith('mensajes_'))
    .reduce((sum, key) => sum + (parseInt(formData[key]) || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Check-in del Día
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Información inicial */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Mensajes Recibidos</h4>
                <p className="text-sm text-blue-700">
                  Ingresa la cantidad de mensajes que recibiste desde ayer hasta ahora en cada plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* Campos de mensajes */}
          <div className="space-y-4">
            {/* Meta/Facebook */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span>Meta/Facebook</span>
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={formData.mensajes_meta}
                onChange={(e) => handleInputChange('mensajes_meta', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.mensajes_meta ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              {errors.mensajes_meta && (
                <p className="text-red-600 text-xs mt-1">{errors.mensajes_meta}</p>
              )}
            </div>

            {/* WhatsApp */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 text-green-600" />
                <span>WhatsApp</span>
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={formData.mensajes_whatsapp}
                onChange={(e) => handleInputChange('mensajes_whatsapp', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.mensajes_whatsapp ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              {errors.mensajes_whatsapp && (
                <p className="text-red-600 text-xs mt-1">{errors.mensajes_whatsapp}</p>
              )}
            </div>

            {/* Instagram */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Instagram className="h-4 w-4 text-pink-600" />
                <span>Instagram</span>
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={formData.mensajes_instagram}
                onChange={(e) => handleInputChange('mensajes_instagram', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.mensajes_instagram ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              {errors.mensajes_instagram && (
                <p className="text-red-600 text-xs mt-1">{errors.mensajes_instagram}</p>
              )}
            </div>

            {/* TikTok */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Mic className="h-4 w-4 text-red-600" />
                <span>TikTok</span>
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={formData.mensajes_tiktok}
                onChange={(e) => handleInputChange('mensajes_tiktok', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.mensajes_tiktok ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              {errors.mensajes_tiktok && (
                <p className="text-red-600 text-xs mt-1">{errors.mensajes_tiktok}</p>
              )}
            </div>

            {/* Sección de Campaña */}
            <div className="border-t pt-4 mt-6">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                <Target className="h-4 w-4 text-purple-600" />
                <span>Tracking de Campaña</span>
              </h4>

              {/* Alerta de campaña activa */}
              {campanaActiva && (
                <div className={`mb-4 rounded-lg p-3 ${
                  campanaActiva.persistente
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-purple-50 border border-purple-200'
                }`}>
                  <div className="flex items-start space-x-2">
                    <Target className={`h-4 w-4 mt-0.5 ${
                      campanaActiva.persistente ? 'text-blue-600' : 'text-purple-600'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        campanaActiva.persistente ? 'text-blue-900' : 'text-purple-900'
                      }`}>
                        {campanaActiva.persistente
                          ? '🔄 Continuando campaña anterior'
                          : '✨ Nueva campaña activa detectada'
                        }
                      </p>
                      <p className={`text-xs mt-1 ${
                        campanaActiva.persistente ? 'text-blue-700' : 'text-purple-700'
                      }`}>
                        {campanaActiva.nombre} - {campanaActiva.linea_producto}
                      </p>
                      {campanaActiva.persistente && (
                        <p className="text-xs text-blue-600 mt-1 italic">
                          Desmarca el checkbox si ya finalizó esta campaña
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Checkbox de campaña */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.en_campana}
                    onChange={(e) => handleInputChange('en_campana', e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    disabled={loading}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Estoy trabajando en una campaña específica
                  </span>
                </label>
              </div>

              {/* Campo condicional de línea de producto */}
              {formData.en_campana && (
                <div className="ml-6 bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-purple-800 mb-2">
                    Línea de producto de la campaña
                  </label>
                  <div className="relative">
                    <select
                      value={formData.producto_campana}
                      onChange={(e) => handleInputChange('producto_campana', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white ${
                        errors.producto_campana ? 'border-red-300' : 'border-purple-300'
                      }`}
                      disabled={loading || loadingLineas}
                    >
                      <option value="">Selecciona una línea de producto...</option>
                      {lineasProductos.map((linea) => (
                        <option key={linea.value} value={linea.value}>
                          {linea.label} ({linea.productos_count} productos)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400 pointer-events-none" />
                  </div>
                  {loadingLineas && (
                    <p className="text-purple-600 text-xs mt-1 flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-1"></div>
                      Cargando líneas...
                    </p>
                  )}
                  {errors.producto_campana && (
                    <p className="text-red-600 text-xs mt-1">{errors.producto_campana}</p>
                  )}
                  {!loadingLineas && lineasProductos.length === 0 && (
                    <p className="text-amber-600 text-xs mt-1">
                      ⚠️ No se pudieron cargar las líneas de productos
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas adicionales (opcional)
              </label>
              <textarea
                value={formData.notas_check_in}
                onChange={(e) => handleInputChange('notas_check_in', e.target.value)}
                rows={3}
                maxLength={500}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                  errors.notas_check_in ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Comentarios sobre tu inicio de jornada..."
                disabled={loading}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.notas_check_in && (
                  <p className="text-red-600 text-xs">{errors.notas_check_in}</p>
                )}
                <p className="text-gray-500 text-xs ml-auto">
                  {formData.notas_check_in.length}/500
                </p>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total de mensajes:</span>
              <span className="text-lg font-bold text-blue-600">{totalMensajes}</span>
            </div>
            {totalMensajes === 0 && (
              <p className="text-amber-600 text-xs mt-1">
                ⚠️ No has registrado mensajes. ¿Es correcto?
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Hacer Check-in
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCheckIn;