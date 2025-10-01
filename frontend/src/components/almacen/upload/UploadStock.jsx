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
    const [activeTab, setActiveTab] = useState('validos'); // Tab activo en preview
    const [modoImportacion, setModoImportacion] = useState('SOLO_VALIDOS'); // Modo de importación

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

            // Crear FormData con el archivo
            const formData = new FormData();
            formData.append('archivo', file);

            const resultado = await almacenService.previewUploadStock(formData);

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
        if (!previewData || (!previewData.puede_ejecutar_parcial && !previewData.puede_ejecutar_completo)) {
            setError('No se puede ejecutar la importación debido a errores en los datos');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Crear FormData con el archivo y modo de importación
            const formData = new FormData();
            formData.append('archivo', file);
            formData.append('modo_importacion', modoImportacion);

            const resultado = await almacenService.ejecutarUploadStock(formData);

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

    // Funciones para manejar correcciones
    const aplicarSugerencia = (productoIndex, codigoSugerido) => {
        // Actualizar el previewData con la corrección aplicada
        const nuevosProductosSugerencias = [...(previewData.todas_sugerencias || [])];
        const producto = nuevosProductosSugerencias[productoIndex];

        if (producto) {
            // Mover de sugerencias a válidos
            producto.codigo_producto = codigoSugerido;
            producto.producto_id = producto.producto_sugerido_id;
            producto.tipo_coincidencia = 'CORREGIDO_MANUAL';

            // Actualizar previewData
            const nuevosValidos = [...(previewData.preview_validos || []), producto];
            const nuevasSugerencias = nuevosProductosSugerencias.filter((_, index) => index !== productoIndex);

            setPreviewData(prev => ({
                ...prev,
                preview_validos: nuevosValidos.slice(-10), // Mantener solo últimos 10
                todas_sugerencias: nuevasSugerencias,
                total_validos: (prev.total_validos || 0) + 1,
                total_sugerencias: (prev.total_sugerencias || 0) - 1,
                puede_ejecutar_parcial: true
            }));
        }
    };

    const buscarProductoManual = async (productoIndex, codigoCorregido) => {
        if (!codigoCorregido.trim()) return;

        try {
            setLoading(true);

            // Hacer búsqueda real en el backend
            const response = await fetch('/api/productos/buscar-codigo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('fake-jwt-token-for-testing') || 'fake-jwt-token-for-testing'}`
                },
                body: JSON.stringify({ codigo: codigoCorregido.trim() })
            });

            if (response.ok) {
                const resultado = await response.json();

                if (resultado.success && resultado.data) {
                    const nuevosErrores = [...(previewData.todos_errores || [])];
                    const producto = nuevosErrores[productoIndex];

                    if (producto) {
                        // Actualizar con datos reales del producto encontrado
                        producto.codigo_producto = resultado.data.codigo;
                        producto.producto_id = resultado.data.id; // ID real del backend
                        producto.tipo_coincidencia = 'CORREGIDO_MANUAL';

                        // Mover de errores a válidos
                        const nuevosValidos = [...(previewData.preview_validos || []), producto];
                        const nuevosErroresFiltrados = nuevosErrores.filter((_, index) => index !== productoIndex);

                        setPreviewData(prev => ({
                            ...prev,
                            preview_validos: nuevosValidos.slice(-10),
                            todos_errores: nuevosErroresFiltrados,
                            total_validos: (prev.total_validos || 0) + 1,
                            total_errores: (prev.total_errores || 0) - 1,
                            puede_ejecutar_parcial: true
                        }));

                        setError(null);
                    }
                } else {
                    setError(`Producto con código "${codigoCorregido}" no encontrado en el sistema`);
                }
            } else {
                setError('Error al buscar el producto en el sistema');
            }
        } catch (err) {
            setError('Error al buscar producto: ' + err.message);
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
            total_validos = 0,
            total_errores = 0,
            total_sugerencias = 0,
            preview_validos = [],
            preview_errores = [],
            preview_sugerencias = [],
            todos_errores = [],
            todas_sugerencias = [],
            errores = [],
            tiene_errores = false,
            puede_ejecutar_parcial = false,
            puede_ejecutar_completo = false
        } = previewData;

        return (
            <div className="space-y-6">
                {/* Resumen Mejorado */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-900">{productos_procesados}</p>
                        <p className="text-sm text-blue-700">Total Filas</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-900">{total_validos}</p>
                        <p className="text-sm text-green-700">✅ Listos para Importar</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                        <AlertCircle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-orange-900">{total_sugerencias}</p>
                        <p className="text-sm text-orange-700">🔍 Con Sugerencias</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                        <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-900">{total_errores}</p>
                        <p className="text-sm text-red-700">❌ Con Errores</p>
                    </div>
                </div>

                {/* Estado de importación mejorado */}
                <div className="space-y-3">
                    {puede_ejecutar_completo && (
                        <div className="p-4 rounded-lg border bg-green-50 border-green-200">
                            <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                <p className="font-medium text-green-800">
                                    ✨ ¡Perfecto! Todos los datos están listos para importar
                                </p>
                            </div>
                        </div>
                    )}

                    {!puede_ejecutar_completo && puede_ejecutar_parcial && (
                        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                            <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                                <div>
                                    <p className="font-medium text-blue-800">
                                        ⚡ Importación parcial disponible
                                    </p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Se pueden importar {total_validos} productos válidos.
                                        {total_errores > 0 && ` ${total_errores} productos tienen errores.`}
                                        {total_sugerencias > 0 && ` ${total_sugerencias} productos tienen sugerencias de corrección.`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!puede_ejecutar_parcial && (
                        <div className="p-4 rounded-lg border bg-red-50 border-red-200">
                            <div className="flex items-center">
                                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                                <p className="font-medium text-red-800">
                                    ❌ No se encontraron productos válidos para importar
                                </p>
                            </div>
                        </div>
                    )}
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

                {/* Tabs de categorías */}
                <div className="bg-white border border-gray-200 rounded-lg">
                    {/* Tab Headers */}
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6 py-3" aria-label="Tabs">
                            <button
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === 'validos'
                                        ? 'border-green-500 text-green-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                                onClick={() => setActiveTab('validos')}
                            >
                                ✅ Listos para Importar ({total_validos})
                            </button>

                            {total_sugerencias > 0 && (
                                <button
                                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === 'sugerencias'
                                            ? 'border-orange-500 text-orange-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                    onClick={() => setActiveTab('sugerencias')}
                                >
                                    🔍 Con Sugerencias ({total_sugerencias})
                                </button>
                            )}

                            {total_errores > 0 && (
                                <button
                                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === 'errores'
                                            ? 'border-red-500 text-red-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                    onClick={() => setActiveTab('errores')}
                                >
                                    ❌ Con Errores ({total_errores})
                                </button>
                            )}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'validos' && total_validos > 0 && (
                            <ProductosValidosTab productos={preview_validos} total={total_validos} />
                        )}

                        {activeTab === 'sugerencias' && total_sugerencias > 0 && (
                            <SugerenciasTab
                                productos={todas_sugerencias}
                                total={total_sugerencias}
                                onAplicarSugerencia={aplicarSugerencia}
                            />
                        )}

                        {activeTab === 'errores' && total_errores > 0 && (
                            <ErroresTab
                                productos={todos_errores}
                                total={total_errores}
                                onBuscarProducto={buscarProductoManual}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const StepResults = () => {
        if (!uploadResults) return null;

        const {
            productos_procesados = 0,
            productos_con_error = 0,
            total_productos = 0,
            mensaje = '',
            productos_no_encontrados = [],
            almacenes_no_encontrados = [],
            productos_omitidos = []
        } = uploadResults;

        const exitosos = productos_procesados;
        const conErrores = productos_con_error;
        const omitidos = productos_omitidos;

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-900">{exitosos}</p>
                        <p className="text-sm text-green-700">Procesados</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <Eye className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-900">{omitidos}</p>
                        <p className="text-sm text-blue-700">Omitidos</p>
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

                {/* Mensaje explicativo */}
                {mensaje && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            📊 <strong>Resumen:</strong> {mensaje}
                        </p>
                        {omitidos > 0 && (
                            <p className="text-xs text-blue-600 mt-2">
                                ℹ️ Los productos omitidos no existían en el catálogo y fueron filtrados automáticamente.
                            </p>
                        )}
                    </div>
                )}

                {/* Lista de productos no encontrados */}
                {productos_no_encontrados.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                            <h4 className="text-lg font-medium text-yellow-800">
                                Productos No Encontrados ({productos_no_encontrados.length})
                            </h4>
                        </div>
                        <p className="text-sm text-yellow-700 mb-3">
                            Los siguientes códigos de productos no existen en tu módulo de productos y fueron omitidos:
                        </p>
                        <div className="max-h-32 overflow-y-auto bg-white rounded border border-yellow-200 p-3">
                            <div className="space-y-1">
                                {productos_no_encontrados.map((producto, index) => (
                                    <div key={index} className="text-sm flex items-center justify-between">
                                        <span className="font-mono text-red-600 font-medium">
                                            {producto.codigo}
                                        </span>
                                        <span className="text-gray-600 text-xs truncate ml-3 max-w-xs">
                                            {producto.descripcion}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-yellow-600 mt-2">
                            💡 <strong>Sugerencia:</strong> Verifica si estos códigos tienen errores de tipeo o si necesitas crear estos productos en tu sistema.
                        </p>
                    </div>
                )}

                {/* Lista de almacenes no encontrados */}
                {almacenes_no_encontrados.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <Warehouse className="h-5 w-5 text-orange-600 mr-2" />
                            <h4 className="text-lg font-medium text-orange-800">
                                Almacenes No Encontrados ({almacenes_no_encontrados.length})
                            </h4>
                        </div>
                        <p className="text-sm text-orange-700 mb-3">
                            Los siguientes almacenes no existen en tu sistema:
                        </p>
                        <div className="bg-white rounded border border-orange-200 p-3">
                            <div className="flex flex-wrap gap-2">
                                {almacenes_no_encontrados.map((almacen, index) => (
                                    <span key={index} className="inline-block bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded">
                                        {almacen}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-orange-600 mt-2">
                            💡 <strong>Sugerencia:</strong> Revisa los nombres de almacenes en tu archivo Excel.
                        </p>
                    </div>
                )}

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
                                {/* Selector de modo de importación */}
                                {previewData?.puede_ejecutar_parcial && !previewData?.puede_ejecutar_completo && (
                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        <label className="block text-sm font-medium text-blue-800 mb-2">
                                            Modo de importación:
                                        </label>
                                        <select
                                            value={modoImportacion}
                                            onChange={(e) => setModoImportacion(e.target.value)}
                                            className="w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="SOLO_VALIDOS">
                                                Solo productos válidos ({previewData?.total_validos || 0})
                                            </option>
                                            <option value="TODO_PERFECTO" disabled>
                                                Todo perfecto (requiere 0 errores)
                                            </option>
                                        </select>
                                    </div>
                                )}

                                <button
                                    onClick={ejecutarUpload}
                                    disabled={loading || (!previewData?.puede_ejecutar_parcial && !previewData?.puede_ejecutar_completo)}
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
                                            {modoImportacion === 'SOLO_VALIDOS' ?
                                                `Importar ${previewData?.total_validos || 0} productos` :
                                                'Ejecutar Importación'
                                            }
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

// Componentes de tabs
const ProductosValidosTab = ({ productos, total }) => (
    <div>
        <h4 className="text-lg font-medium text-green-800 mb-3">
            Productos Listos para Importar ({total})
        </h4>
        {productos.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-green-200">
                            <th className="text-left text-xs font-medium text-green-700 uppercase p-2">Almacén</th>
                            <th className="text-left text-xs font-medium text-green-700 uppercase p-2">Código</th>
                            <th className="text-left text-xs font-medium text-green-700 uppercase p-2">Descripción</th>
                            <th className="text-center text-xs font-medium text-green-700 uppercase p-2">Cantidad</th>
                            <th className="text-center text-xs font-medium text-green-700 uppercase p-2">U. Medida</th>
                            <th className="text-center text-xs font-medium text-green-700 uppercase p-2">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map((producto, index) => (
                            <tr key={index} className="border-b border-green-100">
                                <td className="p-2 text-sm text-green-900">{producto.almacen_codigo}</td>
                                <td className="p-2 text-sm text-green-900 font-mono">{producto.codigo_producto}</td>
                                <td className="p-2 text-sm text-green-900 truncate max-w-xs">{producto.descripcion}</td>
                                <td className="p-2 text-sm text-green-900 text-center">{producto.cantidad}</td>
                                <td className="p-2 text-sm text-green-900 text-center">{producto.unidad_medida}</td>
                                <td className="p-2 text-center">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {producto.tipo_coincidencia === 'EXACTA_NORMALIZADA' ? '🔍 Normalizado' : '✅ Exacto'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {total > productos.length && (
                    <p className="text-sm text-green-600 text-center p-2">
                        ... y {total - productos.length} productos más
                    </p>
                )}
            </div>
        ) : (
            <p className="text-green-600">No hay productos válidos para mostrar</p>
        )}
    </div>
);

const SugerenciasTab = ({ productos, total, onAplicarSugerencia }) => (
    <div>
        <h4 className="text-lg font-medium text-orange-800 mb-3">
            Productos con Sugerencias de Corrección ({total})
        </h4>
        {productos.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {productos.map((producto, index) => (
                    <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <span className="text-sm font-medium text-orange-900">Fila {producto.fila}:</span>
                                <span className="ml-2 font-mono text-orange-700">{producto.codigo_original}</span>
                            </div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                {producto.similitud}% similitud
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                            <span className="text-orange-700">Sugerencia:</span>
                            <span className="font-mono bg-white px-2 py-1 rounded border text-orange-900">
                                {producto.codigo_sugerido}
                            </span>
                            <button
                                onClick={() => onAplicarSugerencia(index, producto.codigo_sugerido)}
                                className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                            >
                                ✅ Aplicar corrección
                            </button>
                        </div>
                        <p className="text-xs text-orange-600 mt-1 truncate">{producto.descripcion}</p>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-orange-600">No hay productos con sugerencias</p>
        )}
    </div>
);

const ErroresTab = ({ productos, total, onBuscarProducto }) => {
    const [inputValues, setInputValues] = useState({});

    const handleInputChange = (index, value) => {
        setInputValues(prev => ({
            ...prev,
            [index]: value
        }));
    };

    const handleBuscar = (index) => {
        const codigoCorregido = inputValues[index] || productos[index]?.codigo_producto;
        if (codigoCorregido && codigoCorregido.trim()) {
            onBuscarProducto(index, codigoCorregido.trim());
        }
    };

    return (
        <div>
            <h4 className="text-lg font-medium text-red-800 mb-3">
                Productos con Errores ({total})
            </h4>
            {productos.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {productos.map((producto, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <span className="text-sm font-medium text-red-900">Fila {producto.fila}:</span>
                                    <span className="ml-2 font-mono text-red-700">{producto.codigo_producto}</span>
                                </div>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    No encontrado
                                </span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm">
                                <span className="text-red-700">Error:</span>
                                <span className="text-red-600">{producto.error}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm mt-2">
                                <input
                                    type="text"
                                    placeholder="Corregir código..."
                                    className="flex-1 px-2 py-1 border border-red-300 rounded text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    defaultValue={producto.codigo_producto}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleBuscar(index);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => handleBuscar(index)}
                                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                                >
                                    🔍 Buscar
                                </button>
                            </div>
                            <p className="text-xs text-red-600 mt-1 truncate">{producto.descripcion}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-red-600">No hay productos con errores</p>
            )}
        </div>
    );
};

export default UploadStock;