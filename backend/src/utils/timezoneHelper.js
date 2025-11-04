// ============================================
// HELPER: Conversión de timestamps a formato UTC con 'Z'
// ============================================

/**
 * Convierte todos los campos de timestamp de un objeto para que incluyan 'Z'
 * indicando que son UTC. Esto permite que JavaScript los interprete correctamente.
 *
 * @param {Object|Array} data - Objeto o array de objetos con campos timestamp
 * @returns {Object|Array} - Mismo objeto/array con timestamps en formato ISO + 'Z'
 */
function agregarZonaHorariaUTC(data) {
    if (!data) return data;

    // Si es un array, procesar cada elemento
    if (Array.isArray(data)) {
        return data.map(item => agregarZonaHorariaUTC(item));
    }

    // Si no es un objeto, retornar tal cual
    if (typeof data !== 'object') {
        return data;
    }

    // Procesar el objeto
    const resultado = { ...data };

    // Lista de campos que son timestamps en actividades_marketing
    const camposTimestamp = [
        'fecha_inicio_planeada',
        'fecha_fin_planeada',
        'fecha_inicio_real',
        'fecha_fin_real',
        'created_at',
        'updated_at',
        'deleted_at',
        'editada_en',
        'hora_corte',
        'gestionada_vencimiento_en',
        'marcada_no_realizada_en'
    ];

    // Agregar 'Z' a cada campo timestamp si existe y no la tiene
    camposTimestamp.forEach(campo => {
        if (resultado[campo]) {
            const valor = resultado[campo];

            // Si es un string y no termina en 'Z', agregarlo
            if (typeof valor === 'string' && !valor.endsWith('Z')) {
                // Remover el +00 si existe y agregar Z
                resultado[campo] = valor.replace(/\+00$/, '') + 'Z';
            }
            // Si es un Date object, convertir a ISO string
            else if (valor instanceof Date) {
                resultado[campo] = valor.toISOString();
            }
        }
    });

    return resultado;
}

module.exports = {
    agregarZonaHorariaUTC
};
