import React, { useState, useEffect, useMemo } from 'react';
import prospectosService from '../../../services/prospectosService';
import MapaPeruMapbox from '../../MapaPeruMapbox';
import VistaSelector from '../../common/VistaSelector';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const Analytics = ({ asesorId = null }) => {
  // 🔒 OBTENER USUARIO REAL del localStorage
  const usuarioActual = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        id: user.id,
        nombre: user.nombre_completo || `${user.nombre || ''} ${user.apellido || ''}`.trim(),
        rol: user.rol?.nombre || user.rol
      };
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      return null;
    }
  }, []);

  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');
  const [vistaSeleccionada, setVistaSeleccionada] = useState(null);

  // 🎯 INICIALIZAR VISTA SEGÚN ROL
  useEffect(() => {
    if (!usuarioActual) return;

    const rolUsuario = usuarioActual.rol?.toUpperCase();
    if (rolUsuario === 'VENDEDOR') {
      // VENDEDOR: Forzar vista personal
      setVistaSeleccionada(usuarioActual.id);
      console.log('🔒 [Analytics] VENDEDOR detectado - Forzando vista personal');
    } else {
      // EJECUTIVOS: Iniciar en vista global
      setVistaSeleccionada(null);
      console.log('👔 [Analytics] EJECUTIVO detectado - Vista global habilitada');
    }
  }, [usuarioActual]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 [Analytics] Cargando datos:', {
        vistaSeleccionada,
        periodo,
        rol: usuarioActual?.rol
      });

      // 🎯 USAR vistaSeleccionada en lugar de asesorId prop
      const response = await prospectosService.obtenerAnalyticsCompletos(vistaSeleccionada, periodo);
      if (response.success) {
        setDatos(response.data);
      } else {
        setError('Error al cargar datos de analytics');
      }
    } catch (error) {
      console.error('Error cargando analytics:', error);
      setError('Error de conexión al cargar analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Solo cargar si vistaSeleccionada ya está inicializada
    if (vistaSeleccionada !== undefined) {
      cargarDatos();
    }
  }, [vistaSeleccionada, periodo]);

  // 🎯 HANDLER PARA CAMBIO DE VISTA
  const handleCambioVista = (asesorId) => {
    console.log('👁️ [Analytics] Cambiando vista a:', asesorId === null ? 'Global' : `Asesor ${asesorId}`);
    setVistaSeleccionada(asesorId);
  };

  const COLORS = {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#6366F1',
    secondary: '#8B5CF6'
  };

  const CHART_COLORS = [
    COLORS.primary,
    COLORS.success,
    COLORS.warning,
    COLORS.error,
    COLORS.info,
    COLORS.secondary,
    '#F97316',
    '#EC4899',
    '#14B8A6',
    '#84CC16'
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="text-red-400">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error en Analytics</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={cargarDatos}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay datos disponibles</p>
      </div>
    );
  }

  // Procesar datos para gráficos
  const datosCanalesBarras = datos.canales?.map(canal => ({
    canal: canal.nombre,
    total: canal.total_prospectos,
    conversiones: canal.conversiones,
    tasa_conversion: parseFloat(canal.tasa_conversion),
    pipeline: canal.pipeline,
    cerrado: canal.cerrado
  })) || [];

  // Usar departamentos para gráfico Pie (PROSPECTOS - INTENCIÓN DE COMPRA)
  const datosGeograficosPie = datos.departamentos?.map((departamento, index) => ({
    name: departamento.departamento,
    value: departamento.total_ventas, // Ahora representa total_prospectos (backend lo mapeó)
    prospectos: departamento.total_prospectos,
    valor_estimado: departamento.valor_estimado_total,
    percentage: departamento.ticket_promedio
  })) || [];

  const datosEvolucionLineas = datos.evolucion_temporal?.map(item => ({
    mes: item.mes,
    prospectos: item.total_prospectos,
    valor: item.total_valor
  })) || [];

  // Usar datos de departamentos reales para el mapa de Mapbox
  const datosParaMapa = datos.departamentos || [];

  return (
    <div className="space-y-6">
      {/* Header con selector de vista y período */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">📊 Analytics de Prospectos</h2>

        <div className="flex items-center space-x-4">
          {/* 👁️ SELECTOR DE VISTA (Solo para ejecutivos) */}
          <VistaSelector
            usuarioActual={usuarioActual}
            onVistaChange={handleCambioVista}
            vistaActual={vistaSeleccionada}
            textos={{
              global: 'Vista Global',
              globalDesc: 'Analytics de todos los asesores',
              personal: 'Mi Vista Personal',
              personalDesc: 'Solo mis analytics',
              otrosLabel: 'Otros Asesores'
            }}
          />

          {/* 📅 SELECTOR DE PERÍODO */}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="semana_actual">Esta Semana</option>
            <option value="mes_actual">Este Mes</option>
            <option value="trimestre_actual">Este Trimestre</option>
            <option value="year_actual">Este Año</option>
          </select>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tasa Conversión</p>
              <p className="text-2xl font-semibold text-gray-900">{datos.metricas.tasa_conversion_real}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pipeline Activo</p>
              <p className="text-2xl font-semibold text-gray-900">$ {datos.metricas.pipeline_activo.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Ventas Cerradas</p>
              <p className="text-2xl font-semibold text-gray-900">$ {datos.metricas.ventas_cerradas.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Efectividad</p>
              <p className="text-2xl font-semibold text-gray-900">{datos.metricas.efectividad_seguimientos}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Canales por Estado */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Performance por Canal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datosCanalesBarras}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="canal" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill={COLORS.primary} name="Total Prospectos" />
              <Bar dataKey="conversiones" fill={COLORS.success} name="Conversiones" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico Circular - Distribución por Departamentos */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🗺️ Prospectos por Departamento</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={datosGeograficosPie}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {datosGeograficosPie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico de Líneas - Evolución Temporal */}
      {datosEvolucionLineas.length > 1 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Evolución Temporal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datosEvolucionLineas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="prospectos" stroke={COLORS.primary} name="Prospectos" />
              <Line type="monotone" dataKey="valor" stroke={COLORS.success} name="Valor USD" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mapa Geográfico de Perú */}
      {datosParaMapa.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-2">
          <MapaPeruMapbox departamentos={datosParaMapa} tipo="prospectos" />
        </div>
      )}

      {/* Insights y Recomendaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Insights Automáticos */}
        {datos.insights && datos.insights.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Insights Automáticos</h3>
            <div className="space-y-4">
              {datos.insights.map((insight, index) => (
                <div key={index} className={`p-4 rounded-lg border-l-4 ${
                  insight.tipo === 'success' ? 'bg-green-50 border-green-400' :
                  insight.tipo === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                  insight.tipo === 'info' ? 'bg-blue-50 border-blue-400' :
                  'bg-gray-50 border-gray-400'
                }`}>
                  <h4 className="font-semibold text-gray-900">{insight.titulo}</h4>
                  <p className="text-sm text-gray-600 mt-1">{insight.descripcion}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">💡 {insight.accion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recomendaciones */}
        {datos.metricas.recomendaciones && datos.metricas.recomendaciones.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Recomendaciones</h3>
            <div className="space-y-3">
              {datos.metricas.recomendaciones.map((recomendacion, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <p className="text-gray-700">{recomendacion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;