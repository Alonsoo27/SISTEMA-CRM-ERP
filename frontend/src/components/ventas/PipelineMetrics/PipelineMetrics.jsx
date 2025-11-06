// src/components/ventas/PipelineMetrics/PipelineMetrics.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Target,
  Users, Clock, AlertTriangle, CheckCircle,
  BarChart3, RefreshCw, ArrowUp, ArrowDown, Eye, Monitor, User as UserIcon
} from 'lucide-react';
import pipelineService from '../../../services/pipelineService';
import PipelineCharts from '../PipelineCharts/PipelineCharts';
import PeriodSelectorSimple from '../PeriodSelector/PeriodSelectorSimple';
import { ENDPOINTS } from '../../../config/dashboardConfig';
import { fetchWithErrorHandling, determinarModoVistaInicial, puedeAlternarModos } from '../../../utils/dashboardUtils';

const PipelineMetrics = ({
  asesorId = null,
  refreshTrigger = 0,
  usuarioActual = null
}) => {
  // Estados principales
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [vistaActual, setVistaActual] = useState('general');

  // ✅ Estados para selector de vistas por rol
  const [modoVista, setModoVista] = useState('propio');
  const [asesorSeleccionado, setAsesorSeleccionado] = useState(asesorId || usuarioActual?.id);
  const [asesoresDisponibles, setAsesoresDisponibles] = useState([]);
  const [loadingAsesores, setLoadingAsesores] = useState(false);

  // Períodos disponibles
  const periodos = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'semana_actual', label: 'Esta Semana' },
    { value: 'mes_actual', label: 'Este Mes' },
    { value: 'trimestre_actual', label: 'Este Trimestre' }
  ];

  // ✅ Memoizar permisos del usuario
  const puedeToggleModos = useMemo(() =>
    puedeAlternarModos(usuarioActual),
    [usuarioActual]
  );

  // ✅ Determinar modo de vista inicial según permisos del usuario
  const determinarModoVista = useCallback(() => {
    if (!usuarioActual) {
      return { modo: 'propio', asesorSeleccionado: asesorId };
    }

    const { modo, asesorSeleccionado: asesorInicial } = determinarModoVistaInicial(usuarioActual);
    setModoVista(modo);
    setAsesorSeleccionado(asesorInicial || asesorId);

    console.log('[PipelineMetrics] Modo vista inicial:', { modo, asesorInicial });

    return modo;
  }, [usuarioActual, asesorId]);

  // ✅ Cargar lista de asesores supervisables
  const cargarAsesores = useCallback(async () => {
    try {
      setLoadingAsesores(true);
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('[PipelineMetrics] Token no encontrado');
        return;
      }

      const resultado = await fetchWithErrorHandling(
        ENDPOINTS.ASESORES_SUPERVISABLES,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (resultado.success) {
        const asesores = resultado.data?.data?.asesores || resultado.data?.asesores || [];
        setAsesoresDisponibles(asesores);
        console.log('[PipelineMetrics] Asesores cargados:', asesores.length);
      } else {
        console.error('[PipelineMetrics] Error cargando asesores:', resultado.error);
      }

    } catch (error) {
      console.error('[PipelineMetrics] Error cargando asesores:', error);
    } finally {
      setLoadingAsesores(false);
    }
  }, []);

  // ✅ Toggle entre modo propio y supervisor
  const toggleModoVista = useCallback(() => {
    if (!puedeToggleModos) return;

    if (modoVista === 'propio') {
      setModoVista('supervisor');
      setAsesorSeleccionado(null);
      cargarAsesores();
    } else {
      setModoVista('propio');
      setAsesorSeleccionado(usuarioActual?.id);
    }

    // Limpiar datos para forzar recarga
    setDatos(null);
  }, [modoVista, usuarioActual, puedeToggleModos, cargarAsesores]);

  // ✅ Cambiar asesor seleccionado
  const cambiarAsesor = useCallback((nuevoAsesorId) => {
    if (nuevoAsesorId !== asesorSeleccionado) {
      setAsesorSeleccionado(nuevoAsesorId);
      setDatos(null);
    }
  }, [asesorSeleccionado]);

  // ✅ Cargar datos - modificado para usar asesorSeleccionado
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Validación: No cargar si no hay asesor seleccionado
      if (!asesorSeleccionado) {
        setLoading(false);
        return;
      }

      const resultado = await pipelineService.obtenerDashboardCompleto(asesorSeleccionado, periodoSeleccionado);

      if (resultado.success) {
        setDatos(resultado.data);
      } else {
        setError('Error cargando datos del pipeline');
      }

    } catch (err) {
      console.error('[PipelineMetrics] Error cargando pipeline:', err);
      setError('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [asesorSeleccionado, periodoSeleccionado]);

  // ✅ Efecto para determinar modo de vista inicial
  useEffect(() => {
    if (usuarioActual) {
      const modo = determinarModoVista();

      // Si es modo supervisor, cargar asesores inmediatamente
      if (modo === 'supervisor') {
        cargarAsesores();
      }
    }
  }, [usuarioActual]); // Solo ejecutar cuando cambia el usuario

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
    if (!cantidad) return '$0';
    return `$${formatearNumero(cantidad)}`;
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
  // Backend v3.0 retorna estructura: { kpis_principales, kpis_secundarios, distribucion_snapshot, alertas, ... }
  const kpisPrincipales = datos?.kpis_principales || {};
  const kpisSecundarios = datos?.kpis_secundarios || {};
  const alertas = datos?.alertas || {};
  const distribucion = datos?.distribucion_snapshot || {};
  const seguimientos = datos?.seguimientos_criticos || [];

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-start sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">Pipeline de Ventas</h2>
            <p className="text-purple-100 mt-1">
              {modoVista === 'supervisor'
                ? 'Vista del equipo - Supervisión general'
                : 'Tu pipeline personal'
              }
            </p>
          </div>

          <div className="flex gap-3">
            {/* ✅ Selector de modo de vista (propio/supervisor) - Solo para SUPER_ADMIN */}
            {puedeToggleModos && (
              <button
                onClick={toggleModoVista}
                className="flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20"
                title={modoVista === 'propio' ? 'Cambiar a vista supervisor' : 'Cambiar a vista personal'}
              >
                {modoVista === 'propio' ? (
                  <>
                    <Monitor className="h-4 w-4 mr-2" />
                    Vista Supervisor
                  </>
                ) : (
                  <>
                    <UserIcon className="h-4 w-4 mr-2" />
                    Vista Personal
                  </>
                )}
              </button>
            )}

            {/* Selector de vista */}
            <div className="flex border border-white/20 rounded-lg overflow-hidden bg-white/10">
              <button
                onClick={() => setVistaActual('general')}
                className={`px-3 py-2 text-sm ${
                  vistaActual === 'general' ? 'bg-white text-purple-600' : 'text-white hover:bg-white/20'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setVistaActual('embudo')}
                className={`px-3 py-2 text-sm border-l border-white/20 ${
                  vistaActual === 'embudo' ? 'bg-white text-purple-600' : 'text-white hover:bg-white/20'
                }`}
              >
                Embudo
              </button>
              <button
                onClick={() => setVistaActual('proyeccion')}
                className={`px-3 py-2 text-sm border-l border-white/20 ${
                  vistaActual === 'proyeccion' ? 'bg-white text-purple-600' : 'text-white hover:bg-white/20'
                }`}
              >
                Proyección
              </button>
            </div>

            <button
              onClick={cargarDatos}
              disabled={loading}
              className="flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 border border-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Selector de asesor (solo en modo supervisor) */}
      {modoVista === 'supervisor' && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Seleccionar Asesor</h3>
              <p className="text-sm text-gray-600">
                {asesorSeleccionado
                  ? `Viendo pipeline de: ${asesoresDisponibles.find(a => a.id === asesorSeleccionado)?.nombre_completo || 'Asesor seleccionado'}`
                  : 'Selecciona un asesor para ver su pipeline'
                }
              </p>
            </div>
            <div className="w-64">
              {loadingAsesores ? (
                <div className="flex items-center justify-center py-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Cargando asesores...</span>
                </div>
              ) : (
                <select
                  value={asesorSeleccionado || ''}
                  onChange={(e) => cambiarAsesor(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">-- Seleccionar asesor --</option>
                  {asesoresDisponibles.map((asesor) => (
                    <option key={asesor.id} value={asesor.id}>
                      {asesor.nombre_completo}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selector de Período - Simple (no depende de períodos disponibles) */}
      <PeriodSelectorSimple
        onPeriodChange={setPeriodoSeleccionado}
        initialPeriod={periodoSeleccionado}
        loading={loading}
      />

      {/* KPIs Principales - Backend v3.0 con temporalidad profesional */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          titulo="Leads Activos"
          valor={formatearNumero(kpisPrincipales.leads_activos)}
          subtitulo={kpisPrincipales.leads_activos_variacion !== null
            ? `${kpisPrincipales.leads_activos_variacion > 0 ? '+' : ''}${kpisPrincipales.leads_activos_variacion}% vs período anterior`
            : "Pipeline actual (snapshot)"
          }
          icono={Users}
          color="bg-blue-600"
          tendencia={
            kpisPrincipales.leads_activos_variacion > 0 ? 'up' :
            kpisPrincipales.leads_activos_variacion < 0 ? 'down' : null
          }
          cambio={kpisPrincipales.leads_activos_variacion !== null
            ? `${Math.abs(kpisPrincipales.leads_activos_variacion)}%`
            : null
          }
        />

        <KPICard
          titulo="Win Rate"
          valor={formatearPorcentaje(kpisPrincipales.win_rate)}
          subtitulo={`${kpisPrincipales.cerrados_periodo || 0} cerrados / ${(kpisPrincipales.cerrados_periodo || 0) + (kpisPrincipales.perdidos_periodo || 0)} totales`}
          icono={Target}
          color="bg-green-600"
          tendencia={
            kpisPrincipales.win_rate_variacion > 0 ? 'up' :
            kpisPrincipales.win_rate_variacion < 0 ? 'down' : null
          }
          cambio={kpisPrincipales.win_rate_variacion !== null
            ? `${Math.abs(kpisPrincipales.win_rate_variacion)}%`
            : null
          }
        />

        <KPICard
          titulo="Velocidad de Cierre"
          valor={kpisPrincipales.dias_promedio_cierre ? `${kpisPrincipales.dias_promedio_cierre} días` : '-- días'}
          subtitulo={kpisPrincipales.dias_promedio_variacion !== null
            ? `${kpisPrincipales.dias_promedio_variacion > 0 ? '+' : ''}${kpisPrincipales.dias_promedio_variacion}% vs anterior`
            : "Tiempo promedio de cierre"
          }
          icono={Clock}
          color="bg-amber-600"
          tendencia={
            kpisPrincipales.dias_promedio_variacion < 0 ? 'up' : // Menos días es mejor = tendencia up
            kpisPrincipales.dias_promedio_variacion > 0 ? 'down' : null
          }
          cambio={kpisPrincipales.dias_promedio_variacion !== null
            ? `${Math.abs(kpisPrincipales.dias_promedio_variacion)}%`
            : null
          }
        />

        <KPICard
          titulo="Ingresos del Período"
          valor={formatearMoneda(kpisSecundarios.ingresos_totales)}
          subtitulo={`${kpisSecundarios.ventas_cerradas || 0} ventas cerradas`}
          icono={DollarSign}
          color="bg-purple-600"
        />
      </div>

      {/* Alertas críticas - Backend v3.0 */}
      {alertas.necesita_atencion && alertas.seguimientos_vencidos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
              <span className="text-amber-800 font-medium">
                {alertas.seguimientos_vencidos} seguimiento(s) vencido(s) que requieren atención inmediata
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm text-amber-700 font-semibold">
                Valor en riesgo: {formatearMoneda(alertas.valor_en_riesgo)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs Secundarios - Nueva sección */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pipeline Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatearMoneda(kpisPrincipales.pipeline_valor_total)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Ponderado: {formatearMoneda(kpisPrincipales.pipeline_valor_ponderado)}
              </p>
            </div>
            <div className="text-right">
              {kpisPrincipales.pipeline_valor_variacion !== null && (
                <span className={`text-sm font-medium ${
                  kpisPrincipales.pipeline_valor_variacion > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpisPrincipales.pipeline_valor_variacion > 0 ? '+' : ''}{kpisPrincipales.pipeline_valor_variacion}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tasa de Conversión</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatearPorcentaje(kpisSecundarios.tasa_conversion_global)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {kpisSecundarios.leads_convertidos} de {kpisSecundarios.leads_contactados} leads
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatearMoneda(kpisSecundarios.ticket_promedio)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                De {kpisSecundarios.ventas_cerradas} ventas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline en Riesgo */}
      {kpisSecundarios.leads_en_riesgo > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800 font-medium">
                {kpisSecundarios.leads_en_riesgo} oportunidades en riesgo (seguimientos vencidos)
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm text-red-700 font-semibold">
                Valor: {formatearMoneda(kpisSecundarios.pipeline_en_riesgo)}
              </p>
            </div>
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