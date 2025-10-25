// src/components/prospectos/ProspectoDetailsView/ProspectoDetailsView.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Edit, Phone, Mail, Building, MapPin, DollarSign,
  Calendar, User, Package, FileText, Tag, MoreVertical,
  Clock, TrendingUp, AlertCircle, CheckCircle, Target,
  Activity, MessageCircle, ArrowLeft, Copy, Send
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import { formatearFecha, formatearFechaCorta, formatearMonto } from '../../../utils/dateHelpers';

const ProspectoDetailsView = ({ prospecto, onClose, onEdit, currentUser }) => {
  const [detallesCompletos, setDetallesCompletos] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Cargar detalles completos del prospecto
  useEffect(() => {
    if (prospecto?.id) {
      cargarDetallesProspecto();
    }
  }, [prospecto?.id]);

  const cargarDetallesProspecto = async () => {
    try {
      setLoading(true);

      // Cargar detalles del prospecto y seguimientos en paralelo
      const [detallesResponse, seguimientosResponse] = await Promise.all([
        prospectosService.obtenerPorId(prospecto.id),
        prospectosService.obtenerSeguimientosPorProspecto(prospecto.id)
      ]);

      if (detallesResponse.success && detallesResponse.data) {
        setDetallesCompletos(detallesResponse.data);
      }

      if (seguimientosResponse.success && seguimientosResponse.data) {
        setSeguimientos(seguimientosResponse.data);
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
    } finally {
      setLoading(false);
    }
  };

  const obtenerEstadoInfo = (estado) => {
    const estadosMap = {
      'Nuevo': {
        label: 'Nuevo',
        icon: '✨',
        color: 'blue',
        descripcion: 'Recién ingresado',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-200'
      },
      'Contactado': {
        label: 'Contactado',
        icon: '📞',
        color: 'purple',
        descripcion: 'En comunicación',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-800',
        borderColor: 'border-purple-200'
      },
      'Calificado': {
        label: 'Calificado',
        icon: '⭐',
        color: 'yellow',
        descripcion: 'Cliente potencial',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200'
      },
      'Cotizado': {
        label: 'Cotizado',
        icon: '📋',
        color: 'orange',
        descripcion: 'Cotización enviada',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200'
      },
      'Negociacion': {
        label: 'Negociación',
        icon: '🤝',
        color: 'indigo',
        descripcion: 'En proceso de cierre',
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-800',
        borderColor: 'border-indigo-200'
      },
      'Ganado': {
        label: 'Ganado',
        icon: '🎉',
        color: 'green',
        descripcion: 'Convertido en venta',
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        borderColor: 'border-green-200'
      },
      'Perdido': {
        label: 'Perdido',
        icon: '❌',
        color: 'red',
        descripcion: 'Oportunidad cerrada',
        bgColor: 'bg-red-50',
        textColor: 'text-red-800',
        borderColor: 'border-red-200'
      }
    };
    return estadosMap[estado] || estadosMap['Nuevo'];
  };

  const obtenerCanalInfo = (canal) => {
    const canalesMap = {
      'WhatsApp': { icono: '📱', label: 'WhatsApp', color: 'green' },
      'Messenger': { icono: '💬', label: 'Messenger', color: 'blue' },
      'Facebook': { icono: '📘', label: 'Facebook', color: 'blue' },
      'TikTok': { icono: '🎵', label: 'TikTok', color: 'black' },
      'Llamada': { icono: '📞', label: 'Llamada', color: 'gray' },
      'Presencial': { icono: '🏢', label: 'Presencial', color: 'purple' },
      'Email': { icono: '📧', label: 'Email', color: 'red' }
    };
    return canalesMap[canal] || { icono: '📱', label: canal || 'No especificado', color: 'gray' };
  };

  const obtenerNombreProducto = (producto) => {
    if (typeof producto === 'string') return producto;

    if (typeof producto === 'object' && producto !== null) {
      if (producto.codigo && producto.descripcion_producto) {
        return `${producto.codigo} - ${producto.descripcion_producto}`;
      }
      return producto.descripcion_producto || producto.nombre || 'Producto sin nombre';
    }

    return 'Producto';
  };

  const datos = detallesCompletos || prospecto;
  const estadoInfo = obtenerEstadoInfo(datos.estado || 'Nuevo');
  const canalInfo = obtenerCanalInfo(datos.canal_contacto);

  const puedeEditar = currentUser && (
    currentUser.rol === 'admin' ||
    currentUser.rol === 'manager' ||
    currentUser.rol === 'ADMIN' ||
    currentUser.rol === 'JEFE_VENTAS' ||
    currentUser.id === datos.asesor_id
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-15 p-3 rounded-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {datos.nombre_cliente} {datos.apellido_cliente}
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
                    {datos.codigo}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoInfo.bgColor} ${estadoInfo.textColor} border ${estadoInfo.borderColor}`}>
                    <span className="mr-1">{estadoInfo.icon}</span>
                    {estadoInfo.label}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white bg-opacity-20 text-white border border-white border-opacity-30">
                    <span className="mr-1">{canalInfo.icono}</span>
                    {canalInfo.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {puedeEditar && (
                <button
                  onClick={() => onEdit && onEdit(datos)}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
                  title="Editar prospecto"
                >
                  <Edit className="h-5 w-5" />
                </button>
              )}

              <button
                onClick={onClose}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)]">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* COLUMNA PRINCIPAL */}
            <div className="xl:col-span-2 space-y-6">

              {/* INFORMACIÓN BÁSICA */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Información del Prospecto</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nombre Completo</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {datos.nombre_cliente} {datos.apellido_cliente}
                    </p>
                  </div>

                  {datos.empresa && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Empresa</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Building className="h-4 w-4 mr-1 text-gray-400" />
                        {datos.empresa}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Teléfono</label>
                    <p className="text-gray-900 mt-1 flex items-center">
                      <Phone className="h-4 w-4 mr-1 text-gray-400" />
                      <a href={`tel:${datos.telefono}`} className="text-blue-600 hover:underline">
                        {datos.telefono}
                      </a>
                    </p>
                  </div>

                  {datos.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Mail className="h-4 w-4 mr-1 text-gray-400" />
                        <a href={`mailto:${datos.email}`} className="text-blue-600 hover:underline">
                          {datos.email}
                        </a>
                      </p>
                    </div>
                  )}

                  {datos.direccion && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Dirección</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                        {datos.direccion}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Ubicación</label>
                    <p className="text-gray-900 mt-1">
                      {datos.distrito && `${datos.distrito}, `}
                      {datos.ciudad && `${datos.ciudad}, `}
                      {datos.departamento}
                    </p>
                  </div>
                </div>
              </div>

              {/* PRODUCTOS DE INTERÉS */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-orange-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Productos de Interés ({datos.productos_interes?.length || 0})
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {datos.productos_interes && datos.productos_interes.length > 0 ? (
                    <div className="space-y-3">
                      {datos.productos_interes.map((producto, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              <Package className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {obtenerNombreProducto(producto)}
                                </p>

                                {typeof producto === 'object' && producto.tipo === 'catalogo' && (
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                                    <span>Cantidad: {producto.cantidad_estimada || 1}</span>
                                    {producto.precio_sin_igv && (
                                      <>
                                        <span>Precio: {formatearMonto(producto.precio_sin_igv)} / {producto.unidad_medida}</span>
                                        <span className="font-semibold text-green-600">
                                          Total: {formatearMonto(producto.valor_linea || 0)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                {typeof producto === 'object' && producto.tipo === 'personalizado' && (
                                  <span className="text-xs text-gray-500 italic mt-1 block">
                                    Producto personalizado - Precio a definir
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No hay productos de interés registrados</p>
                    </div>
                  )}
                </div>
              </div>

              {/* HISTORIAL DE SEGUIMIENTOS */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Activity className="h-5 w-5 text-purple-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Historial de Seguimientos ({seguimientos.length})
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {seguimientos && seguimientos.length > 0 ? (
                    <div className="space-y-3">
                      {seguimientos.slice(0, 5).map((seguimiento, index) => (
                        <div key={seguimiento.id || index} className={`bg-gray-50 p-4 rounded-lg border-l-4 ${seguimiento.completado ? 'border-green-400' : 'border-orange-400'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2 flex-wrap">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  seguimiento.completado
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {seguimiento.tipo || 'Llamada'}
                                </span>
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {seguimiento.completado
                                    ? formatearFecha(seguimiento.fecha_completado)
                                    : formatearFecha(seguimiento.fecha_programada)
                                  }
                                </span>
                                {seguimiento.completado && (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                              </div>

                              {seguimiento.descripcion && (
                                <p className="text-sm text-gray-700 mb-1">
                                  {seguimiento.descripcion}
                                </p>
                              )}

                              {seguimiento.notas && (
                                <p className="text-sm text-gray-600 italic mb-1">
                                  "{seguimiento.notas}"
                                </p>
                              )}

                              {seguimiento.resultado && (
                                <p className="text-xs text-blue-600 mt-1 font-medium">
                                  Resultado: {seguimiento.resultado}
                                </p>
                              )}

                              <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                                {seguimiento.asesor_nombre && (
                                  <span className="flex items-center">
                                    <User className="h-3 w-3 mr-1" />
                                    {seguimiento.asesor_nombre}
                                  </span>
                                )}
                                {seguimiento.calificacion && (
                                  <span className="flex items-center">
                                    <span className="mr-1">⭐</span>
                                    {seguimiento.calificacion}/5
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No hay seguimientos registrados</p>
                    </div>
                  )}
                </div>
              </div>

              {/* OBSERVACIONES */}
              {datos.observaciones && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center mb-3">
                    <FileText className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Observaciones</h3>
                  </div>
                  <p className="text-gray-700 text-sm bg-gray-50 p-4 rounded-lg">
                    {datos.observaciones}
                  </p>
                </div>
              )}
            </div>

            {/* PANEL LATERAL */}
            <div className="space-y-6">

              {/* RESUMEN FINANCIERO */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 p-2 rounded-lg mr-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-800">Valor Estimado</h3>
                </div>

                <div className="space-y-3">
                  {datos.presupuesto_estimado && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Presupuesto:</span>
                      <span className="font-medium text-gray-900">
                        {formatearMonto(datos.presupuesto_estimado)}
                      </span>
                    </div>
                  )}

                  {datos.valor_estimado && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor Estimado:</span>
                      <span className="font-medium text-gray-900">
                        {formatearMonto(datos.valor_estimado)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-green-200 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Probabilidad de Cierre:</span>
                      <span className="text-lg font-bold text-green-800">
                        {datos.probabilidad_cierre || 50}%
                      </span>
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${datos.probabilidad_cierre || 50}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* INFORMACIÓN DEL PROSPECTO */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles del Prospecto</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Fecha de Creación</label>
                    <p className="text-gray-900 mt-1 flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {formatearFecha(datos.created_at)}
                    </p>
                  </div>

                  {datos.fecha_seguimiento && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Próximo Seguimiento</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {formatearFecha(datos.fecha_seguimiento)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Asesor Asignado</label>
                    <p className="text-gray-900 mt-1 flex items-center">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      {datos.asesor_nombre || 'Sin asignar'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Estado Actual</label>
                    <div className={`mt-1 inline-flex items-center px-3 py-1 rounded-lg border text-sm font-medium ${estadoInfo.bgColor} ${estadoInfo.textColor} ${estadoInfo.borderColor}`}>
                      <span className="mr-2">{estadoInfo.icon}</span>
                      <span>{estadoInfo.descripcion}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Canal de Contacto</label>
                    <div className="mt-1 flex items-center">
                      <span className="mr-2">{canalInfo.icono}</span>
                      <span className="text-gray-900">{canalInfo.label}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCIONES RÁPIDAS */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>

                <div className="space-y-3">
                  {datos.telefono && (
                    <>
                      <button
                        onClick={() => window.open(`tel:${datos.telefono}`)}
                        className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Llamar
                      </button>

                      <button
                        onClick={() => window.open(`https://wa.me/${datos.telefono.replace(/\D/g, '')}?text=Hola ${datos.nombre_cliente}, te contacto de Mundipack...`)}
                        className="w-full flex items-center justify-center px-4 py-3 border border-green-300 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors font-medium"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        WhatsApp
                      </button>
                    </>
                  )}

                  {datos.email && (
                    <button
                      onClick={() => window.open(`mailto:${datos.email}?subject=Seguimiento de prospecto&body=Hola ${datos.nombre_cliente}, te contacto para...`)}
                      className="w-full flex items-center justify-center px-4 py-3 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar Email
                    </button>
                  )}

                  <button
                    onClick={() => navigator.clipboard.writeText(`${datos.nombre_cliente} ${datos.apellido_cliente} - ${datos.telefono}`)}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Información
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {estadoInfo.label} • {formatearFechaCorta(datos.created_at)} • {canalInfo.label}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2 inline" />
                Volver
              </button>

              {puedeEditar && onEdit && (
                <button
                  onClick={() => onEdit(datos)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Edit className="h-4 w-4 mr-2 inline" />
                  Editar Prospecto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProspectoDetailsView;
