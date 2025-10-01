// =====================================
// HELPERS Y VALIDACIONES DE SOPORTE TÉCNICO - VERSIÓN CORREGIDA
// =====================================
// Funciones auxiliares, validaciones y utilidades para el módulo de soporte
// CORREGIDO: Manejo defensivo, validaciones robustas, compatibilidad con datos vacíos

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
// VALIDACIONES DE DATOS DE ENTRADA - MEJORADAS
// =====================================

const validarDatosSoporte = {
    /**
     * Validar datos para crear ticket
     * CORREGIDO: Manejo defensivo y validaciones más robustas
     */
    crearTicket: (datos) => {
        const errores = [];

        // CORRECCIÓN: Validar que datos existe y es un objeto
        if (!datos || typeof datos !== 'object') {
            return {
                valido: false,
                errores: ['Los datos del ticket son requeridos']
            };
        }

        // Validaciones obligatorias con manejo defensivo
        if (!datos.tipo_ticket || typeof datos.tipo_ticket !== 'string') {
            errores.push('El tipo de ticket es obligatorio');
        } else if (!TIPOS_TICKET.includes(datos.tipo_ticket.trim())) {
            errores.push(`Tipo de ticket inválido. Debe ser uno de: ${TIPOS_TICKET.join(', ')}`);
        }

        // CORRECCIÓN: Validación más robusta de título
        const titulo = datos.titulo ? datos.titulo.toString().trim() : '';
        if (!titulo || titulo.length < 5) {
            errores.push('El título debe tener al menos 5 caracteres');
        } else if (titulo.length > 255) {
            errores.push('El título no puede exceder 255 caracteres');
        }

        // CORRECCIÓN: Validación más robusta de descripción
        const descripcion = datos.descripcion ? datos.descripcion.toString().trim() : '';
        if (!descripcion || descripcion.length < 10) {
            errores.push('La descripción debe tener al menos 10 caracteres');
        } else if (descripcion.length > 1000) {
            errores.push('La descripción no puede exceder 1000 caracteres');
        }

        // CORRECCIÓN: Validación más robusta de cliente_nombre
        const clienteNombre = datos.cliente_nombre ? datos.cliente_nombre.toString().trim() : '';
        if (!clienteNombre || clienteNombre.length < 2) {
            errores.push('El nombre del cliente es obligatorio y debe tener al menos 2 caracteres');
        } else if (clienteNombre.length > 255) {
            errores.push('El nombre del cliente no puede exceder 255 caracteres');
        }

        // Validaciones opcionales con formato mejorado
        if (datos.prioridad && !PRIORIDADES.includes(datos.prioridad)) {
            errores.push(`Prioridad inválida. Debe ser uno de: ${PRIORIDADES.join(', ')}`);
        }

        if (datos.cliente_telefono && !validarTelefono(datos.cliente_telefono)) {
            errores.push('Formato de teléfono inválido (debe tener al menos 7 dígitos)');
        }

        if (datos.cliente_email && !validarEmail(datos.cliente_email)) {
            errores.push('Formato de email inválido');
        }

        if (datos.fecha_programada && !validarFecha(datos.fecha_programada)) {
            errores.push('Formato de fecha programada inválido (debe ser YYYY-MM-DD)');
        }

        // CORRECCIÓN: Validaciones específicas por tipo más robustas
        if (datos.tipo_ticket === 'CAPACITACION') {
            if (!datos.cliente_telefono) {
                errores.push('El teléfono del cliente es obligatorio para capacitaciones');
            }
            
            if (datos.fecha_capacitacion_solicitada && !validarFecha(datos.fecha_capacitacion_solicitada)) {
                errores.push('Formato de fecha de capacitación inválido');
            }
        }

        return {
            valido: errores.length === 0,
            errores
        };
    },

    /**
     * Validar datos para crear producto en soporte
     * CORREGIDO: Validaciones más defensivas
     */
    crearProducto: (datos) => {
        const errores = [];

        // CORRECCIÓN: Validar que datos existe
        if (!datos || typeof datos !== 'object') {
            return {
                valido: false,
                errores: ['Los datos del producto son requeridos']
            };
        }

        // Validaciones obligatorias con manejo defensivo
        if (!datos.ticket_id || isNaN(datos.ticket_id)) {
            errores.push('El ID del ticket es obligatorio y debe ser un número válido');
        }

        if (!datos.producto_id || isNaN(datos.producto_id)) {
            errores.push('El ID del producto es obligatorio y debe ser un número válido');
        }

        // CORRECCIÓN: Validación más robusta de código
        const codigoProducto = datos.codigo_producto ? datos.codigo_producto.toString().trim() : '';
        if (!codigoProducto || codigoProducto.length < 1) {
            errores.push('El código del producto es obligatorio');
        } else if (codigoProducto.length > 50) {
            errores.push('El código del producto no puede exceder 50 caracteres');
        }

        // CORRECCIÓN: Validación más robusta de descripción
        const descripcionProducto = datos.descripcion_producto ? datos.descripcion_producto.toString().trim() : '';
        if (!descripcionProducto || descripcionProducto.length < 3) {
            errores.push('La descripción del producto es obligatoria (mínimo 3 caracteres)');
        } else if (descripcionProducto.length > 500) {
            errores.push('La descripción del producto no puede exceder 500 caracteres');
        }

        // Validaciones opcionales con mejor manejo
        if (datos.categoria && !CATEGORIAS_PRODUCTO.includes(datos.categoria)) {
            errores.push(`Categoría inválida. Debe ser uno de: ${CATEGORIAS_PRODUCTO.join(', ')}`);
        }

        if (datos.estado && !ESTADOS_PRODUCTO.includes(datos.estado)) {
            errores.push(`Estado inválido. Debe ser uno de: ${ESTADOS_PRODUCTO.join(', ')}`);
        }

        if (datos.origen && !ORIGENES_PRODUCTO.includes(datos.origen)) {
            errores.push(`Origen inválido. Debe ser uno de: ${ORIGENES_PRODUCTO.join(', ')}`);
        }

        // CORRECCIÓN: Validación más robusta de costo
        if (datos.costo_reparacion !== undefined && datos.costo_reparacion !== null) {
            const costo = parseFloat(datos.costo_reparacion);
            if (isNaN(costo) || costo < 0) {
                errores.push('El costo de reparación debe ser un número positivo o cero');
            }
        }

        return {
            valido: errores.length === 0,
            errores
        };
    },

    /**
     * Validar datos para crear capacitación
     * CORREGIDO: Validaciones más completas
     */
    crearCapacitacion: (datos) => {
        const errores = [];

        // CORRECCIÓN: Validar que datos existe
        if (!datos || typeof datos !== 'object') {
            return {
                valido: false,
                errores: ['Los datos de la capacitación son requeridos']
            };
        }

        // Validaciones obligatorias con manejo defensivo
        if (!datos.ticket_id || isNaN(datos.ticket_id)) {
            errores.push('El ID del ticket es obligatorio');
        }

        if (!datos.producto_id || isNaN(datos.producto_id)) {
            errores.push('El ID del producto es obligatorio');
        }

        // CORRECCIÓN: Validación robusta de nombre cliente
        const clienteNombre = datos.cliente_nombre ? datos.cliente_nombre.toString().trim() : '';
        if (!clienteNombre || clienteNombre.length < 2) {
            errores.push('El nombre del cliente es obligatorio (mínimo 2 caracteres)');
        } else if (clienteNombre.length > 255) {
            errores.push('El nombre del cliente no puede exceder 255 caracteres');
        }

        // CORRECCIÓN: Validación más estricta de teléfono
        if (!datos.cliente_telefono || !validarTelefono(datos.cliente_telefono)) {
            errores.push('Teléfono de cliente válido es obligatorio');
        }

        // CORRECCIÓN: Validaciones robustas de producto
        const productoCodigo = datos.producto_codigo ? datos.producto_codigo.toString().trim() : '';
        if (!productoCodigo || productoCodigo.length < 1) {
            errores.push('El código del producto es obligatorio');
        }

        const productoDescripcion = datos.producto_descripcion ? datos.producto_descripcion.toString().trim() : '';
        if (!productoDescripcion || productoDescripcion.length < 3) {
            errores.push('La descripción del producto es obligatoria');
        }

        // Validaciones opcionales mejoradas
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
            errores.push('Formato de fecha de capacitación inválido (YYYY-MM-DD)');
        }

        // CORRECCIÓN: Validación más robusta de duración
        if (datos.duracion_estimada_horas !== undefined && datos.duracion_estimada_horas !== null) {
            const duracion = parseFloat(datos.duracion_estimada_horas);
            if (isNaN(duracion) || duracion <= 0) {
                errores.push('La duración estimada debe ser un número positivo');
            } else if (duracion > 24) {
                errores.push('La duración estimada no puede exceder 24 horas');
            }
        }

        return {
            valido: errores.length === 0,
            errores
        };
    },

    /**
     * Validar datos para pausar producto
     * CORREGIDO: Validaciones más estrictas
     */
    pausarProducto: (datos) => {
        const errores = [];

        // CORRECCIÓN: Validar que datos existe
        if (!datos || typeof datos !== 'object') {
            return {
                valido: false,
                errores: ['Los datos para pausar el producto son requeridos']
            };
        }

        if (!datos.tipo_pausa || !TIPOS_PAUSA_VALIDOS.includes(datos.tipo_pausa)) {
            errores.push(`Tipo de pausa inválido. Debe ser uno de: ${TIPOS_PAUSA_VALIDOS.join(', ')}`);
        }

        // CORRECCIÓN: Validación más robusta de motivo
        const motivo = datos.motivo ? datos.motivo.toString().trim() : '';
        if (!motivo || motivo.length < 10) {
            errores.push('El motivo de la pausa debe tener al menos 10 caracteres');
        } else if (motivo.length > 500) {
            errores.push('El motivo no puede exceder 500 caracteres');
        }

        // CORRECCIÓN: Validación adicional para fechas si se proporcionan
        if (datos.fecha_inicio_pausa && !validarFecha(datos.fecha_inicio_pausa)) {
            errores.push('Formato de fecha de inicio de pausa inválido');
        }

        return {
            valido: errores.length === 0,
            errores
        };
    }
};

