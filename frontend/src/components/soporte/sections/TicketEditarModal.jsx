import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TicketEditarModal = ({ abierto, ticket, onCerrar, onActualizar }) => {
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    observaciones: '',
    estado: '',
    prioridad: '',
    tipo_ticket: '',
    fecha_programada: '',
    tiempo_estimado_horas: '',
    requiere_seguimiento: false,
    cliente_nombre: '',
    cliente_telefono: '',
    cliente_email: ''
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ticket) {
      setFormData({
        titulo: ticket.titulo || '',
        descripcion: ticket.descripcion || '',
        observaciones: ticket.observaciones || '',
        estado: ticket.estado || '',
        prioridad: ticket.prioridad || '',
        tipo_ticket: ticket.tipo_ticket || '',
        fecha_programada: ticket.fecha_programada ? ticket.fecha_programada.split('T')[0] : '',
        tiempo_estimado_horas: ticket.tiempo_estimado_horas || '',
        requiere_seguimiento: ticket.requiere_seguimiento || false,
        cliente_nombre: ticket.cliente_nombre || '',
        cliente_telefono: ticket.cliente_telefono || '',
        cliente_email: ticket.cliente_email || ''
      });
    }
  }, [ticket]);

  if (!abierto || !ticket) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const response = await fetch(`/api/soporte/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          tiempo_estimado_horas: formData.tiempo_estimado_horas ? parseInt(formData.tiempo_estimado_horas) : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onActualizar(result.data);
        } else {
          setError(result.message || 'Error al actualizar el ticket');
        }
      } else {
        setError(`Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error actualizando ticket:', err);
      setError('Error de conexión al actualizar el ticket');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Editar Ticket</h2>
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

          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📝 Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Estado y prioridad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔄 Estado y Clasificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="ASIGNADO">Asignado</option>
                    <option value="EN_PROCESO">En Proceso</option>
                    <option value="COMPLETADO">Completado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    name="prioridad"
                    value={formData.prioridad}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Ticket
                  </label>
                  <select
                    name="tipo_ticket"
                    value={formData.tipo_ticket}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CAPACITACION">Capacitación</option>
                    <option value="REPARACION">Reparación</option>
                    <option value="MANTENIMIENTO">Mantenimiento</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👤 Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="cliente_nombre"
                    value={formData.cliente_nombre}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="cliente_telefono"
                    value={formData.cliente_telefono}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="cliente_email"
                    value={formData.cliente_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Programación */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📅 Programación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Programada
                  </label>
                  <input
                    type="date"
                    name="fecha_programada"
                    value={formData.fecha_programada}
                    onChange={handleChange}
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
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="requiere_seguimiento"
                  checked={formData.requiere_seguimiento}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Requiere seguimiento posterior
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {guardando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketEditarModal;