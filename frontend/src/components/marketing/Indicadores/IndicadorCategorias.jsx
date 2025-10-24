// ============================================
// INDICADOR DE ANÁLISIS POR CATEGORÍA
// ============================================

// Colores por categoría (mismo mapeo del backend)
const COLORES_CATEGORIAS = {
    'GRABACIONES': '#3B82F6',
    'EDICIONES': '#F59E0B',
    'LIVES': '#EC4899',
    'DISEÑO': '#A855F7',
    'FICHAS TÉCNICAS': '#64748B',
    'FERIA': '#0EA5E9',
    'REUNIONES': '#84CC16',
    'PRUEBAS Y MUESTRAS': '#F43F5E',
    'CAPACITACIONES': '#16A34A'
};

const IndicadorCategorias = ({ datos }) => {
    if (!datos) return null;

    const { categorias } = datos;

    // Ordenar por total de actividades (top 5)
    const topCategorias = [...categorias]
        .sort((a, b) => b.totalActividades - a.totalActividades)
        .slice(0, 5);

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎯</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Por Categoría</h3>
                    <p className="text-sm text-gray-500">Análisis por tipo de actividad</p>
                </div>
            </div>

            {/* Top categorías */}
            {topCategorias.length > 0 ? (
                <div className="space-y-4">
                    {topCategorias.map((cat, index) => {
                        const color = COLORES_CATEGORIAS[cat.categoria] || '#6B7280';
                        const porcentaje = categorias.length > 0
                            ? (cat.totalActividades / categorias.reduce((sum, c) => sum + c.totalActividades, 0)) * 100
                            : 0;

                        return (
                            <div key={cat.categoria} className="space-y-2">
                                {/* Header de categoría */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded"
                                            style={{ backgroundColor: color }}
                                        ></div>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {cat.categoria}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {cat.totalActividades} actividades
                                    </span>
                                </div>

                                {/* Barra de progreso */}
                                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                                    <div
                                        className="h-6 flex items-center justify-between px-3 text-white text-xs font-medium"
                                        style={{
                                            width: `${porcentaje}%`,
                                            backgroundColor: color,
                                            minWidth: '60px'
                                        }}
                                    >
                                        <span>{porcentaje.toFixed(0)}%</span>
                                        <span>{cat.horasTotales}h</span>
                                    </div>
                                </div>

                                {/* Métricas de la categoría */}
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="text-center p-2 bg-gray-50 rounded">
                                        <div className="font-bold text-gray-900">{cat.completadas}</div>
                                        <div className="text-gray-600">Completadas</div>
                                    </div>
                                    <div className="text-center p-2 bg-gray-50 rounded">
                                        <div className="font-bold text-green-600">{cat.tasaExito}%</div>
                                        <div className="text-gray-600">Tasa Éxito</div>
                                    </div>
                                    <div className="text-center p-2 bg-gray-50 rounded">
                                        <div className="font-bold text-gray-900">{cat.duracionPromedio}m</div>
                                        <div className="text-gray-600">Duración Prom.</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-sm font-medium">Sin actividades registradas</p>
                    <p className="text-xs mt-1">Crea actividades para ver el análisis por categoría</p>
                </div>
            )}

            {/* Resumen total */}
            {categorias.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Total de categorías:</span>
                        <span className="font-bold text-gray-900">{categorias.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-gray-600">Horas totales:</span>
                        <span className="font-bold text-gray-900">
                            {categorias.reduce((sum, c) => sum + parseFloat(c.horasTotales), 0).toFixed(1)}h
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IndicadorCategorias;
