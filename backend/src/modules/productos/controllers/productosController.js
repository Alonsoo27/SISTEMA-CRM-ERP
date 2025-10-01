const { query } = require('../../../config/database');
const ExcelJS = require('exceljs');
const winston = require('winston');

// CONSTANTES PARA OPTIMIZACIÓN
const BATCH_SIZE = 50;
const MAX_CONCURRENT_OPERATIONS = 3;
const MAX_PRODUCTS_PER_UPLOAD = 5000;

// CONFIGURACIÓN DE LOGGING
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'productos-upload' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/productos.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// VALIDACIONES
const validarProducto = (producto) => {
    const errores = [];

    if (!producto.codigo?.trim()) {
        errores.push('El código es requerido');
    } else if (producto.codigo.length > 50) {
        errores.push('El código no puede exceder 50 caracteres');
    }

    if (!producto.descripcion?.trim()) {
        errores.push('La descripción es requerida');
    } else if (producto.descripcion.length > 500) {
        errores.push('La descripción no puede exceder 500 caracteres');
    }

    if (producto.precio_sin_igv === undefined || producto.precio_sin_igv === null) {
        errores.push('El precio sin IGV es requerido');
    } else if (isNaN(Number(producto.precio_sin_igv)) || Number(producto.precio_sin_igv) < 0) {
        errores.push('El precio sin IGV debe ser un número positivo');
    }

    if (!producto.marca?.trim()) {
        errores.push('La marca es requerida');
    } else if (producto.marca.length > 100) {
        errores.push('La marca no puede exceder 100 caracteres');
    }

    if (!producto.categoria_id?.trim()) {
        errores.push('La categoría es requerida');
    }

    if (!producto.unidad_medida?.trim()) {
        errores.push('La unidad de medida es requerida');
    } else if (!['MILLAR', 'UNIDAD', 'CIENTO', 'DOCENA', 'KILOGRAMO'].includes(producto.unidad_medida)) {
        errores.push('La unidad de medida debe ser MILLAR, UNIDAD, CIENTO, DOCENA o KILOGRAMO');
    }

    // Línea de producto es opcional - se asigna automáticamente si está vacía
    if (producto.linea_producto && producto.linea_producto.length > 100) {
        errores.push('La línea de producto no puede exceder 100 caracteres');
    }

    // Validación opcional para sublínea
    if (producto.sublinea_producto && producto.sublinea_producto.length > 100) {
        errores.push('La sublínea de producto no puede exceder 100 caracteres');
    }

    // Validar formato UUID de categoría
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (producto.categoria_id && !uuidRegex.test(producto.categoria_id)) {
        errores.push('El formato de categoría no es válido');
    }

    return errores;
};

// FUNCIONES HELPER
const verificarCategoria = async (categoriaId) => {
    try {
        const result = await query(`
            SELECT id 
            FROM categorias 
            WHERE id = $1 AND activo = true
        `, [categoriaId]);

        return result.rows.length > 0;
    } catch (error) {
        logger.error('Error al verificar categoría:', error);
        return false;
    }
};

const verificarCodigoUnico = async (codigo, idExcluir = null) => {
    try {
        let sqlQuery = 'SELECT id FROM productos WHERE codigo = $1';
        let params = [codigo];

        if (idExcluir) {
            sqlQuery += ' AND id != $2';
            params.push(idExcluir);
        }

        const result = await query(sqlQuery, params);
        return result.rows.length === 0;
    } catch (error) {
        logger.error('Error al verificar código único:', error);
        return false;
    }
};

// ==================== FUNCIONES PRINCIPALES ====================

