// ============================================
// VISTA TRIMESTRAL
// ============================================

const VistaTrimestral = ({ actividades, trimestre, anio }) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Calcular meses del trimestre
    const mesInicio = (trimestre - 1) * 3;
    const mesesTrimestre = [mesInicio, mesInicio + 1, mesInicio + 2];

    // Agrupar actividades por mes
    const actividadesPorMes = mesesTrimestre.map(mes => {
        const actsMes = actividades.filter(act => {
            const fecha = new Date(act.fecha_inicio_planeada);
            return fecha.getMonth() === mes && fecha.getFullYear() === anio;
        });

        return {
            mes,
            nombre: meses[mes],
            actividades: actsMes,
            estadisticas: {
                total: actsMes.length,
                completadas: actsMes.filter(a => a.estado === 'completada').length,
                enProgreso: actsMes.filter(a => a.estado === 'en_progreso').length,
                pendientes: actsMes.filter(a => a.estado === 'pendiente').length,
                horasPlaneadas: actsMes.reduce((sum, a) => sum + a.duracion_planeada_minutos + (a.tiempo_adicional_minutos || 0), 0) / 60
            }
        };
    });

    // Agrupar por categoría
    const actividadesPorCategoria = actividades.reduce((acc, act) => {
        if (!acc[act.categoria_principal]) {
            acc[act.categoria_principal] = [];
        }
        acc[act.categoria_principal].push(act);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Resumen por mes */}
            <div className="grid grid-cols-3 gap-4">
                {actividadesPorMes.map(({ mes, nombre, estadisticas }) => (
                    <div key={mes} className="bg-white rounded-lg border border-gray-200 p-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">{nombre}</h3>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total actividades:</span>
                                <span className="text-lg font-bold text-gray-900">{estadisticas.total}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Completadas:</span>
                                <span className="text-sm font-bold text-green-600">{estadisticas.completadas}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">En progreso:</span>
                                <span className="text-sm font-bold text-blue-600">{estadisticas.enProgreso}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Pendientes:</span>
                                <span className="text-sm font-bold text-gray-600">{estadisticas.pendientes}</span>
                            </div>

                            <div className="pt-3 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Horas planeadas:</span>
                                    <span className="text-sm font-bold text-purple-600">
                                        {estadisticas.horasPlaneadas.toFixed(1)}h
                                    </span>
                                </div>
                            </div>

                            {/* Barra de progreso */}
                            {estadisticas.total > 0 && (
                                <div className="pt-2">
                                    <div className="flex gap-1 h-2 rounded overflow-hidden">
                                        {estadisticas.completadas > 0 && (
                                            <div
                                                className="bg-green-500"
                                                style={{ width: `${(estadisticas.completadas / estadisticas.total) * 100}%` }}
                                            ></div>
                                        )}
                                        {estadisticas.enProgreso > 0 && (
                                            <div
                                                className="bg-blue-500"
                                                style={{ width: `${(estadisticas.enProgreso / estadisticas.total) * 100}%` }}
                                            ></div>
                                        )}
                                        {estadisticas.pendientes > 0 && (
                                            <div
                                                className="bg-gray-300"
                                                style={{ width: `${(estadisticas.pendientes / estadisticas.total) * 100}%` }}
                                            ></div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actividades por categoría */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Distribución por Categoría
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(actividadesPorCategoria).map(([categoria, acts]) => (
                        <div key={categoria} className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-sm font-semibold text-gray-700 mb-2">{categoria}</div>
                            <div className="text-2xl font-bold text-gray-900">{acts.length}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {((acts.length / actividades.length) * 100).toFixed(1)}% del total
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VistaTrimestral;
