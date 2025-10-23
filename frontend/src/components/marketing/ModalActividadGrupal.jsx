// ============================================
// MODAL CREAR ACTIVIDAD GRUPAL
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';

const ModalActividadGrupal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        categoria_principal: '',
        subcategoria: '',
        descripcion: '',
        duracion_minutos: 60,
        fecha_inicio: '',
        participantes_ids: []
    });

    const [categorias, setCategorias] = useState([]);
    const [subcategorias, setSubcategorias] = useState([]);
    const [equipoMarketing, setEquipoMarketing] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingTipos, setLoadingTipos] = useState(true);

    useEffect(() => {
        cargarCategorias();
        cargarEquipo();
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
            setSubcategorias(response || []);
        } catch (error) {
            console.error('Error cargando subcategorías:', error);
            setSubcategorias([]);
        }
    };

    const cargarEquipo = async () => {
        try {
            const response = await marketingService.obtenerEquipoMarketing();
            const equipoData = Array.isArray(response) ? response : (response.data || []);
            const equipoFiltrado = equipoData.filter(u =>
                ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(u.rol)
            );
            setEquipoMarketing(equipoFiltrado);
        } catch (error) {
            console.error('Error cargando equipo:', error);
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

    const handleParticipanteToggle = (usuarioId) => {
        setFormData(prev => ({
            ...prev,
            participantes_ids: prev.participantes_ids.includes(usuarioId)
                ? prev.participantes_ids.filter(id => id !== usuarioId)
                : [...prev.participantes_ids, usuarioId]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.categoria_principal || !formData.subcategoria) {
            alert('Selecciona el tipo de actividad');
            return;
        }

        if (!formData.descripcion.trim()) {
            alert('Ingresa una descripción');
            return;
        }

        if (formData.participantes_ids.length === 0) {
            alert('Selecciona al menos un participante');
            return;
        }

        setLoading(true);
        try {
            const actividadData = {
                categoria_principal: formData.categoria_principal,
                subcategoria: formData.subcategoria,
                descripcion: formData.descripcion,
                duracion_minutos: parseInt(formData.duracion_minutos),
                participantes_ids: formData.participantes_ids
            };

            if (formData.fecha_inicio && formData.fecha_inicio.trim() !== '') {
                actividadData.fecha_inicio = formData.fecha_inicio;
            }

            await marketingService.crearActividadGrupal(actividadData);
            alert('✅ Actividad grupal creada exitosamente para ' + formData.participantes_ids.length + ' participantes');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error creando actividad grupal:', error);
            alert('Error al crear la actividad grupal: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const duracionHoras = Math.floor(formData.duracion_minutos / 60);
    const duracionMinutosRestantes = formData.duracion_minutos % 60;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-purple-50">
                    <h2 className="text-2xl font-bold text-gray-900">
                        👥 Nueva Actividad Grupal
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
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Describe la actividad grupal..."
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
                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {mins >= 60 ? `${mins / 60}h` : `${mins}min`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fecha de inicio */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fecha y hora de inicio (opcional)
                        </label>
                        <input
                            type="datetime-local"
                            name="fecha_inicio"
                            value={formData.fecha_inicio}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Si no seleccionas, se programará en el próximo espacio disponible de cada participante
                        </p>
                    </div>

                    {/* Participantes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Participantes * ({formData.participantes_ids.length} seleccionados)
                        </label>
                        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-4 border border-gray-200 rounded-lg bg-gray-50">
                            {equipoMarketing.map(usuario => (
                                <label
                                    key={usuario.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                                        formData.participantes_ids.includes(usuario.id)
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-gray-200 bg-white hover:border-purple-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.participantes_ids.includes(usuario.id)}
                                        onChange={() => handleParticipanteToggle(usuario.id)}
                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {usuario.nombre_completo}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {usuario.rol === 'JEFE_MARKETING' ? 'Jefe' : 'Ejecutor'}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            ⚠️ La actividad será creada en el calendario de cada participante seleccionado
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
                            className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Creando...
                                </>
                            ) : (
                                '✓ Crear Actividad Grupal'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalActividadGrupal;
