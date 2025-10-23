// ============================================
// MODAL REGISTRAR AUSENCIA
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';

const ModalRegistrarAusencia = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        usuario_id: '',
        fecha_inicio: '',
        fecha_fin: '',
        motivo: '',
        notas: ''
    });

    const [equipoMarketing, setEquipoMarketing] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingEquipo, setLoadingEquipo] = useState(true);

    useEffect(() => {
        cargarEquipo();
    }, []);

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
        } finally {
            setLoadingEquipo(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.usuario_id) {
            alert('Selecciona un usuario');
            return;
        }

        if (!formData.fecha_inicio || !formData.fecha_fin) {
            alert('Debes especificar la fecha de inicio y fin de la ausencia');
            return;
        }

        if (!formData.motivo.trim()) {
            alert('El motivo es obligatorio');
            return;
        }

        // Validar que fecha_fin >= fecha_inicio
        const inicio = new Date(formData.fecha_inicio);
        const fin = new Date(formData.fecha_fin);
        if (fin < inicio) {
            alert('La fecha de fin debe ser posterior a la fecha de inicio');
            return;
        }

        setLoading(true);
        try {
            const datos = {
                usuario_id: parseInt(formData.usuario_id),
                fecha_inicio: formData.fecha_inicio,
                fecha_fin: formData.fecha_fin,
                motivo: formData.motivo,
                notas: formData.notas || null
            };

            await marketingService.registrarAusencia(datos);
            alert('✅ Ausencia registrada exitosamente');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error registrando ausencia:', error);
            alert('Error al registrar ausencia: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const usuarioSeleccionado = equipoMarketing.find(u => u.id === parseInt(formData.usuario_id));

    // Calcular días de ausencia
    const calcularDias = () => {
        if (!formData.fecha_inicio || !formData.fecha_fin) return null;
        const inicio = new Date(formData.fecha_inicio);
        const fin = new Date(formData.fecha_fin);
        const diff = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
        return diff;
    };

    const diasAusencia = calcularDias();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-amber-50">
                    <h2 className="text-2xl font-bold text-gray-900">
                        🏖️ Registrar Ausencia
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
                    {/* Usuario */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Usuario ausente *
                        </label>
                        {loadingEquipo ? (
                            <div className="text-sm text-gray-500">Cargando equipo...</div>
                        ) : (
                            <select
                                name="usuario_id"
                                value={formData.usuario_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                required
                            >
                                <option value="">Selecciona un usuario...</option>
                                {equipoMarketing.map(usuario => (
                                    <option key={usuario.id} value={usuario.id}>
                                        {usuario.nombre_completo} ({usuario.rol === 'JEFE_MARKETING' ? 'Jefe' : 'Ejecutor'})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Preview del usuario */}
                    {usuarioSeleccionado && (
                        <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {usuarioSeleccionado.nombre?.charAt(0)}{usuarioSeleccionado.apellido?.charAt(0)}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-blue-900">
                                    {usuarioSeleccionado.nombre_completo}
                                </div>
                                <div className="text-xs text-blue-600">
                                    {usuarioSeleccionado.email}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fecha de inicio *
                            </label>
                            <input
                                type="date"
                                name="fecha_inicio"
                                value={formData.fecha_inicio}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fecha de fin *
                            </label>
                            <input
                                type="date"
                                name="fecha_fin"
                                value={formData.fecha_fin}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Días calculados */}
                    {diasAusencia !== null && (
                        <div className="bg-amber-50 p-4 rounded-lg">
                            <div className="text-sm text-amber-900">
                                <strong>Duración:</strong> {diasAusencia} {diasAusencia === 1 ? 'día' : 'días'}
                            </div>
                        </div>
                    )}

                    {/* Motivo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Motivo *
                        </label>
                        <select
                            name="motivo"
                            value={formData.motivo}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            required
                        >
                            <option value="">Selecciona un motivo...</option>
                            <option value="Vacaciones">Vacaciones</option>
                            <option value="Enfermedad">Enfermedad</option>
                            <option value="Permiso personal">Permiso personal</option>
                            <option value="Licencia médica">Licencia médica</option>
                            <option value="Capacitación">Capacitación</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    {/* Notas adicionales */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notas adicionales (opcional)
                        </label>
                        <textarea
                            name="notas"
                            value={formData.notas}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            placeholder="Información adicional sobre la ausencia..."
                        />
                    </div>

                    {/* Info */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-start gap-2">
                            <span className="text-blue-600 text-lg">ℹ️</span>
                            <div className="text-sm text-blue-800">
                                <strong>Nota:</strong> Las actividades del usuario durante este período serán marcadas como "ausencia".
                                El jefe puede transferir estas actividades a otros miembros del equipo si es necesario.
                            </div>
                        </div>
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
                            className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Registrando...
                                </>
                            ) : (
                                '✓ Registrar Ausencia'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalRegistrarAusencia;
