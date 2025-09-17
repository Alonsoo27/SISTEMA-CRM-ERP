// src/components/ventas/PipelineMetrics/PipelineMetrics.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Target,
  Users, Clock, AlertTriangle, CheckCircle,
  BarChart3, RefreshCw, ArrowUp, ArrowDown, Eye
} from 'lucide-react';
import pipelineService from '../../../services/pipelineService';
import PipelineCharts from '../PipelineCharts/PipelineCharts';

const PipelineMetrics = ({
  asesorId = null,
  refreshTrigger = 0
}) => {
  // Estados principales
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [vistaActual, setVistaActual] = useState('general');

  // Períodos disponibles
  const periodos = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'semana_actual', label: 'Esta Semana' },
    { value: 'mes_actual', label: 'Este Mes' },
    { value: 'trimestre_actual', label: 'Este Trimestre' }
  ];

  // Cargar datos - optimizado para evitar dependencias circulares
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const resultado = await pipelineService.obtenerDashboardCompleto(asesorId, periodoSeleccionado);
      
      if (resultado.success) {
        setDatos(resultado.data);
      } else {
        setError('Error cargando datos del pipeline');
      }

    } catch (err) {
      console.error('Error cargando pipeline:', err);
      setError('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [asesorId, periodoSeleccionado]); // Solo dependencias primitivas

  // Efectos
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Efecto separado para refreshTrigger para evitar dependencias circulares
  useEffect(() => {
    if (refreshTrigger > 0) {
      cargarDatos();
    }
  }, [refreshTrigger, cargarDatos]);

  // Funciones de formateo
  const formatearNumero = (numero) => {
    if (!numero) return '0';
    return new Intl.NumberFormat('es-PE').format(numero);
  };

  const formatearMoneda = (cantidad) => {
    if (!cantidad) return 'S/ 0';
    return `S/ ${formatearNumero(cantidad)}`;
  };

  const formatearPorcentaje = (porcentaje) => {
    if (!porcentaje) return '0%';
    return `${porcentaje}%`;
  };

  // Componente de KPI Card optimizado
  const KPICard = ({ titulo, valor, subtitulo, icono: Icono, color, tendencia, cambio }) => (
    <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{titulo}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{valor}</p>
          {subtitulo && <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icono className="h-6 w-6 text-white" />
        </div>
      </div>
      {tendencia && (
        <div className={`flex items-center mt-3 text-sm ${
          tendencia === 'up' ? 'text-green-600' : tendencia === 'down' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {tendencia === 'up' && <ArrowUp className="h-4 w-4 mr-1" />}
          {tendencia === 'down' && <ArrowDown className="h-4 w-4 mr-1" />}
          <span>{cambio}</span>
        </div>
      )}
    </div>
  );

  // Componente de Seguimientos Críticos optimizado
  const SeguimientosCriticos = ({ seguimientos }) => {
    if (!seguimientos) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Seguimientos Críticos</h3>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-center py-8 text-gray-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Cargando seguimientos...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Seguimientos Críticos</h3>
          <div className="flex items-center space-x-1">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-gray-600">
              {Array.isArray(seguimientos) ? seguimientos.length : 0}
            </span>
          </div>
        </div>
        
        {Array.isArray(seguimientos) && seguimientos.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {seguimientos.map((seguimiento) => (
              <div 
                key={seguimiento.id}
                className={`p-3 rounded-lg border-l-4 ${
                  seguimiento.criticidad === 'vencido' ? 'border-red-500 bg-red-50' :
                  seguimiento.criticidad === 'proximo_vencer' ? 'border-amber-500 bg-amber-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {seguimiento.nombre_cliente} {seguimiento.apellido_cliente}
                    </p>
                    <p className="text-sm text-gray-600">
                      {seguimiento.estado} - {seguimiento.empresa || 'Sin empresa'}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatearMoneda(seguimiento.valor_estimado)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {seguimiento.seguimiento_obligatorio ? 
                        new Date(seguimiento.seguimiento_obligatorio).toLocaleDateString('es-PE') : 
                        'Sin fecha'
                      }
                    </p>
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      seguimiento.criticidad === 'vencido' ? 'bg-red-100 text-red-800' :
                      seguimiento.criticidad === 'proximo_vencer' ? 'bg-amber-100 text-amber-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {seguimiento.criticidad === 'vencido' ? 'Vencido' :
                       seguimiento.criticidad === 'proximo_vencer' ? 'Por vencer' : 'Próximo'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p>No hay seguimientos críticos</p>
          </div>
        )}
      </div>
    );
  };

  // Vista de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Cargando métricas de pipeline...</span>
        </div>
      </div>
    );
  }

  // Vista de error
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
          <div>
            <h3 className="text-red-800 font-medium">Error cargando datos</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={cargarDatos}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Extraer datos con valores por defecto seguros
  const dashboard = datos?.dashboard || {};
  const kpis = dashboard?.kpis_principales || {};
  const seguimientos = datos?.seguimientos_criticos || [];

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pipeline de Ventas</h2>
          <p className="text-gray-600">Análisis de conversión y oportunidades</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Selector de período */}
          <select
            value={periodoSeleccionado}
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {periodos.map(periodo => (
              <option key={periodo.value} value={periodo.value}>
                {periodo.label}
              </option>
            ))}
          </select>

          {/* Selector de vista */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setVistaActual('general')}
              className={`px-3 py-2 text-sm ${
                vistaActual === 'general' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setVistaActual('embudo')}
              className={`px-3 py-2 text-sm border-l ${
                vistaActual === 'embudo' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Embudo
            </button>
            <button
              onClick={() => setVistaActual('proyeccion')}
              className={`px-3 py-2 text-sm border-l ${
                vistaActual === 'proyeccion' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Proyección
            </button>
          </div>

          <button
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs Principales - usando datos reales del backend corregido */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          titulo="Leads Activos"
          valor={formatearNumero(kpis.total_leads)}
          subtitulo="En seguimiento"
          icono={Users}
          color="bg-blue-600"
        />
        
        <KPICard
          titulo="Tasa de Conversión"
          valor={formatearPorcentaje(kpis.tasa_conversion_general)}
          subtitulo="Lead → Venta"
          icono={Target}
          color="bg-green-600"
        />
        
        <KPICard
          titulo="Tiempo Promedio"
          valor={kpis.dias_promedio_cierre ? `${Math.round(kpis.dias_promedio_cierre)} días` : '-- días'}
          subtitulo="Para cerrar"
          icono={Clock}
          color="bg-amber-600"
        />
        
        <KPICard
          titulo="Ingresos Generados"
          valor={formatearMoneda(kpis.ingresos_totales)}
          subtitulo="Período actual"
          icono={DollarSign}
          color="bg-purple-600"
        />
      </div>

      {/* Alertas críticas si hay seguimientos vencidos */}
      {kpis.seguimientos_vencidos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
            <span className="text-amber-800 font-medium">
              Tienes {kpis.seguimientos_vencidos} seguimiento(s) vencido(s) que requieren atención inmediata
            </span>
          </div>
        </div>
      )}

      {/* Contenido principal según vista */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PipelineCharts 
            vista={vistaActual}
            datos={datos}
            periodo={periodoSeleccionado}
          />
        </div>
        
        <div>
          <SeguimientosCriticos seguimientos={seguimientos} />
        </div>
      </div>
    </div>
  );
};

export default PipelineMetrics;