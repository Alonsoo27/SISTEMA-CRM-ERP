// ============================================
// VENTAS CONTROLLER - ENTERPRISE VERSION OPTIMIZED
// Sistema CRM/ERP v2.0 - Production Ready
// ============================================

const { query } = require('../../../config/database');
const VentasService = require('../services/ventasService');
const ConversionService = require('../services/ConversionService');
const almacenService = require('../../almacen/services/almacenService');
const ClientesFrecuentesService = require('../services/ClientesFrecuentesService');
// Funciones para manejar timezone de Lima
const convertirLimaAUTC = (fechaLima) => {
    if (!fechaLima) return null;
    const fecha = new Date(fechaLima + 'T00:00:00-05:00');
    return fecha.toISOString();
};

const obtenerFechaActualLima = () => {
    const ahora = new Date();
    const fechaLima = new Date(ahora.getTime() - (5 * 60 * 60 * 1000));
    return fechaLima.toISOString().split('T')[0];
};

const validarFechaLima = (fechaInput) => {
    if (!fechaInput) return { valida: true, fecha: null };
    try {
        const fechaLima = new Date(fechaInput + 'T12:00:00-05:00');
        const hoyLima = new Date(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit'
        }).format(new Date()) + 'T12:00:00-05:00');
        const hace30DiasLima = new Date(hoyLima.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        if (isNaN(fechaLima.getTime())) {
            return { valida: false, error: 'Formato de fecha inválido' };
        }
        if (fechaLima > hoyLima) {
            return { valida: false, error: 'La fecha de venta no puede ser futura (Lima)' };
        }
        if (fechaLima < hace30DiasLima) {
            return { valida: false, error: 'La fecha de venta no puede ser anterior a 30 días (Lima)' };
        }
        return { valida: true, fecha: fechaLima };
    } catch (error) {
        return { valida: false, error: 'Error al procesar fecha' };
    }
};
// ============================================
// ENTERPRISE LOGGING (Simplificado)
// ============================================
const isDevelopment = process.env.NODE_ENV === 'development';

const logRequest = (methodName, req, additionalInfo = {}) => {
    if (!isDevelopment) return;
    console.log(`\n=== VENTAS: ${methodName} ===`);
    console.log('User:', req.user?.nombre || 'Unknown', `(${req.user?.id})`);
    if (Object.keys(additionalInfo).length > 0) {
        console.log('Context:', additionalInfo);
    }
    console.log('================================\n');
};

const logSuccess = (methodName, result, duration = null) => {
    if (!isDevelopment) return;
    console.log(`✅ ${methodName} completed successfully`);
    if (duration) console.log(`⏱️  Duration: ${duration}ms`);
    if (result.count !== undefined) console.log(`📊 Records: ${result.count}`);
    if (result.value !== undefined) console.log(`💰 Value: $${result.value}`);
    console.log('================================\n');
};

