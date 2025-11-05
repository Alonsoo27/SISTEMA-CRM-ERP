// ============================================
// PÁGINA PRINCIPAL - MARKETING
// Sistema de planificación de actividades
// ============================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CalendarioActividades from '../components/marketing/CalendarioActividades/CalendarioActividades';
import IndicadoresMarketing from '../components/marketing/Indicadores/IndicadoresMarketing';
import ReportesMarketing from '../components/marketing/Reportes/ReportesMarketing';
import ModalCrearActividad from '../components/marketing/ModalCrearActividad';
import ModalCargaMasiva from '../components/marketing/ModalCargaMasiva';
import ModalActividadGrupal from '../components/marketing/ModalActividadGrupal';
import ModalRegistrarAusencia from '../components/marketing/ModalRegistrarAusencia';
import ModalGestionarVencida from '../components/marketing/ModalGestionarVencida';
import SelectorVista from '../components/marketing/SelectorVista';
import LeyendaColores from '../components/marketing/LeyendaColores';
import marketingService from '../services/marketingService';
import notificationService from '../services/notificationService';

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

    const [pestanaActiva, setPestanaActiva] = useState('calendario'); // calendario | indicadores | reportes
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

    // Estados para sistema de actividades vencidas
    const [actividadesVencidas, setActividadesVencidas] = useState([]); // Array de actividades vencidas pendientes
    const [indiceActividadActual, setIndiceActividadActual] = useState(0); // Índice de la actividad que se está mostrando
    const [modalVencidaAbierto, setModalVencidaAbierto] = useState(false);
    const [actividadesPospuestas, setActividadesPospuestas] = useState(new Map()); // Map<actividadId, timestamp>
    const pollingIntervalRef = useRef(null);

    // Estados para notificaciones preventivas (15 min antes)
    const [actividadesNotificadas, setActividadesNotificadas] = useState(new Set()); // Set<actividadId> para evitar duplicados
    const pollingPreventivoRef = useRef(null);

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

        // Solicitar permisos de notificaciones a TODOS los usuarios que entran al módulo
        notificationService.ensurePermission().then(granted => {
            if (granted) {
                console.log('✅ Notificaciones de escritorio habilitadas');
            } else {
                console.log('ℹ️ Notificaciones de escritorio no habilitadas');
            }
        });
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

    // ============================================
    // SISTEMA DE POLLING PARA ACTIVIDADES VENCIDAS
    // ============================================

    /**
     * Verifica si una actividad puede mostrarse (no está pospuesta o ya expiró el postpone)
     */
    const puedeMostrarActividad = useCallback((actividadId) => {
        if (!actividadesPospuestas.has(actividadId)) {
            return true;
        }

        const timestampPospuesto = actividadesPospuestas.get(actividadId);
        const ahora = Date.now();
        const cincoMinutos = 5 * 60 * 1000;

        // Si ya pasaron 5 minutos desde que se pospuso, puede mostrarse
        if (ahora - timestampPospuesto >= cincoMinutos) {
            // Limpiar del Map
            setActividadesPospuestas(prev => {
                const nuevo = new Map(prev);
                nuevo.delete(actividadId);
                return nuevo;
            });
            return true;
        }

        return false;
    }, [actividadesPospuestas]);

    /**
     * Detecta actividades vencidas que requieren gestión
     */
    const detectarActividadesVencidas = useCallback(async () => {
        // Solo verificar si hay un usuario seleccionado y es de marketing
        if (!usuarioSeleccionado || !esMarketing) {
            return;
        }

        // Solo verificar para el usuario logueado (no mostrar alertas de otros usuarios)
        if (usuarioSeleccionado !== user.id) {
            return;
        }

        try {
            const response = await marketingService.detectarActividadesVencidas(usuarioSeleccionado);

            // Validar que la respuesta existe y tiene el formato esperado
            if (!response) {
                console.warn('⚠️ detectarActividadesVencidas retornó undefined');
                return;
            }

            if (!response.success) {
                console.warn('⚠️ detectarActividadesVencidas falló:', response.message || 'Sin mensaje');
                return;
            }

            if (response.actividades && response.actividades.length > 0) {
                // Filtrar TODAS las actividades que no estén pospuestas
                const actividadesParaMostrar = response.actividades.filter(act =>
                    puedeMostrarActividad(act.id)
                );

                // Si hay actividades pendientes y NO hay un modal abierto actualmente
                if (actividadesParaMostrar.length > 0 && !modalVencidaAbierto) {
                    console.log(`📋 ${actividadesParaMostrar.length} actividad(es) vencida(s) detectada(s)`);

                    // 🔔 NOTIFICACIÓN DE ESCRITORIO
                    if (actividadesParaMostrar.length === 1) {
                        notificationService.notificarActividadVencida(actividadesParaMostrar[0]);
                    } else {
                        notificationService.notificarActividadesVencidas(actividadesParaMostrar.length);
                    }

                    setActividadesVencidas(actividadesParaMostrar);
                    setIndiceActividadActual(0);
                    setModalVencidaAbierto(true);
                }
            }
        } catch (error) {
            console.error('Error detectando actividades vencidas:', error);
            // No mostrar error al usuario para no interrumpir su flujo
        }
    }, [usuarioSeleccionado, esMarketing, user.id, puedeMostrarActividad, modalVencidaAbierto]);

    /**
     * Detectar actividades próximas a vencer (notificación preventiva 15 min antes)
     */
    const detectarActividadesProximasVencer = useCallback(async () => {
        // Solo verificar si hay un usuario seleccionado y es de marketing
        if (!usuarioSeleccionado || !esMarketing) {
            return;
        }

        // Solo verificar para el usuario logueado (no mostrar alertas de otros usuarios)
        if (usuarioSeleccionado !== user.id) {
            return;
        }

        try {
            const response = await marketingService.detectarActividadesProximasVencer(usuarioSeleccionado, 15);

            // Validar que la respuesta existe y tiene el formato esperado
            if (!response) {
                console.warn('⚠️ detectarActividadesProximasVencer retornó undefined');
                return;
            }

            if (!response.success) {
                console.warn('⚠️ detectarActividadesProximasVencer falló:', response.message || 'Sin mensaje');
                return;
            }

            if (response.actividades && response.actividades.length > 0) {
                response.actividades.forEach(actividad => {
                    // Solo notificar si no ha sido notificada antes
                    if (!actividadesNotificadas.has(actividad.id)) {
                        const minutosRestantes = Math.round(actividad.minutos_restantes);
                        console.log(`⏰ Actividad próxima a vencer: "${actividad.descripcion}" en ${minutosRestantes} minutos`);

                        // Notificar en escritorio
                        notificationService.notificarActividadProximaVencer(actividad, minutosRestantes);

                        // Marcar como notificada
                        setActividadesNotificadas(prev => new Set(prev).add(actividad.id));
                    }
                });
            }
        } catch (error) {
            console.error('Error detectando actividades próximas a vencer:', error);
            // No mostrar error al usuario para no interrumpir su flujo
        }
    }, [usuarioSeleccionado, esMarketing, user.id, actividadesNotificadas]);

    /**
     * Gestionar actividad vencida con una acción específica
     */
    const handleGestionarVencida = async (accion, datos) => {
        try {
            const actividadActual = actividadesVencidas[indiceActividadActual];

            const response = await marketingService.gestionarActividadVencida(
                actividadActual.id,
                accion,
                datos
            );

            if (response.success) {
                // Si la acción fue "posponer", registrar en el Map
                if (accion === 'posponer') {
                    setActividadesPospuestas(prev => {
                        const nuevo = new Map(prev);
                        nuevo.set(actividadActual.id, Date.now());
                        return nuevo;
                    });
                }

                // Recargar calendario
                setCalendarioKey(prev => prev + 1);

                // Verificar si hay más actividades pendientes
                const siguienteIndice = indiceActividadActual + 1;
                const hayMasActividades = siguienteIndice < actividadesVencidas.length;

                if (hayMasActividades) {
                    // Avanzar a la siguiente actividad inmediatamente
                    console.log(`✅ Actividad ${indiceActividadActual + 1}/${actividadesVencidas.length} gestionada. Mostrando siguiente...`);
                    setIndiceActividadActual(siguienteIndice);
                    // El modal permanece abierto
                } else {
                    // No hay más actividades, cerrar modal
                    console.log(`✅ Todas las actividades vencidas han sido gestionadas (${actividadesVencidas.length}/${actividadesVencidas.length})`);
                    setModalVencidaAbierto(false);
                    setActividadesVencidas([]);
                    setIndiceActividadActual(0);

                    // Mostrar mensaje de éxito final
                    alert('✓ Todas las actividades vencidas han sido gestionadas');
                }
            }
        } catch (error) {
            console.error('Error gestionando actividad vencida:', error);
            throw error; // Re-throw para que el modal maneje el error
        }
    };

    // ============================================
    // EFECTO: Iniciar/detener polling (vencidas)
    // ============================================

    useEffect(() => {
        // Solo iniciar polling si:
        // 1. Hay un usuario seleccionado
        // 2. Es el usuario logueado (no alertar por otros usuarios)
        // 3. Es usuario de marketing
        const debeIniciarPolling = usuarioSeleccionado === user.id && esMarketing;

        if (debeIniciarPolling) {
            // Verificar inmediatamente al cargar
            detectarActividadesVencidas();

            // Luego verificar cada 30 segundos
            pollingIntervalRef.current = setInterval(() => {
                detectarActividadesVencidas();
            }, 30000); // 30 segundos

            console.log('✅ Polling de actividades vencidas iniciado');
        } else {
            // Limpiar polling si cambia de usuario o no aplica
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                console.log('⏸️ Polling de actividades vencidas detenido');
            }
        }

        // Cleanup al desmontar o cambiar dependencias
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [usuarioSeleccionado, user.id, esMarketing, detectarActividadesVencidas]);

    // ============================================
    // EFECTO: Polling preventivo (15 min antes de vencer)
    // ============================================

    useEffect(() => {
        const debeIniciarPolling = usuarioSeleccionado === user.id && esMarketing;

        if (debeIniciarPolling) {
            // Verificar inmediatamente al cargar
            detectarActividadesProximasVencer();

            // Luego verificar cada 2 minutos (más frecuente para alertas preventivas)
            pollingPreventivoRef.current = setInterval(() => {
                detectarActividadesProximasVencer();
            }, 120000); // 2 minutos

            console.log('✅ Polling preventivo (15 min antes) iniciado');
        } else {
            // Limpiar polling si cambia de usuario o no aplica
            if (pollingPreventivoRef.current) {
                clearInterval(pollingPreventivoRef.current);
                pollingPreventivoRef.current = null;
                console.log('⏸️ Polling preventivo detenido');
            }
        }

        // Cleanup al desmontar o cambiar dependencias
        return () => {
            if (pollingPreventivoRef.current) {
                clearInterval(pollingPreventivoRef.current);
                pollingPreventivoRef.current = null;
            }
        };
    }, [usuarioSeleccionado, user.id, esMarketing, detectarActividadesProximasVencer]);

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

                {/* Pestañas de navegación */}
                <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
                    <button
                        onClick={() => setPestanaActiva('calendario')}
                        className={`
                            flex-1 px-6 py-3 rounded-lg font-medium transition-all
                            ${pestanaActiva === 'calendario'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100'
                            }
                        `}
                    >
                        📅 Calendario
                    </button>
                    <button
                        onClick={() => setPestanaActiva('indicadores')}
                        className={`
                            flex-1 px-6 py-3 rounded-lg font-medium transition-all
                            ${pestanaActiva === 'indicadores'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100'
                            }
                        `}
                    >
                        📊 Indicadores
                    </button>
                    <button
                        onClick={() => setPestanaActiva('reportes')}
                        className={`
                            flex-1 px-6 py-3 rounded-lg font-medium transition-all
                            ${pestanaActiva === 'reportes'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100'
                            }
                        `}
                    >
                        📄 Reportes
                    </button>
                </div>

                {/* Selector de vista y filtros - Solo visible en pestaña Calendario */}
                {pestanaActiva === 'calendario' && (
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
                )}
            </div>

            {/* Leyenda de colores - Solo visible en pestaña Calendario */}
            {pestanaActiva === 'calendario' && <LeyendaColores />}

            {/* Contenido de la pestaña activa */}
            <div className="mt-4">
                {/* PESTAÑA: CALENDARIO */}
                {pestanaActiva === 'calendario' && (
                    usuarioSeleccionado ? (
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <CalendarioActividades
                                key={calendarioKey}
                                vista={vistaActual}
                                usuarioId={usuarioSeleccionado}
                            />
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                                <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-lg font-medium text-gray-600">Selecciona un usuario para ver su calendario</p>
                                <p className="text-sm text-gray-500 mt-2">Usa el selector superior para elegir un miembro del equipo</p>
                            </div>
                        </div>
                    )
                )}

                {/* PESTAÑA: INDICADORES */}
                {pestanaActiva === 'indicadores' && (
                    <IndicadoresMarketing
                        usuarioId={usuarioSeleccionado || user?.id}
                        esJefe={esJefe}
                    />
                )}

                {/* PESTAÑA: REPORTES */}
                {pestanaActiva === 'reportes' && (
                    <ReportesMarketing
                        usuarioId={usuarioSeleccionado || user?.id}
                        esJefe={esJefe}
                    />
                )}
            </div>

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

            {/* Modal para gestionar actividades vencidas */}
            {modalVencidaAbierto && actividadesVencidas.length > 0 && indiceActividadActual < actividadesVencidas.length && (
                <ModalGestionarVencida
                    actividad={actividadesVencidas[indiceActividadActual]}
                    indiceActual={indiceActividadActual + 1}
                    totalActividades={actividadesVencidas.length}
                    onClose={() => {
                        setModalVencidaAbierto(false);
                        setActividadesVencidas([]);
                        setIndiceActividadActual(0);
                    }}
                    onSuccess={handleGestionarVencida}
                />
            )}
        </div>
    );
};

export default MarketingPage;
