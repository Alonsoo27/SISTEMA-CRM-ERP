// ============================================
// CALENDARIO DE ACTIVIDADES - COMPONENTE PRINCIPAL
// ============================================

import { useState, useEffect } from 'react';
import VistaSemanalCompacta from './VistaSemanalCompacta';
import VistaMensual from './VistaMensual';
import VistaTrimestral from './VistaTrimestral';
import VistaAnual from './VistaAnual';
import marketingService from '../../../services/marketingService';

const CalendarioActividades = ({ vista, usuarioId }) => {
    const [actividades, setActividades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fechaActual, setFechaActual] = useState(new Date());

    // Cargar actividades según vista
    useEffect(() => {
        cargarActividades();
    }, [vista, usuarioId, fechaActual]);

    const cargarActividades = async () => {
        setLoading(true);
        setError(null);

        try {
            let response;

            console.log('📅 Cargando actividades:', { vista, usuarioId, fechaActual });

            switch (vista) {
                case 'semanal':
                    // Enviar fecha en formato YYYY-MM-DD sin hora
                    const fechaSemanal = fechaActual.toISOString().split('T')[0];
                    response = await marketingService.vistaSemanal(
                        usuarioId,
                        fechaSemanal
                    );
                    break;

                case 'mensual':
                    response = await marketingService.vistaMensual(
                        usuarioId,
                        fechaActual.getMonth() + 1,
                        fechaActual.getFullYear()
                    );
                    break;

                case 'trimestral':
                    const trimestre = Math.ceil((fechaActual.getMonth() + 1) / 3);
                    response = await marketingService.vistaTrimestral(
                        usuarioId,
                        trimestre,
                        fechaActual.getFullYear()
                    );
                    break;

                case 'anual':
                    response = await marketingService.vistaAnual(
                        usuarioId,
                        fechaActual.getFullYear()
                    );
                    break;

                default:
                    response = await marketingService.vistaSemanal(usuarioId);
            }

            console.log('📊 Actividades recibidas:', response);

            // response ya es el objeto { success, data, total, ... }
            // Necesitamos extraer el array de actividades
            const actividades = response?.data || response || [];
            console.log('📋 Actividades procesadas:', actividades);

            setActividades(actividades);
        } catch (err) {
            console.error('Error cargando actividades:', err);
            setError('Error al cargar las actividades');
        } finally {
            setLoading(false);
        }
    };

    // Navegación de fechas
    const navegarAnterior = () => {
        const nueva = new Date(fechaActual);

        switch (vista) {
            case 'semanal':
                nueva.setDate(nueva.getDate() - 7);
                break;
            case 'mensual':
                nueva.setMonth(nueva.getMonth() - 1);
                break;
            case 'trimestral':
                nueva.setMonth(nueva.getMonth() - 3);
                break;
            case 'anual':
                nueva.setFullYear(nueva.getFullYear() - 1);
                break;
        }

        setFechaActual(nueva);
    };

    const navegarSiguiente = () => {
        const nueva = new Date(fechaActual);

        switch (vista) {
            case 'semanal':
                nueva.setDate(nueva.getDate() + 7);
                break;
            case 'mensual':
                nueva.setMonth(nueva.getMonth() + 1);
                break;
            case 'trimestral':
                nueva.setMonth(nueva.getMonth() + 3);
                break;
            case 'anual':
                nueva.setFullYear(nueva.getFullYear() + 1);
                break;
        }

        setFechaActual(nueva);
    };

    const irHoy = () => {
        setFechaActual(new Date());
    };

    // Título según vista
    const obtenerTitulo = () => {
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        switch (vista) {
            case 'semanal':
                const inicio = getStartOfWeek(fechaActual);
                const fin = new Date(inicio);
                fin.setDate(fin.getDate() + 4);
                return `${inicio.getDate()} - ${fin.getDate()} ${meses[fin.getMonth()]} ${fin.getFullYear()}`;

            case 'mensual':
                return `${meses[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;

            case 'trimestral':
                const trimestre = Math.ceil((fechaActual.getMonth() + 1) / 3);
                return `Q${trimestre} ${fechaActual.getFullYear()}`;

            case 'anual':
                return `${fechaActual.getFullYear()}`;

            default:
                return '';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Cargando actividades...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <p className="text-red-600 font-semibold">{error}</p>
                    <button
                        onClick={cargarActividades}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Navegación */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button
                        onClick={navegarAnterior}
                        className="p-2 rounded-lg hover:bg-gray-100 transition"
                        title="Anterior"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <h2 className="text-2xl font-bold text-gray-900 min-w-[250px] text-center">
                        {obtenerTitulo()}
                    </h2>

                    <button
                        onClick={navegarSiguiente}
                        className="p-2 rounded-lg hover:bg-gray-100 transition"
                        title="Siguiente"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <button
                    onClick={irHoy}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    Hoy
                </button>
            </div>

            {/* Vista seleccionada */}
            <div className="min-h-[600px]">
                {vista === 'semanal' && (
                    <VistaSemanalCompacta
                        actividades={actividades}
                        fechaInicio={fechaActual}
                        onActividadClick={(actividad) => console.log('Click en actividad:', actividad)}
                        onRecargar={cargarActividades}
                    />
                )}

                {vista === 'mensual' && (
                    <VistaMensual
                        actividades={actividades}
                        mes={fechaActual.getMonth()}
                        anio={fechaActual.getFullYear()}
                        onActividadClick={(actividad) => console.log('Click en actividad:', actividad)}
                    />
                )}

                {vista === 'trimestral' && (
                    <VistaTrimestral
                        actividades={actividades}
                        trimestre={Math.ceil((fechaActual.getMonth() + 1) / 3)}
                        anio={fechaActual.getFullYear()}
                    />
                )}

                {vista === 'anual' && (
                    <VistaAnual
                        actividades={actividades}
                        anio={fechaActual.getFullYear()}
                    />
                )}
            </div>

            {/* Contador de actividades */}
            <div className="text-sm text-gray-500 text-center">
                {actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'}
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

export default CalendarioActividades;
