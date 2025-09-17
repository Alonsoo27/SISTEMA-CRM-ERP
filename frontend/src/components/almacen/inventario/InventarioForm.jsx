import React, { useState, useEffect } from 'react';
import { 
    X, 
    Save, 
    AlertTriangle, 
    Package, 
    DollarSign, 
    TrendingUp, 
    TrendingDown,
    Info,
    Calculator
} from 'lucide-react';
import almacenService from '../../services/almacenService';

const InventarioForm = ({ 
    isOpen, 
    onClose, 
    inventarioItem = null, 
    onSuccess 
}) => {
    const [formData, setFormData] = useState({
        stock_actual: '',
        stock_minimo: '',
        stock_maximo: '',
        costo_promedio: '',
        motivo: ''
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [stockOriginal, setStockOriginal] = useState(0);
    const [showCalculadora, setShowCalculadora] = useState(false);

    useEffect(() => {
        if (isOpen && inventarioItem) {
            setFormData({
                stock_actual: inventarioItem.stock_actual?.toString() || '0',
                stock_minimo: inventarioItem.stock_minimo?.toString() || '0',
                stock_maximo: inventarioItem.stock_maximo?.toString() || '',
                costo_promedio: inventarioItem.costo_promedio?.toString() || '',
                motivo: ''
            });
            setStockOriginal(Number(inventarioItem.stock_actual) || 0);
            setErrors({});
        }
    }, [isOpen, inventarioItem]);

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

        // Validar motivo
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

            const datosActualizacion = {
                stock_actual: Number(formData.stock_actual),
                stock_minimo: Number(formData.stock_minimo),
                stock_maximo: formData.stock_maximo ? Number(formData.stock_maximo) : null,
                costo_promedio: formData.costo_promedio ? Number(formData.costo_promedio) : null,
                motivo: formData.motivo.trim()
            };

            const resultado = await almacenService.actualizarStockProducto(
                inventarioItem.producto_id,
                inventarioItem.almacen_id,
                datosActualizacion
            );

            if (resultado.success) {
                onSuccess?.(resultado.data);
                onClose();
                // Reset form
                setFormData({
                    stock_actual: '',
                    stock_minimo: '',
                    stock_maximo: '',
                    costo_promedio: '',
                    motivo: ''
                });
                setErrors({});
            } else {
                setErrors({ submit: resultado.error || 'Error al actualizar el inventario' });
            }
        } catch (error) {
            console.error('Error en handleSubmit:', error);
            setErrors({ 
                submit: error.response?.data?.error || error.message || 'Error al actualizar el inventario' 
            });
        } finally {
            setLoading(false);
        }
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
                                    Editar Inventario
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
                                        <p className="text-sm text-gray-500 mt-1">
                                            <span className="font-medium">Almacén:</span> {inventarioItem.almacen_nombre}
                                        </p>
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

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            {/* Motivo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Motivo del Ajuste *
                                </label>
                                <textarea
                                    value={formData.motivo}
                                    onChange={(e) => handleInputChange('motivo', e.target.value)}
                                    rows={3}
                                    className={`mt-1 block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
                                        errors.motivo ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    placeholder="Ej: Inventario físico, ajuste por merma, corrección de sistema..."
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
                                    Guardar Cambios
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