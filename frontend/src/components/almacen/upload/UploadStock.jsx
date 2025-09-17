import React, { useState, useRef } from 'react';
import { 
    Upload, 
    Download, 
    FileText, 
    CheckCircle, 
    AlertTriangle, 
    X, 
    Eye,
    Play,
    RotateCcw,
    Package,
    Warehouse,
    TrendingUp,
    Clock,
    AlertCircle
} from 'lucide-react';
import almacenService from "../../../services/almacenService";

const UploadStock = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Results
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [uploadResults, setUploadResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const fileInputRef = useRef(null);

    const resetForm = () => {
        setStep(1);
        setFile(null);
        setPreviewData(null);
        setUploadResults(null);
        setLoading(false);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;

        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];

        if (!validTypes.includes(selectedFile.type)) {
            setError('Solo se permiten archivos Excel (.xlsx, .xls)');
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
            setError('El archivo no puede exceder 10MB');
            return;
        }

        setFile(selectedFile);
        setError(null);
        setStep(2);
    };

    const ejecutarPreview = async () => {
        if (!file) {
            setError('No se ha seleccionado ningún archivo');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const resultado = await almacenService.previewUploadStock(file);

            if (resultado.success) {
                setPreviewData(resultado.data);
            } else {
                setError(resultado.error || 'Error en el preview');
            }
        } catch (err) {
            setError('Error al procesar los datos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const ejecutarUpload = async () => {
        if (!previewData || !previewData.puede_ejecutar) {
            setError('No se puede ejecutar la importación debido a errores en los datos');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const resultado = await almacenService.ejecutarUploadStock(file);

            if (resultado.success) {
                setUploadResults(resultado.data);
                setStep(3);
                onSuccess?.(resultado.data);
            } else {
                setError(resultado.error || 'Error al ejecutar la importación');
            }
        } catch (err) {
            setError('Error al importar los datos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const descargarPlantilla = async () => {
        try {
            setLoading(true);
            const resultado = await almacenService.descargarPlantillaStock();
            if (!resultado.success) {
                setError(resultado.error || 'Error al descargar la plantilla');
            }
        } catch (err) {
            setError('Error al descargar la plantilla: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const StepUpload = () => (
        <div className="text-center py-8">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Cargar Archivo de Inventario</h3>
            <p className="text-sm text-gray-600 mb-6">
                Selecciona un archivo Excel con los datos de stock para cargar al sistema
            </p>

            <div className="space-y-4">
                {/* Botón de descarga de plantilla */}
                <div>
                    <button
                        onClick={descargarPlantilla}
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {loading ? 'Descargando...' : 'Descargar Plantilla Excel'}
                    </button>
                    <p className="mt-2 text-xs text-gray-500">
                        Descarga la plantilla oficial para asegurar el formato correcto
                    </p>
                </div>

                {/* Zona de drop */}
                <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const droppedFile = e.dataTransfer.files[0];
                        handleFileSelect(droppedFile);
                    }}
                >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium text-blue-600">Haz clic para seleccionar</span> o arrastra el archivo aquí
                    </p>
                    <p className="text-xs text-gray-500">
                        Solo archivos Excel (.xlsx, .xls) - Máximo 10MB
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden"
                />

                {file && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                        <FileText className="h-4 w-4" />
                        <span>{file.name}</span>
                        <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                )}
            </div>
        </div>
    );

    const StepPreview = () => {
        if (!previewData) {
            return (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Analizando archivo...</p>
                    <button
                        onClick={ejecutarPreview}
                        disabled={loading}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? 'Analizando...' : 'Analizar Datos'}
                    </button>
                </div>
            );
        }

        const { 
            productos_procesados = 0, 
            productos = [], 
            errores = [], 
            tiene_errores = false, 
            puede_ejecutar = false 
        } = previewData;

        const productosValidos = productos.length;
        const totalErrores = errores.length;

        return (
            <div className="space-y-6">
                {/* Resumen */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-900">{productos_procesados}</p>
                        <p className="text-sm text-blue-700">Total Filas</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-900">{productosValidos}</p>
                        <p className="text-sm text-green-700">Válidos</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                        <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-900">{totalErrores}</p>
                        <p className="text-sm text-red-700">Errores</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg text-center">
                        <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-yellow-900">0</p>
                        <p className="text-sm text-yellow-700">Advertencias</p>
                    </div>
                </div>

                {/* Estado de importación */}
                <div className={`p-4 rounded-lg border ${
                    puede_ejecutar 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                }`}>
                    <div className="flex items-center">
                        {puede_ejecutar ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        ) : (
                            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                        )}
                        <p className={`font-medium ${
                            puede_ejecutar ? 'text-green-800' : 'text-red-800'
                        }`}>
                            {puede_ejecutar 
                                ? 'Los datos están listos para importar' 
                                : 'No se puede importar debido a errores'
                            }
                        </p>
                    </div>
                </div>

                {/* Errores */}
                {errores.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-red-800 mb-3">Errores Encontrados</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {errores.map((error, index) => (
                                <p key={index} className="text-sm text-red-700">• {error}</p>
                            ))}
                        </div>
                    </div>
                )}

                {/* Preview de productos válidos */}
                {productos.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-green-800 mb-3">
                            Preview de Productos Válidos ({productos.length})
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b border-green-200">
                                        <th className="text-left text-xs font-medium text-green-700 uppercase p-2">Producto</th>
                                        <th className="text-left text-xs font-medium text-green-700 uppercase p-2">Almacén</th>
                                        <th className="text-center text-xs font-medium text-green-700 uppercase p-2">Stock</th>
                                        <th className="text-center text-xs font-medium text-green-700 uppercase p-2">Mínimo</th>
                                        <th className="text-right text-xs font-medium text-green-700 uppercase p-2">Costo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.slice(0, 10).map((producto, index) => (
                                        <tr key={index} className="border-b border-green-100">
                                            <td className="p-2 text-sm text-green-900">{producto.codigo_producto}</td>
                                            <td className="p-2 text-sm text-green-900">{producto.almacen_codigo}</td>
                                            <td className="p-2 text-sm text-green-900 text-center">{producto.stock_actual}</td>
                                            <td className="p-2 text-sm text-green-900 text-center">{producto.stock_minimo}</td>
                                            <td className="p-2 text-sm text-green-900 text-right">
                                                {producto.costo_promedio ? almacenService.formatearMoneda(producto.costo_promedio) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {productos.length > 10 && (
                                <p className="text-sm text-green-600 text-center p-2">
                                    ... y {productos.length - 10} productos más
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const StepResults = () => {
        if (!uploadResults) return null;

        const { 
            productos_procesados = 0, 
            productos_con_error = 0, 
            total_productos = 0 
        } = uploadResults;

        const exitosos = productos_procesados;
        const conErrores = productos_con_error;

        return (
            <div className="text-center space-y-6">
                {/* Estado general */}
                <div className="flex items-center justify-center mb-6">
                    {conErrores === 0 ? (
                        <>
                            <CheckCircle className="h-16 w-16 text-green-500 mr-4" />
                            <div>
                                <h3 className="text-xl font-bold text-green-900">¡Importación Exitosa!</h3>
                                <p className="text-green-700">Todos los datos se procesaron correctamente</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="h-16 w-16 text-yellow-500 mr-4" />
                            <div>
                                <h3 className="text-xl font-bold text-yellow-900">Importación Completada con Advertencias</h3>
                                <p className="text-yellow-700">Algunos registros no se pudieron procesar</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-900">{exitosos}</p>
                        <p className="text-sm text-green-700">Procesados</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                        <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-900">{conErrores}</p>
                        <p className="text-sm text-red-700">Con Error</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <Package className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-purple-900">{total_productos}</p>
                        <p className="text-sm text-purple-700">Total</p>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={() => {
                            resetForm();
                            setStep(1);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Cargar Otro Archivo
                    </button>
                    <button
                        onClick={onClose}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Finalizar
                    </button>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={step === 1 ? onClose : undefined}></div>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Warehouse className="h-6 w-6 text-blue-600 mr-2" />
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Carga Masiva de Inventario
                                </h3>
                            </div>
                            <div className="flex items-center space-x-4">
                                {/* Indicador de pasos */}
                                <div className="flex items-center space-x-2">
                                    {[1, 2, 3].map((stepNum) => (
                                        <div
                                            key={stepNum}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                                step === stepNum
                                                    ? 'bg-blue-600 text-white'
                                                    : step > stepNum
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {step > stepNum ? <CheckCircle className="h-4 w-4" /> : stepNum}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Labels de pasos */}
                        <div className="mt-2 flex justify-center space-x-8 text-sm text-gray-500">
                            <span className={step >= 1 ? 'text-blue-600 font-medium' : ''}>1. Cargar Archivo</span>
                            <span className={step >= 2 ? 'text-blue-600 font-medium' : ''}>2. Validar Datos</span>
                            <span className={step >= 3 ? 'text-blue-600 font-medium' : ''}>3. Resultados</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 min-h-96">
                        {step === 1 && <StepUpload />}
                        {step === 2 && <StepPreview />}
                        {step === 3 && <StepResults />}

                        {/* Error general */}
                        {error && (
                            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex">
                                    <AlertTriangle className="h-5 w-5 text-red-400" />
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                                        <p className="text-sm text-red-700 mt-1">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        {step === 1 && (
                            <button
                                onClick={onClose}
                                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                Cancelar
                            </button>
                        )}

                        {step === 2 && (
                            <>
                                <button
                                    onClick={ejecutarUpload}
                                    disabled={loading || !previewData?.puede_ejecutar}
                                    className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Importando...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-4 w-4 mr-2" />
                                            Ejecutar Importación
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setStep(1)}
                                    disabled={loading}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                >
                                    Volver
                                </button>
                                {!previewData && (
                                    <button
                                        onClick={ejecutarPreview}
                                        disabled={loading}
                                        className="mt-3 w-full inline-flex justify-center items-center rounded-md border border-blue-300 shadow-sm px-4 py-2 bg-blue-50 text-base font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                                Analizando...
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-4 w-4 mr-2" />
                                                Analizar Datos
                                            </>
                                        )}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadStock;