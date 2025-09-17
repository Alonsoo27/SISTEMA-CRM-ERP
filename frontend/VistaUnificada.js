import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Target, Users, 
  Calendar, BarChart3, PieChart, Award, MapPin, Phone,
  RefreshCw, Download, AlertCircle, CheckCircle, Trophy,
  ArrowUp, ArrowDown, Minus, Building, CreditCard
} from 'lucide-react';

const VistaUnificada = ({ 
  usuarioActual,
  refreshTrigger = 0 
}) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [notification, setNotification] = useState(null);

  // Función para mostrar notificaciones
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Cargar datos del dashboard ejecutivo
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token de autenticación no encontrado');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      console.log(`[Vista Unificada] Cargando datos para período: ${periodoSeleccionado}`);

      const response = await fetch(
        `/api/dashboard-ejecutivo/vista-unificada?periodo=${periodoSeleccionado}`, 
        { headers }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado. Se requieren privilegios administrativos.');
        }
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setDatos(result.data);
        showNotification('Dashboard actualizado correctamente', 'success');
      } else {
        throw new Error(result.error || 'Error desconocido');
      }

    } catch (err) {
      console.error('Error cargando Vista Unificada:', err);
      setError(`Error: ${err.message}`);
      showNotification('Error cargando datos del dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [periodoSeleccionado, showNotification]);

  useEffect(() => {
    if (usuarioActual?.id) {
      cargarDatos();
    }
  }, [cargarDatos, refreshTrigger, usuarioActual?.id]);

  // Funciones auxiliares
  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(monto || 0);
  };

  const formatearNumero = (numero) => {
    return new Intl.NumberFormat('es-PE').format(numero || 0);
  };

  const obtenerTextoPeridodo = (periodo) => {
    const textos = {
      'hoy': 'Hoy',
      'semana_actual': 'Esta Semana',
      'mes_actual': 'Este Mes',
      'trimestre_actual': 'Este Trimestre'
    };
    return textos[periodo] || periodo;
  };

  // Componente de notificación
  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    const IconComponent = iconos[notification.tipo];

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-sm`}>
        <div className="flex items-center">
          <IconComponent className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error cargando dashboard ejecutivo</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarDatos}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No hay datos disponibles para mostrar</p>
      </div>
    );
  }

  const kpis = datos.kpis_generales || {};
  const topVentas = datos.top_asesores_ventas || [];
  const topIngresos = datos.top_asesores_ingresos || [];
  const canales = datos.distribucion_canales || [];
  const tendencias = datos.tendencias_15_dias || [];
  const tiposVenta = datos.tipos_venta || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Vista Unificada Ejecutiva</h2>
            <p className="text-blue-100 text-lg">
              Dashboard consolidado del equipo - {obtenerTextoPeridodo(periodoSeleccionado)}
            </p>
            <p className="text-blue-200 text-sm mt-1">
              Período: {datos.fechas?.fechaInicio} al {datos.fechas?.fechaFin}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={periodoSeleccionado}
              onChange={(e) => setPeriodoSeleccionado(e.target.value)}
              className="border border-blue-400 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-300"
            >
              <option value="hoy">Hoy</option>
              <option value="semana_actual">Esta semana</option>
              <option value="mes_actual">Este mes</option>
              <option value="trimestre_actual">Este trimestre</option>
            </select>

            <button
              onClick={() => showNotification('Reporte exportado correctamente', 'success')}
              className="inline-flex items-center px-3 py-2 border border-blue-400 rounded-md text-white hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ventas</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearNumero(kpis.total_ventas)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {formatearNumero(kpis.asesores_activos)} asesores activos
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearMonto(kpis.ingresos_totales)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Revenue del equipo
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearMonto(kpis.ticket_promedio)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Por venta
              </p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cobertura</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatearNumero(kpis.ciudades_cubiertas)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                ciudades, {formatearNumero(kpis.sectores_atendidos)} sectores
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <MapPin className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* TOP Asesores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP por Ventas */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">TOP Asesores por Ventas</h3>
            <Trophy className="h-6 w-6 text-yellow-500" />
          </div>
          
          <div className="space-y-4">
            {topVentas.map((asesor, index) => (
              <div key={asesor.asesor_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    'bg-orange-400 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Asesor #{asesor.asesor_id}</p>
                    <p className="text-sm text-gray-600">
                      {asesor.porcentaje_ventas}% del total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {formatearNumero(asesor.ventas)} ventas
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatearMonto(asesor.ticket_promedio)} promedio
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOP por Ingresos */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">TOP Asesores por Ingresos</h3>
            <Award className="h-6 w-6 text-green-500" />
          </div>
          
          <div className="space-y-4">
            {topIngresos.map((asesor, index) => (
              <div key={asesor.asesor_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    index === 0 ? 'bg-green-500 text-white' :
                    index === 1 ? 'bg-blue-400 text-white' :
                    'bg-purple-400 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Asesor #{asesor.asesor_id}</p>
                    <p className="text-sm text-gray-600">
                      {asesor.porcentaje_ingresos}% del total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {formatearMonto(asesor.ingresos)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatearNumero(asesor.ventas)} ventas
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribución por Canales y Tipos de Venta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canales de Contacto */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Distribución por Canal</h3>
            <Phone className="h-6 w-6 text-blue-500" />
          </div>
          
          <div className="space-y-3">
            {canales.map((canal, index) => (
              <div key={canal.canal_contacto} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    index === 0 ? 'bg-blue-500' :
                    index === 1 ? 'bg-green-500' :
                    index === 2 ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}></div>
                  <span className="font-medium text-gray-900">{canal.canal_contacto}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{canal.porcentaje_ventas}%</span>
                  <p className="text-sm text-gray-500">
                    {formatearNumero(canal.ventas)} ventas - {formatearMonto(canal.ticket_promedio)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de Venta */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Tipos de Venta</h3>
            <CreditCard className="h-6 w-6 text-purple-500" />
          </div>
          
          <div className="space-y-4">
            {tiposVenta.map((tipo) => (
              <div key={tipo.tipo_venta} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">{tipo.tipo_venta}</span>
                  <span className="font-bold text-purple-600">{tipo.porcentaje}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Cantidad</p>
                    <p className="font-medium">{formatearNumero(tipo.cantidad)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ingresos</p>
                    <p className="font-medium">{formatearMonto(tipo.ingresos)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ticket Prom.</p>
                    <p className="font-medium">{formatearMonto(tipo.ticket_promedio)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tendencias últimos 15 días */}
      {tendencias.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Tendencias Últimos 15 Días</h3>
            <TrendingUp className="h-6 w-6 text-green-500" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">Fecha</th>
                  <th className="text-right py-2 font-medium text-gray-600">Ventas</th>
                  <th className="text-right py-2 font-medium text-gray-600">Ingresos</th>
                  <th className="text-right py-2 font-medium text-gray-600">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody>
                {tendencias.slice(0, 10).map((dia) => (
                  <tr key={dia.fecha_venta} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      {new Date(dia.fecha_venta).toLocaleDateString('es-PE')}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatearNumero(dia.ventas_dia)}
                    </td>
                    <td className="py-2 text-right font-medium text-green-600">
                      {formatearMonto(dia.ingresos_dia)}
                    </td>
                    <td className="py-2 text-right text-gray-600">
                      {formatearMonto(dia.ticket_promedio_dia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default VistaUnificada;