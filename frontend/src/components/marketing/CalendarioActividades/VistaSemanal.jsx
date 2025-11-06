// ============================================
// VISTA SEMANAL - Timeline por día
// ============================================

import { useState } from 'react';
import LineaTiempo from '../LineaTiempo';

const VistaSemanal = ({ actividades, fechaInicio, onActividadClick, onRecargar }) => {
    const [diaSeleccionado, setDiaSeleccionado] = useState(null);

    // Generar días de la semana (Lunes a Sábado)
    const generarDiasSemana = () => {
        const dias = [];
        const inicio = getStartOfWeek(new Date(fechaInicio));

        for (let i = 0; i < 6; i++) {
            const dia = new Date(inicio);
            dia.setDate(dia.getDate() + i);
            dias.push(dia);
        }

        return dias;
    };

    const diasSemana = generarDiasSemana();

    // Filtrar actividades por día
    const obtenerActividadesDia = (fecha) => {
        return actividades.filter(actividad => {
            const fechaInicio = new Date(actividad.fecha_inicio_planeada);
            const fechaFin = new Date(actividad.fecha_fin_planeada);

            // Incluir actividades que empiezan O terminan en este día
            const empiezaHoy = (
                fechaInicio.getDate() === fecha.getDate() &&
                fechaInicio.getMonth() === fecha.getMonth() &&
                fechaInicio.getFullYear() === fecha.getFullYear()
            );

            const terminaHoy = (
                fechaFin.getDate() === fecha.getDate() &&
                fechaFin.getMonth() === fecha.getMonth() &&
                fechaFin.getFullYear() === fecha.getFullYear()
            );

            return empiezaHoy || terminaHoy;
        });
    };

    // Calcular estadísticas del día
    const obtenerEstadisticasDia = (fecha) => {
        const actividadesDia = obtenerActividadesDia(fecha);
        const totalMinutos = actividadesDia.reduce((sum, act) => sum + act.duracion_planeada_minutos + (act.tiempo_adicional_minutos || 0), 0);
        const completadas = actividadesDia.filter(act => act.estado === 'completada').length;
        const enProgreso = actividadesDia.filter(act => act.estado === 'en_progreso').length;

        return {
            total: actividadesDia.length,
            completadas,
            enProgreso,
            pendientes: actividadesDia.length - completadas - enProgreso,
            horasOcupadas: (totalMinutos / 60).toFixed(1)
        };
    };

    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const esHoy = (fecha) => {
        const hoy = new Date();
        return (
            fecha.getDate() === hoy.getDate() &&
            fecha.getMonth() === hoy.getMonth() &&
            fecha.getFullYear() === hoy.getFullYear()
        );
    };

    return (
        <div className="space-y-4">
            {/* Grid de días - Vista compacta superior */}
            <div className="grid grid-cols-6 gap-3">
                {diasSemana.map((dia, index) => {
                    const stats = obtenerEstadisticasDia(dia);
                    const isHoy = esHoy(dia);
                    const isSeleccionado = diaSeleccionado &&
                        diaSeleccionado.getDate() === dia.getDate() &&
                        diaSeleccionado.getMonth() === dia.getMonth();

                    return (
                        <div
                            key={index}
                            onClick={() => setDiaSeleccionado(dia)}
                            className={`
                                p-4 rounded-lg border-2 cursor-pointer transition-all
                                ${isHoy ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}
                                ${isSeleccionado ? 'ring-4 ring-blue-300 scale-105' : ''}
                                hover:shadow-lg hover:border-blue-400
                            `}
                        >
                            {/* Encabezado del día */}
                            <div className="text-center mb-3">
                                <div className={`text-sm font-medium ${isHoy ? 'text-blue-700' : 'text-gray-500'}`}>
                                    {nombresDias[index]}
                                </div>
                                <div className={`text-2xl font-bold ${isHoy ? 'text-blue-600' : 'text-gray-900'}`}>
                                    {dia.getDate()}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {meses[dia.getMonth()]}
                                </div>
                            </div>

                            {/* Estadísticas del día */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">Actividades:</span>
                                    <span className="font-bold text-gray-900">{stats.total}</span>
                                </div>

                                {stats.total > 0 && (
                                    <>
                                        <div className="flex gap-1">
                                            {stats.completadas > 0 && (
                                                <div className="flex-1 bg-green-500 h-1 rounded" title={`${stats.completadas} completadas`}></div>
                                            )}
                                            {stats.enProgreso > 0 && (
                                                <div className="flex-1 bg-blue-500 h-1 rounded" title={`${stats.enProgreso} en progreso`}></div>
                                            )}
                                            {stats.pendientes > 0 && (
                                                <div className="flex-1 bg-gray-300 h-1 rounded" title={`${stats.pendientes} pendientes`}></div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-600">Horas ocupadas:</span>
                                            <span className={`font-bold ${parseFloat(stats.horasOcupadas) >= 9 ? 'text-green-600' : 'text-orange-600'}`}>
                                                {stats.horasOcupadas}h
                                            </span>
                                        </div>
                                    </>
                                )}

                                {stats.total === 0 && (
                                    <div className="text-center text-xs text-gray-400 py-2">
                                        Sin actividades
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Timeline detallado del día seleccionado */}
            {diaSeleccionado ? (
                <div className="bg-white rounded-lg border-2 border-blue-500 shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-900">
                            {nombresDias[diaSeleccionado.getDay() - 1]} {diaSeleccionado.getDate()} de {meses[diaSeleccionado.getMonth()]}
                        </h3>
                        <button
                            onClick={() => setDiaSeleccionado(null)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕ Cerrar
                        </button>
                    </div>

                    <LineaTiempo
                        actividades={obtenerActividadesDia(diaSeleccionado)}
                        dia={diaSeleccionado}
                        onActividadClick={onActividadClick}
                        onRecargar={onRecargar}
                    />
                </div>
            ) : (
                <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                    <div className="text-6xl mb-4">👆</div>
                    <p className="text-gray-600 text-lg">
                        Selecciona un día para ver el timeline detallado de actividades
                    </p>
                </div>
            )}

            {/* Leyenda rápida */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Completadas</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>En progreso</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-300 rounded"></div>
                    <span>Pendientes</span>
                </div>
            </div>
        </div>
    );
};

// Función auxiliar: Obtener inicio de semana (Lunes)
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

export default VistaSemanal;
