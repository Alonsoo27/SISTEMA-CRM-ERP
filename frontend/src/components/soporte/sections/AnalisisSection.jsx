import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AnalisisSection = () => {
  const [estadisticas, setEstadisticas] = useState({});
  const [reportes, setReportes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTiempo, setFiltroTiempo] = useState('mes');
  const [filtroAlertas, setFiltroAlertas] = useState('todas');

  useEffect(() => {
    fetchEstadisticas();
    fetchReportes();
    fetchAlertas();
  }, [filtroTiempo]);

  const fetchEstadisticas = async () => {
    try {
      const response = await fetch('/api/soporte/dashboard/resumen', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEstadisticas(result.data || {});
        }
      }
    } catch (err) {
      console.error('Error fetching estadisticas:', err);
    }
  };

  const fetchReportes = async () => {
    try {
      const [productosResponse, tiemposResponse] = await Promise.all([
        fetch('/api/soporte/reportes/productos', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/soporte/reportes/tiempos', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const reportesData = [];

      if (productosResponse.ok) {
        const productosResult = await productosResponse.json();
        if (productosResult.success) {
          reportesData.push({
            id: 'productos',
            tipo: 'productos_estado',
            nombre: 'Reporte de Productos',
            data: productosResult.data,
            total_registros: Object.values(productosResult.data || {}).flat().length
          });
        }
      }

      if (tiemposResponse.ok) {
        const tiemposResult = await tiemposResponse.json();
        if (tiemposResult.success) {
          reportesData.push({
            id: 'tiempos',
            tipo: 'tiempos_reparacion',
            nombre: 'Reporte de Tiempos',
            data: tiemposResult.data,
            total_registros: Array.isArray(tiemposResult.data) ? tiemposResult.data.length : 0
          });
        }
      }

      setReportes(reportesData);
    } catch (err) {
      console.error('Error fetching reportes:', err);
      setError(err.message);
    }
  };

  const fetchAlertas = async () => {
    try {
      const response = await fetch(`/api/soporte/alertas?tipo=${filtroAlertas}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAlertas(result.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportarReporte = async (tipo) => {
    try {
      let endpoint = '';
      let filename = '';

      if (tipo === 'productos_estado' || tipo === 'productos_tiempo') {
        endpoint = '/api/soporte/reportes/productos?formato=csv';
        filename = `productos_soporte_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (tipo === 'tickets_tecnico' || tipo === 'tickets_tipo' || tipo === 'tickets_estado') {
        endpoint = '/api/soporte/reportes/tiempos?formato=csv';
        filename = `tiempos_soporte_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        alert(`Tipo de reporte no soportado: ${tipo}`);
        return;
      }

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error exportando reporte:', err);
      alert(`Error al exportar reporte: ${err.message}`);
    }
  };

  const marcarComoLeida = async (alertaId) => {
    try {
      const response = await fetch(`/api/soporte/alertas/${alertaId}/marcar-leida`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setAlertas(alertas.map(alerta =>
          alerta.id === alertaId ? { ...alerta, leida: true } : alerta
        ));
      }
    } catch (err) {
      console.error('Error marcando alerta como leída:', err);
    }
  };

  const getPrioridadBadge = (prioridad) => {
    const prioridades = {
      'BAJA': { color: 'bg-green-100 text-green-800', text: 'Baja', icon: '🟢' },
      'MEDIA': { color: 'bg-yellow-100 text-yellow-800', text: 'Media', icon: '🟡' },
      'ALTA': { color: 'bg-orange-100 text-orange-800', text: 'Alta', icon: '🟠' },
      'CRITICA': { color: 'bg-red-100 text-red-800', text: 'Crítica', icon: '🔴' }
    };
    return prioridades[prioridad] || { color: 'bg-gray-100 text-gray-800', text: prioridad, icon: '⚪' };
  };

  const getTipoAlerta = (tipo) => {
    const tipos = {
      'TICKET_VENCIDO': { icon: '⏰', text: 'Ticket Vencido' },
      'PRODUCTO_RETRASO': { icon: '🔧', text: 'Producto con Retraso' },
      'CAPACITACION_PENDIENTE': { icon: '📚', text: 'Capacitación Pendiente' },
      'CLIENTE_INSATISFECHO': { icon: '😞', text: 'Cliente Insatisfecho' },
      'INVENTARIO_BAJO': { icon: '📦', text: 'Inventario Bajo' },
      'TECNICO_SOBRECARGADO': { icon: '👨‍🔧', text: 'Técnico Sobrecargado' },
      'SISTEMA': { icon: '⚙️', text: 'Sistema' }
    };
    return tipos[tipo] || { icon: '📢', text: tipo };
  };

  const alertasFiltradas = alertas.filter(alerta => {
    if (filtroAlertas === 'todas') return true;
    if (filtroAlertas === 'no_leidas') return !alerta.leida;
    return alerta.tipo === filtroAlertas;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header de la sección */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Análisis y Control</h2>
          <p className="text-gray-600">Dashboard en tiempo real, reportes y alertas del sistema</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filtroTiempo}
            onChange={(e) => setFiltroTiempo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="trimestre">Este trimestre</option>
            <option value="año">Este año</option>
          </select>
        </div>
      </div>

      {/* Dashboard - Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tickets Totales</p>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.total_tickets || 0}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm">🎫</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tiempo Promedio</p>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.tiempo_promedio_resolucion || '0h'}</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-sm">⏱️</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Satisfacción</p>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.satisfaccion_promedio || 0}%</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">😊</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Productos Reparados</p>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.productos_reparados || 0}</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 text-sm">🔧</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas críticas */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              🚨 Alertas del Sistema
            </CardTitle>
            <select
              value={filtroAlertas}
              onChange={(e) => setFiltroAlertas(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="todas">Todas las alertas</option>
              <option value="no_leidas">No leídas</option>
              <option value="TICKET_VENCIDO">Tickets vencidos</option>
              <option value="PRODUCTO_RETRASO">Productos con retraso</option>
              <option value="CAPACITACION_PENDIENTE">Capacitaciones pendientes</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {alertasFiltradas.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {alertasFiltradas.slice(0, 5).map((alerta) => {
                const tipoInfo = getTipoAlerta(alerta.tipo);
                const prioridadInfo = getPrioridadBadge(alerta.prioridad);

                return (
                  <div
                    key={alerta.id}
                    className={`p-3 rounded-lg border bg-white ${!alerta.leida ? 'border-l-4 border-l-orange-500' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="text-lg">{tipoInfo.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`text-sm font-medium ${!alerta.leida ? 'text-gray-900' : 'text-gray-700'}`}>
                              {alerta.titulo}
                            </h4>
                            {!alerta.leida && (
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{alerta.descripcion}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={prioridadInfo.color}>
                          {prioridadInfo.text}
                        </Badge>
                        {!alerta.leida && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => marcarComoLeida(alerta.id)}
                          >
                            Marcar leída
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-green-600 text-2xl mb-2">✅</div>
              <p className="text-gray-600">No hay alertas activas</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reportes disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 Reportes de Gestión</CardTitle>
            <CardDescription>Análisis detallado de operaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Tickets por Estado</p>
                <p className="text-xs text-gray-600">Distribución de estados actual</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportarReporte('tickets_estado')}>
                Exportar
              </Button>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Tickets por Técnico</p>
                <p className="text-xs text-gray-600">Rendimiento individual</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportarReporte('tickets_tecnico')}>
                Exportar
              </Button>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Tiempos de Resolución</p>
                <p className="text-xs text-gray-600">Análisis de eficiencia</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportarReporte('tickets_tiempo')}>
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🔧 Reportes Técnicos</CardTitle>
            <CardDescription>Análisis de productos y reparaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Productos por Estado</p>
                <p className="text-xs text-gray-600">Estado de reparaciones</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportarReporte('productos_estado')}>
                Exportar
              </Button>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Análisis de Fallas</p>
                <p className="text-xs text-gray-600">Patrones de problemas</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportarReporte('productos_fallas')}>
                Exportar
              </Button>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Capacitaciones Realizadas</p>
                <p className="text-xs text-gray-600">Resumen de entrenamientos</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportarReporte('capacitaciones')}>
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendencias (placeholder mejorado) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📈 Tendencias del Período</CardTitle>
          <CardDescription>Evolución de métricas clave - {filtroTiempo}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-dashed border-blue-200">
            <div className="text-center text-blue-600">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-lg font-medium mb-2">Visualización de Datos</p>
              <p className="text-sm opacity-75">Gráficos interactivos disponibles próximamente</p>
              <p className="text-xs opacity-60 mt-2">Integración con Chart.js / Recharts en desarrollo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalisisSection;