    const winston = require('winston');

// Logger para validaciones
const logger = winston.createLogger({
    level: 'warn',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'almacen-validations' },
    transports: [
        new winston.transports.File({ filename: 'logs/almacen-validations.log' }),
        new winston.transports.Console()
    ]
});

// ==================== VALIDACIONES GENERALES ====================

const validarUUID = (campo) => {
    return (req, res, next) => {
        const valor = req.params[campo] || req.body[campo];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (!valor) {
            return res.status(400).json({
                success: false,
                error: `El campo ${campo} es requerido`,
                codigo: 'FIELD_REQUIRED'
            });
        }
        
        if (!uuidRegex.test(valor)) {
            return res.status(400).json({
                success: false,
                error: `El campo ${campo} debe ser un UUID válido`,
                codigo: 'INVALID_UUID',
                valor_recibido: valor
            });
        }
        
        next();
    };
};

const validarNumeroPositivo = (valor, nombreCampo) => {
    if (valor === undefined || valor === null) {
        return `El campo ${nombreCampo} es requerido`;
    }
    
    const numero = Number(valor);
    if (isNaN(numero)) {
        return `El campo ${nombreCampo} debe ser un número válido`;
    }
    
    if (numero < 0) {
        return `El campo ${nombreCampo} no puede ser negativo`;
    }
    
    return null;
};

const validarFecha = (fecha, nombreCampo, requerido = false) => {
    if (!fecha && requerido) {
        return `El campo ${nombreCampo} es requerido`;
    }
    
    if (fecha && isNaN(Date.parse(fecha))) {
        return `El campo ${nombreCampo} debe ser una fecha válida (YYYY-MM-DD)`;
    }
    
    return null;
};

// ==================== VALIDACIONES DE INVENTARIO ====================

const validarFiltrosInventario = (req, res, next) => {
    const errores = [];
    const { page, limit, categoria, estado_stock, almacen_id, orden, direccion } = req.query;
    
    // Validar paginación
    if (page && (isNaN(page) || Number(page) < 1)) {
        errores.push('La página debe ser un número mayor a 0');
    }
    
    if (limit && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 6000)) {
        errores.push('El límite debe ser un número entre 1 y 6000');
    }
    
    // Validar estado de stock
    const estadosValidos = ['NORMAL', 'BAJO', 'AGOTADO'];
    if (estado_stock && !estadosValidos.includes(estado_stock)) {
        errores.push(`El estado de stock debe ser uno de: ${estadosValidos.join(', ')}`);
    }
    
    // Validar UUID de almacén
    if (almacen_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(almacen_id)) {
            errores.push('El ID de almacén debe ser un UUID válido');
        }
    }
    
    // Validar ordenamiento
    const ordenesValidos = ['producto_codigo', 'producto_descripcion', 'stock_actual', 'stock_minimo', 'valor_inventario', 'ultimo_movimiento'];
    if (orden && !ordenesValidos.includes(orden)) {
        errores.push(`El campo de orden debe ser uno de: ${ordenesValidos.join(', ')}`);
    }
    
    const direccionesValidas = ['asc', 'desc'];
    if (direccion && !direccionesValidas.includes(direccion)) {
        errores.push(`La dirección debe ser: ${direccionesValidas.join(' o ')}`);
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de consulta inválidos',
            details: errores,
            codigo: 'INVALID_QUERY_PARAMS'
        });
    }
    
    next();
};

const validarActualizacionStock = (req, res, next) => {
    const errores = [];
    const { stock_actual, stock_minimo, stock_maximo, costo_promedio, motivo } = req.body;
    
    // Validar stock actual (requerido)
    const errorStockActual = validarNumeroPositivo(stock_actual, 'stock_actual');
    if (errorStockActual) {
        errores.push(errorStockActual);
    }
    
    // Validar stock mínimo (requerido)
    const errorStockMinimo = validarNumeroPositivo(stock_minimo, 'stock_minimo');
    if (errorStockMinimo) {
        errores.push(errorStockMinimo);
    }
    
    // Validar stock máximo (opcional)
    if (stock_maximo !== undefined && stock_maximo !== null) {
        const errorStockMaximo = validarNumeroPositivo(stock_maximo, 'stock_maximo');
        if (errorStockMaximo) {
            errores.push(errorStockMaximo);
        } else if (Number(stock_maximo) < Number(stock_minimo)) {
            errores.push('El stock máximo no puede ser menor al stock mínimo');
        }
    }
    
    // Validar costo promedio (opcional)
    if (costo_promedio !== undefined && costo_promedio !== null) {
        const errorCosto = validarNumeroPositivo(costo_promedio, 'costo_promedio');
        if (errorCosto) {
            errores.push(errorCosto);
        }
    }
    
    // Validar motivo
    if (!motivo || motivo.trim().length < 3) {
        errores.push('El motivo debe tener al menos 3 caracteres');
    } else if (motivo.length > 500) {
        errores.push('El motivo no puede exceder 500 caracteres');
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de actualización de stock inválidos',
            details: errores,
            codigo: 'INVALID_STOCK_UPDATE'
        });
    }
    
    next();
};

// ==================== VALIDACIONES DE MOVIMIENTOS ====================

const validarFiltrosMovimientos = (req, res, next) => {
    const errores = [];
    const { page, limit, tipo_movimiento, fecha_desde, fecha_hasta, orden, direccion } = req.query;
    
    // Validar paginación
    if (page && (isNaN(page) || Number(page) < 1)) {
        errores.push('La página debe ser un número mayor a 0');
    }
    
    if (limit && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 6000)) {
        errores.push('El límite debe ser un número entre 1 y 6000');
    }
    
    // Validar tipo de movimiento
    const tiposValidos = ['ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA', 'INICIAL'];
    if (tipo_movimiento && !tiposValidos.includes(tipo_movimiento)) {
        errores.push(`El tipo de movimiento debe ser uno de: ${tiposValidos.join(', ')}`);
    }
    
    // Validar fechas
    const errorFechaDesde = validarFecha(fecha_desde, 'fecha_desde');
    if (errorFechaDesde) {
        errores.push(errorFechaDesde);
    }
    
    const errorFechaHasta = validarFecha(fecha_hasta, 'fecha_hasta');
    if (errorFechaHasta) {
        errores.push(errorFechaHasta);
    }
    
    // Validar rango de fechas
    if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
        errores.push('La fecha desde no puede ser mayor a la fecha hasta');
    }
    
    // Validar ordenamiento
    const ordenesValidos = ['fecha_movimiento', 'tipo_movimiento', 'cantidad'];
    if (orden && !ordenesValidos.includes(orden)) {
        errores.push(`El campo de orden debe ser uno de: ${ordenesValidos.join(', ')}`);
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de consulta inválidos',
            details: errores,
            codigo: 'INVALID_QUERY_PARAMS'
        });
    }
    
    next();
};

const validarTransferencia = (req, res, next) => {
    const errores = [];
    const { producto_id, almacen_origen_id, almacen_destino_id, cantidad, motivo } = req.body;
    
    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!producto_id || !uuidRegex.test(producto_id)) {
        errores.push('El ID del producto debe ser un UUID válido');
    }
    
    if (!almacen_origen_id || !uuidRegex.test(almacen_origen_id)) {
        errores.push('El ID del almacén origen debe ser un UUID válido');
    }
    
    if (!almacen_destino_id || !uuidRegex.test(almacen_destino_id)) {
        errores.push('El ID del almacén destino debe ser un UUID válido');
    }
    
    // Validar que los almacenes no sean iguales
    if (almacen_origen_id === almacen_destino_id) {
        errores.push('El almacén origen y destino no pueden ser el mismo');
    }
    
    // Validar cantidad
    const errorCantidad = validarNumeroPositivo(cantidad, 'cantidad');
    if (errorCantidad) {
        errores.push(errorCantidad);
    } else if (Number(cantidad) === 0) {
        errores.push('La cantidad debe ser mayor a 0');
    }
    
    // Validar motivo
    if (!motivo || motivo.trim().length < 5) {
        errores.push('El motivo debe tener al menos 5 caracteres');
    } else if (motivo.length > 500) {
        errores.push('El motivo no puede exceder 500 caracteres');
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de transferencia inválidos',
            details: errores,
            codigo: 'INVALID_TRANSFER_DATA'
        });
    }
    
    next();
};

// ==================== VALIDACIONES DE ALERTAS ====================

const validarFiltrosAlertas = (req, res, next) => {
    const errores = [];
    const { page, limit, nivel_prioridad, tipo_alerta, activa } = req.query;
    
    // Validar paginación
    if (page && (isNaN(page) || Number(page) < 1)) {
        errores.push('La página debe ser un número mayor a 0');
    }
    
    if (limit && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 6000)) {
        errores.push('El límite debe ser un número entre 1 y 6000');
    }
    
    // Validar nivel de prioridad
    const nivelesValidos = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
    if (nivel_prioridad && !nivelesValidos.includes(nivel_prioridad)) {
        errores.push(`El nivel de prioridad debe ser uno de: ${nivelesValidos.join(', ')}`);
    }
    
    // Validar tipo de alerta
    const tiposValidos = ['STOCK_MINIMO', 'STOCK_AGOTADO', 'STOCK_NEGATIVO', 'DIFERENCIA_FISICA'];
    if (tipo_alerta && !tiposValidos.includes(tipo_alerta)) {
        errores.push(`El tipo de alerta debe ser uno de: ${tiposValidos.join(', ')}`);
    }
    
    // Validar estado activa
    if (activa && !['true', 'false', 'all'].includes(activa)) {
        errores.push('El parámetro activa debe ser: true, false o all');
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de consulta inválidos',
            details: errores,
            codigo: 'INVALID_QUERY_PARAMS'
        });
    }
    
    next();
};

const validarResolucionAlerta = (req, res, next) => {
    const errores = [];
    const { observaciones_resolucion } = req.body;
    
    // Observaciones opcionales pero si se envían deben ser válidas
    if (observaciones_resolucion !== undefined) {
        if (typeof observaciones_resolucion !== 'string') {
            errores.push('Las observaciones deben ser texto');
        } else if (observaciones_resolucion.length > 1000) {
            errores.push('Las observaciones no pueden exceder 1000 caracteres');
        }
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de resolución inválidos',
            details: errores,
            codigo: 'INVALID_RESOLUTION_DATA'
        });
    }
    
    next();
};

// ==================== VALIDACIONES DE DESPACHOS ====================

const validarFiltrosDespachos = (req, res, next) => {
    const errores = [];
    const { page, limit, estado, fecha_desde, fecha_hasta, almacen_id } = req.query;
    
    // Validar paginación
    if (page && (isNaN(page) || Number(page) < 1)) {
        errores.push('La página debe ser un número mayor a 0');
    }
    
    if (limit && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 6000)) {
        errores.push('El límite debe ser un número entre 1 y 6000');
    }
    
    // Validar estado
    const estadosValidos = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
    if (estado && !estadosValidos.includes(estado)) {
        errores.push(`El estado debe ser uno de: ${estadosValidos.join(', ')}`);
    }
    
    // Validar fechas
    const errorFechaDesde = validarFecha(fecha_desde, 'fecha_desde');
    if (errorFechaDesde) {
        errores.push(errorFechaDesde);
    }
    
    const errorFechaHasta = validarFecha(fecha_hasta, 'fecha_hasta');
    if (errorFechaHasta) {
        errores.push(errorFechaHasta);
    }
    
    // Validar almacén
    if (almacen_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(almacen_id)) {
            errores.push('El ID de almacén debe ser un UUID válido');
        }
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de consulta inválidos',
            details: errores,
            codigo: 'INVALID_QUERY_PARAMS'
        });
    }
    
    next();
};

const validarCambioEstadoDespacho = (req, res, next) => {
    const errores = [];
    const { nuevo_estado, observaciones } = req.body;
    
    // Validar estado
    const estadosValidos = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
    if (!nuevo_estado || !estadosValidos.includes(nuevo_estado)) {
        errores.push(`El nuevo estado debe ser uno de: ${estadosValidos.join(', ')}`);
    }
    
    // Validar observaciones (opcionales)
    if (observaciones !== undefined) {
        if (typeof observaciones !== 'string') {
            errores.push('Las observaciones deben ser texto');
        } else if (observaciones.length > 1000) {
            errores.push('Las observaciones no pueden exceder 1000 caracteres');
        }
    }
    
    // Validaciones específicas por estado
    if (nuevo_estado === 'CANCELADO' && (!observaciones || observaciones.trim().length < 10)) {
        errores.push('Se requieren observaciones de al menos 10 caracteres para cancelar un despacho');
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de cambio de estado inválidos',
            details: errores,
            codigo: 'INVALID_STATE_CHANGE'
        });
    }
    
    next();
};