// =====================================
// VALIDACIONES DE FORMATO - MEJORADAS
// =====================================

/**
 * Validar formato de email
 * CORREGIDO: Validación más robusta
 */
function validarEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Limpiar espacios
    email = email.trim();
    if (email.length === 0) return false;
    
    // Validación básica de formato
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) return false;
    
    // Validaciones adicionales
    if (email.length > 254) return false; // RFC 5321
    if (email.indexOf('..') !== -1) return false; // No permitir puntos consecutivos
    
    return true;
}

/**
 * Validar formato de teléfono (flexible para diferentes formatos)
 * CORREGIDO: Más flexible y robusto
 */
function validarTelefono(telefono) {
    if (!telefono || typeof telefono !== 'string') return false;
    
    // Limpiar el teléfono de caracteres especiales
    const telefonoLimpio = telefono.replace(/[\s\-\(\)\+]/g, '');
    
    // Validar que solo contenga números después de la limpieza
    if (!/^\d+$/.test(telefonoLimpio)) return false;
    
    // Validar longitud (mínimo 7, máximo 15 según ITU-T E.164)
    return telefonoLimpio.length >= 7 && telefonoLimpio.length <= 15;
}

/**
 * Validar formato de fecha (YYYY-MM-DD)
 * CORREGIDO: Validación más estricta
 */
