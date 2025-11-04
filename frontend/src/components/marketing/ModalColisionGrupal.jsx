// ============================================
// MODAL DE COLISIÓN GRUPAL
// Muestra conflictos de horarios en actividades grupales
// ============================================

import { createPortal } from 'react-dom';

const ModalColisionGrupal = ({ isOpen, colision, onClose, onSeleccionarHorario, formData }) => {
    if (!isOpen || !colision) return null;

    const formatearFecha = (fecha) => {
        return new Date(fecha).toLocaleString('es-PE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatearHora = (fecha) => {
        return new Date(fecha).toLocaleString('es-PE', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10003] p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-red-50 p-6 border-b border-red-200">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 bg-red-100 text-red-600 rounded-full p-3">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                                ⚠️ Conflicto de Horarios Detectado
                            </h3>
                            <p className="text-red-700 text-sm">
                                {colision.mensaje}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-6 space-y-6">
                    {/* Actividad que intentas crear */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                            Actividad Grupal que intentas crear:
                        </p>
                        <p className="text-gray-900 font-medium">{formData.descripcion}</p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                            <span>📅 {formatearFecha(formData.fecha_inicio)}</span>
                            <span>⏱️ {formData.duracion_minutos} minutos</span>
                            <span>👥 {formData.participantes_ids?.length || 0} participantes</span>
                        </div>
                    </div>

                    {/* Conflictos detectados */}
                    {colision.conflictos && colision.conflictos.length > 0 && (
                        <div>
                            <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Participantes con Conflictos ({colision.conflictos.length}):
                            </h4>
                            <div className="space-y-3">
                                {colision.conflictos.map((conflicto, index) => (
                                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-semibold">
                                                    {conflicto.usuario?.nombre_completo || 'Usuario'}
                                                </div>
                                                {conflicto.tipo === 'prioritaria' && (
                                                    <span className="bg-yellow-100 text-yellow-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                        ⚡ Prioritaria
                                                    </span>
                                                )}
                                                {conflicto.tipo === 'grupal' && (
                                                    <span className="bg-purple-100 text-purple-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                        👥 Grupal
                                                    </span>
                                                )}
                                            </div>
                                            {conflicto.bloqueante && (
                                                <span className="bg-red-600 text-white rounded-full px-2 py-1 text-xs font-bold">
                                                    Bloqueante
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-900 font-medium mb-1">
                                            {conflicto.actividad.descripcion}
                                        </p>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <span>🕐 {formatearHora(conflicto.actividad.fecha_inicio)} - {formatearHora(conflicto.actividad.fecha_fin)}</span>
                                            <span className="text-xs text-gray-500">
                                                {conflicto.actividad.codigo}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mensaje de acción */}
                    {colision.mensaje_accion && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800 flex items-start gap-2">
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">{colision.mensaje_accion}</span>
                            </p>
                        </div>
                    )}

                    {/* Sugerencias de horarios alternativos */}
                    {colision.sugerencias && (colision.sugerencias.previo || colision.sugerencias.posterior) && (
                        <div>
                            <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                Horarios Alternativos Disponibles:
                            </h4>
                            <div className="space-y-2">
                                {colision.sugerencias.previo && (
                                    <button
                                        onClick={() => onSeleccionarHorario(colision.sugerencias.previo.fecha_inicio)}
                                        className="w-full p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 rounded-lg text-left transition group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-green-900 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
                                                </svg>
                                                Opción A: Horario Anterior
                                            </span>
                                            <svg className="w-5 h-5 text-green-600 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <p className="text-green-800 font-medium">
                                            📅 {formatearFecha(colision.sugerencias.previo.fecha_inicio)}
                                        </p>
                                        <p className="text-xs text-green-600 mt-1">
                                            ✓ {colision.sugerencias.previo.hueco_disponible_minutos} minutos disponibles
                                        </p>
                                    </button>
                                )}
                                {colision.sugerencias.posterior && (
                                    <button
                                        onClick={() => onSeleccionarHorario(colision.sugerencias.posterior.fecha_inicio)}
                                        className="w-full p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-400 rounded-lg text-left transition group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                                                </svg>
                                                Opción B: Horario Posterior
                                            </span>
                                            <svg className="w-5 h-5 text-blue-600 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <p className="text-blue-800 font-medium">
                                            📅 {formatearFecha(colision.sugerencias.posterior.fecha_inicio)}
                                        </p>
                                        <p className="text-xs text-blue-600 mt-1">
                                            ✓ {colision.sugerencias.posterior.hueco_disponible_minutos} minutos disponibles
                                        </p>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Si no hay sugerencias */}
                    {(!colision.sugerencias || (!colision.sugerencias.previo && !colision.sugerencias.posterior)) && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <p className="text-sm text-orange-800 flex items-start gap-2">
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>
                                    No hay horarios alternativos disponibles en el mismo día.
                                    Intenta elegir otro día o ajustar la duración de la actividad.
                                </span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalColisionGrupal;
