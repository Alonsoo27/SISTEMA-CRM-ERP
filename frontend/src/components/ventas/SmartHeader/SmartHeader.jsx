// src/components/ventas/SmartHeader/SmartHeader.jsx
import React from 'react';
import {
  DollarSign, Users, TrendingUp, Award, Target, Activity,
  BarChart3, PieChart, Clock, GitBranch, Eye, Zap
} from 'lucide-react';

const SmartHeader = ({ 
  vistaActual, 
  statsGenerales, 
  loading = false, 
  onBonoClick 
}) => {
  
  // Configuración de métricas por vista
  const getMetricasPorVista = (vista) => {
    const metricas = {
      'lista': [
        {
          titulo: "Ingresos",
          valor: statsGenerales?.ingresos_reales || statsGenerales?.ingresos_mes || '$12,480.00',
          descripcion: `Meta: ${statsGenerales?.meta_mes || '$8,000'}`,
          icono: DollarSign,
          color: "text-green-600 bg-green-100"
        },
        {
          titulo: "Bono Actual",
          valor: `$${statsGenerales?.bono_actual || '276.00'}`,
          descripcion: `${statsGenerales?.porcentaje_meta || '156'}% de meta`,
          icono: Award,
          color: "text-emerald-600 bg-emerald-100",
          isClickable: true,
          onClick: onBonoClick
        },
        {
          titulo: "Clientes",
          valor: statsGenerales?.clientes_activos || '10',
          descripcion: `${statsGenerales?.clientes_nuevos || 0} nuevos`,
          icono: Users,
          color: "text-purple-600 bg-purple-100"
        },
        {
          titulo: "Conversión",
          valor: statsGenerales?.tasa_conversion || '16.67%',
          descripcion: `${statsGenerales?.oportunidades || 0} oportunidades`,
          icono: TrendingUp,
          color: (statsGenerales?.tasa_conversion_num || 0) >= 20 ? "text-green-600 bg-green-100" : "text-orange-600 bg-orange-100"
        }
      ],
      'metricas': [
        {
          titulo: "Ventas Mes",
          valor: statsGenerales?.ventas_mes || '26',
          descripcion: "Total período",
          icono: BarChart3,
          color: "text-blue-600 bg-blue-100"
        },
        {
          titulo: "Tendencia",
          valor: `${statsGenerales?.crecimiento_mes > 0 ? '+' : ''}${statsGenerales?.crecimiento_mes || 0}%`,
          descripcion: "vs mes anterior",
          icono: TrendingUp,
          color: (statsGenerales?.crecimiento_mes || 0) >= 0 ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"
        },
        {
          titulo: "Proyección",
          valor: `$${statsGenerales?.proyeccion_mes || '15,800'}`,
          descripcion: "Estimado fin de mes",
          icono: Target,
          color: "text-indigo-600 bg-indigo-100"
        },
        {
          titulo: "Análisis",
          valor: statsGenerales?.analisis_periodo || 'Excelente',
          descripcion: "Rendimiento general",
          icono: PieChart,
          color: "text-cyan-600 bg-cyan-100"
        }
      ],
      'pipeline': [
        {
          titulo: "Leads",
          valor: statsGenerales?.leads_activos || '45',
          descripcion: "En seguimiento",
          icono: Users,
          color: "text-blue-600 bg-blue-100"
        },
        {
          titulo: "Conversión",
          valor: statsGenerales?.tasa_conversion || '16.67%',
          descripcion: "Lead → Venta",
          icono: TrendingUp,
          color: "text-green-600 bg-green-100"
        },
        {
          titulo: "Oportunidades",
          valor: statsGenerales?.oportunidades_calientes || '12',
          descripción: "Probabilidad alta",
          icono: Target,
          color: "text-orange-600 bg-orange-100"
        },
        {
          titulo: "Cierre Promedio",
          valor: `${statsGenerales?.tiempo_promedio_cierre || '5'} días`,
          descripcion: "Tiempo de conversión",
          icono: Clock,
          color: "text-purple-600 bg-purple-100"
        }
      ],
      'clientes': [
        {
          titulo: "Total Clientes",
          valor: statsGenerales?.total_clientes || '156',
          descripcion: "Base completa",
          icono: Users,
          color: "text-blue-600 bg-blue-100"
        },
        {
          titulo: "Nuevos",
          valor: statsGenerales?.clientes_nuevos || '8',
          descripcion: "Este mes",
          icono: TrendingUp,
          color: "text-green-600 bg-green-100"
        },
        {
          titulo: "Activos",
          valor: statsGenerales?.clientes_activos || '10',
          descripcion: "Con compras recientes",
          icono: Activity,
          color: "text-emerald-600 bg-emerald-100"
        },
        {
          titulo: "Satisfacción",
          valor: statsGenerales?.satisfaccion_promedio || '4.8/5',
          descripcion: "Rating promedio",
          icono: Award,
          color: "text-yellow-600 bg-yellow-100"
        }
      ],
      'actividad': [
        {
          titulo: "Jornada Actual",
          valor: statsGenerales?.horas_trabajadas_hoy || '6.5h',
          descripcion: "Tiempo activo",
          icono: Clock,
          color: "text-blue-600 bg-blue-100"
        },
        {
          titulo: "Productividad",
          valor: `${statsGenerales?.productividad_hoy || '78'}%`,
          descripcion: "Eficiencia del día",
          icono: Activity,
          color: "text-green-600 bg-green-100"
        },
        {
          titulo: "Llamadas",
          valor: statsGenerales?.llamadas_realizadas || '24',
          descripción: "Realizadas hoy",
          icono: TrendingUp,
          color: "text-purple-600 bg-purple-100"
        },
        {
          titulo: "Estado",
          valor: statsGenerales?.estado_jornada || 'Activo',
          descripcion: "Check-in 08:30",
          icono: Zap,
          color: "text-emerald-600 bg-emerald-100"
        }
      ],
      'dashboards-admin': [
        {
          titulo: "Vista Global",
          valor: statsGenerales?.total_ventas_equipo || '$125,400',
          descripcion: "Ingresos del equipo",
          icono: Eye,
          color: "text-purple-600 bg-purple-100"
        },
        {
          titulo: "Performance",
          valor: `${statsGenerales?.performance_equipo || '89'}%`,
          descripción: "Cumplimiento metas",
          icono: BarChart3,
          color: "text-blue-600 bg-blue-100"
        },
        {
          titulo: "KPIs",
          valor: statsGenerales?.kpis_criticos || '12/15',
          descripcion: "En objetivo",
          icono: Target,
          color: "text-green-600 bg-green-100"
        },
        {
          titulo: "Flujo",
          valor: statsGenerales?.flujo_operativo || 'Óptimo',
          descripcion: "Estado operacional",
          icono: GitBranch,
          color: "text-indigo-600 bg-indigo-100"
        }
      ]
    };

    return metricas[vista] || metricas['lista'];
  };

  const metricas = getMetricasPorVista(vistaActual);

  return (
    <div className="px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between max-w-full">
        <div className="grid grid-cols-4 gap-6 flex-1 min-w-0">
          {metricas.map((metrica, index) => {
            const IconComponent = metrica.icono;
            
            return (
              <div 
                key={index}
                className={`flex items-center space-x-3 min-w-0 ${
                  metrica.isClickable 
                    ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' 
                    : ''
                }`}
                onClick={metrica.onClick}
                title={metrica.isClickable ? "Click para ver detalles" : undefined}
              >
                <div className={`p-2 rounded-lg ${metrica.color}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <div className="animate-pulse">
                      <div className="h-3 bg-gray-200 rounded w-12 mb-1"></div>
                      <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                      <div className="h-2 bg-gray-200 rounded w-20"></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <p className="text-xs font-medium text-gray-600 truncate">
                          {metrica.titulo}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {metrica.valor}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {metrica.descripcion}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Indicador de vista activa */}
        <div className="ml-4 flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" 
               title={`Vista: ${vistaActual}`}></div>
          <span className="text-xs font-medium text-gray-500 capitalize">
            {vistaActual}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SmartHeader;