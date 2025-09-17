// ============================================
// ACTIVIDAD DIARIA HELPERS - UTILIDADES EMPRESARIALES
// Funciones auxiliares para cálculos, análisis y reportes
// ============================================

const { query } = require('../../../config/database');

// ============================================
// CONSTANTES EMPRESARIALES
// ============================================

const TIMEZONE_PERU = 'America/Lima';

const CLASIFICACIONES_PRODUCTIVIDAD = {
    SIN_ACTIVIDAD: { min: 0, max: 0, label: 'Sin Actividad', color: '#6b7280', emoji: '😴' },
    BAJA: { min: 1, max: 20, label: 'Baja', color: '#ef4444', emoji: '📉' },
    MEDIA: { min: 21, max: 50, label: 'Media', color: '#f59e0b', emoji: '📊' },
    ALTA: { min: 51, max: 100, label: 'Alta', color: '#3b82f6', emoji: '📈' },
    MUY_ALTA: { min: 101, max: Infinity, label: 'Muy Alta', color: '#22c55e', emoji: '🚀' }
};

const CLASIFICACIONES_PUNTUALIDAD = {
    EXCELENTE: { label: 'Excelente', emoji: '⭐', descripcion: 'Siempre puntual' },
    MUY_BUENA: { label: 'Muy Buena', emoji: '✅', descripcion: 'Generalmente puntual' },
    BUENA: { label: 'Buena', emoji: '👍', descripcion: 'Ocasionalmente tardío' },
    REGULAR: { label: 'Regular', emoji: '⚠️', descripcion: 'Frecuentemente tardío' },
    NECESITA_MEJORA: { label: 'Necesita Mejora', emoji: '🔴', descripcion: 'Consistentemente tardío' }
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SEMANA_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ============================================
// UTILIDADES DE FECHA Y HORA
// ============================================

/**
 * Obtener fecha actual en zona horaria de Perú
 * @returns {Date} Fecha actual en Lima
 */
exports.getFechaActualPeru = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE_PERU }));
};

/**
 * Formatear fecha para mostrar en interfaz
 * @param {Date|string} fecha - Fecha a formatear
 * @param {string} formato - Formato deseado ('date', 'datetime', 'time', 'relative')
 * @returns {string} Fecha formateada
 */
