// ============================================
// MODAL EDITAR ACTIVIDAD
// ============================================

import { useState } from 'react';
import ModalNotificacion from '../common/ModalNotificacion';

const ModalEditarActividad = ({ actividad, onClose, onSuccess }) => {
    // Calcular si se puede editar fecha_inicio (regla de 5 minutos)
    const puedeEditarFechaInicio = (() => {
        if (actividad.estado !== 'en_progreso') return true;
        if (!actividad.fecha_inicio_real) return true;

        const ahora = new Date();
        const inicioReal = new Date(actividad.fecha_inicio_real);
        const minutosDesdeInicio = (ahora - inicioReal) / 60000;

        return minutosDesdeInicio <= 5;
    })();

    const [formData, setFormData] = useState({
        duracion_minutos: actividad.duracion_planeada_minutos,
        fecha_inicio: new Date(actividad.fecha_inicio_planeada).toISOString().slice(0, 16),
        fecha_inicio_original: new Date(actividad.fecha_inicio_planeada).toISOString().slice(0, 16),
        motivo_edicion: ''
    });
    const [loading, setLoading] = useState(false);
    const [notificacion, setNotificacion] = useState({ isOpen: false, tipo: 'info', titulo: '', mensaje: '' });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.motivo_edicion.trim()) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Campo obligatorio',
                mensaje: 'El motivo de edición es obligatorio. Por favor, explica por qué estás editando esta actividad.'
            });
            return;
        }

        setLoading(true);
        try {
            const datos = {
                duracion_minutos: parseInt(formData.duracion_minutos),
                motivo_edicion: formData.motivo_edicion
            };

            // Solo enviar fecha_inicio si realmente cambió (evita bug de timezone)
            if (formData.fecha_inicio !== formData.fecha_inicio_original) {
                datos.fecha_inicio = formData.fecha_inicio;
            }

            await onSuccess(datos);
        } catch (error) {
            console.error('Error editando actividad:', error);
            setNotificacion({
                isOpen: true,
                tipo: 'danger',
                titulo: 'Error al editar',
                mensaje: error.response?.data?.message || error.message || 'No se pudo editar la actividad'
            });
        } finally {
            setLoading(false);
        }
    };

    const duracionHoras = Math.floor(formData.duracion_minutos / 60);
    const duracionMinutos = formData.duracion_minutos % 60;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">
                        ✏️ Editar Actividad
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Información de la actividad */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-xs text-blue-600 font-medium mb-1">Editando</div>
                        <div className="text-sm font-bold text-blue-900">{actividad.descripcion}</div>
                        <div className="text-xs text-blue-700 mt-1">{actividad.codigo}</div>
                    </div>

                    {/* Duración */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nueva duración (minutos) *
                        </label>
                        <input
                            type="number"
                            name="duracion_minutos"
                            value={formData.duracion_minutos}
                            onChange={handleChange}
                            min="15"
                            step="15"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            Equivale a: {duracionHoras}h {duracionMinutos}min
                        </p>
                        <div className="mt-2 flex gap-2">
                            {[30, 60, 120, 180, 240].map(mins => (
                                <button
                                    key={mins}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, duracion_minutos: mins }))}
                                    className={`px-3 py-1 text-xs rounded ${
                                        formData.duracion_minutos === mins
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {mins >= 60 ? `${mins / 60}h` : `${mins}min`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fecha de inicio */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nueva fecha/hora de inicio *
                        </label>
                        <input
                            type="datetime-local"
                            name="fecha_inicio"
                            value={formData.fecha_inicio}
                            onChange={handleChange}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                !puedeEditarFechaInicio
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-300'
                            }`}
                            disabled={!puedeEditarFechaInicio}
                            required
                        />
                        {!puedeEditarFechaInicio && (
                            <p className="mt-1 text-xs text-orange-600">
                                ⚠️ La actividad lleva más de 5 minutos en progreso. Solo puedes editar la duración.
                            </p>
                        )}
                    </div>

                    {/* Motivo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Motivo de la edición *
                        </label>
                        <textarea
                            name="motivo_edicion"
                            value={formData.motivo_edicion}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Explica por qué estás editando esta actividad..."
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            ⚠️ Este motivo quedará registrado en el historial
                        </p>
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Guardando...
                                </>
                            ) : (
                                '✓ Guardar Cambios'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Modal de Notificación */}
            <ModalNotificacion
                isOpen={notificacion.isOpen}
                onClose={() => setNotificacion({ ...notificacion, isOpen: false })}
                tipo={notificacion.tipo}
                titulo={notificacion.titulo}
                mensaje={notificacion.mensaje}
            />
        </div>
    );
};

export default ModalEditarActividad;
