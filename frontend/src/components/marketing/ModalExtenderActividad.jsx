// ============================================
// MODAL EXTENDER ACTIVIDAD
// Permite agregar tiempo adicional a una actividad
// ============================================

import { useState } from 'react';
import { createPortal } from 'react-dom';
import ModalNotificacion from '../common/ModalNotificacion';

const ModalExtenderActividad = ({ actividad, onClose, onSuccess }) => {
    const [minutosAdicionales, setMinutosAdicionales] = useState('');
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);
    const [notificacion, setNotificacion] = useState({ isOpen: false, tipo: 'info', titulo: '', mensaje: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();

        const minutos = parseInt(minutosAdicionales);

        if (!minutos || minutos <= 0) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Valor inválido',
                mensaje: 'Debes ingresar una cantidad válida de minutos mayor a 0.'
            });
            return;
        }

        if (!motivo.trim()) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Campo obligatorio',
                mensaje: 'El motivo de la extensión es obligatorio. Por favor, explica por qué necesitas más tiempo.'
            });
            return;
        }

        setLoading(true);
        try {
            await onSuccess({ minutos, motivo });
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Sugerencias rápidas de tiempo
    const sugerencias = [15, 30, 60, 120];

    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10001]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-blue-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-blue-900 mb-1">
                                ⏱ Extender Tiempo
                            </h2>
                            <p className="text-sm text-blue-700">
                                {actividad.codigo} - {actividad.descripcion}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-6">
                        {/* Duración actual */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-600 mb-1">Duración planeada actual</div>
                            <div className="text-2xl font-bold text-gray-900">
                                {Math.floor(actividad.duracion_planeada_minutos / 60)}h{' '}
                                {actividad.duracion_planeada_minutos % 60}min
                            </div>
                            {actividad.tiempo_adicional_minutos > 0 && (
                                <div className="text-xs text-yellow-700 mt-1">
                                    (Ya incluye +{actividad.tiempo_adicional_minutos} min adicionales)
                                </div>
                            )}
                        </div>

                        {/* Minutos adicionales */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Minutos adicionales *
                            </label>
                            <input
                                type="number"
                                value={minutosAdicionales}
                                onChange={(e) => setMinutosAdicionales(e.target.value)}
                                placeholder="Ej: 30"
                                min="1"
                                max="480"
                                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={loading}
                                autoFocus
                            />

                            {/* Sugerencias rápidas */}
                            <div className="flex gap-2 mt-3">
                                <span className="text-xs text-gray-600 pt-2">Rápido:</span>
                                {sugerencias.map((mins) => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => setMinutosAdicionales(mins.toString())}
                                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                                        disabled={loading}
                                    >
                                        +{mins} min
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview de nueva duración */}
                        {minutosAdicionales && parseInt(minutosAdicionales) > 0 && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <div className="text-xs text-green-700 mb-1">Nueva duración total</div>
                                <div className="text-xl font-bold text-green-900">
                                    {Math.floor((actividad.duracion_planeada_minutos + parseInt(minutosAdicionales)) / 60)}h{' '}
                                    {(actividad.duracion_planeada_minutos + parseInt(minutosAdicionales)) % 60}min
                                </div>
                                <div className="text-xs text-green-700 mt-1">
                                    (+{minutosAdicionales} minutos adicionales)
                                </div>
                            </div>
                        )}

                        {/* Motivo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Motivo de la extensión *
                            </label>
                            <textarea
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder="Explica por qué necesitas más tiempo para esta actividad..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                                disabled={loading}
                            />
                        </div>

                        {/* Advertencia */}
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <div className="flex items-start gap-2">
                                <span className="text-yellow-600 text-lg">⚠️</span>
                                <div className="text-xs text-yellow-800">
                                    <div className="font-semibold mb-1">Las actividades posteriores se reajustarán</div>
                                    <div>Al extender esta actividad, todas las actividades programadas después se moverán automáticamente para evitar conflictos.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !minutosAdicionales || !motivo.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                            Extender Tiempo
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
        </div>,
        document.body
    );
};

export default ModalExtenderActividad;
