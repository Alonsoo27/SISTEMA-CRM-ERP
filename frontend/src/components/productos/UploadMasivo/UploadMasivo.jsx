import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { API_CONFIG } from '../../../config/apiConfig';

const UploadMasivo = ({ isOpen, onClose, onUploadComplete, categorias = [] }) => {
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: DuplicatesModal, 4: Processing, 5: Results
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [productos, setProductos] = useState([]);
    const [validationResults, setValidationResults] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResults, setUploadResults] = useState(null);
    const [error, setError] = useState('');
    const [duplicateDecision, setDuplicateDecision] = useState(null); // 'replace', 'skip', null
    
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    // Cerrar modal y resetear estado
    const handleClose = () => {
        if (!uploading) {
            resetState();
            onClose();
        }
    };

    const resetState = () => {
        setStep(1);
        setFile(null);
        setDragOver(false);
        setProductos([]);
        setValidationResults(null);
        setUploading(false);
        setUploadProgress(0);
        setUploadResults(null);
        setError('');
        setDuplicateDecision(null); // NUEVO ESTADO
    };

    // Cerrar con ESC
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape' && !uploading) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, [isOpen, uploading]);

const generarPlantilla = async () => {
    try {
        // Obtener token de autenticación
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');

        // Realizar fetch con headers de autenticación
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/plantilla/premium`, {
            method: 'GET',
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` }),
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        // Convertir respuesta a blob
        const blob = await response.blob();

        // Crear enlace de descarga con el blob
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Plantilla_Productos_CRM_ERP_Premium.xlsx';

        // Agregar al DOM, hacer clic, y remover
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Limpiar el URL del blob
        window.URL.revokeObjectURL(url);

        console.log('Descarga de plantilla completada exitosamente');
    } catch (error) {
        console.error('Error al descargar plantilla:', error);
        setError('Error al generar la plantilla. Intente nuevamente.');
    }
};

    // Validar archivo
    const validarArchivo = (file) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            return 'Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)';
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB
            return 'El archivo no puede ser mayor a 5MB';
        }
        
        return null;
    };

    // Leer archivo Excel/CSV
