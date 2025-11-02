// ============================================
// TARJETA DE ACTIVIDAD
// ============================================

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ModalDetallesActividad from './ModalDetallesActividad';

const ActividadCard = ({ actividad, onClick, onRecargar }) => {
    const [showModal, setShowModal] = useState(false);

    const {
        estado,
        color_hex,
        categoria_principal,
        subcategoria,
        descripcion,
        es_grupal,
        es_prioritaria,
        transferida_de,
        creado_por_nombre,
        fecha_inicio_planeada,
        fecha_fin_planeada,
        duracion_planeada_minutos,
        tiempo_adicional_minutos
    } = actividad;

    // Detectar si la actividad está vencida
    const ahora = new Date();
    const fechaFin = new Date(fecha_fin_planeada);
    const estaVencida = (estado === 'pendiente' || estado === 'en_progreso') && fechaFin < ahora;

    // Estilos según estado
    const estadoStyles = {
        pendiente: {
            bg: 'bg-white',
            border: 'border-gray-300',
            text: 'text-gray-700'
        },
        en_progreso: {
            bg: 'bg-blue-50',
            border: 'border-blue-500',
            text: 'text-blue-900',
            extra: 'animate-pulse shadow-lg'
        },
        completada: {
            bg: 'bg-green-50',
            border: 'border-green-500',
            text: 'text-green-900',
            opacity: 'opacity-75'
        },
        pausada: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-500',
            text: 'text-yellow-900'
        },
        cancelada: {
            bg: 'bg-red-50',
            border: 'border-red-300',
            text: 'text-red-700',
            opacity: 'opacity-50'
        }
    };

    // Si está vencida, usar estilos de alerta roja
    const styles = estaVencida ? {
        bg: 'bg-red-50',
        border: 'border-red-500',
        text: 'text-red-900',
        extra: 'shadow-lg animate-pulse'
    } : (estadoStyles[estado] || estadoStyles.pendiente);

    // Formatear hora
    const formatearHora = (fecha) => {
        return format(new Date(fecha), 'HH:mm', { locale: es });
    };

    // Calcular duración total
    const duracionTotal = duracion_planeada_minutos + (tiempo_adicional_minutos || 0);
    const horas = Math.floor(duracionTotal / 60);
    const minutos = duracionTotal % 60;

    const handleCardClick = () => {
        setShowModal(true);
        if (onClick) onClick();
    };

    return (
        <>
            <div
                onClick={handleCardClick}
                className={`
                relative h-full p-3 rounded-lg border-l-4 cursor-pointer
                transition-all duration-200 hover:shadow-xl hover:scale-[1.02]
                ${styles.border} ${styles.text} ${styles.extra} ${styles.opacity}
            `}
            style={{
                borderLeftColor: color_hex,
                backgroundColor: `${color_hex}15` // Color de fondo al 15% de opacidad
            }}
        >
            {/* Tipo de actividad */}
            <div
                className="text-xs font-bold mb-1 truncate"
                style={{ color: color_hex }}
            >
                {categoria_principal} › {subcategoria}
            </div>

            {/* Descripción */}
            <div className="text-sm font-medium mb-2 line-clamp-2">
                {descripcion}
            </div>

            {/* Horario */}
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatearHora(fecha_inicio_planeada)} - {formatearHora(fecha_fin_planeada)}</span>
                <span className="text-gray-400">
                    ({horas > 0 ? `${horas}h ` : ''}{minutos}min)
                </span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1 mb-2">
                {estaVencida && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white animate-pulse">
                        ⏰ VENCIDA
                    </span>
                )}

                {es_grupal && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        👥 Grupal
                    </span>
                )}

                {es_prioritaria && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        ⚡ Prioritaria
                    </span>
                )}

                {transferida_de && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        ↗️ Transferida
                    </span>
                )}

                {tiempo_adicional_minutos > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        +{tiempo_adicional_minutos}min
                    </span>
                )}
            </div>

            {/* Creador */}
            <div className="text-xs text-gray-500">
                👤 {creado_por_nombre}
            </div>

            {/* Estado badge */}
            <div className="absolute top-2 right-2">
                <EstadoBadge estado={estado} />
            </div>
            </div>

            {/* Modal de detalles */}
            {showModal && (
                <ModalDetallesActividad
                    actividad={actividad}
                    onClose={() => setShowModal(false)}
                    onActividadActualizada={onRecargar}
                />
            )}
        </>
    );
};

// Componente de badge de estado
const EstadoBadge = ({ estado }) => {
    const badges = {
        pendiente: { icon: '⏳', text: 'Pendiente', color: 'bg-gray-200 text-gray-700' },
        en_progreso: { icon: '▶️', text: 'En progreso', color: 'bg-blue-500 text-white' },
        completada: { icon: '✓', text: 'Completada', color: 'bg-green-500 text-white' },
        pausada: { icon: '⏸', text: 'Pausada', color: 'bg-yellow-500 text-white' },
        cancelada: { icon: '✕', text: 'Cancelada', color: 'bg-red-500 text-white' }
    };

    const badge = badges[estado] || badges.pendiente;

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${badge.color}`}>
            {badge.icon}
        </span>
    );
};

export default ActividadCard;
