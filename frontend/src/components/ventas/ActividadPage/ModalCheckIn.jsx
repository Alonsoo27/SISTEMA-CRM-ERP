// src/components/ventas/ActividadWidget/ModalCheckIn.jsx
import React, { useState } from 'react';
import {
  X, MessageSquare, Phone, Instagram, Mic, 
  Save, AlertCircle, CheckCircle
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
    notas_check_in: ''
  });

  const [errors, setErrors] = useState({});

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