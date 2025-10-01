import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Save,
    AlertTriangle,
    Package,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Info,
    Calculator,
    ArrowRightLeft,
    Settings,
    Repeat,
    Plus
} from 'lucide-react';
import almacenService from '../../../services/almacenService';

const InventarioForm = ({
    isOpen,
    onClose,
    inventarioItem = null,
    onSuccess
}) => {
    const [tipoOperacion, setTipoOperacion] = useState('ajuste'); // 'ajuste', 'transferencia', 'transformacion'
    const [almacenesDisponibles, setAlmacenesDisponibles] = useState([]);
    const [formData, setFormData] = useState({
        stock_actual: '',
        stock_minimo: '',
        stock_maximo: '',
        costo_promedio: '',
        motivo: '',
        // Campos para transferencia
        almacen_origen_id: '',
        almacen_destino_id: '',
        cantidad_transferir: '',
        // Campos para transformación
        cantidad_transformar: '',
        producto_resultado_id: '',
        almacen_transformacion_id: '',
        // Campo para nuevo inventario
        almacen_seleccionado: ''
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [stockOriginal, setStockOriginal] = useState(0);
    const [showCalculadora, setShowCalculadora] = useState(false);

    useEffect(() => {
        if (isOpen && inventarioItem) {
            // Si es un nuevo inventario, establecer tipo de operación como ajuste y requerir selección de almacén
            if (inventarioItem.esNuevoInventario) {
                setTipoOperacion('ajuste');
                setFormData({
                    stock_actual: '',
                    stock_minimo: '0',
                    stock_maximo: '',
                    costo_promedio: '',
                    motivo: 'Agregando producto inicial al inventario',
                    // Inicializar campos de transferencia
                    almacen_origen_id: '',
                    almacen_destino_id: '',
                    cantidad_transferir: '',
                    // Inicializar campos de transformación
                    cantidad_transformar: '',
                    producto_resultado_id: '',
                    almacen_transformacion_id: '',
                    // Campo especial para nuevo inventario
                    almacen_seleccionado: ''
                });
            } else {
                setFormData({
                    stock_actual: inventarioItem.stock_actual?.toString() || '0',
                    stock_minimo: inventarioItem.stock_minimo?.toString() || '0',
                    stock_maximo: inventarioItem.stock_maximo?.toString() || '',
                    costo_promedio: inventarioItem.costo_promedio?.toString() || '',
                    motivo: '',
                    // Inicializar campos de transferencia
                    almacen_origen_id: inventarioItem.almacen_id || '',
                    almacen_destino_id: '',
                    cantidad_transferir: '',
                    // Inicializar campos de transformación
                    cantidad_transformar: '',
                    producto_resultado_id: '',
                    almacen_transformacion_id: inventarioItem.almacen_id || '',
                    almacen_seleccionado: inventarioItem.almacen_id || ''
                });
            }
            setStockOriginal(Number(inventarioItem.stock_actual) || 0);
            setErrors({});
            cargarAlmacenesDisponibles();
        }
    }, [isOpen, inventarioItem]);

    const cargarAlmacenesDisponibles = async () => {
        try {
            const response = await almacenService.obtenerAlmacenes();
            if (response.success) {
                setAlmacenesDisponibles(response.data);
            }
        } catch (error) {
            console.error('Error cargando almacenes:', error);
        }
    };

    const handleInputChange = (campo, valor) => {
        setFormData(prev => ({
            ...prev,
            [campo]: valor
        }));

        // Limpiar error del campo al modificarlo
        if (errors[campo]) {
            setErrors(prev => ({
                ...prev,
                [campo]: null
            }));
        }
    };

    const validarFormulario = () => {
        const nuevosErrores = {};

        if (tipoOperacion === 'ajuste') {
            // Para nuevos inventarios, validar almacén seleccionado
            if (inventarioItem?.esNuevoInventario && !formData.almacen_seleccionado) {
                nuevosErrores.almacen_seleccionado = 'Debe seleccionar un almacén';
            }

            // Validar stock actual
            if (!formData.stock_actual || isNaN(Number(formData.stock_actual))) {
                nuevosErrores.stock_actual = 'Stock actual es requerido y debe ser un número';
            } else if (Number(formData.stock_actual) < 0) {
                nuevosErrores.stock_actual = 'Stock actual no puede ser negativo';
            }

            // Validar stock mínimo
            if (!formData.stock_minimo || isNaN(Number(formData.stock_minimo))) {
                nuevosErrores.stock_minimo = 'Stock mínimo es requerido y debe ser un número';
            } else if (Number(formData.stock_minimo) < 0) {
                nuevosErrores.stock_minimo = 'Stock mínimo no puede ser negativo';
            }

            // Validar stock máximo (opcional)
            if (formData.stock_maximo && (isNaN(Number(formData.stock_maximo)) || Number(formData.stock_maximo) < 0)) {
                nuevosErrores.stock_maximo = 'Stock máximo debe ser un número positivo';
            }

            if (formData.stock_maximo && Number(formData.stock_maximo) < Number(formData.stock_minimo)) {
                nuevosErrores.stock_maximo = 'Stock máximo no puede ser menor al stock mínimo';
            }

            // Validar costo promedio (opcional)
            if (formData.costo_promedio && (isNaN(Number(formData.costo_promedio)) || Number(formData.costo_promedio) < 0)) {
                nuevosErrores.costo_promedio = 'Costo promedio debe ser un número positivo';
            }
        } else if (tipoOperacion === 'transferencia') {
            // Validar transferencia
            if (!formData.almacen_origen_id) {
                nuevosErrores.almacen_origen_id = 'Debe seleccionar el almacén origen';
            }
            if (!formData.almacen_destino_id) {
                nuevosErrores.almacen_destino_id = 'Debe seleccionar el almacén destino';
            }
            if (formData.almacen_origen_id === formData.almacen_destino_id) {
                nuevosErrores.almacen_destino_id = 'El almacén destino debe ser diferente al origen';
            }
            if (!formData.cantidad_transferir || isNaN(Number(formData.cantidad_transferir)) || Number(formData.cantidad_transferir) <= 0) {
                nuevosErrores.cantidad_transferir = 'Cantidad a transferir debe ser mayor a 0';
            } else if (Number(formData.cantidad_transferir) > stockOriginal) {
                nuevosErrores.cantidad_transferir = `No hay suficiente stock. Disponible: ${stockOriginal}`;
            }
        } else if (tipoOperacion === 'transformacion') {
            // Validar transformación
            if (!formData.almacen_transformacion_id) {
                nuevosErrores.almacen_transformacion_id = 'Debe seleccionar el almacén donde ocurre la transformación';
            }
            if (!formData.cantidad_transformar || isNaN(Number(formData.cantidad_transformar)) || Number(formData.cantidad_transformar) <= 0) {
                nuevosErrores.cantidad_transformar = 'Cantidad a transformar debe ser mayor a 0';
            } else if (Number(formData.cantidad_transformar) > stockOriginal) {
                nuevosErrores.cantidad_transformar = `No hay suficiente stock. Disponible: ${stockOriginal}`;
            }
        }

        // Validar motivo (común para todas las operaciones)
        if (!formData.motivo.trim()) {
            nuevosErrores.motivo = 'El motivo es requerido';
        } else if (formData.motivo.length < 5) {
            nuevosErrores.motivo = 'El motivo debe tener al menos 5 caracteres';
        } else if (formData.motivo.length > 500) {
            nuevosErrores.motivo = 'El motivo no puede exceder 500 caracteres';
        }

        setErrors(nuevosErrores);
        return Object.keys(nuevosErrores).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) {
            return;
        }

        try {
            setLoading(true);
            let resultado;

            if (tipoOperacion === 'ajuste') {
                const datosActualizacion = {
                    stock_actual: Number(formData.stock_actual),
                    stock_minimo: Number(formData.stock_minimo),
                    stock_maximo: formData.stock_maximo ? Number(formData.stock_maximo) : null,
                    costo_promedio: formData.costo_promedio ? Number(formData.costo_promedio) : null,
                    motivo: formData.motivo.trim()
                };

                // Si es un nuevo inventario, usar el almacén seleccionado
                const almacenId = inventarioItem.esNuevoInventario ?
                    formData.almacen_seleccionado :
                    inventarioItem.almacen_id;

                resultado = await almacenService.actualizarStockProducto(
                    inventarioItem.producto_id,
                    almacenId,
                    datosActualizacion
                );
            } else if (tipoOperacion === 'transferencia') {
                const datosTransferencia = {
                    producto_id: inventarioItem.producto_id,
                    almacen_origen_id: formData.almacen_origen_id,
                    almacen_destino_id: formData.almacen_destino_id,
                    cantidad: Number(formData.cantidad_transferir),
                    motivo: formData.motivo.trim()
                };

                resultado = await almacenService.transferirStock(datosTransferencia);
            } else if (tipoOperacion === 'transformacion') {
                // Para transformación, por ahora usamos ajuste negativo
                // En el futuro se puede implementar un endpoint específico
                const datosTransformacion = {
                    stock_actual: stockOriginal - Number(formData.cantidad_transformar),
                    stock_minimo: Number(formData.stock_minimo || 0),
                    motivo: `TRANSFORMACIÓN: ${formData.motivo.trim()}`
                };

                resultado = await almacenService.actualizarStockProducto(
                    inventarioItem.producto_id,
                    formData.almacen_transformacion_id,
                    datosTransformacion
                );
            }

            if (resultado.success) {
                onSuccess?.(resultado.data);
                onClose();
                resetForm();
            } else {
                setErrors({ submit: resultado.error || 'Error al procesar la operación' });
            }
        } catch (error) {
            console.error('Error en handleSubmit:', error);
            setErrors({
                submit: error.response?.data?.error || error.message || 'Error al procesar la operación'
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            stock_actual: '',
            stock_minimo: '',
            stock_maximo: '',
            costo_promedio: '',
            motivo: '',
            almacen_origen_id: '',
            almacen_destino_id: '',
            cantidad_transferir: '',
            cantidad_transformar: '',
            producto_resultado_id: '',
            almacen_transformacion_id: ''
        });
        setErrors({});
        setTipoOperacion('ajuste');
    };

    const calcularDiferencia = () => {
        const stockActual = Number(formData.stock_actual) || 0;
        return stockActual - stockOriginal;
    };

    const calcularValorTotal = () => {
        const stock = Number(formData.stock_actual) || 0;
        const costo = Number(formData.costo_promedio) || 0;
        return stock * costo;
    };

    const formatearNumero = (numero, decimales = 2) => {
        if (numero === null || numero === undefined || isNaN(numero)) return '0';
        return Number(numero).toLocaleString('es-PE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    };

    const formatearMoneda = (monto) => {
        if (monto === null || monto === undefined || isNaN(monto)) return 'S/ 0.00';
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN'
        }).format(monto);
    };

    const CalculadoraRapida = () => {
        const [operacion, setOperacion] = useState('suma');
        const [cantidad, setCantidad] = useState('');

        const aplicarOperacion = () => {
            const stockActual = Number(formData.stock_actual) || 0;
            const cantidadNum = Number(cantidad) || 0;
            let nuevoStock = stockActual;

            switch (operacion) {
                case 'suma':
                    nuevoStock = stockActual + cantidadNum;
                    break;
                case 'resta':
                    nuevoStock = Math.max(0, stockActual - cantidadNum);
                    break;
                case 'establecer':
                    nuevoStock = cantidadNum;
                    break;
                default:
                    nuevoStock = stockActual;
            }

            handleInputChange('stock_actual', nuevoStock.toString());
            setCantidad('');
            setShowCalculadora(false);
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter' && cantidad) {
                aplicarOperacion();
            }
        };

        return (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Calculadora Rápida</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <select
                        value={operacion}
                        onChange={(e) => setOperacion(e.target.value)}
                        className="text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="suma">Sumar</option>
                        <option value="resta">Restar</option>
                        <option value="establecer">Establecer</option>
                    </select>
                    <input
                        type="number"
                        placeholder="Cantidad"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.001"
                    />
                    <button
                        onClick={aplicarOperacion}
                        disabled={!cantidad}
                        className="text-sm bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    const diferencia = calcularDiferencia();
    const valorTotal = calcularValorTotal();

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div 
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                    onClick={onClose}
                    aria-hidden="true"
                ></div>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    {/* Header */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Package className="h-6 w-6 text-blue-600 mr-2" />
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Gestionar Inventario
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                                aria-label="Cerrar"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Información del producto */}
                        {inventarioItem && (
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">
                                            {inventarioItem.producto_codigo}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1 break-words">
                                            {inventarioItem.producto_descripcion}
                                        </p>
                                        {inventarioItem.esNuevoInventario ? (
                                            <div className="mt-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Seleccionar Almacén *
                                                </label>
                                                <select
                                                    value={formData.almacen_seleccionado}
                                                    onChange={(e) => handleInputChange('almacen_seleccionado', e.target.value)}
                                                    className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                        errors.almacen_seleccionado ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                                    }`}
                                                >
                                                    <option value="">Seleccionar almacén...</option>
                                                    {almacenesDisponibles.map((almacen) => (
                                                        <option key={almacen.id} value={almacen.id}>
                                                            {almacen.nombre} ({almacen.codigo})
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors.almacen_seleccionado && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {errors.almacen_seleccionado}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 mt-1">
                                                <span className="font-medium">Almacén:</span> {inventarioItem.almacen_nombre}
                                            </p>
                                        )}
                                        {inventarioItem.marca && (
                                            <p className="text-sm text-gray-500">
                                                <span className="font-medium">Marca:</span> {inventarioItem.marca}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="text-sm text-gray-500">Stock Actual</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {formatearNumero(stockOriginal, 0)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {inventarioItem.unidad_medida || 'UND'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pestañas para tipo de operación */}
                        {!inventarioItem?.esNuevoInventario && (
                            <div className="border-b border-gray-200 mb-6">
                                <nav className="-mb-px flex space-x-8">
                                    <button
                                        type="button"
                                        onClick={() => setTipoOperacion('ajuste')}
                                        className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                                            tipoOperacion === 'ajuste'
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <Settings className="h-4 w-4 inline mr-1" />
                                        Ajuste de Stock
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipoOperacion('transferencia')}
                                        className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                                            tipoOperacion === 'transferencia'
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <ArrowRightLeft className="h-4 w-4 inline mr-1" />
                                        Transferencia
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipoOperacion('transformacion')}
                                        className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                                            tipoOperacion === 'transformacion'
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <Repeat className="h-4 w-4 inline mr-1" />
                                        Transformación
                                    </button>
                                </nav>
                            </div>
                        )}

                        {/* Título para nuevo inventario */}
                        {inventarioItem?.esNuevoInventario && (
                            <div className="mb-6">
                                <h4 className="text-lg font-medium text-gray-900 flex items-center">
                                    <Plus className="h-5 w-5 text-green-600 mr-2" />
                                    Agregar Producto al Inventario
                                </h4>
                                <p className="text-sm text-gray-600 mt-1">
                                    Este producto no tiene stock en ningún almacén. Ingresa los valores iniciales para agregarlo al inventario.
                                </p>
                            </div>
                        )}

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* AJUSTE DE STOCK */}
                            {tipoOperacion === 'ajuste' && (
                                <>
                                    {/* Stock Actual */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Stock Actual *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowCalculadora(!showCalculadora)}
                                        className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
                                    >
                                        {showCalculadora ? 'Ocultar' : 'Calculadora'}
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    value={formData.stock_actual}
                                    onChange={(e) => handleInputChange('stock_actual', e.target.value)}
                                    className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                        errors.stock_actual ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    min="0"
                                    step="0.001"
                                    placeholder="0"
                                />
                                {errors.stock_actual && (
                                    <p className="mt-1 text-sm text-red-600">{errors.stock_actual}</p>
                                )}
                                {diferencia !== 0 && (
                                    <div className={`mt-1 flex items-center text-sm ${
                                        diferencia > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {diferencia > 0 ? (
                                            <TrendingUp className="h-4 w-4 mr-1" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4 mr-1" />
                                        )}
                                        {diferencia > 0 ? '+' : ''}{formatearNumero(diferencia, 0)} unidades vs. stock original
                                    </div>
                                )}
                                {showCalculadora && <CalculadoraRapida />}
                            </div>

                            {/* Stock Mínimo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Stock Mínimo *
                                </label>
                                <input
                                    type="number"
                                    value={formData.stock_minimo}
                                    onChange={(e) => handleInputChange('stock_minimo', e.target.value)}
                                    className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                        errors.stock_minimo ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    min="0"
                                    step="0.001"
                                    placeholder="0"
                                />
                                {errors.stock_minimo && (
                                    <p className="mt-1 text-sm text-red-600">{errors.stock_minimo}</p>
                                )}
                            </div>

                            {/* Stock Máximo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Stock Máximo
                                </label>
                                <input
                                    type="number"
                                    value={formData.stock_maximo}
                                    onChange={(e) => handleInputChange('stock_maximo', e.target.value)}
                                    className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                        errors.stock_maximo ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    min="0"
                                    step="0.001"
                                    placeholder="Opcional"
                                />
                                {errors.stock_maximo && (
                                    <p className="mt-1 text-sm text-red-600">{errors.stock_maximo}</p>
                                )}
                            </div>

                            {/* Costo Promedio */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Costo Promedio
                                </label>
                                <div className="relative mt-1">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="number"
                                        value={formData.costo_promedio}
                                        onChange={(e) => handleInputChange('costo_promedio', e.target.value)}
                                        className={`block w-full pl-10 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                            errors.costo_promedio ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                                {errors.costo_promedio && (
                                    <p className="mt-1 text-sm text-red-600">{errors.costo_promedio}</p>
                                )}
                                {valorTotal > 0 && (
                                    <p className="mt-1 text-sm text-gray-600">
                                        Valor total: {formatearMoneda(valorTotal)}
                                    </p>
                                )}
                            </div>

                                </>
                            )}

                            {/* TRANSFERENCIA ENTRE ALMACENES */}
                            {tipoOperacion === 'transferencia' && (
                                <>
                                    {/* Almacén Origen */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Almacén Origen *
                                        </label>
                                        <select
                                            value={formData.almacen_origen_id}
                                            onChange={(e) => handleInputChange('almacen_origen_id', e.target.value)}
                                            className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                errors.almacen_origen_id ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        >
                                            <option value="">Seleccionar almacén origen</option>
                                            {almacenesDisponibles.map(almacen => (
                                                <option key={almacen.id} value={almacen.id}>
                                                    {almacen.codigo} - {almacen.nombre} ({almacen.tipo})
                                                </option>
                                            ))}
                                        </select>
                                        {errors.almacen_origen_id && (
                                            <p className="mt-1 text-sm text-red-600">{errors.almacen_origen_id}</p>
                                        )}
                                    </div>

                                    {/* Almacén Destino */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Almacén Destino *
                                        </label>
                                        <select
                                            value={formData.almacen_destino_id}
                                            onChange={(e) => handleInputChange('almacen_destino_id', e.target.value)}
                                            className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                errors.almacen_destino_id ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        >
                                            <option value="">Seleccionar almacén destino</option>
                                            {almacenesDisponibles
                                                .filter(almacen => almacen.id !== formData.almacen_origen_id)
                                                .map(almacen => (
                                                    <option key={almacen.id} value={almacen.id}>
                                                        {almacen.codigo} - {almacen.nombre} ({almacen.tipo})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        {errors.almacen_destino_id && (
                                            <p className="mt-1 text-sm text-red-600">{errors.almacen_destino_id}</p>
                                        )}
                                    </div>

                                    {/* Cantidad a Transferir */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Cantidad a Transferir *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.cantidad_transferir}
                                            onChange={(e) => handleInputChange('cantidad_transferir', e.target.value)}
                                            className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                errors.cantidad_transferir ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                            min="0"
                                            max={stockOriginal}
                                            step="0.001"
                                            placeholder="0"
                                        />
                                        {errors.cantidad_transferir && (
                                            <p className="mt-1 text-sm text-red-600">{errors.cantidad_transferir}</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500">
                                            Stock disponible en origen: {formatearNumero(stockOriginal, 0)}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* TRANSFORMACIÓN */}
                            {tipoOperacion === 'transformacion' && (
                                <>
                                    {/* Almacén donde ocurre la transformación */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Almacén de Transformación *
                                        </label>
                                        <select
                                            value={formData.almacen_transformacion_id}
                                            onChange={(e) => handleInputChange('almacen_transformacion_id', e.target.value)}
                                            className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                errors.almacen_transformacion_id ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        >
                                            <option value="">Seleccionar almacén</option>
                                            {almacenesDisponibles.map(almacen => (
                                                <option key={almacen.id} value={almacen.id}>
                                                    {almacen.codigo} - {almacen.nombre} ({almacen.tipo})
                                                </option>
                                            ))}
                                        </select>
                                        {errors.almacen_transformacion_id && (
                                            <p className="mt-1 text-sm text-red-600">{errors.almacen_transformacion_id}</p>
                                        )}
                                    </div>

                                    {/* Cantidad a Transformar */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Cantidad a Transformar *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.cantidad_transformar}
                                            onChange={(e) => handleInputChange('cantidad_transformar', e.target.value)}
                                            className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                                errors.cantidad_transformar ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                            min="0"
                                            max={stockOriginal}
                                            step="0.001"
                                            placeholder="0"
                                        />
                                        {errors.cantidad_transformar && (
                                            <p className="mt-1 text-sm text-red-600">{errors.cantidad_transformar}</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500">
                                            Stock disponible: {formatearNumero(stockOriginal, 0)}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Motivo (común para todas las operaciones) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Motivo {tipoOperacion === 'ajuste' ? 'del Ajuste' : tipoOperacion === 'transferencia' ? 'de la Transferencia' : 'de la Transformación'} *
                                </label>
                                <textarea
                                    value={formData.motivo}
                                    onChange={(e) => handleInputChange('motivo', e.target.value)}
                                    rows={3}
                                    className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
                                        errors.motivo ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    placeholder={
                                        tipoOperacion === 'ajuste'
                                            ? "Ej: Inventario físico, ajuste por merma, corrección de sistema..."
                                            : tipoOperacion === 'transferencia'
                                            ? "Ej: Redistribución de inventario, abastecimiento de sucursal..."
                                            : "Ej: Procesamiento de materia prima, ensamblaje de producto..."
                                    }
                                    maxLength="500"
                                />
                                {errors.motivo && (
                                    <p className="mt-1 text-sm text-red-600">{errors.motivo}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    {formData.motivo.length}/500 caracteres
                                </p>
                            </div>

                            {/* Alertas */}
                            {Number(formData.stock_actual) <= Number(formData.stock_minimo) && Number(formData.stock_actual) > 0 && (
                                <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-800">Stock Bajo</p>
                                        <p className="text-sm text-yellow-700">
                                            El stock actual está por debajo o igual al stock mínimo.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {Number(formData.stock_actual) === 0 && (
                                <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Stock Agotado</p>
                                        <p className="text-sm text-red-700">
                                            Se generará una alerta crítica de stock agotado.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Error de submit */}
                            {errors.submit && (
                                <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Error</p>
                                        <p className="text-sm text-red-700">{errors.submit}</p>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    {tipoOperacion === 'ajuste' ? 'Guardar Ajuste' :
                                     tipoOperacion === 'transferencia' ? 'Ejecutar Transferencia' :
                                     'Procesar Transformación'}
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>

                    {/* Info adicional */}
                    <div className="px-4 pb-4">
                        <div className="flex items-start space-x-2 text-xs text-gray-500">
                            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <p>
                                Los cambios se registrarán como movimientos de inventario y se generarán alertas automáticas según corresponda.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventarioForm;