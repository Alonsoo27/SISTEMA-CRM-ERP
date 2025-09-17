// src/components/ventas/ActividadWidget/ModalCheckOut.jsx
import React, { useState } from 'react';
import {
  X, Phone, PhoneCall, Save, AlertCircle, CheckCircle
} from 'lucide-react';

const ModalCheckOut = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading = false 
}) => {
  const [formData, setFormData] = useState({
    llamadas_realizadas: 0,
    llamadas_recibidas: 0,
    notas_check_out: ''
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

    // Validar rangos de llamadas
    if (isNaN(parseInt(formData.llamadas_realizadas)) || parseInt(formData.llamadas_realizadas) < 0) {
      newErrors.llamadas_realizadas = 'Debe ser un número mayor o igual a 0';
    } else if (parseInt(formData.llamadas_realizadas) > 200) {
      newErrors.llamadas_realizadas = 'No puede ser mayor a 200';
    }

    if (isNaN(parseInt(formData.llamadas_recibidas)) || parseInt(formData.llamadas_recibidas) < 0) {
      newErrors.llamadas_recibidas = 'Debe ser un número mayor o igual a 0';
    } else if (parseInt(formData.llamadas_recibidas) > 200) {
      newErrors.llamadas_recibidas = 'No puede ser mayor a 200';
    }

    // Validar notas
    if (formData.notas_check_out && formData.notas_check_out.length > 500) {
      newErrors.notas_check_out = 'No puede exceder 500 caracteres';
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
      llamadas_realizadas: parseInt(formData.llamadas_realizadas) || 0,
      llamadas_recibidas: parseInt(formData.llamadas_recibidas) || 0,
    };

    onSubmit(sanitizedData);
  };

  // Calcular total de llamadas
  const totalLlamadas = (parseInt(formData.llamadas_realizadas) || 0) + (parseInt(formData.llamadas_recibidas) || 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Check-out del Día
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
                <h4 className="font-medium text-blue-900">Llamadas del Día</h4>
                <p className="text-sm text-blue-700">
                  Ingresa la cantidad de llamadas que realizaste y recibiste durante tu jornada laboral.
                </p>
              </div>
            </div>
          </div>

          {/* Campos de llamadas */}
          <div className="space-y-4">
            {/* Llamadas Realizadas */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <PhoneCall className="h-4 w-4 text-green-600" />
                <span>Llamadas Realizadas</span>
              </label>
              <input
                type="number"
                min="0"
                max="200"
                value={formData.llamadas_realizadas}
                onChange={(e) => handleInputChange('llamadas_realizadas', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.llamadas_realizadas ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              {errors.llamadas_realizadas && (
                <p className="text-red-600 text-xs mt-1">{errors.llamadas_realizadas}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">Llamadas que hiciste a clientes o prospectos</p>
            </div>

            {/* Llamadas Recibidas */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 text-blue-600" />
                <span>Llamadas Recibidas</span>
              </label>
              <input
                type="number"
                min="0"
                max="200"
                value={formData.llamadas_recibidas}
                onChange={(e) => handleInputChange('llamadas_recibidas', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.llamadas_recibidas ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              {errors.llamadas_recibidas && (
                <p className="text-red-600 text-xs mt-1">{errors.llamadas_recibidas}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">Llamadas que recibiste de clientes o prospectos</p>
            </div>

            {/* Notas del Check-out */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resumen de la jornada (opcional)
              </label>
              <textarea
                value={formData.notas_check_out}
                onChange={(e) => handleInputChange('notas_check_out', e.target.value)}
                rows={4}
                maxLength={500}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                  errors.notas_check_out ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Resumen de actividades, logros del día, objetivos para mañana..."
                disabled={loading}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.notas_check_out && (
                  <p className="text-red-600 text-xs">{errors.notas_check_out}</p>
                )}
                <p className="text-gray-500 text-xs ml-auto">
                  {formData.notas_check_out.length}/500
                </p>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total de llamadas:</span>
              <span className="text-lg font-bold text-blue-600">{totalLlamadas}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Realizadas:</span>
                <span className="font-medium">{formData.llamadas_realizadas || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Recibidas:</span>
                <span className="font-medium">{formData.llamadas_recibidas || 0}</span>
              </div>
            </div>
            {totalLlamadas === 0 && (
              <p className="text-amber-600 text-xs mt-2">
                ⚠️ No has registrado llamadas. ¿Es correcto?
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
              className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Finalizando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Hacer Check-out
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCheckOut;