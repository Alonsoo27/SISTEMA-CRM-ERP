// ============================================
// MODAL DETALLES DE ACTIVIDAD
// ============================================

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import marketingService from '../../services/marketingService';
import ModalEditarActividad from './ModalEditarActividad';
import ModalTransferirActividad from './ModalTransferirActividad';

const ModalDetallesActividad = ({ actividad, onClose, onActividadActualizada }) => {
    const [showModalEditar, setShowModalEditar] = useState(false);
    const [showModalTransferir, setShowModalTransferir] = useState(false);

    // Obtener usuario del localStorage
    const user = useMemo(() => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            return {
                id: userData.id,
                rol: userData.rol?.nombre || userData.rol
            };
        } catch (error) {
            return { id: null, rol: '' };
        }
    }, []);

    // Permisos
    const esMarketing = ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(user?.rol);
    const esJefeOSuperior = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(user?.rol);
    const puedeEditar = esMarketing && actividad.estado !== 'completada' && actividad.estado !== 'cancelada';
    const puedeTransferir = esJefeOSuperior && actividad.estado !== 'completada' && actividad.estado !== 'cancelada';

    if (!actividad) return null;

    // Handlers
    const handleEditarSubmit = async (datos) => {
        await marketingService.editarActividad(actividad.id, datos);
        alert('✅ Actividad editada exitosamente');
        setShowModalEditar(false);
        if (onActividadActualizada) onActividadActualizada();
        onClose();
    };

    const handleTransferirSubmit = async (datos) => {
        await marketingService.transferirActividad(datos);
        alert('✅ Actividad transferida exitosamente');
        setShowModalTransferir(false);
        if (onActividadActualizada) onActividadActualizada();
        onClose();
    };

    const formatearFecha = (fecha) => {
        return format(new Date(fecha), "dd/MM/yyyy HH:mm", { locale: es });
    };

    const formatearDuracion = (minutos) => {
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        return `${horas}h ${mins}min`;
    };

    const estadoBadges = {
        pendiente: { color: 'bg-gray-500', text: 'Pendiente', icon: '⏳' },
        en_progreso: { color: 'bg-blue-500', text: 'En Progreso', icon: '▶️' },
        completada: { color: 'bg-green-500', text: 'Completada', icon: '✓' },
        pausada: { color: 'bg-yellow-500', text: 'Pausada', icon: '⏸' },
        cancelada: { color: 'bg-red-500', text: 'Cancelada', icon: '✕' }
    };

    const badge = estadoBadges[actividad.estado] || estadoBadges.pendiente;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-6 border-b border-gray-200"
                    style={{
                        borderLeft: `8px solid ${actividad.color_hex}`,
                        background: `linear-gradient(to right, ${actividad.color_hex}10, transparent)`
                    }}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span
                                    className="text-xs font-bold px-3 py-1 rounded-full"
                                    style={{
                                        backgroundColor: `${actividad.color_hex}20`,
                                        color: actividad.color_hex
                                    }}
                                >
                                    {actividad.categoria_principal} › {actividad.subcategoria}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white ${badge.color}`}>
                                    {badge.icon} {badge.text}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                {actividad.descripcion}
                            </h2>
                            <p className="text-sm text-gray-500">
                                Código: {actividad.codigo}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl font-bold ml-4"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Horarios */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-xs text-blue-600 font-medium mb-1">Inicio Planeado</div>
                            <div className="text-lg font-bold text-blue-900">
                                {formatearFecha(actividad.fecha_inicio_planeada)}
                            </div>
                            {actividad.fecha_inicio_real && (
                                <>
                                    <div className="text-xs text-blue-600 font-medium mt-2 mb-1">Inicio Real</div>
                                    <div className="text-sm font-semibold text-blue-800">
                                        {formatearFecha(actividad.fecha_inicio_real)}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-xs text-green-600 font-medium mb-1">Fin Planeado</div>
                            <div className="text-lg font-bold text-green-900">
                                {formatearFecha(actividad.fecha_fin_planeada)}
                            </div>
                            {actividad.fecha_fin_real && (
                                <>
                                    <div className="text-xs text-green-600 font-medium mt-2 mb-1">Fin Real</div>
                                    <div className="text-sm font-semibold text-green-800">
                                        {formatearFecha(actividad.fecha_fin_real)}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Duraciones */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <div className="text-xs text-gray-600 font-medium mb-1">Duración Planeada</div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatearDuracion(actividad.duracion_planeada_minutos)}
                            </div>
                        </div>
                        {actividad.tiempo_adicional_minutos > 0 && (
                            <div className="bg-yellow-50 p-4 rounded-lg text-center">
                                <div className="text-xs text-yellow-600 font-medium mb-1">Tiempo Adicional</div>
                                <div className="text-2xl font-bold text-yellow-900">
                                    +{formatearDuracion(actividad.tiempo_adicional_minutos)}
                                </div>
                            </div>
                        )}
                        {actividad.duracion_real_minutos && (
                            <div className="bg-purple-50 p-4 rounded-lg text-center">
                                <div className="text-xs text-purple-600 font-medium mb-1">Duración Real</div>
                                <div className="text-2xl font-bold text-purple-900">
                                    {formatearDuracion(Math.round(actividad.duracion_real_minutos))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Badges especiales */}
                    {(actividad.es_grupal || actividad.es_prioritaria || actividad.transferida_de) && (
                        <div className="flex flex-wrap gap-2">
                            {actividad.es_grupal && (
                                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg">
                                    <span className="text-2xl">👥</span>
                                    <div>
                                        <div className="text-xs text-purple-600 font-medium">Actividad Grupal</div>
                                        <div className="text-sm font-semibold text-purple-900">
                                            {actividad.participantes_ids?.length || 0} participantes
                                        </div>
                                    </div>
                                </div>
                            )}
                            {actividad.es_prioritaria && (
                                <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg">
                                    <span className="text-2xl">⚡</span>
                                    <div>
                                        <div className="text-xs text-red-600 font-medium">Prioritaria</div>
                                        <div className="text-sm font-semibold text-red-900">
                                            Reajusta otras actividades
                                        </div>
                                    </div>
                                </div>
                            )}
                            {actividad.transferida_de && (
                                <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg">
                                    <span className="text-2xl">↗️</span>
                                    <div>
                                        <div className="text-xs text-orange-600 font-medium">Transferida</div>
                                        <div className="text-sm font-semibold text-orange-900">
                                            Desde otro usuario
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Información adicional */}
                    <div className="border-t border-gray-200 pt-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">👤</span>
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Asignado a</div>
                                <div className="text-sm font-semibold text-gray-900">
                                    {actividad.usuario_nombre || 'No especificado'}
                                </div>
                            </div>
                        </div>

                        {actividad.creado_por_nombre && (
                            <div className="flex items-start gap-3">
                                <span className="text-xl">✍️</span>
                                <div className="flex-1">
                                    <div className="text-xs text-gray-500">Creado por</div>
                                    <div className="text-sm font-semibold text-gray-900">
                                        {actividad.creado_por_nombre}
                                    </div>
                                </div>
                            </div>
                        )}

                        {actividad.notas && (
                            <div className="flex items-start gap-3">
                                <span className="text-xl">📝</span>
                                <div className="flex-1">
                                    <div className="text-xs text-gray-500">Notas</div>
                                    <div className="text-sm text-gray-700 mt-1 p-3 bg-gray-50 rounded">
                                        {actividad.notas}
                                    </div>
                                </div>
                            </div>
                        )}

                        {actividad.motivo_edicion && (
                            <div className="flex items-start gap-3">
                                <span className="text-xl">⚠️</span>
                                <div className="flex-1">
                                    <div className="text-xs text-gray-500">Motivo de edición/cancelación</div>
                                    <div className="text-sm text-gray-700 mt-1 p-3 bg-yellow-50 rounded">
                                        {actividad.motivo_edicion}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-center">
                        {/* Botones de acción */}
                        <div className="flex gap-2">
                            {puedeEditar && (
                                <button
                                    onClick={() => setShowModalEditar(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                    ✏️ Editar
                                </button>
                            )}
                            {puedeTransferir && (
                                <button
                                    onClick={() => setShowModalTransferir(true)}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                                >
                                    ↗️ Transferir
                                </button>
                            )}
                        </div>

                        {/* Botón cerrar */}
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Modales secundarios */}
            {showModalEditar && (
                <ModalEditarActividad
                    actividad={actividad}
                    onClose={() => setShowModalEditar(false)}
                    onSuccess={handleEditarSubmit}
                />
            )}

            {showModalTransferir && (
                <ModalTransferirActividad
                    actividad={actividad}
                    onClose={() => setShowModalTransferir(false)}
                    onSuccess={handleTransferirSubmit}
                />
            )}
        </div>
    );
};

export default ModalDetallesActividad;
