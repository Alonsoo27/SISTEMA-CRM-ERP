// src/components/ventas/PipelineCharts/PipelineCharts.jsx
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Users, DollarSign, Target,
  BarChart3, PieChart as PieChartIcon, TrendingDown
} from 'lucide-react';

const PipelineCharts = ({ vista, datos, periodo }) => {
  
  // Colores para gráficos
  const colores = {
    prospecto: '#3B82F6',    // blue-500
    cotizado: '#F59E0B',     // amber-500
    negociacion: '#EF4444',  // red-500
    cerrado: '#10B981',      // green-500
    perdido: '#6B7280'       // gray-500
  };

  const coloresPaleta = ['#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#6B7280'];

  // Formatear números para tooltips
  const formatearNumero = (numero) => {
    if (!numero) return '0';
    return new Intl.NumberFormat('es-PE').format(numero);
  };

  const formatearMoneda = (cantidad) => {
    if (!cantidad) return '$0';
    return `$${formatearNumero(cantidad)}`;
  };

  // Custom tooltip para gráficos
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600">{entry.dataKey}:</span>
              <span className="text-sm font-medium text-gray-900">
                {entry.dataKey.includes('valor') || entry.dataKey.includes('ingresos') 
                  ? formatearMoneda(entry.value)
                  : formatearNumero(entry.value)
                }
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Preparar datos para gráficos según vista - compatible con backend corregido
  const prepararDatos = () => {
    if (!datos) return null;

    const { dashboard, embudo, proyeccion } = datos;

    switch (vista) {
      case 'general':
        // Datos para distribución por etapas - estructura corregida
        const distribucionEtapas = dashboard?.distribucion_etapas?.map(etapa => ({
          etapa: etapa.estado,
          cantidad: parseInt(etapa.cantidad || 0),
          valor_total: parseFloat(etapa.valor_total || 0),
          porcentaje: parseFloat(etapa.porcentaje || 0),
          probabilidad_promedio: parseFloat(etapa.probabilidad_promedio || 0)
        })) || [];

        // Datos para performance de asesores - estructura corregida
        const performanceAsesores = dashboard?.performance_asesores?.slice(0, 5).map(asesor => ({
          asesor: asesor.asesor_nombre,
          conversiones: parseInt(asesor.ventas_cerradas || 0),
          tasa_conversion: parseFloat(asesor.tasa_conversion || 0),
          ingresos: parseFloat(asesor.ingresos_generados || 0),
          leads: parseInt(asesor.total_leads || 0)
        })) || [];

        return { distribucionEtapas, performanceAsesores };

      case 'embudo':
        // Datos para el embudo - usando distribucion real del dashboard
        const datosEmbudo = dashboard?.distribucion_etapas?.map((etapa, index) => ({
          etapa: etapa.estado,
          cantidad: parseInt(etapa.cantidad || 0),
          valor: parseFloat(etapa.valor_total || 0),
          porcentaje: parseFloat(etapa.porcentaje || 0),
          fill: coloresPaleta[index % coloresPaleta.length]
        })) || [];

        // Tasas de conversión del embudo - usar datos del dashboard también
        const tasasConversion = embudo?.tasas_conversion || dashboard?.tasas_conversion || {};

        return { datosEmbudo, tasasConversion };

      case 'proyeccion':
        // Datos para proyección de ventas - estructura corregida
        const datosProyeccion = proyeccion?.proyeccion_por_etapa?.map(etapa => ({
          etapa: etapa.estado,
          valor_pipeline: parseFloat(etapa.valor_pipeline || 0),
          valor_proyectado: parseFloat(etapa.valor_proyectado || 0),
          probabilidad: parseFloat(etapa.probabilidad_promedio || 0),
          cantidad: parseInt(etapa.cantidad_oportunidades || 0)
        })) || [];

        return { 
          datosProyeccion, 
          proyeccionTotal: parseFloat(proyeccion?.proyeccion_total || 0) 
        };

      default:
        return null;
    }
  };

  const datosGrafico = prepararDatos();

  if (!datosGrafico) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="text-center text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-3" />
          <p>No hay datos disponibles para mostrar</p>
        </div>
      </div>
    );
  }

  // Renderizar vista General
  if (vista === 'general') {
    const { distribucionEtapas, performanceAsesores } = datosGrafico;

    return (
      <div className="space-y-6">
        {/* Gráfico de Distribución por Etapas */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Distribución por Etapas</h3>
            <BarChart3 className="h-5 w-5 text-gray-500" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de barras - Cantidad */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Cantidad de Prospectos</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={distribucionEtapas}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="etapa" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cantidad" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico circular - Porcentaje */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Distribución Porcentual</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={distribucionEtapas}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ etapa, porcentaje }) => `${etapa}: ${porcentaje.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="porcentaje"
                  >
                    {distribucionEtapas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={coloresPaleta[index % coloresPaleta.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Gráfico de Performance por Asesor */}
        {performanceAsesores.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Asesores - Tasa de Conversión</h3>
              <Users className="h-5 w-5 text-gray-500" />
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceAsesores} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="asesor" 
                  type="category" 
                  tick={{ fontSize: 12 }} 
                  width={100} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="tasa_conversion" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // Renderizar vista Embudo - sin FunnelChart problemático
  if (vista === 'embudo') {
    const { datosEmbudo, tasasConversion } = datosGrafico;

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Embudo de Conversión</h3>
          <TrendingDown className="h-5 w-5 text-gray-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Embudo visual usando BarChart horizontal */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Flujo de Conversión</h4>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={datosEmbudo} 
                layout="horizontal"
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="etapa" 
                  type="category" 
                  tick={{ fontSize: 12 }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cantidad" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                  {datosEmbudo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Métricas del embudo */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Métricas por Etapa</h4>
            <div className="space-y-4">
              {datosEmbudo.map((etapa, index) => (
                <div key={etapa.etapa} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{etapa.etapa}</span>
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: etapa.fill }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Cantidad:</span>
                      <span className="font-medium ml-2">{formatearNumero(etapa.cantidad)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Valor:</span>
                      <span className="font-medium ml-2">{formatearMoneda(etapa.valor)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Porcentaje:</span>
                      <span className="font-medium ml-2">{etapa.porcentaje.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tasas de conversión */}
            {tasasConversion && Object.keys(tasasConversion).length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-3">Tasas de Conversión</h5>
                <div className="space-y-2 text-sm">
                  {tasasConversion.win_rate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Win Rate:</span>
                      <span className="font-medium">{tasasConversion.win_rate}%</span>
                    </div>
                  )}
                  {tasasConversion.tasa_prospecto_avanza && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prospecto Avanza:</span>
                      <span className="font-medium">{tasasConversion.tasa_prospecto_avanza}%</span>
                    </div>
                  )}
                  {tasasConversion.tasa_cotizado_avanza && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cotizado Avanza:</span>
                      <span className="font-medium">{tasasConversion.tasa_cotizado_avanza}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Renderizar vista Proyección
  if (vista === 'proyeccion') {
    const { datosProyeccion, proyeccionTotal } = datosGrafico;

    return (
      <div className="space-y-6">
        {/* Resumen de proyección */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Proyección de Ventas</h3>
            <Target className="h-5 w-5 text-gray-500" />
          </div>
          
          <div className="text-center py-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatearMoneda(proyeccionTotal)}
            </div>
            <p className="text-gray-600">Ingresos proyectados basados en pipeline actual</p>
          </div>
        </div>

        {/* Gráfico de proyección por etapa */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Proyección por Etapa</h3>
          
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={datosProyeccion}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etapa" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor_pipeline" fill="#93C5FD" name="Pipeline Total" />
              <Bar dataKey="valor_proyectado" fill="#3B82F6" name="Valor Proyectado" />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-4 text-center">
            <div className="flex justify-center space-x-6">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-300 rounded mr-2" />
                <span className="text-sm text-gray-600">Pipeline Total</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-600 rounded mr-2" />
                <span className="text-sm text-gray-600">Valor Proyectado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detalle por etapa */}
        {datosProyeccion.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalle por Etapa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {datosProyeccion.map((etapa, index) => (
                <div key={etapa.etapa} className="p-4 border rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{etapa.etapa}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Oportunidades:</span>
                      <span className="font-medium">{formatearNumero(etapa.cantidad)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pipeline:</span>
                      <span className="font-medium">{formatearMoneda(etapa.valor_pipeline)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Proyectado:</span>
                      <span className="font-medium text-green-600">{formatearMoneda(etapa.valor_proyectado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Probabilidad:</span>
                      <span className="font-medium">{etapa.probabilidad.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default PipelineCharts;  