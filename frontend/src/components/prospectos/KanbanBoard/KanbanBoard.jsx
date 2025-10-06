// src/components/prospectos/KanbanBoard/KanbanBoard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Mail, Building, Calendar, DollarSign, User, 
  MoreVertical, CheckCircle, XCircle, Clock, AlertCircle,
  ExternalLink, Edit, Trash2, Filter, Package, ArrowRight
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import VentaForm from '../../ventas/VentaForm/VentaForm'; // AGREGADO: Import del VentaForm

const KanbanBoard = ({ 
  asesorId = null, 
  onProspectoSelect, 
  refreshTrigger = 0,
  filtros = {},
  onFiltrosChange
}) => {
  const [kanbanData, setKanbanData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const menuRef = useRef(null);
  const loadingRef = useRef(false);

  // Estados para modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStateChange, setPendingStateChange] = useState(null);

  // AGREGADO: Estados para VentaForm
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [prospectoParaConversion, setProspectoParaConversion] = useState(null);

  // Configuración de estados con colores y metadatos
  const estadosConfig = {
    'Prospecto': {
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      textColor: 'text-blue-700',
      icon: User
    },
    'Cotizado': {
      color: 'bg-yellow-50 border-yellow-200',
      headerColor: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      icon: Mail
    },
    'Negociacion': {
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      textColor: 'text-orange-700',
      icon: Clock
    },
    'Cerrado': {
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      textColor: 'text-green-700',
      icon: CheckCircle
    },
    'Perdido': {
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      textColor: 'text-red-700',
      icon: XCircle
    }
  };

  // Función para cargar datos con manejo robusto de errores
  const cargarDatosKanban = async () => {
    if (loadingRef.current) {
      console.log('KanbanBoard: Carga ya en progreso, omitiendo...');
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      
      console.log('KanbanBoard: Iniciando carga con filtros:', filtros);
      
      const filtrosLimpios = {};
      
      if (filtros && typeof filtros === 'object') {
        Object.entries(filtros).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '' && value !== 0) {
            if (Array.isArray(value)) {
              if (value.length > 0) {
                filtrosLimpios[key] = value;
              }
            } else {
              filtrosLimpios[key] = value;
            }
          }
        });
      }

      if (asesorId) {
        filtrosLimpios.asesor_id = asesorId;
      }
      
      console.log('KanbanBoard: Filtros procesados:', filtrosLimpios);
      
      const response = await prospectosService.obtenerTodos(filtrosLimpios);
      console.log('KanbanBoard: Respuesta del servicio:', response);
      
      if (!response || !response.data) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      // Organizar datos por estado para el Kanban
      const datosOrganizados = {};
      Object.keys(estadosConfig).forEach(estado => {
        datosOrganizados[estado] = [];
      });
      
      if (Array.isArray(response.data)) {
        response.data.forEach(prospecto => {
          if (prospecto && prospecto.estado && datosOrganizados[prospecto.estado]) {
            datosOrganizados[prospecto.estado].push(prospecto);
          }
        });
      }
      
      console.log('KanbanBoard: Datos organizados:', datosOrganizados);
      setKanbanData(datosOrganizados);
      
    } catch (err) {
      console.error('KanbanBoard: Error cargando datos:', err);
      setError(err.message || 'Error cargando datos del Kanban');
      
      const datosVacios = {};
      Object.keys(estadosConfig).forEach(estado => {
        datosVacios[estado] = [];
      });
      setKanbanData(datosVacios);
      
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Effect principal
  useEffect(() => {
    console.log('KanbanBoard: useEffect disparado por:', { asesorId, refreshTrigger, filtros });
    const timeoutId = setTimeout(() => {
      cargarDatosKanban();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [asesorId, refreshTrigger, JSON.stringify(filtros)]);

  // Efecto para cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAbierto(null);
      }
    };

    if (menuAbierto) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuAbierto]);

  const handleDragStart = (e, prospecto) => {
    setDraggedItem(prospecto);
    e.dataTransfer.effectAllowed = 'move';
    setMenuAbierto(null);
  };

  const handleDragOver = (e, columna) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columna);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // FUNCIÓN MODIFICADA PARA AGREGAR CONFIRMACIÓN
  const handleDrop = async (e, nuevoEstado) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedItem || draggedItem.estado === nuevoEstado) {
      setDraggedItem(null);
      return;
    }

    // VERIFICAR SI NECESITA CONFIRMACIÓN
    const necesitaConfirmacion = (
      nuevoEstado === 'Cerrado' || 
      nuevoEstado === 'Perdido' ||
      (draggedItem.estado === 'Cerrado' && nuevoEstado !== 'Cerrado')
    );

    if (necesitaConfirmacion) {
      // Mostrar modal de confirmación
      setPendingStateChange({
        prospecto: draggedItem,
        estadoAnterior: draggedItem.estado,
        estadoNuevo: nuevoEstado
      });
      setShowConfirmModal(true);
      setDraggedItem(null);
      return;
    }

    // Cambio directo sin confirmación
    await ejecutarCambioEstado(draggedItem, nuevoEstado);
    setDraggedItem(null);
  };

  // FUNCIÓN PARA EJECUTAR CAMBIO DE ESTADO
  const ejecutarCambioEstado = async (prospecto, nuevoEstado, observacion = '') => {
    try {
      const razonCambio = observacion || `Movido desde ${prospecto.estado} a ${nuevoEstado} vía Kanban Board`;
      
      await prospectosService.cambiarEstado(
        prospecto.id, 
        nuevoEstado,
        razonCambio
      );
      
      // Actualizar estado local inmediatamente
      setKanbanData(prev => {
        const newData = { ...prev };
        
        // Remover del estado anterior
        if (newData[prospecto.estado]) {
          newData[prospecto.estado] = newData[prospecto.estado].filter(
            item => item.id !== prospecto.id
          );
        }
        
        // Agregar al nuevo estado
        const prospectoActualizado = { ...prospecto, estado: nuevoEstado };
        if (newData[nuevoEstado]) {
          newData[nuevoEstado] = [...newData[nuevoEstado], prospectoActualizado];
        }
        
        return newData;
      });

      // Recargar después de un delay
      setTimeout(() => {
        if (!loadingRef.current) {
          cargarDatosKanban();
        }
      }, 300);
      
    } catch (err) {
      console.error('Error moviendo prospecto:', err);
      alert(`Error al mover prospecto: ${err.message}`);
      cargarDatosKanban();
    }
  };

  // MODIFICADO: Función confirmarCambioEstado con integración VentaForm
  const confirmarCambioEstado = async (actualizarCotizacion = false, observacion = '') => {
    if (!pendingStateChange) return;

    const { prospecto, estadoNuevo } = pendingStateChange;
    
    try {
      // NUEVA LÓGICA: Si es cerrado y se confirma actualizar cotización - ABRIR VENTAFORM
      if (estadoNuevo === 'Cerrado' && actualizarCotizacion) {
        console.log('🎯 Abriendo VentaForm para conversión:', prospecto);
        
        // Cerrar modal de confirmación
        setShowConfirmModal(false);
        setPendingStateChange(null);
        
        // Preparar datos del prospecto para VentaForm  
        setProspectoParaConversion(prospecto);
        setShowVentaForm(true);
        
        return; // No ejecutar cambio de estado aún
      }

      // Cambio normal sin conversión
      let razonFinal = observacion;
      if (estadoNuevo === 'Cerrado' && !actualizarCotizacion) {
        razonFinal += ' - Cerrado sin conversión a venta';
      }

      await ejecutarCambioEstado(prospecto, estadoNuevo, razonFinal);
      
    } catch (err) {
      console.error('Error en confirmación:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setShowConfirmModal(false);
      setPendingStateChange(null);
    }
  };

  const cancelarCambioEstado = () => {
    setShowConfirmModal(false);
    setPendingStateChange(null);
  };

  // AGREGADO: Nuevas funciones para manejar VentaForm
  const handleVentaCreatedFromConversion = async (ventaCreada) => {
    console.log('✅ Venta creada desde conversión:', ventaCreada);
    
    try {
      // Cerrar formulario de venta
      setShowVentaForm(false);
      setProspectoParaConversion(null);
      
      // Ahora sí cambiar estado del prospecto a Cerrado
      if (prospectoParaConversion) {
        await ejecutarCambioEstado(
          prospectoParaConversion, 
          'Cerrado', 
          `Convertido exitosamente a venta ${ventaCreada.codigo || ventaCreada.id}`
        );
      }
      
      // Mostrar notificación de éxito
      alert(`🎉 Prospecto convertido exitosamente a venta ${ventaCreada.codigo || '#' + ventaCreada.id}`);
      
    } catch (error) {
      console.error('Error post-conversión:', error);
      alert('Venta creada pero error actualizando prospecto: ' + error.message);
    }
  };

  const handleVentaFormClose = () => {
    setShowVentaForm(false);
    setProspectoParaConversion(null);
    // El prospecto mantiene su estado original
  };

  const prepararDatosIniciales = (prospecto) => {
  if (!prospecto) return {};
  
  // DEBUG: Agregar estos console.log temporales
  console.log('🔍 PROSPECTO COMPLETO:', prospecto);
  console.log('🔍 PRODUCTOS_INTERES RAW:', prospecto.productos_interes);
  console.log('🔍 TIPO DE productos_interes:', typeof prospecto.productos_interes);
  console.log('🔍 ES ARRAY:', Array.isArray(prospecto.productos_interes));
  
  // Procesar productos de interés del prospecto
  const procesarProductosInteres = (productos_interes) => {
    console.log('🔍 PROCESANDO ENTRADA:', productos_interes);
    if (!productos_interes || !Array.isArray(productos_interes)) {
      console.log('🔍 NO ES ARRAY VÁLIDO, retornando []');
      return [];
    }
    
    const resultado = productos_interes.map((producto, index) => {
      console.log(`🔍 PROCESANDO PRODUCTO ${index}:`, producto, typeof producto);
      
      // Si es string JSON, parsearlo
      if (typeof producto === 'string') {
        try {
          const parsed = JSON.parse(producto);
          console.log(`🔍 PRODUCTO ${index} PARSEADO:`, parsed);
          
          // Si es un objeto completo del catálogo
          if (parsed.producto_id && parsed.codigo) {
            const resultado = {
              id: `converted_${Date.now()}_${index}`,
              producto_id: parsed.producto_id,
              codigo: parsed.codigo,
              nombre: parsed.nombre,
              cantidad: parsed.cantidad_estimada || 1,
              precio_unitario: parsed.precio_base || 0,
              subtotal: parsed.valor_linea || 0,
              total_linea: parsed.valor_linea || 0,
              descuento_porcentaje: 0,
              descuento_monto: 0,
              descripcion_personalizada: '',
              notas: 'Convertido desde prospecto',
              orden_linea: index + 1
            };
            console.log(`🔍 PRODUCTO ${index} CONVERTIDO (CATÁLOGO):`, resultado);
            return resultado;
          }
        } catch (e) {
          console.log(`🔍 ERROR PARSEANDO PRODUCTO ${index}:`, e.message);
        }
        
        // Si es string simple (como "Máquina cortadora")
        const resultado = {
          id: `text_${Date.now()}_${index}`,
          producto_id: null,
          codigo: '',
          nombre: producto,
          cantidad: 1,
          precio_unitario: 0,
          subtotal: 0,
          total_linea: 0,
          descuento_porcentaje: 0,
          descuento_monto: 0,
          descripcion_personalizada: producto,
          notas: 'Producto de interés del prospecto',
          orden_linea: index + 1
        };
        console.log(`🔍 PRODUCTO ${index} CONVERTIDO (TEXTO):`, resultado);
        return resultado;
      }
      
      // Si ya es un objeto
      const resultado = {
        id: `obj_${Date.now()}_${index}`,
        ...producto,
        orden_linea: index + 1
      };
      console.log(`🔍 PRODUCTO ${index} CONVERTIDO (OBJETO):`, resultado);
      return resultado;
    });
    
    console.log('🔍 PRODUCTOS PROCESADOS FINAL:', resultado);
    return resultado;
  };
  
  const datosPreparados = {
    // Datos del cliente desde prospecto
    prospecto_id: prospecto.id,
    nombre_cliente: prospecto.nombre_cliente || '',
    apellido_cliente: prospecto.apellido_cliente || '',
    cliente_empresa: prospecto.empresa || '',
    cliente_email: prospecto.email || '',
    cliente_telefono: prospecto.telefono || '',
    ciudad: prospecto.ciudad || '',
    departamento: prospecto.departamento || '',
    distrito: prospecto.distrito || '',
    canal_contacto: prospecto.canal_contacto || 'WhatsApp',
    
    // Valores desde prospecto
    valor_total: prospecto.valor_estimado || prospecto.presupuesto_estimado || '',
    valor_final: prospecto.valor_estimado || prospecto.presupuesto_estimado || '',
    
    // Configuración para conversión
    canal_origen: 'pipeline-convertido',
    fecha_venta: new Date().toISOString().split('T')[0],
    
    // CORREGIDO: productos procesados (no productosInteres)
    productos: procesarProductosInteres(prospecto.productos_interes)
  };
  
  console.log('🔍 DATOS FINALES PREPARADOS:', datosPreparados);
  console.log('🔍 PRODUCTOS EN DATOS FINALES:', datosPreparados.productos);
  return datosPreparados;
};

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';
    try {
      return new Date(fecha).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };
  const calcularValorReal = (prospecto) => {
  if (prospecto.productos_interes && Array.isArray(prospecto.productos_interes)) {
    let totalCalculado = 0;
    
    prospecto.productos_interes.forEach(producto => {
      if (typeof producto === 'string' && producto.startsWith('{')) {
        try {
          const productoObj = JSON.parse(producto);
          totalCalculado += productoObj.valor_linea || 0;
        } catch (e) {
          // Si no se puede parsear, ignorar
        }
      }
    });
    
    return totalCalculado > 0 ? totalCalculado : prospecto.valor_estimado;
  }
  
      return prospecto.valor_estimado || prospecto.presupuesto_estimado;
    };
  const formatearValor = (valor) => {
    if (!valor) return 'Sin valor';
    try {
      return `$${valor.toLocaleString()}`;
    } catch {
      return 'Sin valor';
    }
  };

  const handleMenuAction = async (accion, prospecto) => {
    try {
      switch (accion) {
        case 'editar':
          if (onProspectoSelect) {
            onProspectoSelect(prospecto);
          }
          break;
        case 'copiarTelefono':
          if (navigator.clipboard && prospecto.telefono) {
            await navigator.clipboard.writeText(prospecto.telefono);
            alert('Teléfono copiado al portapapeles');
          }
          break;
        case 'enviarEmail':
          if (prospecto.email) {
            window.open(`mailto:${prospecto.email}`);
          }
          break;
        case 'whatsapp':
          if (prospecto.telefono) {
            const numeroLimpio = prospecto.telefono.replace(/\D/g, '');
            window.open(`https://wa.me/${numeroLimpio}`);
          }
          break;
      }
    } catch (err) {
      console.error('Error en acción de menú:', err);
      alert('Error al ejecutar la acción');
    }
    setMenuAbierto(null);
  };

  // COMPONENTE DE MODAL DE CONFIRMACIÓN
  const ConfirmationModal = () => {
    const [observacion, setObservacion] = useState('');
    const [actualizarCotizacion, setActualizarCotizacion] = useState(true);

    if (!showConfirmModal || !pendingStateChange) return null;

    const { prospecto, estadoAnterior, estadoNuevo } = pendingStateChange;
    
    const getMensajeConfirmacion = () => {
      switch (estadoNuevo) {
        case 'Cerrado':
          return {
            title: '🎉 Confirmar Cierre de Prospecto',
            message: `¿Confirmas que el prospecto "${prospecto.nombre_cliente}" ha sido cerrado exitosamente?`,
            showCotizacionOption: true,
            confirmButtonText: 'Confirmar Cierre',
            confirmButtonColor: 'bg-green-600 hover:bg-green-700',
            icon: '🎯'
          };
        case 'Perdido':
          return {
            title: '❌ Confirmar Prospecto Perdido',
            message: `¿Confirmas que el prospecto "${prospecto.nombre_cliente}" se ha perdido?`,
            showCotizacionOption: false,
            confirmButtonText: 'Confirmar Pérdida',
            confirmButtonColor: 'bg-red-600 hover:bg-red-700',
            icon: '💔'
          };
        default:
          if (estadoAnterior === 'Cerrado') {
            return {
              title: '⚠️ Reabrir Prospecto Cerrado',
              message: `¿Estás seguro de reabrir el prospecto "${prospecto.nombre_cliente}" que estaba cerrado?`,
              showCotizacionOption: false,
              confirmButtonText: 'Reabrir Prospecto',
              confirmButtonColor: 'bg-yellow-600 hover:bg-yellow-700',
              icon: '🔄'
            };
          }
          return {
            title: '🔄 Confirmar Cambio de Estado',
            message: `¿Confirmas mover "${prospecto.nombre_cliente}" de ${estadoAnterior} a ${estadoNuevo}?`,
            showCotizacionOption: false,
            confirmButtonText: 'Confirmar Cambio',
            confirmButtonColor: 'bg-blue-600 hover:bg-blue-700',
            icon: '📋'
          };
      }
    };

    const modalConfig = getMensajeConfirmacion();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{modalConfig.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {modalConfig.title}
              </h3>
              <p className="text-gray-600">
                {modalConfig.message}
              </p>
            </div>

            {/* Información del prospecto */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center mb-3">
                <User className="h-5 w-5 text-blue-500 mr-2" />
                <div>
                  <div className="font-semibold text-gray-900">{prospecto.nombre_cliente}</div>
                  <div className="text-sm text-gray-600">{prospecto.empresa}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <Phone className="h-4 w-4 mr-1" />
                  {prospecto.telefono}
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatearFecha(prospecto.fecha_contacto)}
                </div>
                {prospecto.valor_estimado && (
                  <div className="flex items-center text-green-600 font-semibold col-span-2">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Valor estimado: {formatearValor(prospecto.valor_estimado)}
                  </div>
                )}
              </div>

              {/* Productos de interés */}
              {prospecto.productos_interes && Array.isArray(prospecto.productos_interes) && prospecto.productos_interes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center mb-2">
                    <Package className="h-4 w-4 text-gray-500 mr-1" />
                    <span className="text-xs font-medium text-gray-700">Productos de interés:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {prospecto.productos_interes.slice(0, 3).map((producto, index) => {
                      let nombreProducto = producto;
                      
                      if (typeof producto === 'string' && producto.startsWith('{')) {
                        try {
                          const productoObj = JSON.parse(producto);
                          nombreProducto = productoObj.nombre || productoObj.codigo || 'Producto sin nombre';
                        } catch (e) {
                          nombreProducto = producto;
                        }
                      }
                      
                      return (
                        <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {nombreProducto.length > 20 ? `${nombreProducto.substring(0, 20)}...` : nombreProducto}
                        </span>
                      );
                    })}
                    {prospecto.productos_interes.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{prospecto.productos_interes.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Opción de actualizar cotización */}
            {modalConfig.showCotizacionOption && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-blue-800">
                    Revisión obligatoria antes de convertir a venta
                  </span>
                  <p className="text-xs text-blue-600 mt-1">
                    Por políticas de calidad, se requiere validar productos y precios antes de crear la venta
                  </p>
                </div>
              </label>
            </div>
          )}

            {/* Campo de observación */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observación (opcional):
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Agrega una nota sobre este cambio de estado..."
              />
            </div>

            {/* Indicador de cambio */}
            <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center text-sm">
                <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium">{estadoAnterior}</span>
                <ArrowRight className="h-4 w-4 mx-3 text-blue-500" />
                <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-medium">{estadoNuevo}</span>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelarCambioEstado}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmarCambioEstado(actualizarCotizacion, observacion)}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${modalConfig.confirmButtonColor}`}
              >
                {modalConfig.confirmButtonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ProspectoCard = ({ prospecto }) => {
    if (!prospecto) return null;
    
    // No mostrar seguimientos en prospectos cerrados o perdidos
    const tieneUrgencia = (prospecto.estado !== 'Cerrado' && prospecto.estado !== 'Perdido') &&
                          (prospecto.seguimiento_vencido || prospecto.seguimiento_obligatorio);
    const isMenuOpen = menuAbierto === prospecto.id;
    
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, prospecto)}
        className={`bg-white p-4 rounded-lg shadow hover:shadow-md cursor-move transition-all duration-200 border-l-4 ${
          tieneUrgencia ? 'border-l-red-400 bg-red-50' : 'border-l-gray-300'
        } ${draggedItem?.id === prospecto.id ? 'opacity-50 transform rotate-2' : ''}`}
      >
        {/* Header con nombre y código */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">
              {prospecto.nombre_cliente || 'Sin nombre'} {prospecto.apellido_cliente || ''}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gray-500 truncate">{prospecto.codigo || 'Sin código'}</p>
              {/* Badge del asesor (solo en vista global) */}
              {(prospecto.asesor_nombre || prospecto.nombre) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                  <User className="h-3 w-3 mr-1" />
                  {prospecto.asesor_nombre || prospecto.nombre} {prospecto.asesor_apellido || prospecto.apellido || ''}
                </span>
              )}
            </div>
          </div>
          
          {/* Botón de menú con desplegable */}
          <div className="relative" ref={isMenuOpen ? menuRef : null}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuAbierto(isMenuOpen ? null : prospecto.id);
              }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
                <div className="py-1">
                  <button
                    onClick={() => handleMenuAction('editar', prospecto)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleMenuAction('copiarTelefono', prospecto)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Copiar teléfono
                  </button>
                  <button
                    onClick={() => handleMenuAction('enviarEmail', prospecto)}
                    disabled={!prospecto.email}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar email
                  </button>
                  <button
                    onClick={() => handleMenuAction('whatsapp', prospecto)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-2 mb-3">
          {prospecto.empresa && (
            <div className="flex items-center text-sm text-gray-600 min-w-0">
              <Building className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate">{prospecto.empresa}</span>
            </div>
          )}
          
          {prospecto.telefono && (
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate">{prospecto.telefono}</span>
            </div>
          )}

          {prospecto.email && (
            <div className="flex items-center text-sm text-gray-600 min-w-0">
              <Mail className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate">{prospecto.email}</span>
            </div>
          )}
        </div>

        {/* Canal de contacto */}
        {prospecto.canal_contacto && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {prospecto.canal_contacto}
            </span>
          </div>
        )}

        {/* Productos de interés */}
        {prospecto.productos_interes && Array.isArray(prospecto.productos_interes) && prospecto.productos_interes.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Productos de interés:</p>
            <div className="flex flex-wrap gap-1">
            {prospecto.productos_interes.slice(0, 2).map((producto, index) => {
              let nombreProducto = producto;
              
              if (typeof producto === 'string' && producto.startsWith('{')) {
                try {
                  const productoObj = JSON.parse(producto);
                  nombreProducto = productoObj.nombre || productoObj.codigo || 'Producto sin nombre';
                } catch (e) {
                  nombreProducto = producto;
                }
              }
              
              return (
                <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded truncate">
                  {nombreProducto.length > 15 ? `${nombreProducto.substring(0, 15)}...` : nombreProducto}
                </span>
              );
            })}
              {prospecto.productos_interes.length > 2 && (
                <span className="text-xs text-gray-500">
                  +{prospecto.productos_interes.length - 2} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* Valor estimado y probabilidad */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <div className="flex items-center text-green-600">
            <DollarSign className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="font-medium">
            {formatearValor(calcularValorReal(prospecto))}
          </span>
          </div>
          
          {prospecto.probabilidad_cierre && (
            <div className="text-gray-600">
              <span className="font-medium">{prospecto.probabilidad_cierre}%</span>
            </div>
          )}
        </div>

        {/* Asesor asignado */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center min-w-0 flex-1 mr-2">
            <User className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">{prospecto.asesor_nombre || 'Sin asesor'}</span>
          </div>
          <div className="flex items-center flex-shrink-0">
            <Calendar className="h-3 w-3 mr-1" />
            <span>{formatearFecha(prospecto.fecha_contacto)}</span>
          </div>
        </div>

        {/* Alertas de seguimiento */}
        {tieneUrgencia && (
          <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
            <span>
              {prospecto.seguimiento_vencido ? 'Seguimiento vencido' : 'Seguimiento pendiente'}
            </span>
          </div>
        )}

        {/* Observaciones (si existen) */}
        {prospecto.observaciones && (
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            <p className="truncate">{prospecto.observaciones}</p>
          </div>
        )}
      </div>
    );
  };

  // Verificar si hay filtros activos
  const hayFiltrosActivos = () => {
    if (!filtros || typeof filtros !== 'object') return false;
    
    return Object.values(filtros).some(value => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });
  };

  // Calcular totales
  const totalProspectos = Object.values(kanbanData).reduce((total, prospectos) => {
    return total + (Array.isArray(prospectos) ? prospectos.length : 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {Object.keys(estadosConfig).map((estado) => (
          <div key={estado} className="flex-1 min-w-80">
            <div className="bg-white rounded-lg shadow-sm border h-full">
              <div className="p-4 border-b bg-gray-50 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="p-4 space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-gray-100 h-32 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <h3 className="text-lg font-medium text-red-800">Error cargando Kanban Board</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <div className="space-x-3">
          <button
            onClick={cargarDatosKanban}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
          {onFiltrosChange && (
            <button
              onClick={() => onFiltrosChange({})}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Indicador de filtros activos */}
      {hayFiltrosActivos() && (
        <div className="mb-4 flex items-center text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
          <Filter className="h-4 w-4 mr-2" />
          <span>Mostrando {totalProspectos} prospecto{totalProspectos !== 1 ? 's' : ''} con filtros activos</span>
          {onFiltrosChange && (
            <button 
              onClick={() => onFiltrosChange({})}
              className="ml-auto text-blue-700 hover:text-blue-900 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Tablero Kanban */}
      <div className="flex flex-col lg:flex-row gap-6 h-full overflow-x-auto">
        {Object.entries(estadosConfig).map(([estado, config]) => {
          const prospectos = kanbanData[estado] || [];
          const IconComponent = config.icon;

          return (
            <div
              key={estado}
              className="flex-1 min-w-80 max-w-sm"
              onDragOver={(e) => handleDragOver(e, estado)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, estado)}
            >
              <div className={`bg-white rounded-lg shadow-sm border h-full transition-all duration-200 ${
                dragOverColumn === estado ? 'ring-2 ring-blue-400 shadow-lg' : ''
              }`}>
                {/* Header de la columna */}
                <div className={`p-4 border-b ${config.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${config.headerColor} bg-opacity-10 mr-3`}>
                        <IconComponent className={`h-5 w-5 ${config.textColor}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${config.textColor}`}>{estado}</h3>
                        <p className="text-sm text-gray-600">
                          {prospectos.length} prospecto{prospectos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lista de prospectos */}
                <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {prospectos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className={`mx-auto w-12 h-12 rounded-full ${config.color} flex items-center justify-center mb-4`}>
                        <IconComponent className={`h-6 w-6 ${config.textColor}`} />
                      </div>
                      <p>No hay prospectos en {estado.toLowerCase()}</p>
                      {hayFiltrosActivos() && (
                        <p className="text-xs mt-1">Prueba ajustar los filtros</p>
                      )}
                    </div>
                  ) : (
                    prospectos.map((prospecto) => (
                      <ProspectoCard key={prospecto.id || Math.random()} prospecto={prospecto} />
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de confirmación */}
      <ConfirmationModal />
      
      {/* AGREGADO: VentaForm para conversión */}
      {showVentaForm && prospectoParaConversion && (
        <VentaForm
          mode="conversion"
          venta={null}
          datosIniciales={prepararDatosIniciales(prospectoParaConversion)}
          onSave={handleVentaCreatedFromConversion}
          onClose={handleVentaFormClose}
          tituloPersonalizado={`Convertir Prospecto "${prospectoParaConversion.nombre_cliente || 'Sin nombre'}" a Venta`}
        />
      )}
    </div>
  );
};

export default KanbanBoard;