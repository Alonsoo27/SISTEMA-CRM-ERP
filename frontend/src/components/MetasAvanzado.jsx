import React, { useState, useEffect } from 'react';
import ventasService from '../services/ventasService';
import {
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
  Activity,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertOctagon,
  Lightbulb,
  TrendingDown,
  Star,
  Zap,
  Calculator,
  Bell,
  Settings,
  Plus
} from 'lucide-react';
import PeriodSelectorAdvanced from './ventas/PeriodSelector/PeriodSelectorAdvanced';

const MetasAvanzado = ({ usuarioActual }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');

  // Estados para configuración de metas
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [asesoresConfigurables, setAsesoresConfigurables] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Cargar datos del endpoint
  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await ventasService.obtenerDashboardMetasAvanzado(periodo);

      if (response.success) {
        setDatos(response.data);
        console.log('🎯 Datos de metas avanzado cargados:', response.data);
      } else {
        setError('Error al cargar datos de metas');
      }
    } catch (err) {
      console.error('Error cargando metas avanzado:', err);
      if (err.message?.includes('403')) {
        setError('Acceso denegado: Se requieren privilegios ejecutivos');
      } else {
        setError('Error de conexión al servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  // Funciones para configuración de metas
  const abrirConfiguracion = async () => {
    try {
      setLoadingConfig(true);

      // Obtener lista de asesores configurables
      const response = await fetch('/api/metas/ventas/configurables', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAsesoresConfigurables(data.data.asesores);
          setMostrarConfiguracion(true);
        }
      } else {
        console.error('Error obteniendo asesores configurables');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const crearMetasAutomaticas = async (periodo = 'mes_actual', forzar = false) => {
    try {
      setLoadingConfig(true);

      const response = await fetch('/api/metas/ventas/automaticas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ periodo, forzar })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Metas automáticas creadas:', data.data);
          alert(`✅ Metas procesadas: ${data.data.metas_creadas} creadas, ${data.data.metas_actualizadas} actualizadas`);

          // Recargar datos del dashboard
          await cargarDatos();
          await abrirConfiguracion(); // Actualizar lista
        }
      } else {
        alert('❌ Error creando metas automáticas');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error de conexión');
    } finally {
      setLoadingConfig(false);
    }
  };

  const configurarMetaManual = async (asesorId, metaValor, metaCantidad, observaciones = '') => {
    try {
      const hoy = new Date();

      const response = await fetch('/api/metas/ventas/configurar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          asesor_id: asesorId,
          año: hoy.getFullYear(),
          mes: hoy.getMonth() + 1,
          meta_valor: metaValor,
          meta_cantidad: metaCantidad,
          observaciones
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Meta configurada:', data.data);
          alert(`✅ Meta configurada para ${data.data.asesor.nombre}`);

          // Recargar datos
          await cargarDatos();
          await abrirConfiguracion();
        }
      } else {
        alert('❌ Error configurando meta');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error de conexión');
    }
  };

  // Componente de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando metas avanzado...</span>
      </div>
    );
  }

  // Componente de error
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
        <button 
          onClick={cargarDatos}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Sin datos
  if (!datos || !datos.asesores_metas || datos.asesores_metas.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Target className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-800 mb-2">No hay metas configuradas</h3>
        <p className="text-yellow-700">No se encontraron metas para el período seleccionado.</p>
      </div>
    );
  }

  const {
    asesores_metas,
    metricas_equipo,
    progreso_periodo,
    dias_transcurridos,
    dias_total,
    periodos_disponibles,
    fallback_aplicado,
    mensaje_contexto,
    es_periodo_actual
  } = datos;

  // ============================================
  // FUNCIONES AUXILIARES MEJORADAS
  // ============================================

  // Función para obtener color de progreso
  const getProgresoColor = (porcentaje) => {
    if (porcentaje >= 100) return 'text-green-600 bg-green-100';
    if (porcentaje >= 80) return 'text-blue-600 bg-blue-100';
    if (porcentaje >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Función para obtener color de alerta
  const getAlertColor = (tipo) => {
    const colores = {
      'critica': 'bg-red-50 border-red-200 text-red-800',
      'advertencia': 'bg-yellow-50 border-yellow-200 text-yellow-800',
      'info': 'bg-blue-50 border-blue-200 text-blue-800',
      'oportunidad': 'bg-green-50 border-green-200 text-green-800',
      'exito': 'bg-emerald-50 border-emerald-200 text-emerald-800'
    };
    return colores[tipo] || 'bg-gray-50 border-gray-200 text-gray-800';
  };

  // Función para obtener ícono de alerta
  const getAlertIcon = (tipo) => {
    const iconos = {
      'critica': <AlertOctagon className="h-4 w-4" />,
      'advertencia': <AlertTriangle className="h-4 w-4" />,
      'info': <Bell className="h-4 w-4" />,
      'oportunidad': <Lightbulb className="h-4 w-4" />,
      'exito': <Star className="h-4 w-4" />
    };
    return iconos[tipo] || <Bell className="h-4 w-4" />;
  };

  // Función para determinar badge de nivel
  const getNivelAsesorBadge = (metaUsd) => {
    const meta = parseFloat(metaUsd);
    if (meta === 2500) return { text: 'Nuevo', color: 'bg-blue-100 text-blue-800' };
    if (meta >= 4000 && meta <= 5000) return { text: 'Intermedio', color: 'bg-purple-100 text-purple-800' };
    if (meta === 8000) return { text: 'Avanzado', color: 'bg-orange-100 text-orange-800' };
    if (meta > 8000) return { text: 'Elite', color: 'bg-green-100 text-green-800' };
    return { text: 'Custom', color: 'bg-gray-100 text-gray-800' };
  };

  // Función para obtener ícono de tendencia
  const getTrendIcon = (porcentaje) => {
    if (porcentaje >= 100) return <CheckCircle className="h-4 w-4" />;
    if (porcentaje >= 80) return <TrendingUp className="h-4 w-4" />;
    if (porcentaje >= 50) return <Minus className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  // Función para formatear dinero
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              Metas Avanzado
            </h2>
            <p className="text-blue-100 mt-1">
              Sistema de bonos por performance y actividad
            </p>
          </div>

          {/* Botón de Configuración de Metas */}
          <button
            onClick={abrirConfiguracion}
            disabled={loadingConfig}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors duration-200 font-medium"
          >
            {loadingConfig ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Cargando...</span>
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                <span>Configurar Metas</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selector de Período */}
      <PeriodSelectorAdvanced
        asesorId={usuarioActual?.id}
        onPeriodChange={setPeriodo}
        initialPeriod={periodo}
        loading={loading}
      />

      {/* Banner informativo cuando hay fallback */}
      {mensaje_contexto && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-400 mr-3" />
            <div>
              <p className="text-orange-800 font-medium">Información del Período</p>
              <p className="text-orange-700 text-sm">{mensaje_contexto}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs del Equipo Ejecutivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Asesores</p>
              <p className="text-2xl font-bold text-gray-900">{metricas_equipo?.total_asesores || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bonos Generados</p>
              <p className="text-2xl font-bold text-green-600">{formatMoney(metricas_equipo?.bonos_total_usd)}</p>
            </div>
            <Award className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Asesores con Bono</p>
              <p className="text-2xl font-bold text-purple-600">{metricas_equipo?.asesores_con_bono || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Promedio Equipo</p>
              <p className="text-2xl font-bold text-blue-600">{metricas_equipo?.promedio_cumplimiento || 0}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        {/* Nuevo KPI: Rentabilidad de Bonos */}
        {metricas_equipo?.rentabilidad_bonos && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rentabilidad Bonos</p>
                <p className="text-2xl font-bold text-green-600">
                  {metricas_equipo.rentabilidad_bonos.ratio_bono_ventas}%
                </p>
                <p className="text-xs text-gray-500">
                  ROI: {metricas_equipo.rentabilidad_bonos.eficiencia}x
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        )}
      </div>

      {/* Progreso del Período */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Progreso del Período
        </h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Días transcurridos: {dias_transcurridos} de {dias_total}</span>
          <span className="text-sm font-medium text-gray-900">{Math.round(progreso_periodo || 0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progreso_periodo || 0, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Distribución del Equipo por Performance (Vista Ejecutiva) */}
      {metricas_equipo?.distribucion_performance && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Distribución de Performance del Equipo
            </h3>
            <p className="text-sm text-gray-600 mt-1">Vista ejecutiva para gestión de asesores</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {metricas_equipo.distribucion_performance.superando}
                </div>
                <div className="text-sm font-medium text-green-700 mb-1">Superando Meta</div>
                <div className="text-xs text-green-600">≥100% cumplimiento</div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {metricas_equipo.distribucion_performance.en_meta}
                </div>
                <div className="text-sm font-medium text-blue-700 mb-1">En Meta</div>
                <div className="text-xs text-blue-600">80-99% cumplimiento</div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-2">
                  {metricas_equipo.distribucion_performance.rezagados}
                </div>
                <div className="text-sm font-medium text-yellow-700 mb-1">Rezagados</div>
                <div className="text-xs text-yellow-600">50-79% cumplimiento</div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 mb-2">
                  {metricas_equipo.distribucion_performance.criticos}
                </div>
                <div className="text-sm font-medium text-red-700 mb-1">Críticos</div>
                <div className="text-xs text-red-600">&lt;50% cumplimiento</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Performers (Vista Ejecutiva) */}
      {metricas_equipo?.top_performers && metricas_equipo.top_performers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-600" />
              Top Performers del Período
            </h3>
            <p className="text-sm text-gray-600 mt-1">Mejores asesores para reconocimiento</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metricas_equipo.top_performers.map((performer, index) => (
                <div key={performer.nombre} className={`rounded-lg p-4 text-center ${
                  index === 0 ? 'bg-yellow-50 border-2 border-yellow-300' :
                  index === 1 ? 'bg-gray-50 border-2 border-gray-300' :
                  'bg-orange-50 border-2 border-orange-300'
                }`}>
                  <div className={`text-3xl mb-2 ${
                    index === 0 ? 'text-yellow-600' :
                    index === 1 ? 'text-gray-600' :
                    'text-orange-600'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="font-semibold text-gray-900 mb-1">{performer.nombre}</div>
                  <div className="text-sm text-gray-600 mb-2">{performer.nivel}</div>
                  <div className={`text-lg font-bold ${
                    index === 0 ? 'text-yellow-600' :
                    index === 1 ? 'text-gray-600' :
                    'text-orange-600'
                  }`}>
                    {performer.porcentaje.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* NUEVAS SECCIONES: ALERTAS Y SIMULADORES */}
      {/* ============================================ */}

      {/* Alertas Inteligentes del Sistema */}
      {asesores_metas && asesores_metas.some(asesor => asesor.alertas_inteligentes?.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-yellow-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-600" />
              Alertas Inteligentes del Sistema
            </h3>
            <p className="text-sm text-gray-600 mt-1">Alertas automáticas por nivel de asesor y performance</p>
          </div>

          <div className="p-6 space-y-4">
            {asesores_metas
              .filter(asesor => asesor.alertas_inteligentes?.length > 0)
              .map(asesor => (
                <div key={asesor.asesor_id} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">{asesor.nombre}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getNivelAsesorBadge(asesor.meta_usd).color}`}>
                      {getNivelAsesorBadge(asesor.meta_usd).text}
                    </span>
                  </div>

                  {asesor.alertas_inteligentes.map((alerta, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${getAlertColor(alerta.tipo)}`}>
                      <div className="flex items-start gap-2">
                        {getAlertIcon(alerta.tipo)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alerta.mensaje}</p>
                          <p className="text-xs mt-1 opacity-75">
                            <strong>Acción:</strong> {alerta.accion_recomendada}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Simulador de Bonos Inteligente */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-green-600" />
            Simulador de Bonos Inteligente
          </h3>
          <p className="text-sm text-gray-600 mt-1">Optimización automática de bonos y próximos niveles</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {asesores_metas
              .filter(asesor => asesor.simulador_bonos)
              .slice(0, 4)
              .map(asesor => (
                <div key={asesor.asesor_id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{asesor.nombre}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getNivelAsesorBadge(asesor.meta_usd).color}`}>
                        {getNivelAsesorBadge(asesor.meta_usd).text}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {formatMoney(asesor.simulador_bonos?.ventas_actuales || 0)}
                    </span>
                  </div>

                  {/* Recomendación Principal */}
                  {asesor.simulador_bonos?.recomendacion && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                      <p className="text-sm text-blue-800 font-medium">
                        💡 {asesor.simulador_bonos.recomendacion}
                      </p>
                    </div>
                  )}

                  {/* Próximos Niveles */}
                  {asesor.simulador_bonos?.proximos_niveles && asesor.simulador_bonos.proximos_niveles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Próximos Objetivos:</p>
                      {asesor.simulador_bonos.proximos_niveles
                        .filter(nivel => nivel.para_80 || nivel.para_90 || nivel.para_100)
                        .slice(0, 2)
                        .map((nivel, index) => (
                          <div key={index} className="text-xs space-y-1">
                            {nivel.para_80 && (
                              <div className="flex justify-between items-center text-orange-700">
                                <span>Meta {formatMoney(nivel.meta_usd)} (80%):</span>
                                <span className="font-medium">+{formatMoney(nivel.para_80.faltante)} → {formatMoney(nivel.para_80.bono)}</span>
                              </div>
                            )}
                            {nivel.para_90 && (
                              <div className="flex justify-between items-center text-blue-700">
                                <span>Meta {formatMoney(nivel.meta_usd)} (90%):</span>
                                <span className="font-medium">+{formatMoney(nivel.para_90.faltante)} → {formatMoney(nivel.para_90.bono)}</span>
                              </div>
                            )}
                            {nivel.para_100 && (
                              <div className="flex justify-between items-center text-green-700">
                                <span>Meta {formatMoney(nivel.meta_usd)} (100%):</span>
                                <span className="font-medium">+{formatMoney(nivel.para_100.faltante)} → {formatMoney(nivel.para_100.bono)}</span>
                              </div>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Tabla de Asesores */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Performance por Asesor
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asesor / Nivel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modalidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meta / Logrado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progreso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bono Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alertas / Recomendaciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividad
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {asesores_metas.map((asesor) => (
                <tr key={asesor.asesor_id} className="hover:bg-gray-50">
                  
                  {/* Nombre del Asesor + Nivel */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">
                            {asesor.nombre.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{asesor.nombre}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getNivelAsesorBadge(asesor.meta_usd).color}`}>
                            {getNivelAsesorBadge(asesor.meta_usd).text}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {asesor.ventas_cantidad} ventas
                          {asesor.nivel_asesor && (
                            <span className="ml-2">• {asesor.nivel_asesor.descripcion}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Modalidad */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      asesor.modalidad === 'ventas_actividad' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {asesor.modalidad === 'ventas_actividad' ? 'Ventas + Actividad' : 'Solo Ventas'}
                    </span>
                  </td>

                  {/* Meta / Logrado */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{formatMoney(asesor.meta_usd)}</div>
                      <div className="text-gray-500">{formatMoney(asesor.valor_logrado_usd)} logrado</div>
                    </div>
                  </td>

                  {/* Progreso */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getProgresoColor(asesor.porcentaje_cumplimiento)}`}>
                        {getTrendIcon(asesor.porcentaje_cumplimiento)}
                        {Math.round(asesor.porcentaje_cumplimiento)}%
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          asesor.porcentaje_cumplimiento >= 100 ? 'bg-green-600' :
                          asesor.porcentaje_cumplimiento >= 80 ? 'bg-blue-600' :
                          asesor.porcentaje_cumplimiento >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.min(asesor.porcentaje_cumplimiento, 100)}%` }}
                      ></div>
                    </div>
                  </td>

                  {/* Bono Actual */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-bold text-green-600">{formatMoney(asesor.bono_actual)}</div>
                      <div className="text-xs text-gray-500">{asesor.nivel_bono}</div>
                    </div>
                  </td>

                  {/* Alertas / Recomendaciones */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {/* Alertas Críticas */}
                      {asesor.alertas_inteligentes && asesor.alertas_inteligentes
                        .filter(alerta => alerta.tipo === 'critica')
                        .slice(0, 1)
                        .map((alerta, index) => (
                          <div key={index} className="flex items-center gap-1 text-xs text-red-600">
                            <AlertOctagon className="h-3 w-3" />
                            <span className="truncate">{alerta.mensaje}</span>
                          </div>
                        ))
                      }

                      {/* Oportunidades */}
                      {asesor.alertas_inteligentes && asesor.alertas_inteligentes
                        .filter(alerta => alerta.tipo === 'oportunidad')
                        .slice(0, 1)
                        .map((alerta, index) => (
                          <div key={index} className="flex items-center gap-1 text-xs text-green-600">
                            <Lightbulb className="h-3 w-3" />
                            <span className="truncate">{alerta.mensaje}</span>
                          </div>
                        ))
                      }

                      {/* Recomendaciones */}
                      {asesor.recomendaciones && asesor.recomendaciones.slice(0, 1).map((recom, index) => (
                        <div key={index} className="flex items-center gap-1 text-xs text-blue-600">
                          <Star className="h-3 w-3" />
                          <span className="truncate">{recom}</span>
                        </div>
                      ))}

                      {/* Si no hay alertas, mostrar estado */}
                      {(!asesor.alertas_inteligentes || asesor.alertas_inteligentes.length === 0) &&
                       (!asesor.recomendaciones || asesor.recomendaciones.length === 0) && (
                        <span className="text-xs text-gray-400 italic">Sin alertas</span>
                      )}
                    </div>
                  </td>

                  {/* Actividad */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {asesor.modalidad === 'ventas_actividad' && asesor.actividad ? (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                          <span>{asesor.actividad.total_mensajes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-green-500" />
                          <span>{asesor.actividad.total_llamadas}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-purple-500" />
                          <span>{asesor.actividad.dias_activos}d</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen de Modalidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Solo Ventas */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            Solo Ventas
          </h4>
          <div className="space-y-2">
            {asesores_metas.filter(a => a.modalidad === 'solo_ventas').map(asesor => (
              <div key={asesor.asesor_id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-700">{asesor.nombre}</span>
                <span className="text-sm font-medium text-green-600">{formatMoney(asesor.bono_actual)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ventas + Actividad */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Ventas + Actividad
          </h4>
          <div className="space-y-2">
            {asesores_metas.filter(a => a.modalidad === 'ventas_actividad').map(asesor => (
              <div key={asesor.asesor_id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-700">{asesor.nombre}</span>
                <div className="text-right">
                  <div className="text-sm font-medium text-green-600">{formatMoney(asesor.bono_actual)}</div>
                  {asesor.actividad && (
                    <div className="text-xs text-gray-500">
                      {asesor.actividad.conversion_mensajes.toFixed(1)}% msg | {asesor.actividad.conversion_llamadas.toFixed(1)}% calls
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal de Configuración de Metas */}
      {mostrarConfiguracion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Configuración de Metas de Ventas
              </h3>
              <button
                onClick={() => setMostrarConfiguracion(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6">
              {/* Botones de Acción Rápida */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => crearMetasAutomaticas('mes_actual', false)}
                  disabled={loadingConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md transition-colors font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Crear Metas Automáticas (Mes Actual)
                </button>

                <button
                  onClick={() => crearMetasAutomaticas('mes_siguiente', false)}
                  disabled={loadingConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Crear Metas Mes Siguiente
                </button>

                <button
                  onClick={() => crearMetasAutomaticas('mes_actual', true)}
                  disabled={loadingConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-md transition-colors font-medium"
                >
                  <Settings className="h-4 w-4" />
                  Recrear Todas (Forzar)
                </button>
              </div>

              {/* Tabla de Asesores */}
              {asesoresConfigurables.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Asesor</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Experiencia</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Meta Actual</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Ventas/Valor</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Performance</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Modalidad</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asesoresConfigurables.map((asesor) => (
                        <AsesorConfigurableRow
                          key={asesor.asesor_id}
                          asesor={asesor}
                          onConfigurarMeta={configurarMetaManual}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Cargando asesores...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Componente para cada fila de asesor configurable
const AsesorConfigurableRow = ({ asesor, onConfigurarMeta }) => {
  const [editando, setEditando] = useState(false);
  const [metaValor, setMetaValor] = useState(asesor.meta_valor || '');
  const [metaCantidad, setMetaCantidad] = useState(asesor.meta_cantidad || '');

  const mesesExperiencia = Math.floor(asesor.meses_experiencia || 0);
  const esNuevo = mesesExperiencia < 3;

  const handleGuardar = async () => {
    if (!metaValor || !metaCantidad) {
      alert('Por favor completa ambos campos');
      return;
    }

    await onConfigurarMeta(
      asesor.asesor_id,
      parseFloat(metaValor),
      parseInt(metaCantidad),
      `Configuración manual - ${new Date().toLocaleString()}`
    );
    setEditando(false);
  };

  const sugerirMetaAutomatica = () => {
    if (esNuevo) {
      setMetaValor('2500');
      setMetaCantidad('3');
    } else {
      setMetaValor('8000');
      setMetaCantidad('10');
    }
  };

  return (
    <tr className={esNuevo ? 'bg-blue-50' : 'bg-white'}>
      <td className="border border-gray-300 px-4 py-2">
        <div>
          <div className="font-medium">{asesor.nombre} {asesor.apellido}</div>
          {esNuevo && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Nuevo
            </span>
          )}
        </div>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <span className={`text-sm ${esNuevo ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
          {mesesExperiencia} meses
        </span>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        {editando ? (
          <div className="flex gap-2">
            <input
              type="number"
              value={metaValor}
              onChange={(e) => setMetaValor(e.target.value)}
              placeholder="Meta $"
              className="w-20 px-2 py-1 border rounded text-sm"
            />
            <input
              type="number"
              value={metaCantidad}
              onChange={(e) => setMetaCantidad(e.target.value)}
              placeholder="Cant."
              className="w-16 px-2 py-1 border rounded text-sm"
            />
          </div>
        ) : asesor.meta_valor ? (
          <div>
            <div className="font-medium">${parseFloat(asesor.meta_valor).toLocaleString('en-US')}</div>
            <div className="text-xs text-gray-500">{asesor.meta_cantidad} ventas</div>
          </div>
        ) : (
          <span className="text-red-500 text-sm">Sin meta</span>
        )}
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <div>
          <div className="text-sm">{asesor.ventas_realizadas || 0} ventas</div>
          <div className="text-xs text-gray-500">
            ${parseFloat(asesor.valor_realizado || 0).toLocaleString('en-US')}
          </div>
        </div>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <span className={`text-sm font-medium ${
          asesor.porcentaje_cumplimiento >= 100 ? 'text-green-600' :
          asesor.porcentaje_cumplimiento >= 80 ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {parseFloat(asesor.porcentaje_cumplimiento || 0).toFixed(1)}%
        </span>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <span className={`text-xs px-2 py-1 rounded ${
          asesor.modalidad_bono === 'ventas_actividad'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {asesor.modalidad_bono === 'ventas_actividad' ? 'V + A' : 'Solo V'}
        </span>
      </td>
      <td className="border border-gray-300 px-4 py-2 text-center">
        {editando ? (
          <div className="flex gap-1 justify-center">
            <button
              onClick={sugerirMetaAutomatica}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
              title={`Meta sugerida: ${esNuevo ? '$2,500 (3v)' : '$8,000 (10v)'}`}
            >
              Auto
            </button>
            <button
              onClick={handleGuardar}
              className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
            >
              ✓
            </button>
            <button
              onClick={() => setEditando(false)}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditando(true)}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
          >
            Editar
          </button>
        )}
      </td>
    </tr>
  );
};

export default MetasAvanzado;