function validarFecha(fecha) {
    if (!fecha || typeof fecha !== 'string') return false;
    
    // Validar formato básico
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fecha)) return false;
    
    // Validar que sea una fecha real
    const fechaObj = new Date(fecha + 'T00:00:00.000Z');
    if (!(fechaObj instanceof Date) || isNaN(fechaObj.getTime())) return false;
    
    // Validar que la fecha convertida coincida con la original
    const fechaFormateada = fechaObj.toISOString().split('T')[0];
    return fechaFormateada === fecha;
}

/**
 * Validar que una fecha sea futura
 * CORREGIDO: Más flexible con zona horaria
 */
function validarFechaFutura(fecha) {
    if (!validarFecha(fecha)) return false;
    
    const fechaObj = new Date(fecha + 'T00:00:00.000Z');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    return fechaObj >= hoy;
}

// =====================================
// PROCESAMIENTO DE FILTROS - MEJORADO
// =====================================

/**
 * Validar y procesar filtros de consulta
 * CORREGIDO: Más robusto y defensivo
 */
function validarFiltros(query) {
    // CORRECCIÓN: Validar que query existe
    if (!query || typeof query !== 'object') {
        return {};
    }

    const filtros = {};

    try {
        // Filtros de estado con validación defensiva
        if (query.estado && typeof query.estado === 'string' && ESTADOS_TICKET.includes(query.estado.trim())) {
            filtros.estado = query.estado.trim();
        }

        if (query.tipo_ticket && typeof query.tipo_ticket === 'string' && TIPOS_TICKET.includes(query.tipo_ticket.trim())) {
            filtros.tipo_ticket = query.tipo_ticket.trim();
        }

        if (query.prioridad && typeof query.prioridad === 'string' && PRIORIDADES.includes(query.prioridad.trim())) {
            filtros.prioridad = query.prioridad.trim();
        }

        // CORRECCIÓN: Filtros numéricos con validación más estricta
        if (query.tecnico_id) {
            const tecnicoId = parseInt(query.tecnico_id);
            if (!isNaN(tecnicoId) && tecnicoId > 0) {
                filtros.tecnico_id = tecnicoId;
            }
        }

        if (query.asesor_id) {
            const asesorId = parseInt(query.asesor_id);
            if (!isNaN(asesorId) && asesorId > 0) {
                filtros.asesor_id = asesorId;
            }
        }

        if (query.almacen_id) {
            const almacenId = parseInt(query.almacen_id);
            if (!isNaN(almacenId) && almacenId > 0) {
                filtros.almacen_id = almacenId;
            }
        }

        // CORRECCIÓN: Filtros de fecha con mejor validación
        if (query.fecha_desde && validarFecha(query.fecha_desde)) {
            filtros.fecha_desde = query.fecha_desde + 'T00:00:00Z';
        }

        if (query.fecha_hasta && validarFecha(query.fecha_hasta)) {
            filtros.fecha_hasta = query.fecha_hasta + 'T23:59:59Z';
        }

        // CORRECCIÓN: Paginación con límites seguros
        if (query.limite) {
            const limite = parseInt(query.limite);
            if (!isNaN(limite) && limite > 0 && limite <= 100) {
                filtros.limite = limite;
            }
        }

        if (query.offset) {
            const offset = parseInt(query.offset);
            if (!isNaN(offset) && offset >= 0) {
                filtros.offset = offset;
            }
        }

        // CORRECCIÓN: Ordenamiento con valores seguros
        const ordenesValidos = ['created_at', 'updated_at', 'prioridad', 'estado', 'tipo_ticket', 'fecha_programada'];
        if (query.orden && typeof query.orden === 'string' && ordenesValidos.includes(query.orden.trim())) {
            filtros.orden = query.orden.trim();
        }

        if (query.direccion && ['asc', 'desc'].includes(query.direccion)) {
            filtros.direccion = query.direccion;
        }

        return filtros;

    } catch (error) {
        // CORRECCIÓN: En caso de error, devolver objeto vacío
        console.error('Error procesando filtros:', error);
        return {};
    }
}

