// src/components/ventas/ActividadWidget/ModalCheckOut.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Phone, PhoneCall, Save, AlertCircle, CheckCircle, TrendingUp, Percent, MessageSquare
} from 'lucide-react';

const ModalCheckOut = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  campanasActivas = [], // ← NUEVA PROP: array de líneas de campaña activas
  totalMensajes = 0 // ← NUEVA PROP: total de mensajes del día
}) => {
  const [formData, setFormData] = useState({
    llamadas_realizadas: 0,
    llamadas_recibidas: 0,
    notas_check_out: ''
  });

  const [errors, setErrors] = useState({});

  // ✅ NUEVO: Estado para distribución de campañas
  const [distribucionCampanas, setDistribucionCampanas] = useState({});
  const [errorDistribucion, setErrorDistribucion] = useState('');

  // ✅ NUEVO: Estado para mensajes adicionales del día
  const [mensajesAdicionales, setMensajesAdicionales] = useState({
    meta: 0,
    whatsapp: 0,
    instagram: 0,
    tiktok: 0
  });

  // ✅ NUEVO: Inicializar distribución cuando hay múltiples campañas
  useEffect(() => {
    if (campanasActivas.length > 1) {
      // Distribución equitativa inicial
      const porcentajeInicial = Math.floor(100 / campanasActivas.length);
      const distribucionInicial = {};

      campanasActivas.forEach((campana, index) => {
        // El último lleva el resto para sumar exactamente 100%
        if (index === campanasActivas.length - 1) {
          distribucionInicial[campana] = 100 - (porcentajeInicial * (campanasActivas.length - 1));
        } else {
          distribucionInicial[campana] = porcentajeInicial;
        }
      });

      setDistribucionCampanas(distribucionInicial);
    }
  }, [campanasActivas]);

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

  // ✅ NUEVO: Manejar cambios en distribución de campañas
  const handleDistribucionChange = (campana, porcentaje) => {
    const valor = parseInt(porcentaje) || 0;

    setDistribucionCampanas(prev => ({
      ...prev,
      [campana]: Math.min(100, Math.max(0, valor)) // Entre 0 y 100
    }));

    setErrorDistribucion(''); // Limpiar error
  };

  // ✅ NUEVO: Manejar cambios en mensajes adicionales
  const handleMensajeAdicionalChange = (canal, valor) => {
    const cantidad = parseInt(valor) || 0;

    setMensajesAdicionales(prev => ({
      ...prev,
      [canal]: Math.min(1000, Math.max(0, cantidad)) // Entre 0 y 1000
    }));
  };

  // ✅ NUEVO: Validar distribución de campañas
  const validarDistribucion = () => {
    if (campanasActivas.length <= 1) {
      return true; // No requiere validación
    }

    const total = Object.values(distribucionCampanas).reduce((sum, val) => sum + val, 0);

    if (Math.abs(total - 100) > 2) {
      setErrorDistribucion(`La distribución debe sumar 100% (actual: ${total}%)`);
      return false;
    }

    return true;
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

    // ✅ NUEVO: Validar distribución si hay múltiples campañas
    if (campanasActivas.length > 1 && !validarDistribucion()) {
      return;
    }

    // Convertir a números
    const sanitizedData = {
      ...formData,
      llamadas_realizadas: parseInt(formData.llamadas_realizadas) || 0,
      llamadas_recibidas: parseInt(formData.llamadas_recibidas) || 0,
    };

    // ✅ NUEVO: Incluir distribución de campañas si hay múltiples
    if (campanasActivas.length > 1) {
      sanitizedData.distribucion_campanas = distribucionCampanas;
    }

    // ✅ NUEVO: Incluir mensajes adicionales si hay alguno
    const totalMensajesAdicionales = Object.values(mensajesAdicionales).reduce((sum, val) => sum + val, 0);
    if (totalMensajesAdicionales > 0) {
      sanitizedData.mensajes_adicionales = mensajesAdicionales;
    }

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

          {/* ✅ NUEVO: Sección de Redistribución de Campañas (solo si hay múltiples) */}
          {campanasActivas.length > 1 && (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start space-x-2 mb-4">
                <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-900">Distribución de Mensajes por Campaña</h4>
                  <p className="text-sm text-purple-700">
                    Tienes <span className="font-semibold">{totalMensajes} mensajes</span> del día.
                    Distribuye el porcentaje de mensajes trabajados en cada campaña (debe sumar 100%).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {campanasActivas.map((campana) => {
                  const porcentaje = distribucionCampanas[campana] || 0;
                  const mensajesEstimados = Math.round((totalMensajes * porcentaje) / 100);

                  return (
                    <div key={campana} className="bg-white rounded-lg p-3 border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          {campana}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={porcentaje}
                            onChange={(e) => handleDistribucionChange(campana, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            disabled={loading}
                          />
                          <Percent className="h-4 w-4 text-gray-500" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <span>≈ {mensajesEstimados} mensajes</span>
                        <div className="bg-purple-100 h-2 rounded-full w-24 overflow-hidden">
                          <div
                            className="bg-purple-600 h-full transition-all duration-300"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Indicador de total */}
              <div className="mt-3 pt-3 border-t border-purple-200 flex justify-between items-center">
                <span className="text-sm font-medium text-purple-900">Total:</span>
                <span className={`text-lg font-bold ${
                  Math.abs(Object.values(distribucionCampanas).reduce((sum, val) => sum + val, 0) - 100) <= 2
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {Object.values(distribucionCampanas).reduce((sum, val) => sum + val, 0)}%
                </span>
              </div>

              {errorDistribucion && (
                <p className="mt-2 text-red-600 text-sm">{errorDistribucion}</p>
              )}
            </div>
          )}

          {/* ✅ NUEVO: Sección de Mensajes Adicionales */}
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-2 mb-4">
              <MessageSquare className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Mensajes Adicionales del Día (Opcional)</h4>
                <p className="text-sm text-green-700">
                  Ya tienes <span className="font-semibold">{totalMensajes} mensajes</span> del check-in.
                  Si recibiste más mensajes durante el día, agrégalos aquí.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Meta */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Meta/Facebook
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={mensajesAdicionales.meta}
                  onChange={(e) => handleMensajeAdicionalChange('meta', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0"
                  disabled={loading}
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  WhatsApp
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={mensajesAdicionales.whatsapp}
                  onChange={(e) => handleMensajeAdicionalChange('whatsapp', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0"
                  disabled={loading}
                />
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Instagram
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={mensajesAdicionales.instagram}
                  onChange={(e) => handleMensajeAdicionalChange('instagram', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0"
                  disabled={loading}
                />
              </div>

              {/* TikTok */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  TikTok
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={mensajesAdicionales.tiktok}
                  onChange={(e) => handleMensajeAdicionalChange('tiktok', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Total de mensajes adicionales */}
            {Object.values(mensajesAdicionales).reduce((sum, val) => sum + val, 0) > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-900 font-medium">Mensajes adicionales:</span>
                  <span className="text-green-700 font-bold">
                    +{Object.values(mensajesAdicionales).reduce((sum, val) => sum + val, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-green-900 font-medium">Total del día:</span>
                  <span className="text-green-700 font-bold">
                    {totalMensajes + Object.values(mensajesAdicionales).reduce((sum, val) => sum + val, 0)}
                  </span>
                </div>
              </div>
            )}
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