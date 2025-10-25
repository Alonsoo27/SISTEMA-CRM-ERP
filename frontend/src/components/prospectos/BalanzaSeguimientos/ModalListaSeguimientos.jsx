// src/components/prospectos/BalanzaSeguimientos/ModalListaSeguimientos.jsx
import React from 'react';
import { X, Clock, CheckCircle, Target, User } from 'lucide-react';
import { formatearFechaHora } from '../../../utils/dateHelpers';

const ModalListaSeguimientos = ({
  isOpen,
  onClose,
  tipo, // 'pendientes' | 'completados'
  datos,
  filtros,
  setFiltros,
  tiposDisponibles,
  prospectosExpandidos,
  toggleExpansion,
  onCompletarSeguimiento,
  onVerDetalles
}) => {
  if (!isOpen) return null;

  const titulo = tipo === 'pendientes' ? 'Seguimientos Pendientes' : 'Seguimientos Completados (Últimos 7 días)';
  const icono = tipo === 'pendientes' ? Clock : CheckCircle;
  const colorTema = tipo === 'pendientes' ? 'red' : 'green';

  // Calcular el total real de seguimientos (para mostrar en el contador)
  const totalSeguimientosReales = tipo === 'completados'
    ? datos.reduce((acc, grupo) => acc + (grupo.seguimientos ? grupo.seguimientos.length : 1), 0)
    : datos.length;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 bg-${colorTema}-50 border-b border-${colorTema}-200 rounded-t-lg flex-shrink-0`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {React.createElement(icono, { className: `h-6 w-6 text-${colorTema}-600` })}
              <h3 className={`text-lg font-semibold text-${colorTema}-800`}>{titulo}</h3>
              <span className={`px-3 py-1 bg-${colorTema}-200 text-${colorTema}-800 rounded-full text-sm font-medium`}>
                {tipo === 'completados' ? `${datos.length} prospectos` : datos.length}
              </span>
              {tipo === 'completados' && totalSeguimientosReales > datos.length && (
                <span className="text-xs text-gray-600">
                  ({totalSeguimientosReales} seguimientos totales)
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Cerrar"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Barra de filtros y búsqueda */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Buscador */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o código..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
              </div>
            </div>

            {/* Filtro por tipo */}
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros(prev => ({ ...prev, tipo: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos los tipos</option>
              {tiposDisponibles.map(tipoOpt => (
                <option key={tipoOpt} value={tipoOpt}>{tipoOpt}</option>
              ))}
            </select>

            {/* Filtro por urgencia (solo para pendientes) */}
            {tipo === 'pendientes' && (
              <select
                value={filtros.urgencia}
                onChange={(e) => setFiltros(prev => ({ ...prev, urgencia: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todas las urgencias</option>
                <option value="vencidos">Solo vencidos</option>
                <option value="hoy">Solo vigentes</option>
              </select>
            )}

            {/* Botón limpiar filtros */}
            {(filtros.busqueda || filtros.tipo !== 'todos' || filtros.urgencia !== 'todos') && (
              <button
                onClick={() => setFiltros({ tipo: 'todos', urgencia: 'todos', busqueda: '' })}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {datos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No hay {tipo} en este momento</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {datos.map((itemGrupo, index) => {
                // Determinar si es un grupo o un item individual
                const esGrupo = tipo === 'completados' && itemGrupo.seguimientos;
                const item = esGrupo ? itemGrupo.seguimiento_mas_reciente : itemGrupo;
                const seguimientoId = item.id;
                const prospectoId = item.prospecto_id;
                const estaExpandido = prospectosExpandidos[prospectoId];
                const totalSeguimientos = esGrupo ? itemGrupo.seguimientos.length : 1;

                return (
                  <div key={seguimientoId || `${prospectoId}-${index}` || index} className="hover:bg-gray-50 transition-colors">
                    {/* Card Principal */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-gray-900">
                                {`${item.nombre_cliente || item.prospecto_nombre || ''} ${item.apellido_cliente || ''}`.trim() || 'Sin nombre'}
                              </h4>
                              {/* Contador de seguimientos */}
                              {esGrupo && totalSeguimientos > 1 && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                  {totalSeguimientos} seguimientos
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              #{item.prospecto_codigo || item.codigo || 'N/A'}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center space-x-1">
                              <span>📞</span>
                              <span>{item.telefono || 'Sin teléfono'}</span>
                            </span>
                            {item.asesor_nombre && (
                              <span className="flex items-center space-x-1">
                                <User className="h-3 w-3" />
                                <span>{item.asesor_nombre}</span>
                              </span>
                            )}
                            {item.valor_estimado && (
                              <span className="flex items-center space-x-1">
                                <span>💰</span>
                                <span className="font-semibold">${item.valor_estimado.toLocaleString()}</span>
                              </span>
                            )}
                            {item.probabilidad_cierre && (
                              <span className="flex items-center space-x-1">
                                <Target className="h-3 w-3" />
                                <span>{item.probabilidad_cierre}%</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-xs space-y-1">
                            <div className="flex items-center justify-between text-gray-500">
                              <span>
                                {tipo === 'pendientes'
                                  ? `⏰ Vence: ${formatearFechaHora(item.fecha_programada)}`
                                  : `✅ Último: ${formatearFechaHora(item.fecha_completado || item.created_at)}`
                                }
                              </span>
                              {tipo === 'pendientes' && item.fecha_programada && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  new Date(item.fecha_programada) < new Date()
                                    ? 'bg-red-100 text-red-700'
                                    : new Date(item.fecha_programada) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {new Date(item.fecha_programada) < new Date()
                                    ? '🚨 Vencido'
                                    : new Date(item.fecha_programada) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                                    ? '⚠️ Hoy'
                                    : '📅 Programado'
                                  }
                                </span>
                              )}
                            </div>

                            {item.resultado && (
                              <div className="text-gray-600 bg-gray-50 p-2 rounded">
                                <span className="font-medium">📝 Resultado:</span> {item.resultado}
                              </div>
                            )}

                            {item.estado && (
                              <div className="flex items-center text-gray-500">
                                <span className="font-medium">Estado:</span>
                                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                                  item.estado === 'Negociacion' ? 'bg-orange-100 text-orange-700' :
                                  item.estado === 'Cotizado' ? 'bg-blue-100 text-blue-700' :
                                  item.estado === 'Cerrado' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {item.estado}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Etiquetas y Botones de acción */}
                        <div className="flex items-center space-x-2 ml-4">
                          {/* Etiquetas de estado */}
                          {item.vencido && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                              Vencido
                            </span>
                          )}
                          {item.tipo && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {item.tipo}
                            </span>
                          )}
                          {item.valor_estimado && item.valor_estimado >= 2000 && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                              💎 Alto valor
                            </span>
                          )}
                          {item.valor_estimado && item.valor_estimado >= 1000 && item.valor_estimado < 2000 && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              💼 Valor medio
                            </span>
                          )}
                          {item.estado === 'Negociacion' && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              🎯 Conv. potencial
                            </span>
                          )}

                          {/* Botones de acción */}
                          {tipo === 'pendientes' && !item.completado && (
                            <button
                              onClick={() => onCompletarSeguimiento(item)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                            >
                              COMPLETAR
                            </button>
                          )}
                          <button
                            onClick={() => onVerDetalles(item)}
                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                          >
                            Ver
                          </button>
                          {esGrupo && totalSeguimientos > 1 && (
                            <button
                              onClick={() => toggleExpansion(prospectoId)}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                            >
                              {estaExpandido ? 'Ocultar' : 'Expandir'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Panel Expandido (solo para completados con múltiples seguimientos) */}
                      {esGrupo && estaExpandido && itemGrupo.seguimientos && (
                        <div className="mt-4 border-t border-gray-200 pt-4">
                          <h5 className="text-xs font-semibold text-gray-700 mb-2">
                            Historial de seguimientos ({totalSeguimientos})
                          </h5>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {itemGrupo.seguimientos.map((seg, idx) => (
                              <div key={seg.id || idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-gray-900">
                                    {idx === 0 ? '🔵 Más reciente' : `#${idx + 1}`}
                                  </span>
                                  <span className="text-gray-500">
                                    {formatearFechaHora(seg.fecha_completado || seg.created_at)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2 text-gray-600">
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    {seg.tipo}
                                  </span>
                                  {seg.resultado && (
                                    <span className="text-xs">📝 {seg.resultado}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalListaSeguimientos;
