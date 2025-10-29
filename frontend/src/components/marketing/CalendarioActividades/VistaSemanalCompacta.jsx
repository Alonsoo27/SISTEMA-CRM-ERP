// ============================================
// VISTA SEMANAL COMPACTA - COLUMNAS VERTICALES
// Versión corregida con todas las estadísticas
// ============================================

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ModalDetallesActividad from '../ModalDetallesActividad';

const VistaSemanalCompacta = ({ actividades, fechaInicio, onActividadClick, onRecargar }) => {
    const INICIO_JORNADA = 8;
    const FIN_JORNADA = 18;
    const INICIO_SABADO = 9;
    const FIN_SABADO = 12;
    const ALMUERZO_INICIO = 13;
    const ALMUERZO_FIN = 14;
    const ALTURA_HORA = 70; // Píxeles por hora

    const hoyRef = useRef(null);

    // Scroll automático al día actual
    useEffect(() => {
        if (hoyRef.current) {
            hoyRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, []);

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
    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // Filtrar actividades por día
    const obtenerActividadesDia = (fecha) => {
        return actividades.filter(actividad => {
            const fechaInicio = new Date(actividad.fecha_inicio_planeada);
            const fechaFin = new Date(actividad.fecha_fin_planeada);

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

    // Calcular estadísticas completas del día
    const obtenerEstadisticasDia = (fecha) => {
        const actividadesDia = obtenerActividadesDia(fecha);

        // Calcular minutos REALES trabajados en este día específico
        let totalMinutos = 0;
        actividadesDia.forEach(act => {
            const inicio = new Date(act.fecha_inicio_planeada);
            const fin = new Date(act.fecha_fin_planeada);

            const inicioDia = inicio.getDate();
            const finDia = fin.getDate();
            const diaActual = fecha.getDate();

            if (inicioDia === finDia && inicioDia === diaActual) {
                // Actividad completa en este día
                totalMinutos += act.duracion_planeada_minutos;
            } else if (inicioDia === diaActual && finDia !== diaActual) {
                // Empieza hoy pero continúa mañana
                const esSabado = fecha.getDay() === 6;
                const finJornada = esSabado ? FIN_SABADO : FIN_JORNADA;
                const finDelDia = new Date(inicio);
                finDelDia.setHours(finJornada, 0, 0, 0);
                const minutosHoy = (finDelDia - inicio) / (1000 * 60);
                totalMinutos += minutosHoy;
            } else if (finDia === diaActual && inicioDia !== diaActual) {
                // Viene de ayer y termina hoy
                const esSabado = fecha.getDay() === 6;
                const inicioJornada = esSabado ? INICIO_SABADO : INICIO_JORNADA;
                const inicioDelDia = new Date(fin);
                inicioDelDia.setHours(inicioJornada, 0, 0, 0);
                const minutosHoy = (fin - inicioDelDia) / (1000 * 60);
                totalMinutos += minutosHoy;
            }
        });

        const completadas = actividadesDia.filter(act => act.estado === 'completada').length;
        const enProgreso = actividadesDia.filter(act => act.estado === 'en_progreso').length;
        const pendientes = actividadesDia.filter(act => act.estado === 'pendiente').length;

        return {
            total: actividadesDia.length,
            completadas,
            enProgreso,
            pendientes,
            horasOcupadas: (totalMinutos / 60).toFixed(1)
        };
    };

    const esHoy = (fecha) => {
        const hoy = new Date();
        return (
            fecha.getDate() === hoy.getDate() &&
            fecha.getMonth() === hoy.getMonth() &&
            fecha.getFullYear() === hoy.getFullYear()
        );
    };

    // Calcular posición vertical SIN comprimir (el almuerzo se dibuja encima)
    const calcularPosicionVertical = (fecha, esSabado) => {
        const hora = fecha.getHours();
        const minutos = fecha.getMinutes();
        const horaDecimal = hora + (minutos / 60);
        const inicioJornada = esSabado ? INICIO_SABADO : INICIO_JORNADA;

        const offset = (horaDecimal - inicioJornada) * ALTURA_HORA;
        return Math.max(0, offset);
    };

    // Calcular posición de "ahora"
    const calcularPosicionAhora = (esSabado) => {
        const ahora = new Date();
        const hora = ahora.getHours();
        const minutos = ahora.getMinutes();
        const horaDecimal = hora + (minutos / 60);
        const inicioJornada = esSabado ? INICIO_SABADO : INICIO_JORNADA;
        const finJornada = esSabado ? FIN_SABADO : FIN_JORNADA;

        // Solo mostrar si estamos en jornada laboral
        if (horaDecimal < inicioJornada || horaDecimal > finJornada) {
            return null;
        }

        return (horaDecimal - inicioJornada) * ALTURA_HORA;
    };

    return (
        <div className="overflow-x-auto">
            <div className="grid grid-cols-6 gap-3 min-w-[1400px]">
                {diasSemana.map((dia, index) => {
                    const esSabado = index === 5;
                    const inicioJornada = esSabado ? INICIO_SABADO : INICIO_JORNADA;
                    const finJornada = esSabado ? FIN_SABADO : FIN_JORNADA;
                    const horasJornada = [];

                    for (let h = inicioJornada; h <= finJornada; h++) {
                        horasJornada.push(h);
                    }

                    const alturaTotal = (finJornada - inicioJornada) * ALTURA_HORA;
                    const actividadesDia = obtenerActividadesDia(dia);
                    const stats = obtenerEstadisticasDia(dia);
                    const isHoy = esHoy(dia);
                    const posicionAhora = isHoy ? calcularPosicionAhora(esSabado) : null;

                    return (
                        <div
                            key={index}
                            ref={isHoy ? hoyRef : null}
                            className={`
                                rounded-lg border-2 overflow-hidden shadow-sm
                                ${isHoy ? 'border-blue-500' : 'border-gray-200'}
                            `}
                        >
                            {/* Header del día */}
                            <div className={`p-3 border-b border-gray-200 ${isHoy ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <div className="text-center mb-2">
                                    <div className={`text-xs font-medium ${isHoy ? 'text-blue-700' : 'text-gray-500'}`}>
                                        {nombresDias[index]}
                                    </div>
                                    <div className={`text-2xl font-bold ${isHoy ? 'text-blue-600' : 'text-gray-900'}`}>
                                        {dia.getDate()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {format(dia, 'MMM', { locale: es })}
                                    </div>
                                </div>

                                {/* Estadísticas */}
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Actividades:</span>
                                        <span className="font-bold text-gray-900">{stats.total}</span>
                                    </div>

                                    {/* Barra de progreso - siempre visible */}
                                    <div className="flex gap-1 h-2">
                                        {stats.total > 0 ? (
                                            <>
                                                {stats.completadas > 0 && (
                                                    <div
                                                        className="bg-green-500 rounded"
                                                        style={{ width: `${(stats.completadas / stats.total) * 100}%` }}
                                                        title={`${stats.completadas} completadas`}
                                                    ></div>
                                                )}
                                                {stats.enProgreso > 0 && (
                                                    <div
                                                        className="bg-blue-500 rounded"
                                                        style={{ width: `${(stats.enProgreso / stats.total) * 100}%` }}
                                                        title={`${stats.enProgreso} en progreso`}
                                                    ></div>
                                                )}
                                                {stats.pendientes > 0 && (
                                                    <div
                                                        className="bg-gray-300 rounded"
                                                        style={{ width: `${(stats.pendientes / stats.total) * 100}%` }}
                                                        title={`${stats.pendientes} pendientes`}
                                                    ></div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="w-full bg-gray-100 rounded"></div>
                                        )}
                                    </div>

                                    {/* Horas ocupadas - siempre visible */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Horas ocupadas:</span>
                                        <span className={`font-bold ${
                                            stats.total === 0
                                                ? 'text-gray-400'
                                                : parseFloat(stats.horasOcupadas) >= (esSabado ? 3 : 9)
                                                    ? 'text-green-600'
                                                    : 'text-orange-600'
                                        }`}>
                                            {stats.horasOcupadas}h
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline del día */}
                            <div
                                className="relative bg-gray-50"
                                style={{ height: `${alturaTotal}px` }}
                            >
                                {/* Marcadores de hora */}
                                {horasJornada.map(hora => {
                                    const esAlmuerzo = !esSabado && hora === ALMUERZO_INICIO;
                                    const top = (hora - inicioJornada) * ALTURA_HORA;

                                    return (
                                        <div
                                            key={hora}
                                            className="absolute left-0 right-0 flex items-center"
                                            style={{ top: `${top}px` }}
                                        >
                                            <span className="text-[11px] font-medium text-gray-400 w-12 text-center bg-gray-50 px-1">
                                                {hora.toString().padStart(2, '0')}:00
                                            </span>
                                            <div className={`flex-1 border-t ${esAlmuerzo ? 'border-yellow-400 border-dashed' : 'border-gray-200'}`}></div>
                                        </div>
                                    );
                                })}

                                {/* Bloque de almuerzo (solo lunes-viernes) - z-index bajo */}
                                {!esSabado && (
                                    <div
                                        className="absolute left-0 right-0 bg-yellow-50 border-y-2 border-yellow-300 flex items-center justify-center pointer-events-none"
                                        style={{
                                            top: `${(ALMUERZO_INICIO - INICIO_JORNADA) * ALTURA_HORA}px`,
                                            height: `${ALTURA_HORA}px`,
                                            zIndex: 1
                                        }}
                                    >
                                        <div className="text-center">
                                            <div className="text-xl mb-0.5">🍽️</div>
                                            <div className="text-[10px] font-bold text-yellow-800">ALMUERZO</div>
                                            <div className="text-[9px] text-yellow-600">1:00 - 2:00 PM</div>
                                        </div>
                                    </div>
                                )}

                                {/* Indicador de "ahora" */}
                                {posicionAhora !== null && (
                                    <div
                                        className="absolute left-0 right-0 pointer-events-none"
                                        style={{
                                            top: `${posicionAhora}px`,
                                            zIndex: 200
                                        }}
                                    >
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                            <div className="flex-1 border-t-2 border-red-500"></div>
                                        </div>
                                        <span className="text-[9px] font-bold text-red-500 ml-1 bg-white px-1 rounded">
                                            {format(new Date(), 'HH:mm')}
                                        </span>
                                    </div>
                                )}

                                {/* Actividades - z-index bajo para que queden DEBAJO del almuerzo */}
                                <div className="absolute left-12 right-2 top-0 bottom-0">
                                    {actividadesDia.map((actividad) => {
                                        const inicio = new Date(actividad.fecha_inicio_planeada);
                                        const fin = new Date(actividad.fecha_fin_planeada);
                                        const horaInicio = inicio.getHours() + (inicio.getMinutes() / 60);
                                        const horaFin = fin.getHours() + (fin.getMinutes() / 60);

                                        const inicioDia = inicio.getDate();
                                        const finDia = fin.getDate();
                                        const diaActual = dia.getDate();
                                        const cruzaDia = inicioDia !== finDia;

                                        // Detectar si cruza almuerzo
                                        const cruzaAlmuerzo = !esSabado && horaInicio < ALMUERZO_FIN && horaFin > ALMUERZO_INICIO;

                                        // CASO 1: Empieza hoy y cruza almuerzo (DIVIDIR)
                                        if (!cruzaDia && cruzaAlmuerzo && inicioDia === diaActual) {
                                            // Bloque 1: Antes del almuerzo
                                            const finBloque1 = new Date(inicio);
                                            finBloque1.setHours(ALMUERZO_INICIO, 0, 0, 0);
                                            const minutosBloque1 = Math.max(0, (finBloque1 - inicio) / (1000 * 60));
                                            const alturaBloque1 = (minutosBloque1 / 60) * ALTURA_HORA;
                                            const topBloque1 = calcularPosicionVertical(inicio, esSabado);

                                            // Bloque 2: Después del almuerzo
                                            const inicioBloque2 = new Date(finBloque1);
                                            inicioBloque2.setHours(ALMUERZO_FIN, 0, 0, 0);
                                            const minutosBloque2 = Math.max(0, (fin - inicioBloque2) / (1000 * 60));
                                            const alturaBloque2 = (minutosBloque2 / 60) * ALTURA_HORA;
                                            const topBloque2 = calcularPosicionVertical(inicioBloque2, esSabado);

                                            return (
                                                <div key={actividad.id}>
                                                    {minutosBloque1 > 0 && (
                                                        <div
                                                            className="absolute w-full"
                                                            style={{
                                                                top: `${topBloque1}px`,
                                                                height: `${alturaBloque1}px`,
                                                                zIndex: 10
                                                            }}
                                                        >
                                                            <ActividadCardCompacta
                                                                actividad={actividad}
                                                                onClick={() => onActividadClick && onActividadClick(actividad)}
                                                                onRecargar={onRecargar}
                                                                esParte1={true}
                                                            />
                                                        </div>
                                                    )}
                                                    {minutosBloque2 > 0 && (
                                                        <div
                                                            className="absolute w-full"
                                                            style={{
                                                                top: `${topBloque2}px`,
                                                                height: `${alturaBloque2}px`,
                                                                zIndex: 10
                                                            }}
                                                        >
                                                            <ActividadCardCompacta
                                                                actividad={actividad}
                                                                onClick={() => onActividadClick && onActividadClick(actividad)}
                                                                onRecargar={onRecargar}
                                                                esParte2={true}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // CASO 2: Empieza HOY y continúa MAÑANA
                                        if (cruzaDia && inicioDia === diaActual) {
                                            const finDelDia = new Date(inicio);
                                            finDelDia.setHours(finJornada, 0, 0, 0);
                                            const minutosHoy = (finDelDia - inicio) / (1000 * 60);
                                            const alturaHoy = (minutosHoy / 60) * ALTURA_HORA;
                                            const topHoy = calcularPosicionVertical(inicio, esSabado);

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
                                                    <ActividadCardCompacta
                                                        actividad={actividad}
                                                        onClick={() => onActividadClick && onActividadClick(actividad)}
                                                        onRecargar={onRecargar}
                                                        continuaManana={true}
                                                    />
                                                </div>
                                            );
                                        }

                                        // CASO 3: Viene de AYER y termina HOY
                                        if (cruzaDia && finDia === diaActual && inicioDia !== diaActual) {
                                            const inicioDelDia = new Date(fin);
                                            inicioDelDia.setHours(inicioJornada, 0, 0, 0);
                                            const minutosHoy = (fin - inicioDelDia) / (1000 * 60);
                                            const alturaHoy = (minutosHoy / 60) * ALTURA_HORA;
                                            const topHoy = calcularPosicionVertical(inicioDelDia, esSabado);

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
                                                    <ActividadCardCompacta
                                                        actividad={actividad}
                                                        onClick={() => onActividadClick && onActividadClick(actividad)}
                                                        onRecargar={onRecargar}
                                                        desdeAyer={true}
                                                    />
                                                </div>
                                            );
                                        }

                                        // CASO 4: Actividad COMPLETA en este día (sin cruzar almuerzo ni días)
                                        if (!cruzaDia || (inicioDia === diaActual && finDia === diaActual)) {
                                            const duracionMinutos = actividad.duracion_planeada_minutos;
                                            const altura = (duracionMinutos / 60) * ALTURA_HORA;
                                            const top = calcularPosicionVertical(inicio, esSabado);

                                            return (
                                                <div
                                                    key={actividad.id}
                                                    className="absolute w-full"
                                                    style={{
                                                        top: `${top}px`,
                                                        height: `${altura}px`,
                                                        zIndex: 10
                                                    }}
                                                >
                                                    <ActividadCardCompacta
                                                        actividad={actividad}
                                                        onClick={() => onActividadClick && onActividadClick(actividad)}
                                                        onRecargar={onRecargar}
                                                    />
                                                </div>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Componente de tarjeta compacta mejorado
const ActividadCardCompacta = ({ actividad, onClick, onRecargar, esParte1, esParte2, continuaManana, desdeAyer }) => {
    const [showModal, setShowModal] = useState(false);

    const {
        estado,
        color_hex,
        descripcion,
        es_prioritaria,
        es_grupal,
        transferida_de,
        duracion_planeada_minutos,
        fecha_fin_planeada
    } = actividad;

    // Detectar si la actividad está vencida
    const ahora = new Date();
    const fechaFin = new Date(fecha_fin_planeada);
    const estaVencida = (estado === 'pendiente' || estado === 'en_progreso') && fechaFin < ahora;

    const estadoStyles = {
        pendiente: 'border-gray-300',
        en_progreso: 'border-blue-500 shadow-md',
        completada: 'border-green-500 opacity-75',
        pausada: 'border-yellow-500',
        cancelada: 'border-red-300 opacity-50'
    };

    // Si está vencida, sobrescribir con borde rojo intenso
    const styles = estaVencida ? 'border-red-600 shadow-lg animate-pulse' : (estadoStyles[estado] || estadoStyles.pendiente);

    // Indicador de parte de actividad
    let indicador = '';
    if (esParte1) indicador = '⬇️';
    if (esParte2) indicador = '⬆️';
    if (continuaManana) indicador = '→';
    if (desdeAyer) indicador = '←';

    // Texto de duración
    const horas = Math.floor(duracion_planeada_minutos / 60);
    const minutos = duracion_planeada_minutos % 60;
    const duracionTexto = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;

    const handleCardClick = () => {
        setShowModal(true);
        if (onClick) onClick();
    };

    return (
        <>
            <div
                onClick={handleCardClick}
                className={`
                    h-full p-1.5 rounded border-l-4 cursor-pointer
                    transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:z-50
                    ${styles}
                `}
                style={{
                    borderLeftColor: color_hex,
                    backgroundColor: `${color_hex}38`
                }}
                title={`${descripcion} - ${duracionTexto}`}
            >
                <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold truncate" style={{ color: color_hex }}>
                            {indicador && <span className="mr-0.5">{indicador}</span>}
                            {estaVencida && <span className="mr-0.5 text-red-600">⏰</span>}
                            {descripcion}
                        </div>
                        <div className="text-[9px] text-gray-500 truncate mt-0.5">
                            {duracionTexto}
                            {estaVencida && <span className="ml-1 text-red-600 font-bold">VENCIDA</span>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {es_prioritaria && <span className="text-[10px]" title="Prioritaria">⚡</span>}
                        {es_grupal && <span className="text-[10px]" title="Grupal">👥</span>}
                        {transferida_de && <span className="text-[10px]" title="Transferida">↗️</span>}
                    </div>
                </div>
            </div>

            {/* Modal de detalles */}
            {showModal && (
                <ModalDetallesActividad
                    actividad={actividad}
                    onClose={() => setShowModal(false)}
                    onActividadActualizada={onRecargar}
                />
            )}
        </>
    );
};

// Helper: Obtener inicio de semana (lunes)
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

export default VistaSemanalCompacta;