const logError = (methodName, error, context = {}) => {
    console.error(`❌ ${methodName} failed:`, error.message);
    console.error('Context:', context);
    if (isDevelopment) {
        console.error('Stack:', error.stack);
    }
    console.error('================================\n');
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const generarCodigoVenta = async () => {
    try {
        const fecha = new Date();
        const año = fecha.getFullYear().toString().slice(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        
        const ultimoResult = await query(`
            SELECT codigo FROM ventas 
            WHERE codigo LIKE 'VT${año}${mes}%' 
            ORDER BY codigo DESC 
            LIMIT 1
        `);

        let siguienteNumero = 1;
        if (ultimoResult.rows.length > 0) {
            const ultimoCodigo = ultimoResult.rows[0].codigo;
            const ultimoNumero = parseInt(ultimoCodigo.slice(-4));
            siguienteNumero = ultimoNumero + 1;
        }

        return `VT${año}${mes}${siguienteNumero.toString().padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating sales code:', error);
        return `VT${Date.now().toString().slice(-8)}`;
    }
};

const validarEmail = (email) => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validarTelefono = (telefono) => {
    if (!telefono) return true;
    const telefonoRegex = /^[\d\s\-\+\(\)]{7,20}$/;
    return telefonoRegex.test(telefono);
};

// ============================================
// LISTAR VENTAS CON FILTROS
// ============================================
exports.listarVentas = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('listarVentas', req);

        const {
            page = 1, limit = 10, pagina = 1, limite = 10,
            estado_detallado, canal_origen, tipo_venta, asesor_id, jefe_id, equipo,
            fecha_desde, fecha_hasta, search, orden = 'fecha_creacion', direccion = 'DESC'
        } = req.query;

        const finalPage = pagina || page;
        const finalLimit = limite || limit;
        const pageNum = Math.max(1, parseInt(finalPage));
        const limitNum = Math.min(Math.max(1, parseInt(finalLimit)), 100);
        const offset = (pageNum - 1) * limitNum;
        
        // Procesar campo de ordenamiento
        let campoOrden = 'fecha_creacion';
        let direccionOrden = 'DESC';
        
        if (orden.includes('_desc')) {
            campoOrden = orden.replace('_desc', '');
            direccionOrden = 'DESC';
        } else if (orden.includes('_asc')) {
            campoOrden = orden.replace('_asc', '');
            direccionOrden = 'ASC';
        } else {
            campoOrden = orden;
            direccionOrden = ['ASC', 'DESC'].includes(direccion.toUpperCase()) ? direccion.toUpperCase() : 'DESC';
        }
        
        const camposValidos = ['fecha_creacion', 'valor_final', 'estado_detallado', 'canal_origen', 'tipo_venta', 'nombre_cliente', 'codigo', 'fecha_venta'];
        campoOrden = camposValidos.includes(campoOrden) ? campoOrden : 'fecha_creacion';

        // Construir WHERE dinámico
        let whereClause = 'WHERE v.activo = true';
        const params = [];
        let paramCount = 0;

        if (estado_detallado) {
            paramCount++;
            whereClause += ` AND v.estado_detallado = $${paramCount}`;
            params.push(estado_detallado);
        }

        if (canal_origen) {
            paramCount++;
            whereClause += ` AND v.canal_origen = $${paramCount}`;
            params.push(canal_origen);
        }

        if (tipo_venta) {
            paramCount++;
            whereClause += ` AND v.tipo_venta = $${paramCount}`;
            params.push(tipo_venta);
        }

        if (asesor_id) {
            paramCount++;
            whereClause += ` AND v.asesor_id = $${paramCount}`;
            params.push(asesor_id);
        }

        // Filtro por equipo: ventas de todos los vendedores (asesores) y SUPER_ADMIN
        if (jefe_id && equipo === 'true') {
            // JEFE_VENTAS ve todas las ventas de vendedores + SUPER_ADMIN
            whereClause += ` AND (v.asesor_id IN (
                SELECT id FROM usuarios WHERE vende = true AND activo = true
            ) OR v.asesor_id = 1)`;
            // No necesitamos parámetro jefe_id en esta lógica simplificada
        }

        if (fecha_desde) {
            paramCount++;
            whereClause += ` AND v.fecha_creacion >= $${paramCount}`;
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            paramCount++;
            whereClause += ` AND v.fecha_creacion <= $${paramCount}`;
            params.push(fecha_hasta + ' 23:59:59');
        }

        if (search && search.trim().length >= 2) {
            paramCount++;
            whereClause += ` AND (v.codigo ILIKE $${paramCount} OR CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) ILIKE $${paramCount} OR v.cliente_empresa ILIKE $${paramCount})`;
            params.push(`%${search.trim()}%`);
        }

        const ventasQuery = `
            SELECT 
                v.*,
                CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) as cliente_nombre_completo,
                u.nombre as asesor_nombre,
                u.apellido as asesor_apellido,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as asesor_nombre_completo,
                COALESCE(productos_info.total_productos, 0) as total_productos,
                COALESCE(productos_info.total_items, 0) as total_items,
                CASE 
                    WHEN v.fecha_entrega_estimada < NOW() AND v.estado_detallado NOT IN ('vendido/enviado/recibido/capacitado', 'anulado') 
                    THEN true 
                    ELSE false 
                END as atrasada,
                CASE 
                    WHEN v.fecha_entrega_estimada BETWEEN NOW() AND NOW() + INTERVAL '7 days' 
                    AND v.estado_detallado NOT IN ('vendido/enviado/recibido/capacitado', 'anulado')
                    THEN true 
                    ELSE false 
                END as proxima_entrega
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            LEFT JOIN (
                SELECT 
                    vd.venta_id,
                    COUNT(*) as total_productos,
                    SUM(vd.cantidad) as total_items
                FROM venta_detalles vd
                WHERE vd.activo = true
                GROUP BY vd.venta_id
            ) productos_info ON v.id = productos_info.venta_id
            ${whereClause}
            ORDER BY v.${campoOrden} ${direccionOrden}
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        params.push(limitNum, offset);

        const countQuery = `
            SELECT COUNT(DISTINCT v.id) as total
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            ${whereClause}
        `;

        const [ventasResult, countResult] = await Promise.all([
            query(ventasQuery, params),
            query(countQuery, params.slice(0, -2))
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limitNum);

        const ventasFormateadas = ventasResult.rows.map(venta => ({
            ...venta,
            asesor_nombre_completo: venta.asesor_nombre_completo || 'Sin asignar',
            cliente_nombre_completo: venta.cliente_nombre_completo || 'Sin nombre',
            valor_final: parseFloat(venta.valor_final || 0),
            valor_total: parseFloat(venta.valor_total || 0),
            total_productos: parseInt(venta.total_productos || 0),
            total_items: parseInt(venta.total_items || 0),
            indicadores: {
                atrasada: venta.atrasada,
                proxima_entrega: venta.proxima_entrega,
                tiene_productos: parseInt(venta.total_productos) > 0,
                valor_promedio_item: venta.total_items > 0 ? (venta.valor_final / venta.total_items) : 0
            }
        }));

        const metricas = {
            total_valor: ventasFormateadas.reduce((sum, v) => sum + v.valor_final, 0),
            promedio_venta: ventasFormateadas.length > 0 ? 
                ventasFormateadas.reduce((sum, v) => sum + v.valor_final, 0) / ventasFormateadas.length : 0,
            ventas_atrasadas: ventasFormateadas.filter(v => v.indicadores.atrasada).length,
            proximas_entregas: ventasFormateadas.filter(v => v.indicadores.proxima_entrega).length
        };

        const duration = Date.now() - startTime;
        logSuccess('listarVentas', { count: ventasFormateadas.length, value: metricas.total_valor }, duration);

        res.json({
            success: true,
            data: {
                ventas: ventasFormateadas,
                pagination: {
                    current_page: pageNum,
                    pagina_actual: pageNum,
                    total_pages: totalPages,
                    total_paginas: totalPages,
                    total_records: total,
                    total_registros: total,
                    limit: limitNum,
                    limite: limitNum,
                    has_next: pageNum < totalPages,
                    has_prev: pageNum > 1
                },
                metricas: metricas,
                filtros_aplicados: {
                    estado_detallado, canal_origen, tipo_venta, asesor_id, jefe_id, equipo,
                    fecha_desde, fecha_hasta, search,
                    orden: campoOrden, direccion: direccionOrden
                }
            }
        });

    } catch (error) {
        logError('listarVentas', error, { query: req.query });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// OBTENER DETALLE COMPLETO DE VENTA
// ============================================
exports.obtenerVenta = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('obtenerVenta', req, { ventaId: req.params.id });

        const { id } = req.params;
        const ventaId = parseInt(id);
        
        if (isNaN(ventaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta inválido'
            });
        }

        const ventaQuery = `
            SELECT 
                v.*,
                CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) as cliente_nombre_completo,
                u.nombre as asesor_nombre,
                u.apellido as asesor_apellido,
                u.email as asesor_email,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as asesor_nombre_completo,
                CONCAT(p.nombre_cliente, ' ', COALESCE(p.apellido_cliente, '')) as prospecto_nombre,
                p.empresa as prospecto_empresa,
                p.telefono as prospecto_telefono,
                p.email as prospecto_email
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            LEFT JOIN prospectos p ON v.prospecto_id = p.id
            WHERE v.id = $1 AND v.activo = true
        `;

        const detallesQuery = `
            SELECT 
                vd.*,
                pr.codigo as producto_codigo,
                pr.descripcion as producto_nombre,
                pr.descripcion as producto_descripcion,
                pr.precio_sin_igv as precio_actual_producto,
                pr.unidad_medida,
                pr.marca,
                CASE 
                    WHEN vd.precio_unitario != pr.precio_sin_igv 
                    THEN true 
                    ELSE false 
                END as precio_personalizado
            FROM venta_detalles vd
            LEFT JOIN productos pr ON vd.producto_id = pr.id
            WHERE vd.venta_id = $1
        `;

        const [ventaResult, detallesResult] = await Promise.all([
            query(ventaQuery, [ventaId]),
            query(detallesQuery, [ventaId])
        ]);

        if (ventaResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        const venta = ventaResult.rows[0];
        
        venta.detalles = detallesResult.rows.map(detalle => ({
            ...detalle,
            cantidad: parseFloat(detalle.cantidad || 0),
            precio_unitario: parseFloat(detalle.precio_unitario || 0),
            subtotal: parseFloat(detalle.subtotal || 0),
            total_linea: parseFloat(detalle.total_linea || 0)
        }));

        venta.analisis = {
            total_productos: venta.detalles.length,
            total_items: venta.detalles.reduce((sum, d) => sum + d.cantidad, 0),
            margen_estimado: parseFloat(venta.valor_total || 0) - venta.detalles.reduce((sum, d) => 
                sum + (d.cantidad * parseFloat(d.precio_actual_producto || d.precio_unitario || 0)), 0),
            productos_personalizados: venta.detalles.filter(d => d.precio_personalizado).length,
            descuento_efectivo: venta.valor_total > 0 ? 
                ((parseFloat(venta.valor_total) - parseFloat(venta.valor_final)) / parseFloat(venta.valor_total) * 100) : 0
        };

        venta.valor_total = parseFloat(venta.valor_total || 0);
        venta.valor_final = parseFloat(venta.valor_final || 0);
        venta.descuento_porcentaje = parseFloat(venta.descuento_porcentaje || 0);
        venta.descuento_monto = parseFloat(venta.descuento_monto || 0);
        venta.probabilidad_cierre = parseFloat(venta.probabilidad_cierre || 0);

        const duration = Date.now() - startTime;
        logSuccess('obtenerVenta', { 
            code: venta.codigo || venta.id, 
            products: venta.detalles.length,
            value: venta.valor_final 
        }, duration);

        res.json({
            success: true,
            data: venta
        });

    } catch (error) {
        logError('obtenerVenta', error, { ventaId: req.params.id });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// CREAR NUEVA VENTA
// ============================================
exports.crearVenta = async (req, res) => {
     console.log('🔍 [INICIO] Función crearVenta ejecutándose...');
    console.log('🔍 [INICIO] req.body.fecha_entrega_estimada:', req.body.fecha_entrega_estimada);
    const startTime = Date.now();
    
    try {
        logRequest('crearVenta', req);

        const {
        prospecto_id, nombre_cliente, apellido_cliente, cliente_empresa,
        cliente_email, cliente_telefono, canal_contacto,
        ciudad, departamento, distrito, valor_total,
        descuento_porcentaje = 0, descuento_monto = 0,
        estado_detallado = 'vendido', canal_origen = 'venta-directa',
        tipo_venta = 'boleta', probabilidad_cierre = 50,
        fecha_entrega_estimada, fecha_venta, notas_internas,
        condiciones_especiales, detalles = [], productos = [],
        es_venta_presencial = false, se_lo_llevo_directamente = false,
        recibio_capacitacion_inmediata = false, observaciones_almacen,
        es_cliente_frecuente_manual = false
    } = req.body;


        const productosArray = productos.length > 0 ? productos : detalles;
        const validaciones = [];

        // Validaciones básicas
        if (!nombre_cliente || nombre_cliente.trim().length < 2) {
            validaciones.push('El nombre del cliente debe tener al menos 2 caracteres');
        }

        if (!valor_total || parseFloat(valor_total) <= 0) {
            validaciones.push('El valor total debe ser mayor a 0');
        }

        if (cliente_email && !validarEmail(cliente_email)) {
            validaciones.push('Formato de email inválido');
        }

        if (cliente_telefono && !validarTelefono(cliente_telefono)) {
            validaciones.push('Formato de teléfono inválido');
        }

        if (parseFloat(descuento_porcentaje) < 0 || parseFloat(descuento_porcentaje) > 100) {
            validaciones.push('El descuento porcentual debe estar entre 0 y 100');
        }

        if (parseFloat(probabilidad_cierre) < 0 || parseFloat(probabilidad_cierre) > 100) {
            validaciones.push('La probabilidad de cierre debe estar entre 0 y 100');
        }

        // Validaciones de campos específicos
        const estadosDetalladosValidos = [
            'vendido', 'vendido/enviado', 'vendido/enviado/recibido', 
            'vendido/enviado/recibido/capacitado', 'anulado',
            'cambio', 'cambio/enviado', 'cambio/enviado/recibido'
        ];
        if (!estadosDetalladosValidos.includes(estado_detallado)) {
            validaciones.push('Estado detallado no válido');
        }

        const canalesOrigenValidos = ['venta-directa', 'pipeline-convertido'];
        if (!canalesOrigenValidos.includes(canal_origen)) {
            validaciones.push('Canal de origen no válido');
        }

        const tiposVentaValidos = ['factura', 'boleta', 'nota_venta'];
        if (!tiposVentaValidos.includes(tipo_venta)) {
            validaciones.push('Tipo de venta no válido');
        }

        // Validación de fecha_venta
        if (fecha_venta) {
            const validacionFecha = validarFechaLima(fecha_venta);
            if (!validacionFecha.valida) {
                validaciones.push(validacionFecha.error);
            }
        }

        if (validaciones.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación',
                errores: validaciones
            });
        }

        // Calcular valor final
        const valorTotalNum = parseFloat(valor_total);
        const descuentoPorcentajeNum = parseFloat(descuento_porcentaje);
        const descuentoMontoNum = parseFloat(descuento_monto);
        const descuentoTotal = descuentoMontoNum + (valorTotalNum * descuentoPorcentajeNum / 100);
        const valorFinal = Math.max(0, valorTotalNum - descuentoTotal);

        // Generar correlativos
        let codigoVenta = req.body.codigo;
        let correlativoAsesor = req.body.correlativo_asesor;

        if (!codigoVenta) {
            try {
                const correlativosResult = await query(
                    'SELECT * FROM obtener_nuevos_correlativos($1, $2)',
                    [req.user.id, new Date().getFullYear()]
                );

                if (correlativosResult.rows.length > 0) {
                    codigoVenta = correlativosResult.rows[0].codigo_global;
                    correlativoAsesor = correlativosResult.rows[0].correlativo_asesor;
                }
            } catch (correlativosError) {
                codigoVenta = await generarCodigoVenta();
            }
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // 🆕 CREAR O BUSCAR CLIENTE AUTOMÁTICAMENTE
            let clienteId = null;

            // El frontend envía como cliente_documento, no numero_documento
            let tipo_documento = req.body.tipo_documento;
            const numero_documento = req.body.numero_documento || req.body.cliente_documento;

            // 🔍 DEBUG TEMPORAL - VER QUÉ LLEGA DEL FRONTEND
            console.log('🔍 [FRONTEND DATA]:', {
                tipo_documento: req.body.tipo_documento,
                numero_documento: numero_documento,
                nombre_cliente: req.body.nombre_cliente,
                apellido_cliente: req.body.apellido_cliente,
                cliente_empresa: req.body.cliente_empresa
            });

            // ⚡ VALIDACIÓN Y LIMPIEZA DE TIPO_DOCUMENTO
            const tiposValidos = ['DNI', 'RUC', 'PASAPORTE', 'CE'];

            // Si no es válido, intentar auto-detectar por longitud
            if (!tiposValidos.includes(tipo_documento) && numero_documento) {
                const doc = numero_documento.trim();
                if (/^\d{8}$/.test(doc)) {
                    tipo_documento = 'DNI';
                } else if (/^\d{11}$/.test(doc)) {
                    tipo_documento = 'RUC';
                } else if (/^[A-Z0-9]{6,12}$/i.test(doc)) {
                    tipo_documento = 'PASAPORTE';
                } else {
                    // Si no se puede detectar, no crear cliente
                    tipo_documento = null;
                }
            }

            if (tipo_documento && tiposValidos.includes(tipo_documento) && numero_documento) {
                // Buscar cliente existente
                const clienteExistente = await query(
                    'SELECT id FROM clientes WHERE numero_documento = $1 AND activo = true',
                    [numero_documento.trim()]
                );

                if (clienteExistente.rows.length > 0) {
                    // Cliente existe
                    clienteId = clienteExistente.rows[0].id;
                    console.log(`✅ Cliente existente encontrado: ID ${clienteId}`);

                    // 🔄 ACTUALIZAR UBICACIÓN SI ESTÁ VACÍA
                    // Verificar si el cliente tiene ubicación completa
                    const ubicacionActual = await query(
                        'SELECT departamento, provincia, distrito FROM clientes WHERE id = $1',
                        [clienteId]
                    );

                    if (ubicacionActual.rows.length > 0) {
                        const { departamento: depActual, provincia: provActual, distrito: distActual } = ubicacionActual.rows[0];
                        const ubicacionVacia = !depActual && !provActual && !distActual;

                        // Si la ubicación está vacía y vienen datos nuevos, actualizar
                        if (ubicacionVacia && (departamento || ciudad || distrito)) {
                            await query(
                                `UPDATE clientes
                                 SET departamento = $1, provincia = $2, distrito = $3, updated_at = NOW(), updated_by = $4
                                 WHERE id = $5`,
                                [departamento?.trim() || null, ciudad?.trim() || null, distrito?.trim() || null, req.user.id, clienteId]
                            );
                            console.log(`🔄 Ubicación actualizada para cliente ID ${clienteId}`);
                        }
                    }
                } else {
                    // ⚡ DETECTAR TIPO POR DOCUMENTO, NO POR CAMPO EMPRESA
                    const tipoCliente = tipo_documento === 'RUC' ? 'empresa' : 'persona';

                    const nuevoClienteQuery = `
                        INSERT INTO clientes (
                            tipo_cliente, nombres, apellidos, razon_social,
                            tipo_documento, numero_documento, telefono, email,
                            direccion, distrito, provincia, departamento,
                            estado, activo, created_by, updated_by
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'activo', true, $13, $13
                        ) RETURNING id
                    `;

                    const nuevoClienteResult = await query(nuevoClienteQuery, [
                        tipoCliente,
                        tipoCliente === 'persona' ? nombre_cliente.trim() : null,
                        tipoCliente === 'persona' ? (apellido_cliente?.trim() || null) : null,
                        tipoCliente === 'empresa' ? (cliente_empresa || nombre_cliente.trim()) : null,
                        tipo_documento,
                        numero_documento.trim(),
                        cliente_telefono,
                        cliente_email,
                        req.body.direccion || null,
                        distrito?.trim() || null,
                        departamento?.trim() || null,
                        ciudad?.trim() || null,
                        req.user.id
                    ]);

                    clienteId = nuevoClienteResult.rows[0].id;
                    console.log(`🆕 Nuevo cliente creado automáticamente: ID ${clienteId}`);
                }
            }

            // ⚡ CALCULAR CAMPOS DE IGV
            const incluyeIgv = tipo_venta === 'factura' || tipo_venta === 'boleta';
            const baseImponible = incluyeIgv ? parseFloat((valorFinal / 1.18).toFixed(2)) : valorFinal;
            const igvMonto = incluyeIgv ? parseFloat((valorFinal - baseImponible).toFixed(2)) : 0;

            console.log(`💰 IGV Calculado - Tipo: ${tipo_venta}, Incluye IGV: ${incluyeIgv}, Base: ${baseImponible}, IGV: ${igvMonto}, Total: ${valorFinal}`);

            // 🔍 VERIFICAR SI CLIENTE ES FRECUENTE (MANUAL O AUTOMÁTICO)
            let asesorIdFinal = req.user.id;

            // ⚡ PRIORIDAD 1: Checkbox manual marcado
            if (es_cliente_frecuente_manual === true) {
                asesorIdFinal = 19; // Usuario EMPRESA
                console.log('✅ [ClienteFrecuente-MANUAL] Checkbox marcado → Asignando a EMPRESA (ID: 19)');
            }
            // ⚡ PRIORIDAD 2: Verificación automática en base de datos
            else if (clienteId && productosArray && productosArray.length > 0) {
                const verificacion = await ClientesFrecuentesService.verificarTodasLineasFrecuentes(
                    clienteId,
                    productosArray
                );

                console.log('🔍 [ClienteFrecuente-AUTO] Resultado verificación:', verificacion);

                if (verificacion.todasFrecuentes) {
                    asesorIdFinal = 19; // Usuario EMPRESA
                    console.log('✅ [ClienteFrecuente-AUTO] TODAS las líneas son frecuentes → Asignando a EMPRESA (ID: 19)');
                } else {
                    console.log(`✅ [ClienteFrecuente-AUTO] Al menos una línea NO frecuente → Asignando a asesor (ID: ${req.user.id})`);
                    console.log('📊 [ClienteFrecuente-AUTO] Detalles:', verificacion.detalles);
                }
            }

            const ventaQuery = `
    INSERT INTO ventas (
        codigo, correlativo_asesor, prospecto_id, asesor_id, cliente_id,
        nombre_cliente, apellido_cliente, cliente_empresa,
        cliente_email, cliente_telefono, canal_contacto,
        ciudad, departamento, distrito,
        valor_total, descuento_porcentaje, descuento_monto, valor_final,
        incluye_igv, base_imponible, igv_monto,
        estado_detallado, canal_origen, tipo_venta,
        probabilidad_cierre, fecha_entrega_estimada, fecha_venta,
        notas_internas, condiciones_especiales,
        es_venta_presencial, se_lo_llevo_directamente, recibio_capacitacion_inmediata,
        observaciones_almacen, activo, created_by, updated_by, created_at, updated_at
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, true, $34, $34, NOW(), NOW()
    ) RETURNING *
`;

            const ventaResult = await query(ventaQuery, [
                codigoVenta, correlativoAsesor, prospecto_id, asesorIdFinal, clienteId,
                nombre_cliente.trim(), apellido_cliente?.trim() || null, cliente_empresa,
                cliente_email, cliente_telefono, canal_contacto || 'WhatsApp',
                ciudad?.trim() || '', departamento?.trim() || '', distrito?.trim() || '',
                valorTotalNum, descuentoPorcentajeNum, descuentoMontoNum, valorFinal,
                incluyeIgv, baseImponible, igvMonto, // ⚡ NUEVOS CAMPOS IGV
                estado_detallado, canal_origen, tipo_venta,
                probabilidad_cierre,
                    fecha_entrega_estimada ? convertirLimaAUTC(fecha_entrega_estimada) : null,
                    fecha_venta ? convertirLimaAUTC(fecha_venta) : convertirLimaAUTC(obtenerFechaActualLima()),
                notas_internas, condiciones_especiales,
                es_venta_presencial, se_lo_llevo_directamente, recibio_capacitacion_inmediata,
                observaciones_almacen, req.user.id
            ]);

            const nuevaVenta = ventaResult.rows[0];

            // Insertar detalles de productos
            if (productosArray && productosArray.length > 0) {
                for (let i = 0; i < productosArray.length; i++) {
                    const item = productosArray[i];
                    
                    const producto = {
                        producto_id: item.producto_id || item.id,
                        cantidad: item.cantidad,
                        precio_unitario: item.precio_unitario,
                        descuento_monto: item.descuento_monto || 0,
                        descripcion_personalizada: item.descripcion_personalizada || item.nombre || null
                    };
                    
                    if (!producto.producto_id || !producto.cantidad || !producto.precio_unitario) {
                        throw new Error(`Producto ${i + 1}: Faltan datos obligatorios`);
                    }

                    if (parseFloat(producto.cantidad) <= 0 || parseFloat(producto.precio_unitario) <= 0) {
                        throw new Error(`Producto ${i + 1}: Cantidad y precio deben ser mayores a 0`);
                    }

                    const cantidad = parseFloat(producto.cantidad);
                    const precioUnitario = parseFloat(producto.precio_unitario);
                    const subtotal = cantidad * precioUnitario;
                    const descuentoLinea = parseFloat(producto.descuento_monto || 0);
                    const totalLinea = Math.max(0, subtotal - descuentoLinea);

                    await query(`
                        INSERT INTO venta_detalles (
                            venta_id, producto_id, cantidad, precio_unitario, subtotal,
                            descuento_monto, total_linea, descripcion_personalizada, orden_linea,
                            created_by, updated_by, created_at, updated_at, activo
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, NOW(), NOW(), true)
                    `, [
                        nuevaVenta.id, producto.producto_id, cantidad,
                        precioUnitario, subtotal, descuentoLinea, totalLinea,
                        producto.descripcion_personalizada, i + 1, req.user.id
                    ]);
                }
            }

            // 🔄 ACTUALIZAR TABLA DE CLIENTES FRECUENTES
            if (clienteId && nuevaVenta.id) {
                try {
                    const actualizacion = await ClientesFrecuentesService.actualizarLineasFrecuentes(nuevaVenta.id);
                    console.log('✅ [ClienteFrecuente] Tabla actualizada:', actualizacion);
                } catch (errorFrecuente) {
                    // No es crítico, solo loguear
                    console.log('⚠️ [ClienteFrecuente] Error al actualizar (no crítico):', errorFrecuente.message);
                }
            }

            // Actualizar prospecto si existe - SINCRONIZAR DATOS CORREGIDOS
            if (prospecto_id) {
                try {
                    await query(`
                        UPDATE prospectos
                        SET
                            estado = 'Convertido',
                            venta_id = $1,
                            -- 🔄 SINCRONIZAR DATOS CORREGIDOS DEL CLIENTE
                            nombre_cliente = $2,
                            apellido_cliente = $3,
                            empresa = $4,
                            telefono = $5,
                            email = $6,
                            departamento = $7,
                            ciudad = $8,
                            distrito = $9,
                            updated_at = NOW(),
                            updated_by = $10
                        WHERE id = $11 AND activo = true
                    `, [
                        nuevaVenta.id,
                        nombre_cliente.trim(),
                        apellido_cliente?.trim() || null,
                        cliente_empresa || null,
                        cliente_telefono || null,
                        cliente_email || null,
                        departamento?.trim() || null,
                        ciudad?.trim() || null,
                        distrito?.trim() || null,
                        req.user.id,
                        prospecto_id
                    ]);

                    if (isDevelopment) {
                        console.log(`✅ Prospecto ${prospecto_id} actualizado con datos corregidos de la venta`);
                    }
                } catch (error) {
                    if (isDevelopment) console.log('⚠️ No se pudo actualizar el prospecto:', error.message);
                }
            }

            await query('COMMIT');

            // ================== INICIO DEBUGGING ==================
console.log('🔍 [DEBUG] Iniciando verificación de creación de despacho...');
console.log('🔍 [DEBUG] Venta creada con ID:', nuevaVenta.id);
console.log('🔍 [DEBUG] fecha_entrega_estimada recibida:', fecha_entrega_estimada);
console.log('🔍 [DEBUG] tipo de fecha_entrega_estimada:', typeof fecha_entrega_estimada);
console.log('🔍 [DEBUG] es_venta_presencial:', es_venta_presencial);
console.log('🔍 [DEBUG] se_lo_llevo_directamente:', se_lo_llevo_directamente);
console.log('🔍 [DEBUG] almacen_id desde req.body:', req.body.almacen_id);
console.log('🔍 [DEBUG] observaciones_almacen:', observaciones_almacen);
console.log('🔍 [DEBUG] isDevelopment:', isDevelopment);

// Verificar si entra en la condición principal
if (fecha_entrega_estimada) {
    console.log('✅ [DEBUG] Entrando en bloque de creación de despacho...');
    
    try {
        console.log('🔍 [DEBUG] Preparando datos del despacho...');
        
        const despachoData = {
            venta_id: nuevaVenta.id,
            fecha_entrega_estimada: fecha_entrega_estimada,
            almacen_id: req.body.almacen_id || 'c8c1ed98-68ba-411e-af37-b5a3a2788f64',
            observaciones_almacen: observaciones_almacen || 'Despacho generado automáticamente desde venta',
            es_venta_presencial,
            se_lo_llevo_directamente
        };
        
        console.log('🔍 [DEBUG] despachoData preparado:', JSON.stringify(despachoData, null, 2));
        console.log('🔍 [DEBUG] Llamando a almacenService.crearDespachoDesdeVenta...');
        
        const resultadoDespacho = await almacenService.crearDespachoDesdeVenta(despachoData);
        
        console.log('🔍 [DEBUG] Resultado del servicio de almacén:', JSON.stringify(resultadoDespacho, null, 2));
        
        if (resultadoDespacho && resultadoDespacho.success) {
            console.log('✅ [DEBUG] Despacho creado exitosamente!');
            console.log('🚚 Despacho creado automáticamente:', resultadoDespacho.data?.codigo);
        } else {
            console.log('❌ [DEBUG] El servicio NO retornó success=true');
            console.log('🔍 [DEBUG] Detalle del resultado:', resultadoDespacho);
        }
        
        if (isDevelopment && resultadoDespacho && resultadoDespacho.success) {
            console.log('🚚 [ORIGINAL] Despacho creado automáticamente:', resultadoDespacho.data?.codigo);
        }
        
    } catch (errorDespacho) {
        console.log('❌ [DEBUG] ERROR en try/catch de creación de despacho:', errorDespacho);
        console.log('❌ [DEBUG] Stack trace:', errorDespacho.stack);
        
        if (isDevelopment) {
            console.log('⚠️ [ORIGINAL] Error creando despacho (no crítico):', errorDespacho.message);
        }
    }
    
} else {
    console.log('❌ [DEBUG] NO se entra en bloque de creación de despacho');
    console.log('❌ [DEBUG] fecha_entrega_estimada es falsy:', fecha_entrega_estimada);
}

console.log('🔍 [DEBUG] Finalizando verificación de creación de despacho...');
// =================== FIN DEBUGGING ===================

        const ventaCompleta = await obtenerVentaCompleta(nuevaVenta.id);

            const duration = Date.now() - startTime;
            logSuccess('crearVenta', { 
                id: nuevaVenta.id, 
                code: codigoVenta,
                correlativo: correlativoAsesor,
                value: valorFinal 
            }, duration);

            res.status(201).json({
                success: true,
                message: `Venta ${codigoVenta} (#${correlativoAsesor || 'S/N'}) creada exitosamente`,
                data: ventaCompleta || nuevaVenta
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        logError('crearVenta', error, { 
            cliente: req.body.nombre_cliente + ' ' + (req.body.apellido_cliente || ''),
            empresa: req.body.cliente_empresa 
        });
        res.status(500).json({
            success: false,
            message: 'Error al crear la venta',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// DASHBOARD DE VENTAS EMPRESARIAL
// ============================================
exports.dashboard = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('dashboard', req);

        const { asesor_id, fecha_desde, fecha_hasta } = req.query;
        const targetAsesor = asesor_id || req.user.id;
        const fechaDesde = fecha_desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const fechaHasta = fecha_hasta || new Date().toISOString();

        const metricas = await Promise.all([
            // Total ventas con indicadores
            query(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(valor_final), 0) as valor_total,
                    COALESCE(AVG(valor_final), 0) as promedio_venta,
                    COUNT(CASE WHEN estado_detallado = 'vendido/enviado/recibido/capacitado' THEN 1 END) as completadas,
                    COUNT(CASE WHEN estado_detallado = 'anulado' THEN 1 END) as canceladas,
                    COUNT(CASE WHEN fecha_entrega_estimada < NOW() AND estado_detallado NOT IN ('vendido/enviado/recibido/capacitado', 'anulado') THEN 1 END) as atrasadas
                FROM ventas 
                WHERE asesor_id = $1 AND fecha_creacion BETWEEN $2 AND $3 AND activo = true
            `, [targetAsesor, fechaDesde, fechaHasta]),

            // Ventas por estado detallado
            query(`
                SELECT 
                    estado_detallado,
                    COUNT(*) as cantidad, 
                    COALESCE(SUM(valor_final), 0) as valor,
                    COALESCE(AVG(valor_final), 0) as promedio
                FROM ventas 
                WHERE asesor_id = $1 AND fecha_creacion BETWEEN $2 AND $3 AND activo = true
                GROUP BY estado_detallado
                ORDER BY valor DESC
            `, [targetAsesor, fechaDesde, fechaHasta]),

            // Análisis por canal de origen
            query(`
                SELECT 
                    canal_origen,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(valor_final), 0) as valor,
                    COALESCE(AVG(valor_final), 0) as promedio
                FROM ventas 
                WHERE asesor_id = $1 AND fecha_creacion BETWEEN $2 AND $3 AND activo = true
                GROUP BY canal_origen
                ORDER BY valor DESC
            `, [targetAsesor, fechaDesde, fechaHasta]),

            // Análisis por tipo de venta
            query(`
                SELECT 
                    tipo_venta,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(valor_final), 0) as valor,
                    COALESCE(AVG(valor_final), 0) as promedio
                FROM ventas 
                WHERE asesor_id = $1 AND fecha_creacion BETWEEN $2 AND $3 AND activo = true
                GROUP BY tipo_venta
                ORDER BY valor DESC
            `, [targetAsesor, fechaDesde, fechaHasta]),

            // Estados en proceso
            query(`
                SELECT 
                    estado_detallado,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(valor_final), 0) as valor_estado,
                    COALESCE(AVG(probabilidad_cierre), 0) as probabilidad_promedio
                FROM ventas 
                WHERE asesor_id = $1 AND activo = true 
                AND estado_detallado NOT IN ('vendido/enviado/recibido/capacitado', 'anulado')
                GROUP BY estado_detallado
                ORDER BY valor_estado DESC
            `, [targetAsesor])
        ]);

        const resumen = metricas[0].rows[0];
        const totalVentas = parseInt(resumen.total || 0);
        const valorTotal = parseFloat(resumen.valor_total || 0);
        const completadas = parseInt(resumen.completadas || 0);
        const canceladas = parseInt(resumen.canceladas || 0);

        const dashboard = {
            periodo: {
                desde: fechaDesde,
                hasta: fechaHasta,
                asesor_id: targetAsesor
            },
            resumen: {
                total_ventas: totalVentas,
                valor_total: valorTotal,
                promedio_venta: parseFloat(resumen.promedio_venta || 0),
                completadas: completadas,
                canceladas: canceladas,
                atrasadas: parseInt(resumen.atrasadas || 0),
                tasa_exito: totalVentas > 0 ? ((completadas / totalVentas) * 100).toFixed(2) : 0,
                tasa_cancelacion: totalVentas > 0 ? ((canceladas / totalVentas) * 100).toFixed(2) : 0
            },
            ventas_por_estado_detallado: metricas[1].rows.map(estado => ({
                estado_detallado: estado.estado_detallado,
                cantidad: parseInt(estado.cantidad),
                valor: parseFloat(estado.valor),
                promedio: parseFloat(estado.promedio)
            })),
            ventas_por_canal: metricas[2].rows.map(canal => ({
                canal_origen: canal.canal_origen,
                cantidad: parseInt(canal.cantidad),
                valor: parseFloat(canal.valor),
                promedio: parseFloat(canal.promedio)
            })),
            ventas_por_tipo: metricas[3].rows.map(tipo => ({
                tipo_venta: tipo.tipo_venta,
                cantidad: parseInt(tipo.cantidad),
                valor: parseFloat(tipo.valor),
                promedio: parseFloat(tipo.promedio)
            })),
            estados_en_proceso: metricas[4].rows.map(estado => ({
                estado_detallado: estado.estado_detallado,
                cantidad: parseInt(estado.cantidad),
                valor_estado: parseFloat(estado.valor_estado),
                probabilidad_promedio: parseFloat(estado.probabilidad_promedio)
            }))
        };

        const duration = Date.now() - startTime;
        logSuccess('dashboard', { 
            sales: totalVentas, 
            value: valorTotal,
            success_rate: dashboard.resumen.tasa_exito + '%'
        }, duration);

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        logError('dashboard', error, { asesor_id: req.query.asesor_id });
        res.status(500).json({
            success: false,
            message: 'Error al generar dashboard',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// OBTENER ESTADÍSTICAS DE VENTAS
// ============================================
exports.getEstadisticas = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('getEstadisticas', req);

        const { asesor_id, fecha_desde, fecha_hasta } = req.query;
        const targetAsesor = asesor_id || req.user.id;
        const fechaDesde = fecha_desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const fechaHasta = fecha_hasta || new Date().toISOString();

        const estadisticasQuery = `
            WITH ventas_periodo AS (
                SELECT 
                    v.*,
                    DATE(v.fecha_creacion) as fecha_solo
                FROM ventas v
                WHERE v.asesor_id = $1 
                AND v.fecha_creacion BETWEEN $2 AND $3 
                AND v.activo = true
            ),
            resumen_general AS (
                SELECT 
                    COUNT(*) as total_ventas,
                    COUNT(CASE WHEN estado_detallado = 'vendido/enviado/recibido/capacitado' THEN 1 END) as ventas_completadas,
                    COUNT(CASE WHEN estado_detallado = 'anulado' THEN 1 END) as ventas_canceladas,
                    COUNT(CASE WHEN estado_detallado IN ('vendido', 'vendido/enviado', 'vendido/enviado/recibido') THEN 1 END) as ventas_en_proceso,
                    COALESCE(SUM(valor_final), 0) as valor_total,
                    COALESCE(SUM(CASE WHEN estado_detallado = 'vendido/enviado/recibido/capacitado' THEN valor_final ELSE 0 END), 0) as valor_completado,
                    COALESCE(AVG(valor_final), 0) as promedio_general,
                    COALESCE(AVG(CASE WHEN estado_detallado = 'vendido/enviado/recibido/capacitado' THEN valor_final END), 0) as promedio_completadas,
                    MIN(valor_final) as venta_minima,
                    MAX(valor_final) as venta_maxima,
                    COUNT(DISTINCT fecha_solo) as dias_activos
                FROM ventas_periodo
            ),
            ventas_por_estado AS (
                SELECT 
                    estado_detallado,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(valor_final), 0) as valor_estado,
                    COALESCE(AVG(valor_final), 0) as promedio_estado
                FROM ventas_periodo
                GROUP BY estado_detallado
            ),
            ventas_por_canal AS (
                SELECT 
                    canal_origen,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(valor_final), 0) as valor_canal,
                    COALESCE(AVG(valor_final), 0) as promedio_canal
                FROM ventas_periodo
                GROUP BY canal_origen
            ),
            ventas_por_tipo AS (
                SELECT 
                    tipo_venta,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(valor_final), 0) as valor_tipo,
                    COALESCE(AVG(valor_final), 0) as promedio_tipo
                FROM ventas_periodo
                GROUP BY tipo_venta
            )
            SELECT 
                (SELECT row_to_json(resumen_general) FROM resumen_general) as resumen,
                (SELECT json_agg(ventas_por_estado) FROM ventas_por_estado) as por_estado,
                (SELECT json_agg(ventas_por_canal) FROM ventas_por_canal) as por_canal,
                (SELECT json_agg(ventas_por_tipo) FROM ventas_por_tipo) as por_tipo
        `;

        const estadisticasResult = await query(estadisticasQuery, [targetAsesor, fechaDesde, fechaHasta]);

        if (estadisticasResult.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    asesor_id: targetAsesor,
                    periodo: { desde: fechaDesde, hasta: fechaHasta },
                    mensaje: 'No hay datos de ventas en el período especificado',
                    resumen: {
                        total_ventas: 0,
                        ventas_completadas: 0,
                        valor_total: 0,
                        promedio_general: 0
                    }
                }
            });
        }

        const estadisticas = estadisticasResult.rows[0];
        const resumen = estadisticas.resumen;

        const totalVentas = parseInt(resumen.total_ventas || 0);
        const ventasCompletadas = parseInt(resumen.ventas_completadas || 0);
        const valorTotal = parseFloat(resumen.valor_total || 0);
        const valorCompletado = parseFloat(resumen.valor_completado || 0);
        const diasActivos = parseInt(resumen.dias_activos || 1);

        const kpis = {
            tasa_exito: totalVentas > 0 ? ((ventasCompletadas / totalVentas) * 100).toFixed(2) : 0,
            tasa_cancelacion: totalVentas > 0 ? ((parseInt(resumen.ventas_canceladas || 0) / totalVentas) * 100).toFixed(2) : 0,
            efectividad_valor: valorTotal > 0 ? ((valorCompletado / valorTotal) * 100).toFixed(2) : 0,
            productividad_diaria: (valorCompletado / diasActivos).toFixed(2),
            ticket_promedio: ventasCompletadas > 0 ? (valorCompletado / ventasCompletadas).toFixed(2) : 0,
            velocidad_ventas: diasActivos > 0 ? (ventasCompletadas / diasActivos).toFixed(2) : 0,
            clasificacion: (() => {
                const tasaExito = totalVentas > 0 ? (ventasCompletadas / totalVentas) * 100 : 0;
                if (tasaExito >= 80) return 'Excelente';
                if (tasaExito >= 60) return 'Muy Bueno';
                if (tasaExito >= 40) return 'Bueno';
                if (tasaExito >= 20) return 'Regular';
                return 'Necesita Mejora';
            })()
        };

        const respuestaCompleta = {
            asesor_id: targetAsesor,
            periodo: {
                desde: fechaDesde,
                hasta: fechaHasta,
                dias_analizados: Math.ceil((new Date(fechaHasta) - new Date(fechaDesde)) / (1000 * 60 * 60 * 24))
            },
            resumen_general: {
                total_ventas: totalVentas,
                ventas_completadas: ventasCompletadas,
                ventas_canceladas: parseInt(resumen.ventas_canceladas || 0),
                ventas_en_proceso: parseInt(resumen.ventas_en_proceso || 0),
                valor_total: valorTotal,
                valor_completado: valorCompletado,
                promedio_general: parseFloat(resumen.promedio_general || 0),
                promedio_completadas: parseFloat(resumen.promedio_completadas || 0),
                venta_minima: parseFloat(resumen.venta_minima || 0),
                venta_maxima: parseFloat(resumen.venta_maxima || 0),
                dias_activos: diasActivos
            },
            distribucion_por_estado: (estadisticas.por_estado || []).map(estado => ({
                estado_detallado: estado.estado_detallado,
                cantidad: parseInt(estado.cantidad),
                valor: parseFloat(estado.valor_estado),
                promedio: parseFloat(estado.promedio_estado),
                porcentaje_total: totalVentas > 0 ? ((estado.cantidad / totalVentas) * 100).toFixed(2) : 0
            })),
            distribucion_por_canal: (estadisticas.por_canal || []).map(canal => ({
                canal_origen: canal.canal_origen,
                cantidad: parseInt(canal.cantidad),
                valor: parseFloat(canal.valor_canal),
                promedio: parseFloat(canal.promedio_canal),
                porcentaje_total: totalVentas > 0 ? ((canal.cantidad / totalVentas) * 100).toFixed(2) : 0
            })),
            distribucion_por_tipo: (estadisticas.por_tipo || []).map(tipo => ({
                tipo_venta: tipo.tipo_venta,
                cantidad: parseInt(tipo.cantidad),
                valor: parseFloat(tipo.valor_tipo),
                promedio: parseFloat(tipo.promedio_tipo),
                porcentaje_total: totalVentas > 0 ? ((tipo.cantidad / totalVentas) * 100).toFixed(2) : 0
            })),
            kpis_rendimiento: kpis,
            insights: {
                tendencia: valorCompletado > (valorTotal * 0.7) ? 'Positiva' : valorCompletado > (valorTotal * 0.4) ? 'Estable' : 'Requiere atención',
                recomendaciones: [
                    parseFloat(kpis.tasa_exito) < 50 ? 'Mejorar proceso de calificación de prospectos' : null,
                    parseFloat(kpis.ticket_promedio) < 1000 ? 'Enfocar en ventas de mayor valor' : null,
                    parseFloat(kpis.velocidad_ventas) < 1 ? 'Optimizar tiempo de cierre' : null
                ].filter(Boolean)
            }
        };

        const duration = Date.now() - startTime;
        logSuccess('getEstadisticas', { 
            sales: ventasCompletadas + '/' + totalVentas,
            value: valorCompletado,
            success_rate: kpis.tasa_exito + '%'
        }, duration);

        res.json({
            success: true,
            data: respuestaCompleta
        });

    } catch (error) {
        logError('getEstadisticas', error, { asesor_id: req.query.asesor_id });
        res.status(500).json({
            success: false,
            message: 'Error al generar estadísticas de ventas',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// ACTUALIZAR VENTA
// ============================================
exports.actualizarVenta = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('actualizarVenta', req);

        const { id } = req.params;
        const updates = req.body;
        const ventaId = parseInt(id);
        
        if (isNaN(ventaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta inválido'
            });
        }

        const camposPermitidos = [
            'nombre_cliente', 'apellido_cliente', 'cliente_empresa', 'cliente_email', 'cliente_telefono',
            'canal_contacto', 'ciudad', 'departamento', 'distrito',
            'valor_total', 'descuento_porcentaje', 'descuento_monto', 'valor_final',
            'estado_detallado', 'canal_origen', 'tipo_venta', 
            'probabilidad_cierre', 'fecha_entrega_estimada', 'fecha_venta',
            'notas_internas', 'condiciones_especiales'
        ];

        const camposActualizar = [];
        const valores = [];
        let paramCount = 0;

        // Validaciones
        const validaciones = [];

        if (updates.cliente_email && !validarEmail(updates.cliente_email)) {
            validaciones.push('Formato de email inválido');
        }

        if (updates.cliente_telefono && !validarTelefono(updates.cliente_telefono)) {
            validaciones.push('Formato de teléfono inválido');
        }

        if (updates.valor_total && parseFloat(updates.valor_total) <= 0) {
            validaciones.push('El valor total debe ser mayor a 0');
        }

        if (updates.probabilidad_cierre && (parseFloat(updates.probabilidad_cierre) < 0 || parseFloat(updates.probabilidad_cierre) > 100)) {
            validaciones.push('La probabilidad de cierre debe estar entre 0 y 100');
        }

        if (updates.estado_detallado) {
            const estadosDetalladosValidos = [
                'vendido', 'vendido/enviado', 'vendido/enviado/recibido', 
                'vendido/enviado/recibido/capacitado', 'anulado',
                'cambio', 'cambio/enviado', 'cambio/enviado/recibido'
            ];
            if (!estadosDetalladosValidos.includes(updates.estado_detallado)) {
                validaciones.push('Estado detallado no válido');
            }
        }

        if (updates.canal_origen) {
            const canalesOrigenValidos = ['venta-directa', 'pipeline-convertido'];
            if (!canalesOrigenValidos.includes(updates.canal_origen)) {
                validaciones.push('Canal de origen no válido');
            }
        }

        if (updates.tipo_venta) {
            const tiposVentaValidos = ['factura', 'boleta', 'nota_venta'];
            if (!tiposVentaValidos.includes(updates.tipo_venta)) {
                validaciones.push('Tipo de venta no válido');
            }
        }

        // Validar productos si se envían
        if (updates.productos) {
            if (!Array.isArray(updates.productos)) {
                validaciones.push('Los productos deben ser un array');
            } else if (updates.productos.length === 0) {
                validaciones.push('Debe incluir al menos un producto');
            } else {
                updates.productos.forEach((producto, index) => {
                    if (!producto.producto_id) {
                        validaciones.push(`Producto ${index + 1}: ID de producto requerido`);
                    }
                    if (!producto.cantidad || parseFloat(producto.cantidad) <= 0) {
                        validaciones.push(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
                    }
                    if (!producto.precio_unitario || parseFloat(producto.precio_unitario) <= 0) {
                        validaciones.push(`Producto ${index + 1}: Precio unitario debe ser mayor a 0`);
                    }
                });
            }
        }

        if (validaciones.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación',
                errores: validaciones
            });
        }

        // Construir query dinámico
for (const [key, value] of Object.entries(updates)) {
            if (camposPermitidos.includes(key) && value !== undefined) {
                paramCount++;
                camposActualizar.push(`${key} = $${paramCount}`);
                
                if (key === 'fecha_venta' || key === 'fecha_entrega_estimada') {
                    valores.push(value ? convertirLimaAUTC(value) : null);
                } else {
                    valores.push(value);
                }
            }
        }

        if (camposActualizar.length === 0 && !updates.productos) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos válidos para actualizar'
            });
        }

        // Actualizar datos principales de la venta si hay campos para actualizar
        let ventaActualizada;
        if (camposActualizar.length > 0) {
            // Agregar campos de auditoría
            paramCount++;
            camposActualizar.push(`updated_by = $${paramCount}`);
            valores.push(req.user.id);

            paramCount++;
            camposActualizar.push(`updated_at = $${paramCount}`);
            valores.push(new Date());

            paramCount++;
            valores.push(ventaId);

            const updateQuery = `
                UPDATE ventas 
                SET ${camposActualizar.join(', ')}
                WHERE id = $${paramCount} AND activo = true
                RETURNING *
            `;

            const result = await query(updateQuery, valores);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Venta no encontrada'
                });
            }

            ventaActualizada = result.rows[0];
        } else {
            // Si solo se actualizan productos, obtener la venta actual
            const selectQuery = 'SELECT * FROM ventas WHERE id = $1 AND activo = true';
            const result = await query(selectQuery, [ventaId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Venta no encontrada'
                });
            }
            
            ventaActualizada = result.rows[0];
        }

        // NUEVA LÓGICA: Actualizar productos si se envían
        if (updates.productos && Array.isArray(updates.productos)) {
            console.log(`🔄 Actualizando ${updates.productos.length} productos para venta ${ventaId}`);
            
            // 1. Eliminar productos existentes
            await query('DELETE FROM venta_detalles WHERE venta_id = $1', [ventaId]);
            console.log(`✅ Productos existentes eliminados para venta ${ventaId}`);
            
            // 2. Insertar productos nuevos
            for (let i = 0; i < updates.productos.length; i++) {
                const producto = updates.productos[i];
                
                const insertProductoQuery = `
                    INSERT INTO venta_detalles (
                    venta_id, 
                    producto_id, 
                    cantidad, 
                    precio_unitario, 
                    subtotal, 
                    descuento_porcentaje, 
                    descuento_monto, 
                    total_linea,
                    descripcion_personalizada,
                    notas,
                    orden_linea,
                    created_at,
                    created_by,
                    updated_by,
                    activo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                `;
                
                const productosValues = [
                    ventaId,
                    producto.producto_id,
                    parseFloat(producto.cantidad),
                    parseFloat(producto.precio_unitario),
                    parseFloat(producto.subtotal || producto.cantidad * producto.precio_unitario),
                    parseFloat(producto.descuento_porcentaje || 0),
                    parseFloat(producto.descuento_monto || 0),
                    parseFloat(producto.total_linea || producto.subtotal || producto.cantidad * producto.precio_unitario),
                    producto.descripcion_personalizada || null,
                    producto.notas || null,
                    producto.orden_linea || i + 1,
                    new Date(),
                    req.user.id,        // created_by
                    req.user.id,        // updated_by  
                    true                // activo
                ];
                
                await query(insertProductoQuery, productosValues);
                console.log(`✅ Producto ${i + 1} insertado: ${producto.producto_id}`);
            }
            
            console.log(`🎯 Productos actualizados exitosamente para venta ${ventaId}`);
        }

        // Formatear números
        ventaActualizada.valor_total = parseFloat(ventaActualizada.valor_total || 0);
        ventaActualizada.valor_final = parseFloat(ventaActualizada.valor_final || 0);
        ventaActualizada.descuento_porcentaje = parseFloat(ventaActualizada.descuento_porcentaje || 0);
        ventaActualizada.descuento_monto = parseFloat(ventaActualizada.descuento_monto || 0);
        ventaActualizada.probabilidad_cierre = parseFloat(ventaActualizada.probabilidad_cierre || 0);

        const duration = Date.now() - startTime;
        const fieldsUpdated = camposActualizar.length > 0 ? camposActualizar.length - 2 : 0;
        const productosUpdated = updates.productos ? updates.productos.length : 0;
        
        logSuccess('actualizarVenta', { 
            id: ventaId,
            fields_updated: fieldsUpdated,
            productos_updated: productosUpdated,
            value: ventaActualizada.valor_final
        }, duration);

        res.json({
            success: true,
            message: 'Venta actualizada exitosamente',
            data: ventaActualizada,
            productos_actualizados: productosUpdated
        });

    } catch (error) {
        logError('actualizarVenta', error, { ventaId: req.params.id });
        res.status(500).json({
            success: false,
            message: 'Error al actualizar la venta',
            error: isDevelopment ? error.message : undefined
        });
    }
};
// ============================================
// CAMBIAR ESTADO DETALLADO
// ============================================
exports.cambiarEstado = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('cambiarEstado', req);

        const { id } = req.params;
        const { nuevo_estado_detallado, notas } = req.body;
        const ventaId = parseInt(id);
        
        if (isNaN(ventaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta inválido'
            });
        }

        const estadosDetalladosValidos = [
            'vendido', 'vendido/enviado', 'vendido/enviado/recibido',
            'vendido/enviado/recibido/capacitado', 'anulado',
            'cambio', 'cambio/enviado', 'cambio/enviado/recibido'
        ];

        if (!estadosDetalladosValidos.includes(nuevo_estado_detallado)) {
            return res.status(400).json({
                success: false,
                message: 'Estado detallado no válido',
                estados_validos: estadosDetalladosValidos
            });
        }

        const ventaActual = await query(
            'SELECT estado_detallado, asesor_id, valor_final, codigo FROM ventas WHERE id = $1 AND activo = true',
            [ventaId]
        );

        if (ventaActual.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        const estadoAnterior = ventaActual.rows[0].estado_detallado;

        if (estadoAnterior === 'anulado' && nuevo_estado_detallado !== 'anulado') {
            return res.status(400).json({
                success: false,
                message: 'No se puede cambiar el estado de una venta anulada',
                estado_actual: estadoAnterior
            });
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            let campoFecha = '';
            switch (nuevo_estado_detallado) {
                case 'vendido/enviado':
                    campoFecha = ', fecha_envio = NOW()';
                    break;
                case 'vendido/enviado/recibido':
                    campoFecha = ', fecha_entrega_real = NOW()';
                    break;
                case 'vendido/enviado/recibido/capacitado':
                    campoFecha = ', fecha_completado = NOW()';
                    break;
                case 'anulado':
                    campoFecha = ', fecha_cancelacion = NOW()';
                    break;
                case 'cambio/enviado':
                    campoFecha = ', fecha_envio_cambio = NOW()';
                    break;
                case 'cambio/enviado/recibido':
                    campoFecha = ', fecha_recepcion_cambio = NOW()';
                    break;
            }

            const updateQuery = `
                UPDATE ventas 
                SET estado_detallado = $1, updated_at = NOW(), updated_by = $2 ${campoFecha}
                WHERE id = $3 AND activo = true
                RETURNING *
            `;

            const result = await query(updateQuery, [nuevo_estado_detallado, req.user.id, ventaId]);

            // ====================================
            // 🚀 INTEGRACIÓN SOPORTE TÉCNICO
            // ====================================
            let ticketCapacitacionId = null;
            let codigoTicketCapacitacion = null;

            if (nuevo_estado_detallado === 'vendido/enviado/recibido') {
                try {
                    // 🆕 Obtener TODOS los productos de la venta (no solo el primero)
                    const infoVenta = await query(`
                        SELECT
                            v.id, v.codigo as codigo_venta,
                            CONCAT(v.nombre_cliente, ' ', v.apellido_cliente) as cliente_nombre_completo,
                            v.cliente_telefono, v.cliente_email, v.asesor_id,
                            JSON_AGG(
                                JSON_BUILD_OBJECT(
                                    'producto_id', vd.producto_id,
                                    'cantidad', vd.cantidad,
                                    'codigo_producto', p.codigo,
                                    'descripcion_producto', p.descripcion,
                                    'marca', p.marca,
                                    'categoria_id', p.categoria_id,
                                    'categoria_nombre', c.nombre
                                ) ORDER BY vd.orden_linea
                            ) as productos
                        FROM ventas v
                        LEFT JOIN venta_detalles vd ON v.id = vd.venta_id AND vd.activo = true
                        LEFT JOIN productos p ON vd.producto_id = p.id
                        LEFT JOIN categorias c ON p.categoria_id = c.id
                        WHERE v.id = $1 AND v.activo = true
                        GROUP BY v.id, v.codigo, v.nombre_cliente, v.apellido_cliente,
                                 v.cliente_telefono, v.cliente_email, v.asesor_id
                    `, [ventaId]);

                    if (infoVenta.rows.length > 0) {
                        const venta = infoVenta.rows[0];
                        const productos = venta.productos || [];

                        // 🆕 Obtener técnico por defecto (Juan Figueroa ID:20)
                        const tecnicoDefecto = await query(`
                            SELECT id FROM usuarios
                            WHERE id = 20 AND estado = 'ACTIVO' AND deleted_at IS NULL
                            LIMIT 1
                        `);
                        const tecnicoId = tecnicoDefecto.rows[0]?.id || null;

                        // 🆕 Generar descripción con TODOS los productos
                        const productosDescripcion = productos.map(p => p.descripcion_producto).join(', ');
                        const cantidadProductos = productos.length;

                        // PASO 1: Crear ticket principal de soporte CON TÉCNICO ASIGNADO
                        const ticketSoporte = await query(`
                            INSERT INTO tickets_soporte (
                                venta_id, asesor_origen_id, tecnico_asignado_id,
                                tipo_ticket, estado,
                                cliente_nombre, cliente_telefono, cliente_email,
                                titulo, descripcion, created_by, updated_by
                            ) VALUES (
                                $1, $2, $3, 'CAPACITACION', 'PENDIENTE',
                                $4, $5, $6, $7, $8, $9, $9
                            ) RETURNING id, codigo
                        `, [
                            venta.id,
                            venta.asesor_id,
                            tecnicoId,  // 🆕 Técnico asignado automáticamente
                            venta.cliente_nombre_completo,
                            venta.cliente_telefono,
                            venta.cliente_email || '',
                            `Capacitación para ${cantidadProductos} producto${cantidadProductos > 1 ? 's' : ''}`,
                            `Cliente ${venta.cliente_nombre_completo} requiere capacitación para: ${productosDescripcion}`,
                            req.user.id
                        ]);

                        if (ticketSoporte.rows.length > 0) {
                            const ticket = ticketSoporte.rows[0];
                            codigoTicketCapacitacion = ticket.codigo;

                            // NOTA: Los tickets de CAPACITACIÓN no usan soporte_productos
                            // (esa tabla es solo para REPARACION/MANTENIMIENTO)
                            // La relación es: ticket → venta → venta_detalles → productos

                            // PASO 2: Crear registro en capacitaciones (usar primer producto como referencia)
                            const primerProducto = productos[0] || {};
                            const capacitacionResult = await query(`
                                INSERT INTO soporte_capacitaciones (
                                    venta_id, ticket_id, producto_id,
                                    cliente_nombre, cliente_telefono, cliente_email,
                                    producto_codigo, producto_descripcion, marca,
                                    fecha_capacitacion_solicitada, estado,
                                    tipo_capacitacion, modalidad,
                                    tecnico_asignado_id,
                                    observaciones,
                                    created_by, updated_by
                                ) VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                                    CURRENT_DATE, 'PENDIENTE', 'USO_BASICO', 'PRESENCIAL',
                                    $10, $11, $12, $12
                                ) RETURNING id
                            `, [
                                venta.id,
                                ticket.id,
                                primerProducto.producto_id,
                                venta.cliente_nombre_completo,
                                venta.cliente_telefono,
                                venta.cliente_email || '',
                                primerProducto.codigo_producto,
                                primerProducto.descripcion_producto,
                                primerProducto.marca,
                                tecnicoId,  // Sincroniza con tickets_soporte
                                `Capacitación para ${cantidadProductos} producto${cantidadProductos > 1 ? 's' : ''}: ${productosDescripcion}`,
                                req.user.id
                            ]);

                            if (capacitacionResult.rows.length > 0) {
                                ticketCapacitacionId = capacitacionResult.rows[0].id;

                                console.log(`✅ Ticket ${codigoTicketCapacitacion} creado para venta ${venta.codigo_venta}`);
                                console.log(`   📦 ${cantidadProductos} producto${cantidadProductos > 1 ? 's' : ''} incluido${cantidadProductos > 1 ? 's' : ''} en descripción`);
                                console.log(`   👤 Técnico asignado: Juan Figueroa (ID: ${tecnicoId})`);
                            }
                        }
                    }
                } catch (soporteError) {
                    // Log del error pero no fallar la transacción principal
                    if (isDevelopment) {
                        console.log('⚠️ Error creando ticket de capacitación:', soporteError.message);
                    }
                    // Continuar con la venta, el ticket se puede crear manualmente después
                }
            }

            // Registrar en historial (código original)
            await query(`
                INSERT INTO venta_estados (
                    venta_id, estado_anterior, estado_nuevo, usuario_id, fecha_cambio, notas
                ) VALUES ($1, $2, $3, $4, NOW(), $5)
            `, [ventaId, estadoAnterior, nuevo_estado_detallado, req.user.id, notas || '']).catch((error) => {
                if (isDevelopment) console.log('Info: Tabla venta_estados no disponible');
            });

            await query('COMMIT');

            const ventaActualizada = result.rows[0];
            // Procesar automatizaciones post-cambio de estado
            const procesamiento = await VentasService.procesarCambioEstado(
                ventaId, 
                nuevo_estado_detallado, 
                estadoAnterior, 
                req.user.id
            );

            if (procesamiento.success && procesamiento.acciones_realizadas.length > 0) {
                console.log(`✅ Automatizaciones ejecutadas: ${procesamiento.acciones_realizadas.join(', ')}`);
            }
            ventaActualizada.valor_total = parseFloat(ventaActualizada.valor_total || 0);
            ventaActualizada.valor_final = parseFloat(ventaActualizada.valor_final || 0);

            const duration = Date.now() - startTime;
            logSuccess('cambiarEstado', { 
                id: ventaId,
                transition: `${estadoAnterior} -> ${nuevo_estado_detallado}`,
                value: ventaActualizada.valor_final,
                ticket_capacitacion: codigoTicketCapacitacion
            }, duration);

            // Respuesta con información del ticket creado
            const response = {
                success: true,
                message: `Estado cambiado de "${estadoAnterior}" a "${nuevo_estado_detallado}"`,
                data: ventaActualizada
            };

            // Agregar información del ticket si se creó
            if (ticketCapacitacionId && codigoTicketCapacitacion) {
                response.ticket_capacitacion = {
                    id: ticketCapacitacionId,
                    codigo: codigoTicketCapacitacion,
                    mensaje: 'Ticket de capacitación creado automáticamente'
                };
            }

            res.json(response);

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        logError('cambiarEstado', error, { ventaId: req.params.id, nuevo_estado: req.body.nuevo_estado_detallado });
        res.status(500).json({
            success: false,
            message: 'Error al cambiar el estado de la venta',
            error: isDevelopment ? error.message : undefined
        });
    }
};
// ============================================
// ELIMINAR VENTA (SOFT DELETE)
// ============================================
exports.eliminarVenta = async (req, res) => {
    const startTime = Date.now();
    
    try {
        logRequest('eliminarVenta', req);

        const { id } = req.params;
        const ventaId = parseInt(id);
        
        if (isNaN(ventaId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta inválido'
            });
        }

        const ventaActual = await query(`
            SELECT estado_detallado, valor_final, codigo, 
                   CONCAT(nombre_cliente, ' ', COALESCE(apellido_cliente, '')) as cliente_nombre_completo
            FROM ventas 
            WHERE id = $1 AND activo = true
        `, [ventaId]);

        if (ventaActual.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        const venta = ventaActual.rows[0];

        if (['vendido/enviado/recibido/capacitado', 'vendido/enviado/recibido'].includes(venta.estado_detallado)) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar una venta en estado "${venta.estado_detallado}"`
            });
        }

        const result = await query(`
            UPDATE ventas
            SET activo = false, updated_at = NOW(), updated_by = $1, fecha_eliminacion = NOW()
            WHERE id = $2 AND activo = true
            RETURNING codigo, CONCAT(nombre_cliente, ' ', COALESCE(apellido_cliente, '')) as cliente_nombre_completo
        `, [req.user.id, ventaId]);

        // 🆕 GESTIÓN DE TICKETS DE SOPORTE ASOCIADOS
        try {
            // 1. Cancelar tickets PENDIENTES (no atendidos)
            await query(`
                UPDATE tickets_soporte
                SET
                    activo = false,
                    estado = 'COMPLETADO',
                    observaciones = CONCAT(
                        COALESCE(observaciones, ''),
                        '\n[SISTEMA] Ticket cancelado automáticamente por eliminación de venta ', $2, ' el ', NOW()::DATE
                    ),
                    updated_at = NOW()
                WHERE venta_id = $1
                  AND activo = true
                  AND estado = 'PENDIENTE'
            `, [ventaId, venta.codigo]);

            // 2. Agregar nota a tickets YA COMPLETADOS (mantener como historial)
            await query(`
                UPDATE tickets_soporte
                SET
                    observaciones = CONCAT(
                        COALESCE(observaciones, ''),
                        '\n[INFO] La venta original ', $2, ' fue eliminada el ', NOW()::DATE, ' (ticket ya estaba completado)'
                    ),
                    updated_at = NOW()
                WHERE venta_id = $1
                  AND activo = true
                  AND estado = 'COMPLETADO'
            `, [ventaId, venta.codigo]);

            console.log(`✅ Tickets de soporte procesados para venta ${venta.codigo}`);
        } catch (ticketError) {
            // Si falla, solo logear pero no afectar la eliminación de la venta
            console.warn('⚠️ Error al procesar tickets de soporte:', ticketError.message);
        }

        // Registrar en historial
        await query(`
            INSERT INTO venta_estados (
                venta_id, estado_anterior, estado_nuevo, usuario_id, fecha_cambio, notas
            ) VALUES ($1, $2, 'ELIMINADA', $3, NOW(), 'Venta eliminada por usuario')
        `, [ventaId, venta.estado_detallado, req.user.id]).catch(() => {
            if (isDevelopment) console.log('Info: Tabla venta_estados no disponible');
        });

        const duration = Date.now() - startTime;
        logSuccess('eliminarVenta', { 
            id: ventaId,
            code: result.rows[0].codigo,
            client: result.rows[0].cliente_nombre_completo
        }, duration);

        res.json({
            success: true,
            message: `Venta ${result.rows[0].codigo || ventaId} eliminada exitosamente`,
            data: {
                id: ventaId,
                codigo: result.rows[0].codigo,
                cliente_nombre_completo: result.rows[0].cliente_nombre_completo,
                fecha_eliminacion: new Date().toISOString(),
                eliminado_por: req.user.id
            }
        });

    } catch (error) {
        logError('eliminarVenta', error, { ventaId: req.params.id });
        res.status(500).json({
            success: false,
            message: 'Error al eliminar la venta',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// HELPER FUNCTION - OBTENER VENTA COMPLETA
// ============================================
const obtenerVentaCompleta = async (ventaId) => {
    try {
        const ventaQuery = `
            SELECT 
                v.*,
                CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) as cliente_nombre_completo,
                u.nombre as asesor_nombre,
                u.apellido as asesor_apellido,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as asesor_nombre_completo,
                CONCAT(p.nombre_cliente, ' ', COALESCE(p.apellido_cliente, '')) as prospecto_nombre,
                p.empresa as prospecto_empresa,
                p.telefono as prospecto_telefono,
                p.email as prospecto_email
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            LEFT JOIN prospectos p ON v.prospecto_id = p.id
            WHERE v.id = $1 AND v.activo = true
        `;

        const detallesQuery = `
            SELECT 
                vd.*,
                pr.codigo as producto_codigo,
                pr.descripcion as producto_nombre,
                pr.precio_sin_igv as precio_actual_producto,
                pr.unidad_medida,
                pr.marca
            FROM venta_detalles vd
            LEFT JOIN productos pr ON vd.producto_id = pr.id
            WHERE vd.venta_id = $1
        `;

        const [ventaResult, detallesResult] = await Promise.all([
            query(ventaQuery, [ventaId]),
            query(detallesQuery, [ventaId])
        ]);

        const venta = ventaResult.rows[0];
        
        if (venta) {
            venta.detalles = detallesResult.rows;
            venta.resumen = {
                total_productos: detallesResult.rows.length,
                total_items: detallesResult.rows.reduce((sum, d) => sum + parseFloat(d.cantidad || 0), 0),
                subtotal_productos: detallesResult.rows.reduce((sum, d) => sum + parseFloat(d.subtotal || 0), 0)
            };
        }

        return venta;
    } catch (error) {
        console.error('Error al obtener venta completa:', error);
        return null;
    }
};

// ============================================
// OBTENER ASESORES DISPONIBLES PARA FILTROS
// ============================================
exports.obtenerAsesores = async (req, res) => {
    try {
        logRequest('obtenerAsesores', req);

        // Solo devolver asesores que tienen ventas activas
        const asesoresQuery = `
            SELECT DISTINCT
                u.id,
                u.nombre,
                u.apellido,
                u.email,
                'ASESOR' as rol,
                COUNT(v.id) as total_ventas,
                MAX(v.created_at) as ultima_venta
            FROM usuarios u
            INNER JOIN ventas v ON u.id = v.asesor_id
            WHERE u.activo = true
                AND v.activo = true
            GROUP BY u.id, u.nombre, u.apellido, u.email
            HAVING COUNT(v.id) > 0
            ORDER BY u.nombre, u.apellido
        `;

        const result = await query(asesoresQuery);

        const asesores = result.rows.map(asesor => ({
            id: asesor.id,
            nombre: asesor.nombre,
            apellido: asesor.apellido,
            email: asesor.email,
            rol: asesor.rol,
            total_ventas: parseInt(asesor.total_ventas),
            ultima_venta: asesor.ultima_venta
        }));

        logSuccess('obtenerAsesores', { count: asesores.length });

        res.json({
            success: true,
            data: asesores,
            total: asesores.length
        });

    } catch (error) {
        logError('obtenerAsesores', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener lista de asesores',
            error: isDevelopment ? error.message : undefined
        });
    }
};

// ============================================
// EXPORTAR VENTAS A EXCEL/CSV
// ============================================
exports.exportarVentas = async (req, res) => {
    try {
        logRequest('exportarVentas', req, { filtros: req.query });

        const {
            asesor_id,
            estado,
            estado_detallado,
            fecha_desde,
            fecha_hasta,
            formato = 'excel'
        } = req.query;

        // Construir query con filtros
        let whereConditions = ['v.activo = true'];
        let queryParams = [];
        let paramCount = 0;

        if (asesor_id) {
            paramCount++;
            whereConditions.push(`v.asesor_id = $${paramCount}`);
            queryParams.push(asesor_id);
        }

        if (estado) {
            paramCount++;
            whereConditions.push(`v.estado = $${paramCount}`);
            queryParams.push(estado);
        }

        if (estado_detallado) {
            paramCount++;
            whereConditions.push(`v.estado_detallado = $${paramCount}`);
            queryParams.push(estado_detallado);
        }

        if (fecha_desde) {
            paramCount++;
            whereConditions.push(`v.fecha_creacion >= $${paramCount}`);
            queryParams.push(fecha_desde);
        }

        if (fecha_hasta) {
            paramCount++;
            whereConditions.push(`v.fecha_creacion <= $${paramCount}`);
            queryParams.push(fecha_hasta + ' 23:59:59');
        }

        const exportQuery = `
            SELECT
                v.codigo,
                v.fecha_creacion::date as fecha_venta,
                CONCAT(v.nombre_cliente, ' ', COALESCE(v.apellido_cliente, '')) as cliente,
                v.cliente_email,
                v.cliente_telefono,
                v.cliente_empresa,
                v.tipo_venta,
                v.estado_detallado,
                v.valor_total,
                v.descuento_monto,
                v.valor_final,
                v.moneda,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as asesor,
                v.canal_origen,
                '' as observaciones,
                v.fecha_entrega_estimada::date as entrega_estimada,
                v.fecha_entrega_real::date as entrega_real,
                COUNT(vd.id) as total_productos
            FROM ventas v
            LEFT JOIN usuarios u ON v.asesor_id = u.id
            LEFT JOIN venta_detalles vd ON v.id = vd.venta_id AND vd.activo = true
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY v.id, u.nombre, u.apellido
            ORDER BY v.fecha_creacion DESC
        `;

        const result = await query(exportQuery, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron ventas con los filtros aplicados'
            });
        }

        const ventas = result.rows;

        if (formato === 'csv') {
            // Generar CSV
            const headers = [
                'Código', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Empresa',
                'Tipo Documento', 'Estado', 'Valor Total', 'Descuento', 'Valor Final',
                'Moneda', 'Asesor', 'Canal', 'Observaciones', 'Entrega Estimada',
                'Entrega Real', 'Total Productos'
            ];

            let csvContent = headers.join(',') + '\n';

            ventas.forEach(venta => {
                const row = [
                    venta.codigo || '',
                    venta.fecha_venta || '',
                    `"${venta.cliente || ''}"`,
                    venta.cliente_email || '',
                    venta.cliente_telefono || '',
                    `"${venta.cliente_empresa || ''}"`,
                    venta.tipo_venta || '',
                    venta.estado_detallado || '',
                    venta.valor_total || 0,
                    venta.descuento_monto || 0,
                    venta.valor_final || 0,
                    venta.moneda || 'USD',
                    `"${venta.asesor || ''}"`,
                    venta.canal_origen || '',
                    `"${venta.observaciones || ''}"`,
                    venta.entrega_estimada || '',
                    venta.entrega_real || '',
                    venta.total_productos || 0
                ];
                csvContent += row.join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=ventas_${new Date().toISOString().split('T')[0]}.csv`);
            res.send('\ufeff' + csvContent); // BOM for UTF-8

        } else {
            // Para Excel, necesitaríamos una librería como xlsx
            // Por ahora, devolver JSON con estructura Excel-compatible
            const excelData = {
                headers: [
                    'Código', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Empresa',
                    'Tipo Documento', 'Estado', 'Valor Total', 'Descuento', 'Valor Final',
                    'Moneda', 'Asesor', 'Canal', 'Observaciones', 'Entrega Estimada',
                    'Entrega Real', 'Total Productos'
                ],
                data: ventas.map(venta => [
                    venta.codigo,
                    venta.fecha_venta,
                    venta.cliente,
                    venta.cliente_email,
                    venta.cliente_telefono,
                    venta.cliente_empresa,
                    venta.tipo_venta,
                    venta.estado_detallado,
                    parseFloat(venta.valor_total || 0),
                    parseFloat(venta.descuento_monto || 0),
                    parseFloat(venta.valor_final || 0),
                    venta.moneda,
                    venta.asesor,
                    venta.canal_origen,
                    venta.observaciones,
                    venta.entrega_estimada,
                    venta.entrega_real,
                    parseInt(venta.total_productos || 0)
                ]),
                resumen: {
                    total_registros: ventas.length,
                    valor_total: ventas.reduce((sum, v) => sum + parseFloat(v.valor_final || 0), 0),
                    fecha_exportacion: new Date().toISOString()
                }
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=ventas_${new Date().toISOString().split('T')[0]}.json`);
            res.json(excelData);
        }

        logSuccess('exportarVentas', {
            count: ventas.length,
            formato,
            value: ventas.reduce((sum, v) => sum + parseFloat(v.valor_final || 0), 0)
        });

    } catch (error) {
        logError('exportarVentas', error, { filtros: req.query });
        res.status(500).json({
            success: false,
            message: 'Error al exportar ventas',
            error: isDevelopment ? error.message : undefined
        });
    }
};

if (isDevelopment) {
    console.log('✅ VentasController Optimized loaded successfully');
    console.log('📋 Available methods:', Object.keys(exports));
    console.log('⚡ Production ready - Optimized performance');
}

module.exports = exports;