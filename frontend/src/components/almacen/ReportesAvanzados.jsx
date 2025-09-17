import React, { useState, useEffect } from 'react';
import { 
    FileText, 
    Download, 
    Calendar,
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart,
    Activity,
    AlertCircle,
    CheckCircle,
    Clock,
    DollarSign,
    Package,
    Truck,
    Target,
    RefreshCw,
    Filter,
    Eye,
    Users,
    Zap
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import almacenService from "../../services/almacenService";
console.log('Funciones disponibles en almacenService:', Object.keys(almacenService));
console.log('getPerformanceComparativa existe:', typeof almacenService.getPerformanceComparativa);

const ReportesAvanzados = ({ almacenesDisponibles, onExport }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reporteActivo, setReporteActivo] = useState('performance');
    const [rangoFecha, setRangoFecha] = useState('30d');
    
    // Estados para cada reporte
    const [performanceData, setPerformanceData] = useState(null);
    const [alertasData, setAlertasData] = useState(null);
    const [valorizacionData, setValorizacionData] = useState(null);
    const [kardexData, setKardexData] = useState(null);
    const [despachoData, setDespachoData] = useState(null);

    const tiposReporte = [
        { 
            id: 'performance', 
            nombre: 'Performance Comparativa', 
            icono: BarChart3, 
            descripcion: 'Comparativa operativa entre almacenes' 
        },
        { 
            id: 'alertas', 
            nombre: 'Análisis Predictivo de Alertas', 
            icono: AlertCircle, 
            descripcion: 'Patrones y predicciones de alertas' 
        },
        { 
            id: 'valorizacion', 
            nombre: 'Valorización Evolutiva', 
            icono: DollarSign, 
            descripción: 'Evolución temporal del valor de inventario' 
        },
        { 
            id: 'kardex', 
            nombre: 'Kardex Inteligente', 
            icono: Activity, 
            descripcion: 'Movimientos con insights y tendencias' 
        },
        { 
            id: 'despachos', 
            nombre: 'Eficiencia de Despachos', 
            icono: Truck, 
            descripcion: 'Performance de entregas vs inventario' 
        }
    ];

    const rangosDisponibles = [
        { value: '7d', label: 'Última semana' },
        { value: '30d', label: 'Último mes' },
        { value: '90d', label: 'Últimos 3 meses' },
        { value: '365d', label: 'Último año' },
        { value: 'custom', label: 'Rango personalizado' }
    ];

    useEffect(() => {
        cargarReporte();
    }, [reporteActivo, rangoFecha]);

    const cargarReporte = async () => {
        try {
            setLoading(true);
            setError(null);

            switch (reporteActivo) {
                case 'performance':
                    await cargarReportePerformance();
                    break;
                case 'alertas':
                    await cargarReporteAlertas();
                    break;
                case 'valorizacion':
                    await cargarReporteValorizacion();
                    break;
                case 'kardex':
                    await cargarReporteKardex();
                    break;
                case 'despachos':
                    await cargarReporteDespachos();
                    break;
            }
        } catch (err) {
            setError('Error cargando reporte: ' + err.message);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // REPORTE 1: PERFORMANCE COMPARATIVA DE ALMACENES - USANDO SERVICIOS REALES
    const cargarReportePerformance = async () => {
        try {
            const response = await almacenService.getPerformanceComparativa(rangoFecha);
            
            if (response.success) {
                setPerformanceData(response.data);
            } else {
                throw new Error(response.error || 'Error obteniendo performance comparativa');
            }
        } catch (error) {
            console.error('Error cargando performance:', error);
            // Fallback a datos por defecto en caso de error
            setPerformanceData({
                resumen_ejecutivo: {
                    total_almacenes: 0,
                    almacen_mas_eficiente: 'N/A',
                    promedio_eficiencia: 0,
                    oportunidad_mejora: 0
                },
                comparativa_almacenes: [],
                benchmarks: {
                    tiempo_promedio_industria: 16.5,
                    eficiencia_despacho_industria: 82.0,
                    alertas_por_mil_movimientos: 8.5
                }
            });
            throw error;
        }
    };

    // REPORTE 2: ANÁLISIS PREDICTIVO DE ALERTAS - USANDO SERVICIOS REALES
    const cargarReporteAlertas = async () => {
        try {
            const response = await almacenService.getAnalisisPredictivoAlertas(rangoFecha);
            
            if (response.success) {
                setAlertasData(response.data);
            } else {
                throw new Error(response.error || 'Error obteniendo análisis de alertas');
            }
        } catch (error) {
            console.error('Error cargando alertas:', error);
            // Fallback a datos por defecto
            setAlertasData({
                predicciones: {
                    proximas_72h: 0,
                    productos_en_riesgo: 0,
                    almacenes_criticos: 0,
                    impacto_estimado: 'BAJO'
                },
                tendencias_historicas: [],
                top_productos_problematicos: [],
                patron_semanal: {}
            });
            throw error;
        }
    };

    // REPORTE 3: VALORIZACIÓN EVOLUTIVA - USANDO SERVICIOS REALES
    const cargarReporteValorizacion = async () => {
        try {
            const response = await almacenService.getValorizacionEvolutiva(rangoFecha);
            
            if (response.success) {
                setValorizacionData(response.data);
            } else {
                throw new Error(response.error || 'Error obteniendo valorización evolutiva');
            }
        } catch (error) {
            console.error('Error cargando valorización:', error);
            // Fallback a datos por defecto
            setValorizacionData({
                metricas_generales: {
                    valor_actual: 0,
                    variacion_periodo: 0,
                    rotacion_valor: 0,
                    valor_promedio_dia: 0
                },
                evolucion_valor: [],
                distribucion_por_almacen: [],
                proyeccion_30_dias: {
                    valor_estimado: 0,
                    confianza: 0,
                    factores_riesgo: [],
                    oportunidades: []
                }
            });
            throw error;
        }
    };

    // REPORTE 4: KARDEX INTELIGENTE - USANDO SERVICIOS REALES
    const cargarReporteKardex = async () => {
        try {
            const response = await almacenService.getKardexInteligente(rangoFecha);
            
            if (response.success) {
                setKardexData(response.data);
            } else {
                throw new Error(response.error || 'Error obteniendo kardex inteligente');
            }
        } catch (error) {
            console.error('Error cargando kardex:', error);
            // Fallback a datos por defecto
            setKardexData({
                productos_destacados: [],
                analisis_movimientos: {
                    total_movimientos: 0,
                    valor_total_movido: 0,
                    movimientos_por_tipo: {
                        entradas: { cantidad: 0, porcentaje: 0 },
                        salidas: { cantidad: 0, porcentaje: 0 },
                        transferencias: { cantidad: 0, porcentaje: 0 },
                        ajustes: { cantidad: 0, porcentaje: 0 }
                    },
                    usuarios_mas_activos: []
                },
                insights_automaticos: []
            });
            throw error;
        }
    };

    // REPORTE 5: EFICIENCIA DE DESPACHOS - USANDO SERVICIOS REALES
    const cargarReporteDespachos = async () => {
        try {
            const response = await almacenService.getEficienciaDespachos(rangoFecha);
            
            if (response.success) {
                setDespachoData(response.data);
            } else {
                throw new Error(response.error || 'Error obteniendo eficiencia de despachos');
            }
        } catch (error) {
            console.error('Error cargando despachos:', error);
            // Fallback a datos por defecto
            setDespachoData({
                kpis_principales: {
                    tiempo_promedio_preparacion: 0,
                    tiempo_promedio_entrega: 0,
                    tasa_entrega_tiempo: 0,
                    despachos_problema: 0
                },
                distribucion_estados: [],
                performance_por_almacen: [],
                tendencia_semanal: []
            });
            throw error;
        }
    };

    const formatearMoneda = (valor) => {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(valor);
    };

    const exportarReporte = async () => {
        if (onExport) {
            await onExport(`reporte_${reporteActivo}_${rangoFecha}`);
        }
    };

    const getTendenciaIcon = (tendencia) => {
        switch (tendencia) {
            case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
            case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
            default: return <Activity className="h-4 w-4 text-gray-600" />;
        }
    };

    const getColorPorScore = (score) => {
        if (score >= 85) return '#10B981';
        if (score >= 70) return '#F59E0B';
        return '#EF4444';
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Generando reporte...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Error generando reporte</h3>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={cargarReporte}
                        className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header con controles */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reportes Avanzados</h1>
                    <p className="text-gray-600">Reportes ejecutivos con análisis profundo de datos reales</p>
                </div>
                <div className="flex items-center space-x-4">
                    <select
                        value={rangoFecha}
                        onChange={(e) => setRangoFecha(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {rangosDisponibles.map(rango => (
                            <option key={rango.value} value={rango.value}>
                                {rango.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={exportarReporte}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </button>
                    <button
                        onClick={cargarReporte}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Selector de tipo de reporte */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {tiposReporte.map(tipo => {
                        const IconComponent = tipo.icono;
                        const isActive = reporteActivo === tipo.id;
                        
                        return (
                            <button
                                key={tipo.id}
                                onClick={() => setReporteActivo(tipo.id)}
                                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                                    isActive 
                                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex flex-col items-center space-y-2">
                                    <IconComponent 
                                        className={`h-6 w-6 ${
                                            isActive ? 'text-blue-600' : 'text-gray-500'
                                        }`} 
                                    />
                                    <span className={`text-sm font-medium text-center ${
                                        isActive ? 'text-blue-700' : 'text-gray-600'
                                    }`}>
                                        {tipo.nombre}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contenido del reporte - PERFORMANCE */}
            {reporteActivo === 'performance' && performanceData && (
                <div className="space-y-6">
                    {/* Resumen ejecutivo */}
                    <div className="bg-white p-6 rounded-lg shadow border">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen Ejecutivo</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{performanceData.resumen_ejecutivo.total_almacenes}</div>
                                <div className="text-sm text-gray-500">Almacenes Activos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{performanceData.resumen_ejecutivo.promedio_eficiencia}%</div>
                                <div className="text-sm text-gray-500">Eficiencia Promedio</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{performanceData.resumen_ejecutivo.almacen_mas_eficiente}</div>
                                <div className="text-sm text-gray-500">Top Performance</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-600">{performanceData.resumen_ejecutivo.oportunidad_mejora}%</div>
                                <div className="text-sm text-gray-500">Oportunidad Mejora</div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla comparativa */}
                    <div className="bg-white p-6 rounded-lg shadow border">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativa Detallada</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-medium text-gray-700">Almacén</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-700">Performance</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-700">Movimientos</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-700">Tiempo Prom.</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-700">Alertas</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-700">Valor Inventario</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-700">Tendencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {performanceData.comparativa_almacenes.map((almacen, index) => (
                                        <tr key={index} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-4">
                                                <div>
                                                    <div className="font-medium text-gray-900">{almacen.almacen}</div>
                                                    <div className="text-sm text-gray-500">{almacen.tipo}</div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center">
                                                    <div 
                                                        className="w-16 h-4 rounded mr-2"
                                                        style={{ backgroundColor: getColorPorScore(almacen.score_performance) }}
                                                    ></div>
                                                    <span className="font-medium">{almacen.score_performance}%</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center font-medium">{almacen.movimientos}</td>
                                            <td className="py-3 px-4 text-center">{almacen.tiempo_promedio} min</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    almacen.alertas_activas > 15 ? 'bg-red-100 text-red-800' :
                                                    almacen.alertas_activas > 10 ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                    {almacen.alertas_activas}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium">
                                                {formatearMoneda(almacen.valor_inventario)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {getTendenciaIcon(almacen.tendencia)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Mostrar mensaje si no hay datos */}
                        {(!performanceData.comparativa_almacenes || performanceData.comparativa_almacenes.length === 0) && (
                            <div className="text-center py-8 text-gray-500">
                                No hay datos disponibles para el período seleccionado
                            </div>
                        )}
                    </div>

                    {/* Gráfica de performance */}
                    {performanceData.comparativa_almacenes && performanceData.comparativa_almacenes.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Score de Performance</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={performanceData.comparativa_almacenes}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="almacen" 
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        fontSize={11}
                                    />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="score_performance" fill="#3B82F6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Contenido del reporte - ALERTAS */}
            {reporteActivo === 'alertas' && alertasData && (
                <div className="space-y-6">
                    {/* Predicciones */}
                    <div className="bg-white p-6 rounded-lg shadow border">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Predicciones Próximas 72 Horas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <div className="text-2xl font-bold text-yellow-600">{alertasData.predicciones.proximas_72h}</div>
                                <div className="text-sm text-yellow-700">Alertas Esperadas</div>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                                <div className="text-2xl font-bold text-red-600">{alertasData.predicciones.productos_en_riesgo}</div>
                                <div className="text-sm text-red-700">Productos en Riesgo</div>
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="text-2xl font-bold text-orange-600">{alertasData.predicciones.almacenes_criticos}</div>
                                <div className="text-sm text-orange-700">Almacenes Críticos</div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-2xl font-bold text-blue-600">{alertasData.predicciones.impacto_estimado}</div>
                                <div className="text-sm text-blue-700">Impacto Estimado</div>
                            </div>
                        </div>
                    </div>

                    {/* Tendencias históricas */}
                    {alertasData.tendencias_historicas && alertasData.tendencias_historicas.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencias Históricas de Alertas</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={alertasData.tendencias_historicas}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="fecha" 
                                        tickFormatter={(value) => new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                                    />
                                    <YAxis />
                                    <Tooltip 
                                        labelFormatter={(value) => new Date(value).toLocaleDateString('es-PE')}
                                    />
                                    <Area type="monotone" dataKey="stock_bajo" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                                    <Area type="monotone" dataKey="stock_critico" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
                                    <Area type="monotone" dataKey="sin_stock" stackId="1" stroke="#7C2D12" fill="#7C2D12" fillOpacity={0.6} />
                                    <Area type="monotone" dataKey="vencimiento" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
                                    <Legend />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Top productos problemáticos */}
                    {alertasData.top_productos_problematicos && alertasData.top_productos_problematicos.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Productos Problemáticos</h3>
                            <div className="space-y-3">
                                {alertasData.top_productos_problematicos.map((producto, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className="text-sm font-medium text-gray-900">{producto.codigo}</div>
                                            <div className="text-xs text-gray-500">
                                                {producto.alertas_generadas} alertas • {producto.tiempo_resolucion}h promedio
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs px-2 py-1 rounded ${
                                                producto.patron === 'Cíclico' ? 'bg-blue-100 text-blue-800' :
                                                producto.patron === 'Estacional' ? 'bg-green-100 text-green-800' :
                                                producto.patron === 'Irregular' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {producto.patron}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mensaje si no hay datos */}
                    {(!alertasData.tendencias_historicas || alertasData.tendencias_historicas.length === 0) && 
                     (!alertasData.top_productos_problematicos || alertasData.top_productos_problematicos.length === 0) && (
                        <div className="bg-white p-6 rounded-lg shadow border text-center py-8 text-gray-500">
                            No hay datos de alertas para el período seleccionado
                        </div>
                    )}
                </div>
            )}

            {/* Contenido del reporte - VALORIZACIÓN */}
            {reporteActivo === 'valorizacion' && valorizacionData && (
                <div className="space-y-6">
                    {/* Métricas generales */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{formatearMoneda(valorizacionData.metricas_generales.valor_actual)}</div>
                            <div className="text-sm text-gray-500">Valor Actual</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">
                                {valorizacionData.metricas_generales.variacion_periodo >= 0 ? '+' : ''}{valorizacionData.metricas_generales.variacion_periodo}%
                            </div>
                            <div className="text-sm text-gray-500">Variación Período</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <Activity className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{valorizacionData.metricas_generales.rotacion_valor}x</div>
                            <div className="text-sm text-gray-500">Rotación Valor</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <Target className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{formatearMoneda(valorizacionData.metricas_generales.valor_promedio_dia)}</div>
                            <div className="text-sm text-gray-500">Promedio/Día</div>
                        </div>
                    </div>

                    {/* Evolución del valor */}
                    {valorizacionData.evolucion_valor && valorizacionData.evolucion_valor.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolución de Valorización</h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={valorizacionData.evolucion_valor}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="fecha" 
                                        tickFormatter={(value) => new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                                    />
                                    <YAxis tickFormatter={(value) => formatearMoneda(value)} />
                                    <Tooltip 
                                        labelFormatter={(value) => new Date(value).toLocaleDateString('es-PE')}
                                        formatter={(value, name) => [
                                            formatearMoneda(value),
                                            name === 'valor_inventario' ? 'Valor Inventario' :
                                            name === 'ingresos' ? 'Ingresos' : 
                                            name === 'egresos' ? 'Egresos' : 'Variación'
                                        ]}
                                    />
                                    <Line type="monotone" dataKey="valor_inventario" stroke="#3B82F6" strokeWidth={3} />
                                    <Line type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={2} />
                                    <Line type="monotone" dataKey="egresos" stroke="#EF4444" strokeWidth={2} />
                                    <Legend />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Distribución por almacén */}
                    {valorizacionData.distribucion_por_almacen && valorizacionData.distribucion_por_almacen.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Valor por Almacén</h3>
                            <div className="space-y-4">
                                {valorizacionData.distribucion_por_almacen.map((almacen, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="font-medium text-gray-900">{almacen.almacen}</div>
                                            <div className="text-sm text-gray-500">{almacen.porcentaje}%</div>
                                            {getTendenciaIcon(almacen.tendencia)}
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="w-32 h-4 bg-blue-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-600 transition-all duration-500"
                                                    style={{ width: `${almacen.porcentaje}%` }}
                                                ></div>
                                            </div>
                                            <div className="font-medium text-gray-900 text-right w-24">
                                                {formatearMoneda(almacen.valor)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mensaje si no hay datos */}
                    {(!valorizacionData.evolucion_valor || valorizacionData.evolucion_valor.length === 0) && 
                     (!valorizacionData.distribucion_por_almacen || valorizacionData.distribucion_por_almacen.length === 0) && (
                        <div className="bg-white p-6 rounded-lg shadow border text-center py-8 text-gray-500">
                            No hay datos de valorización para mostrar
                        </div>
                    )}
                </div>
            )}

            {/* Contenido del reporte - KARDEX */}
            {reporteActivo === 'kardex' && kardexData && (
                <div className="space-y-6">
                    {/* Productos destacados */}
                    {kardexData.productos_destacados && kardexData.productos_destacados.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos Destacados</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Código</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Descripción</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Movimientos</th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-700">Valor Movido</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Frecuencia</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Patrón</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kardexData.productos_destacados.map((producto, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium text-gray-900">{producto.codigo}</td>
                                                <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{producto.descripcion}</td>
                                                <td className="py-3 px-4 text-center">{producto.movimientos_totales}</td>
                                                <td className="py-3 px-4 text-right font-medium">{formatearMoneda(producto.valor_movido)}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        producto.frecuencia_movimiento === 'Diaria' ? 'bg-green-100 text-green-800' :
                                                        producto.frecuencia_movimiento === 'Semanal' ? 'bg-blue-100 text-blue-800' :
                                                        producto.frecuencia_movimiento === 'Mensual' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {producto.frecuencia_movimiento}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center text-sm">{producto.patron_detectado}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <div 
                                                            className="w-12 h-3 rounded mr-2"
                                                            style={{ backgroundColor: getColorPorScore(producto.score_importancia) }}
                                                        ></div>
                                                        <span className="text-sm font-medium">{producto.score_importancia}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Análisis de movimientos */}
                    <div className="bg-white p-6 rounded-lg shadow border">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis General de Movimientos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{kardexData.analisis_movimientos.total_movimientos}</div>
                                <div className="text-sm text-gray-500">Total Movimientos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{formatearMoneda(kardexData.analisis_movimientos.valor_total_movido)}</div>
                                <div className="text-sm text-gray-500">Valor Total Movido</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{kardexData.analisis_movimientos.usuarios_mas_activos?.length || 0}</div>
                                <div className="text-sm text-gray-500">Usuarios Activos</div>
                            </div>
                        </div>

                        {/* Distribución por tipo de movimiento */}
                        {kardexData.analisis_movimientos.movimientos_por_tipo && (
                            <div className="mt-6">
                                <h4 className="font-medium text-gray-900 mb-3">Distribución por Tipo de Movimiento</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 bg-green-50 rounded">
                                        <div className="font-semibold text-green-600">{kardexData.analisis_movimientos.movimientos_por_tipo.entradas?.cantidad || 0}</div>
                                        <div className="text-xs text-green-700">Entradas ({kardexData.analisis_movimientos.movimientos_por_tipo.entradas?.porcentaje || 0}%)</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded">
                                        <div className="font-semibold text-red-600">{kardexData.analisis_movimientos.movimientos_por_tipo.salidas?.cantidad || 0}</div>
                                        <div className="text-xs text-red-700">Salidas ({kardexData.analisis_movimientos.movimientos_por_tipo.salidas?.porcentaje || 0}%)</div>
                                    </div>
                                    <div className="text-center p-3 bg-blue-50 rounded">
                                        <div className="font-semibold text-blue-600">{kardexData.analisis_movimientos.movimientos_por_tipo.transferencias?.cantidad || 0}</div>
                                        <div className="text-xs text-blue-700">Transferencias ({kardexData.analisis_movimientos.movimientos_por_tipo.transferencias?.porcentaje || 0}%)</div>
                                    </div>
                                    <div className="text-center p-3 bg-yellow-50 rounded">
                                        <div className="font-semibold text-yellow-600">{kardexData.analisis_movimientos.movimientos_por_tipo.ajustes?.cantidad || 0}</div>
                                        <div className="text-xs text-yellow-700">Ajustes ({kardexData.analisis_movimientos.movimientos_por_tipo.ajustes?.porcentaje || 0}%)</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Insights automáticos */}
                    {kardexData.insights_automaticos && kardexData.insights_automaticos.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights Automáticos</h3>
                            <div className="space-y-3">
                                {kardexData.insights_automaticos.map((insight, index) => (
                                    <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                                        <Zap className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-blue-900 text-sm">{insight}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mensaje si no hay datos */}
                    {(!kardexData.productos_destacados || kardexData.productos_destacados.length === 0) && 
                     kardexData.analisis_movimientos.total_movimientos === 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border text-center py-8 text-gray-500">
                            No hay datos de movimientos para el período seleccionado
                        </div>
                    )}
                </div>
            )}

            {/* Contenido del reporte - DESPACHOS */}
            {reporteActivo === 'despachos' && despachoData && (
                <div className="space-y-6">
                    {/* KPIs principales */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{despachoData.kpis_principales.tiempo_promedio_preparacion}h</div>
                            <div className="text-sm text-gray-500">Tiempo Prep. Promedio</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <Truck className="h-8 w-8 text-green-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{despachoData.kpis_principales.tiempo_promedio_entrega}h</div>
                            <div className="text-sm text-gray-500">Tiempo Entrega Promedio</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <Target className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{despachoData.kpis_principales.tasa_entrega_tiempo}%</div>
                            <div className="text-sm text-gray-500">Tasa Entrega a Tiempo</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border text-center">
                            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-gray-900">{despachoData.kpis_principales.despachos_problema}</div>
                            <div className="text-sm text-gray-500">Despachos con Problemas</div>
                        </div>
                    </div>

                    {/* Distribución por estados */}
                    {despachoData.distribucion_estados && despachoData.distribucion_estados.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Estados</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Estado</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Cantidad</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Porcentaje</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Tiempo Promedio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {despachoData.distribucion_estados.map((estado, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                        estado.estado === 'ENTREGADO' ? 'bg-green-100 text-green-800' :
                                                        estado.estado === 'ENVIADO' ? 'bg-blue-100 text-blue-800' :
                                                        estado.estado === 'LISTO' ? 'bg-yellow-100 text-yellow-800' :
                                                        estado.estado === 'PREPARANDO' ? 'bg-orange-100 text-orange-800' :
                                                        estado.estado === 'CANCELADO' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {estado.estado}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center font-medium">{estado.cantidad}</td>
                                                <td className="py-3 px-4 text-center">{estado.porcentaje}%</td>
                                                <td className="py-3 px-4 text-center">
                                                    {estado.tiempo_promedio ? `${estado.tiempo_promedio}h` : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Performance por almacén */}
                    {despachoData.performance_por_almacen && despachoData.performance_por_almacen.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance por Almacén</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Almacén</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Despachos</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Tiempo Prep.</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Tiempo Entrega</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Tasa Éxito</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-700">Problemas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {despachoData.performance_por_almacen.map((almacen, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium text-gray-900">{almacen.almacen}</td>
                                                <td className="py-3 px-4 text-center">{almacen.despachos}</td>
                                                <td className="py-3 px-4 text-center">{almacen.tiempo_prep}h</td>
                                                <td className="py-3 px-4 text-center">{almacen.tiempo_entrega}h</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        almacen.tasa_exito >= 90 ? 'bg-green-100 text-green-800' :
                                                        almacen.tasa_exito >= 80 ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {almacen.tasa_exito}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        almacen.problemas === 0 ? 'bg-green-100 text-green-800' :
                                                        almacen.problemas <= 2 ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {almacen.problemas}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tendencia semanal */}
                    {despachoData.tendencia_semanal && despachoData.tendencia_semanal.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia Semanal</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={despachoData.tendencia_semanal}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="dia" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="despachos" fill="#3B82F6" />
                                    <Bar dataKey="eficiencia" fill="#10B981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Mensaje si no hay datos */}
                    {(!despachoData.distribucion_estados || despachoData.distribucion_estados.length === 0) && 
                     (!despachoData.performance_por_almacen || despachoData.performance_por_almacen.length === 0) && (
                        <div className="bg-white p-6 rounded-lg shadow border text-center py-8 text-gray-500">
                            No hay datos de despachos para el período seleccionado
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportesAvanzados;