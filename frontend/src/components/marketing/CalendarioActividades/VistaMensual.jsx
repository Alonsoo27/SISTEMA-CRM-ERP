// ============================================
// VISTA MENSUAL
// ============================================

const VistaMensual = ({ actividades, mes, anio, onActividadClick }) => {
    // Generar días del mes
    const generarDiasMes = () => {
        const primerDia = new Date(anio, mes, 1);
        const ultimoDia = new Date(anio, mes + 1, 0);
        const dias = [];

        // Agregar días vacíos al inicio (para alinear con día de la semana)
        const diaSemanaInicio = primerDia.getDay();
        const diasVaciosInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

        for (let i = 0; i < diasVaciosInicio; i++) {
            dias.push(null);
        }

        // Agregar días del mes
        for (let d = 1; d <= ultimoDia.getDate(); d++) {
            dias.push(new Date(anio, mes, d));
        }

        return dias;
    };

    const dias = generarDiasMes();
    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Filtrar actividades por día
    const obtenerActividadesDia = (fecha) => {
        if (!fecha) return [];

        return actividades.filter(act => {
            const fechaAct = new Date(act.fecha_inicio_planeada);
            return (
                fechaAct.getDate() === fecha.getDate() &&
                fechaAct.getMonth() === fecha.getMonth() &&
                fechaAct.getFullYear() === fecha.getFullYear()
            );
        });
    };

    const esHoy = (fecha) => {
        if (!fecha) return false;
        const hoy = new Date();
        return (
            fecha.getDate() === hoy.getDate() &&
            fecha.getMonth() === hoy.getMonth() &&
            fecha.getFullYear() === hoy.getFullYear()
        );
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            {/* Encabezados de días de la semana */}
            <div className="grid grid-cols-7 border-b border-gray-200">
                {diasSemana.map(dia => (
                    <div key={dia} className="p-3 text-center font-semibold text-gray-700 bg-gray-50">
                        {dia}
                    </div>
                ))}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7">
                {dias.map((fecha, index) => {
                    if (!fecha) {
                        return <div key={`vacio-${index}`} className="border border-gray-100 bg-gray-50 min-h-[120px]"></div>;
                    }

                    const actividadesDia = obtenerActividadesDia(fecha);
                    const isHoy = esHoy(fecha);
                    const esFinde = fecha.getDay() === 0 || fecha.getDay() === 6;

                    return (
                        <div
                            key={index}
                            className={`
                                border border-gray-100 p-2 min-h-[120px] transition-all hover:bg-gray-50
                                ${esFinde ? 'bg-gray-50' : 'bg-white'}
                                ${isHoy ? 'bg-blue-50 border-blue-300' : ''}
                            `}
                        >
                            {/* Número del día */}
                            <div className={`
                                text-sm font-bold mb-1
                                ${isHoy ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-gray-700'}
                            `}>
                                {fecha.getDate()}
                            </div>

                            {/* Actividades del día (compactas) */}
                            <div className="space-y-1">
                                {actividadesDia.slice(0, 3).map(act => (
                                    <div
                                        key={act.id}
                                        onClick={() => onActividadClick && onActividadClick(act)}
                                        className="text-xs p-1 rounded border-l-2 cursor-pointer hover:shadow truncate"
                                        style={{ borderLeftColor: act.color_hex, backgroundColor: `${act.color_hex}15` }}
                                        title={`${act.categoria_principal} - ${act.descripcion}`}
                                    >
                                        {act.categoria_principal}
                                    </div>
                                ))}

                                {actividadesDia.length > 3 && (
                                    <div className="text-xs text-gray-500 font-medium">
                                        +{actividadesDia.length - 3} más
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VistaMensual;