const validarCreacionDespacho = (req, res, next) => {
    const errores = [];
    const { venta_id, almacen_id, fecha_programada, observaciones_preparacion } = req.body;

    // Validar venta_id
    if (!venta_id || isNaN(venta_id) || Number(venta_id) < 1) {
        errores.push('El ID de venta debe ser un número válido');
    }

    // Validar almacén_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!almacen_id || !uuidRegex.test(almacen_id)) {
        errores.push('El ID del almacén debe ser un UUID válido');
    }

    // Validar fecha programada
    const errorFecha = validarFecha(fecha_programada, 'fecha_programada', true);
    if (errorFecha) {
        errores.push(errorFecha);
    } else {
        const fechaProgramada = new Date(fecha_programada);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fechaProgramada < hoy) {
            errores.push('La fecha programada no puede ser anterior a hoy');
        }
    }

    // Validar observaciones (opcionales)
    if (observaciones_preparacion !== undefined) {
        if (typeof observaciones_preparacion !== 'string') {
            errores.push('Las observaciones deben ser texto');
        } else if (observaciones_preparacion.length > 1000) {
            errores.push('Las observaciones no pueden exceder 1000 caracteres');
        }
    }

    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de creación de despacho inválidos',
            details: errores,
            codigo: 'INVALID_DISPATCH_DATA'
        });
    }

    next();
};

const validarBulkActionsDespachos = (req, res, next) => {
    const errores = [];
    const { despacho_ids } = req.body;

    if (!Array.isArray(despacho_ids)) {
        errores.push('despacho_ids debe ser un array');
    } else if (despacho_ids.length === 0) {
        errores.push('Se requiere al menos un ID de despacho');
    } else if (despacho_ids.length > 100) {
        errores.push('No se pueden procesar más de 100 despachos a la vez');
    } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        despacho_ids.forEach((id, index) => {
            if (!uuidRegex.test(id)) {
                errores.push(`El ID en posición ${index + 1} no es un UUID válido: ${id}`);
            }
        });
    }

    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de bulk action inválidos',
            details: errores,
            codigo: 'INVALID_BULK_ACTION'
        });
    }

    next();
};

const validarAsignacionDespachos = (req, res, next) => {
    const errores = [];
    const { despacho_ids, asignado_a_id, asignado_a_nombre } = req.body;

    if (!Array.isArray(despacho_ids) || despacho_ids.length === 0) {
        errores.push('Se requiere un array válido de IDs de despachos');
    }

    if (!asignado_a_id || isNaN(asignado_a_id) || Number(asignado_a_id) < 1) {
        errores.push('El ID del usuario asignado debe ser un número válido');
    }

    if (asignado_a_nombre !== undefined) {
        if (typeof asignado_a_nombre !== 'string') {
            errores.push('El nombre del usuario asignado debe ser texto');
        } else if (asignado_a_nombre.length < 3) {
            errores.push('El nombre del usuario asignado debe tener al menos 3 caracteres');
        } else if (asignado_a_nombre.length > 200) {
            errores.push('El nombre del usuario asignado no puede exceder 200 caracteres');
        }
    }

    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de asignación inválidos',
            details: errores,
            codigo: 'INVALID_ASSIGNMENT'
        });
    }

    next();
};

// ==================== VALIDACIONES DE REPORTES ====================

const validarParametrosKardex = (req, res, next) => {
    const errores = [];
    const { almacen_id, fecha_desde, fecha_hasta } = req.query;
    
    // Validar almacén (opcional)
    if (almacen_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(almacen_id)) {
            errores.push('El ID de almacén debe ser un UUID válido');
        }
    }
    
    // Validar fechas
    const errorFechaDesde = validarFecha(fecha_desde, 'fecha_desde');
    if (errorFechaDesde) {
        errores.push(errorFechaDesde);
    }
    
    const errorFechaHasta = validarFecha(fecha_hasta, 'fecha_hasta');
    if (errorFechaHasta) {
        errores.push(errorFechaHasta);
    }
    
    // Validar rango de fechas
    if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
        errores.push('La fecha desde no puede ser mayor a la fecha hasta');
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de kardex inválidos',
            details: errores,
            codigo: 'INVALID_KARDEX_PARAMS'
        });
    }
    
    next();
};

