// src/components/prospectos/KanbanFilters/KanbanFilters.jsx
import React, { useState } from 'react';
import { Filter, Download, X, Calendar, User, Search } from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const KanbanFilters = ({ filtros, onFiltrosChange, onExportar }) => {
  const [showFilters, setShowFilters] = useState(false);

  const estados = ['Prospecto', 'Cotizado', 'Negociacion', 'Cerrado', 'Perdido'];
  const canales = ['WhatsApp', 'Facebook', 'TikTok', 'Llamada', 'Email', 'Presencial'];

  const handleFiltroChange = (campo, valor) => {
    onFiltrosChange({ ...filtros, [campo]: valor });
  };

  const limpiarFiltros = () => {
    onFiltrosChange({
      asesor_id: null,
      estado: '',
      canal_contacto: '',
      busqueda: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
  };

  const exportarKanban = async () => {
    try {
      const response = await prospectosService.obtenerKanban(filtros.asesor_id);
      const prospectos = Object.values(response.data).flat();
      
      // Crear CSV
      const headers = [
        'Código', 'Nombre', 'Apellido', 'Empresa', 'Teléfono', 'Email',
        'Estado', 'Canal', 'Valor Estimado', 'Probabilidad', 'Asesor', 'Fecha Contacto'
      ];
      
      const rows = prospectos.map(prospecto => [
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
      link.download = `kanban_prospectos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      onExportar?.();
    } catch (err) {
      alert('Error exportando datos: ' + err.message);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Filtro rápido de asesor */}
      <select
        value={filtros.asesor_id || ''}
        onChange={(e) => handleFiltroChange('asesor_id', e.target.value || null)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos los asesores</option>
        <option value="1">Mi pipeline</option>
      </select>

      {/* Botón de filtros avanzados */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filtros
        {Object.values(filtros).some(v => v && v !== '') && (
          <span className="ml-2 bg-blue-500 text-white rounded-full text-xs px-2 py-1">
            {Object.values(filtros).filter(v => v && v !== '').length}
          </span>
        )}
      </button>

      {/* Botón de exportar */}
      <button
        onClick={exportarKanban}
        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
      >
        <Download className="h-4 w-4 mr-2" />
        Exportar
      </button>

      {/* Panel de filtros expandido */}
      {showFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Filtros Avanzados</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Búsqueda */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Búsqueda
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nombre, teléfono, empresa..."
                      value={filtros.busqueda || ''}
                      onChange={(e) => handleFiltroChange('busqueda', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={filtros.estado || ''}
                    onChange={(e) => handleFiltroChange('estado', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos los estados</option>
                    {estados.map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>

                {/* Canal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Canal de Contacto
                  </label>
                  <select
                    value={filtros.canal_contacto || ''}
                    onChange={(e) => handleFiltroChange('canal_contacto', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos los canales</option>
                    {canales.map(canal => (
                      <option key={canal} value={canal}>{canal}</option>
                    ))}
                  </select>
                </div>

                {/* Rango de fechas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={filtros.fecha_desde || ''}
                      onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={filtros.fecha_hasta || ''}
                      onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={limpiarFiltros}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Limpiar Filtros
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanFilters;