// src/utils/dateHelpers.js

/**
 * 🕐 HELPERS DE FORMATEO DE FECHAS CON TIMEZONE DE PERÚ
 * =====================================================
 * Todos los helpers fuerzan el timezone 'America/Lima' para evitar
 * bugs de visualización cuando el backend guarda en UTC.
 */

/**
 * Formatear fecha completa (día, mes, año, hora)
 * Ejemplo: "24 de octubre de 2025, 6:00 p. m."
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return 'No especificada';
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima'
  });
};

/**
 * Formatear fecha corta (DD/MM/YY)
 * Ejemplo: "24/10/25"
 */
export const formatearFechaCorta = (fecha) => {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Lima'
  });
};

/**
 * Formatear fecha con formato DD/MM/YYYY
 * Ejemplo: "24/10/2025"
 */
export const formatearFechaSimple = (fecha) => {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Lima'
  });
};

/**
 * Formatear solo la hora
 * Ejemplo: "6:00 p. m."
 */
export const formatearHora = (fecha) => {
  if (!fecha) return '';
  return new Date(fecha).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima'
  });
};

/**
 * Formatear fecha y hora completos
 * Ejemplo: "24/10/2025 6:00 p. m."
 */
export const formatearFechaHora = (fecha) => {
  if (!fecha) return '';
  const date = new Date(fecha);
  return `${formatearFechaSimple(date)} ${formatearHora(date)}`;
};

/**
 * Formatear fecha relativa (hace X tiempo)
 * Ejemplo: "hace 2 horas", "hace 3 días"
 */
export const formatearFechaRelativa = (fecha) => {
  if (!fecha) return '';

  const ahora = new Date();
  const fechaObj = new Date(fecha);
  const diffMs = ahora - fechaObj;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

  return formatearFecha(fecha);
};

/**
 * Verificar si una fecha es hoy (en timezone de Perú)
 */
export const esHoy = (fecha) => {
  if (!fecha) return false;

  const hoy = new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
  const fechaComparar = new Date(fecha).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });

  return hoy === fechaComparar;
};

/**
 * Verificar si una fecha es mañana (en timezone de Perú)
 */
export const esManana = (fecha) => {
  if (!fecha) return false;

  const manana = new Date();
  manana.setDate(manana.getDate() + 1);

  const mananaStr = manana.toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
  const fechaComparar = new Date(fecha).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });

  return mananaStr === fechaComparar;
};

/**
 * Formatear monto en formato peruano
 * Ejemplo: "$1,200.00"
 */
export const formatearMonto = (valor) => {
  if (!valor || isNaN(valor)) return '$0.00';
  return `$${parseFloat(valor).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};
