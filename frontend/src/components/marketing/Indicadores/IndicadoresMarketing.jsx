// ============================================
// INDICADORES DE MARKETING
// Dashboard de métricas y análisis
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../../services/marketingService';
import IndicadorIndividual from './IndicadorIndividual';
import IndicadorTiempo from './IndicadorTiempo';
import IndicadorEquipo from './IndicadorEquipo';
import IndicadorCategorias from './IndicadorCategorias';

const IndicadoresMarketing = ({ usuarioId, esJefe }) => {
    const [periodo, setPeriodo] = useState('mes_actual');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para cada indicador
    const [datosIndividual, setDatosIndividual] = useState(null);
    const [datosTiempo, setDatosTiempo] = useState(null);
    const [datosEquipo, setDatosEquipo] = useState(null);
    const [datosCategorias, setDatosCategorias] = useState(null);

    // Cargar todos los indicadores
    useEffect(() => {
        cargarIndicadores();
    }, [periodo, usuarioId]);

    const cargarIndicadores = async () => {
        if (!usuarioId) {
            console.log('⚠️ No hay usuarioId, abortando carga de indicadores');
            return;
        }

        console.log('📊 Iniciando carga de indicadores para usuario:', usuarioId, 'período:', periodo);
        setLoading(true);
        setError(null);

        try {
            // Cargar en paralelo
            const [individual, tiempo, equipo, categorias] = await Promise.all([
                marketingService.obtenerIndicadoresIndividual(usuarioId, periodo),
                marketingService.obtenerAnalisisTiempo(usuarioId, periodo),
                marketingService.obtenerIndicadoresEquipo(periodo),
                marketingService.obtenerAnalisisCategorias(periodo, usuarioId)
            ]);

            console.log('✅ Datos recibidos:', {
                individual: individual,
                tiempo: tiempo,
                equipo: equipo,
                categorias: categorias
            });

            console.log('🔍 Estructura de individual:', {
                hasData: 'data' in individual,
                keys: Object.keys(individual),
                individualData: individual.data,
                individualDirecto: individual
            });

            // Verificar si ya viene el objeto directo o tiene wrapper
            const datosInd = individual.data || individual;
            const datosTiempo = tiempo.data || tiempo;
            const datosEq = equipo.data || equipo;
            const datosCat = categorias.data || categorias;

            console.log('📦 Datos procesados:', {
                datosInd,
                datosTiempo,
                datosEq,
                datosCat
            });

            setDatosIndividual(datosInd);
            setDatosTiempo(datosTiempo);
            setDatosEquipo(datosEq);
            setDatosCategorias(datosCat);

            console.log('✅ Estados actualizados correctamente');
        } catch (err) {
            console.error('❌ Error cargando indicadores:', err);
            setError('Error al cargar los indicadores');
        } finally {
            setLoading(false);
            console.log('🏁 Carga finalizada, loading=false');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Cargando indicadores...</p>
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
                        onClick={cargarIndicadores}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    console.log('🎨 Renderizando indicadores con datos:', {
        datosIndividual,
        datosTiempo,
        datosEquipo,
        datosCategorias
    });

    return (
        <div className="space-y-6">
            {/* Header con filtros */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">📊 Indicadores de Rendimiento</h2>
                    <p className="text-gray-600 text-sm mt-1">
                        Análisis de productividad y eficiencia
                    </p>
                </div>

                {/* Selector de período */}
                <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="semana_actual">Esta semana</option>
                    <option value="mes_actual">Este mes</option>
                    <option value="trimestre_actual">Este trimestre</option>
                    <option value="anio_actual">Este año</option>
                    <option value="personalizado">Personalizado</option>
                </select>
            </div>

            {/* Grid de indicadores - 2x2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rendimiento Individual */}
                <IndicadorIndividual datos={datosIndividual} />

                {/* Análisis de Tiempo */}
                <IndicadorTiempo datos={datosTiempo} />

                {/* Rendimiento del Equipo */}
                <IndicadorEquipo datos={datosEquipo} esJefe={esJefe} />

                {/* Por Categoría */}
                <IndicadorCategorias datos={datosCategorias} />
            </div>
        </div>
    );
};

export default IndicadoresMarketing;
