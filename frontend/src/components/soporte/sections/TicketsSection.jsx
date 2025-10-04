import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_CONFIG } from '../../../config/apiConfig';

// Componentes para modales
import TicketDetallesModal from './TicketDetallesModal';
import TicketEditarModal from './TicketEditarModal';
import TicketProcesarModal from './TicketProcesarModal';

const TicketsSection = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para modales
  const [modalDetalles, setModalDetalles] = useState({ abierto: false, ticket: null });
  const [modalEditar, setModalEditar] = useState({ abierto: false, ticket: null });
  const [modalProcesar, setModalProcesar] = useState({ abierto: false, ticket: null });

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    tipo: 'todos',
    estado: 'todos',
    prioridad: 'todos',
    tecnico: 'todos'
  });
  const [ticketsFiltrados, setTicketsFiltrados] = useState([]);

  useEffect(() => {
    fetchTickets();
  }, []);

  // Efecto para filtrar tickets cuando cambien los filtros o los tickets
  useEffect(() => {
    aplicarFiltros();
  }, [tickets, filtros]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/soporte/tickets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setTickets(result.data || []);
      } else {
        throw new Error(result.message || 'Error al obtener tickets');
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let ticketsFiltered = [...tickets];

    // Filtro por tipo
    if (filtros.tipo !== 'todos') {
      ticketsFiltered = ticketsFiltered.filter(ticket => ticket.tipo_ticket === filtros.tipo);
    }

    // Filtro por estado
    if (filtros.estado !== 'todos') {
      ticketsFiltered = ticketsFiltered.filter(ticket => ticket.estado === filtros.estado);
    }

    // Filtro por prioridad
    if (filtros.prioridad !== 'todos') {
      ticketsFiltered = ticketsFiltered.filter(ticket => ticket.prioridad === filtros.prioridad);
    }

    // Filtro por técnico
    if (filtros.tecnico !== 'todos') {
      if (filtros.tecnico === 'sin_asignar') {
        ticketsFiltered = ticketsFiltered.filter(ticket => !ticket.tecnico_asignado_id);
      } else {
        ticketsFiltered = ticketsFiltered.filter(ticket => ticket.tecnico_asignado_id === parseInt(filtros.tecnico));
      }
    }

    setTicketsFiltrados(ticketsFiltered);
  };

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      tipo: 'todos',
      estado: 'todos',
      prioridad: 'todos',
      tecnico: 'todos'
    });
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      'PENDIENTE': { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      'EN_PROCESO': { color: 'bg-blue-100 text-blue-800', text: 'En Proceso' },
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

  // Funciones para manejar modales
  const abrirDetalles = async (ticket) => {
    try {
      // Obtener detalles completos del ticket
      const response = await fetch(`/api/soporte/tickets/${ticket.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setModalDetalles({ abierto: true, ticket: result.data });
        }
      }
    } catch (err) {
      console.error('Error obteniendo detalles del ticket:', err);
    }
  };

  const abrirEditar = (ticket) => {
    setModalEditar({ abierto: true, ticket });
  };

  const abrirProcesar = (ticket) => {
    setModalProcesar({ abierto: true, ticket });
  };

  const cerrarModales = () => {
    setModalDetalles({ abierto: false, ticket: null });
    setModalEditar({ abierto: false, ticket: null });
    setModalProcesar({ abierto: false, ticket: null });
  };

  const actualizarTicket = (ticketActualizado) => {
    setTickets(tickets.map(t =>
      t.id === ticketActualizado.id ? ticketActualizado : t
    ));
    cerrarModales();
  };

  const getAccionBoton = (estado) => {
    const acciones = {
      'PENDIENTE': { texto: 'Programar', color: 'bg-blue-600 hover:bg-blue-700' },
      'ASIGNADO': { texto: 'Iniciar', color: 'bg-green-600 hover:bg-green-700' },
      'EN_PROCESO': { texto: 'Completar', color: 'bg-purple-600 hover:bg-purple-700' }
    };
    return acciones[estado] || { texto: 'Procesar', color: 'bg-gray-600 hover:bg-gray-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tickets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error al cargar tickets: {error}</p>
            <Button onClick={fetchTickets} className="mt-4">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header de la sección */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gestión de Casos</h2>
            <p className="text-gray-600">Todos los tickets: capacitaciones, reparaciones y mantenimiento</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            + Nuevo Ticket
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <select
                value={filtros.tipo}
                onChange={(e) => handleFiltroChange('tipo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los tipos</option>
                <option value="CAPACITACION">📚 Capacitación</option>
                <option value="REPARACION">🔧 Reparación</option>
                <option value="MANTENIMIENTO">⚙️ Mantenimiento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <select
                value={filtros.estado}
                onChange={(e) => handleFiltroChange('estado', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="ASIGNADO">Asignado</option>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="COMPLETADO">Completado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
              <select
                value={filtros.prioridad}
                onChange={(e) => handleFiltroChange('prioridad', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas las prioridades</option>
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Técnico</label>
              <select
                value={filtros.tecnico}
                onChange={(e) => handleFiltroChange('tecnico', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los técnicos</option>
                <option value="sin_asignar">Sin asignar</option>
                {/* TODO: Obtener lista de técnicos del backend */}
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={limpiarFiltros}
                className="whitespace-nowrap"
              >
                Limpiar
              </Button>
              <div className="text-sm text-gray-600 flex items-center">
                {ticketsFiltrados.length} de {tickets.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de tickets */}
      <div className="grid gap-4">
        {ticketsFiltrados.length > 0 ? (
          ticketsFiltrados.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{ticket.titulo}</CardTitle>
                    <CardDescription className="mt-1">
                      Código: {ticket.codigo} • Cliente: {ticket.cliente_nombre}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Tipo:</span>
                    <p className="text-gray-600">{ticket.tipo_ticket}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Teléfono:</span>
                    <p className="text-gray-600">{ticket.cliente_telefono || 'No especificado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Fecha creación:</span>
                    <p className="text-gray-600">
                      {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                {ticket.descripcion && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-gray-600 text-sm">{ticket.descripcion}</p>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirDetalles(ticket)}
                  >
                    Ver Detalles
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirEditar(ticket)}
                  >
                    Editar
                  </Button>
                  {(ticket.estado === 'PENDIENTE' || ticket.estado === 'ASIGNADO' || ticket.estado === 'EN_PROCESO') && (
                    <Button
                      size="sm"
                      className={getAccionBoton(ticket.estado).color}
                      onClick={() => abrirProcesar(ticket)}
                    >
                      {getAccionBoton(ticket.estado).texto}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tickets</h3>
              <p className="text-gray-600 mb-4">No se encontraron tickets de soporte</p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Crear primer ticket
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modales */}
      <TicketDetallesModal
        abierto={modalDetalles.abierto}
        ticket={modalDetalles.ticket}
        onCerrar={cerrarModales}
      />

      <TicketEditarModal
        abierto={modalEditar.abierto}
        ticket={modalEditar.ticket}
        onCerrar={cerrarModales}
        onActualizar={actualizarTicket}
      />

      <TicketProcesarModal
        abierto={modalProcesar.abierto}
        ticket={modalProcesar.ticket}
        onCerrar={cerrarModales}
        onActualizar={actualizarTicket}
      />
    </div>
  );
};

export default TicketsSection;