const leerArchivo = useCallback(async (file) => {
    try {
        setError('');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            raw: false
        });
        
        if (jsonData.length < 2) {
            throw new Error('El archivo debe contener al menos una fila de datos además del encabezado');
        }

        // DEBUG: Ver todas las primeras filas
        console.log('🔍 PRIMERAS 6 FILAS DEL EXCEL:', jsonData.slice(0, 6));

        // Buscar fila de headers automáticamente
        let headerRowIndex = -1;
        let headers = [];
        
        // Buscar en las primeras 5 filas la que tenga headers válidos
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row.length >= 6) {
                // Verificar si esta fila contiene headers (buscar emojis o palabras clave)
                const hasKeywords = row.some(cell => 
                    cell && (
                        cell.toString().includes('CÓDIGO') ||
                        cell.toString().includes('código') ||
                        cell.toString().includes('🔖') ||
                        cell.toString().includes('DESCRIPCIÓN') ||
                        cell.toString().includes('descripción') ||
                        cell.toString().includes('📝')
                    )
                );
                
                if (hasKeywords) {
                    headerRowIndex = i;
                    headers = row;
                    console.log(`✅ HEADERS ENCONTRADOS EN FILA ${i + 1}:`, headers);
                    break;
                }
            }
        }

        if (headerRowIndex === -1) {
            throw new Error('No se pudieron encontrar los headers en las primeras 5 filas del archivo');
        }

        const requiredHeaders = ['codigo', 'descripcion', 'precio_sin_igv', 'marca', 'categoria', 'unidad_medida'];
        
        // Función para limpiar y normalizar headers
        const normalizeHeader = (header) => {
            if (!header) return '';
            return header.toString()
                .toLowerCase()
                .replace(/[🔖📝💰🏷️📂📏*]/g, '') // Quitar emojis y asteriscos
                .replace(/\s+/g, ' ') // Normalizar espacios múltiples
                .trim();
        };

        // Mapear headers a índices con lógica mejorada
        const headerMap = {};
        const missingHeaders = [];
        
        requiredHeaders.forEach(targetHeader => {
            let index = -1;
            const targetNormalized = normalizeHeader(targetHeader.replace(/_/g, ' '));
            
            console.log(`🔍 Buscando: ${targetHeader} (normalizado: "${targetNormalized}")`);
            
            // Buscar coincidencia
            index = headers.findIndex(h => {
                const headerNormalized = normalizeHeader(h);
                console.log(`  Comparando con: "${h}" (normalizado: "${headerNormalized}")`);
                
                // Coincidencia exacta
                if (headerNormalized === targetNormalized) {
                    console.log(`  ✅ COINCIDENCIA EXACTA`);
                    return true;
                }
                
                // Coincidencias alternativas específicas
                const alternatives = {
                    'codigo': ['codigo', 'código', 'code'],
                    'descripcion': ['descripcion', 'descripción', 'description'],
                    'precio sin igv': ['precio sin igv', 'precio', 'price'],
                    'marca': ['marca', 'brand'],
                    'categoria': ['categoria', 'categoría', 'category'],
                    'unidad medida': ['unidad medida', 'unidad', 'unit']
                };
                
                const alts = alternatives[targetNormalized] || [];
                const match = alts.some(alt => headerNormalized.includes(alt) || alt.includes(headerNormalized));
                
                if (match) {
                    console.log(`  ✅ COINCIDENCIA ALTERNATIVA`);
                    return true;
                }
                
                return false;
            });
            
            if (index === -1) {
                missingHeaders.push(targetHeader);
                console.log(`  ❌ NO ENCONTRADO: ${targetHeader}`);
            } else {
                console.log(`  ✅ MAPEADO: ${targetHeader} → índice ${index}`);
            }
            
            headerMap[targetHeader] = index;
        });
        
        // Validar que se encontraron todos los headers
        if (missingHeaders.length > 0) {
            throw new Error(`Faltan las siguientes columnas: ${missingHeaders.join(', ')}`);
        }

        // Convertir datos a objetos (empezar desde la fila siguiente a los headers)
        const productos = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Saltar filas completamente vacías
            if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
                continue;
            }

            const producto = {
                fila: i + 1,
                codigo: row[headerMap.codigo]?.toString().trim() || '',
                descripcion: row[headerMap.descripcion]?.toString().trim() || '',
                precio_sin_igv: row[headerMap.precio_sin_igv]?.toString().trim() || '',
                marca: row[headerMap.marca]?.toString().trim() || '',
                categoria: row[headerMap.categoria]?.toString().trim() || '',
                unidad_medida: row[headerMap.unidad_medida]?.toString().trim().toUpperCase() || 'UND'
            };

            productos.push(producto);
        }

        if (productos.length === 0) {
            throw new Error('No se encontraron filas de datos válidas en el archivo');
        }

        if (productos.length > 1000) {
            throw new Error('No se pueden procesar más de 1000 productos a la vez');
        }

        console.log(`✅ PRODUCTOS PROCESADOS: ${productos.length}`);
        setProductos(productos);
        setStep(2);
        
    } catch (error) {
        console.error('Error al leer archivo:', error);
        setError(error.message);
    }
}, []);
    // Validar datos con el backend - ENDPOINT CORREGIDO
    const validarDatos = async () => {
        try {
            setError('');
            
            // Transformar productos al formato esperado por el backend
            const productosParaValidar = productos.map(p => ({
                codigo: p.codigo,
                descripcion: p.descripcion,
                precio_sin_igv: parseFloat(p.precio_sin_igv) || 0,
                marca: p.marca,
                categoria: p.categoria,
                unidad_medida: p.unidad_medida
            }));

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/upload/preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ productos: productosParaValidar })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error al validar los datos');
            }

            setValidationResults(data.data);
            
        } catch (error) {
            console.error('Error al validar datos:', error);
            setError(error.message);
        }
    };

    // NUEVA FUNCIÓN: Manejar duplicados
    const handleDuplicatesDecision = (decision) => {
        setDuplicateDecision(decision);
        if (decision === 'cancel') {
            setStep(2); // Volver al preview
        } else {
            procesarUpload(decision === 'replace');
        }
    };

    // Función actualizada para manejar duplicados
    const handleProceedToUpload = () => {
        if (validationResults.duplicados > 0) {
            setStep(3); // Ir al modal de duplicados
        } else {
            procesarUpload(false); // No hay duplicados, proceder normalmente
        }
    };

    // Procesar upload - FUNCIÓN ACTUALIZADA
    const procesarUpload = async (reemplazarDuplicados = false) => {
        try {
            setUploading(true);
            setUploadProgress(0);
            setStep(4); // Processing
            setError('');

            // Simular progreso
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            // Usar los productos válidos del validation results
            const productosParaUpload = validationResults.resumen.productosValidos.map(p => ({
                codigo: p.codigo,
                descripcion: p.descripcion,
                precio_sin_igv: p.precio_sin_igv,
                marca: p.marca,
                categoria: p.categoria_nombre,
                unidad_medida: p.unidad_medida
            }));

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/productos/upload/masivo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    productos: productosParaUpload,
                    reemplazarDuplicados // NUEVO PARÁMETRO
                })
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error al procesar el upload');
            }

            setUploadResults(data.data);
            setStep(5); // Results
            
            // Notificar al componente padre
            if (onUploadComplete) {
                onUploadComplete(data.data);
            }
            
        } catch (error) {
            console.error('Error en upload:', error);
            setError(error.message);
            setStep(2); // Volver al preview
        } finally {
            setUploading(false);
        }
    };

    // Handlers de drag & drop
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        if (!dropZoneRef.current?.contains(e.relatedTarget)) {
            setDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, []);

    const handleFileSelect = (selectedFile) => {
        const validationError = validarArchivo(selectedFile);
        if (validationError) {
            setError(validationError);
            return;
        }
        
        setFile(selectedFile);
        leerArchivo(selectedFile);
    };

    const handleFileInputChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };

    // Ir al paso anterior
    const handleBackStep = () => {
        if (step === 2) {
            setStep(1);
            setValidationResults(null);
            setError('');
        } else if (step === 3) {
            setStep(2); // Desde modal duplicados a preview
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-green-100">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-200 rounded-lg mr-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Upload Masivo de Productos
                            </h3>
                            <p className="text-sm text-gray-600">
                                {step === 1 && 'Selecciona un archivo Excel o CSV'}
                                {step === 2 && 'Revisa los datos antes de importar'}
                                {step === 3 && 'Gestionar productos duplicados'}
                                {step === 4 && 'Procesando productos...'}
                                {step === 5 && 'Importación completada'}
                            </p>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="flex items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((stepNumber) => (
                            <div
                                key={stepNumber}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                                    step >= stepNumber 
                                        ? 'bg-green-600 text-white' 
                                        : step === 3 && stepNumber === 3 && validationResults?.duplicados === 0
                                        ? 'bg-gray-200 text-gray-400' // Skip step 3 if no duplicates
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                            >
                                {stepNumber}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleClose}
                        disabled={uploading}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-white transition-colors duration-150 disabled:opacity-50"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Contenido */}
                <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                    {/* STEP 1: Upload Zone */}
                    {step === 1 && (
                        <div className="p-6">
                            {/* Botón descargar plantilla */}
                            <div className="mb-6 text-center">
                                <button
                                    onClick={generarPlantilla}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Descargar Plantilla Excel
                                </button>
                                <p className="text-sm text-gray-600 mt-2">
                                    Descarga la plantilla con el formato correcto y ejemplos
                                </p>
                            </div>

                            {/* Drag & Drop Zone */}
                            <div
                                ref={dropZoneRef}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
                                    dragOver
                                        ? 'border-green-400 bg-green-50'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                                </svg>
                                <div className="mb-4">
                                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                                        Arrastra tu archivo aquí
                                    </h4>
                                    <p className="text-gray-600">
                                        Soporta archivos Excel (.xlsx, .xls) y CSV (.csv)
                                    </p>
                                </div>
                                <div className="mb-4">
                                    <span className="text-gray-500">o</span>
                                </div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
                                >
                                    Seleccionar Archivo
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />
                                <div className="mt-4 text-sm text-gray-500">
                                    Máximo 5MB • Hasta 1000 productos
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                                    <div className="flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {error}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Preview y Validación */}
                    {step === 2 && (
                        <div className="p-6">
                            <div className="mb-6">
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    Vista Previa - {productos.length} productos
                                </h4>
                                <p className="text-gray-600">
                                    Revisa los datos antes de importar. Se validarán automáticamente.
                                </p>
                            </div>

                            {/* Tabla preview */}
                            <div className="overflow-x-auto border rounded-lg mb-6">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fila</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {productos.slice(0, 10).map((producto, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {producto.fila}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {producto.codigo}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                                    {producto.descripcion}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    $ {producto.precio_sin_igv}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {producto.marca}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {producto.categoria}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {productos.length > 10 && (
                                <p className="text-center text-gray-500 mb-6">
                                    Mostrando primeros 10 productos de {productos.length} total
                                </p>
                            )}

                            {/* Resultados de validación */}
                            {validationResults && (
                                <div className="mt-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-blue-800 font-medium">Total</span>
                                                <span className="text-2xl font-bold text-blue-600">
                                                    {validationResults.totalFilas}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-green-800 font-medium">Válidos</span>
                                                <span className="text-2xl font-bold text-green-600">
                                                    {validationResults.productosValidos}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-yellow-800 font-medium">Duplicados</span>
                                                <span className="text-2xl font-bold text-yellow-600">
                                                    {validationResults.duplicados}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-red-800 font-medium">Errores</span>
                                                <span className="text-2xl font-bold text-red-600">
                                                    {validationResults.errores}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mostrar errores si los hay */}
                                    {validationResults.resumen.errores.length > 0 && (
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                            <h5 className="font-medium text-red-800 mb-2">Errores encontrados:</h5>
                                            <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                                {validationResults.resumen.errores.slice(0, 10).map((error, index) => (
                                                    <li key={index}>• {error}</li>
                                                ))}
                                                {validationResults.resumen.errores.length > 10 && (
                                                    <li>• Y {validationResults.resumen.errores.length - 10} errores más...</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Mostrar duplicados si los hay */}
                                    {validationResults.resumen.duplicados.length > 0 && (
                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                            <h5 className="font-medium text-yellow-800 mb-2">Códigos duplicados encontrados:</h5>
                                            <ul className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
                                                {validationResults.resumen.duplicados.slice(0, 10).map((duplicado, index) => (
                                                    <li key={index}>• {duplicado}</li>
                                                ))}
                                                {validationResults.resumen.duplicados.length > 10 && (
                                                    <li>• Y {validationResults.resumen.duplicados.length - 10} duplicados más...</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Modal de Duplicados */}
                    {step === 3 && validationResults && (
                        <div className="p-6">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    Productos Duplicados Detectados
                                </h4>
                                <p className="text-gray-600">
                                    Se encontraron <strong>{validationResults.duplicados}</strong> productos que ya existen en la base de datos
                                </p>
                            </div>

                            {/* Mostrar algunos duplicados */}
                            <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                <h5 className="font-medium text-yellow-800 mb-2">Códigos duplicados encontrados:</h5>
                                <div className="flex flex-wrap gap-2">
                                    {validationResults.resumen.duplicados.slice(0, 10).map((duplicado, index) => {
                                        const codigo = duplicado.split('"')[1]; // Extraer código de "Fila X: Código "ABC" ya existe"
                                        return (
                                            <span key={index} className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-sm">
                                                {codigo}
                                            </span>
                                        );
                                    })}
                                    {validationResults.resumen.duplicados.length > 10 && (
                                        <span className="text-yellow-700 text-sm">
                                            +{validationResults.resumen.duplicados.length - 10} más...
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Opciones */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Opción: Reemplazar */}
                                    <button
                                        onClick={() => handleDuplicatesDecision('replace')}
                                        className="p-4 border-2 border-orange-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors text-left"
                                    >
                                        <div className="flex items-center mb-2">
                                            <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span className="font-medium text-orange-900">Reemplazar Datos</span>
                                        </div>
                                        <p className="text-sm text-orange-700">
                                            Actualizar los productos existentes con los nuevos datos de la plantilla
                                        </p>
                                        <p className="text-xs text-orange-600 mt-1">
                                            Importará: {validationResults.productosValidos} productos (actualiza {validationResults.duplicados})
                                        </p>
                                    </button>

                                    {/* Opción: Omitir */}
                                    <button
                                        onClick={() => handleDuplicatesDecision('skip')}
                                        className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                                    >
                                        <div className="flex items-center mb-2">
                                            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            <span className="font-medium text-blue-900">Solo Nuevos</span>
                                        </div>
                                        <p className="text-sm text-blue-700">
                                            Importar únicamente los productos nuevos, omitir duplicados
                                        </p>
                                        <p className="text-xs text-blue-600 mt-1">
                                            Importará: {validationResults.productosValidos - validationResults.duplicados} productos nuevos
                                        </p>
                                    </button>
                                </div>

                                {/* Opción: Cancelar */}
                                <div className="text-center">
                                    <button
                                        onClick={() => handleDuplicatesDecision('cancel')}
                                        className="text-gray-600 hover:text-gray-800 underline text-sm"
                                    >
                                        Volver al preview para revisar datos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Processing */}
                    {step === 4 && (
                        <div className="p-6 text-center">
                            <div className="mb-6">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-green-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    Procesando productos...
                                </h4>
                                <p className="text-gray-600">
                                    Por favor espera mientras importamos los productos
                                </p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                                <div 
                                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                            <p className="text-sm text-gray-600">{uploadProgress}% completado</p>
                        </div>
                    )}

                    {/* STEP 5: Results */}
                    {step === 5 && uploadResults && (
                        <div className="p-6">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    ¡Importación Completada!
                                </h4>
                                <p className="text-gray-600">
                                    Los productos han sido procesados exitosamente
                                </p>
                            </div>

                            {/* Resultados detallados */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-green-800 font-medium">Nuevos Insertados</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            {uploadResults.productosInsertados}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-orange-800 font-medium">Actualizados</span>
                                        <span className="text-2xl font-bold text-orange-600">
                                            {uploadResults.productosActualizados || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-800 font-medium">Total Procesados</span>
                                        <span className="text-2xl font-bold text-blue-600">
                                            {uploadResults.totalProcesados}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Información adicional */}
                            {uploadResults.productosOmitidos > 0 && (
                                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <h5 className="font-medium text-gray-800 mb-2">
                                        Productos Omitidos ({uploadResults.productosOmitidos})
                                    </h5>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Los siguientes códigos fueron omitidos por estar duplicados:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {uploadResults.codigosOmitidos?.slice(0, 10).map((codigo, index) => (
                                            <span key={index} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                                                {codigo}
                                            </span>
                                        ))}
                                        {(uploadResults.codigosOmitidos?.length || 0) > 10 && (
                                            <span className="text-gray-600 text-xs">
                                                +{uploadResults.codigosOmitidos.length - 10} más...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-4">
                                    La lista de productos se ha actualizado automáticamente
                                </p>
                                <button
                                    onClick={handleClose}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
                                >
                                    Ver Productos Importados
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                    <div className="flex space-x-3">
                        {(step === 2 || step === 3) && !uploading && (
                            <button
                                onClick={handleBackStep}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150"
                            >
                                ← Atrás
                            </button>
                        )}
                    </div>
                    
                    <div className="flex space-x-3">
                        <button
                            onClick={handleClose}
                            disabled={uploading}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50"
                        >
                            {step === 5 ? 'Cerrar' : 'Cancelar'}
                        </button>
                        
                        {step === 2 && !validationResults && (
                            <button
                                onClick={validarDatos}
                                disabled={uploading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50"
                            >
                                Validar Datos
                            </button>
                        )}
                        
                        {step === 2 && validationResults && validationResults.errores === 0 && (
                            <button
                                onClick={handleProceedToUpload}
                                disabled={uploading}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-150 disabled:opacity-50"
                            >
                                {validationResults.duplicados > 0 
                                    ? `Continuar (${validationResults.duplicados} duplicados detectados)`
                                    : `Importar ${validationResults.productosValidos} Productos`
                                }
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadMasivo;
