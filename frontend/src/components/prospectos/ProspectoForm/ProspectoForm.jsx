// src/components/prospectos/ProspectoForm/ProspectoForm.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Save, Phone, Mail, Building, MapPin, DollarSign,
  Calendar, User, AlertCircle, CheckCircle, Plus, Trash2,
  Search, Package, Tag, FileText
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import productosService from '../../../services/productosService';
import { useProspectoData } from '../../../hooks/useProspectoData';
import { serializarProductosParaEnvio } from '../../../utils/productosUtils';
import UbicacionesSelector from '../../ui/UbicacionesSelector';
import ModalConfirmarDuplicado from '../ModalConfirmarDuplicado';

const ProspectoForm = ({ prospecto = null, onClose, onSave, mode = 'create' }) => {
  const prospectoNormalizado = useProspectoData(prospecto);
  const [formData, setFormData] = useState({
    nombre_cliente: '',
    apellido_cliente: '',
    telefono: '',
    email: '',
    empresa: '',
    direccion: '',
    distrito: '',
    ciudad: 'Lima',
    departamento: '',
    canal_contacto: 'WhatsApp',
    productos_interes: [],
    presupuesto_estimado: '',
    valor_estimado: '',
    probabilidad_cierre: 50,
    observaciones: '',
    fecha_seguimiento: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [canales, setCanales] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState('');
  const [verificandoDuplicado, setVerificandoDuplicado] = useState(false);
  const [duplicadoEncontrado, setDuplicadoEncontrado] = useState(null);

  // Estados para validación avanzada de duplicados
  const [modalDuplicadoOpen, setModalDuplicadoOpen] = useState(false);
  const [validacionDuplicado, setValidacionDuplicado] = useState(null);
  const [intentoCrear, setIntentoCrear] = useState(null);

  // Estados para búsqueda de productos reales
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [productosEncontrados, setProductosEncontrados] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [showProductosDropdown, setShowProductosDropdown] = useState(false);

  // Canales de contacto predefinidos
  const canalesPredefinidos = [
    { codigo: 'WhatsApp', nombre: 'WhatsApp', icono: '📱' },
    { codigo: 'Messenger', nombre: 'Facebook Messenger', icono: '💬' },
    { codigo: 'Facebook', nombre: 'Facebook', icono: '📘' },
    { codigo: 'TikTok', nombre: 'TikTok', icono: '🎵' },
    { codigo: 'Llamada', nombre: 'Llamada Telefónica', icono: '📞' },
    { codigo: 'Presencial', nombre: 'Visita Presencial', icono: '🏢' },
    { codigo: 'Email', nombre: 'Correo Electrónico', icono: '📧' }
  ];

  // Función para parsear productos legacy
  const parsearProductosInteres = (productos) => {
    if (!productos) return [];
    
    if (Array.isArray(productos)) {
      return productos.map(producto => {
        if (typeof producto === 'string') {
          try {
            return JSON.parse(producto);
          } catch (e) {
            return producto; // Mantener como string si no se puede parsear
          }
        }
        return producto;
      });
    }
    
    return [];
  };

  // Agregar esta función antes del useEffect existente
const cargarDatosProspectoCompletos = async (prospectoId) => {
  try {
    setLoading(true);
    const response = await prospectosService.obtenerPorId(prospectoId);
    
    if (response.success) {
      const datos = response.data;
      setFormData({
        nombre_cliente: datos.nombre_cliente || '',
        apellido_cliente: datos.apellido_cliente || '',
        telefono: datos.telefono || '',
        email: datos.email || '',
        empresa: datos.empresa || '',
        direccion: datos.direccion || '',
        distrito: datos.distrito || '',
        ciudad: datos.ciudad || 'Lima',
        departamento: datos.departamento || '',
        canal_contacto: datos.canal_contacto || 'WhatsApp',
        productos_interes: datos.productos_interes || [],
        presupuesto_estimado: datos.presupuesto_estimado || '',
        valor_estimado: datos.valor_estimado || '',
        probabilidad_cierre: datos.probabilidad_cierre || 50,
        observaciones: datos.observaciones || '',
        fecha_seguimiento: datos.fecha_seguimiento ?
          new Date(datos.fecha_seguimiento).toISOString().slice(0, 16) : ''
      });
    }
  } catch (error) {
    console.error('Error cargando datos del prospecto:', error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  if (mode === 'edit' && prospecto?.id) {
    // Cargar datos frescos del servidor cuando se edita
    cargarDatosProspectoCompletos(prospecto.id);
  } else if (prospectoNormalizado && mode === 'edit') {
    setFormData({
      nombre_cliente: prospectoNormalizado.nombre_cliente || '',
      apellido_cliente: prospectoNormalizado.apellido_cliente || '',
      telefono: prospectoNormalizado.telefono || '',
      email: prospectoNormalizado.email || '',
      empresa: prospectoNormalizado.empresa || '',
      direccion: prospectoNormalizado.direccion || '',
      distrito: prospectoNormalizado.distrito || '',
      ciudad: prospectoNormalizado.ciudad || 'Lima',
      departamento: prospectoNormalizado.departamento || '',
      canal_contacto: prospectoNormalizado.canal_contacto || 'WhatsApp',
      productos_interes: prospectoNormalizado.productos_interes || [],
      presupuesto_estimado: prospectoNormalizado.presupuesto_estimado || '',
      valor_estimado: prospectoNormalizado.valor_estimado || '',
      probabilidad_cierre: prospectoNormalizado.probabilidad_cierre || 50,
      observaciones: prospectoNormalizado.observaciones || '',
      fecha_seguimiento: prospectoNormalizado.fecha_seguimiento ?
        new Date(prospectoNormalizado.fecha_seguimiento).toISOString().slice(0, 16) : ''
    });
  }
  cargarCanales();
}, [prospectoNormalizado, mode, prospecto?.id]);

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

  // useEffect para verificar duplicados con debounce
  useEffect(() => {
    if (formData.telefono && formData.telefono.length >= 9) {
      const timeoutId = setTimeout(() => {
        verificarDuplicado(formData.telefono);
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setDuplicadoEncontrado(null);
    }
  }, [formData.telefono, mode, prospecto?.id]);

  // Actualización automática del valor estimado cuando cambian los productos
  useEffect(() => {
    const tieneProductosConPrecio = formData.productos_interes.some(producto => 
      typeof producto === 'object' && producto.precio_sin_igv && producto.precio_sin_igv > 0
    );
    
    if (tieneProductosConPrecio) {
      const valorCalculado = calcularValorTotalEstimado();
      setFormData(prev => ({
        ...prev,
        valor_estimado: valorCalculado.toString()
      }));
    }
  }, [formData.productos_interes]);

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

  const cargarCanales = async () => {
    try {
      const response = await prospectosService.obtenerCanales();
      setCanales(response.data?.canales || canalesPredefinidos);
    } catch (err) {
      console.log('Usando canales predefinidos:', err.message);
      setCanales(canalesPredefinidos);
    }
  };

  const validarFormulario = () => {
    const newErrors = {};

    if (!formData.nombre_cliente.trim()) {
      newErrors.nombre_cliente = 'El nombre es requerido';
    }

    if (!formData.apellido_cliente.trim()) {
      newErrors.apellido_cliente = 'El apellido es requerido';
    }

    if (!formData.telefono.trim()) {
      newErrors.telefono = 'El teléfono es requerido';
    } else if (!/^\+?[0-9\s\-\(\)]+$/.test(formData.telefono)) {
      newErrors.telefono = 'Formato de teléfono inválido';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Formato de email inválido';
    }

    if (!formData.canal_contacto) {
      newErrors.canal_contacto = 'Seleccione un canal de contacto';
    }

    if (!formData.departamento.trim()) {
      newErrors.departamento = 'El departamento es requerido';
    }

    if (formData.presupuesto_estimado && isNaN(formData.presupuesto_estimado)) {
      newErrors.presupuesto_estimado = 'Debe ser un número válido';
    }

    if (formData.valor_estimado && isNaN(formData.valor_estimado)) {
      newErrors.valor_estimado = 'Debe ser un número válido';
    }

    if (formData.probabilidad_cierre < 0 || formData.probabilidad_cierre > 100) {
      newErrors.probabilidad_cierre = 'Debe ser entre 0 y 100';
    }

    // Validar cantidades de productos
    const productosInvalidos = formData.productos_interes.filter(producto => {
      if (typeof producto === 'object' && producto.tipo === 'catalogo' && producto.precio_sin_igv) {
        const cantidad = parseFloat(producto.cantidad_estimada);
        return isNaN(cantidad) || cantidad < 0.0001;
      }
      return false;
    });

    if (productosInvalidos.length > 0) {
      newErrors.productos_interes = 'Todos los productos deben tener una cantidad válida (mínimo 0.0001)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const verificarDuplicado = async (telefono) => {
    if (!telefono || telefono.length < 9) return;

    try {
      setVerificandoDuplicado(true);
      const response = await prospectosService.verificarDuplicado(
        telefono, 
        mode === 'edit' ? prospecto?.id : null
      );
      
      if (response.data?.existe) {
        setDuplicadoEncontrado(response.data.prospecto);
      } else {
        setDuplicadoEncontrado(null);
      }
    } catch (err) {
      console.error('Error verificando duplicado:', err);
    } finally {
      setVerificandoDuplicado(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // FUNCIÓN CORREGIDA - Formatear precio con fallback mejorado
  const formatearPrecio = (precio) => {
    if (!precio || isNaN(precio)) return '0.00';
    
    const numero = parseFloat(precio);
    if (numero === 0) return '0.00';
    
    if (typeof productosService.formatearPrecio === 'function') {
      return productosService.formatearPrecio(numero);
    }
    
    // Fallback mejorado
    return numero.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // FUNCIÓN CORREGIDA - Calcular valor total estimado
  const calcularValorTotalEstimado = () => {
    return formData.productos_interes.reduce((total, producto) => {
      if (typeof producto === 'object' && producto.precio_sin_igv) {
        const precio = parseFloat(producto.precio_sin_igv) || 0;
        const cantidad = parseFloat(producto.cantidad_estimada) || 1;
        const valorLinea = precio * cantidad;
        return total + valorLinea;
      }
      return total;
    }, 0);
  };

  // FUNCIÓN CORREGIDA - Actualizar cantidad de producto
  const actualizarCantidadProducto = (productoId, nuevaCantidad) => {
    // Mantener como string para permitir edición fluida (incluyendo "0", "0.", etc)
    setFormData(prev => ({
      ...prev,
      productos_interes: prev.productos_interes.map(producto => {
        if (typeof producto === 'object' && producto.id === productoId) {
          const precio = parseFloat(producto.precio_sin_igv) || 0;
          const cantidadCalculo = parseFloat(nuevaCantidad) || 0;
          const valorLinea = precio * cantidadCalculo;
          return {
            ...producto,
            cantidad_estimada: nuevaCantidad, // Mantener como string
            valor_linea: valorLinea
          };
        }
        return producto;
      })
    }));
  };

  // FUNCIÓN MEJORADA - Agregar producto desde búsqueda
  const agregarProductoDesdeSearch = (producto) => {
    // Verificar si el producto ya existe
    const yaExiste = formData.productos_interes.some(p => 
      (typeof p === 'object' && p.codigo === producto.codigo) || 
      (typeof p === 'string' && p.includes(producto.codigo))
    );

    if (yaExiste) {
      alert('Este producto ya está agregado');
      return;
    }

    const nuevoProducto = {
      id: Date.now(),
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion_producto: producto.descripcion,
      marca: producto.marca,
      categoria: producto.categoria,
      unidad_medida: producto.unidad,
      precio_sin_igv: parseFloat(producto.precio_base) || 0,
      cantidad_estimada: 1,
      valor_linea: parseFloat(producto.precio_base) || 0,
      tipo: 'catalogo'
    };
    
    setFormData(prev => ({
      ...prev,
      productos_interes: [...prev.productos_interes, nuevoProducto]
    }));
    
    setBusquedaProducto('');
    setProductosEncontrados([]);
    setShowProductosDropdown(false);
  };

  // FUNCIÓN MEJORADA - Agregar producto personalizado
  const agregarProducto = () => {
    if (!nuevoProducto.trim()) return;

    // Verificar si el producto personalizado ya existe
    const yaExiste = formData.productos_interes.some(p => 
      p.tipo === 'personalizado' && p.descripcion_producto === nuevoProducto.trim()
    );

    if (yaExiste) {
      alert('Este producto personalizado ya está agregado');
      return;
    }

    const productoPersonalizado = {
      id: Date.now(),
      codigo: null,
      descripcion_producto: nuevoProducto.trim(),
      precio_sin_igv: null,
      cantidad_estimada: 1,
      valor_linea: 0,
      tipo: 'personalizado'
    };

    setFormData(prev => ({
      ...prev,
      productos_interes: [...prev.productos_interes, productoPersonalizado]
    }));
    
    setNuevoProducto('');
  };

  const removerProducto = (index) => {
    setFormData(prev => ({
      ...prev,
      productos_interes: prev.productos_interes.filter((_, i) => i !== index)
    }));
  };

  const calcularFechaSeguimiento = () => {
    const ahora = new Date();
    ahora.setDate(ahora.getDate() + 1);
    ahora.setHours(9, 0, 0, 0);
    return ahora.toISOString().slice(0, 16);
  };

  // FUNCIÓN MEJORADA - Obtener nombre del producto para mostrar
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) return;

    try {
      setLoading(true);

      const dataToSend = {
        ...formData,
        presupuesto_estimado: formData.presupuesto_estimado ?
          parseFloat(formData.presupuesto_estimado) : null,
        valor_estimado: formData.valor_estimado ?
          parseFloat(formData.valor_estimado) : null,
        fecha_seguimiento: formData.fecha_seguimiento ||
          (mode === 'create' ? calcularFechaSeguimiento() : null),
        productos_interes: serializarProductosParaEnvio(formData.productos_interes)
      };

      // MODO EDICIÓN: Actualizar directamente
      if (mode === 'edit' && prospecto) {
        const response = await prospectosService.actualizar(prospecto.id, dataToSend);
        if (response.success) {
          onSave?.(response.data);
          onClose();
        }
        return;
      }

      // MODO CREACIÓN: Validación avanzada de duplicados
      if (mode === 'create') {
        // Preparar productos para validación (solo códigos)
        const productosParaValidar = formData.productos_interes
          .map(p => {
            if (typeof p === 'object' && p.codigo) {
              return {
                codigo_producto: p.codigo,
                descripcion: p.descripcion_producto
              };
            }
            return null;
          })
          .filter(p => p !== null);

        // 1. Validar duplicado avanzado
        const validacion = await prospectosService.validarDuplicadoAvanzado(
          formData.telefono,
          productosParaValidar
        );

        // 2. Verificar si requiere confirmación (Escenario B: ADVERTIR)
        if (validacion.requires_confirmation) {
          // Guardar el intento para usar después de la confirmación
          setIntentoCrear(dataToSend);
          setValidacionDuplicado(validacion);
          setModalDuplicadoOpen(true);
          setLoading(false);
          return;
        }

        // 3. Si no requiere confirmación, crear directamente (Escenarios A, D, NUEVO)
        const response = await prospectosService.crear(dataToSend);
        if (response.success) {
          onSave?.(response.data);
          onClose();
        }
      }
    } catch (err) {
      // Manejar errores de bloqueo (Escenario C)
      if (err.response?.status === 409) {
        const errorData = err.response.data;
        setValidacionDuplicado({
          escenario: 'C_BLOQUEAR_PRODUCTO_AVANZADO',
          mensaje: errorData.error || 'No se puede crear el prospecto',
          motivo_bloqueo: errorData.motivo_bloqueo
        });
        setModalDuplicadoOpen(true);
        setLoading(false);
        return;
      }

      alert(`Error ${mode === 'edit' ? 'actualizando' : 'creando'} prospecto: ${err.message}`);
    } finally {
      if (mode === 'edit') {
        setLoading(false);
      }
    }
  };

  // Manejar confirmación de duplicado
  const handleConfirmarDuplicado = async () => {
    if (!intentoCrear) return;

    try {
      setLoading(true);

      // Crear con confirmación explícita
      const response = await prospectosService.crearConConfirmacion(intentoCrear, true);

      if (response.success) {
        onSave?.(response.data);
        onClose();
      }
    } catch (err) {
      alert(`Error creando prospecto: ${err.message}`);
    } finally {
      setLoading(false);
      setModalDuplicadoOpen(false);
      setValidacionDuplicado(null);
      setIntentoCrear(null);
    }
  };

  // Manejar cancelación del modal
  const handleCancelarDuplicado = () => {
    setModalDuplicadoOpen(false);
    setValidacionDuplicado(null);
    setIntentoCrear(null);
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Mejorado - Sticky */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-b px-6 py-4 flex items-center justify-between rounded-t-lg z-10 shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'edit' ? '✏️ Editar Prospecto' : '✨ Nuevo Prospecto'}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              {mode === 'edit' ? 'Actualiza la información del prospecto' : 'Registra un nuevo cliente potencial'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información del Cliente - Diseño Mejorado */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
              <div className="bg-blue-600 p-2 rounded-lg mr-3">
                <User className="h-5 w-5 text-white" />
              </div>
              Información del Cliente
            </h3>
            <p className="text-sm text-gray-600 mb-4 ml-12">Datos básicos del prospecto</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <User className="h-4 w-4 mr-1.5 text-blue-600" />
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre_cliente}
                  onChange={(e) => handleInputChange('nombre_cliente', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all ${
                    errors.nombre_cliente ? 'border-red-300 ring-2 ring-red-200' : 'border-gray-300 hover:border-blue-300'
                  }`}
                  placeholder="Nombre del cliente"
                />
                {errors.nombre_cliente && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.nombre_cliente}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <User className="h-4 w-4 mr-1.5 text-blue-600" />
                  Apellido *
                </label>
                <input
                  type="text"
                  value={formData.apellido_cliente}
                  onChange={(e) => handleInputChange('apellido_cliente', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all ${
                    errors.apellido_cliente ? 'border-red-300 ring-2 ring-red-200' : 'border-gray-300 hover:border-blue-300'
                  }`}
                  placeholder="Apellido del cliente"
                />
                {errors.apellido_cliente && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.apellido_cliente}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Phone className="h-4 w-4 mr-1.5 text-green-600" />
                  Teléfono *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Phone className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all ${
                      errors.telefono ? 'border-red-300 ring-2 ring-red-200' : 'border-gray-300 hover:border-blue-300'
                    }`}
                    placeholder="+51 999 999 999"
                  />
                  {verificandoDuplicado && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
                {errors.telefono && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.telefono}
                  </p>
                )}
                {duplicadoEncontrado && (
                  <div className="mt-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg shadow-sm">
                    <div className="flex items-start">
                      <AlertCircle className="h-4 w-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-800">Prospecto existente</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          {duplicadoEncontrado.nombre_cliente} ({duplicadoEncontrado.codigo})
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Mail className="h-4 w-4 mr-1.5 text-purple-600" />
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all ${
                      errors.email ? 'border-red-300 ring-2 ring-red-200' : 'border-gray-300 hover:border-blue-300'
                    }`}
                    placeholder="cliente@empresa.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Building className="h-4 w-4 mr-1.5 text-indigo-600" />
                  Empresa <span className="text-gray-400 font-normal text-xs ml-1">(Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Building className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.empresa}
                    onChange={(e) => handleInputChange('empresa', e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-blue-300 transition-all"
                    placeholder="Nombre de la empresa"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ubicación - Diseño Mejorado */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
              <div className="bg-green-600 p-2 rounded-lg mr-3">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              Ubicación
            </h3>
            <p className="text-sm text-gray-600 mb-4 ml-12">Localización del prospecto</p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación *
              </label>
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
                required={true}
                showDistrito={true}
                size="default"
                placeholder={{
                  departamento: 'Selecciona departamento',
                  provincia: 'Selecciona provincia',
                  distrito: 'Selecciona distrito (opcional)'
                }}
              />
              {errors.departamento && (
                <p className="text-red-500 text-xs mt-1">{errors.departamento}</p>
              )}
            </div>
          </div>

          {/* Canal de Contacto - Diseño Mejorado */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
              <div className="bg-purple-600 p-2 rounded-lg mr-3">
                <Phone className="h-5 w-5 text-white" />
              </div>
              Canal de Contacto
            </h3>
            <p className="text-sm text-gray-600 mb-4 ml-12">¿Cómo te contactó el cliente? *</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {canales.map((canal) => (
                <button
                  key={canal.codigo}
                  type="button"
                  onClick={() => handleInputChange('canal_contacto', canal.codigo)}
                  className={`p-4 border-2 rounded-xl text-sm font-semibold transition-all transform hover:scale-105 ${
                    formData.canal_contacto === canal.codigo
                      ? 'border-purple-500 bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-300/50'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md text-gray-700'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">{canal.icono}</div>
                    <div className="text-xs">{canal.nombre}</div>
                  </div>
                </button>
              ))}
            </div>
            {errors.canal_contacto && (
              <p className="text-red-600 text-xs mt-2 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.canal_contacto}
              </p>
            )}
          </div>

          {/* Productos de Interés - Diseño Mejorado */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border-2 border-orange-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
              <div className="bg-orange-600 p-2 rounded-lg mr-3">
                <Package className="h-5 w-5 text-white" />
              </div>
              Productos de Interés
            </h3>
            <p className="text-sm text-gray-600 mb-4 ml-12">Productos que interesan al prospecto</p>
            
            {/* Buscador de productos del catálogo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar en Catálogo de Productos
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por código o descripción..."
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
                  <div className="absolute w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="py-1">
                      {productosEncontrados.map((producto) => (
                        <button
                          key={producto.id}
                          type="button"
                          onClick={() => agregarProductoDesdeSearch(producto)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
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
                              <div className="text-sm font-bold text-green-600">
                                ${formatearPrecio(producto.precio_base)}
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

            {/* Agregar producto personalizado */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={nuevoProducto}
                onChange={(e) => setNuevoProducto(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Agregar producto personalizado"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), agregarProducto())}
              />
              <button
                type="button"
                onClick={agregarProducto}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Lista de productos */}
            {formData.productos_interes.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    Productos seleccionados ({formData.productos_interes.length}):
                  </p>
                  <div className="text-sm font-semibold text-blue-600">
                    Total estimado: ${formatearPrecio(calcularValorTotalEstimado())}
                  </div>
                </div>
                {formData.productos_interes.map((producto, index) => (
                  <div key={index} className="bg-white px-4 py-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1 min-w-0">
                        <Package className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          {/* Nombre del producto CORREGIDO */}
                          <div className="text-sm font-medium text-gray-900">
                            {obtenerNombreProducto(producto)}
                          </div>
                          
                          {/* Información adicional para productos del catálogo */}
                          {typeof producto === 'object' && producto.tipo === 'catalogo' && (
                            <div className="flex items-center space-x-4">
                              {/* Cantidad estimada editable */}
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">Cantidad:</span>
                                <input
                                  type="number"
                                  min="0.0001"
                                  step="0.0001"
                                  value={producto.cantidad_estimada ?? ''}
                                  onChange={(e) => actualizarCantidadProducto(producto.id, e.target.value)}
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              
                              {/* Precio unitario CORREGIDO */}
                              <div className="text-xs text-gray-600">
                                x ${formatearPrecio(producto.precio_sin_igv)} / {producto.unidad_medida}
                              </div>
                              
                              {/* Valor línea */}
                              <div className="text-xs font-semibold text-green-600">
                                = ${formatearPrecio(producto.valor_linea || 0)}
                              </div>
                            </div>
                          )}
                          
                          {/* Productos personalizados */}
                          {typeof producto === 'object' && producto.tipo === 'personalizado' && (
                            <div className="text-xs text-gray-500 italic">
                              Producto personalizado - Precio a definir en venta
                            </div>
                          )}
                          
                          {/* Retrocompatibilidad para strings */}
                          {typeof producto === 'string' && (
                            <div className="text-xs text-gray-500 italic">
                              Producto legacy - Considerar reemplazar
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Botón eliminar */}
                      <button
                        type="button"
                        onClick={() => removerProducto(index)}
                        className="ml-3 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No hay productos de interés agregados</p>
                <p className="text-xs">Busca en el catálogo o agrega productos personalizados</p>
              </div>
            )}

            {/* Mensaje de error de validación */}
            {errors.productos_interes && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errors.productos_interes}
                </p>
              </div>
            )}
          </div>

          {/* Valores y Seguimiento - Diseño Mejorado */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border-2 border-emerald-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
              <div className="bg-emerald-600 p-2 rounded-lg mr-3">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              Valores y Seguimiento
            </h3>
            <p className="text-sm text-gray-600 mb-4 ml-12">Estimaciones y programación</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Presupuesto Estimado
                </label>
                <input
                  type="number"
                  value={formData.presupuesto_estimado}
                  onChange={(e) => handleInputChange('presupuesto_estimado', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.presupuesto_estimado ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="5000"
                />
                {errors.presupuesto_estimado && (
                  <p className="text-red-500 text-xs mt-1">{errors.presupuesto_estimado}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Estimado
                  {formData.productos_interes.length > 0 && (
                    <span className="text-xs text-blue-600 ml-2">(Calculado)</span>
                  )}
                </label>
                <input
                  type="number"
                  value={formData.valor_estimado}
                  onChange={(e) => handleInputChange('valor_estimado', e.target.value)}
                  disabled={formData.productos_interes.some(p => typeof p === 'object' && p.precio_sin_igv)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formData.productos_interes.some(p => typeof p === 'object' && p.precio_sin_igv) ? 'bg-gray-100 cursor-not-allowed' : ''
                  } ${
                    errors.valor_estimado ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={formData.productos_interes.length > 0 ? "Calculado desde productos" : "4500"}
                />
                {errors.valor_estimado && (
                  <p className="text-red-500 text-xs mt-1">{errors.valor_estimado}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Probabilidad de Cierre (%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.probabilidad_cierre}
                  onChange={(e) => handleInputChange('probabilidad_cierre', e.target.value)}
                  className="w-full"
                />
                <div className="text-center text-sm text-gray-600 mt-1">
                  {formData.probabilidad_cierre}%
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Seguimiento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value={formData.fecha_seguimiento}
                    onChange={(e) => handleInputChange('fecha_seguimiento', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones - Diseño Mejorado */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-xl border-2 border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-2 text-gray-600" />
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => handleInputChange('observaciones', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-blue-300 transition-all resize-none"
              placeholder="💬 Información adicional sobre el prospecto, necesidades específicas, preferencias..."
            />
          </div>

          {/* Botones - Diseño Mejorado */}
          <div className="flex justify-end space-x-3 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold flex items-center"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-semibold shadow-lg shadow-blue-300/50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  {mode === 'edit' ? (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Actualizar Prospecto
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Crear Prospecto
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Modal de confirmación de duplicados */}
        <ModalConfirmarDuplicado
          open={modalDuplicadoOpen}
          onClose={handleCancelarDuplicado}
          onConfirm={handleConfirmarDuplicado}
          datosValidacion={validacionDuplicado}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default ProspectoForm;