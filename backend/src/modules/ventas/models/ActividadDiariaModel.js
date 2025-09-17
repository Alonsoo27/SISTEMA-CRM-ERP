// ============================================
// ACTIVIDAD DIARIA MODEL - VALIDACIONES EMPRESARIALES
// Esquemas de datos y reglas de negocio para actividad diaria
// ============================================

// ============================================
// ESQUEMAS DE VALIDACIÓN EMPRESARIAL
// ============================================

/**
 * Esquema para validación de check-in
 */
const SCHEMA_CHECKIN = {
    mensajes_meta: {
        required: false,
        type: 'integer',
        min: 0,
        max: 1000,
        default: 0
    },
    mensajes_whatsapp: {
        required: false,
        type: 'integer',
        min: 0,
        max: 1000,
        default: 0
    },
    mensajes_instagram: {
        required: false,
        type: 'integer',
        min: 0,
        max: 1000,
        default: 0
    },
    mensajes_tiktok: {
        required: false,
        type: 'integer',
        min: 0,
        max: 1000,
        default: 0
    },
    notas_check_in: {
        required: false,
        type: 'string',
        maxLength: 500,
        default: ''
    }
};

/**
 * Esquema para validación de check-out
 */
const SCHEMA_CHECKOUT = {
    llamadas_realizadas: {
        required: false,
        type: 'integer',
        min: 0,
        max: 200,
        default: 0
    },
    llamadas_recibidas: {
        required: false,
        type: 'integer',
        min: 0,
        max: 200,
        default: 0
    },
    notas_check_out: {
        required: false,
        type: 'string',
        maxLength: 500,
        default: ''
    }
};

/**
 * Estados válidos de jornada
 */
const ESTADOS_JORNADA = [
    'sin_iniciar',
    'en_progreso', 
    'finalizada',
    'incompleta'
];

/**
 * Horarios empresariales
 */
const HORARIOS_EMPRESARIALES = {
    check_in: {
        hora_minima: 6,      // 6:00 AM (permitir muy temprano)
        hora_optima_inicio: 8,  // 8:00 AM (horario óptimo)
        hora_optima_fin: 10,    // 10:00 AM (hasta aquí es puntual)
        hora_maxima: 14      // 2:00 PM (límite absoluto)
    },
    check_out: {
        hora_minima: 14,     // 2:00 PM (mínimo para jornada parcial)
        hora_optima_inicio: 16, // 4:00 PM (horario estándar)
        hora_optima_fin: 18,    // 6:00 PM (horario estándar)
        hora_maxima: 22      // 10:00 PM (permitir trabajo extra)
    }
};

/**
 * Límites de productividad empresarial
 */
const LIMITES_PRODUCTIVIDAD = {
    mensajes: {
        bajo: 10,
        medio: 30,
        alto: 60,
        muy_alto: 100
    },
    llamadas: {
        bajo: 3,
        medio: 8,
        alto: 15,
        muy_alto: 25
    },
    jornada_horas: {
        minimo: 4,
        parcial: 6,
        completo: 8,
        extra: 10
    }
};

// ============================================
// FUNCIONES DE VALIDACIÓN PRINCIPALES
// ============================================

/**
 * Validar datos de check-in
 * @param {Object} data - Datos del check-in
 * @returns {Object} Resultado de validación
 */
exports.validateCheckIn = (data) => {
    const errors = [];
    const warnings = [];
    const sanitizedData = {};

    // Validar cada campo según el esquema
    for (const [field, rules] of Object.entries(SCHEMA_CHECKIN)) {
        const value = data[field];
        const validation = validateField(field, value, rules);
        
        if (!validation.isValid) {
            errors.push(...validation.errors);
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
            warnings.push(...validation.warnings);
        }
        
        sanitizedData[field] = validation.sanitizedValue;
    }

    // Validaciones empresariales específicas
    const businessValidation = validateBusinessRulesCheckIn(sanitizedData);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);

    // Validar horario empresarial
    const timeValidation = validateCheckInTime();
    if (!timeValidation.isValid) {
        errors.push(...timeValidation.errors);
    }
    warnings.push(...timeValidation.warnings);

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        sanitizedData: sanitizedData,
        businessInsights: generateCheckInInsights(sanitizedData)
    };
};

/**
 * Validar datos de check-out
 * @param {Object} data - Datos del check-out
 * @returns {Object} Resultado de validación
 */
