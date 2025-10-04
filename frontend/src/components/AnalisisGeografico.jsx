import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Map, MapPin, Globe, TrendingUp, Users, DollarSign,
  Download, Calendar, RefreshCw, AlertCircle, BarChart3,
  Building2, Navigation, Target, Award
} from 'lucide-react';
import ventasService from '../services/ventasService';
import { formatearMoneda, formatearMonedaCompacta } from '../utils/currency';
import MapaPeruMapbox from './MapaPeruMapbox';
import PeriodSelectorAdvanced from './ventas/PeriodSelector/PeriodSelectorAdvanced';

const AnalisisGeografico = ({ usuarioActual }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await ventasService.obtenerDashboardGeografico(periodo);

      if (response.success) {
        setDatos(response.data);
      } else {
        throw new Error(response.error || 'Error cargando datos geográficos');
      }
    } catch (err) {
      const errorMessage = err.message || 'Error de conexión';
      setError(errorMessage);
      console.error('Error cargando análisis geográfico:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const textoSegunPeriodo = useMemo(() => {
    switch(periodo) {
      case 'hoy': return 'Hoy';
      case 'semana_actual': return 'Semana Actual';
      case 'trimestre_actual': return 'Trimestre Actual';
      default: return 'Este Mes';
    }
  }, [periodo]);

  // Memoizar datos básicos (ANTES de cualquier return condicional)
  const departamentos = useMemo(() => datos?.departamentos || [], [datos]);
  const ciudades = useMemo(() => datos?.ciudades || [], [datos]);
  const cobertura = useMemo(() => datos?.cobertura_asesores || [], [datos]);

  // Memoizar cálculos costosos
  const estadisticasCalculadas = useMemo(() => {
    const totalVentas = departamentos.reduce((sum, d) => sum + parseInt(d.total_ventas || 0), 0);
    const ingresosTotales = departamentos.reduce((sum, d) => sum + parseFloat(d.ingresos_totales || 0), 0);
    const ciudadesTotales = departamentos.reduce((sum, d) => sum + parseInt(d.ciudades || 0), 0);

    return {
      totalVentas,
      ingresosTotales,
      ciudadesTotales
    };
  }, [departamentos]);

  // Función para generar alertas inteligentes dinámicas (memoizada)
  const alertas = useMemo(() => {
    const alertas = [];

    // Alerta: Pocos departamentos con actividad comercial
    if (departamentos.length < 5 && departamentos.length > 0) {
      alertas.push({
        tipo: 'warning',
        icono: 'AlertCircle',
        titulo: 'Oportunidades de Expansión',
        mensaje: `Solo ${departamentos.length} departamentos con actividad comercial`,
        detalle: 'Potencial para crecimiento territorial',
        accion: 'Evaluar estrategia de penetración'
      });
    }

    // Alerta: Concentración de ventas
    const { ingresosTotales } = estadisticasCalculadas;
    const top3Ingresos = departamentos
      .sort((a, b) => parseFloat(b.ingresos_totales) - parseFloat(a.ingresos_totales))
      .slice(0, 3)
      .reduce((sum, d) => sum + parseFloat(d.ingresos_totales || 0), 0);

    const concentracion = ingresosTotales > 0 ? (top3Ingresos / ingresosTotales) * 100 : 0;

    if (concentracion > 70) {
      alertas.push({
        tipo: 'danger',
        icono: 'TrendingUp',
        titulo: 'Alta Concentración de Riesgo',
        mensaje: `${concentracion.toFixed(1)}% de ingresos en 3 departamentos`,
        detalle: 'Riesgo de dependencia territorial',
        accion: 'Diversificar mercados'
      });
    }

    // Alerta: Asesores con baja cobertura
    const asesoresBajaCobertura = cobertura.filter(a =>
      parseInt(a.departamentos_cubiertos) <= 1 && parseInt(a.ventas_totales) < 5
    );

    if (asesoresBajaCobertura.length > 0) {
      alertas.push({
        tipo: 'info',
        icono: 'Users',
        titulo: 'Optimización de Territorio',
        mensaje: `${asesoresBajaCobertura.length} asesores con cobertura limitada`,
        detalle: 'Potencial para expansión territorial',
        accion: 'Revisar asignación de zonas'
      });
    }

    // Alerta: Ciudades top con bajo número de asesores (dinámico)
    if (ciudades.length > 0 && ingresosTotales > 0) {
      const ciudadesDesatendidas = ciudades
        .filter(c => parseFloat(c.ingresos_totales) > ingresosTotales * 0.1 && parseInt(c.asesores_activos) <= 1)
        .slice(0, 2);

      if (ciudadesDesatendidas.length > 0) {
        alertas.push({
          tipo: 'success',
          icono: 'Target',
          titulo: 'Oportunidad de Crecimiento',
          mensaje: `${ciudadesDesatendidas.length} ciudades importantes con pocos asesores`,
          detalle: ciudadesDesatendidas.map(c => c.ciudad).join(', '),
          accion: 'Reforzar equipo comercial'
        });
      }
    }

    // Nueva alerta: Ciudades con alto potencial pero sin diversidad de asesores
    if (ciudades.length >= 3) {
      const ciudadesConUnSoloAsesor = ciudades
        .filter(c => parseInt(c.asesores_activos) === 1 && parseFloat(c.ingresos_totales) > 0)
        .length;

      const porcentajeMonoasesor = (ciudadesConUnSoloAsesor / ciudades.length) * 100;

      if (porcentajeMonoasesor > 60) {
        alertas.push({
          tipo: 'info',
          icono: 'Users',
          titulo: 'Concentración de Riesgo por Asesor',
          mensaje: `${porcentajeMonoasesor.toFixed(0)}% de ciudades dependen de un solo asesor`,
          detalle: `${ciudadesConUnSoloAsesor} de ${ciudades.length} ciudades`,
          accion: 'Diversificar cobertura territorial'
        });
      }
    }

    return alertas.slice(0, 4); // Máximo 4 alertas
  }, [departamentos, ciudades, cobertura, estadisticasCalculadas]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Error: {error}</span>
          <button
            onClick={cargarDatos}
            className="ml-4 text-red-600 hover:text-red-800 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Análisis Geográfico</h1>
            <p className="text-green-100 mt-1">
              Distribución territorial de ventas
            </p>
            {datos?.fechas && (
              <p className="text-sm text-green-200 mt-1">
                Período: {datos.fechas.fechaInicio} al {datos.fechas.fechaFin}
              </p>
            )}
          </div>

          <button
            onClick={cargarDatos}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Selector de Período */}
      <PeriodSelectorAdvanced
        isExecutive={true}
        onPeriodChange={setPeriodo}
        initialPeriod={periodo}
        loading={loading}
      />

      {/* Alertas Inteligentes */}
      {alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-orange-600" />
            Alertas Territoriales Inteligentes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alertas.map((alerta, index) => {
              const iconoColor = {
                danger: 'text-red-600 bg-red-100',
                warning: 'text-yellow-600 bg-yellow-100',
                info: 'text-blue-600 bg-blue-100',
                success: 'text-green-600 bg-green-100'
              }[alerta.tipo];

              const borderColor = {
                danger: 'border-red-200',
                warning: 'border-yellow-200',
                info: 'border-blue-200',
                success: 'border-green-200'
              }[alerta.tipo];

              return (
                <div key={index} className={`border rounded-lg p-4 ${borderColor}`}>
                  <div className="flex items-start">
                    <div className={`p-2 rounded-lg ${iconoColor} mr-3 mt-1`}>
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{alerta.titulo}</h4>
                      <p className="text-sm text-gray-700 mt-1">{alerta.mensaje}</p>
                      {alerta.detalle && (
                        <p className="text-xs text-gray-600 mt-1">{alerta.detalle}</p>
                      )}
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          💡 {alerta.accion}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Métricas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Map className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Departamentos</p>
              <p className="text-2xl font-bold text-gray-900">{departamentos.length}</p>
              <p className="text-xs text-blue-600">Con ventas activas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ciudades Cubiertas</p>
              <p className="text-2xl font-bold text-gray-900">{ciudades.length}</p>
              <p className="text-xs text-green-600">Mercados activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Asesores Activos</p>
              <p className="text-2xl font-bold text-gray-900">{cobertura.length}</p>
              <p className="text-xs text-purple-600">En territorio</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Target className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cobertura Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {estadisticasCalculadas.totalVentas}
              </p>
              <p className="text-xs text-orange-600">Ventas geográficas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa Geográfico Real del Perú */}
      <MapaPeruMapbox departamentos={departamentos} />

      {/* Análisis por Departamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Map className="h-5 w-5 mr-2 text-blue-600" />
              TOP Departamentos por Ventas
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {departamentos.slice(0, 8).map((dept, index) => (
                <div key={dept.departamento} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index < 3 ? 'bg-green-500' : 'bg-gray-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{dept.departamento}</p>
                      <p className="text-sm text-gray-600">
                        {dept.ciudades} ciudades • {dept.asesores_activos} asesores
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{dept.total_ventas} ventas</p>
                    <p className="text-sm text-green-600">{formatearMoneda(dept.ingresos_totales)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-purple-600" />
              TOP Ciudades por Ingresos
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {ciudades.slice(0, 8).map((ciudad, index) => (
                <div key={ciudad.ciudad} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index < 3 ? 'bg-purple-500' : 'bg-gray-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{ciudad.ciudad}</p>
                      <p className="text-sm text-gray-600">{ciudad.departamento}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatearMoneda(ciudad.ingresos_totales)}</p>
                    <p className="text-sm text-gray-600">{ciudad.total_ventas} ventas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cobertura por Asesores */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2 text-orange-600" />
            Cobertura Territorial por Asesor
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cobertura.map((asesor) => (
              <div key={asesor.asesor_id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    {asesor.nombre_asesor || `Asesor #${asesor.asesor_id}`}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {asesor.departamentos_cubiertos} departamentos
                  </p>
                  <p className="text-sm text-gray-600">
                    {asesor.ciudades_cubiertas} ciudades
                  </p>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-lg font-bold text-green-600">{asesor.ventas_totales}</p>
                    <p className="text-xs text-gray-500">ventas totales</p>
                    <p className="text-sm font-medium text-gray-700 mt-1">
                      {formatearMoneda(asesor.ingresos_totales)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalisisGeografico;