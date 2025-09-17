// frontend/src/components/NotificationBell.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificaciones } from '../hooks/useNotificaciones';

const NotificationBell = () => {
    const [abierto, setAbierto] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const {
        notificaciones,
        contador,
        cargando,
        error,
        marcarLeida,
        marcarTodasLeidas,
        cargarNotificaciones
    } = useNotificaciones();

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setAbierto(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBellClick = () => {
        console.log('🔔 Campanita clickeada');
        setAbierto(!abierto);
        
        // Recargar notificaciones al abrir
        if (!abierto) {
            cargarNotificaciones();
        }
    };

    const handleNotificationClick = async (notificacion) => {
        console.log('📋 Notificación clickeada:', notificacion);
        
        try {
            // 1. Marcar como leída si no lo está
            if (!notificacion.leida) {
                await marcarLeida(notificacion.id);
            }
            
            // 2. Cerrar dropdown
            setAbierto(false);
            
            // 3. Navegar si tiene URL de acción
            if (notificacion.accion_url) {
                console.log(`🔗 Navegando a: ${notificacion.accion_url}`);
                
                // Verificar si es URL externa o interna
                if (notificacion.accion_url.startsWith('http')) {
                    // URL externa - abrir en nueva pestaña
                    window.open(notificacion.accion_url, '_blank');
                } else {
                    // URL interna - usar React Router
                    navigate(notificacion.accion_url);
                }
            } else if (notificacion.prospecto?.id) {
                // Fallback: navegar al prospecto si existe
                console.log(`🎯 Navegando a prospecto: ${notificacion.prospecto.id}`);
                navigate(`/prospectos`); // Ajusta según tu estructura de rutas
            }
            
        } catch (error) {
            console.error('❌ Error al manejar click de notificación:', error);
        }
    };

    const handleMarcarTodasLeidas = async () => {
        console.log('✅ Marcando todas como leídas');
        try {
            await marcarTodasLeidas();
            // Recargar para reflejar cambios
            setTimeout(() => cargarNotificaciones(), 500);
        } catch (error) {
            console.error('❌ Error marcando todas como leídas:', error);
        }
    };

    const obtenerIconoPorTipo = (tipo) => {
        const iconos = {
            'seguimiento_critico': '🚨',
            'seguimiento_urgente': '🚨',
            'seguimiento_vencido': '⏰',
            'seguimiento_proximo': '⏳',
            'prospecto_creado': '🎯',
            'prospecto_reasignado': '🔄',
            'seguimiento_completado': '✅',
            'meta_alcanzada': '🎉',
            'sistema': '⚙️',
            'manual': '📝'
        };
        return iconos[tipo] || '🔔';
    };

    const obtenerColorPorPrioridad = (prioridad) => {
        const colores = {
            'critica': 'bg-red-100 border-red-400 text-red-800',
            'alta': 'bg-orange-100 border-orange-400 text-orange-800',
            'media': 'bg-yellow-100 border-yellow-400 text-yellow-800',
            'normal': 'bg-blue-100 border-blue-400 text-blue-800'
        };
        return colores[prioridad] || colores.normal;
    };

    const obtenerColorFondo = (notificacion) => {
        if (!notificacion.leida) {
            switch (notificacion.prioridad) {
                case 'critica':
                    return 'bg-red-50 border-l-4 border-l-red-500';
                case 'alta':
                    return 'bg-orange-50 border-l-4 border-l-orange-500';
                case 'media':
                    return 'bg-yellow-50 border-l-4 border-l-yellow-500';
                default:
                    return 'bg-blue-50 border-l-4 border-l-blue-500';
            }
        }
        return 'bg-gray-50';
    };

    const formatearTiempo = (fecha) => {
        const ahora = new Date();
        const fechaNotif = new Date(fecha);
        const difMinutos = Math.floor((ahora - fechaNotif) / (1000 * 60));

        if (difMinutos < 1) return 'Ahora';
        if (difMinutos < 60) return `${difMinutos}m`;
        if (difMinutos < 1440) return `${Math.floor(difMinutos / 60)}h`;
        return `${Math.floor(difMinutos / 1440)}d`;
    };

    const obtenerTextoUrgencia = (prioridad) => {
        const textos = {
            'critica': 'CRÍTICO',
            'alta': 'URGENTE',
            'media': 'Importante',
            'normal': 'Normal'
        };
        return textos[prioridad] || '';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Campanita */}
            <button
                onClick={handleBellClick}
                className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
                title={`${contador} notificaciones no leídas`}
            >
                <span className="text-lg">🔔</span>
                
                {/* Contador dinámico con animación */}
                {contador > 0 && (
                    <span 
                        className={`absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full text-xs text-white flex items-center justify-center font-medium ${
                            contador > 5 ? 'bg-red-600 animate-pulse' : 'bg-red-500'
                        }`}
                    >
                        {contador > 99 ? '99+' : contador}
                    </span>
                )}
                
                {/* Indicador de carga */}
                {cargando && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping"></span>
                )}
            </button>

            {/* Dropdown de notificaciones */}
            {abierto && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Notificaciones
                            {contador > 0 && (
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                    ({contador} sin leer)
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center space-x-2">
                            {/* Botón recargar */}
                            <button
                                onClick={cargarNotificaciones}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                                title="Recargar notificaciones"
                                disabled={cargando}
                            >
                                <span className={cargando ? 'animate-spin' : ''}>🔄</span>
                            </button>
                            
                            {/* Marcar todas como leídas */}
                            {contador > 0 && (
                                <button
                                    onClick={handleMarcarTodasLeidas}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    Marcar todas
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Mensaje de error */}
                    {error && (
                        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
                            <p className="text-sm text-red-600">
                                ❌ Error: {error}
                            </p>
                        </div>
                    )}

                    {/* Lista de notificaciones */}
                    <div className="flex-1 overflow-y-auto max-h-96">
                        {cargando ? (
                            <div className="p-8 text-center text-gray-500">
                                <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                <p>Cargando notificaciones...</p>
                            </div>
                        ) : notificaciones.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <div className="text-5xl mb-4">🔔</div>
                                <p className="text-lg mb-2">No tienes notificaciones</p>
                                <p className="text-sm text-gray-400">Las notificaciones aparecerán aquí</p>
                            </div>
                        ) : (
                            notificaciones.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-all duration-200 ${
                                        obtenerColorFondo(notif)
                                    }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        {/* Icono con prioridad */}
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg border-2 ${
                                            obtenerColorPorPrioridad(notif.prioridad)
                                        }`}>
                                            {obtenerIconoPorTipo(notif.tipo)}
                                        </div>

                                        {/* Contenido */}
                                        <div className="flex-1 min-w-0">
                                            {/* Título con indicador de urgencia */}
                                            <div className="flex items-center justify-between mb-1">
                                                <p className={`text-sm font-semibold ${
                                                    !notif.leida ? 'text-gray-900' : 'text-gray-600'
                                                }`}>
                                                    {notif.titulo}
                                                </p>
                                                {(notif.prioridad === 'critica' || notif.prioridad === 'alta') && (
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                        notif.prioridad === 'critica' 
                                                            ? 'bg-red-100 text-red-700' 
                                                            : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {obtenerTextoUrgencia(notif.prioridad)}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Mensaje */}
                                            <p className="text-sm text-gray-600 mb-2 leading-relaxed">
                                                {notif.mensaje}
                                            </p>
                                            
                                            {/* Prospecto relacionado */}
                                            {notif.prospecto && (
                                                <div className="bg-gray-50 rounded-lg p-2 mb-2 border">
                                                    <p className="text-xs font-medium text-blue-700 mb-1">
                                                        📋 {notif.prospecto.codigo} - {notif.prospecto.nombre_cliente}
                                                    </p>
                                                    {notif.prospecto.telefono && (
                                                        <p className="text-xs text-gray-600">
                                                            📞 {notif.prospecto.telefono}
                                                        </p>
                                                    )}
                                                    {notif.prospecto.valor_estimado && (
                                                        <p className="text-xs text-green-600 font-medium">
                                                            💰 ${notif.prospecto.valor_estimado}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer con tiempo y acción */}
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400">
                                                    {formatearTiempo(notif.created_at)}
                                                    {notif.leida && notif.leida_en && (
                                                        <span className="ml-2 text-green-600">✓ Leída</span>
                                                    )}
                                                </span>
                                                
                                                {notif.accion_texto && (
                                                    <span className={`text-xs font-semibold ${
                                                        notif.prioridad === 'critica' 
                                                            ? 'text-red-600' 
                                                            : 'text-blue-600'
                                                    }`}>
                                                        {notif.accion_texto} →
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Indicador no leída */}
                                        {!notif.leida && (
                                            <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-2 ${
                                                notif.prioridad === 'critica' ? 'bg-red-500' :
                                                notif.prioridad === 'alta' ? 'bg-orange-500' :
                                                'bg-blue-500'
                                            }`}></div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer con estadísticas */}
                    {notificaciones.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                            <p className="text-xs text-gray-500 text-center">
                                {notificaciones.length} notificaciones • {contador} sin leer
                                {notificaciones.filter(n => n.prioridad === 'critica').length > 0 && (
                                    <span className="ml-2 text-red-600 font-medium">
                                        • {notificaciones.filter(n => n.prioridad === 'critica').length} críticas
                                    </span>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;