// ============================================
// SELECTOR DE PERÍODOS AVANZADO CON TABS
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Filter, ChevronDown, BarChart, TrendingUp } from 'lucide-react';
import { fetchWithErrorHandling } from '../../../utils/dashboardUtils';
import { API_CONFIG } from '../../../config/apiConfig';

const PeriodSelectorAdvanced = ({
  asesorId,
  onPeriodChange,
  initialPeriod = 'mes_actual',
  loading = false,
  isExecutive = false // Nuevo prop para modo ejecutivo
}) => {
  const [activeTab, setActiveTab] = useState('mes');
  const [selectedPeriod, setSelectedPeriod] = useState('actual');
  const [availablePeriods, setAvailablePeriods] = useState({
    meses: [],
    trimestres: [],
    años: []
  });
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  // Configuración de tabs
  const tabs = [
    { id: 'semana', label: 'Semana', icon: Clock, desc: 'Semana actual' },
    { id: 'mes', label: 'Mes', icon: Calendar, desc: 'Mes seleccionable' },
    { id: 'trimestre', label: 'Trimestre', icon: BarChart, desc: 'Trimestre seleccionable' },
    { id: 'año', label: 'Año', icon: TrendingUp, desc: 'Año seleccionable' }
  ];

  // Determinar tab inicial basado en el período
  useEffect(() => {
    if (initialPeriod.startsWith('mes')) setActiveTab('mes');
    else if (initialPeriod.startsWith('semana')) setActiveTab('semana');
    else if (initialPeriod.startsWith('trimestre')) setActiveTab('trimestre');
    else if (initialPeriod.startsWith('año')) setActiveTab('año');
  }, [initialPeriod]);

  // Cargar períodos disponibles desde el backend
  const cargarPeriodosDisponibles = useCallback(async () => {
    // En modo ejecutivo no requiere asesorId
    if (!isExecutive && !asesorId) return;

    try {
      setLoadingPeriods(true);
      const token = localStorage.getItem('token');

      // Usar endpoint diferente según el modo
      const endpoint = isExecutive
        ? API_CONFIG.ENDPOINTS.DASHBOARD_EJECUTIVO_PERIODOS
        : API_CONFIG.ENDPOINTS.PERIODOS_DISPONIBLES(asesorId);

      console.log(`🔍 Modo: ${isExecutive ? 'EJECUTIVO' : 'PERSONAL'}, Endpoint: ${endpoint}`);

      const response = await fetchWithErrorHandling(
        endpoint,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.success) {
        // El backend retorna { success: true, data: { periodos: {...}, estadisticas: {...} } }
        // Pero apiCall envuelve en { success, data } entonces tenemos response.data.data
        const periodos = response.data?.data?.periodos || response.data?.periodos;
        const estadisticas = response.data?.data?.estadisticas || response.data?.estadisticas;

        console.log('📅 Respuesta completa del backend:', response);
        console.log('📊 Períodos extraídos:', periodos);

        if (periodos) {
          setAvailablePeriods({
            meses: periodos.meses || [],
            trimestres: periodos.trimestres || [],
            años: periodos.años || [],
            resumen: estadisticas
          });
          console.log('✅ Períodos guardados en estado:', {
            meses: periodos.meses?.length || 0,
            trimestres: periodos.trimestres?.length || 0,
            años: periodos.años?.length || 0
          });
        }
      }
    } catch (error) {
      console.error('Error cargando períodos disponibles:', error);
    } finally {
      setLoadingPeriods(false);
    }
  }, [asesorId, isExecutive]);

  useEffect(() => {
    cargarPeriodosDisponibles();
  }, [cargarPeriodosDisponibles, isExecutive]);

  // Construir período completo
  const buildPeriod = useCallback((tab, selection) => {
    switch (tab) {
      case 'semana':
        return 'semana_actual';
      case 'mes':
        return selection === 'actual' ? 'mes_actual' : `mes_${selection}`;
      case 'trimestre':
        return selection === 'actual' ? 'trimestre_actual' : `trimestre_${selection}`;
      case 'año':
        return selection === 'actual' ? 'año_actual' : `año_${selection}`;
      default:
        return 'mes_actual';
    }
  }, []);

  // Manejar cambio de tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);

    if (tabId === 'semana') {
      // Semana siempre es actual
      onPeriodChange('semana_actual');
    } else {
      // Para otros tabs, usar 'actual' por defecto
      setSelectedPeriod('actual');
      onPeriodChange(buildPeriod(tabId, 'actual'));
    }
  };

  // Manejar cambio de período específico
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    onPeriodChange(buildPeriod(activeTab, period));
  };

  // Renderizar opciones del selector
  const renderPeriodOptions = () => {
    if (activeTab === 'semana') {
      return (
        <div className="text-sm text-gray-600 italic">
          Semana actual: Lunes a Viernes
        </div>
      );
    }

    const getOptions = () => {
      switch (activeTab) {
        case 'mes':
          console.log('🗓️ Obteniendo meses para dropdown:', availablePeriods.meses);
          return availablePeriods.meses || [];
        case 'trimestre':
          console.log('📅 Obteniendo trimestres para dropdown:', availablePeriods.trimestres);
          return availablePeriods.trimestres || [];
        case 'año':
          console.log('🗓️ Obteniendo años para dropdown:', availablePeriods.años);
          return availablePeriods.años || [];
        default:
          return [];
      }
    };

    const options = getOptions();
    console.log(`🎯 Opciones finales para tab '${activeTab}':`, options);

    if (loadingPeriods) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Cargando opciones...</span>
        </div>
      );
    }

    if (options.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No hay datos disponibles para este período
        </div>
      );
    }

    return (
      <div className="relative">
        <select
          value={selectedPeriod}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white pr-8"
          disabled={loading}
        >
          <option value="actual">
            {activeTab === 'mes' ? 'Mes Actual' :
             activeTab === 'trimestre' ? 'Trimestre Actual' :
             'Año Actual'}
          </option>
          {options.map((option) => (
            <option key={option.valor} value={option.valor}>
              {option.label} ({option.estadisticas})
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Período de Análisis</h3>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={loading}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Descripción del tab activo */}
      <div className="mb-3">
        <p className="text-sm text-gray-600">
          {tabs.find(t => t.id === activeTab)?.desc}
        </p>
      </div>

      {/* Selector de período específico */}
      <div className="space-y-2">
        {renderPeriodOptions()}
      </div>

      {/* Información adicional */}
      {!loadingPeriods && availablePeriods.resumen && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-xs text-blue-700">
            <strong>Resumen:</strong> {availablePeriods.resumen.total_registros} ventas totales
            {availablePeriods.resumen.primera_venta && (
              <>, desde {new Date(availablePeriods.resumen.primera_venta).toLocaleDateString()}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodSelectorAdvanced;