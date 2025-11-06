// ============================================
// SELECTOR DE PERÍODOS SIMPLE - PARA PIPELINE
// No depende de períodos disponibles, permite cualquier selección
// ============================================

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, ChevronDown } from 'lucide-react';

const PeriodSelectorSimple = ({
  onPeriodChange,
  initialPeriod = 'mes_actual',
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState('mes');
  const [selectedValue, setSelectedValue] = useState('actual');

  // Determinar tab inicial basado en el período
  useEffect(() => {
    if (initialPeriod.startsWith('mes_')) {
      setActiveTab('mes');
      const match = initialPeriod.match(/mes_(\d{4})-(\d{2})/);
      if (match) {
        setSelectedValue(`${match[1]}-${match[2]}`);
      } else {
        setSelectedValue('actual');
      }
    } else if (initialPeriod === 'semana_actual') {
      setActiveTab('semana');
      setSelectedValue('actual');
    } else if (initialPeriod.startsWith('trimestre_')) {
      setActiveTab('trimestre');
      const match = initialPeriod.match(/trimestre_(\d{4})-Q(\d)/);
      if (match) {
        setSelectedValue(`${match[1]}-Q${match[2]}`);
      } else {
        setSelectedValue('actual');
      }
    } else if (initialPeriod.startsWith('año_')) {
      setActiveTab('año');
      const match = initialPeriod.match(/año_(\d{4})/);
      if (match) {
        setSelectedValue(match[1]);
      } else {
        setSelectedValue('actual');
      }
    }
  }, [initialPeriod]);

  // Generar opciones de meses (últimos 12 meses)
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

      options.push({
        value: `${year}-${month}`,
        label: `${monthNames[date.getMonth()]} ${year}`
      });
    }

    return options;
  };

  // Generar opciones de trimestres (últimos 8 trimestres)
  const generateQuarterOptions = () => {
    const options = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentQuarter = Math.floor(today.getMonth() / 3) + 1;

    for (let i = 0; i < 8; i++) {
      let year = currentYear;
      let quarter = currentQuarter - i;

      while (quarter < 1) {
        quarter += 4;
        year--;
      }

      options.push({
        value: `${year}-Q${quarter}`,
        label: `Q${quarter} ${year}`
      });
    }

    return options;
  };

  // Generar opciones de años (últimos 5 años)
  const generateYearOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 5; i++) {
      const year = currentYear - i;
      options.push({
        value: String(year),
        label: String(year)
      });
    }

    return options;
  };

  // Construir período completo
  const buildPeriod = (tab, value) => {
    if (value === 'actual') {
      switch (tab) {
        case 'semana': return 'semana_actual';
        case 'mes': return 'mes_actual';
        case 'trimestre': return 'trimestre_actual';
        case 'año': return 'año_actual';
        default: return 'mes_actual';
      }
    }

    switch (tab) {
      case 'mes': return `mes_${value}`;
      case 'trimestre': return `trimestre_${value}`;
      case 'año': return `año_${value}`;
      default: return 'mes_actual';
    }
  };

  // Manejar cambio de tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedValue('actual');
    onPeriodChange(buildPeriod(tabId, 'actual'));
  };

  // Manejar cambio de período específico
  const handlePeriodChange = (value) => {
    setSelectedValue(value);
    const period = buildPeriod(activeTab, value);
    console.log(`📅 [Pipeline] Período seleccionado: ${period}`);
    onPeriodChange(period);
  };

  // Renderizar opciones del selector
  const renderPeriodOptions = () => {
    if (activeTab === 'semana') {
      return (
        <div className="text-sm text-gray-600 italic bg-blue-50 p-3 rounded-lg">
          📅 Semana actual (Lunes a Domingo)
        </div>
      );
    }

    let options = [];
    let currentLabel = '';

    switch (activeTab) {
      case 'mes':
        options = generateMonthOptions();
        currentLabel = 'Mes Actual';
        break;
      case 'trimestre':
        options = generateQuarterOptions();
        currentLabel = 'Trimestre Actual';
        break;
      case 'año':
        options = generateYearOptions();
        currentLabel = 'Año Actual';
        break;
      default:
        return null;
    }

    return (
      <div className="relative">
        <select
          value={selectedValue}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
          disabled={loading}
        >
          <option value="actual">{currentLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>
    );
  };

  // Configuración de tabs
  const tabs = [
    { id: 'semana', label: 'Semana', icon: Clock },
    { id: 'mes', label: 'Mes', icon: Calendar },
    { id: 'trimestre', label: 'Trimestre', icon: Filter },
    { id: 'año', label: 'Año', icon: Calendar }
  ];

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
              className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              disabled={loading}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selector de período específico */}
      <div className="space-y-2">
        {renderPeriodOptions()}
      </div>

      {/* Info adicional */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Selecciona el período para analizar el pipeline
      </div>
    </div>
  );
};

export default PeriodSelectorSimple;
