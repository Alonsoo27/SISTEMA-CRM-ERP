// ============================================
// MODAL CONFIRMAR COMPLETAR ACTIVIDAD GRUPAL
// Pregunta si completar solo para usuario actual o para todos
// ============================================

import { createPortal } from 'react-dom';
import { Users, User } from 'lucide-react';

const ModalConfirmarCompletarGrupal = ({ actividad, onConfirm, onCancel }) => {
    const participantesCount = actividad?.participantes_ids?.length || 0;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[10002]">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Actividad Grupal
                            </h2>
                            <p className="text-sm text-gray-600">
                                {participantesCount} participante{participantesCount !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Info de la actividad */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Actividad</div>
                        <div className="font-semibold text-gray-900 mb-1">
                            {actividad?.codigo}
                        </div>
                        <div className="text-sm text-gray-700">
                            {actividad?.descripcion}
                        </div>
                    </div>

                    {/* Pregunta principal */}
                    <div>
                        <div className="text-center mb-4">
                            <p className="text-lg font-semibold text-gray-900 mb-2">
                                ¿Para quién deseas completar esta actividad?
                            </p>
                            <p className="text-sm text-gray-600">
                                Como es una actividad grupal, puedes elegir si completarla solo para ti o para todos los participantes
                            </p>
                        </div>

                        {/* Opciones */}
                        <div className="space-y-3">
                            {/* Opción: Solo para mí */}
                            <button
                                onClick={() => onConfirm(false)}
                                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                                        <User className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 mb-1">
                                            Solo para mí
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Marcar solo mi actividad como completada. Los demás participantes deberán completar la suya individualmente.
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* Opción: Para todos */}
                            <button
                                onClick={() => onConfirm(true)}
                                className="w-full p-4 border-2 border-blue-300 bg-blue-50 rounded-lg hover:border-blue-500 hover:bg-blue-100 transition-all text-left group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                        <Users className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                            Para todos los participantes
                                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                                Recomendado
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            Marcar la actividad como completada para los {participantesCount} participantes. Útil cuando la actividad se realizó en conjunto.
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Info adicional */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <div className="text-amber-600 mt-0.5">💡</div>
                            <div className="text-xs text-amber-800">
                                <strong>Tip:</strong> Si fue una reunión o actividad realizada en conjunto, selecciona "Para todos". Si cada participante tiene tareas individuales pendientes, selecciona "Solo para mí".
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalConfirmarCompletarGrupal;
