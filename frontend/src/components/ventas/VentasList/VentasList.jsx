// src/components/ventas/VentasList/VentasList.jsx - FILTRADO CLIENT-SIDE
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Eye, Edit, Trash2, MoreVertical, DollarSign, User,
  Calendar, Phone, Mail, Building, AlertCircle, CheckCircle,
  XCircle, ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw, 
  Download, Users, Package, Tag, Search, X, FileText, ArrowRight
} from 'lucide-react';
import ConfirmDialog from '../../common/ConfirmDialog';
import ventasService from '../../../services/ventasService';

// ⚡ COMPONENTES MEMOIZADOS FUERA DEL RENDER PRINCIPAL
const NotificationComponent = memo(({ notification }) => {
  if (!notification) return null;

  const iconos = {
    success: CheckCircle,
    error: XCircle,
    info: AlertCircle
  };

  const colores = {
    success: 'bg-green-100 border-green-200 text-green-800',
    error: 'bg-red-100 border-red-200 text-red-800',
    info: 'bg-blue-100 border-blue-200 text-blue-800'
  };

  const IconComponent = iconos[notification.tipo];

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-sm`}>
      <div className="flex items-center">
        <IconComponent className="h-5 w-5 mr-2" />
        <span className="text-sm font-medium whitespace-pre-line">{notification.mensaje}</span>
      </div>
    </div>
  );
});

// ⚡ MODAL DE CONFIRMACIÓN DE RECEPCIÓN MEMOIZADO
const ModalConfirmRecepcion = memo(({
  showConfirmRecepcion,
  ventaParaRecepcion,
  onConfirm,
  onCancel,
  obtenerNombreCompleto
}) => {
  if (!showConfirmRecepcion || !ventaParaRecepcion) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Confirmar Recepción del Producto
          </h3>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 h-10 w-10">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">
                  {obtenerNombreCompleto(ventaParaRecepcion)}
                </div>
                <div className="text-sm text-gray-500">
                  {ventaParaRecepcion.codigo || `V-${ventaParaRecepcion.id?.substring(0, 8)}`}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  ¿El cliente confirmó haber recibido el producto?
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Al confirmar, el sistema creará automáticamente un ticket de capacitación.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
          >
            Confirmar Recepción
          </button>
        </div>
      </div>
    </div>
  );
});

// ⚡ MODAL DE PRODUCTOS MEMOIZADO
const ProductosModal = memo(({
  modalProductos,
  onClose,
  obtenerNombreCompleto,
  formatearMonto
}) => {
  if (!modalProductos.isOpen) return null;

  const { venta, productos } = modalProductos;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Productos de la Venta
            </h3>
            <p className="text-sm text-gray-600">
              {venta?.codigo || `V-${venta?.id?.substring(0, 8)}`} - {obtenerNombreCompleto(venta)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {productos.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Cargando productos...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {productos.map((producto, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Código
                      </label>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {producto.producto_codigo || producto.producto_id || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descripción
                      </label>
                      <p className="text-sm text-gray-900 mt-1">
                        {producto.descripcion_personalizada || producto.producto_nombre || 'Sin descripción'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </label>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {producto.cantidad} {producto.unidad_medida || 'und'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subtotal
                      </label>
                      <p className="text-sm font-bold text-green-600 mt-1">
                        {formatearMonto(producto.total_linea || producto.subtotal)}
                      </p>
                    </div>
                  </div>
                  {producto.precio_unitario && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Precio unitario: {formatearMonto(producto.precio_unitario)}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Resumen */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4 border-t-2 border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Total: {productos.length} producto{productos.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      {productos.reduce((sum, p) => sum + parseFloat(p.cantidad || 0), 0)} unidades
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatearMonto(venta?.valor_final)}
                    </p>
                    <p className="text-sm text-gray-600">Valor final</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const VentasList = ({
  refreshTrigger = 0,
  onEdit,
  onView,
  onEditCliente,
  filtros = {},
  onFiltrosChange,
  usuarioActual
}) => {
  const [ventasCache, setVentasCache] = useState([]); // Todas las ventas cargadas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [ventaAEliminar, setVentaAEliminar] = useState(null);
  const [busquedaLocal, setBusquedaLocal] = useState(''); // Filtrado inmediato, sin debounce
  const [ordenamiento, setOrdenamiento] = useState({ campo: 'fecha_creacion', direccion: 'desc' });
  const [paginacion, setPaginacion] = useState({ pagina: 1, porPagina: 10 }); // Sin total, se calcula client-side
  const [notification, setNotification] = useState(null);
  const [showConfirmRecepcion, setShowConfirmRecepcion] = useState(false);
  const [ventaParaRecepcion, setVentaParaRecepcion] = useState(null);
  const [modalProductos, setModalProductos] = useState({ isOpen: false, venta: null, productos: [] });

  // 🔐 NUEVOS ESTADOS PARA CONTROL POR ROLES
  const [asesorSeleccionado, setAsesorSeleccionado] = useState(null);
  const [asesoresDisponibles, setAsesoresDisponibles] = useState([]);
  const [vistaActual, setVistaActual] = useState('mis_ventas'); // 'mis_ventas', 'equipo', 'todas_ventas', 'asesor_especifico'

  // ✅ CORREGIDO: Solo estados detallados (flujo logístico)
  const estadosDetallados = [
    { value: 'vendido', label: 'Vendido', descripcion: 'Venta registrada', icon: '📦', color: 'blue' },
    { value: 'vendido/enviado', label: 'Enviado', descripcion: 'Producto en tránsito', icon: '🚚', color: 'yellow' },
    { value: 'vendido/enviado/recibido', label: 'Recibido', descripcion: 'Cliente confirmó recepción', icon: '📫', color: 'orange' },
    { value: 'vendido/enviado/recibido/capacitado', label: 'Completado', descripcion: 'Cliente capacitado - Proceso completo', icon: '✅', color: 'green' },
    { value: 'anulado', label: 'Anulado', descripcion: 'Venta cancelada/devuelta', icon: '❌', color: 'red' },
    { value: 'cambio', label: 'Cambio', descripcion: 'Cliente solicitó cambio', icon: '🔄', color: 'purple' },
    { value: 'cambio/enviado', label: 'Cambio Enviado', descripcion: 'Producto de cambio enviado', icon: '🔄', color: 'purple' },
    { value: 'cambio/enviado/recibido', label: 'Cambio Recibido', descripcion: 'Cambio completado', icon: '🔄', color: 'purple' }
  ];

  // ✅ CORREGIDO: Solo tipos de venta (documentos)
  const tiposVenta = [
    { value: 'factura', label: 'Factura', color: 'purple' },
    { value: 'boleta', label: 'Boleta', color: 'blue' },
    { value: 'nota_venta', label: 'Nota de Venta', color: 'green' }
  ];

  // 🔐 FUNCIONES DE CONTROL POR ROLES
  const esRolAlto = useCallback(() => {
    if (!usuarioActual?.rol) return false;
    const rolesAltos = ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'SUPERVISOR'];
    // Manejar tanto rol como string o como objeto {id, nombre}
    const rolNombre = typeof usuarioActual.rol === 'string'
      ? usuarioActual.rol
      : usuarioActual.rol?.nombre || '';
    return rolesAltos.includes(rolNombre.toUpperCase());
  }, [usuarioActual]);

  const puedeVerTodasLasVentas = useCallback(() => {
    return esRolAlto() || usuarioActual?.es_jefe;
  }, [esRolAlto, usuarioActual]);

  const puedeVerVentasDeOtros = useCallback(() => {
    return puedeVerTodasLasVentas();
  }, [puedeVerTodasLasVentas]);

  // ✅ NUEVA FUNCIÓN HELPER: Obtener nombre completo del cliente
  const obtenerNombreCompleto = useCallback((venta) => {
    const nombre = venta.nombre_cliente || '';
    const apellido = venta.apellido_cliente || '';
    const nombreCompleto = `${nombre} ${apellido}`.trim();
    return nombreCompleto || 'Cliente no especificado';
  }, []);

  // Helper functions
  const obtenerEstadoDetallado = useCallback((estadoValue) => {
    return estadosDetallados.find(e => e.value === estadoValue) || estadosDetallados[0];
  }, []);

  const obtenerColorEstadoDetallado = useCallback((estadoValue) => {
    const info = obtenerEstadoDetallado(estadoValue);
    const colorMap = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      orange: 'bg-orange-50 border-orange-200 text-orange-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      red: 'bg-red-50 border-red-200 text-red-800',
      purple: 'bg-purple-50 border-purple-200 text-purple-800'
    };
    return colorMap[info.color] || colorMap.blue;
  }, [obtenerEstadoDetallado]);

  // ✅ CORREGIDO: Función para determinar tipo de venta
  const obtenerTipoVenta = useCallback((tipoValue) => {
    return tiposVenta.find(t => t.value === tipoValue) || tiposVenta[1]; // default: boleta
  }, []);

  // ✅ CORREGIDO: Función para obtener color según tipo_venta
  const obtenerColorTipo = useCallback((tipoValue) => {
    const info = obtenerTipoVenta(tipoValue);
    const colorMap = {
      purple: 'bg-purple-100 text-purple-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800'
    };
    return colorMap[info.color] || colorMap.blue;
  }, [obtenerTipoVenta]);

  // ✅ MEJORADO: Formateo de moneda más robusto
  const formatearMonto = useCallback((valor, moneda = 'USD') => {
    if (!valor || isNaN(valor)) {
      return moneda === 'PEN' ? 'S/ 0.00' : '$0.00';
    }

    const valorNumerico = parseFloat(valor);
    const simbolo = moneda === 'PEN' ? 'S/ ' : '$';

    return `${simbolo}${valorNumerico.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }, []);

  // FUNCIÓN PARA OBTENER PRODUCTOS DE UNA VENTA
  const cargarProductosVenta = useCallback(async (ventaId) => {
    try {
      const response = await ventasService.obtenerVentaPorId(ventaId);
      
      if (response.success && response.data?.data?.detalles) {
        return response.data.data.detalles;
      }
      
      return [];
    } catch (error) {
      console.error('Error cargando productos:', error);
      return [];
    }
  }, []);

  // FUNCIÓN PARA ABRIR MODAL DE PRODUCTOS
  const handleVerProductos = useCallback(async (venta) => {
    setModalProductos({ isOpen: true, venta, productos: [] });
    
    const productos = await cargarProductosVenta(venta.id);
    setModalProductos(prev => ({ ...prev, productos }));
  }, [cargarProductosVenta]);

  // Cargar TODAS las ventas una sola vez (con filtros de rol aplicados en backend)
  const cargarVentas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 🔐 APLICAR FILTROS POR ROL (solo estos se envían al backend)
      let filtrosCompletos = {
        ...filtros,
        limite: 10000 // Cargar todas las ventas permitidas según rol
      };

      // Aplicar filtros según el rol y la vista actual
      if (!puedeVerTodasLasVentas()) {
        // ASESOR: Solo ve sus propias ventas
        filtrosCompletos.asesor_id = usuarioActual?.id;
      } else {
        // JEFE+: Aplicar filtro según la vista seleccionada
        switch (vistaActual) {
          case 'mis_ventas':
            filtrosCompletos.asesor_id = usuarioActual?.id;
            break;
          case 'equipo':
            // Ver ventas del equipo (subordinados del jefe)
            filtrosCompletos.equipo = true;
            filtrosCompletos.jefe_id = usuarioActual?.id;
            break;
          case 'asesor_especifico':
            if (asesorSeleccionado) {
              filtrosCompletos.asesor_id = asesorSeleccionado;
            }
            break;
          case 'todas_ventas':
            // No agregar filtro de asesor - ver todas
            break;
          default:
            filtrosCompletos.asesor_id = usuarioActual?.id;
        }
      }

      const response = await ventasService.obtenerVentas(filtrosCompletos);

      if (response.success) {
        const ventasArray = response.data.ventas || [];
        setVentasCache(ventasArray); // Guardar todas las ventas en cache
      } else {
        setError(response.error);
      }

    } catch (err) {
      setError('Error cargando ventas');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    filtros, usuarioActual, vistaActual, asesorSeleccionado, puedeVerTodasLasVentas
  ]);

  // 🔐 FUNCIÓN PARA CARGAR ASESORES DISPONIBLES
  const cargarAsesores = useCallback(async () => {
    if (!puedeVerVentasDeOtros()) return;

    try {
      const response = await ventasService.obtenerAsesores();
      if (response.success) {
        setAsesoresDisponibles(response.data || []);
      }
    } catch (err) {
      console.error('Error cargando asesores:', err);
      setAsesoresDisponibles([]);
    }
  }, [puedeVerVentasDeOtros]);

  // Filtrar y ordenar ventas en memoria (client-side)
  const ventasFiltradas = useMemo(() => {
    let resultado = [...ventasCache];

    // Filtro de búsqueda
    if (busquedaLocal) {
      const termino = busquedaLocal.toLowerCase();
      resultado = resultado.filter(v =>
        v.nombre_cliente?.toLowerCase().includes(termino) ||
        v.apellido_cliente?.toLowerCase().includes(termino) ||
        v.cliente_email?.toLowerCase().includes(termino) ||
        v.cliente_telefono?.toLowerCase().includes(termino) ||
        v.codigo?.toLowerCase().includes(termino) ||
        `${v.nombre_cliente} ${v.apellido_cliente}`.toLowerCase().includes(termino)
      );
    }

    // Aplicar otros filtros si existen
    // (podrías agregar más filtros aquí si los necesitas)

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
  }, [ventasCache, busquedaLocal, ordenamiento]);

  // Paginación client-side
  const ventasPaginadas = useMemo(() => {
    const inicio = (paginacion.pagina - 1) * paginacion.porPagina;
    const fin = inicio + paginacion.porPagina;
    return ventasFiltradas.slice(inicio, fin);
  }, [ventasFiltradas, paginacion.pagina, paginacion.porPagina]);

  const totalPaginas = Math.ceil(ventasFiltradas.length / paginacion.porPagina);
  const totalResultados = ventasFiltradas.length;

  // Effects
  // Establecer vista por defecto según rol del usuario
  useEffect(() => {
    if (usuarioActual && vistaActual === 'mis_ventas') {
      // Si es jefe pero no es rol alto, mostrar equipo por defecto
      if (usuarioActual.es_jefe && !esRolAlto()) {
        setVistaActual('equipo');
      }
    }
  }, [usuarioActual, esRolAlto]);

  useEffect(() => {
    if (usuarioActual) {
      cargarAsesores();
    }
  }, [cargarAsesores, usuarioActual]);

  // Effect para cargar/recargar ventas cuando cambien los filtros de rol
  useEffect(() => {
    if (usuarioActual) {
      cargarVentas();
    }
  }, [cargarVentas, refreshTrigger, usuarioActual, vistaActual, asesorSeleccionado]);

  // Event handlers
  const handleBusqueda = useCallback((valor) => {
    setBusquedaLocal(valor);
    setPaginacion(prev => ({ ...prev, pagina: 1 })); // Reset a página 1
  }, []);

  const handleOrdenamiento = useCallback((campo) => {
    setOrdenamiento(prev => ({
      campo,
      direccion: prev.campo === campo && prev.direccion === 'asc' ? 'desc' : 'asc'
    }));
    setPaginacion(prev => ({ ...prev, pagina: 1 }));
  }, []);

  // 🔐 HANDLERS PARA CONTROL POR ROLES
  const handleCambioVista = useCallback((e) => {
    const nuevaVista = e.target.value;
    setVistaActual(nuevaVista);
    setPaginacion(prev => ({ ...prev, pagina: 1 }));

    if (nuevaVista !== 'asesor_especifico') {
      setAsesorSeleccionado(null);
    }
  }, []);

  const handleCambioAsesor = useCallback((e) => {
    const asesorId = e.target.value;
    setAsesorSeleccionado(asesorId || null);
    setPaginacion(prev => ({ ...prev, pagina: 1 }));
  }, []);

  const handleEliminar = useCallback(async () => {
    if (!ventaAEliminar) return;

    try {
      const response = await ventasService.eliminarVenta(ventaAEliminar.id);
      
      if (response.success) {
        showNotification('Venta eliminada exitosamente', 'success');
        cargarVentas();
      } else {
        showNotification(response.error, 'error');
      }
    } catch (err) {
      showNotification('Error eliminando venta', 'error');
    } finally {
      setShowConfirmDelete(false);
      setVentaAEliminar(null);
    }
  }, [ventaAEliminar, cargarVentas]);

  // ✅ CORREGIDO: Cambiar solo estado_detallado
  const handleCambiarEstadoDetallado = useCallback(async (venta, nuevoEstadoDetallado) => {
    try {
      const response = await ventasService.cambiarEstadoVenta(venta.id, { 
        nuevo_estado_detallado: nuevoEstadoDetallado 
      });
      
      if (response.success) {
        const estadoInfo = obtenerEstadoDetallado(nuevoEstadoDetallado);
        let mensaje = `Estado cambiado a "${estadoInfo.label}" exitosamente`;
        
        if (nuevoEstadoDetallado === 'vendido/enviado/recibido' && response.data?.ticket_capacitacion) {
          const ticket = response.data.ticket_capacitacion;
          mensaje = `Estado cambiado a "${estadoInfo.label}" exitosamente\nTicket de capacitación ${ticket.codigo} creado automáticamente`;
        }
        
        showNotification(mensaje, 'success');
        cargarVentas();
      } else {
        showNotification(response.error, 'error');
      }
    } catch (err) {
      showNotification('Error cambiando estado', 'error');
    }
    setMenuAbierto(null);
  }, [cargarVentas, obtenerEstadoDetallado]);

  // NUEVA FUNCIÓN: Confirmar recepción con modal específico
  const handleConfirmarRecepcion = useCallback(async () => {
    if (!ventaParaRecepcion) return;

    try {
      const response = await ventasService.cambiarEstadoVenta(ventaParaRecepcion.id, { 
        nuevo_estado_detallado: 'vendido/enviado/recibido' 
      });
      
      if (response.success) {
        let mensaje = `Estado cambiado a "Recibido" exitosamente`;
        
        if (response.data?.ticket_capacitacion) {
          const ticket = response.data.ticket_capacitacion;
          mensaje = `Estado cambiado a "Recibido" exitosamente\nTicket de capacitación ${ticket.codigo} creado automáticamente`;
        }
        
        showNotification(mensaje, 'success');
        cargarVentas();
      } else {
        showNotification(response.error, 'error');
      }
    } catch (err) {
      showNotification('Error cambiando estado', 'error');
    } finally {
      setShowConfirmRecepcion(false);
      setVentaParaRecepcion(null);
    }
  }, [ventaParaRecepcion, cargarVentas]);

  // NUEVA FUNCIÓN: Determinar si debe mostrar botón de recepción
  const debeConfirmarRecepcion = useCallback((venta) => {
    return venta.estado_detallado === 'vendido/enviado';
  }, []);

  // ✅ IMPLEMENTACIÓN DE EXPORTACIÓN FUNCIONAL
  const handleExportar = useCallback(async () => {
    try {
      setLoading(true);
      showNotification('Generando archivo de exportación...', 'info');

      // Construir filtros actuales para exportación
      let filtrosExportacion = {
        ...filtros,
        busqueda: busquedaLocal,
        orden: `${ordenamiento.campo}_${ordenamiento.direccion}`,
        formato: 'excel' // Podría ser 'csv', 'pdf', etc.
      };

      // Aplicar mismos filtros por rol que usa cargarVentas
      if (!puedeVerTodasLasVentas()) {
        filtrosExportacion.asesor_id = usuarioActual?.id;
      } else {
        switch (vistaActual) {
          case 'mis_ventas':
            filtrosExportacion.asesor_id = usuarioActual?.id;
            break;
          case 'equipo':
            filtrosExportacion.equipo = true;
            filtrosExportacion.jefe_id = usuarioActual?.id;
            break;
          case 'asesor_especifico':
            if (asesorSeleccionado) {
              filtrosExportacion.asesor_id = asesorSeleccionado.id;
            }
            break;
          case 'todas_ventas':
            // No filtrar por asesor
            break;
        }
      }

      const response = await ventasService.exportarVentas(filtrosExportacion);

      if (response.success) {
        // Crear link de descarga
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ventas_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        showNotification('Archivo descargado exitosamente', 'success');
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Error exportando:', err);
      showNotification('Error al exportar datos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [
    filtros, busquedaLocal, ordenamiento, usuarioActual, vistaActual,
    asesorSeleccionado, puedeVerTodasLasVentas
  ]);

  // ✅ CORREGIDO: Sistema de notificaciones con dependencies correctas
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);


  // ✅ FUNCIÓN PARA OBTENER PRÓXIMOS ESTADOS VÁLIDOS
  const obtenerEstadosSiguientes = useCallback((estadoActual) => {
    const transiciones = {
      'vendido': ['vendido/enviado', 'anulado'],
      'vendido/enviado': ['vendido/enviado/recibido', 'cambio'],
      'vendido/enviado/recibido': ['vendido/enviado/recibido/capacitado', 'cambio'],
      'vendido/enviado/recibido/capacitado': [], // Estado final
      'cambio': ['cambio/enviado', 'anulado'],
      'cambio/enviado': ['cambio/enviado/recibido'],
      'cambio/enviado/recibido': [], // Estado final
      'anulado': [] // Estado final
    };
    
    return transiciones[estadoActual] || [];
  }, []);



  if (loading && ventasCache.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error cargando ventas</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarVentas}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow relative z-50">
      {/* Header con búsqueda y selector de vistas */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lista de Ventas</h2>
            <p className="text-sm text-gray-600">
              {totalResultados} venta{totalResultados !== 1 ? 's' : ''} encontrada{totalResultados !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* 🔐 SELECTOR DE VISTA POR ROL - Para roles altos y jefes */}
            {usuarioActual && puedeVerTodasLasVentas() && (
              <div className="flex items-center space-x-3">
                {/* Selector de tipo de vista */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Vista:</label>
                  <select
                    value={vistaActual}
                    onChange={handleCambioVista}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mis_ventas">Mis Ventas</option>
                    {usuarioActual?.es_jefe && <option value="equipo">Ventas del Equipo</option>}
                    {esRolAlto() && <option value="todas_ventas">Todas las Ventas</option>}
                    <option value="asesor_especifico">Por Asesor</option>
                  </select>
                </div>

                {/* Selector de asesor específico */}
                {vistaActual === 'asesor_especifico' && (
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Asesor:</label>
                    <select
                      value={asesorSeleccionado || ''}
                      onChange={handleCambioAsesor}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar asesor...</option>
                      {asesoresDisponibles.map((asesor) => (
                        <option key={asesor.id} value={asesor.id}>
                          {asesor.nombre} {asesor.apellido}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleExportar}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, email, teléfono o código..."
            value={busquedaLocal}
            onChange={(e) => handleBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabla de ventas */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleOrdenamiento('nombre_cliente')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  Cliente
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Productos
              </th>
              <th
                onClick={() => handleOrdenamiento('valor_final')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  Valor
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleOrdenamiento('tipo_venta')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  Tipo Documento
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleOrdenamiento('estado_detallado')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  Estado
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleOrdenamiento('fecha_creacion')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  Fecha
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Asesor
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ventasPaginadas.map((venta) => (
              <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                {/* ✅ CORREGIDO: CLIENTE - Usar nombre_cliente + apellido_cliente */}
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {obtenerNombreCompleto(venta)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {venta.codigo || `V-${venta.id?.substring(0, 8)}`}
                      </div>
                      {venta.cliente_empresa && (
                        <div className="text-xs text-gray-400 flex items-center mt-1">
                          <Building className="h-3 w-3 mr-1" />
                          {venta.cliente_empresa}
                        </div>
                      )}
                      <div className="flex items-center mt-1 space-x-3">
                        {venta.cliente_email && (
                          <div className="text-xs text-gray-500 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            <span className="truncate max-w-32">{venta.cliente_email}</span>
                          </div>
                        )}
                        {venta.cliente_telefono && (
                          <div className="text-xs text-gray-500 flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {venta.cliente_telefono}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* PRODUCTOS */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div 
                    className="flex items-center cursor-pointer hover:bg-blue-50 rounded-md p-2 transition-colors"
                    onClick={() => handleVerProductos(venta)}
                    title="Click para ver detalles de productos"
                  >
                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {venta.total_items || 0} unidades
                      </div>
                      <div className="text-xs text-gray-500">
                        {venta.total_productos || 0} producto{(venta.total_productos || 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </td>

                {/* VALOR */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        {formatearMonto(venta.valor_final)}
                      </span>
                      {venta.descuento_monto && venta.descuento_monto > 0 && (
                        <div className="text-xs text-green-600">
                          Desc: {formatearMonto(venta.descuento_monto)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* ✅ TIPO DOCUMENTO */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const tipoInfo = obtenerTipoVenta(venta.tipo_venta || 'boleta');
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${obtenerColorTipo(venta.tipo_venta)}`}>
                        <Tag className="h-3 w-3 mr-1" />
                        {tipoInfo.label}
                      </span>
                    );
                  })()}
                </td>

                {/* ✅ ESTADO DETALLADO */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const estadoInfo = obtenerEstadoDetallado(venta.estado_detallado || 'vendido');
                    return (
                      <div className={`inline-flex items-center px-3 py-1 rounded-lg border text-xs font-medium ${obtenerColorEstadoDetallado(venta.estado_detallado || 'vendido')}`}>
                        <span className="mr-2">{estadoInfo.icon}</span>
                        <span>{estadoInfo.label}</span>
                      </div>
                    );
                  })()}
                  <div className="text-xs text-gray-500 mt-1">
                    {obtenerEstadoDetallado(venta.estado_detallado || 'vendido').descripcion}
                  </div>
                </td>

                {/* FECHA */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    <div>
                      <div className="font-medium">
                        {new Date(venta.fecha_creacion).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit'
                        })}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(venta.fecha_creacion).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {venta.fecha_entrega_estimada && (
                        <div className="text-xs text-blue-600 mt-1">
                          Entrega: {new Date(venta.fecha_entrega_estimada).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* ASESOR */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">
                        {venta.asesor_nombre_completo || 'Sin asignar'}
                      </div>
                      {venta.asesor_email && (
                        <div className="text-xs text-gray-500">{venta.asesor_email}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* ACCIONES */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {/* BOTÓN PROMINENTE: Confirmar Recepción */}
                    {debeConfirmarRecepcion(venta) && (
                      <button
                        onClick={() => {
                          setVentaParaRecepcion(venta);
                          setShowConfirmRecepcion(true);
                        }}
                        className="inline-flex items-center px-3 py-1 border border-green-300 text-xs font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                        title="Cliente confirmó recepción del producto"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confirmar Recepción
                      </button>
                    )}

                    <div className="relative">
                      <button
                        onClick={() => setMenuAbierto(menuAbierto === venta.id ? null : venta.id)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>

                      {menuAbierto === venta.id && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl ring-1 ring-black ring-opacity-5 z-[9999] pointer-events-auto">
                          <div className="py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onView && onView(venta);
                                setMenuAbierto(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left cursor-pointer transition-colors"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalles
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit && onEdit(venta);
                                setMenuAbierto(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left cursor-pointer transition-colors"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar venta
                            </button>

                            <div className="border-t border-gray-100 my-1"></div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setVentaAEliminar(venta);
                                setShowConfirmDelete(true);
                                setMenuAbierto(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ventasPaginadas.length === 0 && !loading && (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay ventas</h3>
          <p className="text-gray-600">
            {ventasCache.length === 0
              ? 'No hay ventas registradas.'
              : 'No se encontraron ventas con los filtros aplicados.'}
          </p>
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((paginacion.pagina - 1) * paginacion.porPagina) + 1} a {Math.min(paginacion.pagina * paginacion.porPagina, totalResultados)} de {totalResultados} ventas
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPaginacion(prev => ({ ...prev, pagina: prev.pagina - 1 }))}
                disabled={paginacion.pagina === 1}
                className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-md">
                {paginacion.pagina} de {totalPaginas}
              </span>
              
              <button
                onClick={() => setPaginacion(prev => ({ ...prev, pagina: prev.pagina + 1 }))}
                disabled={paginacion.pagina === totalPaginas}
                className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODALES OPTIMIZADOS */}
      <ModalConfirmRecepcion
        showConfirmRecepcion={showConfirmRecepcion}
        ventaParaRecepcion={ventaParaRecepcion}
        onConfirm={handleConfirmarRecepcion}
        onCancel={() => {
          setShowConfirmRecepcion(false);
          setVentaParaRecepcion(null);
        }}
        obtenerNombreCompleto={obtenerNombreCompleto}
      />

      <ProductosModal
        modalProductos={modalProductos}
        onClose={() => setModalProductos({ isOpen: false, venta: null, productos: [] })}
        obtenerNombreCompleto={obtenerNombreCompleto}
        formatearMonto={formatearMonto}
      />

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={handleEliminar}
        title="Eliminar Venta"
        message={`¿Estás seguro de que deseas eliminar la venta ${ventaAEliminar?.codigo || ventaAEliminar?.id}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      {/* Notificaciones */}
      <NotificationComponent notification={notification} />

      {/* ✅ CORREGIDO: Click outside para cerrar menús - sin bloquear clicks en el menú */}
      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 pointer-events-auto"
          onClick={() => setMenuAbierto(null)}
        />
      )}
    </div>
  );
};

export default VentasList;