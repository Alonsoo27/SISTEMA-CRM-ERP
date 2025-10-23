// ============================================
// MODAL TRANSFERIR ACTIVIDAD
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';

const ModalTransferirActividad = ({ actividad, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        usuario_destino_id: '',
        motivo: ''
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

            // Filtrar solo usuarios de marketing, excluyendo al usuario actual de la actividad
            const equipoFiltrado = equipoData.filter(u =>
                ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(u.rol) &&
                u.id !== actividad.usuario_id
            );

            setEquipoMarketing(equipoFiltrado);
        } catch (error) {
            console.error('Error cargando equipo:', error);
            alert('Error al cargar el equipo de marketing');
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

        if (!formData.usuario_destino_id) {
            alert('Selecciona un usuario destino');
            return;
        }

        if (!formData.motivo.trim()) {
            alert('El motivo de transferencia es obligatorio');
            return;
        }

        setLoading(true);
        try {
            const datos = {
                actividad_id: actividad.id,
                usuario_destino_id: parseInt(formData.usuario_destino_id),
                motivo: formData.motivo
            };

            await onSuccess(datos);
        } catch (error) {
            console.error('Error transfiriendo actividad:', error);
            alert('Error al transferir actividad: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const usuarioSeleccionado = equipoMarketing.find(u => u.id === parseInt(formData.usuario_destino_id));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">
                        ↗️ Transferir Actividad
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
                    {/* Información de la actividad */}
                    <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-xs text-orange-600 font-medium mb-1">Transferiendo</div>
                        <div className="text-sm font-bold text-orange-900">{actividad.descripcion}</div>
                        <div className="text-xs text-orange-700 mt-1">
                            {actividad.codigo} • Asignado a: {actividad.usuario_nombre}
                        </div>
                    </div>

                    {/* Usuario destino */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Transferir a *
                        </label>
                        {loadingEquipo ? (
                            <div className="text-sm text-gray-500">Cargando equipo...</div>
                        ) : equipoMarketing.length === 0 ? (
                            <div className="text-sm text-red-600">No hay otros usuarios disponibles para transferir</div>
                        ) : (
                            <select
                                name="usuario_destino_id"
                                value={formData.usuario_destino_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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

                    {/* Preview del usuario seleccionado */}
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

                    {/* Motivo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Motivo de la transferencia *
                        </label>
                        <textarea
                            name="motivo"
                            value={formData.motivo}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            placeholder="Explica por qué estás transfiriendo esta actividad..."
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            ⚠️ El usuario actual ya no verá esta actividad en su calendario
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
                            className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={loading || equipoMarketing.length === 0}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Transfiriendo...
                                </>
                            ) : (
                                '↗️ Transferir'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalTransferirActividad;
