// ============================================
// MODAL EDITAR ACTIVIDAD
// ============================================

import { useState } from 'react';
import ModalNotificacion from '../common/ModalNotificacion';

const ModalEditarActividad = ({ actividad, onClose, onSuccess }) => {
    // Calcular tiempo transcurrido si está en progreso
    const tiempoTranscurrido = (() => {
        if (actividad.estado !== 'en_progreso' || !actividad.fecha_inicio_real) {
            return null;
        }

        const ahora = new Date();
        const inicioReal = new Date(actividad.fecha_inicio_real);
        const minutosTranscurridos = Math.floor((ahora - inicioReal) / 60000);

        return {
            minutos: minutosTranscurridos,
            horas: Math.floor(minutosTranscurridos / 60),
            minutosRestantes: minutosTranscurridos % 60,
            porcentaje: Math.min((minutosTranscurridos / actividad.duracion_planeada_minutos) * 100, 100)
        };
    })();

    // Calcular si se puede editar fecha_inicio (regla de 5 minutos)
    const puedeEditarFechaInicio = (() => {
        if (actividad.estado !== 'en_progreso') return true;
        if (!tiempoTranscurrido) return true;
        return tiempoTranscurrido.minutos <= 5;
    })();

    // Duración mínima permitida (el tiempo ya trabajado)
    const duracionMinima = tiempoTranscurrido ? tiempoTranscurrido.minutos : 15;

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

        // Validar duración mínima si está en progreso
        if (tiempoTranscurrido && parseInt(formData.duracion_minutos) < tiempoTranscurrido.minutos) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Duración inválida',
                mensaje: `La actividad ya lleva ${tiempoTranscurrido.horas}h ${tiempoTranscurrido.minutosRestantes}min en progreso. No puedes establecer una duración menor al tiempo ya trabajado.`
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

                    {/* Indicador de tiempo transcurrido (solo si está en progreso) */}
                    {tiempoTranscurrido && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-medium text-green-700">
                                    ⏱️ Actividad en Progreso
                                </div>
                                <div className="text-xs text-green-600">
                                    {Math.round(tiempoTranscurrido.porcentaje)}% completado
                                </div>
                            </div>

                            {/* Barra de progreso */}
                            <div className="w-full bg-green-200 rounded-full h-2 mb-3">
                                <div
                                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${tiempoTranscurrido.porcentaje}%` }}
                                ></div>
                            </div>

                            {/* Información de tiempo */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-white p-2 rounded border border-green-200">
                                    <div className="text-gray-500 mb-1">⏰ Tiempo Trabajado</div>
                                    <div className="text-green-700 font-bold text-base">
                                        {tiempoTranscurrido.horas}h {tiempoTranscurrido.minutosRestantes}min
                                    </div>
                                    <div className="text-gray-400 text-xs mt-1">
                                        ({tiempoTranscurrido.minutos} minutos)
                                    </div>
                                </div>
                                <div className="bg-white p-2 rounded border border-green-200">
                                    <div className="text-gray-500 mb-1">⏳ Tiempo Restante</div>
                                    <div className="text-blue-700 font-bold text-base">
                                        {Math.floor((actividad.duracion_planeada_minutos - tiempoTranscurrido.minutos) / 60)}h {(actividad.duracion_planeada_minutos - tiempoTranscurrido.minutos) % 60}min
                                    </div>
                                    <div className="text-gray-400 text-xs mt-1">
                                        ({actividad.duracion_planeada_minutos - tiempoTranscurrido.minutos} minutos)
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 text-xs text-green-700 bg-green-100 p-2 rounded">
                                💡 <strong>Mínimo:</strong> La nueva duración no puede ser menor a {tiempoTranscurrido.horas}h {tiempoTranscurrido.minutosRestantes}min (tiempo ya trabajado)
                            </div>
                        </div>
                    )}

                    {/* Duración */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nueva duración (minutos) *
                        </label>
                        <div className="flex gap-2 items-center">
                            {/* Botón -15 */}
                            <button
                                type="button"
                                onClick={() => {
                                    const nuevo = Math.max(duracionMinima, parseInt(formData.duracion_minutos) - 15);
                                    setFormData(prev => ({ ...prev, duracion_minutos: nuevo }));
                                }}
                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={parseInt(formData.duracion_minutos) - 15 < duracionMinima}
                                title="Reducir 15 minutos"
                            >
                                -15
                            </button>

                            {/* Input */}
                            <input
                                type="number"
                                name="duracion_minutos"
                                value={formData.duracion_minutos}
                                onChange={handleChange}
                                min={duracionMinima}
                                step="any"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />

                            {/* Botón +15 */}
                            <button
                                type="button"
                                onClick={() => {
                                    const nuevo = parseInt(formData.duracion_minutos) + 15;
                                    setFormData(prev => ({ ...prev, duracion_minutos: nuevo }));
                                }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition"
                                title="Agregar 15 minutos"
                            >
                                +15
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Equivale a: {duracionHoras}h {duracionMinutos}min
                            {tiempoTranscurrido && (
                                <span className="ml-2 text-orange-600">
                                    (Mínimo: {Math.floor(duracionMinima / 60)}h {duracionMinima % 60}min)
                                </span>
                            )}
                        </p>
                        <div className="mt-2 flex gap-2">
                            {[30, 60, 120, 180, 240].map(mins => {
                                const deshabilitado = tiempoTranscurrido && mins < tiempoTranscurrido.minutos;
                                return (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => !deshabilitado && setFormData(prev => ({ ...prev, duracion_minutos: mins }))}
                                        disabled={deshabilitado}
                                        className={`px-3 py-1 text-xs rounded ${
                                            deshabilitado
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed line-through'
                                                : formData.duracion_minutos === mins
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                        title={deshabilitado ? 'Menor al tiempo ya trabajado' : ''}
                                    >
                                        {mins >= 60 ? `${mins / 60}h` : `${mins}min`}
                                    </button>
                                );
                            })}
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
