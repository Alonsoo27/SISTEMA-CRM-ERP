import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../../../config/apiConfig';

const ProductoForm = ({
    isOpen,
    onClose,
    onProductoCreated,
    onProductoUpdated,
    modo = 'crear', // 'crear', 'editar', 'duplicar'
    producto = null
}) => {
    const [formData, setFormData] = useState({
        codigo: '',
        descripcion: '',
        precio_sin_igv: '',
        marca: '',
        categoria_id: '',
        unidad_medida: 'UND', // NUEVO CAMPO CON VALOR POR DEFECTO
        linea_producto: ''     // CAMPO LÍNEA DE PRODUCTO
    });

    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');

    // Opciones de unidad de medida
    const unidadesMedida = [
        { value: 'UND', label: 'UND - Unidades', description: 'Para productos individuales' },
        { value: 'MLL', label: 'MLL - Millares', description: 'Para productos vendidos por millares' }
    ];

    // Generar código automático para duplicados
    const generarCodigoDuplicado = (codigoOriginal) => {
        const timestamp = Date.now().toString().slice(-4);
        const match = codigoOriginal.match(/^(.+?)(\d*)$/);
        if (match) {
            const base = match[1];
            return `${base}${timestamp}`;
        }
        return `${codigoOriginal}_${timestamp}`;
    };

    // Configurar formulario según el modo
    useEffect(() => {
        if (isOpen) {
            cargarCategorias();

            if (modo === 'crear') {
                // Modo crear - formulario vacío
                setFormData({
                    codigo: '',
                    descripcion: '',
                    precio_sin_igv: '',
                    marca: '',
                    categoria_id: '',
                    unidad_medida: 'UND', // DEFAULT
                    linea_producto: ''     // DEFAULT
                });
            } else if (modo === 'editar' && producto) {
                // Modo editar - cargar datos del producto
                setFormData({
                    codigo: producto.codigo || '',
                    descripcion: producto.descripcion || '',
                    precio_sin_igv: producto.precio_sin_igv?.toString() || '',
                    marca: producto.marca || '',
                    categoria_id: producto.categorias?.id || producto.categoria_id || '',
                    unidad_medida: producto.unidad_medida || 'UND', // NUEVO CAMPO
                    linea_producto: producto.linea_producto || ''    // CAMPO LÍNEA DE PRODUCTO
                });
            } else if (modo === 'duplicar' && producto) {
                // Modo duplicar - copiar datos con nuevo código
                setFormData({
                    codigo: generarCodigoDuplicado(producto.codigo || ''),
                    descripcion: producto.descripcion || '',
                    precio_sin_igv: producto.precio_sin_igv?.toString() || '',
                    marca: producto.marca || '',
                    categoria_id: producto.categorias?.id || producto.categoria_id || '',
                    unidad_medida: producto.unidad_medida || 'UND', // NUEVO CAMPO
                    linea_producto: producto.linea_producto || ''    // CAMPO LÍNEA DE PRODUCTO
                });
            }

            setErrors({});
            setSubmitError('');
        }
    }, [isOpen, modo, producto]);

    const cargarCategorias = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/categorias`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
            const data = await response.json();
            if (data.success) {
                setCategorias(data.data);
            }
        } catch (error) {
            console.error('Error al cargar categorías:', error);
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Validar código
        if (!formData.codigo.trim()) {
            newErrors.codigo = 'El código es requerido';
        } else if (formData.codigo.length > 50) {
            newErrors.codigo = 'El código no puede exceder 50 caracteres';
        }

        // Validar descripción
        if (!formData.descripcion.trim()) {
            newErrors.descripcion = 'La descripción es requerida';
        } else if (formData.descripcion.length > 500) {
            newErrors.descripcion = 'La descripción no puede exceder 500 caracteres';
        }

        // Validar precio
        const precio = parseFloat(formData.precio_sin_igv);
        if (!formData.precio_sin_igv || isNaN(precio) || precio <= 0) {
            newErrors.precio_sin_igv = 'El precio debe ser un número mayor a 0';
        }

        // Validar marca
        if (!formData.marca.trim()) {
            newErrors.marca = 'La marca es requerida';
        } else if (formData.marca.length > 100) {
            newErrors.marca = 'La marca no puede exceder 100 caracteres';
        }

        // Validar categoría
        if (!formData.categoria_id) {
            newErrors.categoria_id = 'Debe seleccionar una categoría';
        }

        // NUEVA VALIDACIÓN: Unidad de medida
        if (!formData.unidad_medida) {
            newErrors.unidad_medida = 'Debe seleccionar una unidad de medida';
        } else if (!['UND', 'MLL'].includes(formData.unidad_medida)) {
            newErrors.unidad_medida = 'La unidad de medida no es válida';
        }

        // NUEVA VALIDACIÓN: Línea de producto
        if (!formData.linea_producto.trim()) {
            newErrors.linea_producto = 'La línea de producto es requerida';
        } else if (formData.linea_producto.length > 100) {
            newErrors.linea_producto = 'La línea de producto no puede exceder 100 caracteres';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setSubmitError('');

        try {
            const url = modo === 'editar'
                ? `${API_CONFIG.BASE_URL}/api/productos/${producto.id}`
                : `${API_CONFIG.BASE_URL}/api/productos`;

            const method = modo === 'editar' ? 'PUT' : 'POST';

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    precio_sin_igv: parseFloat(formData.precio_sin_igv)
                })
            });

            const data = await response.json();

            if (data.success) {
                // Notify parent component
                if (modo === 'editar' && onProductoUpdated) {
                    onProductoUpdated(data.data);
                } else if (onProductoCreated) {
                    onProductoCreated(data.data);
                }
                onClose();
            } else {
                setSubmitError(data.error || 'Error al procesar el producto');
            }
        } catch (error) {
            console.error('Error al procesar producto:', error);
            setSubmitError('Error de conexión. Verifique que el servidor esté funcionando.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const getTitulo = () => {
        switch (modo) {
            case 'editar':
                return 'Editar Producto';
            case 'duplicar':
                return 'Duplicar Producto';
            default:
                return 'Agregar Nuevo Producto';
        }
    };

    const getBotonTexto = () => {
        switch (modo) {
            case 'editar':
                return 'Actualizar Producto';
            case 'duplicar':
                return 'Duplicar Producto';
            default:
                return 'Crear Producto';
        }
    };

    const getIcono = () => {
        switch (modo) {
            case 'editar':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                );
            case 'duplicar':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${
                            modo === 'editar' ? 'bg-green-100 text-green-600' :
                            modo === 'duplicar' ? 'bg-purple-100 text-purple-600' :
                            'bg-blue-100 text-blue-600'
                        }`}>
                            {getIcono()}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {getTitulo()}
                            </h3>
                            {(modo === 'editar' || modo === 'duplicar') && producto && (
                                <p className="text-sm text-gray-500">
                                    {modo === 'duplicar' ? 'Basado en: ' : ''}{producto.codigo}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form - Scrolleable */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                    <form onSubmit={handleSubmit} className="p-6">
                        {/* Error general */}
                        {submitError && (
                            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                                {submitError}
                            </div>
                        )}

                        {/* Código */}
                        <div className="mb-4">
                            <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-1">
                                Código *
                                {modo === 'duplicar' && (
                                    <span className="text-xs text-purple-600 ml-2">(Generado automáticamente)</span>
                                )}
                            </label>
                            <input
                                type="text"
                                id="codigo"
                                name="codigo"
                                value={formData.codigo}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.codigo ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Ej: PROD001"
                                disabled={loading}
                            />
                            {errors.codigo && (
                                <p className="text-red-500 text-xs mt-1">{errors.codigo}</p>
                            )}
                        </div>

                        {/* Descripción */}
                        <div className="mb-4">
                            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción *
                            </label>
                            <textarea
                                id="descripcion"
                                name="descripcion"
                                value={formData.descripcion}
                                onChange={handleInputChange}
                                rows={3}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                    errors.descripcion ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Descripción detallada del producto"
                                disabled={loading}
                            />
                            {errors.descripcion && (
                                <p className="text-red-500 text-xs mt-1">{errors.descripcion}</p>
                            )}
                        </div>

                        {/* Precio y Unidad de Medida - En dos columnas */}
                        <div className="mb-4 grid grid-cols-2 gap-3">
                            {/* Precio */}
                            <div>
                                <label htmlFor="precio_sin_igv" className="block text-sm font-medium text-gray-700 mb-1">
                                    Precio (USD) *
                                </label>
                                <input
                                    type="number"
                                    id="precio_sin_igv"
                                    name="precio_sin_igv"
                                    value={formData.precio_sin_igv}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.precio_sin_igv ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="0.00"
                                    disabled={loading}
                                />
                                {errors.precio_sin_igv && (
                                    <p className="text-red-500 text-xs mt-1">{errors.precio_sin_igv}</p>
                                )}
                            </div>

                            {/* NUEVO CAMPO: Unidad de Medida */}
                            <div>
                                <label htmlFor="unidad_medida" className="block text-sm font-medium text-gray-700 mb-1">
                                    Unidad *
                                </label>
                                <select
                                    id="unidad_medida"
                                    name="unidad_medida"
                                    value={formData.unidad_medida}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.unidad_medida ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    disabled={loading}
                                >
                                    {unidadesMedida.map((unidad) => (
                                        <option key={unidad.value} value={unidad.value}>
                                            {unidad.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.unidad_medida && (
                                    <p className="text-red-500 text-xs mt-1">{errors.unidad_medida}</p>
                                )}
                            </div>
                        </div>

                        {/* Info sobre unidades de medida */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Unidades de Medida:</h4>
                            <ul className="text-xs text-blue-700 space-y-1">
                                <li><strong>UND:</strong> Para productos individuales (máquinas, frascos, etc.)</li>
                                <li><strong>MLL:</strong> Para productos vendidos por millares (vasos, copas, etc.)</li>
                            </ul>
                        </div>

                        {/* Marca y Línea de Producto - En dos columnas */}
                        <div className="mb-4 grid grid-cols-2 gap-3">
                            {/* Marca */}
                            <div>
                                <label htmlFor="marca" className="block text-sm font-medium text-gray-700 mb-1">
                                    Marca *
                                </label>
                                <input
                                    type="text"
                                    id="marca"
                                    name="marca"
                                    value={formData.marca}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.marca ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Ej: Sony, Samsung"
                                    disabled={loading}
                                />
                                {errors.marca && (
                                    <p className="text-red-500 text-xs mt-1">{errors.marca}</p>
                                )}
                            </div>

                            {/* Línea de Producto */}
                            <div>
                                <label htmlFor="linea_producto" className="block text-sm font-medium text-gray-700 mb-1">
                                    Línea de Producto *
                                </label>
                                <input
                                    type="text"
                                    id="linea_producto"
                                    name="linea_producto"
                                    value={formData.linea_producto}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.linea_producto ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Ej: Electrónicos, Hogar"
                                    disabled={loading}
                                />
                                {errors.linea_producto && (
                                    <p className="text-red-500 text-xs mt-1">{errors.linea_producto}</p>
                                )}
                            </div>
                        </div>

                        {/* Categoría */}
                        <div className="mb-6">
                            <label htmlFor="categoria_id" className="block text-sm font-medium text-gray-700 mb-1">
                                Categoría *
                            </label>
                            <select
                                id="categoria_id"
                                name="categoria_id"
                                value={formData.categoria_id}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.categoria_id ? 'border-red-500' : 'border-gray-300'
                                }`}
                                disabled={loading}
                            >
                                <option value="">Seleccionar categoría</option>
                                {categorias.map((categoria) => (
                                    <option key={categoria.id} value={categoria.id}>
                                        {categoria.nombre}
                                    </option>
                                ))}
                            </select>
                            {errors.categoria_id && (
                                <p className="text-red-500 text-xs mt-1">{errors.categoria_id}</p>
                            )}
                        </div>
                    </form>
                </div>

                {/* Footer - Buttons */}
                <div className="p-4 border-t bg-gray-50 flex space-x-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`flex-1 px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 flex items-center justify-center ${
                            modo === 'editar' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' :
                            modo === 'duplicar' ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' :
                            'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        }`}
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            getBotonTexto()
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductoForm;