const obtenerProductos = async (req, res) => {
    try {
        const {
            page = 1,
            limit = req.query.limit || 50000, // Sin límite práctico
            categoria,
            busqueda,
            orden = 'created_at',
            direccion = 'desc'
        } = req.query;

        // Construir query dinámicamente
        let whereConditions = ['p.activo = true'];
        let queryParams = [];
        let paramIndex = 1;

        // Filtros
        if (categoria) {
            whereConditions.push(`p.categoria_id = $${paramIndex++}`);
            queryParams.push(categoria);
        }

        if (busqueda) {
            whereConditions.push(`(
                p.codigo ILIKE $${paramIndex} OR 
                p.descripcion ILIKE $${paramIndex} OR 
                p.marca ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${busqueda}%`);
            paramIndex++;
        }

        // Validar ordenamiento
        const ordenValido = ['created_at', 'codigo', 'descripcion', 'precio_sin_igv', 'marca', 'unidad_medida'];
        const direccionValida = ['asc', 'desc'];
        const ordenSeguro = ordenValido.includes(orden) ? orden : 'created_at';
        const direccionSegura = direccionValida.includes(direccion) ? direccion : 'desc';

        // Paginación
        const offset = (Number(page) - 1) * Number(limit);
        
        // Query principal
        const dataResult = await query(`
            SELECT
                p.id,
                p.codigo,
                p.descripcion,
                p.precio_sin_igv,
                p.marca,
                p.unidad_medida,
                p.linea_producto,
                p.sublinea_producto,
                p.activo,
                p.created_at,
                p.updated_at,
                c.id as categoria_id,
                c.nombre as categoria_nombre,
                c.descripcion as categoria_descripcion
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY p.${ordenSeguro} ${direccionSegura.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, [...queryParams, Number(limit), offset]);


        // Conteo total
        const countResult = await query(`
            SELECT COUNT(*) as total
            FROM productos p
            WHERE ${whereConditions.join(' AND ')}
        `, queryParams);

        const totalRegistros = Number(countResult.rows[0]?.total || 0);

        // Formatear datos para coincidir con la estructura original
        const productos = dataResult.rows.map(row => ({
            id: row.id,
            codigo: row.codigo,
            descripcion: row.descripcion,
            precio_sin_igv: row.precio_sin_igv,
            marca: row.marca,
            unidad_medida: row.unidad_medida,
            linea_producto: row.linea_producto,
            sublinea_producto: row.sublinea_producto,
            activo: row.activo,
            created_at: row.created_at,
            updated_at: row.updated_at,
            categoria_id: row.categoria_id,
            categoria_nombre: row.categoria_nombre,
            categoria_descripcion: row.categoria_descripcion
        }));

        res.json({
            success: true,
            data: productos,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalRegistros,
                totalPages: Math.ceil(totalRegistros / Number(limit))
            }
        });

    } catch (error) {
        logger.error('Error en obtenerProductos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerProductoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        // Validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de producto no válido'
            });
        }

        const result = await query(`
            SELECT 
                p.id,
                p.codigo,
                p.descripcion,
                p.precio_sin_igv,
                p.marca,
                p.unidad_medida,
                p.activo,
                p.created_at,
                p.updated_at,
                p.created_by,
                p.updated_by,
                c.id as categoria_id,
                c.nombre as categoria_nombre,
                c.descripcion as categoria_descripcion
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const row = result.rows[0];
        const producto = {
            id: row.id,
            codigo: row.codigo,
            descripcion: row.descripcion,
            precio_sin_igv: row.precio_sin_igv,
            marca: row.marca,
            unidad_medida: row.unidad_medida,
            activo: row.activo,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by: row.created_by,
            updated_by: row.updated_by,
            categorias: row.categoria_id ? {
                id: row.categoria_id,
                nombre: row.categoria_nombre,
                descripcion: row.categoria_descripcion
            } : null
        };

        res.json({
            success: true,
            data: producto
        });

    } catch (error) {
        logger.error('Error en obtenerProductoPorId:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const crearProducto = async (req, res) => {
    try {
        const productoData = {
            codigo: req.body.codigo?.trim(),
            descripcion: req.body.descripcion?.trim(),
            precio_sin_igv: Number(req.body.precio_sin_igv),
            marca: req.body.marca?.trim(),
            categoria_id: req.body.categoria_id?.trim(),
            unidad_medida: req.body.unidad_medida?.trim() || 'UNIDAD',
            activo: req.body.activo !== undefined ? Boolean(req.body.activo) : true,
            created_by: req.user?.id || 1,
            updated_by: req.user?.id || 1
        };

        // Validar datos
        const erroresValidacion = validarProducto(productoData);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos de producto no válidos',
                details: erroresValidacion
            });
        }

        // Verificar que la categoría existe
        const categoriaExiste = await verificarCategoria(productoData.categoria_id);
        if (!categoriaExiste) {
            return res.status(400).json({
                success: false,
                error: 'La categoría especificada no existe o no está activa'
            });
        }

        // Verificar código único
        const codigoUnico = await verificarCodigoUnico(productoData.codigo);
        if (!codigoUnico) {
            return res.status(400).json({
                success: false,
                error: 'El código del producto ya existe'
            });
        }

        // Insertar producto
        const result = await query(`
            INSERT INTO productos (
                id, codigo, descripcion, precio_sin_igv, marca, categoria_id,
                unidad_medida, linea_producto, sublinea_producto, activo, created_by, updated_by, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, NOW(), NOW()
            ) RETURNING *
        `, [
            productoData.codigo,
            productoData.descripcion,
            productoData.precio_sin_igv,
            productoData.marca,
            productoData.categoria_id,
            productoData.unidad_medida,
            productoData.linea_producto,
            productoData.sublinea_producto || null,
            productoData.activo,
            productoData.created_by
        ]);

        // Obtener producto con categoría
        const productoCreado = await query(`
            SELECT 
                p.*,
                c.id as categoria_id,
                c.nombre as categoria_nombre,
                c.descripcion as categoria_descripcion
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = $1
        `, [result.rows[0].id]);

        const row = productoCreado.rows[0];
        const producto = {
            id: row.id,
            codigo: row.codigo,
            descripcion: row.descripcion,
            precio_sin_igv: row.precio_sin_igv,
            marca: row.marca,
            unidad_medida: row.unidad_medida,
            activo: row.activo,
            created_at: row.created_at,
            categorias: {
                id: row.categoria_id,
                nombre: row.categoria_nombre,
                descripcion: row.categoria_descripcion
            }
        };

        // INTEGRACIÓN AUTOMÁTICA CON ALMACÉN
        try {
            // Obtener almacén principal (o crear inventario en todos los almacenes activos)
            const almacenesResult = await query(`
                SELECT id, nombre FROM almacenes WHERE activo = true LIMIT 1
            `);

            if (almacenesResult.rows.length > 0) {
                const almacenPrincipal = almacenesResult.rows[0];

                // Crear inventario base en almacén principal
                await query(`
                    INSERT INTO inventario (
                        id, producto_id, almacen_id, stock_actual, stock_minimo, stock_maximo,
                        ultimo_movimiento, created_by, updated_by, created_at, updated_at, activo
                    ) VALUES (
                        gen_random_uuid(), $1, $2, 0, 0, null, NOW(), $3, $3, NOW(), NOW(), true
                    )
                `, [result.rows[0].id, almacenPrincipal.id, productoData.created_by]);

                logger.info('Inventario base creado automáticamente', {
                    producto_id: result.rows[0].id,
                    almacen: almacenPrincipal.nombre
                });
            }
        } catch (inventoryError) {
            // No fallar la creación del producto por error de inventario
            logger.warn('Error creando inventario automático:', inventoryError.message);
        }

        logger.info('Producto creado exitosamente', { codigo: productoData.codigo });

        res.status(201).json({
            success: true,
            message: 'Producto creado exitosamente con inventario base',
            data: producto
        });

    } catch (error) {
        logger.error('Error en crearProducto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        // Validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de producto no válido'
            });
        }

        // Verificar que el producto existe
        const existeResult = await query(`
            SELECT id, codigo FROM productos WHERE id = $1
        `, [id]);

        if (existeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const productoExistente = existeResult.rows[0];

        const productoData = {
            codigo: req.body.codigo?.trim(),
            descripcion: req.body.descripcion?.trim(),
            precio_sin_igv: Number(req.body.precio_sin_igv),
            marca: req.body.marca?.trim(),
            categoria_id: req.body.categoria_id?.trim(),
            unidad_medida: req.body.unidad_medida?.trim() || 'UNIDAD',
            activo: req.body.activo !== undefined ? Boolean(req.body.activo) : true,
            updated_by: req.user?.id || 1
        };

        // Validar datos
        const erroresValidacion = validarProducto(productoData);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos de producto no válidos',
                details: erroresValidacion
            });
        }

        // Verificar que la categoría existe
        const categoriaExiste = await verificarCategoria(productoData.categoria_id);
        if (!categoriaExiste) {
            return res.status(400).json({
                success: false,
                error: 'La categoría especificada no existe o no está activa'
            });
        }

        // Verificar código único (excluyendo el producto actual)
        if (productoData.codigo !== productoExistente.codigo) {
            const codigoUnico = await verificarCodigoUnico(productoData.codigo, id);
            if (!codigoUnico) {
                return res.status(400).json({
                    success: false,
                    error: 'El código del producto ya existe'
                });
            }
        }

        // Actualizar producto
        const result = await query(`
            UPDATE productos SET
                codigo = $1,
                descripcion = $2,
                precio_sin_igv = $3,
                marca = $4,
                categoria_id = $5,
                unidad_medida = $6,
                activo = $7,
                updated_by = $8,
                updated_at = NOW()
            WHERE id = $9
            RETURNING *
        `, [
            productoData.codigo,
            productoData.descripcion,
            productoData.precio_sin_igv,
            productoData.marca,
            productoData.categoria_id,
            productoData.unidad_medida,
            productoData.activo,
            productoData.updated_by,
            id
        ]);

        // Obtener producto con categoría
        const productoActualizado = await query(`
            SELECT 
                p.*,
                c.id as categoria_id,
                c.nombre as categoria_nombre,
                c.descripcion as categoria_descripcion
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = $1
        `, [id]);

        const row = productoActualizado.rows[0];
        const producto = {
            id: row.id,
            codigo: row.codigo,
            descripcion: row.descripcion,
            precio_sin_igv: row.precio_sin_igv,
            marca: row.marca,
            unidad_medida: row.unidad_medida,
            activo: row.activo,
            created_at: row.created_at,
            updated_at: row.updated_at,
            categorias: {
                id: row.categoria_id,
                nombre: row.categoria_nombre,
                descripcion: row.categoria_descripcion
            }
        };

        logger.info('Producto actualizado exitosamente', { codigo: productoData.codigo });

        res.json({
            success: true,
            message: 'Producto actualizado exitosamente',
            data: producto
        });

    } catch (error) {
        logger.error('Error en actualizarProducto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        // Validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de producto no válido'
            });
        }

        // Verificar que el producto existe
        const existeResult = await query(`
            SELECT id, codigo, activo FROM productos WHERE id = $1
        `, [id]);

        if (existeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const productoExistente = existeResult.rows[0];

        // Eliminación lógica
        const result = await query(`
            UPDATE productos SET
                activo = false,
                updated_at = NOW(),
                updated_by = $1
            WHERE id = $2
            RETURNING id, codigo, activo
        `, [req.user?.id || 1, id]);

        logger.info('Producto eliminado exitosamente', { codigo: productoExistente.codigo });

        res.json({
            success: true,
            message: 'Producto eliminado exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        logger.error('Error en eliminarProducto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const obtenerCategorias = async (req, res) => {
    try {
        const result = await query(`
            SELECT * FROM categorias
            WHERE activo = true
            ORDER BY nombre ASC
        `);

        res.json({
            success: true,
            data: result.rows || []
        });

    } catch (error) {
        logger.error('Error en obtenerCategorias:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== OBTENER LÍNEAS DE PRODUCTOS ====================
const obtenerLineasProductos = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                linea_producto,
                COUNT(*) as cantidad_productos
            FROM productos
            WHERE activo = true
            AND linea_producto IS NOT NULL
            AND TRIM(linea_producto) != ''
            GROUP BY linea_producto
            ORDER BY cantidad_productos DESC, linea_producto ASC
        `);

        const lineas = result.rows.map(row => ({
            value: row.linea_producto,
            label: row.linea_producto,
            productos_count: parseInt(row.cantidad_productos)
        }));

        res.json({
            success: true,
            data: lineas,
            meta: {
                total_lineas: lineas.length,
                productos_total: lineas.reduce((sum, linea) => sum + linea.productos_count, 0)
            }
        });

    } catch (error) {
        logger.error('Error en obtenerLineasProductos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== UPLOAD MASIVO OPTIMIZADO ====================

const validarProductoMasivo = (producto, fila) => {
    const errores = [];
    const prefijoError = `Fila ${fila}:`;

    if (!producto.codigo?.toString().trim()) {
        errores.push(`${prefijoError} El código es requerido`);
    } else if (producto.codigo.toString().length > 50) {
        errores.push(`${prefijoError} El código no puede exceder 50 caracteres`);
    }

    if (!producto.descripcion?.toString().trim()) {
        errores.push(`${prefijoError} La descripción es requerida`);
    } else if (producto.descripcion.toString().length > 500) {
        errores.push(`${prefijoError} La descripción no puede exceder 500 caracteres`);
    }

    const precio = Number(producto.precio_sin_igv);
    if (isNaN(precio) || precio < 0) {
        errores.push(`${prefijoError} El precio sin IGV debe ser un número positivo`);
    }

    if (!producto.marca?.toString().trim()) {
        errores.push(`${prefijoError} La marca es requerida`);
    } else if (producto.marca.toString().length > 100) {
        errores.push(`${prefijoError} La marca no puede exceder 100 caracteres`);
    }

    if (!producto.categoria?.toString().trim()) {
        errores.push(`${prefijoError} La categoría es requerida`);
    }

    if (!producto.unidad_medida?.toString().trim()) {
        errores.push(`${prefijoError} La unidad de medida es requerida`);
    } else if (!['MILLAR', 'UNIDAD', 'CIENTO', 'DOCENA', 'KILOGRAMO'].includes(producto.unidad_medida.toString().trim().toUpperCase())) {
        errores.push(`${prefijoError} La unidad de medida debe ser MILLAR, UNIDAD, CIENTO, DOCENA o KILOGRAMO`);
    }

    // Línea de producto es opcional - se asigna automáticamente si está vacía
    if (producto.linea_producto && producto.linea_producto.toString().length > 100) {
        errores.push(`${prefijoError} La línea de producto no puede exceder 100 caracteres`);
    }

    return errores;
};

const previewUploadMasivo = async (req, res) => {
    try {
        const { productos } = req.body;
        logger.info('Recibiendo upload preview:', {
            cantidad: productos?.length,
            ip: req.ip
        });

        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de productos válido'
            });
        }

        if (productos.length > MAX_PRODUCTS_PER_UPLOAD) {
            return res.status(400).json({
                success: false,
                error: `No se pueden procesar más de ${MAX_PRODUCTS_PER_UPLOAD} productos a la vez. Divida el archivo en lotes más pequeños.`
            });
        }

        // Obtener categorías para mapeo
        const categoriasResult = await query(`
            SELECT id, nombre FROM categorias WHERE activo = true
        `);

        const mapaCategorias = {};
        categoriasResult.rows.forEach(cat => {
            mapaCategorias[cat.nombre.toLowerCase()] = cat.id;
        });

        let productosValidos = [];
        let errores = [];
        let duplicados = [];
        let codigosEncontrados = new Set();

        // Obtener códigos existentes
        const codigosResult = await query('SELECT codigo FROM productos');
        const codigosExistentes = new Set(codigosResult.rows.map(p => p.codigo));

        for (let i = 0; i < productos.length; i++) {
            const producto = productos[i];
            const fila = i + 2;

            const erroresValidacion = validarProductoMasivo(producto, fila);

            // Verificar categoría
            const categoriaNombre = producto.categoria?.toString().toLowerCase().trim();
            const categoriaId = mapaCategorias[categoriaNombre];

            if (!categoriaId) {
                erroresValidacion.push(
                    `Fila ${fila}: Categoría "${producto.categoria}" no existe. ` +
                    `Categorías disponibles: ${Object.keys(mapaCategorias).join(', ')}`
                );
            }

            // Verificar duplicados
            const codigo = producto.codigo?.toString().trim();
            if (codigosEncontrados.has(codigo)) {
                duplicados.push(`Fila ${fila}: Código "${codigo}" duplicado en el archivo`);
            } else if (codigosExistentes.has(codigo)) {
                duplicados.push(`Fila ${fila}: Código "${codigo}" ya existe en la base de datos`);
            } else {
                codigosEncontrados.add(codigo);
            }

            if (erroresValidacion.length > 0) {
                errores.push(...erroresValidacion);
            } else if (categoriaId) {
                productosValidos.push({
                    fila: fila,
                    codigo: codigo,
                    descripcion: producto.descripcion?.toString().trim(),
                    precio_sin_igv: Number(producto.precio_sin_igv),
                    marca: producto.marca?.toString().trim(),
                    categoria_id: categoriaId,
                    categoria_nombre: producto.categoria?.toString().trim(),
                    unidad_medida: producto.unidad_medida?.toString().trim().toUpperCase(),
                    linea_producto: producto.linea_producto?.toString().trim(),
                    activo: true
                });
            }
        }

        const resultado = {
            success: true,
            data: {
                totalFilas: productos.length,
                productosValidos: productosValidos.length,
                errores: errores.length,
                duplicados: duplicados.length,
                resumen: {
                    productosValidos,
                    errores,
                    duplicados
                },
                puedeImportar: errores.length === 0 && duplicados.length === 0 && productosValidos.length > 0
            }
        };

        logger.info('Preview completado:', {
            total: productos.length,
            validos: productosValidos.length,
            errores: errores.length,
            duplicados: duplicados.length
        });

        res.json(resultado);

    } catch (error) {
        logger.error('Error en previewUploadMasivo:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

const uploadMasivoOptimizado = async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { productos, reemplazarDuplicados = false } = req.body;

        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de productos válido'
            });
        }

        if (productos.length > MAX_PRODUCTS_PER_UPLOAD) {
            return res.status(400).json({
                success: false,
                error: `No se pueden procesar más de ${MAX_PRODUCTS_PER_UPLOAD} productos a la vez.`
            });
        }

        logger.info('Iniciando upload masivo optimizado:', {
            cantidad: productos.length,
            reemplazarDuplicados,
            ip: req.ip
        });

        // Validación previa usando preview
        const previewRequest = { body: { productos }, ip: req.ip };
        const previewResponse = {
            json: (data) => data,
            status: (code) => ({ json: (data) => ({ ...data, statusCode: code }) })
        };

        const previewResult = await new Promise((resolve) => {
            const originalRes = res;
            res = previewResponse;
            previewUploadMasivo(previewRequest, {
                json: resolve,
                status: () => ({ json: resolve })
            });
            res = originalRes;
        });

        if (!previewResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Los datos no pasaron la validación',
                details: previewResult.data
            });
        }

        const productosValidos = previewResult.data.resumen.productosValidos;
        
        // Obtener productos existentes
        const existentesResult = await query('SELECT id, codigo FROM productos');
        const mapaExistentes = {};
        existentesResult.rows.forEach(p => {
            mapaExistentes[p.codigo] = p.id;
        });

        let productosParaInsertar = [];
        let productosParaActualizar = [];
        let productosOmitidos = [];

        // Clasificar productos
        productosValidos.forEach(producto => {
            const productoData = {
                codigo: producto.codigo,
                descripcion: producto.descripcion,
                precio_sin_igv: producto.precio_sin_igv,
                marca: producto.marca,
                categoria_id: producto.categoria_id,
                unidad_medida: producto.unidad_medida,
                activo: true,
                updated_by: req.user?.id || 1
            };

            if (mapaExistentes[producto.codigo]) {
                if (reemplazarDuplicados) {
                    productosParaActualizar.push({
                        ...productoData,
                        id: mapaExistentes[producto.codigo]
                    });
                } else {
                    productosOmitidos.push(producto.codigo);
                }
            } else {
                productosParaInsertar.push({
                    ...productoData,
                    created_by: req.user?.id || 1
                });
            }
        });

        let productosInsertados = 0;
        let productosActualizados = 0;
        let erroresInsercion = [];

        // INSERCIÓN OPTIMIZADA con lotes
        if (productosParaInsertar.length > 0) {
            logger.info(`Insertando ${productosParaInsertar.length} productos en lotes de ${BATCH_SIZE}...`);
            
            for (let i = 0; i < productosParaInsertar.length; i += BATCH_SIZE) {
                const lote = productosParaInsertar.slice(i, i + BATCH_SIZE);
                const numeroLote = Math.floor(i/BATCH_SIZE) + 1;
                
                try {
                    // Construir query de inserción múltiple
                    const valores = [];
                    const params = [];
                    let paramIndex = 1;

                    lote.forEach(producto => {
                        valores.push(`(
                            gen_random_uuid(), $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
                            $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
                            $${paramIndex++}, $${paramIndex++}, NOW(), NOW()
                        )`);
                        params.push(
                            producto.codigo,
                            producto.descripcion,
                            producto.precio_sin_igv,
                            producto.marca,
                            producto.categoria_id,
                            producto.unidad_medida,
                            producto.linea_producto,
                            producto.activo,
                            producto.created_by,
                            producto.updated_by
                        );
                    });

                    const insertQuery = `
                        INSERT INTO productos (
                            id, codigo, descripcion, precio_sin_igv, marca, categoria_id,
                            unidad_medida, linea_producto, activo, created_by, updated_by, created_at, updated_at
                        ) VALUES ${valores.join(', ')}
                        RETURNING id, codigo
                    `;

                    const result = await query(insertQuery, params);
                    productosInsertados += result.rows.length;
                    logger.info(`Lote ${numeroLote} completado: ${result.rows.length} productos`);
                    
                    // Pausa entre lotes
                    if (i + BATCH_SIZE < productosParaInsertar.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (err) {
                    logger.error(`Error en lote ${numeroLote}:`, err);
                    erroresInsercion.push(`Lote ${numeroLote}: ${err.message}`);
                }
            }
        }

        // ACTUALIZACIÓN OPTIMIZADA
        if (productosParaActualizar.length > 0) {
            logger.info(`Actualizando ${productosParaActualizar.length} productos...`);
            
            for (let i = 0; i < productosParaActualizar.length; i += MAX_CONCURRENT_OPERATIONS) {
                const grupo = productosParaActualizar.slice(i, i + MAX_CONCURRENT_OPERATIONS);
                
                const promesas = grupo.map(async (producto) => {
                    try {
                        const { id, ...datosActualizacion } = producto;
                        
                        await query(`
                            UPDATE productos SET
                                codigo = $1,
                                descripcion = $2,
                                precio_sin_igv = $3,
                                marca = $4,
                                categoria_id = $5,
                                unidad_medida = $6,
                                activo = $7,
                                updated_by = $8,
                                updated_at = NOW()
                            WHERE id = $9
                        `, [
                            datosActualizacion.codigo,
                            datosActualizacion.descripcion,
                            datosActualizacion.precio_sin_igv,
                            datosActualizacion.marca,
                            datosActualizacion.categoria_id,
                            datosActualizacion.unidad_medida,
                            datosActualizacion.activo,
                            datosActualizacion.updated_by,
                            id
                        ]);

                        return producto.codigo;
                    } catch (err) {
                        logger.error(`Error actualizando ${producto.codigo}:`, err);
                        erroresInsercion.push(`Error actualizando ${producto.codigo}: ${err.message}`);
                        return null;
                    }
                });

                const resultados = await Promise.allSettled(promesas);
                productosActualizados += resultados.filter(r => r.status === 'fulfilled' && r.value).length;
                
                if (i + MAX_CONCURRENT_OPERATIONS < productosParaActualizar.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        const duracion = Date.now() - startTime;
        
        logger.info('Upload masivo completado:', {
            insertados: productosInsertados,
            actualizados: productosActualizados,
            omitidos: productosOmitidos.length,
            errores: erroresInsercion.length,
            duracion: `${duracion}ms`
        });

        // Respuesta final
        if (erroresInsercion.length > 0) {
            return res.status(206).json({
                success: true,
                message: `Importación completada con algunos errores: ${productosInsertados} nuevos, ${productosActualizados} actualizados`,
                data: {
                    productosInsertados,
                    productosActualizados,
                    productosOmitidos: productosOmitidos.length,
                    codigosOmitidos: productosOmitidos,
                    totalProcesados: productosInsertados + productosActualizados,
                    errores: erroresInsercion,
                    duracion: `${Math.round(duracion/1000)}s`,
                    advertencia: 'Algunos productos no se pudieron procesar. Revise los errores.'
                }
            });
        }

        res.json({
            success: true,
            message: `Importación completada: ${productosInsertados} nuevos, ${productosActualizados} actualizados${productosOmitidos.length > 0 ? `, ${productosOmitidos.length} omitidos` : ''}`,
            data: {
                productosInsertados,
                productosActualizados,
                productosOmitidos: productosOmitidos.length,
                codigosOmitidos: productosOmitidos,
                totalProcesados: productosInsertados + productosActualizados,
                duracion: `${Math.round(duracion/1000)}s`,
                rendimiento: `${Math.round((productosInsertados + productosActualizados) / (duracion/1000))} productos/segundo`
            }
        });

    } catch (error) {
        logger.error('Error crítico en uploadMasivo:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message,
            sugerencia: 'Intente con un archivo más pequeño o contacte al administrador'
        });
    }
};

// ==================== PLANTILLA EXCEL ====================

const generarPlantillaMejorada = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        
        // HOJA 1: PRODUCTOS
        const worksheet = workbook.addWorksheet('Productos', {
            pageSetup: { 
                orientation: 'landscape',
                fitToPage: true,
                margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75 }
            }
        });

        // Encabezado principal
        worksheet.mergeCells('A1:F1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'PLANTILLA DE CARGA MASIVA DE PRODUCTOS - SISTEMA CRM/ERP';
        titleCell.style = {
            font: { size: 16, bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        worksheet.getRow(1).height = 35;

        // Instrucciones
        worksheet.mergeCells('A2:F2');
        const instructionsCell = worksheet.getCell('A2');
        instructionsCell.value = `INSTRUCCIONES: Complete todas las columnas obligatorias (*). Las lineas y sublineas se asignan automaticamente. Maximo ${MAX_PRODUCTS_PER_UPLOAD} productos por archivo.`;
        instructionsCell.style = {
            font: { size: 11, bold: true, color: { argb: 'D84315' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E0' } },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'FF8A65' } },
                bottom: { style: 'thin', color: { argb: 'FF8A65' } }
            }
        };
        worksheet.getRow(2).height = 30;

        worksheet.getRow(3).height = 10;

        // Encabezados de columnas actualizados
        const headers = [
            { key: 'codigo', header: 'CÓDIGO*', width: 15 },
            { key: 'descripcion', header: 'DESCRIPCIÓN*', width: 40 },
            { key: 'precio_sin_igv', header: 'PRECIO SIN IGV*', width: 18 },
            { key: 'marca', header: 'MARCA*', width: 20 },
            { key: 'categoria', header: 'CATEGORÍA*', width: 20 },
            { key: 'unidad_medida', header: 'UNIDAD*', width: 12 }
        ];

        headers.forEach((header, index) => {
            const col = String.fromCharCode(65 + index);
            const cell = worksheet.getCell(`${col}4`);
            cell.value = header.header;
            cell.style = {
                font: { size: 12, bold: true, color: { argb: 'FFFFFF' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1976D2' } },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: {
                    top: { style: 'medium', color: { argb: '0D47A1' } },
                    left: { style: 'thin', color: { argb: '0D47A1' } },
                    bottom: { style: 'medium', color: { argb: '0D47A1' } },
                    right: { style: 'thin', color: { argb: '0D47A1' } }
                }
            };
            worksheet.getColumn(col).width = header.width;
        });
        worksheet.getRow(4).height = 35;

        // Sin ejemplos - plantilla limpia

        // HOJA 2: CATEGORÍAS
        const categoriasWs = workbook.addWorksheet('Categorías');
        
        categoriasWs.mergeCells('A1:C1');
        const catTitle = categoriasWs.getCell('A1');
        catTitle.value = 'CATEGORÍAS DISPONIBLES EN EL SISTEMA';
        catTitle.style = {
            font: { size: 16, bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '388E3C' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        categoriasWs.getRow(1).height = 35;

        // Obtener categorías reales
        const categoriasResult = await query(`
            SELECT nombre, descripcion 
            FROM categorias 
            WHERE activo = true 
            ORDER BY nombre
        `);

        categoriasWs.getCell('A3').value = 'CATEGORÍA (usar exactamente este texto)';
        categoriasWs.getCell('B3').value = 'DESCRIPCIÓN';
        categoriasWs.getCell('C3').value = 'ESTADO';
        
        ['A3', 'B3', 'C3'].forEach(cell => {
            categoriasWs.getCell(cell).style = {
                font: { bold: true, color: { argb: 'FFFFFF' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '558B2F' } },
                alignment: { horizontal: 'center', vertical: 'middle' }
            };
        });

        categoriasResult.rows.forEach((cat, index) => {
            const row = index + 4;
            categoriasWs.getCell(`A${row}`).value = cat.nombre;
            categoriasWs.getCell(`B${row}`).value = cat.descripcion || '';
            categoriasWs.getCell(`C${row}`).value = 'Activa';
        });

        categoriasWs.getColumn('A').width = 30;
        categoriasWs.getColumn('B').width = 50;
        categoriasWs.getColumn('C').width = 15;

        // HOJA 3: INFORMACIÓN SOBRE ASIGNACIÓN AUTOMÁTICA
        const autoAsignacionWs = workbook.addWorksheet('Asignacion Automatica');

        autoAsignacionWs.mergeCells('A1:C1');
        const autoTitle = autoAsignacionWs.getCell('A1');
        autoTitle.value = 'ASIGNACION AUTOMATICA DE LINEAS Y SUBLINEAS';
        autoTitle.style = {
            font: { size: 16, bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5722' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        autoAsignacionWs.getRow(1).height = 35;

        const infoAutoAsignacion = [
            '',
            'COMO FUNCIONA LA ASIGNACION AUTOMATICA:',
            '',
            '• El sistema analiza la DESCRIPCION del producto automaticamente',
            '• Asigna la LINEA y SUBLINEA mas apropiada segun palabras clave',
            '• No necesitas especificar linea_producto en el archivo Excel',
            '',
            'EJEMPLOS DE ASIGNACION AUTOMATICA:',
            '',
            'Descripcion: "MOLINO PULVERIZADOR SMALL"',
            '-> Linea: MOLINOS',
            '-> Sublinea: Molinos Pulverizadores',
            '',
            'Descripcion: "VASO 12 OZ PAPEL COMPOSTABLE"',
            '-> Linea: VASOS DESECHABLES',
            '-> Sublinea: Vasos de Papel',
            '',
            'Descripcion: "CAFETERA EXPRESS 1 GRUPO"',
            '-> Linea: CAFETERAS',
            '-> Sublinea: Maquinas Express',
            '',
            'Descripcion: "FREIDORA AIRE DIGITAL"',
            '-> Linea: FREIDORAS',
            '-> Sublinea: Freidoras de Aire',
            '',
            'IMPORTANTE:',
            '• Usa descripciones claras y especificas',
            '• Incluye caracteristicas principales del producto',
            '• El sistema reconoce mas de 200 palabras clave diferentes'
        ];

        infoAutoAsignacion.forEach((info, index) => {
            const row = index + 3;
            autoAsignacionWs.getCell(`A${row}`).value = info;

            if (info.includes('COMO FUNCIONA') || info.includes('EJEMPLOS') || info.includes('IMPORTANTE')) {
                autoAsignacionWs.getCell(`A${row}`).style = {
                    font: { size: 12, bold: true, color: { argb: '1976D2' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E3F2FD' } }
                };
            }
        });

        autoAsignacionWs.getColumn('A').width = 80;

        // HOJA 4: INSTRUCCIONES
        const instruccionesWs = workbook.addWorksheet('Instrucciones');

        instruccionesWs.mergeCells('A1:D1');
        const instrTitle = instruccionesWs.getCell('A1');
        instrTitle.value = 'GUÍA COMPLETA DE USO - UPLOAD MASIVO';
        instrTitle.style = {
            font: { size: 18, bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1565C0' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        instruccionesWs.getRow(1).height = 40;

        // Instrucciones detalladas
        const instrucciones = [
            '',
            'PASOS PARA USAR ESTA PLANTILLA:',
            '',
            '1. Complete TODOS los campos marcados con asterisco (*)',
            '2. NO modifique los nombres de las columnas',
            '3. Use exactamente los nombres de categorías de la hoja "Categorías"',
            '4. Los códigos deben ser únicos (no duplicados)',
            '5. Los precios deben ser números decimales (use punto, no coma)',
            '6. Las LÍNEAS y SUBLÍNEAS se asignan automáticamente',
            '',
            'IMPORTANTE:',
            '• Máximo 5000 productos por archivo',
            '• No deje filas vacías entre productos',
            '• Guarde siempre como archivo Excel (.xlsx)',
            '• Use descripciones claras y específicas para mejor categorización',
            '',
            'EJEMPLOS DE DATOS VÁLIDOS:',
            '• Código: PROD-001, ABC-123, REF001',
            '• Precio: 25.50, 100.00, 15.75',
            '• Unidad: MILLAR, UNIDAD, CIENTO, DOCENA, KILOGRAMO',
            '• Descripción: "MOLINO PULVERIZADOR SMALL", "VASO 12 OZ PAPEL"',
            '',
            'Si todo está correcto, el sistema le mostrará un preview',
            'Revise el preview antes de confirmar la carga',
            '',
            'ERRORES COMUNES:',
            '• Usar comas en lugar de puntos en precios',
            '• Códigos duplicados',
            '• Categorías que no existen en el sistema',
            '• Dejar campos obligatorios vacíos',
            '• Descripciones muy genéricas o vagas'
        ];

        instrucciones.forEach((instruccion, index) => {
            const row = index + 3;
            instruccionesWs.getCell(`A${row}`).value = instruccion;
            
            if (instruccion.includes('PASOS') || instruccion.includes('IMPORTANTE') || instruccion.includes('EJEMPLOS') || instruccion.includes('ERRORES')) {
                instruccionesWs.getCell(`A${row}`).style = {
                    font: { size: 12, bold: true, color: { argb: '1976D2' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E3F2FD' } }
                };
            }
        });

        instruccionesWs.getColumn('A').width = 80;

        // Generar archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Plantilla_Productos_CRM_ERP.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();

        logger.info('Plantilla Excel generada exitosamente');

    } catch (error) {
        logger.error('Error generando plantilla:', error);
        res.status(500).json({
            success: false,
            error: 'Error generando plantilla',
            details: error.message
        });
    }
};

// ==================== UTILIDADES ====================

const healthCheck = async (req, res) => {
    try {
        const dbStart = Date.now();
        const result = await query('SELECT 1 as test LIMIT 1');
        const dbTime = Date.now() - dbStart;

        const memory = process.memoryUsage();
        const uptime = process.uptime();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: result.rows.length > 0,
                responseTime: `${dbTime}ms`,
                status: dbTime < 1000 ? 'good' : dbTime < 3000 ? 'warning' : 'slow'
            },
            memory: {
                rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`
            },
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            version: '2.0.0',
            limits: {
                maxProductsPerUpload: MAX_PRODUCTS_PER_UPLOAD,
                batchSize: BATCH_SIZE,
                maxConcurrentOps: MAX_CONCURRENT_OPERATIONS
            }
        });
    } catch (error) {
        logger.error('Error en healthcheck:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

const estadisticasUpload = async (req, res) => {
    try {
        const totalResult = await query('SELECT COUNT(*) as total FROM productos');
        const totalProductos = Number(totalResult.rows[0]?.total || 0);
        
        const ahora = new Date();
        const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
        
        const recientesResult = await query(`
            SELECT COUNT(*) as recientes 
            FROM productos 
            WHERE created_at > $1 OR updated_at > $1
        `, [hace24h.toISOString()]);
        
        const recientes = Number(recientesResult.rows[0]?.recientes || 0);

        const ultimaActividadResult = await query(`
            SELECT GREATEST(MAX(created_at), MAX(updated_at)) as ultima_actividad 
            FROM productos
        `);
        
        const ultimaActividad = ultimaActividadResult.rows[0]?.ultima_actividad;

        res.json({
            success: true,
            data: {
                totalProductos,
                productosRecientes24h: recientes,
                ultimaActividad,
                recomendacion: totalProductos > 10000 ? 
                    'Sistema con alto volumen. Considere usar lotes de máximo 1000 productos.' :
                    'Sistema operando normalmente.',
                limites: {
                    maxPorUpload: MAX_PRODUCTS_PER_UPLOAD,
                    batchSize: BATCH_SIZE
                }
            }
        });
    } catch (error) {
        logger.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// ==================== DASHBOARD DE PRODUCTOS ====================

const dashboardProductos = async (req, res) => {
    try {
        const { periodo = '30', linea_producto } = req.query;

        const diasAtras = parseInt(periodo) || 30;
        const fechaDesde = new Date();
        fechaDesde.setDate(fechaDesde.getDate() - diasAtras);

        // Métricas generales
        const [
            totalProductos,
            lineasDetalladas,
            topProductos,
            alertasStock,
            resumenMovimientos
        ] = await Promise.all([
            // Total productos activos
            query(`
                SELECT
                    COUNT(*) as total_productos,
                    COUNT(DISTINCT COALESCE(linea_producto, 'Sin línea')) as total_lineas,
                    COUNT(DISTINCT categoria_id) as total_categorias,
                    ROUND(AVG(precio_sin_igv), 2) as precio_promedio,
                    SUM(precio_sin_igv) as valor_total_catalogo
                FROM productos
                WHERE activo = true
            `),

            // Productos por línea (manejando valores NULL)
            query(`
                SELECT
                    COALESCE(linea_producto, 'Sin línea') as linea_producto,
                    COALESCE(sublinea_producto, 'Sin sublínea') as sublinea_producto,
                    COUNT(*) as cantidad_productos,
                    ROUND(AVG(precio_sin_igv), 2) as precio_promedio
                FROM productos
                WHERE activo = true
                ${linea_producto ? 'AND COALESCE(linea_producto, \'Sin línea\') = $1' : ''}
                GROUP BY COALESCE(linea_producto, 'Sin línea'), COALESCE(sublinea_producto, 'Sin sublínea')
                ORDER BY linea_producto, cantidad_productos DESC
            `, linea_producto ? [linea_producto] : []),

            // Top productos más vendidos (datos reales de ventas)
            query(`
                SELECT
                    p.codigo,
                    p.descripcion,
                    COALESCE(p.linea_producto, 'Sin línea') as linea_producto,
                    COALESCE(p.sublinea_producto, 'Sin sublínea') as sublinea_producto,
                    p.precio_sin_igv,
                    p.marca,
                    COUNT(vd.producto_id) as veces_vendido,
                    SUM(vd.cantidad) as cantidad_total_vendida,
                    SUM(vd.total_linea) as ingresos_totales,
                    ROUND(AVG(vd.precio_unitario), 2) as precio_promedio_venta
                FROM productos p
                LEFT JOIN venta_detalles vd ON p.id = vd.producto_id AND vd.activo = true
                LEFT JOIN ventas v ON vd.venta_id = v.id
                WHERE p.activo = true
                    AND (v.fecha_venta IS NULL OR v.fecha_venta >= $1)
                    AND (v.estado_detallado IS NULL OR v.estado_detallado = 'vendido')
                    ${linea_producto ? 'AND COALESCE(p.linea_producto, \'Sin línea\') = $2' : ''}
                GROUP BY p.id, p.codigo, p.descripcion, p.linea_producto, p.sublinea_producto, p.precio_sin_igv, p.marca
                ORDER BY cantidad_total_vendida DESC NULLS LAST, p.precio_sin_igv DESC
                LIMIT 10
            `, linea_producto ? [fechaDesde, linea_producto] : [fechaDesde]),

            // Alertas de stock bajo
            query(`
                SELECT
                    p.codigo,
                    p.descripcion,
                    COALESCE(p.linea_producto, 'Sin línea') as linea_producto,
                    i.stock_actual,
                    i.stock_minimo,
                    a.nombre as almacen_nombre,
                    CASE
                        WHEN i.stock_actual = 0 THEN 'critico'
                        WHEN i.stock_actual <= (i.stock_minimo * 0.5) THEN 'bajo'
                        ELSE 'normal'
                    END as nivel_alerta
                FROM productos p
                JOIN inventario i ON p.id = i.producto_id
                JOIN almacenes a ON i.almacen_id = a.id
                WHERE p.activo = true
                    AND i.activo = true
                    AND i.stock_actual <= i.stock_minimo
                    AND i.stock_minimo > 0
                ORDER BY (i.stock_actual::float / NULLIF(i.stock_minimo, 0)) ASC
                LIMIT 20
            `),

            // Resumen de movimientos recientes
            query(`
                SELECT
                    COUNT(*) as total_movimientos,
                    SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END) as entradas,
                    SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN cantidad ELSE 0 END) as salidas,
                    COUNT(DISTINCT producto_id) as productos_con_movimiento
                FROM movimientos_inventario
                WHERE fecha_movimiento >= $1
            `, [fechaDesde])
        ]);

        // Métricas adicionales de ventas en el período
        const metricsVentas = await query(`
            SELECT
                COUNT(DISTINCT vd.producto_id) as productos_vendidos,
                SUM(vd.cantidad) as total_unidades_vendidas,
                SUM(vd.total_linea) as ingresos_periodo,
                COUNT(DISTINCT vd.venta_id) as ventas_con_productos,
                ROUND(AVG(vd.precio_unitario), 2) as precio_promedio_real
            FROM venta_detalles vd
            JOIN ventas v ON vd.venta_id = v.id
            WHERE vd.activo = true
                AND v.fecha_venta >= $1
                AND v.estado_detallado = 'vendido'
        `, [fechaDesde]);

        const dashboard = {
            periodo: `${diasAtras} días`,
            fecha_desde: fechaDesde.toISOString().split('T')[0],
            resumen: {
                total_productos: parseInt(totalProductos.rows[0]?.total_productos || 0),
                total_lineas: parseInt(totalProductos.rows[0]?.total_lineas || 0),
                total_categorias: parseInt(totalProductos.rows[0]?.total_categorias || 0),
                precio_promedio: parseFloat(totalProductos.rows[0]?.precio_promedio || 0),
                valor_total_inventario: parseFloat(totalProductos.rows[0]?.valor_total_catalogo || 0),
                productos_activos: parseInt(totalProductos.rows[0]?.total_productos || 0),
                stock_total: parseInt(resumenMovimientos.rows[0]?.productos_con_movimiento || 0),
                almacenes_activos: alertasStock.rows.length > 0 ? 1 : 0,
                // Métricas de ventas del período
                productos_vendidos: parseInt(metricsVentas.rows[0]?.productos_vendidos || 0),
                unidades_vendidas: parseInt(metricsVentas.rows[0]?.total_unidades_vendidas || 0),
                ingresos_periodo: parseFloat(metricsVentas.rows[0]?.ingresos_periodo || 0),
                ventas_realizadas: parseInt(metricsVentas.rows[0]?.ventas_con_productos || 0)
            },
            lineas_producto: lineasDetalladas.rows,
            top_productos: topProductos.rows,
            alertas_stock: alertasStock.rows.map(alerta => ({
                ...alerta,
                codigo: alerta.codigo,
                descripcion: alerta.descripcion,
                stock_total: alerta.stock_actual,
                almacenes_afectados: 1,
                nivel: alerta.nivel_alerta
            })),
            movimientos_recientes: resumenMovimientos.rows[0] || {
                total_movimientos: 0,
                entradas: 0,
                salidas: 0,
                productos_con_movimiento: 0
            }
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        logger.error('Error en dashboardProductos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

// ==================== BÚSQUEDA POR CÓDIGO ====================
const buscarPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.body;

        if (!codigo || !codigo.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Código de producto requerido'
            });
        }

        const codigoLimpio = codigo.trim().toUpperCase();

        // Buscar producto por código exacto
        const result = await query(`
            SELECT id, codigo, descripcion, marca, categoria, unidad_medida, precio_sin_igv
            FROM productos
            WHERE UPPER(codigo) = $1 AND activo = true
            LIMIT 1
        `, [codigoLimpio]);

        if (result.rows.length > 0) {
            res.json({
                success: true,
                data: result.rows[0]
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

    } catch (error) {
        logger.error('Error en buscarPorCodigo:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

module.exports = {
    obtenerProductos,
    obtenerProductoPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    obtenerCategorias,
    obtenerLineasProductos,
    previewUploadMasivo,
    uploadMasivo: uploadMasivoOptimizado,
    generarPlantillaMejorada,
    dashboardProductos,
    healthCheck,
    estadisticasUpload,
    buscarPorCodigo
};