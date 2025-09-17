// src/components/ventas/ActividadPage/ActividadPage.jsx - CONTROL CENTER DESIGN
import React, { useState, useEffect } from 'react';
import {
  Clock, CheckCircle, XCircle, Activity, Phone, MessageSquare,
  Play, Square, RefreshCw, AlertCircle, Timer, Calendar,
  User, BarChart3, Eye, TrendingUp, History
} from 'lucide-react';
import actividadService from '../../../services/actividadService';
import ModalCheckIn from './ModalCheckIn';
import ModalCheckOut from './ModalCheckOut';

const ActividadPage = () => {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalCheckInOpen, setModalCheckInOpen] = useState(false);
  const [modalCheckOutOpen, setModalCheckOutOpen] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [notification, setNotification] = useState(null);

  const obtenerEstado = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await actividadService.getEstadoHoy();
      
      if (response.success) {
        setEstado(response.data);
      } else {
        throw new Error(response.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error cargando actividad:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInSuccess = async (data) => {
    setModalCheckInOpen(false);
    showNotification('Check-in registrado exitosamente', 'success');
    setTimeout(() => obtenerEstado(), 1000);
  };

  const handleCheckOutSuccess = async (data) => {
    setModalCheckOutOpen(false);
    showNotification('Check-out registrado exitosamente', 'success');
    setTimeout(() => obtenerEstado(), 1000);
  };

  const showNotification = (mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    obtenerEstado();
    const interval = setInterval(obtenerEstado, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Componente de notificación
  const NotificationComponent = () => {
    if (!notification) return null;
    
    const colors = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colors[notification.tipo]} max-w-sm`}>
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  // Componente de Historial
  const HistorialContent = () => {
    const [historial, setHistorial] = useState([]);
    const [historialLoading, setHistorialLoading] = useState(true);
    const [historialError, setHistorialError] = useState(null);

    useEffect(() => {
      const cargarHistorial = async () => {
        try {
          setHistorialLoading(true);
          const response = await actividadService.getHistorial();
          
          if (response.success) {
            setHistorial(response.data.registros || []);
          } else {
            setHistorialError('Error cargando historial');
          }
        } catch (err) {
          console.error('Error:', err);
          setHistorialError('Error de conexión');
        } finally {
          setHistorialLoading(false);
        }
      };

      cargarHistorial();
    }, []);

    if (historialLoading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando historial...</p>
        </div>
      );
    }

    if (historialError) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600">{historialError}</p>
        </div>
      );
    }

    if (historial.length === 0) {
      return (
        <div className="text-center py-12">
          <History className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin registros</h3>
          <p className="text-gray-600">No hay actividad registrada aún</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
          {historial.map((registro, index) => (
            <div key={registro.id || index} className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {new Date(registro.fecha).toLocaleDateString('es-PE')}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    registro.estado_jornada === 'finalizada' 
                      ? 'bg-green-100 text-green-700' 
                      : registro.estado_jornada === 'en_progreso'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {registro.estado_jornada === 'finalizada' ? 'Completada' :
                     registro.estado_jornada === 'en_progreso' ? 'En Progreso' : 'Sin Iniciar'}
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {registro.horas_calculadas && !isNaN(registro.horas_calculadas) ? 
  `${parseFloat(registro.horas_calculadas).toFixed(1)}h` : '0.0h'}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-4 mt-3">
                <div className="text-center">
                  <Clock className="h-4 w-4 mx-auto text-green-600 mb-1" />
                  <p className="text-xs text-gray-600">Check-in</p>
                  <p className="text-sm font-medium">
                    {registro.check_in_time ? 
                      new Date(registro.check_in_time).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '--:--'
                    }
                  </p>
                </div>
                
                <div className="text-center">
                  <Clock className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                  <p className="text-xs text-gray-600">Check-out</p>
                  <p className="text-sm font-medium">
                    {registro.check_out_time ? 
                      new Date(registro.check_out_time).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '--:--'
                    }
                  </p>
                </div>
                
                <div className="text-center">
                  <MessageSquare className="h-4 w-4 mx-auto text-purple-600 mb-1" />
                  <p className="text-xs text-gray-600">Mensajes</p>
                  <p className="text-sm font-medium">{registro.total_mensajes_recibidos || 0}</p>
                </div>
                
                <div className="text-center">
                  <Phone className="h-4 w-4 mx-auto text-orange-600 mb-1" />
                  <p className="text-xs text-gray-600">Llamadas</p>
                  <p className="text-sm font-medium">{registro.total_llamadas || 0}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900">Cargando Actividad</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error de Conexión</h3>
          <p className="text-red-700 mb-6">{error}</p>
          <button 
            onClick={obtenerEstado}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!estado) return null;

  const estadoActual = estado.estado_actual;
  const puedeCheckIn = estado.jornada?.puede_check_in;
  const puedeCheckOut = estado.jornada?.puede_check_out;
  const checkInRealizado = estado.jornada?.check_in_realizado;
  const checkOutRealizado = estado.jornada?.check_out_realizado;

  const getStatusInfo = () => {
    switch(estadoActual) {
      case 'sin_iniciar':
        return {
          text: 'Sin Iniciar',
          color: 'bg-gray-100 text-gray-700',
          dot: 'bg-gray-400'
        };
      case 'en_progreso':
        return {
          text: 'En Progreso',
          color: 'bg-green-100 text-green-700',
          dot: 'bg-green-500 animate-pulse'
        };
      case 'finalizada':
        return {
          text: 'Finalizada',
          color: 'bg-blue-100 text-blue-700',
          dot: 'bg-blue-500'
        };
      default:
        return {
          text: 'Desconocido',
          color: 'bg-gray-100 text-gray-700',
          dot: 'bg-gray-400'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        
        {/* Header compacto */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${statusInfo.dot}`}></div>
                <h1 className="text-2xl font-bold text-gray-900">Control de Actividad</h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
            </div>
            <button
              onClick={obtenerEstado}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Control Center - Layout Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Columna Izquierda - Estado y Acciones */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Card de Check-in/Check-out */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Estado de Jornada</h2>
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Check-in */}
                <div className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  checkInRealizado 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-green-100 shadow-lg' 
                    : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="flex items-center space-x-2 mb-3">
                    {checkInRealizado ? (
                      <div className="relative">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                      </div>
                    ) : (
                      <Clock className="h-6 w-6 text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">Check-in</span>
                  </div>
                  <div className={`text-2xl font-bold mb-1 ${
                    checkInRealizado ? 'text-green-700' : 'text-gray-400'
                  }`}>
                    {estado.jornada?.hora_check_in ? 
                      new Date(estado.jornada.hora_check_in).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '--:--'
                    }
                  </div>
                  {checkInRealizado && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600 font-medium">Completado</span>
                    </div>
                  )}
                </div>

                {/* Check-out */}
                <div className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  checkOutRealizado 
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-blue-100 shadow-lg' 
                    : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="flex items-center space-x-2 mb-3">
                    {checkOutRealizado ? (
                      <div className="relative">
                        <CheckCircle className="h-6 w-6 text-blue-600" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping"></div>
                      </div>
                    ) : (
                      <Clock className="h-6 w-6 text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">Check-out</span>
                  </div>
                  <div className={`text-2xl font-bold mb-1 ${
                    checkOutRealizado ? 'text-blue-700' : 'text-gray-400'
                  }`}>
                    {estado.jornada?.hora_check_out ? 
                      new Date(estado.jornada.hora_check_out).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '--:--'
                    }
                  </div>
                  {checkOutRealizado && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-blue-600 font-medium">Completado</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex space-x-3">
                {puedeCheckIn && (
                  <button
                    onClick={() => setModalCheckInOpen(true)}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>Iniciar Jornada</span>
                  </button>
                )}
                
                {puedeCheckOut && (
                  <button
                    onClick={() => setModalCheckOutOpen(true)}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Square className="h-4 w-4" />
                    <span>Finalizar Jornada</span>
                  </button>
                )}

                {estadoActual === 'finalizada' && (
                  <div className="flex-1 bg-green-100 text-green-700 py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Jornada Completada</span>
                  </div>
                )}

                <button 
                  onClick={() => setShowHistorial(true)}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <History className="h-4 w-4" />
                  <span>Historial</span>
                </button>
              </div>
            </div>

            {/* Métricas de Actividad */}
            {estadoActual === 'en_progreso' && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad del Día</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-xl font-bold text-blue-600">
                      {estado.actividad?.total_mensajes || 0}
                    </p>
                    <p className="text-xs text-gray-600">Mensajes</p>
                  </div>

                  <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                    <Phone className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-xl font-bold text-green-600">
                      {estado.actividad?.total_llamadas || 0}
                    </p>
                    <p className="text-xs text-gray-600">Llamadas</p>
                  </div>

                  <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                    <Timer className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-xl font-bold text-purple-600">
                      {estado.jornada?.horas_jornada?.toFixed(1) || '0.0'}
                    </p>
                    <p className="text-xs text-gray-600">Horas</p>
                  </div>

                  <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                    <p className="text-xl font-bold text-orange-600">
                      {Math.round((estado.actividad?.total_mensajes || 0) / Math.max(estado.jornada?.horas_jornada || 1, 1))}
                    </p>
                    <p className="text-xs text-gray-600">Msg/Hr</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha - Información y Alertas */}
          <div className="space-y-4">
            
            {/* Card de Información */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Fecha</span>
                  <span className="text-sm font-medium text-gray-900">{estado.fecha}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Hora Actual</span>
                  <span className="text-sm font-medium text-gray-900">
                    {estado.horarios?.hora_actual || '--:--'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Tiempo Trabajado</span>
                  <span className="text-sm font-medium text-gray-900">
                    {estado.jornada?.horas_jornada ? 
                      `${estado.jornada.horas_jornada.toFixed(1)}h` : '0.0h'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Alertas */}
            {!checkInRealizado && !puedeCheckIn && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Check-in Disponible</h4>
                    <p className="text-sm text-yellow-700">
                      {estado.horarios?.ventana_check_in || '8:00 AM - 2:00 PM'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {checkInRealizado && !checkOutRealizado && !puedeCheckOut && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Check-out Disponible</h4>
                    <p className="text-sm text-blue-700">
                      {estado.horarios?.ventana_check_out || '4:00 PM - 10:00 PM'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje del sistema */}
            {estado.mensaje && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-900 font-medium">{estado.mensaje}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      <ModalCheckIn
        isOpen={modalCheckInOpen}
        onClose={() => setModalCheckInOpen(false)}
        onSubmit={async (data) => {
          try {
            const response = await actividadService.checkIn(data);
            if (response.success) {
              handleCheckInSuccess(response.data);
            } else {
              throw new Error(response.error);
            }
          } catch (error) {
            console.error('Error en check-in:', error);
            showNotification('Error al iniciar jornada: ' + error.message, 'error');
          }
        }}
      />

      <ModalCheckOut
        isOpen={modalCheckOutOpen}
        onClose={() => setModalCheckOutOpen(false)}
        onSubmit={async (data) => {
          try {
            const response = await actividadService.checkOut(data);
            if (response.success) {
              handleCheckOutSuccess(response.data);
            } else {
              throw new Error(response.error);
            }
          } catch (error) {
            console.error('Error en check-out:', error);
            showNotification('Error al finalizar jornada: ' + error.message, 'error');
          }
        }}
      />

      {/* Modal de Historial - VERSIÓN FUNCIONAL */}
      {showHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Historial de Actividad</h2>
              <button 
                onClick={() => setShowHistorial(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <HistorialContent />
            </div>
          </div>
        </div>
      )}

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default ActividadPage;