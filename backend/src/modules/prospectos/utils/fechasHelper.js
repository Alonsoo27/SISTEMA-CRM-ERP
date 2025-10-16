// backend/src/modules/prospectos/utils/fechasHelper.js

/**
 * 📅 HELPER DE FECHAS PARA SEGUIMIENTOS
 * Manejo flexible de fechas sin hardcodes
 * Ajuste automático a horario laboral
 */

/**
 * Calcula la fecha límite para un seguimiento según tipo y fecha programada
 * @param {string|Date} fechaProgramada - Fecha programada del seguimiento
 * @param {string} tipoSeguimiento - Tipo de seguimiento (Llamada, WhatsApp, etc.)
 * @returns {string} Fecha límite en formato ISO
 */
const calcularFechaLimite = (fechaProgramada, tipoSeguimiento = 'Llamada') => {
    const fecha = new Date(fechaProgramada);

    // Reglas de negocio por tipo de seguimiento
    // Define cuánto tiempo después de la fecha programada vence el seguimiento
    const reglas = {
        'Llamada': { horas: 4 },           // 4 horas después
        'WhatsApp': { dias: 1 },           // 1 día después
        'Messenger': { dias: 1 },          // 1 día después
        'Email': { dias: 2 },              // 2 días después
        'Visita': { horas: 2 },            // 2 horas después (más urgente)
        'Presencial': { horas: 2 },        // 2 horas después
        'Cotización': { dias: 3 },         // 3 días después
        'Seguimiento': { dias: 1 },        // 1 día después (genérico)
        'Reunion': { horas: 2 }            // 2 horas después
    };

    // Obtener regla específica o usar default
    const regla = reglas[tipoSeguimiento] || { dias: 1 };

    // Aplicar tiempo según regla
    if (regla.dias) {
        fecha.setDate(fecha.getDate() + regla.dias);
    }
    if (regla.horas) {
        fecha.setHours(fecha.getHours() + regla.horas);
    }

    // Ajustar a horario laboral si cae fuera
    return ajustarAHorarioLaboral(fecha);
};

/**
 * Ajusta una fecha al próximo horario laboral disponible
 * Horario laboral: L-V 8am-6pm, Sáb 9am-12pm, Dom cerrado
 * @param {Date} fecha - Fecha a ajustar
 * @returns {string} Fecha ajustada en formato ISO
 */
const ajustarAHorarioLaboral = (fecha) => {
    const dia = fecha.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const hora = fecha.getHours();

    // Caso 1: Domingo → Mover a Lunes 8am
    if (dia === 0) {
        fecha.setDate(fecha.getDate() + 1);
        fecha.setHours(8, 0, 0, 0);
        return fecha.toISOString();
    }

    // Caso 2: Sábado después de 12pm → Mover a Lunes 8am
    if (dia === 6 && hora >= 12) {
        fecha.setDate(fecha.getDate() + 2); // Sábado → Lunes
        fecha.setHours(8, 0, 0, 0);
        return fecha.toISOString();
    }

    // Caso 3: Sábado antes de 9am → Ajustar a 9am
    if (dia === 6 && hora < 9) {
        fecha.setHours(9, 0, 0, 0);
        return fecha.toISOString();
    }

    // Caso 4: Lunes a Viernes antes de 8am → Ajustar a 8am mismo día
    if (dia >= 1 && dia <= 5 && hora < 8) {
        fecha.setHours(8, 0, 0, 0);
        return fecha.toISOString();
    }

    // Caso 5: Lunes a Viernes después de 6pm → Mover a siguiente día 8am
    if (dia >= 1 && dia <= 5 && hora >= 18) {
        fecha.setDate(fecha.getDate() + 1);
        fecha.setHours(8, 0, 0, 0);
        // Verificar si el siguiente día es domingo
        if (fecha.getDay() === 0) {
            fecha.setDate(fecha.getDate() + 1); // Domingo → Lunes
        }
        // Verificar si el siguiente día es sábado después de medianoche
        if (fecha.getDay() === 6) {
            fecha.setHours(9, 0, 0, 0); // Ajustar a 9am sábado
        }
        return fecha.toISOString();
    }

    // Caso 6: Dentro de horario laboral → Sin cambios
    return fecha.toISOString();
};

/**
 * Valida si una fecha está dentro del horario laboral
 * @param {string|Date} fecha - Fecha a validar
 * @returns {boolean} true si está en horario laboral
 */
const esHorarioLaboral = (fecha) => {
    const date = new Date(fecha);
    const dia = date.getDay();
    const hora = date.getHours();

    // Lunes a Viernes: 8am-6pm
    if (dia >= 1 && dia <= 5) {
        return hora >= 8 && hora < 18;
    }

    // Sábado: 9am-12pm
    if (dia === 6) {
        return hora >= 9 && hora < 12;
    }

    // Domingo: Cerrado
    return false;
};

/**
 * Obtiene información descriptiva del horario laboral
 * @returns {object} Objeto con información del horario
 */
