// backend/src/modules/prospectos/utils/fechasHelper.js

/**
 * 📅 HELPER DE FECHAS PARA SEGUIMIENTOS
 * Manejo flexible de fechas sin hardcodes
 * Ajuste automático a horario laboral
 */

/**
 * Convierte una fecha de hora Perú (America/Lima) a UTC
 * @param {string|Date} fechaHoraPeru - Fecha en hora Perú (sin offset)
 * @returns {Date} Fecha convertida a UTC
 *
 * Ejemplo: "2025-10-22T12:00:00" (mediodía Perú) → "2025-10-22T17:00:00Z" (5pm UTC)
 */
const convertirHoraPeruAUTC = (fechaHoraPeru) => {
    // Crear fecha interpretándola como hora Perú (UTC-5)
    const fecha = new Date(fechaHoraPeru);

    // Perú está en UTC-5, así que sumar 5 horas para obtener UTC
    const fechaUTC = new Date(fecha.getTime() + (5 * 60 * 60 * 1000));

    return fechaUTC;
};

/**
 * Calcula la fecha límite para un seguimiento según tipo y fecha programada
 * @param {string|Date} fechaProgramada - Fecha programada del seguimiento (en hora Perú)
 * @param {string} tipoSeguimiento - Tipo de seguimiento (Llamada, WhatsApp, etc.)
 * @returns {string} Fecha límite en formato ISO UTC
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

    // Caso 2: Sábado después de 12pm → Preservar overflow de horas
    if (dia === 6 && hora >= 12) {
        // Calcular overflow: horas y minutos que sobrepasan las 12pm del sábado
        const horasOverflow = hora - 12;
        const minutosActuales = fecha.getMinutes();
        const segundosActuales = fecha.getSeconds();

        // Mover a Lunes
        fecha.setDate(fecha.getDate() + 2); // Sábado → Lunes

        // Aplicar overflow empezando desde las 8am del lunes
        const nuevaHora = 8 + horasOverflow;
        fecha.setHours(nuevaHora, minutosActuales, segundosActuales, 0);

        // Si el overflow hace que exceda 6pm del lunes, ajustar recursivamente
        if (nuevaHora >= 18) {
            return ajustarAHorarioLaboral(fecha);
        }

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

    // Caso 5: Lunes a Viernes después de 6pm → Preservar overflow de horas
    if (dia >= 1 && dia <= 5 && hora >= 18) {
        // Calcular overflow: horas y minutos que sobrepasan las 6pm
        const horasOverflow = hora - 18;
        const minutosActuales = fecha.getMinutes();
        const segundosActuales = fecha.getSeconds();

        // Mover al siguiente día
        fecha.setDate(fecha.getDate() + 1);

        // Aplicar overflow empezando desde las 8am
        const nuevaHora = 8 + horasOverflow;
        fecha.setHours(nuevaHora, minutosActuales, segundosActuales, 0);

        // Verificar si el siguiente día es domingo
        if (fecha.getDay() === 0) {
            fecha.setDate(fecha.getDate() + 1); // Domingo → Lunes
            fecha.setHours(nuevaHora, minutosActuales, segundosActuales, 0);
        }

        // Verificar si el siguiente día es sábado
        if (fecha.getDay() === 6) {
            // Sábado solo trabaja hasta 12pm
            if (nuevaHora >= 12) {
                // Si el overflow pasa de 12pm sábado, mover a lunes
                fecha.setDate(fecha.getDate() + 2); // Sábado → Lunes
                fecha.setHours(nuevaHora, minutosActuales, segundosActuales, 0);
            } else if (nuevaHora < 9) {
                // Si cae antes de 9am sábado, ajustar a 9am
                fecha.setHours(9, minutosActuales, segundosActuales, 0);
            }
        }

        // Verificar si el overflow hace que exceda 6pm del siguiente día
        if (fecha.getDay() >= 1 && fecha.getDay() <= 5 && fecha.getHours() >= 18) {
            // Recursivamente ajustar si nuevamente cae fuera de horario
            return ajustarAHorarioLaboral(fecha);
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
    convertirHoraPeruAUTC,
    calcularFechaLimite,
    ajustarAHorarioLaboral,
    esHorarioLaboral,
    obtenerInfoHorarioLaboral,
    obtenerProximaFechaLaboral,
    generarSugerenciasFechas,
    calcular2DiasLaborales
};
