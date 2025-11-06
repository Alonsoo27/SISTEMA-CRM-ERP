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

  // Preparar datos para gráficos según vista - Backend v3.0
  const prepararDatos = () => {
    if (!datos) return null;

    const { distribucion_snapshot, distribucion_canal, embudo, proyeccion } = datos;

    switch (vista) {
      case 'general':
        // Backend v3.0: usar distribucion_snapshot (snapshot actual del pipeline)
        const snapshotData = distribucion_snapshot || {};

        // Convertir snapshot en array para gráficos
        const distribucionEtapas = [
          {
            etapa: 'Prospecto',
            cantidad: parseInt(snapshotData.prospectos || 0),
            porcentaje: 0 // Se calculará después
          },
          {
            etapa: 'Cotizado',
            cantidad: parseInt(snapshotData.cotizados || 0),
            porcentaje: 0
          },
          {
            etapa: 'Negociación',
            cantidad: parseInt(snapshotData.negociacion || 0),
            porcentaje: 0
          }
        ];

        // Calcular porcentajes
        const totalLeads = distribucionEtapas.reduce((sum, e) => sum + e.cantidad, 0);
        distribucionEtapas.forEach(etapa => {
          etapa.porcentaje = totalLeads > 0 ? (etapa.cantidad / totalLeads) * 100 : 0;
        });

        // Backend v3.0: usar distribucion_canal para gráfico de canales
        const distribucionCanales = distribucion_canal?.slice(0, 5).map(canal => ({
          canal: canal.canal,
          cantidad: parseInt(canal.cantidad || 0),
          conversiones: parseInt(canal.conversiones || 0),
          tasa_conversion: parseFloat(canal.tasa_conversion || 0),
          valor_total: parseFloat(canal.valor_total || 0)
        })) || [];

        return { distribucionEtapas, distribucionCanales };

      case 'embudo':
        // Backend v3.0: usar datos del endpoint /embudo
        const datosEmbudo = embudo?.embudo?.etapas?.map((etapa, index) => ({
          etapa: etapa.nombre,
          cantidad: parseInt(etapa.cantidad || 0),
          valor: parseFloat(etapa.valor || 0),
          porcentaje: parseFloat(etapa.porcentaje || 0),
          conversion_desde_anterior: parseFloat(etapa.conversion_desde_anterior || 0),
          fill: coloresPaleta[index % coloresPaleta.length]
        })) || [];

        // Win rate del embudo
        const tasasConversion = {
          win_rate: embudo?.embudo?.win_rate || 0,
          modo: embudo?.modo || 'snapshot'
        };

        return { datosEmbudo, tasasConversion };

      case 'proyeccion':
        // Backend v3.0: usar datos del endpoint /proyeccion
        const datosProyeccion = proyeccion?.detalle_por_etapa?.map(etapa => ({
          etapa: etapa.etapa,
          valor_pipeline: parseFloat(etapa.valor_total || 0),
          valor_proyectado: parseFloat(etapa.valor_ponderado || 0),
          probabilidad: parseFloat(etapa.probabilidad_promedio || 0),
          cantidad: parseInt(etapa.cantidad || 0)
        })) || [];

        // Proyecciones (conservadora, realista, optimista)
        const proyecciones = proyeccion?.proyecciones || {};

        return {
          datosProyeccion,
          proyecciones,
          proyeccionTotal: parseFloat(proyecciones.realista?.valor || 0),
          pipelineActual: proyeccion?.pipeline_actual || {}
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
    const { distribucionEtapas, distribucionCanales } = datosGrafico;

    return (
      <div className="space-y-6">
        {/* Gráfico de Distribución por Etapas */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Distribución del Pipeline Actual</h3>
            <BarChart3 className="h-5 w-5 text-gray-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de barras - Cantidad */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Leads por Etapa (Snapshot)</h4>
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

        {/* Gráfico de Performance por Canal */}
        {distribucionCanales.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Performance por Canal de Contacto</h3>
              <TrendingUp className="h-5 w-5 text-gray-500" />
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribucionCanales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="canal"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="cantidad" fill="#3B82F6" name="Cantidad" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="tasa_conversion" fill="#10B981" name="Tasa Conversión %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Tabla de detalles */}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Conversiones</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tasa %</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {distribucionCanales.map((canal, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900">{canal.canal}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatearNumero(canal.cantidad)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatearNumero(canal.conversiones)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{canal.tasa_conversion.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatearMoneda(canal.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

  // Renderizar vista Proyección - Backend v3.0
  if (vista === 'proyeccion') {
    const { datosProyeccion, proyecciones, proyeccionTotal, pipelineActual } = datosGrafico;

    return (
      <div className="space-y-6">
        {/* Resumen del Pipeline Actual */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Pipeline Actual</h3>
            <DollarSign className="h-6 w-6" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-blue-100 mb-1">Valor Total</p>
              <p className="text-2xl font-bold">{formatearMoneda(pipelineActual.valor_total)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-100 mb-1">Valor Ponderado</p>
              <p className="text-2xl font-bold">{formatearMoneda(pipelineActual.valor_ponderado)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-100 mb-1">Oportunidades</p>
              <p className="text-2xl font-bold">{formatearNumero(pipelineActual.cantidad_oportunidades)}</p>
            </div>
          </div>
        </div>

        {/* Proyecciones: Conservadora, Realista, Optimista */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Conservadora */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
                <TrendingDown className="h-6 w-6 text-yellow-600" />
              </div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Conservadora</h4>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {formatearMoneda(proyecciones.conservadora?.valor)}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {proyecciones.conservadora?.descripcion}
              </p>
              <div className="text-xs text-gray-600">
                Tasa: {proyecciones.conservadora?.probabilidad}%
              </div>
            </div>
          </div>

          {/* Realista */}
          <div className="bg-white rounded-lg shadow-sm border-2 border-blue-500 p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="text-sm font-medium text-blue-600 mb-2">Realista ⭐</h4>
              <p className="text-3xl font-bold text-blue-600 mb-1">
                {formatearMoneda(proyecciones.realista?.valor)}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {proyecciones.realista?.descripcion}
              </p>
              <div className="text-xs text-gray-600">
                Ponderada por probabilidad
              </div>
            </div>
          </div>

          {/* Optimista */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Optimista</h4>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {formatearMoneda(proyecciones.optimista?.valor)}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {proyecciones.optimista?.descripcion}
              </p>
              <div className="text-xs text-gray-600">
                Tasa: {proyecciones.optimista?.probabilidad}%
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de proyección por etapa */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis por Etapa del Pipeline</h3>

          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={datosProyeccion}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etapa" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor_pipeline" fill="#93C5FD" name="Valor Total" />
              <Bar dataKey="valor_proyectado" fill="#3B82F6" name="Valor Ponderado" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 text-center">
            <div className="flex justify-center space-x-6">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-300 rounded mr-2" />
                <span className="text-sm text-gray-600">Valor Total</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-600 rounded mr-2" />
                <span className="text-sm text-gray-600">Valor Ponderado (por probabilidad)</span>
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
                <div key={etapa.etapa} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="font-medium text-gray-900 mb-3">{etapa.etapa}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Oportunidades:</span>
                      <span className="font-medium">{formatearNumero(etapa.cantidad)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Total:</span>
                      <span className="font-medium">{formatearMoneda(etapa.valor_pipeline)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ponderado:</span>
                      <span className="font-medium text-blue-600">{formatearMoneda(etapa.valor_proyectado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Probabilidad:</span>
                      <span className="font-medium">{etapa.probabilidad.toFixed(1)}%</span>
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