// =====================================
// UTILIDADES DE FORMATEO - ROBUSTAS
// =====================================

/**
 * Formatear datos de ticket para respuesta
 * CORREGIDO: Acceso defensivo a propiedades
 */
function formatearTicket(ticket) {
    // CORRECCIÓN: Validar que ticket existe
    if (!ticket || typeof ticket !== 'object') {
        return null;
    }

    try {
        return {
            ...ticket,
            tiempo_transcurrido: ticket.created_at ? calcularTiempoTranscurrido(ticket.created_at) : null,
            sla_vencido: ticket.created_at ? verificarSLAVencido(ticket.created_at, ticket.prioridad) : false,
            nombre_completo_tecnico: ticket.tecnico_asignado 
                ? `${ticket.tecnico_asignado.nombre || ''} ${ticket.tecnico_asignado.apellido || ''}`.trim() || 'Sin nombre'
                : null,
            nombre_completo_asesor: ticket.asesor_origen 
                ? `${ticket.asesor_origen.nombre || ''} ${ticket.asesor_origen.apellido || ''}`.trim() || 'Sin nombre'
                : null,
            cliente_nombre_formateado: ticket.cliente_nombre ? normalizarNombreCliente(ticket.cliente_nombre) : null
        };
    } catch (error) {
        console.error('Error formateando ticket:', error);
        return ticket; // Devolver ticket original si hay error
    }
}

