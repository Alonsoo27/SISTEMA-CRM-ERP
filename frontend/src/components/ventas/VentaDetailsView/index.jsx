// src/components/ventas/VentaDetailsView/index.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Download, Printer, Edit, Mail, Phone, Building,
  Calendar, User, DollarSign, Package, FileText,
  MapPin, CreditCard, ArrowLeft, ExternalLink,
  CheckCircle, Clock, Truck, Star, Tag, Award,
  Copy, Send, Eye, MoreVertical
} from 'lucide-react';
import ventasService from '../../../services/ventasService';
import pdfExportService from '../../../services/pdfExportService';

const VentaDetailsView = ({ venta, onClose, onEdit, currentUser }) => {
  const [detallesCompletos, setDetallesCompletos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Cargar detalles completos de la venta
  useEffect(() => {
    if (venta?.id) {
      cargarDetallesVenta();
    }
  }, [venta?.id]);

  const cargarDetallesVenta = async () => {
    try {
      setLoading(true);
      const response = await ventasService.obtenerVentaPorId(venta.id);
      
      if (response.success && response.data?.data) {
        setDetallesCompletos(response.data.data);
        setProductos(response.data.data.detalles || []);
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatearMonto = (valor) => {
    if (!valor || isNaN(valor)) return '$0.00';
    return `$${parseFloat(valor).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long', 
      year: 'numeric'
    });
  };

  const formatearFechaCorta = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const obtenerEstadoDetallado = (estadoValue) => {
    const estadosMap = {
      'vendido': { label: 'Vendido', icon: '📦', color: 'blue', descripcion: 'Venta registrada', bgColor: 'bg-blue-50', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
      'vendido/enviado': { label: 'Enviado', icon: '🚚', color: 'yellow', descripcion: 'En tránsito', bgColor: 'bg-yellow-50', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
      'vendido/enviado/recibido': { label: 'Recibido', icon: '📫', color: 'orange', descripcion: 'Cliente confirmó', bgColor: 'bg-orange-50', textColor: 'text-orange-800', borderColor: 'border-orange-200' },
      'vendido/enviado/recibido/capacitado': { label: 'Completado', icon: '✅', color: 'green', descripcion: 'Proceso completo', bgColor: 'bg-green-50', textColor: 'text-green-800', borderColor: 'border-green-200' },
      'anulado': { label: 'Anulado', icon: '❌', color: 'red', descripcion: 'Venta cancelada', bgColor: 'bg-red-50', textColor: 'text-red-800', borderColor: 'border-red-200' },
      'cambio': { label: 'Cambio', icon: '🔄', color: 'purple', descripcion: 'Cliente solicitó cambio', bgColor: 'bg-purple-50', textColor: 'text-purple-800', borderColor: 'border-purple-200' }
    };
    return estadosMap[estadoValue] || estadosMap['vendido'];
  };

  const obtenerTipoDocumento = (tipoVenta) => {
    const tiposMap = {
      'factura': { label: 'Factura', color: 'purple', descripcion: 'Documento fiscal con IGV', bgColor: 'bg-purple-50', textColor: 'text-purple-800', borderColor: 'border-purple-200' },
      'boleta': { label: 'Boleta', color: 'blue', descripcion: 'Comprobante de venta', bgColor: 'bg-blue-50', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
      'nota_venta': { label: 'Nota de venta', color: 'green', descripcion: 'Documento interno', bgColor: 'bg-green-50', textColor: 'text-green-800', borderColor: 'border-green-200' }
    };
    return tiposMap[tipoVenta] || tiposMap['boleta'];
  };

  const obtenerCanalOrigen = (canalOrigen) => {
    const canalesMap = {
      'venta-directa': { label: 'Venta Directa', icon: '🎯', color: 'blue', descripcion: 'Creada directamente' },
      'pipeline-convertido': { label: 'Pipeline Convertido', icon: '🏆', color: 'green', descripcion: 'Prospecto exitoso' }
    };
    return canalesMap[canalOrigen] || canalesMap['venta-directa'];
  };

  const datos = detallesCompletos || venta;
  const estadoInfo = obtenerEstadoDetallado(datos.estado_detallado || 'vendido');
  const tipoInfo = obtenerTipoDocumento(datos.tipo_venta || 'boleta');
  const canalInfo = obtenerCanalOrigen(datos.canal_origen || 'venta-directa');

  const puedeEditar = currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'manager');

  // 🎯 OBTENER NOMBRE DINÁMICO SEGÚN TIPO DE DOCUMENTO
  const obtenerNombreCliente = () => {
    // Verificar si hay cliente vinculado con razón social
    if (datos.cliente_razon_social) {
      return datos.cliente_razon_social;
    }

    // Si no hay cliente, usar datos de la venta
    const nombre = datos.nombre_cliente || datos.cliente_nombre || '';
    const apellido = datos.apellido_cliente || datos.cliente_apellido || '';

    // Si tiene apellido, es persona (DNI/CE/PASAPORTE)
    if (apellido && apellido !== '.') {
      return `${nombre} ${apellido}`.trim();
    }

    // Si no tiene apellido o es ".", es empresa (RUC)
    return nombre || 'Cliente no especificado';
  };

  // Función para descargar PDF
  const handleDescargarPDF = async () => {
    try {
      const result = await pdfExportService.exportarVentaDetalle(datos, productos);
      if (!result.success) {
        alert('Error generando PDF');
      }
      // Si es exitoso, no mostramos nada - la descarga habla por sí sola
    } catch (error) {
      alert('Error descargando PDF');
    }
  };

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
        
        {/* HEADER EMPRESARIAL */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-15 p-3 rounded-lg">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {datos.codigo || `VTA-${datos.id?.substring(0, 8)}`}
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tipoInfo.bgColor} ${tipoInfo.textColor} border ${tipoInfo.borderColor}`}>
                    <Tag className="h-3 w-3 mr-1 inline" />
                    {tipoInfo.label}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoInfo.bgColor} ${estadoInfo.textColor} border ${estadoInfo.borderColor}`}>
                    <span className="mr-1">{estadoInfo.icon}</span>
                    {estadoInfo.label}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white bg-opacity-20 text-white border border-white border-opacity-30">
                    <span className="mr-1">{canalInfo.icon}</span>
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
                  title="Editar venta"
                >
                  <Edit className="h-5 w-5" />
                </button>
              )}
              
              {/* Menú de más acciones */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
                  title="Más acciones"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                
                {showMoreActions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                    <button
                      onClick={() => {
                        window.print();
                        setShowMoreActions(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-gray-700"
                    >
                      <Printer className="h-4 w-4 mr-3 text-gray-500" />
                      Imprimir
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(datos.codigo);
                        setShowMoreActions(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-gray-700"
                    >
                      <Copy className="h-4 w-4 mr-3 text-gray-500" />
                      Copiar código
                    </button>
                    <button
                      onClick={() => {
                        handleDescargarPDF();
                        setShowMoreActions(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-gray-700"
                    >
                      <Download className="h-4 w-4 mr-3 text-gray-500" />
                      Descargar PDF
                    </button>
                  </div>
                )}
              </div>
              
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
              
              {/* INFORMACIÓN DEL CLIENTE */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Información del Cliente</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nombre / Razón Social</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {obtenerNombreCliente()}
                    </p>
                  </div>
                  
                  {datos.cliente_empresa && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Empresa</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Building className="h-4 w-4 mr-1 text-gray-400" />
                        {datos.cliente_empresa}
                      </p>
                    </div>
                  )}
                  
                  {datos.cliente_email && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Mail className="h-4 w-4 mr-1 text-gray-400" />
                        <a href={`mailto:${datos.cliente_email}`} className="text-blue-600 hover:underline">
                          {datos.cliente_email}
                        </a>
                      </p>
                    </div>
                  )}
                  
                  {datos.cliente_telefono && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Teléfono</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Phone className="h-4 w-4 mr-1 text-gray-400" />
                        <a href={`tel:${datos.cliente_telefono}`} className="text-blue-600 hover:underline">
                          {datos.cliente_telefono}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* PRODUCTOS */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-green-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Productos ({productos.length})
                      </h3>
                    </div>
                    <span className="text-sm text-gray-600">
                      {productos.reduce((sum, p) => sum + parseFloat(p.cantidad || 0), 0)} unidades total
                    </span>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Código
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          P. Unitario
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productos.map((producto, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {producto.producto_codigo || producto.producto_id || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>
                              <p className="font-medium">
                                {producto.descripcion_personalizada || producto.producto_nombre || 'Sin descripción'}
                              </p>
                              {producto.marca && (
                                <p className="text-xs text-gray-500 mt-1">Marca: {producto.marca}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                            {producto.cantidad} {producto.unidad_medida || 'und'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {formatearMonto(producto.precio_unitario)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                            {formatearMonto(producto.total_linea || producto.subtotal)}
                          </td>
                        </tr>
                      ))}
                      
                      {productos.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                            <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No hay productos registrados</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* PANEL LATERAL */}
            <div className="space-y-6">
              
              {/* RESUMEN FINANCIERO */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 p-2 rounded-lg mr-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-800">Resumen Financiero</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">
                      {formatearMonto(datos.subtotal || datos.valor_total)}
                    </span>
                  </div>
                  
                  {datos.descuento_monto && parseFloat(datos.descuento_monto) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span className="text-sm">Descuento:</span>
                      <span className="font-medium">-{formatearMonto(datos.descuento_monto)}</span>
                    </div>
                  )}
                  
                  {datos.descuento_porcentaje && parseFloat(datos.descuento_porcentaje) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span className="text-sm">Descuento ({datos.descuento_porcentaje}%):</span>
                      <span className="font-medium">
                        -{formatearMonto((parseFloat(datos.valor_total || 0) * parseFloat(datos.descuento_porcentaje)) / 100)}
                      </span>
                    </div>
                  )}
                  
                  {datos.igv && parseFloat(datos.igv) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">IGV (18%):</span>
                      <span className="font-medium text-gray-900">{formatearMonto(datos.igv)}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-green-200 pt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold text-green-800">TOTAL:</span>
                      <span className="text-xl font-bold text-green-800">
                        {formatearMonto(datos.valor_final)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* INFORMACIÓN DE LA VENTA */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles de la Venta</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Fecha de Creación</label>
                    <p className="text-gray-900 mt-1 flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {formatearFecha(datos.fecha_creacion)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Asesor Responsable</label>
                    <p className="text-gray-900 mt-1 flex items-center">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      {datos.asesor_nombre_completo || 'Sin asignar'}
                    </p>
                    {datos.asesor_email && (
                      <p className="text-xs text-gray-500 ml-6">{datos.asesor_email}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Estado del Proceso</label>
                    <div className={`mt-1 inline-flex items-center px-3 py-1 rounded-lg border text-sm font-medium ${estadoInfo.bgColor} ${estadoInfo.textColor} ${estadoInfo.borderColor}`}>
                      <span className="mr-2">{estadoInfo.icon}</span>
                      <span>{estadoInfo.descripcion}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Canal de Origen</label>
                    <div className="mt-1 flex items-center">
                      <span className="mr-2">{canalInfo.icon}</span>
                      <span className="text-gray-900">{canalInfo.descripcion}</span>
                    </div>
                  </div>
                  
                  {datos.fecha_entrega_estimada && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Fecha de Entrega</label>
                      <p className="text-gray-900 mt-1 flex items-center">
                        <Truck className="h-4 w-4 mr-2 text-gray-400" />
                        {formatearFecha(datos.fecha_entrega_estimada)}
                      </p>
                    </div>
                  )}

                  {datos.notas_internas && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Notas Internas</label>
                      <p className="text-gray-900 mt-1 text-sm bg-gray-50 p-3 rounded-md">
                        {datos.notas_internas}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ACCIONES RÁPIDAS */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => window.print()}
                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Documento
                  </button>
                  
                  {datos.cliente_email && (
                    <button
                      onClick={() => window.open(`mailto:${datos.cliente_email}?subject=Venta ${datos.codigo}&body=Estimado cliente, adjunto los detalles de su venta.`)}
                      className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar por Email
                    </button>
                  )}
                  
                  {datos.cliente_telefono && (
                    <button
                      onClick={() => window.open(`https://wa.me/${datos.cliente_telefono.replace(/\D/g, '')}?text=Hola, te comparto los detalles de tu venta ${datos.codigo}`)}
                      className="w-full flex items-center justify-center px-4 py-3 border border-green-300 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors font-medium"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar por WhatsApp
                    </button>
                  )}
                  
                  <button
                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Enlace
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
              {tipoInfo.descripcion} • {formatearFechaCorta(datos.fecha_creacion)} • 
              {canalInfo.label}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2 inline" />
                Volver a la Lista
              </button>
              
              {puedeEditar && onEdit && (
                <button
                  onClick={() => onEdit(datos)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Edit className="h-4 w-4 mr-2 inline" />
                  Editar Venta
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Click outside menu para cerrar */}
        {showMoreActions && (
          <div
            className="fixed inset-0 z-5"
            onClick={() => setShowMoreActions(false)}
          />
        )}
      </div>
    </div>
  );
};

export default VentaDetailsView;