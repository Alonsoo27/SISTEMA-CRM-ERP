// ============================================
// MODAL CHECK-OUT PENDIENTE - COMPONENTE FORZOSO
// Modal que no se puede cerrar hasta completar check-out de días anteriores
// ============================================

import React, { useState } from 'react';
import { AlertTriangle, Clock, Calendar, X } from 'lucide-react';

const ModalCheckOutPendiente = ({ jornadaPendiente, onComplete, onCancel }) => {
    const [formData, setFormData] = useState({
        hora_salida: '',
        llamadas_realizadas: 0,
        llamadas_recibidas: 0,
        notas_check_out: '',
        motivo_tardanza: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!jornadaPendiente || !jornadaPendiente.tiene_pendiente) {
        return null;
    }

    const formatearFecha = (fecha) => {
        return new Date(fecha).toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatearHora = (fechaHora) => {
        return new Date(fechaHora).toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Lima'
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validaciones
            if (!formData.hora_salida) {
                throw new Error('Debe ingresar la hora de salida');
            }

            if (!formData.motivo_tardanza || formData.motivo_tardanza.trim().length < 10) {
                throw new Error('Debe explicar el motivo del check-out tardío (mínimo 10 caracteres)');
            }

            // Llamar a la función de callback con los datos
            await onComplete({
                fecha_pendiente: jornadaPendiente.fecha,
                ...formData
            });

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header - NO tiene botón de cerrar porque es forzoso */}
                <div className="bg-orange-600 text-white px-6 py-4 rounded-t-lg">
                    <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-8 w-8" />
                        <div>
                            <h2 className="text-xl font-bold">Check-out Pendiente</h2>
                            <p className="text-sm text-orange-100">
                                Debe completar el check-out del día {formatearFecha(jornadaPendiente.fecha)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Información de la jornada pendiente */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-yellow-600" />
                            Jornada Pendiente
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Fecha:</span>
                                <p className="font-semibold">{formatearFecha(jornadaPendiente.fecha)}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Check-in:</span>
                                <p className="font-semibold">{formatearHora(jornadaPendiente.check_in_time)}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Días atrasados:</span>
                                <p className="font-semibold text-orange-600">{jornadaPendiente.dias_atrasados} día(s)</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Actividad:</span>
                                <p className="font-semibold">
                                    {jornadaPendiente.total_mensajes} mensajes, {jornadaPendiente.total_llamadas} llamadas
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Formulario */}
                    <div className="space-y-4">
                        {/* Hora de salida */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Clock className="inline h-4 w-4 mr-1" />
                                ¿A qué hora salió ese día? *
                            </label>
                            <input
                                type="time"
                                name="hora_salida"
                                value={formData.hora_salida}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Ejemplo: 17:30 para 5:30 PM
                            </p>
                        </div>

                        {/* Llamadas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Llamadas Realizadas
                                </label>
                                <input
                                    type="number"
                                    name="llamadas_realizadas"
                                    value={formData.llamadas_realizadas}
                                    onChange={handleChange}
                                    min="0"
                                    max="200"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Llamadas Recibidas
                                </label>
                                <input
                                    type="number"
                                    name="llamadas_recibidas"
                                    value={formData.llamadas_recibidas}
                                    onChange={handleChange}
                                    min="0"
                                    max="200"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                            </div>
                        </div>

                        {/* Motivo de tardanza */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Motivo del check-out tardío *
                            </label>
                            <textarea
                                name="motivo_tardanza"
                                value={formData.motivo_tardanza}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Explique por qué no realizó el check-out a tiempo (mínimo 10 caracteres)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                                required
                                minLength="10"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.motivo_tardanza.length}/500 caracteres
                            </p>
                        </div>

                        {/* Notas adicionales */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Notas adicionales (opcional)
                            </label>
                            <textarea
                                name="notas_check_out"
                                value={formData.notas_check_out}
                                onChange={handleChange}
                                rows="2"
                                placeholder="Agregue cualquier nota adicional sobre ese día..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                                maxLength="1000"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Advertencia */}
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Importante:</strong> Este check-out será marcado como "retroactivo" en el sistema.
                            Es su responsabilidad proporcionar información precisa.
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                                loading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-orange-600 hover:bg-orange-700'
                            }`}
                        >
                            {loading ? 'Procesando...' : 'Completar Check-out'}
                        </button>
                    </div>

                    {/* Nota: NO hay botón de cancelar porque es FORZOSO */}
                    <p className="text-xs text-gray-500 text-center mt-4">
                        * Debe completar este check-out para continuar usando el sistema
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ModalCheckOutPendiente;
