// ============================================
// MODAL GESTIONAR ACTIVIDAD VENCIDA
// Sistema inteligente de gestión según ventana de tiempo
// ============================================

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ModalNotificacion from '../common/ModalNotificacion';

const ModalGestionarVencida = ({ actividad, indiceActual = 1, totalActividades = 1, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [accionSeleccionada, setAccionSeleccionada] = useState(null);

    // Estados para formularios dinámicos
    const [minutosAdicionales, setMinutosAdicionales] = useState('');
    const [motivo, setMotivo] = useState('');
    const [horaFinReal, setHoraFinReal] = useState('');
    const [tiempoRestante, setTiempoRestante] = useState('');
    const [descripcionAdicional, setDescripcionAdicional] = useState('');
    const [notificacion, setNotificacion] = useState({ isOpen: false, tipo: 'info', titulo: '', mensaje: '' });

    useEffect(() => {
        // Pre-seleccionar la primera acción disponible
        if (actividad?.acciones_disponibles?.length > 0) {
            setAccionSeleccionada(actividad.acciones_disponibles[0].id);
        }
    }, [actividad]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Construir datos según la acción
            let datos = { motivo };

            switch (accionSeleccionada) {
                case 'extender':
                    if (!minutosAdicionales || minutosAdicionales <= 0) {
                        setNotificacion({
                            isOpen: true,
                            tipo: 'warning',
                            titulo: 'Campo obligatorio',
                            mensaje: 'Debes especificar los minutos adicionales para extender la actividad.'
                        });
                        setLoading(false);
                        return;
                    }
                    datos = {
                        minutos_adicionales: parseInt(minutosAdicionales),
                        motivo
                    };
                    break;

                case 'completar_retroactivo':
                    if (!horaFinReal) {
                        setNotificacion({
                            isOpen: true,
                            tipo: 'warning',
                            titulo: 'Campo obligatorio',
                            mensaje: 'Debes especificar la hora real de finalización de la actividad.'
                        });
                        setLoading(false);
                        return;
                    }
                    datos = {
                        hora_fin_real: horaFinReal,
                        motivo
                    };
                    break;

                case 'reprogramar':
                    if (!tiempoRestante || tiempoRestante <= 0) {
                        setNotificacion({
                            isOpen: true,
                            tipo: 'warning',
                            titulo: 'Campo obligatorio',
                            mensaje: 'Debes especificar el tiempo restante necesario para completar la actividad.'
                        });
                        setLoading(false);
                        return;
                    }
                    datos = {
                        tiempo_restante_minutos: parseInt(tiempoRestante),
                        motivo,
                        descripcion_adicional: descripcionAdicional
                    };
                    break;

                case 'cancelar':
                    if (!motivo) {
                        setNotificacion({
                            isOpen: true,
                            tipo: 'warning',
                            titulo: 'Campo obligatorio',
                            mensaje: 'El motivo es obligatorio para cancelar una actividad.'
                        });
                        setLoading(false);
                        return;
                    }
                    break;

                case 'completar':
                case 'posponer':
                case 'completar_fuera_tiempo':
                    // Estos no requieren datos adicionales obligatorios
                    break;
            }

            await onSuccess(accionSeleccionada, datos);
        } catch (error) {
            console.error('Error:', error);
            setNotificacion({
                isOpen: true,
                tipo: 'danger',
                titulo: 'Error al gestionar',
                mensaje: error.response?.data?.message || 'No se pudo gestionar la actividad. Intenta de nuevo.'
            });
        } finally {
            setLoading(false);
        }
    };

    const formatearFecha = (fecha) => {
        // Las fechas vienen en UTC desde el backend, agregar 'Z' si no la tiene
        const fechaStr = typeof fecha === 'string' && !fecha.endsWith('Z')
            ? fecha + 'Z'
            : fecha;
        return format(new Date(fechaStr), "dd/MM/yyyy HH:mm", { locale: es });
    };

    const getVentanaColor = () => {
        switch (actividad.ventana) {
            case 'recien_vencida':
                return 'bg-yellow-50 border-yellow-300';
            case 'vencida':
                return 'bg-orange-50 border-orange-300';
            case 'muy_vencida':
                return 'bg-red-50 border-red-300';
            default:
                return 'bg-gray-50 border-gray-300';
        }
    };

    const getVentanaIcon = () => {
        switch (actividad.ventana) {
            case 'recien_vencida':
                return '⚡';
            case 'vencida':
                return '⚠️';
            case 'muy_vencida':
                return '🚨';
            default:
                return 'ℹ️';
        }
    };

    const getVentanaTexto = () => {
        switch (actividad.ventana) {
            case 'recien_vencida':
                return 'Recién vencida (0-5 min)';
            case 'vencida':
                return 'Vencida (5-60 min)';
            case 'muy_vencida':
                return 'Muy vencida (60+ min)';
            default:
                return 'Vencida';
        }
    };

    const accionActual = actividad?.acciones_disponibles?.find(a => a.id === accionSeleccionada);

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10001]">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className={`p-6 border-b border-gray-200 ${getVentanaColor()}`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {getVentanaIcon()} Actividad Vencida
                                </h2>
                                {totalActividades > 1 && (
                                    <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-bold">
                                        {indiceActual} de {totalActividades}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-700 font-semibold">
                                {getVentanaTexto()} - {actividad.minutos_vencimiento} minutos desde finalización
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                        >
                            ×
                        </button>
                    </div>

                    {/* Barra de progreso si hay múltiples actividades */}
                    {totalActividades > 1 && (
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Progreso de gestión</span>
                                <span>{Math.round((indiceActual / totalActividades) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(indiceActual / totalActividades) * 100}%` }}
                                />
                            </div>
                            <div className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                                <span>ℹ️</span>
                                <span>Al gestionar esta actividad, se mostrará la siguiente automáticamente</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                                <div className="text-xs text-gray-500">Duración planeada</div>
                                <div className="font-medium text-gray-900">
                                    {actividad.duracion_planeada_minutos} min
                                </div>
                            </div>
                        </div>

                        {actividad.fecha_fin_planeada && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">Finalizó hace</div>
                                <div className="text-sm text-gray-700 font-semibold">
                                    {formatearFecha(actividad.fecha_fin_planeada)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selección de acción */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            ¿Qué deseas hacer?
                        </label>
                        <div className="space-y-2">
                            {actividad.acciones_disponibles?.map((accion) => (
                                <label
                                    key={accion.id}
                                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                                        accionSeleccionada === accion.id
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="accion"
                                        value={accion.id}
                                        checked={accionSeleccionada === accion.id}
                                        onChange={(e) => setAccionSeleccionada(e.target.value)}
                                        className="mt-1 mr-3"
                                    />
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900">
                                            {accion.label}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                            {accion.descripcion}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Formularios dinámicos según acción */}
                    {accionSeleccionada && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-4">
                            <div className="text-sm font-semibold text-blue-900">
                                {accionActual?.label}
                            </div>

                            {/* EXTENDER - Minutos adicionales */}
                            {accionSeleccionada === 'extender' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Minutos adicionales (sin límite)
                                        </label>
                                        <div className="flex gap-2 mb-2">
                                            <button
                                                type="button"
                                                onClick={() => setMinutosAdicionales('15')}
                                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                                            >
                                                +15
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMinutosAdicionales('30')}
                                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                                            >
                                                +30
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMinutosAdicionales('60')}
                                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                                            >
                                                +60
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMinutosAdicionales('120')}
                                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                                            >
                                                +120
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            value={minutosAdicionales}
                                            onChange={(e) => setMinutosAdicionales(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="Cantidad de minutos"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Motivo de la extensión
                                        </label>
                                        <textarea
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            rows="3"
                                            placeholder="Explica por qué necesitas más tiempo"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            {/* COMPLETAR RETROACTIVO - Hora fin real */}
                            {accionSeleccionada === 'completar_retroactivo' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            ¿A qué hora terminaste realmente?
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={horaFinReal}
                                            onChange={(e) => setHoraFinReal(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            max={new Date().toISOString().slice(0, 16)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Motivo del retraso
                                        </label>
                                        <textarea
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            rows="3"
                                            placeholder="Explica por qué se retrasó"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            {/* REPROGRAMAR - Tiempo restante y descripción */}
                            {accionSeleccionada === 'reprogramar' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            ¿Cuántos minutos necesitas para terminarla?
                                        </label>
                                        <input
                                            type="number"
                                            value={tiempoRestante}
                                            onChange={(e) => setTiempoRestante(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="Minutos restantes"
                                            min="1"
                                            required
                                        />
                                        <div className="text-xs text-gray-600 mt-1">
                                            Se creará una actividad PARTE 2 en el próximo slot disponible
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Motivo de la reprogramación
                                        </label>
                                        <textarea
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            rows="2"
                                            placeholder="¿Por qué no pudiste completarla?"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Descripción adicional para PARTE 2 (opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={descripcionAdicional}
                                            onChange={(e) => setDescripcionAdicional(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="Detalles adicionales para la continuación"
                                        />
                                    </div>
                                </>
                            )}

                            {/* CANCELAR o COMPLETAR FUERA DE TIEMPO - Solo motivo */}
                            {(accionSeleccionada === 'cancelar' || accionSeleccionada === 'completar_fuera_tiempo') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Motivo
                                    </label>
                                    <textarea
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        rows="3"
                                        placeholder="Explica qué sucedió"
                                        required
                                    />
                                </div>
                            )}

                            {/* COMPLETAR o POSPONER - No requieren campos adicionales */}
                            {(accionSeleccionada === 'completar' || accionSeleccionada === 'posponer') && (
                                <div className="text-sm text-blue-800">
                                    {accionSeleccionada === 'completar' &&
                                        'Se marcará como completada ahora con la hora actual.'
                                    }
                                    {accionSeleccionada === 'posponer' &&
                                        'La alerta se volverá a mostrar en 5 minutos.'
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </form>

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
                        onClick={handleSubmit}
                        disabled={loading || !accionSeleccionada}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        Confirmar
                    </button>
                </div>
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

export default ModalGestionarVencida;
