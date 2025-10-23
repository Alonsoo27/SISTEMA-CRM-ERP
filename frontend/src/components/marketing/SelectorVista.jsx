// ============================================
// SELECTOR DE VISTA
// ============================================

const SelectorVista = ({ vista, onChange }) => {
    const vistas = [
        { id: 'semanal', nombre: 'Semanal', icon: '📅', descripcion: 'Vista detallada por día' },
        { id: 'mensual', nombre: 'Mensual', icon: '📆', descripcion: 'Vista mensual completa' },
        { id: 'trimestral', nombre: 'Trimestral', icon: '📊', descripcion: 'Vista trimestral' },
        { id: 'anual', nombre: 'Anual', icon: '📈', descripcion: 'Vista anual completa' }
    ];

    return (
        <div className="flex gap-2">
            {vistas.map(v => (
                <button
                    key={v.id}
                    onClick={() => onChange(v.id)}
                    className={`
                        px-4 py-2 rounded-lg font-medium transition-all
                        ${vista === v.id
                            ? 'bg-blue-600 text-white shadow-lg scale-105'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }
                    `}
                    title={v.descripcion}
                >
                    <span className="mr-2">{v.icon}</span>
                    {v.nombre}
                </button>
            ))}
        </div>
    );
};

export default SelectorVista;
