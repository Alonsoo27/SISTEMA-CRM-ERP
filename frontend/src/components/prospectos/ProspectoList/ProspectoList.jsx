// src/components/prospectos/ProspectoList/ProspectoList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, Download, Edit, Trash2, Phone, Mail,
  Building, Calendar, DollarSign, User, Eye, MoreVertical,
  ChevronLeft, ChevronRight, ArrowUpDown, AlertCircle, RefreshCw
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import { formatearVencimiento } from '../../../utils/formatearVencimiento';

const ProspectoList = ({ refreshTrigger = 0, onEdit, onView }) => {
  const [prospectosCache, setProspectosCache] = useState([]); // Todos los prospectos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para filtros y búsqueda (sin debounce, filtrado inmediato)
  const [filtros, setFiltros] = useState({
    busqueda: '',
    estado: '',
    asesor_id: '',
    canal_contacto: '',
    fecha_desde: '',
    fecha_hasta: ''
  });

  // Estados para paginación client-side
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    por_pagina: 10
  });

  // Estados para ordenamiento
  const [ordenamiento, setOrdenamiento] = useState({
    campo: 'fecha_contacto',
    direccion: 'desc'
  });

  // Estados disponibles
  const estados = ['Prospecto', 'Cotizado', 'Negociacion', 'Cerrado', 'Perdido'];

  // Canales de contacto
  const canales = ['WhatsApp', 'Facebook', 'TikTok', 'Llamada', 'Email', 'Presencial'];

  // Cargar todos los prospectos una sola vez
  useEffect(() => {
    cargarProspectos();
  }, [refreshTrigger]);

  const cargarProspectos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar TODOS los prospectos sin filtros ni paginación
      const parametros = {
        exportar: true // Esto debería traer todos los registros
      };

      const response = await prospectosService.obtenerTodos(parametros);

      setProspectosCache(response.data || []);

    } catch (err) {
      setError(err.message);
      console.error('Error cargando prospectos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar y ordenar prospectos en memoria (client-side)
  const prospectosFiltrados = useMemo(() => {
    let resultado = [...prospectosCache];

    // Filtro de búsqueda
    if (filtros.busqueda) {
      const termino = filtros.busqueda.toLowerCase();
      resultado = resultado.filter(p =>
        p.nombre_cliente?.toLowerCase().includes(termino) ||
        p.apellido_cliente?.toLowerCase().includes(termino) ||
        p.empresa?.toLowerCase().includes(termino) ||
        p.telefono?.toLowerCase().includes(termino) ||
        p.email?.toLowerCase().includes(termino) ||
        p.codigo?.toLowerCase().includes(termino)
      );
    }

    // Filtro por estado
    if (filtros.estado) {
      resultado = resultado.filter(p => p.estado === filtros.estado);
    }

    // Filtro por canal de contacto
    if (filtros.canal_contacto) {
      resultado = resultado.filter(p => p.canal_contacto === filtros.canal_contacto);
    }

    // Filtro por asesor
    if (filtros.asesor_id) {
      resultado = resultado.filter(p => p.asesor_id === filtros.asesor_id);
    }

    // Filtro por fecha desde
    if (filtros.fecha_desde) {
      resultado = resultado.filter(p => new Date(p.fecha_contacto) >= new Date(filtros.fecha_desde));
    }

    // Filtro por fecha hasta
    if (filtros.fecha_hasta) {
      resultado = resultado.filter(p => new Date(p.fecha_contacto) <= new Date(filtros.fecha_hasta));
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      let valorA = a[ordenamiento.campo];
      let valorB = b[ordenamiento.campo];

      // Manejar valores null/undefined
      if (valorA === null || valorA === undefined) valorA = '';
      if (valorB === null || valorB === undefined) valorB = '';

      // Convertir a string para comparación
      if (typeof valorA === 'string') valorA = valorA.toLowerCase();
      if (typeof valorB === 'string') valorB = valorB.toLowerCase();

      if (ordenamiento.direccion === 'asc') {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });

    return resultado;
  }, [prospectosCache, filtros, ordenamiento]);

  // Paginación client-side
  const prospectosPaginados = useMemo(() => {
    const inicio = (paginacion.pagina - 1) * paginacion.por_pagina;
    const fin = inicio + paginacion.por_pagina;
    return prospectosFiltrados.slice(inicio, fin);
  }, [prospectosFiltrados, paginacion.pagina, paginacion.por_pagina]);

  const totalPaginas = Math.ceil(prospectosFiltrados.length / paginacion.por_pagina);
  const totalResultados = prospectosFiltrados.length;

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPaginacion(prev => ({ ...prev, pagina: 1 })); // Reset a página 1
  };

  const handleOrdenamiento = (campo) => {
    setOrdenamiento(prev => ({
      campo,
      direccion: prev.campo === campo && prev.direccion === 'asc' ? 'desc' : 'asc'
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      busqueda: '',
      estado: '',
      asesor_id: '',
      canal_contacto: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
    setPaginacion(prev => ({ ...prev, pagina: 1 }));
  };

  const exportarDatos = async () => {
    try {
      // Obtener todos los datos sin paginación
      const response = await prospectosService.obtenerTodos({ ...filtros, exportar: true });
      
      // Crear CSV
      const headers = [
        'Código', 'Nombre', 'Apellido', 'Empresa', 'Teléfono', 'Email',
        'Estado', 'Canal', 'Valor Estimado', 'Probabilidad', 'Asesor', 'Fecha Contacto'
      ];
      
      const rows = response.data.map(prospecto => [
        prospecto.codigo,
        prospecto.nombre_cliente,
        prospecto.apellido_cliente,
        prospecto.empresa || '',
        prospecto.telefono,
        prospecto.email || '',
        prospecto.estado,
        prospecto.canal_contacto,
        prospecto.valor_estimado || 0,
        prospecto.probabilidad_cierre || 0,
        prospecto.asesor_nombre,
        new Date(prospecto.fecha_contacto).toLocaleDateString()
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      // Descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `prospectos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
    } catch (err) {
      alert('Error exportando datos: ' + err.message);
    }
  };

  const formatearValor = (valor) => {
    if (!valor) return '-';
    return `$${valor.toLocaleString()}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE');
  };

  const getEstadoBadge = (estado) => {
    const colores = {
      'Prospecto': 'bg-blue-100 text-blue-800',
      'Cotizado': 'bg-yellow-100 text-yellow-800',
      'Negociacion': 'bg-orange-100 text-orange-800',
      'Cerrado': 'bg-green-100 text-green-800',
      'Perdido': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colores[estado] || 'bg-gray-100 text-gray-800'}`}>
        {estado}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header con filtros */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Búsqueda */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, empresa..."
                value={filtros.busqueda}
                onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filtros rápidos */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filtros.estado}
              onChange={(e) => handleFiltroChange('estado', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              {estados.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>

            <select
              value={filtros.canal_contacto}
              onChange={(e) => handleFiltroChange('canal_contacto', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los canales</option>
              {canales.map(canal => (
                <option key={canal} value={canal}>{canal}</option>
              ))}
            </select>

            <button
              onClick={limpiarFiltros}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Limpiar
            </button>

            <button
              onClick={exportarDatos}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                { key: 'codigo', label: 'Código' },
                { key: 'nombre_cliente', label: 'Cliente' },
                { key: 'empresa', label: 'Empresa' },
                { key: 'telefono', label: 'Contacto' },
                { key: 'estado', label: 'Estado' },
                { key: 'canal_contacto', label: 'Canal' },
                { key: 'valor_estimado', label: 'Valor' },
                { key: 'asesor_nombre', label: 'Asesor' },
                { key: 'fecha_contacto', label: 'Fecha' },
                { key: 'acciones', label: 'Acciones' }
              ].map((columna) => (
                <th
                  key={columna.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {columna.key !== 'acciones' ? (
                    <button
                      onClick={() => handleOrdenamiento(columna.key)}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>{columna.label}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : (
                    columna.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {prospectosPaginados.map((prospecto) => {
              // 🔄 DETECTAR SI ES TRASPASADO
              const esTraspasado = prospecto.traspasado_por_vencimiento === true;

              // 📅 FORMATEAR VENCIMIENTO
              const vencimientoInfo = (prospecto.estado !== 'Cerrado' && prospecto.estado !== 'Perdido' && prospecto.seguimiento_obligatorio)
                ? formatearVencimiento(prospecto.seguimiento_obligatorio)
                : null;

              return (
                <tr
                  key={prospecto.id}
                  className={`hover:bg-gray-100 transition-colors ${
                    esTraspasado ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {prospecto.codigo}
                      {esTraspasado && (
                        <RefreshCw className="h-3 w-3 text-amber-600" title="Prospecto traspasado" />
                      )}
                    </div>
                  </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {prospecto.nombre_cliente} {prospecto.apellido_cliente}
                    </div>
                    {prospecto.email && (
                      <div className="text-sm text-gray-500">{prospecto.email}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {prospecto.empresa || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{prospecto.telefono}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getEstadoBadge(prospecto.estado)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {prospecto.canal_contacto}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatearValor(prospecto.valor_estimado)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {prospecto.asesor_nombre}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatearFecha(prospecto.fecha_contacto)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onView?.(prospecto)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit?.(prospecto)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {vencimientoInfo && (
                      <span className={`text-xs ${vencimientoInfo.color}`} title={vencimientoInfo.texto}>
                        ⏰
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((paginacion.pagina - 1) * paginacion.por_pagina) + 1} a{' '}
              {Math.min(paginacion.pagina * paginacion.por_pagina, totalResultados)} de{' '}
              {totalResultados} resultados
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPaginacion(prev => ({ ...prev, pagina: prev.pagina - 1 }))}
                disabled={paginacion.pagina === 1}
                className="p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className="px-3 py-1 text-sm">
                Página {paginacion.pagina} de {totalPaginas}
              </span>
              
              <button
                onClick={() => setPaginacion(prev => ({ ...prev, pagina: prev.pagina + 1 }))}
                disabled={paginacion.pagina === totalPaginas}
                className="p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado de error */}
      {error && (
        <div className="p-6 border-t border-red-200 bg-red-50">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-700">Error: {error}</p>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && prospectosPaginados.length === 0 && (
        <div className="p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay prospectos</h3>
          <p className="text-gray-600">
            {prospectosCache.length === 0
              ? 'No hay prospectos registrados.'
              : 'No se encontraron prospectos con los filtros aplicados.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProspectoList;