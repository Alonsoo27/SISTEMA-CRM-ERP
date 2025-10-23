// ============================================
// LEYENDA DE COLORES - Tipos de actividades
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';

const LeyendaColores = () => {
    const [tipos, setTipos] = useState([]);
    const [expandido, setExpandido] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarTipos();
    }, []);

    const cargarTipos = async () => {
        try {
            const response = await marketingService.obtenerTipos();
            setTipos(response.tipos || []);
        } catch (error) {
            console.error('Error cargando tipos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    // Mostrar solo primeros 6 en modo colapsado
    const tiposMostrar = expandido ? tipos : tipos.slice(0, 6);

    return (
        <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                    🎨 Leyenda de Actividades
                </h3>
                {tipos.length > 6 && (
                    <button
                        onClick={() => setExpandido(!expandido)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {expandido ? 'Ver menos' : `Ver todas (${tipos.length})`}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {tiposMostrar.map(tipo => (
                    <div
                        key={tipo.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition"
                        title={tipo.descripcion}
                    >
                        <div
                            className="w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: tipo.color_hex }}
                        ></div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">
                                {tipo.categoria_principal}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {tipo.subcategoria}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LeyendaColores;
