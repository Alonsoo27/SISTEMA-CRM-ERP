// ============================================
// ESTADO ACTIVIDAD HOY - WIDGET CORREGIDO
// Componente para mostrar estado de check-in/check-out en dashboard de ventas
// ============================================

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, Calendar, Phone, MessageSquare } from 'lucide-react';
import actividadService from '../../../services/actividadService';

const EstadoActividadHoy = ({ onCheckIn, onCheckOut, onViewDetails }) => {
    const [estadoActividad, setEstadoActividad] = useState(null);
    const [loading, setLoading] = useState(true);
    const [horaActual, setHoraActual] = useState(new Date());

    // Actualizar hora cada minuto
    useEffect(() => {
        const interval = setInterval(() => {
            setHoraActual(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Cargar estado de actividad del día
    useEffect(() => {
        cargarEstadoHoy();
    }, []);

    const cargarEstadoHoy = async () => {
        try {
            setLoading(true);
            
            const response = await actividadService.getEstadoHoy();
            
            if (response.success) {
                setEstadoActividad(response.data);
            } else {
                console.error('Error al cargar estado de actividad:', response.error);
                setEstadoActividad(null);
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            setEstadoActividad(null);
        } finally {
            setLoading(false);
        }
    };

    // ✅ FUNCIONES CORREGIDAS - USAR DATOS REALES DEL BACKEND (SIN OVERRIDE)
    const checkInRealizado = () => {
        return estadoActividad?.jornada?.check_in_realizado || false;
    };

    const checkOutRealizado = () => {
        return estadoActividad?.jornada?.check_out_realizado || false;
    };

    const puedeHacerCheckIn = () => {
        // ✅ USAR DATOS REALES DEL BACKEND (YA CORREGIDO)
        return estadoActividad?.jornada?.puede_check_in || false;
    };

    const puedeHacerCheckOut = () => {
        // ✅ USAR DATOS REALES DEL BACKEND (YA CORREGIDO)
        return estadoActividad?.jornada?.puede_check_out || false;
    };

    const formatearHora = (fechaHora) => {
        if (!fechaHora) return '--:--';
        return new Date(fechaHora).toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // ✅ OBTENER HORAS DE CHECK-IN/OUT (DATOS REALES DEL BACKEND)
    const getCheckInTime = () => {
        return estadoActividad?.jornada?.hora_check_in || null;
    };

    const getCheckOutTime = () => {
        return estadoActividad?.jornada?.hora_check_out || null;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-300 h-10 w-10"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Actividad de Hoy</h3>
                </div>
                <div className="text-sm text-gray-500">
                    {estadoActividad?.horarios?.hora_actual || horaActual.toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>

            {/* DEBUG INFO REMOVIDO - SISTEMA FUNCIONANDO CORRECTAMENTE */}

            {/* Estado Check-in/Check-out */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Check-in */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                        {checkInRealizado() ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                            <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-700">Check-in</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                        {formatearHora(getCheckInTime())}
                    </div>
                    {checkInRealizado() && (
                        <div className="text-xs text-green-600 mt-1">✅ Completado</div>
                    )}
                    {!checkInRealizado() && puedeHacerCheckIn() && (
                        <button
                            onClick={onCheckIn}
                            className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                        >
                            Hacer Check-in
                        </button>
                    )}
                    {!checkInRealizado() && !puedeHacerCheckIn() && (
                        <div className="text-xs text-gray-500 mt-1">
                            {estadoActividad?.horarios?.ventana_check_in || 'Disponible: 8:00 AM - 2:00 PM'}
                        </div>
                    )}
                </div>

                {/* Check-out */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                        {checkOutRealizado() ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                            <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-700">Check-out</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                        {formatearHora(getCheckOutTime())}
                    </div>
                    {checkOutRealizado() && (
                        <div className="text-xs text-green-600 mt-1">✅ Completado</div>
                    )}
                    {!checkOutRealizado() && puedeHacerCheckOut() && (
                        <button
                            onClick={onCheckOut}
                            className="mt-2 text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 transition-colors"
                        >
                            Hacer Check-out
                        </button>
                    )}
                    {!checkOutRealizado() && !puedeHacerCheckOut() && (
                        <div className="text-xs text-gray-500 mt-1">
                            {estadoActividad?.horarios?.ventana_check_out || 'Disponible: 4:00 PM - 10:00 PM'}
                        </div>
                    )}
                </div>
            </div>

            {/* Métricas del día */}
            {checkInRealizado() && (
                <div className="border-t border-gray-200 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            <span className="text-gray-600">Mensajes:</span>
                            <span className="font-semibold">
                                {estadoActividad?.actividad?.total_mensajes || 0}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-green-600" />
                            <span className="text-gray-600">Llamadas:</span>
                            <span className="font-semibold">
                                {estadoActividad?.actividad?.total_llamadas || 0}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Alertas y recordatorios */}
            {!checkInRealizado() && !puedeHacerCheckIn() && (
                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">
                            Check-in disponible: {estadoActividad?.horarios?.ventana_check_in || '8:00 AM - 2:00 PM'}
                        </span>
                    </div>
                </div>
            )}

            {checkInRealizado() && !checkOutRealizado() && !puedeHacerCheckOut() && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800">
                            Check-out disponible: {estadoActividad?.horarios?.ventana_check_out || '4:00 PM - 10:00 PM'}
                        </span>
                    </div>
                </div>
            )}

            {/* Botón ver detalles */}
            {onViewDetails && (
                <div className="mt-3 text-center">
                    <button
                        onClick={onViewDetails}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        Ver historial de actividad
                    </button>
                </div>
            )}
        </div>
    );
};

export default EstadoActividadHoy;