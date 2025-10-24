/**
 * ⏰ UTILIDADES PARA FORMATEAR FECHAS DE VENCIMIENTO DE SEGUIMIENTOS
 *
 * Formato híbrido que muestra:
 * - Si ya venció: "Vencido hace Xd" o "Vencido hace Xh"
 * - Si vence en < 24h: "Vence en Xh Xm" (con precisión de minutos)
 * - Si vence en >= 24h: "Vence: DD/MM HH:MM" (fecha y hora)
 *
 * Fecha: 2025-10-20
 */

/**
 * Formatea una fecha de vencimiento según su proximidad
 * @param {string|Date} fechaVencimiento - Fecha límite del seguimiento
 * @returns {Object} Objeto con texto, color y estado de urgencia
 */
export const formatearVencimiento = (fechaVencimiento) => {
  if (!fechaVencimiento) {
    return { texto: 'Sin seguimiento', color: 'text-gray-400', urgente: false };
  }

  // ✅ FIX: Obtener hora actual en timezone de Perú
  const ahora = new Date();
  const ahoraPeruStr = ahora.toLocaleString('en-US', { timeZone: 'America/Lima' });
  const ahoraPeruDate = new Date(ahoraPeruStr);

  // ✅ FIX: Convertir fecha de vencimiento a timezone de Perú
  const venceStr = new Date(fechaVencimiento).toLocaleString('en-US', { timeZone: 'America/Lima' });
  const vence = new Date(venceStr);

  const diffMs = vence - ahoraPeruDate;
  const diffHoras = diffMs / (1000 * 60 * 60);

  // ❌ SI YA VENCIÓ
  if (diffHoras < 0) {
    const horasVencidas = Math.abs(diffHoras);
    const diasVencidos = Math.floor(horasVencidas / 24);
    const horasRestantes = Math.floor(horasVencidas % 24);

    if (diasVencidos > 0) {
      return {
        texto: `Vencido hace ${diasVencidos}d`,
        color: 'text-red-600',
        urgente: true
      };
    }
    return {
      texto: `Vencido hace ${horasRestantes}h`,
      color: 'text-red-600',
      urgente: true
    };
  }

  // ⚠️ SI VENCE EN MENOS DE 24 HORAS (mostrar con precisión de minutos)
  if (diffHoras < 24) {
    const horas = Math.floor(diffHoras);
    const minutos = Math.floor((diffHoras % 1) * 60);

    return {
      texto: `Vence en ${horas}h ${minutos}m`,
      color: 'text-orange-600',
      urgente: true
    };
  }

  // ✅ SI VENCE EN MÁS DE 24 HORAS (mostrar fecha y hora)
  const fecha = vence.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima'  // ✅ FIX: Forzar timezone de Perú
  });

  return {
    texto: `Vence: ${fecha}`,
    color: 'text-gray-600',
    urgente: false
  };
};

/**
 * Ordena un array de prospectos por proximidad de vencimiento
 * Los más próximos a vencer (o ya vencidos) van primero
 * @param {Array} prospectos - Array de prospectos con campo seguimiento_obligatorio
 * @returns {Array} Array ordenado
 */
export const ordenarProspectosPorVencimiento = (prospectos) => {
  return [...prospectos].sort((a, b) => {
    // Si ambos tienen seguimiento
    if (a.seguimiento_obligatorio && b.seguimiento_obligatorio) {
      const venceA = new Date(a.seguimiento_obligatorio);
      const venceB = new Date(b.seguimiento_obligatorio);

      // Ordenar por fecha más próxima PRIMERO (ascendente)
      return venceA - venceB;
    }

    // Si solo A tiene seguimiento, va primero
    if (a.seguimiento_obligatorio && !b.seguimiento_obligatorio) return -1;

    // Si solo B tiene seguimiento, va primero
    if (!a.seguimiento_obligatorio && b.seguimiento_obligatorio) return 1;

    // Si ninguno tiene seguimiento, mantener orden actual
    return 0;
  });
};

/**
 * Verifica si un prospecto tiene seguimiento urgente (< 24h o vencido)
 * @param {string|Date} fechaVencimiento - Fecha límite del seguimiento
 * @returns {boolean} true si es urgente
 */
export const esVencimientoUrgente = (fechaVencimiento) => {
  if (!fechaVencimiento) return false;

  // ✅ FIX: Usar timezone de Perú
  const ahora = new Date();
  const ahoraPeruStr = ahora.toLocaleString('en-US', { timeZone: 'America/Lima' });
  const ahoraPeruDate = new Date(ahoraPeruStr);

  const venceStr = new Date(fechaVencimiento).toLocaleString('en-US', { timeZone: 'America/Lima' });
  const vence = new Date(venceStr);

  const diffHoras = (vence - ahoraPeruDate) / (1000 * 60 * 60);

  // Es urgente si ya venció o vence en menos de 24 horas
  return diffHoras < 24;
};

/**
 * Obtiene el estado de vencimiento de un prospecto
 * @param {string|Date} fechaVencimiento - Fecha límite del seguimiento
 * @returns {string} 'vencido' | 'urgente' | 'vigente' | 'sin_seguimiento'
 */
export const getEstadoVencimiento = (fechaVencimiento) => {
  if (!fechaVencimiento) return 'sin_seguimiento';

  // ✅ FIX: Usar timezone de Perú
  const ahora = new Date();
  const ahoraPeruStr = ahora.toLocaleString('en-US', { timeZone: 'America/Lima' });
  const ahoraPeruDate = new Date(ahoraPeruStr);

  const venceStr = new Date(fechaVencimiento).toLocaleString('en-US', { timeZone: 'America/Lima' });
  const vence = new Date(venceStr);

  const diffHoras = (vence - ahoraPeruDate) / (1000 * 60 * 60);

  if (diffHoras < 0) return 'vencido';
  if (diffHoras < 24) return 'urgente';
  return 'vigente';
};