const validarParametrosValorizacion = (req, res, next) => {
    const errores = [];
    const { almacen_id, categoria_id } = req.query;
    
    // Validar almacén (opcional)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (almacen_id && !uuidRegex.test(almacen_id)) {
        errores.push('El ID de almacén debe ser un UUID válido');
    }
    
    if (categoria_id && !uuidRegex.test(categoria_id)) {
        errores.push('El ID de categoría debe ser un UUID válido');
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de valorización inválidos',
            details: errores,
            codigo: 'INVALID_VALUATION_PARAMS'
        });
    }
    
    next();
};

// ==================== VALIDACIONES DE UPLOAD ====================

// Validación para archivos Excel (upload masivo)
const validarUploadExcel = (req, res, next) => {
    // Validar que existe archivo
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No se proporcionó archivo Excel',
            codigo: 'NO_FILE_PROVIDED'
        });
    }

    // Validar tipo de archivo
    const validMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
    ];

    if (!validMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            error: 'Solo se permiten archivos Excel (.xlsx, .xls)',
            codigo: 'INVALID_FILE_TYPE'
        });
    }

    // Validar tamaño de archivo (10MB máximo)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (req.file.size > MAX_SIZE) {
        return res.status(400).json({
            success: false,
            error: 'El archivo no puede exceder 10MB',
            codigo: 'FILE_TOO_LARGE'
        });
    }

    // Validar que tiene contenido
    if (!req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'El archivo está vacío',
            codigo: 'EMPTY_FILE'
        });
    }

    next();
};

const validarUploadMasivo = (req, res, next) => {
    const errores = [];
    const { productos } = req.body;

    // Validar estructura básica
    if (!Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere un array de productos válido',
            codigo: 'INVALID_PRODUCTS_ARRAY'
        });
    }

    // Validar límite de productos
    const MAX_PRODUCTOS = 5000;
    if (productos.length > MAX_PRODUCTOS) {
        return res.status(400).json({
            success: false,
            error: `No se pueden procesar más de ${MAX_PRODUCTOS} productos a la vez`,
            codigo: 'TOO_MANY_PRODUCTS'
        });
    }
    
    // Validar estructura de cada producto (muestra de primeros 5)
    const muestraValidacion = productos.slice(0, 5);
    const camposRequeridos = ['codigo_producto', 'almacen_codigo', 'stock_actual', 'stock_minimo'];
    
    muestraValidacion.forEach((producto, index) => {
        camposRequeridos.forEach(campo => {
            if (!producto.hasOwnProperty(campo)) {
                errores.push(`Producto ${index + 1}: falta campo '${campo}'`);
            }
        });
        
        // Validaciones específicas
        if (producto.stock_actual !== undefined && (isNaN(producto.stock_actual) || Number(producto.stock_actual) < 0)) {
            errores.push(`Producto ${index + 1}: stock_actual debe ser un número no negativo`);
        }
        
        if (producto.stock_minimo !== undefined && (isNaN(producto.stock_minimo) || Number(producto.stock_minimo) < 0)) {
            errores.push(`Producto ${index + 1}: stock_minimo debe ser un número no negativo`);
        }
    });
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Estructura de datos inválida',
            details: errores,
            codigo: 'INVALID_UPLOAD_STRUCTURE'
        });
    }
    
    next();
};

// ==================== VALIDACIONES DE INTEGRACIÓN ====================

const validarVerificacionStock = (req, res, next) => {
    const errores = [];
    const { productos, almacen_id } = req.body;
    
    // Validar productos
    if (!Array.isArray(productos) || productos.length === 0) {
        errores.push('Se requiere un array de productos válido');
    } else {
        productos.forEach((producto, index) => {
            if (!producto.producto_id || !producto.cantidad) {
                errores.push(`Producto ${index + 1}: requiere producto_id y cantidad`);
            }
            
            const errorCantidad = validarNumeroPositivo(producto.cantidad, `cantidad del producto ${index + 1}`);
            if (errorCantidad) {
                errores.push(errorCantidad);
            }
        });
    }
    
    // Validar almacén (opcional)
    if (almacen_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(almacen_id)) {
            errores.push('El ID de almacén debe ser un UUID válido');
        }
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de verificación de stock inválidos',
            details: errores,
            codigo: 'INVALID_STOCK_CHECK'
        });
    }
    
    next();
};