exports.validateCheckOut = (data) => {
    const errors = [];
    const warnings = [];
    const sanitizedData = {};

    // Validar cada campo según el esquema
    for (const [field, rules] of Object.entries(SCHEMA_CHECKOUT)) {
        const value = data[field];
        const validation = validateField(field, value, rules);
        
        if (!validation.isValid) {
            errors.push(...validation.errors);
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
            warnings.push(...validation.warnings);
        }
        
        sanitizedData[field] = validation.sanitizedValue;
    }

    // Validaciones empresariales específicas
    const businessValidation = validateBusinessRulesCheckOut(sanitizedData);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);

    // Validar horario empresarial
    const timeValidation = validateCheckOutTime();
    if (!timeValidation.isValid) {
        warnings.push(...timeValidation.warnings); // Check-out más flexible
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        sanitizedData: sanitizedData,
        businessInsights: generateCheckOutInsights(sanitizedData)
    };
};

/**
 * Validar estado de jornada
 * @param {string} estado - Estado a validar
 * @returns {Object} Resultado de validación
 */
exports.validateEstadoJornada = (estado) => {
    const isValid = ESTADOS_JORNADA.includes(estado);
    
    return {
        isValid: isValid,
        errors: isValid ? [] : [`Estado de jornada inválido. Estados permitidos: ${ESTADOS_JORNADA.join(', ')}`],
        warnings: [],
        estadosPermitidos: ESTADOS_JORNADA
    };
};

/**
 * Validar transición de estados
 * @param {string} estadoActual - Estado actual
 * @param {string} nuevoEstado - Nuevo estado
 * @returns {Object} Resultado de validación
 */
exports.validateTransicionEstado = (estadoActual, nuevoEstado) => {
    const transicionesValidas = {
        'sin_iniciar': ['en_progreso'],
        'en_progreso': ['finalizada', 'incompleta'],
        'finalizada': [], // No se puede cambiar desde finalizada
        'incompleta': ['en_progreso', 'finalizada']
    };

    const transicionesPermitidas = transicionesValidas[estadoActual] || [];
    const isValid = transicionesPermitidas.includes(nuevoEstado);

    return {
        isValid: isValid,
        errors: isValid ? [] : [`Transición no válida de "${estadoActual}" a "${nuevoEstado}"`],
        warnings: [],
        transicionesPermitidas: transicionesPermitidas
    };
};

// ============================================
// FUNCIONES DE VALIDACIÓN AUXILIARES
// ============================================

/**
 * Validar un campo individual
 * @param {string} fieldName - Nombre del campo
 * @param {any} value - Valor a validar
 * @param {Object} rules - Reglas de validación
 * @returns {Object} Resultado de validación
 */