const obtenerInfoHorarioLaboral = () => {
    return {
        semana: {
            dias: 'Lunes a Viernes',
            horario: '8:00 AM - 6:00 PM',
            horas_totales: 10
        },
        sabado: {
            dias: 'Sábado',
            horario: '9:00 AM - 12:00 PM',
            horas_totales: 3
        },
        domingo: {
            dias: 'Domingo',
            horario: 'Cerrado',
            horas_totales: 0
        },
        total_horas_semanales: 53, // 50 (L-V) + 3 (Sáb)
        descripcion: 'L-V 8am-6pm, Sáb 9am-12pm, Dom cerrado'
    };
};

/**
 * Calcula la próxima fecha laboral disponible desde ahora
 * Útil para sugerir fechas al usuario
 * @param {number} horasAdelante - Horas hacia adelante (opcional)
 * @returns {string} Fecha en formato ISO
 */
const obtenerProximaFechaLaboral = (horasAdelante = 0) => {
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + horasAdelante);
    return ajustarAHorarioLaboral(ahora);
};

/**
 * Genera sugerencias inteligentes de fechas para seguimientos
 * @param {string} tipoSeguimiento - Tipo de seguimiento
 * @param {string} estadoProspecto - Estado actual del prospecto
 * @returns {array} Array de sugerencias con fecha y descripción
 */
const generarSugerenciasFechas = (tipoSeguimiento = 'Llamada', estadoProspecto = 'Interesado') => {
    const ahora = new Date();
    const sugerencias = [];

    // Sugerencia 1: Mañana temprano
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(10, 0, 0, 0);
    sugerencias.push({
        fecha: ajustarAHorarioLaboral(manana),
        descripcion: 'Mañana temprano (10am)',
        recomendado: estadoProspecto === 'Caliente' || estadoProspecto === 'Negociacion'
    });

    // Sugerencia 2: En 3 días
    const tresDias = new Date(ahora);
    tresDias.setDate(tresDias.getDate() + 3);
    tresDias.setHours(14, 0, 0, 0);
    sugerencias.push({
        fecha: ajustarAHorarioLaboral(tresDias),
        descripcion: 'En 3 días (2pm)',
        recomendado: estadoProspecto === 'Interesado'
    });

    // Sugerencia 3: En una semana
    const unaSemana = new Date(ahora);
    unaSemana.setDate(unaSemana.getDate() + 7);
    unaSemana.setHours(10, 0, 0, 0);
    sugerencias.push({
        fecha: ajustarAHorarioLaboral(unaSemana),
        descripcion: 'En una semana (10am)',
        recomendado: estadoProspecto === 'Frio' || estadoProspecto === 'Contactado'
    });

    // Ajustar según tipo de seguimiento
    if (tipoSeguimiento === 'Email' || tipoSeguimiento === 'WhatsApp') {
        // Para mensajes, sugerir también horarios de tarde
        const tardeDosHoras = new Date(ahora);
        tardeDosHoras.setHours(tardeDosHoras.getHours() + 2);
        sugerencias.unshift({
            fecha: ajustarAHorarioLaboral(tardeDosHoras),
            descripcion: 'En 2 horas',
            recomendado: true
        });
    }

    return sugerencias;
};

/**
 * 🕐 CALCULAR FECHA LÍMITE: 2 DÍAS LABORALES COMPLETOS
 * Horario laboral: L-V 8am-6pm, Sáb 9am-12pm, Dom no laboral
 *
 * @param {Date|string} fechaInicio - Fecha de inicio del seguimiento
 * @returns {Date} Fecha límite después de 2 días laborales completos (6pm del segundo día laboral)
 */
const calcular2DiasLaborales = (fechaInicio) => {
    const fecha = new Date(fechaInicio);
    let diasLaboralesContados = 0;
    let fechaActual = new Date(fecha);

    // Avanzar hasta completar 2 días laborales completos
    while (diasLaboralesContados < 2) {
        const diaSemana = fechaActual.getDay(); // 0=dom, 1=lun, ..., 6=sáb

        // Saltar domingos
        if (diaSemana === 0) {
            fechaActual.setDate(fechaActual.getDate() + 1);
            fechaActual.setHours(8, 0, 0, 0);
            continue;
        }

        // Sábados cuentan como día parcial (3 horas de 10 = 0.3 días)
        if (diaSemana === 6) {
            fechaActual.setHours(12, 0, 0, 0); // Fin jornada sábado
            diasLaboralesContados += 0.3;
            if (diasLaboralesContados < 2) {
                fechaActual.setDate(fechaActual.getDate() + 2); // Ir al lunes
                fechaActual.setHours(8, 0, 0, 0);
            }
            continue;
        }

        // Lunes a Viernes cuenta como 1 día completo
        diasLaboralesContados++;
        if (diasLaboralesContados >= 2) {
            // Establecer hora límite a 6pm del segundo día laboral
            fechaActual.setHours(18, 0, 0, 0);
            break;
        }

        // Ir al siguiente día laboral
        fechaActual.setDate(fechaActual.getDate() + 1);
        fechaActual.setHours(8, 0, 0, 0);
    }

    return fechaActual;
};

module.exports = {
    calcularFechaLimite,
    ajustarAHorarioLaboral,
    esHorarioLaboral,
    obtenerInfoHorarioLaboral,
    obtenerProximaFechaLaboral,
    generarSugerenciasFechas,
    calcular2DiasLaborales
};
