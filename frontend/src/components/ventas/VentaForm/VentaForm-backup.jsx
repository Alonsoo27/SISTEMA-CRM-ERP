// src/components/ventas/VentaForm/VentaForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Save, AlertCircle, CheckCircle, DollarSign, User,
  Calendar, Phone, Mail, Building, Package, Plus, Trash2,
  Search, ShoppingCart, Tag, FileText, Clock, MapPin, Settings,
  Hash, TrendingUp, Edit, ArrowRight
} from 'lucide-react';
import ventasService from '../../../services/ventasService';
import productosService from '../../../services/productosService';
import prospectosService from '../../../services/prospectosService';
import clientesService from '../../../services/clientesService';
import UbicacionesSelector from '../../ui/UbicacionesSelector';
const obtenerFechaLima = () => {
  // Método más robusto usando Intl API
  const fechaLima = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  
  console.log('🇵🇪 Fecha Lima generada:', fechaLima);
  return fechaLima; // Ya retorna formato YYYY-MM-DD
};
const VentaForm = ({
  venta = null,
  mode = 'create', // 'create', 'edit', 'conversion'
  datosIniciales = {}, // NUEVA PROP para datos del prospecto
  onClose,
  onSave,
  tituloPersonalizado = null // NUEVA PROP para título custom
}) => {
  const [formData, setFormData] = useState({
    // Campos de tu tabla 'ventas' - ✅ ESTRUCTURA CORREGIDA
    prospecto_id: null,
    asesor_id: null,
    correlativo_asesor: null,
    // Nuevos campos para integración con clientes
    cliente_documento: '', // DNI/RUC/PASAPORTE/CE
    tipo_documento: '', // DNI, RUC, PASAPORTE, CE
    cliente_id: null, // ID del cliente si existe

    nombre_cliente: '', // ✅ CAMBIADO de cliente_nombre
    apellido_cliente: '', // ✅ AGREGADO - Campo nuevo
    cliente_empresa: '',
    cliente_email: '',
    cliente_telefono: '',

    // Campo para empresa de depósito (Olecrammi/Mundipacci)
    empresa_deposito: 'Olecrammi', // Olecrammi, Mundipacci
    
    // Campos geográficos
    ciudad: '',
    departamento: '',
    distrito: '',
    
    // ✅ AGREGADO - Canal de contacto
    canal_contacto: 'WhatsApp',
    
    valor_total: '',
    descuento_porcentaje: '',
    descuento_monto: '',
    valor_final: '',
    moneda: 'PEN',
    estado: 'vendido',
    estado_detallado: 'vendido',
    fecha_entrega_estimada: '',
    fecha_entrega_real: '',
    canal_origen: 'venta-directa',
    notas_internas: '',
    condiciones_especiales: '',
    fecha_venta: '',
    
    // Campos empresariales
    tipo_venta: 'boleta',
    es_venta_presencial: false,
    recibio_capacitacion_inmediata: false,
    se_lo_llevo_directamente: false,
    observaciones_almacen: '',
    observaciones_soporte: '',
    
    // Para manejo de productos
    productos: []
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showClienteSearch, setShowClienteSearch] = useState(false);
  const [clientesBusqueda, setClientesBusqueda] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Nuevos estados para búsqueda por documento
  const [busquedaDocumento, setBusquedaDocumento] = useState('');
  const [loadingDocumento, setLoadingDocumento] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);

  // Estados para productos
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [productosEncontrados, setProductosEncontrados] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [showProductosDropdown, setShowProductosDropdown] = useState(false);

  // NUEVOS ESTADOS PARA CORRELATIVOS
  const [proximosCorrelativos, setProximosCorrelativos] = useState(null);
  const [loadingCorrelativos, setLoadingCorrelativos] = useState(false);

  // Usuario actual (deberías obtenerlo del contexto de auth)
  const usuarioActual = {
    id: 1,
    nombre: 'Usuario Actual'
  };

  // ✅ AGREGADO - Canales de contacto predefinidos (igual que prospectos)
  const canalesPredefinidos = [
    { codigo: 'WhatsApp', nombre: 'WhatsApp', icono: '📱' },
    { codigo: 'Messenger', nombre: 'Facebook Messenger', icono: '💬' },
    { codigo: 'Facebook', nombre: 'Facebook', icono: '📘' },
    { codigo: 'TikTok', nombre: 'TikTok', icono: '🎵' },
    { codigo: 'Llamada', nombre: 'Llamada Telefónica', icono: '📞' },
    { codigo: 'Presencial', nombre: 'Visita Presencial', icono: '🏢' },
    { codigo: 'Email', nombre: 'Correo Electrónico', icono: '📧' }
  ];

  // Tipos de venta
  const tiposVenta = [
    { value: 'factura', label: 'Factura', descripcion: 'Para empresas con RUC' },
    { value: 'boleta', label: 'Boleta', descripcion: 'Para personas naturales' },
    { value: 'nota_venta', label: 'Nota de Venta', descripcion: 'Sin comprobante fiscal' }
  ];

  // Estados detallados
  const estadosDetallados = [
    { value: 'vendido', label: 'Vendido', descripcion: 'Venta registrada', icon: '📦', color: 'blue' },
    { value: 'vendido/enviado', label: 'Vendido → Enviado', descripcion: 'Producto en tránsito', icon: '🚚', color: 'yellow' },
    { value: 'vendido/enviado/recibido', label: 'Vendido → Enviado → Recibido', descripcion: 'Cliente confirmó recepción', icon: '📫', color: 'orange' },
    { value: 'vendido/enviado/recibido/capacitado', label: 'Completado', descripcion: 'Cliente capacitado - Proceso completo', icon: '✅', color: 'green' },
    { value: 'anulado', label: 'Anulado', descripción: 'Venta cancelada/devuelta', icon: '❌', color: 'red' },
    { value: 'cambio', label: 'Cambio', descripcion: 'Cliente solicitó cambio', icon: '🔄', color: 'purple' },
    { value: 'cambio/enviado', label: 'Cambio → Enviado', descripcion: 'Producto de cambio enviado', icon: '🔄', color: 'purple' },
    { value: 'cambio/enviado/recibido', label: 'Cambio → Recibido', descripcion: 'Cambio completado', icon: '🔄', color: 'purple' }
  ];

  // Monedas
  const monedasDisponibles = [
    { value: 'PEN', label: 'Soles (PEN)' },
    { value: 'USD', label: 'Dólares (USD)' }
  ];

  // Canales de origen
  const canalesOrigen = [
    { value: 'venta-directa', label: 'Venta Directa', descripcion: 'Cliente directo sin prospección' },
    { value: 'pipeline-convertido', label: 'Pipeline Convertido', descripcion: 'Convertido desde prospecto' }
  ];

  // Tipos de documento
  const tiposDocumento = [
    { value: 'DNI', label: 'DNI', descripcion: 'Documento Nacional de Identidad' },
    { value: 'RUC', label: 'RUC', descripcion: 'Registro Único de Contribuyentes' },
    { value: 'PASAPORTE', label: 'Pasaporte', descripcion: 'Pasaporte extranjero' },
    { value: 'CE', label: 'Carné de Extranjería', descripcion: 'Carné de Extranjería' }
  ];

  // Empresas de depósito
  const empresasDeposito = [
    { value: 'Olecrammi', label: 'Olecrammi', descripcion: 'Depósito en cuenta Olecrammi' },
    { value: 'Mundipacci', label: 'Mundipacci', descripcion: 'Depósito en cuenta Mundipacci' }
  ];

  // ✅ USEEFFECT CORREGIDO - Inicializar formulario
useEffect(() => {
  if (mode === 'edit' && venta) {
    // MODO EDIT: Cargar datos de venta existente
    setFormData({
      prospecto_id: venta.prospecto_id || null,
      asesor_id: venta.asesor_id || null,
      correlativo_asesor: venta.correlativo_asesor || null,
      nombre_cliente: venta.nombre_cliente || '',
      apellido_cliente: venta.apellido_cliente || '',
      cliente_empresa: venta.cliente_empresa || '',
      cliente_email: venta.cliente_email || '',
      cliente_telefono: venta.cliente_telefono || '',
      ciudad: venta.ciudad || '',
      departamento: venta.departamento || '',
      distrito: venta.distrito || '',
      canal_contacto: venta.canal_contacto || 'WhatsApp',
      valor_total: venta.valor_total || '',
      descuento_porcentaje: venta.descuento_porcentaje || '',
      descuento_monto: venta.descuento_monto || '',
      valor_final: venta.valor_final || '',
      moneda: venta.moneda || 'PEN',
      estado: 'vendido',
      estado_detallado: venta.estado_detallado || 'vendido',
      fecha_entrega_estimada: venta.fecha_entrega_estimada ? 
        new Date(venta.fecha_entrega_estimada).toISOString().split('T')[0] : '',
      fecha_entrega_real: venta.fecha_entrega_real ? 
        new Date(venta.fecha_entrega_real).toISOString().split('T')[0] : '',
      canal_origen: venta.canal_origen || 'venta-directa',
      notas_internas: venta.notas_internas || '',
      condiciones_especiales: venta.condiciones_especiales || '',
      fecha_venta: venta.fecha_venta ? 
        new Date(venta.fecha_venta).toISOString().split('T')[0] : '',
      
      tipo_venta: venta.tipo_venta || 'boleta',
      es_venta_presencial: venta.es_venta_presencial || false,
      recibio_capacitacion_inmediata: venta.recibio_capacitacion_inmediata || false,
      se_lo_llevo_directamente: venta.se_lo_llevo_directamente || false,
      observaciones_almacen: venta.observaciones_almacen || '',
      observaciones_soporte: venta.observaciones_soporte || '',
      
      productos: []
    });
    
    cargarProductosVenta(venta.id);
    
  } else if (mode === 'conversion' && datosIniciales?.prospecto_id) {
  // MODO CONVERSION: Cargar datos del prospecto + SUS PRODUCTOS
  console.log('🔄 Iniciando conversión desde prospecto:', datosIniciales.prospecto_id);
  
  const fechaEntregaDefault = new Date();
  fechaEntregaDefault.setDate(fechaEntregaDefault.getDate() + 7);
  
  setFormData({
    prospecto_id: datosIniciales.prospecto_id || null,
    nombre_cliente: datosIniciales.nombre_cliente || '',
    apellido_cliente: datosIniciales.apellido_cliente || '',
    cliente_empresa: datosIniciales.cliente_empresa || '',
    cliente_email: datosIniciales.cliente_email || '',
    cliente_telefono: datosIniciales.cliente_telefono || '',
    ciudad: datosIniciales.ciudad || '',
    departamento: datosIniciales.departamento || '',
    distrito: datosIniciales.distrito || '',
    canal_contacto: datosIniciales.canal_contacto || 'WhatsApp',
    
    valor_total: datosIniciales.valor_total || '',
    valor_final: datosIniciales.valor_final || '',
    descuento_porcentaje: '',
    descuento_monto: '',
    moneda: 'PEN',
    
    canal_origen: 'pipeline-convertido',
    estado: 'vendido',
    estado_detallado: 'vendido',
    fecha_venta: datosIniciales.fecha_venta || obtenerFechaLima(),
    fecha_entrega_estimada: fechaEntregaDefault.toISOString().split('T')[0],
    
    tipo_venta: 'boleta',
    es_venta_presencial: false,
    recibio_capacitacion_inmediata: false,
    se_lo_llevo_directamente: false,
    notas_internas: `Conversión automática desde prospecto ${datosIniciales.prospecto_id || ''}`,
    observaciones_almacen: '',
    observaciones_soporte: '',
    condiciones_especiales: '',
    productos: [] // ✅ Se cargará con cargarProductosProspecto
  });
  
  // ✅ CARGAR PRODUCTOS DEL PROSPECTO
  cargarProductosProspecto(datosIniciales.prospecto_id);
    
  } else if (mode === 'create') {
    // MODO CREATE: Formulario vacío con valores por defecto
    const fechaEntregaDefault = new Date();
    fechaEntregaDefault.setDate(fechaEntregaDefault.getDate() + 7);
    const fechaVentaHoy = obtenerFechaLima();
    
    setFormData(prev => ({ 
      ...prev, 
      fecha_entrega_estimada: fechaEntregaDefault.toISOString().split('T')[0],
      fecha_venta: fechaVentaHoy
    }));
  }
}, [mode, venta?.id, datosIniciales?.prospecto_id]);

  // NUEVO USEEFFECT PARA CARGAR PREVIEW DE CORRELATIVOS
  useEffect(() => {
    if (mode === 'create' && usuarioActual?.id) {
      const cargarPreviewCorrelativos = async () => {
        try {
          setLoadingCorrelativos(true);
          const correlativos = await ventasService.obtenerProximosCorrelativos(
            usuarioActual.id, 
            new Date().getFullYear()
          );
          
          if (correlativos.success) {
            setProximosCorrelativos(correlativos.data);
            console.log('📋 Preview correlativos cargado:', correlativos.data);
          } else {
            console.warn('⚠️ No se pudo cargar preview de correlativos:', correlativos.error);
          }
        } catch (error) {
          console.error('❌ Error cargando preview correlativos:', error);
        } finally {
          setLoadingCorrelativos(false);
        }
      };
      
      cargarPreviewCorrelativos();
    }
  }, [mode, usuarioActual?.id]);

  // NUEVO USEEFFECT PARA RECÁLCULO AUTOMÁTICO
  useEffect(() => {
    const totales = calcularTotalesConProductos(
      formData.productos, 
      formData.descuento_porcentaje, 
      formData.descuento_monto
    );
    
    setFormData(prev => ({
      ...prev,
      valor_total: totales.subtotal.toString(),
      valor_final: totales.total.toString()
    }));
  }, [formData.productos, formData.descuento_porcentaje, formData.descuento_monto]);

  // NUEVA FUNCIÓN CALCULAR TOTALES CON PRODUCTOS
  const calcularTotalesConProductos = useCallback((productos, descuentoPorcentaje = 0, descuentoMonto = 0) => {
    const subtotal = productos.reduce((sum, producto) => 
      sum + (parseFloat(producto.subtotal) || 0), 0
    );
    
    const totalConDescuentos = productos.reduce((sum, producto) => 
      sum + (parseFloat(producto.total_linea) || 0), 0
    );
    
    const descGeneralMonto = parseFloat(descuentoMonto) || 0;
    const descGeneralPorcentaje = parseFloat(descuentoPorcentaje) || 0;
    
    let total = totalConDescuentos;
    if (descGeneralPorcentaje > 0) {
      total = totalConDescuentos * (1 - descGeneralPorcentaje / 100);
    } else if (descGeneralMonto > 0) {
      total = totalConDescuentos - descGeneralMonto;
    }
    
    return { 
      subtotal: subtotal,
      totalConDescuentos: totalConDescuentos,
      total: Math.max(0, total)
    };
  }, []);

  // Cargar productos de una venta existente
const cargarProductosVenta = async (ventaId) => {
  try {
    const response = await ventasService.obtenerDetallesVenta(ventaId);
 
    const productos = response.data?.data || response.data || [];
    if (response.success && Array.isArray(productos)) {
      const productosFormateados = productos.map(detalle => ({
        id: detalle.id,
        producto_id: detalle.producto_id,
        codigo: detalle.codigo || 'N/A',
        nombre: detalle.descripcion_personalizada || detalle.producto_nombre || 'Producto',
        marca: detalle.marca || '', // Cambiar: detalle.marca en lugar de detalle.producto?.marca
        categoria: detalle.categoria || '', // Cambiar: detalle.categoria en lugar de detalle.producto?.categoria
        unidad: detalle.unidad_medida || 'UND', // Este campo necesita agregarse al backend
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal,
        total_linea: detalle.total_linea,
        descuento_porcentaje: detalle.descuento_porcentaje || 0,
        descuento_monto: detalle.descuento_monto || 0,
        descripcion_personalizada: detalle.descripcion_personalizada,
        notas: detalle.notas,
        orden_linea: detalle.orden_linea
      }));
      
      setFormData(prev => ({ ...prev, productos: productosFormateados }));
    }
  } catch (error) {
    console.error('Error cargando productos de la venta:', error);
  }
};

// Cargar productos de un prospecto para conversión
const cargarProductosProspecto = async (prospectoId) => {
  try {
    console.log('🔄 Cargando productos del prospecto:', prospectoId);
    
    // Llamar al backend para obtener productos del prospecto
    const response = await prospectosService.obtenerProductosInteres(prospectoId);
    
    if (response.success && Array.isArray(response.data)) {
      const productosFormateados = response.data.map((producto, index) => ({
        id: Date.now() + index, // ID temporal para React
        producto_id: producto.producto_id || null,
        codigo: producto.codigo_producto || 'PERSONALIZADO',
        nombre: producto.descripcion_producto || 'Producto sin nombre',
        marca: producto.marca || '',
        categoria: producto.categoria || '', 
        unidad: producto.unidad_medida || 'UND',
        cantidad: producto.cantidad_estimada || 1,
        precio_unitario: parseFloat(producto.precio_sin_igv || 0),
        subtotal: parseFloat(producto.precio_sin_igv || 0) * (producto.cantidad_estimada || 1),
        total_linea: parseFloat(producto.valor_linea || 0),
        descuento_porcentaje: 0,
        descuento_monto: 0,
        descripcion_personalizada: producto.descripcion_personalizada || '',
        notas: producto.notas || '',
        orden_linea: index + 1
      }));
      
      console.log('✅ Productos del prospecto formateados:', productosFormateados);
      
      setFormData(prev => ({ ...prev, productos: productosFormateados }));
      
      return productosFormateados;
    } else {
      console.warn('⚠️ No se encontraron productos para el prospecto:', prospectoId);
      return [];
    }
  } catch (error) {
    console.error('❌ Error cargando productos del prospecto:', error);
    return [];
  }
};

  // Búsqueda de productos con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (busquedaProducto.length >= 2) {
        buscarProductos(busquedaProducto);
      } else {
        setProductosEncontrados([]);
        setShowProductosDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busquedaProducto]);

  const buscarProductos = async (texto) => {
    try {
      setLoadingProductos(true);
      const response = await productosService.buscarProductosParaAutocompletado(texto, 8);
      
      if (response.success) {
        setProductosEncontrados(response.data);
        setShowProductosDropdown(response.data.length > 0);
      } else {
        setProductosEncontrados([]);
        setShowProductosDropdown(false);
      }
    } catch (error) {
      console.error('Error buscando productos:', error);
      setProductosEncontrados([]);
      setShowProductosDropdown(false);
    } finally {
      setLoadingProductos(false);
    }
  };

  // ✅ VALIDAR FORMULARIO CORREGIDO
  const validarFormulario = useCallback(() => {
    const newErrors = {};

    // ✅ CORREGIDO - Validar nombre_cliente en lugar de cliente_nombre
    if (!formData.nombre_cliente.trim()) {
      newErrors.nombre_cliente = 'El nombre del cliente es obligatorio';
    }

    // ✅ AGREGADO - Validar canal_contacto
    if (!formData.canal_contacto) {
      newErrors.canal_contacto = 'Seleccione un canal de contacto';
    }

    if (!formData.valor_final || parseFloat(formData.valor_final) <= 0) {
      newErrors.valor_final = 'El valor debe ser mayor a cero';
    }

    if (!formData.fecha_venta) {
      newErrors.fecha_venta = 'La fecha de venta es obligatoria';
    }

    if (formData.cliente_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.cliente_email)) {
      newErrors.cliente_email = 'Email inválido';
    }

    if (formData.cliente_telefono && formData.cliente_telefono.length < 7) {
      newErrors.cliente_telefono = 'Teléfono debe tener al menos 7 dígitos';
    }

    if (formData.fecha_entrega_estimada && !formData.es_venta_presencial) {
      const fechaEntrega = new Date(formData.fecha_entrega_estimada);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaEntrega < hoy) {
        newErrors.fecha_entrega_estimada = 'La fecha de entrega no puede ser anterior a hoy';
      }
    }

    if (formData.productos.length === 0) {
      newErrors.productos = 'Debe agregar al menos un producto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Buscar clientes
  const buscarClientes = useCallback(async (busqueda) => {
    if (!busqueda || busqueda.length < 2) {
      setClientesBusqueda([]);
      return;
    }

    try {
      setLoadingClientes(true);
      const response = await ventasService.obtenerClientes({ busqueda });

      if (response.success) {
        setClientesBusqueda(response.data.clientes || []);
      }
    } catch (err) {
      console.error('Error buscando clientes:', err);
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  // Buscar cliente por documento (DNI/RUC)
  const buscarPorDocumento = useCallback(async (documento) => {
    if (!documento || documento.trim().length < 3) {
      setClienteEncontrado(null);
      return;
    }

    try {
      setLoadingDocumento(true);
      const response = await clientesService.buscarPorDocumento(documento.trim());

      if (response.success && response.data) {
        const cliente = response.data;
        setClienteEncontrado(cliente);

        // Auto-llenar el formulario con los datos del cliente
        setFormData(prev => ({
          ...prev,
          cliente_id: cliente.id,
          cliente_documento: cliente.numero_documento,
          tipo_documento: cliente.tipo_documento,
          nombre_cliente: cliente.tipo_cliente === 'persona' ? cliente.nombres : cliente.razon_social,
          apellido_cliente: cliente.tipo_cliente === 'persona' ? cliente.apellidos : '',
          cliente_empresa: cliente.tipo_cliente === 'empresa' ? cliente.razon_social : (cliente.cliente_empresa || ''),
          cliente_email: cliente.email || '',
          cliente_telefono: cliente.telefono || '',
          ciudad: cliente.ciudad || '',
          departamento: cliente.departamento || '',
          distrito: cliente.distrito || ''
        }));

        setNotification({
          type: 'success',
          message: `Cliente encontrado: ${cliente.nombre_completo || cliente.razon_social}`
        });
      } else {
        setClienteEncontrado(null);
        setNotification({
          type: 'info',
          message: 'Cliente no encontrado. Puedes crear uno nuevo.'
        });
      }
    } catch (err) {
      console.error('Error buscando cliente por documento:', err);
      setClienteEncontrado(null);
      setNotification({
        type: 'error',
        message: 'Error al buscar cliente: ' + err.message
      });
    } finally {
      setLoadingDocumento(false);
    }
  }, []);

  // Manejar cambios en el formulario
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }

    if (field === 'es_venta_presencial') {
      if (!value) {
        setFormData(prev => ({
          ...prev,
          [field]: value,
          recibio_capacitacion_inmediata: false,
          se_lo_llevo_directamente: false
        }));
      }
    }
  }, [errors]);

  // ✅ SELECCIONAR CLIENTE CORREGIDO
  const seleccionarCliente = useCallback((cliente) => {
    setFormData(prev => ({
      ...prev,
      nombre_cliente: cliente.nombre_cliente || '', // ✅ CORREGIDO
      apellido_cliente: cliente.apellido_cliente || '', // ✅ AGREGADO  
      cliente_email: cliente.email || cliente.cliente_email || '',
      cliente_telefono: cliente.telefono || cliente.cliente_telefono || '',
      cliente_empresa: cliente.empresa || cliente.cliente_empresa || '',
      ciudad: cliente.ciudad || '',
      departamento: cliente.departamento || '',
      distrito: cliente.distrito || '',
      canal_contacto: cliente.canal_contacto || 'WhatsApp' // ✅ AGREGADO
    }));
    setShowClienteSearch(false);
    setBusquedaCliente('');
    setClientesBusqueda([]);
  }, []);

  // Seleccionar producto del autocompletado
  const seleccionarProducto = useCallback((producto) => {
    setFormData(prev => {
      const nuevoProducto = {
        id: Date.now(),
        producto_id: producto.id,
        codigo: producto.codigo,
        nombre: producto.descripcion,
        marca: producto.marca,
        categoria: producto.categoria,
        unidad: producto.unidad,
        cantidad: 1,
        precio_unitario: producto.precio_base,
        subtotal: producto.precio_base,
        total_linea: producto.precio_base,
        descuento_porcentaje: 0,
        descuento_monto: 0,
        descripcion_personalizada: '',
        notas: '',
        orden_linea: prev.productos.length + 1
      };
      
      const nuevosProductos = [...prev.productos, nuevoProducto];
      
      const totales = calcularTotalesConProductos(nuevosProductos, prev.descuento_porcentaje, prev.descuento_monto);
      
      return {
        ...prev,
        productos: nuevosProductos,
        valor_total: totales.subtotal.toString(),
        valor_final: totales.total.toString()
      };
    });

    setBusquedaProducto('');
    setProductosEncontrados([]);
    setShowProductosDropdown(false);
  }, [calcularTotalesConProductos]);

  // Eliminar producto
  const eliminarProducto = useCallback((productoId) => {
    const nuevosProductos = formData.productos.filter(p => p.id !== productoId);
    setFormData(prev => ({
      ...prev,
      productos: nuevosProductos
    }));

    const totales = calcularTotalesConProductos(nuevosProductos, formData.descuento_porcentaje, formData.descuento_monto);
    setFormData(prev => ({ 
      ...prev, 
      valor_total: totales.subtotal.toString(),
      valor_final: totales.total.toString()
    }));
  }, [formData.productos, formData.descuento_porcentaje, formData.descuento_monto, calcularTotalesConProductos]);

  // Actualizar producto
  const actualizarProducto = useCallback((productoId, campo, valor) => {
    setFormData(prev => {
      const nuevosProductos = prev.productos.map(producto => {
        if (producto.id === productoId) {
          const updated = { ...producto, [campo]: valor };
          
          if (campo === 'cantidad' || campo === 'precio_unitario') {
            const cantidad = parseFloat(campo === 'cantidad' ? valor : updated.cantidad) || 0;
            const precio = parseFloat(campo === 'precio_unitario' ? valor : updated.precio_unitario) || 0;
            const subtotal = cantidad * precio;
            
            const descuentoPorcentaje = parseFloat(updated.descuento_porcentaje) || 0;
            const descuentoMonto = parseFloat(updated.descuento_monto) || 0;
            
            let totalLinea = subtotal;
            if (descuentoPorcentaje > 0) {
              totalLinea = subtotal * (1 - descuentoPorcentaje / 100);
            } else if (descuentoMonto > 0) {
              totalLinea = subtotal - descuentoMonto;
            }
            
            updated.subtotal = subtotal;
            updated.total_linea = totalLinea;
          }
          
          return updated;
        }
        return producto;
      });

      const totales = calcularTotalesConProductos(nuevosProductos, prev.descuento_porcentaje, prev.descuento_monto);
      
      return {
        ...prev,
        productos: nuevosProductos,
        valor_total: totales.subtotal.toString(),
        valor_final: totales.total.toString()
      };
    });
  }, [calcularTotalesConProductos]);

  // Función para limpiar formulario después de crear venta
  const limpiarFormulario = useCallback(() => {
    setFormData({
      prospecto_id: null,
      asesor_id: null,
      correlativo_asesor: null,
      nombre_cliente: '', // ✅ CORREGIDO
      apellido_cliente: '', // ✅ AGREGADO
      cliente_empresa: '',
      cliente_email: '',
      cliente_telefono: '',
      ciudad: '',
      departamento: '',
      distrito: '',
      canal_contacto: 'WhatsApp', // ✅ AGREGADO
      valor_total: '',
      descuento_porcentaje: '',
      descuento_monto: '',
      valor_final: '',
      moneda: 'PEN',
      estado: 'vendido',
      estado_detallado: 'vendido',
      fecha_entrega_estimada: '',
      fecha_entrega_real: '',
      canal_origen: 'venta-directa',
      notas_internas: '',
      condiciones_especiales: '',
      fecha_venta: obtenerFechaLima(),
      tipo_venta: 'boleta',
      es_venta_presencial: false,
      recibio_capacitacion_inmediata: false,
      se_lo_llevo_directamente: false,
      observaciones_almacen: '',
      observaciones_soporte: '',
      productos: []
    });
    setErrors({});
    setBusquedaProducto('');
    setProductosEncontrados([]);
    setShowProductosDropdown(false);
  }, []);

  // ✅ HANDLESUBMIT COMPLETAMENTE CORREGIDO
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      showNotification('Por favor corrige los errores en el formulario', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      if (mode === 'edit') {
        // ✅ DATOS PARA EDICIÓN CORREGIDOS
        const datosVenta = {
          prospecto_id: formData.prospecto_id,
          asesor_id: formData.asesor_id,
          correlativo_asesor: formData.correlativo_asesor,
          nombre_cliente: formData.nombre_cliente, // ✅ CORREGIDO
          apellido_cliente: formData.apellido_cliente, // ✅ AGREGADO
          cliente_empresa: formData.cliente_empresa,
          cliente_email: formData.cliente_email,
          cliente_telefono: formData.cliente_telefono,
          ciudad: formData.ciudad?.trim() || '',
          departamento: formData.departamento?.trim() || '',
          distrito: formData.distrito?.trim() || '',
          canal_contacto: formData.canal_contacto, // ✅ AGREGADO
          valor_total: parseFloat(formData.valor_total) || 0,
          descuento_porcentaje: parseFloat(formData.descuento_porcentaje) || 0,
          descuento_monto: parseFloat(formData.descuento_monto) || 0,
          valor_final: parseFloat(formData.valor_final) || 0,
          moneda: formData.moneda,
          estado: 'vendido',
          estado_detallado: formData.estado_detallado,
          fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
          fecha_entrega_real: formData.fecha_entrega_real || null,
          canal_origen: formData.canal_origen,
          notas_internas: formData.notas_internas,
          condiciones_especiales: formData.condiciones_especiales,
          fecha_venta: formData.fecha_venta || null,
          
          tipo_venta: formData.tipo_venta,
          es_venta_presencial: formData.es_venta_presencial,
          recibio_capacitacion_inmediata: formData.recibio_capacitacion_inmediata,
          se_lo_llevo_directamente: formData.se_lo_llevo_directamente,
          observaciones_almacen: formData.observaciones_almacen,
          observaciones_soporte: formData.observaciones_soporte,
          
          productos: formData.productos.map(producto => ({
            producto_id: producto.producto_id,
            cantidad: parseFloat(producto.cantidad) || 0,
            precio_unitario: parseFloat(producto.precio_unitario) || 0,
            subtotal: parseFloat(producto.subtotal) || 0,
            descuento_porcentaje: parseFloat(producto.descuento_porcentaje) || 0,
            descuento_monto: parseFloat(producto.descuento_monto) || 0,
            total_linea: parseFloat(producto.total_linea) || 0,
            descripcion_personalizada: producto.descripcion_personalizada,
            notas: producto.notas,
            orden_linea: producto.orden_linea
          }))
        };
        
        const response = await ventasService.actualizarVentaCompleta(venta.id, datosVenta);
        
        if (response.success) {
          showNotification('Venta actualizada exitosamente', 'success');
          setTimeout(() => {
            onSave(response.data);
          }, 1000);
        } else {
          showNotification(response.error, 'error');
        }
      } else {
        // ✅ NUEVA LÓGICA DE CREACIÓN CON CORRELATIVOS Y ESTRUCTURA CORREGIDA
        console.log('🔢 Generando correlativos profesionales...');
        
        const asesorId = parseInt(usuarioActual?.id) || 1;
        const currentYear = new Date().getFullYear();
        
        const correlativos = await ventasService.obtenerProximosCorrelativos(asesorId, currentYear);
        
        if (!correlativos.success) {
          showNotification(`Error generando correlativo: ${correlativos.error}`, 'error');
          return;
        }
        
        const { codigo_global, correlativo_asesor } = correlativos.data;
        
        const totales = calcularTotalesConProductos(formData.productos, formData.descuento_porcentaje, formData.descuento_monto);
        
        const datosVenta = {
          // === CORRELATIVOS AUTOMÁTICOS ===
          codigo: codigo_global,
          correlativo_asesor: correlativo_asesor,
          asesor_id: asesorId,
          
          // === DATOS DEL CLIENTE - ✅ ESTRUCTURA CORREGIDA ===
          nombre_cliente: formData.nombre_cliente?.trim() || '', // ✅ CORREGIDO
          apellido_cliente: formData.apellido_cliente?.trim() || '', // ✅ AGREGADO
          cliente_empresa: formData.cliente_empresa?.trim() || '',
          cliente_email: formData.cliente_email?.trim() || '',
          cliente_telefono: formData.cliente_telefono?.trim() || '',
          ciudad: formData.ciudad?.trim() || '',
          departamento: formData.departamento?.trim() || '',
          distrito: formData.distrito?.trim() || '',
          canal_contacto: formData.canal_contacto, // ✅ AGREGADO

          // 🆕 CAMPOS PARA CREACIÓN AUTOMÁTICA DE CLIENTES
          tipo_documento: formData.tipo_documento || 'DNI',
          numero_documento: formData.cliente_documento?.trim() || '',
          direccion: formData.direccion?.trim() || '',
          
          productos: formData.productos.map(p => ({
            producto_id: p.producto_id,
            cantidad: parseFloat(p.cantidad) || 1,
            precio_unitario: parseFloat(p.precio_unitario) || 0,
            subtotal: parseFloat(p.subtotal) || 0,
            descuento_porcentaje: parseFloat(p.descuento_porcentaje) || 0,
            descuento_monto: parseFloat(p.descuento_monto) || 0,
            total_linea: parseFloat(p.total_linea) || 0,
            descripcion_personalizada: p.descripcion_personalizada || '',
            notas: p.notas || '',
            orden_linea: p.orden_linea || 1
          })),
          
          valor_total: parseFloat(formData.valor_total) || totales.subtotal,
          descuento_porcentaje: parseFloat(formData.descuento_porcentaje) || 0,
          descuento_monto: parseFloat(formData.descuento_monto) || 0,
          valor_final: parseFloat(formData.valor_final) || totales.total,
          moneda: formData.moneda || 'PEN',
          empresa_deposito: formData.empresa_deposito || 'Olecrammi',

          tipo_venta: formData.tipo_venta || 'boleta',
          estado: 'vendido',
          estado_detallado: formData.estado_detallado || 'vendido',
          fecha_venta: formData.fecha_venta || obtenerFechaLima(),
          fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
          canal_origen: 'venta-directa',
          
          es_venta_presencial: formData.es_venta_presencial || false,
          recibio_capacitacion_inmediata: formData.recibio_capacitacion_inmediata || false,
          se_lo_llevo_directamente: formData.se_lo_llevo_directamente || false,
          
          notas_internas: formData.notas_internas?.trim() || '',
          observaciones_almacen: formData.observaciones_almacen?.trim() || '',
          observaciones_soporte: formData.observaciones_soporte?.trim() || '',
          condiciones_especiales: formData.condiciones_especiales?.trim() || ''
        };

        // ✅ VALIDACIONES CORREGIDAS
        if (!datosVenta.nombre_cliente) {
          showNotification('El nombre del cliente es requerido', 'error');
          return;
        }
        
        if (!datosVenta.productos || datosVenta.productos.length === 0) {
          showNotification('Debe agregar al menos un producto', 'error');
          return;
        }
        
        if (datosVenta.valor_final <= 0) {
          showNotification('El valor final debe ser mayor a 0', 'error');
          return;
        }

        // LOGS DE DEBUG
        console.log('🔍 ESTRUCTURA CLIENTE A ENVIAR:', {
          nombre_cliente: datosVenta.nombre_cliente,
          apellido_cliente: datosVenta.apellido_cliente,
          cliente_empresa: datosVenta.cliente_empresa,
          cliente_email: datosVenta.cliente_email,
          cliente_telefono: datosVenta.cliente_telefono,
          canal_contacto: datosVenta.canal_contacto // ✅ AGREGADO
        });
        console.log('🔍 DATOS GEOGRÁFICOS:', {
          ciudad: datosVenta.ciudad,
          departamento: datosVenta.departamento,
          distrito: datosVenta.distrito
        });
        console.log('🕐 DEBUG CRÍTICO:');
console.log('Hora UTC actual:', new Date().toISOString());
console.log('Fecha Lima calculada:', obtenerFechaLima());
console.log('formData.fecha_venta:', formData.fecha_venta);
console.log('Fecha que se enviará:', datosVenta.fecha_venta);
        // 📦 NUEVO LOG: PAYLOAD COMPLETO ENVIADO
        console.log('\n📦 FRONTEND: PAYLOAD COMPLETO ENVIADO:');
        console.log(JSON.stringify(datosVenta, null, 2));
        console.log('📦 Número de productos:', datosVenta.productos?.length || 0);
        console.log('📦 Valor final:', datosVenta.valor_final);
        console.log('📦 END PAYLOAD DEBUG\n');
        console.log('🔑 TOKEN ACTUAL:', ventasService.getAuthToken());
console.log('🔑 HEADERS QUE SE ENVIARÁN:', {
  'Authorization': `Bearer ${ventasService.getAuthToken()}`,
  'Content-Type': 'application/json'
});
console.log('🚨 DEBUG SIMPLE - FECHA ANTES DE ENVIAR:');
console.log('datosVenta.fecha_venta:', datosVenta.fecha_venta);
console.log('Hora actual UTC:', new Date().toISOString());
console.log('🚨 END DEBUG')
const response = await ventasService.crearVentaCompleta(datosVenta);
console.log('✅ RESPUESTA RECIBIDA:', response);
if (response.details?.errores) {
  console.log('🚨 ERRORES DE VALIDACIÓN ESPECÍFICOS:');
  response.details.errores.forEach((error, index) => {
    console.log(`Error ${index + 1}:`, error);
  });
}        
        if (response.success) {
          console.log('✅ FRONTEND: Creación reportada como exitosa');
          console.log('✅ DATOS DEVUELTOS:', response.data);
          
          limpiarFormulario();
          showNotification(`✅ Venta ${codigo_global} (#${correlativo_asesor}) creada exitosamente`, 'success');
          setTimeout(() => onSave(response.data), 1000);
        } else {
          console.log('❌ FRONTEND: Error reportado:', response.error);
          
          showNotification(response.error || 'Error al crear venta', 'error');
        }
      }
      
    } catch (error) {
  console.error('❌ Error completo:', error);
  console.error('❌ Response status:', error.response?.status);
  console.error('❌ Response data:', error.response?.data);
  console.error('❌ Response headers:', error.response?.headers);
  console.error('❌ Request config:', error.config);
  
  showNotification(`Error de conexión: ${error.message}`, 'error');
}
     finally {
      setLoading(false);
    }
  };

  // Sistema de notificaciones
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Buscar clientes cuando cambia la búsqueda
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      buscarClientes(busquedaCliente);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busquedaCliente, buscarClientes]);

  calcularTotalesConProductos(formData.productos, formData.descuento_porcentaje, formData.descuento_monto)

  // Obtener info del estado detallado seleccionado
  const getEstadoDetalladoInfo = (estadoValue) => {
    return estadosDetallados.find(e => e.value === estadoValue) || estadosDetallados[0];
  };

  // Componente de notificación
  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    // Normalizar el tipo de notificación y usar fallback
    const tipoNormalizado = notification.tipo || notification.type || 'info';
    const IconComponent = iconos[tipoNormalizado] || AlertCircle;
    const colorClase = colores[tipoNormalizado] || colores.info;

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colorClase} max-w-sm`}>
        <div className="flex items-center">
          <IconComponent className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje || notification.message}</span>
        </div>
      </div>
    );
  };

  const totales = calcularTotalesConProductos(formData.productos, formData.descuento_porcentaje, formData.descuento_monto);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              {mode === 'conversion' ? (
                <>
                  <ArrowRight className="h-5 w-5 mr-2 text-purple-600" />
                  {tituloPersonalizado || 'Convertir Prospecto a Venta'}
                </>
              ) : mode === 'edit' ? (
                <>
                  <Edit className="h-5 w-5 mr-2 text-blue-600" />
                  Editar Venta #{formData.correlativo_asesor || 'S/N'}
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 mr-2 text-green-600" />
                  Nueva Venta
                </>
              )}
            </h2>
            <p className="text-sm text-gray-600">
              {mode === 'conversion' 
                ? 'Revisa los datos del prospecto y agrega productos para crear la venta'
                : mode === 'edit' 
                ? 'Actualiza los datos de la venta' 
                : 'Registra una nueva venta de producto'
              }
            </p>
            {(formData.canal_origen === 'pipeline-convertido' || mode === 'conversion') && (
              <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                <User className="h-3 w-3 mr-1" />
                {mode === 'conversion' ? 'Conversión desde Prospecto' : 'Convertida desde Prospecto'}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información básica de venta */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Información de Venta
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* INPUT DE CORRELATIVO MEJORADO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="h-4 w-4 inline mr-1" />
                  Correlativo Venta
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={mode === 'edit' 
                      ? `#${formData.correlativo_asesor || 'N/A'}` 
                      : loadingCorrelativos 
                        ? 'Cargando...' 
                        : proximosCorrelativos 
                          ? `#${proximosCorrelativos.correlativo_asesor} (próximo)`
                          : 'Se generará automáticamente'
                    }
                    disabled={true}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-bold text-center"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {loadingCorrelativos ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    ) : (
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                </div>
                
                {mode === 'create' && proximosCorrelativos && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-blue-800">
                        <Hash className="h-4 w-4 mr-2" />
                        <span className="font-medium">Próximos correlativos:</span>
                      </div>
                      <div className="text-xs text-blue-600">
                        Año {new Date().getFullYear()}
                      </div>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="text-sm text-blue-700">
                        <span className="font-bold">Global:</span> {proximosCorrelativos.codigo_global}
                      </div>
                      <div className="text-sm text-blue-700">
                        <span className="font-bold">Asesor:</span> #{proximosCorrelativos.correlativo_asesor} (tu numeración personal)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Venta *
                </label>
                <select
                  value={formData.tipo_venta}
                  onChange={(e) => handleInputChange('tipo_venta', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {tiposVenta.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label} - {tipo.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Moneda
                </label>
                <select
                  value={formData.moneda}
                  onChange={(e) => handleInputChange('moneda', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {monedasDisponibles.map(moneda => (
                    <option key={moneda.value} value={moneda.value}>
                      {moneda.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa de Depósito *
                </label>
                <select
                  value={formData.empresa_deposito}
                  onChange={(e) => handleInputChange('empresa_deposito', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {empresasDeposito.map(empresa => (
                    <option key={empresa.value} value={empresa.value}>
                      {empresa.label} - {empresa.descripcion}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Selecciona la empresa donde el cliente realizará el depósito
                </p>
              </div>
            </div>

            {/* Estado Detallado */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado Detallado *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={formData.estado_detallado}
                  onChange={(e) => handleInputChange('estado_detallado', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {estadosDetallados.map(estado => (
                    <option key={estado.value} value={estado.value}>
                      {estado.icon} {estado.label}
                    </option>
                  ))}
                </select>
                
                <div className={`p-3 rounded-lg border ${(() => {
                  const info = getEstadoDetalladoInfo(formData.estado_detallado);
                  const colorMap = {
                    blue: 'bg-blue-50 border-blue-200 text-blue-800',
                    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                    orange: 'bg-orange-50 border-orange-200 text-orange-800',
                    green: 'bg-green-50 border-green-200 text-green-800',
                    red: 'bg-red-50 border-red-200 text-red-800',
                    purple: 'bg-purple-50 border-purple-200 text-purple-800'
                  };
                  return colorMap[info.color] || colorMap.blue;
                })()}`}>
                  <div className="flex items-center text-sm font-medium">
                    <span className="mr-2">{getEstadoDetalladoInfo(formData.estado_detallado).icon}</span>
                    {getEstadoDetalladoInfo(formData.estado_detallado).descripcion}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Fecha de Venta *
                </label>
                <input
                  type="date"
                  value={formData.fecha_venta}
                  onChange={(e) => {
                    console.log('📅 FECHA VENTA CAMBIADA:', e.target.value);
                    handleInputChange('fecha_venta', e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.fecha_venta ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.fecha_venta && (
                  <p className="mt-1 text-sm text-red-600">{errors.fecha_venta}</p>
                )}
              </div>

              <div className="flex items-center justify-center">
                
              </div>

              <input type="hidden" name="estado" value="vendido" />
            </div>

            {/* Venta Presencial */}
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.es_venta_presencial}
                  onChange={(e) => handleInputChange('es_venta_presencial', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  ¿Es una venta presencial en oficina?
                </span>
              </label>
              
              {formData.es_venta_presencial && (
                <div className="mt-3 ml-6 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.se_lo_llevo_directamente}
                      onChange={(e) => handleInputChange('se_lo_llevo_directamente', e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      El cliente se llevó el producto directamente
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.recibio_capacitacion_inmediata}
                      onChange={(e) => handleInputChange('recibio_capacitacion_inmediata', e.target.checked)}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Recibió capacitación inmediata
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ✅ INFORMACIÓN DEL CLIENTE CORREGIDA */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Información del Cliente</h3>
              <button
                type="button"
                onClick={() => setShowClienteSearch(!showClienteSearch)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar Cliente
              </button>
            </div>

            {/* Sección de búsqueda por documento */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-3">Buscar Cliente por Documento</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <select
                    value={formData.tipo_documento}
                    onChange={(e) => handleInputChange('tipo_documento', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Tipo de documento</option>
                    {tiposDocumento.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ingrese DNI, RUC, etc."
                    value={busquedaDocumento}
                    onChange={(e) => setBusquedaDocumento(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        buscarPorDocumento(busquedaDocumento);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {loadingDocumento && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => buscarPorDocumento(busquedaDocumento)}
                  disabled={!busquedaDocumento || loadingDocumento}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </button>
              </div>

              {clienteEncontrado && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Cliente encontrado: {clienteEncontrado.nombre_completo}
                      </p>
                      <p className="text-xs text-green-600">
                        {clienteEncontrado.tipo_documento}: {clienteEncontrado.numero_documento} • {clienteEncontrado.telefono}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {showClienteSearch && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre, email o teléfono..."
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {loadingClientes && (
                  <div className="mt-2 text-sm text-gray-600">Buscando clientes...</div>
                )}
                
                {clientesBusqueda.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                    {clientesBusqueda.map(cliente => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => seleccionarCliente(cliente)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {cliente.nombre_cliente} {cliente.apellido_cliente}
                        </div>
                        <div className="text-sm text-gray-600">{cliente.email} • {cliente.telefono}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ✅ CAMPOS DE CLIENTE CORREGIDOS - SEPARAR NOMBRE Y APELLIDO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={formData.nombre_cliente}
                  onChange={(e) => handleInputChange('nombre_cliente', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.nombre_cliente ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Nombre del cliente"
                />
                {errors.nombre_cliente && (
                  <p className="mt-1 text-sm text-red-600">{errors.nombre_cliente}</p>
                )}
              </div>

              {/* ✅ NUEVO CAMPO - Apellido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido del Cliente
                </label>
                <input
                  type="text"
                  value={formData.apellido_cliente}
                  onChange={(e) => handleInputChange('apellido_cliente', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Apellido del cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa
                </label>
                <input
                  type="text"
                  value={formData.cliente_empresa}
                  onChange={(e) => handleInputChange('cliente_empresa', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre de la empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.cliente_email}
                  onChange={(e) => handleInputChange('cliente_email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.cliente_email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="cliente@email.com"
                />
                {errors.cliente_email && (
                  <p className="mt-1 text-sm text-red-600">{errors.cliente_email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.cliente_telefono}
                  onChange={(e) => handleInputChange('cliente_telefono', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.cliente_telefono ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Número de teléfono"
                />
                {errors.cliente_telefono && (
                  <p className="mt-1 text-sm text-red-600">{errors.cliente_telefono}</p>
                )}
              </div>

              {/* SELECTOR DE UBICACIONES OFICIALES */}
              <div className="md:col-span-3">
                <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center mb-3">
                    <MapPin className="h-5 w-5 text-green-600 mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Ubicación del Cliente</h4>
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      🇵🇪 UBIGEO Oficial
                    </span>
                  </div>

                  <UbicacionesSelector
                    value={{
                      departamento: formData.departamento,
                      provincia: formData.ciudad, // En tu BD ciudad guarda la provincia
                      distrito: formData.distrito
                    }}
                    onChange={(ubicacion) => {
                      // Actualizar los campos del formulario
                      handleInputChange('departamento', ubicacion.departamento);
                      handleInputChange('ciudad', ubicacion.provincia); // Tu BD usa 'ciudad' para provincia
                      handleInputChange('distrito', ubicacion.distrito);
                    }}
                    required={false}
                    showDistrito={true}
                    size="default"
                    placeholder={{
                      departamento: 'Selecciona departamento',
                      provincia: 'Selecciona provincia',
                      distrito: 'Selecciona distrito (opcional)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ✅ AGREGADO - Canal de Contacto */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canal de Contacto *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {canalesPredefinidos.map((canal) => (
                  <button
                    key={canal.codigo}
                    type="button"
                    onClick={() => handleInputChange('canal_contacto', canal.codigo)}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                      formData.canal_contacto === canal.codigo
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg mb-1">{canal.icono}</div>
                      <div>{canal.nombre}</div>
                    </div>
                  </button>
                ))}
              </div>
              {errors.canal_contacto && (
                <p className="mt-1 text-sm text-red-600">{errors.canal_contacto}</p>
              )}
            </div>
          </div>

          {/* SECCIÓN DE PRODUCTOS */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Productos de la Venta
              </h3>
            </div>

            {/* Buscador de productos */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Producto por Código o Descripción
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Escribe código o descripción del producto..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  onFocus={() => setShowProductosDropdown(productosEncontrados.length > 0)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
                {loadingProductos && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>

              {/* Dropdown de productos encontrados */}
              {showProductosDropdown && productosEncontrados.length > 0 && (
                <div className="relative z-10 mt-1">
                  <div className="absolute w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <div className="py-1">
                      {productosEncontrados.map((producto) => (
                        <button
                          key={producto.id}
                          type="button"
                          onClick={() => seleccionarProducto(producto)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                  {producto.codigo}
                                </span>
                                {producto.categoria && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {producto.categoria}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-medium text-gray-900 truncate mb-1">
                                {producto.descripcion}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center">
                                <Building className="h-3 w-3 mr-1" />
                                <span className="mr-3">{producto.marca}</span>
                                <Package className="h-3 w-3 mr-1" />
                                <span>{producto.unidad}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-4 text-right">
                              <div className="text-lg font-bold text-green-600">
                                ${parseFloat(producto.precio_base || 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">por {producto.unidad}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de productos agregados */}
            {formData.productos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="font-medium">No hay productos agregados</p>
                <p className="text-sm">Busca y selecciona productos para la venta</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <div className="col-span-3">Producto</div>
                  <div className="col-span-2">Cantidad</div>
                  <div className="col-span-2">Precio Unit.</div>
                  <div className="col-span-2">Subtotal</div>
                  <div className="col-span-2">Total Línea</div>
                  <div className="col-span-1">Acc.</div>
                </div>
                
                {formData.productos.map((producto) => (
                  <div key={producto.id} className="grid grid-cols-12 gap-3 items-center border border-gray-200 p-4 rounded-lg bg-white shadow-sm">
                    <div className="col-span-3">
                      <div className="flex items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                              {producto.codigo}
                            </span>
                            {producto.categoria && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {producto.categoria}
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-gray-900 truncate text-sm mb-1">
                            {producto.nombre}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <Building className="h-3 w-3 mr-1" />
                            <span className="mr-2">{producto.marca}</span>
                            <Package className="h-3 w-3 mr-1" />
                            <span>{producto.unidad}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={producto.cantidad}
                        onChange={(e) => actualizarProducto(producto.id, 'cantidad', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={producto.precio_unitario}
                        onChange={(e) => actualizarProducto(producto.id, 'precio_unitario', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="text-right font-medium text-gray-900">
                        ${parseFloat(producto.subtotal || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-right font-bold text-green-600">
                        ${parseFloat(producto.total_linea || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => eliminarProducto(producto.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {errors.productos && (
              <p className="mt-2 text-sm text-red-600">{errors.productos}</p>
            )}
          </div>

          {/* Valores y fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descuento (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.descuento_porcentaje}
                    onChange={(e) => handleInputChange('descuento_porcentaje', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descuento (Monto)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.descuento_monto}
                      onChange={(e) => handleInputChange('descuento_monto', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Final *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.valor_final}
                    onChange={(e) => handleInputChange('valor_final', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.valor_final ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.valor_final && (
                  <p className="mt-1 text-sm text-red-600">{errors.valor_final}</p>
                )}
              </div>

              {!formData.es_venta_presencial && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Entrega Estimada
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.fecha_entrega_estimada}
                      onChange={(e) => handleInputChange('fecha_entrega_estimada', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.fecha_entrega_estimada ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.fecha_entrega_estimada && (
                    <p className="mt-1 text-sm text-red-600">{errors.fecha_entrega_estimada}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                  Resumen de Totales
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal productos:</span>
                    <span className="font-medium text-gray-900">${totales.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Con descuentos línea:</span>
                    <span className="font-medium text-gray-900">${totales.totalConDescuentos.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-3 flex justify-between items-center">
                    <span className="font-semibold text-gray-900 text-base">Total final:</span>
                    <span className="font-bold text-xl text-green-600">${totales.total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="mt-4 text-xs text-gray-500">
                  Moneda: {formData.moneda}
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones y notas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas Internas
              </label>
              <textarea
                value={formData.notas_internas}
                onChange={(e) => handleInputChange('notas_internas', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Notas internas del equipo..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condiciones Especiales
              </label>
              <textarea
                value={formData.condiciones_especiales}
                onChange={(e) => handleInputChange('condiciones_especiales', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Condiciones especiales de la venta..."
              />
            </div>

            {formData.es_venta_presencial && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones para Almacén
                  </label>
                  <textarea
                    value={formData.observaciones_almacen}
                    onChange={(e) => handleInputChange('observaciones_almacen', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notas específicas para el área de almacén..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones para Soporte
                  </label>
                  <textarea
                    value={formData.observaciones_soporte}
                    onChange={(e) => handleInputChange('observaciones_soporte', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notas específicas para soporte técnico..."
                  />
                </div>
              </>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {mode === 'edit' ? 'Actualizar Venta' : 'Registrar Venta'}
            </button>
          </div>
        </form>

        {/* Notificaciones */}
        <NotificationComponent />
      </div>
    </div>
  );
};

export default VentaForm;