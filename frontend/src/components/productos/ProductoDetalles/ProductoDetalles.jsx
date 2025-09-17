import React from 'react';

const ProductoDetalles = ({ isOpen, onClose, producto }) => {
    if (!isOpen || !producto) return null;

    const formatearFecha = (fecha) => {
        if (!fecha) return 'No disponible';
        return new Date(fecha).toLocaleString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatearPrecio = (precio) => {
        const precioNum = parseFloat(precio) || 0;
        return `$ ${precioNum.toFixed(2)}`;
    };

    // Cerrar con ESC
    React.useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyPress);
            // Prevenir scroll del body cuando modal está abierto
            document.body.style.overflow = 'hidden';
            return () => {
                document.removeEventListener('keydown', handleKeyPress);
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, onClose]);

    const campos = [
        {
            label: 'Código',
            value: producto.codigo,
            icon: (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
            )
        },
        {
            label: 'Descripción',
            value: producto.descripcion,
            icon: (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            isTextArea: true
        },
        {
            label: 'Precio (USD)',
            value: formatearPrecio(producto.precio_sin_igv),
            icon: (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
            )
        },
        {
            label: 'Marca',
            value: producto.marca,
            icon: (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            )
        },
        {
            label: 'Categoría',
            value: producto.categorias?.nombre || 'Sin categoría',
            icon: (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                </svg>
            ),
            showBadge: true
        },
        {
            label: 'Estado',
            value: producto.activo ? 'Activo' : 'Inactivo',
            icon: (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            showStatus: true
        }
    ];

    const auditoriaFields = [
        {
            label: 'Fecha de creación',
            value: formatearFecha(producto.created_at),
            icon: (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            )
        },
        {
            label: 'Última modificación',
            value: formatearFecha(producto.updated_at),
            icon: (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            )
        }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col"
                style={{ maxHeight: '85vh', minHeight: '60vh' }}
            >
                {/* Header - Altura fija */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg flex-shrink-0">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-200 rounded-lg mr-4">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Detalles del Producto
                            </h3>
                            <p className="text-sm text-gray-600">
                                {producto.codigo}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        aria-label="Cerrar modal"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Contenido - Scrolleable */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                        {/* Información Principal */}
                        <div className="space-y-6">
                            {campos.map((campo, index) => (
                                <div key={index} className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 mt-1">
                                        {campo.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {campo.label}
                                        </label>
                                        {campo.isTextArea ? (
                                            <div className="bg-gray-50 rounded-lg p-3 border">
                                                <p className="text-gray-900 leading-relaxed break-words">
                                                    {campo.value || 'No especificado'}
                                                </p>
                                            </div>
                                        ) : campo.showBadge ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                {campo.value}
                                            </span>
                                        ) : campo.showStatus ? (
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                                producto.activo 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full mr-2 ${
                                                    producto.activo ? 'bg-green-400' : 'bg-red-400'
                                                }`}></span>
                                                {campo.value}
                                            </span>
                                        ) : (
                                            <div className="bg-gray-50 rounded-lg p-3 border">
                                                <p className="text-gray-900 font-medium break-words">
                                                    {campo.value || 'No especificado'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Información de Auditoría */}
                        <div className="mt-8 pt-6 border-t">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Información de Auditoría
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {auditoriaFields.map((campo, index) => (
                                    <div key={index} className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                                        {campo.icon}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                {campo.label}
                                            </p>
                                            <p className="text-sm text-gray-900 font-medium truncate">
                                                {campo.value}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Descripción de categoría si existe */}
                        {producto.categorias?.descripcion && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h5 className="text-sm font-medium text-blue-900 mb-2">
                                    Descripción de la categoría
                                </h5>
                                <p className="text-sm text-blue-700 leading-relaxed">
                                    {producto.categorias.descripcion}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer - Altura fija */}
                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150 font-medium"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 font-medium"
                        >
                            ESC
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductoDetalles;