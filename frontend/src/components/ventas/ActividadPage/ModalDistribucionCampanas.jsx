// ============================================
// MODAL DISTRIBUCIÓN DE CAMPAÑAS
// Modal intermedio para distribuir mensajes entre campañas
// ============================================

import React, { useState, useEffect } from 'react';
import { Target, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';

const ModalDistribucionCampanas = ({
    isOpen,
    lineasCampanas,
    mensajesCheckIn,
    onConfirm,
    onCancel
}) => {
    const [distribucion, setDistribucion] = useState({});
    const [mensajesAdicionales, setMensajesAdicionales] = useState({
        meta: 0,
        whatsapp: 0,
        instagram: 0,
        tiktok: 0
    });

    // Inicializar distribución equitativa
    useEffect(() => {
        if (isOpen && lineasCampanas && lineasCampanas.length > 0) {
            const porcentajeInicial = Math.round(100 / lineasCampanas.length);
            const distribucionInicial = {};

            lineasCampanas.forEach((linea, index) => {
                // Ajustar el último para que sume exactamente 100
                if (index === lineasCampanas.length - 1) {
                    const suma = Object.values(distribucionInicial).reduce((a, b) => a + b, 0);
                    distribucionInicial[linea] = 100 - suma;
                } else {
                    distribucionInicial[linea] = porcentajeInicial;
                }
            });

            setDistribucion(distribucionInicial);
        }
    }, [isOpen, lineasCampanas]);

    if (!isOpen) return null;

    const totalPorcentaje = Object.values(distribucion).reduce((a, b) => a + b, 0);
    const totalMensajesAdicionales = Object.values(mensajesAdicionales).reduce((a, b) => a + b, 0);
    const totalMensajes = mensajesCheckIn + totalMensajesAdicionales;

    const esValidoSubmit = totalPorcentaje >= 98 && totalPorcentaje <= 102;

    const handleSliderChange = (linea, nuevoValor) => {
        const valor = parseInt(nuevoValor) || 0;

        // Ajustar otras líneas proporcionalmente
        const otrasLineas = lineasCampanas.filter(l => l !== linea);
        const totalOtras = otrasLineas.reduce((sum, l) => sum + (distribucion[l] || 0), 0);

        if (totalOtras === 0) {
            // Si otras están en 0, distribuir equitativamente
            const porcentajeRestante = 100 - valor;
            const porOtraLinea = Math.floor(porcentajeRestante / otrasLineas.length);

            const nuevaDistribucion = { [linea]: valor };
            otrasLineas.forEach((l, idx) => {
                if (idx === otrasLineas.length - 1) {
                    // Última línea recibe el remanente
                    nuevaDistribucion[l] = 100 - valor - (porOtraLinea * (otrasLineas.length - 1));
                } else {
                    nuevaDistribucion[l] = porOtraLinea;
                }
            });

            setDistribucion(nuevaDistribucion);
        } else {
            // Ajustar proporcionalmente
            const diferencia = valor - (distribucion[linea] || 0);
            const factor = (totalOtras + diferencia) / totalOtras;

            const nuevaDistribucion = { ...distribucion, [linea]: valor };
            otrasLineas.forEach(l => {
                const nuevoValor = Math.round(distribucion[l] / factor);
                nuevaDistribucion[l] = nuevoValor;
            });

            setDistribucion(nuevaDistribucion);
        }
    };

    const handleInputChange = (linea, value) => {
        const valor = parseInt(value) || 0;
        const valorLimitado = Math.min(Math.max(0, valor), 100);
        setDistribucion({
            ...distribucion,
            [linea]: valorLimitado
        });
    };

    const handleConfirm = () => {
        if (!esValidoSubmit) return;

        // Normalizar al 100% si está dentro de tolerancia
        const factor = 100 / totalPorcentaje;
        const distribucionNormalizada = {};
        Object.entries(distribucion).forEach(([linea, porcentaje]) => {
            distribucionNormalizada[linea] = Math.round(porcentaje * factor);
        });

        onConfirm(distribucionNormalizada, mensajesAdicionales);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-lg">
                    <div className="flex items-center space-x-3">
                        <Target className="h-8 w-8" />
                        <div>
                            <h2 className="text-xl font-bold">Distribución de Campañas</h2>
                            <p className="text-sm text-purple-100">
                                ¿Cómo distribuiste tu tiempo entre las campañas?
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Resumen de mensajes */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Total de mensajes del día</p>
                                <p className="text-3xl font-bold text-blue-600">{totalMensajes}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Check-in: <span className="font-semibold">{mensajesCheckIn}</span></p>
                                <p className="text-sm text-gray-600">Adicionales: <span className="font-semibold">{totalMensajesAdicionales}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Sliders de distribución */}
                    <div className="space-y-5 mb-6">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                            <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                            Ajusta la distribución porcentual
                        </h4>

                        {lineasCampanas.map((linea) => {
                            const mensajesAsignados = Math.round(totalMensajes * (distribucion[linea] || 0) / 100);

                            return (
                                <div key={linea} className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium text-gray-900">{linea}</span>
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={distribucion[linea] || 0}
                                                onChange={(e) => handleInputChange(linea, e.target.value)}
                                                className="w-16 px-2 py-1 border border-gray-300 rounded text-center font-bold"
                                            />
                                            <span className="text-sm text-gray-600">%</span>
                                        </div>
                                    </div>

                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={distribucion[linea] || 0}
                                        onChange={(e) => handleSliderChange(linea, e.target.value)}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    />

                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>0%</span>
                                        <span className="font-semibold text-purple-600">
                                            ≈ {mensajesAsignados} mensajes
                                        </span>
                                        <span>100%</span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Validación */}
                        <div className={`flex items-center p-3 rounded-lg ${
                            esValidoSubmit
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                        }`}>
                            {esValidoSubmit ? (
                                <>
                                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                    <span className="text-sm text-green-800">
                                        Distribución válida: {totalPorcentaje}%
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                                    <span className="text-sm text-red-800">
                                        La suma debe estar entre 98-102% (actual: {totalPorcentaje}%)
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mensajes adicionales */}
                    <div className="border-t pt-5">
                        <h4 className="font-semibold text-gray-900 mb-3">
                            ¿Recibiste mensajes adicionales durante el día?
                        </h4>
                        <p className="text-sm text-gray-600 mb-4">
                            Si recibiste más mensajes después del check-in, agrégalos aquí:
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Meta/Facebook
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={mensajesAdicionales.meta}
                                    onChange={(e) => setMensajesAdicionales({
                                        ...mensajesAdicionales,
                                        meta: parseInt(e.target.value) || 0
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    WhatsApp
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={mensajesAdicionales.whatsapp}
                                    onChange={(e) => setMensajesAdicionales({
                                        ...mensajesAdicionales,
                                        whatsapp: parseInt(e.target.value) || 0
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Instagram
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={mensajesAdicionales.instagram}
                                    onChange={(e) => setMensajesAdicionales({
                                        ...mensajesAdicionales,
                                        instagram: parseInt(e.target.value) || 0
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    TikTok
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={mensajesAdicionales.tiktok}
                                    onChange={(e) => setMensajesAdicionales({
                                        ...mensajesAdicionales,
                                        tiktok: parseInt(e.target.value) || 0
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex space-x-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!esValidoSubmit}
                            className={`flex-1 px-4 py-3 rounded-lg font-semibold text-white transition-colors ${
                                esValidoSubmit
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                                    : 'bg-gray-400 cursor-not-allowed'
                            }`}
                        >
                            Continuar al Check-out
                        </button>
                    </div>

                    {/* Nota informativa */}
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                            <strong>Tip:</strong> Usa los sliders para ajustar rápidamente. La suma se normalizará automáticamente al 100%.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalDistribucionCampanas;
