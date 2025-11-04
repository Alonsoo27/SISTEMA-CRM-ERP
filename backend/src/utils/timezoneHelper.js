// ============================================
// HELPER: Ya NO agrega 'Z' - timestamps son hora local Perú
// ============================================

/**
 * DESACTIVADO: Ahora los timestamps se guardan en hora de Perú (America/Lima)
 * directamente en la BD usando NOW() AT TIME ZONE 'America/Lima'
 *
 * Este helper ahora solo retorna los datos sin modificación.
 *
 * @param {Object|Array} data - Objeto o array de objetos con campos timestamp
 * @returns {Object|Array} - Mismo objeto/array sin modificaciones
 */
function agregarZonaHorariaUTC(data) {
    // Simplemente retornar los datos sin agregar 'Z'
    // Los timestamps ya vienen en hora de Perú desde la BD
    return data;
}

module.exports = {
    agregarZonaHorariaUTC
};
