// ============================================
// MODAL DE NOTIFICACIÓN REUTILIZABLE
// Sistema profesional de alertas y mensajes
// ============================================

const ModalNotificacion = ({
    isOpen,
    onClose,
    titulo,
    mensaje,
    tipo = "info", // success, warning, danger, info
    textoBoton = "Entendido",
    autoClose = false,
    autoCloseTime = 3000
}) => {
    if (!isOpen) return null;

    // Auto-cerrar si está habilitado
    if (autoClose) {
        setTimeout(() => {
            onClose();
        }, autoCloseTime);
    }

    // Colores según tipo
    const colores = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            icon: 'text-green-600',
            button: 'bg-green-600 hover:bg-green-700',
            iconoBg: 'bg-green-100'
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            icon: 'text-yellow-600',
            button: 'bg-yellow-600 hover:bg-yellow-700',
            iconoBg: 'bg-yellow-100'
        },
        danger: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: 'text-red-600',
            button: 'bg-red-600 hover:bg-red-700',
            iconoBg: 'bg-red-100'
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: 'text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700',
            iconoBg: 'bg-blue-100'
        }
    };

    const color = colores[tipo] || colores.info;

    // Iconos según tipo
    const iconos = {
        success: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        ),
        warning: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        danger: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        info: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10003] p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all animate-slideUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header con icono */}
                <div className={`flex items-start gap-4 p-6 ${color.bg} border-b ${color.border}`}>
                    <div className={`flex-shrink-0 ${color.iconoBg} ${color.icon} rounded-full p-2`}>
                        {iconos[tipo]}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {titulo}
                        </h3>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            {mensaje}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Botón */}
                <div className="flex justify-end p-4 bg-gray-50">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2.5 text-white rounded-lg transition font-medium ${color.button}`}
                    >
                        {textoBoton}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalNotificacion;
