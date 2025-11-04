// ============================================
// MODAL DE CONFIRMACIÓN REUTILIZABLE
// Sistema profesional de confirmaciones
// ============================================

import { createPortal } from 'react-dom';

const ModalConfirmacion = ({
    isOpen,
    onClose,
    onConfirm,
    titulo = "¿Estás seguro?",
    mensaje,
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
    tipo = "warning", // success, warning, danger, info
    icono = null
}) => {
    if (!isOpen) return null;

    // Colores según tipo
    const colores = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            icon: 'text-green-600',
            button: 'bg-green-600 hover:bg-green-700'
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            icon: 'text-yellow-600',
            button: 'bg-yellow-600 hover:bg-yellow-700'
        },
        danger: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: 'text-red-600',
            button: 'bg-red-600 hover:bg-red-700'
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: 'text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700'
        }
    };

    const color = colores[tipo] || colores.warning;

    // Iconos por defecto según tipo
    const iconosPorDefecto = {
        success: '✓',
        warning: '⚠️',
        danger: '⚠️',
        info: 'ℹ️'
    };

    const iconoMostrar = icono || iconosPorDefecto[tipo];

    const handleConfirm = () => {
        console.log('🔵 ModalConfirmacion: handleConfirm llamado');
        console.log('🔵 onConfirm existe?', typeof onConfirm);
        console.log('🔵 onClose existe?', typeof onClose);
        onConfirm();
        onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10003] p-4"
            onClick={(e) => {
                console.log('🔶 CLICK en overlay', e.target);
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all"
                onClick={(e) => {
                    console.log('🔷 CLICK en div blanco', e.target);
                    e.stopPropagation();
                }}
            >
                {/* Header con icono */}
                <div className={`flex items-center gap-4 p-6 ${color.bg} border-b ${color.border}`}>
                    <div className={`text-4xl ${color.icon}`}>
                        {iconoMostrar}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                        {titulo}
                    </h3>
                </div>

                {/* Mensaje */}
                <div className="p-6">
                    <p className="text-gray-700 text-base leading-relaxed">
                        {mensaje}
                    </p>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                    >
                        {textoCancelar}
                    </button>
                    <button
                        onClick={(e) => {
                            console.log('🟢 CLICK en botón confirmar detectado', e);
                            e.stopPropagation();
                            handleConfirm();
                        }}
                        className={`px-5 py-2.5 text-white rounded-lg transition font-medium ${color.button}`}
                    >
                        {textoConfirmar}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalConfirmacion;
