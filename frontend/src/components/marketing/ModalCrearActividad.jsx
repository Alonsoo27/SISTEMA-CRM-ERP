// ============================================
// MODAL CREAR ACTIVIDAD
// V2: Con manejo de colisiones
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';
import ModalNotificacion from '../common/ModalNotificacion';

const ModalCrearActividad = ({ onClose, onSuccess, usuarioId }) => {
    const [formData, setFormData] = useState({
        categoria_principal: '',
        subcategoria: '',
        descripcion: '',
        duracion_minutos: 60,
        fecha_inicio: '',
        es_prioritaria: false
    });

    const [categorias, setCategorias] = useState([]);
    const [subcategorias, setSubcategorias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingTipos, setLoadingTipos] = useState(true);

    // NUEVO: Estado para manejar colisiones
    const [colision, setColision] = useState(null);
    const [mostrarModalColision, setMostrarModalColision] = useState(false);
    const [notificacion, setNotificacion] = useState({ isOpen: false, tipo: 'info', titulo: '', mensaje: '' });

    useEffect(() => {
        cargarCategorias();
    }, []);

    useEffect(() => {
        if (formData.categoria_principal) {
            cargarSubcategorias(formData.categoria_principal);
        } else {
            setSubcategorias([]);
        }
    }, [formData.categoria_principal]);

    const cargarCategorias = async () => {
        try {
            const response = await marketingService.obtenerCategorias();
            console.log('📊 Categorías recibidas:', response);
            setCategorias(response || []);
        } catch (error) {
            console.error('Error cargando categorías:', error);
        } finally {
            setLoadingTipos(false);
        }
    };

    const cargarSubcategorias = async (categoria) => {
        try {
            const response = await marketingService.obtenerSubcategorias(categoria);
            console.log('📊 Subcategorías recibidas:', response);
            setSubcategorias(response || []);
        } catch (error) {
            console.error('Error cargando subcategorías:', error);
            setSubcategorias([]);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'categoria_principal') {
            setFormData(prev => ({
                ...prev,
                categoria_principal: value,
                subcategoria: ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSubmit = async (e, confirmarColision = false) => {
        e.preventDefault();

        // Validaciones
        if (!formData.categoria_principal || !formData.subcategoria) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Campo obligatorio',
                mensaje: 'Por favor, selecciona el tipo de actividad (categoría y subcategoría).'
            });
            return;
        }

        if (!formData.descripcion.trim()) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Campo obligatorio',
                mensaje: 'Por favor, ingresa una descripción para la actividad.'
            });
            return;
        }

        if (formData.duracion_minutos <= 0) {
            setNotificacion({
                isOpen: true,
                tipo: 'warning',
                titulo: 'Duración inválida',
                mensaje: 'La duración debe ser mayor a 0 minutos.'
            });
            return;
        }

        setLoading(true);

        try {
            const actividadData = {
                categoria_principal: formData.categoria_principal,
                subcategoria: formData.subcategoria,
                descripcion: formData.descripcion,
                duracion_minutos: parseInt(formData.duracion_minutos),
                es_prioritaria: formData.es_prioritaria,
                confirmar_colision: confirmarColision // NUEVO
            };

            if (formData.fecha_inicio && formData.fecha_inicio.trim() !== '') {
                // Convertir datetime-local (hora local) a ISO string completo con timezone
                const fechaLocal = new Date(formData.fecha_inicio);
                const offsetMinutos = fechaLocal.getTimezoneOffset();
                const fechaUTC = new Date(fechaLocal.getTime() + (offsetMinutos * 60000));
                actividadData.fecha_inicio = fechaUTC.toISOString();
            }

            if (usuarioId) {
                actividadData.usuario_id = usuarioId;
            }

            console.log('📤 Enviando actividad:', actividadData);
            const response = await marketingService.crearActividad(actividadData);

            // Si hay reprogramación automática (actividad normal)
            if (response.reprogramada) {
                const horarioOriginal = new Date(formData.fecha_inicio).toLocaleString('es-PE');
                const nuevaProgramacion = new Date(response.nueva_programacion.fecha_inicio).toLocaleString('es-PE');

                setNotificacion({
                    isOpen: true,
                    tipo: 'info',
                    titulo: 'Actividad reprogramada',
                    mensaje: `${response.mensaje}\n\nHorario original: ${horarioOriginal}\nNueva programación: ${nuevaProgramacion}`
                });
            } else {
                setNotificacion({
                    isOpen: true,
                    tipo: 'success',
                    titulo: 'Actividad creada',
                    mensaje: 'La actividad ha sido creada exitosamente.'
                });
            }

            setTimeout(() => {
                onSuccess && onSuccess();
            }, 1500);
        } catch (error) {
            // MANEJO DE COLISIONES (HTTP 409)
            if (error.status === 409 || error.response?.status === 409) {
                const colisionData = error.response?.data || error.data;
                console.log('⚠️ Colisión detectada - Mostrando modal');
                setColision(colisionData);
                setMostrarModalColision(true);
            } else {
                console.error('Error creando actividad:', error);
                setNotificacion({
                    isOpen: true,
                    tipo: 'danger',
                    titulo: 'Error al crear',
                    mensaje: error.response?.data?.message || error.message || 'No se pudo crear la actividad. Intenta de nuevo.'
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Manejar confirmación de colisión
    const handleConfirmarColision = async () => {
        setMostrarModalColision(false);
        // Crear evento falso para reutilizar handleSubmit
        const fakeEvent = { preventDefault: () => {} };
        await handleSubmit(fakeEvent, true);
    };

    // Manejar selección de slot alternativo
    const handleSeleccionarSlot = async (fechaSlot) => {
        console.log('📅 Slot seleccionado:', fechaSlot);

        // Actualizar la fecha en el formulario (convertir UTC a hora local para el input)
        const fecha = new Date(fechaSlot);
        const offsetMinutos = fecha.getTimezoneOffset();
        const fechaLocal = new Date(fecha.getTime() - (offsetMinutos * 60000));
        const fechaFormateada = fechaLocal.toISOString().slice(0, 16);
        setFormData(prev => ({
            ...prev,
            fecha_inicio: fechaFormateada
        }));

        // Cerrar modal de colisión
        setMostrarModalColision(false);
        setColision(null);

        // Informar al usuario
        const fechaFormateadaLegible = new Date(fechaSlot).toLocaleString('es-PE');
        setNotificacion({
            isOpen: true,
            tipo: 'info',
            titulo: 'Fecha actualizada',
            mensaje: `Fecha actualizada a: ${fechaFormateadaLegible}\n\nAhora puedes hacer clic en "Crear Actividad" nuevamente.`
        });
    };

    const duracionHoras = Math.floor(formData.duracion_minutos / 60);
    const duracionMinutosRestantes = formData.duracion_minutos % 60;

    return (
        <>
            {/* MODAL PRINCIPAL */}
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-900">
                            ➕ Nueva Actividad
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-5">
                        {/* Tipo de actividad */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Categoría Principal *
                                </label>
                                <select
                                    name="categoria_principal"
                                    value={formData.categoria_principal}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                    disabled={loadingTipos}
                                >
                                    <option value="">Selecciona...</option>
                                    {categorias.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Subcategoría *
                                </label>
                                <select
                                    name="subcategoria"
                                    value={formData.subcategoria}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                    disabled={!formData.categoria_principal || subcategorias.length === 0}
                                >
                                    <option value="">Selecciona...</option>
                                    {subcategorias.map(sub => (
                                        <option key={sub.id} value={sub.subcategoria}>
                                            {sub.subcategoria}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Descripción */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descripción *
                            </label>
                            <textarea
                                name="descripcion"
                                value={formData.descripcion}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Describe la actividad..."
                                required
                            />
                        </div>

                        {/* Duración */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Duración estimada *
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    name="duracion_minutos"
                                    value={formData.duracion_minutos}
                                    onChange={handleChange}
                                    min="15"
                                    step="15"
                                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                                <span className="text-sm text-gray-600">
                                    minutos ({duracionHoras > 0 && `${duracionHoras}h `}{duracionMinutosRestantes}min)
                                </span>
                            </div>
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

                        {/* Fecha de inicio (opcional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fecha y hora de inicio (opcional)
                            </label>
                            <input
                                type="datetime-local"
                                name="fecha_inicio"
                                value={formData.fecha_inicio}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Si no seleccionas, se programará en el próximo espacio disponible
                            </p>
                        </div>

                        {/* Es prioritaria */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                name="es_prioritaria"
                                checked={formData.es_prioritaria}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="ml-2 text-sm text-gray-700">
                                ⚡ Marcar como prioritaria (se insertará moviendo otras actividades)
                            </label>
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
                                        Creando...
                                    </>
                                ) : (
                                    '✓ Crear Actividad'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* MODAL DE COLISIÓN */}
            {mostrarModalColision && colision && (
                <ModalColision
                    colision={colision}
                    onConfirmar={handleConfirmarColision}
                    onCancelar={() => {
                        setMostrarModalColision(false);
                        setColision(null);
                    }}
                    onSeleccionarSlot={handleSeleccionarSlot}
                    formData={formData}
                />
            )}

            {/* Modal de Notificación */}
            <ModalNotificacion
                isOpen={notificacion.isOpen}
                onClose={() => setNotificacion({ ...notificacion, isOpen: false })}
                tipo={notificacion.tipo}
                titulo={notificacion.titulo}
                mensaje={notificacion.mensaje}
            />
        </>
    );
};

// ============================================
// COMPONENTE: MODAL DE COLISIÓN
// ============================================
const ModalColision = ({ colision, onConfirmar, onCancelar, onSeleccionarSlot, formData }) => {
    const formatearFecha = (fecha) => {
        return new Date(fecha).toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // TIPO 1: Colisión con PRIORITARIA
    if (colision.tipo_colision === 'prioritaria') {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
                    <div className="bg-yellow-50 p-6 border-b border-yellow-200">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">⚠️</span>
                            <h3 className="text-xl font-bold text-gray-900">
                                Conflicto detectado
                            </h3>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-gray-700">{colision.mensaje}</p>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm font-semibold text-gray-700 mb-2">📋 Actividad existente:</p>
                            <p className="text-gray-900">{colision.actividad_conflicto.descripcion}</p>
                            <p className="text-sm text-gray-600 mt-1">
                                🕐 {formatearFecha(colision.actividad_conflicto.fecha_inicio)} - {formatearFecha(colision.actividad_conflicto.fecha_fin)}
                            </p>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm font-semibold text-gray-700 mb-2">🆕 Tu actividad:</p>
                            <p className="text-gray-900">{formData.descripcion}</p>
                            <p className="text-sm text-gray-600 mt-1">
                                ⏱️ Duración: {formData.duracion_minutos} minutos
                            </p>
                        </div>

                        {colision.sugerencias && (
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-3">📅 Horarios alternativos:</p>
                                <div className="space-y-2">
                                    {colision.sugerencias.previo && (
                                        <button
                                            onClick={() => onSeleccionarSlot(colision.sugerencias.previo.fecha_inicio)}
                                            className="w-full p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-left transition"
                                        >
                                            <p className="text-sm font-medium text-green-900">🔼 Opción A (anterior)</p>
                                            <p className="text-xs text-green-700 mt-1">
                                                {formatearFecha(colision.sugerencias.previo.fecha_inicio)}
                                            </p>
                                        </button>
                                    )}
                                    {colision.sugerencias.posterior && (
                                        <button
                                            onClick={() => onSeleccionarSlot(colision.sugerencias.posterior.fecha_inicio)}
                                            className="w-full p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition"
                                        >
                                            <p className="text-sm font-medium text-blue-900">🔽 Opción B (posterior)</p>
                                            <p className="text-xs text-blue-700 mt-1">
                                                {formatearFecha(colision.sugerencias.posterior.fecha_inicio)}
                                            </p>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-200">
                        {!colision.sugerencias?.previo && !colision.sugerencias?.posterior ? (
                            <div className="w-full">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                                    <p className="text-sm text-red-800">
                                        ⚠️ No hay espacios disponibles con suficiente duración.
                                        Por favor, reduce la duración de la actividad o elige otro día.
                                    </p>
                                </div>
                                <button
                                    onClick={onCancelar}
                                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition"
                                >
                                    Cerrar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={onCancelar}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // TIPO 2: Colisión con GRUPAL
    if (colision.tipo_colision === 'grupal_desde_individual') {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
                    <div className="bg-orange-50 p-6 border-b border-orange-200">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">👥</span>
                            <h3 className="text-xl font-bold text-gray-900">
                                Advertencia: Actividad Grupal
                            </h3>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-gray-700">{colision.mensaje}</p>

                        <div className="bg-purple-50 p-4 rounded-lg">
                            <p className="text-sm font-semibold text-gray-700 mb-2">📋 Reunión grupal:</p>
                            <p className="text-gray-900">{colision.actividad_grupal?.descripcion}</p>
                            <p className="text-sm text-gray-600 mt-1">
                                🕐 {formatearFecha(colision.actividad_grupal?.fecha_inicio)} - {formatearFecha(colision.actividad_grupal?.fecha_fin)}
                            </p>
                            <div className="mt-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">Participantes:</p>
                                <div className="flex flex-wrap gap-1">
                                    {colision.actividad_grupal?.participantes?.map(p => (
                                        <span key={p.id} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                            {p.nombre_completo}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {colision.advertencia && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-800">
                                    <span className="font-semibold">⚠️ IMPORTANTE:</span> {colision.advertencia}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-200">
                        <button
                            onClick={onCancelar}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirmar}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                        >
                            Sí, continuar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default ModalCrearActividad;
