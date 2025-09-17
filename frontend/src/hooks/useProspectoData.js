import { useMemo } from 'react';
import { normalizarProductosInteres } from '../utils/productosUtils';

/**
 * Hook personalizado para normalizar datos de prospecto
 * Especialmente útil para productos de interés con formatos inconsistentes
 */
export const useProspectoData = (prospecto) => {
  return useMemo(() => {
    if (!prospecto) return null;
    
    return {
      ...prospecto,
      productos_interes: normalizarProductosInteres(prospecto.productos_interes),
      // Agregar campos calculados útiles
      tiene_productos: prospecto.productos_interes && Array.isArray(prospecto.productos_interes) && prospecto.productos_interes.length > 0,
      valor_mostrar: prospecto.valor_estimado || prospecto.presupuesto_estimado || 0,
      nombre_completo: `${prospecto.nombre_cliente || ''} ${prospecto.apellido_cliente || ''}`.trim(),
    };
  }, [prospecto]);
};

/**
 * Hook para múltiples prospectos (útil en listas/kanban)
 */
export const useProspectosData = (prospectos) => {
  return useMemo(() => {
    if (!Array.isArray(prospectos)) return [];
    
    return prospectos.map(prospecto => ({
      ...prospecto,
      productos_interes: normalizarProductosInteres(prospecto.productos_interes),
      tiene_productos: prospecto.productos_interes && Array.isArray(prospecto.productos_interes) && prospecto.productos_interes.length > 0,
      valor_mostrar: prospecto.valor_estimado || prospecto.presupuesto_estimado || 0,
      nombre_completo: `${prospecto.nombre_cliente || ''} ${prospecto.apellido_cliente || ''}`.trim(),
    }));
  }, [prospectos]);
};