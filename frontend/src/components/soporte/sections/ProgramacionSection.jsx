import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ProgramacionSection = () => {
  const [vista, setVista] = useState('semana'); // mes, semana, dia
  const [fechaActual, setFechaActual] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para modales de acciones rápidas
  const [modalCapacitacion, setModalCapacitacion] = useState(false);
  const [modalReparacion, setModalReparacion] = useState(false);
  const [modalMantenimiento, setModalMantenimiento] = useState(false);
  const [modalAgenda, setModalAgenda] = useState(false);

  useEffect(() => {
    fetchEventos();
    fetchTecnicos();
  }, [fechaActual, vista]);

  const fetchEventos = async () => {
    try {
      setLoading(true);
      // Obtener tanto tickets como capacitaciones para el calendario
      const [ticketsResponse, capacitacionesResponse] = await Promise.all([
        fetch('/api/soporte/tickets', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/soporte/capacitaciones', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const tickets = ticketsResponse.ok ? (await ticketsResponse.json()).data || [] : [];
      const capacitaciones = capacitacionesResponse.ok ? (await capacitacionesResponse.json()).data || [] : [];

      // Convertir a eventos del calendario
      const eventosCalendario = [
        ...tickets
          .filter(ticket => ticket.fecha_programada)
          .map(ticket => ({
            id: `ticket-${ticket.id}`,
            tipo: 'ticket',
            titulo: ticket.titulo,
            fecha: ticket.fecha_programada,
            hora: '09:00', // Por defecto si no hay hora específica
            tipoTicket: ticket.tipo_ticket,
            estado: ticket.estado,
            prioridad: ticket.prioridad,
            tecnico: ticket.tecnico_nombre ? `${ticket.tecnico_nombre} ${ticket.tecnico_apellido}` : 'Sin asignar',
            cliente: ticket.cliente_nombre,
            duracion: ticket.tiempo_estimado_horas || 2
          })),
        ...capacitaciones
          .filter(cap => cap.fecha_capacitacion_programada)
          .map(cap => ({
            id: `capacitacion-${cap.id}`,
            tipo: 'capacitacion',
            titulo: cap.producto_descripcion,
            fecha: cap.fecha_capacitacion_programada,
            hora: '10:00', // Por defecto
            tipoTicket: 'CAPACITACION',
            estado: cap.estado,
            prioridad: 'MEDIA',
            tecnico: 'Sin asignar',
            cliente: cap.cliente_nombre,
            duracion: cap.duracion_estimada_horas || 2
          }))
      ];

      setEventos(eventosCalendario);
    } catch (err) {
      console.error('Error fetching eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTecnicos = async () => {
    try {
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

  const cambiarFecha = (direccion) => {
    const nuevaFecha = new Date(fechaActual);

    if (vista === 'mes') {
      nuevaFecha.setMonth(nuevaFecha.getMonth() + direccion);
    } else if (vista === 'semana') {
      nuevaFecha.setDate(nuevaFecha.getDate() + (direccion * 7));
    } else if (vista === 'dia') {
      nuevaFecha.setDate(nuevaFecha.getDate() + direccion);
    }

    setFechaActual(nuevaFecha);
  };

  const getEventosDelDia = (fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return eventos.filter(evento => {
      const eventoFecha = new Date(evento.fecha).toISOString().split('T')[0];
      return eventoFecha === fechaStr;
    });
  };

  const getTipoColor = (tipoTicket) => {
    const colores = {
      'CAPACITACION': 'bg-blue-100 text-blue-800 border-blue-200',
      'REPARACION': 'bg-orange-100 text-orange-800 border-orange-200',
      'MANTENIMIENTO': 'bg-green-100 text-green-800 border-green-200'
    };
    return colores[tipoTicket] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatearFecha = (fecha) => {
    return fecha.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const obtenerDiasSemana = () => {
    // Obtener el lunes de la semana actual
    const inicioSemana = new Date(fechaActual);
    const diaActual = inicioSemana.getDay();
    const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1; // Si es domingo (0), retroceder 6 días
    inicioSemana.setDate(inicioSemana.getDate() - diasHastaLunes);

    const dias = [];
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(inicioSemana);
      fecha.setDate(fecha.getDate() + i);
      dias.push({
        fecha,
        esHoy: fecha.toDateString() === new Date().toDateString(),
        esSemanaActual: true
      });
    }

    return dias;
  };

  const obtenerDiasDelMes = () => {
    if (vista === 'semana') {
      return obtenerDiasSemana();
    }

    const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
    const ultimoDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
    const dias = [];

    // Agregar días del mes anterior para completar la semana
    const primerDiaSemana = primerDia.getDay();
    for (let i = primerDiaSemana - 1; i >= 0; i--) {
      const fecha = new Date(primerDia);
      fecha.setDate(fecha.getDate() - i - 1);
      dias.push({ fecha, esDelMes: false });
    }

    // Agregar días del mes actual
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), dia);
      dias.push({ fecha, esDelMes: true });
    }

    // Agregar días del siguiente mes para completar la semana
    const ultimoDiaSemana = ultimoDia.getDay();
    for (let i = 1; i <= 6 - ultimoDiaSemana; i++) {
      const fecha = new Date(ultimoDia);
      fecha.setDate(fecha.getDate() + i);
      dias.push({ fecha, esDelMes: false });
    }

    return dias;
  };

  // Funciones para acciones rápidas
  const programarCapacitacion = () => {
    setModalCapacitacion(true);
  };

  const agendarReparacion = () => {
    setModalReparacion(true);
  };

  const programarMantenimiento = () => {
    setModalMantenimiento(true);
  };

  const verAgendaCompleta = () => {
    setModalAgenda(true);
  };

  const crearTicketRapido = async (tipoTicket, datosBasicos) => {
    try {
      const response = await fetch('/api/soporte/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_ticket: tipoTicket,
          ...datosBasicos,
          estado: 'PENDIENTE'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refrescar eventos
          fetchEventos();
          return { success: true, data: result.data };
        }
      }
      return { success: false, error: 'Error al crear ticket' };
    } catch (error) {
      console.error('Error creando ticket:', error);
      return { success: false, error: error.message };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando programación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Programación y Calendario</h2>
          <p className="text-gray-600">Gestión de recursos y programación de actividades</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVista('dia')}
                  className={vista === 'dia' ? 'bg-blue-50 border-blue-300' : ''}>
            Día
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVista('semana')}
                  className={vista === 'semana' ? 'bg-blue-50 border-blue-300' : ''}>
            Semana
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVista('mes')}
                  className={vista === 'mes' ? 'bg-blue-50 border-blue-300' : ''}>
            Mes
          </Button>
        </div>
      </div>

      {/* Navegación de fecha */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => cambiarFecha(-1)}>
              ← Anterior
            </Button>
            <div className="text-center">
              <h3 className="text-lg font-semibold">{formatearFecha(fechaActual)}</h3>
              <p className="text-sm text-gray-600 capitalize">Vista de {vista}</p>
            </div>
            <Button variant="outline" onClick={() => cambiarFecha(1)}>
              Siguiente →
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Eventos Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getEventosDelDia(new Date()).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm">📅</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Técnicos Activos</p>
                <p className="text-2xl font-bold text-gray-900">{tecnicos.length}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">👥</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Capacitaciones</p>
                <p className="text-2xl font-bold text-gray-900">
                  {eventos.filter(e => e.tipoTicket === 'CAPACITACION').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm">📚</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reparaciones</p>
                <p className="text-2xl font-bold text-gray-900">
                  {eventos.filter(e => e.tipoTicket === 'REPARACION').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 text-sm">🔧</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vista del calendario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario semanal */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📅 {vista === 'semana' ? 'Vista Semanal' : vista === 'mes' ? 'Vista Mensual' : 'Vista Diaria'}
                <Badge variant="outline" className="ml-auto">
                  {eventos.length} eventos totales
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vista === 'semana' ? (
                <div className="space-y-4">
                  {/* Encabezados de días de la semana */}
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                      <div key={dia} className="text-center text-sm font-medium text-gray-600 py-2">
                        {dia}
                      </div>
                    ))}
                  </div>
                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 gap-2">
                    {obtenerDiasSemana().map((diaInfo, index) => {
                      const eventosDelDia = getEventosDelDia(diaInfo.fecha);
                      const esHoy = diaInfo.esHoy;
                      const esFinde = diaInfo.fecha.getDay() === 0 || diaInfo.fecha.getDay() === 6;

                      return (
                        <div
                          key={index}
                          className={`min-h-[120px] p-2 rounded-lg border transition-all hover:shadow-sm ${
                            esHoy ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-500' :
                            esFinde ? 'bg-gray-50 border-gray-200' :
                            'bg-white border-gray-200'
                          }`}
                        >
                          <div className={`text-center mb-2 ${esHoy ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                            <div className="text-lg font-semibold">
                              {diaInfo.fecha.getDate()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {diaInfo.fecha.toLocaleDateString('es-ES', { month: 'short' })}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {eventosDelDia.length > 0 ? (
                              eventosDelDia.slice(0, 2).map(evento => (
                                <div
                                  key={evento.id}
                                  className={`text-xs p-1 rounded truncate ${getTipoColor(evento.tipoTicket)}`}
                                  title={`${evento.titulo} - ${evento.cliente} (${evento.hora})`}
                                >
                                  {evento.titulo}
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-400 italic">Sin eventos</div>
                            )}
                            {eventosDelDia.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{eventosDelDia.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : vista === 'mes' ? (
                <div className="grid grid-cols-7 gap-1">
                  {obtenerDiasDelMes().map((diaInfo, index) => {
                    const eventosDelDia = getEventosDelDia(diaInfo.fecha);
                    const esHoy = diaInfo.fecha.toDateString() === new Date().toDateString();

                    return (
                      <div
                        key={index}
                        className={`min-h-[80px] p-1 border text-center ${
                          esHoy ? 'bg-blue-50 border-blue-300' :
                          diaInfo.esDelMes ? 'bg-white border-gray-200' :
                          'bg-gray-50 border-gray-100 text-gray-400'
                        }`}
                      >
                        <div className="text-sm">{diaInfo.fecha.getDate()}</div>
                        {eventosDelDia.length > 0 && (
                          <div className="text-xs text-blue-600">
                            {eventosDelDia.length} eventos
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {getEventosDelDia(fechaActual).map(evento => (
                    <div key={evento.id} className={`p-3 rounded-lg ${getTipoColor(evento.tipoTicket)}`}>
                      <div className="font-medium">{evento.titulo}</div>
                      <div className="text-sm">{evento.cliente} - {evento.hora}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral de acciones rápidas */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⚡ Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={programarCapacitacion}
              >
                + Programar Capacitación
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={agendarReparacion}
              >
                🔧 Agendar Reparación
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={programarMantenimiento}
              >
                ⚙️ Programar Mantenimiento
              </Button>
              <hr />
              <Button
                className="w-full"
                variant="outline"
                onClick={verAgendaCompleta}
              >
                📊 Ver Agenda Completa
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🎯 Vista Rápida</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Hoy:</span>
                  <span className="font-medium">{getEventosDelDia(new Date()).length} eventos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mañana:</span>
                  <span className="font-medium">
                    {(() => {
                      const mañana = new Date();
                      mañana.setDate(mañana.getDate() + 1);
                      return getEventosDelDia(mañana).length;
                    })()} eventos
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Esta semana:</span>
                  <span className="font-medium">
                    {eventos.filter(e => {
                      const fechaEvento = new Date(e.fecha);
                      const hoy = new Date();
                      const finSemana = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
                      return fechaEvento >= hoy && fechaEvento <= finSemana;
                    }).length} eventos
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lista de eventos para hoy o día seleccionado */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos de Hoy</CardTitle>
          <CardDescription>Actividades programadas para {new Date().toLocaleDateString('es-ES')}</CardDescription>
        </CardHeader>
        <CardContent>
          {getEventosDelDia(new Date()).length > 0 ? (
            <div className="space-y-3">
              {getEventosDelDia(new Date()).map(evento => (
                <div key={evento.id} className={`p-3 rounded-lg border ${getTipoColor(evento.tipoTicket)}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{evento.titulo}</h4>
                      <p className="text-sm opacity-80">Cliente: {evento.cliente}</p>
                      <p className="text-sm opacity-80">Técnico: {evento.tecnico}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{evento.hora}</p>
                      <p className="text-xs opacity-80">{evento.duracion}h</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📅</div>
              <p>No hay eventos programados para hoy</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de técnicos y disponibilidad */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Técnicos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tecnicos.map(tecnico => {
              const eventosAsignados = eventos.filter(e =>
                e.tecnico.includes(tecnico.nombre)
              );

              return (
                <div key={tecnico.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{tecnico.nombre} {tecnico.apellido}</p>
                      <p className="text-sm text-gray-600">{tecnico.email}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={eventosAsignados.length > 0 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>
                        {eventosAsignados.length > 0 ? 'Ocupado' : 'Disponible'}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {eventosAsignados.length} evento(s)
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modales para acciones rápidas */}
      {modalCapacitacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Programar Capacitación</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Será redirigido a la sección de Gestión de Casos para crear un nuevo ticket de capacitación.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setModalCapacitacion(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setModalCapacitacion(false);
                    // Aquí se podría cambiar a la pestaña de tickets
                    alert('Funcionalidad pendiente: Cambiar a pestaña de tickets');
                  }}
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalReparacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Agendar Reparación</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Será redirigido a la sección de Gestión de Casos para crear un nuevo ticket de reparación.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setModalReparacion(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setModalReparacion(false);
                    alert('Funcionalidad pendiente: Cambiar a pestaña de tickets');
                  }}
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMantenimiento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Programar Mantenimiento</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Será redirigido a la sección de Gestión de Casos para crear un nuevo ticket de mantenimiento.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setModalMantenimiento(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setModalMantenimiento(false);
                    alert('Funcionalidad pendiente: Cambiar a pestaña de tickets');
                  }}
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalAgenda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Agenda Completa</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <h4 className="font-medium">Todos los eventos programados</h4>
                {eventos.length > 0 ? (
                  <div className="space-y-2">
                    {eventos.map(evento => (
                      <div key={evento.id} className={`p-3 rounded border ${getTipoColor(evento.tipoTicket)}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{evento.titulo}</p>
                            <p className="text-sm opacity-80">{evento.cliente}</p>
                            <p className="text-sm opacity-80">{evento.tecnico}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{new Date(evento.fecha).toLocaleDateString('es-ES')}</p>
                            <p className="text-sm">{evento.hora}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No hay eventos programados</p>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={() => setModalAgenda(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramacionSection;