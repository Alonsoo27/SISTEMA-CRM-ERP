// =====================================
// HELPERS Y VALIDACIONES DE SOPORTE TÉCNICO
// =====================================
// Funciones auxiliares, validaciones y utilidades para el módulo de soporte

// =====================================
// CONSTANTES Y CONFIGURACIONES
// =====================================

const TIPOS_TICKET = ['CAPACITACION', 'REPARACION', 'MANTENIMIENTO'];
const ESTADOS_TICKET = ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];

const CATEGORIAS_PRODUCTO = ['POR_REPARAR', 'IRREPARABLE', 'IRREPARABLE_REPUESTOS', 'REPARADO'];
const ESTADOS_PRODUCTO = ['RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'REPARADO', 'IRREPARABLE', 'LISTO_ENTREGA', 'ENVIADO_ALMACEN'];
const ORIGENES_PRODUCTO = ['FALLA_FABRICA', 'CLIENTE'];

const TIPOS_PAUSA_VALIDOS = [
    // Pausas justificadas
    'FALTA_REPUESTOS', 'VACACIONES_PERSONAL', 'AUTORIZACION_CLIENTE', 
    'ESPERANDO_PAGO', 'FALLA_HERRAMIENTAS', 'FALTA_ESPACIO_FISICO',
    'CORTES_SERVICIOS', 'PRODUCTO_MAL_DIAGNOSTICADO', 'CLIENTE_CANCELO',
    // Pausas no justificadas
    'OCUPADO_CAPACITACIONES', 'OTROS_PROYECTOS', 'PRODUCTO_EXTRAVIADO',
    'FALTA_CONOCIMIENTO', 'CAMBIO_PRIORIDADES', 'PRODUCTO_DAÑADO_REPARACION',
    'ERROR_DIAGNOSTICO_INICIAL', 'OTRO'
];

const TIPOS_CAPACITACION = ['INSTALACION', 'USO_BASICO', 'MANTENIMIENTO', 'AVANZADA', 'TROUBLESHOOTING'];
const MODALIDADES_CAPACITACION = ['PRESENCIAL', 'VIRTUAL', 'TELEFONICA'];
const ESTADOS_CAPACITACION = ['PENDIENTE', 'PROGRAMADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA', 'REPROGRAMADA'];

// =====================================
// VALIDACIONES DE DATOS DE ENTRADA
// =====================================

const validarDatosSoporte = {
    /**
     * Validar datos para crear ticket
     */
    crearTicket: (datos) => {
        const errores = [];

        // Validaciones obligatorias
        if (!datos.tipo_ticket) {
            errores.push('El tipo de ticket es obligatorio');
        } else if (!TIPOS_TICKET.includes(datos.tipo_ticket)) {
            errores.push(`Tipo de ticket inválido. Debe ser uno de: ${TIPOS_TICKET.join(', ')}`);
        }

        if (!datos.titulo || datos.titulo.trim().length < 5) {
            errores.push('El título debe tener al menos 5 caracteres');
        }

        if (datos.titulo && datos.titulo.length > 255) {
            errores.push('El título no puede exceder 255 caracteres');
        }

        if (!datos.descripcion || datos.descripcion.trim().length < 10) {
            errores.push('La descripción debe tener al menos 10 caracteres');
        }

        // Validaciones opcionales con formato
        if (datos.prioridad && !PRIORIDADES.includes(datos.prioridad)) {
            errores.push(`Prioridad inválida. Debe ser uno de: ${PRIORIDADES.join(', ')}`);
        }

        if (datos.cliente_telefono && !validarTelefono(datos.cliente_telefono)) {
            errores.push('Formato de teléfono inválido');
        }

        if (datos.cliente_email && !validarEmail(datos.cliente_email)) {
            errores.push('Formato de email inválido');
        }

        if (datos.fecha_programada && !validarFecha(datos.fecha_programada)) {
            errores.push('Formato de fecha programada inválido');
        }

        // Validaciones específicas por tipo
        if (datos.tipo_ticket === 'CAPACITACION') {
            if (!datos.cliente_nombre || datos.cliente_nombre.trim().length < 2) {
                errores.push('El nombre del cliente es obligatorio para capacitaciones');
            }
        }

        return {
            valido: errores.length === 0,
            errores
        };
    },

    /**
     * Validar datos para crear producto en soporte
     */
    crearProducto: (datos) => {
        const errores = [];

        // Validaciones obligatorias
        if (!datos.codigo_producto || datos.codigo_producto.trim().length < 1) {
            errores.push('El código del producto es obligatorio');
        }

        if (!datos.descripcion_producto || datos.descripcion_producto.trim().length < 3) {
            errores.push('La descripción del producto es obligatoria');
        }

        if (!datos.categoria || !CATEGORIAS_PRODUCTO.includes(datos.categoria)) {
            errores.push(`Categoría inválida. Debe ser uno de: ${CATEGORIAS_PRODUCTO.join(', ')}`);
        }

        // Validaciones opcionales
        if (datos.estado && !ESTADOS_PRODUCTO.includes(datos.estado)) {
            errores.push(`Estado inválido. Debe ser uno de: ${ESTADOS_PRODUCTO.join(', ')}`);
        }

        if (datos.origen && !ORIGENES_PRODUCTO.includes(datos.origen)) {
            errores.push(`Origen inválido. Debe ser uno de: ${ORIGENES_PRODUCTO.join(', ')}`);
        }

        if (datos.costo_reparacion && (isNaN(datos.costo_reparacion) || datos.costo_reparacion < 0)) {
            errores.push('El costo de reparación debe ser un número positivo');
        }

        return {
            valido: errores.length === 0,
            errores
        };
    },

    /**
     * Validar datos para crear capacitación
     */
    crearCapacitacion: (datos) => {
        const errores = [];

        // Validaciones obligatorias
        if (!datos.cliente_nombre || datos.cliente_nombre.trim().length < 2) {
            errores.push('El nombre del cliente es obligatorio');
        }

        if (!datos.cliente_telefono || !validarTelefono(datos.cliente_telefono)) {
            errores.push('Teléfono de cliente válido es obligatorio');
        }

        if (!datos.producto_codigo || datos.producto_codigo.trim().length < 1) {
            errores.push('El código del producto es obligatorio');
        }

        if (!datos.producto_descripcion || datos.producto_descripcion.trim().length < 3) {
            errores.push('La descripción del producto es obligatoria');
        }

        // Validaciones opcionales
        if (datos.tipo_capacitacion && !TIPOS_CAPACITACION.includes(datos.tipo_capacitacion)) {
            errores.push(`Tipo de capacitación inválido. Debe ser uno de: ${TIPOS_CAPACITACION.join(', ')}`);
        }

        if (datos.modalidad && !MODALIDADES_CAPACITACION.includes(datos.modalidad)) {
            errores.push(`Modalidad inválida. Debe ser uno de: ${MODALIDADES_CAPACITACION.join(', ')}`);
        }

        if (datos.estado && !ESTADOS_CAPACITACION.includes(datos.estado)) {
            errores.push(`Estado inválido. Debe ser uno de: ${ESTADOS_CAPACITACION.join(', ')}`);
        }

        if (datos.fecha_capacitacion_solicitada && !validarFecha(datos.fecha_capacitacion_solicitada)) {
            errores.push('Formato de fecha de capacitación inválido');
        }

        if (datos.duracion_estimada_horas && (isNaN(datos.duracion_estimada_horas) || datos.duracion_estimada_horas <= 0)) {
            errores.push('La duración estimada debe ser un número positivo');
        }

        return {
            valido: errores.length === 0,
            errores
        };
    },

    /**
     * Validar datos para pausar producto
     */
    pausarProducto: (datos) => {
        const errores = [];

        if (!datos.tipo_pausa || !TIPOS_PAUSA_VALIDOS.includes(datos.tipo_pausa)) {
            errores.push(`Tipo de pausa inválido. Debe ser uno de: ${TIPOS_PAUSA_VALIDOS.join(', ')}`);
        }

        if (!datos.motivo || datos.motivo.trim().length < 10) {
            errores.push('El motivo de la pausa debe tener al menos 10 caracteres');
        }

        if (datos.motivo && datos.motivo.length > 500) {
            errores.push('El motivo no puede exceder 500 caracteres');
        }

        return {
            valido: errores.length === 0,
            errores
        };
    }
};

// =====================================
// VALIDACIONES DE FORMATO
// =====================================

/**
 * Validar formato de email
 */
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Validar formato de teléfono (flexible para diferentes formatos)
 */
function validarTelefono(telefono) {
    // Acepta formatos: +51999999999, 999999999, 999-999-999, etc.
    const regex = /^[\+]?[1-9][\d]{0,15}$/;
    const telefonoLimpio = telefono.replace(/[\s\-\(\)]/g, '');
    return regex.test(telefonoLimpio) && telefonoLimpio.length >= 7;
}

/**
 * Validar formato de fecha (YYYY-MM-DD)
 */
function validarFecha(fecha) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fecha)) return false;
    
    const fechaObj = new Date(fecha);
    return fechaObj instanceof Date && !isNaN(fechaObj);
}

