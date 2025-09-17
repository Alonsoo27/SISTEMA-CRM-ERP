import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    TrendingUp, TrendingDown, Minus, Clock, Target, 
    Users, CheckCircle, AlertTriangle, Zap, Star,
    Activity, BarChart3, PieChart
} from 'lucide-react';

const MetricasCard = ({ 
    titulo, 
    valor, 
    unidad = '', 
    descripcion = '', 
    tipo = 'default',
    tendencia = null, // 'up', 'down', 'neutral'
    valorAnterior = null,
    meta = null,
    estado = 'normal', // 'normal', 'warning', 'danger', 'success'
    icono = null,
    mostrarProgreso = false,
    detalles = null,
    onClick = null,
    loading = false,
    size = 'default' // 'small', 'default', 'large'
}) => {
    // Configuración de iconos por tipo
    const iconosPorTipo = {
        tiempo: Clock,
        objetivo: Target,
        usuarios: Users,
        completado: CheckCircle,
        alerta: AlertTriangle,
        rendimiento: Zap,
        calidad: Star,
        actividad: Activity,
        grafico: BarChart3,
        distribucion: PieChart,
        default: BarChart3
    };

    // Configuración de colores por estado
    const coloresPorEstado = {
        normal: 'text-gray-600',
        success: 'text-green-600',
        warning: 'text-yellow-600',
        danger: 'text-red-600'
    };

    // Configuración de tamaños
    const tamanos = {
        small: {
            card: 'p-3',
            titulo: 'text-sm font-medium',
            valor: 'text-xl font-bold',
            icono: 'h-4 w-4',
            descripcion: 'text-xs'
        },
        default: {
            card: 'p-4',
            titulo: 'text-sm font-medium',
            valor: 'text-2xl font-bold',
            icono: 'h-5 w-5',
            descripcion: 'text-xs'
        },
        large: {
            card: 'p-6',
            titulo: 'text-base font-semibold',
            valor: 'text-3xl font-bold',
            icono: 'h-6 w-6',
            descripcion: 'text-sm'
        }
    };

    const Icon = icono || iconosPorTipo[tipo] || iconosPorTipo.default;
    const colorEstado = coloresPorEstado[estado];
    const config = tamanos[size];

    // Calcular porcentaje de cambio si hay valor anterior
    const porcentajeCambio = valorAnterior && valor !== null && valorAnterior !== 0 
        ? ((valor - valorAnterior) / valorAnterior) * 100 
        : null;

    // Calcular progreso hacia meta
    const progresoMeta = meta && valor !== null 
        ? Math.min((valor / meta) * 100, 100) 
        : null;

    // Determinar tendencia automáticamente si no se proporciona
    const tendenciaCalculada = tendencia || (
        porcentajeCambio !== null 
            ? porcentajeCambio > 0 
                ? 'up' 
                : porcentajeCambio < 0 
                    ? 'down' 
                    : 'neutral'
            : null
    );

    // Formatear valor
    const formatearValor = (val) => {
        if (val === null || val === undefined) return '---';
        
        // Si el valor es un número, formatearlo
        if (typeof val === 'number') {
            // Para porcentajes
            if (unidad === '%') {
                return val.toFixed(1);
            }
            // Para números grandes, usar formato con comas
            if (val >= 1000) {
                return val.toLocaleString();
            }
            // Para decimales
            if (val % 1 !== 0) {
                return val.toFixed(2);
            }
            return val.toString();
        }
        
        return val.toString();
    };

    // Renderizar indicador de tendencia
    const renderTendencia = () => {
        if (!tendenciaCalculada || porcentajeCambio === null) return null;

        const iconoTendencia = {
            up: TrendingUp,
            down: TrendingDown,
            neutral: Minus
        };

        const colorTendencia = {
            up: 'text-green-600',
            down: 'text-red-600',
            neutral: 'text-gray-600'
        };

        const IconTendencia = iconoTendencia[tendenciaCalculada];

        return (
            <div className={`flex items-center gap-1 ${colorTendencia[tendenciaCalculada]}`}>
                <IconTendencia className="h-3 w-3" />
                <span className="text-xs font-medium">
                    {Math.abs(porcentajeCambio).toFixed(1)}%
                </span>
            </div>
        );
    };

    // Renderizar barra de progreso
    const renderProgreso = () => {
        if (!mostrarProgreso || progresoMeta === null) return null;

        const colorProgreso = progresoMeta >= 100 
            ? 'bg-green-500' 
            : progresoMeta >= 75 
                ? 'bg-blue-500' 
                : progresoMeta >= 50 
                    ? 'bg-yellow-500' 
                    : 'bg-red-500';

        return (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                    className={`h-2 rounded-full transition-all duration-300 ${colorProgreso}`}
                    style={{ width: `${Math.min(progresoMeta, 100)}%` }}
                ></div>
            </div>
        );
    };

    // Renderizar detalles adicionales
    const renderDetalles = () => {
        if (!detalles) return null;

        return (
            <div className="mt-3 space-y-1">
                {Array.isArray(detalles) ? (
                    detalles.map((detalle, index) => (
                        <div key={index} className="flex justify-between text-xs text-gray-600">
                            <span>{detalle.label}:</span>
                            <span className="font-medium">{detalle.valor}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-gray-600">{detalles}</p>
                )}
            </div>
        );
    };

    return (
        <Card 
            className={`${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${config.card}`}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={config.titulo}>
                    {titulo}
                </CardTitle>
                <div className="flex items-center gap-2">
                    {renderTendencia()}
                    <Icon className={`${config.icono} ${colorEstado}`} />
                </div>
            </CardHeader>
            
            <CardContent>
                <div className="flex items-baseline gap-2">
                    {loading ? (
                        <div className="animate-pulse">
                            <div className="h-8 bg-gray-200 rounded w-20"></div>
                        </div>
                    ) : (
                        <>
                            <div className={`${config.valor} ${colorEstado}`}>
                                {formatearValor(valor)}
                            </div>
                            {unidad && (
                                <span className={`${config.descripcion} text-gray-500 font-medium`}>
                                    {unidad}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {descripcion && (
                    <p className={`${config.descripcion} text-gray-600 mt-1`}>
                        {descripcion}
                    </p>
                )}

                {/* Meta */}
                {meta && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Meta:</span>
                        <Badge variant="outline" className="text-xs">
                            {formatearValor(meta)}{unidad}
                        </Badge>
                        {progresoMeta && (
                            <span className={`text-xs font-medium ${
                                progresoMeta >= 100 ? 'text-green-600' : 'text-gray-600'
                            }`}>
                                ({progresoMeta.toFixed(0)}%)
                            </span>
                        )}
                    </div>
                )}

                {/* Barra de progreso */}
                {renderProgreso()}

                {/* Valor anterior */}
                {valorAnterior !== null && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Anterior:</span>
                        <span className="text-xs font-medium text-gray-600">
                            {formatearValor(valorAnterior)}{unidad}
                        </span>
                    </div>
                )}

                {/* Detalles adicionales */}
                {renderDetalles()}

                {/* Estado con badge */}
                {estado !== 'normal' && (
                    <div className="mt-2">
                        <Badge 
                            variant={
                                estado === 'success' ? 'default' : 
                                estado === 'warning' ? 'secondary' : 
                                'destructive'
                            }
                            className="text-xs"
                        >
                            {estado === 'success' && '✓ Objetivo alcanzado'}
                            {estado === 'warning' && '⚠ Atención requerida'}
                            {estado === 'danger' && '⚠ Acción urgente'}
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// Componente wrapper para múltiples métricas
export const MetricasGrid = ({ metricas, columnas = 4, loading = false }) => {
    const columnasClass = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
    };

    return (
        <div className={`grid ${columnasClass[columnas]} gap-4`}>
            {metricas.map((metrica, index) => (
                <MetricasCard 
                    key={metrica.key || index}
                    loading={loading}
                    {...metrica} 
                />
            ))}
        </div>
    );
};

// Ejemplos de métricas predefinidas para soporte técnico
export const metricasSoporteEjemplos = {
    ticketsActivos: {
        titulo: 'Tickets Activos',
        tipo: 'actividad',
        estado: 'normal',
        descripcion: 'Tickets pendientes y en proceso'
    },
    
    tiempoPromedioReparacion: {
        titulo: 'Tiempo Promedio Reparación',
        unidad: 'horas',
        tipo: 'tiempo',
        meta: 48,
        mostrarProgreso: true,
        descripcion: 'Tiempo promedio para completar reparaciones'
    },

    eficienciaPromedio: {
        titulo: 'Eficiencia Promedio',
        unidad: '%',
        tipo: 'rendimiento',
        meta: 80,
        mostrarProgreso: true,
        descripcion: 'Tiempo neto vs tiempo bruto de reparación'
    },

    capacitacionesPendientes: {
        titulo: 'Capacitaciones Pendientes',
        tipo: 'usuarios',
        descripcion: 'Capacitaciones programadas'
    },

    satisfaccionCliente: {
        titulo: 'Satisfacción Cliente',
        unidad: '/5',
        tipo: 'calidad',
        meta: 4.5,
        mostrarProgreso: true,
        descripcion: 'Calificación promedio de clientes'
    },

    productosEnReparacion: {
        titulo: 'Productos en Reparación',
        tipo: 'actividad',
        descripcion: 'Productos actualmente siendo reparados'
    },

    productosPausados: {
        titulo: 'Productos Pausados',
        tipo: 'alerta',
        estado: 'warning',
        descripcion: 'Productos con reparación pausada'
    },

    ticketsVencidos: {
        titulo: 'Tickets Vencidos',
        tipo: 'alerta',
        estado: 'danger',
        descripcion: 'Tickets que superaron el SLA'
    }
};

export default MetricasCard;