const validateField = (fieldName, value, rules) => {
    const errors = [];
    const warnings = [];
    let sanitizedValue = value;

    // Aplicar valor por defecto si no se proporciona
    if (value === undefined || value === null || value === '') {
        sanitizedValue = rules.default;
    }

    // Validar campo requerido
    if (rules.required && (sanitizedValue === undefined || sanitizedValue === null || sanitizedValue === '')) {
        errors.push(`${fieldName} es requerido`);
        return { isValid: false, errors, warnings, sanitizedValue: rules.default };
    }

    // Validar tipo de dato
    if (sanitizedValue !== undefined && sanitizedValue !== null && sanitizedValue !== '') {
        switch (rules.type) {
            case 'integer':
                sanitizedValue = parseInt(sanitizedValue);
                if (isNaN(sanitizedValue)) {
                    errors.push(`${fieldName} debe ser un número entero`);
                }
                break;
            case 'string':
                sanitizedValue = String(sanitizedValue).trim();
                break;
        }
    }

    // Validar rangos numéricos
    if (rules.type === 'integer' && !isNaN(sanitizedValue)) {
        if (rules.min !== undefined && sanitizedValue < rules.min) {
            errors.push(`${fieldName} debe ser mayor o igual a ${rules.min}`);
        }
        if (rules.max !== undefined && sanitizedValue > rules.max) {
            errors.push(`${fieldName} debe ser menor o igual a ${rules.max}`);
        }

        // Generar advertencias para valores atípicos
        if (rules.max !== undefined && sanitizedValue > (rules.max * 0.8)) {
            warnings.push(`${fieldName} tiene un valor alto (${sanitizedValue})`);
        }
    }

    // Validar longitud de string
    if (rules.type === 'string' && sanitizedValue) {
        if (rules.maxLength !== undefined && sanitizedValue.length > rules.maxLength) {
            errors.push(`${fieldName} no debe exceder ${rules.maxLength} caracteres`);
            sanitizedValue = sanitizedValue.substring(0, rules.maxLength);
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        sanitizedValue: sanitizedValue
    };
};

/**
 * Validaciones empresariales específicas para check-in
 * @param {Object} data - Datos sanitizados
 * @returns {Object} Resultado de validación
 */
const validateBusinessRulesCheckIn = (data) => {
    const errors = [];
    const warnings = [];

    const totalMensajes = (data.mensajes_meta || 0) + (data.mensajes_whatsapp || 0) + 
                         (data.mensajes_instagram || 0) + (data.mensajes_tiktok || 0);

    // Regla empresarial: Alertar si no hay actividad de mensajes
    if (totalMensajes === 0) {
        warnings.push('No se registraron mensajes recibidos. ¿Es correcto?');
    }

    // Regla empresarial: Alertar sobre distribución desbalanceada
    const maxMensajes = Math.max(data.mensajes_meta || 0, data.mensajes_whatsapp || 0, 
                                data.mensajes_instagram || 0, data.mensajes_tiktok || 0);
    
    if (maxMensajes > totalMensajes * 0.8 && totalMensajes > 10) {
        warnings.push('Un canal concentra la mayoría de mensajes. Considera diversificar.');
    }

    // Regla empresarial: Volumen muy alto de mensajes
    if (totalMensajes > LIMITES_PRODUCTIVIDAD.mensajes.muy_alto) {
        warnings.push(`Volumen muy alto de mensajes (${totalMensajes}). Prioriza respuestas importantes.`);
    }

    return { errors, warnings };
};

/**
 * Validaciones empresariales específicas para check-out
 * @param {Object} data - Datos sanitizados
 * @returns {Object} Resultado de validación
 */
const validateBusinessRulesCheckOut = (data) => {
    const errors = [];
    const warnings = [];

    const totalLlamadas = (data.llamadas_realizadas || 0) + (data.llamadas_recibidas || 0);

    // Regla empresarial: Validar actividad telefónica
    if (totalLlamadas === 0) {
        warnings.push('No se registraron llamadas. Considera incluir actividad telefónica en tu jornada.');
    }

    // Regla empresarial: Desbalance en llamadas
    const llamadasRealizadas = data.llamadas_realizadas || 0;
    const llamadasRecibidas = data.llamadas_recibidas || 0;
    
    if (llamadasRecibidas > llamadasRealizadas * 3 && llamadasRealizadas > 0) {
        warnings.push('Recibes muchas más llamadas de las que realizas. Considera ser más proactivo.');
    }

    // Regla empresarial: Productividad telefónica muy alta
    if (totalLlamadas > LIMITES_PRODUCTIVIDAD.llamadas.muy_alto) {
        warnings.push(`Actividad telefónica muy alta (${totalLlamadas}). Excelente trabajo!`);
    }

    return { errors, warnings };
};

/**
 * Validar horario de check-in
 * @returns {Object} Resultado de validación
 */
const validateCheckInTime = () => {
    const horaActual = new Date().getHours();
    const horarios = HORARIOS_EMPRESARIALES.check_in;
    const errors = [];
    const warnings = [];

    // Permitir bypass en desarrollo (opcional)
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SCHEDULE_VALIDATION === 'true') {
        warnings.push('Validación de horario deshabilitada en desarrollo');
        return {
            isValid: true,
            errors: [],
            warnings: warnings,
            horaActual: horaActual,
            horarioOptimo: `${horarios.hora_optima_inicio}:00 - ${horarios.hora_optima_fin}:00`,
            horarioPermitido: `${horarios.hora_minima}:00 - ${horarios.hora_maxima}:00`
        };
    }

    // Validación de horarios empresariales
    if (horaActual < horarios.hora_minima) {
        errors.push(`Check-in muy temprano (${horaActual}:00). Horario permitido: ${horarios.hora_minima}:00 - ${horarios.hora_maxima}:00`);
    } else if (horaActual > horarios.hora_maxima) {
        errors.push(`Check-in muy tardío (${horaActual}:00). Horario permitido: ${horarios.hora_minima}:00 - ${horarios.hora_maxima}:00`);
    } else {
        // Generar advertencias por puntualidad
        if (horaActual > horarios.hora_optima_fin) {
            warnings.push(`Check-in tardío (${horaActual}:00). Horario óptimo: ${horarios.hora_optima_inicio}:00 - ${horarios.hora_optima_fin}:00`);
        } else if (horaActual < horarios.hora_optima_inicio) {
            warnings.push(`Check-in temprano (${horaActual}:00). Horario óptimo: ${horarios.hora_optima_inicio}:00 - ${horarios.hora_optima_fin}:00`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        horaActual: horaActual,
        horarioOptimo: `${horarios.hora_optima_inicio}:00 - ${horarios.hora_optima_fin}:00`,
        horarioPermitido: `${horarios.hora_minima}:00 - ${horarios.hora_maxima}:00`
    };
};

/**
 * Validar horario de check-out
 * @returns {Object} Resultado de validación
 */
const validateCheckOutTime = () => {
    const horaActual = new Date().getHours();
    const horarios = HORARIOS_EMPRESARIALES.check_out;
    const errors = [];
    const warnings = [];

    // Permitir bypass en desarrollo (opcional)
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SCHEDULE_VALIDATION === 'true') {
        warnings.push('Validación de horario deshabilitada en desarrollo');
        return {
            isValid: true,
            errors: [],
            warnings: warnings,
            horaActual: horaActual,
            horarioOptimo: `${horarios.hora_optima_inicio}:00 - ${horarios.hora_optima_fin}:00`
        };
    }

    // Check-out es más flexible que check-in
    if (horaActual < horarios.hora_minima) {
        warnings.push(`Check-out muy temprano (${horaActual}:00). Considera trabajar hasta las ${horarios.hora_optima_inicio}:00`);
    } else if (horaActual > horarios.hora_maxima) {
        warnings.push(`Check-out muy tardío (${horaActual}:00). Considera descansar.`);
    } else if (horaActual >= horarios.hora_optima_inicio && horaActual <= horarios.hora_optima_fin) {
        // Horario óptimo, no hay advertencias
    }

    return {
        isValid: true, // Check-out es más flexible
        errors: errors,
        warnings: warnings,
        horaActual: horaActual,
        horarioOptimo: `${horarios.hora_optima_inicio}:00 - ${horarios.hora_optima_fin}:00`
    };
};

// ============================================
// GENERADORES DE INSIGHTS EMPRESARIALES
// ============================================

/**
 * Generar insights para check-in
 * @param {Object} data - Datos del check-in
 * @returns {Object} Insights empresariales
 */
const generateCheckInInsights = (data) => {
    const totalMensajes = (data.mensajes_meta || 0) + (data.mensajes_whatsapp || 0) + 
                         (data.mensajes_instagram || 0) + (data.mensajes_tiktok || 0);
    
    const insights = {
        nivel_actividad: classifyActivityLevel(totalMensajes, 'mensajes'),
        canal_principal: identifyMainChannel(data),
        recomendaciones: generateCheckInRecommendations(data, totalMensajes),
        metricas: {
            total_mensajes: totalMensajes,
            distribucion_canales: {
                meta: ((data.mensajes_meta || 0) / Math.max(totalMensajes, 1) * 100).toFixed(1),
                whatsapp: ((data.mensajes_whatsapp || 0) / Math.max(totalMensajes, 1) * 100).toFixed(1),
                instagram: ((data.mensajes_instagram || 0) / Math.max(totalMensajes, 1) * 100).toFixed(1),
                tiktok: ((data.mensajes_tiktok || 0) / Math.max(totalMensajes, 1) * 100).toFixed(1)
            }
        }
    };

    return insights;
};

/**
 * Generar insights para check-out
 * @param {Object} data - Datos del check-out
 * @returns {Object} Insights empresariales
 */
const generateCheckOutInsights = (data) => {
    const totalLlamadas = (data.llamadas_realizadas || 0) + (data.llamadas_recibidas || 0);
    
    const insights = {
        nivel_actividad_telefonica: classifyActivityLevel(totalLlamadas, 'llamadas'),
        ratio_proactividad: calculateProactivityRatio(data),
        recomendaciones: generateCheckOutRecommendations(data, totalLlamadas),
        metricas: {
            total_llamadas: totalLlamadas,
            distribucion_llamadas: {
                realizadas: ((data.llamadas_realizadas || 0) / Math.max(totalLlamadas, 1) * 100).toFixed(1),
                recibidas: ((data.llamadas_recibidas || 0) / Math.max(totalLlamadas, 1) * 100).toFixed(1)
            },
            eficiencia_telefonica: totalLlamadas > 0 ? 'activo' : 'pasivo'
        }
    };

    return insights;
};

// ============================================
// FUNCIONES AUXILIARES DE CLASIFICACIÓN
// ============================================

/**
 * Clasificar nivel de actividad
 */
const classifyActivityLevel = (cantidad, tipo) => {
    const limites = LIMITES_PRODUCTIVIDAD[tipo];
    
    if (cantidad >= limites.muy_alto) return 'muy_alto';
    if (cantidad >= limites.alto) return 'alto';
    if (cantidad >= limites.medio) return 'medio';
    if (cantidad >= limites.bajo) return 'bajo';
    return 'sin_actividad';
};

/**
 * Identificar canal principal
 */
const identifyMainChannel = (data) => {
    const canales = {
        meta: data.mensajes_meta || 0,
        whatsapp: data.mensajes_whatsapp || 0,
        instagram: data.mensajes_instagram || 0,
        tiktok: data.mensajes_tiktok || 0
    };

    return Object.keys(canales).reduce((a, b) => canales[a] > canales[b] ? a : b);
};

/**
 * Calcular ratio de proactividad
 */
const calculateProactivityRatio = (data) => {
    const realizadas = data.llamadas_realizadas || 0;
    const recibidas = data.llamadas_recibidas || 0;
    const total = realizadas + recibidas;

    if (total === 0) return 'sin_datos';
    
    const ratio = realizadas / total;
    if (ratio >= 0.7) return 'muy_proactivo';
    if (ratio >= 0.5) return 'proactivo';
    if (ratio >= 0.3) return 'equilibrado';
    return 'reactivo';
};

/**
 * Generar recomendaciones para check-in
 */
const generateCheckInRecommendations = (data, totalMensajes) => {
    const recomendaciones = [];

    if (totalMensajes === 0) {
        recomendaciones.push('Revisa todas las plataformas para mensajes pendientes');
    } else if (totalMensajes > 50) {
        recomendaciones.push('Alto volumen de mensajes: prioriza los más importantes');
    }

    const whatsappPct = ((data.mensajes_whatsapp || 0) / Math.max(totalMensajes, 1));
    if (whatsappPct > 0.8) {
        recomendaciones.push('Considera revisar otros canales además de WhatsApp');
    }

    return recomendaciones;
};

/**
 * Generar recomendaciones para check-out
 */
const generateCheckOutRecommendations = (data, totalLlamadas) => {
    const recomendaciones = [];

    if (totalLlamadas === 0) {
        recomendaciones.push('Incluye actividad telefónica en tu próxima jornada');
    } else if ((data.llamadas_realizadas || 0) === 0) {
        recomendaciones.push('Considera hacer llamadas proactivas para mejor conversión');
    }

    const ratio = (data.llamadas_realizadas || 0) / Math.max(totalLlamadas, 1);
    if (ratio < 0.3) {
        recomendaciones.push('Incrementa llamadas salientes para mayor proactividad');
    }

    return recomendaciones;
};

// ============================================
// UTILIDADES EXPORTADAS
// ============================================

/**
 * Obtener configuración de horarios empresariales
 */
exports.getHorariosEmpresariales = () => {
    return HORARIOS_EMPRESARIALES;
};

/**
 * Obtener límites de productividad
 */
exports.getLimitesProductividad = () => {
    return LIMITES_PRODUCTIVIDAD;
};

/**
 * Obtener estados válidos de jornada
 */
exports.getEstadosValidos = () => {
    return ESTADOS_JORNADA;
};

/**
 * Validar datos completos de actividad diaria
 */
exports.validateActividadCompleta = (checkInData, checkOutData) => {
    const checkInValidation = exports.validateCheckIn(checkInData);
    const checkOutValidation = exports.validateCheckOut(checkOutData);

    return {
        isValid: checkInValidation.isValid && checkOutValidation.isValid,
        checkIn: checkInValidation,
        checkOut: checkOutValidation,
        consolidatedErrors: [...checkInValidation.errors, ...checkOutValidation.errors],
        consolidatedWarnings: [...checkInValidation.warnings, ...checkOutValidation.warnings]
    };
};

console.log('✅ ActividadDiariaModel loaded successfully - Enterprise validation system ready');
console.log('🔧 Validation schemas: Check-in, Check-out, Estado transitions');
console.log('📊 Business rules: Productivity limits, Schedule validation, Activity insights');
console.log('⚡ Features: Smart validation, Business insights, Proactivity analysis');

// Mostrar configuración de validación de horarios
if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SCHEDULE_VALIDATION === 'true') {
    console.log('⚠️  DEVELOPMENT MODE: Schedule validation bypassed');
} else {
    console.log('🕐 Business hours enforced: Check-in 6AM-2PM, Check-out 2PM-10PM');
}

console.log('');