// frontend/src/hooks/useNotificaciones.js
import { useState, useEffect, useCallback, useRef } from 'react';
import notificacionesService from '../services/notificacionesService';

export const useNotificaciones = () => {
    const [notificaciones, setNotificaciones] = useState([]);
    const [contador, setContador] = useState(0);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
    const [conexionOk, setConexionOk] = useState(true);

    // 🍞 NUEVO: Estado para toasts
    const [toasts, setToasts] = useState([]);
    const [notificacionesVistas, setNotificacionesVistas] = useState(new Set());

    // Referencias para prevenir memory leaks
    const mountedRef = useRef(true);
    const intervalRef = useRef(null);
    const retryTimeoutRef = useRef(null);

    // 🍞 Función para agregar toast
    const agregarToast = useCallback((notificacion) => {
        if (!mountedRef.current) return;

        // Verificar si ya mostramos esta notificación como toast
        if (notificacionesVistas.has(notificacion.id)) {
            return;
        }

        // Marcar como vista
        setNotificacionesVistas(prev => new Set([...prev, notificacion.id]));

        // Agregar toast
        const toast = {
            ...notificacion,
            toastId: `toast-${notificacion.id}-${Date.now()}`,
            duration: notificacion.prioridad === 'critica' ? 10000 : 8000
        };

        setToasts(prev => [...prev, toast]);

        if (process.env.NODE_ENV === 'development') {
            console.log(`🍞 Toast mostrado para notificación ${notificacion.id} (${notificacion.prioridad})`);
        }
    }, [notificacionesVistas]);

    // 🍞 Función para remover toast
    const removerToast = useCallback((toastId) => {
        if (!mountedRef.current) return;
        setToasts(prev => prev.filter(t => t.toastId !== toastId));
    }, []);

    // Función para cargar todas las notificaciones
    const cargarNotificaciones = useCallback(async (mostrarLoading = true) => {
        if (!mountedRef.current) return;

        if (mostrarLoading) setCargando(true);
        setError(null);

        try {
            const result = await notificacionesService.obtenerNotificaciones();

            if (!mountedRef.current) return;

            if (result.success) {
                const notificacionesNuevas = result.data;

                // 🍞 NUEVO: Detectar notificaciones críticas/altas nuevas y mostrarlas como toast
                if (notificaciones.length > 0) {
                    // Solo en recargas (no en la carga inicial)
                    notificacionesNuevas.forEach(notif => {
                        // Si es nueva (no leída) y no existía antes
                        const esNueva = !notificaciones.some(n => n.id === notif.id);
                        const esCriticaOAlta = ['critica', 'alta'].includes(notif.prioridad);
                        const noLeida = !notif.leida;

                        if (esNueva && esCriticaOAlta && noLeida) {
                            agregarToast(notif);
                        }
                    });
                }

                setNotificaciones(notificacionesNuevas);
                setContador(result.total_no_leidas);
                setUltimaActualizacion(new Date());
                setConexionOk(true);

                // Solo log en development
                if (process.env.NODE_ENV === 'development') {
                    console.log(`✅ Notificaciones cargadas: ${result.data.length} total, ${result.total_no_leidas} no leídas`);
                }
            } else {
                throw new Error(result.error || 'Error obteniendo notificaciones');
            }
        } catch (err) {
            console.error('❌ Error cargando notificaciones:', err);
            
            if (mountedRef.current) {
                setError(err.message);
                setNotificaciones([]);
                setContador(0);
                setConexionOk(false);

                // Retry automático para errores de red
                if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
                    retryTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            cargarNotificaciones(false);
                        }
                    }, 5000);
                }
            }
        } finally {
            if (mountedRef.current) {
                setCargando(false);
            }
        }
    }, []);

    // Función para actualizar solo el contador
    const actualizarContador = useCallback(async () => {
        if (!mountedRef.current) return;

        try {
            const result = await notificacionesService.obtenerContador();

            if (mountedRef.current) {
                if (result.success) {
                    setContador(result.contador);
                    setConexionOk(true);
                } else {
                    console.warn('⚠️ Error actualizando contador:', result.error);
                }
            }
        } catch (err) {
            console.error('❌ Error actualizando contador:', err);
            if (mountedRef.current) {
                setConexionOk(false);
            }
        }
    }, []);

    // Función combinada de refresh
    const refrescar = useCallback(async (mostrarLoading = true) => {
        await Promise.all([
            cargarNotificaciones(mostrarLoading),
            actualizarContador()
        ]);
    }, [cargarNotificaciones, actualizarContador]);

    // Función para marcar una notificación como leída
    const marcarLeida = useCallback(async (id) => {
        if (!mountedRef.current) return { success: false };

        try {
            const notificacionOriginal = notificaciones.find(n => n.id === parseInt(id));
            if (!notificacionOriginal) {
                return { success: false, error: 'Notificación no encontrada' };
            }

            const wasAlreadyRead = notificacionOriginal.leida;

            // Optimistic update
            setNotificaciones(prev =>
                prev.map(notif =>
                    notif.id === parseInt(id)
                        ? { ...notif, leida: true, fecha_leida: new Date().toISOString() }
                        : notif
                )
            );

            if (!wasAlreadyRead) {
                setContador(prev => Math.max(0, prev - 1));
            }

            const result = await notificacionesService.marcarLeida(id);

            if (result.success) {
                if (mountedRef.current) {
                    setConexionOk(true);
                }
                return result;
            } else {
                throw new Error(result.error || 'Error marcando como leída');
            }

        } catch (err) {
            console.error(`❌ Error marcando notificación ${id} como leída:`, err);
            
            // Rollback del optimistic update
            if (mountedRef.current) {
                setNotificaciones(prev =>
                    prev.map(notif =>
                        notif.id === parseInt(id)
                            ? { ...notif, leida: false, fecha_leida: null }
                            : notif
                    )
                );

                setContador(prev => prev + 1);
                setError(err.message);
                setConexionOk(false);

                setTimeout(() => {
                    if (mountedRef.current) {
                        refrescar(false);
                    }
                }, 1000);
            }

            return { success: false, error: err.message };
        }
    }, [notificaciones, refrescar]);

    // Función para marcar todas como leídas
    const marcarTodasLeidas = useCallback(async () => {
        if (!mountedRef.current) return { success: false };

        try {
            // Optimistic update
            setNotificaciones(prev =>
                prev.map(notif => ({ 
                    ...notif, 
                    leida: true, 
                    fecha_leida: new Date().toISOString() 
                }))
            );
            setContador(0);

            const result = await notificacionesService.marcarTodasLeidas();

            if (result.success) {
                if (mountedRef.current) {
                    setConexionOk(true);
                }
                return result;
            } else {
                throw new Error(result.error || 'Error marcando todas como leídas');
            }

        } catch (err) {
            console.error('❌ Error marcando todas como leídas:', err);
            
            if (mountedRef.current) {
                setError(err.message);
                setConexionOk(false);
                refrescar(false);
            }

            return { success: false, error: err.message };
        }
    }, [notificaciones, contador, refrescar]);

    // Función para testear la conexión
    const testearConexion = useCallback(async () => {
        try {
            const result = await notificacionesService.testConexion();
            const conectado = result.success;
            
            if (mountedRef.current) {
                setConexionOk(conectado);
            }
            
            return conectado;
            
        } catch (err) {
            console.error('❌ Error en test de conexión:', err);
            if (mountedRef.current) {
                setConexionOk(false);
            }
            return false;
        }
    }, []);

    // Control de polling inteligente
    const iniciarPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            if (document.hidden) return;

            if (mountedRef.current) {
                refrescar(false);
            }
        }, 30000);
    }, [refrescar]);

    const detenerPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // ✅ FUNCIONA: Mantener la lógica exacta que funcionaba
    useEffect(() => {
        mountedRef.current = true;
        
        testearConexion().then(conectado => {
            if (process.env.NODE_ENV === 'development') {
                console.log('🔍 testearConexion resultado:', conectado);
            }
            cargarNotificaciones(); // Siempre cargar
        });

        return () => {
            mountedRef.current = false;
            
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [testearConexion, cargarNotificaciones]); // ✅ CRÍTICO: Mantener dependencias

    // Efecto para polling automático
    useEffect(() => {
        iniciarPolling();
        return () => detenerPolling();
    }, [iniciarPolling, detenerPolling]);

    // Efecto para reanudar polling cuando página vuelve a ser visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && mountedRef.current) {
                refrescar(false);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refrescar]);

    return {
        // Estados principales
        notificaciones,
        contador,
        cargando,
        error,

        // 🍞 NUEVO: Estados y funciones de toast
        toasts,
        agregarToast,
        removerToast,

        // Funciones principales
        cargarNotificaciones,
        actualizarContador,
        marcarLeida,
        marcarTodasLeidas,
        testearConexion,

        // Funciones útiles
        refrescar,
        iniciarPolling,
        detenerPolling,

        // Utilidades
        hayNotificaciones: notificaciones.length > 0,
        hayNoLeidas: contador > 0,
        ultimaActualizacion: ultimaActualizacion?.toISOString() || new Date().toISOString(),

        // Estado de conexión
        conexionOk,
        estadisticas: {
            total: notificaciones.length,
            noLeidas: contador,
            leidas: notificaciones.length - contador,
            ultimaActualizacion,
            toastsActivos: toasts.length
        }
    };
};