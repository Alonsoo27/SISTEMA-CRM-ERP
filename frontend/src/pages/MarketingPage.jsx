// ============================================
// PÁGINA PRINCIPAL - MARKETING
// Sistema de planificación de actividades
// ============================================

import { useState, useEffect, useMemo } from 'react';
import CalendarioActividades from '../components/marketing/CalendarioActividades/CalendarioActividades';
import ModalCrearActividad from '../components/marketing/ModalCrearActividad';
import ModalCargaMasiva from '../components/marketing/ModalCargaMasiva';
import ModalActividadGrupal from '../components/marketing/ModalActividadGrupal';
import ModalRegistrarAusencia from '../components/marketing/ModalRegistrarAusencia';
import SelectorVista from '../components/marketing/SelectorVista';
import LeyendaColores from '../components/marketing/LeyendaColores';
import marketingService from '../services/marketingService';

const MarketingPage = () => {
    // Obtener usuario del localStorage
    const user = useMemo(() => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            return {
                id: userData.id,
                nombre: userData.nombre_completo || `${userData.nombre || ''} ${userData.apellido || ''}`.trim(),
                rol: userData.rol?.nombre || userData.rol
            };
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            return { id: null, nombre: '', rol: '' };
        }
    }, []);

    const [vistaActual, setVistaActual] = useState('semanal'); // semanal | mensual | trimestral | anual
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
    const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
    const [modalCargaMasivaAbierto, setModalCargaMasivaAbierto] = useState(false);
    const [modalGrupalAbierto, setModalGrupalAbierto] = useState(false);
    const [modalAusenciaAbierto, setModalAusenciaAbierto] = useState(false);
    const [equipoMarketing, setEquipoMarketing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requiereSeleccion, setRequiereSeleccion] = useState(false);
    const [mostrarSelectorInicial, setMostrarSelectorInicial] = useState(false);
    const [calendarioKey, setCalendarioKey] = useState(0); // Para forzar recarga sin refresh

    // Permisos dinámicos basados en el rol
    const esMarketing = ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(user?.rol);
    const esJefe = user?.rol === 'JEFE_MARKETING';
    const esEjecutivo = ['SUPER_ADMIN', 'ADMIN', 'GERENTE'].includes(user?.rol);

    // TODOS los de marketing pueden crear, editar, completar actividades individuales
    const puedeCrear = esMarketing || esJefe || esEjecutivo;
    const puedeEditar = esMarketing || esJefe || esEjecutivo;
    const puedeCompletar = esMarketing || esJefe || esEjecutivo;

    // Solo jefe y superiores pueden: cancelar, crear grupales, transferir, registrar ausencias, carga masiva
    const puedeCancelar = esJefe || esEjecutivo;
    const puedeCrearGrupal = esJefe || esEjecutivo;
    const puedeTransferir = esJefe || esEjecutivo;
    const puedeRegistrarAusencias = esJefe || esEjecutivo;

    // Cargar equipo de marketing al montar
    useEffect(() => {
        cargarEquipo();
    }, []);

    const cargarEquipo = async () => {
        try {
            setLoading(true);
            const response = await marketingService.obtenerEquipoMarketing();

            console.log('📊 Respuesta del servidor:', response);
            console.log('📊 response es array?', Array.isArray(response));
            console.log('👤 Usuario actual:', user);
            console.log('🎭 Es Marketing?', esMarketing);
            console.log('🎭 Es Ejecutivo?', esEjecutivo);

            // El marketingService ya devuelve response.data, así que 'response' es directamente el array
            const equipoData = Array.isArray(response) ? response : (response.data || []);
            setEquipoMarketing(equipoData);

            // Si NO eres de marketing, DEBES seleccionar a alguien
            if (!esMarketing && equipoData && equipoData.length > 0) {
                setRequiereSeleccion(true);

                const miembrosMarketing = equipoData.filter(u =>
                    ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(u.rol)
                );

                console.log('👥 Miembros de marketing encontrados:', miembrosMarketing);

                if (miembrosMarketing.length > 0) {
                    // Mostrar selector inicial para que el ejecutivo elija explícitamente
                    setMostrarSelectorInicial(true);
                    console.log('✅ Mostrando selector inicial');
                } else {
                    console.log('⚠️ No hay miembros de marketing');
                }
            } else if (esMarketing) {
                // Si eres de marketing, por defecto ves tu propio calendario
                setUsuarioSeleccionado(user.id);
                console.log('✅ Usuario de marketing, seleccionado automáticamente:', user.id);
            }
        } catch (error) {
            console.error('❌ Error cargando equipo:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleActividadCreada = () => {
        setModalCrearAbierto(false);
        // Recargar calendario sin refresh de página
        setCalendarioKey(prev => prev + 1);
    };

    // Mostrar loading mientras carga el equipo
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Cargando módulo de marketing...</p>
                </div>
            </div>
        );
    }

    // Mensaje si no hay usuarios de marketing aún
    if (requiereSeleccion && equipoMarketing.filter(m => ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(m.rol)).length === 0) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">📢</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        No hay equipo de marketing
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Aún no se han creado usuarios para el área de marketing.
                        Contacta al administrador para crear usuarios.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Nota:</strong> Solo usuarios con rol MARKETING_EJECUTOR o JEFE_MARKETING pueden tener calendarios.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Pantalla de selección inicial para ejecutivos
    if (mostrarSelectorInicial && !usuarioSeleccionado) {
        const miembrosMarketing = equipoMarketing.filter(m =>
            ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(m.rol)
        );

        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4">
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-4">📢</div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            Módulo de Marketing
                        </h2>
                        <p className="text-gray-600">
                            Selecciona el calendario que deseas visualizar
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-blue-800">
                            <strong>👁️ Nota:</strong> Como {user.rol}, puedes ver y gestionar los calendarios de todo el equipo de marketing.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {miembrosMarketing.map(miembro => (
                            <button
                                key={miembro.id}
                                onClick={() => {
                                    setUsuarioSeleccionado(miembro.id);
                                    setMostrarSelectorInicial(false);
                                }}
                                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                        {miembro.nombre?.charAt(0)}{miembro.apellido?.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                                            {miembro.nombre_completo}
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {miembro.rol === 'JEFE_MARKETING' ? '👔 Jefe de Marketing' : '📊 Ejecutor de Marketing'}
                                        </p>
                                    </div>
                                    <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        →
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="text-center text-sm text-gray-500">
                        Podrás cambiar de vista en cualquier momento usando el selector superior
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full bg-gray-50">
            {/* Header */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">📢 Marketing</h1>
                        <p className="text-gray-600">
                            Planificación y gestión de actividades
                            {requiereSeleccion && (
                                <span className="ml-2 text-sm text-blue-600 font-medium">
                                    (Viendo calendario del equipo)
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {/* Botón crear actividad - solo si tiene permisos */}
                        {puedeCrear && (
                            <button
                                onClick={() => setModalCrearAbierto(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                                title="Crear nueva actividad individual"
                            >
                                <span className="text-xl">+</span>
                                Nueva Actividad
                            </button>
                        )}

                        {/* Actividad Grupal - solo para jefe y superiores */}
                        {puedeCrearGrupal && (
                            <button
                                onClick={() => setModalGrupalAbierto(true)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                                title="Crear actividad para múltiples usuarios"
                            >
                                <span className="text-xl">👥</span>
                                Actividad Grupal
                            </button>
                        )}

                        {/* Registrar Ausencia - solo para jefe y superiores */}
                        {puedeRegistrarAusencias && (
                            <button
                                onClick={() => setModalAusenciaAbierto(true)}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
                                title="Registrar ausencia de un miembro del equipo"
                            >
                                <span className="text-xl">🏖️</span>
                                Registrar Ausencia
                            </button>
                        )}

                        {/* Carga masiva Excel - solo para jefe de marketing y ejecutivos */}
                        {puedeCrearGrupal && (
                            <button
                                onClick={() => setModalCargaMasivaAbierto(true)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                                title="Cargar múltiples actividades desde Excel"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Carga Masiva
                            </button>
                        )}
                    </div>
                </div>

                {/* Selector de vista y filtros */}
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                    <SelectorVista vista={vistaActual} onChange={setVistaActual} />

                    {/* Selector de usuario */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Ver calendario de:
                        </label>
                        <select
                            value={usuarioSeleccionado || ''}
                            onChange={(e) => setUsuarioSeleccionado(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[250px]"
                        >
                            {/* Placeholder si no hay selección */}
                            {!usuarioSeleccionado && (
                                <option value="">Selecciona un usuario...</option>
                            )}

                            {/* Si eres de marketing, puedes ver "Mi calendario" */}
                            {esMarketing && (
                                <option value={user.id}>Mi calendario</option>
                            )}

                            {/* Mostrar equipo de marketing */}
                            {equipoMarketing
                                .filter(m => ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(m.rol))
                                .filter(m => !esMarketing || m.id !== user.id) // Si eres de marketing, no duplicar tu ID
                                .map(miembro => (
                                    <option key={miembro.id} value={miembro.id}>
                                        {miembro.nombre_completo} ({miembro.rol === 'JEFE_MARKETING' ? 'Jefe' : 'Ejecutor'})
                                    </option>
                                ))
                            }
                        </select>

                        {/* Indicador de vista */}
                        {requiereSeleccion && (
                            <div className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                Vista de equipo
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Leyenda de colores */}
            <LeyendaColores />

            {/* Calendario principal */}
            {usuarioSeleccionado ? (
                <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
                    <CalendarioActividades
                        key={calendarioKey}
                        vista={vistaActual}
                        usuarioId={usuarioSeleccionado}
                    />
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
                    <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                        <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-600">Selecciona un usuario para ver su calendario</p>
                        <p className="text-sm text-gray-500 mt-2">Usa el selector superior para elegir un miembro del equipo</p>
                    </div>
                </div>
            )}

            {/* Modales */}
            {modalCrearAbierto && (
                <ModalCrearActividad
                    onClose={() => setModalCrearAbierto(false)}
                    onSuccess={handleActividadCreada}
                    usuarioId={usuarioSeleccionado || user?.id}
                    puedeEditar={puedeEditar}
                />
            )}

            {modalCargaMasivaAbierto && (
                <ModalCargaMasiva
                    onClose={() => setModalCargaMasivaAbierto(false)}
                    onSuccess={handleActividadCreada}
                />
            )}

            {modalGrupalAbierto && (
                <ModalActividadGrupal
                    onClose={() => setModalGrupalAbierto(false)}
                    onSuccess={handleActividadCreada}
                />
            )}

            {modalAusenciaAbierto && (
                <ModalRegistrarAusencia
                    onClose={() => setModalAusenciaAbierto(false)}
                    onSuccess={handleActividadCreada}
                />
            )}
        </div>
    );
};

export default MarketingPage;
