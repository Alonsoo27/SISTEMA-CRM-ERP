// utils/currency.js - Formateo de moneda empresarial
// MONEDA OFICIAL: DÓLARES AMERICANOS (USD)

/**
 * Formatea valores monetarios en dólares americanos
 * @param {number|string} valor - Valor a formatear
 * @param {Object} opciones - Opciones de formateo
 * @returns {string} Valor formateado en dólares
 */
export const formatearMoneda = (valor, opciones = {}) => {
  // Validaciones
  if (!valor || valor === 0) return '$ 0.00';
  if (isNaN(valor)) return '$ 0.00';

  const {
    moneda = 'USD',
    simbolo = '$',
    decimales = 2,
    locale = 'en-US'
  } = opciones;

  const numero = parseFloat(valor);

  try {
    return `${simbolo} ${numero.toLocaleString(locale, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    })}`;
  } catch (error) {
    console.warn('Error formateando moneda:', error);
    return `${simbolo} ${numero.toFixed(decimales)}`;
  }
};

/**
 * Formatea valores monetarios compactos para dashboards
 * @param {number|string} valor - Valor a formatear
 * @returns {string} Valor formateado compacto
 */
export const formatearMonedaCompacta = (valor) => {
  if (!valor || valor === 0) return '$ 0';

  const numero = parseFloat(valor);

  if (numero >= 1000000) {
    return `$ ${(numero / 1000000).toFixed(1)}M`;
  } else if (numero >= 1000) {
    return `$ ${(numero / 1000).toFixed(1)}K`;
  } else {
    return `$ ${numero.toFixed(0)}`;
  }
};

/**
 * Formatea cantidades con unidades de medida
 * @param {number|string} cantidad - Cantidad a formatear
 * @param {string} unidad - Unidad de medida (UND, MLL, KG, etc.)
 * @returns {string} Cantidad formateada con unidad
 */
export const formatearCantidad = (cantidad, unidad = 'UND') => {
  if (!cantidad || cantidad === 0) return `0 ${unidad}`;

  const numero = parseFloat(cantidad);

  // Para millares, mostrar con decimales si es necesario
  if (unidad === 'MLL') {
    return `${numero.toFixed(numero % 1 === 0 ? 0 : 3)} ${unidad}`;
  }

  // Para unidades, no mostrar decimales
  if (unidad === 'UND') {
    return `${Math.round(numero)} ${unidad}`;
  }

  // Para otras unidades, mostrar decimales si es necesario
  return `${numero.toFixed(numero % 1 === 0 ? 0 : 2)} ${unidad}`;
};

// Exportar como default también para compatibilidad
export default formatearMoneda;