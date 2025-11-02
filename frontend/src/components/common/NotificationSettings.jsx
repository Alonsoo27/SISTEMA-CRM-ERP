// ============================================
// CONFIGURACIÓN DE NOTIFICACIONES
// Componente para gestionar permisos de notificaciones de escritorio
// ============================================

import { useState, useEffect } from 'react';
import notificationService from '../../services/notificationService';

const NotificationSettings = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState('default');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        updateStatus();
    }, []);

    const updateStatus = () => {
        setIsSupported(notificationService.isSupported());
        setPermissionStatus(notificationService.getPermissionStatus());
    };

    const handleRequestPermission = async () => {
        setLoading(true);
        try {
            const granted = await notificationService.requestPermission();
            updateStatus();

            if (granted) {
                alert('✅ Notificaciones habilitadas correctamente');
            }
        } catch (error) {
            console.error('Error solicitando permisos:', error);
            alert('❌ Error al solicitar permisos de notificación');
        } finally {
            setLoading(false);
        }
    };

    const handleTestNotification = () => {
        notificationService.notificar(
            '🧪 Notificación de Prueba',
            'Si ves esto, las notificaciones están funcionando correctamente'
        );
    };

    // Si no está soportado
    if (!isSupported) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-2xl">🔔</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Notificaciones de Escritorio
                        </h3>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                <strong>⚠️ No soportado:</strong> Tu navegador no soporta notificaciones de escritorio.
                                Considera usar Chrome, Firefox, Edge o Safari actualizado.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-2xl">🔔</span>
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Notificaciones de Escritorio
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Recibe alertas en tu escritorio para eventos críticos como actividades vencidas,
                        tickets urgentes y seguimientos importantes.
                    </p>

                    {/* Estado actual */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Estado:</span>
                            {permissionStatus === 'granted' && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                    ✓ Habilitadas
                                </span>
                            )}
                            {permissionStatus === 'denied' && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                    ✗ Bloqueadas
                                </span>
                            )}
                            {permissionStatus === 'default' && (
                                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                    ⊝ No configuradas
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Casos de uso */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Recibirás notificaciones para:</p>
                        <ul className="space-y-1 text-sm text-gray-600">
                            <li className="flex items-center gap-2">
                                <span className="text-amber-500">⚠️</span>
                                Actividades vencidas que requieren gestión
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-red-500">🚨</span>
                                Tickets de soporte urgentes
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-blue-500">📞</span>
                                Seguimientos críticos de ventas
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-purple-500">⏰</span>
                                Actividades próximas a vencer (30 min antes)
                            </li>
                        </ul>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-3">
                        {permissionStatus === 'default' && (
                            <button
                                onClick={handleRequestPermission}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Solicitando...
                                    </>
                                ) : (
                                    <>
                                        <span>🔔</span>
                                        Habilitar Notificaciones
                                    </>
                                )}
                            </button>
                        )}

                        {permissionStatus === 'granted' && (
                            <button
                                onClick={handleTestNotification}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                            >
                                <span>🧪</span>
                                Probar Notificación
                            </button>
                        )}

                        {permissionStatus === 'denied' && (
                            <div className="text-sm text-gray-600">
                                <p className="mb-2">
                                    <strong>Cómo desbloquear:</strong>
                                </p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Haz clic en el ícono del candado 🔒 en la barra de direcciones</li>
                                    <li>Busca "Notificaciones" y cámbialo a "Permitir"</li>
                                    <li>Recarga la página</li>
                                </ol>
                            </div>
                        )}
                    </div>

                    {/* Nota de privacidad */}
                    <div className="mt-4 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded p-3">
                        <strong>🔒 Privacidad:</strong> Las notificaciones son locales y no se envían a servidores externos.
                        Solo aparecen mientras navegas en el sistema.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationSettings;
