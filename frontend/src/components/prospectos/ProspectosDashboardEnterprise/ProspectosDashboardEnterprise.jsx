// src/components/prospectos/ProspectosDashboardEnterprise/ProspectosDashboardEnterprise.jsx
import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Clock, Bell, Settings,
  RefreshCw, Filter, Grid, List, Eye, Calendar, Target,
  Zap, Activity, Award, ChevronDown, ChevronUp
} from 'lucide-react';

// Importar todos los componentes enterprise
import MetricasEnterprise from '../MetricasEnterprise/MetricasEnterprise';
import AnalisisCanales from '../AnalisisCanales/AnalisisCanales';
import SeguimientosDashboardEnterprise from '../SeguimientosDashboard/SeguimientosDashboardEnterprise';
import AlertasEnterprise from '../AlertasEnterprise/AlertasEnterprise';
import KanbanBoard from '../KanbanBoard/KanbanBoard';

const ProspectosDashboardEnterprise = ({ asesorId = null }) => {
  const [vistaActiva, setVistaActiva] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [configuracion, setConfiguracion] = useState({
    mostrarAlertas: true,
    actualizacionAutomatica: false,
    vistaCompacta: false
  });

  // Estados para personalización
  const [layoutPersonalizado, setLayoutPersonalizado] = useState({
    metricas: { visible: true, orden: 1 },
    seguimientos: { visible: true, orden: 2 },
    canales: { visible: true, orden: 3 },
    kanban: { visible: true, orden: 4 },
    alertas: { visible: true, orden: 5 }
  });

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 5 * 60 * 1000); // 5 minutos
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const vistas = [
    {
      key: 'overview',
      label: 'Vista General',
      icon: Grid,
      descripcion: 'Dashboard completo con todas las métricas'
    },
    {
      key: 'metricas',
      label: 'Métricas',
      icon: BarChart3,
      descripcion: 'Análisis detallado de rendimiento'
    },
    {
      key: 'seguimientos',
      label: 'Seguimientos',
      icon: Clock,
      descripcion: 'Gestión de seguimientos y alertas'
    },
    {
      key: 'canales',
      label: 'Canales',
      icon: Target,
      descripcion: 'Análisis por canal de contacto'
    },
    {
      key: 'kanban',
      label: 'Pipeline',
      icon: List,
      descripcion: 'Vista Kanban del pipeline'
    }
  ];

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const forzarActualizacion = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderContenidoPorVista = () => {
    switch (vistaActiva) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Alertas Críticas */}
            {configuracion.mostrarAlertas && (
              <AlertasEnterprise asesorId={asesorId} showOnlyActive={true} />
            )}

            {/* Grid Compacto */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Métricas Principales */}
              <div className="lg:col-span-2">
                <MetricasEnterprise asesorId={asesorId} />
              </div>

              {/* Seguimientos Urgentes */}
              <div>
                <SeguimientosDashboardEnterprise
                  asesorId={asesorId}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </div>

            {/* Análisis y Pipeline */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Análisis de Canales */}
              <div>
                <AnalisisCanales asesorId={asesorId} />
              </div>

              {/* Pipeline Kanban */}
              <div className="xl:col-span-2">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <List className="h-5 w-5 text-blue-600 mr-2" />
                    Pipeline
                  </h3>
                  <KanbanBoard
                    asesorId={asesorId}
                    refreshTrigger={refreshTrigger}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'metricas':
        return (
          <div className="space-y-6">
            <MetricasEnterprise asesorId={asesorId} />
            <AnalisisCanales asesorId={asesorId} />
          </div>
        );

      case 'seguimientos':
        return (
          <SeguimientosDashboardEnterprise
            asesorId={asesorId}
            refreshTrigger={refreshTrigger}
          />
        );

      case 'canales':
        return <AnalisisCanales asesorId={asesorId} />;

      case 'kanban':
        return (
          <KanbanBoard
            asesorId={asesorId}
            refreshTrigger={refreshTrigger}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-50">
      {/* Header Compacto */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            {/* Título Simple */}
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>

              {/* Indicador Live */}
              {autoRefresh && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-700 font-medium">Live</span>
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="flex items-center space-x-3">
              {/* Selector de Vista */}
              <select
                value={vistaActiva}
                onChange={(e) => setVistaActiva(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {vistas.map(vista => (
                  <option key={vista.key} value={vista.key}>
                    {vista.label}
                  </option>
                ))}
              </select>

              {/* Auto Refresh Toggle */}
              <button
                onClick={toggleAutoRefresh}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  autoRefresh
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>{autoRefresh ? 'Auto ✓' : 'Manual'}</span>
              </button>

              {/* Refresh Manual */}
              <button
                onClick={forzarActualizacion}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Actualizar</span>
              </button>

              {/* Configuración */}
              <button
                onClick={() => setConfiguracion(prev => ({
                  ...prev,
                  mostrarAlertas: !prev.mostrarAlertas
                }))}
                className={`p-2 rounded-md transition-colors ${
                  configuracion.mostrarAlertas
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle Alertas"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navegación de Tabs (Solo en vista Overview) */}
        {vistaActiva === 'overview' && (
          <div className="border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="flex space-x-8 overflow-x-auto py-2">
                {vistas.filter(v => v.key !== 'overview').map(vista => {
                  const IconComponent = vista.icon;
                  return (
                    <button
                      key={vista.key}
                      onClick={() => setVistaActiva(vista.key)}
                      className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap"
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{vista.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb de Vista Actual */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Dashboard Enterprise</span>
            <ChevronUp className="h-4 w-4 rotate-90" />
            <span className="font-medium text-gray-900">
              {vistas.find(v => v.key === vistaActiva)?.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {vistas.find(v => v.key === vistaActiva)?.descripcion}
          </p>
        </div>

        {/* Contenido Dinámico */}
        {renderContenidoPorVista()}
      </div>

      {/* Footer con Información del Sistema */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>🚀 Sistema Enterprise v2.0</span>
              <span>⚡ Redis Cache Activo</span>
              <span>🛡️ PostgreSQL Optimizado</span>
            </div>

            <div className="flex items-center space-x-4">
              <span>Última actualización: {new Date().toLocaleTimeString('es-PE')}</span>
              {autoRefresh && (
                <span className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Actualizando cada 5 min</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ProspectosDashboardEnterprise;