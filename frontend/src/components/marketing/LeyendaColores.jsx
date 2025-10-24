// ============================================
// LEYENDA DE COLORES - Categorías principales
// ============================================

import { useState, useEffect } from 'react';
import marketingService from '../../services/marketingService';

// Mapeo de colores por categoría principal
const COLORES_CATEGORIAS = {
    'GRABACIONES': '#3B82F6',
    'EDICIONES': '#F59E0B',
    'LIVES': '#EC4899',
    'DISEÑO': '#A855F7',
    'FICHAS TÉCNICAS': '#64748B',
    'FERIA': '#0EA5E9',
    'REUNIONES': '#84CC16',
    'PRUEBAS Y MUESTRAS': '#F43F5E',
    'CAPACITACIONES': '#16A34A'
};

const LeyendaColores = () => {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarCategorias();
    }, []);

    const cargarCategorias = async () => {
        try {
            const response = await marketingService.obtenerTipos();
            const tipos = response.tipos || [];

            // Extraer categorías únicas
            const categoriasUnicas = [...new Set(tipos.map(t => t.categoria_principal))];

            // Mapear a objetos con colores
            const categoriasConColor = categoriasUnicas.map(cat => ({
                nombre: cat,
                color: COLORES_CATEGORIAS[cat] || '#3B82F6'
            })).sort((a, b) => a.nombre.localeCompare(b.nombre));

            setCategorias(categoriasConColor);
        } catch (error) {
            console.error('Error cargando categorías:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    return (
        <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                    🎨 Categorías de Actividades
                </h3>
                <span className="text-xs text-gray-500">
                    {categorias.length} categorías
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {categorias.map((cat, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition"
                    >
                        <div
                            className="w-4 h-4 rounded flex-shrink-0 border border-gray-200"
                            style={{ backgroundColor: cat.color }}
                        ></div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">
                                {cat.nombre}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LeyendaColores;
