// ============================================
// SELECTOR DE PERÍODO AVANZADO
// Modal para seleccionar períodos predefinidos o personalizados
// ============================================

import { useState, useEffect } from 'react';

const SelectorPeriodoAvanzado = ({ isOpen, onClose, onConfirm, tipoReporte = "Reporte" }) => {
    const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
    const [seccionAbierta, setSeccionAbierta] = useState('rapido');
    const [rangoPersonalizado, setRangoPersonalizado] = useState({
        fechaInicio: '',
        fechaFin: ''
    });

    // Inicializar con semana actual por defecto
    useEffect(() => {
        if (isOpen) {
            setPeriodoSeleccionado({
                tipo: 'semana_actual',
                descripcion: 'Semana Actual',
                ...calcularFechas('semana_actual')
            });
            setSeccionAbierta('rapido');
        }
    }, [isOpen]);

    // ============================================
    // CÁLCULO DE FECHAS
    // ============================================

    const calcularFechas = (tipo) => {
        const ahora = new Date();
        let fechaInicio, fechaFin;

        switch (tipo) {
            case 'hoy':
                fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
                fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
                break;

            case 'semana_actual':
                const diaSemana = ahora.getDay();
                const diffInicio = diaSemana === 0 ? -6 : 1 - diaSemana;
                fechaInicio = new Date(ahora);
                fechaInicio.setDate(ahora.getDate() + diffInicio);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(fechaInicio);
                fechaFin.setDate(fechaInicio.getDate() + 6);
                fechaFin.setHours(23, 59, 59, 999);
                break;

            case 'mes_actual':
                fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
                fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
                break;

            case 'trimestre_actual':
                const mesInicioTrimestre = Math.floor(ahora.getMonth() / 3) * 3;
                fechaInicio = new Date(ahora.getFullYear(), mesInicioTrimestre, 1);
                fechaFin = new Date(ahora.getFullYear(), mesInicioTrimestre + 3, 0, 23, 59, 59);
                break;

            case 'anio_actual':
                fechaInicio = new Date(ahora.getFullYear(), 0, 1);
                fechaFin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59);
                break;

            default:
                if (tipo.startsWith('semana_')) {
                    const semanaNum = parseInt(tipo.split('_')[1]);
                    const primerDia = (semanaNum - 1) * 7 + 1;
                    fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), primerDia);
                    fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), Math.min(primerDia + 6, new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()), 23, 59, 59);
                } else if (tipo.startsWith('mes_')) {
                    const [_, anio, mes] = tipo.split('_');
                    fechaInicio = new Date(parseInt(anio), parseInt(mes), 1);
                    fechaFin = new Date(parseInt(anio), parseInt(mes) + 1, 0, 23, 59, 59);
                } else if (tipo.startsWith('trimestre_')) {
                    const [_, anio, q] = tipo.split('_');
                    const mesInicio = (parseInt(q) - 1) * 3;
                    fechaInicio = new Date(parseInt(anio), mesInicio, 1);
                    fechaFin = new Date(parseInt(anio), mesInicio + 3, 0, 23, 59, 59);
                } else if (tipo.startsWith('anio_')) {
                    const anio = parseInt(tipo.split('_')[1]);
                    fechaInicio = new Date(anio, 0, 1);
                    fechaFin = new Date(anio, 11, 31, 23, 59, 59);
                }
                break;
        }

        return {
            fechaInicio: fechaInicio.toISOString().split('T')[0],
            fechaFin: fechaFin.toISOString().split('T')[0]
        };
    };

    const formatearFecha = (fecha) => {
        const d = new Date(fecha + 'T00:00:00');
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
    };

    // ============================================
    // GENERADORES DE PERÍODOS
    // ============================================

    const generarSemanasDelMes = () => {
        const ahora = new Date();
        const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
        const numSemanas = Math.ceil(ultimoDia / 7);

        const semanas = [];
        for (let i = 1; i <= numSemanas; i++) {
            const primerDia = (i - 1) * 7 + 1;
            const ultimoDiaSemana = Math.min(primerDia + 6, ultimoDia);
            semanas.push({
                tipo: `semana_${i}`,
                descripcion: `Semana ${i} (${primerDia}-${ultimoDiaSemana})`,
                ...calcularFechas(`semana_${i}`)
            });
        }
        return semanas;
    };

    const generarUltimosMeses = () => {
        const ahora = new Date();
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const resultado = [];
        for (let i = 0; i < 6; i++) {
            const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            const mes = fecha.getMonth();
            const anio = fecha.getFullYear();
            resultado.push({
                tipo: `mes_${anio}_${mes}`,
                descripcion: `${meses[mes]} ${anio}`,
                ...calcularFechas(`mes_${anio}_${mes}`)
            });
        }
        return resultado;
    };

    const generarTrimestres = () => {
        const ahora = new Date();
        const anio = ahora.getFullYear();

        return [
            { tipo: `trimestre_${anio}_1`, descripcion: `Q1 ${anio} (Ene-Mar)`, ...calcularFechas(`trimestre_${anio}_1`) },
            { tipo: `trimestre_${anio}_2`, descripcion: `Q2 ${anio} (Abr-Jun)`, ...calcularFechas(`trimestre_${anio}_2`) },
            { tipo: `trimestre_${anio}_3`, descripcion: `Q3 ${anio} (Jul-Sep)`, ...calcularFechas(`trimestre_${anio}_3`) },
            { tipo: `trimestre_${anio}_4`, descripcion: `Q4 ${anio} (Oct-Dic)`, ...calcularFechas(`trimestre_${anio}_4`) }
        ];
    };

    const generarAnios = () => {
        const ahora = new Date();
        const anioActual = ahora.getFullYear();

        return [
            { tipo: `anio_${anioActual}`, descripcion: `Año ${anioActual}`, ...calcularFechas(`anio_${anioActual}`) },
            { tipo: `anio_${anioActual - 1}`, descripcion: `Año ${anioActual - 1}`, ...calcularFechas(`anio_${anioActual - 1}`) }
        ];
    };

    // ============================================
    // HANDLERS
    // ============================================

    const handleSeleccionarPeriodo = (periodo) => {
        setPeriodoSeleccionado(periodo);
    };

    const handleRangoPersonalizado = () => {
        if (!rangoPersonalizado.fechaInicio || !rangoPersonalizado.fechaFin) {
            alert('Debes seleccionar fecha de inicio y fin');
            return;
        }

        setPeriodoSeleccionado({
            tipo: 'custom',
            descripcion: 'Rango Personalizado',
            fechaInicio: rangoPersonalizado.fechaInicio,
            fechaFin: rangoPersonalizado.fechaFin
        });
    };

    const handleConfirmar = () => {
        if (!periodoSeleccionado) {
            alert('Debes seleccionar un período');
            return;
        }

        onConfirm(periodoSeleccionado);
        onClose();
    };

    const toggleSeccion = (seccion) => {
        setSeccionAbierta(seccionAbierta === seccion ? null : seccion);
    };

    if (!isOpen) return null;

    // ============================================
    // RENDER
    // ============================================

    const OpcionPeriodo = ({ periodo }) => (
        <button
            onClick={() => handleSeleccionarPeriodo(periodo)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                periodoSeleccionado?.tipo === periodo.tipo
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-25'
            }`}
        >
            <div className="font-medium text-gray-900">{periodo.descripcion}</div>
            <div className="text-xs text-gray-500 mt-1">
                {formatearFecha(periodo.fechaInicio)} - {formatearFecha(periodo.fechaFin)}
            </div>
        </button>
    );

    const Seccion = ({ id, titulo, children }) => (
        <div className="border-b border-gray-200">
            <button
                onClick={() => toggleSeccion(id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <span className="font-semibold text-gray-700">{titulo}</span>
                <span className={`transform transition-transform ${seccionAbierta === id ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>
            {seccionAbierta === id && (
                <div className="px-4 py-3 space-y-2 bg-gray-50">
                    {children}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">Seleccionar Período</h3>
                        <p className="text-sm text-gray-600 mt-1">{tipoReporte}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center"
                    >
                        ×
                    </button>
                </div>

                {/* Contenido con scroll */}
                <div className="flex-1 overflow-y-auto">
                    {/* Períodos Rápidos */}
                    <Seccion id="rapido" titulo="⚡ Acceso Rápido">
                        <OpcionPeriodo periodo={{ tipo: 'hoy', descripcion: 'Hoy', ...calcularFechas('hoy') }} />
                        <OpcionPeriodo periodo={{ tipo: 'semana_actual', descripcion: 'Semana Actual', ...calcularFechas('semana_actual') }} />
                        <OpcionPeriodo periodo={{ tipo: 'mes_actual', descripcion: 'Mes Actual', ...calcularFechas('mes_actual') }} />
                    </Seccion>

                    {/* Semanas del Mes */}
                    <Seccion id="semanal" titulo="📅 Semanas del Mes Actual">
                        {generarSemanasDelMes().map(semana => (
                            <OpcionPeriodo key={semana.tipo} periodo={semana} />
                        ))}
                    </Seccion>

                    {/* Últimos 6 Meses */}
                    <Seccion id="mensual" titulo="📊 Últimos 6 Meses">
                        {generarUltimosMeses().map(mes => (
                            <OpcionPeriodo key={mes.tipo} periodo={mes} />
                        ))}
                    </Seccion>

                    {/* Trimestres */}
                    <Seccion id="trimestral" titulo="📈 Trimestres">
                        {generarTrimestres().map(trimestre => (
                            <OpcionPeriodo key={trimestre.tipo} periodo={trimestre} />
                        ))}
                    </Seccion>

                    {/* Años */}
                    <Seccion id="anual" titulo="📆 Anual">
                        {generarAnios().map(anio => (
                            <OpcionPeriodo key={anio.tipo} periodo={anio} />
                        ))}
                    </Seccion>

                    {/* Rango Personalizado */}
                    <Seccion id="personalizado" titulo="🎯 Rango Personalizado">
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha Inicio:
                                </label>
                                <input
                                    type="date"
                                    value={rangoPersonalizado.fechaInicio}
                                    onChange={(e) => setRangoPersonalizado({ ...rangoPersonalizado, fechaInicio: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha Fin:
                                </label>
                                <input
                                    type="date"
                                    value={rangoPersonalizado.fechaFin}
                                    onChange={(e) => setRangoPersonalizado({ ...rangoPersonalizado, fechaFin: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <button
                                onClick={handleRangoPersonalizado}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Aplicar Rango Personalizado
                            </button>
                        </div>
                    </Seccion>
                </div>

                {/* Preview del período seleccionado */}
                {periodoSeleccionado && (
                    <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
                        <div className="text-sm text-gray-700">
                            <strong>Período seleccionado:</strong> {periodoSeleccionado.descripcion}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                            Del {formatearFecha(periodoSeleccionado.fechaInicio)} al {formatearFecha(periodoSeleccionado.fechaFin)}
                        </div>
                    </div>
                )}

                {/* Footer con acciones */}
                <div className="flex gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        disabled={!periodoSeleccionado}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        Generar Reporte
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectorPeriodoAvanzado;
