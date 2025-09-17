import React, { useState, useEffect } from 'react';
import { 
  Map, MapPin, Globe, TrendingUp, Users, DollarSign, 
  Download, Calendar, RefreshCw, AlertCircle, BarChart3,
  Building2, Navigation, Target, Award
} from 'lucide-react';
import ventasService from '../services/ventasService';

const AnalisisGeografico = ({ usuarioActual }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await ventasService.obtenerDashboardGeografico(periodo);
      
      if (response.success) {
        setDatos(response.data);
        setError(null);
      } else {
        setError(response.error || 'Error cargando datos geográficos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error cargando análisis geográfico:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    if (!valor || valor === 0) return 'S/ 0.00';
    return `S/ ${parseFloat(valor).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  };

  const obtenerTextoSegunPeriodo = () => {
    switch(periodo) {
      case 'hoy': return 'Hoy';
      case 'semana_actual': return 'Semana Actual';
      case 'trimestre_actual': return 'Trimestre Actual';
      default: return 'Este Mes';
    }
  };

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

  const departamentos = datos?.departamentos || [];
  const ciudades = datos?.ciudades || [];
  const cobertura = datos?.cobertura_asesores || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Análisis Geográfico</h1>
            <p className="text-green-100 mt-1">
              Distribución territorial de ventas - {obtenerTextoSegunPeriodo()}
            </p>
            <p className="text-sm text-green-200 mt-1">
              Período: {datos?.fechas?.fechaInicio} al {datos?.fechas?.fechaFin}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20"
            >
              <option value="mes_actual">Este mes</option>
              <option value="semana_actual">Esta semana</option>
              <option value="hoy">Hoy</option>
              <option value="trimestre_actual">Trimestre</option>
            </select>
            
            <button
              onClick={cargarDatos}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>
      </div>

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
                {departamentos.reduce((sum, d) => sum + (parseInt(d.total_ventas) || 0), 0)}
              </p>
              <p className="text-xs text-orange-600">Ventas geográficas</p>
            </div>
          </div>
        </div>
      </div>

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
                  <h4 className="font-semibold text-gray-900">Asesor #{asesor.asesor_id}</h4>
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