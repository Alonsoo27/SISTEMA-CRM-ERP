// frontend/src/components/prospectos/ModalCompletarConReprogramacion.jsx
import React, { useState } from 'react';
import {
  X, CheckCircle, Calendar, Plus, Trash2, AlertCircle, Save, Clock, Phone, Mail,
  MessageSquare, MapPin, User, Lightbulb
} from 'lucide-react';

/**
 * Modal profesional para completar seguimiento y reprogramar múltiples seguimientos
 * Elimina la necesidad de "posponer" - todo se hace mediante reprogramación
 */
const ModalCompletarConReprogramacion = ({
  isOpen,
  seguimiento,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    resultado: '',
    notas: '',
    calificacion: null
  });

  const [seguimientosFuturos, setSeguimientosFuturos] = useState([]);
  const [errors, setErrors] = useState({});

  // Opciones de resultado
  const resultadosOpciones = [
    {
      value: 'interesado',
      label: 'Cliente Interesado',
      descripcion: 'Requiere seguimiento(s) adicional(es)',
      color: 'green',
      requiereSeguimiento: true,
      calificacion: 5
    },
    {
      value: 'no_interesado',
      label: 'Cliente No Interesado',
      descripcion: 'Descartar prospecto',
      color: 'red',
      requiereSeguimiento: false,
      calificacion: 1
    },
    {
      value: 'no_respondio',
      label: 'Cliente No Respondió',
      descripcion: 'Intentar contactar nuevamente',
      color: 'yellow',
      requiereSeguimiento: true,
      calificacion: 3
    }
  ];

  // Tipos de seguimiento
  const tiposSeguimiento = [
    { value: 'Llamada', label: 'Llamada', icon: Phone, color: 'blue' },
    { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare, color: 'green' },
    { value: 'Email', label: 'Email', icon: Mail, color: 'purple' },
    { value: 'Visita', label: 'Visita Presencial', icon: MapPin, color: 'orange' },
    { value: 'Reunion', label: 'Reunión', icon: User, color: 'indigo' }
  ];

  // Validar horario laboral
  const esHorarioLaboral = (fecha) => {
    const date = new Date(fecha);
    const dia = date.getDay(); // 0 = Domingo
    const hora = date.getHours();

    // Lunes a Viernes: 8am-6pm
    if (dia >= 1 && dia <= 5) {
      return hora >= 8 && hora < 18;
    }
    // Sábado: 9am-12pm
    if (dia === 6) {
      return hora >= 9 && hora < 12;
    }
    // Domingo: Cerrado
    return false;
  };

  // Calcular fecha sugerida según tipo de seguimiento
  const calcularFechaSugerida = (tipo) => {
    const ahora = new Date();
    let fechaSugerida = new Date(ahora);

    // Reglas según tipo de seguimiento (similar al helper backend)
    const reglas = {
      'Llamada': { horas: 4 },
      'WhatsApp': { dias: 1 },
      'Email': { dias: 2 },
      'Visita': { horas: 2 },
      'Reunion': { horas: 2 }
    };

    const regla = reglas[tipo] || { dias: 1 }; // Default 1 día

    // Aplicar la regla
    if (regla.dias) {
      fechaSugerida.setDate(fechaSugerida.getDate() + regla.dias);
    }
    if (regla.horas) {
      fechaSugerida.setHours(fechaSugerida.getHours() + regla.horas);
    }

    // Ajustar a horario laboral si es necesario
    fechaSugerida = ajustarAHorarioLaboral(fechaSugerida);

    return fechaSugerida.toISOString().slice(0, 16);
  };

  // Ajustar fecha al próximo horario laboral disponible
  const ajustarAHorarioLaboral = (fecha) => {
    const dia = fecha.getDay();
    const hora = fecha.getHours();

    // Domingo → Mover a Lunes 8am
    if (dia === 0) {
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(8, 0, 0, 0);
      return fecha;
    }

    // Sábado después de 12pm → Mover a Lunes 8am
    if (dia === 6 && hora >= 12) {
      fecha.setDate(fecha.getDate() + 2);
      fecha.setHours(8, 0, 0, 0);
      return fecha;
    }

    // Sábado antes de 9am → Ajustar a 9am
    if (dia === 6 && hora < 9) {
      fecha.setHours(9, 0, 0, 0);
      return fecha;
    }

    // L-V antes de 8am → Ajustar a 8am mismo día
    if (dia >= 1 && dia <= 5 && hora < 8) {
      fecha.setHours(8, 0, 0, 0);
      return fecha;
    }

    // L-V después de 6pm → Mover a siguiente día 8am
    if (dia >= 1 && dia <= 5 && hora >= 18) {
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(8, 0, 0, 0);
      // Si siguiente día es domingo
      if (fecha.getDay() === 0) {
        fecha.setDate(fecha.getDate() + 1); // Lunes
      }
      // Si es sábado
      if (fecha.getDay() === 6) {
        fecha.setHours(9, 0, 0, 0);
      }
      return fecha;
    }

    // Ya está en horario laboral
    return fecha;
  };

  // Aplicar fecha sugerida a un seguimiento
  const aplicarFechaSugerida = (seguimientoId, tipo) => {
    const fechaSugerida = calcularFechaSugerida(tipo);
    actualizarSeguimiento(seguimientoId, 'fecha_programada', fechaSugerida);
  };

  // Agregar nuevo seguimiento
  const agregarSeguimiento = () => {
    const ahora = new Date();
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(10, 0, 0, 0);

    setSeguimientosFuturos([
      ...seguimientosFuturos,
      {
        id: Date.now(),
        tipo: 'Llamada',
        fecha_programada: manana.toISOString().slice(0, 16),
        notas: ''
      }
    ]);
  };

  // Eliminar seguimiento
  const eliminarSeguimiento = (id) => {
    setSeguimientosFuturos(seguimientosFuturos.filter(s => s.id !== id));
  };

  // Actualizar seguimiento
  const actualizarSeguimiento = (id, campo, valor) => {
    setSeguimientosFuturos(seguimientosFuturos.map(s =>
      s.id === id ? { ...s, [campo]: valor } : s
    ));
  };

  // Manejar cambio de resultado
  const handleResultadoChange = (valor) => {
    const opcion = resultadosOpciones.find(o => o.value === valor);

    setFormData({
      ...formData,
      resultado: valor,
      calificacion: opcion?.calificacion || null
    });

    // Si el resultado requiere seguimiento y no hay seguimientos agregados, agregar uno automáticamente
    if (opcion?.requiereSeguimiento && seguimientosFuturos.length === 0) {
      agregarSeguimiento();
    }

    // Limpiar error
    if (errors.resultado) {
      setErrors(prev => ({ ...prev, resultado: null }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    // Validar resultado
    if (!formData.resultado) {
      newErrors.resultado = 'Debes seleccionar un resultado';
    }

    // Validar notas
    if (!formData.notas || formData.notas.trim().length < 10) {
      newErrors.notas = 'Las notas deben tener al menos 10 caracteres';
    }

    // Validar seguimientos futuros si se requieren
    const opcion = resultadosOpciones.find(o => o.value === formData.resultado);
    if (opcion?.requiereSeguimiento && seguimientosFuturos.length === 0) {
      newErrors.seguimientos = 'Debes programar al menos un seguimiento';
    }

    // Validar cada seguimiento
    seguimientosFuturos.forEach((seg, index) => {
      if (!seg.tipo) {
        newErrors[`seg_tipo_${seg.id}`] = 'Tipo requerido';
      }
      if (!seg.fecha_programada) {
        newErrors[`seg_fecha_${seg.id}`] = 'Fecha requerida';
      } else {
        // Validar que sea fecha futura
        const fechaSeg = new Date(seg.fecha_programada);
        if (fechaSeg <= new Date()) {
          newErrors[`seg_fecha_${seg.id}`] = 'La fecha debe ser futura';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Preparar datos para enviar
    const payload = {
      seguimiento_id: seguimiento.id,
      resultado: formData.resultado,
      notas: formData.notas,
      calificacion: formData.calificacion,
      seguimientos_futuros: seguimientosFuturos.length > 0 ? seguimientosFuturos.map(s => ({
        tipo: s.tipo,
        fecha_programada: s.fecha_programada,
        notas: s.notas || `Seguimiento ${s.tipo} programado`
      })) : []
    };

    onSubmit(payload);
  };

  if (!isOpen) return null;

  const opcionSeleccionada = resultadosOpciones.find(o => o.value === formData.resultado);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Completar Seguimiento
              </h3>
              <p className="text-sm text-gray-600">
                {seguimiento?.nombre_cliente || seguimiento?.prospecto_nombre} • {seguimiento?.tipo}
              </p>
            </div>
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

          {/* Información del seguimiento actual */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">Información del Seguimiento</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Cliente:</strong> {seguimiento?.nombre_cliente || seguimiento?.prospecto_nombre}</p>
                  <p><strong>Teléfono:</strong> {seguimiento?.telefono || 'No especificado'}</p>
                  <p><strong>Tipo:</strong> {seguimiento?.tipo}</p>
                  <p><strong>Programado:</strong> {seguimiento?.fecha_programada ? new Date(seguimiento.fecha_programada).toLocaleString('es-PE') : 'N/A'}</p>
                  {seguimiento?.vencido && (
                    <p className="text-red-600 font-semibold">⚠️ Vencido</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PASO 1: Resultado del contacto */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              PASO 1: ¿Qué resultado obtuviste? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {resultadosOpciones.map((opcion) => (
                <label
                  key={opcion.value}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.resultado === opcion.value
                      ? `border-${opcion.color}-500 bg-${opcion.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value={opcion.value}
                    checked={formData.resultado === opcion.value}
                    onChange={(e) => handleResultadoChange(e.target.value)}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{opcion.label}</div>
                    <div className="text-sm text-gray-600">{opcion.descripcion}</div>
                    {opcion.requiereSeguimiento && (
                      <div className="mt-1 text-xs text-blue-600">
                        📅 Requiere programar seguimiento(s)
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {errors.resultado && (
              <p className="text-red-600 text-sm mt-2">{errors.resultado}</p>
            )}
          </div>

          {/* Notas del contacto */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas del contacto <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={4}
              maxLength={1000}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                errors.notas ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe lo que hablaste con el cliente, sus necesidades, objeciones, próximos pasos, etc."
              disabled={loading}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.notas && (
                <p className="text-red-600 text-xs">{errors.notas}</p>
              )}
              <p className="text-gray-500 text-xs ml-auto">
                {formData.notas.length}/1000
              </p>
            </div>
          </div>

          {/* PASO 2: Programar seguimientos futuros */}
          {opcionSeleccionada?.requiereSeguimiento && (
            <div className="mb-6 border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <span>PASO 2: Programar Seguimientos Futuros</span>
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Programa uno o más seguimientos según lo acordado con el cliente
                  </p>
                </div>
                <button
                  type="button"
                  onClick={agregarSeguimiento}
                  className="flex items-center px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </button>
              </div>

              {errors.seguimientos && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {errors.seguimientos}
                </div>
              )}

              {/* Lista de seguimientos */}
              <div className="space-y-4">
                {seguimientosFuturos.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">
                      No hay seguimientos programados
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Haz clic en "Agregar" para programar un seguimiento
                    </p>
                  </div>
                ) : (
                  seguimientosFuturos.map((seg, index) => {
                    const TipoIcon = tiposSeguimiento.find(t => t.value === seg.tipo)?.icon || Phone;
                    const enHorarioLaboral = seg.fecha_programada ? esHorarioLaboral(seg.fecha_programada) : true;

                    return (
                      <div key={seg.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-purple-100 rounded">
                              <TipoIcon className="h-4 w-4 text-purple-600" />
                            </div>
                            <span className="font-medium text-gray-900">
                              Seguimiento #{index + 1}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => eliminarSeguimiento(seg.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Tipo */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Tipo de Seguimiento
                            </label>
                            <select
                              value={seg.tipo}
                              onChange={(e) => actualizarSeguimiento(seg.id, 'tipo', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-md text-sm ${
                                errors[`seg_tipo_${seg.id}`] ? 'border-red-300' : 'border-gray-300'
                              }`}
                              disabled={loading}
                            >
                              {tiposSeguimiento.map((tipo) => (
                                <option key={tipo.value} value={tipo.value}>
                                  {tipo.label}
                                </option>
                              ))}
                            </select>
                            {errors[`seg_tipo_${seg.id}`] && (
                              <p className="text-red-600 text-xs mt-1">{errors[`seg_tipo_${seg.id}`]}</p>
                            )}
                          </div>

                          {/* Fecha y hora */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Fecha y Hora
                            </label>
                            <input
                              type="datetime-local"
                              value={seg.fecha_programada}
                              onChange={(e) => actualizarSeguimiento(seg.id, 'fecha_programada', e.target.value)}
                              min={new Date().toISOString().slice(0, 16)}
                              className={`w-full px-3 py-2 border rounded-md text-sm ${
                                errors[`seg_fecha_${seg.id}`] ? 'border-red-300' : 'border-gray-300'
                              }`}
                              disabled={loading}
                            />
                            <button
                              type="button"
                              onClick={() => aplicarFechaSugerida(seg.id, seg.tipo)}
                              className="mt-2 flex items-center text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              disabled={loading}
                            >
                              <Lightbulb className="h-3 w-3 mr-1" />
                              Calcular fecha sugerida según tipo
                            </button>
                            {errors[`seg_fecha_${seg.id}`] && (
                              <p className="text-red-600 text-xs mt-1">{errors[`seg_fecha_${seg.id}`]}</p>
                            )}
                            {!enHorarioLaboral && seg.fecha_programada && (
                              <p className="text-orange-600 text-xs mt-1 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Fuera de horario laboral (L-V 8am-6pm, Sáb 9am-12pm)
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Notas del seguimiento */}
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Notas / Recordatorio (opcional)
                          </label>
                          <textarea
                            value={seg.notas}
                            onChange={(e) => actualizarSeguimiento(seg.id, 'notas', e.target.value)}
                            rows={2}
                            maxLength={200}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                            placeholder="Ej: Enviar cotización actualizada, Confirmar disponibilidad, etc."
                            disabled={loading}
                          />
                          <p className="text-gray-500 text-xs mt-1">
                            {seg.notas?.length || 0}/200
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Info de horario laboral */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <div className="flex items-start">
                  <Clock className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Horario laboral recomendado:</p>
                    <p className="mt-1">Lunes a Viernes: 8:00 AM - 6:00 PM • Sábado: 9:00 AM - 12:00 PM • Domingo: Cerrado</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex space-x-3 mt-6 pt-6 border-t">
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
                  Completando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Completar {seguimientosFuturos.length > 0 && `y Programar (${seguimientosFuturos.length})`}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCompletarConReprogramacion;