exports.formatearFecha = (fecha, formato = 'date') => {
    if (!fecha) return '';
    
    const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    if (isNaN(fechaObj.getTime())) return 'Fecha inválida';

    const opciones = {
        timeZone: TIMEZONE_PERU,
        locale: 'es-PE'
    };

    switch (formato) {
        case 'date':
            return fechaObj.toLocaleDateString('es-PE', opciones);
        case 'datetime':
            return fechaObj.toLocaleString('es-PE', opciones);
        case 'time':
            return fechaObj.toLocaleTimeString('es-PE', { 
                ...opciones, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        case 'relative':
            return exports.calcularTiempoRelativo(fechaObj);
        default:
            return fechaObj.toLocaleDateString('es-PE', opciones);
    }
};

/**
 * Calcular tiempo relativo (hace X horas, hace X días)
 * @param {Date} fecha - Fecha a comparar
 * @returns {string} Tiempo relativo
 */
exports.calcularTiempoRelativo = (fecha) => {
    const ahora = exports.getFechaActualPeru();
    const diferencia = ahora.getTime() - new Date(fecha).getTime();
    
    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    
    if (dias > 0) return `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
    if (horas > 0) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
    if (minutos > 0) return `Hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    return 'Ahora mismo';
};

/**
 * Validar si una hora está en horario empresarial
 * @param {number} hora - Hora a validar (0-23)
 * @param {string} tipo - Tipo de validación ('checkin' o 'checkout')
 * @returns {Object} Resultado de validación
 */
exports.validarHorarioEmpresarial = (hora = null, tipo = 'checkin') => {
    const horaActual = hora !== null ? hora : exports.getFechaActualPeru().getHours();
    
    const horarios = {
        checkin: { min: 8, max: 14, optimo_min: 8, optimo_max: 10 },
        checkout: { min: 16, max: 22, optimo_min: 16, optimo_max: 18 }
    };
    
    const config = horarios[tipo];
    
    let estado, mensaje, clase;
    
    if (horaActual < config.min) {
        estado = 'muy_temprano';
        mensaje = `Muy temprano para ${tipo}`;
        clase = 'warning';
    } else if (horaActual > config.max) {
        estado = 'muy_tardio';
        mensaje = `Muy tardío para ${tipo}`;
        clase = 'error';
    } else if (horaActual >= config.optimo_min && horaActual <= config.optimo_max) {
        estado = 'optimo';
        mensaje = `Horario óptimo para ${tipo}`;
        clase = 'success';
    } else {
        estado = 'aceptable';
        mensaje = `Horario aceptable para ${tipo}`;
        clase = 'info';
    }
    
    return {
        hora_actual: horaActual,
        estado: estado,
        mensaje: mensaje,
        clase: clase,
        es_valido: horaActual >= config.min && horaActual <= config.max,
        horario_optimo: `${config.optimo_min}:00 - ${config.optimo_max}:00`,
        horario_permitido: `${config.min}:00 - ${config.max}:00`
    };
};

// ============================================
// CÁLCULOS DE PRODUCTIVIDAD
// ============================================

/**
 * Calcular nivel de productividad basado en actividad total
 * @param {number} totalActividad - Total de mensajes + llamadas
 * @returns {Object} Clasificación de productividad
 */
exports.calcularProductividad = (totalActividad) => {
    for (const [nivel, config] of Object.entries(CLASIFICACIONES_PRODUCTIVIDAD)) {
        if (totalActividad >= config.min && totalActividad <= config.max) {
            return {
                nivel: nivel,
                label: config.label,
                color: config.color,
                emoji: config.emoji,
                valor: totalActividad,
                porcentaje: Math.min((totalActividad / 100) * 100, 100)
            };
        }
    }
    
    return {
        nivel: 'MUY_ALTA',
        label: 'Muy Alta',
        color: '#22c55e',
        emoji: '🚀',
        valor: totalActividad,
        porcentaje: 100
    };
};

/**
 * Calcular puntualidad basada en check-ins del período
 * @param {Array} checkIns - Array de fechas de check-in
 * @returns {Object} Análisis de puntualidad
 */
exports.calcularPuntualidad = (checkIns) => {
    if (!checkIns || checkIns.length === 0) {
        return {
            clasificacion: CLASIFICACIONES_PUNTUALIDAD.NECESITA_MEJORA,
            porcentaje: 0,
            detalles: {
                puntuales: 0,
                tardios: 0,
                total: 0
            }
        };
    }
    
    const analisis = checkIns.reduce((acc, checkIn) => {
        const hora = new Date(checkIn).getHours();
        if (hora <= 10) {
            acc.puntuales++;
        } else {
            acc.tardios++;
        }
        acc.total++;
        return acc;
    }, { puntuales: 0, tardios: 0, total: 0 });
    
    const porcentajePuntualidad = (analisis.puntuales / analisis.total) * 100;
    
    let clasificacion;
    if (porcentajePuntualidad >= 90) clasificacion = CLASIFICACIONES_PUNTUALIDAD.EXCELENTE;
    else if (porcentajePuntualidad >= 75) clasificacion = CLASIFICACIONES_PUNTUALIDAD.MUY_BUENA;
    else if (porcentajePuntualidad >= 60) clasificacion = CLASIFICACIONES_PUNTUALIDAD.BUENA;
    else if (porcentajePuntualidad >= 40) clasificacion = CLASIFICACIONES_PUNTUALIDAD.REGULAR;
    else clasificacion = CLASIFICACIONES_PUNTUALIDAD.NECESITA_MEJORA;
    
    return {
        clasificacion: clasificacion,
        porcentaje: Math.round(porcentajePuntualidad),
        detalles: analisis
    };
};

/**
 * Calcular ratio de proactividad (llamadas realizadas vs recibidas)
 * @param {number} realizadas - Llamadas realizadas
 * @param {number} recibidas - Llamadas recibidas
 * @returns {Object} Análisis de proactividad
 */
exports.calcularProactividad = (realizadas = 0, recibidas = 0) => {
    const total = realizadas + recibidas;
    
    if (total === 0) {
        return {
            ratio: 0,
            clasificacion: 'sin_datos',
            descripcion: 'No hay actividad telefónica',
            recomendacion: 'Incluye llamadas en tu jornada',
            emoji: '📞'
        };
    }
    
    const ratio = realizadas / total;
    let clasificacion, descripcion, recomendacion, emoji;
    
    if (ratio >= 0.8) {
        clasificacion = 'muy_proactivo';
        descripcion = 'Muy proactivo';
        recomendacion = 'Excelente nivel de proactividad';
        emoji = '🚀';
    } else if (ratio >= 0.6) {
        clasificacion = 'proactivo';
        descripcion = 'Proactivo';
        recomendacion = 'Buen balance de llamadas';
        emoji = '📈';
    } else if (ratio >= 0.4) {
        clasificacion = 'equilibrado';
        descripcion = 'Equilibrado';
        recomendacion = 'Considera aumentar llamadas salientes';
        emoji = '⚖️';
    } else {
        clasificacion = 'reactivo';
        descripcion = 'Reactivo';
        recomendacion = 'Incrementa llamadas proactivas';
        emoji = '📉';
    }
    
    return {
        ratio: Math.round(ratio * 100),
        clasificacion: clasificacion,
        descripcion: descripcion,
        recomendacion: recomendacion,
        emoji: emoji,
        detalles: {
            realizadas: realizadas,
            recibidas: recibidas,
            total: total
        }
    };
};

// ============================================
// ANÁLISIS DE CANALES DE COMUNICACIÓN
// ============================================

/**
 * Analizar distribución de mensajes por canal
 * @param {Object} mensajes - Objeto con mensajes por canal
 * @returns {Object} Análisis de distribución
 */
exports.analizarDistribucionCanales = (mensajes) => {
    const canales = {
        meta: mensajes.mensajes_meta || 0,
        whatsapp: mensajes.mensajes_whatsapp || 0,
        instagram: mensajes.mensajes_instagram || 0,
        tiktok: mensajes.mensajes_tiktok || 0
    };
    
    const total = Object.values(canales).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) {
        return {
            canal_principal: 'ninguno',
            distribucion: canales,
            porcentajes: { meta: 0, whatsapp: 0, instagram: 0, tiktok: 0 },
            diversificacion: 'sin_datos',
            recomendaciones: ['Registra mensajes recibidos por cada canal']
        };
    }
    
    // Calcular porcentajes
    const porcentajes = {};
    Object.keys(canales).forEach(canal => {
        porcentajes[canal] = Math.round((canales[canal] / total) * 100);
    });
    
    // Identificar canal principal
    const canalPrincipal = Object.keys(canales).reduce((a, b) => 
        canales[a] > canales[b] ? a : b
    );
    
    // Evaluar diversificación
    const canalesActivos = Object.values(canales).filter(val => val > 0).length;
    const concentracion = Math.max(...Object.values(porcentajes));
    
    let diversificacion, recomendaciones = [];
    
    if (canalesActivos === 1) {
        diversificacion = 'mono_canal';
        recomendaciones.push('Diversifica en otros canales de comunicación');
    } else if (concentracion > 80) {
        diversificacion = 'concentrada';
        recomendaciones.push('Un canal domina tus comunicaciones, considera equilibrar');
    } else if (concentracion > 60) {
        diversificacion = 'moderada';
        recomendaciones.push('Buena distribución, mantén el equilibrio');
    } else {
        diversificacion = 'equilibrada';
        recomendaciones.push('Excelente diversificación de canales');
    }
    
    return {
        canal_principal: canalPrincipal,
        distribucion: canales,
        porcentajes: porcentajes,
        diversificacion: diversificacion,
        canales_activos: canalesActivos,
        total_mensajes: total,
        recomendaciones: recomendaciones
    };
};

// ============================================
// GENERADORES DE REPORTES
// ============================================

/**
 * Generar reporte de rendimiento individual
 * @param {Object} datosActividad - Datos de actividad del usuario
 * @returns {Object} Reporte de rendimiento
 */
exports.generarReporteRendimiento = (datosActividad) => {
    const {
        dias_trabajados = 0,
        total_mensajes = 0,
        total_llamadas = 0,
        promedio_horas = 0,
        check_ins = []
    } = datosActividad;
    
    const totalActividad = total_mensajes + total_llamadas;
    const productividad = exports.calcularProductividad(totalActividad);
    const puntualidad = exports.calcularPuntualidad(check_ins);
    
    // Calcular score general
    const scoreProductividad = Math.min((totalActividad / 50) * 30, 30); // Max 30 puntos
    const scorePuntualidad = (puntualidad.porcentaje / 100) * 25; // Max 25 puntos
    const scoreAsistencia = Math.min((dias_trabajados / 5) * 25, 25); // Max 25 puntos
    const scoreHoras = Math.min((promedio_horas / 8) * 20, 20); // Max 20 puntos
    
    const scoreTotal = scoreProductividad + scorePuntualidad + scoreAsistencia + scoreHoras;
    
    let clasificacionGeneral;
    if (scoreTotal >= 85) clasificacionGeneral = { nivel: 'Excelente', color: '#22c55e' };
    else if (scoreTotal >= 70) clasificacionGeneral = { nivel: 'Muy Bueno', color: '#3b82f6' };
    else if (scoreTotal >= 55) clasificacionGeneral = { nivel: 'Bueno', color: '#f59e0b' };
    else if (scoreTotal >= 40) clasificacionGeneral = { nivel: 'Regular', color: '#f97316' };
    else clasificacionGeneral = { nivel: 'Necesita Mejora', color: '#ef4444' };
    
    return {
        score_total: Math.round(scoreTotal),
        clasificacion_general: clasificacionGeneral,
        metricas: {
            productividad: productividad,
            puntualidad: puntualidad,
            asistencia: {
                dias_trabajados: dias_trabajados,
                porcentaje: Math.min((dias_trabajados / 5) * 100, 100)
            },
            dedicacion: {
                promedio_horas: promedio_horas,
                porcentaje: Math.min((promedio_horas / 8) * 100, 100)
            }
        },
        recomendaciones: exports.generarRecomendacionesPersonalizadas(datosActividad),
        fecha_reporte: exports.formatearFecha(new Date(), 'datetime')
    };
};

/**
 * Generar recomendaciones personalizadas
 * @param {Object} datosActividad - Datos de actividad
 * @returns {Array} Array de recomendaciones
 */
exports.generarRecomendacionesPersonalizadas = (datosActividad) => {
    const recomendaciones = [];
    const {
        total_mensajes = 0,
        total_llamadas = 0,
        promedio_horas = 0,
        check_ins = []
    } = datosActividad;
    
    // Análisis de actividad
    if (total_mensajes + total_llamadas < 20) {
        recomendaciones.push({
            tipo: 'productividad',
            mensaje: 'Incrementa tu actividad diaria para mejorar resultados',
            prioridad: 'alta',
            emoji: '📈'
        });
    }
    
    // Análisis de balance
    if (total_llamadas === 0 && total_mensajes > 10) {
        recomendaciones.push({
            tipo: 'balance',
            mensaje: 'Incluye llamadas telefónicas para mejor conversión',
            prioridad: 'media',
            emoji: '📞'
        });
    }
    
    // Análisis de horarios
    const puntualidad = exports.calcularPuntualidad(check_ins);
    if (puntualidad.porcentaje < 60) {
        recomendaciones.push({
            tipo: 'puntualidad',
            mensaje: 'Mejora tu puntualidad llegando antes de las 10:00 AM',
            prioridad: 'alta',
            emoji: '⏰'
        });
    }
    
    // Análisis de dedicación
    if (promedio_horas < 6) {
        recomendaciones.push({
            tipo: 'dedicacion',
            mensaje: 'Considera extender tu jornada laboral',
            prioridad: 'media',
            emoji: '💪'
        });
    }
    
    // Recomendación positiva si todo está bien
    if (recomendaciones.length === 0) {
        recomendaciones.push({
            tipo: 'felicitacion',
            mensaje: '¡Excelente trabajo! Mantén este nivel de rendimiento',
            prioridad: 'info',
            emoji: '🎉'
        });
    }
    
    return recomendaciones;
};

// ============================================
// COMPARATIVAS DE EQUIPO
// ============================================

/**
 * Generar comparativa de rendimiento de equipo
 * @param {Array} miembrosEquipo - Array de datos de miembros
 * @returns {Object} Comparativa de equipo
 */
exports.generarComparativaEquipo = (miembrosEquipo) => {
    if (!miembrosEquipo || miembrosEquipo.length === 0) {
        return {
            error: 'No hay datos de equipo para analizar'
        };
    }
    
    // Calcular métricas del equipo
    const totalMiembros = miembrosEquipo.length;
    const promedios = {
        productividad: 0,
        puntualidad: 0,
        horas: 0,
        mensajes: 0,
        llamadas: 0
    };
    
    miembrosEquipo.forEach(miembro => {
        promedios.productividad += miembro.metricas?.promedio_actividad || 0;
        promedios.puntualidad += miembro.metricas?.tasa_puntualidad || 0;
        promedios.horas += miembro.metricas?.promedio_horas || 0;
        promedios.mensajes += miembro.metricas?.total_mensajes || 0;
        promedios.llamadas += miembro.metricas?.total_llamadas || 0;
    });
    
    Object.keys(promedios).forEach(key => {
        promedios[key] = promedios[key] / totalMiembros;
    });
    
    // Identificar top performers
    const topPerformers = miembrosEquipo
        .sort((a, b) => (b.metricas?.promedio_actividad || 0) - (a.metricas?.promedio_actividad || 0))
        .slice(0, 3);
    
    // Identificar necesidades de mejora
    const necesitanMejora = miembrosEquipo
        .filter(m => (m.metricas?.promedio_actividad || 0) < promedios.productividad * 0.7)
        .sort((a, b) => (a.metricas?.promedio_actividad || 0) - (b.metricas?.promedio_actividad || 0));
    
    return {
        resumen_equipo: {
            total_miembros: totalMiembros,
            promedios: promedios,
            rendimiento_general: exports.clasificarRendimientoEquipo(promedios)
        },
        top_performers: topPerformers.map(m => ({
            usuario: m.usuario,
            metricas_destacadas: m.metricas
        })),
        necesitan_mejora: necesitanMejora.map(m => ({
            usuario: m.usuario,
            areas_mejora: exports.identificarAreasMejora(m.metricas)
        })),
        recomendaciones_gerenciales: exports.generarRecomendacionesGerenciales(miembrosEquipo, promedios)
    };
};

/**
 * Clasificar rendimiento general del equipo
 */
exports.clasificarRendimientoEquipo = (promedios) => {
    const score = (
        (promedios.productividad / 50 * 40) +
        (promedios.puntualidad / 100 * 30) +
        (promedios.horas / 8 * 30)
    );
    
    if (score >= 80) return { nivel: 'Excelente', emoji: '🏆' };
    if (score >= 65) return { nivel: 'Muy Bueno', emoji: '🥈' };
    if (score >= 50) return { nivel: 'Bueno', emoji: '👍' };
    if (score >= 35) return { nivel: 'Regular', emoji: '⚠️' };
    return { nivel: 'Necesita Mejora', emoji: '🔴' };
};

/**
 * Identificar áreas de mejora para un miembro
 */
exports.identificarAreasMejora = (metricas) => {
    const areas = [];
    
    if ((metricas?.promedio_actividad || 0) < 20) {
        areas.push('Incrementar actividad diaria');
    }
    if ((metricas?.tasa_puntualidad || 0) < 70) {
        areas.push('Mejorar puntualidad');
    }
    if ((metricas?.promedio_horas || 0) < 6) {
        areas.push('Aumentar dedicación horaria');
    }
    if ((metricas?.total_llamadas || 0) === 0) {
        areas.push('Incluir actividad telefónica');
    }
    
    return areas;
};

/**
 * Generar recomendaciones gerenciales
 */
exports.generarRecomendacionesGerenciales = (miembrosEquipo, promedios) => {
    const recomendaciones = [];
    
    const bajaProductividad = miembrosEquipo.filter(m => 
        (m.metricas?.promedio_actividad || 0) < promedios.productividad * 0.6
    ).length;
    
    if (bajaProductividad > miembrosEquipo.length * 0.3) {
        recomendaciones.push('Implementar capacitación en productividad para el equipo');
    }
    
    const bajaPuntualidad = miembrosEquipo.filter(m => 
        (m.metricas?.tasa_puntualidad || 0) < 70
    ).length;
    
    if (bajaPuntualidad > miembrosEquipo.length * 0.2) {
        recomendaciones.push('Reforzar políticas de puntualidad');
    }
    
    if (promedios.llamadas < 5) {
        recomendaciones.push('Fomentar mayor actividad telefónica en el equipo');
    }
    
    return recomendaciones;
};

// ============================================
// UTILIDADES DE FORMATEO
// ============================================

/**
 * Formatear números para mostrar en interfaz
 */
exports.formatearNumero = (numero, decimales = 0) => {
    if (isNaN(numero)) return '0';
    return Number(numero).toLocaleString('es-PE', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
};

/**
 * Formatear porcentaje
 */
exports.formatearPorcentaje = (valor, decimales = 1) => {
    if (isNaN(valor)) return '0%';
    return `${Number(valor).toFixed(decimales)}%`;
};

/**
 * Formatear duración en horas
 */
exports.formatearDuracion = (horas) => {
    if (isNaN(horas)) return '0h 0m';
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    return `${h}h ${m}m`;
};

console.log('✅ ActividadHelpers loaded successfully - Enterprise utilities ready');
console.log('🔧 Utilities: Date/time, Productivity calculations, Team comparisons');
console.log('📊 Features: Performance reports, Smart recommendations, Channel analysis');
console.log('🎯 Business logic: Proactivity ratios, Punctuality tracking, Team insights\n');

module.exports = exports;