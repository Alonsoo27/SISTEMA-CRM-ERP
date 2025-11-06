// ============================================
// MODAL COMPLETAR ACTIVIDAD
// Confirmación profesional para marcar como completada
// ============================================

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ModalConfirmarCompletarGrupal from './ModalConfirmarCompletarGrupal';

const ModalCompletarActividad = ({ actividad, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [mostrarModalGrupal, setMostrarModalGrupal] = useState(false);

    const handleConfirmar = async () => {
        // Verificar si es actividad grupal
        if (actividad?.es_grupal === true) {
            setMostrarModalGrupal(true);
            return;
        }

        // Si no es grupal, completar directamente
        setLoading(true);
        try {
            await onSuccess(false); // false = no completar todos
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarGrupal = async (completarTodos) => {
        setMostrarModalGrupal(false);
        setLoading(true);
        try {
            await onSuccess(completarTodos);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatearFecha = (fecha) => {
        return format(new Date(fecha), "dd/MM/yyyy HH:mm", { locale: es });
    };

    const calcularDuracion = () => {
        const horas = Math.floor(actividad.duracion_planeada_minutos / 60);
        const minutos = actividad.duracion_planeada_minutos % 60;
        return `${horas}h ${minutos}min`;
    };

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
                <div className="p-6 border-b border-gray-200 bg-green-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-green-900 mb-1">
                                ✓ Completar Actividad
                            </h2>
                            <p className="text-sm text-green-700">
                                ¿Confirmas que esta actividad ha sido completada?
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
                <div className="p-6 space-y-4">
                    {/* Info de actividad */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 mb-2">Actividad</div>
                        <div className="font-semibold text-gray-900 mb-1">{actividad.codigo}</div>
                        <div className="text-sm text-gray-700 mb-3">{actividad.descripcion}</div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-xs text-gray-500">Categoría</div>
                                <div className="font-medium text-gray-900">
                                    {actividad.categoria_principal}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Duración</div>
                                <div className="font-medium text-gray-900">
                                    {calcularDuracion()}
                                </div>
                            </div>
                        </div>

                        {actividad.fecha_inicio_planeada && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">Horario planeado</div>
                                <div className="text-sm text-gray-700">
                                    {formatearFecha(actividad.fecha_inicio_planeada)} - {formatearFecha(actividad.fecha_fin_planeada)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mensaje informativo */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                            <span className="text-blue-600 text-lg">ℹ️</span>
                            <div className="text-xs text-blue-800">
                                <div className="font-semibold mb-1">Al marcar como completada:</div>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Se registrará la fecha y hora actual como finalización</li>
                                    <li>Se calculará la duración real de la actividad</li>
                                    <li>No podrás modificarla posteriormente</li>
                                </ul>
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
                        type="button"
                        onClick={handleConfirmar}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        ✓ Sí, Completar
                    </button>
                </div>
            </div>

            {/* Modal de Confirmación Grupal */}
            {mostrarModalGrupal && (
                <ModalConfirmarCompletarGrupal
                    actividad={actividad}
                    onConfirm={handleConfirmarGrupal}
                    onCancel={() => setMostrarModalGrupal(false)}
                />
            )}
        </div>,
        document.body
    );
};

export default ModalCompletarActividad;