/**
 * Formatear datos de producto para respuesta
 * CORREGIDO: Manejo más defensivo
 */
function formatearProducto(producto) {
    // CORRECCIÓN: Validar que producto existe
    if (!producto || typeof producto !== 'object') {
        return null;
    }

    try {
        const tiempoBruto = producto.tiempo_bruto_reparacion_horas;
        const tiempoNeto = producto.tiempo_neto_reparacion_horas;
        
        return {
            ...producto,
            tiempo_en_soporte: producto.fecha_recepcion ? calcularTiempoTranscurrido(producto.fecha_recepcion) : null,
            eficiencia_reparacion: (tiempoBruto && tiempoNeto && tiempoBruto > 0)
                ? Math.round((tiempoNeto / tiempoBruto) * 100)
                : null,
            estado_visual: obtenerEstadoVisual(producto),
            requiere_atencion: verificarRequiereAtencion(producto),
            // CORRECCIÓN: Formateo adicional seguro
            codigo_producto_formateado: producto.codigo_producto ? producto.codigo_producto.toString().toUpperCase() : null,
            costo_reparacion_formateado: producto.costo_reparacion ? formatearMoneda(producto.costo_reparacion) : null
        };
    } catch (error) {
        console.error('Error formateando producto:', error);
        return producto; // Devolver producto original si hay error
    }
}

/**
 * Calcular tiempo transcurrido desde una fecha
 * CORREGIDO: Manejo más robusto de fechas
 */
function calcularTiempoTranscurrido(fechaInicio) {
    if (!fechaInicio) return null;
    
    try {
        const inicio = new Date(fechaInicio);
        const ahora = new Date();
        
        // Validar fechas
        if (isNaN(inicio.getTime()) || isNaN(ahora.getTime())) return null;
        
        const diferencia = ahora - inicio;
        
        // Si la diferencia es negativa (fecha futura), devolver null
        if (diferencia < 0) return null;
        
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        
        if (dias > 0) {
            return `${dias}d ${horas}h`;
        } else if (horas > 0) {
            return `${horas}h ${minutos}m`;
        } else {
            return `${minutos}m`;
        }
    } catch (error) {
        console.error('Error calculando tiempo transcurrido:', error);
        return null;
    }
}

/**
 * Verificar si el SLA está vencido
 * CORREGIDO: Validación más robusta
 */
function verificarSLAVencido(fechaCreacion, prioridad = 'MEDIA') {
    if (!fechaCreacion) return false;
    
    try {
        const limitesSLA = {
            'URGENTE': 2, // 2 horas
            'ALTA': 8,    // 8 horas
            'MEDIA': 24,  // 24 horas
            'BAJA': 48    // 48 horas
        };

        const limiteHoras = limitesSLA[prioridad] || 24;
        const creacion = new Date(fechaCreacion);
        const ahora = new Date();
        
        // Validar fechas
        if (isNaN(creacion.getTime()) || isNaN(ahora.getTime())) return false;
        
        const horasTranscurridas = (ahora - creacion) / (1000 * 60 * 60);
        
        return horasTranscurridas > limiteHoras;
    } catch (error) {
        console.error('Error verificando SLA:', error);
        return false;
    }
}

