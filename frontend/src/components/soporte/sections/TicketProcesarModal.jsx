import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TicketProcesarModal = ({ abierto, ticket, onCerrar, onActualizar }) => {
  const [formData, setFormData] = useState({
    tecnico_asignado_id: '',
    fecha_programada: '',
    tiempo_estimado_horas: '',
    observaciones: '',
    tiempo_real_horas: '',
    calificacion_cliente: '',
    comentarios_cliente: ''
  });
  const [tecnicos, setTecnicos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ticket && abierto) {
      setFormData({
        tecnico_asignado_id: ticket.tecnico_asignado_id || '',
        fecha_programada: ticket.fecha_programada ? ticket.fecha_programada.split('T')[0] : '',
        tiempo_estimado_horas: ticket.tiempo_estimado_horas || '',
        observaciones: ticket.observaciones || '',
        tiempo_real_horas: ticket.tiempo_real_horas || '',
        calificacion_cliente: ticket.calificacion_cliente || '',
        comentarios_cliente: ticket.comentarios_cliente || ''
      });
      fetchTecnicos();
    }
  }, [ticket, abierto]);

  const fetchTecnicos = async () => {
    try {
      // Obtener lista de técnicos disponibles
      const response = await fetch('/api/soporte/tecnicos', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTecnicos(result.data || []);
        }
      }
    } catch (err) {
      console.error('Error obteniendo técnicos:', err);
    }
  };

  if (!abierto || !ticket) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getAccionInfo = () => {
    switch (ticket.estado) {
      case 'PENDIENTE':
        return {
          titulo: 'Programar Ticket',
          descripcion: 'Asignar técnico y programar fecha para iniciar el trabajo',
          nuevoEstado: 'ASIGNADO',
          accionTexto: 'Programar'
        };
      case 'ASIGNADO':
        return {
          titulo: 'Iniciar Trabajo',
          descripcion: 'Marcar el ticket como en proceso e iniciar el trabajo',
          nuevoEstado: 'EN_PROCESO',
          accionTexto: 'Iniciar Trabajo'
        };
      case 'EN_PROCESO':
        return {
          titulo: 'Completar Ticket',
          descripcion: 'Finalizar el trabajo y registrar los resultados',
          nuevoEstado: 'COMPLETADO',
          accionTexto: 'Completar'
        };
      default:
        return {
          titulo: 'Procesar Ticket',
          descripcion: 'Actualizar el estado del ticket',
          nuevoEstado: ticket.estado,
          accionTexto: 'Procesar'
        };
    }
  };

  const accionInfo = getAccionInfo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setError(null);

    try {
      const updateData = {
        estado: accionInfo.nuevoEstado,
        ...formData
      };

      // Limpiar campos vacíos y convertir números
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '') {
          updateData[key] = null;
        } else if (key.includes('horas') && updateData[key]) {
          updateData[key] = parseInt(updateData[key]);
        } else if (key === 'calificacion_cliente' && updateData[key]) {
          updateData[key] = parseInt(updateData[key]);
        } else if (key === 'tecnico_asignado_id' && updateData[key]) {
          updateData[key] = parseInt(updateData[key]);
        }
      });

      // Añadir fechas automáticas según el estado
      if (accionInfo.nuevoEstado === 'EN_PROCESO' && !ticket.fecha_inicio_atencion) {
        updateData.fecha_inicio_atencion = new Date().toISOString();
      } else if (accionInfo.nuevoEstado === 'COMPLETADO') {
        updateData.fecha_finalizacion = new Date().toISOString();
        if (!ticket.fecha_inicio_atencion) {
          updateData.fecha_inicio_atencion = new Date().toISOString();
        }
      }

      const response = await fetch(`/api/soporte/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onActualizar(result.data);
        } else {
          setError(result.message || 'Error al procesar el ticket');
        }
      } else {
        setError(`Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error procesando ticket:', err);
      setError('Error de conexión al procesar el ticket');
    } finally {
      setProcesando(false);
    }
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      'PENDIENTE': { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      'ASIGNADO': { color: 'bg-blue-100 text-blue-800', text: 'Asignado' },
      'EN_PROCESO': { color: 'bg-orange-100 text-orange-800', text: 'En Proceso' },
      'COMPLETADO': { color: 'bg-green-100 text-green-800', text: 'Completado' },
      'CANCELADO': { color: 'bg-red-100 text-red-800', text: 'Cancelado' }
    };
    return estados[estado] || { color: 'bg-gray-100 text-gray-800', text: estado };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{accionInfo.titulo}</h2>
            <p className="text-gray-600">{ticket.codigo}</p>
          </div>
          <Button variant="outline" onClick={onCerrar}>
            ✕ Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Estado actual y transición */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔄 Transición de Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <Badge className={getEstadoBadge(ticket.estado).color}>
                    {getEstadoBadge(ticket.estado).text}
                  </Badge>
                  <span className="text-2xl">→</span>
                  <Badge className={getEstadoBadge(accionInfo.nuevoEstado).color}>
                    {getEstadoBadge(accionInfo.nuevoEstado).text}
                  </Badge>
                </div>
              </div>
              <p className="text-gray-600 mt-3">{accionInfo.descripcion}</p>
            </CardContent>
          </Card>

          {/* Campos específicos según el estado */}
          {ticket.estado === 'PENDIENTE' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👥 Asignación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Técnico Asignado *
                  </label>
                  <select
                    name="tecnico_asignado_id"
                    value={formData.tecnico_asignado_id}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar técnico...</option>
                    {tecnicos.map(tecnico => (
                      <option key={tecnico.id} value={tecnico.id}>
                        {tecnico.nombre} {tecnico.apellido} - {tecnico.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Programada *
                  </label>
                  <input
                    type="date"
                    name="fecha_programada"
                    value={formData.fecha_programada}
                    onChange={handleChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo Estimado (horas)
                  </label>
                  <input
                    type="number"
                    name="tiempo_estimado_horas"
                    value={formData.tiempo_estimado_horas}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {ticket.estado === 'ASIGNADO' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🚀 Inicio de Trabajo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones de Inicio
                  </label>
                  <textarea
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Observaciones sobre el inicio del trabajo..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {ticket.estado === 'EN_PROCESO' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">✅ Finalización</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo Real Empleado (horas)
                  </label>
                  <input
                    type="number"
                    name="tiempo_real_horas"
                    value={formData.tiempo_real_horas}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calificación del Cliente (1-5)
                  </label>
                  <select
                    name="calificacion_cliente"
                    value={formData.calificacion_cliente}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin calificar</option>
                    <option value="1">⭐ 1 - Muy malo</option>
                    <option value="2">⭐⭐ 2 - Malo</option>
                    <option value="3">⭐⭐⭐ 3 - Regular</option>
                    <option value="4">⭐⭐⭐⭐ 4 - Bueno</option>
                    <option value="5">⭐⭐⭐⭐⭐ 5 - Excelente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comentarios del Cliente
                  </label>
                  <textarea
                    name="comentarios_cliente"
                    value={formData.comentarios_cliente}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Comentarios y feedback del cliente..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones Finales
                  </label>
                  <textarea
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Resumen del trabajo realizado, conclusiones..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información del ticket */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📋 Resumen del Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-gray-700">Título:</span>
                  <span className="ml-2 text-gray-900">{ticket.titulo}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Cliente:</span>
                  <span className="ml-2 text-gray-900">{ticket.cliente_nombre}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Tipo:</span>
                  <span className="ml-2 text-gray-900">{ticket.tipo_ticket}</span>
                </div>
                {ticket.tecnico_asignado && (
                  <div>
                    <span className="font-medium text-gray-700">Técnico Actual:</span>
                    <span className="ml-2 text-gray-900">
                      {ticket.tecnico_nombre} {ticket.tecnico_apellido}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={procesando}
              className="bg-green-600 hover:bg-green-700"
            >
              {procesando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                accionInfo.accionTexto
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketProcesarModal;