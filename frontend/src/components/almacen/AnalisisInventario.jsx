import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    BarChart3, 
    PieChart,
    Activity,
    AlertTriangle,
    Clock,
    Target,
    Zap,
    RefreshCw,
    Calendar,
    MapPin,
    Thermometer
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell 
} from 'recharts';
import almacenService from "../../services/almacenService";

const AnalisisInventario = ({ refreshTrigger, almacenesDisponibles }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    
    // Estados para cada análisis
    const [rotacionData, setRotacionData] = useState([]);
    const [eficienciaData, setEficienciaData] = useState(null);
    const [stockSeguridad, setStockSeguridad] = useState(null);
    const [mapaCalor, setMapaCalor] = useState([]);
    const [tendenciasInventario, setTendenciasInventario] = useState([]);

    // Estados de loading específicos
    const [loadingStates, setLoadingStates] = useState({
        rotacion: false,
        eficiencia: false,
        stockSeguridad: false,
        mapaCalor: false,
        tendencias: false
    });

    const periodos = [
        { value: '7d', label: '7 días' },
        { value: '30d', label: '30 días' },
        { value: '90d', label: '3 meses' },
        { value: '365d', label: '1 año' }
    ];

    const coloresPastel = [
        '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', 
        '#8B5A2B', '#6B7280', '#EC4899', '#14B8A6', '#F97316'
    ];

    useEffect(() => {
        cargarAnalisis();
    }, [selectedPeriod, refreshTrigger]);

    const cargarAnalisis = async () => {
        try {
            setLoading(true);
            setError(null);

            // ✅ OPTIMIZACIÓN: Usar endpoint consolidado en lugar de 5 llamadas separadas
            const respuesta = await almacenService.obtenerAnalisisConsolidado(selectedPeriod);

            if (respuesta.success && respuesta.data) {
                // Asignar datos consolidados a cada estado
                setRotacionData(Array.isArray(respuesta.data.rotacion) ? respuesta.data.rotacion : []);
                setEficienciaData(respuesta.data.eficiencia || {
                    movimientos_por_dia: [],
                    metricas_generales: {
                        promedio_movimientos_dia: 0,
                        promedio_usuarios_activos: 0,
                        eficiencia_promedio: 0,
                        tiempo_pico: '10:00-12:00',
                        dia_mas_activo: 'Lunes'
                    }
                });
                setStockSeguridad(respuesta.data.stock_seguridad || {
                    distribucion: [],
                    productos_criticos: [],
                    recomendaciones: {
                        ajustar_minimos: 0,
                        incrementar_stock: 0,
                        revisar_demanda: 0,
                        productos_obsoletos: 0
                    }
                });
                setMapaCalor(Array.isArray(respuesta.data.mapa_calor) ? respuesta.data.mapa_calor : []);
                setTendenciasInventario(Array.isArray(respuesta.data.tendencias) ? respuesta.data.tendencias : []);

                // Mostrar información de performance si está disponible
                if (respuesta.performance?.optimizado) {
                    console.log('✅ Análisis optimizado:', respuesta.performance);
                } else if (respuesta.fallback) {
                    console.log('⚠️ Usando fallback:', respuesta.performance);
                }
            } else {
                console.error('Error en análisis consolidado, usando fallback:', respuesta.error);
                // Solo usar fallback si realmente falla el endpoint
                await Promise.all([
                    cargarRotacionInventario(),
                    cargarEficienciaOperativa(),
                    cargarAnalisisStockSeguridad(),
                    cargarMapaCalorAlmacenes(),
                    cargarTendenciasInventario()
                ]);
            }

        } catch (err) {
            setError('Error cargando análisis: ' + err.message);
            console.error('Error:', err);

            // Fallback a métodos individuales en caso de error total
            try {
                await Promise.all([
                    cargarRotacionInventario(),
                    cargarEficienciaOperativa(),
                    cargarAnalisisStockSeguridad(),
                    cargarMapaCalorAlmacenes(),
                    cargarTendenciasInventario()
                ]);
            } catch (fallbackErr) {
                console.error('Error en fallback:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ 1. ROTACIÓN DE INVENTARIO - REFACTORIZADA CON VALIDACIÓN DEFENSIVA
    const cargarRotacionInventario = async () => {
        setLoadingStates(prev => ({ ...prev, rotacion: true }));

        try {
            const respuesta = await almacenService.obtenerRotacionInventario(selectedPeriod);

            if (respuesta.success && respuesta.data) {
                // VALIDACIÓN DEFENSIVA: Asegurar que data es array
                const data = Array.isArray(respuesta.data) ? respuesta.data : [];
                setRotacionData(data);
            } else {
                console.error('Error rotación:', respuesta.error);
                setRotacionData([]);
            }
        } catch (error) {
            console.error('Error cargando rotación:', error);
            setRotacionData([]);
        } finally {
            setLoadingStates(prev => ({ ...prev, rotacion: false }));
        }
    };

    // ✅ 2. EFICIENCIA OPERATIVA - REFACTORIZADA CON VALIDACIÓN DEFENSIVA
    const cargarEficienciaOperativa = async () => {
        setLoadingStates(prev => ({ ...prev, eficiencia: true }));

        try {
            const respuesta = await almacenService.obtenerEficienciaOperativa(selectedPeriod);

            if (respuesta.success && respuesta.data) {
                // VALIDACIÓN DEFENSIVA: Asegurar estructura correcta
                const data = {
                    movimientos_por_dia: Array.isArray(respuesta.data.movimientos_por_dia) ? respuesta.data.movimientos_por_dia : [],
                    metricas_generales: respuesta.data.metricas_generales || {
                        promedio_movimientos_dia: 0,
                        promedio_usuarios_activos: 0,
                        eficiencia_promedio: 0,
                        tiempo_pico: '10:00-12:00',
                        dia_mas_activo: 'Lunes'
                    }
                };
                setEficienciaData(data);
            } else {
                console.error('Error eficiencia:', respuesta.error);
                setEficienciaData({
                    movimientos_por_dia: [],
                    metricas_generales: {
                        promedio_movimientos_dia: 0,
                        promedio_usuarios_activos: 0,
                        eficiencia_promedio: 0,
                        tiempo_pico: '10:00-12:00',
                        dia_mas_activo: 'Lunes'
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando eficiencia:', error);
            setEficienciaData({
                movimientos_por_dia: [],
                metricas_generales: {
                    promedio_movimientos_dia: 0,
                    promedio_usuarios_activos: 0,
                    eficiencia_promedio: 0,
                    tiempo_pico: '10:00-12:00',
                    dia_mas_activo: 'Lunes'
                }
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, eficiencia: false }));
        }
    };

    // ✅ 3. STOCK DE SEGURIDAD - REFACTORIZADA
    const cargarAnalisisStockSeguridad = async () => {
        setLoadingStates(prev => ({ ...prev, stockSeguridad: true }));
        
        try {
            const respuesta = await almacenService.obtenerAnalisisStockSeguridad();
            
            if (respuesta.success) {
                setStockSeguridad(respuesta.data);
            } else {
                console.error('Error stock seguridad:', respuesta.error);
                setStockSeguridad({
                    distribucion: [],
                    productos_criticos: [],
                    recomendaciones: { 
                        ajustar_minimos: 0, 
                        incrementar_stock: 0, 
                        revisar_demanda: 0, 
                        productos_obsoletos: 0 
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando stock seguridad:', error);
            setStockSeguridad({
                distribucion: [],
                productos_criticos: [],
                recomendaciones: { 
                    ajustar_minimos: 0, 
                    incrementar_stock: 0, 
                    revisar_demanda: 0, 
                    productos_obsoletos: 0 
                }
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, stockSeguridad: false }));
        }
    };

    // ✅ 4. MAPA DE CALOR - REFACTORIZADA
    const cargarMapaCalorAlmacenes = async () => {
        setLoadingStates(prev => ({ ...prev, mapaCalor: true }));
        
        try {
            const respuesta = await almacenService.obtenerMapaCalorAlmacenes(selectedPeriod);
            
            if (respuesta.success) {
                setMapaCalor(respuesta.data);
            } else {
                console.error('Error mapa calor:', respuesta.error);
                setMapaCalor([]);
            }
        } catch (error) {
            console.error('Error cargando mapa calor:', error);
            setMapaCalor([]);
        } finally {
            setLoadingStates(prev => ({ ...prev, mapaCalor: false }));
        }
    };

    // ✅ 5. TENDENCIAS - REFACTORIZADA CON VALIDACIÓN DEFENSIVA
    const cargarTendenciasInventario = async () => {
        setLoadingStates(prev => ({ ...prev, tendencias: true }));

        try {
            const respuesta = await almacenService.obtenerTendenciasInventario(selectedPeriod);

            if (respuesta.success && respuesta.data) {
                // VALIDACIÓN DEFENSIVA: Asegurar que data es array
                const data = Array.isArray(respuesta.data) ? respuesta.data : [];
                setTendenciasInventario(data);
            } else {
                console.error('Error tendencias:', respuesta.error);
                setTendenciasInventario([]);
            }
        } catch (error) {
            console.error('Error cargando tendencias:', error);
            setTendenciasInventario([]);
        } finally {
            setLoadingStates(prev => ({ ...prev, tendencias: false }));
        }
    };

    // Helper functions
    const formatearMoneda = (valor) => {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(valor);
    };

    const getColorPorVelocidad = (velocidad) => {
        switch (velocidad) {
            case 'Muy Alta': return '#10B981';
            case 'Alta': return '#3B82F6';
            case 'Media': return '#F59E0B';
            case 'Baja': return '#EF4444';
            case 'Muy Baja': return '#8B5CF6';
            default: return '#6B7280';
        }
    };

    const getColorPorEficiencia = (eficiencia) => {
        if (eficiencia >= 85) return '#10B981';
        if (eficiencia >= 75) return '#F59E0B';
        return '#EF4444';
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Cargando análisis de inventario...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Error cargando análisis</h3>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={cargarAnalisis}
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
                    <h1 className="text-2xl font-bold text-gray-900">Análisis de Inventario</h1>
                    <p className="text-gray-600">Análisis avanzado de rotación, eficiencia y tendencias</p>
                </div>
                <div className="flex items-center space-x-4">
                    <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {periodos.map(periodo => (
                            <option key={periodo.value} value={periodo.value}>
                                {periodo.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={cargarAnalisis}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Métricas de resumen */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                        <Activity className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Rotación Promedio</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {eficienciaData?.metricas_generales?.promedio_movimientos_dia || 0}/día
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                        <Target className="h-8 w-8 text-green-600" />
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Eficiencia Promedio</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {eficienciaData?.metricas_generales?.eficiencia_promedio || 0}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Productos en Riesgo</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {stockSeguridad?.distribucion?.find(d => d.estado === 'Crítico')?.cantidad || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-purple-600" />
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Valor Total</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {formatearMoneda(
                                    Array.isArray(tendenciasInventario) && tendenciasInventario.length > 0
                                        ? tendenciasInventario[tendenciasInventario.length - 1]?.valor_inventario || 0
                                        : 0
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráficas principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rotación por Almacén */}
                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Rotación por Almacén</h3>
                        <BarChart3 className="h-5 w-5 text-gray-400" />
                    </div>
                    {loadingStates.rotacion ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Array.isArray(rotacionData) ? rotacionData : []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="almacen" 
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    fontSize={11}
                                />
                                <YAxis />
                                <Tooltip 
                                    formatter={(value, name) => [
                                        name === 'rotacion_diaria' ? `${value} mov/día` : value,
                                        name === 'rotacion_diaria' ? 'Rotación Diaria' : 'Total Movimientos'
                                    ]}
                                />
                                <Bar 
                                    dataKey="rotacion_diaria" 
                                    fill="#3B82F6"
                                    name="rotacion_diaria"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Stock de Seguridad */}
                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Estado de Stock de Seguridad</h3>
                        <Target className="h-5 w-5 text-gray-400" />
                    </div>
                    {loadingStates.stockSeguridad ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                                <Pie
                                    data={stockSeguridad?.distribucion}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    dataKey="cantidad"
                                    label={({ estado, porcentaje }) => `${estado}: ${porcentaje}%`}
                                >
                                    {stockSeguridad?.distribucion?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => [value, 'Productos']} />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Eficiencia Operativa */}
                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Eficiencia Operativa</h3>
                        <Zap className="h-5 w-5 text-gray-400" />
                    </div>
                    {loadingStates.eficiencia ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={Array.isArray(eficienciaData?.movimientos_por_dia) ? eficienciaData.movimientos_por_dia : []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="fecha" 
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                                />
                                <YAxis />
                                <Tooltip 
                                    labelFormatter={(value) => new Date(value).toLocaleDateString('es-PE')}
                                    formatter={(value, name) => [
                                        name === 'movimientos' ? `${value} movimientos` : 
                                        name === 'usuarios' ? `${value} usuarios` : `${value}%`,
                                        name === 'movimientos' ? 'Movimientos' : 
                                        name === 'usuarios' ? 'Usuarios Activos' : 'Eficiencia'
                                    ]}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="movimientos" 
                                    stroke="#3B82F6" 
                                    strokeWidth={2}
                                    name="movimientos"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="eficiencia" 
                                    stroke="#10B981" 
                                    strokeWidth={2}
                                    name="eficiencia"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Tendencias de Valorización */}
                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Evolución de Valorización</h3>
                        <TrendingUp className="h-5 w-5 text-gray-400" />
                    </div>
                    {loadingStates.tendencias ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={Array.isArray(tendenciasInventario) ? tendenciasInventario : []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="semana" />
                                <YAxis tickFormatter={(value) => formatearMoneda(value)} />
                                <Tooltip 
                                    formatter={(value, name) => [
                                        formatearMoneda(value),
                                        name === 'valor_inventario' ? 'Valor Inventario' : 'Valor Movido'
                                    ]}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="valor_inventario" 
                                    stackId="1"
                                    stroke="#8B5CF6" 
                                    fill="#8B5CF6"
                                    fillOpacity={0.6}
                                    name="valor_inventario"
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="valor_movido" 
                                    stackId="2"
                                    stroke="#F59E0B" 
                                    fill="#F59E0B"
                                    fillOpacity={0.6}
                                    name="valor_movido"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Mapa de Calor de Almacenes */}
            <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Mapa de Calor - Performance por Almacén</h3>
                    <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                {loadingStates.mapaCalor ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 px-4 font-medium text-gray-700">Almacén</th>
                                    <th className="text-center py-2 px-4 font-medium text-gray-700">Movimientos</th>
                                    <th className="text-center py-2 px-4 font-medium text-gray-700">Alertas</th>
                                    <th className="text-right py-2 px-4 font-medium text-gray-700">Valor Inventario</th>
                                    <th className="text-center py-2 px-4 font-medium text-gray-700">Eficiencia</th>
                                    <th className="text-center py-2 px-4 font-medium text-gray-700">Actividad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mapaCalor?.map((almacen, index) => (
                                    <tr key={index} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium text-gray-900">{almacen.almacen}</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center">
                                                <div 
                                                    className="w-16 h-4 rounded"
                                                    style={{ 
                                                        backgroundColor: getColorPorVelocidad(almacen.actividad),
                                                        opacity: Math.max(0.3, Math.min(1, almacen.movimientos / 100))
                                                    }}
                                                ></div>
                                                <span className="ml-2 text-sm">{almacen.movimientos}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                almacen.alertas > 10 ? 'bg-red-100 text-red-800' :
                                                almacen.alertas > 5 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                                {almacen.alertas}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">
                                            {formatearMoneda(almacen.valor_inventario)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center">
                                                <div 
                                                    className="w-12 h-4 rounded"
                                                    style={{ backgroundColor: getColorPorEficiencia(almacen.eficiencia) }}
                                                ></div>
                                                <span className="ml-2 text-sm">{almacen.eficiencia}%</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                almacen.actividad === 'Muy Alta' ? 'bg-green-100 text-green-800' :
                                                almacen.actividad === 'Alta' ? 'bg-blue-100 text-blue-800' :
                                                almacen.actividad === 'Media' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {almacen.actividad}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Productos Críticos */}
            {stockSeguridad?.productos_criticos?.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Productos Críticos - Requieren Atención</h3>
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stockSeguridad.productos_criticos.map((producto, index) => (
                            <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">{producto.codigo}</span>
                                    <span className="text-xs text-red-600 font-medium">CRÍTICO</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2 truncate">{producto.descripcion}</p>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span>Stock actual:</span>
                                        <span className="font-medium text-red-600">{producto.stock_actual}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Stock mínimo:</span>
                                        <span>{producto.stock_minimo}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Sin reposición:</span>
                                        <span className="font-medium">{producto.dias_sin_reposicion} días</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalisisInventario;