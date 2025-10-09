// ============================================
// MODAL GESTIONAR CAMPAÑAS ACTIVAS
// Modal para agregar/quitar líneas de campaña
// ============================================

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { API_CONFIG } from '../../../config/apiConfig';

const ModalGestionarCampanas = ({ isOpen, onClose, onCampanasActualizadas }) => {
    const [campanasActivas, setCampanasActivas] = useState([]);
    const [lineasDisponibles, setLineasDisponibles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingLineas, setLoadingLineas] = useState(false);
    const [mostrarAgregar, setMostrarAgregar] = useState(false);
    const [lineaSeleccionada, setLineaSeleccionada] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            cargarCampanasActivas();
            cargarLineasDisponibles();
        } else {
            setMostrarAgregar(false);
            setLineaSeleccionada('');
            setError(null);
        }
    }, [isOpen]);

    const cargarCampanasActivas = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/campanas-asesor/activas`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCampanasActivas(data.data || []);
                }
            }
        } catch (error) {
            console.error('Error cargando campañas activas:', error);
            setError('No se pudieron cargar las campañas');
        } finally {
            setLoading(false);
        }
    };

    const cargarLineasDisponibles = async () => {
        try {
            setLoadingLineas(true);
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/lineas`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setLineasDisponibles(data.data || []);
                }
            }
        } catch (error) {
            console.error('Error cargando líneas:', error);
        } finally {
            setLoadingLineas(false);
        }
    };

    const handleAgregarLinea = async () => {
        if (!lineaSeleccionada) {
            setError('Debes seleccionar una línea de producto');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_CONFIG.BASE_URL}/api/campanas-asesor/agregar-linea`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ linea_producto: lineaSeleccionada })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Recargar campañas
                await cargarCampanasActivas();
                setMostrarAgregar(false);
                setLineaSeleccionada('');

                // Notificar al componente padre
                if (onCampanasActualizadas) {
                    onCampanasActualizadas();
                }
            } else {
                setError(data.message || 'Error al agregar campaña');
            }
        } catch (error) {
            console.error('Error agregando línea:', error);
            setError('Error al agregar campaña');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizarCampana = async (campanaId, lineaProducto) => {
        if (!confirm(`¿Estás seguro de finalizar la campaña de ${lineaProducto}?`)) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_CONFIG.BASE_URL}/api/campanas-asesor/${campanaId}/finalizar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Recargar campañas
                await cargarCampanasActivas();

                // Notificar al componente padre
                if (onCampanasActualizadas) {
                    onCampanasActualizadas();
                }
            } else {
                setError(data.message || 'Error al finalizar campaña');
            }
        } catch (error) {
            console.error('Error finalizando campaña:', error);
            setError('Error al finalizar campaña');
        } finally {
            setLoading(false);
        }
    };

    const formatearFecha = (fecha) => {
        if (!fecha) return '-';
        return new Date(fecha).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Filtrar líneas ya activas
    const lineasNoActivas = lineasDisponibles.filter(
        linea => !campanasActivas.some(c => c.linea_producto === linea.value)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <TrendingUp className="h-8 w-8" />
                        <div>
                            <h2 className="text-xl font-bold">Mis Campañas Activas</h2>
                            <p className="text-sm text-purple-100">
                                Gestiona tus líneas de campaña
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                            <span className="text-sm text-red-800">{error}</span>
                        </div>
                    )}

                    {loading && campanasActivas.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                            <p className="text-gray-600 mt-4">Cargando campañas...</p>
                        </div>
                    ) : campanasActivas.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No tienes campañas activas</p>
                        </div>
                    ) : (
                        <div className="space-y-3 mb-6">
                            {campanasActivas.map((campana) => (
                                <div
                                    key={campana.id}
                                    className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 text-lg">
                                                {campana.linea_producto}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                                                <div className="flex items-center text-gray-600">
                                                    <Calendar className="h-4 w-4 mr-1" />
                                                    Desde: {formatearFecha(campana.fecha_inicio)}
                                                </div>
                                                <div className="text-gray-600">
                                                    Días: <span className="font-semibold">{campana.dias_trabajados || 0}</span>
                                                </div>
                                                <div className="text-gray-600">
                                                    Mensajes: <span className="font-semibold">{campana.total_mensajes || 0}</span>
                                                </div>
                                                <div className="text-gray-600">
                                                    Ventas: <span className="font-semibold">{campana.total_ventas || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleFinalizarCampana(campana.id, campana.linea_producto)}
                                            disabled={loading}
                                            className="ml-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                                            title="Finalizar campaña"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Agregar nueva línea */}
                    {!mostrarAgregar ? (
                        <button
                            onClick={() => setMostrarAgregar(true)}
                            disabled={loading || lineasNoActivas.length === 0}
                            className="w-full border-2 border-dashed border-purple-300 hover:border-purple-500 text-purple-600 hover:text-purple-700 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="h-5 w-5" />
                            <span>Agregar nueva línea de campaña</span>
                        </button>
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Selecciona la línea de producto:
                            </label>
                            <div className="flex space-x-2">
                                <select
                                    value={lineaSeleccionada}
                                    onChange={(e) => setLineaSeleccionada(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    disabled={loading || loadingLineas}
                                >
                                    <option value="">Selecciona una línea...</option>
                                    {lineasNoActivas.map((linea) => (
                                        <option key={linea.value} value={linea.value}>
                                            {linea.label} ({linea.productos_count} productos)
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAgregarLinea}
                                    disabled={loading || !lineaSeleccionada}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Agregar
                                </button>
                                <button
                                    onClick={() => {
                                        setMostrarAgregar(false);
                                        setLineaSeleccionada('');
                                        setError(null);
                                    }}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {lineasNoActivas.length === 0 && campanasActivas.length > 0 && (
                        <p className="text-sm text-gray-500 text-center mt-4">
                            Ya tienes campañas de todas las líneas disponibles
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 bg-gray-50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalGestionarCampanas;