/**
 * Validar que una fecha sea futura
 */
function validarFechaFutura(fecha) {
    if (!validarFecha(fecha)) return false;
    const fechaObj = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fechaObj >= hoy;
}

// =====================================
// PROCESAMIENTO DE FILTROS
// =====================================

/**
 * Validar y procesar filtros de consulta
 */
function validarFiltros(query) {
    const filtros = {};

    // Filtros de estado
    if (query.estado && ESTADOS_TICKET.includes(query.estado)) {
        filtros.estado = query.estado;
    }

    if (query.tipo_ticket && TIPOS_TICKET.includes(query.tipo_ticket)) {
        filtros.tipo_ticket = query.tipo_ticket;
    }

    if (query.prioridad && PRIORIDADES.includes(query.prioridad)) {
        filtros.prioridad = query.prioridad;
    }

    // Filtros numéricos
    if (query.tecnico_id && !isNaN(query.tecnico_id)) {
        filtros.tecnico_id = parseInt(query.tecnico_id);
    }

    if (query.asesor_id && !isNaN(query.asesor_id)) {
        filtros.asesor_id = parseInt(query.asesor_id);
    }

    // Filtros de fecha
    if (query.fecha_desde && validarFecha(query.fecha_desde)) {
        filtros.fecha_desde = query.fecha_desde + 'T00:00:00Z';
    }

    if (query.fecha_hasta && validarFecha(query.fecha_hasta)) {
        filtros.fecha_hasta = query.fecha_hasta + 'T23:59:59Z';
    }

    // Paginación
    if (query.limite && !isNaN(query.limite) && query.limite > 0 && query.limite <= 100) {
        filtros.limite = parseInt(query.limite);
    }

    if (query.offset && !isNaN(query.offset) && query.offset >= 0) {
        filtros.offset = parseInt(query.offset);
    }

    // Ordenamiento
    const ordenesValidos = ['created_at', 'updated_at', 'prioridad', 'estado', 'tipo_ticket', 'fecha_programada'];
    if (query.orden && ordenesValidos.includes(query.orden)) {
        filtros.orden = query.orden;
    }

    if (query.direccion && ['asc', 'desc'].includes(query.direccion)) {
        filtros.direccion = query.direccion;
    }

    return filtros;
}

