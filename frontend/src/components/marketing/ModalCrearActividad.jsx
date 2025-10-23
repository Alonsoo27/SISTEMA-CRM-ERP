// ============================================
// MODAL CREAR ACTIVIDAD
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';

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

        // Si cambia la categoría principal, limpiar subcategoría
        if (name === 'categoria_principal') {
            setFormData(prev => ({
                ...prev,
                categoria_principal: value,
                subcategoria: '' // Limpiar subcategoría
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validaciones
        if (!formData.categoria_principal || !formData.subcategoria) {
            alert('Selecciona el tipo de actividad');
            return;
        }

        if (!formData.descripcion.trim()) {
            alert('Ingresa una descripción');
            return;
        }

        if (formData.duracion_minutos <= 0) {
            alert('La duración debe ser mayor a 0');
            return;
        }

        setLoading(true);

        try {
            const actividadData = {
                categoria_principal: formData.categoria_principal,
                subcategoria: formData.subcategoria,
                descripcion: formData.descripcion,
                duracion_minutos: parseInt(formData.duracion_minutos),
                es_prioritaria: formData.es_prioritaria
            };

            // Solo enviar fecha_inicio si está explícitamente definida
            if (formData.fecha_inicio && formData.fecha_inicio.trim() !== '') {
                actividadData.fecha_inicio = formData.fecha_inicio;
            }
            // Si no se define, el backend calculará automáticamente el próximo slot

            // Si se especifica usuarioId (cuando un jefe/admin crea para otro), enviarlo
            if (usuarioId) {
                actividadData.usuario_id = usuarioId;
            }

            console.log('📤 Enviando actividad para usuario:', usuarioId);
            await marketingService.crearActividad(actividadData);

            alert('✅ Actividad creada exitosamente');
            onSuccess && onSuccess();
        } catch (error) {
            console.error('Error creando actividad:', error);
            alert('Error al crear la actividad: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Calcular duración en horas y minutos
    const duracionHoras = Math.floor(formData.duracion_minutos / 60);
    const duracionMinutosRestantes = formData.duracion_minutos % 60;

    return (
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
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
    );
};

export default ModalCrearActividad;
