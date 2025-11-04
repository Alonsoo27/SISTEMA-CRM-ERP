// ============================================
// INDICADOR DE RENDIMIENTO INDIVIDUAL
// ============================================

const IndicadorIndividual = ({ datos }) => {
    console.log('👤 IndicadorIndividual recibió datos:', datos);

    if (!datos) {
        console.log('⚠️ IndicadorIndividual: No hay datos, retornando null');
        return null;
    }

    const {
        totales,
        tasaCompletitud,
        prioritariasCompletadas,
        tiempoPromedio,
        extensiones,
        actividadesVencidas,
        actividadesTransferidas,
        tasaVencimiento
    } = datos;
    console.log('✅ IndicadorIndividual renderizando con:', { totales, tasaCompletitud });

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Rendimiento Individual</h3>
                    <p className="text-sm text-gray-500">Productividad personal</p>
                </div>
            </div>

            {/* Estadísticas principales */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-gray-900">{totales.total}</div>
                    <div className="text-xs text-gray-600 mt-1">Total Actividades</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{tasaCompletitud}%</div>
                    <div className="text-xs text-gray-600 mt-1">Tasa de Éxito</div>
                </div>
            </div>

            {/* Gráfico circular de estados */}
            <div className="mb-6">
                <div className="flex items-center justify-center h-24">
                    {/* Barra de progreso horizontal */}
                    <div className="w-full">
                        <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                            {totales.completadas > 0 && (
                                <div
                                    className="bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(totales.completadas / totales.total) * 100}%` }}
                                    title={`${totales.completadas} completadas`}
                                >
                                    {totales.completadas}
                                </div>
                            )}
                            {totales.en_progreso > 0 && (
                                <div
                                    className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(totales.en_progreso / totales.total) * 100}%` }}
                                    title={`${totales.en_progreso} en progreso`}
                                >
                                    {totales.en_progreso}
                                </div>
                            )}
                            {totales.pendientes > 0 && (
                                <div
                                    className="bg-gray-400 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(totales.pendientes / totales.total) * 100}%` }}
                                    title={`${totales.pendientes} pendientes`}
                                >
                                    {totales.pendientes}
                                </div>
                            )}
                            {totales.pausadas > 0 && (
                                <div
                                    className="bg-yellow-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(totales.pausadas / totales.total) * 100}%` }}
                                    title={`${totales.pausadas} pausadas`}
                                >
                                    {totales.pausadas}
                                </div>
                            )}
                            {totales.canceladas > 0 && (
                                <div
                                    className="bg-red-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(totales.canceladas / totales.total) * 100}%` }}
                                    title={`${totales.canceladas} canceladas`}
                                >
                                    {totales.canceladas}
                                </div>
                            )}
                            {totales.no_realizada > 0 && (
                                <div
                                    className="bg-orange-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(totales.no_realizada / totales.total) * 100}%` }}
                                    title={`${totales.no_realizada} no realizadas`}
                                >
                                    {totales.no_realizada}
                                </div>
                            )}
                        </div>

                        {/* Leyenda */}
                        <div className="flex flex-wrap gap-3 mt-3 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-500 rounded"></div>
                                <span>Completadas ({totales.completadas})</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                <span>En progreso ({totales.en_progreso})</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-gray-400 rounded"></div>
                                <span>Pendientes ({totales.pendientes})</span>
                            </div>
                            {totales.no_realizada > 0 && (
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                                    <span>No realizadas ({totales.no_realizada})</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Métricas adicionales */}
            <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-gray-600">⚡ Prioritarias completadas</span>
                    <span className="text-sm font-bold text-gray-900">{prioritariasCompletadas}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-gray-600">⏱️ Tiempo promedio (planeado)</span>
                    <span className="text-sm font-bold text-gray-900">{tiempoPromedio.planeado} min</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-gray-600">⏰ Tiempo promedio (real)</span>
                    <span className="text-sm font-bold text-gray-900">{tiempoPromedio.real} min</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-gray-600">➕ Extensiones solicitadas</span>
                    <span className="text-sm font-bold text-gray-900">{extensiones}</span>
                </div>

                {/* Indicadores críticos */}
                <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                        ⚠️ Actividades vencidas
                    </span>
                    <span className={`text-sm font-bold ${
                        actividadesVencidas > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                        {actividadesVencidas} ({tasaVencimiento}%)
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                        🔄 Actividades transferidas
                    </span>
                    <span className={`text-sm font-bold ${
                        actividadesTransferidas > 0 ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                        {actividadesTransferidas}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default IndicadorIndividual;