const validarDescuentoStock = (req, res, next) => {
    const errores = [];
    const { venta_id, productos, almacen_id } = req.body;
    
    // Validar venta_id
    if (!venta_id || isNaN(venta_id) || Number(venta_id) < 1) {
        errores.push('El ID de venta debe ser un número válido');
    }
    
    // Validar almacén_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!almacen_id || !uuidRegex.test(almacen_id)) {
        errores.push('El ID del almacén debe ser un UUID válido');
    }
    
    // Validar productos
    if (!Array.isArray(productos) || productos.length === 0) {
        errores.push('Se requiere un array de productos válido');
    } else {
        productos.forEach((producto, index) => {
            if (!producto.producto_id || !producto.cantidad) {
                errores.push(`Producto ${index + 1}: requiere producto_id y cantidad`);
            }
            
            const errorCantidad = validarNumeroPositivo(producto.cantidad, `cantidad del producto ${index + 1}`);
            if (errorCantidad) {
                errores.push(errorCantidad);
            }
            
            // Precio unitario opcional pero si se envía debe ser válido
            if (producto.precio_unitario !== undefined) {
                const errorPrecio = validarNumeroPositivo(producto.precio_unitario, `precio_unitario del producto ${index + 1}`);
                if (errorPrecio) {
                    errores.push(errorPrecio);
                }
            }
        });
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Datos de descuento de stock inválidos',
            details: errores,
            codigo: 'INVALID_STOCK_DEDUCTION'
        });
    }
    
    next();
};

    const validarParametrosPeriodo = (req, res, next) => {
    const errores = [];
    const { fecha_desde, fecha_hasta, almacen_id } = req.query;
    
    // Validar fechas
    const errorFechaDesde = validarFecha(fecha_desde, 'fecha_desde');
    if (errorFechaDesde) {
        errores.push(errorFechaDesde);
    }
    
    const errorFechaHasta = validarFecha(fecha_hasta, 'fecha_hasta');
    if (errorFechaHasta) {
        errores.push(errorFechaHasta);
    }
    
    // Validar rango de fechas
    if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
        errores.push('La fecha desde no puede ser mayor a la fecha hasta');
    }
    
    // Validar almacén (opcional)
    if (almacen_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(almacen_id)) {
            errores.push('El ID de almacén debe ser un UUID válido');
        }
    }
    
    if (errores.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Parámetros de período inválidos',
            details: errores,
            codigo: 'INVALID_PERIOD_PARAMS'
        });
    }
    
    next();
};

// ==================== MIDDLEWARE GENERAL DE VALIDACIÓN ====================

const manejarErroresValidacion = (error, req, res, next) => {
    if (error.name === 'ValidationError') {
        logger.warn('Error de validación:', {
            error: error.message,
            ruta: req.originalUrl,
            metodo: req.method,
            body: req.body,
            params: req.params,
            query: req.query
        });
        
        return res.status(400).json({
            success: false,
            error: 'Datos de entrada inválidos',
            details: error.message,
            codigo: 'VALIDATION_ERROR'
        });
    }
    
    next(error);
};

module.exports = {
    // Validaciones generales
    validarUUID,
    validarNumeroPositivo,
    validarFecha,
    
    // Validaciones de inventario
    validarFiltrosInventario,
    validarActualizacionStock,
    
    // Validaciones de movimientos
    validarFiltrosMovimientos,
    validarTransferencia,

    // Validaciones de alertas
    validarFiltrosAlertas,
    validarResolucionAlerta,
    
    // Validaciones de despachos
    validarFiltrosDespachos,
    validarCambioEstadoDespacho,
    validarCreacionDespacho,
    validarBulkActionsDespachos,
    validarAsignacionDespachos,
    
    // Validaciones de reportes
    validarParametrosKardex,
    validarParametrosValorizacion,
    validarParametrosPeriodo,
    
    // Validaciones de upload
    validarUploadExcel,
    validarUploadMasivo,
    
    // Validaciones de integración
    validarVerificacionStock,
    validarDescuentoStock,
    
    // Middleware general
    manejarErroresValidacion
};