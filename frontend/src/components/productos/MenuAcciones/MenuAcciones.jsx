import React, { useState, useRef, useEffect } from 'react';

const MenuAcciones = ({ producto, onEditar, onEliminar, onVer, onDuplicar }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState('bottom'); // 'bottom' or 'top'
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, right: 0 });
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // Detectar posición y ajustar dropdown
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const dropdownHeight = 180; // Altura aproximada del dropdown
            const dropdownWidth = 192; // 48 * 4 = 192px (w-48)
            const spaceBelow = viewportHeight - rect.bottom - 20; // 20px de margen
            const spaceAbove = rect.top - 20; // 20px de margen
            
            let top, right;
            
            // Calcular posición horizontal (siempre alineado a la derecha del botón)
            right = window.innerWidth - rect.right;
            
            // Calcular posición vertical
            if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
                // Abrir hacia arriba
                setDropdownPosition('top');
                top = rect.top - dropdownHeight - 4; // 4px de gap
            } else {
                // Abrir hacia abajo
                setDropdownPosition('bottom');
                top = rect.bottom + 4; // 4px de gap
            }
            
            setDropdownCoords({ top, right });
        }
    }, [isOpen]);

    // Cerrar menú al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                window.removeEventListener('scroll', handleScroll, true);
            };
        }
    }, [isOpen]);

    const toggleMenu = (e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleAction = (action, e) => {
        e.stopPropagation();
        setIsOpen(false);
        action();
    };

    const acciones = [
        {
            label: 'Ver detalles',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ),
            action: onVer,
            className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
        },
        {
            label: 'Editar',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            ),
            action: onEditar,
            className: 'text-green-600 hover:text-green-800 hover:bg-green-50'
        },
        {
            label: 'Duplicar',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
            action: onDuplicar,
            className: 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
        },
        {
            label: 'Eliminar',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            ),
            action: onEliminar,
            className: 'text-red-600 hover:text-red-800 hover:bg-red-50'
        }
    ];

    // Clases dinámicas según posición
    const getDropdownClasses = () => {
        const baseClasses = "fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 transform transition-all duration-200 ease-out";
        const zIndexClass = "z-[9999]";
        
        if (dropdownPosition === 'top') {
            return `${baseClasses} ${zIndexClass} origin-bottom-right`;
        } else {
            return `${baseClasses} ${zIndexClass} origin-top-right`;
        }
    };

    // Animación de entrada según posición
    const getAnimationClasses = () => {
        if (dropdownPosition === 'top') {
            return "animate-in slide-in-from-bottom-2 fade-in-0 duration-200";
        } else {
            return "animate-in slide-in-from-top-2 fade-in-0 duration-200";
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Botón de 3 puntos */}
            <button
                ref={buttonRef}
                onClick={toggleMenu}
                className={`p-2 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    isOpen 
                        ? 'bg-gray-200 text-gray-700' 
                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                aria-label="Opciones"
                aria-expanded={isOpen}
            >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div 
                    className={`${getDropdownClasses()} ${getAnimationClasses()}`}
                    style={{
                        top: `${dropdownCoords.top}px`,
                        right: `${dropdownCoords.right}px`
                    }}
                >
                    {acciones.map((accion, index) => (
                        <button
                            key={index}
                            onClick={(e) => handleAction(accion.action, e)}
                            className={`w-full flex items-center px-4 py-2.5 text-sm transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${accion.className}`}
                        >
                            <span className="mr-3 flex-shrink-0">{accion.icon}</span>
                            <span className="flex-1 text-left">{accion.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Backdrop para mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[9998] bg-transparent md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default MenuAcciones;