// =====================================
// UTILIDADES DE FORMATEO
// =====================================

/**
 * Formatear datos de ticket para respuesta
 */
function formatearTicket(ticket) {
    return {
        ...ticket,
        tiempo_transcurrido: ticket.created_at ? calcularTiempoTranscurrido(ticket.created_at) : null,
        sla_vencido: ticket.created_at ? verificarSLAVencido(ticket.created_at, ticket.prioridad) : false,
        nombre_completo_tecnico: ticket.tecnico_asignado 
            ? `${ticket.tecnico_asignado.nombre} ${ticket.tecnico_asignado.apellido || ''}`.trim()
            : null,
        nombre_completo_asesor: ticket.asesor_origen 
            ? `${ticket.asesor_origen.nombre} ${ticket.asesor_origen.apellido || ''}`.trim()
            : null
    };
}

/**
 * Formatear datos de producto para respuesta
 */
function formatearProducto(producto) {
    return {
        ...producto,
        tiempo_en_soporte: producto.fecha_recepcion ? calcularTiempoTranscurrido(producto.fecha_recepcion) : null,
        eficiencia_reparacion: producto.tiempo_bruto_reparacion_horas && producto.tiempo_neto_reparacion_horas
            ? Math.round((producto.tiempo_neto_reparacion_horas / producto.tiempo_bruto_reparacion_horas) * 100)
            : null,
        estado_visual: obtenerEstadoVisual(producto),
        requiere_atencion: verificarRequiereAtencion(producto)
    };
}

/**
 * Calcular tiempo transcurrido desde una fecha
 */
function calcularTiempoTranscurrido(fechaInicio) {
    const inicio = new Date(fechaInicio);
    const ahora = new Date();
    const diferencia = ahora - inicio;
    
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (dias > 0) {
        return `${dias}d ${horas}h`;
    }
    return `${horas}h`;
}

/**
 * Verificar si el SLA está vencido
 */
function verificarSLAVencido(fechaCreacion, prioridad = 'MEDIA') {
    const limitesSLA = {
        'URGENTE': 2, // 2 horas
        'ALTA': 8,    // 8 horas
        'MEDIA': 24,  // 24 horas
        'BAJA': 48    // 48 horas
    };

    const limiteHoras = limitesSLA[prioridad] || 24;
    const creacion = new Date(fechaCreacion);
    const ahora = new Date();
    const horasTranscurridas = (ahora - creacion) / (1000 * 60 * 60);
    
    return horasTranscurridas > limiteHoras;
}

/**
 * Obtener estado visual para UI
 */
