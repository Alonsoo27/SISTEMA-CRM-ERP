// ============================================
// INDICADOR DE ANÁLISIS DE TIEMPO
// ============================================

const IndicadorTiempo = ({ datos }) => {
    if (!datos) return null;

    const { tiempos, eficiencia, actividadesExcedidas } = datos;

    // Determinar color según eficiencia
    const getEficienciaColor = () => {
        if (eficiencia <= 100) return 'text-green-600';
        if (eficiencia <= 120) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getEficienciaBgColor = () => {
        if (eficiencia <= 100) return 'bg-green-50';
        if (eficiencia <= 120) return 'bg-yellow-50';
        return 'bg-red-50';
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">⏱️</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Análisis de Tiempo</h3>
                    <p className="text-sm text-gray-500">Planeado vs Real</p>
                </div>
            </div>

            {/* Eficiencia principal */}
            <div className={`rounded-lg p-4 text-center mb-6 ${getEficienciaBgColor()}`}>
                <div className={`text-4xl font-bold ${getEficienciaColor()}`}>{eficiencia}%</div>
                <div className="text-xs text-gray-600 mt-1">Eficiencia de Tiempo</div>
                <div className="text-xs text-gray-500 mt-1">
                    {eficiencia <= 100 ? '✅ Dentro del tiempo planeado' :
                     eficiencia <= 120 ? '⚠️ Ligero desfase' :
                     '🔴 Requiere atención'}
                </div>
            </div>

            {/* Comparativa de tiempos */}
            <div className="space-y-4 mb-6">
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">Tiempo Planeado</span>
                        <span className="text-sm font-bold text-blue-600">{tiempos.totalPlaneadoHoras}h</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className="bg-blue-500 h-3 rounded-full"
                            style={{ width: '100%' }}
                        ></div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">Tiempo Real</span>
                        <span className={`text-sm font-bold ${getEficienciaColor()}`}>{tiempos.totalRealHoras}h</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full ${
                                eficiencia <= 100 ? 'bg-green-500' :
                                eficiencia <= 120 ? 'bg-yellow-500' :
                                'bg-red-500'
                            }`}
                            style={{
                                width: `${Math.min((tiempos.totalReal / tiempos.totalPlaneado) * 100, 100)}%`
                            }}
                        ></div>
                    </div>
                </div>

                {tiempos.totalAdicional > 0 && (
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">Tiempo Adicional</span>
                            <span className="text-sm font-bold text-orange-600">{tiempos.totalAdicionalHoras}h</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className="bg-orange-500 h-3 rounded-full"
                                style={{
                                    width: `${Math.min((tiempos.totalAdicional / tiempos.totalPlaneado) * 100, 100)}%`
                                }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Métricas adicionales */}
            <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-gray-600">Actividades que excedieron tiempo</span>
                    <span className="text-sm font-bold text-gray-900">{actividadesExcedidas}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Diferencia promedio</span>
                    <span className={`text-sm font-bold ${getEficienciaColor()}`}>
                        {eficiencia > 100 ? '+' : ''}{(eficiencia - 100).toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default IndicadorTiempo;
