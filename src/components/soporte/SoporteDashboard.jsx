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

const SoporteDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('mes');
    const [autoRefresh, setAutoRefresh] = useState(false);

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

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/soporte/dashboard', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching dashboard data');

            const data = await response.json();
            setDashboardData(data.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchKPIs = async () => {
        try {
            const response = await fetch(`/api/soporte/dashboard/kpis?periodo=${selectedPeriod}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error fetching KPIs');
            return response.json();
        } catch (err) {
            console.error('Error fetching KPIs:', err);
            return null;
        }
    };

    const exportarReporte = async () => {
        try {
            const response = await fetch(`/api/soporte/reportes/productos?formato=csv`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Error exporting report');

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
            alert('Error exportando reporte: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-gray-600">Cargando dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert className="m-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error cargando el dashboard: {error}
                    <Button onClick={fetchDashboardData} className="ml-4" size="sm">
                        Reintentar
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    const { metricas_generales, productos, capacitaciones, alertas, rendimiento_tecnicos } = dashboardData || {};

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard Soporte Técnico</h1>
                    <p className="text-gray-600 mt-1">
                        Última actualización: {new Date(dashboardData?.ultima_actualizacion || '').toLocaleString()}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                    >
                        {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        Auto-refresh
                    </Button>
                    
                    <Button onClick={exportarReporte} size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                    
                    <Button onClick={fetchDashboardData} size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Alertas Críticas */}
            {alertas?.total > 0 && (
                <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-800">
                        <div className="flex items-center justify-between">
                            <span>Tienes {alertas.total} alertas que requieren atención</span>
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
                            {(metricas_generales?.tickets_pendientes || 0) + 
                             (metricas_generales?.tickets_en_proceso || 0)}
                        </div>
                        <p className="text-xs text-gray-600">
                            {metricas_generales?.tickets_pendientes || 0} pendientes, {metricas_generales?.tickets_en_proceso || 0} en proceso
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Products en Reparación</CardTitle>
                        <Wrench className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productos?.por_categoria?.POR_REPARAR || 0}</div>
                        <p className="text-xs text-gray-600">
                            {productos?.pausados || 0} pausados
                        </p>
                        {productos?.pausados > 0 && (
                            <Badge variant="warning" className="mt-1">
                                <Pause className="h-3 w-3 mr-1" />
                                {productos.pausados} pausados
                            </Badge>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Capacitaciones Pendientes</CardTitle>
                        <Phone className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{capacitaciones?.pendientes || 0}</div>
                        <p className="text-xs text-gray-600">
                            {capacitaciones?.hoy || 0} programadas hoy
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Eficiencia Promedio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metricas_generales?.tiempo_promedio_atencion || 0}h
                        </div>
                        <p className="text-xs text-gray-600">Tiempo promedio reparación</p>
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
                                                { name: 'Por Reparar', value: productos?.por_categoria?.POR_REPARAR || 0, color: COLORS.warning },
                                                { name: 'Reparados', value: productos?.por_categoria?.REPARADO || 0, color: COLORS.success },
                                                { name: 'Irreparables', value: productos?.por_categoria?.IRREPARABLE || 0, color: COLORS.danger },
                                                { name: 'Para Repuestos', value: productos?.por_categoria?.IRREPARABLE_REPUESTOS || 0, color: COLORS.info }
                                            ].filter(item => item.value > 0)}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}`}
                                        >
                                            {[
                                                { name: 'Por Reparar', value: productos?.por_categoria?.POR_REPARAR || 0, color: COLORS.warning },
                                                { name: 'Reparados', value: productos?.por_categoria?.REPARADO || 0, color: COLORS.success },
                                                { name: 'Irreparables', value: productos?.por_categoria?.IRREPARABLE || 0, color: COLORS.danger },
                                                { name: 'Para Repuestos', value: productos?.por_categoria?.IRREPARABLE_REPUESTOS || 0, color: COLORS.info }
                                            ].filter(item => item.value > 0).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Gráfico: Rendimiento Técnicos */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Rendimiento Técnicos</CardTitle>
                                <CardDescription>
                                    Productos reparados por técnico
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={rendimiento_tecnicos?.slice(0, 5) || []}>
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
                            {alertas?.alertas?.length > 0 ? (
                                <div className="space-y-3">
                                    {alertas.alertas.slice(0, 5).map((alerta, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                <div>
                                                    <p className="font-medium text-sm">{alerta.codigo_interno}</p>
                                                    <p className="text-xs text-gray-600">{alerta.tipo_pausa}</p>
                                                </div>
                                            </div>
                                            <Badge variant="warning">
                                                {Math.round(alerta.horas_transcurridas)}h
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No hay alertas activas</p>
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
                                        Por Reparar ({productos?.por_categoria?.POR_REPARAR || 0})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {/* Aquí cargarías los productos reales */}
                                        <div className="text-sm text-gray-500">
                                            {productos?.por_categoria?.POR_REPARAR > 0 
                                                ? `${productos.por_categoria.POR_REPARAR} productos esperando reparación`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Irreparables */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-red-700 border-b border-red-200 pb-2">
                                        Irreparables ({productos?.por_categoria?.IRREPARABLE || 0})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos?.por_categoria?.IRREPARABLE > 0 
                                                ? `${productos.por_categoria.IRREPARABLE} productos irreparables`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Para Repuestos */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-blue-700 border-b border-blue-200 pb-2">
                                        Para Repuestos ({productos?.por_categoria?.IRREPARABLE_REPUESTOS || 0})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos?.por_categoria?.IRREPARABLE_REPUESTOS > 0 
                                                ? `${productos.por_categoria.IRREPARABLE_REPUESTOS} productos para repuestos`
                                                : 'No hay productos en esta categoría'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Reparados */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-green-700 border-b border-green-200 pb-2">
                                        Reparados ({productos?.por_categoria?.REPARADO || 0})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div className="text-sm text-gray-500">
                                            {productos?.por_categoria?.REPARADO > 0 
                                                ? `${productos.por_categoria.REPARADO} productos reparados`
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
                                        <Badge>{capacitaciones?.total || 0}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Pendientes:</span>
                                        <Badge variant="warning">{capacitaciones?.pendientes || 0}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Completadas:</span>
                                        <Badge variant="success">{capacitaciones?.completadas || 0}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Hoy:</span>
                                        <Badge variant="info">{capacitaciones?.hoy || 0}</Badge>
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
                            {rendimiento_tecnicos?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-2">Técnico</th>
                                                <th className="text-center p-2">Productos Reparados</th>
                                                <th className="text-center p-2">Tiempo Promedio</th>
                                                <th className="text-center p-2">Eficiencia</th>
                                                <th className="text-center p-2">Pausados</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rendimiento_tecnicos.map((tecnico, index) => (
                                                <tr key={index} className="border-b hover:bg-gray-50">
                                                    <td className="p-2 font-medium">{tecnico.tecnico_nombre}</td>
                                                    <td className="text-center p-2">{tecnico.productos_reparados || 0}</td>
                                                    <td className="text-center p-2">{Math.round(tecnico.promedio_tiempo_neto || 0)}h</td>
                                                    <td className="text-center p-2">
                                                        <Badge 
                                                            variant={
                                                                tecnico.eficiencia_promedio >= 80 ? 'success' : 
                                                                tecnico.eficiencia_promedio >= 60 ? 'warning' : 'destructive'
                                                            }
                                                        >
                                                            {Math.round(tecnico.eficiencia_promedio || 0)}%
                                                        </Badge>
                                                    </td>
                                                    <td className="text-center p-2">{tecnico.productos_pausados_actual || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <Users className="h-8 w-8 mx-auto mb-2" />
                                    <p>No hay datos de técnicos disponibles</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500 border-t pt-4">
                <p>Dashboard Soporte Técnico - Sistema CRM/ERP</p>
            </div>
        </div>
    );
};

export default SoporteDashboard;