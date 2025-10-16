// src/components/prospectos/ProspectosDisponibles/ProspectosDisponibles.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift, DollarSign, Clock, Phone, Building2, Mail,
  TrendingUp, AlertCircle, CheckCircle, Users, Zap
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const ProspectosDisponibles = ({ refreshTrigger = 0 }) => {
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tomandoProspecto, setTomandoProspecto] = useState(null);
  const [notification, setNotification] = useState(null);

  // Obtener usuario actual
  const usuarioActual = JSON.parse(localStorage.getItem('user') || '{}');

  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const cargarProspectosDisponibles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await prospectosService.obtenerDisponibles();

      if (response.success) {
        setProspectos(response.data || []);
      } else {
        setError('No se pudieron cargar los prospectos disponibles');
      }
    } catch (err) {
      console.error('Error cargando prospectos disponibles:', err);
      setError('Error al cargar prospectos disponibles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarProspectosDisponibles();
  }, [cargarProspectosDisponibles, refreshTrigger]);

  // Auto-refresh cada 30 segundos (competencia!)
  useEffect(() => {
    const interval = setInterval(() => {
      cargarProspectosDisponibles();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [cargarProspectosDisponibles]);

  const handleTomarProspecto = async (prospectoId, prospectoCodigo) => {
    try {
      setTomandoProspecto(prospectoId);

      const response = await prospectosService.tomarProspecto(prospectoId);

      if (response.success) {
        showNotification(
          `¡Excelente! Prospecto ${prospectoCodigo} ahora es tuyo. ¡A cerrar la venta!`,
          'success'
        );

        // Recargar lista después de tomar
        setTimeout(() => {
          cargarProspectosDisponibles();
        }, 500);
      } else {
        // Error al tomar (ya fue tomado por otro)
        showNotification(
          response.error || 'Este prospecto ya fue tomado por otro asesor',
          'error'
        );
        cargarProspectosDisponibles(); // Refrescar lista
      }
    } catch (err) {
      console.error('Error al tomar prospecto:', err);

      if (err.response?.status === 400) {
        // Prospecto ya fue tomado
        const mensaje = err.response?.data?.error || 'Este prospecto ya no está disponible';
        const tomadoPor = err.response?.data?.tomado_por;

        showNotification(
          tomadoPor ? `${mensaje} (Tomado por: ${tomadoPor})` : mensaje,
          'error'
        );
      } else {
        showNotification('Error al tomar el prospecto. Intenta nuevamente.', 'error');
      }

      cargarProspectosDisponibles(); // Refrescar lista
    } finally {
      setTomandoProspecto(null);
    }
  };

  const formatearTiempo = (horas) => {
    if (horas < 1) {
      return `${Math.round(horas * 60)} min`;
    } else if (horas < 24) {
      return `${Math.round(horas)} h`;
    } else {
      const dias = Math.floor(horas / 24);
      const horasRestantes = Math.round(horas % 24);
      return `${dias}d ${horasRestantes}h`;
    }
  };

  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    const IconComponent = iconos[notification.tipo];

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-md`}>
        <div className="flex items-start">
          <IconComponent className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  if (loading && prospectos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando prospectos disponibles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Error al cargar</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarProspectosDisponibles}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (prospectos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <Gift className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No hay prospectos disponibles
          </h3>
          <p className="text-gray-600 mb-4">
            En este momento no hay prospectos en modo libre. Los prospectos aparecen aquí cuando:
          </p>
          <ul className="text-sm text-gray-600 text-left space-y-2 mb-4">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              Han sido reasignados 2 veces sin éxito
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              El asesor anterior no completó el seguimiento a tiempo
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              Se activa competencia abierta por el prospecto
            </li>
          </ul>
          <button
            onClick={cargarProspectosDisponibles}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>
    );
  }

  const valorTotal = prospectos.reduce((sum, p) => sum + (p.valor_estimado || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header con stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center">
              <Zap className="h-6 w-6 mr-2 animate-pulse" />
              Prospectos Disponibles - ¡Modo Competencia!
            </h2>
            <p className="text-blue-100">
              El primero en tomar el prospecto se lo queda. ¡Actúa rápido!
            </p>
          </div>
          <button
            onClick={cargarProspectosDisponibles}
            disabled={loading}
            className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm font-medium"
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="text-blue-100 text-sm mb-1">Disponibles</div>
            <div className="text-2xl font-bold">{prospectos.length}</div>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="text-blue-100 text-sm mb-1">Valor Total</div>
            <div className="text-2xl font-bold">
              ${valorTotal.toLocaleString()}
            </div>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="text-blue-100 text-sm mb-1">Promedio</div>
            <div className="text-2xl font-bold">
              ${Math.round(valorTotal / prospectos.length).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de prospectos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prospectos.map((prospecto) => {
          const estaTomando = tomandoProspecto === prospecto.id;
          const tiempoDisponible = formatearTiempo(prospecto.horas_disponible || 0);

          return (
            <div
              key={prospecto.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              {/* Header del card con badge de tiempo */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 px-4 py-3 border-b border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-semibold text-orange-700">
                      Disponible hace {tiempoDisponible}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                    {prospecto.numero_reasignaciones || 0} rebotes
                  </span>
                </div>
              </div>

              {/* Contenido del card */}
              <div className="p-4 space-y-3">
                {/* Código y nombre */}
                <div>
                  <div className="text-xs font-semibold text-blue-600 mb-1">
                    {prospecto.codigo}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {prospecto.nombre_cliente}
                    {prospecto.apellido_cliente && ` ${prospecto.apellido_cliente}`}
                  </h3>
                  {prospecto.empresa && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Building2 className="h-3.5 w-3.5 mr-1" />
                      {prospecto.empresa}
                    </div>
                  )}
                </div>

                {/* Info de contacto */}
                <div className="space-y-1.5 text-sm">
                  {prospecto.telefono && (
                    <div className="flex items-center text-gray-700">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="font-medium">{prospecto.telefono}</span>
                    </div>
                  )}
                  {prospecto.email && (
                    <div className="flex items-center text-gray-700">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="truncate">{prospecto.email}</span>
                    </div>
                  )}
                </div>

                {/* Valor estimado y probabilidad */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Valor estimado:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${(prospecto.valor_estimado || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Probabilidad:</span>
                    <div className="flex items-center">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${prospecto.probabilidad_cierre || 50}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">
                        {prospecto.probabilidad_cierre || 50}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estado y canal */}
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {prospecto.estado || 'Prospecto'}
                  </span>
                  <span className="text-gray-500">
                    {prospecto.canal_contacto || 'Sin canal'}
                  </span>
                </div>
              </div>

              {/* Footer con botón de acción */}
              <div className="px-4 py-3 bg-gray-50 border-t">
                <button
                  onClick={() => handleTomarProspecto(prospecto.id, prospecto.codigo)}
                  disabled={estaTomando}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    estaTomando
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
                  }`}
                >
                  {estaTomando ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Tomando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Gift className="h-4 w-4 mr-2" />
                      ¡Tomar Prospecto!
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default ProspectosDisponibles;
