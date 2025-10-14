import React from 'react';
import {
  AlertTriangle,
  XCircle,
  User,
  Calendar,
  X,
  CheckCircle
} from 'lucide-react';

/**
 * Modal de Confirmación para Prospectos Duplicados
 * Muestra advertencia cuando se intenta registrar un prospecto que ya existe
 * Usa Tailwind CSS (sin Material-UI)
 */
const ModalConfirmarDuplicado = ({
  open,
  onClose,
  onConfirm,
  datosValidacion,
  loading = false
}) => {
  if (!open || !datosValidacion) return null;

  const {
    mensaje,
    escenario,
    asesores_activos = [],
    productos_en_comun = [],
    motivo_bloqueo
  } = datosValidacion;

  // Determinar si es bloqueo total
  const esBloqueo = escenario === 'C_BLOQUEAR_PRODUCTO_AVANZADO';

  // Función para formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Determinar color del chip según estado
  const obtenerColorEstado = (estado) => {
    const colores = {
      'Prospecto': 'bg-gray-100 text-gray-800',
      'Cotizado': 'bg-blue-100 text-blue-800',
      'Negociacion': 'bg-yellow-100 text-yellow-800',
      'Cerrado': 'bg-green-100 text-green-800',
      'Perdido': 'bg-red-100 text-red-800'
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${esBloqueo ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {esBloqueo ? (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  <h2 className="text-xl font-bold text-red-900">
                    No se puede crear el prospecto
                  </h2>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                  <h2 className="text-xl font-bold text-amber-900">
                    Prospecto ya está siendo atendido
                  </h2>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {esBloqueo ? (
            // ESCENARIO C: BLOQUEO
            <div>
              <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg">
                <div className="flex items-start">
                  <XCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-red-900 mb-1">
                      Producto en negociación activa
                    </h3>
                    <p className="text-sm text-red-800">
                      {motivo_bloqueo?.mensaje || mensaje}
                    </p>
                  </div>
                </div>
              </div>

              {motivo_bloqueo && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-semibold text-red-900 mr-2">Asesor:</span>
                      <span className="text-sm text-red-800">{motivo_bloqueo.asesor_nombre}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-semibold text-red-900 mr-2">Estado:</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${obtenerColorEstado(motivo_bloqueo.estado)}`}>
                        {motivo_bloqueo.estado}
                      </span>
                    </div>
                    {motivo_bloqueo.productos && motivo_bloqueo.productos.length > 0 && (
                      <div className="flex items-start">
                        <span className="text-sm font-semibold text-red-900 mr-2">Productos:</span>
                        <span className="text-sm text-red-800">{motivo_bloqueo.productos.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  No puedes registrar este prospecto porque otro asesor ya está trabajando
                  con el mismo producto en una etapa avanzada (Cotizado o Negociación).
                </p>
              </div>
            </div>
          ) : (
            // ESCENARIO B: ADVERTENCIA
            <div>
              <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 mb-1">
                      Este número ya está registrado
                    </h3>
                    <p className="text-sm text-amber-800">{mensaje}</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-bold text-gray-900 mb-3">
                  Asesores trabajando con este número:
                </h4>

                <div className="space-y-2">
                  {asesores_activos.map((asesor, index) => (
                    <div
                      key={asesor.id || index}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-900">
                              {asesor.asesor_nombre}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${obtenerColorEstado(asesor.estado)}`}>
                              {asesor.estado}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>Registrado el {formatearFecha(asesor.fecha_registro)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {productos_en_comun && productos_en_comun.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Productos en común:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {productos_en_comun.map((item, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {item.asesor_nombre}: {item.productos.join(', ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Puedes continuar con el registro.</strong> El otro asesor recibirá una notificación
                  de que también estás trabajando este prospecto.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancelar
          </button>
          {!esBloqueo && (
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Sí, registrar de todas formas
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalConfirmarDuplicado;
