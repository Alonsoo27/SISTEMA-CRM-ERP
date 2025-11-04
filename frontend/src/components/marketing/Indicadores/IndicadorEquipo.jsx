// ============================================
// INDICADOR DE RENDIMIENTO DEL EQUIPO
// ============================================

const IndicadorEquipo = ({ datos, esJefe }) => {
    if (!datos) return null;

    const { ranking, globales } = datos;

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Rendimiento del Equipo</h3>
                    <p className="text-sm text-gray-500">Comparativa general</p>
                </div>
            </div>

            {/* Estadísticas globales */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{globales.miembrosActivos}</div>
                    <div className="text-xs text-gray-600 mt-1">Miembros Activos</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{globales.totalActividades}</div>
                    <div className="text-xs text-gray-600 mt-1">Total Actividades</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{globales.totalCompletadas}</div>
                    <div className="text-xs text-gray-600 mt-1">Completadas</div>
                </div>
            </div>

            {/* Ranking de usuarios */}
            <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">🏆 Top Performers</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ranking.length > 0 ? (
                        ranking.slice(0, 5).map((usuario, index) => (
                            <div
                                key={usuario.id}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                            >
                                {/* Posición */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                    {index + 1}
                                </div>

                                {/* Nombre y avatar */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">
                                        {usuario.nombre_completo}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {usuario.completadas}/{usuario.total_actividades} completadas
                                    </div>
                                </div>

                                {/* Eficiencia */}
                                <div className="flex-shrink-0 text-right">
                                    <div className={`text-sm font-bold ${
                                        parseFloat(usuario.eficiencia_promedio) >= 100
                                            ? 'text-green-600'
                                            : parseFloat(usuario.eficiencia_promedio) >= 80
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                    }`}>
                                        {usuario.eficiencia_promedio}%
                                    </div>
                                    <div className="text-xs text-gray-500">eficiencia</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <div className="text-3xl mb-2">📊</div>
                            <p className="text-sm">No hay datos del equipo aún</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Métricas adicionales */}
            <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">👥 Actividades grupales</span>
                    <span className="font-bold text-gray-900">{globales.actividadesGrupales}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">➕ Total extensiones</span>
                    <span className="font-bold text-gray-900">{(globales.totalExtensiones / 60).toFixed(1)}h</span>
                </div>
            </div>
        </div>
    );
};

export default IndicadorEquipo;