/**
 * Obtener estado visual para UI
 * CORREGIDO: Más defensivo y completo
 */
function obtenerEstadoVisual(producto) {
    // CORRECCIÓN: Validar que producto existe
    if (!producto || typeof producto !== 'object') {
        return { color: 'gray', texto: 'Desconocido' };
    }

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
    if (producto.esta_pausado === true) {
        return { color: 'amber', texto: 'Pausado' };
    }

    return estados[producto.estado] || { color: 'gray', texto: 'Desconocido' };
}

/**
 * Verificar si un producto requiere atención urgente
 * CORREGIDO: Validaciones más robustas
 */
function verificarRequiereAtencion(producto) {
    // CORRECCIÓN: Validar que producto existe
    if (!producto || typeof producto !== 'object') return false;
    
    try {
        const ahora = new Date();
        
        // Producto pausado por mucho tiempo
        if (producto.esta_pausado && producto.fecha_ultima_pausa) {
            const fechaPausa = new Date(producto.fecha_ultima_pausa);
            if (!isNaN(fechaPausa.getTime())) {
                const horasPausa = (ahora - fechaPausa) / (1000 * 60 * 60);
                if (horasPausa > 72) return true; // Más de 3 días pausado
            }
        }

        // Producto en diagnóstico por mucho tiempo
        if (producto.estado === 'EN_DIAGNOSTICO' && producto.fecha_recepcion) {
            const fechaRecepcion = new Date(producto.fecha_recepcion);
            if (!isNaN(fechaRecepcion.getTime())) {
                const horasDiagnostico = (ahora - fechaRecepcion) / (1000 * 60 * 60);
                if (horasDiagnostico > 48) return true; // Más de 2 días en diagnóstico
            }
        }

        // Producto reparado sin enviar
        if (producto.categoria === 'REPARADO' && producto.debe_retornar_almacen && producto.estado !== 'ENVIADO_ALMACEN') {
            if (producto.fecha_fin_reparacion) {
                const fechaReparacion = new Date(producto.fecha_fin_reparacion);
                if (!isNaN(fechaReparacion.getTime())) {
                    const horasReparado = (ahora - fechaReparacion) / (1000 * 60 * 60);
                    if (horasReparado > 24) return true; // Más de 1 día sin enviar a almacén
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Error verificando atención requerida:', error);
        return false;
    }
}

// =====================================
// UTILIDADES DE CÓDIGOS Y IDs - MEJORADAS
// =====================================

/**
 * Generar código de referencia temporal
 * CORREGIDO: Más único y robusto
 */
function generarCodigoReferencia(prefijo = 'TEMP') {
    try {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        const prefijoLimpio = prefijo ? prefijo.toString().toUpperCase().substr(0, 10) : 'TEMP';
        
        return `${prefijoLimpio}-${timestamp}-${random}`;
    } catch (error) {
        console.error('Error generando código:', error);
        return 'TEMP-' + Date.now();
    }
}

/**
 * Limpiar y normalizar texto
 * CORREGIDO: Más robusto
 */
function limpiarTexto(texto) {
    if (!texto || typeof texto !== 'string') return '';
    
    try {
        return texto.trim()
            .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
            .replace(/[\r\n\t]/g, ' ') // Saltos de línea y tabs a espacios
            .substring(0, 1000); // Limitar longitud por seguridad
    } catch (error) {
        console.error('Error limpiando texto:', error);
        return '';
    }
}

/**
 * Normalizar nombre de cliente
 * CORREGIDO: Más defensivo
 */
function normalizarNombreCliente(nombre) {
    if (!nombre || typeof nombre !== 'string') return '';
    
    try {
        return nombre.trim()
            .toLowerCase()
            .split(' ')
            .filter(palabra => palabra.length > 0) // Eliminar palabras vacías
            .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
            .join(' ')
            .substring(0, 255); // Limitar longitud
    } catch (error) {
        console.error('Error normalizando nombre:', error);
        return nombre ? nombre.toString() : '';
    }
}

// =====================================
// UTILIDADES DE FECHAS - MEJORADAS
// =====================================

/**
 * Obtener fecha en formato local
 * CORREGIDO: Manejo de zona horaria
 */
function obtenerFechaLocal(fecha = new Date()) {
    try {
        if (!(fecha instanceof Date)) {
            fecha = new Date(fecha);
        }
        
        if (isNaN(fecha.getTime())) {
            fecha = new Date();
        }
        
        return fecha.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error obteniendo fecha local:', error);
        return new Date().toISOString().split('T')[0];
    }
}

/**
 * Obtener fecha y hora en formato local
 * CORREGIDO: Más robusto
 */
function obtenerFechaHoraLocal(fecha = new Date()) {
    try {
        if (!(fecha instanceof Date)) {
            fecha = new Date(fecha);
        }
        
        if (isNaN(fecha.getTime())) {
            fecha = new Date();
        }
        
        return fecha.toISOString().slice(0, 16);
    } catch (error) {
        console.error('Error obteniendo fecha y hora local:', error);
        return new Date().toISOString().slice(0, 16);
    }
}

/**
 * Calcular fecha de vencimiento según SLA
 * CORREGIDO: Validación más estricta
 */
function calcularFechaVencimientoSLA(fechaInicio, prioridad = 'MEDIA') {
    try {
        const limitesSLA = {
            'URGENTE': 2,
            'ALTA': 8,
            'MEDIA': 24,
            'BAJA': 48
        };

        const inicio = new Date(fechaInicio);
        if (isNaN(inicio.getTime())) {
            throw new Error('Fecha de inicio inválida');
        }

        const horasLimite = limitesSLA[prioridad] || 24;
        const vencimiento = new Date(inicio.getTime() + (horasLimite * 60 * 60 * 1000));
        
        return vencimiento.toISOString();
    } catch (error) {
        console.error('Error calculando fecha de vencimiento SLA:', error);
        return new Date().toISOString();
    }
}

// =====================================
// UTILIDADES ADICIONALES - NUEVAS
// =====================================

/**
 * Formatear moneda
 * NUEVA: Para formateo de costos
 */
function formatearMoneda(cantidad, moneda = 'PEN') {
    try {
        const numero = parseFloat(cantidad);
        if (isNaN(numero)) return '0.00';
        
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: moneda,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numero);
    } catch (error) {
        console.error('Error formateando moneda:', error);
        return `${moneda} ${cantidad || 0}`;
    }
}

/**
 * Validar estructura de datos mínima
 * NUEVA: Para validación general
 */
function validarEstructuraMinima(datos, camposRequeridos) {
    if (!datos || typeof datos !== 'object' || !Array.isArray(camposRequeridos)) {
        return false;
    }
    
    return camposRequeridos.every(campo => 
        datos.hasOwnProperty(campo) && datos[campo] !== null && datos[campo] !== undefined
    );
}

/**
 * Sanear entrada de usuario
 * NUEVA: Para seguridad básica
 */
function sanearEntrada(texto) {
    if (!texto || typeof texto !== 'string') return '';
    
    try {
        return texto.trim()
            .replace(/[<>]/g, '') // Eliminar caracteres peligrosos básicos
            .replace(/script/gi, '') // Eliminar palabra script
            .substring(0, 1000); // Limitar longitud
    } catch (error) {
        console.error('Error saneando entrada:', error);
        return '';
    }
}

// =====================================
// EXPORTAR FUNCIONES - ACTUALIZADO
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
    obtenerFechaHoraLocal,

    // NUEVAS: Utilidades adicionales
    formatearMoneda,
    validarEstructuraMinima,
    sanearEntrada
};