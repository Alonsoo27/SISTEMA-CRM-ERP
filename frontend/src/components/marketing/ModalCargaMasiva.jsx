// ============================================
// MODAL DE CARGA MASIVA - MARKETING
// Importación de actividades desde Excel
// ============================================

import { useState, useRef } from 'react';
import marketingService from '../../services/marketingService';

const ModalCargaMasiva = ({ onClose, onSuccess }) => {
    const [archivo, setArchivo] = useState(null);
    const [arrastrando, setArrastrando] = useState(false);
    const [procesando, setProcessando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleDescargarPlantilla = async () => {
        try {
            await marketingService.descargarPlantilla();
        } catch (error) {
            console.error('Error descargando plantilla:', error);
            setError('Error al descargar la plantilla');
        }
    };

    const handleArchivoSeleccionado = (file) => {
        if (!file) return;

        // Validar tipo de archivo
        const extensionesValidas = ['.xlsx', '.xls'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!extensionesValidas.includes(extension)) {
            setError('Solo se permiten archivos Excel (.xlsx, .xls)');
            return;
        }

        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            setError('El archivo no puede superar los 5MB');
            return;
        }

        setArchivo(file);
        setError(null);
        setResultado(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(false);

        const file = e.dataTransfer.files[0];
        handleArchivoSeleccionado(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(false);
    };

    const handleFileInputChange = (e) => {
        const file = e.target.files[0];
        handleArchivoSeleccionado(file);
    };

    const handleProcesar = async () => {
        if (!archivo) {
            setError('Por favor selecciona un archivo');
            return;
        }

        try {
            setProcessando(true);
            setError(null);

            const response = await marketingService.procesarCargaMasiva(archivo);

            setResultado(response);

            // Si fue exitoso y tiene un callback, ejecutarlo después de 2 segundos
            if (response.success && onSuccess) {
                setTimeout(() => {
                    onSuccess();
                }, 2000);
            }

        } catch (err) {
            console.error('Error procesando carga masiva:', err);
            setError(err.message || 'Error al procesar el archivo');
            setResultado(err);
        } finally {
            setProcessando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-green-600 to-blue-600">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            📊 Carga Masiva de Actividades
                        </h2>
                        <p className="text-green-100 text-sm mt-1">
                            Importa múltiples actividades desde Excel
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {/* Paso 1: Descargar plantilla */}
                    <div className="mb-6">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                                1
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">Descarga la plantilla Excel</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    La plantilla incluye ejemplos y categorías disponibles
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleDescargarPlantilla}
                            className="ml-11 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Descargar Plantilla
                        </button>
                    </div>

                    {/* Paso 2: Subir archivo */}
                    <div className="mb-6">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                                2
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">Sube tu archivo completado</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Arrastra el archivo o haz clic para seleccionar
                                </p>
                            </div>
                        </div>

                        <div className="ml-11">
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                                    arrastrando
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />

                                {archivo ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-900">{archivo.name}</p>
                                            <p className="text-sm text-gray-500">
                                                {(archivo.size / 1024).toFixed(2)} KB
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setArchivo(null);
                                                setError(null);
                                                setResultado(null);
                                            }}
                                            className="ml-auto p-2 text-red-600 hover:bg-red-50 rounded-full"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p className="text-gray-600 mb-1">
                                            Arrastra tu archivo Excel aquí
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            o haz clic para seleccionar (máx 5MB)
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Errores */}
                    {error && !resultado && (
                        <div className="mb-6 ml-11 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex gap-2">
                                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-semibold text-red-800">Error</p>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Resultado con errores */}
                    {resultado && !resultado.success && resultado.errores && (
                        <div className="mb-6 ml-11 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-h-64 overflow-y-auto">
                            <div className="flex gap-2 mb-3">
                                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-semibold text-yellow-800">Se encontraron {resultado.errores.length} error(es)</p>
                                    <p className="text-sm text-yellow-700 mb-2">
                                        Actividades válidas: {resultado.actividades_validas || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {resultado.errores.map((err, index) => (
                                    <div key={index} className="bg-white p-2 rounded border border-yellow-300">
                                        <p className="text-sm font-medium text-gray-900">Fila {err.fila}:</p>
                                        <ul className="text-sm text-gray-700 list-disc list-inside">
                                            {err.errores.map((e, i) => (
                                                <li key={i}>{e}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resultado exitoso */}
                    {resultado && resultado.success && (
                        <div className="mb-6 ml-11 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex gap-2">
                                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-semibold text-green-800">¡Carga exitosa!</p>
                                    <p className="text-sm text-green-700">
                                        Se crearon {resultado.actividades_creadas} actividad(es) en {resultado.actividades_agrupadas} grupo(s)
                                    </p>
                                    <p className="text-xs text-green-600 mt-1">
                                        Recargando página...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            disabled={procesando}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                        >
                            {resultado?.success ? 'Cerrar' : 'Cancelar'}
                        </button>
                        {!resultado?.success && (
                            <button
                                onClick={handleProcesar}
                                disabled={!archivo || procesando}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {procesando ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Procesar Archivo
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalCargaMasiva;
