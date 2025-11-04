// ============================================
// MODAL CANCELAR ACTIVIDAD
// Con opción de optimización de calendario
// ============================================

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import marketingService from '../../services/marketingService';
import ModalConfirmacion from '../common/ModalConfirmacion';
import ModalNotificacion from '../common/ModalNotificacion';

const ModalCancelarActividad = ({ actividad, onClose, onSuccess }) => {
    const [motivo, setMotivo] = useState('');
    const [optimizarCalendario, setOptimizarCalendario] = useState(false);
    const [analisisOptimizacion, setAnalisisOptimizacion] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingAnalisis, setLoadingAnalisis] = useState(false);
    const [showModalDetalle, setShowModalDetalle] = useState(false);
    const [confirmacion, setConfirmacion] = useState({ isOpen: false, mensaje: '' });
    const [notificacion, setNotificacion] = useState({ isOpen: false, tipo: 'info', titulo: '', mensaje: '' });

    // Analizar optimización cuando se marca el checkbox
    useEffect(() => {
        if (optimizarCalendario && !analisisOptimizacion) {
            analizarOptimizacion();
        }
    }, [optimizarCalendario]);

    const analizarOptimizacion = async () => {
        setLoadingAnalisis(true);
        try {
            const response = await marketingService.analizarOptimizacion(actividad.id);
            setAnalisisOptimizacion(response.data);
        } catch (error) {
            console.error('Error analizando optimización:', error);
            setNotificacion({
                isOpen: true,
                tipo: 'danger',
                titulo: 'Error al analizar',
                mensaje: 'No se pudo analizar la optimización del calendario. Intenta de nuevo.'
            });
            setOptimizarCalendario(false);
        } finally {
            setLoadingAnalisis(false);
        }
    };

    const handleSubmitClick = () => {
        console.log('🟡 handleSubmitClick ejecutado', { motivo });

        if (!motivo.trim()) {
            console.log('❌ Motivo vacío, mostrando notificación');
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Campo obligatorio',
                mensaje: 'El motivo de cancelación es obligatorio. Por favor, explica por qué estás cancelando esta actividad.'
            });
            return;
        }

        console.log('✅ Motivo OK, mostrando confirmación');
        // Mostrar modal de confirmación
        const nuevoEstado = {
            isOpen: true,
            mensaje: '¿Estás seguro de cancelar esta actividad? Esta acción no se puede deshacer.'
        };
        console.log('🟢 Actualizando confirmacion a:', nuevoEstado);
        setConfirmacion(nuevoEstado);
        console.log('🟢 setConfirmacion ejecutado');
    };

    const handleConfirmarCancelacion = async () => {
        console.log('🔴 handleConfirmarCancelacion llamado');
        console.log('🔴 actividad.id:', actividad.id);
        console.log('🔴 motivo:', motivo);
        console.log('🔴 optimizarCalendario:', optimizarCalendario);

        setLoading(true);
        try {
            await marketingService.cancelarActividad(actividad.id, motivo, optimizarCalendario);

            if (optimizarCalendario && analisisOptimizacion?.puede_optimizar) {
                setNotificacion({
                    isOpen: true,
                    tipo: 'success',
                    titulo: 'Actividad cancelada',
                    mensaje: `Actividad cancelada exitosamente y ${analisisOptimizacion.actividades_a_adelantar.length} actividades adelantadas automáticamente.`
                });
            } else {
                setNotificacion({
                    isOpen: true,
                    tipo: 'success',
                    titulo: 'Actividad cancelada',
                    mensaje: 'La actividad ha sido cancelada exitosamente.'
                });
            }

            setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Error cancelando actividad:', error);
            setNotificacion({
                isOpen: true,
                tipo: 'danger',
                titulo: 'Error al cancelar',
                mensaje: error.response?.data?.message || 'No se pudo cancelar la actividad. Intenta de nuevo.'
            });
        } finally {
            setLoading(false);
        }
    };

    const formatearHora = (fecha) => {
        return format(new Date(fecha), 'HH:mm', { locale: es });
    };

    console.log('🟣 ModalCancelarActividad render, confirmacion.isOpen:', confirmacion.isOpen);

    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10001]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-red-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-red-900 mb-1">
                                ✕ Cancelar Actividad
                            </h2>
                            <p className="text-sm text-red-700">
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
                <div className="p-6 space-y-6">
                    {/* Motivo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Motivo de cancelación *
                        </label>
                        <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Explica por qué se cancela esta actividad..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            rows={3}
                            disabled={loading}
                        />
                    </div>

                    {/* Checkbox Optimizar */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={optimizarCalendario}
                                onChange={(e) => setOptimizarCalendario(e.target.checked)}
                                className="mt-1"
                                disabled={loading}
                            />
                            <div className="flex-1">
                                <span className="font-semibold text-blue-900">Optimizar calendario</span>
                                <p className="text-sm text-blue-700 mt-1">
                                    Adelantar automáticamente las actividades posteriores para llenar el hueco
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Preview de optimización */}
                    {optimizarCalendario && (
                        <div className="space-y-3">
                            {loadingAnalisis ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="ml-3 text-gray-600">Analizando calendario...</span>
                                </div>
                            ) : analisisOptimizacion ? (
                                <div>
                                    {analisisOptimizacion.puede_optimizar ? (
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-green-600 text-xl">✓</span>
                                                <span className="font-semibold text-green-900">
                                                    Se adelantarán {analisisOptimizacion.actividades_a_adelantar.length} actividad(es)
                                                </span>
                                            </div>

                                            {/* Mostrar primeras 3 actividades */}
                                            <div className="space-y-2">
                                                {analisisOptimizacion.actividades_a_adelantar.slice(0, 3).map((act) => (
                                                    <div key={act.id} className="bg-white p-3 rounded border border-green-200">
                                                        <div className="text-sm font-medium text-gray-900">{act.descripcion}</div>
                                                        <div className="text-xs text-gray-600 mt-1">
                                                            {act.categoria}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2 text-xs">
                                                            <span className="text-red-600 line-through">
                                                                {formatearHora(act.inicio_original)}
                                                            </span>
                                                            <span>→</span>
                                                            <span className="text-green-600 font-semibold">
                                                                {formatearHora(act.inicio_nuevo)}
                                                            </span>
                                                            <span className="text-gray-500">
                                                                (-{act.minutos_adelantados} min)
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Mostrar "ver todas" si hay más de 3 */}
                                            {analisisOptimizacion.actividades_a_adelantar.length > 3 && (
                                                <button
                                                    onClick={() => setShowModalDetalle(true)}
                                                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    Ver todas las {analisisOptimizacion.actividades_a_adelantar.length} actividades →
                                                </button>
                                            )}

                                            {/* Advertencias */}
                                            {analisisOptimizacion.advertencias && analisisOptimizacion.advertencias.length > 0 && (
                                                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                                    <div className="text-xs font-semibold text-yellow-900 mb-1">⚠️ Advertencias:</div>
                                                    {analisisOptimizacion.advertencias.map((adv, idx) => (
                                                        <div key={idx} className="text-xs text-yellow-800">• {adv}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <span>ℹ️</span>
                                                <span className="text-sm">
                                                    {analisisOptimizacion.advertencias[0] || 'No hay actividades para adelantar'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={(e) => {
                            console.log('🟠 CLICK en Cancelar Actividad', {
                                loading,
                                motivo: motivo.trim(),
                                disabled: loading || !motivo.trim()
                            });
                            handleSubmitClick();
                        }}
                        disabled={loading || !motivo.trim()}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {optimizarCalendario && analisisOptimizacion?.puede_optimizar
                            ? 'Cancelar y Optimizar'
                            : 'Cancelar Actividad'
                        }
                    </button>
                </div>
            </div>

            {/* Modal detalle de todas las actividades */}
            {showModalDetalle && analisisOptimizacion && (
                <ModalDetalleOptimizacion
                    analisis={analisisOptimizacion}
                    onClose={() => setShowModalDetalle(false)}
                    formatearHora={formatearHora}
                />
            )}

            {/* Modal de Confirmación */}
            <ModalConfirmacion
                isOpen={confirmacion.isOpen}
                onClose={() => setConfirmacion({ ...confirmacion, isOpen: false })}
                onConfirm={handleConfirmarCancelacion}
                titulo="Confirmar Cancelación"
                mensaje={confirmacion.mensaje}
                textoConfirmar="Sí, cancelar"
                textoCancelar="No, volver"
                tipo="danger"
            />

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

// Modal de detalle completo
const ModalDetalleOptimizacion = ({ analisis, onClose, formatearHora }) => {
    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10002]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-blue-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-blue-900">
                                📋 Detalle de Optimización
                            </h2>
                            <p className="text-sm text-blue-700 mt-1">
                                {analisis.actividades_a_adelantar.length} actividades se adelantarán
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
                <div className="p-6">
                    <div className="space-y-3">
                        {analisis.actividades_a_adelantar.map((act, idx) => (
                            <div key={act.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900">
                                            {idx + 1}. {act.descripcion}
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {act.categoria}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-red-600 line-through">
                                                    {formatearHora(act.inicio_original)} - {formatearHora(act.fin_original)}
                                                </span>
                                                <span>→</span>
                                                <span className="text-green-600 font-semibold">
                                                    {formatearHora(act.inicio_nuevo)} - {formatearHora(act.fin_nuevo)}
                                                </span>
                                            </div>
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                                -{act.minutos_adelantados} min
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalCancelarActividad;
