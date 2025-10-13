// frontend/src/components/common/NotificationToast.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

/**
 * 🍞 COMPONENTE TOAST PARA NOTIFICACIONES CRÍTICAS
 *
 * Aparece temporalmente en la esquina superior derecha
 * Auto-desaparece después de un tiempo configurable
 * Solo se usa para notificaciones críticas y urgentes
 */

const NotificationToast = ({ notification, onClose, duration = 8000 }) => {
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Animación de entrada
        const timer = setTimeout(() => setIsVisible(true), 10);

        // Auto-cierre
        const autoCloseTimer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => {
            clearTimeout(timer);
            clearTimeout(autoCloseTimer);
        };
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose?.();
        }, 300); // Duración de animación de salida
    };

    const getPriorityConfig = (prioridad) => {
        const configs = {
            critica: {
                bg: 'bg-red-50',
                border: 'border-red-500',
                text: 'text-red-900',
                icon: AlertTriangle,
                iconColor: 'text-red-600',
                button: 'bg-red-600 hover:bg-red-700',
                progressBar: 'bg-red-500'
            },
            alta: {
                bg: 'bg-orange-50',
                border: 'border-orange-500',
                text: 'text-orange-900',
                icon: AlertCircle,
                iconColor: 'text-orange-600',
                button: 'bg-orange-600 hover:bg-orange-700',
                progressBar: 'bg-orange-500'
            },
            media: {
                bg: 'bg-blue-50',
                border: 'border-blue-500',
                text: 'text-blue-900',
                icon: Info,
                iconColor: 'text-blue-600',
                button: 'bg-blue-600 hover:bg-blue-700',
                progressBar: 'bg-blue-500'
            },
            normal: {
                bg: 'bg-gray-50',
                border: 'border-gray-400',
                text: 'text-gray-900',
                icon: CheckCircle,
                iconColor: 'text-gray-600',
                button: 'bg-gray-600 hover:bg-gray-700',
                progressBar: 'bg-gray-500'
            }
        };

        return configs[prioridad] || configs.normal;
    };

    const config = getPriorityConfig(notification.prioridad);
    const Icon = config.icon;

    const handleActionClick = () => {
        if (notification.accion_url) {
            // Navegar a la URL
            if (notification.accion_url.startsWith('http')) {
                // URL externa - abrir en nueva pestaña
                window.open(notification.accion_url, '_blank');
            } else {
                // URL interna - usar React Router
                navigate(notification.accion_url);
            }
        }
        handleClose();
    };

    if (!isVisible && !isExiting) return null;

    return (
        <div
            className={`
                fixed top-20 right-4 z-[9999] w-96 max-w-[90vw]
                transform transition-all duration-300 ease-out
                ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
            role="alert"
            aria-live="assertive"
        >
            <div
                className={`
                    ${config.bg} ${config.border} border-l-4 rounded-lg shadow-2xl
                    overflow-hidden
                `}
            >
                {/* Header */}
                <div className="p-4">
                    <div className="flex items-start">
                        {/* Icono */}
                        <div className={`flex-shrink-0 ${config.iconColor}`}>
                            <Icon className="h-6 w-6" />
                        </div>

                        {/* Contenido */}
                        <div className="ml-3 flex-1">
                            {/* Título */}
                            <h3 className={`text-sm font-bold ${config.text}`}>
                                {notification.titulo}
                            </h3>

                            {/* Mensaje */}
                            <p className={`mt-1 text-sm ${config.text} opacity-90`}>
                                {notification.mensaje}
                            </p>

                            {/* Prospecto relacionado (si existe) */}
                            {notification.prospecto && (
                                <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                                    <div className="font-semibold">
                                        📋 {notification.prospecto.codigo} - {notification.prospecto.nombre_cliente}
                                    </div>
                                    {notification.prospecto.valor_estimado && (
                                        <div className="text-green-700 font-bold mt-1">
                                            💰 ${notification.prospecto.valor_estimado.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Botones de acción */}
                            <div className="mt-3 flex space-x-2">
                                {notification.accion_url && (
                                    <button
                                        onClick={handleActionClick}
                                        className={`
                                            ${config.button} text-white text-xs font-medium
                                            px-3 py-1.5 rounded-md transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-offset-2
                                        `}
                                    >
                                        {notification.accion_texto || 'Ver detalles'} →
                                    </button>
                                )}
                                <button
                                    onClick={handleClose}
                                    className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1.5"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        {/* Botón cerrar */}
                        <button
                            onClick={handleClose}
                            className={`ml-2 flex-shrink-0 ${config.text} opacity-60 hover:opacity-100 transition-opacity`}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Barra de progreso */}
                <div className="h-1 bg-gray-200 bg-opacity-50">
                    <div
                        className={`h-full ${config.progressBar} transition-all`}
                        style={{
                            animation: `shrink ${duration}ms linear`,
                            transformOrigin: 'left'
                        }}
                    />
                </div>
            </div>

            <style jsx>{`
                @keyframes shrink {
                    from {
                        width: 100%;
                    }
                    to {
                        width: 0%;
                    }
                }
            `}</style>
        </div>
    );
};

/**
 * 🍞 CONTENEDOR DE TOASTS
 * Maneja múltiples toasts apilados
 */
export const ToastContainer = ({ toasts, onRemoveToast }) => {
    return (
        <div className="fixed top-20 right-4 z-[9999] space-y-2">
            {toasts.map((toast, index) => (
                <NotificationToast
                    key={toast.id}
                    notification={toast}
                    onClose={() => onRemoveToast(toast.id)}
                    duration={toast.duration || 8000}
                />
            ))}
        </div>
    );
};

export default NotificationToast;
