// ============================================
// VISTA ANUAL
// ============================================

const VistaAnual = ({ actividades, anio }) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Estadísticas por mes
    const estadisticasPorMes = meses.map((nombre, index) => {
        const actsMes = actividades.filter(act => {
            const fecha = new Date(act.fecha_inicio_planeada);
            return fecha.getMonth() === index;
        });

        return {
            mes: index,
            nombre,
            total: actsMes.length,
            completadas: actsMes.filter(a => a.estado === 'completada').length,
            enProgreso: actsMes.filter(a => a.estado === 'en_progreso').length,
            pendientes: actsMes.filter(a => a.estado === 'pendiente').length,
            horasPlaneadas: actsMes.reduce((sum, a) => sum + a.duracion_planeada_minutos + (a.tiempo_adicional_minutos || 0), 0) / 60
        };
    });

    // Calcular totales
    const totales = {
        actividades: actividades.length,
        completadas: actividades.filter(a => a.estado === 'completada').length,
        enProgreso: actividades.filter(a => a.estado === 'en_progreso').length,
        pendientes: actividades.filter(a => a.estado === 'pendiente').length,
        horasPlaneadas: actividades.reduce((sum, a) => sum + a.duracion_planeada_minutos + (a.tiempo_adicional_minutos || 0), 0) / 60
    };

    const maxActividades = Math.max(...estadisticasPorMes.map(m => m.total), 1);

    return (
        <div className="space-y-6">
            {/* Resumen general del año */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                <h2 className="text-3xl font-bold mb-6">Año {anio}</h2>

                <div className="grid grid-cols-4 gap-6">
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-sm opacity-90 mb-1">Total Actividades</div>
                        <div className="text-3xl font-bold">{totales.actividades}</div>
                    </div>

                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-sm opacity-90 mb-1">Completadas</div>
                        <div className="text-3xl font-bold">{totales.completadas}</div>
                        <div className="text-sm opacity-75">
                            {totales.actividades > 0 ? ((totales.completadas / totales.actividades) * 100).toFixed(1) : 0}%
                        </div>
                    </div>

                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-sm opacity-90 mb-1">En Progreso</div>
                        <div className="text-3xl font-bold">{totales.enProgreso}</div>
                    </div>

                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <div className="text-sm opacity-90 mb-1">Horas Totales</div>
                        <div className="text-3xl font-bold">{totales.horasPlaneadas.toFixed(0)}</div>
                        <div className="text-sm opacity-75">horas planeadas</div>
                    </div>
                </div>
            </div>

            {/* Gráfico de barras por mes */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                    Actividades por Mes
                </h3>

                <div className="space-y-3">
                    {estadisticasPorMes.map(mes => (
                        <div key={mes.mes} className="flex items-center gap-4">
                            {/* Nombre del mes */}
                            <div className="w-24 text-sm font-medium text-gray-700 text-right">
                                {mes.nombre}
                            </div>

                            {/* Barra de progreso */}
                            <div className="flex-1 relative">
                                <div className="flex h-8 bg-gray-100 rounded overflow-hidden">
                                    {mes.total > 0 && (
                                        <>
                                            {mes.completadas > 0 && (
                                                <div
                                                    className="bg-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
                                                    style={{ width: `${(mes.completadas / maxActividades) * 100}%` }}
                                                    title={`${mes.completadas} completadas`}
                                                >
                                                    {mes.completadas > 2 && mes.completadas}
                                                </div>
                                            )}
                                            {mes.enProgreso > 0 && (
                                                <div
                                                    className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold transition-all"
                                                    style={{ width: `${(mes.enProgreso / maxActividades) * 100}%` }}
                                                    title={`${mes.enProgreso} en progreso`}
                                                >
                                                    {mes.enProgreso > 2 && mes.enProgreso}
                                                </div>
                                            )}
                                            {mes.pendientes > 0 && (
                                                <div
                                                    className="bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold transition-all"
                                                    style={{ width: `${(mes.pendientes / maxActividades) * 100}%` }}
                                                    title={`${mes.pendientes} pendientes`}
                                                >
                                                    {mes.pendientes > 2 && mes.pendientes}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="w-16 text-sm font-bold text-gray-900 text-right">
                                {mes.total}
                            </div>

                            {/* Horas */}
                            <div className="w-20 text-xs text-gray-500 text-right">
                                {mes.horasPlaneadas.toFixed(0)}h
                            </div>
                        </div>
                    ))}
                </div>

                {/* Leyenda */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-sm text-gray-600">Completadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-sm text-gray-600">En progreso</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-300 rounded"></div>
                        <span className="text-sm text-gray-600">Pendientes</span>
                    </div>
                </div>
            </div>

            {/* Estadísticas adicionales */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="text-sm text-gray-600 mb-2">Promedio mensual</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {(totales.actividades / 12).toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">actividades/mes</div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="text-sm text-gray-600 mb-2">Mes más activo</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {estadisticasPorMes.reduce((max, mes) => mes.total > max.total ? mes : max, estadisticasPorMes[0]).nombre}
                    </div>
                    <div className="text-xs text-gray-500">
                        {Math.max(...estadisticasPorMes.map(m => m.total))} actividades
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="text-sm text-gray-600 mb-2">Tasa de cumplimiento</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {totales.actividades > 0 ? ((totales.completadas / totales.actividades) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-xs text-gray-500">del total</div>
                </div>
            </div>
        </div>
    );
};

export default VistaAnual;