function obtenerEstadoVisual(producto) {
    const estados = {
        'RECIBIDO': { color: 'blue', texto: 'Recibido' },
        'EN_DIAGNOSTICO': { color: 'yellow', texto: 'Diagnóstico' },
        'EN_REPARACION': { color: 'orange', texto: 'Reparando' },
        'REPARADO': { color: 'green', texto: 'Reparado' },
        'IRREPARABLE': { color: 'red', texto: 'Irreparable' },
        'LISTO_ENTREGA': { color: 'purple', texto: 'Listo' },
        'ENVIADO_ALMACEN': { color: 'gray', texto: 'Enviado' }
    };

    // Si está pausado, mostrar estado especial
    if (producto.esta_pausado) {
        return { color: 'amber', texto: 'Pausado' };
    }

    return estados[producto.estado] || { color: 'gray', texto: 'Desconocido' };
}

/**
 * Verificar si un producto requiere atención urgente
 */
function verificarRequiereAtencion(producto) {
    // Producto pausado por mucho tiempo
    if (producto.esta_pausado && producto.fecha_ultima_pausa) {
        const horasPausa = (new Date() - new Date(producto.fecha_ultima_pausa)) / (1000 * 60 * 60);
        if (horasPausa > 72) return true; // Más de 3 días pausado
    }

    // Producto en diagnóstico por mucho tiempo
    if (producto.estado === 'EN_DIAGNOSTICO' && producto.fecha_recepcion) {
        const horasDiagnostico = (new Date() - new Date(producto.fecha_recepcion)) / (1000 * 60 * 60);
        if (horasDiagnostico > 48) return true; // Más de 2 días en diagnóstico
    }

    // Producto reparado sin enviar
    if (producto.categoria === 'REPARADO' && producto.debe_retornar_almacen && producto.estado !== 'ENVIADO_ALMACEN') {
        const horasReparado = producto.fecha_fin_reparacion 
            ? (new Date() - new Date(producto.fecha_fin_reparacion)) / (1000 * 60 * 60)
            : 0;
        if (horasReparado > 24) return true; // Más de 1 día sin enviar a almacén
    }

    return false;
}

// =====================================
// UTILIDADES DE CÓDIGOS Y IDs
// =====================================

/**
 * Generar código de referencia temporal
 */
function generarCodigoReferencia(prefijo = 'TEMP') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 4);
    return `${prefijo}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Limpiar y normalizar texto
 */
function limpiarTexto(texto) {
    if (!texto) return '';
    return texto.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizar nombre de cliente
 */
function normalizarNombreCliente(nombre) {
    if (!nombre) return '';
    return nombre.trim()
        .toLowerCase()
        .split(' ')
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(' ');
}

// =====================================
// UTILIDADES DE FECHAS
// =====================================

/**
 * Obtener fecha en formato local
 */
function obtenerFechaLocal(fecha = new Date()) {
    return fecha.toISOString().split('T')[0];
}

/**
 * Obtener fecha y hora en formato local
 */
function obtenerFechaHoraLocal(fecha = new Date()) {
    return fecha.toISOString().slice(0, 16);
}

/**
 * Calcular fecha de vencimiento según SLA
 */
function calcularFechaVencimientoSLA(fechaInicio, prioridad = 'MEDIA') {
    const limitesSLA = {
        'URGENTE': 2,
        'ALTA': 8,
        'MEDIA': 24,
        'BAJA': 48
    };

    const inicio = new Date(fechaInicio);
    const horasLimite = limitesSLA[prioridad] || 24;
    const vencimiento = new Date(inicio.getTime() + (horasLimite * 60 * 60 * 1000));
    
    return vencimiento.toISOString();
}

// =====================================
// EXPORTAR FUNCIONES
// =====================================

module.exports = {
    // Constantes
    TIPOS_TICKET,
    ESTADOS_TICKET,
    PRIORIDADES,
    CATEGORIAS_PRODUCTO,
    ESTADOS_PRODUCTO,
    ORIGENES_PRODUCTO,
    TIPOS_PAUSA_VALIDOS,
    TIPOS_CAPACITACION,
    MODALIDADES_CAPACITACION,
    ESTADOS_CAPACITACION,

    // Validaciones principales
    validarDatosSoporte,
    validarFiltros,

    // Validaciones de formato
    validarEmail,
    validarTelefono,
    validarFecha,
    validarFechaFutura,

    // Formateo
    formatearTicket,
    formatearProducto,

    // Utilidades de tiempo
    calcularTiempoTranscurrido,
    verificarSLAVencido,
    calcularFechaVencimientoSLA,

    // Utilidades de UI
    obtenerEstadoVisual,
    verificarRequiereAtencion,

    // Utilidades generales
    generarCodigoReferencia,
    limpiarTexto,
    normalizarNombreCliente,
    obtenerFechaLocal,
    obtenerFechaHoraLocal
};