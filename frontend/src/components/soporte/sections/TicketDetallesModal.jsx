import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TicketDetallesModal = ({ abierto, ticket, onCerrar }) => {
  if (!abierto || !ticket) return null;

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

  const getPrioridadBadge = (prioridad) => {
    const prioridades = {
      'BAJA': { color: 'bg-green-100 text-green-800', text: 'Baja' },
      'MEDIA': { color: 'bg-yellow-100 text-yellow-800', text: 'Media' },
      'ALTA': { color: 'bg-orange-100 text-orange-800', text: 'Alta' },
      'URGENTE': { color: 'bg-red-100 text-red-800', text: 'Urgente' }
    };
    return prioridades[prioridad] || { color: 'bg-gray-100 text-gray-800', text: prioridad };
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'No especificada';
    return new Date(fecha).toLocaleString('es-ES');
  };

  const formatearFechaSolo = (fecha) => {
    if (!fecha) return 'No especificada';
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Detalles del Ticket</h2>
            <p className="text-gray-600">{ticket.codigo}</p>
          </div>
          <Button variant="outline" onClick={onCerrar}>
            ✕ Cerrar
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Información principal */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{ticket.titulo}</CardTitle>
                  <CardDescription className="mt-2 text-lg">
                    Código: {ticket.codigo} • Tipo: {ticket.tipo_ticket}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge className={getPrioridadBadge(ticket.prioridad).color}>
                    {getPrioridadBadge(ticket.prioridad).text}
                  </Badge>
                  <Badge className={getEstadoBadge(ticket.estado).color}>
                    {getEstadoBadge(ticket.estado).text}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ticket.descripcion && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Descripción:</h4>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{ticket.descripcion}</p>
                </div>
              )}
              {ticket.observaciones && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Observaciones:</h4>
                  <p className="text-gray-600 bg-blue-50 p-3 rounded-lg">{ticket.observaciones}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👤 Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Nombre:</span>
                  <p className="text-gray-900 mt-1">{ticket.cliente_nombre || 'No especificado'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Teléfono:</span>
                  <p className="text-gray-900 mt-1">{ticket.cliente_telefono || 'No especificado'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <p className="text-gray-900 mt-1">{ticket.cliente_email || 'No especificado'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de la venta */}
          {ticket.venta && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Información de la Venta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Código de Venta:</span>
                    <p className="text-gray-900 mt-1">{ticket.venta.codigo || ticket.venta_codigo}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Valor Final:</span>
                    <p className="text-gray-900 mt-1 font-medium">S/ {ticket.venta.valor_final}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Estado:</span>
                    <p className="text-gray-900 mt-1">{ticket.venta.estado}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información de asignación */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👥 Asignación y Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Asesor de Origen:</h4>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="font-medium">{ticket.asesor_nombre} {ticket.asesor_apellido}</p>
                    <p className="text-sm text-gray-600">{ticket.asesor_email}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Técnico Asignado:</h4>
                  <div className="bg-green-50 p-3 rounded-lg">
                    {ticket.tecnico_asignado ? (
                      <>
                        <p className="font-medium">{ticket.tecnico_nombre} {ticket.tecnico_apellido}</p>
                        <p className="text-sm text-gray-600">{ticket.tecnico_email}</p>
                      </>
                    ) : (
                      <p className="text-gray-500 italic">Sin asignar</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fechas y tiempos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📅 Fechas y Tiempos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-700">Fecha Programada:</span>
                    <p className="text-gray-900 mt-1">{formatearFechaSolo(ticket.fecha_programada)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Inicio de Atención:</span>
                    <p className="text-gray-900 mt-1">{formatearFecha(ticket.fecha_inicio_atencion)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Finalización:</span>
                    <p className="text-gray-900 mt-1">{formatearFecha(ticket.fecha_finalizacion)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-700">Tiempo Estimado:</span>
                    <p className="text-gray-900 mt-1">
                      {ticket.tiempo_estimado_horas ? `${ticket.tiempo_estimado_horas}h` : 'No especificado'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tiempo Real:</span>
                    <p className="text-gray-900 mt-1">
                      {ticket.tiempo_real_horas ? `${ticket.tiempo_real_horas}h` : 'No especificado'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Requiere Seguimiento:</span>
                    <div className="mt-1">
                      <Badge className={ticket.requiere_seguimiento ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}>
                        {ticket.requiere_seguimiento ? 'Sí' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calificación del cliente */}
          {(ticket.calificacion_cliente || ticket.comentarios_cliente) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⭐ Calificación del Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ticket.calificacion_cliente && (
                    <div>
                      <span className="font-medium text-gray-700">Calificación:</span>
                      <div className="flex items-center mt-1">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-lg ${
                              i < ticket.calificacion_cliente ? 'text-yellow-500' : 'text-gray-300'
                            }`}
                          >
                            ⭐
                          </span>
                        ))}
                        <span className="ml-2 text-gray-600">({ticket.calificacion_cliente}/5)</span>
                      </div>
                    </div>
                  )}
                  {ticket.comentarios_cliente && (
                    <div>
                      <span className="font-medium text-gray-700">Comentarios:</span>
                      <p className="text-gray-600 bg-yellow-50 p-3 rounded-lg mt-1">
                        {ticket.comentarios_cliente}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Capacitaciones asociadas */}
          {ticket.capacitaciones && ticket.capacitaciones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📚 Capacitaciones Asociadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ticket.capacitaciones.map((capacitacion, index) => (
                    <div key={index} className="border border-gray-200 p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{capacitacion.producto_descripcion}</p>
                          <p className="text-sm text-gray-600">Código: {capacitacion.producto_codigo}</p>
                        </div>
                        <Badge className={
                          capacitacion.estado === 'COMPLETADA' ? 'bg-green-100 text-green-800' :
                          capacitacion.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {capacitacion.estado}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Tipo:</span>
                          <span className="ml-2">{capacitacion.tipo_capacitacion}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Modalidad:</span>
                          <span className="ml-2">{capacitacion.modalidad}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Fecha Solicitada:</span>
                          <span className="ml-2">{formatearFechaSolo(capacitacion.fecha_capacitacion_solicitada)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Fecha Programada:</span>
                          <span className="ml-2">{formatearFechaSolo(capacitacion.fecha_capacitacion_programada)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Productos asociados */}
          {ticket.productos && ticket.productos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📦 Productos Asociados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ticket.productos.map((producto, index) => (
                    <div key={index} className="border border-gray-200 p-3 rounded-lg">
                      <p className="font-medium">{producto.descripcion}</p>
                      <p className="text-sm text-gray-600">Código: {producto.codigo}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información del sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ℹ️ Información del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Creado:</span>
                  <p className="text-gray-600 mt-1">{formatearFecha(ticket.created_at)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Última actualización:</span>
                  <p className="text-gray-600 mt-1">{formatearFecha(ticket.updated_at)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">ID del ticket:</span>
                  <p className="text-gray-600 mt-1 font-mono text-xs">{ticket.id}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Estado:</span>
                  <div className="mt-1">
                    <Badge className={ticket.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {ticket.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TicketDetallesModal;