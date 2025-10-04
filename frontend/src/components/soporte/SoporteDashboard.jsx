import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Area, AreaChart 
} from 'recharts';
import {
    Clock, AlertTriangle, CheckCircle, Wrench, Users,
    TrendingUp, TrendingDown, Pause, Play, Phone,
    Calendar, Settings, RefreshCw, Download
} from 'lucide-react';
import { API_CONFIG } from '../../config/apiConfig';

const SoporteDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('mes');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Colores para gráficos
    const COLORS = {
        primary: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#6366f1',
        secondary: '#8b5cf6'
    };

    const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    useEffect(() => {
        fetchDashboardData();
        
        if (autoRefresh) {
            const interval = setInterval(fetchDashboardData, 30000); // Cada 30 segundos
            return () => clearInterval(interval);
        }
    }, [selectedPeriod, autoRefresh]);

    // CORRECCIÓN 1: Cambiar endpoint de /api/soporte/dashboard a /api/soporte/dashboard/resumen
    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // CORRECCIÓN: Endpoint correcto usando BASE_URL para Railway
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/soporte/dashboard/metricas`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            // CORRECCIÓN: Validar estructura de respuesta del backend
            if (!result.success) {
                throw new Error(result.message || 'Error en la respuesta del servidor');
            }
            
            // CORRECCIÓN: Acceso defensivo a los datos
            const data = result.data || {};
            setDashboardData({
                metricas: data.metricas || {},
                rendimiento: data.rendimiento || [],
                alertas: data.alertas || [],
                errores: data.errores || {}
            });
            
            setLastUpdate(new Date());
            
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError(err.message);
            
            // CORRECCIÓN: Datos por defecto en caso de error
            setDashboardData({
                metricas: {
                    total_tickets: 0,
                    tickets_pendientes: 0,
                    tickets_proceso: 0,
                    tickets_completados: 0,
                    productos_por_reparar: 0,
                    productos_reparados: 0,
                    productos_irreparables: 0,
                    capacitaciones_pendientes: 0
                },
                rendimiento: [],
                alertas: []
            });
        } finally {
            setLoading(false);
        }
    };

    // CORRECCIÓN 2: Cambiar endpoint de /kpis a /metricas y hacer función más robusta
    const fetchKPIs = async () => {
        try {
            // CORRECCIÓN: Endpoint correcto según las rutas del backend
            const response = await fetch(`/api/soporte/dashboard/metricas?periodo=${selectedPeriod}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`Error fetching KPIs: ${response.status}`);
                return null;
            }
            
            const result = await response.json();
            return result.success ? result.data : null;
            
        } catch (err) {
            console.error('Error fetching KPIs:', err);
            return null;
        }
    };

    const exportarReporte = async () => {
        try {
            setError(null);
            // TODO: Implementar endpoint de reportes en backend
            const response = await fetch(`/api/soporte/productos/categorias`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo generar el reporte`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_soporte_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (err) {
            console.error('Error exporting report:', err);
            setError('Error exportando reporte: ' + err.message);
        }
    };

    // CORRECCIÓN: Loading state mejorado
    if (loading && !dashboardData) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-gray-600">Cargando dashboard de soporte...</p>
                    <p className="text-sm text-gray-400 mt-2">Conectando con el servidor...</p>
                </div>
            </div>
        );
    }

    // CORRECCIÓN: Error state mejorado con datos por defecto
    if (error && !dashboardData) {
        return (
            <div className="p-6">
                <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-800">
                        <div className="space-y-3">
                            <p><strong>Error cargando el dashboard:</strong> {error}</p>
                            <div className="flex gap-2">
                                <Button onClick={fetchDashboardData} size="sm" variant="outline">
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Reintentar
                                </Button>
                                <Button 
                                    onClick={() => {
                                        setError(null);
                                        setDashboardData({
                                            metricas: {
                                                total_tickets: 0,
                                                tickets_pendientes: 0,
                                                tickets_proceso: 0,
                                                tickets_completados: 0,
                                                productos_por_reparar: 0,
                                                productos_reparados: 0,
                                                productos_irreparables: 0,
                                                capacitaciones_pendientes: 0
                                            },
                                            rendimiento: [],
                                            alertas: []
                                        });
                                    }}
                                    size="sm"
                                >
                                    Continuar sin datos
                                </Button>
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // CORRECCIÓN: Acceso defensivo a los datos
    const metricas = dashboardData?.metricas || {};
    const rendimiento_tecnicos = dashboardData?.rendimiento || [];
    const alertas = dashboardData?.alertas || [];
    
    // CORRECCIÓN: Calcular métricas de productos de manera segura
    const productos_por_categoria = {
        POR_REPARAR: metricas.productos_por_reparar || 0,
        REPARADO: metricas.productos_reparados || 0,
        IRREPARABLE: metricas.productos_irreparables || 0,
        IRREPARABLE_REPUESTOS: metricas.productos_irreparables_repuestos || 0
    };

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard Soporte Técnico</h1>
                    <p className="text-gray-600 mt-1">
                        Última actualización: {lastUpdate.toLocaleString()}
                        {loading && <span className="ml-2 text-blue-500">(actualizando...)</span>}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={loading}
                    >
                        <option value="dia">Hoy</option>
                        <option value="semana">Esta Semana</option>
                        <option value="mes">Este Mes</option>
                        <option value="trimestre">Este Trimestre</option>
                    </select>
                    
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className="flex items-center gap-2"
                        disabled={loading}
                    >
                        {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        Auto-refresh
                    </Button>
                    
                    <Button 
                        onClick={exportarReporte} 
                        size="sm" 
                        variant="outline"
                        disabled={loading}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                    
                    <Button 
                        onClick={fetchDashboardData} 
                        size="sm"
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-amber-800">
                        <div className="flex items-center justify-between">
                            <span>{error}</span>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setError(null)}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* Alertas Críticas */}
            {alertas && alertas.length > 0 && (
                <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-800">
                        <div className="flex items-center justify-between">
                            <span>Tienes {alertas.length} alertas que requieren atención</span>
                            <Button size="sm" variant="outline">Ver Todas</Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tickets Activos</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(metricas.tickets_pendientes || 0) + (metricas.tickets_proceso || 0)}
                        </div>
                        <p className="text-xs text-gray-600">
                            {metricas.tickets_pendientes || 0} pendientes, {metricas.tickets_proceso || 0} en proceso
                        </p>
                        {metricas.total_tickets > 0 && (
                            <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-500 h-2 rounded-full" 
                                        style={{
                                            width: `${((metricas.tickets_completados || 0) / metricas.total_tickets) * 100}%`
                                        }}
                                    ></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {Math.round(((metricas.tickets_completados || 0) / metricas.total_tickets) * 100)}% completado
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Productos en Reparación</CardTitle>
                        <Wrench className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productos_por_categoria.POR_REPARAR}</div>
                        <p className="text-xs text-gray-600">
                            Esperando reparación
                        </p>
                        {productos_por_categoria.POR_REPARAR > 0 && (
                            <div className="mt-2 flex gap-1">
                                <Badge variant="secondary" className="text-xs">
                                    Por reparar: {productos_por_categoria.POR_REPARAR}
                                </Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Capacitaciones Pendientes</CardTitle>
                        <Phone className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metricas.capacitaciones_pendientes || 0}</div>
                        <p className="text-xs text-gray-600">
                            Por programar
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Productos Completados</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {productos_por_categoria.REPARADO}
                        </div>
                        <p className="text-xs text-gray-600">Reparados exitosamente</p>
                    </CardContent>
                </Card>
            </div>

            {/* Contenido Principal */}
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Resumen</TabsTrigger>
                    <TabsTrigger value="productos">Productos</TabsTrigger>
                    <TabsTrigger value="capacitaciones">Capacitaciones</TabsTrigger>
                    <TabsTrigger value="tecnicos">Técnicos</TabsTrigger>
                </TabsList>

                {/* Tab: Resumen */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Gráfico: Productos por Categoría */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Productos por Categoría</CardTitle>
                                <CardDescription>
                                    Distribución actual de productos en soporte
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Por Reparar', value: productos_por_categoria.POR_REPARAR, color: COLORS.warning },
                                                { name: 'Reparados', value: productos_por_categoria.REPARADO, color: COLORS.success },
                                                { name: 'Irreparables', value: productos_por_categoria.IRREPARABLE, color: COLORS.danger },
                                                { name: 'Para Repuestos', value: productos_por_categoria.IRREPARABLE_REPUESTOS, color: COLORS.info }
                                            ].filter(item => item.value > 0)}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}`}
                                        >
                                            {[
                                                { color: COLORS.warning },
                                                { color: COLORS.success },
                                                { color: COLORS.danger },
                                                { color: COLORS.info }
                                            ].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                
                                {/* Mostrar mensaje si no hay datos */}
                                {Object.values(productos_por_categoria).every(v => v === 0) && (
                                    <div className="text-center text-gray-500 py-8">
                                        <Wrench className="h-8 w-8 mx-auto mb-2" />
                                        <p>No hay productos en soporte actualmente</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Gráfico: Rendimiento Técnicos */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Rendimiento Técnicos</CardTitle>
                                <CardDescription>
                                    Top 5 técnicos por productos reparados
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {rendimiento_tecnicos && rendimiento_tecnicos.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={rendimiento_tecnicos.slice(0, 5)}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis 
                                                dataKey="tecnico_nombre" 
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                            />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="productos_reparados" fill={COLORS.primary} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-center text-gray-500 py-8">
                                        <Users className="h-8 w-8 mx-auto mb-2" />
                                        <p>No hay datos de rendimiento disponibles</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Alertas Recientes */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Alertas Recientes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {alertas && alertas.length > 0 ? (
                                <div className="space-y-3">
                                    {alertas.slice(0, 5).map((alerta, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                <div>
                                                    <p className="font-medium text-sm">
                                                        {alerta.codigo_interno || alerta.descripcion || `Alerta ${index + 1}`}
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        {alerta.tipo_pausa || alerta.tipo_alerta || 'Alerta general'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="warning">
                                                {Math.round(alerta.horas_transcurridas || 0)}h
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                    <p>No hay alertas activas</p>
                                    <p className="text-sm text-gray-400 mt-1">Todo está funcionando correctamente</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Productos */}
                <TabsContent value="productos" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestión de Productos</CardTitle>
                            <CardDescription>
                                Vista detallada de productos en las diferentes categorías
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Por Reparar */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-amber-700 border-b border-amber-200 pb-2">
                                        Por Reparar ({productos_por_categoria.POR_REPARAR})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos_por_categoria.POR_REPARAR > 0 
                                                ? `${productos_por_categoria.POR_REPARAR} productos esperando reparación`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Irreparables */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-red-700 border-b border-red-200 pb-2">
                                        Irreparables ({productos_por_categoria.IRREPARABLE})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos_por_categoria.IRREPARABLE > 0 
                                                ? `${productos_por_categoria.IRREPARABLE} productos irreparables`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Para Repuestos */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-blue-700 border-b border-blue-200 pb-2">
                                        Para Repuestos ({productos_por_categoria.IRREPARABLE_REPUESTOS})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos_por_categoria.IRREPARABLE_REPUESTOS > 0 
                                                ? `${productos_por_categoria.IRREPARABLE_REPUESTOS} productos para repuestos`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Reparados */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-green-700 border-b border-green-200 pb-2">
                                        Reparados ({productos_por_categoria.REPARADO})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos_por_categoria.REPARADO > 0 
                                                ? `${productos_por_categoria.REPARADO} productos reparados`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Capacitaciones */}
                <TabsContent value="capacitaciones" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Estado de Capacitaciones</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Total:</span>
                                        <Badge>{metricas.capacitaciones_total || 0}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Pendientes:</span>
                                        <Badge variant="warning">{metricas.capacitaciones_pendientes || 0}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Completadas:</span>
                                        <Badge variant="success">{metricas.capacitaciones_completadas || 0}</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Próximas Capacitaciones</CardTitle>
                                <CardDescription>Programadas para los próximos días</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center text-gray-500 py-8">
                                    <Calendar className="h-8 w-8 mx-auto mb-2" />
                                    <p>No hay capacitaciones próximas</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {metricas.capacitaciones_pendientes > 0 
                                            ? 'Hay capacitaciones pendientes de programar'
                                            : 'Todo al día'
                                        }
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Tab: Técnicos */}
                <TabsContent value="tecnicos" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rendimiento por Técnico</CardTitle>
                            <CardDescription>
                                Métricas de productividad y eficiencia
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {rendimiento_tecnicos && rendimiento_tecnicos.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-2">Técnico</th>
                                                <th className="text-center p-2">Productos Reparados</th>
                                                <th className="text-center p-2">Tiempo Promedio</th>
                                                <th className="text-center p-2">Eficiencia</th>
                                                <th className="text-center p-2">En Proceso</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rendimiento_tecnicos.map((tecnico, index) => (
                                                <tr key={index} className="border-b hover:bg-gray-50">
                                                    <td className="p-2 font-medium">
                                                        {tecnico.tecnico_nombre || `Técnico ${index + 1}`}
                                                    </td>
                                                    <td className="text-center p-2">
                                                        {tecnico.productos_reparados || 0}
                                                    </td>
                                                    <td className="text-center p-2">
                                                        {Math.round(tecnico.promedio_tiempo_neto || 0)}h
                                                    </td>
                                                    <td className="text-center p-2">
                                                        <Badge 
                                                            variant={
                                                                (tecnico.eficiencia_promedio || 0) >= 80 ? 'success' : 
                                                                (tecnico.eficiencia_promedio || 0) >= 60 ? 'warning' : 'destructive'
                                                            }
                                                        >
                                                            {Math.round(tecnico.eficiencia_promedio || 0)}%
                                                        </Badge>
                                                    </td>
                                                    <td className="text-center p-2">
                                                        {tecnico.productos_en_proceso || tecnico.productos_pausados_actual || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <Users className="h-8 w-8 mx-auto mb-2" />
                                    <p>No hay datos de técnicos disponibles</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Los datos aparecerán cuando haya actividad de reparación
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500 border-t pt-4">
                <p>Dashboard Soporte Técnico - Sistema CRM/ERP</p>
                {dashboardData?.errores && Object.values(dashboardData.errores).some(e => e) && (
                    <p className="text-amber-600 mt-1">
                        ⚠️ Algunos datos pueden estar incompletos debido a errores de conexión
                    </p>
                )}
            </div>
        </div>
    );
};

export default SoporteDashboard;