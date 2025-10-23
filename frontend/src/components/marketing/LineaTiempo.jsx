// ============================================
// LÍNEA DE TIEMPO - Timeline del día
// ============================================

import { useState } from 'react';
import ActividadCard from './ActividadCard';

const LineaTiempo = ({ actividades, dia, onActividadClick, onRecargar }) => {
    const [horaActual, setHoraActual] = useState(new Date());

    const INICIO_JORNADA = 8;   // 8 AM
    const FIN_JORNADA = 18;     // 6 PM
    const ALMUERZO_INICIO = 13; // 1 PM
    const ALMUERZO_FIN = 14;    // 2 PM
    const ALTURA_HORA = 80;     // Altura en píxeles por hora

    // Generar array de horas
    const horasJornada = [];
    for (let h = INICIO_JORNADA; h <= FIN_JORNADA; h++) {
        horasJornada.push(h);
    }

    // Calcular posición vertical de una fecha
    const calcularPosicionVertical = (fecha) => {
        const hora = fecha.getHours();
        const minutos = fecha.getMinutes();
        const horaDecimal = hora + (minutos / 60);

        // NO comprimir - usar posiciones REALES
        // El bloque de almuerzo se dibujará encima con z-index alto
        const offset = (horaDecimal - INICIO_JORNADA) * ALTURA_HORA;
        return Math.max(0, offset);
    };

    // Calcular altura de una actividad (basado en duración planeada, no en timestamps)
    const calcularAltura = (actividad) => {
        // Usar la duración planeada directamente
        const duracionMinutos = actividad.duracion_planeada_minutos;
        return (duracionMinutos / 60) * ALTURA_HORA;
    };

    // Verificar si es el día de hoy
    const esHoy = () => {
        const hoy = new Date();
        return (
            dia.getDate() === hoy.getDate() &&
            dia.getMonth() === hoy.getMonth() &&
            dia.getFullYear() === hoy.getFullYear()
        );
    };

    // Calcular posición de "ahora" en el timeline
    const calcularPosicionAhora = () => {
        if (!esHoy()) return null;

        const ahora = new Date();
        return calcularPosicionVertical(ahora);
    };

    const posicionAhora = calcularPosicionAhora();

    // Formatear hora
    const formatearHora = (hora) => {
        return `${hora.toString().padStart(2, '0')}:00`;
    };

    return (
        <div className="relative">
            {/* Timeline container */}
            <div
                className="relative bg-gray-50 rounded-lg p-4"
                style={{ height: `${(FIN_JORNADA - INICIO_JORNADA) * ALTURA_HORA}px` }}
            >
                {/* Línea vertical principal */}
                <div className="absolute left-20 top-0 bottom-0 w-0.5 bg-gray-300"></div>

                {/* Marcadores de hora */}
                {horasJornada.map(hora => {
                    const esAlmuerzo = hora === ALMUERZO_INICIO;
                    const top = (hora - INICIO_JORNADA) * ALTURA_HORA - (hora >= ALMUERZO_FIN ? ALTURA_HORA : 0);

                    return (
                        <div
                            key={hora}
                            className="absolute left-0 flex items-center w-full"
                            style={{ top: `${top}px` }}
                        >
                            {/* Hora */}
                            <span className="text-sm font-medium text-gray-600 w-16 text-right">
                                {formatearHora(hora)}
                            </span>

                            {/* Línea horizontal */}
                            <div className="flex-1 ml-4">
                                <div className={`border-t ${esAlmuerzo ? 'border-yellow-400 border-dashed' : 'border-gray-200'}`}></div>
                            </div>
                        </div>
                    );
                })}

                {/* Bloque de almuerzo - SIEMPRE VISIBLE ENCIMA */}
                <div
                    className="absolute left-20 right-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg flex items-center justify-center"
                    style={{
                        top: `${(ALMUERZO_INICIO - INICIO_JORNADA) * ALTURA_HORA}px`,
                        height: `${ALTURA_HORA}px`,
                        zIndex: 50 // Encima de todo
                    }}
                >
                    <div className="text-center">
                        <div className="text-2xl mb-1">🍽️</div>
                        <div className="text-sm font-semibold text-yellow-700">Hora de Almuerzo</div>
                        <div className="text-xs text-yellow-600">1:00 PM - 2:00 PM</div>
                    </div>
                </div>

                {/* Línea indicadora de "ahora" */}
                {posicionAhora !== null && (
                    <div
                        className="absolute left-16 right-4 z-20 pointer-events-none"
                        style={{ top: `${posicionAhora}px` }}
                    >
                        <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <div className="flex-1 border-t-2 border-red-500 border-dashed"></div>
                        </div>
                        <span className="text-xs font-bold text-red-500 ml-1">Ahora</span>
                    </div>
                )}

                {/* Actividades */}
                <div className="absolute left-24 right-4 top-0 bottom-0">
                    {actividades.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-400">
                                <div className="text-4xl mb-2">📅</div>
                                <p className="text-sm">No hay actividades programadas para este día</p>
                            </div>
                        </div>
                    ) : (
                        actividades.map((actividad, index) => {
                            const inicio = new Date(actividad.fecha_inicio_planeada);
                            const fin = new Date(actividad.fecha_fin_planeada);
                            const horaInicio = inicio.getHours() + (inicio.getMinutes() / 60);
                            const horaFin = fin.getHours() + (fin.getMinutes() / 60);

                            // Detectar si la actividad cruza a otro día
                            const inicioDia = inicio.getDate();
                            const finDia = fin.getDate();
                            const diaActual = dia.getDate();
                            const cruzaDia = inicioDia !== finDia;

                            // CASO 1: Actividad que empieza HOY y continúa mañana
                            if (cruzaDia && inicioDia === diaActual) {
                                const finDelDia = new Date(inicio);
                                finDelDia.setHours(FIN_JORNADA, 0, 0, 0);
                                const minutosHoy = (finDelDia - inicio) / (1000 * 60);
                                const alturaHoy = (minutosHoy / 60) * ALTURA_HORA;
                                const topHoy = calcularPosicionVertical(inicio);

                                return (
                                    <div
                                        key={`${actividad.id}-hoy`}
                                        className="absolute w-full"
                                        style={{
                                            top: `${topHoy}px`,
                                            height: `${alturaHoy}px`,
                                            zIndex: 10
                                        }}
                                    >
                                        <ActividadCard
                                            actividad={{
                                                ...actividad,
                                                descripcion: `${actividad.descripcion} (Continúa mañana)`
                                            }}
                                            onClick={() => onActividadClick && onActividadClick(actividad)}
                                            onRecargar={onRecargar}
                                        />
                                    </div>
                                );
                            }

                            // CASO 2: Actividad que viene de AYER y termina HOY
                            if (cruzaDia && finDia === diaActual && inicioDia !== diaActual) {
                                const inicioDelDia = new Date(fin);
                                inicioDelDia.setHours(INICIO_JORNADA, 0, 0, 0);
                                const minutosHoy = (fin - inicioDelDia) / (1000 * 60);
                                const alturaHoy = (minutosHoy / 60) * ALTURA_HORA;
                                const topHoy = calcularPosicionVertical(inicioDelDia);

                                return (
                                    <div
                                        key={`${actividad.id}-continuacion`}
                                        className="absolute w-full"
                                        style={{
                                            top: `${topHoy}px`,
                                            height: `${alturaHoy}px`,
                                            zIndex: 10
                                        }}
                                    >
                                        <ActividadCard
                                            actividad={{
                                                ...actividad,
                                                descripcion: `${actividad.descripcion} (Desde ayer)`
                                            }}
                                            onClick={() => onActividadClick && onActividadClick(actividad)}
                                            onRecargar={onRecargar}
                                        />
                                    </div>
                                );
                            }

                            // Detectar si la actividad cruza el almuerzo
                            const cruzaAlmuerzo = horaInicio < ALMUERZO_FIN && horaFin > ALMUERZO_INICIO;

                            if (cruzaAlmuerzo) {
                                // DIVIDIR en dos bloques: antes y después del almuerzo

                                // BLOQUE 1: Antes del almuerzo (inicio → 13:00)
                                const finBloque1 = new Date(inicio);
                                finBloque1.setHours(ALMUERZO_INICIO, 0, 0, 0);
                                const minutosBloque1 = Math.max(0, (finBloque1 - inicio) / (1000 * 60));
                                const alturaBloque1 = (minutosBloque1 / 60) * ALTURA_HORA;
                                const topBloque1 = calcularPosicionVertical(inicio);

                                // BLOQUE 2: Después del almuerzo (14:00 → fin)
                                // Usar la fecha correcta para el día del bloque 1
                                const inicioBloque2 = new Date(finBloque1);
                                inicioBloque2.setHours(ALMUERZO_FIN, 0, 0, 0);
                                const minutosBloque2 = Math.max(0, (fin - inicioBloque2) / (1000 * 60));
                                const alturaBloque2 = (minutosBloque2 / 60) * ALTURA_HORA;
                                const topBloque2 = calcularPosicionVertical(inicioBloque2);

                                return (
                                    <div key={actividad.id}>
                                        {/* Bloque 1: Antes del almuerzo */}
                                        {minutosBloque1 > 0 && (
                                            <div
                                                className="absolute w-full"
                                                style={{
                                                    top: `${topBloque1}px`,
                                                    height: `${alturaBloque1}px`,
                                                    zIndex: 10
                                                }}
                                            >
                                                <ActividadCard
                                                    actividad={{
                                                        ...actividad,
                                                        descripcion: `${actividad.descripcion} (Parte 1)`
                                                    }}
                                                    onClick={() => onActividadClick && onActividadClick(actividad)}
                                                    onRecargar={onRecargar}
                                                />
                                            </div>
                                        )}

                                        {/* Bloque 2: Después del almuerzo */}
                                        {minutosBloque2 > 0 && (
                                            <div
                                                className="absolute w-full"
                                                style={{
                                                    top: `${topBloque2}px`,
                                                    height: `${alturaBloque2}px`,
                                                    zIndex: 10
                                                }}
                                            >
                                                <ActividadCard
                                                    actividad={{
                                                        ...actividad,
                                                        descripcion: `${actividad.descripcion} (Parte 2)`
                                                    }}
                                                    onClick={() => onActividadClick && onActividadClick(actividad)}
                                                    onRecargar={onRecargar}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            } else {
                                // NO cruza el almuerzo, renderizar normalmente
                                const top = calcularPosicionVertical(inicio);
                                const height = calcularAltura(actividad);

                                return (
                                    <div
                                        key={actividad.id}
                                        className="absolute w-full"
                                        style={{
                                            top: `${top}px`,
                                            height: `${height}px`,
                                            zIndex: 10
                                        }}
                                    >
                                        <ActividadCard
                                            actividad={actividad}
                                            onClick={() => onActividadClick && onActividadClick(actividad)}
                                            onRecargar={onRecargar}
                                        />
                                    </div>
                                );
                            }
                        })
                    )}
                </div>
            </div>

            {/* Leyenda y estadísticas */}
            {actividades.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">Total actividades:</span>
                            <span className="ml-2 font-bold text-gray-900">{actividades.length}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Completadas:</span>
                            <span className="ml-2 font-bold text-green-600">
                                {actividades.filter(a => a.estado === 'completada').length}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">En progreso:</span>
                            <span className="ml-2 font-bold text-blue-600">
                                {actividades.filter(a => a.estado === 'en_progreso').length}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">Pendientes:</span>
                            <span className="ml-2 font-bold text-gray-600">
                                {actividades.filter(a => a.estado === 'pendiente').length}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LineaTiempo;
