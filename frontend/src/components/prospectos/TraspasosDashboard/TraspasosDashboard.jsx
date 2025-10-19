// src/components/prospectos/TraspasosDashboard/TraspasosDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, AlertCircle, CheckCircle, TrendingUp, TrendingDown,
  Users, DollarSign, AlertTriangle, Zap, Clock, ArrowRight,
  Search, Filter, Eye, BarChart3, Target, User, Building2, Phone, Mail
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import PeriodSelectorAdvanced from '../../ventas/PeriodSelector/PeriodSelectorAdvanced';
import ProspectoDetailsView from '../ProspectoDetailsView';
import { API_CONFIG } from '../../../config/apiConfig';

const TraspasosDashboard = ({ usuarioActual, refreshTrigger = 0 }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Filtros
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [filtros, setFiltros] = useState({
    asesor_origen: 'todos',
    asesor_actual: 'todos',
    min_rebotes: '0',
    busqueda: ''
  });

  // Lista de asesores para los selectores
  const [asesores, setAsesores] = useState([]);

  // Estado para prospecto seleccionado (modal detalles)
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Cargar asesores para los filtros
  useEffect(() => {
    const cargarAsesores = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/usuarios/vendedores`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const result = await response.json();
        if (result.success) {
          setAsesores(result.data || []);
        }
      } catch (err) {
        console.error('Error cargando asesores:', err);
      }
    };
    cargarAsesores();
  }, []);

  // Cargar datos del dashboard
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filtrosCompletos = {
        periodo: periodoSeleccionado,
        asesor_origen: filtros.asesor_origen !== 'todos' ? filtros.asesor_origen : null,
        asesor_actual: filtros.asesor_actual !== 'todos' ? filtros.asesor_actual : null,
        min_rebotes: filtros.min_rebotes !== '0' ? filtros.min_rebotes : null,
        busqueda: filtros.busqueda || null,
        limit: 100
      };

      const response = await prospectosService.obtenerTraspasosConsolidado(filtrosCompletos);

      if (response.success) {
        setDatos(response.data);
        showNotification('Dashboard actualizado correctamente', 'success');
      } else {
        throw new Error(response.error || 'Error al cargar datos');
      }
    } catch (err) {
      console.error('Error cargando dashboard de traspasos:', err);
      setError(err.message);
      showNotification('Error al cargar datos del dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [periodoSeleccionado, filtros, showNotification]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, refreshTrigger]);

  // Formatear dinero
  const formatearDinero = (valor) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(valor || 0);
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-md`}>
        <div className="flex items-start">
          <IconComponent className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  // KPI Card Component
  const KPICard = ({ titulo, valor, icono: IconComponent, color, descripcion, accion }) => (
    <div className={`bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-all`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className={`p-1.5 rounded-lg ${color.bg}`}>
          <IconComponent className={`h-4 w-4 ${color.text}`} />
        </div>
        {accion && (
          <button className="text-xs text-blue-600 hover:text-blue-800">
            {accion}
          </button>
        )}
      </div>
      <div className="text-xl font-bold text-gray-900">{valor}</div>
      <div className="text-xs font-medium text-gray-600">{titulo}</div>
      {descripcion && <div className="text-xs text-gray-500 mt-0.5">{descripcion}</div>}
    </div>
  );

  // Timeline Horizontal Component
  const TimelineHorizontal = ({ historial, modoLibre, asesorActual }) => {
    if (!historial || historial.length === 0) {
      return <div className="text-sm text-gray-500 italic">Sin historial</div>;
    }

    return (
      <div className="flex items-center space-x-2 overflow-x-auto py-2">
        {historial.map((evento, idx) => (
          <React.Fragment key={evento.id}>
            {/* Nodo de asesor que perdió */}
            {evento.asesor_perdio_nombre && (
              <>
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-semibold text-red-700">
                    {evento.asesor_perdio_nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 text-center truncate w-full">
                    {evento.asesor_perdio_nombre}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatearFecha(evento.fecha)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </>
            )}

            {/* Nodo de asesor que ganó */}
            {evento.asesor_gano_nombre && idx === historial.length - 1 && (
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700">
                  {evento.asesor_gano_nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="text-xs text-gray-600 mt-1 text-center truncate w-full">
                  {evento.asesor_gano_nombre}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Nodo ACTUAL */}
        {modoLibre ? (
          <>
            <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <div className="flex flex-col items-center min-w-[80px]">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Zap className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-xs font-bold text-purple-600 mt-1">MODO LIBRE</div>
            </div>
          </>
        ) : asesorActual && (
          <>
            <ArrowRight className="h-4 w-4 text-green-400 flex-shrink-0" />
            <div className="flex flex-col items-center min-w-[80px]">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                {asesorActual.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="text-xs text-gray-600 mt-1 text-center truncate w-full">
                {asesorActual}
              </div>
              <div className="text-xs font-semibold text-green-600">✓ Activo</div>
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading && !datos) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard de traspasos...</p>
        </div>
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Error al cargar</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={cargarDatos}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const kpis = datos?.kpis || {};
  const prospectos = datos?.prospectos || [];
  const distribucionMotivo = kpis.distribucion_motivo || {};
  const balanceAsesores = kpis.balance_asesores || [];

  return (
    <div className="space-y-6">
      <NotificationComponent />

      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center">
              <BarChart3 className="h-7 w-7 mr-3" />
              Historial de Traspasos
            </h2>
            <p className="text-blue-100">
              Trazabilidad completa de prospectos reasignados
            </p>
          </div>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          titulo="Prospectos Traspasados"
          valor={kpis.total_prospectos_traspasados || 0}
          icono={Users}
          color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}
          descripcion={`En el período seleccionado`}
        />
        <KPICard
          titulo="En Modo Libre"
          valor={kpis.en_modo_libre || 0}
          icono={Zap}
          color={{ bg: 'bg-purple-100', text: 'text-purple-600' }}
          descripcion={formatearDinero(kpis.valor_modo_libre)}
          accion={kpis.en_modo_libre > 0 ? 'Ver todos →' : null}
        />
        <KPICard
          titulo="Valor en Riesgo"
          valor={formatearDinero(kpis.valor_total_riesgo)}
          icono={AlertTriangle}
          color={{ bg: 'bg-orange-100', text: 'text-orange-600' }}
          descripcion={`${kpis.prospectos_riesgo || 0} prospectos con 2+ rebotes`}
        />
        <KPICard
          titulo="Balance Asesores"
          valor={
            <div className="text-xs space-y-0.5 mt-1">
              {balanceAsesores.slice(0, 3).map(a => (
                <div key={a.asesor_id} className="flex items-center justify-between">
                  <span className="truncate flex-1 text-xs">{a.asesor_nombre.split(' ')[0]}</span>
                  <span className={`font-bold text-xs ${a.neto < 0 ? 'text-red-600' : a.neto > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    {a.perdidos}↓ {a.ganados}↑
                  </span>
                </div>
              ))}
            </div>
          }
          icono={Target}
          color={{ bg: 'bg-green-100', text: 'text-green-600' }}
        />
      </div>

      {/* Distribución por motivo */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribución por Motivo</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Seguimientos Vencidos</span>
                <span className="font-semibold">{distribucionMotivo.vencidos || 0}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${((distribucionMotivo.vencidos || 0) / (kpis.total_prospectos_traspasados || 1)) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Modo Libre Activado</span>
                <span className="font-semibold">{distribucionMotivo.modo_libre || 0}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{
                    width: `${((distribucionMotivo.modo_libre || 0) / (kpis.total_prospectos_traspasados || 1)) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Período Selector */}
        <div className="lg:col-span-1">
          <PeriodSelectorAdvanced
            onPeriodChange={setPeriodoSeleccionado}
            initialPeriod={periodoSeleccionado}
            loading={loading}
            isExecutive={true}
          />
        </div>

        {/* Filtros adicionales */}
        <div className="lg:col-span-2 bg-white rounded-lg border p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Filtros Adicionales</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Asesor Origen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asesor Origen</label>
              <select
                value={filtros.asesor_origen}
                onChange={(e) => setFiltros({ ...filtros, asesor_origen: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="todos">Todos</option>
                {asesores.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                ))}
              </select>
            </div>

            {/* Asesor Actual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asesor Actual</label>
              <select
                value={filtros.asesor_actual}
                onChange={(e) => setFiltros({ ...filtros, asesor_actual: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="modo_libre">En Modo Libre</option>
                {asesores.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                ))}
              </select>
            </div>

            {/* Rebotes mínimos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rebotes</label>
              <select
                value={filtros.min_rebotes}
                onChange={(e) => setFiltros({ ...filtros, min_rebotes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="0">Todos</option>
                <option value="1">1+ rebote</option>
                <option value="2">2+ rebotes</option>
                <option value="3">3+ rebotes</option>
              </select>
            </div>

            {/* Búsqueda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Código/cliente..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          {prospectos.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Prospecto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rebotes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Trazabilidad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {prospectos.map((prospecto, idx) => (
                  <tr key={prospecto.prospecto_id} className={`hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                    {/* Prospecto */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-blue-600">{prospecto.codigo}</div>
                      <div className="text-sm font-medium text-gray-900">{prospecto.nombre_cliente}</div>
                      {prospecto.empresa && (
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <Building2 className="h-3 w-3 mr-1" />
                          {prospecto.empresa}
                        </div>
                      )}
                    </td>

                    {/* Valor */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-green-600">
                        {formatearDinero(prospecto.valor_estimado)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Prob: {prospecto.probabilidad_cierre}%
                      </div>
                    </td>

                    {/* Rebotes */}
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        prospecto.rebotes >= 2
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {prospecto.rebotes} {prospecto.rebotes >= 2 && '🔥'}
                      </div>
                      {prospecto.dias_en_transito > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {prospecto.dias_en_transito}d en tránsito
                        </div>
                      )}
                    </td>

                    {/* Trazabilidad */}
                    <td className="px-4 py-3">
                      <TimelineHorizontal
                        historial={prospecto.historial_traspasos}
                        modoLibre={prospecto.modo_libre}
                        asesorActual={prospecto.asesor_actual}
                      />
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      {prospecto.modo_libre ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                          <Zap className="h-3 w-3 mr-1" />
                          MODO LIBRE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Con {prospecto.asesor_actual}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          try {
                            const response = await prospectosService.obtenerPorId(prospecto.prospecto_id);
                            if (response.success && response.data) {
                              setProspectoSeleccionado(response.data);
                              setMostrarDetalles(true);
                            }
                          } catch (err) {
                            console.error('Error cargando prospecto:', err);
                            showNotification('Error al cargar detalles del prospecto', 'error');
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay traspasos</h3>
              <p className="text-gray-500">
                No se encontraron prospectos con traspasos en el período seleccionado
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Total de registros */}
      {prospectos.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Mostrando {prospectos.length} prospecto{prospectos.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Modal de detalles del prospecto */}
      {mostrarDetalles && prospectoSeleccionado && (
        <ProspectoDetailsView
          prospecto={prospectoSeleccionado}
          onClose={() => {
            setMostrarDetalles(false);
            setProspectoSeleccionado(null);
          }}
          onEdit={() => {
            setMostrarDetalles(false);
            setProspectoSeleccionado(null);
            // Aquí podrías abrir el formulario de edición si lo necesitas
          }}
          currentUser={usuarioActual}
        />
      )}
    </div>
  );
};

export default TraspasosDashboard;
